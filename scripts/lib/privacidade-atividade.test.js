// node --test scripts/lib/privacidade-atividade.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
 _atividadeEhPrivada, _atividadeEhSomentePraMim, _atividadeEhPessoasEspecificas,
 _filtrarSomentePraMim, _filtrarPessoasEspecificas,
} = require('./privacidade-atividade.js');

test('_atividadeEhPrivada: true só quando visibilidade é "privada"', () => {
 assert.equal(_atividadeEhPrivada({ visibilidade: 'privada' }), true);
 assert.equal(_atividadeEhPrivada({ visibilidade: 'equipe' }), false);
 assert.equal(_atividadeEhPrivada({ visibilidade: null }), false);
 assert.equal(_atividadeEhPrivada({}), false);
 assert.equal(_atividadeEhPrivada(null), false);
});

// Regressão do bug real: o toggle "Somente para mim" contava responsáveis
// (<=1) em vez de checar a privacidade — uma pública com 1 responsável
// aparecia, e uma privada compartilhada com várias pessoas sumia.
test('_atividadeEhPrivada: ignora quantidade de responsáveis', () => {
 assert.equal(_atividadeEhPrivada({ visibilidade: 'equipe', responsavel: ['a@x.com'] }), false);
 assert.equal(_atividadeEhPrivada({ visibilidade: 'privada', responsavel: ['a@x.com', 'b@x.com', 'c@x.com'] }), true);
});

// Regressão do bug real #2: "privada" sozinho não distingue "Somente para
// mim" de "Pessoas específicas" — só o Set de compartilhamento diferencia.
test('_atividadeEhSomentePraMim vs _atividadeEhPessoasEspecificas: divide pelo compartilhamento', () => {
 const soEu = { id: 'a1', visibilidade: 'privada' };
 const especifico = { id: 'a2', visibilidade: 'privada' };
 const publica = { id: 'a3', visibilidade: 'equipe' };
 const comCompartilhamento = new Set(['a2']);

 assert.equal(_atividadeEhSomentePraMim(soEu, comCompartilhamento), true);
 assert.equal(_atividadeEhPessoasEspecificas(soEu, comCompartilhamento), false);

 assert.equal(_atividadeEhSomentePraMim(especifico, comCompartilhamento), false);
 assert.equal(_atividadeEhPessoasEspecificas(especifico, comCompartilhamento), true);

 assert.equal(_atividadeEhSomentePraMim(publica, comCompartilhamento), false);
 assert.equal(_atividadeEhPessoasEspecificas(publica, comCompartilhamento), false);
});

test('_atividadeEhSomentePraMim: sem Set de compartilhamento, trata toda privada como "só eu"', () => {
 assert.equal(_atividadeEhSomentePraMim({ id: 'a1', visibilidade: 'privada' }), true);
 assert.equal(_atividadeEhPessoasEspecificas({ id: 'a1', visibilidade: 'privada' }), false);
});

test('_filtrarSomentePraMim / _filtrarPessoasEspecificas: dividem a lista corretamente', () => {
 const lista = [
  { id: 1, visibilidade: 'equipe' },
  { id: 2, visibilidade: 'privada' },        // só eu
  { id: 3, visibilidade: 'equipe' },
  { id: 4, visibilidade: 'privada' },        // específicos
  { id: 5, visibilidade: 'privada' },        // só eu
 ];
 const comCompartilhamento = new Set([4]);
 assert.deepEqual(_filtrarSomentePraMim(lista, comCompartilhamento).map((a) => a.id), [2, 5]);
 assert.deepEqual(_filtrarPessoasEspecificas(lista, comCompartilhamento).map((a) => a.id), [4]);
});

test('_filtrarSomentePraMim: lista vazia/nula não quebra', () => {
 assert.deepEqual(_filtrarSomentePraMim([]), []);
 assert.deepEqual(_filtrarSomentePraMim(null), []);
 assert.deepEqual(_filtrarSomentePraMim(undefined), []);
});
