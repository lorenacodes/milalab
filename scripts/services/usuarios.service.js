// ── Compat. pós-migração: atividades.responsavel e projetos.responsavel agora são
// text[] de e-mails (antes era texto único com nomes separados por vírgula), e
// obra_id/projeto_id/melhoria_id deixaram de ser colunas diretas em atividades
// (viraram junctions atividades_obras/atividades_projetos/atividades_melhorias).
// Os helpers abaixo isolam essa mudança para não precisar reescrever toda a UI.
var _usuariosCache = null; // [{id, email, nome_display}]
async function _loadUsuariosCache() {
 if (_usuariosCache) return _usuariosCache;
 try {
  var r = await _sb.from('usuarios').select('id, email, nome_display');
  _usuariosCache = (r.data || []);
 } catch(e) { _usuariosCache = []; }
 return _usuariosCache;
}
// Converte array de e-mails (text[]) em string "Nome1, Nome2" (formato que a UI antiga espera).
function _emailsToNomes(emails) {
 if (!emails) return '';
 var arr = Array.isArray(emails) ? emails : [emails];
 var cache = _usuariosCache || [];
 return arr.map(function(em) {
  var u = cache.find(function(x){ return x.email === em; });
  return (u && u.nome_display) || em;
 }).filter(Boolean).join(', ');
}
// Converte string digitada ("Nome1, Nome2" ou um nome só) em array de e-mails.
// Nomes sem usuário cadastrado correspondente são mantidos como string crua
// (não há perda de dado, só não casam com um usuario_id em atividades_responsaveis).
function _nomesStrToEmails(str) {
 if (!str) return null;
 var cache = _usuariosCache || [];
 var partes = String(str).split(/[,;]+/).map(function(s){ return s.trim(); }).filter(Boolean);
 if (!partes.length) return null;
 var emails = partes.map(function(nome) {
  var u = cache.find(function(x){
   return x.email === nome || x.nome_display === nome || (x.nome_display||'').split(' ')[0] === nome;
  });
  return (u && u.email) || nome;
 });
 return emails;
}
