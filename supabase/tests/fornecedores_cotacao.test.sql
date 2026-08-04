-- ═══════════════════════════════════════════════════════════════════════════
-- TESTE DE INTEGRAÇÃO — cadastro de Fornecedores / Cotação
-- ═══════════════════════════════════════════════════════════════════════════
-- Como rodar: cole no SQL Editor do Supabase (ou via MCP execute_sql). Todo
-- o setup usa um fornecedor de teste (nome com prefixo "[TESTE]") e é
-- removido no final — seguro rodar em produção.
--
-- Cobre:
--   1) persistência de todos os campos novos (cnpj, contato, cidades[],
--      setores[], segmentos[], status_cotacao, experiencia, observacoes)
--   2) relacionamento fornecedores -> fornecedores_produtos (FK + cascade)
--   3) valor_total calculado automaticamente pelo banco (coluna gerada)
--   4) constraints de status_cotacao/experiencia rejeitam valor fora da lista
--   5) compatibilidade: registro anterior à migration continua íntegro

-- ── 1) Cadastro completo persiste corretamente ─────────────────────────────
insert into public.fornecedores
  (nome, cnpj, contato, telefone, email, estado, cidades, setores, segmentos, status_cotacao, experiencia, observacoes)
values
  ('[TESTE] Aço Premium Ltda', '12.345.678/0001-90', 'João Silva', '79999998888', 'contato@acopremium.com.br',
   'SE', array['Aracaju','Lagarto'], array['Materiais e Insumos'], array['Aço','Alumínio'],
   'Em análise', 'Positiva', 'Fornecedor indicado por outro cliente.')
returning id;
-- ESPERADO: insere sem erro e devolve 1 linha com id novo.

-- Guarda o id pra usar no resto do teste (ajuste manualmente se rodar em partes separadas).
-- select id from public.fornecedores where nome = '[TESTE] Aço Premium Ltda';

select nome, cnpj, cidades, setores, segmentos, status_cotacao, experiencia
from public.fornecedores where nome = '[TESTE] Aço Premium Ltda';
-- ESPERADO: cidades = {Aracaju,Lagarto}; setores = {"Materiais e Insumos"};
-- segmentos = {Aço,Alumínio}; status_cotacao = 'Em análise'; experiencia = 'Positiva'.

-- ── 2) Produtos orçados: relacionamento + valor_total calculado ───────────
insert into public.fornecedores_produtos (fornecedor_id, nome, quantidade, unidade_medida, valor_unitario)
select id, 'Chapa de aço 2mm', 10, 'kg', 123.45 from public.fornecedores where nome = '[TESTE] Aço Premium Ltda';

select fp.nome as produto, fp.quantidade, fp.unidade_medida, fp.valor_unitario, fp.valor_total
from public.fornecedores_produtos fp
join public.fornecedores f on f.id = fp.fornecedor_id
where f.nome = '[TESTE] Aço Premium Ltda';
-- ESPERADO: valor_total = 1234.50 (10 * 123.45), calculado pelo Postgres —
-- nunca foi enviado pela aplicação.

-- ── 3) Cascade: apagar o fornecedor apaga os produtos junto ───────────────
-- (roda por último, depois de validar os itens acima)

-- ── 4) Constraints rejeitam valor fora da lista controlada ────────────────
do $$
begin
  begin
    insert into public.fornecedores (nome, status_cotacao) values ('[TESTE] status inválido', 'Status Inventado');
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

-- ── 5) Compatibilidade: registros antigos (sem os campos novos) continuam OK
select count(*) as fornecedores_sem_quebrar from public.fornecedores;
-- ESPERADO: não dá erro nenhum — cidades/setores/segmentos default '{}' pra
-- quem não tinha essas colunas antes da migration.

-- ── LIMPEZA ─────────────────────────────────────────────────────────────
delete from public.fornecedores where nome like '[TESTE]%';
-- fornecedores_produtos do fornecedor de teste some sozinho (ON DELETE CASCADE).
select count(*) as produtos_orfaos_restantes from public.fornecedores_produtos fp
where not exists (select 1 from public.fornecedores f where f.id = fp.fornecedor_id);
-- ESPERADO: 0 (cascade funcionou, não sobrou produto órfão).
