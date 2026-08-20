/* MODAL NOVA OBRA */
var _noTipos = [];          // tipos de obra selecionados (multi)
var _noEmpresaIds = [];     // empresas selecionadas (multi)
var _noContatoIds = [];     // contatos selecionados (multi) — pedido explícito, era 1 só
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

// ── Dropzone de documentos (passo 3) — própria do wizard, não reaproveita
// _spEntDropzone (obras.js) de propósito: aquele componente é uma <label>
// simples, sem reset de tipografia, e dentro do .mf deste wizard herdava
// text-transform:uppercase + font-size/weight da regra ".mf label{...}"
// (que existe pra rotular os campos do formulário, não pra texto de
// dropzone) — o texto saía em CAIXA ALTA e comprimido, feio o bastante pra
// ser reportado. Ícone maior (22px) e padding mais generoso (20px 16px),
// mesmo espírito visual do dropzone de "Anexar documento" do painel de Obra.
function _noDocDropzone(inputId, labelId) {
 return '<label style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;border:2px dashed var(--border);border-radius:8px;padding:22px 16px;cursor:pointer;transition:border-color .15s,background .15s;text-align:center;text-transform:none;font-weight:400"'
  + ' onmouseover="this.style.borderColor=\'var(--navy)\';this.style.background=\'rgba(59,130,246,.04)\'"'
  + ' onmouseout="this.style.borderColor=\'var(--border)\';this.style.background=\'\'"'
  + ' ondragover="event.preventDefault();this.style.borderColor=\'var(--navy)\';this.style.background=\'rgba(59,130,246,.07)\'"'
  + ' ondragleave="this.style.borderColor=\'var(--border)\';this.style.background=\'\'"'
  + ' ondrop="_noDocFileDrop(event,\'' + inputId + '\',\'' + labelId + '\')">'
  // Ícone trocado: o antigo (nuvem + seta, mesmo do dropzone de Entrega)
  // renderizava como um rabisco confuso neste tamanho — reportado por
  // print. Ícone de upload simples (seta + bandeja), só linhas retas e um
  // ângulo, sem curvas bezier compostas — fica nítido em qualquer tamanho.
  + '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3"/><path d="M7 8l5-5 5 5"/><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/></svg>'
  + '<span id="' + labelId + '" style="font-size:12px;color:var(--muted);text-transform:none;font-weight:400;line-height:1.4">Clique ou arraste o arquivo aqui</span>'
  + '<input type="file" id="' + inputId + '" style="display:none" onchange="_noDocFileChange(\'' + inputId + '\',\'' + labelId + '\')">'
  + '</label>';
}
function _noDocFileChange(inputId, labelId) {
 var input = document.getElementById(inputId);
 var lbl = document.getElementById(labelId);
 if (!input || !lbl) return;
 var f = input.files && input.files[0];
 if (!f) { lbl.textContent = 'Clique ou arraste o arquivo aqui'; return; }
 lbl.innerHTML = '<span style="color:var(--green);font-weight:700">✓ ' + f.name + '</span>';
}
function _noDocFileDrop(event, inputId, labelId) {
 event.preventDefault();
 var dz = event.currentTarget; dz.style.borderColor = 'var(--border)'; dz.style.background = '';
 var files = event.dataTransfer && event.dataTransfer.files;
 if (!files || !files.length) return;
 var input = document.getElementById(inputId);
 if (!input) return;
 try {
  var dt = new DataTransfer();
  dt.items.add(files[0]);
  input.files = dt.files;
  _noDocFileChange(inputId, labelId);
 } catch(e) { _showToast('Arraste não suportado — use o botão de seleção', 'aviso'); }
}

