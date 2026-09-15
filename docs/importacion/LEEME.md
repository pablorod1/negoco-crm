# Importación de datos a Negoco CRM — Guía para el cliente

Esta guía explica cómo rellenar los **4 ficheros CSV** que usaremos para importar tus
**clientes, contratos, firmantes y documentos** al CRM.

Tú rellenas las plantillas **solo con datos reales que ya tienes** y nos las devuelves;
**nosotros nos encargamos de la importación**: generar los identificadores internos, relacionar las
tablas entre sí y subir los documentos. Cuanto más se respeten los formatos y valores de esta guía,
menos filas se rechazarán.

---

## 1. Los 4 ficheros

| Fichero | Qué contiene | Una fila = |
|---|---|---|
| `clientes.csv` | Titulares del contrato (personas o empresas) | 1 cliente |
| `firmantes.csv` | Representante que firma (solo Empresas / Comunidades) | 1 firmante |
| `contratos.csv` | Cada suministro de luz o gas (con su expediente) | 1 suministro (1 CUPS) |
| `documentos.csv` | Documentos (facturas, contratos, DNI…) por enlace de Drive | 1 documento |

En la carpeta `plantillas/` están **vacíos** (solo la cabecera) — son los que tienes que rellenar y devolver.
En la carpeta `ejemplos/` están los **mismos ficheros con filas de ejemplo** para que veas cómo se rellenan.
👉 **No rellenes los de `ejemplos/`**; trabaja sobre los de `plantillas/`.

---

## 2. Cómo se enlazan los ficheros (sin códigos raros)

No tienes que inventar ningún código de referencia. Los ficheros se enlazan con **datos reales que ya
conoces**:

- **Un contrato se enlaza a su titular por el NIF/CIF.** En `contratos.csv` pones el
  `numero_documento_titular` (el DNI/NIE/CIF del cliente), que debe coincidir con el `numero_documento`
  de ese cliente en `clientes.csv`.
- **Un firmante se enlaza a su empresa por el CIF.** En `firmantes.csv`, `cif_cliente` es el CIF de la
  Empresa/Comunidad a la que representa.
- **Un documento se enlaza por el NIF/CIF del titular** (`numero_documento_titular`) y, si pertenece a un
  suministro concreto, por su **CUPS**.

> Los identificadores internos del CRM, las relaciones entre tablas y la **agrupación de expedientes**
> (por ejemplo unir luz + gas) los generamos **nosotros** al importar. Tú solo rellenas los datos.
> Por eso es **imprescindible** que el `numero_documento` de cada cliente sea **correcto y único**:
> es la pieza con la que enlazamos todo.

---

## 3. Reglas de formato (léelo antes de empezar)

Vas a trabajar en **Google Sheets**, así que:

1. **Una pestaña/fichero por plantilla.** No mezcles clientes y contratos en la misma hoja.
2. **No cambies, borres ni reordenes la fila de cabecera** (la primera, con los nombres de columna).
   La importación se guía por esos nombres.
3. **Separador de columnas: coma `,`** (es lo que Google Sheets exporta por defecto con *Archivo → Descargar → CSV*).
4. **Decimales con punto:** escribe `4.6`, **no** `4,6` (la coma se usa para separar columnas).
   Los importes/potencias sin decimales pueden ir como número entero (`15`, `3500`).
5. **Fechas en formato `DD/MM/YYYY`** (p. ej. `01/02/2025`). Formatea esas columnas como **texto**
   para que Sheets no las reconvierta.
6. **Deja la celda vacía** si un dato no aplica. **No escribas** `N/A`, `-`, `pendiente`, `0` (salvo que el 0 sea real), etc.
7. Si un texto contiene una coma (p. ej. una dirección `Calle Mayor 12, 3º B`), Google Sheets lo
   entrecomilla solo al exportar — no tienes que hacer nada especial.
8. **No repitas cabeceras ni dejes filas en blanco** en medio de los datos.

> Si lo prefieres, puedes **compartirnos el Google Sheet** (con acceso de lectura) y lo exportamos nosotros.

---

## 4. Orden recomendado para rellenar

1. **`clientes.csv`** primero (define los NIF/CIF de cada cliente).
2. **`firmantes.csv`** (solo para los clientes Empresa / Comunidad).
3. **`contratos.csv`** (cada suministro, con el NIF/CIF del titular).
4. **`documentos.csv`** al final.

---

## 5. Diccionario de datos

Leyenda de la columna **Obligatorio**: ✅ obligatorio · 🟡 recomendado · ⬜ opcional.

### 5.1 `clientes.csv`

