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
