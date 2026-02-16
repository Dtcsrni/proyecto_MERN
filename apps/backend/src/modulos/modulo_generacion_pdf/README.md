# Módulo de Generación de PDF

**Estado actual:** Ola 2B - DDD/Clean Architecture con canary y fallback legacy

## Arquitectura

Este módulo implementa la generación de exámenes en formato PDF con soporte para:
- Plantillas OMR v1 y v2 (burbujas para calificación óptica)
- Códigos QR únicos por página
- Encabezados institucionales
- Formato carta (612x792 puntos)
- Soporte de variantes de examen (A, B, C, D)

### Estructura DDD

```
modulo_generacion_pdf/
├── application/usecases/       # Casos de uso (orquestación)
│   └── generarExamenIndividual.ts
├── domain/                     # Lógica de negocio pura
│   ├── examenPdf.ts           # Entidad ExamenPdf
│   └── layoutExamen.ts        # Value Objects (OMR profiles)
├── infra/                     # Adaptadores externos
│   ├── configuracionLayoutEnv.ts  # Parser de env vars
│   └── pdfKitRenderer.ts      # Renderizado PDFKit
├── shared/                    # Tipos compartidos
│   └── tiposPdf.ts            # DTOs, constantes
├── controladorGeneracionPdf.ts    # Controlador HTTP
├── servicioGeneracionPdf.ts       # Facade con feature flag
└── servicioGeneracionPdfLegacy.ts # Implementación original (fallback)
```

### Feature Flag (Canary Deployment)

El módulo usa una fachada con **feature flag** para migración segura:

```typescript
// Variable de entorno (default: 0)
FEATURE_PDF_BUILDER_V2=0     // 0% tráfico a v2 (todo legacy)
FEATURE_PDF_BUILDER_V2=1     // 100% tráfico a v2
FEATURE_PDF_BUILDER_V2=0.25  // 25% tráfico a v2 (canary)
FEATURE_PDF_BUILDER_V2=25    // Equivalente en porcentaje
```

**Facade:** `servicioGeneracionPdf.ts`
- Resuelve versión con `rolloutCanary.decidirVersionCanary('pdf', semilla)`
- Delega a legacy o v2 según objetivo canary
- Si v2 falla, hace fallback inmediato a legacy

### Componentes Principales

#### Domain Layer

**ExamenPdf** (domain/examenPdf.ts):
- Entidad central con validaciones de negocio
- Valida folio, preguntas, total páginas
- Genera texto QR por página

**LayoutExamen** (domain/layoutExamen.ts):
- Value objects para perfiles OMR (v1/v2)
- Configuración de posiciones de burbujas
- Resolver de perfil según env vars

#### Infrastructure Layer

**ConfiguracionLayoutEnv** (infra/configuracionLayoutEnv.ts):
- Parser de variables de entorno:
  - `EXAMEN_LAYOUT_VERSION` (1|2)
  - `EXAMEN_LAYOUT_CONFIGURACION` (JSON opcional)
- Defaults seguros

**PdfKitRenderer** (infra/pdfKitRenderer.ts):
- Renderizado con PDFKit
- **Estado:** Implementado para flujo modular v2

#### Application Layer

**generarExamenIndividual** (application/usecases/generarExamenIndividual.ts):
- Caso de uso principal
- **Estado:** Implementado en flujo modular DDD
- Fallback a legacy se aplica en la fachada

#### Shared Layer

**tiposPdf** (shared/tiposPdf.ts):
- DTOs: `ParametrosGeneracionPdf`, `ResultadoGeneracionPdf`
- Tipos: `TemplateVersion`, `EncabezadoExamen`, `MapaOmr`
- Constantes: `ANCHO_CARTA`, `ALTO_CARTA`

### Legacy Preservation

**servicioGeneracionPdfLegacy.ts** (1396 líneas):
- Copia completa de la implementación original
- Funcional y validado en producción
- Fallback para rollback instantáneo
- Código estable sin modificaciones

## Variables de Entorno

```bash
# Feature flag para canary deployment
FEATURE_PDF_BUILDER_V2=0  # 0..1 o 0..100 (default: 0)

# Configuración de layout OMR
EXAMEN_LAYOUT_VERSION=2           # Versión plantilla (1|2)
EXAMEN_LAYOUT_CONFIGURACION='{}'  # JSON opcional con overrides
```

## Comandos

