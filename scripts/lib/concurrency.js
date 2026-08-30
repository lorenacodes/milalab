// ═══════════════════════════════════════════════════════════════════════════════
// CONTROLE DE CONCORRÊNCIA (optimistic locking) — _ccSave
// ═══════════════════════════════════════════════════════════════════════════════
// Problema real que isto resolve (achado na auditoria): os autosaves dos painéis
// de detalhe (_spSaveObraFull, _spSaveProjetoFull, _spSaveEntregaCampo) faziam
//     _sb.from('obras').update(payloadInteiro).eq('id', id)
// — ou seja, gravavam TODOS os campos do formulário a cada alteração, sem
// nenhuma checagem de versão. Com dois usuários no mesmo registro isso dava
// dois tipos de perda silenciosa de dados:
//
//   (a) A abre a Obra, B abre a mesma Obra. B muda a Cidade e salva. A muda o
//       Nome 10s depois: o autosave de A manda TAMBÉM a Cidade — o valor
//       ANTIGO, que A tinha na tela desde antes — e desfaz a alteração de B
//       sem ninguém perceber.
//   (b) A e B mudam o MESMO campo: o último a salvar simplesmente ganha, e o
//       primeiro nunca fica sabendo que o valor dele foi descartado.
//
// A correção tem duas metades, ambas aqui:
//
//   1. SÓ OS CAMPOS QUE MUDARAM vão pro banco. `baseline` é a cópia do
//      registro como ele veio do banco quando o painel abriu; qualquer campo
//      do payload igual ao baseline é descartado antes do UPDATE. Isso já
//      resolve (a) por completo: dois usuários mexendo em campos DIFERENTES
//      do mesmo registro não se atropelam mais, porque cada UPDATE toca só
//      as colunas que aquele usuário realmente editou.
//
//   2. TRAVA OTIMISTA por `updated_at`. O UPDATE carrega
//      `.eq('updated_at', baseline.updated_at)` — se alguém gravou nesse
//      registro entre a abertura do painel e o save, o updated_at no banco já
//      é outro (trg_*_updated_at atualiza em todo UPDATE) e o UPDATE casa
//      ZERO linhas em vez de sobrescrever. Não precisou de coluna `version`
//      nova: updated_at já existe em obras/projetos/entregas e já é mantido
//      por trigger no banco (não dá pro cliente forjar).
//
//      Quando não casa, relemos a linha e comparamos: se os campos que ESTE
//      usuário mudou não são os mesmos que mudaram no banco, é o caso (a) —
//      dá pra mesclar sozinho, e a função só repete o UPDATE com o
//      updated_at novo, sem incomodar ninguém. Se há sobreposição de campo,
//      é o caso (b) — aí NÃO grava e devolve `conflito`, pro chamador avisar
//      o usuário em português e recarregar o registro.
//
// Por que a comparação de updated_at funciona via PostgREST: mandamos de volta
// exatamente a STRING que o banco devolveu no select (ex.:
// "2026-08-30T11:22:33.123456+00:00"), sem passar por new Date() — um
// round-trip por Date perderia os microssegundos e a comparação nunca casaria.
// Por isso _ccBaseline guarda o valor cru.

// Campos que nunca entram no diff — são mantidos por trigger no banco e
// mandá-los de volta só geraria ruído (ou seria ignorado/sobrescrito).
var _CC_CAMPOS_IGNORADOS = {
 id: 1, created_at: 1, updated_at: 1, criado_por: 1, atualizado_por: 1,
 ultima_alteracao_por: 1, airtable_id: 1,
};

// Normaliza pra comparar: '' e undefined viram null (o formulário devolve ''
// onde o banco guarda NULL — sem isso todo campo vazio pareceria "alterado" a
// cada save e o UPDATE nunca ficaria vazio de verdade).
function _ccNorm(v) {
 if (v === '' || v === undefined) return null;
 return v;
}
function _ccIgual(a, b) {
 a = _ccNorm(a); b = _ccNorm(b);
 if (a === null && b === null) return true;
 if (a === null || b === null) return false;
 if (Array.isArray(a) || Array.isArray(b) || typeof a === 'object' || typeof b === 'object') {
  return JSON.stringify(a) === JSON.stringify(b);
 }
 // Number vs string vinda de <input>: 10 e "10" são o mesmo valor de negócio.
 if (typeof a === 'number' || typeof b === 'number') {
  var na = Number(a), nb = Number(b);
  if (!isNaN(na) && !isNaN(nb)) return na === nb;
 }
 return String(a) === String(b);
}

