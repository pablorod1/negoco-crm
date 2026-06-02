# Bloque 2 – Backoffice Panel, Docs & Fotovoltaica Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three features: (1) a gerencia-only backoffice control panel showing monthly per-backoffice tramites/estudios/incidencias stats, (2) a fotovoltaica boolean button on tramites, and (3) GW en cartera por colaborador (annual kWh consumption aggregation by user).

**Architecture:** Same as Block 1 — Next.js 16 App Router + React 19, Turso raw SQL, Bun test runner, Recharts for charts, Tailwind v4. Gerencia-only views gated by `permissions.isDireccion` (role `"admin"`). New DB column `tramites.is_fotovoltaica` via migration `007` (Block 1 uses `005` and `006`). Backoffice metrics use the same team-performance style aggregation. GW aggregation uses `contracts.pot1..pot6` summed per user.

**Tech Stack:** TypeScript, Next.js 16, React 19, @libsql/client, Zod, Recharts, Tailwind v4, Bun test runner.

**Verification baseline:** `bun test && npx tsc --noEmit && npm run lint`

---

## File Structure

**New files**
- `docs/migrations/007_add_fotovoltaica_boolean.sql` — add `is_fotovoltaica` to `tramites`
- `src/app/api/v2/analytics/backoffice-metrics/route.ts` — backoffice performance aggregation
- `src/app/api/v2/analytics/backoffice-metrics/route.test.js` — tests
- `src/dashboard/components/charts/BackofficeMetricsView.tsx` — the backoffice control panel component
- `src/app/api/v2/analytics/portfolio-gw/route.ts` — GW per colaborador aggregation
- `src/app/api/v2/analytics/portfolio-gw/route.test.js` — tests
- `src/dashboard/components/charts/PortfolioGwView.tsx` — GW chart
- `src/app/api/v2/contracts/[id]/fotovoltaica/route.ts` — PATCH to toggle fotovoltaica
- `src/app/api/v2/contracts/[id]/fotovoltaica/route.test.js` — tests

**Modified files**
- `src/tramites/types/tramite.types.ts` — add `is_fotovoltaica` to `TramiteRow`
- `src/tramites/components/details/StatusCard.tsx` or `TramiteStatusSection.tsx` — fotovoltaica toggle button
- `src/app/api/v2/contracts/route.ts` — include `is_fotovoltaica` in SELECT
- `src/dashboard/layouts/AdminLayout.tsx` — conditionally render backoffice metrics inside `metrics` view

---

## Task 1: Migration — `tramites.is_fotovoltaica`

**Files:**
- Create: `docs/migrations/007_add_fotovoltaica_boolean.sql`

- [ ] **Step 1: Create the migration**

Create `docs/migrations/007_add_fotovoltaica_boolean.sql`:
```sql
-- Add fotovoltaica boolean flag to tramites
-- Marks whether a contract has solar panels (placas solares)
ALTER TABLE tramites ADD COLUMN is_fotovoltaica INTEGER NOT NULL DEFAULT 0;
```

Run manually: `turso db shell <db-name> < docs/migrations/007_add_fotovoltaica_boolean.sql`

- [ ] **Step 2: Add to TramiteRow type**

In `src/tramites/types/tramite.types.ts`, add `is_fotovoltaica: boolean` (or `number` since SQLite stores as 0/1) to `TramiteRow`.

- [ ] **Step 3: Include in contracts SELECT**

In `src/app/api/v2/contracts/route.ts`, in the main SELECT query that builds tramite rows, add `t.is_fotovoltaica` to the selected columns so it reaches the client.

- [ ] **Step 4: Commit**

```bash
git add docs/migrations/007_add_fotovoltaica_boolean.sql src/tramites/types/tramite.types.ts src/app/api/v2/contracts/route.ts
git commit -m "feat(tramites): add is_fotovoltaica column to tramites"
```

---

## Task 2: Fotovoltaica toggle button on tramite detail

A simple button on the tramite detail view that toggles the `is_fotovoltaica` flag. Visible to backoffice and gerencia.

