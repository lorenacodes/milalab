// node --test scripts/lib/sort-builder.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { _sbInstances, _sbInit, _sbCompare, _sbAddLevel, _sbRemoveLevel, _sbFieldChange, _sbDirChange, _sbClearAll } = require('./sort-builder.js');

const FIELDS = [
 { key: 'data_prazo', label: 'Prazo', type: 'date' },
 { key: 'titulo', label: 'Tarefa', type: 'text' },
 { key: 'prioridade', label: 'Prioridade', type: 'number', getValue: (a) => ({ Alta: 0, Média: 1, Baixa: 2 })[a.prioridade] ?? 3 },
];

test('ordenação crescente por data', () => {
 _sbInit('s1', FIELDS, null);
 _sbInstances.s1.state.levels = [{ field: 'data_prazo', dir: 'asc' }];
 const items = [{ id: 1, data_prazo: '2026-08-10' }, { id: 2, data_prazo: '2026-08-01' }, { id: 3, data_prazo: '2026-08-05' }];
 items.sort((a, b) => _sbCompare(a, b, 's1'));
 assert.deepEqual(items.map((i) => i.id), [2, 3, 1]);
});

test('ordenação decrescente por data', () => {
 _sbInit('s2', FIELDS, null);
 _sbInstances.s2.state.levels = [{ field: 'data_prazo', dir: 'desc' }];
 const items = [{ id: 1, data_prazo: '2026-08-10' }, { id: 2, data_prazo: '2026-08-01' }, { id: 3, data_prazo: '2026-08-05' }];
 items.sort((a, b) => _sbCompare(a, b, 's2'));
 assert.deepEqual(items.map((i) => i.id), [1, 3, 2]);
});

test('ordenação de texto A→Z respeitando pt-BR (localeCompare)', () => {
 _sbInit('s3', FIELDS, null);
 _sbInstances.s3.state.levels = [{ field: 'titulo', dir: 'asc' }];
 const items = [{ id: 1, titulo: 'Zebra' }, { id: 2, titulo: 'Ávila' }, { id: 3, titulo: 'Banana' }];
 items.sort((a, b) => _sbCompare(a, b, 's3'));
 assert.deepEqual(items.map((i) => i.id), [2, 3, 1]);
});

test('múltiplos níveis em cascata: 2º nível só desempata o 1º', () => {
 _sbInit('s4', FIELDS, null);
 _sbInstances.s4.state.levels = [
  { field: 'prioridade', dir: 'asc' }, // Alta(0) < Média(1) < Baixa(2)
  { field: 'titulo', dir: 'asc' },
 ];
 const items = [
  { id: 1, prioridade: 'Alta', titulo: 'Zebra' },
  { id: 2, prioridade: 'Alta', titulo: 'Abacaxi' },
  { id: 3, prioridade: 'Baixa', titulo: 'Manga' },
 ];
 items.sort((a, b) => _sbCompare(a, b, 's4'));
 // Ambos "Alta" empatam no 1º nível, resolvido pelo 2º (titulo A-Z): Abacaxi antes de Zebra.
 assert.deepEqual(items.map((i) => i.id), [2, 1, 3]);
});

test('sem níveis: comparador neutro (0), não reordena nada', () => {
 _sbInit('s5', FIELDS, null);
 assert.equal(_sbCompare({ titulo: 'B' }, { titulo: 'A' }, 's5'), 0);
});

// Regressão do pedido #4 ("praticamente não existe"): monta o cenário exato
// do exemplo do usuário (Prazo → Responsável → Prioridade) via API pública.
const FIELDS2 = [
 { key: 'data_prazo', label: 'Prazo', type: 'date' },
 { key: 'responsavel', label: 'Responsável', type: 'text' },
 { key: 'prioridade', label: 'Prioridade', type: 'number', getValue: (a) => ({ Alta: 0, Média: 1, Baixa: 2 })[a.prioridade] ?? 3 },
];

test('_sbAddLevel: permite múltiplas ordenações em cascata (Prazo → Responsável → Prioridade)', () => {
 _sbInit('s6', FIELDS2, null);
 _sbAddLevel('s6'); // nível 1: default = primeiro campo (data_prazo)
 _sbAddLevel('s6'); // nível 2: responsavel
 _sbAddLevel('s6'); // nível 3: prioridade
 assert.equal(_sbInstances.s6.state.levels.length, 3);
 _sbFieldChange('s6', 1, 'responsavel');
 _sbFieldChange('s6', 2, 'prioridade');
 _sbDirChange('s6', 0, 'asc');
 assert.deepEqual(_sbInstances.s6.state.levels.map((l) => l.field), ['data_prazo', 'responsavel', 'prioridade']);
});

test('_sbRemoveLevel: remove um nível sem afetar os demais', () => {
 _sbInit('s7', FIELDS2, null);
 _sbAddLevel('s7');
 _sbAddLevel('s7');
 _sbFieldChange('s7', 1, 'responsavel');
 _sbRemoveLevel('s7', 0);
 assert.deepEqual(_sbInstances.s7.state.levels.map((l) => l.field), ['responsavel']);
});

test('_sbClearAll: limpa toda a ordenação', () => {
 _sbInit('s8', FIELDS2, null);
 _sbAddLevel('s8');
 _sbAddLevel('s8');
 _sbClearAll('s8');
 assert.equal(_sbInstances.s8.state.levels.length, 0);
});

test('persistência: snapshot do state restaura a mesma ordenação em cascata', () => {
 _sbInit('s9', FIELDS2, null);
 _sbAddLevel('s9');
 _sbAddLevel('s9');
 _sbFieldChange('s9', 1, 'responsavel');
 const snapshot = JSON.parse(JSON.stringify(_sbInstances.s9.state));
 _sbInit('s9b', FIELDS2, null);
 _sbInstances.s9b.state = snapshot;
 const items = [
  { id: 1, data_prazo: '2026-08-01', responsavel: 'Maria' },
  { id: 2, data_prazo: '2026-08-01', responsavel: 'João' },
 ];
 items.sort((a, b) => _sbCompare(a, b, 's9b'));
 assert.deepEqual(items.map((i) => i.id), [2, 1]);
});
