// ═══════════════════════════════════════════════════════════════════════════════
// MELHORIAS (Iniciativas de Inovação) — lista, filtro por status/tipo.
// ═══════════════════════════════════════════════════════════════════════════════
/* ── PÁGINA MELHORIAS (INICIATIVAS DE INOVAÇÃO) ──────────────────── */
// Estado da página melhorias
var _melhData      = [];   // todos os registros carregados do Supabase

// Normaliza os fallbacks de campo (nome/titulo, tipo/categoria/tipo_melhoria/
// area, status/etapa) num objeto canônico só — usado tanto pra exibir quanto
// pra filtrar/ordenar (_fbEvaluate/_sbCompare), já que aqui os cards são
// reconstruídos do zero a cada render (array em memória, sem dataset
// persistente no DOM como os outros módulos).
function _melhNormalize(m) {
 return {
  nome: m.nome || m.titulo || '',
  tipo: m.tipo || m.categoria || m.tipo_melhoria || m.area || '',
  status: m.status || m.etapa || '',
  responsavel: m.responsavel || '',
  criado: m.created_at || '',
  _raw: m,
 };
}

// Vocabulário ÚNICO de Status (as 4 opções que os KPIs sempre mostraram e que
// o <select> do painel de detalhe agora oferece). Antes conviviam três
// vocabulários desencontrados: o filtro aceitava 9 variações
// (Concluida/Aprovado/Cancelado/Rejeitado/Arquivado...), o CHECK constraint do
// banco só aceitava 5 em snake_case (ativo/em_andamento/...), e os dados reais
// tinham só 'ativo' — valor que não existia em nenhum dos outros dois. A
// migração melhorias_status_real_editavel unificou tudo nestes 4 valores;
// manter as variações mortas aqui só reencheria o filtro de opções que nunca
// vão casar com nenhum dado.
var _MELH_STATUS_OPCOES = ['Backlog', 'Em andamento', 'Pausado', 'Concluído'];

var _melhFbFields = [
 { key: 'status', label: 'Status', type: 'select', options: _MELH_STATUS_OPCOES },
 { key: 'tipo',   label: 'Tipo',   type: 'select', options: function() { return _melhTipoOptions(); } },
 { key: 'responsavel', label: 'Responsável', type: 'text' },
];
_fbInit('melhorias', _melhFbFields, _melhRender);

var _melhSbFields = [
 { key: 'nome',   label: 'Nome',        type: 'text' },
 { key: 'status', label: 'Status',      type: 'text' },
 { key: 'tipo',   label: 'Tipo',        type: 'text' },
 { key: 'criado', label: 'Criado em',   type: 'date' },
];
_sbInit('melhorias', _melhSbFields, _melhRender);

function _melhTipoOptions() {
 var tipos = {};
 _melhData.forEach(function(m) { var t = _melhNormalize(m).tipo; if (t) tipos[t] = true; });
 return Object.keys(tipos);
}

// Mesmas 4 cores dos 4 KPIs no topo da página (ver #melh-kpi-grid em
// index.html) — status e indicador nunca saem de sincronia.
var _melhStatusColor = {
 'Backlog':      'var(--muted)',
 'Em andamento': 'var(--navy)',
 'Pausado':      'var(--yellow)',
 'Concluído':    'var(--green)',
};

// Rótulos de campo — servem à mensagem de conflito (concurrency.js) e ao
// Histórico (historico.js). Rótulo null = campo técnico, fora do histórico.
var _MELHORIA_CAMPO_LABEL = {
 status: 'Status', nome: 'Nome', area: 'Área', descricao: 'Descrição',
 projeto_id: null,
};
if (typeof _ccRegistrarLabels === 'function') _ccRegistrarLabels('melhorias', _MELHORIA_CAMPO_LABEL);