// Guarda a cópia "como veio do banco" de um registro aberto num painel. Chave
// tabela+id, então dois painéis de entidades diferentes não se misturam.
var _ccBaselines = {};
function _ccBaselineKey(tabela, id) { return tabela + ':' + id; }
function _ccSetBaseline(tabela, id, row) {
 if (!id || !row) return;
 _ccBaselines[_ccBaselineKey(tabela, id)] = Object.assign({}, row);
}
function _ccGetBaseline(tabela, id) {
 return _ccBaselines[_ccBaselineKey(tabela, id)] || null;
}
// Depois de um save (ou de um evento de tempo real) o baseline precisa avançar
// pro estado novo, senão o PRÓXIMO save reenviaria como "alteração" tudo o que
// já foi gravado, e a trava otimista compararia contra um updated_at velho.
function _ccPatchBaseline(tabela, id, patch) {
 var b = _ccGetBaseline(tabela, id);
 if (!b) return;
 Object.assign(b, patch);
}

// Só os campos realmente alterados em relação ao baseline.
function _ccDiff(baseline, payload) {
 var diff = {};
 Object.keys(payload || {}).forEach(function (k) {
  if (_CC_CAMPOS_IGNORADOS[k]) return;
  if (!baseline || !_ccIgual(baseline[k], payload[k])) diff[k] = payload[k];
 });
 return diff;
}

// Rótulo amigável de campo pra mensagem de conflito. Os módulos registram os
// seus mapas aqui (ver _OBRA_CAMPO_LABEL etc.) pra a mensagem não sair falando
// "etapa_negocio" pro usuário final.
var _CC_LABELS = {};
function _ccRegistrarLabels(tabela, mapa) { _CC_LABELS[tabela] = mapa || {}; }
function _ccLabel(tabela, campo) {
 var m = _CC_LABELS[tabela] || {};
 return m[campo] || campo;
}

// ── Save principal ───────────────────────────────────────────────────────────
// Devolve sempre um objeto (nunca lança):
//   { semMudanca: true }                       nada pra gravar
//   { ok: true, row, mesclado: bool }          gravou (mesclado = houve merge automático)
//   { conflito: true, campos: [...], atual }   NÃO gravou — mesmo campo mexido por outro
//   { excluido: true }                         NÃO gravou — registro não existe mais
//   { erro: <PostgrestError> }                 NÃO gravou — falha técnica
async function _ccSave(tabela, id, payload, opts) {
 opts = opts || {};
 if (!_sb || !id) return { erro: { message: 'sem conexão' } };
 var baseline = opts.baseline || _ccGetBaseline(tabela, id);

 // Sem baseline não dá pra fazer trava otimista nenhuma (o painel abriu antes
 // desta versão do código, ou o renderer esqueceu de chamar _ccSetBaseline).
 // Busca o estado atual e usa ELE como baseline: pior caso perdemos a chance
 // de detectar um conflito que começou antes desta linha, mas nunca gravamos
 // às cegas um payload inteiro por cima do trabalho de outro usuário.
 if (!baseline) {
  var b0 = await _sb.from(tabela).select('*').eq('id', id).maybeSingle();
  if (b0.error) { console.error('[Concorrência] falha ao ler baseline de ' + tabela + '/' + id, b0.error); return { erro: b0.error }; }
  if (!b0.data) return { excluido: true };
  baseline = b0.data;
  _ccSetBaseline(tabela, id, baseline);
 }

 var alterados = _ccDiff(baseline, payload);
 var campos = Object.keys(alterados);
 if (!campos.length) return { semMudanca: true };

 // Até 3 tentativas: cada uma só repete quando deu pra mesclar sozinho (campos
 // disjuntos). Limite existe pra o autosave não entrar em loop se o registro
 // estiver sendo gravado sem parar por um sync em lote.
 for (var tentativa = 0; tentativa < 3; tentativa++) {
  var q = _sb.from(tabela).update(alterados).eq('id', id);
  // updated_at nulo (registro nunca atualizado desde a criação) precisa de
  // .is() em vez de .eq() — PostgREST não casa NULL com eq.
  q = baseline.updated_at == null ? q.is('updated_at', null) : q.eq('updated_at', baseline.updated_at);
  var res = await q.select('*');
  if (res.error) { console.error('[Concorrência] erro ao gravar ' + tabela + '/' + id, res.error); return { erro: res.error }; }

  if (res.data && res.data.length) {
   var row = res.data[0];
   _ccSetBaseline(tabela, id, row);
   return { ok: true, row: row, mesclado: tentativa > 0, campos: campos };
  }

  // Zero linhas afetadas → alguém gravou primeiro (ou o registro sumiu).
  var atualRes = await _sb.from(tabela).select('*').eq('id', id).maybeSingle();
  if (atualRes.error) { console.error('[Concorrência] erro ao reler ' + tabela + '/' + id, atualRes.error); return { erro: atualRes.error }; }
  if (!atualRes.data) return { excluido: true };
  var atual = atualRes.data;

  var mudaramNoBanco = campos.filter(function (k) { return !_ccIgual(baseline[k], atual[k]); });
  if (mudaramNoBanco.length) {
   // Sobreposição real: o outro usuário mexeu num campo que ESTE usuário
   // também mexeu. Não grava — quem chamou avisa e recarrega.
   _ccSetBaseline(tabela, id, atual);
   return { conflito: true, campos: mudaramNoBanco, atual: atual };
  }
  // Campos disjuntos: dá pra mesclar. Avança o baseline pro estado atual do
  // banco (updated_at novo) e tenta de novo com o MESMO conjunto de campos.
  baseline = atual;
  _ccSetBaseline(tabela, id, atual);
 }
 console.error('[Concorrência] ' + tabela + '/' + id + ': 3 tentativas de merge sem sucesso');
 return { conflito: true, campos: campos, atual: baseline };
}

