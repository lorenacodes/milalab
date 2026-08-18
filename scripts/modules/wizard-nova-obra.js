/* MODAL NOVA OBRA */
var _noTipos = [];          // tipos de obra selecionados (multi)
var _noEmpresaIds = [];     // empresas selecionadas (multi)
var _noContatoId = '';
var _produtosArr = [];      // cache: [{id, nome, categoria}]
var _NO_TIPOS_OPCOES = ['Telhados','Modular','Steel Frame','Solar','Misto (LSF + A36)'];
var _NO_ETAPA_NEGOCIO_OPCOES = Object.keys(_etapaKcId);

// Canal de vendas — pedido explícito: virou select buscável/criável (mesmo
// componente _srchSel já usado no painel de Obra, kind 'canal') em vez de
// <input list>+<datalist> nativo, que deixava parecer que digitar era
// obrigatório em vez de escolher de uma lista. Reaproveita
// CANAL_VENDAS_OPCOES (obras.js) — o vocabulário REAL por distribuição no
// banco, não a lista genérica menor que existia só aqui antes (sem os
// nomes de representante reais).
_srchSelRegister('noCanal', {
 options: function(){ return CANAL_VENDAS_OPCOES; }, creatable: true, placeholder: 'Selecione o canal...',
});

// Estado — mesmo pedido/motivo do Canal de vendas acima: era um <select>
// nativo (só 27 opções, mas sem busca — pedido explícito de trocar por um
// componente com barra de pesquisa, mesmo padrão já usado no painel de
// Obra, kind 'uf'). UF_BRASIL é geografia fechada do Brasil, não precisa
// de "creatable". onSelect dispara loadCidades(v) — mesmo gatilho que o
// onchange do <select> antigo tinha, pra manter a cascata Estado→Cidade.
_srchSelRegister('noEstado', {
 options: function(){ return UF_BRASIL; }, placeholder: 'UF',
 onSelect: function(v){ loadCidades(v); },
});

// Cache de cidades para não buscar a mesma UF duas vezes
var _cidadeCache = {};
// UF cujas cidades estão carregadas em _cidadeCache e prontas pra exibir no
// select buscável agora — usado pela função `options` de 'noCidade' abaixo,
// já que o mesmo cache serve várias UFs mas só uma é "a atual" no formulário.
var _noCidadeUfAtual = '';

// Cidade — mesmo pedido/motivo do Estado acima: <select> nativo (às vezes
// com 400+ municípios pra estados grandes) sem barra de busca nenhuma.
// creatable:true também cobre o fallback de quando a API do IBGE falha
// (ver catch abaixo) — em vez de travar o campo com uma mensagem de erro,
// o usuário ainda consegue digitar a cidade manualmente.
_srchSelRegister('noCidade', {
 options: function(){ return (_cidadeCache[_noCidadeUfAtual] || []).map(function(c){ return c.nome; }); },
 creatable: true, placeholder: 'Selecione a cidade...',
});
function _noCidadeRenderDisabled(placeholder) {
 _noCidadeUfAtual = '';
 var wrap = document.getElementById('no-cidade-wrap');
 if (!wrap) return;
 wrap.innerHTML = '<input type="hidden" id="no-cidade" value="">'
  + '<div class="srch-sel-box" style="opacity:.55;cursor:not-allowed"><span class="srch-sel-val placeholder">' + placeholder + '</span></div>';
}
function _noCidadeRenderReady(uf) {
 _noCidadeUfAtual = uf;
 var wrap = document.getElementById('no-cidade-wrap');
 if (wrap) wrap.innerHTML = _srchSelMarkup('noCidade', 'no-cidade', '');
}

async function loadCidades(uf) {
 const loading = document.getElementById('no-cidade-loading');

 if (!uf) { _noCidadeRenderDisabled('Selecione o estado primeiro'); return; }

 _noCidadeRenderDisabled('Carregando...');
 if (loading) loading.style.display = 'flex';

 try {
 let cidades = _cidadeCache[uf];
 if (!cidades) {
 // Usa proxy local quando servido via servidor.py,
 // tenta direto como fallback (funciona em alguns navegadores)
 const isLocal = location.protocol === 'http:';
 const url = isLocal
 ? `/api/ibge/v1/localidades/estados/${uf}/municipios?orderBy=nome`
 : `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`;
 const res = await fetch(url);
 if (!res.ok) throw new Error('Falha na API IBGE');
 cidades = await res.json();
 _cidadeCache[uf] = cidades;
 }

 _noCidadeRenderReady(uf);
 } catch (err) {
 // Fallback sem a lista real do IBGE: campo continua usável (creatable),
 // só sem sugestões — antes travava com uma <option> de erro fixa.
 _cidadeCache[uf] = [];
 _noCidadeRenderReady(uf);
 console.warn('IBGE API:', err.message, '— Use o servidor.py para habilitar a API do IBGE');
 } finally {
 if (loading) loading.style.display = 'none';
 }
}

