// ═══════════════════════════════════════════════════════════════════════════
// TOOLBAR UI — comportamentos compartilhados da toolbar (Pesquisa/Filtro/
// Agrupar/Ordenar/Período/Visualizações) usados por TODOS os módulos que a
// reaproveitam (Gestor de Tarefas, Obras, Empresas, Instalações, Entregas,
// Projetos, Melhorias). Duas responsabilidades:
//
// 1) _tsSmartPosition(wrapEl, popEl) — os popovers (filtro/agrupar/ordenar/
//    período/visualizações) têm largura fixa (ver .fb-pop/.gp-pop/.gv-pop em
//    main.css) e por padrão abrem alinhados à esquerda do botão que os
//    abriu. Perto da borda direita da tela isso corta o popover. Esta
//    função mede o espaço disponível dos dois lados e decide left/right/
//    clamp — chamada pelos *RenderVisibility/*Render de filtro-builder.js,
//    sort-builder.js, group-builder.js e pelos popovers próprios do Gestor
//    de Tarefas (período, visualizações) toda vez que abrem.
//
// 2) _tsSearchExpand/_tsSearchCollapse — pesquisa expansível estilo
//    Airtable: só o ícone de lupa por padrão, expande ao clicar/focar,
//    recolhe ao perder foco se estiver vazia. Um wrapper (.ts-search) por
//    instância, identificado por instanceId (ts-search-<id>) — não precisa
//    de mapa id→input porque o wrapper contém o input direto
//    (wrap.querySelector('input')).
// ═══════════════════════════════════════════════════════════════════════════

function _tsSmartPosition(wrapEl, popEl) {
 if (!wrapEl || !popEl) return;
 popEl.style.left = '';
 popEl.style.right = '';
 popEl.style.transform = '';
 var wrapRect = wrapEl.getBoundingClientRect();
 var popWidth = popEl.offsetWidth || parseInt(getComputedStyle(popEl).width, 10) || 300;
 var vw = document.documentElement.clientWidth;
 var margin = 12; // respiro mínimo até a borda da tela
 var spaceRight = vw - wrapRect.left - margin;
 var spaceLeft = wrapRect.right - margin;
 if (spaceRight >= popWidth) {
  popEl.style.left = '0';
 } else if (spaceLeft >= popWidth) {
  popEl.style.right = '0';
 } else {
  // Nenhum lado tem espaço pra largura toda (tela estreita/zoom alto) —
  // alinha pela esquerda e desloca só o suficiente pra não vazar da tela.
  popEl.style.left = '0';
  var overflowRight = (wrapRect.left + popWidth + margin) - vw;
  if (overflowRight > 0) popEl.style.left = (-overflowRight) + 'px';
 }
}

function _tsSearchExpand(instanceId) {
 var wrap = document.getElementById('ts-search-' + instanceId);
 if (!wrap) return;
 var input = wrap.querySelector('input');
 if (!wrap.classList.contains('expanded')) wrap.classList.add('expanded');
 if (input) setTimeout(function() { input.focus(); }, 10);
}

function _tsSearchCollapse(wrapId, inputEl) {
 if (inputEl && inputEl.value) return; // não recolhe com texto digitado
 var wrap = document.getElementById(wrapId);
 if (wrap) wrap.classList.remove('expanded');
}

// Export só pra Node (testes, node:test) — não muda nada no navegador.
if (typeof module !== 'undefined' && module.exports) {
 module.exports = { _tsSmartPosition, _tsSearchExpand, _tsSearchCollapse };
}
