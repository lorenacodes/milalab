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
