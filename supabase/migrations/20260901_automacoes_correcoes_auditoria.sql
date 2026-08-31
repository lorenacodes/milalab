-- ═══════════════════════════════════════════════════════════════════════════
-- AUTOMAÇÕES — correções encontradas na auditoria independente do motor
-- ═══════════════════════════════════════════════════════════════════════════
-- Aplicado em produção como a migração
--   automacoes_corrige_ativid_vazada_e_volatilidade
--
-- A auditoria confirmou que o motor estava certo no essencial — constraint
-- UNIQUE (automacao_id, source_record_id, event_key) presente de verdade no
-- banco, reivindicação atômica via `on conflict ... do update ... where` (e não
-- leitura-depois-escrita), e comparação OLD vs NEW antes de disparar — e
-- comprovou de novo com teste de concorrência real contra produção: 5 UPDATEs
-- simultâneos no mesmo projeto geraram exatamente 1 execução e 1 tarefa.
-- Dois defeitos reais apareceram:
--
-- 1) INTEGRIDADE — atividade_id vazando entre automações.
--    v_ativ era declarado FORA do loop de automações e nunca reiniciado. Uma
--    automação cuja lista de ações não criasse tarefa (lista vazia, ou um tipo
--    de ação diferente no futuro) gravava em automacao_execucoes.atividade_id
--    o ID da tarefa criada pela automação ANTERIOR do mesmo UPDATE — ou seja,
--    histórico apontando para a tarefa de outra automação. Hoje as 22
--    automações têm exatamente uma ação criar_tarefa, então o defeito ainda
--    não tinha se manifestado; é latente e barato de fechar.
--    Correção: `v_ativ := null` no início de cada iteração.
--
-- 2) INTEGRIDADE — funções mentindo a volatilidade para o planejador.
--    automacao_cond_ok, automacao_condicoes_ok e automacao_resolver_data leem
--    now() (o operador "é hoje", e o prazo "hoje + N dias" da tarefa criada)
--    mas estavam declaradas IMMUTABLE. IMMUTABLE promete que o resultado só
--    depende dos argumentos, o que autoriza o planejador a pré-calcular e
--    reaproveitar um valor que na verdade muda de um dia para o outro. O
--    correto é STABLE — fixo dentro de uma statement, não para sempre.
--    Nenhuma delas é usada em índice, então trocar a volatilidade é seguro.
--    automacao_norm/_valores/_num/_data continuam IMMUTABLE: essas são de
--    verdade imutáveis.
--
-- As definições abaixo SUBSTITUEM as de 20260831_automacoes_motor.sql.

create or replace function public.automacao_cond_ok(reg jsonb, cond jsonb) returns boolean
language plpgsql stable as $$
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
language plpgsql stable as $$
declare c jsonb;
begin
  if conds is null or jsonb_typeof(conds) <> 'array' then return true; end if;
  for c in select * from jsonb_array_elements(conds) loop
    if not public.automacao_cond_ok(reg, c) then return false; end if;
  end loop;
  return true;
end $$;

create or replace function public.automacao_resolver_data(spec jsonb, ultima_alteracao timestamptz)
returns date language plpgsql stable as $$
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

create or replace function public.automacao_processar() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  reg_new jsonb := to_jsonb(NEW);
  reg_old jsonb := case when TG_OP = 'UPDATE' then to_jsonb(OLD) else null end;
  a record; ok_new boolean; ok_old boolean;
  v_entradas int; v_run uuid; v_ativ uuid; acao jsonb;
begin
  for a in select * from automacoes where tabela_alvo = TG_TABLE_NAME and ativo loop
    -- Reinicia a cada automação: sem isto, a execução de uma automação que não
    -- cria tarefa herdaria o atividade_id da automação anterior deste UPDATE.
    v_ativ := null;

    ok_new := automacao_condicoes_ok(reg_new, a.condicoes);

    -- Saiu da condição: zera o estado para que uma reentrada futura conte como
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
