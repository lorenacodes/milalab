// ═══════════════════════════════════════════════════════════════════════════════
// PROJETOS — modal "Novo Projeto" (cria um projeto avulso vinculado a uma obra já
// existente; para criar Obra+Projetos juntos, use o wizard Nova Obra), kanban por
// etapa, renderer do painel lateral, filtro de tipo, cache/loader de projetos.
// ═══════════════════════════════════════════════════════════════════════════════
// Obra — vira busca+single-select (srch-sel, mesmo componente já usado em
// Etapa/Cidade/Tipo do sistema) em vez do <select> nativo: lista de Obras
// cresce sem limite e escolher digitando é o padrão em todo o resto do app.
async function _npPopularObras() {
 var wrap = document.getElementById('np-obra-wrap');
 if (!wrap) return;
 var lista = Object.keys(_obraIdMap || {}).map(function(id){ return { id: id, nome: _obraIdMap[id].nome }; });
 if (!lista.length && _sb) {
  var res = await _sb.from('obras').select('id, nome').order('nome');
  if (!res.error && res.data) lista = res.data;
 }
 lista.sort(function(a,b){ return (a.nome||'').localeCompare(b.nome||''); });
 _srchSelRegister('npObra', {
  options: lista.map(function(o){ return o.nome || '(sem nome)'; }),
  placeholder: 'Selecione a obra...',
  onSelect: function(nome) {
   var obra = lista.find(function(o){ return (o.nome||'(sem nome)') === nome; });
   var idEl = document.getElementById('np-obra-id');
   if (idEl) idEl.value = obra ? obra.id : '';
  }
 });
 wrap.innerHTML = _srchSelMarkup('npObra', 'np-obra-id', '');
}

// Etapa do projeto — pedido explícito: mesmo estilo de busca+single-select
// já usado no campo Etapa do detalhamento de Projeto (_srchSelRegister
// 'projEtapa', mais abaixo neste arquivo), em vez do <select> nativo sem
// busca que o modal de criação tinha.
function _npPopularEtapa() {
 var wrap = document.getElementById('np-etapa-wrap');
 if (!wrap) return;
 _srchSelRegister('npEtapa', {
  options: _projetosKanbanEtapaOrder, placeholder: 'Selecione a etapa...',
 });
 wrap.innerHTML = _srchSelMarkup('npEtapa', 'np-etapa', 'Análise Inicial');
}

// Produto/Tipologia — mesmo estilo de busca+single-select do campo Etapa
// acima, em vez do <select> nativo sem busca que o modal de criação tinha
// (achado real, reportado pela usuária: o catálogo tem dezenas de produtos,
// sem busca ficava impraticável). Opções dependem do Tipo de orçamento
// escolhido — função (não array fixo), recalculada toda vez que o dropdown
// abre, então não precisa recriar nada na mão quando o Tipo muda.
function _npPopularProduto() {
 var wrap = document.getElementById('np-produto-wrap');
 if (!wrap) return;
 _srchSelRegister('npProduto', {
  options: function() {
   var tipo = document.getElementById('np-tipo')?.value || '';
   return (typeof _noProdutosDisponiveis === 'function') ? _noProdutosDisponiveis(tipo).map(function(pr){ return pr.nome; }) : [];
  },
  placeholder: 'Selecione o produto...',
  onSelect: function() { if (typeof updateNpProdutoInfo === 'function') updateNpProdutoInfo(); },
 });
 wrap.innerHTML = _srchSelMarkup('npProduto', 'np-produto', '');
}

// Catálogo real de produtos (_produtosArr, populado também pelo wizard Nova
// Obra) — achado real: o detalhamento de Projeto (_spProjetoById) montava o
// dropdown de Produto a partir de _noProdutosDisponiveis(tipo) sem nunca
// garantir que _produtosArr estivesse carregado antes (só o modal de
// criação fazia essa garantia) — abrindo o detalhamento sem ter passado
// antes pela Nova Obra/Novo Projeto, o catálogo vinha vazio e a lista de
// opções de Produto ficava sem nenhum item pra escolher.
async function _garantirProdutosArr() {
 if (_produtosArr.length || !_sb) return;
 var prRes = await _sb.from('produtos').select('id,nome,categoria').order('nome');
 _produtosArr = prRes.data || [];
}

// Tipo de orçamento — pedido explícito: mesmo estilo de pills coloridas
// clicáveis já usado em Tipo(s) de Obra (_NO_TIPO_COR, wizard-nova-obra.js)
// e no detalhamento do próprio Projeto (_projTipoPillsHTML/_projTipoToggle,
// mais abaixo neste arquivo) — este par espelha o mesmo componente pro
// formulário de criação, escrevendo no hidden #np-tipo em vez de em
// _spProjAtivo (que só existe no contexto do detalhamento).
function _npTipoPillsHTML(tipoAtual) {
 var opcoes = (typeof _NO_TIPOS_OPCOES !== 'undefined' && _NO_TIPOS_OPCOES) || ['Telhados','Steel Frame','Modular','Misto (LSF + A36)','Solar'];
 return opcoes.map(function(t) {
  var sel = t === tipoAtual;
  var cor = (typeof _NO_TIPO_COR !== 'undefined' && _NO_TIPO_COR[t]) || 'var(--navy)';
  return '<button type="button" onclick="_npTipoToggle(\'' + t.replace(/'/g,"\\'") + '\')" style="padding:6px 12px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;border:1.5px solid ' + cor + ';background:' + (sel?cor:'transparent') + ';color:' + (sel?'#fff':cor) + '">' + t + '</button>';
 }).join('');
}
function _npTipoToggle(t) {
 var idEl = document.getElementById('np-tipo');
 if (idEl) idEl.value = t;
 var pillsEl = document.getElementById('np-tipo-pills');
 if (pillsEl) { pillsEl.style.outline = ''; pillsEl.innerHTML = _npTipoPillsHTML(t); }
 if (typeof updateNpProdutoOptions === 'function') updateNpProdutoOptions();
}
function _npPopularTipo() {
 var idEl = document.getElementById('np-tipo'); if (idEl) idEl.value = '';
 var pillsEl = document.getElementById('np-tipo-pills');
 if (pillsEl) { pillsEl.style.outline = ''; pillsEl.innerHTML = _npTipoPillsHTML(''); }
}

// Responsável — multi-select com busca+avatar, padrão único de seleção de
// usuário do sistema (_usMultiDropdownHTML, scripts/lib/user-select.js).
// _npResponsavelSel guarda NOMES (não e-mail, diferente dos outros
// formulários de Responsável) — mantido como estava, só a renderização
// virou a função compartilhada.
var _npResponsavelSel = [];
function _npResponsavelDropdownHTML() {
 var opcoes = (_respUsuarios || []).map(function(u) { return { value: u.nome || u.email || '', nome: u.nome || u.email || '' }; });
 return _usMultiDropdownHTML(opcoes, _npResponsavelSel, "_npResponsavelToggle('npResp',this.value,this.checked)", 'Selecione o(s) responsável(is)...');
}
function _npResponsavelToggle(campo, valor, checked) {
 _npResponsavelSel = _msToggle(_npResponsavelSel, valor, checked);
 var wrap = document.getElementById('np-responsavel-wrap');
 if (wrap) wrap.innerHTML = _npResponsavelDropdownHTML();
}

// Melhoria vinculada — pedido explícito: um Projeto pode nascer sem Obra
// (orçamento) desde que fique vinculado a alguma Melhoria em vez (mesmo
// conceito da coluna "Obra/Melhoria" na Tabela de Projetos). Só lista
// melhorias AINDA SEM projeto (melhorias.projeto_id is null) — mesmo
// modelo de "vincular existente" já usado em Instalação/Projeto noutras
// telas: melhoria só pertence a 1 projeto por vez (FK única,
// melhorias.projeto_id), então uma já vinculada não pode aparecer aqui de
// novo (escolher ela roubaria o vínculo do projeto atual dela).
var _npMelhoriaSel = [];
var _npMelhoriasCache = null;
async function _npCarregarMelhorias() {
 if (_npMelhoriasCache || !_sb) return;
 var res = await _sb.from('melhorias').select('id,nome').is('projeto_id', null).order('nome');
 _npMelhoriasCache = res.data || [];
}
function _npMelhoriaDropdownHTML() {
 var opcoes = (_npMelhoriasCache || []).map(function(m){ return m.nome || '(sem nome)'; });
 return _msRenderDropdown('npMelhoria', opcoes, _npMelhoriaSel, '_npMelhoriaToggle', 'Selecione a(s) melhoria(s)...');
}
function _npMelhoriaToggle(campo, valor, checked) {
 _npMelhoriaSel = _msToggle(_npMelhoriaSel, valor, checked);
 var wrap = document.getElementById('np-melhoria-wrap');
 if (wrap) wrap.innerHTML = _npMelhoriaDropdownHTML();
}

// Tipologia do Telhado / Tipo de Telha — pedido explícito: aparecem
// automaticamente só quando Tipo de orçamento = Telhados (ver
// updateNpProdutoOptions, propostas.service.js, que alterna o
// #np-telhado-wrap). Mesmo vocabulário/padrão já usado no wizard de Nova
// Obra (_NO_TIPOLOGIA_TELHADO_OPCOES/_NO_TIPO_TELHA_OPCOES,
// wizard-nova-obra.js).
var _npTelhadoSel = [];
var _npTelhaSel = [];
function _npTelhadoToggle(campo, valor, checked) {
 _npTelhadoSel = _msToggle(_npTelhadoSel, valor, checked);
 var wrap = document.getElementById('np-telhado-dd');
 if (wrap) wrap.innerHTML = _msRenderDropdown('npTelhado', _NO_TIPOLOGIA_TELHADO_OPCOES, _npTelhadoSel, '_npTelhadoToggle', 'Selecione a(s) tipologia(s)...');
}
function _npTelhaToggle(campo, valor, checked) {
 _npTelhaSel = _msToggle(_npTelhaSel, valor, checked);
 var wrap = document.getElementById('np-telha-dd');
 if (wrap) wrap.innerHTML = _msRenderDropdown('npTelha', _NO_TIPO_TELHA_OPCOES, _npTelhaSel, '_npTelhaToggle', 'Selecione o(s) tipo(s)...');
}

async function openNovoProjeto() {
 _npPopularTipo();
 _npPopularEtapa();
 _npPopularProduto();
 ['np-nome','np-qtd','np-val-uni','np-peso-uni','np-m2arq','np-m2estr','np-desc'].forEach(id => {
 const el = document.getElementById(id); if(el) el.value = '';
 });
 var idEl = document.getElementById('np-obra-id'); if (idEl) idEl.value = '';
 _npResponsavelSel = [];
 _npMelhoriaSel = [];
 _npMelhoriasCache = null;
 _npTelhadoSel = [];
 _npTelhaSel = [];
 var telhadoWrap = document.getElementById('np-telhado-wrap');
 if (telhadoWrap) telhadoWrap.style.display = 'none';

 await _garantirProdutosArr();
 await Promise.all([_npPopularObras(), _respLoadUsers(), _npCarregarMelhorias()]);
 var respWrap = document.getElementById('np-responsavel-wrap');
 if (respWrap) respWrap.innerHTML = _npResponsavelDropdownHTML();
 var melWrap = document.getElementById('np-melhoria-wrap');
 if (melWrap) melWrap.innerHTML = _npMelhoriaDropdownHTML();
 var tdWrap = document.getElementById('np-telhado-dd');
 if (tdWrap) tdWrap.innerHTML = _msRenderDropdown('npTelhado', _NO_TIPOLOGIA_TELHADO_OPCOES||[], _npTelhadoSel, '_npTelhadoToggle', 'Selecione a(s) tipologia(s)...');
 var thWrap = document.getElementById('np-telha-dd');
 if (thWrap) thWrap.innerHTML = _msRenderDropdown('npTelha', _NO_TIPO_TELHA_OPCOES||[], _npTelhaSel, '_npTelhaToggle', 'Selecione o(s) tipo(s)...');

 calcProjetoTotais();
 document.getElementById('modal-novo-projeto').classList.add('open');
 document.body.style.overflow = 'hidden';
}

function closeNovoProjeto() {
 document.getElementById('modal-novo-projeto').classList.remove('open');
 document.body.style.overflow = '';
}

function calcProjetoTotais() {
 const qtd = parseFloat(document.getElementById('np-qtd')?.value) || 0;
 const vUnit = parseFloat(document.getElementById('np-val-uni')?.value) || 0;
 const pUnit = parseFloat(document.getElementById('np-peso-uni')?.value) || 0;
 const m2arq = parseFloat(document.getElementById('np-m2arq')?.value) || 0;

 const vTotal = qtd * vUnit;
 const pTotal = qtd * pUnit;
 const rpm2 = (m2arq > 0 && vTotal > 0) ? vTotal / m2arq : null;

 // Valor total — destaque visual
 const vtEl = document.getElementById('np-val-total');
 if (vtEl) {
 vtEl.textContent = vTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
 vtEl.style.color = vTotal > 0 ? 'var(--green)' : 'var(--muted)';
 vtEl.style.background = vTotal > 0 ? 'var(--green-dim)' : 'var(--surface2)';
 vtEl.style.borderColor = vTotal > 0 ? 'var(--green)' : 'var(--border)';
 }

 // Peso total
 const ptEl = document.getElementById('np-peso-total');
 if (ptEl) ptEl.textContent = pTotal > 0
 ? pTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + ' kg'
 : '—';

 // R$ por m²
 const r2El = document.getElementById('np-rpm2');
 if (r2El) r2El.textContent = rpm2
 ? rpm2.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) + '/m²'
 : '—';
}

