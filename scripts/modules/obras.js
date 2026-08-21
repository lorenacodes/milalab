// ═══════════════════════════════════════════════════════════════════════════════
// OBRAS — cache/loaders, kanban (+ DnD), painel lateral específico de Obra
// (documentos, abas, salvar, empresa/contato inline), Calculadora Modular.
// ═══════════════════════════════════════════════════════════════════════════════
function _spObras(row, tds) {
 // A tabela/kanban de Obras sempre grava data-id nas linhas reais
 // (_dbLoadObras/_dbLoadObrasKanban) — a única linha sem id é o placeholder
 // estático "Carregando obras..." (index.html), que não tem onclick, então
 // este caminho nunca via um fallback sem id na prática.
 _spObraById(row.dataset.id);
}

// ── Calculadora Modular ──────────────────────────────────────────────────

var _mcGrupos = ['Estrutura','Isolamento','Revestimento externo','Revestimento interno','Piso','Portas e janelas','Ar condicionado','Hidroelétrica','Cobertura'];

function _mcBuild(obraId) {
 const dims = ['Parede externa (m²)','Parede interna (m²)','Piso (m²)','Cobertura (m²)'];
 const dimIds = ['mc-pext','mc-pint','mc-piso','mc-cob'];
 let html = '<div class="mc-dims">';
 dims.forEach((d,i) => {
  html += `<div class="mc-dim-box"><div class="mc-dim-label">${d}</div><input class="mc-dim-inp" id="${dimIds[i]}" type="number" value="0" min="0" oninput="_mcCalc('${obraId}')"></div>`;
 });
 html += '</div>';
 // Grupos
 _mcGrupos.forEach(g => {
  const itens = _mcTpl.filter(it => it.g === g);
  if (!itens.length) return;
  const gid = 'mc-g-' + g.replace(/\s+/g,'_');
  html += `<div class="mc-group" id="${gid}">`;
  html += `<div class="mc-group-head" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'':'none'">`;
  html += `<span class="mc-group-name">${g}</span><span class="mc-group-sum" id="${gid}-sum">R$ 0,00</span></div>`;
  html += '<div class="mc-rows">';
  html += '<div class="mc-row" style="font-size:10px;color:var(--muted);font-weight:600"><span>Item</span><span style="text-align:right">Qtd</span><span style="text-align:right">V.Unit</span><span style="text-align:right">Total</span></div>';
  itens.forEach((it, idx) => {
   const iid = gid + '_' + idx;
   const brl = (it.vl||0).toLocaleString('pt-BR',{minimumFractionDigits:2});
   html += `<div class="mc-row">`;
   html += `<span class="mc-desc" title="${it.d}">${it.d.substring(0,40)}${it.d.length>40?'...':''}</span>`;
   html += `<input class="mc-inp" id="${iid}-qtd" type="number" value="${it.qtd||''}" min="0" placeholder="0" oninput="_mcCalc('${obraId}')">`;
   html += `<input class="mc-inp" id="${iid}-vl" type="number" value="${it.vl||0}" min="0" placeholder="0" oninput="_mcCalc('${obraId}')">`;
   html += `<span class="mc-vt" id="${iid}-vt">—</span>`;
   html += '</div>';
  });
  html += '</div></div>';
 });
 html += '<div class="mc-grand"><span class="mc-grand-lbl">TOTAL GERAL</span><span class="mc-grand-val" id="mc-total">R$ 0,00</span></div>';
 html += '<div style="display:flex;gap:8px;margin-top:10px">';
 html += '<button class="mc-save-btn" style="flex:1" onclick="_mcSave(\'' + obraId + '\')">Salvar orçamento</button>';
 html += '<button class="mc-save-btn" style="flex:1;background:var(--navy)" onclick="_mcOpenPrint(\'' + obraId + '\')">Imprimir orçamento</button>';
 html += '</div>';
 html += '<button onclick="_mcDbOpen()" style="width:100%;margin-top:6px;padding:6px;background:none;border:1px dashed var(--border);border-radius:6px;font-size:11px;color:var(--muted);cursor:pointer">Gerenciar database de materiais</button>';
 return html;
}

function _mcCalc(obraId) {
 const pext = parseFloat(document.getElementById('mc-pext')?.value) || 0;
 const pint = parseFloat(document.getElementById('mc-pint')?.value) || 0;
 const piso = parseFloat(document.getElementById('mc-piso')?.value) || 0;
 const cob  = parseFloat(document.getElementById('mc-cob')?.value) || 0;

 // Auto-preencher dimensões para itens específicos
 const autoQtd = {
  'Estrutura 100% LSF': (pext + pint) * 25,
  'Manta Hidrófuga Walwrap - 52,5 m²': Math.ceil((pext + pint + cob) / 52.5 * 10) / 10,
  'Lã de pet': pint,
  'Revestimento em Thermo Siding': pext,
  'Painel Sol PVC': pint,
  'ETERNIT ETERPISO 15MM': piso,
  'Rodapé em Poliestireno na Cor Preta': Math.round((piso > 0 ? Math.sqrt(piso) * 4 : 0) * 10) / 10,
  'Telha Semi-sanduíche': cob,
 };

 let grandTotal = 0;
 _mcGrupos.forEach(g => {
  const itens = _mcTpl.filter(it => it.g === g);
  let gSum = 0;
  const gid = 'mc-g-' + g.replace(/\s+/g,'_');
  itens.forEach((it, idx) => {
   const iid = gid + '_' + idx;
   const qtdEl = document.getElementById(iid + '-qtd');
   const vlEl  = document.getElementById(iid + '-vl');
   const vtEl  = document.getElementById(iid + '-vt');
   if (!qtdEl || !vlEl || !vtEl) return;
   // Auto-fill if qtd is empty and auto rule exists
   for (const [key, val] of Object.entries(autoQtd)) {
    if (it.d.startsWith(key) && (qtdEl.value === '' || qtdEl.value === '0')) {
     qtdEl.value = val > 0 ? val.toFixed(1) : '';
     break;
    }
   }
   const qtd = parseFloat(qtdEl.value) || 0;
   const vl  = parseFloat(vlEl.value) || 0;
   const vt  = qtd * vl;
   vtEl.textContent = vt > 0 ? vt.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : '—';
   gSum += vt;
  });
  const gSumEl = document.getElementById(gid + '-sum');
  if (gSumEl) gSumEl.textContent = gSum.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  grandTotal += gSum;
 });
 const tot = document.getElementById('mc-total');
 if (tot) tot.textContent = grandTotal.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
}

async function _mcSave(obraId) {
 const btn = document.querySelector('.mc-save-btn');
 if (!_sb) { _showToast('Sem conexão com o banco.', 'erro'); return; }

 const dims = {
  parede_externa_m2: parseFloat(document.getElementById('mc-pext')?.value) || 0,
  parede_interna_m2: parseFloat(document.getElementById('mc-pint')?.value) || 0,
  piso_m2:           parseFloat(document.getElementById('mc-piso')?.value) || 0,
  cobertura_m2:      parseFloat(document.getElementById('mc-cob')?.value)  || 0,
 };

 // Upsert do cabeçalho (dimensões) — memorial_calculo_obras.obra_id é UNIQUE
 const up = await _sb.from('memorial_calculo_obras').upsert(
  Object.assign({ obra_id: obraId }, dims), { onConflict: 'obra_id' }
 ).select('id').single();
 if (up.error) { _showToast('Erro ao salvar orçamento: ' + _supaErrPt(up.error.message), 'erro'); return; }
 const memorialId = up.data.id;

 // Itens: substitui tudo (delete-then-insert), mesmo padrão de outras
 // relações N:1 editadas em bloco neste sistema (_syncAtividadeVinculos).
 const itens = [];
 _mcGrupos.forEach(g => {
  const grupoItens = _mcTpl.filter(it => it.g === g);
  const gid = 'mc-g-' + g.replace(/\s+/g,'_');
  grupoItens.forEach((it, idx) => {
   const qtd = document.getElementById(gid+'_'+idx+'-qtd')?.value;
   const vl  = document.getElementById(gid+'_'+idx+'-vl')?.value;
   itens.push({
    memorial_id: memorialId, template_item_id: it.id || null, grupo: g,
    descricao: it.d, posicao_no_grupo: idx,
    quantidade: parseFloat(qtd) || 0, valor_unitario: parseFloat(vl) || 0,
   });
  });
 });
 const delItens = await _sb.from('memorial_calculo_itens').delete().eq('memorial_id', memorialId);
 if (delItens.error) { _showToast('Dimensões salvas, mas houve erro ao atualizar os itens: ' + _supaErrPt(delItens.error.message), 'erro'); return; }
 if (itens.length) {
  const insItens = await _sb.from('memorial_calculo_itens').insert(itens);
  if (insItens.error) { _showToast('Dimensões salvas, mas houve erro ao gravar os itens: ' + _supaErrPt(insItens.error.message), 'erro'); return; }
 }

 if (btn) { btn.textContent = 'Salvo!'; btn.style.background='var(--navy)'; setTimeout(() => { btn.textContent='Salvar orçamento'; btn.style.background=''; }, 1800); }
}

async function _mcLoad(obraId) {
 if (!_sb) { _mcCalc(obraId); return; }
 const memRes = await _sb.from('memorial_calculo_obras').select('*').eq('obra_id', obraId).maybeSingle();
 if (memRes.error || !memRes.data) { _mcCalc(obraId); return; }
 const mem = memRes.data;
 const dimMap = { 'mc-pext': mem.parede_externa_m2, 'mc-pint': mem.parede_interna_m2, 'mc-piso': mem.piso_m2, 'mc-cob': mem.cobertura_m2 };
 Object.entries(dimMap).forEach(([id, v]) => { const el = document.getElementById(id); if (el && v != null) el.value = v; });

 const itensRes = await _sb.from('memorial_calculo_itens').select('*').eq('memorial_id', mem.id);
 if (!itensRes.error && itensRes.data) {
  itensRes.data.forEach(function(item) {
   const gid = 'mc-g-' + item.grupo.replace(/\s+/g,'_');
   const qtdEl = document.getElementById(gid+'_'+item.posicao_no_grupo+'-qtd');
   const vlEl  = document.getElementById(gid+'_'+item.posicao_no_grupo+'-vl');
   if (qtdEl && item.quantidade != null) qtdEl.value = item.quantidade;
   if (vlEl  && item.valor_unitario != null) vlEl.value = item.valor_unitario;
  });
 }
 _mcCalc(obraId);
}

// ── MC Database init — catálogo de materiais e template padrão vêm do
// Supabase (materiais_catalogo / memorial_calculo_template), não mais de
// localStorage. Mantém os nomes curtos (g/sg/cod/d/vl/un/qtd/sup) usados por
// todo o resto deste arquivo — só a carga/persistência mudou de lugar.
var _mcDb  = null;
var _mcTpl = null;
var _mcTplDeletedIds = []; // ids removidos do template desde o último "Salvar alterações"
var _mcDbInitPromise = null;
function _mcCatalogoToShort(r)  { return { id: r.id, g: r.grupo, sg: r.subgrupo || '', cod: r.codigo || '', d: r.descricao, vl: r.valor_unitario }; }
function _mcTemplateToShort(r)  { return { id: r.id, g: r.grupo, d: r.descricao, un: r.unidade || '', qtd: r.quantidade_padrao, vl: r.valor_unitario || 0, sup: r.fornecimento || '' }; }
function _mcDbInit() {
 if (_mcDbInitPromise) return _mcDbInitPromise;
 _mcDbInitPromise = (async function() {
  if (!_sb) { _mcDb = []; _mcTpl = []; return; }
  var [catRes, tplRes] = await Promise.all([
   _sb.from('materiais_catalogo').select('*').order('grupo'),
   _sb.from('memorial_calculo_template').select('*').order('ordem'),
  ]);
  _mcDb  = catRes.error ? [] : catRes.data.map(_mcCatalogoToShort);
  _mcTpl = tplRes.error ? [] : tplRes.data.map(_mcTemplateToShort);
  if (catRes.error) console.error('[MC] erro ao carregar catálogo de materiais:', catRes.error);
  if (tplRes.error) console.error('[MC] erro ao carregar template do memorial:', tplRes.error);
 })();
 return _mcDbInitPromise;
}

// ── Database Modal ────────────────────────────────────────────────
var _mcDbTab = 'template';
function _mcDbOpen() {
 _mcDbTab = 'template';
 document.getElementById('mc-db-tab-tpl').classList.add('active');
 document.getElementById('mc-db-tab-cat').classList.remove('active');
 document.getElementById('mc-db-search-inp').value = '';
 document.getElementById('mc-db-add-btn').style.display = '';
 _mcDbRender();
 document.getElementById('mc-db-overlay').classList.add('open');
}
function _mcDbClose() {
 document.getElementById('mc-db-overlay').classList.remove('open');
}
function _mcDbSwitchTab(tab) {
 _mcDbTab = tab;
 document.getElementById('mc-db-tab-tpl').classList.toggle('active', tab==='template');
 document.getElementById('mc-db-tab-cat').classList.toggle('active', tab==='catalogo');
 document.getElementById('mc-db-add-btn').style.display = tab==='template' ? '' : 'none';
 document.getElementById('mc-db-search-inp').value = '';
 _mcDbRender();
}
function _mcDbRender() {
 const q = (document.getElementById('mc-db-search-inp')?.value||'').toLowerCase();
 const src = _mcDbTab === 'template' ? _mcTpl : _mcDb;
 const items = q ? src.filter(it => (it.d+it.g+(it.cod||'')).toLowerCase().includes(q)) : src;
 let html = '<table class="mc-db-table"><thead><tr>';
 html += '<th>Grupo</th>';
 if (_mcDbTab === 'catalogo') html += '<th>Cód.</th>';
 if (_mcDbTab === 'template') html += '<th>Un.</th>';
 html += '<th>Descrição</th>';
 if (_mcDbTab === 'template') html += '<th>Qtd. padrão</th>';
 html += '<th class="mc-db-vl">V. Unit. (R$)</th><th style="width:40px"></th></tr></thead><tbody>';
 items.forEach((it, i) => {
  const realIdx = src.indexOf(it);
  html += `<tr class="${_mcDbTab==='catalogo'?'mc-db-catalog-row':''}">`;
  html += `<td><input class="mc-db-editable" value="${(it.g||'').replace(/"/g,'&quot;')}" onchange="_mcDbEdit(${realIdx},'g',this.value)"></td>`;
  if (_mcDbTab === 'catalogo') html += `<td style="width:60px;color:var(--muted)">${it.cod||''}</td>`;
  if (_mcDbTab === 'template') html += `<td style="width:50px"><input class="mc-db-editable" value="${(it.un||'').replace(/"/g,'&quot;')}" onchange="_mcDbEdit(${realIdx},'un',this.value)"></td>`;
  html += `<td style="min-width:180px"><input class="mc-db-editable" value="${(it.d||'').replace(/"/g,'&quot;')}" onchange="_mcDbEdit(${realIdx},'d',this.value)"></td>`;
  if (_mcDbTab === 'template') html += `<td class="mc-db-vl"><input class="mc-db-editable" type="number" style="text-align:right" value="${it.qtd??''}" onchange="_mcDbEdit(${realIdx},'qtd',this.value)"></td>`;
  html += `<td class="mc-db-vl"><input class="mc-db-editable" type="number" style="text-align:right" value="${it.vl??0}" onchange="_mcDbEdit(${realIdx},'vl',this.value)"></td>`;
  if (_mcDbTab === 'template') {
   html += `<td><button class="mc-db-del-btn" onclick="_mcDbDelete(${realIdx})" title="Remover">×</button></td>`;
  } else {
   html += `<td><button style="font-size:10px;padding:2px 6px;background:var(--navy);color:#fff;border:none;border-radius:4px;cursor:pointer;white-space:nowrap" onclick="_mcDbAddToTpl(${realIdx})" title="Adicionar ao template">+ tpl</button></td>`;
  }
  html += '</tr>';
 });
 html += '</tbody></table>';
 if (items.length === 0) html = '<div style="padding:32px;text-align:center;color:var(--muted);font-size:13px">Nenhum item encontrado</div>';
 document.getElementById('mc-db-body').innerHTML = html;
}
function _mcDbEdit(idx, field, val) {
 const src = _mcDbTab === 'template' ? _mcTpl : _mcDb;
 if (!src[idx]) return;
 if (field === 'vl' || field === 'qtd') src[idx][field] = parseFloat(val)||0;
 else src[idx][field] = val;
}
function _mcDbDelete(idx) {
 if (!confirm('Remover este item do template?')) return;
 var removed = _mcTpl.splice(idx, 1)[0];
 if (removed && removed.id) _mcTplDeletedIds.push(removed.id);
 _mcDbRender();
}
function _mcDbAddToTpl(catalogIdx) {
 const it = _mcDb[catalogIdx];
 if (!it) return;
 const grupo = prompt('Grupo no template (ex: Estrutura, Piso...):', it.g||'');
 if (!grupo) return;
 _mcTpl.push({g: grupo, d: it.d, un: '', qtd: null, vl: it.vl, sup: 'comprar'});
 _mcDbSwitchTab('template');
}
function _mcDbAddRow() {
 _mcTpl.push({g: 'Novo grupo', d: 'Novo item', un: 'un', qtd: 1, vl: 0, sup: 'comprar'});
 _mcDbRender();
 // Scroll to bottom
 const body = document.getElementById('mc-db-body');
 if (body) body.scrollTop = body.scrollHeight;
}
async function _mcDbPersist() {
 const btn = event.target;
 if (!_sb) { _showToast('Sem conexão com o banco.', 'erro'); return; }
 var erro = null;

 // Catálogo (materiais_catalogo) — só edição de itens já existentes (a UI não
 // permite adicionar/remover linhas na aba Catálogo, só na aba Template).
 for (var i = 0; i < _mcDb.length && !erro; i++) {
  var c = _mcDb[i];
  if (!c.id) continue;
  var upC = await _sb.from('materiais_catalogo').update({ grupo: c.g, subgrupo: c.sg || null, codigo: c.cod || null, descricao: c.d, valor_unitario: c.vl }).eq('id', c.id);
  if (upC.error) erro = upC.error;
 }

 // Template — remove os apagados, atualiza os existentes, insere os novos
 // (linhas adicionadas via "+ tpl" ou "Adicionar item" ainda não têm id).
 if (!erro && _mcTplDeletedIds.length) {
  var delT = await _sb.from('memorial_calculo_template').delete().in('id', _mcTplDeletedIds);
  if (delT.error) erro = delT.error; else _mcTplDeletedIds = [];
 }
 for (var j = 0; j < _mcTpl.length && !erro; j++) {
  var t = _mcTpl[j];
  var payload = { grupo: t.g, descricao: t.d, unidade: t.un || null, quantidade_padrao: t.qtd, valor_unitario: t.vl || 0, fornecimento: t.sup || null, ordem: j };
  if (t.id) {
   var upT = await _sb.from('memorial_calculo_template').update(payload).eq('id', t.id);
   if (upT.error) erro = upT.error;
  } else {
   var insT = await _sb.from('memorial_calculo_template').insert(payload).select('id').single();
   if (insT.error) erro = insT.error; else t.id = insT.data.id;
  }
 }

 if (erro) {
  _showToast('Erro ao salvar alterações: ' + _supaErrPt(erro.message), 'erro');
  return;
 }
 btn.textContent = 'Salvo!'; btn.style.background='var(--green)';
 setTimeout(() => { btn.textContent='Salvar alterações'; btn.style.background=''; }, 1800);
}

// ── Orçamento Modular Print ───────────────────────────────────────
function _mcOpenPrint(obraId) {
 // Collect current state from DOM
 const pext = document.getElementById('mc-pext')?.value||'0';
 const pint = document.getElementById('mc-pint')?.value||'0';
 const piso = document.getElementById('mc-piso')?.value||'0';
 const cob  = document.getElementById('mc-cob')?.value||'0';
 // Collect obra name + empresa from side panel
 const obraName  = document.getElementById('sp-title')?.textContent||obraId;
 const empresa   = document.getElementById('sp-emp')?.value||'—';
 const hoje = new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'});
 // Build groups
 const grupos = {};
 const grupoTotals = {};
 let grand = 0;
 _mcGrupos.forEach(g => {
  const itens = _mcTpl.filter(it => it.g === g);
  if (!itens.length) return;
  const gid = 'mc-g-' + g.replace(/\s+/g,'_');
  const rows = [];
  let gSum = 0;
  itens.forEach((it, idx) => {
   const qtd = parseFloat(document.getElementById(gid+'_'+idx+'-qtd')?.value)||0;
   const vl  = parseFloat(document.getElementById(gid+'_'+idx+'-vl')?.value)||0;
   const vt  = qtd * vl;
   if (qtd > 0 || vl > 0) {
    rows.push({d: it.d, un: it.un||'', qtd, vl, vt});
    gSum += vt;
   }
  });
  if (rows.length) { grupos[g] = rows; grupoTotals[g] = gSum; grand += gSum; }
 });
 const brl = v => v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 let html = `
  <div class="orc-mod-header">
   <div>
    <div class="orc-mod-logo">MILA<span>TEC</span></div>
    <div style="font-size:11px;color:#555;margin-top:2px">Soluções em Light Steel Frame e Modular</div>
   </div>
   <div class="orc-mod-meta">
    <strong>ORÇAMENTO MODULAR</strong>
    <span>${hoje}</span>
   </div>
  </div>
  <div class="orc-mod-parties">
   <div><div class="orc-mod-party-label">Contratada</div><div class="orc-mod-party-val">MilaTec Indústria</div></div>
   <div><div class="orc-mod-party-label">Cliente / Obra</div><div class="orc-mod-party-val">${empresa}<br><span style="font-weight:400;font-size:12px">${obraName}</span></div></div>
  </div>
  <div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">Dimensões informadas</div>
  <div class="orc-mod-dims">
   <div class="orc-mod-dim-box"><div class="orc-mod-dim-label">Parede externa</div><div class="orc-mod-dim-val">${parseFloat(pext).toFixed(1)} m²</div></div>
   <div class="orc-mod-dim-box"><div class="orc-mod-dim-label">Parede interna</div><div class="orc-mod-dim-val">${parseFloat(pint).toFixed(1)} m²</div></div>
   <div class="orc-mod-dim-box"><div class="orc-mod-dim-label">Piso</div><div class="orc-mod-dim-val">${parseFloat(piso).toFixed(1)} m²</div></div>
   <div class="orc-mod-dim-box"><div class="orc-mod-dim-label">Cobertura</div><div class="orc-mod-dim-val">${parseFloat(cob).toFixed(1)} m²</div></div>
  </div>`;
 Object.entries(grupos).forEach(([g, rows]) => {
  html += `<div class="orc-mod-section">`;
  html += `<div class="orc-mod-section-head"><span>${g}</span><span>${brl(grupoTotals[g])}</span></div>`;
  html += `<div class="orc-mod-item orc-mod-item-head"><span>Descrição</span><span style="text-align:center">Qtd</span><span style="text-align:right">V.Unit</span><span style="text-align:right">Total</span></div>`;
  rows.forEach(r => {
   html += `<div class="orc-mod-item">`;
   html += `<span>${r.d}</span>`;
   html += `<span style="text-align:center">${r.qtd % 1 === 0 ? r.qtd : r.qtd.toFixed(1)} ${r.un}</span>`;
   html += `<span style="text-align:right">${brl(r.vl)}</span>`;
   html += `<span style="text-align:right;font-weight:600">${brl(r.vt)}</span>`;
   html += '</div>';
  });
  html += '</div>';
 });
 html += `<div class="orc-mod-grand"><span class="orc-mod-grand-label">TOTAL DO ORÇAMENTO</span><span class="orc-mod-grand-val">${brl(grand)}</span></div>`;
 html += `<div style="margin-top:32px;font-size:10px;color:#888;text-align:center">Este orçamento é válido por 30 dias. MilaTec Indústria — CNPJ 00.000.000/0001-00</div>`;
 document.getElementById('orc-mod-body').innerHTML = html;
 document.getElementById('modal-orcamento-modular').classList.add('open');
}
function _mcPrintNow() { window.print(); }

var _tipoClsBd = {
 'Telhados':'bg','Steel Frame':'bp','Modular':'bb','Solar':'by','Misto (LSF+A36)':'bn'
};
// Cor do badge "Tipo de orçamento" na tabela de Projetos (dentro do
// detalhamento de Obra) — pedido explícito: seguir o mesmo padrão de cores
// de categoria (verde/roxo/azul/amarelo), com laranja pra qualquer valor
// fora dos 4 conhecidos (ex.: "Misto (LSF + A36)", que só tem 1 registro
// real e grafia inconsistente com _tipoClsBd — não vale a pena mapear à
// parte, laranja já cobre "outro" corretamente).
var _tipoOrcamentoCls = { 'Telhados':'bg', 'Steel Frame':'bp', 'Modular':'bb', 'Solar':'by' };
function _tipoOrcamentoBadgeCls(tipo) { return _tipoOrcamentoCls[tipo] || 'bo'; }
var _etapaClsBd = {
 'Orçamento':'bb','Atualização de orçamento':'bb','Follow-up':'by','Negociação':'bp',
 'Aprovação de projeto':'by','Piloto':'bn','Projeto aprovado':'bn','Em Andamento':'bn',
 'Pós-vendas':'bg','Concluído':'bg','Negócio perdido':'br'
};
var _etapaDot = {
 'Orçamento':'var(--blue)','Atualização de orçamento':'var(--blue)','Follow-up':'var(--yellow)',
 'Negociação':'var(--purple)','Aprovação de projeto':'var(--yellow)','Piloto':'var(--navy)',
 'Projeto aprovado':'var(--navy)','Em Andamento':'var(--navy)','Pós-vendas':'var(--green)',
 'Concluído':'var(--green)','Negócio perdido':'var(--red)'
};
var _etapaKcId = {
 'Orçamento':'kc-orcamento','Atualização de orçamento':'kc-atualizacao','Follow-up':'kc-followup',
 'Negociação':'kc-negociacao','Aprovação de projeto':'kc-aprovacao-projeto','Piloto':'kc-piloto',
 'Projeto aprovado':'kc-projeto-aprovado','Em Andamento':'kc-andamento','Pós-vendas':'kc-posvendas',
 'Concluído':'kc-concluido','Negócio perdido':'kc-perdido'
};

// Vocabulário real de canal_vendas (não um enum de marketing — é quase texto
// livre: nome de representante, campanha pontual). Ordenado pela distribuição
// real no banco (select canal_vendas, count(*) from obras group by 1 order
// by 2 desc), pra opção mais comum aparecer primeiro na busca.
var CANAL_VENDAS_OPCOES = [
 'Inbound (cliente recorrente)', 'Inbound (Indicação de clientes)', 'Rep. Hooberdan - Aragão',
 'Outbound (prospecção ativa)', 'Rep. Jorge - Mauá', 'Rep. Maurício - Mautti', 'FICONS 2024',
 'Outbound (feiras)', 'Inbound (cliente inativo)', 'Inbound (social media)', 'Rep. Marcos - CE',
 'Outbound (cliente inativo)', 'Representante comercial', 'Rep. Luiz - PB', 'Rep. Pedro - MA',
];

// Lista fechada das 27 UFs — diferente de canal/cidade, aqui não existe
// "opção nova" de verdade (é geografia do Brasil), então não precisa de
// "creatable" nem de defender contra um valor fora da lista.
var UF_BRASIL = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

// Cache das cidades já usadas em Obras (~205 valores distintos hoje, cresce
// com o tempo — cada obra nova pode trazer uma cidade inédita, por isso o
// campo é "creatable": pesquisa nas já usadas, mas aceita digitar uma nova).
// Carregada 1x (só quando o dropdown de Cidade é aberto pela 1ª vez),
// reaproveitada nas aberturas seguintes do painel — mesmo espírito de
// _cttEmpLinkCache (empresas.js).
var _obraCidadesCache = null;
async function _obraCarregarCidades() {
 if (_obraCidadesCache) return _obraCidadesCache;
 var set = {};
 var from = 0, pageSize = 1000, more = true;
 while (more) {
  var res = await _sb.from('obras').select('cidade').not('cidade', 'is', null).range(from, from + pageSize - 1);
  if (res.error || !res.data || !res.data.length) break;
  res.data.forEach(function(r){ if (r.cidade) set[r.cidade] = true; });
  more = res.data.length === pageSize; from += pageSize;
 }
 _obraCidadesCache = Object.keys(set).sort(function(a,b){ return a.localeCompare(b, 'pt-BR'); });
 return _obraCidadesCache;
}

