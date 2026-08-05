// ═══════════════════════════════════════════════════════════════════════════════
// ENTREGAS — tabela/calendário de entregas de obra, renderer do painel lateral,
// carga da lista. "Salvar" no painel lateral ainda não foi implementado (não é
// código morto, é feature ausente no sistema original).
// ═══════════════════════════════════════════════════════════════════════════════
function openNovaEntrega() { alert('Modal "Nova Entrega" será implementado em breve.'); }

// ── ENTREGAS ──────────────────────────────────────────────────────
// Dados de entregas para o calendário
var _entEvents = [
  { label:'Vega — Alphaville Bloco A',  type:'prod', date:'2026-05-28' },
  { label:'Prefeitura — Escola Jundiaí',type:'prod', date:'2026-06-02' },
  { label:'Vega — Alphaville Bloco A',  type:'desp', date:'2026-06-05' },
  { label:'Grupo Delta — Galpão SP',    type:'prod', date:'2026-05-15' },
  { label:'Grupo Delta — Galpão SP',    type:'desp', date:'2026-05-25' },
  { label:'Grupo Delta — Galpão SP',    type:'entg', date:'2026-05-30' },
  { label:'Log Brasil — Hub Campinas',  type:'desp', date:'2026-05-22' },
  { label:'Log Brasil — Hub Campinas',  type:'entg', date:'2026-05-27' },
  { label:'Solar Park — Agrisolar MG',  type:'entg', date:'2026-05-23' },
  { label:'Prefeitura — Escola Jundiaí',type:'desp', date:'2026-06-12' },
  { label:'Prefeitura — Escola Jundiaí',type:'entg', date:'2026-06-16' },
  { label:'Vega — Alphaville Bloco A',  type:'entg', date:'2026-06-10' },
];
var _entCalYear  = 2026;
var _entCalMonth = 4; // 0-indexed → Maio = 4

var _ptMonths = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                 'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
var _ptDows   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

function setEntView(v) {
  document.getElementById('ent-view-tabela').style.display    = v === 'tabela'    ? '' : 'none';
  document.getElementById('ent-view-calendario').style.display = v === 'calendario' ? '' : 'none';
  document.getElementById('ent-btn-tabela').className    = 'ent-view-btn' + (v === 'tabela'    ? ' active' : '');
  document.getElementById('ent-btn-calendario').className = 'ent-view-btn' + (v === 'calendario' ? ' active' : '');
  if (v === 'calendario') renderEntCal();
}

// Filtro/Ordenação — mesmos componentes reutilizáveis do Gestor de Tarefas/
// Obras/Empresas/Instalações (filtro-builder/sort-builder/smart-search),
// substituindo os 4 chips fixos de status por um Filtro de condições de
// verdade. Só a vista Tabela é afetada — o Calendário usa dados mock
// independentes (_entEvents), não a tabela real.
var _entFbFields = [
 { key: 'status',     label: 'Status',      type: 'select', options: ['aguardando','producao','transporte','entregue'] },
 { key: 'obra',       label: 'Obra',        type: 'text' },
 { key: 'empresa',    label: 'Empresa',     type: 'text' },
 { key: 'transporte', label: 'Transporte',  type: 'text' },
];
_fbInit('entregas', _entFbFields, _entApplyFilters);

var _entSbFields = [
 { key: 'obra',       label: 'Obra',       type: 'text' },
 { key: 'empresa',    label: 'Empresa',    type: 'text' },
 { key: 'dataFat',    label: 'Faturamento', type: 'date' },
 { key: 'quantidade', label: 'Peso (kg)',  type: 'number', getValue: function(ds) { return parseFloat(ds.quantidade) || 0; } },
];
_sbInit('entregas', _entSbFields, _entApplyFilters);

function _entApplyFilters() {
 var buscaNorm = _ssNormalize(((document.getElementById('ent-search') || {}).value || '').trim());
 var activeConds = _fbInstances.entregas.state.conditions.filter(_fbConditionIsUsable).length;
 var rows = Array.prototype.slice.call(document.querySelectorAll('#ent-tbody tr[data-id]'));
 var visivel = 0;
 rows.forEach(function(tr) {
  var ok = _fbEvaluate(tr.dataset, 'entregas');
  if (ok && buscaNorm) ok = _ssMatch(_ssNormalize(tr.textContent), buscaNorm);
  tr.style.display = ok ? '' : 'none';
  if (ok) visivel++;
 });
 if (rows.length) {
  rows.sort(function(a, b) { return _sbCompare(a.dataset, b.dataset, 'entregas'); });
  var tbody = rows[0].parentElement;
  rows.forEach(function(tr) { tbody.appendChild(tr); });
 }
 var fbBadge = document.getElementById('fb-badge-entregas');
 if (fbBadge) { fbBadge.textContent = activeConds; fbBadge.style.display = activeConds ? '' : 'none'; }
 var countEl = document.getElementById('ent-filter-count');
 if (countEl) {
  if (activeConds || buscaNorm) { countEl.textContent = visivel + (visivel === 1 ? ' resultado' : ' resultados'); countEl.style.display = 'inline'; }
  else { countEl.style.display = 'none'; }
 }
}

