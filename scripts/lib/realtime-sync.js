// Tempo real genérico: reaproveita o canal postgres_changes do Supabase
// (já usado em dashboard.js pros badges) pra qualquer módulo que precise
// recarregar sua lista sozinho quando a tabela mudar no banco — sem exigir
// que o usuário recarregue a página. Debounce evita recarregar várias vezes
// em sequência quando o sync do Airtable grava um lote de registros de uma vez.
var _rtChannels  = {};
var _rtCallbacks = {}; // table -> [reloadFn, ...] — vários módulos podem observar a mesma tabela

// Cada tabela tem UM canal só. Chamar _rtWatch de novo pra uma tabela que já
// tem canal (ex.: Gestor de Tarefas e Meu Painel observando 'atividades')
// só acrescenta o novo reloadFn à lista — antes, a 2ª chamada recriava o
// canal e descartava o callback da 1ª, deixando um dos dois módulos sem
// atualização em tempo real.
function _rtWatch(table, reloadFn, debounceMs) {
 if (!_rtCallbacks[table]) _rtCallbacks[table] = [];
 _rtCallbacks[table].push(reloadFn);
 if (_rtChannels[table]) return _rtChannels[table]; // canal já existe, só somou o callback
 var timer = null;
 var trigger = function () {
  clearTimeout(timer);
  timer = setTimeout(function () {
   _rtCallbacks[table].forEach(function (fn) { try { fn(); } catch (e) {} });
  }, debounceMs || 1200);
 };
 _rtChannels[table] = _sb
  .channel('rt-' + table)
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: table }, trigger)
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: table }, trigger)
  .on('postgres_changes', { event: 'DELETE', schema: 'public', table: table }, trigger)
  .subscribe();
 return _rtChannels[table];
}

// ═══════════════════════════════════════════════════════════════════════════
// _rtWatchRows — tempo real POR LINHA (não "recarrega a lista inteira")
// ═══════════════════════════════════════════════════════════════════════════
// _rtWatch (acima) resolve o caso "alguma coisa mudou nessa tabela, recarrega
// tudo". Serve pros badges, mas é exatamente o que NÃO pode acontecer nas
// grades de Obras/Projetos/Entregas: recarregar a lista inteira a cada
// alteração de outro usuário apagaria o filtro/agrupamento/scroll de quem
// está olhando, faria a tela piscar, e ainda por cima é caríssimo (a carga de
// Obras são 8 consultas paginadas).
//
// Aqui o payload do postgres_changes já traz a LINHA nova/antiga inteira —
// dá pra atualizar só o registro afetado no array em memória e só a <tr>/card
// correspondente, sem tocar em mais nada da tela.
//
// Dedupe/limpeza (exigência explícita: "listeners criados só quando
// necessário, nunca duplicados, sempre limpos"): cada módulo se registra com
// uma CHAVE (ex.: 'obras'). Registrar de novo com a mesma chave SUBSTITUI o
// handler anterior em vez de somar mais um — sem isso, navegar Obras → Projetos
// → Obras (go('obras') roda o init de novo) acumularia um handler a cada
// visita e o mesmo evento seria processado 2, 3, 4 vezes. O canal do Supabase
// continua sendo UM por tabela, criado só na primeira inscrição.
var _rtRowChannels = {};   // tabela -> canal
var _rtRowHandlers = {};   // tabela -> { chave: {onInsert,onUpdate,onDelete} }

function _rtWatchRows(tabela, chave, handlers) {
 if (typeof _sb === 'undefined' || !_sb || typeof _sb.channel !== 'function') return;
 if (!_rtRowHandlers[tabela]) _rtRowHandlers[tabela] = {};
 _rtRowHandlers[tabela][chave] = handlers || {};   // substitui, não acumula
 if (_rtRowChannels[tabela]) return;               // canal já existe

 function despachar(evento, payload) {
  var novo = payload && payload.new && Object.keys(payload.new).length ? payload.new : null;
  var antigo = payload && payload.old && Object.keys(payload.old).length ? payload.old : null;
  var regs = _rtRowHandlers[tabela] || {};
  Object.keys(regs).forEach(function (k) {
   var h = regs[k] && regs[k][evento];
   if (typeof h !== 'function') return;
   try { h(novo, antigo); } catch (e) { console.error('[Tempo real] handler ' + tabela + '/' + k + '/' + evento + ' falhou', e); }
  });
 }

 _rtRowChannels[tabela] = _sb.channel('rows-' + tabela)
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: tabela }, function (p) { despachar('onInsert', p); })
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: tabela }, function (p) { despachar('onUpdate', p); })
  .on('postgres_changes', { event: 'DELETE', schema: 'public', table: tabela }, function (p) { despachar('onDelete', p); })
  .subscribe();
}

// Remove o handler de um módulo sem derrubar o canal (outros módulos podem
// estar observando a mesma tabela).
function _rtUnwatchRows(tabela, chave) {
 if (_rtRowHandlers[tabela]) delete _rtRowHandlers[tabela][chave];
}

