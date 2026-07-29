// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD EXECUTIVO DE GERENCIAMENTO
// Fonte de faturamento: tabela `entregas` (campo valor / data_faturamento)
//  - Realizado = etapa = 'Entrega realizada'
//  - Previsto  = etapa <> 'Entrega realizada'
// Segmentação (linha de negócio) vem de obras.tipo_obra (campo "Categoria da
// Obra" no Airtable, sincronizado diretamente para o Supabase). Obras sem
// tipo_obra preenchido e entregas sem obra_id são marcadas "Não classificado".
// ═══════════════════════════════════════════════════════════════════════════════
var _execDash = { obras:[], projetos:[], entregas:[], instalacoes:[], empresas:[], obraSeg:{}, obraMap:{}, empresaMap:{}, loaded:false };

async function _execDashLoad() {
 if (_execDash.loaded) { _execDashRender(); return; }
 var sub = document.getElementById('exec-dash-sub');
 if (sub) sub.textContent = 'Carregando dados...';
 async function fetchAll(table, cols) {
  var all=[], from=0, more=true;
  while (more) {
   var res = await _sb.from(table).select(cols).range(from, from+999);
   if (res.error) { console.error('_execDashLoad', table, res.error); break; }
   if (res.data && res.data.length) all = all.concat(res.data);
   more = res.data && res.data.length === 1000; from += 1000;
  }
  return all;
 }
 var results = await Promise.all([
  fetchAll('obras', 'id,nome,empresas_obras(empresa_id),valor,tipo_obra,etapa_negocio,etapa_projeto,motivo_perdido,data_criacao,data_envio_proposta,data_fechamento,cidade,estado'),
  fetchAll('projetos', 'id,obra_id,tipo_orcamento,valor_unitario,quantidade'),
  fetchAll('entregas', 'id,obra_id,nome_entrega,etapa,valor,data_faturamento'),
  fetchAll('instalacoes', 'id,obra_id,funil,data_inicio,data_fim'),
  fetchAll('empresas', 'id,nome')
 ]);
 _execDash.obras = results[0].map(function(o){ o.empresa_id=(o.empresas_obras||[])[0]?.empresa_id||null; return o; });
 _execDash.projetos = results[1]; _execDash.entregas = results[2];
 _execDash.instalacoes = results[3]; _execDash.empresas = results[4];

 // Mapa obra -> segmento (via obras.tipo_obra, sincronizado do Airtable
 // "Categoria da Obra"). Quando uma obra tem mais de uma categoria, usa a
 // primeira. Obras sem categoria preenchida ficam "Não classificado".
 var obraSeg = {};
 _execDash.obras.forEach(function(o){
  var tipos = o.tipo_obra;
  obraSeg[o.id] = (Array.isArray(tipos) && tipos.length) ? tipos[0] : 'Não classificado';
 });
 _execDash.obraSeg = obraSeg;

 var empresaMap = {}; _execDash.empresas.forEach(function(e){ empresaMap[e.id] = e.nome; });
 _execDash.empresaMap = empresaMap;
 var obraMap = {}; _execDash.obras.forEach(function(o){ obraMap[o.id] = o; });
 _execDash.obraMap = obraMap;

 // Popula filtro de cliente
 var sel = document.getElementById('exec-f-cliente');
 if (sel && sel.options.length <= 1) {
  var usados = {};
  _execDash.obras.forEach(function(o){ if (o.empresa_id && empresaMap[o.empresa_id]) usados[o.empresa_id] = empresaMap[o.empresa_id]; });
  Object.keys(usados).sort(function(a,b){ return usados[a].localeCompare(usados[b],'pt-BR'); }).forEach(function(id){
   var opt = document.createElement('option'); opt.value = id; opt.textContent = usados[id]; sel.appendChild(opt);
  });
 }

 _execDash.loaded = true;
 _execDashRender();
}

function _execDashResetFiltros() {
 var p=document.getElementById('exec-f-periodo'), s=document.getElementById('exec-f-segmento'),
     c=document.getElementById('exec-f-cliente'), st=document.getElementById('exec-f-status');
 if (p) p.value = 'mes'; if (s) s.value = ''; if (c) c.value = ''; if (st) st.value = '';
 _execDashRender();
}

