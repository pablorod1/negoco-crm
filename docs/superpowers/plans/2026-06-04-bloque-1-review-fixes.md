# Bloque 1 Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the valid fixes from the Bloque 1 review after re-scoping with the latest product decisions: pnpm-only tooling, `Rechazar Cliente` allowed for comerciales, no maintenance for deprecated POST legacy paths, correct current commission/notes model, and updated client/signer/tramite UI requirements.

**Architecture:** Keep changes minimal and aligned with existing Next.js App Router patterns. Security fixes happen server-side in API routes; UI fixes reuse existing editor components where possible; test tooling is standardized around pnpm scripts and a non-Bun test runner.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, pnpm, Vitest + happy-dom/Testing Library, ESLint flat config, @libsql/client/Turso, Zod, Tailwind.

---

## Scope Decisions

These decisions override the earlier review document:

- `Rechazar Cliente` **must remain available to comerciales**. Do not add a UI/backend restriction for comerciales.
- Deprecated POST legacy endpoints are out of scope. Do not fix `POST /api/v2/comparisons` pagination compatibility.
- The current commission/default-notes model is correct: `user_company_commissions` + `user_default_notes`. Do not revert to `commission_pct/default_notes`.
- `Fecha de Baja` should be visible in `src/tramites/components/liquidez/LiquidezColumns.tsx` and `src/tramites/components/editTramite/historial/TramiteTimeLine.tsx`, not duplicated in the main status panel.
- Do not use Bun commands, Bun APIs, or `bun:test` in new tests.
- Do not commit unless explicitly requested by the user.

## File Structure

**Create:**
- `vitest.config.ts` - pnpm test runner config for TS/TSX, aliases, happy-dom.
- `test/setup-vitest.ts` - DOM matchers and required test env vars.
- `src/clientes/components/SignerInfoBlock.tsx` - reusable read-only signer information + edit/add action.

**Modify:**
- `package.json` - replace Bun/Jest scripts with pnpm-compatible scripts; remove `bun run` from `seed:tickets`.
- `eslint.config.mjs` - switch to ESLint flat config compatible with Next 16/ESLint 10.
- Existing test files under `src/**/*.test.*` - migrate from `bun:test` to Vitest.
- `src/app/api/v2/clients/[id]/signature/route.ts` - remove deprecated POST, protect GET/PATCH, enforce client access, return 400 for signer on unsupported client type.
- `src/app/api/v2/clients/[id]/route.ts` - protect PATCH before enabling client edit from client detail.
- `src/app/api/v2/analytics/metrics/route.ts` - enforce gerencia-only server-side authorization.
- `src/dashboard/components/charts/*` or metrics API tests as needed - align tests with the gerencia-only rule.
- `src/tramites/components/editTramite/TramiteStatusSection.tsx` - remove duplicated `Fecha de Baja` from status panel.
- `src/tramites/components/details/MainView.tsx` - redesign first/second panel layout.
- `src/tramites/components/details/FinancialCard.tsx` - make embedded mode wrapperless or replace usage.
- `src/tramites/components/details/ComercialCard.tsx` - make embedded mode wrapperless or replace usage.
- `src/clientes/components/SignerEditor.tsx` - support add/edit labels and sync form state when signer changes.
- `src/clientes/components/details/ClientMainView.tsx` - show signer info and client edit button.
- `src/tramites/components/editTramite/client/TramiteClientSection.tsx` - pass real editability to signer tab.
- `src/tramites/components/editTramite/client/SignerTabContent.tsx` - support edit/add signer action.
- `src/types/bun-test.d.ts` - delete after tests no longer import `bun:test`.
- `docs/changes/june/review/2026-06-03-review-bloque-1-parches-crm.md` - add an addendum with the corrected scope decisions.

---

## Task 1: Standardize Tooling On pnpm

**Files:**
- Create: `vitest.config.ts`
- Create: `test/setup-vitest.ts`
- Modify: `package.json`
- Modify: `eslint.config.mjs`
- Delete: `src/types/bun-test.d.ts`
- Modify tests importing `bun:test`

