// ═══════════════════════════════════════════════════════════════════════════════
// SIDE PANEL — componente genérico do painel lateral (drawer). O dispatcher
// _spRender decide qual renderer específico chamar por entidade (_spObras,
// _spProjetos, _spEmpresas, etc. — cada um no seu próprio módulo).
// ═══════════════════════════════════════════════════════════════════════════════
function _spOpen(section, row) {
 if (_spRow) _spRow.classList.remove('sp-active');
 _spRow = row;
 row.classList.add('sp-active');
 const ov = document.getElementById('sp-overlay');
 const dr = document.getElementById('sp-drawer');
 ov.classList.add('sp-open');
 dr.classList.add('sp-open');
 _spRender(section, row);
 document.addEventListener('keydown', _spEsc, {once:true});
}

function _spEsc(e) { if (e.key === 'Escape') closePanel(); }

function closePanel() {
 document.getElementById('sp-overlay').classList.remove('sp-open');
 document.getElementById('sp-drawer').classList.remove('sp-open');
 if (_spRow) { _spRow.classList.remove('sp-active'); _spRow = null; }
}

// ── Resize do painel lateral (arrastar borda esquerda) ────────────────────────
(function(){
 var handle  = document.getElementById('sp-resize');
 var drawer  = document.getElementById('sp-drawer');
 var _drag   = false, _startX, _startW;
 if (!handle || !drawer) return;
 handle.addEventListener('mousedown', function(e){
  _drag = true; _startX = e.clientX; _startW = drawer.offsetWidth;
  handle.classList.add('dragging');
  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'ew-resize';
  e.preventDefault();
 });
 document.addEventListener('mousemove', function(e){
  if (!_drag) return;
  var delta = _startX - e.clientX;
  var newW  = Math.max(360, Math.min(Math.round(window.innerWidth * 0.92), _startW + delta));
  drawer.style.width = newW + 'px';
  drawer.style.transition = 'none';
 });
 document.addEventListener('mouseup', function(){
  if (!_drag) return;
  _drag = false;
  handle.classList.remove('dragging');
  document.body.style.userSelect = '';
  document.body.style.cursor = '';
  drawer.style.transition = '';
  try { localStorage.setItem('milatec-sp-width', drawer.offsetWidth); } catch(e){}
 });
 // Restaura largura salva da sessão anterior
 try {
  var saved = localStorage.getItem('milatec-sp-width');
  if (saved && +saved >= 360) drawer.style.width = (+saved) + 'px';
 } catch(e){}
})();

function _spSet(tag, title, bodyHTML, actionsHTML) {
 document.getElementById('sp-tag').textContent = tag;
 document.getElementById('sp-title').textContent = title;
 document.getElementById('sp-body').innerHTML = bodyHTML;
 document.getElementById('sp-actions').innerHTML = actionsHTML || '';
}

// ── Navegação entre painéis por id (registros vinculados) ─────────────────────
// Abre o painel de detalhe de qualquer entidade a partir só do seu id, sem
// precisar de uma <tr> real na tabela — útil para chips de "registro
// vinculado" renderizados dentro do painel de OUTRA entidade (ex.: Obras
// vinculadas dentro do painel de Empresa). Funciona hoje para qualquer
// section cujo renderer já delegue para uma busca por id (ver _spObras em
// obras.js: `_spObras(row, tds) { _spObraById(row.dataset.id); }` — o mesmo
// padrão foi replicado em _spContatos, ver empresas.js). Cria uma <tr>
// "fake" (nunca anexada ao DOM) só para transportar o id pelo caminho já
// existente de _spOpen → _spRender.
function _spOpenEntityById(section, id) {
 if (!id) return;
 var row = document.createElement('tr');
 row.dataset.id = id;
 _spOpen(section, row);
}

// ── Chip de "registro vinculado" (padrão Airtable) ─────────────────────────────
// Pequeno cartão arredondado e clicável — usado para listar registros de
// OUTRA entidade dentro do painel atual (Obras/Contatos vinculados no painel
// de Empresa, por ora — ver ponto 5 do pedido: pensado para ser reaproveitado
// pelos próximos pares Obra↔Empresa/Projeto, Projeto↔Contato etc. no futuro,
// sem precisar reinventar o componente). `section` decide a cor do
// indicador (mesmas cores de badge já usadas em nt-tag-blue/nt-tag-green,
// ver styles/empresas.css) e para onde o clique navega via
// _spOpenEntityById. `sublabel` é opcional (ex.: cargo do contato).
// `onRemoveExpr` é opcional: expressão JS (string) pra um botão "×" de
// desvincular — só aparece quando passado, então as outras 6 chamadas deste
// componente (Obra→Empresa/Projeto, Projeto→Empresa, Entrega→Obra) continuam
// sem esse botão, exatamente como eram antes. Fica em cima do clique do chip
// (event.stopPropagation()), senão desvincular também abriria o registro.
var _SP_REL_CHIP_DOT = { obras: '#1d4ed8', contatos: '#15803d', projetos: '#7c3aed', empresas: '#c2410c' };
function _spRelChipHTML(section, id, label, sublabel, onRemoveExpr) {
 var dot = _SP_REL_CHIP_DOT[section] || '#8B8B94';
 var idAttr = String(id == null ? '' : id).replace(/'/g, "\\'").replace(/"/g, '&quot;');
 var labelSafe = (label || '—').replace(/</g, '&lt;');
 var titleSafe = (label || '—').replace(/"/g, '&quot;');
 return '<div class="sp-rel-chip" onclick="_spOpenEntityById(\'' + section + '\',\'' + idAttr + '\')" title="' + titleSafe + '">'
  + '<span class="sp-rel-chip-dot" style="background:' + dot + '"></span>'
  + '<span class="sp-rel-chip-label">' + labelSafe + '</span>'
  + (sublabel ? '<span class="sp-rel-chip-sub">' + sublabel + '</span>' : '')
  + (onRemoveExpr ? '<button type="button" class="sp-rel-chip-rm" title="Desvincular" onclick="event.stopPropagation();' + onRemoveExpr + '">\u00d7</button>' : '<span class="sp-rel-chip-chevron">\u203a</span>')
  + '</div>';
}

function _spRender(section, row) {
 const tds = [...row.querySelectorAll('td')];
 if (section === 'obras') _spObras(row, tds);
 else if (section === 'projetos') _spProjetos(row, tds);
 else if (section === 'entregas') _spEntregas(row, tds);
 else if (section === 'instalacoes') _spInstalacoes(row, tds);
 else if (section === 'empresas') _spEmpresas(row, tds);
 else if (section === 'contatos') _spContatos(row, tds);
}

// ── Renderer: Empresas ──────────────────────────────────────────────────
