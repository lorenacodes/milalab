-- ═══════════════════════════════════════════════════════════════════════════
-- MOTOR DE AUTOMAÇÕES — cópia de referência no repositório
-- ═══════════════════════════════════════════════════════════════════════════
-- Aplicado em produção como 6 migrações (Supabase migration history):
--   20260831005040 automacoes_schema
--   20260831005113 automacoes_avaliacao_condicoes
--   20260831005211 automacoes_motor_trigger
--   20260831005616 automacoes_pre_cadastradas   ← só DADOS (as 22 automações
--                                                  iniciais). Não está aqui de
--                                                  propósito: são registros que
--                                                  o usuário edita pela aba
--                                                  Automações, e congelar uma
--                                                  cópia no repositório só ia
--                                                  divergir do banco no 1º dia.
--   20260831005809 automacoes_resumo_view
--   20260831010155 automacoes_audit_log
--
-- POR QUE O MOTOR É UM TRIGGER DE BANCO E NÃO CÓDIGO NO NAVEGADOR
--   1. A regra crítica ("dispara quando o registro ENTRA na condição, nunca
--      quando já estava dentro e outro campo mudou") só é decidível comparando
--      OLD e NEW do mesmo UPDATE. No frontend, "o valor anterior" é sempre um
--      palpite do que estava na tela.
--   2. A alteração pode vir de qualquer lugar — outro usuário, outra aba, sync
--      do Airtable, script. Motor no navegador só funciona pra quem está com a
--      aba aberta.
--   3. Idempotência e concorrência exigem constraint e lock de linha reais.
--
-- COMO A DUPLICAÇÃO É IMPEDIDA (três camadas, nesta ordem)
--   a) transição: só é evento se automacao_condicoes_ok(OLD) = false e
--      automacao_condicoes_ok(NEW) = true;
--   b) reivindicação atômica em automacao_estado: o
--      `on conflict do update ... where dentro = false` trava a linha — com
--      dois processos simultâneos só um recebe `entradas` de volta;
--   c) constraint UNIQUE (automacao_id, source_record_id, event_key) em
--      automacao_execucoes, com event_key = 'e' || entradas. Reprocessar o
--      mesmo evento lógico cai na MESMA chave e o banco recusa.
--   Sair da condição zera `dentro`, então uma REENTRADA legítima
--   (Pré-projeto → Revisão → Pré-projeto) gera 'e2' e dispara de novo.

