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

var _melhFbFields = [
 { key: 'status', label: 'Status', type: 'select', options: ['Backlog','Em andamento','Pausado','Concluído','Concluida','Aprovado','Cancelado','Rejeitado','Arquivado'] },
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

var _melhStatusColor = {
 'Em andamento': 'var(--navy)',
 'Concluído':    'var(--green)',
 'Concluida':    'var(--green)',
 'Aprovado':     'var(--green)',
 'Cancelado':    'var(--red)',
 'Pausado':      'var(--yellow)',
 'Backlog':      'var(--muted)'
};

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
  // ATENÇÃO (deixado como está de propósito): as 13 linhas em produção têm
  // status = 'ativo' — valor que não existe nem no mapa de cores
  // (_melhStatusColor), nem nos 4 KPIs (Backlog/Em andamento/Pausado/
  // Concluído), nem na lista de opções do filtro. Então os KPIs continuam
  // zerados mesmo com esta correção. Reconciliar esse vocabulário com o do
  // Airtable é decisão de negócio: inventar um "de-para" aqui esconderia a
  // divergência em vez de resolvê-la.
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

 // Tempo real: recarrega sozinho quando a tabela mudar (sync do Airtable
 // ou outro usuário editando) — sem precisar recarregar a página.
 if (typeof _rtWatch === 'function') _rtWatch('melhorias', _pageLoadMelhorias);
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

 // KPIs
 var counts = { 'Backlog': 0, 'Em andamento': 0, 'Pausado': 0, 'Concluído': 0 };
 _melhData.forEach(function(m) {
  var s = m.status || m.etapa || '';
  if (counts[s] !== undefined) counts[s]++;
  else if (s === 'Concluida' || s === 'Aprovado') counts['Concluído']++;
 });
 var kpiMap = { 'Backlog': 'melh-kpi-backlog', 'Em andamento': 'melh-kpi-andamento', 'Pausado': 'melh-kpi-pausado', 'Concluído': 'melh-kpi-concluido' };
 Object.keys(kpiMap).forEach(function(k) {
  var el = document.getElementById(kpiMap[k]);
  if (el) el.textContent = counts[k];
 });

 if (!data.length) {
  list.innerHTML = '<div class="melh-empty">Nenhuma iniciativa encontrada.</div>';
  return;
 }

 list.innerHTML = data.map(function(m) {
  var nome   = m.nome || m.titulo || 'Sem título';
  var status = m.status || m.etapa || '';
  var tipo   = m.tipo || m.categoria || m.tipo_melhoria || m.area || '';
  var cor    = _melhStatusColor[status] || 'var(--muted)';
  var desc   = m.descricao ? '<div style="font-size:11px;color:var(--muted);line-height:1.5;margin-top:2px">' + m.descricao.substring(0,100) + (m.descricao.length > 100 ? '…' : '') + '</div>' : '';
  var badgeS = status ? '<span class="inic-badge" style="color:' + cor + ';border-color:' + cor + '40">' + status + '</span>' : '';
  var badgeT = tipo   ? '<span class="inic-badge">' + tipo + '</span>' : '';
  var resp   = m.responsavel ? '<span class="melh-card-resp">' + m.responsavel + '</span>' : '';
  var dt     = m.created_at ? '<span class="melh-card-date">' + new Date(m.created_at).toLocaleDateString('pt-BR') + '</span>' : '';
  return '<div class="melh-card">'
   + '<div class="melh-card-title">' + nome + '</div>'
   + desc
   + '<div class="melh-card-meta">' + badgeS + badgeT + '</div>'
   + '<div class="melh-card-footer">' + resp + dt + '</div>'
   + '</div>';
 }).join('');
}

