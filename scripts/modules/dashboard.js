// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD (Meu Painel) — KPIs, gráficos, agenda, lembretes, colaboração,
// tarefas pessoais, drawer de nova atividade, Central de Colaborações.
// ═══════════════════════════════════════════════════════════════════════════════
/* SAUDAÇÃO DINÂMICA */
function buildGreeting() {
 // Motivo: usar timezone de Brasília garante saudação correta independente do SO.
 // try/catch protege contra browsers antigos que não suportam 'America/Sao_Paulo'.
 var brHour;
 try {
  brHour = parseInt(new Intl.DateTimeFormat('pt-BR', {
   timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false
  }).format(new Date()), 10);
 } catch(e) {
  brHour = new Date().getHours(); // fallback: hora local do SO
 }
 var turno;
 if (brHour >= 5 && brHour < 12) { turno = 'Bom dia'; }
 else if (brHour >= 12 && brHour < 18) { turno = 'Boa tarde'; }
 else { turno = 'Boa noite'; }

 var name = (localStorage.getItem('pp-name') || 'Lorena').split(' ')[0];
 var greetEl = document.getElementById('dash-greeting');
 if (greetEl) greetEl.innerHTML = turno + ', <strong>' + name + '</strong>';

 var dias  = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
 var meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
 var now   = new Date();
 var dateLine = document.getElementById('dash-date-line');
 if (dateLine) dateLine.textContent =
  dias[now.getDay()] + ', ' + now.getDate() + ' de ' + meses[now.getMonth()] + ' de ' + now.getFullYear();

 // Recalcula os alertas comportamentais (prazo/atraso mudam com o tempo) usando
 // o último snapshot real do Supabase — NUNCA a lista local legada _dashTasks
 // (bug corrigido: isso zerava os alertas reais a cada 60s, já que _dashTasks
 // está sempre vazia para qualquer usuário sem dados legados no navegador).
 _dashBuildAlertsFromDB(window._dashAlertsData || []);
}
buildGreeting();
setInterval(buildGreeting, 60000);

// Abre o drawer de edição da tarefa a partir de um alerta clicável
function _alertaAbrirTarefa(taskId) {
 if (!taskId) return;
 _taskDrawerOpen(taskId);
}

/* ── CENTRAL DE ALERTAS — drawer lateral ────────────────────────────────── */
var _alertDrawerItens = []; // cache dos alertas para renderizar no drawer

function _alertDrawerOpen() {
 var ov  = document.getElementById('alert-drw-ov');
 var drw = document.getElementById('alert-drw');
 if (!drw) return;
 drw.style.transform = 'translateX(0)';
 if (ov) { ov.style.background = 'rgba(0,0,0,.38)'; ov.style.pointerEvents = 'all'; ov.onclick = _alertDrawerClose; }
 _alertDrawerRender();
}

function _alertDrawerClose() {
 var ov  = document.getElementById('alert-drw-ov');
 var drw = document.getElementById('alert-drw');
 if (drw) drw.style.transform = 'translateX(110%)';
 if (ov) { ov.style.background = 'rgba(0,0,0,0)'; ov.style.pointerEvents = 'none'; ov.onclick = null; }
}

function _alertDrawerRender() {
 var body = document.getElementById('alert-drw-body');
 var sub  = document.getElementById('alert-drw-sub');
 if (!body) return;

 var itens = _alertDrawerItens;
 if (!sub) {}
 else if (itens.length === 0) sub.textContent = 'Nenhum alerta ativo';
 else sub.textContent = itens.length + ' alerta' + (itens.length > 1 ? 's' : '') + ' ativo' + (itens.length > 1 ? 's' : '');

 if (itens.length === 0) {
  body.innerHTML = '<div style="padding:48px 24px;text-align:center">'
   + '<div style="width:40px;height:40px;border-radius:10px;background:var(--surface2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;margin:0 auto 12px">'
   + '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>'
   + '</div>'
   + '<div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:4px">Tudo em ordem</div>'
   + '<div style="font-size:12px;color:var(--muted)">Nenhum alerta no momento</div>'
   + '</div>';
  return;
 }

 var tipoLabel = { 'atr':'Prazo vencido', 'hoje':'Vence hoje', 'parada':'Tarefa parada', 'sem-atualizacao':'Sem atualização', 'inconsistente':'Status inconsistente', 'colab':'Colaboração solicitada' };
 body.innerHTML = itens.map(function(a) {
  var cor = a.cor || 'var(--muted)';
  var labelTipo = tipoLabel[a.tipo] || 'Alerta';
  var acao = a.id ? '_alertaAbrirTarefa(' + a.id + ');_alertDrawerClose()' : '_alertDrawerClose();_kpiDrawerOpen(\'' + a.tipo + '\')';
  return '<div onclick="' + acao + '" style="display:flex;align-items:flex-start;gap:12px;padding:13px 20px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .12s" onmouseover="this.style.background=\'var(--surface2)\'" onmouseout="this.style.background=\'\'"> '
   + '<div style="width:8px;height:8px;border-radius:50%;background:' + cor + ';flex-shrink:0;margin-top:4px"></div>'
   + '<div style="flex:1;min-width:0">'
   + '<div style="font-size:11px;font-weight:600;color:' + cor + ';text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px">' + labelTipo + '</div>'
   + '<div style="font-size:12px;color:var(--text);line-height:1.4">' + a.msg + '</div>'
   + '</div>'
   + '<svg style="flex-shrink:0;margin-top:3px;color:var(--muted)" width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 2l4 4-4 4"/></svg>'
   + '</div>';
 }).join('');
}

/* Versão para dados vindos diretamente do Supabase (allAt) */
function _dashBuildAlertsFromDB(allAt) {
 var atrCount  = parseInt((document.getElementById('dash-kpi-atr')  || {}).textContent || '0', 10);
 var hojeCount = parseInt((document.getElementById('dash-kpi-hoje') || {}).textContent || '0', 10);
 var agora     = Date.now();
 var DIA       = 86400000;
 var hoje      = new Date(); hoje.setHours(0,0,0,0);

 var alertas = [];

 // Alertas de prazo (vindos dos KPIs já calculados)
 if (atrCount > 0) alertas.push({ tipo:'atr', cor:'#D6433C', msg: atrCount + ' atividade' + (atrCount > 1 ? 's' : '') + ' com prazo vencido', id: null, acao: function(){ _kpiDrawerOpen('atr'); } });
 if (hojeCount > 0) alertas.push({ tipo:'hoje', cor:'#B8790A', msg: hojeCount + ' atividade' + (hojeCount > 1 ? 's' : '') + ' vence' + (hojeCount > 1 ? 'm' : '') + ' hoje', id: null, acao: function(){ _kpiDrawerOpen('hoje'); } });

 // Alertas comportamentais por tarefa
 (allAt || []).forEach(function(t) {
  var stNorm = (t.status || '').toLowerCase();
  if (stNorm === 'feito' || stNorm === 'concluído' || stNorm === 'cancelado' || stNorm === 'obsoleto') return;

  var titulo = (t.titulo || 'Sem título').substring(0, 50);
  var prazo  = t.data_prazo ? new Date(t.data_prazo + 'T00:00:00').getTime() : null;

  if (prazo && prazo < hoje.getTime() && (stNorm === 'em andamento' || stNorm === 'em progresso')) {
   alertas.push({ tipo:'inconsistente', cor:'#D6433C', msg: titulo + ' — prazo vencido e ainda em andamento', id: t.id });
   return;
  }
  var updAt = t.updated_at ? new Date(t.updated_at).getTime() : null;
  if (updAt && Math.floor((agora - updAt) / DIA) >= 15) {
   alertas.push({ tipo:'sem-atualizacao', cor:'#B8790A', msg: titulo + ' — sem atualização há ' + Math.floor((agora - updAt) / DIA) + ' dias', id: t.id });
   return;
  }
  var criado = t.created_at ? new Date(t.created_at).getTime() : null;
  if (criado && (stNorm === 'em andamento' || stNorm === 'em progresso') && Math.floor((agora - criado) / DIA) >= 20) {
   alertas.push({ tipo:'parada', cor:'#a78bfa', msg: titulo + ' — em andamento há ' + Math.floor((agora - criado) / DIA) + ' dias', id: t.id });
   return;
  }
 });

 // Deduplica por ID
 var vistosId = {};
 alertas = alertas.filter(function(a) {
  if (!a.id) return true; // alertas globais (atr/hoje) sempre passam
  if (vistosId[a.id]) return false;
  vistosId[a.id] = true;
  return true;
 });

 // Atualiza badge do sino
 _alertDrawerItens = alertas;
 var badge = document.getElementById('alert-bell-badge');
 var bellBtn = document.getElementById('alert-bell-btn');
 if (badge) {
  var total = alertas.length;
  if (total > 0) {
   badge.style.display = 'flex';
   badge.textContent = total > 9 ? '9+' : String(total);
   if (bellBtn) bellBtn.style.borderColor = '#D6433C';
  } else {
   badge.style.display = 'none';
   if (bellBtn) bellBtn.style.borderColor = '';
  }
 }
 // Re-renderiza drawer se estiver aberto
 var drw = document.getElementById('alert-drw');
 if (drw && drw.style.transform === 'translateX(0px)') _alertDrawerRender();

 // Colaborações pendentes recebidas pelo usuário logado entram na mesma
 // Central de Alertas — busca é assíncrona, então o array/badge acima
 // (síncronos) são complementados um instante depois, sem bloquear o resto
 // do boot do Meu Painel.
 if (typeof _dashAppendColabAlerts === 'function') _dashAppendColabAlerts();
}

/* Acrescenta a _alertDrawerItens um alerta por solicitação de colaboração
 * PENDENTE recebida pelo usuário logado (receptor_email === me) — é a
 * notificação real pedida em "Meu Painel" para quem recebe um pedido de
 * colaboração, usando o mecanismo já existente (sino) em vez de inventar um
 * painel novo. Roda sempre depois de _dashBuildAlertsFromDB ter acabado de
 * substituir _alertDrawerItens, então só ACRESCENTA, nunca sobrescreve. */
async function _dashAppendColabAlerts() {
 if (!_currentUser) return;
 var me = _currentUser.email || '';
 var all = await _colabReqsAllCached();
 var pendRecebidas = (all || []).filter(function(r){ return r.receptor_email === me && r.status === 'Pendente'; });
 if (!pendRecebidas.length) return;
 pendRecebidas.forEach(function(r) {
  var alvo = r.subtask_titulo
   ? ('subtarefa "' + r.subtask_titulo + '" (' + (r.atividade_titulo || 'atividade') + ')')
   : ('"' + (r.atividade_titulo || 'Atividade') + '"');
  var msg = (r.solicitante_nome || r.solicitante_email || 'Alguém') + ' solicitou sua colaboração em ' + alvo + (r.motivo ? ' — ' + r.motivo : '');
  _alertDrawerItens.push({ tipo:'colab', cor:'#0183FF', msg: msg, id: r.atividade_id });
 });
 var badge = document.getElementById('alert-bell-badge');
 var bellBtn = document.getElementById('alert-bell-btn');
 if (badge) {
  var total = _alertDrawerItens.length;
  if (total > 0) {
   badge.style.display = 'flex';
   badge.textContent = total > 9 ? '9+' : String(total);
   if (bellBtn) bellBtn.style.borderColor = '#D6433C';
  } else {
   badge.style.display = 'none';
   if (bellBtn) bellBtn.style.borderColor = '';
  }
 }
 var drw = document.getElementById('alert-drw');
 if (drw && drw.style.transform === 'translateX(0px)') _alertDrawerRender();
}



/* Widget "Notas Pessoais" do Meu Painel foi removido do HTML (sem
   #dash-notes-area/#dash-notes-status em index.html) — _dashNotesChange/
   _dashLoadNotes/_dashNotesTimer removidos junto (limpeza técnica; ver
   docs/ para o registro completo). */

/* ── MEU PAINEL — LEMBRETES (Supabase + Realtime) ───────────────────────── */
var _remCurrentTab    = 'inbox';
var _remUsers         = [];   // lista de usuários para autocomplete
var _remRealtimeSub   = null; // subscription Realtime ativa

// ── Carrega lista de usuários para o campo "Para" ─────────────────────────
async function _remLoadUsers() {
 try {
  var session = (await _sb.auth.getSession()).data.session;
  if (!session) return;
  var r = await fetch('https://pnecdbobhywfjdadylwt.supabase.co/functions/v1/auth-admin', {
   method: 'POST',
   headers: { 'Content-Type':'application/json', 'Authorization':'Bearer '+session.access_token },
   body: JSON.stringify({ action: 'listar-usuarios' })
  });
  var res = await r.json();
  if (res.ok && res.users) {
   _remUsers = res.users.filter(function(u){ return u.email !== session.user.email; });
   _remPopulateToSelect();
  }
 } catch(e) {}
}

function _remPopulateToSelect() {
 var sel = document.getElementById('rem-to-select');
 if (!sel) return;
 sel.innerHTML = '<option value="">Para quem?</option>'
  + _remUsers.map(function(u){
    var name = u.full_name || u.email;
    return '<option value="'+u.email+'" data-name="'+name+'">'+name+'</option>';
   }).join('');
}

// ── Carregar inbox do Supabase ────────────────────────────────────────────
async function _remLoadInbox() {
 var me = (_currentUser && _currentUser.email) || localStorage.getItem('milatec-user-email') || '';
 if (!me) return;
 var el = document.getElementById('dash-inbox-list');
 if (el) el.innerHTML = '<div class="rem-empty" style="padding:12px;text-align:center;color:var(--muted);font-size:11px">Carregando...</div>';
 try {
  var res = await _sb.from('lembretes').select('*').eq('to_email', me).order('created_at', { ascending: false }).limit(30);
  var data = res.data || [];
  // Atualiza badge
  var unread = data.filter(function(r){ return !r.lido; }).length;
  var badge = document.getElementById('rem-inbox-badge');
  if (badge) { badge.textContent = unread; badge.style.display = unread ? '' : 'none'; }
  if (el) el.innerHTML = data.length
   ? data.map(function(r){ return _remBuildCard(r, false); }).join('')
   : '<div class="rem-empty" style="padding:16px;text-align:center;color:var(--muted);font-size:11px">Nenhum lembrete recebido.</div>';
  // Marca como lido automaticamente
  var unreadIds = data.filter(function(r){ return !r.lido; }).map(function(r){ return r.id; });
  if (unreadIds.length) _sb.from('lembretes').update({ lido: true }).in('id', unreadIds);
 } catch(e) { console.error('[Lembretes] Erro inbox:', e); }
}

// ── Carregar enviados do Supabase ─────────────────────────────────────────
async function _remLoadSent() {
 var me = (_currentUser && _currentUser.email) || localStorage.getItem('milatec-user-email') || '';
 if (!me) return;
 var el = document.getElementById('dash-sent-list');
 if (el) el.innerHTML = '<div class="rem-empty" style="padding:12px;text-align:center;color:var(--muted);font-size:11px">Carregando...</div>';
 try {
  var res = await _sb.from('lembretes').select('*').eq('from_email', me).order('created_at', { ascending: false }).limit(30);
  var data = res.data || [];
  if (el) el.innerHTML = data.length
   ? data.map(function(r){ return _remBuildCard(r, true); }).join('')
   : '<div class="rem-empty" style="padding:16px;text-align:center;color:var(--muted);font-size:11px">Nenhum lembrete enviado.</div>';
 } catch(e) { console.error('[Lembretes] Erro enviados:', e); }
}

// ── Realtime: badges do menu lateral (Empresas/Obras/Projetos/Entregas/
// Instalações/Melhorias) ── Empresas e Projetos são as únicas dessas 6
// tabelas com fluxo de criação dentro do app; Obras/Instalações/Melhorias/
// Entregas só mudam por fora (Supabase direto, outra ferramenta). Assinar
// a tabela em si (INSERT/DELETE), em vez de só reagir ao clique de "criar"
// deste app, cobre os dois casos com o mesmo código — mesmo padrão já
// usado em _remStartRealtime (lembretes).
var _navBadgeChannels = {};
var _NAV_BADGE_TABLES = ['empresas','obras','projetos','entregas','instalacoes','melhorias','fornecedores'];
var _navBadgesLoadInFlight = false; // guarda contra disparo duplicado (_dbInit rodando 2x, aba reaberta, etc.)

// ── Carga inicial dos 6 badges — uma única RPC (rpc_sidebar_counts), COUNT
// puro no banco, sem trazer nenhuma linha das tabelas. Substitui o padrão
// antigo de "carregar a lista inteira e usar .length", que era a causa raiz
// do badge de Instalações ficar preso em "—" (seu loader só roda quando a
// aba é aberta) e da demora perceptível nos demais (presos atrás do
// carregamento completo de milhares de linhas).
function _navBadgesLoadInitial() {
 if (_navBadgesLoadInFlight) return;
 _navBadgesLoadInFlight = true;
 // Skeleton: mantém "—" (já é o placeholder padrão no HTML) enquanto a
 // requisição está em voo — não há o que trocar aqui além de garantir que
 // nenhum badge fique com texto vazio.
 _NAV_BADGE_TABLES.forEach(function(k){
  var el = document.getElementById('nav-badge-' + k);
  if (el && !el.textContent.trim()) el.textContent = '—';
 });
 var userEmail = (_currentUser && _currentUser.email) || localStorage.getItem('milatec-user-email') || '';
 // Os badges de Gestor de Tarefas e Meu Painel usam a MESMA rpc_atividades_kpis
 // já usada pelas barras de KPI de cada tela (global pra Gestor, escopada por
 // e-mail pra Painel) — disparados junto com os 6 badges de entidade, em
 // paralelo, pra todos carregarem ao mesmo tempo (não só depois que o
 // usuário abrir cada aba).
 var pSidebar = _sb.rpc('rpc_sidebar_counts').then(function(r) {
  if (r.error) throw r.error;
  var row = Array.isArray(r.data) ? r.data[0] : r.data;
  if (row) {
   _NAV_BADGE_TABLES.forEach(function(k){
    var el = document.getElementById('nav-badge-' + k);
    if (el && row[k] != null) el.textContent = row[k];
   });
  }
 }).catch(function(e) {
  console.error('[Badges] Erro ao carregar contadores do menu lateral:', e);
  // Falha de conexão/RPC: mantém "—" em vez de travar pra sempre ou
  // quebrar a UI — estado de erro visível, mas gracioso.
  _NAV_BADGE_TABLES.forEach(function(k){
   var el = document.getElementById('nav-badge-' + k);
   if (el && !/^\d+$/.test(el.textContent.trim())) el.textContent = '—';
  });
 });
 var pGestor = _sb.rpc('rpc_atividades_kpis', { p_responsavel: null }).then(function(r) {
  if (r.error) throw r.error;
  var row = Array.isArray(r.data) ? r.data[0] : r.data;
  var el = document.getElementById('nav-badge-gestor');
  if (el && row) el.textContent = row.a_fazer;
 }).catch(function(e) {
  console.error('[Badges] Erro ao carregar contador de Gestor de Tarefas:', e);
  var el = document.getElementById('nav-badge-gestor');
  if (el && !/^\d+$/.test(el.textContent.trim())) el.textContent = '—';
 });
 var pPainel = userEmail ? _sb.rpc('rpc_atividades_kpis', { p_responsavel: userEmail }).then(function(r) {
  if (r.error) throw r.error;
  var row = Array.isArray(r.data) ? r.data[0] : r.data;
  var el = document.getElementById('nav-badge-painel');
  if (el && row) el.textContent = row.a_fazer;
 }).catch(function(e) {
  console.error('[Badges] Erro ao carregar contador de Meu Painel:', e);
  var el = document.getElementById('nav-badge-painel');
  if (el && !/^\d+$/.test(el.textContent.trim())) el.textContent = '—';
 }) : Promise.resolve();
 return Promise.all([pSidebar, pGestor, pPainel]).finally(function() { _navBadgesLoadInFlight = false; });
}

function _navBadgeBump(badgeId, delta) {
 var el = document.getElementById(badgeId);
 if (!el) return;
 var cur = parseInt(el.textContent, 10);
 if (isNaN(cur)) return; // ainda "—" (carregando) — a carga inicial já traz o valor certo
 el.textContent = Math.max(0, cur + delta);
}
function _navBadgeStartRealtime(table, badgeId) {
 if (_navBadgeChannels[table]) { try { _sb.removeChannel(_navBadgeChannels[table]); } catch(e){} }
 _navBadgeChannels[table] = _sb
  .channel('navbadge-' + table)
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: table }, function(){ _navBadgeBump(badgeId, 1); })
  .on('postgres_changes', { event: 'DELETE', schema: 'public', table: table }, function(){ _navBadgeBump(badgeId, -1); })
  .subscribe();
}
function _navBadgesStartRealtimeAll() {
 _navBadgeStartRealtime('empresas',    'nav-badge-empresas');
 _navBadgeStartRealtime('obras',       'nav-badge-obras');
 _navBadgeStartRealtime('projetos',    'nav-badge-projetos');
 _navBadgeStartRealtime('entregas',    'nav-badge-entregas');
 _navBadgeStartRealtime('instalacoes', 'nav-badge-instalacoes');
 _navBadgeStartRealtime('melhorias',   'nav-badge-melhorias');
 // Contagem inicial das 6 tabelas: ver _navBadgesLoadInitial() (chamada
 // direto de _dbInit em app.js, em paralelo, sem esperar por isso aqui).
}

// ── Realtime: receber lembretes em tempo real ─────────────────────────────
function _remStartRealtime() {
 if (_remRealtimeSub) { try { _sb.removeChannel(_remRealtimeSub); } catch(e){} }
 var me = (_currentUser && _currentUser.email) || localStorage.getItem('milatec-user-email') || '';
 if (!me) return;
 _remRealtimeSub = _sb
  .channel('lembretes-inbox-' + me.replace('@','_').replace('.','_'))
  .on('postgres_changes', {
   event: 'INSERT', schema: 'public', table: 'lembretes',
   filter: 'to_email=eq.' + me
  }, function(payload) {
   // Notificação visual
   var r = payload.new;
   if (r) {
    _showToast('Novo lembrete de ' + (r.from_name || r.from_email), 'ok');
    _remLoadInbox();
   }
  })
  .subscribe();
}

// ── Render de card ────────────────────────────────────────────────────────
function _remAvatarColor(name) {
 var colors = ['#004AE8','#1F8A4C','#e07b00','#8B6FE8','#1f7ec4','#c44b1f'];
 var i = 0;
 if (name) for (var j = 0; j < name.length; j++) i += name.charCodeAt(j);
 return colors[i % colors.length];
}