async function openNovaObra() {
 _noTipos = [];
 _noEmpresaIds = [];
 _noContatoId = '';
 _noProjLista = [];

 var nomeEl = document.getElementById('no-nome'); if (nomeEl) nomeEl.value = '';
 ['no-ne-nome','no-ne-cnpj','no-ne-uf','no-ne-cidade','no-nc-nome','no-nc-email','no-nc-cargo'].forEach(function(id){
  var el = document.getElementById(id); if (el) el.value = '';
 });
 var searchEl0 = document.getElementById('no-empresa-search'); if (searchEl0) searchEl0.value = '';
 _noEmpresaDropdownToggle(false);
 document.getElementById('no-empresa-control-label')?.classList.add('placeholder');
 var canalWrap = document.getElementById('no-canal-wrap'); if (canalWrap) canalWrap.innerHTML = _srchSelMarkup('noCanal', 'no-canal', '');
 var estadoWrap = document.getElementById('no-estado-wrap'); if (estadoWrap) estadoWrap.innerHTML = _srchSelMarkup('noEstado', 'no-estado', '');
 _noCidadeRenderDisabled('Selecione o estado primeiro');
 // Dropzone estilizada (mesmo componente _spEntDropzone já usado nos
 // anexos de Entrega, obras.js) em vez do <input type="file"> cru — pedido
 // explícito: o input cru simplesmente não aparecia (regra global
 // ".mf input[type=file]{display:none}" em main.css escondia esses 2
 // inputs específicos sem nenhum substituto visível, então o passo
 // "Documentação" do wizard nunca teve upload de verdade acessível).
 // _spEntDropzone já embute seu próprio <input type="file" style="display:
 // none">, então a regra CSS continua inofensiva — o que fica visível é o
 // <label> ao redor.
 [
  { wrap: 'no-doc-enviado-cliente-wrap', input: 'no-doc-enviado-cliente' },
  { wrap: 'no-doc-proposta-comercial-wrap', input: 'no-doc-proposta-comercial' },
 ].forEach(function(d){
  var wrap = document.getElementById(d.wrap);
  if (wrap) wrap.innerHTML = _spEntDropzone(d.input, d.input + '-lbl', false);
 });
 ['no-nova-empresa-box','no-novo-contato-box'].forEach(function(id){ var el = document.getElementById(id); if (el) el.style.display = 'none'; });

 var dataEl = document.getElementById('no-data-criacao');
 if (dataEl) dataEl.textContent = new Date().toLocaleDateString('pt-BR');

 var etapaSel = document.getElementById('no-etapa');
 if (etapaSel) {
  etapaSel.innerHTML = '<option value="">Selecione...</option>' + _NO_ETAPA_NEGOCIO_OPCOES.map(function(e){ return '<option>'+e+'</option>'; }).join('');
  etapaSel.selectedIndex = 0;
  _selColorize(etapaSel, _etapaDot);
 }

 _noTipoGridRender();
 _noEmpresaFilterRender();
 _noContatoRender();
 _noProjRender();

 if (!_produtosArr.length) {
  var pr = await _sb.from('produtos').select('id,nome,categoria').order('nome');
  _produtosArr = pr.data || [];
 }
 await _loadUsuariosCache();

 document.getElementById('modal-nova-obra').classList.add('open');
 _noWizardInit();
}