// Transporte de Entregas: mesmo espírito de Cidade acima (16 valores reais
// hoje — "Mila - 01".."Mila - 08", "Retirada", "Frete Terceirizado" etc. —
// cresce quando um caminhão/frota novo aparece, por isso "creatable" em vez
// de lista fechada). .trim() por causa de "Mila - 03 " (espaço extra real
// no banco) virar duplicata de "Mila - 03" na lista.
var _obraTransporteCache = null;
async function _obraCarregarTransportes() {
 if (_obraTransporteCache) return _obraTransporteCache;
 var set = {};
 var from = 0, pageSize = 1000, more = true;
 while (more) {
  var res = await _sb.from('entregas').select('transporte').not('transporte', 'is', null).range(from, from + pageSize - 1);
  if (res.error || !res.data || !res.data.length) break;
  res.data.forEach(function(r){ var v = (r.transporte||'').trim(); if (v) set[v] = true; });
  more = res.data.length === pageSize; from += pageSize;
 }
 _obraTransporteCache = Object.keys(set).sort(function(a,b){ return a.localeCompare(b, 'pt-BR'); });
 return _obraTransporteCache;
}

function _normObraAssoc(o) {
 // empresa_id/empresa continuam sendo a PRIMEIRA vinculada (compat com todo
 // código pré-existente que só lida com 1 empresa — tabela/kanban, cálculo
 // de ICMS/DIFAL, proposta solar etc.). `empresas` é o array completo (N:N
 // de verdade) usado pelos chips "Empresas vinculadas" no painel da Obra —
 // pedido explícito: uma Obra pode ter mais de uma Empresa.
 o.empresas   = (o.empresas_obras||[]).map(function(l){ return l.empresa; }).filter(Boolean);
 o.empresa_id = (o.empresas_obras||[])[0]?.empresa_id || null;
 o.empresa    = (o.empresas_obras||[])[0]?.empresa    || null;
 // contatos: array completo (N:N de verdade, mesmo espírito de `empresas`
 // acima) — contato_id/contato continuam sendo o PRIMEIRO vinculado, só
 // por compat com código que ainda lida com 1 contato (nenhum resta hoje,
 // mas não custa manter o padrão simétrico ao de empresas).
 o.contatos   = (o.contatos_obras||[]).map(function(l){ return l.contato; }).filter(Boolean);
 o.contato_id = (o.contatos_obras||[])[0]?.contato_id || null;
 o.contato    = (o.contatos_obras||[])[0]?.contato    || null;
 return o;
}

// Documento "Proposta Comercial" de cada obra, pra pré-visualizar direto da
// grid (pedido explícito: mesma UX do campo attachment do Airtable — clica
// e abre um preview, não só um "Sim/Não"). Dado real vem misturado em duas
// grafias (Airtable sincronizou "Proposta Comercial", upload manual pelo
// wizard grava "proposta_comercial") — .in() com as duas grafias exatas,
// não mais ilike('%...%') (sequential scan sem índice possível pra padrão
// com curinga no início — achado real de lentidão: 6500+ linhas de
// `documentos` escaneadas a cada load da grid de Obras; ver migração
// add_index_documentos_tipo, que criou um índice comum em tipo pra esse
// .in() aproveitar). Uma única query agregada + ordenada por created_at
// desc pra todas as obras (não dá pra buscar isso por obra individualmente
// sem 1500+ requests) — guarda só o documento MAIS RECENTE por obra
// (primeira ocorrência de cada obra_id, já que a query vem em ordem
// decrescente).
async function _obrasCarregarPropostaMap() {
 var map = {}; var from = 0; var pageSize = 1000; var more = true;
 while (more) {
  var res = await _sb.from('documentos')
   .select('obra_id, caminho_storage, nome_arquivo, status, created_at')
   .in('tipo', ['Proposta Comercial', 'proposta_comercial'])
   .not('obra_id', 'is', null)
   .order('created_at', { ascending: false })
   .range(from, from + pageSize - 1);
  if (res.error || !res.data || !res.data.length) break;
  res.data.forEach(function(d){
   // "Pendente Upload" (mesmo status usado em _spCarregarDocumentos) não
   // tem arquivo de verdade no Storage ainda — caminho_storage vem null
   // nesse caso. Sem essa checagem, o botão "Ver" da grid quebrava com
   // TypeError (.replace de null) e travava _dbLoadObras inteiro (erro
   // síncrono dentro do .map() de render, fora do try/catch das queries).
   if (d.obra_id && d.caminho_storage && d.status !== 'Pendente Upload' && !map[d.obra_id]) {
    map[d.obra_id] = { path: d.caminho_storage, nome: d.nome_arquivo };
   }
  });
  more = res.data.length === pageSize; from += pageSize;
 }
 return map;
}

// Presença de ART/Cálculo Estrutural por obra — pros filtros "ART"/"Cálculo
// Estrutural" da grade (pedido explícito). Mesmo esquema de página da query
// de Proposta acima, só que aqui só interessa SE existe (não qual/status),
// então guarda Sets em vez de mapear o documento inteiro.
async function _obrasCarregarDocsPresenca() {
 var temArt = new Set(), temCalculo = new Set();
 var from = 0, pageSize = 1000, more = true;
 while (more) {
  var res = await _sb.from('documentos')
   .select('obra_id, tipo')
   .in('tipo', ['ART', 'Cálculo Estrutural'])
   .not('obra_id', 'is', null)
   .range(from, from + pageSize - 1);
  if (res.error || !res.data || !res.data.length) break;
  res.data.forEach(function(d){
   if (d.tipo === 'ART') temArt.add(d.obra_id);
   if (d.tipo === 'Cálculo Estrutural') temCalculo.add(d.obra_id);
  });
  more = res.data.length === pageSize; from += pageSize;
 }
 return { temArt: temArt, temCalculo: temCalculo };
}

// Agregados de Projetos por obra (Qtd./Valor/Peso total, Produtos) — pros
// filtros/ordenações "de Projetos" pedidos na grade de Obras. Uma única
// query paginada pra todos os projetos (não dá pra agregar isso por obra
// individualmente sem 1500+ requests), reduzida em memória por obra_id.
async function _obrasCarregarProjetosAgg() {
 var agg = {}; var from = 0, pageSize = 1000, more = true;
 while (more) {
  var res = await _sb.from('projetos')
   .select('obra_id, quantidade, valor_unitario, peso_kg, produto')
   .not('obra_id', 'is', null)
   .range(from, from + pageSize - 1);
  if (res.error || !res.data || !res.data.length) break;
  res.data.forEach(function(p){
   var a = agg[p.obra_id] || (agg[p.obra_id] = { qtd: 0, valor: 0, peso: 0, produtos: new Set() });
   a.qtd   += Number(p.quantidade) || 0;
   a.valor += (Number(p.valor_unitario) || 0) * (Number(p.quantidade) || 1);
   a.peso  += Number(p.peso_kg) || 0;
   (p.produto || []).forEach(function(pr){ a.produtos.add(pr); });
  });
  more = res.data.length === pageSize; from += pageSize;
 }
 return agg;
}

// Agregados de Entregas por obra (Qtd./Valor total, entregue e a entregar) —
// "entregue" = etapa 'Entrega realizada' (único valor real que representa
// entrega concluída; os outros 6 valores reais — Programar entrega, Em
// transporte, Produção etc. — são todos estágios ANTES da entrega de
// verdade, por isso contam como "a entregar").
async function _obrasCarregarEntregasAgg() {
 var agg = {}; var from = 0, pageSize = 1000, more = true;
 while (more) {
  var res = await _sb.from('entregas')
   .select('obra_id, quantidade, valor, etapa')
   .not('obra_id', 'is', null)
   .range(from, from + pageSize - 1);
  if (res.error || !res.data || !res.data.length) break;
  res.data.forEach(function(e){
   var a = agg[e.obra_id] || (agg[e.obra_id] = { qtdTotal: 0, qtdEntregue: 0, valorTotal: 0, valorEntregue: 0 });
   var qtd = Number(e.quantidade) || 0, valor = Number(e.valor) || 0;
   a.qtdTotal   += qtd;
   a.valorTotal += valor;
   if (e.etapa === 'Entrega realizada') { a.qtdEntregue += qtd; a.valorEntregue += valor; }
  });
  more = res.data.length === pageSize; from += pageSize;
 }
 return agg;
}

// Sets de obra_id com pelo menos 1 Instalação / 1 Tarefa vinculada — pros
// filtros de presença "Instalação"/"Tarefa" da grade (Projeto/Entrega já
// têm os agregados acima, que também servem de presença: agg[obraId] existe
// ⇔ tem pelo menos 1).
async function _obrasCarregarPresencaSimples(tabela, coluna) {
 var set = new Set(); var from = 0, pageSize = 1000, more = true;
 while (more) {
  var res = await _sb.from(tabela).select(coluna).not(coluna, 'is', null).range(from, from + pageSize - 1);
  if (res.error || !res.data || !res.data.length) break;
  res.data.forEach(function(r){ set.add(r[coluna]); });
  more = res.data.length === pageSize; from += pageSize;
 }
 return set;
}

// Set de obra_id com pelo menos 1 registro fotográfico (documentos.tipo=
// 'fotos_obra') em algum Projeto vinculado — igual em espírito a
// _obrasCarregarPresencaSimples, mas fotos_obra não tem obra_id direto (fica
// em projeto_id, ver aba "Registros"), então precisa do passo extra de
// mapear projeto_id → obra_id antes de checar presença.
async function _obrasCarregarRegistrosPresenca() {
 var projObraMap = {}; var from = 0, pageSize = 1000, more = true;
 while (more) {
  var res = await _sb.from('projetos').select('id, obra_id').not('obra_id', 'is', null).range(from, from + pageSize - 1);
  if (res.error || !res.data || !res.data.length) break;
  res.data.forEach(function(p){ projObraMap[p.id] = p.obra_id; });
  more = res.data.length === pageSize; from += pageSize;
 }
 var set = new Set(); from = 0; more = true;
 while (more) {
  var res2 = await _sb.from('documentos').select('projeto_id').eq('tipo', 'fotos_obra').not('projeto_id', 'is', null).range(from, from + pageSize - 1);
  if (res2.error || !res2.data || !res2.data.length) break;
  res2.data.forEach(function(d){ var obraId = projObraMap[d.projeto_id]; if (obraId) set.add(obraId); });
  more = res2.data.length === pageSize; from += pageSize;
 }
 return set;
}

async function _obrasCarregarTodasObras() {
 var allObras=[]; var from=0; var pageSize=1000; var more=true;
 while(more){
  var res=await _sb.from('obras').select('*, empresas_obras(empresa_id,empresa:empresa_id(id,nome,cnpj)), contatos_obras(contato_id,contato:contato_id(id,nome_completo))').range(from,from+pageSize-1).order('created_at',{ascending:false});
  if(res.error){res=await _sb.from('obras').select('*').range(from,from+pageSize-1).order('created_at',{ascending:false});}
  if(res.error||!res.data||!res.data.length)break;
  res.data.forEach(_normObraAssoc);
  allObras=allObras.concat(res.data); more=res.data.length===pageSize; from+=pageSize;
 }
 return allObras;
}

