# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`negoco-crm` — a multi-tenant CRM for energy/utility sales brokers (comercializadoras), built on **Next.js 16 (App Router) + React 19 + TypeScript (strict)**. The domain language is **Spanish**: routes, variables, DB columns, and comments are in Spanish (e.g. `tramites`, `comercializadoras`, `comparativas`). Match that when naming domain concepts.

Package manager is **pnpm** (`pnpm-lock.yaml`, `pnpm-workspace.yaml`). The npm-style scripts work via pnpm.

## Commands

```bash
pnpm dev            # next dev --turbopack (http://localhost:3000)
pnpm build          # production build (runs Sentry source-map upload)
pnpm lint           # eslint .
pnpm type-check     # tsc --noEmit  (fast type-only check without a full build)
pnpm test           # vitest run (single pass)
pnpm test:watch     # vitest watch
pnpm vitest run src/forum/server.test.ts          # run a single test file
pnpm vitest run -t "creates a topic"              # run tests matching a name
pnpm seed:tickets   # tsx scripts/seed-ticket-system.ts
```

Tests use **Vitest + happy-dom + Testing Library**; globals are enabled and `test/setup-vitest.ts` runs first. Test files live next to source as `*.test.ts(x)`.

## Multi-tenancy (most important architectural fact)

Each tenant has its **own separate Turso (libSQL/SQLite) database**, selected at request time from the **subdomain** in the `host` header:

- `getTursoClient(req)` in `src/core/libsql/client.ts` reads the first label of the host and looks up env vars `NEXT_TURSO_DB_URL_<TENANT>` / `NEXT_TURSO_DB_AUTH_TOKEN_<TENANT>` (uppercased). `localhost` maps to `..._TEST`. `getTursoClientByTenant(name)` does the same without a request.
- There is **no global DB connection** — every server-side data access must thread the per-request client. Pass `getTursoClient(request)` from the route handler down into data functions.
- Locally, use tenant subdomains: `http://test.localhost:3000`, `http://beenergy.localhost:3000` (see `allowedDevOrigins` in `next.config.ts`).
- The canonical schema is `docs/schema.sql`; incremental changes are hand-written numbered files in `docs/migrations/` and must be applied to **every** tenant database.

## Auth & authorization

- **better-auth** (`src/core/auth/auth.ts`), constructed per-request via `getAuth(req)` over the tenant's libSQL DB using the Drizzle adapter. Auth tables are defined in `src/core/auth/auth-schema.ts`. Plugins: `organization` + `admin`.
- Roles are stored as strings: `admin`, `"1"` (backoffice), `"2"` (comercial, the default). Access-control statements/roles live in `src/core/auth/permissions.ts`.
- In route handlers, authenticate with `validateUserSession(request)` from `src/core/auth/session-utils.ts` → returns `{ success, user: { id, role, email, name } }`. Gate privileged actions on role (e.g. `isDireccionRole(role)` ≈ `role === "admin"`).
- `src/proxy.ts` is the Next.js 16 **middleware** (the framework renamed `middleware` → `proxy`). It redirects unauthenticated users off protected pages, returns 401 for unauthenticated `/api/v2/*`, and restricts `/api/webhooks/*` to the `api.negococloud.es` subdomain.

## Code architecture

The codebase is organized into **domain feature modules** under `src/<domain>/`, separate from the route tree under `src/app/`. Each module owns its slice end-to-end:

```
src/<domain>/            e.g. clientes, comercializadoras, comparativas, tramites,
  components/            fotovoltaica, tickets, forum, difusiones, dashboard,
  hooks/                 dashboard-announcements, documentacion, soporte, perfil
  types.ts (or types/)
  utils/
  server.ts              server-only data access (newer modules)
  index.ts               public barrel (re-exports the module's surface)
```

- **Pages are thin.** `src/app/(main)/<route>/page.tsx` typically just renders a module's client component (e.g. `foro/page.tsx` → `<ForumPageClient/>`). Put real logic in the module, not in `app/`.
- **Route groups:** `(auth)` (login, reset-pass) and `(main)` (the authenticated app shell + feature pages).
- **API is REST under `src/app/api/v2/<resource>/route.ts`.** Standard handler shape: `validateUserSession` → role check → parse/validate body with **Zod** → `getTursoClient(request)` → call a `server.ts` function → return the `ApiResponse<T>` envelope `{ success: true, data }` or `{ success: false, error }` with the right HTTP status. `src/app/api/v2/forum/topics/route.ts` is a clean reference. `/api/auth/[...all]` is better-auth; `/api/webhooks/*` are external integrations.
- **Data access is raw SQL** via `@libsql/client` inside `server.ts`, with explicit row-mapper helpers (see `src/forum/server.ts`). **Drizzle is used only for better-auth**, not for general queries — do not reach for an ORM for feature data.
- **Cross-cutting code lives in `src/core/`:** `components/` (shared UI incl. Radix/shadcn-style `ui/`, `table/`, `sidebar/`), `contexts/` (React context providers like `UserContext`, `TramitesContext`), `hooks/`, `config/routes.ts` (the route registry powering breadcrumbs/sidebar/titles — update it when adding a page), `services/`, `validation/`, `firebase/`, `utils/`.

## Other conventions & integrations

- **File storage:** Firebase Storage (`src/core/firebase/firebaseConfig.ts`); remote image hosts are allowlisted in `next.config.ts`.
- **PDFs:** `react-pdf` / `pdfjs-dist` with a custom webpack worker rule and CORS headers in `next.config.ts`.
- **Email:** `nodemailer` + `react-email` (SMTP via env), e.g. password-reset and plan-upgrade templates in `src/core/hooks/`.
- **Error monitoring:** Sentry, wired via `instrumentation.ts` and `sentry.*.config.ts`.
- **External integrations:** Abarca (webhooks under `/api/webhooks/abarca`), Apolo SIPS, plus per-tenant API keys — all via env vars.
- **`docs/` is mostly historical:** hundreds of one-off refactoring/migration reports. Treat them as background, not authoritative — `docs/schema.sql` and `docs/migrations/` are the exceptions that matter.
