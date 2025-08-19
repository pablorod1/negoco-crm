# Optimized Create Trámite Flow

This document summarizes the end-to-end improvements implemented for the Create Trámite workflow.

## Highlights
- Atomic DB transaction for client, signer, trámite, contracts, and files.
- Zod-based validation aligned with DB schema in `src/app/api/v2/contracts/route.ts`.
- Detailed loader with progress messages in the dialog Review step.
- Clear, user-friendly error messages (validation, DB, generic).
- Maintains full compatibility with existing UI and API inputs.

## Backend Changes
- All inserts execute within a single Turso transaction.
- Helper functions accept a generic DB executor so they run inside the transaction.
- Geocoding is computed before opening the transaction; failures do not block the flow.
- Zod schemas reflect DB shapes (types, nullability, required fields).

## Frontend Changes
- `AddTramiteDialog` tracks `loadingStep` and `loadingMessage`:
  - Step 1: upload files
  - Step 2: validate and prepare payload
  - Step 3: create records (client → signer → trámite → contracts → files)
  - Step 4: finalize
- `ReviewStep` shows a `LoadingStateModal` with step and message.

## Validation
- Per-step validation remains in existing forms; API validates all payloads again with Zod to ensure consistency with the DB.

## Error Handling
- API distinguishes invalid input vs DB/constraint errors.
- Frontend toasts display friendly messages and suggest corrective action.

## No Behavior Regressions
- Request format and endpoint URL remain identical.
- UI steps and transitions are preserved.

## Next Steps (Optional)
- Add unit tests for the API transaction boundaries and validation.
- Add e2e tests for the dialog flow and loader states.
