// node --test scripts/lib/filtro-builder.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { _fbInstances, _fbInit, _fbEvaluate } = require('./filtro-builder.js');

const ITEMS = [
 { id: 1, area: 'TI', prioridade: 'Alta', melhoria: '' },
 { id: 2, area: 'Comercial', prioridade: 'Média', melhoria: '' },
 { id: 3, area: 'TI', prioridade: 'Baixa', melhoria: 'Melhoria Z' },
];
const FIELDS = [
 { key: 'area', label: 'Área', type: 'select', options: ['TI', 'Comercial'] },
 { key: 'prioridade', label: 'Prioridade', type: 'select', options: ['Alta', 'Média', 'Baixa'] },
 { key: 'melhoria', label: 'Melhoria', type: 'select', options: [] },
];

test('sem condições: tudo passa', () => {
 _fbInit('t1', FIELDS, null);
 assert.equal(ITEMS.filter((i) => _fbEvaluate(i, 't1')).length, 3);
});

test('uma condição eq: filtra corretamente', () => {
 _fbInit('t2', FIELDS, null);
 _fbInstances.t2.state.conditions = [{ id: 'c1', field: 'area', operator: 'eq', value: 'TI' }];
 const r = ITEMS.filter((i) => _fbEvaluate(i, 't2')).map((i) => i.id);
 assert.deepEqual(r, [1, 3]);
});

test('duas condições com AND: interseção', () => {
 _fbInit('t3', FIELDS, null);
 _fbInstances.t3.state.logic = 'AND';
 _fbInstances.t3.state.conditions = [
  { id: 'c1', field: 'area', operator: 'eq', value: 'Comercial' },
  { id: 'c2', field: 'prioridade', operator: 'eq', value: 'Alta' },
 ];
 assert.deepEqual(ITEMS.filter((i) => _fbEvaluate(i, 't3')).map((i) => i.id), []);
});

test('duas condições com OR: união', () => {
 _fbInit('t4', FIELDS, null);
 _fbInstances.t4.state.logic = 'OR';
 _fbInstances.t4.state.conditions = [
  { id: 'c1', field: 'area', operator: 'eq', value: 'Comercial' },
  { id: 'c2', field: 'prioridade', operator: 'eq', value: 'Alta' },
 ];
 assert.deepEqual(ITEMS.filter((i) => _fbEvaluate(i, 't4')).map((i) => i.id), [1, 2]);
});

test('está vazio / não está vazio', () => {
 _fbInit('t5', FIELDS, null);
 _fbInstances.t5.state.conditions = [{ id: 'c1', field: 'melhoria', operator: 'empty', value: '' }];
 assert.deepEqual(ITEMS.filter((i) => _fbEvaluate(i, 't5')).map((i) => i.id), [1, 2]);
 _fbInstances.t5.state.conditions = [{ id: 'c1', field: 'melhoria', operator: 'nempty', value: '' }];
 assert.deepEqual(ITEMS.filter((i) => _fbEvaluate(i, 't5')).map((i) => i.id), [3]);
});

test('é qualquer um de (anyof)', () => {
 _fbInit('t6', FIELDS, null);
 _fbInstances.t6.state.conditions = [{ id: 'c1', field: 'prioridade', operator: 'anyof', value: ['Alta', 'Baixa'] }];
 assert.deepEqual(ITEMS.filter((i) => _fbEvaluate(i, 't6')).map((i) => i.id), [1, 3]);
});

test('remover condição (array vazio) volta a passar tudo', () => {
 _fbInit('t7', FIELDS, null);
 _fbInstances.t7.state.conditions = [{ id: 'c1', field: 'area', operator: 'eq', value: 'TI' }];
 assert.equal(ITEMS.filter((i) => _fbEvaluate(i, 't7')).length, 2);
 _fbInstances.t7.state.conditions = [];
 assert.equal(ITEMS.filter((i) => _fbEvaluate(i, 't7')).length, 3);
});
