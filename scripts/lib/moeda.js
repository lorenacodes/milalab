// ═══════════════════════════════════════════════════════════════════════════
// MOEDA — máscara de "digitação como centavos" (padrão BR: cada dígito
// digitado empurra os centavos, tipo caixa eletrônico) + parse/format BRL.
// Lógica pura, sem tocar em DOM — quem chama aplica o valor no input.
// ═══════════════════════════════════════════════════════════════════════════

// Formata um número (reais) como "1.234,56" (sem o "R$", pra compor no input).
function _moedaFormatar(valorReais) {
 var n = Number(valorReais) || 0;
 return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// String de exibição com o "R$" — usada em textos/leitura, não no input.
function _moedaFormatarBRL(valorReais) {
 var n = Number(valorReais) || 0;
 return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Aplica a máscara em cima do valor bruto digitado (ex: usuário digita
// "1234" → "12,34"; digita mais um "5" → "123,45"). Recebe a string atual do
// input (já mascarada ou não) e devolve a string mascarada pronta pra exibir.
function _moedaMascarar(strDigitada) {
 var digitos = (strDigitada || '').toString().replace(/\D/g, '');
 if (!digitos) return '';
 var n = parseInt(digitos, 10) / 100;
 return _moedaFormatar(n);
}

// Converte o texto mascarado ("1.234,56") de volta pra number (1234.56) —
// o que efetivamente é salvo no banco.
function _moedaParaNumero(strMascarada) {
 var digitos = (strMascarada || '').toString().replace(/\D/g, '');
 if (!digitos) return 0;
 return parseInt(digitos, 10) / 100;
}

if (typeof module !== 'undefined' && module.exports) {
 module.exports = { _moedaFormatar, _moedaFormatarBRL, _moedaMascarar, _moedaParaNumero };
}
