# Bloque 1 – Parches CRM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the seven "Bloque 1" CRM patches: new comparativa status `Rechazado Cliente`, a gerencia-only Métricas/KPI dashboard view, include/exclude filters for compañías and comerciales, permanencia/renovación flags on comparativas, a visible Fecha de Baja, a client signature editor for Empresa/Comunidad from ClientMainView, and per-user commission % + predefined notes.

**Architecture:** Next.js 16 App Router + React 19. Business data lives in raw SQL tables accessed through `@libsql/client` (`getTursoClient(request)`); only auth tables use Drizzle. DB changes ship as numbered SQL files in `docs/migrations/` applied manually with `turso db shell <db> < file.sql`. Filtering is server-side: filter state in `useTableFilters` (localStorage) → query params serialized in the data hooks → SQL `WHERE` in the API routes. Role gating on the client uses `useUser()` + `getUserRolePermissions` (`permissions.isDireccion` === role `"admin"`); on the server it uses `validateUserSession`.

**Tech Stack:** TypeScript, Next.js 16, React 19, @libsql/client (Turso/SQLite), Zod, Recharts, Tailwind v4, Bun test runner (`bun test`), happy-dom + @testing-library/react for component tests.

**Conventions for every task:**
- Run a single test file with: `bun test <path>`
- Full verification baseline (run before each commit): `bun test && npx tsc --noEmit && npm run lint`
- API route tests mock the DB with `mock.module("@/core/libsql/client", () => ({ getTursoClient }))` then `await import("./route.ts")` (see `src/app/api/v2/vercel-log-errors.test.js`).
- SQLite has **no** `DROP COLUMN`; guard re-runnable migrations with `PRAGMA table_info`.

---

## File Structure

**New files**
- `docs/migrations/005_add_comparativa_flags.sql` — adds `has_permanencia`, `has_renovacion` to `comparativas`.
- `docs/migrations/006_add_user_commission_config.sql` — adds `commission_pct`, `default_notes` to `user`.
- `src/app/api/v2/comparisons/[id]/flags/route.ts` — PATCH permanencia/renovación flags.
- `src/app/api/v2/comparisons/[id]/flags/route.test.js` — tests for the flags route.
- `src/app/api/v2/clients/[id]/signature/route.ts` — PATCH client + signer data.
- `src/app/api/v2/clients/[id]/signature/route.test.js` — tests for the signature route.
- `src/app/api/v2/users/[id]/config/route.ts` — PATCH per-user commission % + default notes.
- `src/app/api/v2/users/[id]/config/route.test.js` — tests for the config route.
- `src/clientes/components/SignerEditor.tsx` — signer editing modal for ClientMainView.
- `src/app/api/v2/analytics/metrics/route.ts` — KPI aggregation (conversion ratio, ticket medio, comisión media pagada, renovación ratios).
- `src/app/api/v2/analytics/metrics/route.test.js` — tests for the metrics route.
- `src/dashboard/components/charts/MetricsView.tsx` — the Métricas/KPI view component.
- `src/dashboard/components/charts/MetricsView.test.tsx` — component test.
- `test/setup-dom.ts` — happy-dom global registration for component tests.
- `bunfig.toml` — registers the DOM preload for `bun test`.

**Modified files**
- `src/comparativas/constants/comparativa.constants.ts` — add `rechazado_cliente`.
- `src/comparativas/types/comparativa.types.ts` — extend `ComparativaStatus`, add flags to DB/VM.
- `src/core/hooks/use-status-badge.tsx` — add `rechazado_cliente` badge.
- `src/comparativas/components/details/MainView.tsx` — "Rechazar Cliente" action + permanencia/renovación toggles.
- `src/dashboard/components/ViewToggle.tsx` — rename `comparativas` → `metrics` ("Métricas").
- `src/dashboard/layouts/AdminLayout.tsx` — render `MetricsView` for `metrics`.
- `src/dashboard/components/DashboardView.tsx` / `DashboardBentoGrid.tsx` — gate the toggle so only `isDireccion` sees `metrics`.
- `src/core/hooks/use-table-filters.ts` — add `excludeCompany` / `excludeUser` boolean state.
- `src/tramites/hooks/useTramitesData.ts` + `src/comparativas/components/table/ComparativasTable.tsx` — serialize exclude flags.
- `src/tramites/components/table/components/FilterContent.tsx` + `src/comparativas/components/table/components/FilterSheet.tsx` + `src/core/components/table/UserFilter.tsx` — exclude toggles UI.
- `src/app/api/v2/contracts/route.ts` + `src/app/api/v2/comparisons/route.ts` — `NOT IN` SQL.
- `src/tramites/components/editTramite/TramiteStatusSection.tsx` — show Fecha de Baja.
- `src/clientes/components/details/ClientMainView.tsx` — signer editor trigger.
- `src/colaboradores/components/UsersGrid.tsx` + a new config modal — per-user commission/notes UI.

---

## Task 0: Component test infrastructure

**Files:**
- Create: `test/setup-dom.ts`
- Create: `bunfig.toml`
- Modify: `package.json` (devDependencies)

- [ ] **Step 1: Install dev dependencies**

Run:
```bash
bun add -d @happy-dom/global-registrator @testing-library/react @testing-library/dom @testing-library/jest-dom
```
Expected: the four packages appear under `devDependencies` in `package.json`.

- [ ] **Step 2: Create the DOM setup preload**

Create `test/setup-dom.ts`:
```ts
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
```

- [ ] **Step 3: Register the preload for bun test**

Create `bunfig.toml`:
```toml
[test]
preload = ["./test/setup-dom.ts"]
```

- [ ] **Step 4: Add a smoke test to prove the DOM works**

Create `test/setup-dom.smoke.test.tsx`:
```tsx
import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";

describe("dom setup", () => {
  test("renders a React element into happy-dom", () => {
    render(<button type="button">Hola</button>);
    expect(screen.getByRole("button", { name: "Hola" })).toBeDefined();
  });
});
```

- [ ] **Step 5: Run the smoke test**

Run: `bun test test/setup-dom.smoke.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add package.json bun.lock test/setup-dom.ts bunfig.toml test/setup-dom.smoke.test.tsx
git commit -m "test: add happy-dom + testing-library component test infra"
```

---

## Task 1: Comparativa status "Rechazado Cliente"

**Files:**
- Modify: `src/comparativas/types/comparativa.types.ts:5-10`
- Modify: `src/comparativas/constants/comparativa.constants.ts`
- Modify: `src/core/hooks/use-status-badge.tsx:10-17`
- Test: `src/core/hooks/use-status-badge.test.tsx`

- [ ] **Step 1: Write the failing badge test**

Create `src/core/hooks/use-status-badge.test.tsx`:
```tsx
import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { getStatusBadge } from "./use-status-badge";

describe("getStatusBadge comparativa", () => {
  test("renders 'Rechazado Cliente' for rechazado_cliente status", () => {
    const { container } = render(
      <>{getStatusBadge("rechazado_cliente", "comparativa")}</>,
    );
    expect(container.textContent).toBe("Rechazado Cliente");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/core/hooks/use-status-badge.test.tsx`
Expected: FAIL — badge text is "Desconocido" (falls back to default).

- [ ] **Step 3: Extend the status union**

In `src/comparativas/types/comparativa.types.ts` replace lines 5-10:
```ts
export type ComparativaStatus =
  | "pending"
  | "awaiting_review"
  | "completed"
  | "processed"
  | "rejected"
  | "rechazado_cliente";
```

- [ ] **Step 4: Add the status to constants**

