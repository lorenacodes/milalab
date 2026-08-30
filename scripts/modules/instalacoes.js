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
 // Vocabulário real (mesmo campo do Airtable original, confirmado por
 // print da usuária) — a lista antiga (Programado/Planejado/Em andamento/
 // Finalizado/Cancelado) tinha 3 valores que nunca existiram nos dados
 // reais e faltava "Emitir boleto de medição", que existe.
 { key: 'funil',   label: 'Status',  type: 'select', options: ['A programar','Programado','Emitir boleto de medição','Em execução','Finalizado'] },
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

// Agrupar — mesmo esquema de Obras/Projetos (opera sobre <tr> já existentes
// no DOM; ver comentário completo em _obrasRenderGroupNode, obras.js).
var _instGbFields = [
 { key: 'funil',   label: 'Status' },
 { key: 'tipo',    label: 'Tipo' },
 { key: 'obra',    label: 'Obra' },
 { key: 'cliente', label: 'Cliente' },
];
_gbInit('instalacoes', _instGbFields, _instApplyFilters, 3);
// Lista em memória das instalações carregadas (antes este módulo não tinha
// cache nenhum: a listagem era montada direto num `allData` local e qualquer
// atualização exigia recarregar tudo do banco). É o que permite o tempo real
// e o autosave redesenharem só a <tr> alterada.
var _instArr = [];
var _instGroupCollapsed = {};
function _instToggleGroup(key) {
 _instGroupCollapsed[key] = !_instGroupCollapsed[key];
 _instApplyFilters();
}
function _instRenderGroupNode(node, path, tbody, forceHidden) {
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
  var isCollapsed = !!_instGroupCollapsed[pathKey];
  var visCount = _gtTreeCount(child, function(tr){ return tr.style.display !== 'none'; });
  var indent = 12 + path.length * 20;
  var hd = document.createElement('tr');
  hd.className = _gtGroupClass(path.length) + ' inst-group-row';
  hd.style.position = 'static';
  hd.onclick = function(){ _instToggleGroup(pathKey); };
  hd.style.display = (forceHidden || !visCount) ? 'none' : '';
  hd.innerHTML = '<td colspan="9" style="padding-left:' + indent + 'px">'
   + '<span style="margin-right:4px">' + (isCollapsed ? '▶' : '▼') + '</span>'
   + '<strong>' + (k || '—') + '</strong>'
   + _gtCountBadgeHTML(visCount)
   + '</td>';
  tbody.appendChild(hd);
  _instRenderGroupNode(child, nodePath, tbody, forceHidden || isCollapsed);
 });
}

function _instApplyFilters() {
 var buscaNorm = _ssNormalize(((document.getElementById('inst-search') || {}).value || '').trim());
 var activeConds = _fbInstances.instalacoes.state.conditions.filter(_fbConditionIsUsable).length;
 // Remove cabeçalhos de grupo da renderização anterior antes de reconsultar
 // as linhas — eles não têm data-id, então não entram no seletor abaixo.
 Array.prototype.slice.call(document.querySelectorAll('#inst-tbody tr.inst-group-row')).forEach(function(tr){ tr.remove(); });
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
  var groupLevels = (_gbInstances.instalacoes && _gbInstances.instalacoes.state.levels) || [];
  if (groupLevels.length) {
   var tree = _gtBuildTree(rows, groupLevels, function(tr, field) {
    return { key: tr.dataset[field] || 'Sem valor', sortKey: null };
   }, null, 0);
   _instRenderGroupNode(tree, [], tbody, false);
  } else {
   rows.forEach(function(tr) { tbody.appendChild(tr); });
  }
 }
 var fbBadge = document.getElementById('fb-badge-instalacoes');
 if (fbBadge) { fbBadge.textContent = activeConds; fbBadge.style.display = activeConds ? '' : 'none'; }
 var countEl = document.getElementById('inst-filter-count');
 if (countEl) {
  if (activeConds || buscaNorm) { countEl.textContent = visivel + (visivel === 1 ? ' resultado' : ' resultados'); countEl.style.display = 'inline'; }
  else { countEl.style.display = 'none'; }
 }
}

