// ═══════════════════════════════════════════════════════════════════════════════
// BADGE COLORS — mapa único de VALOR -> classe de cor do Pill Badge (.badge +
// .bX em styles/main.css). Antes desses mapas existirem aqui, Etapa do Projeto
// tinha 3 cópias divergentes em projetos.js e Tipo de Obra tinha cópias em
// obras.js/projetos.js — qualquer lugar do sistema que precise da cor de uma
// Etapa/Tipo deve referenciar ESTE mapa (ou os aliases locais que apontam pra
// ele), garantindo que Pill Badge, tabela, Kanban e detalhamento mostrem
// exatamente a mesma cor pro mesmo valor.
// ═══════════════════════════════════════════════════════════════════════════════

var BADGE_TIPO_OBRA = {
 'Telhados':'bg', 'Steel Frame':'bp', 'Modular':'bb', 'Solar':'by', 'Misto (LSF+A36)':'bn'
};

var BADGE_ETAPA_NEGOCIO = {
 'Orçamento':'bb','Atualização de orçamento':'bb','Follow-up':'by','Negociação':'bp',
 'Aprovação de projeto':'by','Piloto':'bn','Projeto aprovado':'bn','Em Andamento':'bn',
 'Pós-vendas':'bg','Concluído':'bg','Negócio perdido':'br'
};
// Cor "crua" (CSS var) da mesma Etapa do Negócio, pro dot dos cabeçalhos do
// Kanban (index.html, <span class="kc-dot"> com cor inline) — mesma cor
// conceitual do mapa acima, só numa forma diferente pro mesmo contexto visual.
var BADGE_ETAPA_NEGOCIO_DOT = {
 'Orçamento':'var(--blue)','Atualização de orçamento':'var(--blue)','Follow-up':'var(--yellow)',
 'Negociação':'var(--purple)','Aprovação de projeto':'var(--yellow)','Piloto':'var(--navy)',
 'Projeto aprovado':'var(--navy)','Em Andamento':'var(--navy)','Pós-vendas':'var(--green)',
 'Concluído':'var(--green)','Negócio perdido':'var(--red)'
};

// Etapa do Projeto — mesmas 15 chaves/cores já usadas nas 3 cópias locais de
// projetos.js (_projEtapaCls no kanban/tabela/detalhamento), agora com fonte
// única.
var BADGE_ETAPA_PROJETO = {
 'Orçamento':'bm','Análise Inicial':'bm','Aguardando Aprovação':'by',
 'Pré-projeto':'bm','Revisão Pré-Projeto':'by',
 'Projeto para Aprovação':'bb','Revisão Projeto':'by',
 'Projeto Executivo':'bb','Revisão Projeto Executivo':'by',
 'Ajustes de Piloto':'by','Projeto em Andamento':'by',
 'Aguardando Produção':'by','Projeto Finalizado':'bg',
 'Pós-vendas':'bg','Negócio perdido':'br'
};
// Cor "crua" (CSS var) da mesma Etapa do Projeto, pro dot do cabeçalho do
// Kanban de Projetos (mesma forma que BADGE_ETAPA_NEGOCIO_DOT acima).
var BADGE_ETAPA_PROJETO_DOT = {
 'Orçamento':'var(--blue)','Análise Inicial':'var(--blue)','Aguardando Aprovação':'var(--yellow)',
 'Pré-projeto':'var(--blue)','Revisão Pré-Projeto':'var(--yellow)',
 'Projeto para Aprovação':'var(--navy)','Revisão Projeto':'var(--yellow)',
 'Projeto Executivo':'var(--navy)','Revisão Projeto Executivo':'var(--yellow)',
 'Ajustes de Piloto':'var(--yellow)','Projeto em Andamento':'var(--yellow)',
 'Aguardando Produção':'var(--yellow)','Projeto Finalizado':'var(--green)',
 'Pós-vendas':'var(--green)','Negócio perdido':'var(--red)'
};

// Etapa da Entrega — mesma cor conceitual já usada em entregas.js
// (_entBucketCor: aguardando #B8790A, producao #2E5FD9, transporte #8b5cf6,
// entregue #1F8A4C, atrasado #D6433C), só que na forma de classe .bX pro
// Pill Badge. A lógica de bucket/agrupamento continua 100% em entregas.js
// (_entEtapaBucket) — este mapa não duplica isso, só traduz bucket->classe.
var BADGE_ETAPA_ENTREGA_BUCKET_CLS = {
 aguardando: 'by', producao: 'bb', transporte: 'bp', entregue: 'bg', atrasado: 'br'
};

// Fallback cinza neutro (.bm) pra valor não mapeado — usado tanto pelos
// campos que devem ser SEMPRE cinza (Canal de Vendas, Cidade, Estado, Produto)
// quanto como defensivo pros campos com cor própria.
function _badgeCls(map, val) {
 return (map && map[val]) || 'bm';
}
function _badgeEsc(s) {
 return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
// Monta o HTML de um pill badge — mesmo padrão `<span class="badge bX">` já
// usado em obras.js/projetos.js, centralizado pra não repetir a string em
// cada call site. dense=true aplica font-size:10px (tabela/kanban).
function _badgeHTML(label, cls, dense) {
 if (label == null || label === '') return '';
 return '<span class="badge ' + cls + '"' + (dense ? ' style="font-size:10px"' : '') + '>' + _badgeEsc(label) + '</span>';
}
