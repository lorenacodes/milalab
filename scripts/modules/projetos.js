// ═══════════════════════════════════════════════════════════════════════════════
// PROJETOS — modal "Novo Projeto" (cria um projeto avulso vinculado a uma obra já
// existente; para criar Obra+Projetos juntos, use o wizard Nova Obra), kanban por
// etapa, renderer do painel lateral, filtro de tipo, cache/loader de projetos.
// ═══════════════════════════════════════════════════════════════════════════════
async function _npPopularObras() {
 var sel = document.getElementById('np-obra');
 if (!sel) return;
 var lista = Object.keys(_obraIdMap || {}).map(function(id){ return { id: id, nome: _obraIdMap[id].nome }; });
 if (!lista.length && _sb) {
  var res = await _sb.from('obras').select('id, nome').order('nome');
  if (!res.error && res.data) lista = res.data;
 }
 lista.sort(function(a,b){ return (a.nome||'').localeCompare(b.nome||''); });
 sel.innerHTML = '<option value="">Selecione a obra...</option>'
  + lista.map(function(o){ return '<option value="' + o.id + '">' + (o.nome||'(sem nome)').replace(/</g,'&lt;') + '</option>'; }).join('');
}

function openNovoProjeto() {
 // Resetar campos
 ['np-tipo','np-produto','np-etapa'].forEach(id => {
 const el = document.getElementById(id); if(el) el.selectedIndex = 0;
 });
 ['np-qtd','np-val-uni','np-peso-uni','np-m2arq','np-m2estr','np-desc','np-responsavel'].forEach(id => {
 const el = document.getElementById(id); if(el) el.value = '';
 });
 _npPopularObras();
 calcProjetoTotais();
 document.getElementById('modal-novo-projeto').classList.add('open');
 document.body.style.overflow = 'hidden';
}

function closeNovoProjeto() {
 document.getElementById('modal-novo-projeto').classList.remove('open');
 document.body.style.overflow = '';
}

function calcProjetoTotais() {
 const qtd = parseFloat(document.getElementById('np-qtd')?.value) || 0;
 const vUnit = parseFloat(document.getElementById('np-val-uni')?.value) || 0;
 const pUnit = parseFloat(document.getElementById('np-peso-uni')?.value) || 0;
 const m2arq = parseFloat(document.getElementById('np-m2arq')?.value) || 0;

 const vTotal = qtd * vUnit;
 const pTotal = qtd * pUnit;
 const rpm2 = (m2arq > 0 && vTotal > 0) ? vTotal / m2arq : null;

 // Valor total — destaque visual
 const vtEl = document.getElementById('np-val-total');
 if (vtEl) {
 vtEl.textContent = vTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
 vtEl.style.color = vTotal > 0 ? 'var(--green)' : 'var(--muted)';
 vtEl.style.background = vTotal > 0 ? 'var(--green-dim)' : 'var(--surface2)';
 vtEl.style.borderColor = vTotal > 0 ? 'var(--green)' : 'var(--border)';
 }

 // Peso total
 const ptEl = document.getElementById('np-peso-total');
 if (ptEl) ptEl.textContent = pTotal > 0
 ? pTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + ' kg'
 : '—';

 // R$ por m²
 const r2El = document.getElementById('np-rpm2');
 if (r2El) r2El.textContent = rpm2
 ? rpm2.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) + '/m²'
 : '—';
}

