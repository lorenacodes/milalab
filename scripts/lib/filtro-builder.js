// ═══════════════════════════════════════════════════════════════════════════
// FILTRO BUILDER — sistema de filtros reutilizável (estilo Airtable): cada
// condição é campo + operador + valor, combináveis com E/OU. Cada módulo
// declara sua própria lista de campos (chave, rótulo, tipo, opções) e chama
// _fbEvaluate(item, instanceId) pra decidir se um registro passa no filtro —
// a lógica de carregar/exibir dados continua 100% do módulo, isso aqui só
// decide o match sim/não. Pensado pra ser usado em qualquer página do
// sistema (Gestor de Tarefas, Obras, Empresas, Projetos, Entregas...), não
// só num módulo específico.
// ═══════════════════════════════════════════════════════════════════════════
var _fbInstances = {}; // { instanceId: { fields, state:{logic,conditions:[...]}, onChange, open } }
var _fbUid = 0;

var FB_OPS = {
 text:      [['contains','contém'],['ncontains','não contém'],['eq','é'],['neq','não é'],['empty','está vazio'],['nempty','não está vazio']],
 select:    [['eq','é'],['neq','não é'],['anyof','é qualquer um de'],['noneof','não é nenhum de'],['empty','está vazio'],['nempty','não está vazio']],
 multitext: [['contains','contém'],['anyof','é qualquer um de'],['empty','está vazio'],['nempty','não está vazio']],
 date:      [['eq','é'],['before','é antes de'],['after','é depois de'],['empty','está vazio'],['nempty','não está vazio']],
};

// fields: [{key,label,type:'text'|'select'|'multitext'|'date', options:[]|fn, getValue:fn(item)}]
function _fbInit(instanceId, fields, onChange) {
 _fbInstances[instanceId] = { fields: fields, state: { logic:'AND', conditions: [] }, onChange: onChange, open: false };
}
function _fbFieldByKey(inst, key) { return inst.fields.filter(function(f){ return f.key === key; })[0] || inst.fields[0]; }
function _fbNewCondition(inst) {
 var f = inst.fields[0];
 return { id: 'c'+(++_fbUid), field: f.key, operator: FB_OPS[f.type][0][0], value: (f.type==='select'||f.type==='multitext') ? [] : '' };
}
function _fbConditionIsUsable(c) {
 if (c.operator==='empty' || c.operator==='nempty') return true;
 if (Array.isArray(c.value)) return c.value.length > 0;
 return c.value !== undefined && c.value !== null && String(c.value).trim() !== '';
}

// ── Abrir/fechar popover ─────────────────────────────────────────────────
function _fbToggle(instanceId) {
 var inst = _fbInstances[instanceId];
 if (!inst) return;
 inst.open = !inst.open;
 if (inst.open && inst.state.conditions.length === 0) inst.state.conditions.push(_fbNewCondition(inst));
 _fbRender(instanceId);
}
document.addEventListener('click', function(e) {
 Object.keys(_fbInstances).forEach(function(id) {
  var inst = _fbInstances[id];
  if (inst.open && !e.target.closest('#fb-wrap-' + id)) { inst.open = false; _fbRenderPopoverVisibility(id); }
 });
});

