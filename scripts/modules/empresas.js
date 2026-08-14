// ═══════════════════════════════════════════════════════════════════════════════
// EMPRESAS — inclui a aba Contatos (mesma página/UI, switchEmpTab decide qual
// sub-aba mostrar). Contatos não é página própria — por isso não tem módulo
// separado. Fornecedores VIROU página própria de 1º nível (#page-fornecedores,
// nav item + badge de sidebar dedicados — ver go('fornecedores') em app.js),
// mas o código continua neste arquivo (nenhuma razão pra separar em módulo
// novo só por causa disso — mesma tabela `fornecedores`/mesmas funções
// _dbLoadFornecedores/_renderFornecedores/openNovoFornecedor de sempre).
// ═══════════════════════════════════════════════════════════════════════════════
// Opções fixas do <select> de Estado do painel de detalhe — só as 23 UFs que
// o campo "Estado da Empresa" (singleSelect) tem configuradas de fato no
// Airtable (fonte única da verdade), não as 27 UFs do Brasil. Não reusar a
// lista completa de UF de Obras/Fornecedores aqui: o ponto é fidelidade ao
// vocabulário real deste campo específico.
var EMPRESA_ESTADO_OPCOES = ['AL','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RS','SC','SE','SP','TO'];
// Fase do ciclo de vida (singleSelect) e Categoria (multipleSelects) — mesma
// fonte (Airtable) que alimenta os campos de filtro (_empFbFields) mais
// abaixo, aqui reaproveitados pro <select>/multiselect do painel de detalhe.
var EMPRESA_FASE_OPCOES = ['Cliente','Cliente inativo','Cliente recorrente','Consumidor Final','Lead','Parceiro comercial'];
var EMPRESA_CATEGORIA_OPCOES = ['Modular','Solar','Steel Frame','Telhados'];
function _spEmpOptSelect(list, atual) {
 return '<option value="">—</option>' + list.map(function(o) {
  return '<option value="' + o + '"' + (o === atual ? ' selected' : '') + '>' + o + '</option>';
 }).join('');
}

// Estado (23 opções — acima do _FB_SEARCH_THRESHOLD de 8 usado pelo próprio
// filtro-builder, então merece busca) usa o mesmo componente searchable
// single-select já usado pra Obra/Projeto no drawer de Atividades
// (nt-obra-*/nt-proj-* em dashboard.js, classes .srch-sel/.srch-sel-box/
// .srch-sel-drop/.srch-sel-inp/.srch-sel-list/.srch-sel-opt já em main.css)
// — um <select> nativo não permite injetar uma busca dentro do próprio
// dropdown. Fase (6 opções) e Categoria continuam como estavam: Fase é
// curta o bastante pra não precisar de busca (mesma convenção do
// _FB_SEARCH_THRESHOLD), Categoria já é um multiselect funcionando.
var _spEmpEstadoSelected = '';
function _spEmpEstadoMarkup(atual) {
 _spEmpEstadoSelected = atual || '';
 var temValor = !!_spEmpEstadoSelected;
 return '<input type="hidden" id="sp-emp-estado" value="'+_spEmpEstadoSelected+'">'
  + '<div class="srch-sel" id="sp-emp-estado-srch">'
  + '<div class="srch-sel-box" id="sp-emp-estado-box" onclick="_spEmpEstadoToggle()">'
  + '<span class="srch-sel-val'+(temValor?'':' placeholder')+'" id="sp-emp-estado-val">'+(temValor?_spEmpEstadoSelected:'Selecione')+'</span>'
  + '<button class="srch-sel-clr" id="sp-emp-estado-clr" style="display:'+(temValor?'':'none')+'" onclick="event.stopPropagation();_spEmpEstadoClear()" title="Remover">✕</button>'
  + '<span class="srch-sel-chevron">▾</span>'
  + '</div>'
  + '<div class="srch-sel-drop" id="sp-emp-estado-drop">'
  + '<input class="srch-sel-inp" id="sp-emp-estado-inp" type="text" placeholder="Buscar UF..." oninput="_spEmpEstadoFilter(this.value)" onkeydown="_spEmpEstadoKey(event)">'
  + '<div class="srch-sel-list" id="sp-emp-estado-list"></div>'
  + '</div>'
  + '</div>';
}
function _spEmpEstadoToggle() {
 var drop = document.getElementById('sp-emp-estado-drop');
 var box  = document.getElementById('sp-emp-estado-box');
 if (!drop) return;
 if (drop.classList.contains('open')) { _spEmpEstadoClose(); return; }
 drop.classList.add('open');
 if (box) box.classList.add('open');
 var inp = document.getElementById('sp-emp-estado-inp');
 if (inp) { inp.value = ''; inp.focus(); }
 _spEmpEstadoFilter('');
}
function _spEmpEstadoClose() {
 var drop = document.getElementById('sp-emp-estado-drop');
 var box  = document.getElementById('sp-emp-estado-box');
 if (drop) drop.classList.remove('open');
 if (box)  box.classList.remove('open');
}
function _spEmpEstadoFilter(q) {
 q = (q || '').toLowerCase();
 var list = document.getElementById('sp-emp-estado-list');
 if (!list) return;
 var matches = EMPRESA_ESTADO_OPCOES.filter(function(uf) { return uf.toLowerCase().indexOf(q) !== -1; });
 if (!matches.length) { list.innerHTML = '<div class="srch-sel-empty">Nenhum estado encontrado.</div>'; return; }
 list.innerHTML = matches.map(function(uf) {
  var sel = uf === _spEmpEstadoSelected ? ' selected' : '';
  return '<div class="srch-sel-opt' + sel + '" onclick="_spEmpEstadoSelectItem(\'' + uf + '\')">' + uf + '</div>';
 }).join('');
}
function _spEmpEstadoSelectItem(uf) {
 _spEmpEstadoSelected = uf;
 var hidEl = document.getElementById('sp-emp-estado');
 var valEl = document.getElementById('sp-emp-estado-val');
 var clrEl = document.getElementById('sp-emp-estado-clr');
 if (hidEl) hidEl.value = uf;
 if (valEl) { valEl.textContent = uf; valEl.classList.remove('placeholder'); }
 if (clrEl) clrEl.style.display = uf ? '' : 'none';
 _spEmpEstadoClose();
 if (typeof _empScheduleAutoSave === 'function') _empScheduleAutoSave();
}
function _spEmpEstadoClear() {
 _spEmpEstadoSelectItem('');
 var valEl = document.getElementById('sp-emp-estado-val');
 if (valEl) { valEl.textContent = 'Selecione'; valEl.classList.add('placeholder'); }
}
function _spEmpEstadoKey(e) {
 if (e.key === 'Escape') _spEmpEstadoClose();
}
document.addEventListener('click', function(e) {
 var drop = document.getElementById('sp-emp-estado-drop');
 var box  = document.getElementById('sp-emp-estado-box');
 if (drop && box && !box.contains(e.target) && !drop.contains(e.target)) {
  _spEmpEstadoClose();
 }
 var addBox = document.getElementById('sp-emp-categoria-add');
 if (addBox && addBox.style.display !== 'none' && !addBox.contains(e.target) && !e.target.closest('#sp-emp-categoria-dropdown')) {
  addBox.style.display = 'none'; addBox.innerHTML = '';
 }
});