async function submitNovoProjeto() {
 const obraId = document.getElementById('np-obra').value;
 const tipo   = document.getElementById('np-tipo').value;
 if (!obraId) { document.getElementById('np-obra').style.borderColor = 'var(--red)'; return; }
 if (!tipo)   { document.getElementById('np-tipo').style.borderColor = 'var(--red)'; return; }
 if (!_sb) { _showToast('Sem conexão com o banco.', 'erro'); return; }

 const qtd    = parseFloat(document.getElementById('np-qtd').value) || null;
 const vUnit  = parseFloat(document.getElementById('np-val-uni').value) || null;
 const pUnit  = parseFloat(document.getElementById('np-peso-uni').value) || null;
 const m2arq  = parseFloat(document.getElementById('np-m2arq').value) || null;
 const m2estr = parseFloat(document.getElementById('np-m2estr').value) || null;
 const etapa  = document.getElementById('np-etapa').value;
 const comp   = document.getElementById('np-complexidade').value;
 const prod   = document.getElementById('np-produto').value || null;
 const resp   = (document.getElementById('np-responsavel').value || '').trim();
 const desc   = (document.getElementById('np-desc').value || '').trim();
 const obraNome = (document.getElementById('np-obra').selectedOptions[0] || {}).textContent || '';

 const payload = {
  nome: obraNome + ' — ' + tipo,
  obra_id: obraId,
  tipo_orcamento: tipo,
  etapa_projeto: etapa || null,
  produto: prod ? [prod] : null,
  complexidade: comp || null,
  m2_arquitetura: m2arq,
  m2_estrutura: m2estr,
  peso_kg: (qtd && pUnit) ? qtd * pUnit : null,
  quantidade: qtd,
  valor_unitario: vUnit,
  responsavel: resp ? [resp] : null,
  descritivo: desc || null,
 };

 const btn = document.querySelector('#modal-novo-projeto .btn-primary');
 const { error } = await _sb.from('projetos').insert(payload);
 if (error) {
  _showToast('Erro ao criar projeto: ' + _supaErrPt(error.message), 'erro');
  return;
 }
 _showToast('Projeto criado com sucesso!', 'ok');
 closeNovoProjeto();
 _dbLoadProjetos();
}

var _projetosKanbanEtapaOrder = [
 'Orçamento','Análise Inicial','Aguardando Aprovação','Pré-projeto',
 'Revisão Pré-Projeto','Projeto para Aprovação','Revisão Projeto',
 'Projeto Executivo','Revisão Projeto Executivo','Ajustes de Piloto',
 'Projeto em Andamento','Aguardando Produção','Projeto Finalizado',
 'Pós-vendas','Negócio perdido'
];

function _switchProjetosView(view) {
 var tbl    = document.getElementById('proj-table-view');
 var knb    = document.getElementById('proj-kanban');
 var btnTbl = document.getElementById('pv-btn-tabela');
 var btnKnb = document.getElementById('pv-btn-kanban');
 if (!tbl || !knb) return;
 if (view === 'kanban') {
  tbl.style.display = 'none';
  knb.style.display = 'flex';
  btnTbl.classList.remove('active');
  btnKnb.classList.add('active');
  _renderProjetosKanban();
 } else {
  tbl.style.display = 'block';
  knb.style.display = 'none';
  btnKnb.classList.remove('active');
  btnTbl.classList.add('active');
 }
}

