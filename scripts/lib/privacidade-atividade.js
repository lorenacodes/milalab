// ═══════════════════════════════════════════════════════════════════════════
// PRIVACIDADE DE ATIVIDADE — lógica pura, client-side, sobre atividades JÁ
// entregues pelo Supabase (a aplicação real da regra é o RLS no banco; isso
// aqui só espelha a mesma regra pra decisões de exibição no cliente, como o
// toggle "Somente para mim" do Meu Painel — nunca é a barreira de segurança).
// ═══════════════════════════════════════════════════════════════════════════

// Uma atividade é "Somente para mim" quando visibilidade = 'privada'. Não
// confundir com "só tem um responsável" — achado real: o toggle "Somente
// para mim" do feed contava o número de responsáveis (<=1) em vez de checar
// a privacidade de verdade, então uma atividade PÚBLICA com um único
// responsável aparecia lá, e uma atividade PRIVADA compartilhada com várias
// pessoas ficava de fora.
function _atividadeEhSomentePraMim(atividade) {
 return !!atividade && atividade.visibilidade === 'privada';
}

// Filtra uma lista de atividades (já vindas do Supabase/RLS) mantendo só as
// "Somente para mim" — usado pelo toggle do feed do Meu Painel.
function _filtrarSomentePraMim(atividades) {
 return (atividades || []).filter(_atividadeEhSomentePraMim);
}

if (typeof module !== 'undefined' && module.exports) {
 module.exports = { _atividadeEhSomentePraMim, _filtrarSomentePraMim };
}
