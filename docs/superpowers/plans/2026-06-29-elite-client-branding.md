# Elite Client Branding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` or execute task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Soportar múltiples clientes Elite con paleta, logo, favicon y emails personalizados sin hardcodes por cliente.

**Architecture:** Centralizar branding en `organization.metadata.branding` y `organization.logo`, con fallback Negoco. Un resolver compartido por tenant alimentará CSS variables, logos de UI, metadata y plantillas de email.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, Turso/libSQL, React Email, Nodemailer, Vitest, pnpm.

---

## File Structure

**New files**
- `src/core/branding/types.ts` - contratos de branding compartidos.
- `src/core/branding/defaults.ts` - valores Negoco Cloud por defecto.
- `src/core/branding/tenant.ts` - parsing robusto de host/subdominio.
- `src/core/branding/css.ts` - conversión de paleta a CSS variables.
- `src/core/branding/metadata.ts` - parseo seguro de `organization.metadata`.
- `src/core/branding/server.ts` - resolver server-side desde request o headers.
- `src/core/branding/email.ts` - tema y credenciales SMTP por tenant.
- `src/core/branding/client.ts` - helper client-side para logos desde `organization`.
- `src/core/branding/*.test.ts` - cobertura focalizada del resolver.

**Modified files**
- `src/app/layout.tsx` - metadata, favicon y CSS variables por tenant.
- `src/app/(auth)/layout.tsx`, `src/core/components/auth/login/LoginWrapper.tsx`, reset password - logos sin hardcodes.
- `src/core/components/Header.tsx` y `src/tramites/components/DocumentsForm.tsx` - logos desde organización/branding.
- `src/app/globals.css` - retirar la paleta `[data-client="beenergy"]`.
- `src/core/hooks/*email.tsx`, `src/*/hooks/update-*-status-notification-email.tsx`, `src/app/api/v2/support/send-email/route.ts` - emails tematizados.
- `next.config.ts` - quitar host específico de Beenergy.

---

## Tasks

### Task 1: Shared Branding Core

- [ ] Crear tipos, defaults, parser de tenant, parser de metadata, CSS variables y resolver server-side.
- [ ] Añadir tests para host parsing, fallback default, gating por plan Elite y generación de CSS variables.

### Task 2: UI Branding

- [ ] Aplicar branding en `RootLayout` sin depender de `window`.
- [ ] Sustituir selección de logos en auth, login, reset password, header y documentos por helpers compartidos.
- [ ] Mantener defaults Negoco cuando no haya branding Elite activo.

### Task 3: Email Branding

- [ ] Centralizar remitente, logo, colores y credenciales SMTP en `resolveEmailBranding`.
- [ ] Refactorizar welcome, reset password, status updates y support email para usar el tema compartido.
- [ ] Añadir tests para prefijo SMTP y fallback a `EMAIL_NOREPLY`.

### Task 4: Cleanup

- [ ] Eliminar CSS y ramas específicas de Beenergy.
- [ ] Quitar `beenergy.vercel.app` y `beenergy.localhost` de configuración global salvo que un test lo justifique.
- [ ] Auditar con `rg -n -i "beenergy|/beenergy.png|logo_inline" src next.config.ts`.

### Task 5: Verification

- [ ] Ejecutar tests focalizados de branding/email con `pnpm vitest run`.
- [ ] Ejecutar `pnpm type-check`.
- [ ] No ejecutar build salvo que el cambio final lo requiera por riesgo alto.

---

## Metadata Example

```json
{
  "branding": {
    "enabled": true,
    "displayName": "Beenergy",
    "faviconUrl": "https://firebasestorage.googleapis.com/...",
    "logo": {
      "defaultUrl": "https://firebasestorage.googleapis.com/...",
      "emailUrl": "https://firebasestorage.googleapis.com/...",
      "alt": "Beenergy",
      "width": 700,
      "height": 300
    },
    "palette": {
      "primary": {
        "50": "#fffdeb",
        "100": "#fdf7c8",
        "200": "#faee8d",
        "300": "#f8e151",
        "400": "#f7d43a",
        "500": "#f0b210",
        "600": "#d48a0b",
        "700": "#b0630d",
        "800": "#8f4d11",
        "900": "#763f11",
        "950": "#442004",
        "DEFAULT": "#f0b210"
      }
    },
    "hero": {
      "background": "linear-gradient(90deg, #f0b210 0%, #f7d43a 100%)",
      "border": "#faee8d",
      "padding": "16px",
      "cardBorder": "transparent"
    },
    "email": {
      "fromName": "Beenergy",
      "smtpEnvPrefix": "BEENERGY"
    }
  }
}
```

## Assumptions

- El branding solo se activa cuando `organization.plan` resuelve a `elite` y `branding.enabled === true`.
- `organization.logo` y las URLs de metadata son las fuentes de logos de clientes; `public/` queda para defaults de Negoco.
- Se mantiene el patrón actual de tenant DB con una organización principal por base de datos.
- Las credenciales SMTP se resuelven por variables de entorno, nunca desde metadata.
