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

 var tipoLabel = { 'atr':'Prazo vencido', 'hoje':'Vence hoje', 'parada':'Tarefa parada', 'sem-atualizacao':'Sem atualização', 'inconsistente':'Status inconsistente' };
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
}



/* ── DASHBOARD — NOTAS PESSOAIS ─────────────────────────────────────── */
var _dashNotesTimer = null;

function _dashNotesChange() {
 var status = document.getElementById('dash-notes-status');
 if (status) status.textContent = 'Salvando...';
 clearTimeout(_dashNotesTimer);
 _dashNotesTimer = setTimeout(function() {
  try {
   var area = document.getElementById('dash-notes-area');
   var key = 'milatec-notes-' + (localStorage.getItem('pp-name') || 'Lorena').split(' ')[0].toLowerCase();
   localStorage.setItem(key, area ? area.value : '');
   if (status) {
    status.textContent = 'Salvo';
    setTimeout(function(){ if (status) status.textContent = ''; }, 2000);
   }
  } catch(e) {}
 }, 700);
}

function _dashLoadNotes() {
 try {
  var key = 'milatec-notes-' + (localStorage.getItem('pp-name') || 'Lorena').split(' ')[0].toLowerCase();
  var area = document.getElementById('dash-notes-area');
  if (area) area.value = localStorage.getItem(key) || '';
 } catch(e) {}
}

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
 // Melhorias é a única dessas 6 tabelas cujo contador inicial só é
 // preenchido dentro de _pageLoadMelhorias — ou seja, ficava em "—" até o
 // usuário abrir a página Melhorias pelo menos uma vez na sessão (achado
 // real, reportado como "cadê a tabela de Melhorias"). Busca a contagem
 // aqui também, no boot, igual às outras 5.
 var mb = document.getElementById('nav-badge-melhorias');
 if (mb) {
  _sb.from('melhorias').select('id', { count: 'exact', head: true }).then(function(r) {
   if (r.count != null) mb.textContent = r.count;
  }).catch(function(){});
 }
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
 var colors = ['#3D4FD1','#1F8A4C','#e07b00','#8B6FE8','#1f7ec4','#c44b1f'];
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
 if (!receptorSel || !receptorSel.value) { _showToast('Selecione um colaborador', 'erro'); return; }
 if (!motivoSel || !motivoSel.value)     { _showToast('Selecione o motivo da colaboração', 'erro'); return; }
 if (!_currentUser) { _showToast('Usuário não identificado', 'erro'); return; }
 var receptor = _respUsuarios.find(function(r){ return r.email === receptorSel.value; });
 if (!receptor) { _showToast('Colaborador inválido', 'erro'); return; }
 if (!window._drwCurrentTask) { _showToast('Salve a atividade antes de solicitar colaboração', 'erro'); return; }
 var task = window._drwCurrentTask;
 var now = new Date().toISOString();
 var payload = {
  atividade_id:       String(task.id),
  atividade_titulo:   task.titulo || task.nome || 'Atividade',
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
 _histLogAdd('colab', payload.atividade_titulo, 'Colaboração solicitada para ' + payload.receptor_nome + ' — ' + payload.motivo);
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
   + '<div class="colab-card-task">' + (r.atividade_titulo || '') + '</div>'
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
 // Preencher select de receptores
 var sel = document.getElementById('drw-colab-receptor');
 if (sel) {
  var meEmail = (_currentUser && _currentUser.email) || '';
  sel.innerHTML = '<option value="">Selecione o colaborador...</option>'
   + (_respUsuarios || []).filter(function(r){ return r.email !== meEmail; })
     .map(function(r){ return '<option value="' + r.email + '">' + (r.nome || r.email) + '</option>'; }).join('');
  sel.value = '';
 }
 var motivo = document.getElementById('drw-colab-motivo');
 if (motivo) motivo.value = '';
 var prazo = document.getElementById('drw-colab-prazo');
 if (prazo) prazo.value = '';
 var msg = document.getElementById('drw-colab-msg');
 if (msg) { msg.value = ''; setTimeout(function(){ sel && sel.focus(); }, 80); }
}
function _drwColabReqCancel() {
 var form = document.getElementById('drw-colab-form');
 if (form) form.classList.remove('open');
}

/* Carrega solicitações de colaboração no painel Lembretes */
async function _remLoadColabReqs() {
 if (!_currentUser) return;
 var me = _currentUser.email || '';
 var reqs = await _colabReqBuscar(function(r){ return r.solicitante_email === me || r.receptor_email === me; });
 var pendentes = reqs.filter(function(r){ return r.status === 'Pendente' && r.receptor_email === me; }).length;
 window._colabPendCount = pendentes; // usado pelo Painel de Saúde Operacional
 var listEl = document.getElementById('dash-colab-list');
 if (!listEl) return;
 var badge = document.getElementById('rem-colab-badge');
 var abertos = reqs.filter(function(r){ return r.status !== 'Concluída' && r.status !== 'Recusada'; }).length;
 if (badge) { badge.style.display = abertos > 0 ? '' : 'none'; badge.textContent = abertos; }
 // Renderizar solicitações formais no topo
 var badgeClass = { 'Pendente':'pendente','Aceita':'aceita','Recusada':'recusada','Em andamento':'andamento','Concluída':'concluida' };
 var reqsHtml = reqs.slice(0,10).map(function(r) {
  var isSol = r.solicitante_email === me;
  var bc    = 'colab-req-badge-' + (badgeClass[r.status] || 'pendente');
  var dt    = r.created_at ? new Date(r.created_at).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}) : '';
  var actions = '';
  if (!isSol && r.status === 'Pendente') {
   actions = '<div style="display:flex;gap:4px;margin-top:4px">'
    + '<button class="colab-req-btn accept" onclick="_remColabReqAcao(\'' + r.id + '\',\'Aceita\')">Aceitar</button>'
    + '<button class="colab-req-btn decline" onclick="_remColabReqAcao(\'' + r.id + '\',\'Recusada\')">Recusar</button>'
    + '</div>';
  }
  return '<div style="padding:8px 12px;border-bottom:1px solid var(--border)">'
   + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px">'
   + '<div style="flex:1;min-width:0">'
   + '<div style="font-size:11px;font-weight:600;color:var(--text);margin-bottom:2px">' + (r.atividade_titulo || 'Atividade') + '</div>'
   + '<div style="font-size:10px;color:var(--muted)">'
   + (isSol ? 'Para ' + (r.receptor_nome || '?') : 'De ' + (r.solicitante_nome || '?'))
   + ' · ' + dt + '</div>'
   + (r.mensagem ? '<div style="font-size:10px;color:var(--muted);margin-top:2px">' + r.mensagem + '</div>' : '')
   + actions
   + '</div>'
   + '<span class="colab-req-badge ' + bc + '" style="flex-shrink:0">' + r.status + '</span>'
   + '</div>'
   + '</div>';
 }).join('');
 listEl.innerHTML = reqsHtml || '<div style="padding:14px 12px;font-size:11px;color:var(--muted);text-align:center">Nenhuma colaboração.</div>';
}

