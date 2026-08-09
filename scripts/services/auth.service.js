// ═══════════════════════════════════════════════════════════════════════════════
// AUTH SYSTEM — Supabase Auth: login, logout, sessão, recuperação de senha,
// primeiro acesso / convite, troca de senha voluntária.
// ═══════════════════════════════════════════════════════════════════════════════
var _ALLOWED_EMAILS = ['lorena@milatec.ind.br', 'aloisio@milatec.ind.br'];
// Domínios corporativos aceitos — Grupo Mila inteiro, não só a MilaTec.
// Única fonte de verdade no cliente (login, esqueci-senha, criação de
// usuário no admin todos chamam esta função em vez de repetir a lista).
// A edge function auth-admin tem a MESMA lista, independente (não dá pra
// compartilhar código entre o app e uma edge function sem bundler) — se
// mudar aqui, mudar lá também.
var _ALLOWED_DOMAINS = ['@milatec.ind.br', '@mila.ind.br'];
function _isAllowedEmailDomain(email) {
 email = (email || '').toLowerCase().trim();
 return _ALLOWED_DOMAINS.some(function(d) { return email.endsWith(d); });
}
var _currentUser    = null;

// Lógica central pós-login (perfil, badge de admin, dbInit). Chamada
// indiretamente via _loginSuccessOriginal pelo wrapper mais abaixo, que
// primeiro verifica se o usuário precisa trocar a senha.
function _loginSuccess(user) {
 var email     = user.email || '';
 var metaNome  = (user.user_metadata && user.user_metadata.full_name) || '';
 var firstName = (metaNome || email).split(/[@\s]/)[0];
 firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
 _currentUser = { id: user.id, email: email, name: metaNome || firstName, firstName: firstName };
 var ls = document.getElementById('login-screen'); if (ls) ls.style.display = 'none';
 if (!localStorage.getItem('pp-name')) localStorage.setItem('pp-name', metaNome || firstName);
 localStorage.setItem('milatec-user-email', email);
 var tu  = document.getElementById('topbar-user');   if (tu)  tu.style.display  = 'flex';
 var tn  = document.getElementById('topbar-user-name'); if (tn) tn.textContent  = email;
 var isAdmin  = _ALLOWED_EMAILS.indexOf(email) !== -1;
 var navAdmin = document.getElementById('nav-admin');
 if (navAdmin) navAdmin.style.display = isAdmin ? '' : 'none';
 if (isAdmin) {
  _sb.from('solicitacoes_acesso').select('id',{count:'exact',head:true}).eq('status','pendente').then(function(res){
   var n = res.count || 0;
   var b = document.getElementById('admin-badge');
   if (b) { b.textContent = n; b.style.display = n > 0 ? '' : 'none'; }
  });
 }
 _refreshProfileUI();
 _loadProfileFromDB();
 _dbInit();
}

async function _checkSession() {
 // Detecta contexto via URL: ?reset=1 (reset senha) ou ?type=invite (convite)
 var urlParams = new URLSearchParams(window.location.search);
 var hashParams = new URLSearchParams(window.location.hash.replace('#',''));
 var isReset  = urlParams.get('reset') === '1'
            || urlParams.get('type') === 'recovery'
            || hashParams.get('type') === 'recovery';
 var isInvite = urlParams.get('type') === 'invite' || hashParams.get('type') === 'invite';

 var sr = await _sb.auth.getSession();
 if (sr.data && sr.data.session && sr.data.session.user) {
  if (isInvite) {
   // Convite por e-mail — usuário precisa definir senha
   _cpwdUser = sr.data.session.user;
   _cpwdSetContext('invite');
   _authShow('change-pwd-screen');
   history.replaceState({}, '', window.location.pathname);
  } else if (isReset) {
   // Link de redefinição de senha
   _cpwdUser = sr.data.session.user;
   _cpwdSetContext('reset');
   _authShow('change-pwd-screen');
   history.replaceState({}, '', window.location.pathname);
  } else {
   _loginSuccess(sr.data.session.user);
  }
 } else {
  var ls = document.getElementById('login-screen');
  if (ls) ls.style.display = 'flex';
  var cs2 = document.getElementById('change-pwd-screen');
  if (cs2) cs2.style.display = 'none';
 }
}
document.addEventListener('DOMContentLoaded', _checkSession);

