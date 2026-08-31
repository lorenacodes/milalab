// ═══════════════════════════════════════════════════════════════════════════
// INLINE EDIT — célula editável estilo Airtable/Excel, pensada pra ser
// reaproveitada em qualquer tabela do sistema (primeira aplicação: Entregas,
// scripts/modules/entregas.js). Clicar numa célula entra em modo edição;
// Enter salva e desce uma linha; Tab/Shift+Tab salvam e andam pra
// direita/esquerda; Esc cancela; clique fora salva. Esta lib só cuida da
// interação e do editor por tipo — quem persiste é sempre a função de salvar
// já existente de cada módulo (ex.: _spEntDetSalvarCampo em entregas.js),
// passada como onSave em cada campo registrado. Sem isso, cada módulo
// reinventaria sua própria versão de "clique pra editar" do zero.
// ═══════════════════════════════════════════════════════════════════════════

var _ieState = {};   // { scope: { field: {type, options, colorMap, onSave, parse, getRow, align} } }
var _ieActiveTd = null;

function _ieEsc(s) {
 return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// scope: string (ex.: 'entregas'). fieldConfigs: { campo: cfg }. refreshFn:
// função que o módulo já usa pra re-renderizar a tabela inteira (reaproveita
// o pipeline existente — filtro/ordenação/agrupamento/somas continuam
// corretos depois de cada edição, sem duplicar essa lógica aqui).
function _ieRegister(scope, fieldConfigs, refreshFn) {
 _ieState[scope] = { fields: fieldConfigs, refresh: refreshFn };
}

// Gera o <td> no modo leitura. cfg: { id, field, value, display (html pronto,
// opcional — pra badge colorido etc.), align }.
function _ieCellHTML(scope, id, field, value, display, align) {
 var html = display != null ? display : (value == null || value === '' ? '<span class="ie-empty">—</span>' : _ieEsc(value));
 return '<td class="ie-cell" data-ie-scope="' + _ieEsc(scope) + '" data-ie-id="' + _ieEsc(id) + '" data-ie-field="' + _ieEsc(field) + '"'
  + (align ? ' style="text-align:' + align + '"' : '')
  + ' onclick="event.stopPropagation();_ieActivate(this)">' + html + '</td>';
}

function _ieFieldCfg(td) {
 var scope = td.dataset.ieScope;
 var st = _ieState[scope];
 if (!st) return null;
 var fcfg = st.fields[td.dataset.ieField];
 return fcfg ? { scope: scope, st: st, fcfg: fcfg } : null;
}

function _ieActivate(td) {
 if (_ieActiveTd === td) return;
 if (_ieActiveTd) _ieCommit(_ieActiveTd, true, null);
 var found = _ieFieldCfg(td);
 if (!found) return;
 var id = td.dataset.ieId;
 var row = found.fcfg.getRow ? found.fcfg.getRow(id) : null;
 var current = row ? row[td.dataset.ieField] : null;
 // Guardado no próprio nó (não num Map/estado à parte) — o <td> é descartado
 // no próximo refresh de qualquer jeito, então não sobrevive além do tempo
 // que precisa. Usado em _ieCommit pra montar a entrada de undo (Ctrl+Z,
 // ver scripts/lib/undo-manager.js) com o valor de ANTES da edição.
 td._ieBefore = current;
 td.classList.add('ie-editing');
 td.innerHTML = _ieEditorHTML(found.fcfg, current);
 _ieActiveTd = td;
 var tr = td.closest('tr'); if (tr) tr.classList.add('ie-row-active');
 var input = td.querySelector('.ie-input');
 if (!input) return;
 input.focus();
 if (input.select) input.select();
 if (input.scrollIntoView) input.scrollIntoView({ block: 'nearest', inline: 'nearest' });
 if (found.fcfg.type === 'select') {
  input.addEventListener('change', function() { _ieCommit(td, false, null); });
 }
 input.addEventListener('keydown', function(e) { _ieKeydown(e, td); });
 setTimeout(function() { document.addEventListener('mousedown', _ieOutsideClick, true); }, 0);
}

function _ieOutsideClick(e) {
 if (!_ieActiveTd || _ieActiveTd.contains(e.target)) return;
 document.removeEventListener('mousedown', _ieOutsideClick, true);
 _ieCommit(_ieActiveTd, false, null);
}

function _ieEditorHTML(fcfg, current) {
 if (fcfg.type === 'select') {
  var opts = (typeof fcfg.options === 'function' ? fcfg.options() : fcfg.options) || [];
  return '<select class="ie-input ie-select">'
   + '<option value=""></option>'
   + opts.map(function(o) {
    return '<option value="' + _ieEsc(o) + '"' + (o === current ? ' selected' : '') + '>' + _ieEsc(o) + '</option>';
   }).join('')
   + '</select>';
 }
 if (fcfg.type === 'date') {
  return '<input class="ie-input" type="date" value="' + (current || '') + '">';
 }
 if (fcfg.type === 'number') {
  return '<input class="ie-input" type="number" step="any" value="' + (current != null ? current : '') + '">';
 }
 return '<input class="ie-input" type="text" value="' + _ieEsc(current || '') + '">';
}

function _ieKeydown(e, td) {
 if (e.key === 'Escape') {
  e.preventDefault();
  document.removeEventListener('mousedown', _ieOutsideClick, true);
  var trEsc = td.closest('tr'); if (trEsc) trEsc.classList.remove('ie-row-active');
  _ieActiveTd = null;
  var found = _ieFieldCfg(td); if (found && found.st.refresh) found.st.refresh();
  return;
 }
 if (e.key === 'Enter')  { e.preventDefault(); _ieCommit(td, false, 'down'); return; }
 if (e.key === 'Tab')    { e.preventDefault(); _ieCommit(td, false, e.shiftKey ? 'left' : 'right'); return; }
}

// dir: 'down'|'left'|'right'|null (null = só salva, sem navegar — usado por
// clique-fora e pela troca de select). skipRefresh: true quando outra célula
// já vai assumir o foco imediatamente (evita um refresh redundante que só
// seria descartado no próximo _ieActivate).
async function _ieCommit(td, skipRefresh, dir) {
 document.removeEventListener('mousedown', _ieOutsideClick, true);
 var found = _ieFieldCfg(td);
 var tr = td.closest('tr'); if (tr) tr.classList.remove('ie-row-active');
 _ieActiveTd = null;
 if (!found) return;
 var rowIndex = td.parentElement.rowIndex, cellIndex = td.cellIndex, table = td.closest('table');
 var input = td.querySelector('.ie-input');
 var raw = input ? input.value : '';
 var val = found.fcfg.parse ? found.fcfg.parse(raw) : (raw === '' ? null : raw);
 var before = td._ieBefore;
 var id = td.dataset.ieId;
 td.classList.remove('ie-editing');
 td.classList.add('ie-saving');
 try {
  await found.fcfg.onSave(id, val);
  td.classList.remove('ie-saving');
  // Undo (Ctrl+Z) — só entra na pilha se o valor realmente mudou (edição
  // "sem efeito" não deveria consumir uma posição do histórico curto).
  // apply() é a MESMA função de salvar de sempre (found.fcfg.onSave) — o
  // undo-manager não duplica lógica de persistência, só chama de novo com
  // o valor de antes/depois. Ver scripts/lib/undo-manager.js.
  if (typeof _umPush === 'function' && String(val) !== String(before)) {
   _umPush(found.scope, {
    label: found.fcfg.label || null,
    before: before, after: val,
    apply: function(v) {
     // toastOk:false — o undo-manager já mostra seu próprio toast ("valor
     // anterior restaurado"/"alteração refeita"); sem isso o onSave normal
     // dispararia TAMBÉM o "Alteração salva" de sempre, dois toasts
     // empilhados pra uma única ação do usuário.
     return Promise.resolve(found.fcfg.onSave(id, v, { toastOk: false })).then(function() {
      if (found.st.refresh) found.st.refresh();
     });
    },
   });
  }
  if (!skipRefresh && found.st.refresh) {
   found.st.refresh();
   _ieFlashSuccess(table, rowIndex, cellIndex);
  }
 } catch (err) {
  td.classList.remove('ie-saving');
  td.classList.add('ie-error');
  setTimeout(function() { td.classList.remove('ie-error'); }, 2500);
  if (!skipRefresh && found.st.refresh) found.st.refresh();
  return;
 }
 if (dir && table) _ieNavigate(table, rowIndex, cellIndex, dir);
}

// Confirmação visual sutil pós-salvamento — roda DEPOIS do refresh (por isso
// relocaliza a célula por posição, igual _ieNavigate), pra piscar na célula
// já com o valor novo em vez da que está prestes a ser descartada.
function _ieFlashSuccess(table, rowIndex, cellIndex) {
 if (!table || !table.rows[rowIndex]) return;
 var cell = table.rows[rowIndex].cells[cellIndex];
 if (!cell || !cell.classList.contains('ie-cell')) return;
 cell.classList.add('ie-success');
 setTimeout(function() { cell.classList.remove('ie-success'); }, 700);
}

// Roda DEPOIS do refresh (a tabela já foi reconstruída via innerHTML — a
// referência antiga de <td> não existe mais, por isso navega por posição
// (rowIndex/cellIndex), não por nó). Pula linhas de cabeçalho de grupo
// (colspan largo, sem célula editável no mesmo cellIndex) até achar a
// próxima célula de verdade — senão "Enter" pararia no meio de um grupo.
function _ieNavigate(table, rowIndex, cellIndex, dir) {
 if (dir === 'down') {
  for (var r = rowIndex + 1; r < table.rows.length; r++) {
   var cell = table.rows[r].cells[cellIndex];
   if (cell && cell.classList.contains('ie-cell')) { _ieActivate(cell); return; }
  }
  return;
 }
 var row = table.rows[rowIndex];
 if (!row) return;
 var step = dir === 'right' ? 1 : -1;
 for (var c = cellIndex + step; c >= 0 && c < row.cells.length; c += step) {
  var cel = row.cells[c];
  if (cel && cel.classList.contains('ie-cell')) { _ieActivate(cel); return; }
 }
}

// Cor determinística (mesmo valor = mesma classe .badge sempre, sem precisar
// de um mapa fixo por valor) — usada pra campos de texto livre sem paleta
// própria (ex.: Transporte, onde qualquer nome de motorista/transportadora
// pode aparecer). NÃO usar pra campos que já têm mapa de cor real
// (BADGE_ETAPA_*, BADGE_TIPO_OBRA) — esses continuam com a cor certa fixa.
var _IE_HASH_PALETTE = ['bg','bn','by','br','bb','bp','bo'];
function _ieHashCls(val) {
 if (!val) return 'bm';
 var h = 0;
 for (var i = 0; i < val.length; i++) { h = (h * 31 + val.charCodeAt(i)) | 0; }
 return _IE_HASH_PALETTE[Math.abs(h) % _IE_HASH_PALETTE.length];
}

if (typeof module !== 'undefined' && module.exports) {
 module.exports = { _ieHashCls };
}