function entCalNav(dir) {
  _entCalMonth += dir;
  if (_entCalMonth > 11) { _entCalMonth = 0; _entCalYear++; }
  if (_entCalMonth < 0)  { _entCalMonth = 11; _entCalYear--; }
  renderEntCal();
}

function renderEntCal() {
  var label = document.getElementById('ent-cal-label');
  if (label) label.textContent = _ptMonths[_entCalMonth] + ' ' + _entCalYear;

  var grid = document.getElementById('ent-cal-grid');
  if (!grid) return;

  var html = '';
  // Day-of-week headers
  _ptDows.forEach(function(d) {
    html += '<div class="ent-cal-dow">' + d + '</div>';
  });

  var firstDay = new Date(_entCalYear, _entCalMonth, 1).getDay(); // 0=Sun
  var daysInMonth = new Date(_entCalYear, _entCalMonth + 1, 0).getDate();
  var prevDays = new Date(_entCalYear, _entCalMonth, 0).getDate();

  var today = new Date();
  var todayStr = today.getFullYear() + '-'
    + String(today.getMonth()+1).padStart(2,'0') + '-'
    + String(today.getDate()).padStart(2,'0');

  // Prev month filler
  for (var i = firstDay - 1; i >= 0; i--) {
    html += '<div class="ent-cal-day other-month"><div class="ent-cal-daynum">' + (prevDays - i) + '</div></div>';
  }

  // Current month days
  for (var d = 1; d <= daysInMonth; d++) {
    var dateStr = _entCalYear + '-'
      + String(_entCalMonth + 1).padStart(2,'0') + '-'
      + String(d).padStart(2,'0');
    var isToday = dateStr === todayStr;
    var dayEvents = _entEvents.filter(function(e) { return e.date === dateStr; });

    html += '<div class="ent-cal-day' + (isToday ? ' today' : '') + '">';
    html += '<div class="ent-cal-daynum">' + d + '</div>';
    dayEvents.forEach(function(e) {
      var shortLabel = e.label.length > 20 ? e.label.substring(0, 20) + '…' : e.label;
      html += '<div class="ent-cal-event ' + e.type + '" title="' + e.label + '">' + shortLabel + '</div>';
    });
    html += '</div>';
  }

  // Next month filler
  var total = firstDay + daysInMonth;
  var remaining = (7 - (total % 7)) % 7;
  for (var n = 1; n <= remaining; n++) {
    html += '<div class="ent-cal-day other-month"><div class="ent-cal-daynum">' + n + '</div></div>';
  }

  grid.className = 'ent-cal-grid';
  grid.innerHTML = html;
}

var _entregasArr = [];

function _spEntregas(row, tds) {
 _spEntregaById(row.dataset.id);
}

// ── Renderer: Entrega por id ────────────────────────────────────────────────
// Extraído do antigo _spEntregas(row, tds), que lia tds[N].innerText — mesmo
// padrão já aplicado a _spObras/_spContatos/_spProjetos. Busca no cache
// _entregasArr (preenchido por _dbLoadEntregas, que já traz obra:obra_id
// aninhado); fallback de busca direta por id se o cache ainda não tiver sido
// carregado (chip clicado antes de visitar a página Entregas).
function _spEntregaById(id) {
 if (!id) return;
 var e = (_entregasArr || []).find(function(x){ return String(x.id) === String(id); });
 if (e) { _spEntregaRender(e); return; }

 _spSet('Entrega', 'Carregando...', '<div style="padding:40px;text-align:center;color:var(--muted)">Buscando dados...</div>', '');
 document.getElementById('sp-overlay').classList.add('sp-open');
 document.getElementById('sp-drawer').classList.add('sp-open');
 if (!_sb) return;
 _sb.from('entregas').select('*, obra:obra_id(nome, empresas_obras(empresa:empresa_id(nome)))').eq('id', id).single().then(function(res) {
  if (res.error || !res.data) {
   _spSet('Entrega', 'Erro', '<div style="color:var(--red);padding:20px">Entrega não encontrada.</div>', '');
   return;
  }
  _spEntregaRender(res.data);
 });
}