function _logout() {
 // Recarrega a página inteira após o signOut: a SPA mantém dezenas de caches
 // em memória (usuarios, projetos, atividades, avatar, nome...) que nunca
 // eram limpos ao trocar de conta, fazendo dados do usuário anterior
 // aparecerem misturados com os do novo login. Reload garante estado limpo.
 _sb.auth.signOut().then(function(){
  localStorage.removeItem('milatec-user-email');
  localStorage.removeItem('pp-name');
  localStorage.removeItem('pp-avatar');
  window.location.reload();
 }).catch(function(){
  window.location.reload();
 });
}

// ── Primeiro acesso / convite / reset de senha ────────────────────────────────
var _cpwdScore = 0;
var _cpwdUser  = null; // referência ao user do primeiro login
var _cpwdCtx   = 'first-access'; // contexto atual da tela de troca de senha

// Define contexto visual da tela de alteração de senha
// ctx: 'first-access' | 'invite' | 'reset'
function _cpwdSetContext(ctx) {
 var contexts = {
  'invite': {
   eyebrow: 'Ativação de conta',
   title: 'Defina sua senha',
   subtitle: 'Você recebeu um convite para o sistema MilaLab. Crie sua senha para ativar o acesso.',
   leftTitle: 'Bem-vindo à<br><span>MilaLab</span>',
   leftDesc: 'Você foi convidado(a) para o sistema interno MilaLab. Defina uma senha segura para começar.'
  },
  'reset': {
   eyebrow: 'Redefinição de senha',
   title: 'Criar nova senha',
   subtitle: 'Crie uma nova senha segura para sua conta.',
   leftTitle: 'Redefinição<br>de <span>senha</span>',
   leftDesc: 'Você solicitou a redefinição da sua senha. Crie uma nova senha forte para continuar.'
  },
  'first-access': {
   eyebrow: 'Primeiro acesso',
   title: 'Definir nova senha',
   subtitle: 'Por segurança, defina uma senha pessoal para substituir a senha temporária.',
   leftTitle: 'Sua segurança<br>é <span>prioridade</span>',
   leftDesc: 'Defina uma senha forte para proteger seu acesso ao sistema interno MilaLab.'
  },
  'voluntary': {
   eyebrow: 'Meu Perfil',
   title: 'Trocar senha',
   subtitle: 'Defina uma nova senha para sua conta.',
   leftTitle: 'Trocar<br><span>senha</span>',
   leftDesc: 'Você pode trocar sua senha sempre que quiser, a partir do seu perfil.'
  }
 };
 var c = contexts[ctx] || contexts['first-access'];
 _cpwdCtx = ctx;
 var set = function(id, val) { var el = document.getElementById(id); if(el) el.innerHTML = val; };
 set('cpwd-eyebrow', c.eyebrow);
 var titleEl = document.querySelector('#change-pwd-screen .auth-form-title');
 if(titleEl) titleEl.innerHTML = c.title;
 set('cpwd-subtitle', c.subtitle);
 set('cpwd-left-title', c.leftTitle);
 set('cpwd-left-desc', c.leftDesc);
 // Botões de cancelar — "Cancelar" simples (voluntário) ou "Cancelar e sair" (fluxo de login)
 var isVoluntary = (ctx === 'voluntary');
 var cancelBtn = document.getElementById('cpwd-cancel-btn');
 var logoutBtn = document.getElementById('cpwd-logout-btn');
 if (cancelBtn) cancelBtn.style.display = isVoluntary ? 'inline-block' : 'none';
 if (logoutBtn) logoutBtn.style.display = isVoluntary ? 'none' : 'inline-block';
}

