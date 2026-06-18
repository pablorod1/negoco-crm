# Imagina Energia Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full server-side Imagina Energia integration for tenant-scoped auth, tariffs, contract submission, scoring, signature, documents, webhooks, reconciliation, and the verified-status UI trigger.

**Architecture:** Add a dedicated server module under `src/core/integrations/imagina-energia` with config, per-call JWT auth, `X-Canal` enforcement, schemas, HMAC verification, state mappers, persistence helpers, and high-level operations. Expose authenticated internal routes under `src/app/api/v2/integrations/imagina-energia/*` and public HMAC-validated callbacks under `src/app/api/webhooks/imagina-energia/*`; callbacks resolve tenant from the public host subdomain. Add idempotent tenant SQL migrations in `docs/migrations` for integration config, Imagina attempts/events/documents/scoring/signatures, rate metadata, and structured contract/client fields.

**Tech Stack:** Next.js App Router, TypeScript, Zod, libSQL/Turso, Web Crypto/Node crypto, Vitest, pnpm.

---

### Task 1: Database Surface

**Files:**
- Create: `docs/migrations/008_imagina_energia_integration.sql`
- Modify: `src/tramites/types/tramite.types.ts`
- Modify: `src/comercializadoras/types/comercializadora.types.ts`

- [ ] Add tenant table `integrations` with `provider`, `enabled`, and JSON `config`.
- [ ] Extend `comercializadora_rates` with `provider`, `external_rate_id`, `alias_externo`, `codigo_atr`, `descripcion`, `raw`, `synced_at`, and `enabled`.
- [ ] Add Imagina trace tables for submissions, webhook events, scoring, signatures, documents, and contract snapshots.
- [ ] Add structured fields needed by Imagina validation: contract CNMC street pieces, selected rate ID, CNAE, phone prefixes, signature channel, document type hints, and Imagina identifiers.

### Task 2: Core Client, Auth, HMAC, Schemas, Mappers

**Files:**
- Create: `src/core/integrations/imagina-energia/config.ts`
- Create: `src/core/integrations/imagina-energia/auth.ts`
- Create: `src/core/integrations/imagina-energia/client.ts`
- Create: `src/core/integrations/imagina-energia/signature.ts`
- Create: `src/core/integrations/imagina-energia/schemas.ts`
- Create: `src/core/integrations/imagina-energia/state-mapper.ts`
- Create: `src/core/integrations/imagina-energia/mappers.ts`
- Create: `src/core/integrations/imagina-energia/persistence.ts`
- Create: `src/core/integrations/imagina-energia/service.ts`
- Create: `src/core/integrations/imagina-energia/index.ts`

- [ ] Read environment variables lazily and fail with explicit configuration errors.
- [ ] Request JWT on every functional API call with global `IMAGINA_EMAIL` and `IMAGINA_PASSWORD`.
- [ ] Reject any functional request before network I/O if tenant `X-Canal` is missing.
- [ ] Implement strict HMAC-SHA256 verification with canonical JSON, public URL matching, timestamp skew, and constant-time comparison.
- [ ] Implement tariff, scoring, contract, signature, document, dump, callback, and state schemas aligned with the local YAML and documented HTML discrepancies.
- [ ] Implement server-side prevalidation that returns actionable missing-field errors and never calls Imagina when required data is absent.
- [ ] Implement state mapping exactly as documented: signature sent to `Pendiente de Firma`, signed/activable/solicitado/aceptado to `Procesando`, active to `Activo`, denied scoring to `Scoring`, recoverable incidents to `Incidencia`, definitive cancellation or rejected signature to `KO`.

### Task 3: Internal API Routes

**Files:**
- Create: `src/app/api/v2/integrations/imagina-energia/status/route.ts`
- Create: `src/app/api/v2/integrations/imagina-energia/tarifas/route.ts`
- Create: `src/app/api/v2/integrations/imagina-energia/contracts/submit/route.ts`
- Create: `src/app/api/v2/integrations/imagina-energia/contracts/sync/route.ts`
- Create: `src/app/api/v2/integrations/imagina-energia/scoring/route.ts`
- Create: `src/app/api/v2/integrations/imagina-energia/signature/route.ts`

- [ ] Return integration status without exposing `config.x_canal_id`.
- [ ] Sync `GET /tarifas` into `comercializadora_rates`, using `id_tarifa_precios` as `external_rate_id`.
- [ ] Submit contracts only from the explicit internal route, after prevalidation, with tenant-aware callback URLs and default automatic Imagina signature flow.
- [ ] Implement paginated `GET /contratos` dump and `GET /contrato/{id}` reconciliation support.
- [ ] Implement async scoring endpoints for electricity, gas, no-SIPS electricity, and no-SIPS gas.
- [ ] Implement `POST /firma`, `POST /firma/reenviar`, `GET /firma/{circuito_id}`, and `GET /firma-health`.

### Task 4: Public Webhooks

**Files:**
- Create: `src/app/api/webhooks/imagina-energia/contratacion/route.ts`
- Create: `src/app/api/webhooks/imagina-energia/scoring/route.ts`
- Create: `src/app/api/webhooks/imagina-energia/contratos/route.ts`
- Modify: `src/proxy.ts`

- [ ] Allow Imagina webhook paths on tenant subdomains so the host resolves the correct Turso branch.
- [ ] Validate HMAC before any business write.
- [ ] Enforce idempotence by `request_id` for contratación/scoring and `_metadata.notification_id` for contract changes.
- [ ] Persist raw verified payloads and apply mapped CRM status transitions idempotently.
- [ ] Trigger document upload after successful contract creation callback.

### Task 5: Verified Status UI Trigger

**Files:**
- Modify: `src/tramites/components/details/MainView.tsx`
- Modify: `src/tramites/components/details/StatusCard.tsx`
- Modify: `src/tramites/components/editTramite/TramiteStatusSection.tsx`
- Modify: `src/tramites/components/editTramite/UpdateTramiteStatusModal.tsx`

- [ ] Pass `contracts` to the status modal.
- [ ] Resolve `contract.new_company` against active suppliers by ID or name, then compare normalized supplier name to `Imagina Energía`.
- [ ] Fetch tenant integration status and show an off-by-default switch only when target status is `Verificado`, supplier is Imagina, and integration is configured.
- [ ] After the existing status PATCH succeeds, call the Imagina submit route only when the switch is enabled; show server validation errors if submission is blocked.

### Task 6: Focused Tests and Verification

**Files:**
- Create: `src/core/integrations/imagina-energia/client.test.ts`
- Create: `src/core/integrations/imagina-energia/signature.test.ts`
- Create: `src/core/integrations/imagina-energia/state-mapper.test.ts`
- Create: `src/core/integrations/imagina-energia/mappers.test.ts`
- Create: `src/app/api/webhooks/imagina-energia/route-handlers.test.ts`

- [ ] Cover auth-per-call, `X-Canal` refusal, HMAC validation, state mapping, required-data validation, webhook idempotence, and status mapping.
- [ ] Run focused Vitest suites.
- [ ] Run `pnpm type-check`.
