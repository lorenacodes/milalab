// ═══════════════════════════════════════════════════════════════════════════════
// SIDE PANEL — componente genérico do painel lateral (drawer). O dispatcher
// _spRender decide qual renderer específico chamar por entidade (_spObras,
// _spProjetos, _spEmpresas, etc. — cada um no seu próprio módulo).
// ═══════════════════════════════════════════════════════════════════════════════
// ── Pilha de navegação ─────────────────────────────────────────────────────
// Pedido explícito (2 rodadas): abrir um Projeto/Empresa/Contato/etc. de
// dentro do painel de OUTRA entidade (ex.: Obra → Projeto) não pode
// "perder" a entidade de origem. A 1ª tentativa foi um botão "‹ Voltar"
// separado — a usuária esperava que o "Fechar"/× de sempre já fizesse
// isso (fechar o Projeto = reaparecer na Obra de onde ele foi aberto), não
// um botão novo. Por isso closePanel() agora É a navegação de volta: com
// pilha não vazia, desempilha e reabre a entidade anterior em vez de
// fechar o drawer inteiro; só fecha de verdade quando a pilha esvazia
// (voltou até a raiz de onde a navegação começou).
// _spCurrentSection/_spCurrentId rastreiam o que está aberto agora;
// _spNavStack guarda de onde se veio. `row.isConnected` é o que distingue
// as duas origens de _spOpen: uma <tr> REAL da tabela (isConnected=true,
// clique direto do usuário) sempre começa uma navegação "do zero" e reseta
// a pilha; uma <tr> SINTÉTICA (isConnected=false, criada por
// _spOpenEntityById/closePanel só pra transportar o id) é uma navegação
// por dentro de outro painel e já gerencia a pilha ela mesma — sem essa
// distinção, _spOpenEntityById chamando _spOpen internamente apagaria a
// pilha que acabou de empilhar.
var _spNavStack = [];
var _spCurrentSection = null;
var _spCurrentId = null;

function _spOpen(section, row) {
 if (_spRow) _spRow.classList.remove('sp-active');
 _spRow = row;
 row.classList.add('sp-active');
 const ov = document.getElementById('sp-overlay');
 const dr = document.getElementById('sp-drawer');
 ov.classList.add('sp-open');
 dr.classList.add('sp-open');
 if (row.isConnected) _spNavStack = [];
 // Marcado ANTES de _spRender (não depois): alguns renderers de destino
 // (_spObraById/_spEntregaById) chamam _spTrackDirectOpen elas mesmas pra
 // cobrir quando são acionadas direto por Kanban/calendário — se
 // _spCurrentSection/_spCurrentId só fossem atualizados DEPOIS de
 // _spRender rodar, essa chamada interna ainda veria os valores da
 // entidade ANTERIOR e resetaria a pilha que _spOpenEntityById acabou de
 // empilhar um instante atrás.
 _spCurrentSection = section;
 _spCurrentId = row.dataset.id || null;
 _spRender(section, row);
 document.addEventListener('keydown', _spEsc, {once:true});
}

function _spEsc(e) { if (e.key === 'Escape') closePanel(); }

// Usado por TODOS os "fechar" do painel (× do cabeçalho, botão "Fechar" de
// cada entidade, Esc, clique no overlay) — mesma função de sempre, agora
// ciente da pilha.
function closePanel() {
 if (_spNavStack.length) {
  var anterior = _spNavStack.pop();
  var row = document.createElement('tr');
  row.dataset.id = anterior.id;
  _spOpen(anterior.section, row);
  return;
 }
 document.getElementById('sp-overlay').classList.remove('sp-open');
 document.getElementById('sp-drawer').classList.remove('sp-open');
 if (_spRow) { _spRow.classList.remove('sp-active'); _spRow = null; }
 _spCurrentSection = null; _spCurrentId = null;
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
 // Painel já aberto mostrando outra entidade → empilha ela antes de trocar,
 // pra o "Fechar" desta nova entidade voltar pra ela (ver comentário da
 // pilha acima de _spOpen/closePanel).
 var drawerAberto = document.getElementById('sp-drawer')?.classList.contains('sp-open');
 if (drawerAberto && _spCurrentSection && _spCurrentId) {
  _spNavStack.push({ section: _spCurrentSection, id: _spCurrentId });
 }
 var row = document.createElement('tr');
 row.dataset.id = id;
 _spOpen(section, row);
}

// Algumas entidades (Obra, Entrega) têm renderers "XById" (_spObraById,
// _spEntregaById) chamados DIRETO por card de Kanban/evento de calendário/
// botão "Abrir" da tabela — abrem o overlay/drawer sozinhos, sem passar por
// _spOpen. Isso deixava _spCurrentSection/_spCurrentId nunca atualizados
// nesses casos: abrir uma Obra pelo Kanban e depois um Projeto de dentro
// dela não empilhava nada (_spOpenEntityById via de checar
// _spCurrentSection/_spCurrentId, que continuavam null), então "Fechar" o
// Projeto fechava tudo em vez de voltar pra Obra — o bug relatado
// continuava mesmo com a pilha implementada. Essas funções chamam este
// helper pra se anunciar do mesmo jeito que _spOpen já faz. Só reseta a
// pilha quando é de fato uma entidade/id NOVO — uma chamada de refresh da
// própria entidade já aberta (ex.: depois de salvar) não deve apagar a
// pilha de quem a abriu.
function _spTrackDirectOpen(section, id) {
 var mesmaEntidade = _spCurrentSection === section && String(_spCurrentId) === String(id);
 if (!mesmaEntidade) _spNavStack = [];
 _spCurrentSection = section;
 _spCurrentId = id;
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
 // Melhorias: a origem do clique aqui é um <div class="melh-card">, não uma
 // <tr> — `tds` chega vazio e o renderer busca tudo por id (ver melhorias.js).
 else if (section === 'melhorias') _spMelhorias(row, tds);
}

// ── Renderer: Empresas ──────────────────────────────────────────────────
