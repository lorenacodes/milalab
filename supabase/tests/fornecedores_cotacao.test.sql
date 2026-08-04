-- ═══════════════════════════════════════════════════════════════════════════
-- TESTE DE INTEGRAÇÃO — cadastro de Fornecedores / Cotação
-- ═══════════════════════════════════════════════════════════════════════════
-- Como rodar: cole no SQL Editor do Supabase (ou via MCP execute_sql). Todo
-- o setup usa um fornecedor de teste (nome com prefixo "[TESTE]") e é
-- removido no final — seguro rodar em produção.
--
-- Cobre:
--   1) persistência de todos os campos novos (cnpj, contato, cidades[],
--      setores[], experiencia, observacoes) — "segmentos" foi removido do
--      cadastro (mantém só "Área de Atuação" = setores)
--   2) relacionamento fornecedores -> fornecedores_produtos (FK + cascade)
--   3) valor_total calculado automaticamente pelo banco (coluna gerada)
--   4) status_cotacao é POR PRODUTO (fornecedores_produtos), não mais por
--      fornecedor — dois produtos do mesmo fornecedor podem ter status
--      diferentes, e mudar um não afeta o outro
--   5) constraints de status_cotacao (por produto) e experiencia rejeitam
--      valor fora da lista controlada
--   6) compatibilidade: registro anterior à migration continua íntegro

-- ── 1) Cadastro completo persiste corretamente ─────────────────────────────
insert into public.fornecedores
  (nome, cnpj, contato, telefone, email, estado, cidades, setores, experiencia, observacoes)
values
  ('[TESTE] Aço Premium Ltda', '12.345.678/0001-90', 'João Silva', '79999998888', 'contato@acopremium.com.br',
   'SE', array['Aracaju','Lagarto'], array['Materiais e Insumos'],
   'Positiva', 'Fornecedor indicado por outro cliente.')
returning id;
-- ESPERADO: insere sem erro e devolve 1 linha com id novo.

select nome, cnpj, cidades, setores, experiencia
from public.fornecedores where nome = '[TESTE] Aço Premium Ltda';
-- ESPERADO: cidades = {Aracaju,Lagarto}; setores = {"Materiais e Insumos"};
-- experiencia = 'Positiva'. Não existe mais coluna "segmentos" nem
-- "status_cotacao" nesta tabela.

-- ── 2) Produtos orçados: relacionamento + valor_total calculado + status
--       de cotação POR PRODUTO ────────────────────────────────────────────
insert into public.fornecedores_produtos (fornecedor_id, nome, quantidade, unidade_medida, valor_unitario, status_cotacao)
select id, 'Chapa de aço 2mm', 10, 'kg', 123.45, 'Em análise' from public.fornecedores where nome = '[TESTE] Aço Premium Ltda';

insert into public.fornecedores_produtos (fornecedor_id, nome, quantidade, unidade_medida, valor_unitario, status_cotacao)
select id, 'Parafuso sextavado', 500, 'unidade', 0.35, 'Aprovado' from public.fornecedores where nome = '[TESTE] Aço Premium Ltda';

select fp.nome as produto, fp.quantidade, fp.unidade_medida, fp.valor_unitario, fp.valor_total, fp.status_cotacao
from public.fornecedores_produtos fp
join public.fornecedores f on f.id = fp.fornecedor_id
where f.nome = '[TESTE] Aço Premium Ltda'
order by fp.nome;
-- ESPERADO: 2 linhas — "Chapa de aço 2mm" com valor_total = 1234.50 (10 *
-- 123.45) e status_cotacao = 'Em análise'; "Parafuso sextavado" com
-- valor_total = 175.00 (500 * 0.35) e status_cotacao = 'Aprovado'. Os dois
-- status são diferentes e independentes (prova de que o campo é por linha,
-- não mais compartilhado no nível do fornecedor).

-- ── 3) Mudar o status de UM produto não afeta o outro ──────────────────────
update public.fornecedores_produtos
set status_cotacao = 'Cancelado'
where nome = 'Chapa de aço 2mm'
  and fornecedor_id = (select id from public.fornecedores where nome = '[TESTE] Aço Premium Ltda');

select fp.nome as produto, fp.status_cotacao
from public.fornecedores_produtos fp
join public.fornecedores f on f.id = fp.fornecedor_id
where f.nome = '[TESTE] Aço Premium Ltda'
order by fp.nome;
-- ESPERADO: "Chapa de aço 2mm" agora com status_cotacao = 'Cancelado';
-- "Parafuso sextavado" continua 'Aprovado' — inalterado.

-- ── 4) Cascade: apagar o fornecedor apaga os produtos junto ───────────────
-- (roda por último, depois de validar os itens acima)

-- ── 5) Constraints rejeitam valor fora da lista controlada ────────────────
do $$
begin
  begin
    insert into public.fornecedores_produtos (fornecedor_id, nome, status_cotacao)
    select id, '[TESTE] status inválido', 'Status Inventado' from public.fornecedores where nome = '[TESTE] Aço Premium Ltda';
    raise exception 'FALHOU: deveria ter rejeitado status_cotacao inválido';
  exception when check_violation then
    raise notice 'OK: status_cotacao inválido foi rejeitado como esperado';
  end;
end $$;

do $$
begin
  begin
    insert into public.fornecedores (nome, experiencia) values ('[TESTE] experiencia inválida', 'Neutra');
    raise exception 'FALHOU: deveria ter rejeitado experiencia inválida';
  exception when check_violation then
    raise notice 'OK: experiencia inválida foi rejeitada como esperado';
  end;
end $$;

-- ── 6) Compatibilidade: registros antigos (sem os campos novos) continuam OK
select count(*) as fornecedores_sem_quebrar from public.fornecedores;
-- ESPERADO: não dá erro nenhum — cidades/setores default '{}' pra quem não
-- tinha essas colunas antes da migration original, e status_cotacao/segmentos
-- não existem mais em "fornecedores" (migraram pra fornecedores_produtos e
-- foram descontinuados, respectivamente).

-- ── LIMPEZA ─────────────────────────────────────────────────────────────
delete from public.fornecedores where nome like '[TESTE]%';
-- fornecedores_produtos do fornecedor de teste some sozinho (ON DELETE CASCADE).
select count(*) as produtos_orfaos_restantes from public.fornecedores_produtos fp
where not exists (select 1 from public.fornecedores f where f.id = fp.fornecedor_id);
-- ESPERADO: 0 (cascade funcionou, não sobrou produto órfão).
