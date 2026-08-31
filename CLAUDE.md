# Instruções para Claude neste repositório

## Workflow de deploy — sempre publicar direto

Este é um site estático (GitHub Pages, `.github/workflows/deploy.yml`), sem
staging: qualquer commit em `main` já é o que está no ar.

Pedido explícito da dona do projeto: **toda alteração aprovada deve ser
publicada (deploy) na hora, sem perguntar de novo antes de mesclar/fazer
push para `main`.** Ou seja, depois de implementar e validar uma mudança:

1. Commitar.
2. Se estiver numa branch separada, abrir e mesclar o PR (ou dar push direto
   em `main`, quando fizer sentido) **sem esperar confirmação adicional**.
3. Bumpar a versão de cache-busting (`?v=mldsvNNN`) em **todas** as
   ocorrências do `index.html` sempre que `scripts/`, `styles/` ou o próprio
   `index.html` mudarem — os assets usam uma query string fixa por versão, e
   sem o bump o navegador/CDN mantém em cache os arquivos antigos mesmo com
   o `index.html` novo publicado (causa real de bug já visto: página
   "quebrada" por mistura de HTML novo com JS/CSS antigo).
4. Conferir que o workflow `Deploy to GitHub Pages` do commit terminou com
   sucesso antes de considerar a tarefa concluída.

Isso vale para qualquer sessão futura de Claude Code neste repo — não é
preciso perguntar "posso mesclar/publicar?" a cada mudança pequena depois de
validada; só pausar e perguntar quando a mudança for arquiteturalmente
significativa, ambígua, ou explicitamente destrutiva (ex.: apagar dados,
alterar schema em produção).