// ── Edição de condições ──────────────────────────────────────────────────
function _fbAddCondition(instanceId) {
 var inst = _fbInstances[instanceId];
 inst.state.conditions.push(_fbNewCondition(inst));
 _fbRender(instanceId);
}
function _fbRemoveCondition(instanceId, condId) {
 var inst = _fbInstances[instanceId];
 inst.state.conditions = inst.state.conditions.filter(function(c){ return c.id !== condId; });
 _fbRender(instanceId);
 _fbApply(instanceId);
}
function _fbMoveCondition(instanceId, condId, dir) {
 var inst = _fbInstances[instanceId];
 var arr = inst.state.conditions;
 var i = -1; arr.forEach(function(c,idx){ if (c.id===condId) i=idx; });
 var j = i + dir;
 if (i < 0 || j < 0 || j >= arr.length) return;
 var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
 _fbRender(instanceId);
 _fbApply(instanceId);
}
function _fbSetLogic(instanceId, logic) {
 _fbInstances[instanceId].state.logic = logic;
 _fbRender(instanceId);
 _fbApply(instanceId);
}
function _fbFieldChange(instanceId, condId, fieldKey) {
 var inst = _fbInstances[instanceId];
 var c = inst.state.conditions.filter(function(x){ return x.id===condId; })[0];
 var f = _fbFieldByKey(inst, fieldKey);
 c.field = fieldKey;
 c.operator = FB_OPS[f.type][0][0];
 c.value = (f.type==='select'||f.type==='multitext') ? [] : '';
 _fbRender(instanceId);
 _fbApply(instanceId);
}
function _fbOperatorChange(instanceId, condId, op) {
 var inst = _fbInstances[instanceId];
 var c = inst.state.conditions.filter(function(x){ return x.id===condId; })[0];
 var f = _fbFieldByKey(inst, c.field);
 c.operator = op;
 if (op==='anyof' || op==='noneof') { if (!Array.isArray(c.value)) c.value = []; }
 else if (f.type==='select' && Array.isArray(c.value)) { c.value = ''; }
 _fbRender(instanceId);
 _fbApply(instanceId);
}
function _fbValueChange(instanceId, condId, val) {
 var inst = _fbInstances[instanceId];
 var c = inst.state.conditions.filter(function(x){ return x.id===condId; })[0];
 c.value = val;
 _fbApply(instanceId);
}
function _fbValueToggleOpt(instanceId, condId, opt, checked) {
 var inst = _fbInstances[instanceId];
 var c = inst.state.conditions.filter(function(x){ return x.id===condId; })[0];
 if (!Array.isArray(c.value)) c.value = [];
 var i = c.value.indexOf(opt);
 if (checked && i === -1) c.value.push(opt);
 else if (!checked && i !== -1) c.value.splice(i, 1);
 _fbApply(instanceId);
 _fbUpdateBadge(instanceId);
 var btn = document.querySelector('#fb-pop-' + instanceId + ' .fb-msel-btn[data-cond="' + condId + '"]');
 if (btn) btn.textContent = c.value.length ? (c.value.length + ' selecionado(s)') : 'Selecionar...';
}
function _fbClearAll(instanceId) {
 var inst = _fbInstances[instanceId];
 inst.state.conditions = [];
 _fbRender(instanceId);
 _fbApply(instanceId);
}
function _fbApply(instanceId) {
 var inst = _fbInstances[instanceId];
 _fbUpdateBadge(instanceId);
 if (inst.onChange) inst.onChange(inst.state);
}
function _fbUpdateBadge(instanceId) {
 var inst = _fbInstances[instanceId];
 var n = inst.state.conditions.filter(_fbConditionIsUsable).length;
 var badge = document.getElementById('fb-badge-' + instanceId);
 if (badge) { badge.textContent = n; badge.style.display = n ? '' : 'none'; }
 var btn = document.getElementById('fb-btn-' + instanceId);
 if (btn) btn.classList.toggle('active', n > 0);
}