async function _renderProjetosKanban() {
 var container = document.getElementById('proj-kanban');
 if (!container) return;
 container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted);font-size:13px">Carregando projetos do banco...</div>';

 var res = await _sb.from('projetos')
  .select('id, nome, etapa_projeto, tipo_orcamento, produto, complexidade, responsavel, valor_unitario, quantidade, peso_kg, obra_id, obra:obra_id(nome, empresas_obras(empresa:empresa_id(nome)))')
  .order('created_at', { ascending: false });

 if (res.error || !res.data) {
  container.innerHTML = '<div style="color:var(--red);padding:20px;font-size:13px">Erro ao carregar projetos: ' + (res.error ? res.error.message : 'sem dados') + '</div>';
  return;
 }

 var data     = res.data;
 data.forEach(function(p){ if (Array.isArray(p.responsavel)) p.responsavel = _emailsToNomes(p.responsavel); });
 var tipoCls  = {'Telhados':'bg','Steel Frame':'bp','Modular':'bb','Solar':'by'};
 var complCls = {'Simples':'bg','Média':'by','Média - simples':'by','Complexa':'br','Alta':'br'};
 var etapaCls = {
  'Orçamento':'bm','Análise Inicial':'bm','Aguardando Aprovação':'by',
  'Pré-projeto':'bm','Revisão Pré-Projeto':'by',
  'Projeto para Aprovação':'bb','Revisão Projeto':'by',
  'Projeto Executivo':'bb','Revisão Projeto Executivo':'by',
  'Ajustes de Piloto':'by','Projeto em Andamento':'by',
  'Aguardando Produção':'by','Projeto Finalizado':'bg',
  'Pós-vendas':'bg','Negócio perdido':'br'
 };

 // Agrupa por etapa — trim para ignorar espaços extras vindos do Airtable
 var groups = {};
 data.forEach(function(p) {
  var e = (p.etapa_projeto || 'Sem etapa').trim();
  if (!groups[e]) groups[e] = [];
  groups[e].push(p);
 });

 // Ordena colunas: etapas com dados na ordem definida, depois qualquer outra
 var ordered = _projetosKanbanEtapaOrder.filter(function(e){ return groups[e] && groups[e].length; });
 Object.keys(groups).forEach(function(e){ if (!ordered.includes(e)) ordered.push(e); });

 if (ordered.length === 0) {
  container.innerHTML = '<div class="sp-empty" style="width:100%">Nenhum projeto encontrado no banco.</div>';
  return;
 }

 container.innerHTML = ordered.map(function(etapa) {
  var cards  = groups[etapa];
  var cls    = etapaCls[etapa] || 'bm';
  var cardsHtml = cards.map(function(p) {
   var tipo     = p.tipo_orcamento || '';
   var tipCls   = tipoCls[tipo]   || 'bm';
   var compl    = p.complexidade  || '';
   var cmpCls   = complCls[compl] || 'bm';
   var obraNome = (p.obra && p.obra.nome)   ? p.obra.nome   : '—';
   var empNome  = (p.obra && p.obra.empresas_obras && p.obra.empresas_obras[0]?.empresa?.nome) ? p.obra.empresas_obras[0].empresa.nome : '';
   var valor    = (p.valor_unitario != null)
    ? 'R$ ' + (Number(p.valor_unitario) * Number(p.quantidade || 1)).toLocaleString('pt-BR', {minimumFractionDigits:2,maximumFractionDigits:2})
    : null;
   var obraId   = p.obra_id || '';
   var valorNum = (p.valor_unitario != null) ? Number(p.valor_unitario) * Number(p.quantidade || 1) : 0;
   var pesoNum  = (p.peso_kg != null) ? Number(p.peso_kg) * Number(p.quantidade || 1) : 0;
   var clienteStr = ((empNome ? empNome + ' — ' : '') + obraNome).replace(/"/g,'&quot;');
   return '<div class="proj-kn-card" onclick="if(obraId){_spObraById(\'' + obraId + '\')}" title="Abrir obra vinculada"'
    + ' data-tipo="' + tipo + '" data-etapa="' + etapa + '" data-compl="' + compl + '" data-cliente="' + clienteStr + '" data-valor="' + valorNum + '" data-peso="' + pesoNum + '">'
    + '<div class="proj-kn-title">' + (p.nome || '(sem nome)') + '</div>'
    + '<div class="proj-kn-obra" title="' + obraNome + '">'
    + (empNome ? empNome + ' — ' : '') + obraNome
    + '</div>'
    + '<div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:6px">'
    + (tipo  ? '<span class="badge ' + tipCls + '" style="font-size:9px">' + tipo  + '</span>' : '')
    + (compl ? '<span class="badge ' + cmpCls + '" style="font-size:9px">' + compl + '</span>' : '')
    + '</div>'
    + '<div class="proj-kn-footer">'
    + '<span style="font-size:11px;font-weight:700;color:var(--green)">' + (valor || '—') + '</span>'
    + (p.responsavel
       ? '<span style="font-size:10px;color:var(--muted)">' + p.responsavel.split(' ')[0] + '</span>'
       : '')
    + '</div>'
    + '</div>';
  }).join('');
  return '<div class="proj-kn-col">'
   + '<div class="proj-kn-head">'
   + '<span class="badge ' + cls + '" style="font-size:10px">' + etapa + '</span>'
   + '<span class="proj-kn-count">' + cards.length + '</span>'
   + '</div>'
   + '<div class="proj-kn-body">' + cardsHtml + '</div>'
   + '</div>';
 }).join('');
}

