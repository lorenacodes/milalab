// ═══════════════════════════════════════════════════════════════════════════════
// INSTALAÇÕES — criação, renderer do painel lateral, loader da lista.
// ═══════════════════════════════════════════════════════════════════════════════
// Tipos de serviço — mesma lista usada no formulário rápido de dentro de
// Obra (obras.js) e no detalhamento (_spInstalacaoRender abaixo). Hoisted
// aqui pra virar a fonte única também das opções de FILTRO (pedido
// explícito: filtro de Tipo exigia digitação, tinha que ser single-select).
var _INST_TIPO_OPCOES = ['Instalação','Montagem fábrica','Treinamento piloto','Assistência técnica'];
var _INST_STATUS_OPCOES = ['A programar','Programado','Emitir boleto de medição','Em execução','Finalizado'];

// ── NOVA INSTALAÇÃO (topo da aba Instalações) ────────────────────────────────
// Pedido explícito: botão "Nova Instalação" da aba cheia era só um alert() —
// a única forma de criar uma instalação de verdade era passando por dentro
// de uma Obra (_spToggleNovaInstalacao/_spCriarInstalacao, obras.js). Este
// formulário é o mesmo padrão (single-select Tipo/Status, datas, Equipe
// multi-select obrigatória, Dias previstos calculado), com uma diferença: a
// Obra não vem pré-definida (não se está dentro de um painel de Obra), então
// tem um campo próprio de busca+vínculo de 1 ou mais Obras (mesma relação
// N:N obras_instalacoes usada em todo o resto do módulo).
var _instNovoObraSel = [];
var _instNovoEquipeSel = [];
var _instNovoEquipesCache = null;
function openNovaInstalacao() {
 var box = document.getElementById('inst-novo-form');
 if (!box) return;
 var abrir = box.style.display === 'none';
 box.style.display = abrir ? 'block' : 'none';
 if (!abrir) return;
 _instNovoObraSel = [];
 _instNovoEquipeSel = [];
 document.getElementById('inst-novo-obra-chips').innerHTML = '<div class="sp-empty">Nenhuma obra vinculada ainda.</div>';
 _srchSelRegister('instNovoTipo', { options: _INST_TIPO_OPCOES, placeholder: 'Selecione...' });
 _srchSelRegister('instNovoStatus', { options: _INST_STATUS_OPCOES, placeholder: 'Selecione...' });
 var tipoBox = document.getElementById('inst-novo-tipo-box');
 if (tipoBox) tipoBox.innerHTML = _srchSelMarkup('instNovoTipo', 'inst-novo-tipo', '');
 var statusBox = document.getElementById('inst-novo-status-box');
 if (statusBox) statusBox.innerHTML = _srchSelMarkup('instNovoStatus', 'inst-novo-status', 'A programar');
 document.getElementById('inst-novo-inicio').value = '';
 document.getElementById('inst-novo-fim').value = '';
 document.getElementById('inst-novo-diasprog').value = '—';
 document.getElementById('inst-novo-detalhes').value = '';
 if (typeof _garantirObraIdMap === 'function') _garantirObraIdMap();
 (async function() {
  if (!_instNovoEquipesCache) {
   var res = await _sb.from('equipe_instalacao').select('id,nome').order('nome');
   _instNovoEquipesCache = res.data || [];
  }
  var dd = document.getElementById('inst-novo-equipe-dd');
  if (dd) dd.innerHTML = _msRenderDropdown('instNovoEquipe', _instNovoEquipesCache.map(function(e){return e.nome;}), _instNovoEquipeSel, '_instNovoEquipeToggle', 'Selecione a(s) equipe(s)...');
 })();
}
function _instNovoEquipeToggle(campo, valor, checked) {
 _instNovoEquipeSel = _msToggle(_instNovoEquipeSel, valor, checked);
 var dd = document.getElementById('inst-novo-equipe-dd');
 if (dd) dd.innerHTML = _msRenderDropdown('instNovoEquipe', (_instNovoEquipesCache||[]).map(function(e){return e.nome;}), _instNovoEquipeSel, '_instNovoEquipeToggle', 'Selecione a(s) equipe(s)...');
 if (typeof _noReabrirDropdown === 'function') _noReabrirDropdown('inst-novo-equipe-dd');
}
// Calcula "Nº dias programados" ao vivo (mesma fórmula do detalhamento) —
// chamado pelo onchange das datas.
function _instNovoRecalcDias() {
 var ini = document.getElementById('inst-novo-inicio').value;
 var fim = document.getElementById('inst-novo-fim').value;
 var el = document.getElementById('inst-novo-diasprog');
 if (!el) return;
 el.value = (ini && fim) ? Math.round((new Date(fim) - new Date(ini)) / 86400000) : '—';
}
function _instNovoObraBuscar(q) {
 var box = document.getElementById('inst-novo-obra-resultados');
 if (!box) return;
 var qn = (q || '').trim().toLowerCase();
 if (!qn) { box.innerHTML = ''; return; }
 var jaSel = _instNovoObraSel.map(function(o){ return o.id; });
 var mapa = _obraIdMap || {};
 var matches = Object.keys(mapa).filter(function(id) {
  return jaSel.indexOf(id) === -1 && (mapa[id].nome || '').toLowerCase().indexOf(qn) !== -1;
 }).slice(0, 8);
 box.innerHTML = matches.length
  ? matches.map(function(id) {
     return '<div style="cursor:pointer;padding:6px 8px;border:1px solid var(--border);border-radius:6px;margin-bottom:4px;font-size:12px" onmouseover="this.style.background=\'var(--surface2)\'" onmouseout="this.style.background=\'\'" onclick="_instNovoObraAdd(\'' + id + '\')">' + (mapa[id].nome || '—').replace(/</g,'&lt;') + '</div>';
    }).join('')
  : '<div class="sp-empty">Nenhuma obra encontrada.</div>';
}
function _instNovoObraAdd(id) {
 if (_instNovoObraSel.some(function(o){ return o.id === id; })) return;
 _instNovoObraSel.push({ id: id, nome: (_obraIdMap[id] || {}).nome || '—' });
 var busca = document.getElementById('inst-novo-obra-busca');
 if (busca) busca.value = '';
 document.getElementById('inst-novo-obra-resultados').innerHTML = '';
 _instNovoObraChipsRender();
}
function _instNovoObraRemove(id) {
 _instNovoObraSel = _instNovoObraSel.filter(function(o){ return o.id !== id; });
 _instNovoObraChipsRender();
}
function _instNovoObraChipsRender() {
 var wrap = document.getElementById('inst-novo-obra-chips');
 if (!wrap) return;
 wrap.innerHTML = _instNovoObraSel.length
  ? _instNovoObraSel.map(function(o){ return _spRelChipHTML('obras', o.id, o.nome, null, '_instNovoObraRemove(\'' + o.id + '\')'); }).join('')
  : '<div class="sp-empty">Nenhuma obra vinculada ainda.</div>';
}
async function _instCriarNova() {
 var tipo = document.getElementById('inst-novo-tipo')?.value || '';
 var status = document.getElementById('inst-novo-status')?.value || '';
 var inicio = document.getElementById('inst-novo-inicio')?.value || '';
 var fim = document.getElementById('inst-novo-fim')?.value || '';
 var faltando = [];
 if (!tipo) faltando.push('Tipo de Serviço');
 if (!status) faltando.push('Status');
 if (!inicio) faltando.push('Data início');
 if (!fim) faltando.push('Data fim');
 if (!_instNovoEquipeSel.length) faltando.push('Equipe de Instalação');
 if (faltando.length) { _showToast('Preencha: ' + faltando.join(', '), 'aviso'); return; }
 var payload = {
  tipo_servico: tipo, funil: status, data_inicio: inicio, data_fim: fim,
  detalhes: document.getElementById('inst-novo-detalhes')?.value?.trim() || null,
 };
 var insRes = await _sb.from('instalacoes').insert(payload).select('id').single();
 if (insRes.error || !insRes.data) {
  console.error('[Instalações] erro ao criar:', insRes.error);
  _showToast('Não foi possível criar a instalação. Nada foi salvo — confira os campos e tente de novo.', 'erro');
  return;
 }
 var novaId = insRes.data.id;
 if (_instNovoObraSel.length) {
  var obraLinks = _instNovoObraSel.map(function(o){ return { obra_id: o.id, instalacao_id: novaId }; });
  var obraLinkRes = await _sb.from('obras_instalacoes').insert(obraLinks);
  if (obraLinkRes.error) console.error('[Instalações] erro ao vincular obra(s):', obraLinkRes.error);
 }
 if (_instNovoEquipeSel.length) {
  var equipeIds = (_instNovoEquipesCache || []).filter(function(e){ return _instNovoEquipeSel.indexOf(e.nome) !== -1; }).map(function(e){ return e.id; });
  var equipeLinks = equipeIds.map(function(eid){ return { instalacao_id: novaId, equipe_id: eid }; });
  if (equipeLinks.length) {
   var equipeLinkRes = await _sb.from('instalacoes_equipe').insert(equipeLinks);
   if (equipeLinkRes.error) console.error('[Instalações] erro ao vincular equipe(s):', equipeLinkRes.error);
  }
 }
 _showToast('Instalação criada!', 'ok');
 openNovaInstalacao(); // fecha o form
 if (typeof _dbLoadInstalacoes === 'function') await _dbLoadInstalacoes();
 _spInstalacaoById(novaId);
}

