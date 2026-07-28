// ═══════════════════════════════════════════════════════════════════════════════
// EMPRESAS — inclui as abas Contatos e Fornecedores (mesma página/UI,
// switchEmpTab decide qual sub-aba mostrar). Contatos e Fornecedores não são
// páginas próprias — por isso não têm módulo separado.
// ═══════════════════════════════════════════════════════════════════════════════
async function _spEmpresas(row, tds) {
 var d = row.dataset;
 var empId = d.id || '';
 // Fonte de verdade: cache carregado do Supabase (_empresasArr), não o dataset
 // da linha (que fica em minúsculas, só para filtro) nem o DOM renderizado.
 var emp = (_empresasArr || []).find(function(e){ return String(e.id) === String(empId); }) || {};
 var nome = emp.nome || d.nome || '';
 var cnpj = emp.cnpj || '';
 var estado = emp.estado || '';
 var fase   = emp.fase_ciclo_vida || '';
 var cats   = (emp.categoria || []).join(', ');

 _spSet('Empresa', nome,
  '<div class="sp-field"><div class="sp-label">Razão Social</div>'
  + '<input class="sp-inp" id="sp-emp-nome" value="'+nome.replace(/"/g,'&quot;')+'"></div>'
  + '<div class="sp-g2">'
  + '<div class="sp-field"><div class="sp-label">CNPJ</div><input class="sp-inp" id="sp-emp-cnpj" value="'+cnpj.replace(/"/g,'&quot;')+'"></div>'
  + '<div class="sp-field"><div class="sp-label">Estado</div><input class="sp-inp" id="sp-emp-estado" maxlength="2" style="text-transform:uppercase" value="'+estado.toUpperCase()+'"></div>'
  + '</div>'
  + '<div class="sp-g2">'
  + '<div class="sp-field"><div class="sp-label">Categoria (separe por vírgula)</div><input class="sp-inp" id="sp-emp-categoria" value="'+cats.replace(/"/g,'&quot;')+'"></div>'
  + '<div class="sp-field"><div class="sp-label">Fase</div><input class="sp-inp" id="sp-emp-fase" value="'+fase.replace(/"/g,'&quot;')+'"></div>'
  + '</div>'
  + '<input type="hidden" id="sp-emp-id" value="'+empId+'">'
  + '<div style="margin-top:20px;border-top:1px solid var(--border);padding-top:16px">'
  + '<div style="font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;margin-bottom:10px">Contatos vinculados</div>'
  + '<div id="sp-emp-contatos" style="display:flex;flex-direction:column;gap:8px">'
  + '<div style="font-size:12px;color:var(--muted);padding:12px 0">Carregando contatos...</div>'
  + '</div></div>',
  '<button class="btn btn-primary" id="sp-emp-save-btn" onclick="_spSaveEmpresa()">Salvar</button> <button class="btn btn-ghost" onclick="closePanel()">Fechar</button>'
 );

 if (!_sb || !empId) return;
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

 var colors = ['#1B1B8F','#28b548','#e07b00','#8957E5','#1f7ec4','#c44b1f','#0f766e','#9c27b0'];
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
   .select('id, nome, cnpj, estado, fase_ciclo_vida, categoria, contatos_empresas(contato_id)')
   .order('nome').range(from, from + 999);
  if (res.error || !res.data || !res.data.length) break;
  allData = allData.concat(res.data);
  more = res.data.length === 1000; from += 1000;
 }
 if (!allData.length) return;
 _empresasArr = allData;

 // Atualiza badges e stats
 var badge = document.getElementById('badge-emp');
 if (badge) badge.textContent = allData.length;
 var stTotal = document.getElementById('emp-stat-total');
 if (stTotal) stTotal.textContent = allData.length;
 var stCtt = document.getElementById('emp-stat-ctt');
 if (stCtt) stCtt.textContent = allData.filter(function(e){ return (e.contatos_empresas||[]).length > 0; }).length;
 var countEl = document.getElementById('emp-count');
 if (countEl) countEl.textContent = allData.length + ' registros';

 var tbody = document.getElementById('emp-tbody');
 if (!tbody) return;

 var colors = ['#1B1B8F','#28b548','#e07b00','#8957E5','#1f7ec4','#c44b1f','#0f766e','#9c27b0'];
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
   + ' data-setor="'+cats.join(',').toLowerCase()+'">'
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

 var colors = ['#1B1B8F','#28b548','#e07b00','#8957E5','#1f7ec4','#c44b1f','#0f766e','#9c27b0'];
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
  fase_ciclo_vida: (document.getElementById('sp-emp-fase')    || {}).value.trim() || null,
  categoria:       ((document.getElementById('sp-emp-categoria') || {}).value || '').split(',').map(function(s){ return s.trim(); }).filter(Boolean),
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
 var tabs = ['empresas', 'contatos', 'fornecedores'];
 tabs.forEach(function(t) {
  var panel = document.getElementById('tab-panel-' + t);
  if (panel) panel.style.display = (t === tab) ? 'block' : 'none';
 });

 var btns = {
  'empresas':    document.getElementById('tab-emp-btn'),
  'contatos':    document.getElementById('tab-ctt-btn'),
  'fornecedores':document.getElementById('tab-forn-btn')
 };
 Object.keys(btns).forEach(function(k) {
  var b = btns[k];
  if (!b) return;
  var active = (k === tab);
  b.style.color       = active ? 'var(--navy)' : 'var(--muted)';
  b.style.borderBottom = active ? '2px solid var(--navy)' : '2px solid transparent';
 });

 document.getElementById('btn-nova-empresa').style.display    = (tab === 'empresas')    ? 'inline-flex' : 'none';
 document.getElementById('btn-novo-contato').style.display    = (tab === 'contatos')    ? 'inline-flex' : 'none';
 document.getElementById('btn-novo-fornecedor').style.display = (tab === 'fornecedores') ? 'inline-flex' : 'none';

 if (tab === 'fornecedores') _renderFornecedores();
}

// ── Fornecedores (estado local + localStorage) ────────────────────────────────
var _fornecedoresArr = (function(){
 try {
  var saved = localStorage.getItem('milatec-fornecedores');
  if (saved) return JSON.parse(saved);
 } catch(e){}
 return [];
})();
var _fornProdutoCount = 0;
var _editingFornId    = null;

function _saveFornecedores() {
 try { localStorage.setItem('milatec-fornecedores', JSON.stringify(_fornecedoresArr)); } catch(e){}
}

function _renderFornecedores() {
 var tbody = document.getElementById('forn-tbody');
 var count = document.getElementById('forn-count');
 var badge = document.getElementById('badge-forn');
 if (!tbody) return;
 if (badge) badge.textContent = _fornecedoresArr.length;
 if (count) count.textContent = _fornecedoresArr.length + ' fornecedor' + (_fornecedoresArr.length !== 1 ? 'es' : '');

 if (_fornecedoresArr.length === 0) {
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--muted);font-size:13px">Nenhum fornecedor cadastrado. Use o botão acima para adicionar.</td></tr>';
  return;
 }

 tbody.innerHTML = _fornecedoresArr.map(function(f, idx) {
  var initials = f.nome.trim().split(/\s+/).slice(0,2).map(function(w){return w[0]||'';}).join('').toUpperCase();
  var bgColors = ['#6366f1','#0891b2','#059669','#d97706','#dc2626'];
  var bg = bgColors[idx % bgColors.length];
  return '<tr>'
   + '<td><div class="nt-avatar" style="background:' + bg + ';font-size:10px;width:26px;height:26px;border-radius:6px">' + initials + '</div></td>'
   + '<td><div style="font-weight:600;font-size:13px;color:var(--text)">' + f.nome + '</div>'
   + (f.email ? '<div style="font-size:11px;color:var(--muted)">' + f.email + '</div>' : '')
   + '</td>'
   + '<td><span class="nt-tag nt-tag-blue" style="font-size:11px">' + (f.setor || '—') + '</span></td>'
   + '<td style="font-size:12px;color:var(--muted)">' + (f.cidade || '—') + (f.estado ? ' · ' + f.estado : '') + '</td>'
   + '<td style="font-size:12px;color:var(--muted)">' + (f.telefone || '—') + '</td>'
   + '<td>'
   + (f.produtos && f.produtos.length
      ? f.produtos.slice(0,2).map(function(p){
          return '<span class="nt-tag nt-tag-gray" style="margin-right:3px;margin-bottom:2px">' + p.nome + ' · R$ ' + Number(p.preco).toLocaleString('pt-BR',{minimumFractionDigits:2}) + '</span>';
        }).join('')
        + (f.produtos.length > 2 ? '<span style="font-size:11px;color:var(--muted)">+' + (f.produtos.length-2) + ' mais</span>' : '')
      : '<span style="color:var(--muted);font-size:12px">Nenhum produto</span>')
   + '</td>'
   + '<td><button class="nt-open-btn" onclick="editFornecedor(\'' + f.id + '\')" style="font-size:11px;color:var(--muted);background:rgba(0,0,0,.06);border:none;border-radius:4px;padding:3px 8px;cursor:pointer;font-weight:500;opacity:0;transition:opacity .12s">Editar</button></td>'
   + '</tr>';
 }).join('');
}

function openNovoFornecedor() {
 _editingFornId = null;
 _fornProdutoCount = 0;
 document.getElementById('fn-nome').value = '';
 document.getElementById('fn-setor').value = '';
 document.getElementById('fn-cidade').value = '';
 document.getElementById('fn-estado').value = '';
 document.getElementById('fn-endereco').value = '';
 document.getElementById('fn-tel').value = '';
 document.getElementById('fn-email').value = '';
 document.getElementById('fn-produtos-list').innerHTML = '';
 addFornProdutoLinha(); // começa com uma linha vazia
 document.getElementById('modal-novo-fornecedor').classList.add('open');
}

function editFornecedor(id) {
 var f = _fornecedoresArr.find(function(x){return x.id === id;});
 if (!f) return;
 _editingFornId = id;
 _fornProdutoCount = 0;
 document.getElementById('fn-nome').value     = f.nome || '';
 document.getElementById('fn-setor').value    = f.setor || '';
 document.getElementById('fn-cidade').value   = f.cidade || '';
 document.getElementById('fn-estado').value   = f.estado || '';
 document.getElementById('fn-endereco').value = f.endereco || '';
 document.getElementById('fn-tel').value      = f.telefone || '';
 document.getElementById('fn-email').value    = f.email || '';
 document.getElementById('fn-produtos-list').innerHTML = '';
 (f.produtos || []).forEach(function(p){ addFornProdutoLinha(p.nome, p.preco); });
 if (!f.produtos || !f.produtos.length) addFornProdutoLinha();
 document.getElementById('modal-novo-fornecedor').classList.add('open');
}

function closeNovoFornecedor() {
 document.getElementById('modal-novo-fornecedor').classList.remove('open');
}

function addFornProdutoLinha(nome, preco) {
 _fornProdutoCount++;
 var id = _fornProdutoCount;
 var line = document.createElement('div');
 line.id = 'fn-prod-' + id;
 line.style.cssText = 'display:grid;grid-template-columns:1fr 130px 32px;gap:6px;align-items:center';
 line.innerHTML =
  '<input type="text" id="fn-prod-nome-' + id + '" placeholder="Nome do produto..." value="' + (nome||'') + '" style="border:1px solid var(--border);border-radius:6px;padding:7px 10px;background:var(--surface);color:var(--text);font-size:13px;outline:none;font-family:inherit;width:100%;box-sizing:border-box">'
  + '<input type="number" id="fn-prod-preco-' + id + '" placeholder="Preço (R$)" value="' + (preco||'') + '" min="0" step="0.01" style="border:1px solid var(--border);border-radius:6px;padding:7px 10px;background:var(--surface);color:var(--text);font-size:13px;outline:none;font-family:inherit;width:100%;box-sizing:border-box;text-align:right">'
  + '<button onclick="document.getElementById(\'fn-prod-' + id + '\').remove()" style="border:none;background:none;cursor:pointer;color:var(--muted);font-size:18px;line-height:1;padding:0;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:5px" title="Remover">&times;</button>';
 document.getElementById('fn-produtos-list').appendChild(line);
 line.querySelector('input[type="text"]').focus();
}

function submitNovoFornecedor() {
 var nome = (document.getElementById('fn-nome').value || '').trim();
 if (!nome) { document.getElementById('fn-nome').focus(); return; }

 // Coleta produtos
 var produtos = [];
 document.querySelectorAll('#fn-produtos-list > [id^="fn-prod-"]').forEach(function(line) {
  var lid   = line.id.replace('fn-prod-', '');
  var nomeEl  = document.getElementById('fn-prod-nome-'  + lid);
  var precoEl = document.getElementById('fn-prod-preco-' + lid);
  var pNome   = nomeEl  ? nomeEl.value.trim()                          : '';
  var pPreco  = precoEl ? (parseFloat(precoEl.value) || 0)             : 0;
  if (pNome) produtos.push({ nome: pNome, preco: pPreco });
 });

 var payload = {
  id:       _editingFornId || ('forn-' + Date.now()),
  nome:     nome,
  setor:    document.getElementById('fn-setor').value.trim(),
  cidade:   document.getElementById('fn-cidade').value.trim(),
  estado:   document.getElementById('fn-estado').value.trim().toUpperCase(),
  endereco: document.getElementById('fn-endereco').value.trim(),
  telefone: document.getElementById('fn-tel').value.trim(),
  email:    document.getElementById('fn-email').value.trim(),
  produtos: produtos
 };

 if (_editingFornId) {
  var idx = _fornecedoresArr.findIndex(function(x){return x.id === _editingFornId;});
  if (idx >= 0) _fornecedoresArr[idx] = payload;
 } else {
  _fornecedoresArr.push(payload);
 }

 _saveFornecedores();
 _renderFornecedores();
 closeNovoFornecedor();
}

/* --- EMPRESAS FILTER --- */
function toggleEmpFilterPanel() {
 _empPanelOpen = !_empPanelOpen;
 document.getElementById('emp-filter-panel').style.display = _empPanelOpen ? 'block' : 'none';
 if (_empPanelOpen && _empConditions.length === 0) addEmpCondition();
}

function addEmpCondition() {
 var id = ++_empCondId;
 var firstKey = Object.keys(_empCampos)[0];
 _empConditions.push({ id: id, field: firstKey, op: 'contains', value: '' });
 _renderEmpConditions();
}

function _condEmpChange(el) {
 var id = +el.dataset.cid;
 var key = el.dataset.key;
 var cond = _empConditions.find(function(c){ return c.id === id; });
 if (!cond) return;
 cond[key] = el.value;
 if (key === 'field') { cond.op = 'contains'; cond.value = ''; }
 if (key === 'op' && (el.value === 'is_empty' || el.value === 'is_not_empty')) cond.value = '';
 _renderEmpConditions();
}

function _condEmpRemove(id) {
 _empConditions = _empConditions.filter(function(c){ return c.id !== id; });
 _renderEmpConditions();
}

function _renderEmpConditions() {
 var container = document.getElementById('emp-filter-conditions');
 if (!container) return;
 var ss = 'border:1px solid var(--border);border-radius:6px;font-size:12px;padding:5px 8px;background:var(--surface);color:var(--text);outline:none';
 var html = _empConditions.map(function(cond) {
 var campo = _empCampos[cond.field] || {};
 var tipo = campo.type || 'text';
 var opsArr = _empCttOps[tipo] || _empCttOps.text;
 var needsVal = cond.op !== 'is_empty' && cond.op !== 'is_not_empty';
 var campoSel = '<select style="' + ss + '" data-cid="' + cond.id + '" data-key="field" onchange="_condEmpChange(this)">';
 Object.keys(_empCampos).forEach(function(k) {
 campoSel += '<option value="' + k + '"' + (cond.field === k ? ' selected' : '') + '>' + _empCampos[k].label + '</option>';
 });
 campoSel += '</select>';
 var opSel = '<select style="' + ss + '" data-cid="' + cond.id + '" data-key="op" onchange="_condEmpChange(this)">';
 opsArr.forEach(function(o) {
 opSel += '<option value="' + o.val + '"' + (cond.op === o.val ? ' selected' : '') + '>' + o.label + '</option>';
 });
 opSel += '</select>';
 var valEl = '';
 if (needsVal) {
 if (tipo === 'select' && campo.opts) {
 valEl = '<select style="' + ss + ';flex:1" data-cid="' + cond.id + '" data-key="value" onchange="_condEmpChange(this)">';
 valEl += '<option value="">— selecione —</option>';
 campo.opts.forEach(function(opt) {
 valEl += '<option value="' + opt + '"' + (cond.value === opt ? ' selected' : '') + '>' + opt + '</option>';
 });
 valEl += '</select>';
 } else {
 valEl = '<input type="text" placeholder="valor..." value="' + (cond.value || '') + '" style="' + ss + ';flex:1" data-cid="' + cond.id + '" data-key="value" oninput="_condEmpChange(this)">';
 }
 }
 return '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">' +
 campoSel + opSel + valEl +
 '<button onclick="_condEmpRemove(' + cond.id + ')" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:16px;line-height:1;padding:0 4px">×</button>' +
 '</div>';
 }).join('');
 container.innerHTML = html;
}

function filterEmpresas() {
 var searchEl = document.getElementById('emp-search');
 var q = searchEl ? searchEl.value.toLowerCase() : '';
 var rows = document.querySelectorAll('#emp-tbody tr');
 rows.forEach(function(tr) {
 var matchSearch = !q || tr.textContent.toLowerCase().includes(q);
 var matchConds = _empConditions.every(function(cond) {
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
 var count = _empConditions.length;
 var countEl = document.getElementById('emp-filter-count');
 if (countEl) { countEl.textContent = count ? count + ' filtro(s) ativo(s)' : ''; countEl.style.display = count ? 'inline' : 'none'; }
}

function limparEmpFiltros() {
 _empConditions = []; _empCondId = 0;
 _renderEmpConditions();
 filterEmpresas();
 var countEl = document.getElementById('emp-filter-count');
 if (countEl) { countEl.style.display = 'none'; }
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
var _empCampos = {
 'nome': { label: 'Empresa', type: 'text' },
 'setor': { label: 'Setor', type: 'select', opts: ['Construtoras','Incorporadoras','Indústria','Governo','Arquitetura'] },
 'tipo': { label: 'Tipo', type: 'select', opts: ['Cliente','Parceiro','Fornecedor','Lead'] },
 'fase': { label: 'Fase', type: 'select', opts: ['Prospect','Qualificado','Proposta','Negociação','Fechado'] },
 'cidade': { label: 'Cidade', type: 'text' },
 'estado': { label: 'Estado', type: 'select', opts: ['SP','DF','GO','MG','PR','RJ'] }
};
var _cttCampos = {
 'nome': { label: 'Nome', type: 'text' },
 'cargo': { label: 'Cargo', type: 'text' },
 'perfil': { label: 'Perfil', type: 'select', opts: ['Decisor','Técnico','Financeiro','Operacional'] },
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
var _empConditions = []; var _empCondId = 0;
var _cttConditions = []; var _cttCondId = 0;
var _empPanelOpen = false; var _cttPanelOpen = false;
