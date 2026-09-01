// ═══════════════════════════════════════════════════════════════════════════
// SORT BUILDER — ordenação múltipla reutilizável (estilo Airtable): cada nível
// é campo + direção, aplicados em cascata (o 1º decide, o 2º só desempata o
// que o 1º deixou igual, e assim por diante). Mesma arquitetura do
// filtro-builder.js — cada módulo declara sua lista de campos e chama
// _sbCompare(a, b, instanceId) dentro do próprio .sort() que já tinha.
// ═══════════════════════════════════════════════════════════════════════════
var _sbInstances = {}; // { instanceId: { fields, state:{levels:[{field,dir}]}, onChange, open } }
var _sbUid = 0;

// fields: [{key,label,type:'text'|'number'|'date', getValue:fn(item)}]
function _sbInit(instanceId, fields, onChange) {
 _sbInstances[instanceId] = { fields: fields, state: { levels: [] }, onChange: onChange, open: false };
}
function _sbFieldByKey(inst, key) { return inst.fields.filter(function(f){ return f.key === key; })[0] || inst.fields[0]; }
function _sbDirLabels(type) {
 return type === 'text' ? [['asc','A → Z'],['desc','Z → A']] : [['asc','Crescente'],['desc','Decrescente']];
}
function _sbNewLevel(inst, usedKeys) {
 var f = inst.fields.filter(function(x){ return usedKeys.indexOf(x.key) === -1; })[0] || inst.fields[0];
 return { field: f.key, dir: 'asc' };
}

function _sbToggle(instanceId) {
 var inst = _sbInstances[instanceId];
 if (!inst) return;
 inst.open = !inst.open;
 // Abrir o popover pela 1ª vez (ou depois de _sbClearAll) já pré-seleciona um
 // nível padrão (1º campo, A→Z) — sem chamar _sbApply aqui, a lista fica
 // mostrando esse nível como "ativo" (badge, campo/direção selecionados) mas
 // os DADOS continuam na ordem antiga até o usuário mudar campo/direção de
 // novo. Achado real: "ordenar Z→A só funciona depois de passar por A→Z" —
 // a troca pra A→Z nem aplicava nada (já era o valor "fantasma" pré-
 // selecionado, sem onchange real); só a troca seguinte, pra Z→A, disparava
 // o 1º _sbApply de verdade.
 if (inst.open && inst.state.levels.length === 0) {
  inst.state.levels.push(_sbNewLevel(inst, []));
  _sbRender(instanceId);
  _sbApply(instanceId);
  return;
 }
 _sbRender(instanceId);
}
// typeof document check: permite carregar este arquivo em Node (node:test)
// sem quebrar — no navegador `document` sempre existe, comportamento igual.
if (typeof document !== 'undefined') {
 document.addEventListener('click', function(e) {
  // composedPath(), não e.target.closest() — ver comentário equivalente em
  // filtro-builder.js: qualquer ação que reconstrua o popover via innerHTML
  // destaca o elemento clicado do DOM antes deste listener rodar.
  var path = e.composedPath ? e.composedPath() : [e.target];
  Object.keys(_sbInstances).forEach(function(id) {
   var inst = _sbInstances[id];
   var wrap = document.getElementById('sb-wrap-' + id);
   if (inst.open && wrap && path.indexOf(wrap) === -1) { inst.open = false; _sbRenderVisibility(id); }
  });
 });
}

function _sbAddLevel(instanceId) {
 var inst = _sbInstances[instanceId];
 var used = inst.state.levels.map(function(l){ return l.field; });
 inst.state.levels.push(_sbNewLevel(inst, used));
 _sbRender(instanceId);
 _sbApply(instanceId);
}
function _sbRemoveLevel(instanceId, idx) {
 var inst = _sbInstances[instanceId];
 inst.state.levels.splice(idx, 1);
 _sbRender(instanceId);
 _sbApply(instanceId);
}
function _sbMoveLevel(instanceId, idx, dir) {
 var inst = _sbInstances[instanceId];
 var arr = inst.state.levels;
 var j = idx + dir;
 if (j < 0 || j >= arr.length) return;
 var tmp = arr[idx]; arr[idx] = arr[j]; arr[j] = tmp;
 _sbRender(instanceId);
 _sbApply(instanceId);
}
function _sbFieldChange(instanceId, idx, fieldKey) {
 var inst = _sbInstances[instanceId];
 inst.state.levels[idx].field = fieldKey;
 _sbRender(instanceId);
 _sbApply(instanceId);
}
function _sbDirChange(instanceId, idx, dir) {
 var inst = _sbInstances[instanceId];
 inst.state.levels[idx].dir = dir;
 _sbApply(instanceId);
}
function _sbClearAll(instanceId) {
 var inst = _sbInstances[instanceId];
 inst.state.levels = [];
 _sbRender(instanceId);
 _sbApply(instanceId);
}
function _sbApply(instanceId) {
 _sbUpdateBadge(instanceId);
 var inst = _sbInstances[instanceId];
 if (inst.onChange) inst.onChange(inst.state);
}
function _sbUpdateBadge(instanceId) {
 if (typeof document === 'undefined') return; // Node (testes) — sem DOM, no-op
 var inst = _sbInstances[instanceId];
 var n = inst.state.levels.length;
 var badge = document.getElementById('sb-badge-' + instanceId);
 if (badge) { badge.textContent = n; badge.style.display = n ? '' : 'none'; }
 var btn = document.getElementById('sb-btn-' + instanceId);
 if (btn) btn.classList.toggle('active', n > 0);
}

