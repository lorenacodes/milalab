// node --test scripts/lib/filtro-builder.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
// _fbSearchableDropdown chama _ssNormalize (smart-search.js) — em produção os
// dois carregam como scripts globais no navegador; aqui, como cada um é seu
// próprio módulo Node, expõe as funções no objeto global antes de importar
// filtro-builder.js pra reproduzir esse mesmo ambiente de execução.
const smartSearch = require('./smart-search.js');
global._ssNormalize = smartSearch._ssNormalize;
global._ssMatch = smartSearch._ssMatch;
const { _fbInstances, _fbInit, _fbEvaluate, _fbConditionIsUsable, _fbAddCondition, _fbRemoveCondition, _fbClearAll, _fbFieldChange, _fbOperatorChange, _fbValueChange, _fbValueChangeRange, _fbSearchableDropdown, _FB_SEARCH_THRESHOLD, _fbDefaultValueFor } = require('./filtro-builder.js');

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

// ── Dropdown com busca (relacionamentos com muitos registros — Obra,
// Projeto, Melhoria, Responsável, Empresa...) ────────────────────────────
const MANY_OBRAS = Array.from({ length: 12 }, (_, i) => `Obra Teste ${i}`);
const FEW_OPTS = ['Alta', 'Média', 'Baixa'];

test('_fbSearchableDropdown: mostra campo de busca quando a lista é grande', () => {
 _fbInit('d1', [{ key: 'obra', label: 'Obra', type: 'select', options: MANY_OBRAS }], null);
 _fbAddCondition('d1');
 const c = _fbInstances.d1.state.conditions[0];
 _fbFieldChange('d1', c.id, 'obra');
 const html = _fbSearchableDropdown('d1', _fbInstances.d1.state.conditions[0], { options: MANY_OBRAS }, false);
 assert.ok(MANY_OBRAS.length > _FB_SEARCH_THRESHOLD);
 assert.match(html, /fb-msel-search/);
});

test('_fbSearchableDropdown: não mostra busca em listas curtas (sem ruído desnecessário)', () => {
 _fbInit('d2', [{ key: 'prioridade', label: 'Prioridade', type: 'select', options: FEW_OPTS }], null);
 _fbAddCondition('d2');
 const c = _fbInstances.d2.state.conditions[0];
 _fbFieldChange('d2', c.id, 'prioridade');
 const html = _fbSearchableDropdown('d2', _fbInstances.d2.state.conditions[0], { options: FEW_OPTS }, false);
 assert.ok(FEW_OPTS.length <= _FB_SEARCH_THRESHOLD);
 assert.doesNotMatch(html, /fb-msel-search/);
});

test('_fbSearchableDropdown: cada opção carrega data-norm (acento/caixa já resolvidos) pra busca instantânea', () => {
 const html = _fbSearchableDropdown('d1', { id: 'c1', value: '' }, { options: ['Pré-Projeto Casacor', 'Obra Teste 3'] }, false);
 // "pre projeto casacor" é o normalizado de "Pré-Projeto Casacor" (_ssNormalize)
 assert.match(html, /data-norm="pre projeto casacor"/);
 assert.match(html, /data-norm="obra teste 3"/);
});

test('_fbSearchableDropdown: seleção múltipla (anyof/noneof) marca os itens já selecionados', () => {
 const html = _fbSearchableDropdown('d1', { id: 'c1', value: ['Obra Teste 2'] }, { options: MANY_OBRAS }, true);
 assert.match(html, /value="Obra Teste 2" checked/);
 assert.doesNotMatch(html, /value="Obra Teste 3" checked/);
});

