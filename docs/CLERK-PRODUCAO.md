# Clerk de produção — passo a passo para o dono

> **Por quê:** a produção (`orchestra-planner.vercel.app`) usa hoje a instância de
> **desenvolvimento** do Clerk — a mesma do E2E. Isso põe o selo "Development mode" na tela de
> login, aplica os limites de uma instância de testes e mistura usuário de teste com usuário
> real. Este guia troca a produção para uma instância de produção.
>
> **Escrito em 2026-10-10 pela sessão de UX, sem mexer em conta nenhuma.** Os nomes exatos de
> menus e registros DNS podem mudar no painel do Clerk; quando divergirem, vale o painel.
> Nenhum passo aqui exige mudar código: a CSP (#92) já monta o domínio do Clerk a partir da
> chave publicável, e as variáveis de ambiente são as mesmas.

## Resumo

| # | Etapa | Onde | Tempo de mão | Espera |
|---|---|---|---|---|
| 0 | Decidir o domínio | — | 10 min | — |
| 1 | Domínio no ar na Vercel | registrador + Vercel | 20 min | até algumas horas de DNS |
| 2 | Criar a instância de produção | Clerk | 15 min | — |
| 3 | Registros DNS do Clerk | registrador + Clerk | 20 min | até algumas horas de DNS |
| 4 | Login com Google (opcional) | Google Cloud + Clerk | 30 min | — |
| 5 | Variáveis na Vercel e redeploy | Vercel | 15 min | 3 min de build |
| 6 | Webhook de produção | Clerk + Vercel | 10 min | — |
| 7 | Levar seus dados para o usuário novo | Clerk + script | 20–30 min | — |
| 8 | Conferir | navegador | 15 min | — |

**Total de mão: ~2,5 h** (2 h sem o Google), espalhadas em dois dias por causa do DNS. É ~40%
das 6,2 h livres da semana. Etapas 1–3 numa sessão, 4–8 na seguinte.

## Antes de começar

- **A etapa 7 é obrigatória e é o risco desta troca.** O banco guarda tudo pelo ID de usuário
  do Clerk (`user_…`). A instância de produção cria usuários **novos, com outro ID**, e seus
  dados continuam no banco presos ao ID antigo. Nada se perde, mas nada aparece até a etapa 7.
- **Não entre no app de produção antes da etapa 7.** O e-mail é único no banco e ainda pertence
  ao ID antigo: o primeiro acesso do ID novo com o mesmo e-mail dá **erro na tela** (e o webhook
  do Clerk falha e fica reentregando). Não estraga nada, mas assusta. A etapa 7 cria o usuário
  novo pelo painel do Clerk, roda o script e só então você entra.
- Baixe seus dados antes (**Conta** → *Baixar meus dados (JSON)*). É o seu backup legível.
- **O E2E continua na instância de desenvolvimento.** O usuário de teste (`+clerk_test@`) e o
  código fixo 424242 só existem lá. Os secrets do GitHub (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`,
  `CLERK_SECRET_KEY`, `E2E_CLERK_*`) e o `.env` local **não mudam**.

## 0. Decidir o domínio

O Clerk de produção exige **um domínio seu**; não funciona em `*.vercel.app`. Duas saídas:

- **Comprar um** (ex.: `orchestraplanner.com.br` no Registro.br, ~R$ 40/ano).
- **Usar um subdomínio de um domínio que você já tem** (ex.: `planner.seudominio.com.br`).

O resto do guia chama esse domínio de `SEU-DOMINIO`.

## 1. Domínio no ar na Vercel

1. Vercel → projeto `orchestra-planner` → **Settings → Domains → Add** → `SEU-DOMINIO`.
2. A Vercel mostra o registro DNS a criar (um `A` para domínio raiz ou um `CNAME` para
   subdomínio). Crie exatamente esse registro no painel de DNS do seu registrador.
3. Espere a Vercel marcar **Valid Configuration**. O `orchestra-planner.vercel.app` continua
   funcionando em paralelo.

## 2. Criar a instância de produção

1. Clerk Dashboard → aplicação **OrchestraPlanner** → seletor de ambiente no topo →
   **Production** → *Create production instance*.
2. Quando perguntar, escolha **clonar as configurações** da instância de desenvolvimento
   (métodos de login, caminhos, aparência).
3. Domínio da aplicação: `SEU-DOMINIO`.
4. Em **Paths**, confira: entrar em `/sign-in`, cadastrar em `/sign-up`, depois do login
   `/dashboard`.

## 3. Registros DNS do Clerk

Clerk → (instância Production) → **Configure → Domains**. Ele lista uns cinco `CNAME` para
criar no seu DNS — tipicamente:

| Nome | Para quê |
|---|---|
| `clerk.SEU-DOMINIO` | Frontend API (é o que o navegador chama no login) |
| `accounts.SEU-DOMINIO` | Páginas de conta hospedadas pelo Clerk |
| `clkmail.SEU-DOMINIO` | Envio de e-mail (código de verificação) |
| `clk._domainkey…` e `clk2._domainkey…` | Assinatura DKIM dos e-mails |

1. Copie **nome e valor exatamente como o painel mostra** (não digite à mão).
2. Crie cada um no DNS do registrador.
3. No Clerk, clique em **Verify** até todos ficarem verdes. Depois ele emite os certificados
   sozinho (pode levar alguns minutos além do DNS).

## 4. Login com Google (opcional)

Em desenvolvimento o Clerk usa credenciais do Google compartilhadas; em produção ele exige as
suas. Se você não usa "Continuar com Google", **desligue** o Google na instância de produção e
pule esta etapa.

1. Google Cloud Console → projeto novo → **APIs e serviços → Tela de consentimento OAuth**:
   tipo externo, nome "OrchestraPlanner", seu e-mail.
2. **Credenciais → Criar credenciais → ID do cliente OAuth** → aplicativo da Web.
3. Em *URIs de redirecionamento autorizados*, cole a URI que o Clerk mostra em
   **Configure → SSO connections → Google** (instância Production).
4. Cole o *Client ID* e o *Client Secret* no Clerk e salve.
5. Publique a tela de consentimento ("Em produção"); em modo de teste, só e-mails cadastrados
   entram.

## 5. Variáveis na Vercel e redeploy

Clerk (Production) → **API Keys**: copie a `pk_live_…` e a `sk_live_…`.

Vercel → **Settings → Environment Variables**, **só no ambiente Production**:

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_…` |
| `CLERK_SECRET_KEY` | `sk_live_…` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` (igual a hoje) |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` (igual a hoje) |

- **Preview e Development continuam com as chaves de teste** (`pk_test_…`/`sk_test_…`): os
  PRs seguem abrindo com a instância de desenvolvimento.
- **Cuidado aprendido em 2026-10-01:** variável do tipo *Secret* abre **vazia** ao editar.
  Cole o valor inteiro; salvar o campo vazio derruba a produção.
- Não crie `MIGRATION_DATABASE_URL` na Vercel (`docs/SETUP.md` §4).
- **Deployments → último de produção → Redeploy**, sem cache.

## 6. Webhook de produção

O webhook atual está na instância de desenvolvimento e não vê os usuários da de produção.

1. Clerk (Production) → **Webhooks → Add Endpoint**:
   `https://SEU-DOMINIO/api/webhooks/clerk`, eventos `user.created`, `user.updated` e
   `user.deleted`.
2. Copie o **Signing Secret** (`whsec_…`) → Vercel → `CLERK_WEBHOOK_SIGNING_SECRET`
   (Production, colando o valor inteiro) → redeploy.
3. Clerk → *Testing* → `user.updated` de exemplo → a resposta tem de ser **204** (400 = segredo
   errado).
4. O webhook antigo, na instância de desenvolvimento, continua mandando eventos para a
   produção, que agora confere o segredo novo e responde 400. Não estraga nada, mas enche o
   painel do Clerk de falhas: desative esse endpoint (Clerk Development → Webhooks).

## 7. Levar seus dados para o usuário novo

O script é `scripts/troca-de-dono.ts`. Numa transação só, ele cria a linha nova em `users`
(com o seu fuso e a data de cadastro), passa o `user_id` de **toda tabela que tem a coluna**
(a mesma lista do "Baixar meus dados") do ID antigo para o novo, confere linha por linha e apaga
a linha antiga. **Por padrão só simula**: faz tudo, confere e desfaz no fim.

1. Clerk (**Production**) → **Users → Create user** → o **mesmo e-mail** de sempre (e uma senha,
   se você entra com senha). Copie o ID novo (`user_…`). Ainda **não** entre no app.
2. Clerk (**Development**) → **Users** → você → copie o ID antigo.
3. No seu computador, na pasta do projeto, com o `.env` de sempre (é a
   `MIGRATION_DATABASE_URL` que vale aqui), **simule**:

   ```
   npx tsx scripts/troca-de-dono.ts --de user_ANTIGO --para user_NOVO
   ```

   Confira o banco na primeira linha e a lista por tabela (metas, pessoas, lançamentos…). Os
   números têm de bater com o que você tem no app.
4. Se bateu, **aplique** (mesmo comando + `--aplicar`):

   ```
   npx tsx scripts/troca-de-dono.ts --de user_ANTIGO --para user_NOVO --aplicar
   ```

5. Entre em `https://SEU-DOMINIO`: metas, agenda, pessoas e finanças estão lá.

**Se o script recusar:**

- *"conexão sujeita à RLS"*: o `.env` está com a conexão do app. Ele só roda com a do dono.
- *"o usuário antigo não existe"*: o ID antigo está errado (ou a troca já foi feita).
- *"a conta nova já tem dados"*: você usou a conta nova antes do script. Se o que está lá pode
  ser apagado, rode de novo com `--descartar-dados-da-conta-nova`. Uma conta recém-criada (só
  as Áreas de Vida padrão) é substituída sem precisar disso.
- Qualquer outro erro: nada foi gravado (é uma transação só). Mande o texto do erro ao Claude.

**Depois:** o Clerk reentrega o `user.created` da conta nova que tinha falhado; agora ele só
atualiza nome e e-mail e não traz de volta área padrão que você tinha apagado.

## 8. Conferir

- [ ] `https://SEU-DOMINIO/sign-in` em português e **sem** o selo "Development mode".
- [ ] Login com e-mail (e com Google, se ligou) leva ao painel com seus dados.
- [ ] Clerk (Production) → Webhooks → as entregas mais recentes com 2xx.
- [ ] DevTools → Console sem erro de *Content Security Policy* no login e nas telas.
- [ ] Opcional: `orchestra-planner.vercel.app` redirecionando para `SEU-DOMINIO`
      (Vercel → Domains → *Redirect*).

## Para desfazer

Volte as variáveis de Production na Vercel para as chaves `pk_test_`/`sk_test_` e o webhook
antigo, e faça redeploy. Os dados não são afetados até a etapa 7; depois dela, o mesmo script roda no sentido
inverso (`--de user_NOVO --para user_ANTIGO`).
