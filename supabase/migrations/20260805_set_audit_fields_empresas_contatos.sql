-- ═══════════════════════════════════════════════════════════════════════════
-- set_audit_fields(): trigger que mantém criado_por/ultima_alteracao_por/
-- created_at 100% confiáveis em empresas/contatos, sem depender da
-- aplicação lembrar de setá-los manualmente em todo INSERT/UPDATE.
--
-- Contexto: empresas/contatos já tinham trg_*_updated_at (BEFORE UPDATE ->
-- set_updated_at(), só faz NEW.updated_at = NOW()) — updated_at já era
-- 100% confiável. Mas criado_por/ultima_alteracao_por eram colunas soltas
-- que só a aplicação escrevia manualmente — exatamente a fragilidade que
-- este trigger elimina (uma única fonte de verdade: o trigger, não mais
-- app + trigger competindo). Mesma leitura de e-mail que audit_log_trigger()
-- já usa (grep pg_get_functiondef nela para confirmar o padrão).
--
-- Aplicado só em empresas/contatos (as duas tabelas tocadas pelo painel de
-- detalhe de Empresa nesta rodada) — NÃO estender a outras tabelas ainda.
--
-- Como aplicar: cole no SQL Editor do Supabase do projeto pnecdbobhywfjdadylwt
-- (ou `apply_migration` via MCP, nome sugerido:
-- set_audit_fields_empresas_contatos — já aplicada nesta sessão).
--
-- Teste: supabase/tests/audit_fields_empresas_contatos.test.sql
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.set_audit_fields()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  begin v_email := auth.jwt() ->> 'email'; exception when others then v_email := null; end;
  if TG_OP = 'INSERT' then
    NEW.criado_por := coalesce(NEW.criado_por, v_email);
    NEW.ultima_alteracao_por := coalesce(NEW.ultima_alteracao_por, v_email);
  elsif TG_OP = 'UPDATE' then
    NEW.criado_por := OLD.criado_por;       -- nunca deixa o cliente sobrescrever quem criou
    NEW.created_at := OLD.created_at;       -- nunca deixa o cliente sobrescrever a data de criação
    NEW.ultima_alteracao_por := v_email;
  end if;
  return NEW;
end; $$;

drop trigger if exists trg_empresas_set_audit on public.empresas;
create trigger trg_empresas_set_audit before insert or update on public.empresas
  for each row execute function set_audit_fields();

drop trigger if exists trg_contatos_set_audit on public.contatos;
create trigger trg_contatos_set_audit before insert or update on public.contatos
  for each row execute function set_audit_fields();