function _cpwdCancel() {
 var cs = document.getElementById('change-pwd-screen');
 if (cs) cs.style.display = 'none';
}

var _cpwdReqs = [
 { id:'r-len',   label:'8+ caracteres',      test: function(v){ return v.length >= 8; } },
 { id:'r-upper', label:'1 maiúscula',          test: function(v){ return /[A-Z]/.test(v); } },
 { id:'r-lower', label:'1 minúscula',          test: function(v){ return /[a-z]/.test(v); } },
 { id:'r-num',   label:'1 número',             test: function(v){ return /[0-9]/.test(v); } },
 { id:'r-spec',  label:'1 caractere especial', test: function(v){ return /[^A-Za-z0-9]/.test(v); } },
];

function _openChangePwdVoluntary() {
 _cpwdUser = _currentUser;
 var inpNew = document.getElementById('cpwd-new');
 var inpConf = document.getElementById('cpwd-confirm');
 if (inpNew)  inpNew.value = '';
 if (inpConf) inpConf.value = '';
 _authAlert('cpwd-alert', '');
 _cpwdStrength('');
 _cpwdSetContext('voluntary');
 closeProfile();
 var cs = document.getElementById('change-pwd-screen');
 if (cs) cs.style.display = 'flex';
}

// Sobrescreve _loginSuccess para checar se precisa trocar senha
var _loginSuccessOriginal = _loginSuccess;
_loginSuccess = function(user) {
 // Esconde todas as telas de auth
 _AUTH_SCREENS.forEach(function(id){
  var el = document.getElementById(id); if(el) el.style.display = 'none';
 });

 var meta = user.user_metadata || {};
 // FIX: normaliza o tipo — Supabase armazena como string "true"/"false" ou booleano
 var pwdChanged = (meta.password_changed === true || meta.password_changed === 'true');

 // Qualquer usuário (não só admins) com senha NÃO alterada precisa trocar na entrada —
 // cobre o caso de usuário criado direto no admin/banco com senha temporária
 if (!pwdChanged) {
  _cpwdUser = user;
  _cpwdSetContext('first-access');
  _authShow('change-pwd-screen');
 }

 // Prossegue normalmente para o sistema
 _loginSuccessOriginal(user);
};

// ── Utilitário: mostrar/ocultar senha ─────────────────────────────────────────
function _togglePwd(inputId, btn) {
 var inp = document.getElementById(inputId);
 if (!inp) return;
 var isPass = inp.type === 'password';
 inp.type = isPass ? 'text' : 'password';
 // Troca ícone
 var svg = btn.querySelector('svg');
 if (svg) svg.innerHTML = isPass
  ? '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
  : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
}

// ── Helper: set loading state on btn ─────────────────────────────────────────
function _authBtnLoad(btnId, txtId, spinnerId, loading, txt) {
 var btn = document.getElementById(btnId);
 var t   = document.getElementById(txtId);
 var sp  = document.getElementById(spinnerId);
 if (btn) btn.disabled = loading;
 if (t)   t.textContent = txt || (loading ? 'Aguarde...' : 'Entrar');
 if (sp)  sp.style.display = loading ? 'block' : 'none';
}

// ── Helper: show alert ────────────────────────────────────────────────────────
function _authAlert(id, msg, type) {
 var el = document.getElementById(id);
 if (!el) return;
 el.textContent = msg || '';
 el.className = 'auth-alert ' + (type || 'err');
 el.style.display = msg ? 'block' : 'none';
}

// ── Navegação entre telas ─────────────────────────────────────────────────────
var _AUTH_SCREENS = ['login-screen','change-pwd-screen','forgot-pwd-screen'];
function _authShow(id) {
 _AUTH_SCREENS.forEach(function(s){
  var el = document.getElementById(s);
  if (el) el.style.display = (s === id) ? 'flex' : 'none';
 });
}

function _loginShowForgot()   { _authShow('forgot-pwd-screen'); }
function _loginShowLogin()    {
 ['forgot-alert','forgot-ok','req-alert','req-ok','setup-alert','login-err'].forEach(function(id){_authAlert(id,'');});
 _authShow('login-screen');
}

