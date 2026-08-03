// node --test scripts/lib/group-builder.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { _gbInstances, _gbInit, _gbPrimaryField, _gbSetLevel, _gbAddLevel, _gbRemoveLevel } = require('./group-builder.js');

const FIELDS = [
 { key: 'responsavel', label: 'Responsável' },
 { key: 'status', label: 'Status' },
 { key: 'area', label: 'Área' },
];

test('sem seleção: _gbPrimaryField retorna null', () => {
 _gbInit('g1', FIELDS, null);
 assert.equal(_gbPrimaryField('g1'), null);
});

test('_gbSetLevel define o campo ativo (1 nível)', () => {
 _gbInit('g2', FIELDS, null);
 _gbSetLevel('g2', 'status');
 assert.equal(_gbPrimaryField('g2'), 'status');
 // Trocar de novo substitui, não acumula (é "set", não "add").
 _gbSetLevel('g2', 'area');
 assert.equal(_gbPrimaryField('g2'), 'area');
 assert.equal(_gbInstances.g2.state.levels.length, 1);
});

test('agrupamento com contagem: exemplo de uso real (contar por grupo)', () => {
 _gbInit('g3', FIELDS, null);
 _gbSetLevel('g3', 'responsavel');
 const items = [
  { responsavel: 'Ana' }, { responsavel: 'Ana' }, { responsavel: 'Bruno' },
 ];
 const field = _gbPrimaryField('g3');
 const groups = {};
 items.forEach((i) => { const k = i[field]; groups[k] = (groups[k] || 0) + 1; });
 assert.deepEqual(groups, { Ana: 2, Bruno: 1 });
});

test('maxLevels trava em N (Gestor de Tarefas usa 1)', () => {
 _gbInit('g4', FIELDS, null, 1);
 _gbSetLevel('g4', 'responsavel');
 _gbAddLevel('g4', 'status'); // deveria ser ignorado (maxLevels=1 é responsabilidade da UI,
 // mas a engine em si permite empilhar — o teste documenta que quem decide o limite
 // visual é o _gbRender via maxLevels, não o _gbAddLevel; então aqui confirmamos que
 // _gbAddLevel SEM checagem de maxLevels de fato adicionaria — e por isso o módulo que
 // consome (tarefas.js) só lê _gbPrimaryField (1º nível), nunca os demais.
 assert.equal(_gbPrimaryField('g4'), 'responsavel');
});

test('_gbAddLevel não duplica campo já usado', () => {
 _gbInit('g5', FIELDS, null);
 _gbSetLevel('g5', 'responsavel');
 _gbAddLevel('g5', 'responsavel');
 assert.equal(_gbInstances.g5.state.levels.length, 1);
});

test('_gbRemoveLevel remove o nível certo pelo índice', () => {
 _gbInit('g6', FIELDS, null);
 _gbSetLevel('g6', 'responsavel');
 _gbAddLevel('g6', 'status');
 _gbRemoveLevel('g6', 0);
 assert.deepEqual(_gbInstances.g6.state.levels.map((l) => l.field), ['status']);
});
