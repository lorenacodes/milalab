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

// Chip de status e busca por texto combinam (AND) sobre as mesmas linhas —
// antes cada função sobrescrevia sozinha o style.display, então aplicar um
// filtro desfazia o outro já ativo.
var _entChipAtivo = 'all';
var _entBusca = '';

function _entAplicarFiltros() {
  var qn = _entBusca.toLowerCase().trim();
  var rows = document.querySelectorAll('#ent-tbody tr');
  rows.forEach(function(tr) {
    var st = tr.getAttribute('data-status') || '';
    var showChip = _entChipAtivo === 'all'
      || (_entChipAtivo === 'prod'   && (st === 'producao' || st === 'aguardando'))
      || (_entChipAtivo === 'transp' && st === 'transporte')
      || (_entChipAtivo === 'ent'    && st === 'entregue');
    var showBusca = !qn || tr.textContent.toLowerCase().includes(qn);
    tr.style.display = (showChip && showBusca) ? '' : 'none';
  });
}

function filterEntregas(f) {
  _entChipAtivo = f;
  ['all','prod','transp','ent'].forEach(function(k) {
    var el = document.getElementById('ent-chip-' + k);
    if (el) el.className = 'chip' + (k === f ? ' active' : '');
  });
  _entAplicarFiltros();
}

function searchEntregas(q) {
  _entBusca = q;
  _entAplicarFiltros();
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

function _spEntregas(row, tds) {
 const nome   = tds[0]?.querySelector('div')?.innerText?.trim()||tds[0]?.innerText?.trim()||'';
 const num    = tds[0]?.querySelectorAll('div')[1]?.innerText?.trim()||'';
 const tipo   = tds[1]?.innerText?.trim()||'';
 const dtPrev = tds[2]?.innerText?.trim()||'';
 const dtFab  = tds[3]?.innerText?.trim()||'';
 const dtEntr = tds[4]?.innerText?.trim()||'';
 const transp = tds[5]?.innerText?.trim()||'';
 const qtd    = tds[6]?.innerText?.trim()||'';
 const status = tds[7]?.innerText?.trim()||'';
 const st     = row.dataset.status||'';
 _spSet('Entrega', nome||num, `
  <div class="sp-field"><div class="sp-label">Obra / Cliente</div>
   <input class="sp-inp" value="${(nome).replace(/"/g,'&quot;')}">
  </div>
  <div class="sp-g2">
   <div class="sp-field"><div class="sp-label">Pedido</div>
    <input class="sp-inp" value="${num}" readonly style="opacity:.6">
   </div>
   <div class="sp-field"><div class="sp-label">Tipo</div>
    <input class="sp-inp" value="${tipo}">
   </div>
  </div>
  <div class="sp-stitle">Datas</div>
  <div class="sp-g3">
   <div class="sp-field"><div class="sp-label">Previsão</div>
    <input class="sp-inp" type="text" value="${dtPrev}">
   </div>
   <div class="sp-field"><div class="sp-label">Fabricação</div>
    <input class="sp-inp" type="text" value="${dtFab}">
   </div>
   <div class="sp-field"><div class="sp-label">Entrega</div>
    <input class="sp-inp" type="text" value="${dtEntr}">
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
  </div>`,
  '<button class="btn btn-ghost" onclick="closePanel()">Fechar</button>');
}

// ── Load Entregas ─────────────────────────────────────────────────────────────
async function _dbLoadEntregas() {
 const { data, error } = await _sb
  .from('entregas')
  .select('*, obra:obra_id(nome, empresas_obras(empresa:empresa_id(nome)))')
  .order('created_at', { ascending: false });
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
   data-id="${e.id}" data-status="${st}">
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