function _spEntregaRender(e) {
 var stMap = {
  'Aguardando produção':'aguardando','Em produção':'producao',
  'Transporte':'transporte','Entregue':'entregue'
 };
 var st       = stMap[e.etapa] || 'aguardando';
 var obraNome = (e.obra && e.obra.nome) || '—';
 var obraId   = e.obra_id || '';
 var num      = e.numero != null ? String(e.numero).padStart(3, '0') : '';
 var transp   = e.transporte || '';
 var qtd      = e.quantidade != null ? e.quantidade : '';
 var dtPrev   = e.data_faturamento || '';

 _spSet('Entrega', obraNome !== '—' ? obraNome : ('#' + num), `
  <div class="sp-field"><div class="sp-label">Obra / Cliente</div>
   <input class="sp-inp" value="${(obraNome).replace(/"/g,'&quot;')}" readonly>
  </div>
  <div class="sp-g2">
   <div class="sp-field"><div class="sp-label">Pedido</div>
    <input class="sp-inp" value="${num}" readonly style="opacity:.6">
   </div>
   <div class="sp-field"><div class="sp-label">Faturamento</div>
    <input class="sp-inp" type="text" value="${dtPrev}">
   </div>
  </div>
  <div class="sp-g2">
   <div class="sp-field"><div class="sp-label">Transporte</div>
    <input class="sp-inp" value="${transp}">
   </div>
   <div class="sp-field"><div class="sp-label">Qtd (m²)</div>
    <input class="sp-inp" type="number" value="${qtd}">
   </div>
  </div>
  <div class="sp-field"><div class="sp-label">Status</div>
   <select class="sp-inp">
    <option ${st==='aguardando'?'selected':''}>aguardando</option>
    <option ${st==='producao'?'selected':''}>producao</option>
    <option ${st==='transporte'?'selected':''}>transporte</option>
    <option ${st==='entregue'?'selected':''}>entregue</option>
   </select>
  </div>
  <div style="margin-top:20px;border-top:1px solid var(--border);padding-top:16px">
   <div style="font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;margin-bottom:10px">Obra vinculada</div>
   <div class="sp-rel-chips-wrap">${obraId ? _spRelChipHTML('obras', obraId, obraNome) : '<div class="sp-empty">Nenhuma obra vinculada a esta entrega.</div>'}</div>
  </div>`,
  '<button class="btn btn-ghost" onclick="closePanel()">Fechar</button>');
}

// ── Load Entregas ─────────────────────────────────────────────────────────────
async function _dbLoadEntregas() {
 // Paginado em blocos de 1000 — sem isso, o Supabase corta silenciosamente
 // em 1000 linhas (achado real: com 1495 entregas, a tela e o contador do
 // menu mostravam só 1000, escondendo 495 entregas de verdade).
 var data = [];
 var from = 0;
 var pageSize = 1000;
 var error = null;
 while (true) {
  var res = await _sb
   .from('entregas')
   .select('*, obra:obra_id(nome, empresas_obras(empresa:empresa_id(nome)))')
   .order('created_at', { ascending: false })
   .range(from, from + pageSize - 1);
  if (res.error) { error = res.error; break; }
  data = data.concat(res.data || []);
  if (!res.data || res.data.length < pageSize) break;
  from += pageSize;
 }
 // Cache global por id — usado por _spEntregaById para abrir o painel de
 // Entrega a partir de um chip clicado em OUTRA entidade (ex.: Obra), sem
 // precisar reler tds[N].innerText da tabela.
 _entregasArr = data || [];
 // Badge do menu lateral: ver _navBadgesLoadInitial() (RPC de contagem).
 if (error || !data?.length) return;
 const tbody = document.getElementById('ent-tbody');
 if (!tbody) return;
 const stMap = {
  'Aguardando produção':'aguardando','Em produção':'producao',
  'Transporte':'transporte','Entregue':'entregue'
 };
 tbody.innerHTML = data.map(e => {
  const st = stMap[e.etapa] || 'aguardando';
  const stCor = {'aguardando':'#B8790A','producao':'#2E5FD9','transporte':'#8b5cf6','entregue':'#1F8A4C'}[st];
  const obraNome = e.obra?.nome || '—';
  const empNome  = e.obra?.empresas_obras?.[0]?.empresa?.nome || '—';
  return `<tr onclick="if(!event.target.closest('button,a,input,select'))_spOpen('entregas',this)"
   data-id="${e.id}" data-status="${st}" data-obra="${(obraNome!=='—'?obraNome:'').replace(/"/g,'&quot;')}"
   data-empresa="${(empNome!=='—'?empNome:'').replace(/"/g,'&quot;')}" data-transporte="${e.transporte||''}"
   data-data-fat="${e.data_faturamento||''}" data-quantidade="${e.quantidade||0}">
   <td><div style="font-weight:500">${empNome} — ${obraNome}</div><div style="font-size:11px;color:var(--muted)">#${String(e.numero).padStart(3,'0')}</div></td>
   <td><span class="badge bg">${(e.obra?.tipo_orcamento||['—'])[0]||'—'}</span></td>
   <td><span class="ent-date">${e.data_faturamento||'—'}</span></td>
   <td><span class="ent-date">—</span></td>
   <td><span class="ent-date">—</span></td>
   <td style="font-size:12px;color:var(--muted)">${e.transporte||'—'}</td>
   <td style="text-align:right;font-weight:600">${e.quantidade||'—'}</td>
   <td><div class="ent-status"><span class="ent-status-dot" style="background:${stCor}"></span>${e.etapa||'—'}</div></td>
   <td><button class="btn btn-ghost btn-sm">Ver →</button></td>
  </tr>`;
 }).join('');
}