// Monta todos os data-* "extras" usados pelos filtros/ordenações/agrupamentos
// pedidos na grade de Obras (Quantidade, Canal, datas, ART/Cálculo
// Estrutural, agregados de Projetos/Entregas, presença de Instalação/
// Tarefa...) — função única, reaproveitada tanto pela Tabela quanto pelo
// Kanban, pra não duplicar essa lista enorme de atributos duas vezes.
function _obrasExtraDatasetAttrs(o, propostaMap, docsPresenca, projAgg, entAgg, temInstalacao, temTarefa, temRegistro) {
 var proposta = propostaMap[o.id];
 var pAgg = projAgg[o.id];
 var eAgg = entAgg[o.id];
 function esc(v) { return (v == null ? '' : String(v)).replace(/"/g, '&quot;'); }
 return ' data-quantidade="' + (o.quantidade != null ? o.quantidade : '') + '"'
  + ' data-canal="' + esc(o.canal_vendas) + '"'
  + ' data-data-criacao="' + (o.data_criacao || '') + '"'
  + ' data-data-fechamento="' + (o.data_fechamento || '') + '"'
  + ' data-endereco="' + esc(o.endereco_entrega) + '"'
  + ' data-motivo-perdido="' + esc(o.motivo_perdido) + '"'
  + ' data-alterado-por="' + esc(o.ultima_alteracao_por) + '"'
  + ' data-criado-por="' + esc(o.criado_por) + '"'
  // .substring(0,10): updated_at é timestamp completo (com hora) — o filtro
  // de data (_fbEvalCondition) só compara data pura ("T00:00:00" fixo),
  // então guardar o timestamp inteiro aqui quebraria a comparação
  // (new Date(raw + 'T00:00:00') vira uma string ISO inválida).
  + ' data-updated-at="' + (o.updated_at ? String(o.updated_at).substring(0,10) : '') + '"'
  + ' data-contato="' + esc(o.contato && o.contato.nome_completo) + '"'
  + ' data-art="' + (docsPresenca.temArt.has(o.id) ? 'Sim' : 'Não') + '"'
  + ' data-calculo="' + (docsPresenca.temCalculo.has(o.id) ? 'Sim' : 'Não') + '"'
  + ' data-proposta="' + (proposta ? 'Sim' : 'Não') + '"'
  + ' data-proj-qtd="' + (pAgg ? pAgg.qtd : 0) + '"'
  + ' data-proj-valor="' + (pAgg ? pAgg.valor : 0) + '"'
  + ' data-proj-peso="' + (pAgg ? pAgg.peso : 0) + '"'
  + ' data-proj-produto="' + esc(pAgg ? Array.from(pAgg.produtos).join(', ') : '') + '"'
  + ' data-tem-projeto="' + (pAgg ? 'Sim' : 'Não') + '"'
  + ' data-ent-qtd-total="' + (eAgg ? eAgg.qtdTotal : 0) + '"'
  + ' data-ent-qtd-entregue="' + (eAgg ? eAgg.qtdEntregue : 0) + '"'
  + ' data-ent-qtd-a-entregar="' + (eAgg ? (eAgg.qtdTotal - eAgg.qtdEntregue) : 0) + '"'
  + ' data-ent-valor-total="' + (eAgg ? eAgg.valorTotal : 0) + '"'
  + ' data-ent-valor-entregue="' + (eAgg ? eAgg.valorEntregue : 0) + '"'
  + ' data-ent-valor-a-entregar="' + (eAgg ? (eAgg.valorTotal - eAgg.valorEntregue) : 0) + '"'
  + ' data-tem-entrega="' + (eAgg ? 'Sim' : 'Não') + '"'
  + ' data-tem-instalacao="' + (temInstalacao.has(o.id) ? 'Sim' : 'Não') + '"'
  + ' data-tem-tarefa="' + (temTarefa.has(o.id) ? 'Sim' : 'Não') + '"'
  + ' data-tem-registro="' + (temRegistro.has(o.id) ? 'Sim' : 'Não') + '"';
}

async function _dbLoadObras() {
 // Todas as consultas abaixo são independentes entre si — rodar em paralelo
 // em vez de esperar uma terminar pra começar a outra foi a segunda metade
 // do achado de lentidão original (a primeira foi o índice/ilike da
 // proposta): antes o tempo total era a SOMA de todas, agora é só a mais
 // lenta delas.
 // try/catch novo: antes, qualquer erro na busca de obras (rede, timeout,
 // RLS) deixava a Promise rejeitada sem handler nenhum — a tela ficava
 // travada em "Carregando obras..." pra sempre, sem nenhuma pista do que
 // deu errado. Agora aparece um erro real na tela + no console.
 var allObras, propostaMap, docsPresenca, projAgg, entAgg, temInstalacao, temTarefa, temRegistro;
 try {
  var results = await Promise.all([
   _obrasCarregarTodasObras(),
   _obrasCarregarPropostaMap().catch(function(e){ console.error('[Obras] erro ao verificar propostas comerciais:', e); return {}; }),
   _obrasCarregarDocsPresenca().catch(function(e){ console.error('[Obras] erro ao verificar ART/Cálculo Estrutural:', e); return { temArt: new Set(), temCalculo: new Set() }; }),
   _obrasCarregarProjetosAgg().catch(function(e){ console.error('[Obras] erro ao agregar projetos:', e); return {}; }),
   _obrasCarregarEntregasAgg().catch(function(e){ console.error('[Obras] erro ao agregar entregas:', e); return {}; }),
   _obrasCarregarPresencaSimples('instalacoes', 'obra_id').catch(function(e){ console.error('[Obras] erro ao verificar instalações:', e); return new Set(); }),
   _obrasCarregarPresencaSimples('atividades_obras', 'obra_id').catch(function(e){ console.error('[Obras] erro ao verificar tarefas:', e); return new Set(); }),
   _obrasCarregarRegistrosPresenca().catch(function(e){ console.error('[Obras] erro ao verificar registros:', e); return new Set(); }),
  ]);
  allObras = results[0]; propostaMap = results[1]; docsPresenca = results[2];
  projAgg = results[3]; entAgg = results[4]; temInstalacao = results[5]; temTarefa = results[6]; temRegistro = results[7];
 } catch (e) {
  console.error('[Obras] erro ao carregar a lista de obras:', e);
  var tbodyErr = document.getElementById('obras-tbody');
  if (tbodyErr) tbodyErr.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--red);padding:24px">Erro ao carregar obras: ' + (e && e.message ? e.message : 'erro desconhecido') + '</td></tr>';
  return;
 }
 if(!allObras.length)return;
 // Mapa global id→{nome,empresa} usado por _dbLoadProjetos
 _obraIdMap = {};
 allObras.forEach(function(o){
  var emp = (o.empresa && o.empresa.nome) || '';
  _obraIdMap[o.id] = { nome: o.nome || '', empresa: emp };
 });
 var tbody=document.getElementById('obras-tbody'); if(!tbody)return;
 try {
 tbody.innerHTML=allObras.map(function(o){
  var tipos=o.tipo_obra||[]; var etapa=o.etapa_negocio||''; var eCls=_etapaClsBd[etapa]||'bm';
  var empNome=(o.empresa&&o.empresa.nome)||(_empresasArr&&o.empresa_id?((_empresasArr.find(function(e){return e.id===o.empresa_id;})||{}).nome||''):'')||'';
  var loc=[o.cidade,o.estado].filter(Boolean).join(' - ');
  var catBadges=tipos.map(function(t){return '<span class="badge '+(_tipoClsBd[t]||'bm')+'" style="font-size:10px">'+t+'</span>';}).join(' ')||'<span style="color:var(--muted)">—</span>';
  var dataEnvio=o.data_envio_proposta?new Date(o.data_envio_proposta+'T00:00:00').toLocaleDateString('pt-BR'):'—';
  var valor=(o.valor!=null)?'R$ '+Number(o.valor).toLocaleString('pt-BR',{minimumFractionDigits:0}):'—';
  var qtd=(o.quantidade!=null)?o.quantidade:'—';
  var proposta=propostaMap[o.id];
  // Clica e pré-visualiza na hora (mesmo modal de PDF já usado na aba
  // Documentos, _spAbrirDocStorage) — igual ao campo attachment do Airtable,
  // não só um indicador Sim/Não.
  // Checagem defensiva (proposta && proposta.path), não só "proposta existe"
  // — já bastou uma vez um caminho_storage nulo pra travar _dbLoadObras
  // inteiro com TypeError síncrono dentro deste .map() (ver correção em
  // _obrasCarregarPropostaMap acima).
  var propostaCell = (proposta && proposta.path)
   ? '<button type="button" class="btn btn-ghost btn-sm" style="display:inline-flex;align-items:center;gap:5px" onclick="event.stopPropagation();_spAbrirDocStorage(\''+proposta.path.replace(/'/g,"\\'")+'\',\''+(proposta.nome||'Proposta Comercial').replace(/'/g,"\\'")+'\')" title="Pré-visualizar proposta comercial"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></svg>Ver</button>'
   : '<span style="color:var(--muted);font-size:12px">—</span>';
  // "Gerar Orçamento" vive só dentro do painel da Obra (Calculadora Modular
  // para Modular, Proposta Comercial para Solar) — aqui só abre o painel.
  return '<tr onclick="if(!event.target.closest(\'button,a,input,select\'))_spOpen(\'obras\',this)"'
   +' data-id="'+(o.id||'')+'" data-tipo="'+tipos.join(', ')+'" data-etapa="'+etapa+'" data-empresa="'+empNome+'" data-cidade="'+(o.cidade||'')+'" data-estado="'+(o.estado||'')+'"'
   +' data-nome="'+(o.nome||'').replace(/"/g,'&quot;')+'" data-valor="'+(o.valor!=null?o.valor:0)+'" data-data-envio="'+(o.data_envio_proposta||'')+'"'
   + _obrasExtraDatasetAttrs(o, propostaMap, docsPresenca, projAgg, entAgg, temInstalacao, temTarefa, temRegistro) + '>'
   +'<td><div style="font-weight:500">'+o.nome+'</div><div style="font-size:11px;color:var(--muted)">'+(empNome||'—')+(loc?' · <b>'+loc+'</b>':'')+'</div></td>'
   +'<td><div class="oc-tags" style="margin-bottom:0">'+catBadges+'</div></td>'
   +'<td style="color:var(--muted)">'+(o.cidade||'—')+'</td>'
   +'<td style="color:var(--muted)">'+(o.estado||'—')+'</td>'
   +'<td style="text-align:center;color:var(--muted)">'+qtd+'</td>'
   +'<td style="color:var(--muted)">'+(o.canal_vendas||'—')+'</td>'
   +'<td><span class="badge '+eCls+'">'+(etapa||'—')+'</span></td>'
   +'<td style="color:var(--muted);font-size:12px">'+dataEnvio+'</td>'
   +'<td style="text-align:center">'+propostaCell+'</td>'
   +'<td style="font-weight:600">'+valor+'</td>'
   +'<td><button class="btn btn-ghost btn-sm" onclick="_spObraById(\''+o.id+'\')">Abrir</button></td></tr>';
 }).join('');
 } catch (e) {
  // Erro SÍNCRONO dentro do .map() (ex.: TypeError num campo inesperado)
  // não é pego pelo try/catch das queries acima (esse já retornou antes de
  // chegar aqui) — sem isto, a tela ficava travada em "Carregando
  // obras..." pra sempre e o erro só aparecia no console (foi exatamente
  // o que aconteceu com o bug do caminho_storage nulo).
  console.error('[Obras] erro ao renderizar a lista de obras:', e);
  tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--red);padding:24px">Erro ao exibir obras: ' + (e && e.message ? e.message : 'erro desconhecido') + '</td></tr>';
  return;
 }
 // Badge do menu lateral: agora vem de _navBadgesLoadInitial() (RPC de
 // contagem única, no boot) + realtime — não mais como efeito colateral
 // de carregar a lista inteira aqui.
}

async function _dbLoadObrasKanban() {
 var allObras=[]; var from=0; var pageSize=1000; var more=true;
 while(more){
  var res=await _sb.from('obras').select('*, empresas_obras(empresa_id,empresa:empresa_id(id,nome,cnpj)), contatos_obras(contato_id,contato:contato_id(id,nome_completo))').range(from,from+pageSize-1).order('created_at',{ascending:false});
  if(res.error){res=await _sb.from('obras').select('*').range(from,from+pageSize-1).order('created_at',{ascending:false});}
  if(res.error||!res.data||!res.data.length)break;
  res.data.forEach(_normObraAssoc);
  allObras=allObras.concat(res.data); more=res.data.length===pageSize; from+=pageSize;
 }
 if(!allObras.length)return;

 // Mesmos agregados/presenças da Tabela (ver _dbLoadObras) — o Kanban tem
 // seu próprio filtro/ordenação sobre os mesmos data-*, então precisa dos
 // mesmos campos extras nos cards. Consultas independentes das obras acima,
 // rodam em paralelo.
 var propostaMap = {}, docsPresenca = { temArt: new Set(), temCalculo: new Set() }, projAgg = {}, entAgg = {}, temInstalacao = new Set(), temTarefa = new Set(), temRegistro = new Set();
 try {
  var extras = await Promise.all([
   _obrasCarregarPropostaMap(),
   _obrasCarregarDocsPresenca(),
   _obrasCarregarProjetosAgg(),
   _obrasCarregarEntregasAgg(),
   _obrasCarregarPresencaSimples('instalacoes', 'obra_id'),
   _obrasCarregarPresencaSimples('atividades_obras', 'obra_id'),
   _obrasCarregarRegistrosPresenca(),
  ]);
  propostaMap = extras[0]; docsPresenca = extras[1]; projAgg = extras[2]; entAgg = extras[3];
  temInstalacao = extras[4]; temTarefa = extras[5]; temRegistro = extras[6];
 } catch (e) {
  console.error('[Obras] erro ao carregar agregados do Kanban:', e);
 }

 // Limpa conteúdo atual de cada coluna (mantém o cabeçalho e o botão + nova obra)
 Object.values(_etapaKcId).forEach(id => {
  const col = document.getElementById(id);
  if (col) { const body = col.querySelector('.kc-body'); if (body) body.innerHTML = ''; }
 });

 allObras.forEach(o => {
  const colId = _etapaKcId[o.etapa_negocio];
  const col   = colId && document.getElementById(colId);
  if (!col) return;
  const body  = col.querySelector('.kc-body');
  if (!body) return;
  const tipos = o.tipo_obra || [];
  const empNome = (o.empresa && o.empresa.nome) || '';
  const tagsHtml = tipos.map(t => `<span class="badge ${_tipoClsBd[t]||'bm'}" style="font-size:10px">${t}</span>`).join('');
  const criadoTxt = o.created_at ? new Date(o.created_at).toLocaleDateString('pt-BR') : '';
  const card  = document.createElement('div');
  card.className = 'obra-card';
  card.dataset.id = o.id;
  card.dataset.etapa = o.etapa_negocio || '';
  card.dataset.tipo = (o.tipo_obra || []).join(', ');
  card.dataset.canal = (o.canal_vendas || '').toLowerCase();
  card.dataset.empresa = empNome;
  card.dataset.cidade = o.cidade || '';
  card.dataset.estado = o.estado || '';
  card.dataset.nome = o.nome || '';
  card.dataset.valor = o.valor != null ? o.valor : 0;
  card.dataset.dataEnvio = o.data_envio_proposta || '';
  card.dataset.search = [(o.nome||''), empNome, (o.cidade||''), (o.canal_vendas||''), (o.tipo_obra||[]).join(' ')].join(' ').toLowerCase();
  // Mesmos data-* "extras" da Tabela (_obrasExtraDatasetAttrs) — aqui via
  // propriedades do dataset em vez de atributo HTML, já que o card é
  // montado com createElement, não innerHTML de string.
  var pAggK = projAgg[o.id], eAggK = entAgg[o.id], propostaK = propostaMap[o.id];
  card.dataset.quantidade = o.quantidade != null ? o.quantidade : '';
  card.dataset.dataCriacao = o.data_criacao || '';
  card.dataset.dataFechamento = o.data_fechamento || '';
  card.dataset.endereco = o.endereco_entrega || '';
  card.dataset.motivoPerdido = o.motivo_perdido || '';
  card.dataset.alteradoPor = o.ultima_alteracao_por || '';
  card.dataset.criadoPor = o.criado_por || '';
  card.dataset.updatedAt = o.updated_at ? String(o.updated_at).substring(0,10) : '';
  card.dataset.contato = (o.contato && o.contato.nome_completo) || '';
  card.dataset.art = docsPresenca.temArt.has(o.id) ? 'Sim' : 'Não';
  card.dataset.calculo = docsPresenca.temCalculo.has(o.id) ? 'Sim' : 'Não';
  card.dataset.proposta = propostaK ? 'Sim' : 'Não';
  card.dataset.projQtd = pAggK ? pAggK.qtd : 0;
  card.dataset.projValor = pAggK ? pAggK.valor : 0;
  card.dataset.projPeso = pAggK ? pAggK.peso : 0;
  card.dataset.projProduto = pAggK ? Array.from(pAggK.produtos).join(', ') : '';
  card.dataset.temProjeto = pAggK ? 'Sim' : 'Não';
  card.dataset.entQtdTotal = eAggK ? eAggK.qtdTotal : 0;
  card.dataset.entQtdEntregue = eAggK ? eAggK.qtdEntregue : 0;
  card.dataset.entQtdAEntregar = eAggK ? (eAggK.qtdTotal - eAggK.qtdEntregue) : 0;
  card.dataset.entValorTotal = eAggK ? eAggK.valorTotal : 0;
  card.dataset.entValorEntregue = eAggK ? eAggK.valorEntregue : 0;
  card.dataset.entValorAEntregar = eAggK ? (eAggK.valorTotal - eAggK.valorEntregue) : 0;
  card.dataset.temEntrega = eAggK ? 'Sim' : 'Não';
  card.dataset.temInstalacao = temInstalacao.has(o.id) ? 'Sim' : 'Não';
  card.dataset.temTarefa = temTarefa.has(o.id) ? 'Sim' : 'Não';
  card.dataset.temRegistro = temRegistro.has(o.id) ? 'Sim' : 'Não';
  card.draggable = true;
  card.addEventListener('dragstart', _onObraCardDragStart);
  card.addEventListener('dragend', _onObraCardDragEnd);
  // Card simplificado (UX): só o essencial pra identificar a obra rápido —
  // nome, categoria e data de criação. Cliente/canal/qtd./valor/cidade/
  // estado continuam disponíveis na Tabela e no painel de detalhe; aqui
  // ficariam de fora só pra reduzir a carga de leitura do Kanban. Os
  // data-* abaixo (empresa/cidade/estado/canal/etc.) continuam intactos —
  // são usados pelos filtros/busca, que não mudam nesta tarefa.
  card.innerHTML = `
   <div class="oc-title">${o.nome||''}</div>
   ${tagsHtml ? `<div class="oc-tags">${tagsHtml}</div>` : ''}
   ${criadoTxt ? `<div class="oc-date">Criado ${criadoTxt}</div>` : ''}
  `;
  card.onclick = () => _spObraById(o.id);
  body.appendChild(card);
 });

 // Atualiza contadores de cada coluna
 document.querySelectorAll('.kanban-col').forEach(col => {
  const count = col.querySelectorAll('.obra-card').length;
  const badge = col.querySelector('.kc-count');
  if (badge) badge.textContent = count;
 });

 _setupObrasKanbanDnD();
}

// ── Drag-and-drop do Kanban de Obras (move card → atualiza etapa_negocio) ──────
var _kcIdToEtapa = Object.fromEntries(Object.entries(_etapaKcId).map(p => [p[1], p[0]]));
var _kanbanDndInit = false;

function _onObraCardDragStart(e) {
 e.dataTransfer.setData('text/plain', this.dataset.id);
 e.dataTransfer.effectAllowed = 'move';
 this.classList.add('dragging');
}
function _onObraCardDragEnd() {
 this.classList.remove('dragging');
}
function _setupObrasKanbanDnD() {
 if (_kanbanDndInit) return;
 _kanbanDndInit = true;
 document.querySelectorAll('#obras-kanban .kc-body').forEach(body => {
  body.addEventListener('dragover', e => { e.preventDefault(); body.classList.add('kc-dragover'); });
  body.addEventListener('dragleave', () => body.classList.remove('kc-dragover'));
  body.addEventListener('drop', e => {
   e.preventDefault();
   body.classList.remove('kc-dragover');
   const id = e.dataTransfer.getData('text/plain');
   const col = body.closest('.kanban-col');
   const novaEtapa = col && _kcIdToEtapa[col.id];
   if (id && novaEtapa) updateObraEtapa(id, novaEtapa, 'kanban');
  });
 });
}

// ── Atualiza etapa_negocio (fonte única) e sincroniza Kanban + Tabela + Painel ──
async function updateObraEtapa(id, novaEtapa, origem) {
 if (!id || !novaEtapa || !_etapaKcId[novaEtapa]) return;
 const card = document.querySelector('.obra-card[data-id="' + id + '"]');
 const row  = document.querySelector('#obras-tbody tr[data-id="' + id + '"]');
 const etapaAnterior = (card && card.dataset.etapa) || (row && row.dataset.etapa) || '';
 if (etapaAnterior === novaEtapa) return;

 _aplicarEtapaObraUI(id, novaEtapa);

 const res = await _sb.from('obras').update({ etapa_negocio: novaEtapa, updated_at: new Date().toISOString() }).eq('id', id);
 if (res.error) {
  _showToast('Erro ao atualizar etapa: ' + _supaErrPt(res.error.message), 'erro');
  if (etapaAnterior) _aplicarEtapaObraUI(id, etapaAnterior);
  return;
 }
 if (_obraAtiva && _obraAtiva.id === id) _obraAtiva.etapa_negocio = novaEtapa;
 _showToast('Etapa atualizada para "' + novaEtapa + '"', 'ok');
}

// ── Aplica a etapa em todas as views (Kanban, Tabela, Painel lateral) ──────────
function _aplicarEtapaObraUI(id, etapa) {
 const card = document.querySelector('.obra-card[data-id="' + id + '"]');
 const colId = _etapaKcId[etapa];
 const destCol = colId && document.getElementById(colId);
 if (card && destCol) {
  const destBody = destCol.querySelector('.kc-body');
  if (destBody && card.parentElement !== destBody) destBody.insertBefore(card, destBody.firstChild);
  card.dataset.etapa = etapa;
  document.querySelectorAll('.kanban-col').forEach(col => {
   const badge = col.querySelector('.kc-count');
   if (badge) badge.textContent = col.querySelectorAll('.obra-card').length;
  });
 }

 const row = document.querySelector('#obras-tbody tr[data-id="' + id + '"]');
 if (row) {
  row.dataset.etapa = etapa;
  const cell = row.children[4];
  if (cell) cell.innerHTML = '<span class="badge ' + (_etapaClsBd[etapa] || 'bm') + '">' + etapa + '</span>';
 }

 if (_obraAtiva && _obraAtiva.id === id) {
  const sel = document.getElementById('sp-etapa');
  if (sel && sel.value !== etapa) sel.value = etapa;
 }
}

// ── Painel lateral: troca de etapa no select → auto-save + sync Kanban ─────────
function _spOnEtapaChange(novaEtapa) {
 if (!_obraAtiva || !_obraAtiva.id) return;
 updateObraEtapa(_obraAtiva.id, novaEtapa, 'painel');
}

async function _spObraById(id) {
 if (!id) return;
 _spSet('Obra', 'Carregando...', '<div style="padding:40px;text-align:center;color:var(--muted)">Buscando dados...</div>', '');
 document.getElementById('sp-overlay').classList.add('sp-open');
 document.getElementById('sp-drawer').classList.add('sp-open');
 // Chamada direta (Kanban/botão "Abrir"), sem passar por _spOpen — precisa
 // se anunciar pra pilha de navegação (ver _spTrackDirectOpen em
 // side-panel.js), senão abrir um Projeto de dentro desta Obra depois não
 // sabe pra onde voltar ao fechar.
 if (typeof _spTrackDirectOpen === 'function') _spTrackDirectOpen('obras', id);

 try {
  const [obraRes, projRes, entregasRes, instRes, atividadesRes] = await Promise.all([
   _sb.from('obras').select('*, empresas_obras(empresa_id,empresa:empresa_id(id,nome,cnpj)), contatos_obras(contato_id,contato:contato_id(id,nome_completo))').eq('id', id).single(),
   _sb.from('projetos').select('*').eq('obra_id', id).order('created_at'),
   _sb.from('entregas').select('*').eq('obra_id', id).order('data_faturamento', { ascending: false, nullsFirst: false }),
   _sb.from('instalacoes').select('*').eq('obra_id', id).order('data_inicio'),
   // "Tarefas": Atividades do Gestor de Tarefas vinculadas a esta obra —
   // pedido explícito. obra_id não é mais coluna direta de atividades (ver
   // scripts/lib/atividades-vinculos.js), vive na junção atividades_obras.
   _sb.from('atividades_obras').select('atividade:atividade_id(id, titulo, status, prioridade, data_prazo, responsavel)').eq('obra_id', id)
  ]);

  if (obraRes.error) {
   _spSet('Obra', 'Erro', '<div style="color:var(--red);padding:20px">Obra não encontrada: ' + obraRes.error.message + '</div>', '');
   return;
  }
  if (entregasRes.error) console.error('[MilaTec] Erro ao carregar entregas:', entregasRes.error);
  if (instRes.error) console.error('[MilaTec] Erro ao carregar instalações:', instRes.error);
  if (atividadesRes.error) console.error('[MilaTec] Erro ao carregar tarefas vinculadas:', atividadesRes.error);

  const projetos  = projRes.data || [];
  projetos.forEach(function(p){ if (Array.isArray(p.responsavel)) p.responsavel = _emailsToNomes(p.responsavel); });
  const entregas  = entregasRes.data || [];
  const instalacoes = instRes.data || [];
  const atividades = (atividadesRes.data || []).map(function(link){ return link.atividade; }).filter(Boolean);
  atividades.forEach(function(a){ if (Array.isArray(a.responsavel)) a.responsavel = _emailsToNomes(a.responsavel); });

  _obraAtiva = _normObraAssoc(obraRes.data);
  _obraAtiva.projetos = projetos;
  await _spObrasRender(_obraAtiva, projetos, entregas, instalacoes, atividades);
 } catch(err) {
  console.error('[MilaTec] Erro ao carregar obra:', err);
  _spSet('Obra', 'Erro interno', '<div style="color:var(--red);padding:20px">Erro inesperado: ' + err.message + '</div>', '');
 }
}

// ── Navegação por âncora no painel de obra ────────────────────────────────────
// Pedido explícito: o painel virou 1 página só de rolagem contínua — as
// "abas" (.spt-panel) todas ficam visíveis o tempo todo (ver CSS), então
// clicar aqui só rola suave até a seção. Documentos não é mais carregado sob
// demanda (não existe mais "clicar na aba" pra revelar algo escondido) —
// _spObrasRender já chama _spCarregarDocumentos direto, junto com
// _spCarregarPropostaStatus.
function _sptSwitch(id, btn) {
 var panel = document.getElementById('spt-' + id);
 if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
 document.querySelectorAll('#sp-body .spt-btn').forEach(function(b){ b.classList.remove('active'); });
 if (btn) btn.classList.add('active');
}

// Destaca a aba correspondente à seção mais próxima do topo visível enquanto
// o usuário rola livremente pela página (sem clicar em nenhuma aba) — pedido
// explícito: "destacar visualmente a seção ativa conforme o usuário navega".
// Feito por scroll (não IntersectionObserver) porque as seções têm alturas
// bem diferentes (Visão Geral é grande, Documentos pode ficar pequena) — o
// que importa aqui é só "qual seção já passou da linha da barra sticky",
// não "qual está mais visível na tela".
var _sptScrollSpyBound = false;
var _sptScrollSpyRaf = null;
function _sptInitScrollSpy() {
 var root = document.getElementById('sp-body');
 if (!root) return;
 if (!_sptScrollSpyBound) {
  root.addEventListener('scroll', _sptScrollSpyOnScroll, { passive: true });
  _sptScrollSpyBound = true;
 }
 _sptScrollSpyUpdate();
}
function _sptScrollSpyOnScroll() {
 if (_sptScrollSpyRaf) return;
 _sptScrollSpyRaf = requestAnimationFrame(function(){ _sptScrollSpyRaf = null; _sptScrollSpyUpdate(); });
}
// Mesmo valor do scroll-margin-top de .spt-panel (styles/main.css) — usar a
// altura real da .spt-bar aqui (~39px) em vez desta constante fixa parecia
// certo, mas ficava ~15px MENOR que o scroll-margin-top usado pelo
// scrollIntoView pra posicionar a seção; resultado: clicar numa aba rolava
// pra lá, mas a aba clicada não acendia como ativa até rolar mais um
// pouquinho — os dois precisam concordar no mesmo número.
var _SPT_SCROLL_ANCHOR = 54;
function _sptScrollSpyUpdate() {
 var root = document.getElementById('sp-body');
 if (!root) return;
 var panels = root.querySelectorAll('.spt-panel');
 if (!panels.length) return;
 var atualId;
 // Rolou até o fim de verdade: a última seção (Documentos) pode nunca ter
 // conteúdo suficiente ABAIXO dela pra empurrar o próprio topo além da
 // linha de corte (isso só existe se sobrar altura de sobra depois dela) —
 // sem este caso especial, a última aba nunca acendia mesmo com a página
 // inteira já rolada.
 if (root.scrollTop + root.clientHeight >= root.scrollHeight - 2) {
  atualId = panels[panels.length - 1].id;
 } else {
  var limite = root.getBoundingClientRect().top + _SPT_SCROLL_ANCHOR + 4;
  atualId = panels[0].id;
  for (var i = 0; i < panels.length; i++) {
   if (panels[i].getBoundingClientRect().top <= limite) atualId = panels[i].id;
  }
 }
 root.querySelectorAll('.spt-btn').forEach(function(b){
  b.classList.toggle('active', b.dataset.target === atualId);
 });
}

// ── Documentos: carregar por obra com navegação por tipo ──────────────────────
// 9 tipos de Obras (conforme campos Airtable) + Outro como fallback
var _docTiposOrdem = [
 'Proposta Comercial','Contrato','Contrato Instalação','Enviado pelo Cliente',
 'Pedido de Compra','ART','Cálculo Estrutural','CNPJ & CNO','Boletim de Medição','Outro'
];
var _docCategoriaMapa = {
 'Proposta Comercial':'Comercial','Contrato':'Comercial','Contrato Instalação':'Comercial','Enviado pelo Cliente':'Comercial',
 'Pedido de Compra':'Técnico','ART':'Técnico','Cálculo Estrutural':'Técnico','CNPJ & CNO':'Técnico','Boletim de Medição':'Técnico',
 'Outro':'Técnico'
};
// Mapa de tipos snake_case do banco → nome de exibição
var _docTipoNormMapa = {
 'proposta_comercial':'Proposta Comercial',
 'contrato':'Contrato',
 'contrato_instalacao':'Contrato Instalação',
 'enviado_cliente':'Enviado pelo Cliente',
 'pedido_compra':'Pedido de Compra',
 'art':'ART',
 'calculo_estrutural':'Cálculo Estrutural',
 'cnpj_cno':'CNPJ & CNO',
 'boletim_medicao':'Boletim de Medição',
 // Tipos de outros contextos (Entregas/Projetos) → Outro quando aparecem em Obras
 'nota_fiscal':'Outro','projeto':'Outro','projeto_executivo':'Outro',
 'fotos_obra':'Outro','romaneio_entrega':'Outro','ordem_producao':'Outro',
 'documento_especifico':'Outro'
};
function _docNormTipo(tipo) {
 if (!tipo) return 'Outro';
 if (_docTiposOrdem.includes(tipo)) return tipo;
 return _docTipoNormMapa[tipo] || 'Outro';
}
var _docTipoAtivo  = 'Proposta Comercial';
var _docCatAtiva   = 'Todos';

async function _spCarregarDocumentos(obraId) {
 var container = document.getElementById('sp-propostas-lista');
 var infoEl    = document.getElementById('sp-propostas-info');
 if (!container) return;
 container.innerHTML = '<div class="sp-empty"><div style="font-size:11px;color:var(--muted)">Carregando...</div></div>';
 if (!_dbOk) {
  container.innerHTML = '<div class="sp-empty"><div style="font-size:11px;color:var(--muted)">Banco de dados offline.</div></div>';
  return;
 }
 var [docRes, propRes] = await Promise.all([
  _sb.from('documentos').select('*').eq('obra_id', obraId).order('created_at', {ascending: false}),
  _sb.from('propostas').select('*').eq('obra_id', obraId).order('created_at', {ascending: false})
 ]);
 if (docRes.error) {
  container.innerHTML = '<div class="sp-empty"><div style="font-size:11px;color:var(--red)">Erro ao carregar documentos.</div></div>';
  return;
 }
 var docs = docRes.data || [];
 // Adiciona propostas que ainda não têm entrada em documentos
 var docsComProposta = new Set(docs.filter(function(d){ return d.proposta_id; }).map(function(d){ return d.proposta_id; }));
 (propRes.data || []).forEach(function(p) {
  if (docsComProposta.has(p.id)) return;
  docs.push({
   id: 'synth-' + p.id,
   proposta_id: p.id,
   obra_id: obraId,
   tipo: 'Proposta Comercial',
   nome: 'Proposta ' + p.numero + (p.produto ? ' — ' + p.produto : ''),
   status: p.status || 'Gerada',
   versao: p.versao || 1,
   criado_por: p.gerado_por || '—',
   created_at: p.created_at,
   updated_at: p.created_at,
   metadata: { produto: p.produto, numero: p.numero, valor_total: p.valor_total }
  });
 });
 _docCatAtiva = 'Todos'; // reseta filtro ao trocar de obra
 var grupos = {};
 _docTiposOrdem.forEach(function(t){ grupos[t] = []; });
 docs.forEach(function(d){
  var k = _docNormTipo(d.tipo);
  grupos[k].push(d);
 });
 // Ordenar cada grupo: mais recentes primeiro
 Object.keys(grupos).forEach(function(k){ grupos[k].sort(function(a,b){ return new Date(b.created_at)-new Date(a.created_at); }); });
 if (infoEl) infoEl.textContent = docs.length + ' documento' + (docs.length !== 1 ? 's' : '');

 // Tabs de categoria (Todos / Comercial / Técnico)
 var catHtml = '<div style="display:flex;gap:6px;margin-bottom:10px">'
  + ['Todos','Comercial','Técnico'].map(function(c) {
   var isA = (c === _docCatAtiva);
   return '<button id="spcat-' + c + '" onclick="_spDocCatFilter(\'' + c + '\')"'
    + ' style="font-size:10px;font-weight:700;padding:4px 13px;border-radius:20px;cursor:pointer;border:1px solid '
    + (isA ? 'var(--green)' : 'var(--border)') + ';background:' + (isA ? 'var(--green)' : 'var(--surface2)') + ';color:' + (isA ? '#fff' : 'var(--muted)') + '">'
    + c + '</button>';
  }).join('') + '</div>';

 // Tabs de tipo (filtrados pela categoria ativa)
 var tiposVisiveis = _docCatAtiva === 'Todos' ? _docTiposOrdem
  : _docTiposOrdem.filter(function(t){ return _docCategoriaMapa[t] === _docCatAtiva; });
 if (!tiposVisiveis.includes(_docTipoAtivo)) _docTipoAtivo = tiposVisiveis[0] || _docTiposOrdem[0];

 var tabsHtml = catHtml + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px" id="sp-doc-tabs">'
  + tiposVisiveis.map(function(t) {
   var cnt = grupos[t].length;
   var isA = (t === _docTipoAtivo);
   return '<button onclick="_spDocTipoFilter(\'' + t + '\')" id="spdtab-' + t.replace(/[\s\/]+/g,'-') + '"'
    + ' style="font-size:10px;font-weight:600;padding:4px 11px;border-radius:20px;cursor:pointer;white-space:nowrap;border:1px solid '
    + (isA ? 'var(--navy)' : 'var(--border)') + ';background:' + (isA ? 'var(--navy)' : 'var(--surface2)') + ';color:' + (isA ? '#fff' : 'var(--muted)') + '">'
    + t + (cnt > 0 ? ' (' + cnt + ')' : '') + '</button>';
  }).join('')
  + '</div>';

 container.innerHTML = tabsHtml + '<div id="sp-doc-list">' + _spRenderDocList(grupos[_docTipoAtivo] || [], _docTipoAtivo, obraId) + '</div>';
 container.dataset.obraDocId = obraId;
 container.dataset.obraGrupos = JSON.stringify(grupos);
}

// ── Registros fotográficos: agrega `documentos` tipo='fotos_obra' de TODOS
// os Projetos vinculados a esta Obra (o campo de fotos vive em Projetos no
// Airtable, não em Obras — auditoria via SQL: 439/439 linhas com
// projeto_id preenchido, 0 com obra_id). Bucket próprio no Storage
// (`documentos_projetos`, confirmado via storage.objects), diferente do
// bucket de documentos "normais" da obra.
async function _spCarregarRegistros(obraId, projetos) {
 var container = document.getElementById('sp-registros-lista');
 var infoEl = document.getElementById('sp-registros-info');
 if (!container) return;
 var projIds = (projetos || []).map(function(p){ return p.id; });
 if (!projIds.length) { container.innerHTML = ''; if (infoEl) infoEl.textContent = ''; return; }

 var res = await _sb.from('documentos').select('*').eq('tipo', 'fotos_obra').in('projeto_id', projIds).order('created_at', { ascending: false });
 if (res.error) { container.innerHTML = '<div class="sp-empty" style="color:var(--red)">Erro ao carregar registros.</div>'; return; }
 var fotos = res.data || [];
 if (infoEl) infoEl.textContent = fotos.length ? (fotos.length + (fotos.length === 1 ? ' foto' : ' fotos')) : '';
 if (!fotos.length) { container.innerHTML = '<div class="sp-empty">Nenhum registro fotográfico enviado ainda.</div>'; return; }

 // Assinatura em lote — todas as fotos vêm do mesmo bucket, então 1 chamada
 // resolve as URLs de todas em vez de 1 signed URL por foto.
 var paths = fotos.map(function(f){ return f.caminho_storage; }).filter(Boolean);
 var signedMap = {};
 if (paths.length) {
  var sig = await _sb.storage.from('documentos_projetos').createSignedUrls(paths, 3600);
  if (!sig.error) (sig.data || []).forEach(function(s){ if (s.signedUrl && s.path) signedMap[s.path] = s.signedUrl; });
 }

 var projNome = {};
 (projetos || []).forEach(function(p){ projNome[p.id] = p.nome || 'Projeto sem nome'; });
 var grupos = {}; var ordem = [];
 fotos.forEach(function(f) {
  var k = f.projeto_id || '—';
  if (!grupos[k]) { grupos[k] = []; ordem.push(k); }
  grupos[k].push(f);
 });

 container.innerHTML = ordem.map(function(k) {
  var itens = grupos[k].map(function(f) {
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
  return '<div style="margin-bottom:18px">'
   + '<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">' + (projNome[k] || 'Projeto') + ' (' + grupos[k].length + ')</div>'
   + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:8px">' + itens + '</div>'
   + '</div>';
 }).join('');
}

function _spRegistrosDropzone() {
 return '<label id="sp-registros-dz" style="display:flex;align-items:center;justify-content:center;gap:6px;height:100%;border:2px dashed var(--border);border-radius:8px;padding:9px 8px;cursor:pointer;transition:border-color .15s,background .15s;text-align:center;font-size:11px;color:var(--muted)"'
  + ' onmouseover="this.style.borderColor=\'var(--navy)\';this.style.background=\'rgba(59,130,246,.04)\'"'
  + ' onmouseout="this.style.borderColor=\'var(--border)\';this.style.background=\'\'"'
  + ' ondragover="event.preventDefault();this.style.borderColor=\'var(--navy)\';this.style.background=\'rgba(59,130,246,.07)\'"'
  + ' ondragleave="this.style.borderColor=\'var(--border)\';this.style.background=\'\'"'
  + ' ondrop="_spRegistrosDrop(event)">'
  + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.7"><path d="M12 16V8M8 12l4-4 4 4"/><path d="M20 16.5A4.5 4.5 0 0015.5 12H15a6 6 0 10-11.8 1.5"/></svg>'
  + '<span id="sp-registros-dz-lbl">Clique ou arraste fotos para adicionar</span>'
  + '<input type="file" id="sp-registros-file" accept="image/*" multiple style="display:none" onchange="_spRegistrosFileChange(this)">'
  + '</label>';
}
async function _spUploadRegistro(file, projetoId, obraId) {
 var path = 'projetos/' + projetoId + '/' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9_.\-]/g,'_');
 var up = await _sb.storage.from('documentos_projetos').upload(path, file, { upsert: false });
 if (up.error) { console.error('[Obras] erro ao enviar registro:', up.error); return false; }
 var ins = await _sb.from('documentos').insert({
  projeto_id: projetoId, obra_id: obraId, nome_arquivo: file.name, tipo: 'fotos_obra',
  categoria: 'Técnico', caminho_storage: path, tamanho_bytes: file.size, mime_type: file.type,
  status: 'Ativo', versao: 1, origem: 'upload_manual',
 });
 if (ins.error) { console.error('[Obras] erro ao registrar foto:', ins.error); return false; }
 return true;
}
async function _spRegistrosUploadFiles(files) {
 if (!files || !files.length) return;
 var projetoId = document.getElementById('sp-registros-projeto')?.value;
 var obraId = _obraAtiva && _obraAtiva.id;
 if (!projetoId) { alert('Selecione o projeto ao qual as fotos pertencem.'); return; }
 var lbl = document.getElementById('sp-registros-dz-lbl');
 if (lbl) lbl.textContent = 'Enviando...';
 var erros = 0;
 for (var i = 0; i < files.length; i++) { if (!(await _spUploadRegistro(files[i], projetoId, obraId))) erros++; }
 if (lbl) lbl.textContent = 'Clique ou arraste fotos para adicionar';
 if (erros) alert(erros + ' foto(s) não enviada(s). Tente novamente.');
 _spCarregarRegistros(obraId, (_obraAtiva && _obraAtiva.projetos) || []);
}
function _spRegistrosFileChange(input) {
 _spRegistrosUploadFiles(Array.prototype.slice.call(input.files || []));
 input.value = '';
}
function _spRegistrosDrop(event) {
 event.preventDefault();
 var dz = event.currentTarget; dz.style.borderColor = 'var(--border)'; dz.style.background = '';
 var files = event.dataTransfer && event.dataTransfer.files;
 _spRegistrosUploadFiles(Array.prototype.slice.call(files || []));
}

function _spDocTipoFilter(tipo) {
 _docTipoAtivo = tipo;
 var container = document.getElementById('sp-propostas-lista');
 if (!container) return;
 _docTiposOrdem.forEach(function(t) {
  var btn = document.getElementById('spdtab-' + t.replace(/[\s\/]+/g,'-'));
  if (!btn) return;
  var isA = (t === tipo);
  btn.style.background   = isA ? 'var(--navy)' : 'var(--surface2)';
  btn.style.color        = isA ? '#fff' : 'var(--muted)';
  btn.style.borderColor  = isA ? 'var(--navy)' : 'var(--border)';
 });
 try {
  var grupos = JSON.parse(container.dataset.obraGrupos || '{}');
  var listEl = document.getElementById('sp-doc-list');
  if (listEl) listEl.innerHTML = _spRenderDocList(grupos[tipo] || [], tipo, container.dataset.obraDocId || '');
 } catch(e){}
}

function _spDocCatFilter(cat) {
 _docCatAtiva = cat;
 var container = document.getElementById('sp-propostas-lista');
 if (!container) return;
 ['Todos','Comercial','Técnico'].forEach(function(c) {
  var btn = document.getElementById('spcat-' + c);
  if (!btn) return;
  var isA = (c === cat);
  btn.style.background  = isA ? 'var(--green)' : 'var(--surface2)';
  btn.style.color       = isA ? '#fff' : 'var(--muted)';
  btn.style.borderColor = isA ? 'var(--green)' : 'var(--border)';
 });
 try {
  var grupos = JSON.parse(container.dataset.obraGrupos || '{}');
  // Filtra tipos pela categoria ativa
  var tiposFiltrados = cat === 'Todos' ? _docTiposOrdem
   : _docTiposOrdem.filter(function(t){ return _docCategoriaMapa[t] === cat; });
  // Reseta tabs de tipo para o primeiro do grupo filtrado
  if (!tiposFiltrados.includes(_docTipoAtivo)) {
   _docTipoAtivo = tiposFiltrados[0] || _docTiposOrdem[0];
  }
  // Reconstrói a lista de tabs e o conteúdo
  var tabsEl = document.getElementById('sp-doc-tabs');
  if (tabsEl) {
   tabsEl.innerHTML = tiposFiltrados.map(function(t) {
    var cnt = (grupos[t] || []).length;
    var isA = (t === _docTipoAtivo);
    return '<button onclick="_spDocTipoFilter(\'' + t + '\')" id="spdtab-' + t.replace(/[\s\/]+/g,'-') + '"'
     + ' style="font-size:10px;font-weight:600;padding:4px 11px;border-radius:20px;cursor:pointer;white-space:nowrap;border:1px solid '
     + (isA ? 'var(--navy)' : 'var(--border)') + ';background:' + (isA ? 'var(--navy)' : 'var(--surface2)') + ';color:' + (isA ? '#fff' : 'var(--muted)') + '">'
     + t + (cnt > 0 ? ' (' + cnt + ')' : '') + '</button>';
   }).join('');
  }
  var listEl = document.getElementById('sp-doc-list');
  if (listEl) listEl.innerHTML = _spRenderDocList(grupos[_docTipoAtivo] || [], _docTipoAtivo, container.dataset.obraDocId || '');
 } catch(e){}
}

function _spToggleUploadDoc() {
 var f = document.getElementById('sp-upload-doc-form');
 if (!f) return;
 var isOpen = f.style.display !== 'none';
 f.style.display = isOpen ? 'none' : 'block';
 if (!isOpen) {
  // Reset form ao abrir
  var nEl = document.getElementById('sp-upload-nome');
  var fEl = document.getElementById('sp-upload-file');
  var lbl = document.getElementById('sp-upload-file-label');
  if (nEl) nEl.value = '';
  if (fEl) fEl.value = '';
  if (lbl) lbl.innerHTML = 'Clique para selecionar ou arraste o arquivo aqui<br><span style="font-size:10px">PDF, JPG, PNG, XLSX, DOC</span>';
  var dz = document.getElementById('sp-upload-dropzone');
  if (dz) { dz.style.borderColor = 'var(--border)'; dz.style.background = ''; }
  setTimeout(function(){ var el = document.getElementById('sp-upload-nome'); if(el) el.focus(); }, 50);
 }
}

function _spUploadFileChange(input) {
 var file = input.files && input.files[0];
 var lbl = document.getElementById('sp-upload-file-label');
 var dz  = document.getElementById('sp-upload-dropzone');
 if (!file || !lbl) return;
 var kb = (file.size / 1024).toFixed(0);
 var mb = file.size > 1024*1024 ? (file.size/1024/1024).toFixed(1) + ' MB' : kb + ' KB';
 lbl.innerHTML = '<span style="color:var(--green);font-weight:700">✓ ' + file.name + '</span><br><span style="font-size:10px;color:var(--muted)">' + mb + '</span>';
 if (dz) { dz.style.borderColor = 'var(--green)'; dz.style.background = 'rgba(34,197,94,.04)'; }
 // Auto-preenche nome se estiver vazio
 var nEl = document.getElementById('sp-upload-nome');
 if (nEl && !nEl.value.trim()) {
  var base = file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g,' ');
  nEl.value = base.charAt(0).toUpperCase() + base.slice(1);
 }
}

function _spUploadDrop(event) {
 event.preventDefault();
 var dz = document.getElementById('sp-upload-dropzone');
 if (dz) { dz.style.borderColor = 'var(--border)'; dz.style.background = ''; }
 var files = event.dataTransfer && event.dataTransfer.files;
 if (!files || !files.length) return;
 var fileInput = document.getElementById('sp-upload-file');
 if (!fileInput) return;
 // Atribui via DataTransfer
 try {
  var dt = new DataTransfer();
  dt.items.add(files[0]);
  fileInput.files = dt.files;
  _spUploadFileChange(fileInput);
 } catch(e) { _showToast('Arraste não suportado — use o botão de seleção', 'aviso'); }
}

function _spUploadTipoChange(val) {
 // Auto-ajusta nome se já tiver algo e for placeholder genérico
}

async function _spEnviarDocObra() {
 var obraId = _obraAtiva && _obraAtiva.id;
 if (!obraId) { _showToast('Obra não identificada', 'erro'); return; }
 var nome  = (document.getElementById('sp-upload-nome')?.value || '').trim();
 var tipo  = document.getElementById('sp-upload-tipo')?.value || 'Outro';
 var file  = document.getElementById('sp-upload-file')?.files?.[0];
 if (!nome) { _showToast('Informe o nome do documento', 'aviso'); document.getElementById('sp-upload-nome')?.focus(); return; }
 if (!file) { _showToast('Selecione um arquivo', 'aviso'); return; }

 var btn = document.getElementById('sp-upload-send-btn');
 if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; btn.style.opacity = '0.7'; }

 var ext  = file.name.split('.').pop().toLowerCase();
 var path = obraId + '/' + Date.now() + '_' + nome.replace(/[^a-zA-Z0-9_\-]/g,'_') + '.' + ext;
 var categoria = _docCategoriaMapa[tipo] || 'Técnico';
 var userEmail = (_currentUser && _currentUser.email) || localStorage.getItem('milatec-user-email') || '';

 var upRes = await _sb.storage.from('documentos_obras').upload(path, file, { upsert: false });
 if (upRes.error) {
  _showToast('Erro no upload: ' + upRes.error.message, 'erro');
  if (btn) { btn.disabled = false; btn.textContent = 'Enviar documento'; btn.style.opacity = ''; }
  return;
 }

 var ins = await _sb.from('documentos').insert({
  obra_id: obraId,
  nome_arquivo: nome,
  nome: nome,
  tipo: tipo,
  categoria: categoria,
  caminho_storage: path,
  tamanho_bytes: file.size,
  mime_type: file.type,
  status: 'Ativo',
  versao: 1,
  criado_por: userEmail,
  origem: 'upload_manual'
 });
 if (ins.error) {
  _showToast('Arquivo enviado, mas erro ao registrar: ' + ins.error.message, 'aviso');
  if (btn) { btn.disabled = false; btn.textContent = 'Enviar documento'; btn.style.opacity = ''; }
  return;
 }

 _showToast('Documento anexado com sucesso!', 'ok');
 _spToggleUploadDoc(); // fecha e reseta
 _docTipoAtivo = tipo; // abre direto na aba do tipo enviado
 _spCarregarDocumentos(obraId);
}

