-- ═══════════════════════════════════════════════════════════════════════════
-- TESTE DE INTEGRAÇÃO — set_audit_fields() em empresas/contatos
-- ═══════════════════════════════════════════════════════════════════════════
-- Como rodar: cole no SQL Editor do Supabase (ou via MCP execute_sql). Usa
-- registros de teste com prefixo "[TESTE]" e remove tudo no final — seguro
-- rodar em produção.
--
-- Contexto: empresas/contatos já tinham trg_*_updated_at (BEFORE UPDATE ->
-- set_updated_at(), só faz NEW.updated_at = NOW()) — updated_at já era
-- 100% confiável. Mas criado_por/ultima_alteracao_por eram colunas soltas
-- que a aplicação tinha que lembrar de setar manualmente em todo INSERT/
-- UPDATE — exatamente a fragilidade que este trigger elimina.
--
-- Cobre:
--   1) INSERT sem informar criado_por/ultima_alteracao_por -> trigger
--      preenche com auth.jwt()->>'email' (nesta sessão SQL direta, sem JWT,
--      o valor cai para NULL via coalesce — o importante é que o trigger
--      RODOU e não quebrou o INSERT; em uso real pela aplicação, com sessão
--      autenticada, o e-mail do usuário aparece aqui).
--   2) UPDATE tentando forjar criado_por/created_at no payload -> trigger
--      ignora e mantém os valores originais (OLD.criado_por/OLD.created_at)
--   3) UPDATE atualiza ultima_alteracao_por (para o e-mail da sessão atual,
--      nunca o valor forjado no payload) e updated_at (already-existing
--      trigger) muda de fato
--   4) mesmo comportamento em contatos (tabela irmã, mesmo gap fechado)

-- ── 1) INSERT — empresas ────────────────────────────────────────────────────
insert into public.empresas (nome) values ('[TESTE] Auditoria Empresa')
returning id, criado_por, ultima_alteracao_por, created_at, updated_at;
-- ESPERADO: insere sem erro; criado_por/ultima_alteracao_por = NULL (sem JWT
-- nesta sessão) — mas se você logar como usuário autenticado no app e
-- criar uma empresa, esses campos vêm preenchidos com o e-mail do usuário.

-- ── 2) UPDATE forjando criado_por/created_at — empresas ────────────────────
update public.empresas
set criado_por = 'FORJADO', created_at = '2000-01-01T00:00:00Z',
    ultima_alteracao_por = 'tambem forjado'
where nome = '[TESTE] Auditoria Empresa'
returning id, criado_por, ultima_alteracao_por, created_at, updated_at;
-- ESPERADO: criado_por permanece igual ao valor de antes do UPDATE (NULL
-- nesta sessão, NÃO 'FORJADO'); created_at permanece o timestamp original
-- do INSERT (NÃO 2000-01-01); ultima_alteracao_por não fica com o valor
-- forjado do payload (o trigger sempre sobrescreve com auth.jwt()->>'email',
-- NULL nesta sessão sem JWT); updated_at muda para o horário deste UPDATE
-- (trigger set_updated_at, já existente, continua funcionando).

-- ── 3) INSERT/UPDATE — contatos (mesmo gap, mesma correção) ────────────────
insert into public.contatos (nome_completo) values ('[TESTE] Auditoria Contato')
returning id, criado_por, ultima_alteracao_por, created_at, updated_at;

update public.contatos
set criado_por = 'FORJADO', created_at = '2000-01-01T00:00:00Z'
where nome_completo = '[TESTE] Auditoria Contato'
returning id, criado_por, created_at, updated_at;
-- ESPERADO: mesmo comportamento de empresas — criado_por/created_at
-- ignoram o payload forjado, updated_at muda.

-- ── LIMPEZA ─────────────────────────────────────────────────────────────
delete from public.empresas where nome like '[TESTE]%';
delete from public.contatos where nome_completo like '[TESTE]%';