// ── Passo 1: tipo(s) de obra (multi-toggle) ───────────────────────────────
function _noTipoGridRender() {
 var el = document.getElementById('no-tipo-grid');
 if (!el) return;
 el.innerHTML = _NO_TIPOS_OPCOES.map(function(t) {
  var sel = _noTipos.indexOf(t) >= 0;
  return '<button type="button" onclick="_noTipoToggle(\'' + t.replace(/'/g, "\\'") + '\')" style="padding:8px 14px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;border:1.5px solid ' + (sel?'var(--navy)':'var(--border)') + ';background:' + (sel?'var(--navy)':'transparent') + ';color:' + (sel?'#fff':'var(--text)') + '">' + t + '</button>';
 }).join('');
}
function _noTipoToggle(t) {
 var i = _noTipos.indexOf(t);
 if (i >= 0) _noTipos.splice(i, 1); else _noTipos.push(t);
 _noTipoGridRender();
 _noProjRender();
}

// ── Passo 1: empresa(s) — combobox multi-select com busca, estados de loading/vazio ──
var _noEmpresaDropdownOpen = false;

function _noEmpresaDropdownToggle(forceOpen) {
 var open = typeof forceOpen === 'boolean' ? forceOpen : !_noEmpresaDropdownOpen;
 _noEmpresaDropdownOpen = open;
 var panel = document.getElementById('no-empresa-panel');
 var ctrl = document.getElementById('no-empresa-control');
 if (panel) panel.classList.toggle('open', open);
 if (ctrl) ctrl.classList.toggle('open', open);
 if (open) {
  _noEmpresaFilterRender();
  setTimeout(function(){ document.getElementById('no-empresa-search')?.focus(); }, 50);
 }
}
document.addEventListener('click', function(e) {
 if (!_noEmpresaDropdownOpen) return;
 var panel = document.getElementById('no-empresa-panel');
 var ctrl = document.getElementById('no-empresa-control');
 if (panel && ctrl && !panel.contains(e.target) && !ctrl.contains(e.target)) _noEmpresaDropdownToggle(false);
});

function _noEmpresaControlLabelUpdate() {
 var label = document.getElementById('no-empresa-control-label');
 if (!label) return;
 if (!_noEmpresaIds.length) { label.textContent = 'Selecione uma ou mais empresas...'; label.classList.add('placeholder'); return; }
 label.classList.remove('placeholder');
 var nomes = _noEmpresaIds.map(function(id){ var e = (_empresasArr||[]).find(function(x){ return x.id === id; }); return e ? e.nome : null; }).filter(Boolean);
 label.textContent = nomes.length > 2
  ? (nomes.slice(0,2).join(', ') + ' +' + (nomes.length - 2))
  : nomes.join(', ');
}

function _noEmpresaFilterRender() {
 var el = document.getElementById('no-empresa-lista');
 if (!el) return;
 _noEmpresaControlLabelUpdate();
 if (!_empresasArr) {
  el.innerHTML = '<div class="no-dd-loading"><span class="no-dd-spin"></span> Carregando empresas...</div>';
  return;
 }
 var q = (document.getElementById('no-empresa-search')?.value || '').toLowerCase();
 var lista = (_empresasArr || []).filter(function(e){
  if (!q) return true;
  return (e.nome||'').toLowerCase().indexOf(q) >= 0 || (e.cidade||'').toLowerCase().indexOf(q) >= 0
   || (e.estado||'').toLowerCase().indexOf(q) >= 0 || (e.cnpj||'').toLowerCase().indexOf(q) >= 0;
 }).slice(0, 80);
 if (!lista.length) { el.innerHTML = '<div class="no-dd-empty">Nenhuma empresa encontrada' + (q ? ' para "' + q + '"' : '') + '.</div>'; return; }
 el.innerHTML = lista.map(function(e){
  var checked = _noEmpresaIds.indexOf(e.id) >= 0;
  var sub = [e.cidade, e.estado].filter(Boolean).join(' - ') + (e.cnpj ? ' · ' + e.cnpj : '');
  return '<label class="no-check-row">'
   + '<input type="checkbox" ' + (checked?'checked':'') + ' onchange="_noEmpresaToggle(\'' + e.id + '\')">'
   + '<span class="no-check-row-main"><span class="no-check-row-title">' + e.nome + '</span>'
   + (sub ? '<span class="no-check-row-sub">' + sub + '</span>' : '') + '</span>'
   + '</label>';
 }).join('');
}
function _noEmpresaToggle(id) {
 var i = _noEmpresaIds.indexOf(id);
 if (i >= 0) _noEmpresaIds.splice(i, 1); else _noEmpresaIds.push(id);
 _noEmpresaFilterRender();
 _noContatoRender();
}
function _noToggleNovaEmpresa() {
 var box = document.getElementById('no-nova-empresa-box');
 if (box) box.style.display = (box.style.display === 'none' || !box.style.display) ? 'block' : 'none';
}
async function _noSalvarNovaEmpresa() {
 var nome = (document.getElementById('no-ne-nome')?.value || '').trim();
 if (!nome) { _showToast('Informe o nome da empresa', 'aviso'); return; }
 var res = await _sb.from('empresas').insert({
  nome: nome,
  cnpj: document.getElementById('no-ne-cnpj')?.value?.trim() || null,
  estado: document.getElementById('no-ne-uf')?.value?.trim()?.toUpperCase() || null,
  cidade: document.getElementById('no-ne-cidade')?.value?.trim() || null,
 }).select('id,nome,cidade,estado,cnpj').single();
 if (res.error) { _showToast('Erro ao criar empresa: ' + res.error.message, 'erro'); return; }
 _empresasArr = (_empresasArr || []).concat([res.data]);
 _noEmpresaIds.push(res.data.id);
 document.getElementById('no-nova-empresa-box').style.display = 'none';
 var searchEl = document.getElementById('no-empresa-search'); if (searchEl) searchEl.value = '';
 _noEmpresaFilterRender();
 _noContatoRender();
 _showToast('Empresa criada com sucesso!', 'ok');
}

function _noContatoRender() {
 var sel = document.getElementById('no-contato-id');
 if (!sel) return;
 if (!_noEmpresaIds.length) {
  sel.innerHTML = '<option value="">Selecione uma empresa primeiro...</option>';
  _noContatoId = '';
  return;
 }
 var filtrados = (_contatosArr || []).filter(function(c){ return _noEmpresaIds.indexOf(c.empresa_id) >= 0; });
 sel.innerHTML = '<option value="">Selecionar contato...</option>'
  + filtrados.map(function(c){ return '<option value="' + c.id + '">' + c.nome_completo + (c.cargo ? ' · ' + c.cargo : '') + '</option>'; }).join('')
  + '<option value="__novo__">+ Cadastrar novo contato</option>';
 sel.value = _noContatoId || '';
}
function _noContatoSelectChange(val) {
 var box = document.getElementById('no-novo-contato-box');
 if (box) box.style.display = val === '__novo__' ? 'block' : 'none';
 _noContatoId = (val === '__novo__') ? '' : val;
}
async function _noSalvarNovoContato() {
 var nome = (document.getElementById('no-nc-nome')?.value || '').trim();
 if (!nome) { _showToast('Informe o nome do contato', 'aviso'); return; }
 var res = await _sb.from('contatos').insert({
  nome_completo: nome,
  email: document.getElementById('no-nc-email')?.value?.trim() || null,
  cargo: document.getElementById('no-nc-cargo')?.value?.trim() || null,
 }).select('id,nome_completo,cargo').single();
 if (res.error) { _showToast('Erro ao criar contato: ' + res.error.message, 'erro'); return; }
 var empresaId = _noEmpresaIds[0];
 var linkErro = null;
 if (empresaId) {
  var linkRes = await _sb.from('contatos_empresas').insert({ contato_id: res.data.id, empresa_id: empresaId });
  if (linkRes.error) linkErro = linkRes.error;
 }
 res.data.empresa_id = empresaId;
 _contatosArr = (_contatosArr || []).concat([res.data]);
 _noContatoId = res.data.id;
 document.getElementById('no-novo-contato-box').style.display = 'none';
 _noContatoRender();
 if (linkErro) {
  console.error('[Wizard] erro ao vincular contato à empresa:', linkErro);
  _showToast('Contato criado, mas não foi possível vincular à empresa: ' + _supaErrPt(linkErro.message), 'erro');
 } else {
  _showToast('Contato criado com sucesso!', 'ok');
 }
}
function _noCancelarNovoContato() {
 document.getElementById('no-novo-contato-box').style.display = 'none';
 var sel = document.getElementById('no-contato-id'); if (sel) sel.value = '';
 _noContatoId = '';
}

function closeNovaObra() {
 document.getElementById('modal-nova-obra').classList.remove('open');
}

function handleModalBackdrop(e) {
 if (e.target === document.getElementById('modal-nova-obra')) closeNovaObra();
}

// ── Wizard Nova Obra ──────────────────────────────────────────────
var _noStep = 1;
var _noStepTitles = ['', 'Identificação da obra', 'Local & Venda', 'Documentação', 'Projetos'];

function _noWizardInit() {
 _noStep = 1;
 _noWizardRender();
}

function _noWizardRender() {
 for (var i = 1; i <= 4; i++) {
  var p = document.getElementById('no-step-' + i);
  if (p) p.style.display = (i === _noStep) ? 'block' : 'none';
 }
 var sub = document.getElementById('no-step-subtitle');
 if (sub) sub.textContent = 'Passo ' + _noStep + ' de 4 — ' + _noStepTitles[_noStep];
 var back = document.getElementById('no-btn-back');
 if (back) back.style.visibility = _noStep > 1 ? 'visible' : 'hidden';
 var next = document.getElementById('no-btn-next');
 if (next) {
  if (_noStep === 4) {
   next.innerHTML = 'Criar obra <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8h10M9 4l4 4-4 4"/></svg>';
   next.onclick = submitNovaObra;
  } else {
   next.innerHTML = 'Próximo <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3l5 5-5 5"/></svg>';
   next.onclick = _noWizardNext;
  }
 }
 for (var s = 1; s <= 4; s++) {
  var circle = document.getElementById('no-wcircle-' + s);
  var bar    = document.getElementById('no-wbar-' + s);
  var line   = document.getElementById('no-wline-' + s);
  if (!circle) continue;
  var label = bar ? bar.querySelector('span') : null;
  if (s < _noStep) {
   circle.style.background = '#16a34a'; circle.style.borderColor = '#16a34a'; circle.style.color = '#fff';
   circle.innerHTML = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#fff" stroke-width="2.5"><polyline points="2 9 6 13 14 4"/></svg>';
   if (label) { label.style.color = '#16a34a'; }
   if (line) line.style.background = '#16a34a';
  } else if (s === _noStep) {
   circle.style.background = 'var(--navy)'; circle.style.borderColor = 'var(--navy)'; circle.style.color = '#fff';
   circle.innerHTML = s;
   if (label) { label.style.color = 'var(--navy)'; label.style.fontWeight = '700'; }
  } else {
   circle.style.background = 'var(--surface2)'; circle.style.borderColor = 'var(--border)'; circle.style.color = 'var(--muted)';
   circle.innerHTML = s;
   if (label) { label.style.color = 'var(--muted)'; label.style.fontWeight = '600'; }
   if (line) line.style.background = 'var(--border)';
  }
 }
}

function _noWizardGo(step) {
 if (step < _noStep) { _noStep = step; _noWizardRender(); }
}

function _noWizardNext() {
 if (!_noWizardValidate()) return;
 if (_noStep < 4) { _noStep++; _noWizardRender(); }
}

function _noWizardBack() {
 if (_noStep > 1) { _noStep--; _noWizardRender(); }
}

function _noWizardValidate() {
 if (_noStep === 1) {
  var nome = (document.getElementById('no-nome')?.value || '').trim();
  if (!nome) { _showToast('Informe o nome da obra', 'aviso'); return false; }
  if (!_noTipos.length) { _showToast('Selecione ao menos um tipo de obra', 'aviso'); return false; }
  if (!document.getElementById('no-etapa')?.value) { _showToast('Selecione a etapa do negócio', 'aviso'); return false; }
  if (!_noEmpresaIds.length) { _showToast('Selecione ao menos uma empresa', 'aviso'); return false; }
 }
 if (_noStep === 2) {
  if (!document.getElementById('no-estado')?.value) { _showToast('Selecione o estado', 'aviso'); return false; }
  if (!document.getElementById('no-cidade')?.value) { _showToast('Selecione a cidade', 'aviso'); return false; }
  if (!(document.getElementById('no-canal')?.value || '').trim()) { _showToast('Informe o canal de vendas', 'aviso'); return false; }
 }
 if (_noStep === 4) {
  if (!_noProjLista.length) { _showToast('Adicione ao menos um projeto — é obrigatório', 'aviso'); return false; }
  for (var i = 0; i < _noProjLista.length; i++) {
   var p = _noProjLista[i];
   var faltando = [];
   if (!(p.nome || '').trim()) faltando.push('Nome');
   if (!p.etapaProjeto) faltando.push('Etapa do projeto');
   if (!p.tipoObra) faltando.push('Tipo de obra');
   if (!p.produtoIds.length) faltando.push('Produto');
   if (!p.responsavelEmails.length) faltando.push('Responsável');
   if (!p.qtd) faltando.push('Quantidade');
   if (!p.vuni) faltando.push('Valor unitário');
   if (faltando.length) { _showToast('Projeto ' + (i+1) + ' — preencha: ' + faltando.join(', '), 'aviso'); return false; }
  }
 }
 return true;
}

async function submitNovaObra() {
 if (!_noWizardValidate()) return;

 var nome   = (document.getElementById('no-nome')?.value || '').trim();
 var estado = document.getElementById('no-estado')?.value || '';
 var cidade = document.getElementById('no-cidade')?.value || '';
 var etapa  = document.getElementById('no-etapa')?.value || '';
 var canal  = (document.getElementById('no-canal')?.value || '').trim();

 var btn = document.getElementById('no-btn-next');
 if (btn) { btn.disabled = true; btn.innerHTML = 'Criando...'; }

 try {
  var userEmail = (_currentUser && _currentUser.email) || localStorage.getItem('milatec-user-email') || null;

  var payload = {
   nome: nome, tipo_obra: _noTipos, etapa_negocio: etapa, cidade: cidade, estado: estado,
   canal_vendas: canal || null, criado_por: userEmail,
   empresa_ids: _noEmpresaIds, contato_id: _noContatoId || null,
   projetos: _noProjLista.map(function(p) {
    var isSolar = p.tipoObra === _NO_SOLAR_TIPO;
    return {
     nome: p.nome, tipo_obra: p.tipoObra, etapa_projeto: p.etapaProjeto,
     produto: p.produtoIds.map(function(id){ var pr = _produtosArr.find(function(x){ return x.id === id; }); return pr ? pr.nome : null; }).filter(Boolean),
     responsavel: p.responsavelEmails, quantidade: p.qtd || null, valor_unitario: p.vuni || null,
     descritivo: p.descritivo || null, empresa_id: _noEmpresaIds[0] || null,
     frete: isSolar ? p.frete : null,
     aliquota_icms: isSolar ? p.icms : null,
     consumidor_final: isSolar ? p.consumidorFinal : null,
     difal_percentual: isSolar ? (parseFloat(p.difal) || null) : null,
     melhorias: p.melhorias.filter(function(m){ return (m.nome || '').trim(); })
    };
   })
  };

  var rpcRes = await _sb.rpc('criar_obra_completa', { payload: payload });
  if (rpcRes.error) { _showToast('Erro ao criar obra: ' + _supaErrPt(rpcRes.error.message), 'erro'); return; }
  var obraId = rpcRes.data.obra_id;
  var projetoIds = rpcRes.data.projeto_ids || [];

  // Documentos opcionais (passo 3)
  var docsMap = [
   { inputId: 'no-doc-enviado-cliente', tipo: 'enviado_cliente' },
   { inputId: 'no-doc-proposta-comercial', tipo: 'proposta_comercial' }
  ];
  for (var di = 0; di < docsMap.length; di++) {
   var f = document.getElementById(docsMap[di].inputId)?.files?.[0];
   if (!f) continue;
   var path = obraId + '/' + Date.now() + '_' + f.name.replace(/[^a-zA-Z0-9_\-.]/g, '_');
   var up = await _sb.storage.from('documentos_obras').upload(path, f, { upsert: false });
   if (!up.error) {
    var docRowIns = await _sb.from('documentos').insert({
     obra_id: obraId, nome_arquivo: f.name, nome: f.name, tipo: docsMap[di].tipo,
     categoria: 'Comercial', caminho_storage: path, tamanho_bytes: f.size, mime_type: f.type,
     status: 'Ativo', versao: 1, criado_por: userEmail, origem: 'upload_manual'
    });
    if (docRowIns.error) {
     console.error('[Wizard] erro ao registrar documento enviado:', docRowIns.error);
     _showToast('Arquivo "' + f.name + '" foi enviado, mas não foi registrado no sistema: ' + _supaErrPt(docRowIns.error.message), 'erro');
    }
   } else {
    console.error('[Wizard] erro ao enviar arquivo:', up.error);
    _showToast('Erro ao enviar o arquivo "' + f.name + '": ' + _supaErrPt(up.error.message), 'erro');
   }
  }

  // Propostas Solar
  var geradas = 0;
  for (var pi = 0; pi < _noProjLista.length; pi++) {
   var p = _noProjLista[pi];
   if (p.tipoObra === _NO_SOLAR_TIPO && p.gerarProposta && _noProjPodeProposta(pi).ok) {
    var ok = await _noGerarPropostaSolar(obraId, projetoIds[pi], p, userEmail);
    if (ok) geradas++;
   }
  }

  var msg = 'Obra criada com sucesso!';
  if (geradas) msg += ' ' + geradas + ' proposta(s) Solar gerada(s).';
  _showToast(msg, 'ok');
  closeNovaObra();
  await _dbLoadObras();
  if (typeof _dbLoadObrasKanban === 'function') _dbLoadObrasKanban();
  setTimeout(function(){ _spObraById(obraId); }, 400);

 } finally {
  if (btn) { btn.disabled = false; btn.innerHTML = 'Criar obra <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8h10M9 4l4 4-4 4"/></svg>'; }
 }
}

async function _noGerarPropostaSolar(obraId, projetoId, p, userEmail) {
 var produtoNome = p.produtoIds.map(function(id){ var pr = _produtosArr.find(function(x){ return x.id === id; }); return pr ? pr.nome : null; }).filter(Boolean)[0];
 var qtd = parseFloat(p.qtd) || 0;
 var vuni = parseFloat(p.vuni) || 0;
 if (!produtoNome || !qtd || !vuni || !p.frete || !p.icms) return false;

 var numero = await gerarNumeroProposta();
 var vt = qtd * vuni;
 var difalPercentual = p.consumidorFinal ? (parseFloat(p.difal) || 0) : null;
 var difalValor = (p.consumidorFinal && difalPercentual) ? vt * difalPercentual / 100 : 0;
 var empresaId = _noEmpresaIds[0] || null;

 var ins = await _sb.from('propostas').insert({
  numero: numero, obra_id: obraId, projeto_id: projetoId, empresa_id: empresaId,
  produto: produtoNome, quantidade: qtd, valor_unitario: vuni, valor_total: vt,
  frete: p.frete, aliquota_icms: p.icms, consumidor_final: p.consumidorFinal,
  difal_percentual: difalPercentual, difal_valor: difalValor || null,
  data_geracao: new Date().toISOString().substring(0, 10), gerado_por: userEmail,
  versao: 1, status: 'Gerada', origem: 'sistema_gerado'
 }).select('id').single();
 if (ins.error) { _showToast('Erro ao gerar proposta: ' + _supaErrPt(ins.error.message), 'erro'); return false; }

 var docIns = await _sb.from('documentos').insert({
  obra_id: obraId, empresa_id: empresaId, tipo: 'proposta_comercial',
  nome_arquivo: 'Proposta ' + numero + ' — ' + produtoNome, status: 'Gerada', versao: 1,
  criado_por: userEmail, atualizado_por: userEmail, proposta_id: ins.data.id, origem: 'sistema_gerado',
  metadata: { numero: numero, produto: produtoNome, quantidade: qtd, valor_total: vt }
 });
 if (docIns.error) {
  console.error('[Wizard] erro ao registrar documento da proposta:', docIns.error);
  _showToast('Proposta ' + numero + ' gerada, mas o documento não foi registrado: ' + _supaErrPt(docIns.error.message), 'erro');
 }
 return true;
}

/* ── Projetos dinâmicos no formulário de Nova Obra ─────────────────────────── */
var _noProjLista = [];
var _NO_SOLAR_TIPO = 'Solar';
var _NO_PROJETO_ETAPA_OPCOES = _projetosKanbanEtapaOrder;

function _noProjAdd() {
 _noProjLista.push({
  nome: '', etapaProjeto: '', tipoObra: (_noTipos.length === 1 ? _noTipos[0] : ''),
  produtoIds: [], responsavelEmails: [], descritivo: '', qtd: '', vuni: '',
  melhorias: [], frete: 'CIF', icms: '12', consumidorFinal: false, difal: '', gerarProposta: false
 });
 _noProjRender();
 setTimeout(function(){
  var lista = document.getElementById('no-projetos-lista');
  if (lista) { var last = lista.lastElementChild; if (last) last.scrollIntoView({behavior:'smooth',block:'nearest'}); }
 }, 60);
}
function _noProjRemove(idx) { _noProjLista.splice(idx, 1); _noProjRender(); }
function _noProjSet(idx, field, val) { _noProjLista[idx][field] = val; if (field === 'tipoObra') _noProjRender(); }
function _noProjToggleConsFinal(idx, checked) {
 var p = _noProjLista[idx];
 p.consumidorFinal = checked;
 if (checked && !p.difal) {
  var empresa = (_empresasArr || []).find(function(e){ return e.id === _noEmpresaIds[0]; });
  var uf = (empresa && empresa.estado) || document.getElementById('no-estado')?.value;
  if (uf && _difalTabelaUF[uf] != null) p.difal = String(_difalTabelaUF[uf]);
 }
 _noProjRender();
}
function _noProjProdutoToggle(idx, produtoId) {
 var arr = _noProjLista[idx].produtoIds;
 var i = arr.indexOf(produtoId);
 if (i >= 0) arr.splice(i, 1); else arr.push(produtoId);
 _noProjRender();
}
function _noProjRespToggle(idx, email) {
 var arr = _noProjLista[idx].responsavelEmails;
 var i = arr.indexOf(email);
 if (i >= 0) arr.splice(i, 1); else arr.push(email);
 _noProjRender();
}
function _noProjMelhoriaAdd(idx) { _noProjLista[idx].melhorias.push({ nome: '', area: '' }); _noProjRender(); }
function _noProjMelhoriaRemove(idx, mIdx) { _noProjLista[idx].melhorias.splice(mIdx, 1); _noProjRender(); }
function _noProjMelhoriaSet(idx, mIdx, field, val) { _noProjLista[idx].melhorias[mIdx][field] = val; }

function _noProjPodeProposta(idx) {
 var p = _noProjLista[idx];
 var missing = [];
 var pecasAvulsas = _produtosArr.find(function(x){ return x.nome === 'Peças Avulsas'; });
 if (!p.produtoIds.length) missing.push('Produto');
 else if (pecasAvulsas && p.produtoIds.indexOf(pecasAvulsas.id) >= 0) missing.push('Produto não pode ser "Peças Avulsas"');
 if (!_noEmpresaIds.length) missing.push('Empresa (passo 1)');
 if (!p.qtd) missing.push('Quantidade');
 if (!p.vuni) missing.push('Valor Unitário');
 return { ok: !missing.length, missing: missing };
}

function _noToggleNovoProduto(idx) {
 var box = document.getElementById('no-novo-produto-box-' + idx);
 if (box) box.style.display = (box.style.display === 'none' || !box.style.display) ? 'flex' : 'none';
}
async function _noSalvarNovoProduto(idx) {
 var input = document.getElementById('no-np-nome-' + idx);
 var nome = (input?.value || '').trim();
 if (!nome) { _showToast('Informe o nome do produto', 'aviso'); return; }
 var categoria = _noProjLista[idx].tipoObra === _NO_SOLAR_TIPO ? 'Solar' : 'Geral';
 var res = await _sb.from('produtos').insert({ nome: nome, categoria: categoria }).select('id,nome,categoria').single();
 if (res.error) { _showToast('Erro ao criar produto: ' + res.error.message, 'erro'); return; }
 _produtosArr.push(res.data);
 _noProjLista[idx].produtoIds.push(res.data.id);
 _noProjRender();
 _showToast('Produto criado com sucesso!', 'ok');
}

function _noProjRender() {
 var container = document.getElementById('no-projetos-lista');
 if (!container) return;

 if (!_noProjLista.length) {
  container.innerHTML = '<div style="padding:16px;border:1px dashed var(--border);border-radius:8px;text-align:center;color:var(--muted);font-size:12px;line-height:1.6">Nenhum projeto adicionado ainda.<br>É obrigatório ao menos 1 projeto para criar a obra.</div>';
  return;
 }

 var usuarios = _usuariosCache || [];

 container.innerHTML = _noProjLista.map(function(p, idx) {
  var isSolar = p.tipoObra === _NO_SOLAR_TIPO;
  var tipoOpts = _noTipos.length ? _noTipos : _NO_TIPOS_OPCOES;
  var produtosDisponiveis = _produtosArr.filter(function(pr){ return isSolar ? pr.categoria === 'Solar' : true; });
  var propostaCheck = isSolar ? _noProjPodeProposta(idx) : null;

  var html = '<div style="border:1px solid var(--border);border-radius:10px;overflow:hidden;background:var(--surface)">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--surface2);border-bottom:1px solid var(--border)">'
   + '<span style="font-size:12px;font-weight:600;color:var(--text)">Projeto ' + (idx+1)
   + (isSolar ? ' <span style="font-size:10px;padding:2px 8px;border-radius:20px;background:rgba(245,158,11,.12);color:var(--yellow);font-weight:600;border:1px solid rgba(245,158,11,.3);margin-left:6px">Solar</span>' : '')
   + '</span>'
   + '<button type="button" onclick="_noProjRemove(' + idx + ')" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:11px">Remover</button>'
   + '</div>';
  html += '<div style="padding:16px;display:flex;flex-direction:column;gap:14px">';

  html += '<div class="modal-grid col2" style="gap:12px">'
   + '<div class="mf" style="margin:0"><label style="font-size:11px">Nome do projeto <span class="req">*</span></label>'
   + '<input class="sp-inp" style="font-size:12px" value="' + (p.nome||'') + '" oninput="_noProjSet(' + idx + ',\'nome\',this.value)"></div>'
   + '<div class="mf" style="margin:0"><label style="font-size:11px">Etapa do projeto <span class="req">*</span></label>'
   + '<select class="sp-inp" style="font-size:12px" onchange="_noProjSet(' + idx + ',\'etapaProjeto\',this.value)">'
   + '<option value="">Selecione...</option>'
   + _NO_PROJETO_ETAPA_OPCOES.map(function(e){ return '<option' + (e===p.etapaProjeto?' selected':'') + '>' + e + '</option>'; }).join('')
   + '</select></div>'
   + '</div>';

  html += '<div class="mf" style="margin:0"><label style="font-size:11px">Tipo de obra do projeto <span class="req">*</span></label>'
   + '<select class="sp-inp" style="font-size:12px" onchange="_noProjSet(' + idx + ',\'tipoObra\',this.value)">'
   + '<option value="">Selecione...</option>'
   + tipoOpts.map(function(t){ return '<option' + (t===p.tipoObra?' selected':'') + '>' + t + '</option>'; }).join('')
   + '</select>'
   + (!_noTipos.length ? '<div style="font-size:10px;color:var(--muted);margin-top:4px">Selecione o(s) tipo(s) da obra no passo 1 primeiro.</div>' : '')
   + '</div>';

  html += '<div class="mf" style="margin:0"><label style="font-size:11px">Produto <span class="req">*</span></label>'
   + '<div class="no-check-list" style="border:1px solid var(--border);border-radius:8px;max-height:110px;margin-top:4px">'
   + (produtosDisponiveis.map(function(pr){
      var checked = p.produtoIds.indexOf(pr.id) >= 0;
      return '<label class="no-check-row">'
       + '<input type="checkbox" ' + (checked?'checked':'') + ' onchange="_noProjProdutoToggle(' + idx + ',\'' + pr.id + '\')">'
       + '<span class="no-check-row-title">' + pr.nome + '</span></label>';
     }).join('') || '<div class="no-dd-empty">Nenhum produto cadastrado</div>')
   + '</div>'
   + '<button type="button" onclick="_noToggleNovoProduto(' + idx + ')" style="margin-top:4px;font-size:11px;color:var(--navy);background:none;border:none;cursor:pointer;font-weight:600">+ Cadastrar novo produto</button>'
   + '<div id="no-novo-produto-box-' + idx + '" style="display:none;margin-top:6px;gap:6px">'
   + '<input id="no-np-nome-' + idx + '" class="sp-inp" style="font-size:12px" placeholder="Nome do novo produto">'
   + '<button type="button" onclick="_noSalvarNovoProduto(' + idx + ')" style="font-size:11px;font-weight:600;padding:6px 12px;border:none;border-radius:6px;background:var(--green);color:#fff;cursor:pointer;margin-top:6px">Salvar produto</button>'
   + '</div>'
   + '</div>';

  html += '<div class="mf" style="margin:0"><label style="font-size:11px">Responsável <span class="req">*</span></label>'
   + '<div class="no-check-list" style="border:1px solid var(--border);border-radius:8px;max-height:100px;margin-top:4px">'
   + (usuarios.map(function(u){
      var checked = p.responsavelEmails.indexOf(u.email) >= 0;
      return '<label class="no-check-row">'
       + '<input type="checkbox" ' + (checked?'checked':'') + ' onchange="_noProjRespToggle(' + idx + ',\'' + u.email + '\')">'
       + '<span class="no-check-row-title">' + (u.nome_display || u.email) + '</span></label>';
     }).join('') || '<div class="no-dd-empty">Nenhum usuário cadastrado</div>')
   + '</div></div>';

  html += '<div class="modal-grid col2" style="gap:12px">'
   + '<div class="mf" style="margin:0"><label style="font-size:11px">Quantidade <span class="req">*</span></label>'
   + '<input class="sp-inp" style="font-size:12px" type="number" min="0" step="0.01" value="' + (p.qtd||'') + '" oninput="_noProjSet(' + idx + ',\'qtd\',this.value)"></div>'
   + '<div class="mf" style="margin:0"><label style="font-size:11px">Valor unit. (R$) <span class="req">*</span></label>'
   + '<input class="sp-inp" style="font-size:12px" type="number" min="0" step="0.01" value="' + (p.vuni||'') + '" oninput="_noProjSet(' + idx + ',\'vuni\',this.value)"></div>'
   + '</div>';

  html += '<div class="mf" style="margin:0"><label style="font-size:11px">Descritivo do projeto</label>'
   + '<textarea class="sp-inp" style="font-size:12px;height:56px" oninput="_noProjSet(' + idx + ',\'descritivo\',this.value)">' + (p.descritivo||'') + '</textarea></div>';

  html += '<div style="border:1px dashed var(--border);border-radius:8px;padding:12px">'
   + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'
   + '<span style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--muted)">Melhorias (opcional)</span>'
   + '<button type="button" onclick="_noProjMelhoriaAdd(' + idx + ')" style="font-size:11px;color:var(--navy);background:none;border:none;cursor:pointer;font-weight:600">+ Adicionar</button>'
   + '</div>'
   + (p.melhorias.length ? p.melhorias.map(function(m, mIdx){
      return '<div class="modal-grid col2" style="gap:8px;margin-bottom:6px">'
       + '<input class="sp-inp" style="font-size:12px" placeholder="Nome da melhoria" value="' + (m.nome||'') + '" oninput="_noProjMelhoriaSet(' + idx + ',' + mIdx + ',\'nome\',this.value)">'
       + '<div style="display:flex;gap:6px">'
       + '<input class="sp-inp" style="font-size:12px;flex:1" placeholder="Área" value="' + (m.area||'') + '" oninput="_noProjMelhoriaSet(' + idx + ',' + mIdx + ',\'area\',this.value)">'
       + '<button type="button" onclick="_noProjMelhoriaRemove(' + idx + ',' + mIdx + ')" style="border:none;background:none;color:var(--muted);cursor:pointer;font-size:11px">✕</button>'
       + '</div></div>';
     }).join('') : '<div style="font-size:11px;color:var(--muted)">Nenhuma melhoria adicionada.</div>')
   + '</div>';

  if (isSolar) {
   html += '<div style="background:rgba(245,158,11,.05);border:1px solid rgba(245,158,11,.2);border-radius:8px;padding:14px">'
    + '<div style="font-size:10px;font-weight:700;color:var(--yellow);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px">Gerar Proposta Comercial</div>'
    + '<div class="modal-grid col2" style="gap:10px;margin-bottom:10px">'
    + '<div class="mf" style="margin:0"><label style="font-size:11px">Tipo de Frete</label><select class="sp-inp" style="font-size:12px" onchange="_noProjSet(' + idx + ',\'frete\',this.value)"><option value="CIF"' + (p.frete==='CIF'?' selected':'') + '>CIF</option><option value="FOB"' + (p.frete==='FOB'?' selected':'') + '>FOB</option></select></div>'
    + '<div class="mf" style="margin:0"><label style="font-size:11px">Alíquota Interna (ICMS %)</label><select class="sp-inp" style="font-size:12px" onchange="_noProjSet(' + idx + ',\'icms\',this.value)"><option value="12"' + (p.icms==='12'?' selected':'') + '>12%</option><option value="19"' + (p.icms==='19'?' selected':'') + '>19%</option></select></div>'
    + '</div>'
    + '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:10px;font-size:12px">'
    + '<input type="checkbox" ' + (p.consumidorFinal?'checked':'') + ' onchange="_noProjToggleConsFinal(' + idx + ',this.checked)"> Consumidor final (aplica DIFAL)</label>'
    + (p.consumidorFinal ? '<div class="mf" style="margin:0 0 10px"><label style="font-size:11px">DIFAL (%) — calculado automaticamente, pode ajustar</label><input class="sp-inp" style="font-size:12px" type="number" step="0.01" value="' + (p.difal||'') + '" oninput="_noProjSet(' + idx + ',\'difal\',this.value)"></div>' : '')
    + '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:10px 12px;border:1px solid var(--border);border-radius:7px;background:var(--surface2)">'
    + '<input type="checkbox" ' + (p.gerarProposta?'checked':'') + ' onchange="_noProjSet(' + idx + ',\'gerarProposta\',this.checked)"> Gerar proposta comercial ao criar a obra</label>'
    + (propostaCheck && !propostaCheck.ok ? '<div style="font-size:11px;color:var(--red);margin-top:8px">Pendente: ' + propostaCheck.missing.join(', ') + '</div>' : '')
    + '</div>';
  }

  html += '</div></div>';
  return html;
 }).join('');
}
