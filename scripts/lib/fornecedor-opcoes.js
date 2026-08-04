// ═══════════════════════════════════════════════════════════════════════════
// FORNECEDOR — vocabulários controlados (listas fechadas de opção, não texto
// livre). Ampliar qualquer uma delas é só adicionar um item nestes arrays —
// não exige migration nem mudança de schema.
// ═══════════════════════════════════════════════════════════════════════════

// Setor = categoria macro do fornecedor. Segmento = detalhe/especialidade
// dentro dela — os dois são multiselect independentes (um fornecedor pode
// ter mais de um setor e mais de um segmento).
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

var SEGMENTOS_OPCOES = [
 'Gráficas', 'Comunicação Visual', 'Estruturas Metálicas', 'Aço', 'Alumínio',
 'Vidros', 'Revestimentos', 'Marcenaria', 'Elétrica', 'Iluminação',
 'Parafusos e Fixadores', 'Ferragens', 'Tintas', 'Impressão', 'Cenografia',
 'Logística', 'Transporte', 'Locação de Equipamentos', 'Móveis', 'Tecnologia',
 'EPIs', 'Ferramentas',
];

// Unidade de medida do item orçado — validada aqui no app (não é CHECK no
// banco de propósito, pra nunca precisar de migration só pra adicionar uma
// unidade nova).
var UNIDADES_OPCOES = [
 'unidade', 'm²', 'm³', 'kg', 'metro linear', 'litro', 'caixa', 'pacote', 'hora', 'diária',
];

var STATUS_COTACAO_OPCOES = ['Em análise', 'Aprovado', 'Recusado', 'Aguardando retorno', 'Cancelado'];

var EXPERIENCIA_OPCOES = ['Positiva', 'Negativa'];

if (typeof module !== 'undefined' && module.exports) {
 module.exports = { SETORES_OPCOES, SEGMENTOS_OPCOES, UNIDADES_OPCOES, STATUS_COTACAO_OPCOES, EXPERIENCIA_OPCOES };
}
