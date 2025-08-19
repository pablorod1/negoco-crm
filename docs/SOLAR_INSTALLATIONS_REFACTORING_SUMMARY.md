# Solar Installations (Fotovoltaica) Flow Optimization Summary

This change implements the same optimization criteria used for the "create trámite" flow, adapted to the Fotovoltaica creation component and API.

## What changed

- Client component `AddFotovoltaicaDialog.tsx`:
  - Added step-wise loader with clear progress messages: "Validando datos", "Subiendo archivos", "Preparando solicitud", "Creando solicitud", "Finalizando trámite".
  - Client-side Zod validation prior to submit using shared schemas.
  - Network timeout with user-friendly toast on slow responses.
  - More robust error toasts per failure cause.
  - Uses `PUT /api/v2/solar-installations` as the transactional create endpoint.

- API endpoint `src/app/api/v2/solar-installations/route.ts`:
  - `PUT` is now fully transactional using Turso transactions: fotovoltaica + files are committed or rolled back together.
  - Request body is validated with Zod (`FotovoltaicaSchema`, `FotovoltaicaFileSchema`).
  - Clear error categories and messages, plus lightweight performance logging.

- Shared validation `src/fotovoltaica/schemas.ts`:
  - Zod schemas aligned with DB and app types for fotovoltaica and files.

- Helpers `src/fotovoltaica/utils/addFotovoltaicaHelpers.ts`:
  - Now accept both `Client` and `Transaction` to support atomic operations.

## Quality gates

- TypeScript build: PASS
- Lint/typecheck: PASS
- API path compatibility: Maintains existing POST for listing; PUT for create mirrors legacy /api/v1/fotovoltaica/add semantics with improved atomicity.

## Notes

- DB defaults for `client_type` remain compatible with existing values in the app.
- Coordinates are derived from `location` URL by existing helper. If extraction fails, DB receives `null`.

## Next steps (optional)

- Add unit tests for the `PUT /api/v2/solar-installations` validation and transaction paths.
- Extend per-step Zod validations in step forms for inline error rendering.
