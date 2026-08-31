// ═══════════════════════════════════════════════════════════════════════════════
// AUTOMAÇÕES — aba de configuração do motor de automações (Gatilho → Condições
// → Ações), inspirada nas Automations do Airtable.
// ═══════════════════════════════════════════════════════════════════════════════
// O QUE MORA AQUI E O QUE MORA NO BANCO — a divisão importa:
//
//   Esta tela NÃO executa automação nenhuma. Ela só edita configuração.
//   Quem dispara é um trigger no Postgres (automacao_processar, migração
//   automacoes_motor_trigger). Foi decisão de projeto, não conveniência:
//
//   • A regra crítica da especificação (§6 — disparar só quando o registro
//     ENTRA na condição, nunca quando já estava dentro e outro campo mudou)
//     depende de comparar OLD e NEW do mesmo UPDATE. Só o banco enxerga isso.
//     No frontend, "o valor anterior" é sempre um chute do que estava na tela.
//   • Automação tem que valer pra alteração feita de QUALQUER lugar — outro
//     usuário, outra aba, sync do Airtable, script. Motor no navegador só
//     funciona pra quem está com a aba aberta.
//   • Concorrência (§9) e idempotência (§8) precisam de constraint e lock de
//     linha reais. No navegador não existe nem uma coisa nem outra.
//
//   Então: automacoes (configuração) + automacao_estado (o registro está
//   dentro da condição?) + automacao_execucoes (histórico, com UNIQUE
//   (automacao_id, source_record_id, event_key) fazendo a idempotência).
//
// Reaproveitamento (exigência §1 — não criar estrutura paralela): a trava
// otimista é _ccSave (concurrency.js), o tempo real é _rtWatchRows
// (realtime-sync.js), o painel de detalhe é o mesmo .spt-bar/.spt-panel de
// Obras/Projetos/Melhorias, e a tarefa criada nasce em `atividades` com os
// mesmos vínculos (atividades_obras/_projetos/_melhorias/_responsaveis) que
// _syncAtividadeVinculos grava — não existe "tabela de tarefas da automação".

var _autData    = [];   // automações carregadas
var _autResumo  = {};   // automacao_id -> {total_execucoes, total_erros, ultima_execucao, ultimo_status}
var _autAtiva   = null; // automação aberta no painel

// ── Vocabulário dos campos que servem de gatilho ─────────────────────────────
// Os valores são os REAIS de produção (conferidos com select distinct), não os
// da especificação, onde os dois divergem em caixa/acento/espaço. A comparação
// no banco é normalizada (automacao_norm), então dado legado com espaço
// sobrando — 'Revisão Projeto ' — continua casando.
var _AUT_ETAPAS_PROJETO = [
 'Orçamento','Análise Inicial','Aguardando Aprovação','Pré-projeto',
 'Revisão Pré-Projeto','Projeto para Aprovação','Revisão Projeto',
 'Projeto Executivo','Revisão Projeto Executivo','Ajustes de Piloto',
 'Projeto em Andamento','Aguardando Produção','Projeto Finalizado',
 'Pós-vendas','Negócio perdido'
];
var _AUT_ETAPAS_OBRA = [
 'Orçamento','Atualização de orçamento','Follow-up','Negociação',
 'Aprovação de projeto','Piloto','Projeto aprovado','Em Andamento',
 'Pós-vendas','Concluído','Negócio perdido'
];
var _AUT_TIPOS_PROJETO = ['Solar','Telhados','Steel Frame','Modular','Misto (LSF + A36)'];
var _AUT_TIPOS_OBRA    = ['Solar','Telhados','Steel Frame','Modular','Misto (LSF + A36)'];
var _AUT_AREAS         = ['Projetos','Comercial','Logística','Produção','Compras','TI','Dados','Marketing','Equipe P&D','Equipe Engenharia & Comercial'];
var _AUT_PRIORIDADES   = ['Alta','Média','Baixa'];
var _AUT_STATUS_TAREFA = ['A fazer','Em progresso','Aguardando feedback','Feito'];
var _AUT_TIPOS_TAREFA  = ['Tarefa','Evento','Rotina','P&D','Visita de campo'];

// Catálogo de campos por tabela alvo. `tipo` decide o componente da coluna
// "valor" (§4: nunca texto livre onde o campo original é lista) e quais
// operadores aparecem (§5).
var _AUT_CAMPOS = {
 projetos: [
  // `etapa: true` marca os campos que representam a ETAPA/estágio do registro.
  // É só o que _autGatilhoFrase precisa pra escrever "Quando um projeto entrar
  // em Pré-projeto" em vez do genérico "tiver Etapa do Projeto é igual a
  // Pré-projeto" — a informação fica no catálogo de campos, não hardcoded por
  // automação (o dono pediu a frase gerada a partir dos dados reais).
  { campo: 'etapa_projeto',  label: 'Etapa do Projeto', tipo: 'select', etapa: true, opcoes: _AUT_ETAPAS_PROJETO },
  { campo: 'tipo_orcamento', label: 'Tipo de Projeto',  tipo: 'select', opcoes: _AUT_TIPOS_PROJETO },
  { campo: 'produto',        label: 'Produto',          tipo: 'multi' },
  { campo: 'complexidade',   label: 'Complexidade',     tipo: 'select', opcoes: ['Baixa','Média','Alta'] },
  { campo: 'nome',           label: 'Nome do Projeto',  tipo: 'texto' },
  { campo: 'quantidade',     label: 'Quantidade',       tipo: 'numero' },
  { campo: 'valor_unitario', label: 'Valor unitário',   tipo: 'numero' },
  { campo: 'liberado_execucao', label: 'Liberado para execução', tipo: 'select', opcoes: ['true','false'] },
 ],
 obras: [
  { campo: 'etapa_negocio',  label: 'Etapa do Negócio', tipo: 'select', etapa: true, opcoes: _AUT_ETAPAS_OBRA },
  { campo: 'tipo_obra',      label: 'Tipo de Obra',     tipo: 'multi',  opcoes: _AUT_TIPOS_OBRA },
  { campo: 'etapa_projeto',  label: 'Etapa do Projeto (na Obra)', tipo: 'texto', etapa: true },
  { campo: 'canal_vendas',   label: 'Canal de vendas',  tipo: 'texto' },
  { campo: 'cidade',         label: 'Cidade',           tipo: 'texto' },
  { campo: 'estado',         label: 'Estado (UF)',      tipo: 'texto' },
  { campo: 'nome',           label: 'Nome da Obra',     tipo: 'texto' },
  { campo: 'valor',          label: 'Valor da Obra',    tipo: 'numero' },
  { campo: 'data_fechamento',label: 'Data de fechamento', tipo: 'data' },
 ],
};

// Operadores por tipo de campo, com o rótulo que o usuário lê. As chaves são
// exatamente as que automacao_cond_ok entende no banco — mudar aqui sem mudar
// lá faria a condição nunca casar, então as duas listas andam juntas.
var _AUT_OPERADORES = {
 select: [ ['igual','é igual a'], ['diferente','não é igual a'], ['vazio','está vazio'], ['nao_vazio','não está vazio'] ],
 multi:  [ ['em','contém'], ['nao_em','não contém'], ['vazio','está vazio'], ['nao_vazio','não está vazio'] ],
 texto:  [ ['igual','é igual a'], ['diferente','não é igual a'], ['contem','contém'], ['nao_contem','não contém'], ['vazio','está vazio'], ['nao_vazio','não está vazio'] ],
 numero: [ ['igual','é igual a'], ['maior','é maior que'], ['menor','é menor que'], ['maior_igual','é maior ou igual a'], ['menor_igual','é menor ou igual a'], ['vazio','está vazio'], ['nao_vazio','não está vazio'] ],
 data:   [ ['e_hoje','é hoje'], ['antes_de','é antes de'], ['depois_de','é depois de'], ['igual_data','é igual a'], ['vazio','está vazio'], ['nao_vazio','não está vazio'] ],
};
// Operadores que não usam campo de valor nenhum.
var _AUT_OPS_SEM_VALOR = { vazio: 1, nao_vazio: 1, e_hoje: 1 };