test('_fbSearchableDropdown: seleção única (eq/is) destaca a opção ativa', () => {
 const html = _fbSearchableDropdown('d1', { id: 'c1', value: 'Obra Teste 5' }, { options: MANY_OBRAS }, false);
 assert.match(html, /fb-msel-item fb-msel-item-active" data-norm="obra teste 5"/);
});

// ── Operador 'between' (intervalo de datas) — usado por Gestor de Tarefas
// pra consolidar Início/Prazo como condições do filtro em vez de controles
// à parte na toolbar (ver tarefas.js: campos data_inicio/data_prazo). ──
const DATE_FIELDS = [{ key: 'data_prazo', label: 'Prazo', type: 'date' }];
const DATE_ITEMS = [
 { id: 1, data_prazo: '2026-01-05' },
 { id: 2, data_prazo: '2026-01-15' },
 { id: 3, data_prazo: '2026-02-01' },
 { id: 4, data_prazo: null },
];

test("_fbConditionIsUsable: 'between' só é usável com as duas pontas preenchidas", () => {
 assert.equal(_fbConditionIsUsable({ operator: 'between', value: ['', ''] }), false);
 assert.equal(_fbConditionIsUsable({ operator: 'between', value: ['2026-01-01', ''] }), false);
 assert.equal(_fbConditionIsUsable({ operator: 'between', value: ['2026-01-01', '2026-01-31'] }), true);
});

test("'between': filtra datas dentro do intervalo (inclusive nas duas pontas)", () => {
 _fbInit('dt1', DATE_FIELDS, null);
 _fbInstances.dt1.state.conditions = [{ id: 'c1', field: 'data_prazo', operator: 'between', value: ['2026-01-01', '2026-01-15'] }];
 assert.deepEqual(DATE_ITEMS.filter((i) => _fbEvaluate(i, 'dt1')).map((i) => i.id), [1, 2]);
});

test("'between': data nula nunca entra no intervalo", () => {
 _fbInit('dt2', DATE_FIELDS, null);
 _fbInstances.dt2.state.conditions = [{ id: 'c1', field: 'data_prazo', operator: 'between', value: ['2020-01-01', '2030-01-01'] }];
 assert.deepEqual(DATE_ITEMS.filter((i) => _fbEvaluate(i, 'dt2')).map((i) => i.id), [1, 2, 3]);
});

test("_fbOperatorChange: trocar pra 'between' inicializa value como par vazio", () => {
 _fbInit('dt3', DATE_FIELDS, null);
 _fbInstances.dt3.state.conditions = [{ id: 'c1', field: 'data_prazo', operator: 'eq', value: '2026-01-05' }];
 _fbOperatorChange('dt3', 'c1', 'between');
 assert.deepEqual(_fbInstances.dt3.state.conditions[0].value, ['', '']);
});

// ── Tipo 'number' — usado pela aba Projetos (Quantidade, Valor da unidade,
// M² Estrutura, Peso...) pra comparação numérica de verdade em vez de
// tratar o valor como texto ('contém'/'é'). ──
const NUMBER_FIELDS = [{ key: 'qtd', label: 'Quantidade', type: 'number' }];
const NUMBER_ITEMS = [
 { id: 1, qtd: 3 },
 { id: 2, qtd: 10 },
 { id: 3, qtd: 25 },
 { id: 4, qtd: null },
];

test("number 'gt'/'lt': compara numericamente, não como string", () => {
 _fbInit('n1', NUMBER_FIELDS, null);
 _fbInstances.n1.state.conditions = [{ id: 'c1', field: 'qtd', operator: 'gt', value: '9' }];
 assert.deepEqual(NUMBER_ITEMS.filter((i) => _fbEvaluate(i, 'n1')).map((i) => i.id), [2, 3]);
});

test("number 'between': filtra dentro do intervalo (inclusive nas duas pontas)", () => {
 _fbInit('n2', NUMBER_FIELDS, null);
 _fbInstances.n2.state.conditions = [{ id: 'c1', field: 'qtd', operator: 'between', value: [3, 10] }];
 assert.deepEqual(NUMBER_ITEMS.filter((i) => _fbEvaluate(i, 'n2')).map((i) => i.id), [1, 2]);
});

test("number 'empty'/'nempty': null nunca entra em nenhuma comparação numérica", () => {
 _fbInit('n3', NUMBER_FIELDS, null);
 _fbInstances.n3.state.conditions = [{ id: 'c1', field: 'qtd', operator: 'empty' }];
 assert.deepEqual(NUMBER_ITEMS.filter((i) => _fbEvaluate(i, 'n3')).map((i) => i.id), [4]);
 _fbInstances.n3.state.conditions = [{ id: 'c1', field: 'qtd', operator: 'gte', value: '0' }];
 assert.deepEqual(NUMBER_ITEMS.filter((i) => _fbEvaluate(i, 'n3')).map((i) => i.id), [1, 2, 3]);
});

// ── defaultValue — campos "binários" (ex.: "Atrasada" do Gestor de Tarefas)
// onde só escolher o campo já expressa a intenção, sem precisar abrir o
// dropdown de valor de novo pra confirmar algo óbvio. ──
const BOOL_FIELDS = [
 { key: 'atrasada', label: 'Atrasada', type: 'select', options: ['Sim', 'Não'], defaultValue: 'Sim' },
 { key: 'area', label: 'Área', type: 'select', options: ['TI', 'Comercial'] },
];

test("_fbDefaultValueFor: campo com defaultValue usa o valor declarado", () => {
 assert.equal(_fbDefaultValueFor(BOOL_FIELDS[0]), 'Sim');
});

test("_fbDefaultValueFor: campo sem defaultValue mantém o comportamento antigo (select/multitext = [], resto = '')", () => {
 assert.deepEqual(_fbDefaultValueFor({ type: 'select' }), []);
 assert.deepEqual(_fbDefaultValueFor({ type: 'multitext' }), []);
 assert.equal(_fbDefaultValueFor({ type: 'text' }), '');
});

test("_fbFieldChange: trocar para um campo com defaultValue já preenche o valor (sem passo extra)", () => {
 _fbInit('bool1', BOOL_FIELDS, null);
 _fbAddCondition('bool1');
 const c = _fbInstances.bool1.state.conditions[0];
 _fbFieldChange('bool1', c.id, 'atrasada');
 assert.equal(_fbInstances.bool1.state.conditions[0].value, 'Sim');
 assert.equal(_fbConditionIsUsable(_fbInstances.bool1.state.conditions[0]), true);
});

test("_fbFieldChange: trocar para um campo sem defaultValue continua vazio (usuário escolhe)", () => {
 _fbInit('bool2', BOOL_FIELDS, null);
 _fbAddCondition('bool2');
 const c = _fbInstances.bool2.state.conditions[0];
 _fbFieldChange('bool2', c.id, 'area');
 assert.deepEqual(_fbInstances.bool2.state.conditions[0].value, []);
});

test("_fbValueChangeRange: seta cada ponta do intervalo independentemente", () => {
 _fbInit('dt4', DATE_FIELDS, null);
 _fbInstances.dt4.state.conditions = [{ id: 'c1', field: 'data_prazo', operator: 'between', value: ['', ''] }];
 _fbValueChangeRange('dt4', 'c1', 0, '2026-01-01');
 _fbValueChangeRange('dt4', 'c1', 1, '2026-01-31');
 assert.deepEqual(_fbInstances.dt4.state.conditions[0].value, ['2026-01-01', '2026-01-31']);
});
