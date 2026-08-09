# Auditoria de Autenticação — Agosto/2026

Registro técnico das falhas encontradas e corrigidas na auditoria do módulo de
autenticação, gerenciamento de usuários e recuperação de senha. Mantido para
rastreabilidade e histórico do projeto.

## Comportamento observado (antes da correção)

Durante os testes do fluxo de recuperação de senha ("esqueci minha senha"),
foi identificado o seguinte comportamento:

1. O sistema informava corretamente que a recuperação foi iniciada
   ("Link enviado! Verifique sua caixa de entrada.").
2. Um token de recuperação válido era gerado e enviado por e-mail.
3. O link recebido, no entanto, redirecionava para um endereço `localhost`
   (ou, em produção, para uma URL de um repositório já renomeado — ver causa
   raiz abaixo), impedindo a conclusão da redefinição de senha.

O token gerado durante o teste não foi reaproveitado nem registrado neste
documento — este registro descreve apenas o comportamento observado, não os
dados sensíveis da tentativa.

## Causa raiz identificada

1. **Edge function `auth-admin` com URL de produção desatualizada.** A
   constante `PROD_URL` apontava para `https://lorenacodes.github.io/milatec-sistema`
   — o nome do repositório antes de ser renomeado para `milalab`. Toda ação
   administrativa que gera link (`convidar`, `reenviar-acesso`, `aprovar`)
   produzia um link para uma URL que não existe mais (404).
2. **Bug de CORS relacionado.** A mesma constante (com caminho) era comparada
   diretamente contra o cabeçalho `Origin` das requisições — que nunca inclui
   caminho, só esquema+host. A comparação nunca dava match verdadeiro em
   produção, fazendo o CORS cair sempre no valor de fallback.
3. O fluxo de "esqueci minha senha" iniciado pelo próprio usuário
   (`_forgotPwdSubmit`, `scripts/services/auth.service.js`) já usava
   `window.location.origin` dinamicamente (não hardcoded) — funcionando
   corretamente contanto que a config "Site URL" / "Redirect URLs" do
   Supabase (Authentication → URL Configuration) também estivesse atualizada
   para a URL real de produção. Essa configuração vive só no painel do
   Supabase, fora do repositório.

## Correções aplicadas

- `PROD_URL`/`PROD_ORIGIN` da edge function `auth-admin` atualizados para a
  URL real (`https://lorenacodes.github.io/milalab/`), com `PROD_ORIGIN`
  (sem caminho) usado especificamente na comparação de CORS.
- Domínios corporativos aceitos ampliados de `@milatec.ind.br` (único) para
  `@milatec.ind.br` **e** `@mila.ind.br`, centralizados em:
  - `_isAllowedEmailDomain()` em `scripts/services/auth.service.js` (usada no
    login, esqueci-senha e criação de usuário no admin);
  - `isAllowedDomain()` na edge function `auth-admin` (checagem
    server-side, independente — edge functions não compartilham código com
    o app estático sem um bundler).
- Removido o modo "Criar acesso com senha" do modal de novo usuário do
  admin (e a ação `criar-usuario-com-senha` da edge function) — o único
  caminho de provisionamento agora é convite por e-mail
  (`action: 'convidar'`), sem senha provisória. `alterar-senha` (reset de
  senha de um usuário já existente, por suporte) foi mantida — é um caso de
  uso diferente.
- Confirmado manualmente pela Lorena: "Site URL" e "Redirect URLs" no painel
  do Supabase (Authentication → URL Configuration) atualizados para
  `https://lorenacodes.github.io/milalab/`.

## Verificação pós-correção

- CORS testado diretamente contra a função publicada: `Access-Control-Allow-Origin`
  agora retorna `https://lorenacodes.github.io` (antes não dava match).
- `_isAllowedEmailDomain()` testado com e-mails `@milatec.ind.br`,
  `@mila.ind.br`, domínio não permitido, variação de maiúsculas e string
  vazia — todos os casos corretos.
