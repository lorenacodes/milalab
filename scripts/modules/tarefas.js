// ═══════════════════════════════════════════════════════════════════════════════
// GESTOR DE TAREFAS — grid/kanban/timeline/métricas por setor. Sistema
// separado das tarefas pessoais do Dashboard, mas compartilha o drawer de
// edição (_feedItemClick, em dashboard.js) e os caches de vínculo/avatar/usuário.
// ═══════════════════════════════════════════════════════════════════════════════
var _gestorAllAt    = [];       // todos dados do Supabase
var _gestorFiltered = [];       // após filtros
var _gestorView     = 'grid';   // 'grid' | 'timeline' | 'metricas'
var _gestorCollapsed    = {};   // { groupKey: true } = colapsado
var _gestorWeekExpanded = {};   // { 'YYYY-MM-DD': true } = semana expandida
var _gestorPeriodo  = { ini: null, fim: null, preset: 'semana' };
// Botão de um clique "Atrasadas" (fora do Filtro — ver comentário em
// _gestorPopulateFilters). true = mostra só as atrasadas; combina com o
// Filtro e a Busca por AND, mesmo padrão do Período.
var _gestorSomenteAtrasadas = false;
function _gestorToggleAtrasadas() {
 _gestorSomenteAtrasadas = !_gestorSomenteAtrasadas;
 var btn = document.getElementById('gestor-btn-atrasadas');
 if (btn) btn.classList.toggle('active', _gestorSomenteAtrasadas);
 _gestorApplyFilters();
 _gestorSaveState();
}
var _gestorTimelineAnchor = new Date(); _gestorTimelineAnchor.setHours(0,0,0,0); // data-base de navegacao da Timeline
// Lookups para enriquecer vínculos (id → nome)
var _gestorObrasMap = {};    // { obraId: 'Nome da Obra' }
var _gestorProjMap  = {};    // { projId:  'Nome do Projeto' }
var _gestorMelhMap  = {};    // { melhId:  'Nome da Melhoria' }
var _gestorProjEtapaMap = {}; // { projId:  'Etapa do Projeto' }

// ── Navegação da Timeline (sensível ao período/preset selecionado) ──────────
// 'semana'  -> anda 7 dias | 'prox2' -> anda 14 dias | 'trim' -> anda 3 meses
// 'custom'  -> anda o tamanho do intervalo escolhido | 'mes'/'todas' -> anda 1 mês
function _gestorCalPrev() {
 var preset = _gestorPeriodo.preset || 'mes';
 if (preset === 'semana')      _gestorTimelineAnchor.setDate(_gestorTimelineAnchor.getDate() - 7);
 else if (preset === 'prox2')  _gestorTimelineAnchor.setDate(_gestorTimelineAnchor.getDate() - 14);
 else if (preset === 'trim')   _gestorTimelineAnchor.setMonth(_gestorTimelineAnchor.getMonth() - 3);
 else if (preset === 'custom' && _gestorPeriodo.ini && _gestorPeriodo.fim) {
  var span = Math.round((_gestorPeriodo.fim - _gestorPeriodo.ini) / 86400000) + 1;
  _gestorPeriodo.ini = new Date(_gestorPeriodo.ini.getTime() - span*86400000);
  _gestorPeriodo.fim = new Date(_gestorPeriodo.fim.getTime() - span*86400000);
  _gestorSetInputDates(_gestorPeriodo.ini, _gestorPeriodo.fim);
 } else _gestorTimelineAnchor.setMonth(_gestorTimelineAnchor.getMonth() - 1);
 _gestorRenderTimeline();
}
function _gestorCalNext() {
 var preset = _gestorPeriodo.preset || 'mes';
 if (preset === 'semana')      _gestorTimelineAnchor.setDate(_gestorTimelineAnchor.getDate() + 7);
 else if (preset === 'prox2')  _gestorTimelineAnchor.setDate(_gestorTimelineAnchor.getDate() + 14);
 else if (preset === 'trim')   _gestorTimelineAnchor.setMonth(_gestorTimelineAnchor.getMonth() + 3);
 else if (preset === 'custom' && _gestorPeriodo.ini && _gestorPeriodo.fim) {
  var span = Math.round((_gestorPeriodo.fim - _gestorPeriodo.ini) / 86400000) + 1;
  _gestorPeriodo.ini = new Date(_gestorPeriodo.ini.getTime() + span*86400000);
  _gestorPeriodo.fim = new Date(_gestorPeriodo.fim.getTime() + span*86400000);
  _gestorSetInputDates(_gestorPeriodo.ini, _gestorPeriodo.fim);
 } else _gestorTimelineAnchor.setMonth(_gestorTimelineAnchor.getMonth() + 1);
 _gestorRenderTimeline();
}
function _gestorCalToday() {
 _gestorTimelineAnchor = new Date(); _gestorTimelineAnchor.setHours(0,0,0,0);
 _gestorRenderTimeline();
}
// Semana (seg-dom) que contém `date`
function _gestorWeekRangeFrom(date) {
 var d = new Date(date); d.setHours(0,0,0,0);
 var dow = d.getDay();
 var mon = new Date(d); mon.setDate(d.getDate() - ((dow + 6) % 7));
 var sun = new Date(mon); sun.setDate(mon.getDate() + 6);
 return { ini: mon, fim: sun };
}
// Dias do mês (vy/vm), com padding ate completar semanas Dom-Sab
function _gestorMonthDays(vy, vm) {
 var first = new Date(vy, vm, 1), last = new Date(vy, vm+1, 0);
 var start = new Date(first); start.setDate(1 - first.getDay());
 var end   = new Date(last);  if (last.getDay() !== 6) end.setDate(last.getDate() + (6 - last.getDay()));
 var days = [], d = new Date(start);
 while (+d <= +end) { days.push(new Date(d)); d.setDate(d.getDate()+1); }
 return days;
}
function _gestorToggleWeek(key) { _gestorWeekExpanded[key]=!_gestorWeekExpanded[key]; _gestorRenderTimeline(); }

// ── Cores por status ─────────────────────────────────────────────────────────
var _gStatusStyle = {
 'A fazer':           { cls:'gs-afazer',   dot:'#9ca3af' },
 'Em progresso':      { cls:'gs-progresso', dot:'#2E5FD9' },
 'Em andamento':      { cls:'gs-progresso', dot:'#2E5FD9' },
 'Feito':             { cls:'gs-feito',    dot:'#1F8A4C' },
 'Concluído':         { cls:'gs-feito',    dot:'#1F8A4C' },
 'Concluida':         { cls:'gs-feito',    dot:'#1F8A4C' },
 'Bloqueado':         { cls:'gs-bloqueado',dot:'#B8790A' },
 'Bloqueada':         { cls:'gs-bloqueado',dot:'#B8790A' },
 'Impedida':          { cls:'gs-bloqueado',dot:'#B8790A' },
 'Aguardando feedback':{ cls:'gs-bloqueado',dot:'#B8790A' },
 'Obsoleto':          { cls:'gs-afazer',   dot:'#9ca3af' }
};
function _gStatusCls(s) { return (_gStatusStyle[s] || { cls:'gs-afazer', dot:'#9ca3af' }); }
function _gIsDone(s)   { return s === 'Feito' || s === 'Concluído' || s === 'Concluida'; }
// "Obsoleto" nunca conta como atrasada — mesma regra de rpc_atividades_kpis
// (Postgres), que exclui Obsoleto de TODO bucket, inclusive atrasada. Achado
// real: sem essa exclusão aqui, uma atividade Obsoleta com prazo vencido
// (ex.: "Mapeamento de Interfaces", id 6899a1ab-b310-4a13-9e13-f1273754b38d,
// status Obsoleto, prazo 2026-06-22) aparecia como "Somente atrasadas = Sim"
// no Gestor de Tarefas mesmo divergindo do KPI do topo, que já a excluía.
function _gIsLate(a)   {
 if (_gIsDone(a.status) || a.status === 'Obsoleto' || !a.data_prazo) return false;
 return new Date(a.data_prazo + 'T00:00:00') < new Date(new Date().setHours(0,0,0,0));
}

// ── Helpers de período ────────────────────────────────────────────────────
function _gestorWeekRange(offset) {
 // offset=0 → semana atual, offset=1 → próxima semana, etc.
 var today = new Date(); today.setHours(0,0,0,0);
 var dow = today.getDay(); // 0=dom
 var mon = new Date(today); mon.setDate(today.getDate() - ((dow + 6) % 7) + offset * 7);
 var sun = new Date(mon); sun.setDate(mon.getDate() + 6);
 return { ini: mon, fim: sun };
}
function _gestorFmtDate(d) {
 return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function _gestorSetInputDates(ini, fim) {
 var ei = document.getElementById('gestor-dt-ini');
 var ef = document.getElementById('gestor-dt-fim');
 if (ei) ei.value = _gestorFmtDate(ini);
 if (ef) ef.value = _gestorFmtDate(fim);
}

// ── Preset de período ─────────────────────────────────────────────────────
// As datas De/Até ficam escondidas por padrão (redundantes com os presets +
// o rótulo de período já resolvido) — só aparecem quando a pessoa realmente
// quer um intervalo que nenhum preset cobre.
function _gestorToggleCustomDates() {
 var el = document.getElementById('gestor-custom-dates');
 if (!el) return;
 el.style.display = el.style.display === 'none' ? 'inline-flex' : 'none';
}

function _gestorPreset(preset, btn) {
 // Atualizar botão ativo
 document.querySelectorAll('.gp-preset').forEach(function(b){ b.classList.remove('active'); });
 if (btn) btn.classList.add('active');
 // Escolher um preset fixo resolve o período — some com as datas manuais.
 if (btn) {
  var cd = document.getElementById('gestor-custom-dates');
  if (cd) cd.style.display = 'none';
 }

 var today = new Date(); today.setHours(0,0,0,0);
 var ini, fim;

 if (preset === 'semana') {
  var r = _gestorWeekRange(0);
  ini = r.ini; fim = r.fim;
 } else if (preset === 'prox2') {
  var r0 = _gestorWeekRange(0);
  var r1 = _gestorWeekRange(1);
  ini = r0.ini; fim = r1.fim;
 } else if (preset === 'mes') {
  ini = new Date(today.getFullYear(), today.getMonth(), 1);
  fim = new Date(today.getFullYear(), today.getMonth()+1, 0);
 } else if (preset === 'trim') {
  var qStart = Math.floor(today.getMonth()/3)*3;
  ini = new Date(today.getFullYear(), qStart, 1);
  fim = new Date(today.getFullYear(), qStart+3, 0);
 } else if (preset === 'todas') {
  ini = null; fim = null;
  var lp = document.getElementById('gp-btn-lbl');
  if (lp) lp.textContent = 'Todas as atividades';
  _gestorPeriodo = { ini: null, fim: null, preset: 'todas' };
  // Limpa inputs
  var ei = document.getElementById('gestor-dt-ini');
  var ef = document.getElementById('gestor-dt-fim');
  if (ei) ei.value = '';
  if (ef) ef.value = '';
  _gestorApplyFilters();
  _gpToggle(false);
  return;
 } else if (preset === 'custom') {
  var ei = document.getElementById('gestor-dt-ini');
  var ef = document.getElementById('gestor-dt-fim');
  var vs = ei ? ei.value : '';
  var ve = ef ? ef.value : '';
  if (!vs || !ve) return; // aguarda ambas
  ini = new Date(vs + 'T00:00:00');
  fim = new Date(ve + 'T00:00:00');
  document.querySelectorAll('.gp-preset').forEach(function(b){ b.classList.remove('active'); });
 }

 _gestorPeriodo = { ini: ini, fim: fim, preset: preset };
 if (ini && fim) _gestorSetInputDates(ini, fim);

 // Label do período (mostrado no próprio botão do dropdown, fechado)
 var lp = document.getElementById('gp-btn-lbl');
 if (lp && ini && fim) {
  lp.textContent = ini.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}) + ' – ' + fim.toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'});
 }
 _gestorApplyFilters();
 if (preset !== 'custom') _gpToggle(false);
}

// ── Dropdown de período (substitui a barra de 5 botões sempre visível) ───
function _gpToggle(force) {
 var pop = document.getElementById('gp-pop');
 var wrap = document.getElementById('gp-wrap');
 if (!pop) return;
 var open = force !== undefined ? force : (pop.style.display === 'none');
 pop.style.display = open ? 'flex' : 'none';
 if (open && wrap && typeof _tsSmartPosition === 'function') _tsSmartPosition(wrap, pop);
}
// ── Início/Prazo como filtros rápidos de data ──────────────────────────────
// Existiu aqui um mecanismo à parte (_gqdToggle/_gqdPreset, dois botões
// "Início"/"Prazo" na toolbar, com os mesmos presets do "Período") — removido
// porque duplicava, com sua própria UI, o que os campos "Início"/"Prazo" já
// deveriam ser: condições de data dentro do Filtro (filtro-builder.js). Em vez
// de manter os dois caminhos, o filtro-builder ganhou um operador genérico
// 'between' (intervalo — reutilizável por qualquer campo de data de qualquer
// módulo, não só Gestor), e os campos data_inicio/data_prazo já registrados
// em _fbInit('gestor', [...]) abaixo passam a cobrir esse caso: "Início está
// entre X e Y" / "Prazo está entre X e Y" viram condições normais do Filtro,
// combináveis com todas as outras (Responsável, Status, Obra...) via E/OU.
// O "Período" (_gestorPeriodo/_gestorPreset) continua existindo à parte: ele
// não é redundante com isso — filtra por QUALQUER UM dos dois campos ao mesmo
// tempo (OR entre início/prazo) para resolver "o que cai nesta janela",
// alimenta a navegação da Timeline (_gestorCalPrev/_gestorCalNext) e o schema
// de Visualizações salvas (period_preset/period_ini/period_fim), papéis que
// uma condição de um único campo no Filtro não cobre.

document.addEventListener('click', function(e) {
 // composedPath(), não e.target.closest(): ações dentro do painel de
 // Visualizações (favoritar/renomear/duplicar/excluir) reconstroem o HTML
 // via innerHTML, o que destaca o elemento clicado do DOM antes deste
 // listener rodar — e.target.closest() num nó destacado sempre dá null
 // (parece "clique fora"), fechando o painel sozinho no meio da ação.
 var path = e.composedPath ? e.composedPath() : [e.target];
 var gpWrap = document.getElementById('gp-wrap');
 var gvWrap = document.getElementById('gv-wrap');
 if (gpWrap && path.indexOf(gpWrap) === -1) _gpToggle(false);
 if (gvWrap && path.indexOf(gvWrap) === -1) _gviewsToggle(false);
});

// ── Visualizações salvas (agrupamento + ordenação + período + filtro, com
// nome — estilo "Views" do Airtable). Persistidas no Supabase
// (gestor_views), não em localStorage — visíveis pra qualquer usuário do
// sistema, não só em quem salvou neste navegador.
var _gviewsCache = null; // null = ainda não carregou; [] = carregou e está vazio

function _gviewsToggle(force) {
 var pop = document.getElementById('gv-pop');
 var wrap = document.getElementById('gv-wrap');
 if (!pop) return;
 var open = force !== undefined ? force : (pop.style.display === 'none');
 if (open && _gviewsCache === null) { _gviewsLoad(); return; } // abre depois que carregar
 pop.style.display = open ? 'block' : 'none';
 if (open) _gviewsRender();
 if (open && wrap && typeof _tsSmartPosition === 'function') _tsSmartPosition(wrap, pop);
}