function _spProjetos(row, tds) {
 _spProjetoById(row.dataset.id);
}

// ── Renderer: Projeto por id ────────────────────────────────────────────────
// Extraído do antigo _spProjetos(row, tds), que lia tds[N].innerText (texto de
// célula formatado/truncado) — mesmo padrão já aplicado a _spObras/_spContatos
// (ver obras.js/empresas.js). Busca no cache _projetosArr (preenchido por
// _dbLoadProjetos); se o painel for aberto por um chip de OUTRA entidade antes
// da página Projetos ter sido visitada (cache ainda vazio), cai para uma busca
// direta no Supabase por id — mesma estratégia de fallback do _spObraById.
function _spProjetoById(id) {
 if (!id) return;
 var idx = (_projetosArr || []).findIndex(function(x){ return String(x.id) === String(id); });
 var p = idx !== -1 ? _projetosArr[idx] : null;
 if (p) { _spProjetoRender(p, idx); return; }

 _spSet('Projeto', 'Carregando...', '<div style="padding:40px;text-align:center;color:var(--muted)">Buscando dados...</div>', '');
 document.getElementById('sp-overlay').classList.add('sp-open');
 document.getElementById('sp-drawer').classList.add('sp-open');
 if (!_sb) return;
 _sb.from('projetos').select('*').eq('id', id).single().then(function(res) {
  if (res.error || !res.data) {
   _spSet('Projeto', 'Erro', '<div style="color:var(--red);padding:20px">Projeto não encontrado.</div>', '');
   return;
  }
  if (Array.isArray(res.data.responsavel)) res.data.responsavel = _emailsToNomes(res.data.responsavel);
  _spProjetoRender(res.data, -1);
 });
}

