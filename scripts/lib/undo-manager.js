// ═══════════════════════════════════════════════════════════════════════════
// UNDO MANAGER — motor genérico de desfazer/refazer (Ctrl+Z / Ctrl+Shift+Z ou
// Ctrl+Y), pensado pra ser reaproveitado por qualquer edição do sistema —
// primeira aplicação: edição inline de Entregas (ver _ieCommit em
// inline-edit.js). NÃO é versionamento nem auditoria: é uma pilha CURTA em
// memória (_UM_MAX por aba/escopo), descartada ao trocar de aba — não grava
// nada extra no banco além da própria edição (o undo só chama de novo a
// mesma função de salvar já existente, com o valor de antes).
//
// Cada módulo registra uma edição já COMMITADA (valor final decidido por
// quem chama — ex.: "Residência Unifamiliar" → "Residência Multifamiliar" é
// UMA entrada, nunca uma por tecla digitada) via _umPush(scope, entry), onde
// entry = { label, before, after, apply(value) → Promise }. apply() é
// sempre a MESMA função de persistir que o campo já usa (ex.: onSave do
// inline-edit) — undo/redo só trocam qual valor passar pra ela.
// ═══════════════════════════════════════════════════════════════════════════

var _UM_MAX = 20; // histórico "recente", não um log permanente
var _umState = {}; // { scope: { undo: [entry...], redo: [entry...] } }
var _umActiveScope = null;

function _umScope(scope) {
 if (!_umState[scope]) _umState[scope] = { undo: [], redo: [] };
 return _umState[scope];
}

// Chamada pelo router central (go(), scripts/app.js) a cada troca de aba.
// Descarta de vez o histórico da aba que está sendo deixada — pedido
// explícito: Ctrl+Z não deve reverter um registro que não está mais na tela
// (editou Entregas, foi pra Obras, Ctrl+Z não pode "voltar" e mexer na
// Entrega de antes sem o usuário ver o que está sendo desfeito).
function _umSetActiveScope(scope) {
 if (_umActiveScope && _umActiveScope !== scope) delete _umState[_umActiveScope];
 _umActiveScope = scope || null;
}

function _umPush(scope, entry) {
 if (!scope || !entry) return;
 var s = _umScope(scope);
 s.undo.push(entry);
 if (s.undo.length > _UM_MAX) s.undo.shift();
 s.redo.length = 0; // uma edição nova invalida qualquer "refazer" pendente
}

function _umToast(msg) {
 if (typeof _showToast === 'function') _showToast(msg, 'sucesso');
}

function _umUndo(scope) {
 var s = _umScope(scope);
 var entry = s.undo.pop();
 if (!entry) return false;
 s.redo.push(entry);
 Promise.resolve(entry.apply(entry.before)).then(function() {
  _umToast(entry.label ? entry.label + ' — valor anterior restaurado' : 'Alteração desfeita');
 }).catch(function() {
  // Falhou ao persistir o undo (ex.: rede) — devolve a entrada pra pilha
  // de undo em vez de deixá-la presa só na de redo, pra poder tentar de novo.
  s.redo.pop(); s.undo.push(entry);
  if (typeof _showToast === 'function') _showToast('Não foi possível desfazer — tente novamente', 'erro');
 });
 return true;
}

function _umRedo(scope) {
 var s = _umScope(scope);
 var entry = s.redo.pop();
 if (!entry) return false;
 s.undo.push(entry);
 Promise.resolve(entry.apply(entry.after)).then(function() {
  _umToast(entry.label ? entry.label + ' — alteração refeita' : 'Alteração refeita');
 }).catch(function() {
  s.undo.pop(); s.redo.push(entry);
  if (typeof _showToast === 'function') _showToast('Não foi possível refazer — tente novamente', 'erro');
 });
 return true;
}

// ── Atalho global ────────────────────────────────────────────────────────
// Enquanto o foco está num campo de texto sendo digitado (input/textarea/
// contenteditable), Ctrl+Z é deixado passar pro undo NATIVO do navegador
// (desfazer por tecla dentro do próprio campo) — competir com ele é
// exatamente o comportamento imprevisível que este mecanismo precisa evitar.
// Só depois que a edição já foi commitada (célula voltou pro modo leitura,
// foco saiu do campo) é que o Ctrl+Z passa a valer pra este histórico.
document.addEventListener('keydown', function(e) {
 var key = (e.key || '').toLowerCase();
 if (key !== 'z' && key !== 'y') return;
 if (!(e.ctrlKey || e.metaKey)) return;
 var ae = document.activeElement;
 var isTextEditable = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable);
 if (isTextEditable) return;
 if (!_umActiveScope) return;
 var isRedo = key === 'y' || (key === 'z' && e.shiftKey);
 var handled = isRedo ? _umRedo(_umActiveScope) : _umUndo(_umActiveScope);
 if (handled) e.preventDefault();
}, true);

if (typeof module !== 'undefined' && module.exports) {
 module.exports = { _umPush, _umUndo, _umRedo, _umSetActiveScope, _UM_MAX: _UM_MAX };
}
