// ═══════════════════════════════════════════════════════════════════════════
// SMART SEARCH — normalização de texto (acento/caixa/espaço) + correspondência
// parcial e fuzzy leve, reutilizável em qualquer busca do sistema. Não decide
// QUAIS campos cruzar (isso é do módulo que chama) — só decide se duas
// strings "batem" o suficiente.
// ═══════════════════════════════════════════════════════════════════════════

// Remove acentos, baixa caixa, colapsa espaços/hífens duplos.
// "Pré-Projeto", "pre projeto", "PREPROJETO", "pré  projeto" → mesma chave.
function _ssNormalize(str) {
 return (str || '')
  .toString()
  .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove diacríticos
  .toLowerCase()
  .replace(/[-_]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
}

// Distância de Levenshtein limitada (corta assim que passa do máximo permitido,
// pra não gastar tempo comparando strings claramente muito diferentes).
function _ssLevenshtein(a, b, max) {
 if (Math.abs(a.length - b.length) > max) return max + 1;
 var prev = [];
 for (var j = 0; j <= b.length; j++) prev[j] = j;
 for (var i = 1; i <= a.length; i++) {
  var cur = [i];
  var rowMin = cur[0];
  for (var j2 = 1; j2 <= b.length; j2++) {
   var cost = a[i-1] === b[j2-1] ? 0 : 1;
   cur[j2] = Math.min(prev[j2] + 1, cur[j2-1] + 1, prev[j2-1] + cost);
   if (cur[j2] < rowMin) rowMin = cur[j2];
  }
  if (rowMin > max) return max + 1; // toda a linha já passou do limite
  prev = cur;
 }
 return prev[b.length];
}

// haystack/query já devem vir normalizados (_ssNormalize) — quem chama decide
// se quer normalizar uma vez só pra várias comparações (mais eficiente).
function _ssMatch(haystackNorm, queryNorm) {
 if (!queryNorm) return true;
 if (haystackNorm.indexOf(queryNorm) !== -1) return true;
 // Fuzzy leve: só entra em jogo com 4+ caracteres, pra não dar falso-positivo
 // em buscas curtas (ex.: "ti" não deveria "quase bater" com qualquer coisa).
 if (queryNorm.length < 4) return false;
 // Só pra 1 palavra: comparar uma query de várias palavras contra palavras
 // isoladas do haystack dava falso-positivo real (bug encontrado testando o
 // filtro de Obra) — "teste 3" tem distância de edição 2 até só "teste"
 // (apagar " 3"), que já cabia dentro do maxDist de queries de 7 caracteres,
 // então "Obra Teste 5" "quase batia" com a busca "teste 3". Frases inteiras
 // já são cobertas pelo indexOf acima; fuzzy é só para corrigir 1 palavra
 // digitada errada.
 if (queryNorm.indexOf(' ') !== -1) return false;
 var maxDist = queryNorm.length <= 6 ? 1 : 2;
 // Compara a query contra janelas do tamanho da query dentro do haystack,
 // não a string inteira (senão uma frase longa nunca "quase bate").
 var words = haystackNorm.split(' ');
 for (var i = 0; i < words.length; i++) {
  if (Math.abs(words[i].length - queryNorm.length) <= maxDist && _ssLevenshtein(words[i], queryNorm, maxDist) <= maxDist) return true;
 }
 return false;
}

// Atalho pra montar um "haystack" único a partir de vários campos de um
// registro (título, responsável, obra...) já normalizado.
function _ssHaystack(parts) {
 return _ssNormalize(parts.filter(Boolean).join(' '));
}

// Export só pra Node (testes, node:test) — em navegador `module` não existe,
// então este bloco nunca executa lá; não muda nada do comportamento no app.
if (typeof module !== 'undefined' && module.exports) {
 module.exports = { _ssNormalize, _ssLevenshtein, _ssMatch, _ssHaystack };
}
