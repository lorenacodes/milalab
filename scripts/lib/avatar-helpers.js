// Utilitários de avatar compartilhados entre Dashboard e Gestor de Tarefas.
// Dependem de _respUsuarios (cache do Dashboard) só em tempo de execução — sem
// risco de ordem de carregamento, mas documentando o acoplamento aqui.
function _userAvatarHTML(u, size) {
 size = size || 24;
 var fontSize = Math.round(size * 0.38);
 if (u && u.avatar) {
  // Foto real: nunca preenchida com prata — só um anel fino de prata em volta.
  var ringPad = Math.max(2, Math.round(size * 0.07));
  var imgSize = size - ringPad * 2;
  return '<span style="display:inline-flex;width:' + size + 'px;height:' + size + 'px;padding:' + ringPad + 'px;border-radius:50%;background:var(--silver-grad,#C9CDD8);flex-shrink:0;box-sizing:border-box" title="' + (u.nome||'') + '">'
   + '<img src="' + u.avatar + '" style="width:' + imgSize + 'px;height:' + imgSize + 'px;border-radius:50%;object-fit:cover;display:block;border:2px solid var(--surface,#fff)">'
   + '</span>';
 }
 // Sem foto: prata metálica é o padrão, não uma exceção.
 var ltr = u ? (u.iniciais || (u.nome||'U').charAt(0).toUpperCase()) : 'U';
 return '<span style="display:inline-flex;align-items:center;justify-content:center;width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:var(--silver-grad,#C9CDD8);color:var(--silver-ink,#5B5F6B);font-size:' + fontSize + 'px;font-weight:700;flex-shrink:0" title="' + (u?u.nome:'') + '">' + ltr + '</span>';
}
// Normaliza nomes para comparação: remove acentos, baixa caixa, espaços extras
function _normName(s) {
 return (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

var _avatarCache = {}; // { nome_normalizado -> avatar_url } carregado de public.usuarios

async function _loadAvatarCacheFast() {
 if (Object.keys(_avatarCache).length > 0) return;
 try {
  var r = await _sb.from('usuarios').select('id, nome_display, email, avatar_url');
  if (r.data) {
   r.data.forEach(function(row) {
    if (!row.avatar_url) return;
    // Indexar por email (chave primária das tarefas)
    if (row.email) _avatarCache[_normName(row.email)] = row.avatar_url;
    // Indexar por nome completo e primeiro nome (normalizados, sem acento)
    if (row.nome_display) {
     _avatarCache[_normName(row.nome_display)] = row.avatar_url;
     var first = row.nome_display.split(' ')[0];
     if (first) _avatarCache[_normName(first)] = row.avatar_url;
    }
   });
   // Atualizar _respUsuarios se já carregado
   if (_respUsuarios.length > 0) {
    _respUsuarios.forEach(function(u) {
     if (!u.avatar) {
      u.avatar = _avatarCache[_normName(u.email)] || _avatarCache[_normName(u.nome)] || _avatarCache[_normName(u.nome.split(' ')[0])] || null;
     }
    });
   }
  }
 } catch(e) {}
}

function _userAvatarByName(name, size) {
 var nn = _normName(name);
 var nnFirst = _normName((name || '').split(' ')[0]);
 // Procurar em _respUsuarios primeiro (tem email para cor consistente)
 var u = _respUsuarios.find(function(r) {
  return _normName(r.nome) === nn || _normName(r.email) === nn
   || _normName(r.nome.split(' ')[0]) === nnFirst;
 });
 if (u) return _userAvatarHTML(u, size);
 // Fallback: usar _avatarCache (disponível mesmo sem edge function), comparando por nome normalizado/primeiro nome
 var avatar = _avatarCache[nn] || _avatarCache[nnFirst] || null;
 var fakeU = { nome: name, iniciais: (name||'U').charAt(0).toUpperCase(), avatar: avatar, email: name };
 return _userAvatarHTML(fakeU, size);
}