function _spRenderDocList(docs, tipo, obraId) {
 var sColors = { 'Gerada':'#6b6b82','Enviada':'#3B7CF0','Em negociação':'#9a7000','Aceita':'#1F8A4C','Recusada':'#d32f2f','Ativo':'#1F8A4C','ativo':'#1F8A4C','Rascunho':'#9a7000','Cancelado':'#d32f2f','Realizada':'#1F8A4C' };
 var sOpts   = tipo === 'Proposta Comercial'
  ? ['Gerada','Enviada','Em negociação','Aceita','Recusada','Realizada']
  : ['Ativo','Rascunho','Cancelado'];
 if (docs.length === 0) {
  return '<div class="sp-empty"><div style="font-weight:600;margin-bottom:4px">Nenhum documento</div>'
   + '<div style="font-size:11px">Nenhum(a) ' + tipo + ' registrado(a) para esta obra.</div>'
   + (tipo === 'Proposta Comercial' ? '<div style="font-size:11px;margin-top:4px;color:var(--navy)">Use a aba Visão Geral para gerar uma proposta.</div>' : '')
   + '</div>';
 }
 return docs.map(function(d) {
  var sc    = sColors[d.status] || '#6b6b82';
  var dtC   = new Date(d.created_at);
  var dtU   = new Date(d.updated_at);
  var dtCFmt = dtC.toLocaleDateString('pt-BR') + ' às ' + dtC.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  var dtUFmt = dtU.toLocaleDateString('pt-BR') + ' às ' + dtU.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  var stAtual = d.status || '';
  var opts  = (stAtual && !sOpts.includes(stAtual) ? '<option value="'+stAtual+'" selected>'+stAtual+'</option>' : '')
             + sOpts.map(function(s){ return '<option value="'+s+'"'+(stAtual===s?' selected':'')+'>'+s+'</option>'; }).join('');
  var pid   = d.proposta_id ? ("'" + d.proposta_id + "'") : null;
  var spath = (d.caminho_storage && d.status !== 'Pendente Upload') ? d.caminho_storage : null;
  var meta  = d.metadata || {};
  var nomeExib = d.nome || d.nome_arquivo || d.arquivo_nome || '—';
  var isAirtable = d.origem === 'airtable_importado';
  return '<div style="border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:10px;background:var(--surface)">'
   + '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px">'
   + '<div style="flex:1;min-width:0">'
   + '<div style="font-size:12px;font-weight:700;color:var(--navy);line-height:1.4">' + nomeExib + '</div>'
   + '<div style="display:flex;align-items:center;gap:6px;margin-top:2px">'
   + '<span style="font-size:10px;color:var(--muted)">' + (d.tipo || '—') + '</span>'
   + (d.categoria ? '<span style="font-size:9px;font-weight:600;padding:1px 6px;border-radius:20px;border:1px solid var(--border);color:var(--muted)">' + d.categoria + '</span>' : '')
   + (isAirtable ? '<span style="font-size:9px;font-weight:600;color:#1a5c8a;background:#e8f4fd;border:1px solid #b3d9f5;padding:1px 6px;border-radius:20px">Enviado manualmente</span>' : '')
   + (d.status === 'Pendente Upload' ? '<span style="font-size:9px;font-weight:600;color:#d32f2f;background:#fdecea;border:1px solid #f5c6cb;padding:1px 6px;border-radius:20px">Arquivo indisponível</span>' : '')
   + '</div>'
   + '</div>'
   + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">'
   + '<div style="background:var(--surface2);color:var(--text);font-size:9px;font-weight:700;padding:2px 9px;border-radius:20px;border:1px solid var(--border)">V' + (d.versao||1) + '</div>'
   + '<div style="background:' + sc + '22;color:' + sc + ';font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;padding:2px 9px;border-radius:20px;white-space:nowrap">' + (d.status||'—') + '</div>'
   + '</div>'
   + '</div>'
   + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px 12px;font-size:10px;margin-bottom:10px;padding-top:8px;border-top:1px solid var(--border)">'
   + '<div><div style="color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:1px">Criado por</div><div style="color:var(--text)">' + (d.criado_por || '—') + '</div></div>'
   + '<div><div style="color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:1px">Criado em</div><div style="color:var(--text)">' + dtCFmt + '</div></div>'
   + (d.atualizado_por ? '<div><div style="color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:1px">Atualizado por</div><div style="color:var(--text)">' + d.atualizado_por + '</div></div>' : '')
   + (d.atualizado_por ? '<div><div style="color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:1px">Última alteração</div><div style="color:var(--text)">' + dtUFmt + '</div></div>' : '')
   + '</div>'
   + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">'
   + '<span style="font-size:10px;color:var(--muted);white-space:nowrap">Status:</span>'
   + '<select style="flex:1;font-size:11px;padding:4px 8px;border:1px solid var(--border);border-radius:5px;background:var(--surface2);color:var(--text);cursor:pointer" onchange="_spAtualizarStatusDoc(\'' + d.id + '\',this.value)">' + opts + '</select>'
   + '</div>'
   + '<div style="display:flex;gap:6px">'
   + (pid ? '<button onclick="_spVisualizarProposta(' + pid + ')" style="flex:1;font-size:11px;font-weight:600;padding:6px;border:none;border-radius:5px;background:var(--navy);color:#fff;cursor:pointer">Visualizar</button>' : '')
   + (pid ? '<button onclick="_spDownloadProposta(' + pid + ')" style="flex:1;font-size:11px;font-weight:600;padding:6px;border:1px solid var(--border);border-radius:5px;background:var(--surface2);color:var(--text);cursor:pointer">Download</button>' : '')
   + (!pid && spath ? '<button onclick="_spAbrirDocStorage(\'' + spath.replace(/\\/g,'\\\\').replace(/'/g,"\\'") + '\',\'' + (nomeExib||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'") + '\')" style="flex:1;font-size:11px;font-weight:600;padding:6px;border:none;border-radius:5px;background:var(--navy);color:#fff;cursor:pointer">Visualizar PDF</button>' : '')
   + (pid && meta.produto ? '<button onclick="_spDocHistorico(\'' + (obraId||'') + '\',\'' + (meta.produto||'').replace(/'/g,"\\'") + '\')" style="flex:1;font-size:11px;font-weight:600;padding:6px;border:1px solid var(--border);border-radius:5px;background:var(--surface2);color:var(--text);cursor:pointer">Histórico</button>' : '')
   + '</div>'
   + '</div>';
 }).join('');
}

async function _spVisualizarProposta(propostaId) {
 if (!_dbOk) { _showToast('Banco de dados offline', 'erro'); return; }
 var res = await _sb.from('propostas').select('*').eq('id', propostaId).single();
 if (res.error || !res.data) { _showToast('Proposta não encontrada', 'erro'); return; }
 var p = res.data;
 var empresaNome = '', empresaCnpj = '', cidadeUf = '';
 if (p.empresa_id) {
  var er = await _sb.from('empresas').select('nome,cnpj').eq('id', p.empresa_id).single();
  if (!er.error && er.data) { empresaNome = er.data.nome || ''; empresaCnpj = er.data.cnpj || ''; }
 }
 if (p.obra_id) {
  var or2 = await _sb.from('obras').select('cidade,estado,nome').eq('id', p.obra_id).single();
  if (!or2.error && or2.data) {
   cidadeUf = [or2.data.cidade, or2.data.estado].filter(Boolean).join(' - ');
   if (!empresaNome) empresaNome = or2.data.nome || '';
  }
 }
 var dtFmt = p.data_geracao
  ? new Date(p.data_geracao + 'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})
  : new Date(p.created_at).toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'});
 abrirPropostaDaTabela({
  produto: p.produto, numero: p.numero, data: dtFmt, versao: p.versao,
  empresaNome: empresaNome, empresaCnpj: empresaCnpj, cidadeUf: cidadeUf,
  qtd: p.quantidade, vuni: p.valor_unitario,
  frete: p.frete, icms: p.aliquota_icms,
  consumidorFinal: p.consumidor_final, difalPercentual: p.difal_percentual,
 });
}

async function _spDownloadProposta(propostaId) {
 await _spVisualizarProposta(propostaId);
 setTimeout(function(){ var m = document.getElementById('proposta-modal'); if (m) { var b = m.querySelector('button[onclick*="print"]'); if (b) b.click(); } }, 800);
}

async function _spAbrirDocStorage(path, nomeArquivo, bucket) {
 if (!_dbOk) { _showToast('Banco de dados offline', 'erro'); return; }
 if (!path) { _showToast('Caminho do arquivo não encontrado', 'erro'); return; }
 // Mostrar modal com loading
 _spDocPdfModal(null, nomeArquivo || 'Documento');
 try {
  var res = await _sb.storage.from(bucket || 'documentos_obras').createSignedUrl(path, 3600);
  if (res.error) {
   console.error('[Storage] createSignedUrl erro:', res.error, '| path:', path);
   _spDocPdfModalErro('Erro ao carregar: ' + (res.error.message || 'Sem permissão ou arquivo não encontrado'));
   return;
  }
  var url = res.data && res.data.signedUrl;
  if (!url) { _spDocPdfModalErro('Link não gerado — tente novamente'); return; }
  _spDocPdfModalUrl(url, nomeArquivo || 'documento.pdf');
 } catch(e) {
  console.error('[Storage] exceção:', e);
  _spDocPdfModalErro('Erro inesperado ao carregar PDF');
 }
}

function _spDocPdfModal(url, nome) {
 var existing = document.getElementById('doc-pdf-modal');
 if (existing) existing.remove();
 var modal = document.createElement('div');
 modal.id = 'doc-pdf-modal';
 modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:4000;display:flex;flex-direction:column;align-items:center;justify-content:center';
 modal.innerHTML =
  '<div style="background:var(--surface);border-radius:12px;width:min(860px,96vw);height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 80px rgba(0,0,0,.4);overflow:hidden">'
  + '<div style="display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--border);flex-shrink:0">'
  + '<div style="font-size:13px;font-weight:700;color:var(--text);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" id="doc-pdf-modal-title">' + (nome || 'Documento') + '</div>'
  + '<a id="doc-pdf-dl-btn" style="display:none;font-size:11px;font-weight:600;padding:6px 14px;border:none;border-radius:6px;background:var(--navy);color:#fff;cursor:pointer;text-decoration:none;white-space:nowrap;align-items:center;gap:5px" download><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px"><path d="M8 2v9M4 8l4 4 4-4"/><path d="M2 14h12"/></svg>Baixar</a>'
  + '<button onclick="document.getElementById(\'doc-pdf-modal\').remove()" style="background:none;border:none;font-size:22px;line-height:1;cursor:pointer;color:var(--muted);padding:0 4px;flex-shrink:0">×</button>'
  + '</div>'
  + '<div id="doc-pdf-modal-body" style="flex:1;display:flex;align-items:center;justify-content:center;background:#f0f0f0">'
  + '<div style="text-align:center;color:#888"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="1.5" style="margin-bottom:8px;animation:spin 1s linear infinite"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg><div style="font-size:12px">Carregando...</div></div>'
  + '</div>'
  + '</div>';
 document.body.appendChild(modal);
 modal.addEventListener('click', function(e){ if (e.target === modal) modal.remove(); });
}

function _spDocPdfModalUrl(url, nome) {
 var body = document.getElementById('doc-pdf-modal-body');
 var dlBtn = document.getElementById('doc-pdf-dl-btn');
 var title = document.getElementById('doc-pdf-modal-title');
 if (title) title.textContent = nome || 'Documento';
 if (dlBtn) { dlBtn.href = url; dlBtn.download = nome || 'documento.pdf'; dlBtn.style.display = 'inline-block'; }
 if (body) body.innerHTML = '<iframe src="' + url + '" style="width:100%;height:100%;border:none" title="' + (nome||'PDF') + '"></iframe>';
}

function _spDocPdfModalErro(msg) {
 var body = document.getElementById('doc-pdf-modal-body');
 if (body) body.innerHTML = '<div style="text-align:center;color:#c00;padding:24px"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#c00" stroke-width="1.5" style="margin-bottom:8px"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><div style="font-size:12px">' + msg + '</div></div>';
}

async function _spDocHistorico(obraId, produto) {
 if (!_dbOk) return;
 var res = await _sb.from('propostas').select('*').eq('obra_id', obraId).eq('produto', produto).order('versao', { ascending: true });
 if (res.error || !res.data) { _showToast('Erro ao carregar histórico', 'erro'); return; }
 var rows = res.data;
 var sColors = { 'Gerada':'#6b6b82','Enviada':'#3D4FD1','Em negociação':'#9a7000','Aceita':'#1F8A4C','Recusada':'#d32f2f' };
 var inner = rows.map(function(p) {
  var dt    = new Date(p.created_at);
  var dtFmt = dt.toLocaleDateString('pt-BR') + ' às ' + dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  var sc    = sColors[p.status] || '#6b6b82';
  return '<div style="border:1px solid var(--border);border-radius:7px;padding:10px 12px;margin-bottom:8px;display:flex;align-items:center;gap:10px">'
   + '<div style="background:var(--navy);color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;white-space:nowrap">V' + (p.versao||1) + '</div>'
   + '<div style="flex:1;min-width:0">'
   + '<div style="font-size:12px;font-weight:600;color:var(--text)">' + (p.numero||'—') + '</div>'
   + '<div style="font-size:10px;color:var(--muted);margin-top:1px">' + dtFmt + (p.gerado_por ? ' · ' + p.gerado_por : '') + '</div>'
   + '</div>'
   + '<div style="background:' + sc + '22;color:' + sc + ';font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;padding:2px 8px;border-radius:20px;white-space:nowrap;margin-right:4px">' + (p.status||'Gerada') + '</div>'
   + '<button onclick="_spVisualizarProposta(\'' + p.id + '\')" style="background:var(--navy);color:#fff;border:none;padding:5px 10px;border-radius:5px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap">Abrir</button>'
   + '</div>';
 }).join('');
 var modal = document.createElement('div');
 modal.id = 'hist-modal';
 modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:3000;display:flex;align-items:center;justify-content:center';
 modal.onclick = function(ev){ if (ev.target === modal) modal.remove(); };
 modal.innerHTML = '<div style="background:var(--surface);border-radius:12px;padding:24px;width:560px;max-width:95vw;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.3)">'
  + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">'
  + '<div style="font-size:13px;font-weight:700;color:var(--text)">Histórico de versões · ' + produto + '</div>'
  + '<button onclick="document.getElementById(\'hist-modal\').remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--muted);line-height:1">×</button>'
  + '</div>'
  + (inner || '<div style="font-size:11px;color:var(--muted);text-align:center;padding:16px">Nenhuma versão encontrada.</div>')
  + '</div>';
 document.body.appendChild(modal);
}

async function _spAtualizarStatusDoc(id, status) {
 if (!_dbOk) return;
 var geradoPor = (_currentUser && (_currentUser.email || _currentUser.name)) || localStorage.getItem('milatec-user-email') || null;
 var res;
 if (id && id.startsWith('synth-')) {
  // Doc sintético: atualiza na tabela propostas
  var propostaId = id.replace('synth-', '');
  res = await _sb.from('propostas').update({ status: status }).eq('id', propostaId);
 } else {
  res = await _sb.from('documentos').update({ status: status, atualizado_por: geradoPor, updated_at: new Date().toISOString() }).eq('id', id);
 }
 if (res.error) _showToast('Erro ao atualizar status: ' + _supaErrPt(res.error.message), 'erro');
 else _showToast('Status atualizado para "' + status + '"', 'ok');
}

// ── Renderer principal do painel de obra (com abas) ───────────────────────────
async function _spObrasRender(o, projetos, entregas, instalacoes, atividades) {
 entregas    = entregas    || [];
 instalacoes = instalacoes || [];
 atividades  = atividades  || [];
 try {
 var tipoArr = o.tipo_obra || [];
 var etapas  = Object.keys(_etapaKcId);
 // Lista antiga ('Indicação','Google Ads','Instagram'...) era um enum de
 // marketing inventado que nunca bateu com o que o Airtable de fato usa —
 // canal_vendas lá é quase texto livre (nome de representante, campanhas
 // como "FICONS 2024"), não um canal de mídia. Vocabulário real por
 // distribuição (select canal_vendas, count(*) from obras group by 1).
 var canais = CANAL_VENDAS_OPCOES.slice();
 if (o.canal_vendas && canais.indexOf(o.canal_vendas) === -1) canais.push(o.canal_vendas);

 // ── Proposta Comercial Solar: vincula via projeto com produto solar ───────────
 var SOLAR_PRODUTOS = ['Solo','Carport 2 Linhas','Carport 3 Linhas','Laje'];
 var projSolar = projetos.find(function(p){
  return (p.produto || []).some(function(pr){ return SOLAR_PRODUTOS.includes(pr); });
 });
 var prodSolar = projSolar && (projSolar.produto || []).find(function(pr){ return SOLAR_PRODUTOS.includes(pr); });
 var mostrarPropostaSolar = tipoArr.includes('Solar') && !!projSolar;

 // UF de destino para fins de ICMS/DIFAL: usa o estado cadastrado da empresa
 // (cliente/destinatário da nota fiscal); se não houver, cai para a UF da obra.
 var empresaCadastroSolar = _empresasArr.find(function(e){ return e.id === o.empresa_id; });
 var ufDestino    = (empresaCadastroSolar && empresaCadastroSolar.estado) || o.estado;
 var icmsAuto     = !(projSolar && projSolar.aliquota_icms);
 var icmsDefault  = (projSolar && projSolar.aliquota_icms) || (ufDestino === 'SE' ? '19' : '12');
 var difalAuto    = !(projSolar && projSolar.difal_percentual != null);
 var difalDefault = (projSolar && projSolar.difal_percentual != null) ? projSolar.difal_percentual : (_difalTabelaUF[ufDestino] != null ? _difalTabelaUF[ufDestino] : '');

 // Pedido explícito: datas apareciam cruas em ISO ("YYYY-MM-DD") em vez do
 // padrão brasileiro. new Date(d) sozinho (sem 'T00:00:00') interpreta a
 // string como UTC meia-noite — em fusos negativos (Brasil inteiro) isso
 // exibe o dia ANTERIOR ao gravado no banco; por isso o 'T00:00:00' fixo
 // (mesmo truque já usado em "Data envio da proposta" etc. neste arquivo).
 function fmtData(d)  { return d ? new Date(String(d).substring(0,10) + 'T00:00:00').toLocaleDateString('pt-BR') : '—'; }
 function fmtMoeda(v) { return v != null ? 'R$ ' + Number(v).toLocaleString('pt-BR', {minimumFractionDigits:2}) : '—'; }
 function fmtDias(n)  { return n ? n + ' dia' + (n != 1 ? 's' : '') : '—'; }

 // ── Totais dos projetos ──────────────────────────────────────────────────────
 var totalQtd   = projetos.reduce(function(s, p){ return s + (Number(p.quantidade) || 0); }, 0);
 var totalValor = projetos.reduce(function(s, p){ return s + (Number(p.valor_unitario) * Number(p.quantidade || 1) || 0); }, 0);
 var totalPeso  = projetos.reduce(function(s, p){ return s + (Number(p.peso_kg) || 0); }, 0);

 // ── Cards de projetos ────────────────────────────────────────────────────────
 var etapaCls = {
  'Orçamento':             'bm',
  'Aguardando Aprovação':  'by',
  'Pré-Projeto':           'bm',
  'Pré-projeto':           'bm',
  'Revisão Pré-Projeto':   'by',
  'Projeto para aprovação':'bb',
  'Revisão Executivo':     'by',
  'Projeto Executivo':     'bb',
  'Ajuste de Piloto':      'by',
  'Análise Inicial':       'bm',
  'Projeto em Andamento':  'by',
  'Projeto Finalizado':    'bg',
  'Concluído':             'bg',
  'Aprovado':              'bg'
 };
 var complCls = {'Simples':'bg','Média':'by','Média - simples':'by','Complexa':'br','Alta':'br'};
 var projCards = projetos.length
  ? '<div style="overflow-x:auto;margin:0 -2px">'
    + '<table style="width:100%;border-collapse:collapse;font-size:12px">'
    + '<thead><tr style="border-bottom:2px solid var(--border)">'
    + '<th style="padding:7px 10px;text-align:left;color:var(--muted);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;white-space:nowrap">Projeto</th>'
    + '<th style="padding:7px 10px;text-align:left;color:var(--muted);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;white-space:nowrap">Etapa do Projeto</th>'
    + '<th style="padding:7px 10px;text-align:left;color:var(--muted);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;white-space:nowrap">Tipo de orçamento</th>'
    + '<th style="padding:7px 10px;text-align:left;color:var(--muted);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;white-space:nowrap">Produto</th>'
    + '<th style="padding:7px 8px;text-align:right;color:var(--muted);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;white-space:nowrap">Valor total</th>'
    + '<th style="padding:7px 8px;text-align:right;color:var(--muted);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;white-space:nowrap">Quantidade</th>'
    + '<th style="padding:7px 10px;text-align:left;color:var(--muted);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;white-space:nowrap">Alterado por último</th>'
    + '</tr></thead><tbody>'
    + projetos.map(function(p){
       var pTipo  = p.tipo_orcamento || '';
       var pEtapa = p.etapa_projeto  || '';
       var pProd  = (p.produto || [])[0] || '—';
       var pCompl = p.complexidade   || '';
       var pValor = p.valor_unitario != null
        ? (p.quantidade != null ? fmtMoeda(Number(p.valor_unitario) * Number(p.quantidade)) : fmtMoeda(p.valor_unitario))
        : '—';
       // "Alterado por último" é quem editou o REGISTRO por último
       // (projetos.atualizado_por, e-mail setado pelo trigger
       // trg_projetos_atualizado_por a cada INSERT/UPDATE — mesmo padrão de
       // atividades.atualizado_por em tarefas.js), não o responsável pelo
       // projeto — antes essa coluna mostrava p.responsavel, dando a entender
       // (errado) que o responsável tinha sido quem fez a última alteração.
       var pAtuU = (_usuariosCache || []).find(function(x){ return x.email === p.atualizado_por; });
       var pAtu  = p.atualizado_por ? ((pAtuU && pAtuU.nome_display) || p.atualizado_por) : '';
       var initials = pAtu
        ? pAtu.trim().split(/\s+/).slice(0,2).map(function(w){ return w[0] || ''; }).join('').toUpperCase()
        : '';
       // Linha já vinha com cursor:pointer + hover, mas nunca teve onclick —
       // parecia clicável e não fazia nada. _spOpenEntityById (side-panel.js)
       // é o mesmo usado pelos chips de "vinculado(s)" em todo o resto do app.
       return '<tr style="border-bottom:1px solid var(--border);cursor:pointer;transition:background .12s"'
        + ' onclick="_spOpenEntityById(\'projetos\',\'' + p.id + '\')"'
        + ' onmouseover="this.style.background=\'var(--surface2)\'"'
        + ' onmouseout="this.style.background=\'\'">'
        + '<td style="padding:8px 10px">'
        + '<div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px" title="'
        + (p.nome||'').replace(/"/g,'&quot;') + '">' + (p.nome || '(sem nome)') + '</div>'
        + (pCompl ? '<div style="margin-top:3px"><span class="badge ' + (complCls[pCompl]||'bm') + '" style="font-size:9px">' + pCompl + '</span></div>' : '')
        + '</td>'
        + '<td style="padding:8px 10px;white-space:nowrap">'
        + (pEtapa ? '<span class="badge ' + (etapaCls[pEtapa]||'bm') + '" style="font-size:10px">' + pEtapa + '</span>' : '<span style="color:var(--muted)">—</span>')
        + '</td>'
        + '<td style="padding:8px 10px;white-space:nowrap">'
        + (pTipo ? '<span class="badge ' + _tipoOrcamentoBadgeCls(pTipo) + '" style="font-size:10px">' + pTipo + '</span>' : '<span style="color:var(--muted)">—</span>')
        + '</td>'
        + '<td style="padding:8px 10px;white-space:nowrap">'
        + (pProd !== '—' ? '<span class="badge bm" style="font-size:10px">' + pProd + '</span>' : '<span style="color:var(--muted)">—</span>')
        + '</td>'
        + '<td style="padding:8px 8px;text-align:right;font-size:12px;color:var(--green);font-weight:600;white-space:nowrap">' + pValor + '</td>'
        + '<td style="padding:8px 8px;text-align:right;font-size:12px;color:var(--text);white-space:nowrap">' + (p.quantidade != null ? p.quantidade : '—') + '</td>'
        + '<td style="padding:8px 10px">'
        + (pAtu
           ? '<div style="display:flex;align-items:center;gap:6px">'
             + '<div style="width:22px;height:22px;border-radius:50%;background:var(--navy-dim);border:1px solid var(--navy);display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:var(--navy);flex-shrink:0">' + initials + '</div>'
             + '<span style="font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:90px">' + pAtu + '</span>'
             + '</div>'
           : '<span style="color:var(--muted)">—</span>')
        + '</td>'
        + '</tr>';
      }).join('')
    + '</tbody></table></div>'
  : '<div class="sp-empty">Nenhum projeto vinculado a esta obra</div>';

 // ── Cards de entregas ────────────────────────────────────────────────────────
 // Referência explícita: card do Airtable (Etapa/Quantidade/Faturamento/
 // Transporte/Peso/Valor num grid compacto, badge de etapa colorido). Grid
 // em vez da linha única "Etapa: X | Qtd: Y | ..." de antes — com 6 campos
 // ao mesmo tempo a linha única ficava apertada/cortando em telas menores.
 function _entCampo(label, valor) {
  return '<div><div class="sp-label" style="margin-bottom:1px">' + label + '</div><div style="font-size:12px;color:var(--text)">' + valor + '</div></div>';
 }
 var entregaCards = entregas.length
  ? entregas.map(function(e){
     var bucket = _entBucketFor(e.etapa);
     var etapaBadge = e.etapa
      ? '<span class="badge" style="background:' + _entBucketCor[bucket] + '22;color:' + _entBucketCor[bucket] + ';font-size:10px">' + e.etapa + '</span>'
      : '—';
     // onclick no card inteiro (não só no título) — achado real: só o texto
     // do título respondia ao clique, o resto do card (grid de campos)
     // parecia clicável (cursor:pointer herdado de .sp-item-card) mas não
     // fazia nada.
     // Excluir (permanente) é diferente de desvincular (só solta da obra) —
     // pedido explícito: só admin pode ver/usar esse botão. Checagem só do
     // lado do cliente (esconder o botão) não bastaria sozinha — a política
     // de DELETE em `entregas` também foi restrita a admin no banco
     // (migração restrict_obras_entregas_delete_to_admin), senão qualquer
     // usuário autenticado ainda conseguiria apagar via console.
     var isAdmin = !!(_currentUser && _currentUser.isAdmin);
     return '<div class="sp-item-card" onclick="_spOpenEntityById(\'entregas\',\'' + e.id + '\')">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">'
      + '<div class="sp-item-title" style="margin-bottom:0">' + (e.nome_entrega || '(sem nome)') + '</div>'
      + '<div style="display:flex;align-items:center;gap:2px;flex-shrink:0">'
      + (isAdmin ? '<button type="button" class="sp-rel-chip-rm" title="Excluir entrega (permanente)" onclick="event.stopPropagation();_spExcluirEntrega(\'' + e.id + '\',\'' + (e.nome_entrega||'').replace(/'/g,"\\'") + '\')"><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 4h12M5.5 4V2.5a1 1 0 011-1h3a1 1 0 011 1V4M6.5 7.5v4M9.5 7.5v4M3.5 4l.7 8.5a1 1 0 001 .9h5.6a1 1 0 001-.9L12.5 4"/></svg></button>' : '')
      + '<button type="button" class="sp-rel-chip-rm" title="Desvincular desta obra" onclick="event.stopPropagation();_spDesvincularEntrega(\'' + e.id + '\',\'' + (e.nome_entrega||'').replace(/'/g,"\\'") + '\')">&times;</button>'
      + '</div>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(84px,1fr));gap:10px 12px">'
      + _entCampo('Etapa', etapaBadge)
      + _entCampo('Quantidade', e.quantidade != null ? e.quantidade : '—')
      + _entCampo('Faturamento', fmtData(e.data_faturamento))
      + _entCampo('Transporte', e.transporte || '—')
      + _entCampo('Peso (kg)', e.peso_kg != null ? Number(e.peso_kg).toLocaleString('pt-BR') : '—')
      + _entCampo('Valor', e.valor != null ? '<span style="color:var(--green);font-weight:600">' + fmtMoeda(e.valor) + '</span>' : '—')
      + '</div>'
      + (e.endereco_entrega ? '<div style="margin-top:8px;font-size:11px;color:var(--muted)">' + e.endereco_entrega + '</div>' : '')
      + '</div>';
    }).join('')
  : '<div class="sp-empty">Nenhuma entrega registrada para esta obra</div>';

 // ── Cards de instalacoes ─────────────────────────────────────────────────────
 var instCards = instalacoes.length
  ? instalacoes.map(function(i){
     return '<div class="sp-item-card" onclick="_spOpenEntityById(\'instalacoes\',\'' + i.id + '\')">'
      + '<div class="sp-item-title">' + (i.tipo_servico || '(sem tipo)') + '</div>'
      + '<div class="sp-item-meta">'
      + (i.funil ? '<span>Funil: <b>' + i.funil + '</b></span><span style="color:var(--border)">|</span>' : '')
      + '<span>Inicio: <b>' + fmtData(i.data_inicio) + '</b></span>'
      + '<span style="color:var(--border)">|</span>'
      + '<span>Fim: <b>' + fmtData(i.data_fim) + '</b></span>'
      + '<span style="color:var(--border)">|</span>'
      + '<span>Duração: <b>' + fmtDias(i.dias_executados) + '</b></span>'
      + '</div>'
      + (i.valor_total_gasto ? '<div style="margin-top:6px;font-size:12px;font-weight:600;color:var(--green)">' + fmtMoeda(i.valor_total_gasto) + '</div>' : '')
      + (i.detalhes ? '<div style="margin-top:4px;font-size:11px;color:var(--muted)">' + i.detalhes + '</div>' : '')
      + '</div>';
    }).join('')
  : '<div class="sp-empty">Nenhuma instalação registrada para esta obra</div>';

 // ── Cards de tarefas (Atividades do Gestor de Tarefas vinculadas à obra,
 // via junção atividades_obras) ────────────────────────────────────────────
 var _taskStatusCor = { 'Concluída':'var(--green)', 'Concluido':'var(--green)', 'Em andamento':'var(--navy)', 'Em progresso':'var(--navy)', 'Bloqueado':'var(--red)', 'Impedida':'var(--red)', 'Atrasado':'var(--red)' };
 var atividadeCards = atividades.length
  ? atividades.map(function(a){
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
  : '<div class="sp-empty">Nenhuma tarefa vinculada a esta obra</div>';

 // ── Badge de contagem ────────────────────────────────────────────────────────
 function badge(n) {
  return '<span class="spt-badge' + (n > 0 ? ' has-data' : '') + '">' + n + '</span>';
 }

 // ── Etapa/Cidade/UF/Canal: selects buscáveis (componente genérico, ver
 // scripts/lib/searchable-select.js) — pedido explícito: Etapa não tinha
 // busca nem opção vazia; Cidade/UF eram texto livre, não single select;
 // Canal de vendas usava um vocabulário de marketing inventado que nunca
 // bateu com o real do Airtable (ver CANAL_VENDAS_OPCOES acima). Cidade e
 // Canal são "creatable" (Airtable permite criar opção nova ali mesmo — a
 // lista de cidades/canais reais cresce com o tempo); Etapa e UF são listas
 // fechadas de verdade.
 _srchSelRegister('etapa', {
  options: etapas, placeholder: 'Nenhuma etapa',
  onSelect: function(v) { _spOnEtapaChange(v); _obraScheduleAutoSave(); },
 });
 _srchSelRegister('uf', {
  options: UF_BRASIL, placeholder: 'Selecione o UF...',
  onSelect: function() { _obraScheduleAutoSave(); },
 });
 _srchSelRegister('canal', {
  options: CANAL_VENDAS_OPCOES, creatable: true, placeholder: 'Selecione o canal...',
  onSelect: function() { _obraScheduleAutoSave(); },
 });
 _srchSelRegister('cidade', {
  options: function(){ return _obraCidadesCache || []; }, creatable: true, placeholder: 'Selecione a cidade...',
  onOpen: _obraCarregarCidades,
  onSelect: function(v) {
   if (v && (_obraCidadesCache||[]).indexOf(v) === -1) _obraCidadesCache.push(v);
   _obraScheduleAutoSave();
  },
 });
 // Transporte (quick-create de Entrega) — pedido explícito: virou select
 // buscável em vez de texto livre, mesmo padrão de Cidade/Canal (criável,
 // já que a lista de caminhões/fretes cresce).
 _srchSelRegister('entTransporte', {
  options: function(){ return _obraTransporteCache || []; }, creatable: true, placeholder: 'Selecione o transporte...',
  onOpen: _obraCarregarTransportes,
  onSelect: function(v) {
   if (v && (_obraTransporteCache||[]).indexOf(v) === -1) _obraTransporteCache.push(v);
  },
 });

 // ── HTML completo com abas ───────────────────────────────────────────────────
 var html = '<input type="hidden" id="sp-obra-id" value="' + o.id + '">'

  // Barra de abas
  + '<div class="spt-bar">'
  + '<button class="spt-btn active" data-target="spt-geral" onclick="_sptSwitch(\'geral\',this)">Visão Geral</button>'
  + '<button class="spt-btn" data-target="spt-orcamentos" onclick="_sptSwitch(\'orcamentos\',this)">Projetos' + badge(projetos.length) + '</button>'
  + '<button class="spt-btn" data-target="spt-entregas" onclick="_sptSwitch(\'entregas\',this)">Entregas' + badge(entregas.length) + '</button>'
  + '<button class="spt-btn" data-target="spt-instalacao" onclick="_sptSwitch(\'instalacao\',this)">Instalação' + badge(instalacoes.length) + '</button>'
  + '<button class="spt-btn" data-target="spt-tarefas" onclick="_sptSwitch(\'tarefas\',this)">Tarefas' + badge(atividades.length) + '</button>'
  + '<button class="spt-btn" data-target="spt-documentos" onclick="_sptSwitch(\'documentos\',this)">Documentos</button>'
  + '<button class="spt-btn" data-target="spt-registros" onclick="_sptSwitch(\'registros\',this)">Registros</button>'
  + '</div>'

  // ── SEÇÃO: Visão Geral ───────────────────────────────────────────────────────
  + '<div class="spt-panel" id="spt-geral">'

  + '<div class="sp-stitle" style="margin-top:0">Identificação</div>'
  + '<div class="sp-field"><div class="sp-label">Nome da obra</div>'
  + '<input class="sp-inp" id="sp-nome" style="text-transform:uppercase" value="' + (o.nome||'').replace(/"/g,'&quot;') + '" placeholder="Nome da obra..." oninput="_upperCaseInput(this);_obraScheduleAutoSave()"></div>'

  // Tipo(s) de obra é ARRAY (o.tipo_obra) — o <select> de valor único
  // anterior só mostrava/gravava o PRIMEIRO tipo, perdendo silenciosamente
  // os demais no próximo autosave (achado real: obra criada com Telhados
  // + Modular abria mostrando só "Telhados", e qualquer edição salvava de
  // volta só esse 1 tipo). Pills multi-select (mesmo padrão de cor do
  // wizard/Passo 1 e do Tipo do Projeto) substituem o select nativo.
  + '<div class="sp-field"><div class="sp-label">Tipo(s) de obra</div>'
  + '<div id="sp-tipo-pills" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">' + _spTipoPillsHTML(tipoArr) + '</div></div>'
  + '<div class="sp-field"><div class="sp-label">Etapa do Negócio</div>'
  + _srchSelMarkup('etapa', 'sp-etapa', o.etapa_negocio || '') + '</div>'

  + '<div class="sp-g2">'
  // Antes era readonly (mostrava created_at, um timestamp de sistema) —
  // data_criacao é uma coluna própria e editável ("Data do orçamento" de
  // verdade, pode ser retroativa em registros migrados do Airtable), então
  // vira um <input type="date"> de verdade como o de baixo — ganha o
  // seletor de calendário nativo E o formato passa a seguir o locale do
  // navegador em vez do "YYYY-MM-DD" cru de um texto sem máscara.
  + '<div class="sp-field"><div class="sp-label">Data do orçamento</div>'
  + '<input class="sp-inp" id="sp-data-criacao" type="date" value="' + (o.data_criacao ? String(o.data_criacao).substring(0,10) : (o.created_at ? String(o.created_at).substring(0,10) : '')) + '" onchange="_obraScheduleAutoSave()"></div>'
  + '<div class="sp-field"><div class="sp-label">Data envio da proposta</div>'
  + '<input class="sp-inp" id="sp-data-proposta" type="date" value="' + (o.data_envio_proposta ? String(o.data_envio_proposta).substring(0,10) : '') + '" onchange="_obraScheduleAutoSave()"></div>'
  + '</div>'

  // Proposta Comercial não é um campo de texto (é um documento anexado, ver
  // aba Documentos/_spCarregarDocumentos) — aqui é só um resumo de status +
  // atalho, populado depois via _spCarregarPropostaStatus (a busca real fica
  // fora do render síncrono do painel, mesmo esquema do "Verificando..."
  // de #sp-propostas-lista acima).
  + '<div class="sp-field"><div class="sp-label">Proposta Comercial</div>'
  + '<div id="sp-proposta-status" style="display:flex;align-items:center;gap:10px;padding:8px 0;font-size:13px;color:var(--muted)">Verificando...</div></div>'

  + '<div class="sp-g3">'
  + '<div class="sp-field"><div class="sp-label">Cidade</div>' + _srchSelMarkup('cidade', 'sp-cidade', o.cidade || '') + '</div>'
  + '<div class="sp-field"><div class="sp-label">UF</div>' + _srchSelMarkup('uf', 'sp-uf', (o.estado||'').toUpperCase()) + '</div>'
  + '<div class="sp-field"><div class="sp-label">Canal de vendas</div>' + _srchSelMarkup('canal', 'sp-canal', o.canal_vendas || '') + '</div>'
  + '</div>'
  // Pedido explícito: endereço ficava espremido lado a lado com CNO (2
  // colunas) — endereços reais são longos (rua + número + cidade/UF +
  // às vezes até link de mapa, ver exemplo real "Rua Erlicio Martins,
  // Canindé/CE.https://maps.app...") e cortavam visualmente. Linha
  // própria, largura cheia, pra aparecer inteiro assim que abre o painel.
  + '<div class="sp-field"><div class="sp-label">Endereço de Entrega</div><input class="sp-inp" id="sp-end-entrega" value="' + (o.endereco_entrega||'') + '" placeholder="Rua, nº, cidade..." oninput="_obraScheduleAutoSave()"></div>'

  + '<div class="sp-g2">'
  + '<div class="sp-field"><div class="sp-label">Quantidade</div><input class="sp-inp" id="sp-obra-quantidade" type="number" min="0" placeholder="—" value="' + (o.quantidade != null ? o.quantidade : '') + '" oninput="_obraScheduleAutoSave()"></div>'
  + '<div class="sp-field"><div class="sp-label">Valor da obra</div><input class="sp-inp" id="sp-obra-valor" type="text" placeholder="R$ 0,00" value="' + (o.valor != null ? Number(o.valor).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : '') + '" onfocus="_spValorFocus(this)" onblur="_spValorBlur(this)" oninput="_obraScheduleAutoSave()"></div>'
  + '</div>'

  + '<div class="sp-stitle">Empresa(s) & Contato</div>'
  // Pedido explícito: uma Obra pode ter mais de uma Empresa vinculada (a
  // junção empresas_obras sempre foi N:N no banco — só a UI que travava em
  // 1). Chips de "vinculada(s)" (mesmo componente _spRelChipHTML já usado
  // em Projetos/Entregas/Instalações) substituem o antigo select único;
  // adicionar uma empresa já existente ou criar uma nova (formulário
  // abaixo) só ACRESCENTA um vínculo, nunca substitui os outros.
  + '<div class="sp-field"><div class="sp-label">Empresas vinculadas</div>'
  + '<div class="sp-rel-chips-wrap" id="sp-ob-empresas-chips">' + _spEmpresasChipsHTML(o.empresas) + '</div>'
  + '<div style="display:flex;gap:6px;align-items:center;margin-top:8px">'
  + _spObEmpresaMarkup()
  + '<button class="btn btn-ghost btn-sm" onclick="_spToggleNovaEmpresa()" title="Criar nova empresa">+</button>'
  + '</div></div>'
  + '<div id="sp-nova-empresa-form" style="display:none;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:10px">'
  + '<div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;margin-bottom:10px">Nova Empresa</div>'
  + '<div class="sp-g2" style="gap:8px">'
  + '<div class="sp-field"><div class="sp-label">Nome *</div><input class="sp-inp" id="sp-new-emp-nome" placeholder="Razão social"></div>'
  + '<div class="sp-field"><div class="sp-label">CNPJ</div><input class="sp-inp" id="sp-new-emp-cnpj" value="' + _empCnpjMaskValue('') + '" oninput="_empCnpjMask(this)"></div>'
  + '</div><div class="sp-g2" style="gap:8px;margin-top:8px">'
  + '<div class="sp-field"><div class="sp-label">Estado *</div><select class="sp-inp" id="sp-new-emp-uf">' + _spEmpOptSelect(EMPRESA_ESTADO_OPCOES, '') + '</select></div>'
  + '<div class="sp-field"><div class="sp-label">Fase do Ciclo de Vida</div><select class="sp-inp" id="sp-new-emp-fase">' + _spEmpOptSelect(EMPRESA_FASE_OPCOES, '') + '</select></div>'
  + '</div><div class="sp-g2" style="gap:8px;margin-top:8px">'
  // Mesmo componente de chips coloridos já usado em openNovaEmpresa()
  // (empresas.js) — _spEmpCategoriaSel é global e resetado em
  // _spToggleNovaEmpresa() antes de abrir este formulário, então não há
  // risco de arrastar seleção de uma sessão de criação anterior.
  + '<div class="sp-field"><div class="sp-label">Categoria</div><div id="sp-emp-categoria-dropdown"></div></div>'
  + '<div class="sp-field"><div class="sp-label">Site</div>' + _siteInputHTML('sp-new-emp-site', '', '') + '</div>'
  + '</div><div style="display:flex;gap:6px;margin-top:10px">'
  + '<button class="btn btn-primary btn-sm" onclick="_spCriarEmpresaObra()" style="flex:1;justify-content:center">Criar empresa</button>'
  + '<button class="btn btn-ghost btn-sm" onclick="_spToggleNovaEmpresa()">Cancelar</button>'
  + '</div></div>'

  // Pedido explícito: mesmo esquema de Empresas — uma Obra pode ter mais de
  // 1 contato vinculado, seja de uma empresa que já tem vários contatos
  // cadastrados, seja criando mais um. Chips de "vinculado(s)" no lugar do
  // antigo select único.
  + '<div class="sp-field"><div class="sp-label">Contatos vinculados</div>'
  + '<div class="sp-rel-chips-wrap" id="sp-ob-contatos-chips">' + _spContatosChipsHTML(o.contatos) + '</div>'
  + '<div style="display:flex;gap:6px;align-items:center;margin-top:8px">'
  + _spObContatoMarkup()
  + '<button class="btn btn-ghost btn-sm" onclick="_spToggleNovoContato()" title="Criar novo contato">+</button>'
  + '</div></div>'
  + '<div id="sp-novo-contato-form" style="display:none;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:10px">'
  + '<div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;margin-bottom:10px">Novo Contato</div>'
  + '<div class="sp-field"><div class="sp-label">Nome completo *</div><input class="sp-inp" id="sp-new-cont-nome" placeholder="Nome"></div>'
  + '<div class="sp-g2" style="gap:8px;margin-top:8px">'
  + '<div class="sp-field"><div class="sp-label">E-mail</div><input class="sp-inp" id="sp-new-cont-email" type="email" placeholder="nome@empresa.com" oninput="_cttEmailMask(this)"></div>'
  + '<div class="sp-field"><div class="sp-label">Telefone</div><input class="sp-inp" id="sp-new-cont-tel" value="' + _cttTelMaskValue('') + '" oninput="_cttTelMask(this)"></div>'
  + '</div><div class="sp-field" style="margin-top:8px"><div class="sp-label">Cargo</div>' + _spCttCargoMarkup('') + '</div>'
  + '<div style="display:flex;gap:6px;margin-top:10px">'
  + '<button class="btn btn-primary btn-sm" onclick="_spCriarContato()" style="flex:1;justify-content:center">Criar contato</button>'
  + '<button class="btn btn-ghost btn-sm" onclick="_spToggleNovoContato()">Cancelar</button>'
  + '</div></div>'

  // "Empresa(s) vinculada(s)" e "Projetos vinculados" (chips) foram removidas
  // daqui — pedido explícito de reestruturação: a página virou uma ficha
  // única de rolagem contínua, e esses chips já eram redundantes com o campo
  // Empresa logo acima (que tem seu próprio atalho "›") e com a seção
  // Projetos completa mais abaixo (mesma rolagem, não mais uma aba separada)
  // — mostrar a lista de projetos duas vezes na mesma página não ajuda em
  // nada. "Resumo" continua: é agregado (totais), não repete a lista.
  + '<div class="sp-stitle">Resumo</div>'
  + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:16px">'
  + '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;text-align:center">'
  + '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:4px">Projetos</div>'
  + '<div style="font-size:22px;font-weight:700;color:var(--text)">' + projetos.length + '</div></div>'
  + '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;text-align:center">'
  + '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:4px">Qtd. total</div>'
  + '<div style="font-size:22px;font-weight:700;color:var(--text)">' + (totalQtd > 0 ? totalQtd.toLocaleString('pt-BR') : '—') + '</div></div>'
  + '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;text-align:center">'
  + '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:4px">Peso total</div>'
  + '<div style="font-size:14px;font-weight:700;color:var(--text)">' + (totalPeso > 0 ? totalPeso.toLocaleString('pt-BR') + ' kg' : '—') + '</div></div>'
  + '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;text-align:center">'
  + '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:4px">Valor total</div>'
  + '<div style="font-size:13px;font-weight:700;color:var(--green)">' + (totalValor > 0 ? fmtMoeda(totalValor) : '—') + '</div></div>'
  + '</div>'

  + (mostrarPropostaSolar
   ? '<div class="sp-stitle">Proposta Comercial Solar</div>'
     + '<div style="background:var(--yellow-dim);border:1px solid var(--yellow);border-radius:8px;padding:12px 14px;margin-bottom:12px">'
     + '<select class="sp-inp" id="sp-prod-solar" style="margin-bottom:10px" onchange="_spCheckSolarBtn()">'
     + '<option value="">Selecione o produto...</option>'
     + SOLAR_PRODUTOS.map(function(p){ return '<option' + (p === prodSolar ? ' selected' : '') + '>' + p + '</option>'; }).join('')
     + '</select>'
     + '<div class="sp-g2">'
     + '<div><div class="sp-label">Qtd. (placas)</div><input class="sp-inp" id="sp-qtd-solar" type="number" placeholder="0" value="' + (projSolar.quantidade != null ? projSolar.quantidade : '') + '" oninput="_spCheckSolarBtn()"></div>'
     + '<div><div class="sp-label">Valor unit. (R$)</div><input class="sp-inp" id="sp-vl-solar" type="number" placeholder="0" value="' + (projSolar.valor_unitario != null ? projSolar.valor_unitario : '') + '" oninput="_spCheckSolarBtn()"></div>'
     + '</div>'
     + '<div class="sp-g2" style="margin-top:8px">'
     + '<div><div class="sp-label">Frete</div><select class="sp-inp" id="sp-frete-solar" onchange="_spCheckSolarBtn()">'
       + '<option value="">Selecione...</option>'
       + ['CIF','FOB'].map(function(f){ return '<option' + (f === projSolar.frete ? ' selected' : '') + '>' + f + '</option>'; }).join('')
       + '</select></div>'
     + '<div><div class="sp-label">Alíquota Interna (ICMS)</div><select class="sp-inp" id="sp-icms-solar" onchange="_spCheckSolarBtn()">'
       + '<option value="">Selecione...</option>'
       + ['12','19'].map(function(a){ return '<option value="' + a + '"' + (a === icmsDefault ? ' selected' : '') + '>' + a + '%</option>'; }).join('')
       + '</select></div>'
     + '</div>'
     + '<div style="font-size:10px;margin-top:4px;color:' + (icmsAuto ? 'var(--green)' : 'var(--muted)') + '">'
       + (icmsAuto
         ? '✓ Preenchido automaticamente com base na UF do cliente (' + (ufDestino || '—') + '): 19% se Sergipe, 12% se fora de Sergipe. Pode ajustar manualmente se houver exceção.'
         : 'Definido manualmente (UF do cliente: ' + (ufDestino || '—') + ').')
       + '</div>'
     + '<div style="margin-top:8px;display:flex;align-items:center;gap:6px">'
       + '<input type="checkbox" id="sp-consfinal-solar" onchange="_spToggleDifal()"' + (projSolar.consumidor_final ? ' checked' : '') + '>'
       + '<label for="sp-consfinal-solar" class="sp-label" style="margin:0">Consumidor Final (aplica DIFAL)</label>'
       + '</div>'
     + '<div id="sp-difal-wrap" style="margin-top:8px;' + (projSolar.consumidor_final ? '' : 'display:none') + '">'
       + '<div class="sp-label">DIFAL + FCP (%)</div>'
       + '<input class="sp-inp" id="sp-difal-solar" type="number" placeholder="0" value="' + (difalDefault !== '' ? difalDefault : '') + '">'
       + '<div style="font-size:10px;margin-top:4px;color:' + ((difalAuto && _difalTabelaUF[ufDestino] != null) ? 'var(--green)' : 'var(--muted)') + '">'
         + (_difalTabelaUF[ufDestino] != null
           ? (difalAuto
             ? '✓ Preenchido automaticamente com base na UF do cliente (' + ufDestino + '): ' + _difalTabelaUF[ufDestino] + '% (DIFAL já com FCP, venda interestadual com origem Sergipe). Pode ajustar manualmente se houver exceção.'
             : 'Definido manualmente (sugestão para ' + ufDestino + ': ' + _difalTabelaUF[ufDestino] + '%).')
           : 'UF do cliente (' + (ufDestino || '—') + ') sem valor padrão na tabela — informar manualmente.')
         + '</div>'
       + '</div>'
     + '<div id="sp-solar-acao-wrap" style="display:none;margin-top:12px">'
     + '<div class="sp-label" style="margin-bottom:4px">Ação ao gerar</div>'
     + '<select id="sp-solar-acao" class="sp-inp" onchange="document.getElementById(\'sp-solar-etapa-wrap\').style.display=this.value===\'registrar-obra\'?\'block\':\'none\'">'
     + '<option value="abrir">Gerar documento apenas (não registrar)</option>'
     + '<option value="registrar" selected>Gerar e registrar no sistema</option>'
     + '<option value="registrar-obra">Gerar, registrar e atualizar etapa da obra</option>'
     + '<option value="registrar-projeto">Gerar, registrar e criar projeto Solar automaticamente</option>'
     + '</select>'
     + '<div id="sp-solar-etapa-wrap" style="display:none;margin-top:6px">'
     + '<div class="sp-label" style="margin-bottom:4px">Nova etapa da obra</div>'
     + '<select id="sp-solar-nova-etapa" class="sp-inp"><option>Orçamento</option><option>Atualização de orçamento</option><option>Follow-up</option><option selected>Negociação</option><option>Aprovação de projeto</option><option>Piloto</option><option>Projeto aprovado</option><option>Em Andamento</option><option>Pós-vendas</option><option>Concluído</option><option>Negócio perdido</option></select>'
     + '</div>'
     + '</div>'
     + '<button id="sp-btn-proposta" class="btn" style="display:none;margin-top:10px;background:var(--navy);color:#fff;border:none;width:100%;padding:9px;border-radius:7px;font-size:13px;font-weight:700;cursor:pointer" onclick="_spGerarProposta()">Gerar Proposta Comercial</button>'
     + '</div>'
   : '')

  + (tipoArr.includes('Modular')
   ? '<div class="sp-stitle">Orçamento Modular</div><div id="mc-container"></div>'
   : '')

  + '</div>' // fim spt-panel geral

  // ── ABA: Projetos/Orçamentos ─────────────────────────────────────────────────
  + '<div class="spt-panel" id="spt-orcamentos">'
  + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border)">'
  + '<div style="font-size:12px;font-weight:700;color:var(--text)">'
  + projetos.length + ' projeto' + (projetos.length !== 1 ? 's' : '') + ' vinculado' + (projetos.length !== 1 ? 's' : '')
  + '</div>'
  + '<div style="display:flex;align-items:center;gap:14px">'
  + (projetos.length > 0
   ? '<div style="display:flex;gap:14px;font-size:11px;color:var(--muted)">'
     + '<span>Qtd <b style="color:var(--text)">' + totalQtd.toLocaleString('pt-BR') + '</b></span>'
     + '<span>Peso <b style="color:var(--text)">' + (totalPeso > 0 ? totalPeso.toLocaleString('pt-BR') + ' kg' : '—') + '</b></span>'
     + '<span>Valor <b style="color:var(--green)">' + (totalValor > 0 ? fmtMoeda(totalValor) : '—') + '</b></span>'
     + '</div>'
   : '')
  // Pedido explícito: faltava a opção de adicionar um projeto direto por
  // aqui (só existia dentro do wizard de criação da obra) — mesmo modelo
  // de formulário completo já usado lá (passo 4) e reaproveitado no
  // detalhamento de Entrega (_entProj*, entregas.js).
  + '<button class="btn btn-ghost btn-sm" onclick="_spToggleNovoProjeto()">+ Adicionar projeto</button>'
  + '</div>'
  + '</div>'
  + '<div id="sp-novo-proj-form-box" style="display:none;margin-bottom:12px"></div>'
  + projCards
  + '</div>'

  // ── ABA: Entregas ────────────────────────────────────────────────────────────
  + '<div class="spt-panel" id="spt-entregas">'
  // Pedido explícito: não havia jeito de criar/associar uma entrega a uma
  // obra pelo sistema (openNovaEntrega em entregas.js é só um alert()
  // placeholder até hoje) — mesmo formulário rápido já usado pra
  // Empresa/Contato/Instalação, gravando direto em `entregas` com
  // obra_id já preenchido.
  + '<div style="display:flex;align-items:center;justify-content:space-between;margin:18px 0 8px;padding-bottom:5px;border-bottom:1px solid var(--border)">'
  + '<div class="sp-stitle" style="margin:0;padding:0;border:none">Entregas (' + entregas.length + ')</div>'
  + '<button class="btn btn-ghost btn-sm" onclick="_spToggleNovaEntrega()">+ Nova Entrega</button>'
  + '</div>'
  + '<div id="sp-nova-entrega-form" style="display:none;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:12px">'
  // Campos obrigatórios (*) seguem exatamente o formulário real do
  // Airtable (referência enviada): Entrega, Etapa da entrega, Data de
  // faturamento e Quantidade — validados em _spCriarEntrega antes do insert.
  + '<div class="sp-field"><div class="sp-label">Entrega <span style="color:var(--red)">*</span></div><input class="sp-inp" id="sp-new-ent-nome" placeholder="Ex: 1ª Entrega"></div>'
  + '<div class="sp-g2" style="gap:8px;margin-top:8px">'
  + '<div class="sp-field"><div class="sp-label">Etapa da entrega <span style="color:var(--red)">*</span></div><select class="sp-inp" id="sp-new-ent-etapa">'
  + '<option value="">Selecione...</option>'
  + Object.keys(_entEtapaBucket).map(function(et){ return '<option>' + et + '</option>'; }).join('')
  + '</select></div>'
  + '<div class="sp-field"><div class="sp-label">Data de faturamento <span style="color:var(--red)">*</span></div><input class="sp-inp" id="sp-new-ent-data" type="date"></div>'
  + '</div><div class="sp-g2" style="gap:8px;margin-top:8px">'
  + '<div class="sp-field"><div class="sp-label">Quantidade <span style="color:var(--red)">*</span></div><input class="sp-inp" id="sp-new-ent-qtd" type="number" min="0" placeholder="0"></div>'
  + '<div class="sp-field"><div class="sp-label">Peso do pedido (kg)</div><input class="sp-inp" id="sp-new-ent-peso" type="number" min="0" placeholder="0"></div>'
  + '</div><div class="sp-g2" style="gap:8px;margin-top:8px">'
  + '<div class="sp-field"><div class="sp-label">Valor</div><input class="sp-inp" id="sp-new-ent-valor" type="number" min="0" placeholder="0"></div>'
  + '<div class="sp-field"><div class="sp-label">Transporte</div>' + _srchSelMarkup('entTransporte', 'sp-new-ent-transporte', '') + '</div>'
  + '</div>'
  + '<div style="display:flex;align-items:center;gap:6px;margin-top:10px">'
  + '<input type="checkbox" id="sp-new-ent-produzido">'
  + '<label for="sp-new-ent-produzido" class="sp-label" style="margin:0">Pedido produzido</label>'
  + '</div>'
  // Upload fica opcional e roda DEPOIS do insert da entrega (só existe
  // entrega_id pra vincular o documento depois que a linha é criada) —
  // mesmo bucket/mecânica de upload já usada em Documentos da Obra
  // (_spEnviarDocObra), só que aqui o documento carrega entrega_id além
  // de obra_id (coluna nova, migração add_entrega_id_to_documentos).
  // _spEntDropzone: mesmo visual de dropzone (ícone + "clique ou arraste")
  // já usado em Documentos da Obra — pedido explícito: o <input type=file>
  // cru (com o "Escolher arquivo/Nenhum arquivo escolhido" padrão do
  // navegador) destoava completamente do resto do design do sistema.
  + '<div class="sp-g2" style="gap:8px;margin-top:10px">'
  + '<div class="sp-field"><div class="sp-label">Documentos específicos da entrega</div>' + _spEntDropzone('sp-new-ent-doc', 'sp-new-ent-doc-lbl', true) + '</div>'
  + '<div class="sp-field"><div class="sp-label">Ordem de Produção</div>' + _spEntDropzone('sp-new-ent-op', 'sp-new-ent-op-lbl', false) + '</div>'
  + '</div>'
  // Bug real encontrado ao testar: um "</div>" a mais aqui fechava
  // #sp-nova-entrega-form ANTES da hora — a linha de botões "Criar
  // entrega"/"Cancelar" acabava como IRMÃ do formulário (sempre visível,
  // mesmo com o formulário fechado) em vez de FILHA dele. Por isso
  // aparecia um botão grande logo abaixo do cabeçalho "Entregas (N)" +
  // "+ Nova Entrega", com os campos de verdade escondidos/fora de ordem.
  + '<div style="display:flex;gap:6px;margin-top:10px">'
  + '<button class="btn btn-primary btn-sm" onclick="_spCriarEntrega()" style="flex:1;justify-content:center">Criar entrega</button>'
  + '<button class="btn btn-ghost btn-sm" onclick="_spToggleNovaEntrega()">Cancelar</button>'
  + '</div></div>'
  + entregaCards
  + '</div>'

  // ── ABA: Instalação ──────────────────────────────────────────────────────────
  + '<div class="spt-panel" id="spt-instalacao">'
  // Pedido explícito: não havia jeito nenhum de criar/associar uma
  // instalação a uma obra por aqui — a única forma de "existir" uma
  // instalação era já ter vindo migrada do Airtable. openNovaInstalacao()
  // (instalacoes.js) é só um alert() de placeholder até hoje; em vez de
  // depender dela, este formulário rápido grava direto em `instalacoes`
  // com obra_id já preenchido, mesmo espírito do quick-create de Empresa/
  // Contato.
  + '<div style="display:flex;align-items:center;justify-content:space-between;margin:18px 0 8px;padding-bottom:5px;border-bottom:1px solid var(--border)">'
  + '<div class="sp-stitle" style="margin:0;padding:0;border:none">Instalações (' + instalacoes.length + ')</div>'
  + '<button class="btn btn-ghost btn-sm" onclick="_spToggleNovaInstalacao()">+ Nova Instalação</button>'
  + '</div>'
  + '<div id="sp-nova-instalacao-form" style="display:none;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:12px">'
  + '<div class="sp-g2" style="gap:8px">'
  + '<div class="sp-field"><div class="sp-label">Tipo de serviço</div><select class="sp-inp" id="sp-new-inst-tipo">'
  + '<option value="">Selecione...</option>'
  + ['Instalação','Montagem fábrica','Treinamento piloto','Assistência técnica'].map(function(t){ return '<option>' + t + '</option>'; }).join('')
  + '</select></div>'
  + '<div class="sp-field"><div class="sp-label">Funil</div><select class="sp-inp" id="sp-new-inst-funil">'
  + ['A programar','Programado','Em execução','Finalizado'].map(function(f,i){ return '<option' + (i===0?' selected':'') + '>' + f + '</option>'; }).join('')
  + '</select></div>'
  + '</div><div class="sp-g2" style="gap:8px;margin-top:8px">'
  + '<div class="sp-field"><div class="sp-label">Data início</div><input class="sp-inp" id="sp-new-inst-inicio" type="date"></div>'
  + '<div class="sp-field"><div class="sp-label">Data fim</div><input class="sp-inp" id="sp-new-inst-fim" type="date"></div>'
  + '</div><div class="sp-g2" style="gap:8px;margin-top:8px">'
  + '<div class="sp-field"><div class="sp-label">Valor total gasto</div><input class="sp-inp" id="sp-new-inst-valor" type="number" min="0" placeholder="0"></div>'
  + '<div class="sp-field"><div class="sp-label">Detalhes</div><input class="sp-inp" id="sp-new-inst-detalhes" placeholder="Observações..."></div>'
  + '</div><div style="display:flex;gap:6px;margin-top:10px">'
  + '<button class="btn btn-primary btn-sm" onclick="_spCriarInstalacao()" style="flex:1;justify-content:center">Criar instalação</button>'
  + '<button class="btn btn-ghost btn-sm" onclick="_spToggleNovaInstalacao()">Cancelar</button>'
  + '</div></div>'
  + instCards
  + '</div>'

  // ── SEÇÃO: Tarefas (Atividades do Gestor de Tarefas vinculadas à obra) ────────
  // Pedido explícito — não existia nenhuma forma de ver, a partir do
  // detalhamento de uma Obra, quais atividades estão associadas a ela.
  // Criação de tarefa fica de fora por ora (o fluxo de criação já existe,
  // completo, no Gestor de Tarefas — abrir aqui só uma versão simplificada
  // reduzida seria pior que direcionar pra lá).
  + '<div class="spt-panel" id="spt-tarefas">'
  + '<div class="sp-stitle" style="margin-top:0">Tarefas (' + atividades.length + ')</div>'
  + atividadeCards
  + '</div>'

  // ── ABA: Documentos ──────────────────────────────────────────────────────────
  + '<div class="spt-panel" id="spt-documentos">'
  + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--border)">'
  + '<div style="font-size:12px;font-weight:700;color:var(--text)">Documentos da Obra</div>'
  + '<div style="display:flex;align-items:center;gap:8px">'
  + '<span style="font-size:10px;color:var(--muted)" id="sp-propostas-info"></span>'
  + '<button onclick="_spToggleUploadDoc()" id="sp-anexar-btn" style="display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;padding:5px 12px;border:1px solid var(--navy);border-radius:6px;background:var(--navy);color:#fff;cursor:pointer"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v10M3 8h10"/></svg> Anexar documento</button>'
  + '</div></div>'
  + '<div id="sp-upload-doc-form" style="display:none;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:14px;box-shadow:0 2px 8px rgba(0,0,0,.07)">'
  + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">'
  + '<div style="font-size:12px;font-weight:700;color:var(--text)">Anexar documento à obra</div>'
  + '<button onclick="_spToggleUploadDoc()" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:16px;line-height:1;padding:0 2px">×</button>'
  + '</div>'
  + '<div style="margin-bottom:10px">'
  + '<div class="sp-label" style="margin-bottom:5px">Tipo do documento</div>'
  + '<select class="sp-inp" id="sp-upload-tipo" onchange="_spUploadTipoChange(this.value)" style="font-size:12px">'
  + '<optgroup label="── Comercial ──"><option>Proposta Comercial</option><option>Contrato</option><option>Contrato Instalação</option><option>Enviado pelo Cliente</option></optgroup>'
  + '<optgroup label="── Técnico ──"><option>Pedido de Compra</option><option>ART</option><option>Cálculo Estrutural</option><option>CNPJ & CNO</option><option>Boletim de Medição</option></optgroup>'
  + '<optgroup label="── Outro ──"><option>Outro</option></optgroup>'
  + '</select>'
  + '</div>'
  + '<div style="margin-bottom:10px">'
  + '<div class="sp-label" style="margin-bottom:5px">Nome / descrição <span style="color:var(--red)">*</span></div>'
  + '<input class="sp-inp" id="sp-upload-nome" placeholder="Ex: Contrato assinado — Rev. 2" style="font-size:12px">'
  + '</div>'
  + '<div style="margin-bottom:12px">'
  + '<div class="sp-label" style="margin-bottom:5px">Arquivo <span style="color:var(--red)">*</span></div>'
  + '<label id="sp-upload-dropzone" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;border:2px dashed var(--border);border-radius:8px;padding:20px 16px;cursor:pointer;transition:border-color .15s,background .15s" onmouseover="this.style.borderColor=\'var(--navy)\';this.style.background=\'rgba(59,130,246,.04)\'" onmouseout="this.style.borderColor=\'var(--border)\';this.style.background=\'\';" ondragover="event.preventDefault();this.style.borderColor=\'var(--navy)\';this.style.background=\'rgba(59,130,246,.07)\'" ondragleave="this.style.borderColor=\'var(--border)\';this.style.background=\'\'" ondrop="_spUploadDrop(event)">'
  + '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.5"><path d="M12 16V8M8 12l4-4 4 4"/><path d="M20 16.5A4.5 4.5 0 0015.5 12H15a6 6 0 10-11.8 1.5"/></svg>'
  + '<span id="sp-upload-file-label" style="font-size:11px;color:var(--muted);text-align:center">Clique para selecionar ou arraste o arquivo aqui<br><span style="font-size:10px">PDF, JPG, PNG, XLSX, DOC</span></span>'
  + '<input type="file" id="sp-upload-file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.doc,.docx" style="display:none" onchange="_spUploadFileChange(this)">'
  + '</label>'
  + '</div>'
  + '<div style="display:flex;gap:8px">'
  + '<button onclick="_spEnviarDocObra()" id="sp-upload-send-btn" style="flex:1;font-size:12px;font-weight:700;padding:8px 14px;border:none;border-radius:7px;background:var(--green);color:#fff;cursor:pointer;transition:opacity .15s">Enviar documento</button>'
  + '<button onclick="_spToggleUploadDoc()" style="font-size:12px;padding:8px 14px;border:1px solid var(--border);border-radius:7px;background:transparent;color:var(--muted);cursor:pointer">Cancelar</button>'
  + '</div></div>'
  // Antes só carregava ao clicar na aba "Documentos" (_sptSwitch disparava
  // _spCarregarDocumentos sob demanda) — como não existe mais aba de
  // verdade (é tudo 1 página só), carrega direto (ver chamada logo após
  // _spSet mais abaixo, junto com _spCarregarPropostaStatus).
  + '<div id="sp-propostas-lista"><div class="sp-empty"><div style="font-size:11px;color:var(--muted)">Carregando...</div></div></div>'
  + '</div>' // fim spt-panel documentos

  // ── SEÇÃO: Registros (fotográficos) ───────────────────────────────────────
  // Pedido explícito: sub-aba "Registros" dentro do detalhamento de Obra —
  // no Airtable esse campo de fotos (multipleAttachments) vive na tabela
  // Projetos ("fotos_obra", ver auditoria de schema), não em Obras; como uma
  // Obra pode ter vários Projetos, a aba agrega as fotos de TODOS os
  // projetos vinculados a esta obra num só lugar, agrupadas por projeto.
  + '<div class="spt-panel" id="spt-registros">'
  + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--border)">'
  + '<div style="font-size:12px;font-weight:700;color:var(--text)">Registros fotográficos</div>'
  + '<span style="font-size:10px;color:var(--muted)" id="sp-registros-info"></span>'
  + '</div>'
  + (projetos.length
     ? ('<div style="display:flex;gap:8px;align-items:stretch;margin-bottom:14px">'
        + '<select class="sp-inp" id="sp-registros-projeto" style="max-width:240px;font-size:12px;flex-shrink:0">'
        + projetos.map(function(p){ return '<option value="' + p.id + '">' + (p.nome || 'Projeto sem nome').replace(/</g,'&lt;') + '</option>'; }).join('')
        + '</select>'
        + '<div style="flex:1">' + _spRegistrosDropzone() + '</div>'
        + '</div>')
     : '<div class="sp-empty" style="margin-bottom:14px">Vincule um projeto a esta obra para poder registrar fotos.</div>')
  + '<div id="sp-registros-lista"><div class="sp-empty"><div style="font-size:11px;color:var(--muted)">Carregando...</div></div></div>'
  + '</div>'; // fim spt-panel registros

 // Sem botão "Salvar" — pedido explícito: qualquer alteração no formulário
 // já salva sozinha (ver _obraScheduleAutoSave/_spSaveObraFull), mesmo
 // padrão de autosave já usado nos painéis de Empresa/Contato/Atividade.
 // "Excluir obra" só aparece pra admin (mesmo padrão de "Excluir
 // contato"/"Excluir empresa" — botão à esquerda, vermelho, margin-right:auto
 // empurra "Fechar" pro canto certo) — a política de DELETE de `obras` no
 // banco também só libera pra admin (migração
 // restrict_obras_entregas_delete_to_admin), então esconder o botão aqui não
 // é a única barreira.
 var isAdminObra = !!(_currentUser && _currentUser.isAdmin);
 _spSet('Obra', (o.nome||'').split('—')[0]?.trim() || o.nome || 'Obra',
  html,
  (isAdminObra ? '<button class="btn btn-ghost" style="color:var(--red);border-color:var(--red);margin-right:auto" onclick="_spExcluirObra(\'' + o.id + '\',\'' + (o.nome||'').replace(/'/g,"\\'") + '\')">Excluir obra</button> ' : '')
  + '<button class="btn btn-ghost" onclick="closePanel()">Fechar</button>'
 );

 _spCarregarPropostaStatus(o.id);
 _spCarregarDocumentos(o.id);
 _spCarregarRegistros(o.id, projetos);
 _sptInitScrollSpy();

 if (tipoArr.includes('Modular')) {
  // Usa o id real da obra (antes era um slug do nome — colidia entre obras
  // com nomes parecidos e perdia o memorial salvo se a obra fosse renomeada;
  // agora também é a FK real de memorial_calculo_obras.obra_id).
  await _mcDbInit();
  document.getElementById('mc-container').innerHTML = _mcBuild(o.id);
  _mcLoad(o.id);
 }

 if (mostrarPropostaSolar) _spCheckSolarBtn();
 } catch(renderErr) {
  console.error('[MilaTec] Erro no render do painel:', renderErr);
  _spSet('Obra', 'Erro de renderização',
   '<div style="color:var(--red);padding:20px;font-size:13px">'
   + '<b>Erro ao montar o painel:</b><br><code>' + renderErr.message + '</code></div>',
   '<button class="btn btn-ghost" onclick="closePanel()">Fechar</button>'
  );
 }
}

// Resumo de "Proposta Comercial" na Visão Geral — mesma checagem de tipo
// (case-insensitive, cobre "Proposta Comercial" do Airtable e
// "proposta_comercial" do upload manual) usada em _obrasCarregarPropostaMap
// pra grid, só que aqui é 1 obra só. "Ver em Documentos" pula pra aba real
// (_sptSwitch já dispara _spCarregarDocumentos sozinho).
async function _spCarregarPropostaStatus(obraId) {
 var el = document.getElementById('sp-proposta-status');
 if (!el || !obraId) return;
 var res = await _sb.from('documentos').select('id', { count: 'exact', head: true }).eq('obra_id', obraId).ilike('tipo', '%proposta%comercial%');
 if (res.error) { el.textContent = 'Erro ao verificar.'; return; }
 var n = res.count || 0;
 if (!n) {
  el.innerHTML = '<span>Nenhuma proposta anexada.</span>'
   + '<button type="button" class="btn btn-ghost" style="padding:2px 8px;font-size:11px" onclick="_sptSwitch(\'documentos\', document.querySelector(&quot;.spt-btn[onclick*=documentos]&quot;))">Anexar em Documentos</button>';
 } else {
  el.innerHTML = '<span class="nt-tag nt-tag-green">' + n + ' anexada' + (n !== 1 ? 's' : '') + '</span>'
   + '<button type="button" class="btn btn-ghost" style="padding:2px 8px;font-size:11px" onclick="_sptSwitch(\'documentos\', document.querySelector(&quot;.spt-btn[onclick*=documentos]&quot;))">Ver em Documentos</button>';
 }
}

function _spValorFocus(el) {
 var v = (el.value||'').replace(/[^\d,]/g,'').replace(',','.');
 var n = parseFloat(v);
 el.value = isNaN(n) ? '' : n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function _spValorBlur(el) {
 var v = (el.value||'').trim().replace(/\./g,'').replace(',','.');
 var n = parseFloat(v);
 el.value = isNaN(n) ? '' : n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
}

// ── Salvar obra completa (autosave) ───────────────────────────────────────────
// Pedido explícito: nenhum campo do detalhamento de Obra deve exigir clique em
// "Salvar" — qualquer alteração já persiste sozinha, mesmo espírito de
// _empScheduleAutoSave (empresas.js)/_taskAutoSaveQueue (Gestor de Tarefas).
// Debounce de 700ms (mesmo valor usado em Empresa) pra não bater no banco a
// cada tecla digitada.
// Dropdown de busca+checkbox de Tipo(s) de obra (painel de detalhamento) —
// padronizado com o mesmo componente já usado em Produto/Tipologia
// (multiselect-ui.js), pedido explícito de consistência visual entre todos
// os selects do sistema. O estado de verdade vive em _obraAtiva.tipo_obra
// (array), mutado a cada clique — não tem <select> nativo pra ler no
// autosave, então _spSaveObraFull lê direto dali em vez de um elemento do DOM.
function _spTipoPillsHTML(tiposAtuais) {
 var opcoes = (typeof _NO_TIPOS_OPCOES !== 'undefined' && _NO_TIPOS_OPCOES) || ['Telhados','Modular','Steel Frame','Solar','Misto (LSF + A36)'];
 return _msRenderDropdown('spTipoObra', opcoes, tiposAtuais || [], '_spTipoMultiToggle', 'Selecione o(s) tipo(s) de obra...');
}
function _spTipoMultiToggle(campo, t, checked) {
 if (!_obraAtiva) return;
 var arr = (_obraAtiva.tipo_obra || []).slice();
 var i = arr.indexOf(t);
 if (!checked) {
  if (arr.length === 1) {
   _showToast('A obra precisa ter ao menos 1 tipo.', 'aviso');
   var wrapReset = document.getElementById('sp-tipo-pills');
   if (wrapReset) wrapReset.innerHTML = _spTipoPillsHTML(arr);
   return;
  }
  if (i >= 0) arr.splice(i, 1);
 } else if (i === -1) {
  arr.push(t);
 }
 _obraAtiva.tipo_obra = arr;
 var wrap = document.getElementById('sp-tipo-pills');
 if (wrap) { wrap.innerHTML = _spTipoPillsHTML(arr); _noReabrirDropdown('sp-tipo-pills'); }
 _obraScheduleAutoSave();
}

var _obraAutoSaveTimer = null;
function _obraScheduleAutoSave() {
 if (_obraAutoSaveTimer) clearTimeout(_obraAutoSaveTimer);
 _obraAutoSaveTimer = setTimeout(function(){ _spSaveObraFull(); }, 700);
}
async function _spSaveObraFull() {
 if (_obraAutoSaveTimer) { clearTimeout(_obraAutoSaveTimer); _obraAutoSaveTimer = null; }
 if (!_obraAtiva) return;
 const id = document.getElementById('sp-obra-id')?.value;
 const payload = {
  nome:              (document.getElementById('sp-nome')?.value || '').toUpperCase(),
  tipo_obra:         (_obraAtiva.tipo_obra && _obraAtiva.tipo_obra.length) ? _obraAtiva.tipo_obra : [],
  etapa_negocio:     document.getElementById('sp-etapa')?.value || '',
  data_criacao:        document.getElementById('sp-data-criacao')?.value || null,
  data_envio_proposta: document.getElementById('sp-data-proposta')?.value || null,
  cidade:            document.getElementById('sp-cidade')?.value || '',
  estado:            document.getElementById('sp-uf')?.value?.toUpperCase() || '',
  canal_vendas:      document.getElementById('sp-canal')?.value || null,
  quantidade:        document.getElementById('sp-obra-quantidade')?.value !== '' ? Number(document.getElementById('sp-obra-quantidade')?.value) : null,
  valor:             (function(){ var v=(document.getElementById('sp-obra-valor')?.value||'').trim(); if(!v)return null; var n=parseFloat(v.replace(/\./g,'').replace(',','.')); return isNaN(n)?null:n; })(),
  endereco_entrega:  document.getElementById('sp-end-entrega')?.value?.trim() || null,
  updated_at:        new Date().toISOString(),
 };
 // Empresa(s) e Contato(s) NÃO são mais tocados aqui — cada vínculo/
 // desvínculo já é gravado na hora (_spObEmpresaSelectItem/
 // _spDesvincularEmpresaObra/_spCriarEmpresaObra e os equivalentes de
 // Contato), mesmo padrão de Entregas/Instalações. Antes este autosave
 // geral apagava/reinseria só 1 empresa e fazia upsert de só 1 contato a
 // cada edição de qualquer campo — incompatível com uma obra ter mais de
 // uma Empresa/Contato vinculado (pedido explícito).
 var { error } = await _sb.from('obras').update(payload).eq('id', id);
 if (error) {
  _showToast('Erro ao salvar obra: ' + _supaErrPt(error.message), 'erro');
 } else {
  _obraAtiva = { ..._obraAtiva, ...payload };
  _dbLoadObras();
  _dbLoadObrasKanban();
  // Pedido explícito: confirmação visual assim que a alteração chega no
  // banco — sem isso não tinha nenhum feedback de sucesso, só de erro.
  _showToast('Alteração salva', 'ok');
 }
}

// ── Empresa: caixa "Adicionar empresa existente" (busca componente srch-sel,
// mesmo design já usado no Gestor de Tarefas) — NÃO guarda "a empresa
// selecionada" como campo único mais (uma Obra pode ter várias); cada escolha
// aqui já dispara o próprio insert em empresas_obras (_spObEmpresaSelectItem)
// e a caixa volta pro estado neutro na hora — quem representa o estado de
// verdade agora é a lista de chips "Empresas vinculadas" (_spEmpresasChipsHTML),
// sempre lida de _obraAtiva.empresas.
function _spObEmpresaMarkup() {
 return '<div class="srch-sel" id="sp-ob-empresa-srch" style="flex:1">'
  + '<div class="srch-sel-box" id="sp-ob-empresa-box" onclick="_spObEmpresaToggle()">'
  + '<span class="srch-sel-val placeholder" id="sp-ob-empresa-val">Adicionar empresa existente...</span>'
  + '<span class="srch-sel-chevron">▾</span>'
  + '</div>'
  + '<div class="srch-sel-drop" id="sp-ob-empresa-drop">'
  + '<input class="srch-sel-inp" id="sp-ob-empresa-inp" type="text" placeholder="Buscar empresa..." oninput="_spObEmpresaFilter(this.value)" onkeydown="_spObEmpresaKey(event)">'
  + '<div class="srch-sel-list" id="sp-ob-empresa-list"></div>'
  + '</div>'
  + '</div>';
}
function _spObEmpresaToggle() {
 var drop = document.getElementById('sp-ob-empresa-drop');
 var box  = document.getElementById('sp-ob-empresa-box');
 if (!drop) return;
 if (drop.classList.contains('open')) { _spObEmpresaClose(); return; }
 drop.classList.add('open'); if (box) box.classList.add('open');
 var inp = document.getElementById('sp-ob-empresa-inp');
 if (inp) { inp.value = ''; inp.focus(); }
 _spObEmpresaFilter('');
 _srchSelPositionEl(drop, box);
}
function _spObEmpresaClose() {
 var drop = document.getElementById('sp-ob-empresa-drop');
 var box  = document.getElementById('sp-ob-empresa-box');
 if (drop) drop.classList.remove('open');
 if (box)  box.classList.remove('open');
}
function _spObEmpresaFilter(q) {
 q = (q || '').toLowerCase();
 var list = document.getElementById('sp-ob-empresa-list');
 if (!list) return;
 // Já vinculadas somem da lista — não faz sentido oferecer "adicionar" uma
 // empresa que a obra já tem.
 var jaVinculadas = new Set((_obraAtiva && _obraAtiva.empresas || []).map(function(e){ return e.id; }));
 var matches = (_empresasArr || []).filter(function(e){ return !jaVinculadas.has(e.id) && (e.nome||'').toLowerCase().indexOf(q) !== -1; });
 if (!matches.length) { list.innerHTML = '<div class="srch-sel-empty">Nenhuma empresa encontrada.</div>'; return; }
 list.innerHTML = matches.map(function(e){
  return '<div class="srch-sel-opt" onclick="_spObEmpresaSelectItem(\'' + e.id + '\',\'' + (e.nome||'').replace(/'/g,"\\'") + '\')">' + (e.nome||'').replace(/</g,'&lt;') + '</div>';
 }).join('');
}
async function _spObEmpresaSelectItem(id, nome) {
 _spObEmpresaClose();
 if (!id || !_obraAtiva || !_obraAtiva.id) return;
 if ((_obraAtiva.empresas || []).some(function(e){ return e.id === id; })) return; // já vinculada
 var ins = await _sb.from('empresas_obras').insert({ obra_id: _obraAtiva.id, empresa_id: id });
 if (ins.error) { alert('Erro ao vincular empresa: ' + (ins.error.message || '')); return; }
 var empObj = (_empresasArr || []).find(function(e){ return e.id === id; }) || { id: id, nome: nome };
 _spEmpresaObraLocalAdd(empObj);
 _dbLoadObras(); _dbLoadObrasKanban();
}

// ── Empresas vinculadas: chips + estado local (evita recarregar a obra
// inteira do banco a cada vínculo/desvínculo — mesmo espírito de
// _spDesvincularEntrega, mas atualizando em memória em vez de refetch). ────
function _spEmpresasChipsHTML(empresas) {
 var lista = empresas || [];
 if (!lista.length) return '<div class="sp-empty">Nenhuma empresa vinculada.</div>';
 return lista.map(function(e){
  return _spRelChipHTML('empresas', e.id, e.nome || '(sem nome)', null, "_spDesvincularEmpresaObra('" + e.id + "')");
 }).join('');
}
function _spEmpresaObraLocalAdd(empresaObj) {
 if (!_obraAtiva) return;
 _obraAtiva.empresas_obras = (_obraAtiva.empresas_obras || []).concat([{ empresa_id: empresaObj.id, empresa: empresaObj }]);
 _obraAtiva.empresas = (_obraAtiva.empresas || []).concat([empresaObj]);
 if (!_obraAtiva.empresa_id) { _obraAtiva.empresa_id = empresaObj.id; _obraAtiva.empresa = empresaObj; }
 var wrap = document.getElementById('sp-ob-empresas-chips');
 if (wrap) wrap.innerHTML = _spEmpresasChipsHTML(_obraAtiva.empresas);
 _spObContatoGateUpdate();
}
// Desvincular (não exclui a empresa, só solta da obra) — mesmo padrão de
// _spDesvincularEntrega. Se o contato do orçamento pertencia só a essa
// empresa, desvincula ele também (não faz sentido sobrar "órfão").
async function _spDesvincularEmpresaObra(empresaId) {
 if (!_obraAtiva || !_obraAtiva.id) return;
 var emp = (_obraAtiva.empresas || []).find(function(e){ return e.id === empresaId; });
 if (!confirm('Desvincular "' + (emp ? emp.nome : 'esta empresa') + '" desta obra?')) return;
 var del = await _sb.from('empresas_obras').delete().eq('obra_id', _obraAtiva.id).eq('empresa_id', empresaId);
 if (del.error) { alert('Erro ao desvincular: ' + (del.error.message || '')); return; }
 _obraAtiva.empresas_obras = (_obraAtiva.empresas_obras || []).filter(function(l){ return l.empresa_id !== empresaId; });
 _obraAtiva.empresas = (_obraAtiva.empresas || []).filter(function(e){ return e.id !== empresaId; });
 if (_obraAtiva.empresa_id === empresaId) {
  var proxima = _obraAtiva.empresas[0] || null;
  _obraAtiva.empresa_id = proxima ? proxima.id : null;
  _obraAtiva.empresa = proxima;
 }
 if (_obraAtiva.contato_id) {
  var cttAtual = (_contatosArr || []).find(function(c){ return c.id === _obraAtiva.contato_id; });
  if (cttAtual && cttAtual.empresa_id === empresaId) {
   await _sb.from('contatos_obras').delete().eq('obra_id', _obraAtiva.id).eq('contato_id', _obraAtiva.contato_id);
   _obraAtiva.contato_id = null; _obraAtiva.contato = null;
   if (typeof _spObContatoSelectItem === 'function') _spObContatoSelectItem('', '');
  }
 }
 var wrap = document.getElementById('sp-ob-empresas-chips');
 if (wrap) wrap.innerHTML = _spEmpresasChipsHTML(_obraAtiva.empresas);
 _spObContatoGateUpdate();
 _dbLoadObras(); _dbLoadObrasKanban();
}
// Atualiza só o texto/placeholder da caixa de Contato quando o conjunto de
// empresas vinculadas muda (adicionar a 1ª habilita, remover a última
// desabilita) — sem precisar re-renderizar o painel inteiro.
function _spObContatoGateUpdate() {
 var temEmpresa = !!((_obraAtiva && _obraAtiva.empresas || []).length);
 var valEl = document.getElementById('sp-ob-contato-val');
 if (valEl) valEl.textContent = temEmpresa ? 'Adicionar contato existente...' : 'Selecione uma empresa primeiro';
}
function _spObEmpresaKey(e) { if (e.key === 'Escape') _spObEmpresaClose(); }

// ── Contato: caixa "Adicionar contato existente" — mesmo espírito de
// _spObEmpresaMarkup acima (uma Obra pode ter mais de 1 contato). Cada
// escolha já dispara o insert em contatos_obras e a caixa volta pro estado
// neutro; quem representa o estado de verdade é a lista de chips
// "Contatos vinculados" (_spContatosChipsHTML), lida de _obraAtiva.contatos.
function _spObContatoMarkup() {
 var temEmpresa = !!((_obraAtiva && _obraAtiva.empresas || []).length);
 return '<div class="srch-sel" id="sp-ob-contato-srch" style="flex:1">'
  + '<div class="srch-sel-box" id="sp-ob-contato-box" onclick="_spObContatoToggle()">'
  + '<span class="srch-sel-val placeholder" id="sp-ob-contato-val">' + (temEmpresa ? 'Adicionar contato existente...' : 'Selecione uma empresa primeiro') + '</span>'
  + '<span class="srch-sel-chevron">▾</span>'
  + '</div>'
  + '<div class="srch-sel-drop" id="sp-ob-contato-drop">'
  + '<input class="srch-sel-inp" id="sp-ob-contato-inp" type="text" placeholder="Buscar contato..." oninput="_spObContatoFilter(this.value)" onkeydown="_spObContatoKey(event)">'
  + '<div class="srch-sel-list" id="sp-ob-contato-list"></div>'
  + '</div>'
  + '</div>';
}
function _spObContatoToggle() {
 if (!((_obraAtiva && _obraAtiva.empresas || []).length)) return; // sem empresa vinculada, nada pra listar
 var drop = document.getElementById('sp-ob-contato-drop');
 var box  = document.getElementById('sp-ob-contato-box');
 if (!drop) return;
 if (drop.classList.contains('open')) { _spObContatoClose(); return; }
 drop.classList.add('open'); if (box) box.classList.add('open');
 var inp = document.getElementById('sp-ob-contato-inp');
 if (inp) { inp.value = ''; inp.focus(); }
 _spObContatoFilter('');
 _srchSelPositionEl(drop, box);
}
function _spObContatoClose() {
 var drop = document.getElementById('sp-ob-contato-drop');
 var box  = document.getElementById('sp-ob-contato-box');
 if (drop) drop.classList.remove('open');
 if (box)  box.classList.remove('open');
}
function _spObContatoFilter(q) {
 q = (q || '').toLowerCase();
 var list = document.getElementById('sp-ob-contato-list');
 if (!list) return;
 // Pool = contatos cuja empresa PRIMÁRIA (c.empresa_id, sintetizado em
 // _dbLoadContatos) está entre QUALQUER uma das empresas vinculadas a esta
 // obra, MENOS os que já estão vinculados (sem sentido "adicionar" de novo).
 var empIds = (_obraAtiva && _obraAtiva.empresas || []).map(function(e){ return e.id; });
 var jaVinculados = new Set((_obraAtiva && _obraAtiva.contatos || []).map(function(c){ return c.id; }));
 var pool = empIds.length ? (_contatosArr || []).filter(function(c){ return empIds.indexOf(c.empresa_id) !== -1 && !jaVinculados.has(c.id); }) : [];
 var matches = pool.filter(function(c){
  return (c.nome_completo||'').toLowerCase().indexOf(q) !== -1 || (c.cargo||'').toLowerCase().indexOf(q) !== -1;
 });
 if (!matches.length) { list.innerHTML = '<div class="srch-sel-empty">Nenhum contato encontrado.</div>'; return; }
 list.innerHTML = matches.map(function(c){
  var label = c.nome_completo + (c.cargo ? ' · ' + c.cargo : '');
  return '<div class="srch-sel-opt" onclick="_spObContatoSelectItem(\'' + c.id + '\',\'' + label.replace(/'/g,"\\'") + '\')">' + label.replace(/</g,'&lt;') + '</div>';
 }).join('');
}
async function _spObContatoSelectItem(id, label) {
 _spObContatoClose();
 if (!id || !_obraAtiva || !_obraAtiva.id) return;
 if ((_obraAtiva.contatos || []).some(function(c){ return c.id === id; })) return; // já vinculado
 var ins = await _sb.from('contatos_obras').upsert({ obra_id: _obraAtiva.id, contato_id: id }, { onConflict: 'obra_id,contato_id', ignoreDuplicates: true });
 if (ins.error) { alert('Erro ao vincular contato: ' + (ins.error.message || '')); return; }
 var cttObj = (_contatosArr || []).find(function(c){ return c.id === id; }) || { id: id, nome_completo: label };
 _spContatoObraLocalAdd(cttObj);
}
function _spObContatoKey(e) { if (e.key === 'Escape') _spObContatoClose(); }

// ── Contatos vinculados: chips + estado local (mesmo padrão de
// _spEmpresasChipsHTML/_spEmpresaObraLocalAdd acima). ──────────────────────
function _spContatosChipsHTML(contatos) {
 var lista = contatos || [];
 if (!lista.length) return '<div class="sp-empty">Nenhum contato vinculado.</div>';
 return lista.map(function(c){
  var label = c.nome_completo || '(sem nome)';
  return _spRelChipHTML('contatos', c.id, label, c.cargo || null, "_spDesvincularContatoObra('" + c.id + "')");
 }).join('');
}
function _spContatoObraLocalAdd(cttObj) {
 if (!_obraAtiva) return;
 _obraAtiva.contatos_obras = (_obraAtiva.contatos_obras || []).concat([{ contato_id: cttObj.id, contato: cttObj }]);
 _obraAtiva.contatos = (_obraAtiva.contatos || []).concat([cttObj]);
 if (!_obraAtiva.contato_id) { _obraAtiva.contato_id = cttObj.id; _obraAtiva.contato = cttObj; }
 var wrap = document.getElementById('sp-ob-contatos-chips');
 if (wrap) wrap.innerHTML = _spContatosChipsHTML(_obraAtiva.contatos);
}
// Desvincular (não exclui o contato, só solta da obra) — mesmo padrão de
// _spDesvincularEmpresaObra.
async function _spDesvincularContatoObra(contatoId) {
 if (!_obraAtiva || !_obraAtiva.id) return;
 var ctt = (_obraAtiva.contatos || []).find(function(c){ return c.id === contatoId; });
 if (!confirm('Desvincular "' + (ctt ? ctt.nome_completo : 'este contato') + '" desta obra?')) return;
 var del = await _sb.from('contatos_obras').delete().eq('obra_id', _obraAtiva.id).eq('contato_id', contatoId);
 if (del.error) { alert('Erro ao desvincular: ' + (del.error.message || '')); return; }
 _obraAtiva.contatos_obras = (_obraAtiva.contatos_obras || []).filter(function(l){ return l.contato_id !== contatoId; });
 _obraAtiva.contatos = (_obraAtiva.contatos || []).filter(function(c){ return c.id !== contatoId; });
 if (_obraAtiva.contato_id === contatoId) {
  var proximo = _obraAtiva.contatos[0] || null;
  _obraAtiva.contato_id = proximo ? proximo.id : null;
  _obraAtiva.contato = proximo;
 }
 var wrap = document.getElementById('sp-ob-contatos-chips');
 if (wrap) wrap.innerHTML = _spContatosChipsHTML(_obraAtiva.contatos);
}
document.addEventListener('click', function(e) {
 var eDrop = document.getElementById('sp-ob-empresa-drop'), eBox = document.getElementById('sp-ob-empresa-box');
 if (eDrop && eBox && !eBox.contains(e.target) && !eDrop.contains(e.target)) _spObEmpresaClose();
 var cDrop = document.getElementById('sp-ob-contato-drop'), cBox = document.getElementById('sp-ob-contato-box');
 if (cDrop && cBox && !cBox.contains(e.target) && !cDrop.contains(e.target)) _spObContatoClose();
});

// ── Quick-create Empresa ──────────────────────────────────────────────────────
function _spToggleNovaEmpresa() {
 const f = document.getElementById('sp-nova-empresa-form');
 if (!f) return;
 var abrir = f.style.display === 'none';
 f.style.display = abrir ? 'block' : 'none';
 if (abrir) {
  _spEmpCategoriaSel = [];
  _spEmpRenderCategoriaDropdown();
 }
}
// Nome próprio (_spCriarEmpresaObra, não _spCriarEmpresa) de propósito —
// empresas.js já define uma _spCriarEmpresa GLOBAL diferente (openNovaEmpresa,
// tela de Empresas). Como os dois arquivos são scripts globais (sem módulos),
// e empresas.js carrega DEPOIS de obras.js no index.html, uma função com o
// mesmo nome nos dois SOBRESCREVIA silenciosamente a desta — o botão "Criar
// empresa" aqui dentro da Obra sempre chamava a versão errada (lendo os ids
// sp-emp-nome/sp-emp-cnpj da OUTRA tela, que nem existem aqui), então nunca
// funcionava de verdade. Achado ao investigar o pedido de auto-vínculo.
async function _spCriarEmpresaObra() {
 const nome = document.getElementById('sp-new-emp-nome')?.value?.trim();
 if (!nome) { alert('Nome da empresa é obrigatório.'); return; }
 // Estado também obrigatório (pedido explícito) — mesma regra vale pro
 // formulário equivalente do wizard de Nova Obra (_noSalvarNovaEmpresa).
 const estado = document.getElementById('sp-new-emp-uf')?.value || '';
 if (!estado) { alert('Estado da empresa é obrigatório.'); return; }
 // Mesma regra de _spCriarEmpresa/_spCriarContato (empresas.js): CNPJ vazio
 // é permitido, incompleto bloqueia — o molde preenche posições vazias com
 // "_", então quem decide é a contagem de dígitos reais, não um if(!cnpj).
 const cnpjEl = document.getElementById('sp-new-emp-cnpj');
 const cnpjDigits = ((cnpjEl || {}).value || '').replace(/\D/g, '');
 if (cnpjDigits.length > 0 && cnpjDigits.length < 14) {
  alert('CNPJ incompleto — informe os 14 dígitos, ou deixe em branco.');
  return;
 }
 const cnpj = cnpjDigits.length === 14 ? _empCnpjMaskValue(cnpjDigits) : null;
 if (cnpj && await _empCnpjJaExiste(cnpj, null)) {
  alert('Já existe uma empresa cadastrada com este CNPJ.');
  return;
 }
 const payload = {
  nome,
  cnpj,
  estado,
  fase_ciclo_vida: document.getElementById('sp-new-emp-fase')?.value || null,
  categoria: (_spEmpCategoriaSel || []).slice(),
  url_site: document.getElementById('sp-new-emp-site')?.value?.trim() || null,
 };
 const { data, error } = await _sb.from('empresas').insert(payload).select().single();
 if (error || !data) { alert('Erro ao criar empresa: ' + (error?.message || '')); return; }
 // Vincula já à obra atual (mesmo espírito de _spCriarContato, que já grava
 // o vínculo na hora de criar) — pedido explícito: antes, o vínculo só era
 // gravado quando o formulário INTEIRO da Obra fosse salvo (_spSaveObraFull),
 // um passo extra e fácil de esquecer depois de criar a empresa aqui.
 if (_obraAtiva && _obraAtiva.id) {
  const linkRes = await _sb.from('empresas_obras').insert({ obra_id: _obraAtiva.id, empresa_id: data.id });
  if (linkRes.error) console.error('[Obras] erro ao vincular nova empresa à obra:', linkRes.error);
 }
 _empresasArr.push(data);
 _empresasArr.sort((a,b) => a.nome.localeCompare(b.nome));
 // _spEmpresaObraLocalAdd (não _spObEmpresaSelectItem) — o vínculo já foi
 // gravado acima; só falta refletir no estado local/chips, sem inserir de
 // novo em empresas_obras.
 if (typeof _spEmpresaObraLocalAdd === 'function') _spEmpresaObraLocalAdd(data);
 _spToggleNovaEmpresa();
 _dbLoadObras(); _dbLoadObrasKanban();
 _dbLoadEmpresas(); // atualiza tabela de empresas em segundo plano
}

// ── Quick-create Contato ──────────────────────────────────────────────────────
// ── Quick-create Instalação ────────────────────────────────────────────────────
function _spToggleNovaInstalacao() {
 const f = document.getElementById('sp-nova-instalacao-form');
 if (f) f.style.display = f.style.display === 'none' ? 'block' : 'none';
}
async function _spCriarInstalacao() {
 if (!_obraAtiva || !_obraAtiva.id) return;
 const payload = {
  obra_id: _obraAtiva.id,
  tipo_servico: document.getElementById('sp-new-inst-tipo')?.value || null,
  funil: document.getElementById('sp-new-inst-funil')?.value || null,
  data_inicio: document.getElementById('sp-new-inst-inicio')?.value || null,
  data_fim: document.getElementById('sp-new-inst-fim')?.value || null,
  valor_total_gasto: document.getElementById('sp-new-inst-valor')?.value !== '' ? Number(document.getElementById('sp-new-inst-valor')?.value) : null,
  detalhes: document.getElementById('sp-new-inst-detalhes')?.value?.trim() || null,
 };
 const { error } = await _sb.from('instalacoes').insert(payload);
 if (error) { alert('Erro ao criar instalação: ' + (error?.message || '')); return; }
 // Instalação nova muda a contagem/lista mostrada nesta mesma seção — mais
 // simples e seguro recarregar o painel inteiro (_spObraById já faz um
 // Promise.all rápido) do que tentar remontar só o pedaço de instalações.
 _spObraById(_obraAtiva.id);
 if (typeof _dbLoadInstalacoes === 'function') _dbLoadInstalacoes();
}

// ── Quick-create Projeto (aba Projetos do detalhamento de Obra) ────────────────
// Pedido explícito: faltava a opção de criar um projeto direto por aqui — só
// existia dentro do wizard de Nova Obra. Segue o MESMO modelo de formulário
// (Nome/Etapa/Tipo restrito aos tipos da obra/Produto filtrado/Responsável
// com avatar/Tipologia/Quantidade/Valor/M²/Descritivo), com ids próprios
// (sp-proj-*) pra não colidir com o formulário equivalente de dentro do
// wizard (no-proj-*) nem com o de dentro do painel de Entrega (ent-proj-*) —
// mesma cautela já aplicada nesses dois. _obraAtiva já está disponível aqui
// (painel de Obra), diferente do painel de Entrega que pode abrir sem obra
// carregada — então usa _obraAtiva.tipo_obra direto, sem precisar buscar.
var _spNovoProj = null;
function _spToggleNovoProjeto() {
 var box = document.getElementById('sp-novo-proj-form-box');
 if (!box || !_obraAtiva) return;
 var abrir = box.style.display === 'none' || !box.style.display;
 if (abrir) {
  var tipoObraOpcoes = (_obraAtiva.tipo_obra || []).slice();
  _spNovoProj = {
   obraId: _obraAtiva.id, nome: '', etapaProjeto: '', tipoObra: tipoObraOpcoes.length === 1 ? tipoObraOpcoes[0] : '',
   produtoNomes: [], responsavelEmails: [], qtd: '', vuni: '', m2Arquitetura: '', m2Estrutura: '',
   tipologiaTelhado: [], tipologiaTelha: [], descritivo: '', tipoObraOpcoes: tipoObraOpcoes,
  };
  box.innerHTML = _spProjFormHTML();
  box.style.display = 'block';
  if (typeof _loadUsuariosCache === 'function') _loadUsuariosCache().then(function(){ box.innerHTML = _spProjFormHTML(); });
  if (typeof _respLoadUsers === 'function') _respLoadUsers().then(function(){ box.innerHTML = _spProjFormHTML(); }).catch(function(){});
  if (typeof _loadAvatarCacheFast === 'function') _loadAvatarCacheFast().then(function(){ box.innerHTML = _spProjFormHTML(); }).catch(function(){});
  if (!_produtosArr.length && _sb) {
   _sb.from('produtos').select('id,nome,categoria').order('nome').then(function(r){ _produtosArr = r.data || []; box.innerHTML = _spProjFormHTML(); });
  }
 } else {
  box.style.display = 'none';
  box.innerHTML = '';
  _spNovoProj = null;
 }
}
function _spProjSet(field, value) {
 if (!_spNovoProj) return;
 _spNovoProj[field] = value;
 if (field === 'tipoObra') {
  var box = document.getElementById('sp-novo-proj-form-box');
  if (box) box.innerHTML = _spProjFormHTML();
 }
}
function _spProjFormHTML() {
 var p = _spNovoProj;
 if (!p) return '';
 var produtosDisponiveis = (typeof _noProdutosDisponiveis === 'function') ? _noProdutosDisponiveis(p.tipoObra) : (_produtosArr || []);
 // Padronizado com o dropdown buscável já usado em Etapa/Cidade/UF/Canal —
 // pedido explícito de consistência visual entre todos os selects do
 // sistema, com busca. Substitui as pills coloridas usadas antes aqui.
 _srchSelRegister('spProjTipo', {
  options: p.tipoObraOpcoes || [], placeholder: 'Selecione o tipo...',
  onSelect: function(v) { _spProjSet('tipoObra', v); },
 });
 var html = '<div style="border:1px solid var(--border);border-radius:10px;padding:14px;background:var(--surface2);display:flex;flex-direction:column;gap:12px">';
 html += '<div class="modal-grid col2" style="gap:12px">'
  + '<div class="mf" style="margin:0"><label style="font-size:11px">Nome do projeto <span class="req">*</span></label>'
  + '<input class="sp-inp" style="font-size:12px;text-transform:uppercase" value="' + (p.nome||'') + '" oninput="_upperCaseInput(this);_spProjSet(\'nome\',this.value)"></div>'
  + '<div class="mf" style="margin:0"><label style="font-size:11px">Etapa do projeto <span class="req">*</span></label>'
  + '<select class="sp-inp" style="font-size:12px" onchange="_spProjSet(\'etapaProjeto\',this.value)">'
  + '<option value="">Selecione...</option>'
  + (_NO_PROJETO_ETAPA_OPCOES||[]).map(function(et){ return '<option' + (et===p.etapaProjeto?' selected':'') + '>' + et + '</option>'; }).join('')
  + '</select></div>'
  + '</div>';
 html += '<div class="mf" style="margin:0"><label style="font-size:11px">Tipo de obra do projeto <span class="req">*</span></label>'
  + '<div style="margin-top:6px">' + _srchSelMarkup('spProjTipo', 'sp-proj-tipo', p.tipoObra) + '</div></div>';
 html += '<div class="modal-grid col2" style="gap:12px">'
  + '<div class="mf" style="margin:0"><label style="font-size:11px">Produto <span class="req">*</span></label>'
  + '<div id="sp-proj-produto-dd" class="no-msel-wide" style="margin-top:4px">' + _msRenderDropdown('spProjProduto', produtosDisponiveis.map(function(pr){return pr.nome;}), p.produtoNomes, '_spProjMultiToggle', 'Selecione o(s) produto(s)...') + '</div></div>'
  + '<div class="mf" style="margin:0"><label style="font-size:11px">Responsável <span class="req">*</span></label>'
  + '<div id="sp-proj-resp-dd" class="no-msel-wide" style="margin-top:4px">' + _spProjRespDropdownMarkup() + '</div></div>'
  + '</div>';
 html += '<div class="modal-grid col2" style="gap:12px">'
  + '<div class="mf" style="margin:0"><label style="font-size:11px">Tipologia do Telhado</label>'
  + '<div id="sp-proj-telhado-dd" class="no-msel-wide" style="margin-top:4px">' + _msRenderDropdown('spProjTelhado', _NO_TIPOLOGIA_TELHADO_OPCOES||[], p.tipologiaTelhado, '_spProjMultiToggle', 'Selecione a(s) tipologia(s)...') + '</div></div>'
  + '<div class="mf" style="margin:0"><label style="font-size:11px">Tipo de Telha</label>'
  + '<div id="sp-proj-telha-dd" class="no-msel-wide" style="margin-top:4px">' + _msRenderDropdown('spProjTelha', _NO_TIPO_TELHA_OPCOES||[], p.tipologiaTelha, '_spProjMultiToggle', 'Selecione o(s) tipo(s)...') + '</div></div>'
  + '</div>';
 html += '<div class="modal-grid col2" style="gap:12px">'
  + '<div class="mf" style="margin:0"><label style="font-size:11px">Quantidade</label>'
  + '<input class="sp-inp" style="font-size:12px" type="number" min="0" value="' + (p.qtd||'') + '" oninput="_spProjSet(\'qtd\',this.value)"></div>'
  + '<div class="mf" style="margin:0"><label style="font-size:11px">Valor unit. (R$)</label>'
  + '<input class="sp-inp" style="font-size:12px" type="text" value="' + (p.vuni||'') + '" oninput="_spProjSet(\'vuni\',this.value)"></div>'
  + '</div>';
 html += '<div class="modal-grid col2" style="gap:12px">'
  + '<div class="mf" style="margin:0"><label style="font-size:11px">M² Arquitetura</label>'
  + '<div style="position:relative"><input class="sp-inp" style="font-size:12px;padding-right:30px" type="number" min="0" step="0.01" value="' + (p.m2Arquitetura||'') + '" oninput="_spProjSet(\'m2Arquitetura\',this.value)">'
  + '<span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:11px;color:var(--muted);pointer-events:none">m²</span></div></div>'
  + '<div class="mf" style="margin:0"><label style="font-size:11px">M² Estrutura</label>'
  + '<div style="position:relative"><input class="sp-inp" style="font-size:12px;padding-right:30px" type="number" min="0" step="0.01" value="' + (p.m2Estrutura||'') + '" oninput="_spProjSet(\'m2Estrutura\',this.value)">'
  + '<span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:11px;color:var(--muted);pointer-events:none">m²</span></div></div>'
  + '</div>';
 html += '<div class="mf" style="margin:0"><label style="font-size:11px">Descritivo do projeto</label>'
  + '<textarea class="sp-inp" style="font-size:12px;height:56px" oninput="_spProjSet(\'descritivo\',this.value)">' + (p.descritivo||'') + '</textarea></div>';
 html += '<div style="display:flex;gap:8px">'
  + '<button type="button" onclick="_spProjSalvar()" style="font-size:12px;font-weight:600;padding:7px 16px;border:none;border-radius:7px;background:var(--green);color:#fff;cursor:pointer">Salvar projeto</button>'
  + '<button type="button" onclick="_spToggleNovoProjeto()" style="font-size:12px;padding:7px 16px;border:1px solid var(--border);border-radius:7px;background:transparent;color:var(--muted);cursor:pointer">Cancelar</button>'
  + '</div>';
 html += '</div>';
 return html;
}
function _spProjMultiToggle(campo, valor, checked) {
 if (!_spNovoProj) return;
 var field = campo === 'spProjProduto' ? 'produtoNomes' : campo === 'spProjTelhado' ? 'tipologiaTelhado' : 'tipologiaTelha';
 _spNovoProj[field] = _msToggle(_spNovoProj[field], valor, checked);
 var ddId = campo === 'spProjProduto' ? 'sp-proj-produto-dd' : campo === 'spProjTelhado' ? 'sp-proj-telhado-dd' : 'sp-proj-telha-dd';
 var opcoes = campo === 'spProjProduto'
  ? ((typeof _noProdutosDisponiveis === 'function' ? _noProdutosDisponiveis(_spNovoProj.tipoObra) : _produtosArr).map(function(pr){return pr.nome;}))
  : campo === 'spProjTelhado' ? (_NO_TIPOLOGIA_TELHADO_OPCOES||[]) : (_NO_TIPO_TELHA_OPCOES||[]);
 var wrap = document.getElementById(ddId);
 if (wrap) {
  wrap.innerHTML = _msRenderDropdown(campo, opcoes, _spNovoProj[field], '_spProjMultiToggle', 'Selecione...');
  var painel = wrap.querySelector('.fb-msel-panel');
  if (painel) painel.classList.add('open');
 }
}
function _spProjRespDropdownMarkup() {
 var p = _spNovoProj;
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
   + ' onchange="_spProjRespToggle(this.value,this.checked)">' + avatarHtml + '<span>' + label.replace(/</g,'&lt;') + '</span></label>';
 }).join('');
 return '<div class="fb-msel-wrap">'
  + '<button type="button" class="fb-msel-btn" onclick="this.nextElementSibling.classList.toggle(\'open\')">' + btnLabel + '</button>'
  + '<div class="fb-msel-panel">' + searchHtml + '<div class="fb-msel-list">' + (itemsHtml || '<div style="padding:8px;font-size:11px;color:var(--muted)">Nenhum usuário cadastrado</div>') + '</div></div>'
  + '</div>';
}
function _spProjRespToggle(email, checked) {
 if (!_spNovoProj) return;
 _spNovoProj.responsavelEmails = _msToggle(_spNovoProj.responsavelEmails, email, checked);
 var wrap = document.getElementById('sp-proj-resp-dd');
 if (wrap) {
  wrap.innerHTML = _spProjRespDropdownMarkup();
  var painel = wrap.querySelector('.fb-msel-panel');
  if (painel) painel.classList.add('open');
 }
}
async function _spProjSalvar() {
 var p = _spNovoProj;
 if (!p || !_obraAtiva) return;
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
 if (res.error) { _showToast('Erro ao criar projeto: ' + res.error.message, 'erro'); return; }
 _showToast('Projeto criado com sucesso!', 'ok');
 _spNovoProj = null;
 _spObraById(_obraAtiva.id);
 if (typeof _dbLoadProjetos === 'function') _dbLoadProjetos();
}

// ── Quick-create Entrega ────────────────────────────────────────────────────────
// Mesmo espírito de _spCriarInstalacao — openNovaEntrega() (entregas.js) é
// só um alert() de placeholder até hoje, não existia nenhuma forma de
// criar/associar uma entrega a uma obra pelo sistema.
function _spToggleNovaEntrega() {
 const f = document.getElementById('sp-nova-entrega-form');
 if (!f) return;
 var abrir = f.style.display === 'none';
 f.style.display = abrir ? 'block' : 'none';
 // Reseta a seleção de Transporte a cada abertura — sem isso, um valor
 // escolhido antes de cancelar ficava "preso" na próxima abertura do
 // mesmo formulário (painel não recarrega inteiro só de abrir/fechar).
 if (abrir && typeof _srchSelSelectItem === 'function') _srchSelSelectItem('entTransporte', '');
}
// Upload de um documento específico da entrega — mesma mecânica de
// _spEnviarDocObra (bucket documentos_obras), só que aqui o registro carrega
// entrega_id (coluna nova) além de obra_id, e o "tipo" identifica se é
// "Documento da Entrega" ou "Ordem de Produção" (os 2 anexos do formulário
// do Airtable). Erro de upload não derruba a criação da entrega em si —
// ela já foi criada com sucesso quando isto roda; só avisa.
// ── Dropzone genérico (Documentos específicos da entrega / Ordem de Produção) ──
// Mesmo visual (ícone + "clique ou arraste") do dropzone único já usado em
// Documentos da Obra (_spUploadDrop/#sp-upload-dropzone), só que
// parametrizado por par de ids — aqui precisa de 2 instâncias lado a lado
// (compactas), então não dava pra reaproveitar direto os ids fixos daquele.
function _spEntDropzone(inputId, labelId, multi) {
 return '<label style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;border:2px dashed var(--border);border-radius:8px;padding:12px 8px;cursor:pointer;transition:border-color .15s,background .15s;text-align:center"'
  + ' onmouseover="this.style.borderColor=\'var(--navy)\';this.style.background=\'rgba(59,130,246,.04)\'"'
  + ' onmouseout="this.style.borderColor=\'var(--border)\';this.style.background=\'\'"'
  + ' ondragover="event.preventDefault();this.style.borderColor=\'var(--navy)\';this.style.background=\'rgba(59,130,246,.07)\'"'
  + ' ondragleave="this.style.borderColor=\'var(--border)\';this.style.background=\'\'"'
  + ' ondrop="_spEntFileDrop(event,\'' + inputId + '\',\'' + labelId + '\',' + (multi ? 'true' : 'false') + ')">'
  + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.7"><path d="M12 16V8M8 12l4-4 4 4"/><path d="M20 16.5A4.5 4.5 0 0015.5 12H15a6 6 0 10-11.8 1.5"/></svg>'
  + '<span id="' + labelId + '" style="font-size:10px;color:var(--muted)">Clique ou arraste aqui</span>'
  + '<input type="file" id="' + inputId + '"' + (multi ? ' multiple' : '') + ' style="display:none" onchange="_spEntFileChange(\'' + inputId + '\',\'' + labelId + '\',' + (multi ? 'true' : 'false') + ')">'
  + '</label>';
}
function _spEntFileChange(inputId, labelId) {
 var input = document.getElementById(inputId);
 var lbl = document.getElementById(labelId);
 if (!input || !lbl) return;
 var files = input.files;
 if (!files || !files.length) { lbl.textContent = 'Clique ou arraste aqui'; return; }
 lbl.innerHTML = files.length > 1
  ? '<span style="color:var(--green);font-weight:700">✓ ' + files.length + ' arquivos</span>'
  : '<span style="color:var(--green);font-weight:700">✓ ' + files[0].name + '</span>';
}
function _spEntFileDrop(event, inputId, labelId, multi) {
 event.preventDefault();
 var dz = event.currentTarget;
 dz.style.borderColor = 'var(--border)'; dz.style.background = '';
 var files = event.dataTransfer && event.dataTransfer.files;
 if (!files || !files.length) return;
 var input = document.getElementById(inputId);
 if (!input) return;
 try {
  var dt = new DataTransfer();
  var toAdd = multi ? Array.from(files) : [files[0]];
  toAdd.forEach(function(f){ dt.items.add(f); });
  input.files = dt.files;
  _spEntFileChange(inputId, labelId);
 } catch(e) { _showToast('Arraste não suportado — use o botão de seleção', 'aviso'); }
}
async function _spUploadDocEntrega(file, entregaId, obraId, tipo) {
 var ext = (file.name.split('.').pop() || 'bin').toLowerCase();
 var path = 'entregas/' + entregaId + '/' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9_.\-]/g,'_');
 var up = await _sb.storage.from('documentos_obras').upload(path, file, { upsert: false });
 if (up.error) { console.error('[Obras] erro ao enviar anexo de entrega:', up.error); return false; }
 var ins = await _sb.from('documentos').insert({
  obra_id: obraId, entrega_id: entregaId, nome_arquivo: file.name, nome: file.name,
  tipo: tipo, categoria: 'Técnico', caminho_storage: path, tamanho_bytes: file.size,
  mime_type: file.type, status: 'Ativo', versao: 1, origem: 'upload_manual',
 });
 if (ins.error) { console.error('[Obras] erro ao registrar anexo de entrega:', ins.error); return false; }
 return true;
}
async function _spCriarEntrega() {
 if (!_obraAtiva || !_obraAtiva.id) return;
 // Obrigatórios (*), igual ao formulário real do Airtable: Entrega, Etapa
 // da entrega, Data de faturamento, Quantidade.
 const nome = document.getElementById('sp-new-ent-nome')?.value?.trim();
 const etapa = document.getElementById('sp-new-ent-etapa')?.value || '';
 const data = document.getElementById('sp-new-ent-data')?.value || '';
 const qtdStr = document.getElementById('sp-new-ent-qtd')?.value || '';
 const faltando = [];
 if (!nome) faltando.push('Entrega');
 if (!etapa) faltando.push('Etapa da entrega');
 if (!data) faltando.push('Data de faturamento');
 if (qtdStr === '') faltando.push('Quantidade');
 if (faltando.length) { alert('Preencha os campos obrigatórios: ' + faltando.join(', ') + '.'); return; }
 const payload = {
  obra_id: _obraAtiva.id,
  nome_entrega: nome,
  etapa: etapa,
  data_faturamento: data,
  quantidade: Number(qtdStr),
  peso_kg: document.getElementById('sp-new-ent-peso')?.value !== '' ? Number(document.getElementById('sp-new-ent-peso')?.value) : null,
  valor: document.getElementById('sp-new-ent-valor')?.value !== '' ? Number(document.getElementById('sp-new-ent-valor')?.value) : null,
  transporte: document.getElementById('sp-new-ent-transporte')?.value?.trim() || null,
  pedido_produzido: !!document.getElementById('sp-new-ent-produzido')?.checked,
 };
 const { data: nova, error } = await _sb.from('entregas').insert(payload).select().single();
 if (error || !nova) { alert('Erro ao criar entrega: ' + (error?.message || '')); return; }
 const docFiles = Array.from(document.getElementById('sp-new-ent-doc')?.files || []);
 const opFile = document.getElementById('sp-new-ent-op')?.files?.[0];
 let anexosComErro = 0;
 for (const f of docFiles) { if (!(await _spUploadDocEntrega(f, nova.id, _obraAtiva.id, 'Documento da Entrega'))) anexosComErro++; }
 if (opFile) { if (!(await _spUploadDocEntrega(opFile, nova.id, _obraAtiva.id, 'Ordem de Produção'))) anexosComErro++; }
 if (anexosComErro) alert('Entrega criada, mas ' + anexosComErro + ' anexo(s) não foram enviados. Você pode anexá-los depois pela aba Documentos.');
 _spObraById(_obraAtiva.id);
 if (typeof _dbLoadEntregas === 'function') _dbLoadEntregas();
}
// entregas.obra_id é coluna direta (não junção N:N como empresas/contatos)
// — "desvincular" aqui é só limpar essa FK, sem apagar a entrega em si
// (pedido explícito: a entrega continua existindo no sistema, só solta da
// obra atual).
async function _spDesvincularEntrega(id, nome) {
 if (!confirm('Desvincular "' + (nome || 'esta entrega') + '" desta obra?\n\nA entrega não será excluída, só deixa de aparecer aqui.')) return;
 const { error } = await _sb.from('entregas').update({ obra_id: null }).eq('id', id);
 if (error) { alert('Erro ao desvincular: ' + (error?.message || '')); return; }
 if (_obraAtiva && _obraAtiva.id) _spObraById(_obraAtiva.id);
 if (typeof _dbLoadEntregas === 'function') _dbLoadEntregas();
}
// Exclusão de verdade (não é o "desvincular" acima) — só admin (botão só
// aparece pra admin, e a política de DELETE de `entregas` no banco também
// só libera pra admin; ver migração restrict_obras_entregas_delete_to_admin).
// ON DELETE CASCADE em documentos/documentos_entregas cuida dos anexos.
async function _spExcluirEntrega(id, nome) {
 if (!confirm('Excluir "' + (nome || 'esta entrega') + '" PERMANENTEMENTE?\n\nOs documentos anexados a ela também serão excluídos. Esta ação não pode ser desfeita.')) return;
 const { error } = await _sb.from('entregas').delete().eq('id', id);
 if (error) { alert('Erro ao excluir: ' + (error?.message || '')); return; }
 if (_obraAtiva && _obraAtiva.id) _spObraById(_obraAtiva.id);
 if (typeof _dbLoadEntregas === 'function') _dbLoadEntregas();
}
// Exclusão de Obra — só admin (botão + política de DELETE no banco, mesmo
// esquema de _spExcluirEntrega). Cascata real do schema (ver FKs de obras):
// empresas_obras/contatos_obras/atividades_obras/documentos/
// memorial_calculo_obras são apagados junto (ON DELETE CASCADE); Projetos/
// Entregas/Instalações NÃO são excluídos, só ficam com obra_id nulo (ON
// DELETE SET NULL) — aviso disso no próprio confirm(), pra não parecer que
// a obra "sumiu com tudo".
async function _spExcluirObra(id, nome) {
 if (!confirm('Excluir "' + (nome || 'esta obra') + '" PERMANENTEMENTE?\n\nDocumentos e vínculos com empresa/contato/tarefas desta obra também serão excluídos. Projetos, Entregas e Instalações vinculados NÃO serão excluídos — só ficam sem obra associada. Esta ação não pode ser desfeita.')) return;
 const { error } = await _sb.from('obras').delete().eq('id', id);
 if (error) { alert('Erro ao excluir: ' + (error?.message || '')); return; }
 closePanel();
 if (typeof _dbLoadObras === 'function') _dbLoadObras();
 if (typeof _dbLoadObrasKanban === 'function') _dbLoadObrasKanban();
}

function _spToggleNovoContato() {
 const f = document.getElementById('sp-novo-contato-form');
 if (!f) return;
 var abrir = f.style.display === 'none';
 // Pedido explícito: um contato criado por aqui sempre se associa a uma
 // empresa da obra (ver payload.empresa_id + junção contatos_empresas
 // abaixo) — sem nenhuma empresa vinculada não tem a quem associar, então
 // nem deixa abrir o formulário (em vez de deixar criar "solto" e confundir).
 // Com mais de uma empresa vinculada, usa a primeira (o.empresa_id) — o
 // contato do orçamento continua sendo um campo único da Obra.
 if (abrir && !(_obraAtiva && _obraAtiva.empresa_id)) {
  alert('Vincule (ou crie) ao menos uma empresa à obra antes de adicionar um contato.');
  return;
 }
 f.style.display = abrir ? 'block' : 'none';
}
async function _spCriarContato() {
 const nome = document.getElementById('sp-new-cont-nome')?.value?.trim();
 const empId = _obraAtiva && _obraAtiva.empresa_id;
 if (!nome) { alert('Nome do contato é obrigatório.'); return; }
 if (!empId) { alert('Vincule (ou crie) ao menos uma empresa à obra antes de adicionar um contato.'); return; }
 // Mesma regra de _spSaveContato (empresas.js): 10/11 dígitos salva
 // mascarado, 0 fica em branco, 1-9 bloqueia (senão salvaria o molde
 // incompleto — "(11) 9____-____" — como se fosse o telefone de verdade).
 const telDigits = (document.getElementById('sp-new-cont-tel')?.value || '').replace(/\D/g, '');
 if (telDigits.length > 0 && telDigits.length < 10) {
  alert('Telefone incompleto — informe DDD + número (10 ou 11 dígitos), ou deixe em branco.');
  return;
 }
 const emailVal = document.getElementById('sp-new-cont-email')?.value?.trim() || '';
 if (emailVal && !_cttEmailValida(emailVal)) {
  alert('E-mail inválido — formato esperado: nome@empresa.com.');
  return;
 }
 const payload = {
  nome_completo: nome,
  email:  emailVal || null,
  telefone: telDigits.length > 0 ? _cttTelMaskValue(telDigits) : null,
  // Cargo agora é o select buscável _spCttCargoMarkup (mesmo componente já
  // usado no painel de Contato/"Novo Contato" da aba Contatos) — valor fica
  // no hidden input #sp-ctt-cargo, não mais um <input> de texto solto.
  cargo: document.getElementById('sp-ctt-cargo')?.value || null,
 };
 // Tabela contatos NÃO tem coluna empresa_id (confirmado via schema real) —
 // o vínculo com a empresa vive só na junção N:N contatos_empresas abaixo,
 // igual ao que _cttCriarContato (empresas.js) já faz. Um insert anterior
 // aqui tentava gravar empresa_id direto em contatos e quebrava com
 // "Could not find the 'empresa_id' column of 'contatos'".
 const { data, error } = await _sb.from('contatos').insert(payload).select().single();
 if (error || !data) { alert('Erro ao criar contato: ' + (error?.message || '')); return; }
 if (empId) {
  const { error: linkError } = await _sb.from('contatos_empresas').insert({ contato_id: data.id, empresa_id: empId, is_primary: true });
  if (linkError) console.error('[Obras] erro ao vincular contato_empresas na criação rápida:', linkError);
 }
 // Vincula já à obra atual (mesmo espírito de _spCriarEmpresaObra) — antes
 // esse vínculo só era gravado em contatos_obras quando o formulário
 // INTEIRO da obra fosse salvo (_spSaveObraFull), então recarregar a página
 // (ou abrir a obra de novo) sem salvar antes perdia o contato escolhido.
 if (_obraAtiva && _obraAtiva.id) {
  const { error: obraLinkError } = await _sb.from('contatos_obras').upsert({ obra_id: _obraAtiva.id, contato_id: data.id }, { onConflict: 'obra_id,contato_id', ignoreDuplicates: true });
  if (obraLinkError) console.error('[Obras] erro ao vincular contato à obra na criação rápida:', obraLinkError);
 }
 // Sintetiza empresa_id local (mesmo cálculo de _dbLoadContatos em
 // empresas.js) — sem isso, o contato recém-criado não aparece no pool de
 // "adicionar contato existente" de NENHUMA obra até a próxima carga da
 // tabela de contatos inteira.
 data.empresa_id = empId || null;
 _contatosArr.push(data);
 // _spContatoObraLocalAdd (não _spObContatoSelectItem) — o vínculo já foi
 // gravado acima; só falta refletir no estado local/chips.
 if (typeof _spContatoObraLocalAdd === 'function') _spContatoObraLocalAdd(data);
 _spToggleNovoContato();
}

// ── Filtro/Ordenação/Agrupamento/Período/Visualizações de Obras — mesmos
// componentes reutilizáveis do Gestor de Tarefas (filtro-builder.js/
// sort-builder.js/group-builder.js/smart-search.js/period-picker.js/
// saved-views.js), só troca a config de campos. _fbEvaluate/_sbCompare
// recebem direto o `.dataset` da <tr>/.obra-card como "item": como esses
// elementos já gravam tipo/etapa/empresa/cidade/estado/nome/valor/dataEnvio
// em data-* (ver _dbLoadObras/_dbLoadObrasKanban), field.key bate 1:1 com a
// chave do dataset — nenhum adaptador precisa existir. Agrupar só reflete na
// Tabela (o Kanban já agrupa visualmente por etapa nas próprias colunas —
// aplicar um segundo agrupamento ali seria redundante/confuso).

// Opções calculadas a partir dos dados reais já carregados na Tabela — mesmo
// padrão do Gestor de Tarefas (_gestorOptionsFrom em tarefas.js), só que
// lendo do DOM em vez de um array em memória (Obras não mantém um). Usado
// pelos campos cuja lista de valores possíveis não é um vocabulário fixo do
// negócio (Estado, Empresa): uma lista hardcoded ali ficaria desatualizada
// (ou, no caso de Empresa antes desta correção, nem batia com nenhuma
// empresa real) assim que a base de obras crescesse.
function _obrasOptionsFromDom(datasetKey) {
 var set = {};
 document.querySelectorAll('#obras-tbody tr[data-id]').forEach(function(tr) {
  var v = tr.dataset[datasetKey];
  if (v) set[v] = 1;
 });
 return Object.keys(set).sort(function(a, b){ return a.localeCompare(b, 'pt-BR'); });
}

var _obrasFbFields = Object.keys(_obrasCampos).map(function(k) {
 var c = _obrasCampos[k];
 return { key: k, label: c.label, type: c.type, options: c.opts || [] };
});
_fbInit('obras', _obrasFbFields, _obrasApplyFilters);

var _obrasSbFields = [
 { key: 'nome', label: 'Nome da obra', type: 'text' },
 { key: 'etapa', label: 'Etapa', type: 'text' },
 { key: 'empresa', label: 'Empresa', type: 'text' },
 { key: 'cidade', label: 'Cidade', type: 'text' },
 { key: 'valor', label: 'Valor', type: 'number', getValue: function(ds) { return parseFloat(ds.valor) || 0; } },
 { key: 'dataEnvio', label: 'Envio da proposta', type: 'date', getValue: function(ds) { return ds.dataEnvio || ''; } },
 // Pedido explícito — faltavam estes 5:
 { key: 'quantidade', label: 'Quantidade', type: 'number', getValue: function(ds) { return parseFloat(ds.quantidade) || 0; } },
 { key: 'proposta', label: 'Proposta comercial (anexo)', type: 'text' },
 { key: 'canal', label: 'Canal de vendas', type: 'text' },
 { key: 'tipo', label: 'Categoria da Obra', type: 'text' },
 { key: 'estado', label: 'Estado da Obra', type: 'text' },
];
_sbInit('obras', _obrasSbFields, _obrasApplyFilters);

// Agrupar: campos categóricos só (nome/valor/data não fazem sentido como
// "balde" de agrupamento) — até 3 níveis (_obrasRenderGroupNode abaixo é
// recursivo via _gtBuildTree, igual Gestor/Empresas/Entregas).
var _obrasGbFields = [
 { key: 'etapa',   label: 'Etapa' },
 { key: 'tipo',    label: 'Categoria da obra' },
 { key: 'empresa', label: 'Empresa' },
 { key: 'estado',  label: 'Estado' },
 { key: 'cidade',  label: 'Cidade' },
 // Pedido explícito — faltavam estes 5. Nome/Quantidade/Valor não são
 // categóricos de verdade (1 "balde" por valor distinto, geralmente sem
 // repetição pra Nome) mas o pedido foi literal: qualquer campo pode virar
 // agrupamento, igual no Airtable.
 { key: 'nome',       label: 'Nome da Obra' },
 { key: 'quantidade', label: 'Quantidade' },
 { key: 'valor',      label: 'Valor' },
 { key: 'dataEnvio',  label: 'Data de envio da proposta' },
 { key: 'canal',      label: 'Canal de vendas' },
];
_gbInit('obras', _obrasGbFields, _obrasApplyFilters, 3);
// Obras é a única tela de agrupamento que opera sobre <tr> já existentes no
// DOM (não reconstrói a tbody a partir de um array em memória, como
// Empresas/Entregas/Gestor) — por isso não dá pra simplesmente "não
// renderizar" um grupo colapsado (as linhas ficariam detached e
// desapareceriam de vez do próximo _obrasApplyFilters, que relê a tbody via
// querySelectorAll). Em vez disso, um grupo colapsado ainda tem suas linhas
// anexadas à tbody, só com display:none — ver forceHidden.
var _obrasGroupCollapsed = {};
function _obrasToggleGroup(key) {
 _obrasGroupCollapsed[key] = !_obrasGroupCollapsed[key];
 _obrasApplyFilters();
}
function _obrasRenderGroupNode(node, path, tbody, forceHidden) {
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
  var isCollapsed = !!_obrasGroupCollapsed[pathKey];
  // Contagem calculada ANTES de propagar forceHidden pros filhos — reflete
  // só o filtro (busca/condições), não o colapso, igual ao "(N)" de sempre.
  var visCount = _gtTreeCount(child, function(tr){ return tr.style.display !== 'none'; });
  var indent = 12 + path.length * 20;
  var hd = document.createElement('tr');
  hd.className = 'gestor-group-hd obras-group-row';
  hd.style.position = 'static'; // sticky faria sentido só dentro de um scroll interno (não é o caso de Obras)
  hd.onclick = function(){ _obrasToggleGroup(pathKey); };
  hd.style.display = (forceHidden || !visCount) ? 'none' : '';
  hd.innerHTML = '<td colspan="11" style="padding-left:' + indent + 'px">'
   + '<span style="margin-right:4px">' + (isCollapsed ? '▶' : '▼') + '</span>'
   + '<strong>' + (k || '—') + '</strong>'
   + '<span style="color:var(--muted);font-size:9px;margin-left:6px">(' + visCount + ')</span>'
   + '</td>';
  tbody.appendChild(hd);
  _obrasRenderGroupNode(child, nodePath, tbody, forceHidden || isCollapsed);
 });
}

// Período: dropdown "Período" igual ao do Gestor (period-picker.js), filtra
// pela data de envio da proposta — único campo de data relevante de Obras.
_ppInit('obras', { onChange: _obrasApplyFilters, defaultPreset: 'todas' });

// Visualizações salvas: mesma mecânica do Gestor (saved-views.js), gravando
// modulo='obras' na tabela gestor_views (RLS já libera qualquer usuário
// autenticado a ler/escrever, independente do módulo).
_vwInit('obras', {
 modulo: 'obras',
 getState: function() {
  return {
   filtro: _fbInstances.obras ? _fbInstances.obras.state : { logic: 'AND', conditions: [] },
   sort:   _sbInstances.obras ? _sbInstances.obras.state : { levels: [] },
   group:  _gbInstances.obras ? _gbInstances.obras.state : { levels: [] },
   period: _ppGetState('obras')
  };
 },
 applyState: function(state) {
  if (_sbInstances.obras) { _sbInstances.obras.state = state.sort || { levels: [] }; _sbRender('obras'); }
  if (_gbInstances.obras) { _gbInstances.obras.state = state.group || { levels: [] }; _gbRender('obras'); }
  _ppRestoreState('obras', state.period);
  if (_fbInstances.obras) { _fbInstances.obras.state = state.filtro || { logic: 'AND', conditions: [] }; _fbRender('obras'); _fbApply('obras'); }
  _obrasApplyFilters();
 }
});

function _obrasApplyFilters() {
 var buscaRaw = ((document.getElementById('obras-search') || {}).value || '').trim();
 var buscaNorm = _ssNormalize(buscaRaw);
 var activeConds = _fbInstances.obras.state.conditions.filter(_fbConditionIsUsable).length;
 var visivel = 0;

 // ── Período (envio da proposta) ──────────────────────────────────────────
 var per = _ppGetState('obras');
 var pIni = per.ini, pFim = per.fim; // Date ou null (null = "Todas")

 // ── Tabela ──────────────────────────────────────────────────────────────
 // Remove cabeçalhos de grupo da renderização anterior antes de reconsultar
 // as linhas — eles não têm data-id, então não entram no seletor abaixo.
 Array.prototype.slice.call(document.querySelectorAll('#obras-tbody tr.obras-group-row')).forEach(function(tr){ tr.remove(); });
 var rows = Array.prototype.slice.call(document.querySelectorAll('#obras-tbody tr[data-id]'));
 rows.forEach(function(tr) {
  var ok = _fbEvaluate(tr.dataset, 'obras');
  if (ok && buscaNorm) ok = _ssMatch(_ssNormalize(tr.textContent), buscaNorm);
  if (ok && pIni && pFim) {
   var d = tr.dataset.dataEnvio ? new Date(tr.dataset.dataEnvio + 'T00:00:00') : null;
   ok = !!(d && d >= pIni && d <= pFim);
  }
  tr.style.display = ok ? '' : 'none';
  if (ok) visivel++;
 });
 if (rows.length) {
  rows.sort(function(a, b) { return _sbCompare(a.dataset, b.dataset, 'obras'); });
  var tbody = rows[0].parentElement;
  var groupLevels = (_gbInstances.obras && _gbInstances.obras.state.levels) || [];
  if (groupLevels.length) {
   var tree = _gtBuildTree(rows, groupLevels, function(tr, field) {
    return { key: tr.dataset[field] || 'Sem valor', sortKey: null };
   }, null, 0);
   _obrasRenderGroupNode(tree, [], tbody, false);
  } else {
   rows.forEach(function(tr) { tbody.appendChild(tr); });
  }
 }

 // ── Kanban ────────────────────────────────────────────────────────────────
 var cards = Array.prototype.slice.call(document.querySelectorAll('#obras-kanban .obra-card'));
 cards.forEach(function(card) {
  var ok = _fbEvaluate(card.dataset, 'obras');
  if (ok && buscaNorm) ok = _ssMatch(_ssNormalize(card.dataset.search || ''), buscaNorm);
  if (ok && pIni && pFim) {
   var dCard = card.dataset.dataEnvio ? new Date(card.dataset.dataEnvio + 'T00:00:00') : null;
   ok = !!(dCard && dCard >= pIni && dCard <= pFim);
  }
  card.style.display = ok ? '' : 'none';
 });
 // Ordena as colunas do Kanban internamente (cada coluna já é o agrupamento por etapa).
 // .kc-body não tem id — o id fica no .kanban-col pai (ex: #kc-andamento).
 var byBody = new Map();
 cards.forEach(function(card) {
  var body = card.parentElement;
  if (!byBody.has(body)) byBody.set(body, []);
  byBody.get(body).push(card);
 });
 byBody.forEach(function(colCards, body) {
  colCards.sort(function(a, b) { return _sbCompare(a.dataset, b.dataset, 'obras'); });
  colCards.forEach(function(c) { body.appendChild(c); });
 });
 document.querySelectorAll('#obras-kanban .kanban-col').forEach(function(col) {
  var badge = col.querySelector('.kc-count');
  if (badge) badge.textContent = col.querySelectorAll('.obra-card:not([style*="display: none"]):not([style*="display:none"])').length;
 });

 // ── Badge e contador ──────────────────────────────────────────────────────
 var fbBadge = document.getElementById('fb-badge-obras');
 if (fbBadge) { fbBadge.textContent = activeConds; fbBadge.style.display = activeConds ? '' : 'none'; }
 var countEl = document.getElementById('obras-filter-count');
 if (countEl) {
  if (activeConds || buscaNorm) {
   countEl.textContent = visivel + (visivel === 1 ? ' resultado' : ' resultados');
   countEl.style.display = 'inline';
  } else {
   countEl.style.display = 'none';
  }
 }
}

/* OBRAS VIEW TOGGLE */
/* OBRAS VIEW TOGGLE */
function setObrasView(view) {
 const isKanban = view === 'kanban';
 document.getElementById('obras-kanban').style.display = isKanban ? 'block' : 'none';
 document.getElementById('obras-tabela').style.display = isKanban ? 'none' : 'block';
 document.getElementById('vt-kanban').classList.toggle('active', isKanban);
 document.getElementById('vt-tabela').classList.toggle('active', !isKanban);
 localStorage.setItem('obras-view', view);
}
// Restaurar visualização salva
(function() {
 const saved = localStorage.getItem('obras-view');
 if (saved === 'kanban') setObrasView('kanban');
})();