function _remBuildCard(r, isSent) {
 var who       = isSent ? (r.to_name || r.to_email) : (r.from_name || r.from_email);
 var avLetter  = (who || '?').charAt(0).toUpperCase();
 var avColor   = _remAvatarColor(who);
 var urgTag    = r.urgencia === 'urgente'
  ? '<span style="font-size:9px;background:var(--red-dim);color:var(--red);border-radius:4px;padding:1px 5px;font-weight:700;margin-right:4px">Urgente</span>'
  : '';
 var unreadDot = (!isSent && !r.lido)
  ? '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--green);margin-right:5px;flex-shrink:0"></span>'
  : '';
 var dt = r.created_at ? new Date(r.created_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';

 // Atividade vinculada — chip clicável que abre o drawer direto
 var ativHtml = '';
 if (r.atividade_id && r.atividade_titulo) {
  ativHtml = '<div onclick="_remAbrirAtividade(\'' + r.atividade_id + '\')" style="'
   + 'display:flex;align-items:center;gap:6px;margin-top:6px;padding:6px 9px;'
   + 'background:var(--surface2);border:1px solid var(--border);border-radius:6px;'
   + 'cursor:pointer;transition:border-color .15s;max-width:100%'
   + '" onmouseover="this.style.borderColor=\'var(--navy)\'" onmouseout="this.style.borderColor=\'var(--border)\'">'
   + '<svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="var(--navy)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><rect x="1.5" y="2" width="9" height="8" rx="1.5"/><line x1="3.5" y1="5" x2="8.5" y2="5"/><line x1="3.5" y1="7" x2="6.5" y2="7"/></svg>'
   + '<span style="font-size:10px;font-weight:600;color:var(--navy);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + r.atividade_titulo + '</span>'
   + '<span style="font-size:9px;color:var(--muted);flex-shrink:0">Abrir &rsaquo;</span>'
   + '</div>';
 }

 return '<div class="rem-card">'
  + '<div class="rem-av" style="background:' + avColor + '">' + avLetter + '</div>'
  + '<div class="rem-body">'
  + '<div class="rem-who" style="display:flex;align-items:center">'
  + unreadDot
  + (isSent ? 'Para: <b>' + who + '</b>' : 'De: <b>' + who + '</b>')
  + '</div>'
  + '<div class="rem-msg">' + urgTag + r.texto + '</div>'
  + ativHtml
  + '<div class="rem-foot"><span class="rem-time">' + dt + '</span>'
  + '<button class="rem-del" onclick="_remDelete(\''+r.id+'\')" title="Apagar">&times;</button>'
  + '</div>'
  + '</div>'
  + '</div>';
}

// ── Abrir atividade vinculada ao lembrete ────────────────────────────────
async function _remAbrirAtividade(ativId) {
 if (!ativId) return;
 // Tenta encontrar no cache local primeiro (mais rápido)
 var ativ = null;
 if (_dashAllAtRaw && _dashAllAtRaw.length) {
  ativ = _dashAllAtRaw.find(function(a){ return String(a.id) === String(ativId); });
 }
 // Se não encontrou no cache, busca no Supabase
 if (!ativ) {
  try {
   var res = await _sb.from('atividades')
    .select('id, titulo, status, prioridade, area, tipo_atividade, data_prazo, data_inicio, responsavel, updated_at')
    .eq('id', ativId)
    .single();
   ativ = res.data;
   if (ativ && Array.isArray(ativ.responsavel)) ativ.responsavel = _emailsToNomes(ativ.responsavel);
  } catch(e) { ativ = null; }
 }
 if (!ativ) { _showToast('Atividade não encontrada', 'erro'); return; }
 // Abre o drawer de detalhes — mesmo comportamento de clicar na atividade no feed
 _feedItemClick(null, ativ);
}

// ── Deletar lembrete ──────────────────────────────────────────────────────
async function _remDelete(id) {
 await _sb.from('lembretes').delete().eq('id', id);
 _remLoadInbox();
 if (_remCurrentTab === 'sent') _remLoadSent();
}

// ── Alias para compatibilidade (corrige bug: função inexistente) ──────────
function _dashRenderInbox()   { _remLoadInbox(); }



/* ══════════════════════════════════════════════════════════════════════════
   COLABORAÇÃO FORMAL — solicitações bidirecionais com rastreamento de status
   Fluxo: Pendente → Aceita|Recusada → Em andamento → Aguardando retorno →
   Concluída. Tabela: colaboracao_solicitacoes (Supabase) — uma única linha
   por solicitação, visível para solicitante e receptor via query, não mais
   duas cópias em localStorage (uma por usuário, cada uma só no navegador
   de quem a criou — por isso o receptor nunca via a solicitação).
══════════════════════════════════════════════════════════════════════════ */
function _remLoadColab() { _remLoadColabReqs(); }

async function _colabReqBuscar(filtroFn) {
 if (!_sb) return [];
 var res = await _sb.from('colaboracao_solicitacoes').select('*').order('created_at', { ascending: false });
 if (res.error) { console.error('[Colaboração] erro ao buscar:', res.error); return []; }
 return filtroFn ? res.data.filter(filtroFn) : res.data;
}

/* Cria uma solicitação de colaboração (task drawer → Comunicação) */
async function _drwColabReqEnviar() {
 var receptorSel = document.getElementById('drw-colab-receptor');
 var motivoSel   = document.getElementById('drw-colab-motivo');
 var msgEl       = document.getElementById('drw-colab-msg');
 var prazoEl     = document.getElementById('drw-colab-prazo');
 var subtaskSel  = document.getElementById('drw-colab-subtask');
 if (!receptorSel || !receptorSel.value) { _showToast('Selecione um colaborador', 'erro'); return; }
 if (!motivoSel || !motivoSel.value)     { _showToast('Selecione o motivo da colaboração', 'erro'); return; }
 if (!_currentUser) { _showToast('Usuário não identificado', 'erro'); return; }
 var receptor = _respUsuarios.find(function(r){ return r.email === receptorSel.value; });
 if (!receptor) { _showToast('Colaborador inválido', 'erro'); return; }
 if (!window._drwCurrentTask) { _showToast('Salve a atividade antes de solicitar colaboração', 'erro'); return; }
 var task = window._drwCurrentTask;
 var now = new Date().toISOString();
 // Subtarefa relacionada é opcional — a colaboração continua valendo para a
 // atividade toda quando nada é selecionado no <select> (opção "Nenhuma").
 var subtaskId  = (subtaskSel && subtaskSel.value) ? subtaskSel.value : null;
 var subtaskItem = subtaskId ? _drwSubItems.find(function(s){ return String(s._id) === String(subtaskId); }) : null;
 var payload = {
  atividade_id:       String(task.id),
  atividade_titulo:   task.titulo || task.nome || 'Atividade',
  subtask_id:         subtaskItem ? String(subtaskItem._id) : null,
  subtask_titulo:     subtaskItem ? (subtaskItem.titulo || null) : null,
  solicitante_email:  _currentUser.email || '',
  solicitante_nome:   _currentUser.name || _currentUser.email || '',
  receptor_email:     receptor.email,
  receptor_nome:      receptor.nome || receptor.email,
  motivo:             motivoSel.value,
  mensagem:           (msgEl ? msgEl.value.trim() : '') || null,
  prazo:              (prazoEl && prazoEl.value) ? prazoEl.value : null,
  status:             'Pendente',
  historico:          [{ status: 'Pendente', por: _currentUser.email || '', em: now, label: 'Solicitação criada' }],
 };
 var ins = await _sb.from('colaboracao_solicitacoes').insert(payload);
 if (ins.error) { _showToast('Erro ao solicitar colaboração: ' + _supaErrPt(ins.error.message), 'erro'); return; }
 _drwColabReqCancel();
 _drwColabReqRender(task.id);
 _histLogAdd('colab', payload.atividade_titulo, 'Colaboração solicitada para ' + payload.receptor_nome + ' — ' + payload.motivo + (payload.subtask_titulo ? ' (subtarefa: ' + payload.subtask_titulo + ')' : ''));
 _showToast('Colaboração solicitada para ' + payload.receptor_nome, 'ok');
}

/* Renderiza a lista de solicitações de colaboração dentro do drawer */
async function _drwColabReqRender(taskId) {
 var listEl = document.getElementById('drw-colab-req-list');
 if (!listEl || !_currentUser) return;
 var me = _currentUser.email || '';
 var reqs = await _colabReqBuscar(function(r){
  return String(r.atividade_id) === String(taskId) && (r.solicitante_email === me || r.receptor_email === me);
 });
 // Mapa subtask_id → solicitação ativa mais recente, consultado pela aba
 // Subtarefas (_drwSubRender) para desenhar o indicador na linha certa.
 _drwSubColabMap = {};
 reqs.forEach(function(r) {
  if (r.subtask_id && r.status !== 'Concluída' && r.status !== 'Recusada' && !_drwSubColabMap[r.subtask_id]) {
   _drwSubColabMap[r.subtask_id] = r;
  }
 });
 _drwSubRender();
 if (!reqs.length) {
  listEl.innerHTML = '<div style="font-size:11px;color:var(--muted);padding:10px 0;text-align:center">Nenhuma colaboração solicitada para esta atividade.</div>';
  return;
 }
 var badgeClass = { 'Pendente':'pendente','Aceita':'aceita','Recusada':'recusada','Em andamento':'andamento','Aguardando retorno':'aguardando','Concluída':'concluida' };
 var statusOrder = ['Pendente','Aceita','Em andamento','Aguardando retorno','Concluída','Recusada'];
 var today = new Date(); today.setHours(0,0,0,0);

 listEl.innerHTML = reqs.map(function(r) {
  var isSol = r.solicitante_email === me;
  var isRec = r.receptor_email === me;
  var bc    = 'colab-req-badge ' + 'colab-req-badge-' + (badgeClass[r.status] || 'pendente');
  var dt    = r.created_at ? new Date(r.created_at).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'}) : '';

  // Avatar e nomes
  var outraNome = isSol ? (r.receptor_nome || r.receptor_email || '?') : (r.solicitante_nome || r.solicitante_email || '?');
  var av     = (outraNome || '?').charAt(0).toUpperCase();
  var whoLbl = isSol
   ? '<span style="color:var(--muted)">Para</span> <strong>' + (r.receptor_nome || '?') + '</strong>'
   : '<span style="color:var(--muted)">De</span> <strong>' + (r.solicitante_nome || '?') + '</strong>';

  // Prazo
  var prazoHtml = '';
  if (r.prazo) {
   var prazoDate = new Date(r.prazo + 'T23:59:59');
   var diff = Math.ceil((prazoDate - today) / 86400000);
   var prazoFmt = prazoDate.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'});
   var prazoClass = diff < 0 ? 'vencido' : diff <= 3 ? 'proximo' : '';
   // Indicador de prazo sem emoji — ícone SVG inline
   var prazoIconSvg = diff < 0
    ? '<svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M6 1.5L11 10.5H1L6 1.5z"/><line x1="6" y1="5" x2="6" y2="7.5"/><circle cx="6" cy="9.2" r=".4" fill="currentColor" stroke="none"/></svg>'
    : diff <= 3
    ? '<svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" style="flex-shrink:0"><circle cx="6" cy="6" r="4.5"/><polyline points="6,3.5 6,6 8,7"/></svg>'
    : '<svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="flex-shrink:0"><rect x="1.5" y="2.5" width="9" height="8" rx="1.2"/><line x1="1.5" y1="5" x2="10.5" y2="5"/><line x1="4" y1="1.5" x2="4" y2="3.5"/><line x1="8" y1="1.5" x2="8" y2="3.5"/></svg>';
   prazoHtml = '<span class="colab-card-prazo ' + prazoClass + '" style="display:inline-flex;align-items:center;gap:3px">' + prazoIconSvg + 'Prazo: ' + prazoFmt + (diff < 0 ? ' (vencido)' : diff <= 3 && diff >= 0 ? ' (' + diff + 'd)' : '') + '</span>';
  }

  // Ações por status
  var actions = '';
  if (isRec && r.status === 'Pendente') {
   actions = '<button class="colab-req-btn accept" onclick="_drwColabReqAcao(\'' + r.id + '\',\'Aceita\')">Aceitar</button>'
    + '<button class="colab-req-btn decline" onclick="_drwColabReqAcao(\'' + r.id + '\',\'Recusada\')">Recusar</button>';
  } else if (isRec && r.status === 'Aceita') {
   actions = '<button class="colab-req-btn" onclick="_drwColabReqAcao(\'' + r.id + '\',\'Em andamento\')">Iniciar</button>';
  } else if ((isSol || isRec) && r.status === 'Em andamento') {
   actions = '<button class="colab-req-btn accept" onclick="_drwColabReqAcao(\'' + r.id + '\',\'Concluída\')">Concluir</button>'
    + '<button class="colab-req-btn" onclick="_drwColabReqAcao(\'' + r.id + '\',\'Aguardando retorno\')" style="border-color:#7c3aed;color:#7c3aed">Aguardar retorno</button>';
  } else if (isSol && r.status === 'Aguardando retorno') {
   actions = '<button class="colab-req-btn" onclick="_drwColabReqAcao(\'' + r.id + '\',\'Em andamento\')">Retomar</button>';
  }

  // Timeline dos últimos eventos
  var hist = r.historico || [];
  var tlHtml = hist.slice(-3).map(function(h) {
   var hdt = h.em ? new Date(h.em).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';
   var dotCls = h.status === 'Concluída' ? 'done' : h.status === 'Recusada' ? 'red' : h.status === 'Em andamento' || h.status === 'Aceita' ? 'active' : '';
   return '<div class="colab-tl-entry"><div class="colab-tl-dot ' + dotCls + '"></div><span>' + h.status + (h.label ? ' — ' + h.label : '') + '</span><span style="margin-left:auto;font-size:9px">' + hdt + '</span></div>';
  }).join('');

  return '<div class="colab-card">'
   // Cabeçalho
   + '<div class="colab-card-hd">'
   + '<div class="colab-card-av" style="background:' + (isSol ? 'var(--navy)' : '#7c3aed') + '">' + av + '</div>'
   + '<div class="colab-card-meta">'
   + '<div class="colab-card-who">' + whoLbl + '</div>'
   + '<div class="colab-card-task">' + (r.subtask_titulo
      ? 'Subtarefa: <strong>' + r.subtask_titulo + '</strong> <span style="color:var(--muted)">(' + (r.atividade_titulo || '') + ')</span>'
      : (r.atividade_titulo || '')) + '</div>'
   + '</div>'
   + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0">'
   + '<span class="' + bc + '">' + r.status + '</span>'
   + '<span style="font-size:9px;color:var(--muted)">' + dt + '</span>'
   + '</div>'
   + '</div>'
   // Corpo
   + '<div class="colab-card-body">'
   + (r.motivo ? '<div class="colab-card-info"><span class="colab-card-motivo">' + r.motivo + '</span>' + prazoHtml + '</div>' : prazoHtml ? '<div class="colab-card-info">' + prazoHtml + '</div>' : '')
   + (r.mensagem ? '<div class="colab-card-obs">' + r.mensagem + '</div>' : '')
   + '</div>'
   // Ações
   + (actions ? '<div class="colab-card-ft">' + actions + '</div>' : '')
   // Timeline
   + (tlHtml ? '<div class="colab-timeline">' + tlHtml + '</div>' : '')
   + '</div>';
 }).join('');
}

/* Ação sobre solicitação (aceitar, recusar, iniciar, concluir) — compartilhada
 * entre o drawer da atividade e o painel Lembretes. */
async function _colabReqAtualizarStatus(reqId, novoStatus) {
 if (!_sb || !_currentUser) return false;
 var statusLabels = { 'Aceita':'Aceita pelo colaborador', 'Recusada':'Recusada pelo colaborador', 'Em andamento':'Trabalho iniciado', 'Aguardando retorno':'Aguardando retorno do solicitante', 'Concluída':'Colaboração concluída' };
 var atual = await _sb.from('colaboracao_solicitacoes').select('historico').eq('id', reqId).maybeSingle();
 if (atual.error || !atual.data) { _showToast('Solicitação não encontrada', 'erro'); return false; }
 var novoHistorico = (atual.data.historico || []).concat([{ status: novoStatus, por: _currentUser.email || '', label: statusLabels[novoStatus] || '', em: new Date().toISOString() }]);
 var upd = await _sb.from('colaboracao_solicitacoes').update({ status: novoStatus, historico: novoHistorico }).eq('id', reqId);
 if (upd.error) { _showToast('Erro ao atualizar colaboração: ' + _supaErrPt(upd.error.message), 'erro'); return false; }
 return true;
}

function _drwColabReqAcao(reqId, novoStatus) {
 _colabReqAtualizarStatus(reqId, novoStatus).then(function(ok) {
  if (!ok) return;
  if (window._drwCurrentTask) _drwColabReqRender(window._drwCurrentTask.id);
  _remLoadColabReqs();
  var toastMsg = { 'Aceita':'Colaboração aceita', 'Recusada':'Colaboração recusada', 'Em andamento':'Colaboração em andamento', 'Aguardando retorno':'Aguardando retorno do solicitante', 'Concluída':'Colaboração concluída' };
  _showToast(toastMsg[novoStatus] || ('Colaboração: ' + novoStatus), novoStatus === 'Concluída' ? 'ok' : novoStatus === 'Recusada' ? 'erro' : 'ok');
 });
}

/* Toggle do formulário de nova solicitação */
function _drwColabReqToggleForm() {
 var form = document.getElementById('drw-colab-form');
 if (!form) return;
 var isOpen = form.classList.contains('open');
 if (isOpen) { form.classList.remove('open'); return; }
 form.classList.add('open');
 // Preencher lista de receptores do searchable-select (mesmo padrão do Projeto)
 var meEmail = (_currentUser && _currentUser.email) || '';
 _colabReceptLista = (_respUsuarios || []).filter(function(r){ return r.email !== meEmail; });
 _colabReceptClear();
 var motivo = document.getElementById('drw-colab-motivo');
 if (motivo) motivo.value = '';
 var prazo = document.getElementById('drw-colab-prazo');
 if (prazo) prazo.value = '';
 var msg = document.getElementById('drw-colab-msg');
 if (msg) msg.value = '';
 // Subtarefa relacionada é opcional — lista as subtarefas DESTA atividade
 // (_drwSubItems, já carregado por _taskDrawerOpen), com "atividade toda" como padrão.
 var subSel = document.getElementById('drw-colab-subtask');
 if (subSel) {
  subSel.innerHTML = '<option value="">Nenhuma (atividade toda)</option>'
   + (_drwSubItems || []).map(function(s) {
     return '<option value="' + s._id + '">' + (s.titulo || '(sem título)') + '</option>';
    }).join('');
  subSel.value = '';
 }
}
function _drwColabReqCancel() {
 var form = document.getElementById('drw-colab-form');
 if (form) form.classList.remove('open');
}

/* Atalho a partir de uma linha de Subtarefa: abre (ou reaproveita) o mesmo
 * formulário de "Solicitar Colaboração" já pré-selecionando essa subtarefa,
 * em vez de duplicar UI — a subtarefa some do <select> apenas se o título
 * ainda estiver vazio ("(clique para definir)"), já que colaborar sobre uma
 * subtarefa sem título não faz sentido para quem for recebê-la. */
function _drwColabReqOpenForSubtask(subtaskId) {
 // Criando uma atividade nova (ainda sem id real no banco), o pedido de
 // colaboração não tem em que se apoiar (atividade_id) — mesmo aviso que
 // _drwColabReqEnviar já usa. Salve primeiro e o botão passa a funcionar
 // normalmente, sem precisar reabrir nada.
 if (!window._drwCurrentTask) { _showToast('Salve a atividade antes de solicitar colaboração', 'erro'); return; }
 var item = _drwSubItems.find(function(s){ return String(s._id) === String(subtaskId); });
 if (item && !item.titulo) { _showToast('Defina o título da subtarefa antes de solicitar colaboração', 'erro'); return; }
 var form = document.getElementById('drw-colab-form');
 if (!form) return;
 if (!form.classList.contains('open')) _drwColabReqToggleForm();
 var subSel = document.getElementById('drw-colab-subtask');
 if (subSel) subSel.value = String(subtaskId);
 _drwAnchor('comunicacao', null);
 setTimeout(function(){ form.scrollIntoView({ behavior:'smooth', block:'nearest' }); }, 120);
}

// Cache curto (5s) da tabela colaboracao_solicitacoes inteira, compartilhado
// entre _remLoadColabReqs e _dashAppendColabAlerts — os dois rodam no mesmo
// ciclo de boot do Meu Painel e não há motivo para disparar a mesma query
// duas vezes só porque um roda antes do outro.
var _colabReqsCacheData = null;
var _colabReqsCacheTs   = 0;
async function _colabReqsAllCached() {
 var agora = Date.now();
 if (_colabReqsCacheData && (agora - _colabReqsCacheTs) < 5000) return _colabReqsCacheData;
 _colabReqsCacheData = await _colabReqBuscar(null);
 _colabReqsCacheTs   = agora;
 return _colabReqsCacheData;
}

/* Calcula o contador de colaborações pendentes recebidas, usado pelo Painel
 * de Saúde Operacional (_hpRow 'Colaborações pendentes'). A notificação
 * ACIONÁVEL de fato vive na Central de Alertas (sino) — ver _dashAppendColabAlerts —
 * este função não renderiza mais nenhuma lista própria (os ids #dash-colab-list/
 * #rem-colab-badge que ela alimentava nunca existiram em index.html; era
 * código morto que nunca disparava). */
async function _remLoadColabReqs() {
 if (!_currentUser) return;
 var me = _currentUser.email || '';
 var reqs = await _colabReqsAllCached();
 var pendentes = reqs.filter(function(r){ return r.status === 'Pendente' && r.receptor_email === me; }).length;
 window._colabPendCount = pendentes; // usado pelo Painel de Saúde Operacional
}

// ── Abrir/fechar formulário ───────────────────────────────────────────────
function _remOpenNew()    { _remToggleSend(); }   // FIX: função que faltava
function _remToggleSend() {
 var wrap = document.getElementById('rem-send-wrap');
 if (!wrap) return;
 var isOpen = wrap.style.display !== 'none'; // painel nasce com display:none inline; '' (aberto) não é "fechado"
 wrap.style.display = isOpen ? 'none' : '';
 if (!isOpen) {
  var txt = document.getElementById('dash-reminder-text');
  if (txt) setTimeout(function(){ txt.focus(); }, 80);
  _remLoadUsers(); // carrega lista de usuários
  // Popula seletor de atividades com dados em cache
  var ativSel = document.getElementById('rem-ativ-select');
  if (ativSel && _dashAllAtRaw && _dashAllAtRaw.length) {
   var ativos = _dashAllAtRaw.filter(function(a){ return a.status !== 'Feito' && a.status !== 'Concluído' && a.status !== 'Obsoleto'; });
   ativSel.innerHTML = '<option value="">Vincular a uma atividade (opcional)</option>'
    + ativos.map(function(a){ return '<option value="' + a.id + '">' + (a.titulo || '(sem título)') + '</option>'; }).join('');
  }
 }
}

// ── Enviar lembrete ───────────────────────────────────────────────────────
async function _remSendSupabase() {
 var selEl     = document.getElementById('rem-to-select');
 var textEl    = document.getElementById('dash-reminder-text');
 var urgencyEl = document.getElementById('dash-reminder-urgency');
 if (!selEl || !textEl) return;

 var toEmail = selEl.value.trim();
 var textVal = textEl.value.trim();
 if (!toEmail) {
  selEl.style.borderColor = 'var(--red)';
  setTimeout(function(){ selEl.style.borderColor = ''; }, 1400);
  return;
 }
 if (!textVal) {
  textEl.style.borderColor = 'var(--red)';
  setTimeout(function(){ textEl.style.borderColor = ''; }, 1400);
  return;
 }

 var toUser   = _remUsers.find(function(u){ return u.email === toEmail; });
 var toName   = toUser ? (toUser.full_name || toUser.email) : toEmail;
 var me       = (_currentUser && _currentUser.email) || localStorage.getItem('milatec-user-email') || '';
 var fromName = localStorage.getItem('pp-name') || 'Lorena';
 var urgency  = urgencyEl ? urgencyEl.value : 'normal';

 // Atividade vinculada (opcional)
 var ativSel = document.getElementById('rem-ativ-select');
 var ativVal = ativSel ? ativSel.value : '';
 var ativTitulo = ativSel && ativVal ? (ativSel.options[ativSel.selectedIndex] || {}).text : '';

 var { error } = await _sb.from('lembretes').insert({
  from_email: me,
  from_name: fromName,
  to_email: toEmail,
  to_name: toName,
  texto: textVal,
  urgencia: urgency,
  atividade_id: ativVal || null,
  atividade_titulo: ativTitulo && ativVal ? ativTitulo : null
 });

 if (error) { _showToast('Erro ao enviar: ' + _supaErrPt(error.message), 'erro'); return; }

 // Limpar e fechar
 selEl.value  = '';
 textEl.value = '';
 if (urgencyEl) urgencyEl.value = 'normal';
 if (ativSel) ativSel.value = '';
 _remToggleSend();
 _showToast('Lembrete enviado para ' + toName, 'ok');
 if (_remCurrentTab === 'sent') _remLoadSent();
}

// Alias para compatibilidade com botão HTML existente
function _remSend()           { _remSendSupabase(); }  // FIX: função que faltava

// ── Cancelar novo lembrete sem enviar ────────────────────────────────────
function _remCancelNew() {
 var selEl     = document.getElementById('rem-to-select');
 var textEl    = document.getElementById('dash-reminder-text');
 var urgencyEl = document.getElementById('dash-reminder-urgency');
 var ativSel   = document.getElementById('rem-ativ-select');
 if (selEl)     selEl.value  = '';
 if (textEl)    textEl.value = '';
 if (urgencyEl) urgencyEl.value = 'normal';
 if (ativSel)   ativSel.value = '';
 _remToggleSend();
}


/* ── DASHBOARD — TAREFAS (localStorage por usuário) ─────────────────── */
var _dashTasksKey    = '';
var _dashTasks       = [];
var _dashTaskFilter  = 'all'; // estado do filtro ativo: all | hoje | atr | alta | feito


// Widget legado de "tarefas pessoais" em localStorage (pré-Supabase) — sem
// nenhuma tela própria hoje (a lista real de atividades vem de `atividades`
// no Supabase; a criação/edição de tarefas em Meu Painel já grava lá desde
// que este widget foi aposentado). Mantido só para APAGAR, uma única vez,
// qualquer resíduo de sessões antigas — nenhum dado real é perdido, porque
// nada grava mais neste array há muito tempo (ver criação/edição de
// atividades em _submitNewTask, que já é 100% Supabase).
function _dashTasksInit() {
 var user = (localStorage.getItem('pp-name') || 'Lorena').split(' ')[0].toLowerCase();
 _dashTasksKey = 'milatec-tasks-' + user;
 try { localStorage.removeItem(_dashTasksKey); } catch(e) {}
 _dashTasks = [];
}

function _dashTaskPrazo(t) {
 // Deriva prazo de exibição a partir de data_fim
 if (t.done) return { label:'Feito', cls:'prazo-semana' };
 var raw = t.data_fim || t.prazo || '';
 if (!raw) return null;
 if (raw === 'hoje') return { label:'Hoje', cls:'prazo-hoje' };
 if (raw === 'atrasado') return { label:'Atrasado', cls:'prazo-atrasado' };
 // Tenta parse de data ISO (YYYY-MM-DD)
 if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
  var d = new Date(raw + 'T00:00:00');
  var today = new Date(); today.setHours(0,0,0,0);
  if (d < today) return { label:'Atrasado', cls:'prazo-atrasado' };
  if (d.toDateString() === today.toDateString()) return { label:'Hoje', cls:'prazo-hoje' };
  return { label: d.getDate() + '/' + (d.getMonth()+1), cls:'prazo-semana' };
 }
 return { label: raw, cls:'prazo-semana' };
}


/* ── DRAWER DE NOVA ATIVIDADE ─────────────────────────────────────── */
// ID da tarefa em edição — null = modo criação, número = modo edição
var _taskEditId = null;

/* ── AUTO-SAVE (só no modo edição — criar uma atividade nova continua com
   botão explícito, já que não existe linha no banco pra salvar em cima
   antes de "Criar atividade" rodar uma vez). Mudanças de campo chamam
   _taskAutoSaveQueue(patch, immediate); patches se acumulam e saem num
   único .update(), debounced (700ms pra texto digitado, ~imediato pra
   selects/datas/checkboxes) — evita uma request por tecla. ── */
var _taskAutoSavePending = null;
var _taskAutoSaveTimer = null;
var _taskAutoSaveFadeTimer = null;

// Rótulos de campo da atividade — usados tanto na mensagem de conflito
// (concurrency.js) quanto no Histórico (historico.js), pro usuário ler
// "Data de fim" em vez de "data_prazo". Rótulo null = campo técnico/derivado,
// fica fora do histórico pra não virar ruído.
var _ATIVIDADE_CAMPO_LABEL = {
 titulo: 'Nome da atividade', descricao: 'Descrição', status: 'Status',
 prioridade: 'Prioridade', area: 'Área', tipo_atividade: 'Tipo de atividade',
 data_inicio: 'Data de início', data_prazo: 'Data de fim',
 responsavel: 'Responsáveis', obra_id: 'Obra', projeto_id: 'Projeto',
 melhoria_id: 'Melhoria', visibilidade: 'Privacidade', origem: 'Origem',
 concluida_em: 'Concluída em', historico: null, criado_por: null,
 atualizado_por: null, rec_serie_id: null, recorrencia: 'Recorrência',
};
if (typeof _ccRegistrarLabels === 'function') _ccRegistrarLabels('atividades', _ATIVIDADE_CAMPO_LABEL);

function _taskAutoSaveStatus(state, msg) {
 var el = document.getElementById('task-drw-savestatus');
 if (!el) return;
 el.className = 'task-drw-savestatus' + (state ? ' ' + state : '');
 el.textContent = msg || '';
 clearTimeout(_taskAutoSaveFadeTimer);
 if (state === 'saved') {
  _taskAutoSaveFadeTimer = setTimeout(function() {
   if (el.classList.contains('saved')) { el.className = 'task-drw-savestatus'; el.textContent = ''; }
  }, 2500);
 }
}

// Ctrl+Z (scripts/lib/undo-manager.js): snapshot do valor de CADA campo
// antes da primeira mudança de uma janela de patch ainda não enviada — não
// do valor a cada chamada (senão, digitar "Residência Multifamiliar" letra a
// letra guardaria "antes" de cada tecla em vez de uma edição lógica só, ver
// pedido original). Zerado a cada flush bem-sucedido (_taskAutoSaveFlush),
// junto com _taskAutoSavePending — a janela seguinte começa do zero.
var _taskAutoSaveBefore = null;
function _taskAutoSaveQueue(patch, immediate) {
 if (!_taskEditId) return; // modo criação: sem linha no banco ainda, nada a auto-salvar
 if (!_taskAutoSavePending) _taskAutoSaveBefore = {};
 Object.keys(patch).forEach(function(k) {
  if (!(k in _taskAutoSaveBefore)) _taskAutoSaveBefore[k] = window._drwCurrentTask ? window._drwCurrentTask[k] : undefined;
 });
 _taskAutoSavePending = Object.assign(_taskAutoSavePending || {}, patch);
 clearTimeout(_taskAutoSaveTimer);
 _taskAutoSaveStatus('saving', 'Salvando…');
 _taskAutoSaveTimer = setTimeout(_taskAutoSaveFlush, immediate ? 120 : 700);
}