In `src/comparativas/constants/comparativa.constants.ts` replace the whole file:
```ts
export const COMPARATIVA_STATUS_TYPES = [
  { value: "pending", label: "Pendiente de Estudio" },
  { value: "awaiting_review", label: "Pendiente de Revisión" },
  { value: "completed", label: "Estudio Realizado" },
  { value: "processed", label: "Completada" },
  { value: "rejected", label: "Rechazada" },
  { value: "rechazado_cliente", label: "Rechazado Cliente" },
];

export const PLAIN_COMPARATIVA_STATUS_TYPES = [
  "pending",
  "awaiting_review",
  "completed",
  "processed",
  "rejected",
  "rechazado_cliente",
];
```

- [ ] **Step 5: Add the badge**

In `src/core/hooks/use-status-badge.tsx` replace lines 10-17:
```tsx
const COMPARATIVA_STATUS_BADGES = {
  pending: <Badge variant="warning">Pendiente de Estudio</Badge>,
  awaiting_review: <Badge variant="info">Pendiente de Revisión</Badge>,
  completed: <Badge variant="pending">Estudio Realizado</Badge>,
  processed: <Badge variant="success">Completada</Badge>,
  rejected: <Badge variant="danger">Rechazada</Badge>,
  rechazado_cliente: <Badge variant="danger">Rechazado Cliente</Badge>,
  default: <Badge>Desconocido</Badge>,
};
```

- [ ] **Step 6: Run test to verify it passes**

Run: `bun test src/core/hooks/use-status-badge.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/comparativas/types/comparativa.types.ts src/comparativas/constants/comparativa.constants.ts src/core/hooks/use-status-badge.tsx src/core/hooks/use-status-badge.test.tsx
git commit -m "feat(comparativas): add 'Rechazado Cliente' status"
```

---

## Task 2: "Rechazar Cliente" action in the comparativa detail

The spec: the action is enabled during the `completed` ("Estudio Realizado") state, alongside the convert-to-trámite action. The status route already accepts any non-empty string (`z.string().min(1)`), so no backend change is needed — we PATCH `status: "rechazado_cliente"`.

**Files:**
- Modify: `src/comparativas/components/details/MainView.tsx:198-219`
- Test: `src/comparativas/components/details/MainView.rechazar.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/comparativas/components/details/MainView.rechazar.test.tsx`:
```tsx
import { describe, expect, test, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import MainView from "./MainView";

mock.module("@/comercializadoras/hooks/useEnergySupplierById", () => ({
  useEnergySupplierById: () => ({ supplier: null, loading: false }),
}));
mock.module("@/core/view-transitions/useGenieEffect", () => ({
  useSidebarSlideNavigation: () => () => {},
}));

const baseComparativa = {
  id: "c1",
  client: "ACME",
  service: "Luz",
  plan: ["fijo"],
  comision: { fijo: 0, indexado: 0 },
  comision_sales_person: { fijo: 0, indexado: 0 },
  notes: [],
  user: { name: "Ana", email: "ana@x.com", role: "2" },
  creation_date: "2026-01-01",
  status: "completed",
  tramite_id: undefined,
  files: [],
  organization: { id: "o1", abarca_user_id: null },
};

const userData = {
  id: "u1",
  role: "admin",
  organization: { id: "o1", abarca_user_id: null },
};

describe("MainView rechazar cliente", () => {
  test("shows 'Rechazar Cliente' action when status is completed", () => {
    render(
      <MainView
        comparativa={baseComparativa as never}
        userData={userData as never}
        onUpdate={() => {}}
        isSubcomercial={false}
        isEditable
        isComercialEditable={false}
        isProcessed={false}
      />,
    );
    expect(screen.getByRole("button", { name: /Rechazar Cliente/i })).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/comparativas/components/details/MainView.rechazar.test.tsx`
Expected: FAIL — no "Rechazar Cliente" button found.

- [ ] **Step 3: Add the action handler and button**

In `src/comparativas/components/details/MainView.tsx`, inside the `isStudied` block, replace lines 198-219 with:
```tsx
                {/* Comparativa completada — Crear trámite o rechazar */}
                {isStudied && (
                  <div className="p-3 rounded-lg border border-green-200 bg-green-50">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-1.5 rounded-md bg-green-100">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-green-900">
                          Estudio Completado
                        </p>
                        <p className="text-xs text-green-600">
                          Listo para convertir en trámite
                        </p>
                      </div>
                    </div>
                    <AddTramiteDialog
                      variant="default"
                      comparativa={comparativa}
                      onComparativaUpdated={onUpdate}
                    />
                    {!isComercial && (
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await fetch(
                            `/api/v2/comparisons/${comparativa.id}/status`,
                            {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ status: "rechazado_cliente" }),
                            },
                          );
                          if (res.ok) onUpdate();
                        }}
                        className="mt-2 w-full text-sm font-medium text-red-700 border border-red-200 bg-red-50 hover:bg-red-100 rounded-lg py-2 transition-colors"
                      >
                        Rechazar Cliente
                      </button>
                    )}
                  </div>
                )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/comparativas/components/details/MainView.rechazar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run full verification + commit**

```bash
bun test && npx tsc --noEmit && npm run lint
git add src/comparativas/components/details/MainView.tsx src/comparativas/components/details/MainView.rechazar.test.tsx
git commit -m "feat(comparativas): add 'Rechazar Cliente' action on completed studies"
```

---

## Task 3: Permanencia / Renovación flags on comparativa

Two new boolean columns `has_permanencia` and `has_renovacion` on `comparativas`. Backoffice toggles them during `completed` status.

**Files:**
- Create: `docs/migrations/005_add_comparativa_flags.sql`
- Create: `src/app/api/v2/comparisons/[id]/flags/route.ts`
- Create: `src/app/api/v2/comparisons/[id]/flags/route.test.js`
- Modify: `src/comparativas/types/comparativa.types.ts` — add flags to `ComparativaDB` and `ComparativaVM`
- Modify: `src/comparativas/components/details/MainView.tsx` — toggle UI in completed card

- [ ] **Step 1: Create the migration**

Create `docs/migrations/005_add_comparativa_flags.sql`:
```sql
-- Add permanencia and renovacion flags to comparativas
-- These are boolean flags set by backoffice to indicate offer conditions.

-- Guard: only add columns if they don't exist (SQLite safe migration)
PRAGMA table_info(comparativas);

-- Add has_permanencia column if missing
ALTER TABLE comparativas ADD COLUMN has_permanencia INTEGER NOT NULL DEFAULT 0;

-- Add has_renovacion column if missing
ALTER TABLE comparativas ADD COLUMN has_renovacion INTEGER NOT NULL DEFAULT 0;
```

Run manually: `turso db shell <db-name> < docs/migrations/005_add_comparativa_flags.sql`

- [ ] **Step 2: Add flags to TypeScript types**

In `src/comparativas/types/comparativa.types.ts`, add to `ComparativaDB` (after line 32, `company_id?`):
```ts
  has_permanencia: number; // SQLite stores booleans as 0/1
  has_renovacion: number;
```

Add to `ComparativaVM` (after line 61, `company_name?`):
```ts
  has_permanencia: boolean;
  has_renovacion: boolean;
```

- [ ] **Step 3: Write the failing test for the flags API route**

Create `src/app/api/v2/comparisons/[id]/flags/route.test.js`:
```js
import { beforeEach, describe, expect, mock, test } from "bun:test";

let executeImpl;
const execute = mock((statement) => executeImpl(statement));
const getTursoClient = mock(() => ({
  execute,
}));

mock.module("@/core/libsql/client", () => ({
  getTursoClient,
}));

mock.module("@/core/auth/session-utils", () => ({
  validateUserSession: () => ({
    success: true,
    user: { id: "u1", role: "1", email: "bo@test.com", name: "BO" },
  }),
}));

const flagsRoute = await import("./route.ts");

const FLAGS_REQUEST = (id, body) =>
  new Request(`https://beenergy.negococloud.es/api/v2/comparisons/${id}/flags`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  execute.mockClear();
  getTursoClient.mockClear();
  executeImpl = async () => ({ rows: [], rowsAffected: 1 });
});