**Files:**
- Create: `src/app/api/v2/contracts/[id]/fotovoltaica/route.ts`
- Create: `src/app/api/v2/contracts/[id]/fotovoltaica/route.test.js`
- Modify: `src/tramites/components/editTramite/TramiteStatusSection.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/v2/contracts/[id]/fotovoltaica/route.test.js`:
```js
import { beforeEach, describe, expect, mock, test } from "bun:test";

const execute = mock(() => ({ rows: [], rowsAffected: 1 }));
const getTursoClient = mock(() => ({ execute }));

mock.module("@/core/libsql/client", () => ({ getTursoClient }));
mock.module("@/core/auth/session-utils", () => ({
  validateUserSession: () => ({
    success: true,
    user: { id: "u1", role: "1", email: "bo@test.com", name: "BO" },
  }),
}));

const fotoRoute = await import("./route.ts");

beforeEach(() => {
  execute.mockClear();
  getTursoClient.mockClear();
});

describe("PATCH /contracts/[id]/fotovoltaica", () => {
  test("toggles is_fotovoltaica to true", async () => {
    const res = await fotoRoute.PATCH(
      new Request("https://x/api/v2/contracts/c1/fotovoltaica", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_fotovoltaica: true }),
      }),
      { params: Promise.resolve({ id: "c1" }) },
    );
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("rejects unauthorized", async () => {
    mock.module("@/core/auth/session-utils", () => ({
      validateUserSession: () => ({ success: false }),
    }));
    const { PATCH: fresh } = await import("./route.ts");
    const res = await fresh(
      new Request("https://x/api/v2/contracts/c1/fotovoltaica", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_fotovoltaica: true }),
      }),
      { params: Promise.resolve({ id: "c1" }) },
    );
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/app/api/v2/contracts/[id]/fotovoltaica/route.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the fotovoltaica toggle route**

Create `src/app/api/v2/contracts/[id]/fotovoltaica/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { validateUserSession } from "@/core/auth/session-utils";