async function openNovaObra() {
 _noTipos = [];
 _noEmpresaIds = [];
 _noContatoIds = [];
 _noProjLista = [];

 var nomeEl = document.getElementById('no-nome'); if (nomeEl) nomeEl.value = '';
 ['no-nc-nome','no-nc-email'].forEach(function(id){
  var el = document.getElementById(id); if (el) el.value = '';
 });
 var ncCargoWrap = document.getElementById('no-nc-cargo-wrap'); if (ncCargoWrap) ncCargoWrap.innerHTML = _noNcCargoMarkup('');
 var ncTelEl = document.getElementById('no-nc-tel'); if (ncTelEl) ncTelEl.value = _cttTelMaskValue('');
 var neNomeEl = document.getElementById('no-ne-nome'); if (neNomeEl) neNomeEl.value = '';
 var neCnpjEl = document.getElementById('no-ne-cnpj'); if (neCnpjEl) neCnpjEl.value = _empCnpjMaskValue('');
 var neUfEl = document.getElementById('no-ne-uf'); if (neUfEl) neUfEl.innerHTML = _spEmpOptSelect(EMPRESA_ESTADO_OPCOES, '');
 var neFaseEl = document.getElementById('no-ne-fase'); if (neFaseEl) neFaseEl.innerHTML = _spEmpOptSelect(EMPRESA_FASE_OPCOES, '');
 var neSiteEl = document.getElementById('no-ne-site'); if (neSiteEl) neSiteEl.value = '';
 var neSiteBtn = document.getElementById('no-ne-site-open'); if (neSiteBtn) neSiteBtn.style.display = 'none';
 _noNeCategoriaSel = [];
 _noNeCategoriaRender();
 var searchEl0 = document.getElementById('no-empresa-search'); if (searchEl0) searchEl0.value = '';
 _noEmpresaDropdownToggle(false);
 document.getElementById('no-empresa-control-label')?.classList.add('placeholder');
 var searchEl1 = document.getElementById('no-contato-search'); if (searchEl1) searchEl1.value = '';
 _noContatoDropdownToggle(false);
 var contatoLabelEl = document.getElementById('no-contato-control-label');
 if (contatoLabelEl) { contatoLabelEl.textContent = 'Selecione uma empresa primeiro...'; contatoLabelEl.classList.add('placeholder'); }
 var canalWrap = document.getElementById('no-canal-wrap'); if (canalWrap) canalWrap.innerHTML = _srchSelMarkup('noCanal', 'no-canal', '');
 var estadoWrap = document.getElementById('no-estado-wrap'); if (estadoWrap) estadoWrap.innerHTML = _srchSelMarkup('noEstado', 'no-estado', '');
 _noCidadeRenderDisabled('Selecione o estado primeiro');
 // Dropzone própria do wizard (_noDocDropzone) em vez do <input type="file">
 // cru — pedido explícito: o input cru simplesmente não aparecia (regra
 // global ".mf input[type=file]{display:none}" em main.css escondia esses
 // 2 inputs sem nenhum substituto visível). A 1ª tentativa reaproveitou
 // _spEntDropzone (mesmo componente das Entregas), mas por ser uma <label>
 // dentro de um .mf ela herdava text-transform:uppercase/tipografia da
 // regra ".mf label{...}" do próprio wizard — o texto saía em CAIXA ALTA e
 // desproporcional (achado real, reportado por print). _noDocDropzone é
 // maior (ícone 22px, padding 20px 16px, mesmo estilo do dropzone de
 // "Anexar documento" já usado no painel de Obra) e neutraliza
 // text-transform/font-weight explicitamente, então não depende de nunca
 // mais ser colocada dentro de um .mf sem quebrar.
 [
  { wrap: 'no-doc-enviado-cliente-wrap', input: 'no-doc-enviado-cliente' },
  { wrap: 'no-doc-proposta-comercial-wrap', input: 'no-doc-proposta-comercial' },
 ].forEach(function(d){
  var wrap = document.getElementById(d.wrap);
  if (wrap) wrap.innerHTML = _noDocDropzone(d.input, d.input + '-lbl');
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
 _noContatoFilterRender();
 _noProjRender();

 if (!_produtosArr.length) {
  var pr = await _sb.from('produtos').select('id,nome,categoria').order('nome');
  _produtosArr = pr.data || [];
 }
 await _loadUsuariosCache();
 // Avatares do responsável (pedido explícito) vêm de _respUsuarios/
 // _avatarCache (dashboard.js/avatar-helpers.js) — carrega em paralelo e
 // re-renderiza o card de projeto quando chegar, sem travar a abertura do
 // wizard nisso (mesmo espírito de _loadAvatarCacheFast, best-effort).
 if (typeof _respLoadUsers === 'function') _respLoadUsers().then(function(){ _noProjRender(); }).catch(function(){});
 if (typeof _loadAvatarCacheFast === 'function') _loadAvatarCacheFast().then(function(){ _noProjRender(); }).catch(function(){});

 document.getElementById('modal-nova-obra').classList.add('open');
 _noWizardInit();
}

// ── Passo 1: tipo(s) de obra (multi-toggle) ───────────────────────────────
// Cores de identidade — pedido explícito, mesmo padrão já usado nos badges
// de categoria da grade de Obras/Projetos (verde/roxo/azul/amarelo, laranja
// pro restante): verde p/ Telhados, roxo p/ Steel Frame, azul p/ Modular,
// amarelo p/ Solar, laranja p/ Misto. Antes os botões do wizard eram todos
// navy genérico (selecionado) ou cinza (não selecionado), sem nenhuma
// relação visual com a cor que o tipo tem no resto do sistema.
var _NO_TIPO_COR = {
 'Telhados': 'var(--green)', 'Steel Frame': 'var(--purple)', 'Modular': 'var(--blue)',
 'Solar': 'var(--yellow)', 'Misto (LSF + A36)': 'var(--orange)',
};
function _noTipoGridRender() {
 var el = document.getElementById('no-tipo-grid');
 if (!el) return;
 el.innerHTML = _NO_TIPOS_OPCOES.map(function(t) {
  var sel = _noTipos.indexOf(t) >= 0;
  var cor = _NO_TIPO_COR[t] || 'var(--navy)';
  return '<button type="button" onclick="_noTipoToggle(\'' + t.replace(/'/g, "\\'") + '\')" style="padding:8px 14px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;border:1.5px solid ' + cor + ';background:' + (sel?cor:'transparent') + ';color:' + (sel?'#fff':cor) + '">' + t + '</button>';
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
 // Desvincular uma empresa pode deixar contato(s) já selecionados fora do
 // pool válido (pool = contatos da(s) empresa(s) atual(is)) — remove
 // silenciosamente, mesma regra de "sem empresa correspondente, não faz
 // sentido manter selecionado".
 _noContatoIds = _noContatoIds.filter(function(cid){
  var c = (_contatosArr||[]).find(function(x){ return x.id === cid; });
  return c && _noEmpresaIds.indexOf(c.empresa_id) >= 0;
 });
 _noContatoFilterRender();
}
// Formulário "Nova Empresa" — pedido explícito: os campos aqui não seguiam
// o mesmo padrão já usado no detalhamento de Obra (_spCriarEmpresaObra,
// obras.js), que tem Nome/CNPJ/Estado/Fase do Ciclo de Vida/Categoria/Site
// (com máscara e validação de CNPJ) em vez de só Nome/CNPJ/UF/Cidade sem
// validação nenhuma. Reaproveita as mesmas listas/máscaras globais
// (EMPRESA_ESTADO_OPCOES, EMPRESA_FASE_OPCOES, _empCnpjMask*,
// _empCnpjJaExiste — empresas.js) só que com estado/ids PRÓPRIOS
// (_noNeCategoriaSel, #no-ne-*) em vez dos globais _spEmpCategoriaSel/
// #sp-emp-categoria-dropdown — o formulário do wizard fica sempre no DOM
// (só escondido), diferente dos formulários de Empresa/Obra que só
// existem enquanto o painel deles está aberto; usar o MESMO id nos dois
// faria _spEmpRenderCategoriaDropdown (chamada por 3 telas diferentes)
// escrever no elemento errado se as duas telas coexistissem no DOM.
function _noToggleNovaEmpresa() {
 var box = document.getElementById('no-nova-empresa-box');
 if (!box) return;
 var abrir = box.style.display === 'none' || !box.style.display;
 box.style.display = abrir ? 'block' : 'none';
 if (abrir) { _noNeCategoriaSel = []; _noNeCategoriaRender(); }
}
async function _noSalvarNovaEmpresa() {
 var nome = (document.getElementById('no-ne-nome')?.value || '').trim();
 if (!nome) { _showToast('Informe o nome da empresa', 'aviso'); return; }
 // Estado também obrigatório (pedido explícito) — mesma regra vale pro
 // formulário equivalente do detalhamento de Obra (_spCriarEmpresaObra).
 var estado = document.getElementById('no-ne-uf')?.value || '';
 if (!estado) { _showToast('Selecione o estado da empresa', 'aviso'); return; }
 var cnpjDigits = (document.getElementById('no-ne-cnpj')?.value || '').replace(/\D/g, '');
 if (cnpjDigits.length > 0 && cnpjDigits.length < 14) {
  _showToast('CNPJ incompleto — informe os 14 dígitos, ou deixe em branco.', 'aviso');
  return;
 }
 var cnpj = cnpjDigits.length === 14 ? _empCnpjMaskValue(cnpjDigits) : null;
 if (cnpj && await _empCnpjJaExiste(cnpj, null)) {
  _showToast('Já existe uma empresa cadastrada com este CNPJ.', 'aviso');
  return;
 }
 var payload = {
  nome: nome,
  cnpj: cnpj,
  estado: estado,
  fase_ciclo_vida: document.getElementById('no-ne-fase')?.value || null,
  categoria: (_noNeCategoriaSel || []).slice(),
  url_site: document.getElementById('no-ne-site')?.value?.trim() || null,
 };
 var res = await _sb.from('empresas').insert(payload).select('id,nome,estado,cnpj').single();
 if (res.error) { _showToast('Erro ao criar empresa: ' + res.error.message, 'erro'); return; }
 _empresasArr = (_empresasArr || []).concat([res.data]);
 _noEmpresaIds.push(res.data.id);
 _noToggleNovaEmpresa();
 var searchEl = document.getElementById('no-empresa-search'); if (searchEl) searchEl.value = '';
 _noEmpresaFilterRender();
 _noContatoFilterRender();
 _showToast('Empresa criada com sucesso!', 'ok');
}

// ── Categoria (chips coloridos) — versão do wizard de
// _spEmpRenderCategoriaDropdown (empresas.js), mesmo visual, estado/id
// próprios (ver comentário acima de _noToggleNovaEmpresa).
var _noNeCategoriaSel = [];
function _noNeCategoriaRender() {
 var wrap = document.getElementById('no-ne-categoria-dropdown');
 if (!wrap) return;
 var chips = (_noNeCategoriaSel || []).map(function(c) {
  var esc = c.replace(/'/g,"\\'");
  return '<span class="nt-tag ' + _empCategoriaTagCls(c) + '" style="display:inline-flex;align-items:center;gap:4px">'
   + c.replace(/</g,'&lt;')
   + '<button type="button" onclick="_noNeCategoriaRemove(\''+esc+'\')" title="Remover" '
   + 'style="background:none;border:none;cursor:pointer;padding:0;line-height:1;color:inherit;opacity:.65;font-size:12px">×</button></span>';
 }).join('');
 wrap.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;position:relative">'
  + chips
  + '<button type="button" class="btn btn-ghost" style="padding:2px 8px;font-size:11px" onclick="_noNeCategoriaOpenAdd()">+</button>'
  + '<div id="no-ne-categoria-add" style="display:none;position:absolute;top:calc(100% + 4px);left:0;z-index:20;min-width:170px"></div>'
  + '</div>';
}
function _noNeCategoriaOpenAdd() {
 var box = document.getElementById('no-ne-categoria-add');
 if (!box) return;
 var abrir = box.style.display === 'none';
 box.style.display = abrir ? 'block' : 'none';
 if (!abrir) { box.innerHTML = ''; return; }
 var restantes = EMPRESA_CATEGORIA_OPCOES.filter(function(o){ return (_noNeCategoriaSel||[]).indexOf(o) === -1; });
 box.innerHTML = '<div class="srch-sel-drop open" style="position:static">'
  + '<div class="srch-sel-list">' + (restantes.length ? restantes.map(function(o) {
     var esc = o.replace(/'/g,"\\'");
     return '<div class="srch-sel-opt" onclick="_noNeCategoriaAdd(\''+esc+'\')"><span class="nt-tag ' + _empCategoriaTagCls(o) + '" style="pointer-events:none">' + o + '</span></div>';
    }).join('') : '<div class="srch-sel-empty">Todas já selecionadas.</div>') + '</div></div>';
}
function _noNeCategoriaAdd(valor) { _noNeCategoriaSel = _msToggle(_noNeCategoriaSel, valor, true); _noNeCategoriaRender(); }
function _noNeCategoriaRemove(valor) { _noNeCategoriaSel = _msToggle(_noNeCategoriaSel, valor, false); _noNeCategoriaRender(); }
document.addEventListener('click', function(e) {
 var addBox = document.getElementById('no-ne-categoria-add');
 if (addBox && addBox.style.display !== 'none' && !addBox.contains(e.target) && !e.target.closest('#no-ne-categoria-dropdown')) {
  addBox.style.display = 'none'; addBox.innerHTML = '';
 }
});

// ── Contato(s): mesmo mecanismo de dropdown+checkbox de Empresa(s) acima
// (_noEmpresaDropdownToggle/_noEmpresaFilterRender/_noEmpresaToggle) — pedido
// explícito: Contato virou obrigatório e aceita mais de 1 vínculo (era um
// <select> nativo de valor único). Pool sempre restrito às empresas já
// selecionadas (mesma regra de sempre: sem empresa, não tem a quem
// associar o contato).
var _noContatoDropdownOpen = false;
function _noContatoDropdownToggle(forceOpen) {
 if (!_noEmpresaIds.length) { if (forceOpen !== false) _showToast('Selecione uma empresa primeiro', 'aviso'); return; }
 var open = typeof forceOpen === 'boolean' ? forceOpen : !_noContatoDropdownOpen;
 _noContatoDropdownOpen = open;
 var panel = document.getElementById('no-contato-panel');
 var ctrl = document.getElementById('no-contato-control');
 if (panel) panel.classList.toggle('open', open);
 if (ctrl) ctrl.classList.toggle('open', open);
 if (open) {
  _noContatoFilterRender();
  setTimeout(function(){ document.getElementById('no-contato-search')?.focus(); }, 50);
 }
}
document.addEventListener('click', function(e) {
 if (!_noContatoDropdownOpen) return;
 var panel = document.getElementById('no-contato-panel');
 var ctrl = document.getElementById('no-contato-control');
 if (panel && ctrl && !panel.contains(e.target) && !ctrl.contains(e.target)) _noContatoDropdownToggle(false);
});
function _noContatoControlLabelUpdate() {
 var label = document.getElementById('no-contato-control-label');
 if (!label) return;
 if (!_noEmpresaIds.length) { label.textContent = 'Selecione uma empresa primeiro...'; label.classList.add('placeholder'); return; }
 if (!_noContatoIds.length) { label.textContent = 'Selecione um ou mais contatos...'; label.classList.add('placeholder'); return; }
 label.classList.remove('placeholder');
 var nomes = _noContatoIds.map(function(id){ var c = (_contatosArr||[]).find(function(x){ return x.id === id; }); return c ? c.nome_completo : null; }).filter(Boolean);
 label.textContent = nomes.length > 2 ? (nomes.slice(0,2).join(', ') + ' +' + (nomes.length - 2)) : nomes.join(', ');
}
function _noContatoFilterRender() {
 var el = document.getElementById('no-contato-lista');
 if (!el) return;
 _noContatoControlLabelUpdate();
 var q = (document.getElementById('no-contato-search')?.value || '').toLowerCase();
 var pool = (_contatosArr || []).filter(function(c){ return _noEmpresaIds.indexOf(c.empresa_id) >= 0; });
 var lista = pool.filter(function(c){
  if (!q) return true;
  return (c.nome_completo||'').toLowerCase().indexOf(q) >= 0 || (c.cargo||'').toLowerCase().indexOf(q) >= 0;
 });
 if (!lista.length) { el.innerHTML = '<div class="no-dd-empty">Nenhum contato encontrado' + (q ? ' para "' + q + '"' : '') + '.</div>'; return; }
 el.innerHTML = lista.map(function(c){
  var checked = _noContatoIds.indexOf(c.id) >= 0;
  return '<label class="no-check-row">'
   + '<input type="checkbox" ' + (checked?'checked':'') + ' onchange="_noContatoToggle(\'' + c.id + '\')">'
   + '<span class="no-check-row-main"><span class="no-check-row-title">' + c.nome_completo + '</span>'
   + (c.cargo ? '<span class="no-check-row-sub">' + c.cargo + '</span>' : '') + '</span>'
   + '</label>';
 }).join('');
}
function _noContatoToggle(id) {
 var i = _noContatoIds.indexOf(id);
 if (i >= 0) _noContatoIds.splice(i, 1); else _noContatoIds.push(id);
 _noContatoFilterRender();
}
function _noToggleNovoContato() {
 if (!_noEmpresaIds.length) { _showToast('Selecione uma empresa primeiro', 'aviso'); return; }
 var box = document.getElementById('no-novo-contato-box');
 if (!box) return;
 box.style.display = (box.style.display === 'none' || !box.style.display) ? 'block' : 'none';
}
async function _noSalvarNovoContato() {
 var nome = (document.getElementById('no-nc-nome')?.value || '').trim();
 if (!nome) { _showToast('Informe o nome do contato', 'aviso'); return; }
 // Telefone obrigatório (pedido explícito): precisa ter exatamente 10 ou
 // 11 dígitos reais, ignorando a máscara — mesma regra de _cttCriarContato
 // (empresas.js) e _spCriarContato (obras.js).
 var telDigits = (document.getElementById('no-nc-tel')?.value || '').replace(/\D/g, '');
 if (telDigits.length < 10 || telDigits.length > 11) {
  _showToast('Telefone é obrigatório — informe DDD + número (10 ou 11 dígitos).', 'aviso');
  return;
 }
 var res = await _sb.from('contatos').insert({
  nome_completo: nome,
  email: document.getElementById('no-nc-email')?.value?.trim() || null,
  telefone: _cttTelMaskValue(telDigits),
  cargo: document.getElementById('no-nc-cargo')?.value || null,
 }).select('id,nome_completo,cargo').single();
 if (res.error) { _showToast('Erro ao criar contato: ' + res.error.message, 'erro'); return; }
 // Associa já à(s) empresa(s) selecionada(s) na hora de criar — pedido
 // explícito, mesmo espírito de _spCriarContato no detalhamento de Obra.
 var linkErro = null;
 for (var i = 0; i < _noEmpresaIds.length; i++) {
  var linkRes = await _sb.from('contatos_empresas').insert({ contato_id: res.data.id, empresa_id: _noEmpresaIds[i] });
  if (linkRes.error) linkErro = linkRes.error;
 }
 res.data.empresa_id = _noEmpresaIds[0] || null;
 _contatosArr = (_contatosArr || []).concat([res.data]);
 _noContatoIds.push(res.data.id);
 document.getElementById('no-novo-contato-box').style.display = 'none';
 var searchEl = document.getElementById('no-contato-search'); if (searchEl) searchEl.value = '';
 _noContatoFilterRender();
 if (linkErro) {
  console.error('[Wizard] erro ao vincular contato à empresa:', linkErro);
  _showToast('Contato criado, mas não foi possível vincular à empresa: ' + _supaErrPt(linkErro.message), 'erro');
 } else {
  _showToast('Contato criado com sucesso!', 'ok');
 }
}
function _noCancelarNovoContato() {
 document.getElementById('no-novo-contato-box').style.display = 'none';
}

// Cargo do "Novo contato" do wizard — mesmo componente searchable
// single-select de _spCttCargoMarkup (empresas.js), mas com ids/estado
// PRÓPRIOS (no-nc-cargo-*) em vez dos globais sp-ctt-cargo-*: o modal do
// wizard fica sempre no DOM (só escondido), diferente do painel de
// Contato que só existe enquanto está aberto — reaproveitar o mesmo id
// faria as duas telas colidirem se coexistissem (mesmo motivo de
// _noNeCategoriaSel acima, pra Categoria de Empresa).
var _noNcCargoSel = '';
function _noNcCargoMarkup(atual) {
 _noNcCargoSel = atual || '';
 var temValor = !!_noNcCargoSel;
 return '<input type="hidden" id="no-nc-cargo" value="'+_noNcCargoSel.replace(/"/g,'&quot;')+'">'
  + '<div class="srch-sel" id="no-nc-cargo-srch">'
  + '<div class="srch-sel-box" id="no-nc-cargo-box" onclick="_noNcCargoToggle()">'
  + '<span class="srch-sel-val'+(temValor?'':' placeholder')+'" id="no-nc-cargo-val">'+(temValor?_noNcCargoSel.replace(/</g,'&lt;'):'Selecione')+'</span>'
  + '<button class="srch-sel-clr" id="no-nc-cargo-clr" style="display:'+(temValor?'':'none')+'" onclick="event.stopPropagation();_noNcCargoClear()" title="Remover">✕</button>'
  + '<span class="srch-sel-chevron">▾</span>'
  + '</div>'
  + '<div class="srch-sel-drop" id="no-nc-cargo-drop">'
  + '<input class="srch-sel-inp" id="no-nc-cargo-inp" type="text" placeholder="Buscar cargo..." oninput="_noNcCargoFilter(this.value)" onkeydown="_noNcCargoKey(event)">'
  + '<div class="srch-sel-list" id="no-nc-cargo-list"></div>'
  + '</div>'
  + '</div>';
}
function _noNcCargoToggle() {
 var drop = document.getElementById('no-nc-cargo-drop');
 var box  = document.getElementById('no-nc-cargo-box');
 if (!drop) return;
 if (drop.classList.contains('open')) { _noNcCargoClose(); return; }
 drop.classList.add('open');
 if (box) box.classList.add('open');
 var inp = document.getElementById('no-nc-cargo-inp');
 if (inp) { inp.value = ''; inp.focus(); }
 _noNcCargoFilter('');
 _srchSelPositionEl(drop, box);
}
function _noNcCargoClose() {
 var drop = document.getElementById('no-nc-cargo-drop');
 var box  = document.getElementById('no-nc-cargo-box');
 if (drop) drop.classList.remove('open');
 if (box)  box.classList.remove('open');
}
function _noNcCargoFilter(q) {
 q = (q || '').toLowerCase();
 var list = document.getElementById('no-nc-cargo-list');
 if (!list) return;
 var matches = CONTATO_CARGO_OPCOES.filter(function(c) { return c.toLowerCase().indexOf(q) !== -1; });
 if (!matches.length) { list.innerHTML = '<div class="srch-sel-empty">Nenhum cargo encontrado.</div>'; return; }
 list.innerHTML = matches.map(function(c) {
  var sel = c === _noNcCargoSel ? ' selected' : '';
  return '<div class="srch-sel-opt' + sel + '" onclick="_noNcCargoSelectItem(\'' + c.replace(/'/g,"\\'") + '\')">' + c.replace(/</g,'&lt;') + '</div>';
 }).join('');
}
function _noNcCargoSelectItem(cargo) {
 _noNcCargoSel = cargo;
 var hidEl = document.getElementById('no-nc-cargo');
 var valEl = document.getElementById('no-nc-cargo-val');
 var clrEl = document.getElementById('no-nc-cargo-clr');
 if (hidEl) hidEl.value = cargo;
 if (valEl) { valEl.textContent = cargo || 'Selecione'; valEl.classList.toggle('placeholder', !cargo); }
 if (clrEl) clrEl.style.display = cargo ? '' : 'none';
 _noNcCargoClose();
}
function _noNcCargoClear() { _noNcCargoSelectItem(''); }
function _noNcCargoKey(e) { if (e.key === 'Escape') _noNcCargoClose(); }
document.addEventListener('click', function(e) {
 var cargoDrop = document.getElementById('no-nc-cargo-drop');
 var cargoBox  = document.getElementById('no-nc-cargo-box');
 if (cargoDrop && cargoBox && !cargoBox.contains(e.target) && !cargoDrop.contains(e.target)) {
  _noNcCargoClose();
 }
});

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
  // Contato virou obrigatório (pedido explícito) — mesmo espírito de
  // Empresa(s): sem contato nenhum, a obra fica sem ninguém pra falar do
  // orçamento.
  if (!_noContatoIds.length) { _showToast('Selecione ao menos um contato', 'aviso'); return false; }
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
   if (!p.produtoNomes.length) faltando.push('Produto');
   if (!p.responsavelEmails.length) faltando.push('Responsável');
   // Quantidade/Valor unit. NÃO são mais obrigatórios (pedido explícito) —
   // nem toda obra já tem preço fechado no momento da criação do projeto.
   if (faltando.length) { _showToast('Projeto ' + (i+1) + ' — preencha: ' + faltando.join(', '), 'aviso'); return false; }
  }
 }
 return true;
}

async function submitNovaObra() {
 if (!_noWizardValidate()) return;

 // Nome sempre em CAIXA ALTA (pedido explícito) — o campo já força isso
 // enquanto digita (_upperCaseInput), .toUpperCase() aqui é só a garantia
 // final antes de gravar (cobre paste/autofill que não passa por oninput).
 var nome   = (document.getElementById('no-nome')?.value || '').trim().toUpperCase();
 var estado = document.getElementById('no-estado')?.value || '';
 var cidade = document.getElementById('no-cidade')?.value || '';
 var etapa  = document.getElementById('no-etapa')?.value || '';
 var canal  = (document.getElementById('no-canal')?.value || '').trim();

 var btn = document.getElementById('no-btn-next');
 if (btn) { btn.disabled = true; btn.innerHTML = 'Criando...'; }

 try {
  var userEmail = (_currentUser && _currentUser.email) || localStorage.getItem('milatec-user-email') || null;

  // Separa os cards em "novos" (viram INSERT via payload.projetos, na RPC)
  var payload = {
   nome: nome, tipo_obra: _noTipos, etapa_negocio: etapa, cidade: cidade, estado: estado,
   canal_vendas: canal || null, criado_por: userEmail,
   empresa_ids: _noEmpresaIds, contato_ids: _noContatoIds,
   projetos: _noProjLista.map(function(p) {
    var isSolar = p.tipoObra === _NO_SOLAR_TIPO;
    return {
     nome: (p.nome || '').toUpperCase(), tipo_obra: p.tipoObra, etapa_projeto: p.etapaProjeto,
     produto: p.produtoNomes, responsavel: p.responsavelEmails,
     quantidade: p.qtd || null, valor_unitario: p.vuni || null,
     m2_arquitetura: p.m2Arquitetura || null, m2_estrutura: p.m2Estrutura || null,
     tipologia_telhado: p.tipologiaTelhado, tipologia_telha: p.tipologiaTelha,
     descritivo: p.descritivo || null, empresa_id: _noEmpresaIds[0] || null,
     frete: isSolar ? p.frete : null,
     aliquota_icms: isSolar ? p.icms : null,
     consumidor_final: isSolar ? p.consumidorFinal : null,
     difal_percentual: isSolar ? (parseFloat(p.difal) || null) : null,
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
 var produtoNome = p.produtoNomes[0];
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
// Vocabulário REAL — conferido direto no Airtable (base MilaTec, tabela
// Projetos, campos "Tipologia do Telhado"/"Tipo de telha", via MCP), não
// inventado: a usuária confirmou que esses 2 campos existem lá e ainda não
// tinham sido migrados pro Supabase (só "tipologia_telhado" existia como
// coluna; "tipologia_telha" foi criada nesta rodada).
var _NO_TIPOLOGIA_TELHADO_OPCOES = [
 '1 água','2 águas','3 águas','4 águas','Aparente','Borboleta','Calha metálica',
 'Com Laje','Embutido (Platibanda)','Invertido','Mansarda','Misto','Rufo metálico','Sem laje',
];
var _NO_TIPO_TELHA_OPCOES = [
 'Cerâmica/Esmaltada','Concreto','Ecológica/PET','Fibrocimento','Metálica/Sanduíche',
 'PVC','Sanduíche','Shingle','Transparente (Vidro/Policarbonato)',
];

function _noProjAdd() {
 _noProjLista.push({
  nome: '', etapaProjeto: '', tipoObra: (_noTipos.length === 1 ? _noTipos[0] : ''),
  // produtoNomes (não produtoIds): a coluna projetos.produto é um array de
  // NOMES (texto), não de ids — o código antigo guardava ids só pra marcar
  // os checkboxes e convertia pra nome na hora de montar o payload
  // (submitNovaObra). Guardar o nome direto elimina essa indireção e
  // combina com o componente de multi-select reaproveitado abaixo
  // (_msRenderDropdown trabalha com valores string, não pares id/label).
  produtoNomes: [], responsavelEmails: [], descritivo: '', qtd: '', vuni: '',
  m2Arquitetura: '', m2Estrutura: '', tipologiaTelhado: [], tipologiaTelha: [],
  frete: 'CIF', icms: '12', consumidorFinal: false, difal: '', gerarProposta: false
 });
 _noProjRender();
 setTimeout(function(){
  var lista = document.getElementById('no-projetos-lista');
  if (lista) { var last = lista.lastElementChild; if (last) last.scrollIntoView({behavior:'smooth',block:'nearest'}); }
 }, 60);
}
function _noProjRemove(idx) { _noProjLista.splice(idx, 1); _noProjRender(); }
function _noProjSet(idx, field, val) { _noProjLista[idx][field] = val; if (field === 'tipoObra') _noProjRender(); }
// Valor unit.: mesmo padrão de Fornecedor (empresas.js, "Valor unitário" de
// Produtos orçados) — máscara de digitação (_moedaMascarar) + valor
// numérico real guardado à parte (_moedaParaNumero) pra não misturar o
// texto mascarado ("1.234,56") com o que de fato vai pro payload da RPC.
function _noProjVuniInput(idx, inputEl) {
 inputEl.value = _moedaMascarar(inputEl.value);
 _noProjLista[idx].vuni = _moedaParaNumero(inputEl.value);
 _noProjRecalcularTotal(idx);
}
function _noProjRecalcularTotal(idx) {
 var p = _noProjLista[idx];
 var totEl = document.getElementById('no-proj-total-' + idx);
 if (totEl) totEl.textContent = _moedaFormatarBRL((parseFloat(p.qtd) || 0) * (parseFloat(p.vuni) || 0));
}
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
function _noProjPodeProposta(idx) {
 var p = _noProjLista[idx];
 var missing = [];
 if (!p.produtoNomes.length) missing.push('Produto');
 else if (p.produtoNomes.indexOf('Peças Avulsas') >= 0) missing.push('Produto não pode ser "Peças Avulsas"');
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
 _noProjLista[idx].produtoNomes.push(res.data.nome);
 _noProjRender();
 _showToast('Produto criado com sucesso!', 'ok');
}

// ── Multi-selects compactos (Produto/Responsável/Tipologia do Telhado/Tipo
// de Telha) — pedido explícito: as listas de checkbox roláveis não
// combinavam com "o resto do sistema", que usa o dropdown buscável
// _msRenderDropdown (multiselect-ui.js, mesmo componente já usado em
// Fornecedor: Cidade(s)/Setor). Cada toggle re-renderiza só o dropdown
// específico (não o card do projeto inteiro) e reabre o painel na hora —
// se recarregasse o card inteiro a cada clique, o dropdown fechava depois
// de marcar 1 item, impossibilitando selecionar vários.
function _noReabrirDropdown(wrapId) {
 var painel = document.querySelector('#' + wrapId + ' .fb-msel-panel');
 if (painel) painel.classList.add('open');
}
function _noProjRenderProdutoDropdown(idx) {
 var wrap = document.getElementById('no-proj-produto-dd-' + idx);
 if (!wrap) return;
 var p = _noProjLista[idx];
 var isSolar = p.tipoObra === _NO_SOLAR_TIPO;
 var opcoes = _produtosArr.filter(function(pr){ return isSolar ? pr.categoria === 'Solar' : true; }).map(function(pr){ return pr.nome; });
 wrap.innerHTML = _msRenderDropdown('projProduto' + idx, opcoes, p.produtoNomes, '_noProjProdutoToggle', 'Selecione o(s) produto(s)...');
}
function _noProjProdutoToggle(campo, nome, checked) {
 var idx = parseInt(campo.replace('projProduto', ''), 10);
 _noProjLista[idx].produtoNomes = _msToggle(_noProjLista[idx].produtoNomes, nome, checked);
 _noProjRenderProdutoDropdown(idx);
 _noReabrirDropdown('no-proj-produto-dd-' + idx);
}
function _noProjRenderRespDropdown(idx) {
 var wrap = document.getElementById('no-proj-resp-dd-' + idx);
 if (wrap) wrap.innerHTML = _noRespDropdownMarkup(idx);
}
// Componente próprio (não _msRenderDropdown) só pra Responsável: aqui o
// valor GRAVADO precisa ser o e-mail (é o que projetos.responsavel
// armazena), mas o TEXTO exibido deve ser o nome — _msRenderDropdown usa a
// mesma string pras duas coisas, então não serve pra esse caso sem alterar
// um componente compartilhado (usado também em Fornecedor) só por causa
// deste formulário. Mesmas classes .fb-msel-* pra ficar visualmente idêntico.
function _noRespDropdownMarkup(idx) {
 var p = _noProjLista[idx];
 var usuarios = _usuariosCache || [];
 var sel = p.responsavelEmails || [];
 var normalizar = (typeof _ssNormalize === 'function') ? _ssNormalize : function(s){ return (s||'').toLowerCase(); };
 // Rótulo do botão com os nomes de verdade (não "N selecionado(s)") — mesmo
 // helper do _msRenderDropdown genérico (multiselect-ui.js), só que aqui
 // precisa converter e-mail (o que fica gravado) pro nome de exibição antes.
 var selNomes = sel.map(function(email){
  var u = usuarios.find(function(x){ return x.email === email; });
  return (u && u.nome_display) || email;
 });
 var btnLabel = (typeof _msBtnLabel === 'function') ? _msBtnLabel(selNomes, 'Selecione o(s) responsável(is)...') : (sel.length ? selNomes.join(', ') : 'Selecione o(s) responsável(is)...');
 // Busca sempre visível quando há pelo menos 1 usuário — mesmo ajuste do
 // _msRenderDropdown genérico (multiselect-ui.js): antes só aparecia acima
 // de um limiar de quantidade, o que fazia sumir com poucos usuários.
 var searchHtml = usuarios.length > 0
  ? '<input type="text" class="fb-msel-search" placeholder="Pesquisar..." oninput="_msFiltrarDOM(this)">'
  : '';
 // Foto/avatar de cada usuário (pedido explícito: padrão em qualquer
 // seleção de usuário do sistema) — _userAvatarByName (avatar-helpers.js)
 // já é o helper compartilhado com Dashboard/Gestor de Tarefas, com
 // fallback pras iniciais quando não há foto.
 var itemsHtml = usuarios.map(function(u) {
  var label = u.nome_display || u.email;
  var emailEsc = String(u.email).replace(/"/g,'&quot;');
  var ck = sel.indexOf(u.email) !== -1 ? ' checked' : '';
  var avatarHtml = (typeof _userAvatarByName === 'function') ? _userAvatarByName(label, 20) : '';
  return '<label class="fb-msel-item" data-norm="' + normalizar(label) + '"><input type="checkbox" value="' + emailEsc + '"' + ck
   + ' onchange="_noProjRespToggle(' + idx + ',this.value,this.checked)">' + avatarHtml + '<span>' + label.replace(/</g,'&lt;') + '</span></label>';
 }).join('');
 return '<div class="fb-msel-wrap">'
  + '<button type="button" class="fb-msel-btn" onclick="this.nextElementSibling.classList.toggle(\'open\')">' + btnLabel + '</button>'
  + '<div class="fb-msel-panel">' + searchHtml + '<div class="fb-msel-list">' + (itemsHtml || '<div style="padding:8px;font-size:11px;color:var(--muted)">Nenhum usuário cadastrado</div>') + '</div></div>'
  + '</div>';
}
function _noProjRespToggle(idx, email, checked) {
 _noProjLista[idx].responsavelEmails = _msToggle(_noProjLista[idx].responsavelEmails, email, checked);
 _noProjRenderRespDropdown(idx);
 _noReabrirDropdown('no-proj-resp-dd-' + idx);
}
function _noProjRenderTelhadoDropdown(idx) {
 var wrap = document.getElementById('no-proj-telhado-dd-' + idx);
 if (wrap) wrap.innerHTML = _msRenderDropdown('projTelhado' + idx, _NO_TIPOLOGIA_TELHADO_OPCOES, _noProjLista[idx].tipologiaTelhado, '_noProjTelhadoToggle', 'Selecione a(s) tipologia(s)...');
}
function _noProjTelhadoToggle(campo, valor, checked) {
 var idx = parseInt(campo.replace('projTelhado', ''), 10);
 _noProjLista[idx].tipologiaTelhado = _msToggle(_noProjLista[idx].tipologiaTelhado, valor, checked);
 _noProjRenderTelhadoDropdown(idx);
 _noReabrirDropdown('no-proj-telhado-dd-' + idx);
}
function _noProjRenderTelhaDropdown(idx) {
 var wrap = document.getElementById('no-proj-telha-dd-' + idx);
 if (wrap) wrap.innerHTML = _msRenderDropdown('projTelha' + idx, _NO_TIPO_TELHA_OPCOES, _noProjLista[idx].tipologiaTelha, '_noProjTelhaToggle', 'Selecione o(s) tipo(s)...');
}
function _noProjTelhaToggle(campo, valor, checked) {
 var idx = parseInt(campo.replace('projTelha', ''), 10);
 _noProjLista[idx].tipologiaTelha = _msToggle(_noProjLista[idx].tipologiaTelha, valor, checked);
 _noProjRenderTelhaDropdown(idx);
 _noReabrirDropdown('no-proj-telha-dd-' + idx);
}

function _noProjRender() {
 var container = document.getElementById('no-projetos-lista');
 if (!container) return;

 if (!_noProjLista.length) {
  container.innerHTML = '<div style="padding:16px;border:1px dashed var(--border);border-radius:8px;text-align:center;color:var(--muted);font-size:12px;line-height:1.6">Nenhum projeto adicionado ainda.<br>É obrigatório ao menos 1 projeto para criar a obra.</div>';
  return;
 }

 container.innerHTML = _noProjLista.map(function(p, idx) {
  // Pedido explícito: o tipo do projeto só pode ser um dos tipos já
  // marcados pra obra no passo 1 — se a obra é "Solar" e "Telhados", não
  // faz sentido criar um projeto "Steel Frame" dentro dela. Fallback pra
  // todas as opções só por segurança (nunca deveria ficar vazio aqui,
  // já que o passo 1 exige pelo menos 1 tipo marcado antes de avançar).
  var tipoOpts = _noTipos.length ? _noTipos : _NO_TIPOS_OPCOES;
  // Se a obra teve seu(s) tipo(s) alterado(s) depois do projeto já ter um
  // tipo escolhido, e esse tipo não é mais válido, reseta em vez de
  // deixar o card preso num valor que não aparece mais nos botões.
  if (p.tipoObra && tipoOpts.indexOf(p.tipoObra) === -1) p.tipoObra = tipoOpts.length === 1 ? tipoOpts[0] : '';
  var isSolar = p.tipoObra === _NO_SOLAR_TIPO;
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
   + '<input class="sp-inp" style="font-size:12px;text-transform:uppercase" value="' + (p.nome||'') + '" oninput="_upperCaseInput(this);_noProjSet(' + idx + ',\'nome\',this.value)"></div>'
   + '<div class="mf" style="margin:0"><label style="font-size:11px">Etapa do projeto <span class="req">*</span></label>'
   + '<select class="sp-inp" style="font-size:12px" onchange="_noProjSet(' + idx + ',\'etapaProjeto\',this.value)">'
   + '<option value="">Selecione...</option>'
   + _NO_PROJETO_ETAPA_OPCOES.map(function(e){ return '<option' + (e===p.etapaProjeto?' selected':'') + '>' + e + '</option>'; }).join('')
   + '</select></div>'
   + '</div>';

  // Pills coloridas (mesmo padrão do grid de "Tipo(s) de obra" do Passo 1,
  // _noTipoGridRender/_NO_TIPO_COR) em vez de <select> nativo sem cor —
  // pedido explícito: essa identidade visual (verde/roxo/azul/amarelo/
  // laranja por tipo) deveria valer aqui também. <option> de <select> não
  // aceita cor de fundo/borda de forma confiável entre navegadores, então
  // vira botões (seleção única: só 1 fica "preenchido" por vez).
  html += '<div class="mf" style="margin:0"><label style="font-size:11px">Tipo de obra do projeto <span class="req">*</span></label>'
   + '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">'
   + tipoOpts.map(function(t) {
      var selT = t === p.tipoObra;
      var corT = _NO_TIPO_COR[t] || 'var(--navy)';
      return '<button type="button" onclick="_noProjSet(' + idx + ',\'tipoObra\',\'' + t.replace(/'/g,"\\'") + '\')" style="padding:6px 12px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;border:1.5px solid ' + corT + ';background:' + (selT?corT:'transparent') + ';color:' + (selT?'#fff':corT) + '">' + t + '</button>';
     }).join('')
   + '</div>'
   + '</div>';

  html += '<div class="modal-grid col2" style="gap:12px">'
   + '<div class="mf" style="margin:0"><label style="font-size:11px">Produto <span class="req">*</span></label>'
   + '<div id="no-proj-produto-dd-' + idx + '" class="no-msel-wide" style="margin-top:4px">' + _msRenderDropdown('projProduto' + idx, produtosDisponiveis.map(function(pr){ return pr.nome; }), p.produtoNomes, '_noProjProdutoToggle', 'Selecione o(s) produto(s)...') + '</div>'
   + '<button type="button" onclick="_noToggleNovoProduto(' + idx + ')" style="margin-top:6px;font-size:11px;color:var(--navy);background:none;border:none;cursor:pointer;font-weight:600">+ Cadastrar novo produto</button>'
   + '<div id="no-novo-produto-box-' + idx + '" style="display:none;margin-top:6px;gap:6px">'
   + '<input id="no-np-nome-' + idx + '" class="sp-inp" style="font-size:12px" placeholder="Nome do novo produto">'
   + '<button type="button" onclick="_noSalvarNovoProduto(' + idx + ')" style="font-size:11px;font-weight:600;padding:6px 12px;border:none;border-radius:6px;background:var(--green);color:#fff;cursor:pointer;margin-top:6px">Salvar produto</button>'
   + '</div>'
   + '</div>'
   + '<div class="mf" style="margin:0"><label style="font-size:11px">Responsável <span class="req">*</span></label>'
   + '<div id="no-proj-resp-dd-' + idx + '" class="no-msel-wide" style="margin-top:4px">' + _noRespDropdownMarkup(idx) + '</div>'
   + '</div>'
   + '</div>';

  html += '<div class="modal-grid col2" style="gap:12px">'
   + '<div class="mf" style="margin:0"><label style="font-size:11px">Tipologia do Telhado</label>'
   + '<div id="no-proj-telhado-dd-' + idx + '" class="no-msel-wide" style="margin-top:4px">' + _msRenderDropdown('projTelhado' + idx, _NO_TIPOLOGIA_TELHADO_OPCOES, p.tipologiaTelhado, '_noProjTelhadoToggle', 'Selecione a(s) tipologia(s)...') + '</div>'
   + '</div>'
   + '<div class="mf" style="margin:0"><label style="font-size:11px">Tipo de Telha</label>'
   + '<div id="no-proj-telha-dd-' + idx + '" class="no-msel-wide" style="margin-top:4px">' + _msRenderDropdown('projTelha' + idx, _NO_TIPO_TELHA_OPCOES, p.tipologiaTelha, '_noProjTelhaToggle', 'Selecione o(s) tipo(s)...') + '</div>'
   + '</div>'
   + '</div>';

  // Quantidade/Valor unit. deixaram de ser obrigatórios (pedido explícito) —
  // nem toda obra tem preço fechado na hora da criação do projeto.
  // Valor unit. ganha máscara de moeda (mesmo padrão do campo "Valor
  // unitário" de Fornecedor, empresas.js: input type=text + _moedaMascarar
  // no oninput) + uma célula de "Valor total" ao lado, também no mesmo
  // padrão (Qtd × Valor unit., formatado com _moedaFormatarBRL) — pedido
  // explícito: antes não tinha nem máscara, nem a célula de total em R$.
  html += '<div class="modal-grid col2" style="gap:12px">'
   + '<div class="mf" style="margin:0"><label style="font-size:11px">Quantidade</label>'
   + '<input class="sp-inp" style="font-size:12px" type="number" min="0" step="0.01" value="' + (p.qtd||'') + '" oninput="_noProjSet(' + idx + ',\'qtd\',this.value);_noProjRecalcularTotal(' + idx + ')"></div>'
   + '<div class="mf" style="margin:0"><label style="font-size:11px">Valor unit. (R$)</label>'
   + '<input class="sp-inp" style="font-size:12px;text-align:right" type="text" inputmode="numeric" placeholder="0,00" value="' + (p.vuni ? _moedaFormatar(p.vuni) : '') + '" oninput="_noProjVuniInput(' + idx + ',this)"></div>'
   + '</div>';
  html += '<div class="mf" style="margin:0"><label style="font-size:11px">Valor total</label>'
   + '<div id="no-proj-total-' + idx + '" style="font-size:13px;font-weight:600;color:var(--text);padding:9px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-sm);text-align:right">' + _moedaFormatarBRL((parseFloat(p.qtd)||0) * (parseFloat(p.vuni)||0)) + '</div></div>';

  // Símbolo "m²" ao lado do número (pedido explícito) — <input type=number>
  // não aceita texto dentro do próprio valor, então o sufixo é um <span>
  // sobreposto (padding-right no input abre espaço pra não cobrir os
  // dígitos digitados).
  html += '<div class="modal-grid col2" style="gap:12px">'
   + '<div class="mf" style="margin:0"><label style="font-size:11px">M² Arquitetura</label>'
   + '<div style="position:relative">'
   + '<input class="sp-inp" style="font-size:12px;padding-right:30px" type="number" min="0" step="0.01" value="' + (p.m2Arquitetura||'') + '" oninput="_noProjSet(' + idx + ',\'m2Arquitetura\',this.value)">'
   + '<span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:11px;color:var(--muted);pointer-events:none">m²</span>'
   + '</div></div>'
   + '<div class="mf" style="margin:0"><label style="font-size:11px">M² Estrutura</label>'
   + '<div style="position:relative">'
   + '<input class="sp-inp" style="font-size:12px;padding-right:30px" type="number" min="0" step="0.01" value="' + (p.m2Estrutura||'') + '" oninput="_noProjSet(' + idx + ',\'m2Estrutura\',this.value)">'
   + '<span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:11px;color:var(--muted);pointer-events:none">m²</span>'
   + '</div></div>'
   + '</div>';

  html += '<div class="mf" style="margin:0"><label style="font-size:11px">Descritivo do projeto</label>'
   + '<textarea class="sp-inp" style="font-size:12px;height:56px" oninput="_noProjSet(' + idx + ',\'descritivo\',this.value)">' + (p.descritivo||'') + '</textarea></div>';

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
