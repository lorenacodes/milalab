// node --test scripts/lib/group-tree.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { _gtDateBucket, _gtBuildTree, _gtTreeCount } = require('./group-tree.js');

// Data-base fixa (não usar "hoje" de verdade — o teste tem que dar o mesmo
// resultado em qualquer dia em que rodar).
const HOJE = new Date('2026-08-15T00:00:00');
function fmt(d) { return d.toISOString().slice(0,10); }
function addDays(n) { const d = new Date(HOJE); d.setDate(d.getDate()+n); return fmt(d); }

test('_gtDateBucket: Hoje/Amanhã/Ontem', () => {
 assert.equal(_gtDateBucket(addDays(0), HOJE).key, 'Hoje');
 assert.equal(_gtDateBucket(addDays(1), HOJE).key, 'Amanhã');
 assert.equal(_gtDateBucket(addDays(-1), HOJE).key, 'Ontem');
});

test('_gtDateBucket: Esta semana / Próxima semana', () => {
 // 2026-08-15 é um sábado — resto da semana atual (seg-dom) é só domingo (+1).
 assert.equal(_gtDateBucket(addDays(1), HOJE).key, 'Amanhã'); // domingo é amanhã aqui
 assert.equal(_gtDateBucket(addDays(5), HOJE).key, 'Próxima semana');
});

test('_gtDateBucket: Este mês / Próximo mês', () => {
 assert.equal(_gtDateBucket(addDays(10), HOJE).key, 'Este mês');
 assert.equal(_gtDateBucket('2026-09-20', HOJE).key, 'Próximo mês');
});

test('_gtDateBucket: meses distantes viram "Mês de Ano", ordenados cronologicamente', () => {
 const b1 = _gtDateBucket('2026-11-05', HOJE); // outubro seria "próximo mês" só se +1; aqui +3
 const b2 = _gtDateBucket('2027-01-10', HOJE);
 assert.equal(b1.key, 'Novembro de 2026');
 assert.equal(b2.key, 'Janeiro de 2027');
 assert.ok(b1.sortKey < b2.sortKey); // novembro vem antes de janeiro do ano seguinte
});

test('_gtDateBucket: passado distante também vira "Mês de Ano", sortKey negativo (antes do presente)', () => {
 const passado = _gtDateBucket('2026-05-01', HOJE);
 const hoje = _gtDateBucket(addDays(0), HOJE);
 assert.equal(passado.key, 'Maio de 2026');
 assert.ok(passado.sortKey < hoje.sortKey);
});

test('_gtDateBucket: sem data agrupa à parte e sempre por último', () => {
 const semData = _gtDateBucket(null, HOJE);
 const qualquerOutro = _gtDateBucket(addDays(200), HOJE);
 assert.equal(semData.key, '— Sem data');
 assert.ok(semData.sortKey > qualquerOutro.sortKey);
});

// ── _gtBuildTree — agrupamento simples (1 nível) ──────────────────────────
function keyForSimples(item, field) {
 return { key: item[field] || '— Sem valor', sortKey: null };
}

test('_gtBuildTree: agrupamento simples (1 nível), sem sortKey/fixedOrders cai pra ordem alfabética (pt-BR)', () => {
 const items = [
  { id: 1, area: 'TI' }, { id: 2, area: 'TI' }, { id: 3, area: 'RH' },
 ];
 const tree = _gtBuildTree(items, [{ field: 'area' }], keyForSimples, null, 0);
 assert.equal(tree.leaf, false);
 assert.deepEqual(tree.order, ['RH', 'TI']); // alfabética, não mais "primeira aparição"
 assert.equal(tree.children['TI'].items.length, 2);
 assert.equal(tree.children['RH'].items.length, 1);
 assert.equal(tree.children['TI'].leaf, true);
});

test('_gtBuildTree: dir "desc" inverte a ordem dos grupos (funciona com alfabética, sortKey e fixedOrders)', () => {
 const items = [
  { id: 1, area: 'TI' }, { id: 2, area: 'TI' }, { id: 3, area: 'RH' },
 ];
 const treeAsc  = _gtBuildTree(items, [{ field: 'area', dir: 'asc' }], keyForSimples, null, 0);
 const treeDesc = _gtBuildTree(items, [{ field: 'area', dir: 'desc' }], keyForSimples, null, 0);
 assert.deepEqual(treeAsc.order, ['RH', 'TI']);
 assert.deepEqual(treeDesc.order, ['TI', 'RH']);
});

