// ═══════════════════════════════════════════════════════════════════════════
// PRIVACIDADE DE ATIVIDADE — lógica pura, client-side, sobre atividades JÁ
// entregues pelo Supabase (a aplicação real da regra é o RLS no banco; isso
// aqui só espelha a mesma regra pra decisões de exibição no cliente, como as
// seções "Somente para mim" / "Pessoas específicas" do Meu Painel — nunca é
// a barreira de segurança).
//
// visibilidade = 'privada' cobre DOIS modos distintos, diferenciados por
// existir ou não linha em atividades_compartilhamento pra essa atividade:
//   - sem compartilhamento  -> "Somente para mim"
//   - com compartilhamento  -> "Pessoas específicas"
// Achado real: as duas ficavam misturadas sob "Somente para mim" porque a
// checagem só olhava visibilidade === 'privada', sem considerar se havia
// compartilhamento. Por isso toda função aqui recebe o Set de IDs que têm
// compartilhamento (quem chama busca isso em atividades_compartilhamento).
// ═══════════════════════════════════════════════════════════════════════════

function _atividadeEhPrivada(atividade) {
 return !!atividade && atividade.visibilidade === 'privada';
}

// idsComCompartilhamento: Set (ou array) de atividade_id que têm pelo menos
// uma linha em atividades_compartilhamento. Omitido = trata como se nenhuma
// tivesse compartilhamento (toda privada cai em "Somente para mim").
function _temCompartilhamento(atividade, idsComCompartilhamento) {
 if (!atividade) return false;
 var set = idsComCompartilhamento instanceof Set ? idsComCompartilhamento : new Set(idsComCompartilhamento || []);
 return set.has(atividade.id);
}

function _atividadeEhSomentePraMim(atividade, idsComCompartilhamento) {
 return _atividadeEhPrivada(atividade) && !_temCompartilhamento(atividade, idsComCompartilhamento);
}

function _atividadeEhPessoasEspecificas(atividade, idsComCompartilhamento) {
 return _atividadeEhPrivada(atividade) && _temCompartilhamento(atividade, idsComCompartilhamento);
}

function _filtrarSomentePraMim(atividades, idsComCompartilhamento) {
 return (atividades || []).filter(function (a) { return _atividadeEhSomentePraMim(a, idsComCompartilhamento); });
}

function _filtrarPessoasEspecificas(atividades, idsComCompartilhamento) {
 return (atividades || []).filter(function (a) { return _atividadeEhPessoasEspecificas(a, idsComCompartilhamento); });
}

if (typeof module !== 'undefined' && module.exports) {
 module.exports = {
  _atividadeEhPrivada, _atividadeEhSomentePraMim, _atividadeEhPessoasEspecificas,
  _filtrarSomentePraMim, _filtrarPessoasEspecificas,
 };
}
