-- Melhorias: status de verdade, editável.
-- Aplicada em produção em 30/08/2026 (migração melhorias_status_real_editavel).
--
-- A tabela "Melhorias" do Airtable (origem dos dados, sincronizada via
-- airtable_id) NUNCA teve campo de Status. O valor 'ativo' das 13 linhas era
-- um default solto que não existia em lugar nenhum da interface: não estava
-- nos 4 KPIs (Backlog/Em andamento/Pausado/Concluído), nem no mapa de cores,
-- nem nas opções do filtro — por isso os KPIs ficavam sempre zerados e o
-- filtro por Status nunca casava nada.
--
-- Havia ainda um TERCEIRO vocabulário aqui embaixo: o CHECK constraint
-- melhorias_status_check só aceitava 'ativo'/'em_andamento'/'concluido'/
-- 'cancelado'/'pausado' (snake_case), que não bate nem com o Airtable nem com
-- a UI. Ou seja, a tela nunca conseguiria gravar nenhum dos 4 status que ela
-- mesma exibe.
--
-- Decisão do dono do sistema: criar um Status real e editável com as 4 opções
-- que a tela já mostra, e partir de "Em andamento" como ponto neutro — não
-- afirma conclusão nem abandono, só diz que a iniciativa está em curso. O
-- controle passa a ser da equipe daqui pra frente.
--
-- NADA foi alterado no Airtable: a correção é só no Supabase.

alter table public.melhorias drop constraint melhorias_status_check;

update public.melhorias set status = 'Em andamento' where status = 'ativo';

-- Vocabulário único, igual ao que o <select> do painel oferece. NULL continua
-- aceito (CHECK não barra NULL) pra não travar linha legada sem status.
alter table public.melhorias add constraint melhorias_status_check
 check (status in ('Backlog','Em andamento','Pausado','Concluído'));

-- Default antigo era 'ativo': qualquer iniciativa nova nasceria de novo com o
-- valor morto que acabou de ser corrigido — e agora nem passaria no CHECK.
-- Backlog é o ponto de entrada real de uma iniciativa que ainda não começou.
alter table public.melhorias alter column status set default 'Backlog';
