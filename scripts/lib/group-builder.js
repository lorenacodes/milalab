// ═══════════════════════════════════════════════════════════════════════════
// GROUP BUILDER — agrupamento reutilizável (estilo Airtable): popover
// "Agrupar por" com o campo ativo em cima e os demais campos disponíveis
// numa lista rápida embaixo. Mesma arquitetura do filtro-builder.js/
// sort-builder.js. A engine já guarda uma LISTA de níveis (pra permitir
// agrupamento em mais de um campo no futuro, seção 3 do pedido original),
// mas um módulo pode travar em 1 nível (maxLevels:1) enquanto sua tela de
// renderização só souber desenhar um nível — é o caso do Gestor de Tarefas
// hoje. Cada módulo só lê _gbPrimaryField(instanceId) pra saber o campo
// ativo e decide por conta própria COMO agrupar os dados (a lógica de
// agrupamento em si — quais itens caem em qual grupo — continua no módulo,
// isso aqui só guarda "qual campo está selecionado").
// ═══════════════════════════════════════════════════════════════════════════
var _gbInstances = {}; // { instanceId: { fields, maxLevels, state:{levels:[{field}]}, onChange, open } }

function _gbInit(instanceId, fields, onChange, maxLevels) {
 _gbInstances[instanceId] = { fields: fields, maxLevels: maxLevels || Infinity, state: { levels: [] }, onChange: onChange, open: false };
}
function _gbFieldByKey(inst, key) { return inst.fields.filter(function(f){ return f.key === key; })[0] || inst.fields[0]; }
function _gbPrimaryField(instanceId) {
 var inst = _gbInstances[instanceId];
 if (!inst || !inst.state.levels.length) return null;
 return inst.state.levels[0].field;
}
// Ordem de exibição dos grupos daquele nível — 'asc' (padrão) ou 'desc'.
// Usada pelos módulos que só têm 1 nível de agrupamento hoje (Obras,
// Entregas) e repassam isto pra _gtBuildTree (Gestor/Empresas/Contatos já
// passam o level inteiro, dir incluso, direto de inst.state.levels).
function _gbPrimaryDir(instanceId) {
 var inst = _gbInstances[instanceId];
 if (!inst || !inst.state.levels.length) return 'asc';
 return inst.state.levels[0].dir || 'asc';
}

function _gbToggle(instanceId) {
 var inst = _gbInstances[instanceId];
 if (!inst) return;
 inst.open = !inst.open;
 _gbRender(instanceId);
}
if (typeof document !== 'undefined') {
 document.addEventListener('click', function(e) {
  // composedPath(), não e.target.closest() — ver comentário equivalente em
  // filtro-builder.js: qualquer ação que reconstrua o popover via innerHTML
  // destaca o elemento clicado do DOM antes deste listener rodar.
  var path = e.composedPath ? e.composedPath() : [e.target];
  Object.keys(_gbInstances).forEach(function(id) {
   var inst = _gbInstances[id];
   var wrap = document.getElementById('gb-wrap-' + id);
   if (inst.open && wrap && path.indexOf(wrap) === -1) { inst.open = false; _gbRenderVisibility(id); }
  });
 });
}

function _gbSetLevel(instanceId, fieldKey) {
 var inst = _gbInstances[instanceId];
 inst.state.levels = [{ field: fieldKey, dir: 'asc' }];
 _gbRender(instanceId);
 _gbApply(instanceId);
}
function _gbAddLevel(instanceId, fieldKey) {
 var inst = _gbInstances[instanceId];
 var used = inst.state.levels.map(function(l){ return l.field; });
 if (used.indexOf(fieldKey) !== -1) return;
 inst.state.levels.push({ field: fieldKey, dir: 'asc' });
 _gbRender(instanceId);
 _gbApply(instanceId);
}
function _gbLevelDirChange(instanceId, idx, dir) {
 var inst = _gbInstances[instanceId];
 inst.state.levels[idx].dir = dir;
 _gbApply(instanceId);
}
function _gbRemoveLevel(instanceId, idx) {
 var inst = _gbInstances[instanceId];
 inst.state.levels.splice(idx, 1);
 _gbRender(instanceId);
 _gbApply(instanceId);
}
function _gbClearAll(instanceId) {
 var inst = _gbInstances[instanceId];
 inst.state.levels = [];
 _gbRender(instanceId);
 _gbApply(instanceId);
}
function _gbApply(instanceId) {
 _gbUpdateBadge(instanceId);
 var inst = _gbInstances[instanceId];
 if (inst.onChange) inst.onChange(inst.state);
}
function _gbUpdateBadge(instanceId) {
 if (typeof document === 'undefined') return; // Node (testes) — sem DOM, no-op
 var inst = _gbInstances[instanceId];
 var n = inst.state.levels.length;
 var badge = document.getElementById('gb-badge-' + instanceId);
 if (badge) { badge.textContent = n; badge.style.display = n ? '' : 'none'; }
 var btn = document.getElementById('gb-btn-' + instanceId);
 if (btn) btn.classList.toggle('active', n > 0);
}

