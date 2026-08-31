// ═══════════════════════════════════════════════════════════════════════════
// AUTOMAÇÕES — validação pura de condição completa (Campo + Operador +
// Valor). Extraído de scripts/modules/automacoes.js pra ser testável sem
// DOM/Supabase, no mesmo padrão de privacidade-atividade.js/
// fornecedor-validacao.js. Usado tanto pelo checklist do wizard de criação
// quanto pelo salvamento de uma automação já existente (os dois precisam da
// MESMA regra, senão um aceitaria o que o outro recusa).
// ═══════════════════════════════════════════════════════════════════════════

// Uma condição é completa quando tem campo + operador, e (a menos que o
// operador não use valor nenhum, ex.: "está vazio") pelo menos um valor não
// vazio. `valor` pode ser escalar (texto/número/data/relação) ou array
// (select/multi) — os dois formatos são aceitos, igual ao resto do sistema
// (automacao_valores normaliza os dois do mesmo jeito no banco).
function _autCondEstaCompleta(cond, opsSemValor) {
 if (!cond || !cond.campo || !cond.operador) return false;
 if (opsSemValor && opsSemValor[cond.operador]) return true;
 var vals = Array.isArray(cond.valor) ? cond.valor : (cond.valor == null ? [] : [cond.valor]);
 return vals.some(function (v) { return String(v).trim() !== ''; });
}

function _autCondicoesTodasCompletas(conds, opsSemValor) {
 return (conds || []).every(function (c) { return _autCondEstaCompleta(c, opsSemValor); });
}

// Primeira condição incompleta de uma lista (ou null se todas completas) —
// usado pra montar a mensagem de erro citando o campo específico.
function _autPrimeiraCondIncompleta(conds, opsSemValor) {
 return (conds || []).filter(function (c) { return !_autCondEstaCompleta(c, opsSemValor); })[0] || null;
}

if (typeof module !== 'undefined' && module.exports) {
 module.exports = { _autCondEstaCompleta, _autCondicoesTodasCompletas, _autPrimeiraCondIncompleta };
}
