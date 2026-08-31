// node --test scripts/lib/inline-edit.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { _ieHashCls } = require('./inline-edit.js');

test('_ieHashCls: mesmo valor sempre devolve a mesma classe (determinístico)', () => {
 const a = _ieHashCls('Mila - 05');
 const b = _ieHashCls('Mila - 05');
 assert.equal(a, b);
});

test('_ieHashCls: valor vazio/nulo cai no cinza neutro', () => {
 assert.equal(_ieHashCls(''), 'bm');
 assert.equal(_ieHashCls(null), 'bm');
});

test('_ieHashCls: valores diferentes tendem a classes diferentes (não é sempre a mesma)', () => {
 const vals = ['Mila - 05', 'Mila - 01', 'Frete Terceirizado', 'Retirada', 'Mila - Junto com Móveis'];
 const classes = new Set(vals.map(_ieHashCls));
 assert.ok(classes.size > 1);
});

test('_ieHashCls: sempre devolve uma classe .bX válida', () => {
 const valid = ['bg','bn','by','br','bb','bp','bo','bm'];
 ['x','y','z','Frete Terceirizado','123'].forEach(function(v) {
  assert.ok(valid.indexOf(_ieHashCls(v)) !== -1);
 });
});