test('_gtBuildTree: agrupamentos múltiplos (2 níveis) com expansão/recolhimento independente', () => {
 const items = [
  { id: 1, resp: 'João', mes: 'Agosto' },
  { id: 2, resp: 'João', mes: 'Setembro' },
  { id: 3, resp: 'Maria', mes: 'Agosto' },
 ];
 const tree = _gtBuildTree(items, [{ field: 'resp' }, { field: 'mes' }], keyForSimples, null, 0);
 assert.deepEqual(tree.order, ['João', 'Maria']);
 const joao = tree.children['João'];
 assert.equal(joao.leaf, false);
 assert.deepEqual(joao.order, ['Agosto', 'Setembro']);
 assert.equal(joao.children['Agosto'].items[0].id, 1);
 assert.equal(joao.children['Setembro'].items[0].id, 2);
 const maria = tree.children['Maria'];
 assert.deepEqual(maria.order, ['Agosto']);
 // "Agosto" dentro de João e "Agosto" dentro de Maria são nós DIFERENTES na
 // árvore (não compartilham identidade) — é isso que permite expandir um
 // sem afetar o outro na renderização (a chave de expandir/recolher usa o
 // caminho completo, ex. "João :: Agosto" vs "Maria :: Agosto").
 assert.notEqual(joao.children['Agosto'], maria.children['Agosto']);
});

test('_gtBuildTree: agrupamento por data usa sortKey em vez da ordem de aparição', () => {
 const items = [
  { id: 1, prazo: addDays(30) },  // mês distante
  { id: 2, prazo: addDays(0) },   // Hoje
  { id: 3, prazo: addDays(1) },   // Amanhã
 ];
 function keyForData(item, field) { return _gtDateBucket(item[field], HOJE); }
 const tree = _gtBuildTree(items, [{ field: 'prazo' }], keyForData, null, 0);
 // Mesmo os dados chegando "mês distante, Hoje, Amanhã" na entrada, a ordem
 // de exibição deve ser cronológica: Hoje, Amanhã, ... mês distante.
 assert.equal(tree.order[0], 'Hoje');
 assert.equal(tree.order[1], 'Amanhã');
 assert.equal(tree.order[tree.order.length - 1], _gtDateBucket(addDays(30), HOJE).key);
});

test('_gtBuildTree: ordem fixa (fixedOrders) quando o campo não tem sortKey', () => {
 const items = [
  { id: 1, tipo: 'Coletiva' }, { id: 2, tipo: 'Individual' }, { id: 3, tipo: 'Individual' },
 ];
 const tree = _gtBuildTree(items, [{ field: 'tipo' }], keyForSimples, { tipo: ['Individual', 'Coletiva'] }, 0);
 assert.deepEqual(tree.order, ['Individual', 'Coletiva']);
});

test('_gtBuildTree: sem níveis retorna nó-folha com todos os itens', () => {
 const items = [{ id: 1 }, { id: 2 }];
 const tree = _gtBuildTree(items, [], keyForSimples, null, 0);
 assert.equal(tree.leaf, true);
 assert.equal(tree.items.length, 2);
});

// ── _gtTreeCount — contagens recursivas (badges dos cabeçalhos de grupo) ──
test('_gtTreeCount: soma recursiva através de múltiplos níveis', () => {
 const items = [
  { id: 1, resp: 'João', mes: 'Agosto', done: true },
  { id: 2, resp: 'João', mes: 'Setembro', done: false },
  { id: 3, resp: 'Maria', mes: 'Agosto', done: true },
 ];
 const tree = _gtBuildTree(items, [{ field: 'resp' }, { field: 'mes' }], keyForSimples, null, 0);
 assert.equal(_gtTreeCount(tree), 3); // total geral
 assert.equal(_gtTreeCount(tree.children['João']), 2); // total do João (soma dos 2 meses)
 assert.equal(_gtTreeCount(tree, (i) => i.done), 2); // predicado: só concluídas
 assert.equal(_gtTreeCount(tree.children['João'], (i) => i.done), 1);
});
