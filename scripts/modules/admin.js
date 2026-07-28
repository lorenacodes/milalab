// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN — gestão de usuários (listar, desativar/reativar, alterar role/senha,
// convites), solicitações de acesso, saúde do sistema. Isolado — não usa
// usuarios.service.js, fala direto com a edge function auth-admin.
// ═══════════════════════════════════════════════════════════════════════════════
var _adminSols  = [];
var _adminUsers = [];
var _adminCurrentTab = 'users';

// ── Tab navigation ───────────────────────────────────────────────────────────
function _adminTab(tab) {
 _adminCurrentTab = tab;
 ['users','sols','sys'].forEach(function(t) {
  var panel = document.getElementById('adm-panel-'+t);
  var btn   = document.getElementById('adm-tab-'+t);
  if (!panel || !btn) return;
  var active = t === tab;
  panel.style.display = active ? '' : 'none';
  btn.style.color        = active ? 'var(--green)' : 'var(--muted)';
  btn.style.fontWeight   = active ? '600' : '400';
  btn.style.borderBottom = active ? '2px solid var(--green)' : '2px solid transparent';
 });
 if (tab === 'users' && !_adminUsers.length) _adminLoadUsers();
 if (tab === 'sols')  _adminLoadSols();
 if (tab === 'sys')   _adminLoadSys();
}

// ── Carregar usuários ─────────────────────────────────────────────────────────
async function _adminLoadUsers() {
 var el = document.getElementById('adm-users-list');
 if (el) el.innerHTML = '<div style="padding:32px;text-align:center;color:var(--muted);font-size:13px">Carregando...</div>';
 var session = (await _sb.auth.getSession()).data.session;
 if (!session) return;
 var r = await fetch('https://pnecdbobhywfjdadylwt.supabase.co/functions/v1/auth-admin', {
  method:'POST',
  headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},
  body: JSON.stringify({action:'listar-usuarios'})
 });
 var res = await r.json();
 if (res.error) { if(el) el.innerHTML='<div style="padding:24px;color:var(--red);font-size:13px">Erro: '+res.error+'</div>'; return; }
 _adminUsers = res.users || [];
 _adminUpdateKpis();
 _adminRenderUsers(_adminUsers);
}

function _adminUpdateKpis() {
 var total = _adminUsers.length;
 var ativos = _adminUsers.filter(function(u){ return !u.banned; }).length;
 var susp   = _adminUsers.filter(function(u){ return u.banned; }).length;
 var set = function(id,v){ var el=document.getElementById(id); if(el) el.textContent=v; };
 set('adm-kpi-total',    total);
 set('adm-kpi-ativos',   ativos);
 set('adm-kpi-suspensos',susp);
}

