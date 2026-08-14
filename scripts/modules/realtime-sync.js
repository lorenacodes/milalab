// ── Sync em tempo real dos vínculos N:N (contatos_empresas/empresas_obras/
// contatos_obras) ──────────────────────────────────────────────────────────
// Pedido explícito: desvincular empresa↔obra ou empresa↔contato em uma aba/
// sessão só se refletia em outra depois de um F5 — as correções anteriores
// (_empUnlink chamando _cttRefreshRowFromDB/_dbLoadObras) resolvem só quando
// QUEM fez a ação está olhando pra tela certa; não ajuda se a mudança veio de
// outra aba aberta, outro usuário, ou um caminho de código que não chama
// esses refreshes manuais. Aqui é o Supabase Realtime de verdade: assina
// mudanças nessas 3 tabelas de junção (INSERT/UPDATE/DELETE) via
// postgres_changes e re-sincroniza o cache local afetado sempre que alguém
// mexe nelas, em qualquer aba/sessão.
//
// As 3 tabelas precisaram ser adicionadas à publication supabase_realtime
// (migração add_junction_tables_to_realtime_publication) — só empresas/
// contatos/obras/etc já vinham com replicação ligada por padrão; tabelas de
// junção não.
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

 // Refetch só do contato afetado (não a lista inteira de ~700) — mesma
 // função já usada por _cttUnlinkEmpresa; se o painel desse contato estiver
 // aberto, também atualiza os chips "Empresas vinculadas" na hora.
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
  // Se o painel de uma Obra estiver aberto e for justamente a afetada, o
  // próprio _dbLoadObras não reabre o painel — mas os campos buscáveis de
  // Empresa/Contato já refletem o estado local assim que o usuário reabrir.
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
