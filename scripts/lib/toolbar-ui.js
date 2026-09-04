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
 var wrapRect = wrapEl.getBoundingClientRect();
 var popWidth = popEl.offsetWidth || parseInt(getComputedStyle(popEl).width, 10) || 300;
 var vw = document.documentElement.clientWidth;
 var margin = 12; // respiro mínimo até a borda da tela
 var spaceRight = vw - wrapRect.left - margin;
 var spaceLeft = wrapRect.right - margin;
 // IMPORTANTE: o lado que não vamos usar precisa virar 'auto' explícito, não
 // '' (vazio). Zerar com '' só remove um override inline anterior — a
 // largura fixa em CSS (.fb-pop{width:460px;left:0}) continua valendo, e
 // quando left/right/width ficam todos definidos ao mesmo tempo (over-
 // constrained), a spec do CSS manda ignorar 'right' e resolver por
 // left+width em LTR. Resultado: popovers cujo left:0 vem do stylesheet (ex.
 // Filtro/Agrupar/Ordenar) IGNORAVAM o right:0 que esta função tentava
 // aplicar e vazavam da tela mesmo assim (bug real, achado testando
 // Ordenar numa viewport de 560px). 'auto' explícito no lado não usado
 // resolve de vez.
 if (spaceRight >= popWidth) {
  popEl.style.left = '0';
  popEl.style.right = 'auto';
 } else if (spaceLeft >= popWidth) {
  popEl.style.right = '0';
  popEl.style.left = 'auto';
 } else {
  // Nenhum lado tem espaço pra largura toda (tela estreita/zoom alto) —
  // alinha pela esquerda e desloca só o suficiente pra não vazar da tela.
  popEl.style.right = 'auto';
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

// ── Persistência do texto de busca entre recarregamentos (F5) ───────────────
// Relato: "mesmo com algo pesquisado, a barra de pesquisa se fecha ao
// recarregar a página". Investigado: não existe nenhum localStorage/URL por
// trás da maioria dos módulos — um F5 literal já reseta TODO estado de JS
// por definição, então o campo ficar vazio depois de um F5 não seria bug
// nenhum, só o padrão de qualquer app sem persistência (a única exceção já
// existente era o Gestor de Tarefas, que salva filtro/ordenação/agrupamento/
// busca inteiros em localStorage — ver _gestorSaveState/_gestorRestoreState
// em tarefas.js). Só o TEXTO da busca foi pedido explicitamente, então em vez
// de replicar aquele estado inteiro em cada módulo (fora do escopo do
// relato), isto guarda só o texto — sessionStorage (não localStorage: busca é
// transitória, não devia sobreviver dias) e um item por instância.
// Mesmo achado do Gestor: reatribuir sozinho o .value do <input> NÃO reabre
// a caixa — o wrapper .ts-search só fica largo com a classe "expanded" (ver
// main.css); sem ela, o texto restaurado fica escondido atrás do ícone da
// lupa (era exatamente esse detalhe que, no Gestor, parecia "a busca fecha
// ao recarregar" quando na verdade o texto tinha voltado, só sem reabrir).
function _tsSearchStorageKey(instanceId) { return 'mlds-search-' + instanceId; }
function _tsSearchSave(instanceId) {
 var wrap = document.getElementById('ts-search-' + instanceId);
 var input = wrap && wrap.querySelector('input');
 if (!input) return;
 try {
  if (input.value) sessionStorage.setItem(_tsSearchStorageKey(instanceId), input.value);
  else sessionStorage.removeItem(_tsSearchStorageKey(instanceId));
 } catch (e) { /* sessionStorage indisponível (modo privado etc.) — ignora */ }
}
function _tsSearchRestore(instanceId) {
 var val;
 try { val = sessionStorage.getItem(_tsSearchStorageKey(instanceId)); } catch (e) { return; }
 if (!val) return;
 var wrap = document.getElementById('ts-search-' + instanceId);
 var input = wrap && wrap.querySelector('input');
 if (!input) return;
 input.value = val;
 wrap.classList.add('expanded');
}

// Export só pra Node (testes, node:test) — não muda nada no navegador.
if (typeof module !== 'undefined' && module.exports) {
 module.exports = { _tsSmartPosition, _tsSearchExpand, _tsSearchCollapse, _tsSearchSave, _tsSearchRestore };
}