// Categoria (multipleSelects real no Airtable) — chips coloridos (mesma
// paleta nt-tag-* já usada pra Fase/Estado em todo o app) em vez do dropdown
// genérico "N selecionado(s)" de multiselect-ui.js (usado pra Setor/Cidade de
// Fornecedores): aqui o valor escolhido precisa ficar visível de cara, não
// escondido atrás de uma contagem — pedido explícito de design, replicando o
// visual de multiselect colorido do Airtable original.
var _spEmpCategoriaSel = [];
var EMPRESA_CATEGORIA_COR = { 'Modular':'nt-tag-blue', 'Solar':'nt-tag-yellow', 'Steel Frame':'nt-tag-purple', 'Telhados':'nt-tag-green' };
function _empCategoriaTagCls(cat) { return EMPRESA_CATEGORIA_COR[cat] || 'nt-tag-gray'; }
function _spEmpRenderCategoriaDropdown() {
 var wrap = document.getElementById('sp-emp-categoria-dropdown');
 if (!wrap) return;
 var chips = (_spEmpCategoriaSel || []).map(function(c) {
  var esc = c.replace(/'/g,"\\'");
  return '<span class="nt-tag ' + _empCategoriaTagCls(c) + '" style="display:inline-flex;align-items:center;gap:4px">'
   + c.replace(/</g,'&lt;')
   + '<button type="button" onclick="_spEmpCategoriaRemove(\''+esc+'\')" title="Remover" '
   + 'style="background:none;border:none;cursor:pointer;padding:0;line-height:1;color:inherit;opacity:.65;font-size:12px">×</button></span>';
 }).join('');
 wrap.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;position:relative">'
  + chips
  + '<button type="button" class="btn btn-ghost" style="padding:2px 8px;font-size:11px" onclick="_spEmpCategoriaOpenAdd()">+</button>'
  + '<div id="sp-emp-categoria-add" style="display:none;position:absolute;top:calc(100% + 4px);left:0;z-index:20;min-width:170px"></div>'
  + '</div>';
}
function _spEmpCategoriaOpenAdd() {
 var box = document.getElementById('sp-emp-categoria-add');
 if (!box) return;
 var abrir = box.style.display === 'none';
 box.style.display = abrir ? 'block' : 'none';
 if (!abrir) { box.innerHTML = ''; return; }
 var restantes = EMPRESA_CATEGORIA_OPCOES.filter(function(o){ return (_spEmpCategoriaSel||[]).indexOf(o) === -1; });
 box.innerHTML = '<div class="srch-sel-drop open" style="position:static">'
  + '<div class="srch-sel-list">' + (restantes.length ? restantes.map(function(o) {
     var esc = o.replace(/'/g,"\\'");
     return '<div class="srch-sel-opt" onclick="_spEmpCategoriaAdd(\''+esc+'\')">'
      + '<span class="nt-tag ' + _empCategoriaTagCls(o) + '" style="pointer-events:none">' + o + '</span></div>';
    }).join('') : '<div class="srch-sel-empty">Todas já selecionadas.</div>') + '</div></div>';
}
function _spEmpCategoriaAdd(valor) {
 _spEmpCategoriaSel = _msToggle(_spEmpCategoriaSel, valor, true);
 _spEmpRenderCategoriaDropdown();
 if (typeof _empScheduleAutoSave === 'function') _empScheduleAutoSave();
}
function _spEmpCategoriaRemove(valor) {
 _spEmpCategoriaSel = _msToggle(_spEmpCategoriaSel, valor, false);
 _spEmpRenderCategoriaDropdown();
 if (typeof _empScheduleAutoSave === 'function') _empScheduleAutoSave();
}

// Debounce simples de autosave — dispara _spSaveEmpresa() 700ms depois da
// última tecla/mudança, pra não bater no banco a cada caractere digitado.
// Ponto #2 do pedido: painel de Empresa era só-manual (só salvava no clique
// de "Salvar"), diferente do Gestor de Tarefas (_taskAutoSaveQueue) — agora
// segue o mesmo princípio — só que aqui o botão "Salvar" nem existe mais
// (removido depois, ver _spDeleteEmpresa/ação do painel): autosave é a única
// forma de persistir, sem clique nenhum de reforço.
var _empAutoSaveTimer = null;
function _empScheduleAutoSave() {
 if (_empAutoSaveTimer) clearTimeout(_empAutoSaveTimer);
 _empAutoSaveTimer = setTimeout(function(){ _spSaveEmpresa(); }, 700);
}

// Máscara de CNPJ (00.000.000/0000-00) — regex em cadeia, cada uma pega o
// que a anterior ainda não formatou (padrão padrão pra esse tipo de máscara
// progressiva). Aplicada tanto na criação quanto na edição, pra todo CNPJ
// digitado a partir de agora ficar no mesmo formato (isso também é o que
// permite a checagem de duplicidade abaixo comparar por igualdade simples
// em vez de precisar normalizar dois formatos diferentes toda hora).
// Molde fixo (18 posições) — "0" marca posição de dígito, o resto (. / -)
// é literal. Diferente da versão anterior (que só ia inserindo pontuação
// conforme os dígitos chegavam, deixando o resto do campo "vazio"), aqui as
// posições de dígito ainda não preenchidas mostram "_" — a "colinha" pedida
// fica dentro do próprio campo, sempre visível, em vez de um placeholder
// nativo (que some ao digitar o 1º caractere) ou uma legenda à parte.
var CNPJ_TEMPLATE = '00.000.000/0000-00';
// Só dígitos de verdade contam pro valor — "_" é caractere não-dígito, então
// \D já ignora ele igual ignora "." "/" "-", sem risco de confundir um "_"
// de preenchimento com um dígito digitado de propósito (por isso o molde
// usa "_" pros espaços vazios, não "0").
function _empCnpjMaskValue(input) {
 var digits = (input || '').replace(/\D/g, '').slice(0, 14);
 var di = 0, out = '';
 for (var i = 0; i < CNPJ_TEMPLATE.length; i++) {
  if (CNPJ_TEMPLATE.charAt(i) === '0') { out += (di < digits.length) ? digits.charAt(di) : '_'; di++; }
  else out += CNPJ_TEMPLATE.charAt(i);
 }
 return out;
}
function _empCnpjMask(el) {
 var oldVal = el.value || '';
 // Conta quantos DÍGITOS existem antes do cursor no valor atual — é essa
 // contagem (não a posição em caracteres, que muda quando um "." ou "/" é
 // inserido/removido) que precisa se manter igual depois de reformatar.
 var cursorPos = (el.selectionStart == null) ? oldVal.length : el.selectionStart;
 var digitsBeforeCursor = oldVal.slice(0, cursorPos).replace(/\D/g, '').length;

 el.value = _empCnpjMaskValue(oldVal);

 // Recoloca o cursor logo depois do mesmo tanto de dígitos de antes — sem
 // isso, toda reformatação jogava o cursor pro final do campo, o efeito
 // colateral clássico de máscara feita à mão: corrigir um dígito no meio do
 // CNPJ fazia o resto "fugir"/parecer que a máscara sumia no meio da digitação.
 if (digitsBeforeCursor === 0) { el.setSelectionRange(0, 0); return; }
 var seen = 0, pos = el.value.length;
 for (var i = 0; i < CNPJ_TEMPLATE.length; i++) {
  if (CNPJ_TEMPLATE.charAt(i) === '0') {
   seen++;
   if (seen === digitsBeforeCursor) { pos = i + 1; break; }
  }
 }
 el.setSelectionRange(pos, pos);
}
// Checa se já existe outra empresa com esse CNPJ (excludeId = ignora a
// própria empresa, pra não acusar duplicidade dela consigo mesma ao editar
// sem mudar o CNPJ). Comparação exata (não ilike) — CNPJ é um valor
// estruturado, "contém" não faz sentido aqui, e todo CNPJ salvo por esta UI
// já sai mascarado igual (ver _empCnpjMask), então strings iguais = mesmo
// CNPJ de verdade.
async function _empCnpjJaExiste(cnpj, excludeId) {
 if (!cnpj || !_sb) return false;
 var q = _sb.from('empresas').select('id').eq('cnpj', cnpj).limit(1);
 if (excludeId) q = q.neq('id', excludeId);
 var res = await q;
 return !!(res.data && res.data.length);
}

// Máscara de Telefone (mesmo esquema de "_" pra posições vazias que o CNPJ
// já usa — pedido explícito: "molde semelhante ao que tem no do CNPJ").
// Diferente do CNPJ (sempre 14 dígitos), telefone BR varia entre fixo (10
// dígitos, "(00) 0000-0000") e celular (11 dígitos, "(00) 00000-0000") — o
// molde troca sozinho pro de 11 assim que o 11º dígito é digitado. Usada no
// campo Telefone do painel de Contato e no formulário rápido de contato
// (Obras) — o link de WhatsApp (_sanitizeTelWA acima) já limpa tudo que não
// é dígito, então funciona igual com ou sem a máscara.
var TEL_TEMPLATE_10 = '(00) 0000-0000';
var TEL_TEMPLATE_11 = '(00) 00000-0000';
function _cttTelMaskValue(input) {
 var digits = (input || '').replace(/\D/g, '').slice(0, 11);
 var template = digits.length > 10 ? TEL_TEMPLATE_11 : TEL_TEMPLATE_10;
 var di = 0, out = '';
 for (var i = 0; i < template.length; i++) {
  if (template.charAt(i) === '0') { out += (di < digits.length) ? digits.charAt(di) : '_'; di++; }
  else out += template.charAt(i);
 }
 return out;
}
function _cttTelMask(el) {
 var oldVal = el.value || '';
 var cursorPos = (el.selectionStart == null) ? oldVal.length : el.selectionStart;
 var digitsBeforeCursor = oldVal.slice(0, cursorPos).replace(/\D/g, '').length;
 var totalDigits = oldVal.replace(/\D/g, '').length;
 el.value = _cttTelMaskValue(oldVal);
 if (digitsBeforeCursor === 0) { el.setSelectionRange(0, 0); return; }
 var template = totalDigits > 10 ? TEL_TEMPLATE_11 : TEL_TEMPLATE_10;
 var seen = 0, pos = el.value.length;
 for (var i = 0; i < template.length; i++) {
  if (template.charAt(i) === '0') {
   seen++;
   if (seen === digitsBeforeCursor) { pos = i + 1; break; }
  }
 }
 el.setSelectionRange(pos, pos);
}

var _spEmpCurrentId = '';

async function _spEmpresas(row, tds) {
 var d = row.dataset;
 var empId = d.id || '';
 _spEmpCurrentId = empId;
 // Fonte de verdade: cache carregado do Supabase (_empresasArr), não o dataset
 // da linha (que fica em minúsculas, só para filtro) nem o DOM renderizado.
 var emp = (_empresasArr || []).find(function(e){ return String(e.id) === String(empId); }) || {};
 var nome = emp.nome || d.nome || '';
 var cnpj = emp.cnpj || '';
 var site = emp.url_site || '';
 var estado = (emp.estado || '').toUpperCase();
 var fase   = emp.fase_ciclo_vida || '';
 _spEmpCategoriaSel = (emp.categoria || []).slice();

 // Auditoria: criado_por/ultima_alteracao_por/created_at agora são mantidos
 // pelo trigger set_audit_fields() (empresas/contatos) — não é mais a
 // aplicação que precisa lembrar de setá-los, então created_at passou a ser
 // confiável e finalmente pode aparecer aqui como "Data de criação". updated_at
 // já era 100% confiável (trg_empresas_updated_at, de rodada anterior), mas
 // quem alimenta "Última modificação" continua sendo ultima_modificacao (a
 // data real migrada do Airtable — lastModifiedTime, 294 valores distintos
 // verificados por SQL — fora do escopo desta rodada trocar essa fonte).
 // Renderizado no FOOTER do painel, de propósito discreto (fonte pequena,
 // cor muted) — dados da empresa vêm primeiro, auditoria é informação
 // secundária de rodapé, não deve competir por atenção.
 var auditHtml = '<div style="margin-top:24px;border-top:1px solid var(--border);padding-top:12px">'
  + '<div style="font-size:10px;font-weight:600;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px;opacity:.85">Auditoria</div>'
  + '<div class="drw-audit-row"><span class="drw-audit-lbl">Criado por</span><span class="drw-audit-val">'+(emp.criado_por||'—')+'</span></div>'
  + '<div class="drw-audit-row"><span class="drw-audit-lbl">Data de criação</span><span class="drw-audit-val">'+(emp.created_at ? new Date(emp.created_at).toLocaleDateString('pt-BR') : '—')+'</span></div>'
  + '<div class="drw-audit-row"><span class="drw-audit-lbl">Última alteração por</span><span class="drw-audit-val">'+(emp.ultima_alteracao_por||'—')+'</span></div>'
  + '<div class="drw-audit-row"><span class="drw-audit-lbl">Última modificação</span><span class="drw-audit-val">'+(emp.ultima_modificacao ? new Date(emp.ultima_modificacao).toLocaleString('pt-BR') : '—')+'</span></div>'
  + '</div>';

 _spSet('Empresa', nome,
  '<div class="sp-field"><div class="sp-label">Razão Social <span style="color:var(--red)">*</span></div>'
  + '<input class="sp-inp" id="sp-emp-nome" value="'+nome.replace(/"/g,'&quot;')+'" oninput="_empScheduleAutoSave()"></div>'
  + '<div class="sp-g2">'
  + '<div class="sp-field"><div class="sp-label">CNPJ <span style="color:var(--red)">*</span></div><input class="sp-inp" id="sp-emp-cnpj" value="'+_empCnpjMaskValue(cnpj).replace(/"/g,'&quot;')+'" oninput="_empCnpjMask(this);_empScheduleAutoSave()"></div>'
  + '<div class="sp-field"><div class="sp-label">Estado</div>'+_spEmpEstadoMarkup(estado)+'</div>'
  + '</div>'
  + '<div class="sp-g2">'
  + '<div class="sp-field"><div class="sp-label">Categoria</div><div id="sp-emp-categoria-dropdown"></div></div>'
  + '<div class="sp-field"><div class="sp-label">Fase</div><select class="sp-inp" id="sp-emp-fase" onchange="_empScheduleAutoSave()">'+_spEmpOptSelect(EMPRESA_FASE_OPCOES, fase)+'</select></div>'
  + '</div>'
  + '<div class="sp-field"><div class="sp-label">URL do site</div>'
  + '<input class="sp-inp" id="sp-emp-site" type="url" placeholder="https://..." value="'+site.replace(/"/g,'&quot;')+'" oninput="_empScheduleAutoSave()"></div>'
  + '<input type="hidden" id="sp-emp-id" value="'+empId+'">'
  + '<div style="margin-top:20px;border-top:1px solid var(--border);padding-top:16px">'
  + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
  + '<div style="font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.5px;text-transform:uppercase">Obras vinculadas</div>'
  + '<button type="button" class="btn btn-ghost" style="padding:2px 8px;font-size:11px" onclick="_empLinkToggle(\'obra\')">+ Vincular</button>'
  + '</div>'
  + '<div id="sp-emp-link-obra" style="display:none;margin-bottom:8px"></div>'
  + '<div id="sp-emp-obras" class="sp-rel-chips-wrap">'
  + '<div style="font-size:12px;color:var(--muted);padding:12px 0">Carregando obras...</div>'
  + '</div></div>'
  + '<div style="margin-top:20px;border-top:1px solid var(--border);padding-top:16px">'
  + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
  + '<div style="font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.5px;text-transform:uppercase">Contatos vinculados</div>'
  + '<button type="button" class="btn btn-ghost" style="padding:2px 8px;font-size:11px" onclick="_empLinkToggle(\'contato\')">+ Vincular</button>'
  + '</div>'
  + '<div id="sp-emp-link-contato" style="display:none;margin-bottom:8px"></div>'
  + '<div id="sp-emp-contatos" class="sp-rel-chips-wrap">'
  + '<div style="font-size:12px;color:var(--muted);padding:12px 0">Carregando contatos...</div>'
  + '</div></div>'
  + auditHtml,
  // Sem botão "Salvar": o painel já autosalva (_empScheduleAutoSave, ver
  // campos acima) — pedir pra clicar em algo pra persistir uma mudança que
  // já foi salva sozinha é redundante e confunde ("salvei ou não?").
  // "Excluir" fica aqui (com confirmação) em vez de só na listagem, porque
  // é a única ação puramente destrutiva do painel.
  '<button class="btn btn-ghost" style="color:var(--red);border-color:var(--red);margin-right:auto" onclick="_spDeleteEmpresa(\''+empId+'\',\''+nome.replace(/'/g,"\\'")+'\')">Excluir empresa</button> '
  + '<button class="btn btn-ghost" onclick="closePanel()">Fechar</button>'
 );

 _spEmpRenderCategoriaDropdown();

 if (!_sb || !empId) return;

 // Obras vinculadas — busca preguiçosa (só quando o painel de UMA empresa
 // abre, não junto de _dbLoadEmpresas pra todas as 636 de uma vez): a
 // relação empresa→obra vem da junction empresas_obras (verificada com 1561
 // linhas reais em produção antes de escrever este código). Renderizado como
 // chip clicável (padrão Airtable, ver _spRelChipHTML em side-panel.js) —
 // clicar abre o painel da própria Obra via _spOpenEntityById.
 _sb.from('empresas_obras')
  .select('obra:obra_id(id, nome)')
  .eq('empresa_id', empId)
  .then(function(res) {
   var container = document.getElementById('sp-emp-obras');
   if (!container) return;
   if (res.error || !res.data || !res.data.length) {
    container.innerHTML = '<div class="sp-empty">Nenhuma obra vinculada a esta empresa.</div>';
    return;
   }
   container.innerHTML = res.data.map(function(link) {
    var o = link.obra;
    if (!o) return '';
    return _spRelChipHTML('obras', o.id, o.nome || '—', null, "_empUnlink('obra','"+empId+"','"+o.id+"','"+(o.nome||'').replace(/'/g,"\\'")+"')");
   }).join('');
  });

 var res = await _sb.from('contatos_empresas')
  .select('is_primary, contato:contato_id(id, nome_completo, cargo, email, telefone)')
  .eq('empresa_id', empId)
  .order('is_primary', { ascending: false });

 var container = document.getElementById('sp-emp-contatos');
 if (!container) return;

 if (res.error || !res.data || !res.data.length) {
  container.innerHTML = '<div class="sp-empty">Nenhum contato vinculado a esta empresa.</div>';
  return;
 }

 // Contatos vinculados — mesmo tratamento de chip clicável dos Obras acima
 // (ver ponto 5 do pedido: componente único e reaproveitável, não um
 // renderer dedicado por entidade). Clicar abre o painel do próprio Contato
 // via _spOpenEntityById → _spContatoById (ver abaixo). O card rico com
 // avatar/telefone/e-mail que existia aqui antes deu lugar a este chip mais
 // leve — telefone/e-mail com ações (WhatsApp, copiar) continuam disponíveis
 // dentro do painel do Contato, um clique adiante.
 container.innerHTML = res.data.map(function(link) {
  var c = link.contato;
  if (!c) return '';
  var nome = c.nome_completo || '—';
  var sub = link.is_primary ? 'Principal' : (c.cargo || '');
  return _spRelChipHTML('contatos', c.id, nome, sub, "_empUnlink('contato','"+empId+"','"+c.id+"','"+nome.replace(/'/g,"\\'")+"')");
 }).join('');
}

// ── Vincular Obra/Contato a partir do painel de Empresa (ponto #5 do pedido:
// antes só dava pra VER obras/contatos já vinculados, não pra associar um
// novo por aqui — só editando o outro lado, obra por obra/contato por
// contato). Busca ao vivo (debounce) por nome direto no Supabase — não
// depende de _obrasAll/_contatosArr (populados só quando Dashboard/Contatos
// já foram visitados nesta sessão), então funciona mesmo abrindo Empresas
// como primeira tela.
// Mesmo componente visual/estrutural do seletor de Estado acima (_spEmpEstadoMarkup)
// e do picker de Obra/Projeto do Gestor de Tarefas (nt-obra-* em dashboard.js):
// caixa com busca embutida que já abre com a lista carregada (não fica vazia
// até digitar 2+ letras — esse era o bug real do "não aparecem as obras": a
// versão anterior só buscava a partir do 2º caractere e não mostrava nada de
// cara). Clicar num item já vincula na hora (sem precisar de um botão
// "Confirmar" à parte) e a caixa fecha sozinha.
var _empLinkCache = { obra: null, contato: null }; // cache da lista completa por tipo, carregada 1x por abertura
function _empLinkToggle(tipo) {
 var box = document.getElementById('sp-emp-link-' + tipo);
 if (!box) return;
 var abrir = box.style.display === 'none';
 ['obra','contato'].forEach(function(t){
  var b = document.getElementById('sp-emp-link-' + t);
  if (b && t !== tipo) b.style.display = 'none';
 });
 box.style.display = abrir ? '' : 'none';
 if (!abrir) { box.innerHTML = ''; return; }
 box.innerHTML = '<div class="srch-sel" style="width:100%">'
  + '<div class="srch-sel-drop open" style="position:static;box-shadow:none;border:1px solid var(--border)">'
  + '<input class="srch-sel-inp" type="text" placeholder="Buscar '+(tipo==='obra'?'obra':'contato')+' pelo nome..." '
  + 'oninput="_empLinkFilter(\''+tipo+'\', this.value)">'
  + '<div class="srch-sel-list" id="sp-emp-link-'+tipo+'-list"><div class="srch-sel-empty">Carregando...</div></div>'
  + '</div></div>';
 _empLinkLoad(tipo);
}
// Carrega a lista completa (as ~1500 obras/700 contatos cabem tranquilo numa
// única chamada — mesmo padrão de _lookupPage em tarefas.js) só na 1ª vez que
// a caixa abre nesta sessão de painel; filtrar depois é local (sem round-trip
// no banco a cada tecla).
function _empLinkLoad(tipo) {
 var table = tipo === 'obra' ? 'obras' : 'contatos';
 var col   = tipo === 'obra' ? 'nome'  : 'nome_completo';
 _sb.from(table).select('id, ' + col).order(col).limit(2000).then(function(res) {
  _empLinkCache[tipo] = (res.data || []).map(function(r){ return { id: r.id, nome: r[col] || '—' }; });
  _empLinkRenderList(tipo, '');
 });
}
function _empLinkFilter(tipo, q) { _empLinkRenderList(tipo, q); }
function _empLinkRenderList(tipo, q) {
 var listEl = document.getElementById('sp-emp-link-' + tipo + '-list');
 if (!listEl) return;
 var all = _empLinkCache[tipo];
 if (!all) { listEl.innerHTML = '<div class="srch-sel-empty">Carregando...</div>'; return; }
 var qn = (q || '').trim().toLowerCase();
 var matches = qn ? all.filter(function(o){ return o.nome.toLowerCase().indexOf(qn) !== -1; }) : all;
 matches = matches.slice(0, 50); // lista já filtrada localmente, só limita o DOM renderizado
 if (!matches.length) { listEl.innerHTML = '<div class="srch-sel-empty">Nenhum(a) '+(tipo==='obra'?'obra':'contato')+' encontrado(a).</div>'; return; }
 listEl.innerHTML = matches.map(function(o) {
  var label = (o.nome || '—').replace(/</g,'&lt;');
  var idSafe = String(o.id).replace(/'/g,"\\'");
  return '<div class="srch-sel-opt" onclick="_empLinkAdd(\''+tipo+'\',\''+idSafe+'\',\''+label.replace(/'/g,"\\'")+'\')">' + label + '</div>';
 }).join('');
}
async function _empLinkAdd(tipo, id, label) {
 var empId = _spEmpCurrentId;
 if (!id) return;
 // Modo criação (painel de "Nova empresa", ainda sem id no banco): guarda só
 // na fila local — o vínculo de verdade é gravado por _spCriarEmpresa()
 // junto com a empresa, na mesma ação.
 if (!empId) {
  var arr = _spNovaVinculosArr(tipo);
  if (!arr.some(function(x){ return String(x.id) === String(id); })) arr.push({ id: id, nome: label });
  _empLinkToggle(tipo);
  _spNovaVinculosRefresh(tipo);
  return;
 }
 var res;
 if (tipo === 'obra') {
  res = await _sb.from('empresas_obras').insert({ empresa_id: empId, obra_id: id });
 } else {
  res = await _sb.from('contatos_empresas').insert({ empresa_id: empId, contato_id: id });
 }
 if (res.error) {
  _showToast('Erro ao vincular: ' + _supaErrPt(res.error.message), 'erro');
  return;
 }
 _showToast((tipo==='obra'?'Obra':'Contato') + ' vinculado(a)!', 'ok');
 _empLinkToggle(tipo); // fecha a busca
 // Recarrega só os chips da seção afetada, sem fechar o painel.
 var row = document.querySelector('#emp-tbody tr[data-id="'+empId+'"]');
 if (row) _spEmpresas(row, []);
}

// Desvincular — o par exatamente inverso do _empLinkAdd acima: os chips de
// "Obras vinculadas"/"Contatos vinculados" eram só de leitura+navegação (ver
// _spRelChipHTML), sem jeito de remover um vínculo por engano sem editar a
// obra/contato do outro lado. Confirmação simples porque desvincular não
// apaga a obra/contato em si, só a relação — bem menos destrutivo que
// _spDeleteEmpresa (por isso sem o aviso mais forte de lá).
async function _empUnlink(tipo, empId, relId, label) {
 if (!confirm('Desvincular "' + (label || '') + '" desta empresa?')) return;
 var table = tipo === 'obra' ? 'empresas_obras' : 'contatos_empresas';
 var col   = tipo === 'obra' ? 'obra_id' : 'contato_id';
 var res = await _sb.from(table).delete().eq('empresa_id', empId).eq(col, relId);
 if (res.error) {
  _showToast('Erro ao desvincular: ' + _supaErrPt(res.error.message), 'erro');
  return;
 }
 _showToast((tipo==='obra'?'Obra':'Contato') + ' desvinculado(a).', 'ok');
 var row = document.querySelector('#emp-tbody tr[data-id="'+empId+'"]');
 if (row) _spEmpresas(row, []);
}

// ── Renderer: Contatos ───────────────────────────────────────────────────────
function _spContatos(row, tds) {
 _spContatoById(row.dataset.id);
}

var _spCttCurrentId = '';

function _spContatoById(id) {
 var c = (_contatosArr || []).find(function(x){ return String(x.id) === String(id); }) || {};
 _spCttCurrentId = String(c.id || id || '');
 var nome  = c.nome_completo ? c.nome_completo.replace(/\w/g,function(l){return l.toUpperCase();}) : '';
 var cargo = c.cargo || '';
 var email = c.email || '';
 var tel   = c.telefone || '';
 _spSet('Contato', nome,
  '<div class="sp-field"><div class="sp-label">Nome</div>'
  + '<input class="sp-inp" id="sp-ctt-nome" value="'+nome.replace(/"/g,'&quot;')+'" oninput="_cttScheduleAutoSave()"></div>'
  + '<div class="sp-g2">'
  + '<div class="sp-field"><div class="sp-label">Cargo</div><select class="sp-inp" id="sp-ctt-cargo" onchange="_cttScheduleAutoSave()">'+_spEmpOptSelect(CONTATO_CARGO_OPCOES, cargo)+'</select></div>'
  + '<div class="sp-field"><div class="sp-label">E-mail</div><input class="sp-inp" id="sp-ctt-email" type="email" value="'+email.replace(/"/g,'&quot;')+'" oninput="_cttScheduleAutoSave()"></div>'
  + '</div>'
  + '<div class="sp-field"><div class="sp-label">Telefone</div>'
  + '<input class="sp-inp" id="sp-ctt-telefone" type="tel" value="'+_cttTelMaskValue(tel).replace(/"/g,'&quot;')+'" oninput="_cttTelMask(this);_cttScheduleAutoSave()"></div>'
  + '<input type="hidden" id="sp-ctt-id" value="'+_spCttCurrentId+'">'
  // Empresas vinculadas: N:N de verdade (contatos_empresas), igual no
  // Airtable — mesmo padrão de chips + "+ Vincular" já usado em "Obras
  // vinculadas"/"Contatos vinculados" no painel de Empresa (_spEmpresas). A
  // Fase do Ciclo de Vida de cada empresa aparece como subtítulo do chip
  // (dado da empresa, não existe campo próprio em contatos).
  + '<div style="margin-top:20px;border-top:1px solid var(--border);padding-top:16px">'
  + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
  + '<div style="font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.5px;text-transform:uppercase">Empresas vinculadas</div>'
  + '<button type="button" class="btn btn-ghost" style="padding:2px 8px;font-size:11px" onclick="_cttEmpLinkToggle()">+ Vincular</button>'
  + '</div>'
  + '<div id="sp-ctt-link-empresa" style="display:none;margin-bottom:8px"></div>'
  + '<div id="sp-ctt-empresas" class="sp-rel-chips-wrap">'
  + '<div style="font-size:12px;color:var(--muted);padding:12px 0">Carregando empresas...</div>'
  + '</div></div>',
  // Mesmo padrão de _spDeleteEmpresa: "Excluir" fica no painel de detalhe
  // (com confirm() nativo), não só na listagem — é a única ação destrutiva.
  '<button class="btn btn-ghost" style="color:var(--red);border-color:var(--red);margin-right:auto" onclick="_spDeleteContato(\''+_spCttCurrentId+'\',\''+nome.replace(/'/g,"\\'")+'\')">Excluir contato</button> '
  + '<button class="btn btn-ghost" onclick="closePanel()">Fechar</button>');

 if (!_sb || !_spCttCurrentId) return;
 _cttRenderEmpresasVinculadas();
}

async function _spDeleteContato(id, nome) {
 if (!id) return;
 if (!confirm('Excluir "' + (nome || 'este contato') + '"?\n\nOs vínculos com empresas também serão removidos. Esta ação não pode ser desfeita.')) return;
 closePanel();
 _showToast('Excluindo...', 'ok');
 var res = await _sb.from('contatos').delete().eq('id', id);
 if (res.error) {
  _showToast('Erro ao excluir: ' + _supaErrPt(res.error.message), 'erro');
  return;
 }
 _showToast('Contato excluído.', 'ok');
 _dbLoadContatos();
}

async function _cttRenderEmpresasVinculadas() {
 var cttId = _spCttCurrentId;
 var res = await _sb.from('contatos_empresas')
  .select('is_primary, empresa:empresa_id(id, nome, fase_ciclo_vida)')
  .eq('contato_id', cttId)
  .order('is_primary', { ascending: false });
 var container = document.getElementById('sp-ctt-empresas');
 if (!container) return;
 if (res.error || !res.data || !res.data.length) {
  container.innerHTML = '<div class="sp-empty">Nenhuma empresa vinculada a este contato.</div>';
  return;
 }
 container.innerHTML = res.data.map(function(link) {
  var e = link.empresa;
  if (!e) return '';
  return _spRelChipHTML('empresas', e.id, e.nome || '—', e.fase_ciclo_vida || '', "_cttUnlinkEmpresa('"+cttId+"','"+e.id+"','"+(e.nome||'').replace(/'/g,"\\'")+"')");
 }).join('');
}

async function _cttUnlinkEmpresa(cttId, empId, label) {
 if (!confirm('Desvincular "' + (label || '') + '" deste contato?')) return;
 var res = await _sb.from('contatos_empresas').delete().eq('contato_id', cttId).eq('empresa_id', empId);
 if (res.error) { _showToast('Erro ao desvincular: ' + _supaErrPt(res.error.message), 'erro'); return; }
 _showToast('Empresa desvinculada.', 'ok');
 _cttRenderEmpresasVinculadas();
 _cttRefreshRowFromDB(cttId);
}

// Cache da lista completa de empresas (as ~636 cabem numa única chamada,
// mesmo padrão de _empLinkCache) — carregada 1x por abertura do seletor.
var _cttEmpLinkCache = null;
function _cttEmpLinkToggle() {
 var box = document.getElementById('sp-ctt-link-empresa');
 if (!box) return;
 var abrir = box.style.display === 'none';
 box.style.display = abrir ? '' : 'none';
 if (!abrir) { box.innerHTML = ''; return; }
 box.innerHTML = '<div class="srch-sel" style="width:100%">'
  + '<div class="srch-sel-drop open" style="position:static;box-shadow:none;border:1px solid var(--border)">'
  + '<input class="srch-sel-inp" type="text" placeholder="Buscar empresa pelo nome..." oninput="_cttEmpLinkFilter(this.value)">'
  + '<div class="srch-sel-list" id="sp-ctt-link-empresa-list"><div class="srch-sel-empty">Carregando...</div></div>'
  + '</div></div>';
 _cttEmpLinkLoad();
}
function _cttEmpLinkLoad() {
 _sb.from('empresas').select('id, nome').order('nome').limit(2000).then(function(res) {
  _cttEmpLinkCache = (res.data || []).map(function(r){ return { id: r.id, nome: r.nome || '—' }; });
  _cttEmpLinkRenderList('');
 });
}
function _cttEmpLinkFilter(q) { _cttEmpLinkRenderList(q); }
function _cttEmpLinkRenderList(q) {
 var listEl = document.getElementById('sp-ctt-link-empresa-list');
 if (!listEl) return;
 var all = _cttEmpLinkCache;
 if (!all) { listEl.innerHTML = '<div class="srch-sel-empty">Carregando...</div>'; return; }
 var qn = (q || '').trim().toLowerCase();
 var matches = qn ? all.filter(function(o){ return o.nome.toLowerCase().indexOf(qn) !== -1; }) : all;
 matches = matches.slice(0, 50);
 if (!matches.length) { listEl.innerHTML = '<div class="srch-sel-empty">Nenhuma empresa encontrada.</div>'; return; }
 listEl.innerHTML = matches.map(function(o) {
  var label = (o.nome || '—').replace(/</g,'&lt;');
  var idSafe = String(o.id).replace(/'/g,"\\'");
  return '<div class="srch-sel-opt" onclick="_cttEmpLinkAdd(\''+idSafe+'\',\''+label.replace(/'/g,"\\'")+'\')">' + label + '</div>';
 }).join('');
}
async function _cttEmpLinkAdd(empId, label) {
 var cttId = _spCttCurrentId;
 if (!empId || !cttId) return;
 var res = await _sb.from('contatos_empresas').insert({ contato_id: cttId, empresa_id: empId });
 if (res.error) { _showToast('Erro ao vincular: ' + _supaErrPt(res.error.message), 'erro'); return; }
 _showToast('Empresa vinculada.', 'ok');
 _cttEmpLinkToggle();
 _cttRenderEmpresasVinculadas();
 _cttRefreshRowFromDB(cttId);
}

// Recarrega só os vínculos do contato (não a lista inteira) e atualiza a
// linha correspondente na tabela + o cache local, sem esperar um reload de
// todos os ~700 contatos — mesmo princípio de _spSaveEmpresa (autosave não
// deve custar uma consulta cara pra refletir 1 mudança pequena).
function _cttRefreshRowFromDB(cttId) {
 _sb.from('contatos_empresas').select('is_primary, empresa:empresa_id(id, nome, fase_ciclo_vida)').eq('contato_id', cttId).then(function(r) {
  var c = (_contatosArr || []).find(function(x){ return String(x.id) === String(cttId); });
  if (c && r.data) {
   c.contatos_empresas = r.data;
   var tr = document.querySelector('#ctt-tbody tr[data-id="'+cttId+'"]');
   if (tr) tr.outerHTML = _cttRowHTML(c);
  }
 });
}

// Autosave (mesmo debounce de 700ms do painel de Empresa, _empScheduleAutoSave)
// — antes o painel de Contato não tinha handler NENHUM nos campos, então
// nada digitado ali era salvo de verdade.
var _cttAutoSaveTimer = null;
function _cttScheduleAutoSave() {
 if (_cttAutoSaveTimer) clearTimeout(_cttAutoSaveTimer);
 _cttAutoSaveTimer = setTimeout(function(){ _spSaveContato(); }, 700);
}
async function _spSaveContato() {
 if (_cttAutoSaveTimer) { clearTimeout(_cttAutoSaveTimer); _cttAutoSaveTimer = null; }
 var id = (document.getElementById('sp-ctt-id') || {}).value;
 if (!_sb || !id) return;
 // Mesma regra do CNPJ: 0 dígitos = deixado em branco de propósito (ok);
 // 10 ou 11 = completo, salva mascarado; 1-9 = incompleto, não salva até
 // completar (senão uma pausa no meio da digitação salvaria lixo).
 var telEl = document.getElementById('sp-ctt-telefone');
 var telDigits = ((telEl || {}).value || '').replace(/\D/g, '');
 if (telDigits.length > 0 && telDigits.length < 10) {
  _showToast('Telefone incompleto — informe DDD + número (10 ou 11 dígitos).', 'erro');
  if (telEl) { telEl.style.borderColor = 'var(--red)'; setTimeout(function(){ telEl.style.borderColor = ''; }, 2500); }
  return;
 }
 var payload = {
  nome_completo: (document.getElementById('sp-ctt-nome')  || {}).value.trim() || null,
  cargo:         (document.getElementById('sp-ctt-cargo') || {}).value || null,
  email:         (document.getElementById('sp-ctt-email') || {}).value.trim() || null,
  telefone:      telDigits.length > 0 ? _cttTelMaskValue(telDigits) : null,
 };
 var { error } = await _sb.from('contatos').update(payload).eq('id', id);
 if (error) { _showToast('Erro ao salvar contato: ' + _supaErrPt(error.message), 'erro'); return; }
 var titleEl = document.getElementById('sp-title');
 if (titleEl) titleEl.textContent = payload.nome_completo;
 var idx = (_contatosArr || []).findIndex(function(c){ return String(c.id) === String(id); });
 if (idx !== -1) {
  Object.assign(_contatosArr[idx], payload);
  var tr = document.querySelector('#ctt-tbody tr[data-id="'+id+'"]');
  if (tr) tr.outerHTML = _cttRowHTML(_contatosArr[idx]);
  if (typeof _cttApplyFilters === 'function') _cttApplyFilters();
 }
}

var _empColorPalette = ['#3D4FD1','#1F8A4C','#e07b00','#8B6FE8','#1f7ec4','#c44b1f','#0f766e','#9c27b0'];
function _empColor(name) {
 var c = 0; for (var j = 0; j < (name||'').length; j++) c += name.charCodeAt(j);
 return _empColorPalette[c % _empColorPalette.length];
}
function _empFaseTag(fase) {
 var f = (fase||'').toLowerCase();
 if (!fase || fase === '—') return '<span class="nt-tag nt-tag-gray">—</span>';
 if (f.includes('cliente') || f.includes('parceiro') || f.includes('ativo')) return '<span class="nt-tag nt-tag-green">'+fase+'</span>';
 if (f.includes('negoci') || f.includes('proposta') || f.includes('qualif')) return '<span class="nt-tag nt-tag-blue">'+fase+'</span>';
 if (f.includes('lead') || f.includes('prospect') || f.includes('contato')) return '<span class="nt-tag nt-tag-yellow">'+fase+'</span>';
 if (f.includes('inativ') || f.includes('perdid') || f.includes('cancel')) return '<span class="nt-tag nt-tag-gray">'+fase+'</span>';
 return '<span class="nt-tag nt-tag-gray">'+fase+'</span>';
}
// Extraído de _dbLoadEmpresas (era closure local ao map) pra ser reaproveitado
// também por _empRenderGrouped abaixo — mesmo <tr>, dataset idêntico, tanto
// na renderização flat quanto na agrupada.
function _empRowHTML(e) {
 var initials = (e.nome||'?').split(' ').filter(Boolean).slice(0,2).map(function(w){return w[0];}).join('').toUpperCase();
 var nCtt = (e.contatos_empresas||[]).length;
 var obraNomes = (e.empresas_obras||[]).map(function(l){ return l.obra && l.obra.nome; }).filter(Boolean);
 var cats = (e.categoria||[]);
 var fase = e.fase_ciclo_vida || '—';
 return '<tr onclick="if(!event.target.closest(\'button,a,input,select\'))_spOpen(\'empresas\',this)"'
  + ' data-id="'+e.id+'"'
  + ' data-nome="'+(e.nome||'').toLowerCase()+'"'
  + ' data-fase="'+fase.toLowerCase()+'"'
  + ' data-estado="'+(e.estado||'').toLowerCase()+'"'
  + ' data-categoria="'+cats.join(',').toLowerCase()+'"'
  + ' data-cnpj="'+(e.cnpj||'').toLowerCase()+'"'
  + ' data-site="'+(e.url_site||'').toLowerCase()+'"'
  + ' data-ultalt="'+(e.ultima_alteracao_por||'').toLowerCase()+'"'
  + ' data-obra="'+obraNomes.join(',').toLowerCase()+'"'
  + ' data-ctt="'+(nCtt>0?'com contato':'sem contato')+'">'
  + '<td><div style="display:flex;align-items:center;gap:10px">'
  + '<div class="nt-avatar" style="background:'+_empColor(e.nome)+'">'+initials+'</div>'
  + '<div><div style="font-weight:500;font-size:13px">'+e.nome+'</div>'
  + '<div style="font-size:11px;color:var(--muted)">'+(e.cnpj||'—')+'</div></div>'
  + '</div></td>'
  + '<td style="font-size:12px;color:var(--muted)">'+(cats.join(', ')||'—')+'</td>'
  + '<td style="font-size:12px;color:var(--muted)">'+(e.estado||'—')+'</td>'
  + '<td>'+_empFaseTag(fase)+'</td>'
  + '<td style="text-align:center;font-weight:'+(nCtt>0?'600':'400')+';color:'+(nCtt>0?'var(--text)':'var(--muted)')+'">'+nCtt+'</td>'
  + '<td><button class="nt-open-btn" onclick="event.stopPropagation();_spOpen(\'empresas\',this.closest(\'tr\'))" style="font-size:11px;color:var(--muted);background:rgba(0,0,0,.06);border:none;border-radius:4px;padding:3px 8px;cursor:pointer;font-weight:500;opacity:0;transition:opacity .12s">Abrir →</button></td>'
  + '</tr>';
}

async function _dbLoadEmpresas() {
 var tbody0 = document.getElementById('emp-tbody');
 if (tbody0) tbody0.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:32px;font-size:13px">Carregando...</td></tr>';
 var allData = []; var from = 0; var more = true;
 while (more) {
  var res = await _sb.from('empresas')
   .select('id, nome, cnpj, estado, fase_ciclo_vida, categoria, url_site, criado_por, ultima_alteracao_por, ultima_modificacao, created_at, contatos_empresas(contato_id), empresas_obras(obra:obra_id(nome))')
   .order('nome').range(from, from + 999);
  if (res.error || !res.data || !res.data.length) break;
  allData = allData.concat(res.data);
  more = res.data.length === 1000; from += 1000;
 }
 _empresasArr = allData;

 // Atualiza badges e stats
 var badge = document.getElementById('badge-emp');
 if (badge) badge.textContent = allData.length;
 // Badge do menu lateral: ver _navBadgesLoadInitial() (RPC de contagem).
 if (!allData.length) return;
 var stTotal = document.getElementById('emp-stat-total');
 if (stTotal) stTotal.textContent = allData.length;
 var stCtt = document.getElementById('emp-stat-ctt');
 if (stCtt) stCtt.textContent = allData.filter(function(e){ return (e.contatos_empresas||[]).length > 0; }).length;
 var countEl = document.getElementById('emp-count');
 if (countEl) countEl.textContent = allData.length + ' registros';

 var tbody = document.getElementById('emp-tbody');
 if (!tbody) return;

 tbody.innerHTML = allData.map(_empRowHTML).join('');
 // Reaplica filtro/busca/ordenação/agrupamento atuais (se algum estiver
 // ativo) — sem isso, um recarregamento em segundo plano (realtime, ou o
 // refresh disparado por obras.js) reverteria silenciosamente pra visão
 // flat/sem filtro até a pessoa interagir de novo com a toolbar.
 if (typeof _empApplyFilters === 'function') _empApplyFilters();
}

// ── Sanitiza telefone para link WhatsApp ─────────────────────────────────────
function _sanitizeTelWA(raw) {
 if (!raw) return null;
 var digits = raw.replace(/\D/g, '');
 if (digits.startsWith('55') && digits.length >= 12 && digits.length <= 13) return digits;
 if (digits.length >= 10 && digits.length <= 11) return '55' + digits;
 return null;
}

// SVGs inline para ações de contato
var _icoWA   = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>';
var _icoCall = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5.1 2.2A1 1 0 0 0 4 2H2.5A1 1 0 0 0 1.5 3C1.5 9.35 6.65 14.5 13 14.5a1 1 0 0 0 1-1V12a1 1 0 0 0-.8-.98l-2.5-.5a1 1 0 0 0-.98.3l-1.1 1.1a10.07 10.07 0 0 1-4.54-4.54l1.1-1.1a1 1 0 0 0 .3-.98z"/></svg>';
var _icoCopy = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M3 11H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v1"/></svg>';
var _icoMail = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="1" y="3" width="14" height="10" rx="1.5"/><polyline points="1,4 8,9 15,4"/></svg>';

function _cttColor(name) {
 var c = 0; for (var j = 0; j < (name||'').length; j++) c += name.charCodeAt(j);
 return _empColorPalette[c % _empColorPalette.length];
}
// Empresa primária de um contato via junction contatos_empresas (mesma regra
// em todo lugar que precisa disso: is_primary, senão a primeira vinculada).
function _cttEmpresaPrimaria(c) {
 var links = c.contatos_empresas || [];
 var empLink = links.find(function(l){ return l.is_primary; }) || links[0];
 return (empLink && empLink.empresa && empLink.empresa.nome) || '';
}
// Um contato pode estar vinculado a mais de uma empresa (contatos_empresas é
// N:N, igual no Airtable) — usada na coluna Empresa da tabela, que agora
// mostra todos os vínculos em vez de só o primário/primeiro.
function _cttEmpresasNomesTodas(c) {
 return (c.contatos_empresas || []).map(function(l){ return l.empresa && l.empresa.nome; }).filter(Boolean);
}
// Fase do Ciclo de Vida vem da EMPRESA vinculada (contatos não tem esse
// campo próprio) — usa a mesma empresa "primária" de _cttEmpresaPrimaria
// pra decidir qual fase mostrar quando há mais de uma empresa vinculada.
function _cttFasePrimaria(c) {
 var links = c.contatos_empresas || [];
 var empLink = links.find(function(l){ return l.is_primary; }) || links[0];
 return (empLink && empLink.empresa && empLink.empresa.fase_ciclo_vida) || '';
}
// Categoria/Estado — mesma empresa "primária", mesmo raciocínio de _cttFasePrimaria.
function _cttCategoriaPrimaria(c) {
 var links = c.contatos_empresas || [];
 var empLink = links.find(function(l){ return l.is_primary; }) || links[0];
 var cats = (empLink && empLink.empresa && empLink.empresa.categoria) || [];
 return cats.join(', ');
}
function _cttEstadoPrimario(c) {
 var links = c.contatos_empresas || [];
 var empLink = links.find(function(l){ return l.is_primary; }) || links[0];
 return ((empLink && empLink.empresa && empLink.empresa.estado) || '').toUpperCase();
}
// Extraído de _dbLoadContatos (era closure local ao map) pra ser reaproveitado
// também por _cttRenderGrouped abaixo.
function _cttRowHTML(c) {
 var nome = c.nome_completo || '—';
 var initials = nome.split(' ').filter(Boolean).slice(0,2).map(function(w){return w[0];}).join('').toUpperCase() || '?';
 var empNomes = _cttEmpresasNomesTodas(c);
 var empNome = empNomes.join(', ') || '—';
 var fase = _cttFasePrimaria(c);

 // Telefone + ações hover
 var telCell = '<span style="font-size:12px;color:var(--muted)">—</span>';
 if (c.telefone) {
  var waNum = _sanitizeTelWA(c.telefone);
  var telSafe = c.telefone.replace(/'/g, '&#39;');
  telCell = '<div class="ctt-contact-cell">'
   + '<span class="ctt-val">'+c.telefone+'</span>'
   + '<span class="ctt-acts">'
   + (waNum ? '<a href="https://wa.me/'+waNum+'" target="_blank" class="ctt-act-btn wa" title="WhatsApp">'+_icoWA+'</a>' : '')
   + '<button onclick="navigator.clipboard.writeText(\''+telSafe+'\');var t=this;t.title=\'Copiado!\';setTimeout(function(){t.title=\'Copiar\'},1500)" class="ctt-act-btn" title="Copiar">'+_icoCopy+'</button>'
   + '</span></div>';
 }

 // Email + ações hover
 var emailCell = '<span style="font-size:12px;color:var(--muted)">—</span>';
 if (c.email) {
  var emailSafe = c.email.replace(/'/g, '&#39;');
  emailCell = '<div class="ctt-contact-cell">'
   + '<span class="ctt-val">'+c.email+'</span>'
   + '<span class="ctt-acts">'
   + '<a href="mailto:'+c.email+'" class="ctt-act-btn" title="Enviar e-mail">'+_icoMail+'</a>'
   + '<button onclick="navigator.clipboard.writeText(\''+emailSafe+'\');var t=this;t.title=\'Copiado!\';setTimeout(function(){t.title=\'Copiar\'},1500)" class="ctt-act-btn" title="Copiar">'+_icoCopy+'</button>'
   + '</span></div>';
 }

 return '<tr onclick="if(!event.target.closest(\'button,a,input,select\'))_spOpen(\'contatos\',this)"'
  + ' data-id="'+c.id+'"'
  + ' data-nome="'+nome.toLowerCase()+'"'
  + ' data-cargo="'+(c.cargo||'').toLowerCase()+'"'
  + ' data-empresa="'+empNome.toLowerCase()+'"'
  + ' data-fase="'+fase.toLowerCase()+'"'
  + ' data-categoria="'+_cttCategoriaPrimaria(c).toLowerCase()+'"'
  + ' data-estado="'+_cttEstadoPrimario(c).toLowerCase()+'"'
  + ' data-telefone="'+(c.telefone||'').toLowerCase()+'"'
  + ' data-email="'+(c.email||'').toLowerCase()+'"'
  + ' data-created_at="'+(c.created_at||'').slice(0,10)+'"'
  + ' data-ultima_alteracao_por="'+(c.ultima_alteracao_por||'').toLowerCase()+'">'
  + '<td><div style="display:flex;align-items:center;gap:9px">'
  + '<div class="nt-avatar nt-avatar-circle" style="background:'+_cttColor(nome)+'">'+initials+'</div>'
  + '<div style="font-weight:500;font-size:13px">'+nome+'</div>'
  + '</div></td>'
  + '<td style="font-size:12px;color:var(--muted)">'+(c.cargo||'—')+'</td>'
  + '<td style="font-size:12px;color:var(--muted)">'+empNome+'</td>'
  + '<td>'+_empFaseTag(fase)+'</td>'
  + '<td>'+telCell+'</td>'
  + '<td>'+emailCell+'</td>'
  + '<td><button class="nt-open-btn" onclick="event.stopPropagation();_spOpen(\'contatos\',this.closest(\'tr\'))" style="font-size:11px;color:var(--muted);background:rgba(0,0,0,.06);border:none;border-radius:4px;padding:3px 8px;cursor:pointer;font-weight:500;opacity:0;transition:opacity .12s">Abrir →</button></td>'
  + '</tr>';
}

// ── Load Contatos (cache global + renderiza tabela) ───────────────────────────
async function _dbLoadContatos() {
 var tbody0 = document.getElementById('ctt-tbody');
 if (tbody0) tbody0.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:32px;font-size:13px">Carregando...</td></tr>';
 var allData = []; var from = 0; var more = true;
 while (more) {
  var res = await _sb.from('contatos')
   .select('id, nome_completo, cargo, email, telefone, created_at, ultima_alteracao_por, contatos_empresas(is_primary, empresa:empresa_id(id, nome, fase_ciclo_vida, categoria, estado))')
   .order('nome_completo').range(from, from + 999);
  if (res.error || !res.data || !res.data.length) break;
  allData = allData.concat(res.data);
  more = res.data.length === 1000; from += 1000;
 }
 _contatosArr = allData;
 if (!allData.length) return;

 // Atualiza badges e stats
 var badge = document.getElementById('badge-ctt');
 if (badge) badge.textContent = allData.length;
 var stTotal = document.getElementById('ctt-stat-total');
 if (stTotal) stTotal.textContent = allData.length;
 var stTel = document.getElementById('ctt-stat-tel');
 if (stTel) stTel.textContent = allData.filter(function(c){ return !!c.telefone; }).length;
 var stEmail = document.getElementById('ctt-stat-email');
 if (stEmail) stEmail.textContent = allData.filter(function(c){ return !!c.email; }).length;

 var tbody = document.getElementById('ctt-tbody');
 if (!tbody) return;

 tbody.innerHTML = allData.map(_cttRowHTML).join('');
 // Reaplica filtro/busca/ordenação/agrupamento atuais — mesmo motivo do
 // _empApplyFilters() em _dbLoadEmpresas acima.
 if (typeof _cttApplyFilters === 'function') _cttApplyFilters();
}

// ── Salvar Empresa (painel lateral) ────────────────────────────────────────────
async function _spSaveEmpresa() {
 if (_empAutoSaveTimer) { clearTimeout(_empAutoSaveTimer); _empAutoSaveTimer = null; }
 var id = (document.getElementById('sp-emp-id') || {}).value;
 if (!_sb || !id) return;
 var cnpjEl = document.getElementById('sp-emp-cnpj');
 var cnpjDigits = ((cnpjEl || {}).value || '').replace(/\D/g, '');
 // O campo nunca fica "vazio" de verdade (o molde preenche com "_"), então
 // quem decide é a contagem de dígitos: 14 = CNPJ completo, salva mascarado
 // limpo; 0 = deixado em branco de propósito (permitido — registros antigos
 // migrados do Airtable podem não ter CNPJ, autosave não pode forçar
 // preencher isso retroativamente); 1-13 = incompleto, não salva nada até
 // completar (senão qualquer pausa no meio da digitação salvaria lixo).
 if (cnpjDigits.length > 0 && cnpjDigits.length < 14) {
  _showToast('CNPJ incompleto — informe os 14 dígitos (ou apague todos pra deixar em branco).', 'erro');
  if (cnpjEl) { cnpjEl.style.borderColor = 'var(--red)'; setTimeout(function(){ cnpjEl.style.borderColor = ''; }, 2500); }
  return;
 }
 var cnpjClean = cnpjDigits.length === 14 ? _empCnpjMaskValue(cnpjDigits) : null;
 var payload = {
  nome:            (document.getElementById('sp-emp-nome')    || {}).value.trim() || '',
  cnpj:            cnpjClean,
  url_site:        (document.getElementById('sp-emp-site')    || {}).value.trim() || null,
  estado:          ((document.getElementById('sp-emp-estado') || {}).value || '').trim().toUpperCase() || null,
  fase_ciclo_vida: ((document.getElementById('sp-emp-fase')    || {}).value || '').trim() || null,
  categoria:       (_spEmpCategoriaSel || []).slice(),
  // ultima_alteracao_por NÃO é mais setado aqui — o trigger
  // set_audit_fields() (empresas/contatos) agora é a única fonte de verdade
  // pra esse campo em todo UPDATE, então a app não precisa (e não deve)
  // mandar esse valor manualmente. ultima_modificacao continua manual —
  // é uma coluna separada, fora do escopo desta rodada (ver comentário em
  // _spEmpresas acima).
  ultima_modificacao: new Date().toISOString(),
 };
 if (!payload.nome) { _showToast('Informe a Razão Social.', 'erro'); return; }
 if (payload.cnpj && await _empCnpjJaExiste(payload.cnpj, id)) {
  _showToast('Já existe outra empresa cadastrada com este CNPJ.', 'erro');
  if (cnpjEl) { cnpjEl.style.borderColor = 'var(--red)'; setTimeout(function(){ cnpjEl.style.borderColor = ''; }, 2500); }
  return;
 }

 var { error } = await _sb.from('empresas').update(payload).eq('id', id);
 if (error) {
  _showToast('Erro ao salvar empresa: ' + _supaErrPt(error.message), 'erro');
  return;
 }
 var titleEl = document.getElementById('sp-title');
 if (titleEl) titleEl.textContent = payload.nome;
 // Atualiza o cache local em vez de recarregar as 638 empresas do banco a
 // cada autosave (a cada pausa de digitação) — só a linha/registro editado
 // muda; _dbLoadEmpresas() completo fica só pra criação/exclusão de fato.
 var idx = (_empresasArr || []).findIndex(function(e){ return String(e.id) === String(id); });
 if (idx !== -1) {
  Object.assign(_empresasArr[idx], payload);
  var tr = document.querySelector('#emp-tbody tr[data-id="'+id+'"]');
  if (tr) tr.outerHTML = _empRowHTML(_empresasArr[idx]);
  if (typeof _empApplyFilters === 'function') _empApplyFilters();
 }
}

// Mesmo padrão de confirm() nativo já usado em _taskDelete (dashboard.js) e
// excluirFornecedor — não é um modal custom, é o confirm() do navegador
// mesmo, consistente com o resto do sistema.
async function _spDeleteEmpresa(id, nome) {
 if (!id) return;
 if (!confirm('Excluir "' + (nome || 'esta empresa') + '"?\n\nOs vínculos com obras e contatos também serão removidos. Esta ação não pode ser desfeita.')) return;
 closePanel();
 _showToast('Excluindo...', 'ok');
 var res = await _sb.from('empresas').delete().eq('id', id);
 if (res.error) {
  _showToast('Erro ao excluir: ' + _supaErrPt(res.error.message), 'erro');
  return;
 }
 _showToast('Empresa excluída.', 'ok');
 _dbLoadEmpresas();
}

function switchEmpTab(tab) {
 // Fornecedores saiu daqui — é página própria agora (#page-fornecedores,
 // go('fornecedores') em app.js). Esta função só decide mais entre
 // Empresas/Contatos, as duas sub-abas que sobraram dentro de #page-empresas.
 var tabs = ['empresas', 'contatos'];
 tabs.forEach(function(t) {
  var panel = document.getElementById('tab-panel-' + t);
  if (panel) panel.style.display = (t === tab) ? 'block' : 'none';
 });

 var btns = {
  'empresas': document.getElementById('tab-emp-btn'),
  'contatos': document.getElementById('tab-ctt-btn')
 };
 Object.keys(btns).forEach(function(k) {
  var b = btns[k];
  if (!b) return;
  var active = (k === tab);
  b.style.color       = active ? 'var(--navy)' : 'var(--muted)';
  b.style.borderBottom = active ? '2px solid var(--navy)' : '2px solid transparent';
 });

 // btn-nova-empresa saiu do toolbar (ver comentário no index.html) — só
 // btn-novo-contato continua sendo alternado por aqui.
 document.getElementById('btn-novo-contato').style.display = (tab === 'contatos') ? 'inline-flex' : 'none';

 // #topbar-action-btn ("+ Nova Empresa") é setado uma única vez por ROTA em
 // go('empresas') (scripts/app.js), nunca por SUB-ABA — por isso ficava
 // visível mesmo depois de trocar pra Contatos. switchEmpTab não tinha
 // nenhuma lógica pra esconder/restaurar esse botão.
 var topBtn = document.getElementById('topbar-action-btn');
 if (topBtn) {
  if (tab === 'contatos') {
   topBtn.style.display = 'none';
  } else {
   topBtn.textContent = '+ Nova Empresa';
   topBtn.style.display = '';
   topBtn._action = 'openNovaEmpresa';
  }
 }
}

// ── Fornecedores (Supabase: fornecedores + fornecedores_produtos) ─────────────
// Cadastro completo de cotação: dados gerais, localização em cascata
// (estado → cidades multiselect via IBGE), setor/segmento como listas
// controladas (scripts/lib/fornecedor-opcoes.js) e produtos orçados com
// cálculo automático de valor total (scripts/lib/fornecedor-validacao.js).
var _fornecedoresArr = [];
var _fornBusca       = '';
var _fornProdutoCount = 0;
var _editingFornId    = null;
var _fornCidadesSel   = [];
var _fornSetoresSel   = [];
var _fornCidadesDisponiveis = []; // cidades do estado selecionado no momento
var _fornCidadeCache  = {}; // cache por UF — mesmo padrão de _cidadeCache (wizard-nova-obra.js)

async function _dbLoadFornecedores() {
 var tbody = document.getElementById('forn-tbody');
 if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--muted);font-size:13px">Carregando...</td></tr>';
 if (!_sb) return;
 var res = await _sb.from('fornecedores')
  .select('id, nome, cnpj, contato, telefone, email, endereco, estado, cidades, setores, experiencia, observacoes, fornecedores_produtos(id, nome, quantidade, unidade_medida, valor_unitario, valor_total, status_cotacao, created_at)')
  .order('nome');
 if (res.error) {
  if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--red);font-size:13px">Erro ao carregar fornecedores: ' + _supaErrPt(res.error.message) + '</td></tr>';
  return;
 }
 _fornecedoresArr = (res.data || []).map(function(f) {
  return {
   id: f.id, nome: f.nome, cnpj: f.cnpj, contato: f.contato, telefone: f.telefone, email: f.email,
   endereco: f.endereco, estado: f.estado, cidades: f.cidades || [], setores: f.setores || [],
   experiencia: f.experiencia, observacoes: f.observacoes,
   produtos: (f.fornecedores_produtos || []).map(function(p){
    return { id: p.id, nome: p.nome, quantidade: p.quantidade, unidade_medida: p.unidade_medida, valor_unitario: p.valor_unitario, valor_total: p.valor_total, status_cotacao: p.status_cotacao, created_at: p.created_at };
   }),
  };
 });
 _renderFornecedores();
}

function searchFornecedores(q) {
 _fornBusca = q;
 _renderFornecedores();
}

var _fornStatusCor = { 'Em análise': 'nt-tag-yellow', 'Aprovado': 'nt-tag-green', 'Recusado': 'nt-tag-red', 'Aguardando retorno': 'nt-tag-gray', 'Cancelado': 'nt-tag-red' };
var _fornExperienciaCor = { 'Positiva': 'nt-tag-green', 'Negativa': 'nt-tag-red' };

// ── Filtro (filtro-builder.js) — mesmo padrão do Empresas/Gestor de Tarefas
// (_fbInit + _fbEvaluate direto sobre o objeto do fornecedor, sem precisar
// de dataset/DOM intermediário porque a tabela é re-renderizada do zero a
// cada mudança, diferente de Empresas/Obras que só escondem/mostram <tr>). ──
function _fornApplyFilters() { _renderFornecedores(); }

var _fornFbFields = [
 { key: 'nome',           label: 'Nome',           type: 'text' },
 { key: 'setor',          label: 'Setor',          type: 'multitext', options: function(){ return SETORES_OPCOES; }, getValue: function(f){ return (f.setores||[]).join(', '); } },
 { key: 'cidade',         label: 'Cidade',         type: 'multitext', options: function(){ return Array.from(new Set(_fornecedoresArr.reduce(function(a,f){ return a.concat(f.cidades||[]); }, []))).sort(); }, getValue: function(f){ return (f.cidades||[]).join(', '); } },
 { key: 'estado',         label: 'Estado',         type: 'select', options: function(){ return Array.from(new Set(_fornecedoresArr.map(function(f){ return f.estado; }).filter(Boolean))).sort(); }, getValue: function(f){ return f.estado || ''; } },
 { key: 'experiencia',    label: 'Experiência',    type: 'select', options: function(){ return EXPERIENCIA_OPCOES; }, getValue: function(f){ return f.experiencia || ''; } },
 { key: 'status_cotacao', label: 'Status cotação', type: 'multitext', options: function(){ return STATUS_COTACAO_OPCOES; }, getValue: function(f){ return Array.from(new Set((f.produtos||[]).map(function(p){ return p.status_cotacao; }).filter(Boolean))).join(', '); } },
];
_fbInit('fornecedores', _fornFbFields, _fornApplyFilters);

function _renderFornecedores() {
 var tbody = document.getElementById('forn-tbody');
 var count = document.getElementById('forn-count');
 if (!tbody) return;

 var statTotal = document.getElementById('forn-stat-total');
 if (statTotal) statTotal.textContent = _fornecedoresArr.length;

 var qn = _ssNormalize(_fornBusca.trim());
 var activeConds = (_fbInstances.fornecedores ? _fbInstances.fornecedores.state.conditions.filter(_fbConditionIsUsable).length : 0);
 var lista = _fornecedoresArr.filter(function(f) {
  var ok = _fbEvaluate(f, 'fornecedores');
  if (ok && qn) {
   var haystack = _ssNormalize([f.nome, (f.setores||[]).join(' '), (f.cidades||[]).join(' ')].filter(Boolean).join(' '));
   ok = _ssMatch(haystack, qn);
  }
  return ok;
 });

 var fbBadge = document.getElementById('fb-badge-fornecedores');
 if (fbBadge) { fbBadge.textContent = activeConds; fbBadge.style.display = activeConds ? '' : 'none'; }
 var filterCountEl = document.getElementById('forn-filter-count');
 if (filterCountEl) {
  if (activeConds || qn) { filterCountEl.textContent = lista.length + (lista.length === 1 ? ' resultado' : ' resultados'); filterCountEl.style.display = 'inline'; }
  else { filterCountEl.style.display = 'none'; }
 }

 if (count) count.textContent = lista.length + ' fornecedor' + (lista.length !== 1 ? 'es' : '');

 if (lista.length === 0) {
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--muted);font-size:13px">' + (qn ? 'Nenhum fornecedor encontrado para essa busca.' : 'Nenhum fornecedor cadastrado. Use o botão acima para adicionar.') + '</td></tr>';
  return;
 }

 tbody.innerHTML = lista.map(function(f, idx) {
  var initials = f.nome.trim().split(/\s+/).slice(0,2).map(function(w){return w[0]||'';}).join('').toUpperCase();
  var bgColors = ['#6366f1','#2E5FD9','#059669','#d97706','#dc2626'];
  var bg = bgColors[idx % bgColors.length];
  var setoresF = f.setores || [];
  var cids = f.cidades || [];
  // status_cotacao agora é por produto — a coluna mostra os valores
  // distintos entre os produtos orçados desse fornecedor (ou "Múltiplos"
  // com tooltip quando há mais de um status diferente).
  var statusDistintos = Array.from(new Set((f.produtos||[]).map(function(p){ return p.status_cotacao; }).filter(Boolean)));
  var statusCell;
  if (!statusDistintos.length) {
   statusCell = '<span style="color:var(--muted);font-size:12px">—</span>';
  } else if (statusDistintos.length === 1) {
   statusCell = '<span class="nt-tag ' + (_fornStatusCor[statusDistintos[0]]||'nt-tag-gray') + '" style="font-size:11px">' + statusDistintos[0] + '</span>';
  } else {
   statusCell = '<span class="nt-tag nt-tag-gray" style="font-size:11px" title="' + statusDistintos.join(', ').replace(/"/g,'&quot;') + '">Múltiplos</span>';
  }
  return '<tr>'
   + '<td><div class="nt-avatar" style="background:' + bg + ';font-size:10px;width:26px;height:26px;border-radius:6px">' + initials + '</div></td>'
   + '<td><div style="font-weight:600;font-size:13px;color:var(--text)">' + f.nome + '</div>'
   + (f.email ? '<div style="font-size:11px;color:var(--muted)">' + f.email + '</div>' : '')
   + '</td>'
   + '<td>' + (setoresF.length
      ? setoresF.slice(0,2).map(function(s){ return '<span class="nt-tag nt-tag-blue" style="font-size:11px;margin-right:3px">'+s+'</span>'; }).join('') + (setoresF.length>2 ? '<span style="font-size:11px;color:var(--muted)">+'+(setoresF.length-2)+'</span>' : '')
      : '<span style="color:var(--muted);font-size:12px">—</span>') + '</td>'
   + '<td style="font-size:12px;color:var(--muted)">' + (cids.length ? cids.join(', ') : '—') + (f.estado ? ' · ' + f.estado : '') + '</td>'
   + '<td>' + statusCell + '</td>'
   + '<td>' + (f.experiencia ? '<span class="nt-tag ' + (_fornExperienciaCor[f.experiencia]||'nt-tag-gray') + '" style="font-size:11px">' + f.experiencia + '</span>' : '<span style="color:var(--muted);font-size:12px">—</span>') + '</td>'
   + '<td>' + _fornProdutosResumoHTML(f) + '</td>'
   + '<td style="display:flex;gap:4px">'
   + '<button class="nt-open-btn" onclick="editFornecedor(\'' + f.id + '\')" style="font-size:11px;color:var(--muted);background:rgba(0,0,0,.06);border:none;border-radius:4px;padding:3px 8px;cursor:pointer;font-weight:500">Editar</button>'
   + '<button class="nt-open-btn" onclick="excluirFornecedor(\'' + f.id + '\')" style="font-size:11px;color:var(--red);background:rgba(207,34,46,.08);border:none;border-radius:4px;padding:3px 8px;cursor:pointer;font-weight:500">Excluir</button>'
   + '</td>'
   + '</tr>';
 }).join('');
}

// Resumo agregado (não escala listar produto a produto na linha da tabela —
// um fornecedor pode ter dezenas/centenas de itens orçados). Detalhes
// completos só entram sob demanda, ver _fornVerProdutos.
function _fornProdutosResumoHTML(f) {
 var resumo = _fornecedorResumoProdutos(f.produtos);
 if (!resumo.quantidade) return '<span style="color:var(--muted);font-size:12px">Nenhum produto</span>';
 return '<button type="button" class="nt-open-btn" onclick="_fornVerProdutos(\'' + f.id + '\')" '
  + 'style="font-size:11px;color:var(--text);background:var(--surface2);border:none;border-radius:5px;padding:4px 9px;cursor:pointer;font-weight:500;text-align:left;line-height:1.5">'
  + '<div>' + resumo.quantidade + ' produto' + (resumo.quantidade !== 1 ? 's' : '') + ' orçado' + (resumo.quantidade !== 1 ? 's' : '') + '</div>'
  + '<div style="color:var(--muted);font-weight:400">' + _moedaFormatarBRL(resumo.totalGasto) + ' no total</div>'
  + '</button>';
}

// ── Modal "Ver produtos" — somente leitura, aberto sob demanda a partir do
// resumo agregado da listagem. Separado do modal de edição (que também
// mostra os produtos, mas editáveis) pra deixar claro quando a intenção é só
// consultar. Uma tabela com rolagem própria (max-height) sustenta qualquer
// quantidade de itens sem esticar o layout da página. ──
function _fornVerProdutos(id) {
 var f = _fornecedoresArr.find(function(x){ return String(x.id) === String(id); });
 if (!f) return;
 var ttl = document.getElementById('fpv-titulo');
 if (ttl) ttl.textContent = 'Produtos orçados — ' + f.nome;
 var resumo = _fornecedorResumoProdutos(f.produtos);
 var sub = document.getElementById('fpv-subtitulo');
 if (sub) sub.textContent = resumo.quantidade + ' produto' + (resumo.quantidade !== 1 ? 's' : '') + ' · ' + _moedaFormatarBRL(resumo.totalGasto) + ' no total';
 var corpo = document.getElementById('fpv-tbody');
 if (corpo) {
  corpo.innerHTML = (f.produtos || []).map(function(p) {
   var dataStr = p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '—';
   var statusTag = p.status_cotacao ? '<span class="nt-tag ' + (_fornStatusCor[p.status_cotacao]||'nt-tag-gray') + '" style="font-size:11px">' + p.status_cotacao + '</span>' : '—';
   var td = 'padding:7px 10px;border-bottom:1px solid var(--border)';
   return '<tr>'
    + '<td style="' + td + ';font-size:12px">' + (p.nome||'—') + '</td>'
    + '<td style="' + td + ';font-size:12px;text-align:right">' + (p.quantidade!=null?p.quantidade:'—') + '</td>'
    + '<td style="' + td + ';font-size:12px">' + (p.unidade_medida||'—') + '</td>'
    + '<td style="' + td + ';font-size:12px;text-align:right">' + _moedaFormatarBRL(p.valor_unitario||0) + '</td>'
    + '<td style="' + td + ';font-size:12px;text-align:right;font-weight:600">' + _moedaFormatarBRL(p.valor_total||0) + '</td>'
    + '<td style="' + td + '">' + statusTag + '</td>'
    + '<td style="' + td + ';font-size:12px;color:var(--muted)">' + dataStr + '</td>'
    + '</tr>';
  }).join('') || '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--muted);font-size:13px">Nenhum produto orçado.</td></tr>';
 }
 var bd = document.getElementById('fpv-bd');
 if (bd) bd.classList.add('open');
}

function _fornFecharProdutosView() {
 var bd = document.getElementById('fpv-bd');
 if (bd) bd.classList.remove('open');
}

// ── Selects de opções fixas (experiência — status_cotacao agora é por
// produto, ver addFornProdutoLinha) ──────────────────────────────────────────
function _fornPreencherSelectsFixos() {
 var ex = document.getElementById('fn-experiencia');
 if (ex) ex.innerHTML = '<option value="">Selecione...</option>' + EXPERIENCIA_OPCOES.map(function(o){ return '<option>'+o+'</option>'; }).join('');
}

// ── Localização em cascata (Estado → Cidades, IBGE) ──────────────────────────
// Mesma API e cache-por-UF de loadCidades (wizard-nova-obra.js), só que
// alimenta um multiselect de cidades em vez de um <select> de cidade única —
// um fornecedor pode atender várias cidades do mesmo estado. Modelagem já
// pronta pra evoluir pra múltiplos estados no futuro (ver comentário da
// coluna fornecedores.cidades na migration): bastaria trocar o <select>
// único de estado por outro multiselect e iterar um _fornCarregarCidades por
// UF selecionada.
async function _fornCarregarCidades(uf) {
 if (!uf) { _fornCidadesDisponiveis = []; return []; }
 if (_fornCidadeCache[uf]) { _fornCidadesDisponiveis = _fornCidadeCache[uf]; return _fornCidadesDisponiveis; }
 var loading = document.getElementById('fn-cidades-loading');
 if (loading) loading.style.display = 'block';
 try {
  var isLocal = location.protocol === 'http:';
  var url = isLocal
   ? '/api/ibge/v1/localidades/estados/' + uf + '/municipios?orderBy=nome'
   : 'https://servicodados.ibge.gov.br/api/v1/localidades/estados/' + uf + '/municipios?orderBy=nome';
  var res = await fetch(url);
  if (!res.ok) throw new Error('Falha na API IBGE');
  var json = await res.json();
  var nomes = json.map(function(c){ return c.nome; });
  _fornCidadeCache[uf] = nomes;
  _fornCidadesDisponiveis = nomes;
  return nomes;
 } catch (err) {
  console.warn('IBGE API:', err.message, '— Use o servidor.py para habilitar a API do IBGE');
  _fornCidadesDisponiveis = [];
  return [];
 } finally {
  if (loading) loading.style.display = 'none';
 }
}

async function _fornEstadoChange(uf, manterSelecao) {
 if (!manterSelecao) _fornCidadesSel = [];
 var wrap = document.getElementById('fn-cidades-dropdown');
 if (wrap) wrap.innerHTML = uf
  ? '<div style="font-size:12px;color:var(--muted)">Carregando...</div>'
  : '<div style="font-size:12px;color:var(--muted)">Selecione primeiro o estado</div>';
 await _fornCarregarCidades(uf);
 // Descarta da seleção qualquer cidade que não pertença mais ao estado atual
 // (troca de UF depois de já ter marcado cidades de outro estado).
 _fornCidadesSel = _fornCidadesSel.filter(function(c){ return _fornCidadesDisponiveis.indexOf(c) !== -1; });
 _fornRenderCidadesDropdown();
}

function _fornRenderCidadesDropdown() {
 var wrap = document.getElementById('fn-cidades-dropdown');
 if (!wrap) return;
 if (!_fornCidadesDisponiveis.length) {
  wrap.innerHTML = '<div style="font-size:12px;color:var(--muted)">Selecione primeiro o estado</div>';
  return;
 }
 wrap.innerHTML = _msRenderDropdown('cidades', _fornCidadesDisponiveis, _fornCidadesSel, '_fornMultiToggle', 'Selecione a(s) cidade(s)');
}

function _fornRenderSetoresDropdown() {
 var wrap = document.getElementById('fn-setores-dropdown');
 if (wrap) wrap.innerHTML = _msRenderDropdown('setores', SETORES_OPCOES, _fornSetoresSel, '_fornMultiToggle', 'Selecione o(s) setor(es)');
}

// Handler único chamado pelos 2 multiselects (cidades/setores) — atualiza o
// estado e só o rótulo do botão, sem re-renderizar o painel inteiro (senão o
// dropdown fecharia a cada clique numa opção). Em modo edição, também
// dispara o autosave do campo correspondente.
var _FORN_MULTI_CAMPOS = {
 cidades: { get: function(){ return _fornCidadesSel; }, set: function(v){ _fornCidadesSel = v; }, placeholder: 'Selecione a(s) cidade(s)' },
 setores: { get: function(){ return _fornSetoresSel; }, set: function(v){ _fornSetoresSel = v; }, placeholder: 'Selecione o(s) setor(es)' },
};
function _fornMultiToggle(campo, valor, checked) {
 var cfg = _FORN_MULTI_CAMPOS[campo];
 if (!cfg) return;
 cfg.set(_msToggle(cfg.get(), valor, checked));
 var btn = document.querySelector('#fn-' + campo + '-dropdown .fb-msel-btn');
 var atual = cfg.get();
 if (btn) btn.textContent = atual.length ? atual.length + ' selecionado(s)' : cfg.placeholder;
 _fornAutoSaveQueue(_fornAutoSaveObjFor(campo, atual), true);
}

// ── Produtos orçados (Produto/Serviço, Quantidade, Unidade, Valor unitário,
// Valor total calculado automaticamente, Status da cotação POR PRODUTO) ──────
function _fornProdutoRecalcular(lid) {
 var qtdEl = document.getElementById('fn-prod-qtd-' + lid);
 var valEl = document.getElementById('fn-prod-valor-' + lid);
 var totEl = document.getElementById('fn-prod-total-' + lid);
 if (!qtdEl || !valEl || !totEl) return;
 var qtd = Number(qtdEl.value) || 0;
 var val = _moedaParaNumero(valEl.value);
 totEl.textContent = _moedaFormatarBRL(_fornecedorCalcularValorTotal(qtd, val));
}

function _fornProdutoValorInput(lid, inputEl) {
 inputEl.value = _moedaMascarar(inputEl.value);
 _fornProdutoRecalcular(lid);
 _fornAutoSaveProdutosQueue();
}

function addFornProdutoLinha(produto) {
 produto = produto || {};
 _fornProdutoCount++;
 var id = _fornProdutoCount;
 var line = document.createElement('div');
 line.id = 'fn-prod-' + id;
 line.dataset.dbId = produto.id || '';
 line.dataset.createdAt = produto.created_at || '';
 line.style.cssText = 'display:grid;grid-template-columns:minmax(150px,1fr) 70px 100px 100px 100px 130px 90px 30px;gap:8px;align-items:center;min-width:800px';
 var inputStyle = 'border:1px solid var(--border);border-radius:6px;padding:7px 9px;background:var(--surface);color:var(--text);font-size:13px;outline:none;font-family:inherit;width:100%;box-sizing:border-box';
 var unidadeOpts = UNIDADES_OPCOES.map(function(u){ return '<option' + (produto.unidade_medida===u?' selected':'') + '>'+u+'</option>'; }).join('');
 var statusOpts = STATUS_COTACAO_OPCOES.map(function(s){ return '<option' + (produto.status_cotacao===s?' selected':'') + '>'+s+'</option>'; }).join('');
 var dataCadastro = produto.created_at ? new Date(produto.created_at).toLocaleDateString('pt-BR') : '—';
 line.innerHTML =
  '<input type="text" id="fn-prod-nome-' + id + '" placeholder="Ex: Chapa de aço 2mm" value="' + (produto.nome||'').replace(/"/g,'&quot;') + '" oninput="_fornAutoSaveProdutosQueue()" style="' + inputStyle + '">'
  + '<input type="number" id="fn-prod-qtd-' + id + '" placeholder="0" min="0" step="any" value="' + (produto.quantidade!=null?produto.quantidade:'') + '" oninput="_fornProdutoRecalcular(' + id + ');_fornAutoSaveProdutosQueue()" style="' + inputStyle + ';text-align:right">'
  + '<select id="fn-prod-unidade-' + id + '" onchange="_fornAutoSaveProdutosQueue()" style="' + inputStyle + '"><option value="">Selecione...</option>' + unidadeOpts + '</select>'
  + '<input type="text" id="fn-prod-valor-' + id + '" placeholder="0,00" inputmode="numeric" value="' + (produto.valor_unitario!=null ? _moedaFormatar(produto.valor_unitario) : '') + '" oninput="_fornProdutoValorInput(' + id + ',this)" style="' + inputStyle + ';text-align:right">'
  + '<div id="fn-prod-total-' + id + '" style="font-size:13px;color:var(--text);font-weight:600;text-align:right;padding:7px 4px">' + _moedaFormatarBRL(_fornecedorCalcularValorTotal(produto.quantidade||0, produto.valor_unitario||0)) + '</div>'
  + '<select id="fn-prod-status-' + id + '" onchange="_fornAutoSaveProdutosQueue()" style="' + inputStyle + '"><option value="">Selecione...</option>' + statusOpts + '</select>'
  + '<div id="fn-prod-data-' + id + '" style="font-size:12px;color:var(--muted);text-align:center;padding:7px 4px" title="Data de cadastro do orçamento">' + dataCadastro + '</div>'
  + '<button type="button" onclick="document.getElementById(\'fn-prod-' + id + '\').remove();_fornAutoSaveProdutosQueue()" style="border:none;background:none;cursor:pointer;color:var(--muted);font-size:18px;line-height:1;padding:0;width:26px;height:26px;display:flex;align-items:center;justify-content:center;border-radius:5px" title="Remover">&times;</button>';
 document.getElementById('fn-produtos-list').appendChild(line);
 var cabecalho = document.getElementById('fn-produtos-cabecalho');
 if (cabecalho) cabecalho.style.display = 'grid';
 line.querySelector('input[type="text"]').focus();
}

function _fornLimparErros() {
 document.querySelectorAll('#forn-drw .fn-erro-msg').forEach(function(el){ el.textContent = ''; });
}

/* ── DRAWER NOVO/EDITAR FORNECEDOR — mesmo padrão visual/interativo do
   drawer de Atividades (dashboard.js: _taskDrawerOpen/_taskAutoSaveQueue):
   criação usa botão explícito ("Salvar fornecedor"); edição salva sozinha
   (autosave debounced), sem botão de submit. ── */
function _fornDrawerOpenShell(editando) {
 var ttlEl = document.getElementById('fn-drw-ttl');
 var submitBtn = document.getElementById('fn-drw-submit-btn');
 var cancelBtn = document.getElementById('fn-drw-cancel-btn');
 if (ttlEl) ttlEl.textContent = editando ? 'Editar Fornecedor' : 'Novo Fornecedor';
 if (submitBtn) submitBtn.style.display = editando ? 'none' : '';
 if (cancelBtn) cancelBtn.textContent = editando ? 'Fechar' : 'Cancelar';
 _fornAutoSaveStatus();
 var drw = document.getElementById('forn-drw');
 var bd  = document.getElementById('forn-drw-bd');
 if (drw) drw.classList.add('open');
 if (bd)  bd.classList.add('open');
}

function openNovoFornecedor() {
 _editingFornId = null;
 _fornProdutoCount = 0;
 _fornCidadesSel = []; _fornSetoresSel = []; _fornCidadesDisponiveis = [];
 ['fn-nome','fn-cnpj','fn-contato','fn-tel','fn-email','fn-observacoes'].forEach(function(id){
  var el = document.getElementById(id); if (el) el.value = '';
 });
 document.getElementById('fn-estado').value = '';
 _fornPreencherSelectsFixos();
 document.getElementById('fn-experiencia').value = '';
 _fornRenderCidadesDropdown();
 _fornRenderSetoresDropdown();
 _fornLimparErros();
 document.getElementById('fn-produtos-list').innerHTML = '';
 var cabecalho = document.getElementById('fn-produtos-cabecalho');
 if (cabecalho) cabecalho.style.display = 'none';
 addFornProdutoLinha(); // começa com uma linha vazia
 _fornDrawerOpenShell(false);
}

async function editFornecedor(id) {
 var f = _fornecedoresArr.find(function(x){return x.id === id;});
 if (!f) return;
 _editingFornId = id;
 _fornProdutoCount = 0;
 _fornCidadesSel = (f.cidades || []).slice();
 _fornSetoresSel = (f.setores || []).slice();
 document.getElementById('fn-nome').value       = f.nome || '';
 document.getElementById('fn-cnpj').value       = f.cnpj || '';
 document.getElementById('fn-contato').value    = f.contato || '';
 document.getElementById('fn-tel').value        = f.telefone || '';
 document.getElementById('fn-email').value      = f.email || '';
 document.getElementById('fn-observacoes').value = f.observacoes || '';
 document.getElementById('fn-estado').value     = f.estado || '';
 _fornPreencherSelectsFixos();
 document.getElementById('fn-experiencia').value = f.experiencia || '';
 _fornRenderSetoresDropdown();
 _fornLimparErros();
 document.getElementById('fn-produtos-list').innerHTML = '';
 var cabecalho = document.getElementById('fn-produtos-cabecalho');
 if (cabecalho) cabecalho.style.display = (f.produtos && f.produtos.length) ? 'grid' : 'none';
 (f.produtos || []).forEach(function(p){ addFornProdutoLinha(p); });
 if (!f.produtos || !f.produtos.length) addFornProdutoLinha();
 _fornDrawerOpenShell(true);
 await _fornEstadoChange(f.estado, true); // mantém as cidades já cadastradas ao recarregar a lista do IBGE
}

function closeNovoFornecedor() {
 // Se houver autosave pendente (debounce ainda não disparou), salva na hora
 // em vez de descartar a alteração — mesmo padrão de _taskAutoSaveFlushNow.
 _fornAutoSaveFlushNow();
 _fornAutoSaveProdutosFlushNow();
 document.getElementById('forn-drw').classList.remove('open');
 document.getElementById('forn-drw-bd').classList.remove('open');
 _editingFornId = null;
}

/* ── AUTO-SAVE (só em modo edição — criação usa o botão "Salvar fornecedor"
   normal, já que ainda não existe linha no banco pra salvar em cima). Mesmo
   padrão de _taskAutoSaveQueue/_taskAutoSaveFlush (dashboard.js). ── */
var _fornAutoSavePending = null;
var _fornAutoSaveTimer = null;
var _fornAutoSaveFadeTimer = null;

function _fornAutoSaveStatus(state, msg) {
 var el = document.getElementById('forn-drw-savestatus');
 if (!el) return;
 el.className = 'task-drw-savestatus' + (state ? ' ' + state : '');
 el.textContent = msg || '';
 clearTimeout(_fornAutoSaveFadeTimer);
 if (state === 'saved') {
  _fornAutoSaveFadeTimer = setTimeout(function() {
   if (el.classList.contains('saved')) { el.className = 'task-drw-savestatus'; el.textContent = ''; }
  }, 2500);
 }
}

function _fornAutoSaveObjFor(campo, valor) {
 var patch = {};
 patch[campo] = valor;
 return patch;
}

// Chamado pelo onblur/onchange dos campos simples do formulário.
function _fornCampoAutoSave(campo, valor) {
 if (typeof valor === 'string') valor = valor.trim() || null;
 _fornAutoSaveQueue(_fornAutoSaveObjFor(campo, valor));
}

function _fornAutoSaveQueue(patch, immediate) {
 if (!_editingFornId) return; // criação: sem linha no banco ainda, nada a auto-salvar
 _fornAutoSavePending = Object.assign(_fornAutoSavePending || {}, patch);
 clearTimeout(_fornAutoSaveTimer);
 _fornAutoSaveStatus('saving', 'Salvando…');
 _fornAutoSaveTimer = setTimeout(_fornAutoSaveFlush, immediate ? 120 : 700);
}

function _fornAutoSaveFlush() {
 if (!_editingFornId || !_fornAutoSavePending) return;
 var id = _editingFornId, patch = _fornAutoSavePending;
 _fornAutoSavePending = null;
 patch.updated_at = new Date().toISOString();
 _sb.from('fornecedores').update(patch).eq('id', id).then(function(res) {
  if (String(_editingFornId) !== String(id)) return;
  if (res.error) {
   _fornAutoSaveStatus('error', 'Erro ao salvar: ' + _supaErrPt(res.error.message));
   console.error('[auto-save fornecedor]', res.error);
   return;
  }
  _fornAutoSaveStatus('saved', 'Alterações salvas');
  var idx = _fornecedoresArr.findIndex(function(x){ return String(x.id) === String(id); });
  if (idx !== -1) Object.assign(_fornecedoresArr[idx], patch);
  _renderFornecedores();
 }).catch(function(e) {
  if (String(_editingFornId) !== String(id)) return;
  _fornAutoSaveStatus('error', 'Erro: ' + e.message);
  console.error('[auto-save fornecedor]', e);
 });
}

function _fornAutoSaveFlushNow() {
 if (_fornAutoSavePending) { clearTimeout(_fornAutoSaveTimer); _fornAutoSaveFlush(); }
}

// Produtos vivem numa tabela à parte (fornecedores_produtos) — o autosave
// deles roda separado do autosave dos campos do fornecedor, mas com a mesma
// UX de debounce + indicador "Salvando…"/"Alterações salvas". Usa o mesmo
// padrão delete-then-insert do submit manual (produtos não têm PATCH
// incremental na UI — a lista inteira é substituída a cada alteração).
var _fornAutoSaveProdutosTimer = null;
var _fornAutoSaveProdutosPending = false;

function _fornAutoSaveProdutosQueue() {
 if (!_editingFornId) return; // criação: produtos só entram no banco no submit
 _fornAutoSaveProdutosPending = true;
 clearTimeout(_fornAutoSaveProdutosTimer);
 _fornAutoSaveStatus('saving', 'Salvando…');
 _fornAutoSaveProdutosTimer = setTimeout(_fornAutoSaveProdutosFlush, 700);
}

async function _fornAutoSaveProdutosFlush() {
 if (!_editingFornId || !_fornAutoSaveProdutosPending) return;
 var id = _editingFornId;
 _fornAutoSaveProdutosPending = false;
 var produtos = _fornColetarProdutos();
 var salvarRes = await _fornSalvarProdutos(id, produtos);
 if (salvarRes.error) {
  if (String(_editingFornId) === String(id)) _fornAutoSaveStatus('error', 'Erro ao salvar produtos: ' + _supaErrPt(salvarRes.error.message));
  return;
 }
 if (String(_editingFornId) !== String(id)) return;
 _fornAutoSaveStatus('saved', 'Alterações salvas');
 var idx = _fornecedoresArr.findIndex(function(x){ return String(x.id) === String(id); });
 if (idx !== -1) {
  // valor_total é coluna gerada no banco — recalcula aqui só pra refletir
  // na tabela instantaneamente, sem precisar de um refetch completo.
  _fornecedoresArr[idx].produtos = produtos.map(function(p){
   return Object.assign({}, p, { valor_total: _fornecedorCalcularValorTotal(p.quantidade, p.valor_unitario) });
  });
 }
 _renderFornecedores();
}

function _fornAutoSaveProdutosFlushNow() {
 if (_fornAutoSaveProdutosPending) { clearTimeout(_fornAutoSaveProdutosTimer); _fornAutoSaveProdutosFlush(); }
}

async function excluirFornecedor(id) {
 if (!confirm('Excluir este fornecedor e todos os produtos vinculados a ele?')) return;
 if (!_sb) return;
 var res = await _sb.from('fornecedores').delete().eq('id', id);
 if (res.error) { _showToast('Erro ao excluir fornecedor: ' + _supaErrPt(res.error.message), 'erro'); return; }
 // Se o fornecedor excluído era o que estava aberto no drawer, fecha (sem
 // tentar dar flush de autosave numa linha que não existe mais).
 if (String(_editingFornId) === String(id)) {
  _fornAutoSavePending = null; _fornAutoSaveProdutosPending = false;
  document.getElementById('forn-drw').classList.remove('open');
  document.getElementById('forn-drw-bd').classList.remove('open');
  _editingFornId = null;
 }
 _showToast('Fornecedor excluído.', 'ok');
 _dbLoadFornecedores();
}

// Grava produtos por diff (update por id existente / insert pro que é novo /
// delete pro que sumiu da lista) em vez de delete-then-insert — preserva o
// created_at original de cada produto (pedido: "data de cadastro de cada
// orçamento"), que um delete+insert resetaria a cada autosave.
async function _fornSalvarProdutos(fornecedorId, produtos) {
 var existentes = await _sb.from('fornecedores_produtos').select('id').eq('fornecedor_id', fornecedorId);
 if (existentes.error) return existentes;
 var idsAtuais = produtos.filter(function(p){ return p.id; }).map(function(p){ return p.id; });
 var idsRemover = (existentes.data || []).map(function(r){ return r.id; }).filter(function(rid){ return idsAtuais.indexOf(rid) === -1; });
 if (idsRemover.length) {
  var delRes = await _sb.from('fornecedores_produtos').delete().in('id', idsRemover);
  if (delRes.error) return delRes;
 }
 for (var i = 0; i < produtos.length; i++) {
  var p = produtos[i];
  var campos = { fornecedor_id: fornecedorId, nome: p.nome, quantidade: p.quantidade, unidade_medida: p.unidade_medida, valor_unitario: p.valor_unitario, status_cotacao: p.status_cotacao || null };
  var res = p.id
   ? await _sb.from('fornecedores_produtos').update(campos).eq('id', p.id)
   : await _sb.from('fornecedores_produtos').insert(campos);
  if (res.error) return res;
 }
 return { error: null };
}

function _fornColetarProdutos() {
 var produtos = [];
 document.querySelectorAll('#fn-produtos-list > [id^="fn-prod-"]').forEach(function(line) {
  var lid = line.id.replace('fn-prod-', '');
  var nomeEl = document.getElementById('fn-prod-nome-' + lid);
  var qtdEl = document.getElementById('fn-prod-qtd-' + lid);
  var unidEl = document.getElementById('fn-prod-unidade-' + lid);
  var valEl = document.getElementById('fn-prod-valor-' + lid);
  var statusEl = document.getElementById('fn-prod-status-' + lid);
  var nome = nomeEl ? nomeEl.value.trim() : '';
  var quantidade = qtdEl ? qtdEl.value : '';
  var unidade_medida = unidEl ? unidEl.value : '';
  var valor_unitario = valEl ? _moedaParaNumero(valEl.value) : 0;
  var status_cotacao = statusEl ? statusEl.value : '';
  // Linha totalmente vazia (usuário adicionou e não preencheu) não entra na
  // validação nem no payload — só conta linha que o usuário começou a usar.
  if (!nome && !quantidade && !unidade_medida && !valEl.value && !status_cotacao) return;
  produtos.push({ id: line.dataset.dbId || null, nome: nome, quantidade: quantidade === '' ? null : Number(quantidade), unidade_medida: unidade_medida, valor_unitario: valor_unitario, status_cotacao: status_cotacao, created_at: line.dataset.createdAt || null });
 });
 return produtos;
}

function _fornMostrarErros(erros) {
 _fornLimparErros();
 Object.keys(erros).forEach(function(campo) {
  var el = document.getElementById('fn-erro-' + campo);
  if (el) { el.textContent = erros[campo]; return; }
  // Erros de linha de produto (produtos.N.campo) — mostra no bloco geral de produtos.
  if (campo.indexOf('produtos.') === 0) {
   var geral = document.getElementById('fn-erro-produtos');
   if (geral) geral.textContent = geral.textContent ? geral.textContent : erros[campo];
  }
 });
}

async function submitNovoFornecedor() {
 if (!_sb) { _showToast('Sem conexão com o banco.', 'erro'); return; }

 var dados = {
  nome: (document.getElementById('fn-nome').value || '').trim(),
  estado: document.getElementById('fn-estado').value || '',
  cidades: _fornCidadesSel,
  setores: _fornSetoresSel,
  experiencia: document.getElementById('fn-experiencia').value || '',
  produtos: _fornColetarProdutos(),
 };

 var validacao = _fornecedorValidar(dados);
 if (!validacao.valido) {
  _fornMostrarErros(validacao.erros);
  _showToast('Preencha os campos obrigatórios destacados antes de salvar.', 'erro');
  return;
 }
 _fornLimparErros();

 var payload = {
  nome: dados.nome,
  cnpj: (document.getElementById('fn-cnpj').value || '').trim() || null,
  contato: (document.getElementById('fn-contato').value || '').trim() || null,
  telefone: (document.getElementById('fn-tel').value || '').trim() || null,
  email: (document.getElementById('fn-email').value || '').trim() || null,
  observacoes: (document.getElementById('fn-observacoes').value || '').trim() || null,
  estado: dados.estado,
  cidades: dados.cidades,
  setores: dados.setores,
  experiencia: dados.experiencia,
  criado_por: (_currentUser && _currentUser.email) || null,
 };

 var fornecedorId = _editingFornId;
 if (fornecedorId) {
  var upd = await _sb.from('fornecedores').update(payload).eq('id', fornecedorId);
  if (upd.error) { _showToast('Erro ao salvar fornecedor: ' + _supaErrPt(upd.error.message), 'erro'); return; }
 } else {
  var ins = await _sb.from('fornecedores').insert(payload).select('id').single();
  if (ins.error) { _showToast('Erro ao criar fornecedor: ' + _supaErrPt(ins.error.message), 'erro'); return; }
  fornecedorId = ins.data.id;
 }

 // Grava produtos por diff (update/insert/delete) em vez de substituir tudo —
 // preserva o created_at original de cada produto já existente. valor_total
 // NUNCA é enviado — é coluna gerada pelo próprio Postgres (quantidade *
 // valor_unitario), garantindo que nunca fica inconsistente.
 var salvarProdRes = await _fornSalvarProdutos(fornecedorId, dados.produtos);
 if (salvarProdRes.error) { _showToast('Fornecedor salvo, mas houve erro ao gravar produtos: ' + _supaErrPt(salvarProdRes.error.message), 'erro'); closeNovoFornecedor(); _dbLoadFornecedores(); return; }

 _showToast('Fornecedor salvo com sucesso!', 'ok');
 closeNovoFornecedor();
 _dbLoadFornecedores();
}

// ── Agrupamento (Agrupar — group-builder.js/group-tree.js) ──────────────────
// Empresas/Contatos filtram ESCONDENDO/MOSTRANDO <tr> já renderizados no DOM
// (_empApplyFilters normal, abaixo) — diferente do Gestor de Tarefas, que
// re-renderiza a tbody do zero a partir de um array a cada mudança. Esse
// esquema de esconder/mostrar não dá pra representar agrupamento (não tem
// como inserir cabeçalhos de grupo nem reordenar itens só com display:none).
// Por isso, quando HÁ campo de agrupamento ativo (_gbPrimaryField), a rota é
// outra: _empRenderGrouped relê _empresasArr (fonte completa, já em cache),
// filtra/ordena com os MESMOS _fbEvaluate/_sbCompare de sempre (só que sobre
// um pseudo-dataset — ver _empPseudoDataset — em vez de tr.dataset, porque
// ainda não existe <tr> nenhum nesse momento) e gera a tbody inteira já com
// cabeçalhos de grupo + contagem, replicando _gestorRenderGroupNode do Gestor
// de Tarefas. Sem grupo ativo, cai no comportamento de sempre (sem nenhuma
// mudança), garantindo zero regressão no caso não-agrupado.
var _empGroupCollapsed = {};
// categoria é multipleSelects (uma empresa pode ter várias) — pra não
// fragmentar em grupos combinatórios (uma "categoria" por combinação
// distinta), colapsa qualquer empresa com 2+ categorias num único bucket
// "Múltiplas categorias", mesmo espírito de _gestorGroupKeyFor colapsando
// responsável multi-valorado em "Tarefas Coletivas".
function _empGroupKeyFor(e, field) {
 // "Nome" agrupa por letra inicial (A, B, C...) — estilo índice alfabético
 // (Notion/Airtable) — agrupar pelo nome completo criaria um grupo por
 // empresa, o que não serve pra nada como agrupamento.
 if (field === 'nome') {
  var n = (e.nome || '').trim();
  return { key: n ? n.charAt(0).toUpperCase() : '— Sem nome', sortKey: null };
 }
 if (field === 'fase') return { key: e.fase_ciclo_vida || '— Sem fase', sortKey: null };
 if (field === 'estado') return { key: (e.estado || '— Sem estado').toUpperCase(), sortKey: null };
 if (field === 'categoria') {
  var cats = e.categoria || [];
  if (!cats.length) return { key: '— Sem categoria', sortKey: null };
  if (cats.length === 1) return { key: cats[0], sortKey: null };
  return { key: 'Múltiplas categorias', sortKey: null };
 }
 return { key: '— Sem grupo', sortKey: null };
}
// Pseudo-dataset: mesmos campos/mesma normalização (lowercase) que o <tr>
// real carregaria em data-* — assim _fbEvaluate/_sbCompare (que leem
// item[key] por padrão) funcionam idêntico com ou sem DOM.
function _empPseudoDataset(e) {
 var nCtt = (e.contatos_empresas||[]).length;
 var obraNomes = (e.empresas_obras||[]).map(function(l){ return l.obra && l.obra.nome; }).filter(Boolean);
 return {
  nome: (e.nome || '').toLowerCase(),
  fase: (e.fase_ciclo_vida || '').toLowerCase(),
  estado: (e.estado || '').toLowerCase(),
  categoria: (e.categoria || []).join(',').toLowerCase(),
  cnpj: (e.cnpj || '').toLowerCase(),
  site: (e.url_site || '').toLowerCase(),
  ultalt: (e.ultima_alteracao_por || '').toLowerCase(),
  obra: obraNomes.join(',').toLowerCase(),
  ctt: nCtt > 0 ? 'com contato' : 'sem contato',
 };
}
function _empToggleGroup(key) {
 _empGroupCollapsed[key] = !_empGroupCollapsed[key];
 _empApplyFilters();
}
function _empRenderGroupNode(node, path, rowsArr) {
 if (node.leaf) {
  node.items.forEach(function(e) { rowsArr.push(_empRowHTML(e)); });
  return;
 }
 node.order.forEach(function(k) {
  var child = node.children[k];
  var nodePath = 'empresas::' + path.concat(k).join(' :: ');
  var isCollapsed = !!_empGroupCollapsed[nodePath];
  var total = _gtTreeCount(child);
  rowsArr.push(
   '<tr class="gestor-group-hd" onclick="_empToggleGroup(\'' + nodePath.replace(/'/g, "\\'") + '\')">'
   + '<td colspan="6" style="padding-left:12px">'
   + '<span style="margin-right:4px">' + (isCollapsed ? '▶' : '▼') + '</span>'
   + '<strong>' + k + '</strong>'
   + '<span style="color:var(--muted);font-size:9px;margin-left:6px">' + total + ' empresa' + (total !== 1 ? 's' : '') + '</span>'
   + '</td></tr>'
  );
  if (!isCollapsed) _empRenderGroupNode(child, path.concat(k), rowsArr);
 });
}
function _empRenderGrouped(groupField) {
 var tbody = document.getElementById('emp-tbody');
 if (!tbody) return;
 var buscaNorm = _ssNormalize(((document.getElementById('emp-search') || {}).value || '').trim());
 var activeConds = _fbInstances.empresas.state.conditions.filter(_fbConditionIsUsable).length;

 var filtered = (_empresasArr || []).filter(function(e) {
  var ok = _fbEvaluate(_empPseudoDataset(e), 'empresas');
  if (ok && buscaNorm) {
   var haystack = _ssNormalize([e.nome, e.cnpj, (e.categoria||[]).join(' '), e.estado, e.fase_ciclo_vida].filter(Boolean).join(' '));
   ok = _ssMatch(haystack, buscaNorm);
  }
  return ok;
 });
 filtered.sort(function(a, b) { return _sbCompare(_empPseudoDataset(a), _empPseudoDataset(b), 'empresas'); });

 var tree = _gtBuildTree(filtered, [{ field: groupField, dir: _gbPrimaryDir('empresas') }], _empGroupKeyFor, null, 0);
 var rowsArr = [];
 _empRenderGroupNode(tree, [], rowsArr);
 tbody.innerHTML = rowsArr.length ? rowsArr.join('') : '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:32px;font-size:13px">Nenhuma empresa encontrada.</td></tr>';

 var fbBadge = document.getElementById('fb-badge-empresas');
 if (fbBadge) { fbBadge.textContent = activeConds; fbBadge.style.display = activeConds ? '' : 'none'; }
 var countEl = document.getElementById('emp-filter-count');
 if (countEl) {
  if (activeConds || buscaNorm) { countEl.textContent = filtered.length + (filtered.length === 1 ? ' resultado' : ' resultados'); countEl.style.display = 'inline'; }
  else { countEl.style.display = 'none'; }
 }
}

function _empApplyFilters() {
 var groupField = _gbPrimaryField('empresas');
 if (groupField) { _empRenderGrouped(groupField); return; }

 // Saindo do modo agrupado: a tbody ainda tem as <tr class="gestor-group-hd">
 // inseridas por _empRenderGrouped (o caminho flat abaixo só ESCONDE/MOSTRA/
 // REORDENA <tr> já existentes, nunca as remove) — sem isso, os cabeçalhos de
 // grupo ficariam pra sempre na tabela depois de limpar o agrupamento.
 var tbody0 = document.getElementById('emp-tbody');
 if (tbody0 && tbody0.querySelector('tr.gestor-group-hd')) {
  tbody0.innerHTML = (_empresasArr || []).map(_empRowHTML).join('');
 }

 var buscaNorm = _ssNormalize(((document.getElementById('emp-search') || {}).value || '').trim());
 var activeConds = _fbInstances.empresas.state.conditions.filter(_fbConditionIsUsable).length;
 var rows = Array.prototype.slice.call(document.querySelectorAll('#emp-tbody tr'));
 var visivel = 0;
 rows.forEach(function(tr) {
  var ok = _fbEvaluate(tr.dataset, 'empresas');
  if (ok && buscaNorm) ok = _ssMatch(_ssNormalize(tr.textContent), buscaNorm);
  tr.style.display = ok ? '' : 'none';
  if (ok) visivel++;
 });
 if (rows.length) {
  rows.sort(function(a, b) { return _sbCompare(a.dataset, b.dataset, 'empresas'); });
  var tbody = rows[0].parentElement;
  rows.forEach(function(tr) { tbody.appendChild(tr); });
 }
 var fbBadge = document.getElementById('fb-badge-empresas');
 if (fbBadge) { fbBadge.textContent = activeConds; fbBadge.style.display = activeConds ? '' : 'none'; }
 var countEl = document.getElementById('emp-filter-count');
 if (countEl) {
  if (activeConds || buscaNorm) { countEl.textContent = visivel + (visivel === 1 ? ' resultado' : ' resultados'); countEl.style.display = 'inline'; }
  else { countEl.style.display = 'none'; }
 }
}

/* --- CONTATOS FILTER --- */
// Migrado pros componentes reutilizáveis (filtro-builder/sort-builder/
// smart-search), mesmo padrão de _empApplyFilters acima — substitui o
// condition-builder bespoke que esta função tinha (toggleCttFilterPanel/
// addCttCondition/_condCttChange/_condCttRemove/_renderCttConditions/
// filterContatos/limparCttFiltros), cujos botões "Ordenar"/"Ocultar campos"
// na toolbar nem tinham onclick — não funcionavam. _cttCampos (mais abaixo)
// já tinha o formato certo (label+type+opts), só precisou virar array pro
// _fbInit, igual _empFbFields.
// ── Agrupamento de Contatos — mesmo esquema/motivo de _empRenderGrouped
// acima (ver comentário lá): esconder/mostrar <tr> não representa grupo, então
// com campo ativo a tbody é reconstruída do zero a partir de _contatosArr.
var _cttGroupCollapsed = {};
function _cttGroupKeyFor(c, field) {
 if (field === 'cargo') return { key: c.cargo || '— Sem cargo', sortKey: null };
 if (field === 'empresa') return { key: _cttEmpresaPrimaria(c) || '— Sem empresa', sortKey: null };
 // Mesmo esquema de _empGroupKeyFor(field==='nome') pra Empresas — agrupa
 // pela letra inicial (A-Z), não pelo nome completo.
 if (field === 'nome') {
  var n = (c.nome_completo || '').trim();
  return { key: n ? n.charAt(0).toUpperCase() : '— Sem nome', sortKey: null };
 }
 return { key: '— Sem grupo', sortKey: null };
}
function _cttPseudoDataset(c) {
 return {
  nome: (c.nome_completo || '').toLowerCase(),
  cargo: (c.cargo || '').toLowerCase(),
  empresa: (_cttEmpresaPrimaria(c) || '').toLowerCase(),
  fase: _cttFasePrimaria(c).toLowerCase(),
  categoria: _cttCategoriaPrimaria(c).toLowerCase(),
  estado: _cttEstadoPrimario(c).toLowerCase(),
  telefone: (c.telefone || '').toLowerCase(),
  email: (c.email || '').toLowerCase(),
  created_at: (c.created_at || '').slice(0,10),
  ultima_alteracao_por: (c.ultima_alteracao_por || '').toLowerCase(),
 };
}
function _cttToggleGroup(key) {
 _cttGroupCollapsed[key] = !_cttGroupCollapsed[key];
 _cttApplyFilters();
}
function _cttRenderGroupNode(node, path, rowsArr) {
 if (node.leaf) {
  node.items.forEach(function(c) { rowsArr.push(_cttRowHTML(c)); });
  return;
 }
 node.order.forEach(function(k) {
  var child = node.children[k];
  var nodePath = 'contatos::' + path.concat(k).join(' :: ');
  var isCollapsed = !!_cttGroupCollapsed[nodePath];
  var total = _gtTreeCount(child);
  rowsArr.push(
   '<tr class="gestor-group-hd" onclick="_cttToggleGroup(\'' + nodePath.replace(/'/g, "\\'") + '\')">'
   + '<td colspan="7" style="padding-left:12px">'
   + '<span style="margin-right:4px">' + (isCollapsed ? '▶' : '▼') + '</span>'
   + '<strong>' + k + '</strong>'
   + '<span style="color:var(--muted);font-size:9px;margin-left:6px">' + total + ' contato' + (total !== 1 ? 's' : '') + '</span>'
   + '</td></tr>'
  );
  if (!isCollapsed) _cttRenderGroupNode(child, path.concat(k), rowsArr);
 });
}
function _cttRenderGrouped(groupField) {
 var tbody = document.getElementById('ctt-tbody');
 if (!tbody) return;
 var buscaNorm = _ssNormalize(((document.getElementById('ctt-search') || {}).value || '').trim());
 var activeConds = _fbInstances.contatos.state.conditions.filter(_fbConditionIsUsable).length;

 var filtered = (_contatosArr || []).filter(function(c) {
  var ok = _fbEvaluate(_cttPseudoDataset(c), 'contatos');
  if (ok && buscaNorm) {
   var haystack = _ssNormalize([c.nome_completo, c.cargo, _cttEmpresaPrimaria(c), c.email, c.telefone].filter(Boolean).join(' '));
   ok = _ssMatch(haystack, buscaNorm);
  }
  return ok;
 });
 filtered.sort(function(a, b) { return _sbCompare(_cttPseudoDataset(a), _cttPseudoDataset(b), 'contatos'); });

 var tree = _gtBuildTree(filtered, [{ field: groupField, dir: _gbPrimaryDir('contatos') }], _cttGroupKeyFor, null, 0);
 var rowsArr = [];
 _cttRenderGroupNode(tree, [], rowsArr);
 tbody.innerHTML = rowsArr.length ? rowsArr.join('') : '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:32px;font-size:13px">Nenhum contato encontrado.</td></tr>';

 var fbBadge = document.getElementById('fb-badge-contatos');
 if (fbBadge) { fbBadge.textContent = activeConds; fbBadge.style.display = activeConds ? '' : 'none'; }
 var countEl = document.getElementById('ctt-filter-count');
 if (countEl) {
  if (activeConds || buscaNorm) { countEl.textContent = filtered.length + (filtered.length === 1 ? ' resultado' : ' resultados'); countEl.style.display = 'inline'; }
  else { countEl.style.display = 'none'; }
 }
}

function _cttApplyFilters() {
 var groupField = _gbPrimaryField('contatos');
 if (groupField) { _cttRenderGrouped(groupField); return; }

 // Mesmo motivo do _empApplyFilters acima: remove os cabeçalhos de grupo
 // deixados por _cttRenderGrouped ao sair do modo agrupado.
 var tbody0 = document.getElementById('ctt-tbody');
 if (tbody0 && tbody0.querySelector('tr.gestor-group-hd')) {
  tbody0.innerHTML = (_contatosArr || []).map(_cttRowHTML).join('');
 }

 var buscaNorm = _ssNormalize(((document.getElementById('ctt-search') || {}).value || '').trim());
 var activeConds = _fbInstances.contatos.state.conditions.filter(_fbConditionIsUsable).length;
 var rows = Array.prototype.slice.call(document.querySelectorAll('#ctt-tbody tr'));
 var visivel = 0;
 rows.forEach(function(tr) {
  var ok = _fbEvaluate(tr.dataset, 'contatos');
  if (ok && buscaNorm) ok = _ssMatch(_ssNormalize(tr.textContent), buscaNorm);
  tr.style.display = ok ? '' : 'none';
  if (ok) visivel++;
 });
 if (rows.length) {
  rows.sort(function(a, b) { return _sbCompare(a.dataset, b.dataset, 'contatos'); });
  var tbody = rows[0].parentElement;
  rows.forEach(function(tr) { tbody.appendChild(tr); });
 }
 var fbBadge = document.getElementById('fb-badge-contatos');
 if (fbBadge) { fbBadge.textContent = activeConds; fbBadge.style.display = activeConds ? '' : 'none'; }
 var countEl = document.getElementById('ctt-filter-count');
 if (countEl) {
  if (activeConds || buscaNorm) { countEl.textContent = visivel + (visivel === 1 ? ' resultado' : ' resultados'); countEl.style.display = 'inline'; }
  else { countEl.style.display = 'none'; }
 }
}

// Abre o painel lateral num formulário de criação de verdade — Razão Social
// e CNPJ marcados com * e validados (inclusive duplicidade de CNPJ) antes de
// gravar qualquer coisa no banco. Antes disto, a empresa era inserida em
// branco na hora (só "Nova empresa", sem nada obrigatório) e só depois
// editada — sem nenhum campo obrigatório de verdade, dava pra "criar" uma
// empresa sem nome nenhum de sentido nem CNPJ. Obra/Contato já dá pra
// vincular na própria criação (fila local abaixo), sem precisar reabrir o
// painel depois de criada.
// Obras/Contatos escolhidos ANTES da empresa existir no banco — não dá pra
// gravar em empresas_obras/contatos_empresas sem um empresa_id ainda, então
// ficam só numa fila local ({id, nome}) até _spCriarEmpresa() criar a
// empresa de verdade e gravar os vínculos juntos, na mesma ação.
var _spEmpNovaObrasSel = [];
var _spEmpNovaContatosSel = [];
function _spNovaVinculosArr(tipo) { return tipo === 'obra' ? _spEmpNovaObrasSel : _spEmpNovaContatosSel; }
function _spNovaVinculosChipsHTML(tipo) {
 var arr = _spNovaVinculosArr(tipo);
 if (!arr.length) return '<div class="sp-empty">Nenhum'+(tipo==='obra'?'a obra':' contato')+' selecionad'+(tipo==='obra'?'a':'o')+'.</div>';
 return arr.map(function(o){
  return _spRelChipHTML(tipo==='obra'?'obras':'contatos', o.id, o.nome, null, "_spNovaVinculoRemove('"+tipo+"','"+String(o.id).replace(/'/g,"\\'")+"')");
 }).join('');
}
function _spNovaVinculosHTML() {
 function secao(tipo, label) {
  return '<div style="margin-top:20px;border-top:1px solid var(--border);padding-top:16px">'
   + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
   + '<div style="font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.5px;text-transform:uppercase">'+label+'</div>'
   + '<button type="button" class="btn btn-ghost" style="padding:2px 8px;font-size:11px" onclick="_empLinkToggle(\''+tipo+'\')">+ Vincular</button>'
   + '</div>'
   + '<div id="sp-emp-link-'+tipo+'" style="display:none;margin-bottom:8px"></div>'
   + '<div id="sp-emp-'+(tipo==='obra'?'obras':'contatos')+'" class="sp-rel-chips-wrap">' + _spNovaVinculosChipsHTML(tipo) + '</div></div>';
 }
 return secao('obra', 'Obras vinculadas') + secao('contato', 'Contatos vinculados');
}
// Re-renderiza só os chips de rascunho a partir da fila local (sem tocar no
// banco) — chamada tanto depois de adicionar (_empLinkAdd em modo criação)
// quanto depois de remover (_spNovaVinculoRemove) um item da fila.
function _spNovaVinculosRefresh(tipo) {
 var container = document.getElementById(tipo === 'obra' ? 'sp-emp-obras' : 'sp-emp-contatos');
 if (container) container.innerHTML = _spNovaVinculosChipsHTML(tipo);
}
// Chip de rascunho (ainda não gravado) removido só da fila local — nada de
// chamada ao banco aqui, é exatamente o oposto local de _empLinkAdd em modo
// criação (ver mais abaixo).
function _spNovaVinculoRemove(tipo, id) {
 var arr = _spNovaVinculosArr(tipo);
 var idx = arr.findIndex(function(x){ return String(x.id) === String(id); });
 if (idx !== -1) arr.splice(idx, 1);
 _spNovaVinculosRefresh(tipo);
}
function openNovaEmpresa() {
 _spEmpCurrentId = '';
 _spEmpCategoriaSel = [];
 _spEmpNovaObrasSel = [];
 _spEmpNovaContatosSel = [];
 var ov = document.getElementById('sp-overlay'), dr = document.getElementById('sp-drawer');
 if (_spRow) { _spRow.classList.remove('sp-active'); _spRow = null; }
 ov.classList.add('sp-open'); dr.classList.add('sp-open');
 _spSet('Nova empresa', 'Nova empresa',
  '<div class="sp-field"><div class="sp-label">Razão Social <span style="color:var(--red)">*</span></div>'
  + '<input class="sp-inp" id="sp-emp-nome" placeholder="Nome da empresa"></div>'
  + '<div class="sp-g2">'
  + '<div class="sp-field"><div class="sp-label">CNPJ <span style="color:var(--red)">*</span></div>'
  + '<input class="sp-inp" id="sp-emp-cnpj" value="'+_empCnpjMaskValue('')+'" oninput="_empCnpjMask(this)"></div>'
  + '<div class="sp-field"><div class="sp-label">Estado</div>'+_spEmpEstadoMarkup('')+'</div>'
  + '</div>'
  + '<div class="sp-g2">'
  + '<div class="sp-field"><div class="sp-label">Categoria</div><div id="sp-emp-categoria-dropdown"></div></div>'
  + '<div class="sp-field"><div class="sp-label">Fase</div><select class="sp-inp" id="sp-emp-fase">'+_spEmpOptSelect(EMPRESA_FASE_OPCOES,'')+'</select></div>'
  + '</div>'
  + '<div class="sp-field"><div class="sp-label">URL do site</div>'
  + '<input class="sp-inp" id="sp-emp-site" type="url" placeholder="https://..."></div>'
  + _spNovaVinculosHTML(),
  '<button class="btn btn-primary" id="sp-emp-criar-btn" onclick="_spCriarEmpresa()">Criar empresa</button> <button class="btn btn-ghost" onclick="closePanel()">Cancelar</button>'
 );
 _spEmpRenderCategoriaDropdown();
 document.addEventListener('keydown', _spEsc, {once:true});
}
async function _spCriarEmpresa() {
 var nomeEl = document.getElementById('sp-emp-nome');
 var cnpjEl = document.getElementById('sp-emp-cnpj');
 var nome = (nomeEl || {}).value ? nomeEl.value.trim() : '';
 // cnpj nunca é uma string "vazia" de verdade agora (o molde preenche as
 // posições não digitadas com "_") — quem decide se está completo é a
 // contagem de dígitos reais (\D já ignora "_" igual ignora "." "/" "-"),
 // não mais um simples if(!cnpj).
 var cnpj = (cnpjEl || {}).value || '';
 var cnpjDigits = cnpj.replace(/\D/g, '');
 if (nomeEl) { nomeEl.style.borderColor = nome ? '' : 'var(--red)'; nomeEl.style.boxShadow = nome ? '' : '0 0 0 2px rgba(239,68,68,.18)'; }
 if (cnpjEl) { cnpjEl.style.borderColor = cnpjDigits.length === 14 ? '' : 'var(--red)'; cnpjEl.style.boxShadow = cnpjDigits.length === 14 ? '' : '0 0 0 2px rgba(239,68,68,.18)'; }
 if (!nome) { _showToast('Preencha os campos obrigatórios (*).', 'erro'); return; }
 if (cnpjDigits.length !== 14) {
  _showToast('CNPJ incompleto — informe os 14 dígitos.', 'erro');
  return;
 }
 if (!_sb) { _showToast('Sem conexão com o banco.', 'erro'); return; }
 var btn = document.getElementById('sp-emp-criar-btn');
 if (btn) { btn.disabled = true; btn.textContent = 'Verificando...'; }
 if (await _empCnpjJaExiste(cnpj, null)) {
  _showToast('Já existe uma empresa cadastrada com este CNPJ.', 'erro');
  if (cnpjEl) { cnpjEl.style.borderColor = 'var(--red)'; cnpjEl.style.boxShadow = '0 0 0 2px rgba(239,68,68,.18)'; }
  if (btn) { btn.disabled = false; btn.textContent = 'Criar empresa'; }
  return;
 }
 var payload = {
  nome: nome,
  cnpj: cnpj,
  estado: ((document.getElementById('sp-emp-estado') || {}).value || '').trim().toUpperCase() || null,
  fase_ciclo_vida: ((document.getElementById('sp-emp-fase') || {}).value || '').trim() || null,
  categoria: (_spEmpCategoriaSel || []).slice(),
  url_site: (document.getElementById('sp-emp-site') || {}).value.trim() || null,
 };
 var res = await _sb.from('empresas').insert(payload).select().single();
 if (res.error || !res.data) {
  _showToast('Erro ao criar empresa: ' + _supaErrPt((res.error && res.error.message) || ''), 'erro');
  if (btn) { btn.disabled = false; btn.textContent = 'Criar empresa'; }
  return;
 }
 // Grava os vínculos escolhidos ANTES de existir empresa_id (fila local, ver
 // _spEmpNovaObrasSel/_spEmpNovaContatosSel) agora que a empresa já existe
 // de verdade — na mesma ação de criar, sem precisar reabrir o painel e
 // vincular tudo de novo depois.
 var novoId = res.data.id;
 var vincErros = [];
 if (_spEmpNovaObrasSel.length) {
  var rObras = await _sb.from('empresas_obras').insert(_spEmpNovaObrasSel.map(function(o){ return { empresa_id: novoId, obra_id: o.id }; }));
  if (rObras.error) vincErros.push(rObras.error);
 }
 if (_spEmpNovaContatosSel.length) {
  var rContatos = await _sb.from('contatos_empresas').insert(_spEmpNovaContatosSel.map(function(c){ return { empresa_id: novoId, contato_id: c.id }; }));
  if (rContatos.error) vincErros.push(rContatos.error);
 }
 await _dbLoadEmpresas();
 var row = document.querySelector('#emp-tbody tr[data-id="'+novoId+'"]');
 if (row) _spOpen('empresas', row);
 if (vincErros.length) {
  _showToast('Empresa criada, mas houve erro ao vincular obra/contato.', 'erro');
  console.error('[_spCriarEmpresa] erro(s) ao vincular:', vincErros);
 } else {
  _showToast('Empresa criada!', 'ok');
 }
}
function openNovoContato() { alert('Modal de novo contato — a implementar'); }

// ── Estado dos filtros (movido de dashboard.js) ──────────────────────────────
// Cargo (singleSelect real no Airtable, tabela Contatos) — vocabulário
// verificado direto no Airtable (fonte única da verdade), reproduzido aqui
// fielmente. Inclui duplicatas quase-idênticas de grafia/caixa que já
// existem nos dados reais (ex.: "COMPRAS"/"Compras", "SÓCIO"/"Sócio(a)") —
// isso é um problema de qualidade de dado do Airtable histórico, não algo
// pra "corrigir" silenciosamente aqui: deduplicar esconderia valores que
// alguém pode ter escolhido de propósito. Ver relatório desta tarefa.
var CONTATO_CARGO_OPCOES = [
 'Analista de compras/suprimentos', 'Auxiliar de engenharia', 'Chefe', 'COMPRAS', 'Compras',
 'Coordenador(a) de compras/suprimentos', 'DIRETOR', 'Diretor Comercial', 'Diretor de Operações',
 'Engenheira', 'Engenheiro da obra', 'Engenheiro(a)', 'Estagiário(a)', 'Financeiro(a)',
 'Gerente de projetos', 'Presidente', 'Projetista', 'Representante Comercial', 'Sócia',
 'SÓCIO', 'Sócio(a)', 'Técnico'
];
// Opções dinâmicas (dependem dos dados carregados, não dá pra fixar num
// array estático como Fase/Estado) — mesmo padrão de _gestorOptionsFrom em
// tarefas.js: recalculadas sob demanda a partir de _empresasArr sempre que o
// popover de Filtro abre.
function _empOptionsFrom(getter) {
 var set = {};
 (_empresasArr || []).forEach(function(e) { var v = getter(e); if (v) set[v] = 1; });
 return Object.keys(set).sort();
}
var _empCampos = {
 'nome': { label: 'Empresa', type: 'text' },
 // type 'multitext' é o tipo que filtro-builder.js já entende pra campos
 // array-valued comparados via string separada por vírgula (mesmo padrão de
 // Setor/Cidade em _fornFbFields) — dataset.categoria é gravado como
 // "modular,solar".toLowerCase() em _dbLoadEmpresas, exatamente o formato
 // que _fbEvalCondition espera pra esse tipo.
 'categoria': { label: 'Categoria', type: 'multitext', opts: EMPRESA_CATEGORIA_OPCOES },
 'fase': { label: 'Fase', type: 'select', opts: EMPRESA_FASE_OPCOES },
 'estado': { label: 'Estado', type: 'select', opts: EMPRESA_ESTADO_OPCOES },
 'cnpj': { label: 'CNPJ', type: 'text' },
 'site': { label: 'URL do site', type: 'text' },
 'obra': { label: 'Obra', type: 'multitext', opts: function(){
  var set = {};
  (_empresasArr || []).forEach(function(e){ (e.empresas_obras||[]).forEach(function(l){ if (l.obra && l.obra.nome) set[l.obra.nome] = 1; }); });
  return Object.keys(set).sort();
 } },
 'ctt': { label: 'Todos os Contatos', type: 'select', opts: ['Com contato','Sem contato'] },
 'ultalt': { label: 'Última alteração', type: 'select', includeEmptyOption: true, opts: function(){ return _empOptionsFrom(function(e){ return e.ultima_alteracao_por; }); } }
};
function _cttOptionsFrom(getter) {
 var set = {};
 (_contatosArr || []).forEach(function(c) { var v = getter(c); if (v) set[v] = 1; });
 return Object.keys(set).sort();
}
var _cttCampos = {
 'nome': { label: 'Nome', type: 'text' },
 'cargo': { label: 'Cargo', type: 'select', opts: CONTATO_CARGO_OPCOES },
 // Multitext (não select simples): um contato pode ter mais de uma empresa
 // vinculada (contatos_empresas é N:N) — o valor comparado (data-empresa)
 // já é a lista de nomes separada por vírgula, ver _cttEmpresasNomesTodas.
 'empresa': { label: 'Empresa', type: 'multitext', opts: function(){
  var set = {};
  (_contatosArr || []).forEach(function(c){ _cttEmpresasNomesTodas(c).forEach(function(n){ set[n] = 1; }); });
  return Object.keys(set).sort();
 } },
 // Fase/Categoria/Estado vêm da empresa vinculada (contatos não tem esses
 // campos próprios) — mesmo vocabulário fixo já usado em Empresas.
 'fase':     { label: 'Fase do ciclo de vida', type: 'select', includeEmptyOption: true, opts: EMPRESA_FASE_OPCOES },
 'categoria':{ label: 'Categoria', type: 'multitext', opts: EMPRESA_CATEGORIA_OPCOES },
 'estado':   { label: 'Estado', type: 'select', includeEmptyOption: true, opts: EMPRESA_ESTADO_OPCOES },
 'telefone': { label: 'Número de Telefone', type: 'text' },
 'email':    { label: 'E-mail', type: 'text' },
 'created_at': { label: 'Data de criação', type: 'date' },
 'ultima_alteracao_por': { label: 'Última alteração', type: 'select', includeEmptyOption: true, opts: function(){ return _cttOptionsFrom(function(c){ return c.ultima_alteracao_por; }); } }
};

/* Filtro/Ordenação de Empresas — componentes reutilizáveis (filtro-builder/
   sort-builder/smart-search), mesmo padrão do Gestor de Tarefas/Obras.
   _empCampos já tinha exatamente o formato certo (label+type+opts), só
   precisou virar array. _fbEvaluate/_ssMatch recebem tr.dataset direto: os
   valores já são gravados em minúsculas no template de _dbLoadEmpresas, o
   que já basta pra comparação — filtro-builder também lowercasa dos dois
   lados então funciona igual com ou sem essa normalização prévia. */
var _empFbFields = Object.keys(_empCampos).map(function(k) {
 var c = _empCampos[k];
 return { key: k, label: c.label, type: c.type, options: c.opts || [], includeEmptyOption: c.includeEmptyOption };
});
_fbInit('empresas', _empFbFields, _empApplyFilters);

var _empSbFields = [
 { key: 'nome', label: 'Empresa', type: 'text' },
 { key: 'categoria', label: 'Categoria', type: 'text' },
 { key: 'fase', label: 'Fase', type: 'text' },
 { key: 'estado', label: 'Estado', type: 'text' },
];
_sbInit('empresas', _empSbFields, _empApplyFilters);

// Agrupamento — travado em 1 nível (maxLevels:1, o pedido não envolvia
// múltiplos níveis como o Gestor de Tarefas tem). Campos mínimos pedidos:
// Fase, Estado, Categoria (ver _empGroupKeyFor acima pra semântica de cada).
_gbInit('empresas', [
 { key: 'nome',      label: 'Nome' },
 { key: 'fase',      label: 'Fase' },
 { key: 'estado',    label: 'Estado' },
 { key: 'categoria', label: 'Categoria' },
], _empApplyFilters, 1);

/* Filtro/Ordenação de Contatos — mesma migração acima, reaproveitando
   _cttCampos que já existia (nome/cargo/empresa, com o vocabulário real de
   Cargo verificado no Airtable). */
var _cttFbFields = Object.keys(_cttCampos).map(function(k) {
 var c = _cttCampos[k];
 return { key: k, label: c.label, type: c.type, options: c.opts || [], includeEmptyOption: c.includeEmptyOption };
});
_fbInit('contatos', _cttFbFields, _cttApplyFilters);

var _cttSbFields = [
 { key: 'nome',      label: 'Nome',      type: 'text' },
 { key: 'cargo',     label: 'Cargo',     type: 'text' },
 { key: 'empresa',   label: 'Empresa',   type: 'text' },
 { key: 'fase',      label: 'Fase do ciclo de vida (Empresa)', type: 'text' },
 { key: 'categoria', label: 'Categoria (Empresa)', type: 'text' },
 { key: 'estado',    label: 'Estado (Empresa)', type: 'text' },
 { key: 'telefone',  label: 'Número de Telefone', type: 'text' },
 { key: 'email',     label: 'E-mail', type: 'text' },
 // created_at já chega pré-truncado em YYYY-MM-DD (tanto no dataset do <tr>
 // quanto no pseudo-dataset), então type:'date' direto no valor funciona
 // sem precisar de getValue — o parser de data do sort-builder espera
 // exatamente esse formato.
 { key: 'created_at', label: 'Data de criação', type: 'date' },
 { key: 'ultima_alteracao_por', label: 'Última alteração', type: 'text' },
];
_sbInit('contatos', _cttSbFields, _cttApplyFilters);

// Agrupamento — travado em 1 nível, mesma engine de Empresas/Gestor de
// Tarefas. "Nome" agrupa pela letra inicial (A-Z), mesmo esquema de Empresas
// (ver _cttGroupKeyFor acima).
_gbInit('contatos', [
 { key: 'nome',    label: 'Nome do contato' },
 { key: 'cargo',   label: 'Cargo' },
 { key: 'empresa', label: 'Empresa' },
], _cttApplyFilters, 1);