function _gviewsLoad() {
 if (!_sb) return;
 // modulo='gestor': a tabela já nasceu preparada pra guardar views de outras
 // páginas também (Fase 2) — sem o filtro, uma view de outro módulo apareceria
 // aqui por engano.
 _sb.from('gestor_views').select('*').eq('modulo', 'gestor').order('created_at', { ascending: false }).then(function(res) {
  _gviewsCache = res.data || [];
  _gviewsToggle(true);
 }).catch(function(){ _gviewsCache = []; _gviewsToggle(true); });
}

function _gviewsRender() {
 var pop = document.getElementById('gv-pop');
 if (!pop) return;
 // Favoritas primeiro, senão mantém a ordem que já veio (mais recente primeiro).
 var sorted = (_gviewsCache || []).slice().sort(function(a,b){ return (b.favorito?1:0) - (a.favorito?1:0); });
 var items = sorted.map(function(v) {
  var favOn = !!v.favorito;
  return '<div class="gv-item" onclick="_gviewsApply(\'' + v.id + '\')">'
   + '<button type="button" class="gv-item-fav' + (favOn?' on':'') + '" title="' + (favOn?'Desfavoritar':'Favoritar') + '" onclick="event.stopPropagation();_gviewsToggleFav(\'' + v.id + '\')">' + (favOn?'★':'☆') + '</button>'
   + '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">' + v.nome.replace(/</g,'&lt;') + '</span>'
   + '<button type="button" class="gv-item-act" title="Renomear" onclick="event.stopPropagation();_gviewsRename(\'' + v.id + '\')">&#9998;</button>'
   + '<button type="button" class="gv-item-act" title="Duplicar" onclick="event.stopPropagation();_gviewsDuplicate(\'' + v.id + '\')">&#10697;</button>'
   + '<button type="button" class="gv-item-del" title="Excluir visualização" onclick="event.stopPropagation();_gviewsDelete(\'' + v.id + '\')">&times;</button>'
   + '</div>';
 }).join('');
 // Sem botão "Compartilhar": toda visualização salva JÁ fica visível pra
 // todo mundo (mesmo motivo do comentário equivalente em saved-views.js).
 pop.innerHTML = '<div class="gv-hint">Salve combinações de filtros, pesquisa, agrupamento, ordenação e período — visível para toda a equipe assim que salva.</div>'
  + (items || '<div class="gv-empty">Nenhuma visualização salva ainda</div>')
  + '<button type="button" class="gv-save-btn" onclick="_gviewsSaveCurrent()">+ Nova visualização</button>';
 pop.style.display = 'block';
}

function _gviewsToggleFav(id) {
 var v = (_gviewsCache || []).find(function(x){ return String(x.id) === String(id); });
 if (!v) return;
 var novo = !v.favorito;
 _sb.from('gestor_views').update({ favorito: novo, updated_at: new Date().toISOString() }).eq('id', id).then(function(res) {
  if (res.error) { _showToast('Erro: ' + _supaErrPt(res.error.message), 'erro'); return; }
  v.favorito = novo;
  _gviewsRender();
 }).catch(function(e){ _showToast('Erro: ' + e.message, 'erro'); });
}

function _gviewsRename(id) {
 var v = (_gviewsCache || []).find(function(x){ return String(x.id) === String(id); });
 if (!v) return;
 var novoNome = prompt('Novo nome da visualização:', v.nome);
 if (!novoNome || !novoNome.trim() || novoNome.trim() === v.nome) return;
 _sb.from('gestor_views').update({ nome: novoNome.trim(), updated_at: new Date().toISOString() }).eq('id', id).then(function(res) {
  if (res.error) { _showToast('Erro ao renomear: ' + _supaErrPt(res.error.message), 'erro'); return; }
  v.nome = novoNome.trim();
  _gviewsRender();
 }).catch(function(e){ _showToast('Erro: ' + e.message, 'erro'); });
}

function _gviewsDuplicate(id) {
 var v = (_gviewsCache || []).find(function(x){ return String(x.id) === String(id); });
 if (!v) return;
 var payload = {
  nome: v.nome + ' (cópia)',
  group_by: v.group_by, sort_by: v.sort_by,
  sort_state: v.sort_state, group_state: v.group_state,
  period_preset: v.period_preset, period_ini: v.period_ini, period_fim: v.period_fim,
  filtro_state: v.filtro_state, modulo: v.modulo || 'gestor', favorito: false,
  criado_por: (_currentUser && _currentUser.id) || null
 };
 _sb.from('gestor_views').insert(payload).select().then(function(res) {
  if (res.error) { _showToast('Erro ao duplicar: ' + _supaErrPt(res.error.message), 'erro'); return; }
  _gviewsCache = null;
  _showToast('Visualização duplicada!', 'ok');
  _gviewsToggle(true);
 }).catch(function(e){ _showToast('Erro: ' + e.message, 'erro'); });
}

function _gviewsSaveCurrent() {
 var nome = prompt('Nome da visualização:');
 if (!nome || !nome.trim()) return;
 var fbInst = _fbInstances && _fbInstances['gestor'];
 var sbInst = _sbInstances && _sbInstances['gestor'];
 var gbInst = _gbInstances && _gbInstances['gestor'];
 var payload = {
  nome: nome.trim(),
  // group_by/sort_by: espelho legado (texto simples, 1º nível) — mantido pra
  // compatibilidade com qualquer código/relatório que já leia essas colunas;
  // sort_state/group_state (jsonb) guardam o estado completo, com todos os
  // níveis, e são o que _gviewsApply de fato usa pra restaurar.
  group_by: (gbInst && gbInst.state.levels[0] && gbInst.state.levels[0].field) || 'responsavel',
  sort_by: (sbInst && sbInst.state.levels[0] && sbInst.state.levels[0].field) || 'data_prazo',
  sort_state: sbInst ? sbInst.state : { levels: [] },
  group_state: gbInst ? gbInst.state : { levels: [] },
  period_preset: _gestorPeriodo.preset || 'semana',
  period_ini: _gestorPeriodo.ini ? _gestorFmtDate(_gestorPeriodo.ini) : null,
  period_fim: _gestorPeriodo.fim ? _gestorFmtDate(_gestorPeriodo.fim) : null,
  filtro_state: fbInst ? fbInst.state : { logic:'AND', conditions:[] },
  modulo: 'gestor',
  favorito: false,
  criado_por: (_currentUser && _currentUser.id) || null
 };
 _sb.from('gestor_views').insert(payload).select().then(function(res) {
  if (res.error) { _showToast('Erro ao salvar visualização: ' + _supaErrPt(res.error.message), 'erro'); return; }
  _gviewsCache = null; // força recarregar da próxima vez que abrir
  _showToast('Visualização "' + payload.nome + '" salva!', 'ok');
  _gviewsToggle(false);
 }).catch(function(e){ _showToast('Erro: ' + e.message, 'erro'); });
}

function _gviewsApply(id) {
 var v = (_gviewsCache || []).find(function(x){ return String(x.id) === String(id); });
 if (!v) return;
 // Ordenar / Agrupar: usa o estado completo (sort_state/group_state) quando
 // existir; visões antigas (salvas antes desses campos existirem) caem pro
 // espelho legado de 1 campo só (group_by/sort_by).
 var sbInst = _sbInstances && _sbInstances['gestor'];
 if (sbInst) {
  sbInst.state = (v.sort_state && v.sort_state.levels) ? v.sort_state : { levels: [{ field: v.sort_by || 'data_prazo', dir: 'asc' }] };
  _sbRender('gestor');
 }
 var gbInst = _gbInstances && _gbInstances['gestor'];
 if (gbInst) {
  gbInst.state = (v.group_state && v.group_state.levels) ? v.group_state : { levels: [{ field: v.group_by || 'responsavel' }] };
  _gbRender('gestor');
 }
 // Período
 if (v.period_preset === 'custom' && v.period_ini && v.period_fim) {
  var ei = document.getElementById('gestor-dt-ini'), ef = document.getElementById('gestor-dt-fim');
  if (ei) ei.value = v.period_ini;
  if (ef) ef.value = v.period_fim;
  var cd = document.getElementById('gestor-custom-dates'); if (cd) cd.style.display = 'inline-flex';
  _gestorPreset('custom', null);
 } else {
  var btnMap = { semana:'gp-semana', prox2:'gp-prox2', mes:'gp-mes', trim:'gp-trim', todas:'gp-todas' };
  var btnId = btnMap[v.period_preset] || 'gp-semana';
  _gestorPreset(v.period_preset || 'semana', document.getElementById(btnId));
 }
 // Filtro (condições E/OU do filtro-builder)
 var fbInst = _fbInstances && _fbInstances['gestor'];
 if (fbInst) {
  fbInst.state = v.filtro_state || { logic:'AND', conditions:[] };
  _fbRender('gestor');
  _fbApply('gestor');
 }
 _gestorApplyFilters();
 _gviewsToggle(false);
 _showToast('Visualização "' + v.nome + '" aplicada', 'ok');
}

function _gviewsDelete(id) {
 if (!confirm('Excluir esta visualização salva?')) return;
 _sb.from('gestor_views').delete().eq('id', id).then(function(res) {
  if (res.error) { _showToast('Erro ao excluir: ' + _supaErrPt(res.error.message), 'erro'); return; }
  _gviewsCache = (_gviewsCache || []).filter(function(v){ return String(v.id) !== String(id); });
  _gviewsRender();
 }).catch(function(e){ _showToast('Erro: ' + e.message, 'erro'); });
}