create table if not exists public.automacoes (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  descricao     text,
  tabela_alvo   text not null check (tabela_alvo in ('projetos','obras')),
  ativo         boolean not null default true,
  condicoes     jsonb not null default '[]'::jsonb,  -- [{campo,operador,valor}], E lógico
  acao          jsonb not null default '[]'::jsonb,  -- lista de ações (só criar_tarefa hoje)
  criado_por    text,
  atualizado_por text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.automacao_estado (
  automacao_id     uuid not null references public.automacoes(id) on delete cascade,
  source_record_id uuid not null,
  dentro           boolean not null default false,
  entradas         integer not null default 0,
  updated_at       timestamptz not null default now(),
  primary key (automacao_id, source_record_id)
);

create table if not exists public.automacao_execucoes (
  id               uuid primary key default gen_random_uuid(),
  automacao_id     uuid not null references public.automacoes(id) on delete cascade,
  source_table     text not null,
  source_record_id uuid not null,
  source_nome      text,
  event_key        text not null,
  status           text not null default 'executando' check (status in ('executando','sucesso','erro')),
  atividade_id     uuid references public.atividades(id) on delete set null,
  erro             text,
  origem           text,
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  constraint automacao_execucoes_idempotencia unique (automacao_id, source_record_id, event_key)
);

create index if not exists idx_automacoes_alvo_ativo on public.automacoes(tabela_alvo) where ativo;
create index if not exists idx_automacao_execucoes_aut on public.automacao_execucoes(automacao_id, started_at desc);
create index if not exists idx_automacao_execucoes_src on public.automacao_execucoes(source_record_id);

drop trigger if exists trg_automacoes_updated_at on public.automacoes;
create trigger trg_automacoes_updated_at before update on public.automacoes
  for each row execute function set_updated_at();
drop trigger if exists trg_automacoes_audit on public.automacoes;
create trigger trg_automacoes_audit after insert or update or delete on public.automacoes
  for each row execute function audit_log_trigger();

alter table public.automacoes          enable row level security;
alter table public.automacao_estado    enable row level security;
alter table public.automacao_execucoes enable row level security;

-- Qualquer usuário autenticado cria/edita automações (validação no banco, não
-- só na interface). Execuções e estado são gravados SÓ pelo motor
-- (SECURITY DEFINER) — o usuário só lê, então ninguém forja nem apaga histórico.
drop policy if exists authenticated_all_automacoes on public.automacoes;
create policy authenticated_all_automacoes on public.automacoes
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists authenticated_read_automacao_execucoes on public.automacao_execucoes;
create policy authenticated_read_automacao_execucoes on public.automacao_execucoes
  for select using (auth.role() = 'authenticated');
drop policy if exists authenticated_read_automacao_estado on public.automacao_estado;
create policy authenticated_read_automacao_estado on public.automacao_estado
  for select using (auth.role() = 'authenticated');

do $$
begin
  begin execute 'alter publication supabase_realtime add table public.automacoes'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.automacao_execucoes'; exception when duplicate_object then null; end;
end $$;

-- ── Avaliação de condições ──────────────────────────────────────────────────
-- automacao_norm existe por um motivo concreto: as etapas gravadas em produção
-- têm espaço sobrando e caixa inconsistente ('Revisão Projeto ',
-- 'Projeto para Aprovação'). Sem normalizar, uma automação configurada com o
-- texto "certo" simplesmente nunca dispararia.
create or replace function public.automacao_norm(t text) returns text
language sql immutable as $$ select lower(btrim(coalesce(t,''))) $$;

-- Qualquer valor de campo vira text[]: escalar → 1 elemento, array (produto,
-- tipo_obra) → N, null/vazio → 0. Todo operador trabalha igual em campo
-- simples e em multi-select.
create or replace function public.automacao_valores(raw jsonb) returns text[]
language sql immutable as $$
  select case
    when raw is null or jsonb_typeof(raw) = 'null' then '{}'::text[]
    when jsonb_typeof(raw) = 'array' then coalesce((select array_agg(x) from jsonb_array_elements_text(raw) x where btrim(x) <> ''), '{}'::text[])
    else case when btrim(raw #>> '{}') = '' then '{}'::text[] else array[raw #>> '{}'] end
  end
$$;

create or replace function public.automacao_num(t text) returns numeric
language plpgsql immutable as $$
begin return t::numeric; exception when others then return null; end $$;

create or replace function public.automacao_data(t text) returns date
language plpgsql immutable as $$
begin return t::date; exception when others then return null; end $$;

create or replace function public.automacao_cond_ok(reg jsonb, cond jsonb) returns boolean
language plpgsql immutable as $$
declare
  campo text := cond ->> 'campo';
  op    text := coalesce(cond ->> 'operador', 'igual');
  vals  text[]; alvos text[]; v text; a text;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if campo is null or campo = '' then return true; end if;
  vals  := public.automacao_valores(reg -> campo);
  alvos := public.automacao_valores(cond -> 'valor');

  if op = 'vazio'     then return cardinality(vals) = 0; end if;
  if op = 'nao_vazio' then return cardinality(vals) > 0; end if;
  if op = 'e_hoje'    then return exists (select 1 from unnest(vals) x where public.automacao_data(x) = hoje); end if;

  -- Operador que precisa de valor mas está sem valor configurado: a condição é
  -- ignorada em vez de travar a automação inteira.
  if cardinality(alvos) = 0 then return true; end if;

  if op in ('igual','em') then
    return exists (select 1 from unnest(vals) v2, unnest(alvos) a2 where public.automacao_norm(v2) = public.automacao_norm(a2));
  end if;
  if op in ('diferente','nao_em') then
    return not exists (select 1 from unnest(vals) v2, unnest(alvos) a2 where public.automacao_norm(v2) = public.automacao_norm(a2));
  end if;
  if op = 'contem' then
    return exists (select 1 from unnest(vals) v2, unnest(alvos) a2 where public.automacao_norm(v2) like '%' || public.automacao_norm(a2) || '%');
  end if;
  if op = 'nao_contem' then
    return not exists (select 1 from unnest(vals) v2, unnest(alvos) a2 where public.automacao_norm(v2) like '%' || public.automacao_norm(a2) || '%');
  end if;

  if op in ('maior','menor','maior_igual','menor_igual','antes_de','depois_de','igual_data') then
    if cardinality(vals) = 0 then return false; end if;
    v := vals[1]; a := alvos[1];
    if public.automacao_num(v) is not null and public.automacao_num(a) is not null then
      return case op
        when 'maior'       then public.automacao_num(v) >  public.automacao_num(a)
        when 'menor'       then public.automacao_num(v) <  public.automacao_num(a)
        when 'maior_igual' then public.automacao_num(v) >= public.automacao_num(a)
        when 'menor_igual' then public.automacao_num(v) <= public.automacao_num(a)
        when 'depois_de'   then public.automacao_num(v) >  public.automacao_num(a)
        when 'antes_de'    then public.automacao_num(v) <  public.automacao_num(a)
        else public.automacao_num(v) = public.automacao_num(a) end;
    end if;
    if public.automacao_data(v) is not null and public.automacao_data(a) is not null then
      return case op
        when 'maior' then public.automacao_data(v) > public.automacao_data(a)
        when 'depois_de' then public.automacao_data(v) > public.automacao_data(a)
        when 'menor' then public.automacao_data(v) < public.automacao_data(a)
        when 'antes_de' then public.automacao_data(v) < public.automacao_data(a)
        when 'maior_igual' then public.automacao_data(v) >= public.automacao_data(a)
        when 'menor_igual' then public.automacao_data(v) <= public.automacao_data(a)
        else public.automacao_data(v) = public.automacao_data(a) end;
    end if;
    return false;
  end if;
  return false;   -- operador desconhecido nunca dispara nada
end $$;

create or replace function public.automacao_condicoes_ok(reg jsonb, conds jsonb) returns boolean
language plpgsql immutable as $$
declare c jsonb;
begin
  if conds is null or jsonb_typeof(conds) <> 'array' then return true; end if;
  for c in select * from jsonb_array_elements(conds) loop
    if not public.automacao_cond_ok(reg, c) then return false; end if;
  end loop;
  return true;
end $$;

-- ── Ação "criar tarefa" ─────────────────────────────────────────────────────
-- Datas dinâmicas e vínculos são resolvidos AQUI, no momento da execução —
-- nunca pré-calculados quando a automação foi criada.
create or replace function public.automacao_resolver_data(spec jsonb, ultima_alteracao timestamptz)
returns date language plpgsql immutable as $$
declare base text; dias int;
begin
  if spec is null or jsonb_typeof(spec) = 'null' then return null; end if;
  base := coalesce(spec ->> 'base', 'hoje');
  dias := coalesce((spec ->> 'dias')::int, 0);
  if base = 'nenhum' then return null; end if;
  if base = 'ultima_alteracao' then
    return ((coalesce(ultima_alteracao, now()) at time zone 'America/Sao_Paulo')::date) + dias;
  end if;
  return ((now() at time zone 'America/Sao_Paulo')::date) + dias;
end $$;

create or replace function public.automacao_criar_tarefa(
  acao jsonb, tabela_alvo text, reg jsonb, autor uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_obra_id uuid; v_projeto_id uuid; v_melhoria_id uuid; v_ativ_id uuid;
  v_emails text[]; v_upd timestamptz;
begin
  if tabela_alvo = 'projetos' then
    v_projeto_id := nullif(reg ->> 'id','')::uuid;
    v_obra_id    := nullif(reg ->> 'obra_id','')::uuid;
  else
    v_obra_id := nullif(reg ->> 'id','')::uuid;
    -- Obra pode ter vários projetos; usa o mais recente. Sem projeto, a tarefa
    -- fica só com a obra.
    select p.id into v_projeto_id from projetos p
     where p.obra_id = v_obra_id order by p.created_at desc nulls last limit 1;
  end if;

  if coalesce((acao ->> 'vincular_obra')::boolean, true) is false then v_obra_id := null; end if;
  if coalesce((acao ->> 'vincular_projeto')::boolean, true) is false then v_projeto_id := null; end if;
  if coalesce((acao ->> 'vincular_melhoria')::boolean, false) and v_projeto_id is not null then
    select pm.melhoria_id into v_melhoria_id from projetos_melhorias pm where pm.projeto_id = v_projeto_id limit 1;
  end if;

  v_upd    := nullif(reg ->> 'updated_at','')::timestamptz;
  v_emails := automacao_valores(acao -> 'responsaveis');

  insert into atividades (titulo, tipo, tipo_atividade, area, status, prioridade,
                          visibilidade, responsavel, data_inicio, data_prazo,
                          observacoes, criado_por)
  values (
    coalesce(nullif(acao ->> 'titulo',''), 'Tarefa automática'),
    coalesce(nullif(acao ->> 'tipo_tarefa',''), 'Tarefa'),
    nullif(acao ->> 'tipo_atividade',''),
    nullif(acao ->> 'area',''),
    coalesce(nullif(acao ->> 'status',''), 'A fazer'),
    nullif(acao ->> 'prioridade',''),
    coalesce(nullif(acao ->> 'visibilidade',''), 'equipe'),
    case when cardinality(v_emails) > 0 then v_emails else null end,
    automacao_resolver_data(acao -> 'data_inicio', v_upd),
    automacao_resolver_data(acao -> 'data_fim', v_upd),
    nullif(acao ->> 'observacoes',''),
    autor
  ) returning id into v_ativ_id;

  -- Obra/Projeto/Melhoria de uma tarefa moram nas junctions (atividades não
  -- tem FK direta) — mesmo caminho de _syncAtividadeVinculos no frontend.
  if v_obra_id     is not null then insert into atividades_obras (atividade_id, obra_id) values (v_ativ_id, v_obra_id) on conflict do nothing; end if;
  if v_projeto_id  is not null then insert into atividades_projetos (atividade_id, projeto_id) values (v_ativ_id, v_projeto_id) on conflict do nothing; end if;
  if v_melhoria_id is not null then insert into atividades_melhorias (atividade_id, melhoria_id) values (v_ativ_id, v_melhoria_id) on conflict do nothing; end if;

  insert into atividades_responsaveis (atividade_id, usuario_id)
  select v_ativ_id, u.id from usuarios u where u.email = any(v_emails)
  on conflict do nothing;

  return v_ativ_id;
end $$;

-- ── Motor ───────────────────────────────────────────────────────────────────
create or replace function public.automacao_processar() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  reg_new jsonb := to_jsonb(NEW);
  reg_old jsonb := case when TG_OP = 'UPDATE' then to_jsonb(OLD) else null end;
  a record; ok_new boolean; ok_old boolean;
  v_entradas int; v_run uuid; v_ativ uuid; acao jsonb;
begin
  for a in select * from automacoes where tabela_alvo = TG_TABLE_NAME and ativo loop
    ok_new := automacao_condicoes_ok(reg_new, a.condicoes);

    -- Saiu da condição: zera o estado pra que uma reentrada futura conte como
    -- evento NOVO (e não seja bloqueada pela chave de idempotência).
    if not ok_new then
      update automacao_estado set dentro = false, updated_at = now()
       where automacao_id = a.id and source_record_id = NEW.id and dentro;
      continue;
    end if;

    -- REGRA CRÍTICA: só é evento se o registro NÃO satisfazia antes. Um UPDATE
    -- que muda outro campo enquanto a etapa continua a mesma morre aqui.
    ok_old := case when reg_old is null then false else automacao_condicoes_ok(reg_old, a.condicoes) end;
    if ok_old then
      insert into automacao_estado (automacao_id, source_record_id, dentro, entradas)
      values (a.id, NEW.id, true, 0)
      on conflict (automacao_id, source_record_id) do nothing;
      continue;
    end if;

    -- Reivindicação atômica da entrada: com dois processos simultâneos só um
    -- recebe `entradas` de volta; o outro sai sem fazer nada.
    insert into automacao_estado (automacao_id, source_record_id, dentro, entradas)
    values (a.id, NEW.id, true, 1)
    on conflict (automacao_id, source_record_id) do update
      set dentro = true, entradas = automacao_estado.entradas + 1, updated_at = now()
      where automacao_estado.dentro = false
    returning entradas into v_entradas;
    if v_entradas is null then continue; end if;

    insert into automacao_execucoes (automacao_id, source_table, source_record_id, source_nome, event_key, origem)
    values (a.id, TG_TABLE_NAME, NEW.id, left(coalesce(reg_new ->> 'nome',''), 200), 'e' || v_entradas, 'trigger')
    on conflict on constraint automacao_execucoes_idempotencia do nothing
    returning id into v_run;
    if v_run is null then continue; end if;

    -- O bloco EXCEPTION abre savepoint DEPOIS do insert da execução: se a ação
    -- falhar, a execução continua registrada (vira linha de erro no histórico)
    -- e o UPDATE do usuário na Obra/Projeto NÃO é abortado.
    begin
      for acao in select * from jsonb_array_elements(
            case when jsonb_typeof(a.acao) = 'array' then a.acao else jsonb_build_array(a.acao) end) loop
        if coalesce(acao ->> 'tipo', 'criar_tarefa') = 'criar_tarefa' then
          v_ativ := automacao_criar_tarefa(acao, TG_TABLE_NAME, reg_new, auth.uid());
        end if;
      end loop;
      update automacao_execucoes set status = 'sucesso', atividade_id = v_ativ, finished_at = now() where id = v_run;
    exception when others then
      -- Detalhe técnico só no log do banco; o usuário lê a frase em português.
      raise warning '[automacoes] % / registro % falhou: % (%)', a.nome, NEW.id, sqlerrm, sqlstate;
      update automacao_execucoes
         set status = 'erro', finished_at = now(),
             erro = 'Não foi possível criar a tarefa desta automação. Confira se o responsável, a área e as datas configurados ainda existem no sistema e tente alterar o registro de novo.'
       where id = v_run;
    end;
  end loop;
  return null;
end $$;

drop trigger if exists trg_projetos_automacoes on public.projetos;
create trigger trg_projetos_automacoes after insert or update on public.projetos
  for each row execute function public.automacao_processar();

drop trigger if exists trg_obras_automacoes on public.obras;
create trigger trg_obras_automacoes after insert or update on public.obras
  for each row execute function public.automacao_processar();

-- ── Resumo pros cards da lista ──────────────────────────────────────────────
-- Agregação no banco em vez de puxar o histórico inteiro pro navegador.
create or replace view public.automacoes_resumo
with (security_invoker = true) as
select a.id                                         as automacao_id,
       count(e.id)                                  as total_execucoes,
       count(e.id) filter (where e.status = 'erro')  as total_erros,
       max(e.started_at)                            as ultima_execucao,
       (select e2.status from automacao_execucoes e2
         where e2.automacao_id = a.id order by e2.started_at desc limit 1) as ultimo_status
  from automacoes a
  left join automacao_execucoes e on e.automacao_id = a.id
 group by a.id;

grant select on public.automacoes_resumo to authenticated, anon;

-- Aba "Alterações" do painel lê public.audit_log — precisa da tabela liberada.
drop policy if exists authenticated_select_audit_log_negocio on public.audit_log;
create policy authenticated_select_audit_log_negocio on public.audit_log
  for select using (
    auth.role() = 'authenticated'
    and tabela in ('obras','projetos','entregas','empresas','contatos','instalacoes',
                   'fornecedores','fornecedores_produtos','materiais_catalogo',
                   'atividades','melhorias','automacoes')
  );