// Filtro/Ordenação — mesmos componentes reutilizáveis do Gestor de Tarefas/
// Obras/Empresas (filtro-builder/sort-builder/smart-search), substituindo os
// 4 chips fixos de status (Todas/Programadas/Em andamento/Concluídas) por um
// Filtro de condições de verdade. _fbEvaluate/_sbCompare recebem tr.dataset
// direto — ver data-* adicionados no template de _instRowHTML.
var _instFbFields = [
 // Vocabulário real (mesmo campo do Airtable original, confirmado por
 // print da usuária) — a lista antiga (Programado/Planejado/Em andamento/
 // Finalizado/Cancelado) tinha 3 valores que nunca existiram nos dados
 // reais e faltava "Emitir boleto de medição", que existe.
 { key: 'funil',   label: 'Status',  type: 'select', options: _INST_STATUS_OPCOES },
 // Tipo/Obra/Cliente exigiam digitação livre (pedido explícito: os 3
 // deveriam ser single-select) — Tipo tem vocabulário fechado
 // (_INST_TIPO_OPCOES); Obra/Cliente têm lista aberta mas finita, então a
 // opção vem dinâmica dos dados já carregados (mesmo padrão do filtro de
 // Obra em projetos.js: options como function, recalculada toda vez que o
 // popover abre).
 { key: 'tipo',    label: 'Tipo',    type: 'select', options: _INST_TIPO_OPCOES },
 { key: 'obra',    label: 'Obra',    type: 'select', options: function(){ return _instOpcoesUnicas('obra'); } },
 { key: 'cliente', label: 'Cliente', type: 'select', options: function(){ return _instOpcoesUnicas('cliente'); } },
 { key: 'nome',    label: 'Nome da Instalação', type: 'text' },
 { key: 'equipe',  label: 'Equipe de Instalação', type: 'select', options: function(){ return (_instEquipesCacheFiltro || []).map(function(e){ return e.nome; }); } },
 { key: 'inicio',  label: 'Data de início', type: 'date' },
 { key: 'fim',     label: 'Data de fim',    type: 'date' },
 { key: 'diasprog', label: 'Nº dias programados', type: 'number', getValue: function(ds) { return parseFloat(ds.diasprog) || 0; } },
 { key: 'diasexec', label: 'Nº dias executados',  type: 'number', getValue: function(ds) { return parseFloat(ds.diasexec) || 0; } },
 { key: 'cidade',  label: 'Cidade (de Obras)', type: 'select', options: function(){ return _instOpcoesUnicas('cidade'); } },
 { key: 'estado',  label: 'Estado (de Obras)', type: 'select', options: function(){ return _instOpcoesUnicas('estado'); } },
 { key: 'valortotal', label: 'Despesa Total', type: 'number', getValue: function(ds) { return parseFloat(ds.valortotal) || 0; } },
];
_fbInit('instalacoes', _instFbFields, _instApplyFilters);

// Opções únicas pra filtro select dinâmico (Obra/Cliente/Cidade/Estado) — lê
// direto do <tr data-*> já renderizado na tabela (mesmo espírito das
// options() dinâmicas de projetos.js), sem precisar de outra fonte/consulta.
function _instOpcoesUnicas(campo) {
 var vals = Array.prototype.slice.call(document.querySelectorAll('#inst-tbody tr[data-id]'))
  .map(function(tr){ return tr.dataset[campo]; }).filter(Boolean);
 return Array.from(new Set(vals)).sort(function(a,b){ return a.localeCompare(b); });
}

// Cor do Status (Funil) — hoisted pra fora de _instRowHTML (antes recriado a
// cada linha) pra também ser reaproveitado pelo cabeçalho de grupo quando a
// tabela é agrupada por Status (_instRenderGroupNode). Mesmos valores/cores
// de sempre, só um lugar só agora.
var _INST_FUNIL_CLS = { 'Finalizado':'bg', 'Em execução':'bm', 'Emitir boleto de medição':'by', 'Programado':'by', 'A programar':'bp' };

var _instSbFields = [
 { key: 'nome',      label: 'Nome da Instalação',   type: 'text' },
 { key: 'obra',      label: 'Obra',    type: 'text' },
 { key: 'cliente',   label: 'Cliente', type: 'text' },
 { key: 'tipo',      label: 'Categoria do Serviço', type: 'text' },
 { key: 'inicio',    label: 'Início',  type: 'date' },
 { key: 'fim',       label: 'Fim',     type: 'date' },
 { key: 'dias',      label: 'Dias',    type: 'number', getValue: function(ds) { return parseFloat(ds.dias) || 0; } },
];
_sbInit('instalacoes', _instSbFields, _instApplyFilters);

// Agrupar — mesmo esquema de Obras/Projetos (opera sobre <tr> já existentes
// no DOM; ver comentário completo em _obrasRenderGroupNode, obras.js).
var _instGbFields = [
 { key: 'funil',   label: 'Status' },
 { key: 'tipo',    label: 'Tipo' },
 { key: 'obra',    label: 'Obra' },
 { key: 'cliente', label: 'Cliente' },
];
_gbInit('instalacoes', _instGbFields, _instApplyFilters, 3);
// Lista em memória das instalações carregadas (antes este módulo não tinha
// cache nenhum: a listagem era montada direto num `allData` local e qualquer
// atualização exigia recarregar tudo do banco). É o que permite o tempo real
// e o autosave redesenharem só a <tr> alterada.
var _instArr = [];
var _instGroupCollapsed = {};
// Cache de equipes pro FILTRO (Equipe de Instalação) — cache próprio, feito
// pra não colidir com _instEquipesCache (obras.js, form de dentro da Obra) e
// _instEquipesCacheDet (detalhamento aqui mesmo); carregado junto com a
// lista principal, sem bloquear o primeiro render da tabela.
var _instEquipesCacheFiltro = null;
async function _instCarregarEquipesCacheFiltro() {
 if (_instEquipesCacheFiltro || !_sb) return;
 var res = await _sb.from('equipe_instalacao').select('id,nome').order('nome');
 _instEquipesCacheFiltro = res.data || [];
}
function _instToggleGroup(key) {
 _instGroupCollapsed[key] = !_instGroupCollapsed[key];
 _instApplyFilters();
}
function _instRenderGroupNode(node, path, tbody, forceHidden) {
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
  var isCollapsed = !!_instGroupCollapsed[pathKey];
  var visCount = _gtTreeCount(child, function(tr){ return tr.style.display !== 'none'; });
  var indent = 12 + path.length * 20;
  var hd = document.createElement('tr');
  hd.className = _gtGroupClass(path.length) + ' inst-group-row';
  hd.style.position = 'static';
  hd.onclick = function(){ _instToggleGroup(pathKey); };
  hd.style.display = (forceHidden || !visCount) ? 'none' : '';
  hd.innerHTML = '<td colspan="9" style="padding-left:' + indent + 'px">'
   + '<span style="margin-right:4px">' + (isCollapsed ? '▶' : '▼') + '</span>'
   + _gtGroupLabelHTML(k, node.field === 'funil' ? (_INST_FUNIL_CLS[k] || 'bm') : null)
   + _gtCountBadgeHTML(visCount)
   + '</td>';
  tbody.appendChild(hd);
  _instRenderGroupNode(child, nodePath, tbody, forceHidden || isCollapsed);
 });
}