// Campos obrigatórios (mesmo asterisco do formulário de criação,
// _submitNewTask/camposObrig) — levantamento de campos obrigatórios achou
// que aqui no autosave de EDIÇÃO dava pra limpar qualquer um deles (ex.:
// voltar o <select> pra opção em branco, apagar a data) e salvar null sem
// nenhum aviso, mesmo com o asterisco no rótulo prometendo o contrário.
// Mapa campo→{label, elId} pra poder reverter a UI pro valor anterior
// (window._drwCurrentTask, setado em _taskDrawerOpen) quando barra o save.
var _TASK_CAMPOS_OBRIG = {
 titulo:          { label: 'Nome da atividade', elId: 'nt-titulo' },
 tipo_atividade:  { label: 'Tipo de atividade', elId: 'nt-tipo-atividade' },
 area:            { label: 'Área',              elId: 'nt-area' },
 data_inicio:     { label: 'Data de início',    elId: 'nt-dt-inicio' },
 data_prazo:      { label: 'Data de fim',       elId: 'nt-dt-fim' },
};
function _taskAutoSaveFlush() {
 if (!_taskEditId || !_taskAutoSavePending) return;
 var id = _taskEditId, patch = _taskAutoSavePending, before = _taskAutoSaveBefore;
 _taskAutoSavePending = null; _taskAutoSaveBefore = null;
 var bloqueados = [];
 Object.keys(_TASK_CAMPOS_OBRIG).forEach(function(campo) {
  if (!(campo in patch)) return;
  var v = patch[campo];
  if (v != null && String(v).trim() !== '') return;
  bloqueados.push(_TASK_CAMPOS_OBRIG[campo].label);
  delete patch[campo];
  var el = document.getElementById(_TASK_CAMPOS_OBRIG[campo].elId);
  var valorAnterior = window._drwCurrentTask ? window._drwCurrentTask[campo] : null;
  if (el) el.value = valorAnterior || '';
 });
 if (bloqueados.length) {
  _showToast('Campo obrigatório: ' + bloqueados.join(', ') + '. Alteração não foi salva.', 'erro');
 }
 if (!Object.keys(patch).length) { _taskAutoSaveStatus(); return; }
 // updated_at NÃO é mais forjado aqui: quem mantém a coluna é o trigger
 // trg_atividades_updated_at, e é exatamente ela que _ccSave usa como trava
 // otimista. O patch já era incremental (só os campos tocados), então o que
 // faltava era a trava: sem ela, dois usuários editando o MESMO campo da
 // mesma atividade — situação corriqueira no Gestor de Tarefas, que é
 // compartilhado por setor — perdiam a alteração de um deles em silêncio.
 _ccSave('atividades', id, patch).then(function(r) {
  // Só pula a atualização de UI se o usuário JÁ ABRIU OUTRA atividade
  // enquanto salvava (_taskEditId aponta pra outro id) — fechar o painel
  // (_taskEditId vira null) NÃO deve bloquear isso: é o caso mais comum
  // (editar e fechar em seguida) e antes descartava a atualização do cache
  // em memória bem aí, deixando Meu Painel/Gestor de Tarefas com dado velho
  // até um F5.
  if (_taskEditId && String(_taskEditId) !== String(id)) return;
  if (r.semMudanca) { _taskAutoSaveStatus(); return; }
  if (r.excluido) {
   _taskAutoSaveStatus('error', 'Esta atividade foi excluída por outro usuário.');
   return;
  }
  if (r.erro) {
   console.error('[auto-save]', r.erro);
   _taskAutoSaveStatus('error', 'Não foi possível salvar. Sua alteração continua na tela.');
   return;
  }
  if (r.conflito) {
   _taskAutoSaveStatus('error', _ccMsgConflito('atividades', r.campos));
   _showToast(_ccMsgConflito('atividades', r.campos), 'erro');
   // Os dois caches (Gestor e Meu Painel) recebem o estado real do banco,
   // pra a tela parar de mostrar um valor que não foi gravado.
   if (r.atual) _taskApplyPatchEverywhere(id, r.atual);
   return;
  }
  _taskAutoSaveStatus('saved', 'Alterações salvas');
  var applied = r.row || patch;
  // O UPDATE já foi confirmado no banco neste ponto — uma exceção daqui pra
  // baixo (re-render de Meu Painel/Gestor, undo, etc.) NÃO pode voltar a
  // mostrar "Não foi possível salvar": isso mentiria pro usuário sobre o
  // estado real do banco. Só loga, pra não perder o sinal de depuração.
  try {
   _taskApplyPatchEverywhere(id, applied);
   // Mantém window._drwCurrentTask em dia a cada flush — sem isso, uma 2ª
   // edição na mesma sessão do drawer capturaria o "antes" errado em
   // _taskAutoSaveQueue (o valor de quando o drawer abriu, não o da edição
   // anterior), gerando um undo que não bate com o que o usuário via na tela.
   if (window._drwCurrentTask && String(window._drwCurrentTask.id) === String(id)) Object.assign(window._drwCurrentTask, applied);
  } catch (e) { console.error('[auto-save] salvo no banco, mas falhou ao atualizar a tela', e); }
  // Ctrl+Z (undo-manager.js) — uma entrada por flush (não por campo): os
  // campos tocados dentro da MESMA janela de debounce viram uma única
  // "edição lógica", igual ao pedido original. Só entra na pilha se algo
  // realmente mudou (evita empurrar uma edição no-op no histórico curto).
  if (typeof _umPush === 'function' && typeof _umActiveScope !== 'undefined' && _umActiveScope && before) {
   var changedKeys = Object.keys(patch).filter(function(k) { return String(patch[k]) !== String(before[k]); });
   if (changedKeys.length) {
    var beforeVals = {}, afterVals = {};
    changedKeys.forEach(function(k) { beforeVals[k] = before[k]; afterVals[k] = patch[k]; });
    var labels = changedKeys.map(function(k) { return _ATIVIDADE_CAMPO_LABEL[k]; }).filter(Boolean);
    var label = labels.length === 1 ? labels[0] : (labels.length ? labels.length + ' campos' : null);
    _umPush(_umActiveScope, { label: label, before: beforeVals, after: afterVals, apply: function(v) { return _taskUndoApply(id, v); } });
   }
  }
 }).catch(function(e) {
  if (_taskEditId && String(_taskEditId) !== String(id)) return;
  console.error('[auto-save]', e);
  _taskAutoSaveStatus('error', 'Não foi possível salvar. Sua alteração continua na tela.');
 });
}

// Reaproveitado pelo Ctrl+Z/Ctrl+Shift+Z (undo-manager.js) — mesma escrita
// que o flush normal já faz (_ccSave + _taskApplyPatchEverywhere), só que
// fora do fluxo de debounce (chamada direta, valores já resolvidos). Se o
// drawer ainda estiver aberto na MESMA atividade, reabre pra quem está com
// o painel na tela ver o valor restaurado sem precisar fechar e abrir de novo.
function _taskUndoApply(id, values) {
 return _ccSave('atividades', id, values).then(function(r) {
  if (!r || r.erro) throw (r && r.erro) || new Error('Falha ao salvar');
  if (r.excluido) throw new Error('Atividade excluída por outro usuário');
  if (r.conflito) {
   _showToast(_ccMsgConflito('atividades', r.campos), 'erro');
   if (r.atual) _taskApplyPatchEverywhere(id, r.atual);
   throw new Error('Conflito de edição concorrente');
  }
  var applied = r.row || values;
  // Mesmo raciocínio de _taskAutoSaveFlush: o UPDATE do undo já foi
  // confirmado no banco aqui — um erro de re-render não pode virar um "undo
  // falhou" pro usuário (undo-manager.js mostra erro só se esta promise
  // rejeitar).
  try {
   _taskApplyPatchEverywhere(id, applied);
   if (window._drwCurrentTask && String(window._drwCurrentTask.id) === String(id)) Object.assign(window._drwCurrentTask, applied);
   if (_taskEditId && String(_taskEditId) === String(id)) _taskDrawerOpen(id);
  } catch (e) { console.error('[undo] salvo no banco, mas falhou ao atualizar a tela', e); }
 });
}

// Única fonte de verdade: _gestorAllAt (Gestor de Tarefas) e _dashAllAtRaw
// (Meu Painel) guardam a MESMA atividade em dois caches independentes —
// depois de qualquer save bem-sucedido, aplica o patch nos dois e
// re-renderiza tudo que é derivado deles (sem nenhuma consulta nova).
function _taskApplyPatchEverywhere(id, patch) {
 // `patch` pode vir cru do Postgrest (r.row, ex.: responsavel como array de
 // e-mails) enquanto o cache guarda a atividade "enriquecida" (responsavel
 // como string de nomes, ver _enrichAtividades). Reenriquecer aqui evita que
 // um save deixe a tela mostrando e-mail cru até um F5 — a função já é
 // idempotente (só converte se ainda for array).
 var gIdx = (typeof _gestorAllAt !== 'undefined') ? _gestorAllAt.findIndex(function(x){ return String(x.id) === String(id); }) : -1;
 if (gIdx !== -1) {
  Object.assign(_gestorAllAt[gIdx], patch);
  if (typeof _enrichAtividades === 'function') _enrichAtividades([_gestorAllAt[gIdx]]);
  if (typeof _gestorApplyFilters === 'function') _gestorApplyFilters();
 }
 var dIdx = (_dashAllAtRaw||[]).findIndex(function(x){ return String(x.id) === String(id); });
 if (dIdx !== -1) {
  Object.assign(_dashAllAtRaw[dIdx], patch);
  if (typeof _enrichAtividades === 'function') _enrichAtividades([_dashAllAtRaw[dIdx]]);
  _dashRerenderAllFromCache();
 }
}

// Recalcula feed/KPIs/gráficos do Meu Painel a partir de _dashAllAtRaw (já
// atualizado) — sem refetch. areaAt/semAt (usados só nos gráficos) são
// simples recortes de colunas que _dashAllAtRaw já tem, então não precisam
// de cache próprio: derivar na hora é a mesma coisa e mantém uma única
// fonte de verdade de verdade.
function _dashRerenderAllFromCache() {
 if (!Array.isArray(_dashAllAtRaw)) return;
 var allAt = _dashAllAtRaw;
 var hoje = new Date(); hoje.setHours(0,0,0,0);

 var feedData = allAt
  .filter(function(a){ return a.status !== 'Feito' && a.status !== 'Concluído' && a.status !== 'Obsoleto'; })
  .sort(function(a,b){
   var dA = a.data_prazo ? new Date(a.data_prazo+'T00:00:00').getTime() : Infinity;
   var dB = b.data_prazo ? new Date(b.data_prazo+'T00:00:00').getTime() : Infinity;
   var atA = dA < hoje.getTime() ? 0 : 1;
   var atB = dB < hoje.getTime() ? 0 : 1;
   if (atA !== atB) return atA - atB;
   return dA - dB;
  })
  .slice(0, 15);
 _dashFeedRaw = feedData;
 if (typeof _dashRenderFeed === 'function') _dashRenderFeed(_dashApplyPrivFiltro(_dashFeedRaw));

 if (typeof _dashUpdateKPIsFromDB === 'function') _dashUpdateKPIsFromDB(allAt);
 // Reconsulta a RPC (barata, uma linha) em vez de recalcular Atrasadas/Em
 // Andamento/A Fazer localmente aqui — mantém a mesma fonte de verdade do
 // boot e do Gestor de Tarefas depois de um auto-save.
 if (typeof _dashLoadKpisRpc === 'function') _dashLoadKpisRpc();
 var amanha14 = new Date(hoje); amanha14.setDate(hoje.getDate()+14);
 var prox14 = allAt.filter(function(a){
  var d = a.data_prazo ? new Date(a.data_prazo+'T00:00:00') : null;
  return d && d >= hoje && d <= amanha14 && a.status !== 'Feito' && a.status !== 'Concluído';
 }).length;
 var total = allAt.length;
 var feitas = allAt.filter(function(a){ return a.status === 'Feito' || a.status === 'Concluído'; }).length;
 var taxaPct = total > 0 ? Math.round(feitas * 100 / total) : 0;
 var kP = document.getElementById('dash-kpi-prox'); if (kP) kP.textContent = prox14;
 var kC = document.getElementById('dash-kpi-conclusao'); if (kC) kC.textContent = taxaPct + '%';

 window._dashAlertsData = allAt;
 if (typeof _dashBuildAlertsFromDB === 'function') _dashBuildAlertsFromDB(allAt);

 if (typeof _dashRenderChartAreas === 'function') {
  _dashRenderChartAreas(allAt.map(function(a){ return { area: a.area, status: a.status }; }));
 }
 if (typeof _dashRenderChartSemanas === 'function') {
  var dozeMeses = new Date(); dozeMeses.setFullYear(dozeMeses.getFullYear() - 1);
  var dozeMesesStr = dozeMeses.toISOString().substring(0,10);
  var semAtDerivado = allAt
   .filter(function(a){ return (a.status === 'Feito' || a.status === 'Concluído') && a.data_prazo && a.data_prazo >= dozeMesesStr; })
   .map(function(a){ return { data_prazo: a.data_prazo, status: a.status, updated_at: a.updated_at }; })
   .sort(function(x,y){ return (x.data_prazo||'').localeCompare(y.data_prazo||''); });
  _dashSemanasRaw = semAtDerivado;
  _dashRenderChartSemanas(semAtDerivado);
 }
 if (typeof _dashRenderChartStatus === 'function') _dashRenderChartStatus(allAt);
}

// Chamado ao fechar o drawer: se ainda houver um patch pendente (debounce não
// disparou a tempo), salva na hora em vez de descartar a alteração.
function _taskAutoSaveFlushNow() {
 if (_taskAutoSavePending) { clearTimeout(_taskAutoSaveTimer); _taskAutoSaveFlush(); }
}

// Mostra a data selecionada em dd/mm/yyyy explícito ao lado do input nativo
// type="date" — a formatação exibida DENTRO do input nativo segue o locale
// do navegador/SO (não é controlável via lang/CSS), então este label garante
// leitura em pt-BR independente do ambiente do usuário.
function _ntDateFmtSync(inputId) {
 var el  = document.getElementById(inputId);
 var out = document.getElementById(inputId + '-fmt');
 if (!el || !out) return;
 var v = el.value; // sempre yyyy-mm-dd (ISO), independente do locale de exibição
 if (!v) { out.textContent = ''; return; }
 var d = new Date(v + 'T00:00:00');
 if (isNaN(d.getTime())) { out.textContent = ''; return; }
 out.textContent = d.toLocaleDateString('pt-BR', {day:'2-digit',month:'2-digit',year:'numeric'});
}

function _taskDrawerOpen(editId) {
 _taskEditId = editId || null;
 // Procura primeiro nas tarefas locais (sistema legado) e depois nas atividades reais
 // carregadas do Supabase (Gestor de Tarefas / Meu Painel) — necessário para que a aba
 // de Subtarefas carregue corretamente ao editar uma atividade real.
 var t = _taskEditId ? _dashTasks.find(function(x){ return String(x.id) === String(_taskEditId); }) : null;
 if (!t && _taskEditId && Array.isArray(_gestorAllAt)) {
  t = _gestorAllAt.find(function(x){ return String(x.id) === String(_taskEditId); });
 }
 if (!t && _taskEditId && Array.isArray(_dashAllAtRaw)) {
  t = _dashAllAtRaw.find(function(x){ return String(x.id) === String(_taskEditId); });
 }

 var ttlEl = document.getElementById('task-drw-ttl');
 var btnEl = document.getElementById('task-drw-submit-btn');
 var cnlEl = document.getElementById('task-drw-cancel-btn');
 var delEl = document.getElementById('task-drw-del-btn');
 if (ttlEl) ttlEl.textContent = t ? 'Editar atividade' : 'Nova atividade';
 // Editar: tudo salva sozinho (ver _taskAutoSave*), então não existe mais
 // botão "Salvar alterações" nem "Cancelar" (não há o que descartar).
 if (btnEl) btnEl.style.display = t ? 'none' : '';
 if (cnlEl) cnlEl.textContent = t ? 'Fechar' : 'Cancelar';
 if (delEl) delEl.style.display = t ? '' : 'none'; // só em modo edição local
 _taskAutoSaveStatus(); // limpa qualquer status de uma edição anterior

 var get = function(id){ return document.getElementById(id); };
 var set = function(id, val){ var el = get(id); if (el) el.value = val || ''; };

 // ── Aba Geral ──
 set('nt-titulo',        t ? t.titulo        : '');
 set('nt-observacoes',   t ? t.observacoes   : '');
 set('nt-dt-inicio',     t ? t.data_inicio   : '');
 set('nt-dt-fim',        t ? t.data_prazo    : '');
 _ntDateFmtSync('nt-dt-inicio');
 _ntDateFmtSync('nt-dt-fim');
 var respVal = t ? (t.responsavel || '') : (localStorage.getItem('pp-name') || 'Lorena').split(' ')[0];
 _respLoadUsers().then(function(){ _respSetFromString(respVal); }).catch(function(){ _respSetFromString(respVal); });
 if (!t) _respSetFromString(respVal);
 var prioEl   = get('nt-prioridade');
 var stEl     = get('nt-status');
 var tipoAtEl = get('nt-tipo-atividade');
 var areaEl   = get('nt-area');
 if (prioEl)   prioEl.value   = t ? (t.prioridade     || 'Média')   : 'Média';
 if (stEl)     { stEl.value   = t ? (t.status          || 'A fazer') : 'A fazer'; _selColorize(stEl, _SEL_TASK_STATUS_COR); }
 if (tipoAtEl) {
  var _tv = t ? (t.tipo_atividade || t.tipo || '') : '';
  tipoAtEl.value = _tv;
  if (_tv && !tipoAtEl.value) {
   var _lc = _tv.toLowerCase();
   for (var _oi = 0; _oi < tipoAtEl.options.length; _oi++) {
    if (tipoAtEl.options[_oi].value.toLowerCase() === _lc) { tipoAtEl.value = tipoAtEl.options[_oi].value; break; }
   }
  }
 }
 if (areaEl)   areaEl.value   = t ? (t.area            || '')        : '';

 // ── Aba Relacionamentos ──
 _ntPopulateVinculos(t);

 // ── Privacidade ──
 if (t && t.id) {
  _ntPrivacidadeSet(t.visibilidade || 'equipe', []); // estado provisório enquanto carrega
  _privLoadSharesParaEdicao(t.id).then(function(shares) {
   _ntPrivacidadeSet(t.visibilidade || 'equipe', shares);
  });
 } else {
  _ntPrivacidadeSet('equipe', []);
 }

 // Guardar referência da tarefa atual para colaboração
 window._drwCurrentTask = t || null;
 // Baseline da trava otimista (ver concurrency.js): estado da atividade como
 // ela está no banco no momento em que o drawer abriu. É contra ele que
 // _ccSave decide o que gravar e detecta a escrita concorrente de outro
 // usuário. `t` vem dos caches _gestorAllAt/_dashAllAtRaw, que já trazem
 // updated_at no select — que é justamente a coluna da trava.
 if (t && t.id && typeof _ccSetBaseline === 'function') _ccSetBaseline('atividades', t.id, t);

 // ── Aba Comunicação ──
 var histWrap = get('drw-hist-wrap');
 var histList = get('drw-hist-list');
 if (t && t.historico && t.historico.length && histWrap && histList) {
  histWrap.style.display = '';
  histList.innerHTML = t.historico.slice(-10).reverse().map(function(h){
   return '<div style="padding:4px 0;border-bottom:1px solid var(--border)">'
    + '<span style="font-weight:600;color:var(--text)">' + (h.usuario||'?') + '</span>'
    + ' <span style="color:var(--muted)">' + (h.acao||'') + '</span>'
    + '<div style="font-size:10px;color:var(--muted);margin-top:1px">' + (h.data ? new Date(h.data).toLocaleString('pt-BR') : '') + '</div>'
    + '</div>';
  }).join('');
 } else if (histWrap) { histWrap.style.display = 'none'; }
 // Seção de Colaboração: sempre visível, inclusive criando uma atividade
 // nova — colaborar numa subtarefa específica (ver _drwColabReqOpenForSubtask)
 // precisa estar alcançável desde a criação, senão a pessoa nem enxerga a
 // opção. O que exige a atividade já salva (atividade_id real no banco) é
 // só a AÇÃO de enviar o pedido — isso já tem seu próprio aviso
 // ("Salve a atividade antes de solicitar colaboração") em
 // _drwColabReqEnviar/_drwColabReqOpenForSubtask, não a seção inteira.
 var colabWrap = get('drw-colab-req-wrap');
 if (colabWrap) {
  colabWrap.style.display = '';
  _drwColabReqCancel();
  if (t) {
   _drwColabReqRender(t.id);
  } else {
   var listEl = get('drw-colab-req-list');
   if (listEl) listEl.innerHTML = '<div style="font-size:11px;color:var(--muted);padding:10px 0;text-align:center">Salve a atividade pra poder solicitar colaborações.</div>';
  }
 }

 // ── Aba Subtarefas ──
 _drwSubItems = t && Array.isArray(t.subtasks)
  ? t.subtasks.map(function(s) {
    return {
     _id:    s.id || s._id || Date.now(),
     titulo: s.titulo || '',
     done:   !!(s.done || s.status === 'Concluído')
    };
   })
  : [];
 _drwSubRender();

 // ── Seção Auditoria (só no modo edição — atividade nova ainda não existe) ──
 var auditTab  = get('drw-tab-auditoria');
 var auditPane = get('drw-pane-auditoria');
 var auditBody = get('drw-audit-body');
 if (t && auditTab && auditBody) {
  auditTab.style.display = '';
  if (auditPane) auditPane.style.display = '';
  // As colunas reais em `atividades` são criado_por/atualizado_por (mantidas
  // pelos triggers set_atividades_atualizado_por e afins). Este bloco lia
  // t.created_by/t.updated_by, que não existem em lugar nenhum — por isso
  // "Criado por"/"Última alteração por" mostravam sempre "—". Os nomes
  // antigos ficam como fallback pra não quebrar nada que ainda os popule.
  var criador  = t.criado_por     || t.created_by || t.responsavel || '—';
  var updBy    = t.atualizado_por || t.updated_by || '—';
  var origem   = t.origem      || 'Dashboard';
  var criadoEm = t.created_at  ? new Date(t.created_at).toLocaleString('pt-BR') : '—';
  auditBody.innerHTML =
   '<div class="drw-audit-row"><span class="drw-audit-lbl">Criado por</span><span class="drw-audit-val">' + _histEsc(_histNome(criador)) + '</span></div>'
   + '<div class="drw-audit-row"><span class="drw-audit-lbl">Data de criação</span><span class="drw-audit-val">' + criadoEm + '</span></div>'
   + '<div class="drw-audit-row"><span class="drw-audit-lbl">Última alteração por</span><span class="drw-audit-val">' + _histEsc(_histNome(updBy)) + '</span></div>'
   + '<div class="drw-audit-row"><span class="drw-audit-lbl">Origem</span><span class="drw-audit-val">' + _histEsc(origem) + '</span></div>'
   // Histórico de alterações campo a campo — mesmo componente compartilhado
   // de Obra/Projeto/Entrega/Empresa (scripts/lib/historico.js). A tabela
   // atividades já era auditada pelo trigger trg_atividades_audit; faltava só
   // a permissão de leitura, liberada na migração desta fase.
   + '<div style="margin-top:18px;border-top:1px solid var(--border);padding-top:12px">'
   + '<div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:10px">Histórico de alterações</div>'
   + (typeof _histPanelHTML === 'function' ? _histPanelHTML('drw-audit-historico') : '')
   + '</div>';
  if (typeof _histCarregar === 'function') _histCarregar('drw-audit-historico', 'atividades', t.id);
 } else {
  if (auditTab) auditTab.style.display = 'none';
  if (auditPane) auditPane.style.display = 'none';
 }

 // ── Reset: voltar ao topo (seção Geral), limpar erros ──
 var body0 = get('task-drw-body');
 if (body0) body0.scrollTop = 0;
 document.querySelectorAll('.drw-tab').forEach(function(b){ b.classList.remove('active'); });
 var firstTab = document.querySelector('.drw-tab');
 if (firstTab) firstTab.classList.add('active');
 ['nt-titulo','nt-tipo-atividade','nt-area','nt-dt-inicio','nt-dt-fim'].forEach(function(id){
  var el = get(id);
  if (el) { el.style.borderColor = ''; el.style.boxShadow = ''; }
 });
 _drwSpyInit();
 var respBoxReset = get('nt-resp-box');
 if (respBoxReset) { respBoxReset.style.borderColor = ''; respBoxReset.style.boxShadow = ''; }

 var drw = get('task-drw');
 var bd  = get('drw-backdrop-task');
 if (drw) drw.classList.add('open');
 if (bd)  bd.classList.add('open');
 setTimeout(function(){ var inp = get('nt-titulo'); if(inp) inp.focus(); }, 260);
}

/* ── MULTI-SELECT DE RESPONSÁVEIS ────────────────────────────────────────── */
var _respSelecionados = []; // [{email, nome, iniciais}]
var _respUsuarios     = []; // lista carregada do Supabase

async function _respLoadUsers() {
 if (_respUsuarios.length > 0) return;
 // Lê direto da tabela `usuarios` (liberada pra qualquer autenticado) em vez
 // da Edge Function auth-admin — achado real: listar-usuarios ali exige
 // admin, então qualquer usuário comum via "Nenhum usuário encontrado" ao
 // tentar escolher responsável ou compartilhar uma atividade privada.
 try {
  var res = await _sb.from('usuarios').select('id, email, nome_display, avatar_url, cargo, departamento, created_at');
  if (res.error || !res.data) return;
  _respUsuarios = res.data.map(function(row) {
   var nome = row.nome_display || (row.email || '').split('@')[0];
   var iniciais = nome.split(' ').slice(0,2).map(function(p){return p[0]||'';}).join('').toUpperCase();
   return {
    id: row.id || '', email: row.email, nome: nome, iniciais: iniciais,
    avatar: row.avatar_url || null,
    // Usados pelo cartão de info do usuário (clique com botão direito no avatar)
    cargo: row.cargo || '', departamento: row.departamento || '', criadoEm: row.created_at || '',
   };
  });
  _respRenderList('');
 } catch(e) {}
}

function _respToggleDrop() {
 var drop = document.getElementById('nt-resp-drop');
 if (!drop) return;
 var open = drop.style.display !== 'none';
 drop.style.display = open ? 'none' : 'block';
 if (!open) {
  _respLoadUsers();
  setTimeout(function(){ var s = document.getElementById('nt-resp-search'); if(s) s.focus(); }, 80);
 }
}

function _respFilter(q) {
 _respRenderList(q);
}