async function _pageLoadMelhorias() {
 var list   = document.getElementById('melh-list');
 var label  = document.getElementById('melh-count-label');
 if (list)  list.innerHTML = '<div class="melh-empty">Carregando...</div>';
 if (label) label.textContent = 'carregando...';

 // Sem DB: exibe estado vazio com aviso
 if (!_dbOk) {
  _melhData = [];
  _melhRender();
  if (label) label.textContent = 'sem conexão com banco';
  return;
 }

 try {
  // `status` e `descricao` EXISTEM na tabela mas não estavam sendo trazidas:
  // por isso o badge de status e o resumo do card ficavam sempre vazios, e o
  // filtro por Status nunca casava nada (comparava sempre contra undefined).
  //
  // Paginação em vez de .limit(100): são 13 iniciativas hoje, mas um teto fixo
  // de 100 esconderia o resto silenciosamente quando a tabela crescer.
  //
  // O vocabulário de status foi reconciliado (migração
  // melhorias_status_real_editavel): as 13 linhas que tinham 'ativo' — valor
  // que não existia nem no mapa de cores, nem nos 4 KPIs, nem no filtro —
  // passaram a "Em andamento", e o Status virou um campo editável de verdade
  // no painel de detalhe. Ver _spMelhoriaById mais abaixo.
  var linhas = []; var from = 0; var mais = true;
  while (mais) {
   var res = await _sb.from('melhorias')
    .select('id, airtable_id, nome, area, status, descricao, created_at, updated_at')
    .order('created_at', { ascending: false })
    .range(from, from + 999);
   if (res.error) { console.error('[Melhorias] erro ao carregar:', res.error); break; }
   linhas = linhas.concat(res.data || []);
   mais = (res.data || []).length === 1000; from += 1000;
  }
  _melhData = linhas;
 } catch(e) {
  console.error('[Melhorias] erro ao carregar:', e);
  _melhData = [];
 }

 // Badge do menu lateral: ver _navBadgesLoadInitial() (RPC de contagem no
 // boot, cobre as 6 tabelas de uma vez) — antes só essa aba tinha contagem
 // própria correta; agora é padronizado.

 // Atualiza contador no dash também
 var dashCount = document.getElementById('dash-melhoria-count');
 if (dashCount) dashCount.textContent = String(_melhData.length);

 // Reseta filtro/ordenação e renderiza
 _fbClearAll('melhorias');
 _sbClearAll('melhorias');

 // Tempo real POR LINHA (_melhInitRealtime). O _rtWatch que estava aqui
 // chamava _pageLoadMelhorias inteiro a cada alteração de qualquer iniciativa
 // — e _pageLoadMelhorias termina com _fbClearAll/_sbClearAll, ou seja, a
 // edição de status de outro usuário limpava o filtro e a ordenação de quem
 // estivesse olhando a tela, além de jogar o scroll pro topo.
 _melhInitRealtime();
}

function _melhRender() {
 var list  = document.getElementById('melh-list');
 var label = document.getElementById('melh-count-label');
 if (!list) return;

 var buscaNorm = _ssNormalize(((document.getElementById('melh-search') || {}).value || '').trim());
 var normalized = _melhData.map(_melhNormalize);
 var data = normalized.filter(function(n) {
  var ok = _fbEvaluate(n, 'melhorias');
  if (ok && buscaNorm) ok = _ssMatch(_ssNormalize(n.nome + ' ' + n.tipo + ' ' + n.responsavel), buscaNorm);
  return ok;
 });
 data.sort(function(a, b) { return _sbCompare(a, b, 'melhorias'); });
 data = data.map(function(n) { return n._raw; });

 var fbBadge = document.getElementById('fb-badge-melhorias');
 if (fbBadge) {
  var activeConds = _fbInstances.melhorias.state.conditions.filter(_fbConditionIsUsable).length;
  fbBadge.textContent = activeConds; fbBadge.style.display = activeConds ? '' : 'none';
 }

 if (label) label.textContent = data.length + ' iniciativa' + (data.length !== 1 ? 's' : '');

 _melhUpdateKpis();

 if (!data.length) {
  list.innerHTML = '<div class="melh-empty">Nenhuma iniciativa encontrada.</div>';
  return;
 }

 list.innerHTML = data.map(_melhCardHTML).join('');
}