// ── Helpers de período ──────────────────────────────────────────────────────
function _execPeriodRange(periodo) {
 var hoje = new Date(); hoje.setHours(0,0,0,0);
 var start = null, end = new Date(hoje);
 if (periodo === '7d') { start = new Date(hoje); start.setDate(start.getDate()-6); }
 else if (periodo === '30d') { start = new Date(hoje); start.setDate(start.getDate()-29); }
 else if (periodo === 'mes') { start = new Date(hoje.getFullYear(), hoje.getMonth(), 1); }
 else if (periodo === 'trimestre') { var q=Math.floor(hoje.getMonth()/3); start = new Date(hoje.getFullYear(), q*3, 1); }
 else if (periodo === 'ano') { start = new Date(hoje.getFullYear(), 0, 1); }
 else if (periodo === '12m') { start = new Date(hoje.getFullYear(), hoje.getMonth()-11, 1); }
 else { start = null; } // 'tudo'
 return { start: start, end: end, hoje: hoje };
}
function _execParseDate(s) { if (!s) return null; var d = new Date(s+'T00:00:00'); return isNaN(d.getTime()) ? null : d; }
function _execBRL(v) { return 'R$ ' + (Number(v)||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function _execBRLcompact(v) {
 v = Number(v)||0;
 var sign = v<0 ? '-' : ''; v = Math.abs(v);
 if (v >= 1e6) return sign+'R$ '+(v/1e6).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'M';
 if (v >= 1e3) return sign+'R$ '+(v/1e3).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:0})+'k';
 return sign+_execBRL(v);
}
function _execNum(v) { return (Number(v)||0).toLocaleString('pt-BR'); }
function _execPct(v) { return (Number(v)||0).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%'; }

// ── Componentes visuais reutilizados ────────────────────────────────────────
var _execCOL = {ok:'#1F8A4C', prog:'#2E5FD9', neutral:'#7D8199', crit:'#D6433C', warn:'#B8790A', brand:'#3D4FD1'};
function _execCard(content, extra) { return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:16px;'+(extra||'')+'">'+content+'</div>'; }
function _execSecHdr(lbl, clr, sub) {
 clr = clr || 'var(--navy)';
 return '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">'
  +'<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:var(--muted);display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:3px;height:13px;background:'+clr+';border-radius:2px;flex-shrink:0"></span>'+lbl+'</div>'
  +(sub?'<div style="font-size:10px;color:var(--muted)">'+sub+'</div>':'')
  +'</div>';
}
function _execKpiBox(label, value, sub, color, alert) {
 return '<div style="background:var(--surface);border:1px solid var(--border);border-left:3px solid '+(alert?color:'var(--border)')+';border-radius:8px;padding:14px 16px">'
  +'<div style="font-size:9px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px">'+label+'</div>'
  +'<div style="font-size:26px;font-weight:900;color:'+(alert?color:'var(--text)')+';line-height:1;margin-bottom:4px">'+value+'</div>'
  +'<div style="font-size:10px;color:var(--muted)">'+sub+'</div>'
  +'</div>';
}
function _execHBar(val, mx, clr) { var pct = mx>0 ? Math.min(100, Math.round(val*100/mx)) : 0; return '<div style="flex:1;background:var(--border);border-radius:3px;height:8px;overflow:hidden"><div style="width:'+pct+'%;height:100%;background:'+clr+';border-radius:3px;transition:width .4s"></div></div>'; }
function _execSvgLine(series, labels, opts) {
 opts = opts||{};
 var W=opts.w||480, H=opts.h||120, PL=opts.pl||40, PR=8, PT=10, PB=24, cW=W-PL-PR, cH=H-PT-PB, n=labels.length;
 if (n<2) return '<div style="font-size:10px;color:var(--muted);padding:20px;text-align:center">Dados insuficientes</div>';
 var allVals = series.reduce(function(all,s){return all.concat(s.values);},[]);
 var maxVal = Math.max.apply(null, allVals.concat([0])) || 1;
 function px(i){ return PL+i*(cW/(n-1)); }
 function py(v){ return PT+cH-(v/maxVal*cH); }
 var svg = '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto;display:block" xmlns="http://www.w3.org/2000/svg">';
 var nGrid=4;
 for (var gi=0; gi<=nGrid; gi++) {
  var gv=maxVal*gi/nGrid, gy=py(gv);
  svg += '<line x1="'+PL+'" y1="'+gy.toFixed(1)+'" x2="'+(W-PR)+'" y2="'+gy.toFixed(1)+'" stroke="var(--border)" stroke-width="1"/>';
  if (gi>0) svg += '<text x="'+(PL-4)+'" y="'+(gy+3.5).toFixed(1)+'" text-anchor="end" font-size="8" fill="var(--muted)">'+_execBRLcompact(gv)+'</text>';
 }
 svg += '<line x1="'+PL+'" y1="'+(PT+cH)+'" x2="'+(W-PR)+'" y2="'+(PT+cH)+'" stroke="var(--border)" stroke-width="1"/>';
 var step = Math.max(1, Math.ceil(n/8));
 labels.forEach(function(lb,i){ if (i%step!==0 && i!==n-1) return; svg += '<text x="'+px(i).toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" font-size="8" fill="var(--muted)">'+lb+'</text>'; });
 series.forEach(function(ser){
  if (!ser.values || !ser.values.length) return;
  var pts = ser.values.map(function(v,i){ return [px(i), py(v)]; });
  var aPath = 'M '+pts[0][0].toFixed(1)+' '+(PT+cH)+' ';
  pts.forEach(function(p){ aPath += 'L '+p[0].toFixed(1)+' '+p[1].toFixed(1)+' '; });
  aPath += 'L '+pts[pts.length-1][0].toFixed(1)+' '+(PT+cH)+' Z';
  if (ser.dashed) {
   svg += '<path d="M '+pts.map(function(p){return p[0].toFixed(1)+' '+p[1].toFixed(1);}).join(' L ')+'" fill="none" stroke="'+ser.color+'" stroke-width="1.8" stroke-dasharray="4 3" stroke-linejoin="round" stroke-linecap="round"/>';
  } else {
   svg += '<path d="'+aPath+'" fill="'+ser.color+'" opacity=".07"/>';
   svg += '<path d="M '+pts.map(function(p){return p[0].toFixed(1)+' '+p[1].toFixed(1);}).join(' L ')+'" fill="none" stroke="'+ser.color+'" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>';
  }
 });
 svg += '</svg>';
 var legend = '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:6px;justify-content:center">'+series.map(function(ser){
  return '<div style="display:flex;align-items:center;gap:5px;font-size:10px;color:var(--muted)"><span style="display:inline-block;width:10px;height:'+(ser.dashed?'0':'2')+'px;'+(ser.dashed?'border-top:2px dashed '+ser.color:'background:'+ser.color+';border-radius:2px')+'"></span>'+ser.label+'</div>';
 }).join('')+'</div>';
 return svg+legend;
}

// ── Contexto filtrado (recalculado a cada render) ───────────────────────────
function _execBuildCtx() {
 var periodo = document.getElementById('exec-f-periodo').value;
 var segmento = document.getElementById('exec-f-segmento').value;
 var clienteId = document.getElementById('exec-f-cliente').value;
 var statusObra = document.getElementById('exec-f-status').value;
 var range = _execPeriodRange(periodo);

 function obraSegmento(oid) { return oid ? (_execDash.obraSeg[oid] || 'Não classificado') : 'Não classificado'; }
 function obraStatusOf(o) {
  if (o.motivo_perdido) return 'perdida';
  if (o.data_fechamento) return 'concluida';
  return 'andamento';
 }
 function passaFiltroObra(oid) {
  if (!oid) return !segmento && !clienteId && !statusObra;
  var o = _execDash.obraMap[oid];
  if (!o) return !segmento && !clienteId && !statusObra;
  if (segmento && obraSegmento(oid) !== segmento) return false;
  if (clienteId && String(o.empresa_id||'') !== String(clienteId)) return false;
  if (statusObra && obraStatusOf(o) !== statusObra) return false;
  return true;
 }

 var entregas = _execDash.entregas.filter(function(e){ return passaFiltroObra(e.obra_id); });
 var obras = _execDash.obras.filter(function(o){ return passaFiltroObra(o.id); });
 var projetos = _execDash.projetos.filter(function(p){ return passaFiltroObra(p.obra_id); });
 var instalacoes = _execDash.instalacoes.filter(function(i){ return passaFiltroObra(i.obra_id); });

 return { periodo:periodo, segmento:segmento, clienteId:clienteId, statusObra:statusObra, range:range,
  obraSegmento:obraSegmento, obraStatusOf:obraStatusOf, passaFiltroObra:passaFiltroObra,
  entregas:entregas, obras:obras, projetos:projetos, instalacoes:instalacoes };
}

function _execInRange(d, start, end) {
 if (!d) return false;
 if (start && d < start) return false;
 if (end && d > end) return false;
 return true;
}

// ── SEÇÃO 4 — OBRAS ──────────────────────────────────────────────────────────
function _execSecObras(ctx) {
 var hoje = ctx.range.hoje;
 var obras = ctx.obras;
 var andamento = obras.filter(function(o){ return ctx.obraStatusOf(o)==='andamento'; });
 var concluidas = obras.filter(function(o){ return ctx.obraStatusOf(o)==='concluida'; });
 var perdidas = obras.filter(function(o){ return ctx.obraStatusOf(o)==='perdida'; });
 var semEtapa = andamento.filter(function(o){ return !o.etapa_projeto; });

 // Entregas pendentes/atrasadas por obra (para risco de atraso e "próxima da entrega")
 var entregasPendentesPorObra = {}, entregasAtrasadasPorObra = {};
 ctx.entregas.forEach(function(e){
  if (e.etapa === 'Entrega realizada' || !e.obra_id) return;
  var d = _execParseDate(e.data_faturamento);
  entregasPendentesPorObra[e.obra_id] = (entregasPendentesPorObra[e.obra_id]||0) + 1;
  if (d && d < hoje) entregasAtrasadasPorObra[e.obra_id] = (entregasAtrasadasPorObra[e.obra_id]||0) + (Number(e.valor)||0);
 });
 var atrasadas = andamento.filter(function(o){ return entregasAtrasadasPorObra[o.id] > 0; });
 var proxEntrega = andamento.filter(function(o){
  return ctx.entregas.some(function(e){
   if (e.obra_id!==o.id || e.etapa==='Entrega realizada') return false;
   var d=_execParseDate(e.data_faturamento); if(!d) return false;
   var lim=new Date(hoje); lim.setDate(lim.getDate()+15);
   return d>=hoje && d<=lim;
  });
 });
 var semMovimentacao = andamento.filter(function(o){
  if (!o.data_criacao) return false;
  var d=_execParseDate(o.data_criacao);
  var lim=new Date(hoje); lim.setDate(lim.getDate()-90);
  return !entregasPendentesPorObra[o.id] && d && d<lim;
 });

 // Faturamento realizado por obra (para rankings)
 var fatPorObra = {};
 ctx.entregas.forEach(function(e){
  if (e.etapa!=='Entrega realizada' || !e.obra_id || e.valor==null) return;
  fatPorObra[e.obra_id] = (fatPorObra[e.obra_id]||0) + Number(e.valor);
 });

 var valorAndamento = andamento.reduce(function(s,o){return s+(Number(o.valor)||0);},0);
 var valorConcluidas = concluidas.reduce(function(s,o){return s+(Number(o.valor)||0);},0);
 var valorAtrasadas = atrasadas.reduce(function(s,o){return s+(Number(o.valor)||0);},0);

 function topN(arr, keyFn, n) { return arr.slice().sort(function(a,b){return keyFn(b)-keyFn(a);}).slice(0,n); }
 var topMaiores = topN(obras, function(o){return Number(o.valor)||0;}, 5);
 var topFaturamento = topN(obras.filter(function(o){return fatPorObra[o.id]>0;}), function(o){return fatPorObra[o.id]||0;}, 5);
 var topRisco = topN(atrasadas, function(o){return entregasAtrasadasPorObra[o.id]||0;}, 5);

 function nomeObra(o){ return o.nome || ('Obra '+String(o.id).slice(0,8)); }
 function nomeEmpresa(o){ return o.empresa_id && _execDash.empresaMap[o.empresa_id] ? _execDash.empresaMap[o.empresa_id] : '—'; }
 function rankRow(o, valLabel) {
  return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">'
   + '<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+nomeObra(o)+'</div><div style="font-size:10px;color:var(--muted)">'+nomeEmpresa(o)+'</div></div>'
   + '<div style="font-size:12px;font-weight:700;white-space:nowrap">'+valLabel+'</div>'
   + '</div>';
 }

 // Distribuição por etapa de projeto (obras.etapa_projeto)
 var etapaCount = {};
 andamento.forEach(function(o){ var e=o.etapa_projeto||'Não informado'; etapaCount[e]=(etapaCount[e]||0)+1; });
 var etapaMax = Math.max.apply(null, Object.keys(etapaCount).map(function(k){return etapaCount[k];}).concat([1]));
 var etapaRows = Object.keys(etapaCount).sort(function(a,b){return etapaCount[b]-etapaCount[a];}).map(function(k){
  return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><div style="width:170px;font-size:11px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+k+'</div>'+_execHBar(etapaCount[k], etapaMax, _execCOL.brand)+'<div style="width:30px;text-align:right;font-size:11px;font-weight:700">'+etapaCount[k]+'</div></div>';
 }).join('');

 var html = '';
 html += _execSecHdr('Obras', _execCOL.brand, 'Status: andamento = sem data_fechamento e sem motivo_perdido · concluída = com data_fechamento · perdida = com motivo_perdido');

 html += '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:12px">'
  + _execKpiBox('Em Andamento', _execNum(andamento.length), _execBRLcompact(valorAndamento)+' em execução', _execCOL.prog, false)
  + _execKpiBox('Concluídas', _execNum(concluidas.length), _execBRLcompact(valorConcluidas)+' faturado', _execCOL.ok, false)
  + _execKpiBox('Risco de Atraso', _execNum(atrasadas.length), _execBRLcompact(valorAtrasadas)+' em entregas atrasadas', _execCOL.crit, atrasadas.length>0)
  + _execKpiBox('Próximas da Entrega (15d)', _execNum(proxEntrega.length), 'entregas previstas nos próximos 15 dias', _execCOL.warn, false)
  + _execKpiBox('Sem Movimentação (90d+)', _execNum(semMovimentacao.length), 'sem entregas pendentes e criadas há +90 dias', _execCOL.neutral, semMovimentacao.length>0)
  + '</div>';

 html += '<div style="display:grid;grid-template-columns:1.2fr 1fr 1fr 1fr;gap:10px">'
  + _execCard('<div style="font-size:11px;font-weight:700;margin-bottom:8px">Distribuição por Etapa de Projeto (obras em andamento)</div>'+(etapaRows||'<div style="font-size:11px;color:var(--muted)">Sem dados</div>'))
  + _execCard('<div style="font-size:11px;font-weight:700;margin-bottom:8px">Maiores Obras (valor)</div>'+(topMaiores.map(function(o){return rankRow(o, _execBRLcompact(Number(o.valor)||0));}).join('')||'<div style="font-size:11px;color:var(--muted)">Sem dados</div>'))
  + _execCard('<div style="font-size:11px;font-weight:700;margin-bottom:8px">Maior Faturamento Realizado</div>'+(topFaturamento.map(function(o){return rankRow(o, _execBRLcompact(fatPorObra[o.id]||0));}).join('')||'<div style="font-size:11px;color:var(--muted)">Sem dados</div>'))
  + _execCard('<div style="font-size:11px;font-weight:700;margin-bottom:8px">Maior Risco de Atraso</div>'+(topRisco.map(function(o){return rankRow(o, _execBRLcompact(entregasAtrasadasPorObra[o.id]||0));}).join('')||'<div style="font-size:11px;color:var(--muted)">Nenhuma obra com entrega atrasada</div>'))
  + '</div>';

 html += '<div style="font-size:10px;color:var(--muted);margin-top:8px">Rentabilidade por obra: <b>indisponível</b> — sem campos de custo associados a obras/entregas. "Maior risco de atraso" = soma de <code>entregas.valor</code> com etapa ≠ realizada e <code>data_faturamento</code> no passado.</div>';

 return html;
}

// ── SEÇÃO 5 — PROJETOS ───────────────────────────────────────────────────────
function _execSecProjetos(ctx) {
 var projetos = ctx.projetos;
 var comObra = projetos.filter(function(p){ return p.obra_id; });
 var semObra = projetos.length - comObra.length;

 var porSeg = {};
 projetos.forEach(function(p){ var seg = p.tipo_orcamento || 'Não classificado'; porSeg[seg]=(porSeg[seg]||0)+1; });
 var segMax = Math.max.apply(null, Object.keys(porSeg).map(function(k){return porSeg[k];}).concat([1]));
 var SEG_COLORS = {'Solar':'#f59e0b','Telhados':'#3b82f6','Steel Frame':'#8957E5','Modular':'#22c55e','Misto (LSF+A36)':'#d4a017','Não classificado':'#94a3b8'};
 var segRows = Object.keys(porSeg).sort(function(a,b){return porSeg[b]-porSeg[a];}).map(function(k){
  return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><div style="width:130px;font-size:11px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+k+'</div>'+_execHBar(porSeg[k], segMax, SEG_COLORS[k]||_execCOL.brand)+'<div style="width:30px;text-align:right;font-size:11px;font-weight:700">'+porSeg[k]+'</div></div>';
 }).join('');

 // "Etapa de projeto" — usa obras.etapa_projeto via obra_id do projeto (proxy, já que projetos não tem campo populado de forma confiável neste corte)
 var etapaCount = {};
 comObra.forEach(function(p){
  var o = _execDash.obraMap[p.obra_id];
  var e = (o && o.etapa_projeto) || 'Não informado';
  etapaCount[e] = (etapaCount[e]||0)+1;
 });
 var etapaMax = Math.max.apply(null, Object.keys(etapaCount).map(function(k){return etapaCount[k];}).concat([1]));
 var etapaRows = Object.keys(etapaCount).sort(function(a,b){return etapaCount[b]-etapaCount[a];}).map(function(k){
  return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><div style="width:170px;font-size:11px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+k+'</div>'+_execHBar(etapaCount[k], etapaMax, _execCOL.brand)+'<div style="width:30px;text-align:right;font-size:11px;font-weight:700">'+etapaCount[k]+'</div></div>';
 }).join('');

 var GARGALO_LIMIT = ['Pré-projeto','Análise inicial'];
 var gargalo = etapaCount['Pré-projeto']||0;

 var html = '';
 html += _execSecHdr('Projetos', _execCOL.brand, 'Etapa exibida via obras.etapa_projeto (campo do projeto não está populado de forma confiável) · Segmento: projetos.tipo_orcamento');

 html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px">'
  + _execKpiBox('Total de Projetos', _execNum(projetos.length), 'no filtro aplicado', _execCOL.brand, false)
  + _execKpiBox('Sem Vínculo com Obra', _execNum(semObra), _execPct(projetos.length?semObra/projetos.length*100:0)+' do total — não entram em quebras por obra', _execCOL.warn, semObra>0)
  + _execKpiBox('Maior Gargalo de Etapa', gargalo, '"Pré-projeto" — etapa com mais projetos parados', _execCOL.crit, gargalo>0)
  + _execKpiBox('Etapas sem Informação', etapaCount['Não informado']||0, 'projetos cuja obra não tem etapa_projeto definida', _execCOL.neutral, (etapaCount['Não informado']||0)>0)
  + '</div>';

 html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
  + _execCard('<div style="font-size:11px;font-weight:700;margin-bottom:8px">Distribuição por Linha de Negócio</div>'+(segRows||'<div style="font-size:11px;color:var(--muted)">Sem dados</div>'))
  + _execCard('<div style="font-size:11px;font-weight:700;margin-bottom:8px">Distribuição por Etapa de Projeto</div>'+(etapaRows||'<div style="font-size:11px;color:var(--muted)">Sem dados</div>'))
  + '</div>';

 return html;
}

// ── SEÇÃO 6 — ENTREGAS E INSTALAÇÕES ────────────────────────────────────────
function _execSecEntregasInstalacoes(ctx) {
 var hoje = ctx.range.hoje;
 var entregas = ctx.entregas;
 var realizadas = entregas.filter(function(e){ return e.etapa==='Entrega realizada'; });
 var programadas = entregas.filter(function(e){ return e.etapa!=='Entrega realizada'; });
 var atrasadas = programadas.filter(function(e){ var d=_execParseDate(e.data_faturamento); return d && d<hoje; });

 var etapaCount = {};
 entregas.forEach(function(e){ var et=e.etapa||'Sem etapa'; etapaCount[et]=(etapaCount[et]||0)+1; });
 var etapaMax = Math.max.apply(null, Object.keys(etapaCount).map(function(k){return etapaCount[k];}).concat([1]));
 var ETAPA_COLORS = {'Entrega realizada':_execCOL.ok,'Programar entrega':_execCOL.prog,'Produção':_execCOL.brand,'Pedido produzido':'#8957E5','Liberar produção':_execCOL.warn,'Em transporte':'#0ea5e9','Aprovação de projeto':'#d4a017','Sem etapa':_execCOL.neutral};
 var etapaRows = Object.keys(etapaCount).sort(function(a,b){return etapaCount[b]-etapaCount[a];}).map(function(k){
  return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><div style="width:150px;font-size:11px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+k+'</div>'+_execHBar(etapaCount[k], etapaMax, ETAPA_COLORS[k]||_execCOL.brand)+'<div style="width:30px;text-align:right;font-size:11px;font-weight:700">'+etapaCount[k]+'</div></div>';
 }).join('');

 // Valor entregue por período (mês atual) e valor previsto futuro
 var valorEntregueMes = realizadas.reduce(function(s,e){
  var d=_execParseDate(e.data_faturamento);
  return (d && d.getFullYear()===hoje.getFullYear() && d.getMonth()===hoje.getMonth() && e.valor!=null) ? s+Number(e.valor) : s;
 }, 0);
 var valorPrevistoFuturo = programadas.reduce(function(s,e){ return e.valor!=null ? s+Number(e.valor) : s; }, 0);

 // Instalações
 var inst = ctx.instalacoes;
 var instCount = {};
 inst.forEach(function(i){ var f=i.funil||'Sem status'; instCount[f]=(instCount[f]||0)+1; });
 var instEmExec = instCount['Em execução']||0, instProg = instCount['Programado']||0, instFin = instCount['Finalizado']||0;
 var instAtrasadas = inst.filter(function(i){
  if (i.funil==='Finalizado' || !i.data_fim) return false;
  var d=_execParseDate(i.data_fim); return d && d<hoje;
 });

 var html = '';
 html += _execSecHdr('Produção, Entregas e Instalações', _execCOL.brand, 'Fonte: <b>entregas</b> (etapa/valor/data_faturamento) e <b>instalacoes</b> (funil)');

 html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px">'
  + _execKpiBox('Entregas Realizadas', _execNum(realizadas.length), _execBRLcompact(valorEntregueMes)+' faturado este mês', _execCOL.ok, false)
  + _execKpiBox('Entregas Programadas', _execNum(programadas.length), _execBRLcompact(valorPrevistoFuturo)+' em valor previsto', _execCOL.prog, false)
  + _execKpiBox('Entregas Atrasadas', _execNum(atrasadas.length), atrasadas.length>0?_execBRLcompact(atrasadas.reduce(function(s,e){return s+(Number(e.valor)||0);},0))+' represados':'nenhuma entrega atrasada', _execCOL.crit, atrasadas.length>0)
  + _execKpiBox('Instalações', instEmExec+' em exec. / '+instProg+' prog.', instFin+' finalizadas · '+instAtrasadas.length+' atrasadas', _execCOL.warn, instAtrasadas.length>0)
  + '</div>';

 html += _execCard('<div style="font-size:11px;font-weight:700;margin-bottom:8px">Distribuição de Entregas por Etapa</div>'+(etapaRows||'<div style="font-size:11px;color:var(--muted)">Sem dados</div>'));

 html += '<div style="font-size:10px;color:var(--muted);margin-top:8px">Atenção: a tabela <code>entregas</code> é a principal fonte de faturamento da empresa. 138 registros (9,7%) não possuem <code>valor</code> definido e 18 (1,3%) não possuem <code>obra_id</code> — ambos os casos são incluídos nos totais gerais acima, mas não entram em quebras por obra/cliente/segmento.</div>';

 return html;
}

// ── SEÇÃO 7 — ALERTAS ESTRATÉGICOS ──────────────────────────────────────────
function _execSecAlertas(ctx) {
 var hoje = ctx.range.hoje;
 var alerts = [];

 // Obras com risco de atraso
 var entregasAtrasadasPorObra = {};
 ctx.entregas.forEach(function(e){
  if (e.etapa==='Entrega realizada' || !e.obra_id) return;
  var d=_execParseDate(e.data_faturamento);
  if (d && d<hoje) entregasAtrasadasPorObra[e.obra_id] = (entregasAtrasadasPorObra[e.obra_id]||0) + (Number(e.valor)||0);
 });
 var nObrasAtraso = Object.keys(entregasAtrasadasPorObra).length;
 if (nObrasAtraso>0) alerts.push({sev:'crit', txt: nObrasAtraso+' obra(s) com entregas em atraso, totalizando '+_execBRLcompact(Object.keys(entregasAtrasadasPorObra).reduce(function(s,k){return s+entregasAtrasadasPorObra[k];},0))+' em valor represado.'});

 // Projetos sem atualização (sem obra vinculada)
 var projSemObra = ctx.projetos.filter(function(p){return !p.obra_id;}).length;
 if (projSemObra>0) alerts.push({sev:'warn', txt: projSemObra+' projeto(s) sem vínculo com obra — não entram em métricas de obra/segmento e merecem revisão de cadastro.'});

 // Entregas sem obra_id (impacto financeiro)
 var entSemObra = _execDash.entregas.filter(function(e){return !e.obra_id;});
 var valorSemObra = entSemObra.reduce(function(s,e){return s+(Number(e.valor)||0);},0);
 if (entSemObra.length>0) alerts.push({sev:'warn', txt: entSemObra.length+' entrega(s) sem obra vinculada, somando '+_execBRLcompact(valorSemObra)+' — ficam fora das análises por obra/cliente/segmento.'});

 // Entregas sem valor
 var entSemValor = _execDash.entregas.filter(function(e){return e.valor==null;}).length;
 if (entSemValor>0) alerts.push({sev:'neutral', txt: entSemValor+' entrega(s) sem valor definido — excluídas das somas financeiras.'});

 // Obras em andamento sem etapa de projeto
 var obrasSemEtapa = ctx.obras.filter(function(o){ return ctx.obraStatusOf(o)==='andamento' && !o.etapa_projeto; }).length;
 if (obrasSemEtapa>0) alerts.push({sev:'neutral', txt: obrasSemEtapa+' obra(s) em andamento sem etapa de projeto definida.'});

 // Queda de faturamento MoM
 var realizadas = ctx.entregas.filter(function(e){ return e.etapa==='Entrega realizada' && e.valor!=null; });
 var mAtual=hoje.getMonth(), aAtual=hoje.getFullYear(), mAnterior=mAtual===0?11:mAtual-1, aAnt=mAtual===0?aAtual-1:aAtual;
 function somaMes(a,m){ return realizadas.reduce(function(s,e){var d=_execParseDate(e.data_faturamento); return (d&&d.getFullYear()===a&&d.getMonth()===m)?s+Number(e.valor):s;},0); }
 var fAtual=somaMes(aAtual,mAtual), fAnterior=somaMes(aAnt,mAnterior);
 if (fAnterior>0 && fAtual<fAnterior) alerts.push({sev:'crit', txt:'Queda de faturamento mensal: '+_execBRLcompact(fAtual)+' (mês atual, parcial) vs '+_execBRLcompact(fAnterior)+' (mês anterior).'});

 // Instalações atrasadas
 var instAtrasadas = ctx.instalacoes.filter(function(i){
  if (i.funil==='Finalizado' || !i.data_fim) return false;
  var d=_execParseDate(i.data_fim); return d && d<hoje;
 }).length;
 if (instAtrasadas>0) alerts.push({sev:'crit', txt: instAtrasadas+' instalação(ões) com data de término no passado e ainda não finalizadas.'});

 // Desvio previsto vs realizado (mês atual)
 var previstasMes = ctx.entregas.filter(function(e){
  if (e.etapa==='Entrega realizada' || e.valor==null) return false;
  var d=_execParseDate(e.data_faturamento); return d && d.getFullYear()===aAtual && d.getMonth()===mAtual && d<hoje;
 });
 if (previstasMes.length>0) alerts.push({sev:'warn', txt: previstasMes.length+' entrega(s) previstas para este mês (com data já vencida) ainda não foram marcadas como realizadas — possível desvio entre previsto e realizado.'});

 var SEV = {crit:{c:_execCOL.crit,l:'Crítico'}, warn:{c:_execCOL.warn,l:'Atenção'}, neutral:{c:_execCOL.neutral,l:'Info'}};
 var html = '';
 html += _execSecHdr('Central de Alertas Estratégicos', _execCOL.crit, alerts.length+' alerta(s) ativo(s) para os filtros selecionados');
 if (!alerts.length) {
  html += _execCard('<div style="font-size:12px;color:var(--muted);text-align:center;padding:20px">Nenhum alerta identificado para os filtros selecionados.</div>');
 } else {
  html += _execCard(alerts.map(function(a){
   var s = SEV[a.sev];
   return '<div style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--border)">'
    + '<span style="display:inline-block;margin-top:3px;width:8px;height:8px;border-radius:50%;background:'+s.c+';flex-shrink:0"></span>'
    + '<div style="flex:1"><span style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:'+s.c+'">'+s.l+'</span><div style="font-size:12px;margin-top:2px">'+a.txt+'</div></div>'
    + '</div>';
  }).join(''));
 }
 return html;
}

// ── SEÇÃO 1 — INDICADORES FINANCEIROS ───────────────────────────────────────
function _execSecFinanceiro(ctx) {
 var hoje = ctx.range.hoje;
 var realizadas = ctx.entregas.filter(function(e){ return e.etapa === 'Entrega realizada' && e.valor != null; });
 var previstas  = ctx.entregas.filter(function(e){ return e.etapa !== 'Entrega realizada' && e.valor != null; });

 // Janelas fixas de faturamento realizado (independem do filtro de período)
 var inicioSemana = new Date(hoje); inicioSemana.setDate(hoje.getDate() - hoje.getDay());
 var inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
 var inicioTrimestre = new Date(hoje.getFullYear(), Math.floor(hoje.getMonth()/3)*3, 1);
 var inicioAno = new Date(hoje.getFullYear(), 0, 1);

 function somaRealizado(start) {
  return realizadas.reduce(function(s,e){ var d=_execParseDate(e.data_faturamento); return _execInRange(d, start, hoje) ? s+Number(e.valor) : s; }, 0);
 }
 var fatHoje = somaRealizado(hoje), fatSemana = somaRealizado(inicioSemana), fatMes = somaRealizado(inicioMes),
     fatTrimestre = somaRealizado(inicioTrimestre), fatAno = somaRealizado(inicioAno);

 // Realizado no período selecionado pelo filtro global
 var fatPeriodo = realizadas.reduce(function(s,e){ var d=_execParseDate(e.data_faturamento); return _execInRange(d, ctx.range.start, ctx.range.end) ? s+Number(e.valor) : s; }, 0);

 // Previsto — janelas fixas a partir de hoje
 function somaPrevisto(dias) {
  var lim = new Date(hoje); lim.setDate(lim.getDate()+dias);
  return previstas.reduce(function(s,e){ var d=_execParseDate(e.data_faturamento); return (d && d > hoje && d <= lim) ? s+Number(e.valor) : s; }, 0);
 }
 var prev7 = somaPrevisto(7), prev30 = somaPrevisto(30), prev90 = somaPrevisto(90);
 var prevTotal = previstas.reduce(function(s,e){ return s+Number(e.valor); }, 0);

 // Valor em negociação (obras abertas: sem data_fechamento e sem motivo_perdido)
 var valorNegociacao = ctx.obras.filter(function(o){ return ctx.obraStatusOf(o)==='andamento'; })
  .reduce(function(s,o){ return s + (Number(o.valor)||0); }, 0);
 var qtdNegociacao = ctx.obras.filter(function(o){ return ctx.obraStatusOf(o)==='andamento'; }).length;

 // Crescimento MoM e YoY (faturamento realizado, mês fechado anterior vs mês atual em curso)
 function somaMes(ano, mes) {
  return realizadas.reduce(function(s,e){ var d=_execParseDate(e.data_faturamento); return (d && d.getFullYear()===ano && d.getMonth()===mes) ? s+Number(e.valor) : s; }, 0);
 }
 var mAtual = hoje.getMonth(), aAtual = hoje.getFullYear();
 var mAnterior = mAtual===0?11:mAtual-1, aAntMes = mAtual===0?aAtual-1:aAtual;
 var fatMesAtualTotal = somaMes(aAtual, mAtual), fatMesAnterior = somaMes(aAntMes, mAnterior), fatMesmoMesAnoAnterior = somaMes(aAtual-1, mAtual);
 var mom = fatMesAnterior>0 ? ((fatMesAtualTotal - fatMesAnterior)/fatMesAnterior*100) : null;
 var yoy = fatMesmoMesAnoAnterior>0 ? ((fatMesAtualTotal - fatMesmoMesAnoAnterior)/fatMesmoMesAnoAnterior*100) : null;

 // Ticket médio
 var ticketEntrega = realizadas.length ? (realizadas.reduce(function(s,e){return s+Number(e.valor);},0) / realizadas.length) : 0;
 var porObra = {};
 realizadas.forEach(function(e){ if (e.obra_id) porObra[e.obra_id] = (porObra[e.obra_id]||0) + Number(e.valor); });
 var obraVals = Object.keys(porObra).map(function(k){return porObra[k];});
 var ticketContrato = obraVals.length ? (obraVals.reduce(function(a,b){return a+b;},0) / obraVals.length) : 0;
 var porCliente = {};
 Object.keys(porObra).forEach(function(oid){
  var o = _execDash.obraMap[oid]; if (!o || !o.empresa_id) return;
  porCliente[o.empresa_id] = (porCliente[o.empresa_id]||0) + porObra[oid];
 });
 var clienteVals = Object.keys(porCliente).map(function(k){return porCliente[k];});
 var ticketCliente = clienteVals.length ? (clienteVals.reduce(function(a,b){return a+b;},0) / clienteVals.length) : 0;

 var deltaClr = function(v){ return v==null?'var(--muted)':(v>=0?'var(--green)':'var(--red)'); };
 var deltaTxt = function(v){ return v==null?'sem base de comparação':(v>=0?'+':'')+_execPct(v)+' vs período anterior'; };

 var html = '';
 html += _execSecHdr('Indicadores Financeiros — Período: '+_execPeriodLabel(ctx.periodo), _execCOL.brand,
   'Fonte: tabela <b>entregas</b> · Realizado = etapa "Entrega realizada" · Previsto = demais etapas');

 // Faixa fixa: hoje / semana / mês / trimestre / ano
 html += '<div style="display:flex;flex-wrap:wrap;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 16px;margin-bottom:12px">'
  + [
    {l:'Faturamento Hoje', v:_execBRLcompact(fatHoje)},
    {l:'Esta Semana', v:_execBRLcompact(fatSemana)},
    {l:'Este Mês', v:_execBRLcompact(fatMes)},
    {l:'Este Trimestre', v:_execBRLcompact(fatTrimestre)},
    {l:'Este Ano', v:_execBRLcompact(fatAno)}
   ].map(function(it,i){
    return '<div style="flex:1;min-width:120px;padding:4px 14px;'+(i>0?'border-left:1px solid var(--border)':'')+'">'
     +'<div style="font-size:18px;font-weight:800;color:var(--text)">'+it.v+'</div>'
     +'<div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-top:2px">'+it.l+'</div>'
     +'</div>';
   }).join('')
  + '</div>';

 // KPIs principais
 html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px">'
  + _execKpiBox('Faturamento Realizado (período)', _execBRLcompact(fatPeriodo), realizadas.length+' entregas realizadas no período', _execCOL.ok, false)
  + _execKpiBox('Faturamento Previsto', _execBRLcompact(prevTotal), '7d: '+_execBRLcompact(prev7)+' · 30d: '+_execBRLcompact(prev30)+' · 90d: '+_execBRLcompact(prev90), _execCOL.prog, false)
  + _execKpiBox('Valor em Negociação', _execBRLcompact(valorNegociacao), qtdNegociacao+' obras em andamento (sem fechamento/perda)', _execCOL.warn, false)
  + _execKpiBox('Crescimento MoM', mom==null?'—':(mom>=0?'+':'')+_execPct(mom), 'mês atual '+_execBRLcompact(fatMesAtualTotal)+' vs anterior '+_execBRLcompact(fatMesAnterior), deltaClr(mom), mom!=null && mom<0)
  + '</div>';

 html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:6px">'
  + _execKpiBox('Crescimento YoY', yoy==null?'—':(yoy>=0?'+':'')+_execPct(yoy), 'mesmo mês ano anterior: '+_execBRLcompact(fatMesmoMesAnoAnterior), deltaClr(yoy), yoy!=null && yoy<0)
  + _execKpiBox('Ticket Médio / Entrega', _execBRLcompact(ticketEntrega), realizadas.length+' entregas realizadas (todo período filtrado)', _execCOL.brand, false)
  + _execKpiBox('Ticket Médio / Contrato (Obra)', _execBRLcompact(ticketContrato), obraVals.length+' obras com entrega realizada', '#8957E5', false)
  + _execKpiBox('Ticket Médio / Cliente', _execBRLcompact(ticketCliente), clienteVals.length+' clientes com entrega realizada', '#0f766e', false)
  + '</div>';

 return html;
}
function _execPeriodLabel(p) {
 return {'7d':'Últimos 7 dias','30d':'Últimos 30 dias','mes':'Mês atual','trimestre':'Trimestre atual','ano':'Ano atual','12m':'Últimos 12 meses','tudo':'Todo o período'}[p] || p;
}

// ── SEÇÃO 2 — PREVISÃO DE FATURAMENTO ───────────────────────────────────────
function _execSecPrevisao(ctx) {
 var hoje = ctx.range.hoje;
 var realizadas = ctx.entregas.filter(function(e){ return e.etapa === 'Entrega realizada' && e.valor != null; });
 var previstas  = ctx.entregas.filter(function(e){ return e.etapa !== 'Entrega realizada' && e.valor != null; });

 var MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
 var labels = [], realizadoSerie = [], previstoSerie = [];

 // Define o intervalo de meses do gráfico:
 //  - início: respeita o filtro de período (ctx.range.start); se 'tudo', usa o
 //    mês da entrega mais antiga com data_faturamento.
 //  - fim: pelo menos mês atual + 3 meses de projeção, estendido se houver
 //    entregas previstas com data além desse horizonte.
 var minDate=null, maxDate=null;
 ctx.entregas.forEach(function(e){
  var d = _execParseDate(e.data_faturamento);
  if (!d) return;
  if (!minDate || d<minDate) minDate=d;
  if (!maxDate || d>maxDate) maxDate=d;
 });
 var inicioMes = ctx.range.start
  ? new Date(ctx.range.start.getFullYear(), ctx.range.start.getMonth(), 1)
  : (minDate ? new Date(minDate.getFullYear(), minDate.getMonth(), 1) : new Date(hoje.getFullYear(), hoje.getMonth(), 1));
 var fimBase = new Date(hoje.getFullYear(), hoje.getMonth()+3, 1);
 var fimMes = (maxDate && maxDate > fimBase) ? new Date(maxDate.getFullYear(), maxDate.getMonth(), 1) : fimBase;
 if (fimMes < inicioMes) fimMes = inicioMes;

 var meses = [];
 var cursor = new Date(inicioMes);
 while (cursor <= fimMes) {
  meses.push(new Date(cursor));
  cursor = new Date(cursor.getFullYear(), cursor.getMonth()+1, 1);
 }
 var idxAtual = meses.findIndex(function(dt){ return dt.getFullYear()===hoje.getFullYear() && dt.getMonth()===hoje.getMonth(); });
 if (idxAtual === -1) idxAtual = meses.length-1;

 meses.forEach(function(dt, idx){
  labels.push(MESES[dt.getMonth()]+'/'+String(dt.getFullYear()).slice(2));
  var somaR = realizadas.reduce(function(s,e){ var d=_execParseDate(e.data_faturamento); return (d && d.getFullYear()===dt.getFullYear() && d.getMonth()===dt.getMonth()) ? s+Number(e.valor) : s; }, 0);
  var somaP = previstas.reduce(function(s,e){ var d=_execParseDate(e.data_faturamento); return (d && d.getFullYear()===dt.getFullYear() && d.getMonth()===dt.getMonth()) ? s+Number(e.valor) : s; }, 0);
  // Histórico (até o mês atual): mostra realizado; meses futuros: null no realizado
  realizadoSerie.push(idx <= idxAtual ? somaR : null);
  // Previsto: para meses futuros usa pipeline (somaP); para o mês atual soma o que falta (previsto do mês corrente)
  previstoSerie.push(idx === idxAtual ? (somaR + somaP) : (idx > idxAtual ? somaP : null));
 });

 // Para o gráfico de área empilhada simplificado, tratamos null como 0 mas marcamos via dashed só na parte futura
 var realSerieChart = realizadoSerie.map(function(v){ return v==null?0:v; });
 var prevSerieChart = previstoSerie.map(function(v){ return v==null?0:v; });

 var totalPipeline = previstas.reduce(function(s,e){ return s+Number(e.valor); }, 0);
 var qtdPipeline = previstas.length;
 var qtdSemData = previstas.filter(function(e){ return !e.data_faturamento; }).length;
 var confianca = qtdPipeline===0 ? '—' : (qtdSemData/qtdPipeline > 0.3 ? 'Baixa' : (qtdSemData/qtdPipeline > 0.1 ? 'Média' : 'Alta'));
 var confCor = confianca==='Alta'?_execCOL.ok:(confianca==='Média'?_execCOL.warn:_execCOL.crit);

 var html = '';
 html += _execSecHdr('Previsão de Faturamento', _execCOL.prog,
   'Fonte: <b>entregas</b> · Histórico = realizado por mês de data_faturamento · Projeção = soma de entregas com etapa ≠ "Entrega realizada" agrupadas por mês de data_faturamento · Período exibido: '+labels[0]+' a '+labels[labels.length-1]+(ctx.range.start?' (conforme filtro de período selecionado)':' (todo o histórico disponível na base)'));

 html += _execCard(
   '<div style="font-size:11px;font-weight:700;margin-bottom:6px">Realizado (12 meses) vs Projetado (3 meses)</div>'
   + _execSvgLine([
      {label:'Realizado', color:_execCOL.ok, values:realSerieChart},
      {label:'Previsto / Projetado', color:_execCOL.prog, dashed:true, values:prevSerieChart}
     ], labels, {w:900, h:160, pl:46})
   , 'margin-bottom:12px');

 html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">'
  + _execKpiBox('Faturamento Esperado — próx. 30 dias', _execBRLcompact(previstas.filter(function(e){var d=_execParseDate(e.data_faturamento);var lim=new Date(hoje);lim.setDate(lim.getDate()+30);return d&&d>hoje&&d<=lim;}).reduce(function(s,e){return s+Number(e.valor);},0)), 'soma de entregas pendentes com data nos próximos 30 dias', _execCOL.prog, false)
  + _execKpiBox('Pipeline Total (não realizado)', _execBRLcompact(totalPipeline), qtdPipeline+' entregas pendentes ('+qtdSemData+' sem data definida)', _execCOL.brand, false)
  + _execKpiBox('Grau de Confiança da Projeção', confianca, qtdSemData+' de '+qtdPipeline+' entregas pendentes sem data_faturamento', confCor, confianca==='Baixa')
  + '</div>';

 html += '<div style="font-size:10px;color:var(--muted);margin-top:8px">Metodologia: a curva de Realizado soma <code>entregas.valor</code> por mês de <code>data_faturamento</code> onde <code>etapa = \'Entrega realizada\'</code>. A curva Previsto/Projetado soma o mesmo campo para as demais etapas (Programar entrega, Produção, Pedido produzido, Liberar produção, Em transporte, Aprovação de projeto). Não há modelo estatístico de tendência — a projeção reflete exatamente o pipeline declarado em obras/produção/entregas programadas.</div>';

 return html;
}

// ── SEÇÃO 3 — SEGMENTAÇÃO POR LINHA DE NEGÓCIO ──────────────────────────────
function _execSecSegmentacao(ctx) {
 var hoje = ctx.range.hoje;
 var realizadas = ctx.entregas.filter(function(e){ return e.etapa === 'Entrega realizada' && e.valor != null; });
 var SEGS = ['Solar','Telhados','Steel Frame','Modular','Misto (LSF + A36)','Não classificado'];
 var SEG_COLORS = {'Solar':'#f59e0b','Telhados':'#0891b2','Steel Frame':'#8957E5','Modular':'#22c55e','Misto (LSF + A36)':'#ec4899','Não classificado':'#94a3b8'};

 // Faturamento realizado por segmento (período selecionado)
 function somaPeriodoPorSeg(seg) {
  return realizadas.reduce(function(s,e){
   var d = _execParseDate(e.data_faturamento);
   if (!_execInRange(d, ctx.range.start, ctx.range.end)) return s;
   if (ctx.obraSegmento(e.obra_id) !== seg) return s;
   return s + Number(e.valor);
  }, 0);
 }
 // Faturamento realizado por segmento — mês anterior (para crescimento)
 var mAtual = hoje.getMonth(), aAtual = hoje.getFullYear();
 var mAnterior = mAtual===0?11:mAtual-1, aAntMes = mAtual===0?aAtual-1:aAtual;
 function somaMesPorSeg(seg, ano, mes) {
  return realizadas.reduce(function(s,e){
   var d = _execParseDate(e.data_faturamento);
   if (!d || d.getFullYear()!==ano || d.getMonth()!==mes) return s;
   if (ctx.obraSegmento(e.obra_id) !== seg) return s;
   return s + Number(e.valor);
  }, 0);
 }

 var dados = SEGS.map(function(seg){
  var v = somaPeriodoPorSeg(seg);
  var vAtual = somaMesPorSeg(seg, aAtual, mAtual);
  var vAnterior = somaMesPorSeg(seg, aAntMes, mAnterior);
  var cresc = vAnterior>0 ? (vAtual-vAnterior)/vAnterior*100 : null;
  return { seg:seg, valor:v, cresc:cresc };
 });
 var totalGeral = dados.reduce(function(s,d){return s+d.valor;},0);

 // Rentabilidade por segmento — sem dados de custo na base, indicado como indisponível
 var html = '';
 html += _execSecHdr('Segmentação por Linha de Negócio', _execCOL.brand,
   'Fonte: <b>obras.tipo_obra</b> ("Categoria da Obra", sincronizado do Airtable) · Faturamento: <b>entregas</b> realizadas no período, segmentadas pela categoria da obra vinculada');

 // Donut + lista
 var slices = dados.filter(function(d){return d.valor>0;}).map(function(d){ return {v:d.valor, c:SEG_COLORS[d.seg]}; });
 var donutSvg = '<svg viewBox="0 0 120 120" style="width:120px;height:120px;flex-shrink:0">' + (function(){
  var tot = slices.reduce(function(s,x){return s+x.v;},0), cx=60, cy=60, r=52, stroke=18;
  if (!tot) return '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="var(--border)" stroke-width="'+stroke+'"/>';
  var paths='', angle=-Math.PI/2;
  slices.forEach(function(sl){
   var sw=(sl.v/tot)*2*Math.PI, x1=cx+r*Math.cos(angle), y1=cy+r*Math.sin(angle), x2=cx+r*Math.cos(angle+sw), y2=cy+r*Math.sin(angle+sw), lg=sw>Math.PI?1:0;
   paths += '<path d="M '+cx+' '+cy+' L '+x1.toFixed(1)+' '+y1.toFixed(1)+' A '+r+' '+r+' 0 '+lg+' 1 '+x2.toFixed(1)+' '+y2.toFixed(1)+' Z" fill="'+sl.c+'" opacity=".9"/>';
   angle += sw;
  });
  return paths + '<circle cx="'+cx+'" cy="'+cy+'" r="'+(r-stroke)+'" fill="var(--surface)"/>';
 })() + '</svg>';

 var lista = dados.map(function(d){
  var pct = totalGeral>0 ? d.valor/totalGeral*100 : 0;
  var crescTxt = d.cresc==null ? '—' : (d.cresc>=0?'+':'')+_execPct(d.cresc)+' MoM';
  var crescClr = d.cresc==null?'var(--muted)':(d.cresc>=0?'var(--green)':'var(--red)');
  return '<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border)">'
   + '<span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:'+SEG_COLORS[d.seg]+';flex-shrink:0"></span>'
   + '<span style="flex:1;font-size:12px;font-weight:600">'+d.seg+'</span>'
   + '<span style="font-size:12px;font-weight:700">'+_execBRLcompact(d.valor)+'</span>'
   + '<span style="font-size:11px;color:var(--muted);width:50px;text-align:right">'+_execPct(pct)+'</span>'
   + '<span style="font-size:11px;color:'+crescClr+';width:80px;text-align:right">'+crescTxt+'</span>'
   + '</div>';
 }).join('');

 html += _execCard(
   '<div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap">'
   + donutSvg
   + '<div style="flex:1;min-width:280px">'
     + '<div style="display:flex;gap:10px;padding:0 0 6px;font-size:9px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid var(--border)"><span style="width:10px"></span><span style="flex:1">Segmento</span><span>Faturamento</span><span style="width:50px;text-align:right">Part.</span><span style="width:80px;text-align:right">Cresc. MoM</span></div>'
     + lista
   + '</div>'
   + '</div>'
   + '<div style="font-size:10px;color:var(--muted);margin-top:10px">Rentabilidade por segmento: <b>indisponível</b> — a base não possui campos de custo/margem associados a entregas ou projetos.</div>'
 );

 return html;
}

// ── MAPA DE OBRAS ─────────────────────────────────────────────────────────────
var _execMapInstance = null;

var _execGeocodesBR = {
 /* ── SERGIPE (todos os 75 municípios) ── */
 'Amparo de São Francisco':[-10.1333,-36.9167],'Aquidabã':[-10.2833,-37.0000],
 'Aracaju':[-10.9167,-37.0500],'Arauá':[-11.2667,-37.6167],
 'Areia Branca':[-10.7667,-37.3167],'Barra dos Coqueiros':[-10.9081,-37.0280],
 'Boquim':[-11.1489,-37.6186],'Brejo Grande':[-10.4333,-36.4667],
 'Campo do Brito':[-10.7333,-37.4833],'Canhoba':[-10.1500,-36.9833],
 'Canindé de São Francisco':[-9.6486,-37.7969],'Capela':[-10.5000,-37.0500],
 'Carira':[-10.3500,-37.7000],'Carmópolis':[-10.6589,-36.9903],
 'Cedro de São João':[-10.2333,-36.8833],'Cristinápolis':[-11.4833,-37.7500],
 'Cumbe':[-10.2167,-37.1333],'Divina Pastora':[-10.6667,-37.1333],
 'Estância':[-11.2664,-37.4386],'Feira Nova':[-10.2333,-37.3000],
 'Frei Paulo':[-10.5500,-37.5333],'Gararu':[-9.9667,-37.0833],
 'General Maynard':[-10.6667,-36.9833],'Gracho Cardoso':[-10.3167,-37.2167],
 'Ilha das Flores':[-10.4333,-36.5333],'Indiaroba':[-11.5167,-37.5167],
 'Itabaiana':[-10.6847,-37.4255],'Itabaianinha':[-11.2667,-37.7833],
 'Itabi':[-10.0833,-37.1000],'Itaporanga d\'Ajuda':[-11.0994,-37.3083],
 'Japaratuba':[-10.5833,-36.9500],'Japoatã':[-10.3500,-36.7833],
 'Lagarto':[-10.9163,-37.6503],'Laranjeiras':[-10.8000,-37.1667],
 'Macambira':[-10.6833,-37.5667],'Malhada dos Bois':[-10.3333,-36.9333],
 'Malhador':[-10.6500,-37.3000],'Maruim':[-10.7333,-37.0833],
 'Moita Bonita':[-10.5833,-37.3500],'Monte Alegre de Sergipe':[-9.7667,-37.5833],
 'Muribeca':[-10.4167,-36.9500],'Neópolis':[-10.3217,-36.5847],
 'Nossa Senhora Aparecida':[-10.3500,-37.4833],'Nossa Senhora da Glória':[-10.2167,-37.4167],
 'Nossa Senhora das Dores':[-10.4917,-37.1950],'Nossa Senhora de Lourdes':[-10.0833,-37.0667],
 'Nossa Senhora do Socorro':[-10.8547,-37.1244],'N. Sra. do Socorro':[-10.8547,-37.1244],
 'N Sra do Socorro':[-10.8547,-37.1244],'Pacatuba':[-10.4500,-36.6500],
 'Pedra Mole':[-10.6167,-37.6833],'Pedrinhas':[-11.1833,-37.6667],
 'Pinhão':[-10.5667,-37.7167],'Pirambu':[-10.7333,-36.8667],
 'Poço Redondo':[-9.8061,-37.6858],'Poço Verde':[-10.7167,-38.1833],
 'Porto da Folha':[-9.9167,-37.2833],'Propriá':[-10.2136,-36.8350],
 'Riachão do Dantas':[-11.0667,-37.7333],'Riachuelo':[-10.7333,-37.2167],
 'Ribeirópolis':[-10.5333,-37.4333],'Rosário do Catete':[-10.6833,-37.0333],
 'Salgado':[-11.0333,-37.4667],'Santa Luzia do Itanhy':[-11.3667,-37.4500],
 'Santa Rosa de Lima':[-10.6500,-37.1500],'Santana do São Francisco':[-10.3000,-36.5667],
 'Santo Amaro das Brotas':[-10.7833,-37.0500],'São Cristóvão':[-11.0136,-37.2058],
 'São Domingos':[-10.7833,-37.5833],'São Francisco':[-10.3500,-36.9167],
 'São Miguel do Aleixo':[-10.4500,-37.1167],'Simão Dias':[-10.7380,-37.8118],
 'Siriri':[-10.5833,-37.1000],'Telha':[-10.2000,-37.0000],
 'Tobias Barreto':[-11.1853,-38.0028],'Tomar do Geru':[-11.3667,-37.8500],
 'Umbaúba':[-11.3744,-37.6619],
 /* ── BAHIA ── */
 'Salvador':[-12.9718,-38.5011],'Feira de Santana':[-12.2664,-38.9663],
 'Vitória da Conquista':[-14.8661,-40.8444],'Camaçari':[-12.6997,-38.3244],
 'Juazeiro':[-9.4150,-40.5028],'Ilhéus':[-14.7900,-39.0500],
 'Lauro de Freitas':[-12.8978,-38.3294],'Jequié':[-13.8508,-40.0842],
 'Teixeira de Freitas':[-17.5350,-39.7422],'Alagoinhas':[-12.1378,-38.4197],
 'Barreiras':[-12.1508,-44.9975],'Porto Seguro':[-16.4497,-39.0642],
 'Simões Filho':[-12.7833,-38.4000],'Paulo Afonso':[-9.4058,-38.2150],
 'Eunápolis':[-16.3778,-39.5800],'Santo Antônio de Jesus':[-12.9728,-39.2606],
 'Itabuna':[-14.7856,-39.2800],'Serrinha':[-11.6639,-39.0064],
 'Luís Eduardo Magalhães':[-12.0961,-45.7894],'Jacobina':[-11.1814,-40.5108],
 'Cruz das Almas':[-12.6689,-39.1058],'Valença':[-13.3608,-39.0736],
 'Caetité':[-14.0681,-42.4736],'Ibotirama':[-12.1778,-43.2167],
 'Guanambi':[-14.2239,-42.7811],'Euclides da Cunha':[-10.5075,-39.0122],
 'Senhor do Bonfim':[-10.4658,-40.1878],'Brumado':[-14.2028,-41.6664],
 'Santo Amaro':[-12.5500,-38.7167],'Itamaraju':[-17.0414,-39.5289],
 'Ipiaú':[-14.1333,-39.7333],'Irecê':[-11.3044,-41.8556],
 'Conceição do Coité':[-11.5608,-39.2872],'Entre Rios':[-11.9439,-38.0833],
 'Cachoeira':[-12.5997,-38.9578],'Morro do Chapéu':[-11.5514,-41.1572],
 'Bom Jesus da Lapa':[-13.2553,-43.4158],'Ituberá':[-13.7278,-39.1489],
 'Madre de Deus':[-12.7500,-38.6167],'São Francisco do Conde':[-12.6236,-38.6811],
 'Candeias':[-12.6708,-38.5469],'Dias d\'Ávila':[-12.6178,-38.2975],
 /* ── ALAGOAS ── */
 'Maceió':[-9.6658,-35.7350],'Arapiraca':[-9.7528,-36.6611],
 'Rio Largo':[-9.4778,-35.8444],'Palmeira dos Índios':[-9.4089,-36.6283],
 'União dos Palmares':[-9.1650,-36.0333],'Penedo':[-10.2858,-36.5831],
 'São Miguel dos Campos':[-9.7819,-36.0889],'Delmiro Gouveia':[-9.3892,-37.9989],
 'Coruripe':[-10.1256,-36.1764],'Marechal Deodoro':[-9.7158,-35.8989],
 'Santana do Ipanema':[-9.3756,-37.2425],'Murici':[-9.3167,-35.9333],
 'Atalaia':[-9.5094,-36.0219],'Porto Calvo':[-9.0572,-35.3989],
 'Paripueira':[-9.4667,-35.5500],'Piranhas':[-9.6167,-37.7500],
 /* ── PERNAMBUCO ── */
 'Recife':[-8.0578,-34.8829],'Caruaru':[-8.2797,-35.9758],
 'Olinda':[-7.9978,-34.8508],'Petrolina':[-9.3878,-40.5036],
 'Paulista':[-7.9408,-34.8728],'Camarajibe':[-8.0197,-35.0447],
 'Cabo de Santo Agostinho':[-8.2897,-35.0333],'Jaboatão dos Guararapes':[-8.1800,-35.0019],
 'Vitória de Santo Antão':[-8.1208,-35.2961],'Garanhuns':[-8.8900,-36.4928],
 'Santa Cruz do Capibaribe':[-7.9572,-36.2050],'Igarassu':[-7.8347,-34.9069],
 'Abreu e Lima':[-7.9108,-34.8983],'Ipojuca':[-8.3989,-35.0611],
 'Toritama':[-8.0083,-36.0542],'Serra Talhada':[-7.9872,-38.2953],
 'Araripina':[-7.5758,-40.4978],'Salgueiro':[-8.0736,-39.1264],
 /* ── CEARÁ ── */
 'Fortaleza':[-3.7172,-38.5437],'Caucaia':[-3.7333,-38.6500],
 'Juazeiro do Norte':[-7.2119,-39.3153],'Maracanaú':[-3.8767,-38.6256],
 'Itaitinga':[-3.9989,-38.5961],
 'Sobral':[-3.6883,-40.3483],'Crato':[-7.2333,-39.4000],
 'Itapipoca':[-3.4942,-39.5789],'Maranguape':[-3.8906,-38.6844],
 'Iguatu':[-6.3594,-39.2983],'Quixadá':[-4.9697,-39.0147],
 'Horizonte':[-4.1000,-38.5000],'Pacajus':[-4.1744,-38.4583],
 'Aquiraz':[-3.9008,-38.3914],'Tianguá':[-3.7328,-40.9933],
 'Aracati':[-4.5619,-37.7700],'Russas':[-4.9378,-37.9739],
 /* ── RIO GRANDE DO NORTE ── */
 'Natal':[-5.7945,-35.2110],'Mossoró':[-5.1878,-37.3444],
 'Parnamirim':[-5.9147,-35.2639],'São Gonçalo do Amarante':[-5.7900,-35.3300],
 'Macaíba':[-5.8578,-35.3569],'Ceará-Mirim':[-5.6333,-35.4333],
 'Caicó':[-6.4583,-37.0956],'Assu':[-5.5783,-36.9081],
 /* ── PARAÍBA ── */
 'João Pessoa':[-7.1195,-34.8450],'Campina Grande':[-7.2306,-35.8811],
 'Santa Rita':[-7.1189,-34.9806],'Patos':[-7.0253,-37.2808],
 'Bayeux':[-7.1247,-34.9414],'Sousa':[-6.7578,-38.2281],
 'Cajazeiras':[-6.8908,-38.5578],'Guarabira':[-6.8572,-35.4931],
 /* ── PIAUÍ ── */
 'Teresina':[-5.0920,-42.8038],'Parnaíba':[-2.9058,-41.7764],
 'Picos':[-7.0778,-41.4669],'Floriano':[-6.7669,-43.0211],
 /* ── MARANHÃO ── */
 'São Luís':[-2.5297,-44.3028],'Imperatriz':[-5.5261,-47.4786],
 'Timon':[-5.0933,-42.8342],'Caxias':[-4.8686,-43.3558],
 'Codó':[-4.4558,-43.8858],'Açailândia':[-4.9444,-47.5006],
 'Bacabal':[-4.2286,-44.7911],'Santa Inês':[-3.6658,-45.3800],
 /* ── GOIÁS ── */
 'Goiânia':[-16.6799,-49.2550],'Aparecida de Goiânia':[-16.8236,-49.2444],
 'Anápolis':[-16.3281,-48.9528],'Rio Verde':[-17.7983,-50.9272],
 'Luziânia':[-16.2539,-47.9494],'Águas Lindas de Goiás':[-15.7447,-48.2817],
 'Valparaíso de Goiás':[-16.0692,-47.9936],'Trindade':[-16.6514,-49.4889],
 'Formosa':[-15.5361,-47.3339],'Novo Gama':[-16.0558,-48.0339],
 /* ── MINAS GERAIS ── */
 'Belo Horizonte':[-19.9167,-43.9345],'Uberlândia':[-18.9186,-48.2772],
 'Contagem':[-19.9317,-44.0536],'Juiz de Fora':[-21.7642,-43.3503],
 'Betim':[-19.9678,-44.1983],'Montes Claros':[-16.7353,-43.8647],
 'Ribeirão das Neves':[-19.7678,-44.0858],'Uberaba':[-19.7481,-47.9314],
 'Governador Valadares':[-18.8511,-41.9494],'Ipatinga':[-19.4678,-42.5372],
 'Sete Lagoas':[-19.4661,-44.2461],'Divinópolis':[-20.1383,-44.8844],
 'Santa Luzia':[-19.7700,-43.8511],'Ibirité':[-20.0172,-44.0578],
 'Poços de Caldas':[-21.7883,-46.5614],'Patos de Minas':[-18.5783,-46.5183],
 'Pouso Alegre':[-22.2300,-45.9367],'Teófilo Otoni':[-17.8569,-41.5053],
 /* ── SÃO PAULO ── */
 'São Paulo':[-23.5505,-46.6333],'Guarulhos':[-23.4628,-46.5333],
 'Campinas':[-22.9056,-47.0608],'São Bernardo do Campo':[-23.6914,-46.5647],
 'Santo André':[-23.6614,-46.5383],'Ribeirão Preto':[-21.1775,-47.8103],
 'Osasco':[-23.5322,-46.7919],'Sorocaba':[-23.5017,-47.4581],
 'Mauá':[-23.6678,-46.4614],'São José dos Campos':[-23.1794,-45.8869],
 'Santos':[-23.9608,-46.3333],'Mogi das Cruzes':[-23.5228,-46.1878],
 'Diadema':[-23.6861,-46.6228],'Jundiaí':[-23.1897,-46.8983],
 'Carapicuíba':[-23.5231,-46.8350],'Bauru':[-22.3147,-49.0608],
 'Piracicaba':[-22.7253,-47.6492],'São Vicente':[-23.9608,-46.3983],
 'Itaquaquecetuba':[-23.4869,-46.3483],'Franca':[-20.5386,-47.4014],
 'Praia Grande':[-24.0058,-46.4028],'Guarujá':[-23.9928,-46.2558],
 'Taubaté':[-23.0208,-45.5558],'Limeira':[-22.5642,-47.4014],
 'Suzano':[-23.5422,-46.3119],'São Carlos':[-22.0097,-47.8908],
 'Sumaré':[-22.8208,-47.2669],'Taboão da Serra':[-23.6108,-46.7561],
 'Indaiatuba':[-23.0900,-47.2156],'Cotia':[-23.6033,-46.9186],
 'Americana':[-22.7378,-47.3331],'São José do Rio Preto':[-20.8150,-49.3797],
 /* ── RIO DE JANEIRO ── */
 'Rio de Janeiro':[-22.9068,-43.1729],'São Gonçalo':[-22.8269,-43.0539],
 'Duque de Caxias':[-22.7856,-43.3114],'Nova Iguaçu':[-22.7592,-43.4511],
 'Belford Roxo':[-22.7642,-43.3983],'Niterói':[-22.8833,-43.1044],
 'São João de Meriti':[-22.8033,-43.3719],'Petrópolis':[-22.5050,-43.1789],
 'Volta Redonda':[-22.5231,-44.1039],'Campos dos Goytacazes':[-21.7453,-41.3239],
 'Macaé':[-22.3700,-41.7869],'Itaboraí':[-22.7481,-42.8614],
 'Cabo Frio':[-22.8789,-42.0189],'Angra dos Reis':[-22.9658,-44.3183],
 'Nova Friburgo':[-22.2817,-42.5317],'Resende':[-22.4706,-44.4467],
 /* ── ESPÍRITO SANTO ── */
 'Vitória':[-20.2976,-40.2958],'Serra':[-20.1278,-40.3072],
 'Vila Velha':[-20.3297,-40.2922],'Cariacica':[-20.2633,-40.4169],
 'Cachoeiro de Itapemirim':[-20.8489,-41.1131],'Linhares':[-19.3933,-40.0642],
 'São Mateus':[-18.7150,-39.8572],'Guarapari':[-20.6733,-40.5083],
 /* ── PARANÁ ── */
 'Curitiba':[-25.4284,-49.2733],'Londrina':[-23.3106,-51.1628],
 'Maringá':[-23.4206,-51.9331],'Ponta Grossa':[-25.0944,-50.1619],
 'Cascavel':[-24.9578,-53.4550],'São José dos Pinhais':[-25.5350,-49.2083],
 'Foz do Iguaçu':[-25.5478,-54.5881],'Colombo':[-25.2928,-49.2233],
 'Guarapuava':[-25.3906,-51.4608],'Paranaguá':[-25.5208,-48.5083],
 /* ── SANTA CATARINA ── */
 'Florianópolis':[-27.5954,-48.5480],'Joinville':[-26.3044,-48.8456],
 'Blumenau':[-26.9194,-49.0661],'São José':[-27.5942,-48.6353],
 'Criciúma':[-28.6778,-49.3700],'Chapecó':[-27.1006,-52.6156],
 'Itajaí':[-26.9078,-48.6617],'Jaraguá do Sul':[-26.4856,-49.0711],
 /* ── RIO GRANDE DO SUL ── */
 'Porto Alegre':[-30.0346,-51.2177],'Caxias do Sul':[-29.1678,-51.1794],
 'Pelotas':[-31.7717,-52.3425],'Canoas':[-29.9181,-51.1833],
 'Santa Maria':[-29.6839,-53.8069],'Gravataí':[-29.9439,-50.9919],
 'Viamão':[-30.0811,-51.0228],'Novo Hamburgo':[-29.6781,-51.1306],
 'São Leopoldo':[-29.7600,-51.1492],'Rio Grande':[-32.0350,-52.0986],
 /* ── MATO GROSSO DO SUL ── */
 'Campo Grande':[-20.4428,-54.6460],'Dourados':[-22.2211,-54.8053],
 'Três Lagoas':[-20.7861,-51.7028],'Corumbá':[-19.0089,-57.6528],
 /* ── MATO GROSSO ── */
 'Cuiabá':[-15.5989,-56.0949],'Várzea Grande':[-15.6469,-56.1300],
 'Rondonópolis':[-16.4708,-54.6350],'Sinop':[-11.8608,-55.5008],
 /* ── RONDÔNIA / ACRE / AMAZONAS ── */
 'Porto Velho':[-8.7612,-63.9004],'Ji-Paraná':[-10.8803,-61.9522],
 'Rio Branco':[-9.9754,-67.8249],'Manaus':[-3.1190,-60.0217],
 'Parintins':[-2.6278,-56.7358],
 /* ── PARÁ / AMAPÁ ── */
 'Belém':[-1.4558,-48.4902],'Ananindeua':[-1.3658,-48.3753],
 'Santarém':[-2.4428,-54.7083],'Marabá':[-5.3681,-49.1178],
 'Macapá':[0.0349,-51.0694],
 /* ── TOCANTINS ── */
 'Palmas':[-10.2128,-48.3603],'Araguaína':[-7.1919,-48.2072],
 /* ── RORAIMA ── */
 'Boa Vista':[2.8235,-60.6758],
 /* ── DISTRITO FEDERAL ── */
 'Brasília':[-15.7797,-47.9297],'Taguatinga':[-15.8333,-48.0667],
 'Ceilândia':[-15.8139,-48.1083],'Samambaia':[-15.8750,-48.0667]
};

var _execMapTipoColor = {
 'Telhados':'#28B548',
 'Steel Frame':'#8B5CF6',
 'Modular':'#2563EB',
 'Solar':'#F59E0B',
 'Solo':'#F59E0B',
 'Carport':'#F59E0B',
 'Laje':'#F59E0B',
 'LSF':'#8B5CF6',
 'Light Steel Frame':'#8B5CF6'
};
var _execMapTipoOrder = ['Telhados','Steel Frame','Modular','Solar'];

function _execGeocodeCity(cidade) {
 if (!cidade) return null;
 var key = cidade.trim();
 if (_execGeocodesBR[key]) return _execGeocodesBR[key];
 var keys = Object.keys(_execGeocodesBR);
 for (var i=0; i<keys.length; i++) {
  if (key.toLowerCase().indexOf(keys[i].toLowerCase()) !== -1 || keys[i].toLowerCase().indexOf(key.toLowerCase()) !== -1) {
   return _execGeocodesBR[keys[i]];
  }
 }
 return null;
}

function _execSecMapaObras(ctx) {
 var legendaHtml = _execMapTipoOrder.map(function(t){
  var c = _execMapTipoColor[t] || '#6B7280';
  return '<div style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--muted);white-space:nowrap">'
   +'<span style="width:10px;height:10px;border-radius:50%;background:'+c+';display:inline-block;flex-shrink:0;box-shadow:0 0 0 1.5px '+c+'40,0 1px 3px rgba(0,0,0,.15)"></span>'+t+'</div>';
 }).join('');
 legendaHtml += '<div style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--muted);white-space:nowrap">'
  +'<span style="width:10px;height:10px;border-radius:50%;background:#6B7280;display:inline-block;flex-shrink:0;box-shadow:0 0 0 1.5px #6B728040,0 1px 3px rgba(0,0,0,.15)"></span>Outros</div>';

 return '<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden">'
  +'<div style="padding:14px 18px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">'
  +'<div style="display:flex;align-items:center;gap:10px">'
  +'<div style="width:28px;height:28px;border-radius:7px;background:linear-gradient(135deg,#1B1B8F,#2563EB);display:flex;align-items:center;justify-content:center;flex-shrink:0">'
  +'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="3"/><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>'
  +'</div>'
  +'<div><div style="font-size:13px;font-weight:600;color:var(--text)">Distribuição Geográfica de Obras</div>'
  +'<div style="font-size:11px;color:var(--muted)" id="exec-map-count">Carregando...</div></div>'
  +'</div>'
  +'<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">'+legendaHtml+'</div>'
  +'</div>'
  +'<div id="exec-obras-map" style="height:420px"></div>'
  +'</div>';
}

function _execGetTipoColor(tipo) {
 if (!tipo) return '#6B7280';
 var keys = Object.keys(_execMapTipoColor);
 for (var k=0; k<keys.length; k++) {
  if (tipo.toLowerCase().indexOf(keys[k].toLowerCase()) !== -1 || keys[k].toLowerCase().indexOf(tipo.toLowerCase()) !== -1)
   return _execMapTipoColor[keys[k]];
 }
 return '#6B7280';
}

function _execRenderMap(obras) {
 if (typeof L === 'undefined') return;
 var el = document.getElementById('exec-obras-map');
 if (!el) return;

 if (_execMapInstance) { try { _execMapInstance.remove(); } catch(e){} _execMapInstance = null; }

 var map = L.map('exec-obras-map', {
  zoomControl:true, scrollWheelZoom:false,
  attributionControl:true
 });
 _execMapInstance = map;

 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom:18
 }).addTo(map);

 var _mapEtapasAtivas = ['Projeto aprovado','Em Andamento','Pós-vendas','Pós-venda','Concluído','Concluido'];

 var pontos = [];
 var obrasEtapaAtiva = 0;
 var obrasComCidade = 0;
 var semCidadeCadastrada = 0;
 var cidadeNaoMapeada = [];

 obras.forEach(function(o) {
  if (_mapEtapasAtivas.indexOf(o.etapa_negocio) === -1) return;
  obrasEtapaAtiva++;
  if (!o.cidade) { semCidadeCadastrada++; return; }
  var coords = _execGeocodeCity(o.cidade);
  if (!coords) { cidadeNaoMapeada.push(o.cidade); return; }
  obrasComCidade++;

  var tipos = (Array.isArray(o.tipo_obra) && o.tipo_obra.length) ? o.tipo_obra : ['Outros'];
  var tipoLabel = tipos[0];
  var color = _execGetTipoColor(tipoLabel);
  var empNome = o.empresa_id ? (_execDash.empresaMap[o.empresa_id] || '') : '';

  var circle = L.circleMarker(coords, {
   radius:5, fillColor:color, color:'#ffffff', weight:1.5,
   fillOpacity:0.9, opacity:1
  });

  var tiposBadges = tipos.map(function(t){
   return '<span style="background:'+_execGetTipoColor(t)+'22;color:'+_execGetTipoColor(t)+';font-size:10px;font-weight:600;padding:1px 6px;border-radius:10px;border:1px solid '+_execGetTipoColor(t)+'44">'+t+'</span>';
  }).join(' ');

  var nomeExib = (o.nome && o.nome !== '(sem nome)') ? o.nome : ('Obra em ' + (o.cidade||'—'));
  circle.bindTooltip('<strong>' + nomeExib + '</strong>', {direction:'top', offset:[0,-4], className:'exec-map-tip'});
  circle.bindPopup(
   '<div style="font-family:\'Segoe UI\',Arial,sans-serif;min-width:160px;padding:2px 0">'
   +'<div style="font-size:13px;font-weight:600;color:#1a1a2e;margin-bottom:4px;line-height:1.3">'+nomeExib+'</div>'
   +'<div style="margin-bottom:5px">'+tiposBadges+'</div>'
   +'<div style="font-size:11px;color:#555;display:flex;align-items:center;gap:4px">'
   +'<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>'
   +(o.cidade||'')+(o.estado ? ' — '+o.estado : '')+'</div>'
   +(empNome ? '<div style="font-size:11px;color:#888;margin-top:2px">'+empNome+'</div>' : '')
   +'</div>',
   {maxWidth:240, className:'exec-map-popup'}
  );
  circle.addTo(map);
  pontos.push(coords);
 });

 if (pontos.length > 0) {
  map.fitBounds(pontos, {padding:[28,28], maxZoom:10});
 } else {
  map.setView([-10.9,-37.05], 7);
 }

 var countEl = document.getElementById('exec-map-count');
 if (countEl) {
  var pct = obrasEtapaAtiva > 0 ? Math.round(obrasComCidade / obrasEtapaAtiva * 100) : 0;
  var naoMapeadasUnicas = cidadeNaoMapeada.filter(function(c,i,a){ return a.indexOf(c)===i; });

  var html = '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:2px">'
   + '<div style="display:flex;align-items:center;gap:5px">'
   + '<span style="width:8px;height:8px;border-radius:50%;background:#28B548;display:inline-block"></span>'
   + '<span style="font-size:11px;color:var(--text);font-weight:600">' + obrasComCidade + ' obras mapeadas</span>'
   + '<span style="font-size:11px;color:var(--muted)">(' + pct + '% do total)</span>'
   + '</div>';

  if (semCidadeCadastrada > 0) {
   html += '<div style="display:flex;align-items:center;gap:5px">'
    + '<span style="width:8px;height:8px;border-radius:50%;background:#9CA3AF;display:inline-block"></span>'
    + '<span style="font-size:11px;color:var(--muted)">' + semCidadeCadastrada + ' sem cidade cadastrada</span>'
    + '</div>';
  }

  if (naoMapeadasUnicas.length > 0) {
   var tooltip = naoMapeadasUnicas.slice(0,15).join(', ') + (naoMapeadasUnicas.length > 15 ? '...' : '');
   html += '<div style="display:flex;align-items:center;gap:5px" title="Cidades não encontradas: ' + tooltip + '">'
    + '<span style="width:8px;height:8px;border-radius:50%;background:#F59E0B;display:inline-block"></span>'
    + '<span style="font-size:11px;color:var(--muted);cursor:help;border-bottom:1px dashed var(--muted)">'
    + naoMapeadasUnicas.length + ' cidade' + (naoMapeadasUnicas.length!==1?'s':'') + ' não reconhecida' + (naoMapeadasUnicas.length!==1?'s':'') + '</span>'
    + '</div>';
  }

  html += '</div>';
  countEl.innerHTML = html;
 }
}

// ── ORQUESTRADOR — monta a página completa ──────────────────────────────────
function _execDashRender() {
 if (!_execDash.loaded) return;
 var el = document.getElementById('exec-dash-content');
 if (!el) return;
 var ctx = _execBuildCtx();

 var html = '<div style="display:flex;flex-direction:column;gap:18px">';
 html += _execSecFinanceiro(ctx);
 html += _execSecPrevisao(ctx);
 html += _execSecSegmentacao(ctx);
 html += _execSecObras(ctx);
 html += _execSecMapaObras(ctx);
 html += _execSecProjetos(ctx);
 html += _execSecEntregasInstalacoes(ctx);
 html += _execSecAlertas(ctx);
 html += '</div>';
 el.innerHTML = html;
 setTimeout(function(){ _execRenderMap(ctx.obras); }, 50);

 var sub = document.getElementById('exec-dash-sub');
 if (sub) {
  var partes = [];
  if (ctx.segmento) partes.push('Segmento: '+ctx.segmento);
  if (ctx.clienteId) partes.push('Cliente: '+(_execDash.empresaMap[ctx.clienteId]||ctx.clienteId));
  if (ctx.statusObra) partes.push('Status: '+ctx.statusObra);
  sub.textContent = 'Visão geral · '+_execPeriodLabel(ctx.periodo)+(partes.length?' · '+partes.join(' · '):'')+' · Atualizado agora';
 }
}