- [ ] **Step 1: Install pnpm-only test utilities**

Run:

```bash
pnpm add -D vitest @vitejs/plugin-react vite-tsconfig-paths tsx
pnpm remove jest @types/jest
```

Expected:

- `pnpm-lock.yaml` updates.
- `package.json` no longer depends on `jest`/`@types/jest`.
- `vitest`, `@vitejs/plugin-react`, `vite-tsconfig-paths`, and `tsx` are present in `devDependencies`.

- [ ] **Step 2: Update package scripts**

In `package.json`, replace the scripts block with:

```json
"scripts": {
  "dev": "next dev --turbopack",
  "type-check": "tsc --noEmit",
  "build": "next build",
  "start": "next start",
  "lint": "eslint .",
  "test": "vitest run",
  "test:watch": "vitest",
  "seed:tickets": "tsx scripts/seed-ticket-system.ts"
}
```

- [ ] **Step 3: Add Vitest config**

Create `vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx,js,jsx}"],
    setupFiles: ["./test/setup-vitest.ts"],
    restoreMocks: true,
    clearMocks: true,
  },
});
```

- [ ] **Step 4: Add Vitest setup**

Create `test/setup-vitest.ts`:

```ts
import "@testing-library/jest-dom/vitest";

process.env.NEXT_PUBLIC_BETTER_AUTH_URL ??= "http://localhost:3000";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
```

- [ ] **Step 5: Fix ESLint flat config**

Replace `eslint.config.mjs` with:

```js
import { globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default [
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "coverage/**",
    "dist/**",
  ]),
];
```

- [ ] **Step 6: Convert Bun tests to Vitest**

For each test importing `bun:test`, replace imports and mocks.

Example conversion:

```ts
// Before
import { beforeEach, describe, expect, mock, test } from "bun:test";

// After
import { beforeEach, describe, expect, test, vi } from "vitest";
```

For route tests that currently use `mock.module`, use `vi.mock` with mutable variables:

```ts
import { beforeEach, describe, expect, test, vi } from "vitest";

let sessionResult = {
  success: true,
  user: { id: "admin1", role: "admin", email: "a@b.com", name: "Admin" },
};

const execute = vi.fn();
const getTursoClient = vi.fn(() => ({ execute }));

vi.mock("@/core/libsql/client", () => ({ getTursoClient }));
vi.mock("@/core/auth/session-utils", () => ({
  validateUserSession: () => sessionResult,
}));

const route = await import("./route");

beforeEach(() => {
  execute.mockReset();
  getTursoClient.mockClear();
  sessionResult = {
    success: true,
    user: { id: "admin1", role: "admin", email: "a@b.com", name: "Admin" },
  };
});
```

- [ ] **Step 7: Delete Bun type shim**

Delete `src/types/bun-test.d.ts` after all test files import from `vitest`.

- [ ] **Step 8: Verify tooling baseline**

Run:

```bash
pnpm test
pnpm type-check
pnpm lint
```

Expected: all pass without Bun, without manual env vars, and without explicit DOM preload.

---

## Task 2: Secure Client And Signature APIs

**Files:**
- Modify: `src/app/api/v2/clients/[id]/signature/route.ts`
- Modify: `src/app/api/v2/clients/[id]/route.ts`
- Modify: `src/app/api/v2/clients/[id]/signature/route.test.js`

- [ ] **Step 1: Delete deprecated POST from signature route**

Remove the `POST` export from `src/app/api/v2/clients/[id]/signature/route.ts`. Deprecated POST methods are out of scope and should not be maintained.

- [ ] **Step 2: Add access helper to signature route**

In `src/app/api/v2/clients/[id]/signature/route.ts`, add:

```ts
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";
import type { Client } from "@libsql/client";

async function getAccessibleClient(
  tursoClient: Client,
  clientId: string,
  user: { id: string; role: string },
) {
  const args: string[] = [clientId];
  let sql = "SELECT clients.* FROM clients WHERE clients.id = ?";

  if (user.role === "2") {
    const subcomerciales = await getSubcomerciales(tursoClient, user.id);
    const allowedUserIds = [user.id];

    if (subcomerciales.success && subcomerciales.ids.length > 0) {
      allowedUserIds.push(...subcomerciales.ids);
    }

    sql = `
      SELECT DISTINCT clients.*
      FROM clients
      JOIN tramites ON tramites.client_id = clients.id
      WHERE clients.id = ?
        AND tramites.user_id IN (${allowedUserIds.map(() => "?").join(", ")})
    `;
    args.push(...allowedUserIds);
  }

  const result = await tursoClient.execute({ sql, args });
  return result.rows[0] ?? null;
}
```

- [ ] **Step 3: Protect GET signature**

At the start of `GET`, call `validateUserSession`. Return 401 if unauthenticated. Use `getAccessibleClient`; return 403 if it returns null.

The GET flow should be:

```ts
const authResult = await validateUserSession(request);
if (!authResult.success || !authResult.user) {
  return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
}

const { id } = await params;
const tursoClient = getTursoClient(request) as Client | null;
if (!tursoClient) {
  return NextResponse.json({ success: false, error: "Database not initialized" }, { status: 500 });
}

const client = await getAccessibleClient(tursoClient, id, authResult.user);
if (!client) {
  return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
}
```

- [ ] **Step 4: Protect PATCH signature**

In `PATCH`, replace the raw client lookup with `getAccessibleClient`. If a signer payload is sent for a client type other than `Empresa` or `Comunidad de Propietarios`, return 400 instead of silent success:

```ts
if (signerUpdates && !SIGNER_CLIENT_TYPES.includes(existingClient.type as string)) {
  return NextResponse.json(
    { success: false, error: "Este tipo de cliente no requiere firmante" },
    { status: 400 },
  );
}
```

- [ ] **Step 5: Protect client PATCH**

In `src/app/api/v2/clients/[id]/route.ts`, add `validateUserSession` to `PATCH`. For admin/backoffice, allow. For commercial role `"2"`, only allow if the client belongs to one of their tramites or subcomerciales.

Use this access check before `updateClient`:

```ts
async function canUpdateClient(
  tursoClient: NonNullable<ReturnType<typeof getTursoClient>>,
  clientId: string,
  userId: string,
  userRole: string,
) {
  if (userRole !== "2") return true;

  const subcomerciales = await getSubcomerciales(tursoClient, userId);
  const allowedUserIds = [userId];
  if (subcomerciales.success && subcomerciales.ids.length > 0) {
    allowedUserIds.push(...subcomerciales.ids);
  }

  const result = await tursoClient.execute({
    sql: `SELECT 1 FROM tramites WHERE client_id = ? AND user_id IN (${allowedUserIds.map(() => "?").join(", ")}) LIMIT 1`,
    args: [clientId, ...allowedUserIds],
  });

  return result.rows.length > 0;
}
```

- [ ] **Step 6: Add/adjust API tests**

Add tests for:

- `GET /signature` returns 401 unauthenticated.
- `GET /signature` returns 403 when commercial has no access.
- `PATCH /signature` returns 403 when commercial has no access.
- `PATCH /signature` returns 400 when signer is sent for `Particular`.
- `PATCH /clients/[id]` returns 401 unauthenticated.
- `PATCH /clients/[id]` returns 403 for commercial without access.

Run:

```bash
pnpm test src/app/api/v2/clients/[id]/signature/route.test.js
pnpm test src/app/api/v2/clients/[id]/route.test.js
```

Expected: all tests pass.

---

## Task 3: Enforce Gerencia-Only Metrics Server-Side

**Files:**
- Modify: `src/app/api/v2/analytics/metrics/route.ts`
- Modify: `src/app/api/v2/analytics/metrics/route.test.js`

- [ ] **Step 1: Update non-admin test expectation**

Change the current non-admin metrics test to expect 403:

```ts
test("returns 403 for non-admin users", async () => {
  sessionResult = {
    success: true,
    user: { id: "c1", role: "2", email: "c@b.com", name: "Comercial" },
  };

  const res = await metricsRoute.GET(
    new Request("https://x/api/v2/analytics/metrics"),
  );

  expect(res.status).toBe(403);
});
```

- [ ] **Step 2: Add server-side role guard**

In `GET`, immediately after authentication:

```ts
if (authResult.user.role !== "admin") {
  return NextResponse.json(
    { success: false, error: "Forbidden" },
    { status: 403 },
  );
}
```

- [ ] **Step 3: Remove commercial scoping branch from metrics if unused**

Since this route is gerencia-only, remove or stop using the role `"2"` branch in metrics-only helpers where it adds complexity solely for commercial access. Keep `commercialId` filtering for gerencia selecting a commercial.

- [ ] **Step 4: Verify**

Run:

```bash
pnpm test src/app/api/v2/analytics/metrics/route.test.js
pnpm type-check
```

Expected: tests and type-check pass.

---

## Task 4: Verify Existing Renewal History Schema For Metrics

**Files:**
- Modify: `docs/schema.sql`

- [ ] **Step 1: Do not create a new table migration**

`tramite_renewal_history` already exists. Do not create `docs/migrations/009_create_tramite_renewal_history.sql` and do not add a duplicate `CREATE TABLE` migration.

- [ ] **Step 2: Verify expected schema shape in docs**

Confirm `docs/schema.sql` documents the existing table. If it does not, add the existing schema from the deployed table/documented renewal flow:

```sql
CREATE TABLE IF NOT EXISTS tramite_renewal_history (
  id TEXT PRIMARY KEY,
  tramite_id TEXT NOT NULL,
  user_id TEXT,
  renewal_number INTEGER NOT NULL DEFAULT 1,
  old_contract_type TEXT,
  new_contract_type TEXT,
  old_company TEXT,
  new_company TEXT,
  old_renovation_date TEXT,
  new_renovation_date TEXT,
  old_activation_date TEXT,
  new_activation_date TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tramite_id) REFERENCES tramites(id),
  FOREIGN KEY (user_id) REFERENCES user(id)
);

CREATE INDEX IF NOT EXISTS idx_renewal_history_tramite_id
  ON tramite_renewal_history(tramite_id);

CREATE INDEX IF NOT EXISTS idx_renewal_history_tramite_date
  ON tramite_renewal_history(tramite_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_renewal_history_user_id
  ON tramite_renewal_history(user_id);
```

- [ ] **Step 3: Verify required indexes**

Confirm the deployed table has indexes equivalent to:

```sql
idx_renewal_history_tramite_id ON tramite_renewal_history(tramite_id)
idx_renewal_history_tramite_date ON tramite_renewal_history(tramite_id, created_at DESC)
idx_renewal_history_user_id ON tramite_renewal_history(user_id)
```

If indexes are missing, create an indexes-only migration:

```sql
CREATE INDEX IF NOT EXISTS idx_renewal_history_tramite_id
  ON tramite_renewal_history(tramite_id);

CREATE INDEX IF NOT EXISTS idx_renewal_history_tramite_date
  ON tramite_renewal_history(tramite_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_renewal_history_user_id
  ON tramite_renewal_history(user_id);
```

- [ ] **Step 4: Update schema docs**

Ensure `docs/schema.sql` matches the deployed table closely enough for future reviewers and metrics work.

- [ ] **Step 5: Verify metrics route still type-checks**

Run:

```bash
pnpm type-check
```

Expected: PASS.

---

## Task 5: Redesign Trámite Detail MainView

**Files:**
- Modify: `src/tramites/components/details/MainView.tsx`
- Modify: `src/tramites/components/details/FinancialCard.tsx`
- Modify: `src/tramites/components/details/ComercialCard.tsx`
- Modify: `src/tramites/components/editTramite/TramiteStatusSection.tsx`

- [ ] **Step 1: Remove duplicate Fecha de Baja from status panel**

