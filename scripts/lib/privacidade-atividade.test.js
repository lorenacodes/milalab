// node --test scripts/lib/privacidade-atividade.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { _atividadeEhSomentePraMim, _filtrarSomentePraMim } = require('./privacidade-atividade.js');

test('_atividadeEhSomentePraMim: true só quando visibilidade é "privada"', () => {
 assert.equal(_atividadeEhSomentePraMim({ visibilidade: 'privada' }), true);
 assert.equal(_atividadeEhSomentePraMim({ visibilidade: 'equipe' }), false);
 assert.equal(_atividadeEhSomentePraMim({ visibilidade: null }), false);
 assert.equal(_atividadeEhSomentePraMim({}), false);
 assert.equal(_atividadeEhSomentePraMim(null), false);
});

// Regressão do bug real: o toggle "Somente para mim" contava responsáveis
// (<=1) em vez de checar a privacidade — uma pública com 1 responsável
// aparecia, e uma privada compartilhada com várias pessoas sumia.
test('_atividadeEhSomentePraMim: ignora quantidade de responsáveis', () => {
 assert.equal(_atividadeEhSomentePraMim({ visibilidade: 'equipe', responsavel: ['a@x.com'] }), false);
 assert.equal(_atividadeEhSomentePraMim({ visibilidade: 'privada', responsavel: ['a@x.com', 'b@x.com', 'c@x.com'] }), true);
});

test('_filtrarSomentePraMim: mantém só as privadas, preserva ordem', () => {
 const lista = [
  { id: 1, visibilidade: 'equipe' },
  { id: 2, visibilidade: 'privada' },
  { id: 3, visibilidade: 'equipe' },
  { id: 4, visibilidade: 'privada' },
 ];
 assert.deepEqual(_filtrarSomentePraMim(lista).map((a) => a.id), [2, 4]);
});

test('_filtrarSomentePraMim: lista vazia/nula não quebra', () => {
 assert.deepEqual(_filtrarSomentePraMim([]), []);
 assert.deepEqual(_filtrarSomentePraMim(null), []);
 assert.deepEqual(_filtrarSomentePraMim(undefined), []);
});