function _adminRenderUsers(users) {
 var el = document.getElementById('adm-users-list');
 if (!el) return;
 if (!users.length) {
  el.innerHTML = '<div style="padding:32px;text-align:center;color:var(--muted);font-size:13px;border:1px dashed var(--border);border-radius:8px">Nenhum usuário encontrado</div>';
  return;
 }
 var roleLabel = { admin:'Admin', gestor:'Gestor', usuario:'Usuário' };
 var roleColor = { admin:'var(--navy)', gestor:'var(--blue)', usuario:'var(--green)' };
 var roleBg    = { admin:'var(--navy-dim)', gestor:'var(--blue-dim)', usuario:'var(--green-dim)' };
 var avatarBg  = { admin:'#0f2442', gestor:'#1d4ed8', usuario:'#16a34a' };

 function fmtDt(s) {
  if (!s) return null;
  var d = new Date(s);
  return isNaN(d) ? null : d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'});
 }

 el.innerHTML = users.map(function(u) {
  var ini  = (u.full_name||u.email||'?').charAt(0).toUpperCase();
  var role = u.role||'usuario';
  var clr  = roleColor[role]||'var(--muted)';
  var bg   = roleBg[role]||'var(--surface2)';
  var avBg = avatarBg[role]||'#64748b';
  var avatarEl = u.avatar_url
   ? '<img src="'+u.avatar_url+'" style="width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0" onerror="this.style.display=\'none\';this.nextSibling.style.display=\'flex\'">'
     +'<div style="display:none;width:40px;height:40px;border-radius:50%;background:'+avBg+';color:#fff;align-items:center;justify-content:center;font-size:15px;font-weight:700;flex-shrink:0;letter-spacing:-.5px">'+ini+'</div>'
   : '<div style="width:40px;height:40px;border-radius:50%;background:'+avBg+';color:#fff;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;flex-shrink:0;letter-spacing:-.5px">'+ini+'</div>';

  var lastIn     = fmtDt(u.last_sign_in) || 'Nunca';
  var firstAcc   = fmtDt(u.first_access) || '—';
  var membroSince= fmtDt(u.created_at)   || '—';

  var statusBadge = u.banned
   ? '<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;padding:3px 8px;border-radius:20px;background:var(--red-dim);color:var(--red);font-weight:700"><span style="width:5px;height:5px;border-radius:50%;background:var(--red);display:inline-block"></span>Suspenso</span>'
   : !u.email_confirmed
   ? '<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;padding:3px 8px;border-radius:20px;background:var(--yellow-dim);color:#b45309;font-weight:700"><span style="width:5px;height:5px;border-radius:50%;background:var(--yellow);display:inline-block"></span>Convite pendente</span>'
   : '<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;padding:3px 8px;border-radius:20px;background:var(--green-dim);color:var(--green);font-weight:700"><span style="width:5px;height:5px;border-radius:50%;background:var(--green);display:inline-block"></span>Ativo</span>';

  var roleSelect = '<select onchange="_adminAlterarRole(\''+u.id+'\',this.value)" style="font-size:11px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface2);color:var(--text);cursor:pointer;font-weight:600">'
   + ['usuario','gestor','admin'].map(function(r){ return '<option value="'+r+'"'+(r===role?' selected':'')+'>'+roleLabel[r]+'</option>'; }).join('')
   + '</select>';

  var uid = u.id.replace(/-/g,'_');
  var btnSusp = u.banned
   ? '<button onclick="_adminReativar(\''+u.id+'\')" title="Reativar acesso" style="display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:5px 10px;border:1px solid var(--green);border-radius:6px;background:transparent;color:var(--green);cursor:pointer;font-weight:600"><svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.5 15A9 9 0 1 0 3 3.5L1 10"/></svg>Reativar</button>'
   : '<button onclick="_adminDesativar(\''+u.id+'\')" title="Suspender acesso" style="display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:5px 10px;border:1px solid var(--border);border-radius:6px;background:transparent;color:var(--red);cursor:pointer"><svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="8" r="7"/><line x1="5" y1="8" x2="11" y2="8"/></svg>Suspender</button>';

  var btnConvite = '<button onclick="_adminReenviarConvite(\''+u.email+'\')" title="'+(u.email_confirmed?'Enviar link de redefinição de senha por e-mail':'Reenviar convite de primeiro acesso')+'" style="display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:5px 10px;border:1px solid var(--border);border-radius:6px;background:transparent;color:var(--muted);cursor:pointer"><svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 10H2a1 1 0 01-1-1V3a1 1 0 011-1h12a1 1 0 011 1v6a1 1 0 01-1 1z"/><polyline points="1 3 8 8 15 3"/></svg>'+(u.email_confirmed?'Redefinir senha':'Reenviar convite')+'</button>';

  var btnPwd = '<button onclick="_adminTogglePwd(\''+uid+'\')" style="display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:5px 10px;border:1px solid var(--border);border-radius:6px;background:transparent;color:var(--navy);cursor:pointer;font-weight:600"><svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="7" width="10" height="7" rx="1"/><path d="M5 7V5a3 3 0 016 0v2"/></svg>Alterar senha</button>';

  return '<div id="adm-user-card-'+uid+'" style="border:1px solid var(--border);border-radius:12px;background:var(--surface);overflow:hidden">'
   // Linha principal
   +'<div style="display:flex;align-items:center;gap:14px;padding:14px 16px">'
   // Avatar
   +avatarEl
   // Info principal
   +'<div style="flex:1;min-width:0">'
   +'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:3px">'
   +'<span style="font-weight:700;font-size:13px;color:var(--text)">'+(u.full_name||'—')+'</span>'
   +statusBadge
   +'</div>'
   +'<div style="font-size:11px;color:var(--muted)">'+(u.email||'')+(u.area?' · <span style="color:var(--text);font-weight:500">'+u.area+'</span>':'')+'</div>'
   +'</div>'
   // Datas
   +'<div style="display:grid;grid-template-columns:repeat(3,80px);gap:4px;flex-shrink:0;margin-right:8px">'
   +'<div style="text-align:center"><div style="font-size:9px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px">Membro desde</div><div style="font-size:11px;color:var(--text);font-weight:600">'+membroSince+'</div></div>'
   +'<div style="text-align:center"><div style="font-size:9px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px">1º acesso</div><div style="font-size:11px;color:var(--text);font-weight:600">'+firstAcc+'</div></div>'
   +'<div style="text-align:center"><div style="font-size:9px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px">Último acesso</div><div style="font-size:11px;color:var(--text);font-weight:600">'+lastIn+'</div></div>'
   +'</div>'
   // Role selector
   +roleSelect
   +'</div>'
   // Barra de ações
   +'<div style="display:flex;align-items:center;gap:8px;padding:8px 16px;border-top:1px solid var(--border);background:var(--surface2)">'
   +btnPwd+btnConvite
   +'<div style="margin-left:auto">'+btnSusp+'</div>'
   +'</div>'
   // Painel alterar senha (oculto por padrão)
   +'<div id="adm-pwd-panel-'+uid+'" style="display:none;padding:14px 16px;border-top:1px solid var(--border);background:rgba(15,36,66,.03)">'
   +'<div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:10px;display:flex;align-items:center;gap:6px"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="7" width="10" height="7" rx="1"/><path d="M5 7V5a3 3 0 016 0v2"/></svg>Nova senha para '+(u.full_name||u.email)+'</div>'
   +'<div style="display:flex;gap:8px;align-items:flex-end">'
   +'<div style="flex:1"><label style="font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:5px">Nova senha (mín. 8 caracteres)</label>'
   +'<input id="adm-pwd-inp-'+uid+'" type="password" placeholder="Digite a nova senha..." style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--border);border-radius:7px;background:var(--surface);color:var(--text);font-size:13px"></div>'
   +'<button onclick="_adminAlterarSenha(\''+u.id+'\',\''+uid+'\')" style="display:inline-flex;align-items:center;gap:5px;padding:8px 16px;border:none;border-radius:7px;background:var(--navy);color:#fff;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;flex-shrink:0"><svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="#fff" stroke-width="2.2"><polyline points="2 9 6 13 14 4"/></svg>Salvar senha</button>'
   +'<button onclick="_adminTogglePwd(\''+uid+'\')" style="padding:8px 12px;border:1px solid var(--border);border-radius:7px;background:transparent;color:var(--muted);font-size:12px;cursor:pointer">Cancelar</button>'
   +'</div>'
   +'<div id="adm-pwd-msg-'+uid+'" style="display:none;font-size:11px;margin-top:8px;padding:6px 10px;border-radius:6px"></div>'
   +'</div>'
   +'</div>';
 }).join('');
}

