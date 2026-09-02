# Resultado persistente del estudio con IA y contrato HTTP

Apply `migrations/019_comparison_study_results.sql` after migration 018 before deploying this endpoint. It is idempotent and does not backfill historical studies. No remote migration is run by tests.

## HTTP contract

`GET /api/v2/comparisons/:id/study-result` returns `{ success: true, comparisonStatus, data: StudyResultDTO | null }`. `null` means no persisted result (including historical studies); it is not an error. Responses are `no-store`.

Client-only types live in `src/comparativas/types/study-result.types.ts`. Import these types, not the server service.

For an unknown received type, `GET ...?plan=fijo` or `?plan=indexado` previews that target without writing anything. Preview again whenever the selection changes. Valid received types cannot be changed. `receivedType` and `chosenType` remain null until confirmation for unknown types; `targetPlan` identifies the preview selection.

Pending DTOs contain:

- `state`, `receivedType`, `chosenType`, `typeOrigin`, `targetPlan`, `plans`, opaque `revision`.
- `pendingSteps`: `type` for unknown/unselected type, `plan` when the target is excluded, `commissions` only when at least one target amount is assigned (zero counts). An empty step list can still require confirmation after selecting a previously unknown type.
- `hasExistingCommissions`, `offerAvailable`, `salesCalculable`, `current`, `proposed`.
- `capabilities.canResolve`, `canChooseType`, `canManualSales`, and allowed `commissionDecisions`.

Role 2 only receives `{ sales }` in every amount object, including resolution snapshots. Admin/role 1 also receive `{ agency }`. No role receives raw payload, percentages, rule values or revision salt. `hasExistingCommissions` can indicate a hidden agency conflict without revealing its amount.

`PATCH` accepts only:

```json
{
  "resultId": "result UUID",
  "revision": "opaque revision from this selected-plan preview",
  "chosenType": "fijo",
  "planDecision": "none",
  "commissionDecision": "apply"
}
```

Omit `chosenType` for a valid received type, even when it equals that type. For an unknown type it is required. `planDecision` must be `none` for an included plan, otherwise `add` or `replace`. Replacing a plan preserves all inactive-plan amounts.

Commission decisions:

| Decision | Effect | Availability |
| --- | --- | --- |
| `keep` | Preserve both amounts | Always |
| `apply` | Apply offer and server-calculated sales | Offer present and sales calculable |
| `offer_keep_sales` | Apply offer; preserve previous sales | Offer present, sales uncalculable |
| `offer_clear_sales` | Apply offer; set sales null | Offer present, sales uncalculable |
| `manual` | Apply offer plus `manualSales` (finite number; zero valid) | Admin/role 1, offer present |

No other fields are accepted. When no offer was received, only `keep` is available and neither commission can change, even after type/plan selection. When an empty target is selected and sales are uncalculable, `offer_clear_sales` assigns the offer and leaves sales null; the UI can use this for its default confirmation, without implying that sales were calculated.

Monetary source offers, computed commissions and manual sales are limited to an absolute value of `Number.MAX_SAFE_INTEGER / 100` euros (approximately 90,071,992,547,409.9). The rounded cent count must also be a safe integer. Values outside that range are rejected, never capped: invalid receipts/calculations roll back, and out-of-range manual input returns 400. This bound does not limit percentage configuration values; it applies to the resulting monetary amount. Half-cents round away from zero. Binary-noise tolerance applies only immediately below a half-cent boundary, capped at `1e-7` cents; it never grows with large amounts or changes integer cents.

Successful PATCH returns the response shape above, with an immutable saved resolution. It does not approve the study: comparison status stays `awaiting_review`. Cancel simply closes the dialog; do not PATCH. A 409 requires refetching and reviewing a fresh proposal. Never resubmit stale decisions automatically. Exact requester/body/revision retries succeed without recalculating current rules; other decisions on a resolved result return 409.