// Reescrito (pedido explícito, congruente com o Airtable) — a versão
// antiga lia os campos de tds[N].innerText (texto já formatado da linha
// da TABELA cheia de Instalações). Bug real: qualquer entrada que não
// viesse de um <tr> de verdade (ex.: o card de Instalação dentro do
// detalhamento de Obra, que abre via _spOpenEntityById → uma <tr> FAKE
// sem nenhuma célula) tinha tds vazio — o painel abria sem nenhuma
// informação. Agora busca por id, com todos os relacionamentos reais
// (mesmo padrão de _spObraById/_spProjetoRender).
function _spInstalacoes(row, tds) {
 _spInstalacaoById(row.dataset.id);
}

// Cores de identidade — mesmo mapa de _dbLoadInstalacoes acima, cópia
// local (não é global em nenhum dos dois lugares).
var _instStatusCls = { 'Finalizado':'bg', 'Em execução':'bm', 'Emitir boleto de medição':'by', 'Programado':'by', 'A programar':'bp' };
var _instAtiva = null; // instalação atualmente aberta no painel (autosave lê daqui)

// Rótulos de campo — servem à mensagem de conflito (concurrency.js) e ao
// Histórico (historico.js). Rótulo null = campo técnico, fora do histórico.
var _INSTALACAO_CAMPO_LABEL = {
 tipo_servico: 'Tipo de Serviço', funil: 'Status', data_inicio: 'Data início',
 data_fim: 'Data fim', dias_executados: 'Nº dias executados', detalhes: 'Detalhes',
 numero: 'Número', obra_id: null,
};
if (typeof _ccRegistrarLabels === 'function') _ccRegistrarLabels('instalacoes', _INSTALACAO_CAMPO_LABEL);
var _instDetEquipeSel = [];
var _instEquipesCacheDet = null;

async function _spInstalacaoById(id) {
 if (!id) return;
 _spSet('Instalação', 'Carregando...', '<div style="padding:40px;text-align:center;color:var(--muted)">Buscando dados...</div>', '');
 document.getElementById('sp-overlay').classList.add('sp-open');
 document.getElementById('sp-drawer').classList.add('sp-open');
 if (typeof _spTrackDirectOpen === 'function') _spTrackDirectOpen('instalacoes', id);
 if (!_sb) return;
 // obras_instalacoes/instalacoes_equipe — as duas relações N:N de verdade
 // (Instalação pode ter várias Obras, igual ao Airtable — decisão
 // confirmada com a usuária; e várias Equipes, já existente).
 var res = await _sb.from('instalacoes')
  .select('*, obras_instalacoes(obra:obra_id(id,nome,cidade,estado)), instalacoes_equipe(equipe:equipe_id(id,nome))')
  .eq('id', id).single();
 if (res.error || !res.data) {
  _spSet('Instalação', 'Erro', '<div style="color:var(--red);padding:20px">Instalação não encontrada.</div>', '');
  return;
 }
 _spInstalacaoRender(res.data);
}

