// ═══════════════════════════════════════════════════════════════════════════════
// ENTREGAS — tabela/kanban/calendário de entregas de obra, renderer do painel
// lateral, carga da lista. "Salvar" no painel lateral ainda não foi implementado
// (não é código morto, é feature ausente no sistema original).
//
// Redesign completo (Tabela/Kanban/Calendário + Filtro/Agrupar/Ordenar/
// Visualizações reais + abas de atalho estilo Airtable), ver PR — corrige
// bugs de dados reais encontrados na auditoria do schema `entregas`:
//  - `e.numero` NUNCA existiu na tabela `entregas` (schema real: id,
//    airtable_id, nome_entrega, obra_id, etapa, valor, quantidade, peso_kg,
//    transporte, cidade, data_faturamento, pedido_produzido,
//    pedido_compusa_milatec, pedido_compusa_mila, maior_peca_mm,
//    endereco_entrega, created_at, updated_at) — daí o "#undefined" visto
//    pela usuária. `nome_entrega` é o campo real e muito mais informativo
//    (ex.: "VIANA E MOURA - PROJ 13.2 - PEDIDO 172478 - CARUARU / PARTE 2"),
//    passa a ser o texto primário de cada linha/card.
//  - `e.obra?.tipo_orcamento` também nunca existiu (não é coluna de `obras`)
//    — coluna "Tipo" era 100% decorativa, removida.
//  - "Previsão produção/expedição/entrega" nunca tiveram campo de data real
//    por trás (só existe `data_faturamento`) — as 3 colunas mostravam só
//    "—"; unificadas numa única coluna "Faturamento" com o dado real.
//  - `stMap` comparava com rótulos ('Aguardando produção','Em produção',
//    'Transporte','Entregue') que NUNCA existiram nos dados reais — os
//    valores reais de `etapa` são 'Aprovação de projeto'/'Liberar produção'/
//    'Produção'/'Pedido produzido'/'Programar entrega'/'Em transporte'/
//    'Entrega realizada' (94% das 1472 linhas = "Entrega realizada"). Sem
//    mapeamento correto, TUDO caía no fallback 'aguardando'. Ver
//    _entEtapaBucket abaixo pro mapeamento real → 4 status visuais.
// ═══════════════════════════════════════════════════════════════════════════════
function openNovaEntrega() { alert('Modal "Nova Entrega" será implementado em breve.'); }

// ── Status: mapeamento REAL etapa → bucket visual ──────────────────────────
// A tabela `etapa` tem 7 valores reais + null (ver auditoria acima); o
// produto só quer expor 4 status visuais (Aguardando produção/Em produção/
// Em transporte/Entregue), então cada etapa real cai num desses 4 baldes —
// mas o RÓTULO exibido continua sendo o `etapa` real (mais preciso), só a
// COR/agrupamento é que usam o balde.
var _entEtapaBucket = {
 'Aprovação de projeto':  'aguardando',
 'Liberar produção':      'producao',
 'Produção':               'producao',
 'Pedido produzido':       'producao',
 'Programar entrega':      'producao',
 'Em transporte':          'transporte',
 'Entrega realizada':      'entregue'
};
function _entBucketFor(etapa) { return _entEtapaBucket[etapa] || 'aguardando'; }
var _entBucketCor   = { aguardando:'#B8790A', producao:'#2E5FD9', transporte:'#8b5cf6', entregue:'#1F8A4C', atrasado:'#D6433C' };
var _entBucketLabel = { aguardando:'Aguardando produção', producao:'Em produção', transporte:'Em transporte', entregue:'Entregue' };
// "Atrasado" — mesmo esquema do Gestor de Tarefas (_gIsLate): calculado, não
// é um valor de `etapa`. Vencida = data_faturamento no passado + ainda não
// entregue. Sobrepõe a cor do status (ponto vermelho), sem esconder o rótulo.
function _entIsLate(e) {
 if (_entBucketFor(e.etapa) === 'entregue' || !e.data_faturamento) return false;
 return new Date(e.data_faturamento + 'T00:00:00') < new Date(new Date().setHours(0,0,0,0));
}
function _entCidadeUf(e) {
 // `entregas.cidade` é texto livre digitado manualmente (formatos
 // inconsistentes: "buique/PE", "ITAITINGA/CE", "Caxias/MA"...); `obras.cidade`
 // + `obras.estado` são campos estruturados mais confiáveis quando a obra
 // está vinculada — preferidos; cai pro texto livre da própria entrega só
 // quando não há obra vinculada.
 var o = e.obra;
 if (o && (o.cidade || o.estado)) return [o.cidade, o.estado].filter(Boolean).join('/');
 return e.cidade || '';
}

// ── Filtro/Ordenação/Agrupamento — componentes reutilizáveis do Gestor de
// Tarefas/Obras/Empresas/Instalações (filtro-builder/sort-builder/
// group-builder/smart-search/saved-views), sobre campos REAIS (ver auditoria
// acima) em vez dos 4 chips fixos de status ou de colunas fantasma.
var _entFbFields = [
 // options em português (via _entBucketLabel) — o filtro comparava/exibia a
 // chave interna crua (aguardando/producao/transporte/entregue), que nunca
 // deveria aparecer pra usuária, só serve de índice interno pro bucket.
 { key: 'status',     label: 'Status',      type: 'select',
   options: ['aguardando','producao','transporte','entregue'].map(function(k){ return _entBucketLabel[k]; }),
   getValue: function(ds) { return _entBucketLabel[ds.status] || ds.status; } },
 { key: 'nomeEntrega', label: 'Entrega',     type: 'text' },
 { key: 'obra',        label: 'Obra',        type: 'text' },
 { key: 'empresa',     label: 'Empresa',     type: 'text' },
 { key: 'cidade',       label: 'Cidade',      type: 'text' },
 { key: 'estado',       label: 'Estado',      type: 'text' },
 { key: 'transporte',   label: 'Transporte',  type: 'text' },
 { key: 'dataFat',      label: 'Faturamento', type: 'date' },
];
_fbInit('entregas', _entFbFields, _entApplyFilters);

var _entSbFields = [
 { key: 'nomeEntrega', label: 'Entrega',      type: 'text' },
 { key: 'obra',        label: 'Obra',         type: 'text' },
 { key: 'dataFat',      label: 'Faturamento',  type: 'date' },
 { key: 'quantidade',   label: 'Qtd. (peças)', type: 'number', getValue: function(ds) { return parseFloat(ds.quantidade) || 0; } },
 { key: 'peso',         label: 'Peso (kg)',    type: 'number', getValue: function(ds) { return parseFloat(ds.peso) || 0; } },
];
_sbInit('entregas', _entSbFields, _entApplyFilters);

// Agrupamento — até 4 níveis (todos os campos disponíveis). Campos pedidos:
// Cidade/Estado/Status/Transporte. _entRenderGroupNode já é recursivo desde
// sempre (_gtBuildTree), só o maxLevels travava em 1.
var _entGroupCollapsed = {};
function _entGroupKeyFor(e, field) {
 if (field === 'status')      return { key: _entBucketLabel[_entBucketFor(e.etapa)], sortKey: ['aguardando','producao','transporte','entregue'].indexOf(_entBucketFor(e.etapa)) };
 if (field === 'cidade')      return { key: _entCidadeUf(e) || '— Sem cidade', sortKey: null };
 if (field === 'estado') {
  var uf = (e.obra && e.obra.estado) || '';
  return { key: uf ? uf.toUpperCase() : '— Sem estado', sortKey: null };
 }
 if (field === 'transporte')  return { key: e.transporte || '— Sem transporte', sortKey: null };
 return { key: '— Sem grupo', sortKey: null };
}
_gbInit('entregas', [
 { key: 'cidade',      label: 'Cidade' },
 { key: 'estado',      label: 'Estado' },
 { key: 'status',      label: 'Status' },
 { key: 'transporte',  label: 'Transporte' },
], _entApplyFilters, 3);