/* Ação rápida sobre solicitação via painel Lembretes */
function _remColabReqAcao(reqId, novoStatus) {
 _colabReqAtualizarStatus(reqId, novoStatus).then(function(ok) {
  if (!ok) return;
  _remLoadColabReqs();
  _showToast('Colaboração ' + novoStatus.toLowerCase(), 'ok');
 });
}

// ── Abrir/fechar formulário ───────────────────────────────────────────────
function _remOpenNew()    { _remToggleSend(); }   // FIX: função que faltava
function _remToggleSend() {
 var wrap = document.getElementById('rem-send-wrap');
 if (!wrap) return;
 var isOpen = wrap.style.display !== 'none' && wrap.style.display !== '';
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

function _taskAutoSaveQueue(patch, immediate) {
 if (!_taskEditId) return; // modo criação: sem linha no banco ainda, nada a auto-salvar
 _taskAutoSavePending = Object.assign(_taskAutoSavePending || {}, patch);
 clearTimeout(_taskAutoSaveTimer);
 _taskAutoSaveStatus('saving', 'Salvando…');
 _taskAutoSaveTimer = setTimeout(_taskAutoSaveFlush, immediate ? 120 : 700);
}

function _taskAutoSaveFlush() {
 if (!_taskEditId || !_taskAutoSavePending) return;
 var id = _taskEditId, patch = _taskAutoSavePending;
 _taskAutoSavePending = null;
 patch.updated_at = new Date().toISOString();
 _sb.from('atividades').update(patch).eq('id', id).then(function(res) {
  // Só pula a atualização de UI se o usuário JÁ ABRIU OUTRA atividade
  // enquanto salvava (_taskEditId aponta pra outro id) — fechar o painel
  // (_taskEditId vira null) NÃO deve bloquear isso: é o caso mais comum
  // (editar e fechar em seguida) e antes descartava a atualização do cache
  // em memória bem aí, deixando Meu Painel/Gestor de Tarefas com dado velho
  // até um F5.
  if (_taskEditId && String(_taskEditId) !== String(id)) return;
  if (res.error) {
   _taskAutoSaveStatus('error', 'Erro ao salvar: ' + _supaErrPt(res.error.message));
   console.error('[auto-save]', res.error);
   return;
  }
  _taskAutoSaveStatus('saved', 'Alterações salvas');
  _taskApplyPatchEverywhere(id, patch);
 }).catch(function(e) {
  if (_taskEditId && String(_taskEditId) !== String(id)) return;
  _taskAutoSaveStatus('error', 'Erro: ' + e.message);
  console.error('[auto-save]', e);
 });
}

// Única fonte de verdade: _gestorAllAt (Gestor de Tarefas) e _dashAllAtRaw
// (Meu Painel) guardam a MESMA atividade em dois caches independentes —
// depois de qualquer save bem-sucedido, aplica o patch nos dois e
// re-renderiza tudo que é derivado deles (sem nenhuma consulta nova).
function _taskApplyPatchEverywhere(id, patch) {
 var gIdx = (typeof _gestorAllAt !== 'undefined') ? _gestorAllAt.findIndex(function(x){ return String(x.id) === String(id); }) : -1;
 if (gIdx !== -1) { Object.assign(_gestorAllAt[gIdx], patch); if (typeof _gestorApplyFilters === 'function') _gestorApplyFilters(); }
 var dIdx = (_dashAllAtRaw||[]).findIndex(function(x){ return String(x.id) === String(id); });
 if (dIdx !== -1) { Object.assign(_dashAllAtRaw[dIdx], patch); _dashRerenderAllFromCache(); }
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
 if (typeof _dashRenderFeed === 'function') _dashRenderFeed(_dashApplySomenteEu(_dashFeedRaw));

 if (typeof _dashUpdateKPIsFromDB === 'function') _dashUpdateKPIsFromDB(allAt);
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
 set('nt-dt-fim',        t ? t.data_fim      : '');
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
 // Seção de Colaboração: visível só no modo edição
 var colabWrap = get('drw-colab-req-wrap');
 if (colabWrap) {
  colabWrap.style.display = t ? '' : 'none';
  if (t) { _drwColabReqCancel(); _drwColabReqRender(t.id); }
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

 // ── Seção Recorrência — só faz sentido ao criar (editar a recorrência de
 // uma atividade existente não regenera nem afeta nada hoje, então a seção
 // fica oculta em modo edição em vez de fingir que funciona) ──
 var recWrap = get('drw-sec-recorrencia-wrap');
 if (recWrap) recWrap.style.display = t ? 'none' : '';
 if (!t) {
  document.querySelectorAll('input[name="nt-recorre"]').forEach(function(r){ r.checked = r.value === 'nao'; });
  set('nt-freq-val', 1);
  set('nt-freq-unit', 'semanal');
  set('nt-rec-repeticoes', '');
  set('nt-rec-dt-fim', '');
  var infEl = get('nt-rec-infinita');
  if (infEl) infEl.checked = false;
  _taskRecorrenciaChange();
 }

 // ── Aba Auditoria (só no modo edição) ──
 var auditTab = get('drw-tab-auditoria');
 var auditBody = get('drw-audit-body');
 if (t && auditTab && auditBody) {
  auditTab.style.display = '';
  var criador  = t.created_by  || t.responsavel || '—';
  var updBy    = t.updated_by  || '—';
  var origem   = t.origem      || 'Dashboard';
  var criadoEm = t.created_at  ? new Date(t.created_at).toLocaleString('pt-BR') : '—';
  auditBody.innerHTML =
   '<div class="drw-audit-row"><span class="drw-audit-lbl">Criado por</span><span class="drw-audit-val">' + criador + '</span></div>'
   + '<div class="drw-audit-row"><span class="drw-audit-lbl">Data de criação</span><span class="drw-audit-val">' + criadoEm + '</span></div>'
   + '<div class="drw-audit-row"><span class="drw-audit-lbl">Última alteração por</span><span class="drw-audit-val">' + updBy + '</span></div>'
   + '<div class="drw-audit-row"><span class="drw-audit-lbl">Origem</span><span class="drw-audit-val">' + origem + '</span></div>';
 } else if (auditTab) {
  auditTab.style.display = 'none';
 }

 // ── Reset: voltar para aba Geral, limpar erros ──
 _drwTab('geral', document.querySelector('.drw-tab'));
 ['nt-titulo','nt-tipo-atividade','nt-area','nt-dt-inicio','nt-dt-fim'].forEach(function(id){
  var el = get(id);
  if (el) { el.style.borderColor = ''; el.style.boxShadow = ''; }
 });
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
 try {
  var session = (await _sb.auth.getSession()).data.session;
  if (!session) return;
  var r = await fetch('https://pnecdbobhywfjdadylwt.supabase.co/functions/v1/auth-admin', {
   method:'POST',
   headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},
   body:JSON.stringify({action:'listar-usuarios'})
  });
  var res = await r.json();
  if (res.ok && res.users) {
   _respUsuarios = res.users.map(function(u) {
    var nome = u.user_metadata && u.user_metadata.full_name
     ? u.user_metadata.full_name
     : (u.email || '').split('@')[0];
    var iniciais = nome.split(' ').slice(0,2).map(function(p){return p[0]||'';}).join('').toUpperCase();
    return { id: u.id || '', email: u.email, nome: nome, iniciais: iniciais, avatar: null };
   });
   // Enriquecer com avatares da tabela usuarios
   try {
    var av = await _sb.from('usuarios').select('id, avatar_url, nome_display, cargo, departamento, created_at');
    if (av.data) {
     var avMap = {};
     av.data.forEach(function(row){ avMap[row.id] = row; });
     _respUsuarios.forEach(function(u) {
      var row = avMap[u.id];
      if (row) {
       if (row.avatar_url) u.avatar = row.avatar_url;
       if (row.nome_display) u.nome = row.nome_display;
       u.iniciais = u.nome.split(' ').slice(0,2).map(function(p){return p[0]||'';}).join('').toUpperCase();
       // Usados pelo cartao de info do usuario (clique com botao direito no avatar)
       u.cargo = row.cargo || '';
       u.departamento = row.departamento || '';
       u.criadoEm = row.created_at || '';
      }
     });
    }
   } catch(e2) {}
   _respRenderList('');
  }
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

function _taskRecorrenciaChange() {
 var recorre = 'nao';
 document.querySelectorAll('input[name="nt-recorre"]').forEach(function(r){ if (r.checked) recorre = r.value; });
 var wrap = document.getElementById('nt-freq-wrap');
 if (wrap) wrap.style.display = recorre === 'sim' ? 'flex' : 'none';
 var infinita = document.getElementById('nt-rec-infinita');
 var limiteWrap = document.getElementById('nt-rec-limite-wrap');
 if (infinita && limiteWrap) limiteWrap.style.display = infinita.checked ? 'none' : 'flex';
 _recorrenciaPreview();
}

/* ── PREVIEW DA SÉRIE DE RECORRÊNCIA ─────────────────────────────────────── */
function _recorrenciaPreview() {
 var el = document.getElementById('drw-rec-preview');
 if (!el) return;
 var recorre = 'nao';
 document.querySelectorAll('input[name="nt-recorre"]').forEach(function(r){ if (r.checked) recorre = r.value; });
 if (recorre !== 'sim') { el.textContent = 'Configure os campos acima para visualizar a série.'; return; }
 var unit = (document.getElementById('nt-freq-unit') || {}).value || 'semanal';
 var val  = parseInt((document.getElementById('nt-freq-val') || {}).value) || 1;
 var rep  = parseInt((document.getElementById('nt-rec-repeticoes') || {}).value) || 0;
 var dtFimStr = (document.getElementById('nt-rec-dt-fim') || {}).value || '';
 var infinita = document.getElementById('nt-rec-infinita');
 var isInfinita = infinita && infinita.checked;
 var unitLabels = { diario:'dia(s)', semanal:'semana(s)', mensal:'mês(es)', anual:'ano(s)' };
 var msg = 'Repete a cada ' + val + ' ' + (unitLabels[unit] || unit) + '.';
 if (isInfinita) { msg += ' Sem data de término.'; }
 else if (rep && dtFimStr) { msg += ' Encerra em ' + rep + ' repetições ou até ' + dtFimStr + ' (o que ocorrer primeiro).'; }
 else if (rep) { msg += ' Total de ' + rep + ' repetições.'; }
 else if (dtFimStr) { msg += ' Encerra em ' + dtFimStr + '.'; }
 else { msg += ' Defina o número de repetições ou a data final.'; }
 el.textContent = msg;
}

/* ── TABS DO DRAWER ──────────────────────────────────────────────────────── */
function _drwTab(name, btn) {
 document.querySelectorAll('.drw-tab').forEach(function(b){ b.classList.remove('active'); });
 document.querySelectorAll('.drw-tab-pane').forEach(function(p){ p.classList.remove('active'); });
 if (btn) btn.classList.add('active');
 var pane = document.getElementById('drw-pane-' + name);
 if (pane) pane.classList.add('active');
}

/* ── SUBTAREFAS NO DRAWER ────────────────────────────────────────────────── */
var _drwSubItems = []; // [{_id, titulo, done}]

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
 list.innerHTML = _drwSubItems.map(function(s, idx) {
  var cbClass = 'drw-sub-cb' + (s.done ? ' done' : '');
  var check = s.done ? '<svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="#fff" stroke-width="2.2"><polyline points="1.5,5 4,7.5 8.5,2.5"/></svg>' : '';
  return '<div class="drw-sub-item" id="drw-sub-item-' + idx + '">'
   + '<div class="' + cbClass + '" onclick="_drwSubToggleDone(' + idx + ')">' + check + '</div>'
   + '<span class="drw-sub-titulo' + (s.done ? ' done' : '') + '" onclick="_drwSubTitleEdit(' + idx + ')" title="Clique para editar">' + (s.titulo || '<i style="color:var(--muted)">(clique para definir)</i>') + '</span>'
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
 var selProj = document.getElementById('nt-projeto');
 if (selProj && !(t && t.obra_id)) {
  selProj.innerHTML = '<option value="">Nenhum</option>';
  selProj.disabled = true;
  selProj.style.opacity = '.5';
  selProj.style.cursor = 'not-allowed';
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
 var selProj = document.getElementById('nt-projeto');
 var hint    = document.getElementById('nt-projeto-hint');
 if (!selProj) return;
 if (!obraId) {
  selProj.innerHTML = '<option value="">Nenhum</option>';
  selProj.disabled = true;
  selProj.style.opacity = '.5';
  selProj.style.cursor = 'not-allowed';
  if (hint) hint.textContent = '(selecione uma obra primeiro)';
  return;
 }
 selProj.innerHTML = '<option value="">Carregando...</option>';
 selProj.disabled = true;
 if (!_dbOk) { selProj.innerHTML = '<option value="">Sem conexão</option>'; return; }
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
   selProj.innerHTML = '<option value="">Nenhum projeto nesta obra</option>';
   selProj.disabled = true;
   if (hint) hint.textContent = '(nenhum projeto nesta obra)';
   _ntProjCardSync();
   return;
  }
  selProj.innerHTML = '<option value="">Selecione um projeto...</option>'
   + projetos.map(function(p){
    var liberado = p.liberado_execucao === true ? 'true' : (p.liberado_execucao === false ? 'false' : '');
    return '<option value="' + p.id + '" data-etapa="' + (p.etapa_projeto || '').replace(/"/g,'&quot;') + '" data-liberado="' + liberado + '">' + p.nome + '</option>';
   }).join('');
  selProj.disabled = false;
  selProj.style.opacity = '1';
  selProj.style.cursor = '';
  if (hint) hint.textContent = '';
  // Restaurar valor se editando
  if (taskCtx && taskCtx.projeto_id) selProj.value = taskCtx.projeto_id;
  _ntProjCardSync();
 }).catch(function() {
  selProj.innerHTML = '<option value="">Erro ao carregar</option>';
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
 var selProj = document.getElementById('nt-projeto');
 var card = document.getElementById('nt-proj-card');
 if (!selProj || !card) return;
 var opt = selProj.options[selProj.selectedIndex];
 if (!opt || !opt.value) { card.style.display = 'none'; return; }
 var etapa = opt.getAttribute('data-etapa') || '';
 var liberado = opt.getAttribute('data-liberado') || '';
 var status = liberado === 'true' ? 'Liberado para execução' : (liberado === 'false' ? 'Aguardando liberação' : '—');
 document.getElementById('nt-proj-card-nome').textContent = opt.textContent || '—';
 document.getElementById('nt-proj-card-etapa').textContent = etapa || '—';
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
  // Voltar para aba Geral para mostrar erros
  _drwTab('geral', document.querySelector('.drw-tab'));
  if (primeiroInvalido && primeiroInvalido.focus) primeiroInvalido.focus();
  _showToast('Preencha todos os campos obrigatórios (*)', 'erro');
  return;
 }
 try {
  // ── Leitura de campos ────────────────────────────────────────────
  var recorre = 'nao';
  document.querySelectorAll('input[name="nt-recorre"]').forEach(function(r){ if (r.checked) recorre = r.value; });
  var obraEl  = document.getElementById('nt-obra');
  var projEl  = document.getElementById('nt-projeto');
  var melhEl  = document.getElementById('nt-melhoria-sel');
  var obraText = obraEl && obraEl.selectedIndex > 0 ? obraEl.options[obraEl.selectedIndex].text : '';
  var projText = projEl && projEl.selectedIndex > 0 ? projEl.options[projEl.selectedIndex].text : '';
  var melhText = melhEl && melhEl.selectedIndex > 0 ? melhEl.options[melhEl.selectedIndex].text : '';
  var infEl = document.getElementById('nt-rec-infinita');
  var recInfinita = infEl && infEl.checked;
  var recRepStr = (document.getElementById('nt-rec-repeticoes') || {}).value || '';
  var recRep    = recRepStr ? parseInt(recRepStr) : 0;
  var recDtFim  = (document.getElementById('nt-rec-dt-fim') || {}).value || '';
  // Converte unidade para formato interno (diario→dias, semanal→semanas, mensal→meses, anual→anos)
  var freqUnitRaw = (document.getElementById('nt-freq-unit') || {}).value || 'semanal';
  var freqUnitMap = { diario:'dias', semanal:'semanas', mensal:'meses', anual:'anos' };
  var freqUnit = freqUnitMap[freqUnitRaw] || freqUnitRaw;

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
   recorrencia:     recorre,
   freq_val:        parseInt((document.getElementById('nt-freq-val') || {}).value) || 1,
   freq_unit:       freqUnit,
   rec_infinita:    recInfinita,
   rec_repeticoes:  recRep,
   rec_dt_fim:      recDtFim,
   done:            false,
   is_mae:          recorre === 'sim',
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
    frequencia:     recorre === 'sim' ? (mae.freq_val + ' ' + freqUnit) : null,
    criado_por:     (_currentUser && _currentUser.id) || null,
    visibilidade:   privVisibilidade
   };
   var linhas = [Object.assign({}, linhaBase, {
    data_inicio: mae.data_inicio || null,
    data_prazo:  mae.data_fim    || null,
    subtasks:    subtasksParaSalvar
   })];

   // Geração de filhos (recorrência)
   if (recorre === 'sim' && mae.data_inicio && mae.data_fim) {
    var dtI   = new Date(mae.data_inicio + 'T00:00:00');
    var dtF   = new Date(mae.data_fim    + 'T00:00:00');
    var durMs = dtF - dtI;
    var freq  = mae.freq_val;
    var unit  = freqUnit;
    // Determinar limite: infinita = 365, repeticoes definida, dt-fim calculada, senão 12
    var MAX_FILHOS = recInfinita ? 365 : (recRep > 0 ? recRep : 12);
    var dtLimite   = recDtFim ? new Date(recDtFim + 'T23:59:59') : null;
    for (var n = 1; n <= MAX_FILHOS; n++) {
     var repI = new Date(dtI);
     if      (unit === 'dias')    repI.setDate(repI.getDate()         + freq * n);
     else if (unit === 'semanas') repI.setDate(repI.getDate()         + freq * 7 * n);
     else if (unit === 'meses')   repI.setMonth(repI.getMonth()       + freq * n);
     else if (unit === 'anos')    repI.setFullYear(repI.getFullYear() + freq * n);
     if (dtLimite && repI > dtLimite) break;
     var repF  = new Date(repI.getTime() + durMs);
     linhas.push(Object.assign({}, linhaBase, {
      data_inicio: repI.toISOString().slice(0, 10),
      data_prazo:  repF.toISOString().slice(0, 10),
      subtasks:    []
     }));
    }
   }

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
     var totalFilhos = linhas.length - 1;
     _histLogAdd('criou', mae.titulo, recorre === 'sim'
      ? 'Série recorrente: ' + linhas.length + ' ocorrências'
      : 'Área: ' + (mae.area || '—') + ' · Prioridade: ' + (mae.prioridade || '—'));
     _histBadgeUpdate();
     _showToast(recorre === 'sim' ? 'Série criada: 1 + ' + totalFilhos + ' recorrências!' : 'Atividade criada com sucesso!', 'ok');
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

function _dashUpdateProgress() {
 // Motivo: filtra apenas tarefas com data_fim na semana atual (seg–dom).
 // Isso dá uma visão operacional do que precisa ser entregue agora,
 // em vez de diluir o progresso com todas as tarefas do histórico.
 var hoje   = new Date();
 var diaSem = hoje.getDay(); // 0=dom, 1=seg...
 var seg    = new Date(hoje);
 seg.setDate(hoje.getDate() - ((diaSem + 6) % 7)); // segunda-feira desta semana
 seg.setHours(0,0,0,0);
 var dom    = new Date(seg);
 dom.setDate(seg.getDate() + 6); // domingo
 dom.setHours(23,59,59,999);

 var tasksSemana = _dashTasks.filter(function(t) {
  if (!t.data_fim) return false;
  var df = new Date(t.data_fim + 'T00:00:00');
  return df >= seg && df <= dom;
 });

 // Se não há tarefas desta semana, exibe total geral para não ficar vazio
 var usar = tasksSemana.length > 0 ? tasksSemana : _dashTasks;
 var total = usar.length;
 var done  = usar.filter(function(t){ return t.done; }).length;
 var late  = _dashTasks.filter(function(t){
  if (t.done) return false;
  var p = _dashTaskPrazo(t);
  return p && p.cls === 'prazo-atrasado';
 }).length;
 var pct = total ? Math.round((done / total) * 100) : 0;

 var fill    = document.getElementById('dash-pb-fill');
 var pctEl   = document.getElementById('dash-pb-pct');
 var countEl = document.getElementById('dash-pb-count');
 var labelEl = document.getElementById('dash-pb-label');
 if (fill)    fill.style.width = pct + '%';
 if (pctEl)   pctEl.textContent = pct + '%';
 if (countEl) countEl.textContent = done + '/' + total + (tasksSemana.length > 0 ? ' esta semana' : ' total');
 if (labelEl) labelEl.textContent = 'Tarefas da semana';
 // stats extras do novo card semanal
 var doneEl  = document.getElementById('dash-pb-done');
 var totalEl = document.getElementById('dash-pb-total');
 var lateEl  = document.getElementById('dash-pb-late');
 if (doneEl)  doneEl.textContent  = done;
 if (totalEl) totalEl.textContent = total;
 if (lateEl)  lateEl.textContent  = late;

 var CIRCUNF = 226.2;
 var ring    = document.getElementById('dash-ring-fill');
 var ringPct = document.getElementById('dash-ring-pct');
 var ringSub = document.getElementById('dash-ring-sub');
 var ringDone= document.getElementById('dash-ring-done');
 var ringLate= document.getElementById('dash-ring-late');
 if (ring)     ring.style.strokeDashoffset = (CIRCUNF - (pct / 100) * CIRCUNF);
 if (ringPct)  ringPct.textContent = pct + '%';
 if (ringSub)  ringSub.textContent = done + ' de ' + total + ' tarefas';
 if (ringDone) ringDone.textContent = done;
 if (ringLate) ringLate.textContent = late;
}

function _dashRenderAgenda() {
 var list = document.getElementById('dash-agenda-list');
 if (!list) return;
 var diasAbrev = ['DOM','SEG','TER','QUA','QUI','SEX','SAB'];
 var hojeAbrev = diasAbrev[new Date().getDay()];
 var prioColor = { alta:'var(--red)', media:'var(--yellow)', baixa:'var(--navy)' };
 function _normP(p){ return (p||'').toLowerCase().replace('é','e').replace('á','a'); }
 var pending   = _dashTasks.filter(function(t){ return !t.done; });
 // Classifica cada tarefa pelo prazo derivado
 var atrasadas = [], hoje = [], futuras = [];
 pending.forEach(function(t) {
  var p = _dashTaskPrazo(t);
  if (!p) return;
  if (p.cls === 'prazo-atrasado') atrasadas.push(t);
  else if (p.cls === 'prazo-hoje') hoje.push(t);
  else futuras.push(t);
 });
 var html = '';
 atrasadas.slice(0, 2).forEach(function(t) {
  html += '<div class="agenda-item">'
   + '<div class="agenda-day" style="color:var(--red);font-size:9px">ATR</div>'
   + '<div class="agenda-dot" style="background:var(--red)"></div>'
   + '<div style="flex:1"><div class="agenda-title">' + t.titulo + '</div>'
   + '<div class="agenda-sub">Atrasada' + (t.area ? ' · ' + t.area : '') + '</div></div></div>';
 });
 hoje.forEach(function(t) {
  html += '<div class="agenda-item">'
   + '<div class="agenda-day hoje">' + hojeAbrev + '</div>'
   + '<div class="agenda-dot" style="background:var(--red)"></div>'
   + '<div style="flex:1"><div class="agenda-title">' + t.titulo + '</div>'
   + '<div class="agenda-sub">Hoje' + (t.area ? ' · ' + t.area : '') + '</div></div></div>';
 });
 futuras.slice(0, 3).forEach(function(t) {
  var p   = _dashTaskPrazo(t);
  var cor = prioColor[_normP(t.prioridade)] || 'var(--navy)';
  var tipoAgenda = t.tipo_atividade || t.tipo || '';
  html += '<div class="agenda-item">'
   + '<div class="agenda-day">' + (p ? p.label : '') + '</div>'
   + '<div class="agenda-dot" style="background:' + cor + '"></div>'
   + '<div style="flex:1"><div class="agenda-title">' + t.titulo + '</div>'
   + '<div class="agenda-sub">' + (t.area || '') + (tipoAgenda ? ' · ' + tipoAgenda : '') + '</div></div></div>';
 });
 if (!html) {
  html = '<div style="font-size:12px;color:var(--muted);padding:14px 0;text-align:center">Nenhuma pendência para esta semana.</div>';
 }
 list.innerHTML = html;
}

/* ── DASHBOARD — DADOS AO VIVO ──────────────────────────────────────── */
/* ── DRAWER LATERAL DE PROJETOS ─────────────────────────────────────── */
var _projDrawerData     = [];  // todos os projetos do usuário
var _projDrawerFilters  = { status: '' };

function _projDrawerOpen() {
 var drw = document.getElementById('proj-drw');
 var bd  = document.getElementById('drw-backdrop-proj');
 if (drw) drw.classList.add('open');
 if (bd)  bd.classList.add('open');
 // Limpa busca
 var si = document.getElementById('proj-drw-search');
 if (si) si.value = '';
 _projDrawerFilters = { status: '' };
 // Reseta chips de filtro
 document.querySelectorAll('.proj-fc').forEach(function(fc){ fc.classList.remove('active'); });
 var allChip = document.querySelector('.proj-fc[data-val=""]');
 if (allChip) allChip.classList.add('active');
 // Carrega dados
 _projDrawerLoad();
}

function _projDrawerClose() {
 var drw = document.getElementById('proj-drw');
 var bd  = document.getElementById('drw-backdrop-proj');
 if (drw) drw.classList.remove('open');
 if (bd)  bd.classList.remove('open');
}

function _projDrawerLoad() {
 var list = document.getElementById('proj-drw-list');
 if (!list) return;
 // Usa cache do _dashLoad se disponível
 if (window._projDrawerCache && window._projDrawerCache.length) {
  _projDrawerData = window._projDrawerCache;
  _projDrawerRender();
  return;
 }
 if (!_dbOk) {
  list.innerHTML = '<div class="proj-drw-empty">Banco de dados indisponível.</div>';
  return;
 }
 list.innerHTML = '<div class="proj-drw-empty">Carregando projetos...</div>';
 var userEmail = (_currentUser && _currentUser.email) || localStorage.getItem('milatec-user-email') || '';
 var projQDrw = _sb.from('projetos')
  .select('id, nome, etapa_projeto, complexidade, responsavel, obra_id, obra:obra_id(nome, empresas_obras(empresa:empresa_id(nome)))')
  .order('created_at', { ascending: false })
  .limit(100);
 if (userEmail) projQDrw = projQDrw.contains('responsavel', [userEmail]);
 projQDrw.then(function(res) {
   if (res.error || !res.data) {
    list.innerHTML = '<div class="proj-drw-empty">Erro ao carregar projetos.</div>';
    return;
   }
   res.data.forEach(function(p){ if (Array.isArray(p.responsavel)) p.responsavel = _emailsToNomes(p.responsavel); });
   _projDrawerData = res.data;
   window._projDrawerCache = res.data;
   _projDrawerRender();
  });
}

function _projFc(btn, filterKey) {
 // Toggle filtro exclusivo por grupo
 document.querySelectorAll('.proj-fc[data-filter="' + filterKey + '"]').forEach(function(fc){ fc.classList.remove('active'); });
 btn.classList.add('active');
 _projDrawerFilters[filterKey] = btn.getAttribute('data-val') || '';
 _projDrawerFilter();
}

function _projDrawerFilter() {
 _projDrawerRender();
}

function _projDrawerRender() {
 var list = document.getElementById('proj-drw-list');
 if (!list) return;
 var search  = ((document.getElementById('proj-drw-search') || {}).value || '').toLowerCase().trim();
 var stFilter = _projDrawerFilters.status || '';

 var etapaColor = {
  'Orçamento':'var(--yellow)', 'Aguardando Aprovação':'var(--yellow)',
  'Análise Inicial':'var(--navy)', 'Pré-Projeto':'var(--navy)',
  'Projeto para aprovação':'var(--navy)', 'Revisão Executivo':'var(--yellow)',
  'Projeto Executivo':'var(--green)', 'Ajuste de Piloto':'var(--purple)',
  'Revisão Pré-Projeto':'var(--yellow)'
 };
 var etapaBg = {
  'Orçamento':'var(--yellow-dim)', 'Aguardando Aprovação':'var(--yellow-dim)',
  'Análise Inicial':'var(--blue-dim)', 'Pré-Projeto':'var(--blue-dim)',
  'Projeto para aprovação':'var(--blue-dim)', 'Revisão Executivo':'var(--yellow-dim)',
  'Projeto Executivo':'var(--green-dim)', 'Ajuste de Piloto':'rgba(137,87,229,.12)',
  'Revisão Pré-Projeto':'var(--yellow-dim)'
 };

 var filtered = _projDrawerData.filter(function(p) {
  if (stFilter && (p.etapa_projeto || '') !== stFilter) return false;
  if (search) {
   var nome   = (p.nome || '').toLowerCase();
   var obra   = (p.obra && p.obra.nome ? p.obra.nome : '').toLowerCase();
   var etapa  = (p.etapa_projeto || '').toLowerCase();
   var resp   = (p.responsavel || '').toLowerCase();
   if (nome.indexOf(search) < 0 && obra.indexOf(search) < 0 && etapa.indexOf(search) < 0 && resp.indexOf(search) < 0) return false;
  }
  return true;
 });

 var countEl = document.getElementById('proj-drw-count');
 if (countEl) countEl.textContent = filtered.length + ' projeto' + (filtered.length !== 1 ? 's' : '');

 if (!filtered.length) {
  list.innerHTML = '<div class="proj-drw-empty">Nenhum projeto encontrado.</div>';
  return;
 }

 list.innerHTML = filtered.map(function(p) {
  var obraStr    = p.obra && p.obra.nome ? p.obra.nome : '';
  var empresaStr = p.obra?.empresas_obras?.[0]?.empresa?.nome || '';
  var etapa      = p.etapa_projeto || '—';
  var cor        = etapaColor[etapa] || 'var(--muted)';
  var bg         = etapaBg[etapa]    || 'var(--surface2)';
  var complex    = p.complexidade ? p.complexidade : '';

  return '<div class="proj-card" onclick="_projDrawerGoDetail(\'' + p.id + '\')">'
   + '<div class="proj-card-prio-bar" style="background:' + cor + '"></div>'
   + '<div class="proj-card-body">'
   + '<div class="proj-card-nome">' + (p.nome || 'Sem nome') + '</div>'
   + (obraStr ? '<div class="proj-card-obra">' + (empresaStr ? empresaStr + ' — ' : '') + obraStr + '</div>' : '')
   + '<div class="proj-card-sub">'
   + '<span class="proj-card-tag" style="background:' + bg + ';color:' + cor + '">' + etapa + '</span>'
   + (complex ? '<span style="font-size:10px;color:var(--muted)">' + complex + '</span>' : '')
   + (p.responsavel ? '<span style="font-size:10px;color:var(--muted)">' + p.responsavel + '</span>' : '')
   + '</div>'
   + '</div>'
   + '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" style="color:var(--muted);flex-shrink:0;margin-top:4px"><polyline points="4,2 8,6 4,10"/></svg>'
   + '</div>';
 }).join('');
}

/* ── SUB-ABAS DO MEU PAINEL ───────────────────────────────────────────────── */
function _dashTabSwitch(tab) {
 var btns  = { geral: document.getElementById('dash-tab-btn-geral'), privadas: document.getElementById('dash-tab-btn-privadas') };
 var panes = { geral: document.getElementById('dash-tab-geral'), privadas: document.getElementById('dash-tab-privadas') };
 Object.keys(btns).forEach(function(k) {
  if (btns[k]) btns[k].classList.toggle('active', k === tab);
  if (panes[k]) panes[k].style.display = (k === tab) ? '' : 'none';
 });
 if (tab === 'privadas') _dashRenderPrivadas();
}

async function _dashRenderPrivadas() {
 var list = document.getElementById('dash-priv-list');
 var cnt  = document.getElementById('dash-priv-count');
 if (!list) return;
 list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">Carregando...</div>';
 if (!_dbOk || !_currentUser) {
  list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">Usuário não identificado.</div>';
  return;
 }
 var userEmail = _currentUser.email || '';
 var userName  = _currentUser.name  || '';
 // Busca atividades privadas onde o usuário é responsável
 var { data, error } = await _sb.from('atividades')
  .select('*')
  .eq('visibilidade', 'privada')
  .neq('status', 'Concluída')
  .or('responsavel.ilike.%' + userEmail + '%,responsavel.ilike.%' + userName + '%')
  .order('data_prazo', { ascending: true, nullsFirst: false });
 if (error) {
  list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--red);font-size:12px">Erro ao carregar.</div>';
  return;
 }
 var ativs = data || [];
 if (cnt) cnt.textContent = ativs.length + ' atividade' + (ativs.length !== 1 ? 's' : '');
 if (!ativs.length) {
  list.innerHTML = '<div style="padding:30px;text-align:center;color:var(--muted);font-size:12px">Você não tem atividades privadas abertas.</div>';
  return;
 }
 var hoje = new Date(); hoje.setHours(0,0,0,0);
 function prazoLabel(s) {
  if (!s) return null;
  var d = new Date(s + 'T00:00:00');
  if (isNaN(d)) return null;
  var dd = d.getDate() + '/' + (d.getMonth()+1) + '/' + String(d.getFullYear()).slice(2);
  if (d < hoje) return { txt: 'ATRASADA · ' + dd, clr: '#D6433C', bg: 'rgba(239,68,68,.08)' };
  if (d.toDateString() === hoje.toDateString()) return { txt: 'HOJE · ' + dd, clr: '#B8790A', bg: 'rgba(245,158,11,.08)' };
  return { txt: 'Prazo: ' + dd, clr: 'var(--muted)', bg: '' };
 }
 list.innerHTML = ativs.map(function(a) {
  var pi = prazoLabel(a.data_prazo);
  var stColors = { 'A fazer':'var(--muted)','Em progresso':'var(--navy)','Aguardando feedback':'var(--yellow)','Em andamento':'var(--navy)','Pendente':'var(--muted)' };
  var sc = stColors[a.status] || 'var(--muted)';
  return '<div onclick="_feedItemClick(this)" data-ativ=\'' + JSON.stringify(a).replace(/'/g,"&#39;") + '\''
   + ' style="display:flex;align-items:flex-start;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer;border-radius:6px;transition:background .12s" onmouseover="this.style.background=\'var(--surface2)\'" onmouseout="this.style.background=\'\'">'
   + '<span style="flex-shrink:0;margin-top:3px;color:var(--muted)"><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3.5" y="7" width="9" height="6.5" rx="1.2"/><path d="M5.5 7V5a2.5 2.5 0 015 0v2"/></svg></span>'
   + '<div style="flex:1;min-width:0">'
   + '<div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px">' + (a.titulo || '(sem título)') + '</div>'
   + '<div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center">'
   + (a.area ? '<span style="font-size:10px;padding:1px 5px;border-radius:3px;background:var(--surface2);color:var(--muted)">' + a.area + '</span>' : '')
   + '<span style="font-size:10px;padding:1px 5px;border-radius:3px;background:var(--surface2);color:' + sc + ';font-weight:600">' + (a.status || '') + '</span>'
   + (pi ? '<span style="font-size:10px;padding:1px 6px;border-radius:3px;' + (pi.bg ? 'background:'+pi.bg+';' : '') + 'color:' + pi.clr + ';font-weight:600">' + pi.txt + '</span>' : '')
   + '</div>'
   + '</div>'
   + '</div>';
 }).join('');
}

function _projDrawerGoDetail(projId) {
 _projDrawerClose();
 // Navega para projetos e seleciona o projeto
 go('projetos');
 // Tenta abrir o detalhe após a navegação
 setTimeout(function(){ if(typeof _spById === 'function') _spById(projId); }, 300);
}

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
     return '<span style="font-size:9px;padding:1px 6px;border-radius:3px;background:' + (isMultiResp ? 'rgba(99,102,241,.1)' : 'var(--surface2)') + ';color:' + (isMultiResp ? '#3D4FD1' : 'var(--muted)') + ';font-weight:600" title="' + r + '">' + short + '</span>';
    }).join('')
    + (isMultiResp ? '<span style="font-size:9px;color:#3D4FD1;font-weight:600"> · compartilhada</span>' : '')
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
var _dashSomenteEu    = localStorage.getItem('milatec-dash-somente-eu') === '1';

// "Somente para mim" — dentro do feed (já restrito a atividades onde o usuário
// é responsável), mantém só as que não são compartilhadas com mais ninguém.
function _dashToggleSomenteEu() {
 _dashSomenteEu = !_dashSomenteEu;
 localStorage.setItem('milatec-dash-somente-eu', _dashSomenteEu ? '1' : '0');
 var btn = document.getElementById('dash-feed-somente-eu');
 if (btn) {
  btn.style.background = _dashSomenteEu ? 'var(--navy)' : 'var(--surface2)';
  btn.style.color = _dashSomenteEu ? '#fff' : 'var(--muted)';
  btn.style.borderColor = _dashSomenteEu ? 'var(--navy)' : 'var(--border)';
 }
 _dashRenderFeed(_dashApplySomenteEu(_dashFeedRaw));
}
function _dashApplySomenteEu(atividades) {
 if (!_dashSomenteEu) return atividades || [];
 return (atividades || []).filter(function(a) {
  var respRaw = (a.responsavel || '').trim();
  var respList = respRaw ? respRaw.split(/[,;]+/).map(function(r){ return r.trim(); }).filter(Boolean) : [];
  return respList.length <= 1;
 });
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
  ['dash-kpi-hoje','dash-kpi-atr','dash-kpi-prox','dash-kpi-conclusao','dash-kpi-abertas','dash-proj-count'].forEach(function(id){var e=document.getElementById(id);if(e)e.textContent='0';});
  _dashSyncStatus(false, 'Sem conexão com Supabase');
  return;
 }
 var userEmail = (_currentUser && _currentUser.email) || localStorage.getItem('milatec-user-email') || '';

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
  var btnSe = document.getElementById('dash-feed-somente-eu');
  if (btnSe) {
   btnSe.style.background = _dashSomenteEu ? 'var(--navy)' : 'var(--surface2)';
   btnSe.style.color = _dashSomenteEu ? '#fff' : 'var(--muted)';
   btnSe.style.borderColor = _dashSomenteEu ? 'var(--navy)' : 'var(--border)';
  }
  _dashRenderFeed(_dashApplySomenteEu(_dashFeedRaw));
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
 var trendColor = trendDir === 'up' ? '#1F8A4C' : trendDir === 'down' ? '#D6433C' : '#3D4FD1';

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
    + '" stroke="#3D4FD1" stroke-opacity=".45" stroke-width="0.6" stroke-dasharray="2.5 2"/>';
  }

  // Dots HTML: apenas pontos com valor > 0, máximo e último destacados
  // Labels: apenas pico, último e todos quando n<=7
  var dotsHtml = pts.map(function(pt, i) {
   var isLast = i === pts.length - 1;
   if (pt.count === 0 && !isLast) return ''; // omite zeros (exceto último)
   var isPeak = pt.isMax && pt.count > 0;
   var dotSz  = isPeak ? 8 : isLast ? 7 : 5;
   var dotClr = isPeak ? '#1F8A4C' : isLast ? 'var(--navy)' : '#3D4FD1';
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
   ? '<div style="position:absolute;right:' + padR + '%;top:' + (padT + (1 - avgVal / maxVal) * useH - 8) + '%;font-size:7px;color:#3D4FD1;opacity:.7;white-space:nowrap;pointer-events:none">med</div>'
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
  { label: 'Em andamento', count: cats.andamento,  hex: '#3D4FD1', cssVar: 'var(--navy)'  },
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
  + _hpRow('#3D4FD1', 'Colaborações pendentes', colabPend, null, colabPend > 0)
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
 var barColor = pctDone >= 75 ? '#1F8A4C' : pctDone >= 50 ? '#3D4FD1' : '#B8790A';

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
 var abertas   =atividades.filter(function(a){return !isDone(a)&&a.status!=='Obsoleto';});
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
 var kA=document.getElementById('dash-kpi-atr');if(kA){kA.textContent=atrasadas;kA.style.color=atrasadas>0?'var(--red)':'var(--green)';}
 var kO=document.getElementById('dash-kpi-abertas');if(kO)kO.textContent=abertas.length;
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
  var prazoStr = '';
  var dp = a.data_prazo || a.data_fim || '';
  if (dp) {
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
