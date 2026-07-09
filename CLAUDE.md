# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Macronaut is an installable **nutrition + workout PWA** (React 19 SPA) that talks to a **Turso / libSQL** database. There is **no application backend for data** — the browser reads and writes SQL directly. The only server code is a single Vercel serverless function that handles login (`api/`).

**Language convention:** the entire codebase is **Portuguese (pt-BR)** — identifiers, DB columns, routes, UI strings, test descriptions, and the `docs/` design docs. Match this. Only infra/config keys are English.

## Commands

```bash
npm run dev            # Vite dev server
npm run build          # tsc -b (src/test/api) + tsc on node config + vite build → dist/
npm run preview        # serve the production build
npm test               # run the whole suite once
npm run test:watch     # watch mode

npm run db:setup                                   # apply schema.sql + seed activity types + TACO foods
npm run create-user -- --email you@x.com --senha •••   # create a user + their default meals
```

- **Node ≥ 22 is required.** The `scripts/` run TypeScript natively via `node --experimental-strip-types --env-file=.env.local`, so `db:setup`/`create-user` read `.env.local` automatically (the app's own `VITE_*` vars are separate — see below).
- **Running a single test** needs the same Node flag the `test` script sets, or jsdom breaks:
  ```bash
  NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/domain/nutrition.test.ts
  NODE_OPTIONS=--no-experimental-webstorage npx vitest run -t "case-insensitive"
  ```
  (Node 22+ ships an experimental `localStorage` that collides with jsdom's; the flag disables it.)
- `build` type-checks with **both** `tsconfig.json` (src/test/api) and `tsconfig.node.json` (vite/vitest configs). `strict` + `noUnusedLocals`/`noUnusedParameters` are on, so dead code fails the build, not just lint.
- Path alias `@/*` → `src/*` (configured in `tsconfig.json`, `vite.config.ts`, and `vitest.config.ts`).

## Architecture

### The layers (each only talks to the one below it)

```
pages / components  →  hooks (TanStack Query)  →  repositories (SQL)  →  libSQL Client
                                    ↕
                        domain/  (pure logic, no DB, no React)
```

- **`src/domain/`** — framework-free business logic, unit-tested in isolation: nutrition math (Mifflin–St Jeor BMR, TDEE, macro split in `nutrition.ts`), training (`treino.ts`, e1RM), the `analise-*.ts` analytics modules, `periodo.ts`, and `auth.ts` (scrypt password hashing via `node:crypto` — server/script side only, never imported by the browser). No SQL, no React here.
- **`src/repositories/`** — the **only** layer that runs SQL. Every file exports plain functions whose first argument is `db: Client` (never a module-global client) and maps rows to domain types via a local `mapRow`. Passing `db` in is what makes them testable against an in-memory DB. Tables are scoped by a `user_id` **column** — there is no DB-level row security, so app queries must filter by user.
- **`src/hooks/`** — TanStack Query wrappers. Each gets the client from `useDb()` and the id from `useUserId()`, calls repository functions, and (for mutations) invalidates related query keys. Query keys are static string arrays.
- **`src/lib/`** — cross-cutting infra: `db.ts` / `db-context.tsx` (the client + its React context), `query-client.ts` (the **singleton** QueryClient + a global auth-error handler), `auth-context.tsx` + `session.ts` (login/logout + localStorage session), `date.ts`, `utils.ts`.
- **`src/components/`** — UI. `components/ui/` is the design system (Base UI primitives + CVA: `button`, `input`, `hud-panel`, `sheet`, …); `components/treino/` groups the training tabs.
- **`src/pages/`** — routed screens.

### Auth + data-access model (read this before touching auth, env vars, or the DB)

The README's client-side `VITE_TURSO_*` tokens are **gone**. The current flow:

1. The browser POSTs email/password to **`api/login.ts`** (the one Vercel function). The server holds `DB_URL` / `DB_TOKEN` in **non-`VITE_` env vars** so they are never bundled into client JS.
2. `api/login.ts` verifies the password with scrypt (constant-time; a `DUMMY_HASH` is verified even for unknown emails to avoid timing/enumeration leaks) and returns `{ user, dbUrl, token }`. The pure, DI-based orchestration lives in `api/_lib/login-core.ts` (testable, no Vercel types); the handler is just the HTTP shell.
3. The client saves that session (**including the DB token**) to `localStorage` and builds its own libSQL client with `createUserDb(dbUrl, token)`.

So after login the DB token **is** in the browser and grants full read/write to the shared database — **the login gate is the only barrier; there is no per-user DB isolation.** Enforce ownership by filtering on `user_id` in every query.

**Env var rule:** `VITE_*` = public, bundled into the client (use only for non-secrets). Server secrets — `DB_URL`, `DB_TOKEN`, `DB_URL_PUBLIC` (optional public URL, e.g. a replica) — **must never be prefixed `VITE_`**.

### Wiring that spans files

- **Provider stack** (`main.tsx`): `QueryClientProvider` → `AuthProvider` → `BrowserRouter` → `App`. The `queryClient` is a module singleton mounted **above** `AuthProvider`, so `auth-context.tsx` calls `queryClient.clear()` on both login and logout to avoid leaking one account's cached data into the next.
- **Route protection** (`App.tsx`): every screen sits behind `RequireAuth`, which redirects to `/login` when there's no session and otherwise builds the per-session libSQL client and provides it + `userId` through `DbProvider`. Routes are Portuguese: `/alimentos`, `/refeicoes`, `/metas`, `/treino`, `/analise`, `/ajustes`.
- **Global 401 handling**: repositories throw on auth failure; `query-client.ts` matches the error message (`isAuthError`) and fires the handler that `AuthProvider` registered via `setUnauthorizedHandler`, forcing a logout. New repository code should let auth errors propagate rather than swallow them.
- **`api/` shares `src/` code** (`api/login.ts` imports from `src/repositories/users` and `src/domain/auth`) using **`.js` import extensions** because Vercel compiles it as Node ESM — keep that extension style in `api/`.

### Database

- `src/db/schema.sql` is the single source of truth, applied by `scripts/lib/apply-schema.ts` (run via `db:setup`). Editing the schema means editing this file; there's no migration framework.
- Global catalog tables (not user-scoped): `foods` (`source` = `'taco' | 'custom'`) and `activity_types`. TACO = the Brazilian food-composition table; `scripts/seed-taco.ts` / `build-taco.ts` import it, seeded from `data/taco.sample.json` (real `data/taco.json` is gitignored).

## Testing

- Tests are **co-located** as `*.test.ts(x)` next to the code, using Vitest globals + Testing Library + jsdom.
- Repository and domain-with-DB tests run against a real **in-memory libSQL** database from `test/helpers/test-db.ts` — `createTestDb()` loads `schema.sql` and enables `PRAGMA foreign_keys = ON`, so FK behavior (e.g. `ON DELETE SET NULL`) is exercised for real, not mocked.
- Component/hook tests mount inside `DbProvider`, which defaults `userId` to `1` purely for test ergonomics (production always passes the real session id).

## How work is planned here

This project is built with the Superpowers brainstorm → spec → plan → implement flow. Design context for every feature lives in `docs/superpowers/specs/` (design docs) and `docs/superpowers/plans/` (implementation plans), dated and named per feature. Read the relevant spec/plan before extending a feature, and follow the same flow (invoke the brainstorming skill before new feature work) when adding one.
