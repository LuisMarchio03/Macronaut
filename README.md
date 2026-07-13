<div align="center">

# 🛰️ Macronaut

**Mission control for your macros & training.**

A personal, installable **nutrition + workout PWA** with a dark, sci‑fi *command‑deck* interface. The browser reads and writes **[Turso](https://turso.tech) (libSQL)** directly — the only server code is a login function and a self‑hosted AI gateway.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38BDF8?logo=tailwindcss&logoColor=white)
![Turso](https://img.shields.io/badge/Turso-libSQL-4FF8D2?logo=turso&logoColor=black)
![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white)
![Tests](https://img.shields.io/badge/tests-234%20passing-3FB950)

</div>

> **UI language:** the interface is in **Portuguese (pt‑BR)**. This README is bilingual — [🇬🇧 English](#-english) · [🇧🇷 Português](#-português).

---

## 🇬🇧 English

### What is it?

Macronaut is a single‑page **Progressive Web App** for tracking daily nutrition and strength/cardio training. It's designed to be *your* dashboard: install it on your phone, open it, and everything reads like the instrument panel of a spacecraft — glass panels, corner brackets, monospace readouts and a gauge‑style calorie ring.

There is **no application backend for your data**: after you log in, the browser talks to Turso over HTTP and runs its own SQL. Only two things run server‑side:

- **`api/login.ts`** — one Vercel function that verifies your password (scrypt) and hands the browser its database session.
- **`server/`** — the **AI gateway**, which you self‑host on your own machine (see [AI](#-ai-gemini--aloy)). It is optional; everything else works without it.

### ✨ Features

**Nutrition**
- 🎯 Daily **calorie gauge** (goal vs. consumed) with an instrument‑style ring
- 🧬 **Macro tracking** — protein / carbs / fat, each with its own readout
- 🍽️ **Meals** — configurable meals with times; log foods into each
- 📚 **Food catalog** — your own custom foods **+ TACO** (Brazilian food composition table) import, with autocomplete
- 💧 **Water tracking** with a daily goal
- 🧮 **Goal engine** — computes BMR (Mifflin–St Jeor), TDEE via activity factor, adjusts for your objective (cut / maintenance / bulk) and splits your macros automatically

**Training**
- 🏋️ **Workout sessions** — log sets per exercise (reps × weight), grouped by exercise
- 📋 **Exercise library** — full CRUD, with muscle groups
- 🏃 **Cardio** — activity types with MET values; estimates kcal from your weight + duration
- 📈 **Progression charts** — estimated 1RM (e1RM) and top load over time

**Analytics** (`/analise`)
- 📊 Trends over a selectable period: nutrition, energy balance, body weight, water, activity and training

**AI** (`/ia`)
- 🤖 Chat with **Gemini** (your own API key) or **ALOY** (a local LLM on your machine), both aware of your actual logged data
- 🔌 Per‑provider enable/disable and live status badges

**Platform**
- 📲 **Installable PWA** — standalone display, offline app shell, auto‑updating service worker
- 🎛️ **Command‑deck design system** — dark indigo theme, glassmorphism HUD panels, monospace instrument readouts, subtle grid + scanlines
- ✅ **Fully tested** — 234 unit/component tests (Vitest + Testing Library) against a real in‑memory libSQL database

### 🧱 Tech stack

| Layer | Choice |
|---|---|
| UI | **React 19**, **React Router 7** |
| Data fetching | **TanStack Query 5** |
| Database | **Turso / libSQL** (`@libsql/client`) — queried directly from the browser |
| Login | one **Vercel serverless function**; scrypt via `node:crypto` |
| AI gateway | plain **Node `http`** server you host yourself (Gemini + ALOY) |
| Styling | **Tailwind CSS 4**, **Base UI** primitives, `class-variance-authority`, Geist font |
| Build / tooling | **Vite 8**, **TypeScript 6**, `vite-plugin-pwa` |
| Testing | **Vitest 4**, **Testing Library**, jsdom |
| Icons | **lucide-react** |

### 🏗️ Architecture

Each layer only talks to the one below it:

```
pages / components  →  hooks (TanStack Query)  →  repositories (SQL)  →  Turso (libSQL)
                                  ↕
                      domain/  (pure logic — no DB, no React)

api/login.ts   → the only data-path server code: verifies the password, returns the DB session
server/        → AI gateway (self-hosted): browser → gateway → Gemini / ALOY
```

- **`src/domain/`** — framework‑free business logic, unit‑tested in isolation: `nutrition.ts` (BMR, TDEE, macro split), `treino.ts` (e1RM), the `analise-*.ts` analytics modules, `periodo.ts`, `taco.ts`, and `auth.ts` (scrypt — server/script side only, never imported by the browser).
- **`src/repositories/`** — the **only** layer that runs SQL. Every function takes `db: Client` as its first argument, which is what makes them testable against an in‑memory database. Tables are scoped by a `user_id` **column**, so every query must filter by user.
- **`src/hooks/`** — TanStack Query wrappers (data + mutations + cache invalidation).
- **`src/components/ui/`** — the design system (`Button`, `Input`, `HudPanel`, …).
- **`src/db/schema.sql`** — the schema, applied by `npm run db:setup`. There is no migration framework: the file is all `CREATE TABLE IF NOT EXISTS`, so it can never alter a table that already exists. Columns added **after** a database was first created therefore live in `ADDITIVE_COLUMNS` in `scripts/lib/apply-schema.ts` (today: the three AI columns on `users`), applied as idempotent `ALTER TABLE`s right after the schema. **Adding a column to an existing table means touching both files.**

### 🚀 Getting started

**Prerequisites:** Node **≥ 22** — the `scripts/` run TypeScript natively (`--experimental-strip-types`) and read `.env.local` via `--env-file`.

```bash
# 1. Install
npm install

# 2. Create a Turso database
turso db create macronaut
turso db show macronaut --url        # → DB_URL
turso db tokens create macronaut     # → DB_TOKEN  (must be read/write)

# 3. Configure env
cp .env.example .env.local
#   fill in DB_URL and DB_TOKEN — server-only, NEVER prefixed with VITE_

# 4. Create the schema + seed the global catalogs
npm run db:setup
#   applies schema.sql, seeds activity types and the TACO food table
#   (uses data/taco.sample.json; point TACO_JSON at a full data/taco.json for the real one)

# 5. Create your user (and their default meals)
npm run create-user -- --email you@example.com --senha 'your-password'

# 6. Run it
npm run dev
```

Every screen sits behind a login, so step 5 is not optional.

### 🤖 AI (Gemini + ALOY)

The AI section is **optional** and needs the gateway running — it is what the browser talks to, and it is never hosted on Vercel (ALOY is a local LLM on your own machine).

```bash
npm run ai:gateway                                        # starts the gateway (default :8787)
npm run ai:flags -- --email you@example.com --gemini on --aloy on   # enable providers
```

Then add your **Gemini API key** in the app under *Ajustes*. It is stored per user in the database and only ever leaves it through the gateway — never through the browser.

Relevant env (all server‑only, in `.env.local`): `ALOY_URL` (default `http://127.0.0.1:8080`), `ALOY_MACRONAUT_APP_TOKEN`, `GEMINI_MODEL` (default `gemini-flash-latest`), `PORT`. The client only needs `VITE_AI_GATEWAY_URL`, which is just the gateway's address.

> **Both AIs showing as offline?** That badge means *"couldn't reach the gateway"*, not *"the model is down"*. Check, in order: the gateway is running; `VITE_AI_GATEWAY_URL` is set **and you redeployed** (it is baked in at build time); and the gateway's `DB_TOKEN` matches the one the app logs in with.

### 📜 Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type‑check (`src`/`test`/`api` **and** the Node configs) + production build to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run db:setup` | Apply `src/db/schema.sql` + seed activity types and TACO foods |
| `npm run create-user` | Create a user and their default meals (`-- --email … --senha …`) |
| `npm run ai:flags` | Enable/disable AI providers for a user (`-- --email … --gemini on --aloy off`) |
| `npm run ai:gateway` | Run the AI gateway |

Running a **single test** needs the flag that `npm test` sets, or jsdom breaks (Node 22+ ships an experimental `localStorage` that collides with it):

```bash
NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/domain/nutrition.test.ts
```

### ☁️ Deploy on Vercel

The app is a static Vite build plus one function — `vercel.json` is already configured (framework, SPA rewrites, asset caching).

1. Push the repo to GitHub and **import** it on [Vercel](https://vercel.com/new) — Vite is auto‑detected.
2. Add the **Environment Variables** (Production + Preview):
   - `DB_URL`, `DB_TOKEN` — **server‑only**, no `VITE_` prefix (used by `api/login.ts`).
   - `DB_URL_PUBLIC` — *optional*, if the URL handed to the browser differs from `DB_URL` (e.g. a replica).
   - `VITE_AI_GATEWAY_URL` — **only if you want the AI section**. See below.
3. **Deploy.** Run `npm run db:setup` / `npm run create-user` locally against the *same* Turso database — they are not part of the Vercel build.

Or from the CLI: `vercel` (preview) / `vercel --prod` (production).

#### The AI section needs one extra step

The gateway runs **on your machine**, next to ALOY — Vercel cannot host it. The deployed app reaches it over your **Tailnet**, and there are two traps:

- **`VITE_AI_GATEWAY_URL` is read at build time.** If it is missing on Vercel, the base URL becomes `""`, the app calls `/ai/health` on its own domain, the SPA rewrite answers with `index.html`, and **both AIs show up as offline** — with nothing actually wrong with them. Changing this variable requires a **redeploy**.
- **It must be `https://`.** The Vercel page is HTTPS, so pointing at `http://<tailnet-ip>:8787` is mixed content and the browser blocks it. Expose the gateway with a real certificate:

```bash
tailscale serve --bg --https 8443 http://127.0.0.1:8787
# → https://<machine>.<tailnet>.ts.net:8443   (use this as VITE_AI_GATEWAY_URL)
```

Vercel's `DB_TOKEN` and the gateway's `DB_TOKEN` **must be the same value** — the gateway authenticates by comparing the session's Bearer token against its own `DB_TOKEN`. If you rotate one, rotate the other **and log in again** (the stored session still holds the old token).

### 🔐 Security — read before deploying publicly

The database token is **no longer bundled into the client JavaScript** — `api/login.ts` holds `DB_URL` / `DB_TOKEN` in non‑`VITE_` env vars and only releases them after a correct password (scrypt, constant‑time, with a dummy hash verified for unknown e‑mails so timing doesn't leak which accounts exist).

But be clear about what that buys you:

- **After login, the DB token *is* in the browser** (in `localStorage`) and grants full read/write to the **whole** database. **The login gate is the only barrier — there is no per‑user isolation at the database level.**
- Ownership is enforced only by filtering on the `user_id` **column**, in application queries. New repository code must keep doing that.
- The token **cannot be read‑only**, because the app writes.

Practical consequences:
- ✅ Use a Turso token **scoped to this database only**.
- ✅ Use a strong password — it is the single thing protecting the token.
- ⚠️ Only give accounts to people you would trust with **everyone's** data in that database. For real multi‑tenancy you would need per‑user databases or a full server‑side data API.
- 🔑 **`VITE_*` is public by definition.** Never put a secret in one.

### 🗺️ Roadmap

- [x] Server‑side login (the Turso token is no longer in the bundle)
- [x] Analytics views (`/analise`)
- [x] AI assistant (Gemini + ALOY)
- [ ] Per‑user database isolation (today, one login = full DB access)
- [ ] Export / backup

### 📄 License

Private / personal project. All rights reserved unless a license file is added.

---

## 🇧🇷 Português

### O que é?

O Macronaut é um **PWA** (single‑page) para acompanhar nutrição diária e treino de força/cardio. A ideia é ser o *seu* painel: instale no celular, abra, e tudo se parece com o painel de instrumentos de uma nave — painéis de vidro, cantos com brackets, leituras monoespaçadas e um anel de calorias no estilo de um mostrador.

**Não há backend de aplicação para os seus dados**: depois do login, o navegador fala com o Turso via HTTP e roda o SQL por conta própria. Só duas coisas rodam no servidor:

- **`api/login.ts`** — uma única function na Vercel, que confere a senha (scrypt) e entrega ao navegador a sessão do banco.
- **`server/`** — o **gateway de IA**, que você hospeda **na sua própria máquina** (veja [IA](#-ia-gemini--aloy)). É opcional; todo o resto funciona sem ele.

### ✨ Funcionalidades

**Nutrição**
- 🎯 **Mostrador de calorias** do dia (meta vs. consumido) com anel de instrumento
- 🧬 **Macros** — proteína / carboidrato / gordura, cada um com seu readout
- 🍽️ **Refeições** configuráveis com horários; registre alimentos em cada uma
- 📚 **Catálogo de alimentos** — seus alimentos próprios **+ importação da TACO**, com autocomplete
- 💧 **Hidratação** com meta diária
- 🧮 **Motor de metas** — calcula TMB (Mifflin–St Jeor), GET pelo fator de atividade, ajusta pelo objetivo (cutting / manutenção / bulking) e divide os macros automaticamente

**Treino**
- 🏋️ **Sessões de treino** — registra séries por exercício (reps × carga), agrupadas
- 📋 **Biblioteca de exercícios** — CRUD completo, com grupos musculares
- 🏃 **Cardio** — atividades com valores de MET; estima kcal pelo seu peso + duração
- 📈 **Progressão** — 1RM estimado (e1RM) e carga máxima ao longo do tempo

**Análise** (`/analise`)
- 📊 Tendências por período: nutrição, balanço energético, peso, água, atividade e treino

**IA** (`/ia`)
- 🤖 Converse com o **Gemini** (sua própria API key) ou com a **ALOY** (LLM local, na sua máquina) — os dois enxergam os seus dados reais registrados
- 🔌 Liga/desliga por provedor, com badges de status ao vivo

**Plataforma**
- 📲 **PWA instalável** — modo standalone, shell offline, service worker com auto‑update
- 🎛️ **Design "command‑deck"** — tema índigo escuro, painéis HUD de vidro, leituras mono, grid + scanlines sutis
- ✅ **Testado** — 234 testes (Vitest + Testing Library) contra um banco libSQL de verdade, em memória

### 🧱 Stack

| Camada | Escolha |
|---|---|
| UI | **React 19**, **React Router 7** |
| Dados | **TanStack Query 5** |
| Banco | **Turso / libSQL** (`@libsql/client`) — consultado direto do navegador |
| Login | uma **serverless function** na Vercel; scrypt via `node:crypto` |
| Gateway de IA | servidor **Node `http`** puro, hospedado por você (Gemini + ALOY) |
| Estilo | **Tailwind CSS 4**, primitivos **Base UI**, `class-variance-authority`, fonte Geist |
| Build | **Vite 8**, **TypeScript 6**, `vite-plugin-pwa` |
| Testes | **Vitest 4**, **Testing Library**, jsdom |
| Ícones | **lucide-react** |

### 🏗️ Arquitetura

Cada camada só conversa com a de baixo:

```
páginas / componentes  →  hooks (TanStack Query)  →  repositories (SQL)  →  Turso (libSQL)
                                     ↕
                         domain/  (lógica pura — sem banco, sem React)

api/login.ts   → único código de servidor no caminho dos dados: confere a senha, devolve a sessão
server/        → gateway de IA (auto-hospedado): navegador → gateway → Gemini / ALOY
```

- **`src/domain/`** — lógica de negócio sem framework, testada isoladamente: `nutrition.ts` (TMB, GET, divisão de macros), `treino.ts` (e1RM), os módulos de análise `analise-*.ts`, `periodo.ts`, `taco.ts` e `auth.ts` (scrypt — só servidor/scripts, **nunca** importado pelo navegador).
- **`src/repositories/`** — a **única** camada que roda SQL. Toda função recebe `db: Client` como primeiro argumento — é isso que as torna testáveis contra um banco em memória. As tabelas são separadas por uma **coluna** `user_id`, então toda query precisa filtrar por usuário.
- **`src/hooks/`** — wrappers do TanStack Query (dados + mutações + invalidação de cache).
- **`src/components/ui/`** — o design system (`Button`, `Input`, `HudPanel`, …).
- **`src/db/schema.sql`** — o schema, aplicado pelo `npm run db:setup`. Não há framework de migração: o arquivo é todo `CREATE TABLE IF NOT EXISTS`, então ele nunca consegue alterar uma tabela que já existe. Por isso, colunas adicionadas **depois** que um banco já foi criado ficam em `ADDITIVE_COLUMNS`, em `scripts/lib/apply-schema.ts` (hoje: as três colunas de IA em `users`), aplicadas como `ALTER TABLE` idempotentes logo após o schema. **Adicionar uma coluna a uma tabela existente significa mexer nos dois arquivos.**

### 🚀 Como rodar

**Pré‑requisito:** Node **≥ 22** — os `scripts/` executam TypeScript nativo (`--experimental-strip-types`) e leem o `.env.local` via `--env-file`.

```bash
# 1. Instalar
npm install

# 2. Criar um banco no Turso
turso db create macronaut
turso db show macronaut --url        # → DB_URL
turso db tokens create macronaut     # → DB_TOKEN  (precisa ser de leitura/escrita)

# 3. Configurar o env
cp .env.example .env.local
#   preencha DB_URL e DB_TOKEN — só servidor, NUNCA com prefixo VITE_

# 4. Criar o schema + seed dos catálogos globais
npm run db:setup
#   aplica o schema.sql, seeda os tipos de atividade e a tabela TACO
#   (usa data/taco.sample.json; aponte TACO_JSON para um data/taco.json completo para a TACO real)

# 5. Criar o seu usuário (e as refeições padrão dele)
npm run create-user -- --email voce@exemplo.com --senha 'sua-senha'

# 6. Rodar
npm run dev
```

Todas as telas ficam atrás do login, então o passo 5 não é opcional.

### 🤖 IA (Gemini + ALOY)

A seção de IA é **opcional** e depende do gateway no ar — é com ele que o navegador fala, e ele **nunca** roda na Vercel (a ALOY é um LLM local, na sua máquina).

```bash
npm run ai:gateway                                          # sobe o gateway (padrão :8787)
npm run ai:flags -- --email voce@exemplo.com --gemini on --aloy on   # habilita os provedores
```

Depois cadastre a sua **chave do Gemini** no app, em *Ajustes*. Ela fica guardada por usuário no banco e só sai de lá através do gateway — nunca pelo navegador.

Env relevante (tudo server‑only, no `.env.local`): `ALOY_URL` (padrão `http://127.0.0.1:8080`), `ALOY_MACRONAUT_APP_TOKEN`, `GEMINI_MODEL` (padrão `gemini-flash-latest`), `PORT`. O cliente só precisa da `VITE_AI_GATEWAY_URL`, que é apenas o endereço do gateway.

> **As duas IAs aparecendo como offline?** Esse badge quer dizer *"não consegui alcançar o gateway"*, e não *"o modelo caiu"*. Cheque, nesta ordem: o gateway está rodando; a `VITE_AI_GATEWAY_URL` está setada **e você redeployou** (ela é embutida no build); e o `DB_TOKEN` do gateway é o mesmo com que o app faz login.

### 📜 Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Sobe o dev server do Vite |
| `npm run build` | Type‑check (`src`/`test`/`api` **e** os configs de Node) + build de produção em `dist/` |
| `npm run preview` | Serve o build de produção localmente |
| `npm test` | Roda a suíte uma vez |
| `npm run test:watch` | Roda os testes em watch |
| `npm run db:setup` | Aplica o `src/db/schema.sql` + seed de tipos de atividade e alimentos da TACO |
| `npm run create-user` | Cria um usuário e as refeições padrão dele (`-- --email … --senha …`) |
| `npm run ai:flags` | Liga/desliga provedores de IA para um usuário (`-- --email … --gemini on --aloy off`) |
| `npm run ai:gateway` | Sobe o gateway de IA |

Rodar **um teste isolado** exige a mesma flag que o `npm test` define, senão o jsdom quebra (o Node 22+ traz um `localStorage` experimental que colide com o dele):

```bash
NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/domain/nutrition.test.ts
```

### ☁️ Deploy na Vercel

O app é um build estático do Vite mais uma function — o `vercel.json` já está configurado (framework, rewrites de SPA, cache de assets).

1. Suba o repo para o GitHub e **importe** na [Vercel](https://vercel.com/new) — o Vite é detectado automaticamente.
2. Adicione as **Environment Variables** (Production + Preview):
   - `DB_URL`, `DB_TOKEN` — **só servidor**, sem prefixo `VITE_` (usados pelo `api/login.ts`).
   - `DB_URL_PUBLIC` — *opcional*, se a URL entregue ao navegador for diferente da `DB_URL` (ex.: uma réplica).
   - `VITE_AI_GATEWAY_URL` — **só se você quiser a seção de IA**. Veja abaixo.
3. **Deploy.** Rode `npm run db:setup` / `npm run create-user` localmente contra o *mesmo* banco Turso — eles não fazem parte do build da Vercel.

Ou pela CLI: `vercel` (preview) / `vercel --prod` (produção).

#### A seção de IA exige um passo extra

O gateway roda **na sua máquina**, junto da ALOY — a Vercel não o hospeda. O app publicado o alcança pelo seu **Tailnet**, e há duas armadilhas:

- **`VITE_AI_GATEWAY_URL` é lida no build.** Se ela faltar na Vercel, a URL base vira `""`, o app chama `/ai/health` no próprio domínio, o rewrite de SPA devolve `index.html` e **as duas IAs aparecem como offline** — sem que haja nada de errado com elas. Trocar essa variável exige **redeploy**.
- **Tem que ser `https://`.** A página da Vercel é HTTPS; apontar para `http://<ip-do-tailnet>:8787` é *mixed content* e o navegador bloqueia. Exponha o gateway com um certificado de verdade:

```bash
tailscale serve --bg --https 8443 http://127.0.0.1:8787
# → https://<maquina>.<tailnet>.ts.net:8443   (use esta URL na VITE_AI_GATEWAY_URL)
```

O `DB_TOKEN` da Vercel e o do gateway **precisam ser o mesmo valor** — o gateway autentica comparando o Bearer da sessão contra o `DB_TOKEN` dele. Se você rotacionar um, rotacione o outro **e refaça o login** (a sessão salva ainda guarda o token velho).

### 🔐 Segurança — leia antes de publicar

O token do banco **não vai mais embutido no JavaScript do cliente** — o `api/login.ts` guarda `DB_URL` / `DB_TOKEN` em variáveis sem prefixo `VITE_` e só os entrega depois da senha correta (scrypt, comparação em tempo constante, verificando um hash fictício mesmo para e‑mails inexistentes, para que o tempo de resposta não revele quais contas existem).

Mas seja claro sobre o que isso compra:

- **Depois do login, o token do banco *está* no navegador** (no `localStorage`) e dá leitura/escrita total no banco **inteiro**. **O login é a única barreira — não existe isolamento por usuário no nível do banco.**
- A propriedade dos dados é garantida apenas pelo filtro na **coluna** `user_id`, nas queries da aplicação. Todo repository novo precisa continuar fazendo isso.
- O token **não pode ser somente‑leitura**, porque o app escreve.

Consequências práticas:
- ✅ Use um token do Turso **restrito a este banco**.
- ✅ Use uma senha forte — é a única coisa protegendo o token.
- ⚠️ Só dê conta a quem você confiaria os dados de **todo mundo** nesse banco. Multi‑tenancy de verdade exigiria um banco por usuário ou uma API de dados no servidor.
- 🔑 **`VITE_*` é público por definição.** Nunca coloque um segredo em uma.

### 🗺️ Roadmap

- [x] Login no servidor (o token do Turso saiu do bundle)
- [x] Telas de análise (`/analise`)
- [x] Assistente de IA (Gemini + ALOY)
- [ ] Isolamento de banco por usuário (hoje, um login = acesso ao banco todo)
- [ ] Exportação / backup

### 📄 Licença

Projeto pessoal / privado. Todos os direitos reservados até que um arquivo de licença seja adicionado.