// ── VISTAS: Tabela / Kanban / Calendário ─────────────────────────────────────
// Mesmo esquema visual do Kanban/Calendário de Entregas (kanban-obras/
// kanban-col, .ent-cal* — classes genéricas, não amarradas a Entregas por
// nada além do nome). Trabalha em cima das <tr> já filtradas/ordenadas no
// DOM (mesmo dataset usado pelo filtro), não precisa de outra fonte.
var _INST_KC_ID = {
 'A programar': 'inst-kc-a-programar',
 'Programado': 'inst-kc-programado',
 'Emitir boleto de medição': 'inst-kc-boleto',
 'Em execução': 'inst-kc-execucao',
 'Finalizado': 'inst-kc-finalizado',
};
function setInstView(v) {
 document.getElementById('inst-view-tabela').style.display = v === 'tabela' ? '' : 'none';
 document.getElementById('inst-view-kanban').style.display = v === 'kanban' ? '' : 'none';
 document.getElementById('inst-view-calendario').style.display = v === 'calendario' ? '' : 'none';
 document.getElementById('inst-btn-tabela').className = 'vt-btn' + (v === 'tabela' ? ' active' : '');
 document.getElementById('inst-btn-kanban').className = 'vt-btn' + (v === 'kanban' ? ' active' : '');
 document.getElementById('inst-btn-calendario').className = 'vt-btn' + (v === 'calendario' ? ' active' : '');
 if (v === 'kanban') _instRenderKanban();
 if (v === 'calendario') renderInstCal();
}
function _instRenderKanbanIfVisible() {
 var el = document.getElementById('inst-view-kanban');
 if (el && el.style.display !== 'none') _instRenderKanban();
}
function _instRenderCalIfVisible() {
 var el = document.getElementById('inst-view-calendario');
 if (el && el.style.display !== 'none') renderInstCal();
}
function _instVisibleRows() {
 return Array.prototype.slice.call(document.querySelectorAll('#inst-tbody tr[data-id]')).filter(function(tr){ return tr.style.display !== 'none'; });
}
function _instFmtDateBR(iso) { var p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
function _instCardHTML(tr) {
 var ds = tr.dataset;
 var cls = _INST_FUNIL_CLS[ds.funil] || 'bm';
 return '<div class="obra-card" data-id="' + ds.id + '" onclick="_spInstalacaoById(\'' + ds.id + '\')">'
  + '<div class="oc-title">' + (ds.nome || 'Instalação').replace(/</g,'&lt;') + '</div>'
  + (ds.cliente ? '<div style="font-size:11px;color:var(--muted);margin-top:3px">' + ds.cliente.replace(/</g,'&lt;') + '</div>' : '')
  + '<div class="oc-tags">' + (ds.tipo ? '<span class="badge bg" style="font-size:10px">' + ds.tipo + '</span>' : '') + (ds.equipe ? '<span class="badge bm" style="font-size:10px">' + ds.equipe + '</span>' : '') + '</div>'
  + (ds.inicio ? '<div class="oc-date">Início ' + _instFmtDateBR(ds.inicio) + '</div>' : '')
  + '</div>';
}
function _instRenderKanban() {
 var rows = _instVisibleRows();
 var buckets = {}; Object.keys(_INST_KC_ID).forEach(function(k){ buckets[k] = []; });
 rows.forEach(function(tr){ var f = tr.dataset.funil; if (buckets[f]) buckets[f].push(tr); });
 Object.keys(_INST_KC_ID).forEach(function(status) {
  var col = document.getElementById(_INST_KC_ID[status]);
  if (!col) return;
  var body = col.querySelector('.kc-body'); var count = col.querySelector('.kc-count');
  if (body) body.innerHTML = buckets[status].map(_instCardHTML).join('') || '<div style="font-size:11px;color:var(--muted);padding:8px 2px">Nenhuma instalação</div>';
  if (count) count.textContent = buckets[status].length;
 });
}

// ── CALENDÁRIO — vira Timeline (Gantt), mesmo modelo/algoritmo já
// comprovado em _gestorBuildCalGrid/_gestorRenderTimeline (Gestor de
// Tarefas, scripts/modules/tarefas.js) — pedido explícito da usuária. A
// grade mensal antiga (1 chip por instalação, só no dia de INÍCIO) nunca
// usava `data_fim` (carregado no dataset da linha, mas ignorado aqui) —
// instalação de vários dias virava um chip isolado, sem mostrar o
// intervalo; células com muitos eventos estouravam (altura fixa, sem
// paginação). Cópia adaptada (não extração de componente genérico
// compartilhado — evita risco de mexer no que já funciona no Gestor),
// mesmo padrão de duplicação consciente já usado no resto do sistema.
var _instCalYear = new Date().getFullYear();
var _instCalMonth = new Date().getMonth();
function instCalNav(dir) {
 _instCalMonth += dir;
 if (_instCalMonth > 11) { _instCalMonth = 0; _instCalYear++; }
 if (_instCalMonth < 0) { _instCalMonth = 11; _instCalYear--; }
 renderInstCal();
}
function _instCalToday() {
 var hoje = new Date();
 _instCalYear = hoje.getFullYear();
 _instCalMonth = hoje.getMonth();
 renderInstCal();
}
function _instEventColor(funil) {
 if (funil === 'A programar') return '#8b5cf6';
 if (funil === 'Programado' || funil === 'Emitir boleto de medição') return '#B8790A';
 if (funil === 'Em execução') return '#8B8B94';
 if (funil === 'Finalizado') return '#1F8A4C';
 return '#8B8B94';
}
// {bg,tx,bdr} — mesmo formato que _instBuildCalGrid espera (bg translúcido,
// borda/texto na cor sólida). Tema claro: texto usa a borda (mais escura/
// saturada) em vez do tx pastel, mesmo ajuste já usado no tColor do Gestor
// (tarefas.js) — sem isso o texto ficava ilegível sobre fundo claro.
function _instTColor(funil) {
 var hex = _instEventColor(funil);
 var c = { bg: hex + '22', tx: hex, bdr: hex };
 if (document.body.classList.contains('light')) c = { bg: c.bg, tx: c.bdr, bdr: c.bdr };
 return c;
}
function _instMonthDays(y, m) {
 var first = new Date(y, m, 1);
 var startOffset = first.getDay();
 var daysInMonth = new Date(y, m + 1, 0).getDate();
 var totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
 var days = [];
 for (var i = 0; i < totalCells; i++) { var d = new Date(y, m, 1 - startOffset + i); days.push(d); }
 return days;
}
// Semana expandida (empilhamento de barras sobrepostas além das 3 lanes
// padrão) — mesmo estado/mecanismo de _gestorWeekExpanded (tarefas.js).
var _instWeekExpanded = {};
function _instToggleWeek(weekKey) {
 _instWeekExpanded[weekKey] = !_instWeekExpanded[weekKey];
 renderInstCal();
}
// Cópia adaptada de _gestorBuildCalGrid (tarefas.js) — grid de 7 colunas
// por semana, barras horizontais em % por dia de início/fim, empilhamento
// em lanes (até 3 visíveis, resto atrás de "+N ocultas — expandir").
function _instBuildCalGrid(days, tRanges, dimFn) {
 var dShort = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab'];
 var LANES_DEFAULT=4, BAR_H=26, BAR_GAP=3, DAY_NUM_H=30;
 var html = '<div style="display:grid;grid-template-columns:repeat(7,1fr);border-bottom:2px solid var(--border);flex-shrink:0;background:var(--surface2)">';
 days.slice(0,7).forEach(function(day){
  var isWE = day.getDay()===0 || day.getDay()===6;
  html += '<div style="padding:6px 0;text-align:center;font-size:10px;font-weight:700;color:'+(isWE?'#9ca3af':'var(--muted)')+'">'+dShort[day.getDay()]+'</div>';
 });
 html += '</div><div>';
 for (var w=0; w<days.length; w+=7) {
  var week = days.slice(w, w+7);
  var wStart=week[0], wEnd=week[6];
  var weekKey=wStart.getFullYear()+'-'+String(wStart.getMonth()+1).padStart(2,'0')+'-'+String(wStart.getDate()).padStart(2,'0');
  var isExpanded=!!_instWeekExpanded[weekKey];

  var wTasks=tRanges.filter(function(tr){ return +tr.s<=+wEnd && +tr.e>=+wStart; });

  var laneEnds=[];
  var taskLane=wTasks.map(function(tr) {
   var effS=+tr.s<+wStart?wStart:tr.s, li=-1;
   for(var k=0;k<laneEnds.length;k++){ if(+laneEnds[k]<+effS){li=k;laneEnds[k]=tr.e;break;} }
   if(li===-1){li=laneEnds.length;laneEnds.push(tr.e);}
   return li;
  });

  var totalLanes=laneEnds.length;
  var visLanes=isExpanded ? totalLanes : Math.min(totalLanes, LANES_DEFAULT);
  var hiddenTasks=wTasks.filter(function(_,ti){ return taskLane[ti]>=visLanes; }).length;
  var hasOver=hiddenTasks>0;

  var FOOTER_H = hasOver ? 22 : (isExpanded && totalLanes>LANES_DEFAULT ? 22 : 4);
  var weekH=DAY_NUM_H + visLanes*(BAR_H+BAR_GAP) + FOOTER_H;

  html += '<div style="position:relative;border-bottom:1px solid var(--border);height:'+weekH+'px">'
   + '<div style="display:grid;grid-template-columns:repeat(7,1fr);height:100%;position:absolute;inset:0;pointer-events:none">';
  week.forEach(function(day) {
   var isCur=!dimFn(day), isWE=day.getDay()===0||day.getDay()===6;
   var bg=isWE?'rgba(0,0,0,.03)':'var(--surface)';
   html += '<div style="border-right:1px solid var(--border);background:'+bg+';padding:4px 5px">'
    +'<span style="font-size:11px;font-weight:'+(isCur?'600':'400')+';color:'+(isCur?'var(--text)':'#64748b')+'">'+day.getDate()+'</span>'
    +'</div>';
  });
  html += '</div><div style="position:absolute;top:'+DAY_NUM_H+'px;left:0;right:0;pointer-events:none">';

  wTasks.forEach(function(tr,ti){
   var lane=taskLane[ti];
   if(lane>=visLanes) return;

   var tds=tr.tds, c=_instTColor(tds.funil), done=tds.funil==='Finalizado';
   var colS=Math.max(0,Math.round((+tr.s-+wStart)/86400000));
   var colE=Math.min(6,Math.round((+tr.e-+wStart)/86400000));
   var spans=colE-colS+1;
   var pL=(colS/7*100).toFixed(2), pW=(spans/7*100).toFixed(2);
   var blR=+tr.s<+wStart?'0':'4px', brR=+tr.e>+wEnd?'0':'4px';
   var contL=+tr.s<+wStart?'&#9668; ':'', contR=+tr.e>+wEnd?' &#9658;':'';
   var barText=contL+(tds.nome||'Instalação')+(tds.equipe?' &middot; '+tds.equipe:'')+contR;
   var topY=lane*(BAR_H+BAR_GAP);
   var titleAttr=(tds.nome||'')+(tds.obra?'\nObra: '+tds.obra:'')+(tds.cliente?'\nCliente: '+tds.cliente:'');
   html += '<div onclick="_spInstalacaoById(\''+tds.id+'\')" title="'+titleAttr.replace(/"/g,'&quot;')+'"'
    +' style="position:absolute;left:calc('+pL+'% + 2px);width:calc('+pW+'% - 4px);top:'+topY+'px;height:'+BAR_H+'px;'
    +'background:'+c.bg+';border:1px solid '+c.bdr+';border-left:3px solid '+c.bdr+';border-radius:'+blR+' '+brR+' '+brR+' '+blR+';'
    +'display:flex;align-items:center;padding:0 6px;cursor:pointer;pointer-events:all;overflow:hidden;'
    +'font-size:10px;font-weight:700;color:'+c.tx+';white-space:nowrap;'
    +'opacity:'+(done?'.75':'1')+';text-decoration:'+(done?'line-through':'none')+';'
    +'transition:filter .12s;box-shadow:0 1px 2px rgba(0,0,0,.18)" '
    +'onmouseover="this.style.filter=\'brightness(1.18)\'" onmouseout="this.style.filter=\'\'">'
    +barText+'</div>';
  });

  var btnTop = visLanes*(BAR_H+BAR_GAP)+2;
  if (hasOver) {
   html += '<div onclick="_instToggleWeek(\''+weekKey+'\')" style="'
    +'position:absolute;left:4px;top:'+btnTop+'px;'
    +'display:inline-flex;align-items:center;gap:4px;'
    +'background:var(--surface2);border:1px solid var(--border);border-radius:10px;'
    +'padding:1px 9px 1px 6px;cursor:pointer;pointer-events:all;'
    +'font-size:10px;font-weight:700;color:var(--navy);'
    +'transition:background .12s" '
    +'onmouseover="this.style.background=\'var(--border)\'" onmouseout="this.style.background=\'var(--surface2)\'">'
    +'<span style="font-size:12px;line-height:1">&#9660;</span> '
    +'+'+hiddenTasks+' instala'+(hiddenTasks>1?'ções ocultas':'ção oculta')+' — expandir'
    +'</div>';
  } else if (isExpanded && totalLanes > LANES_DEFAULT) {
   html += '<div onclick="_instToggleWeek(\''+weekKey+'\')" style="'
    +'position:absolute;left:4px;top:'+btnTop+'px;'
    +'display:inline-flex;align-items:center;gap:4px;'
    +'background:var(--surface2);border:1px solid var(--border);border-radius:10px;'
    +'padding:1px 9px 1px 6px;cursor:pointer;pointer-events:all;'
    +'font-size:10px;font-weight:700;color:var(--muted);'
    +'transition:background .12s" '
    +'onmouseover="this.style.background=\'var(--border)\'" onmouseout="this.style.background=\'var(--surface2)\'">'
    +'<span style="font-size:12px;line-height:1">&#9650;</span> recolher'
    +'</div>';
  }

  html += '</div></div>';
 }
 html += '</div>';
 return html;
}
function renderInstCal() {
 var grid = document.getElementById('inst-cal-grid');
 if (!grid) return;
 var rows = _instVisibleRows();

 var tRanges = rows
  .filter(function(tr){ return tr.dataset.inicio || tr.dataset.fim; })
  .map(function(tr){
   var s = tr.dataset.inicio ? new Date(tr.dataset.inicio+'T00:00:00') : new Date(tr.dataset.fim+'T00:00:00');
   var e = tr.dataset.fim    ? new Date(tr.dataset.fim   +'T00:00:00') : new Date(tr.dataset.inicio+'T00:00:00');
   if (+e < +s) e = new Date(+s);
   return { s:s, e:e, tds: tr.dataset };
  })
  .sort(function(x,y){ return +x.s - +y.s || +x.e - +y.e; });
 // 8 de 125 instalações não têm nenhuma data hoje (auditoria confirmada no
 // banco — maioria "A programar", faz sentido; algumas "Finalizado"/"Em
 // execução" sem data são dado real incompleto, não bug de sincronização)
 // — mesmo tratamento do Gestor: faixa "SEM DATA" clicável, não somem.
 var tSemData = rows.filter(function(tr){ return !tr.dataset.inicio && !tr.dataset.fim; });

 var vy=_instCalYear, vm=_instCalMonth;
 var mFull = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
 var periodLbl = mFull[vm]+' '+vy;
 var days = _instMonthDays(vy, vm);
 // Sem height:100%/overflow:hidden/flex:1 (diferente do Gestor de Tarefas,
 // que é uma página inteira de altura travada com scroll interno) —
 // Instalações é página normal, então a grade só ocupa a altura que o
 // conteúdo do mês precisa e a página rola normalmente por baixo.
 var bodyHtml = _instBuildCalGrid(days, tRanges, function(d){ return d.getMonth()!==vm; });

 var btnSt = 'background:none;border:1px solid var(--border);border-radius:6px;cursor:pointer;font-family:inherit;color:var(--text)';
 var html = '<div style="display:flex;flex-direction:column;border:1px solid var(--border);border-radius:8px;overflow:hidden">'
  + '<div style="display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:1px solid var(--border);background:var(--surface);flex-shrink:0;flex-wrap:wrap">'
  + '<button style="'+btnSt+';padding:3px 12px;font-size:18px;line-height:1" onclick="instCalNav(-1)">&#8249;</button>'
  + '<button style="'+btnSt+';padding:3px 12px;font-size:18px;line-height:1" onclick="instCalNav(1)">&#8250;</button>'
  + '<span style="font-size:13px;font-weight:800;color:var(--text)">'+periodLbl+'</span>'
  + '<button style="'+btnSt+';padding:4px 12px;font-size:12px" onclick="_instCalToday()">Hoje</button>'
  + '<span style="font-size:10px;color:var(--muted);margin-left:4px">'+tRanges.length+' instalações'+(tSemData.length?' &middot; '+tSemData.length+' sem data':'')+'</span>'
  + '<div style="margin-left:auto;display:flex;gap:8px;align-items:center;font-size:10px;flex-wrap:wrap">'
  + [['A programar','#8b5cf6'],['Programado','#B8790A'],['Em execução','#8B8B94'],['Finalizado','#1F8A4C']].map(function(l){
    return '<span style="display:flex;align-items:center;gap:3px"><span style="width:10px;height:10px;border-radius:2px;background:'+l[1]+';opacity:.25;border:1px solid '+l[1]+';flex-shrink:0;display:inline-block"></span><span style="color:var(--muted)">'+l[0]+'</span></span>';
   }).join('')
  + '</div></div>'
  + bodyHtml;

 if (tSemData.length) {
  html += '<div style="border-top:1px solid var(--border);padding:8px 14px;background:var(--surface2);flex-shrink:0">'
   + '<div style="font-size:10px;font-weight:700;color:var(--muted);margin-bottom:5px">SEM DATA ('+tSemData.length+')</div>'
   + '<div style="display:flex;flex-wrap:wrap;gap:5px">'
   + tSemData.map(function(tr){var c=_instTColor(tr.dataset.funil);return '<span onclick="_spInstalacaoById(\''+tr.dataset.id+'\')" style="cursor:pointer;font-size:10px;padding:2px 8px;background:'+c.bg+';border:1px solid '+c.bdr+';border-radius:10px;color:'+c.tx+'">'+(tr.dataset.nome||'Instalação')+'</span>';}).join('')
   + '</div></div>';
 }
 html += '</div>';
 grid.innerHTML = html;
}

function _instApplyFilters() {
 var buscaNorm = _ssNormalize(((document.getElementById('inst-search') || {}).value || '').trim());
 var activeConds = _fbInstances.instalacoes.state.conditions.filter(_fbConditionIsUsable).length;
 // Remove cabeçalhos de grupo da renderização anterior antes de reconsultar
 // as linhas — eles não têm data-id, então não entram no seletor abaixo.
 Array.prototype.slice.call(document.querySelectorAll('#inst-tbody tr.inst-group-row')).forEach(function(tr){ tr.remove(); });
 var rows = Array.prototype.slice.call(document.querySelectorAll('#inst-tbody tr[data-id]'));
 var visivel = 0;
 rows.forEach(function(tr) {
  var ok = _fbEvaluate(tr.dataset, 'instalacoes');
  if (ok && buscaNorm) ok = _ssMatch(_ssNormalize(tr.textContent), buscaNorm);
  tr.style.display = ok ? '' : 'none';
  if (ok) visivel++;
 });
 if (rows.length) {
  rows.sort(function(a, b) { return _sbCompare(a.dataset, b.dataset, 'instalacoes'); });
  var tbody = rows[0].parentElement;
  var groupLevels = (_gbInstances.instalacoes && _gbInstances.instalacoes.state.levels) || [];
  if (groupLevels.length) {
   var tree = _gtBuildTree(rows, groupLevels, function(tr, field) {
    return { key: tr.dataset[field] || 'Sem valor', sortKey: null };
   }, null, 0);
   _instRenderGroupNode(tree, [], tbody, false);
  } else {
   rows.forEach(function(tr) { tbody.appendChild(tr); });
  }
 }
 var fbBadge = document.getElementById('fb-badge-instalacoes');
 if (fbBadge) { fbBadge.textContent = activeConds; fbBadge.style.display = activeConds ? '' : 'none'; }
 var countEl = document.getElementById('inst-filter-count');
 if (countEl) {
  if (activeConds || buscaNorm) { countEl.textContent = visivel + (visivel === 1 ? ' resultado' : ' resultados'); countEl.style.display = 'inline'; }
  else { countEl.style.display = 'none'; }
 }
 _instRenderKanbanIfVisible();
 _instRenderCalIfVisible();
}

// Reescrito (pedido explícito, congruente com o Airtable) — a versão
// antiga lia os campos de tds[N].innerText (texto já formatado da linha
// da TABELA cheia de Instalações). Bug real: qualquer entrada que não
// viesse de um <tr> de verdade (ex.: o card de Instalação dentro do
// detalhamento de Obra, que abre via _spOpenEntityById → uma <tr> FAKE
// sem nenhuma célula) tinha tds vazio — o painel abria sem nenhuma
// informação. Agora busca por id, com todos os relacionamentos reais
// (mesmo padrão de _spObraById/_spProjetoRender).
function _spInstalacoes(row, tds) {
 _spInstalacaoById(row.dataset.id);
}

// Cores de identidade — mesmo mapa de _dbLoadInstalacoes acima, cópia
// local (não é global em nenhum dos dois lugares).
var _instStatusCls = { 'Finalizado':'bg', 'Em execução':'bm', 'Emitir boleto de medição':'by', 'Programado':'by', 'A programar':'bp' };
var _instAtiva = null; // instalação atualmente aberta no painel (autosave lê daqui)

// Rótulos de campo — servem à mensagem de conflito (concurrency.js) e ao
// Histórico (historico.js). Rótulo null = campo técnico, fora do histórico.
var _INSTALACAO_CAMPO_LABEL = {
 tipo_servico: 'Tipo de Serviço', funil: 'Status', data_inicio: 'Data início',
 data_fim: 'Data fim', dias_executados: 'Nº dias executados', detalhes: 'Detalhes',
 valor_total_gasto: 'Despesa Total', numero: 'Número', obra_id: null,
 criado_por: null, atualizado_por: null,
};
if (typeof _ccRegistrarLabels === 'function') _ccRegistrarLabels('instalacoes', _INSTALACAO_CAMPO_LABEL);
var _instDetEquipeSel = [];
var _instEquipesCacheDet = null;

async function _spInstalacaoById(id) {
 if (!id) return;
 _spSet('Instalação', 'Carregando...', '<div style="padding:40px;text-align:center;color:var(--muted)">Buscando dados...</div>', '');
 document.getElementById('sp-overlay').classList.add('sp-open');
 document.getElementById('sp-drawer').classList.add('sp-open');
 if (typeof _spTrackDirectOpen === 'function') _spTrackDirectOpen('instalacoes', id);
 if (!_sb) return;
 // obras_instalacoes/instalacoes_equipe — as duas relações N:N de verdade
 // (Instalação pode ter várias Obras, igual ao Airtable — decisão
 // confirmada com a usuária; e várias Equipes, já existente).
 var res = await _sb.from('instalacoes')
  .select('*, obras_instalacoes(obra:obra_id(id,nome,cidade,estado)), instalacoes_equipe(equipe:equipe_id(id,nome))')
  .eq('id', id).single();
 if (res.error || !res.data) {
  _spSet('Instalação', 'Erro', '<div style="color:var(--red);padding:20px">Instalação não encontrada.</div>', '');
  return;
 }
 _spInstalacaoRender(res.data);
}

function _spInstalacaoRender(inst) {
 _instAtiva = inst;
 var obras = (inst.obras_instalacoes || []).map(function(x){ return x.obra; }).filter(Boolean);
 var equipes = (inst.instalacoes_equipe || []).map(function(x){ return x.equipe; }).filter(Boolean);
 // Cidade/Estado — rollup das Obras vinculadas (mesmo espírito do rollup
 // de Cidade/Estado no detalhamento de Projeto) — com várias obras
 // possíveis aqui, mostra a lista única de valores, não só o 1º.
 var cidades = Array.from(new Set(obras.map(function(o){ return o.cidade; }).filter(Boolean)));
 var estados = Array.from(new Set(obras.map(function(o){ return o.estado; }).filter(Boolean)));
 var diasProgramados = (inst.data_inicio && inst.data_fim)
  ? Math.round((new Date(inst.data_fim) - new Date(inst.data_inicio)) / 86400000)
  : null;
 // Fórmula pedida explicitamente (igual ao campo fórmula do Airtable):
 // "{ID sequencial} - {Categoria do Serviço} - {Obra}". `numero` é a
 // coluna nova (SERIAL, migração add_instalacoes_numero_sequencial) —
 // preenchida por ordem de created_at pras 125 instalações já existentes,
 // automática (nextval) pra qualquer instalação nova. Nome montado aqui
 // no client, não fica armazenado — evita ficar desatualizado se
 // tipo_servico ou a(s) obra(s) vinculada(s) mudar(em) depois.
 var titulo = (inst.numero != null ? inst.numero : '?') + ' - ' + (inst.tipo_servico || 'Instalação') + ' - ' + (obras.length ? obras.map(function(o){ return o.nome; }).join(', ') : '(sem obra)');
 // Criado por/Última alteração por — trazidos do Airtable numa correção
 // recente (achado real: a tabela nunca teve essa auditoria, diferente de
 // Obras/Entregas/Atividades). Mesmo padrão de exibição já usado nelas.
 var criadoNome   = (typeof _projAuditNome === 'function') ? _projAuditNome(inst.criado_por) : (inst.criado_por || '—');
 var alteradoNome = (typeof _projAuditNome === 'function') ? _projAuditNome(inst.atualizado_por) : (inst.atualizado_por || '—');

 _srchSelRegister('instDetTipo', {
  options: ['Instalação','Montagem fábrica','Treinamento piloto','Assistência técnica'],
  placeholder: 'Selecione...', onSelect: function(){ _instScheduleAutoSave(); },
 });
 _srchSelRegister('instDetStatus', {
  options: ['A programar','Programado','Emitir boleto de medição','Em execução','Finalizado'],
  placeholder: 'Selecione...', onSelect: function(){ _instScheduleAutoSave(); },
 });
 _srchSelRegister('instDetObraAdd', {
  options: function(){ return (_obraIdMap ? Object.keys(_obraIdMap).map(function(oid){ return { id: oid, label: _obraIdMap[oid].nome }; }) : []).map(function(o){ return o.label; }); },
  placeholder: 'Buscar obra pra vincular...',
  onSelect: function(nomeEscolhido) {
   var oid = null;
   if (typeof _obraIdMap !== 'undefined') {
    oid = Object.keys(_obraIdMap).find(function(k){ return _obraIdMap[k].nome === nomeEscolhido; });
   }
   if (oid) _instObraVincular(oid);
  },
 });

 var html = `
  <input type="hidden" id="sp-inst-id" value="${inst.id}">
  <div class="spt-bar">
   <button class="spt-btn active" data-target="spt-inst-geral" onclick="_sptSwitch('inst-geral',this)">Visão Geral</button>
   <button class="spt-btn" data-target="spt-inst-historico" onclick="_sptSwitch('inst-historico',this)">Histórico</button>
  </div>
  <div class="spt-panel" id="spt-inst-geral">
  <div class="sp-field"><div class="sp-label">Tipo de Serviço <span class="req">*</span></div>${_srchSelMarkup('instDetTipo', 'sp-inst-tipo', inst.tipo_servico || '')}</div>
  <div class="sp-field"><div class="sp-label">Status <span class="req">*</span></div>${_srchSelMarkup('instDetStatus', 'sp-inst-status', inst.funil || '')}</div>
  <div class="sp-g2">
   <div class="sp-field"><div class="sp-label">Data início <span class="req">*</span></div><input class="sp-inp" id="sp-inst-inicio" type="date" value="${inst.data_inicio || ''}" onchange="_instScheduleAutoSave()"></div>
   <div class="sp-field"><div class="sp-label">Data fim <span class="req">*</span></div><input class="sp-inp" id="sp-inst-fim" type="date" value="${inst.data_fim || ''}" onchange="_instScheduleAutoSave()"></div>
  </div>
  <div class="sp-g2">
   <div class="sp-field"><div class="sp-label">Nº dias programados</div><input class="sp-inp" value="${diasProgramados != null ? diasProgramados : '—'}" readonly title="Automático — diferença entre Data início e Data fim"></div>
   <div class="sp-field"><div class="sp-label">Nº dias executados</div><input class="sp-inp" id="sp-inst-dias-exec" type="number" min="0" value="${inst.dias_executados != null ? inst.dias_executados : ''}" onchange="_instScheduleAutoSave()"></div>
  </div>
  <div class="sp-g2">
   <div class="sp-field"><div class="sp-label">Cidade (das Obras)</div><input class="sp-inp" value="${cidades.length ? cidades.join(', ') : '—'}" readonly></div>
   <div class="sp-field"><div class="sp-label">Estado (das Obras)</div><input class="sp-inp" value="${estados.length ? estados.join(', ') : '—'}" readonly></div>
  </div>
  <div class="sp-field"><div class="sp-label">Detalhes</div><textarea class="sp-inp" id="sp-inst-detalhes" rows="1" style="resize:none;overflow:hidden;min-height:34px" oninput="this.style.height='auto';this.style.height=(this.scrollHeight)+'px';_instScheduleAutoSave()">${inst.detalhes || ''}</textarea></div>
  <div class="sp-field"><div class="sp-label">Despesa Total</div><input class="sp-inp" id="sp-inst-valortotal" type="number" step="0.01" min="0" placeholder="0,00" value="${inst.valor_total_gasto != null ? inst.valor_total_gasto : ''}" onchange="_instScheduleAutoSave()"></div>

  <div class="sp-stitle">Anexos</div>
  <div id="sp-inst-anexos-wrap"><div class="sp-empty">Carregando...</div></div>

  <div class="sp-stitle">Equipe de Instalação <span class="req">*</span></div>
  <div id="sp-inst-equipe-dd" class="no-msel-wide"><div style="font-size:12px;color:var(--muted);padding:8px 0">Carregando...</div></div>

  <div class="sp-stitle" style="display:flex;align-items:center;justify-content:space-between">
   <span>Obras vinculadas</span>
   <button type="button" class="btn btn-ghost" style="padding:2px 8px;font-size:11px" onclick="_instObraAddToggle()">+ Vincular</button>
  </div>
  <div id="sp-inst-obra-add" style="display:none;margin-bottom:8px">${_srchSelMarkup('instDetObraAdd', 'sp-inst-obra-add-hidden', '')}</div>
  <div id="sp-inst-obras-chips" class="sp-rel-chips-wrap">${
   obras.length
    ? obras.map(function(o){ return _spRelChipHTML('obras', o.id, o.nome || '—', null, '_instObraDesvincular(\'' + inst.id + '\',\'' + o.id + '\')'); }).join('')
    : '<div class="sp-empty">Nenhuma obra vinculada.</div>'
  }</div>
  </div>
  <div class="spt-panel" id="spt-inst-historico">
   <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:10px">Histórico de alterações</div>
   ${typeof _histPanelHTML === 'function' ? _histPanelHTML('sp-inst-historico') : ''}
  </div>
  <div class="spt-panel" style="border-top:1px solid var(--border);padding-top:12px;margin-top:8px">
   <div class="drw-audit-row"><span class="drw-audit-lbl">Criado por</span><span class="drw-audit-val">${criadoNome}</span></div>
   <div class="drw-audit-row"><span class="drw-audit-lbl">Última alteração por</span><span class="drw-audit-val">${alteradoNome}</span></div>
  </div>
 `;

 // Exclusão disponível pra qualquer usuário (RLS de `instalacoes` já é
 // aberta a qualquer autenticado, sem restrição adicional pedida) —
 // mesmo padrão de Projeto. CASCADE no banco já limpa obras_instalacoes/
 // instalacoes_equipe/documentos_instalacoes sozinho.
 _spSet('Instalação', titulo, html,
  '<button class="btn btn-ghost" style="color:var(--red);border-color:var(--red);margin-right:auto" onclick="_spExcluirInstalacao(\'' + inst.id + '\',\'' + titulo.replace(/'/g,"\\'") + '\')">Excluir instalação</button> '
  + '<button class="btn btn-ghost" onclick="closePanel()">Fechar</button>');

 // Baseline da trava otimista: o registro como veio do banco na abertura do
 // painel (ver concurrency.js). É contra ele que _ccSave decide o que mandar.
 if (typeof _ccSetBaseline === 'function') _ccSetBaseline('instalacoes', inst.id, inst);
 if (typeof _rtLimparAvisoExterno === 'function') _rtLimparAvisoExterno();
 if (typeof _sptInitScrollSpy === 'function') _sptInitScrollSpy();
 if (typeof _histCarregar === 'function') _histCarregar('sp-inst-historico', 'instalacoes', inst.id);

 _instDetEquipeSel = equipes.map(function(e){ return e.nome; });
 _instCarregarEquipesCacheDet().then(function(){
  var dd = document.getElementById('sp-inst-equipe-dd');
  if (dd) dd.innerHTML = _instDetEquipeDropdownHTML();
 });
 _instCarregarAnexos(inst.id);
}

// ── Despesas / Detalhe da Montagem (anexo) ────────────────────────────────────
// 2 campos de anexo do Airtable — mesma relação N:N documentos_instalacoes
// já criada no banco. Cards de anexo em grade — mesmo padrão exato usado
// no painel de Entrega (scripts/lib/doc-cards.js, _dc*), pedido explícito
// da usuária pra reaproveitar em toda aba de detalhe que anexe documentos.
// Antes era um dropzone de arquivo único (sem "multiple") + lista de texto
// sem miniatura e sem excluir.
var _INST_ANEXO_BUCKET = 'documentos_obras';
var _INST_ANEXO_TIPOS = [
 { tipo: 'Despesa', label: 'Despesas' },
 { tipo: 'Detalhe da Montagem', label: 'Detalhe da Montagem' },
];
function _instAnexoCategoriaHTML(cat, docs, instalacaoId, signedMap) {
 var thumbs = docs.map(function(d) {
  var nome = (d.nome_arquivo || 'Documento').toString();
  var pathSafe = String(d.caminho_storage || '').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  var nomeSafe = nome.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  var removeJs = "_instAnexoExcluir('" + d.id + "','" + pathSafe + "','" + instalacaoId + "')";
  return _dcThumbHTML(d, _INST_ANEXO_BUCKET, signedMap, "_spAbrirDocStorage('" + pathSafe + "','" + nomeSafe + "','" + _INST_ANEXO_BUCKET + "')", removeJs);
 });
 var inputId = 'sp-inst-anexo-up-' + cat.tipo.replace(/[^a-zA-Z0-9]/g,'_');
 var labelId = inputId + '-lbl';
 var addHtml = _dcAddHTML(inputId, labelId, "_instAnexoFileChange(this,'" + cat.tipo + "','" + labelId + "')");
 var attrs = _dcDragAttrs("_instAnexoFileDrop(event,'" + cat.tipo + "','" + labelId + "')");
 return _dcCardHTML(cat.label, docs, thumbs, addHtml, attrs);
}
async function _instUploadDocumento(file, instalacaoId, tipo) {
 var path = 'instalacoes/' + instalacaoId + '/' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9_.\-]/g,'_');
 var up = await _sb.storage.from(_INST_ANEXO_BUCKET).upload(path, file, { upsert: false });
 if (up.error) { console.error('[Instalações] erro ao enviar anexo:', up.error); return false; }
 var ins = await _sb.from('documentos').insert({
  nome_arquivo: file.name, tipo: tipo, categoria: 'Técnico', caminho_storage: path,
  tamanho_bytes: file.size, mime_type: file.type, status: 'Ativo', versao: 1, origem: 'upload_manual',
 }).select('id').single();
 if (ins.error || !ins.data) { console.error('[Instalações] erro ao registrar anexo:', ins.error); return false; }
 var link = await _sb.from('documentos_instalacoes').insert({ documento_id: ins.data.id, instalacao_id: instalacaoId });
 if (link.error) { console.error('[Instalações] erro ao vincular anexo à instalação:', link.error); return false; }
 return true;
}
async function _instAnexoUploadFiles(files, tipo, labelId) {
 if (!files || !files.length || !_instAtiva) return;
 var lbl = document.getElementById(labelId);
 if (lbl) lbl.textContent = 'Enviando...';
 var erros = 0;
 for (var i = 0; i < files.length; i++) { if (!(await _instUploadDocumento(files[i], _instAtiva.id, tipo))) erros++; }
 if (erros) _showToast(erros + ' arquivo(s) não enviado(s). Tente novamente.', 'erro');
 _instCarregarAnexos(_instAtiva.id);
}
function _instAnexoFileChange(input, tipo, labelId) {
 _instAnexoUploadFiles(Array.prototype.slice.call(input.files || []), tipo, labelId);
 input.value = '';
}
function _instAnexoFileDrop(event, tipo, labelId) {
 event.preventDefault();
 var files = event.dataTransfer && event.dataTransfer.files;
 _instAnexoUploadFiles(Array.prototype.slice.call(files || []), tipo, labelId);
}
async function _instAnexoExcluir(docId, path, instalacaoId) {
 if (!confirm('Excluir este anexo? Esta ação não pode ser desfeita.')) return;
 if (path) {
  var rm = await _sb.storage.from(_INST_ANEXO_BUCKET).remove([path]);
  if (rm.error) console.error('[Instalações] erro ao remover arquivo do storage:', rm.error);
 }
 var del = await _sb.from('documentos').delete().eq('id', docId);
 if (del.error) {
  console.error('[Instalações] erro ao excluir documento:', del.error);
  _showToast('Não foi possível excluir o anexo. Tente novamente.', 'erro');
  return;
 }
 await _sb.from('documentos_instalacoes').delete().eq('documento_id', docId);
 _showToast('Anexo excluído.', 'ok');
 _instCarregarAnexos(instalacaoId);
}
async function _instCarregarAnexos(id) {
 var wrap = document.getElementById('sp-inst-anexos-wrap');
 if (!wrap || !_sb) return;
 var res = await _sb.from('documentos_instalacoes').select('documento:documento_id(id,nome_arquivo,tipo,caminho_storage)').eq('instalacao_id', id);
 if (!_instAtiva || String(_instAtiva.id) !== String(id)) return; // painel já mudou de instalação
 var docs = (res.data || []).map(function(x){ return x.documento; }).filter(Boolean);
 var signedMap = await _dcSignedUrlMap(docs, function(){ return _INST_ANEXO_BUCKET; });
 wrap.innerHTML = '<div class="doc-card-grid">' + _INST_ANEXO_TIPOS.map(function(cat) {
  return _instAnexoCategoriaHTML(cat, docs.filter(function(d){ return d.tipo === cat.tipo; }), id, signedMap);
 }).join('') + '</div>';
}

async function _instCarregarEquipesCacheDet() {
 if (_instEquipesCacheDet) return;
 var res = await _sb.from('equipe_instalacao').select('id,nome').order('nome');
 _instEquipesCacheDet = res.data || [];
}
function _instDetEquipeDropdownHTML() {
 var opcoes = (_instEquipesCacheDet || []).map(function(e){ return e.nome; });
 return _msRenderDropdown('instDetEquipe', opcoes, _instDetEquipeSel, '_instDetEquipeToggle', 'Selecione a(s) equipe(s)...');
}
// Toggle persiste na hora (insert/delete direto em instalacoes_equipe) —
// diferente do formulário de CRIAÇÃO (obras.js), que só grava tudo junto
// no fim; aqui a instalação já existe, então cada clique já é uma
// alteração de verdade, mesmo espírito do autosave do resto do sistema.
async function _instDetEquipeToggle(campo, valor, checked) {
 if (!_instAtiva) return;
 var equipe = (_instEquipesCacheDet || []).find(function(e){ return e.nome === valor; });
 if (!equipe) return;
 // Equipe de Instalação é obrigatória (mesma regra do formulário de
 // criação, obras.js) — não deixa desmarcar a última pessoa restante.
 if (!checked && _instDetEquipeSel.length <= 1) {
  _showToast('Equipe de Instalação é obrigatória — mantenha ao menos 1 pessoa.', 'erro');
  return;
 }
 _instDetEquipeSel = _msToggle(_instDetEquipeSel, valor, checked);
 var dd = document.getElementById('sp-inst-equipe-dd');
 if (dd) dd.innerHTML = _instDetEquipeDropdownHTML();
 if (typeof _noReabrirDropdown === 'function') _noReabrirDropdown('sp-inst-equipe-dd');
 if (checked) {
  var insRes = await _sb.from('instalacoes_equipe').insert({ instalacao_id: _instAtiva.id, equipe_id: equipe.id });
  if (insRes.error) console.error('[Instalações] erro ao vincular equipe:', insRes.error);
 } else {
  var delRes = await _sb.from('instalacoes_equipe').delete().eq('instalacao_id', _instAtiva.id).eq('equipe_id', equipe.id);
  if (delRes.error) console.error('[Instalações] erro ao desvincular equipe:', delRes.error);
 }
}

function _instObraAddToggle() {
 var box = document.getElementById('sp-inst-obra-add');
 if (box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
}
async function _instObraVincular(obraId) {
 if (!_instAtiva) return;
 var res = await _sb.from('obras_instalacoes').insert({ obra_id: obraId, instalacao_id: _instAtiva.id });
 if (res.error) { _showToast('Erro ao vincular obra: ' + _supaErrPt(res.error.message), 'erro'); return; }
 _showToast('Obra vinculada.', 'ok');
 _spInstalacaoById(_instAtiva.id);
}
async function _instObraDesvincular(instalacaoId, obraId) {
 if (!confirm('Desvincular esta obra da instalação?\n\nNão apaga a obra nem a instalação, só remove o vínculo entre as duas.')) return;
 var res = await _sb.from('obras_instalacoes').delete().eq('instalacao_id', instalacaoId).eq('obra_id', obraId);
 if (res.error) { _showToast('Erro ao desvincular: ' + _supaErrPt(res.error.message), 'erro'); return; }
 _spInstalacaoById(instalacaoId);
}

// Autosave (mesmo espírito de _obraScheduleAutoSave/_spSaveObraFull,
// obras.js: debounce de 700ms, sem botão "Salvar").
var _instAutoSaveTimer = null;
function _instScheduleAutoSave() {
 if (_instAutoSaveTimer) clearTimeout(_instAutoSaveTimer);
 _instAutoSaveTimer = setTimeout(function(){ _spSalvarInstalacaoFull(); }, 700);
}
async function _spSalvarInstalacaoFull() {
 if (_instAutoSaveTimer) { clearTimeout(_instAutoSaveTimer); _instAutoSaveTimer = null; }
 var id = document.getElementById('sp-inst-id')?.value;
 if (!id || !_sb) return;
 var elTipo = document.getElementById('sp-inst-tipo');
 var elStatus = document.getElementById('sp-inst-status');
 var elInicio = document.getElementById('sp-inst-inicio');
 var elFim = document.getElementById('sp-inst-fim');
 // Mesmos 4 campos obrigatórios do formulário de CRIAÇÃO (Nova Instalação,
 // obras.js) — levantamento de campos obrigatórios encontrou que aqui, no
 // autosave do detalhamento, dava pra limpar qualquer um deles e salvar
 // null sem aviso nenhum, mesmo com o asterisco de obrigatório no rótulo.
 // Ignora só o(s) campo(s) esvaziado(s) (devolve o valor anterior) em vez
 // de recusar a alteração inteira — permite salvar o resto normalmente
 // mesmo se um dado legado já estiver sem um desses valores.
 var payload = {
  tipo_servico: elTipo?.value || null,
  funil: elStatus?.value || null,
  data_inicio: elInicio?.value || null,
  data_fim: elFim?.value || null,
  dias_executados: document.getElementById('sp-inst-dias-exec')?.value !== '' ? Number(document.getElementById('sp-inst-dias-exec')?.value) : null,
  valor_total_gasto: document.getElementById('sp-inst-valortotal')?.value !== '' ? Number(document.getElementById('sp-inst-valortotal')?.value) : null,
  detalhes: document.getElementById('sp-inst-detalhes')?.value?.trim() || null,
  // updated_at NÃO é mais mandado daqui: quem mantém essa coluna é o trigger
  // trg_instalacoes_updated_at (set_updated_at) no banco, e é exatamente ela
  // que _ccSave usa como trava otimista. Um valor forjado pelo cliente aqui
  // seria sobrescrito pelo trigger de qualquer jeito e só atrapalharia o diff.
 };
 var faltando = [];
 if (!payload.tipo_servico) { faltando.push('Tipo de Serviço'); delete payload.tipo_servico; if (_instAtiva && typeof _srchSelSelectItem === 'function') _srchSelSelectItem('instDetTipo', _instAtiva.tipo_servico || ''); }
 if (!payload.funil) { faltando.push('Status'); delete payload.funil; if (_instAtiva && typeof _srchSelSelectItem === 'function') _srchSelSelectItem('instDetStatus', _instAtiva.funil || ''); }
 if (!payload.data_inicio) { faltando.push('Data início'); delete payload.data_inicio; if (elInicio && _instAtiva) elInicio.value = _instAtiva.data_inicio || ''; }
 if (!payload.data_fim) { faltando.push('Data fim'); delete payload.data_fim; if (elFim && _instAtiva) elFim.value = _instAtiva.data_fim || ''; }
 if (faltando.length) _showToast('Campo obrigatório: ' + faltando.join(', ') + '. Alteração não foi salva.', 'erro');
 if (!Object.keys(payload).length) return;

 // Controle de concorrência (ver concurrency.js): antes daqui saía o payload
 // INTEIRO a cada pausa de digitação, então dois usuários na mesma instalação
 // se atropelavam — quem salvasse por último regravava os valores que tinha na
 // tela desde antes por cima do trabalho do outro, sem aviso. Agora só os
 // campos que ESTE usuário mexeu vão pro banco.
 var r = await _ccSaveComFeedback('instalacoes', id, payload, {
  toastOk: false, // autosave silencioso: só fala quando dá problema
  onRecarregar: function () {
   // Conflito ou merge automático: relê do banco e redesenha o painel com os
   // valores certos (aqui o registro precisa dos joins de obra/equipe, então
   // recarrega pelo caminho normal em vez de aplicar a linha crua).
   if (String((_instAtiva || {}).id) === String(id)) _spInstalacaoById(id);
  },
 });
 if (!r || r.conflito || r.erro || r.excluido || r.semMudanca) return;
 if (_instAtiva && String(_instAtiva.id) === String(id)) Object.assign(_instAtiva, r.row || payload);
 _instPatchNaLista(r.row || payload, id);
}

async function _spExcluirInstalacao(id, nome) {
 if (!confirm('Excluir "' + (nome || 'esta instalação') + '" PERMANENTEMENTE?\n\nVínculos com obras/equipes/documentos desta instalação também serão excluídos. Esta ação não pode ser desfeita.')) return;
 var res = await _sb.from('instalacoes').delete().eq('id', id);
 if (res.error) {
  // Detalhe técnico só no console; o usuário lê português.
  console.error('[Instalações] erro ao excluir:', res.error);
  _showToast('Não foi possível excluir esta instalação. Nada foi alterado.', 'erro');
  return;
 }
 closePanel();
 if (typeof _dbLoadInstalacoes === 'function') _dbLoadInstalacoes();
}

async function _dbLoadInstalacoes() {
 var tbody = document.getElementById('inst-tbody');
 if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--muted)">Carregando...</td></tr>';
 _instCarregarEquipesCacheFiltro();
 if (typeof _garantirObraIdMap === 'function') _garantirObraIdMap();
 try {
  var allData = []; var from = 0;
  while (true) {
   // obras_instalacoes/instalacoes_equipe — as duas relações N:N de
   // verdade (Instalação pode ter várias Obras, igual ao Airtable —
   // decisão confirmada com a usuária; e várias Equipes). Coluna "Equipe"
   // era hardcoded "—" antes, nunca tinha sido ligada de verdade a nenhum
   // dado; "Obra"/"Cliente" liam só de instalacoes.obra_id, que só guarda
   // 1 obra — ver _spInstalacaoById abaixo pro detalhamento completo.
   // updated_at é obrigatório aqui: é a coluna que _ccSave usa como trava
   // otimista (concurrency.js) e que alimenta o baseline do painel.
   var res = await _sb.from('instalacoes')
    .select('id, numero, detalhes, tipo_servico, funil, data_inicio, data_fim, dias_executados, valor_total_gasto, updated_at, obras_instalacoes(obra:obra_id(nome, cidade, estado, empresas_obras(empresa:empresa_id(nome)))), instalacoes_equipe(equipe:equipe_id(nome))')
    .order('data_inicio', { ascending: false })
    .range(from, from + 999);
   if (res.error) throw new Error(res.error.message);
   allData = allData.concat(res.data || []);
   if (!res.data || res.data.length < 1000) break;
   from += 1000;
  }
  _instArr = allData;
  // Badge do menu lateral: ver _navBadgesLoadInitial() (RPC de contagem no
  // boot) — antes só era preenchido aqui, ou seja, só depois que o usuário
  // abrisse a aba Instalações pelo menos uma vez (bug relatado).
  // Tempo real POR LINHA (_instInitRealtime): o _rtWatch que estava aqui
  // recarregava a lista inteira a cada alteração de qualquer instalação, o que
  // apagava filtro/agrupamento/scroll de quem estivesse olhando a tela.
  _instInitRealtime();
  if (!tbody) return;
  if (!allData.length) {
   tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--muted)">Nenhuma instalação encontrada.</td></tr>';
   return;
  }
  tbody.innerHTML = allData.map(_instRowHTML).join('');
 } catch(e) {
  // Mensagem técnica fica só no console; o usuário lê português.
  console.error('[Instalações] erro ao carregar a lista:', e);
  if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--red)">Não foi possível carregar as instalações agora. Tente recarregar a página.</td></tr>';
 }
}