async function submitNovoProjeto() {
 const obraId = document.getElementById('np-obra-id').value;
 const tipo   = document.getElementById('np-tipo').value;
 const prod   = document.getElementById('np-produto').value || null;
 const etapaEl = document.getElementById('np-etapa');
 const etapa  = etapaEl.value;
 const nomeDigitado = (document.getElementById('np-nome').value || '').trim();

 var nomeEl = document.getElementById('np-nome');
 var respWrap = document.getElementById('np-responsavel-wrap');
 nomeEl.style.borderColor = '';
 var produtoBox = document.getElementById('sp-srch-npProduto-box'); if (produtoBox) produtoBox.style.borderColor = '';
 var etapaBox = document.getElementById('sp-srch-npEtapa-box'); if (etapaBox) etapaBox.style.borderColor = '';
 if (respWrap) respWrap.style.outline = '';

 if (!nomeDigitado) { nomeEl.style.borderColor = 'var(--red)'; nomeEl.focus(); _showToast('Informe o nome do projeto.', 'aviso'); return; }
 if (!prod) { if (produtoBox) produtoBox.style.borderColor = 'var(--red)'; _showToast('Selecione o produto.', 'aviso'); return; }
 if (!etapa) { if (etapaBox) etapaBox.style.borderColor = 'var(--red)'; _showToast('Selecione a etapa do projeto.', 'aviso'); return; }
 // Pedido explícito: Obra OU Melhoria — pelo menos um dos dois vínculos é
 // obrigatório (projeto sem orçamento/obra associada precisa ficar
 // vinculado a alguma Melhoria em vez).
 if (!obraId && !_npMelhoriaSel.length) { _showToast('Vincule uma Obra ou uma Melhoria.', 'aviso'); return; }
 if (!tipo)   { var pillsWrap = document.getElementById('np-tipo-pills'); if (pillsWrap) pillsWrap.style.outline = '1.5px solid var(--red)'; _showToast('Selecione o tipo de orçamento.', 'aviso'); return; }
 if (!_npResponsavelSel.length) { if (respWrap) respWrap.style.outline = '1.5px solid var(--red)'; _showToast('Selecione o responsável pelo projeto.', 'aviso'); return; }
 if (!_sb) { _showToast('Sem conexão com o banco.', 'erro'); return; }

 const qtd    = parseFloat(document.getElementById('np-qtd').value) || null;
 const vUnit  = parseFloat(document.getElementById('np-val-uni').value) || null;
 const pUnit  = parseFloat(document.getElementById('np-peso-uni').value) || null;
 const m2arq  = parseFloat(document.getElementById('np-m2arq').value) || null;
 const m2estr = parseFloat(document.getElementById('np-m2estr').value) || null;
 const desc   = (document.getElementById('np-desc').value || '').trim();
 const obraNome = _srchSelState.npObra ? _srchSelState.npObra.selected : '';

 var respEmails = (_respUsuarios || [])
  .filter(function(u){ return _npResponsavelSel.indexOf(u.nome || u.email) !== -1; })
  .map(function(u){ return u.email; });

 const payload = {
  nome: (nomeDigitado || (obraNome + ' — ' + tipo)).toUpperCase(),
  obra_id: obraId || null,
  tipo_orcamento: tipo,
  etapa_projeto: etapa || null,
  produto: prod ? [prod] : null,
  m2_arquitetura: m2arq,
  m2_estrutura: m2estr,
  peso_kg: (qtd && pUnit) ? qtd * pUnit : null,
  quantidade: qtd,
  valor_unitario: vUnit,
  responsavel: respEmails.length ? respEmails : null,
  descritivo: desc || null,
  tipologia_telhado: _npTelhadoSel.length ? _npTelhadoSel : null,
  tipologia_telha: _npTelhaSel.length ? _npTelhaSel : null,
 };

 const btn = document.querySelector('#modal-novo-projeto .btn-primary');
 const { data: novoProjeto, error } = await _sb.from('projetos').insert(payload).select('id').single();
 if (error) {
  _showToast('Erro ao criar projeto: ' + _supaErrPt(error.message), 'erro');
  return;
 }

 if (_npMelhoriaSel.length && novoProjeto) {
  var melIds = (_npMelhoriasCache || [])
   .filter(function(m){ return _npMelhoriaSel.indexOf(m.nome || '(sem nome)') !== -1; })
   .map(function(m){ return m.id; });
  if (melIds.length) await _sb.from('melhorias').update({ projeto_id: novoProjeto.id }).in('id', melIds);
 }

 _showToast('Projeto criado com sucesso!', 'ok');
 closeNovoProjeto();
 _dbLoadProjetos();
 if (document.getElementById('proj-kanban') && document.getElementById('proj-kanban').style.display !== 'none') _renderProjetosKanban();
}

var _projetosKanbanEtapaOrder = [
 'Orçamento','Análise Inicial','Aguardando Aprovação','Pré-projeto',
 'Revisão Pré-Projeto','Projeto para Aprovação','Revisão Projeto',
 'Projeto Executivo','Revisão Projeto Executivo','Ajustes de Piloto',
 'Projeto em Andamento','Aguardando Produção','Projeto Finalizado',
 'Pós-vendas','Negócio perdido'
];

function _switchProjetosView(view) {
 var tbl    = document.getElementById('proj-table-view');
 var knb    = document.getElementById('proj-kanban');
 var btnTbl = document.getElementById('pv-btn-tabela');
 var btnKnb = document.getElementById('pv-btn-kanban');
 if (!tbl || !knb) return;
 if (view === 'kanban') {
  tbl.style.display = 'none';
  knb.style.display = 'flex';
  btnTbl.classList.remove('active');
  btnKnb.classList.add('active');
  _renderProjetosKanban();
 } else {
  tbl.style.display = 'block';
  knb.style.display = 'none';
  btnKnb.classList.remove('active');
  btnTbl.classList.add('active');
 }
}

async function _renderProjetosKanban() {
 var container = document.getElementById('proj-kanban');
 if (!container) return;
 container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted);font-size:13px">Carregando projetos do banco...</div>';

 // Achado real: filtros que dependem de dado carregado à parte (Melhoria,
 // Cidade/Estado da Obra, presença de Fotos/Pré-Projeto/Projeto executivo/
 // Tarefa...) "não funcionavam direito" com o Kanban aberto — esta função
 // fazia sua PRÓPRIA consulta, mais leve (menos colunas) e sem nenhuma das
 // caches que os filtros novos passaram a depender, então os data-* que
 // esses filtros leem nunca existiam nos .proj-kn-card. Agora carrega as
 // mesmas caches de _dbLoadProjetos e usa select('*') + _projBuildRowData
 // (mesma função, mesmo conjunto de data-* das duas visualizações).
 await _garantirObraIdMap();
 await _garantirObraGeoMap();
 await _garantirMelhoriaProjetoMap();
 await _projCarregarPresenca();

 // Mantém o join aninhado obra:obra_id(...) só pro SUBTÍTULO do card (nome
 // da Obra/Empresa exibido) — funciona sempre, mesmo se a aba Obras nunca
 // foi visitada nesta sessão (_obraIdMap[id].empresa só existe depois que
 // _dbLoadObras roda). Os data-* de filtro continuam vindo de
 // _projBuildRowData (mesma função/mesmas caches da Tabela).
 var res = await _sb.from('projetos')
  .select('*, obra:obra_id(nome, empresas_obras(empresa:empresa_id(nome)))')
  .order('created_at', { ascending: false });

 if (res.error || !res.data) {
  console.error('[Projetos] erro ao carregar a lista do Kanban:', res.error);
  container.innerHTML = '<div style="color:var(--red);padding:20px;font-size:13px">Não foi possível carregar os projetos agora. Verifique sua conexão e recarregue a página.</div>';
  return;
 }

 var data     = res.data;
 data.forEach(function(p){ if (Array.isArray(p.responsavel)) p.responsavel = _emailsToNomes(p.responsavel); });
 // Alias pro mapa único BADGE_TIPO_OBRA (scripts/lib/badge-colors.js).
 var tipoCls  = BADGE_TIPO_OBRA;
 // Cor do ponto no cabeçalho da coluna — mesmo espírito de _etapaDot em
 // obras.js (cor sólida, não mais um badge colorido no cabeçalho, pra
 // seguir o padrão visual exato do Kanban de Obras: .kc-dot + .kc-label).
 // Alias pro mapa único BADGE_ETAPA_PROJETO_DOT (scripts/lib/badge-colors.js).
 var etapaDot = BADGE_ETAPA_PROJETO_DOT;

 // Agrupa por etapa — trim para ignorar espaços extras vindos do Airtable
 var groups = {};
 data.forEach(function(p) {
  var e = (p.etapa_projeto || 'Sem etapa').trim();
  if (!groups[e]) groups[e] = [];
  groups[e].push(p);
 });

 // Ordena colunas: etapas com dados na ordem definida, depois qualquer outra
 // Todas as etapas conhecidas viram coluna, mesmo sem nenhum card agora —
 // senão não existe alvo (.proj-kn-col) pra soltar um card arrastado numa
 // etapa vazia, e o drag-and-drop só serviria pra etapas que já têm dados.
 var ordered = _projetosKanbanEtapaOrder.slice();
 Object.keys(groups).forEach(function(e){ if (!ordered.includes(e)) ordered.push(e); });

 if (!data.length) {
  container.innerHTML = '<div class="sp-empty" style="width:100%">Nenhum projeto encontrado no banco.</div>';
  return;
 }

 // Mesmo padrão visual/estrutural do Kanban de Obras: cabeçalho com ponto
 // colorido + label (kc-dot/kc-label, não mais um badge cheio), card
 // minimalista (título, tags, uma linha discreta de contexto) — nada de
 // rodapé com valor/responsável, que era um padrão só desta página.
 container.innerHTML = ordered.map(function(etapa) {
  var cards  = groups[etapa] || [];
  var dot    = etapaDot[etapa] || 'var(--muted)';
  var cardsHtml = cards.map(function(p) {
   // data-* de filtro (Melhoria/Cidade/Estado/Produto/Descritivo/
   // Quantidade/Valor da unidade/M² Estrutura/Peso Uni/Maior peça/datas/
   // Alterado-Criado por/presença de Fotos-Pré-Projeto-Projeto executivo-
   // Tarefa) vêm todos daqui — mesma função/mesmas caches da Tabela (ver
   // comentário completo em _projBuildRowData).
   var d        = _projBuildRowData(p);
   var tipo     = d.tipo;
   var tipCls   = tipoCls[tipo]   || 'bm';
   var etapaCls = _badgeCls(BADGE_ETAPA_PROJETO, etapa);
   // Subtítulo exibido no card continua vindo do join aninhado (obra:
   // obra_id(...) no SELECT acima) — funciona mesmo sem a aba Obras ter
   // sido visitada nesta sessão, diferente de _obraIdMap[id].empresa (só
   // populado por _dbLoadObras).
   var obraNome = (p.obra && p.obra.nome)   ? p.obra.nome   : '';
   var empNome  = (p.obra && p.obra.empresas_obras && p.obra.empresas_obras[0]?.empresa?.nome) ? p.obra.empresas_obras[0].empresa.nome : '';
   var subtitulo = ((empNome ? empNome + ' — ' : '') + obraNome) || 'Sem obra vinculada';
   var tagsHtml = (tipo ? '<span class="badge ' + tipCls + '" style="font-size:10px">' + tipo + '</span>' : '')
    + (etapa ? '<span class="badge ' + etapaCls + '" style="font-size:10px">' + etapa + '</span>' : '');
   // Clique abre o próprio projeto (_spProjetoById), não mais a Obra vinculada
   // — abrir a Obra era o comportamento antigo e escondia o detalhamento do
   // Projeto atrás de um passo a mais.
   // O card em SI não é mais draggable — três tentativas de distinguir
   // "isso foi clique ou arraste" por heurística (mousedown/mouseup,
   // dragend com checagem de deslocamento, depois com o evento 'drag'
   // contínuo) falharam na prática: testes sintéticos via dispatchEvent não
   // reproduzem o loop nativo real de drag-and-drop do Chrome, então cada
   // "confirmação" só validava contra a própria suposição, não contra o
   // navegador de verdade. Card inteiro sendo draggable=true deixa
   // fundamentalmente ambíguo se um clique real vai ou não disparar
   // dragstart (limiar nativo varia). Solução definitiva: separar
   // fisicamente as duas áreas — só a alcinha ".proj-kn-handle" é
   // draggable, o resto do card é clique puro, sem ambiguidade nenhuma
   // possível (ver _setupProjetosKanbanDnD abaixo).
   return '<div class="proj-kn-card" data-id="' + p.id + '" title="Abrir projeto"'+d.attrsHTML+'>'
    + '<div class="proj-kn-handle" draggable="true" title="Arrastar para outra etapa"><svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor"><circle cx="2.5" cy="2.5" r="1.5"/><circle cx="7.5" cy="2.5" r="1.5"/><circle cx="2.5" cy="8" r="1.5"/><circle cx="7.5" cy="8" r="1.5"/><circle cx="2.5" cy="13.5" r="1.5"/><circle cx="7.5" cy="13.5" r="1.5"/></svg></div>'
    + '<div class="proj-kn-title">' + (p.nome || '(sem nome)') + '</div>'
    + (tagsHtml ? '<div class="proj-kn-tags">' + tagsHtml + '</div>' : '')
    + '<div class="proj-kn-obra" title="' + subtitulo.replace(/"/g,'&quot;') + '">' + subtitulo + '</div>'
    + '</div>';
  }).join('');
  return '<div class="proj-kn-col" data-etapa="' + etapa + '">'
   + '<div class="proj-kn-head">'
   + '<span class="kc-label"><span class="kc-dot" style="background:' + dot + '"></span>' + etapa + '</span>'
   + '<span class="proj-kn-count">' + cards.length + '</span>'
   + '</div>'
   + '<div class="proj-kn-body">' + cardsHtml + '</div>'
   + '</div>';
 }).join('');

 _setupProjetosKanbanDnD();
}

// ── Drag-and-drop do Kanban de Projetos (move card → atualiza etapa_projeto)
// Colunas aqui são geradas dinamicamente a partir dos dados (não são IDs
// fixos no HTML como em Obras), então os listeners são reanexados a cada
// render — .proj-kn-body é recriado do zero em _renderProjetosKanban, então
// não há risco de acumular listeners duplicados.
// Clique vs. arraste: três tentativas de resolver isso por HEURÍSTICA
// (mousedown/mouseup; dragend com checagem de deslocamento; depois com o
// evento 'drag' contínuo pra contornar coordenadas zeradas do dragend)
// falharam na prática — cada uma "passava" nos testes porque eventos
// sintéticos via dispatchEvent nunca entram no loop nativo real de
// drag-and-drop do Chrome, então só validavam contra a própria suposição.
// Card inteiro sendo draggable=true deixa fundamentalmente ambíguo se um
// clique real vai ou não disparar dragstart (limiar nativo varia,
// imprevisível). Solução definitiva: elimina a ambiguidade fisicamente —
// só a alcinha ".proj-kn-handle" é draggable; o resto do card nunca
// dispara dragstart, então 'click' nele é sempre um clique de verdade, sem
// heurística nenhuma.
function _onProjHandleDragStart(e) {
 e.stopPropagation();
 var card = this.closest('.proj-kn-card');
 e.dataTransfer.setData('text/plain', card.dataset.id);
 e.dataTransfer.effectAllowed = 'move';
 card.classList.add('dragging');
}
function _onProjHandleDragEnd(e) {
 e.stopPropagation();
 this.closest('.proj-kn-card').classList.remove('dragging');
}
function _onProjCardClick() { _spProjetoById(this.dataset.id); }
function _setupProjetosKanbanDnD() {
 document.querySelectorAll('#proj-kanban .proj-kn-card').forEach(function(card) {
  card.addEventListener('click', _onProjCardClick);
 });
 document.querySelectorAll('#proj-kanban .proj-kn-handle').forEach(function(handle) {
  handle.addEventListener('dragstart', _onProjHandleDragStart);
  handle.addEventListener('dragend', _onProjHandleDragEnd);
  // A alça não deve abrir o detalhamento se for só clicada sem arrastar —
  // o clique nela não tem por que fazer nada, então nem deixa borbulhar
  // pro card (que abriria o painel sem essa checagem).
  handle.addEventListener('click', function(e) { e.stopPropagation(); });
 });
 document.querySelectorAll('#proj-kanban .proj-kn-body').forEach(function(body) {
  body.addEventListener('dragover', function(e) { e.preventDefault(); body.classList.add('kc-dragover'); });
  body.addEventListener('dragleave', function() { body.classList.remove('kc-dragover'); });
  body.addEventListener('drop', function(e) {
   e.preventDefault();
   body.classList.remove('kc-dragover');
   var id = e.dataTransfer.getData('text/plain');
   var col = body.closest('.proj-kn-col');
   var novaEtapa = col && col.dataset.etapa;
   if (id && novaEtapa) updateProjetoEtapa(id, novaEtapa);
  });
 });
}

