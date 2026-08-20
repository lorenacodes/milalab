// Tempo real genérico: reaproveita o canal postgres_changes do Supabase
// (já usado em dashboard.js pros badges) pra qualquer módulo que precise
// recarregar sua lista sozinho quando a tabela mudar no banco — sem exigir
// que o usuário recarregue a página. Debounce evita recarregar várias vezes
// em sequência quando o sync do Airtable grava um lote de registros de uma vez.
var _rtChannels  = {};
var _rtCallbacks = {}; // table -> [reloadFn, ...] — vários módulos podem observar a mesma tabela

// Cada tabela tem UM canal só. Chamar _rtWatch de novo pra uma tabela que já
// tem canal (ex.: Gestor de Tarefas e Meu Painel observando 'atividades')
// só acrescenta o novo reloadFn à lista — antes, a 2ª chamada recriava o
// canal e descartava o callback da 1ª, deixando um dos dois módulos sem
// atualização em tempo real.
function _rtWatch(table, reloadFn, debounceMs) {
 if (!_rtCallbacks[table]) _rtCallbacks[table] = [];
 _rtCallbacks[table].push(reloadFn);
 if (_rtChannels[table]) return _rtChannels[table]; // canal já existe, só somou o callback
 var timer = null;
 var trigger = function () {
  clearTimeout(timer);
  timer = setTimeout(function () {
   _rtCallbacks[table].forEach(function (fn) { try { fn(); } catch (e) {} });
  }, debounceMs || 1200);
 };
 _rtChannels[table] = _sb
  .channel('rt-' + table)
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: table }, trigger)
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: table }, trigger)
  .on('postgres_changes', { event: 'DELETE', schema: 'public', table: table }, trigger)
  .subscribe();
 return _rtChannels[table];
}

// ── Vínculos N:N (contatos_empresas/empresas_obras/contatos_obras) ─────────
// Não usa _rtWatch acima de propósito: um reload cego (recarregar as ~700
// linhas de Contatos ou ~640 de Empresas) a cada vínculo criado/removido em
// QUALQUER obra/empresa seria um desperdício e reintroduziria a lentidão já
// corrigida antes (ver _obrasCarregarPropostaMap). Aqui o payload do
// postgres_changes já traz contato_id/empresa_id/obra_id — dá pra atualizar
// só o registro afetado (_cttRefreshRowFromDB, já usado por
// _cttUnlinkEmpresa) em vez de recarregar tudo.
//
// Pedido explícito: desvincular empresa↔obra ou empresa↔contato em uma aba/
// sessão só se refletia em outra depois de um F5 — as correções pontuais
// (_empUnlink chamando _cttRefreshRowFromDB/_dbLoadObras) resolvem só quando
// QUEM fez a ação está olhando pra tela certa; não ajuda se a mudança veio de
// outra aba, outro usuário, ou um caminho de código que esqueça de chamar
// esses refreshes manuais.
//
// As 3 tabelas precisaram ser adicionadas à publication supabase_realtime
// (migração add_junction_tables_to_realtime_publication) — só empresas/
// contatos/obras/atividades/etc já vinham com replicação ligada por padrão;
// tabelas de junção não.
(function() {
 if (typeof _sb === 'undefined' || !_sb || typeof _sb.channel !== 'function') return;

 function debounce(fn, ms) {
  var timers = {};
  return function(key) {
   var args = arguments;
   if (timers[key]) clearTimeout(timers[key]);
   timers[key] = setTimeout(function(){ fn.apply(null, args); }, ms);
  };
 }

 // Refetch só do contato afetado (não a lista inteira) — mesma função já
 // usada por _cttUnlinkEmpresa; se o painel desse contato estiver aberto,
 // também atualiza os chips "Empresas vinculadas" na hora.
 var syncContato = debounce(function(contatoId) {
  if (typeof _cttRefreshRowFromDB === 'function') _cttRefreshRowFromDB(contatoId);
  if (typeof _spCttCurrentId !== 'undefined' && String(_spCttCurrentId) === String(contatoId)
   && typeof _cttRenderEmpresasVinculadas === 'function') {
   _cttRenderEmpresasVinculadas();
  }
 }, 300);

 // Se o painel dessa empresa estiver aberto, re-renderiza a linha inteira
 // (recarrega "Obras vinculadas"/"Contatos vinculados" junto).
 var syncEmpresaPanel = debounce(function(empresaId) {
  if (typeof _spEmpCurrentId === 'undefined' || String(_spEmpCurrentId) !== String(empresaId)) return;
  var row = document.querySelector('#emp-tbody tr[data-id="' + empresaId + '"]');
  if (row && typeof _spEmpresas === 'function') _spEmpresas(row, []);
 }, 300);

 // Empresa/Contato de Obra afetam a lista (colunas Empresa/Contato) e o
 // Kanban — recarrega os dois. Debounced com uma chave fixa: várias
 // mudanças em sequência (ex.: trocar de empresa) viram só 1 reload.
 var syncObras = debounce(function() {
  if (typeof _dbLoadObras === 'function') _dbLoadObras();
  if (typeof _dbLoadObrasKanban === 'function') _dbLoadObrasKanban();
 }, 300);

 function _rtRowOf(payload) {
  return (payload.new && Object.keys(payload.new).length) ? payload.new : payload.old;
 }

 _sb.channel('vinculos-realtime')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'contatos_empresas' }, function(payload) {
   var row = _rtRowOf(payload);
   if (!row) return;
   syncContato(row.contato_id);
   syncEmpresaPanel(row.empresa_id);
  })
  .on('postgres_changes', { event: '*', schema: 'public', table: 'empresas_obras' }, function(payload) {
   var row = _rtRowOf(payload);
   if (!row) return;
   syncObras('obras');
   syncEmpresaPanel(row.empresa_id);
  })
  .on('postgres_changes', { event: '*', schema: 'public', table: 'contatos_obras' }, function(payload) {
   var row = _rtRowOf(payload);
   if (!row) return;
   syncObras('obras');
   syncContato(row.contato_id);
  })
  .subscribe();
})();
