// ═══════════════════════════════════════════════════════════════════════════════
// INSTALAÇÕES — stub de criação, renderer do painel lateral, loader da lista.
// ═══════════════════════════════════════════════════════════════════════════════
function openNovaInstalacao() { alert('Modal "Nova Instalação" será implementado em breve.'); }

// Filtro/Ordenação — mesmos componentes reutilizáveis do Gestor de Tarefas/
// Obras/Empresas (filtro-builder/sort-builder/smart-search), substituindo os
// 4 chips fixos de status (Todas/Programadas/Em andamento/Concluídas) por um
// Filtro de condições de verdade. _fbEvaluate/_sbCompare recebem tr.dataset
// direto — ver data-* adicionados no template de _dbLoadInstalacoes.
var _instFbFields = [
 { key: 'funil',   label: 'Status',  type: 'select', options: ['Programado','Planejado','Em andamento','Finalizado','Cancelado'] },
 { key: 'tipo',    label: 'Tipo',    type: 'text' },
 { key: 'obra',    label: 'Obra',    type: 'text' },
 { key: 'cliente', label: 'Cliente', type: 'text' },
];
_fbInit('instalacoes', _instFbFields, _instApplyFilters);

var _instSbFields = [
 { key: 'obra',      label: 'Obra',    type: 'text' },
 { key: 'cliente',   label: 'Cliente', type: 'text' },
 { key: 'tipo',      label: 'Tipo',    type: 'text' },
 { key: 'inicio',    label: 'Início',  type: 'date' },
 { key: 'fim',       label: 'Fim',     type: 'date' },
 { key: 'dias',      label: 'Dias',    type: 'number', getValue: function(ds) { return parseFloat(ds.dias) || 0; } },
];
_sbInit('instalacoes', _instSbFields, _instApplyFilters);

function _instApplyFilters() {
 var buscaNorm = _ssNormalize(((document.getElementById('inst-search') || {}).value || '').trim());
 var activeConds = _fbInstances.instalacoes.state.conditions.filter(_fbConditionIsUsable).length;
 var rows = Array.prototype.slice.call(document.querySelectorAll('#inst-tbody tr[data-id]'));
 var visivel = 0;
 rows.forEach(function(tr) {
  var ok = _fbEvaluate(tr.dataset, 'instalacoes');
  if (ok && buscaNorm) ok = _ssMatch(_ssNormalize(tr.textContent), buscaNorm);
  tr.style.display = ok ? '' : 'none';
  if (ok) visivel++;
 });
 if (rows.length) {
  rows.sort(function(a, b) { return _sbCompare(a.dataset, b.dataset, 'instalacoes'); });
  var tbody = rows[0].parentElement;
  rows.forEach(function(tr) { tbody.appendChild(tr); });
 }
 var fbBadge = document.getElementById('fb-badge-instalacoes');
 if (fbBadge) { fbBadge.textContent = activeConds; fbBadge.style.display = activeConds ? '' : 'none'; }
 var countEl = document.getElementById('inst-filter-count');
 if (countEl) {
  if (activeConds || buscaNorm) { countEl.textContent = visivel + (visivel === 1 ? ' resultado' : ' resultados'); countEl.style.display = 'inline'; }
  else { countEl.style.display = 'none'; }
 }
}

function _spInstalacoes(row, tds) {
 const nome   = tds[0]?.innerText?.trim() || '';
 const cli    = tds[1]?.innerText?.trim() || '';
 const tipo   = tds[2]?.innerText?.trim() || '';
 const equipe = tds[3]?.innerText?.trim() || '';
 const ini    = tds[4]?.innerText?.trim() || '';
 const fim    = tds[5]?.innerText?.trim() || '';
 const dias   = tds[6]?.innerText?.trim() || '';
 const status = tds[7]?.innerText?.trim() || '';
 const html = `
  <div class="sp-field"><div class="sp-label">Instalação</div><input class="sp-inp" value="${nome}"></div>
  <div class="sp-g2">
   <div class="sp-field"><div class="sp-label">Cliente</div><input class="sp-inp" value="${cli}"></div>
   <div class="sp-field"><div class="sp-label">Tipo</div><input class="sp-inp" value="${tipo}"></div>
  </div>
  <div class="sp-g2">
   <div class="sp-field"><div class="sp-label">Equipe</div><input class="sp-inp" value="${equipe}"></div>
   <div class="sp-field"><div class="sp-label">Dias previstos</div><input class="sp-inp" value="${dias}"></div>
  </div>
  <div class="sp-g2">
   <div class="sp-field"><div class="sp-label">Início</div><input class="sp-inp" value="${ini}"></div>
   <div class="sp-field"><div class="sp-label">Fim</div><input class="sp-inp" value="${fim}"></div>
  </div>
  <div class="sp-field"><div class="sp-label">Status</div><input class="sp-inp" value="${status}"></div>
 `;
 _spSet('Instalação', nome, html,
  '<button class="btn btn-ghost" onclick="closePanel()">Fechar</button>');
}