function _adminFilterUsers() {
 var q    = ((document.getElementById('adm-search')||{}).value||'').toLowerCase().trim();
 var role = ((document.getElementById('adm-filter-role')||{}).value||'');
 var filtered = _adminUsers.filter(function(u){
  var matchQ = !q || (u.email||'').toLowerCase().includes(q) || (u.full_name||'').toLowerCase().includes(q);
  var matchR = !role || (u.role||'usuario') === role;
  return matchQ && matchR;
 });
 _adminRenderUsers(filtered);
}

// ── Ações de usuário ──────────────────────────────────────────────────────────
async function _adminDesativar(userId) {
 if (!confirm('Suspender este usuário? Ele perderá o acesso imediatamente.')) return;
 var session = (await _sb.auth.getSession()).data.session; if(!session) return;
 var r = await fetch('https://pnecdbobhywfjdadylwt.supabase.co/functions/v1/auth-admin',{
  method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},
  body:JSON.stringify({action:'desativar-usuario',user_id:userId})
 });
 var res = await r.json();
 if(res.error){_showToast('Erro: '+res.error,'erro');return;}
 _showToast('Usuário suspenso','ok'); _adminLoadUsers();
}

async function _adminReativar(userId) {
 var session = (await _sb.auth.getSession()).data.session; if(!session) return;
 var r = await fetch('https://pnecdbobhywfjdadylwt.supabase.co/functions/v1/auth-admin',{
  method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},
  body:JSON.stringify({action:'reativar-usuario',user_id:userId})
 });
 var res = await r.json();
 if(res.error){_showToast('Erro: '+res.error,'erro');return;}
 _showToast('Usuário reativado','ok'); _adminLoadUsers();
}