// ── KPIs do topo (Total/Em andamento/Pendentes/Atrasadas/A fazer) ──────────
// Fonte única: rpc_atividades_kpis(null) — visão global, calculada em SQL
// (COUNT/FILTER, uma linha de resposta), NÃO client-side sobre um array já
// carregado. Mesma função usada por Meu Painel (scripts/modules/dashboard.js),
// só que lá com p_responsavel = email do usuário logado — garante que os
// dois painéis nunca divirjam na regra de cálculo. Exclui Obsoleto de tudo,
// inclusive do total (regra de negócio: obsoleto não deve afetar KPI nenhum).
var _gestorKpisInFlight = false;
async function _gestorLoadKpis() {
 if (_gestorKpisInFlight) return;
 if (!_sb) return;
 _gestorKpisInFlight = true;
 var ids = ['gst-total', 'gst-prog', 'gst-pend', 'gst-late', 'gst-afazer', 'nav-badge-gestor'];
 try {
  var r = await _sb.rpc('rpc_atividades_kpis', { p_responsavel: null });
  if (r.error) throw r.error;
  var row = Array.isArray(r.data) ? r.data[0] : r.data;
  if (!row) throw new Error('rpc_atividades_kpis sem retorno');
  var set = function(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
  set('gst-total',  row.total);
  set('gst-prog',   row.em_andamento);
  set('gst-pend',   row.pendente);
  set('gst-late',   row.atrasada);
  set('gst-afazer', row.a_fazer);
  set('nav-badge-gestor', row.a_fazer); // mesma fonte do badge do menu lateral — nunca diverge
 } catch (e) {
  console.error('[Gestor] Erro ao carregar KPIs (rpc_atividades_kpis):', e);
  // Falha de conexão/RPC: mantém "—" em vez de travar ou mostrar número velho.
  ids.forEach(function(id) {
   var el = document.getElementById(id);
   if (el && !/^\d+$/.test((el.textContent || '').trim())) el.textContent = '—';
  });
 } finally {
  _gestorKpisInFlight = false;
 }
}

// ── Carregar dados ─────────────────────────────────────────────────────────
// _gestorLoad é chamada de vários gatilhos que podem coincidir quase no mesmo
// instante (troca pra aba Gestor, criar uma atividade, evento de tempo real
// de `atividades`) — achado real: duas chamadas concorrentes disputavam as
// mesmas globais de lookup (_gestorObrasMap/_gestorProjMap/_gestorMelhMap,
// zeradas e repovoadas por referência a cada chamada), e uma chamada podia
// terminar lendo os mapas já zerados pela OUTRA que ainda estava carregando —
// resultado: nome de obra/projeto sumindo da grade até o próximo reload.
// Wrapper "coalesce + trailing": só uma carga roda de cada vez; uma chamada
// que chegar enquanto outra está em andamento não dispara uma segunda carga
// concorrente, só marca que uma recarga é necessária assim que a atual
// terminar (nenhuma chamada é perdida, mas nunca há duas rodando juntas).
var _gestorLoadInFlight = false;
var _gestorLoadPending  = false;
async function _gestorLoad() {
 if (_gestorLoadInFlight) { _gestorLoadPending = true; return; }
 _gestorLoadInFlight = true;
 try {
  await _gestorLoadImpl();
 } finally {
  _gestorLoadInFlight = false;
  if (_gestorLoadPending) { _gestorLoadPending = false; _gestorLoad(); }
 }
}
async function _gestorLoadImpl() {
 var lbl  = document.getElementById('gestor-sync-lbl');
 var spin = document.getElementById('gestor-loading-spin');
 if (lbl)  lbl.textContent = 'Carregando dados...';
 if (spin) spin.style.display = '';
 if (!_sb) {
  if (lbl) lbl.textContent = 'Erro: Supabase não inicializado';
  if (spin) spin.style.display = 'none';
  return;
 }

 // KPIs do topo: RPC leve, disparada em paralelo — não espera a carga
 // completa e paginada de todas as atividades abaixo. Mesmo gatilho (esta
 // função roda no boot do Gestor E em todo evento realtime de `atividades`,
 // ver _rtWatch mais abaixo) cobre "inicial" e "dado mudou" sem poll extra.
 _gestorLoadKpis();

 try {
  var t0 = Date.now();

  // ── 1. Carregar lookups com paginação completa ─────────────────────────
  // obras: 1528 registros — precisa de paginação (limite padrão = 1000)
  _gestorObrasMap = {};
  _gestorProjMap  = {};
  _gestorMelhMap  = {};
  _gestorProjEtapaMap = {};
  var _lookupPage = function(table, map, cols) {
   return (async function() {
    var pg = 0, sz = 1000;
    while (true) {
     var lr = await _sb.from(table).select(cols || 'id, nome').range(pg*sz, (pg+1)*sz-1);
     if (lr.error || !lr.data || !lr.data.length) break;
     lr.data.forEach(function(r){ if(r.id&&r.nome) map[String(r.id)]=r.nome; });
     if (lr.data.length < sz) break;
     pg++;
    }
   })();
  };
  var _lookupProjEtapas = function() {
   return (async function() {
    var pg = 0, sz = 1000;
    while (true) {
     var lr = await _sb.from('projetos').select('id, etapa_projeto').range(pg*sz, (pg+1)*sz-1);
     if (lr.error || !lr.data || !lr.data.length) break;
     lr.data.forEach(function(r){ if(r.id&&r.etapa_projeto) _gestorProjEtapaMap[String(r.id)]=r.etapa_projeto; });
     if (lr.data.length < sz) break;
     pg++;
    }
   })();
  };
  await Promise.all([
   _lookupPage('obras',     _gestorObrasMap),
   _lookupPage('projetos',  _gestorProjMap),
   _lookupPage('melhorias', _gestorMelhMap),
   _lookupProjEtapas(),
   _loadAtividadeVinculosCache(),
   _loadUsuariosCache(),
   // _respUsuarios (cargo/área/data de entrada p/ o cartão de info do avatar)
   // só carregava quando o usuário abria o editor de tarefa pra escolher
   // responsável — no Gestor de Tarefas puro, o cartão sempre aparecia
   // vazio. Carrega junto com o resto (já tem guarda contra load duplicado).
   _respLoadUsers().catch(function(){})
  ]);
  console.log('[Gestor] lookups:', Object.keys(_gestorObrasMap).length, 'obras,', Object.keys(_gestorProjMap).length, 'projetos,', Object.keys(_gestorMelhMap).length, 'melhorias');

  // ── 2. Carregar atividades paginado ────────────────────────────────────
  var allData = [];
  var pageSize = 1000;
  var page = 0;
  while (true) {
   var res = await _sb.from('atividades')
    .select('*')
    .order('data_prazo', { ascending: true, nullsFirst: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);
   if (res.error) throw new Error(res.error.message || JSON.stringify(res.error));
   var chunk = res.data || [];
   allData = allData.concat(chunk);
   if (lbl) lbl.textContent = 'Carregando... ' + allData.length + ' registros';
   if (chunk.length < pageSize) break;
   page++;
  }

  // ── 3. Enriquecer vínculos via lookup maps ─────────────────────────────
  // obra_id/projeto_id/melhoria_id não são mais colunas diretas em atividades
  // (vivem em junctions) e responsavel agora é text[] de e-mail — _enrichAtividades
  // repõe os 3 ids a partir do cache de junctions e converte responsavel em string.
  _enrichAtividades(allData);
  allData.forEach(function(a) {
   a._obraNome = a.obra_id    ? (_gestorObrasMap[String(a.obra_id)]    || '') : '';
   a._projNome = a.projeto_id ? (_gestorProjMap[String(a.projeto_id)]  || '') : '';
   a._melhNome = a.melhoria_id ? (_gestorMelhMap[String(a.melhoria_id)] || '') : '';
   a._etapaProjeto = a.projeto_id ? (_gestorProjEtapaMap[String(a.projeto_id)] || '') : '';
  });

  _gestorAllAt = allData;
  var ms = Date.now() - t0;
  var agora = new Date().toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
  if (lbl)  lbl.textContent = _gestorAllAt.length + ' atividades · ' + agora + ' (' + ms + 'ms)';
  if (spin) spin.style.display = 'none';
  console.log('[Gestor] OK —', _gestorAllAt.length, 'atividades em', ms, 'ms');

  _gestorPopulateFilters();

  if (!_gestorPeriodo.preset || _gestorPeriodo.preset === 'semana') {
   _gestorPreset('semana', document.getElementById('gp-semana'));
  } else {
   _gestorApplyFilters();
  }

  // Carregar avatares em background e re-renderizar o grid quando prontos
  _loadAvatarCacheFast().then(function() {
   if (_gestorView === 'grid') _gestorRenderGrid();
  });

  // Tempo real: qualquer INSERT/UPDATE/DELETE em atividades (inclusive vindo
  // do sync do Airtable) recarrega a lista sozinho — sem precisar recarregar
  // a página. _rtWatch (scripts/lib/realtime-sync.js) deduplica por
  // referência de função — como _gestorLoad é sempre a MESMA função, chamar
  // de novo toda vez que o usuário reabre o Gestor de Tarefas não acumula
  // callbacks duplicados na lista (achado real: sem essa dedupe, cada
  // reabertura da aba somava mais uma cópia de _gestorLoad; um evento
  // realtime real disparava N _gestorLoad concorrentes, que corrompiam as
  // globais de atividades-vinculos.js entre si e faziam o nome da obra
  // "sumir" da grade até o próximo reload).
  if (typeof _rtWatch === 'function') _rtWatch('atividades', _gestorLoad);

 } catch(e) {
  var msg = e && e.message ? e.message : String(e);
  if (lbl)  lbl.textContent = 'Erro: ' + msg;
  if (spin) spin.style.display = 'none';
  console.error('[Gestor] erro:', msg, e);
 }
}

// Tipo de atividade: usa tipo_atividade (campo novo) com fallback para o
// campo legado `tipo` — sem isso, atividades antigas que só têm `tipo`
// ficavam invisíveis nesse filtro (não apareciam como opção nem casavam
// com nenhum valor selecionado). Mesmo fallback usado em dashboard.js.
function _gTipoAtividade(a) { return a.tipo_atividade || a.tipo || ''; }

// Individual vs coletiva: puramente derivado da quantidade de responsáveis
// (não existe "equipe" nos dados — ver decisão registrada). 1 pessoa =
// individual, 2+ = coletiva, 0 = sem responsável. Usado só como uma forma
// de agrupar/enxergar a grade (groupBy 'tipo_resp'), não como badge por
// linha — a versão anterior com pilha de avatares em toda linha ficou
// poluída; a separação em grupos é mais limpa.
function _gTipoResp(a) {
 var n = (a.responsavel || '').split(/[,;]+/).map(function(r){ return r.trim(); }).filter(Boolean).length;
 return n === 0 ? '— Sem responsável' : (n === 1 ? 'Tarefas Individuais' : 'Tarefas Coletivas');
}

// ── Filtro (Filtro Builder — scripts/lib/filtro-builder.js) ───────────────
// Cada campo real da atividade vira uma condição filtrável; as opções de
// select são calculadas sob demanda (fn), sempre a partir dos dados
// carregados no momento — _gestorPopulateFilters() só precisa re-inicializar
// a instância quando os dados mudam (as opções já saem atualizadas).
var _GESTOR_STATUS_CANONICO = ['Backlog','A fazer','Em progresso','Aguardando feedback','Feito','Obsoleto'];

function _gestorStatusOptions() {
 // "Atrasado" NÃO é uma opção aqui: é uma condição calculada (prazo vencido +
 // não concluída), não um status real gravado na atividade. Selecionável só
 // através do campo "Somente atrasadas" (ver _gestorPopulateFilters), pra não
 // mascarar o status verdadeiro nem no filtro nem na tela.
 var vistos = {};
 _gestorAllAt.forEach(function(a){ if (a.status) vistos[a.status] = 1; });
 var keys = _GESTOR_STATUS_CANONICO.slice();
 Object.keys(vistos).forEach(function(s){ if (keys.indexOf(s) === -1) keys.push(s); });
 return keys;
}
function _gestorOptionsFrom(getter) {
 var set = {};
 _gestorAllAt.forEach(function(a){ var v = getter(a); if (v) set[v] = 1; });
 return Object.keys(set).sort();
}
// "Criada por" vem de atividades.criado_por (uuid, FK auth.users, setado na
// criação em tarefas.js) — resolve pro nome via _usuariosCache (mesma cache
// já carregada em _dbInit/_loadUsuariosCache). "Último alterado por" vem de
// atividades.atualizado_por (text/e-mail, setado pelo trigger
// set_atividades_atualizado_por() a cada INSERT/UPDATE) — resolve por e-mail.
function _gestorCriadoPorNome(a) {
 var u = (_usuariosCache || []).find(function(x){ return x.id === a.criado_por; });
 return (u && (u.nome_display || u.email)) || '';
}
function _gestorAtualizadoPorNome(a) {
 if (!a.atualizado_por) return '';
 var u = (_usuariosCache || []).find(function(x){ return x.email === a.atualizado_por; });
 return (u && u.nome_display) || a.atualizado_por;
}
function _gestorRespOptions() {
 var set = {};
 _gestorAllAt.forEach(function(a) {
  (a.responsavel || '').split(/[,;]+/).forEach(function(r) { var e = r.trim(); if (e) set[e] = 1; });
 });
 return Object.keys(set).sort();
}

function _gestorPopulateFilters() {
 _fbInit('gestor', [
  { key: 'titulo',      label: 'Tarefa',                type: 'text' },
  { key: 'responsavel', label: 'Responsável',           type: 'multitext', options: _gestorRespOptions, userField: true },
  // Status = só o valor real gravado na atividade, nunca sobrescrito.
  // "Atrasada" NÃO é um campo do filtro — é um cálculo do sistema (_gIsLate:
  // prazo vencido + não concluída), sem sentido real de "campo é valor" (o
  // Sim/Não dentro do Filtro parecia uma pergunta redundante, já que a
  // pessoa só entra ali querendo ver as atrasadas). Virou um botão de um
  // clique na toolbar (_gestorToggleAtrasadas), fora do popover de Filtro,
  // que combina com ele por AND — igual ao Período, que também não é uma
  // condição do Filtro e sim um pré-filtro à parte.
  { key: 'status',      label: 'Status',                type: 'select', options: _gestorStatusOptions,
    getValue: function(a) { return a.status || ''; } },
  { key: 'prioridade',  label: 'Prioridade',            type: 'select', options: ['Alta','Média','Baixa'] },
  { key: 'area',        label: 'Área',                  type: 'select', options: function(){ return _gestorOptionsFrom(function(a){ return a.area; }); } },
  { key: 'tipo',        label: 'Tipo de Atividade',     type: 'select', options: function(){ return _gestorOptionsFrom(_gTipoAtividade); }, getValue: _gTipoAtividade },
  { key: 'obra',        label: 'Obra',                  type: 'select', options: function(){ return _gestorOptionsFrom(function(a){ return a._obraNome; }); }, getValue: function(a){ return a._obraNome; } },
  { key: 'projeto',     label: 'Projeto',               type: 'select', options: function(){ return _gestorOptionsFrom(function(a){ return a._projNome; }); }, getValue: function(a){ return a._projNome; } },
  { key: 'melhoria',    label: 'Melhoria',               type: 'select', options: function(){ return _gestorOptionsFrom(function(a){ return a._melhNome; }); }, getValue: function(a){ return a._melhNome; } },
  { key: 'tipo_resp',   label: 'Individual / Coletiva', type: 'select', options: ['Tarefas Individuais','Tarefas Coletivas','— Sem responsável'], getValue: _gTipoResp },
  { key: 'data_prazo',  label: 'Prazo',                  type: 'date' },
  { key: 'data_inicio', label: 'Início',                 type: 'date' },
  { key: 'observacoes', label: 'Observações',            type: 'text' },
  { key: 'atualizado_por', label: 'Último alterado por', type: 'select', options: function(){ return _gestorOptionsFrom(_gestorAtualizadoPorNome); }, getValue: _gestorAtualizadoPorNome, userField: true },
  { key: 'criado_por',  label: 'Criada por',             type: 'select', options: function(){ return _gestorOptionsFrom(_gestorCriadoPorNome); }, getValue: _gestorCriadoPorNome, userField: true },
  { key: 'created_at',  label: 'Data de criação',        type: 'date' },
 ], _gestorApplyFilters);

 var _prioOrdemSort = { 'Alta': 0, 'Média': 1, 'Baixa': 2 };
 _sbInit('gestor', [
  { key: 'data_prazo',  label: 'Prazo',      type: 'date' },
  { key: 'data_inicio', label: 'Início',     type: 'date' },
  { key: 'titulo',      label: 'Tarefa',     type: 'text' },
  { key: 'prioridade',  label: 'Prioridade', type: 'number', getValue: function(a){ return _prioOrdemSort[a.prioridade] ?? 3; } },
  { key: 'status',      label: 'Status',     type: 'text', getValue: function(a){ return a.status||''; } },
  { key: 'area',        label: 'Área',       type: 'text' },
  { key: 'obra',        label: 'Obra',       type: 'text', getValue: function(a){ return a._obraNome||''; } },
  { key: 'responsavel', label: 'Responsável', type: 'text', getValue: function(a){ return a.responsavel||''; } },
 ], _gestorApplyFilters);
 // Só inicializa o nível padrão (Prazo ↑) na primeira vez — trocas de aba/
 // dados não devem resetar uma ordenação que a pessoa já escolheu.
 if (!_sbInstances.gestor.state.levels.length) _sbInstances.gestor.state.levels = [{ field: 'data_prazo', dir: 'asc' }];

 // Agrupamento — mesmos campos/semântica que _gestorRenderGrid já entende
 // (inclusive "Projeto → Obra", que é um caso especial de 2 níveis fixos,
 // não um nível genérico do group-builder). Até 3 níveis (Responsável →
 // Início → Status, por exemplo) via _gestorBuildGroupTree/_gestorRenderGroupNode,
 // com expansão/recolhimento independente por nó (chave composta, path::path).
 // "Projeto → Obra" continua um caso especial fixo de 2 níveis (não é um
 // campo comum — é uma relação hierárquica própria), sem entrar no sistema
 // genérico de múltiplos níveis.
 _gbInit('gestor', [
  { key: 'titulo',        label: 'Nome da Tarefa' },
  { key: 'responsavel',   label: 'Responsável' },
  { key: 'tipo_resp',     label: 'Individual / Coletiva' },
  { key: 'status',        label: 'Status' },
  { key: 'area',          label: 'Área' },
  { key: 'data_prazo',    label: 'Prazo' },
  { key: 'data_inicio',   label: 'Data de Início' },
  { key: 'projeto_obra',  label: 'Projeto → Obra' },
 ], _gestorApplyFilters, 3);
 // Sem valor padrão forçado aqui de propósito — "sem agrupamento" agora é
 // um estado real (grade plana, ver _gestorRenderGrid), não mais disfarçado
 // de agrupamento por responsável (que dividia Individual/Coletiva mesmo
 // com o Agrupar desativado).

 // Restaura filtro/ordenação/agrupamento/período da última vez que a pessoa
 // usou o Gestor de Tarefas (senão tudo resetava a cada F5/reabertura da
 // aba). Vem depois dos *Init acima de propósito: eles é que garantem os
 // valores padrão quando não há nada salvo ainda.
 _gestorRestoreState();
}

// ── Persistência local (filtro/ordenação/agrupamento/período) ────────────
// Mesma convenção de chaves já usada no app (sb-collapsed, milatec-theme em
// scripts/app.js) — só o estado da TELA, não dados; "Visualizações" salvas
// (nomeadas, compartilhadas com outros usuários) continuam 100% no Supabase.
var GESTOR_STATE_KEY = 'milatec-gestor-state';
function _gestorSaveState() {
 try {
  var fbInst = _fbInstances && _fbInstances.gestor;
  var sbInst = _sbInstances && _sbInstances.gestor;
  var gbInst = _gbInstances && _gbInstances.gestor;
  var state = {
   filtro: fbInst ? fbInst.state : null,
   ordenacao: sbInst ? sbInst.state : null,
   agrupamento: gbInst ? gbInst.state : null,
   periodo: {
    preset: _gestorPeriodo.preset,
    ini: _gestorPeriodo.ini ? _gestorFmtDate(_gestorPeriodo.ini) : null,
    fim: _gestorPeriodo.fim ? _gestorFmtDate(_gestorPeriodo.fim) : null
   },
   busca: (document.getElementById('gestor-search') || {}).value || '',
   somenteAtrasadas: _gestorSomenteAtrasadas
  };
  localStorage.setItem(GESTOR_STATE_KEY, JSON.stringify(state));
 } catch (e) { /* localStorage indisponível (modo privado etc.) — ignora */ }
}
function _gestorRestoreState() {
 var raw;
 try { raw = localStorage.getItem(GESTOR_STATE_KEY); } catch (e) { return; }
 if (!raw) return;
 var state;
 try { state = JSON.parse(raw); } catch (e) { return; }
 if (!state) return;

 if (state.filtro && _fbInstances.gestor) { _fbInstances.gestor.state = state.filtro; }
 if (state.ordenacao && _sbInstances.gestor) { _sbInstances.gestor.state = state.ordenacao; }
 if (state.agrupamento && _gbInstances.gestor) { _gbInstances.gestor.state = state.agrupamento; }
 if (state.busca) {
  var si = document.getElementById('gestor-search');
  if (si) si.value = state.busca;
  // O valor era restaurado, mas o wrapper .ts-search continuava sem a
  // classe "expanded" — o input fica com width:0/opacity:0 nesse estado
  // (styles/main.css), então a barra "sumia" mesmo com texto e filtro
  // real aplicados por baixo (achado: "a busca fecha ao recarregar",
  // quando na verdade nunca tinha reaberto). Só adiciona a classe direto
  // (não usa _tsSearchExpand — ela também dá foco automático no campo,
  // que não faz sentido logo no carregamento da página).
  var wrap = document.getElementById('ts-search-gestor');
  if (wrap) wrap.classList.add('expanded');
 }
 if (state.somenteAtrasadas) {
  _gestorSomenteAtrasadas = true;
  var abtn = document.getElementById('gestor-btn-atrasadas');
  if (abtn) abtn.classList.add('active');
 }
 if (state.periodo && state.periodo.preset) {
  if (state.periodo.preset === 'custom' && state.periodo.ini && state.periodo.fim) {
   var ei = document.getElementById('gestor-dt-ini'), ef = document.getElementById('gestor-dt-fim');
   if (ei) ei.value = state.periodo.ini;
   if (ef) ef.value = state.periodo.fim;
   var cd = document.getElementById('gestor-custom-dates'); if (cd) cd.style.display = 'inline-flex';
   _gestorPreset('custom', null);
  } else {
   var btnMap = { semana:'gp-semana', prox2:'gp-prox2', mes:'gp-mes', trim:'gp-trim', todas:'gp-todas' };
   var btnId = btnMap[state.periodo.preset];
   if (btnId) _gestorPreset(state.periodo.preset, document.getElementById(btnId));
  }
 }
 // Re-render dos popovers com o estado restaurado (sem isso, só o dado
 // interno mudaria — o popover mostraria o padrão até a pessoa abrir/fechar).
 if (_fbInstances.gestor) _fbRender('gestor');
 if (_sbInstances.gestor) _sbRender('gestor');
 if (_gbInstances.gestor) _gbRender('gestor');
 _gestorApplyFilters();
}

// ── Aplicar filtros, ordenar e re-renderizar ──────────────────────────────
function _gestorApplyFilters() {
 var search = (document.getElementById('gestor-search') || {}).value || '';
 var sq = _ssNormalize(search);

 var pIni = _gestorPeriodo.ini; // Date ou null
 var pFim = _gestorPeriodo.fim; // Date ou null

 _gestorFiltered = _gestorAllAt.filter(function(a) {
  // Filtro de período: inclui se data_prazo OU data_inicio cai no período
  if (pIni && pFim) {
   var di = a.data_inicio ? new Date(a.data_inicio + 'T00:00:00') : null;
   var df = a.data_prazo  ? new Date(a.data_prazo  + 'T00:00:00') : null;
   // atividade tem alguma interseção com o período?
   var inPeriod = false;
   if (df && df >= pIni && df <= pFim) inPeriod = true;      // prazo no período
   if (di && di >= pIni && di <= pFim) inPeriod = true;      // início no período
   // atividade que atravessa o período (começa antes, termina depois)
   if (di && df && di <= pFim && df >= pIni) inPeriod = true;
   if (!inPeriod) return false;
  }
  if (_gestorSomenteAtrasadas && !_gIsLate(a)) return false;
  // Busca inteligente: qualquer parte do texto, em vários campos de uma vez
  // (não só o título) — ignora acento/caixa/espaço duplo e cai pra fuzzy leve
  // em queries de 4+ caracteres (scripts/lib/smart-search.js).
  if (sq) {
   var haystack = _ssHaystack([a.titulo, a.responsavel, a._obraNome, a._projNome, a._melhNome, a.area, _gTipoAtividade(a), a.observacoes]);
   if (!_ssMatch(haystack, sq)) return false;
  }
  if (!_fbEvaluate(a, 'gestor')) return false;
  return true;
 });

 // ── Ordenação (múltipla, em cascata — scripts/lib/sort-builder.js) ───────
 _gestorFiltered.sort(function(a, b) {
  var r = _sbCompare(a, b, 'gestor');
  if (r !== 0) return r;
  // Empate: mesmo desempate de sempre (prazo ↑), pra ordem ficar estável.
  var dA = a.data_prazo ? new Date(a.data_prazo+'T00:00:00').getTime() : Infinity;
  var dB = b.data_prazo ? new Date(b.data_prazo+'T00:00:00').getTime() : Infinity;
  return dA - dB;
 });

 // Nota: os "stats rápidos" do topo (gst-total/prog/pend/late/afazer) NÃO
 // são mais recalculados aqui a partir de _gestorFiltered — são KPIs
 // globais (visão "Gestor" completa, independente de busca/filtro na tela),
 // vindos de rpc_atividades_kpis via _gestorLoadKpis() (disparada em
 // _gestorLoad, no boot e a cada evento realtime de `atividades`). Calcular
 // isso aqui de novo a cada filtro re-sobrescreveria os KPIs globais com um
 // subconjunto filtrado, o que é exatamente a inconsistência que motivou a
 // migração pra RPC.

 if (_gestorView === 'grid')          _gestorRenderGrid();
 else if (_gestorView === 'timeline') _gestorRenderTimeline();
 else if (_gestorView === 'metricas') _gestorRenderMetricas();
 else if (_gestorView === 'setor')    _gestorRenderSetor();

 _gestorSaveState();
}

// ── Troca de aba ──────────────────────────────────────────────────────────
var _SETOR_CORES = {
 'Projetos':   '#2E5FD9',
 'Comercial':  '#1F8A4C',
 'TI':         '#8957e5',
 'Produção':   '#B8790A',
 'Equipe P&D': '#ec4899',
 'Logística':  '#06b6d4',
 'Dados':      '#004AE8',
 'Marketing':  '#f97316',
 'Compras':    '#64748b',
 'Processos':  '#64748b',
};

function _setorCor(area) {
 return _SETOR_CORES[area] || '#7D8199';
}

function _gestorRenderSetor() {
 var container = document.getElementById('gestor-setor-content');
 if (!container) return;

 // Agrupar por área
 var groups = {};
 var order = [];
 _gestorFiltered.forEach(function(a) {
  var key = a.area || '— Sem setor';
  if (!groups[key]) { groups[key] = []; order.push(key); }
  groups[key].push(a);
 });

 // Ordenar por volume desc
 order.sort(function(a,b){ return groups[b].length - groups[a].length; });

 var hoje = new Date(); hoje.setHours(0,0,0,0);

 var cols = order.map(function(setor) {
  var items = groups[setor];
  var cor = _setorCor(setor);
  var nLate = items.filter(function(a){ return _gIsLate(a); }).length;
  var nDone = items.filter(function(a){ return _gIsDone(a.status); }).length;

  var cards = items.slice(0,50).map(function(a) {
   var late = _gIsLate(a);
   // sc/status sempre do valor real — "atrasada" é só a cor do dot/data
   // (cor diferenciada), nunca substitui o texto do status.
   var sc   = _gStatusCls(a.status || 'A fazer');
   var statusDot = '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:' + (late ? '#D6433C' : sc.dot) + ';flex-shrink:0;margin-top:3px"></span>';
   var prazoTxt = '';
   if (a.data_prazo) {
    var dp = new Date(a.data_prazo + 'T00:00:00');
    var diff = Math.floor((dp - hoje) / 86400000);
    var dpStr = dp.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
    prazoTxt = late ? '<span style="color:#D6433C;font-size:9px;font-weight:700">' + dpStr + '</span>'
     : diff <= 3 ? '<span style="color:#B8790A;font-size:9px">' + dpStr + '</span>'
     : '<span style="color:var(--muted);font-size:9px">' + dpStr + '</span>';
   }
   var respStr = (a.responsavel || '').split(/[,;]+/)[0].trim();
   var titulo = (a.titulo || '—').slice(0, 48);
   return '<div onclick="_gestorRowClick(\'' + a.id + '\')" style="background:var(--surface);border:1px solid var(--border);border-radius:7px;padding:8px 10px;cursor:pointer;transition:border-color .12s;margin-bottom:6px" onmouseover="this.style.borderColor=\'' + cor + '\'" onmouseout="this.style.borderColor=\'var(--border)\'">'
    + '<div style="display:flex;gap:6px;align-items:flex-start">'
    + statusDot
    + '<div style="flex:1;min-width:0">'
    + '<div style="font-size:12px;font-weight:500;color:var(--text);line-height:1.35;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">' + titulo + '</div>'
    + '</div></div>'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px">'
    + '<span style="font-size:9px;background:' + sc.dot + '22;color:' + sc.dot + ';padding:1px 7px;border-radius:20px;font-weight:700">' + (a.status || 'A fazer') + '</span>'
    + '<div style="display:flex;align-items:center;gap:6px">'
    + (respStr ? '<span style="font-size:9px;color:var(--muted)">' + respStr.split(' ')[0] + '</span>' : '')
    + (prazoTxt || '')
    + '</div></div>'
    + '</div>';
  }).join('');

  var moreHtml = items.length > 50
   ? '<div style="font-size:10px;color:var(--muted);text-align:center;padding:6px">+' + (items.length - 50) + ' mais — use o filtro</div>'
   : '';

  return '<div style="min-width:220px;max-width:240px;flex-shrink:0;display:flex;flex-direction:column">'
   + '<div style="background:' + cor + ';border-radius:8px 8px 0 0;padding:10px 12px;display:flex;align-items:center;justify-content:space-between">'
   + '<div style="font-size:12px;font-weight:700;color:#fff">' + setor + '</div>'
   + '<div style="display:flex;align-items:center;gap:6px">'
   + '<span style="background:rgba(255,255,255,.25);color:#fff;font-size:10px;font-weight:700;padding:1px 8px;border-radius:20px">' + items.length + '</span>'
   + (nLate > 0 ? '<span style="background:#D6433C;color:#fff;font-size:9px;font-weight:700;padding:1px 6px;border-radius:20px">' + nLate + ' atras.</span>' : '')
   + '</div></div>'
   + '<div style="background:var(--surface2);border:1px solid ' + cor + '44;border-top:none;border-radius:0 0 8px 8px;padding:6px;overflow-y:auto;max-height:calc(100vh - 280px)">'
   + '<div style="font-size:9px;color:var(--muted);text-align:center;padding:4px 0 8px">' + nDone + '/' + items.length + ' concluídas</div>'
   + cards + moreHtml
   + '</div></div>';
 });

 container.innerHTML = cols.length
  ? cols.join('')
  : '<div style="padding:40px;text-align:center;color:var(--muted);font-size:12px">Nenhuma atividade encontrada.</div>';
}

function _gestorSetView(v, btn) {
 _gestorView = v;
 document.querySelectorAll('.gestor-tab').forEach(function(b){ b.classList.remove('active'); });
 if (btn) btn.classList.add('active');
 var panels = { grid:'gestor-panel-grid', timeline:'gestor-panel-timeline', metricas:'gestor-panel-metricas', setor:'gestor-panel-setor' };
 Object.keys(panels).forEach(function(k) {
  var p = document.getElementById(panels[k]);
  if (p) p.style.display = k === v ? (k === 'setor' ? 'flex' : '') : 'none';
 });
 // "Agrupar" só tem efeito na Grade (_gestorRenderGrid é a única que lê
 // gestor-f-group) — nas outras abas ele não fazia nada, só confundia.
 var groupWrap = document.getElementById('gestor-group-wrap');
 if (groupWrap) groupWrap.style.display = v === 'grid' ? '' : 'none';
 // toolbar visível em todas as views (metricas também tem filtros agora)
 _gestorApplyFilters();
}

// ══════════════════════════════════════════════════════════════════════════
// GRADE (Grid)
// ══════════════════════════════════════════════════════════════════════════
// Campo de agrupamento → coluna real da tabela que fica redundante (o valor
// já está no cabeçalho do grupo) — só existe mapeamento pra quem TEM uma
// coluna própria (Status/Área/Prazo/Início); Responsável, Individual/Coletiva
// e Projeto→Obra não têm coluna dedicada na Grade, então não há o que ocultar.
// Recebe a lista de campos de TODOS os níveis ativos (agrupamento múltiplo) —
// cada nível que tiver coluna correspondente esconde a sua.
var _GESTOR_GROUP_COL_CLASS = { status: 'gb-hide-status', area: 'gb-hide-area', data_prazo: 'gb-hide-prazo', data_inicio: 'gb-hide-inicio' };
function _gestorSyncGroupedColumn(fields) {
 var table = document.querySelector('#gestor-panel-grid .gestor-tbl');
 if (!table) return;
 Object.keys(_GESTOR_GROUP_COL_CLASS).forEach(function(k){ table.classList.remove(_GESTOR_GROUP_COL_CLASS[k]); });
 (fields || []).forEach(function(f) {
  var cls = _GESTOR_GROUP_COL_CLASS[f];
  if (cls) table.classList.add(cls);
 });
}

// ── Agrupamento múltiplo + buckets de data (itens #3/#4 do pedido de UX) ──
// A árvore N-níveis e os buckets inteligentes de data (Hoje/Amanhã/Esta
// semana/.../Mês de Ano) são lógica pura e reutilizável por qualquer módulo
// — vivem em scripts/lib/group-tree.js (_gtBuildTree/_gtDateBucket/
// _gtTreeCount), com teste automatizado próprio. Aqui só fica o que é
// específico do Gestor de Tarefas: como cada CAMPO vira chave de grupo.
function _gestorGroupKeyFor(a, field) {
 // "Nome da Tarefa" agrupa por letra inicial (A, B, C...) — índice
 // alfabético, mesmo critério já usado em "Nome" no agrupamento de Empresas
 // (_empGroupKeyFor): agrupar pelo título completo criaria um grupo por
 // tarefa, o que não serve pra nada como agrupamento.
 if (field === 'titulo') {
  var t = (a.titulo || '').trim();
  return { key: t ? t.charAt(0).toUpperCase() : '— Sem título', sortKey: null };
 }
 if (field === 'responsavel') {
  var respList = (a.responsavel || '').split(/[,;]+/).map(function(r){ return r.trim(); }).filter(Boolean);
  return { key: respList.length === 0 ? '— Sem responsável' : (respList.length === 1 ? respList[0] : 'Tarefas Coletivas'), sortKey: null };
 }
 if (field === 'status') return { key: a.status || 'A fazer', sortKey: null };
 if (field === 'area') return { key: a.area || '— Sem área', sortKey: null };
 if (field === 'tipo_resp') return { key: _gTipoResp(a), sortKey: null };
 if (field === 'data_prazo') return _gtDateBucket(a.data_prazo);
 if (field === 'data_inicio') return _gtDateBucket(a.data_inicio);
 return { key: '— Sem grupo', sortKey: null };
}
var _GESTOR_GROUP_FIXED_ORDERS = { tipo_resp: ['Tarefas Individuais', 'Tarefas Coletivas', '— Sem responsável'] };
function _gestorBuildGroupTree(items, levels) {
 return _gtBuildTree(items, levels, _gestorGroupKeyFor, _GESTOR_GROUP_FIXED_ORDERS, 0);
}
function _gestorTreeCount(node, predicate) {
 return _gtTreeCount(node, predicate);
}

// Renderiza a árvore recursivamente. path[] identifica o nó atual (usado pra
// compor a chave de expandir/recolher, independente por nó — não só por
// nome do grupo, senão "João" dentro de "Agosto" e "João" dentro de
// "Setembro" compartilhariam o mesmo estado de expansão).
function _gestorRenderGroupNode(node, path, rowNumRef, hoje, rowsArr) {
 if (node.leaf) {
  node.items.forEach(function(a) { rowNumRef.n++; rowsArr.push(_gestorRenderRow(a, rowNumRef.n, hoje)); });
  return;
 }
 node.order.forEach(function(k) {
  var child = node.children[k];
  var nodePath = path.concat(k).join(' :: ');
  var isCollapsed = !!_gestorCollapsed[nodePath];
  var total = _gestorTreeCount(child);
  var nDone = _gestorTreeCount(child, function(a){ return _gIsDone(a.status); });
  var nLate = _gestorTreeCount(child, function(a){ return _gIsLate(a); });
  var indent = path.length * 20;
  var badge = nLate > 0
   ? '<span style="background:rgba(207,34,46,.12);color:#D6433C;border-radius:4px;padding:1px 6px;font-size:9px;font-weight:700;margin-left:6px">' + nLate + ' atrasadas</span>'
   : '';
  var doneBadge = _gtCountBadgeHTML(nDone + '/' + total, 'concluídas');
  // Status já tem cor definida (BADGE_STATUS_TAREFA, badge-colors.js — mesma
  // usada pra colorir o <select> de status no drawer de tarefa) — o
  // cabeçalho de grupo usa a mesma cor em vez de texto puro.
  var _gestorGrupoCls = node.field === 'status' ? _badgeCls(BADGE_STATUS_TAREFA, k) : null;
  rowsArr.push(
   '<tr class="' + _gtGroupClass(path.length) + '" onclick="_gestorToggleGroup(\'' + nodePath.replace(/'/g, "\\'") + '\')">'
   + '<td colspan="8" style="padding-left:' + (12 + indent) + 'px">'
   + '<span style="margin-right:4px">' + (isCollapsed ? '▶' : '▼') + '</span>'
   + _gtGroupLabelHTML(k, _gestorGrupoCls) + doneBadge + badge
   + '</td></tr>'
  );
  if (!isCollapsed) _gestorRenderGroupNode(child, path.concat(k), rowNumRef, hoje, rowsArr);
 });
}

function _gestorRenderGrid() {
 var tbody = document.getElementById('gestor-tbl-body');
 if (!tbody) return;

 var levels = (_gbInstances.gestor && _gbInstances.gestor.state.levels) || [];
 var primaryField = levels[0] && levels[0].field;

 // Agrupamento hierárquico Projeto → Obra: continua uma estrutura fixa de 2
 // níveis própria (não é um campo comum — é uma relação, não composável com
 // outros campos no mesmo nível), fora do sistema genérico de múltiplos
 // níveis abaixo.
 if (primaryField === 'projeto_obra') {
  _gestorSyncGroupedColumn([]);
  var nested = {}, projOrder = [];
  _gestorFiltered.forEach(function(a) {
   var pk = a._projNome || '— Sem projeto';
   var ok = a._obraNome || '— Sem obra';
   if (!nested[pk]) { nested[pk] = { obras: {}, obraOrder: [] }; projOrder.push(pk); }
   if (!nested[pk].obras[ok]) { nested[pk].obras[ok] = []; nested[pk].obraOrder.push(ok); }
   nested[pk].obras[ok].push(a);
  });
  var nrows = '', nRowNum = 0;
  projOrder.forEach(function(pk) {
   var proj = nested[pk];
   var projKey = 'P::' + pk;
   var projCollapsed = _gestorCollapsed[projKey];
   var projTotal = proj.obraOrder.reduce(function(s,ok){ return s + proj.obras[ok].length; }, 0);
   nrows += '<tr class="' + _gtGroupClass(0) + '" onclick="_gestorToggleGroup(\'' + projKey.replace(/'/g,"\\'") + '\')">'
    + '<td colspan="8" style="padding-left:12px"><span style="margin-right:4px">' + (projCollapsed?'▶':'▼') + '</span>'
    + '<strong>' + pk + '</strong>' + _gtCountBadgeHTML(projTotal, 'atividade' + (projTotal!==1?'s':'')) + '</td></tr>';
   if (projCollapsed) return;
   proj.obraOrder.forEach(function(ok) {
    var items = proj.obras[ok];
    var obraKey = projKey + '::O::' + ok;
    var obraCollapsed = _gestorCollapsed[obraKey];
    nrows += '<tr class="' + _gtGroupClass(1) + '" onclick="_gestorToggleGroup(\'' + obraKey.replace(/'/g,"\\'") + '\')">'
     + '<td colspan="8" style="padding-left:32px"><span style="margin-right:4px">' + (obraCollapsed?'▶':'▼') + '</span>'
     + '<strong>' + ok + '</strong>' + _gtCountBadgeHTML(items.length) + '</td></tr>';
    if (obraCollapsed) return;
    items.forEach(function(a) { nRowNum++; nrows += _gestorRenderRow(a, nRowNum); });
   });
  });
  tbody.innerHTML = nrows || '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:40px;font-size:12px">Nenhuma atividade encontrada para o período selecionado.</td></tr>';
  return;
 }

 // Sem agrupamento nenhum: grade plana de verdade, uma linha por atividade,
 // sem nenhum cabeçalho de grupo. Antes disto, "sem agrupamento" caía num
 // agrupamento por "responsavel" disfarçado (_gestorGroupKeyFor colapsa 2+
 // responsáveis em "Tarefas Coletivas") — ou seja, a divisão Individual/
 // Coletiva aparecia mesmo com o Agrupar desativado.
 if (!levels.length) {
  _gestorSyncGroupedColumn([]);
  var hojeFlat = new Date(); hojeFlat.setHours(0,0,0,0);
  var flatRows = _gestorFiltered.map(function(a, i) { return _gestorRenderRow(a, i + 1, hojeFlat); });
  tbody.innerHTML = flatRows.length
   ? flatRows.join('')
   : '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:40px;font-size:12px">Nenhuma atividade encontrada para o período selecionado.</td></tr>';
  return;
 }

 _gestorSyncGroupedColumn(levels.map(function(l){ return l.field; }));

 var hoje = new Date(); hoje.setHours(0,0,0,0);
 var tree = _gestorBuildGroupTree(_gestorFiltered, levels, 0);
 var rowsArr = [];
 _gestorRenderGroupNode(tree, [], { n: 0 }, hoje, rowsArr);

 tbody.innerHTML = rowsArr.length
  ? rowsArr.join('')
  : '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:40px;font-size:12px">Nenhuma atividade encontrada para o período selecionado.</td></tr>';
}

// Renderiza uma linha da Grade — extraído para ser reaproveitado tanto pelo
// agrupamento de 1 nível quanto pelo agrupamento hierárquico Projeto → Obra.
function _gestorRenderRow(a, rowNum, hoje) {
 hoje = hoje || (function(){ var h = new Date(); h.setHours(0,0,0,0); return h; })();
 var late    = _gIsLate(a);
 // Status = sempre o valor real da atividade — "atrasada" é uma condição
 // calculada exibida como badge à parte (abaixo), nunca sobrescreve o
 // status verdadeiro (bug real: uma tarefa "Obsoleto" vencida aparecia
 // como "Atrasado" na Grade, escondendo o status que o usuário definiu).
 var sc      = _gStatusCls(a.status || 'A fazer');
 var statusLbl = a.status || 'A fazer';
 var dot     = late ? '#D6433C' : sc.dot;

 // Prazo formatado
 var prazoHtml = '';
 if (a.data_prazo) {
  var dp = new Date(a.data_prazo + 'T00:00:00');
  var diff = Math.floor((dp - hoje) / 86400000);
  var dpStr = dp.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' });
  if (late)      prazoHtml = '<span style="color:#D6433C;font-weight:700">' + dpStr + '</span>';
  else if (diff <= 3) prazoHtml = '<span style="color:#B8790A;font-weight:600">' + dpStr + '</span>';
  else           prazoHtml = '<span style="color:var(--muted)">' + dpStr + '</span>';
 } else { prazoHtml = '<span style="color:var(--border)">—</span>'; }

 // Responsável — embutido antes do título em vez de coluna própria. Não
 // existe conceito de "equipe" nos dados (ver decisão registrada); a
 // distinção individual/coletiva agora vive no agrupamento "Individual /
 // Coletiva" da grade (_gTipoResp/groupBy), não mais numa pilha de avatares
 // em toda linha — a pilha ficou poluída. Aqui é só o avatar do principal,
 // com um selinho discreto de contagem quando há mais gente, e o tooltip
 // lista todo mundo.
 var respArr = (a.responsavel || '').split(/[,;]+/).map(function(r){ return r.trim(); }).filter(Boolean);
 var respAvatarHtml;
 if (!respArr.length) {
  respAvatarHtml = '<span style="width:32px;height:32px;border-radius:50%;background:var(--surface2);border:1px dashed var(--border);flex-shrink:0" title="Sem responsável"></span>';
 } else if (respArr.length === 1) {
  // oncontextmenu: clique direito no avatar abre o cartão de info (cargo,
  // área, data de entrada — ver _showUserInfoCard em avatar-helpers.js).
  respAvatarHtml = '<span style="display:inline-flex;flex-shrink:0" title="' + respArr[0].replace(/"/g,'&quot;') + '" oncontextmenu="_showUserInfoCard(\'' + respArr[0].replace(/'/g,"\\'") + '\', event); return false;">' + _userAvatarByName(respArr[0], 32) + '</span>';
 } else {
  // Coletiva: linha fica só com o avatar do principal + selo de contagem
  // (não polui a grade) — passar o mouse mostra a foto de TODOS, não só
  // do primeiro, num popover flutuante (puro CSS, sem precisar abrir a tarefa).
  // Clique direito em qualquer avatar (principal ou dentro do popover) abre
  // o cartão de info dessa pessoa.
  var panelItems = respArr.map(function(r) {
   var rEsc = r.replace(/'/g,"\\'");
   return '<div class="resp-hover-item" oncontextmenu="_showUserInfoCard(\'' + rEsc + '\', event); return false;">' + _userAvatarByName(r, 22) + '<span>' + r.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</span></div>';
  }).join('');
  respAvatarHtml = '<span class="resp-hover" style="display:inline-flex;flex-shrink:0">'
   + '<span style="display:inline-flex;position:relative" oncontextmenu="_showUserInfoCard(\'' + respArr[0].replace(/'/g,"\\'") + '\', event); return false;">'
   + _userAvatarByName(respArr[0], 32)
   + '<span style="position:absolute;right:-5px;bottom:-5px;min-width:16px;height:16px;padding:0 3px;border-radius:20px;background:var(--navy);color:#fff;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px var(--surface)">' + respArr.length + '</span>'
   + '</span>'
   + '<div class="resp-hover-panel">' + panelItems + '</div>'
   + '</span>';
 }

 // Prioridade — mesma decisão de sempre (Alta/Média/Baixa), só a classe de cor mudou
 var prioClasses = { 'Alta':'tag-priority-high','Média':'tag-priority-med','Baixa':'tag-priority-low' };
 var prioCls = prioClasses[a.prioridade] || '';

 // Data início formatada
 var inicioHtml = '';
 if (a.data_inicio) {
  var di2 = new Date(a.data_inicio + 'T00:00:00');
  inicioHtml = '<span style="color:var(--muted);font-size:10px">' + di2.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}) + '</span>';
 } else { inicioHtml = '<span style="color:var(--border)">—</span>'; }

 // Vínculos: usa campos enriquecidos no load (lookup por id + desnormalizado)
 // Exibidos como badges compactos (sigla + tooltip) para não poluir a grade —
 // detalhes completos (etapa/status) ficam no painel lateral ao abrir a tarefa.
 var obraNome = a._obraNome || '';
 var projNome = a._projNome || '';
 var melhNome = a._melhNome || '';
 var vincParts = [];
 var vincTitleParts = [];
 if (obraNome) { vincParts.push(obraNome); vincTitleParts.push('Obra/Orçamento: ' + obraNome); }
 if (projNome) { vincParts.push(projNome); vincTitleParts.push('Projeto: ' + projNome); }
 if (melhNome) { vincParts.push(melhNome); vincTitleParts.push('Melhoria: ' + melhNome); }
 var vincLine = vincParts.join(' • ');
 if (vincLine.length > 42) vincLine = vincLine.slice(0, 42) + '…';
 var vincHtml = vincParts.length
  ? '<div style="font-size:10px;color:var(--muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + vincTitleParts.join(' · ').replace(/"/g,'&quot;') + '">' + vincLine.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>'
  : '';
 // Título truncado por caracteres (não apenas CSS) — nome completo só no
 // tooltip, painel lateral e edição. Corta em espaço para não quebrar palavras.
 var tituloFull = (a.titulo || '—').trim();
 // Escapado ANTES de truncar: título é texto livre digitado pelo usuário —
 // sem isso, um título como "<img src=x onerror=...>" executava no
 // navegador de qualquer pessoa que visse essa linha (XSS armazenado real,
 // achado na auditoria de segurança).
 var tituloShort = _gestorSvgEsc(tituloFull);
 if (tituloShort.length > 36) {
  var cut = tituloShort.slice(0, 36);
  var lastSp = cut.lastIndexOf(' ');
  if (lastSp > 15) cut = cut.slice(0, lastSp);
  tituloShort = cut + '…';
 }

 // Tipo de atividade — coluna dedicada para visibilidade consistente
 var tipoNome = _gTipoAtividade(a).trim();

 // Descrição resumida
 var descText = (a.descricao || a.observacoes || '').trim();
 // Mesmo motivo do título acima: descrição/observações é texto livre,
 // precisa ser escapado antes de virar HTML.
 var descHtml = descText
  ? '<div style="font-size:10px;color:var(--muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + _gestorSvgEsc(descText) + '">' + _gestorSvgEsc(descText.length > 42 ? descText.slice(0,42) + '…' : descText) + '</div>'
  : '';

 return '<tr onclick="_gestorRowClick(\'' + a.id + '\')" style="' + (late ? 'background:rgba(207,34,46,.02)' : '') + '">'
  + '<td style="color:var(--muted);font-size:10px;text-align:center">' + rowNum + '</td>'
  + '<td title="' + (a.titulo||'').replace(/"/g,'&quot;') + '" style="font-weight:500;color:' + (late?'#D6433C':'var(--text)') + '">'
  + '<div style="display:flex;align-items:center;gap:6px;min-width:0">'
  + respAvatarHtml
  + '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:' + dot + ';flex-shrink:0"></span>'
  + '<div style="min-width:0;overflow:hidden;flex:1">'
  + '<div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + tituloShort + '</div>'
  + descHtml + vincHtml + '</div>'
  + '</div></td>'
  // Sem selo "Atrasada" na linha — empilhava mal debaixo do status (célula
  // estreita) e é redundante: o título já fica vermelho quando vencido
  // (linha acima), e o botão "Atrasadas" na toolbar já filtra a lista.
  + '<td><span class="gs-badge ' + sc.cls + '">' + statusLbl + '</span></td>'
  + '<td>' + prazoHtml + '</td>'
  + '<td>' + inicioHtml + '</td>'
  + '<td>' + (a.prioridade ? '<span class="' + prioCls + '">' + a.prioridade + '</span>' : '<span style="color:var(--border)">—</span>') + '</td>'
  + '<td>' + (a.area ? '<span style="font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px;background:' + _setorCor(a.area) + '22;color:' + _setorCor(a.area) + '">' + a.area + '</span>' : '<span style="color:var(--border)">—</span>') + '</td>'
  + '<td>' + (tipoNome ? '<span style="font-size:10px;font-weight:600;color:var(--text)">' + tipoNome + '</span>' : '<span style="color:var(--border)">—</span>') + '</td>'
  + '</tr>';
}

function _gestorToggleGroup(key) {
 _gestorCollapsed[key] = !_gestorCollapsed[key];
 _gestorRenderGrid();
}

function _gestorRowClick(id) {
 var ativ = _gestorAllAt.find(function(a){ return String(a.id) === String(id); });
 if (ativ) _feedItemClick(null, ativ);
}

// ══════════════════════════════════════════════════════════════════════════
// GANTT (SVG puro)
// ══════════════════════════════════════════════════════════════════════════
// Constrói o grid de semanas (header de dias + barras) para um array de dias
// (`days`, multiplo de 7). `dimFn(day)` retorna true se o dia deve aparecer
// esmaecido (fora do mes/intervalo selecionado). Sem marcador especial de "Hoje".
function _gestorBuildCalGrid(days, tRanges, tColor, dimFn) {
 var dShort = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab'];
 var LANES_DEFAULT=3, BAR_H=20, BAR_GAP=2, DAY_NUM_H=26;
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
  var isExpanded=!!_gestorWeekExpanded[weekKey];

  var wTasks=tRanges.filter(function(tr){ return +tr.s<=+wEnd && +tr.e>=+wStart; });

  // greedy lane assignment (todas as lanes, sem limite)
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

  // Renderizar barras das lanes visíveis
  wTasks.forEach(function(tr,ti){
   var lane=taskLane[ti];
   if(lane>=visLanes) return; // oculta — não renderiza

   var a=tr.a, c=tColor(a), done=_gIsDone(a.status);
   var colS=Math.max(0,Math.round((+tr.s-+wStart)/86400000));
   var colE=Math.min(6,Math.round((+tr.e-+wStart)/86400000));
   var spans=colE-colS+1;
   var pL=(colS/7*100).toFixed(2), pW=(spans/7*100).toFixed(2);
   var blR=+tr.s<+wStart?'0':'4px', brR=+tr.e>+wEnd?'0':'4px';
   var contL=+tr.s<+wStart?'&#9668; ':'', contR=+tr.e>+wEnd?' &#9658;':'';
   var resp0=(a.responsavel||'').split(/[,;]+/)[0].trim().split('@')[0].split('.')[0];
   resp0=resp0?resp0.charAt(0).toUpperCase()+resp0.slice(1):'';
   var barText=contL+(a.titulo||'--')+(resp0?' &middot; '+resp0:'')+contR;
   var topY=lane*(BAR_H+BAR_GAP);
   var ctxLines=[];
   if (a._obraNome)     ctxLines.push('Obra: '+a._obraNome);
   if (a._projNome)     ctxLines.push('Projeto: '+a._projNome+(a._etapaProjeto?' ('+a._etapaProjeto+')':''));
   if (a._melhNome)     ctxLines.push('Melhoria: '+a._melhNome);
   var titleAttr=(a.titulo||'')+(ctxLines.length?'\n'+ctxLines.join('\n'):'');
   html += '<div onclick="_gestorRowClick(\''+a.id+'\')" title="'+titleAttr.replace(/"/g,'&quot;')+'"'
    +' style="position:absolute;left:calc('+pL+'% + 2px);width:calc('+pW+'% - 4px);top:'+topY+'px;height:'+BAR_H+'px;'
    +'background:'+c.bg+';border:1px solid '+c.bdr+';border-left:3px solid '+c.bdr+';border-radius:'+blR+' '+brR+' '+brR+' '+blR+';'
    +'display:flex;align-items:center;padding:0 6px;cursor:pointer;pointer-events:all;overflow:hidden;'
    +'font-size:10px;font-weight:700;color:'+c.tx+';white-space:nowrap;'
    +'opacity:'+(done?'.75':'1')+';text-decoration:'+(done?'line-through':'none')+';'
    +'transition:filter .12s;box-shadow:0 1px 2px rgba(0,0,0,.18)" '
    +'onmouseover="this.style.filter=\'brightness(1.18)\'" onmouseout="this.style.filter=\'\'">'
    +barText+'</div>';
  });

  // Botão expand / recolher
  var btnTop = visLanes*(BAR_H+BAR_GAP)+2;
  if (hasOver) {
   html += '<div onclick="_gestorToggleWeek(\''+weekKey+'\')" style="'
    +'position:absolute;left:4px;top:'+btnTop+'px;'
    +'display:inline-flex;align-items:center;gap:4px;'
    +'background:var(--surface2);border:1px solid var(--border);border-radius:10px;'
    +'padding:1px 9px 1px 6px;cursor:pointer;pointer-events:all;'
    +'font-size:10px;font-weight:700;color:var(--navy);'
    +'transition:background .12s" '
    +'onmouseover="this.style.background=\'var(--border)\'" onmouseout="this.style.background=\'var(--surface2)\'">'
    +'<span style="font-size:12px;line-height:1">&#9660;</span> '
    +'+'+hiddenTasks+' tarefa'+(hiddenTasks>1?'s':'')+' oculta'+(hiddenTasks>1?'s':'')+' — expandir'
    +'</div>';
  } else if (isExpanded && totalLanes > LANES_DEFAULT) {
   html += '<div onclick="_gestorToggleWeek(\''+weekKey+'\')" style="'
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

function _gestorRenderTimeline() {
 var wrap = document.getElementById('gestor-timeline-content');
 if (!wrap) return;
 var mFull = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
 var preset = _gestorPeriodo.preset || 'mes';
 var anchor = _gestorTimelineAnchor;

 var tRanges = _gestorFiltered
  .filter(function(a){ return a.data_inicio || a.data_prazo; })
  .map(function(a){
   var s = a.data_inicio ? new Date(a.data_inicio+'T00:00:00') : new Date(a.data_prazo+'T00:00:00');
   var e = a.data_prazo  ? new Date(a.data_prazo +'T00:00:00') : new Date(a.data_inicio+'T00:00:00');
   if (+e < +s) e = new Date(+s);
   return { a:a, s:s, e:e };
  })
  .sort(function(x,y){ return +x.s - +y.s || +x.e - +y.e; });
 var tSemData = _gestorFiltered.filter(function(a){ return !a.data_inicio && !a.data_prazo; });

 // Paleta semantica unica (alinhada ao Painel de Metricas v2.54):
 //  verde=concluido, azul=em andamento, ambar=bloqueado/atencao, vermelho=atrasado (excecao),
 //  prioridade Alta=vermelho, Media=ambar, Baixa/A fazer=cinza.
 // Cores com opacidade/contraste reforcados para leitura imediata sobre o tema escuro.
 // No tema claro os mesmos tons pastel (tx) ficam ilegíveis sobre o fundo
 // claro (baixíssimo contraste) — nesse tema o texto usa a cor de borda
 // (bdr), que já é sólida/escura o bastante pra ler nos dois temas (é a
 // mesma paleta usada como cor cheia em outros lugares do sistema, ex.
 // _SETOR_CORES).
 var _tLight = document.body.classList.contains('light');
 function tColor(a) {
  var late = _gIsLate(a), s = a.status||'', p = a.prioridade||'';
  var c;
  if (late)  c = { bg:'rgba(239,68,68,.22)',  tx:'#fca5a5', bdr:'#D6433C' };
  else if (_gIsDone(s)) c = { bg:'rgba(34,197,94,.20)', tx:'#86efac', bdr:'#1F8A4C' };
  else if (s==='Em progresso'||s==='Em andamento') c = { bg:'rgba(59,130,246,.22)', tx:'#93c5fd', bdr:'#2E5FD9' };
  else if (s==='Bloqueado'||s==='Bloqueada'||s==='Impedida'||s==='Aguardando feedback') c = { bg:'rgba(245,158,11,.22)', tx:'#fcd34d', bdr:'#B8790A' };
  else if (p==='Alta')  c = { bg:'rgba(239,68,68,.14)', tx:'#fca5a5', bdr:'#D6433C' };
  else if (p==='Média'||p==='Media') c = { bg:'rgba(245,158,11,.14)', tx:'#fcd34d', bdr:'#B8790A' };
  else c = { bg:'rgba(148,163,184,.16)', tx:'#cbd5e1', bdr:'#7D8199' };
  if (_tLight) c = { bg: c.bg, tx: c.bdr, bdr: c.bdr };
  return c;
 }

 var fmtCurto = function(d){ return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}); };
 var fmtAno   = function(d){ return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'}); };
 var periodLbl = '', bodyHtml = '';

 if (preset === 'semana') {
  var r = _gestorWeekRangeFrom(anchor);
  var days = []; for (var i=0;i<7;i++){ var d=new Date(r.ini); d.setDate(r.ini.getDate()+i); days.push(d); }
  periodLbl = fmtCurto(r.ini) + ' – ' + fmtAno(r.fim);
  bodyHtml = _gestorBuildCalGrid(days, tRanges, tColor, function(){ return false; });

 } else if (preset === 'prox2') {
  var r0 = _gestorWeekRangeFrom(anchor);
  var days = []; for (var i=0;i<14;i++){ var d=new Date(r0.ini); d.setDate(r0.ini.getDate()+i); days.push(d); }
  periodLbl = fmtCurto(days[0]) + ' – ' + fmtAno(days[13]);
  bodyHtml = _gestorBuildCalGrid(days, tRanges, tColor, function(){ return false; });

 } else if (preset === 'trim') {
  // 3 meses a partir do mes-base, lado a lado com rolagem horizontal
  var labels = [];
  bodyHtml = '<div style="display:flex;height:100%;overflow-x:auto">';
  for (var m=0; m<3; m++) {
   var vy=anchor.getFullYear(), vm=anchor.getMonth()+m;
   while (vm>11){ vm-=12; vy++; }
   labels.push(mFull[vm]+' '+vy);
   var days = _gestorMonthDays(vy, vm);
   bodyHtml += '<div style="min-width:380px;flex:1 0 380px;border-right:1px solid var(--border);display:flex;flex-direction:column">'
    + '<div style="padding:6px 10px;font-size:12px;font-weight:800;color:var(--text);background:var(--surface2);border-bottom:1px solid var(--border);flex-shrink:0">'+mFull[vm]+' '+vy+'</div>'
    + '<div style="flex:1;overflow-y:auto;overflow-x:hidden">'+_gestorBuildCalGrid(days, tRanges, tColor, function(d){ return d.getMonth()!==vm; })+'</div>'
    + '</div>';
  }
  bodyHtml += '</div>';
  periodLbl = labels.join(' · ');

 } else if (preset === 'custom' && _gestorPeriodo.ini && _gestorPeriodo.fim) {
  var ini=_gestorPeriodo.ini, fim=_gestorPeriodo.fim;
  var totalDays = Math.round((fim-ini)/86400000)+1;
  var rows = Math.ceil(totalDays/7);
  var days = []; for (var i=0;i<rows*7;i++){ var d=new Date(ini); d.setDate(ini.getDate()+i); days.push(d); }
  periodLbl = fmtCurto(ini) + ' – ' + fmtAno(fim);
  bodyHtml = '<div style="flex:1;overflow-y:auto;overflow-x:hidden">'+_gestorBuildCalGrid(days, tRanges, tColor, function(d){ return +d < +ini || +d > +fim; })+'</div>';

 } else {
  // 'mes' ou 'todas' (sem intervalo definido) — exibe o mes da data-base
  var vy=anchor.getFullYear(), vm=anchor.getMonth();
  periodLbl = mFull[vm]+' '+vy;
  var days = _gestorMonthDays(vy, vm);
  bodyHtml = '<div style="flex:1;overflow-y:auto;overflow-x:hidden">'+_gestorBuildCalGrid(days, tRanges, tColor, function(d){ return d.getMonth()!==vm; })+'</div>';
 }

 var btnSt = 'background:none;border:1px solid var(--border);border-radius:6px;cursor:pointer;font-family:inherit;color:var(--text)';
 var html = '<div style="display:flex;flex-direction:column;height:100%;overflow:hidden">'
  + '<div style="display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:1px solid var(--border);background:var(--surface);flex-shrink:0;flex-wrap:wrap">'
  + '<button style="'+btnSt+';padding:3px 12px;font-size:18px;line-height:1" onclick="_gestorCalPrev()">&#8249;</button>'
  + '<button style="'+btnSt+';padding:3px 12px;font-size:18px;line-height:1" onclick="_gestorCalNext()">&#8250;</button>'
  + '<span style="font-size:13px;font-weight:800;color:var(--text)">'+periodLbl+'</span>'
  + '<button style="'+btnSt+';padding:4px 12px;font-size:12px" onclick="_gestorCalToday()">Hoje</button>'
  + '<span style="font-size:10px;color:var(--muted);margin-left:4px">'+tRanges.length+' atividades'+(tSemData.length?' &middot; '+tSemData.length+' sem data':'')+'</span>'
  + '<div style="margin-left:auto;display:flex;gap:8px;align-items:center;font-size:10px;flex-wrap:wrap">'
  + [['Concluido','#1F8A4C'],['Em andamento','#2E5FD9'],['A fazer','#7D8199'],['Bloqueado','#B8790A'],['Atrasado','#D6433C']].map(function(l){
    return '<span style="display:flex;align-items:center;gap:3px"><span style="width:10px;height:10px;border-radius:2px;background:'+l[1]+';opacity:.25;border:1px solid '+l[1]+';flex-shrink:0;display:inline-block"></span><span style="color:var(--muted)">'+l[0]+'</span></span>';
   }).join('')
  + '</div></div>'
  + bodyHtml;

 if (tSemData.length) {
  html += '<div style="border-top:1px solid var(--border);padding:8px 14px;background:var(--surface2);flex-shrink:0">'
   + '<div style="font-size:10px;font-weight:700;color:var(--muted);margin-bottom:5px">SEM DATA ('+tSemData.length+')</div>'
   + '<div style="display:flex;flex-wrap:wrap;gap:5px">'
   + tSemData.map(function(a){var c=tColor(a);return '<span onclick="_gestorRowClick(\''+a.id+'\')" style="cursor:pointer;font-size:10px;padding:2px 8px;background:'+c.bg+';border:1px solid '+c.bdr+';border-radius:10px;color:'+c.tx+'">'+(a.titulo||'--')+'</span>';}).join('')
   + '</div></div>';
 }
 html += '</div>';
 wrap.innerHTML = html;
}

function _gestorSvgEsc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// _gestorTimelineTip/_gestorTimelineTipHide removidas (limpeza técnica):
// nenhuma barra do Timeline tinha onmouseover/onmouseout chamando essas
// funções (confirmado — as barras usam só o atributo title nativo do
// navegador pra mostrar informação ao passar o mouse, já funcionando).

// ══════════════════════════════════════════════════════════════════════════
// MÉTRICAS
// ══════════════════════════════════════════════════════════════════════════
function _gestorRenderMetricas() {
 var wrap = document.getElementById('gestor-metricas-content');
 if (!wrap) return;
 var data = _gestorFiltered;
 if (!data.length) { wrap.innerHTML = '<div style="padding:60px;text-align:center;color:var(--muted);font-size:13px">Nenhuma atividade no período selecionado.</div>'; return; }


 var hoje = new Date(); hoje.setHours(0,0,0,0);
 var total   = data.length;
 var done    = data.filter(function(a){ return _gIsDone(a.status); }).length;
 var late    = data.filter(function(a){ return _gIsLate(a); }).length;
 var inProg  = data.filter(function(a){ return (a.status==='Em progresso'||a.status==='Em andamento') && !_gIsDone(a.status); }).length;
 var afazer  = data.filter(function(a){ return !_gIsDone(a.status)&&!_gIsLate(a)&&a.status!=='Em progresso'&&a.status!=='Em andamento'&&a.status!=='Bloqueado'&&a.status!=='Impedida'; }).length;
 var bloq    = data.filter(function(a){ return a.status==='Bloqueado'||a.status==='Impedida'; }).length;
 var semResp = data.filter(function(a){ return !a.responsavel&&!_gIsDone(a.status); }).length;
 var txConcl = total>0?Math.round(done*100/total):0;
 var txAtraso= total>0?Math.round(late*100/total):0;

 // Produtividade
 var criadas30=data.filter(function(a){ var cr=a.created_at; if(!cr)return false; return Math.floor((hoje-new Date(cr))/86400000)<=30; }).length;

 // Performance: tempo medio conclusao
 var tempoConclArr=data.filter(function(a){ return _gIsDone(a.status)&&a.created_at&&a.updated_at; })
  .map(function(a){ return Math.max(0,Math.floor((new Date(a.updated_at)-new Date(a.created_at))/86400000)); });
 var tempoMedioConcl=tempoConclArr.length>0?Math.round(tempoConclArr.reduce(function(s,v){return s+v;},0)/tempoConclArr.length):null;

 // Atraso medio
 var atrasoDiasArr=data.filter(function(a){return _gIsLate(a);}).map(function(a){return Math.floor((hoje-new Date(a.data_prazo+'T00:00:00'))/86400000);});
 var atrasoMedio=atrasoDiasArr.length>0?Math.round(atrasoDiasArr.reduce(function(s,v){return s+v;},0)/atrasoDiasArr.length):0;

 // Proximas do vencimento <=7 dias
 var prox7=data.filter(function(a){ if(_gIsDone(a.status)||!a.data_prazo)return false; var diff=Math.floor((new Date(a.data_prazo+'T00:00:00')-hoje)/86400000); return diff>=0&&diff<=7; });

 // Estagnadas 30d+
 var estagnadas=data.filter(function(a){ if(_gIsDone(a.status))return false; var upd=a.updated_at||a.created_at; if(!upd)return false; return Math.floor((hoje-new Date(upd))/86400000)>=30; });

 // Area map
 var areaMap={};
 data.forEach(function(a){
  var k=a.area||'Sem area';
  if(!areaMap[k])areaMap[k]={total:0,done:0,late:0,prog:0};
  areaMap[k].total++;
  if(_gIsDone(a.status))areaMap[k].done++;
  if(_gIsLate(a))areaMap[k].late++;
  if(a.status==='Em progresso'||a.status==='Em andamento')areaMap[k].prog++;
 });
 var topAreas=Object.keys(areaMap).sort(function(a,b){return areaMap[b].total-areaMap[a].total;}).slice(0,8);
 var maxArea=topAreas.length?Math.max.apply(null,topAreas.map(function(k){return areaMap[k].total;})):1;
 var gargAreas=Object.keys(areaMap).filter(function(k){return areaMap[k].late>0;}).sort(function(a,b){return areaMap[b].late-areaMap[a].late;}).slice(0,6);
 var maxGarg=gargAreas.length?Math.max.apply(null,gargAreas.map(function(k){return areaMap[k].late;})):1;

 // User map
 var userMap={};
 data.forEach(function(a){
  var rs=(a.responsavel||'').split(/[,;]+/).map(function(r){return r.trim();}).filter(Boolean);
  if(!rs.length)rs=['Sem responsavel'];
  rs.forEach(function(r){ if(!userMap[r])userMap[r]={total:0,done:0,late:0,prog:0}; userMap[r].total++; if(_gIsDone(a.status))userMap[r].done++; else if(_gIsLate(a))userMap[r].late++; else if(a.status==='Em progresso'||a.status==='Em andamento')userMap[r].prog++; });
 });
 var topUsers=Object.keys(userMap).sort(function(a,b){return userMap[b].total-userMap[a].total;}).slice(0,8);
 var avColors=['#004AE8','#1F8A4C','#e07b00','#8B6FE8','#1f7ec4','#c44b1f','#cf222e','#6366f1'];

 // Tipo map
 var tipoMap={};
 data.forEach(function(a){ var k=a.tipo_atividade||'Sem tipo'; if(!tipoMap[k])tipoMap[k]={total:0,done:0}; tipoMap[k].total++; if(_gIsDone(a.status))tipoMap[k].done++; });
 var topTipos=Object.keys(tipoMap).sort(function(a,b){return tipoMap[b].total-tipoMap[a].total;}).slice(0,6);
 var maxTipo=topTipos.length?Math.max.apply(null,topTipos.map(function(k){return tipoMap[k].total;})):1;

 // Prioridade map
 var prioMap={'Alta':0,'Media':0,'Baixa':0,'Sem':0};
 data.forEach(function(a){ var p=a.prioridade||''; if(p==='Alta')prioMap.Alta++; else if(p==='Media'||p==='Média')prioMap.Media++; else if(p==='Baixa')prioMap.Baixa++; else prioMap.Sem++; });
 var maxPrio=Math.max.apply(null,[prioMap.Alta,prioMap.Media,prioMap.Baixa,prioMap.Sem]);

 // Top 5 mais atrasadas
 var topAtrasadas=data.filter(function(a){return _gIsLate(a);}).map(function(a){ return {a:a,dias:Math.floor((hoje-new Date(a.data_prazo+'T00:00:00'))/86400000)}; }).sort(function(x,y){return y.dias-x.dias;}).slice(0,5);

 // ==========================================================================
 // HELPERS
 // ==========================================================================
 var CARD='background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:16px';
 function card(content,extra){ return '<div style="'+CARD+';'+(extra||'')+'">'+content+'</div>'; }
 function secHdr(lbl,clr){ clr=clr||'var(--navy)'; return '<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:var(--muted);margin-bottom:14px;display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:3px;height:12px;background:'+clr+';border-radius:2px;flex-shrink:0"></span>'+lbl+'</div>'; }
 function hBar(val,mx,clr){ var pct=mx>0?Math.min(100,Math.round(val*100/mx)):0; return '<div style="flex:1;background:var(--border);border-radius:3px;height:8px;overflow:hidden"><div style="width:'+pct+'%;height:100%;background:'+clr+';border-radius:3px;transition:width .4s"></div></div>'; }
 function svgDonut(slices,cx,cy,r,stroke){
  var tot=slices.reduce(function(s,x){return s+x.v;},0);
  if(!tot) return '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="var(--border)" stroke-width="'+stroke+'"/>';
  var paths='',angle=-Math.PI/2;
  slices.forEach(function(sl){ if(!sl.v)return; var sw=(sl.v/tot)*2*Math.PI,x1=cx+r*Math.cos(angle),y1=cy+r*Math.sin(angle),x2=cx+r*Math.cos(angle+sw),y2=cy+r*Math.sin(angle+sw),lg=sw>Math.PI?1:0; paths+='<path d="M '+cx+' '+cy+' L '+x1.toFixed(1)+' '+y1.toFixed(1)+' A '+r+' '+r+' 0 '+lg+' 1 '+x2.toFixed(1)+' '+y2.toFixed(1)+' Z" fill="'+sl.c+'" opacity=".9"/>'; angle+=sw; });
  return paths+'<circle cx="'+cx+'" cy="'+cy+'" r="'+(r-stroke)+'" fill="var(--surface)"/>';
 }
 // miniArc removida (limpeza técnica): helper local sem nenhum caller dentro
 // desta função — svgDonut cobre os gráficos de anel realmente usados aqui.

 // ==========================================================================
 // RENDER
 // ==========================================================================
 var s='<div style="display:flex;flex-direction:column;gap:16px;padding:16px 18px 28px">';

 // ==========================================================================
 // PALETA SEMANTICA UNICA (alinhada a Timeline v2.52):
 //  verde   #1F8A4C = concluido / positivo
 //  azul    #2E5FD9 = em andamento
 //  cinza   #7D8199 = neutro / a fazer / sem dado
 //  vermelho#D6433C = atraso / critico (excecao)
 //  ambar   #B8790A = bloqueio / atencao (excecao)
 //  navy    #0183FF = marca / indicador neutro principal
 // Cor so e usada para sinalizar status, prioridade ou excecao — nunca decorativa.
 // ==========================================================================
 var COL = {ok:'#1F8A4C', prog:'#2E5FD9', neutral:'#7D8199', crit:'#D6433C', warn:'#B8790A', brand:'#0183FF'};

 // ── NIVEL 1 — KPIs ESTRATEGICOS ──────────────────────────────────────────
 // Origem: _gestorFiltered (mesma base da grade/listagem). Recalculado a cada filtro.
 // Total = data.length | Conclusao% = done/total | Atraso = late (count + %) | Sem Responsavel = contagem direta
 function kpiBox(label, value, sub, color, alert){
  return '<div style="background:var(--surface);border:1px solid var(--border);border-left:3px solid '+(alert?color:'var(--border)')+';border-radius:8px;padding:14px 16px">'
   +'<div style="font-size:9px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px">'+label+'</div>'
   +'<div style="font-size:30px;font-weight:900;color:'+(alert?color:'var(--text)')+';line-height:1;margin-bottom:4px">'+value+'</div>'
   +'<div style="font-size:10px;color:var(--muted)">'+sub+'</div>'
   +'</div>';
 }
 s+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">'
  +kpiBox('Total de Atividades', total, 'no filtro aplicado', COL.brand, false)
  +kpiBox('Taxa de Conclusao', txConcl+'%', done+' de '+total+' concluidas', COL.ok, false)
  +kpiBox('Em Atraso', late, late>0?(txAtraso+'% do total — requer atencao'):'nenhuma atividade atrasada', COL.crit, late>0)
  +kpiBox('Sem Responsavel', semResp, semResp>0?'pendente de atribuicao':'todas atribuidas', COL.warn, semResp>0)
 +'</div>';

 // Faixa de indicadores taticos/operacionais — leitura rapida, sem cor decorativa
 s+='<div style="display:flex;flex-wrap:wrap;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 16px">'
  +[
   {l:'Em Andamento', v:inProg},
   {l:'Bloqueadas', v:bloq},
   {l:'A Fazer', v:afazer},
   {l:'Criadas (30d)', v:criadas30},
   {l:'Tempo Medio Conclusao', v:(tempoMedioConcl!==null?tempoMedioConcl+'d':'—')},
   {l:'Atraso Medio', v:(atrasoMedio>0?atrasoMedio+'d':'—')},
   {l:'Vencem em 7 Dias', v:prox7.length},
   {l:'Estagnadas 30d+', v:estagnadas.length}
  ].map(function(it,i){
   return '<div style="flex:1;min-width:110px;padding:4px 14px;'+(i>0?'border-left:1px solid var(--border)':'')+'">'
    +'<div style="font-size:17px;font-weight:800;color:var(--text)">'+it.v+'</div>'
    +'<div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-top:2px">'+it.l+'</div>'
    +'</div>';
  }).join('')
 +'</div>';

 // ── NIVEL 2 — PANORAMA TATICO (status / area / responsavel) ─────────────
 // Origem: data (= _gestorFiltered). Mesmas contagens dos KPIs acima, agrupadas por dimensao.
 s+='<div style="display:grid;grid-template-columns:220px 1fr 1fr;gap:12px">';

 // Donut status — paleta semantica: verde=concluido, azul=andamento, cinza=a fazer, ambar=bloqueado, vermelho=atrasado
 var stSl=[{v:done,c:COL.ok,l:'Concluidas'},{v:inProg,c:COL.prog,l:'Em Andamento'},{v:afazer,c:COL.neutral,l:'A Fazer'},{v:bloq,c:COL.warn,l:'Bloqueadas'},{v:late,c:COL.crit,l:'Atrasadas'}].filter(function(x){return x.v>0;});
 var dSvg='<svg width="108" height="108" viewBox="0 0 108 108">'+svgDonut(stSl,54,54,43,18)+'<text x="54" y="50" text-anchor="middle" font-size="19" font-weight="900" fill="var(--text)">'+txConcl+'%</text><text x="54" y="63" text-anchor="middle" font-size="9" fill="var(--muted)">concluido</text></svg>';
 s+=card(secHdr('Status das Atividades')
  +'<div style="display:flex;align-items:center;gap:10px">'+dSvg
  +'<div style="display:flex;flex-direction:column;gap:5px;flex:1">'
  +stSl.map(function(sl){return '<div style="display:flex;align-items:center;gap:5px;font-size:10px"><span style="width:8px;height:8px;border-radius:2px;background:'+sl.c+';flex-shrink:0"></span><span style="flex:1;color:var(--muted)">'+sl.l+'</span><b style="color:var(--text)">'+sl.v+'</b></div>';}).join('')
  +'</div></div>');

 // Distribuicao por area — barra unica navy (volume); atraso destacado em vermelho apenas quando existe (excecao)
 var aRows=topAreas.slice(0,6).map(function(k){
  var ad=areaMap[k];
  return '<div style="margin-bottom:8px">'
   +'<div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:3px">'
   +'<span style="color:var(--text);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px" title="'+k+'">'+k+'</span>'
   +'<span style="display:flex;gap:6px;flex-shrink:0">'+(ad.late?'<span style="color:'+COL.crit+';font-weight:700">'+ad.late+' atrasada'+(ad.late>1?'s':'')+'</span>':'')+'<span style="color:var(--muted)">'+ad.total+' total</span></span></div>'
   +hBar(ad.total,maxArea,COL.brand)+'</div>';
 }).join('');
 s+=card(secHdr('Distribuicao por Area')+(aRows||'<div style="font-size:10px;color:var(--muted)">Sem dados</div>'));

 // Carga por responsavel — barra unica navy (volume); atraso destacado em vermelho apenas quando existe
 var maxUserTotal=topUsers.length?Math.max.apply(null,topUsers.map(function(x){return userMap[x].total;})):1;
 var uRows=topUsers.slice(0,6).map(function(u){
  var ud=userMap[u];
  var nm=u==='Sem responsavel'?'Sem responsavel':(u.split('@')[0].replace(/\./g,' ').split(' ').map(function(w){return w.charAt(0).toUpperCase()+w.slice(1);}).join(' '));
  return '<div style="margin-bottom:8px">'
   +'<div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:3px">'
   +'<span style="color:var(--text);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px" title="'+u+'">'+nm+'</span>'
   +'<span style="display:flex;gap:6px;flex-shrink:0">'+(ud.late?'<span style="color:'+COL.crit+';font-weight:700">'+ud.late+' atrasada'+(ud.late>1?'s':'')+'</span>':'')+'<span style="color:var(--muted)">'+ud.total+' total</span></span></div>'
   +hBar(ud.total,maxUserTotal,COL.brand)+'</div>';
 }).join('');
 s+=card(secHdr('Carga por Responsavel')+(uRows||'<div style="font-size:10px;color:var(--muted)">Sem dados</div>'));

 s+='</div>'; // grid 3 cols (nivel 2)

 // ── NIVEL 3 — ACOES REQUERIDAS (operacional / excecoes) ──────────────────
 // Origem: data (= _gestorFiltered). Vermelho = atraso, ambar = atencao/pendencia, verde = "tudo ok".
 s+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">';

 var atrasHtml='';
 if(topAtrasadas.length){
  atrasHtml=topAtrasadas.map(function(item){
   var a=item.a;
   var resp=(a.responsavel||'').split(/[,;]+/)[0].trim().split('@')[0].split('.')[0];
   resp=resp?resp.charAt(0).toUpperCase()+resp.slice(1):'Sem resp.';
   var dp=new Date(a.data_prazo+'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});
   var ctx=[a._obraNome,a._projNome].filter(Boolean).join(' / ');
   return '<div onclick="_gestorRowClick(\''+a.id+'\')" style="padding:7px 10px;border-left:3px solid '+COL.crit+';background:var(--surface2);border-radius:0 6px 6px 0;cursor:pointer;margin-bottom:5px">'
    +'<div style="font-size:11px;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+(a.titulo||'')+'">'+(a.titulo||'&mdash;')+'</div>'
    +'<div style="font-size:10px;color:var(--muted)">'+resp+' &middot; '+dp+(ctx?' &middot; '+ctx:'')+' &middot; <span style="color:'+COL.crit+';font-weight:700">'+item.dias+'d atraso</span></div>'
    +'</div>';
  }).join('');
 } else {
  atrasHtml='<div style="text-align:center;padding:18px 0;color:'+COL.ok+';font-size:11px;font-weight:700">Nenhuma atividade atrasada</div>';
 }
 s+=card(secHdr('Atrasadas — Top 5',COL.crit)+atrasHtml);

 var prox7Html='';
 if(prox7.length){
  prox7Html=prox7.slice(0,5).map(function(a){
   var diff=Math.floor((new Date(a.data_prazo+'T00:00:00')-hoje)/86400000);
   var clr=diff<=3?COL.crit:COL.warn;
   var dp=new Date(a.data_prazo+'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});
   return '<div onclick="_gestorRowClick(\''+a.id+'\')" style="padding:7px 10px;border-left:3px solid '+clr+';background:var(--surface2);border-radius:0 6px 6px 0;cursor:pointer;margin-bottom:5px">'
    +'<div style="font-size:11px;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+(a.titulo||'')+'">'+(a.titulo||'&mdash;')+'</div>'
    +'<div style="font-size:10px;color:var(--muted)">'+dp+' &middot; <span style="color:'+clr+';font-weight:700">'+(diff===0?'vence hoje':'em '+diff+'d')+'</span></div>'
    +'</div>';
  }).join('')+(prox7.length>5?'<div style="font-size:10px;color:var(--muted);padding:2px 0">+ '+(prox7.length-5)+' mais</div>':'');
 } else {
  prox7Html='<div style="text-align:center;padding:18px 0;color:'+COL.ok+';font-size:11px;font-weight:700">Nenhum vencimento proximo</div>';
 }
 s+=card(secHdr('Vencem em 7 Dias',COL.warn)+prox7Html);

 var srHtml='';
 if(semResp>0){
  var srList=data.filter(function(a){return !a.responsavel&&!_gIsDone(a.status);}).slice(0,3);
  srHtml+='<div style="font-size:9px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin:4px 0 4px">Sem Responsavel ('+semResp+')</div>'
   +srList.map(function(a){return '<div style="font-size:10px;color:var(--text);padding:4px 8px;background:var(--surface2);border-left:3px solid '+COL.warn+';border-radius:0 4px 4px 0;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(a.titulo||'&mdash;')+'</div>';}).join('')
   +(semResp>3?'<div style="font-size:10px;color:var(--muted);padding:2px 8px">+ '+(semResp-3)+' mais</div>':'');
 }
 if(estagnadas.length>0){
  srHtml+='<div style="font-size:9px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin:8px 0 4px">Estagnadas 30d+ ('+estagnadas.length+')</div>'
   +estagnadas.slice(0,3).map(function(a){var upd=a.updated_at||a.created_at;var dias=Math.floor((hoje-new Date(upd))/86400000);return '<div style="font-size:10px;padding:4px 8px;background:var(--surface2);border-left:3px solid '+COL.neutral+';border-radius:0 4px 4px 0;margin-bottom:3px;display:flex;justify-content:space-between"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)">'+(a.titulo||'&mdash;')+'</span><span style="flex-shrink:0;color:var(--muted);font-weight:700;margin-left:8px">'+dias+'d</span></div>';}).join('')
   +(estagnadas.length>3?'<div style="font-size:10px;color:var(--muted);padding:2px 8px">+ '+(estagnadas.length-3)+' mais</div>':'');
 }
 if(!srHtml) srHtml='<div style="text-align:center;padding:18px 0;color:'+COL.ok+';font-size:11px;font-weight:700">Nenhuma pendencia</div>';
 s+=card(secHdr('Pendencias de Gestao',COL.warn)+srHtml);

 s+='</div>'; // grid 3 cols (nivel 3)

 // ========================================================================
 // 6. GRÁFICOS DE LINHA — Evolução Temporal
 // ========================================================================
 // Helper: SVG line chart profissional
 function svgLineChart(series, labels, opts) {
  var W=opts.w||320, H=opts.h||110;
  var PL=opts.pl||32, PR=8, PT=10, PB=28;
  var cW=W-PL-PR, cH=H-PT-PB;
  var n=labels.length;
  if(n<2) return '<div style="font-size:10px;color:var(--muted);padding:20px;text-align:center">Dados insuficientes para exibir grafico</div>';
  var allVals=series.reduce(function(all,s){return all.concat(s.values);},[]);
  var maxVal=Math.max.apply(null,allVals)||1;
  function px(i){return PL+i*(cW/(n-1));}
  function py(v){return PT+cH-(v/maxVal*cH);}
  var svg='<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto;display:block" xmlns="http://www.w3.org/2000/svg">';
  // Fundo
  svg+='<rect x="'+PL+'" y="'+PT+'" width="'+cW+'" height="'+cH+'" fill="none"/>';
  // Grid horizontal
  var nGrid=4;
  for(var gi=0;gi<=nGrid;gi++){
   var gv=maxVal*gi/nGrid, gy=py(gv);
   svg+='<line x1="'+PL+'" y1="'+gy.toFixed(1)+'" x2="'+(W-PR)+'" y2="'+gy.toFixed(1)+'" stroke="var(--border)" stroke-width="1"/>';
   if(gi>0) svg+='<text x="'+(PL-4)+'" y="'+(gy+3.5).toFixed(1)+'" text-anchor="end" font-size="8" fill="var(--muted)">'+Math.round(gv)+'</text>';
  }
  // Eixo X baseline
  svg+='<line x1="'+PL+'" y1="'+(PT+cH)+'" x2="'+(W-PR)+'" y2="'+(PT+cH)+'" stroke="var(--border)" stroke-width="1"/>';
  // Labels eixo X (max 7)
  var step=Math.max(1,Math.ceil(n/7));
  labels.forEach(function(lb,i){
   if(i%step!==0&&i!==n-1)return;
   svg+='<text x="'+px(i).toFixed(1)+'" y="'+(H-5)+'" text-anchor="middle" font-size="8" fill="var(--muted)">'+lb+'</text>';
  });
  // Séries
  series.forEach(function(ser){
   if(!ser.values||!ser.values.length)return;
   var pts=ser.values.map(function(v,i){return [px(i),py(v)];});
   // Área fill com gradiente suave
   var aPath='M '+pts[0][0].toFixed(1)+' '+(PT+cH)+' ';
   pts.forEach(function(p){aPath+='L '+p[0].toFixed(1)+' '+p[1].toFixed(1)+' ';});
   aPath+='L '+pts[pts.length-1][0].toFixed(1)+' '+(PT+cH)+' Z';
   svg+='<path d="'+aPath+'" fill="'+ser.color+'" opacity=".07"/>';
   // Linha principal
   var lPath='M '+pts.map(function(p){return p[0].toFixed(1)+' '+p[1].toFixed(1);}).join(' L ');
   svg+='<path d="'+lPath+'" fill="none" stroke="'+ser.color+'" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>';
   // Pontos — só se poucos dados ou no último
   var dotStep=n>14?Math.ceil(n/10):1;
   pts.forEach(function(p,i){
    if(i%dotStep!==0&&i!==n-1)return;
    svg+='<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="2.5" fill="var(--surface)" stroke="'+ser.color+'" stroke-width="1.5"/>';
   });
  });
  svg+='</svg>';
  return svg;
 }

 // Dados: últimos 30 dias — usa `data` (= _gestorFiltered) para respeitar TODOS os filtros ativos
 // (correção de integridade: anteriormente usava _gestorAllAt, ignorando filtros)
 var allTasks = data;
 var dias30lbl=[], criadasD=[], conclD=[];
 for(var dd=29;dd>=0;dd--){
  var dt=new Date(hoje.getTime()-dd*86400000);
  var dtStr=dt.toISOString().slice(0,10);
  var dayLb=(dd===0?'Hoje':dt.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}));
  dias30lbl.push(dayLb);
  criadasD.push(allTasks.filter(function(a){return a.created_at&&a.created_at.slice(0,10)===dtStr;}).length);
  conclD.push(allTasks.filter(function(a){return _gIsDone(a.status)&&a.updated_at&&a.updated_at.slice(0,10)===dtStr;}).length);
 }

 // Dados: próximas 8 semanas (distribuição de prazos)
 var semLbl=[], semTotal=[], semLate=[];
 for(var sw=0;sw<8;sw++){
  var sIni=new Date(hoje.getTime()+sw*7*86400000);
  var sFim=new Date(hoje.getTime()+(sw+1)*7*86400000-1);
  var sLb=sIni.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
  semLbl.push(sLb);
  var sTotal=data.filter(function(a){
   if(!a.data_prazo)return false;
   var dp=new Date(a.data_prazo+'T00:00:00');
   return dp>=sIni&&dp<=sFim;
  }).length;
  var sLate=data.filter(function(a){
   if(!a.data_prazo)return false;
   var dp=new Date(a.data_prazo+'T00:00:00');
   return dp>=sIni&&dp<=sFim&&_gIsLate(a);
  }).length;
  semTotal.push(sTotal);
  semLate.push(sLate);
 }

 // ── EVOLUCAO TEMPORAL (2 graficos — terceiro grafico "Carga por Area" removido por redundancia
 //    com o card "Distribuicao por Area" do nivel 2) ────────────────────────
 s+='<div style="border-top:1px solid var(--border);margin:4px 0 2px"></div>';
 s+='<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);padding:4px 0 8px;display:flex;align-items:center;gap:8px">'
  +'<span style="display:inline-block;width:3px;height:14px;background:'+COL.brand+';border-radius:2px"></span>'
  +'EVOLUCAO TEMPORAL</div>';

 s+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';

 // Chart 1: Criadas vs Concluídas (30d) — base: data (filtrado)
 var ch1Total=criadasD.reduce(function(a,b){return a+b;},0)+conclD.reduce(function(a,b){return a+b;},0);
 s+=card(
  secHdr('Criadas vs Concluidas — 30 Dias')
  +'<div style="display:flex;gap:12px;align-items:center;margin-bottom:10px">'
  +'<div><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">Criadas</div>'
  +'<div style="font-size:20px;font-weight:900;color:'+COL.brand+'">'+criadasD.reduce(function(a,b){return a+b;},0)+'</div></div>'
  +'<div><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">Concluidas</div>'
  +'<div style="font-size:20px;font-weight:900;color:'+COL.ok+'">'+conclD.reduce(function(a,b){return a+b;},0)+'</div></div>'
  +'</div>'
  +(ch1Total>0
   ?svgLineChart([{label:'Criadas',color:COL.brand,values:criadasD},{label:'Concluidas',color:COL.ok,values:conclD}],dias30lbl,{w:480,h:110,pl:28})
   :'<div style="font-size:10px;color:var(--muted);text-align:center;padding:20px">Sem dados no periodo</div>'
  )
  +'<div style="display:flex;gap:12px;margin-top:8px;font-size:10px">'
  +'<span style="display:flex;align-items:center;gap:4px"><span style="width:12px;height:2px;background:'+COL.brand+';display:inline-block;border-radius:1px"></span>Criadas</span>'
  +'<span style="display:flex;align-items:center;gap:4px"><span style="width:12px;height:2px;background:'+COL.ok+';display:inline-block;border-radius:1px"></span>Concluidas</span>'
  +'</div>'
 );

 // Chart 2: Distribuição de prazos por semana — base: data (filtrado)
 var ch2Total=semTotal.reduce(function(a,b){return a+b;},0);
 s+=card(
  secHdr('Distribuicao de Prazos — Proximas 8 Semanas')
  +'<div style="display:flex;gap:12px;align-items:center;margin-bottom:10px">'
  +'<div><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">Com prazo</div>'
  +'<div style="font-size:20px;font-weight:900;color:'+COL.neutral+'">'+ch2Total+'</div></div>'
  +'<div><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">Atrasadas</div>'
  +'<div style="font-size:20px;font-weight:900;color:'+COL.crit+'">'+semLate.reduce(function(a,b){return a+b;},0)+'</div></div>'
  +'</div>'
  +(ch2Total>0
   ?svgLineChart([{label:'Total com prazo',color:COL.neutral,values:semTotal},{label:'Atrasadas',color:COL.crit,values:semLate}],semLbl,{w:480,h:110,pl:28})
   :'<div style="font-size:10px;color:var(--muted);text-align:center;padding:20px">Sem prazos no periodo</div>'
  )
  +'<div style="display:flex;gap:12px;margin-top:8px;font-size:10px">'
  +'<span style="display:flex;align-items:center;gap:4px"><span style="width:12px;height:2px;background:'+COL.neutral+';display:inline-block;border-radius:1px"></span>Previstas</span>'
  +'<span style="display:flex;align-items:center;gap:4px"><span style="width:12px;height:2px;background:'+COL.crit+';display:inline-block;border-radius:1px"></span>Atrasadas</span>'
  +'</div>'
 );

 s+='</div>'; // grid 2 cols evolucao

 // ── DETALHAMENTO ANALITICO (indicadores secundarios — granularidade adicional,
 //    mantidos no rodape com estilo discreto conforme diretriz de hierarquia) ─
 s+='<div style="border-top:1px solid var(--border);margin:4px 0 2px"></div>';
 s+='<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);padding:4px 0 8px">DETALHAMENTO ANALITICO</div>';
 s+='<div style="display:grid;grid-template-columns:220px 1fr;gap:12px">';

 // Prioridade — paleta: Alta=vermelho, Media=ambar, Baixa=azul, Sem=cinza (mesma semantica da Timeline)
 var pSl=[{l:'Alta',v:prioMap.Alta,c:COL.crit},{l:'Media',v:prioMap.Media,c:COL.warn},{l:'Baixa',v:prioMap.Baixa,c:COL.prog},{l:'Sem prioridade',v:prioMap.Sem,c:COL.neutral}].filter(function(x){return x.v>0;});
 var pSvg='<svg width="72" height="72" viewBox="0 0 72 72">'+svgDonut(pSl,36,36,29,12)+'</svg>';
 var pRows=pSl.map(function(p){return '<div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;margin-bottom:4px"><span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:50%;background:'+p.c+';display:inline-block"></span><span style="color:var(--muted)">'+p.l+'</span></span><b style="color:var(--text)">'+p.v+'</b></div>';}).join('');
 s+=card(secHdr('Prioridade')+'<div style="display:flex;align-items:center;gap:14px">'+pSvg+'<div style="flex:1">'+pRows+'</div></div>');

 // Tipos de atividade — barras neutras (cinza); % concluido em verde apenas como referencia
 var tRows=topTipos.map(function(k){
  var td=tipoMap[k],pctD=td.total>0?Math.round(td.done*100/td.total):0;
  return '<div style="margin-bottom:7px">'
   +'<div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:3px">'
   +'<span style="color:var(--text);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:240px" title="'+k+'">'+k+'</span>'
   +'<span style="display:flex;gap:8px;flex-shrink:0"><span style="color:var(--muted)">'+td.total+' total</span><span style="color:'+COL.ok+'">'+pctD+'% concluido</span></span></div>'
   +hBar(td.total,maxTipo,COL.neutral)+'</div>';
 }).join('');
 s+=card(secHdr('Tipos de Atividade')+(tRows||'<div style="font-size:10px;color:var(--muted)">Sem dados</div>'));

 s+='</div>'; // grid 2 cols detalhamento

 s+='</div>'; // container
 wrap.innerHTML=s;
}

// _gestorKpiCard removida (limpeza técnica): sem nenhum caller — _gestorRenderMetricas
// usa o helper local kpiBox(), com o mesmo propósito, pra tudo.