function _spProjetoRender(p, idx) {
 function pad3(n){ var s = String(n); while (s.length < 3) s = '0' + s; return s; }
 var cod    = idx != null && idx > -1 ? 'PRJ-' + pad3(idx + 1) : '';
 var obraInfo = p.obra_id ? (_obraIdMap[p.obra_id] || {}) : {};
 var obraNome = obraInfo.nome || '—';
 var tipo   = p.tipo_orcamento || '';
 var prod   = Array.isArray(p.produto) ? (p.produto[0] || '') : (p.produto || '');
 var qtd    = p.quantidade != null ? Number(p.quantidade) : null;
 var vU     = p.valor_unitario != null ? Number(p.valor_unitario) : null;
 var vT     = (vU != null && qtd != null) ? vU * qtd : vU;
 var fmtBRL = function(v){ return v != null ? 'R$ ' + Number(v).toLocaleString('pt-BR', {minimumFractionDigits:2}) : ''; };
 var etapa  = (p.etapa_projeto || '').trim();
 var compl  = p.complexidade || '';

 var html = `
  <div class="sp-g2">
   <div class="sp-field"><div class="sp-label">Código</div><input class="sp-inp" value="${cod}" readonly></div>
   <div class="sp-field"><div class="sp-label">Tipo</div><input class="sp-inp" value="${tipo}" readonly></div>
  </div>
  <div class="sp-field"><div class="sp-label">Obra vinculada</div><input class="sp-inp" value="${(obraNome||'').replace(/"/g,'&quot;')}" readonly></div>
  <div class="sp-g2">
   <div class="sp-field"><div class="sp-label">Produto</div><input class="sp-inp" value="${prod}"></div>
   <div class="sp-field"><div class="sp-label">Etapa</div><input class="sp-inp" value="${etapa}"></div>
  </div>
  <div class="sp-g3">
   <div class="sp-field"><div class="sp-label">Qtd.</div><input class="sp-inp" value="${qtd != null ? qtd : ''}"></div>
   <div class="sp-field"><div class="sp-label">Valor unit.</div><input class="sp-inp" value="${fmtBRL(vU)}"></div>
   <div class="sp-field"><div class="sp-label">Valor total</div><input class="sp-inp" value="${fmtBRL(vT)}" readonly></div>
  </div>
  <div class="sp-field"><div class="sp-label">Complexidade</div><input class="sp-inp" value="${compl}"></div>
  <div style="margin-top:20px;border-top:1px solid var(--border);padding-top:16px">
   <div style="font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;margin-bottom:10px">Empresa vinculada</div>
   <div id="sp-proj-empresa" class="sp-rel-chips-wrap">
    <div style="font-size:12px;color:var(--muted);padding:12px 0">Carregando empresa...</div>
   </div>
  </div>
 `;

 _spSet('Projeto', (cod ? cod + ' — ' : '') + obraNome, html,
  '<button class="btn btn-ghost" onclick="closePanel()">Fechar</button>');

 // Empresa vinculada — Projeto→Empresa é FK direta (projetos.empresa_id),
 // sem join necessário (ver notas do módulo). Mesmo padrão de chip clicável
 // (_spRelChipHTML) e carregamento preguiçoso já usado em Obras vinculadas/
 // Contatos vinculados no painel de Empresa (ver empresas.js).
 var container = document.getElementById('sp-proj-empresa');
 if (!container) return;
 if (!p.empresa_id) {
  container.innerHTML = '<div class="sp-empty">Nenhuma empresa vinculada a este projeto.</div>';
  return;
 }
 var empCache = (_empresasArr || []).find(function(e){ return String(e.id) === String(p.empresa_id); });
 if (empCache) {
  container.innerHTML = _spRelChipHTML('empresas', empCache.id, empCache.nome || '—');
  return;
 }
 if (!_sb) { container.innerHTML = '<div class="sp-empty">Nenhuma empresa vinculada a este projeto.</div>'; return; }
 _sb.from('empresas').select('id, nome').eq('id', p.empresa_id).single().then(function(res) {
  if (res.error || !res.data) { container.innerHTML = '<div class="sp-empty">Nenhuma empresa vinculada a este projeto.</div>'; return; }
  container.innerHTML = _spRelChipHTML('empresas', res.data.id, res.data.nome || '—');
 });
}

// Filtro/Ordenação — mesmos componentes reutilizáveis do Gestor de Tarefas/
// Obras/Empresas/Instalações/Entregas (filtro-builder/sort-builder/smart-
// search). Aplica nas duas visualizações (Tabela e Kanban), igual ao Obras:
// _fbEvaluate/_sbCompare recebem o .dataset de cada <tr>/.proj-kn-card
// direto (ver data-* adicionados nos templates de _dbLoadProjetos/
// _renderProjetosKanban).
var _projFbFields = [
 { key: 'tipo',    label: 'Tipo de orçamento', type: 'select', options: ['Telhados','Steel Frame','Modular','Solar'] },
 { key: 'etapa',   label: 'Etapa',             type: 'text' },
 { key: 'compl',   label: 'Complexidade',      type: 'text' },
 { key: 'cliente', label: 'Cliente/Obra',      type: 'text' },
];
_fbInit('projetos', _projFbFields, _projApplyFilters);

var _projSbFields = [
 { key: 'cliente', label: 'Cliente/Obra', type: 'text' },
 { key: 'etapa',   label: 'Etapa',        type: 'text' },
 { key: 'valor',   label: 'Valor total',  type: 'number', getValue: function(ds) { return parseFloat(ds.valor) || 0; } },
 { key: 'peso',    label: 'Peso total',   type: 'number', getValue: function(ds) { return parseFloat(ds.peso) || 0; } },
];
_sbInit('projetos', _projSbFields, _projApplyFilters);

