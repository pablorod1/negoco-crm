# Refactorización de Arquitectura Screaming - Redistribución de Core

## ✅ Cambios Realizados

### 1. **Redistribución de Tipos por Dominio**

#### **Trámites** (`/src/tramites/`)

- `types/tramite.types.ts`: Tipos relacionados con trámites
  - `TramiteDB`, `TramiteVM`, `TramiteWithUser`, `TramiteRow`, `TramiteFile`
  - `ClientDB`, `SignerDB`, `ContractDB`, `EditTramiteFormData`
  - `Status`, `LiquidezStatus`, `Cargo`, `DocumentType`
- `constants/tramite.constants.ts`: Constantes de trámites
  - `CLIENT_TYPES`, `DOCUMENT_TYPES`, `CONTRACT_TYPES`, `CARGOS`
  - `STATUS_TYPES`, `LIQUIDEZ_STATUS`, `COMPANIES`, `PLANS`, `POTS`
- `utils/tramite.factories.ts`: Funciones factory para crear tipos vacíos

#### **Comparativas** (`/src/comparativas/`)

- `types/comparativa.types.ts`: Tipos de comparativas
  - `ComparativaDB`, `ComparativaVM`, `ComparativaRow`, `ComparativaFile`
  - `ComparativaStatus`, `ComparativaPlan`
- `constants/comparativa.constants.ts`: Constantes de comparativas
  - `COMPARATIVA_STATUS_TYPES`, `PLAIN_COMPARATIVA_STATUS_TYPES`

#### **Fotovoltaica** (`/src/fotovoltaica/`)

- `types/fotovoltaica.types.ts`: Tipos de fotovoltaica
  - `FotovoltaicaDB`, `FotovoltaicaVM`, `FotovoltaicaFile`
  - `FotovoltaicaType`, `FotovoltaicaClientType`, `FotovoltaicaStatus`
- `constants/fotovoltaica.constants.ts`: Constantes de fotovoltaica
  - `FOTOVOLTAICA_STATUS_TYPES`, `FOTOVOLTAICA_TYPES`, `FOTOVOLTAICA_CLIENT_TYPES`

#### **Dashboard** (`/src/dashboard/`)

- `types/dashboard.types.ts`: Tipos de dashboard
  - `Objective`, `ObjectiveType`, `TimeRange`
- `constants/dashboard.constants.ts`: Constantes de dashboard
  - `NOW_DATE`, `RENOVATION_DATE`

#### **Comercializadoras** (`/src/comercializadoras/`)

- `types/comercializadora.types.ts`: Tipos de comercializadoras
  - `ComercializadoraVM`, `ComercializadoraDetails`, `Rate`

#### **Colaboradores** (`/src/colaboradores/`)

- `constants/colaborador.constants.ts`: Constantes de colaboradores
  - `ROLES`, `SELECT_ROLES`

### 2. **Core Actualizado** (`/src/core/`)

Solo mantiene tipos transversales:

- `User`, `Organization`, `Notification`, `DocumentacionFile`

### 3. **Imports Actualizados**

Se actualizaron las importaciones en:

- Componentes de trámites
- Componentes de comparativas
- Componentes de fotovoltaica
- APIs y utilities
- Hooks y servicios

## 🎯 Beneficios Logrados

### **Cohesión Mejorada**

- Cada dominio funcional tiene sus propios tipos y constantes
- Eliminación de dependencias innecesarias del core
- Arquitectura que "grita" el dominio de cada elemento

### **Mantenibilidad**

- Cambios en un dominio no afectan otros
- Archivos más pequeños y enfocados
- Nomenclatura clara y específica por contexto

### **Escalabilidad**

- Fácil agregar nuevos dominios funcionales
- Estructura modular y extensible
- Separación clara de responsabilidades

## 🔧 Estructura Final

```
src/
├── core/                          # Solo elementos transversales
│   ├── types.ts                   # User, Organization, Notification, DocumentacionFile
│   └── constants/
│       └── const.ts              # Deprecado - referencias a nuevas ubicaciones
├── tramites/
│   ├── types/
│   │   ├── index.ts
│   │   └── tramite.types.ts
│   ├── constants/
│   │   ├── index.ts
│   │   └── tramite.constants.ts
│   └── utils/
│       └── tramite.factories.ts
├── comparativas/
│   ├── types/
│   │   ├── index.ts
│   │   └── comparativa.types.ts
│   ├── constants/
│   │   ├── index.ts
│   │   └── comparativa.constants.ts
│   └── utils/
│       └── comparativa.factories.ts
├── fotovoltaica/
│   ├── types/
│   │   ├── index.ts
│   │   └── fotovoltaica.types.ts
│   ├── constants/
│   │   ├── index.ts
│   │   └── fotovoltaica.constants.ts
│   └── utils/
│       └── fotovoltaica.factories.ts
├── dashboard/
│   ├── types/
│   │   ├── index.ts
│   │   └── dashboard.types.ts
│   ├── constants/
│   │   ├── index.ts
│   │   └── dashboard.constants.ts
│   └── utils/
│       └── dashboard.factories.ts
├── comercializadoras/
│   └── types/
│       ├── index.ts
│       └── comercializadora.types.ts
└── colaboradores/
    └── constants/
        ├── index.ts
        └── colaborador.constants.ts
```

## 📝 Notas Técnicas

### **Dependencias Circulares**

- Se eliminó la dependencia circular entre tramites y comparativas
- Las funciones factory fueron simplificadas para evitar referencias cruzadas

### **TypeScript**

- Se removieron las declaraciones `as const` para evitar problemas de readonly
- Los tipos mantienen la misma funcionalidad pero con mejor organización

### **Compatibilidad**

- El archivo `core/constants/const.ts` se mantiene como deprecado con referencias
- Migración gradual para evitar breaking changes

## 🚀 Próximos Pasos

1. **Validar funcionamiento**: Probar todas las funcionalidades después de la refactorización
2. **Limpiar referencias**: Remover el archivo deprecado `core/constants/const.ts`
3. **Documentar APIs**: Actualizar documentación con las nuevas rutas de importación
4. **Testing**: Actualizar tests para usar las nuevas importaciones

Esta refactorización mejora significativamente la arquitectura del proyecto, haciéndola más modular, mantenible y escalable, siguiendo los principios de Screaming Architecture donde la estructura del código refleja claramente el dominio del negocio.
