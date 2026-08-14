const test = require('node:test');
const assert = require('node:assert/strict');
const { _ssSelFilterOptions, _ssSelNeedsCreateOption } = require('./searchable-select.js');

test('_ssSelFilterOptions: sem busca retorna tudo', () => {
 assert.deepEqual(_ssSelFilterOptions(['Aracaju', 'Recife'], ''), ['Aracaju', 'Recife']);
});

test('_ssSelFilterOptions: filtra por substring, case-insensitive', () => {
 assert.deepEqual(_ssSelFilterOptions(['Aracaju', 'Recife', 'Maceió'], 'rac'), ['Aracaju']);
 assert.deepEqual(_ssSelFilterOptions(['Aracaju', 'Recife'], 'RECI'), ['Recife']);
});

test('_ssSelFilterOptions: sem match nenhum retorna array vazio', () => {
 assert.deepEqual(_ssSelFilterOptions(['Aracaju', 'Recife'], 'xyz'), []);
});

test('_ssSelNeedsCreateOption: false quando não é creatable', () => {
 assert.equal(_ssSelNeedsCreateOption(['Aracaju'], 'Nova Cidade', false), false);
});

test('_ssSelNeedsCreateOption: false com busca vazia', () => {
 assert.equal(_ssSelNeedsCreateOption(['Aracaju'], '', true), false);
});

test('_ssSelNeedsCreateOption: true quando não existe opção igual', () => {
 assert.equal(_ssSelNeedsCreateOption(['Aracaju', 'Recife'], 'Fortaleza', true), true);
});

test('_ssSelNeedsCreateOption: false quando já existe opção igual (case-insensitive)', () => {
 assert.equal(_ssSelNeedsCreateOption(['Aracaju', 'Recife'], 'aracaju', true), false);
 assert.equal(_ssSelNeedsCreateOption(['Aracaju', 'Recife'], 'ARACAJU', true), false);
});