// Uma instalação → uma <tr>. Extraído do corpo de _dbLoadInstalacoes pra que o
// tempo real consiga redesenhar SÓ a linha alterada (mesmo padrão de
// _obraRowHTML/_entRowHTML), em vez de recarregar a lista inteira e derrubar o
// filtro/agrupamento/scroll de quem está olhando.
function _instRowHTML(inst) {
 var obrasLigadas = (inst.obras_instalacoes || []).map(function(x){ return x.obra; }).filter(Boolean);
 var obraNome = obrasLigadas.length ? obrasLigadas.map(function(o){ return o.nome; }).join(', ') : '—';
 var clienteNome = '—';
 try { clienteNome = obrasLigadas[0].empresas_obras[0].empresa.nome || '—'; } catch(e) {}
 var cidadeObra = Array.from(new Set(obrasLigadas.map(function(o){ return o.cidade; }).filter(Boolean))).join(', ');
 var estadoObra = Array.from(new Set(obrasLigadas.map(function(o){ return o.estado; }).filter(Boolean))).join(', ');
 var tipo = inst.tipo_servico || '—';
 var equipeNomes = (inst.instalacoes_equipe || []).map(function(x){ return x.equipe && x.equipe.nome; }).filter(Boolean).join(', ') || '—';
 var funil = inst.funil || '—';
 var cls = _INST_FUNIL_CLS[funil] || 'bm';
 var fmtDate = function(d) {
  if (!d) return '<span style="color:var(--border)">—</span>';
  var p = d.split('-'); return p[2]+'/'+p[1]+'/'+p[0].slice(2);
 };
 var diasProgramados = (inst.data_inicio && inst.data_fim) ? Math.round((new Date(inst.data_fim)-new Date(inst.data_inicio))/86400000) : null;
 var dias = inst.dias_executados != null ? inst.dias_executados : (diasProgramados != null ? diasProgramados : '—');
 // Nome/"Instalação" segue a fórmula pedida explicitamente (igual ao
 // Airtable): "{ID sequencial} - {Categoria do Serviço} - {Obra}".
 var nomeInst = (inst.numero != null ? inst.numero : '?') + ' - ' + (tipo !== '—' ? tipo : 'Instalação') + ' - ' + (obraNome !== '—' ? obraNome : '(sem obra)');
 return '<tr onclick="if(!event.target.closest(\'button,a,input,select\'))_spOpen(\'instalacoes\',this)" data-id="'+inst.id+'" data-funil="'+funil+'"'
  +' data-tipo="'+(tipo!=='—'?tipo:'')+'" data-obra="'+(obraNome!=='—'?obraNome.replace(/"/g,'&quot;'):'')+'" data-cliente="'+(clienteNome!=='—'?clienteNome.replace(/"/g,'&quot;'):'')+'"'
  +' data-nome="'+nomeInst.replace(/"/g,'&quot;')+'" data-equipe="'+(equipeNomes!=='—'?equipeNomes.replace(/"/g,'&quot;'):'')+'"'
  +' data-cidade="'+cidadeObra.replace(/"/g,'&quot;')+'" data-estado="'+estadoObra.replace(/"/g,'&quot;')+'"'
  +' data-diasprog="'+(diasProgramados!=null?diasProgramados:'')+'" data-diasexec="'+(inst.dias_executados!=null?inst.dias_executados:'')+'" data-valortotal="'+(inst.valor_total_gasto!=null?inst.valor_total_gasto:'')+'"'
  +' data-inicio="'+(inst.data_inicio||'')+'" data-fim="'+(inst.data_fim||'')+'" data-dias="'+(typeof dias==='number'?dias:0)+'">'
  + '<td style="font-weight:500">' + nomeInst + '</td>'
  + '<td style="color:var(--muted);font-size:12px">' + clienteNome + '</td>'
  + '<td>' + (tipo !== '—' ? '<span class="badge bg">'+tipo+'</span>' : '<span style="color:var(--border)">—</span>') + '</td>'
  + '<td style="font-size:12px;color:var(--muted)">' + equipeNomes + '</td>'
  + '<td style="font-size:12px;color:var(--muted)">' + fmtDate(inst.data_inicio) + '</td>'
  + '<td style="font-size:12px;color:var(--muted)">' + fmtDate(inst.data_fim) + '</td>'
  + '<td style="text-align:center;font-size:12px">' + dias + '</td>'
  + '<td><span class="badge '+cls+'">'+funil+'</span></td>'
  + '<td><button class="btn btn-ghost btn-sm">Ver &rarr;</button></td>'
  + '</tr>';
}

