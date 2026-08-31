// Motivo: toast centraliza feedback visual de sucesso/erro sem depender de alert()
// Entrada + saída suaves (antes só a saída existia — o toast simplesmente
// "aparecia" na tela). rAF entre o append e o estado final: o navegador
// precisa pintar o estado inicial (opacity:0, deslocado) pelo menos uma vez
// antes da mudança de estilo dar o transition — sem isso o toast já nasce
// no estado final e a transição não roda.
function _showToast(msg, tipo) {
 var t = document.createElement('div');
 var bg = tipo === 'erro' ? '#f38ba8' : '#1F8A4C';
 var fg = tipo === 'erro' ? '#1e1e2e' : '#fff';
 t.style = 'position:fixed;bottom:20px;right:20px;padding:10px 18px;border-radius:8px;'
  + 'font-size:13px;font-weight:600;z-index:9999;opacity:0;transform:translateY(6px);'
  + 'transition:opacity var(--dur-base,.18s) var(--ease-standard,ease),transform var(--dur-base,.18s) var(--ease-standard,ease);'
  + 'background:' + bg + ';color:' + fg + ';box-shadow:0 4px 16px rgba(0,0,0,.22)';
 t.textContent = msg;
 document.body.appendChild(t);
 requestAnimationFrame(function(){ t.style.opacity = '1'; t.style.transform = 'translateY(0)'; });
 setTimeout(function(){
  t.style.opacity = '0'; t.style.transform = 'translateY(6px)';
  setTimeout(function(){ t.remove(); }, 220);
 }, 2600);
}

// ── Botão "carregando" ───────────────────────────────────────────────────
// Reaproveitável por qualquer tela: desabilita o botão, guarda o conteúdo
// original e troca por um spinner + texto ("Salvando...", "Criando..."). O
// spinner reaproveita o @keyframes spin que já existe em main.css (mesmo
// usado no loading de PDF de obras.js) — nenhuma animação nova criada.
// _btnIdle desfaz e restaura o texto original. Puramente visual: quem chama
// continua responsável por decidir QUANDO chamar (antes/depois do await),
// nenhuma lógica de negócio muda.
function _btnBusy(el, textoOcupado) {
 if (!el || el.dataset.busy) return;
 el.dataset.busy = '1';
 el.dataset.textoOriginal = el.innerHTML;
 el.disabled = true;
 el.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin .6s linear infinite;vertical-align:-2px;margin-right:5px"><path d="M12 2a10 10 0 0 1 10 10"/></svg>' + (textoOcupado || 'Processando...');
}
function _btnIdle(el) {
 if (!el || !el.dataset.busy) return;
 el.disabled = false;
 el.innerHTML = el.dataset.textoOriginal || el.innerHTML;
 delete el.dataset.busy;
 delete el.dataset.textoOriginal;
}

// _upperCaseInput — força caixa alta enquanto o usuário digita (pedido
// explícito: Nome de Obra/Projeto/Instalação sempre em maiúsculas,
// independente de como a pessoa digitou). toUpperCase() não muda o
// tamanho da string, então o cursor não pula — só precisa ser restaurado
// porque reatribuir .value por padrão joga o cursor pro fim do campo.
function _upperCaseInput(el) {
 if (!el) return;
 var start = el.selectionStart, end = el.selectionEnd;
 el.value = (el.value || '').toUpperCase();
 if (start != null) el.setSelectionRange(start, end);
}

// _siteInputHTML — campo de URL (Site da empresa) com botão de abrir
// direto ao lado (pedido explícito: clicar deve levar direto pro site,
// não só mostrar o texto da URL). Usado em todo campo "Site"/URL de
// Empresa do sistema — padrão único, não um componente por tela.
function _siteInputHTML(id, value, extraOninput) {
 var esc = (value || '').replace(/"/g, '&quot;');
 var oninput = "_siteBtnUpdate('" + id + "')" + (extraOninput ? ';' + extraOninput : '');
 return '<div style="display:flex;gap:6px;align-items:center">'
  + '<input class="sp-inp" id="' + id + '" type="url" placeholder="https://..." value="' + esc + '" style="flex:1" oninput="' + oninput + '">'
  + '<button type="button" id="' + id + '-open" class="btn btn-ghost btn-sm" onclick="_siteOpen(\'' + id + '\')" title="Abrir site" style="flex-shrink:0;padding:6px 10px' + (value ? '' : ';display:none') + '">↗</button>'
  + '</div>';
}
function _siteBtnUpdate(id) {
 var el = document.getElementById(id);
 var btn = document.getElementById(id + '-open');
 if (btn) btn.style.display = (el && el.value.trim()) ? '' : 'none';
}
function _siteOpen(id) {
 var el = document.getElementById(id);
 var v = (el && el.value || '').trim();
 if (!v) return;
 var url = /^https?:\/\//i.test(v) ? v : 'https://' + v;
 window.open(url, '_blank', 'noopener');
}
