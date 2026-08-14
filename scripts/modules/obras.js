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

function _normObraAssoc(o) {
 o.empresa_id = (o.empresas_obras||[])[0]?.empresa_id || null;
 o.empresa    = (o.empresas_obras||[])[0]?.empresa    || null;
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

async function _dbLoadObras() {
 // As duas consultas são independentes (obras vs. documentos) — rodar em
 // paralelo em vez de esperar uma terminar pra começar a outra foi a
 // segunda metade do achado de lentidão (a primeira foi o índice/ilike
 // acima): antes o tempo total era obras+documentos somados, agora é só
 // o maior dos dois.
 // try/catch novo: antes, qualquer erro na busca de obras (rede, timeout,
 // RLS) deixava a Promise rejeitada sem handler nenhum — a tela ficava
 // travada em "Carregando obras..." pra sempre, sem nenhuma pista do que
 // deu errado. Agora aparece um erro real na tela + no console.
 var allObras, propostaMap;
 try {
  var results = await Promise.all([
   _obrasCarregarTodasObras(),
   _obrasCarregarPropostaMap().catch(function(e){ console.error('[Obras] erro ao verificar propostas comerciais:', e); return {}; })
  ]);
  allObras = results[0];
  propostaMap = results[1];
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
   +' data-nome="'+(o.nome||'').replace(/"/g,'&quot;')+'" data-valor="'+(o.valor!=null?o.valor:0)+'" data-data-envio="'+(o.data_envio_proposta||'')+'" data-proposta="'+(proposta?'sim':'nao')+'">'
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

 try {
  const [obraRes, projRes, entregasRes, instRes] = await Promise.all([
   _sb.from('obras').select('*, empresas_obras(empresa_id,empresa:empresa_id(id,nome,cnpj)), contatos_obras(contato_id,contato:contato_id(id,nome_completo))').eq('id', id).single(),
   _sb.from('projetos').select('*').eq('obra_id', id).order('created_at'),
   _sb.from('entregas').select('*').eq('obra_id', id).order('data_faturamento', { ascending: false, nullsFirst: false }),
   _sb.from('instalacoes').select('*').eq('obra_id', id).order('data_inicio')
  ]);

  if (obraRes.error) {
   _spSet('Obra', 'Erro', '<div style="color:var(--red);padding:20px">Obra não encontrada: ' + obraRes.error.message + '</div>', '');
   return;
  }
  if (entregasRes.error) console.error('[MilaTec] Erro ao carregar entregas:', entregasRes.error);
  if (instRes.error) console.error('[MilaTec] Erro ao carregar instalações:', instRes.error);

  const projetos  = projRes.data || [];
  projetos.forEach(function(p){ if (Array.isArray(p.responsavel)) p.responsavel = _emailsToNomes(p.responsavel); });
  const entregas  = entregasRes.data || [];
  const instalacoes = instRes.data || [];

  _obraAtiva = _normObraAssoc(obraRes.data);
  _obraAtiva.projetos = projetos;
  await _spObrasRender(_obraAtiva, projetos, entregas, instalacoes);
 } catch(err) {
  console.error('[MilaTec] Erro ao carregar obra:', err);
  _spSet('Obra', 'Erro interno', '<div style="color:var(--red);padding:20px">Erro inesperado: ' + err.message + '</div>', '');
 }
}

// ── Troca de aba no painel de obra ────────────────────────────────────────────
function _sptSwitch(id, btn) {
 document.querySelectorAll('#sp-body .spt-panel').forEach(function(p){ p.classList.remove('active'); });
 document.querySelectorAll('#sp-body .spt-btn').forEach(function(b){ b.classList.remove('active'); });
 var panel = document.getElementById('spt-' + id);
 if (panel) panel.classList.add('active');
 if (btn) btn.classList.add('active');
 if (id === 'documentos' && _obraAtiva && _obraAtiva.id) _spCarregarDocumentos(_obraAtiva.id);
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

async function _spAbrirDocStorage(path, nomeArquivo) {
 if (!_dbOk) { _showToast('Banco de dados offline', 'erro'); return; }
 if (!path) { _showToast('Caminho do arquivo não encontrado', 'erro'); return; }
 // Mostrar modal com loading
 _spDocPdfModal(null, nomeArquivo || 'Documento');
 try {
  var res = await _sb.storage.from('documentos_obras').createSignedUrl(path, 3600);
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
async function _spObrasRender(o, projetos, entregas, instalacoes) {
 entregas    = entregas    || [];
 instalacoes = instalacoes || [];
 try {
 var tipoArr = o.tipo_obra || [];
 var tipo    = tipoArr[0] || '';
 var etapas  = Object.keys(_etapaKcId);
 var canais  = ['Indicação','Google Ads','Instagram','LinkedIn','Email marketing','Outro'];

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

 function fmtData(d)  { return d ? String(d).substring(0,10) : '—'; }
 function fmtMoeda(v) { return v != null ? 'R$ ' + Number(v).toLocaleString('pt-BR', {minimumFractionDigits:2}) : '—'; }
 function fmtDias(n)  { return n ? n + ' dia' + (n != 1 ? 's' : '') : '—'; }

 // ── Totais dos projetos ──────────────────────────────────────────────────────
 var totalQtd   = projetos.reduce(function(s, p){ return s + (Number(p.quantidade) || 0); }, 0);
 var totalValor = projetos.reduce(function(s, p){ return s + (Number(p.valor_unitario) * Number(p.quantidade || 1) || 0); }, 0);
 var totalPeso  = projetos.reduce(function(s, p){ return s + (Number(p.peso_kg) || 0); }, 0);

 // ── Opções de empresa ────────────────────────────────────────────────────────
 var empOptions = _empresasArr.map(function(e){
  return '<option value="' + e.id + '"' + (e.id === o.empresa_id ? ' selected' : '') + '>' + e.nome + '</option>';
 }).join('');

 // ── Opções de contato ────────────────────────────────────────────────────────
 var contFiltrados = _contatosArr.filter(function(c){ return c.empresa_id === o.empresa_id; });
 var contOptions = contFiltrados.length
  ? contFiltrados.map(function(c){
     return '<option value="' + c.id + '"' + (c.id === o.contato_id ? ' selected' : '') + '>'
      + c.nome_completo + (c.cargo ? ' · ' + c.cargo : '') + '</option>';
    }).join('')
  : '<option value="">Nenhum contato cadastrado para esta empresa</option>';

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
       var pResp  = p.responsavel    || '';
       var pValor = p.valor_unitario != null
        ? (p.quantidade != null ? fmtMoeda(Number(p.valor_unitario) * Number(p.quantidade)) : fmtMoeda(p.valor_unitario))
        : '—';
       var initials = pResp
        ? pResp.trim().split(/\s+/).slice(0,2).map(function(w){ return w[0] || ''; }).join('').toUpperCase()
        : '';
       return '<tr style="border-bottom:1px solid var(--border);cursor:pointer;transition:background .12s"'
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
        + (pTipo ? '<span class="badge bp" style="font-size:10px">' + pTipo + '</span>' : '<span style="color:var(--muted)">—</span>')
        + '</td>'
        + '<td style="padding:8px 10px;white-space:nowrap">'
        + (pProd !== '—' ? '<span class="badge bm" style="font-size:10px">' + pProd + '</span>' : '<span style="color:var(--muted)">—</span>')
        + '</td>'
        + '<td style="padding:8px 8px;text-align:right;font-size:12px;color:var(--green);font-weight:600;white-space:nowrap">' + pValor + '</td>'
        + '<td style="padding:8px 8px;text-align:right;font-size:12px;color:var(--text);white-space:nowrap">' + (p.quantidade != null ? p.quantidade : '—') + '</td>'
        + '<td style="padding:8px 10px">'
        + (pResp
           ? '<div style="display:flex;align-items:center;gap:6px">'
             + '<div style="width:22px;height:22px;border-radius:50%;background:var(--navy-dim);border:1px solid var(--navy);display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:var(--navy);flex-shrink:0">' + initials + '</div>'
             + '<span style="font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:90px">' + pResp + '</span>'
             + '</div>'
           : '<span style="color:var(--muted)">—</span>')
        + '</td>'
        + '</tr>';
      }).join('')
    + '</tbody></table></div>'
  : '<div class="sp-empty">Nenhum projeto vinculado a esta obra</div>';

 // ── Cards de entregas ────────────────────────────────────────────────────────
 var entregaCards = entregas.length
  ? entregas.map(function(e){
     return '<div class="sp-item-card">'
      + '<div class="sp-item-title">' + (e.nome_entrega || '(sem nome)') + '</div>'
      + '<div class="sp-item-meta">'
      + (e.etapa ? '<span>Etapa: <b>' + e.etapa + '</b></span><span style="color:var(--border)">|</span>' : '')
      + '<span>Quantidade: <b>' + (e.quantidade != null ? e.quantidade : '—') + '</b></span>'
      + '<span style="color:var(--border)">|</span>'
      + '<span>Faturamento: <b>' + fmtData(e.data_faturamento) + '</b></span>'
      + (e.transporte ? '<span style="color:var(--border)">|</span><span>Transporte: <b>' + e.transporte + '</b></span>' : '')
      + '</div>'
      + (e.valor ? '<div style="margin-top:6px;font-size:12px;font-weight:600;color:var(--green)">' + fmtMoeda(e.valor) + '</div>' : '')
      + (e.endereco_entrega ? '<div style="margin-top:4px;font-size:11px;color:var(--muted)">' + e.endereco_entrega + '</div>' : '')
      + '</div>';
    }).join('')
  : '<div class="sp-empty">Nenhuma entrega registrada para esta obra</div>';

 // ── Cards de instalacoes ─────────────────────────────────────────────────────
 var instCards = instalacoes.length
  ? instalacoes.map(function(i){
     return '<div class="sp-item-card">'
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

 // ── Badge de contagem ────────────────────────────────────────────────────────
 function badge(n) {
  return '<span class="spt-badge' + (n > 0 ? ' has-data' : '') + '">' + n + '</span>';
 }

 // ── Opções de etapa ──────────────────────────────────────────────────────────
 var etapaOpts = etapas.map(function(e){
  return '<option' + (o.etapa_negocio === e ? ' selected' : '') + '>' + e + '</option>';
 }).join('');

 var canalOpts = '<option value="">—</option>'
  + canais.map(function(c){ return '<option' + (o.canal_vendas === c ? ' selected' : '') + '>' + c + '</option>'; }).join('');

 // ── HTML completo com abas ───────────────────────────────────────────────────
 var html = '<input type="hidden" id="sp-obra-id" value="' + o.id + '">'

  // Barra de abas
  + '<div class="spt-bar">'
  + '<button class="spt-btn active" onclick="_sptSwitch(\'geral\',this)">Visão Geral</button>'
  + '<button class="spt-btn" onclick="_sptSwitch(\'orcamentos\',this)">Projetos' + badge(projetos.length) + '</button>'
  + '<button class="spt-btn" onclick="_sptSwitch(\'entregas\',this)">Entregas' + badge(entregas.length) + '</button>'
  + '<button class="spt-btn" onclick="_sptSwitch(\'instalacao\',this)">Instalação' + badge(instalacoes.length) + '</button>'
  + '<button class="spt-btn" onclick="_sptSwitch(\'documentos\',this)">Documentos</button>'
  + '</div>'

  // ── ABA: Visão Geral ─────────────────────────────────────────────────────────
  + '<div class="spt-panel active" id="spt-geral">'

  + '<div class="sp-stitle" style="margin-top:0">Identificação</div>'
  + '<div class="sp-field"><div class="sp-label">Nome da obra</div>'
  + '<input class="sp-inp" id="sp-nome" value="' + (o.nome||'').replace(/"/g,'&quot;') + '" placeholder="Nome da obra..."></div>'

  + '<div class="sp-g2">'
  + '<div class="sp-field"><div class="sp-label">Tipo</div><select class="sp-inp" id="sp-tipo">'
  + '<option' + (tipo==='Telhados'?' selected':'') + '>Telhados</option>'
  + '<option' + (tipo==='Steel Frame'?' selected':'') + '>Steel Frame</option>'
  + '<option' + (tipo==='Modular'?' selected':'') + '>Modular</option>'
  + '<option' + (tipo==='Solar'?' selected':'') + '>Solar</option>'
  + '</select></div>'
  + '<div class="sp-field"><div class="sp-label">Etapa do Negócio</div>'
  + '<select class="sp-inp" id="sp-etapa" onchange="_spOnEtapaChange(this.value)">' + etapaOpts + '</select></div>'
  + '</div>'

  + '<div class="sp-g2">'
  + '<div class="sp-field"><div class="sp-label">Data do orçamento</div>'
  + '<input class="sp-inp" value="' + (fmtData(o.data_criacao) !== '—' ? fmtData(o.data_criacao) : fmtData(o.created_at)) + '" readonly style="color:var(--muted);cursor:default" title="Preenchido automaticamente pelo sistema"></div>'
  + '<div class="sp-field"><div class="sp-label">Data envio da proposta</div>'
  + '<input class="sp-inp" id="sp-data-proposta" type="date" value="' + (o.data_envio_proposta ? String(o.data_envio_proposta).substring(0,10) : '') + '"></div>'
  + '</div>'

  // Proposta Comercial não é um campo de texto (é um documento anexado, ver
  // aba Documentos/_spCarregarDocumentos) — aqui é só um resumo de status +
  // atalho, populado depois via _spCarregarPropostaStatus (a busca real fica
  // fora do render síncrono do painel, mesmo esquema do "Verificando..."
  // de #sp-propostas-lista acima).
  + '<div class="sp-field"><div class="sp-label">Proposta Comercial</div>'
  + '<div id="sp-proposta-status" style="display:flex;align-items:center;gap:10px;padding:8px 0;font-size:13px;color:var(--muted)">Verificando...</div></div>'

  + '<div class="sp-g3">'
  + '<div class="sp-field"><div class="sp-label">Cidade</div><input class="sp-inp" id="sp-cidade" value="' + (o.cidade||'') + '"></div>'
  + '<div class="sp-field"><div class="sp-label">UF</div><input class="sp-inp" id="sp-uf" value="' + (o.estado||'') + '" maxlength="2" style="text-transform:uppercase"></div>'
  + '<div class="sp-field"><div class="sp-label">Canal de vendas</div><select class="sp-inp" id="sp-canal">' + canalOpts + '</select></div>'
  + '</div>'
  + '<div class="sp-g2">'
  + '<div class="sp-field"><div class="sp-label">CNO (Cadastro Nacional de Obras)</div><input class="sp-inp" id="sp-cno" value="' + (o.cno||'') + '" placeholder="00.000.000.000-0"></div>'
  + '<div class="sp-field"><div class="sp-label">Endereço de Entrega</div><input class="sp-inp" id="sp-end-entrega" value="' + (o.endereco_entrega||'') + '" placeholder="Rua, nº, cidade..."></div>'
  + '</div>'

  + '<div class="sp-g2">'
  + '<div class="sp-field"><div class="sp-label">Quantidade</div><input class="sp-inp" id="sp-obra-quantidade" type="number" min="0" placeholder="—" value="' + (o.quantidade != null ? o.quantidade : '') + '"></div>'
  + '<div class="sp-field"><div class="sp-label">Valor da obra</div><input class="sp-inp" id="sp-obra-valor" type="text" placeholder="R$ 0,00" value="' + (o.valor != null ? Number(o.valor).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : '') + '" onfocus="_spValorFocus(this)" onblur="_spValorBlur(this)"></div>'
  + '</div>'

  + '<div class="sp-stitle">Empresa & Contato</div>'
  + '<div class="sp-field"><div class="sp-label">Empresa</div>'
  + '<div style="display:flex;gap:6px;align-items:center">'
  + '<select class="sp-inp" id="sp-empresa-id" onchange="_spOnEmpresaChange()" style="flex:1">'
  + '<option value="">Selecione a empresa...</option>' + empOptions
  + '</select>'
  + '<button class="btn btn-ghost btn-sm" onclick="_spToggleNovaEmpresa()" title="Criar nova empresa">+</button>'
  + '</div></div>'
  + '<div id="sp-nova-empresa-form" style="display:none;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:10px">'
  + '<div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;margin-bottom:10px">Nova Empresa</div>'
  + '<div class="sp-g2" style="gap:8px">'
  + '<div class="sp-field"><div class="sp-label">Nome *</div><input class="sp-inp" id="sp-new-emp-nome" placeholder="Razão social"></div>'
  + '<div class="sp-field"><div class="sp-label">CNPJ</div><input class="sp-inp" id="sp-new-emp-cnpj" value="' + _empCnpjMaskValue('') + '" oninput="_empCnpjMask(this)"></div>'
  + '</div><div class="sp-g2" style="gap:8px;margin-top:8px">'
  + '<div class="sp-field"><div class="sp-label">Estado</div><select class="sp-inp" id="sp-new-emp-uf">' + _spEmpOptSelect(EMPRESA_ESTADO_OPCOES, '') + '</select></div>'
  + '<div class="sp-field"><div class="sp-label">Fase do Ciclo de Vida</div><select class="sp-inp" id="sp-new-emp-fase">' + _spEmpOptSelect(EMPRESA_FASE_OPCOES, '') + '</select></div>'
  + '</div><div class="sp-g2" style="gap:8px;margin-top:8px">'
  + '<div class="sp-field"><div class="sp-label">Site</div><input class="sp-inp" id="sp-new-emp-site" placeholder="https://"></div>'
  + '<div></div>'
  + '</div><div style="display:flex;gap:6px;margin-top:10px">'
  + '<button class="btn btn-primary btn-sm" onclick="_spCriarEmpresaObra()" style="flex:1;justify-content:center">Criar empresa</button>'
  + '<button class="btn btn-ghost btn-sm" onclick="_spToggleNovaEmpresa()">Cancelar</button>'
  + '</div></div>'

  + '<div class="sp-field"><div class="sp-label">Contato do orçamento</div>'
  + '<div style="display:flex;gap:6px;align-items:center">'
  + '<select class="sp-inp" id="sp-contato-id" style="flex:1">'
  + (contFiltrados.length ? contOptions : '<option value="">Selecione a empresa primeiro</option>')
  + '</select>'
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

  // ── Registros vinculados (Obra→Empresa e Obra→Projeto) ────────────────────
  // Empresa(s): vem direto de o.empresas_obras (já trazido junto pela query
  // de _spObraById, ver linha ~626 — junction empresas_obras, mesma relação
  // já usada pelo select acima; normalmente 1 empresa por obra, mas o schema
  // permite mais de uma — mostra todas). Projetos: reverse FK
  // (projetos.obra_id), já recebido como parâmetro `projetos` desta função —
  // nenhuma query nova necessária. Ambos usam o chip clicável padrão
  // (_spRelChipHTML, ver side-panel.js) pros mesmos já usados no painel de
  // Empresa (Obras/Contatos vinculados).
  + '<div class="sp-stitle">Empresa(s) vinculada(s)</div>'
  + '<div class="sp-rel-chips-wrap" style="margin-bottom:16px">'
  + ((o.empresas_obras || []).length
     ? (o.empresas_obras || []).filter(function(link){ return link.empresa; }).map(function(link){
        return _spRelChipHTML('empresas', link.empresa.id, link.empresa.nome || '—');
       }).join('')
     : '<div class="sp-empty">Nenhuma empresa vinculada a esta obra.</div>')
  + '</div>'

  + '<div class="sp-stitle">Projetos vinculados</div>'
  + '<div class="sp-rel-chips-wrap" style="margin-bottom:16px">'
  + (projetos.length
     ? projetos.map(function(p){
        return _spRelChipHTML('projetos', p.id, p.nome || '(sem nome)');
       }).join('')
     : '<div class="sp-empty">Nenhum projeto vinculado a esta obra.</div>')
  + '</div>'

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

  + (tipo === 'Modular'
   ? '<div class="sp-stitle">Orçamento Modular</div><div id="mc-container"></div>'
   : '')

  + '</div>' // fim spt-panel geral

  // ── ABA: Projetos/Orçamentos ─────────────────────────────────────────────────
  + '<div class="spt-panel" id="spt-orcamentos">'
  + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border)">'
  + '<div style="font-size:12px;font-weight:700;color:var(--text)">'
  + projetos.length + ' projeto' + (projetos.length !== 1 ? 's' : '') + ' vinculado' + (projetos.length !== 1 ? 's' : '')
  + '</div>'
  + (projetos.length > 0
   ? '<div style="display:flex;gap:14px;font-size:11px;color:var(--muted)">'
     + '<span>Qtd <b style="color:var(--text)">' + totalQtd.toLocaleString('pt-BR') + '</b></span>'
     + '<span>Peso <b style="color:var(--text)">' + (totalPeso > 0 ? totalPeso.toLocaleString('pt-BR') + ' kg' : '—') + '</b></span>'
     + '<span>Valor <b style="color:var(--green)">' + (totalValor > 0 ? fmtMoeda(totalValor) : '—') + '</b></span>'
     + '</div>'
   : '')
  + '</div>'
  + projCards
  + '</div>'

  // ── ABA: Entregas ────────────────────────────────────────────────────────────
  + '<div class="spt-panel" id="spt-entregas">'
  + '<div class="sp-stitle" style="margin-top:0">Entregas (' + entregas.length + ')</div>'
  + entregaCards
  + '</div>'

  // ── ABA: Instalação ──────────────────────────────────────────────────────────
  + '<div class="spt-panel" id="spt-instalacao">'
  + '<div class="sp-stitle" style="margin-top:0">Instalações (' + instalacoes.length + ')</div>'
  + instCards
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
  + '<div id="sp-propostas-lista"><div class="sp-empty"><div style="font-size:11px;color:var(--muted)">Clique na aba para carregar...</div></div></div>'
  + '</div>'; // fim spt-panel documentos

 _spSet('Obra', (o.nome||'').split('—')[0]?.trim() || o.nome || 'Obra',
  html,
  '<button class="btn btn-primary" onclick="_spSaveObraFull()">Salvar</button>'
  + ' <button class="btn btn-ghost" onclick="closePanel()">Fechar</button>'
 );

 _spCarregarPropostaStatus(o.id);

 if (tipo === 'Modular') {
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

// ── Salvar obra completa ──────────────────────────────────────────────────────
async function _spSaveObraFull() {
 if (!_obraAtiva) return;
 const id = document.getElementById('sp-obra-id')?.value;
 const novaEmpresaId = document.getElementById('sp-empresa-id')?.value || null;
 const novoContatoId = document.getElementById('sp-contato-id')?.value || null;
 const payload = {
  nome:              document.getElementById('sp-nome')?.value || '',
  tipo_obra:         [document.getElementById('sp-tipo')?.value || ''],
  etapa_negocio:     document.getElementById('sp-etapa')?.value || '',
  data_envio_proposta: document.getElementById('sp-data-proposta')?.value || null,
  cidade:            document.getElementById('sp-cidade')?.value || '',
  estado:            document.getElementById('sp-uf')?.value?.toUpperCase() || '',
  canal_vendas:      document.getElementById('sp-canal')?.value || null,
  quantidade:        document.getElementById('sp-obra-quantidade')?.value !== '' ? Number(document.getElementById('sp-obra-quantidade')?.value) : null,
  valor:             (function(){ var v=(document.getElementById('sp-obra-valor')?.value||'').trim(); if(!v)return null; var n=parseFloat(v.replace(/\./g,'').replace(',','.')); return isNaN(n)?null:n; })(),
  cno:               document.getElementById('sp-cno')?.value?.trim() || null,
  endereco_entrega:  document.getElementById('sp-end-entrega')?.value?.trim() || null,
  updated_at:        new Date().toISOString(),
 };
 var { error } = await _sb.from('obras').update(payload).eq('id', id);
 var vincErro = null;
 if (!error) {
  // Grava empresa na tabela associativa (substitui a existente)
  if (novaEmpresaId) {
   var delEmp = await _sb.from('empresas_obras').delete().eq('obra_id', id);
   if (delEmp.error) vincErro = delEmp.error;
   if (!vincErro) {
    var insEmp = await _sb.from('empresas_obras').insert({ obra_id: id, empresa_id: novaEmpresaId });
    if (insEmp.error) vincErro = insEmp.error;
   }
  }
  // Garante que o contato selecionado está vinculado (sem remover outros)
  if (novoContatoId && !vincErro) {
   var upsCtt = await _sb.from('contatos_obras').upsert({ obra_id: id, contato_id: novoContatoId }, { onConflict: 'obra_id,contato_id', ignoreDuplicates: true });
   if (upsCtt.error) vincErro = upsCtt.error;
  }
 }
 const btn = document.querySelector('#sp-actions .btn-primary');
 if (btn) {
  btn.textContent = error ? 'Erro!' : 'Salvo!';
  btn.style.background = error ? 'var(--red)' : 'var(--green)';
  setTimeout(() => { btn.textContent = 'Salvar'; btn.style.background = ''; }, 1800);
 }
 if (error) {
  _showToast('Erro ao salvar obra: ' + _supaErrPt(error.message), 'erro');
 } else if (vincErro) {
  _showToast('Obra salva, mas houve erro ao vincular empresa/contato: ' + _supaErrPt(vincErro.message), 'erro');
 }
 if (!error) {
  _obraAtiva = { ..._obraAtiva, ...payload, empresa_id: novaEmpresaId, contato_id: novoContatoId };
  _dbLoadObras();
  _dbLoadObrasKanban();
 }
}

// ── Empresa: mudar seleção → atualiza contatos ────────────────────────────────
function _spOnEmpresaChange() {
 const empId = document.getElementById('sp-empresa-id')?.value;
 const sel = document.getElementById('sp-contato-id');
 if (!sel) return;
 const filtrados = _contatosArr.filter(c => c.empresa_id === empId);
 sel.innerHTML = filtrados.length
  ? '<option value="">Selecione o contato...</option>' + filtrados.map(c => `<option value="${c.id}">${c.nome_completo}${c.cargo ? ' · ' + c.cargo : ''}</option>`).join('')
  : '<option value="">Nenhum contato para esta empresa</option>';
}

// ── Quick-create Empresa ──────────────────────────────────────────────────────
function _spToggleNovaEmpresa() {
 const f = document.getElementById('sp-nova-empresa-form');
 if (f) f.style.display = f.style.display === 'none' ? 'block' : 'none';
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
  estado: document.getElementById('sp-new-emp-uf')?.value || null,
  fase_ciclo_vida: document.getElementById('sp-new-emp-fase')?.value || null,
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
 const sel = document.getElementById('sp-empresa-id');
 if (sel) {
  const opt = document.createElement('option');
  opt.value = data.id; opt.textContent = data.nome; opt.selected = true;
  sel.appendChild(opt);
  _spOnEmpresaChange();
 }
 _spToggleNovaEmpresa();
 _dbLoadEmpresas(); // atualiza tabela de empresas em segundo plano
}

// ── Quick-create Contato ──────────────────────────────────────────────────────
function _spToggleNovoContato() {
 const f = document.getElementById('sp-novo-contato-form');
 if (!f) return;
 var abrir = f.style.display === 'none';
 // Pedido explícito: um contato criado por aqui sempre se associa à
 // empresa da obra (ver payload.empresa_id + junção contatos_empresas
 // abaixo) — sem empresa selecionada não tem a quem associar, então nem
 // deixa abrir o formulário (em vez de deixar criar "solto" e confundir).
 if (abrir && !document.getElementById('sp-empresa-id')?.value) {
  alert('Selecione (ou crie) a empresa da obra antes de adicionar um contato.');
  return;
 }
 f.style.display = abrir ? 'block' : 'none';
}
async function _spCriarContato() {
 const nome = document.getElementById('sp-new-cont-nome')?.value?.trim();
 const empId = document.getElementById('sp-empresa-id')?.value;
 if (!nome) { alert('Nome do contato é obrigatório.'); return; }
 if (!empId) { alert('Selecione (ou crie) a empresa da obra antes de adicionar um contato.'); return; }
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
 _contatosArr.push(data);
 const sel = document.getElementById('sp-contato-id');
 if (sel) {
  const opt = document.createElement('option');
  opt.value = data.id; opt.textContent = data.nome_completo + (data.cargo ? ' · ' + data.cargo : ''); opt.selected = true;
  sel.appendChild(opt);
 }
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

