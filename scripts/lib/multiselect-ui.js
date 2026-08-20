// ═══════════════════════════════════════════════════════════════════════════
// MULTISELECT UI — dropdown de checkboxes com busca, reaproveitando o mesmo
// visual do multiselect do Filtro (.fb-msel-*, ver filtro-builder.js) fora do
// contexto de um filtro — pra campos de formulário como Cidade(s) e Setor do
// cadastro de Fornecedor. Lógica de montar HTML/filtrar é pura
// (testável); quem chama liga o onchange a uma função própria (ex.:
// _fornMultiToggle no empresas.js).
// ═══════════════════════════════════════════════════════════════════════════

// Pedido explícito (Nova Obra: Produto/Responsável): a barra de busca
// sumia sempre que a lista tinha poucas opções (ex.: só 5 produtos
// "Solar"), escondida atrás de um limiar de itens — mas nada impede a
// lista de crescer depois, e escondida "às vezes" parecia bug ("não tem
// busca") em vez de comportamento condicional. Busca agora aparece sempre
// que há pelo menos 1 opção, sem limiar de quantidade.

// onToggleFnName: nome (string) de uma função global com assinatura
// (campo, valor, checked) — ex.: "_fornMultiToggle". Passar o nome (não a
// função) porque o HTML é montado como string pro onchange inline.
function _msRenderDropdown(campo, opcoes, selecionados, onToggleFnName, placeholder) {
 var sel = Array.isArray(selecionados) ? selecionados : [];
 var btnLabel = sel.length ? sel.length + ' selecionado(s)' : (placeholder || 'Selecionar...');
 var searchHtml = opcoes.length > 0
  ? '<input type="text" class="fb-msel-search" placeholder="Pesquisar..." oninput="_msFiltrarDOM(this)">'
  : '';
 var normalizar = (typeof _ssNormalize === 'function') ? _ssNormalize : function(s){ return (s||'').toLowerCase(); };
 var itemsHtml = opcoes.map(function(o) {
  var esc = o.replace(/"/g, '&quot;');
  var norm = normalizar(o);
  var ck = sel.indexOf(o) !== -1 ? ' checked' : '';
  return '<label class="fb-msel-item" data-norm="' + norm + '"><input type="checkbox" value="' + esc + '"' + ck
   + ' onchange="' + onToggleFnName + '(\'' + campo + '\',this.value,this.checked)"> ' + o + '</label>';
 }).join('');
 return '<div class="fb-msel-wrap">'
  + '<button type="button" class="fb-msel-btn" onclick="this.nextElementSibling.classList.toggle(\'open\')">' + btnLabel + '</button>'
  + '<div class="fb-msel-panel">' + searchHtml + '<div class="fb-msel-list">' + itemsHtml + '</div></div>'
  + '</div>';
}

// Filtra a lista de opções (pura, sem DOM) — ignora acento/caixa via
// _ssNormalize/_ssMatch (scripts/lib/smart-search.js) quando disponíveis.
function _msFiltrar(opcoes, query) {
 var normalizar = (typeof _ssNormalize === 'function') ? _ssNormalize : function(s){ return (s||'').toLowerCase(); };
 var bater = (typeof _ssMatch === 'function') ? _ssMatch : function(hay, q){ return hay.indexOf(q) !== -1; };
 var q = normalizar(query || '');
 if (!q) return opcoes.slice();
 return opcoes.filter(function(o) { return bater(normalizar(o), q); });
}

// Alterna um valor dentro de um array de selecionados — pura, devolve array
// novo (não muta o original).
function _msToggle(selecionados, valor, incluir) {
 var atual = Array.isArray(selecionados) ? selecionados.slice() : [];
 var idx = atual.indexOf(valor);
 var deveIncluir = (incluir !== undefined) ? !!incluir : (idx === -1);
 if (deveIncluir && idx === -1) atual.push(valor);
 if (!deveIncluir && idx !== -1) atual.splice(idx, 1);
 return atual;
}

// Aplica a mesma filtragem direto no DOM já renderizado (sem round-trip) —
// usado pelo oninput do campo de busca.
function _msFiltrarDOM(inputEl) {
 var normalizar = (typeof _ssNormalize === 'function') ? _ssNormalize : function(s){ return (s||'').toLowerCase(); };
 var bater = (typeof _ssMatch === 'function') ? _ssMatch : function(hay, q){ return hay.indexOf(q) !== -1; };
 var q = normalizar(inputEl.value || '');
 var list = inputEl.nextElementSibling;
 if (!list) return;
 Array.prototype.forEach.call(list.children, function(item) {
  var norm = item.getAttribute('data-norm') || '';
  item.style.display = (!q || bater(norm, q)) ? '' : 'none';
 });
}

if (typeof module !== 'undefined' && module.exports) {
 module.exports = { _msRenderDropdown, _msFiltrar, _msToggle, _msFiltrarDOM };
}