```bash
# Validación general
npm run lint                # ESLint
npm run typecheck           # TypeScript
npm run test:backend:ci     # Tests de backend

# Tests de integración PDF
npm -C apps/backend run test -- tests/integracion/pdfImpresionContrato.test.ts

# Gate validation Big-Bang
npm run bigbang:olas:check     # Validación básica
npm run bigbang:olas:strict    # Validación estricta + cobertura
```

## Contratos

### Servicio Principal

```typescript
interface ParametrosGeneracionPdf {
  examenId: string;
  titulo: string;
  encabezado: EncabezadoExamen;
  preguntas: Pregunta[];
  respuestasClave?: RespuestasClave;
  variante?: string; // A, B, C, D
  folio?: string;
  templateVersion?: TemplateVersion; // 'v1' | 'v2'
}

interface ResultadoGeneracionPdf {
  buffer: Buffer;
  totalPaginas: number;
  hash: string; // SHA256 del documento
}

// Función principal
async function generarPdfExamen(
  params: ParametrosGeneracionPdf
): Promise<ResultadoGeneracionPdf>
```

### Controller HTTP

```typescript
POST /api/examenes/:id/pdf
Body: {
  variante?: string,
  folio?: string,
  templateVersion?: 'v1' | 'v2'
}
Response: PDF buffer (Content-Type: application/pdf)
```

## Tests

**Cobertura actual:**
- ✅ `pdfImpresionContrato.test.ts` - Contrato HTTP de generación PDF
- ✅ Validación de headers institucionales
- ✅ Validación de formato carta
- ✅ Generación de códigos QR

**TODO (Ola 2B completa):**
- Tests de paridad v1 vs v2 (comparación de output)
- Tests unitarios de domain entities
- Tests de integración PDFKit renderer
- Performance tests (latency p95 <500ms)

## Observabilidad

**Métricas disponibles:**
- `pdf_generacion_duracion_ms` - Latencia de generación
- `pdf_generacion_errores_total` - Errores por tipo
- `pdf_feature_v2_invocaciones` - Adopción de v2

**Sistema:** Métricas custom en `apps/backend/src/compartido/observabilidad/metrics.ts`

## Estado de Ola 2B

**✅ Completado (Bootstrap):**
- Preservación de legacy (servicioGeneracionPdfLegacy.ts)
- Estructura DDD/Clean Architecture
- Feature flag facade con canary support
- Domain entities (ExamenPdf, LayoutExamen)
- Extracción de configuración (ConfiguracionLayoutEnv)
- Gate validation actualizada (bigbang-olas-check.mjs)
- Todos los tests pasando

**⏳ Pendiente (Implementación completa):**
- Tests de paridad v1/v2
- Métricas de observabilidad v2
- Canary rollout gradual en producción

**Validación:**
```bash
npm run bigbang:olas:strict  # ✅ PASSED
# ola0: OK, ola1: OK, ola2-ready: OK, strict-gates: OK
```

## Decisiones de Diseño

1. **Feature flag en facade (no en use case):**
   - Simplicidad en switching (un solo punto)
   - Rollback instantáneo sin redeploy
   - Métricas centralizadas en facade

2. **Preservación legacy completa:**
   - Cero risk en producción
   - Fallback inmediato
   - Permite comparación v1/v2 en tests

3. **DDD/Clean Architecture:**
   - Separación domain/infra para testability
   - Value objects inmutables (PerfilPlantillaOmr)
   - Use cases orquestan, domain valida

4. **Configuración desde env vars:**
   - Flexibilidad por ambiente (dev/staging/prod)
   - Sin hardcode de perfiles OMR
   - Defaults seguros (v2, PERFIL_OMR_V2)

5. **PDFKit sobre otras librerías:**
   - Ya usado en legacy (cero learning curve)
   - Soporte nativo de paths/burbujas OMR
   - Rendimiento probado en producción

## Referencias

- **Documentación técnica:** [docs/ENGINEERING_BASELINE.md](../../../../../docs/ENGINEERING_BASELINE.md)
- **Arquitectura Big-Bang:** [docs/INVENTARIO_PROYECTO.md](../../../../../docs/INVENTARIO_PROYECTO.md)
- **Gate validation:** [scripts/bigbang-olas-check.mjs](../../../../../scripts/bigbang-olas-check.mjs)
- **Tests de integración:** [tests/integracion/pdfImpresionContrato.test.ts](../../../../../tests/integracion/pdfImpresionContrato.test.ts)

---

**Última actualización:** 2026-02-14 (Ola 2B bootstrap)  
**Versión feature flag:** v0 (legacy por defecto)  
**Estado gates:** ✅ PASSED (lint, typecheck, tests, bigbang:olas:strict)
