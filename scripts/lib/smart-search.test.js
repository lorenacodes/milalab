// node --test scripts/lib/smart-search.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { _ssNormalize, _ssMatch, _ssHaystack } = require('./smart-search.js');

test('_ssNormalize ignora acento, caixa e espaço/hífen duplicado', () => {
 const forms = ['Pré-Projeto', 'pre projeto', 'PREPROJETO', 'pré  projeto', 'Pré Projeto'];
 const normalized = forms.map(_ssNormalize);
 // "PREPROJETO" (sem espaço/hífen) normaliza para uma forma sem espaço também —
 // as variantes COM separador (espaço/hífen) devem todas bater entre si.
 assert.equal(normalized[0], normalized[1]);
 assert.equal(normalized[1], normalized[3]);
 assert.equal(normalized[3], normalized[4]);
});

test('_ssMatch: substring simples (case/acento já normalizados por quem chama)', () => {
 assert.equal(_ssMatch(_ssNormalize('Revisar contrato Casacor'), _ssNormalize('contrat')), true);
 assert.equal(_ssMatch(_ssNormalize('Revisar contrato Casacor'), _ssNormalize('CASACOR')), true);
 assert.equal(_ssMatch(_ssNormalize('Revisar contrato Casacor'), _ssNormalize('xyz')), false);
});

test('_ssMatch: busca vazia sempre bate (sem filtro de texto)', () => {
 assert.equal(_ssMatch(_ssNormalize('qualquer coisa'), ''), true);
});

test('_ssMatch: fuzzy leve corrige 1 letra errada em palavra de 4+ chars', () => {
 // "projeto" com 1 letra trocada ("projrto") ainda deve bater.
 assert.equal(_ssMatch(_ssNormalize('Ajustar layout do projeto'), _ssNormalize('projrto')), true);
});

test('_ssMatch: fuzzy NÃO entra em ação pra queries curtas (evita falso-positivo)', () => {
 // "ti" (2 chars) não deveria "quase bater" com "TO" ou qualquer coisa parecida.
 assert.equal(_ssMatch(_ssNormalize('Área TO'), _ssNormalize('ti')), false);
});

test('_ssMatch: fuzzy NÃO entra em ação pra queries com mais de 1 palavra (evita falso-positivo em listas grandes)', () => {
 // Bug real: "teste 3" tinha distância de edição 2 até "teste" (apagar " 3"),
 // dentro do maxDist de queries de 7 caracteres — "Obra Teste 5" "quase
 // batia" com a busca "teste 3" na lista de Obras do filtro. Fuzzy é só
 // pra corrigir 1 palavra digitada errada; frases usam só o indexOf normal.
 assert.equal(_ssMatch(_ssNormalize('Obra Teste 5'), _ssNormalize('teste 3')), false);
 assert.equal(_ssMatch(_ssNormalize('Obra Teste 3'), _ssNormalize('teste 3')), true);
});

test('_ssHaystack junta vários campos, ignora falsy, normaliza tudo junto', () => {
 const h = _ssHaystack(['Projeto Casacor', null, 'Ana', undefined, 'Instalação Elétrica']);
 assert.equal(_ssMatch(h, _ssNormalize('casacor')), true);
 assert.equal(_ssMatch(h, _ssNormalize('eletrica')), true); // sem acento na query
 assert.equal(_ssMatch(h, _ssNormalize('elétrica')), true); // com acento na query
});