// Aplica no array em memória a linha alterada (save próprio ou tempo real) e
// redesenha só a <tr> dela. Preserva os joins (obras/equipes), que o payload
// do postgres_changes não traz.
function _instPatchNaLista(patch, idExplicito) {
 if (!patch) return;
 var id = idExplicito || patch.id;
 if (!id) return;
 var idx = (_instArr || []).findIndex(function (x) { return String(x.id) === String(id); });
 if (idx === -1) return;
 Object.keys(patch).forEach(function (k) {
  if (k === 'obras_instalacoes' || k === 'instalacoes_equipe') return;
  _instArr[idx][k] = patch[k];
 });
 var tr = document.querySelector('#inst-tbody tr[data-id="' + id + '"]');
 if (tr) tr.outerHTML = _instRowHTML(_instArr[idx]);
 if (typeof _instApplyFilters === 'function') _instApplyFilters();
}

// Tempo real por linha. Substitui o _rtWatch antigo (que recarregava a lista
// INTEIRA a cada alteração de qualquer instalação, apagando filtro e scroll de
// quem estivesse olhando). A chave 'instalacoes' faz _rtWatchRows substituir o
// handler anterior em vez de acumular um novo a cada visita à aba.
function _instInitRealtime() {
 if (typeof _rtWatchRows !== 'function') return;
 _rtWatchRows('instalacoes', 'instalacoes', {
  onUpdate: function (nova) {
   if (!nova || !nova.id) return;
   _instPatchNaLista(nova);
   if (String((_instAtiva || {}).id) === String(nova.id)
    && document.getElementById('sp-drawer')?.classList.contains('sp-open')
    && typeof _rtAvisoAlteracaoExterna === 'function') {
    // instalacoes não tem coluna de "quem alterou" — a faixa sai sem nome,
    // que _rtAvisoAlteracaoExterna já trata como "Outro usuário".
    _rtAvisoAlteracaoExterna(null, "_spInstalacaoById('" + nova.id + "')");
    if (typeof _ccSetBaseline === 'function') _ccSetBaseline('instalacoes', nova.id, nova);
   }
  },
  // Instalação nova precisa dos joins de obra/equipe pra <tr> sair completa —
  // recarrega a lista só nesse caso (evento raro), nunca a cada edição.
  onInsert: function () { if (typeof _dbLoadInstalacoes === 'function') _dbLoadInstalacoes(); },
  onDelete: function (_nova, antiga) {
   var id = antiga && antiga.id;
   if (!id) return;
   var i = (_instArr || []).findIndex(function (x) { return String(x.id) === String(id); });
   if (i !== -1) _instArr.splice(i, 1);
   var tr = document.querySelector('#inst-tbody tr[data-id="' + id + '"]');
   if (tr) tr.remove();
   if (String((_instAtiva || {}).id) === String(id)) {
    _showToast('A instalação que você tinha aberta foi excluída por outro usuário.', 'erro');
    closePanel();
   }
  },
 });
}
