// ═══════════════════════════════════════════════════════════════════════════════
// PROJETOS — modal "Novo Projeto" (mock, não persiste — criação real de projeto
// acontece no wizard Nova Obra), kanban por etapa, renderer do painel lateral,
// filtro de tipo, cache/loader de projetos.
// ═══════════════════════════════════════════════════════════════════════════════
function openNovoProjeto() {
 // Resetar campos
 ['np-obra','np-tipo','np-produto','np-etapa'].forEach(id => {
 const el = document.getElementById(id); if(el) el.selectedIndex = 0;
 });
 ['np-qtd','np-val-uni','np-peso-uni','np-m2arq','np-m2estr','np-desc'].forEach(id => {
 const el = document.getElementById(id); if(el) el.value = '';
 });
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

function submitNovoProjeto() {
 const obra = document.getElementById('np-obra').value;
 const tipo = document.getElementById('np-tipo').value;
 if (!obra) { document.getElementById('np-obra').style.borderColor = 'var(--red)'; return; }
 if (!tipo) { document.getElementById('np-tipo').style.borderColor = 'var(--red)'; return; }

 // Adicionar linha na tabela (mock)
 const tbody = document.getElementById('revit-proj-tbody');
 const qtd   = document.getElementById('np-qtd').value   || '0';
 const vUnit  = document.getElementById('np-val-uni').value || '0';
 const vTotal = parseFloat(qtd) * parseFloat(vUnit);
 const pUnit = parseFloat(document.getElementById('np-peso-uni').value) || 0;
 const pTotal = parseFloat(qtd) * pUnit;
 const etapa = document.getElementById('np-etapa').value;
 const comp = document.getElementById('np-complexidade').value;
 const prod = document.getElementById('np-produto').value || '—';
 const n = tbody.querySelectorAll('tr').length + 1;

 const tipoCor = {
 'Telhados': 'var(--green-dim);color:var(--green)',
 'Steel Frame': 'rgba(137,87,229,.15);color:var(--purple)',
 'Modular': 'var(--blue-dim);color:var(--blue)',
 'Misto (LSF + A36)':'var(--yellow-dim);color:var(--yellow)',
 'Solar': 'var(--yellow-dim);color:var(--yellow)',
 }[tipo] || 'var(--surface2);color:var(--muted)';

 const compCor = { 'Alta': 'var(--red)', 'Média': 'var(--yellow)', 'Baixa': 'var(--green)' }[comp] || 'var(--muted)';

 const tr = document.createElement('tr');
 tr.setAttribute('data-tipo', tipo);
 tr.innerHTML = `
 <td style="font-weight:600;color:var(--navy)">PRJ-00${n}</td>
 <td>${obra}</td>
 <td><span class="badge" style="background:${tipoCor}">${tipo}</span></td>
 <td>${prod}</td>
 <td style="text-align:right">${parseInt(qtd)}</td>
 <td style="text-align:right">${parseFloat(vUnit).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
 <td style="text-align:right;font-weight:600;color:var(--green)">${vTotal.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
 <td style="text-align:right">${pUnit.toLocaleString('pt-BR',{minimumFractionDigits:1})}</td>
 <td style="text-align:right">${pTotal.toLocaleString('pt-BR',{minimumFractionDigits:1})}</td>
 <td><span class="badge by">${etapa}</span></td>
 <td><span class="badge" style="background:${compCor === 'var(--red)' ? 'var(--red-dim)' : compCor === 'var(--yellow)' ? 'var(--yellow-dim)' : 'var(--green-dim)'};color:${compCor}">${comp}</span></td>`;
 tbody.appendChild(tr);
 closeNovoProjeto();
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

 var res = await _sb.from('projetos')
  .select('id, nome, etapa_projeto, tipo_orcamento, produto, complexidade, responsavel, valor_unitario, quantidade, peso_kg, obra_id, obra:obra_id(nome, empresas_obras(empresa:empresa_id(nome)))')
  .order('created_at', { ascending: false });

 if (res.error || !res.data) {
  container.innerHTML = '<div style="color:var(--red);padding:20px;font-size:13px">Erro ao carregar projetos: ' + (res.error ? res.error.message : 'sem dados') + '</div>';
  return;
 }

 var data     = res.data;
 data.forEach(function(p){ if (Array.isArray(p.responsavel)) p.responsavel = _emailsToNomes(p.responsavel); });
 var tipoCls  = {'Telhados':'bg','Steel Frame':'bp','Modular':'bb','Solar':'by'};
 var complCls = {'Simples':'bg','Média':'by','Média - simples':'by','Complexa':'br','Alta':'br'};
 var etapaCls = {
  'Orçamento':'bm','Análise Inicial':'bm','Aguardando Aprovação':'by',
  'Pré-projeto':'bm','Revisão Pré-Projeto':'by',
  'Projeto para Aprovação':'bb','Revisão Projeto':'by',
  'Projeto Executivo':'bb','Revisão Projeto Executivo':'by',
  'Ajustes de Piloto':'by','Projeto em Andamento':'by',
  'Aguardando Produção':'by','Projeto Finalizado':'bg',
  'Pós-vendas':'bg','Negócio perdido':'br'
 };

 // Agrupa por etapa — trim para ignorar espaços extras vindos do Airtable
 var groups = {};
 data.forEach(function(p) {
  var e = (p.etapa_projeto || 'Sem etapa').trim();
  if (!groups[e]) groups[e] = [];
  groups[e].push(p);
 });

 // Ordena colunas: etapas com dados na ordem definida, depois qualquer outra
 var ordered = _projetosKanbanEtapaOrder.filter(function(e){ return groups[e] && groups[e].length; });
 Object.keys(groups).forEach(function(e){ if (!ordered.includes(e)) ordered.push(e); });

 if (ordered.length === 0) {
  container.innerHTML = '<div class="sp-empty" style="width:100%">Nenhum projeto encontrado no banco.</div>';
  return;
 }

 container.innerHTML = ordered.map(function(etapa) {
  var cards  = groups[etapa];
  var cls    = etapaCls[etapa] || 'bm';
  var cardsHtml = cards.map(function(p) {
   var tipo     = p.tipo_orcamento || '';
   var tipCls   = tipoCls[tipo]   || 'bm';
   var compl    = p.complexidade  || '';
   var cmpCls   = complCls[compl] || 'bm';
   var obraNome = (p.obra && p.obra.nome)   ? p.obra.nome   : '—';
   var empNome  = (p.obra && p.obra.empresas_obras && p.obra.empresas_obras[0]?.empresa?.nome) ? p.obra.empresas_obras[0].empresa.nome : '';
   var valor    = (p.valor_unitario != null)
    ? 'R$ ' + (Number(p.valor_unitario) * Number(p.quantidade || 1)).toLocaleString('pt-BR', {minimumFractionDigits:2,maximumFractionDigits:2})
    : null;
   var obraId   = p.obra_id || '';
   return '<div class="proj-kn-card" onclick="if(obraId){_spObraById(\'' + obraId + '\')}" title="Abrir obra vinculada">'
    + '<div class="proj-kn-title">' + (p.nome || '(sem nome)') + '</div>'
    + '<div class="proj-kn-obra" title="' + obraNome + '">'
    + (empNome ? empNome + ' — ' : '') + obraNome
    + '</div>'
    + '<div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:6px">'
    + (tipo  ? '<span class="badge ' + tipCls + '" style="font-size:9px">' + tipo  + '</span>' : '')
    + (compl ? '<span class="badge ' + cmpCls + '" style="font-size:9px">' + compl + '</span>' : '')
    + '</div>'
    + '<div class="proj-kn-footer">'
    + '<span style="font-size:11px;font-weight:700;color:var(--green)">' + (valor || '—') + '</span>'
    + (p.responsavel
       ? '<span style="font-size:10px;color:var(--muted)">' + p.responsavel.split(' ')[0] + '</span>'
       : '')
    + '</div>'
    + '</div>';
  }).join('');
  return '<div class="proj-kn-col">'
   + '<div class="proj-kn-head">'
   + '<span class="badge ' + cls + '" style="font-size:10px">' + etapa + '</span>'
   + '<span class="proj-kn-count">' + cards.length + '</span>'
   + '</div>'
   + '<div class="proj-kn-body">' + cardsHtml + '</div>'
   + '</div>';
 }).join('');
}

function _spProjetos(row, tds) {
 const cod   = tds[0]?.innerText?.trim() || '';
 const obra  = tds[1]?.innerText?.trim() || '';
 const tipo  = tds[2]?.innerText?.trim() || '';
 const prod  = tds[3]?.innerText?.trim() || '';
 const qtd   = tds[4]?.innerText?.trim() || '';
 const vuni  = tds[5]?.innerText?.trim() || '';
 const vtot  = tds[6]?.innerText?.trim() || '';
 const etapa = tds[9]?.innerText?.trim() || '';
 const compl = tds[10]?.innerText?.trim() || '';

 let html = `
  <div class="sp-g2">
   <div class="sp-field"><div class="sp-label">Código</div><input class="sp-inp" value="${cod}" readonly></div>
   <div class="sp-field"><div class="sp-label">Tipo</div><input class="sp-inp" value="${tipo}" readonly></div>
  </div>
  <div class="sp-field"><div class="sp-label">Obra vinculada</div><input class="sp-inp" value="${obra}"></div>
  <div class="sp-g2">
   <div class="sp-field"><div class="sp-label">Produto</div><input class="sp-inp" value="${prod}"></div>
   <div class="sp-field"><div class="sp-label">Etapa</div><input class="sp-inp" value="${etapa}"></div>
  </div>
  <div class="sp-g3">
   <div class="sp-field"><div class="sp-label">Qtd.</div><input class="sp-inp" value="${qtd}"></div>
   <div class="sp-field"><div class="sp-label">Valor unit.</div><input class="sp-inp" value="${vuni}"></div>
   <div class="sp-field"><div class="sp-label">Valor total</div><input class="sp-inp" value="${vtot}" readonly></div>
  </div>
  <div class="sp-field"><div class="sp-label">Complexidade</div><input class="sp-inp" value="${compl}"></div>
 `;

 _spSet('Projeto', cod + ' — ' + obra, html,
  '<button class="btn btn-ghost" onclick="closePanel()">Fechar</button>');
}

function filterProjetos(chipEl, tipo) {
 document.querySelectorAll('.filter-bar .chip').forEach(c => c.classList.remove('active'));
 chipEl.classList.add('active');
 document.querySelectorAll('#proj-tbody tr').forEach(tr => {
 tr.style.display = (!tipo || tr.dataset.tipo === tipo) ? '' : 'none';
 });
}

var _projetosArr    = [];
var _obraIdMap      = {}; // id → {nome, empresa} preenchido por _dbLoadObras

async function _dbLoadProjetos() {
 var tbody=document.getElementById('proj-tbody');
 if(tbody) tbody.innerHTML='<tr><td colspan="11" style="text-align:center;padding:32px;color:var(--muted);font-size:13px">Carregando projetos...</td></tr>';
 var allData=[]; var from=0; var more=true;
 while(more){
  var res=await _sb.from('projetos').select('*').order('created_at',{ascending:false}).range(from,from+999);
  if(res.error){
   if(tbody)tbody.innerHTML='<tr><td colspan="11" style="text-align:center;padding:32px;color:var(--red);font-size:13px">Erro ao carregar projetos: '+res.error.message+'</td></tr>';
   return;
  }
  if(res.data&&res.data.length)allData=allData.concat(res.data);
  more=res.data&&res.data.length===1000; from+=1000;
 }
 if(!allData.length){
  if(tbody)tbody.innerHTML='<tr><td colspan="11" style="text-align:center;padding:32px;color:var(--muted);font-size:13px">Nenhum projeto encontrado.</td></tr>';
  return;
 }
 allData.forEach(function(p){ if (Array.isArray(p.responsavel)) p.responsavel = _emailsToNomes(p.responsavel); });
 _projetosArr=allData;
 if(!tbody)return;
 function _pad3(n){var s=String(n);while(s.length<3)s='0'+s;return s;}
 var _tCls={'Telhados':'bg','Steel Frame':'bp','Modular':'bb','Solar':'by'};
 var _eCls={
  'Orçamento':'bm','Análise Inicial':'bm','Aguardando Aprovação':'by',
  'Pré-projeto':'bm','Revisão Pré-Projeto':'by',
  'Projeto para Aprovação':'bb','Revisão Projeto':'by',
  'Projeto Executivo':'bb','Revisão Projeto Executivo':'by',
  'Ajustes de Piloto':'by','Projeto em Andamento':'by',
  'Aguardando Produção':'by','Projeto Finalizado':'bg',
  'Pós-vendas':'bg','Negócio perdido':'br'
 };
 function _fmtBRL(v){return v!=null?'R$ '+Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2}):'—';}
 function _fmtN(v,d){return v!=null?Number(v).toLocaleString('pt-BR',{minimumFractionDigits:d||0}):'—';}
 var _emAnd=['Pré-projeto','Revisão Pré-Projeto','Projeto para Aprovação','Revisão Projeto','Projeto Executivo','Revisão Projeto Executivo','Ajustes de Piloto','Projeto em Andamento','Aguardando Produção'];
 var totV=0,totP=0,cAnd=0;
 tbody.innerHTML=allData.map(function(p,idx){
  var cod='PRJ-'+_pad3(idx+1);
  var tipo=p.tipo_orcamento||'';
  var etapa=(p.etapa_projeto||'').trim();
  var prod=Array.isArray(p.produto)?(p.produto[0]||'—'):(p.produto||'—');
  var qtd=p.quantidade!=null?Number(p.quantidade):null;
  var vU=p.valor_unitario!=null?Number(p.valor_unitario):null;
  var vT=(vU!=null&&qtd!=null)?vU*qtd:vU;
  var pU=p.peso_kg!=null?Number(p.peso_kg):null;
  var pT=(pU!=null&&qtd!=null)?pU*qtd:pU;
  var obraInfo=p.obra_id?(_obraIdMap[p.obra_id]||{}):{};
  var obraNome=obraInfo.nome||'—';
  var empNome=obraInfo.empresa||'';
  var cliente=empNome||obraNome;
  if(vT)totV+=vT;if(pT)totP+=pT;if(_emAnd.indexOf(etapa)!==-1)cAnd++;
  return '<tr onclick="if(!event.target.closest(\'button,a,input,select\'))_spOpen(\'projetos\',this)" data-tipo="'+tipo+'" data-id="'+(p.id||'')+'">'
   +'<td style="font-weight:600;color:var(--navy)">'+cod+'</td>'
   +'<td style="font-size:12px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+obraNome+'">'+cliente+'</td>'
   +'<td>'+(tipo?'<span class="badge '+(_tCls[tipo]||'bm')+'">'+tipo+'</span>':'—')+'</td>'
   +'<td style="font-size:12px">'+prod+'</td>'
   +'<td style="text-align:right">'+(qtd!=null?qtd:'—')+'</td>'
   +'<td style="text-align:right">'+_fmtBRL(vU)+'</td>'
   +'<td style="text-align:right;font-weight:600;color:var(--green)">'+_fmtBRL(vT)+'</td>'
   +'<td style="text-align:right">'+_fmtN(pU,1)+'</td>'
   +'<td style="text-align:right">'+_fmtN(pT,1)+'</td>'
   +'<td>'+(etapa?'<span class="badge '+(_eCls[etapa]||'bm')+'">'+etapa+'</span>':'—')+'</td>'
   +'<td>'+(p.complexidade||'—')+'</td></tr>';
 }).join('');
 var nb=document.getElementById('nav-badge-projetos');if(nb)nb.textContent=allData.length;
 var kT=document.getElementById('proj-kpi-total');if(kT)kT.textContent=allData.length;
 var kA=document.getElementById('proj-kpi-andamento');if(kA)kA.textContent=cAnd;
 var kV=document.getElementById('proj-kpi-valor');if(kV)kV.textContent='R$ '+Math.round(totV).toLocaleString('pt-BR');
 var kP=document.getElementById('proj-kpi-peso');if(kP)kP.textContent=Math.round(totP).toLocaleString('pt-BR');
 var hint=document.getElementById('proj-count-hint');if(hint)hint.textContent=allData.length+' projetos · clique em uma linha para editar';
}