// ── Persiste a nova etapa no Supabase, com UI otimista + rollback em erro
// (mesmo padrão de updateObraEtapa, obras.js) — move o card pra coluna
// certa antes mesmo da resposta do banco, desfaz se der erro.
// opts.skipUndo/opts.silent: usados pelo próprio Ctrl+Z (undo-manager.js,
// ver comentário equivalente em updateObraEtapa, obras.js) ao reaplicar esta
// função pra desfazer/refazer um arrasto.
async function updateProjetoEtapa(id, novaEtapa, opts) {
 if (!id || !novaEtapa || !_sb) return;
 var card = document.querySelector('.proj-kn-card[data-id="' + id + '"]');
 var etapaAnterior = card && card.dataset.etapa;
 if (etapaAnterior === novaEtapa) return;
 _moverCardProjetoParaColuna(id, novaEtapa);

 // Trava otimista + diff (concurrency.js) — antes era um `.update()` cru,
 // sem baseline nenhuma (diferente do resto do autosave de Projetos).
 var r = await _ccSave('projetos', id, { etapa_projeto: novaEtapa });
 if (!r || r.erro || r.excluido) {
  _showToast('Erro ao atualizar etapa' + (r && r.erro ? ': ' + _supaErrPt(r.erro.message) : ''), 'erro');
  if (etapaAnterior) _moverCardProjetoParaColuna(id, etapaAnterior);
  return;
 }
 if (r.conflito) {
  _showToast(_ccMsgConflito('projetos', r.campos), 'erro');
  _moverCardProjetoParaColuna(id, (r.atual && r.atual.etapa_projeto) || etapaAnterior);
  return;
 }
 if (_spProjAtivo && String(_spProjAtivo.id) === String(id)) {
  _spProjAtivo.etapa_projeto = novaEtapa;
  if (typeof _srchSelSelectItem === 'function') _srchSelSelectItem('projEtapa', novaEtapa);
 }
 var cacheIdx = (_projetosArr || []).findIndex(function(x) { return String(x.id) === String(id); });
 if (cacheIdx !== -1) _projetosArr[cacheIdx].etapa_projeto = novaEtapa;
 var row = document.querySelector('#proj-tbody tr[data-id="' + id + '"]');
 if (row) row.dataset.etapa = novaEtapa;
 if (!(opts && opts.silent)) _showToast('Etapa atualizada para "' + novaEtapa + '"', 'ok');
 if (!r.semMudanca && typeof _umPush === 'function' && typeof _umActiveScope !== 'undefined' && _umActiveScope && !(opts && opts.skipUndo)) {
  _umPush(_umActiveScope, {
   label: 'Etapa',
   before: etapaAnterior, after: novaEtapa,
   apply: function(v) { return updateProjetoEtapa(id, v, { skipUndo: true, silent: true }); },
  });
 }
}
function _moverCardProjetoParaColuna(id, etapa) {
 var card = document.querySelector('.proj-kn-card[data-id="' + id + '"]');
 var destCol = document.querySelector('#proj-kanban .proj-kn-col[data-etapa="' + etapa.replace(/"/g,'\\"') + '"]');
 if (!card || !destCol) return;
 var destBody = destCol.querySelector('.proj-kn-body');
 if (destBody && card.parentElement !== destBody) destBody.insertBefore(card, destBody.firstChild);
 card.dataset.etapa = etapa;
 document.querySelectorAll('#proj-kanban .proj-kn-col').forEach(function(col) {
  var badge = col.querySelector('.proj-kn-count');
  if (badge) badge.textContent = col.querySelectorAll('.proj-kn-card').length;
 });
}

function _spProjetos(row, tds) {
 _spProjetoById(row.dataset.id);
}

// ── Renderer: Projeto por id ────────────────────────────────────────────────
// Extraído do antigo _spProjetos(row, tds), que lia tds[N].innerText (texto de
// célula formatado/truncado) — mesmo padrão já aplicado a _spObras/_spContatos
// (ver obras.js/empresas.js). Busca no cache _projetosArr (preenchido por
// _dbLoadProjetos); se o painel for aberto por um chip de OUTRA entidade antes
// da página Projetos ter sido visitada (cache ainda vazio), cai para uma busca
// direta no Supabase por id — mesma estratégia de fallback do _spObraById.
async function _spProjetoById(id) {
 if (!id) return;
 // Achado real (não era mais heurística de arraste): quando o card do
 // Kanban chama isto direto (_onProjCardClick), sem passar por _spOpen
 // (side-panel.js — que é quem normalmente adiciona a classe .sp-open ao
 // clicar numa <tr> da Tabela), o overlay/drawer só abriam no branch de
 // "projeto não estava em cache" (linhas abaixo). Só que _projetosArr já
 // vem preenchido de qualquer visita à aba Projetos (_dbLoadProjetos roda
 // sempre que a página é navegada — ver app.js), então o card do Kanban
 // SEMPRE caía no branch de cache-hit acima, que renderizava o conteúdo do
 // painel só que sem nunca abrir o drawer (transform:translateX(100%) e
 // opacity:0 continuavam valendo) — o clique "não fazia nada" na tela,
 // mesmo com o listener disparando certinho e o conteúdo sendo montado
 // por trás. Corrigido abrindo o overlay/drawer incondicionalmente, antes
 // de checar o cache.
 document.getElementById('sp-overlay').classList.add('sp-open');
 document.getElementById('sp-drawer').classList.add('sp-open');
 if (typeof _spTrackDirectOpen === 'function') _spTrackDirectOpen('projetos', id);
 // Garante o mapa de nomes de Obra mesmo quando o painel é aberto sem a
 // Tabela de Projetos ter carregado antes (ex.: chip vindo de outra
 // entidade) — mesmo motivo/fix de _garantirObraIdMap em _dbLoadProjetos.
 // _garantirProdutosArr: mesmo motivo — sem isso o dropdown de Produto
 // abria sem nenhuma opção pra escolher (achado real).
 await Promise.all([_garantirObraIdMap(), _garantirProdutosArr()]);
 var idx = (_projetosArr || []).findIndex(function(x){ return String(x.id) === String(id); });
 var p = idx !== -1 ? _projetosArr[idx] : null;
 if (p) { _spProjetoRender(p, idx); return; }

 _spSet('Projeto', 'Carregando...', '<div style="padding:40px;text-align:center;color:var(--muted)">Buscando dados...</div>', '');
 if (!_sb) return;
 _sb.from('projetos').select('*').eq('id', id).single().then(function(res) {
  if (res.error || !res.data) {
   _spSet('Projeto', 'Erro', '<div style="color:var(--red);padding:20px">Projeto não encontrado.</div>', '');
   return;
  }
  if (Array.isArray(res.data.responsavel)) res.data.responsavel = _emailsToNomes(res.data.responsavel);
  _spProjetoRender(res.data, -1);
 });
}

// Cores de Tipo/Etapa — mesmos mapas literais já usados no Kanban de
// Projetos (_renderProjetosKanban, acima) e no card de Projeto vinculado
// no detalhamento de Obra (obras.js) — mantidos como cópia local (não são
// globais em nenhum dos dois lugares) só pra não inventar uma paleta nova.
// Aliases pros mapas únicos BADGE_TIPO_OBRA/BADGE_ETAPA_PROJETO
// (scripts/lib/badge-colors.js) — mesma ideia dos aliases em obras.js.
var _projTipoCls = BADGE_TIPO_OBRA;
var _projEtapaCls = BADGE_ETAPA_PROJETO;

// Auditoria: criado_por é NOVO (coluna + trigger trg_projetos_criado_por
// adicionados agora, pedido explícito) — só passa a ter valor real em
// projetos criados a partir de hoje; os já existentes mostram "—" porque
// esse dado nunca foi gravado antes (nunca existiu no Airtable/migração).
// atualizado_por/created_at/updated_at já existiam (trigger
// set_projetos_atualizado_por + set_updated_at), mesmo padrão de rodapé
// discreto já usado no painel de Empresa (_spEmpresas, empresas.js).
function _projAuditNome(email) {
 if (!email) return '—';
 var u = (_usuariosCache || []).find(function(x){ return x.email === email; });
 return (u && u.nome_display) || email;
}

// Rótulos amigáveis dos campos de Projeto — o MESMO mapa serve pro histórico
// de alterações ("Fulano alterou Etapa do projeto de X para Y") e pra
// mensagem de conflito de concorrência, pra os dois nunca divergirem.
// Rótulo null = campo técnico/de auditoria, fora do histórico.
var _PROJ_CAMPO_LABEL = {
 nome: 'Nome', tipo_orcamento: 'Tipo', produto: 'Produto',
 etapa_projeto: 'Etapa do projeto', quantidade: 'Quantidade',
 valor_unitario: 'Valor unitário', peso_kg: 'Peso total',
 m2_estrutura: 'm² de estrutura', m2_arquitetura: 'm² de arquitetura',
 maior_peca: 'Maior peça', descritivo: 'Descritivo',
 responsavel: 'Responsável', obra_id: 'Obra vinculada', empresa_id: 'Empresa',
 updated_at: null, created_at: null, criado_por: null, atualizado_por: null,
 id: null, airtable_id: null,
};
if (typeof _ccRegistrarLabels === 'function') _ccRegistrarLabels('projetos', _PROJ_CAMPO_LABEL);

var _spProjAtivo = null; // projeto atualmente aberto no painel (autosave/recalc lêem daqui)
var _projTipoOpcoesAtuais = []; // tipo(s) de obra da Obra vinculada — restringe as opções do pill-select de Tipo

// Tipo de obra do projeto — pills coloridas clicáveis (seleção única),
// mesmo padrão/cor já usado em Tipo(s) de obra (_NO_TIPO_COR,
// wizard-nova-obra.js) e nos sub-forms "+ Adicionar projeto" de Obra/
// Entrega (obras.js/entregas.js) — pedido explícito: editável aqui
// também, restrito aos tipos já marcados pra Obra vinculada.
function _projTipoPillsHTML(opcoes, tipoAtual) {
 // Pedido explícito: sem obra vinculada (ou obra sem nenhum Tipo de obra
 // marcado), o Tipo do projeto ficava travado — nada renderizado, sem
 // jeito de escolher, mesmo sendo campo obrigatório. Cai pra lista
 // completa de tipos (_NO_TIPOS_OPCOES, wizard-nova-obra.js) nesse caso,
 // em vez de bloquear.
 var opcoesReais = (opcoes && opcoes.length) ? opcoes : (_NO_TIPOS_OPCOES || []);
 if (!opcoesReais.length) return '<span style="color:var(--muted);font-size:12px">Nenhum tipo disponível.</span>';
 return opcoesReais.map(function(t) {
  var sel = t === tipoAtual;
  var cor = (typeof _NO_TIPO_COR !== 'undefined' && _NO_TIPO_COR[t]) || 'var(--navy)';
  return '<button type="button" onclick="_projTipoToggle(\'' + t.replace(/'/g,"\\'") + '\')" style="padding:6px 12px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;border:1.5px solid ' + cor + ';background:' + (sel?cor:'transparent') + ';color:' + (sel?'#fff':cor) + '">' + t + '</button>';
 }).join('');
}
function _projTipoToggle(t) {
 if (!_spProjAtivo) return;
 _spProjAtivo.tipo_orcamento = t;
 var pillsEl = document.getElementById('sp-proj-tipo-pills');
 if (pillsEl) pillsEl.innerHTML = _projTipoPillsHTML(_projTipoOpcoesAtuais, t);
 // Produto disponível depende do tipo (_noProdutosDisponiveis) — refaz o
 // multiselect com as opções certas quando o tipo muda, mesmo espírito do
 // wizard (_noProjRender re-renderiza produto ao trocar tipo do card).
 var prodDd = document.getElementById('sp-proj-produto-dd');
 if (prodDd && typeof _noProdutosDisponiveis === 'function') {
  var produtoAtual = Array.isArray(_spProjAtivo.produto) ? _spProjAtivo.produto : [];
  prodDd.innerHTML = _msRenderDropdown('projProduto', _noProdutosDisponiveis(t).map(function(pr){return pr.nome;}), produtoAtual, '_projProdutoToggle', 'Selecione o(s) produto(s)...');
 }
 _projScheduleAutoSave();
}

// Responsável — multi-select com busca ligado a usuários reais
// (_usuariosCache), mesmo padrão do Produto acima e do dropdown de
// Responsável do wizard de Nova Obra. Estado local separado de
// _spProjAtivo.responsavel porque esse campo já chega convertido pra string
// de nomes (_emailsToNomes, usado só pra exibição) — aqui guardamos os
// nomes selecionados e convertemos de volta pra e-mails só na hora de
// salvar (_spSaveProjetoFull).
var _spProjRespSel = [];
// Padrão único de seleção de usuário do sistema (_usMultiDropdownHTML,
// scripts/lib/user-select.js) — value é o NOME (não e-mail, mesma
// convenção já usada por este campo antes: _spProjAtivo.responsavel chega
// convertido pra string de nomes, ver comentário acima).
function _projRespDropdownHTML(sel) {
 var usuarios = (_usuariosCache || []).map(function(u) { var nome = u.nome_display || u.email; return { value: nome, nome: nome }; });
 return _usMultiDropdownHTML(usuarios, sel, "_projResponsavelToggle('projResp',this.value,this.checked)", 'Selecione o(s) responsável(is)...');
}
function _projResponsavelToggle(campo, valor, checked) {
 _spProjRespSel = _msToggle(_spProjRespSel, valor, checked);
 var wrap = document.getElementById('sp-proj-responsavel-dd');
 if (wrap) wrap.innerHTML = _projRespDropdownHTML(_spProjRespSel);
 if (typeof _noReabrirDropdown === 'function') _noReabrirDropdown('sp-proj-responsavel-dd');
 _projScheduleAutoSave();
}

// Produto — multi-select com busca (_msRenderDropdown, mesmo componente já
// usado no resto do sistema pra Produto/Tipologia), pedido explícito de
// manter esse comportamento (não virar single-select).
function _projProdutoToggle(campo, valor, checked) {
 if (!_spProjAtivo) return;
 var arr = Array.isArray(_spProjAtivo.produto) ? _spProjAtivo.produto.slice() : [];
 _spProjAtivo.produto = _msToggle(arr, valor, checked);
 var prodDd = document.getElementById('sp-proj-produto-dd');
 if (prodDd) prodDd.innerHTML = _msRenderDropdown('projProduto', _noProdutosDisponiveis(_spProjAtivo.tipo_orcamento).map(function(pr){return pr.nome;}), _spProjAtivo.produto, '_projProdutoToggle', 'Selecione o(s) produto(s)...');
 if (typeof _noReabrirDropdown === 'function') _noReabrirDropdown('sp-proj-produto-dd');
 _projScheduleAutoSave();
}

// Desvincular obra — remove só o vínculo (obra_id = null), não apaga a
// obra nem o projeto. Pedido explícito: projeto continua íntegro e
// disponível pra vincular em outra obra depois (mesma mecânica de "sem
// obra" já usada pelo buscador de projeto existente no wizard,
// _noProjExistenteFiltrar — filtra por obra_id IS NULL).
async function _projDesvincularObra() {
 if (!_spProjAtivo || !_sb) return;
 if (!confirm('Desvincular este projeto da obra atual?\n\nO projeto não será excluído — só deixa de estar associado a esta obra, podendo ser vinculado a outra depois.')) return;
 var res = await _sb.from('projetos').update({ obra_id: null }).eq('id', _spProjAtivo.id);
 if (res.error) { _showToast('Erro ao desvincular: ' + _supaErrPt(res.error.message), 'erro'); return; }
 _spProjAtivo.obra_id = null;
 var cacheIdx = (_projetosArr||[]).findIndex(function(x){ return String(x.id) === String(_spProjAtivo.id); });
 if (cacheIdx !== -1) _projetosArr[cacheIdx].obra_id = null;
 _showToast('Projeto desvinculado da obra.', 'ok');
 _spProjetoRender(_spProjAtivo, -1);
}

function _spProjetoRender(p, idx) {
 _spProjAtivo = p;
 // Baseline pro controle de concorrência (concurrency.js): o estado do
 // registro como está no banco no momento em que o painel abriu. `p` vem de
 // _projetosArr, onde `responsavel` já foi convertido de array de e-mails
 // (o que está no banco) pra string de nomes (o que a UI antiga espera) —
 // sem desfazer essa conversão aqui, o diff acharia que o Responsável mudou
 // em TODO save e o campo seria regravado à toa.
 var baseProj = Object.assign({}, p);
 if (typeof baseProj.responsavel === 'string') baseProj.responsavel = _nomesStrToEmails(baseProj.responsavel);
 if (typeof _ccSetBaseline === 'function') _ccSetBaseline('projetos', p.id, baseProj);
 if (typeof _rtLimparAvisoExterno === 'function') _rtLimparAvisoExterno();
 var obraInfo = p.obra_id ? (_obraIdMap[p.obra_id] || {}) : {};
 var obraNome = obraInfo.nome || '—';
 var tipo   = p.tipo_orcamento || '';
 var qtd    = p.quantidade != null ? Number(p.quantidade) : null;
 var vU     = p.valor_unitario != null ? Number(p.valor_unitario) : null;
 var vT     = (vU != null && qtd != null) ? vU * qtd : vU;
 var fmtBRL = function(v){ return v != null ? Number(v).toLocaleString('pt-BR', {style:'currency',currency:'BRL'}) : ''; };
 var etapaAtual = (p.etapa_projeto || '').trim();
 // Peso: peso_kg no banco SEMPRE foi o TOTAL (confirmado em submitNovoProjeto
 // acima: `peso_kg: qtd*pesoUnitário`, nunca existiu coluna de peso unitário)
 // — "Peso unitário" aqui é só um campo derivado (peso_kg/quantidade) pra
 // edição; "Peso total" continua sendo o que persiste em peso_kg, calculado
 // automaticamente a cada troca de unitário/quantidade (pedido explícito:
 // usuário não deve digitar o total).
 var pesoTotalAtual = p.peso_kg != null ? Number(p.peso_kg) : null;
 var pesoUnitAtual  = (pesoTotalAtual != null && qtd) ? pesoTotalAtual / qtd : pesoTotalAtual;

 var produtoAtual = Array.isArray(p.produto) ? p.produto.slice() : (p.produto ? [p.produto] : []);

 // Etapa do projeto — mesmo componente de busca+single-select já usado em
 // Etapa do Negócio (obras.js, kind 'etapa') e em qualquer outro campo de
 // seleção única do sistema (searchable-select.js) — pedido explícito de
 // manter EXATAMENTE o padrão visual/comportamento já existente, não um
 // <input> de texto livre nem componente novo.
 _srchSelRegister('projEtapa', {
  options: _projetosKanbanEtapaOrder, placeholder: 'Nenhuma etapa',
  onSelect: function() { _projScheduleAutoSave(); },
 });
 // p.responsavel já chega aqui convertido de array-de-e-mails pra string
 // "Nome1, Nome2" (ver _emailsToNomes, chamado antes de _spProjetoRender
 // tanto no caminho de cache quanto no fetch direto por id) — desfaz pra
 // popular o multiselect com os nomes já marcados.
 var _respNomesAtuais = p.responsavel ? String(p.responsavel).split(', ').filter(Boolean) : [];
 _spProjRespSel = _respNomesAtuais.slice();

 var html = `
  <input type="hidden" id="sp-proj-id" value="${p.id}">
  <div class="sp-field"><div class="sp-label">Nome do projeto <span class="req">*</span></div>
   <input class="sp-inp" id="sp-proj-nome" style="text-transform:uppercase" value="${(p.nome||'').replace(/"/g,'&quot;')}" oninput="_upperCaseInput(this);_projScheduleAutoSave()"></div>
  <div class="sp-g2">
   <div class="sp-field"><div class="sp-label">Tipo <span class="req">*</span></div><div id="sp-proj-tipo-pills" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">${_projTipoPillsHTML([tipo].filter(Boolean), tipo)}</div></div>
   <div class="sp-field"><div class="sp-label">Produto <span class="req">*</span></div><div id="sp-proj-produto-dd" class="no-msel-wide" style="margin-top:4px">${_msRenderDropdown('projProduto', _noProdutosDisponiveis(tipo).map(function(pr){return pr.nome;}), produtoAtual, '_projProdutoToggle', 'Selecione o(s) produto(s)...')}</div></div>
  </div>
  <div class="sp-field"><div class="sp-label">Obra vinculada</div>
   <div style="display:flex;align-items:center;gap:8px">
    <div id="sp-proj-obra-chip" class="sp-rel-chips-wrap" style="flex:1"></div>
    ${p.obra_id ? '<button type=\"button\" class=\"btn btn-ghost\" style=\"padding:4px 10px;font-size:11px;flex-shrink:0\" onclick=\"_projDesvincularObra()\">Desvincular</button>' : ''}
   </div>
  </div>
  <div class="sp-field"><div class="sp-label">Etapa do projeto <span class="req">*</span></div>${_srchSelMarkup('projEtapa', 'sp-proj-etapa', etapaAtual, _badgeCls(BADGE_ETAPA_PROJETO, etapaAtual), BADGE_ETAPA_PROJETO)}</div>

  ${!p.obra_id ? '' : `
  <div class="sp-stitle">Informações técnicas</div>
  <div class="sp-g3">
   <div class="sp-field"><div class="sp-label">Quantidade</div><input class="sp-inp" id="sp-proj-qtd" type="number" min="0" value="${qtd != null ? qtd : ''}" oninput="_projRecalc();_projScheduleAutoSave()"></div>
   <div class="sp-field"><div class="sp-label">Valor unitário</div><input class="sp-inp" id="sp-proj-vunit" value="${vU != null ? fmtBRL(vU) : ''}" onfocus="_spValorFocus(this)" onblur="_spValorBlur(this);_projRecalc();_projScheduleAutoSave()"></div>
   <div class="sp-field"><div class="sp-label">Valor total</div><input class="sp-inp" id="sp-proj-vtotal" value="${vT != null ? fmtBRL(vT) : ''}" readonly></div>
  </div>
  <div class="sp-g3">
   <div class="sp-field"><div class="sp-label">M² Estrutura</div><input class="sp-inp" id="sp-proj-m2estr" type="number" min="0" step="0.01" value="${p.m2_estrutura != null ? p.m2_estrutura : ''}" oninput="_projScheduleAutoSave()"></div>
   <div class="sp-field"><div class="sp-label">M² Arquitetura</div><input class="sp-inp" id="sp-proj-m2arq" type="number" min="0" step="0.01" value="${p.m2_arquitetura != null ? p.m2_arquitetura : ''}" oninput="_projScheduleAutoSave()"></div>
   <div class="sp-field"><div class="sp-label">Maior peça</div><input class="sp-inp" id="sp-proj-maiorpeca" value="${(p.maior_peca||'').replace(/"/g,'&quot;')}" oninput="_projScheduleAutoSave()"></div>
  </div>
  <div class="sp-g2">
   <div class="sp-field"><div class="sp-label">Peso unitário (kg)</div><input class="sp-inp" id="sp-proj-pesouni" type="number" min="0" step="0.01" value="${pesoUnitAtual != null ? pesoUnitAtual : ''}" oninput="_projRecalc();_projScheduleAutoSave()"></div>
   <div class="sp-field"><div class="sp-label">Peso total (kg)</div><input class="sp-inp" id="sp-proj-pesototal" value="${pesoTotalAtual != null ? Number(pesoTotalAtual).toLocaleString('pt-BR',{minimumFractionDigits:2}) : ''}" readonly></div>
  </div>
  <div class="sp-g2">
   <div class="sp-field"><div class="sp-label">Cidade</div><div id="sp-proj-cidade" style="padding:6px 0"><span style="font-size:12px;color:var(--muted)">Carregando...</span></div></div>
   <div class="sp-field"><div class="sp-label">Estado</div><div id="sp-proj-estado" style="padding:6px 0"><span style="font-size:12px;color:var(--muted)">Carregando...</span></div></div>
  </div>
  `}
  <div class="sp-field"><div class="sp-label">Responsável</div><div id="sp-proj-responsavel-dd" class="no-msel-wide">${_projRespDropdownHTML(_respNomesAtuais)}</div></div>
  <div class="sp-field"><div class="sp-label">Descritivo do projeto</div><textarea class="sp-inp" id="sp-proj-desc" rows="3" oninput="_projScheduleAutoSave()">${(p.descritivo||'')}</textarea></div>

  <div class="sp-stitle">Melhorias vinculadas</div>
  <div id="sp-proj-melhorias" class="sp-rel-chips-wrap">
   <div style="font-size:12px;color:var(--muted);padding:12px 0">Carregando melhorias...</div>
  </div>

  <div class="sp-stitle">Fotos do Projeto</div>
  <!-- Achado real: só existia a lista genérica de arquivo (nome + botão
       Visualizar, ver _PROJ_DOC_TIPOS/_projDocSectionHTML) — nenhuma prévia
       de imagem de verdade, diferente da galeria "Registros fotográficos"
       que já existe no detalhamento de Obra (_spCarregarRegistros/
       _spRegistrosDropzone, obras.js). Mesma galeria com miniaturas +
       upload por clique/arraste, só que escopada a ESTE projeto (a de Obra
       agrega de todos os projetos vinculados). Mesmo tipo='fotos_obra' e
       mesmo bucket/tabela — reaproveita _spUploadRegistro sem duplicar. -->
  <div id="sp-proj-fotos-info" style="font-size:11px;color:var(--muted);margin-bottom:6px"></div>
  <div id="sp-proj-fotos-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:8px;margin-bottom:8px"></div>
  <label id="sp-proj-fotos-dz" style="display:flex;align-items:center;justify-content:center;gap:6px;border:2px dashed var(--border);border-radius:8px;padding:12px 8px;cursor:pointer;transition:border-color .15s,background .15s;text-align:center;font-size:11px;color:var(--muted);margin-bottom:20px"
   onmouseover="this.style.borderColor='var(--navy)';this.style.background='rgba(59,130,246,.04)'"
   onmouseout="this.style.borderColor='var(--border)';this.style.background=''"
   ondragover="event.preventDefault();this.style.borderColor='var(--navy)';this.style.background='rgba(59,130,246,.07)'"
   ondragleave="this.style.borderColor='var(--border)';this.style.background=''"
   ondrop="_projFotosDrop(event)">
   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.7"><path d="M12 16V8M8 12l4-4 4 4"/><path d="M20 16.5A4.5 4.5 0 0015.5 12H15a6 6 0 10-11.8 1.5"/></svg>
   <span id="sp-proj-fotos-dz-lbl">Clique ou arraste fotos para adicionar</span>
   <input type="file" id="sp-proj-fotos-file" accept="image/*" multiple style="display:none" onchange="_projFotosFileChange(this)">
  </label>

  <div class="sp-stitle">Documentos</div>
  <div id="sp-proj-docs">
   <div style="font-size:12px;color:var(--muted);padding:12px 0">Carregando documentos...</div>
  </div>

  <div class="sp-stitle">Tarefas</div>
  <div id="sp-proj-tarefas">
   <div style="font-size:12px;color:var(--muted);padding:12px 0">Carregando tarefas...</div>
  </div>

  ${_projAuditHTML(p)}

  <div class="sp-stitle">Histórico de alterações</div>
  ${typeof _histPanelHTML === 'function' ? _histPanelHTML('sp-proj-historico') : ''}
 `;

 // Excluir projeto disponível pra qualquer usuário (pedido explícito, sem
 // checagem de isAdmin) — diferente de Obra/Entrega, que restringem a
 // admin (obras.js, _spExcluirObra/_spExcluirEntrega); RLS de `projetos`
 // já é aberta a qualquer autenticado (authenticated_all_projetos, cmd ALL),
 // então não havia bloqueio de banco a ajustar aqui.
 _spSet('Projeto', p.nome || '(sem nome)', html,
  '<button class="btn btn-ghost" style="color:var(--red);border-color:var(--red);margin-right:auto" onclick="_spExcluirProjeto(\'' + p.id + '\',\'' + (p.nome||'').replace(/'/g,"\\'") + '\')">Excluir projeto</button> '
  + '<button class="btn btn-ghost" onclick="closePanel()">Fechar</button>');

 // Obra vinculada — chip clicável, mesmo padrão de Empresa/Contato
 // vinculados usado em todo o app (_spRelChipHTML/_spOpenEntityById).
 var obraChipEl = document.getElementById('sp-proj-obra-chip');
 if (obraChipEl) {
  obraChipEl.innerHTML = p.obra_id
   ? _spRelChipHTML('obras', p.obra_id, obraNome)
   : '<div class="sp-empty">Nenhuma obra vinculada.</div>';
 }

 // Cidade/Estado — Projeto NÃO tem essas colunas (verificado no schema);
 // no Airtable eram um rollup automático vindo da Obra. Decisão confirmada
 // com a usuária (AskUserQuestion): mostrar só leitura, lidas da Obra
 // vinculada, sem criar coluna nova em `projetos`.
 // Tipo(s) de obra da Obra vinculada também vem junto nessa mesma consulta
 // — pedido explícito: o Tipo do projeto só pode ser um dos tipos já
 // marcados pra obra (mesma regra já aplicada no wizard/"+Adicionar
 // projeto" de Obra/Entrega), então as opções do pill-select dependem do
 // que a Obra tem — só dá pra saber depois de buscar.
 (function() {
  var cidEl = document.getElementById('sp-proj-cidade');
  var estEl = document.getElementById('sp-proj-estado');
  if (!cidEl || !estEl) return;
  if (!p.obra_id || !_sb) {
   cidEl.innerHTML = '—'; estEl.innerHTML = '—';
   _projTipoOpcoesAtuais = [];
   var pillsElVazio = document.getElementById('sp-proj-tipo-pills');
   if (pillsElVazio) pillsElVazio.innerHTML = _projTipoPillsHTML(_NO_TIPOS_OPCOES || [], p.tipo_orcamento || '');
   return;
  }
  _sb.from('obras').select('cidade,estado,tipo_obra').eq('id', p.obra_id).single().then(function(res) {
   var cidVal = res.data && res.data.cidade;
   var estVal = res.data && res.data.estado;
   cidEl.innerHTML = cidVal ? _badgeHTML(cidVal, 'bm') : '—';
   estEl.innerHTML = estVal ? _badgeHTML(estVal, 'bm') : '—';
   var opcoes = (res.data && res.data.tipo_obra) || [];
   _projTipoOpcoesAtuais = opcoes;
   // Se o tipo atual do projeto não é mais um dos tipos da obra (obra
   // teve o(s) tipo(s) alterado(s) depois), reseta em vez de deixar o
   // card preso num valor que não aparece mais nos botões — mesma regra
   // do wizard (_noProjRender).
   if (p.tipo_orcamento && opcoes.indexOf(p.tipo_orcamento) === -1) { p.tipo_orcamento = ''; _projScheduleAutoSave(); }
   var pillsEl = document.getElementById('sp-proj-tipo-pills');
   if (pillsEl) pillsEl.innerHTML = _projTipoPillsHTML(opcoes, p.tipo_orcamento || '');
  });
 })();

 // Melhorias vinculadas — melhorias.projeto_id É a FK (o inverso de um
 // select: a melhoria escolhe o projeto, não o contrário), então aqui é só
 // uma lista de leitura, mesmo espírito de "Empresa vinculada" mas sem
 // painel de detalhe próprio pra abrir (melhorias.js não tem um — módulo é
 // só lista/kanban), por isso as tags não são clicáveis.
 (function() {
  var melEl = document.getElementById('sp-proj-melhorias');
  if (!melEl || !_sb) return;
  _sb.from('melhorias').select('id,nome,status').eq('projeto_id', p.id).then(function(res) {
   var rows = (res.data || []);
   if (!rows.length) { melEl.innerHTML = '<div class="sp-empty">Nenhuma melhoria vinculada a este projeto.</div>'; return; }
   melEl.innerHTML = rows.map(function(m) {
    return '<div class="sp-rel-chip" style="cursor:default" title="' + (m.nome||'').replace(/"/g,'&quot;') + '">'
     + '<span class="sp-rel-chip-dot" style="background:#8B8B94"></span>'
     + '<span class="sp-rel-chip-label">' + (m.nome||'(sem nome)').replace(/</g,'&lt;') + '</span>'
     + (m.status ? '<span class="sp-rel-chip-sub">' + m.status + '</span>' : '')
     + '</div>';
   }).join('');
  });
 })();

 _projFotosCarregar(p.id, p.obra_id);
 _projDocsCarregar(p.id, p.obra_id);
 _projTarefasCarregar(p.id);
 // Histórico de alterações (audit_log) — mesmo componente compartilhado que
 // Obra e Entrega usam (scripts/lib/historico.js). Carrega depois do render
 // pra não segurar a abertura do painel.
 if (typeof _histCarregar === 'function') _histCarregar('sp-proj-historico', 'projetos', p.id);

 // Responsável: se _usuariosCache e/ou o cache de avatares (_avatarCache,
 // avatar-helpers.js) ainda não tinham carregado quando o dropdown foi
 // montado acima (raro — os dois carregam em segundo plano desde o boot
 // do app, ver _dbInit em app.js), refaz assim que chegarem. Mesmo padrão
 // defensivo já usado em obras.js/entregas.js pro form de Responsável.
 var respPrecisaRecarregar = !(_usuariosCache || []).length
  || (typeof _avatarCache !== 'undefined' && !Object.keys(_avatarCache).length);
 if (respPrecisaRecarregar) {
  Promise.all([
   (typeof _loadUsuariosCache === 'function') ? _loadUsuariosCache() : Promise.resolve(),
   (typeof _loadAvatarCacheFast === 'function') ? _loadAvatarCacheFast() : Promise.resolve(),
  ]).then(function() {
   var wrap = document.getElementById('sp-proj-responsavel-dd');
   if (wrap) wrap.innerHTML = _projRespDropdownHTML(_spProjRespSel);
  });
 }
}

// ── Auditoria (rodapé) ────────────────────────────────────────────────────────
function _projAuditHTML(p) {
 return '<div style="margin-top:24px;border-top:1px solid var(--border);padding-top:12px">'
  + '<div style="font-size:10px;font-weight:600;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px;opacity:.85">Auditoria</div>'
  + '<div class="drw-audit-row"><span class="drw-audit-lbl">Criado por</span><span class="drw-audit-val">'+_projAuditNome(p.criado_por)+'</span></div>'
  + '<div class="drw-audit-row"><span class="drw-audit-lbl">Data de criação</span><span class="drw-audit-val">'+(p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '—')+'</span></div>'
  + '<div class="drw-audit-row"><span class="drw-audit-lbl">Última alteração por</span><span class="drw-audit-val">'+_projAuditNome(p.atualizado_por)+'</span></div>'
  + '<div class="drw-audit-row"><span class="drw-audit-lbl">Data de última alteração</span><span class="drw-audit-val">'+(p.updated_at ? new Date(p.updated_at).toLocaleString('pt-BR') : '—')+'</span></div>'
  + '</div>';
}

// ── Recalcula Valor total / Peso total ao vivo (sem persistir ainda —
// _spSaveProjetoFull faz isso no autosave debounced) ─────────────────────────
function _projRecalc() {
 var qtdEl = document.getElementById('sp-proj-qtd');
 var vUnitEl = document.getElementById('sp-proj-vunit');
 var vTotEl = document.getElementById('sp-proj-vtotal');
 var pUnitEl = document.getElementById('sp-proj-pesouni');
 var pTotEl = document.getElementById('sp-proj-pesototal');
 var qtd = parseFloat(qtdEl?.value) || 0;
 var vUnit = parseFloat((vUnitEl?.value||'').replace(/[^\d,-]/g,'').replace(',','.')) || 0;
 var pUnit = parseFloat(pUnitEl?.value) || 0;
 if (vTotEl) vTotEl.value = (qtd && vUnit) ? (qtd*vUnit).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : '';
 if (pTotEl) pTotEl.value = (qtd && pUnit) ? (qtd*pUnit).toLocaleString('pt-BR',{minimumFractionDigits:2}) : '';
}

// ── Autosave (mesmo espírito de _obraScheduleAutoSave/_spSaveObraFull,
// obras.js: debounce de 700ms, sem botão "Salvar") ────────────────────────────
var _projAutoSaveTimer = null;
function _projScheduleAutoSave() {
 if (_projAutoSaveTimer) clearTimeout(_projAutoSaveTimer);
 _projAutoSaveTimer = setTimeout(function(){ _spSaveProjetoFull(); }, 700);
}
async function _spSaveProjetoFull() {
 if (_projAutoSaveTimer) { clearTimeout(_projAutoSaveTimer); _projAutoSaveTimer = null; }
 var id = document.getElementById('sp-proj-id')?.value;
 if (!id || !_sb) return;
 var qtd = parseFloat(document.getElementById('sp-proj-qtd')?.value) || null;
 var vUnitStr = (document.getElementById('sp-proj-vunit')?.value || '').replace(/[^\d,-]/g,'').replace(',','.');
 var vUnit = vUnitStr ? parseFloat(vUnitStr) : null;
 var pUnit = parseFloat(document.getElementById('sp-proj-pesouni')?.value) || null;
 var payload = {
  nome: (document.getElementById('sp-proj-nome')?.value || '').toUpperCase(),
  // Tipo/Produto mudam via clique nos pills/multiselect (_projTipoToggle/
  // _projProdutoToggle), que já mutam _spProjAtivo direto — não tem
  // <input>/<select> nativo pra ler aqui, mesmo espírito de Tipo(s) de
  // obra no detalhamento de Obra (obras.js lê de _obraAtiva, não do DOM).
  tipo_orcamento: (_spProjAtivo && _spProjAtivo.tipo_orcamento) || null,
  produto: (_spProjAtivo && Array.isArray(_spProjAtivo.produto) && _spProjAtivo.produto.length) ? _spProjAtivo.produto : null,
  etapa_projeto: document.getElementById('sp-proj-etapa')?.value || null,
  quantidade: qtd,
  valor_unitario: vUnit,
  m2_estrutura: parseFloat(document.getElementById('sp-proj-m2estr')?.value) || null,
  m2_arquitetura: parseFloat(document.getElementById('sp-proj-m2arq')?.value) || null,
  maior_peca: (document.getElementById('sp-proj-maiorpeca')?.value || '').trim() || null,
  // Peso total é o que persiste (peso_kg sempre foi "o total" no schema,
  // ver comentário em _spProjetoRender) — calculado aqui, nunca digitado.
  peso_kg: (qtd && pUnit) ? qtd * pUnit : null,
  descritivo: (document.getElementById('sp-proj-desc')?.value || '').trim() || null,
  // updated_at fica por conta do trigger trg_projetos_updated_at (banco) —
  // mandá-lo do cliente era ignorado na prática e atrapalhava o diff de
  // campos alterados do controle de concorrência.
 };
 // Responsável: _spProjRespSel guarda nomes selecionados (multiselect não
 // tem <select> nativo pra ler) — converte pra e-mails contra _usuariosCache
 // na hora de salvar, mesmo padrão do modal de criação (_npResponsavelSel).
 var respEmails = (_usuariosCache || [])
  .filter(function(u){ return _spProjRespSel.indexOf(u.nome_display || u.email) !== -1; })
  .map(function(u){ return u.email; });
 payload.responsavel = respEmails.length ? respEmails : null;
 // Nome/Tipo/Produto/Etapa são obrigatórios (mesma regra do formulário de
 // criação — Novo Projeto, wizard/obras.js) — levantamento de campos
 // obrigatórios achou que aqui no autosave do detalhamento dava pra limpar
 // qualquer um deles e salvar vazio sem aviso, mesmo com o asterisco.
 // Ignora só o(s) campo(s) esvaziado(s) (devolve o valor anterior) em vez
 // de recusar a alteração inteira.
 var faltando = [];
 if (!payload.nome) {
  faltando.push('Nome do projeto'); delete payload.nome;
  var elNome = document.getElementById('sp-proj-nome'); if (elNome && _spProjAtivo) elNome.value = _spProjAtivo.nome || '';
 }
 if (!payload.tipo_orcamento) { faltando.push('Tipo'); delete payload.tipo_orcamento; }
 if (!payload.produto) { faltando.push('Produto'); delete payload.produto; }
 if (!payload.etapa_projeto) {
  faltando.push('Etapa do projeto'); delete payload.etapa_projeto;
  if (_spProjAtivo && typeof _srchSelSelectItem === 'function') _srchSelSelectItem('projEtapa', _spProjAtivo.etapa_projeto || '');
 }
 if (faltando.length) _showToast('Campo obrigatório: ' + faltando.join(', ') + '. Alteração não foi salva.', 'erro');
 if (!Object.keys(payload).length) return;
 // Trava otimista + diff de campos (concurrency.js). Antes era um
 // `.update(payload).eq('id', id)` cru, que regravava TODOS os campos do
 // painel a cada 700ms de digitação — inclusive os que este usuário não
 // tocou, desfazendo em silêncio o que outro usuário tivesse acabado de
 // salvar no mesmo projeto.
 var _umBaselineAntes = (typeof _ccGetBaseline === 'function' ? _ccGetBaseline('projetos', id) : null) || {};
 var r = await _ccSaveComFeedback('projetos', id, payload, {
  onRecarregar: function () { _spProjetoById(id); },
 });
 if (!r || !r.ok) return;
 // _spProjAtivo/_projetosArr guardam responsavel como STRING de nomes
 // (convenção do resto do arquivo — ver _emailsToNomes em _dbLoadProjetos/
 // _spProjetoById), não o array de e-mails que acabou de ir pro banco;
 // sem essa conversão, reabrir este projeto sem recarregar a página
 // quebraria o split(', ') que popula o multiselect de Responsável.
 _projPatchNaLista(r.row);
 // Ctrl+Z (undo-manager.js) — mesmo padrão de Obras/_spSaveObraFull: uma
 // entrada por autosave, só com os campos que r.campos (diff real do
 // _ccSave) confirma terem mudado.
 if (typeof _umPush === 'function' && typeof _umActiveScope !== 'undefined' && _umActiveScope && r.campos && r.campos.length) {
  var _umBefore = {}, _umAfter = {};
  r.campos.forEach(function(k) { _umBefore[k] = _umBaselineAntes[k]; _umAfter[k] = r.row[k]; });
  var _umNomes = r.campos.map(function(c) { return typeof _ccLabel === 'function' ? _ccLabel('projetos', c) : c; }).filter(Boolean);
  _umPush(_umActiveScope, {
   label: _umNomes.length === 1 ? _umNomes[0] : (_umNomes.length ? _umNomes.length + ' campos' : null),
   before: _umBefore, after: _umAfter,
   apply: function(v) { return _projUndoApply(id, v); },
  });
 }
}

// Reaproveitado pelo Ctrl+Z/Ctrl+Shift+Z — mesmo padrão de _obraUndoApply
// (obras.js): _ccSave direto (sem o toast "Alteração salva" próprio, o
// undo-manager já mostra o dele), atualiza a linha/Kanban e repopula o
// painel de detalhe se ele ainda estiver aberto NESTE projeto.
function _projUndoApply(id, values) {
 return _ccSave('projetos', id, values).then(function(r) {
  if (!r || r.erro) throw (r && r.erro) || new Error('Falha ao salvar');
  if (r.excluido) throw new Error('Projeto excluído por outro usuário');
  if (r.conflito) {
   _showToast(_ccMsgConflito('projetos', r.campos), 'erro');
   throw new Error('Conflito de edição concorrente');
  }
  if (r.semMudanca) return;
  _projPatchNaLista(r.row);
  if (_spProjAtivo && String(_spProjAtivo.id) === String(id)) _spProjetoById(id);
 });
}

// ── Atualização pontual de UM projeto na Tabela/Kanban ───────────────────────
// Espelha no cache em memória e redesenha só a <tr>/card daquele projeto —
// nunca a lista inteira, pra não perder filtro/agrupamento/ordenação/scroll de
// quem estiver olhando a grade. Usado pelo autosave e pelos eventos de tempo
// real (_projetosIniciarTempoReal).
function _projPatchNaLista(row, realce) {
 if (!row || !row.id) return;
 var doCache = Object.assign({}, row);
 if ('responsavel' in doCache) doCache.responsavel = _emailsToNomes(doCache.responsavel);
 if (_spProjAtivo && String(_spProjAtivo.id) === String(row.id)) Object.assign(_spProjAtivo, doCache);
 var idx = (_projetosArr || []).findIndex(function (x) { return String(x.id) === String(row.id); });
 if (idx !== -1) Object.assign(_projetosArr[idx], doCache); else _projetosArr.unshift(doCache);

 var tr = document.querySelector('#proj-tbody tr[data-id="' + row.id + '"]');
 if (tr) {
  // data-* alimentam filtro/ordenação/agrupamento — precisam acompanhar o
  // valor novo, senão a linha continuaria sendo filtrada pelo antigo.
  if (doCache.nome != null) tr.dataset.nome = doCache.nome;
  if (doCache.etapa_projeto != null) tr.dataset.etapa = doCache.etapa_projeto;
  if (doCache.tipo_orcamento != null) tr.dataset.tipo = doCache.tipo_orcamento;
  if (doCache.updated_at) tr.dataset.updatedat = String(doCache.updated_at).slice(0, 10);
  if (realce) {
   tr.style.transition = 'background .9s';
   tr.style.background = 'rgba(37,99,235,.10)';
   setTimeout(function () { tr.style.background = ''; }, 1500);
  }
 }
 var card = document.querySelector('.proj-kn-card[data-id="' + row.id + '"]');
 if (card) {
  if (doCache.etapa_projeto != null) card.dataset.etapa = doCache.etapa_projeto;
  var t = card.querySelector('.oc-title, .pc-title');
  if (t && doCache.nome != null) t.textContent = doCache.nome;
 }
}

// ── Tempo real: Projetos ─────────────────────────────────────────────────────
// Mesma estratégia de Obras: assinatura por linha, com chave de módulo pra não
// duplicar handler ao voltar pra aba, e nada de recarregar a lista inteira.
function _projetosIniciarTempoReal() {
 if (typeof _rtWatchRows !== 'function') return;
 _rtWatchRows('projetos', 'projetos', {
  onUpdate: function (nova) {
   if (!nova || !nova.id) return;
   var eco = typeof _rtSouEu === 'function' && _rtSouEu(nova.atualizado_por);
   _projPatchNaLista(nova, !eco);
   if (eco) return;
   if (_spProjAtivo && String(_spProjAtivo.id) === String(nova.id)
    && document.getElementById('sp-drawer')?.classList.contains('sp-open')
    && typeof _rtAvisoAlteracaoExterna === 'function') {
    // Painel aberto: avisa, NÃO redesenha por baixo de quem pode estar
    // digitando. O baseline avança pra o merge automático continuar valendo.
    _rtAvisoAlteracaoExterna(nova.atualizado_por, "_spProjetoById('" + nova.id + "')");
    if (typeof _ccSetBaseline === 'function') _ccSetBaseline('projetos', nova.id, nova);
   }
  },
  onInsert: function (nova) {
   if (!nova || !nova.id) return;
   if ((_projetosArr || []).some(function (x) { return String(x.id) === String(nova.id); })) return;
   // A <tr> de Projetos é montada dentro do .map() de _dbLoadProjetos com
   // vários mapas auxiliares (obra/melhoria/presença de documento) que não
   // vêm no payload do tempo real — recarregar a lista é o único jeito
   // correto aqui, e só acontece quando um projeto NOVO aparece (evento
   // raro), nunca a cada edição de campo.
   if (typeof _dbLoadProjetos === 'function') _dbLoadProjetos();
  },
  onDelete: function (_nova, antiga) {
   var id = antiga && antiga.id;
   if (!id) return;
   var i = (_projetosArr || []).findIndex(function (x) { return String(x.id) === String(id); });
   if (i !== -1) _projetosArr.splice(i, 1);
   var tr = document.querySelector('#proj-tbody tr[data-id="' + id + '"]');
   if (tr) tr.remove();
   var card = document.querySelector('.proj-kn-card[data-id="' + id + '"]');
   if (card) card.remove();
   if (_spProjAtivo && String(_spProjAtivo.id) === String(id)) {
    _showToast('O projeto que você tinha aberto foi excluído por outro usuário.', 'aviso');
    closePanel();
   }
  },
 });
}

// ── Exclusão de Projeto — disponível pra qualquer usuário (pedido explícito).
// Cascata real do schema (FKs de projetos): melhorias/projetos_responsaveis/
// documentos/atividades_projetos/documentos_projetos/projetos_melhorias são
// apagados junto (ON DELETE CASCADE); propostas fica com projeto_id nulo
// (ON DELETE SET NULL) — aviso disso no confirm(), mesmo espírito de
// _spExcluirObra (obras.js).
async function _spExcluirProjeto(id, nome) {
 if (!confirm('Excluir "' + (nome || 'este projeto') + '" PERMANENTEMENTE?\n\nMelhorias, documentos e tarefas vinculados a este projeto também serão excluídos. Esta ação não pode ser desfeita.')) return;
 var res = await _sb.from('projetos').delete().eq('id', id);
 if (res.error) {
  console.error('[Projetos] erro ao excluir projeto:', res.error);
  _showToast('Não foi possível excluir este projeto. Ele NÃO foi excluído — tente de novo em instantes.', 'erro');
  return;
 }
 closePanel();
 if (typeof _dbLoadProjetos === 'function') _dbLoadProjetos();
}

// ── Documentos do Projeto — Pré-Projeto/Projeto Executivo, ambos vivem em
// `documentos` (projeto_id) no mesmo bucket 'documentos_projetos'
// (confirmado por SQL: os 155 'projeto_executivo' existentes já estão nesse
// bucket, igual aos 'fotos_obra'). 'pre_projeto' é um tipo NOVO (não existe
// nenhum documento com esse tipo ainda) — só passa a ter arquivos a partir de
// agora, mesmo espírito do que já foi feito para criado_por/maior_peca.
// 'fotos_obra' NÃO entra mais aqui — ganhou galeria própria com miniaturas
// (_projFotosCarregar, logo abaixo), em vez da lista genérica de arquivo
// (nome + botão) que os outros dois tipos continuam usando.
var _PROJ_DOC_TIPOS = [
 { tipo: 'pre_projeto', label: 'Pré-Projeto' },
 { tipo: 'projeto_executivo', label: 'Projeto Executivo' },
];
// Cards de anexo em grade — mesmo padrão exato usado no painel de Entrega
// (scripts/lib/doc-cards.js, _dc*), pedido explícito da usuária pra
// reaproveitar em toda aba de detalhe que anexe documentos. Antes era só
// uma lista de texto (nome + "Anexar arquivo"), sem miniatura e sem
// excluir.
var _PROJ_DOC_BUCKET = 'documentos_projetos';
function _projDocCategoriaHTML(cat, docs, projetoId, obraId, signedMap) {
 var thumbs = docs.map(function(d) {
  var nome = (d.nome_arquivo || 'Documento').toString();
  var pathSafe = String(d.caminho_storage || '').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  var nomeSafe = nome.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  var removeJs = "_projDocExcluir('" + d.id + "','" + pathSafe + "','" + projetoId + "','" + (obraId||'') + "')";
  return _dcThumbHTML(d, _PROJ_DOC_BUCKET, signedMap, "_spAbrirDocStorage('" + pathSafe + "','" + nomeSafe + "','" + _PROJ_DOC_BUCKET + "')", removeJs);
 });
 var inputId = 'sp-proj-doc-up-' + cat.tipo;
 var labelId = inputId + '-lbl';
 var addHtml = _dcAddHTML(inputId, labelId, "_projDocFileChange(this,'" + cat.tipo + "','" + labelId + "')");
 var attrs = _dcDragAttrs("_projDocFileDrop(event,'" + cat.tipo + "','" + labelId + "')");
 return _dcCardHTML(cat.label, docs, thumbs, addHtml, attrs);
}
async function _projDocsCarregar(projetoId, obraId) {
 var container = document.getElementById('sp-proj-docs');
 if (!container || !_sb) return;
 var res = await _sb.from('documentos').select('*').eq('projeto_id', projetoId)
  .in('tipo', _PROJ_DOC_TIPOS.map(function(t){ return t.tipo; })).order('created_at', { ascending: false });
 if (res.error) { container.innerHTML = '<div class="sp-empty" style="color:var(--red)">Erro ao carregar documentos.</div>'; return; }
 var docs = res.data || [];
 container.dataset.projetoId = projetoId;
 container.dataset.obraId = obraId || '';
 var signedMap = await _dcSignedUrlMap(docs, function(){ return _PROJ_DOC_BUCKET; });
 container.innerHTML = '<div class="doc-card-grid">' + _PROJ_DOC_TIPOS.map(function(t){
  return _projDocCategoriaHTML(t, docs.filter(function(d){ return d.tipo === t.tipo; }), projetoId, obraId, signedMap);
 }).join('') + '</div>';
}
async function _projDocUploadFiles(files, tipo, labelId) {
 if (!files || !files.length) return;
 var container = document.getElementById('sp-proj-docs');
 var projetoId = container && container.dataset.projetoId;
 var obraId = (container && container.dataset.obraId) || null;
 if (!projetoId) return;
 var lbl = document.getElementById(labelId);
 if (lbl) lbl.textContent = 'Enviando...';
 var erros = 0;
 for (var i = 0; i < files.length; i++) { if (!(await _spUploadRegistro(files[i], projetoId, obraId, tipo))) erros++; }
 if (erros) _showToast(erros + ' arquivo(s) não enviado(s). Tente novamente.', 'erro');
 _projDocsCarregar(projetoId, obraId);
}
function _projDocFileChange(input, tipo, labelId) {
 _projDocUploadFiles(Array.prototype.slice.call(input.files || []), tipo, labelId);
 input.value = '';
}
function _projDocFileDrop(event, tipo, labelId) {
 event.preventDefault();
 var files = event.dataTransfer && event.dataTransfer.files;
 _projDocUploadFiles(Array.prototype.slice.call(files || []), tipo, labelId);
}
async function _projDocExcluir(docId, path, projetoId, obraId) {
 if (!confirm('Excluir este anexo? Esta ação não pode ser desfeita.')) return;
 if (path) {
  var rm = await _sb.storage.from(_PROJ_DOC_BUCKET).remove([path]);
  if (rm.error) console.error('[Projetos] erro ao remover arquivo do storage:', rm.error);
 }
 var del = await _sb.from('documentos').delete().eq('id', docId);
 if (del.error) {
  console.error('[Projetos] erro ao excluir documento:', del.error);
  _showToast('Não foi possível excluir o anexo. Tente novamente.', 'erro');
  return;
 }
 _showToast('Anexo excluído.', 'ok');
 _projDocsCarregar(projetoId, obraId);
}

// ── Fotos do Projeto — galeria com miniaturas (documentos.tipo='fotos_obra'
// deste projeto), mesmo bucket/tabela e mesmo _spUploadRegistro já usados
// pelos Registros fotográficos da Obra (obras.js), só que sem agrupar por
// projeto (aqui só existe UM projeto — o aberto) e sem depender de um
// seletor de projeto (o id já é conhecido, ver dz.dataset.projetoId).
async function _projFotosCarregar(projetoId, obraId) {
 var container = document.getElementById('sp-proj-fotos-grid');
 var infoEl = document.getElementById('sp-proj-fotos-info');
 var dz = document.getElementById('sp-proj-fotos-dz');
 if (!container || !_sb) return;
 if (dz) { dz.dataset.projetoId = projetoId; dz.dataset.obraId = obraId || ''; }
 var res = await _sb.from('documentos').select('*').eq('tipo', 'fotos_obra').eq('projeto_id', projetoId).order('created_at', { ascending: false });
 if (res.error) { container.innerHTML = '<div class="sp-empty" style="color:var(--red)">Erro ao carregar fotos.</div>'; return; }
 var fotos = res.data || [];
 if (infoEl) infoEl.textContent = fotos.length ? (fotos.length + (fotos.length === 1 ? ' foto' : ' fotos')) : 'Nenhuma foto enviada ainda.';
 if (!fotos.length) { container.innerHTML = ''; return; }
 // Assinatura em lote — mesma otimização de _spCarregarRegistros (obras.js):
 // 1 chamada resolve as URLs de todas as fotos em vez de 1 por foto.
 var paths = fotos.map(function(f){ return f.caminho_storage; }).filter(Boolean);
 var signedMap = {};
 if (paths.length) {
  var sig = await _sb.storage.from('documentos_projetos').createSignedUrls(paths, 3600);
  if (!sig.error) (sig.data || []).forEach(function(s){ if (s.signedUrl && s.path) signedMap[s.path] = s.signedUrl; });
 }
 container.innerHTML = fotos.map(function(f) {
  var url = signedMap[f.caminho_storage];
  var nome = (f.nome_arquivo || 'Foto').toString();
  var pathSafe = String(f.caminho_storage || '').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  var nomeSafe = nome.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  var onclickAttr = url ? " onclick=\"_spAbrirDocStorage('" + pathSafe + "','" + nomeSafe + "','documentos_projetos')\"" : '';
  return '<div' + onclickAttr + ' title="' + nome.replace(/"/g,'&quot;') + '" style="cursor:' + (url ? 'pointer' : 'default') + ';border-radius:8px;overflow:hidden;border:1px solid var(--border);aspect-ratio:1;background:var(--surface2)">'
   + (url
      ? '<img src="' + url + '" alt="' + nome.replace(/"/g,'&quot;') + '" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block">'
      : '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:10px;text-align:center;padding:4px">Sem prévia</div>')
   + '</div>';
 }).join('');
}
async function _projFotosUploadFiles(files) {
 if (!files || !files.length) return;
 var dz = document.getElementById('sp-proj-fotos-dz');
 var projetoId = dz && dz.dataset.projetoId;
 var obraId = (dz && dz.dataset.obraId) || null;
 if (!projetoId) return;
 var lbl = document.getElementById('sp-proj-fotos-dz-lbl');
 if (lbl) lbl.textContent = 'Enviando...';
 var erros = 0;
 for (var i = 0; i < files.length; i++) { if (!(await _spUploadRegistro(files[i], projetoId, obraId, 'fotos_obra'))) erros++; }
 if (lbl) lbl.textContent = 'Clique ou arraste fotos para adicionar';
 if (erros) _showToast(erros + ' foto(s) não enviada(s). Tente novamente.', 'erro');
 _projFotosCarregar(projetoId, obraId);
}
function _projFotosFileChange(input) {
 _projFotosUploadFiles(Array.prototype.slice.call(input.files || []));
 input.value = '';
}
function _projFotosDrop(event) {
 event.preventDefault();
 var dz = document.getElementById('sp-proj-fotos-dz');
 if (dz) { dz.style.borderColor = 'var(--border)'; dz.style.background = ''; }
 var files = event.dataTransfer && event.dataTransfer.files;
 _projFotosUploadFiles(Array.prototype.slice.call(files || []));
}

// ── Tarefas vinculadas ao Projeto — atividades_projetos é a junção real
// (508 linhas, confirmado por SQL), mesmo padrão de "Tarefas" no
// detalhamento de Obra (obras.js, atividades_obras). Clique abre a mesma
// gaveta do Gestor de Tarefas (_taskDrawerOpen, dashboard.js).
async function _projTarefasCarregar(projetoId) {
 var container = document.getElementById('sp-proj-tarefas');
 if (!container || !_sb) return;
 var res = await _sb.from('atividades_projetos')
  .select('atividade:atividade_id(id, titulo, status, prioridade, data_prazo, responsavel)').eq('projeto_id', projetoId);
 if (res.error) { container.innerHTML = '<div class="sp-empty" style="color:var(--red)">Erro ao carregar tarefas.</div>'; return; }
 var atividades = (res.data || []).map(function(link){ return link.atividade; }).filter(Boolean);
 atividades.forEach(function(a){ if (Array.isArray(a.responsavel)) a.responsavel = _emailsToNomes(a.responsavel); });
 var _taskStatusCor = { 'Concluída':'var(--green)', 'Concluido':'var(--green)', 'Em andamento':'var(--navy)', 'Em progresso':'var(--navy)', 'Bloqueado':'var(--red)', 'Impedida':'var(--red)', 'Atrasado':'var(--red)' };
 function fmtData(d) { return d ? new Date(String(d).substring(0,10) + 'T00:00:00').toLocaleDateString('pt-BR') : '—'; }
 container.innerHTML = atividades.length
  ? atividades.map(function(a) {
     var respTxt = Array.isArray(a.responsavel) ? a.responsavel.join(', ') : (a.responsavel || '');
     return '<div class="sp-item-card" onclick="_taskDrawerOpen(\'' + a.id + '\')">'
      + '<div class="sp-item-title">' + (a.titulo || '(sem título)') + '</div>'
      + '<div class="sp-item-meta">'
      + (a.status ? '<span style="color:' + (_taskStatusCor[a.status] || 'var(--muted)') + ';font-weight:600">' + a.status + '</span><span style="color:var(--border)">|</span>' : '')
      + (a.prioridade ? '<span>Prioridade: <b>' + a.prioridade + '</b></span><span style="color:var(--border)">|</span>' : '')
      + '<span>Prazo: <b>' + fmtData(a.data_prazo) + '</b></span>'
      + '</div>'
      + (respTxt ? '<div style="margin-top:4px;font-size:11px;color:var(--muted)">' + respTxt + '</div>' : '')
      + '</div>';
    }).join('')
  : '<div class="sp-empty">Nenhuma tarefa vinculada a este projeto</div>';
}

// Filtro/Ordenação — mesmos componentes reutilizáveis do Gestor de Tarefas/
// Obras/Empresas/Instalações/Entregas (filtro-builder/sort-builder/smart-
// search). Aplica nas duas visualizações (Tabela e Kanban), igual ao Obras:
// _fbEvaluate/_sbCompare recebem o .dataset de cada <tr>/.proj-kn-card
// direto (ver data-* adicionados nos templates de _dbLoadProjetos/
// _renderProjetosKanban).
// Etapa/Cliente(Obra) viram 'select' — antes 'text' exigia digitar
// exatamente o valor, o que o pedido original aponta como bug específico
// ("filtros de Etapa e Obra... deveriam seguir o padrão de single-select").
// filtro-builder.js já mostra 'select' como lista clicável com busca
// automática acima de 8 opções — sem digitação livre.
var _projFbFields = [
 { key: 'nome',    label: 'Nome do Projeto',   type: 'text' },
 { key: 'tipo',    label: 'Tipo de orçamento', type: 'select', options: ['Telhados','Steel Frame','Modular','Solar','Misto (LSF + A36)'] },
 { key: 'etapa',   label: 'Etapa',             type: 'select', options: _projetosKanbanEtapaOrder },
 { key: 'cliente', label: 'Cliente/Obra',      type: 'text' },
 // Pedido explícito: "Obra" tem que ser select+multi (buscável, escolher
 // clicando), não texto livre — 'cliente' acima continua existindo pra
 // busca combinada empresa+obra, este aqui é o nome da Obra isolado.
 { key: 'obra',    label: 'Obra', type: 'select', options: function(){ return Object.keys(_obraIdMap||{}).map(function(id){ return _obraIdMap[id].nome; }).filter(Boolean).sort(function(a,b){ return a.localeCompare(b); }); } },
 { key: 'resp',    label: 'Responsável',       type: 'multitext', options: function(){ return (_usuariosCache||[]).map(function(u){return u.nome_display||u.email;}); }, userField: true },
 // Pedido explícito: filtros que faltavam na aba Projetos — ver
 // comentário completo em _dbLoadProjetos (data-* de cada um, e por que
 // Fotos da Obra/Pré-Projeto/Projeto executivo/Tarefa ficaram de fora).
 { key: 'melhoria',   label: 'Melhoria',                  type: 'multitext', options: function(){ return _projMelhoriaOpcoesCache; } },
 // Pedido explícito: Cidade não dava pra digitar (select só deixa clicar
 // Pedido explícito: Cidade tem que ser select+multi com busca, igual a
 // Obras (app.js: 'cidade' também é type:'select'). O problema real não
 // era o tipo — era a lista de opções vir sempre vazia (bug de
 // _obraGeoMap corrigido acima), o que dava a impressão de "não dá pra
 // inserir valor".
 { key: 'cidade',     label: 'Cidade (Obra)',             type: 'select', options: function(){ return _projCidadeOpcoesCache; } },
 { key: 'estado',     label: 'Estado (Obra)',             type: 'select', options: function(){ return _projEstadoOpcoesCache; } },
 { key: 'produto',    label: 'Produto',                   type: 'multitext', options: function(){ return _projProdutoOpcoesCache; } },
 { key: 'descritivo', label: 'Descritivo do projeto',     type: 'text' },
 { key: 'qtd',        label: 'Quantidade',                type: 'number' },
 { key: 'valorunit',  label: 'Valor da unidade',          type: 'number' },
 { key: 'valor',      label: 'Valor total',               type: 'number' },
 { key: 'm2estr',     label: 'M² Estrutura',              type: 'number' },
 { key: 'pesouni',    label: 'Peso Uni (KG)',             type: 'number' },
 { key: 'maiorpeca',  label: 'Maior peça',                type: 'text' },
 { key: 'peso',       label: 'Peso Total',                type: 'number' },
 { key: 'updatedat',  label: 'Horário da última alteração', type: 'date' },
 { key: 'createdat',  label: 'Data de criação',           type: 'date' },
 { key: 'atualizadopor', label: 'Alterado por último',    type: 'select', options: function(){ return (_usuariosCache||[]).map(function(u){return u.nome_display||u.email;}); }, userField: true },
 { key: 'criadopor',     label: 'Criado por',             type: 'select', options: function(){ return (_usuariosCache||[]).map(function(u){return u.nome_display||u.email;}); }, userField: true },
 // Presença (tem/não tem) — mesmo padrão de "campo de presença" de Obras
 // (_OBRAS_PRESENCA_OPS/_obrasPresencaMatchValue, app.js): só "está vazio"
 // (não tem)/"não está vazio" (tem), sem pedir escolher Sim/Não à toa.
 { key: 'temfotos',      label: 'Fotos da Obra',          type: 'text', ops: _OBRAS_PRESENCA_OPS, matchValue: _obrasPresencaMatchValue('temfotos') },
 { key: 'tempreprojeto', label: 'Pré-Projeto',            type: 'text', ops: _OBRAS_PRESENCA_OPS, matchValue: _obrasPresencaMatchValue('tempreprojeto') },
 { key: 'temprojexec',   label: 'Projeto executivo',      type: 'text', ops: _OBRAS_PRESENCA_OPS, matchValue: _obrasPresencaMatchValue('temprojexec') },
 { key: 'temtarefa',     label: 'Tarefa',                 type: 'text', ops: _OBRAS_PRESENCA_OPS, matchValue: _obrasPresencaMatchValue('temtarefa') },
];
_fbInit('projetos', _projFbFields, _projApplyFilters);

var _projSbFields = [
 { key: 'nome',    label: 'Nome do Projeto', type: 'text' },
 { key: 'cliente', label: 'Cliente/Obra', type: 'text' },
 { key: 'etapa',   label: 'Etapa',        type: 'text' },
 { key: 'valor',   label: 'Valor total',  type: 'number', getValue: function(ds) { return parseFloat(ds.valor) || 0; } },
 { key: 'peso',    label: 'Peso total',   type: 'number', getValue: function(ds) { return parseFloat(ds.peso) || 0; } },
];
_sbInit('projetos', _projSbFields, _projApplyFilters);

// Agrupar — mesmo esquema de Obras (opera sobre <tr> já existentes no DOM,
// não reconstrói a tbody a partir de um array em memória; ver comentário
// completo em _obrasRenderGroupNode, obras.js).
var _projGbFields = [
 { key: 'nome',    label: 'Nome do Projeto' },
 { key: 'tipo',    label: 'Tipo de orçamento' },
 { key: 'etapa',   label: 'Etapa' },
 { key: 'cliente', label: 'Cliente/Obra' },
];
_gbInit('projetos', _projGbFields, _projApplyFilters, 3);
var _projGroupCollapsed = {};
function _projToggleGroup(key) {
 _projGroupCollapsed[key] = !_projGroupCollapsed[key];
 _projApplyFilters();
}
function _projRenderGroupNode(node, path, tbody, forceHidden) {
 if (node.leaf) {
  node.items.forEach(function(tr) {
   if (forceHidden) tr.style.display = 'none';
   tbody.appendChild(tr);
  });
  return;
 }
 node.order.forEach(function(k) {
  var child = node.children[k];
  var nodePath = path.concat(k);
  var pathKey = nodePath.join(' :: ');
  var isCollapsed = !!_projGroupCollapsed[pathKey];
  var visCount = _gtTreeCount(child, function(tr){ return tr.style.display !== 'none'; });
  var indent = 12 + path.length * 20;
  var hd = document.createElement('tr');
  hd.className = _gtGroupClass(path.length) + ' proj-group-row';
  hd.style.position = 'static';
  hd.onclick = function(){ _projToggleGroup(pathKey); };
  hd.style.display = (forceHidden || !visCount) ? 'none' : '';
  // Etapa já tem cor em badge-colors.js (mesma da tabela/Kanban) — o
  // cabeçalho de grupo usa a mesma cor em vez de texto puro.
  var _projGrupoCls = node.field === 'etapa' ? _badgeCls(BADGE_ETAPA_PROJETO, k) : null;
  hd.innerHTML = '<td colspan="10" style="padding-left:' + indent + 'px">'
   + '<span style="margin-right:4px">' + (isCollapsed ? '▶' : '▼') + '</span>'
   + _gtGroupLabelHTML(k, _projGrupoCls)
   + _gtCountBadgeHTML(visCount)
   + '</td>';
  tbody.appendChild(hd);
  _projRenderGroupNode(child, nodePath, tbody, forceHidden || isCollapsed);
 });
}

function _projApplyFilters() {
 var buscaNorm = _ssNormalize(((document.getElementById('proj-search') || {}).value || '').trim());
 var activeConds = _fbInstances.projetos.state.conditions.filter(_fbConditionIsUsable).length;
 var visivel = 0;

 // Remove cabeçalhos de grupo da renderização anterior antes de reconsultar
 // as linhas — eles não têm data-id, então não entram no seletor abaixo.
 Array.prototype.slice.call(document.querySelectorAll('#proj-tbody tr.proj-group-row')).forEach(function(tr){ tr.remove(); });
 var rows = Array.prototype.slice.call(document.querySelectorAll('#proj-tbody tr[data-id]'));
 rows.forEach(function(tr) {
  var ok = _fbEvaluate(tr.dataset, 'projetos');
  if (ok && buscaNorm) ok = _ssMatch(_ssNormalize(tr.textContent), buscaNorm);
  tr.style.display = ok ? '' : 'none';
  if (ok) visivel++;
 });
 if (rows.length) {
  rows.sort(function(a, b) { return _sbCompare(a.dataset, b.dataset, 'projetos'); });
  var tbody = rows[0].parentElement;
  var groupLevels = (_gbInstances.projetos && _gbInstances.projetos.state.levels) || [];
  if (groupLevels.length) {
   var tree = _gtBuildTree(rows, groupLevels, function(tr, field) {
    return { key: tr.dataset[field] || 'Sem valor', sortKey: null };
   }, null, 0);
   _projRenderGroupNode(tree, [], tbody, false);
  } else {
   rows.forEach(function(tr) { tbody.appendChild(tr); });
  }
 }

 var cards = Array.prototype.slice.call(document.querySelectorAll('#proj-kanban .proj-kn-card'));
 cards.forEach(function(card) {
  var ok = _fbEvaluate(card.dataset, 'projetos');
  if (ok && buscaNorm) ok = _ssMatch(_ssNormalize(card.textContent), buscaNorm);
  card.style.display = ok ? '' : 'none';
 });
 var byBody = new Map();
 cards.forEach(function(card) {
  var body = card.parentElement;
  if (!byBody.has(body)) byBody.set(body, []);
  byBody.get(body).push(card);
 });
 byBody.forEach(function(colCards, body) {
  colCards.sort(function(a, b) { return _sbCompare(a.dataset, b.dataset, 'projetos'); });
  colCards.forEach(function(c) { body.appendChild(c); });
 });
 document.querySelectorAll('#proj-kanban .proj-kn-col').forEach(function(col) {
  var countEl = col.querySelector('.proj-kn-count');
  if (countEl) countEl.textContent = col.querySelectorAll('.proj-kn-card:not([style*="display: none"]):not([style*="display:none"])').length;
 });

 var fbBadge = document.getElementById('fb-badge-projetos');
 if (fbBadge) { fbBadge.textContent = activeConds; fbBadge.style.display = activeConds ? '' : 'none'; }
 var countEl2 = document.getElementById('proj-filter-count');
 if (countEl2) {
  if (activeConds || buscaNorm) { countEl2.textContent = visivel + (visivel === 1 ? ' resultado' : ' resultados'); countEl2.style.display = 'inline'; }
  else { countEl2.style.display = 'none'; }
 }
}

var _projetosArr    = [];
var _obraIdMap      = {}; // id → {nome, empresa} preenchido por _dbLoadObras
var _projMelhoriaOpcoesCache = []; // opções (nomes distintos) pro filtro "Melhoria"
var _projProdutoOpcoesCache = [];  // opções (nomes distintos) pro filtro "Produto"
var _projCidadeOpcoesCache = [];   // opções (nomes distintos) pro filtro "Cidade (Obra)"
var _projEstadoOpcoesCache = [];   // opções (nomes distintos) pro filtro "Estado (Obra)"
var _projMelhoriaMap = {}; // projeto_id → [nome, ...] das melhorias vinculadas — pedido explícito:
// projeto sem obra deve mostrar a(s) melhoria(s) vinculada(s) em vez de "—".

// Mesmo espírito de _garantirObraIdMap logo abaixo — carrega só id+nome+
// projeto_id (leve) uma vez por sessão, não duplica se já carregado.
// Achado real: nome de melhoria aparecia duas vezes na coluna Obra/Melhoria
// — _dbLoadProjetos roda mais de uma vez em sequência rápida (ex.: reload
// explícito após criar um projeto + reload disparado por realtime), e as
// duas chamadas concorrentes de _garantirMelhoriaProjetoMap passavam pelo
// guard acima antes da primeira terminar de popular o cache (_projMelhoriaMap
// ainda vazio nas duas), cada uma fazendo seu próprio fetch e dando push no
// mesmo nome duas vezes. _projMelhoriaMapPromise faz a segunda chamada
// esperar a mesma promise em vez de refazer o fetch.
var _projMelhoriaMapPromise = null;
async function _garantirMelhoriaProjetoMap() {
 if (Object.keys(_projMelhoriaMap).length || !_sb) return;
 if (_projMelhoriaMapPromise) return _projMelhoriaMapPromise;
 _projMelhoriaMapPromise = (async function() {
  var all = []; var from = 0; var more = true;
  while (more) {
   var res = await _sb.from('melhorias').select('nome, projeto_id').not('projeto_id', 'is', null).range(from, from + 999);
   if (res.error || !res.data) break;
   all = all.concat(res.data);
   more = res.data.length === 1000; from += 1000;
  }
  all.forEach(function(m) {
   if (!m.nome) return;
   (_projMelhoriaMap[m.projeto_id] = _projMelhoriaMap[m.projeto_id] || []).push(m.nome);
  });
 })();
 await _projMelhoriaMapPromise;
}

// _obraIdMap normalmente é preenchido por _dbLoadObras (obras.js) — mas só
// roda quando a aba Obras é visitada. Entrando direto em Projetos (sem
// passar por Obras antes) o cache ficava vazio pra sempre e a coluna
// "Obra vinculada" nunca preenchia (bug relatado: fica tudo "—"). Busca
// avulsa e leve (só id+nome, sem os agregados pesados que _dbLoadObras
// carrega) só quando o cache ainda está vazio — não duplica trabalho se
// Obras já rodou antes nesta sessão.
async function _garantirObraIdMap() {
 if (Object.keys(_obraIdMap).length || !_sb) return;
 var allObras = []; var from = 0; var more = true;
 while (more) {
  var res = await _sb.from('obras').select('id, nome').range(from, from + 999);
  if (res.error || !res.data) break;
  allObras = allObras.concat(res.data);
  more = res.data.length === 1000; from += 1000;
 }
 allObras.forEach(function(o) { _obraIdMap[o.id] = { nome: o.nome || '' }; });
}

// Achado real: filtros de Cidade/Estado (Obra) sempre vinham vazios —
// _obraIdMap é um cache COMPARTILHADO com obras.js (_dbLoadObras reseta e
// repopula com {nome,empresa}, sem cidade/estado, toda vez que a aba Obras
// carrega/navega, sem guard) — se Obras roda antes de Projetos na mesma
// sessão (comum: sidebar já mostra contagem de Obras carregada), o mapa
// chegava em projetos.js só com {nome,empresa} e o guard de
// _garantirObraIdMap via "já tem conteúdo, não busca de novo" nunca mais
// dava chance de completar com cidade/estado. Mapa separado, só pra isso,
// evita depender da forma que outro módulo decidiu popular o cache dele.
var _obraGeoMap = {}; // id → {cidade, estado}
async function _garantirObraGeoMap() {
 if (Object.keys(_obraGeoMap).length || !_sb) return;
 var allObras = []; var from = 0; var more = true;
 while (more) {
  var res = await _sb.from('obras').select('id, cidade, estado').range(from, from + 999);
  if (res.error || !res.data) break;
  allObras = allObras.concat(res.data);
  more = res.data.length === 1000; from += 1000;
 }
 allObras.forEach(function(o) { _obraGeoMap[o.id] = { cidade: o.cidade || '', estado: o.estado || '' }; });
}

// Presença (tem/não tem) de Fotos da Obra/Pré-Projeto/Projeto executivo
// (documentos.tipo) e de Tarefa (atividades_projetos) — hoisted pra cache
// de módulo (antes eram `var` locais só de _dbLoadProjetos). Achado real:
// o filtro "Fotos da Obra" (e os outros 3 de presença) "não funcionava
// direito" porque só a TABELA tinha esses data-* nas <tr> — o Kanban
// (_renderProjetosKanban) nunca ganhou os mesmos atributos nos
// .proj-kn-card, então aplicar qualquer um desses filtros com o Kanban
// aberto escondia tudo (dataset undefined !== 'Sim', sempre falso). Cache
// de módulo permite os DOIS renderizadores (_dbLoadProjetos/
// _renderProjetosKanban) lerem o mesmo resultado via _projBuildRowData.
// Lê uma tabela inteira em blocos de 1000. O Supabase/PostgREST corta em
// 1000 linhas por resposta e NÃO sinaliza que truncou — sem paginar, qualquer
// consulta que passe disso devolve dados incompletos em silêncio (mesmo achado
// já corrigido em _dbLoadEntregas). `aplicarFiltros` recebe e devolve o builder.
async function _projCarregarPaginado(tabela, colunas, aplicarFiltros) {
 var tudo = [], from = 0, pageSize = 1000;
 while (true) {
  var q = _sb.from(tabela).select(colunas);
  if (typeof aplicarFiltros === 'function') q = aplicarFiltros(q);
  var res = await q.range(from, from + pageSize - 1);
  if (res.error) { console.error('[Projetos] erro ao ler ' + tabela + ':', res.error); break; }
  var lote = res.data || [];
  tudo = tudo.concat(lote);
  if (lote.length < pageSize) break;
  from += pageSize;
 }
 return tudo;
}

var _projDocPresence = { fotos_obra: {}, pre_projeto: {}, projeto_executivo: {} };
var _projTarefaPresence = {};
async function _projCarregarPresenca() {
 if (!_sb) return;
 // Paginado (ver _projCarregarPaginado): sem isso o Supabase cortaria em 1000
 // linhas sem avisar e os filtros de presença ("tem Pré-projeto?", "tem
 // Tarefa?") passariam a responder "Não" pra registros que TÊM, sem sintoma
 // visível. Hoje são 887 documentos e 532 vínculos — abaixo do corte, mas até
 // agora sem proteção nenhuma.
 var docsProj = await _projCarregarPaginado('documentos', 'projeto_id, tipo', function(q) {
  return q.not('projeto_id', 'is', null).in('tipo', ['fotos_obra', 'pre_projeto', 'projeto_executivo']);
 });
 _projDocPresence = { fotos_obra: {}, pre_projeto: {}, projeto_executivo: {} };
 docsProj.forEach(function(d) { if (_projDocPresence[d.tipo]) _projDocPresence[d.tipo][d.projeto_id] = true; });
 var atvProj = await _projCarregarPaginado('atividades_projetos', 'projeto_id');
 _projTarefaPresence = {};
 atvProj.forEach(function(a) { _projTarefaPresence[a.projeto_id] = true; });
}

// Monta os campos computados + a string de atributos data-* usada tanto
// pela <tr> da Tabela quanto pelo .proj-kn-card do Kanban — extraído pra cá
// justamente pelo bug documentado acima em _projCarregarPresenca: as duas
// visualizações precisam do EXATO mesmo conjunto de data-* pros filtros
// funcionarem igual nas duas, e essa função central garante isso sem
// duplicar a lógica (o jeito antigo, que foi como o Kanban ficou pra trás
// quando novos filtros foram adicionados só na Tabela).
function _projBuildRowData(p) {
 var tipo=p.tipo_orcamento||'';
 var etapa=(p.etapa_projeto||'').trim();
 var prod=Array.isArray(p.produto)?(p.produto[0]||'—'):(p.produto||'—');
 // Todos os produtos selecionados (não só o 1º) — usado na tabela pra
 // renderizar 1 pill badge cinza por valor, mesmo padrão de multi-badge já
 // usado pro Tipo de Obra (catBadges em obras.js).
 var prodArr=Array.isArray(p.produto)?p.produto.filter(Boolean):(p.produto?[p.produto]:[]);
 var prodBadgesHTML=prodArr.length ? prodArr.map(function(pr){ return _badgeHTML(pr,'bm',true); }).join(' ') : '—';
 var qtd=p.quantidade!=null?Number(p.quantidade):null;
 var vU=p.valor_unitario!=null?Number(p.valor_unitario):null;
 var vT=(vU!=null&&qtd!=null)?vU*qtd:vU;
 var pU=p.peso_kg!=null?Number(p.peso_kg):null;
 var pT=(pU!=null&&qtd!=null)?pU*qtd:pU;
 var obraInfo=p.obra_id?(_obraIdMap[p.obra_id]||{}):{};
 var obraGeo=p.obra_id?(_obraGeoMap[p.obra_id]||{}):{};
 var obraNome=obraInfo.nome||'';
 var empNome=obraInfo.empresa||'';
 var melhoriasNomes=_projMelhoriaMap[p.id]||[];
 var obraOuMelhoria = obraNome || (melhoriasNomes.length ? melhoriasNomes.join(', ') : '—');
 var clienteBusca=((empNome?empNome+' — ':'')+(obraNome||obraOuMelhoria)).trim()||obraOuMelhoria;
 var produtoJoin=Array.isArray(p.produto)?p.produto.join(', '):(p.produto||'');
 var atualizadoPorNome=p.atualizado_por?_projAuditNome(p.atualizado_por):'';
 var criadoPorNome=p.criado_por?_projAuditNome(p.criado_por):'';
 var attrEsc=function(s){ return (s==null?'':String(s)).replace(/"/g,'&quot;').replace(/[\r\n]+/g,' '); };
 var attrsHTML = ' data-tipo="'+tipo+'" data-etapa="'+etapa+'" data-cliente="'+attrEsc(clienteBusca)+'" data-valor="'+(vT||0)+'" data-peso="'+(pT||0)+'"'
  +' data-nome="'+attrEsc(p.nome)+'" data-resp="'+attrEsc(p.responsavel)+'"'
  +' data-melhoria="'+attrEsc(melhoriasNomes.join(', '))+'" data-obra="'+attrEsc(obraNome)+'"'
  +' data-cidade="'+attrEsc(obraGeo.cidade)+'" data-estado="'+attrEsc(obraGeo.estado)+'"'
  +' data-produto="'+attrEsc(produtoJoin)+'" data-descritivo="'+attrEsc(p.descritivo)+'"'
  +' data-qtd="'+(qtd!=null?qtd:'')+'" data-valorunit="'+(vU!=null?vU:'')+'" data-m2estr="'+(p.m2_estrutura!=null?p.m2_estrutura:'')+'"'
  +' data-pesouni="'+(pU!=null?pU:'')+'" data-maiorpeca="'+attrEsc(p.maior_peca)+'"'
  +' data-updatedat="'+(p.updated_at?String(p.updated_at).slice(0,10):'')+'" data-createdat="'+(p.created_at?String(p.created_at).slice(0,10):'')+'"'
  +' data-atualizadopor="'+attrEsc(atualizadoPorNome)+'" data-criadopor="'+attrEsc(criadoPorNome)+'"'
  +' data-temfotos="'+(_projDocPresence.fotos_obra[p.id]?'Sim':'Não')+'" data-tempreprojeto="'+(_projDocPresence.pre_projeto[p.id]?'Sim':'Não')+'"'
  +' data-temprojexec="'+(_projDocPresence.projeto_executivo[p.id]?'Sim':'Não')+'" data-temtarefa="'+(_projTarefaPresence[p.id]?'Sim':'Não')+'"';
 return { tipo:tipo, etapa:etapa, prod:prod, prodBadgesHTML:prodBadgesHTML, qtd:qtd, vU:vU, vT:vT, pU:pU, pT:pT, obraNome:obraNome, empNome:empNome, obraOuMelhoria:obraOuMelhoria, attrsHTML:attrsHTML };
}

async function _dbLoadProjetos() {
 var tbody=document.getElementById('proj-tbody');
 if(tbody) tbody.innerHTML='<tr><td colspan="10" style="text-align:center;padding:32px;color:var(--muted);font-size:13px">Carregando projetos...</td></tr>';
 var allData=[]; var from=0; var more=true;
 await _garantirObraIdMap();
 await _garantirObraGeoMap();
 await _garantirMelhoriaProjetoMap();
 await _projCarregarPresenca();
 while(more){
  var res=await _sb.from('projetos').select('*').order('created_at',{ascending:false}).range(from,from+999);
  if(res.error){
   console.error('[Projetos] erro ao carregar a lista de projetos:', res.error);
   if(tbody)tbody.innerHTML='<tr><td colspan="10" style="text-align:center;padding:32px;color:var(--red);font-size:13px">Não foi possível carregar os projetos agora. Verifique sua conexão e recarregue a página.</td></tr>';
   return;
  }
  if(res.data&&res.data.length)allData=allData.concat(res.data);
  more=res.data&&res.data.length===1000; from+=1000;
 }
 if(!allData.length){
  if(tbody)tbody.innerHTML='<tr><td colspan="10" style="text-align:center;padding:32px;color:var(--muted);font-size:13px">Nenhum projeto encontrado.</td></tr>';
  return;
 }
 allData.forEach(function(p){ if (Array.isArray(p.responsavel)) p.responsavel = _emailsToNomes(p.responsavel); });
 _projetosArr=allData;
 if(!tbody)return;
 // Aliases pros mapas únicos BADGE_TIPO_OBRA/BADGE_ETAPA_PROJETO
 // (scripts/lib/badge-colors.js).
 var _tCls=BADGE_TIPO_OBRA;
 var _eCls=BADGE_ETAPA_PROJETO;
 function _fmtBRL(v){return v!=null?'R$ '+Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2}):'—';}
 function _fmtN(v,d){return v!=null?Number(v).toLocaleString('pt-BR',{minimumFractionDigits:d||0}):'—';}
 var _emAnd=['Pré-projeto','Revisão Pré-Projeto','Projeto para Aprovação','Revisão Projeto','Projeto Executivo','Revisão Projeto Executivo','Ajustes de Piloto','Projeto em Andamento','Aguardando Produção'];
 var totV=0,totP=0,cAnd=0;
 tbody.innerHTML=allData.map(function(p,idx){
  var d=_projBuildRowData(p);
  if(d.vT)totV+=d.vT;if(d.pT)totP+=d.pT;if(_emAnd.indexOf(d.etapa)!==-1)cAnd++;
  // Achado real: "Nome do Projeto" nunca foi renderizado como coluna de
  // verdade (só existia como atributo data-nome, usado pra busca/filtro) —
  // cabeçalho da tabela também nunca teve essa coluna. Primeira célula
  // agora mostra o nome de fato.
  return '<tr onclick="if(!event.target.closest(\'button,a,input,select\'))_spOpen(\'projetos\',this)" data-id="'+(p.id||'')+'"'+d.attrsHTML+'>'
   +'<td style="font-weight:600;color:var(--navy)">'+(p.nome||'(sem nome)')+'</td>'
   +'<td style="font-size:12px;white-space:normal;word-break:break-word" title="'+(d.obraOuMelhoria||'').replace(/"/g,'&quot;')+'">'+d.obraOuMelhoria+'</td>'
   +'<td>'+(d.tipo?'<span class="badge '+(_tCls[d.tipo]||'bm')+'">'+d.tipo+'</span>':'—')+'</td>'
   +'<td style="font-size:12px">'+d.prodBadgesHTML+'</td>'
   +'<td style="text-align:right">'+(d.qtd!=null?d.qtd:'—')+'</td>'
   +'<td style="text-align:right">'+_fmtBRL(d.vU)+'</td>'
   +'<td style="text-align:right;font-weight:600;color:var(--green)">'+_fmtBRL(d.vT)+'</td>'
   +'<td style="text-align:right">'+_fmtN(d.pU,1)+'</td>'
   +'<td style="text-align:right">'+_fmtN(d.pT,1)+'</td>'
   +'<td>'+(d.etapa?'<span class="badge '+(_eCls[d.etapa]||'bm')+'">'+d.etapa+'</span>':'—')+'</td></tr>';
 }).join('');
 // Opções dos novos filtros (Melhoria/Produto/Cidade/Estado) — computadas
 // aqui a partir dos dados já carregados, em vez de mais uma query: mesmo
 // espírito de _npCarregarMelhorias, só que pro filtro em vez do
 // formulário de criação.
 (function() {
  var melSet = {}, prodSet = {}, cidSet = {}, estSet = {};
  allData.forEach(function(p) {
   (_projMelhoriaMap[p.id] || []).forEach(function(m) { melSet[m] = true; });
   (Array.isArray(p.produto) ? p.produto : (p.produto ? [p.produto] : [])).forEach(function(pr) { prodSet[pr] = true; });
   var oi = p.obra_id ? (_obraGeoMap[p.obra_id] || {}) : {};
   if (oi.cidade) cidSet[oi.cidade] = true;
   if (oi.estado) estSet[oi.estado] = true;
  });
  var toSortedArr = function(obj) { return Object.keys(obj).sort(function(a,b){ return a.localeCompare(b); }); };
  _projMelhoriaOpcoesCache = toSortedArr(melSet);
  _projProdutoOpcoesCache = toSortedArr(prodSet);
  _projCidadeOpcoesCache = toSortedArr(cidSet);
  _projEstadoOpcoesCache = toSortedArr(estSet);
 })();
 // Badge do menu lateral: ver _navBadgesLoadInitial() (RPC de contagem).
 var kT=document.getElementById('proj-kpi-total');if(kT)kT.textContent=allData.length;
 var kA=document.getElementById('proj-kpi-andamento');if(kA)kA.textContent=cAnd;
 var kV=document.getElementById('proj-kpi-valor');if(kV)kV.textContent='R$ '+Math.round(totV).toLocaleString('pt-BR');
 var kP=document.getElementById('proj-kpi-peso');if(kP)kP.textContent=Math.round(totP).toLocaleString('pt-BR');
 var hint=document.getElementById('proj-count-hint');if(hint)hint.textContent=allData.length+' projetos · clique em uma linha para editar';
 // Tempo real só depois que a lista carregou (não no boot) — e idempotente
 // por chave, então voltar pra esta aba não cria um 2º handler.
 _projetosIniciarTempoReal();
}
