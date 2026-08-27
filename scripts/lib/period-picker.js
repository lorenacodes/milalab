// ═══════════════════════════════════════════════════════════════════════════
// PERIOD PICKER — dropdown de período reutilizável (presets + intervalo
// personalizado), mesmo padrão visual/funcional do "Período" do Gestor de
// Tarefas (scripts/modules/tarefas.js: _gpToggle/_gestorPreset), mas
// parametrizado por instanceId para reuso em outros módulos (Obras e
// futuramente outras abas). O Gestor de Tarefas continua com sua própria
// implementação (não foi tocado) — este componente é a versão genérica pra
// quem vier depois.
// ═══════════════════════════════════════════════════════════════════════════
var _ppInstances = {}; // { instanceId: { state:{ini,fim,preset}, onChange } }

function _ppInit(instanceId, opts) {
 _ppInstances[instanceId] = {
  onChange: (opts && opts.onChange) || null,
  state: { ini: null, fim: null, preset: (opts && opts.defaultPreset) || 'todas' }
 };
}

function _ppFmtDate(d) {
 return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
// Segunda-feira a domingo da semana atual (offsetWeeks=0) ou de N semanas à frente/atrás.
function _ppWeekRange(offsetWeeks) {
 var today = new Date(); today.setHours(0,0,0,0);
 var dow = today.getDay(); // 0=domingo
 var monday = new Date(today); monday.setDate(today.getDate() - ((dow+6)%7) + offsetWeeks*7);
 var sunday = new Date(monday); sunday.setDate(monday.getDate()+6);
 return { ini: monday, fim: sunday };
}

function _ppToggle(instanceId, force) {
 var pop = document.getElementById('pp-pop-' + instanceId);
 var wrap = document.getElementById('pp-wrap-' + instanceId);
 if (!pop) return;
 var open = force !== undefined ? force : (pop.style.display === 'none');
 pop.style.display = open ? 'flex' : 'none';
 if (open && wrap && typeof _tsSmartPosition === 'function') _tsSmartPosition(wrap, pop);
}

function _ppToggleCustomDates(instanceId) {
 var el = document.getElementById('pp-custom-' + instanceId);
 if (!el) return;
 el.style.display = el.style.display === 'none' ? 'inline-flex' : 'none';
}

function _ppSetInputDates(instanceId, ini, fim) {
 var ei = document.getElementById('pp-dt-ini-' + instanceId);
 var ef = document.getElementById('pp-dt-fim-' + instanceId);
 if (ei) ei.value = _ppFmtDate(ini);
 if (ef) ef.value = _ppFmtDate(fim);
}

function _ppPreset(instanceId, preset, btn) {
 var inst = _ppInstances[instanceId];
 if (!inst) return;
 var pop = document.getElementById('pp-pop-' + instanceId);
 if (pop) pop.querySelectorAll('.gp-preset').forEach(function(b){ b.classList.remove('active'); });
 if (btn) btn.classList.add('active');
 if (btn) {
  var cd = document.getElementById('pp-custom-' + instanceId);
  if (cd) cd.style.display = 'none';
 }

 var today = new Date(); today.setHours(0,0,0,0);
 var ini, fim;
 var lbl = document.getElementById('pp-btn-lbl-' + instanceId);

 // 'dia'/'3dias' — presets aditivos (ver Entregas, calendário com range Dia/
 // 3 dias/Semana/Customizado): mesma mecânica de ini/fim dos presets
 // existentes, só com intervalo de 1 ou 3 dias a partir de hoje.
 if (preset === 'dia') {
  ini = new Date(today); fim = new Date(today);
 } else if (preset === '3dias') {
  ini = new Date(today); fim = new Date(today); fim.setDate(fim.getDate() + 2);
 } else if (preset === 'semana') {
  var r = _ppWeekRange(0); ini = r.ini; fim = r.fim;
 } else if (preset === 'prox2') {
  var r0 = _ppWeekRange(0), r1 = _ppWeekRange(1); ini = r0.ini; fim = r1.fim;
 } else if (preset === 'mes') {
  ini = new Date(today.getFullYear(), today.getMonth(), 1);
  fim = new Date(today.getFullYear(), today.getMonth()+1, 0);
 } else if (preset === 'trim') {
  var qStart = Math.floor(today.getMonth()/3)*3;
  ini = new Date(today.getFullYear(), qStart, 1);
  fim = new Date(today.getFullYear(), qStart+3, 0);
 } else if (preset === 'todas') {
  inst.state = { ini: null, fim: null, preset: 'todas' };
  if (lbl) lbl.textContent = 'Todas';
  var ei = document.getElementById('pp-dt-ini-' + instanceId), ef = document.getElementById('pp-dt-fim-' + instanceId);
  if (ei) ei.value = ''; if (ef) ef.value = '';
  if (inst.onChange) inst.onChange(inst.state);
  _ppToggle(instanceId, false);
  return;
 } else if (preset === 'custom') {
  var ei2 = document.getElementById('pp-dt-ini-' + instanceId), ef2 = document.getElementById('pp-dt-fim-' + instanceId);
  var vs = ei2 ? ei2.value : '', ve = ef2 ? ef2.value : '';
  if (!vs || !ve) return; // aguarda ambas
  ini = new Date(vs + 'T00:00:00'); fim = new Date(ve + 'T00:00:00');
  if (pop) pop.querySelectorAll('.gp-preset').forEach(function(b){ b.classList.remove('active'); });
 }

 inst.state = { ini: ini, fim: fim, preset: preset };
 if (ini && fim) _ppSetInputDates(instanceId, ini, fim);
 if (lbl && ini && fim) {
  lbl.textContent = ini.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}) + ' – ' + fim.toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'});
 }
 if (inst.onChange) inst.onChange(inst.state);
 if (preset !== 'custom') _ppToggle(instanceId, false);
}

function _ppGetState(instanceId) {
 var inst = _ppInstances[instanceId];
 return inst ? inst.state : { ini: null, fim: null, preset: 'todas' };
}

// Restaura um estado salvo (usado por "Visualizações salvas") sem duplicar a
// lógica de cálculo de datas — só decide qual botão _ppPreset deve simular.
function _ppRestoreState(instanceId, saved) {
 if (!saved) return;
 if (saved.preset === 'custom' && saved.ini && saved.fim) {
  var ei = document.getElementById('pp-dt-ini-' + instanceId), ef = document.getElementById('pp-dt-fim-' + instanceId);
  if (ei) ei.value = saved.ini;
  if (ef) ef.value = saved.fim;
  var cd = document.getElementById('pp-custom-' + instanceId); if (cd) cd.style.display = 'inline-flex';
  _ppPreset(instanceId, 'custom', null);
 } else {
  var btn = document.getElementById('pp-' + (saved.preset || 'todas') + '-' + instanceId);
  _ppPreset(instanceId, saved.preset || 'todas', btn);
 }
}

if (typeof document !== 'undefined') {
 document.addEventListener('click', function(e) {
  var path = e.composedPath ? e.composedPath() : [e.target];
  Object.keys(_ppInstances).forEach(function(id) {
   var wrap = document.getElementById('pp-wrap-' + id);
   if (wrap && path.indexOf(wrap) === -1) _ppToggle(id, false);
  });
 });
}

// Export só pra Node (testes, node:test) — não muda nada no navegador.
if (typeof module !== 'undefined' && module.exports) {
 module.exports = { _ppInstances, _ppInit, _ppWeekRange, _ppPreset, _ppGetState, _ppRestoreState, _ppFmtDate };
}
