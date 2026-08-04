-- ═══════════════════════════════════════════════════════════════════════════
-- TESTE DE PRIVACIDADE DE ATIVIDADES (RLS)
-- ═══════════════════════════════════════════════════════════════════════════
-- Como rodar: cole este arquivo inteiro no SQL Editor do Supabase (ou via
-- MCP execute_sql, um bloco BEGIN/COMMIT por vez) e confira os comentários
-- "ESPERADO" ao lado de cada SELECT. Todo o setup usa IDs fixos com prefixo
-- 00000000-0000-0000-0000-00000000000X e é removido no final — seguro pra
-- rodar em produção, não deixa dado nenhum pra trás.
--
-- Cobre a especificação de privacidade de atividades:
--   Pública            -> visibilidade = 'equipe'            -> todo mundo vê
--   Somente para mim   -> visibilidade = 'privada', sem       -> só o dono vê
--                         linha em atividades_compartilhamento
--   Pessoas específicas-> visibilidade = 'privada', com        -> dono + quem
--                         linha(s) em atividades_compartilhamento  estiver lá
--
-- Ajuste os 3 UUIDs de usuário abaixo pra 3 usuários reais existentes na
-- tabela `usuarios` do seu ambiente antes de rodar.
--   :dono      -> proprietário das atividades de teste
--   :estranho  -> usuário sem nenhuma relação com as atividades de teste
--   :convidado -> usuário incluído na lista de "pessoas específicas"

-- ── SETUP ────────────────────────────────────────────────────────────────
insert into atividades (id, titulo, status, visibilidade, criado_por) values
  ('00000000-0000-0000-0000-000000000001', '[TESTE] pública',                    'A fazer', 'equipe',  '<DONO>'),
  ('00000000-0000-0000-0000-000000000002', '[TESTE] privada só eu',              'A fazer', 'privada', '<DONO>'),
  ('00000000-0000-0000-0000-000000000003', '[TESTE] privada pessoas específicas','A fazer', 'privada', '<DONO>')
on conflict (id) do nothing;

insert into atividades_compartilhamento (atividade_id, usuario_id)
values ('00000000-0000-0000-0000-000000000003', '<CONVIDADO>')
on conflict do nothing;

-- Vínculo de responsável na atividade privada "só eu" — usado no teste de
-- vazamento via tabela de junção (achado real: essas tabelas tinham
-- políticas "authenticated = true", sem checar a privacidade da atividade).
insert into atividades_responsaveis (atividade_id, usuario_id)
values ('00000000-0000-0000-0000-000000000002', '<DONO>')
on conflict do nothing;

-- ── CENÁRIO 1: dono vê as 3 (pública + só eu + específicos) ────────────────
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"<DONO>","role":"authenticated"}';
select id, titulo from atividades where id::text like '00000000-0000-0000-0000-00000000000%' order by titulo;
-- ESPERADO: 3 linhas
commit;

-- ── CENÁRIO 2: usuário sem nenhuma relação só vê a pública ─────────────────
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"<ESTRANHO>","role":"authenticated"}';
select id, titulo from atividades where id::text like '00000000-0000-0000-0000-00000000000%' order by titulo;
-- ESPERADO: 1 linha ("[TESTE] pública") — as 2 privadas NUNCA aparecem
commit;

-- ── CENÁRIO 3: usuário na lista de "pessoas específicas" vê pública + a
--    dele, mas NUNCA a "só eu" de outra pessoa ────────────────────────────
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"<CONVIDADO>","role":"authenticated"}';
select id, titulo from atividades where id::text like '00000000-0000-0000-0000-00000000000%' order by titulo;
-- ESPERADO: 2 linhas ("pública" + "privada pessoas específicas")
commit;

-- ── CENÁRIO 4 (segurança): tabelas de junção não vazam vínculo de
--    atividade privada pra quem não tem acesso a ela ──────────────────────
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"<ESTRANHO>","role":"authenticated"}';
select count(*) as deve_ser_zero from atividades_responsaveis where atividade_id = '00000000-0000-0000-0000-000000000002';
-- ESPERADO: 0
commit;

begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"<DONO>","role":"authenticated"}';
select count(*) as deve_ser_um from atividades_responsaveis where atividade_id = '00000000-0000-0000-0000-000000000002';
-- ESPERADO: 1 (o próprio dono continua vendo o vínculo dele)
commit;

-- ── LIMPEZA ─────────────────────────────────────────────────────────────
delete from atividades_responsaveis where atividade_id = '00000000-0000-0000-0000-000000000002';
delete from atividades_compartilhamento where atividade_id = '00000000-0000-0000-0000-000000000003';
delete from atividades where id::text like '00000000-0000-0000-0000-00000000000%';