async function _adminAlterarRole(userId, role) {
 var session = (await _sb.auth.getSession()).data.session; if(!session) return;
 var r = await fetch('https://pnecdbobhywfjdadylwt.supabase.co/functions/v1/auth-admin',{
  method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},
  body:JSON.stringify({action:'alterar-role',user_id:userId,role})
 });
 var res = await r.json();
 if(res.error){_showToast('Erro: '+res.error,'erro');return;}
 var u = _adminUsers.find(function(u){return u.id===userId;});
 if(u) u.role = role;
 _showToast('Perfil atualizado','ok');
}

function _adminTogglePwd(uid) {
 var panel = document.getElementById('adm-pwd-panel-'+uid);
 if (!panel) return;
 var isOpen = panel.style.display !== 'none';
 panel.style.display = isOpen ? 'none' : 'block';
 if (!isOpen) { var inp = document.getElementById('adm-pwd-inp-'+uid); if (inp) { inp.value = ''; inp.focus(); } }
}

async function _adminAlterarSenha(userId, uid) {
 var inp = document.getElementById('adm-pwd-inp-'+uid);
 var msg = document.getElementById('adm-pwd-msg-'+uid);
 var pwd = (inp ? inp.value : '').trim();
 if (pwd.length < 8) {
  if (msg) { msg.textContent = 'A senha deve ter no mínimo 8 caracteres.'; msg.style.display='block'; msg.style.background='var(--red-dim)'; msg.style.color='var(--red)'; }
  return;
 }
 var session = (await _sb.auth.getSession()).data.session; if (!session) return;
 if (msg) { msg.textContent = 'Salvando...'; msg.style.display='block'; msg.style.background='var(--surface2)'; msg.style.color='var(--muted)'; }
 var r = await fetch('https://pnecdbobhywfjdadylwt.supabase.co/functions/v1/auth-admin', {
  method:'POST',
  headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},
  body: JSON.stringify({action:'alterar-senha', user_id:userId, password:pwd})
 });
 var res = await r.json();
 if (res.error) {
  if (msg) { msg.textContent = 'Erro: '+res.error; msg.style.background='var(--red-dim)'; msg.style.color='var(--red)'; }
  return;
 }
 if (msg) { msg.textContent = 'Senha alterada com sucesso!'; msg.style.background='var(--green-dim)'; msg.style.color='var(--green)'; }
 if (inp) inp.value = '';
 setTimeout(function(){ _adminTogglePwd(uid); if(msg) msg.style.display='none'; }, 2000);
}

async function _adminReenviarConvite(email) {
 var session = (await _sb.auth.getSession()).data.session; if(!session) return;
 _showToast('Gerando link de acesso...', 'info');
 var r = await fetch('https://pnecdbobhywfjdadylwt.supabase.co/functions/v1/auth-admin',{
  method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},
  body:JSON.stringify({action:'reenviar-acesso', email})
 });
 var res = await r.json();
 if (res.error) { _showToast('Erro: '+res.error, 'erro'); return; }
 if (res.type === 'recovery' && res.link) {
  // Usuário ativo: mostra link copiável
  _adminMostrarLink(email, res.link);
 } else {
  _showToast('Convite reenviado para ' + email, 'ok');
 }
}

