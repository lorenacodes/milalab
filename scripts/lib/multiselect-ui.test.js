// node --test scripts/lib/multiselect-ui.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
// _msRenderDropdown/_msFiltrar usam _ssNormalize/_ssMatch (smart-search.js)
// se estiverem disponíveis globalmente — mesmo padrão de filtro-builder.test.js.
const smartSearch = require('./smart-search.js');
global._ssNormalize = smartSearch._ssNormalize;
global._ssMatch = smartSearch._ssMatch;
const { _msRenderDropdown, _msFiltrar, _msToggle } = require('./multiselect-ui.js');

test('_msToggle: adiciona quando ausente, remove quando presente', () => {
 assert.deepEqual(_msToggle([], 'Aracaju'), ['Aracaju']);
 assert.deepEqual(_msToggle(['Aracaju'], 'Aracaju'), []);
 assert.deepEqual(_msToggle(['Aracaju'], 'Lagarto'), ['Aracaju', 'Lagarto']);
});

test('_msToggle: respeita o segundo parâmetro "incluir" quando fornecido (vem do checkbox.checked)', () => {
 assert.deepEqual(_msToggle(['Aracaju'], 'Aracaju', false), []);
 assert.deepEqual(_msToggle(['Aracaju'], 'Aracaju', true), ['Aracaju']); // já tinha, mantém
 assert.deepEqual(_msToggle([], 'Lagarto', true), ['Lagarto']);
});

test('_msToggle: não muta o array original', () => {
 var original = ['Aracaju'];
 var novo = _msToggle(original, 'Lagarto');
 assert.deepEqual(original, ['Aracaju']);
 assert.deepEqual(novo, ['Aracaju', 'Lagarto']);
});

test('_msFiltrar: ignora acento e caixa', () => {
 var opcoes = ['Aracaju', 'Nossa Senhora do Socorro', 'Itabaiana', 'Lagarto'];
 assert.deepEqual(_msFiltrar(opcoes, 'aracaju'), ['Aracaju']);
 assert.deepEqual(_msFiltrar(opcoes, 'SOCORRO'), ['Nossa Senhora do Socorro']);
});

test('_msFiltrar: string vazia devolve tudo', () => {
 var opcoes = ['A', 'B', 'C'];
 assert.deepEqual(_msFiltrar(opcoes, ''), opcoes);
 assert.deepEqual(_msFiltrar(opcoes, null), opcoes);
});

test('_msRenderDropdown: marca "checked" só os selecionados', () => {
 var html = _msRenderDropdown('cidades', ['Aracaju', 'Lagarto'], ['Lagarto'], '_fornMultiToggle');
 assert.match(html, /value="Lagarto" checked/);
 assert.doesNotMatch(html, /value="Aracaju" checked/);
});

test('_msRenderDropdown: rótulo do botão mostra contagem quando há seleção', () => {
 var html = _msRenderDropdown('setores', ['A', 'B', 'C'], ['A', 'B'], '_fornMultiToggle', 'Selecionar...');
 assert.match(html, />2 selecionado\(s\)</);
});

test('_msRenderDropdown: sem seleção mostra o placeholder', () => {
 var html = _msRenderDropdown('setores', ['A', 'B'], [], '_fornMultiToggle', 'Selecione o setor');
 assert.match(html, />Selecione o setor</);
});

test('_msRenderDropdown: chama a função de toggle certa com o campo certo', () => {
 var html = _msRenderDropdown('segmentos', ['Aço'], [], '_fornMultiToggle');
 assert.match(html, /_fornMultiToggle\('segmentos',this\.value,this\.checked\)/);
});

test('_msRenderDropdown: busca aparece sempre que há ao menos 1 opção (sem limiar de quantidade)', () => {
 // Pedido explícito (Nova Obra: Produto/Responsável) — a busca sumia com
 // poucas opções (ex.: só 5 produtos "Solar"), escondida atrás de um
 // limiar; agora aparece com qualquer quantidade >= 1.
 var poucas = _msRenderDropdown('x', ['A', 'B'], [], '_fornMultiToggle');
 assert.match(poucas, /fb-msel-search/);
 var muitas = _msRenderDropdown('x', Array.from({ length: 10 }, (_, i) => 'Opcao ' + i), [], '_fornMultiToggle');
 assert.match(muitas, /fb-msel-search/);
 var nenhuma = _msRenderDropdown('x', [], [], '_fornMultiToggle');
 assert.doesNotMatch(nenhuma, /fb-msel-search/);
});
