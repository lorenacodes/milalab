// node --test scripts/lib/fornecedor-validacao.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { _fornecedorValidar, _fornecedorValidarProduto, _fornecedorCalcularValorTotal, _fornecedorResumoProdutos } = require('./fornecedor-validacao.js');

function dadosValidos() {
 return {
  nome: 'Aço Premium Ltda',
  estado: 'SE',
  cidades: ['Aracaju'],
  setores: ['Materiais e Insumos'],
  experiencia: 'Positiva',
 };
}

test('_fornecedorValidar: dados completos passam', () => {
 var r = _fornecedorValidar(dadosValidos());
 assert.equal(r.valido, true);
 assert.deepEqual(r.erros, {});
});

test('_fornecedorValidar: nome vazio é obrigatório', () => {
 var d = dadosValidos(); d.nome = '   ';
 var r = _fornecedorValidar(d);
 assert.equal(r.valido, false);
 assert.match(r.erros.nome, /nome/i);
});

test('_fornecedorValidar: estado e cidades são obrigatórios', () => {
 var d = dadosValidos(); d.estado = ''; d.cidades = [];
 var r = _fornecedorValidar(d);
 assert.equal(r.valido, false);
 assert.ok(r.erros.estado);
 assert.ok(r.erros.cidades);
});

test('_fornecedorValidar: setores precisa de ao menos 1 item', () => {
 var d = dadosValidos(); d.setores = [];
 var r = _fornecedorValidar(d);
 assert.equal(r.valido, false);
 assert.ok(r.erros.setores);
});

test('_fornecedorValidar: experiência é obrigatória', () => {
 var d = dadosValidos(); d.experiencia = '';
 var r = _fornecedorValidar(d);
 assert.equal(r.valido, false);
 assert.ok(r.erros.experiencia);
});

test('_fornecedorValidarProduto: nome é obrigatório na linha', () => {
 var erros = _fornecedorValidarProduto({ nome: '', quantidade: 1, unidade_medida: 'kg', valor_unitario: 10 }, 0);
 assert.ok(erros['produtos.0.nome']);
 var ok = _fornecedorValidarProduto({ nome: 'X', quantidade: 1, unidade_medida: 'kg', valor_unitario: 10 }, 0);
 assert.equal(ok['produtos.0.nome'], undefined);
});

test('_fornecedorValidarProduto: quantidade deve ser > 0', () => {
 var erros = _fornecedorValidarProduto({ nome: 'X', quantidade: 0, unidade_medida: 'kg', valor_unitario: 10 }, 0);
 assert.ok(erros['produtos.0.quantidade']);
});

test('_fornecedorValidarProduto: valor_unitario negativo é inválido, mas zero é permitido (brinde/cortesia)', () => {
 var comZero = _fornecedorValidarProduto({ nome: 'X', quantidade: 1, unidade_medida: 'kg', valor_unitario: 0 }, 0);
 assert.equal(comZero['produtos.0.valor_unitario'], undefined);
 var comNegativo = _fornecedorValidarProduto({ nome: 'X', quantidade: 1, unidade_medida: 'kg', valor_unitario: -5 }, 0);
 assert.ok(comNegativo['produtos.0.valor_unitario']);
});

test('_fornecedorValidarProduto: aponta a linha certa quando há vários itens', () => {
 var e0 = _fornecedorValidarProduto({ nome: 'OK', quantidade: 1, unidade_medida: 'kg', valor_unitario: 5 }, 0);
 var e1 = _fornecedorValidarProduto({ nome: '', quantidade: 1, unidade_medida: 'kg', valor_unitario: 5 }, 1);
 assert.equal(e0['produtos.0.nome'], undefined);
 assert.ok(e1['produtos.1.nome']);
});

test('_fornecedorCalcularValorTotal: quantidade × valor unitário', () => {
 assert.equal(_fornecedorCalcularValorTotal(10, 25.5), 255);
 assert.equal(_fornecedorCalcularValorTotal(0, 100), 0);
 assert.equal(_fornecedorCalcularValorTotal('3', '2.5'), 7.5);
});

test('_fornecedorCalcularValorTotal: entrada inválida vira 0, não NaN', () => {
 assert.equal(_fornecedorCalcularValorTotal('', 10), 0);
 assert.equal(_fornecedorCalcularValorTotal(null, undefined), 0);
});

test('_fornecedorResumoProdutos: soma valor_total e conta itens', () => {
 var r = _fornecedorResumoProdutos([
  { nome: 'A', valor_total: 820 },
  { nome: 'B', valor_total: 460.5 },
 ]);
 assert.equal(r.quantidade, 2);
 assert.equal(r.totalGasto, 1280.5);
});

test('_fornecedorResumoProdutos: lista vazia/nula não quebra', () => {
 assert.deepEqual(_fornecedorResumoProdutos([]), { quantidade: 0, totalGasto: 0 });
 assert.deepEqual(_fornecedorResumoProdutos(null), { quantidade: 0, totalGasto: 0 });
});

test('_fornecedorResumoProdutos: escala com centenas de itens sem perder precisão de forma grosseira', () => {
 var muitos = Array.from({ length: 500 }, function() { return { valor_total: 10 }; });
 var r = _fornecedorResumoProdutos(muitos);
 assert.equal(r.quantidade, 500);
 assert.equal(r.totalGasto, 5000);
});

test('_fornecedorResumoProdutos: ignora valor_total inválido/ausente em vez de virar NaN', () => {
 var r = _fornecedorResumoProdutos([{ nome: 'sem valor' }, { nome: 'ok', valor_total: 100 }]);
 assert.equal(r.totalGasto, 100);
});