In `TramiteStatusSection.tsx`, remove the `isBaja && tramite.rejected_date` block from `mode === "full"`. Keep `formatDate` import if still used elsewhere in the file.

Reason: `Fecha de Baja` is already shown in `LiquidezColumns.tsx` and `TramiteTimeLine.tsx`.

- [ ] **Step 2: Make embedded cards wrapperless**

In `FinancialCard.tsx`, change embedded return from a bordered section to a plain section:

```tsx
if (embedded) {
  return <section className="space-y-3">{content}</section>;
}
```

In `ComercialCard.tsx`, do the same:

```tsx
if (embedded) {
  return <section className="space-y-3">{content}</section>;
}
```

- [ ] **Step 3: Restructure MainView grid**

In `MainView.tsx`, keep the first panel as only `StatusCard`. Replace the second panel content with two compact columns:

Left column:

- Comisiones via `FinancialCard embedded`.
- Proveedor using `ProviderSection` if not already inside `ComercialCard`, or keep `ComercialCard` only if the provider remains visually in left column.

Right column:

- Comercial via `ComercialCard embedded` or direct `TramiteComercialSection`.
- Notas predefinidas rendered without rounded card wrappers.

Use this target structure in `CardContent`:

```tsx
<CardContent>
  <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
    <div className="space-y-5">
      <FinancialCard
        tramite={tramite}
        userData={userData}
        onUpdate={onUpdate}
        isEditable={isEditable}
        embedded
      />
      {/* Provider belongs here for non-comerciales. */}
    </div>

    <div className="space-y-5">
      <ComercialCard
        tramite={tramite}
        userData={userData}
        onUpdate={onUpdate}
        isComercialEditable={isComercialEditable}
        embedded
      />
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Notas predefinidas
        </p>
        {/* Existing notes rendering without outer rounded border wrapper. */}
      </section>
    </div>
  </div>
</CardContent>
```

- [ ] **Step 4: Verify UI manually**

Run:

```bash
pnpm dev
```

Check a trámite detail page:

- First panel title/actions are status/actions only.
- Second panel has two compact columns.
- No duplicated card wrappers around comisiones/comercial/notas.
- `Fecha de Baja` is not displayed in status panel.
- Timeline still displays `Fecha de Baja` when `rejected_date` exists.

- [ ] **Step 5: Verify code**

Run:

```bash
pnpm type-check
pnpm lint
```

Expected: PASS.

---

## Task 6: Improve Client Detail UI For Client And Signer Editing

**Files:**
- Create: `src/clientes/components/SignerInfoBlock.tsx`
- Modify: `src/clientes/components/SignerEditor.tsx`
- Modify: `src/clientes/components/details/ClientMainView.tsx`

- [ ] **Step 1: Sync SignerEditor state and labels**

In `SignerEditor.tsx`, import `useEffect` and reset form when `signer` changes or the dialog opens:

```tsx
useEffect(() => {
  if (!open) return;
  setForm({
    name: signer?.name ?? "",
    last_name: signer?.last_name ?? "",
    email: signer?.email ?? "",
    phone: signer?.phone ?? "",
    document_number: signer?.document_number ?? "",
    cargo: signer?.cargo ?? "",
  });
}, [open, signer]);
```

Change trigger/title labels:

```tsx
const actionLabel = signer ? "Editar Firmante" : "Añadir Firmante";
```

Use `actionLabel` in the button and dialog title.

- [ ] **Step 2: Create reusable signer info block**

Create `src/clientes/components/SignerInfoBlock.tsx`:

```tsx
"use client";

import { BriefcaseBusiness, IdCard, Mail, Phone, UserRound } from "lucide-react";
import { SignerDB } from "@/tramites/types";
import { SignerEditor } from "@/clientes/components/SignerEditor";

interface Props {
  clientId: string;
  signer: SignerDB | null | undefined;
  canEdit: boolean;
  onUpdated: () => void;
}

export function SignerInfoBlock({ clientId, signer, canEdit, onUpdated }: Props) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <UserRound className="h-4 w-4 text-gray-400" />
          Firmante
        </p>
        {canEdit ? (
          <SignerEditor clientId={clientId} signer={signer ?? null} onUpdated={onUpdated} />
        ) : null}
      </div>

      {signer ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-gray-500">Nombre completo</p>
            <p className="text-sm font-medium text-gray-900">{signer.name} {signer.last_name}</p>
          </div>
          <div className="flex items-start gap-2">
            <IdCard className="mt-0.5 h-3.5 w-3.5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Documento</p>
              <p className="text-sm font-medium text-gray-900">{signer.document_number || "—"}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Mail className="mt-0.5 h-3.5 w-3.5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Email</p>
              <p className="text-sm font-medium text-gray-900">{signer.email || "—"}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Phone className="mt-0.5 h-3.5 w-3.5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Teléfono</p>
              <p className="text-sm font-medium text-gray-900">{signer.phone || "—"}</p>
            </div>
          </div>
          {signer.cargo ? (
            <div className="flex items-start gap-2 sm:col-span-2">
              <BriefcaseBusiness className="mt-0.5 h-3.5 w-3.5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Cargo</p>
                <p className="text-sm font-medium text-gray-900">{signer.cargo}</p>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-gray-500">No hay firmante registrado.</p>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Show client edit button in ClientMainView**

In `ClientMainView.tsx`, remove the `client.tramites_count === 0` condition around `EditDrawer` so the edit button is available from the client detail page:

```tsx
<EditDrawer
  userData={userData}
  client={client}
  signer={client.signer ?? undefined}
  onUpdate={onUpdate}
/>
```

- [ ] **Step 4: Show signer information in ClientMainView**

Replace the standalone `SignerEditor` button with `SignerInfoBlock` inside the client information card for `Empresa` / `Comunidad de Propietarios`:

```tsx
{canEditSigner ? (
  <div className="col-span-2 border-t border-gray-100 pt-4">
    <SignerInfoBlock
      clientId={client.id}
      signer={client.signer ?? null}
      canEdit
      onUpdated={onUpdate}
    />
  </div>
) : null}
```

- [ ] **Step 5: Verify client detail UI**

Run:

```bash
pnpm dev
```

Check client detail pages:

- All clients show an edit client button.
- Empresa/Comunidad clients show signer details.
- Empresa/Comunidad clients show `Editar Firmante` if signer exists.
- Empresa/Comunidad clients show `Añadir Firmante` if signer is missing.

---

## Task 7: Fix Signer Edit/Add In Trámite Client Section

**Files:**
- Modify: `src/tramites/components/editTramite/client/TramiteClientSection.tsx`
- Modify: `src/tramites/components/editTramite/client/SignerTabContent.tsx`
- Possibly modify: `src/tramites/components/editTramite/client/EditTramiteDrawer.tsx`

- [ ] **Step 1: Pass real editability to signer tab**

In `TramiteClientSection.tsx`, change:

```tsx
<SignerTabContent
  signer={signer}
  onSignerUpdated={onUpdated}
  isEditable={false}
/>
```

to:

```tsx
<SignerTabContent
  clientId={client.id}
  signer={signer ?? null}
  onSignerUpdated={onUpdated}
  isEditable={isEditable}
/>
```

Also update the `signer` prop type in `TramiteClientSection` from required to optional/null if the data layer can return no signer:

```ts
signer?: SignerDB | null;
```

- [ ] **Step 2: Update SignerTabContent props**

Change `SignerTabContent` props to:

```ts
interface Props {
  clientId: string;
  signer: SignerDB | null;
  onSignerUpdated: () => void;
  isEditable: boolean | null;
}
```

- [ ] **Step 3: Reuse SignerInfoBlock in SignerTabContent**

Replace the current signer markup with:

```tsx
import { SignerInfoBlock } from "@/clientes/components/SignerInfoBlock";

