-- ═══════════════════════════════════════════════════════════════════════════
-- rpc_sidebar_counts: adiciona o contador de `fornecedores` (7º badge do
-- menu lateral). Fornecedores virou página própria de 1º nível (antes era
-- sub-aba de Empresas) e ganhou nav item + badge dedicados
-- (nav-badge-fornecedores em index.html) — precisa de mais uma coluna nesta
-- RPC, no mesmo padrão dos outros 6 contadores.
--
-- Como aplicar: cole no SQL Editor do Supabase do projeto pnecdbobhywfjdadylwt
-- (ou `apply_migration` via MCP, nome sugerido:
-- rpc_sidebar_counts_add_fornecedores).
--
-- Postgres não permite `create or replace function` mudar o tipo de retorno
-- de uma função já existente (mesmo só adicionando uma coluna na
-- `returns table(...)`) — dá erro "cannot change return type of existing
-- function". Por isso precisa dropar antes de recriar com a assinatura nova.
-- `empresas` (contador já existente) e `fornecedores` (novo) são tabelas
-- DIFERENTES — o badge de Empresas continua contando clientes/construtoras
-- (tabela `empresas`), o novo conta fornecedores (tabela `fornecedores`),
-- sem nenhuma relação entre os dois números.
drop function if exists public.rpc_sidebar_counts();

create function public.rpc_sidebar_counts()
returns table(
  empresas     bigint,
  obras        bigint,
  projetos     bigint,
  entregas     bigint,
  instalacoes  bigint,
  melhorias    bigint,
  fornecedores bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    (select count(*) from public.empresas)::bigint,
    (select count(*) from public.obras)::bigint,
    (select count(*) from public.projetos)::bigint,
    (select count(*) from public.entregas)::bigint,
    (select count(*) from public.instalacoes)::bigint,
    (select count(*) from public.melhorias)::bigint,
    (select count(*) from public.fornecedores)::bigint;
$$;

comment on function public.rpc_sidebar_counts() is
  'Contadores dos 7 badges do menu lateral (empresas/obras/projetos/entregas/'
  'instalacoes/melhorias/fornecedores) em uma única query — usado no boot '
  '(_navBadgesLoadInitial em scripts/modules/dashboard.js) para popular todos '
  'os badges juntos, sem depender de carregar as listas completas. '
  'fornecedores adicionado quando a página virou item de 1º nível (antes era '
  'sub-aba de Empresas) — é uma tabela própria, sem relação com o contador '
  'de `empresas`.';

grant execute on function public.rpc_sidebar_counts() to authenticated;