var _AUT_BASES_DATA = [
 ['hoje','Data atual'],
 ['ultima_alteracao','Data da última alteração do registro'],
 ['nenhum','Não preencher'],
];

// Rótulos pra mensagem de conflito (_ccSave) e pro histórico de alterações.
var _AUTOMACAO_CAMPO_LABEL = {
 nome: 'Nome', descricao: 'Descrição', ativo: 'Ativa/Inativa',
 tabela_alvo: 'Registro observado', condicoes: 'Condições', acao: 'Ação',
};
if (typeof _ccRegistrarLabels === 'function') _ccRegistrarLabels('automacoes', _AUTOMACAO_CAMPO_LABEL);

function _autEsc(s) {
 return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function _autCampoMeta(tabela, campo) {
 return (_AUT_CAMPOS[tabela] || []).find(function (c) { return c.campo === campo; })
  || { campo: campo, label: campo, tipo: 'texto' };
}
// A ação é sempre guardada como LISTA (§13: arquitetura pronta pra várias
// ações), mesmo com só "criar tarefa" implementada. Automação antiga gravada
// como objeto único continua sendo lida.
function _autAcoes(a) {
 var ac = (a && a.acao) || [];
 return Array.isArray(ac) ? ac : [ac];
}
function _autPrimeiraAcao(a) { return _autAcoes(a)[0] || {}; }

// Valor de condição sempre vira array pra exibir/editar (o banco aceita os
// dois formatos — automacao_valores normaliza escalar e array do mesmo jeito).
function _autValorArr(v) {
 if (v == null) return [];
 return Array.isArray(v) ? v.slice() : [v];
}

// ── Resumo curto das condições, usado nos cards recolhidos do fluxo
// GATILHO → AÇÕES (visual em linha do tempo, pedido do dono: "algo mais
// simples pro usuário", como o Trigger/Actions conectados por uma linha do
// Airtable) — mesma lógica de _autFrase, só que sem a parte da ação. ────────
function _autCondResumoTexto(tabela, conds) {
 var partes = (conds || []).map(function (c) {
  var meta = _autCampoMeta(tabela, c.campo);
  var ops  = _AUT_OPERADORES[meta.tipo] || _AUT_OPERADORES.texto;
  var rot  = (ops.find(function (o) { return o[0] === c.operador; }) || [c.operador, c.operador])[1];
  if (_AUT_OPS_SEM_VALOR[c.operador]) return meta.label + ' ' + rot;
  return meta.label + ' ' + rot + ' ' + _autValorArr(c.valor).join(' ou ');
 });
 return partes.length ? partes.join(' E ') : 'Qualquer criação ou alteração';
}

// ── Frase "QUANDO ... E ... ENTÃO ..." em português ──────────────────────────
// É o que o card e o topo do painel mostram, pro usuário entender a automação
// sem abrir nada e sem ver nome de coluna (§2/§3/§20).
function _autFrase(a) {
 var tabela = a.tabela_alvo === 'obras' ? 'uma obra' : 'um projeto';
 var conds = (a.condicoes || []).map(function (c) {
  var meta = _autCampoMeta(a.tabela_alvo, c.campo);
  var ops  = _AUT_OPERADORES[meta.tipo] || _AUT_OPERADORES.texto;
  var rot  = (ops.find(function (o) { return o[0] === c.operador; }) || [c.operador, c.operador])[1];
  if (_AUT_OPS_SEM_VALOR[c.operador]) return meta.label + ' ' + rot;
  return meta.label + ' ' + rot + ' ' + _autValorArr(c.valor).join(' ou ');
 });
 var quando = conds.length ? 'Quando ' + tabela + ' tiver ' + conds.join(' E ') : 'Quando ' + tabela + ' for criado ou alterado';
 var acoes = _autAcoes(a).map(function (ac) {
  return 'criar a tarefa "' + (ac.titulo || 'sem nome') + '"'
   + (ac.area ? ' na área ' + ac.area : '');
 });
 return quando + ', ' + (acoes.length ? acoes.join(' e ') : 'não fazer nada') + '.';
}

// ── Frases curtas do CARD da lista ──────────────────────────────────────────
// O card da lista mostra UMA frase de gatilho e UMA de ação — o dono precisa
// entender a automação em ~2 segundos, sem ler parágrafo. Tudo o que sai daqui
// vem dos dados reais da automação (condicoes/acao), nunca de texto fixo por
// automação: renomear uma etapa no cadastro muda a frase sozinha.
//
// A diferença pro _autCondResumoTexto (que o EDITOR usa nos cards recolhidos)
// é o registro: lá o texto é técnico e completo porque fica ao lado dos
// seletores que o usuário está editando; aqui é uma frase de leitura.

function _autSujeito(tabela, artigo) {
 if (tabela === 'obras') return artigo === 'def' ? 'a obra' : 'uma obra';
 return artigo === 'def' ? 'o projeto' : 'um projeto';
}

// "Quando um projeto entrar em Pré-projeto"
function _autGatilhoFrase(a) {
 var conds = (a.condicoes || []).filter(function (c) { return c && c.campo; });
 var sujeito = _autSujeito(a.tabela_alvo);
 if (!conds.length) return 'Quando ' + sujeito + ' for criado ou alterado';

 // Caso dominante (as 22 automações de produção): uma única condição de
 // igualdade sobre a etapa. Vira a frase natural que o dono pediu.
 if (conds.length === 1) {
  var c = conds[0];
  var meta = _autCampoMeta(a.tabela_alvo, c.campo);
  var vals = _autValorArr(c.valor).filter(function (v) { return String(v).trim() !== ''; });
  if (meta.etapa && (c.operador === 'igual' || c.operador === 'em') && vals.length) {
   return 'Quando ' + sujeito + ' entrar em ' + vals.join(' ou ');
  }
 }
 // Demais formatos (número, data, várias condições): reaproveita o resumo já
 // existente em vez de manter uma segunda gramática que ia divergir.
 return 'Quando ' + sujeito + ' tiver ' + _autCondResumoTexto(a.tabela_alvo, conds);
}

// 'Criar tarefa "Pré-projeto"'
function _autAcaoFrase(a) {
 var acoes = _autAcoes(a).filter(function (ac) { return ac && (ac.titulo || ac.tipo); });
 if (!acoes.length) return 'Nenhuma ação configurada';
 if (acoes.length > 1) return 'Criar ' + acoes.length + ' tarefas';
 var t = (acoes[0].titulo || '').trim();
 return t ? 'Criar tarefa "' + t + '"' : 'Criar tarefa (sem nome definido)';
}

// ═══════════════════════════════════════════════════════════════════════════
// CARGA DA PÁGINA
// ═══════════════════════════════════════════════════════════════════════════
async function _pageLoadAutomacoes() {
 var list  = document.getElementById('aut-list');
 var label = document.getElementById('aut-count-label');
 if (list)  list.innerHTML = '<div class="aut-empty">Carregando...</div>';
 if (label) label.textContent = 'carregando...';

 if (typeof _dbOk === 'undefined' || !_dbOk || !_sb) {
  _autData = []; _autRender();
  if (label) label.textContent = 'sem conexão com o banco';
  return;
 }
 try {
  // Duas consultas pequenas: a configuração e o resumo agregado (contagem/
  // última execução/erro). O histórico completo NÃO vem aqui — ele só é
  // buscado quando o usuário abre uma automação (§26: nada de puxar milhares
  // de linhas pra contar no navegador).
  var [resA, resR] = await Promise.all([
   _sb.from('automacoes').select('*').order('tabela_alvo').order('nome'),
   _sb.from('automacoes_resumo').select('*'),
  ]);
  if (resA.error) throw resA.error;
  _autData = resA.data || [];
  _autResumo = {};
  (resR.data || []).forEach(function (r) { _autResumo[r.automacao_id] = r; });
 } catch (e) {
  console.error('[Automações] erro ao carregar:', e);
  _autData = [];
  _showToast('Não foi possível carregar as automações agora. Tente atualizar a página em alguns instantes.', 'erro');
 }
 _autRender();
 _autInitRealtime();
}

function _autFiltroTexto() {
 return (((document.getElementById('aut-search') || {}).value) || '').trim().toLowerCase();
}
function _autFiltroStatus() {
 var el = document.querySelector('#aut-chips .aut-chip.active');
 return el ? el.dataset.v : 'todas';
}
function _autSetChip(el) {
 document.querySelectorAll('#aut-chips .aut-chip').forEach(function (c) { c.classList.remove('active'); });
 el.classList.add('active');
 _autRender();
}
function _autPassaFiltro(a) {
 var st = _autFiltroStatus();
 if (st === 'ativas'   && !a.ativo) return false;
 if (st === 'inativas' &&  a.ativo) return false;
 if (st === 'erro') {
  var r = _autResumo[a.id];
  if (!r || r.ultimo_status !== 'erro') return false;
 }
 var q = _autFiltroTexto();
 if (!q) return true;
 // Busca sobre o que o card REALMENTE mostra (gatilho + ação) além do nome e
 // da descrição. Buscar só em _autFrase deixaria o usuário digitar uma frase
 // que está na tela e não achar nada.
 return ((a.nome || '') + ' ' + (a.descricao || '') + ' '
   + _autGatilhoFrase(a) + ' ' + _autAcaoFrase(a) + ' ' + _autFrase(a))
  .toLowerCase().indexOf(q) !== -1;
}

function _autRender() {
 var list  = document.getElementById('aut-list');
 var label = document.getElementById('aut-count-label');
 if (!list) return;

 var ativas = _autData.filter(function (a) { return a.ativo; }).length;
 var comErro = _autData.filter(function (a) { var r = _autResumo[a.id]; return r && r.ultimo_status === 'erro'; }).length;
 var n = _autData.length;

 var dados = _autData.filter(_autPassaFiltro);
 if (label) label.textContent = dados.length + ' automaç' + (dados.length === 1 ? 'ão' : 'ões');

 // Resumo compacto em UMA linha de texto no lugar dos 4 KPI-cards grandes —
 // o dono não quer um quarto da tela gasto pra dizer "22 · 22 · 0 · 0". Os
 // números continuam todos ali, só param de ocupar espaço vertical.
 var resumoEl = document.getElementById('aut-resumo-linha');
 if (resumoEl) {
  resumoEl.innerHTML = n
   ? '<b>' + n + '</b> automaç' + (n === 1 ? 'ão' : 'ões')
     + '<i>·</i><b>' + ativas + '</b> ativa' + (ativas === 1 ? '' : 's')
     + '<i>·</i><b>' + (n - ativas) + '</b> inativa' + ((n - ativas) === 1 ? '' : 's')
     + '<i>·</i><span class="' + (comErro ? 'aut-resumo-err' : '') + '"><b>' + comErro + '</b> com erro</span>'
     // Só aparece quando um filtro/busca está escondendo alguma coisa — sem
     // isso o usuário filtra, vê 3 cards e continua lendo "22" no topo.
     + (dados.length !== n ? '<i>·</i><span class="aut-resumo-filtro">mostrando ' + dados.length + '</span>' : '')
   : '';
 }

 if (!dados.length) {
  list.innerHTML = '<div class="aut-empty">Nenhuma automação encontrada.</div>';
  return;
 }
 // Agrupado por registro observado. O título do grupo é só texto pequeno +
 // contagem: agrupar não pode virar outro card grande competindo com os cards
 // de verdade.
 var grupos = { projetos: [], obras: [] };
 dados.forEach(function (a) { (grupos[a.tabela_alvo] || (grupos[a.tabela_alvo] = [])).push(a); });
 var html = '';
 [['projetos', 'Projetos'], ['obras', 'Obras']].forEach(function (g) {
  var arr = grupos[g[0]] || [];
  if (!arr.length) return;
  html += '<div class="aut-group-title">' + g[1] + ' <span>' + arr.length + '</span></div>'
       + '<div class="aut-group">' + arr.map(_autCardHTML).join('') + '</div>';
 });
 // Um evento de tempo real (outro usuário ativou uma automação, ou uma acabou
 // de rodar) redesenha a lista inteira. Sem restaurar o scroll, quem estava
 // lendo o fim da lista era jogado pro topo sozinho.
 var y = window.scrollY;
 list.innerHTML = html;
 if (window.scrollY !== y) window.scrollTo(0, y);
}

function _autFmtQuando(iso) {
 if (!iso) return 'nunca executou';
 var d = new Date(iso);
 if (isNaN(d)) return 'nunca executou';
 return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ── Card da lista ───────────────────────────────────────────────────────────
// Redesenhado a pedido do dono: o card antigo empilhava nome + condição
// inteira + explicação + ação + responsável + prazo + prioridade + última
// execução + contagem + status + categoria, e o resultado "parecia uma lista
// técnica". Agora mostra SÓ o que responde "o que essa automação faz?":
//
//   Nome
//   ⚡ gatilho numa frase   →   ✚ ação numa frase
//   Executada 12 vezes                            [Ativa]
//
// Todo o resto (condições completas, responsável, prazo, prioridade, vínculos,
// histórico) continua a um clique de distância no painel de detalhe — não foi
// removido do sistema, só do card.
function _autCardHTML(a) {
 var r = _autResumo[a.id] || {};
 var total = Number(r.total_execucoes || 0);
 var badge = a.ativo
  ? '<span class="aut-pill aut-pill-on">Ativa</span>'
  : '<span class="aut-pill aut-pill-off">Inativa</span>';
 // Erro da última execução é um ponto discreto, não mais um segundo badge com
 // frase inteira roubando a atenção do nome da automação.
 var erro = (r.ultimo_status === 'erro')
  ? '<span class="aut-dot-err" title="A última execução desta automação falhou. Abra para ver o histórico."></span>' : '';
 var exec = total
  ? 'Executada ' + total + (total === 1 ? ' vez' : ' vezes')
  : 'Nunca executada';

 return '<div class="aut-card' + (a.ativo ? '' : ' aut-card-off') + '" data-id="' + _autEsc(a.id) + '" onclick="_spOpen(\'automacoes\', this)">'
  + '<div class="aut-card-hd">'
  + '<span class="aut-card-nome">' + _autEsc(a.nome || 'Sem nome') + '</span>'
  + erro + badge
  + '</div>'
  + '<div class="aut-rule">'
  + '<div class="aut-rule-row">'
  + '<span class="aut-rule-ic aut-rule-ic-t" aria-hidden="true">'
  + '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg>'
  + '</span>'
  + '<span class="aut-rule-tx">' + _autEsc(_autGatilhoFrase(a)) + '</span>'
  + '</div>'
  + '<div class="aut-rule-row">'
  + '<span class="aut-rule-ic aut-rule-ic-a" aria-hidden="true">'
  + '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'
  + '</span>'
  + '<span class="aut-rule-tx">' + _autEsc(_autAcaoFrase(a)) + '</span>'
  + '</div>'
  + '</div>'
  + '<div class="aut-card-meta">' + exec + '</div>'
  + '</div>';
}

// ═══════════════════════════════════════════════════════════════════════════
// PAINEL DE DETALHE — abas Configuração / Histórico de execuções
// ═══════════════════════════════════════════════════════════════════════════
function _spAutomacoes(row) { _spAutomacaoById(row.dataset.id); }

async function _spAutomacaoById(id) {
 if (!id) return;
 _spSet('Automação', 'Carregando...', '<div style="padding:40px;text-align:center;color:var(--muted)">Buscando dados...</div>', '');
 document.getElementById('sp-overlay').classList.add('sp-open');
 document.getElementById('sp-drawer').classList.add('sp-open');
 if (typeof _spTrackDirectOpen === 'function') _spTrackDirectOpen('automacoes', id);
 if (!_sb) return;
 var res = await _sb.from('automacoes').select('*').eq('id', id).maybeSingle();
 if (res.error || !res.data) {
  console.error('[Automações] erro ao abrir ' + id, res.error);
  _spSet('Automação', 'Não encontrada',
   '<div style="padding:20px;color:var(--muted)">Esta automação não existe mais — provavelmente foi excluída por outro usuário.</div>',
   '<button class="btn btn-ghost" onclick="closePanel()">Fechar</button>');
  return;
 }
 _spAutomacaoRender(res.data);
}

function _autOptsHTML(opcoes, sel, vazio) {
 var s = vazio ? '<option value="">' + _autEsc(vazio) + '</option>' : '';
 return s + (opcoes || []).map(function (o) {
  var v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o;
  return '<option value="' + _autEsc(v) + '"' + (String(v) === String(sel) ? ' selected' : '') + '>' + _autEsc(t) + '</option>';
 }).join('');
}

// Uma linha de condição. O componente da coluna "valor" segue o TIPO do campo
// original (§4): lista de opções vira chips clicáveis (nunca digitação livre),
// número vira campo numérico, data vira date picker.
function _autCondHTML(tabela, c, i) {
 var meta = _autCampoMeta(tabela, c.campo);
 var ops  = _AUT_OPERADORES[meta.tipo] || _AUT_OPERADORES.texto;
 var vals = _autValorArr(c.valor);
 var valorHTML;
 if (_AUT_OPS_SEM_VALOR[c.operador]) {
  valorHTML = '<div class="aut-cond-novalue">sem valor</div>';
 } else if (meta.tipo === 'select' || meta.tipo === 'multi') {
  var opcoes = meta.opcoes || [];
  // Valores já configurados que não estão na lista padrão continuam visíveis
  // (dado legado ou opção nova ainda não catalogada) — nunca somem em silêncio.
  vals.forEach(function (v) { if (opcoes.indexOf(v) === -1) opcoes = opcoes.concat([v]); });
  valorHTML = '<div class="aut-chips" id="aut-cond-vals-' + i + '">' + opcoes.map(function (o) {
   var on = vals.some(function (v) { return String(v).trim().toLowerCase() === String(o).trim().toLowerCase(); });
   return '<button type="button" class="aut-vchip' + (on ? ' active' : '') + '" data-v="' + _autEsc(o) + '" onclick="_autToggleValor(' + i + ',this)">' + _autEsc(o) + '</button>';
  }).join('') + '</div>';
 } else {
  var tipoInp = meta.tipo === 'numero' ? 'number' : (meta.tipo === 'data' ? 'date' : 'text');
  valorHTML = '<input class="sp-inp" type="' + tipoInp + '" id="aut-cond-val-' + i + '" value="' + _autEsc(vals[0] || '') + '" oninput="_autMarcarSujo()">';
 }
 return '<div class="aut-cond" data-i="' + i + '">'
  + '<div class="aut-cond-hd"><span class="aut-cond-lig">' + (i === 0 ? 'QUANDO' : 'E') + '</span>'
  + '<button type="button" class="aut-x" title="Remover condição" onclick="_autRemoverCond(' + i + ')">&#x2715;</button></div>'
  + '<div class="aut-cond-row">'
  + '<select class="sp-inp" id="aut-cond-campo-' + i + '" onchange="_autTrocarCampo(' + i + ')">' + _autOptsHTML((_AUT_CAMPOS[tabela] || []).map(function (m) { return [m.campo, m.label]; }), c.campo) + '</select>'
  + '<select class="sp-inp" id="aut-cond-op-' + i + '" onchange="_autTrocarOperador(' + i + ')">' + _autOptsHTML(ops, c.operador) + '</select>'
  + '</div>'
  + '<div class="aut-cond-val">' + valorHTML + '</div>'
  + '</div>';
}

function _autAcaoHTML(ac) {
 var di = ac.data_inicio || {}, df = ac.data_fim || {};
 var resp = _autValorArr(ac.responsaveis);
 var usuarios = (typeof _usuariosCache !== 'undefined' && _usuariosCache) ? _usuariosCache : [];
 return '<div class="aut-acao">'
  + '<div class="sp-field"><div class="sp-label">Nome da tarefa</div><input class="sp-inp" id="aut-ac-titulo" value="' + _autEsc(ac.titulo || '') + '" oninput="_autMarcarSujo();_autAtualizarResumoAcao()"></div>'
  + '<div class="sp-g2">'
  + '<div class="sp-field"><div class="sp-label">Tipo</div><select class="sp-inp" id="aut-ac-tipo" onchange="_autMarcarSujo()">' + _autOptsHTML(_AUT_TIPOS_TAREFA, ac.tipo_tarefa || 'Tarefa') + '</select></div>'
  + '<div class="sp-field"><div class="sp-label">Área</div><select class="sp-inp" id="aut-ac-area" onchange="_autMarcarSujo();_autAtualizarResumoAcao()">' + _autOptsHTML(_AUT_AREAS, ac.area || '', '— sem área —') + '</select></div>'
  + '</div>'
  + '<div class="sp-field"><div class="sp-label">Responsáveis</div><div class="aut-chips" id="aut-ac-resp">'
  + usuarios.map(function (u) {
     var on = resp.indexOf(u.email) !== -1;
     return '<button type="button" class="aut-vchip' + (on ? ' active' : '') + '" data-v="' + _autEsc(u.email) + '" onclick="_autToggleChip(this)">' + _autEsc(u.nome_display || u.email) + '</button>';
    }).join('')
  // Responsável configurado que não bate com nenhum usuário cadastrado fica
  // visível e marcado — assim ninguém descobre tarde que a automação está
  // apontando pra um e-mail que não existe mais.
  + resp.filter(function (e) { return !usuarios.some(function (u) { return u.email === e; }); })
        .map(function (e) { return '<button type="button" class="aut-vchip active aut-vchip-orfao" data-v="' + _autEsc(e) + '" title="Este e-mail não está cadastrado como usuário do sistema" onclick="_autToggleChip(this)">' + _autEsc(e) + '</button>'; }).join('')
  + '</div></div>'
  + '<div class="sp-g2">'
  + '<div class="sp-field"><div class="sp-label">Prioridade</div><select class="sp-inp" id="aut-ac-prio" onchange="_autMarcarSujo()">' + _autOptsHTML(_AUT_PRIORIDADES, ac.prioridade || 'Média') + '</select></div>'
  + '<div class="sp-field"><div class="sp-label">Status inicial</div><select class="sp-inp" id="aut-ac-status" onchange="_autMarcarSujo()">' + _autOptsHTML(_AUT_STATUS_TAREFA, ac.status || 'A fazer') + '</select></div>'
  + '</div>'
  + '<div class="sp-field"><div class="sp-label">Privacidade</div><select class="sp-inp" id="aut-ac-vis" onchange="_autMarcarSujo()">'
  + _autOptsHTML([['equipe','Visível para toda a equipe'],['privada','Somente quem criou']], ac.visibilidade || 'equipe') + '</select></div>'
  + '<div class="sp-stitle">Datas (preenchidas automaticamente na hora que a automação rodar)</div>'
  + '<div class="sp-g2">'
  + '<div class="sp-field"><div class="sp-label">Data de início</div><select class="sp-inp" id="aut-ac-di-base" onchange="_autMarcarSujo()">' + _autOptsHTML(_AUT_BASES_DATA, di.base || 'hoje') + '</select></div>'
  + '<div class="sp-field"><div class="sp-label">+ dias</div><input class="sp-inp" type="number" id="aut-ac-di-dias" value="' + _autEsc(di.dias == null ? 0 : di.dias) + '" oninput="_autMarcarSujo()"></div>'
  + '</div>'
  + '<div class="sp-g2">'
  + '<div class="sp-field"><div class="sp-label">Data de fim (prazo)</div><select class="sp-inp" id="aut-ac-df-base" onchange="_autMarcarSujo()">' + _autOptsHTML(_AUT_BASES_DATA, df.base || 'hoje') + '</select></div>'
  + '<div class="sp-field"><div class="sp-label">+ dias</div><input class="sp-inp" type="number" id="aut-ac-df-dias" value="' + _autEsc(df.dias == null ? 0 : df.dias) + '" oninput="_autMarcarSujo()"></div>'
  + '</div>'
  + '<div class="sp-stitle">Vínculos automáticos</div>'
  + '<label class="aut-check"><input type="checkbox" id="aut-ac-vobra" ' + (ac.vincular_obra === false ? '' : 'checked') + ' onchange="_autMarcarSujo()"> Vincular a Obra do registro que disparou</label>'
  + '<label class="aut-check"><input type="checkbox" id="aut-ac-vproj" ' + (ac.vincular_projeto === false ? '' : 'checked') + ' onchange="_autMarcarSujo()"> Vincular o Projeto do registro que disparou</label>'
  + '<label class="aut-check"><input type="checkbox" id="aut-ac-vmelh" ' + (ac.vincular_melhoria ? 'checked' : '') + ' onchange="_autMarcarSujo()"> Vincular a Melhoria associada ao projeto</label>'
  + '</div>';
}

function _spAutomacaoRender(a) {
 _autAtiva = JSON.parse(JSON.stringify(a));   // cópia editável em memória
 var ac = _autPrimeiraAcao(_autAtiva);
 var conds = _autAtiva.condicoes || [];
 // Automação ainda não configurada (sem nome de tarefa definido) abre com os
 // dois cards do fluxo já expandidos — não faz sentido pedir pro usuário
 // clicar pra descobrir que precisa preencher algo. Uma já pronta abre
 // recolhida, só com o resumo, igual ao Trigger/Actions do Airtable.
 var colapsado = ac.titulo ? ' aut-collapsed' : '';

 var html = ''
  + '<input type="hidden" id="sp-aut-id" value="' + _autEsc(a.id) + '">'
  + '<div class="spt-bar">'
  + '<button class="spt-btn active" data-target="spt-aut-config" onclick="_sptSwitch(\'aut-config\',this)">Configuração</button>'
  + '<button class="spt-btn" data-target="spt-aut-exec" onclick="_sptSwitch(\'aut-exec\',this);_autCarregarExecucoes()">Histórico de execuções</button>'
  + '<button class="spt-btn" data-target="spt-aut-hist" onclick="_sptSwitch(\'aut-hist\',this)">Alterações</button>'
  + '</div>'

  + '<div class="spt-panel" id="spt-aut-config">'
  + '<div class="aut-resumo">' + _autEsc(_autFrase(_autAtiva)) + '</div>'
  + '<label class="aut-toggle"><input type="checkbox" id="aut-ativo" ' + (a.ativo ? 'checked' : '') + ' onchange="_autSalvarAtivo()">'
  + '<span>Automação ativa</span></label>'
  + '<div class="aut-hint">Automação inativa não é executada nem processa eventos. Ao reativar, ela volta a valer só para as próximas mudanças — nada é processado retroativamente.</div>'
  + '<div class="sp-field"><div class="sp-label">Nome</div><input class="sp-inp" id="aut-nome" value="' + _autEsc(a.nome || '') + '" oninput="_autMarcarSujo()"></div>'
  + '<div class="sp-field"><div class="sp-label">Descrição</div><textarea class="sp-inp" rows="2" id="aut-desc" oninput="_autMarcarSujo()">' + _autEsc(a.descricao || '') + '</textarea></div>'

  + '<div class="aut-flow">'

  + '<div class="aut-flow-label">GATILHO</div>'
  + '<div class="aut-flow-card" onclick="_autToggleFlow(\'gatilho\')">'
  + '<div class="aut-flow-icon aut-flow-icon-trigger">'
  + '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg>'
  + '</div>'
  + '<div class="aut-flow-card-text">'
  + '<div class="aut-flow-card-title">Quando um registro corresponder às condições</div>'
  + '<div class="aut-flow-card-sub" id="aut-flow-gatilho-resumo">' + _autEsc(_autCondResumoTexto(_autAtiva.tabela_alvo, conds)) + '</div>'
  + '</div>'
  + '<div class="aut-flow-chevron" id="aut-flow-chevron-gatilho">' + (colapsado ? '&#9662;' : '&#9652;') + '</div>'
  + '</div>'
  + '<div class="aut-flow-detail' + colapsado + '" id="aut-flow-detail-gatilho">'
  + '<div class="sp-field"><div class="sp-label">Observar alterações em</div>'
  + '<select class="sp-inp" id="aut-tabela" onchange="_autTrocarTabela()">' + _autOptsHTML([['projetos','Projetos'],['obras','Obras']], a.tabela_alvo) + '</select></div>'
  + '<div class="aut-hint">A automação roda quando o registro <b>entra</b> na condição — inclusive quando ele é criado já atendendo. Se ele já estava na condição e outro campo mudou, nada acontece de novo.</div>'
  + '<div id="aut-conds">' + (conds.length ? conds.map(function (c, i) { return _autCondHTML(_autAtiva.tabela_alvo, c, i); }).join('')
      : '<div class="aut-empty-cond">Sem condições: a automação roda em qualquer criação ou alteração do registro.</div>') + '</div>'
  + '<button type="button" class="btn btn-ghost aut-add" onclick="_autAdicionarCond()">+ Adicionar condição</button>'
  + '</div>'

  + '<div class="aut-flow-connector"><span class="aut-flow-dot">&#10003;</span></div>'

  + '<div class="aut-flow-label">AÇÕES</div>'
  + '<div class="aut-flow-card aut-flow-actions-outer">'
  + '<div class="aut-flow-actions-recap">Se ' + _autEsc(_autCondResumoTexto(_autAtiva.tabela_alvo, conds)) + '</div>'
  + '<div class="aut-flow-nested" onclick="_autToggleFlow(\'acao\')">'
  + '<div class="aut-flow-icon aut-flow-icon-action">+</div>'
  + '<div class="aut-flow-card-text">'
  + '<div class="aut-flow-card-title">Criar tarefa</div>'
  + '<div class="aut-flow-card-sub" id="aut-flow-acao-resumo">' + _autEsc(ac.titulo ? 'Tarefa: "' + ac.titulo + '"' + (ac.area ? ' · ' + ac.area : '') : 'Configure o nome da tarefa') + '</div>'
  + '</div>'
  + '<div class="aut-flow-chevron" id="aut-flow-chevron-acao">' + (colapsado ? '&#9662;' : '&#9652;') + '</div>'
  + '</div>'
  + '</div>'
  + '<div class="aut-flow-detail' + colapsado + '" id="aut-flow-detail-acao">'
  + _autAcaoHTML(ac)
  + '</div>'

  + '</div>'
  + '<div id="aut-sujo-bar" class="aut-sujo-bar" style="display:none">'
  + '<span>Você tem alterações não salvas.</span>'
  + '<button type="button" class="btn btn-primary" onclick="_autSalvar()">Salvar alterações</button>'
  + '<button type="button" class="btn btn-ghost" onclick="_spAutomacaoById(document.getElementById(\'sp-aut-id\').value)">Descartar</button>'
  + '</div>'
  + '</div>'

  + '<div class="spt-panel" id="spt-aut-exec"><div id="aut-exec-lista"><div class="aut-empty">Carregando...</div></div></div>'
  + '<div class="spt-panel" id="spt-aut-hist">'
  + '<div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:10px">Histórico de alterações desta automação</div>'
  + (typeof _histPanelHTML === 'function' ? _histPanelHTML('sp-aut-hist') : '')
  + '</div>';

 _spSet('Automação', a.nome || 'Sem nome', html,
  '<button class="btn btn-ghost" onclick="_autDuplicar()">Duplicar</button>'
  + '<button class="btn btn-ghost" onclick="_autExcluir()" style="color:var(--red)">Excluir</button>'
  + '<button class="btn btn-ghost" onclick="closePanel()">Fechar</button>');

 // Baseline da trava otimista (§ teste 10: dois usuários editando a mesma
 // automação não podem se sobrescrever em silêncio) — o registro exatamente
 // como veio do banco, incluindo o updated_at que _ccSave usa de versão.
 if (typeof _ccSetBaseline === 'function') _ccSetBaseline('automacoes', a.id, Object.assign({}, a));
 if (typeof _rtLimparAvisoExterno === 'function') _rtLimparAvisoExterno();
 if (typeof _sptInitScrollSpy === 'function') _sptInitScrollSpy();
 if (typeof _histCarregar === 'function') _histCarregar('sp-aut-hist', 'automacoes', a.id);
}

// ── Edição em memória ────────────────────────────────────────────────────────
// Nada é gravado a cada tecla: o usuário edita, a barra "alterações não salvas"
// aparece, e um clique só manda tudo pro banco. Autosave por campo aqui seria
// pior que nos outros módulos — uma automação meio editada (condição nova sem
// valor ainda) já estaria valendo em produção pra todo mundo.
function _autMarcarSujo() {
 var b = document.getElementById('aut-sujo-bar');
 if (b) b.style.display = 'flex';
}
// Cards do fluxo GATILHO/AÇÕES nascem recolhidos (só a frase-resumo visível,
// igual ao Trigger/Actions do Airtable) — clicar expande o editor de verdade
// por baixo, sem precisar redesenhar nada.
function _autToggleFlow(qual) {
 var det = document.getElementById('aut-flow-detail-' + qual);
 var chev = document.getElementById('aut-flow-chevron-' + qual);
 if (!det) return;
 det.classList.toggle('aut-collapsed');
 if (chev) chev.innerHTML = det.classList.contains('aut-collapsed') ? '&#9662;' : '&#9652;';
}
// Mantém o subtítulo do card recolhido "Criar tarefa" em dia enquanto o
// usuário digita o nome da tarefa/troca a área lá dentro.
function _autAtualizarResumoAcao() {
 var el = document.getElementById('aut-flow-acao-resumo');
 if (!el) return;
 var titulo = ((document.getElementById('aut-ac-titulo') || {}).value || '').trim();
 var area   = ((document.getElementById('aut-ac-area') || {}).value || '').trim();
 el.textContent = titulo ? 'Tarefa: "' + titulo + '"' + (area ? ' · ' + area : '') : 'Configure o nome da tarefa';
}
function _autToggleChip(btn) { btn.classList.toggle('active'); _autMarcarSujo(); }
function _autToggleValor(i, btn) { btn.classList.toggle('active'); _autMarcarSujo(); }

function _autLerCondicoes() {
 var tabela = document.getElementById('aut-tabela').value;
 var out = [];
 document.querySelectorAll('#aut-conds .aut-cond').forEach(function (el) {
  var i = el.dataset.i;
  var campo = (document.getElementById('aut-cond-campo-' + i) || {}).value;
  var op    = (document.getElementById('aut-cond-op-' + i) || {}).value;
  if (!campo || !op) return;
  var cond = { campo: campo, operador: op };
  if (!_AUT_OPS_SEM_VALOR[op]) {
   var meta = _autCampoMeta(tabela, campo);
   if (meta.tipo === 'select' || meta.tipo === 'multi') {
    cond.valor = Array.prototype.map.call(
     document.querySelectorAll('#aut-cond-vals-' + i + ' .aut-vchip.active'),
     function (b) { return b.dataset.v; });
   } else {
    cond.valor = ((document.getElementById('aut-cond-val-' + i) || {}).value) || '';
   }
  }
  out.push(cond);
 });
 return out;
}

function _autLerAcao() {
 var num = function (id) { var v = (document.getElementById(id) || {}).value; return v === '' || v == null ? 0 : parseInt(v, 10) || 0; };
 var val = function (id) { return ((document.getElementById(id) || {}).value) || ''; };
 var chk = function (id) { var el = document.getElementById(id); return !!(el && el.checked); };
 return [{
  tipo: 'criar_tarefa',
  titulo: val('aut-ac-titulo'),
  tipo_tarefa: val('aut-ac-tipo') || 'Tarefa',
  area: val('aut-ac-area') || null,
  responsaveis: Array.prototype.map.call(document.querySelectorAll('#aut-ac-resp .aut-vchip.active'), function (b) { return b.dataset.v; }),
  prioridade: val('aut-ac-prio') || null,
  status: val('aut-ac-status') || 'A fazer',
  visibilidade: val('aut-ac-vis') || 'equipe',
  data_inicio: { base: val('aut-ac-di-base') || 'hoje', dias: num('aut-ac-di-dias') },
  data_fim:    { base: val('aut-ac-df-base') || 'hoje', dias: num('aut-ac-df-dias') },
  vincular_obra: chk('aut-ac-vobra'),
  vincular_projeto: chk('aut-ac-vproj'),
  vincular_melhoria: chk('aut-ac-vmelh'),
 }];
}

function _autAdicionarCond() {
 var tabela = document.getElementById('aut-tabela').value;
 var conds = _autLerCondicoes();
 var primeiro = (_AUT_CAMPOS[tabela] || [])[0] || { campo: '', tipo: 'texto' };
 var ops = _AUT_OPERADORES[primeiro.tipo] || _AUT_OPERADORES.texto;
 conds.push({ campo: primeiro.campo, operador: ops[0][0], valor: [] });
 _autRedesenharConds(tabela, conds);
 _autMarcarSujo();
}
function _autRemoverCond(i) {
 var tabela = document.getElementById('aut-tabela').value;
 var conds = _autLerCondicoes();
 conds.splice(i, 1);
 _autRedesenharConds(tabela, conds);
 _autMarcarSujo();
}
// Trocar o campo troca o TIPO do campo, então o operador e o componente de
// valor antigos podem não fazer mais sentido — recomeça os dois em vez de
// deixar uma condição inválida na tela (ex.: "Valor da Obra contém Solar").
function _autTrocarCampo(i) {
 var tabela = document.getElementById('aut-tabela').value;
 var conds = _autLerCondicoes();
 var meta = _autCampoMeta(tabela, (document.getElementById('aut-cond-campo-' + i) || {}).value);
 var ops = _AUT_OPERADORES[meta.tipo] || _AUT_OPERADORES.texto;
 conds[i] = { campo: meta.campo, operador: ops[0][0], valor: [] };
 _autRedesenharConds(tabela, conds);
 _autMarcarSujo();
}
function _autTrocarOperador(i) {
 var tabela = document.getElementById('aut-tabela').value;
 _autRedesenharConds(tabela, _autLerCondicoes());
 _autMarcarSujo();
}
function _autTrocarTabela() {
 // Campos de Projeto não existem em Obra: trocar o alvo zera as condições em
 // vez de deixar uma condição que nunca vai casar com nada.
 _autRedesenharConds(document.getElementById('aut-tabela').value, []);
 _autMarcarSujo();
}
function _autRedesenharConds(tabela, conds) {
 var box = document.getElementById('aut-conds');
 if (!box) return;
 box.innerHTML = conds.length
  ? conds.map(function (c, i) { return _autCondHTML(tabela, c, i); }).join('')
  : '<div class="aut-empty-cond">Sem condições: a automação roda em qualquer criação ou alteração do registro.</div>';
 // Os dois cards recolhidos do fluxo (§ Gatilho e o recap dentro de Ações)
 // mostram a mesma frase — atualiza os dois pra não ficar com texto velho
 // enquanto o usuário edita as condições por baixo.
 var resumo = _autCondResumoTexto(tabela, conds);
 var g = document.getElementById('aut-flow-gatilho-resumo'); if (g) g.textContent = resumo;
 var r = document.querySelector('.aut-flow-actions-recap'); if (r) r.textContent = 'Se ' + resumo;
}

// ── Gravação ─────────────────────────────────────────────────────────────────
async function _autSalvar() {
 var id = (document.getElementById('sp-aut-id') || {}).value;
 if (!id || !_sb) return;
 var nome = ((document.getElementById('aut-nome') || {}).value || '').trim();
 if (!nome) { _showToast('Dê um nome para a automação antes de salvar.', 'erro'); return; }
 var acao = _autLerAcao();
 if (!acao[0].titulo) { _showToast('Informe o nome da tarefa que a automação deve criar.', 'erro'); return; }

 var payload = {
  nome: nome,
  descricao: ((document.getElementById('aut-desc') || {}).value || '').trim() || null,
  tabela_alvo: (document.getElementById('aut-tabela') || {}).value,
  condicoes: _autLerCondicoes(),
  acao: acao,
  atualizado_por: (typeof _currentUser !== 'undefined' && _currentUser && _currentUser.email) || null,
 };
 var r = await _ccSaveComFeedback('automacoes', id, payload, {
  onRecarregar: function () { _spAutomacaoById(id); },
 });
 if (!r || r.conflito || r.erro || r.excluido) return;
 var bar = document.getElementById('aut-sujo-bar');
 if (bar) bar.style.display = 'none';
 if (r.row) { _autPatchNaLista(r.row); _autAtiva = r.row; }
}

// Ativar/desativar grava sozinho (é um interruptor, não faz sentido exigir
// "salvar" depois) — mas passa pela MESMA trava otimista.
async function _autSalvarAtivo() {
 var id = (document.getElementById('sp-aut-id') || {}).value;
 var el = document.getElementById('aut-ativo');
 if (!id || !el || !_sb) return;
 var r = await _ccSaveComFeedback('automacoes', id, {
  ativo: el.checked,
  atualizado_por: (typeof _currentUser !== 'undefined' && _currentUser && _currentUser.email) || null,
 }, { onRecarregar: function () { _spAutomacaoById(id); }, toastOk: false });
 if (!r || r.conflito || r.erro || r.excluido) return;
 _showToast(el.checked ? 'Automação ativada.' : 'Automação desativada. Ela não vai mais criar tarefas até ser reativada.', 'ok');
 if (r.row) _autPatchNaLista(r.row);
}

async function _autNova() {
 if (!_sb) { _showToast('Sem conexão com o banco. Não é possível criar uma automação agora.', 'erro'); return; }
 // _ccUmaVez: dois cliques rápidos no botão criavam duas automações iguais
 // (mesmo problema já corrigido nos outros "+ Novo" do sistema).
 await _ccUmaVez('nova-automacao', async function () {
  var res = await _sb.from('automacoes').insert({
   nome: 'Nova automação',
   descricao: null,
   tabela_alvo: 'projetos',
   ativo: false,   // nasce INATIVA de propósito: ninguém quer uma automação
                   // meio configurada já criando tarefa em produção.
   condicoes: [{ campo: 'etapa_projeto', operador: 'igual', valor: [] }],
   acao: [{ tipo: 'criar_tarefa', titulo: '', tipo_tarefa: 'Tarefa', area: 'Projetos',
            responsaveis: [], prioridade: 'Média', status: 'A fazer', visibilidade: 'equipe',
            data_inicio: { base: 'hoje', dias: 0 }, data_fim: { base: 'hoje', dias: 3 },
            vincular_obra: true, vincular_projeto: true, vincular_melhoria: false }],
   criado_por: (typeof _currentUser !== 'undefined' && _currentUser && _currentUser.email) || null,
  }).select().maybeSingle();
  if (res.error || !res.data) {
   console.error('[Automações] erro ao criar:', res.error);
   _showToast('Não foi possível criar a automação agora. Confira sua conexão e tente de novo.', 'erro');
   return;
  }
  _autData.push(res.data);
  _autRender();
  _showToast('Automação criada. Configure o gatilho e a tarefa, e ative quando estiver pronta.', 'ok');
  _spAutomacaoById(res.data.id);
 }, 'topbar-action-btn');
}

async function _autDuplicar() {
 var id = (document.getElementById('sp-aut-id') || {}).value;
 var a = _autData.find(function (x) { return String(x.id) === String(id); }) || _autAtiva;
 if (!a || !_sb) return;
 var res = await _sb.from('automacoes').insert({
  nome: (a.nome || 'Automação') + ' (cópia)',
  descricao: a.descricao,
  tabela_alvo: a.tabela_alvo,
  ativo: false,   // a cópia nasce inativa pra não duplicar tarefa sem querer
  condicoes: a.condicoes,
  acao: a.acao,
  criado_por: (typeof _currentUser !== 'undefined' && _currentUser && _currentUser.email) || null,
 }).select().maybeSingle();
 if (res.error || !res.data) {
  console.error('[Automações] erro ao duplicar:', res.error);
  _showToast('Não foi possível duplicar a automação agora. Tente de novo em alguns instantes.', 'erro');
  return;
 }
 _autData.push(res.data); _autRender();
 _showToast('Cópia criada (inativa). Ajuste o que precisar e ative.', 'ok');
 _spAutomacaoById(res.data.id);
}

async function _autExcluir() {
 var id = (document.getElementById('sp-aut-id') || {}).value;
 var a = _autData.find(function (x) { return String(x.id) === String(id); }) || _autAtiva;
 if (!a || !_sb) return;
 var r = _autResumo[id] || {};
 var aviso = Number(r.total_execucoes || 0)
  ? '\n\nO histórico das ' + r.total_execucoes + ' execuções também será apagado. As tarefas já criadas continuam onde estão.'
  : '';
 if (!confirm('Excluir a automação "' + (a.nome || '') + '"?' + aviso)) return;
 var res = await _sb.from('automacoes').delete().eq('id', id);
 if (res.error) {
  console.error('[Automações] erro ao excluir:', res.error);
  _showToast('Não foi possível excluir esta automação agora. Tente de novo em alguns instantes.', 'erro');
  return;
 }
 var i = _autData.findIndex(function (x) { return String(x.id) === String(id); });
 if (i !== -1) _autData.splice(i, 1);
 _autRender();
 closePanel();
 _showToast('Automação excluída.', 'ok');
}

// ── Histórico de execuções (§22) ─────────────────────────────────────────────
// Buscado só quando a aba é aberta, e limitado às 100 últimas — o histórico de
// uma automação antiga pode ter milhares de linhas e não faz sentido carregar
// tudo pra mostrar as recentes.
async function _autCarregarExecucoes() {
 var box = document.getElementById('aut-exec-lista');
 var id = (document.getElementById('sp-aut-id') || {}).value;
 if (!box || !id || !_sb) return;
 box.innerHTML = '<div class="aut-empty">Carregando...</div>';
 var res = await _sb.from('automacao_execucoes')
  .select('*, tarefa:atividade_id(id,titulo,status)')
  .eq('automacao_id', id).order('started_at', { ascending: false }).limit(100);
 if (res.error) {
  console.error('[Automações] erro ao ler execuções:', res.error);
  box.innerHTML = '<div class="aut-empty">Não foi possível carregar o histórico agora.</div>';
  return;
 }
 var linhas = res.data || [];
 if (!linhas.length) {
  box.innerHTML = '<div class="aut-empty">Esta automação ainda não foi executada nenhuma vez.</div>';
  return;
 }
 box.innerHTML = linhas.map(function (e) {
  var quando = _autFmtQuando(e.started_at);
  var origem = e.source_nome ? _autEsc(e.source_nome) : (e.source_table === 'obras' ? 'Obra' : 'Projeto');
  if (e.status === 'sucesso') {
   var t = e.tarefa ? _autEsc(e.tarefa.titulo) + (e.tarefa.status ? ' · ' + _autEsc(e.tarefa.status) : '') : 'tarefa criada';
   return '<div class="aut-exec aut-exec-ok"><div class="aut-exec-hd"><b>' + origem + '</b><span>' + quando + '</span></div>'
    + '<div class="aut-exec-msg">Criou a tarefa: ' + t + '</div></div>';
  }
  if (e.status === 'erro') {
   // §23: só a mensagem em português aparece aqui. O detalhe técnico
   // (sqlerrm/sqlstate) foi pro log do banco via RAISE WARNING.
   return '<div class="aut-exec aut-exec-err"><div class="aut-exec-hd"><b>' + origem + '</b><span>' + quando + '</span></div>'
    + '<div class="aut-exec-msg">' + _autEsc(e.erro || 'A automação não conseguiu concluir esta execução.') + '</div></div>';
  }
  return '<div class="aut-exec"><div class="aut-exec-hd"><b>' + origem + '</b><span>' + quando + '</span></div>'
   + '<div class="aut-exec-msg">Execução em andamento.</div></div>';
 }).join('');
}

// ── Tempo real (§24) ─────────────────────────────────────────────────────────
// Duas tabelas observadas: `automacoes` (outro usuário criou/editou/ativou) e
// `automacao_execucoes` (uma automação acabou de rodar — a contagem e o
// "última execução" do card precisam andar sozinhos). Chave fixa 'automacoes'
// em _rtWatchRows: revisitar a aba SUBSTITUI o handler em vez de empilhar mais
// um, então o mesmo evento nunca é processado duas vezes.
function _autInitRealtime() {
 if (typeof _rtWatchRows !== 'function') return;
 _rtWatchRows('automacoes', 'automacoes', {
  onInsert: function (nova) {
   if (!nova || !nova.id) return;
   if (!_autData.some(function (x) { return String(x.id) === String(nova.id); })) _autData.push(nova);
   _autRender();
  },
  onUpdate: function (nova) {
   if (!nova || !nova.id) return;
   _autPatchNaLista(nova);
   // Painel aberto nessa automação: NÃO redesenha embaixo de quem pode estar
   // no meio de uma edição — só mostra a faixa com o botão "Atualizar".
   if (String((_autAtiva || {}).id) === String(nova.id)
    && document.getElementById('sp-drawer')
    && document.getElementById('sp-drawer').classList.contains('sp-open')
    && typeof _rtAvisoAlteracaoExterna === 'function'
    && !_rtSouEu(nova.atualizado_por)) {
    _rtAvisoAlteracaoExterna(nova.atualizado_por, "_spAutomacaoById('" + nova.id + "')");
    if (typeof _ccSetBaseline === 'function') _ccSetBaseline('automacoes', nova.id, nova);
   }
  },
  onDelete: function (_n, antiga) {
   var id = antiga && antiga.id; if (!id) return;
   var i = _autData.findIndex(function (x) { return String(x.id) === String(id); });
   if (i !== -1) _autData.splice(i, 1);
   _autRender();
   if (String((_autAtiva || {}).id) === String(id)) {
    _showToast('A automação que você tinha aberta foi excluída por outro usuário.', 'erro');
    closePanel();
   }
  },
 });
 _rtWatchRows('automacao_execucoes', 'automacoes', {
  onInsert: function (nova) { _autContarExecucao(nova); },
  onUpdate: function (nova) { _autContarExecucao(nova, true); },
 });
}

// Atualiza contagem/última execução/erro do card sem recarregar a lista.
function _autContarExecucao(e, ehUpdate) {
 if (!e || !e.automacao_id) return;
 var r = _autResumo[e.automacao_id] || { total_execucoes: 0, total_erros: 0 };
 if (!ehUpdate) r.total_execucoes = Number(r.total_execucoes || 0) + 1;
 r.ultima_execucao = e.started_at;
 r.ultimo_status = e.status;
 _autResumo[e.automacao_id] = r;
 var a = _autData.find(function (x) { return String(x.id) === String(e.automacao_id); });
 if (a) _autPatchNaLista(a);
 // Se o usuário está justamente com o histórico dessa automação aberto,
 // recarrega a lista de execuções pra a nova aparecer sem F5.
 if (String((_autAtiva || {}).id) === String(e.automacao_id)) {
  var painel = document.getElementById('spt-aut-exec');
  if (painel && painel.classList.contains('active')) _autCarregarExecucoes();
 }
}

// Diferente dos outros módulos, aqui o redesenho completo é barato de verdade
// (são dezenas de automações, não milhares de linhas de obra) e a lista é
// agrupada por registro observado — remendar um card só deixaria os títulos de
// grupo e os 4 indicadores do topo desatualizados. Então patch no array em
// memória + _autRender().
function _autPatchNaLista(patch) {
 if (!patch || !patch.id) return;
 var i = _autData.findIndex(function (x) { return String(x.id) === String(patch.id); });
 if (i === -1) return;
 Object.assign(_autData[i], patch);
 _autRender();
}