// Agrupar — mesmo esquema de Obras (opera sobre <tr> já existentes no DOM,
// não reconstrói a tbody a partir de um array em memória; ver comentário
// completo em _obrasRenderGroupNode, obras.js).
var _projGbFields = [
 { key: 'tipo',    label: 'Tipo de orçamento' },
 { key: 'etapa',   label: 'Etapa' },
 { key: 'compl',   label: 'Complexidade' },
 { key: 'cliente', label: 'Cliente/Obra' },
];
_gbInit('projetos', _projGbFields, _projApplyFilters, 3);
var _projGroupCollapsed = {};
function _projToggleGroup(key) {
 _projGroupCollapsed[key] = !_projGroupCollapsed[key];
 _projApplyFilters();
}
function _projRenderGroupNode(node, path, tbody, forceHidden) {
 if (node.leaf) {
  node.items.forEach(function(tr) {
   if (forceHidden) tr.style.display = 'none';
   tbody.appendChild(tr);
  });
  return;
 }
 node.order.forEach(function(k) {
  var child = node.children[k];
  var nodePath = path.concat(k);
  var pathKey = nodePath.join(' :: ');
  var isCollapsed = !!_projGroupCollapsed[pathKey];
  var visCount = _gtTreeCount(child, function(tr){ return tr.style.display !== 'none'; });
  var indent = 12 + path.length * 20;
  var hd = document.createElement('tr');
  hd.className = 'gestor-group-hd proj-group-row';
  hd.style.position = 'static';
  hd.onclick = function(){ _projToggleGroup(pathKey); };
  hd.style.display = (forceHidden || !visCount) ? 'none' : '';
  hd.innerHTML = '<td colspan="11" style="padding-left:' + indent + 'px">'
   + '<span style="margin-right:4px">' + (isCollapsed ? '▶' : '▼') + '</span>'
   + '<strong>' + (k || '—') + '</strong>'
   + '<span style="color:var(--muted);font-size:9px;margin-left:6px">(' + visCount + ')</span>'
   + '</td>';
  tbody.appendChild(hd);
  _projRenderGroupNode(child, nodePath, tbody, forceHidden || isCollapsed);
 });
}

