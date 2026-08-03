// node --test scripts/lib/filtro-builder.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { _fbInstances, _fbInit, _fbEvaluate, _fbAddCondition, _fbRemoveCondition, _fbClearAll, _fbFieldChange, _fbValueChange } = require('./filtro-builder.js');

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

// Regressão do bug "não consigo adicionar mais de um filtro": exercita a API
// pública real (_fbAddCondition), não o state direto, pra travar o cenário
// que quebrava antes do fix do composedPath.
test('_fbAddCondition: permite adicionar quantas condições forem necessárias', () => {
 _fbInit('t8', FIELDS, null);
 _fbAddCondition('t8');
 _fbAddCondition('t8');
 _fbAddCondition('t8');
 assert.equal(_fbInstances.t8.state.conditions.length, 3);
});

test('_fbFieldChange: edita o campo de uma condição existente sem afetar as demais', () => {
 _fbInit('t9', FIELDS, null);
 _fbAddCondition('t9');
 _fbAddCondition('t9');
 const [c1, c2] = _fbInstances.t9.state.conditions;
 _fbFieldChange('t9', c1.id, 'prioridade');
 assert.equal(_fbInstances.t9.state.conditions[0].field, 'prioridade');
 assert.equal(_fbInstances.t9.state.conditions[1].id, c2.id);
 assert.equal(_fbInstances.t9.state.conditions.length, 2);
});

test('_fbValueChange: edita o valor de uma condição existente', () => {
 _fbInit('t10', FIELDS, null);
 _fbAddCondition('t10');
 const cond = _fbInstances.t10.state.conditions[0];
 _fbFieldChange('t10', cond.id, 'area');
 _fbValueChange('t10', cond.id, 'TI');
 assert.equal(_fbInstances.t10.state.conditions[0].value, 'TI');
});

test('_fbRemoveCondition: remove só a condição indicada, mantém as outras', () => {
 _fbInit('t11', FIELDS, null);
 _fbAddCondition('t11');
 _fbAddCondition('t11');
 _fbAddCondition('t11');
 const ids = _fbInstances.t11.state.conditions.map((c) => c.id);
 _fbRemoveCondition('t11', ids[1]);
 assert.deepEqual(_fbInstances.t11.state.conditions.map((c) => c.id), [ids[0], ids[2]]);
});

test('_fbClearAll: limpa todas as condições de uma vez', () => {
 _fbInit('t12', FIELDS, null);
 _fbAddCondition('t12');
 _fbAddCondition('t12');
 _fbClearAll('t12');
 assert.equal(_fbInstances.t12.state.conditions.length, 0);
 assert.equal(ITEMS.filter((i) => _fbEvaluate(i, 't12')).length, 3);
});

test('persistência: state sobrevive a múltiplas edições em sequência (simula reload)', () => {
 _fbInit('t13', FIELDS, null);
 _fbAddCondition('t13');
 const cond = _fbInstances.t13.state.conditions[0];
 _fbFieldChange('t13', cond.id, 'area');
 _fbValueChange('t13', cond.id, 'Comercial');
 const snapshot = JSON.parse(JSON.stringify(_fbInstances.t13.state));
 // simula restauração via localStorage (o que _gestorRestoreState faz de fato)
 _fbInit('t13b', FIELDS, null);
 _fbInstances.t13b.state = snapshot;
 assert.deepEqual(ITEMS.filter((i) => _fbEvaluate(i, 't13b')).map((i) => i.id), [2]);
});