| Columna | Obl. | Descripción | Valores / formato |
|---|---|---|---|
| `tipo` | ✅ | Tipo de titular | `Particular`, `Autónomo`, `Empresa`, `Comunidad de Propietarios` |
| `nombre` | ✅ | Nombre de pila (Particular/Autónomo) o **razón social** (Empresa/Comunidad) | Texto |
| `apellidos` | ✅* | Apellidos. *Obligatorio para Particular/Autónomo; **vacío** para Empresa/Comunidad | Texto |
| `tipo_documento` | ✅ | Tipo de documento de identidad | `DNI`, `NIE`, `CIF`, `Otro` (coherente con `tipo`, ver §6) |
| `numero_documento` | ✅ | **Clave que enlaza todo.** Documento con dígito de control válido y **único** por cliente | p. ej. `12345678Z`, `B66758616` |
| `email` | ✅ | Email de contacto | Email válido |
| `telefono` | ✅ | Móvil español | 9 dígitos, empieza por 6 o 7 (p. ej. `612345678`) |
| `iban` | ✅ | IBAN para domiciliación | IBAN válido (España: `ES` + 22 caracteres) |
| `direccion` | ✅ | Dirección fiscal del titular (calle y número) | Texto |
| `codigo_postal` | ✅ | Código postal | 5 dígitos |
| `provincia` | 🟡 | Provincia | Texto |
| `localidad` | 🟡 | Localidad / municipio | Texto |

### 5.2 `firmantes.csv` (solo Empresa / Comunidad)

Una fila por cada **representante que firma** en nombre de una Empresa o Comunidad de Propietarios.
Los clientes Particular/Autónomo **no necesitan** firmante.

| Columna | Obl. | Descripción | Valores / formato |
|---|---|---|---|
| `cif_cliente` | ✅ | CIF de la Empresa/Comunidad a la que representa (debe existir en `clientes.csv`) | p. ej. `B66758616` |
| `nombre` | ✅ | Nombre del firmante | Texto |
| `apellidos` | ✅ | Apellidos del firmante | Texto |
| `numero_documento` | ✅ | DNI/NIE **del firmante** (persona física), con dígito de control válido | p. ej. `11111111H` |
| `email` | ✅ | Email del firmante | Email válido |
| `telefono` | ✅ | Móvil del firmante | 9 dígitos, empieza por 6 o 7 |
| `cargo` | ⬜ | Cargo del firmante | Texto libre. Para comunidades: `Presidente de la Comunidad` o `Administrador de Fincas` |

### 5.3 `contratos.csv`

**Una fila = un suministro (un CUPS).** Cada fila genera un expediente (trámite) + su contrato de suministro.
Nivel de detalle **Completo**: incluye comisiones y liquidez.

**Enlace y datos del expediente:**

| Columna | Obl. | Descripción | Valores / formato |
|---|---|---|---|
| `numero_documento_titular` | ✅ | NIF/CIF del titular del suministro (debe existir en `clientes.csv`) | p. ej. `12345678Z` |
| `comercial` | ✅ | Nombre del comercial responsable | Texto (lo mapeamos a un usuario del CRM, ver §9) |
| `estado` | ✅ | Estado del expediente. Para contratos activos usa `Activo` | Ver §6 (10 estados) |
| `tipo_plan` | 🟡 | Tipo de plan/precio | `fijo` o `indexado` |
| `fecha_creacion` | 🟡 | Fecha de alta del expediente. Si no la conoces, déjala vacía (usaremos la de activación) | `DD/MM/YYYY` |
| `fecha_tramitacion` | 🟡 | Fecha de tramitación. Si no la conoces, déjala vacía | `DD/MM/YYYY` |
| `fecha_activacion` | ✅ | Fecha en que el suministro se activó/empezó | `DD/MM/YYYY` |
| `fecha_renovacion` | ✅ | **Fecha de renovación/vencimiento.** Crítica para los avisos de renovación | `DD/MM/YYYY` |
| `comision_empresa` | ✅ | Comisión de la empresa (importe). Pon `0` si no aplica | Número (punto decimal) |
| `comision_comercial` | ✅ | Comisión del comercial (importe). Pon `0` si no aplica | Número (punto decimal) |
| `estado_liquidez` | 🟡 | Estado de cobro/pago | Ver §6 (estados de liquidez) |
| `fecha_cobro` | ⬜ | Fecha de cobro de la comercializadora | `DD/MM/YYYY` |
| `fecha_pago` | ⬜ | Fecha de pago al comercial | `DD/MM/YYYY` |
| `proveedor` | ⬜ | Proveedor/gestor intermediario, si lo usáis | Texto |

**Datos del suministro:**