// Pseudo-dataset: mesmos campos/mesma normalização que um <tr data-*> real
// carregaria — permite _fbEvaluate/_sbCompare funcionarem idênticos com ou
// sem DOM (agrupado, Kanban, Calendário — nenhum desses tem <tr>).
function _entPseudoDataset(e) {
 var obraNome = (e.obra && e.obra.nome) || '';
 var empNome  = (e.obra && e.obra.empresas_obras && e.obra.empresas_obras[0] && e.obra.empresas_obras[0].empresa && e.obra.empresas_obras[0].empresa.nome) || '';
 return {
  status:      _entBucketFor(e.etapa),
  nomeEntrega: (e.nome_entrega || '').toLowerCase(),
  obra:        obraNome.toLowerCase(),
  empresa:     empNome.toLowerCase(),
  cidade:      _entCidadeUf(e).toLowerCase(),
  estado:      ((e.obra && e.obra.estado) || '').toLowerCase(),
  transporte:  (e.transporte || '').toLowerCase(),
  dataFat:     e.data_faturamento || '',
  quantidade:  e.quantidade != null ? e.quantidade : 0,
  peso:        e.peso_kg != null ? e.peso_kg : 0,
 };
}
function _entSearchHaystack(e) {
 var obraNome = (e.obra && e.obra.nome) || '';
 var empNome  = (e.obra && e.obra.empresas_obras && e.obra.empresas_obras[0] && e.obra.empresas_obras[0].empresa && e.obra.empresas_obras[0].empresa.nome) || '';
 return [e.nome_entrega, obraNome, empNome, _entCidadeUf(e), e.transporte].filter(Boolean).join(' ');
}

// "Atrasado" — botão de um clique fora do popover de Filtro (mesmo padrão já
// aplicado ao Gestor de Tarefas: é um cálculo do sistema, não um valor de
// campo, então não faz sentido como condição do filtro-builder).
var _entSomenteAtrasadas = false;
function _entToggleAtrasadas() {
 _entSomenteAtrasadas = !_entSomenteAtrasadas;
 var btn = document.getElementById('ent-btn-atrasadas');
 if (btn) btn.classList.toggle('active', _entSomenteAtrasadas);
 _entApplyFilters();
}

// ── Abas de atalho (quick-view), estilo Airtable — mesma ideia de
// "Filtrar" pré-programado que _gestorPreset já usa pro Período do Gestor
// de Tarefas, adaptada aqui pra escrever direto as condições do
// filtro-builder (o popover de Filtro continua 100% editável depois).
// Definições escolhidas (sem equivalente 1:1 no pedido original, então
// documentadas aqui e no relatório):
//  - "A realizar"          → status ≠ Entregue (ainda não chegou no cliente)
//  - "A programar"         → Faturamento vazio (ainda sem data marcada)
//  - "Entregas esse ano"   → Faturamento entre 01/01 e 31/12 do ano atual
//  - "2 semanas"           → Faturamento entre hoje e hoje+14 dias
//  - "Todas as entregas"   → limpa o filtro (mantém agrupamento/ordenação)
function _entFmtDateISO(d) { return d.toISOString().slice(0,10); }
function _entQuickPreset(name, btn) {
 var inst = _fbInstances.entregas;
 var conds = [];
 if (name === 'a-realizar') {
  conds = [{ id:'qv1', field:'status', operator:'neq', value:'entregue' }];
 } else if (name === 'a-programar') {
  conds = [{ id:'qv1', field:'dataFat', operator:'empty', value:'' }];
 } else if (name === 'ano') {
  var y = new Date().getFullYear();
  conds = [{ id:'qv1', field:'dataFat', operator:'between', value:[y+'-01-01', y+'-12-31'] }];
 } else if (name === '2semanas') {
  var hoje = new Date(); hoje.setHours(0,0,0,0);
  var fim = new Date(hoje); fim.setDate(fim.getDate()+14);
  conds = [{ id:'qv1', field:'dataFat', operator:'between', value:[_entFmtDateISO(hoje), _entFmtDateISO(fim)] }];
 } // 'todas' → conds fica []
 inst.state.conditions = conds;
 document.querySelectorAll('.ent-qv-btn').forEach(function(b){ b.classList.remove('active'); });
 if (btn) btn.classList.add('active');
 _fbRender('entregas');
 _fbApply('entregas');
}

