// ═══════════════════════════════════════════════════════════════════════════
// SEARCHABLE SELECT — componente genérico de select buscável (mesmo visual
// "srch-sel" já usado em Cargo/Estado/Empresa/Contato do orçamento), pra
// campos simples de "buscar numa lista e escolher 1" sem lógica cruzada
// (Empresa/Contato do orçamento continuam com suas próprias funções, porque
// têm comportamento específico: filtragem dependente um do outro, botão de
// abrir detalhe). Cada instância é identificada por um "kind" (string) e
// guarda seu próprio estado em _srchSelState[kind].
// ═══════════════════════════════════════════════════════════════════════════

// ── Lógica pura (testável) ──────────────────────────────────────────────────
function _ssSelFilterOptions(options, query) {
 var q = (query || '').trim().toLowerCase();
 if (!q) return (options || []).slice();
 return (options || []).filter(function(o) { return String(o).toLowerCase().indexOf(q) !== -1; });
}
// Só oferece "criar" quando a busca não é vazia e não existe já uma opção
// igual (comparação case-insensitive — "aracaju" não deve duplicar "Aracaju").
function _ssSelNeedsCreateOption(options, query, creatable) {
 if (!creatable) return false;
 var q = (query || '').trim();
 if (!q) return false;
 var qLower = q.toLowerCase();
 return !(options || []).some(function(o) { return String(o).toLowerCase() === qLower; });
}

// ── Componente DOM (browser only) ───────────────────────────────────────────
// Declarações no nível de topo, não dentro de um "if" — funções declaradas
// dentro de bloco só têm hoisting garantido (Annex B) em <script> normal, não
// sob eval() direto (usado nos testes manuais deste componente no console),
// então ficavam "undefined" ali mesmo carregando certinho na aplicação real.
// Só a linha que efetivamente toca `document` (o addEventListener no fim)
// precisa do guard, já que este arquivo também é `require()`ado pelo teste
// Node (searchable-select.test.js), onde `document` não existe.
var _srchSelState = {};

