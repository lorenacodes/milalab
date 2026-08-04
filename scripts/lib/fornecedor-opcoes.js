// ═══════════════════════════════════════════════════════════════════════════
// FORNECEDOR — vocabulários controlados (listas fechadas de opção, não texto
// livre). Ampliar qualquer uma delas é só adicionar um item nestes arrays —
// não exige migration nem mudança de schema.
// ═══════════════════════════════════════════════════════════════════════════

// Setor = categoria macro do fornecedor (Área de Atuação) — multiselect
// (um fornecedor pode ter mais de um setor). O antigo "Segmento" (detalhe
// dentro do setor) foi descontinuado no cadastro.
var SETORES_OPCOES = [
 'Materiais e Insumos',
 'Produção e Fabricação',
 'Serviços Especializados',
 'Equipamentos e Locação',
 'Tecnologia',
 'Logística e Transporte',
 'Comunicação Visual',
 'Outros',
];

// Unidade de medida do item orçado — validada aqui no app (não é CHECK no
// banco de propósito, pra nunca precisar de migration só pra adicionar uma
// unidade nova).
var UNIDADES_OPCOES = [
 'unidade', 'm²', 'm³', 'kg', 'metro linear', 'litro', 'caixa', 'pacote', 'hora', 'diária',
];

// Status da cotação: agora é POR PRODUTO (coluna fornecedores_produtos.status_cotacao),
// não mais por fornecedor — produtos diferentes do mesmo fornecedor podem
// estar em estágios de cotação diferentes.
var STATUS_COTACAO_OPCOES = ['Em análise', 'Aprovado', 'Recusado', 'Aguardando retorno', 'Cancelado'];

var EXPERIENCIA_OPCOES = ['Positiva', 'Negativa'];

if (typeof module !== 'undefined' && module.exports) {
 module.exports = { SETORES_OPCOES, UNIDADES_OPCOES, STATUS_COTACAO_OPCOES, EXPERIENCIA_OPCOES };
}