const Schema = z.object({
  is_fotovoltaica: z.boolean(),
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
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid parameters" }, { status: 400 });
  }

  const client = getTursoClient(req);
  if (!client) {
    return NextResponse.json({ success: false, error: "Database error" }, { status: 500 });
  }

  const result = await client.execute({
    sql: "UPDATE tramites SET is_fotovoltaica = ? WHERE id = ?",
    args: [parsed.data.is_fotovoltaica ? 1 : 0, id],
  });

  if (result.rowsAffected === 0) {
    return NextResponse.json({ success: false, error: "Trámite no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/app/api/v2/contracts/[id]/fotovoltaica/route.test.js`
Expected: PASS.

- [ ] **Step 5: Add toggle button to TramiteStatusSection**

In `src/tramites/components/editTramite/TramiteStatusSection.tsx`, locate the area after the status badges. Add a labeled toggle for "Fotovoltaica" that calls the API:

```tsx
{!isComercial && (
  <div className="flex items-center gap-2 mt-3">
    <Switch
      checked={!!tramite.is_fotovoltaica}
      onCheckedChange={async (checked) => {
        const res = await fetch(
          `/api/v2/contracts/${tramite.id}/fotovoltaica`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_fotovoltaica: checked }),
          },
        );
        if (res.ok) onUpdate();
      }}
      id="fotovoltaica-toggle"
    />
    <Label htmlFor="fotovoltaica-toggle" className="text-sm text-gray-600">
      Tiene placas solares
    </Label>
  </div>
)}
```

Import `Switch` from `@/core/components/ui/switch` and `Label` from `@/core/components/ui/label`.

- [ ] **Step 6: Verify + commit**

```bash
bun test && npx tsc --noEmit && npm run lint
git add src/app/api/v2/contracts/[id]/fotovoltaica/ src/tramites/components/editTramite/TramiteStatusSection.tsx
git commit -m "feat(tramites): add fotovoltaica toggle button and API endpoint"
```

---

## Task 3: Backoffice control panel (gerencia-only)

A new sub-view within the "Métricas" dashboard showing monthly per-backoffice stats: tramites created, estudios (comparativas) completed, incidencias resolved. Only visible to `isDireccion`.

**Files:**
- Create: `src/app/api/v2/analytics/backoffice-metrics/route.ts`
- Create: `src/app/api/v2/analytics/backoffice-metrics/route.test.js`
- Create: `src/dashboard/components/charts/BackofficeMetricsView.tsx`
- Modify: `src/dashboard/layouts/AdminLayout.tsx` — add backoffice metrics inside `metrics` view

- [ ] **Step 1: Write the failing test**

Create `src/app/api/v2/analytics/backoffice-metrics/route.test.js`:
```js
import { beforeEach, describe, expect, mock, test } from "bun:test";

const execute = mock(() => ({ rows: [], rowsAffected: 0 }));
const getTursoClient = mock(() => ({ execute }));

mock.module("@/core/libsql/client", () => ({ getTursoClient }));
mock.module("@/core/auth/session-utils", () => ({
  validateUserSession: () => ({
    success: true,
    user: { id: "admin1", role: "admin", email: "a@b.com", name: "Admin" },
  }),
}));

const route = await import("./route.ts");

beforeEach(() => {
  execute.mockClear();
  getTursoClient.mockClear();
});

describe("GET /api/v2/analytics/backoffice-metrics", () => {
  test("returns 403 for non-admin", async () => {
    mock.module("@/core/auth/session-utils", () => ({
      validateUserSession: () => ({
        success: true,
        user: { id: "c1", role: "2", email: "c@b.com", name: "Comercial" },
      }),
    }));
    const { GET: fresh } = await import("./route.ts");
    const res = await fresh(new Request("https://x/api/v2/analytics/backoffice-metrics"));
    expect(res.status).toBe(403);
  });

  test("returns data for admin", async () => {
    const res = await route.GET(
      new Request("https://x/api/v2/analytics/backoffice-metrics"),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/app/api/v2/analytics/backoffice-metrics/route.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the backoffice metrics API**

Create `src/app/api/v2/analytics/backoffice-metrics/route.ts`:

This endpoint aggregates stats per backoffice user (role="1") by month: tramites count, comparativas (estudios) completed, and tickets (incidencias) resolved.

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
  const month = url.searchParams.get("month") || String(new Date().getMonth() + 1).padStart(2, "0");
  const year = url.searchParams.get("year") || String(new Date().getFullYear());

  const period = `${year}-${month}`;

  // Tramites per backoffice user in the period
  const tramitesResult = await client.execute({
    sql: `SELECT u.name, u.id, COUNT(t.id) as tramites_count
          FROM user u LEFT JOIN tramites t ON t.user_id = u.id
            AND substr(t.creation_date, 1, 7) = ?
          WHERE u.role = '1'
          GROUP BY u.id, u.name`,
    args: [period],
  });

  // Comparativas completed per backoffice user
  const estudiosResult = await client.execute({
    sql: `SELECT u.name, u.id, COUNT(c.id) as estudios_count
          FROM user u LEFT JOIN comparativas c ON c.user_id = u.id
            AND c.status = 'completed'
            AND substr(c.creation_date, 1, 7) = ?
          WHERE u.role = '1'
          GROUP BY u.id, u.name`,
    args: [period],
  });

  // Incidencias resolved per backoffice user
  const incidenciasResult = await client.execute({
    sql: `SELECT u.name, u.id, COUNT(tk.id) as incidencias_count
          FROM user u LEFT JOIN tickets tk ON tk.assigned_to = u.id
            AND tk.status_id = 3
            AND substr(tk.created_at, 1, 7) = ?
          WHERE u.role = '1'
          GROUP BY u.id, u.name`,
    args: [period],
  });

  // Merge results by user id
  const userMap: Record<string, { name: string; tramites: number; estudios: number; incidencias: number }> = {};

  for (const row of tramitesResult.rows) {
    const id = String(row.id);
    userMap[id] = { name: String(row.name), tramites: Number(row.tramites_count), estudios: 0, incidencias: 0 };
  }

  for (const row of estudiosResult.rows) {
    const id = String(row.id);
    if (!userMap[id]) userMap[id] = { name: String(row.name), tramites: 0, estudios: 0, incidencias: 0 };
    userMap[id].estudios = Number(row.estudios_count);
  }

  for (const row of incidenciasResult.rows) {
    const id = String(row.id);
    if (!userMap[id]) userMap[id] = { name: String(row.name), tramites: 0, estudios: 0, incidencias: 0 };
    userMap[id].incidencias = Number(row.incidencias_count);
  }

  return NextResponse.json({ success: true, data: Object.values(userMap) });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/app/api/v2/analytics/backoffice-metrics/route.test.js`
Expected: PASS.

- [ ] **Step 5: Create the BackofficeMetricsView component**

Create `src/dashboard/components/charts/BackofficeMetricsView.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import type { User } from "@/core/types";

interface BackofficeUserMetrics {
  name: string;
  tramites: number;
  estudios: number;
  incidencias: number;
}

interface BackofficeMetricsViewProps {
  loading: boolean;
  userData: User;
}

export function BackofficeMetricsView({ loading, userData }: BackofficeMetricsViewProps) {
  const [data, setData] = useState<BackofficeUserMetrics[]>([]);
  const [fetching, setFetching] = useState(true);

  const fetchData = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch("/api/v2/analytics/backoffice-metrics");
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch {
      // silent
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const isLoading = loading || fetching;

  return (
    <Card variant="dashboard">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-gray-500">
          Rendimiento Backoffice (mes actual)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <p className="text-sm text-gray-400">Sin datos de backoffice</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 font-medium text-gray-500">Backoffice</th>
                  <th className="text-right py-2 font-medium text-gray-500">Trámites</th>
                  <th className="text-right py-2 font-medium text-gray-500">Estudios</th>
                  <th className="text-right py-2 font-medium text-gray-500">Incidencias</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.name} className="border-b border-gray-50">
                    <td className="py-2 font-medium">{row.name}</td>
                    <td className="py-2 text-right">{row.tramites}</td>
                    <td className="py-2 text-right">{row.estudios}</td>
                    <td className="py-2 text-right">{row.incidencias}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 6: Add to the metrics view in AdminLayout**

In `src/dashboard/layouts/AdminLayout.tsx`, inside the `metrics` view block (which was introduced in Block 1 Task 4), add `BackofficeMetricsView` below `MetricsView`:

```tsx
import { BackofficeMetricsView } from "@/dashboard/components/charts/BackofficeMetricsView";
```

And in the `metrics` view branch, after `<MetricsView>`:
```tsx
            <MetricsView loading={loading} userData={userData} />
            <BackofficeMetricsView loading={loading} userData={userData} />
```

- [ ] **Step 7: Verify + commit**

```bash
bun test && npx tsc --noEmit && npm run lint
git add src/app/api/v2/analytics/backoffice-metrics/ src/dashboard/components/charts/BackofficeMetricsView.tsx src/dashboard/layouts/AdminLayout.tsx
git commit -m "feat(analytics): add gerencia-only backoffice control panel"
```

---

## Task 4: GW en cartera por colaborador

Aggregate `contracts.consumption` (kWh annual) per user to show portfolio size by colaborador. Display as a chart in the gerencia dashboard.

**Files:**

Aggregate `contracts.consumption` (kWh annual) per user to show portfolio size by colaborador. Display as a chart in the gerencia dashboard.

**Files:**
- Create: `src/app/api/v2/analytics/portfolio-gw/route.ts`
- Create: `src/app/api/v2/analytics/portfolio-gw/route.test.js`
- Create: `src/dashboard/components/charts/PortfolioGwView.tsx`
- Modify: `src/dashboard/layouts/AdminLayout.tsx` — add portfolio view inside `metrics`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/v2/analytics/portfolio-gw/route.test.js`:
```js
import { beforeEach, describe, expect, mock, test } from "bun:test";

const execute = mock(() => ({ rows: [], rowsAffected: 0 }));
const getTursoClient = mock(() => ({ execute }));

mock.module("@/core/libsql/client", () => ({ getTursoClient }));
mock.module("@/core/auth/session-utils", () => ({
  validateUserSession: () => ({
    success: true,
    user: { id: "admin1", role: "admin", email: "a@b.com", name: "Admin" },
  }),
}));

const route = await import("./route.ts");

beforeEach(() => {
  execute.mockClear();
  getTursoClient.mockClear();
});

describe("GET /api/v2/analytics/portfolio-gw", () => {
  test("returns 403 for non-admin", async () => {
    mock.module("@/core/auth/session-utils", () => ({
      validateUserSession: () => ({
        success: true,
        user: { id: "c1", role: "2", email: "c@b.com", name: "Comercial" },
      }),
    }));
    const { GET: fresh } = await import("./route.ts");
    const res = await fresh(new Request("https://x/api/v2/analytics/portfolio-gw"));
    expect(res.status).toBe(403);
  });

  test("returns portfolio data for admin", async () => {
    const res = await route.GET(
      new Request("https://x/api/v2/analytics/portfolio-gw"),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/app/api/v2/analytics/portfolio-gw/route.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the portfolio GW endpoint**

Create `src/app/api/v2/analytics/portfolio-gw/route.ts`:

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

  // Sum annual consumption (kWh) per colaborador for active tramites
  // Convert kWh to MWh for display (divide by 1000)
  const result = await client.execute({
    sql: `SELECT u.name, u.id,
            SUM(COALESCE(con.consumption, 0)) as total_kwh
          FROM user u
          LEFT JOIN tramites t ON t.user_id = u.id AND t.status = 'Activo'
          LEFT JOIN contracts con ON con.tramite_id = t.id
          WHERE u.role = '2' OR u.role = '1'
          GROUP BY u.id, u.name
          ORDER BY total_kwh DESC`,
    args: [],
  });

  const data = result.rows.map((row) => ({
    name: String(row.name),
    id: String(row.id),
    totalKwh: Number(row.total_kwh ?? 0),
    totalMwh: Number(row.total_kwh ?? 0) / 1000,
  }));

  return NextResponse.json({ success: true, data });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/app/api/v2/analytics/portfolio-gw/route.test.js`
Expected: PASS.

- [ ] **Step 5: Create the PortfolioGwView component**

Create `src/dashboard/components/charts/PortfolioGwView.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { NumberTicker } from "@/core/components/ui/number-ticker";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { User } from "@/core/types";

interface PortfolioEntry {
  name: string;
  id: string;
  totalKwh: number;
  totalMwh: number;
}

interface PortfolioGwViewProps {
  loading: boolean;
  userData: User;
}

export function PortfolioGwView({ loading, userData }: PortfolioGwViewProps) {
  const [data, setData] = useState<PortfolioEntry[]>([]);
  const [fetching, setFetching] = useState(true);

  const fetchData = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch("/api/v2/analytics/portfolio-gw");
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch {
      // silent
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const isLoading = loading || fetching;
  const totalMwh = data.reduce((sum, d) => sum + d.totalMwh, 0);

  return (
    <Card variant="dashboard">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-gray-700">
          Cartera por Colaborador (MWh/año)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-gray-500">Total MWh</p>
            {isLoading ? (
              <span>—</span>
            ) : (
              <NumberTicker value={totalMwh} decimalPlaces={1} endContent=" MWh" />
            )}
          </div>
        </div>
        {isLoading ? (
          <div className="h-48 bg-gray-50 rounded animate-pulse" />
        ) : data.length === 0 ? (
          <p className="text-sm text-gray-400">Sin datos</p>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value: number) => [`${value.toFixed(1)} MWh`, "Cartera"]} />
              <Bar dataKey="totalMwh" fill="var(--primary-color-500)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 6: Add to AdminLayout metrics view**

In `src/dashboard/layouts/AdminLayout.tsx`, after `BackofficeMetricsView`, add `PortfolioGwView`:

```tsx
import { PortfolioGwView } from "@/dashboard/components/charts/PortfolioGwView";
```

And in the `metrics` view block:
```tsx
            <MetricsView loading={loading} userData={userData} />
            <BackofficeMetricsView loading={loading} userData={userData} />
            <PortfolioGwView loading={loading} userData={userData} />
```

- [ ] **Step 7: Verify + commit**

```bash
bun test && npx tsc --noEmit && npm run lint
git add src/app/api/v2/analytics/portfolio-gw/ src/dashboard/components/charts/PortfolioGwView.tsx src/dashboard/layouts/AdminLayout.tsx
git commit -m "feat(analytics): add GW portfolio by colaborador chart"
```

---

## Self-Review

**1. Spec coverage:**

| Spec item | Task |
|---|---|
| Panel de control de backoffice (gerencia-only) | T3 |
| Botón fotovoltaica en tramites | T2 (+ migration T1) |
| Ver cartera por colaborador (MWh consumidos) | T4 |

All "Bloque 2" items covered.

**2. Placeholder scan:** No TBD, TODO, or placeholder patterns found. All code steps contain complete implementations.

**3. Type consistency:**
- `is_fotovoltaica` used consistently as `boolean` in TS and `INTEGER NOT NULL DEFAULT 0` in SQL.
- `BackofficeMetricsView` and `PortfolioGwView` both accept `{ loading, userData }` matching the AdminLayout prop pattern.
- `PortfolioGwView` follows the data-fetching pattern (`useCallback` + `useEffect`).