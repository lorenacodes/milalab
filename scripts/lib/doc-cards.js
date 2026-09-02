// ═══════════════════════════════════════════════════════════════════════════
// CARDS DE ANEXO EM GRADE — componente compartilhado por qualquer aba de
// detalhe que anexe documentos (Entregas/Projetos/Instalações...). Pedido
// explícito: usar EXATAMENTE o mesmo padrão em todo lugar, em vez de cada
// módulo reinventar seu próprio dropzone/lista. Ver .doc-card-* em main.css.
//
// Cada card: rótulo + miniaturas (imagem real via signed URL em lote, ou
// ícone de arquivo genérico SVG pra PDF/outros — nenhum emoji em lugar
// nenhum do sistema, regra explícita) + nome do arquivo sempre visível +
// um link "+ Anexar" opcional. O card inteiro aceita arrastar-e-soltar
// (não precisa clicar em "+ Anexar"), com highlight de borda durante o
// drag (classe .drag, alternada pelo próprio HTML gerado — ver
// _dcDragAttrs). Delete por anexo (removeJs) é opcional: só passe quando o
// documento for editável por aquela tela — espelhos somente-leitura de
// outra tabela (ex.: documentos da Obra dentro do painel de Entrega) nunca
// devem receber removeJs, pra não ganhar um botão de excluir que não
// deveriam ter.
// ═══════════════════════════════════════════════════════════════════════════

var _DC_IMG_EXT = ['jpg','jpeg','png','gif','webp'];
function _dcExt(nome) {
 var m = /\.([a-z0-9]+)$/i.exec(String(nome || '').trim());
 return m ? m[1].toLowerCase() : '';
}

// Assina em lote só os anexos que são imagem (PDF/outros não têm como
// virar thumbnail no cliente sem uma lib pesada nova — ganham o ícone
// genérico). `bucketFn(doc)` resolve o bucket de storage de cada
// documento (alguns módulos misturam buckets, ex. acervo migrado do
// Airtable x uploads novos).
async function _dcSignedUrlMap(docs, bucketFn) {
 var byBucket = {};
 docs.forEach(function(d) {
  if (!d.caminho_storage) return;
  if (_DC_IMG_EXT.indexOf(_dcExt(d.nome || d.nome_arquivo || d.arquivo_nome)) === -1) return;
  var b = bucketFn(d);
  (byBucket[b] = byBucket[b] || []).push(d.caminho_storage);
 });
 var map = {};
 if (!_sb) return map;
 await Promise.all(Object.keys(byBucket).map(async function(b) {
  var res = await _sb.storage.from(b).createSignedUrls(byBucket[b], 3600);
  if (!res.error) (res.data || []).forEach(function(s) { if (s.signedUrl && s.path) map[b + '|' + s.path] = s.signedUrl; });
 }));
 return map;
}

var _DC_FILE_ICON_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.6"><path d="M14 2H7a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>';

function _dcThumbHTML(d, bucket, signedMap, onclickJs, removeJs) {
 var nome = (d.nome || d.nome_arquivo || d.arquivo_nome || 'Documento').toString();
 var url = d.caminho_storage ? signedMap[bucket + '|' + d.caminho_storage] : null;
 var box = url
  ? '<img src="' + url + '" alt="" loading="lazy">'
  : _DC_FILE_ICON_SVG;
 return '<div class="doc-card-thumb" title="' + nome.replace(/"/g,'&quot;') + '">'
  + '<div class="doc-card-thumb-box" onclick="' + onclickJs + '">' + box
  + (removeJs ? '<button type="button" class="doc-card-thumb-rm" title="Excluir anexo" onclick="event.stopPropagation();' + removeJs + '">&times;</button>' : '')
  + '</div>'
  + '<div class="doc-card-thumb-name">' + nome.replace(/</g,'&lt;') + '</div>'
  + '</div>';
}

function _dcCardHTML(label, docs, thumbsHtmlList, addHtml, extraAttrs) {
 var body = docs.length
  ? '<div class="doc-card-thumbs">' + thumbsHtmlList.join('') + '</div>'
  : '<div class="doc-card-empty">Nenhum anexo</div>';
 return '<div class="doc-card"' + (extraAttrs || '') + '>'
  + '<div class="doc-card-label">' + label + (docs.length ? ' (' + docs.length + ')' : '') + '</div>'
  + body + (addHtml || '') + '</div>';
}

// Link "+ Anexar" + <input type=file> escondido (label envolve o input —
// mesmo truque já usado no resto do sistema pra driblar a regra global
// `.mf input[type="file"]{display:none}`, main.css).
function _dcAddHTML(inputId, labelId, onChangeJs) {
 return '<label class="doc-card-add" for="' + inputId + '"><span id="' + labelId + '">+ Anexar</span></label>'
  + '<input type="file" id="' + inputId + '" multiple style="display:none" onchange="' + onChangeJs + '">';
}

// Atributos de arrastar-e-soltar pro wrapper .doc-card — `dropJs` é a
// expressão JS chamada no drop (recebe o `event` implícito).
function _dcDragAttrs(dropJs) {
 return ' ondragover="event.preventDefault();this.classList.add(\'drag\')"'
  + ' ondragleave="this.classList.remove(\'drag\')"'
  + ' ondrop="this.classList.remove(\'drag\');' + dropJs + '"';
}
