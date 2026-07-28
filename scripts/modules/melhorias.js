// ═══════════════════════════════════════════════════════════════════════════════
// MELHORIAS (Iniciativas de Inovação) — lista, filtro por status/tipo.
// ═══════════════════════════════════════════════════════════════════════════════
/* ── PÁGINA MELHORIAS (INICIATIVAS DE INOVAÇÃO) ──────────────────── */
// Estado da página melhorias
var _melhData      = [];   // todos os registros carregados do Supabase
var _melhTipoFlt   = '';   // filtro de tipo/categoria ativo
var _melhStatusFlt = '';   // filtro de status ativo

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
  var res = await _sb.from('melhorias')
   .select('id, airtable_id, nome, area, created_at, updated_at')
   .order('created_at', { ascending: false })
   .limit(100);
  _melhData = res.data || [];
 } catch(e) {
  _melhData = [];
 }

 // Atualiza badge no nav
 var navBadge = document.getElementById('nav-badge-melhorias');
 if (navBadge) navBadge.textContent = _melhData.length || '0';

 // Atualiza contador no dash também
 var dashCount = document.getElementById('dash-melhoria-count');
 if (dashCount) dashCount.textContent = String(_melhData.length);

 // Reseta filtros e renderiza
 _melhStatusFlt = '';
 _melhTipoFlt   = '';
 _melhSyncChips();
 _melhBuildTipoBar();
 _melhRender();
}

function _melhRender() {
 var list  = document.getElementById('melh-list');
 var label = document.getElementById('melh-count-label');
 if (!list) return;

 var q    = (document.getElementById('melh-search') || {}).value || '';
 var data = _melhData.filter(function(m) {
  var nome   = (m.nome || m.titulo || '').toLowerCase();
  var tipo   = (m.tipo || m.categoria || m.tipo_melhoria || m.area || '').toLowerCase();
  var status = m.status || m.etapa || '';
  var resp   = (m.responsavel || '').toLowerCase();
  var matchQ = !q || nome.includes(q.toLowerCase()) || tipo.includes(q.toLowerCase()) || resp.includes(q.toLowerCase());
  var matchS = !_melhStatusFlt || status === _melhStatusFlt;
  var matchT = !_melhTipoFlt   || (m.tipo || m.categoria || m.tipo_melhoria || m.area || '') === _melhTipoFlt;
  return matchQ && matchS && matchT;
 });

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

function _melhSetStatus(val) {
 _melhStatusFlt = val;
 _melhSyncChips();
 _melhRender();
}

function _melhSyncChips() {
 document.querySelectorAll('[id^="melh-chip-"]').forEach(function(c) {
  var key = c.id.replace('melh-chip-', '');
  c.classList.toggle('active', key === _melhStatusFlt);
 });
}

function _melhApplyFilter() { _melhRender(); }

function _melhBuildTipoBar() {
 var bar = document.getElementById('melh-tipo-bar');
 if (!bar) return;
 var tipos = {};
 _melhData.forEach(function(m) {
  var t = m.tipo || m.categoria || m.tipo_melhoria || m.area || '';
  if (t) tipos[t] = (tipos[t] || 0) + 1;
 });
 var keys = Object.keys(tipos);
 if (!keys.length) { bar.style.display = 'none'; return; }
 bar.style.display = '';
 bar.innerHTML = '<span class="chip active" onclick="_melhSetTipo(\'\')">Todos os tipos</span>'
  + keys.map(function(t) {
   return '<span class="chip" onclick="_melhSetTipo(\'' + t.replace(/'/g, "\\'") + '\')">' + t + ' <small style="opacity:.6">(' + tipos[t] + ')</small></span>';
  }).join('');
}

function _melhSetTipo(val) {
 _melhTipoFlt = val;
 var bar = document.getElementById('melh-tipo-bar');
 if (bar) bar.querySelectorAll('.chip').forEach(function(c) {
  var txt = c.textContent.trim().split(' ')[0];
  c.classList.toggle('active', val === '' ? txt === 'Todos' : txt === val);
 });
 _melhRender();
}
