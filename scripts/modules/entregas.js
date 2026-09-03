// ═══════════════════════════════════════════════════════════════════════════════
// ENTREGAS — tabela/kanban/calendário de entregas de obra, renderer do painel
// lateral, carga da lista. "Salvar" no painel lateral ainda não foi implementado
// (não é código morto, é feature ausente no sistema original).
//
// Redesign completo (Tabela/Kanban/Calendário + Filtro/Agrupar/Ordenar/
// Visualizações reais + abas de atalho estilo Airtable), ver PR — corrige
// bugs de dados reais encontrados na auditoria do schema `entregas`:
//  - `e.numero` NUNCA existiu na tabela `entregas` (schema real: id,
//    airtable_id, nome_entrega, obra_id, etapa, valor, quantidade, peso_kg,
//    transporte, cidade, data_faturamento, pedido_produzido,
//    pedido_compusa_milatec, pedido_compusa_mila, maior_peca_mm,
//    endereco_entrega, created_at, updated_at) — daí o "#undefined" visto
//    pela usuária. `nome_entrega` é o campo real e muito mais informativo
//    (ex.: "VIANA E MOURA - PROJ 13.2 - PEDIDO 172478 - CARUARU / PARTE 2"),
//    passa a ser o texto primário de cada linha/card.
//  - `e.obra?.tipo_orcamento` também nunca existiu (não é coluna de `obras`)
//    — coluna "Tipo" era 100% decorativa, removida.
//  - "Previsão produção/expedição/entrega" nunca tiveram campo de data real
//    por trás (só existe `data_faturamento`) — as 3 colunas mostravam só
//    "—"; unificadas numa única coluna "Faturamento" com o dado real.
//  - `stMap` comparava com rótulos ('Aguardando produção','Em produção',
//    'Transporte','Entregue') que NUNCA existiram nos dados reais — os
//    valores reais de `etapa` são 'Aprovação de projeto'/'Liberar produção'/
//    'Produção'/'Pedido produzido'/'Programar entrega'/'Em transporte'/
//    'Entrega realizada' (94% das 1472 linhas = "Entrega realizada"). Sem
//    mapeamento correto, TUDO caía no fallback 'aguardando'. Ver
//    _entEtapaBucket abaixo pro mapeamento real → 4 status visuais.
// ═══════════════════════════════════════════════════════════════════════════════
// ── Modal "Nova Entrega" — botão único (topbar global, rota 'entregas' em
// app.js), mesmo esqueleto open/close/submit do modal Novo Projeto
// (openNovoProjeto/closeNovoProjeto/submitNovoProjeto, projetos.js).
// Reaproveita o MESMO conjunto de campos/validação de _spCriarEntrega
// (obras.js, formulário inline dentro do painel de Obra) — grava em
// `entregas` + `entregas_obras` (vínculo primário), não só `obra_id`.
async function _neObraPopular() {
 var wrap = document.getElementById('ne-obra-wrap');
 if (!wrap) return;
 await _entCarregarObrasCache();
 var lista = _entObrasCache || [];
 _srchSelRegister('neObra', {
  options: lista.map(function(o){ return o.nome || '(sem nome)'; }),
  placeholder: 'Selecione a obra...',
  onSelect: function(nome) {
   var obra = lista.find(function(o){ return (o.nome || '(sem nome)') === nome; });
   var idEl = document.getElementById('ne-obra-id');
   if (idEl) idEl.value = obra ? obra.id : '';
  },
 });
 wrap.innerHTML = _srchSelMarkup('neObra', 'ne-obra-id', '');
}
function _neTransportePopular() {
 var wrap = document.getElementById('ne-transporte-wrap');
 if (!wrap) return;
 _srchSelRegister('neTransporte', {
  options: function(){ return _obraTransporteCache || []; }, creatable: true, placeholder: 'Selecione o transporte...',
  onOpen: _obraCarregarTransportes,
  onSelect: function(v) { if (v && (_obraTransporteCache||[]).indexOf(v) === -1) _obraTransporteCache.push(v); },
 });
 wrap.innerHTML = _srchSelMarkup('neTransporte', 'ne-transporte-id', '');
}
async function openNovaEntrega() {
 ['ne-nome','ne-data','ne-qtd','ne-peso','ne-maior-peca','ne-valor'].forEach(function(id){ var el = document.getElementById(id); if (el) el.value = ''; });
 var prod = document.getElementById('ne-produzido'); if (prod) prod.checked = false;
 var doc = document.getElementById('ne-doc'); if (doc) doc.value = '';
 var op = document.getElementById('ne-op'); if (op) op.value = '';
 _neFilesResetAll();
 var etapaSel = document.getElementById('ne-etapa');
 if (etapaSel) {
  etapaSel.innerHTML = '<option value="">Selecione...</option>'
   + Object.keys(_entEtapaBucket).map(function(et){ return '<option value="' + et.replace(/"/g,'&quot;') + '">' + et + '</option>'; }).join('');
 }
 await Promise.all([_neObraPopular(), Promise.resolve(_neTransportePopular())]);
 document.getElementById('modal-nova-entrega').classList.add('open');
 document.body.style.overflow = 'hidden';
}
function closeNovaEntrega() {
 document.getElementById('modal-nova-entrega').classList.remove('open');
 document.body.style.overflow = '';
}

// ── Dropzones de anexo do modal (Documento da entrega / Ordem de Produção) ──
// Upload só acontece no "Criar entrega" (_submitNovaEntregaReal já lê
// ne-doc/ne-op.files) — a entrega ainda não existe nesse ponto, então não dá
// pra gravar o anexo antes.
//
// Acumula em JS (_neFilesAcc) em vez de confiar só no FileList nativo do
// <input>: selecionar de novo (clicar de novo, ou soltar outro arquivo)
// REPLACES o FileList inteiro — comportamento padrão do browser, não bug —
// então sem isso a 2ª seleção "sumia" com a 1ª (reportado: "se você adiciona
// mais parece que só tem um mesmo assim"). ne-doc aceita vários (soma a
// cada seleção); ne-op é campo de 1 arquivo só, então substitui mesmo.
var _neFilesAcc = { 'ne-doc': [], 'ne-op': [] };
function _neFileLabelReset(labelId) {
 var lbl = document.getElementById(labelId);
 if (lbl) lbl.textContent = 'Clique ou arraste para anexar';
}
function _neFilesResetAll() {
 _neFilesAcc = { 'ne-doc': [], 'ne-op': [] };
 _neFileLabelReset('ne-doc-lbl'); _neFileLabelReset('ne-op-lbl');
}
// DataTransfer é o único jeito de montar um FileList de verdade pra atribuir
// de volta a input.files (não dá pra criar um FileList na mão) — é o que
// _submitNovaEntregaReal continua lendo pra fazer o upload de cada arquivo.
function _neFilesApply(inputId, labelId) {
 var input = document.getElementById(inputId);
 var files = _neFilesAcc[inputId];
 if (!input) return;
 var dt = new DataTransfer();
 files.forEach(function(f) { dt.items.add(f); });
 input.files = dt.files;
 var lbl = document.getElementById(labelId);
 if (!lbl) return;
 if (!files.length) { _neFileLabelReset(labelId); return; }
 lbl.textContent = files.length === 1 ? files[0].name : files.length + ' arquivos selecionados';
}
function _neFilesAdd(inputId, labelId, newFiles) {
 var multiple = inputId === 'ne-doc';
 var incoming = Array.prototype.slice.call(newFiles || []);
 _neFilesAcc[inputId] = multiple ? _neFilesAcc[inputId].concat(incoming) : incoming.slice(0, 1);
 _neFilesApply(inputId, labelId);
}
function _neFileChange(input, labelId) {
 _neFilesAdd(input.id, labelId, input.files);
}
function _neFileDrop(event, inputId, labelId) {
 event.preventDefault();
 var dz = event.currentTarget; dz.classList.remove('drag');
 var files = event.dataTransfer && event.dataTransfer.files;
 if (!files || !files.length) return;
 _neFilesAdd(inputId, labelId, files);
}
// Guarda de clique duplo (_ccUmaVez, concurrency.js): dois cliques rápidos no
// botão "Criar" disparavam dois INSERTs e criavam DUAS entregas iguais — não
// havia trava nenhuma. A 2ª chamada agora é ignorada enquanto a 1ª não
// termina, e o botão fica desabilitado nesse intervalo.
async function submitNovaEntrega() {
 return _ccUmaVez('nova-entrega', _submitNovaEntregaReal, document.getElementById('ne-submit'));
}
async function _submitNovaEntregaReal() {
 var nome = (document.getElementById('ne-nome')?.value || '').trim();
 var etapa = document.getElementById('ne-etapa')?.value || '';
 var data = document.getElementById('ne-data')?.value || '';
 var qtdStr = document.getElementById('ne-qtd')?.value || '';
 var obraId = document.getElementById('ne-obra-id')?.value || null;
 var faltando = [];
 if (!nome) faltando.push('Entrega');
 // Obra é obrigatória (igual ao Airtable) — sem isso a entrega nascia órfã
 // (obra_id null), quebrando tudo que depende dela: Cidade/Estado/Endereço
 // (agora rollup somente-leitura da Obra), Contato do orçamento, Tipo de
 // orçamento, Documentos "from Obras" e o vínculo em entregas_obras.
 if (!obraId) faltando.push('Obra');
 if (!etapa) faltando.push('Etapa');
 if (!data) faltando.push('Data de faturamento');
 if (qtdStr === '') faltando.push('Quantidade');
 if (faltando.length) { _showToast ? _showToast('Preencha: ' + faltando.join(', '), 'aviso') : alert('Preencha os campos obrigatórios: ' + faltando.join(', ') + '.'); return; }
 if (!_sb) { _showToast ? _showToast('Sem conexão com o banco.', 'erro') : alert('Sem conexão com o banco.'); return; }
 var payload = {
  obra_id: obraId,
  nome_entrega: nome,
  etapa: etapa,
  data_faturamento: data,
  quantidade: Number(qtdStr),
  peso_kg: document.getElementById('ne-peso')?.value !== '' ? Number(document.getElementById('ne-peso').value) : null,
  valor: document.getElementById('ne-valor')?.value !== '' ? Number(document.getElementById('ne-valor').value) : null,
  maior_peca_mm: document.getElementById('ne-maior-peca')?.value !== '' ? Number(document.getElementById('ne-maior-peca').value) : null,
  transporte: document.getElementById('ne-transporte-id')?.value?.trim() || null,
  pedido_produzido: !!document.getElementById('ne-produzido')?.checked,
 };
 // Criar a entrega e gravar o vínculo primário em entregas_obras eram DOIS
 // requests separados: se o segundo falhasse (rede, RLS, timeout), a entrega
 // ficava criada e órfã — sem obra vinculada — e o frontend não tinha como
 // desfazer o primeiro. Agora os dois acontecem dentro da MESMA transação,
 // na função criar_entrega_com_obra (migração concorrencia_historico_fase1):
 // ou os dois gravam, ou nenhum grava.
 var res = await _sb.rpc('criar_entrega_com_obra', { p_dados: payload, p_obra_id: obraId });
 if (res.error || !res.data) {
  console.error('[Entregas] erro ao criar entrega:', res.error);
  _showToast('Não foi possível criar a entrega. Nada foi salvo — confira os campos e tente de novo.', 'erro');
  return;
 }
 var nova = Array.isArray(res.data) ? res.data[0] : res.data;
 var docFiles = Array.from(document.getElementById('ne-doc')?.files || []);
 var opFile = document.getElementById('ne-op')?.files?.[0];
 var anexosComErro = 0;
 for (var i = 0; i < docFiles.length; i++) { if (!(await _spUploadDocEntrega(docFiles[i], nova.id, obraId, 'documento_especifico'))) anexosComErro++; }
 if (opFile) { if (!(await _spUploadDocEntrega(opFile, nova.id, obraId, 'ordem_producao'))) anexosComErro++; }
 if (anexosComErro) { var wmsg = 'Entrega criada, mas ' + anexosComErro + ' anexo(s) não foram enviados. Você pode anexá-los depois pelo painel de detalhe.'; _showToast ? _showToast(wmsg, 'aviso') : alert(wmsg); }
 else { _showToast ? _showToast('Entrega criada com sucesso!', 'ok') : null; }
 closeNovaEntrega();
 if (typeof _dbLoadEntregas === 'function') _dbLoadEntregas();
}

// ── Status: mapeamento REAL etapa → bucket visual ──────────────────────────
// A tabela `etapa` tem 7 valores reais + null (ver auditoria acima); o
// produto só quer expor 4 status visuais (Aguardando produção/Em produção/
// Em transporte/Entregue), então cada etapa real cai num desses 4 baldes —
// mas o RÓTULO exibido continua sendo o `etapa` real (mais preciso), só a
// COR/agrupamento é que usam o balde.
var _entEtapaBucket = {
 'Aprovação de projeto':  'aguardando',
 'Liberar produção':      'producao',
 'Produção':               'producao',
 'Pedido produzido':       'producao',
 'Programar entrega':      'producao',
 'Em transporte':          'transporte',
 'Entrega realizada':      'entregue'
};
function _entBucketFor(etapa) { return _entEtapaBucket[etapa] || 'aguardando'; }
var _entBucketCor   = { aguardando:'#B8790A', producao:'#2E5FD9', transporte:'#8b5cf6', entregue:'#1F8A4C', atrasado:'#D6433C' };
var _entBucketLabel = { aguardando:'Aguardando produção', producao:'Em produção', transporte:'Em transporte', entregue:'Entregue' };

// Cor do Transporte — pedido explícito (pill obrigatória, referência visual
// Airtable): Mila (frota própria, "Mila - 01", "Mila - 05", "Mila - definir
// caminhão"...) sempre a MESMA cor, mesmo com o número/observação variando —
// por isso é uma regra sobre o PREFIXO do texto, não um mapa fechado de
// valores exatos como os outros badges do sistema (Frete Terceirizado e
// Retirada, esses sim, valores fixos).
function _entTransporteBadgeCls(v) {
 if (!v) return 'bm';
 var s = String(v).trim().toLowerCase();
 if (s.indexOf('mila') === 0) return 'bk';               // rosa
 if (s === 'frete terceirizado') return 'bg';              // verde
 if (s === 'retirada') return 'bb';                        // azul
 return 'bm';                                              // cinza — qualquer outro valor
}
// "Atrasado" — mesmo esquema do Gestor de Tarefas (_gIsLate): calculado, não
// é um valor de `etapa`. Vencida = data_faturamento no passado + ainda não
// entregue. Sobrepõe a cor do status (ponto vermelho), sem esconder o rótulo.
function _entIsLate(e) {
 if (_entBucketFor(e.etapa) === 'entregue' || !e.data_faturamento) return false;
 return new Date(e.data_faturamento + 'T00:00:00') < new Date(new Date().setHours(0,0,0,0));
}
function _entCidadeUf(e) {
 // `entregas.cidade` é texto livre digitado manualmente (formatos
 // inconsistentes: "buique/PE", "ITAITINGA/CE", "Caxias/MA"...); `obras.cidade`
 // + `obras.estado` são campos estruturados mais confiáveis quando a obra
 // está vinculada — preferidos; cai pro texto livre da própria entrega só
 // quando não há obra vinculada.
 var o = e.obra;
 if (o && (o.cidade || o.estado)) return [o.cidade, o.estado].filter(Boolean).join('/');
 return e.cidade || '';
}
// Cidade PURA (sem UF junto) — só pro filtro por Cidade (_entFbFields
// abaixo). Achado real: o filtro de Cidade usava _entCidadeUf (a mesma
// função da coluna "Cidade/UF" da tabela), então as opções apareciam como
// "Caruaru/PE" em vez de só "Caruaru" — na prática unificava Cidade e
// Estado num campo só, redundante com o filtro de Estado que já existe
// separado.
function _entCidadeSoNome(e) {
 if (e.obra && e.obra.cidade) return e.obra.cidade;
 return (e.cidade || '').split('/')[0].trim();
}

// ── Filtro/Ordenação/Agrupamento — componentes reutilizáveis do Gestor de
// Tarefas/Obras/Empresas/Instalações (filtro-builder/sort-builder/
// group-builder/smart-search/saved-views), sobre campos REAIS (ver auditoria
// acima) em vez dos 4 chips fixos de status ou de colunas fantasma.
//
// Listas de opções (Obra/Empresa/Cidade/Transporte/Categoria/Criado por...)
// são funções, não arrays estáticos — _fbSearchableDropdown já suporta
// `options` como função (ver scripts/lib/filtro-builder.js:354) e assim elas
// sempre refletem o `_entregasArr` atual (recarregado/realtime), sem precisar
// raspar o DOM da Tabela (que nem sempre está montado — Kanban/Calendário
// também usam o filtro).
function _entDistinctOptions(mapFn) {
 var set = {};
 (_entregasArr || []).forEach(function(e) { var v = mapFn(e); if (v) set[v] = 1; });
 return Object.keys(set).sort(function(a, b) { return a.localeCompare(b, 'pt-BR'); });
}
// Presença de documento ("Nota Fiscal anexada?") — carregado 1x em bloco
// (ver _entLoadDocPresence, chamado por _dbLoadEntregas) em vez de por
// entrega individualmente: a Tabela/Kanban/Calendário nunca abrem o painel
// de cada entrega, então não têm de outra forma como saber se há algum
// documento anexado sem essa carga em lote.
var _entDocEntregaIds = null; // Set<string> | null (null = ainda não carregado)

// Lê uma tabela inteira em blocos de 1000 — ver comentário em
// _entLoadDocPresence sobre o corte silencioso do Supabase.
async function _entCarregarPaginado(tabela, colunas, aplicarFiltros) {
 var tudo = [], from = 0, pageSize = 1000;
 while (true) {
  var q = _sb.from(tabela).select(colunas);
  if (typeof aplicarFiltros === 'function') q = aplicarFiltros(q);
  var res = await q.range(from, from + pageSize - 1);
  if (res.error) { console.error('[Entregas] erro ao ler ' + tabela + ':', res.error); break; }
  var lote = res.data || [];
  tudo = tudo.concat(lote);
  if (lote.length < pageSize) break;
  from += pageSize;
 }
 return tudo;
}
async function _entLoadDocPresence() {
 if (!_sb) return;
 var ids = {};
 // BUG REAL corrigido aqui: as duas consultas vinham sem paginação nenhuma e
 // o Supabase corta em 1000 linhas SEM avisar. Como hoje são 4.349 documentos
 // com entrega_id e 4.014 vínculos em documentos_entregas, mais de 3/4 dos
 // vínculos eram ignorados — o filtro "Nota Fiscal anexada" respondia "Não"
 // pra centenas de entregas que TÊM nota, sem nenhum sintoma visível.
 var [direto, viaJuncao] = await Promise.all([
  _entCarregarPaginado('documentos', 'entrega_id', function(q){ return q.not('entrega_id', 'is', null); }),
  _entCarregarPaginado('documentos_entregas', 'entrega_id'),
 ]);
 direto.forEach(function(r) { if (r.entrega_id) ids[r.entrega_id] = 1; });
 viaJuncao.forEach(function(r) { if (r.entrega_id) ids[r.entrega_id] = 1; });
 _entDocEntregaIds = ids;
 // Reaplica pro data-nota-fiscal das <tr> já renderizadas refletir a carga
 // (chegou depois da 1ª renderização da Tabela) e pro filtro por Nota Fiscal
 // (se alguém já tinha aberto o popover) funcionar sem precisar recarregar.
 if (typeof _entApplyFilters === 'function') _entApplyFilters();
}

// "Contato do orçamento" no filtro ficava sempre vazio (contatoOrcamento:''
// hard-coded) — a resolução real (_entCarregarContatoOrcamento, mais abaixo)
// só existe no painel de detalhe de UMA entrega por vez (1ª linha de
// contatos_obras da obra vinculada). Pra filtrar a lista inteira, carrega
// em bloco (mesmo padrão de _entLoadDocPresence) um mapa obra_id → nome do
// 1º contato, e reaplica os filtros quando terminar.
var _entContatoOrcamentoMap = null; // { obraId: nomeContato } | null (ainda não carregado)
async function _entLoadContatoOrcamento() {
 if (!_sb) return;
 var linhas = await _entCarregarPaginado('contatos_obras', 'obra_id, contato:contato_id(nome_completo)');
 var mapa = {};
 linhas.forEach(function(r) {
  if (!r.obra_id || mapa[r.obra_id]) return; // 1ª linha por obra = principal, mesma convenção do painel
  var nome = r.contato && r.contato.nome_completo;
  if (nome) mapa[r.obra_id] = nome;
 });
 _entContatoOrcamentoMap = mapa;
 if (typeof _entApplyFilters === 'function') _entApplyFilters();
}

var _entFbFields = [
 // options em português (via _entBucketLabel) — o filtro comparava/exibia a
 // chave interna crua (aguardando/producao/transporte/entregue), que nunca
 // deveria aparecer pra usuária, só serve de índice interno pro bucket.
 // Pedido explícito: filtro de Status opera no nível da etapa CRUA (7
 // valores reais), não do balde visual de 4 opções (esse continua só pro
 // Kanban/agrupamento, ver _entGroupKeyFor abaixo) — esconder as etapas que
 // não foram citadas no pedido mascararia dado real, então as 7 entram todas.
 { key: 'status',      label: 'Status',       type: 'select',
   options: Object.keys(_entEtapaBucket),
   getValue: function(ds) { return ds.etapaRaw; } },
 { key: 'nomeEntrega',   label: 'Entrega',      type: 'text' },
 { key: 'obra',          label: 'Obra',         type: 'select', options: function() { return _entDistinctOptions(function(e){ return (e.obra && e.obra.nome) || ''; }); } },
 { key: 'empresa',       label: 'Empresa',      type: 'select', options: function() { return _entDistinctOptions(function(e){ return (e.obra && e.obra.empresas_obras && e.obra.empresas_obras[0] && e.obra.empresas_obras[0].empresa && e.obra.empresas_obras[0].empresa.nome) || ''; }); } },
 { key: 'cidade',        label: 'Cidade',       type: 'select',
   options: function() { return _entDistinctOptions(function(e){ return _entCidadeSoNome(e); }); },
   getValue: function(ds) { return ds.cidadeObra; } },
 { key: 'estado',        label: 'Estado',       type: 'select', options: function() { return _entDistinctOptions(function(e){ return (e.obra && e.obra.estado) || e.estado || ''; }); } },
 { key: 'transporte',    label: 'Transporte',   type: 'select', options: function() { return _entDistinctOptions(function(e){ return e.transporte || ''; }); } },
 { key: 'dataFat',       label: 'Faturamento',  type: 'date' },
 { key: 'pedidoProduzido', label: 'Pedido produzido', type: 'select', options: ['Sim', 'Não'] },
 { key: 'quantidade',    label: 'Quantidade',   type: 'text' },
 { key: 'peso',          label: 'Peso (kg)',    type: 'text' },
 { key: 'maiorPeca',     label: 'Maior peça (mm)', type: 'text' },
 { key: 'valor',         label: 'Valor',        type: 'text' },
 { key: 'categoria',     label: 'Categoria (tipo de obra)', type: 'multitext', options: function() { return _entDistinctOptions2(function(e){ return (e.obra && e.obra.tipo_obra) || []; }); } },
 { key: 'enderecoEntrega', label: 'Endereço de entrega', type: 'text' },
 { key: 'pedidoCompusaMilatec', label: 'Pedido Compusa Milatec', type: 'text' },
 { key: 'pedidoCompusaMila',    label: 'Pedido Compusa Mila',    type: 'text' },
 // Presença de Nota Fiscal — depende de _entLoadDocPresence já ter
 // terminado; antes disso, todas as entregas avaliam como "Não" (mesmo
 // efeito de "ainda carregando", não trava a Tabela).
 { key: 'notaFiscal',    label: 'Nota Fiscal anexada', type: 'select', options: ['Sim', 'Não'] },
 { key: 'contatoOrcamento', label: 'Contato do orçamento', type: 'text' },
 // Coluna real (`criado_por`/`atualizado_por`) guarda e-mail (trigger de
 // auditoria, ver migração da seção 1); exibe/filtra pelo nome de exibição
 // via _projAuditNome (projetos.js, já carregado antes deste módulo).
 { key: 'criadoPor',     label: 'Criado por',   type: 'select', options: function() { return (_usuariosCache || []).map(function(u){ return u.nome_display || u.email; }); } },
 { key: 'alteradoPor',   label: 'Alterado por', type: 'select', options: function() { return (_usuariosCache || []).map(function(u){ return u.nome_display || u.email; }); } },
 { key: 'horarioCriacao', label: 'Criado em',   type: 'date' },
];
_fbInit('entregas', _entFbFields, _entApplyFilters);

// options() de campo multitext (Categoria) — lista achatada/distinta de um
// campo array (obras.tipo_obra pode ter mais de 1 tipo por obra).
function _entDistinctOptions2(mapFn) {
 var set = {};
 (_entregasArr || []).forEach(function(e) { (mapFn(e) || []).forEach(function(v){ if (v) set[v] = 1; }); });
 return Object.keys(set).sort(function(a, b) { return a.localeCompare(b, 'pt-BR'); });
}

var _entSbFields = [
 { key: 'nomeEntrega', label: 'Entrega',       type: 'text' },
 { key: 'obra',        label: 'Obra',          type: 'text' },
 { key: 'status',      label: 'Etapa',         type: 'text', getValue: function(ds) { return ds.etapaRaw; } },
 { key: 'transporte',  label: 'Transporte',    type: 'text' },
 { key: 'cidadeObra',  label: 'Cidade (obra)', type: 'text' },
 { key: 'dataFat',     label: 'Faturamento',   type: 'date' },
 { key: 'quantidade',  label: 'Qtd. (peças)',  type: 'number', getValue: function(ds) { return parseFloat(ds.quantidade) || 0; } },
 { key: 'peso',        label: 'Peso (kg)',     type: 'number', getValue: function(ds) { return parseFloat(ds.peso) || 0; } },
 { key: 'maiorPeca',   label: 'Maior peça (mm)', type: 'number', getValue: function(ds) { return parseFloat(ds.maiorPeca) || 0; } },
 { key: 'valor',       label: 'Valor',         type: 'number', getValue: function(ds) { return parseFloat(ds.valor) || 0; } },
 // Pedido explícito: ordenar pelas entregas com alteração mais recente
 // primeiro. type:'number' (não 'date') porque o valor é um timestamp com
 // hora (epoch ms, ver alteradoEmTs em _entPseudoDataset) — 'date' assume
 // só o dia. Ordenar "desc" traz as alteradas por último no topo.
 { key: 'alteradoEm',  label: 'Última alteração', type: 'number', getValue: function(ds) { return ds.alteradoEmTs; } },
];
_sbInit('entregas', _entSbFields, _entApplyFilters);

// Agrupamento — até 4 níveis (todos os campos disponíveis). Campos pedidos
// originalmente: Cidade/Estado/Status/Transporte; adicionados depois:
// Entrega/Valor/Faturamento/Quantidade/Peso/Maior peça, e — pedido
// explícito separado — Obra/Empresa/Etapa da entrega, cujo dado já vinha
// carregado em todo `e` (ver _entPseudoDataset logo abaixo: e.obra.nome,
// e.obra.empresas_obras[0].empresa.nome, e.etapa cru), só faltava
// aparecer aqui. 'status' continua existindo à parte (bucket de 4 valores
// fixos, ver _entBucketFor) — 'etapa' é o valor cru (7 valores reais, mais
// granular). _entRenderGroupNode já é recursivo desde sempre
// (_gtBuildTree), só o maxLevels travava em 1.
var _entGroupCollapsed = {};
function _entGroupKeyFor(e, field) {
 if (field === 'status')      return { key: _entBucketLabel[_entBucketFor(e.etapa)], sortKey: ['aguardando','producao','transporte','entregue'].indexOf(_entBucketFor(e.etapa)) };
 if (field === 'etapa')       return { key: e.etapa || '— Sem etapa', sortKey: null };
 if (field === 'cidade')      return { key: _entCidadeSoNome(e) || '— Sem cidade', sortKey: null };
 if (field === 'estado') {
  var uf = (e.obra && e.obra.estado) || e.estado || '';
  return { key: uf ? uf.toUpperCase() : '— Sem estado', sortKey: null };
 }
 if (field === 'transporte')  return { key: e.transporte || '— Sem transporte', sortKey: null };
 if (field === 'nomeEntrega') return { key: e.nome_entrega || '— Sem nome', sortKey: null };
 if (field === 'dataFat')     return { key: e.data_faturamento ? new Date(e.data_faturamento+'T00:00:00').toLocaleDateString('pt-BR') : '— Sem data', sortKey: e.data_faturamento || '' };
 if (field === 'quantidade')  return { key: e.quantidade != null ? String(e.quantidade) : '— Sem quantidade', sortKey: e.quantidade || 0 };
 if (field === 'peso')        return { key: e.peso_kg != null ? Number(e.peso_kg).toLocaleString('pt-BR') + ' kg' : '— Sem peso', sortKey: e.peso_kg || 0 };
 if (field === 'maiorPeca')   return { key: e.maior_peca_mm != null ? Number(e.maior_peca_mm).toLocaleString('pt-BR') + ' mm' : '— Sem maior peça', sortKey: e.maior_peca_mm || 0 };
 if (field === 'valor')       return { key: e.valor != null ? _entFmtBRL(e.valor) : '— Sem valor', sortKey: e.valor || 0 };
 if (field === 'obra')        return { key: (e.obra && e.obra.nome) || '— Sem obra', sortKey: null };
 if (field === 'empresa') {
  var emp = (e.obra && e.obra.empresas_obras && e.obra.empresas_obras[0] && e.obra.empresas_obras[0].empresa && e.obra.empresas_obras[0].empresa.nome) || '';
  return { key: emp || '— Sem empresa', sortKey: null };
 }
 return { key: '— Sem grupo', sortKey: null };
}
_gbInit('entregas', [
 { key: 'obra',        label: 'Obra' },
 { key: 'empresa',     label: 'Empresa' },
 { key: 'cidade',      label: 'Cidade' },
 { key: 'estado',      label: 'Estado' },
 { key: 'status',      label: 'Status' },
 { key: 'etapa',       label: 'Etapa da entrega' },
 { key: 'transporte',  label: 'Transporte' },
 { key: 'nomeEntrega', label: 'Entrega' },
 { key: 'dataFat',     label: 'Faturamento' },
 { key: 'quantidade',  label: 'Quantidade' },
 { key: 'peso',        label: 'Peso' },
 { key: 'maiorPeca',   label: 'Maior peça' },
 { key: 'valor',       label: 'Valor' },
], _entApplyFilters, 3);

// Edição inline (scripts/lib/inline-edit.js) — clique na célula edita direto
// na tabela, sem precisar abrir o painel de detalhamento (que continua
// existindo pra anexos/histórico/campos menos usados). onSave de cada campo
// reaproveita _spEntDetSalvarCampo, a MESMA função que o painel lateral já
// usa (trigger de auditoria/updated_at do banco cuida do resto — não duplica
// nada aqui). getRow busca o valor atual em _entregasArr pelo id, não em
// dataset — assim o editor sempre abre com o dado real, mesmo depois de
// reordenar/filtrar.
function _entFindById(id) { return (_entregasArr || []).find(function(x){ return String(x.id) === String(id); }); }
_ieRegister('entregas', {
 etapa: {
  type: 'select', label: 'Etapa', options: function(){ return Object.keys(_entEtapaBucket); }, getRow: _entFindById,
  onSave: function(id, val, opts) { return _spEntDetSalvarCampo(id, { etapa: val || null }, opts); },
 },
 transporte: {
  type: 'select', label: 'Transporte', options: function(){ return _obraTransporteCache || []; }, getRow: _entFindById,
  onSave: function(id, val, opts) {
   if (val && (_obraTransporteCache||[]).indexOf(val) === -1) _obraTransporteCache.push(val);
   return _spEntDetSalvarCampo(id, { transporte: val || null }, opts);
  },
 },
 data_faturamento: {
  type: 'date', label: 'Faturamento', getRow: _entFindById,
  onSave: function(id, val, opts) { return _spEntDetSalvarCampo(id, { data_faturamento: val || null }, opts); },
 },
 quantidade: {
  type: 'number', label: 'Quantidade', getRow: _entFindById, parse: function(raw){ return raw === '' ? null : Number(raw); },
  onSave: function(id, val, opts) { return _spEntDetSalvarCampo(id, { quantidade: val }, opts); },
 },
 peso_kg: {
  type: 'number', label: 'Peso', getRow: _entFindById, parse: function(raw){ return raw === '' ? null : Number(raw); },
  onSave: function(id, val, opts) { return _spEntDetSalvarCampo(id, { peso_kg: val }, opts); },
 },
 maior_peca_mm: {
  type: 'number', label: 'Maior peça', getRow: _entFindById, parse: function(raw){ return raw === '' ? null : Number(raw); },
  onSave: function(id, val, opts) { return _spEntDetSalvarCampo(id, { maior_peca_mm: val }, opts); },
 },
 valor: {
  type: 'number', label: 'Valor', getRow: _entFindById, parse: function(raw){ return raw === '' ? null : Number(raw); },
  onSave: function(id, val, opts) { return _spEntDetSalvarCampo(id, { valor: val }, opts); },
 },
}, _entRefreshAfterInlineEdit);

// _entApplyFilters, no modo SEM agrupamento, só reordena/mostra-esconde as
// <tr> que já existem no DOM usando o dataset delas (achado real: não
// reconstrói a partir de _entregasArr a menos que esteja saindo do modo
// agrupado) — depois de uma edição inline isso deixaria a célula editada
// (e o filtro, que lê o dataset) presos no valor antigo. Esta função força
// a reconstrução das linhas a partir de _entregasArr (já com o valor novo,
// gravado via Object.assign dentro de _spEntDetSalvarCampo) antes de deixar
// _entApplyFilters cuidar do resto (filtro/ordenação/badges/Kanban/Calendário).
function _entRefreshAfterInlineEdit() {
 var groupLevels = (_gbInstances.entregas && _gbInstances.entregas.state.levels) || [];
 if (groupLevels.length) { _entRenderGrouped(groupLevels); return; }
 var tbody = document.getElementById('ent-tbody');
 if (tbody) tbody.innerHTML = (_entregasArr || []).map(_entRowHTML).join('');
 _entApplyFilters();
}

function _entFmtBRL(v) { return v != null ? 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'; }

// Pseudo-dataset: mesmos campos/mesma normalização que um <tr data-*> real
// carregaria — permite _fbEvaluate/_sbCompare funcionarem idênticos com ou
// sem DOM (agrupado, Kanban, Calendário — nenhum desses tem <tr>).
function _entPseudoDataset(e) {
 var obraNome = (e.obra && e.obra.nome) || '';
 var empNome  = (e.obra && e.obra.empresas_obras && e.obra.empresas_obras[0] && e.obra.empresas_obras[0].empresa && e.obra.empresas_obras[0].empresa.nome) || '';
 return {
  status:      _entBucketFor(e.etapa),
  etapaRaw:    e.etapa || '',
  nomeEntrega: (e.nome_entrega || '').toLowerCase(),
  obra:        obraNome.toLowerCase(),
  empresa:     empNome.toLowerCase(),
  cidade:      _entCidadeUf(e).toLowerCase(),
  cidadeObra:  _entCidadeSoNome(e).toLowerCase(),
  estado:      ((e.obra && e.obra.estado) || e.estado || '').toLowerCase(),
  transporte:  (e.transporte || '').toLowerCase(),
  dataFat:     e.data_faturamento || '',
  quantidade:  e.quantidade != null ? e.quantidade : 0,
  peso:        e.peso_kg != null ? e.peso_kg : 0,
  maiorPeca:   e.maior_peca_mm != null ? e.maior_peca_mm : 0,
  valor:       e.valor != null ? e.valor : 0,
  pedidoProduzido: e.pedido_produzido ? 'sim' : 'não',
  categoria:   ((e.obra && e.obra.tipo_obra) || []).join(','),
  // Endereço de entrega virou rollup somente-leitura da Obra no painel de
  // detalhe (entregas.endereco_entrega não é mais escrito por nada da UI) —
  // o filtro tinha ficado pra trás lendo só a coluna própria da entrega,
  // que fica vazia pra qualquer entrega nova. Obra primeiro, entrega como
  // fallback (dado antigo/migrado do Airtable que ainda tenha valor lá).
  enderecoEntrega: ((e.obra && e.obra.endereco_entrega) || e.endereco_entrega || '').toLowerCase(),
  pedidoCompusaMilatec: (e.pedido_compusa_milatec || '').toLowerCase(),
  pedidoCompusaMila:    (e.pedido_compusa_mila || '').toLowerCase(),
  notaFiscal:  (_entDocEntregaIds && _entDocEntregaIds[e.id]) ? 'sim' : 'não',
  contatoOrcamento: ((_entContatoOrcamentoMap && e.obra_id && _entContatoOrcamentoMap[e.obra_id]) || '').toLowerCase(),
  criadoPor:   (typeof _projAuditNome === 'function' ? _projAuditNome(e.criado_por) : (e.criado_por || '—')).toLowerCase(),
  alteradoPor: (typeof _projAuditNome === 'function' ? _projAuditNome(e.atualizado_por) : (e.atualizado_por || '—')).toLowerCase(),
  horarioCriacao: e.created_at ? String(e.created_at).slice(0, 10) : '',
  // Timestamp bruto (epoch ms), não string 'YYYY-MM-DD' — updated_at do
  // Postgres vem com hora (trigger de auditoria já existente, ver
  // set_entregas_atualizado_por no banco), e o comparador type:'date' do
  // sort-builder assume só data (concatena 'T00:00:00' na string). 0 pra
  // "nunca alterado" (não deveria acontecer, updated_at tem default no
  // banco) em vez de Infinity, pra não aparecer como "mais recente" à toa.
  alteradoEmTs: e.updated_at ? new Date(e.updated_at).getTime() : 0,
 };
}
function _entSearchHaystack(e) {
 var obraNome = (e.obra && e.obra.nome) || '';
 var empNome  = (e.obra && e.obra.empresas_obras && e.obra.empresas_obras[0] && e.obra.empresas_obras[0].empresa && e.obra.empresas_obras[0].empresa.nome) || '';
 return [e.nome_entrega, obraNome, empNome, _entCidadeUf(e), e.transporte].filter(Boolean).join(' ');
}

// "Atrasado" — botão de um clique fora do popover de Filtro (mesmo padrão já
// aplicado ao Gestor de Tarefas: é um cálculo do sistema, não um valor de
// campo, então não faz sentido como condição do filtro-builder).
var _entSomenteAtrasadas = false;
function _entToggleAtrasadas() {
 _entSomenteAtrasadas = !_entSomenteAtrasadas;
 var btn = document.getElementById('ent-btn-atrasadas');
 if (btn) btn.classList.toggle('active', _entSomenteAtrasadas);
 _entApplyFilters();
}

// ── Abas de atalho (quick-view), estilo Airtable — mesma ideia de
// "Filtrar" pré-programado que _gestorPreset já usa pro Período do Gestor
// de Tarefas, adaptada aqui pra escrever direto as condições do
// filtro-builder (o popover de Filtro continua 100% editável depois).
// Definições escolhidas (sem equivalente 1:1 no pedido original, então
// documentadas aqui e no relatório):
//  - "A realizar"          → status ≠ Entregue (ainda não chegou no cliente)
//  - "A programar"         → Faturamento vazio (ainda sem data marcada)
//  - "Entregas esse ano"   → Faturamento entre 01/01 e 31/12 do ano atual
//  - "2 semanas"           → Faturamento entre hoje e hoje+14 dias
//  - "Todas as entregas"   → limpa o filtro (mantém agrupamento/ordenação)
function _entFmtDateISO(d) { return d.toISOString().slice(0,10); }
// Definições EXATAS da referência (Airtable, conferidas campo a campo pela
// dona do sistema — cada filtro rápido replica ali as mesmas condições, não
// uma aproximação). O campo 'status' do filtro-builder guarda a etapa CRUA
// (getValue: ds.etapaRaw, ver _entFbFields acima — ex.: "Entrega realizada",
// "Produção"), então os valores abaixo são exatamente o texto da etapa, não
// a chave do balde interno ("entregue"/"producao"/...) — comparar com a
// chave do balde foi o bug original (nunca batia com etapa nenhuma).
function _entQuickPreset(name, btn) {
 var inst = _fbInstances.entregas;
 var conds = [];
 if (name === 'a-realizar') {
  // Tudo que ainda precisa de ação até a entrega chegar no cliente — as
  // 5 etapas entre as duas pontas (Aprovação de projeto, que ainda nem
  // começou a fase de produção/entrega, e Entrega realizada, já concluída,
  // ficam de fora).
  conds = [{ id:'qv1', field:'status', operator:'anyof',
   value: ['Programar entrega', 'Liberar produção', 'Produção', 'Pedido produzido', 'Em transporte'] }];
 } else if (name === 'a-programar') {
  // Só isso — nenhuma condição de etapa. Data de faturamento vazia é o
  // critério inteiro (uma entrega realizada, na prática, sempre tem essa
  // data preenchida; se não tiver, é dado incompleto, não motivo pra um
  // filtro de status aqui).
  conds = [{ id:'qv1', field:'dataFat', operator:'empty', value:'' }];
 } else if (name === 'ano') {
  var y = new Date().getFullYear();
  conds = [
   { id:'qv1', field:'status', operator:'anyof', value: ['Em transporte', 'Entrega realizada'] },
   // "a partir de 1/1/{ano}, sem limite superior" — o tipo 'date' do
   // filtro-builder só tem eq/before/after/between (nenhum ">=" pronto);
   // 'between' com uma data bem distante no futuro reproduz exatamente
   // "on or after" sem precisar mexer no filtro-builder compartilhado.
   { id:'qv2', field:'dataFat', operator:'between', value: [y + '-01-01', '2099-12-31'] },
  ];
 } else if (name === '2semanas') {
  // Janela de 2 semanas CENTRADA em hoje (uma semana atrás até uma semana à
  // frente) — não "hoje até hoje+14".
  var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  var ini = new Date(hoje); ini.setDate(ini.getDate() - 7);
  var fim = new Date(hoje); fim.setDate(fim.getDate() + 7);
  conds = [{ id:'qv1', field:'dataFat', operator:'between', value: [_entFmtDateISO(ini), _entFmtDateISO(fim)] }];
 } // 'todas' → conds fica [] (mostra tudo, inclusive já realizadas — é o propósito desta aba)
 inst.state.conditions = conds;
 inst.state.logic = 'AND'; // os filtros rápidos sempre combinam condições com E, nunca OU
 document.querySelectorAll('.ent-qv-btn').forEach(function(b){ b.classList.remove('active'); });
 if (btn) btn.classList.add('active');
 _fbRender('entregas');
 _fbApply('entregas');
}

function _entApplyFilters() {
 var groupLevels = (_gbInstances.entregas && _gbInstances.entregas.state.levels) || [];
 if (groupLevels.length) { _entRenderGrouped(groupLevels); return; }

 // Saindo do modo agrupado: remove cabeçalhos de grupo inseridos por
 // _entRenderGrouped antes de operar sobre as <tr data-id> normais (mesmo
 // esquema de _obrasApplyFilters/_empApplyFilters).
 var tbody0 = document.getElementById('ent-tbody');
 if (tbody0 && tbody0.querySelector('tr.gestor-group-hd')) {
  tbody0.innerHTML = (_entregasArr || []).map(_entRowHTML).join('');
 }

 var buscaNorm = _ssNormalize(((document.getElementById('ent-search') || {}).value || '').trim());
 var activeConds = _fbInstances.entregas.state.conditions.filter(_fbConditionIsUsable).length;
 var rows = Array.prototype.slice.call(document.querySelectorAll('#ent-tbody tr[data-id]'));
 var visivel = 0;
 rows.forEach(function(tr) {
  var ok = _fbEvaluate(tr.dataset, 'entregas');
  if (ok && _entSomenteAtrasadas) ok = tr.dataset.atrasado === '1';
  if (ok && buscaNorm) ok = _ssMatch(_ssNormalize(tr.textContent), buscaNorm);
  tr.style.display = ok ? '' : 'none';
  if (ok) visivel++;
 });
 if (rows.length) {
  rows.sort(function(a, b) { return _sbCompare(a.dataset, b.dataset, 'entregas'); });
  var tbody = rows[0].parentElement;
  rows.forEach(function(tr) { tbody.appendChild(tr); });
 }
 var fbBadge = document.getElementById('fb-badge-entregas');
 if (fbBadge) { fbBadge.textContent = activeConds; fbBadge.style.display = activeConds ? '' : 'none'; }
 var countEl = document.getElementById('ent-filter-count');
 if (countEl) {
  if (activeConds || buscaNorm || _entSomenteAtrasadas) { countEl.textContent = visivel + (visivel === 1 ? ' resultado' : ' resultados'); countEl.style.display = 'inline'; }
  else { countEl.style.display = 'none'; }
 }
 // Kanban/Calendário reagem ao mesmo filtro/busca/agrupamento — chamados
 // sempre (baixo custo: nenhuma das duas views toca o DOM se não estiver visível).
 _entRenderKanbanIfVisible();
 _entRenderCalIfVisible();
 // Tempo real só depois que a lista carregou; idempotente por chave, então
 // voltar pra esta aba não cria um 2º handler.
 _entregasIniciarTempoReal();
}

// ── Lista filtrada+ordenada em memória — usada por Kanban/Calendário (que
// não têm <tr> pra esconder/mostrar) e pelo modo agrupado da Tabela. ────────
function _entFilteredSorted() {
 var buscaNorm = _ssNormalize(((document.getElementById('ent-search') || {}).value || '').trim());
 var filtered = (_entregasArr || []).filter(function(e) {
  var ds = _entPseudoDataset(e);
  var ok = _fbEvaluate(ds, 'entregas');
  if (ok && _entSomenteAtrasadas) ok = _entIsLate(e);
  if (ok && buscaNorm) ok = _ssMatch(_ssNormalize(_entSearchHaystack(e)), buscaNorm);
  return ok;
 });
 filtered.sort(function(a, b) { return _sbCompare(_entPseudoDataset(a), _entPseudoDataset(b), 'entregas'); });
 return filtered;
}

// ── Agrupamento da Tabela (mesmo esquema de _empRenderGrouped/_cttRenderGrouped
// em empresas.js) ────────────────────────────────────────────────────────────
function _entToggleGroup(key) {
 _entGroupCollapsed[key] = !_entGroupCollapsed[key];
 _entApplyFilters();
}
function _entRenderGroupNode(node, path, rowsArr) {
 if (node.leaf) {
  node.items.forEach(function(e) { rowsArr.push(_entRowHTML(e)); });
  return;
 }
 node.order.forEach(function(k) {
  var child = node.children[k];
  var nodePath = 'entregas::' + path.concat(k).join(' :: ');
  var isCollapsed = !!_entGroupCollapsed[nodePath];
  var total = _gtTreeCount(child);
  var indent = 12 + path.length * 20; // indentação por nível — antes fixa em 12px, ilegível com 2+ níveis
  // Transporte tem cor própria (item obrigatório do pedido) — o cabeçalho
  // de grupo usa a MESMA regra de cor (_entTransporteBadgeCls) que a
  // coluna Transporte da tabela, pra não haver duas fontes de verdade.
  var _entGrupoCls = node.field === 'transporte' ? _entTransporteBadgeCls(k) : null;
  // Somas do grupo (Quantidade/Peso/Valor) — pedido explícito, mesma coisa
  // que o Airtable mostra no cabeçalho de cada grupo ("Sum 69" etc.).
  // _gtTreeSum já soma recursivamente, então um grupo pai mostra a soma de
  // TODOS os filhos, não só do nível dele.
  var sQtd = _gtTreeSum(child, function(e){ return e.quantidade; });
  var sPeso = _gtTreeSum(child, function(e){ return e.peso_kg; });
  var sValor = _gtTreeSum(child, function(e){ return e.valor; });
  var sumsHTML = '<span style="margin-left:10px;font-size:10.5px;color:var(--muted);font-weight:400">'
   + 'Qtd ' + sQtd.toLocaleString('pt-BR') + ' · Peso ' + sPeso.toLocaleString('pt-BR') + 'kg · ' + _entFmtBRL(sValor)
   + '</span>';
  rowsArr.push(
   '<tr class="' + _gtGroupClass(path.length) + '" onclick="_entToggleGroup(\'' + nodePath.replace(/'/g, "\\'") + '\')">'
   + '<td colspan="10" style="padding-left:' + indent + 'px">'
   + '<span style="margin-right:4px">' + (isCollapsed ? '▶' : '▼') + '</span>'
   + _gtGroupLabelHTML(k, _entGrupoCls)
   + _gtCountBadgeHTML(total, 'entrega' + (total !== 1 ? 's' : ''))
   + sumsHTML
   + '</td></tr>'
  );
  if (!isCollapsed) _entRenderGroupNode(child, path.concat(k), rowsArr);
 });
}
function _entRenderGrouped(levels) {
 var tbody = document.getElementById('ent-tbody');
 if (!tbody) return;
 var filtered = _entFilteredSorted();
 var tree = _gtBuildTree(filtered, levels, _entGroupKeyFor, null, 0);
 var rowsArr = [];
 _entRenderGroupNode(tree, [], rowsArr);
 tbody.innerHTML = rowsArr.length ? rowsArr.join('') : '<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:32px;font-size:13px">Nenhuma entrega encontrada.</td></tr>';

 var fbBadge = document.getElementById('fb-badge-entregas');
 var activeConds = _fbInstances.entregas.state.conditions.filter(_fbConditionIsUsable).length;
 if (fbBadge) { fbBadge.textContent = activeConds; fbBadge.style.display = activeConds ? '' : 'none'; }
 var countEl = document.getElementById('ent-filter-count');
 if (countEl) {
  var buscaNorm = _ssNormalize(((document.getElementById('ent-search') || {}).value || '').trim());
  if (activeConds || buscaNorm || _entSomenteAtrasadas) { countEl.textContent = filtered.length + (filtered.length === 1 ? ' resultado' : ' resultados'); countEl.style.display = 'inline'; }
  else { countEl.style.display = 'none'; }
 }
 _entRenderKanbanIfVisible();
 _entRenderCalIfVisible();
}

// ── Visualizações salvas (saved-views.js) — mesma mecânica de Obras
// (_vwInit('obras',...)), gravando modulo='entregas' na gestor_views. ───────
_vwInit('entregas', {
 modulo: 'entregas',
 getState: function() {
  return {
   filtro: _fbInstances.entregas ? _fbInstances.entregas.state : { logic: 'AND', conditions: [] },
   sort:   _sbInstances.entregas ? _sbInstances.entregas.state : { levels: [] },
   group:  _gbInstances.entregas ? _gbInstances.entregas.state : { levels: [] },
  };
 },
 applyState: function(state) {
  if (_sbInstances.entregas) { _sbInstances.entregas.state = state.sort || { levels: [] }; _sbRender('entregas'); }
  if (_gbInstances.entregas) { _gbInstances.entregas.state = state.group || { levels: [] }; _gbRender('entregas'); }
  if (_fbInstances.entregas) { _fbInstances.entregas.state = state.filtro || { logic: 'AND', conditions: [] }; _fbRender('entregas'); _fbApply('entregas'); }
  document.querySelectorAll('.ent-qv-btn').forEach(function(b){ b.classList.remove('active'); });
  _entApplyFilters();
 }
});

// ── Vistas: Tabela / Kanban / Calendário ────────────────────────────────────
function setEntView(v) {
 document.getElementById('ent-view-tabela').style.display    = v === 'tabela'    ? '' : 'none';
 document.getElementById('ent-view-kanban').style.display    = v === 'kanban'    ? '' : 'none';
 document.getElementById('ent-view-calendario').style.display = v === 'calendario' ? '' : 'none';
 // .vt-btn — mesmo toggle visual de Tabela/Kanban de Obras/Projetos
 // (.view-toggle/.vt-btn), 3 opções em vez de 2.
 document.getElementById('ent-btn-tabela').className     = 'vt-btn' + (v === 'tabela'    ? ' active' : '');
 document.getElementById('ent-btn-kanban').className     = 'vt-btn' + (v === 'kanban'    ? ' active' : '');
 document.getElementById('ent-btn-calendario').className = 'vt-btn' + (v === 'calendario' ? ' active' : '');
 if (v === 'kanban') _entRenderKanban();
 if (v === 'calendario') renderEntCal();
}
function _entRenderKanbanIfVisible() {
 var el = document.getElementById('ent-view-kanban');
 if (el && el.style.display !== 'none') _entRenderKanban();
}
function _entRenderCalIfVisible() {
 var el = document.getElementById('ent-view-calendario');
 if (el && el.style.display !== 'none') renderEntCal();
}

// ── KANBAN — mesmo esquema visual do Kanban de Obras (kanban-obras/kanban-col/
// kc-body/kc-count, ver _dbLoadObrasKanban em obras.js), 4 colunas fixas pelos
// buckets de status reais. Cards reaproveitam .obra-card/.oc-title/.oc-tags/
// .oc-date do design já existente — sem inventar linguagem visual nova.
var _entKcId = { aguardando:'ent-kc-aguardando', producao:'ent-kc-producao', transporte:'ent-kc-transporte', entregue:'ent-kc-entregue' };
function _entCardHTML(e) {
 var bucket = _entBucketFor(e.etapa);
 var atrasado = _entIsLate(e);
 var obraNome = (e.obra && e.obra.nome) || '';
 var dt = e.data_faturamento ? new Date(e.data_faturamento+'T00:00:00').toLocaleDateString('pt-BR') : '';
 var etapaCls = atrasado ? BADGE_ETAPA_ENTREGA_BUCKET_CLS.atrasado : (BADGE_ETAPA_ENTREGA_BUCKET_CLS[bucket] || 'bm');
 return '<div class="obra-card ent-card" data-id="' + e.id + '" onclick="_spEntregaById(\'' + e.id + '\')">'
  + (atrasado ? '<span class="ent-card-late" title="Faturamento vencido">Atrasado</span>' : '')
  + '<div class="oc-title">' + (e.nome_entrega || 'Entrega sem nome') + '</div>'
  + (obraNome ? '<div style="font-size:11px;color:var(--muted);margin-top:3px">' + obraNome + '</div>' : '')
  + '<div class="oc-tags">'
  + (e.etapa ? '<span class="badge ' + etapaCls + '" style="font-size:10px">' + e.etapa + '</span>' : '')
  + (e.transporte ? '<span class="badge ' + _entTransporteBadgeCls(e.transporte) + '" style="font-size:10px">' + e.transporte + '</span>' : '')
  + '</div>'
  + (dt ? '<div class="oc-date">Faturamento ' + dt + '</div>' : '')
  + '</div>';
}
function _entRenderKanban() {
 var filtered = _entFilteredSorted();
 var buckets = { aguardando:[], producao:[], transporte:[], entregue:[] };
 filtered.forEach(function(e) { buckets[_entBucketFor(e.etapa)].push(e); });
 Object.keys(_entKcId).forEach(function(bucket) {
  var col = document.getElementById(_entKcId[bucket]);
  if (!col) return;
  var body = col.querySelector('.kc-body');
  var count = col.querySelector('.kc-count');
  if (body) body.innerHTML = buckets[bucket].map(_entCardHTML).join('') || '<div style="font-size:11px;color:var(--muted);padding:8px 2px">Nenhuma entrega</div>';
  if (count) count.textContent = buckets[bucket].length;
 });
}

// ── CALENDÁRIO — antes usava _entEvents (array mockado com nomes/datas
// fictícios); agora lê _entregasArr de verdade. Único campo de data real da
// tabela é `data_faturamento` — os "3 tipos de evento" (produção/expedição/
// entrega) do mock não têm 3 campos reais por trás, então o calendário passa
// a mostrar 1 evento por entrega (na data de faturamento), colorido pelo
// status real (bucket), preservando a estrutura de grid/navegação existente.
var _entCalYear  = new Date().getFullYear();
var _entCalMonth = new Date().getMonth();
var _ptMonths = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                 'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
var _ptDows   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

// Cor do evento no Calendário — por STATUS (bucket), não mais por
// Transporte: a legenda sempre prometeu "cor = status" (4 chips fixos,
// Aguardando/Em produção/Em transporte/Entregue), mas o evento renderizava
// com uma cor hash de Transporte, sem nenhuma relação com a legenda — bug
// real reportado ("legenda não bate com a cor do evento"). Reaproveita
// _entBucketCor (mesmas 4 cores da Tabela/Kanban), não uma paleta própria.
function _entEventColor(e) {
 var atrasado = _entIsLate(e);
 return atrasado ? _entBucketCor.atrasado : _entBucketCor[_entBucketFor(e.etapa)];
}
function _entCalEventHTML(e) {
 var cor = _entEventColor(e);
 var label = e.nome_entrega || (e.obra && e.obra.nome) || 'Entrega';
 var shortLabel = label.length > 28 ? label.substring(0, 28) + '…' : label;
 var tTitle = label + ' — ' + (e.etapa || '') + (e.transporte ? (' — ' + e.transporte) : '');
 return '<div class="ent-cal-event" style="background:' + cor + '22;color:' + cor + '" title="' + tTitle.replace(/"/g,'&quot;') + '" onclick="event.stopPropagation();_spEntregaById(\'' + e.id + '\')">' + shortLabel + '</div>';
}

// Seletor de período (Dia/3 dias/Semana/Customizado) — mesmo componente
// genérico de Obras (period-picker.js/_ppInit), instância própria 'entcal'.
// Preset padrão 'todas' é rotulado "Mês" na UI e mantém o grid mensal
// original (_entCalMonth/_entCalYear); os outros presets trocam pro modo de
// intervalo (ver renderEntCal/_entCalRenderRange abaixo).
_ppInit('entcal', { onChange: function(){ renderEntCal(); }, defaultPreset: 'todas' });

function entCalNav(dir) {
  var st = _ppGetState('entcal');
  if (st.preset === 'todas') {
    _entCalMonth += dir;
    if (_entCalMonth > 11) { _entCalMonth = 0; _entCalYear++; }
    if (_entCalMonth < 0)  { _entCalMonth = 11; _entCalYear--; }
    renderEntCal();
    return;
  }
  // Modo intervalo — desloca o range inteiro pela sua própria duração (Dia:
  // ±1 dia; 3 dias/Semana/Customizado: ±duração do range), preservando o
  // preset ativo (não volta pro grid mensal sozinho).
  var diasRange = Math.round((st.fim - st.ini) / 86400000) + 1;
  var novaIni = new Date(st.ini); novaIni.setDate(novaIni.getDate() + dir * diasRange);
  var novaFim = new Date(st.fim); novaFim.setDate(novaFim.getDate() + dir * diasRange);
  _ppInstances.entcal.state = { ini: novaIni, fim: novaFim, preset: st.preset };
  if (typeof _ppSetInputDates === 'function') _ppSetInputDates('entcal', novaIni, novaFim);
  renderEntCal();
}

// Grid mensal completo (comportamento original, preset 'todas'/"Mês").
function _entCalRenderMonth() {
  var label = document.getElementById('ent-cal-label');
  if (label) label.textContent = _ptMonths[_entCalMonth] + ' ' + _entCalYear;

  var grid = document.getElementById('ent-cal-grid');
  var filtered = _entFilteredSorted();
  var byDate = {};
  filtered.forEach(function(e) {
   if (!e.data_faturamento) return;
   (byDate[e.data_faturamento] = byDate[e.data_faturamento] || []).push(e);
  });

  var html = '';
  _ptDows.forEach(function(d) {
    html += '<div class="ent-cal-dow">' + d + '</div>';
  });

  var firstDay = new Date(_entCalYear, _entCalMonth, 1).getDay(); // 0=Sun
  var daysInMonth = new Date(_entCalYear, _entCalMonth + 1, 0).getDate();
  var prevDays = new Date(_entCalYear, _entCalMonth, 0).getDate();

  var today = new Date();
  var todayStr = today.getFullYear() + '-'
    + String(today.getMonth()+1).padStart(2,'0') + '-'
    + String(today.getDate()).padStart(2,'0');

  for (var i = firstDay - 1; i >= 0; i--) {
    html += '<div class="ent-cal-day other-month"><div class="ent-cal-daynum">' + (prevDays - i) + '</div></div>';
  }

  for (var d = 1; d <= daysInMonth; d++) {
    var dateStr = _entCalYear + '-'
      + String(_entCalMonth + 1).padStart(2,'0') + '-'
      + String(d).padStart(2,'0');
    var isToday = dateStr === todayStr;
    var dayEvents = byDate[dateStr] || [];

    html += '<div class="ent-cal-day' + (isToday ? ' today' : '') + '">';
    html += '<div class="ent-cal-daynum">' + d + '</div>';
    dayEvents.forEach(function(e) { html += _entCalEventHTML(e); });
    html += '</div>';
  }

  var total = firstDay + daysInMonth;
  var remaining = (7 - (total % 7)) % 7;
  for (var n = 1; n <= remaining; n++) {
    html += '<div class="ent-cal-day other-month"><div class="ent-cal-daynum">' + n + '</div></div>';
  }

  grid.className = 'ent-cal-grid';
  grid.style.gridTemplateColumns = '';
  grid.innerHTML = html;
}

// Intervalo curto (Dia/3 dias/Semana/Customizado) — grade de N colunas (1 a
// N dias), sem células "other-month" (não faz sentido fora do grid mensal):
// cada coluna é o próprio dia, com seu rótulo de data completo (dia da
// semana + dia/mês) já que não há cabeçalho de dow fixo cobrindo o mês todo.
function _entCalRenderRange(ini, fim) {
  var label = document.getElementById('ent-cal-label');
  var grid = document.getElementById('ent-cal-grid');
  var filtered = _entFilteredSorted();
  var byDate = {};
  filtered.forEach(function(e) {
   if (!e.data_faturamento) return;
   (byDate[e.data_faturamento] = byDate[e.data_faturamento] || []).push(e);
  });

  var dias = [];
  var d = new Date(ini);
  while (d <= fim) { dias.push(new Date(d)); d.setDate(d.getDate() + 1); }

  if (label) {
   label.textContent = dias.length === 1
    ? ini.toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' })
    : ini.toLocaleDateString('pt-BR', { day:'2-digit', month:'short' }) + ' – ' + fim.toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' });
  }

  var today = new Date(); today.setHours(0,0,0,0);
  var html = '';
  dias.forEach(function(dt) {
    var dateStr = _entFmtDateISO(dt);
    var isToday = dt.getTime() === today.getTime();
    var dayEvents = byDate[dateStr] || [];
    html += '<div class="ent-cal-dow">' + _ptDows[dt.getDay()] + ' ' + String(dt.getDate()).padStart(2,'0') + '/' + String(dt.getMonth()+1).padStart(2,'0') + '</div>';
  });
  grid.style.gridTemplateColumns = 'repeat(' + dias.length + ',1fr)';
  grid.innerHTML = html; // linha de cabeçalho (dow + data) primeiro, igual ao grid mensal
  html = '';
  dias.forEach(function(dt) {
    var dateStr = _entFmtDateISO(dt);
    var isToday = dt.getTime() === today.getTime();
    var dayEvents = byDate[dateStr] || [];
    html += '<div class="ent-cal-day' + (isToday ? ' today' : '') + '">';
    html += dayEvents.length
     ? dayEvents.map(_entCalEventHTML).join('')
     : '<div style="font-size:11px;color:var(--muted);padding:6px 2px">Nenhuma entrega</div>';
    html += '</div>';
  });
  grid.className = 'ent-cal-grid';
  grid.insertAdjacentHTML('beforeend', html);
}

function renderEntCal() {
  var grid = document.getElementById('ent-cal-grid');
  if (!grid) return;
  var st = _ppGetState('entcal');
  if (st.preset === 'todas' || !st.ini || !st.fim) { _entCalRenderMonth(); return; }
  _entCalRenderRange(st.ini, st.fim);
}

var _entregasArr = [];

function _spEntregas(row, tds) {
 _spEntregaById(row.dataset.id);
}

// ── Renderer: Entrega por id ────────────────────────────────────────────────
function _spEntregaById(id) {
 if (!id) return;
 // Chamada direta (card de Kanban/evento de calendário), sem passar por
 // _spOpen — precisa se anunciar pra pilha de navegação (ver
 // _spTrackDirectOpen em side-panel.js) ANTES do atalho de cache abaixo,
 // já que na prática é esse atalho que roda quando vem do Kanban/
 // calendário (a lista já está carregada em memória).
 if (typeof _spTrackDirectOpen === 'function') _spTrackDirectOpen('entregas', id);
 // Ambos os ramos (cache-hit e fetch-do-banco) precisam abrir o drawer —
 // antes só o ramo de fetch adicionava .sp-open, então clicar num card já
 // carregado em memória (o caso comum vindo do Kanban/Calendário, onde a
 // lista inteira já está em _entregasArr) rodava o render mas o painel
 // continuava invisível (mesmo bug já corrigido em _spProjetoById).
 document.getElementById('sp-overlay').classList.add('sp-open');
 document.getElementById('sp-drawer').classList.add('sp-open');
 var e = (_entregasArr || []).find(function(x){ return String(x.id) === String(id); });
 if (e) { _spEntregaRender(e); return; }

 _spSet('Entrega', 'Carregando...', '<div style="padding:40px;text-align:center;color:var(--muted)">Buscando dados...</div>', '');
 if (!_sb) return;
 _sb.from('entregas').select('*, obra:obra_id(nome, cidade, estado, tipo_obra, endereco_entrega, created_at, etapa_negocio, empresas_obras(empresa:empresa_id(nome))), entregas_obras(obra_id, obra:obra_id(id,nome,cidade,estado))').eq('id', id).single().then(function(res) {
  if (res.error || !res.data) {
   _spSet('Entrega', 'Erro', '<div style="color:var(--red);padding:20px">Entrega não encontrada.</div>', '');
   return;
  }
  _spEntregaRender(res.data);
 });
}

// Entrega atualmente aberta no painel — autosave/chips/dropdowns lêem daqui
// (mesmo padrão de _obraAtiva/_spProjAtivo em obras.js/projetos.js).
var _spEntAtiva = null;

// Rótulos amigáveis dos campos de Entrega — o MESMO mapa alimenta o histórico
// de alterações e a mensagem de conflito de concorrência, pra os dois nunca
// divergirem. Rótulo null = campo técnico, fora do histórico.
var _ENT_CAMPO_LABEL = {
 nome_entrega: 'Entrega', etapa: 'Status', data_faturamento: 'Data de faturamento',
 quantidade: 'Quantidade', peso_kg: 'Peso (kg)', valor: 'Valor',
 maior_peca_mm: 'Maior peça (mm)', transporte: 'Transporte',
 pedido_produzido: 'Pedido produzido', obra_id: 'Obra vinculada',
 endereco_entrega: 'Endereço de entrega', cidade: 'Cidade', estado: 'Estado',
 nota_fiscal: 'Nota fiscal', observacoes: 'Observações',
 updated_at: null, created_at: null, criado_por: null, atualizado_por: null,
 id: null, airtable_id: null,
};
if (typeof _ccRegistrarLabels === 'function') _ccRegistrarLabels('entregas', _ENT_CAMPO_LABEL);

// ── Obras vinculadas (entregas_obras) — M:N, obra_id continua sendo a
// "obra primária" (tudo que já depende dela — Entregas de Obra, agregados
// do dashboard — continua funcionando), a junção só permite vínculos
// ADICIONAIS. Ver migração da seção 1 do plano.
function _entObrasVinculadasList(e) {
 var lista = [];
 var vistos = {};
 // e.obra (join via obra:obra_id) não traz `id` próprio (não foi pedido no
 // select) — sem isso, o chip da obra primária ficaria sem id pra navegar/
 // comparar contra e.obra_id.
 if (e.obra && e.obra_id) { lista.push(Object.assign({ id: e.obra_id }, e.obra)); vistos[e.obra_id] = 1; }
 (e.entregas_obras || []).forEach(function(l) {
  if (l.obra && l.obra_id && !vistos[l.obra_id]) { vistos[l.obra_id] = 1; lista.push(l.obra); }
 });
 return lista;
}
function _entObrasChipsHTML(e) {
 var lista = _entObrasVinculadasList(e);
 if (!lista.length) return '<div class="sp-empty">Nenhuma obra vinculada a esta entrega.</div>';
 return lista.map(function(o) {
  var isPrimaria = String(o.id) === String(e.obra_id);
  var sub = [o.cidade, o.estado].filter(Boolean).join('/');
  var subLabel = (isPrimaria ? 'Principal' : '') + (sub ? (isPrimaria ? ' · ' : '') + sub : '');
  return _spRelChipHTML('obras', o.id, o.nome || 'Obra sem nome', subLabel || null, "_entObraDesvincular('" + e.id + "','" + o.id + "')");
 }).join('');
}
var _entObrasCache = null;
async function _entCarregarObrasCache() {
 if (_entObrasCache) return _entObrasCache;
 if (!_sb) return [];
 var data = []; var from = 0; var pageSize = 1000;
 while (true) {
  var res = await _sb.from('obras').select('id,nome,cidade,estado,endereco_entrega').order('nome').range(from, from + pageSize - 1);
  if (res.error) break;
  data = data.concat(res.data || []);
  if (!res.data || res.data.length < pageSize) break;
  from += pageSize;
 }
 _entObrasCache = data;
 return data;
}
function _entObraAddMarkup() {
 return '<div class="srch-sel" id="ent-obra-add-srch" style="flex:1;margin-top:10px">'
  + '<div class="srch-sel-box" id="ent-obra-add-box" onclick="_entObraAddToggle()">'
  + '<span class="srch-sel-val placeholder" id="ent-obra-add-val">+ Vincular outra obra...</span>'
  + '<span class="srch-sel-chevron">▾</span></div>'
  + '<div class="srch-sel-drop" id="ent-obra-add-drop">'
  + '<input class="srch-sel-inp" id="ent-obra-add-inp" type="text" placeholder="Buscar obra..." oninput="_entObraAddFilter(this.value)">'
  + '<div class="srch-sel-list" id="ent-obra-add-list"></div></div></div>';
}
async function _entObraAddToggle() {
 var drop = document.getElementById('ent-obra-add-drop');
 var box = document.getElementById('ent-obra-add-box');
 if (!drop) return;
 if (drop.classList.contains('open')) { _entObraAddClose(); return; }
 await _entCarregarObrasCache();
 drop.classList.add('open'); if (box) box.classList.add('open');
 var inp = document.getElementById('ent-obra-add-inp');
 if (inp) { inp.value = ''; inp.focus(); }
 _entObraAddFilter('');
 if (typeof _srchSelPositionEl === 'function') _srchSelPositionEl(drop, box);
}
function _entObraAddClose() {
 var drop = document.getElementById('ent-obra-add-drop');
 var box = document.getElementById('ent-obra-add-box');
 if (drop) drop.classList.remove('open');
 if (box) box.classList.remove('open');
}
function _entObraAddFilter(q) {
 q = (q || '').toLowerCase();
 var list = document.getElementById('ent-obra-add-list');
 if (!list || !_spEntAtiva) return;
 var jaVinculadas = {};
 _entObrasVinculadasList(_spEntAtiva).forEach(function(o) { jaVinculadas[o.id] = 1; });
 var matches = (_entObrasCache || []).filter(function(o) { return !jaVinculadas[o.id] && (o.nome || '').toLowerCase().indexOf(q) !== -1; }).slice(0, 60);
 list.innerHTML = matches.length
  ? matches.map(function(o) { return '<div class="srch-sel-opt" onclick="_entObraVincular(\'' + o.id + '\')">' + (o.nome || '(sem nome)').replace(/</g,'&lt;') + '</div>'; }).join('')
  : '<div class="srch-sel-empty">Nenhuma obra encontrada.</div>';
}
async function _entObraVincular(obraId) {
 _entObraAddClose();
 var e = _spEntAtiva;
 if (!e || !_sb) return;
 var ins = await _sb.from('entregas_obras').insert({ entrega_id: e.id, obra_id: obraId });
 if (ins.error) {
  console.error('[Entregas] erro ao vincular obra à entrega:', ins.error);
  _showToast('Não foi possível vincular esta obra. O vínculo NÃO foi salvo — tente de novo em instantes.', 'erro');
  return;
 }
 var obraObj = (_entObrasCache || []).find(function(o) { return o.id === obraId; });
 e.entregas_obras = (e.entregas_obras || []).concat([{ obra_id: obraId, obra: obraObj }]);
 var eraAPrimeira = !e.obra_id;
 if (eraAPrimeira) {
  var upd = await _sb.from('entregas').update({ obra_id: obraId }).eq('id', e.id);
  if (!upd.error) { e.obra_id = obraId; e.obra = obraObj; }
 }
 // Endereço de entrega — pré-preenche a partir da Obra só se a entrega ainda
 // não tiver um (pedido explícito: "continua editável por entrega", não
 // sobrescreve o que já foi digitado).
 if (!e.endereco_entrega && obraObj && obraObj.endereco_entrega) {
  var updEnd = await _sb.from('entregas').update({ endereco_entrega: obraObj.endereco_entrega }).eq('id', e.id);
  if (!updEnd.error) e.endereco_entrega = obraObj.endereco_entrega;
 }
 var cached = (_entregasArr || []).find(function(x) { return String(x.id) === String(e.id); });
 if (cached) Object.assign(cached, { obra_id: e.obra_id, obra: e.obra, entregas_obras: e.entregas_obras, endereco_entrega: e.endereco_entrega });
 _spEntregaRender(e);
 if (typeof _entApplyFilters === 'function') _entApplyFilters();
}
async function _entObraDesvincular(entregaId, obraId) {
 var e = _spEntAtiva;
 if (!e || !_sb) return;
 if (!confirm('Desvincular esta obra da entrega?')) return;
 var novoObraId = e.obra_id, novoObra = e.obra;
 if (String(obraId) === String(e.obra_id)) {
  // Desvincular a obra PRIMÁRIA: promove a próxima vinculada (se houver) —
  // obra_id nunca fica "solto" apontando pra um vínculo já removido.
  var outras = (e.entregas_obras || []).filter(function(l) { return String(l.obra_id) !== String(obraId); });
  novoObraId = outras[0] ? outras[0].obra_id : null;
  novoObra = outras[0] ? outras[0].obra : null;
  var upd = await _sb.from('entregas').update({ obra_id: novoObraId }).eq('id', entregaId);
  if (upd.error) {
   console.error('[Entregas] erro ao limpar a obra primária da entrega:', upd.error);
   _showToast('Não foi possível desvincular esta obra. Nada foi alterado — tente de novo em instantes.', 'erro');
   return;
  }
 }
 var del = await _sb.from('entregas_obras').delete().eq('entrega_id', entregaId).eq('obra_id', obraId);
 if (del.error) {
  console.error('[Entregas] erro ao remover vínculo entrega↔obra:', del.error);
  _showToast('Não foi possível desvincular esta obra. O vínculo continua como estava — tente de novo em instantes.', 'erro');
  return;
 }
 e.obra_id = novoObraId; e.obra = novoObra;
 e.entregas_obras = (e.entregas_obras || []).filter(function(l) { return String(l.obra_id) !== String(obraId); });
 var cached = (_entregasArr || []).find(function(x) { return String(x.id) === String(entregaId); });
 if (cached) Object.assign(cached, { obra_id: e.obra_id, obra: e.obra, entregas_obras: e.entregas_obras });
 _spEntregaRender(e);
 if (typeof _entApplyFilters === 'function') _entApplyFilters();
}

// ── Contato do orçamento — sempre lido da Obra PRIMÁRIA vinculada via
// contatos_obras (chip somente leitura; não tem coluna própria em
// `entregas`, ver decisão documentada no plano). 1º contato da junção,
// mesma convenção de "principal" já usada pra empresas_obras/contatos_obras
// em obras.js (sem coluna is_primary própria, é sempre a 1ª linha).
async function _entCarregarContatoOrcamento(obraId) {
 var wrap = document.getElementById('sp-ent-contato-orc');
 if (!wrap) return;
 if (!obraId || !_sb) { wrap.innerHTML = '<div class="sp-empty">Nenhuma obra vinculada.</div>'; return; }
 var res = await _sb.from('contatos_obras').select('contato:contato_id(id,nome_completo,cargo)').eq('obra_id', obraId).limit(1);
 wrap = document.getElementById('sp-ent-contato-orc'); // painel pode ter trocado enquanto a busca corria
 if (!wrap) return;
 var c = res.data && res.data[0] && res.data[0].contato;
 wrap.innerHTML = c
  ? _spRelChipHTML('contatos', c.id, c.nome_completo || 'Contato', c.cargo || null)
  : '<div class="sp-empty">Nenhum contato de orçamento cadastrado na obra vinculada.</div>';
}

// ── Tipo de orçamento — coluna de `projetos` (não existe em `obras`),
// pedido explícito do Airtable ("Tipo de orçamento (from Obras)"). Não há
// vínculo direto Entrega↔Projeto nem "projeto principal" já resolvido no
// sistema — mesma convenção de "1ª linha = principal" usada pra obra/
// contato: primeiro projeto da obra principal por `created_at`.
async function _entCarregarTipoOrcamento(obraId) {
 var wrap = document.getElementById('sp-ent-tipo-orcamento');
 if (!wrap) return;
 if (!obraId || !_sb) { if (wrap) wrap.textContent = '—'; return; }
 var res = await _sb.from('projetos').select('tipo_orcamento').eq('obra_id', obraId).order('created_at').limit(1);
 wrap = document.getElementById('sp-ent-tipo-orcamento');
 if (!wrap) return;
 var tipo = res.data && res.data[0] && res.data[0].tipo_orcamento;
 wrap.innerHTML = tipo ? _badgeHTML(tipo, 'bg') : '<span style="color:var(--muted)">—</span>';
}

// ── Documentos "(from Obras)" — Proposta comercial/Pedido de Compra/
// Contrato/CNPJ & CNO no Airtable são os MESMOS documentos já anexados na
// Obra, só espelhados aqui pra visualização (pedido explícito: sem upload
// duplicado no painel de Entrega). Mesma tabela `documentos`/mapas de tipo
// já usados no painel de Obra (obras.js: _docNormTipo/_docCategoriaMapa),
// filtrando só as 4 categorias pedidas — sem os controles de upload/
// exclusão/troca de status que a Obra tem (somente leitura de verdade).
var _entDocObraEspelhoTipos = ['Proposta Comercial', 'Pedido de Compra', 'Contrato', 'CNPJ & CNO'];
async function _spCarregarDocumentosObraEspelho(obraId) {
 var wrap = document.getElementById('sp-ent-doc-obra-wrap');
 if (!wrap || !_sb) return;
 var [docRes, propRes] = await Promise.all([
  _sb.from('documentos').select('*').eq('obra_id', obraId),
  _sb.from('propostas').select('*').eq('obra_id', obraId),
 ]);
 wrap = document.getElementById('sp-ent-doc-obra-wrap');
 if (!wrap) return;
 if (docRes.error) { wrap.innerHTML = '<div class="sp-empty" style="font-size:11px;color:var(--red)">Erro ao carregar documentos da obra.</div>'; return; }
 var docs = docRes.data || [];
 // Propostas sem linha própria em `documentos` viram um card sintético —
 // mesma técnica de obras.js (_spCarregarDocumentos).
 var docsComProposta = {};
 docs.forEach(function(d) { if (d.proposta_id) docsComProposta[d.proposta_id] = 1; });
 (propRes.data || []).forEach(function(p) {
  if (docsComProposta[p.id]) return;
  docs.push({ id: 'synth-' + p.id, proposta_id: p.id, tipo: 'Proposta Comercial', nome: 'Proposta ' + p.numero + (p.produto ? ' — ' + p.produto : ''), created_at: p.created_at });
 });
 var grupos = {};
 _entDocObraEspelhoTipos.forEach(function(t) { grupos[t] = []; });
 docs.forEach(function(d) {
  var k = (typeof _docNormTipo === 'function') ? _docNormTipo(d.tipo) : d.tipo;
  if (grupos[k]) grupos[k].push(d);
 });
 Object.keys(grupos).forEach(function(k) { grupos[k].sort(function(a,b) { return new Date(b.created_at) - new Date(a.created_at); }); });

 // Espelho é sempre somente-leitura: cards em grade lado a lado, igual ao
 // Airtable de referência. Nenhum selo/emoji sobreposto — o rótulo do
 // campo em si já diz "(da Obra)", igual ao "(from Obras)" do Airtable
 // original, e não existe "+ Anexar" nestes cards (única diferença visual
 // suficiente pra deixar claro que não dá pra editar/excluir por aqui).
 var signedMap = await _dcSignedUrlMap(docs, function() { return 'documentos_obras'; });
 wrap.innerHTML = '<div class="doc-card-grid">' + _entDocObraEspelhoTipos.map(function(tipo) {
  var docsDoTipo = grupos[tipo];
  var thumbs = docsDoTipo.map(function(d) {
   var nome = (d.nome || d.nome_arquivo || d.arquivo_nome || 'Documento').toString();
   var nomeAttrSafe = nome.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
   var onclickJs = d.proposta_id
    ? "_spVisualizarProposta('" + d.proposta_id + "')"
    : (d.caminho_storage ? "_spAbrirDocStorage('" + String(d.caminho_storage).replace(/\\/g,'\\\\').replace(/'/g,"\\'") + "','" + nomeAttrSafe + "')" : '');
   return _dcThumbHTML(d, 'documentos_obras', signedMap, onclickJs);
  });
  return _dcCardHTML(tipo + ' (da Obra)', docsDoTipo, thumbs, '');
 }).join('') + '</div>';
}

// ── Cidade/Estado da ENTREGA (colunas próprias, não da Obra) — Estado
// primeiro (select UF fixo, UF_BRASIL de obras.js), Cidade depende do
// Estado escolhido (cache de cidades reais por UF, lidas de `obras.cidade`
// — não existe base de municípios no sistema, ver investigação do plano).
var _entCidadesPorUFCache = {};
async function _entCarregarCidadesPorUF(uf) {
 if (!uf) return [];
 if (_entCidadesPorUFCache[uf]) return _entCidadesPorUFCache[uf];
 if (!_sb) return [];
 var set = {}; var from = 0; var pageSize = 1000;
 while (true) {
  var res = await _sb.from('obras').select('cidade').eq('estado', uf).not('cidade', 'is', null).range(from, from + pageSize - 1);
  if (res.error) break;
  (res.data || []).forEach(function(r) { if (r.cidade) set[r.cidade] = 1; });
  if (!res.data || res.data.length < pageSize) break;
  from += pageSize;
 }
 var lista = Object.keys(set).sort(function(a, b) { return a.localeCompare(b, 'pt-BR'); });
 _entCidadesPorUFCache[uf] = lista;
 return lista;
}

function _spEntregaRender(e) {
 _spEntAtiva = e;
 // Ambos os ramos (cache-hit/fetch) de _spEntregaById já garantem .sp-open
 // ANTES de chamar este render (ver correção do bug de cache), então não
 // precisa repetir aqui.
 var atrasado  = _entIsLate(e);
 var titulo    = e.nome_entrega || 'Entrega';
 var obraId    = e.obra_id || '';
 var transp    = e.transporte || '';
 var qtd       = e.quantidade != null ? e.quantidade : '';
 var peso      = e.peso_kg != null ? e.peso_kg : '';
 var maiorPeca = e.maior_peca_mm != null ? e.maior_peca_mm : '';
 var valor     = e.valor != null ? e.valor : '';
 // Formato dd/mm/aaaa (pt-BR) só pro rodapé/exibição — o campo de
 // Faturamento em si agora é <input type=date> de verdade (editável), ver
 // sub-aba Faturamento abaixo.
 var pedMila   = e.pedido_compusa_milatec || '';
 var pedMilaG  = e.pedido_compusa_mila || '';
 var criadoNome   = (typeof _projAuditNome === 'function') ? _projAuditNome(e.criado_por) : (e.criado_por || '—');
 var alteradoNome = (typeof _projAuditNome === 'function') ? _projAuditNome(e.atualizado_por) : (e.atualizado_por || '—');

 // Transporte — select buscável/criável (mesmo padrão já usado no
 // formulário de criação da entrega, "entTransporte"). Kind próprio
 // ("entDetTransporte") em vez de reaproveitar "entTransporte": esta tela
 // pode ser aberta sem o painel de Obra jamais ter sido renderizado (ex.:
 // a partir da lista/Kanban/Calendário de Entregas).
 _srchSelRegister('entDetTransporte', {
  options: function(){ return _obraTransporteCache || []; }, creatable: true, placeholder: 'Selecione o transporte...',
  onOpen: _obraCarregarTransportes,
  onSelect: function(v) {
   if (v && (_obraTransporteCache||[]).indexOf(v) === -1) _obraTransporteCache.push(v);
   _spEntDetSalvarCampo(e.id, { transporte: v || null });
  },
 });
 // Estado — select UF fixo (UF_BRASIL, obras.js). Ao trocar, re-renderiza o
 // painel inteiro (mesma técnica simples e robusta usada em outros pontos
 // do app pra refletir um campo dependente sem duplicar lógica de patch
 // parcial de DOM) — assim a Cidade abaixo já nasce com as opções do novo UF.
 _srchSelRegister('entDetEstado', {
  options: (typeof UF_BRASIL !== 'undefined') ? UF_BRASIL : [], placeholder: 'Selecione o UF...',
  onSelect: function(v) {
   _spEntDetSalvarCampo(e.id, { estado: v || null, cidade: null });
   e.estado = v || null; e.cidade = null;
   _spEntregaRender(e);
  },
 });
 _srchSelRegister('entDetCidade', {
  options: function(){ return _entCidadesPorUFCache[e.estado] || []; }, creatable: true,
  placeholder: e.estado ? 'Selecione a cidade...' : 'Selecione o Estado primeiro',
  onOpen: function(){ return _entCarregarCidadesPorUF(e.estado); },
  onSelect: function(v) { _spEntDetSalvarCampo(e.id, { cidade: v || null }); e.cidade = v || null; },
 });

 // ── Card da Obra principal (somente leitura: nome + data de criação +
 // etapa do negócio) — pedido explícito de bater com o layout do Airtable.
 // Mapa de cor já existe (BADGE_ETAPA_NEGOCIO, badge-colors.js), mesmo
 // usado no painel de Obra.
 var obraCardHTML = '<div class="sp-empty">Nenhuma obra vinculada.</div>';
 if (e.obra && obraId) {
  var dtObra = e.obra.created_at ? new Date(e.obra.created_at).toLocaleDateString('pt-BR') : '—';
  var etapaCls = (typeof BADGE_ETAPA_NEGOCIO !== 'undefined' && typeof _badgeCls === 'function') ? _badgeCls(BADGE_ETAPA_NEGOCIO, e.obra.etapa_negocio || '') : 'bm';
  obraCardHTML = '<div style="border:1px solid var(--border);border-radius:8px;padding:10px 12px;background:var(--surface)">'
   + '<div style="font-size:12px;font-weight:700;color:var(--text)">' + (e.obra.nome || '—').replace(/</g,'&lt;') + '</div>'
   + '<div style="display:flex;align-items:center;gap:10px;margin-top:6px">'
   + '<span style="font-size:10px;color:var(--muted)">Data de criação<br><span style="color:var(--text)">' + dtObra + '</span></span>'
   + (e.obra.etapa_negocio ? _badgeHTML(e.obra.etapa_negocio, etapaCls) : '')
   + '</div></div>';
 }

 // ── Endereço/Cidade/Estado agora são espelho somente-leitura da Obra
 // principal ("(from Obras)" no Airtable) — deixaram de ser campos
 // próprios editáveis da Entrega (colunas entregas.cidade/estado/
 // endereco_entrega continuam existindo no banco, só saíram de uso na UI).
 var obraCidade  = (e.obra && e.obra.cidade) || '';
 var obraEstado  = (e.obra && e.obra.estado) || '';
 var obraEndereco = (e.obra && e.obra.endereco_entrega) || '';
 var mapaQuery = [obraEndereco, obraCidade, obraEstado].filter(Boolean).join(', ');
 var mapaLink = mapaQuery ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(mapaQuery) : '';

 _spSet('Entrega', titulo, `
  <input type="hidden" id="sp-ent-id" value="${e.id}">
  <div class="spt-bar">
   <button class="spt-btn active" data-target="spt-ent-producao" onclick="_sptSwitch('ent-producao',this)">Produção</button>
   <button class="spt-btn" data-target="spt-ent-faturamento" onclick="_sptSwitch('ent-faturamento',this)">Faturamento &amp; Entrega</button>
  </div>

  <div class="spt-panel" id="spt-ent-producao">
   <div class="sp-field"><div class="sp-label">Entrega</div>
    <input class="sp-inp" value="${titulo.replace(/"/g,'&quot;')}" onchange="_spEntNomeSalvar('${e.id}', this)">
   </div>
   <div class="sp-field"><div class="sp-label">Obra</div>
    <div id="sp-ent-obra-card">${obraCardHTML}</div>
    <div class="sp-rel-chips-wrap" style="margin-top:8px">${_entObrasChipsHTML(e)}</div>
    ${_entObraAddMarkup()}
   </div>
   <div class="sp-field">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
     <div class="sp-label" style="margin-bottom:0">Projeto(s) da obra principal</div>
     ${obraId ? '<button type="button" class="btn btn-ghost" style="padding:2px 8px;font-size:11px" onclick="_entProjToggleForm(\'' + obraId + '\')">+ Adicionar projeto</button>' : ''}
    </div>
    <div class="sp-rel-chips-wrap" id="sp-ent-proj-chips">${obraId ? '<div class="sp-empty" style="padding:4px 0;font-size:11px">Carregando...</div>' : '<div class="sp-empty">Sem obra vinculada.</div>'}</div>
    <div id="ent-proj-form-box" style="display:none;margin-top:10px"></div>
   </div>
   <div class="sp-field"><div class="sp-label">Etapa da entrega</div>
    <select class="sp-inp" onchange="_spEntDetSalvarCampo('${e.id}', { etapa: this.value || null })">
     <option value="">Selecione...</option>
     ${Object.keys(_entEtapaBucket).map(function(et){ return '<option value="' + et.replace(/"/g,'&quot;') + '" ' + (e.etapa === et ? 'selected' : '') + '>' + et + '</option>'; }).join('')}
    </select>
    ${atrasado ? '<div style="margin-top:6px;font-size:11px;font-weight:600;color:var(--red)">⚠ Faturamento vencido (atrasado)</div>' : ''}
   </div>
   <div class="sp-field"><div class="sp-label">Tipo de orçamento</div>
    <div id="sp-ent-tipo-orcamento" style="font-size:12px;color:var(--muted)">${obraId ? 'Carregando...' : '—'}</div>
   </div>
   <div class="sp-g2">
    <div class="sp-field"><div class="sp-label">Quantidade</div>
     <input class="sp-inp" type="number" value="${qtd}" onchange="_spEntDetSalvarCampo('${e.id}', { quantidade: this.value !== '' ? Number(this.value) : null })">
    </div>
    <div class="sp-field"><div class="sp-label">Peso do pedido (kg)</div>
     <input class="sp-inp" type="number" value="${peso}" onchange="_spEntDetSalvarCampo('${e.id}', { peso_kg: this.value !== '' ? Number(this.value) : null })">
    </div>
   </div>
   <div class="sp-field"><div class="sp-label">Maior peça (mm)</div>
    <input class="sp-inp" type="number" value="${maiorPeca}" onchange="_spEntDetSalvarCampo('${e.id}', { maior_peca_mm: this.value !== '' ? Number(this.value) : null })">
   </div>
   <div id="sp-ent-doc-producao-wrap"><div class="sp-empty" style="padding:10px 0;font-size:11px">Carregando documentos...</div></div>
   <div class="sp-g2">
    <div class="sp-field"><div class="sp-label">Data de Faturamento</div>
     <input class="sp-inp" type="date" value="${e.data_faturamento || ''}" onchange="_spEntDetSalvarCampo('${e.id}', { data_faturamento: this.value || null })">
    </div>
    <div class="sp-field"><div class="sp-label">Transporte</div>
     ${_srchSelMarkup('entDetTransporte', 'sp-entdet-transporte', transp)}
    </div>
   </div>
   <div class="sp-g2">
    <div class="sp-field"><div class="sp-label">Cidade (da Obra)</div>
     <div class="sp-inp" style="background:var(--surface2);color:var(--muted);cursor:default">${obraCidade || '—'}</div>
    </div>
    <div class="sp-field"><div class="sp-label">Estado (da Obra)</div>
     <div class="sp-inp" style="background:var(--surface2);color:var(--muted);cursor:default">${obraEstado || '—'}</div>
    </div>
   </div>
   <div class="sp-field"><div class="sp-label">Endereço de entrega (da Obra)</div>
    <div class="sp-inp" style="background:var(--surface2);color:var(--muted);cursor:default;min-height:20px">${obraEndereco ? obraEndereco.replace(/</g,'&lt;') : '—'}</div>
    ${mapaLink ? '<a href="' + mapaLink + '" target="_blank" rel="noopener" style="display:inline-block;margin-top:6px;font-size:11px;color:var(--navy)">Ver no mapa ↗</a>' : ''}
   </div>
  </div>

  <div class="spt-panel" id="spt-ent-faturamento">
   <div class="sp-g2">
    <div class="sp-field"><div class="sp-label">Valor</div>
     <input class="sp-inp" type="number" step="0.01" value="${valor}" onchange="_spEntDetSalvarCampo('${e.id}', { valor: this.value !== '' ? Number(this.value) : null })">
    </div>
    <div class="sp-field"><div class="sp-label">Pedido produzido</div>
     <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:var(--text);margin-top:8px">
      <input type="checkbox" id="sp-entdet-produzido" ${e.pedido_produzido ? 'checked' : ''} onchange="_spEntDetSalvarCampo('${e.id}', { pedido_produzido: this.checked })">
      Pedido produzido
     </label>
    </div>
   </div>
   <div class="sp-g2">
    <div class="sp-field"><div class="sp-label">Pedido Compusa Mila</div>
     <input class="sp-inp" value="${pedMilaG.replace(/"/g,'&quot;')}" onchange="_spEntDetSalvarCampo('${e.id}', { pedido_compusa_mila: this.value || null })">
    </div>
    <div class="sp-field"><div class="sp-label">Pedido Compusa MilaTec</div>
     <input class="sp-inp" value="${pedMila.replace(/"/g,'&quot;')}" onchange="_spEntDetSalvarCampo('${e.id}', { pedido_compusa_milatec: this.value || null })">
    </div>
   </div>
   <div class="sp-field"><div class="sp-label">Documentos da Obra</div>
    <div id="sp-ent-doc-obra-wrap"><div class="sp-empty" style="padding:10px 0;font-size:11px">${obraId ? 'Carregando...' : 'Sem obra vinculada.'}</div></div>
   </div>
   <div id="sp-ent-doc-faturamento-wrap"><div class="sp-empty" style="padding:10px 0;font-size:11px">Carregando documentos...</div></div>
   <div class="sp-field"><div class="sp-label">Contato do orçamento</div>
    <div class="sp-rel-chips-wrap" id="sp-ent-contato-orc"><div class="sp-empty" style="padding:4px 0;font-size:11px">Carregando...</div></div>
   </div>
  </div>

  <div class="spt-panel" style="border-top:1px solid var(--border);padding-top:12px;margin-top:8px">
   <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:10px">Histórico de alterações</div>
   ${typeof _histPanelHTML === 'function' ? _histPanelHTML('sp-ent-historico') : ''}
  </div>

  <div class="spt-panel" style="border-top:1px solid var(--border);padding-top:12px;margin-top:8px">
   <div class="drw-audit-row"><span class="drw-audit-lbl">Criado por</span><span class="drw-audit-val">${criadoNome}</span></div>
   <div class="drw-audit-row"><span class="drw-audit-lbl">Data de criação</span><span class="drw-audit-val">${e.created_at ? new Date(e.created_at).toLocaleString('pt-BR') : '—'}</span></div>
   <div class="drw-audit-row"><span class="drw-audit-lbl">Última alteração por</span><span class="drw-audit-val">${alteradoNome}</span></div>
   <div class="drw-audit-row"><span class="drw-audit-lbl">Última modificação</span><span class="drw-audit-val">${e.updated_at ? new Date(e.updated_at).toLocaleString('pt-BR') : '—'}</span></div>
  </div>`,
  '<button class="btn btn-ghost" onclick="closePanel()">Fechar</button>');

 // Baseline do controle de concorrência: estado do registro como está no
 // banco no momento em que o painel abriu (ver concurrency.js).
 if (typeof _ccSetBaseline === 'function') _ccSetBaseline('entregas', e.id, e);
 if (typeof _rtLimparAvisoExterno === 'function') _rtLimparAvisoExterno();
 if (typeof _sptInitScrollSpy === 'function') _sptInitScrollSpy();
 // Histórico de alterações (audit_log) — mesmo componente compartilhado de
 // Obra/Projeto (scripts/lib/historico.js). Deixou de ser uma 3ª aba
 // (pedido explícito: só 2 abas, igual ao Airtable) — vira uma seção fixa
 // abaixo, sempre visível (o próprio scrollspy já mostra todos os
 // .spt-panel ao mesmo tempo, só "clicar na aba" rolava até ali).
 if (typeof _histCarregar === 'function') _histCarregar('sp-ent-historico', 'entregas', e.id);
 _spCarregarDocumentosEntrega(e.id, obraId);
 _entCarregarContatoOrcamento(obraId);
 if (obraId) { _spCarregarDocumentosObraEspelho(obraId); _entCarregarTipoOrcamento(obraId); }
 // Pedido explícito: obra sem nenhum Tipo de obra marcado não pode travar
 // o Tipo do projeto (campo obrigatório sem nenhuma opção pra escolher) —
 // cai pra lista completa (_NO_TIPOS_OPCOES) nesse caso, mesma regra do
 // formulário equivalente dentro do painel de Obra (obras.js).
 var tipoObraObra = (e.obra && e.obra.tipo_obra && e.obra.tipo_obra.length) ? e.obra.tipo_obra : (_NO_TIPOS_OPCOES || []);
 if (obraId) _spCarregarProjetosEntrega(obraId, tipoObraObra);
}

// ── Projeto(s) da obra, vistos de dentro do painel de Entrega — pedido
// explícito: faltava a opção de adicionar um projeto por aqui, e a
// criação deve seguir o MESMO modelo já usado no passo 4 do wizard de
// Nova Obra (_noProjRender) — inclusive a regra de o tipo do projeto só
// poder ser um dos tipos já marcados pra obra (_NO_TIPO_COR/pills), não
// qualquer um dos 5. Reaproveita os vocabulários/globais do wizard
// (_NO_PROJETO_ETAPA_OPCOES, _NO_TIPOLOGIA_TELHADO_OPCOES,
// _NO_TIPO_TELHA_OPCOES, _noProdutosDisponiveis) — carregados globalmente
// mesmo a entrega abrindo sem o painel de Obra ter sido renderizado.
async function _spCarregarProjetosEntrega(obraId, tipoObraOpcoes) {
 var wrap = document.getElementById('sp-ent-proj-chips');
 if (!wrap || !_sb) return;
 var res = await _sb.from('projetos').select('id,nome').eq('obra_id', obraId).order('created_at');
 wrap = document.getElementById('sp-ent-proj-chips'); // painel pode ter trocado enquanto a busca corria
 if (!wrap) return;
 if (res.error) { wrap.innerHTML = '<div class="sp-empty">Erro ao carregar projetos.</div>'; return; }
 var lista = res.data || [];
 wrap.innerHTML = lista.length
  ? lista.map(function(p){ return _spRelChipHTML('projetos', p.id, p.nome || 'Projeto sem nome'); }).join('')
  : '<div class="sp-empty">Nenhum projeto vinculado a esta obra ainda.</div>';
 wrap.dataset.tipoObra = JSON.stringify(tipoObraOpcoes || []);
}

var _entNovoProj = null;
function _entProjToggleForm(obraId) {
 var box = document.getElementById('ent-proj-form-box');
 if (!box) return;
 var abrir = box.style.display === 'none' || !box.style.display;
 if (abrir) {
  var chipsWrap = document.getElementById('sp-ent-proj-chips');
  var tipoObraOpcoes = [];
  try { tipoObraOpcoes = JSON.parse((chipsWrap && chipsWrap.dataset.tipoObra) || '[]'); } catch(e) {}
  _entNovoProj = {
   obraId: obraId, nome: '', etapaProjeto: '', tipoObra: tipoObraOpcoes.length === 1 ? tipoObraOpcoes[0] : '',
   produtoNomes: [], responsavelEmails: [], qtd: '', vuni: '', m2Arquitetura: '', m2Estrutura: '',
   tipologiaTelhado: [], tipologiaTelha: [], descritivo: '', tipoObraOpcoes: tipoObraOpcoes,
  };
  box.innerHTML = _entProjFormHTML();
  box.style.display = 'block';
  if (typeof _loadUsuariosCache === 'function') _loadUsuariosCache().then(function(){ box.innerHTML = _entProjFormHTML(); });
  if (typeof _respLoadUsers === 'function') _respLoadUsers().then(function(){ box.innerHTML = _entProjFormHTML(); }).catch(function(){});
  if (typeof _loadAvatarCacheFast === 'function') _loadAvatarCacheFast().then(function(){ box.innerHTML = _entProjFormHTML(); }).catch(function(){});
  if (!_produtosArr.length && _sb) {
   _sb.from('produtos').select('id,nome,categoria').order('nome').then(function(r){ _produtosArr = r.data || []; box.innerHTML = _entProjFormHTML(); });
  }
 } else {
  box.style.display = 'none';
  box.innerHTML = '';
  _entNovoProj = null;
 }
}
function _entProjSet(field, value) {
 if (!_entNovoProj) return;
 _entNovoProj[field] = value;
 if (field === 'tipoObra') {
  var box = document.getElementById('ent-proj-form-box');
  if (box) box.innerHTML = _entProjFormHTML();
 }
}
function _entProjFormHTML() {
 var p = _entNovoProj;
 if (!p) return '';
 var produtosDisponiveis = (typeof _noProdutosDisponiveis === 'function') ? _noProdutosDisponiveis(p.tipoObra) : (_produtosArr || []);
 var html = '<div style="border:1px solid var(--border);border-radius:10px;padding:14px;background:var(--surface2);display:flex;flex-direction:column;gap:12px">';
 html += '<div class="modal-grid col2" style="gap:12px">'
  + '<div class="mf" style="margin:0"><label style="font-size:11px">Nome do projeto <span class="req">*</span></label>'
  + '<input class="sp-inp" style="font-size:12px;text-transform:uppercase" value="' + (p.nome||'') + '" oninput="_upperCaseInput(this);_entProjSet(\'nome\',this.value)"></div>'
  + '<div class="mf" style="margin:0"><label style="font-size:11px">Etapa do projeto <span class="req">*</span></label>'
  + '<select class="sp-inp" style="font-size:12px" onchange="_entProjSet(\'etapaProjeto\',this.value)">'
  + '<option value="">Selecione...</option>'
  + (_NO_PROJETO_ETAPA_OPCOES||[]).map(function(et){ return '<option' + (et===p.etapaProjeto?' selected':'') + '>' + et + '</option>'; }).join('')
  + '</select></div>'
  + '</div>';
 // Pills restritas aos tipos já marcados pra obra (pedido explícito, mesma
 // regra do wizard) — não usa _NO_TIPOS_OPCOES inteiro.
 html += '<div class="mf" style="margin:0"><label style="font-size:11px">Tipo de obra do projeto <span class="req">*</span></label>'
  + '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">'
  + (p.tipoObraOpcoes||[]).map(function(t) {
     var selT = t === p.tipoObra;
     var corT = (_NO_TIPO_COR && _NO_TIPO_COR[t]) || 'var(--navy)';
     return '<button type="button" onclick="_entProjSet(\'tipoObra\',\'' + t.replace(/'/g,"\\'") + '\')" style="padding:6px 12px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;border:1.5px solid ' + corT + ';background:' + (selT?corT:'transparent') + ';color:' + (selT?'#fff':corT) + '">' + t + '</button>';
    }).join('')
  + '</div></div>';
 html += '<div class="modal-grid col2" style="gap:12px">'
  + '<div class="mf" style="margin:0"><label style="font-size:11px">Produto <span class="req">*</span></label>'
  + '<div id="ent-proj-produto-dd" class="no-msel-wide" style="margin-top:4px">' + _msRenderDropdown('entProjProduto', produtosDisponiveis.map(function(pr){return pr.nome;}), p.produtoNomes, '_entProjMultiToggle', 'Selecione o(s) produto(s)...') + '</div></div>'
  + '<div class="mf" style="margin:0"><label style="font-size:11px">Responsável <span class="req">*</span></label>'
  + '<div id="ent-proj-resp-dd" class="no-msel-wide" style="margin-top:4px">' + _entProjRespDropdownMarkup() + '</div></div>'
  + '</div>';
 html += '<div class="modal-grid col2" style="gap:12px">'
  + '<div class="mf" style="margin:0"><label style="font-size:11px">Tipologia do Telhado</label>'
  + '<div id="ent-proj-telhado-dd" class="no-msel-wide" style="margin-top:4px">' + _msRenderDropdown('entProjTelhado', _NO_TIPOLOGIA_TELHADO_OPCOES||[], p.tipologiaTelhado, '_entProjMultiToggle', 'Selecione a(s) tipologia(s)...') + '</div></div>'
  + '<div class="mf" style="margin:0"><label style="font-size:11px">Tipo de Telha</label>'
  + '<div id="ent-proj-telha-dd" class="no-msel-wide" style="margin-top:4px">' + _msRenderDropdown('entProjTelha', _NO_TIPO_TELHA_OPCOES||[], p.tipologiaTelha, '_entProjMultiToggle', 'Selecione o(s) tipo(s)...') + '</div></div>'
  + '</div>';
 html += '<div class="modal-grid col2" style="gap:12px">'
  + '<div class="mf" style="margin:0"><label style="font-size:11px">Quantidade</label>'
  + '<input class="sp-inp" style="font-size:12px" type="number" min="0" value="' + (p.qtd||'') + '" oninput="_entProjSet(\'qtd\',this.value)"></div>'
  + '<div class="mf" style="margin:0"><label style="font-size:11px">Valor unit. (R$)</label>'
  + '<input class="sp-inp" style="font-size:12px" type="text" value="' + (p.vuni||'') + '" oninput="_entProjSet(\'vuni\',this.value)"></div>'
  + '</div>';
 html += '<div class="modal-grid col2" style="gap:12px">'
  + '<div class="mf" style="margin:0"><label style="font-size:11px">M² Arquitetura</label>'
  + '<div style="position:relative"><input class="sp-inp" style="font-size:12px;padding-right:30px" type="number" min="0" step="0.01" value="' + (p.m2Arquitetura||'') + '" oninput="_entProjSet(\'m2Arquitetura\',this.value)">'
  + '<span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:11px;color:var(--muted);pointer-events:none">m²</span></div></div>'
  + '<div class="mf" style="margin:0"><label style="font-size:11px">M² Estrutura</label>'
  + '<div style="position:relative"><input class="sp-inp" style="font-size:12px;padding-right:30px" type="number" min="0" step="0.01" value="' + (p.m2Estrutura||'') + '" oninput="_entProjSet(\'m2Estrutura\',this.value)">'
  + '<span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:11px;color:var(--muted);pointer-events:none">m²</span></div></div>'
  + '</div>';
 html += '<div class="mf" style="margin:0"><label style="font-size:11px">Descritivo do projeto</label>'
  + '<textarea class="sp-inp" style="font-size:12px;height:56px" oninput="_entProjSet(\'descritivo\',this.value)">' + (p.descritivo||'') + '</textarea></div>';
 html += '<div style="display:flex;gap:8px">'
  + '<button type="button" onclick="_entProjSalvar()" style="font-size:12px;font-weight:600;padding:7px 16px;border:none;border-radius:7px;background:var(--green);color:#fff;cursor:pointer">Salvar projeto</button>'
  + '<button type="button" onclick="_entProjToggleForm(\'' + p.obraId + '\')" style="font-size:12px;padding:7px 16px;border:1px solid var(--border);border-radius:7px;background:transparent;color:var(--muted);cursor:pointer">Cancelar</button>'
  + '</div>';
 html += '</div>';
 return html;
}
function _entProjMultiToggle(campo, valor, checked) {
 if (!_entNovoProj) return;
 var field = campo === 'entProjProduto' ? 'produtoNomes' : campo === 'entProjTelhado' ? 'tipologiaTelhado' : 'tipologiaTelha';
 _entNovoProj[field] = _msToggle(_entNovoProj[field], valor, checked);
 var ddId = campo === 'entProjProduto' ? 'ent-proj-produto-dd' : campo === 'entProjTelhado' ? 'ent-proj-telhado-dd' : 'ent-proj-telha-dd';
 var opcoes = campo === 'entProjProduto'
  ? ((typeof _noProdutosDisponiveis === 'function' ? _noProdutosDisponiveis(_entNovoProj.tipoObra) : _produtosArr).map(function(pr){return pr.nome;}))
  : campo === 'entProjTelhado' ? (_NO_TIPOLOGIA_TELHADO_OPCOES||[]) : (_NO_TIPO_TELHA_OPCOES||[]);
 var wrap = document.getElementById(ddId);
 if (wrap) {
  wrap.innerHTML = _msRenderDropdown(campo, opcoes, _entNovoProj[field], '_entProjMultiToggle', 'Selecione...');
  var painel = wrap.querySelector('.fb-msel-panel');
  if (painel) painel.classList.add('open');
 }
}
function _entProjRespDropdownMarkup() {
 var p = _entNovoProj;
 var usuarios = _usuariosCache || [];
 var sel = (p && p.responsavelEmails) || [];
 var normalizar = (typeof _ssNormalize === 'function') ? _ssNormalize : function(s){ return (s||'').toLowerCase(); };
 var selNomes = sel.map(function(email){
  var u = usuarios.find(function(x){ return x.email === email; });
  return (u && u.nome_display) || email;
 });
 var btnLabel = (typeof _msBtnLabel === 'function') ? _msBtnLabel(selNomes, 'Selecione o(s) responsável(is)...') : (sel.length ? selNomes.join(', ') : 'Selecione o(s) responsável(is)...');
 var searchHtml = usuarios.length > 0 ? '<input type="text" class="fb-msel-search" placeholder="Pesquisar..." oninput="_msFiltrarDOM(this)">' : '';
 var itemsHtml = usuarios.map(function(u) {
  var label = u.nome_display || u.email;
  var emailEsc = String(u.email).replace(/"/g,'&quot;');
  var ck = sel.indexOf(u.email) !== -1 ? ' checked' : '';
  var avatarHtml = (typeof _userAvatarByName === 'function') ? _userAvatarByName(label, 20) : '';
  return '<label class="fb-msel-item" data-norm="' + normalizar(label) + '"><input type="checkbox" value="' + emailEsc + '"' + ck
   + ' onchange="_entProjRespToggle(this.value,this.checked)">' + avatarHtml + '<span>' + label.replace(/</g,'&lt;') + '</span></label>';
 }).join('');
 return '<div class="fb-msel-wrap">'
  + '<button type="button" class="fb-msel-btn" onclick="this.nextElementSibling.classList.toggle(\'open\')">' + btnLabel + '</button>'
  + '<div class="fb-msel-panel">' + searchHtml + '<div class="fb-msel-list">' + (itemsHtml || '<div style="padding:8px;font-size:11px;color:var(--muted)">Nenhum usuário cadastrado</div>') + '</div></div>'
  + '</div>';
}
function _entProjRespToggle(email, checked) {
 if (!_entNovoProj) return;
 _entNovoProj.responsavelEmails = _msToggle(_entNovoProj.responsavelEmails, email, checked);
 var wrap = document.getElementById('ent-proj-resp-dd');
 if (wrap) {
  wrap.innerHTML = _entProjRespDropdownMarkup();
  var painel = wrap.querySelector('.fb-msel-panel');
  if (painel) painel.classList.add('open');
 }
}
async function _entProjSalvar() {
 var p = _entNovoProj;
 if (!p) return;
 var faltando = [];
 if (!(p.nome||'').trim()) faltando.push('Nome');
 if (!p.etapaProjeto) faltando.push('Etapa do projeto');
 if (!p.tipoObra) faltando.push('Tipo de obra');
 if (!p.produtoNomes.length) faltando.push('Produto');
 if (!p.responsavelEmails.length) faltando.push('Responsável');
 if (faltando.length) { _showToast('Preencha: ' + faltando.join(', '), 'aviso'); return; }
 var payload = {
  nome: (p.nome||'').trim().toUpperCase(), obra_id: p.obraId, tipo_orcamento: p.tipoObra,
  etapa_projeto: p.etapaProjeto, produto: p.produtoNomes, responsavel: p.responsavelEmails,
  quantidade: p.qtd || null, valor_unitario: p.vuni ? parseFloat(String(p.vuni).replace(/\./g,'').replace(',','.')) || null : null,
  m2_arquitetura: p.m2Arquitetura || null, m2_estrutura: p.m2Estrutura || null,
  tipologia_telhado: p.tipologiaTelhado, tipologia_telha: p.tipologiaTelha,
  descritivo: p.descritivo || null,
 };
 var res = await _sb.from('projetos').insert(payload).select('id,nome').single();
 if (res.error) {
  console.error('[Entregas] erro ao criar projeto a partir do painel de Entrega:', res.error);
  _showToast('Não foi possível criar o projeto. Nada foi salvo — confira os campos e tente de novo.', 'erro');
  return;
 }
 _showToast('Projeto criado com sucesso!', 'ok');
 _entProjToggleForm(p.obraId);
 _spCarregarProjetosEntrega(p.obraId, p.tipoObraOpcoes);
}

// ── Atualização pontual de um campo da entrega (Transporte/Pedido produzido)
// — autosave imediato ao selecionar/marcar, sem botão "Salvar" (o painel de
// Entrega nunca teve esse fluxo; ver header do arquivo). Atualiza também o
// cache local (_entregasArr) para a Tabela/Kanban/Calendário refletirem sem
// precisar recarregar tudo do banco.
// opts.toastOk === false: usado pelo Ctrl+Z (undo-manager.js, ver
// _ieCommit em inline-edit.js) — o próprio undo-manager já mostra seu
// toast ("valor anterior restaurado"), então o "Alteração salva" normal
// aqui viraria um segundo toast empilhado por cima do primeiro.
// Nome da entrega era só exibido (readonly) no topo do painel — nenhum
// outro campo do sistema editava nome_entrega, então virava informação
// travada mesmo quando digitada errada na criação. Atualiza o cabeçalho do
// drawer (#sp-title) na hora, senão o campo salva mas o título continua
// mostrando o valor antigo até reabrir o painel.
function _spEntNomeSalvar(entregaId, inputEl) {
 var novo = (inputEl.value || '').trim();
 if (!novo) { _showToast('O nome da entrega não pode ficar vazio.', 'erro'); return; }
 _spEntDetSalvarCampo(entregaId, { nome_entrega: novo }).then(function () {
  var ttl = document.getElementById('sp-title');
  if (ttl) ttl.textContent = novo;
 });
}
async function _spEntDetSalvarCampo(entregaId, patch, opts) {
 if (!_sb || !entregaId) return;
 // Trava otimista + diff (concurrency.js). Aqui o payload já era pequeno (1
 // campo por chamada), então o risco de sobrescrever campo alheio era baixo —
 // mas o de sobrescrever o MESMO campo com um valor obsoleto era real: dois
 // usuários mudando o Status da mesma entrega, o último ganhava em silêncio.
 var r = await _ccSaveComFeedback('entregas', entregaId, patch, {
  onRecarregar: function () { _spEntregaById(entregaId); },
  toastOk: !(opts && opts.toastOk === false),
 });
 if (!r || !r.ok) return;
 _entPatchNaLista(r.row);
}

// ── Atualização pontual de UMA entrega na Tabela/Kanban/Calendário ───────────
// Espelha a linha vinda do banco no cache e redesenha só aquela <tr> (usando
// o MESMO _entRowHTML do load), preservando filtro/agrupamento/scroll.
function _entPatchNaLista(row, realce) {
 if (!row || !row.id) return;
 var idx = (_entregasArr || []).findIndex(function (x) { return String(x.id) === String(row.id); });
 // O payload do tempo real traz só as colunas de `entregas` — as associações
 // (obra, entregas_obras) vêm de um join e precisam ser preservadas.
 var completo = idx !== -1 ? Object.assign(_entregasArr[idx], row) : Object.assign({}, row);
 if (idx === -1) _entregasArr.unshift(completo);

 var tr = document.querySelector('#ent-tbody tr[data-id="' + row.id + '"]');
 if (tr && typeof _entRowHTML === 'function') {
  var tmp = document.createElement('tbody');
  tmp.innerHTML = _entRowHTML(completo);
  var novo = tmp.firstElementChild;
  if (novo) {
   if (tr.classList.contains('sp-active')) novo.classList.add('sp-active');
   tr.replaceWith(novo);
   if (typeof _spRow !== 'undefined' && _spRow === tr) _spRow = novo;
   if (realce) {
    novo.style.transition = 'background .9s';
    novo.style.background = 'rgba(37,99,235,.10)';
    setTimeout(function () { novo.style.background = ''; }, 1500);
   }
  }
 }
 // Kanban/Calendário leem direto de _entregasArr — já atualizado acima.
 if (typeof _entRenderKanbanIfVisible === 'function') _entRenderKanbanIfVisible();
 if (typeof _entRenderCalIfVisible === 'function') _entRenderCalIfVisible();
}

// ── Tempo real: Entregas ────────────────────────────────────────
function _entregasIniciarTempoReal() {
 if (typeof _rtWatchRows !== 'function') return;
 _rtWatchRows('entregas', 'entregas', {
  onUpdate: function (nova) {
   if (!nova || !nova.id) return;
   var eco = typeof _rtSouEu === 'function' && _rtSouEu(nova.atualizado_por);
   _entPatchNaLista(nova, !eco);
   if (eco) return;
   if (_spEntAtiva && String(_spEntAtiva.id) === String(nova.id)
    && document.getElementById('sp-drawer')?.classList.contains('sp-open')
    && typeof _rtAvisoAlteracaoExterna === 'function') {
    // Painel aberto: avisa, mas NÃO redesenha por baixo de quem pode estar
    // digitando. O baseline avança pro merge automático continuar valendo.
    _rtAvisoAlteracaoExterna(nova.atualizado_por, "_spEntregaById('" + nova.id + "')");
    if (typeof _ccSetBaseline === 'function') _ccSetBaseline('entregas', nova.id, nova);
   }
  },
  onInsert: function (nova) {
   if (!nova || !nova.id) return;
   if ((_entregasArr || []).some(function (x) { return String(x.id) === String(nova.id); })) return;
   // Entrega nova precisa dos joins de Obra pra <tr> sair completa — recarrega
   // a lista só nesse caso (evento raro), nunca a cada edição de campo.
   if (typeof _dbLoadEntregas === 'function') _dbLoadEntregas();
  },
  onDelete: function (_nova, antiga) {
   var id = antiga && antiga.id;
   if (!id) return;
   var i = (_entregasArr || []).findIndex(function (x) { return String(x.id) === String(id); });
   if (i !== -1) _entregasArr.splice(i, 1);
   var tr = document.querySelector('#ent-tbody tr[data-id="' + id + '"]');
   if (tr) tr.remove();
   if (_spEntAtiva && String(_spEntAtiva.id) === String(id)) {
    _showToast('A entrega que você tinha aberta foi excluída por outro usuário.', 'aviso');
    closePanel();
   }
   if (typeof _entRenderKanbanIfVisible === 'function') _entRenderKanbanIfVisible();
   if (typeof _entRenderCalIfVisible === 'function') _entRenderCalIfVisible();
  },
 });
}

// ── Documentos da entrega — 4 categorias reais do formulário do Airtable
// (Nota Fiscal / Romaneio de Entrega / Documentos Específicos da Entrega /
// Ordem de Produção). O acervo migrado do Airtable NUNCA preencheu
// documentos.entrega_id (auditoria: 0 linhas com entrega_id nessas 4 tipos)
// — o vínculo real daquela época está só na tabela de junção
// `documentos_entregas` (documento_id, entrega_id). Uploads novos feitos
// pelo sistema (_spUploadDocEntrega) gravam entrega_id direto, sem usar a
// junção. Por isso a carga busca dos DOIS jeitos e faz merge por id.
// `container` (novo): pedido explícito de aba única "Produção"/"Faturamento
// & Entrega" igual ao Airtable — Ordem de Produção/Romaneio ficam na aba
// Produção (junto do resto da fabricação), Nota Fiscal/Documentos pra
// faturamento ficam na aba de Faturamento.
var _entDetDocCats = [
 { tipo: 'ordem_producao',       label: 'Ordem de Produção',           container: 'sp-ent-doc-producao-wrap' },
 { tipo: 'romaneio_entrega',     label: 'Romaneio de Entrega',         container: 'sp-ent-doc-producao-wrap' },
 { tipo: 'nota_fiscal',          label: 'Nota Fiscal',                 container: 'sp-ent-doc-faturamento-wrap' },
 { tipo: 'documento_especifico', label: 'Documentos para faturamento', container: 'sp-ent-doc-faturamento-wrap' },
];
// Uploads feitos pelo formulário "Nova entrega" (obras.js) usam rótulos em
// português ('Documento da Entrega'/'Ordem de Produção') em vez do
// snake_case canônico — aliases para cair na mesma categoria.
var _entDetDocTipoAlias = { 'Documento da Entrega': 'documento_especifico', 'Ordem de Produção': 'ordem_producao' };
function _entDocCategoriaDe(tipo) {
 if (!tipo) return 'documento_especifico';
 if (_entDetDocCats.some(function(c){ return c.tipo === tipo; })) return tipo;
 return _entDetDocTipoAlias[tipo] || 'documento_especifico';
}

// ── Cards de anexo em grade — usa o componente compartilhado
// scripts/lib/doc-cards.js (_dc*), o mesmo padrão em todas as abas que
// anexam documentos no sistema (Entregas/Projetos/Instalações). Aqui só
// a parte específica de Entrega: categorias, buckets, upload e exclusão.
async function _spCarregarDocumentosEntrega(entregaId, obraId) {
 var containers = {};
 _entDetDocCats.forEach(function(c) { if (!containers[c.container]) containers[c.container] = document.getElementById(c.container); });
 if (!_sb || !Object.keys(containers).some(function(k){ return containers[k]; })) return;
 var [diretoRes, viaJuncaoRes] = await Promise.all([
  _sb.from('documentos').select('*').eq('entrega_id', entregaId),
  _sb.from('documentos_entregas').select('documentos(*)').eq('entrega_id', entregaId),
 ]);
 if (diretoRes.error && viaJuncaoRes.error) {
  Object.keys(containers).forEach(function(k) { if (containers[k]) containers[k].innerHTML = '<div class="sp-empty" style="font-size:11px;color:var(--red)">Erro ao carregar documentos.</div>'; });
  return;
 }
 var vistos = {};
 var docs = [];
 (diretoRes.data || []).forEach(function(d) { if (!vistos[d.id]) { vistos[d.id] = 1; docs.push(d); } });
 (viaJuncaoRes.data || []).forEach(function(row) { var d = row.documentos; if (d && !vistos[d.id]) { vistos[d.id] = 1; docs.push(d); } });

 var grupos = {};
 _entDetDocCats.forEach(function(c) { grupos[c.tipo] = []; });
 docs.forEach(function(d) { grupos[_entDocCategoriaDe(d.tipo)].push(d); });
 Object.keys(grupos).forEach(function(k) { grupos[k].sort(function(a,b) { return new Date(b.created_at) - new Date(a.created_at); }); });

 // Acervo migrado do Airtable foi enviado direto pro bucket
 // `documentos_entregas` (não `documentos_obras`, onde os uploads NOVOS
 // caem via _spUploadDocEntrega) — sem essa distinção o signed URL saía
 // sempre pro bucket errado.
 var bucketDe = function(d) { return d.origem === 'airtable_importado' ? 'documentos_entregas' : 'documentos_obras'; };
 var signedMap = await _dcSignedUrlMap(docs, bucketDe);

 Object.keys(containers).forEach(function(containerId) {
  if (!containers[containerId]) return;
  var catsAqui = _entDetDocCats.filter(function(c) { return c.container === containerId; });
  containers[containerId].innerHTML = '<div class="doc-card-grid">' + catsAqui.map(function(c) { return _spEntDetCategoriaHTML(c, grupos[c.tipo], entregaId, obraId, signedMap, bucketDe); }).join('') + '</div>';
 });
}

function _spEntDetCategoriaHTML(cat, docs, entregaId, obraId, signedMap, bucketDe) {
 var thumbs = docs.map(function(d) {
  var bucket = bucketDe(d);
  var nome = (d.nome || d.nome_arquivo || 'Documento').toString();
  var pathSafe = String(d.caminho_storage || '').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  var nomeAttrSafe = nome.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  var removeJs = "_spEntDetExcluirDoc('" + d.id + "','" + pathSafe + "','" + bucket + "','" + entregaId + "','" + (obraId||'') + "')";
  return _dcThumbHTML(d, bucket, signedMap, "_spAbrirDocStorage('" + pathSafe + "','" + nomeAttrSafe + "','" + bucket + "')", removeJs);
 });

 var inputId = 'sp-entdet-up-' + cat.tipo;
 var labelId = inputId + '-lbl';
 var addHtml = _dcAddHTML(inputId, labelId, "_spEntDetFileChange(this,'" + entregaId + "','" + (obraId||'') + "','" + cat.tipo + "','" + labelId + "')");
 var attrs = _dcDragAttrs("_spEntDetFileDrop(event,'" + entregaId + "','" + (obraId||'') + "','" + cat.tipo + "','" + labelId + "')");
 return _dcCardHTML(cat.label, docs, thumbs, addHtml, attrs);
}
async function _spEntDetUploadFiles(files, entregaId, obraId, tipo, labelId) {
 if (!files || !files.length) return;
 var lbl = document.getElementById(labelId);
 if (lbl) lbl.textContent = 'Enviando...';
 var erros = 0;
 for (var i = 0; i < files.length; i++) { if (!(await _spUploadDocEntrega(files[i], entregaId, obraId || null, tipo))) erros++; }
 if (erros) alert(erros + ' arquivo(s) não enviado(s). Tente novamente.');
 _spCarregarDocumentosEntrega(entregaId, obraId);
}
function _spEntDetFileChange(input, entregaId, obraId, tipo, labelId) {
 _spEntDetUploadFiles(Array.prototype.slice.call(input.files || []), entregaId, obraId, tipo, labelId);
 input.value = '';
}
function _spEntDetFileDrop(event, entregaId, obraId, tipo, labelId) {
 event.preventDefault();
 var files = event.dataTransfer && event.dataTransfer.files;
 _spEntDetUploadFiles(Array.prototype.slice.call(files || []), entregaId, obraId, tipo, labelId);
}
// Exclusão individual de anexo — só pros documentos próprios da Entrega
// (nunca pro espelho somente-leitura da Obra, que não chama esta função).
// Remove o arquivo do Storage primeiro (best-effort — se falhar, ainda
// assim remove o registro, pra não deixar o card "preso" com um anexo
// órfão que a usuária já pediu pra tirar) e depois a linha de `documentos`.
async function _spEntDetExcluirDoc(docId, path, bucket, entregaId, obraId) {
 if (!confirm('Excluir este anexo? Esta ação não pode ser desfeita.')) return;
 if (path) {
  var rm = await _sb.storage.from(bucket).remove([path]);
  if (rm.error) console.error('[Entregas] erro ao remover arquivo do storage:', rm.error);
 }
 var del = await _sb.from('documentos').delete().eq('id', docId);
 if (del.error) {
  console.error('[Entregas] erro ao excluir documento:', del.error);
  _showToast('Não foi possível excluir o anexo. Tente novamente.', 'erro');
  return;
 }
 // Acervo migrado do Airtable também tem um vínculo em `documentos_entregas`
 // (tabela de junção) — remover só a linha de `documentos` deixaria um
 // vínculo órfão apontando pra um documento inexistente.
 await _sb.from('documentos_entregas').delete().eq('documento_id', docId);
 _showToast('Anexo excluído.', 'ok');
 _spCarregarDocumentosEntrega(entregaId, obraId);
}

// ── Linha da Tabela — extraída em função própria pra ser reaproveitada tanto
// pela carga inicial (_dbLoadEntregas) quanto pelo rebuild flat (saindo do
// modo agrupado) e pelo rebuild agrupado (_entRenderGroupNode), mesmo padrão
// de _empRowHTML em empresas.js. ────────────────────────────────────────────
function _entRowHTML(e) {
 var bucket    = _entBucketFor(e.etapa);
 var atrasado  = _entIsLate(e);
 var statusTxt = e.etapa || _entBucketLabel[bucket];
 var obraNome  = (e.obra && e.obra.nome) || '';
 var empNome   = (e.obra && e.obra.empresas_obras && e.obra.empresas_obras[0] && e.obra.empresas_obras[0].empresa && e.obra.empresas_obras[0].empresa.nome) || '';
 var cidadeUf  = _entCidadeUf(e);
 var ds = _entPseudoDataset(e);
 var attrs = Object.keys(ds).map(function(k) {
  var attrName = k.replace(/([A-Z])/g, '-$1').toLowerCase();
  return ' data-' + attrName + '="' + String(ds[k]).replace(/"/g,'&quot;') + '"';
 }).join('');
 var etapaCls = atrasado ? BADGE_ETAPA_ENTREGA_BUCKET_CLS.atrasado : (BADGE_ETAPA_ENTREGA_BUCKET_CLS[bucket] || 'bm');
 var etapaDisplay = '<span class="badge ' + etapaCls + '">' + statusTxt + '</span>' + (atrasado ? ' <span class="ent-late-tag">Atrasado</span>' : '');
 var dataFatDisplay = '<span class="ent-date' + (atrasado ? ' overdue' : '') + '">' + (e.data_faturamento ? new Date(e.data_faturamento+'T00:00:00').toLocaleDateString('pt-BR') : '<span class="ie-empty">—</span>') + '</span>';
 var transpDisplay = e.transporte ? '<span class="badge ' + _entTransporteBadgeCls(e.transporte) + '" style="font-size:10px">' + e.transporte.replace(/</g,'&lt;') + '</span>' : null;
 return '<tr onclick="if(!event.target.closest(\'button,a,input,select\'))_spOpen(\'entregas\',this)"'
  + ' data-id="' + e.id + '" data-atrasado="' + (atrasado ? '1' : '0') + '"' + attrs + '>'
  + '<td><div style="font-weight:600;font-size:13px">' + (e.nome_entrega || 'Entrega sem nome') + '</div>'
  + '<div style="font-size:11px;color:var(--muted);margin-top:2px">' + (obraNome ? (empNome ? empNome + ' — ' : '') + obraNome : 'Obra não vinculada') + '</div></td>'
  + '<td style="font-size:12px;color:var(--muted)">' + (cidadeUf || '—') + '</td>'
  + _ieCellHTML('entregas', e.id, 'data_faturamento', e.data_faturamento, dataFatDisplay)
  + _ieCellHTML('entregas', e.id, 'transporte', e.transporte, transpDisplay)
  + _ieCellHTML('entregas', e.id, 'quantidade', e.quantidade, e.quantidade != null ? Number(e.quantidade).toLocaleString('pt-BR') : null, 'right')
  + _ieCellHTML('entregas', e.id, 'peso_kg', e.peso_kg, e.peso_kg != null ? Number(e.peso_kg).toLocaleString('pt-BR') : null, 'right')
  + _ieCellHTML('entregas', e.id, 'maior_peca_mm', e.maior_peca_mm, e.maior_peca_mm != null ? Number(e.maior_peca_mm).toLocaleString('pt-BR') : null, 'right')
  + _ieCellHTML('entregas', e.id, 'valor', e.valor, e.valor != null ? _entFmtBRL(e.valor) : null, 'right')
  + _ieCellHTML('entregas', e.id, 'etapa', e.etapa, etapaDisplay)
  + '<td><button class="btn btn-ghost btn-sm">Ver →</button></td>'
  + '</tr>';
}

// ── Load Entregas ─────────────────────────────────────────────────────────────
async function _dbLoadEntregas() {
 // Dispara cedo (fire-and-forget, memoizado em _obraCarregarTransportes) pra
 // já ter a lista de transportes pronta quando a pessoa clicar numa célula
 // de Transporte pra editar — sem isso, o 1º clique abriria o select vazio.
 _obraCarregarTransportes().catch(function(){});
 // Paginado em blocos de 1000 — sem isso, o Supabase corta silenciosamente
 // em 1000 linhas (achado real: com 1495 entregas, a tela e o contador do
 // menu mostravam só 1000, escondendo 495 entregas de verdade).
 var data = [];
 var from = 0;
 var pageSize = 1000;
 var error = null;
 while (true) {
  var res = await _sb
   .from('entregas')
   .select('*, obra:obra_id(nome, cidade, estado, tipo_obra, endereco_entrega, created_at, etapa_negocio, empresas_obras(empresa:empresa_id(nome))), entregas_obras(obra_id, obra:obra_id(id,nome,cidade,estado))')
   .order('created_at', { ascending: false })
   .range(from, from + pageSize - 1);
  if (res.error) { error = res.error; break; }
  data = data.concat(res.data || []);
  if (!res.data || res.data.length < pageSize) break;
  from += pageSize;
 }
 // Cache global por id — usado por _spEntregaById pra abrir o painel de
 // Entrega a partir de um chip clicado em OUTRA entidade (ex.: Obra), e pelas
 // vistas Kanban/Calendário/agrupada, todas lendo direto deste array.
 _entregasArr = data || [];
 // Carrega em paralelo (não bloqueia a Tabela) — reaplica o filtro sozinha
 // quando terminar (ver _entLoadDocPresence/_entLoadContatoOrcamento).
 _entLoadDocPresence();
 _entLoadContatoOrcamento();
 // Badge do menu lateral: ver _navBadgesLoadInitial() (RPC de contagem).
 if (error || !data?.length) return;
 var groupLevels = (_gbInstances.entregas && _gbInstances.entregas.state.levels) || [];
 if (groupLevels.length) { _entRenderGrouped(groupLevels); return; }
 const tbody = document.getElementById('ent-tbody');
 if (!tbody) return;
 tbody.innerHTML = data.map(_entRowHTML).join('');
 var totalEl = document.getElementById('ent-total-count');
 if (totalEl) totalEl.textContent = data.length + (data.length === 1 ? ' registro' : ' registros');
 _entRenderKanbanIfVisible();
 _entRenderCalIfVisible();
}
