// ═══════════════════════════════════════════════════════════════════════════
// GROUP TREE — agrupamento hierárquico (N níveis) + buckets inteligentes de
// data, reutilizável por qualquer módulo (hoje usado pelo Gestor de Tarefas,
// scripts/modules/tarefas.js). Puramente lógico — não toca o DOM, então dá
// pra testar com node:test e reaproveitar em outros módulos sem duplicar
// nada, só passando uma função keyFor(item, field) diferente por módulo.
// ═══════════════════════════════════════════════════════════════════════════

// Em vez de agrupar por data exata (uma linha por dia diferente, ilegível
// com muitos registros espalhados), agrupa em faixas relativas a hoje
// enquanto fizer sentido (Hoje/Amanhã/Esta semana/Próxima semana/Este mês/
// Próximo mês) e cai pra "Mês de Ano" pra qualquer coisa mais distante
// (passado ou futuro). sortKey ordena os grupos cronologicamente — sem ele,
// a ordem seria "primeira aparição nos dados", que embaralha os baldes.
function _gtCapitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function _gtDateBucket(dateStr, todayOverride) {
 if (!dateStr) return { key: '— Sem data', sortKey: 999999 };
 var d = new Date(dateStr + 'T00:00:00');
 var today = todayOverride || new Date(); today = new Date(today); today.setHours(0,0,0,0);
 var diffDays = Math.round((d - today) / 86400000);
 var monthDiff = (d.getFullYear() - today.getFullYear()) * 12 + (d.getMonth() - today.getMonth());

 if (diffDays === 0) return { key: 'Hoje', sortKey: 0 };
 if (diffDays === 1) return { key: 'Amanhã', sortKey: 1 };
 if (diffDays === -1) return { key: 'Ontem', sortKey: -1 };

 if (diffDays > 1) {
  var dow = today.getDay();
  var daysLeftInWeek = 6 - ((dow + 6) % 7); // dias até domingo (semana atual, seg-dom)
  if (diffDays <= daysLeftInWeek) return { key: 'Esta semana', sortKey: 2 };
  if (diffDays <= daysLeftInWeek + 7) return { key: 'Próxima semana', sortKey: 3 };
  if (monthDiff === 0) return { key: 'Este mês', sortKey: 4 };
  if (monthDiff === 1) return { key: 'Próximo mês', sortKey: 5 };
  return { key: _gtCapitalize(d.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})), sortKey: 100 + monthDiff };
 }
 // diffDays < -1 (passado, além de "ontem")
 if (diffDays >= -7) return { key: 'Semana passada', sortKey: -2 };
 if (monthDiff === -1) return { key: 'Mês passado', sortKey: -3 };
 return { key: _gtCapitalize(d.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})), sortKey: -1000 - monthDiff };
}

// Constrói a árvore de agrupamento recursivamente, um nível por vez. Nó
// folha: { leaf:true, items:[...] }. Nó de grupo: { leaf:false, field,
// order:[chaves na ordem de exibição], children:{chave: nó} }.
// keyForFn(item, field) -> {key, sortKey} — cada módulo define como cada
// campo vira chave (ex.: Gestor de Tarefas trata "responsavel" agrupando
// por lista de nomes, ou "data_prazo" chamando _gtDateBucket).
// fixedOrders: { field: [chaves em ordem fixa] } — opcional, pra campos
// onde a ordem não deve depender de "primeira aparição nos dados" nem de
// sortKey (ex.: Individual/Coletiva sempre nessa ordem).
function _gtBuildTree(items, levels, keyForFn, fixedOrders, levelIdx) {
 levelIdx = levelIdx || 0;
 if (levelIdx >= levels.length) return { leaf: true, items: items };
 var field = levels[levelIdx].field;
 var buckets = {}, order = [];
 items.forEach(function(a) {
  var kd = keyForFn(a, field);
  if (!buckets[kd.key]) { buckets[kd.key] = { items: [], sortKey: kd.sortKey }; order.push(kd.key); }
  buckets[kd.key].items.push(a);
 });
 var hasSortKey = order.length && buckets[order[0]].sortKey !== null && buckets[order[0]].sortKey !== undefined;
 if (hasSortKey) {
  order.sort(function(x,y){ return buckets[x].sortKey - buckets[y].sortKey; });
 } else if (fixedOrders && fixedOrders[field]) {
  var fixed = fixedOrders[field];
  order = fixed.filter(function(k){ return buckets[k]; }).concat(order.filter(function(k){ return fixed.indexOf(k) === -1; }));
 } else {
  // Sem sortKey nem ordem fixa: ordem alfabética (pt-BR) como base, em vez
  // de "primeira aparição nos dados" (que embaralha os grupos à toa) — só
  // assim o controle de direção abaixo (asc/desc) tem efeito visível.
  order.sort(function(x,y){ return x.localeCompare(y, 'pt-BR'); });
 }
 // Direção escolhida no popover de Agrupar (asc = ordem acima; desc = invertida).
 if (levels[levelIdx].dir === 'desc') order.reverse();
 var children = {};
 order.forEach(function(k) { children[k] = _gtBuildTree(buckets[k].items, levels, keyForFn, fixedOrders, levelIdx + 1); });
 return { leaf: false, field: field, order: order, children: children };
}

// Contagem recursiva (usada nos badges de cada cabeçalho de grupo, em
// qualquer nível — um nível pai agrega a contagem de todos os filhos).
function _gtTreeCount(node, predicate) {
 if (node.leaf) return predicate ? node.items.filter(predicate).length : node.items.length;
 var sum = 0;
 node.order.forEach(function(k){ sum += _gtTreeCount(node.children[k], predicate); });
 return sum;
}

// Export só pra Node (testes, node:test) — não muda nada no navegador.
if (typeof module !== 'undefined' && module.exports) {
 module.exports = { _gtCapitalize, _gtDateBucket, _gtBuildTree, _gtTreeCount };
}