function _respRenderList(q) {
 var listEl = document.getElementById('nt-resp-list');
 if (!listEl) return;
 var norm = (q || '').toLowerCase();
 var filtrado = _respUsuarios.filter(function(u) {
  return !norm || u.nome.toLowerCase().includes(norm) || u.email.toLowerCase().includes(norm);
 });
 if (!filtrado.length) {
  listEl.innerHTML = '<div style="padding:10px 12px;font-size:12px;color:var(--muted)">Nenhum usuário encontrado</div>';
  return;
 }
 listEl.innerHTML = filtrado.map(function(u) {
  var sel = _respSelecionados.some(function(s){ return s.email === u.email; });
  return '<div onclick="_respToggleUser(\'' + u.email.replace(/'/g,"\\'") + '\',\'' + u.nome.replace(/'/g,"\\'") + '\',\'' + u.iniciais + '\')" style="display:flex;align-items:center;gap:8px;padding:7px 12px;cursor:pointer;background:' + (sel ? 'var(--navy-dim)' : 'transparent') + ';transition:background .1s" onmouseover="this.style.background=\'' + (sel?'var(--navy-dim)':'var(--surface2)') + '\'" onmouseout="this.style.background=\'' + (sel?'var(--navy-dim)':'transparent') + '\'">'
   + _userAvatarHTML(u, 28)
   + '<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:500;color:var(--text)">' + u.nome + '</div><div style="font-size:10px;color:var(--muted)">' + u.email + '</div></div>'
   + (sel ? '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="var(--navy)" stroke-width="2"><polyline points="1,6 4.5,9.5 11,2.5"/></svg>' : '')
   + '</div>';
 }).join('');
}

function _respAutoSaveResponsaveis() {
 if (!_taskEditId) return; // criação: fica só no estado local até "Criar atividade"
 var emails = _respSelecionados.map(function(u){ return u.email; }).filter(Boolean);
 _taskAutoSaveQueue({ responsavel: emails }, true);
 _syncAtividadeResponsaveis(_taskEditId, emails);
}

function _respToggleUser(email, nome, iniciais) {
 var idx = _respSelecionados.findIndex(function(s){ return s.email === email; });
 if (idx >= 0) {
  // Responsáveis é obrigatório (asterisco no rótulo, nt-responsavel) —
  // não deixa remover o último restante.
  if (_respSelecionados.length <= 1) { _showToast('Responsáveis é obrigatório — mantenha ao menos 1 pessoa.', 'erro'); return; }
  _respSelecionados.splice(idx, 1);
 } else {
  _respSelecionados.push({ email: email, nome: nome, iniciais: iniciais });
 }
 _respUpdateBox();
 _respRenderList(document.getElementById('nt-resp-search') ? document.getElementById('nt-resp-search').value : '');
 _respAutoSaveResponsaveis();
}

function _respRemoveUser(email) {
 var idx = _respSelecionados.findIndex(function(s){ return s.email === email; });
 if (idx === -1) return;
 if (_respSelecionados.length <= 1) { _showToast('Responsáveis é obrigatório — mantenha ao menos 1 pessoa.', 'erro'); return; }
 _respSelecionados.splice(idx, 1);
 _respUpdateBox();
 var search = document.getElementById('nt-resp-search');
 _respRenderList(search ? search.value : '');
 _respAutoSaveResponsaveis();
}

/* ── PRIVACIDADE DA ATIVIDADE ("Pessoas específicas") ────────────────────── */
var _privSelecionados = []; // [{id, email, nome, iniciais}] — usuários extras com acesso

function _ntPrivacidadeChange() {
 var sel = document.getElementById('nt-privacidade');
 var wrap = document.getElementById('nt-priv-especificos-wrap');
 if (!sel || !wrap) return;
 wrap.style.display = sel.value === 'privada_especificos' ? '' : 'none';
 if (sel.value === 'privada_especificos') _respLoadUsers().catch(function(){});
}

function _privToggleDrop() {
 var drop = document.getElementById('nt-priv-drop');
 if (!drop) return;
 var open = drop.style.display !== 'none';
 drop.style.display = open ? 'none' : 'block';
 if (!open) {
  _respLoadUsers().then(function(){ _privRenderList(''); }).catch(function(){ _privRenderList(''); });
  setTimeout(function(){ var s = document.getElementById('nt-priv-search'); if(s) s.focus(); }, 80);
 }
}

function _privFilter(q) { _privRenderList(q); }

function _privRenderList(q) {
 var listEl = document.getElementById('nt-priv-list');
 if (!listEl) return;
 var norm = (q || '').toLowerCase();
 var filtrado = _respUsuarios.filter(function(u) {
  return !norm || u.nome.toLowerCase().includes(norm) || u.email.toLowerCase().includes(norm);
 });
 if (!filtrado.length) {
  listEl.innerHTML = '<div style="padding:10px 12px;font-size:12px;color:var(--muted)">Nenhum usuário encontrado</div>';
  return;
 }
 listEl.innerHTML = filtrado.map(function(u) {
  var sel = _privSelecionados.some(function(s){ return s.email === u.email; });
  return '<div onclick="_privToggleUser(\'' + (u.id||'').replace(/'/g,"\\'") + '\',\'' + u.email.replace(/'/g,"\\'") + '\',\'' + u.nome.replace(/'/g,"\\'") + '\',\'' + u.iniciais + '\')" style="display:flex;align-items:center;gap:8px;padding:7px 12px;cursor:pointer;background:' + (sel ? 'var(--navy-dim)' : 'transparent') + '">'
   + _userAvatarHTML(u, 28)
   + '<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:500;color:var(--text)">' + u.nome + '</div><div style="font-size:10px;color:var(--muted)">' + u.email + '</div></div>'
   + (sel ? '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="var(--navy)" stroke-width="2"><polyline points="1,6 4.5,9.5 11,2.5"/></svg>' : '')
   + '</div>';
 }).join('');
}

function _privToggleUser(id, email, nome, iniciais) {
 var idx = _privSelecionados.findIndex(function(s){ return s.email === email; });
 if (idx >= 0) { _privSelecionados.splice(idx, 1); }
 else { _privSelecionados.push({ id: id, email: email, nome: nome, iniciais: iniciais }); }
 _privUpdateBox();
 _privRenderList(document.getElementById('nt-priv-search') ? document.getElementById('nt-priv-search').value : '');
 _ntAutoSavePrivacidade();
}

function _privRemoveUser(email) {
 var idx = _privSelecionados.findIndex(function(s){ return s.email === email; });
 if (idx === -1) return;
 _privSelecionados.splice(idx, 1);
 _privUpdateBox();
 _ntAutoSavePrivacidade();
}

// visibilidade é coluna de atividades (vai por _taskAutoSaveQueue); a lista
// de pessoas com acesso ("privada_especificos") vive em
// atividades_compartilhamento, sincronizada à parte por _privSaveShares.
function _ntAutoSavePrivacidade() {
 if (!_taskEditId) return; // criação: sincroniza só depois de "Criar atividade"
 var privModo = (document.getElementById('nt-privacidade') || {}).value || 'equipe';
 var privVisibilidade = privModo === 'equipe' ? 'equipe' : 'privada';
 var privShares = privModo === 'privada_especificos' ? _privSelecionados.slice() : [];
 _taskAutoSaveQueue({ visibilidade: privVisibilidade }, true);
 _privSaveShares(_taskEditId, privModo, privShares);
}

function _privUpdateBox() {
 var box = document.getElementById('nt-priv-box');
 var ph = document.getElementById('nt-priv-placeholder');
 var hid = document.getElementById('nt-privacidade-shares');
 if (!box) return;
 Array.from(box.querySelectorAll('.resp-tag')).forEach(function(el){ el.remove(); });
 if (_privSelecionados.length === 0) {
  if (ph) ph.style.display = '';
 } else {
  if (ph) ph.style.display = 'none';
  _privSelecionados.forEach(function(u) {
   var tag = document.createElement('span');
   tag.className = 'resp-tag';
   tag.style.cssText = 'display:inline-flex;align-items:center;gap:4px;background:var(--navy-dim);border:1px solid rgba(91,91,214,.3);border-radius:5px;padding:2px 4px 2px 6px;font-size:11px;color:var(--navy);font-weight:500';
   tag.innerHTML = _userAvatarHTML(u, 18) + u.nome
    + '<button type="button" onclick="event.stopPropagation();_privRemoveUser(\'' + u.email.replace(/'/g,"\\'") + '\')" title="Remover" style="display:flex;align-items:center;justify-content:center;width:14px;height:14px;border:none;background:none;color:var(--navy);opacity:.6;cursor:pointer;padding:0;margin-left:1px;border-radius:3px">&times;</button>';
   box.insertBefore(tag, ph);
  });
 }
 if (hid) hid.value = _privSelecionados.map(function(u){ return u.email; }).join(',');
}

// Persiste o compartilhamento explícito da atividade (privacidade "Pessoas específicas")
function _privSaveShares(atividadeId, modo, sharesArr) {
 if (!_sb || !atividadeId) return Promise.resolve();
 return _sb.from('atividades_compartilhamento').delete().eq('atividade_id', atividadeId).then(function(delRes) {
  if (delRes.error) throw delRes.error;
  if (modo !== 'privada_especificos' || !sharesArr || !sharesArr.length) return;
  var rows = sharesArr.filter(function(u){ return u.id; }).map(function(u){ return { atividade_id: atividadeId, usuario_id: u.id }; });
  if (!rows.length) return;
  return _sb.from('atividades_compartilhamento').insert(rows).then(function(insRes) {
   if (insRes.error) throw insRes.error;
  });
 }).catch(function(e){
  console.error('[Privacidade] erro ao salvar compartilhamento:', e);
  if (typeof _showToast === 'function') _showToast('Erro ao salvar quem pode ver esta atividade — o compartilhamento pode não ter sido aplicado.', 'erro');
 });
}

// Carrega o compartilhamento existente de uma atividade (para preencher o drawer na edição)
async function _privLoadSharesParaEdicao(atividadeId) {
 if (!_sb || !atividadeId) return [];
 try {
  var res = await _sb.from('atividades_compartilhamento').select('usuario_id').eq('atividade_id', atividadeId);
  if (res.error || !res.data || !res.data.length) return [];
  var ids = res.data.map(function(r){ return r.usuario_id; });
  var ur = await _sb.from('usuarios').select('id, email, nome_display').in('id', ids);
  if (ur.error || !ur.data) return [];
  return ur.data.map(function(u){ return { id: u.id, email: u.email, nome: u.nome_display || u.email }; });
 } catch(e) { return []; }
}

// Preenche o controle de privacidade ao abrir a gaveta para edição
function _ntPrivacidadeSet(visibilidade, sharesArr) {
 var sel = document.getElementById('nt-privacidade');
 _privSelecionados = [];
 (sharesArr || []).forEach(function(s) {
  var found = _respUsuarios.find(function(u){ return u.email === s.email; });
  _privSelecionados.push(found || { email: s.email, nome: s.nome || s.email, iniciais: (s.nome||s.email).charAt(0).toUpperCase() });
 });
 _privUpdateBox();
 var modo = 'equipe';
 if (visibilidade === 'privada') modo = (sharesArr && sharesArr.length) ? 'privada_especificos' : 'privada_so_eu';
 if (sel) sel.value = modo;
 _ntPrivacidadeChange();
}

function _respUpdateBox() {
 var box = document.getElementById('nt-resp-box');
 var ph  = document.getElementById('nt-resp-placeholder');
 var hid = document.getElementById('nt-responsavel');
 if (!box) return;
 // Remove tags antigas
 Array.from(box.querySelectorAll('.resp-tag')).forEach(function(el){ el.remove(); });
 if (_respSelecionados.length === 0) {
  if (ph) ph.style.display = '';
 } else {
  if (ph) ph.style.display = 'none';
  _respSelecionados.forEach(function(u) {
   var tag = document.createElement('span');
   tag.className = 'resp-tag';
   tag.style.cssText = 'display:inline-flex;align-items:center;gap:4px;background:var(--navy-dim);border:1px solid rgba(91,91,214,.3);border-radius:5px;padding:2px 4px 2px 6px;font-size:11px;color:var(--navy);font-weight:500';
   tag.innerHTML = _userAvatarHTML(u, 18) + u.nome
    + '<button type="button" onclick="event.stopPropagation();_respRemoveUser(\'' + u.email.replace(/'/g,"\\'") + '\')" title="Remover" style="display:flex;align-items:center;justify-content:center;width:14px;height:14px;border:none;background:none;color:var(--navy);opacity:.6;cursor:pointer;padding:0;margin-left:1px;border-radius:3px">&times;</button>';
   box.insertBefore(tag, ph);
  });
 }
 // Atualiza campo hidden com emails separados por vírgula
 if (hid) hid.value = _respSelecionados.map(function(u){ return u.nome; }).join(', ');
}

function _respSetFromString(val) {
 _respSelecionados = [];
 if (!val) { _respUpdateBox(); return; }
 // val pode ser "Nome1, Nome2" ou email
 var partes = val.split(',').map(function(p){ return p.trim(); }).filter(Boolean);
 partes.forEach(function(p) {
  // tenta encontrar nos usuários carregados — nome exato, e-mail, ou nome
  // normalizado (sem acento/caixa) para cobrir divergências de cadastro
  var pNorm = _normName(p);
  var pPrimeiro = _normName(p.split(' ')[0]);
  var found = _respUsuarios.find(function(u){
   return u.nome === p || u.email === p
    || _normName(u.nome) === pNorm
    || _normName(u.nome.split(' ')[0]) === pPrimeiro;
  });
  if (found) {
   _respSelecionados.push(found);
  } else {
   // fallback: cria entrada manual (pessoa sem login no sistema)
   var iniciais = p.split(' ').slice(0,2).map(function(x){return x[0]||'';}).join('').toUpperCase() || 'U';
   _respSelecionados.push({ email: p, nome: p, iniciais: iniciais });
  }
 });
 _respUpdateBox();
}

// Fechar dropdown ao clicar fora
document.addEventListener('click', function(e) {
 var drop = document.getElementById('nt-resp-drop');
 var box  = document.getElementById('nt-resp-box');
 if (drop && box && !box.contains(e.target) && !drop.contains(e.target)) {
  drop.style.display = 'none';
 }
 // Fechar searchable select de obra ao clicar fora
 var obraDrop = document.getElementById('nt-obra-drop');
 var obraBox  = document.getElementById('nt-obra-box');
 if (obraDrop && obraBox && !obraBox.contains(e.target) && !obraDrop.contains(e.target)) {
  _obraSearchClose();
 }
});

function _taskDrawerClose() {
 // Fechar o painel não pode descartar uma alteração que ainda não tinha
 // disparado o debounce do auto-save — força salvar agora, antes de zerar
 // _taskEditId (senão _taskAutoSaveFlush não teria mais o id da atividade).
 _taskAutoSaveFlushNow();
 var drw = document.getElementById('task-drw');
 var bd  = document.getElementById('drw-backdrop-task');
 if (drw) drw.classList.remove('open');
 if (bd)  bd.classList.remove('open');
 _taskEditId = null;
 window._drwCurrentTask = null;
 // Fechar e limpar multi-select
 var drop = document.getElementById('nt-resp-drop');
 if (drop) drop.style.display = 'none';
 // Fechar searchable obra select
 _obraSearchClose();
}

/* ── Excluir atividade ───────────────────────────────────────────────────── */
function _taskDelete() {
 if (!_taskEditId) return;
 var titulo = (document.getElementById('nt-titulo') || {}).value || 'esta atividade';
 if (!confirm('Excluir "' + titulo + '"?\n\nEsta ação não pode ser desfeita.')) return;

 // ── Atividade Supabase — DELETE no banco ─────────────────────────────────
 var sbId = _taskEditId;
 _taskDrawerClose();
 _showToast('Excluindo...', 'ok');
 _sb.from('atividades').delete().eq('id', sbId)
  .then(function(res) {
   if (res.error) {
    _showToast('Erro ao excluir: ' + _supaErrPt(res.error.message), 'erro');
   } else {
    _showToast('Atividade excluída do sistema', 'ok');
    _histLogAdd('excluiu', titulo, 'Removida do Supabase');
    _histBadgeUpdate();
    // Remove dos dois caches na hora (não precisa esperar o _dashLoad abaixo
    // pra sumir do Gestor de Tarefas também, não só do Meu Painel)
    if (typeof _gestorAllAt !== 'undefined') {
     var gIdx = _gestorAllAt.findIndex(function(x){ return String(x.id) === String(sbId); });
     if (gIdx !== -1) { _gestorAllAt.splice(gIdx, 1); if (typeof _gestorApplyFilters === 'function') _gestorApplyFilters(); }
    }
    _dashLoad(); // atualiza feed e KPIs
   }
  })
  .catch(function(e) { _showToast('Erro: ' + e.message, 'erro'); });
}

/* ── TABS DO DRAWER: página única com scroll — as abas são atalhos que
   rolam suavemente até a seção correspondente, sem trocar conteúdo ── */
function _drwAnchor(name, btn) {
 var body = document.getElementById('task-drw-body');
 var target = document.getElementById('drw-anchor-' + name);
 if (body && target) {
  body.scrollTo({ top: target.offsetTop - body.offsetTop, behavior: 'smooth' });
 }
 document.querySelectorAll('.drw-tab').forEach(function(b){ b.classList.remove('active'); });
 if (btn) btn.classList.add('active');
 else {
  var fallback = document.querySelector('.drw-tab[onclick*="\'' + name + '\'"]');
  if (fallback) fallback.classList.add('active');
 }
}

/* ── Scrollspy: destaca no topo a aba correspondente à seção visível ── */
var _drwSpyObserver = null;
function _drwSpyInit() {
 if (_drwSpyObserver) { _drwSpyObserver.disconnect(); _drwSpyObserver = null; }
 var body = document.getElementById('task-drw-body');
 if (!body || typeof IntersectionObserver === 'undefined') return;
 var anchors = Array.prototype.slice.call(body.querySelectorAll('.drw-page-hd[id^="drw-anchor-"]'));
 if (!anchors.length) return;
 _drwSpyObserver = new IntersectionObserver(function(entries) {
  var mostVisible = null;
  entries.forEach(function(e) {
   if (e.isIntersecting && (!mostVisible || e.intersectionRatio > mostVisible.intersectionRatio)) mostVisible = e;
  });
  if (!mostVisible) return;
  var name = mostVisible.target.id.replace('drw-anchor-', '');
  document.querySelectorAll('.drw-tab').forEach(function(b){ b.classList.remove('active'); });
  var btn = document.querySelector('.drw-tab[onclick*="\'' + name + '\'"]');
  if (btn) btn.classList.add('active');
 }, { root: body, threshold: [0, .5, 1], rootMargin: '-8px 0px -70% 0px' });
 anchors.forEach(function(a){ _drwSpyObserver.observe(a); });
}

/* ── SUBTAREFAS NO DRAWER ────────────────────────────────────────────────── */
var _drwSubItems = []; // [{_id, titulo, done}]
// subtask_id → solicitação de colaboração ATIVA mais recente (não Concluída/
// Recusada) para essa subtarefa, dentro da atividade aberta no drawer —
// alimentado por _drwColabReqRender(taskId) a cada abertura/atualização.
var _drwSubColabMap = {};

// ── Cor no <select> de status (estava sem cor nenhuma, baixa legibilidade) —
// aplica borda + fundo levemente tingido com a cor da opção selecionada, no
// mesmo espírito dos badges coloridos já usados nos cards.
var _SEL_TASK_STATUS_COR = {
 'Backlog':'var(--muted)', 'A fazer':'var(--navy)', 'Em progresso':'var(--yellow)',
 'Aguardando feedback':'rgba(139,92,246,1)', 'Feito':'var(--green)', 'Obsoleto':'var(--red)'
};
function _selColorize(sel, colorMap) {
 if (!sel) return;
 var c = colorMap[sel.value];
 if (c) {
  sel.style.borderColor = c;
  sel.style.color = c;
  sel.style.fontWeight = '600';
  sel.style.background = 'color-mix(in srgb, ' + c + ' 14%, var(--surface2))';
 } else {
  sel.style.borderColor = '';
  sel.style.color = '';
  sel.style.fontWeight = '';
  sel.style.background = '';
 }
}

function _drwSubRender() {
 var list = document.getElementById('drw-sub-list');
 if (!list) return;
 if (!_drwSubItems.length) { list.innerHTML = '<div style="font-size:11px;color:var(--muted);padding:4px 0">Nenhuma subtarefa ainda.</div>'; _drwSubBadge(); return; }
 // O botão de colaborar por subtarefa aparece sempre, inclusive criando uma
 // atividade nova — senão a opção fica invisível até salvar, e a pessoa nem
 // descobre que ela existe. Quem bloqueia é _drwColabReqOpenForSubtask (a
 // ação em si exige atividade_id real), com aviso claro pra salvar primeiro.
 list.innerHTML = _drwSubItems.map(function(s, idx) {
  var cbClass = 'drw-sub-cb' + (s.done ? ' done' : '');
  var check = s.done ? '<svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="#fff" stroke-width="2.2"><polyline points="1.5,5 4,7.5 8.5,2.5"/></svg>' : '';
  var req = _drwSubColabMap[s._id];
  var colabInd = req
   ? '<span class="drw-sub-colab-ind" title="Colaboração com ' + (req.receptor_nome || req.receptor_email || '?') + ' — ' + req.status + '">' + _userAvatarByName(req.receptor_nome || req.receptor_email, 16) + '</span>'
   : '';
  var colabBtn = '<button class="drw-sub-colab-btn" onclick="_drwColabReqOpenForSubtask(\'' + s._id + '\')" title="Solicitar colaboração nesta subtarefa">'
     + '<svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="4" r="2"/><path d="M2 10.5c0-1.9 1.8-3.3 4-3.3s4 1.4 4 3.3"/></svg>'
     + '</button>';
  return '<div class="drw-sub-item" id="drw-sub-item-' + idx + '">'
   + '<div class="' + cbClass + '" onclick="_drwSubToggleDone(' + idx + ')">' + check + '</div>'
   + '<span class="drw-sub-titulo' + (s.done ? ' done' : '') + '" onclick="_drwSubTitleEdit(' + idx + ')" title="Clique para editar">' + (s.titulo || '<i style="color:var(--muted)">(clique para definir)</i>') + '</span>'
   + colabInd
   + colabBtn
   + '<button class="drw-sub-del" onclick="_drwSubDelete(' + idx + ')" title="Remover">&times;</button>'
   + '</div>';
 }).join('');
 _drwSubBadge();
 _drwAutoStatusFromSubs();
}

// Subtarefas são um jsonb (não uma tabela própria) — toda mudança reenvia
// a lista inteira pra coluna atividades.subtasks.
function _drwSubAutoSave() {
 if (!_taskEditId) return; // criação: fica só no estado local até "Criar atividade"
 var subtasksParaSalvar = _drwSubItems.map(function(s, n) {
  return { id: s._id || (Date.now() + n), titulo: s.titulo, done: !!s.done };
 });
 _taskAutoSaveQueue({ subtasks: subtasksParaSalvar }, true);
}

function _drwSubToggleDone(idx) {
 if (!_drwSubItems[idx]) return;
 _drwSubItems[idx].done = !_drwSubItems[idx].done;
 _drwAutoStatusFromSubs();
 _drwSubRender();
 _drwSubAutoSave();
}

function _drwSubBadge() {
 var badge = document.getElementById('drw-sub-badge');
 if (!badge) return;
 if (_drwSubItems.length > 0) {
  badge.style.display = 'inline-flex';
  badge.textContent = _drwSubItems.length;
 } else {
  badge.style.display = 'none';
 }
}

function _drwSubAdd() {
 _drwSubItems.push({ _id: Date.now(), titulo: '', done: false });
 _drwSubRender();
 // Abre o título já em modo de edição para a subtarefa recém-criada
 setTimeout(function() { _drwSubTitleEdit(_drwSubItems.length - 1, true); }, 50);
}

// Troca o <span> de título por um <input> editável (clique a qualquer momento,
// não só na criação) — corrige bug onde o título só podia ser definido uma vez.
// isNew: true quando aberto logo após _drwSubAdd — Enter aqui cria a próxima
// subtarefa em seguida (fluxo rápido de digitar várias seguidas).
function _drwSubTitleEdit(idx, isNew) {
 var item = document.getElementById('drw-sub-item-' + idx);
 if (!item || !_drwSubItems[idx]) return;
 var titEl = item.querySelector('.drw-sub-titulo');
 if (!titEl || titEl.tagName === 'INPUT') return; // já em edição
 var inp = document.createElement('input');
 inp.className = 'drw-sub-inp drw-sub-titulo';
 inp.style.flex = '1';
 inp.style.fontSize = '12px';
 inp.style.fontWeight = '600';
 inp.placeholder = 'Título da subtarefa...';
 inp.value = _drwSubItems[idx].titulo || '';
 var commit = function() { _drwSubField(idx, 'titulo', inp.value.trim()); _drwSubRender(); };
 inp.onblur = commit;
 inp.onkeydown = function(e) {
  if (e.key === 'Enter') {
   e.preventDefault();
   var valor = inp.value.trim();
   var criarProxima = isNew && valor && idx === _drwSubItems.length - 1;
   inp.onblur = null; // evita commit duplicado pelo blur logo abaixo
   _drwSubField(idx, 'titulo', valor);
   _drwSubRender();
   if (criarProxima) _drwSubAdd();
  }
  if (e.key === 'Escape') { e.preventDefault(); inp.value = _drwSubItems[idx].titulo || ''; inp.blur(); }
 };
 titEl.replaceWith(inp);
 inp.focus();
 inp.select();
}

function _drwSubDelete(idx) {
 _drwSubItems.splice(idx, 1);
 _drwSubRender();
 _drwSubAutoSave();
}

function _drwSubField(idx, field, value) {
 if (_drwSubItems[idx]) {
  _drwSubItems[idx][field] = value;
  _drwAutoStatusFromSubs();
  _drwSubAutoSave();
 }
}

function _drwAutoStatusFromSubs() {
 if (!_drwSubItems.length) return;
 var total      = _drwSubItems.length;
 var concluidos = _drwSubItems.filter(function(s){ return s.done; }).length;
 var stEl = document.getElementById('nt-status');
 if (!stEl) return;
 if (concluidos === total && stEl.value !== 'Feito') {
  // Sugerir conclusão — não forçar silenciosamente
  var banner = document.getElementById('drw-sub-conclusao-banner');
  if (!banner) {
   banner = document.createElement('div');
   banner.id = 'drw-sub-conclusao-banner';
   banner.style.cssText = 'background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.3);border-radius:7px;padding:8px 12px;font-size:11px;color:var(--text);display:flex;align-items:center;gap:10px;margin-bottom:6px';
   banner.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1F8A4C" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>'
    + '<span style="flex:1">Todas as subtarefas concluídas. Marcar a atividade como <strong>Feita</strong>?</span>'
    + '<button onclick="_drwConfirmarConclusao()" style="font-size:10px;padding:3px 10px;background:#1F8A4C;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:600">Confirmar</button>'
    + '<button onclick="this.parentElement.remove()" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:14px;padding:0 2px">&times;</button>';
   var subList = document.getElementById('drw-sub-list');
   if (subList && subList.parentNode) subList.parentNode.insertBefore(banner, subList);
  }
 } else {
  var b = document.getElementById('drw-sub-conclusao-banner');
  if (b) b.remove();
  if (concluidos > 0 && stEl.value === 'A fazer') stEl.value = 'Em progresso';
 }
}

function _drwConfirmarConclusao() {
 var stEl = document.getElementById('nt-status');
 if (stEl) stEl.value = 'Feito';
 var banner = document.getElementById('drw-sub-conclusao-banner');
 if (banner) banner.remove();
 _showToast('Atividade marcada como Feita. Salve para confirmar.', 'ok');
}

/* ── Dados do searchable-select de obras ── */
var _obrasAll = []; // [{id, nome, empresa}] — lista completa para filtrar
var _obraSelectedId = '';
var _obraSearchQ = '';

function _obraSearchToggle() {
 var drop = document.getElementById('nt-obra-drop');
 var box  = document.getElementById('nt-obra-box');
 if (!drop) return;
 var isOpen = drop.classList.contains('open');
 if (isOpen) { _obraSearchClose(); return; }
 drop.classList.add('open');
 box.classList.add('open');
 var inp = document.getElementById('nt-obra-inp');
 if (inp) { inp.value = ''; inp.focus(); }
 _obraSearchFilter('');
 _srchSelPositionEl(drop, box);
}
function _obraSearchClose() {
 var drop = document.getElementById('nt-obra-drop');
 var box  = document.getElementById('nt-obra-box');
 if (drop) drop.classList.remove('open');
 if (box)  box.classList.remove('open');
}
function _obraSearchFilter(q) {
 _obraSearchQ = (q || '').toLowerCase();
 var list = document.getElementById('nt-obra-list');
 if (!list) return;
 var matches = _obrasAll.filter(function(o){
  return o.nome.toLowerCase().indexOf(_obraSearchQ) !== -1
   || (o.empresa && o.empresa.toLowerCase().indexOf(_obraSearchQ) !== -1);
 });
 if (!matches.length) {
  list.innerHTML = '<div class="srch-sel-empty">Nenhuma obra encontrada.</div>';
  return;
 }
 list.innerHTML = matches.map(function(o){
  var label = o.nome + (o.empresa ? ' <span style="color:var(--muted);font-size:10px">— ' + o.empresa + '</span>' : '');
  var sel = o.id === _obraSelectedId ? ' selected' : '';
  return '<div class="srch-sel-opt' + sel + '" onclick="_obraSelectItem(\'' + o.id + '\',\'' + o.nome.replace(/'/g,'\\\'') + '\')">' + label + '</div>';
 }).join('');
}
function _obraSearchKey(e) {
 if (e.key === 'Escape') _obraSearchClose();
}
// Vínculos (obra/projeto/melhoria) não são colunas de atividades — vivem só
// nas tabelas de junção, então não passam por _taskAutoSaveQueue (isso é só
// pra colunas da própria linha); chamam _syncAtividadeVinculos direto.
function _ntAutoSaveVinculos() {
 if (!_taskEditId) return; // criação: sincroniza só depois de "Criar atividade"
 var obraId = (document.getElementById('nt-obra')     || {}).value || null;
 var projId = (document.getElementById('nt-projeto')  || {}).value || null;
 var melhId = (document.getElementById('nt-melhoria-sel') || {}).value || null;
 var id = _taskEditId;
 _taskAutoSaveStatus('saving', 'Salvando…');
 _syncAtividadeVinculos(id, obraId, projId, melhId).then(function() {
  // Mesmo cuidado do _taskAutoSaveFlush: só pula se já abriu OUTRA
  // atividade, não quando o painel simplesmente fechou (_taskEditId nulo).
  if (_taskEditId && String(_taskEditId) !== String(id)) return;
  _taskAutoSaveStatus('saved', 'Alterações salvas');
  var gIdx = (typeof _gestorAllAt !== 'undefined') ? _gestorAllAt.findIndex(function(x){ return String(x.id) === String(id); }) : -1;
  if (gIdx !== -1) {
   _gestorAllAt[gIdx].obra_id = obraId; _gestorAllAt[gIdx].projeto_id = projId; _gestorAllAt[gIdx].melhoria_id = melhId;
   _gestorAllAt[gIdx]._obraNome = obraId ? (_gestorObrasMap[String(obraId)] || '') : '';
   _gestorAllAt[gIdx]._projNome = projId ? (_gestorProjMap[String(projId)] || '') : '';
   if (typeof _gestorApplyFilters === 'function') _gestorApplyFilters();
  }
  var dIdx = (_dashAllAtRaw||[]).findIndex(function(x){ return String(x.id) === String(id); });
  if (dIdx !== -1) {
   _dashAllAtRaw[dIdx].obra_id = obraId; _dashAllAtRaw[dIdx].projeto_id = projId; _dashAllAtRaw[dIdx].melhoria_id = melhId;
   _dashAllAtRaw[dIdx]._obraNome = obraId ? (_gestorObrasMap[String(obraId)] || '') : '';
   _dashAllAtRaw[dIdx]._projNome = projId ? (_gestorProjMap[String(projId)] || '') : '';
   _dashRerenderAllFromCache();
  }
 });
}

function _obraSelectItem(id, nome) {
 _obraSelectedId = id;
 var hidEl = document.getElementById('nt-obra');
 var valEl = document.getElementById('nt-obra-val');
 var clrEl = document.getElementById('nt-obra-clr');
 if (hidEl) hidEl.value = id;
 if (valEl) { valEl.textContent = nome; valEl.classList.remove('placeholder'); }
 if (clrEl) clrEl.style.display = id ? '' : 'none';
 _obraSearchClose();
 _ntObraChange(id, null);
 _ntObraCardUpdate(id);
 _ntAutoSaveVinculos();
}
function _obraClear() {
 _obraSelectedId = '';
 var hidEl = document.getElementById('nt-obra');
 var valEl = document.getElementById('nt-obra-val');
 var clrEl = document.getElementById('nt-obra-clr');
 if (hidEl) hidEl.value = '';
 if (valEl) { valEl.textContent = 'Nenhuma'; valEl.classList.add('placeholder'); }
 if (clrEl) clrEl.style.display = 'none';
 _ntObraChange('', null);
 _ntObraCardUpdate('');
 _ntAutoSaveVinculos();
}
function _obraSetValue(id, nome) {
 // Programaticamente define o valor do searchable select
 _obraSelectedId = id || '';
 var hidEl = document.getElementById('nt-obra');
 var valEl = document.getElementById('nt-obra-val');
 var clrEl = document.getElementById('nt-obra-clr');
 if (hidEl) hidEl.value = id || '';
 if (valEl) {
  if (id && nome) { valEl.textContent = nome; valEl.classList.remove('placeholder'); }
  else { valEl.textContent = 'Nenhuma'; valEl.classList.add('placeholder'); }
 }
 if (clrEl) clrEl.style.display = (id ? '' : 'none');
}

/* ── Dados do searchable-select de projetos (mesmo padrão da Obra) ── */
var _projetosAtuais = []; // [{id, nome, etapa_projeto, liberado_execucao}] — projetos da obra atual
var _projSelectedId = '';
var _projSearchQ = '';
var _projDisabled = true; // sem obra selecionada / sem projetos → dropdown não abre

function _projSearchToggle() {
 if (_projDisabled) return;
 var drop = document.getElementById('nt-projeto-drop');
 var box  = document.getElementById('nt-projeto-box');
 if (!drop) return;
 var isOpen = drop.classList.contains('open');
 if (isOpen) { _projSearchClose(); return; }
 drop.classList.add('open');
 box.classList.add('open');
 var inp = document.getElementById('nt-projeto-inp');
 if (inp) { inp.value = ''; inp.focus(); }
 _projSearchFilter('');
 _srchSelPositionEl(drop, box);
}
function _projSearchClose() {
 var drop = document.getElementById('nt-projeto-drop');
 var box  = document.getElementById('nt-projeto-box');
 if (drop) drop.classList.remove('open');
 if (box)  box.classList.remove('open');
}
function _projSearchFilter(q) {
 _projSearchQ = (q || '').toLowerCase();
 var list = document.getElementById('nt-projeto-list');
 if (!list) return;
 var matches = _projetosAtuais.filter(function(p){
  return p.nome.toLowerCase().indexOf(_projSearchQ) !== -1;
 });
 if (!matches.length) {
  list.innerHTML = '<div class="srch-sel-empty">Nenhum projeto encontrado.</div>';
  return;
 }
 list.innerHTML = matches.map(function(p){
  var sel = p.id === _projSelectedId ? ' selected' : '';
  return '<div class="srch-sel-opt' + sel + '" onclick="_projSelectItem(\'' + p.id + '\',\'' + p.nome.replace(/'/g,'\\\'') + '\')">' + p.nome + '</div>';
 }).join('');
}
function _projSearchKey(e) {
 if (e.key === 'Escape') _projSearchClose();
}
function _projSelectItem(id, nome) {
 _projSelectedId = id;
 var hidEl = document.getElementById('nt-projeto');
 var valEl = document.getElementById('nt-projeto-val');
 var clrEl = document.getElementById('nt-projeto-clr');
 if (hidEl) hidEl.value = id;
 if (valEl) { valEl.textContent = nome; valEl.classList.remove('placeholder'); }
 if (clrEl) clrEl.style.display = id ? '' : 'none';
 _projSearchClose();
 _ntProjCardSync();
 _ntAutoSaveVinculos();
}
function _projClear() {
 _projSelectedId = '';
 var hidEl = document.getElementById('nt-projeto');
 var valEl = document.getElementById('nt-projeto-val');
 var clrEl = document.getElementById('nt-projeto-clr');
 if (hidEl) hidEl.value = '';
 if (valEl) { valEl.textContent = 'Nenhum'; valEl.classList.add('placeholder'); }
 if (clrEl) clrEl.style.display = 'none';
 _ntProjCardSync();
 _ntAutoSaveVinculos();
}
function _projSetValue(id, nome) {
 // Programaticamente define o valor do searchable select (ex: restaurar edição)
 _projSelectedId = id || '';
 var hidEl = document.getElementById('nt-projeto');
 var valEl = document.getElementById('nt-projeto-val');
 var clrEl = document.getElementById('nt-projeto-clr');
 if (hidEl) hidEl.value = id || '';
 if (valEl) {
  if (id && nome) { valEl.textContent = nome; valEl.classList.remove('placeholder'); }
  else { valEl.textContent = 'Nenhum'; valEl.classList.add('placeholder'); }
 }
 if (clrEl) clrEl.style.display = (id ? '' : 'none');
}
function _projSetDisabled(disabled) {
 _projDisabled = disabled;
 var box = document.getElementById('nt-projeto-box');
 if (!box) return;
 box.style.opacity = disabled ? '.5' : '1';
 box.style.cursor  = disabled ? 'not-allowed' : 'pointer';
 if (disabled) _projSearchClose();
}

/* ── Searchable-select do campo "Colaborador" (Colaboração formal) ──
   Mesmo padrão do Projeto/Obra acima — converte o antigo <select> simples
   (sem busca, difícil de usar com a lista de usuários crescendo) mantendo o
   mesmo contrato: .value do #drw-colab-receptor (agora um <input type=hidden>)
   continua sendo o e-mail do colaborador, lido por _drwColabReqEnviar(). */
var _colabReceptLista = []; // [{email, nome}] — preenchida em _drwColabReqToggleForm()
var _colabReceptSelectedEmail = '';
var _colabReceptSearchQ = '';

function _colabReceptSearchToggle() {
 var drop = document.getElementById('drw-colab-receptor-drop');
 var box  = document.getElementById('drw-colab-receptor-box');
 if (!drop) return;
 var isOpen = drop.classList.contains('open');
 if (isOpen) { _colabReceptSearchClose(); return; }
 drop.classList.add('open');
 if (box) box.classList.add('open');
 var inp = document.getElementById('drw-colab-receptor-inp');
 if (inp) { inp.value = ''; inp.focus(); }
 _colabReceptSearchFilter('');
 _srchSelPositionEl(drop, box);
}
function _colabReceptSearchClose() {
 var drop = document.getElementById('drw-colab-receptor-drop');
 var box  = document.getElementById('drw-colab-receptor-box');
 if (drop) drop.classList.remove('open');
 if (box)  box.classList.remove('open');
}
function _colabReceptSearchFilter(q) {
 _colabReceptSearchQ = (q || '').toLowerCase();
 var list = document.getElementById('drw-colab-receptor-list');
 if (!list) return;
 var matches = _colabReceptLista.filter(function(r){
  return (r.nome || r.email || '').toLowerCase().indexOf(_colabReceptSearchQ) !== -1
   || (r.email || '').toLowerCase().indexOf(_colabReceptSearchQ) !== -1;
 });
 if (!matches.length) {
  list.innerHTML = '<div class="srch-sel-empty">Nenhum colaborador encontrado.</div>';
  return;
 }
 list.innerHTML = matches.map(function(r){
  var nome = r.nome || r.email;
  var sel = r.email === _colabReceptSelectedEmail ? ' selected' : '';
  return '<div class="srch-sel-opt' + sel + '" onclick="_colabReceptSelectItem(\'' + r.email.replace(/'/g,'\\\'') + '\',\'' + nome.replace(/'/g,'\\\'') + '\')">' + nome + '</div>';
 }).join('');
}
function _colabReceptSearchKey(e) {
 if (e.key === 'Escape') _colabReceptSearchClose();
}
function _colabReceptSelectItem(email, nome) {
 _colabReceptSelectedEmail = email;
 var hidEl = document.getElementById('drw-colab-receptor');
 var valEl = document.getElementById('drw-colab-receptor-val');
 var clrEl = document.getElementById('drw-colab-receptor-clr');
 if (hidEl) hidEl.value = email;
 if (valEl) { valEl.textContent = nome; valEl.classList.remove('placeholder'); }
 if (clrEl) clrEl.style.display = email ? '' : 'none';
 _colabReceptSearchClose();
}
function _colabReceptClear() {
 _colabReceptSelectedEmail = '';
 var hidEl = document.getElementById('drw-colab-receptor');
 var valEl = document.getElementById('drw-colab-receptor-val');
 var clrEl = document.getElementById('drw-colab-receptor-clr');
 if (hidEl) hidEl.value = '';
 if (valEl) { valEl.textContent = 'Selecione o colaborador...'; valEl.classList.add('placeholder'); }
 if (clrEl) clrEl.style.display = 'none';
}

/* ── Toggle de seções colapsáveis no drawer ── */
function _drwToggleSection(name) {
 var body    = document.getElementById('drw-sec-body-' + name);
 var toggle  = document.getElementById('drw-sec-toggle-' + name);
 if (!body) return;
 var collapsed = body.classList.contains('collapsed');
 body.classList.toggle('collapsed', !collapsed);
 if (toggle) toggle.textContent = collapsed ? '▾' : '▸';
}

function _ntPopulateVinculos(t) {
 // ── Obras — searchable select ──
 var _popularObras = function(obras) {
  _obrasAll = obras;
  _obraSearchFilter('');
  // Restaurar valor salvo
  if (t && t.obra_id) {
   var ob = obras.find(function(o){ return o.id === t.obra_id; });
   var obNome = (ob && ob.nome) || (t._obraNome) || (_gestorObrasMap && _gestorObrasMap[String(t.obra_id)]) || t.obra_id;
   _obraSetValue(t.obra_id, obNome);
   _ntObraChange(t.obra_id, t);
   _ntObraCardUpdate(t.obra_id);
  } else {
   _obraSetValue('', '');
   _ntObraCardUpdate('');
  }
 };
 if (window._obrasCache && window._obrasCache.length) {
  _popularObras(window._obrasCache);
 } else if (_dbOk) {
  // Carregar todas as obras com paginação (1528 registros, limite 1000)
  (async function() {
   var all = [], pg = 0, sz = 1000;
   while (true) {
    var lr = await _sb.from('obras').select('id, nome, etapa_negocio, motivo_perdido').order('nome').range(pg*sz, (pg+1)*sz-1);
    if (lr.error || !lr.data || !lr.data.length) break;
    all = all.concat(lr.data);
    if (lr.data.length < sz) break;
    pg++;
   }
   if (!all.length) return;
   window._obrasCache = all;
   // Atualizar lookup map global enquanto carrega
   all.forEach(function(o){ if(o.id&&o.nome) _gestorObrasMap[String(o.id)]=o.nome; });
   _popularObras(window._obrasCache);
  })();
 }
 // Projetos: só habilitado após selecionar obra — não popular aqui
 if (!(t && t.obra_id)) {
  _projetosAtuais = [];
  _projSetValue('', '');
  _projSetDisabled(true);
  _ntProjCardSync();
 }
 // ── Melhorias — sem limit ──
 var selMelh = document.getElementById('nt-melhoria-sel');
 if (selMelh) {
  if (window._melhoriasCache && window._melhoriasCache.length) {
   selMelh.innerHTML = '<option value="">Nenhuma</option>'
    + window._melhoriasCache.map(function(m){
     return '<option value="' + m.id + '">' + m.nome + '</option>';
    }).join('');
   if (t && t.melhoria_id) selMelh.value = t.melhoria_id;
   _ntMelhCardSync();
  } else if (_dbOk) {
   _sb.from('melhorias').select('id, nome, area').order('nome')
   .then(function(res) {
    if (!res.data) return;
    window._melhoriasCache = res.data;
    selMelh.innerHTML = '<option value="">Nenhuma</option>'
     + window._melhoriasCache.map(function(m){
      return '<option value="' + m.id + '">' + m.nome + '</option>';
     }).join('');
    if (t && t.melhoria_id) selMelh.value = t.melhoria_id;
    _ntMelhCardSync();
   });
  }
 }
 if (!_dbOk) {
  // Obra não é mais um <select> simples (virou busca com dropdown próprio,
  // ver nt-obra-box/nt-obra-drop), só a Melhoria ainda é.
  var msg = '<option value="">Sem conexão</option>';
  if (selMelh && selMelh.options.length <= 1) selMelh.innerHTML = msg;
 }
}

/* ── Obra selecionada → carregar projetos filtrados ──────────────────────── */
function _ntObraChange(obraId, taskCtx) {
 var hint = document.getElementById('nt-projeto-hint');
 if (!obraId) {
  _projetosAtuais = [];
  _projSetValue('', '');
  _projSetDisabled(true);
  if (hint) hint.textContent = '(selecione uma obra primeiro)';
  return;
 }
 _projetosAtuais = [];
 _projSetValue('', '');
 _projSetDisabled(true);
 if (hint) hint.textContent = 'Carregando...';
 if (!_dbOk) { if (hint) hint.textContent = '(sem conexão)'; return; }
 // Tentar campo obra_id nos projetos (ajuste o nome da coluna se necessário)
 _sb.from('projetos').select('id, nome, etapa_projeto, liberado_execucao').eq('obra_id', obraId).order('nome')
 .then(function(res) {
  var projetos = (res.data || []);
  // Fallback: se a tabela não tiver obra_id, buscar via atividades ou mostrar todos
  if (!projetos.length && !res.error) {
   // Tentar relação via obras_projetos ou campo diferente
   return _sb.from('projetos').select('id, nome, etapa_projeto, liberado_execucao').order('nome').then(function(r2){
    projetos = r2.data || [];
    return projetos;
   });
  }
  return projetos;
 }).then(function(projetos) {
  if (!projetos) return;
  if (!projetos.length) {
   _projetosAtuais = [];
   _projSetDisabled(true);
   if (hint) hint.textContent = '(nenhum projeto nesta obra)';
   _ntProjCardSync();
   return;
  }
  _projetosAtuais = projetos;
  _projSearchFilter('');
  _projSetDisabled(false);
  if (hint) hint.textContent = '';
  // Restaurar valor se editando
  if (taskCtx && taskCtx.projeto_id) {
   var pj = projetos.find(function(p){ return String(p.id) === String(taskCtx.projeto_id); });
   var pjNome = (pj && pj.nome) || taskCtx._projNome || (_gestorProjMap && _gestorProjMap[String(taskCtx.projeto_id)]) || taskCtx.projeto_id;
   _projSetValue(taskCtx.projeto_id, pjNome);
  }
  _ntProjCardSync();
 }).catch(function() {
  _projetosAtuais = [];
  _projSetDisabled(true);
  if (hint) hint.textContent = '(erro ao carregar)';
  _ntProjCardSync();
 });
}

/* ── Card "Negócio / Oportunidade" — preenchido a partir da Obra selecionada ── */
function _ntObraCardUpdate(obraId) {
 var card = document.getElementById('nt-obra-card');
 if (!card) return;
 var ob = obraId ? _obrasAll.find(function(o){ return o.id === obraId; }) : null;
 if (!ob) { card.style.display = 'none'; return; }
 document.getElementById('nt-obra-card-nome').textContent = ob.nome || '—';
 document.getElementById('nt-obra-card-etapa').textContent = ob.etapa_negocio || '—';
 document.getElementById('nt-obra-card-status').textContent = ob.motivo_perdido
  ? ('Perdido — ' + ob.motivo_perdido)
  : (ob.etapa_negocio || '—');
 card.style.display = '';
}

/* ── Card "Projeto" — preenchido a partir do Projeto selecionado ── */
function _ntProjCardSync() {
 var card = document.getElementById('nt-proj-card');
 var hidEl = document.getElementById('nt-projeto');
 if (!hidEl || !card) return;
 var pid = hidEl.value;
 var p = pid ? _projetosAtuais.find(function(x){ return String(x.id) === String(pid); }) : null;
 if (!p) { card.style.display = 'none'; return; }
 var liberado = p.liberado_execucao === true ? 'true' : (p.liberado_execucao === false ? 'false' : '');
 var status = liberado === 'true' ? 'Liberado para execução' : (liberado === 'false' ? 'Aguardando liberação' : '—');
 document.getElementById('nt-proj-card-nome').textContent = p.nome || '—';
 document.getElementById('nt-proj-card-etapa').textContent = p.etapa_projeto || '—';
 document.getElementById('nt-proj-card-status').textContent = status;
 card.style.display = '';
}

/* ── Abre o detalhe completo (painel lateral) da Obra ou Projeto vinculado à tarefa ── */
function _abrirVinculoTask(tipo) {
 var id = tipo === 'obra'
  ? (document.getElementById('nt-obra')    || {}).value
  : (document.getElementById('nt-projeto') || {}).value;
 if (!id) return;
 _taskDrawerClose();
 var rota   = tipo === 'obra' ? 'obras' : 'projetos';
 var tbodyId = tipo === 'obra' ? 'obras-tbody' : 'proj-tbody';
 go(rota);
 var tentativas = 0;
 function tentarAbrir() {
  var row = document.querySelector('#' + tbodyId + ' tr[data-id="' + id + '"]');
  if (row) { row.click(); return; }
  tentativas++;
  if (tentativas < 15) { setTimeout(tentarAbrir, 200); return; }
  // Última tentativa: força reload da tabela (caso ainda não tivesse sido carregada)
  if (tipo === 'obra' && typeof _dbLoadObras === 'function') _dbLoadObras().then(function(){
   var r2 = document.querySelector('#' + tbodyId + ' tr[data-id="' + id + '"]');
   if (r2) r2.click();
  });
 }
 setTimeout(tentarAbrir, 100);
}

/* ── Card "Melhoria" — preenchido a partir da Melhoria selecionada ── */
function _ntMelhCardSync() {
 var sel = document.getElementById('nt-melhoria-sel');
 var card = document.getElementById('nt-melh-card');
 if (!sel || !card) return;
 var m = sel.value ? (window._melhoriasCache || []).find(function(x){ return x.id === sel.value; }) : null;
 if (!m) { card.style.display = 'none'; return; }
 document.getElementById('nt-melh-card-nome').textContent = m.nome || '—';
 document.getElementById('nt-melh-card-area').textContent = m.area || '—';
 card.style.display = '';
}



// Só roda em modo criação — editar uma atividade existente salva sozinho
// (ver _taskAutoSave*/_ntAutoSave*/_drwSubAutoSave), o botão "Salvar
// alterações" e toda a lógica de UPDATE que ele disparava foram removidos.
function _submitNewTask() {
 // ── Validação ────────────────────────────────────────────────────
 var camposObrig = ['nt-titulo','nt-tipo-atividade','nt-area','nt-dt-inicio','nt-dt-fim'];
 var valido = true, primeiroInvalido = null;
 camposObrig.forEach(function(id) {
  var el = document.getElementById(id);
  if (!el || !el.value.trim()) {
   if (el) { el.style.borderColor='var(--red)'; el.style.boxShadow='0 0 0 2px rgba(239,68,68,.18)'; setTimeout(function(){ el.style.borderColor=''; el.style.boxShadow=''; },2500); }
   if (!primeiroInvalido) primeiroInvalido = el;
   valido = false;
  }
 });
 var respHid = document.getElementById('nt-responsavel');
 var respBox = document.getElementById('nt-resp-box');
 if (!respHid || !respHid.value.trim()) {
  if (respBox) { respBox.style.borderColor='var(--red)'; respBox.style.boxShadow='0 0 0 2px rgba(239,68,68,.18)'; setTimeout(function(){ respBox.style.borderColor=''; respBox.style.boxShadow=''; },2500); }
  if (!primeiroInvalido) primeiroInvalido = respBox;
  valido = false;
 }
 if (!valido) {
  // Rolar até o primeiro campo com erro (seção Geral já está sempre visível)
  if (primeiroInvalido && primeiroInvalido.scrollIntoView) primeiroInvalido.scrollIntoView({ block: 'center', behavior: 'smooth' });
  if (primeiroInvalido && primeiroInvalido.focus) primeiroInvalido.focus();
  _showToast('Preencha todos os campos obrigatórios (*)', 'erro');
  return;
 }
 try {
  // ── Leitura de campos ────────────────────────────────────────────
  var obraEl  = document.getElementById('nt-obra');
  var projEl  = document.getElementById('nt-projeto');
  var melhEl  = document.getElementById('nt-melhoria-sel');
  var obraText = obraEl && obraEl.selectedIndex > 0 ? obraEl.options[obraEl.selectedIndex].text : '';
  var projText = projEl && projEl.selectedIndex > 0 ? projEl.options[projEl.selectedIndex].text : '';
  var melhText = melhEl && melhEl.selectedIndex > 0 ? melhEl.options[melhEl.selectedIndex].text : '';

  // ── Subtarefas: converter _drwSubItems para formato de storage ──
  var subtasksParaSalvar = _drwSubItems.map(function(s, n) {
   return {
    id:     s._id || (Date.now() + n),
    titulo: s.titulo,
    done:   !!s.done
   };
  });

  var currentUser = (localStorage.getItem('pp-name') || '').split(' ')[0] || 'Sistema';

  // ── Privacidade ──────────────────────────────────────────────────
  var privModo = (document.getElementById('nt-privacidade') || {}).value || 'equipe';
  var privVisibilidade = privModo === 'equipe' ? 'equipe' : 'privada';
  var privShares = privModo === 'privada_especificos' ? _privSelecionados.slice() : [];

  var mae = {
   id:              Date.now(),
   titulo:          document.getElementById('nt-titulo').value.trim(),
   tipo_atividade:  document.getElementById('nt-tipo-atividade').value,
   area:            document.getElementById('nt-area').value,
   responsavel:     document.getElementById('nt-responsavel').value.trim(),
   prioridade:      document.getElementById('nt-prioridade').value,
   status:          document.getElementById('nt-status').value,
   data_inicio:     document.getElementById('nt-dt-inicio').value,
   data_fim:        document.getElementById('nt-dt-fim').value,
   observacoes:     (document.getElementById('nt-observacoes') || {}).value || '',
   obra_id:         obraEl ? obraEl.value : '',
   obra_nome:       obraText.split(' — ')[0] || '',
   projeto_id:      projEl ? projEl.value : '',
   projeto_nome:    projText || '',
   melhoria_id:     melhEl ? melhEl.value : '',
   melhoria_nome:   melhText || '',
   done:            false,
   origem:          'Dashboard',
   created_by:      currentUser,
   created_at:      new Date().toISOString()
  };

  if (!Array.isArray(_dashTasks)) { _dashTasksInit(); }
  if (!Array.isArray(_dashTasks)) { _dashTasks = []; }

  {
   // ── Modo criação — insere atividade real no Supabase (tabela atividades) ──
   // Motivo: antes, novas atividades ficavam só no localStorage do navegador
   // (nunca chegavam ao banco), por isso ficavam invisíveis no Gestor de
   // Tarefas, no Meu Painel e para os demais usuários.
   if (!_sb || !_dbOk) {
    _showToast('Sem conexão com o banco. Não é possível criar a atividade agora.', 'erro');
    return;
   }
   var respEmails = _nomesStrToEmails(mae.responsavel);
   var linhaBase = {
    titulo:         mae.titulo,
    tipo_atividade: mae.tipo_atividade,
    area:           mae.area,
    responsavel:    respEmails,
    prioridade:     mae.prioridade,
    status:         mae.status,
    observacoes:    mae.observacoes || null,
    criado_por:     (_currentUser && _currentUser.id) || null,
    visibilidade:   privVisibilidade
   };

   var linhas = [Object.assign({}, linhaBase, {
    data_inicio: mae.data_inicio || null,
    data_prazo:  mae.data_fim    || null,
    subtasks:    subtasksParaSalvar
   })];

   _taskDrawerClose();
   _showToast('Salvando...', 'ok');
   _sb.from('atividades').insert(linhas).select()
    .then(function(res) {
     if (res.error) {
      _showToast('Erro ao criar atividade: ' + _supaErrPt(res.error.message), 'erro');
      return;
     }
     // Compartilhamento explícito (privacidade "Pessoas específicas") só na atividade-mãe
     if (res.data && res.data[0] && res.data[0].id) {
      _privSaveShares(res.data[0].id, privModo, privShares);
     }
     // Vínculos de obra/projeto/melhoria e responsáveis (agora vivem em junction tables)
     (res.data || []).forEach(function(row) {
      _syncAtividadeVinculos(row.id, mae.obra_id || null, mae.projeto_id || null, mae.melhoria_id || null);
      _syncAtividadeResponsaveis(row.id, respEmails);
     });
     _histLogAdd('criou', mae.titulo, 'Área: ' + (mae.area || '—') + ' · Prioridade: ' + (mae.prioridade || '—'));
     _histBadgeUpdate();
     _showToast('Atividade criada com sucesso!', 'ok');
     // Recarrega Gestor de Tarefas e Meu Painel para refletir a nova atividade
     if (typeof _gestorLoad === 'function') _gestorLoad();
     _dashLoad();
    })
    .catch(function(e) { _showToast('Erro: ' + e.message, 'erro'); });
  }
 } catch(e) {
  console.error('[MilaTec] Erro ao salvar atividade:', e);
  _showToast('Erro ao salvar: ' + e.message, 'erro');
 }
}

// _dashUpdateProgress removida (limpeza técnica): calculava a partir de
// _dashTasks, que está sempre vazio (widget legado retirado — ver
// dashboard.js linhas iniciais). Os mesmos elementos (#dash-pb-*,
// #dash-ring-*) já são preenchidos de verdade por _dashUpdateKPIsFromDB,
// com dados reais do Supabase — essa função nunca era chamada.

// _dashRenderAgenda removida (limpeza técnica): alvo (#dash-agenda-list)
// não existe mais em index.html — o widget "Agenda" foi removido da tela,
// função nunca era chamada.

/* ── DASHBOARD — DADOS AO VIVO ──────────────────────────────────────── */

// _projDrawerOpen/_projDrawerClose/_projDrawerLoad/_projFc/_projDrawerFilter/
// _projDrawerRender/_projDrawerGoDetail removidas (limpeza técnica): esse
// drawer de busca de "Meus Projetos" (#proj-drw) ficou sem nenhum gatilho
// que o abrisse — _projDrawerOpen() não tinha caller em lugar nenhum, então
// toda a cadeia (fechar/filtrar/renderizar, que só existiam pra servir esse
// drawer) ficou inalcançável junto. Confirmado que não é regressão: clicar
// num projeto em "Meus Projetos" hoje já usa outro caminho, _spProjetoGoto
// (abaixo), que navega pra página Projetos e abre a linha — funcionando.

// Abre o painel do Projeto pelo id, navegando até a tabela de Projetos
function _spProjetoGoto(id) {
 if (!id) return;
 go('projetos');
 var tentativas = 0;
 function tentarAbrir() {
  var row = document.querySelector('#proj-tbody tr[data-id="' + id + '"]');
  if (row) { row.click(); return; }
  tentativas++;
  if (tentativas < 15) { setTimeout(tentarAbrir, 200); return; }
  if (typeof _dbLoadProjetos === 'function') _dbLoadProjetos().then(function(){
   var r2 = document.querySelector('#proj-tbody tr[data-id="' + id + '"]');
   if (r2) r2.click();
  });
 }
 setTimeout(tentarAbrir, 100);
}

function _dashRenderObras(projetos) {
 var list = document.getElementById('dash-obras-list');
 if (!list) return;
 if (!projetos || !projetos.length) {
  list.innerHTML = '<div class="proj-empty"><div class="proj-empty-icon"><svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="var(--muted)" stroke-width="1.5"><path d="M1 14V7l6-5 6 5v7"/><path d="M6 14v-4h4v4"/></svg></div><div class="proj-empty-title">Sem projetos ativos</div><div class="proj-empty-sub">Nenhum projeto encontrado para este responsável.</div></div>'; return;
 }
 var etapaClsMap = {
  'Orçamento':             'by',
  'Aguardando Aprovação':  'by',
  'Análise Inicial':       'bb',
  'Pré-Projeto':           'bb',
  'Revisão Pré-Projeto':   'by',
  'Projeto para aprovação':'bb',
  'Revisão Executivo':     'by',
  'Projeto Executivo':     'bg',
  'Ajuste de Piloto':      'bm'
 }; /* etapaClsMap */
 // Lista um item por PROJETO (não agrupado por obra) — já vem ordenado por
 // created_at desc na busca. O nome do projeto é o protagonista; a obra
 // aparece só como informação secundária na linha de baixo.
 list.innerHTML = projetos.map(function(p) {
  var nomeProjeto = p.nome || 'Projeto sem nome';
  var nomeObra = (p.obra && p.obra.nome) ? p.obra.nome : '';
  var etapa = p.etapa_projeto || 'Sem etapa';
  var cls = etapaClsMap[etapa] || 'bm';
  var words = nomeProjeto.split(' ').filter(function(w){ return w.length > 2; });
  var initials = words.slice(0, 2).map(function(w){ return w[0]; }).join('').toUpperCase() || '?';
  var click = p.id ? '_spProjetoGoto(\'' + p.id + '\')' : '';
  return '<div class="my-obra" onclick="' + click + '" title="' + nomeProjeto.replace(/"/g,'&quot;') + (nomeObra ? ' — Obra: ' + nomeObra.replace(/"/g,'&quot;') : '') + '">'
   + '<div class="my-obra-icon" style="background:var(--blue-dim);color:var(--navy)">' + initials + '</div>'
   + '<div style="flex:1;min-width:0">'
   + '<div class="my-obra-title">' + nomeProjeto + '</div>'
   + (nomeObra ? '<div class="my-obra-sub">Obra: ' + nomeObra + '</div>' : '')
   + '</div>'
   + '<span class="badge ' + cls + ' my-obra-badge" title="' + etapa.replace(/"/g,'&quot;') + '">' + etapa + '</span>'
   + '</div>';
 }).join('');
}

/* Clique em item do feed — abre drawer de edição pré-populado */
function _feedItemClick(el, ativDireto) {
 try {
  // Suporte a chamada direta com objeto (ex: via lembrete vinculado)
  var a = ativDireto || null;
  if (!a) {
   var raw = el ? el.getAttribute('data-ativ') : null;
   if (!raw) return;
   a = JSON.parse(raw.replace(/&#39;/g,"'"));
  }
  if (!a || !a.id) return;

  // Antes esta função tinha sua própria pré-população manual do drawer,
  // usada sempre que a atividade não estava em _dashTasks (que na prática é
  // sempre — esse array legado nunca é mais preenchido). Isso duplicava (e
  // fazia pior) o que _taskDrawerOpen já faz: pulava _ntPrivacidadeSet (podia
  // salvar a atividade com a privacidade errada), não resetava _drwSubItems
  // (subtarefas de uma tarefa vazavam pra próxima aberta), não setava
  // window._drwCurrentTask (quebrava "Solicitar Colaboração") e não populava
  // a aba Auditoria. _taskDrawerOpen já sabe achar a atividade em _gestorAllAt
  // /_dashAllAtRaw quando não está em _dashTasks, então basta delegar.
  _taskDrawerOpen(a.id);
 } catch(e) { console.warn('[feedItemClick]', e); }
}

function _dashRenderFeed(atividades) {
 var list = document.getElementById('dash-feed-list');
 var cnt  = document.getElementById('dash-feed-count');
 if (!list) return;
 if (!atividades || !atividades.length) {
  list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">Nenhuma atividade em aberto para você.</div>';
  if (cnt) cnt.textContent = '';
  return;
 }
 if (cnt) cnt.textContent = atividades.length + ' atividade' + (atividades.length !== 1 ? 's' : '');

 var hoje = new Date(); hoje.setHours(0,0,0,0);
 var amanha = new Date(hoje); amanha.setDate(hoje.getDate()+1);

 var statusColor = {
  'A fazer': 'var(--muted)', 'Em progresso': 'var(--navy)', 'Aguardando feedback': 'var(--yellow)',
  'Em andamento': 'var(--navy)', 'Pendente': 'var(--muted)'
 };
 var prioColor = { 'Alta': 'var(--red)', 'Média': 'var(--yellow)', 'Baixa': 'var(--green)' };

 function fmtDate(s) {
  if (!s) return null;
  var d = new Date(s + 'T00:00:00');
  if (isNaN(d)) return null;
  return d.getDate() + '/' + (d.getMonth()+1) + '/' + String(d.getFullYear()).slice(2);
 }
 function prazoInfo(s) {
  if (!s) return null;
  var d = new Date(s + 'T00:00:00');
  if (isNaN(d)) return null;
  if (d < hoje) return { label: 'ATRASADA · ' + fmtDate(s), clr: '#D6433C', bg: 'rgba(239,68,68,.1)', bold: true };
  if (d.toDateString() === hoje.toDateString()) return { label: 'HOJE · ' + fmtDate(s), clr: '#B8790A', bg: 'rgba(245,158,11,.1)', bold: true };
  return { label: fmtDate(s), clr: 'var(--muted)', bg: '', bold: false };
 }

 list.innerHTML = atividades.map(function(a) {
  var pi = prazoInfo(a.data_prazo);
  var st = a.status || '';
  var isConcluida = st === 'Concluída' || st === 'Concluida';
  var sc = isConcluida ? 'var(--green)' : (statusColor[st] || 'var(--muted)');
  var pc = prioColor[a.prioridade] || null;
  var ini = fmtDate(a.data_inicio);

  var isAtrasada = pi && a.data_prazo && new Date(a.data_prazo + 'T00:00:00') < hoje;

  // ── Múltiplos responsáveis: split por vírgula ou ponto-e-vírgula ──────────
  var respRaw = (a.responsavel || '').trim();
  var respList = respRaw
   ? respRaw.split(/[,;]+/).map(function(r){ return r.trim(); }).filter(Boolean)
   : [];
  var isMultiResp = respList.length > 1;
  var respHtml = '';
  if (respList.length) {
   respHtml = '<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:4px;align-items:center">'
    + '<span style="font-size:9px;color:var(--muted);margin-right:1px">Resp.:</span>'
    + respList.map(function(r) {
     var short = r.indexOf('@') > -1 ? r.split('@')[0] : r.split(' ')[0];
     return '<span style="font-size:9px;padding:1px 6px;border-radius:3px;background:' + (isMultiResp ? 'var(--navy-dim)' : 'var(--surface2)') + ';color:' + (isMultiResp ? 'var(--navy)' : 'var(--muted)') + ';font-weight:600" title="' + r + '">' + short + '</span>';
    }).join('')
    + (isMultiResp ? '<span style="font-size:9px;color:var(--navy);font-weight:600"> · compartilhada</span>' : '')
    + '</div>';
  }

  // Antes havia uma bolinha aqui que marcava a atividade como concluída num
  // clique — fácil de acionar sem querer, e já existe uma forma clara de
  // fazer isso (campo Status = Concluída, no editor). Removida — ver
  // _feedConcluir (também removida).
  var aId = JSON.stringify(a);
  return '<div data-ativ=\'' + aId.replace(/'/g,'&#39;') + '\' style="display:flex;align-items:flex-start;gap:10px;padding:10px 16px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .12s;' + (isConcluida ? 'opacity:.55' : '') + '" onmouseover="this.style.background=\'var(--surface2)\';this.querySelector(\'.feed-edit-hint\').style.opacity=\'1\'" onmouseout="this.style.background=\'\';this.querySelector(\'.feed-edit-hint\').style.opacity=\'0\'" onclick="_feedItemClick(this)">'

   + '<div style="flex:1;min-width:0">'
   + '<div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px;display:flex;align-items:center;gap:5px;' + (isConcluida ? 'text-decoration:line-through;color:var(--muted)' : '') + '">'
   + (a.titulo || '(sem título)')
   + (a.visibilidade === 'privada' ? '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="var(--muted)" stroke-width="1.6" style="flex-shrink:0" title="Atividade privada"><rect x="3.5" y="7" width="9" height="6.5" rx="1.2"/><path d="M5.5 7V5a2.5 2.5 0 015 0v2"/></svg>' : '')
   + '</div>'
   + '<div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-bottom:2px">'
   + (a.area ? '<span style="font-size:10px;padding:1px 5px;border-radius:3px;background:var(--surface2);color:var(--muted)">' + a.area + '</span>' : '')
   + '<span style="font-size:10px;padding:1px 5px;border-radius:3px;background:var(--surface2);color:' + sc + ';font-weight:600">' + st + '</span>'
   + (pc ? '<span style="font-size:10px;padding:1px 5px;border-radius:3px;background:var(--surface2);color:' + pc + '">' + a.prioridade + '</span>' : '')
   + '</div>'
   + (a._obraNome || a._projNome || a._melhNome
     ? '<div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:2px">'
       + (a._obraNome ? '<span class="gestor-rel-badge gestor-rel-obra" title="Obra/Orçamento: ' + a._obraNome.replace(/"/g,'&quot;') + '">OB</span>' : '')
       + (a._projNome ? '<span class="gestor-rel-badge gestor-rel-proj" title="Projeto: ' + a._projNome.replace(/"/g,'&quot;') + (a._etapaProjeto ? ' &middot; ' + a._etapaProjeto.replace(/"/g,'&quot;') : '') + '">PR</span>' : '')
       + (a._melhNome ? '<span class="gestor-rel-badge gestor-rel-melh" title="Melhoria: ' + a._melhNome.replace(/"/g,'&quot;') + '">ML</span>' : '')
       + '</div>'
     : '')
   + respHtml
   + '<div style="display:flex;gap:10px;font-size:10px;margin-top:3px">'
   + (ini ? '<span style="color:var(--muted)">Início: <b>' + ini + '</b></span>' : '')
   + (pi ? '<span style="' + (pi.bg ? 'background:'+pi.bg+';padding:1px 5px;border-radius:3px;' : '') + 'color:' + pi.clr + ';font-weight:' + (pi.bold?'700':'400') + '">' + (ini ? '· ' : '') + 'Prazo: ' + pi.label + '</span>' : '')
   + '</div>'
   + '</div>'
   + '<div class="feed-edit-hint" style="opacity:0;transition:opacity .15s;flex-shrink:0;display:flex;align-items:center;color:var(--muted)">'
   + '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M11 2l3 3-9 9H2v-3l9-9z"/></svg>'
   + '</div>'
   + '</div>';
 }).join('');
}

/* ── SEÇÃO INICIATIVAS DE INOVAÇÃO ─────────────────────────────────── */
// Motivo: renderiza melhorias do Supabase filtradas pelo responsável logado.
// O modelo visual usa inic-card — semelhante a proj-card mas mais leve,
// focado em status e tipo de iniciativa (P&D, Melhoria Interna, etc.)
function _dashRenderMelhorias(melhorias) {
 var list = document.getElementById('dash-inic-list');
 if (!list) return;
 if (!melhorias || !melhorias.length) {
  list.innerHTML = '<div style="padding:16px 0;color:var(--muted);font-size:12px;text-align:center">Nenhuma iniciativa encontrada para você.</div>';
  return;
 }
 var statusColor = {
  'Em andamento': 'var(--navy)',
  'Concluído':    'var(--green)',
  'Concluida':    'var(--green)',
  'Cancelado':    'var(--red)',
  'Pausado':      'var(--yellow)',
  'Backlog':      'var(--muted)',
  'Aprovado':     'var(--green)'
 };
 list.innerHTML = melhorias.slice(0, 6).map(function(m) {
  var nome   = m.nome || m.titulo || m.name || 'Sem título';
  var status = m.status || m.etapa || '';
  var tipo   = m.tipo || m.categoria || m.tipo_melhoria || m.area || '';
  var cor    = statusColor[status] || 'var(--muted)';
  var badgeStatus = status
   ? '<span class="inic-badge" style="color:' + cor + ';border-color:' + cor + '20">' + status + '</span>'
   : '';
  var badgeTipo = tipo
   ? '<span class="inic-badge">' + tipo + '</span>'
   : '';
  return '<div class="inic-card">'
   + '<div class="inic-card-nome">' + nome + '</div>'
   + '<div class="inic-card-meta">' + badgeStatus + badgeTipo + '</div>'
   + '</div>';
 }).join('');
}

/* ── Globals para chart interativo ─────────────────────────────────────────── */
var _dashSemanasRaw  = [];   // cache de atividades concluídas (12 meses)
var _dashAllAtRaw    = [];   // cache de todas as atividades (para re-render Status)
var _dashFeedRaw      = [];   // cache do feed antes do filtro "Somente para mim"
// '' | 'so_eu' | 'especificos' — os dois filtros são mutuamente exclusivos
// (uma atividade privada é ou "Somente para mim" ou "Pessoas específicas",
// nunca as duas). Antes existia uma aba "Privadas" separada mostrando as
// duas categorias lado a lado; isso duplicava o mesmo filtro que já existia
// aqui no feed — removida, os dois botões abaixo cobrem o mesmo caso.
var _dashPrivFiltro = localStorage.getItem('milatec-dash-priv-filtro') || '';
var _dashCompartilhadosIds = new Set(); // ids de atividades privadas do feed com compartilhamento ("Pessoas específicas")

function _dashSyncPrivFiltroBotoes() {
 var btnSoEu = document.getElementById('dash-feed-somente-eu');
 var btnEspecificos = document.getElementById('dash-feed-especificos');
 [[btnSoEu, 'so_eu'], [btnEspecificos, 'especificos']].forEach(function(pair) {
  var btn = pair[0], modo = pair[1];
  if (!btn) return;
  var ativo = _dashPrivFiltro === modo;
  btn.style.background = ativo ? 'var(--navy)' : 'var(--surface2)';
  btn.style.color = ativo ? '#fff' : 'var(--muted)';
  btn.style.borderColor = ativo ? 'var(--navy)' : 'var(--border)';
 });
}

// Achado real: o filtro contava número de responsáveis (<=1) em vez de
// checar a privacidade de verdade — uma atividade PÚBLICA com um único
// responsável entrava aqui, e uma PRIVADA compartilhada com várias pessoas
// ficava de fora. Ver scripts/lib/privacidade-atividade.js.
function _dashTogglePrivFiltro(modo) {
 _dashPrivFiltro = (_dashPrivFiltro === modo) ? '' : modo;
 localStorage.setItem('milatec-dash-priv-filtro', _dashPrivFiltro);
 _dashSyncPrivFiltroBotoes();
 _dashRenderFeed(_dashApplyPrivFiltro(_dashFeedRaw));
}
function _dashApplyPrivFiltro(atividades) {
 if (_dashPrivFiltro === 'so_eu') return _filtrarSomentePraMim(atividades, _dashCompartilhadosIds);
 if (_dashPrivFiltro === 'especificos') return _filtrarPessoasEspecificas(atividades, _dashCompartilhadosIds);
 return atividades || [];
}
var _dashChartCfg    = (function(){
 try { return JSON.parse(localStorage.getItem('milatec-chart-cfg') || '{}'); } catch(e) { return {}; }
})();
// Defaults
if (!_dashChartCfg.periodo) _dashChartCfg.periodo = '8w';
if (!_dashChartCfg.tipo)    _dashChartCfg.tipo    = 'bar';

/* ── Enriquece atividades com nomes de Obra/Projeto/Melhoria/Etapa ─────────── */
async function _dashEnrichVinculos(items) {
 if (!_sb || !items || !items.length) return;
 var obraIds = [], projIds = [], melhIds = [];
 items.forEach(function(a){
  if (a.obra_id && obraIds.indexOf(a.obra_id) === -1) obraIds.push(a.obra_id);
  if (a.projeto_id && projIds.indexOf(a.projeto_id) === -1) projIds.push(a.projeto_id);
  if (a.melhoria_id && melhIds.indexOf(a.melhoria_id) === -1) melhIds.push(a.melhoria_id);
 });
 var obraMap = {}, projMap = {}, etapaMap = {}, melhMap = {};
 var jobs = [];
 if (obraIds.length) jobs.push(_sb.from('obras').select('id, nome').in('id', obraIds).then(function(r){
  (r.data||[]).forEach(function(o){ obraMap[o.id] = o.nome; });
 }));
 if (projIds.length) jobs.push(_sb.from('projetos').select('id, nome, etapa_projeto').in('id', projIds).then(function(r){
  (r.data||[]).forEach(function(p){ projMap[p.id] = p.nome; if (p.etapa_projeto) etapaMap[p.id] = p.etapa_projeto; });
 }));
 if (melhIds.length) jobs.push(_sb.from('melhorias').select('id, nome').in('id', melhIds).then(function(r){
  (r.data||[]).forEach(function(m){ melhMap[m.id] = m.nome; });
 }));
 await Promise.all(jobs);
 items.forEach(function(a){
  if (a.obra_id)    a._obraNome    = obraMap[a.obra_id]    || (_gestorObrasMap && _gestorObrasMap[String(a.obra_id)])    || '';
  if (a.projeto_id) {
   a._projNome    = projMap[a.projeto_id]  || (_gestorProjMap && _gestorProjMap[String(a.projeto_id)]) || '';
   a._etapaProjeto = etapaMap[a.projeto_id] || (_gestorProjEtapaMap && _gestorProjEtapaMap[String(a.projeto_id)]) || '';
  }
  if (a.melhoria_id) a._melhNome = melhMap[a.melhoria_id] || (_gestorMelhMap && _gestorMelhMap[String(a.melhoria_id)]) || '';
 });
}

async function _dashLoad() {
 function _dashSyncStatus(ok, msg) {
  var dot = document.getElementById('dash-sync-dot');
  var lbl = document.getElementById('dash-sync-label');
  if (dot) dot.style.background = ok ? 'var(--green)' : 'var(--red)';
  if (lbl) lbl.textContent = msg || '';
 }
 if (!_dbOk) {
  _dashRenderFeed([]); _dashRenderObras([]); _dashRenderMelhorias([]);
  // '—' (não '0'): sem conexão é "desconhecido", não "zero atrasadas".
  ['dash-kpi-hoje','dash-kpi-atr','dash-kpi-andamento','dash-kpi-prox','dash-kpi-conclusao','dash-kpi-abertas','dash-proj-count'].forEach(function(id){var e=document.getElementById(id);if(e)e.textContent='—';});
  _dashSyncStatus(false, 'Sem conexão com Supabase');
  return;
 }
 var userEmail = (_currentUser && _currentUser.email) || localStorage.getItem('milatec-user-email') || '';

 // Atrasadas/Em Andamento/A Fazer: RPC leve, disparada já e em paralelo —
 // não espera a carga paginada completa de atividades abaixo (que existe
 // pra alimentar feed/gráficos, não os 3 KPIs headline).
 _dashLoadKpisRpc();

 await _loadUsuariosCache();
 await _loadAtividadeVinculosCache();

 try {
  // ── Todas as atividades do usuário (para KPIs + gráficos) ─────────────────
  // Motivo da paginação: o PostgREST do Supabase tem um teto interno de 1000
  // linhas por requisição, mesmo pedindo .limit(5000) — usuários com muito
  // histórico (ex.: 2400+ atividades) ficavam só com as ~1000 mais antigas
  // (por data_prazo), todas já concluídas, e nunca viam as atividades em
  // aberto (mais recentes) no feed. Por isso paginamos com .range() até
  // trazer tudo, igual ao padrão já usado em _dbLoadObras/_dbLoadEmpresas.
  // atividades.responsavel agora é text[] de e-mail — usamos .contains()
  // (nativo do supabase-js) em vez de montar string crua para .or().
  async function _dashFetchPaginado(selectCols, extra) {
   var all = [], from = 0, pageSize = 1000, more = true;
   while (more) {
    var q = _sb.from('atividades').select(selectCols);
    if (extra) q = extra(q);
    if (userEmail) q = q.contains('responsavel', [userEmail]);
    q = q.range(from, from + pageSize - 1);
    var r = await q;
    if (r.error) { console.error('[Dashboard] erro paginando atividades:', r.error); break; }
    var rows = r.data || [];
    all = all.concat(rows);
    more = rows.length === pageSize;
    from += pageSize;
   }
   return all;
  }

  var atPromise = _dashFetchPaginado(
   'id, titulo, observacoes, status, prioridade, area, tipo, tipo_atividade, data_prazo, data_inicio, responsavel, updated_at, subtasks, visibilidade, criado_por',
   function(q){ return q.order('data_prazo', { ascending: true }); }
  ).then(function(rows){ return _enrichAtividades(rows); });

  // ── Por área (para gráfico) ───────────────────────────────────────────────
  var areaPromise = _dashFetchPaginado('area, status');

  // ── Conclusões por período (12 meses — cache para filtros dinâmicos) ──────
  // Nota: data_prazo é usada como proxy da data de conclusão (quando o prazo caía).
  // Para precisão total seria necessário um campo data_conclusao na tabela.
  var dozeMeses = new Date();
  dozeMeses.setFullYear(dozeMeses.getFullYear() - 1);
  var semPromise = _dashFetchPaginado(
   'data_prazo, status, updated_at',
   function(q){ return q.in('status', ['Feito', 'Concluído']).gte('data_prazo', dozeMeses.toISOString().substring(0,10)).order('data_prazo', { ascending: true }); }
  );

  // ── Meus Projetos — projetos.responsavel também guarda nomes, não e-mail ──
  // Ordenado do mais recente para o mais antigo (created_at desc)
  var projQ = _sb.from('projetos')
   .select('id, nome, obra_id, etapa_projeto, responsavel, created_at, obra:obra_id(nome, empresas_obras(empresa:empresa_id(nome)))')
   .order('created_at', { ascending: false })
   .limit(200);
  if (userEmail) projQ = projQ.contains('responsavel', [userEmail]);

  var [allAt, areaAt, semAt, projRes] = await Promise.all([atPromise, areaPromise, semPromise, projQ]);

  var meusProjetos = projRes.data || [];
  meusProjetos.forEach(function(p){ if (Array.isArray(p.responsavel)) p.responsavel = _emailsToNomes(p.responsavel); });
  // Armazena no cache global para re-renders sem nova query
  _dashAllAtRaw   = allAt;
  _dashSemanasRaw = semAt;
  // Restaura preferência salva de período/tipo na UI
  _chartRestoreUI();
  var agora = new Date().toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
  _dashSyncStatus(true, 'Supabase · ' + allAt.length + ' atividades · ' + agora);

  // Cache para o KPI drawer
   _kpiDrawerAtividades = allAt;
   // ── Feed: não concluídas, atrasadas primeiro ──────────────────────────────
  var hoje = new Date(); hoje.setHours(0,0,0,0);
  var feedData = allAt
   .filter(function(a){ return a.status !== 'Feito' && a.status !== 'Concluído' && a.status !== 'Obsoleto'; })
   .sort(function(a,b){
    var dA = a.data_prazo ? new Date(a.data_prazo+'T00:00:00').getTime() : Infinity;
    var dB = b.data_prazo ? new Date(b.data_prazo+'T00:00:00').getTime() : Infinity;
    var atA = dA < hoje.getTime() ? 0 : 1;
    var atB = dB < hoje.getTime() ? 0 : 1;
    if (atA !== atB) return atA - atB;
    return dA - dB;
   })
   .slice(0, 15);
 } catch(errPrep) {
  console.error('[Dashboard] Erro ao preparar atividades:', errPrep);
 }

 // ── Feed de atividades — prioridade máxima: tem que aparecer mesmo se o
 // resto (KPIs, gráficos, alertas) falhar por algum motivo abaixo.
 try {
  await _dashEnrichVinculos(feedData || []);
  _dashFeedRaw = feedData || [];
  // Compartilhamento das privadas do feed — sem isso, o filtro "Somente
  // para mim" trata "Pessoas específicas" como "Somente para mim" também.
  // Ver scripts/lib/privacidade-atividade.js.
  _dashCompartilhadosIds = new Set();
  var idsPrivadasFeed = _dashFeedRaw.filter(function(a){ return a.visibilidade === 'privada'; }).map(function(a){ return a.id; });
  if (idsPrivadasFeed.length) {
   try {
    var compFeed = await _sb.from('atividades_compartilhamento').select('atividade_id').in('atividade_id', idsPrivadasFeed);
    (compFeed.data || []).forEach(function(row){ _dashCompartilhadosIds.add(row.atividade_id); });
   } catch(eComp) {}
  }
  _dashSyncPrivFiltroBotoes();
  _dashRenderFeed(_dashApplyPrivFiltro(_dashFeedRaw));
 } catch(errFeed) {
  console.error('[Dashboard] Erro ao renderizar feed:', errFeed);
 }

 try {
  // ── KPIs + Ring ───────────────────────────────────────────────────────────
  _dashUpdateKPIsFromDB(allAt || []);

  // ── KPI extra: próximos 14d + taxa conclusão ──────────────────────────────
  var amanha14 = new Date(hoje); amanha14.setDate(hoje.getDate()+14);
  var prox14 = (allAt||[]).filter(function(a){
   var d = a.data_prazo ? new Date(a.data_prazo+'T00:00:00') : null;
   return d && d >= hoje && d <= amanha14 && a.status !== 'Feito' && a.status !== 'Concluído';
  }).length;
  var total = (allAt||[]).length;
  var feitas = (allAt||[]).filter(function(a){return a.status === 'Feito' || a.status === 'Concluído';}).length;
  var taxaPct = total > 0 ? Math.round(feitas * 100 / total) : 0;
  var kP = document.getElementById('dash-kpi-prox'); if(kP) kP.textContent = prox14;
  var kC = document.getElementById('dash-kpi-conclusao'); if(kC) kC.textContent = taxaPct + '%';

  // Alertas comportamentais — usa dados do Supabase (allAt tem campos updated_at/created_at)
  // Injeta no _dashTasks-like structure para _dashBuildAlerts poder processar
  window._dashAlertsData = allAt;
  _dashBuildAlertsFromDB(allAt || []);

  // ── Gráfico: atividades por área ──────────────────────────────────────────
  _dashRenderChartAreas(areaAt || []);

  // ── Gráfico: conclusões por semana ────────────────────────────────────────
  _dashRenderChartSemanas(semAt || []);

  // ── Gráfico: status geral ─────────────────────────────────────────────────
  _dashRenderChartStatus(allAt || []);

 } catch(err) {
  console.error('[Dashboard] Erro:', err);
 }

 // ── Meus Projetos — isolado em try/catch próprio: uma falha aqui não pode
 // travar a renderização das atividades acima, que já terminou neste ponto.
 try {
  _dashRenderObras(meusProjetos || []);
  var projCountEl = document.getElementById('dash-proj-count');
  if (projCountEl) projCountEl.textContent = (meusProjetos || []).length + ' projeto' + ((meusProjetos||[]).length !== 1 ? 's' : '');
 } catch(errProj) {
  console.error('[Dashboard] Erro ao renderizar Meus Projetos:', errProj);
 }

 // ── Melhorias (sem filtro usuário — tabela pode não ter responsavel) ───────
 try {
  var melhRes = await _sb.from('melhorias')
   .select('id, airtable_id, nome, area, created_at, updated_at')
   .order('created_at', { ascending: false }).limit(10);
  _dashRenderMelhorias(melhRes.data || []);
  var mEl = document.getElementById('dash-melhoria-count');
  if (mEl) mEl.textContent = (melhRes.data || []).length;
 } catch(e) { _dashRenderMelhorias([]); }

 // Inicia lembretes Supabase + Realtime
 _remLoadInbox();
 _remLoadColab();
 _remStartRealtime();
 _navBadgesStartRealtimeAll();
 // Central de Colaborações (localStorage)
 _ccLoad();
}

// ── Gráfico: barras semanais ──────────────────────────────────────────────────
/* ── Controles interativos do gráfico de semanas ─────────────────────────── */
function _chartSavePref() {
 try { localStorage.setItem('milatec-chart-cfg', JSON.stringify(_dashChartCfg)); } catch(e) {}
}

function _chartRestoreUI() {
 // Período
 var p = _dashChartCfg.periodo || '8w';
 document.querySelectorAll('.chart-period-btn').forEach(function(b){ b.classList.remove('active'); });
 var activeBtn = document.getElementById('cpb-' + p);
 if (activeBtn) activeBtn.classList.add('active');
 var customRange = document.getElementById('chart-custom-range');
 if (customRange) customRange.classList.toggle('visible', p === 'custom');
 // Datas personalizadas
 if (p === 'custom' && _dashChartCfg.customIni) {
  var ci = document.getElementById('chart-custom-ini'); if (ci) ci.value = _dashChartCfg.customIni;
  var cf = document.getElementById('chart-custom-fim'); if (cf) cf.value = _dashChartCfg.customFim || '';
 }
 // Tipo
 var t = _dashChartCfg.tipo || 'bar';
 var bBar  = document.getElementById('chart-tipo-bar');
 var bLine = document.getElementById('chart-tipo-line');
 if (bBar)  bBar.classList.toggle('active',  t === 'bar');
 if (bLine) bLine.classList.toggle('active', t === 'line');
}

function _chartSetPeriodo(p) {
 _dashChartCfg.periodo = p;
 _chartSavePref();
 _chartRestoreUI();
 _chartRenderCurrent();
}
function _chartSetTipo(t) {
 _dashChartCfg.tipo = t;
 _chartSavePref();
 _chartRestoreUI();
 _chartRenderCurrent();
}
function _chartRenderCurrent() {
 _dashRenderChartSemanas(_dashSemanasRaw);
}

function _dashRenderChartSemanas(dados) {
 var el   = document.getElementById('dash-chart-semanas');
 var lbEl = document.getElementById('dash-chart-semanas-labels');
 if (!el) return;
 // Guarda para re-renders
 if (dados && dados.length) _dashSemanasRaw = dados;
 var src = _dashSemanasRaw;

 var p    = _dashChartCfg.periodo || '8w';
 var tipo = _dashChartCfg.tipo    || 'bar';
 var hoje = new Date(); hoje.setHours(0,0,0,0);

 // ── Calcular janela e buckets ────────────────────────────────────────────
 var buckets = [];
 var janIni, janFim = new Date(hoje);

 if (p === '7d') {
  // 7 dias — buckets diários
  janIni = new Date(hoje); janIni.setDate(hoje.getDate() - 6);
  for (var i = 0; i < 7; i++) {
   var d = new Date(janIni); d.setDate(janIni.getDate() + i);
   buckets.push({ date: new Date(d), next: null, count: 0, label: d.getDate() + '/' + (d.getMonth()+1) });
  }
  buckets.forEach(function(b,i){ b.next = buckets[i+1] ? buckets[i+1].date : new Date(janFim.getTime() + 86400000); });
 } else if (p === '3m') {
  // 3 meses — buckets semanais (~13 semanas)
  var nWeeks = 13;
  janIni = new Date(hoje); janIni.setDate(hoje.getDate() - (nWeeks - 1) * 7);
  janIni.setDate(janIni.getDate() - ((janIni.getDay() + 6) % 7));
  for (var i = 0; i < nWeeks; i++) {
   var d = new Date(janIni); d.setDate(janIni.getDate() + i * 7);
   var lbl = i === 0 || d.getDate() <= 7 ? d.getDate() + '/' + (d.getMonth()+1) : d.getDate() + '';
   buckets.push({ date: new Date(d), count: 0, label: lbl });
  }
  buckets.forEach(function(b,i){ b.next = buckets[i+1] ? buckets[i+1].date : new Date(janFim.getTime() + 86400000 * 7); });
 } else if (p === '6m') {
  // 6 meses — buckets mensais
  for (var i = 5; i >= 0; i--) {
   var d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
   var prox = new Date(d.getFullYear(), d.getMonth() + 1, 1);
   var labels6 = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
   buckets.push({ date: d, next: prox, count: 0, label: labels6[d.getMonth()] });
  }
  janIni = buckets[0].date;
 } else if (p === '12m') {
  // 12 meses — buckets mensais
  for (var i = 11; i >= 0; i--) {
   var d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
   var prox = new Date(d.getFullYear(), d.getMonth() + 1, 1);
   var labels12 = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
   buckets.push({ date: d, next: prox, count: 0, label: labels12[d.getMonth()] + (i === 11 || d.getMonth() === 0 ? ' ' + (d.getFullYear()+'').slice(2) : '') });
  }
  janIni = buckets[0].date;
 } else if (p === 'custom') {
  var ciEl = document.getElementById('chart-custom-ini');
  var cfEl = document.getElementById('chart-custom-fim');
  var iniStr = ciEl ? ciEl.value : '';
  var fimStr = cfEl ? cfEl.value : '';
  if (!iniStr || !fimStr) {
   el.innerHTML = '<div style="font-size:11px;color:var(--muted);text-align:center;padding:20px 0">Selecione o período personalizado acima.</div>';
   if (lbEl) lbEl.innerHTML = '';
   return;
  }
  _dashChartCfg.customIni = iniStr; _dashChartCfg.customFim = fimStr; _chartSavePref();
  janIni = new Date(iniStr + 'T00:00:00');
  janFim = new Date(fimStr + 'T23:59:59');
  var diffDays = Math.ceil((janFim - janIni) / 86400000);
  var bucketDays = diffDays <= 14 ? 1 : diffDays <= 60 ? 7 : 30;
  var cur = new Date(janIni);
  while (cur <= janFim) {
   var next = new Date(cur); next.setDate(cur.getDate() + bucketDays);
   var lbl = cur.getDate() + '/' + (cur.getMonth()+1);
   buckets.push({ date: new Date(cur), next: new Date(next), count: 0, label: lbl });
   cur = next;
  }
 } else {
  // 8w — padrão
  var nW = 8;
  var base = new Date(hoje); base.setDate(hoje.getDate() - (nW - 1) * 7);
  base.setDate(base.getDate() - ((base.getDay() + 6) % 7));
  for (var i = 0; i < nW; i++) {
   var d = new Date(base); d.setDate(base.getDate() + i * 7);
   buckets.push({ date: new Date(d), count: 0, label: d.getDate() + '/' + (d.getMonth()+1) });
  }
  buckets.forEach(function(b,i){ b.next = buckets[i+1] ? buckets[i+1].date : new Date(hoje.getTime() + 86400000 * 7); });
  janIni = buckets[0].date;
 }

 if (!buckets.length) { el.innerHTML = '<div style="font-size:11px;color:var(--muted);text-align:center">Sem período</div>'; return; }

 // ── Distribuir dados nos buckets ─────────────────────────────────────────
 // Usa data_prazo como proxy de conclusão (melhor proxy disponível sem campo data_conclusao)
 src.forEach(function(a) {
  if (!a.data_prazo) return;
  var dp = new Date(a.data_prazo + 'T00:00:00');
  for (var i = 0; i < buckets.length; i++) {
   var bNext = buckets[i].next;
   if (dp >= buckets[i].date && (!bNext || dp < bNext)) { buckets[i].count++; break; }
  }
 });

 var maxVal = Math.max(1, Math.max.apply(null, buckets.map(function(s){ return s.count; })));
 var chartH  = 100; // altura útil em px

 // ── Estatísticas comuns (usadas por ambos os modos) ──────────────────────
 var totalCntAll = buckets.reduce(function(s,b){ return s + b.count; }, 0);
 var avgVal = totalCntAll > 0 ? totalCntAll / buckets.length : 0;
 var maxIdx = 0;
 buckets.forEach(function(b,i){ if (b.count > buckets[maxIdx].count) maxIdx = i; });

 // ── Direção de tendência (calculada aqui para colorir o próprio gráfico) ─
 var _tmid  = Math.floor(buckets.length / 2);
 var _tSumA = buckets.slice(0, _tmid).reduce(function(s,b){ return s + b.count; }, 0);
 var _tSumB = buckets.slice(_tmid).reduce(function(s,b){ return s + b.count; }, 0);
 var trendDir   = (_tSumB > _tSumA) ? 'up' : (_tSumB < _tSumA) ? 'down' : 'neutral';
 var trendColor = trendDir === 'up' ? '#1F8A4C' : trendDir === 'down' ? '#D6433C' : '#0183FF';

 // ── MODO LINHA ────────────────────────────────────────────────────────────
 if (tipo === 'line') {
  var padL = 5; var padR = 5; var padT = 15; var padB = 5;
  var n = buckets.length;
  var useH = 100 - padT - padB; // altura útil em % do viewBox

  // Converter para coordenadas % (0-100)
  var pts = buckets.map(function(b, i) {
   var x = n > 1 ? padL + (i / (n - 1)) * (100 - padL - padR) : 50;
   var y = padT + (1 - (maxVal > 0 ? b.count / maxVal : 0)) * useH;
   return { x: x, y: y, count: b.count, isMax: i === maxIdx };
  });
  var lastPt = pts[pts.length - 1];

  // Bezier suave com tensão calibrada pela variação dos dados
  var variance = 0;
  for (var vi = 1; vi < pts.length; vi++) variance += Math.abs(pts[vi].y - pts[vi-1].y);
  var tension = variance / pts.length > 12 ? 0.25 : 0.38; // menos tensão quando há muita variação

  function _lineBezier(points) {
   if (!points.length) return '';
   var d = 'M' + points[0].x.toFixed(2) + ' ' + points[0].y.toFixed(2);
   for (var k = 1; k < points.length; k++) {
    var p0 = points[k-1], p1 = points[k];
    var cpx1 = (p0.x + (p1.x - p0.x) * tension).toFixed(2);
    var cpx2 = (p1.x - (p1.x - p0.x) * tension).toFixed(2);
    d += ' C' + cpx1 + ' ' + p0.y.toFixed(2) + ' ' + cpx2 + ' ' + p1.y.toFixed(2) + ' ' + p1.x.toFixed(2) + ' ' + p1.y.toFixed(2);
   }
   return d;
  }

  var linePath = _lineBezier(pts);
  var areaClose = ' L' + lastPt.x.toFixed(2) + ' ' + (padT + useH).toFixed(2)
   + ' L' + pts[0].x.toFixed(2) + ' ' + (padT + useH).toFixed(2) + ' Z';
  var areaPath = linePath + areaClose;

  // Grid lines: 0%, 50%, 100% do maxVal
  var gridSvg = '';
  [0.25, 0.5, 0.75].forEach(function(pct) {
   var gy = (padT + (1 - pct) * useH).toFixed(1);
   gridSvg += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (100 - padR) + '" y2="' + gy
    + '" stroke="currentColor" stroke-opacity=".07" stroke-width="0.5"/>';
  });

  // Linha de média dashed
  var avgSvg = '';
  if (avgVal > 0 && avgVal < maxVal) {
   var avgY = (padT + (1 - avgVal / maxVal) * useH).toFixed(1);
   avgSvg = '<line x1="' + padL + '" y1="' + avgY + '" x2="' + (100 - padR) + '" y2="' + avgY
    + '" stroke="#0183FF" stroke-opacity=".45" stroke-width="0.6" stroke-dasharray="2.5 2"/>';
  }

  // Dots HTML: apenas pontos com valor > 0, máximo e último destacados
  // Labels: apenas pico, último e todos quando n<=7
  var dotsHtml = pts.map(function(pt, i) {
   var isLast = i === pts.length - 1;
   if (pt.count === 0 && !isLast) return ''; // omite zeros (exceto último)
   var isPeak = pt.isMax && pt.count > 0;
   var dotSz  = isPeak ? 8 : isLast ? 7 : 5;
   var dotClr = isPeak ? '#1F8A4C' : isLast ? 'var(--navy)' : '#0183FF';
   var lblClr = isPeak ? '#1F8A4C' : 'var(--navy)';
   var showLbl = pt.count > 0 && (isPeak || isLast || n <= 7);
   var dot = '<div style="position:absolute;left:' + pt.x + '%;top:' + pt.y + '%;transform:translate(-50%,-50%);'
    + 'width:' + dotSz + 'px;height:' + dotSz + 'px;border-radius:50%;'
    + 'background:' + dotClr + ';border:1.5px solid var(--surface)'
    + (isPeak ? ';box-shadow:0 0 0 2px rgba(40,181,72,.25)' : '')
    + '"></div>';
   var lbl = showLbl
    ? '<div style="position:absolute;left:' + pt.x + '%;top:calc(' + pt.y + '% - 13px);transform:translateX(-50%);'
      + 'font-size:8px;font-weight:700;color:' + lblClr + ';white-space:nowrap;line-height:1;pointer-events:none">'
      + pt.count + '</div>'
    : '';
   return dot + lbl;
  }).join('');

  // "Média" label no fim da linha de média (posicionado como div absoluto)
  var avgLabel = (avgVal > 0 && avgVal < maxVal)
   ? '<div style="position:absolute;right:' + padR + '%;top:' + (padT + (1 - avgVal / maxVal) * useH - 8) + '%;font-size:7px;color:var(--navy);opacity:.7;white-space:nowrap;pointer-events:none">med</div>'
   : '';

  // Dots: pico em trendColor, último em navy, demais em trendColor mais claro
  var dotsHtml = pts.map(function(pt, i) {
   var isLast = i === pts.length - 1;
   if (pt.count === 0 && !isLast) return '';
   var isPeak = pt.isMax && pt.count > 0;
   var dotSz  = isPeak ? 8 : isLast ? 7 : 5;
   var dotClr = isPeak ? trendColor : isLast ? 'var(--navy)' : trendColor;
   var lblClr = isPeak ? trendColor : 'var(--navy)';
   var showLbl = pt.count > 0 && (isPeak || isLast || n <= 7);
   var dot = '<div style="position:absolute;left:' + pt.x + '%;top:' + pt.y + '%;transform:translate(-50%,-50%);'
    + 'width:' + dotSz + 'px;height:' + dotSz + 'px;border-radius:50%;'
    + 'background:' + dotClr + ';border:1.5px solid var(--surface)'
    + (isPeak ? ';box-shadow:0 0 0 3px ' + trendColor.replace('#','').length === 6 ? trendColor + '33' : 'rgba(0,0,0,.15)' : '')
    + '"></div>';
   var lbl = showLbl
    ? '<div style="position:absolute;left:' + pt.x + '%;top:calc(' + pt.y + '% - 13px);transform:translateX(-50%);'
      + 'font-size:8px;font-weight:700;color:' + lblClr + ';white-space:nowrap;line-height:1;pointer-events:none">'
      + pt.count + '</div>'
    : '';
   return dot + lbl;
  }).join('');

  el.innerHTML = '<div style="position:relative;width:100%;height:100%">'
   + '<svg style="position:absolute;top:0;left:0;width:100%;height:100%;display:block" viewBox="0 0 100 100" preserveAspectRatio="none" color="var(--text)">'
   + '<defs>'
   + '<linearGradient id="lgChLine" x1="0" y1="0" x2="0" y2="1">'
   + '<stop offset="0%" stop-color="' + trendColor + '" stop-opacity=".18"/>'
   + '<stop offset="100%" stop-color="' + trendColor + '" stop-opacity="0"/>'
   + '</linearGradient></defs>'
   + gridSvg
   + '<path d="' + areaPath + '" fill="url(#lgChLine)"/>'
   + '<path d="' + linePath + '" fill="none" stroke="' + trendColor + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>'
   + avgSvg
   + '</svg>'
   + dotsHtml
   + avgLabel
   + '</div>';
  el.style.alignItems = 'stretch';
  el.style.position = 'relative';

 } else {
  // ── MODO BARRAS ────────────────────────────────────────────────────────
  el.style.alignItems = 'flex-end';
  el.style.position = 'relative';
  var totalBuckets = buckets.length;

  // Calcula alturas para usar no SVG de tendência
  var barHeights = buckets.map(function(s) {
   return Math.max(3, Math.round((s.count / maxVal) * (chartH - 14)));
  });

  // Linha de tendência: conecta média das barras iniciais → média das barras finais
  var half = Math.floor(totalBuckets / 2);
  var avgFirst = barHeights.slice(0, half).reduce(function(s,v){ return s+v; }, 0) / Math.max(half, 1);
  var avgLast  = barHeights.slice(half).reduce(function(s,v){ return s+v; }, 0) / Math.max(totalBuckets - half, 1);
  // y1/y2 em % da altura do container (el), contando de baixo para cima
  var tLineY1 = avgFirst / chartH * 100;
  var tLineY2 = avgLast  / chartH * 100;
  // SVG de tendência (sobre as barras, não bloqueando interação)
  var trendLineSvg = '<svg style="position:absolute;bottom:0;left:0;width:100%;height:' + chartH + 'px;pointer-events:none;overflow:visible" viewBox="0 0 100 ' + chartH + '" preserveAspectRatio="none">'
   + '<defs><linearGradient id="trendLG" x1="0" y1="0" x2="1" y2="0">'
   + '<stop offset="0%" stop-color="' + trendColor + '" stop-opacity=".5"/>'
   + '<stop offset="100%" stop-color="' + trendColor + '" stop-opacity="1"/>'
   + '</linearGradient></defs>'
   + '<line x1="2" y1="' + (chartH - avgFirst).toFixed(1) + '" x2="98" y2="' + (chartH - avgLast).toFixed(1) + '"'
   + ' stroke="url(#trendLG)" stroke-width="1.5" stroke-dasharray="4 3" stroke-linecap="round" vector-effect="non-scaling-stroke"/>'
   // Seta no final
   + '<circle cx="98" cy="' + (chartH - avgLast).toFixed(1) + '" r="3" fill="' + trendColor + '"/>'
   + '</svg>';

  // Barras direto no el (sem wrapper extra) — el já é flex container
  el.style.gap = '3px';
  el.innerHTML = buckets.map(function(s, i) {
    var h = barHeights[i];
    var isLast = i === totalBuckets - 1;
    var isPeak = i === maxIdx && s.count > 0 && !isLast;
    var clr = isLast ? 'var(--navy)' : isPeak ? trendColor : (s.count > 0 ? 'var(--navy)' : 'var(--border)');
    var opacity = s.count === 0 ? '.3' : '1';
    var lblClr = isPeak ? trendColor : isLast ? 'var(--navy)' : 'var(--muted)';
    var showLbl = s.count > 0 && (isPeak || isLast || totalBuckets <= 8);
    return '<div style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end">'
     + '<div style="font-size:9px;font-weight:700;height:14px;line-height:14px;color:' + lblClr + ';text-align:center">' + (showLbl ? s.count : '') + '</div>'
     + '<div style="width:100%;border-radius:3px 3px 0 0;background:' + clr + ';opacity:' + opacity + ';height:' + h + 'px;transition:height .35s ease"></div>'
     + '</div>';
   }).join('')
   + trendLineSvg;
 }

 // ── Labels ─────────────────────────────────────────────────────────────
 if (lbEl) {
  var totalB = buckets.length;
  // Mostrar labels espaçados para não sobrepor
  var skipEvery = totalB <= 8 ? 1 : totalB <= 13 ? 2 : totalB <= 26 ? 3 : Math.ceil(totalB / 8);
  lbEl.innerHTML = buckets.map(function(s, i) {
   var isLast = i === totalB - 1;
   var show = (i % skipEvery === 0) || isLast;
   return '<div style="flex:1;text-align:center;font-size:8px;overflow:hidden;color:' + (isLast ? 'var(--navy)' : 'var(--muted)') + ';font-weight:' + (isLast ? '700' : '400') + '">' + (show ? s.label : '') + '</div>';
  }).join('');
 }

 // ── Título dinâmico ───────────────────────────────────────────────────────
 var titles = { '7d':'Concluídas — 7 dias', '8w':'Concluídas — 8 semanas', '3m':'Concluídas — 3 meses', '6m':'Concluídas — 6 meses', '12m':'Concluídas — 12 meses', 'custom':'Concluídas — período personalizado' };
 var titleEl = document.getElementById('dash-semanas-title');
 if (titleEl) titleEl.textContent = titles[p] || 'Concluídas por período';

 // ── Trend header: tendência + média + pico ────────────────────────────────
 var trendEl = document.getElementById('dash-chart-trend');
 if (trendEl && buckets.length >= 2) {
  var totalCnt = buckets.reduce(function(s,b){ return s + b.count; }, 0);
  var avg = totalCnt / buckets.length;

  // Tendência: compara primeira metade vs segunda metade
  var mid = Math.floor(buckets.length / 2);
  var sumFirst  = buckets.slice(0, mid).reduce(function(s,b){ return s + b.count; }, 0);
  var sumSecond = buckets.slice(mid).reduce(function(s,b){ return s + b.count; }, 0);
  var trendPct = sumFirst > 0 ? Math.round(((sumSecond - sumFirst) / sumFirst) * 100) : 0;
  // Reutiliza trendDir calculado no início (ou recalcula para o footer)
  var tFDir = sumSecond > sumFirst ? 'up' : sumSecond < sumFirst ? 'down' : 'neutral';
  var tFClr = tFDir === 'up' ? '#1F8A4C' : tFDir === 'down' ? '#D6433C' : '#8b949e';
  var tFBg  = tFDir === 'up' ? 'rgba(40,181,72,.12)' : tFDir === 'down' ? 'rgba(207,34,46,.1)' : 'var(--surface2)';
  var tFBrd = tFDir === 'up' ? 'rgba(40,181,72,.3)'  : tFDir === 'down' ? 'rgba(207,34,46,.25)' : 'var(--border)';
  var tFWord= tFDir === 'up' ? 'Crescimento' : tFDir === 'down' ? 'Queda' : 'Estável';
  var tFPct = ''; // percentual removido — direção visual já está no gráfico
  var tFArrow = tFDir === 'up'
   ? '<svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,9 6,3 10,9"/></svg>'
   : tFDir === 'down'
   ? '<svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,3 6,9 10,3"/></svg>'
   : '<svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="2" y1="6" x2="10" y2="6"/></svg>';

  // Pico
  var peakBucket = buckets[maxIdx];
  var peakLabel  = peakBucket && peakBucket.count > 0 ? peakBucket.count + ' em ' + peakBucket.label : '';

  trendEl.innerHTML =
   '<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:6px;'
   + 'background:' + tFBg + ';border:1px solid ' + tFBrd + ';color:' + tFClr + ';font-size:11px;font-weight:700;line-height:1">'
   + tFArrow + tFWord + tFPct + '</span>'
   + '<span style="font-size:10px;color:var(--muted)">Média: <strong style="color:var(--text)">' + avg.toFixed(1) + '</strong>/período</span>'
   + (peakLabel ? '<span style="font-size:10px;color:var(--muted);margin-left:auto">Pico: <strong style="color:var(--text)">' + peakLabel + '</strong></span>' : '');
  trendEl.style.display = 'flex';
 } else if (trendEl) {
  trendEl.style.display = 'none';
 }
}

// ── Gráfico: distribuição por área ────────────────────────────────────────────
function _dashRenderChartAreas(dados) {
 var el = document.getElementById('dash-chart-areas');
 if (!el) return;

 // Agrupa
 var areas = {};
 dados.forEach(function(a) {
  var area = (a.area || 'Sem área').trim();
  if (!areas[area]) areas[area] = { total: 0, abertas: 0, feitas: 0 };
  areas[area].total++;
  if (a.status === 'Feito' || a.status === 'Concluído') areas[area].feitas++;
  else if (a.status !== 'Obsoleto') areas[area].abertas++;
 });

 var sorted = Object.keys(areas).sort(function(a,b){ return areas[b].total - areas[a].total; }).slice(0,6);
 if (!sorted.length) { el.innerHTML = '<div style="color:var(--muted);font-size:11px">Sem dados</div>'; return; }
 var maxTotal = Math.max(1, sorted.reduce(function(m,k){ return Math.max(m, areas[k].total); }, 0));

 el.innerHTML = sorted.map(function(area) {
  var d = areas[area];
  var pctTotal = Math.round(d.total * 100 / maxTotal);
  var pctFeitas = d.total > 0 ? Math.round(d.feitas * 100 / d.total) : 0;
  return '<div style="display:flex;align-items:center;gap:8px">'
   + '<div style="font-size:10px;color:var(--text);font-weight:500;width:72px;text-align:right;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + area + '</div>'
   + '<div style="flex:1;background:var(--border);border-radius:3px;height:10px;position:relative;overflow:hidden">'
   + '<div style="position:absolute;left:0;top:0;height:100%;background:var(--navy);border-radius:3px;width:' + pctFeitas + '%;opacity:.9"></div>'
   + '<div style="position:absolute;left:0;top:0;height:100%;background:rgba(99,102,241,.2);border-radius:3px;width:' + pctTotal + '%"></div>'
   + '</div>'
   + '<div style="font-size:9px;color:var(--muted);width:28px;text-align:right;flex-shrink:0">' + d.total + '</div>'
   + '</div>';
 }).join('');
}

// ── Gráfico: status geral (mini barras horizontais) ───────────────────────────
function _dashRenderChartStatus(dados) {
 var el = document.getElementById('dash-chart-status');
 if (!el) return;
 if (!dados || !dados.length) {
  el.innerHTML = '<div style="font-size:11px;color:var(--muted);text-align:center;padding:16px 0">Sem dados</div>';
  return;
 }

 var today = new Date(); today.setHours(0,0,0,0);

 // ── Classificação de cada atividade (campo correto: data_prazo, não prazo) ──
 var cats = { concluidas: 0, andamento: 0, afazer: 0, atrasadas: 0, bloqueadas: 0 };
 var semPrazo = 0;
 var proximas = 0;       // prazo em ≤3 dias e não concluída
 var vencemHoje = 0;     // prazo = hoje, não concluída
 var vencemSemana = 0;   // prazo nos próximos 7 dias, não concluída, não atrasada
 var semAtualizacao = 0; // updated_at > 7 dias atrás e não concluída
 var semResponsavel = 0; // sem responsável definido, não concluída
 var cutoff7 = new Date(today.getTime() - 7 * 86400000);
 var hoje3   = new Date(today.getTime() + 3 * 86400000);
 var hoje7   = new Date(today.getTime() + 7 * 86400000);

 dados.forEach(function(a) {
  var status = (a.status || '').trim();
  var isDone    = status === 'Feito' || status === 'Concluído' || status === 'Concluida';
  var isBlocked = status === 'Bloqueado' || status === 'Bloqueada' || status === 'Impedida';

  // CAMPO CORRETO: data_prazo (não a.prazo que não existe no Supabase)
  var rawPrazo = a.data_prazo || null;
  var prazoDate = rawPrazo ? new Date(rawPrazo + 'T00:00:00') : null;

  // Atrasada: tem prazo, está no passado, não concluída
  var atrasada = !isDone && prazoDate && prazoDate < today;
  // Próxima: prazo existe, não atrasada, vence em ≤3 dias
  var proxima  = !isDone && prazoDate && !atrasada && prazoDate <= hoje3;

  // Bucket de categoria
  if (isDone)        { cats.concluidas++; }
  else if (atrasada) { cats.atrasadas++;  }
  else if (isBlocked){ cats.bloqueadas++; }
  else if (status === 'Em progresso' || status === 'Em andamento') { cats.andamento++; }
  else               { cats.afazer++;    }

  if (!rawPrazo && !isDone) semPrazo++;
  if (proxima) proximas++;

  // Vence hoje
  if (!isDone && prazoDate && prazoDate.getTime() === today.getTime()) vencemHoje++;
  // Vence esta semana (próximos 7 dias, não atrasada)
  if (!isDone && prazoDate && !atrasada && prazoDate > hoje3 && prazoDate <= hoje7) vencemSemana++;

  // Sem responsável
  var resp = (a.responsavel || '').trim();
  if (!isDone && !resp) semResponsavel++;

  // Sem atualização
  var updAt = a.updated_at || a.atualizado_em || null;
  if (!isDone && updAt && new Date(updAt) < cutoff7) semAtualizacao++;
 });

 var total = dados.length;

 // Itens do donut (excluindo zeros)
 var items = [
  { label: 'Concluídas',   count: cats.concluidas, hex: '#1F8A4C', cssVar: 'var(--green)' },
  { label: 'Em andamento', count: cats.andamento,  hex: '#0183FF', cssVar: 'var(--navy)'  },
  { label: 'A fazer',      count: cats.afazer,     hex: '#8b949e', cssVar: 'var(--muted)' },
  { label: 'Atrasadas',    count: cats.atrasadas,  hex: '#D6433C', cssVar: 'var(--red)'   },
  { label: 'Bloqueadas',   count: cats.bloqueadas, hex: '#B8790A', cssVar: 'var(--yellow)'}
 ].filter(function(x){ return x.count > 0; });

 // ── Donut SVG ──────────────────────────────────────────────
 var r = 36; var cx = 44; var cy = 44;
 var circ = 2 * Math.PI * r; // ≈ 226.2
 var svgSize = 88;
 var strokeW = 14;
 var gap = 2; // gap in px between segments

 var segments = '';
 var cum = 0;
 items.forEach(function(item) {
  var segLen = (item.count / total) * circ;
  var gapOffset = items.length > 1 ? gap : 0;
  var adjustedLen = Math.max(segLen - gapOffset, 0);
  // dasharray: segLen + gap (as gap) then rest
  segments += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none"'
   + ' stroke="' + item.hex + '"'
   + ' stroke-width="' + strokeW + '"'
   + ' stroke-linecap="butt"'
   + ' stroke-dasharray="' + adjustedLen.toFixed(2) + ' ' + circ.toFixed(2) + '"'
   + ' stroke-dashoffset="' + (-(cum - circ / 4)).toFixed(2) + '"'
   + ' style="transition:stroke-dashoffset .4s"/>';
  cum += segLen;
 });

 // Se nenhum item (todos zero — só mostra anel vazio)
 if (!items.length) segments = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="var(--border)" stroke-width="' + strokeW + '"/>';

 var pctDone = total > 0 ? Math.round(cats.concluidas * 100 / total) : 0;

 var donutHtml = '<div class="status-donut-chart" style="position:relative;width:' + svgSize + 'px;height:' + svgSize + 'px">'
  + '<svg width="' + svgSize + '" height="' + svgSize + '" viewBox="0 0 ' + svgSize + ' ' + svgSize + '">'
  + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="var(--border)" stroke-width="' + strokeW + '"/>'
  + segments
  + '</svg>'
  + '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;pointer-events:none">'
  + '<span style="font-size:18px;font-weight:800;color:var(--text);line-height:1">' + pctDone + '%</span>'
  + '<span style="font-size:9px;color:var(--muted);margin-top:1px">concluído</span>'
  + '</div>'
  + '</div>';

 // ── Legenda ──────────────────────────────────────────────
 var legendHtml = '<div class="status-donut-legend">'
  + items.map(function(item) {
   var pct = Math.round(item.count * 100 / total);
   return '<div class="status-donut-row">'
    + '<div class="status-donut-dot" style="background:' + item.hex + '"></div>'
    + '<span class="status-donut-lbl">' + item.label + '</span>'
    + '<span style="font-size:10px;color:var(--muted);margin-right:4px">' + pct + '%</span>'
    + '<span class="status-donut-cnt">' + item.count + '</span>'
    + '</div>';
  }).join('')
  + '</div>';

 // SVG icons inline — sem emojis (padrão corporativo)
 var _ico = {
  danger: '<svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 1.5L11 10.5H1L6 1.5z"/><line x1="6" y1="5" x2="6" y2="7.5"/><circle cx="6" cy="9.2" r=".4" fill="currentColor" stroke="none"/></svg>',
  ok:     '<svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="4.5"/><polyline points="3.5,6 5.5,8 8.5,4"/></svg>',
  clock:  '<svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="6" cy="6" r="4.5"/><polyline points="6,3.5 6,6 8,7"/></svg>',
  pause:  '<svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor"><rect x="2.5" y="2.5" width="2.8" height="7" rx=".6"/><rect x="6.7" y="2.5" width="2.8" height="7" rx=".6"/></svg>',
  dot:    '<svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="4" cy="4" r="2.8"/></svg>',
  check:  '<svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,6 5,9 10,3"/></svg>'
 };

 // ── Insights ──────────────────────────────────────────────
 var insights = [];
 if (cats.atrasadas > 0) {
  insights.push({ cls: 'danger', icon: _ico.danger, text: cats.atrasadas + ' atividade' + (cats.atrasadas > 1 ? 's' : '') + ' atrasada' + (cats.atrasadas > 1 ? 's' : '') });
 } else {
  insights.push({ cls: 'ok', icon: _ico.ok, text: 'Nenhuma atividade atrasada' });
 }
 if (proximas > 0) {
  insights.push({ cls: 'warn', icon: _ico.clock, text: proximas + ' venc' + (proximas > 1 ? 'em' : 'e') + ' em até 3 dias' });
 }
 if (semAtualizacao > 0) {
  insights.push({ cls: 'warn', icon: _ico.pause, text: semAtualizacao + ' sem atualização há +7 dias' });
 }
 if (semPrazo > 0) {
  insights.push({ cls: 'neutral', icon: _ico.dot, text: semPrazo + ' sem prazo definido' });
 }
 if (cats.concluidas === total && total > 0) {
  insights = [{ cls: 'ok', icon: _ico.check, text: 'Todas as atividades concluídas' }];
 }

 var insightsHtml = insights.length
  ? '<div class="status-insights">'
   + insights.map(function(i) {
    return '<div class="status-insight-chip ' + i.cls + '">'
     + '<span style="flex-shrink:0">' + i.icon + '</span>'
     + '<span>' + i.text + '</span>'
     + '</div>';
   }).join('')
   + '</div>'
  : '';

 // ── Painel de Saúde Operacional ── sem donut, foco em tomada de decisão ──────

 // Colaborações pendentes (recebidas pelo usuário atual, ainda não respondidas)
 // Nota: preenchido de forma assíncrona por _dashUpdateColabPendCount() e
 // cacheado em window._colabPendCount — este render em si é síncrono, então
 // usamos o último valor conhecido (0 antes da primeira carga).
 var colabPend = window._colabPendCount || 0;

 // SVG arrow (→) inline para itens acionáveis
 var arrSvg = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="hp-arrow"><line x1="2" y1="5" x2="8" y2="5"/><polyline points="5.5,2.5 8,5 5.5,7.5"/></svg>';

 // ── Seção: Requer Atenção ─────────────────────────────────────────────────
 function _hpRow(dotColor, label, count, filter, urgent) {
  var bg   = urgent && count > 0 ? (dotColor === '#D6433C' ? 'rgba(207,34,46,.06)' : dotColor === '#B8790A' ? 'rgba(180,83,9,.06)' : 'transparent') : 'transparent';
  var clr  = urgent && count > 0 ? dotColor : 'var(--text)';
  var cnt  = count > 0 ? count : '—';
  var cntClr = count > 0 ? clr : 'var(--muted)';
  var onclick = filter && count > 0 ? ' onclick="_kpiDrawerOpen(\'' + filter + '\')"' : '';
  var clickCls = filter && count > 0 ? ' clickable' : '';
  return '<div class="hp-row' + clickCls + '" style="background:' + bg + '"' + onclick + '>'
   + '<div class="hp-dot" style="background:' + dotColor + ';opacity:' + (count > 0 ? 1 : .25) + '"></div>'
   + '<span class="hp-label" style="color:' + (count > 0 && urgent ? clr : 'var(--muted)') + '">' + label + '</span>'
   + '<span class="hp-count" style="color:' + cntClr + '">' + cnt + '</span>'
   + (filter && count > 0 ? arrSvg : '')
   + '</div>';
 }

 var atencaoHtml = '<div class="hp-section-lbl">Requer Atenção</div>'
  + _hpRow('#D6433C', 'Atrasadas', cats.atrasadas, 'atr', true)
  + _hpRow('#B8790A', 'Vencem em até 3 dias', proximas, 'prox3', proximas > 0)
  + _hpRow('#0183FF', 'Colaborações pendentes', colabPend, null, colabPend > 0)
  + _hpRow('#8b949e', 'Sem atualização há +7d', semAtualizacao, null, false)
  + _hpRow('#8b949e', 'Sem prazo definido', semPrazo, 'abertas', false);

 var vencHtml = '<hr class="hp-divider">'
  + '<div class="hp-section-lbl">Próximos Vencimentos</div>'
  + _hpRow('#D6433C', 'Vencem hoje', vencemHoje, 'hoje', vencemHoje > 0)
  + _hpRow('#B8790A', 'Vencem esta semana', vencemSemana, 'prox7', vencemSemana > 0);

 var alertasHtml = '<hr class="hp-divider">'
  + '<div class="hp-section-lbl">Alertas</div>'
  + _hpRow('#8b949e', 'Sem responsável', semResponsavel, null, semResponsavel > 0)
  + _hpRow('#B8790A', 'Bloqueadas', cats.bloqueadas, null, cats.bloqueadas > 0);

 // ── Seção: Execução ──────────────────────────────────────────────────────
 var pctBar = Math.min(100, pctDone);
 var barColor = pctDone >= 75 ? '#1F8A4C' : pctDone >= 50 ? '#0183FF' : '#B8790A';

 var execHtml = '<hr class="hp-divider">'
  + '<div class="hp-section-lbl">Execução do Período</div>'
  + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'
  + '<span style="font-size:22px;font-weight:800;color:' + barColor + ';line-height:1">' + pctDone + '%</span>'
  + '<div style="flex:1">'
  + '<div style="font-size:10px;color:var(--muted);margin-bottom:3px">taxa de conclusão</div>'
  + '<div class="hp-bar-wrap"><div class="hp-bar-fill" style="width:' + pctBar + '%;background:' + barColor + '"></div></div>'
  + '</div>'
  + '</div>'
  + '<div style="display:flex;gap:10px;flex-wrap:wrap">'
  + '<span style="font-size:10px;color:var(--muted)"><span style="font-weight:700;color:#1F8A4C">' + cats.concluidas + '</span> concluídas</span>'
  + '<span style="font-size:10px;color:var(--muted)"><span style="font-weight:700;color:#8b949e">' + (cats.afazer + cats.andamento) + '</span> abertas</span>'
  + (cats.atrasadas > 0 ? '<span style="font-size:10px;color:var(--muted)"><span style="font-weight:700;color:#D6433C">' + cats.atrasadas + '</span> atrasadas</span>' : '')
  + '<span onclick="_kpiDrawerOpen(\'abertas\')" style="font-size:10px;color:var(--navy);cursor:pointer;text-decoration:underline;text-underline-offset:2px;margin-left:auto">ver todas</span>'
  + '</div>';

 el.innerHTML = '<div style="display:flex;flex-direction:column;height:100%;justify-content:flex-start;gap:0">'
  + atencaoHtml
  + vencHtml
  + alertasHtml
  + execHtml
  + '</div>';
}

/* ── Central de Comunicação Interna (unificada) ──────────────────────────── */
var _commCurrentTab = 'inbox';

// Mapeia tab → painel HTML
var _commPanels = { inbox: 'rem-panel-inbox', sent: 'rem-panel-sent' };

function _commTab(tab, btn) {
 _commCurrentTab = tab;
 _remCurrentTab  = tab; // sincroniza variável legada usada por _remDelete/_remSend
 // Esconde todos os painéis
 Object.keys(_commPanels).forEach(function(k) {
  var p = document.getElementById(_commPanels[k]);
  if (p) p.style.display = 'none';
 });
 // Mostra o painel correto
 var active = document.getElementById(_commPanels[tab]);
 if (active) active.style.display = '';
 // Atualiza tabs
 document.querySelectorAll('.comm-tab').forEach(function(b){ b.classList.remove('active'); });
 if (btn) btn.classList.add('active');
 // Carrega dados conforme a aba
 if (tab === 'sent')  { _remLoadSent(); }
 if (tab === 'inbox') { _remLoadInbox(); }
}



/* ── Central de Colaborações ──────────────────────────────────────────────── */
var _ccCurrentTab = 'recv';

function _ccLoad() {
 if (!_currentUser || !_currentUser.email) return;
 // Pré-renderiza badge
 _ccRenderPanel('cr');
}

async function _ccRenderPanel(tab) {
 // tab: 'cr' = colab recebidas, 'cs' = colab solicitadas, 'done' = concluídas/recusadas
 var elId = tab === 'cr' ? 'cc-list-cr' : tab === 'cs' ? 'cc-list-cs' : 'cc-list-done';
 var el = document.getElementById(elId);
 if (!el) return;

 var email = ((_currentUser && _currentUser.email) || '').toLowerCase();
 if (!email) {
  el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:11px">Login necessário</div>';
  return;
 }

 var allColab = await _colabReqBuscar(function(r){
  return (r.solicitante_email||'').toLowerCase() === email || (r.receptor_email||'').toLowerCase() === email;
 });

 var recv = allColab.filter(function(r){
  return (r.receptor_email||'').toLowerCase() === email && r.status !== 'Concluída' && r.status !== 'Recusada';
 });
 var sent = allColab.filter(function(r){
  return (r.solicitante_email||'').toLowerCase() === email && r.status !== 'Concluída' && r.status !== 'Recusada';
 });
 var done = allColab.filter(function(r){
  var isParty = (r.receptor_email||'').toLowerCase() === email || (r.solicitante_email||'').toLowerCase() === email;
  return isParty && (r.status === 'Concluída' || r.status === 'Recusada');
 });

 // Badge
 var pend = recv.filter(function(r){ return r.status === 'Pendente'; }).length;
 var brecv = document.getElementById('cc-badge-recv');
 var bcomm = document.getElementById('comm-pend-badge');
 if (brecv) { brecv.style.display = pend > 0 ? '' : 'none'; brecv.textContent = pend; }
 if (bcomm) { bcomm.style.display = pend > 0 ? '' : 'none'; bcomm.textContent = pend + ' pendente' + (pend !== 1 ? 's' : ''); }

 var list = tab === 'cr' ? recv : tab === 'cs' ? sent : done;
 var emptyMsgs = { cr: 'Nenhuma colaboração recebida em aberto', cs: 'Nenhuma colaboração solicitada em aberto', done: 'Nenhuma colaboração concluída ainda' };

 if (!list.length) {
  el.innerHTML = '<div style="padding:20px 16px;text-align:center">'
   + '<div style="font-size:11px;color:var(--muted)">' + (emptyMsgs[tab]||'') + '</div>'
   + '</div>';
  return;
 }

 var statusClass = { 'Pendente':'ccs-pendente','Aceita':'ccs-aceita','Em andamento':'ccs-andamento','Aguardando retorno':'ccs-aguardando','Concluída':'ccs-concluida','Recusada':'ccs-recusada' };
 var isRecv = tab === 'cr';

 el.innerHTML = list.map(function(r) {
  var outra = isRecv ? (r.solicitante_nome || r.solicitante_email || '?') : (r.receptor_nome || r.receptor_email || '?');
  var role = isRecv ? 'De: ' : 'Para: ';
  var sc = statusClass[r.status] || 'ccs-aguardando';
  var prazoTxt = r.prazo ? ' · ' + r.prazo : '';
  var ativTxt = r.atividade_titulo || 'Atividade';
  return '<div class="colab-cc-card">'
   + '<div style="display:flex;align-items:center;gap:6px">'
   + '<span style="font-size:11px;font-weight:600;color:var(--text);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + ativTxt + '</span>'
   + '<span class="colab-cc-status ' + sc + '">' + r.status + '</span>'
   + '</div>'
   + '<div style="font-size:10px;color:var(--muted)">' + role + '<strong style="color:var(--text)">' + outra + '</strong>' + prazoTxt + '</div>'
   + (r.motivo ? '<div style="font-size:10px;color:var(--muted)">' + r.motivo + '</div>' : '')
   + '</div>';
 }).join('');
}

// ── Meu Painel: Atrasadas / Em Andamento / A Fazer via RPC ──────────────────
// Mesma fonte de verdade do Gestor de Tarefas (rpc_atividades_kpis), só que
// escopada ao usuário logado via p_responsavel — garante que os números
// batam entre as duas telas (mesma regra: exclui Obsoleto de tudo, prioriza
// atrasada sobre em_andamento pra não contar em dobro). Calculada em SQL
// (COUNT/FILTER), não sobre o array _dashAllAtRaw já carregado — escala
// independente de quantas atividades o usuário tenha.
var _dashKpisRpcInFlight = false;
async function _dashLoadKpisRpc() {
 if (_dashKpisRpcInFlight) return;
 if (!_sb) return;
 var userEmail = (_currentUser && _currentUser.email) || localStorage.getItem('milatec-user-email') || '';
 var ids = ['dash-kpi-atr', 'dash-kpi-andamento', 'dash-kpi-abertas', 'nav-badge-painel'];
 _dashKpisRpcInFlight = true;
 try {
  var r = await _sb.rpc('rpc_atividades_kpis', { p_responsavel: userEmail || null });
  if (r.error) throw r.error;
  var row = Array.isArray(r.data) ? r.data[0] : r.data;
  if (!row) throw new Error('rpc_atividades_kpis sem retorno');
  var kA = document.getElementById('dash-kpi-atr');
  if (kA) { kA.textContent = row.atrasada; kA.style.color = row.atrasada > 0 ? 'var(--red)' : 'var(--green)'; }
  var kAnd = document.getElementById('dash-kpi-andamento');
  if (kAnd) kAnd.textContent = row.em_andamento;
  var kO = document.getElementById('dash-kpi-abertas');
  if (kO) kO.textContent = row.a_fazer;
  var kBadge = document.getElementById('nav-badge-painel');
  if (kBadge) kBadge.textContent = row.a_fazer; // mesma fonte do badge do menu lateral — nunca diverge
 } catch (e) {
  console.error('[Painel] Erro ao carregar KPIs (rpc_atividades_kpis):', e);
  ids.forEach(function(id) {
   var el = document.getElementById(id);
   if (el && !/^\d+$/.test((el.textContent || '').trim())) el.textContent = '—';
  });
 } finally {
  _dashKpisRpcInFlight = false;
 }
}

function _dashUpdateKPIsFromDB(atividades) {
 if(!atividades) return;
 var hoje=new Date();hoje.setHours(0,0,0,0);
 var amanha=new Date(hoje);amanha.setDate(hoje.getDate()+1);
 var diaSem=hoje.getDay();
 var seg=new Date(hoje);seg.setDate(hoje.getDate()-((diaSem+6)%7));
 var dom=new Date(seg);dom.setDate(seg.getDate()+6);dom.setHours(23,59,59,999);
 var inicioMes=new Date(hoje.getFullYear(),hoje.getMonth(),1);
 function parseDate(s){return s?new Date(s+'T00:00:00'):null;}
 function isDone(a){return a.status==='Feito'||a.status==='Concluído';}
 var paraHoje  =atividades.filter(function(a){var d=parseDate(a.data_prazo);return d&&d>=hoje&&d<amanha&&!isDone(a);}).length;
 var atrasadas =atividades.filter(function(a){var d=parseDate(a.data_prazo);return d&&d<hoje&&!isDone(a)&&a.status!=='Obsoleto';}).length;
 var semana    =atividades.filter(function(a){var d=parseDate(a.data_prazo);return d&&d>=seg&&d<=dom;});
 var semanaDone=semana.filter(isDone).length;var semanaTotal=semana.length;
 var semanaePct=semanaTotal?Math.round(semanaDone/semanaTotal*100):0;
 var mes=atividades.filter(function(a){var d=parseDate(a.data_prazo);return d&&d>=inicioMes;});
 var mesDone=mes.filter(isDone).length;var mesTotal=mes.length;
 var mesPct=mesTotal?Math.round(mesDone/mesTotal*100):0;
 var kH=document.getElementById('dash-kpi-hoje');if(kH)kH.textContent=paraHoje;
 var kS=document.getElementById('dash-kpi-semana');if(kS)kS.textContent=semanaePct+'%';
 // dash-kpi-atr / dash-kpi-andamento / dash-kpi-abertas NÃO são mais setados
 // aqui — vêm de rpc_atividades_kpis via _dashLoadKpisRpc(), pra baterem
 // exatamente com o Gestor de Tarefas (mesma regra, mesma fonte). `atrasadas`
 // segue calculada acima só porque o anel mensal (ringLate) ainda usa esse
 // número local.
 var fill=document.getElementById('dash-pb-fill');var pctEl=document.getElementById('dash-pb-pct');var countEl=document.getElementById('dash-pb-count');var labelEl=document.getElementById('dash-pb-label');
 var barClr=semanaePct>=80?'var(--green)':semanaePct>=40?'var(--navy)':'var(--yellow)';
 if(fill){fill.style.width=semanaePct+'%';fill.style.background=barClr;}if(pctEl){pctEl.textContent=semanaePct+'%';pctEl.style.color=barClr;}
 if(countEl)countEl.textContent=semanaDone+' de '+semanaTotal+' no total';if(labelEl)labelEl.textContent='Esta semana';
 var CIRCUNF=226.2;var ring=document.getElementById('dash-ring-fill');var ringPct=document.getElementById('dash-ring-pct');var ringSub=document.getElementById('dash-ring-sub');var ringDone=document.getElementById('dash-ring-done');var ringLate=document.getElementById('dash-ring-late');
 var ringClr=mesPct>=80?'var(--green)':mesPct>=40?'var(--navy)':'var(--yellow)';
 if(ring){ring.style.strokeDashoffset=(CIRCUNF-(mesPct/100)*CIRCUNF);ring.style.stroke=ringClr;}
 if(ringPct)ringPct.textContent=mesPct+'%';if(ringSub)ringSub.textContent=mesDone+' de '+mesTotal+' atividades';
 if(ringDone)ringDone.textContent=mesDone;if(ringLate)ringLate.textContent=atrasadas;
}

function _kpiDrawerOpen(filter) {
 _kpiDrawerFilter = filter;
 var cfg = _kpiConfig[filter];
 if (!cfg) return;

 // Header
 var title = document.getElementById('kpi-drw-title');
 var sub   = document.getElementById('kpi-drw-sub');
 if (title) title.innerHTML = '<span style="display:inline-flex;align-items:center;gap:7px;color:'+cfg.color+'">' + cfg.icon + cfg.title + '</span>';
 if (sub)   sub.textContent = cfg.desc;

 // Open animation
 var ov  = document.getElementById('kpi-drw-ov');
 var drw = document.getElementById('kpi-drw');
 if (ov)  ov.classList.add('open');
 if (drw) drw.classList.add('open');
 document.body.style.overflow = 'hidden';

 _kpiDrawerRender(filter);
}

// ── Fechar drawer ─────────────────────────────────────────────────────────
function _kpiDrawerClose() {
 var ov  = document.getElementById('kpi-drw-ov');
 var drw = document.getElementById('kpi-drw');
 if (ov)  ov.classList.remove('open');
 if (drw) drw.classList.remove('open');
 document.body.style.overflow = '';
}

// ── Renderizar conteúdo ───────────────────────────────────────────────────
function _kpiDrawerRender(filter) {
 var body   = document.getElementById('kpi-drw-body');
 var footer = document.getElementById('kpi-drw-footer');
 if (!body) return;

 var cfg  = _kpiConfig[filter];
 var hoje = new Date(); hoje.setHours(0,0,0,0);

 // Usa cache de atividades do Supabase + tarefas pessoais (localStorage)
 var allAt = (_kpiDrawerAtividades || []).concat(_dashTasks || []);

 var filtered = allAt.filter(function(a){ return cfg.filter(a, hoje); });

 if (footer) footer.textContent = filtered.length + ' item' + (filtered.length !== 1 ? 's' : '');

 if (!filtered.length) {
  body.innerHTML = '<div class="kpi-drw-empty"><svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="var(--border)" stroke-width="1.5" style="margin-bottom:12px"><rect x="4" y="4" width="24" height="24" rx="4"/><path d="M10 16h12M10 11h12M10 21h8"/></svg><div style="font-weight:600;margin-bottom:4px">Sem itens aqui</div><div style="font-size:11px">Nenhuma atividade neste filtro.</div></div>';
  return;
 }

 // Ordena: atrasadas primeiro, depois por prazo
 filtered.sort(function(a, b) {
  var dA = a.data_prazo || a.data_fim ? new Date((a.data_prazo||a.data_fim)+'T00:00:00').getTime() : Infinity;
  var dB = b.data_prazo || b.data_fim ? new Date((b.data_prazo||b.data_fim)+'T00:00:00').getTime() : Infinity;
  return dA - dB;
 });

 var priorClr = { 'Alta':'var(--red)', 'Média':'var(--yellow)', 'Baixa':'var(--muted)' };
 var statusClr = { 'Feito':'var(--green)', 'Concluído':'var(--green)', 'Em progresso':'var(--navy)', 'A fazer':'var(--muted)' };

 body.innerHTML = filtered.map(function(a) {
  var statusTrim = (a.status || '').trim();
  var isDone = statusTrim === 'Feito' || statusTrim === 'Concluído' || statusTrim === 'Concluida';
  var prazoStr = '';
  var dp = a.data_prazo || a.data_fim || '';
  // "Atraso"/"Hoje"/"Em Xd" só faz sentido pra quem ainda não terminou —
  // uma tarefa já concluída não está "atrasada" só porque o prazo passou
  // depois que ela foi feita.
  if (dp && !isDone) {
   var d = new Date(dp+'T00:00:00');
   var diff = Math.floor((d - hoje) / 86400000);
   if (diff < 0)     prazoStr = '<span style="color:#D6433C;font-weight:600">' + Math.abs(diff) + 'd atraso</span>';
   else if (diff===0) prazoStr = '<span style="color:#B8790A;font-weight:600">Hoje</span>';
   else               prazoStr = '<span style="color:var(--muted)">Em ' + diff + 'd</span>';
  }
  var dotColor = priorClr[a.prioridade] || 'var(--muted)';
  var statusTxt = a.status || 'A fazer';
  return '<div class="kpi-drw-item" onclick="_kpiDrawerItemClick(\'' + (a.id||'') + '\')">'
   + '<div class="kpi-drw-dot" style="background:' + dotColor + ';margin-top:4px"></div>'
   + '<div style="flex:1;min-width:0">'
   + '<div class="kpi-drw-name">' + (a.titulo || '—') + '</div>'
   + '<div class="kpi-drw-meta">'
   + (a.area ? '<span>' + a.area + '</span>' : '')
   + (statusTxt ? '<span style="color:' + (statusClr[statusTxt]||'var(--muted)') + '">' + statusTxt + '</span>' : '')
   + (a.prioridade ? '<span>' + a.prioridade + '</span>' : '')
   + (prazoStr ? prazoStr : '')
   + '</div>'
   + '</div>'
   + '</div>';
 }).join('');
}

// ── Clique em item do drawer ──────────────────────────────────────────────
function _kpiDrawerItemClick(id) {
 // Tarefas pessoais (localStorage) - abrir drawer de edição direta
 var task = (_dashTasks||[]).find(function(t){ return String(t.id) === String(id); });
 if (task) { _kpiDrawerClose(); _taskDrawerOpen(id); return; }
 // Atividades Supabase — abre drawer de edição via _feedItemClick
 var ativ = (_kpiDrawerAtividades||[]).find(function(a){ return String(a.id) === String(id); });
 if (ativ) { _kpiDrawerClose(); _feedItemClick(null, ativ); return; }
 _kpiDrawerClose();
}

// ESC para fechar
document.addEventListener('keydown', function(e) {
 if (e.key === 'Escape') _kpiDrawerClose();
});