// ── Avaliação: dado um registro, decide se passa no filtro atual ──────────
function _fbEvaluate(item, instanceId) {
 var inst = _fbInstances[instanceId];
 if (!inst) return true;
 var conds = inst.state.conditions.filter(_fbConditionIsUsable);
 if (!conds.length) return true;
 var results = conds.map(function(c) { return _fbEvalCondition(item, inst, c); });
 return inst.state.logic === 'OR' ? results.some(Boolean) : results.every(Boolean);
}
function _fbEvalCondition(item, inst, c) {
 var f = _fbFieldByKey(inst, c.field);
 // matchValue: hook opcional pra campos onde comparar getValue(item) === c.value
 // como texto simples não é suficiente (ex.: um pseudo-valor computado, tipo
 // "Atrasado", que não deve MASCARAR o valor real do campo — só ser mais uma
 // opção de busca além dele). Quando presente, assume o lugar inteiro da
 // comparação eq/neq/anyof/noneof/empty/nempty pra esse campo.
 if (f.matchValue) return f.matchValue(item, c.operator, c.value);
 var raw = f.getValue ? f.getValue(item) : item[c.field];
 if (f.type === 'multitext') {
  var arr = (raw || '').split(/[,;]+/).map(function(s){ return s.trim(); }).filter(Boolean);
  if (c.operator === 'empty')  return arr.length === 0;
  if (c.operator === 'nempty') return arr.length > 0;
  if (c.operator === 'contains') return arr.some(function(v){ return v.toLowerCase().indexOf(String(c.value).toLowerCase()) !== -1; });
  if (c.operator === 'anyof') return arr.some(function(v){ return (c.value||[]).indexOf(v) !== -1; });
  return true;
 }
 if (f.type === 'date') {
  var d = raw ? new Date(raw + 'T00:00:00') : null;
  if (c.operator === 'empty')  return !d;
  if (c.operator === 'nempty') return !!d;
  if (!d) return false;
  var cv = c.value ? new Date(c.value + 'T00:00:00') : null;
  if (!cv) return true;
  if (c.operator === 'eq')     return d.getTime() === cv.getTime();
  if (c.operator === 'before') return d.getTime() < cv.getTime();
  if (c.operator === 'after')  return d.getTime() > cv.getTime();
  return true;
 }
 // text / select
 var sv = (raw === undefined || raw === null) ? '' : String(raw);
 if (c.operator === 'empty')  return sv.trim() === '';
 if (c.operator === 'nempty') return sv.trim() !== '';
 if (c.operator === 'contains')  return sv.toLowerCase().indexOf(String(c.value).toLowerCase()) !== -1;
 if (c.operator === 'ncontains') return sv.toLowerCase().indexOf(String(c.value).toLowerCase()) === -1;
 if (c.operator === 'eq')  return sv.toLowerCase() === String(c.value).toLowerCase();
 if (c.operator === 'neq') return sv.toLowerCase() !== String(c.value).toLowerCase();
 if (c.operator === 'anyof')  return (c.value||[]).indexOf(sv) !== -1;
 if (c.operator === 'noneof') return (c.value||[]).indexOf(sv) === -1;
 return true;
}

