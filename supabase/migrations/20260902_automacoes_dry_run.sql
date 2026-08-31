-- ═══════════════════════════════════════════════════════════════════════════
-- AUTOMAÇÕES — simulação ("Testar automação") sem efeito colateral
-- ═══════════════════════════════════════════════════════════════════════════
-- Regra do dono: "Testar ≠ executar". É PROIBIDO criar tarefa e depois apagar.
--
-- O risco real de um dry-run é teste e execução divergirem. Por isso NADA de
-- reimplementar a avaliação de condição em JavaScript nem em SQL paralelo:
--
--   1) automacao_montar_tarefa() é a lógica de MONTAGEM extraída de dentro de
--      automacao_criar_tarefa() — resolve vínculos (obra/projeto/melhoria),
--      responsáveis e datas (via automacao_resolver_data) e devolve um jsonb.
--      É `stable`: só faz select, nunca insert.
--   2) automacao_criar_tarefa() passa a CONSUMIR esse jsonb. O motor de verdade
--      e o teste montam a tarefa pela mesma função; a única diferença é que o
--      motor faz o insert do resultado e o teste só mostra.
--   3) automacao_testar() procura um registro real que satisfaça as condições
--      usando automacao_condicoes_ok() — a MESMA função que o trigger usa.
--
-- Nada aqui grava: automacao_montar_tarefa e automacao_testar são `stable`.

-- ── 1. Montagem da tarefa (só cálculo, nenhum insert) ───────────────────────
create or replace function public.automacao_montar_tarefa(acao jsonb, tabela_alvo text, reg jsonb)
returns jsonb
language plpgsql
stable
as $function$
declare
  v_obra_id     uuid;
  v_projeto_id  uuid;
  v_melhoria_id uuid;
  v_emails      text[];
  v_upd         timestamptz;
begin
  -- Vínculos dinâmicos: quem disparou define Obra e Projeto da tarefa.
  if tabela_alvo = 'projetos' then
    v_projeto_id := nullif(reg ->> 'id','')::uuid;
    v_obra_id    := nullif(reg ->> 'obra_id','')::uuid;
  else
    v_obra_id := nullif(reg ->> 'id','')::uuid;
    -- Obra pode ter vários projetos; usa o mais recente (é o que o pessoal
    -- está trabalhando). Sem projeto, a tarefa fica só com a obra.
    select p.id into v_projeto_id from projetos p
     where p.obra_id = v_obra_id order by p.created_at desc nulls last limit 1;
  end if;

  if coalesce((acao ->> 'vincular_obra')::boolean, true) is false then v_obra_id := null; end if;
  if coalesce((acao ->> 'vincular_projeto')::boolean, true) is false then v_projeto_id := null; end if;
  if coalesce((acao ->> 'vincular_melhoria')::boolean, false) and v_projeto_id is not null then
    select pm.melhoria_id into v_melhoria_id from projetos_melhorias pm
     where pm.projeto_id = v_projeto_id limit 1;
  end if;

  v_upd    := nullif(reg ->> 'updated_at','')::timestamptz;
  v_emails := public.automacao_valores(acao -> 'responsaveis');

  return jsonb_build_object(
    'titulo',         coalesce(nullif(acao ->> 'titulo',''), 'Tarefa automática'),
    'tipo',           coalesce(nullif(acao ->> 'tipo_tarefa',''), 'Tarefa'),
    'tipo_atividade', nullif(acao ->> 'tipo_atividade',''),
    'area',           nullif(acao ->> 'area',''),
    'status',         coalesce(nullif(acao ->> 'status',''), 'A fazer'),
    'prioridade',     nullif(acao ->> 'prioridade',''),
    'visibilidade',   coalesce(nullif(acao ->> 'visibilidade',''), 'equipe'),
    'responsavel',    case when cardinality(v_emails) > 0 then to_jsonb(v_emails) else null end,
    'data_inicio',    public.automacao_resolver_data(acao -> 'data_inicio', v_upd),
    'data_prazo',     public.automacao_resolver_data(acao -> 'data_fim', v_upd),
    'observacoes',    nullif(acao ->> 'observacoes',''),
    'obra_id',        v_obra_id,
    'projeto_id',     v_projeto_id,
    'melhoria_id',    v_melhoria_id
  );
end $function$;