function _spInstalacaoRender(inst) {
 _instAtiva = inst;
 var obras = (inst.obras_instalacoes || []).map(function(x){ return x.obra; }).filter(Boolean);
 var equipes = (inst.instalacoes_equipe || []).map(function(x){ return x.equipe; }).filter(Boolean);
 // Cidade/Estado — rollup das Obras vinculadas (mesmo espírito do rollup
 // de Cidade/Estado no detalhamento de Projeto) — com várias obras
 // possíveis aqui, mostra a lista única de valores, não só o 1º.
 var cidades = Array.from(new Set(obras.map(function(o){ return o.cidade; }).filter(Boolean)));
 var estados = Array.from(new Set(obras.map(function(o){ return o.estado; }).filter(Boolean)));
 var diasProgramados = (inst.data_inicio && inst.data_fim)
  ? Math.round((new Date(inst.data_fim) - new Date(inst.data_inicio)) / 86400000)
  : null;
 // Fórmula pedida explicitamente (igual ao campo fórmula do Airtable):
 // "{ID sequencial} - {Categoria do Serviço} - {Obra}". `numero` é a
 // coluna nova (SERIAL, migração add_instalacoes_numero_sequencial) —
 // preenchida por ordem de created_at pras 125 instalações já existentes,
 // automática (nextval) pra qualquer instalação nova. Nome montado aqui
 // no client, não fica armazenado — evita ficar desatualizado se
 // tipo_servico ou a(s) obra(s) vinculada(s) mudar(em) depois.
 var titulo = (inst.numero != null ? inst.numero : '?') + ' - ' + (inst.tipo_servico || 'Instalação') + ' - ' + (obras.length ? obras.map(function(o){ return o.nome; }).join(', ') : '(sem obra)');

 _srchSelRegister('instDetTipo', {
  options: ['Instalação','Montagem fábrica','Treinamento piloto','Assistência técnica'],
  placeholder: 'Selecione...', onSelect: function(){ _instScheduleAutoSave(); },
 });
 _srchSelRegister('instDetStatus', {
  options: ['A programar','Programado','Emitir boleto de medição','Em execução','Finalizado'],
  placeholder: 'Selecione...', onSelect: function(){ _instScheduleAutoSave(); },
 });
 _srchSelRegister('instDetObraAdd', {
  options: function(){ return (_obraIdMap ? Object.keys(_obraIdMap).map(function(oid){ return { id: oid, label: _obraIdMap[oid].nome }; }) : []).map(function(o){ return o.label; }); },
  placeholder: 'Buscar obra pra vincular...',
  onSelect: function(nomeEscolhido) {
   var oid = null;
   if (typeof _obraIdMap !== 'undefined') {
    oid = Object.keys(_obraIdMap).find(function(k){ return _obraIdMap[k].nome === nomeEscolhido; });
   }
   if (oid) _instObraVincular(oid);
  },
 });

 var html = `
  <input type="hidden" id="sp-inst-id" value="${inst.id}">
  <div class="spt-bar">
   <button class="spt-btn active" data-target="spt-inst-geral" onclick="_sptSwitch('inst-geral',this)">Visão Geral</button>
   <button class="spt-btn" data-target="spt-inst-historico" onclick="_sptSwitch('inst-historico',this)">Histórico</button>
  </div>
  <div class="spt-panel" id="spt-inst-geral">
  <div class="sp-field"><div class="sp-label">Tipo de Serviço <span class="req">*</span></div>${_srchSelMarkup('instDetTipo', 'sp-inst-tipo', inst.tipo_servico || '')}</div>
  <div class="sp-field"><div class="sp-label">Status <span class="req">*</span></div>${_srchSelMarkup('instDetStatus', 'sp-inst-status', inst.funil || '')}</div>
  <div class="sp-g2">
   <div class="sp-field"><div class="sp-label">Data início <span class="req">*</span></div><input class="sp-inp" id="sp-inst-inicio" type="date" value="${inst.data_inicio || ''}" onchange="_instScheduleAutoSave()"></div>
   <div class="sp-field"><div class="sp-label">Data fim <span class="req">*</span></div><input class="sp-inp" id="sp-inst-fim" type="date" value="${inst.data_fim || ''}" onchange="_instScheduleAutoSave()"></div>
  </div>
  <div class="sp-g2">
   <div class="sp-field"><div class="sp-label">Nº dias programados</div><input class="sp-inp" value="${diasProgramados != null ? diasProgramados : '—'}" readonly title="Automático — diferença entre Data início e Data fim"></div>
   <div class="sp-field"><div class="sp-label">Nº dias executados</div><input class="sp-inp" id="sp-inst-dias-exec" type="number" min="0" value="${inst.dias_executados != null ? inst.dias_executados : ''}" onchange="_instScheduleAutoSave()"></div>
  </div>
  <div class="sp-g2">
   <div class="sp-field"><div class="sp-label">Cidade (das Obras)</div><input class="sp-inp" value="${cidades.length ? cidades.join(', ') : '—'}" readonly></div>
   <div class="sp-field"><div class="sp-label">Estado (das Obras)</div><input class="sp-inp" value="${estados.length ? estados.join(', ') : '—'}" readonly></div>
  </div>
  <div class="sp-field"><div class="sp-label">Detalhes</div><textarea class="sp-inp" id="sp-inst-detalhes" rows="1" style="resize:none;overflow:hidden;min-height:34px" oninput="this.style.height='auto';this.style.height=(this.scrollHeight)+'px';_instScheduleAutoSave()">${inst.detalhes || ''}</textarea></div>

  <div class="sp-stitle">Equipe de Instalação <span class="req">*</span></div>
  <div id="sp-inst-equipe-dd" class="no-msel-wide"><div style="font-size:12px;color:var(--muted);padding:8px 0">Carregando...</div></div>

  <div class="sp-stitle" style="display:flex;align-items:center;justify-content:space-between">
   <span>Obras vinculadas</span>
   <button type="button" class="btn btn-ghost" style="padding:2px 8px;font-size:11px" onclick="_instObraAddToggle()">+ Vincular</button>
  </div>
  <div id="sp-inst-obra-add" style="display:none;margin-bottom:8px">${_srchSelMarkup('instDetObraAdd', 'sp-inst-obra-add-hidden', '')}</div>
  <div id="sp-inst-obras-chips" class="sp-rel-chips-wrap">${
   obras.length
    ? obras.map(function(o){ return _spRelChipHTML('obras', o.id, o.nome || '—', null, '_instObraDesvincular(\'' + inst.id + '\',\'' + o.id + '\')'); }).join('')
    : '<div class="sp-empty">Nenhuma obra vinculada.</div>'
  }</div>
  </div>
  <div class="spt-panel" id="spt-inst-historico">
   <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:10px">Histórico de alterações</div>
   ${typeof _histPanelHTML === 'function' ? _histPanelHTML('sp-inst-historico') : ''}
  </div>
 `;

 // Exclusão disponível pra qualquer usuário (RLS de `instalacoes` já é
 // aberta a qualquer autenticado, sem restrição adicional pedida) —
 // mesmo padrão de Projeto. CASCADE no banco já limpa obras_instalacoes/
 // instalacoes_equipe/documentos_instalacoes sozinho.
 _spSet('Instalação', titulo, html,
  '<button class="btn btn-ghost" style="color:var(--red);border-color:var(--red);margin-right:auto" onclick="_spExcluirInstalacao(\'' + inst.id + '\',\'' + titulo.replace(/'/g,"\\'") + '\')">Excluir instalação</button> '
  + '<button class="btn btn-ghost" onclick="closePanel()">Fechar</button>');

 // Baseline da trava otimista: o registro como veio do banco na abertura do
 // painel (ver concurrency.js). É contra ele que _ccSave decide o que mandar.
 if (typeof _ccSetBaseline === 'function') _ccSetBaseline('instalacoes', inst.id, inst);
 if (typeof _rtLimparAvisoExterno === 'function') _rtLimparAvisoExterno();
 if (typeof _sptInitScrollSpy === 'function') _sptInitScrollSpy();
 if (typeof _histCarregar === 'function') _histCarregar('sp-inst-historico', 'instalacoes', inst.id);

 _instDetEquipeSel = equipes.map(function(e){ return e.nome; });
 _instCarregarEquipesCacheDet().then(function(){
  var dd = document.getElementById('sp-inst-equipe-dd');
  if (dd) dd.innerHTML = _instDetEquipeDropdownHTML();
 });
}

async function _instCarregarEquipesCacheDet() {
 if (_instEquipesCacheDet) return;
 var res = await _sb.from('equipe_instalacao').select('id,nome').order('nome');
 _instEquipesCacheDet = res.data || [];
}
function _instDetEquipeDropdownHTML() {
 var opcoes = (_instEquipesCacheDet || []).map(function(e){ return e.nome; });
 return _msRenderDropdown('instDetEquipe', opcoes, _instDetEquipeSel, '_instDetEquipeToggle', 'Selecione a(s) equipe(s)...');
}
// Toggle persiste na hora (insert/delete direto em instalacoes_equipe) —
// diferente do formulário de CRIAÇÃO (obras.js), que só grava tudo junto
// no fim; aqui a instalação já existe, então cada clique já é uma
// alteração de verdade, mesmo espírito do autosave do resto do sistema.
async function _instDetEquipeToggle(campo, valor, checked) {
 if (!_instAtiva) return;
 var equipe = (_instEquipesCacheDet || []).find(function(e){ return e.nome === valor; });
 if (!equipe) return;
 // Equipe de Instalação é obrigatória (mesma regra do formulário de
 // criação, obras.js) — não deixa desmarcar a última pessoa restante.
 if (!checked && _instDetEquipeSel.length <= 1) {
  _showToast('Equipe de Instalação é obrigatória — mantenha ao menos 1 pessoa.', 'erro');
  return;
 }
 _instDetEquipeSel = _msToggle(_instDetEquipeSel, valor, checked);
 var dd = document.getElementById('sp-inst-equipe-dd');
 if (dd) dd.innerHTML = _instDetEquipeDropdownHTML();
 if (typeof _noReabrirDropdown === 'function') _noReabrirDropdown('sp-inst-equipe-dd');
 if (checked) {
  var insRes = await _sb.from('instalacoes_equipe').insert({ instalacao_id: _instAtiva.id, equipe_id: equipe.id });
  if (insRes.error) console.error('[Instalações] erro ao vincular equipe:', insRes.error);
 } else {
  var delRes = await _sb.from('instalacoes_equipe').delete().eq('instalacao_id', _instAtiva.id).eq('equipe_id', equipe.id);
  if (delRes.error) console.error('[Instalações] erro ao desvincular equipe:', delRes.error);
 }
}

function _instObraAddToggle() {
 var box = document.getElementById('sp-inst-obra-add');
 if (box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
}
async function _instObraVincular(obraId) {
 if (!_instAtiva) return;
 var res = await _sb.from('obras_instalacoes').insert({ obra_id: obraId, instalacao_id: _instAtiva.id });
 if (res.error) { _showToast('Erro ao vincular obra: ' + _supaErrPt(res.error.message), 'erro'); return; }
 _showToast('Obra vinculada.', 'ok');
 _spInstalacaoById(_instAtiva.id);
}
async function _instObraDesvincular(instalacaoId, obraId) {
 if (!confirm('Desvincular esta obra da instalação?\n\nNão apaga a obra nem a instalação, só remove o vínculo entre as duas.')) return;
 var res = await _sb.from('obras_instalacoes').delete().eq('instalacao_id', instalacaoId).eq('obra_id', obraId);
 if (res.error) { _showToast('Erro ao desvincular: ' + _supaErrPt(res.error.message), 'erro'); return; }
 _spInstalacaoById(instalacaoId);
}

// Autosave (mesmo espírito de _obraScheduleAutoSave/_spSaveObraFull,
// obras.js: debounce de 700ms, sem botão "Salvar").
var _instAutoSaveTimer = null;
function _instScheduleAutoSave() {
 if (_instAutoSaveTimer) clearTimeout(_instAutoSaveTimer);
 _instAutoSaveTimer = setTimeout(function(){ _spSalvarInstalacaoFull(); }, 700);
}
async function _spSalvarInstalacaoFull() {
 if (_instAutoSaveTimer) { clearTimeout(_instAutoSaveTimer); _instAutoSaveTimer = null; }
 var id = document.getElementById('sp-inst-id')?.value;
 if (!id || !_sb) return;
 var elTipo = document.getElementById('sp-inst-tipo');
 var elStatus = document.getElementById('sp-inst-status');
 var elInicio = document.getElementById('sp-inst-inicio');
 var elFim = document.getElementById('sp-inst-fim');
 // Mesmos 4 campos obrigatórios do formulário de CRIAÇÃO (Nova Instalação,
 // obras.js) — levantamento de campos obrigatórios encontrou que aqui, no
 // autosave do detalhamento, dava pra limpar qualquer um deles e salvar
 // null sem aviso nenhum, mesmo com o asterisco de obrigatório no rótulo.
 // Ignora só o(s) campo(s) esvaziado(s) (devolve o valor anterior) em vez
 // de recusar a alteração inteira — permite salvar o resto normalmente
 // mesmo se um dado legado já estiver sem um desses valores.
 var payload = {
  tipo_servico: elTipo?.value || null,
  funil: elStatus?.value || null,
  data_inicio: elInicio?.value || null,
  data_fim: elFim?.value || null,
  dias_executados: document.getElementById('sp-inst-dias-exec')?.value !== '' ? Number(document.getElementById('sp-inst-dias-exec')?.value) : null,
  detalhes: document.getElementById('sp-inst-detalhes')?.value?.trim() || null,
  // updated_at NÃO é mais mandado daqui: quem mantém essa coluna é o trigger
  // trg_instalacoes_updated_at (set_updated_at) no banco, e é exatamente ela
  // que _ccSave usa como trava otimista. Um valor forjado pelo cliente aqui
  // seria sobrescrito pelo trigger de qualquer jeito e só atrapalharia o diff.
 };
 var faltando = [];
 if (!payload.tipo_servico) { faltando.push('Tipo de Serviço'); delete payload.tipo_servico; if (_instAtiva && typeof _srchSelSelectItem === 'function') _srchSelSelectItem('instDetTipo', _instAtiva.tipo_servico || ''); }
 if (!payload.funil) { faltando.push('Status'); delete payload.funil; if (_instAtiva && typeof _srchSelSelectItem === 'function') _srchSelSelectItem('instDetStatus', _instAtiva.funil || ''); }
 if (!payload.data_inicio) { faltando.push('Data início'); delete payload.data_inicio; if (elInicio && _instAtiva) elInicio.value = _instAtiva.data_inicio || ''; }
 if (!payload.data_fim) { faltando.push('Data fim'); delete payload.data_fim; if (elFim && _instAtiva) elFim.value = _instAtiva.data_fim || ''; }
 if (faltando.length) _showToast('Campo obrigatório: ' + faltando.join(', ') + '. Alteração não foi salva.', 'erro');
 if (!Object.keys(payload).length) return;

 // Controle de concorrência (ver concurrency.js): antes daqui saía o payload
 // INTEIRO a cada pausa de digitação, então dois usuários na mesma instalação
 // se atropelavam — quem salvasse por último regravava os valores que tinha na
 // tela desde antes por cima do trabalho do outro, sem aviso. Agora só os
 // campos que ESTE usuário mexeu vão pro banco.
 var r = await _ccSaveComFeedback('instalacoes', id, payload, {
  toastOk: false, // autosave silencioso: só fala quando dá problema
  onRecarregar: function () {
   // Conflito ou merge automático: relê do banco e redesenha o painel com os
   // valores certos (aqui o registro precisa dos joins de obra/equipe, então
   // recarrega pelo caminho normal em vez de aplicar a linha crua).
   if (String((_instAtiva || {}).id) === String(id)) _spInstalacaoById(id);
  },
 });
 if (!r || r.conflito || r.erro || r.excluido || r.semMudanca) return;
 if (_instAtiva && String(_instAtiva.id) === String(id)) Object.assign(_instAtiva, r.row || payload);
 _instPatchNaLista(r.row || payload, id);
}

async function _spExcluirInstalacao(id, nome) {
 if (!confirm('Excluir "' + (nome || 'esta instalação') + '" PERMANENTEMENTE?\n\nVínculos com obras/equipes/documentos desta instalação também serão excluídos. Esta ação não pode ser desfeita.')) return;
 var res = await _sb.from('instalacoes').delete().eq('id', id);
 if (res.error) {
  // Detalhe técnico só no console; o usuário lê português.
  console.error('[Instalações] erro ao excluir:', res.error);
  _showToast('Não foi possível excluir esta instalação. Nada foi alterado.', 'erro');
  return;
 }
 closePanel();
 if (typeof _dbLoadInstalacoes === 'function') _dbLoadInstalacoes();
}

async function _dbLoadInstalacoes() {
 var tbody = document.getElementById('inst-tbody');
 if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--muted)">Carregando...</td></tr>';
 try {
  var allData = []; var from = 0;
  while (true) {
   // obras_instalacoes/instalacoes_equipe — as duas relações N:N de
   // verdade (Instalação pode ter várias Obras, igual ao Airtable —
   // decisão confirmada com a usuária; e várias Equipes). Coluna "Equipe"
   // era hardcoded "—" antes, nunca tinha sido ligada de verdade a nenhum
   // dado; "Obra"/"Cliente" liam só de instalacoes.obra_id, que só guarda
   // 1 obra — ver _spInstalacaoById abaixo pro detalhamento completo.
   // updated_at é obrigatório aqui: é a coluna que _ccSave usa como trava
   // otimista (concurrency.js) e que alimenta o baseline do painel.
   var res = await _sb.from('instalacoes')
    .select('id, numero, detalhes, tipo_servico, funil, data_inicio, data_fim, dias_executados, updated_at, obras_instalacoes(obra:obra_id(nome, empresas_obras(empresa:empresa_id(nome)))), instalacoes_equipe(equipe:equipe_id(nome))')
    .order('data_inicio', { ascending: false })
    .range(from, from + 999);
   if (res.error) throw new Error(res.error.message);
   allData = allData.concat(res.data || []);
   if (!res.data || res.data.length < 1000) break;
   from += 1000;
  }
  _instArr = allData;
  // Badge do menu lateral: ver _navBadgesLoadInitial() (RPC de contagem no
  // boot) — antes só era preenchido aqui, ou seja, só depois que o usuário
  // abrisse a aba Instalações pelo menos uma vez (bug relatado).
  // Tempo real POR LINHA (_instInitRealtime): o _rtWatch que estava aqui
  // recarregava a lista inteira a cada alteração de qualquer instalação, o que
  // apagava filtro/agrupamento/scroll de quem estivesse olhando a tela.
  _instInitRealtime();
  if (!tbody) return;
  if (!allData.length) {
   tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--muted)">Nenhuma instalação encontrada.</td></tr>';
   return;
  }
  tbody.innerHTML = allData.map(_instRowHTML).join('');
 } catch(e) {
  // Mensagem técnica fica só no console; o usuário lê português.
  console.error('[Instalações] erro ao carregar a lista:', e);
  if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--red)">Não foi possível carregar as instalações agora. Tente recarregar a página.</td></tr>';
 }
}