| Columna | Obl. | Descripción | Valores / formato |
|---|---|---|---|
| `tipo_contrato` | ✅ | Tipo de operación | Ver §6 (tipos de contrato) |
| `servicio` | 🟡 | Tipo de suministro (ayuda a validar la tarifa) | `Luz` o `Gas` |
| `cups` | ✅ | Código CUPS del punto de suministro (único) | 20 caracteres, empieza por `ES` (ver §7) |
| `comercializadora` | ✅ | Comercializadora **actual** del suministro (con la que está contratado) | Ver §6 (comercializadoras) |
| `comercializadora_anterior` | ⬜ | Comercializadora anterior, si hubo cambio | Ver §6 |
| `tarifa` | ✅ | Tarifa de acceso | Luz: `2.0TD`,`3.0TD`,`6.1TD`,`1TD` · Gas: `RL-1`…`RL-7` |
| `consumo_anual` | 🟡 | Consumo anual en kWh | Número entero |
| `potencia_p1`…`potencia_p6` | 🟡 | Potencia contratada por periodo (kW) | Número (punto decimal). Solo los periodos que apliquen (ver §8) |
| `direccion_suministro` | ✅ | Dirección del punto de suministro (puede diferir de la del titular) | Texto |
| `codigo_postal_suministro` | ✅ | Código postal del suministro | 5 dígitos |
| `provincia_suministro` | ✅ | Provincia del suministro | Texto |
| `localidad_suministro` | ✅ | Localidad del suministro | Texto |
| `observaciones` | ⬜ | Notas libres sobre el suministro | Texto |

### 5.4 `documentos.csv`

Un CSV no puede contener los ficheros, así que los enlazas por **URL de Google Drive**. En la importación,
**nosotros descargamos cada fichero de tu Drive y lo subimos a vuestro almacenamiento (Firebase)**, de modo
que dentro del CRM se comporta como un documento nativo (vista previa y descarga). Esto se hace **una sola vez**.

| Columna | Obl. | Descripción | Valores / formato |
|---|---|---|---|
| `numero_documento_titular` | ✅ | NIF/CIF del cliente al que pertenece el documento | p. ej. `12345678Z` |
| `cups` | ⬜ | CUPS del suministro al que pertenece. Si lo dejas vacío, se asocia al expediente principal del cliente | p. ej. `ES0031405935606823DF` |
| `tipo_documento` | 🟡 | Tipo de documento | `Factura`, `Contrato firmado`, `Documento identidad (DNI/CIF)`, `Certificado`, `Otro` |
| `nombre_archivo` | ✅ | Nombre del fichero con extensión | p. ej. `factura_enero2025.pdf` |
| `url` | ✅ | Enlace **con acceso de lectura** al fichero en Drive | p. ej. `https://drive.google.com/file/d/.../view` |

> ⚠️ **Permisos de los enlaces:** cada URL debe ser accesible (Drive: "Cualquiera con el enlace → Lector"),
> o bien compártenos la carpeta de Drive completa. Si el enlace pide permiso, no podremos descargar el fichero.

---

## 6. Valores permitidos (listas cerradas)

Copia estos valores **exactamente** (respetando tildes y mayúsculas).

- **`tipo` de cliente:** `Particular` · `Autónomo` · `Empresa` · `Comunidad de Propietarios`
- **`tipo_documento` según el tipo de cliente:**
  - Particular → `DNI`, `NIE`, `Otro`
  - Autónomo → `DNI`, `CIF`, `NIE`
  - Empresa → `CIF`
  - Comunidad de Propietarios → `CIF`
- **`estado` del expediente:** `Borrador` · `Tramitable` · `Verificado` · `Pendiente de Firma` ·
  `Procesando` · `Activo` · `Baja` · `Scoring` · `Incidencia` · `KO`
  *(para tu cartera actual de contratos vivos, usa normalmente `Activo`)*
- **`estado_liquidez`:** `Pendiente de Cobro` · `Cobrado por Comercializadora` · `Pagado al Comercial` ·
  `Adelantado` · `Pendiente de Descontar` · `Descontado`
- **`tipo_contrato`:** `Cambio Compañía` · `Cambio Compañía + Cambio Técnico` ·
  `Cambio Compañía + Cambio Titular` · `Renovación` · `Alta Nueva`