// ── "Este registro foi alterado por outro usuário" ────────────────────────────
// Quando chega um UPDATE de fora para o registro que está ABERTO no painel de
// detalhe, o painel NÃO é redesenhado: o usuário pode estar no meio de uma
// digitação, e trocar o HTML embaixo dele apagaria o que ele escreveu, moveria
// o cursor e fecharia sub-abas. Em vez disso aparece uma faixa no topo do
// painel dizendo o que mudou, com um botão pro usuário recarregar QUANDO
// quiser. Idempotente: chamar de novo só atualiza o texto da faixa que já
// está lá, nunca empilha duas.
function _rtAvisoAlteracaoExterna(quemEmail, recarregarExpr) {
 var body = document.getElementById('sp-body');
 if (!body) return;
 var quem = (typeof _histNome === 'function') ? _histNome(quemEmail) : (quemEmail || 'Outro usuário');
 var el = document.getElementById('sp-aviso-externo');
 if (!el) {
  el = document.createElement('div');
  el.id = 'sp-aviso-externo';
  el.className = 'sp-aviso-externo';
  body.insertBefore(el, body.firstChild);
 }
 el.innerHTML = '<span style="flex:1">' + String(quem).replace(/</g, '&lt;')
  + ' alterou este registro agora. O que você está editando não foi perdido.</span>'
  + '<button type="button" onclick="' + recarregarExpr + '">Atualizar</button>';
}
function _rtLimparAvisoExterno() {
 var el = document.getElementById('sp-aviso-externo');
 if (el) el.remove();
}

// O e-mail do próprio usuário — pra ignorar os eventos gerados pelo PRÓPRIO
// save (senão todo autosave faria a tela avisar "outro usuário alterou").
function _rtSouEu(email) {
 var meu = (typeof _currentUser !== 'undefined' && _currentUser && _currentUser.email) || null;
 return !!(meu && email && String(meu).toLowerCase() === String(email).toLowerCase());
}

// ── Vínculos N:N (contatos_empresas/empresas_obras/contatos_obras) ─────────
// Não usa _rtWatch acima de propósito: um reload cego (recarregar as ~700
// linhas de Contatos ou ~640 de Empresas) a cada vínculo criado/removido em
// QUALQUER obra/empresa seria um desperdício e reintroduziria a lentidão já
// corrigida antes (ver _obrasCarregarPropostaMap). Aqui o payload do
// postgres_changes já traz contato_id/empresa_id/obra_id — dá pra atualizar
// só o registro afetado (_cttRefreshRowFromDB, já usado por
// _cttUnlinkEmpresa) em vez de recarregar tudo.
//
// Pedido explícito: desvincular empresa↔obra ou empresa↔contato em uma aba/
// sessão só se refletia em outra depois de um F5 — as correções pontuais
// (_empUnlink chamando _cttRefreshRowFromDB/_dbLoadObras) resolvem só quando
// QUEM fez a ação está olhando pra tela certa; não ajuda se a mudança veio de
// outra aba, outro usuário, ou um caminho de código que esqueça de chamar
// esses refreshes manuais.
//
// As 3 tabelas precisaram ser adicionadas à publication supabase_realtime
// (migração add_junction_tables_to_realtime_publication) — só empresas/
// contatos/obras/atividades/etc já vinham com replicação ligada por padrão;
// tabelas de junção não.
(function() {
 if (typeof _sb === 'undefined' || !_sb || typeof _sb.channel !== 'function') return;

 function debounce(fn, ms) {
  var timers = {};
  return function(key) {
   var args = arguments;
   if (timers[key]) clearTimeout(timers[key]);
   timers[key] = setTimeout(function(){ fn.apply(null, args); }, ms);
  };
 }

 // Refetch só do contato afetado (não a lista inteira) — mesma função já
 // usada por _cttUnlinkEmpresa; se o painel desse contato estiver aberto,
 // também atualiza os chips "Empresas vinculadas" na hora.
 var syncContato = debounce(function(contatoId) {
  if (typeof _cttRefreshRowFromDB === 'function') _cttRefreshRowFromDB(contatoId);
  if (typeof _spCttCurrentId !== 'undefined' && String(_spCttCurrentId) === String(contatoId)
   && typeof _cttRenderEmpresasVinculadas === 'function') {
   _cttRenderEmpresasVinculadas();
  }
 }, 300);

 // Se o painel dessa empresa estiver aberto, re-renderiza a linha inteira
 // (recarrega "Obras vinculadas"/"Contatos vinculados" junto).
 var syncEmpresaPanel = debounce(function(empresaId) {
  if (typeof _spEmpCurrentId === 'undefined' || String(_spEmpCurrentId) !== String(empresaId)) return;
  var row = document.querySelector('#emp-tbody tr[data-id="' + empresaId + '"]');
  if (row && typeof _spEmpresas === 'function') _spEmpresas(row, []);
 }, 300);

 // Empresa/Contato de Obra afetam a lista (colunas Empresa/Contato) e o
 // Kanban — recarrega os dois. Debounced com uma chave fixa: várias
 // mudanças em sequência (ex.: trocar de empresa) viram só 1 reload.
 var syncObras = debounce(function() {
  if (typeof _dbLoadObras === 'function') _dbLoadObras();
  if (typeof _dbLoadObrasKanban === 'function') _dbLoadObrasKanban();
 }, 300);

 function _rtRowOf(payload) {
  return (payload.new && Object.keys(payload.new).length) ? payload.new : payload.old;
 }

 _sb.channel('vinculos-realtime')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'contatos_empresas' }, function(payload) {
   var row = _rtRowOf(payload);
   if (!row) return;
   syncContato(row.contato_id);
   syncEmpresaPanel(row.empresa_id);
  })
  .on('postgres_changes', { event: '*', schema: 'public', table: 'empresas_obras' }, function(payload) {
   var row = _rtRowOf(payload);
   if (!row) return;
   syncObras('obras');
   syncEmpresaPanel(row.empresa_id);
  })
  .on('postgres_changes', { event: '*', schema: 'public', table: 'contatos_obras' }, function(payload) {
   var row = _rtRowOf(payload);
   if (!row) return;
   syncObras('obras');
   syncContato(row.contato_id);
  })
  .subscribe();
})();