// Uma instalação → uma <tr>. Extraído do corpo de _dbLoadInstalacoes pra que o
// tempo real consiga redesenhar SÓ a linha alterada (mesmo padrão de
// _obraRowHTML/_entRowHTML), em vez de recarregar a lista inteira e derrubar o
// filtro/agrupamento/scroll de quem está olhando.
function _instRowHTML(inst) {
 var funilCls = { 'Finalizado':'bg', 'Em execução':'bm', 'Emitir boleto de medição':'by', 'Programado':'by', 'A programar':'bp' };
 var obrasLigadas = (inst.obras_instalacoes || []).map(function(x){ return x.obra; }).filter(Boolean);
 var obraNome = obrasLigadas.length ? obrasLigadas.map(function(o){ return o.nome; }).join(', ') : '—';
 var clienteNome = '—';
 try { clienteNome = obrasLigadas[0].empresas_obras[0].empresa.nome || '—'; } catch(e) {}
 var tipo = inst.tipo_servico || '—';
 var equipeNomes = (inst.instalacoes_equipe || []).map(function(x){ return x.equipe && x.equipe.nome; }).filter(Boolean).join(', ') || '—';
 var funil = inst.funil || '—';
 var cls = funilCls[funil] || 'bm';
 var fmtDate = function(d) {
  if (!d) return '<span style="color:var(--border)">—</span>';
  var p = d.split('-'); return p[2]+'/'+p[1]+'/'+p[0].slice(2);
 };
 var dias = inst.dias_executados != null ? inst.dias_executados : (inst.data_inicio && inst.data_fim ? Math.round((new Date(inst.data_fim)-new Date(inst.data_inicio))/86400000) : '—');
 // Nome/"Instalação" segue a fórmula pedida explicitamente (igual ao
 // Airtable): "{ID sequencial} - {Categoria do Serviço} - {Obra}".
 var nomeInst = (inst.numero != null ? inst.numero : '?') + ' - ' + (tipo !== '—' ? tipo : 'Instalação') + ' - ' + (obraNome !== '—' ? obraNome : '(sem obra)');
 return '<tr onclick="if(!event.target.closest(\'button,a,input,select\'))_spOpen(\'instalacoes\',this)" data-id="'+inst.id+'" data-funil="'+funil+'"'
  +' data-tipo="'+(tipo!=='—'?tipo:'')+'" data-obra="'+(obraNome!=='—'?obraNome.replace(/"/g,'&quot;'):'')+'" data-cliente="'+(clienteNome!=='—'?clienteNome.replace(/"/g,'&quot;'):'')+'"'
  +' data-inicio="'+(inst.data_inicio||'')+'" data-fim="'+(inst.data_fim||'')+'" data-dias="'+(typeof dias==='number'?dias:0)+'">'
  + '<td style="font-weight:500">' + nomeInst + '</td>'
  + '<td style="color:var(--muted);font-size:12px">' + clienteNome + '</td>'
  + '<td>' + (tipo !== '—' ? '<span class="badge bg">'+tipo+'</span>' : '<span style="color:var(--border)">—</span>') + '</td>'
  + '<td style="font-size:12px;color:var(--muted)">' + equipeNomes + '</td>'
  + '<td style="font-size:12px;color:var(--muted)">' + fmtDate(inst.data_inicio) + '</td>'
  + '<td style="font-size:12px;color:var(--muted)">' + fmtDate(inst.data_fim) + '</td>'
  + '<td style="text-align:center;font-size:12px">' + dias + '</td>'
  + '<td><span class="badge '+cls+'">'+funil+'</span></td>'
  + '<td><button class="btn btn-ghost btn-sm">Ver &rarr;</button></td>'
  + '</tr>';
}