// ── Render do popover ────────────────────────────────────────────────────
function _gbRenderVisibility(instanceId) {
 if (typeof document === 'undefined') return; // Node (testes) — sem DOM, no-op
 var pop = document.getElementById('gb-pop-' + instanceId);
 var wrap = document.getElementById('gb-wrap-' + instanceId);
 var open = _gbInstances[instanceId].open;
 if (pop) pop.style.display = open ? 'block' : 'none';
 if (open && wrap && typeof _tsSmartPosition === 'function') _tsSmartPosition(wrap, pop);
}
function _gbRender(instanceId) {
 if (typeof document === 'undefined') return; // Node (testes) — sem DOM, no-op
 var inst = _gbInstances[instanceId];
 var pop = document.getElementById('gb-pop-' + instanceId);
 if (!pop) return;
 var used = inst.state.levels.map(function(l){ return l.field; });

 var activeRows = inst.state.levels.map(function(lvl, idx) {
  var f = _gbFieldByKey(inst, lvl.field);
  var fieldOpts = inst.fields.map(function(ff) {
   return '<option value="' + ff.key + '"' + (ff.key === lvl.field ? ' selected' : '') + '>' + ff.label + '</option>';
  }).join('');
  var onChangeFn = idx === 0
   ? '_gbSetLevel(\'' + instanceId + '\',this.value)'
   : '_gbLevelFieldChange(\'' + instanceId + '\',' + idx + ',this.value)';
  var dir = lvl.dir || 'asc';
  // Ordem de aparição dos grupos (pedido explícito, estilo Airtable) — A→Z
  // é o rótulo genérico; pra campos com ordem própria (datas, status com
  // fixedOrders) "A→Z" corresponde à ordem natural/cronológica e "Z→A" à
  // invertida, não literalmente alfabética.
  var dirSel = '<select class="fb-op-sel" style="flex:1" onchange="_gbLevelDirChange(\'' + instanceId + '\',' + idx + ',this.value)">'
   + '<option value="asc"' + (dir === 'asc' ? ' selected' : '') + '>A → Z</option>'
   + '<option value="desc"' + (dir === 'desc' ? ' selected' : '') + '>Z → A</option>'
   + '</select>';
  return '<div class="fb-row">'
   + '<div class="fb-lead-wrap" style="width:64px"><span class="fb-lead">' + (idx===0?'Agrupar por':'e depois') + '</span></div>'
   + '<select class="fb-field-sel" style="flex:2" onchange="' + onChangeFn + '">' + fieldOpts + '</select>'
   + dirSel
   + '<button type="button" class="fb-row-del" title="Remover" onclick="_gbRemoveLevel(\'' + instanceId + '\',' + idx + ')">&times;</button>'
   + '</div>';
 }).join('');

 var canAddMore = inst.state.levels.length > 0 && inst.state.levels.length < inst.maxLevels && inst.state.levels.length < inst.fields.length;
 var quickList = '';
 if (!inst.state.levels.length) {
  // Nada agrupado ainda: lista rápida de campos pra começar, igual à referência.
  quickList = '<div class="gb-quick-lbl">Agrupar por:</div>' + inst.fields.map(function(f) {
   return '<button type="button" class="gb-quick-item" onclick="_gbSetLevel(\'' + instanceId + '\',\'' + f.key + '\')">' + f.label + '</button>';
  }).join('');
 } else if (canAddMore) {
  quickList = '<div class="gb-quick-lbl">Adicionar agrupamento:</div>' + inst.fields.filter(function(f) {
   return used.indexOf(f.key) === -1;
  }).map(function(f) {
   return '<button type="button" class="gb-quick-item" onclick="_gbAddLevel(\'' + instanceId + '\',\'' + f.key + '\')">' + f.label + '</button>';
  }).join('');
 }

 pop.innerHTML =
  '<div class="fb-hd"><span>Agrupamento</span>'
  + (inst.state.levels.length ? '<button type="button" class="fb-clear-all" onclick="_gbClearAll(\'' + instanceId + '\')">Remover agrupamento</button>' : '')
  + '</div>'
  + activeRows + quickList;
 _gbRenderVisibility(instanceId);
 _gbUpdateBadge(instanceId);
}
function _gbLevelFieldChange(instanceId, idx, fieldKey) {
 var inst = _gbInstances[instanceId];
 inst.state.levels[idx].field = fieldKey;
 _gbRender(instanceId);
 _gbApply(instanceId);
}

// Export só pra Node (testes, node:test) — não muda nada no navegador.
if (typeof module !== 'undefined' && module.exports) {
 module.exports = { _gbInstances, _gbInit, _gbPrimaryField, _gbPrimaryDir, _gbSetLevel, _gbAddLevel, _gbRemoveLevel,
 _gbClearAll, _gbLevelFieldChange, _gbLevelDirChange, _gbToggle };
}
