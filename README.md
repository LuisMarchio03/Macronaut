<div align="center">

# 🛰️ Macronaut

**Mission control for your macros & training.**

A personal, installable **nutrition + workout PWA** with a dark, sci‑fi *command‑deck* interface. It talks directly to a [Turso](https://turso.tech) (libSQL) database — no backend server to run.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38BDF8?logo=tailwindcss&logoColor=white)
![Turso](https://img.shields.io/badge/Turso-libSQL-4FF8D2?logo=turso&logoColor=black)
![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white)
![Tests](https://img.shields.io/badge/tests-67%20passing-3FB950)

</div>

> **UI language:** the interface is in **Portuguese (pt‑BR)**. This README is bilingual — [🇬🇧 English](#-english) · [🇧🇷 Português](#-português).

---

## 🇬🇧 English

### What is it?

Macronaut is a single‑page **Progressive Web App** for tracking daily nutrition and strength/cardio training. It's designed to be *your* dashboard: install it on your phone, open it, and everything reads like the instrument panel of a spacecraft — glass panels, corner brackets, monospace readouts and a gauge‑style calorie ring.

It's **online‑first**: the browser speaks to Turso over HTTP, so there is no API server to deploy or maintain. Perfect for a personal, low‑cost, always‑available tool.

### ✨ Features

**Nutrition**
- 🎯 Daily **calorie gauge** (goal vs. consumed) with an instrument‑style ring
- 🧬 **Macro tracking** — protein / carbs / fat, each with its own readout
- 🍽️ **Meals** — configurable meals with times; log foods into each
- 📚 **Food catalog** — your own custom foods **+ TACO** (Brazilian food composition table) import
- 💧 **Water tracking** with a daily goal
- 🧮 **Goal engine** — computes BMR (Mifflin–St Jeor), TDEE via activity factor, adjusts for your objective (cut / maintenance / bulk) and splits your macros automatically

**Training**
- 🏋️ **Workout sessions** — log sets per exercise (reps × weight), grouped by exercise
- 📋 **Exercise library** — full CRUD, with muscle groups
- 🏃 **Cardio** — activity types with MET values; estimates kcal from your weight + duration
- 📈 **Progression charts** — estimated 1RM (e1RM) and top load over time

**Platform**
- 📲 **Installable PWA** — standalone display, offline app shell, auto‑updating service worker
- 🎛️ **Command‑deck design system** — dark indigo theme, glassmorphism HUD panels, monospace instrument readouts, subtle grid + scanlines
- ✅ **Fully tested** — 67 unit/component tests (Vitest + Testing Library) against an in‑memory libSQL database

### 🧱 Tech stack

| Layer | Choice |
|---|---|
| UI | **React 19**, **React Router 7** |
| Data fetching | **TanStack Query 5** |
| Database | **Turso / libSQL** (`@libsql/client`) — accessed directly from the browser |
| Styling | **Tailwind CSS 4**, **Base UI** primitives, `class-variance-authority`, Geist font |
| Build / tooling | **Vite 8**, **TypeScript 6**, `vite-plugin-pwa` |
| Testing | **Vitest 4**, **Testing Library**, jsdom |
| Icons | **lucide-react** |

### 🏗️ Architecture

```
UI (pages / components)  →  hooks (TanStack Query)  →  repositories  →  Turso (libSQL)
                                     ↕
                          domain/ (pure logic: BMR, TDEE, macros, e1RM, MET kcal)
```

- **`src/domain/`** — framework‑free business logic. All the nutrition/training math lives here and is unit‑tested in isolation.
- **`src/repositories/`** — every SQL statement. The only layer that touches the database.
- **`src/hooks/`** — TanStack Query wrappers exposing data + mutations to the UI.
- **`src/components/ui/`** — the design system (`Button`, `Input`, `HudPanel`, …).
- **`src/db/schema.sql`** — the full schema, applied via `npm run migrate`.

### 🚀 Getting started

**Prerequisites:** Node **≥ 22** (the `migrate`/`seed` scripts use native TypeScript execution).

```bash
# 1. Install
npm install

# 2. Point at a database — pick ONE:

#   (a) Cloud Turso
turso db create macronaut
turso db show macronaut --url          # → VITE_TURSO_DATABASE_URL
turso db tokens create macronaut       # → VITE_TURSO_AUTH_TOKEN

#   (b) Local dev database (no cloud, no token)
turso dev --db-file local.db           # serves http://127.0.0.1:8080

# 3. Configure env
cp .env.example .env.local
#   fill in VITE_TURSO_DATABASE_URL and VITE_TURSO_AUTH_TOKEN
#   (for local dev: URL = http://127.0.0.1:8080, token = empty)

# 4. Create the schema + seed defaults
npm run migrate
TACO_JSON=data/taco.sample.json npm run seed   # uses the bundled sample; drop a full data/taco.json for the real table

# 5. Run it
npm run dev
```

### 📜 Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type‑check + production build to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run migrate` | Apply `src/db/schema.sql` to your Turso DB |
| `npm run seed` | Seed default meals, activity types and (optionally) the TACO food table |
| `node --experimental-strip-types scripts/build-medidas.ts` | Generates `src/data/medidas.json` from the IBGE household measures table (POF 2008‑2009). Run by hand; see `docs/superpowers/specs/2026-07-17-registro-alimentos-unidades-design.md`. |

### ☁️ Deploy on Vercel

The app is a static Vite build — `vercel.json` is already configured (framework, SPA rewrites, asset caching).

1. Push the repo to GitHub (rename it to **`macronaut`**).
2. **Import** the project on [Vercel](https://vercel.com/new) — the Vite framework is auto‑detected.
3. Add **Environment Variables** (Production + Preview):
   - `VITE_TURSO_DATABASE_URL`
   - `VITE_TURSO_AUTH_TOKEN`
4. **Deploy.** Run `npm run migrate` / `npm run seed` locally against the *same* Turso database — they are not part of the Vercel build.

Or from the CLI:

```bash
vercel          # preview deploy
vercel --prod   # production deploy
```

### 🔐 Security notes — read before deploying publicly

Because the browser talks to Turso directly, the auth token is **bundled into the client JavaScript** (`VITE_*` variables are public by design). **Anyone who can load the deployed URL can extract the token and gain full read/write access to the database.**

The token also **cannot be read‑only**, because the app writes to the DB.

Mitigations, weakest → strongest:
- ✅ Always use a Turso token **scoped to this database only**.
- 🚧 Keep the deployment **private / behind a non‑guessable URL** (or Vercel Authentication on a paid plan).
- 🛡️ **Proper fix (roadmap):** put a **serverless proxy** (`/api`) in front so the token stays server‑side and the browser never sees it.

### 🗺️ Roadmap

- [ ] Serverless proxy for the Turso token (remove client‑side exposure)
- [ ] Authentication
- [ ] Richer history & analytics views
- [ ] Export / backup

### 📄 License

Private / personal project. All rights reserved unless a license file is added.

---

## 🇧🇷 Português

### O que é?

O Macronaut é um **PWA** (single‑page) para acompanhar nutrição diária e treino de força/cardio. A ideia é ser o *seu* painel: instale no celular, abra, e tudo se parece com o painel de instrumentos de uma nave — painéis de vidro, cantos com brackets, leituras monoespaçadas e um anel de calorias no estilo de um mostrador.

É **online‑first**: o navegador fala com o Turso via HTTP, então **não há servidor de API** para subir ou manter. Perfeito para uma ferramenta pessoal, barata e sempre disponível.

### ✨ Funcionalidades

**Nutrição**
- 🎯 **Mostrador de calorias** do dia (meta vs. consumido) com anel de instrumento
- 🧬 **Macros** — proteína / carboidrato / gordura, cada um com seu readout
- 🍽️ **Refeições** configuráveis com horários; registre alimentos em cada uma
- 📚 **Catálogo de alimentos** — seus alimentos próprios **+ importação da TACO**
- 💧 **Hidratação** com meta diária
- 🧮 **Motor de metas** — calcula TMB (Mifflin–St Jeor), GET pelo fator de atividade, ajusta pelo objetivo (cutting / manutenção / bulking) e divide os macros automaticamente

**Treino**
- 🏋️ **Sessões de treino** — registra séries por exercício (reps × carga), agrupadas
- 📋 **Biblioteca de exercícios** — CRUD completo, com grupos musculares
- 🏃 **Cardio** — atividades com valores de MET; estima kcal pelo seu peso + duração
- 📈 **Progressão** — 1RM estimado (e1RM) e carga máxima ao longo do tempo

**Plataforma**
- 📲 **PWA instalável** — modo standalone, shell offline, service worker com auto‑update
- 🎛️ **Design "command‑deck"** — tema índigo escuro, painéis HUD de vidro, leituras mono, grid + scanlines sutis
- ✅ **Testado** — 67 testes (Vitest + Testing Library) contra um banco libSQL em memória

### 🧱 Stack

| Camada | Escolha |
|---|---|
| UI | **React 19**, **React Router 7** |
| Dados | **TanStack Query 5** |
| Banco | **Turso / libSQL** (`@libsql/client`) — acessado direto do navegador |
| Estilo | **Tailwind CSS 4**, primitivos **Base UI**, `class-variance-authority`, fonte Geist |
| Build | **Vite 8**, **TypeScript 6**, `vite-plugin-pwa` |
| Testes | **Vitest 4**, **Testing Library**, jsdom |
| Ícones | **lucide-react** |

### 🏗️ Arquitetura

```
UI (páginas / componentes) → hooks (TanStack Query) → repositories → Turso (libSQL)
                                      ↕
                        domain/ (lógica pura: TMB, GET, macros, e1RM, MET kcal)
```

- **`src/domain/`** — lógica de negócio sem framework, testada isoladamente.
- **`src/repositories/`** — todo o SQL. Única camada que toca o banco.
- **`src/hooks/`** — wrappers do TanStack Query com dados + mutações.
- **`src/components/ui/`** — o design system (`Button`, `Input`, `HudPanel`, …).
- **`src/db/schema.sql`** — o schema completo, aplicado via `npm run migrate`.

### 🚀 Como rodar

**Pré‑requisito:** Node **≥ 22** (os scripts `migrate`/`seed` executam TypeScript nativo).

```bash
# 1. Instalar
npm install

# 2. Apontar para um banco — escolha UM:

#   (a) Turso na nuvem
turso db create macronaut
turso db show macronaut --url          # → VITE_TURSO_DATABASE_URL
turso db tokens create macronaut       # → VITE_TURSO_AUTH_TOKEN

#   (b) Banco local de dev (sem nuvem, sem token)
turso dev --db-file local.db           # sobe http://127.0.0.1:8080

# 3. Configurar o env
cp .env.example .env.local
#   preencha VITE_TURSO_DATABASE_URL e VITE_TURSO_AUTH_TOKEN
#   (dev local: URL = http://127.0.0.1:8080, token = vazio)

# 4. Criar o schema + seed
npm run migrate
TACO_JSON=data/taco.sample.json npm run seed   # usa a amostra; coloque um data/taco.json completo para a TACO real

# 5. Rodar
npm run dev
```

### ☁️ Deploy na Vercel

O app é um build estático do Vite — o `vercel.json` já está configurado (framework, rewrites de SPA, cache de assets).

1. Suba o repo para o GitHub (renomeie para **`macronaut`**).
2. **Importe** o projeto na [Vercel](https://vercel.com/new) — o framework Vite é detectado automaticamente.
3. Adicione as **Environment Variables** (Production + Preview):
   - `VITE_TURSO_DATABASE_URL`
   - `VITE_TURSO_AUTH_TOKEN`
4. **Deploy.** Rode `npm run migrate` / `npm run seed` localmente contra o *mesmo* banco Turso — eles não fazem parte do build da Vercel.

### 🔐 Segurança — leia antes de publicar

Como o navegador fala direto com o Turso, o token de auth vai **embutido no JavaScript do cliente** (variáveis `VITE_*` são públicas por definição). **Qualquer pessoa com a URL publicada consegue extrair o token e obter leitura/escrita total no banco.** O token também **não pode ser somente‑leitura**, pois o app escreve.

Mitigações, da mais fraca à mais forte:
- ✅ Use sempre um token do Turso **restrito a este banco**.
- 🚧 Mantenha o deploy **privado / com URL não‑adivinhável** (ou Vercel Authentication em plano pago).
- 🛡️ **Correção adequada (roadmap):** um **proxy serverless** (`/api`) na frente, para o token ficar só no servidor.

### 📄 Licença

Projeto pessoal / privado. Todos os direitos reservados até que um arquivo de licença seja adicionado.

## 📚 Fontes de dados

- **TACO** — Tabela Brasileira de Composição de Alimentos, 4ª ed., NEPA/UNICAMP. Macros por 100 g.
- **IBGE / POF 2008‑2009** — *Tabela de Medidas Referidas para os Alimentos Consumidos no Brasil*. Medidas caseiras (fatia, colher, concha) e seus pesos em gramas. Dado estatístico público, reproduzido com citação da fonte.
