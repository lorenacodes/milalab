// ═══════════════════════════════════════════════════════════════════════════
// SAVED VIEWS — "Visualizações" reutilizável (estilo Airtable): salva/aplica
// combinações de filtro + ordenação + agrupamento + período com nome,
// persistidas no Supabase (tabela gestor_views — a coluna `modulo` já foi
// desenhada pra guardar views de mais de uma página). Mesmo padrão do Gestor
// de Tarefas (scripts/modules/tarefas.js: _gviews*), generalizado por
// instanceId/modulo pra reuso em outras abas. O Gestor de Tarefas continua
// com sua própria implementação (não foi tocado) — este componente é a
// versão genérica pra quem vier depois.
// ═══════════════════════════════════════════════════════════════════════════
var _vwInstances = {}; // { instanceId: { modulo, getState(), applyState(state) } }
var _vwCache = {};     // { instanceId: null|[] } — null = ainda não carregou

function _vwInit(instanceId, cfg) {
 _vwInstances[instanceId] = cfg || {};
 _vwCache[instanceId] = null;
}

function _vwToggle(instanceId, force) {
 var pop = document.getElementById('gv-pop-' + instanceId);
 var wrap = document.getElementById('gv-wrap-' + instanceId);
 if (!pop) return;
 var open = force !== undefined ? force : (pop.style.display === 'none');
 if (open && _vwCache[instanceId] === null) { _vwLoad(instanceId); return; } // abre depois de carregar
 pop.style.display = open ? 'block' : 'none';
 if (open) _vwRender(instanceId);
 if (open && wrap && typeof _tsSmartPosition === 'function') _tsSmartPosition(wrap, pop);
}

function _vwLoad(instanceId) {
 if (!_sb) return;
 var modulo = (_vwInstances[instanceId] || {}).modulo || instanceId;
 _sb.from('gestor_views').select('*').eq('modulo', modulo).order('created_at', { ascending: false }).then(function(res) {
  _vwCache[instanceId] = res.data || [];
  _vwToggle(instanceId, true);
 }).catch(function(){ _vwCache[instanceId] = []; _vwToggle(instanceId, true); });
}

function _vwRender(instanceId) {
 var pop = document.getElementById('gv-pop-' + instanceId);
 if (!pop) return;
 var sorted = (_vwCache[instanceId] || []).slice().sort(function(a,b){ return (b.favorito?1:0) - (a.favorito?1:0); });
 var items = sorted.map(function(v) {
  var favOn = !!v.favorito;
  return '<div class="gv-item" onclick="_vwApply(\'' + instanceId + '\',\'' + v.id + '\')">'
   + '<button type="button" class="gv-item-fav' + (favOn?' on':'') + '" title="' + (favOn?'Desfavoritar':'Favoritar') + '" onclick="event.stopPropagation();_vwToggleFav(\'' + instanceId + '\',\'' + v.id + '\')">' + (favOn?'★':'☆') + '</button>'
   + '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">' + v.nome.replace(/</g,'&lt;') + '</span>'
   + '<button type="button" class="gv-item-act" title="Renomear" onclick="event.stopPropagation();_vwRename(\'' + instanceId + '\',\'' + v.id + '\')">&#9998;</button>'
   + '<button type="button" class="gv-item-act" title="Duplicar" onclick="event.stopPropagation();_vwDuplicate(\'' + instanceId + '\',\'' + v.id + '\')">&#10697;</button>'
   + '<button type="button" class="gv-item-act" title="Compartilhar (em breve)" disabled>&#8599;</button>'
   + '<button type="button" class="gv-item-del" title="Excluir visualização" onclick="event.stopPropagation();_vwDelete(\'' + instanceId + '\',\'' + v.id + '\')">&times;</button>'
   + '</div>';
 }).join('');
 pop.innerHTML = '<div class="gv-hint">Salve combinações de filtros, pesquisa, agrupamento, ordenação e período para reutilizar depois.</div>'
  + (items || '<div class="gv-empty">Nenhuma visualização salva ainda</div>')
  + '<button type="button" class="gv-save-btn" onclick="_vwSaveCurrent(\'' + instanceId + '\')">+ Nova visualização</button>';
 pop.style.display = 'block';
}

function _vwToggleFav(instanceId, id) {
 var v = (_vwCache[instanceId] || []).find(function(x){ return String(x.id) === String(id); });
 if (!v) return;
 var novo = !v.favorito;
 _sb.from('gestor_views').update({ favorito: novo, updated_at: new Date().toISOString() }).eq('id', id).then(function(res) {
  if (res.error) { _showToast('Erro: ' + _supaErrPt(res.error.message), 'erro'); return; }
  v.favorito = novo;
  _vwRender(instanceId);
 }).catch(function(e){ _showToast('Erro: ' + e.message, 'erro'); });
}

function _vwRename(instanceId, id) {
 var v = (_vwCache[instanceId] || []).find(function(x){ return String(x.id) === String(id); });
 if (!v) return;
 var novoNome = prompt('Novo nome da visualização:', v.nome);
 if (!novoNome || !novoNome.trim() || novoNome.trim() === v.nome) return;
 _sb.from('gestor_views').update({ nome: novoNome.trim(), updated_at: new Date().toISOString() }).eq('id', id).then(function(res) {
  if (res.error) { _showToast('Erro ao renomear: ' + _supaErrPt(res.error.message), 'erro'); return; }
  v.nome = novoNome.trim();
  _vwRender(instanceId);
 }).catch(function(e){ _showToast('Erro: ' + e.message, 'erro'); });
}

