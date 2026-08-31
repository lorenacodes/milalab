// node --test scripts/lib/automacao-validacao.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { _autCondEstaCompleta, _autCondicoesTodasCompletas, _autPrimeiraCondIncompleta } = require('./automacao-validacao.js');

const OPS_SEM_VALOR = { vazio: 1, nao_vazio: 1, e_hoje: 1 };

test('_autCondEstaCompleta: campo + operador + valor vazio (o bug do Produto) é incompleta', () => {
 assert.equal(_autCondEstaCompleta({ campo: 'produto', operador: 'em', valor: [] }, OPS_SEM_VALOR), false);
 assert.equal(_autCondEstaCompleta({ campo: 'produto', operador: 'em', valor: '' }, OPS_SEM_VALOR), false);
 assert.equal(_autCondEstaCompleta({ campo: 'produto', operador: 'em' }, OPS_SEM_VALOR), false);
});

test('_autCondEstaCompleta: sem campo ou sem operador é incompleta', () => {
 assert.equal(_autCondEstaCompleta({ campo: '', operador: 'igual', valor: 'x' }, OPS_SEM_VALOR), false);
 assert.equal(_autCondEstaCompleta({ campo: 'nome', operador: '', valor: 'x' }, OPS_SEM_VALOR), false);
 assert.equal(_autCondEstaCompleta(null, OPS_SEM_VALOR), false);
});

test('_autCondEstaCompleta: operador sem valor (vazio/não vazio/é hoje) é completa mesmo sem valor', () => {
 assert.equal(_autCondEstaCompleta({ campo: 'nome', operador: 'vazio' }, OPS_SEM_VALOR), true);
 assert.equal(_autCondEstaCompleta({ campo: 'nome', operador: 'nao_vazio' }, OPS_SEM_VALOR), true);
 assert.equal(_autCondEstaCompleta({ campo: 'data_fechamento', operador: 'e_hoje' }, OPS_SEM_VALOR), true);
});

test('_autCondEstaCompleta: valor preenchido (escalar ou array) é completa', () => {
 assert.equal(_autCondEstaCompleta({ campo: 'produto', operador: 'em', valor: ['Peças Avulsas'] }, OPS_SEM_VALOR), true);
 assert.equal(_autCondEstaCompleta({ campo: 'nome', operador: 'igual', valor: 'Casa Solar' }, OPS_SEM_VALOR), true);
 assert.equal(_autCondEstaCompleta({ campo: 'valor', operador: 'maior', valor: '0' }, OPS_SEM_VALOR), true);
});

test('_autCondEstaCompleta: array só com strings vazias/espaço continua incompleta', () => {
 assert.equal(_autCondEstaCompleta({ campo: 'produto', operador: 'em', valor: ['', '   '] }, OPS_SEM_VALOR), false);
});

test('_autCondicoesTodasCompletas: true só quando NENHUMA condição está incompleta', () => {
 var completas = [
  { campo: 'etapa_projeto', operador: 'igual', valor: ['Pré-projeto'] },
  { campo: 'produto', operador: 'em', valor: ['Solar'] },
 ];
 assert.equal(_autCondicoesTodasCompletas(completas, OPS_SEM_VALOR), true);

 var comUmaIncompleta = [
  { campo: 'etapa_projeto', operador: 'igual', valor: ['Pré-projeto'] },
  { campo: 'produto', operador: 'em', valor: [] }, // exatamente o bug relatado
 ];
 assert.equal(_autCondicoesTodasCompletas(comUmaIncompleta, OPS_SEM_VALOR), false);
});

test('_autCondicoesTodasCompletas: lista vazia é considerada completa (nenhuma condição pra faltar)', () => {
 assert.equal(_autCondicoesTodasCompletas([], OPS_SEM_VALOR), true);
});

test('_autPrimeiraCondIncompleta: aponta a condição que está faltando, não a primeira da lista', () => {
 var conds = [
  { campo: 'etapa_projeto', operador: 'igual', valor: ['Pré-projeto'] },
  { campo: 'produto', operador: 'em', valor: [] },
 ];
 assert.deepEqual(_autPrimeiraCondIncompleta(conds, OPS_SEM_VALOR), { campo: 'produto', operador: 'em', valor: [] });
});

test('_autPrimeiraCondIncompleta: null quando tudo está completo', () => {
 var conds = [{ campo: 'nome', operador: 'igual', valor: 'x' }];
 assert.equal(_autPrimeiraCondIncompleta(conds, OPS_SEM_VALOR), null);
});