// ── Login (com loading state e alertas visuais) ───────────────────────────────
async function _loginSubmit() {
 var email = ((document.getElementById('login-email')||{}).value||'').trim().toLowerCase();
 var pass  = ((document.getElementById('login-pass') ||{}).value||'');
 _authAlert('login-err', '');
 if (!_isAllowedEmailDomain(email)) {
  _authAlert('login-err', 'Use seu e-mail corporativo (@milatec.ind.br ou @mila.ind.br)');
  document.getElementById('login-email').classList.add('error');
  return;
 }
 if (!pass) {
  _authAlert('login-err', 'Informe sua senha.');
  document.getElementById('login-pass').classList.add('error');
  return;
 }
 document.getElementById('login-email').classList.remove('error');
 document.getElementById('login-pass').classList.remove('error');
 _authBtnLoad('login-btn','login-btn-txt','login-spinner',true,'Entrando...');
 var r = await _sb.auth.signInWithPassword({ email: email, password: pass });
 _authBtnLoad('login-btn','login-btn-txt','login-spinner',false,'Entrar');
 if (r.error) {
  var msg = r.error.message;
  if (msg.includes('Invalid login credentials')) msg = 'E-mail ou senha incorretos. Verifique seus dados.';
  else if (msg.includes('Email not confirmed')) msg = 'E-mail não confirmado. Verifique sua caixa de entrada.';
  _authAlert('login-err', msg);
  document.getElementById('login-pass').classList.add('error');
  return;
 }
 _loginSuccess(r.data.user);
}

// ── Esqueci minha senha (com loading state e alertas visuais) ─────────────────
async function _forgotPwdSubmit() {
 var email = ((document.getElementById('forgot-email')||{}).value||'').trim().toLowerCase();
 _authAlert('forgot-alert',''); _authAlert('forgot-ok','');
 if (!email) { _authAlert('forgot-alert','Informe seu e-mail.'); return; }
 if (!_isAllowedEmailDomain(email)) { _authAlert('forgot-alert','Use seu e-mail corporativo (@milatec.ind.br ou @mila.ind.br).'); return; }
 _authBtnLoad('forgot-btn','forgot-btn-txt','forgot-spinner',true,'Enviando...');
 var redirectUrl = window.location.origin + window.location.pathname + '?reset=1';
 var res = await _sb.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl });
 _authBtnLoad('forgot-btn','forgot-btn-txt','forgot-spinner',false,'Enviar link de recuperação');
 if (res.error) { _authAlert('forgot-alert', _supaErrPt(res.error.message)); return; }
 _authAlert('forgot-ok','Link enviado! Verifique sua caixa de entrada. Válido por 1 hora.','ok');
 document.getElementById('forgot-btn').style.display = 'none';
}