function _vwDuplicate(instanceId, id) {
 var v = (_vwCache[instanceId] || []).find(function(x){ return String(x.id) === String(id); });
 if (!v) return;
 var modulo = (_vwInstances[instanceId] || {}).modulo || instanceId;
 var payload = {
  nome: v.nome + ' (cópia)',
  group_by: v.group_by, sort_by: v.sort_by,
  sort_state: v.sort_state, group_state: v.group_state,
  period_preset: v.period_preset, period_ini: v.period_ini, period_fim: v.period_fim,
  filtro_state: v.filtro_state, modulo: modulo, favorito: false,
  criado_por: (_currentUser && _currentUser.id) || null
 };
 _sb.from('gestor_views').insert(payload).select().then(function(res) {
  if (res.error) { _showToast('Erro ao duplicar: ' + _supaErrPt(res.error.message), 'erro'); return; }
  _vwCache[instanceId] = null;
  _showToast('Visualização duplicada!', 'ok');
  _vwToggle(instanceId, true);
 }).catch(function(e){ _showToast('Erro: ' + e.message, 'erro'); });
}

function _vwSaveCurrent(instanceId) {
 var nome = prompt('Nome da visualização:');
 if (!nome || !nome.trim()) return;
 var cfg = _vwInstances[instanceId] || {};
 var modulo = cfg.modulo || instanceId;
 var state = cfg.getState ? cfg.getState() : {};
 var payload = {
  nome: nome.trim(),
  // group_by/sort_by: espelho legado (texto simples, 1º nível), mesmo padrão
  // do Gestor — sort_state/group_state (jsonb) guardam o estado completo e
  // são o que _vwApply de fato usa pra restaurar.
  group_by: (state.group && state.group.levels[0] && state.group.levels[0].field) || null,
  sort_by: (state.sort && state.sort.levels[0] && state.sort.levels[0].field) || null,
  sort_state: state.sort || { levels: [] },
  group_state: state.group || { levels: [] },
  period_preset: (state.period && state.period.preset) || null,
  period_ini: (state.period && state.period.ini) ? _ppFmtDate(state.period.ini) : null,
  period_fim: (state.period && state.period.fim) ? _ppFmtDate(state.period.fim) : null,
  filtro_state: state.filtro || { logic:'AND', conditions:[] },
  modulo: modulo,
  favorito: false,
  criado_por: (_currentUser && _currentUser.id) || null
 };
 _sb.from('gestor_views').insert(payload).select().then(function(res) {
  if (res.error) { _showToast('Erro ao salvar visualização: ' + _supaErrPt(res.error.message), 'erro'); return; }
  _vwCache[instanceId] = null; // força recarregar da próxima vez que abrir
  _showToast('Visualização "' + payload.nome + '" salva!', 'ok');
  _vwToggle(instanceId, false);
 }).catch(function(e){ _showToast('Erro: ' + e.message, 'erro'); });
}

function _vwApply(instanceId, id) {
 var v = (_vwCache[instanceId] || []).find(function(x){ return String(x.id) === String(id); });
 if (!v) return;
 var cfg = _vwInstances[instanceId] || {};
 if (cfg.applyState) {
  cfg.applyState({
   sort:   (v.sort_state && v.sort_state.levels)   ? v.sort_state  : { levels: v.sort_by  ? [{ field: v.sort_by,  dir: 'asc' }] : [] },
   group:  (v.group_state && v.group_state.levels) ? v.group_state : { levels: v.group_by ? [{ field: v.group_by }] : [] },
   period: { preset: v.period_preset || 'todas', ini: v.period_ini || null, fim: v.period_fim || null },
   filtro: v.filtro_state || { logic:'AND', conditions:[] }
  });
 }
 _vwToggle(instanceId, false);
 _showToast('Visualização "' + v.nome + '" aplicada', 'ok');
}

function _vwDelete(instanceId, id) {
 if (!confirm('Excluir esta visualização salva?')) return;
 _sb.from('gestor_views').delete().eq('id', id).then(function(res) {
  if (res.error) { _showToast('Erro ao excluir: ' + _supaErrPt(res.error.message), 'erro'); return; }
  _vwCache[instanceId] = (_vwCache[instanceId] || []).filter(function(v){ return String(v.id) !== String(id); });
  _vwRender(instanceId);
 }).catch(function(e){ _showToast('Erro: ' + e.message, 'erro'); });
}

if (typeof document !== 'undefined') {
 document.addEventListener('click', function(e) {
  var path = e.composedPath ? e.composedPath() : [e.target];
  Object.keys(_vwInstances).forEach(function(id) {
   var wrap = document.getElementById('gv-wrap-' + id);
   if (wrap && path.indexOf(wrap) === -1) _vwToggle(id, false);
  });
 });
}

// Export só pra Node (testes, node:test) — não muda nada no navegador.
if (typeof module !== 'undefined' && module.exports) {
 module.exports = { _vwInstances, _vwCache, _vwInit };
}