function _projApplyFilters() {
 var buscaNorm = _ssNormalize(((document.getElementById('proj-search') || {}).value || '').trim());
 var activeConds = _fbInstances.projetos.state.conditions.filter(_fbConditionIsUsable).length;
 var visivel = 0;

 // Remove cabeçalhos de grupo da renderização anterior antes de reconsultar
 // as linhas — eles não têm data-id, então não entram no seletor abaixo.
 Array.prototype.slice.call(document.querySelectorAll('#proj-tbody tr.proj-group-row')).forEach(function(tr){ tr.remove(); });
 var rows = Array.prototype.slice.call(document.querySelectorAll('#proj-tbody tr[data-id]'));
 rows.forEach(function(tr) {
  var ok = _fbEvaluate(tr.dataset, 'projetos');
  if (ok && buscaNorm) ok = _ssMatch(_ssNormalize(tr.textContent), buscaNorm);
  tr.style.display = ok ? '' : 'none';
  if (ok) visivel++;
 });
 if (rows.length) {
  rows.sort(function(a, b) { return _sbCompare(a.dataset, b.dataset, 'projetos'); });
  var tbody = rows[0].parentElement;
  var groupLevels = (_gbInstances.projetos && _gbInstances.projetos.state.levels) || [];
  if (groupLevels.length) {
   var tree = _gtBuildTree(rows, groupLevels, function(tr, field) {
    return { key: tr.dataset[field] || 'Sem valor', sortKey: null };
   }, null, 0);
   _projRenderGroupNode(tree, [], tbody, false);
  } else {
   rows.forEach(function(tr) { tbody.appendChild(tr); });
  }
 }

 var cards = Array.prototype.slice.call(document.querySelectorAll('#proj-kanban .proj-kn-card'));
 cards.forEach(function(card) {
  var ok = _fbEvaluate(card.dataset, 'projetos');
  if (ok && buscaNorm) ok = _ssMatch(_ssNormalize(card.textContent), buscaNorm);
  card.style.display = ok ? '' : 'none';
 });
 var byBody = new Map();
 cards.forEach(function(card) {
  var body = card.parentElement;
  if (!byBody.has(body)) byBody.set(body, []);
  byBody.get(body).push(card);
 });
 byBody.forEach(function(colCards, body) {
  colCards.sort(function(a, b) { return _sbCompare(a.dataset, b.dataset, 'projetos'); });
  colCards.forEach(function(c) { body.appendChild(c); });
 });
 document.querySelectorAll('#proj-kanban .proj-kn-col').forEach(function(col) {
  var countEl = col.querySelector('.proj-kn-count');
  if (countEl) countEl.textContent = col.querySelectorAll('.proj-kn-card:not([style*="display: none"]):not([style*="display:none"])').length;
 });

 var fbBadge = document.getElementById('fb-badge-projetos');
 if (fbBadge) { fbBadge.textContent = activeConds; fbBadge.style.display = activeConds ? '' : 'none'; }
 var countEl2 = document.getElementById('proj-filter-count');
 if (countEl2) {
  if (activeConds || buscaNorm) { countEl2.textContent = visivel + (visivel === 1 ? ' resultado' : ' resultados'); countEl2.style.display = 'inline'; }
  else { countEl2.style.display = 'none'; }
 }
}

var _projetosArr    = [];
var _obraIdMap      = {}; // id → {nome, empresa} preenchido por _dbLoadObras

