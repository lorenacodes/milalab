// ═══════════════════════════════════════════════════════════════════════════════
// HISTÓRICO DE ALTERAÇÕES — componente genérico (lê public.audit_log)
// ═══════════════════════════════════════════════════════════════════════════════
// audit_log já existia e já era alimentada por trigger (trg_obras_audit /
// trg_projetos_audit / trg_entregas_audit gravam dados_anteriores+dados_novos
// em TODO INSERT/UPDATE/DELETE) — mas só a Obra tinha tela pra ler isso, e o
// código do render estava embutido em obras.js, preso ao mapa de campos de
// Obra. Aqui vira um componente só, usado pelas 3 entidades: o mapa de rótulos
// de cada tabela é o MESMO já registrado em _ccRegistrarLabels (concurrency.js),
// então rótulo de conflito e rótulo de histórico nunca saem de sincronia.
//
// Até agora a policy de leitura de audit_log era só de admin
// (admins_select_audit_log) — o histórico aparecia vazio pra todo mundo mais.
// A migração concorrencia_historico_fase1 acrescentou
// authenticated_select_audit_log_negocio, liberando pra qualquer usuário
// autenticado a leitura das linhas de obras/projetos/entregas (dados que ele
// já pode ler na própria tabela); o resto do log continua restrito a admin.

// E-mail → nome de exibição, pra sair "João Silva alterou..." em vez do e-mail.
function _histNome(email) {
 if (!email) return 'Sistema';
 var u = (typeof _usuariosCache !== 'undefined' && _usuariosCache || [])
  .find(function (x) { return x.email === email; });
 return (u && u.nome_display) || email;
}

function _histFmtVal(v) {
 if (v == null || v === '') return 'vazio';
 if (Array.isArray(v)) return v.length ? v.join(', ') : 'vazio';
 if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
 if (typeof v === 'object') return JSON.stringify(v);
 var s = String(v);
 // Datas ISO puras (YYYY-MM-DD) e timestamps saem em pt-BR.
 if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.split('-').reverse().join('/');
 if (/^\d{4}-\d{2}-\d{2}T/.test(s)) { var d = new Date(s); if (!isNaN(d)) return d.toLocaleString('pt-BR'); }
 return s;
}

function _histFmtData(iso) {
 var d = new Date(iso);
 if (isNaN(d)) return '—';
 return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function _histEsc(s) {
 return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Uma entrada do log → HTML. Formato pedido explicitamente:
// "João alterou Etapa do Negócio de Orçamento para Fechado em 30/08/2026 14:22".
function _histItemHTML(tabela, row) {
 var quem = _histEsc(_histNome(row.usuario_email));
 var quando = _histFmtData(row.created_at);
 var linhas = [];

 if (row.operacao === 'INSERT') {
  linhas.push('<span><b>' + quem + '</b> criou este registro</span>');
 } else if (row.operacao === 'DELETE') {
  linhas.push('<span><b>' + quem + '</b> excluiu este registro</span>');
 } else if (row.dados_anteriores && row.dados_novos) {
  var antes = row.dados_anteriores, depois = row.dados_novos;
  var mapa = (typeof _CC_LABELS !== 'undefined' && _CC_LABELS[tabela]) || {};
  Object.keys(depois).forEach(function (k) {
   // Rótulo explicitamente null = campo técnico/de auditoria, fora do
   // histórico (senão toda alteração viraria também "updated_at mudou").
   if (mapa[k] === null) return;
   if (typeof _CC_CAMPOS_IGNORADOS !== 'undefined' && _CC_CAMPOS_IGNORADOS[k]) return;
   if (JSON.stringify(antes[k]) === JSON.stringify(depois[k])) return;
   var label = mapa[k] || k;
   linhas.push('<span><b>' + quem + '</b> alterou <b>' + _histEsc(label) + '</b> de '
    + '<span class="hist-de">' + _histEsc(_histFmtVal(antes[k])) + '</span> para '
    + '<span class="hist-para">' + _histEsc(_histFmtVal(depois[k])) + '</span></span>');
  });
  // UPDATE que só mexeu em campos técnicos não vira item nenhum.
  if (!linhas.length) return '';
 } else {
  return '';
 }

 return '<div class="hist-item">'
  + linhas.map(function (l) { return '<div class="hist-linha">' + l + '</div>'; }).join('')
  + '<div class="hist-quando">' + quando + '</div>'
  + '</div>';
}

// Carrega e desenha o histórico de UM registro dentro de um container.
// `tabela` é o nome real da tabela no Postgres ('obras'/'projetos'/'entregas'),
// que é exatamente o que o trigger grava em audit_log.tabela.
async function _histCarregar(containerId, tabela, registroId, limite) {
 var el = document.getElementById(containerId);
 if (!el || !_sb || !registroId) return;
 el.innerHTML = '<div class="sp-empty"><div style="font-size:11px;color:var(--muted)">Carregando histórico...</div></div>';
 var res = await _sb.from('audit_log')
  .select('operacao, dados_anteriores, dados_novos, usuario_email, created_at')
  .eq('tabela', tabela).eq('registro_id', registroId)
  .order('created_at', { ascending: false })
  .limit(limite || 100);
 if (res.error) {
  console.error('[Histórico] erro ao ler audit_log de ' + tabela + '/' + registroId, res.error);
  el.innerHTML = '<div class="sp-empty">Não foi possível carregar o histórico agora. Tente abrir o registro de novo.</div>';
  return;
 }
 var itens = (res.data || []).map(function (r) { return _histItemHTML(tabela, r); }).filter(Boolean);
 if (!itens.length) {
  el.innerHTML = '<div class="sp-empty">Nenhuma alteração registrada ainda.</div>';
  return;
 }
 el.innerHTML = itens.join('');
}

// Bloco HTML padrão da sub-aba "Histórico" (o container vazio; o conteúdo
// chega depois via _histCarregar, pra não segurar a abertura do painel).
function _histPanelHTML(containerId) {
 return '<div id="' + containerId + '"><div class="sp-empty"><div style="font-size:11px;color:var(--muted)">Carregando histórico...</div></div></div>';
}