export default function SignerTabContent({
  clientId,
  signer,
  onSignerUpdated,
  isEditable,
}: Props) {
  return (
    <div className="space-y-6">
      <SignerInfoBlock
        clientId={clientId}
        signer={signer}
        canEdit={!!isEditable}
        onUpdated={onSignerUpdated}
      />
    </div>
  );
}
```

This gives both edit and add behavior through the same `SignerEditor` component.

- [ ] **Step 4: Verify trámite client/signer UI**

Run:

```bash
pnpm dev
```

Check a trámite with `Empresa` or `Comunidad de Propietarios`:

- Firmante tab shows signer data.
- If editable, firmante tab shows edit/add button.
- If not editable, data is visible but the button is hidden.

---

## Task 8: Keep Rechazar Cliente Available And Add Guard Tests

**Files:**
- Modify: `src/comparativas/components/details/MainView.tsx`
- Modify: `src/comparativas/components/details/MainView.rechazar.test.tsx`

- [ ] **Step 1: Keep commercial access unchanged**

Do not add `!isComercial` to the `isStudied` block. The button must remain accessible to commercial users.

- [ ] **Step 2: Align visible label**

Change the button visible text to the action label while preserving loading state:

```tsx
{rechazando ? "Rechazando..." : "Rechazar Cliente"}
```

- [ ] **Step 3: Add/adjust tests for admin and commercial**

Update `MainView.rechazar.test.tsx` to render both roles and assert the button is visible:

```tsx
test.each([
  ["admin"],
  ["2"],
])("shows Rechazar Cliente action for role %s", (role) => {
  render(
    <MainView
      comparativa={baseComparativa as never}
      userData={{ ...userData, role } as never}
      onUpdate={() => {}}
      isSubcomercial={false}
      isEditable
      isComercialEditable={false}
      isProcessed={false}
    />,
  );

  expect(screen.getByRole("button", { name: /Rechazar Cliente/i })).toBeDefined();
});
```

- [ ] **Step 4: Verify**

Run:

```bash
pnpm test src/comparativas/components/details/MainView.rechazar.test.tsx
```

Expected: PASS.

---

## Task 9: Update Review Documentation With Corrected Scope

**Files:**
- Modify: `docs/changes/june/review/2026-06-03-review-bloque-1-parches-crm.md`

- [ ] **Step 1: Add addendum near the top**

Add:

```md
## Addendum 2026-06-04

Product/technical decisions after the initial review:

- Tooling is pnpm-only; Bun findings are obsolete and should be translated to pnpm/Vitest verification.
- `Rechazar Cliente` is intentionally available to comerciales.
- Deprecated POST legacy paths are not maintained and should not drive fix work.
- `Fecha de Baja` belongs in Liquidez table and trámite timeline, not in the main status panel.
- The implemented commission/default-notes model (`user_company_commissions`, `user_default_notes`) is accepted as correct.
```

- [ ] **Step 2: Mark superseded findings**

For findings about commercial access to `Rechazar Cliente`, POST legacy comparisons, and `commission_pct/default_notes`, add `Superseded by Addendum 2026-06-04` instead of deleting history.

- [ ] **Step 3: Verify docs only**

Run:

```bash
pnpm lint
```

Expected: lint still passes.

---

## Final Verification

After all tasks:

```bash
pnpm test
pnpm type-check
pnpm lint
```

Manual QA checklist:

- Commercial users can still see and use `Rechazar Cliente` on completed comparativas.
- Metrics API returns 403 for non-admin/directors.
- Client detail page shows client edit action.
- Client detail page shows signer information and add/edit signer action for Empresa/Comunidad.
- Trámite firmante tab shows signer information and add/edit action when editable.
- Trámite main view has two panels: status/actions and compact two-column summary.
- `Fecha de Baja` appears in liquidity table and timeline, not duplicated in status panel.
- No command uses Bun.

## Explicit Non-Goals

- Do not fix deprecated POST pagination compatibility in `/api/v2/comparisons`.
- Do not remove commercial access to `Rechazar Cliente`.
- Do not replace the current commission/default-notes model with `commission_pct/default_notes`.
- Do not introduce a new design system for these screens.