-- ── 2. Criação real: mesma montagem + insert ────────────────────────────────
create or replace function public.automacao_criar_tarefa(acao jsonb, tabela_alvo text, reg jsonb, autor uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  t         jsonb;
  v_ativ_id uuid;
  v_emails  text[];
begin
  -- Fonte única com o dry-run: quem decide o que a tarefa vai conter é
  -- automacao_montar_tarefa. Aqui só se grava o que ela devolveu.
  t := automacao_montar_tarefa(acao, tabela_alvo, reg);
  v_emails := automacao_valores(t -> 'responsavel');

  insert into atividades (titulo, tipo, tipo_atividade, area, status, prioridade,
                          visibilidade, responsavel, data_inicio, data_prazo,
                          observacoes, criado_por)
  values (
    t ->> 'titulo',
    t ->> 'tipo',
    t ->> 'tipo_atividade',
    t ->> 'area',
    t ->> 'status',
    t ->> 'prioridade',
    t ->> 'visibilidade',
    case when cardinality(v_emails) > 0 then v_emails else null end,
    nullif(t ->> 'data_inicio','')::date,
    nullif(t ->> 'data_prazo','')::date,
    t ->> 'observacoes',
    autor
  ) returning id into v_ativ_id;

  -- Junctions (é onde Obra/Projeto/Melhoria de uma tarefa realmente moram —
  -- atividades não tem FK direta; mesmo caminho de _syncAtividadeVinculos).
  if nullif(t ->> 'obra_id','')     is not null then insert into atividades_obras (atividade_id, obra_id) values (v_ativ_id, (t ->> 'obra_id')::uuid) on conflict do nothing; end if;
  if nullif(t ->> 'projeto_id','')  is not null then insert into atividades_projetos (atividade_id, projeto_id) values (v_ativ_id, (t ->> 'projeto_id')::uuid) on conflict do nothing; end if;
  if nullif(t ->> 'melhoria_id','') is not null then insert into atividades_melhorias (atividade_id, melhoria_id) values (v_ativ_id, (t ->> 'melhoria_id')::uuid) on conflict do nothing; end if;

  insert into atividades_responsaveis (atividade_id, usuario_id)
  select v_ativ_id, u.id from usuarios u where u.email = any(v_emails)
  on conflict do nothing;

  return v_ativ_id;
end $function$;

-- ── 3. Dry-run ──────────────────────────────────────────────────────────────
-- Procura um registro REAL e recente da tabela alvo que satisfaça as condições
-- (avaliadas por automacao_condicoes_ok, a mesma do trigger) e devolve o que a
-- ação criaria. `stable` — o Postgres recusaria qualquer insert/update aqui.
create or replace function public.automacao_testar(p_tabela text, p_condicoes jsonb, p_acao jsonb)
returns jsonb
language plpgsql
stable
as $function$
declare
  acao jsonb;
  reg  jsonb;
begin
  if p_tabela not in ('projetos','obras') then
    return jsonb_build_object('ok', false, 'motivo', 'tabela_invalida');
  end if;

  -- A ação é sempre lista (§13); testa a primeira, que é a única implementada.
  acao := case when jsonb_typeof(p_acao) = 'array' then p_acao -> 0 else p_acao end;
  if acao is null or jsonb_typeof(acao) <> 'object'
     or coalesce(btrim(acao ->> 'titulo'), '') = '' then
    return jsonb_build_object('ok', false, 'motivo', 'acao_incompleta');
  end if;

  -- Janela dos 500 registros mais recentes: é o que o usuário reconhece como
  -- "dado real de agora", e evita varrer a tabela inteira a cada clique.
  if p_tabela = 'projetos' then
    select to_jsonb(t) into reg
      from (select * from projetos order by coalesce(updated_at, created_at) desc nulls last limit 500) t
     where public.automacao_condicoes_ok(to_jsonb(t), p_condicoes)
     limit 1;
  else
    select to_jsonb(t) into reg
      from (select * from obras order by coalesce(updated_at, created_at) desc nulls last limit 500) t
     where public.automacao_condicoes_ok(to_jsonb(t), p_condicoes)
     limit 1;
  end if;

  if reg is null then
    -- Não é erro: a configuração é válida, só não existe hoje nenhum registro
    -- real que sirva de exemplo pra simulação.
    return jsonb_build_object('ok', true, 'encontrado', false);
  end if;

  return jsonb_build_object(
    'ok', true,
    'encontrado', true,
    'registro', jsonb_build_object(
      'id', reg ->> 'id',
      'nome', coalesce(nullif(reg ->> 'nome',''), 'Registro sem nome'),
      'tabela', p_tabela),
    'tarefa', public.automacao_montar_tarefa(acao, p_tabela, reg)
  );
end $function$;

grant execute on function public.automacao_testar(text, jsonb, jsonb) to authenticated, anon;
grant execute on function public.automacao_montar_tarefa(jsonb, text, jsonb) to authenticated, anon;