// cfg: { options: () => string[] (ou array já pronto), creatable?: bool,
//        onSelect?: function(value), placeholder?: string }
function _srchSelRegister(kind, cfg) {
 _srchSelState[kind] = Object.assign({ selected: '', creatable: false }, cfg);
}
function _srchSelOptionsOf(kind) {
 var st = _srchSelState[kind];
 if (!st) return [];
 var opts = typeof st.options === 'function' ? st.options() : (st.options || []);
 return opts || [];
}
function _srchSelMarkup(kind, hiddenId, atual) {
 var st = _srchSelState[kind];
 st.selected = atual || '';
 st.hiddenId = hiddenId;
 var temValor = !!st.selected;
 return '<input type="hidden" id="' + hiddenId + '" value="' + String(st.selected).replace(/"/g,'&quot;') + '">'
  + '<div class="srch-sel" id="sp-srch-' + kind + '-srch">'
  + '<div class="srch-sel-box" id="sp-srch-' + kind + '-box" onclick="_srchSelToggle(\'' + kind + '\')">'
  + '<span class="srch-sel-val' + (temValor?'':' placeholder') + '" id="sp-srch-' + kind + '-val">' + (temValor ? String(st.selected).replace(/</g,'&lt;') : (st.placeholder || 'Selecione...')) + '</span>'
  + '<button class="srch-sel-clr" id="sp-srch-' + kind + '-clr" style="display:' + (temValor?'':'none') + '" onclick="event.stopPropagation();_srchSelClear(\'' + kind + '\')" title="Remover">✕</button>'
  + '<span class="srch-sel-chevron">▾</span>'
  + '</div>'
  + '<div class="srch-sel-drop" id="sp-srch-' + kind + '-drop">'
  + '<input class="srch-sel-inp" id="sp-srch-' + kind + '-inp" type="text" placeholder="Buscar..." oninput="_srchSelFilter(\'' + kind + '\', this.value)" onkeydown="_srchSelKey(\'' + kind + '\', event)">'
  + '<div class="srch-sel-list" id="sp-srch-' + kind + '-list"></div>'
  + '</div>'
  + '</div>';
}
async function _srchSelToggle(kind) {
 var drop = document.getElementById('sp-srch-' + kind + '-drop');
 var box  = document.getElementById('sp-srch-' + kind + '-box');
 if (!drop) return;
 if (drop.classList.contains('open')) { _srchSelClose(kind); return; }
 var st = _srchSelState[kind];
 if (st && typeof st.onOpen === 'function') await st.onOpen();
 drop.classList.add('open'); if (box) box.classList.add('open');
 var inp = document.getElementById('sp-srch-' + kind + '-inp');
 if (inp) { inp.value = ''; inp.focus(); }
 // Filtra ANTES de posicionar: a decisão de abrir pra cima/baixo usa a
 // altura real do dropdown já com a lista preenchida (drop.offsetHeight),
 // não uma estimativa de antes do conteúdo existir.
 _srchSelFilter(kind, '');
 _srchSelPosition(kind);
}
// position:fixed (não absolute) de propósito: quando este componente é
// usado dentro de um modal com área rolável (ex.: wizard de Nova Obra,
// passo Projetos, campo "Projeto existente" perto do fim do formulário),
// um dropdown absolute era cortado pela div com overflow-y:auto do modal —
// os resultados carregavam certinho (confirmado testando: 21 opções no
// DOM), só ficavam invisíveis, cortados pela borda do container. fixed
// escapa desse recorte por definição, com a posição calculada aqui via
// getBoundingClientRect() — e vira "pra cima" quando não sobra espaço
// embaixo (comum quando o campo fica perto do fim do modal/tela).
function _srchSelPosition(kind) {
 var drop = document.getElementById('sp-srch-' + kind + '-drop');
 var box  = document.getElementById('sp-srch-' + kind + '-box');
 if (!drop || !box) return;
 var boxRect = box.getBoundingClientRect();
 var dropH = drop.offsetHeight || 240; // estimativa antes do 1º layout
 var vh = window.innerHeight;
 var margin = 8;
 var abreParaCima = (boxRect.bottom + dropH + margin > vh) && (boxRect.top - dropH - margin > 0);
 drop.style.left = boxRect.left + 'px';
 drop.style.width = boxRect.width + 'px';
 if (abreParaCima) {
  drop.style.top = 'auto';
  drop.style.bottom = (vh - boxRect.top + 4) + 'px';
 } else {
  drop.style.bottom = 'auto';
  drop.style.top = (boxRect.bottom + 4) + 'px';
 }
}
function _srchSelClose(kind) {
 var drop = document.getElementById('sp-srch-' + kind + '-drop');
 var box  = document.getElementById('sp-srch-' + kind + '-box');
 if (drop) drop.classList.remove('open');
 if (box)  box.classList.remove('open');
}
function _srchSelFilter(kind, q) {
 var st = _srchSelState[kind];
 var list = document.getElementById('sp-srch-' + kind + '-list');
 if (!st || !list) return;
 var options = _srchSelOptionsOf(kind);
 var matches = _ssSelFilterOptions(options, q);
 var precisaCriar = _ssSelNeedsCreateOption(options, q, st.creatable);
 var html = matches.map(function(o) {
  var sel = o === st.selected ? ' selected' : '';
  return '<div class="srch-sel-opt' + sel + '" onclick="_srchSelSelectItem(\'' + kind + '\',\'' + String(o).replace(/'/g,"\\'") + '\')">' + String(o).replace(/</g,'&lt;') + '</div>';
 }).join('');
 if (precisaCriar) {
  var qTrim = (q || '').trim();
  html += '<div class="srch-sel-opt" style="font-style:italic;color:var(--muted)" onclick="_srchSelSelectItem(\'' + kind + '\',\'' + qTrim.replace(/'/g,"\\'") + '\')">Usar "' + qTrim.replace(/</g,'&lt;') + '"</div>';
 }
 list.innerHTML = html || '<div class="srch-sel-empty">Nenhum resultado encontrado.</div>';
}
function _srchSelSelectItem(kind, value) {
 var st = _srchSelState[kind];
 if (!st) return;
 st.selected = value || '';
 var hidEl = document.getElementById(st.hiddenId);
 var valEl = document.getElementById('sp-srch-' + kind + '-val');
 var clrEl = document.getElementById('sp-srch-' + kind + '-clr');
 if (hidEl) hidEl.value = st.selected;
 if (valEl) { valEl.textContent = st.selected || st.placeholder || 'Selecione...'; valEl.classList.toggle('placeholder', !st.selected); }
 if (clrEl) clrEl.style.display = st.selected ? '' : 'none';
 _srchSelClose(kind);
 if (typeof st.onSelect === 'function') st.onSelect(st.selected);
}
function _srchSelClear(kind) { _srchSelSelectItem(kind, ''); }
function _srchSelKey(kind, e) { if (e.key === 'Escape') _srchSelClose(kind); }

if (typeof document !== 'undefined') {
 document.addEventListener('click', function(e) {
  Object.keys(_srchSelState).forEach(function(kind) {
   var drop = document.getElementById('sp-srch-' + kind + '-drop');
   var box  = document.getElementById('sp-srch-' + kind + '-box');
   if (drop && box && !box.contains(e.target) && !drop.contains(e.target)) _srchSelClose(kind);
  });
 });
 // position:fixed não acompanha o scroll do container do modal (diferente
 // de position:absolute) — sem isso, rolar o formulário com o dropdown
 // aberto deixaria ele "flutuando" longe do campo. Fecha em vez de tentar
 // reposicionar em tempo real (simples e sem jank); capture:true pra pegar
 // o scroll de QUALQUER ancestral rolável, não só o document.
 document.addEventListener('scroll', function(e) {
  Object.keys(_srchSelState).forEach(function(kind) {
   var drop = document.getElementById('sp-srch-' + kind + '-drop');
   if (drop && drop.classList.contains('open') && !drop.contains(e.target)) _srchSelClose(kind);
  });
 }, true);
}

if (typeof module !== 'undefined' && module.exports) {
 module.exports = { _ssSelFilterOptions, _ssSelNeedsCreateOption };
}