Resolved GET uses saved decision amounts and does not recalculate keep/clear/manual outcomes. It also returns current comparison status and plans. The saved amounts describe this resolution, not subsequent edits to comparison commissions.

## Persistence, authorization and audit

Webhook result creation, auto-application, documents, study and delivery completion share the existing write transaction. Completed deliveries only ingest missing documents and never create/reapply/reopen results.

GET uses a read transaction. PATCH checks authorization before financial reads and again inside its write transaction, using current database role, effective complete/review permission, and own/subordinate access. Proposal revisions cover all comparison amounts (including hidden/inactive ones), owner, status, plans, company ID, supplier matching, rules and identity proof. Revisions are HMACs keyed by a random per-result secret stored only in the database.

Audit entries are atomic and use generic descriptions with no amounts embedded. Fields are `comision_fijo`, `comision_indexado`, `comision_sales_person_fijo`, `comision_sales_person_indexado`, `plan`, `study_result_type`, and `study_result_resolution`. Monetary old/new values retain SQL null. Role-2 historical-response filters must remove agency-field audit entries (or their old/new values) consistently. `study_result_type` contains only fijo/indexado; `study_result_resolution` contains only state names, not serialized financial decisions.

Existing comparison detail/list/raw/history responses also filter agency amounts for role 2. Completion metadata is calculated from the database before filtering, so an assigned zero remains distinguishable from an unassigned amount without exposing the agency commission. General status updates reject role-2 free-amount writes, and completion is blocked while a study result remains pending.

Comparison-to-contract creation sends `source_comparison_id` and the selected plan, never either commission amount. The server checks current access, owner, completed status, active plan and assigned amounts before creation, then checks them again and copies both amounts and the owner inside the contract transaction. This does not broaden permissions for general comparison edits or non-comparison contract creation.

## Deployment order and rollback

1. Follow the backup, writer pause and TEST-first procedure in migration 018. Keep the original backup immutable. The native libSQL migration preserves all historical amounts, including zeros in pending/processing comparisons.
2. Apply migration 019 to the selected database before deploying the application. Check table counts, foreign keys and integrity again. Historical studies must not create result rows. If 019 is already applied, 018 preserves its existing results; do not delete or recreate them.
3. No database replacement or connection change is required. Deploy the nullable-aware application before reopening writers, callbacks or jobs.
4. Verify an unknown-type result remains pending, cancellation writes nothing, a received valid type can auto-apply to an empty active plan, and role-2 responses contain no agency amounts. Resolving a result must leave the comparison awaiting review.
5. Do not roll back to an application version that treats null commissions as zero. If restoring the original backup is necessary, pause writers first and explicitly reconcile any studies or decisions received after that backup; restoring it discards those later writes.

No remote deployment or database replacement is automated by these migrations.

## Local verification — 2026-09-02

- Focused integration suite: 747 tests passed across 35 Vitest files, covering comparisons, the webhook, embedded/standalone login, migration, conversion, export and the resolution UI, including first-read status/result races.
- The existing `abarca-apolo-sips.test.js` imports `bun:test`; its two tests passed separately with Bun. Exclude that file when running the comparison directory with Vitest.
- The ingest proxy's five Node tests passed. A separate local assertion verified that staging preserves `oferta_tipo`, `comision_oferta` and an explicit zero `comision_base` without uploading anything.
- `pnpm type-check` passed. Full `pnpm lint` reported no errors and 104 warnings.
- React Doctor reported 77/100 and eight warnings. The panel loading warning points to a guarded reset already inside `finally`; aborted requests belong to a discarded context and must not update its state. The other findings concern serial transactional audit writes, small render helpers and existing form state synchronization; no diagnostic was suppressed.
- The previous offline-rebuild validation is superseded by the native libSQL migration tests documented in 018. No production data was changed by these checks.
- One final `pnpm build --webpack` passed, including TypeScript and static-page generation. Webpack uses the existing PDF configuration. Source-map upload and Next telemetry were disabled for this local build; no deployment was performed. Existing Sentry configuration emitted deprecation warnings.