// KPIs do topo — extraído de _melhRender pra que um patch incremental (tempo
// real ou save próprio) consiga corrigir os contadores sem redesenhar a grade
// inteira. Conta sobre _melhData (todos os registros), não sobre a lista
// filtrada: os 4 indicadores sempre falaram do total, não do recorte na tela.
function _melhUpdateKpis() {
 var counts = { 'Backlog': 0, 'Em andamento': 0, 'Pausado': 0, 'Concluído': 0 };
 _melhData.forEach(function(m) {
  var s = m.status || m.etapa || '';
  if (counts[s] !== undefined) counts[s]++;
 });
 var kpiMap = { 'Backlog': 'melh-kpi-backlog', 'Em andamento': 'melh-kpi-andamento', 'Pausado': 'melh-kpi-pausado', 'Concluído': 'melh-kpi-concluido' };
 Object.keys(kpiMap).forEach(function(k) {
  var el = document.getElementById(kpiMap[k]);
  if (el) el.textContent = counts[k];
 });
}

function _melhEsc(s) {
 return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Uma iniciativa → um card. Extraído do corpo de _melhRender pra que o tempo
// real consiga redesenhar SÓ o card alterado (mesmo padrão de _instRowHTML/
// _obraRowHTML), em vez de reconstruir a grade toda e derrubar o scroll de
// quem está olhando. `data-id` é o que permite achar o card depois.
function _melhCardHTML(m) {
 var nome   = m.nome || m.titulo || 'Sem título';
 var status = m.status || m.etapa || '';
 var tipo   = m.tipo || m.categoria || m.tipo_melhoria || m.area || '';
 var cor    = _melhStatusColor[status] || 'var(--muted)';
 var desc   = m.descricao ? '<div style="font-size:11px;color:var(--muted);line-height:1.5;margin-top:2px">' + _melhEsc(m.descricao.substring(0,100)) + (m.descricao.length > 100 ? '…' : '') + '</div>' : '';
 var badgeS = status ? '<span class="inic-badge" style="color:' + cor + ';border-color:' + cor + '40">' + _melhEsc(status) + '</span>' : '';
 var badgeT = tipo   ? '<span class="inic-badge">' + _melhEsc(tipo) + '</span>' : '';
 var resp   = m.responsavel ? '<span class="melh-card-resp">' + _melhEsc(m.responsavel) + '</span>' : '';
 var dt     = m.created_at ? '<span class="melh-card-date">' + new Date(m.created_at).toLocaleDateString('pt-BR') + '</span>' : '';
 // Card clicável abrindo o painel de detalhe — mesmo caminho das <tr> dos
 // outros módulos (_spOpen lê row.dataset.id e delega pra _spRender). Antes
 // esta tela era só leitura: não havia jeito nenhum de abrir uma iniciativa.
 return '<div class="melh-card" data-id="' + _melhEsc(m.id) + '" onclick="_spOpen(\'melhorias\', this)">'
  + '<div class="melh-card-title">' + _melhEsc(nome) + '</div>'
  + desc
  + '<div class="melh-card-meta">' + badgeS + badgeT + '</div>'
  + '<div class="melh-card-footer">' + resp + dt + '</div>'
  + '</div>';
}

// ═══════════════════════════════════════════════════════════════════════════
// PAINEL DE DETALHE — mesmo padrão .spt-bar/.spt-panel de Obras/Projetos/
// Entregas/Empresas/Instalações/Fornecedores/Tarefas.
// ═══════════════════════════════════════════════════════════════════════════
// Esta tela era 100% só leitura: os cards eram <div> sem clique e não existia
// nenhum painel. O Status agora é um campo de verdade, editável aqui — e é o
// ÚNICO campo editável: nome e área vêm do sync do Airtable (editar aqui seria
// desfeito no próximo sync), e descrição/vínculos são exibidos como estão.
var _melhAtiva = null; // iniciativa atualmente aberta no painel

// Entrada pelo dispatcher _spRender (side-panel.js). `tds` chega vazio porque
// aqui a origem do clique é um <div class="melh-card">, não uma <tr> com
// células — por isso a busca é sempre por id, nunca por texto de célula (mesma
// escolha de _spInstalacoes, pelo mesmo motivo).
function _spMelhorias(row, tds) {
 _spMelhoriaById(row.dataset.id);
}

async function _spMelhoriaById(id) {
 if (!id) return;
 _spSet('Iniciativa', 'Carregando...', '<div style="padding:40px;text-align:center;color:var(--muted)">Buscando dados...</div>', '');
 document.getElementById('sp-overlay').classList.add('sp-open');
 document.getElementById('sp-drawer').classList.add('sp-open');
 if (typeof _spTrackDirectOpen === 'function') _spTrackDirectOpen('melhorias', id);
 if (!_sb) return;
 // atividades_melhorias é a junção real Tarefa↔Melhoria (a mesma que
 // _syncAtividadeVinculos alimenta a partir do drawer de Atividade); projeto_id
 // é FK direta pra projetos.
 var res = await _sb.from('melhorias')
  .select('*, projeto:projeto_id(id,nome), atividades_melhorias(atividade:atividade_id(id,titulo,status))')
  .eq('id', id).single();
 if (res.error || !res.data) {
  console.error('[Melhorias] erro ao abrir iniciativa ' + id, res.error);
  _spSet('Iniciativa', 'Erro', '<div style="color:var(--red);padding:20px">Iniciativa não encontrada.</div>',
   '<button class="btn btn-ghost" onclick="closePanel()">Fechar</button>');
  return;
 }
 _spMelhoriaRender(res.data);
}

function _spMelhoriaRender(m) {
 _melhAtiva = m;
 var statusAtual = m.status || '';
 var opts = _MELH_STATUS_OPCOES.map(function(o) {
  return '<option value="' + _melhEsc(o) + '"' + (o === statusAtual ? ' selected' : '') + '>' + _melhEsc(o) + '</option>';
 }).join('');
 // "—" só aparece se o registro estiver sem status (legado). Não é uma opção
 // que o usuário possa escolher de propósito: o CHECK do banco aceita NULL,
 // mas o vocabulário de trabalho são as 4 opções.
 var optVazio = statusAtual ? '' : '<option value="" selected>—</option>';

 var tarefas = (m.atividades_melhorias || []).map(function(x) { return x.atividade; }).filter(Boolean);

 var html = ''
  + '<input type="hidden" id="sp-melh-id" value="' + _melhEsc(m.id) + '">'
  + '<div class="spt-bar">'
  + '<button class="spt-btn active" data-target="spt-melh-geral" onclick="_sptSwitch(\'melh-geral\',this)">Visão Geral</button>'
  + '<button class="spt-btn" data-target="spt-melh-historico" onclick="_sptSwitch(\'melh-historico\',this)">Histórico</button>'
  + '</div>'
  + '<div class="spt-panel" id="spt-melh-geral">'
  + '<div class="sp-field"><div class="sp-label">Status</div>'
  + '<select class="sp-inp" id="sp-melh-status" onchange="_melhSalvarStatus()">' + optVazio + opts + '</select></div>'
  + '<div class="sp-g2">'
  + '<div class="sp-field"><div class="sp-label">Nome</div><input class="sp-inp" value="' + _melhEsc(m.nome || '') + '" readonly title="Sincronizado do Airtable"></div>'
  + '<div class="sp-field"><div class="sp-label">Área</div><input class="sp-inp" value="' + _melhEsc(m.area || '—') + '" readonly title="Sincronizado do Airtable"></div>'
  + '</div>'
  + '<div class="sp-field"><div class="sp-label">Descrição</div>'
  + '<textarea class="sp-inp" rows="3" readonly>' + _melhEsc(m.descricao || '') + '</textarea></div>'
  + '<div class="sp-stitle">Projeto vinculado</div>'
  + '<div class="sp-rel-chips-wrap">'
  + (m.projeto ? _spRelChipHTML('projetos', m.projeto.id, m.projeto.nome || '—') : '<div class="sp-empty">Nenhum projeto vinculado.</div>')
  + '</div>'
  + '<div class="sp-stitle">Tarefas vinculadas</div>'
  + '<div class="sp-rel-chips-wrap">'
  // Sem chip clicável aqui de propósito: Atividade não é uma das seções que
  // _spRender sabe abrir (ver side-panel.js), então um chip navegável só
  // levaria a um painel vazio. Quando existir painel de Atividade, isto vira
  // _spRelChipHTML('atividades', ...) como os outros.
  + (tarefas.length
     ? tarefas.map(function(t) {
        return '<div class="sp-rel-chip" style="cursor:default">'
         + '<span class="sp-rel-chip-dot" style="background:#8B8B94"></span>'
         + '<span class="sp-rel-chip-label">' + _melhEsc(t.titulo || '—') + '</span>'
         + (t.status ? '<span class="sp-rel-chip-sub">' + _melhEsc(t.status) + '</span>' : '')
         + '</div>';
       }).join('')
     : '<div class="sp-empty">Nenhuma tarefa vinculada.</div>')
  + '</div>'
  + '</div>'
  + '<div class="spt-panel" id="spt-melh-historico">'
  + '<div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:10px">Histórico de alterações</div>'
  + (typeof _histPanelHTML === 'function' ? _histPanelHTML('sp-melh-historico') : '')
  + '</div>';

 _spSet('Iniciativa', m.nome || 'Sem título', html,
  '<button class="btn btn-ghost" onclick="closePanel()">Fechar</button>');

 // Baseline da trava otimista: o registro como veio do banco na abertura do
 // painel (ver concurrency.js). É contra ele que _ccSave decide o que mandar e
 // se alguém gravou primeiro. Os embeds (projeto/atividades_melhorias) não são
 // colunas da tabela e ficariam no diff como "campo alterado" — fora daqui.
 if (typeof _ccSetBaseline === 'function') {
  var base = Object.assign({}, m);
  delete base.projeto; delete base.atividades_melhorias;
  _ccSetBaseline('melhorias', m.id, base);
 }
 if (typeof _rtLimparAvisoExterno === 'function') _rtLimparAvisoExterno();
 if (typeof _sptInitScrollSpy === 'function') _sptInitScrollSpy();
 if (typeof _histCarregar === 'function') _histCarregar('sp-melh-historico', 'melhorias', m.id);
}

// Único save do painel. Passa por _ccSave (concurrency.js): se outro usuário
// mudou o Status entre a abertura deste painel e o clique, o UPDATE casa ZERO
// linhas (trava otimista por updated_at, mantida por trg_melhorias_updated_at)
// e a alteração NÃO é gravada por cima — o usuário é avisado em português e o
// painel recarrega com o valor real do banco. A gravação no audit_log é
// automática: trg_melhorias_audit já existia nesta tabela desde a Fase 2.
async function _melhSalvarStatus() {
 var id = document.getElementById('sp-melh-id') ? document.getElementById('sp-melh-id').value : null;
 var el = document.getElementById('sp-melh-status');
 if (!id || !el || !_sb) return;
 var r = await _ccSaveComFeedback('melhorias', id, { status: el.value || null }, {
  onRecarregar: function(atual) {
   // Conflito ou merge automático: relê do banco e redesenha o painel (aqui o
   // registro precisa dos embeds de projeto/tarefas, então recarrega pelo
   // caminho normal em vez de aplicar a linha crua).
   if (String((_melhAtiva || {}).id) === String(id)) _spMelhoriaById(id);
   // O card na lista também precisa do valor que ficou valendo. Sem isto o
   // painel mostrava o status certo (o do outro usuário) e o card atrás dele
   // continuava com o valor velho até o evento de tempo real chegar — e se ele
   // não chegasse (aba sem canal, rede oscilando), a tela ficava mentindo.
   if (atual) _melhPatchNaLista(atual, id);
  },
 });
 if (!r || r.conflito || r.erro || r.excluido || r.semMudanca) return;
 if (_melhAtiva && String(_melhAtiva.id) === String(id)) Object.assign(_melhAtiva, r.row || {});
 _melhPatchNaLista(r.row, id);
}

// Um registro passa no filtro/busca atuais da tela? Mesma avaliação que
// _melhRender faz — extraída pra que o patch incremental saiba se o card
// alterado ainda pertence à lista visível.
function _melhPassaFiltro(m) {
 var n = _melhNormalize(m);
 if (!_fbEvaluate(n, 'melhorias')) return false;
 var buscaNorm = _ssNormalize(((document.getElementById('melh-search') || {}).value || '').trim());
 if (buscaNorm) return _ssMatch(_ssNormalize(n.nome + ' ' + n.tipo + ' ' + n.responsavel), buscaNorm);
 return true;
}

// Aplica no array em memória a linha alterada (save próprio ou tempo real) e
// redesenha SÓ o card dela, preservando filtro, ordenação e scroll de quem
// está olhando. Só cai no _melhRender() completo quando a alteração faz o
// registro entrar ou sair do recorte filtrado — aí a grade muda de tamanho e
// não há como remendar um card só.
function _melhPatchNaLista(patch, idExplicito) {
 if (!patch) return;
 var id = idExplicito || patch.id;
 if (!id) return;
 var idx = (_melhData || []).findIndex(function(x) { return String(x.id) === String(id); });
 if (idx === -1) return;
 Object.keys(patch).forEach(function(k) {
  if (k === 'projeto' || k === 'atividades_melhorias') return;
  _melhData[idx][k] = patch[k];
 });
 _melhUpdateKpis();
 var card = document.querySelector('#melh-list .melh-card[data-id="' + id + '"]');
 var passa = _melhPassaFiltro(_melhData[idx]);
 if (card && passa) { card.outerHTML = _melhCardHTML(_melhData[idx]); return; }
 if (!card && !passa) return;   // continua fora da lista: nada a fazer na tela
 _melhRender();
}

// Tempo real POR LINHA. A chave 'melhorias' faz _rtWatchRows SUBSTITUIR o
// handler anterior em vez de acumular um novo a cada visita à aba.
function _melhInitRealtime() {
 if (typeof _rtWatchRows !== 'function') return;
 _rtWatchRows('melhorias', 'melhorias', {
  onUpdate: function(nova) {
   if (!nova || !nova.id) return;
   _melhPatchNaLista(nova);
   if (String((_melhAtiva || {}).id) === String(nova.id)
    && document.getElementById('sp-drawer')
    && document.getElementById('sp-drawer').classList.contains('sp-open')
    && typeof _rtAvisoAlteracaoExterna === 'function') {
    // melhorias não tem coluna de "quem alterou" (nem criado_por/atualizado_por
    // — as Fases 1/2 não as adicionaram nesta tabela), então a faixa sai sem
    // nome, igual à de Instalações, que está na mesma situação. O painel NÃO é
    // redesenhado sozinho: só aparece a faixa com o botão "Atualizar", pra não
    // trocar o HTML embaixo de quem está no meio de uma edição.
    _rtAvisoAlteracaoExterna(null, "_spMelhoriaById('" + nova.id + "')");
    if (typeof _ccSetBaseline === 'function') _ccSetBaseline('melhorias', nova.id, nova);
   }
  },
  // Iniciativa nova/excluída muda o tamanho da lista e o contador do
  // cabeçalho — eventos raros, recarrega a lista por inteiro só neles.
  onInsert: function() { if (typeof _pageLoadMelhorias === 'function') _pageLoadMelhorias(); },
  onDelete: function(_nova, antiga) {
   var id = antiga && antiga.id;
   if (!id) return;
   var i = (_melhData || []).findIndex(function(x) { return String(x.id) === String(id); });
   if (i !== -1) _melhData.splice(i, 1);
   _melhRender();
   if (String((_melhAtiva || {}).id) === String(id)) {
    _showToast('A iniciativa que você tinha aberta foi excluída por outro usuário.', 'erro');
    closePanel();
   }
  },
 });
}

