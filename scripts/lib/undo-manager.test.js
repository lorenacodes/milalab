// node --test scripts/lib/undo-manager.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

// undo-manager.js é escrito pra rodar no browser (usa document/window pro
// atalho de teclado) — pra testar a PARTE lógica (pilha, limite, undo/redo,
// troca de escopo) sem precisar de DOM, um stub mínimo de `document` é
// suficiente só pra o require() não quebrar (o listener de keydown não é
// exercitado por estes testes, só as funções exportadas).
global.document = { addEventListener: function() {} };
const { _umPush, _umUndo, _umRedo, _umSetActiveScope, _UM_MAX } = require('./undo-manager.js');

function makeEntry(before, after, log) {
 return {
  label: 'Campo',
  before: before, after: after,
  apply: function(v) { log.push(v); return Promise.resolve(); },
 };
}

test('_umPush + _umUndo: restaura o valor anterior chamando apply(before)', async () => {
 var log = [];
 _umSetActiveScope('teste-a');
 _umPush('teste-a', makeEntry(10, 15, log));
 var handled = _umUndo('teste-a');
 assert.equal(handled, true);
 await Promise.resolve(); // deixa a Promise de apply() resolver
 assert.deepEqual(log, [10]);
});

test('_umUndo sem histórico: devolve false, não quebra', () => {
 assert.equal(_umUndo('escopo-vazio-' + Math.random()), false);
});

test('_umRedo depois de um undo: reaplica apply(after)', async () => {
 var log = [];
 _umSetActiveScope('teste-b');
 _umPush('teste-b', makeEntry(10, 15, log));
 _umUndo('teste-b');
 await Promise.resolve();
 var handled = _umRedo('teste-b');
 assert.equal(handled, true);
 await Promise.resolve();
 assert.deepEqual(log, [10, 15]);
});

test('uma edição nova invalida o redo pendente', async () => {
 var log = [];
 _umSetActiveScope('teste-c');
 _umPush('teste-c', makeEntry(1, 2, log));
 _umUndo('teste-c'); // agora tem 1 no redo
 await Promise.resolve();
 _umPush('teste-c', makeEntry(2, 3, log)); // edição nova — deveria zerar o redo
 assert.equal(_umRedo('teste-c'), false, 'redo antigo não deveria sobreviver a uma edição nova');
});

test('múltiplas alterações em cascata: undo desfaz na ordem inversa', async () => {
 var log = [];
 _umSetActiveScope('teste-d');
 _umPush('teste-d', makeEntry(10, 12, log));
 _umPush('teste-d', makeEntry(12, 15, log));
 _umUndo('teste-d'); await Promise.resolve(); // 15 → 12
 _umUndo('teste-d'); await Promise.resolve(); // 12 → 10
 assert.deepEqual(log, [12, 10]);
 assert.equal(_umUndo('teste-d'), false, 'nada mais pra desfazer');
});

test('histórico tem limite (_UM_MAX) — não cresce indefinidamente', async () => {
 var log = [];
 var scope = 'teste-limite';
 _umSetActiveScope(scope);
 for (var i = 0; i < _UM_MAX + 10; i++) {
  _umPush(scope, makeEntry(i, i + 1, log));
 }
 var undos = 0;
 while (_umUndo(scope)) { undos++; await Promise.resolve(); if (undos > 1000) break; }
 assert.equal(undos, _UM_MAX, 'só as ' + _UM_MAX + ' edições mais recentes deveriam ser desfazíveis');
});

test('_umSetActiveScope descarta o histórico da aba anterior ao trocar', () => {
 var log = [];
 _umSetActiveScope('aba-x');
 _umPush('aba-x', makeEntry(1, 2, log));
 _umSetActiveScope('aba-y'); // troca de aba — histórico de aba-x deveria sumir
 _umSetActiveScope('aba-x'); // volta — mas o de antes já foi descartado
 assert.equal(_umUndo('aba-x'), false);
});
