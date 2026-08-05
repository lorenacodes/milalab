-- ═══════════════════════════════════════════════════════════════════════════
-- RPCs: KPIs de atividades (Gestor de Tarefas / Meu Painel) + contadores do
-- menu lateral (badges de Empresas/Obras/Projetos/Entregas/Instalações/
-- Melhorias).
-- ═══════════════════════════════════════════════════════════════════════════
-- Como aplicar: cole no SQL Editor do Supabase do projeto pnecdbobhywfjdadylwt
-- (ou `apply_migration` via MCP, nome sugerido:
-- rpc_atividades_kpis_e_sidebar_counts).
--
-- Motivo: os contadores do sidebar e os KPIs de tarefas eram calculados no
-- JS depois de baixar TODAS as linhas da tabela pra memória (não escala com
-- milhares de registros, e foi a causa raiz do badge de Instalações ficar
-- travado em "—" — seu loader só roda quando a aba é aberta). Movendo o
-- cálculo pra uma única query agregada no banco (COUNT/CASE WHEN), o custo
-- de rede fica fixo (uma linha de resposta) não importa o tamanho da tabela.

-- ── 1) rpc_atividades_kpis ───────────────────────────────────────────────
-- Agrega o estado de `atividades` em 5 baldes, com uma única passada no
-- banco. Usada por:
--   - Gestor de Tarefas (scripts/modules/tarefas.js): rpc_atividades_kpis(null)
--     → visão global (mesma regra "ver tudo" que a tela já tinha).
--   - Meu Painel (scripts/modules/dashboard.js): rpc_atividades_kpis(email)
--     → mesmo cálculo, filtrado só pelas atividades do usuário logado.
--
-- Regra de negócio (não-negociável, pedida explicitamente): atividades com
-- status = 'Obsoleto' são excluídas de TUDO, inclusive do total — são
-- tratadas como se não existissem para qualquer métrica. Essa exclusão
-- acontece já no CTE `base`, antes de qualquer outro cálculo.
--
-- Definição dos baldes (documentada aqui porque o pedido original não
-- especifica limites exatos entre "pendente"/"a fazer"/"em andamento" —
-- esta é a interpretação adotada, não-sobreposta entre si):
--   done         = status em ('Feito','Concluído','Concluida') — não é uma
--                  das 5 colunas retornadas, é só o complemento de a_fazer.
--   atrasada     = não é `done`, tem data_prazo preenchida e
--                  data_prazo < hoje. Prioridade máxima: uma atividade
--                  "Em progresso" mas vencida conta como atrasada, não como
--                  em_andamento (evita dupla contagem).
--   em_andamento = não é `done`, não é `atrasada`, e
--                  status em ('Em progresso','Em andamento') — as duas
--                  grafias convivem no dado real/legado, tratadas como
--                  sinônimos (mesmo padrão já usado em tarefas.js/dashboard.js).
--   pendente     = não é `done`, não é `atrasada`, não é `em_andamento`
--                  (cobre Backlog, "A fazer", "Aguardando feedback" e
--                  qualquer status futuro que não caia nos baldes acima).
--   a_fazer      = não é `done` — ou seja, a_fazer = em_andamento + atrasada
--                  + pendente = total - done. Não é um balde exclusivo como
--                  os outros 3: é o agregado "tudo que ainda não foi
--                  concluído", exatamente como pedido ("A fazer (tudo que
--                  ainda não foi concluído)").
--   total        = count(*) depois de excluir Obsoleto (inclui done).
--
-- security invoker (não definer): respeita a MESMA RLS que qualquer query
-- direta em `atividades` já respeita hoje — não é criado nenhum bypass de
-- permissão novo. Não foi encontrada nenhuma outra RPC deste projeto usando
-- security definer para agregações; ver nota no relatório da tarefa.
create or replace function public.rpc_atividades_kpis(p_responsavel text default null)
returns table(
  total        bigint,
  em_andamento bigint,
  pendente     bigint,
  atrasada     bigint,
  a_fazer      bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with base as (
    select a.status, a.data_prazo
    from public.atividades a
    where a.status is distinct from 'Obsoleto'
      and (p_responsavel is null or a.responsavel @> array[p_responsavel]::text[])
  ),
  bucketed as (
    select
      status,
      (status in ('Feito','Concluído','Concluida')) as is_done,
      (
        status not in ('Feito','Concluído','Concluida')
        and data_prazo is not null
        and data_prazo < current_date
      ) as is_late
    from base
  )
  select
    count(*)::bigint as total,
    count(*) filter (
      where not is_done and not is_late
        and status in ('Em progresso','Em andamento')
    )::bigint as em_andamento,
    count(*) filter (
      where not is_done and not is_late
        and status not in ('Em progresso','Em andamento')
    )::bigint as pendente,
    count(*) filter (where is_late)::bigint as atrasada,
    count(*) filter (where not is_done)::bigint as a_fazer
  from bucketed;
$$;

comment on function public.rpc_atividades_kpis(text) is
  'KPIs agregados de atividades (total/em_andamento/pendente/atrasada/a_fazer). '
  'Exclui status=Obsoleto de tudo, inclusive total. p_responsavel=null => visão '
  'global (Gestor de Tarefas); p_responsavel=email => escopo pessoal (Meu Painel), '
  'via responsavel @> ARRAY[email]. Ver comentário completo no arquivo de migration.';

grant execute on function public.rpc_atividades_kpis(text) to authenticated;

-- ── 2) rpc_sidebar_counts ────────────────────────────────────────────────
-- Uma única viagem de ida-e-volta pros 6 contadores do menu lateral, cada
-- um um COUNT puro (sem trazer nenhuma linha das tabelas). Preferido a 6
-- chamadas `count:'exact',head:true` em paralelo porque reduz de 6
-- round-trips HTTP pra 1 sem introduzir nenhuma complexidade de RLS por
-- tabela (cada sub-select roda com o mesmo invoker/RLS da tabela de origem).
create or replace function public.rpc_sidebar_counts()
returns table(
  empresas     bigint,
  obras        bigint,
  projetos     bigint,
  entregas     bigint,
  instalacoes  bigint,
  melhorias    bigint
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
    (select count(*) from public.melhorias)::bigint;
$$;

comment on function public.rpc_sidebar_counts() is
  'Contadores dos 6 badges do menu lateral (empresas/obras/projetos/entregas/'
  'instalacoes/melhorias) em uma única query — usado no boot (_navBadgesLoadInitial '
  'em scripts/modules/dashboard.js) para popular todos os badges juntos, sem '
  'depender de carregar as listas completas.';

grant execute on function public.rpc_sidebar_counts() to authenticated;