function _adminMostrarLink(email, link) {
 var existente = document.getElementById('adm-link-modal');
 if (existente) existente.remove();
 var el = document.createElement('div');
 el.id = 'adm-link-modal';
 el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center';
 el.innerHTML = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:28px;width:520px;max-width:94vw;box-shadow:0 20px 60px rgba(0,0,0,.35)">'
  +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">'
  +'<div><div style="font-size:15px;font-weight:700">Link de acesso gerado</div><div style="font-size:12px;color:var(--muted);margin-top:3px">Envie este link para '+email+' por WhatsApp ou e-mail</div></div>'
  +'<button onclick="document.getElementById(\'adm-link-modal\').remove()" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:20px;line-height:1">✕</button>'
  +'</div>'
  +'<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px;font-size:11px;color:var(--text);word-break:break-all;margin-bottom:12px;font-family:monospace;line-height:1.5">'+link+'</div>'
  +'<div style="display:flex;gap:8px">'
  +'<button onclick="navigator.clipboard.writeText(\''+link.replace(/'/g,"\\'")+'\'||\'\')" style="flex:1;padding:10px;border:none;border-radius:8px;background:var(--navy);color:#fff;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px"><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#fff" stroke-width="1.8"><rect x="5" y="2" width="9" height="11" rx="1"/><path d="M2 5v9a1 1 0 001 1h8"/></svg>Copiar link</button>'
  +'<button onclick="document.getElementById(\'adm-link-modal\').remove()" style="padding:10px 18px;border:1px solid var(--border);border-radius:8px;background:transparent;color:var(--muted);font-size:13px;cursor:pointer">Fechar</button>'
  +'</div>'
  +'<div style="margin-top:10px;font-size:11px;color:var(--muted)">Link válido por 24h. O usuário acessa e define uma nova senha.</div>'
  +'</div>';
 document.body.appendChild(el);
 el.addEventListener('click', function(e){ if(e.target===el) el.remove(); });
}

// ── Modal Convidar / Criar ────────────────────────────────────────────────────
var _adminInviteMode = 'invite';

function _adminSetMode(mode) {
 _adminInviteMode = mode;
 var btnInvite = document.getElementById('adm-mode-invite');
 var btnPwd    = document.getElementById('adm-mode-pwd');
 var pwdRow    = document.getElementById('adm-inv-pwd-row');
 var submitBtn = document.getElementById('adm-inv-btn-txt');
 if (mode === 'invite') {
  btnInvite.style.background = 'var(--green)'; btnInvite.style.color = '#fff';
  btnPwd.style.background    = 'none';         btnPwd.style.color    = 'var(--muted)';
  if (pwdRow)    pwdRow.style.display    = 'none';
  if (submitBtn) submitBtn.textContent   = 'Enviar convite por e-mail';
 } else {
  btnPwd.style.background    = 'var(--navy)';  btnPwd.style.color    = '#fff';
  btnInvite.style.background = 'none';         btnInvite.style.color = 'var(--muted)';
  if (pwdRow)    pwdRow.style.display    = '';
  if (submitBtn) submitBtn.textContent   = 'Criar acesso com senha';
 }
}

function _adminConvidarAbrir() {
 var m = document.getElementById('adm-invite-modal');
 if (!m) return;
 m.style.display = 'flex';
 // Reset campos
 ['adm-inv-nome','adm-inv-email','adm-inv-pwd'].forEach(function(id){
  var el = document.getElementById(id); if (el) el.value = '';
 });
 var al = document.getElementById('adm-invite-alert');
 if (al) { al.style.display = 'none'; al.textContent = ''; }
 _adminSetMode('invite');
 setTimeout(function(){ var el=document.getElementById('adm-inv-nome'); if(el)el.focus(); }, 50);
}

function _adminConvidarFechar() {
 var m = document.getElementById('adm-invite-modal');
 if (m) m.style.display = 'none';
}
async function _adminConvidarEnviar() {
 var nome  = ((document.getElementById('adm-inv-nome') ||{}).value||'').trim();
 var email = ((document.getElementById('adm-inv-email')||{}).value||'').trim().toLowerCase();
 var role  = ((document.getElementById('adm-inv-role') ||{}).value||'usuario');
 var area  = ((document.getElementById('adm-inv-area') ||{}).value||'');
 var pwd   = ((document.getElementById('adm-inv-pwd')  ||{}).value||'').trim();
 var mode  = _adminInviteMode || 'invite';

 var alertEl = document.getElementById('adm-invite-alert');
 var btn     = document.getElementById('adm-inv-btn');
 var btnTxt  = document.getElementById('adm-inv-btn-txt');
 var spinner = document.getElementById('adm-inv-spinner');

 function showAlert(msg, isErr) {
  if (!alertEl) return;
  alertEl.textContent   = msg;
  alertEl.style.display = 'block';
  alertEl.style.background = isErr ? 'var(--red-dim)'   : 'var(--green-dim)';
  alertEl.style.color      = isErr ? 'var(--red)'       : 'var(--green)';
  alertEl.style.border     = '1px solid ' + (isErr ? 'var(--red)' : 'var(--green)');
 }

 if (!nome)  { showAlert('Informe o nome completo.', true); return; }
 if (!email.endsWith('@milatec.ind.br')) { showAlert('E-mail deve ser @milatec.ind.br.', true); return; }
 if (mode === 'pwd' && pwd.length < 8)  { showAlert('Senha deve ter no mínimo 8 caracteres.', true); return; }

 if (btn)    btn.disabled         = true;
 if (spinner) spinner.style.display = '';
 if (btnTxt) btnTxt.textContent   = 'Aguarde...';

 var session = (await _sb.auth.getSession()).data.session;
 if (!session) {
  showAlert('Sessão expirada. Faça login novamente.', true);
  if(btn)btn.disabled=false; if(spinner)spinner.style.display='none'; if(btnTxt)btnTxt.textContent='Criar acesso'; return;
 }

 var actionBody = mode === 'pwd'
  ? {action:'criar-usuario-com-senha', email, nome, role, area, password: pwd}
  : {action:'convidar', email, nome, role, area};

 var r = await fetch('https://pnecdbobhywfjdadylwt.supabase.co/functions/v1/auth-admin', {
  method: 'POST',
  headers: {'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},
  body: JSON.stringify(actionBody)
 });
 var res = await r.json();

 if (btn)    btn.disabled         = false;
 if (spinner) spinner.style.display = 'none';
 if (btnTxt) btnTxt.textContent   = mode === 'pwd' ? 'Criar acesso com senha' : 'Enviar convite por e-mail';

 if (res.error) { showAlert(_supaErrPt(res.error), true); return; }

 var msg = mode === 'pwd'
  ? '✓ Acesso criado para ' + email + '. Comunique a senha ao usuário por canal seguro.'
  : '✓ Convite enviado para ' + email + '. Válido por 24h.';
 showAlert(msg, false);
 setTimeout(function(){ _adminConvidarFechar(); _adminLoadUsers(); }, 2500);
}
// ── Solicitações (legado) ─────────────────────────────────────────────────────
async function _adminLoadSols() {
 var el  = document.getElementById('admin-sols-list');
 var inf = document.getElementById('adm-sols-info');
 if(el) el.innerHTML='<div style="padding:16px;color:var(--muted);font-size:12px">Carregando...</div>';
 var res = await _sb.from('solicitacoes_acesso').select('*').eq('status','pendente').order('solicitado_em');
 _adminSols = res.data||[];
 if(inf) inf.textContent = _adminSols.length+' solicitação(ões) pendente(s)';
 // Update badge
 var badge = document.getElementById('adm-sols-badge');
 if(badge){ badge.textContent=_adminSols.length; badge.style.display=_adminSols.length>0?'':'none'; }
 // Update KPI
 var kpiPend = document.getElementById('adm-kpi-pend'); if(kpiPend) kpiPend.textContent=_adminSols.length;
 _adminRenderSols();
}

function _adminRenderSols() {
 var el = document.getElementById('admin-sols-list'); if(!el)return;
 if(!_adminSols.length){
  el.innerHTML='<div style="padding:32px;text-align:center;color:var(--muted);font-size:13px;border:1px dashed var(--border);border-radius:8px">Nenhuma solicitação pendente.<br><span style="font-size:11px">Novos usuários agora são criados diretamente pelo botão "Convidar usuário".</span></div>';
  return;
 }
 el.innerHTML=_adminSols.map(function(s){
  var dt=new Date(s.solicitado_em).toLocaleDateString('pt-BR');
  return '<div style="display:flex;align-items:center;gap:12px;padding:14px 16px;border:1px solid var(--border);border-radius:10px;background:var(--surface);margin-bottom:8px">'
   +'<div style="flex:1;min-width:0">'
   +'<div style="font-weight:600;font-size:13px">'+s.nome+'</div>'
   +'<div style="font-size:11px;color:var(--muted)">'+s.email+' · '+(s.area||'—')+' · '+dt+'</div>'
   +'</div>'
   +'<div style="display:flex;gap:8px">'
   +'<button onclick="_adminAprovar(\''+s.id+'\',\''+s.email+'\',\''+s.nome+'\')" style="padding:6px 14px;background:var(--green);color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer">Aprovar + Convidar</button>'
   +'<button onclick="_adminRejeitar(\''+s.id+'\')" style="padding:6px 14px;background:var(--surface2);color:var(--red);border:1px solid var(--border);border-radius:6px;font-size:12px;cursor:pointer">Rejeitar</button>'
   +'</div>'
   +'</div>';
 }).join('');
}

async function _adminAprovar(id,email,nome){
 var session=(await _sb.auth.getSession()).data.session; if(!session){_showToast('Sessão expirada','erro');return;}
 var r=await fetch('https://pnecdbobhywfjdadylwt.supabase.co/functions/v1/auth-admin',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},body:JSON.stringify({action:'aprovar',id,email,nome})});
 var res=await r.json(); if(res.error){_showToast('Erro: '+res.error,'erro');return;}
 _showToast('Convite enviado para '+email,'ok'); _adminLoadSols();
}
async function _adminRejeitar(id){
 var session=(await _sb.auth.getSession()).data.session; if(!session)return;
 await fetch('https://pnecdbobhywfjdadylwt.supabase.co/functions/v1/auth-admin',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},body:JSON.stringify({action:'rejeitar',id})});
 _showToast('Solicitação rejeitada','ok'); _adminLoadSols();
}