// Aplica no array em memória a linha alterada (save próprio ou tempo real) e
// redesenha só a <tr> dela. Preserva os joins (obras/equipes), que o payload
// do postgres_changes não traz.
function _instPatchNaLista(patch, idExplicito) {
 if (!patch) return;
 var id = idExplicito || patch.id;
 if (!id) return;
 var idx = (_instArr || []).findIndex(function (x) { return String(x.id) === String(id); });
 if (idx === -1) return;
 Object.keys(patch).forEach(function (k) {
  if (k === 'obras_instalacoes' || k === 'instalacoes_equipe') return;
  _instArr[idx][k] = patch[k];
 });
 var tr = document.querySelector('#inst-tbody tr[data-id="' + id + '"]');
 if (tr) tr.outerHTML = _instRowHTML(_instArr[idx]);
 if (typeof _instApplyFilters === 'function') _instApplyFilters();
}

// Tempo real por linha. Substitui o _rtWatch antigo (que recarregava a lista
// INTEIRA a cada alteração de qualquer instalação, apagando filtro e scroll de
// quem estivesse olhando). A chave 'instalacoes' faz _rtWatchRows substituir o
// handler anterior em vez de acumular um novo a cada visita à aba.
function _instInitRealtime() {
 if (typeof _rtWatchRows !== 'function') return;
 _rtWatchRows('instalacoes', 'instalacoes', {
  onUpdate: function (nova) {
   if (!nova || !nova.id) return;
   _instPatchNaLista(nova);
   if (String((_instAtiva || {}).id) === String(nova.id)
    && document.getElementById('sp-drawer')?.classList.contains('sp-open')
    && typeof _rtAvisoAlteracaoExterna === 'function') {
    // instalacoes não tem coluna de "quem alterou" — a faixa sai sem nome,
    // que _rtAvisoAlteracaoExterna já trata como "Outro usuário".
    _rtAvisoAlteracaoExterna(null, "_spInstalacaoById('" + nova.id + "')");
    if (typeof _ccSetBaseline === 'function') _ccSetBaseline('instalacoes', nova.id, nova);
   }
  },
  // Instalação nova precisa dos joins de obra/equipe pra <tr> sair completa —
  // recarrega a lista só nesse caso (evento raro), nunca a cada edição.
  onInsert: function () { if (typeof _dbLoadInstalacoes === 'function') _dbLoadInstalacoes(); },
  onDelete: function (_nova, antiga) {
   var id = antiga && antiga.id;
   if (!id) return;
   var i = (_instArr || []).findIndex(function (x) { return String(x.id) === String(id); });
   if (i !== -1) _instArr.splice(i, 1);
   var tr = document.querySelector('#inst-tbody tr[data-id="' + id + '"]');
   if (tr) tr.remove();
   if (String((_instAtiva || {}).id) === String(id)) {
    _showToast('A instalação que você tinha aberta foi excluída por outro usuário.', 'erro');
    closePanel();
   }
  },
 });
}
