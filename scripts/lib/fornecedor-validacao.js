// ═══════════════════════════════════════════════════════════════════════════
// FORNECEDOR — validação de campos obrigatórios do cadastro (lógica pura,
// sem DOM), reutilizável tanto no submit do modal quanto em testes. Mensagens
// em português, claras sobre QUAL campo falhou e o quê fazer.
// ═══════════════════════════════════════════════════════════════════════════

function _fornecedorValidarProduto(p, index) {
 var erros = {};
 var prefixo = 'produtos.' + index + '.';
 if (!p || !(p.nome || '').toString().trim()) erros[prefixo + 'nome'] = 'Informe o produto/serviço da linha ' + (index + 1) + '.';
 var qtd = Number(p && p.quantidade);
 if (!p || p.quantidade === '' || p.quantidade == null || isNaN(qtd) || qtd <= 0) {
  erros[prefixo + 'quantidade'] = 'Informe uma quantidade maior que zero na linha ' + (index + 1) + '.';
 }
 if (!p || !(p.unidade_medida || '').toString().trim()) erros[prefixo + 'unidade_medida'] = 'Selecione a unidade de medida na linha ' + (index + 1) + '.';
 var valor = Number(p && p.valor_unitario);
 if (!p || p.valor_unitario === '' || p.valor_unitario == null || isNaN(valor) || valor < 0) {
  erros[prefixo + 'valor_unitario'] = 'Informe o valor unitário na linha ' + (index + 1) + '.';
 }
 // status_cotacao agora é por produto (fornecedores_produtos.status_cotacao),
 // não mais um campo único do fornecedor.
 if (!p || !(p.status_cotacao || '').toString().trim()) erros[prefixo + 'status_cotacao'] = 'Selecione o status da cotação na linha ' + (index + 1) + '.';
 return erros;
}

// dados: { nome, estado, cidades, setores, experiencia,
//          produtos: [{nome, quantidade, unidade_medida, valor_unitario, status_cotacao}] }
function _fornecedorValidar(dados) {
 dados = dados || {};
 var erros = {};

 if (!(dados.nome || '').toString().trim()) erros.nome = 'Informe o nome da empresa.';

 if (!(dados.estado || '').toString().trim()) erros.estado = 'Selecione o estado.';
 if (!Array.isArray(dados.cidades) || dados.cidades.length === 0) erros.cidades = 'Selecione ao menos uma cidade.';

 if (!Array.isArray(dados.setores) || dados.setores.length === 0) erros.setores = 'Selecione ao menos um setor.';

 if (!Array.isArray(dados.produtos) || dados.produtos.length === 0) {
  erros.produtos = 'Adicione ao menos um produto/serviço orçado.';
 } else {
  dados.produtos.forEach(function(p, i) {
   Object.assign(erros, _fornecedorValidarProduto(p, i));
  });
 }

 if (!(dados.experiencia || '').toString().trim()) erros.experiencia = 'Selecione a experiência com o fornecedor.';

 return { valido: Object.keys(erros).length === 0, erros: erros };
}

// Valor total = Quantidade × Valor Unitário — mesma fórmula da coluna gerada
// no banco (fornecedores_produtos.valor_total); usada aqui só pra atualizar a
// tela instantaneamente enquanto o usuário digita, antes de salvar.
function _fornecedorCalcularValorTotal(quantidade, valorUnitario) {
 var q = Number(quantidade); var v = Number(valorUnitario);
 if (isNaN(q) || isNaN(v)) return 0;
 return q * v;
}

// Resumo agregado dos produtos orçados de um fornecedor — usado na listagem
// no lugar de exibir cada produto lado a lado (não escala pra dezenas/
// centenas de itens). Lógica pura pra poder testar sem DOM.
function _fornecedorResumoProdutos(produtos) {
 produtos = Array.isArray(produtos) ? produtos : [];
 var total = produtos.reduce(function(soma, p) {
  var v = Number(p && p.valor_total);
  return soma + (isNaN(v) ? 0 : v);
 }, 0);
 return { quantidade: produtos.length, totalGasto: total };
}

if (typeof module !== 'undefined' && module.exports) {
 module.exports = { _fornecedorValidar, _fornecedorValidarProduto, _fornecedorCalcularValorTotal, _fornecedorResumoProdutos };
}