function _entApplyFilters() {
 var groupLevels = (_gbInstances.entregas && _gbInstances.entregas.state.levels) || [];
 if (groupLevels.length) { _entRenderGrouped(groupLevels); return; }

 // Saindo do modo agrupado: remove cabeçalhos de grupo inseridos por
 // _entRenderGrouped antes de operar sobre as <tr data-id> normais (mesmo
 // esquema de _obrasApplyFilters/_empApplyFilters).
 var tbody0 = document.getElementById('ent-tbody');
 if (tbody0 && tbody0.querySelector('tr.gestor-group-hd')) {
  tbody0.innerHTML = (_entregasArr || []).map(_entRowHTML).join('');
 }

 var buscaNorm = _ssNormalize(((document.getElementById('ent-search') || {}).value || '').trim());
 var activeConds = _fbInstances.entregas.state.conditions.filter(_fbConditionIsUsable).length;
 var rows = Array.prototype.slice.call(document.querySelectorAll('#ent-tbody tr[data-id]'));
 var visivel = 0;
 rows.forEach(function(tr) {
  var ok = _fbEvaluate(tr.dataset, 'entregas');
  if (ok && _entSomenteAtrasadas) ok = tr.dataset.atrasado === '1';
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
  if (activeConds || buscaNorm || _entSomenteAtrasadas) { countEl.textContent = visivel + (visivel === 1 ? ' resultado' : ' resultados'); countEl.style.display = 'inline'; }
  else { countEl.style.display = 'none'; }
 }
 // Kanban/Calendário reagem ao mesmo filtro/busca/agrupamento — chamados
 // sempre (baixo custo: nenhuma das duas views toca o DOM se não estiver visível).
 _entRenderKanbanIfVisible();
 _entRenderCalIfVisible();
}

// ── Lista filtrada+ordenada em memória — usada por Kanban/Calendário (que
// não têm <tr> pra esconder/mostrar) e pelo modo agrupado da Tabela. ────────
function _entFilteredSorted() {
 var buscaNorm = _ssNormalize(((document.getElementById('ent-search') || {}).value || '').trim());
 var filtered = (_entregasArr || []).filter(function(e) {
  var ds = _entPseudoDataset(e);
  var ok = _fbEvaluate(ds, 'entregas');
  if (ok && _entSomenteAtrasadas) ok = _entIsLate(e);
  if (ok && buscaNorm) ok = _ssMatch(_ssNormalize(_entSearchHaystack(e)), buscaNorm);
  return ok;
 });
 filtered.sort(function(a, b) { return _sbCompare(_entPseudoDataset(a), _entPseudoDataset(b), 'entregas'); });
 return filtered;
}

// ── Agrupamento da Tabela (mesmo esquema de _empRenderGrouped/_cttRenderGrouped
// em empresas.js) ────────────────────────────────────────────────────────────
function _entToggleGroup(key) {
 _entGroupCollapsed[key] = !_entGroupCollapsed[key];
 _entApplyFilters();
}
function _entRenderGroupNode(node, path, rowsArr) {
 if (node.leaf) {
  node.items.forEach(function(e) { rowsArr.push(_entRowHTML(e)); });
  return;
 }
 node.order.forEach(function(k) {
  var child = node.children[k];
  var nodePath = 'entregas::' + path.concat(k).join(' :: ');
  var isCollapsed = !!_entGroupCollapsed[nodePath];
  var total = _gtTreeCount(child);
  var indent = 12 + path.length * 20; // indentação por nível — antes fixa em 12px, ilegível com 2+ níveis
  rowsArr.push(
   '<tr class="gestor-group-hd" onclick="_entToggleGroup(\'' + nodePath.replace(/'/g, "\\'") + '\')">'
   + '<td colspan="6" style="padding-left:' + indent + 'px">'
   + '<span style="margin-right:4px">' + (isCollapsed ? '▶' : '▼') + '</span>'
   + '<strong>' + k + '</strong>'
   + '<span style="color:var(--muted);font-size:9px;margin-left:6px">' + total + ' entrega' + (total !== 1 ? 's' : '') + '</span>'
   + '</td></tr>'
  );
  if (!isCollapsed) _entRenderGroupNode(child, path.concat(k), rowsArr);
 });
}
function _entRenderGrouped(levels) {
 var tbody = document.getElementById('ent-tbody');
 if (!tbody) return;
 var filtered = _entFilteredSorted();
 var tree = _gtBuildTree(filtered, levels, _entGroupKeyFor, null, 0);
 var rowsArr = [];
 _entRenderGroupNode(tree, [], rowsArr);
 tbody.innerHTML = rowsArr.length ? rowsArr.join('') : '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:32px;font-size:13px">Nenhuma entrega encontrada.</td></tr>';

 var fbBadge = document.getElementById('fb-badge-entregas');
 var activeConds = _fbInstances.entregas.state.conditions.filter(_fbConditionIsUsable).length;
 if (fbBadge) { fbBadge.textContent = activeConds; fbBadge.style.display = activeConds ? '' : 'none'; }
 var countEl = document.getElementById('ent-filter-count');
 if (countEl) {
  var buscaNorm = _ssNormalize(((document.getElementById('ent-search') || {}).value || '').trim());
  if (activeConds || buscaNorm || _entSomenteAtrasadas) { countEl.textContent = filtered.length + (filtered.length === 1 ? ' resultado' : ' resultados'); countEl.style.display = 'inline'; }
  else { countEl.style.display = 'none'; }
 }
 _entRenderKanbanIfVisible();
 _entRenderCalIfVisible();
}

// ── Visualizações salvas (saved-views.js) — mesma mecânica de Obras
// (_vwInit('obras',...)), gravando modulo='entregas' na gestor_views. ───────
_vwInit('entregas', {
 modulo: 'entregas',
 getState: function() {
  return {
   filtro: _fbInstances.entregas ? _fbInstances.entregas.state : { logic: 'AND', conditions: [] },
   sort:   _sbInstances.entregas ? _sbInstances.entregas.state : { levels: [] },
   group:  _gbInstances.entregas ? _gbInstances.entregas.state : { levels: [] },
  };
 },
 applyState: function(state) {
  if (_sbInstances.entregas) { _sbInstances.entregas.state = state.sort || { levels: [] }; _sbRender('entregas'); }
  if (_gbInstances.entregas) { _gbInstances.entregas.state = state.group || { levels: [] }; _gbRender('entregas'); }
  if (_fbInstances.entregas) { _fbInstances.entregas.state = state.filtro || { logic: 'AND', conditions: [] }; _fbRender('entregas'); _fbApply('entregas'); }
  document.querySelectorAll('.ent-qv-btn').forEach(function(b){ b.classList.remove('active'); });
  _entApplyFilters();
 }
});

// ── Vistas: Tabela / Kanban / Calendário ────────────────────────────────────
function setEntView(v) {
 document.getElementById('ent-view-tabela').style.display    = v === 'tabela'    ? '' : 'none';
 document.getElementById('ent-view-kanban').style.display    = v === 'kanban'    ? '' : 'none';
 document.getElementById('ent-view-calendario').style.display = v === 'calendario' ? '' : 'none';
 document.getElementById('ent-btn-tabela').className     = 'ent-view-btn' + (v === 'tabela'    ? ' active' : '');
 document.getElementById('ent-btn-kanban').className     = 'ent-view-btn' + (v === 'kanban'    ? ' active' : '');
 document.getElementById('ent-btn-calendario').className = 'ent-view-btn' + (v === 'calendario' ? ' active' : '');
 if (v === 'kanban') _entRenderKanban();
 if (v === 'calendario') renderEntCal();
}
function _entRenderKanbanIfVisible() {
 var el = document.getElementById('ent-view-kanban');
 if (el && el.style.display !== 'none') _entRenderKanban();
}
function _entRenderCalIfVisible() {
 var el = document.getElementById('ent-view-calendario');
 if (el && el.style.display !== 'none') renderEntCal();
}

// ── KANBAN — mesmo esquema visual do Kanban de Obras (kanban-obras/kanban-col/
// kc-body/kc-count, ver _dbLoadObrasKanban em obras.js), 4 colunas fixas pelos
// buckets de status reais. Cards reaproveitam .obra-card/.oc-title/.oc-tags/
// .oc-date do design já existente — sem inventar linguagem visual nova.
var _entKcId = { aguardando:'ent-kc-aguardando', producao:'ent-kc-producao', transporte:'ent-kc-transporte', entregue:'ent-kc-entregue' };
function _entCardHTML(e) {
 var bucket = _entBucketFor(e.etapa);
 var atrasado = _entIsLate(e);
 var obraNome = (e.obra && e.obra.nome) || '';
 var dt = e.data_faturamento ? new Date(e.data_faturamento+'T00:00:00').toLocaleDateString('pt-BR') : '';
 return '<div class="obra-card ent-card" data-id="' + e.id + '" onclick="_spEntregaById(\'' + e.id + '\')">'
  + (atrasado ? '<span class="ent-card-late" title="Faturamento vencido">Atrasado</span>' : '')
  + '<div class="oc-title">' + (e.nome_entrega || 'Entrega sem nome') + '</div>'
  + (obraNome ? '<div style="font-size:11px;color:var(--muted);margin-top:3px">' + obraNome + '</div>' : '')
  + '<div class="oc-tags">'
  + (e.transporte ? '<span class="badge bg" style="font-size:10px">' + e.transporte + '</span>' : '')
  + '</div>'
  + (dt ? '<div class="oc-date">Faturamento ' + dt + '</div>' : '')
  + '</div>';
}
function _entRenderKanban() {
 var filtered = _entFilteredSorted();
 var buckets = { aguardando:[], producao:[], transporte:[], entregue:[] };
 filtered.forEach(function(e) { buckets[_entBucketFor(e.etapa)].push(e); });
 Object.keys(_entKcId).forEach(function(bucket) {
  var col = document.getElementById(_entKcId[bucket]);
  if (!col) return;
  var body = col.querySelector('.kc-body');
  var count = col.querySelector('.kc-count');
  if (body) body.innerHTML = buckets[bucket].map(_entCardHTML).join('') || '<div style="font-size:11px;color:var(--muted);padding:8px 2px">Nenhuma entrega</div>';
  if (count) count.textContent = buckets[bucket].length;
 });
}

// ── CALENDÁRIO — antes usava _entEvents (array mockado com nomes/datas
// fictícios); agora lê _entregasArr de verdade. Único campo de data real da
// tabela é `data_faturamento` — os "3 tipos de evento" (produção/expedição/
// entrega) do mock não têm 3 campos reais por trás, então o calendário passa
// a mostrar 1 evento por entrega (na data de faturamento), colorido pelo
// status real (bucket), preservando a estrutura de grid/navegação existente.
var _entCalYear  = new Date().getFullYear();
var _entCalMonth = new Date().getMonth();
var _ptMonths = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                 'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
var _ptDows   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

// Cor do evento no Calendário por valor de Transporte (não por status) — o
// mesmo texto de transporte sempre cai na mesma cor, igual a uma coluna de
// "single select" do Airtable, onde cada opção já nasce com uma cor fixa.
// Hash determinístico numa paleta de 8 tons (não depende de ordem de
// aparição nem de armazenar nada — o mesmo valor dá a mesma cor sempre,
// mesmo depois de recarregar a página).
var _ENT_CAL_PALETTE = ['pink','cyan','orange','green','purple','blue','yellow','red','teal','gray'];
function _entTransporteColorClass(transporte) {
 var t = (transporte || '').trim();
 if (!t) return 'gray';
 var hash = 0;
 for (var i = 0; i < t.length; i++) hash = (hash * 31 + t.charCodeAt(i)) | 0;
 var idx = Math.abs(hash) % _ENT_CAL_PALETTE.length;
 return _ENT_CAL_PALETTE[idx];
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

  var filtered = _entFilteredSorted();
  var byDate = {};
  filtered.forEach(function(e) {
   if (!e.data_faturamento) return;
   (byDate[e.data_faturamento] = byDate[e.data_faturamento] || []).push(e);
  });

  var html = '';
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

  for (var i = firstDay - 1; i >= 0; i--) {
    html += '<div class="ent-cal-day other-month"><div class="ent-cal-daynum">' + (prevDays - i) + '</div></div>';
  }

  for (var d = 1; d <= daysInMonth; d++) {
    var dateStr = _entCalYear + '-'
      + String(_entCalMonth + 1).padStart(2,'0') + '-'
      + String(d).padStart(2,'0');
    var isToday = dateStr === todayStr;
    var dayEvents = byDate[dateStr] || [];

    html += '<div class="ent-cal-day' + (isToday ? ' today' : '') + '">';
    html += '<div class="ent-cal-daynum">' + d + '</div>';
    dayEvents.forEach(function(e) {
      var colorCls = _entTransporteColorClass(e.transporte);
      var label = e.nome_entrega || (e.obra && e.obra.nome) || 'Entrega';
      var shortLabel = label.length > 28 ? label.substring(0, 28) + '…' : label;
      var tTitle = label + (e.transporte ? (' — ' + e.transporte) : '');
      html += '<div class="ent-cal-event ent-cal-event-' + colorCls + '" title="' + tTitle.replace(/"/g,'&quot;') + '" onclick="event.stopPropagation();_spEntregaById(\'' + e.id + '\')">' + shortLabel + '</div>';
    });
    html += '</div>';
  }

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
function _spEntregaById(id) {
 if (!id) return;
 // Chamada direta (card de Kanban/evento de calendário), sem passar por
 // _spOpen — precisa se anunciar pra pilha de navegação (ver
 // _spTrackDirectOpen em side-panel.js) ANTES do atalho de cache abaixo,
 // já que na prática é esse atalho que roda quando vem do Kanban/
 // calendário (a lista já está carregada em memória).
 if (typeof _spTrackDirectOpen === 'function') _spTrackDirectOpen('entregas', id);
 var e = (_entregasArr || []).find(function(x){ return String(x.id) === String(id); });
 if (e) { _spEntregaRender(e); return; }

 _spSet('Entrega', 'Carregando...', '<div style="padding:40px;text-align:center;color:var(--muted)">Buscando dados...</div>', '');
 document.getElementById('sp-overlay').classList.add('sp-open');
 document.getElementById('sp-drawer').classList.add('sp-open');
 if (!_sb) return;
 _sb.from('entregas').select('*, obra:obra_id(nome, cidade, estado, tipo_obra, empresas_obras(empresa:empresa_id(nome)))').eq('id', id).single().then(function(res) {
  if (res.error || !res.data) {
   _spSet('Entrega', 'Erro', '<div style="color:var(--red);padding:20px">Entrega não encontrada.</div>', '');
   return;
  }
  _spEntregaRender(res.data);
 });
}

function _spEntregaRender(e) {
 var bucket    = _entBucketFor(e.etapa);
 var atrasado  = _entIsLate(e);
 var titulo    = e.nome_entrega || 'Entrega';
 var obraNome  = (e.obra && e.obra.nome) || '';
 var obraId    = e.obra_id || '';
 var cidadeUf  = _entCidadeUf(e);
 var transp    = e.transporte || '';
 var qtd       = e.quantidade != null ? e.quantidade : '';
 var peso      = e.peso_kg != null ? e.peso_kg : '';
 // Formato dd/mm/aaaa (pt-BR) — antes exibia o ISO cru (aaaa-mm-dd) vindo
 // direto da coluna. Meio-dia UTC evita o "dia -1" causado por fuso quando
 // o navegador interpreta a data como UTC (mesmo truque usado em _entRowHTML).
 var dtFatFmt  = e.data_faturamento ? new Date(e.data_faturamento + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
 var pedMila   = e.pedido_compusa_milatec || '';
 var pedMilaG  = e.pedido_compusa_mila || '';
 var maiorPeca = e.maior_peca_mm != null ? e.maior_peca_mm : '';

 // Transporte — virou select buscável/criável (mesmo padrão já usado no
 // formulário de criação da entrega, "entTransporte"), em vez de texto
 // livre. Kind próprio ("entDetTransporte") em vez de reaproveitar
 // "entTransporte": esta tela pode ser aberta sem o painel de Obra jamais
 // ter sido renderizado (ex.: a partir da lista/Kanban/Calendário de
 // Entregas), então não dá pra depender do registro que _spObraRender faz.
 _srchSelRegister('entDetTransporte', {
  options: function(){ return _obraTransporteCache || []; }, creatable: true, placeholder: 'Selecione o transporte...',
  onOpen: _obraCarregarTransportes,
  onSelect: function(v) {
   if (v && (_obraTransporteCache||[]).indexOf(v) === -1) _obraTransporteCache.push(v);
   _spEntDetSalvarCampo(e.id, { transporte: v || null });
  },
 });

 _spSet('Entrega', titulo, `
  <div class="sp-field"><div class="sp-label">Entrega</div>
   <input class="sp-inp" value="${titulo.replace(/"/g,'&quot;')}" readonly>
  </div>
  <div class="sp-field"><div class="sp-label">Obra / Cliente</div>
   <input class="sp-inp" value="${(obraNome||'—').replace(/"/g,'&quot;')}" readonly style="opacity:.75">
  </div>
  <div class="sp-g2">
   <div class="sp-field"><div class="sp-label">Faturamento</div>
    <input class="sp-inp" value="${dtFatFmt}" readonly style="opacity:.75">
   </div>
   <div class="sp-field"><div class="sp-label">Cidade/UF</div>
    <input class="sp-inp" value="${cidadeUf}" readonly style="opacity:.75">
   </div>
  </div>
  <div class="sp-g2">
   <div class="sp-field"><div class="sp-label">Transporte</div>
    ${_srchSelMarkup('entDetTransporte', 'sp-entdet-transporte', transp)}
   </div>
   <div class="sp-field"><div class="sp-label">Peso (kg)</div>
    <input class="sp-inp" type="number" value="${peso}">
   </div>
  </div>
  <div class="sp-g2">
   <div class="sp-field"><div class="sp-label">Qtd. (peças)</div>
    <input class="sp-inp" type="number" value="${qtd}">
   </div>
   <div class="sp-field"><div class="sp-label">Maior peça (mm)</div>
    <input class="sp-inp" type="number" value="${maiorPeca}">
   </div>
  </div>
  <div class="sp-g2">
   <div class="sp-field"><div class="sp-label">Pedido Milatec</div>
    <input class="sp-inp" value="${pedMila}" readonly style="opacity:.6">
   </div>
   <div class="sp-field"><div class="sp-label">Pedido Mila</div>
    <input class="sp-inp" value="${pedMilaG}" readonly style="opacity:.6">
   </div>
  </div>
  <div class="sp-field">
   <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:var(--text)">
    <input type="checkbox" id="sp-entdet-produzido" ${e.pedido_produzido ? 'checked' : ''} onchange="_spEntDetSalvarCampo('${e.id}', { pedido_produzido: this.checked })">
    Pedido produzido
   </label>
  </div>
  <div class="sp-field"><div class="sp-label">Status</div>
   <select class="sp-inp">
    <option ${bucket==='aguardando'?'selected':''}>${e.etapa && bucket==='aguardando' ? e.etapa : 'Aguardando produção'}</option>
    <option ${bucket==='producao'?'selected':''}>${e.etapa && bucket==='producao' ? e.etapa : 'Em produção'}</option>
    <option ${bucket==='transporte'?'selected':''}>Em transporte</option>
    <option ${bucket==='entregue'?'selected':''}>Entrega realizada</option>
   </select>
   ${atrasado ? '<div style="margin-top:6px;font-size:11px;font-weight:600;color:var(--red)">⚠ Faturamento vencido (atrasado)</div>' : ''}
  </div>
  <div style="margin-top:20px;border-top:1px solid var(--border);padding-top:16px">
   <div style="font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;margin-bottom:10px">Obra vinculada</div>
   <div class="sp-rel-chips-wrap">${obraId ? _spRelChipHTML('obras', obraId, obraNome || 'Obra') : '<div class="sp-empty">Nenhuma obra vinculada a esta entrega.</div>'}</div>
  </div>
  <div style="margin-top:20px;border-top:1px solid var(--border);padding-top:16px">
   <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
    <div style="font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.5px;text-transform:uppercase">Projeto(s) da obra</div>
    ${obraId ? '<button type="button" class="btn btn-ghost" style="padding:2px 8px;font-size:11px" onclick="_entProjToggleForm(\'' + obraId + '\')">+ Adicionar projeto</button>' : ''}
   </div>
   <div class="sp-rel-chips-wrap" id="sp-ent-proj-chips">${obraId ? '<div class="sp-empty" style="padding:4px 0;font-size:11px">Carregando...</div>' : '<div class="sp-empty">Sem obra vinculada.</div>'}</div>
   <div id="ent-proj-form-box" style="display:none;margin-top:10px"></div>
  </div>
  <div style="margin-top:20px;border-top:1px solid var(--border);padding-top:16px">
   <div style="font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;margin-bottom:10px">Documentos da entrega</div>
   <div id="sp-ent-doc-wrap"><div class="sp-empty" style="padding:10px 0;font-size:11px">Carregando documentos...</div></div>
  </div>`,
  '<button class="btn btn-ghost" onclick="closePanel()">Fechar</button>');

 _spCarregarDocumentosEntrega(e.id, obraId);
 if (obraId) _spCarregarProjetosEntrega(obraId, (e.obra && e.obra.tipo_obra) || []);
}

// ── Projeto(s) da obra, vistos de dentro do painel de Entrega — pedido
// explícito: faltava a opção de adicionar um projeto por aqui, e a
// criação deve seguir o MESMO modelo já usado no passo 4 do wizard de
// Nova Obra (_noProjRender) — inclusive a regra de o tipo do projeto só
// poder ser um dos tipos já marcados pra obra (_NO_TIPO_COR/pills), não
// qualquer um dos 5. Reaproveita os vocabulários/globais do wizard
// (_NO_PROJETO_ETAPA_OPCOES, _NO_TIPOLOGIA_TELHADO_OPCOES,
// _NO_TIPO_TELHA_OPCOES, _noProdutosDisponiveis) — carregados globalmente
// mesmo a entrega abrindo sem o painel de Obra ter sido renderizado.
async function _spCarregarProjetosEntrega(obraId, tipoObraOpcoes) {
 var wrap = document.getElementById('sp-ent-proj-chips');
 if (!wrap || !_sb) return;
 var res = await _sb.from('projetos').select('id,nome').eq('obra_id', obraId).order('created_at');
 wrap = document.getElementById('sp-ent-proj-chips'); // painel pode ter trocado enquanto a busca corria
 if (!wrap) return;
 if (res.error) { wrap.innerHTML = '<div class="sp-empty">Erro ao carregar projetos.</div>'; return; }
 var lista = res.data || [];
 wrap.innerHTML = lista.length
  ? lista.map(function(p){ return _spRelChipHTML('projetos', p.id, p.nome || 'Projeto sem nome'); }).join('')
  : '<div class="sp-empty">Nenhum projeto vinculado a esta obra ainda.</div>';
 wrap.dataset.tipoObra = JSON.stringify(tipoObraOpcoes || []);
}

var _entNovoProj = null;
function _entProjToggleForm(obraId) {
 var box = document.getElementById('ent-proj-form-box');
 if (!box) return;
 var abrir = box.style.display === 'none' || !box.style.display;
 if (abrir) {
  var chipsWrap = document.getElementById('sp-ent-proj-chips');
  var tipoObraOpcoes = [];
  try { tipoObraOpcoes = JSON.parse((chipsWrap && chipsWrap.dataset.tipoObra) || '[]'); } catch(e) {}
  _entNovoProj = {
   obraId: obraId, nome: '', etapaProjeto: '', tipoObra: tipoObraOpcoes.length === 1 ? tipoObraOpcoes[0] : '',
   produtoNomes: [], responsavelEmails: [], qtd: '', vuni: '', m2Arquitetura: '', m2Estrutura: '',
   tipologiaTelhado: [], tipologiaTelha: [], descritivo: '', tipoObraOpcoes: tipoObraOpcoes,
  };
  box.innerHTML = _entProjFormHTML();
  box.style.display = 'block';
  if (typeof _loadUsuariosCache === 'function') _loadUsuariosCache().then(function(){ box.innerHTML = _entProjFormHTML(); });
  if (typeof _respLoadUsers === 'function') _respLoadUsers().then(function(){ box.innerHTML = _entProjFormHTML(); }).catch(function(){});
  if (typeof _loadAvatarCacheFast === 'function') _loadAvatarCacheFast().then(function(){ box.innerHTML = _entProjFormHTML(); }).catch(function(){});
  if (!_produtosArr.length && _sb) {
   _sb.from('produtos').select('id,nome,categoria').order('nome').then(function(r){ _produtosArr = r.data || []; box.innerHTML = _entProjFormHTML(); });
  }
 } else {
  box.style.display = 'none';
  box.innerHTML = '';
  _entNovoProj = null;
 }
}
function _entProjSet(field, value) {
 if (!_entNovoProj) return;
 _entNovoProj[field] = value;
 if (field === 'tipoObra') {
  var box = document.getElementById('ent-proj-form-box');
  if (box) box.innerHTML = _entProjFormHTML();
 }
}
function _entProjFormHTML() {
 var p = _entNovoProj;
 if (!p) return '';
 var produtosDisponiveis = (typeof _noProdutosDisponiveis === 'function') ? _noProdutosDisponiveis(p.tipoObra) : (_produtosArr || []);
 // Padronizado com o dropdown buscável já usado em Etapa/Cidade/UF/Canal —
 // pedido explícito de consistência visual entre todos os selects do
 // sistema, com busca. Substitui as pills coloridas usadas antes aqui.
 _srchSelRegister('entProjTipo', {
  options: p.tipoObraOpcoes || [], placeholder: 'Selecione o tipo...',
  onSelect: function(v) { _entProjSet('tipoObra', v); },
 });
 var html = '<div style="border:1px solid var(--border);border-radius:10px;padding:14px;background:var(--surface2);display:flex;flex-direction:column;gap:12px">';
 html += '<div class="modal-grid col2" style="gap:12px">'
  + '<div class="mf" style="margin:0"><label style="font-size:11px">Nome do projeto <span class="req">*</span></label>'
  + '<input class="sp-inp" style="font-size:12px;text-transform:uppercase" value="' + (p.nome||'') + '" oninput="_upperCaseInput(this);_entProjSet(\'nome\',this.value)"></div>'
  + '<div class="mf" style="margin:0"><label style="font-size:11px">Etapa do projeto <span class="req">*</span></label>'
  + '<select class="sp-inp" style="font-size:12px" onchange="_entProjSet(\'etapaProjeto\',this.value)">'
  + '<option value="">Selecione...</option>'
  + (_NO_PROJETO_ETAPA_OPCOES||[]).map(function(et){ return '<option' + (et===p.etapaProjeto?' selected':'') + '>' + et + '</option>'; }).join('')
  + '</select></div>'
  + '</div>';
 // Opções restritas aos tipos já marcados pra obra (pedido explícito,
 // mesma regra do wizard) — não usa _NO_TIPOS_OPCOES inteiro.
 html += '<div class="mf" style="margin:0"><label style="font-size:11px">Tipo de obra do projeto <span class="req">*</span></label>'
  + '<div style="margin-top:6px">' + _srchSelMarkup('entProjTipo', 'ent-proj-tipo', p.tipoObra) + '</div></div>';
 html += '<div class="modal-grid col2" style="gap:12px">'
  + '<div class="mf" style="margin:0"><label style="font-size:11px">Produto <span class="req">*</span></label>'
  + '<div id="ent-proj-produto-dd" class="no-msel-wide" style="margin-top:4px">' + _msRenderDropdown('entProjProduto', produtosDisponiveis.map(function(pr){return pr.nome;}), p.produtoNomes, '_entProjMultiToggle', 'Selecione o(s) produto(s)...') + '</div></div>'
  + '<div class="mf" style="margin:0"><label style="font-size:11px">Responsável <span class="req">*</span></label>'
  + '<div id="ent-proj-resp-dd" class="no-msel-wide" style="margin-top:4px">' + _entProjRespDropdownMarkup() + '</div></div>'
  + '</div>';
 html += '<div class="modal-grid col2" style="gap:12px">'
  + '<div class="mf" style="margin:0"><label style="font-size:11px">Tipologia do Telhado</label>'
  + '<div id="ent-proj-telhado-dd" class="no-msel-wide" style="margin-top:4px">' + _msRenderDropdown('entProjTelhado', _NO_TIPOLOGIA_TELHADO_OPCOES||[], p.tipologiaTelhado, '_entProjMultiToggle', 'Selecione a(s) tipologia(s)...') + '</div></div>'
  + '<div class="mf" style="margin:0"><label style="font-size:11px">Tipo de Telha</label>'
  + '<div id="ent-proj-telha-dd" class="no-msel-wide" style="margin-top:4px">' + _msRenderDropdown('entProjTelha', _NO_TIPO_TELHA_OPCOES||[], p.tipologiaTelha, '_entProjMultiToggle', 'Selecione o(s) tipo(s)...') + '</div></div>'
  + '</div>';
 html += '<div class="modal-grid col2" style="gap:12px">'
  + '<div class="mf" style="margin:0"><label style="font-size:11px">Quantidade</label>'
  + '<input class="sp-inp" style="font-size:12px" type="number" min="0" value="' + (p.qtd||'') + '" oninput="_entProjSet(\'qtd\',this.value)"></div>'
  + '<div class="mf" style="margin:0"><label style="font-size:11px">Valor unit. (R$)</label>'
  + '<input class="sp-inp" style="font-size:12px" type="text" value="' + (p.vuni||'') + '" oninput="_entProjSet(\'vuni\',this.value)"></div>'
  + '</div>';
 html += '<div class="modal-grid col2" style="gap:12px">'
  + '<div class="mf" style="margin:0"><label style="font-size:11px">M² Arquitetura</label>'
  + '<div style="position:relative"><input class="sp-inp" style="font-size:12px;padding-right:30px" type="number" min="0" step="0.01" value="' + (p.m2Arquitetura||'') + '" oninput="_entProjSet(\'m2Arquitetura\',this.value)">'
  + '<span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:11px;color:var(--muted);pointer-events:none">m²</span></div></div>'
  + '<div class="mf" style="margin:0"><label style="font-size:11px">M² Estrutura</label>'
  + '<div style="position:relative"><input class="sp-inp" style="font-size:12px;padding-right:30px" type="number" min="0" step="0.01" value="' + (p.m2Estrutura||'') + '" oninput="_entProjSet(\'m2Estrutura\',this.value)">'
  + '<span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:11px;color:var(--muted);pointer-events:none">m²</span></div></div>'
  + '</div>';
 html += '<div class="mf" style="margin:0"><label style="font-size:11px">Descritivo do projeto</label>'
  + '<textarea class="sp-inp" style="font-size:12px;height:56px" oninput="_entProjSet(\'descritivo\',this.value)">' + (p.descritivo||'') + '</textarea></div>';
 html += '<div style="display:flex;gap:8px">'
  + '<button type="button" onclick="_entProjSalvar()" style="font-size:12px;font-weight:600;padding:7px 16px;border:none;border-radius:7px;background:var(--green);color:#fff;cursor:pointer">Salvar projeto</button>'
  + '<button type="button" onclick="_entProjToggleForm(\'' + p.obraId + '\')" style="font-size:12px;padding:7px 16px;border:1px solid var(--border);border-radius:7px;background:transparent;color:var(--muted);cursor:pointer">Cancelar</button>'
  + '</div>';
 html += '</div>';
 return html;
}
function _entProjMultiToggle(campo, valor, checked) {
 if (!_entNovoProj) return;
 var field = campo === 'entProjProduto' ? 'produtoNomes' : campo === 'entProjTelhado' ? 'tipologiaTelhado' : 'tipologiaTelha';
 _entNovoProj[field] = _msToggle(_entNovoProj[field], valor, checked);
 var ddId = campo === 'entProjProduto' ? 'ent-proj-produto-dd' : campo === 'entProjTelhado' ? 'ent-proj-telhado-dd' : 'ent-proj-telha-dd';
 var opcoes = campo === 'entProjProduto'
  ? ((typeof _noProdutosDisponiveis === 'function' ? _noProdutosDisponiveis(_entNovoProj.tipoObra) : _produtosArr).map(function(pr){return pr.nome;}))
  : campo === 'entProjTelhado' ? (_NO_TIPOLOGIA_TELHADO_OPCOES||[]) : (_NO_TIPO_TELHA_OPCOES||[]);
 var wrap = document.getElementById(ddId);
 if (wrap) {
  wrap.innerHTML = _msRenderDropdown(campo, opcoes, _entNovoProj[field], '_entProjMultiToggle', 'Selecione...');
  var painel = wrap.querySelector('.fb-msel-panel');
  if (painel) painel.classList.add('open');
 }
}
function _entProjRespDropdownMarkup() {
 var p = _entNovoProj;
 var usuarios = _usuariosCache || [];
 var sel = (p && p.responsavelEmails) || [];
 var normalizar = (typeof _ssNormalize === 'function') ? _ssNormalize : function(s){ return (s||'').toLowerCase(); };
 var selNomes = sel.map(function(email){
  var u = usuarios.find(function(x){ return x.email === email; });
  return (u && u.nome_display) || email;
 });
 var btnLabel = (typeof _msBtnLabel === 'function') ? _msBtnLabel(selNomes, 'Selecione o(s) responsável(is)...') : (sel.length ? selNomes.join(', ') : 'Selecione o(s) responsável(is)...');
 var searchHtml = usuarios.length > 0 ? '<input type="text" class="fb-msel-search" placeholder="Pesquisar..." oninput="_msFiltrarDOM(this)">' : '';
 var itemsHtml = usuarios.map(function(u) {
  var label = u.nome_display || u.email;
  var emailEsc = String(u.email).replace(/"/g,'&quot;');
  var ck = sel.indexOf(u.email) !== -1 ? ' checked' : '';
  var avatarHtml = (typeof _userAvatarByName === 'function') ? _userAvatarByName(label, 20) : '';
  return '<label class="fb-msel-item" data-norm="' + normalizar(label) + '"><input type="checkbox" value="' + emailEsc + '"' + ck
   + ' onchange="_entProjRespToggle(this.value,this.checked)">' + avatarHtml + '<span>' + label.replace(/</g,'&lt;') + '</span></label>';
 }).join('');
 return '<div class="fb-msel-wrap">'
  + '<button type="button" class="fb-msel-btn" onclick="this.nextElementSibling.classList.toggle(\'open\')">' + btnLabel + '</button>'
  + '<div class="fb-msel-panel">' + searchHtml + '<div class="fb-msel-list">' + (itemsHtml || '<div style="padding:8px;font-size:11px;color:var(--muted)">Nenhum usuário cadastrado</div>') + '</div></div>'
  + '</div>';
}
function _entProjRespToggle(email, checked) {
 if (!_entNovoProj) return;
 _entNovoProj.responsavelEmails = _msToggle(_entNovoProj.responsavelEmails, email, checked);
 var wrap = document.getElementById('ent-proj-resp-dd');
 if (wrap) {
  wrap.innerHTML = _entProjRespDropdownMarkup();
  var painel = wrap.querySelector('.fb-msel-panel');
  if (painel) painel.classList.add('open');
 }
}
async function _entProjSalvar() {
 var p = _entNovoProj;
 if (!p) return;
 var faltando = [];
 if (!(p.nome||'').trim()) faltando.push('Nome');
 if (!p.etapaProjeto) faltando.push('Etapa do projeto');
 if (!p.tipoObra) faltando.push('Tipo de obra');
 if (!p.produtoNomes.length) faltando.push('Produto');
 if (!p.responsavelEmails.length) faltando.push('Responsável');
 if (faltando.length) { _showToast('Preencha: ' + faltando.join(', '), 'aviso'); return; }
 var payload = {
  nome: (p.nome||'').trim().toUpperCase(), obra_id: p.obraId, tipo_orcamento: p.tipoObra,
  etapa_projeto: p.etapaProjeto, produto: p.produtoNomes, responsavel: p.responsavelEmails,
  quantidade: p.qtd || null, valor_unitario: p.vuni ? parseFloat(String(p.vuni).replace(/\./g,'').replace(',','.')) || null : null,
  m2_arquitetura: p.m2Arquitetura || null, m2_estrutura: p.m2Estrutura || null,
  tipologia_telhado: p.tipologiaTelhado, tipologia_telha: p.tipologiaTelha,
  descritivo: p.descritivo || null,
 };
 var res = await _sb.from('projetos').insert(payload).select('id,nome').single();
 if (res.error) { _showToast('Erro ao criar projeto: ' + res.error.message, 'erro'); return; }
 _showToast('Projeto criado com sucesso!', 'ok');
 _entProjToggleForm(p.obraId);
 _spCarregarProjetosEntrega(p.obraId, p.tipoObraOpcoes);
}

// ── Atualização pontual de um campo da entrega (Transporte/Pedido produzido)
// — autosave imediato ao selecionar/marcar, sem botão "Salvar" (o painel de
// Entrega nunca teve esse fluxo; ver header do arquivo). Atualiza também o
// cache local (_entregasArr) para a Tabela/Kanban/Calendário refletirem sem
// precisar recarregar tudo do banco.
async function _spEntDetSalvarCampo(entregaId, patch) {
 if (!_sb || !entregaId) return;
 const { error } = await _sb.from('entregas').update(patch).eq('id', entregaId);
 if (error) { alert('Erro ao salvar: ' + (error.message || '')); return; }
 var cached = (_entregasArr || []).find(function(x){ return String(x.id) === String(entregaId); });
 if (cached) Object.assign(cached, patch);
 if (typeof _entApplyFilters === 'function') _entApplyFilters();
}

// ── Documentos da entrega — 4 categorias reais do formulário do Airtable
// (Nota Fiscal / Romaneio de Entrega / Documentos Específicos da Entrega /
// Ordem de Produção). O acervo migrado do Airtable NUNCA preencheu
// documentos.entrega_id (auditoria: 0 linhas com entrega_id nessas 4 tipos)
// — o vínculo real daquela época está só na tabela de junção
// `documentos_entregas` (documento_id, entrega_id). Uploads novos feitos
// pelo sistema (_spUploadDocEntrega) gravam entrega_id direto, sem usar a
// junção. Por isso a carga busca dos DOIS jeitos e faz merge por id.
var _entDetDocCats = [
 { tipo: 'nota_fiscal',          label: 'Nota Fiscal' },
 { tipo: 'romaneio_entrega',     label: 'Romaneio de Entrega' },
 { tipo: 'documento_especifico', label: 'Documentos Específicos da Entrega' },
 { tipo: 'ordem_producao',       label: 'Ordem de Produção' },
];
// Uploads feitos pelo formulário "Nova entrega" (obras.js) usam rótulos em
// português ('Documento da Entrega'/'Ordem de Produção') em vez do
// snake_case canônico — aliases para cair na mesma categoria.
var _entDetDocTipoAlias = { 'Documento da Entrega': 'documento_especifico', 'Ordem de Produção': 'ordem_producao' };
function _entDocCategoriaDe(tipo) {
 if (!tipo) return 'documento_especifico';
 if (_entDetDocCats.some(function(c){ return c.tipo === tipo; })) return tipo;
 return _entDetDocTipoAlias[tipo] || 'documento_especifico';
}

async function _spCarregarDocumentosEntrega(entregaId, obraId) {
 var container = document.getElementById('sp-ent-doc-wrap');
 if (!container || !_sb) return;
 var [diretoRes, viaJuncaoRes] = await Promise.all([
  _sb.from('documentos').select('*').eq('entrega_id', entregaId),
  _sb.from('documentos_entregas').select('documentos(*)').eq('entrega_id', entregaId),
 ]);
 if (diretoRes.error && viaJuncaoRes.error) {
  container.innerHTML = '<div class="sp-empty" style="font-size:11px;color:var(--red)">Erro ao carregar documentos.</div>';
  return;
 }
 var vistos = {};
 var docs = [];
 (diretoRes.data || []).forEach(function(d) { if (!vistos[d.id]) { vistos[d.id] = 1; docs.push(d); } });
 (viaJuncaoRes.data || []).forEach(function(row) { var d = row.documentos; if (d && !vistos[d.id]) { vistos[d.id] = 1; docs.push(d); } });

 var grupos = {};
 _entDetDocCats.forEach(function(c) { grupos[c.tipo] = []; });
 docs.forEach(function(d) { grupos[_entDocCategoriaDe(d.tipo)].push(d); });
 Object.keys(grupos).forEach(function(k) { grupos[k].sort(function(a,b) { return new Date(b.created_at) - new Date(a.created_at); }); });

 container.innerHTML = _entDetDocCats.map(function(c) { return _spEntDetCategoriaHTML(c, grupos[c.tipo], entregaId, obraId); }).join('');
}

function _spEntDetCategoriaHTML(cat, docs, entregaId, obraId) {
 var listHtml = docs.length
  ? docs.map(function(d) {
     var nome = (d.nome || d.nome_arquivo || 'Documento').toString();
     var dt = d.created_at ? new Date(d.created_at).toLocaleDateString('pt-BR') : '';
     var pathSafe = String(d.caminho_storage || '').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
     var nomeAttrSafe = nome.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
     // Acervo migrado do Airtable foi enviado direto pro bucket
     // `documentos_entregas` (não `documentos_obras`, onde os uploads NOVOS
     // caem via _spUploadDocEntrega) — sem essa distinção o signed URL
     // saía sempre pro bucket errado e a Storage retornava "Object not
     // found" pra qualquer NF/romaneio antigo (nunca chegava a checar
     // permissão de verdade, o objeto nem existe naquele bucket).
     var bucket = d.origem === 'airtable_importado' ? 'documentos_entregas' : 'documentos_obras';
     return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 10px;border:1px solid var(--border);border-radius:6px;margin-bottom:6px;background:var(--surface)">'
      + '<div style="min-width:0">'
      + '<div style="font-size:11px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:230px" title="' + nome.replace(/"/g,'&quot;') + '">' + nome + '</div>'
      + (dt ? '<div style="font-size:9px;color:var(--muted);margin-top:2px">' + dt + '</div>' : '')
      + '</div>'
      + '<button type="button" class="btn btn-ghost btn-sm" onclick="_spAbrirDocStorage(\'' + pathSafe + '\',\'' + nomeAttrSafe + '\',\'' + bucket + '\')">Visualizar</button>'
      + '</div>';
    }).join('')
  : '<div class="sp-empty" style="padding:8px 0;font-size:11px">Nenhum documento enviado.</div>';

 var inputId = 'sp-entdet-up-' + cat.tipo;
 var labelId = inputId + '-lbl';
 return '<div style="margin-bottom:16px">'
  + '<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">' + cat.label + (docs.length ? ' (' + docs.length + ')' : '') + '</div>'
  + listHtml
  + _spEntDetDropzone(inputId, labelId, entregaId, obraId, cat.tipo)
  + '</div>';
}

// Dropzone com upload imediato (sem etapa de "confirmar anexo" — diferente
// do dropzone do formulário de criação, aqui não existe mais um "Salvar"
// geral pra piggyback, então o próprio anexo já dispara o upload).
function _spEntDetDropzone(inputId, labelId, entregaId, obraId, tipo) {
 return '<label style="display:flex;align-items:center;justify-content:center;gap:6px;border:2px dashed var(--border);border-radius:8px;padding:9px 8px;cursor:pointer;transition:border-color .15s,background .15s;text-align:center;font-size:11px;color:var(--muted)"'
  + ' onmouseover="this.style.borderColor=\'var(--navy)\';this.style.background=\'rgba(59,130,246,.04)\'"'
  + ' onmouseout="this.style.borderColor=\'var(--border)\';this.style.background=\'\'"'
  + ' ondragover="event.preventDefault();this.style.borderColor=\'var(--navy)\';this.style.background=\'rgba(59,130,246,.07)\'"'
  + ' ondragleave="this.style.borderColor=\'var(--border)\';this.style.background=\'\'"'
  + ' ondrop="_spEntDetFileDrop(event,\'' + entregaId + '\',\'' + (obraId||'') + '\',\'' + tipo + '\',\'' + labelId + '\')">'
  + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.7"><path d="M12 16V8M8 12l4-4 4 4"/><path d="M20 16.5A4.5 4.5 0 0015.5 12H15a6 6 0 10-11.8 1.5"/></svg>'
  + '<span id="' + labelId + '">Clique ou arraste para anexar</span>'
  + '<input type="file" id="' + inputId + '" multiple style="display:none" onchange="_spEntDetFileChange(this,\'' + entregaId + '\',\'' + (obraId||'') + '\',\'' + tipo + '\',\'' + labelId + '\')">'
  + '</label>';
}
async function _spEntDetUploadFiles(files, entregaId, obraId, tipo, labelId) {
 if (!files || !files.length) return;
 var lbl = document.getElementById(labelId);
 if (lbl) lbl.textContent = 'Enviando...';
 var erros = 0;
 for (var i = 0; i < files.length; i++) { if (!(await _spUploadDocEntrega(files[i], entregaId, obraId || null, tipo))) erros++; }
 if (erros) alert(erros + ' arquivo(s) não enviado(s). Tente novamente.');
 _spCarregarDocumentosEntrega(entregaId, obraId);
}
function _spEntDetFileChange(input, entregaId, obraId, tipo, labelId) {
 _spEntDetUploadFiles(Array.prototype.slice.call(input.files || []), entregaId, obraId, tipo, labelId);
 input.value = '';
}
function _spEntDetFileDrop(event, entregaId, obraId, tipo, labelId) {
 event.preventDefault();
 var dz = event.currentTarget; dz.style.borderColor = 'var(--border)'; dz.style.background = '';
 var files = event.dataTransfer && event.dataTransfer.files;
 _spEntDetUploadFiles(Array.prototype.slice.call(files || []), entregaId, obraId, tipo, labelId);
}

// ── Linha da Tabela — extraída em função própria pra ser reaproveitada tanto
// pela carga inicial (_dbLoadEntregas) quanto pelo rebuild flat (saindo do
// modo agrupado) e pelo rebuild agrupado (_entRenderGroupNode), mesmo padrão
// de _empRowHTML em empresas.js. ────────────────────────────────────────────
function _entRowHTML(e) {
 var bucket    = _entBucketFor(e.etapa);
 var atrasado  = _entIsLate(e);
 var cor       = atrasado ? _entBucketCor.atrasado : _entBucketCor[bucket];
 var statusTxt = e.etapa || _entBucketLabel[bucket];
 var obraNome  = (e.obra && e.obra.nome) || '';
 var empNome   = (e.obra && e.obra.empresas_obras && e.obra.empresas_obras[0] && e.obra.empresas_obras[0].empresa && e.obra.empresas_obras[0].empresa.nome) || '';
 var cidadeUf  = _entCidadeUf(e);
 var ds = _entPseudoDataset(e);
 var attrs = Object.keys(ds).map(function(k) {
  var attrName = k.replace(/([A-Z])/g, '-$1').toLowerCase();
  return ' data-' + attrName + '="' + String(ds[k]).replace(/"/g,'&quot;') + '"';
 }).join('');
 return '<tr onclick="if(!event.target.closest(\'button,a,input,select\'))_spOpen(\'entregas\',this)"'
  + ' data-id="' + e.id + '" data-atrasado="' + (atrasado ? '1' : '0') + '"' + attrs + '>'
  + '<td><div style="font-weight:600;font-size:13px">' + (e.nome_entrega || 'Entrega sem nome') + '</div>'
  + '<div style="font-size:11px;color:var(--muted);margin-top:2px">' + (obraNome ? (empNome ? empNome + ' — ' : '') + obraNome : 'Obra não vinculada') + '</div></td>'
  + '<td style="font-size:12px;color:var(--muted)">' + (cidadeUf || '—') + '</td>'
  + '<td><span class="ent-date' + (atrasado ? ' overdue' : '') + '">' + (e.data_faturamento ? new Date(e.data_faturamento+'T00:00:00').toLocaleDateString('pt-BR') : '—') + '</span></td>'
  + '<td style="font-size:12px;color:var(--muted)">' + (e.transporte || '—') + '</td>'
  + '<td style="text-align:right;font-size:12px;color:var(--muted)">' + (e.peso_kg != null ? Number(e.peso_kg).toLocaleString('pt-BR') : '—') + '</td>'
  + '<td><div class="ent-status"><span class="ent-status-dot" style="background:' + cor + '"></span>' + statusTxt + (atrasado ? ' <span class="ent-late-tag">Atrasado</span>' : '') + '</div></td>'
  + '<td><button class="btn btn-ghost btn-sm">Ver →</button></td>'
  + '</tr>';
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
   .select('*, obra:obra_id(nome, cidade, estado, tipo_obra, empresas_obras(empresa:empresa_id(nome)))')
   .order('created_at', { ascending: false })
   .range(from, from + pageSize - 1);
  if (res.error) { error = res.error; break; }
  data = data.concat(res.data || []);
  if (!res.data || res.data.length < pageSize) break;
  from += pageSize;
 }
 // Cache global por id — usado por _spEntregaById pra abrir o painel de
 // Entrega a partir de um chip clicado em OUTRA entidade (ex.: Obra), e pelas
 // vistas Kanban/Calendário/agrupada, todas lendo direto deste array.
 _entregasArr = data || [];
 // Badge do menu lateral: ver _navBadgesLoadInitial() (RPC de contagem).
 if (error || !data?.length) return;
 var groupLevels = (_gbInstances.entregas && _gbInstances.entregas.state.levels) || [];
 if (groupLevels.length) { _entRenderGrouped(groupLevels); return; }
 const tbody = document.getElementById('ent-tbody');
 if (!tbody) return;
 tbody.innerHTML = data.map(_entRowHTML).join('');
 var totalEl = document.getElementById('ent-total-count');
 if (totalEl) totalEl.textContent = data.length + (data.length === 1 ? ' registro' : ' registros');
 _entRenderKanbanIfVisible();
 _entRenderCalIfVisible();
}