// ── Sistema tab ───────────────────────────────────────────────────────────────
async function _adminLoadSys() {
 // Verifica saúde do banco
 var dbEl = document.getElementById('adm-sys-db');
 try {
  var t0 = Date.now();
  var r = await _sb.from('atividades').select('id',{count:'exact',head:true});
  var ms = Date.now() - t0;
  if(dbEl) dbEl.innerHTML = '<div style="display:flex;align-items:center;gap:6px"><span style="width:7px;height:7px;border-radius:50%;background:var(--green);display:inline-block"></span>Conexão OK — '+ms+'ms</div><div style="margin-top:4px">'+((r.count)||0)+' atividades · '+( r.error ? r.error.message : 'sem erros')+'</div>';
 } catch(e) {
  if(dbEl) dbEl.innerHTML = '<span style="color:var(--red);font-weight:600">Erro de conexão:</span> '+e.message;
 }
 // Sync state
 var syncEl = document.getElementById('adm-sys-sync');
 try {
  var sr = await _sb.from('_sync_state').select('*').order('updated_at',{ascending:false}).limit(1);
  if(sr.data&&sr.data[0]) {
   var d = new Date(sr.data[0].updated_at);
   if(syncEl) syncEl.innerHTML='<span style="display:inline-flex;align-items:center;gap:5px"><span style="width:7px;height:7px;border-radius:50%;background:var(--green);display:inline-block"></span></span> '+d.toLocaleString('pt-BR')+'<div style="margin-top:4px;color:var(--muted)">'+sr.data[0].table_name+' — '+sr.data[0].records_synced+' registros</div>';
  } else {
   if(syncEl) syncEl.textContent='Sem dados de sincronização';
  }
 } catch(e) {
  if(syncEl) syncEl.textContent='—';
 }
}

// ── Carrega admin ao navegar ──────────────────────────────────────────────────
// Chamado por go('admin')
function _adminOnEnter() {
 _adminTab('users');
}