- **`tipo_plan`:** `fijo` · `indexado`
- **`servicio`:** `Luz` · `Gas`
- **`tarifa`:** Luz → `2.0TD`, `3.0TD`, `6.1TD`, `1TD` · Gas → `RL-1`, `RL-2`, `RL-3`, `RL-4`, `RL-5`, `RL-6`, `RL-7`
- **`comercializadora` / `comercializadora_anterior`:** `Acciona`, `Aletteo`, `APOLO`, `Audax`, `Chc`,
  `Eleia`, `Endesa`, `Gana Energía`, `Iberdrola`, `Ignis`, `Logos`, `Naturgy`, `Octopus`, `Repsol`,
  `Totalenergies`, `UniElectrica`, `VM`, `YaLuz`, `Zima Energia`.
  *Si tu comercializadora no está en la lista, escribe su nombre real igualmente y nosotros la daremos de alta.*

---

## 7. Validaciones que aplicaremos al importar

Estas comprobaciones son las mismas que el CRM hace en sus formularios. Las filas que no las pasen se
te devolverán para corregir:

| Dato | Regla |
|---|---|
| `email` | Formato de email válido |
| `telefono` | Móvil español (9 dígitos, empieza por 6 o 7) |
| `iban` | IBAN válido (con dígito de control) |
| `numero_documento` (DNI) | 8 dígitos + letra correcta |
| `numero_documento` (NIE) | `X/Y/Z` + 7 dígitos + letra correcta |
| `numero_documento` (CIF) | Letra + 7 dígitos + dígito/letra de control correcto |
| `codigo_postal` | 5 dígitos (código postal español) |
| `cups` | 20 caracteres alfanuméricos, formato `ES` + 16 dígitos + 2 letras |

> Si una parte de tus datos no cumple (p. ej. un teléfono fijo en vez de móvil, o un IBAN incompleto),
> avísanos: decidimos juntos si se corrige, se deja vacío o se importa igualmente como excepción.

---

## 8. Casos especiales

**Cliente con varios suministros (p. ej. luz + gas, o varias direcciones):**
Crea **una fila por cada CUPS** en `contratos.csv`, todas con el mismo `numero_documento_titular`.
- Por defecto, cada fila (cada CUPS) será **su propio expediente**.
- Si varios suministros deben ir como **un único expediente** (típico dual luz+gas), basta con que esas
  filas tengan el **mismo titular, la misma `fecha_activacion` y el mismo `comercial`**: las agrupamos
  nosotros al importar. (Si hay alguna excepción, indícalo en `observaciones`.)

**Potencias por tarifa:**
- Luz `2.0TD` → normalmente solo `potencia_p1` y `potencia_p2`.
- Luz `3.0TD` / `6.1TD` → los 6 periodos (`potencia_p1`…`potencia_p6`).
- Gas (`RL-x`) → sin potencias (déjalas vacías).

**Documento a nivel de cliente (no de un suministro concreto)** — p. ej. el DNI/CIF del titular:
rellena `numero_documento_titular` y deja `cups` **vacío**; lo asociaremos al expediente principal del cliente.

**Dirección de suministro = dirección del titular:** si coinciden, copia los mismos valores en las
columnas `*_suministro`.

---

## 9. Lo que necesitamos que nos envíes aparte

1. **Mapa de comerciales `nombre → email`.** En `contratos.csv` pones el **nombre** del comercial; para
   enlazarlo con su usuario del CRM necesitamos una lista que relacione cada nombre exacto que uses con el
   **email del usuario ya creado en el CRM**. Ejemplo:

   | comercial (como aparece en el CSV) | email del usuario en el CRM |
   |---|---|
   | Laura Fernández | laura.fernandez@tuempresa.com |
   | … | … |

   > Importante: esos usuarios (comerciales) deben **existir ya en el CRM** antes de importar. El comercial
   > que no tenga match se asignará a un usuario **admin**.

2. **Acceso a los documentos.** Que las URLs de `documentos.csv` tengan permiso de lectura, o bien
   compártenos la carpeta de Drive completa.

---

## 10. Checklist antes de enviárnoslo

- [ ] Trabajado sobre `plantillas/` (no sobre `ejemplos/`).
- [ ] Cabeceras intactas (sin renombrar ni reordenar columnas).
- [ ] `numero_documento` único y correcto en `clientes.csv` (es la clave de enlace).
- [ ] Cada `numero_documento_titular` de `contratos.csv` y `documentos.csv` existe en `clientes.csv`.
- [ ] Cada `cif_cliente` de `firmantes.csv` existe en `clientes.csv` (y es Empresa/Comunidad).
- [ ] Cada `cups` es único.
- [ ] Fechas en `DD/MM/YYYY`; decimales con punto.
- [ ] Valores de las listas cerradas escritos tal cual (§6).
- [ ] Empresas/Comunidades tienen su fila en `firmantes.csv`.
- [ ] URLs de documentos accesibles.
- [ ] Adjuntado el mapa de comerciales `nombre → email`.

¿Dudas al rellenar? Escríbenos y te ayudamos con tu caso concreto.


