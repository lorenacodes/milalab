// Tempo real genérico: reaproveita o canal postgres_changes do Supabase
// (já usado em dashboard.js pros badges) pra qualquer módulo que precise
// recarregar sua lista sozinho quando a tabela mudar no banco — sem exigir
// que o usuário recarregue a página. Debounce evita recarregar várias vezes
// em sequência quando o sync do Airtable grava um lote de registros de uma vez.
var _rtChannels = {};

function _rtWatch(table, reloadFn, debounceMs) {
 if (_rtChannels[table]) { try { _sb.removeChannel(_rtChannels[table]); } catch (e) {} }
 var timer = null;
 var trigger = function () {
  clearTimeout(timer);
  timer = setTimeout(reloadFn, debounceMs || 1200);
 };
 _rtChannels[table] = _sb
  .channel('rt-' + table)
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: table }, trigger)
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: table }, trigger)
  .on('postgres_changes', { event: 'DELETE', schema: 'public', table: table }, trigger)
  .subscribe();
 return _rtChannels[table];
}
