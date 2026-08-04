// node --test scripts/lib/moeda.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { _moedaFormatar, _moedaFormatarBRL, _moedaMascarar, _moedaParaNumero } = require('./moeda.js');

test('_moedaFormatar: formata número como "1.234,56"', () => {
 assert.equal(_moedaFormatar(1234.5), '1.234,50');
 assert.equal(_moedaFormatar(0), '0,00');
 assert.equal(_moedaFormatar(null), '0,00');
});

test('_moedaFormatarBRL: inclui o prefixo R$', () => {
 assert.match(_moedaFormatarBRL(1234.5), /R\$/);
});

test('_moedaMascarar: digitação estilo "caixa eletrônico"', () => {
 assert.equal(_moedaMascarar('1'), '0,01');
 assert.equal(_moedaMascarar('12'), '0,12');
 assert.equal(_moedaMascarar('1234'), '12,34');
 assert.equal(_moedaMascarar('123456'), '1.234,56');
});

test('_moedaMascarar: ignora tudo que não é dígito (já vem mascarado)', () => {
 assert.equal(_moedaMascarar('1.234,56'), '1.234,56');
});

test('_moedaMascarar: vazio/nulo vira string vazia (não "0,00" forçado)', () => {
 assert.equal(_moedaMascarar(''), '');
 assert.equal(_moedaMascarar(null), '');
});

test('_moedaParaNumero: volta pro number certo', () => {
 assert.equal(_moedaParaNumero('1.234,56'), 1234.56);
 assert.equal(_moedaParaNumero('0,01'), 0.01);
 assert.equal(_moedaParaNumero(''), 0);
 assert.equal(_moedaParaNumero(null), 0);
});

test('mascarar + parar pra número é round-trip estável', () => {
 var mascarado = _moedaMascarar('987654');
 assert.equal(_moedaParaNumero(mascarado), 9876.54);
});
