// ═══════════════════════════════════════════════════════════════════════════════
// VÍNCULOS DE ATIVIDADES — cache e sincronização das junctions
// atividades_obras/atividades_projetos/atividades_melhorias/atividades_responsaveis.
// Compartilhado entre Dashboard e Gestor de Tarefas.
// ═══════════════════════════════════════════════════════════════════════════════
async function _loadAtividadeVinculosCache() {
 // Recarrega sempre (não memoiza para sempre): _gestorLoad() chama isto a cada
 // boot, refresh manual e evento realtime de `atividades`, e vínculos podem
 // mudar entre uma chamada e outra (edição no sistema ou sync do Airtable).
 _avObraMap = {}; _avProjMap = {}; _avMelhMap = {};
 async function pageAll(table, col) {
  var map = {}, pg = 0, sz = 1000;
  while (true) {
   var r = await _sb.from(table).select('atividade_id,' + col).range(pg*sz, (pg+1)*sz-1);
   if (r.error || !r.data || !r.data.length) break;
   r.data.forEach(function(row){ if (!map[row.atividade_id]) map[row.atividade_id] = row[col]; });
   if (r.data.length < sz) break;
   pg++;
  }
  return map;
 }
 var [om, pm, mm] = await Promise.all([
  pageAll('atividades_obras', 'obra_id'),
  pageAll('atividades_projetos', 'projeto_id'),
  pageAll('atividades_melhorias', 'melhoria_id'),
 ]);
 _avObraMap = om; _avProjMap = pm; _avMelhMap = mm;
}
// Enriquece uma lista de atividades (já buscadas do Supabase) com obra_id/projeto_id/
// melhoria_id (lidos da junction) e converte responsavel (array) em string de nomes.
function _enrichAtividades(rows) {
 (rows || []).forEach(function(a) {
  if (a.obra_id === undefined)     a.obra_id     = (_avObraMap  && _avObraMap[a.id])  || null;
  if (a.projeto_id === undefined)  a.projeto_id  = (_avProjMap  && _avProjMap[a.id])  || null;
  if (a.melhoria_id === undefined) a.melhoria_id = (_avMelhMap  && _avMelhMap[a.id])  || null;
  if (Array.isArray(a.responsavel)) a.responsavel = _emailsToNomes(a.responsavel);
 });
 return rows;
}
// Grava (upsert) os vínculos N:N de uma atividade nas junction tables, substituindo
// os vínculos anteriores de obra/projeto/melhoria por, no máximo, um novo de cada.
async function _syncAtividadeVinculos(atividadeId, obraId, projetoId, melhoriaId) {
 var uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 var safeUuid = function(v) { return (v && uuidRe.test(String(v))) ? v : null; };
 atividadeId = safeUuid(atividadeId);
 obraId      = safeUuid(obraId);
 projetoId   = safeUuid(projetoId);
 melhoriaId  = safeUuid(melhoriaId);
 if (!atividadeId) return;
 var erros = [];
 function chk(r) { if (r && r.error) erros.push(r.error); return r; }
 try {
  chk(await _sb.from('atividades_obras').delete().eq('atividade_id', atividadeId));
  if (obraId) chk(await _sb.from('atividades_obras').insert({ atividade_id: atividadeId, obra_id: obraId }));
  chk(await _sb.from('atividades_projetos').delete().eq('atividade_id', atividadeId));
  if (projetoId) chk(await _sb.from('atividades_projetos').insert({ atividade_id: atividadeId, projeto_id: projetoId }));
  chk(await _sb.from('atividades_melhorias').delete().eq('atividade_id', atividadeId));
  if (melhoriaId) chk(await _sb.from('atividades_melhorias').insert({ atividade_id: atividadeId, melhoria_id: melhoriaId }));
  if (_avObraMap) { _avObraMap[atividadeId] = obraId || null; _avProjMap[atividadeId] = projetoId || null; _avMelhMap[atividadeId] = melhoriaId || null; }
  if (erros.length && typeof _showToast === 'function') {
   _showToast('Atividade salva, mas houve erro ao vincular obra/projeto/melhoria.', 'erro');
   console.error('[_syncAtividadeVinculos] erro(s):', erros);
  }
 } catch(e) { console.error('[_syncAtividadeVinculos] erro:', e); }
}
// Grava (upsert) os responsáveis de uma atividade em atividades_responsaveis,
// resolvendo e-mail → usuario_id (e-mails sem usuário cadastrado são ignorados aqui,
// mas continuam visíveis no array atividades.responsavel).
async function _syncAtividadeResponsaveis(atividadeId, emails) {
 try {
  var delRes = await _sb.from('atividades_responsaveis').delete().eq('atividade_id', atividadeId);
  var cache = await _loadUsuariosCache();
  var arr = Array.isArray(emails) ? emails : (emails ? [emails] : []);
  var links = arr.map(function(em) {
   var u = cache.find(function(x){ return x.email === em; });
   return u ? { atividade_id: atividadeId, usuario_id: u.id } : null;
  }).filter(Boolean);
  var insRes = links.length ? await _sb.from('atividades_responsaveis').insert(links) : null;
  if ((delRes && delRes.error) || (insRes && insRes.error)) {
   console.error('[_syncAtividadeResponsaveis] erro:', (delRes && delRes.error) || (insRes && insRes.error));
   if (typeof _showToast === 'function') _showToast('Erro ao sincronizar responsáveis da atividade.', 'erro');
  }
 } catch(e) { console.error('[_syncAtividadeResponsaveis] erro:', e); }
}

