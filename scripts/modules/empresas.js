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

// Categoria (multipleSelects real no Airtable) — mesmo componente de
// multiselect-ui.js já usado pra Setor/Cidade de Fornecedores
// (_fornRenderSetoresDropdown), só que aqui dentro do painel lateral de
// detalhe de Empresa em vez do formulário de cadastro.
var _spEmpCategoriaSel = [];
function _spEmpRenderCategoriaDropdown() {
 var wrap = document.getElementById('sp-emp-categoria-dropdown');
 if (wrap) wrap.innerHTML = _msRenderDropdown('sp-emp-categoria', EMPRESA_CATEGORIA_OPCOES, _spEmpCategoriaSel, '_spEmpCategoriaToggle', 'Selecione a(s) categoria(s)');
}
function _spEmpCategoriaToggle(campo, valor, checked) {
 _spEmpCategoriaSel = _msToggle(_spEmpCategoriaSel, valor, checked);
 var btn = document.querySelector('#sp-emp-categoria-dropdown .fb-msel-btn');
 if (btn) btn.textContent = _spEmpCategoriaSel.length ? _spEmpCategoriaSel.length + ' selecionado(s)' : 'Selecione a(s) categoria(s)';
}

async function _spEmpresas(row, tds) {
 var d = row.dataset;
 var empId = d.id || '';
 // Fonte de verdade: cache carregado do Supabase (_empresasArr), não o dataset
 // da linha (que fica em minúsculas, só para filtro) nem o DOM renderizado.
 var emp = (_empresasArr || []).find(function(e){ return String(e.id) === String(empId); }) || {};
 var nome = emp.nome || d.nome || '';
 var cnpj = emp.cnpj || '';
 var estado = (emp.estado || '').toUpperCase();
 var fase   = emp.fase_ciclo_vida || '';
 _spEmpCategoriaSel = (emp.categoria || []).slice();

 // Auditoria: created_at/updated_at NÃO são usados aqui de propósito — são
 // timestamps de LOTE da migração (poucas dezenas de valores distintos pra
 // 636 empresas, idênticos entre registros migrados juntos), não a data real
 // de cada registro. ultima_modificacao é que carrega o "Última modificação"
 // real do Airtable (lastModifiedTime, 294 valores distintos verificados por
 // SQL) — por isso é essa a data mostrada, junto de quem criou/alterou por
 // último. Não existe coluna com a data de criação real (Airtable tem
 // "Data de criação" mas ela não foi migrada como coluna própria) — por isso
 // "Criado por" aparece sem data ao lado.
 var auditHtml = '<div style="margin-top:20px;border-top:1px solid var(--border);padding-top:16px">'
  + '<div style="font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;margin-bottom:10px">Auditoria</div>'
  + '<div class="drw-audit-row"><span class="drw-audit-lbl">Criado por</span><span class="drw-audit-val">'+(emp.criado_por||'—')+'</span></div>'
  + '<div class="drw-audit-row"><span class="drw-audit-lbl">Última alteração por</span><span class="drw-audit-val">'+(emp.ultima_alteracao_por||'—')+'</span></div>'
  + '<div class="drw-audit-row"><span class="drw-audit-lbl">Última modificação</span><span class="drw-audit-val">'+(emp.ultima_modificacao ? new Date(emp.ultima_modificacao).toLocaleString('pt-BR') : '—')+'</span></div>'
  + '</div>';

 _spSet('Empresa', nome,
  '<div class="sp-field"><div class="sp-label">Razão Social</div>'
  + '<input class="sp-inp" id="sp-emp-nome" value="'+nome.replace(/"/g,'&quot;')+'"></div>'
  + '<div class="sp-g2">'
  + '<div class="sp-field"><div class="sp-label">CNPJ</div><input class="sp-inp" id="sp-emp-cnpj" value="'+cnpj.replace(/"/g,'&quot;')+'"></div>'
  + '<div class="sp-field"><div class="sp-label">Estado</div><select class="sp-inp" id="sp-emp-estado">'+_spEmpOptSelect(EMPRESA_ESTADO_OPCOES, estado)+'</select></div>'
  + '</div>'
  + '<div class="sp-g2">'
  + '<div class="sp-field"><div class="sp-label">Categoria</div><div id="sp-emp-categoria-dropdown"></div></div>'
  + '<div class="sp-field"><div class="sp-label">Fase</div><select class="sp-inp" id="sp-emp-fase">'+_spEmpOptSelect(EMPRESA_FASE_OPCOES, fase)+'</select></div>'
  + '</div>'
  + '<input type="hidden" id="sp-emp-id" value="'+empId+'">'
  + auditHtml
  + '<div style="margin-top:20px;border-top:1px solid var(--border);padding-top:16px">'
  + '<div style="font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;margin-bottom:10px">Obras vinculadas</div>'
  + '<div id="sp-emp-obras" style="display:flex;flex-direction:column;gap:6px">'
  + '<div style="font-size:12px;color:var(--muted);padding:12px 0">Carregando obras...</div>'
  + '</div></div>'
  + '<div style="margin-top:20px;border-top:1px solid var(--border);padding-top:16px">'
  + '<div style="font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;margin-bottom:10px">Contatos vinculados</div>'
  + '<div id="sp-emp-contatos" style="display:flex;flex-direction:column;gap:8px">'
  + '<div style="font-size:12px;color:var(--muted);padding:12px 0">Carregando contatos...</div>'
  + '</div></div>',
  '<button class="btn btn-primary" id="sp-emp-save-btn" onclick="_spSaveEmpresa()">Salvar</button> <button class="btn btn-ghost" onclick="closePanel()">Fechar</button>'
 );

 _spEmpRenderCategoriaDropdown();

 if (!_sb || !empId) return;

 // Obras vinculadas — busca preguiçosa (só quando o painel de UMA empresa
 // abre, não junto de _dbLoadEmpresas pra todas as 636 de uma vez): a
 // relação empresa→obra vem da junction empresas_obras (verificada com 1561
 // linhas reais em produção antes de escrever este código).
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
    return '<div style="font-size:12px;padding:6px 10px;background:rgba(0,0,0,.025);border:1px solid var(--border);border-radius:6px">'+(o.nome||'—')+'</div>';
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

 var colors = ['#3D4FD1','#1F8A4C','#e07b00','#8B6FE8','#1f7ec4','#c44b1f','#0f766e','#9c27b0'];
 function _cttColorSp(name) {
  var c = 0; for (var j = 0; j < (name||'').length; j++) c += name.charCodeAt(j);
  return colors[c % colors.length];
 }

 container.innerHTML = res.data.map(function(link) {
  var c = link.contato;
  if (!c) return '';
  var nome = c.nome_completo || '—';
  var initials = nome.split(' ').filter(Boolean).slice(0,2).map(function(w){return w[0];}).join('').toUpperCase() || '?';
  var isPrimary = link.is_primary;

  var telHtml = '';
  if (c.telefone) {
   var waNum = _sanitizeTelWA(c.telefone);
   var telSafe = c.telefone.replace(/'/g,'&#39;');
   telHtml = '<div style="display:flex;align-items:center;gap:4px;margin-top:4px">'
    + '<span style="font-size:11px;color:var(--muted)">'+c.telefone+'</span>'
    + '<span style="display:flex;gap:2px;margin-left:2px">'
    + (waNum ? '<a href="https://wa.me/'+waNum+'" target="_blank" class="ctt-act-btn wa" title="WhatsApp" style="width:18px;height:18px">'+_icoWA+'</a>' : '')
    + '<button onclick="navigator.clipboard.writeText(\''+telSafe+'\');this.title=\'Copiado!\'" class="ctt-act-btn" title="Copiar" style="width:18px;height:18px">'+_icoCopy+'</button>'
    + '</span></div>';
  }

  var emailHtml = '';
  if (c.email) {
   var emailSafe = c.email.replace(/'/g,'&#39;');
   emailHtml = '<div style="display:flex;align-items:center;gap:4px;margin-top:3px">'
    + '<span style="font-size:11px;color:var(--muted)">'+c.email+'</span>'
    + '<span style="display:flex;gap:2px;margin-left:2px">'
    + '<a href="mailto:'+c.email+'" class="ctt-act-btn" title="Enviar e-mail" style="width:18px;height:18px">'+_icoMail+'</a>'
    + '<button onclick="navigator.clipboard.writeText(\''+emailSafe+'\');this.title=\'Copiado!\'" class="ctt-act-btn" title="Copiar" style="width:18px;height:18px">'+_icoCopy+'</button>'
    + '</span></div>';
  }

  return '<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:rgba(0,0,0,.025);border:1px solid var(--border);border-radius:8px">'
   + '<div class="nt-avatar nt-avatar-circle" style="background:'+_cttColorSp(nome)+';flex-shrink:0;width:32px;height:32px;font-size:11px">'+initials+'</div>'
   + '<div style="min-width:0;flex:1">'
   + '<div style="display:flex;align-items:center;gap:6px">'
   + '<span style="font-weight:600;font-size:13px">'+nome+'</span>'
   + (isPrimary ? '<span style="font-size:10px;padding:1px 6px;background:var(--navy-dim);color:var(--navy);border-radius:3px;font-weight:600">Principal</span>' : '')
   + '</div>'
   + (c.cargo ? '<div style="font-size:11px;color:var(--muted);margin-top:1px">'+c.cargo+'</div>' : '')
   + telHtml
   + emailHtml
   + '</div></div>';
 }).join('');
}

// ── Renderer: Contatos ───────────────────────────────────────────────────────
function _spContatos(row, tds) {
 const d = row.dataset;
 const nome = d.nome ? d.nome.replace(/\w/g,l=>l.toUpperCase()) : '';
 const cargo   = d.cargo   || '';
 const perfil  = d.perfil  || '';
 const empresa = d.empresa || '';
 const email   = tds[3]?.innerText?.trim()||'';
 const tel     = tds[4]?.innerText?.trim()||'';
 _spSet('Contato', nome, `
  <div class="sp-field"><div class="sp-label">Nome</div>
   <input class="sp-inp" value="${nome.replace(/"/g,'&quot;')}">
  </div>
  <div class="sp-g2">
   <div class="sp-field"><div class="sp-label">Cargo</div>
    <input class="sp-inp" value="${cargo.replace(/\w/g,l=>l.toUpperCase())}">
   </div>
   <div class="sp-field"><div class="sp-label">Perfil</div>
    <select class="sp-inp">
     <option ${perfil==='decisor'?'selected':''}>decisor</option>
     <option ${perfil==='técnico'?'selected':''}>técnico</option>
     <option ${perfil==='operacional'?'selected':''}>operacional</option>
     <option ${perfil==='financeiro'?'selected':''}>financeiro</option>
    </select>
   </div>
  </div>
  <div class="sp-field"><div class="sp-label">Empresa</div>
   <input class="sp-inp" value="${empresa.replace(/\w/g,l=>l.toUpperCase())}">
  </div>
  <div class="sp-g2">
   <div class="sp-field"><div class="sp-label">E-mail</div>
    <input class="sp-inp" type="email" value="${email}">
   </div>
   <div class="sp-field"><div class="sp-label">Telefone</div>
    <input class="sp-inp" type="tel" value="${tel}">
   </div>
  </div>`,
  '<button class="btn btn-ghost" onclick="closePanel()">Fechar</button>');
}

async function _dbLoadEmpresas() {
 var tbody0 = document.getElementById('emp-tbody');
 if (tbody0) tbody0.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:32px;font-size:13px">Carregando...</td></tr>';
 var allData = []; var from = 0; var more = true;
 while (more) {
  var res = await _sb.from('empresas')
   .select('id, nome, cnpj, estado, fase_ciclo_vida, categoria, criado_por, ultima_alteracao_por, ultima_modificacao, contatos_empresas(contato_id)')
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

 var colors = ['#3D4FD1','#1F8A4C','#e07b00','#8B6FE8','#1f7ec4','#c44b1f','#0f766e','#9c27b0'];
 function _empColor(name) {
  var c = 0; for (var j = 0; j < (name||'').length; j++) c += name.charCodeAt(j);
  return colors[c % colors.length];
 }
 function _faseTag(fase) {
  var f = (fase||'').toLowerCase();
  if (!fase || fase === '—') return '<span class="nt-tag nt-tag-gray">—</span>';
  if (f.includes('cliente') || f.includes('parceiro') || f.includes('ativo')) return '<span class="nt-tag nt-tag-green">'+fase+'</span>';
  if (f.includes('negoci') || f.includes('proposta') || f.includes('qualif')) return '<span class="nt-tag nt-tag-blue">'+fase+'</span>';
  if (f.includes('lead') || f.includes('prospect') || f.includes('contato')) return '<span class="nt-tag nt-tag-yellow">'+fase+'</span>';
  if (f.includes('inativ') || f.includes('perdid') || f.includes('cancel')) return '<span class="nt-tag nt-tag-gray">'+fase+'</span>';
  return '<span class="nt-tag nt-tag-gray">'+fase+'</span>';
 }

 tbody.innerHTML = allData.map(function(e) {
  var initials = (e.nome||'?').split(' ').filter(Boolean).slice(0,2).map(function(w){return w[0];}).join('').toUpperCase();
  var nCtt = (e.contatos_empresas||[]).length;
  var cats = (e.categoria||[]);
  var fase = e.fase_ciclo_vida || '—';
  return '<tr onclick="if(!event.target.closest(\'button,a,input,select\'))_spOpen(\'empresas\',this)"'
   + ' data-id="'+e.id+'"'
   + ' data-nome="'+(e.nome||'').toLowerCase()+'"'
   + ' data-fase="'+fase.toLowerCase()+'"'
   + ' data-estado="'+(e.estado||'').toLowerCase()+'"'
   + ' data-categoria="'+cats.join(',').toLowerCase()+'">'
   + '<td><input type="checkbox" style="cursor:pointer;opacity:.4"></td>'
   + '<td><div style="display:flex;align-items:center;gap:10px">'
   + '<div class="nt-avatar" style="background:'+_empColor(e.nome)+'">'+initials+'</div>'
   + '<div><div style="font-weight:500;font-size:13px">'+e.nome+'</div>'
   + '<div style="font-size:11px;color:var(--muted)">'+(e.cnpj||'—')+'</div></div>'
   + '</div></td>'
   + '<td style="font-size:12px;color:var(--muted)">'+(cats.join(', ')||'—')+'</td>'
   + '<td style="font-size:12px;color:var(--muted)">'+(e.estado||'—')+'</td>'
   + '<td>'+_faseTag(fase)+'</td>'
   + '<td style="text-align:center;font-weight:'+(nCtt>0?'600':'400')+';color:'+(nCtt>0?'var(--text)':'var(--muted)')+'">'+nCtt+'</td>'
   + '<td><button class="nt-open-btn" onclick="event.stopPropagation();_spOpen(\'empresas\',this.closest(\'tr\'))" style="font-size:11px;color:var(--muted);background:rgba(0,0,0,.06);border:none;border-radius:4px;padding:3px 8px;cursor:pointer;font-weight:500;opacity:0;transition:opacity .12s">Abrir →</button></td>'
   + '</tr>';
 }).join('');
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

// ── Load Contatos (cache global + renderiza tabela) ───────────────────────────
async function _dbLoadContatos() {
 var tbody0 = document.getElementById('ctt-tbody');
 if (tbody0) tbody0.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:32px;font-size:13px">Carregando...</td></tr>';
 var allData = []; var from = 0; var more = true;
 while (more) {
  var res = await _sb.from('contatos')
   .select('id, nome_completo, cargo, email, telefone, contatos_empresas(is_primary, empresa:empresa_id(id, nome))')
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

 var colors = ['#3D4FD1','#1F8A4C','#e07b00','#8B6FE8','#1f7ec4','#c44b1f','#0f766e','#9c27b0'];
 function _cttColor(name) {
  var c = 0; for (var j = 0; j < (name||'').length; j++) c += name.charCodeAt(j);
  return colors[c % colors.length];
 }

 tbody.innerHTML = allData.map(function(c) {
  var nome = c.nome_completo || '—';
  var initials = nome.split(' ').filter(Boolean).slice(0,2).map(function(w){return w[0];}).join('').toUpperCase() || '?';

  // Empresa primária via junction
  var links = c.contatos_empresas || [];
  var empLink = links.find(function(l){ return l.is_primary; }) || links[0];
  var empNome = (empLink && empLink.empresa && empLink.empresa.nome) || '—';

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
   + ' data-empresa="'+empNome.toLowerCase()+'">'
   + '<td><input type="checkbox" style="cursor:pointer;opacity:.4"></td>'
   + '<td><div style="display:flex;align-items:center;gap:9px">'
   + '<div class="nt-avatar nt-avatar-circle" style="background:'+_cttColor(nome)+'">'+initials+'</div>'
   + '<div style="font-weight:500;font-size:13px">'+nome+'</div>'
   + '</div></td>'
   + '<td style="font-size:12px;color:var(--muted)">'+(c.cargo||'—')+'</td>'
   + '<td style="font-size:12px;color:var(--muted)">'+empNome+'</td>'
   + '<td>'+telCell+'</td>'
   + '<td>'+emailCell+'</td>'
   + '<td><button class="nt-open-btn" onclick="event.stopPropagation();_spOpen(\'contatos\',this.closest(\'tr\'))" style="font-size:11px;color:var(--muted);background:rgba(0,0,0,.06);border:none;border-radius:4px;padding:3px 8px;cursor:pointer;font-weight:500;opacity:0;transition:opacity .12s">Abrir →</button></td>'
   + '</tr>';
 }).join('');
}

// ── Salvar Empresa (painel lateral) ────────────────────────────────────────────
async function _spSaveEmpresa() {
 var id = (document.getElementById('sp-emp-id') || {}).value;
 if (!_sb || !id) return;
 var payload = {
  nome:            (document.getElementById('sp-emp-nome')    || {}).value.trim() || '',
  cnpj:            (document.getElementById('sp-emp-cnpj')    || {}).value.trim() || null,
  estado:          ((document.getElementById('sp-emp-estado') || {}).value || '').trim().toUpperCase() || null,
  fase_ciclo_vida: ((document.getElementById('sp-emp-fase')    || {}).value || '').trim() || null,
  categoria:       (_spEmpCategoriaSel || []).slice(),
  ultima_alteracao_por: (_currentUser && _currentUser.email) || null,
  ultima_modificacao: new Date().toISOString(),
 };
 if (!payload.nome) { _showToast('Informe a Razão Social.', 'erro'); return; }

 var btn = document.getElementById('sp-emp-save-btn');
 var { error } = await _sb.from('empresas').update(payload).eq('id', id);
 if (btn) {
  btn.textContent = error ? 'Erro!' : 'Salvo!';
  setTimeout(function(){ btn.textContent = 'Salvar'; }, 1800);
 }
 if (error) {
  _showToast('Erro ao salvar empresa: ' + _supaErrPt(error.message), 'erro');
  return;
 }
 var titleEl = document.getElementById('sp-title');
 if (titleEl) titleEl.textContent = payload.nome;
 _showToast('Empresa salva com sucesso!', 'ok');
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

 document.getElementById('btn-nova-empresa').style.display = (tab === 'empresas') ? 'inline-flex' : 'none';
 document.getElementById('btn-novo-contato').style.display = (tab === 'contatos') ? 'inline-flex' : 'none';
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

function _empApplyFilters() {
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
function toggleCttFilterPanel() {
 _cttPanelOpen = !_cttPanelOpen;
 document.getElementById('ctt-filter-panel').style.display = _cttPanelOpen ? 'block' : 'none';
 if (_cttPanelOpen && _cttConditions.length === 0) addCttCondition();
}

function addCttCondition() {
 var id = ++_cttCondId;
 var firstKey = Object.keys(_cttCampos)[0];
 _cttConditions.push({ id: id, field: firstKey, op: 'contains', value: '' });
 _renderCttConditions();
}

function _condCttChange(el) {
 var id = +el.dataset.cid;
 var key = el.dataset.key;
 var cond = _cttConditions.find(function(c){ return c.id === id; });
 if (!cond) return;
 cond[key] = el.value;
 if (key === 'field') { cond.op = 'contains'; cond.value = ''; }
 if (key === 'op' && (el.value === 'is_empty' || el.value === 'is_not_empty')) cond.value = '';
 _renderCttConditions();
}

function _condCttRemove(id) {
 _cttConditions = _cttConditions.filter(function(c){ return c.id !== id; });
 _renderCttConditions();
}

function _renderCttConditions() {
 var container = document.getElementById('ctt-filter-conditions');
 if (!container) return;
 var ss = 'border:1px solid var(--border);border-radius:6px;font-size:12px;padding:5px 8px;background:var(--surface);color:var(--text);outline:none';
 var html = _cttConditions.map(function(cond) {
 var campo = _cttCampos[cond.field] || {};
 var tipo = campo.type || 'text';
 var opsArr = _empCttOps[tipo] || _empCttOps.text;
 var needsVal = cond.op !== 'is_empty' && cond.op !== 'is_not_empty';
 var campoSel = '<select style="' + ss + '" data-cid="' + cond.id + '" data-key="field" onchange="_condCttChange(this)">';
 Object.keys(_cttCampos).forEach(function(k) {
 campoSel += '<option value="' + k + '"' + (cond.field === k ? ' selected' : '') + '>' + _cttCampos[k].label + '</option>';
 });
 campoSel += '</select>';
 var opSel = '<select style="' + ss + '" data-cid="' + cond.id + '" data-key="op" onchange="_condCttChange(this)">';
 opsArr.forEach(function(o) {
 opSel += '<option value="' + o.val + '"' + (cond.op === o.val ? ' selected' : '') + '>' + o.label + '</option>';
 });
 opSel += '</select>';
 var valEl = '';
 if (needsVal) {
 if (tipo === 'select' && campo.opts) {
 valEl = '<select style="' + ss + ';flex:1" data-cid="' + cond.id + '" data-key="value" onchange="_condCttChange(this)">';
 valEl += '<option value="">— selecione —</option>';
 campo.opts.forEach(function(opt) {
 valEl += '<option value="' + opt + '"' + (cond.value === opt ? ' selected' : '') + '>' + opt + '</option>';
 });
 valEl += '</select>';
 } else {
 valEl = '<input type="text" placeholder="valor..." value="' + (cond.value || '') + '" style="' + ss + ';flex:1" data-cid="' + cond.id + '" data-key="value" oninput="_condCttChange(this)">';
 }
 }
 return '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">' +
 campoSel + opSel + valEl +
 '<button onclick="_condCttRemove(' + cond.id + ')" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:16px;line-height:1;padding:0 4px">×</button>' +
 '</div>';
 }).join('');
 container.innerHTML = html;
}

function filterContatos() {
 var searchEl = document.getElementById('ctt-search');
 var q = searchEl ? searchEl.value.toLowerCase() : '';
 var rows = document.querySelectorAll('#ctt-tbody tr');
 rows.forEach(function(tr) {
 var matchSearch = !q || tr.textContent.toLowerCase().includes(q);
 var matchConds = _cttConditions.every(function(cond) {
 var rawVal = (tr.dataset[cond.field] || '').toLowerCase();
 var condVal = (cond.value || '').toLowerCase();
 switch (cond.op) {
 case 'contains': return rawVal.includes(condVal);
 case 'not_contains': return !rawVal.includes(condVal);
 case 'is': return rawVal === condVal;
 case 'is_not': return rawVal !== condVal;
 case 'is_empty': return rawVal === '';
 case 'is_not_empty': return rawVal !== '';
 default: return true;
 }
 });
 tr.style.display = (matchSearch && matchConds) ? '' : 'none';
 });
 var count = _cttConditions.length;
 var countEl = document.getElementById('ctt-filter-count');
 if (countEl) { countEl.textContent = count ? count + ' filtro(s) ativo(s)' : ''; countEl.style.display = count ? 'inline' : 'none'; }
}

function limparCttFiltros() {
 _cttConditions = []; _cttCondId = 0;
 _renderCttConditions();
 filterContatos();
 var countEl = document.getElementById('ctt-filter-count');
 if (countEl) { countEl.style.display = 'none'; }
}

function openNovaEmpresa() { alert('Modal de nova empresa — a implementar'); }
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
var _empCampos = {
 'nome': { label: 'Empresa', type: 'text' },
 // type 'multitext' é o tipo que filtro-builder.js já entende pra campos
 // array-valued comparados via string separada por vírgula (mesmo padrão de
 // Setor/Cidade em _fornFbFields) — dataset.categoria é gravado como
 // "modular,solar".toLowerCase() em _dbLoadEmpresas, exatamente o formato
 // que _fbEvalCondition espera pra esse tipo.
 'categoria': { label: 'Categoria', type: 'multitext', opts: EMPRESA_CATEGORIA_OPCOES },
 'fase': { label: 'Fase', type: 'select', opts: EMPRESA_FASE_OPCOES },
 'estado': { label: 'Estado', type: 'select', opts: EMPRESA_ESTADO_OPCOES }
};
var _cttCampos = {
 'nome': { label: 'Nome', type: 'text' },
 'cargo': { label: 'Cargo', type: 'select', opts: CONTATO_CARGO_OPCOES },
 'empresa': { label: 'Empresa', type: 'text' }
};
var _empCttOps = {
 'select': [
 { val: 'contains', label: 'contém...' },
 { val: 'not_contains', label: 'não contém...' },
 { val: 'is', label: 'é...' },
 { val: 'is_not', label: 'não é...' },
 { val: 'is_empty', label: 'está vazio' },
 { val: 'is_not_empty', label: 'não está vazio' }
 ],
 'text': [
 { val: 'contains', label: 'contém...' },
 { val: 'not_contains', label: 'não contém...' },
 { val: 'is', label: 'é...' },
 { val: 'is_not', label: 'não é...' },
 { val: 'is_empty', label: 'está vazio' },
 { val: 'is_not_empty', label: 'não está vazio' }
 ]
};
var _cttConditions = []; var _cttCondId = 0;
var _cttPanelOpen = false;

/* Filtro/Ordenação de Empresas — componentes reutilizáveis (filtro-builder/
   sort-builder/smart-search), mesmo padrão do Gestor de Tarefas/Obras.
   _empCampos já tinha exatamente o formato certo (label+type+opts), só
   precisou virar array. _fbEvaluate/_ssMatch recebem tr.dataset direto: os
   valores já são gravados em minúsculas no template de _dbLoadEmpresas, o
   que já basta pra comparação — filtro-builder também lowercasa dos dois
   lados então funciona igual com ou sem essa normalização prévia. */
var _empFbFields = Object.keys(_empCampos).map(function(k) {
 var c = _empCampos[k];
 return { key: k, label: c.label, type: c.type, options: c.opts || [] };
});
_fbInit('empresas', _empFbFields, _empApplyFilters);

var _empSbFields = [
 { key: 'nome', label: 'Empresa', type: 'text' },
 { key: 'categoria', label: 'Categoria', type: 'text' },
 { key: 'fase', label: 'Fase', type: 'text' },
 { key: 'estado', label: 'Estado', type: 'text' },
];
_sbInit('empresas', _empSbFields, _empApplyFilters);