async function _dbLoadProjetos() {
 var tbody=document.getElementById('proj-tbody');
 if(tbody) tbody.innerHTML='<tr><td colspan="11" style="text-align:center;padding:32px;color:var(--muted);font-size:13px">Carregando projetos...</td></tr>';
 var allData=[]; var from=0; var more=true;
 while(more){
  var res=await _sb.from('projetos').select('*').order('created_at',{ascending:false}).range(from,from+999);
  if(res.error){
   if(tbody)tbody.innerHTML='<tr><td colspan="11" style="text-align:center;padding:32px;color:var(--red);font-size:13px">Erro ao carregar projetos: '+res.error.message+'</td></tr>';
   return;
  }
  if(res.data&&res.data.length)allData=allData.concat(res.data);
  more=res.data&&res.data.length===1000; from+=1000;
 }
 if(!allData.length){
  if(tbody)tbody.innerHTML='<tr><td colspan="11" style="text-align:center;padding:32px;color:var(--muted);font-size:13px">Nenhum projeto encontrado.</td></tr>';
  return;
 }
 allData.forEach(function(p){ if (Array.isArray(p.responsavel)) p.responsavel = _emailsToNomes(p.responsavel); });
 _projetosArr=allData;
 if(!tbody)return;
 function _pad3(n){var s=String(n);while(s.length<3)s='0'+s;return s;}
 var _tCls={'Telhados':'bg','Steel Frame':'bp','Modular':'bb','Solar':'by'};
 var _eCls={
  'Orçamento':'bm','Análise Inicial':'bm','Aguardando Aprovação':'by',
  'Pré-projeto':'bm','Revisão Pré-Projeto':'by',
  'Projeto para Aprovação':'bb','Revisão Projeto':'by',
  'Projeto Executivo':'bb','Revisão Projeto Executivo':'by',
  'Ajustes de Piloto':'by','Projeto em Andamento':'by',
  'Aguardando Produção':'by','Projeto Finalizado':'bg',
  'Pós-vendas':'bg','Negócio perdido':'br'
 };
 function _fmtBRL(v){return v!=null?'R$ '+Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2}):'—';}
 function _fmtN(v,d){return v!=null?Number(v).toLocaleString('pt-BR',{minimumFractionDigits:d||0}):'—';}
 var _emAnd=['Pré-projeto','Revisão Pré-Projeto','Projeto para Aprovação','Revisão Projeto','Projeto Executivo','Revisão Projeto Executivo','Ajustes de Piloto','Projeto em Andamento','Aguardando Produção'];
 var totV=0,totP=0,cAnd=0;
 tbody.innerHTML=allData.map(function(p,idx){
  var cod='PRJ-'+_pad3(idx+1);
  var tipo=p.tipo_orcamento||'';
  var etapa=(p.etapa_projeto||'').trim();
  var prod=Array.isArray(p.produto)?(p.produto[0]||'—'):(p.produto||'—');
  var qtd=p.quantidade!=null?Number(p.quantidade):null;
  var vU=p.valor_unitario!=null?Number(p.valor_unitario):null;
  var vT=(vU!=null&&qtd!=null)?vU*qtd:vU;
  var pU=p.peso_kg!=null?Number(p.peso_kg):null;
  var pT=(pU!=null&&qtd!=null)?pU*qtd:pU;
  var obraInfo=p.obra_id?(_obraIdMap[p.obra_id]||{}):{};
  var obraNome=obraInfo.nome||'—';
  var empNome=obraInfo.empresa||'';
  var cliente=empNome||obraNome;
  if(vT)totV+=vT;if(pT)totP+=pT;if(_emAnd.indexOf(etapa)!==-1)cAnd++;
  return '<tr onclick="if(!event.target.closest(\'button,a,input,select\'))_spOpen(\'projetos\',this)" data-tipo="'+tipo+'" data-id="'+(p.id||'')+'"'
   +' data-etapa="'+etapa+'" data-compl="'+(p.complexidade||'')+'" data-cliente="'+(cliente||'').replace(/"/g,'&quot;')+'" data-valor="'+(vT||0)+'" data-peso="'+(pT||0)+'">'
   +'<td style="font-weight:600;color:var(--navy)">'+cod+'</td>'
   +'<td style="font-size:12px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+obraNome+'">'+cliente+'</td>'
   +'<td>'+(tipo?'<span class="badge '+(_tCls[tipo]||'bm')+'">'+tipo+'</span>':'—')+'</td>'
   +'<td style="font-size:12px">'+prod+'</td>'
   +'<td style="text-align:right">'+(qtd!=null?qtd:'—')+'</td>'
   +'<td style="text-align:right">'+_fmtBRL(vU)+'</td>'
   +'<td style="text-align:right;font-weight:600;color:var(--green)">'+_fmtBRL(vT)+'</td>'
   +'<td style="text-align:right">'+_fmtN(pU,1)+'</td>'
   +'<td style="text-align:right">'+_fmtN(pT,1)+'</td>'
   +'<td>'+(etapa?'<span class="badge '+(_eCls[etapa]||'bm')+'">'+etapa+'</span>':'—')+'</td>'
   +'<td>'+(p.complexidade||'—')+'</td></tr>';
 }).join('');
 // Badge do menu lateral: ver _navBadgesLoadInitial() (RPC de contagem).
 var kT=document.getElementById('proj-kpi-total');if(kT)kT.textContent=allData.length;
 var kA=document.getElementById('proj-kpi-andamento');if(kA)kA.textContent=cAnd;
 var kV=document.getElementById('proj-kpi-valor');if(kV)kV.textContent='R$ '+Math.round(totV).toLocaleString('pt-BR');
 var kP=document.getElementById('proj-kpi-peso');if(kP)kP.textContent=Math.round(totP).toLocaleString('pt-BR');
 var hint=document.getElementById('proj-count-hint');if(hint)hint.textContent=allData.length+' projetos · clique em uma linha para editar';
}
