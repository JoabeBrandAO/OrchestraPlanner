# 2026-10-01 — Pendências de infraestrutura do dono

- **Sessão:** guiada, sem código (Claude em `C:\projetos`), branch `docs/checkpoint-2026-10-01`,
  a partir de `3f52eb6`.
- **Duração:** ~25 min, das 8h40 às 9h05.

## O que foi feito
- **#114:** o dono cadastrou o endpoint `https://orchestra-planner.vercel.app/api/webhooks/clerk`
  no Clerk (instância de desenvolvimento famous-hornet-44, a mesma da produção) com
  `user.created`, `user.updated` e `user.deleted`, e pôs `CLERK_WEBHOOK_SIGNING_SECRET` em
  Production na Vercel.
- **#91:** `DATABASE_URL` trocada para a string `app_rls` com `sslmode=verify-full`, em
  Production e Preview.
- Redeploy de produção sem build cache, até ficar **Ready**.

## Evidência
- Antes: POST sem assinatura em `/api/webhooks/clerk` → **400** (a rota está no ar, fora do
  login, e recusa o que não vem assinado).
- *Testing* do Clerk, `user.updated`: entregue com sucesso (`msg_3K5n70sFZM3zz5kL6KK13D2JTMF`).
- Painel em produção com dados ("API ok"). Isso prova a conexão `verify-full` e o login
  depois da CSP obrigatória (#92).

## Decisões e porquês
- **`MIGRATION_DATABASE_URL` não foi criada na Vercel**, ao contrário do que a #91 mandava:
  o `SETUP.md` §4 proíbe, porque o build de preview de qualquer PR poderia migrar a produção.
  Conferido: ela não existia lá.
- **A #64 (validação manual, ~3 h) fica para depois do alinhamento do DOM.** São 48% das
  6,2 h/semana de janela livre.

## Lições
- Variável do tipo **Secret** na Vercel é write-only: ao editar, o campo vem vazio, com um
  texto de exemplo (`postgres://user:pass@db.example.com...`). Salvar assim deixa a produção
  sem banco. Para trocar um parâmetro é preciso colar a string inteira, tirada do `.env` local.
- **Print de tela com segredo:** dois prints do dono ficaram com segredo em texto aberto (a
  senha do `app_rls` e o `whsec_`). Nada foi publicado; a orientação foi apagar os arquivos.
  Se algum print sair da máquina, rotacione.

## Onde paramos / próximo passo
- OrchestraPlanner: só a #64 e a prova opcional de exclusão (#114) na mão do dono.
- Próximo projeto: **DOM**. Respostas do §13 em 2026-10-01: missionário individual e freemium.
  Faltam as perguntas 3 (modo campo sensível no MVP) e 4 (cônjuge/equipe na v1). Ver
  `C:\projetos\DOM\ALINHAMENTO.md`.