// ── Troca de senha (primeiro acesso / convite / reset / voluntária) ───────────
async function _changePwdSubmit() {
 var newPwd  = ((document.getElementById('cpwd-new')    ||{}).value||'');
 var confirm = ((document.getElementById('cpwd-confirm')||{}).value||'');
 _authAlert('cpwd-alert','');
 if (_cpwdScore < 5) {
  _authAlert('cpwd-alert','Sua senha não atende todos os requisitos de segurança.');
  document.getElementById('cpwd-new').classList.add('error');
  return;
 }
 if (newPwd !== confirm) {
  _authAlert('cpwd-alert','As senhas não coincidem.');
  document.getElementById('cpwd-confirm').classList.add('error');
  return;
 }
 // Checagem de "senha igual à temporária" removida: comparava contra uma
 // string fixa hardcoded aqui (vazamento — qualquer um podia ler no código
 // fonte publicado). O Supabase já recusa senha igual à atual no próprio
 // servidor (ver tradução em supabase-client.js "A nova senha não pode ser
 // igual à senha atual"), então essa checagem client-side era redundante
 // além de perigosa.
 document.getElementById('cpwd-new').classList.remove('error');
 document.getElementById('cpwd-confirm').classList.remove('error');
 _authBtnLoad('cpwd-btn','cpwd-btn-txt','cpwd-spinner',true,'Salvando...');
 var updateRes = await _sb.auth.updateUser({ password: newPwd });
 if (updateRes.error) {
  _authBtnLoad('cpwd-btn','cpwd-btn-txt','cpwd-spinner',false,'Salvar senha e entrar');
  _authAlert('cpwd-alert', _supaErrPt(updateRes.error.message)); return;
 }
 // Marca como alterada (persistido em auth.users.user_metadata.password_changed via edge function)
 try {
  var session=(await _sb.auth.getSession()).data.session;
  if(session){await fetch('https://pnecdbobhywfjdadylwt.supabase.co/functions/v1/auth-admin',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},body:JSON.stringify({action:'marcar-senha-alterada'})});}
 } catch(e){}

 var cs0 = document.getElementById('change-pwd-screen');
 if (cs0) cs0.style.display = 'none';
 _authBtnLoad('cpwd-btn','cpwd-btn-txt','cpwd-spinner',false,'Salvar senha e entrar');

 if (_cpwdCtx === 'voluntary') {
  // Usuário já estava logado e trocou a senha por vontade própria — só fecha a tela, sem refazer o login
  if (typeof _showToast === 'function') _showToast('Senha alterada com sucesso.', 'sucesso');
  return;
 }

 _authShow(''); // esconde tudo
 _loginSuccessOriginal(updateRes.data.user || _cpwdUser);
}

// ── Indicador de força de senha (novos IDs de barra) ──────────────────────────
function _cpwdStrength(val) {
 var met = _cpwdReqs.filter(function(r){ return r.test(val); }).length;
 _cpwdScore = met;
 var colors=['','#D6433C','#f97316','#eab308','#1F8A4C','#16a34a'];
 var labels=['','Muito fraca','Fraca','Média','Forte','Muito forte'];
 var lColors=['','#D6433C','#f97316','#ca8a04','#16a34a','#15803d'];
 var fills=[[],[['#D6433C'],['','','','']],[['#f97316','#f97316'],['','','']],[['#eab308','#eab308','#eab308'],['','']],[['#1F8A4C','#1F8A4C','#1F8A4C','#1F8A4C'],['']],[['#16a34a','#16a34a','#16a34a','#16a34a','#16a34a'],[]]];
 var bClrs = val.length === 0 ? ['#e5e7eb','#e5e7eb','#e5e7eb','#e5e7eb','#e5e7eb'] : [
  met>=1?colors[Math.min(met,5)]:'#e5e7eb',
  met>=2?colors[Math.min(met,5)]:'#e5e7eb',
  met>=3?colors[Math.min(met,5)]:'#e5e7eb',
  met>=4?colors[Math.min(met,5)]:'#e5e7eb',
  met>=5?colors[Math.min(met,5)]:'#e5e7eb',
 ];
 for(var i=1;i<=5;i++){var b=document.getElementById('cbar-'+i);if(b)b.style.background=bClrs[i-1];}
 var lbl=document.getElementById('cpwd-strength-label');
 if(lbl){lbl.textContent=val.length>0?labels[met]:'';lbl.style.color=val.length>0?lColors[met]:'';}
 var reqs=document.getElementById('cpwd-reqs');
 if(reqs){reqs.innerHTML=_cpwdReqs.map(function(r){
  var ok=r.test(val);
  return '<div class="pwd-req-item'+(ok?' met':'')+'"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">'+(ok?'<polyline points="2,8 6,12 14,4"/>':'<circle cx="8" cy="8" r="6"/>')+'</svg>'+r.label+'</div>';
 }).join('');}
 var inp=document.getElementById('cpwd-new');
 if(inp&&val.length>0){inp.className='auth-inp auth-inp-pwd'+(met>=3?' success':' error');}
}

