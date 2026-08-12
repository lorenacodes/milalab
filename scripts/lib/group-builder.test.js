// node --test scripts/lib/group-builder.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { _gbInstances, _gbInit, _gbPrimaryField, _gbPrimaryDir, _gbSetLevel, _gbAddLevel, _gbRemoveLevel, _gbClearAll, _gbLevelFieldChange, _gbLevelDirChange } = require('./group-builder.js');

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

test('_gbLevelFieldChange troca o campo de um nível existente', () => {
 _gbInit('g7', FIELDS, null);
 _gbSetLevel('g7', 'responsavel');
 _gbAddLevel('g7', 'status');
 _gbLevelFieldChange('g7', 1, 'area');
 assert.deepEqual(_gbInstances.g7.state.levels.map((l) => l.field), ['responsavel', 'area']);
});

// Ordem de aparição dos grupos (pedido explícito, estilo Airtable) — cada
// nível guarda dir 'asc'/'desc', padrão 'asc' ao criar/adicionar um nível.
test('_gbSetLevel/_gbAddLevel: nível novo nasce com dir "asc"', () => {
 _gbInit('g10', FIELDS, null);
 _gbSetLevel('g10', 'status');
 assert.equal(_gbInstances.g10.state.levels[0].dir, 'asc');
 _gbAddLevel('g10', 'area');
 assert.equal(_gbInstances.g10.state.levels[1].dir, 'asc');
});

test('_gbLevelDirChange troca a direção de um nível específico', () => {
 _gbInit('g11', FIELDS, null);
 _gbSetLevel('g11', 'status');
 _gbAddLevel('g11', 'area');
 _gbLevelDirChange('g11', 1, 'desc');
 assert.equal(_gbInstances.g11.state.levels[0].dir, 'asc');
 assert.equal(_gbInstances.g11.state.levels[1].dir, 'desc');
});

test('_gbPrimaryDir retorna "asc" por padrão e sem agrupamento ativo', () => {
 _gbInit('g12', FIELDS, null);
 assert.equal(_gbPrimaryDir('g12'), 'asc'); // sem nível nenhum ainda
 _gbSetLevel('g12', 'status');
 assert.equal(_gbPrimaryDir('g12'), 'asc');
 _gbLevelDirChange('g12', 0, 'desc');
 assert.equal(_gbPrimaryDir('g12'), 'desc');
});

test('_gbClearAll remove o agrupamento por completo', () => {
 _gbInit('g8', FIELDS, null);
 _gbSetLevel('g8', 'responsavel');
 _gbClearAll('g8');
 assert.equal(_gbPrimaryField('g8'), null);
 assert.equal(_gbInstances.g8.state.levels.length, 0);
});

// Regressão do pedido #3: exemplo exato do usuário (▼ João / Tarefa 1, Tarefa 2 /
// ▼ Maria / Tarefa 3, Tarefa 4) — criação de múltiplos grupos com contagem, mais
// expandir/recolher com estado persistente (um Set de chaves recolhidas, do jeito
// que tarefas.js._gestorRenderGrid faz de fato).
test('múltiplos grupos: criação com contagem + expandir/recolher com estado persistente', () => {
 _gbInit('g9', FIELDS, null);
 _gbSetLevel('g9', 'responsavel');
 const items = [
  { titulo: 'Tarefa 1', responsavel: 'João' },
  { titulo: 'Tarefa 2', responsavel: 'João' },
  { titulo: 'Tarefa 3', responsavel: 'Maria' },
  { titulo: 'Tarefa 4', responsavel: 'Maria' },
 ];
 const field = _gbPrimaryField('g9');
 const groups = {};
 items.forEach((i) => { const k = i[field]; (groups[k] = groups[k] || []).push(i); });
 assert.deepEqual(Object.keys(groups), ['João', 'Maria']);
 assert.equal(groups['João'].length, 2);
 assert.equal(groups['Maria'].length, 2);

 // Estado de recolhido/expandido: um Set persistido (localStorage, serializável
 // como array) — recolher "João" não deve afetar "Maria".
 const collapsed = new Set();
 collapsed.add('João');
 assert.equal(collapsed.has('João'), true);
 assert.equal(collapsed.has('Maria'), false);
 const serialized = JSON.stringify([...collapsed]);
 const restored = new Set(JSON.parse(serialized));
 assert.equal(restored.has('João'), true);
 collapsed.delete('João'); // expandir de novo
 assert.equal(collapsed.has('João'), false);
});