// ── Render do popover ────────────────────────────────────────────────────
function _fbRenderPopoverVisibility(instanceId) {
 var pop = document.getElementById('fb-pop-' + instanceId);
 if (pop) pop.style.display = _fbInstances[instanceId].open ? 'block' : 'none';
}
function _fbRender(instanceId) {
 var inst = _fbInstances[instanceId];
 var pop = document.getElementById('fb-pop-' + instanceId);
 if (!pop) return;
 var rows = inst.state.conditions.map(function(c, idx) {
  var f = _fbFieldByKey(inst, c.field);
  var ops = FB_OPS[f.type];
  var fieldOpts = inst.fields.map(function(ff) {
   return '<option value="' + ff.key + '"' + (ff.key === c.field ? ' selected' : '') + '>' + ff.label + '</option>';
  }).join('');
  var opOpts = ops.map(function(o) {
   return '<option value="' + o[0] + '"' + (o[0] === c.operator ? ' selected' : '') + '>' + o[1] + '</option>';
  }).join('');
  var leadHtml = idx === 0
   ? '<span class="fb-lead">Onde</span>'
   : '<select class="fb-logic-sel" onchange="_fbSetLogic(\'' + instanceId + '\',this.value)">'
     + '<option value="AND"' + (inst.state.logic==='AND' ? ' selected' : '') + '>E</option>'
     + '<option value="OR"'  + (inst.state.logic==='OR'  ? ' selected' : '') + '>OU</option></select>';
  var moveHtml = '<span class="fb-move">'
   + '<button type="button" title="Mover para cima" onclick="_fbMoveCondition(\'' + instanceId + '\',\'' + c.id + '\',-1)"' + (idx===0?' disabled':'') + '>&#9650;</button>'
   + '<button type="button" title="Mover para baixo" onclick="_fbMoveCondition(\'' + instanceId + '\',\'' + c.id + '\',1)"' + (idx===inst.state.conditions.length-1?' disabled':'') + '>&#9660;</button>'
   + '</span>';
  return '<div class="fb-row">'
   + '<div class="fb-lead-wrap">' + leadHtml + '</div>'
   + '<select class="fb-field-sel" onchange="_fbFieldChange(\'' + instanceId + '\',\'' + c.id + '\',this.value)">' + fieldOpts + '</select>'
   + '<select class="fb-op-sel" onchange="_fbOperatorChange(\'' + instanceId + '\',\'' + c.id + '\',this.value)">' + opOpts + '</select>'
   + _fbRenderValueInput(instanceId, c, f)
   + moveHtml
   + '<button type="button" class="fb-row-del" title="Remover" onclick="_fbRemoveCondition(\'' + instanceId + '\',\'' + c.id + '\')">&times;</button>'
   + '</div>';
 }).join('');
 pop.innerHTML =
  '<div class="fb-hd"><span>Filtro</span>'
  + (inst.state.conditions.length ? '<button type="button" class="fb-clear-all" onclick="_fbClearAll(\'' + instanceId + '\')">Limpar tudo</button>' : '')
  + '</div>'
  + (rows || '<div class="fb-empty">Nenhuma condição aplicada</div>')
  + '<button type="button" class="fb-add" onclick="_fbAddCondition(\'' + instanceId + '\')">+ Adicionar condição</button>';
 _fbRenderPopoverVisibility(instanceId);
 _fbUpdateBadge(instanceId);
}
function _fbRenderValueInput(instanceId, c, f) {
 if (c.operator === 'empty' || c.operator === 'nempty') return '<span class="fb-val-empty"></span>';
 if (c.operator === 'anyof' || c.operator === 'noneof') {
  var opts = (typeof f.options === 'function') ? f.options() : (f.options || []);
  var sel = Array.isArray(c.value) ? c.value : [];
  return '<div class="fb-msel-wrap">'
   + '<button type="button" class="fb-msel-btn" data-cond="' + c.id + '" onclick="this.nextElementSibling.classList.toggle(\'open\')">'
   + (sel.length ? sel.length + ' selecionado(s)' : 'Selecionar...') + '</button>'
   + '<div class="fb-msel-panel">' + opts.map(function(o) {
      var ck = sel.indexOf(o) !== -1 ? ' checked' : '';
      return '<label><input type="checkbox" value="' + o.replace(/"/g,'&quot;') + '"' + ck
       + ' onchange="_fbValueToggleOpt(\'' + instanceId + '\',\'' + c.id + '\',this.value,this.checked)"> ' + o + '</label>';
     }).join('') + '</div></div>';
 }
 if (f.type === 'select') {
  var opts2 = (typeof f.options === 'function') ? f.options() : (f.options || []);
  return '<select class="fb-val-sel" onchange="_fbValueChange(\'' + instanceId + '\',\'' + c.id + '\',this.value)">'
   + '<option value="">Selecione...</option>'
   + opts2.map(function(o) { return '<option value="' + o.replace(/"/g,'&quot;') + '"' + (c.value===o?' selected':'') + '>' + o + '</option>'; }).join('')
   + '</select>';
 }
 if (f.type === 'date') {
  return '<input type="date" class="fb-val-date" value="' + (c.value||'') + '" onchange="_fbValueChange(\'' + instanceId + '\',\'' + c.id + '\',this.value)">';
 }
 return '<input type="text" class="fb-val-text" placeholder="Digite um valor..." value="' + ((c.value||'')+'').replace(/"/g,'&quot;')
  + '" oninput="_fbValueChange(\'' + instanceId + '\',\'' + c.id + '\',this.value)">';
}
