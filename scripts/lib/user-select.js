// ═══════════════════════════════════════════════════════════════════════════
// SELEÇÃO DE USUÁRIO — padrão único (avatar + nome + busca) pra qualquer
// campo de Responsável/Colaborador do sistema. Pedido explícito da usuária:
// levantamento mostrou pelo menos 4 cópias quase idênticas desse dropdown
// espalhadas em Projeto/Obra/Entrega/wizard Nova Obra (cada uma reescrevendo
// a mesma lógica de busca+avatar+checkbox), além de vários filtros
// (Responsável/Criado por/Alterado por) sem avatar nenhum. Este arquivo é a
// versão única — os call sites viram uma chamada só, sem duplicar HTML.
//
// Reaproveita o que já existe: _userAvatarByName (avatar-helpers.js, foto
// 20px com fallback de iniciais), _msBtnLabel (multiselect-ui.js, rótulo do
// botão fechado com nomes de verdade), as mesmas classes .fb-msel-* já
// usadas por todo multiselect do sistema (Filtro/Cidade/Setor/Produto) —
// zero CSS novo, só reaproveita o componente visual existente.
// ═══════════════════════════════════════════════════════════════════════════

// users: [{value, nome}] — `value` é o que entra no array de selecionados
// (cada chamador decide se é e-mail ou nome, sem mudar dado/lógica
// existente); `nome` é o texto exibido, buscado e usado no lookup de
// avatar (_userAvatarByName casa por nome/e-mail contra _respUsuarios/
// _avatarCache, então funciona igual pros dois casos).
function _usMultiDropdownHTML(users, selected, onChangeAttr, placeholder) {
 var lista = (users || []).slice().sort(function(a, b) { return (a.nome || '').localeCompare(b.nome || '', 'pt-BR'); });
 var sel = Array.isArray(selected) ? selected : [];
 var normalizar = (typeof _ssNormalize === 'function') ? _ssNormalize : function(s) { return (s || '').toLowerCase(); };
 var selNomes = sel.map(function(v) { var u = lista.find(function(x) { return x.value === v; }); return u ? u.nome : v; });
 var btnLabel = (typeof _msBtnLabel === 'function') ? _msBtnLabel(selNomes, placeholder || 'Selecionar...') : (selNomes.join(', ') || (placeholder || 'Selecionar...'));
 // Busca sempre presente — pedido explícito, mesmo quando a lista de
 // usuários é pequena (diferente do multiselect genérico, que só mostra
 // busca acima de um limiar de itens).
 var searchHtml = '<input type="text" class="fb-msel-search" placeholder="Pesquisar usuário..." oninput="_usFilterDOM(this)">';
 var itemsHtml = lista.map(function(u) {
  var valEsc = String(u.value).replace(/"/g, '&quot;');
  var norm = normalizar(u.nome);
  var ck = sel.indexOf(u.value) !== -1 ? ' checked' : '';
  var avatarHtml = (typeof _userAvatarByName === 'function') ? _userAvatarByName(u.nome, 20) : '';
  return '<label class="fb-msel-item" data-norm="' + norm + '"><input type="checkbox" value="' + valEsc + '"' + ck
   + ' onchange="' + onChangeAttr + '">' + avatarHtml
   + '<span style="overflow:hidden;text-overflow:ellipsis">' + String(u.nome || '').replace(/</g, '&lt;') + '</span></label>';
 }).join('');
 var listBodyHtml = itemsHtml
  ? itemsHtml + '<div class="fb-msel-empty-msg" data-search-empty style="display:none;padding:8px;font-size:11px;color:var(--muted)">Nenhum usuário encontrado.</div>'
  : '<div class="fb-msel-empty-msg" style="padding:8px;font-size:11px;color:var(--muted)">Nenhum usuário cadastrado.</div>';
 return '<div class="fb-msel-wrap">'
  + '<button type="button" class="fb-msel-btn" onclick="this.nextElementSibling.classList.toggle(\'open\')">' + String(btnLabel).replace(/</g, '&lt;') + '</button>'
  + '<div class="fb-msel-panel">' + searchHtml + '<div class="fb-msel-list">' + listBodyHtml + '</div></div>'
  + '</div>';
}

// Filtra a lista já renderizada (sem round-trip) e alterna a mensagem
// "Nenhum usuário encontrado." — variante de _msFiltrarDOM
// (multiselect-ui.js) com o estado de "sem resultado" que os campos de
// pessoa precisam mostrar (pedido explícito) e os outros multiselects do
// sistema não têm.
function _usFilterDOM(inputEl) {
 var normalizar = (typeof _ssNormalize === 'function') ? _ssNormalize : function(s) { return (s || '').toLowerCase(); };
 var bater = (typeof _ssMatch === 'function') ? _ssMatch : function(hay, q) { return hay.indexOf(q) !== -1; };
 var q = normalizar(inputEl.value || '');
 var list = inputEl.nextElementSibling;
 if (!list) return;
 var anyVisible = false;
 Array.prototype.forEach.call(list.children, function(item) {
  if (item.hasAttribute('data-search-empty')) return;
  var norm = item.getAttribute('data-norm') || '';
  var show = !q || bater(norm, q);
  item.style.display = show ? '' : 'none';
  if (show) anyVisible = true;
 });
 var emptyMsg = list.querySelector('[data-search-empty]');
 if (emptyMsg) emptyMsg.style.display = anyVisible ? 'none' : '';
}

if (typeof module !== 'undefined' && module.exports) {
 module.exports = { _usMultiDropdownHTML, _usFilterDOM };
}