async function _dbLoadInstalacoes() {
 var tbody = document.getElementById('inst-tbody');
 if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--muted)">Carregando...</td></tr>';
 try {
  var allData = []; var from = 0;
  while (true) {
   var res = await _sb.from('instalacoes')
    .select('id, detalhes, tipo_servico, funil, data_inicio, data_fim, dias_executados, obra_id, obra:obra_id(nome, empresas_obras(empresa:empresa_id(nome)))')
    .order('data_inicio', { ascending: false })
    .range(from, from + 999);
   if (res.error) throw new Error(res.error.message);
   allData = allData.concat(res.data || []);
   if (!res.data || res.data.length < 1000) break;
   from += 1000;
  }
  // Atualizar badge do nav
  var badge = document.getElementById('nav-badge-instalacoes');
  if (badge) badge.textContent = allData.length;
  // Tempo real: recarrega sozinho quando a tabela mudar (sync do Airtable
  // ou outro usuário editando) — sem precisar recarregar a página.
  if (typeof _rtWatch === 'function') _rtWatch('instalacoes', _dbLoadInstalacoes);
  if (!tbody) return;
  if (!allData.length) {
   tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--muted)">Nenhuma instalação encontrada.</td></tr>';
   return;
  }
  var funilCls = { 'Finalizado':'bg', 'Programado':'by', 'Em andamento':'bm', 'Planejado':'bp', 'Cancelado':'br' };
  tbody.innerHTML = allData.map(function(inst) {
   var obraNome = (inst.obra && inst.obra.nome) || '—';
   var clienteNome = '—';
   try { clienteNome = inst.obra.empresas_obras[0].empresa.nome || '—'; } catch(e) {}
   var tipo = inst.tipo_servico || '—';
   var funil = inst.funil || '—';
   var cls = funilCls[funil] || 'bm';
   var fmtDate = function(d) {
    if (!d) return '<span style="color:var(--border)">—</span>';
    var p = d.split('-'); return p[2]+'/'+p[1]+'/'+p[0].slice(2);
   };
   var dias = inst.dias_executados != null ? inst.dias_executados : (inst.data_inicio && inst.data_fim ? Math.round((new Date(inst.data_fim)-new Date(inst.data_inicio))/86400000) : '—');
   return '<tr onclick="if(!event.target.closest(\'button,a,input,select\'))_spOpen(\'instalacoes\',this)" data-id="'+inst.id+'" data-funil="'+funil+'"'
    +' data-tipo="'+(tipo!=='—'?tipo:'')+'" data-obra="'+(obraNome!=='—'?obraNome.replace(/"/g,'&quot;'):'')+'" data-cliente="'+(clienteNome!=='—'?clienteNome.replace(/"/g,'&quot;'):'')+'"'
    +' data-inicio="'+(inst.data_inicio||'')+'" data-fim="'+(inst.data_fim||'')+'" data-dias="'+(typeof dias==='number'?dias:0)+'">'
    + '<td style="font-weight:500">' + obraNome + '</td>'
    + '<td style="color:var(--muted);font-size:12px">' + clienteNome + '</td>'
    + '<td>' + (tipo !== '—' ? '<span class="badge bg">'+tipo+'</span>' : '<span style="color:var(--border)">—</span>') + '</td>'
    + '<td style="font-size:12px;color:var(--muted)">—</td>'
    + '<td style="font-size:12px;color:var(--muted)">' + fmtDate(inst.data_inicio) + '</td>'
    + '<td style="font-size:12px;color:var(--muted)">' + fmtDate(inst.data_fim) + '</td>'
    + '<td style="text-align:center;font-size:12px">' + dias + '</td>'
    + '<td><span class="badge '+cls+'">'+funil+'</span></td>'
    + '<td><button class="btn btn-ghost btn-sm">Ver &rarr;</button></td>'
    + '</tr>';
  }).join('');
 } catch(e) {
  if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--red)">Erro: '+e.message+'</td></tr>';
 }
}