// Mensagem padrão de conflito, em português, igual em todos os módulos.
function _ccMsgConflito(tabela, campos) {
 var nomes = (campos || []).map(function (c) { return _ccLabel(tabela, c); }).filter(Boolean);
 var lista = nomes.length ? ' (' + nomes.join(', ') + ')' : '';
 return 'Este registro foi alterado por outro usuário' + lista
  + '. Sua alteração NÃO foi salva para não apagar a dele — os dados na tela foram atualizados. Confira e faça a alteração de novo.';
}

// Atalho usado pelos autosaves: trata os 5 desfechos de _ccSave de um jeito só.
// `onRecarregar(atual)` é chamado quando o painel precisa reexibir o registro
// vindo do banco (conflito ou merge automático).
async function _ccSaveComFeedback(tabela, id, payload, opts) {
 opts = opts || {};
 var r = await _ccSave(tabela, id, payload, opts);
 if (r.semMudanca) return r;
 if (r.excluido) {
  _showToast('Este registro foi excluído por outro usuário. Nada foi salvo.', 'erro');
  return r;
 }
 if (r.erro) {
  _showToast('Não foi possível salvar: ' + _supaErrPt(r.erro.message), 'erro');
  return r;
 }
 if (r.conflito) {
  _showToast(_ccMsgConflito(tabela, r.campos), 'erro');
  if (typeof opts.onRecarregar === 'function') { try { opts.onRecarregar(r.atual); } catch (e) { console.error('[Concorrência] erro ao recarregar painel', e); } }
  return r;
 }
 if (typeof opts.onRecarregar === 'function' && r.mesclado) {
  try { opts.onRecarregar(r.row); } catch (e) { console.error('[Concorrência] erro ao recarregar painel', e); }
 }
 if (opts.toastOk !== false) _showToast('Alteração salva', 'ok');
 return r;
}

// ── Guarda de clique duplo / requisição em voo ───────────────────────────────
// Botões de "criar" (Nova Entrega, Nova Empresa, Novo Projeto...) não tinham
// nenhuma trava: dois cliques rápidos disparavam dois INSERTs e criavam dois
// registros iguais. _ccUmaVez ignora a 2ª chamada da mesma chave enquanto a
// 1ª ainda não terminou, e desabilita o botão enquanto isso.
var _ccEmVoo = {};
async function _ccUmaVez(chave, fn, botao) {
 if (_ccEmVoo[chave]) return { ignorado: true };
 _ccEmVoo[chave] = true;
 var el = typeof botao === 'string' ? document.getElementById(botao) : botao;
 var txtOriginal = null;
 if (el) { txtOriginal = el.textContent; el.disabled = true; el.style.opacity = '.6'; }
 try {
  return await fn();
 } finally {
  delete _ccEmVoo[chave];
  if (el) { el.disabled = false; el.style.opacity = ''; if (txtOriginal != null) el.textContent = txtOriginal; }
 }
}
