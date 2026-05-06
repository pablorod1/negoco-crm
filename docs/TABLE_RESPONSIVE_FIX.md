# Fix: Tablas desbordando el viewport (100dvw / 100dvh)

## Problema

Las páginas que contienen tablas (`/tramites`, `/comparativas`, `/fotovoltaica`, `/liquidez`) permiten que el contenido desborde horizontalmente más allá del viewport, provocando scroll horizontal en toda la página en lugar de únicamente dentro de la tabla.

## Causa raíz

El problema se origina en **tres niveles** de la jerarquía de componentes:

### 1. `TableContent.tsx` usa `max-w-dvw` (100dvw)

```tsx
// src/core/components/table/TableContent.tsx
<CardContent className="p-0 overflow-hidden w-full max-w-dvw">
  <div className="overflow-x-auto max-w-dvw">
```

`max-w-dvw` equivale a `max-width: 100dvw`, es decir, el ancho completo del viewport. Como el contenido de la tabla está dentro de un layout con sidebar (3rem colapsado / 18rem abierto) y padding lateral (`px-4` en la página, `px-6` en el header), la tabla se expande a 100dvw pero su contenedor real es **más estrecho** que el viewport. Resultado: la tabla sobresale del contenedor padre, arrastrando consigo todo el layout.

### 2. `Table.tsx` (Trámites) duplica el error en el wrapper

```tsx
// src/tramites/components/table/Table.tsx
<div className="flex flex-col gap-2 w-full h-full max-w-dvw">
```

El wrapper externo del DataTable de trámites también tiene `max-w-dvw`, propagando el desbordamiento un nivel más arriba.

### 3. `layout.tsx` — el div intermedio no tiene restricciones de overflow

```tsx
// src/app/(main)/layout.tsx
<SidebarInset>
  <div>                          ← Sin overflow-hidden ni min-w-0
    <Header />
    <main className="main-content">
      {children}
    </main>
  </div>
</SidebarInset>
```

`SidebarInset` usa `flex-1 w-full`, pero su hijo `<div>` no tiene `overflow-hidden` ni `min-w-0`. En un contexto flex, si un hijo no tiene `min-w-0`, puede crecer más allá del contenedor flex.

---

## Solución

### Cambio 1: `src/core/components/table/TableContent.tsx`

Eliminar `max-w-dvw` y confiar en el layout flex para contener el ancho. El `overflow-x-auto` del div interior es suficiente para hacer scroll solo en la tabla.

```diff
- <CardContent className="p-0 overflow-hidden w-full max-w-dvw">
-   <div className="overflow-x-auto max-w-dvw">
+ <CardContent className="p-0 overflow-hidden w-full">
+   <div className="overflow-x-auto">
```

### Cambio 2: `src/tramites/components/table/Table.tsx`

Eliminar `max-w-dvw` del wrapper externo y añadir `min-w-0` para que el contenedor flex no se agrande más allá de su padre.

```diff
- <div className="flex flex-col gap-2 w-full h-full max-w-dvw">
+ <div className="flex flex-col gap-2 w-full h-full min-w-0">
```

### Cambio 3: `src/fotovoltaica/components/table/FotovoltaicasTable.tsx`

Añadir `min-w-0` al wrapper para prevenir que crezca más allá de su contenedor flex.

```diff
- <div className="flex flex-col gap-2 w-full h-full">
+ <div className="flex flex-col gap-2 w-full h-full min-w-0">
```

### Cambio 4: `src/comparativas/components/table/ComparativasTable.tsx`

Mismo ajuste.

```diff
- <div className="flex flex-col gap-2 w-full h-full">
+ <div className="flex flex-col gap-2 w-full h-full min-w-0">
```

### Cambio 5: `src/app/(main)/layout.tsx`

Añadir `overflow-hidden` y `min-w-0` al `<div>` hijo de `SidebarInset` para que actúe como boundary de contención, y convertir el layout a altura completa del viewport.

```diff
  <SidebarInset>
-   <div>
+   <div className="flex flex-col min-h-dvh min-w-0 overflow-hidden">
      <Header />
-     <main className="main-content" data-client={activeOrganization}>
+     <main className="main-content flex-1 overflow-auto" data-client={activeOrganization}>
        {children}
      </main>
```

Esto logra:
- `min-h-dvh`: el layout ocupa al menos la altura completa del viewport.
- `flex flex-col`: el header queda fijo arriba y el main ocupa el espacio restante.
- `min-w-0`: evita que el flex item crezca más allá de su padre.
- `overflow-hidden`: impide cualquier desbordamiento horizontal.
- `flex-1 overflow-auto` en el `<main>`: el contenido scrollea verticalmente dentro de la zona disponible, sin empujar el header fuera del viewport.

### Cambio 6: Páginas — Reemplazar `min-h-screen` por clases adaptadas al layout flex

Las páginas usan `min-h-screen` o no tienen restricción de altura. Dado que el `<main>` ahora usa `flex-1 overflow-auto`, solo necesitan `h-full` para ocupar el espacio disponible.

**`src/app/(main)/fotovoltaica/page.tsx`**
```diff
- <main className="min-h-screen pb-12 px-4">
+ <main className="h-full pb-12 px-4">
```

**`src/app/(main)/comparativas/page.tsx`**
```diff
- <section className="pb-12 px-4 min-h-screen">
+ <section className="pb-12 px-4 h-full">
```

**`src/app/(main)/tramites/page.tsx`**
```diff
- <section className="pb-12 px-4 min-h-screen">
+ <section className="pb-12 px-4 h-full">
```

---

## Resumen visual del flujo de contención

```
html/body
└─ SidebarProvider (flex, w-full)
   ├─ Sidebar (fixed, w-[3rem|18rem])
   └─ SidebarInset (flex-1, w-full)
      └─ div (flex flex-col, min-h-dvh, min-w-0, overflow-hidden)  ← BARRERA
         ├─ Header (sticky, w-full)
         └─ main.main-content (flex-1, overflow-auto)               ← SCROLL VERTICAL
            └─ Page (h-full, px-4)
               └─ *Table wrapper (w-full, min-w-0)
                  └─ card (overflow-hidden)
                     └─ CardContent (w-full, overflow-hidden)
                        └─ div (overflow-x-auto)                    ← SCROLL HORIZONTAL (solo tabla)
                           └─ <Table> (ancho natural)
```

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/core/components/table/TableContent.tsx` | Eliminar `max-w-dvw` |
| `src/tramites/components/table/Table.tsx` | `max-w-dvw` → `min-w-0` |
| `src/fotovoltaica/components/table/FotovoltaicasTable.tsx` | Añadir `min-w-0` |
| `src/comparativas/components/table/ComparativasTable.tsx` | Añadir `min-w-0` |
| `src/app/(main)/layout.tsx` | `overflow-hidden min-w-0 flex flex-col min-h-dvh` en div, `flex-1 overflow-auto` en main |
| `src/app/(main)/fotovoltaica/page.tsx` | `min-h-screen` → `h-full` |
| `src/app/(main)/comparativas/page.tsx` | `min-h-screen` → `h-full` |
| `src/app/(main)/tramites/page.tsx` | `min-h-screen` → `h-full` |

## Por qué `min-w-0` es clave

En CSS flexbox, los flex items tienen `min-width: auto` por defecto, lo que significa que **no pueden ser más pequeños que su contenido**. Si una tabla tiene 2000px de ancho, el flex item se expande a 2000px aunque su padre sea de 800px. `min-w-0` rompe ese comportamiento, permitiendo que `overflow-x-auto` haga su trabajo y active el scroll solo dentro del contenedor de la tabla.