// ── Comparador em cascata — plugar direto num .sort() ───────────────────
function _sbCompare(a, b, instanceId) {
 var inst = _sbInstances[instanceId];
 if (!inst || !inst.state.levels.length) return 0;
 for (var i = 0; i < inst.state.levels.length; i++) {
  var lvl = inst.state.levels[i];
  var f = _sbFieldByKey(inst, lvl.field);
  var r = _sbCompareOne(a, b, f);
  if (r !== 0) return lvl.dir === 'desc' ? -r : r;
 }
 return 0;
}
function _sbCompareOne(a, b, f) {
 var va = f.getValue ? f.getValue(a) : a[f.key];
 var vb = f.getValue ? f.getValue(b) : b[f.key];
 if (f.type === 'date') {
  var da = va ? new Date(va + 'T00:00:00').getTime() : Infinity;
  var db = vb ? new Date(vb + 'T00:00:00').getTime() : Infinity;
  return da - db;
 }
 if (f.type === 'number') {
  var na = (va === undefined || va === null || va === '') ? Infinity : Number(va);
  var nb = (vb === undefined || vb === null || vb === '') ? Infinity : Number(vb);
  return na - nb;
 }
 return String(va || '').localeCompare(String(vb || ''), 'pt-BR');
}

// ── Render do popover ────────────────────────────────────────────────────
function _sbRenderVisibility(instanceId) {
 if (typeof document === 'undefined') return; // Node (testes) — sem DOM, no-op
 var pop = document.getElementById('sb-pop-' + instanceId);
 var wrap = document.getElementById('sb-wrap-' + instanceId);
 var open = _sbInstances[instanceId].open;
 if (pop) pop.style.display = open ? 'block' : 'none';
 if (open && wrap && typeof _tsSmartPosition === 'function') _tsSmartPosition(wrap, pop);
}
function _sbRender(instanceId) {
 if (typeof document === 'undefined') return; // Node (testes) — sem DOM, no-op
 var inst = _sbInstances[instanceId];
 var pop = document.getElementById('sb-pop-' + instanceId);
 if (!pop) return;
 var used = inst.state.levels.map(function(l){ return l.field; });
 var rows = inst.state.levels.map(function(lvl, idx) {
  var f = _sbFieldByKey(inst, lvl.field);
  var fieldOpts = inst.fields.map(function(ff) {
   var disabled = used.indexOf(ff.key) !== -1 && ff.key !== lvl.field ? ' disabled' : '';
   return '<option value="' + ff.key + '"' + (ff.key === lvl.field ? ' selected' : '') + disabled + '>' + ff.label + '</option>';
  }).join('');
  var dirOpts = _sbDirLabels(f.type).map(function(d) {
   return '<option value="' + d[0] + '"' + (d[0] === lvl.dir ? ' selected' : '') + '>' + d[1] + '</option>';
  }).join('');
  var lead = idx === 0 ? '<span class="fb-lead">Ordenar por</span>' : '<span class="fb-lead">e depois</span>';
  return '<div class="fb-row">'
   + '<div class="fb-lead-wrap" style="width:64px">' + lead + '</div>'
   + '<select class="fb-field-sel" onchange="_sbFieldChange(\'' + instanceId + '\',' + idx + ',this.value)">' + fieldOpts + '</select>'
   + '<select class="fb-op-sel" onchange="_sbDirChange(\'' + instanceId + '\',' + idx + ',this.value)">' + dirOpts + '</select>'
   + '<button type="button" class="fb-row-del" title="Remover" onclick="_sbRemoveLevel(\'' + instanceId + '\',' + idx + ')">&times;</button>'
   + '</div>';
 }).join('');
 var canAdd = inst.state.levels.length < inst.fields.length;
 pop.innerHTML =
  '<div class="fb-hd"><span>Ordenação</span>'
  + (inst.state.levels.length ? '<button type="button" class="fb-clear-all" onclick="_sbClearAll(\'' + instanceId + '\')">Limpar tudo</button>' : '')
  + '</div>'
  + (rows || '<div class="fb-empty">Sem ordenação aplicada</div>')
  + (canAdd ? '<button type="button" class="fb-add" onclick="_sbAddLevel(\'' + instanceId + '\')">+ Adicionar ordenação</button>' : '');
 _sbRenderVisibility(instanceId);
 _sbUpdateBadge(instanceId);
}

// Export só pra Node (testes, node:test) — não muda nada no navegador.
if (typeof module !== 'undefined' && module.exports) {
 module.exports = { _sbInstances, _sbInit, _sbCompare, _sbCompareOne,
 _sbAddLevel, _sbRemoveLevel, _sbMoveLevel, _sbFieldChange, _sbDirChange, _sbClearAll };
}