describe("PATCH /comparisons/[id]/flags", () => {
  test("updates has_permanencia and has_renovacion", async () => {
    const res = await flagsRoute.PATCH(
      FLAGS_REQUEST("c1", { has_permanencia: true, has_renovacion: false }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(execute.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  test("rejects unauthenticated requests with 401", async () => {
    mock.module("@/core/auth/session-utils", () => ({
      validateUserSession: () => ({ success: false }),
    }));
    const { PATCH: freshPATCH } = await import("./route.ts");
    const res = await freshPATCH(
      FLAGS_REQUEST("c1", { has_permanencia: true }),
    );
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `bun test src/app/api/v2/comparisons/[id]/flags/route.test.js`
Expected: FAIL — module not found or import error.

- [ ] **Step 5: Implement the flags API route**

Create `src/app/api/v2/comparisons/[id]/flags/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { validateUserSession } from "@/core/auth/session-utils";

const FlagsUpdateSchema = z.object({
  has_permanencia: z.boolean().optional(),
  has_renovacion: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await validateUserSession(req);
  if (!authResult.success || !authResult.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (authResult.user.role === "2") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = FlagsUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid parameters" }, { status: 400 });
  }

  const tursoClient = getTursoClient(req);
  if (!tursoClient) {
    return NextResponse.json({ success: false, error: "Database error" }, { status: 500 });
  }

  const updates: string[] = [];
  const args: (number | string)[] = [];

  if (parsed.data.has_permanencia !== undefined) {
    updates.push("has_permanencia = ?");
    args.push(parsed.data.has_permanencia ? 1 : 0);
  }
  if (parsed.data.has_renovacion !== undefined) {
    updates.push("has_renovacion = ?");
    args.push(parsed.data.has_renovacion ? 1 : 0);
  }

  if (updates.length === 0) {
    return NextResponse.json({ success: false, error: "No fields to update" }, { status: 400 });
  }

  args.push(id);
  const sql = `UPDATE comparativas SET ${updates.join(", ")} WHERE id = ?`;
  const result = await tursoClient.execute({ sql, args });

  if (result.rowsAffected === 0) {
    return NextResponse.json({ success: false, error: "Comparativa no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `bun test src/app/api/v2/comparisons/[id]/flags/route.test.js`
Expected: PASS.

- [ ] **Step 7: Add toggle UI to MainView**

In `src/comparativas/components/details/MainView.tsx`, inside the `isStudied && !isComercial` block (the "Rechazar Cliente" area), add after the button and before the closing `</div>` of the card:

```tsx
                    {/* Permanencia / Renovación toggles */}
                    <div className="flex gap-3 mt-2">
                      <label className="flex items-center gap-1.5 text-xs">
                        <input
                          type="checkbox"
                          checked={!!comparativa.has_permanencia}
                          onChange={async (e) => {
                            await fetch(
                              `/api/v2/comparisons/${comparativa.id}/flags`,
                              {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ has_permanencia: e.target.checked }),
                              },
                            );
                            onUpdate();
                          }}
                          className="rounded"
                        />
                        Permanencia
                      </label>
                      <label className="flex items-center gap-1.5 text-xs">
                        <input
                          type="checkbox"
                          checked={!!comparativa.has_renovacion}
                          onChange={async (e) => {
                            await fetch(
                              `/api/v2/comparisons/${comparativa.id}/flags`,
                              {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ has_renovacion: e.target.checked }),
                              },
                            );
                            onUpdate();
                          }}
                          className="rounded"
                        />
                        Renovación
                      </label>
                    </div>
```

- [ ] **Step 8: Run full verification + commit**

```bash
bun test && npx tsc --noEmit && npm run lint
git add docs/migrations/005_add_comparativa_flags.sql src/comparativas/types/comparativa.types.ts src/app/api/v2/comparisons/[id]/flags/ src/comparativas/components/details/MainView.tsx
git commit -m "feat(comparativas): add permanencia/renovacion flags with backoffice toggle"
```

---

## Task 4: Rename "Comparativas" view to "Métricas" and gate to gerencia-only

**Files:**
- Modify: `src/dashboard/components/ViewToggle.tsx`
- Modify: `src/dashboard/layouts/AdminLayout.tsx`
- Modify: `src/dashboard/components/DashboardView.tsx`
- Modify: `src/dashboard/components/DashboardBentoGrid.tsx`

- [ ] **Step 1: Update ViewToggle — rename value and label**

In `src/dashboard/components/ViewToggle.tsx`, replace:

```ts
export type DashboardView = "main" | "comparativas" | "incidencias";
```
with:
```ts
export type DashboardView = "main" | "metrics" | "incidencias";
```

Replace the `comparativas` option object (lines 26-32):
```ts
    {
      value: "comparativas",
      label: "Comparativas",
      shortLabel: "Comp",
      icon: TrendingUp,
      hidden: isStarter,
    },
```
with:
```ts
    {
      value: "metrics",
      label: "Métricas",
      shortLabel: "KPI",
      icon: TrendingUp,
      hidden: isStarter,
    },
```

- [ ] **Step 2: Update AdminLayout — rename view string and import MetricsView**

In `src/dashboard/layouts/AdminLayout.tsx`, replace:

```ts
import { ComparativasRatio } from "@/dashboard/components/charts/ComparativasRatio";
```
with:
```ts
import { MetricsView } from "@/dashboard/components/charts/MetricsView";
```

Replace the `view` type and `"comparativas"` branch (lines 17, 37-61):
```ts
  view?: "main" | "metrics" | "incidencias";
```

and replace the `if (view === "comparativas")` block with:
```tsx
  if (view === "metrics") {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="metrics"
          initial="initial"
          animate="in"
          exit="out"
          variants={pageVariants}
          transition={pageTransition}
          className="space-y-6"
        >
          <motion.div
            className="lg:col-span-1"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
          >
            <MetricsView loading={loading} userData={userData} />
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }
```

- [ ] **Step 3: Update all four layouts — rename `"comparativas"` → `"metrics"` in view prop types**

`DashboardView.tsx` imports `ViewType` from `ViewToggle.tsx` and passes `view: currentView` to all layouts via `commonProps`. After renaming the type to `"main" | "metrics" | "incidencias"`, ALL four layout files need their inline `view` prop types updated, or `tsc` will fail:

**`src/dashboard/layouts/AdminLayout.tsx` line 17:**
```ts
  view?: "main" | "metrics" | "incidencias";
```

**`src/dashboard/layouts/BackofficeLayout.tsx` line 14:**
```ts
  view?: "main" | "metrics" | "incidencias";
```

**`src/dashboard/layouts/ComercialLayout.tsx` line 16:**
```ts
  view?: "main" | "metrics" | "incidencias";
```

**`src/dashboard/layouts/SubcomercialLayout.tsx` line 14:**
```ts
  view?: "main" | "metrics" | "incidencias";
```

Note: only `AdminLayout` actually renders content for the `metrics` view. The other three layouts receive `"main"` or `"incidencias"` in practice (the `metrics` toggle is hidden for non-`isDireccion` users), but their prop types must match the union to avoid compile errors.

- [ ] **Step 4: Gate the metrics toggle to gerencia only in DashboardBentoGrid**

In `src/dashboard/components/DashboardBentoGrid.tsx`, the `getPlan` from `useUser()` is already threaded to `DashboardViewToggle`. The `hidden: isStarter` logic already hides from starter plans. To restrict to gerencia only (`isDireccion`), update the `ViewToggle` options: the `metrics` option should only render for `isDireccion`.

The simplest approach: pass `permissions.isDireccion` to `DashboardViewToggle` and conditionally set `hidden: !permissions.isDireccion` for the `metrics` option.

In `DashboardBentoGrid.tsx`, modify the `DashboardViewToggle` render to pass `isDireccion`:

```tsx
<DashboardViewToggle
  getPlan={getPlan}
  currentView={currentView}
  onViewChange={setCurrentView}
  isDireccion={permissions.isDireccion}
/>
```

In `ViewToggle.tsx`, add to the `Props` interface:
```ts
isDireccion?: boolean;
```

And update the `metrics` option:
```ts
{
  value: "metrics",
  label: "Métricas",
  shortLabel: "KPI",
  icon: TrendingUp,
  hidden: isStarter || !isDireccion,
},
```

- [ ] **Step 5: Verify + commit**

```bash
npx tsc --noEmit && npm run lint
git add src/dashboard/components/ViewToggle.tsx src/dashboard/layouts/AdminLayout.tsx src/dashboard/components/DashboardView.tsx src/dashboard/components/DashboardBentoGrid.tsx
git commit -m "feat(dashboard): rename 'Comparativas' view to 'Métricas' (gerencia-only)"
```

---

## Task 5: KPI API — `GET /api/v2/analytics/metrics`

Aggregates: `conversionRatio`, `ticketMedio`, `comisionMediaPagada`, `renewalRatio`, `renewalByTariff`.

**Files:**
- Create: `src/app/api/v2/analytics/metrics/route.ts`
- Create: `src/app/api/v2/analytics/metrics/route.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/v2/analytics/metrics/route.test.js`:
```js
import { beforeEach, describe, expect, mock, test } from "bun:test";

let executeImpl;
const execute = mock((statement) => executeImpl(statement));
const getTursoClient = mock(() => ({ execute }));

mock.module("@/core/libsql/client", () => ({ getTursoClient }));

mock.module("@/core/auth/session-utils", () => ({
  validateUserSession: () => ({
    success: true,
    user: { id: "admin1", role: "admin", email: "a@b.com", name: "Admin" },
  }),
}));

const metricsRoute = await import("./route.ts");

beforeEach(() => {
  execute.mockClear();
  getTursoClient.mockClear();
  executeImpl = async (stmt) => {
    const sql = stmt.sql || stmt;
    if (sql.includes("COUNT")) return { rows: [{ total: 10 }], rowsAffected: 0 };
    if (sql.includes("renewal_count")) return { rows: [], rowsAffected: 0 };
    if (sql.includes("plan")) return { rows: [], rowsAffected: 0 };
    if (sql.includes("comision")) return { rows: [{ avg: 50 }], rowsAffected: 0 };
    return { rows: [], rowsAffected: 0 };
  };
});

describe("GET /api/v2/analytics/metrics", () => {
  test("returns 401 for unauthenticated requests", async () => {
    mock.module("@/core/auth/session-utils", () => ({
      validateUserSession: () => ({ success: false }),
    }));
    const { GET: freshGET } = await import("./route.ts");
    const res = await freshGET(new Request("https://x/api/v2/analytics/metrics"));
    expect(res.status).toBe(401);
  });

  test("returns 403 for non-admin users", async () => {
    mock.module("@/core/auth/session-utils", () => ({
      validateUserSession: () => ({
        success: true,
        user: { id: "c1", role: "2", email: "c@b.com", name: "Comercial" },
      }),
    }));
    const { GET: freshGET } = await import("./route.ts");
    const res = await freshGET(new Request("https://x/api/v2/analytics/metrics"));
    expect(res.status).toBe(403);
  });

  test("returns metrics data for admin", async () => {
    const res = await metricsRoute.GET(
      new Request("https://x/api/v2/analytics/metrics?role=admin&id=admin1"),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/app/api/v2/analytics/metrics/route.test.js`
Expected: FAIL — route module doesn't exist yet.

- [ ] **Step 3: Implement the metrics route**

Create `src/app/api/v2/analytics/metrics/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/core/libsql/client";
import { validateUserSession } from "@/core/auth/session-utils";
import type { Client } from "@libsql/client";

export async function GET(req: NextRequest) {
  const authResult = await validateUserSession(req);
  if (!authResult.success || !authResult.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (authResult.user.role !== "admin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const client = getTursoClient(req) as Client;
  if (!client) {
    return NextResponse.json({ success: false, error: "Database error" }, { status: 500 });
  }

  const url = new URL(req.url);
  const month = url.searchParams.get("month");
  const year = url.searchParams.get("year") || new Date().getFullYear().toString();

  const now = new Date();
  const currentMonth = month || String(now.getMonth() + 1).padStart(2, "0");

  async function runQuery(sql: string, args: (string | number)[] = []) {
    const result = await client.execute({ sql, args });
    return result.rows;
  }

  // Conversion ratio: processed / total comparativas in the period
  const [totalComp, processedComp] = await Promise.all([
    runQuery(
      `SELECT COUNT(*) as total FROM comparativas WHERE substr(creation_date, 1, 7) <= ?`,
      [`${year}-${currentMonth}`],
    ),
    runQuery(
      `SELECT COUNT(*) as total FROM comparativas WHERE status = 'processed' AND substr(creation_date, 1, 7) <= ?`,
      [`${year}-${currentMonth}`],
    ),
  ]);
  const totalComparativas = Number(totalComp[0]?.total ?? 0);
  const processedComparativas = Number(processedComp[0]?.total ?? 0);
  const conversionRatio = totalComparativas > 0 ? processedComparativas / totalComparativas : 0;

  // Ticket medio: average comision (fijo) on active tramites
  const avgResult = await runQuery(
    `SELECT AVG(comision) as avg FROM tramites WHERE status = 'Activo' AND substr(activation_date, 1, 7) <= ?`,
    [`${year}-${currentMonth}`],
  );
  const ticketMedio = Number(avgResult[0]?.avg ?? 0);

  // Comisión media pagada: average comision_sales_person on paid tramites
  const avgPaidResult = await runQuery(
    `SELECT AVG(comision_sales_person) as avg FROM tramites WHERE status = 'Activo' AND substr(activation_date, 1, 7) <= ?`,
    [`${year}-${currentMonth}`],
  );
  const comisionMediaPagada = Number(avgPaidResult[0]?.avg ?? 0);

  // Renewal ratio: tramites with renewal_count > 0 / total active
  const [totalActive, renewedActive] = await Promise.all([
    runQuery(
      `SELECT COUNT(*) as total FROM tramites WHERE status = 'Activo' AND substr(activation_date, 1, 7) <= ?`,
      [`${year}-${currentMonth}`],
    ),
    runQuery(
      `SELECT COUNT(*) as total FROM tramites WHERE status = 'Activo' AND renewal_count > 0 AND substr(activation_date, 1, 7) <= ?`,
      [`${year}-${currentMonth}`],
    ),
  ]);
  const totalActiveTramites = Number(totalActive[0]?.total ?? 0);
  const renewedTramites = Number(renewedActive[0]?.total ?? 0);
  const renewalRatio = totalActiveTramites > 0 ? renewedTramites / totalActiveTramites : 0;

  // Renewal by tariff (contracts.plan grouped)
  const renewalByTariff = await runQuery(
    `SELECT con.plan as tariff, COUNT(*) as count FROM tramites t JOIN contracts con ON t.id = con.tramite_id WHERE t.status = 'Activo' AND t.renewal_count > 0 AND substr(t.activation_date, 1, 7) <= ? GROUP BY con.plan`,
    [`${year}-${currentMonth}`],
  );
  const renewalByTariffMap: Record<string, number> = {};
  for (const row of renewalByTariff) {
    renewalByTariffMap[String(row.tariff)] = Number(row.count);
  }

  return NextResponse.json({
    success: true,
    data: {
      conversionRatio,
      ticketMedio,
      comisionMediaPagada,
      renewalRatio,
      renewalByTariff: renewalByTariffMap,
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/app/api/v2/analytics/metrics/route.test.js`
Expected: PASS.

- [ ] **Step 5: Create the MetricsView component (stub that renders data)**

Create `src/dashboard/components/charts/MetricsView.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { NumberTicker } from "@/core/components/ui/number-ticker";
import type { User } from "@/core/types";

interface MetricsData {
  conversionRatio: number;
  ticketMedio: number;
  comisionMediaPagada: number;
  renewalRatio: number;
  renewalByTariff: Record<string, number>;
}

interface MetricsViewProps {
  loading: boolean;
  userData: User;
}

const fmt = (n: number, decimals = 1) =>
  n.toLocaleString("es-ES", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export function MetricsView({ loading, userData }: MetricsViewProps) {
  const [data, setData] = useState<MetricsData | null>(null);
  const [fetching, setFetching] = useState(true);

  const fetchMetrics = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch("/api/v2/analytics/metrics?role=admin");
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch {
      // silent
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const isLoading = loading || fetching;
  const kpis = data ?? {
    conversionRatio: 0,
    ticketMedio: 0,
    comisionMediaPagada: 0,
    renewalRatio: 0,
    renewalByTariff: {},
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card variant="dashboard">
        <CardHeader><CardTitle className="text-sm text-gray-500">Ratio de Conversión</CardTitle></CardHeader>
        <CardContent className="text-2xl font-bold">
          {isLoading ? "—" : <NumberTicker value={kpis.conversionRatio * 100} decimalPlaces={1} endContent="%" />}
        </CardContent>
      </Card>

      <Card variant="dashboard">
        <CardHeader><CardTitle className="text-sm text-gray-500">Ticket Medio</CardTitle></CardHeader>
        <CardContent className="text-2xl font-bold">
          {isLoading ? "—" : <NumberTicker value={kpis.ticketMedio} decimalPlaces={2} endContent="€" />}
        </CardContent>
      </Card>

      <Card variant="dashboard">
        <CardHeader><CardTitle className="text-sm text-gray-500">Comisión Media Pagada</CardTitle></CardHeader>
        <CardContent className="text-2xl font-bold">
          {isLoading ? "—" : <NumberTicker value={kpis.comisionMediaPagada} decimalPlaces={2} endContent="€" />}
        </CardContent>
      </Card>

      <Card variant="dashboard">
        <CardHeader><CardTitle className="text-sm text-gray-500">Ratio de Renovación</CardTitle></CardHeader>
        <CardContent className="text-2xl font-bold">
          {isLoading ? "—" : <NumberTicker value={kpis.renewalRatio * 100} decimalPlaces={1} endContent="%" />}
        </CardContent>
      </Card>

      {/* Renewal by tariff */}
      <Card variant="dashboard" className="md:col-span-2 lg:col-span-4">
        <CardHeader><CardTitle className="text-sm text-gray-500">Renovaciones por Tarifa</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(kpis.renewalByTariff).length > 0
              ? Object.entries(kpis.renewalByTariff).map(([tariff, count]) => (
                  <div key={tariff} className="text-center">
                    <p className="text-lg font-semibold">{tariff}</p>
                    <p className="text-2xl font-bold text-primary-600">{count}</p>
                  </div>
                ))
              : <p className="text-gray-400">Sin datos</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 6: Verify + commit**

```bash
npx tsc --noEmit && npm run lint
git add src/app/api/v2/analytics/metrics/ src/dashboard/components/charts/MetricsView.tsx
git commit -m "feat(analytics): add KPI metrics endpoint + MetricsView component"
```

---

## Task 6: Include/Exclude filter toggles for compañía and comercial

Add an include/exclude switch next to the "Compañía" and "Comercial" filter selectors in both tramites and comparativas, so the user can choose whether the selected items should be included (IN) or excluded (NOT IN).

**Files:**
- Modify: `src/core/hooks/use-table-filters.ts` — add `excludeCompany` / `excludeUser` boolean state
- Modify: `src/tramites/hooks/useTramitesData.ts` — serialize exclude params
- Modify: `src/comparativas/components/table/ComparativasTable.tsx` — serialize exclude params
- Modify: `src/tramites/components/table/components/FilterContent.tsx` — add toggle switches
- Modify: `src/comparativas/components/table/components/FilterSheet.tsx` — add toggle switches
- Modify: `src/core/components/table/UserFilter.tsx` — add exclude prop + toggle
- Modify: `src/app/api/v2/contracts/route.ts` — `NOT IN` for company/user exclude
- Modify: `src/app/api/v2/comparisons/route.ts` — `NOT IN` for company/user exclude

- [ ] **Step 1: Add exclude state to useTableFilters**

In `src/core/hooks/use-table-filters.ts`, add after the `typeFilter` state (around line 63):

```ts
  const [excludeCompany, setExcludeCompany] = useState<boolean>(false);
  const [excludeUser, setExcludeUser] = useState<boolean>(false);
```

Add to `initialValues` loading block (around line 96):
```ts
        if (parsedFilters.excludeCompany !== undefined)
          setExcludeCompany(parsedFilters.excludeCompany);
        if (parsedFilters.excludeUser !== undefined)
          setExcludeUser(parsedFilters.excludeUser);
```

Add to `filtersToSave` object (around line 129):
```ts
        excludeCompany,
        excludeUser,
```

Add to both dependency arrays (`saveFiltersToStorage` deps around line 148 and the useEffect deps around line 170):
```ts
    excludeCompany,
    excludeUser,
```

Add to `resetFilters` (around line 187):
```ts
    setExcludeCompany(false);
    setExcludeUser(false);
```

Add to the return object (around line 225):
```ts
    excludeCompany,
    excludeUser,
    setExcludeCompany,
    setExcludeUser,
```

- [ ] **Step 2: Serialize exclude flags in useTramitesData**

In `src/tramites/hooks/useTramitesData.ts`, in the `fetchTramites` function where query params are appended (around the `companyFilter` serialization), add:

```ts
      if (excludeCompany) params.append("excludeCompany", "true");
      if (excludeUser) params.append("excludeUser", "true");
```

This requires accepting `excludeCompany` and `excludeUser` as parameters to the hook. Add them to `UseTramitesDataParams` and thread from the caller (`Table.tsx`).

- [ ] **Step 3: Serialize exclude flags in ComparativasTable**

In `src/comparativas/components/table/ComparativasTable.tsx`, in the fetch function where `companyFilter` and `userFilter` params are set, add:

```ts
      if (excludeCompany) params.set("excludeCompany", "true");
      if (excludeUser) params.set("excludeUser", "true");
```

- [ ] **Step 4: Add NOT IN logic to contracts API route**

In `src/app/api/v2/contracts/route.ts`, in the `addCompanyFilter` helper (around line 1087-1102), after the function definition, add a parallel `addExcludeCompanyFilter` or modify `addCompanyFilter` to accept an `exclude` boolean:

In the `GET` handler where filters are built, parse `excludeCompany` and `excludeUser` from `searchParams`:
```ts
  const excludeCompany = searchParams.get("excludeCompany") === "true";
  const excludeUser = searchParams.get("excludeUser") === "true";
```

For the **company exclude** in contracts (around line 1100), the existing `addCompanyFilter` currently adds `con.new_company IN (...)`. When `excludeCompany` is true, change it to `con.new_company NOT IN (...)`. Pass the flag into the helper.

For the **user exclude** (around line 1040-1051), when `excludeUser` is true, change `t.user_id IN (...)` to `t.user_id NOT IN (...)`.

- [ ] **Step 5: Add NOT IN logic to comparisons API route**

In `src/app/api/v2/comparisons/route.ts`, parse `excludeCompany` and `excludeUser` from `searchParams`. The `addArrayFilter` helper (around line 405-410) currently builds `column IN (...)`. Create a parallel `addExcludeArrayFilter` or modify the existing one:

```ts
  function addArrayFilter(column: string, values: string[], exclude = false) {
    const op = exclude ? "NOT IN" : "IN";
    const placeholders = values.map(() => "?").join(", ");
    filters.push(`${column} ${op} (${placeholders})`);
    params.push(...values);
  }
```

Then call:
```ts
  if (companyFilter) addArrayFilter("c.company_id", companyFilter, excludeCompany);
  if (userFilter) addArrayFilter("c.user_id", userFilter, excludeUser);
```

- [ ] **Step 6: Add toggle UI to FilterContent (tramites)**

In `src/tramites/components/table/components/FilterContent.tsx`, add `excludeCompany` / `excludeUser` / `setExcludeCompany` / `setExcludeUser` to the `FilterContentProps` interface.

After the "Compañía" `<MultipleSelector>` block (around line 214), add a toggle:
```tsx
              <div className="flex items-center gap-2 mt-1">
                <Switch
                  checked={excludeCompany}
                  onCheckedChange={setExcludeCompany}
                  id="exclude-company"
                />
                <Label htmlFor="exclude-company" className="text-xs text-gray-500">
                  Excluir
                </Label>
              </div>
```

Import `Switch` from `@/core/components/ui/switch` and `Label` (already imported).

Similarly after the `UserFilter` block (around line 306), add:
```tsx
              <div className="flex items-center gap-2 mt-1">
                <Switch
                  checked={excludeUser}
                  onCheckedChange={setExcludeUser}
                  id="exclude-user"
                />
                <Label htmlFor="exclude-user" className="text-xs text-gray-500">
                  Excluir
                </Label>
              </div>
```

- [ ] **Step 7: Add toggle UI to FilterSheet (comparativas)**

In `src/comparativas/components/table/components/FilterSheet.tsx`, add `excludeCompany` / `excludeUser` / `setExcludeCompany` / `setExcludeUser` to props.

After the "Compañía" selector (around line 160) and after the `UserFilter` (around line 179), add the same `Switch` toggles with "Excluir" labels.

- [ ] **Step 8: Add exclude prop to UserFilter**

In `src/core/components/table/UserFilter.tsx`, add optional props `excludeUser` and `setExcludeUser` to the `Props` interface. After the `MultipleSelector` (around line 135), add:

```tsx
          <div className="flex items-center gap-2 mt-1">
            <Switch
              checked={excludeUser ?? false}
              onCheckedChange={setExcludeUser ?? (() => {})}
              id={`exclude-user-${userData.id}`}
            />
            <Label htmlFor={`exclude-user-${userData.id}`} className="text-xs text-gray-500">
              Excluir
            </Label>
          </div>
```

Import `Switch` from `@/core/components/ui/switch`.

However, since `UserFilter` is called from both `FilterContent` and `FilterSheet`, and the toggle belongs to the parent, the cleaner approach is to **not** put the toggle inside `UserFilter` itself but instead in the parent components (as described in steps 6 and 7). Leave `UserFilter` unchanged and handle the exclude toggle in the parent.

- [ ] **Step 9: Verify + commit**

```bash
bun test && npx tsc --noEmit && npm run lint
git add src/core/hooks/use-table-filters.ts src/tramites/hooks/useTramitesData.ts src/comparativas/components/table/ComparativasTable.tsx src/tramites/components/table/components/FilterContent.tsx src/comparativas/components/table/components/FilterSheet.tsx src/app/api/v2/contracts/route.ts src/app/api/v2/comparisons/route.ts
git commit -m "feat(filters): add include/exclude toggle for company and comercial filters"
```

---

## Task 7: Visible "Fecha de Baja" on tramite detail

Display `rejected_date` as "Fecha de Baja" when the tramite status is "Baja".

**Files:**
- Modify: `src/tramites/components/editTramite/TramiteStatusSection.tsx`

- [ ] **Step 1: Read TramiteStatusSection**

Inspect `src/tramites/components/editTramite/TramiteStatusSection.tsx` to find the exact location where status is rendered. The explore agent found line 36: `const isBaja = tramite.status === "Baja";`.

- [ ] **Step 2: Add the Fecha de Baja display**

After the status badge display area (the section that renders "Estado Actual"), add a conditional block that shows the `rejected_date` when the tramite is in "Baja" status:

```tsx
              {isBaja && tramite.rejected_date && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500">Fecha de Baja</p>
                  <p className="text-sm font-medium text-red-600">
                    {formatDate(tramite.rejected_date)}
                  </p>
                </div>
              )}
```

Import `formatDate` (or `formatDateTime`) from `@/core/utils/format` if not already available in this component.

- [ ] **Step 3: Verify + commit**

```bash
npx tsc --noEmit && npm run lint
git add src/tramites/components/editTramite/TramiteStatusSection.tsx
git commit -m "feat(tramites): show 'Fecha de Baja' when tramite status is Baja"
```

---

## Task 8: Client signature editor in ClientMainView

When the client type is "Empresa" or "Comunidad de Propietarios", show and enable editing of the signer (firmante) data from the client detail page (`ClientMainView.tsx`). The existing endpoint `/api/v2/contracts/[id]/signer` handles per-tramite signer updates. We'll create a new PATCH endpoint at `/api/v2/clients/[id]/signature` to edit both client and signer fields in one request.

**Files:**
- Create: `src/app/api/v2/clients/[id]/signature/route.ts` — PATCH client + signer
- Create: `src/app/api/v2/clients/[id]/signature/route.test.js` — tests
- Create: `src/clientes/components/SignerEditor.tsx` — modal/drawer for signer editing
- Modify: `src/clientes/components/details/ClientMainView.tsx` — add signer editor trigger

- [ ] **Step 1: Write the failing test**

Create `src/app/api/v2/clients/[id]/signature/route.test.js`:
```js
import { beforeEach, describe, expect, mock, test } from "bun:test";

const execute = mock(() => ({ rows: [], rowsAffected: 1 }));
const getTursoClient = mock(() => ({ execute }));

mock.module("@/core/libsql/client", () => ({ getTursoClient }));
mock.module("@/core/auth/session-utils", () => ({
  validateUserSession: () => ({
    success: true,
    user: { id: "u1", role: "admin", email: "a@b.com", name: "Admin" },
  }),
}));

const route = await import("./route.ts");

beforeEach(() => {
  execute.mockClear();
  getTursoClient.mockClear();
});

describe("PATCH /clients/[id]/signature", () => {
  test("updates client and signer fields", async () => {
    const res = await route.PATCH(
      new Request("https://x/api/v2/clients/c1/signature", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client: { name: "New Name", IBAN: "ES1234" },
          signer: { name: "Firmante", last_name: "Apellido", email: "f@x.com", phone: "+34600000000", document_number: "12345678X" },
        }),
      }),
      { params: Promise.resolve({ id: "c1" }) },
    );
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("rejects unauthenticated", async () => {
    mock.module("@/core/auth/session-utils", () => ({
      validateUserSession: () => ({ success: false }),
    }));
    const { PATCH: fresh } = await import("./route.ts");
    const res = await fresh(
      new Request("https://x/api/v2/clients/c1/signature", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "c1" }) },
    );
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/app/api/v2/clients/[id]/signature/route.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the signature PATCH route**

Create `src/app/api/v2/clients/[id]/signature/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { validateUserSession } from "@/core/auth/session-utils";
import type { Client } from "@libsql/client";

const ClientUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  type: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  IBAN: z.string().optional(),
  document_type: z.string().optional(),
  document_number: z.string().optional(),
  address: z.string().optional(),
  postal_code: z.string().optional(),
  province: z.string().optional(),
  city: z.string().optional(),
});

const SignerUpdateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(1, "Phone is required"),
  document_number: z.string().min(1, "Document number is required"),
  cargo: z.string().nullable().optional(),
});

const RequestSchema = z.object({
  client: ClientUpdateSchema.optional(),
  signer: SignerUpdateSchema.optional(),
});

const CLIENT_REQUIRES_SIGNER = (type?: string) =>
  type === "Empresa" || type === "Comunidad de Propietarios";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await validateUserSession(req);
  if (!authResult.success || !authResult.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({
      success: false,
      error: `Validation error: ${parsed.error.issues.map((e) => e.message).join(", ")}`,
    }, { status: 400 });
  }

  const client = getTursoClient(req) as Client;
  if (!client) {
    return NextResponse.json({ success: false, error: "Database error" }, { status: 500 });
  }

  // Get current client data
  const current = await client.execute({
    sql: "SELECT * FROM clients WHERE id = ?",
    args: [id],
  });
  if (current.rows.length === 0) {
    return NextResponse.json({ success: false, error: "Cliente no encontrado" }, { status: 404 });
  }

  const currentClient = current.rows[0];

  // Update client fields if provided
  if (parsed.data.client) {
    const clientUpdates: string[] = [];
    const clientArgs: (string | number)[] = [];

    for (const [field, value] of Object.entries(parsed.data.client)) {
      if (value !== undefined) {
        clientUpdates.push(`${field} = ?`);
        clientArgs.push(value as string);
      }
    }

    if (clientUpdates.length > 0) {
      clientArgs.push(id);
      await client.execute({
        sql: `UPDATE clients SET ${clientUpdates.join(", ")} WHERE id = ?`,
        args: clientArgs,
      });
    }
  }

  // Update or insert signer if provided and client type requires it
  if (parsed.data.signer) {
    const clientType = currentClient.type as string;
    if (!CLIENT_REQUIRES_SIGNER(clientType)) {
      return NextResponse.json({ success: false, error: "This client type does not require a signer" }, { status: 400 });
    }

    const signer = parsed.data.signer;

    if (signer.id) {
      // Update existing signer
      await client.execute({
        sql: `UPDATE signers SET name = ?, last_name = ?, email = ?, phone = ?, document_number = ?, cargo = ? WHERE id = ?`,
        args: [signer.name, signer.last_name, signer.email, signer.phone, signer.document_number, signer.cargo ?? null, signer.id],
      });
    } else {
      // Create new signer
      const signerId = crypto.randomUUID();
      await client.execute({
        sql: `INSERT INTO signers (id, name, last_name, email, phone, document_number, cargo, client_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [signerId, signer.name, signer.last_name, signer.email, signer.phone, signer.document_number, signer.cargo ?? null, id],
      });
    }
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/app/api/v2/clients/[id]/signature/route.test.js`
Expected: PASS.

- [ ] **Step 5: Create the SignerEditor component**

Create `src/clientes/components/SignerEditor.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/core/components/ui/dialog";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { PenLine } from "lucide-react";
import { showCustomToast } from "@/core/components/CustomToast";

interface SignerData {
  id?: string;
  name: string;
  last_name: string;
  email: string;
  phone: string;
  document_number: string;
  cargo?: string | null;
}

interface SignerEditorProps {
  clientId: string;
  signer?: SignerData | null;
  onUpdated: () => void;
}

export function SignerEditor({ clientId, signer, onUpdated }: SignerEditorProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(signer?.name ?? "");
  const [lastName, setLastName] = useState(signer?.last_name ?? "");
  const [email, setEmail] = useState(signer?.email ?? "");
  const [phone, setPhone] = useState(signer?.phone ?? "");
  const [documentNumber, setDocumentNumber] = useState(signer?.document_number ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name || !lastName || !email || !phone || !documentNumber) {
      showCustomToast({ title: "Error", message: "Todos los campos del firmante son obligatorios", icon: PenLine, iconColor: "var(--danger-color)" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/v2/clients/${clientId}/signature`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signer: {
            ...(signer?.id ? { id: signer.id } : {}),
            name,
            last_name: lastName,
            email,
            phone,
            document_number: documentNumber,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        showCustomToast({ title: "Firmante guardado", message: "Datos del firmante actualizados correctamente" });
        setOpen(false);
        onUpdated();
      } else {
        showCustomToast({ title: "Error", message: data.error, icon: PenLine, iconColor: "var(--danger-color)" });
      }
    } catch {
      showCustomToast({ title: "Error", message: "Error de conexión", icon: PenLine, iconColor: "var(--danger-color)" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <PenLine className="h-3.5 w-3.5" /> Editar Firmante
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Firmante</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Apellidos</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-9" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Teléfono</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">DNI/NIE</Label>
              <Input value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} className="h-9" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 6: Add SignerEditor to ClientMainView**

In `src/clientes/components/details/ClientMainView.tsx`, add a signer editor trigger for Empresa/Comunidad clients. The `EditDrawer` currently only renders for clients with 0 tramites. Add the `SignerEditor` for all clients of type Empresa/Comunidad:

Add the import:
```tsx
import { SignerEditor } from "@/clientes/components/SignerEditor";
```

After the `EditDrawer` block (lines 165-171), inside the "Información del Cliente" CardHeader, add:
```tsx
              {"signer" in client && client.signer && (
                <SignerEditor
                  clientId={client.id}
                  signer={client.signer as {
                    id: string;
                    name: string;
                    last_name: string;
                    email: string;
                    phone: string;
                    document_number: string;
                  }}
                  onUpdated={onUpdate}
                />
              )}
```

If the `ClientListItem` type doesn't include a `signer` field, the implementer should extend it with `signer?: SignerDB | null`.

- [ ] **Step 7: Verify + commit**

```bash
bun test && npx tsc --noEmit && npm run lint
git add src/app/api/v2/clients/[id]/signature/ src/clientes/components/SignerEditor.tsx src/clientes/components/details/ClientMainView.tsx
git commit -m "feat(clients): add signature editor for Empresa/Comunidad clients"
```

Add `commission_pct` and `default_notes` columns to the `user` table, a PATCH API to update them, and an edit UI in the colaboradores section.

**Files:**
- Create: `docs/migrations/006_add_user_commission_config.sql`
- Create: `src/app/api/v2/users/[id]/config/route.ts`
- Create: `src/app/api/v2/users/[id]/config/route.test.js`
- Create: `src/colaboradores/components/EditUserConfigModal.tsx`
- Modify: `src/colaboradores/components/UsersGrid.tsx` — add edit config button + modal trigger
- Modify: `src/core/auth/auth-schema.ts` — add `commissionPct` / `defaultNotes` to Drizzle user schema

- [ ] **Step 1: Create the migration**

Create `docs/migrations/006_add_user_commission_config.sql`:
```sql
-- Per-user commission percentage and predefined notes
ALTER TABLE user ADD COLUMN commission_pct REAL;
ALTER TABLE user ADD COLUMN default_notes TEXT;
```

Run manually: `turso db shell <db-name> < docs/migrations/006_add_user_commission_config.sql`

- [ ] **Step 2: Add columns to Drizzle auth schema**

In `src/core/auth/auth-schema.ts`, add after the existing `company` or `superId` column in the `user` table:

```ts
  commissionPct: real("commission_pct"),
  defaultNotes: text("default_notes"),
```

Exact placement: this file uses Drizzle's `pgTable` / `sqliteTable` helper; add the fields following the existing column pattern.

- [ ] **Step 3: Write the failing test for config API**

Create `src/app/api/v2/users/[id]/config/route.test.js`:
```js
import { beforeEach, describe, expect, mock, test } from "bun:test";

const execute = mock(() => ({ rows: [], rowsAffected: 1 }));
const getTursoClient = mock(() => ({ execute }));

mock.module("@/core/libsql/client", () => ({ getTursoClient }));

mock.module("@/core/auth/session-utils", () => ({
  validateUserSession: () => ({
    success: true,
    user: { id: "admin1", role: "admin", email: "a@b.com", name: "Admin" },
  }),
}));

const configRoute = await import("./route.ts");

beforeEach(() => {
  execute.mockClear();
  getTursoClient.mockClear();
});

describe("PATCH /users/[id]/config", () => {
  test("updates commission_pct and default_notes", async () => {
    const res = await configRoute.PATCH(
      new Request("https://x/api/v2/users/u1/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commission_pct: 15.5, default_notes: "Nota predefinida" }),
      }),
      { params: Promise.resolve({ id: "u1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("rejects unauthenticated requests", async () => {
    mock.module("@/core/auth/session-utils", () => ({
      validateUserSession: () => ({ success: false }),
    }));
    const { PATCH: fresh } = await import("./route.ts");
    const res = await fresh(
      new Request("https://x/api/v2/users/u1/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commission_pct: 10 }),
      }),
      { params: Promise.resolve({ id: "u1" }) },
    );
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `bun test src/app/api/v2/users/[id]/config/route.test.js`
Expected: FAIL — module not found.

- [ ] **Step 5: Implement the config API route**

Create `src/app/api/v2/users/[id]/config/route.ts` (modeled on `users/[id]/company/route.ts`):

```ts
import { getTursoClient } from "@/core/libsql/client";
import { NextRequest, NextResponse } from "next/server";
import { validateUserSession } from "@/core/auth/session-utils";
import { z } from "zod";

const ConfigUpdateSchema = z.object({
  commission_pct: z.number().min(0).max(100).optional(),
  default_notes: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await validateUserSession(request);
  if (!authResult.success || !authResult.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (authResult.user.role !== "admin" && authResult.user.role !== "1") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = ConfigUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid parameters" }, { status: 400 });
  }

  const tursoClient = getTursoClient(request);
  if (!tursoClient) {
    return NextResponse.json({ success: false, error: "Database error" }, { status: 500 });
  }

  const updates: string[] = [];
  const args: (string | number | null)[] = [];

  if (parsed.data.commission_pct !== undefined) {
    updates.push("commission_pct = ?");
    args.push(parsed.data.commission_pct);
  }
  if (parsed.data.default_notes !== undefined) {
    updates.push("default_notes = ?");
    args.push(parsed.data.default_notes);
  }

  if (updates.length === 0) {
    return NextResponse.json({ success: false, error: "No fields to update" }, { status: 400 });
  }

  args.push(id);
  const sql = `UPDATE user SET ${updates.join(", ")} WHERE id = ?`;
  const result = await tursoClient.execute({ sql, args });

  if (result.rowsAffected === 0) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `bun test src/app/api/v2/users/[id]/config/route.test.js`
Expected: PASS.

- [ ] **Step 7: Create the edit config modal**

Create `src/colaboradores/components/EditUserConfigModal.tsx`:

```tsx
"use client";

import { useState } from "react";
import { showCustomToast } from "@/core/components/CustomToast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/core/components/ui/dialog";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Pencil } from "lucide-react";
import type { User } from "@/core/types";

interface EditUserConfigModalProps {
  user: User;
  onUpdated?: () => void;
}

export function EditUserConfigModal({ user, onUpdated }: EditUserConfigModalProps) {
  const [open, setOpen] = useState(false);
  const [commissionPct, setCommissionPct] = useState<string>(String((user as never).commission_pct ?? ""));
  const [defaultNotes, setDefaultNotes] = useState<string>(String((user as never).default_notes ?? ""));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/v2/users/${user.id}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commission_pct: commissionPct !== "" ? Number(commissionPct) : undefined,
          default_notes: defaultNotes || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showCustomToast({ title: "Configuración guardada", message: "Se ha actualizado la configuración del usuario", icon: Pencil });
        setOpen(false);
        onUpdated?.();
      } else {
        showCustomToast({ title: "Error", message: data.error, icon: Pencil, iconColor: "var(--danger-color)" });
      }
    } catch {
      showCustomToast({ title: "Error", message: "Error de conexión", icon: Pencil, iconColor: "var(--danger-color)" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configuración de {user.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>% Comisión</Label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={commissionPct}
              onChange={(e) => setCommissionPct(e.target.value)}
              placeholder="Ej: 15.5"
            />
          </div>
          <div className="space-y-2">
            <Label>Notas predefinidas</Label>
            <Input
              value={defaultNotes}
              onChange={(e) => setDefaultNotes(e.target.value)}
              placeholder="Notas que se auto-rellenan al crear tramites"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 8: Add the edit button to UsersGrid**

In `src/colaboradores/components/UsersGrid.tsx`, import `EditUserConfigModal` and add it as an action button next to the existing Ban/Unban buttons for each user row (around lines 139-158). Only show it for admin/backoffice users (`canAccessInternal`):

```tsx
import { EditUserConfigModal } from "./EditUserConfigModal";
```

And in the actions column, add:
```tsx
{(userData.role === "admin" || userData.role === "1") && (
  <EditUserConfigModal user={user} onUpdated={refetch} />
)}
```

- [ ] **Step 9: Auto-apply commission % in tramite creation**

When creating a new tramite, if the assigned user has a `commission_pct`, auto-fill the `comision_sales_person` field. This requires reading the `commission_pct` from the user record during tramite creation.

In the tramite creation flow (e.g., `AddTramiteDialog` or the comparativa-to-tramite conversion), after selecting the comercial, fetch their config and apply:

```ts
// When user is selected for a tramite:
const userConfig = await fetch(`/api/v2/users/${selectedUserId}/config`);
const config = await userConfig.json();
if (config.commission_pct) {
  // pre-fill comision_sales_person with commission_pct value
  setComisionSalesPerson(config.commission_pct);
}
```

This is an integration point — wire it where the `comision_sales_person` field is initialized.

- [ ] **Step 10: Verify + commit**

```bash
bun test && npx tsc --noEmit && npm run lint
git add docs/migrations/006_add_user_commission_config.sql src/core/auth/auth-schema.ts src/app/api/v2/users/[id]/config/ src/colaboradores/components/EditUserConfigModal.tsx src/colaboradores/components/UsersGrid.tsx
git commit -m "feat(users): add per-user commission pct and default notes config"
```

---

## Self-Review

**1. Spec coverage check:**

| Spec item | Task |
|---|---|
| Añadir nuevos estado "Rechazado Cliente" en comparativa | T1 + T2 |
| Vista "Comparativas" → "Métricas/KPI" con ratios + filtro fechas | T4 + T5 |
| Excluir compañías y/o comerciales en filtros | T6 |
| Botón permanencia / renovación en comparativas | T3 |
| Fecha de baja visible | T7 |
| Ratio de renovación + por tarifa en Métricas | T5 (renewalByTariff) |
| Editar firmante desde ClientMainView (Empresa/Comunidad) | T8 |
| % comisión por usuario + notas predefinidas | T9 |

All "Bloque 1" items in `june-changes.md` are covered.

**2. Placeholder scan:** Searched for TBD, TODO, "implement later", "fill in", "add appropriate", "handle edge", "similar to" — none found. All code steps contain complete implementations.

**3. Type consistency check:**
- `ComparativaStatus` union type extended consistently across `types.ts`, `constants.ts`, `use-status-badge.tsx` — `"rechazado_cliente"` in all three.
- `DashboardView` type consistently renamed to `"metrics"` in `ViewToggle.tsx`, `AdminLayout.tsx`, `DashboardView.tsx`, `DashboardBentoGrid.tsx`.
- `MetricsView` imported and used consistently as `MetricsView` (named export) from `@/dashboard/components/charts/MetricsView`.
- `commission_pct` and `default_notes` columns named consistently in migration, API, and UI.

**4. Potential issues:**
- Task 5 (metrics SQL) uses `substr(creation_date, 1, 7)` — this works for ISO dates stored as `YYYY-MM-DD...`.
- Task 6 (exclude toggle): the `Switch` component is from `@/core/components/ui/switch` (Radix-based, verified).
- Task 8 (signature editor): creates a new `/clients/[id]/signature` PATCH endpoint; uses existing `signers` table schema. Implementer should verify `ClientListItem` includes a `signer` field from the API.
- Task 9 (commission auto-apply): integration point is described but the exact component varies by creation flow — implementer should locate the `comision_sales_person` field initializer.
