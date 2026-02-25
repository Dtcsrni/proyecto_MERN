# Sistema EvaluaPro (EP)

Plataforma MERN para evaluacion universitaria: generacion de examenes PDF, vinculacion por QR, analisis OMR, calificacion asistida y sincronizacion local/cloud.

Estado del repositorio: 2026-02-19
Version operativa: `1.0.0-beta.0`

## Estado actual
- Monorepo con 3 apps: `backend`, `frontend`, `portal_alumno_cloud`.
- API canonica: solo `/api/*` (sin rutas versionadas en path).
- OMR con motor CV unico y contrato TV3.
- PDF en contrato TV3 sin compatibilidades antiguas.
- Sincronizacion con `schemaVersion: 3` (compatible transitorio con `schemaVersion: 2`).
- Gate de arquitectura limpia: `qa:clean-architecture:strict`.

## Apps
- `apps/backend`: API docente (Express + TypeScript + MongoDB/Mongoose).
- `apps/frontend`: web docente/alumno (React + Vite + TypeScript).
- `apps/portal_alumno_cloud`: API y portal alumno.

## Requisitos
- Node.js >= 24
- npm
- Docker Desktop (recomendado para stack local)
- Dependencias nativas de build para modulos Node (python3, make, g++, cmake)

## OMR CV obligatorio (TV3)
- El backend OMR TV3 requiere backend CV obligatorio en runtime.
- Si el backend CV no está disponible, la API docente falla en arranque por diseño.
- Verificación rápida:
```bash
npm -C apps/backend run omr:cv:smoke
```
- Gate sintético TV3 (usa umbrales del dataset en `omr_samples_tv3/manifest.json`):
```bash
npm -C apps/backend run omr:tv3:eval:synthetic
```
- Gate real TV3 (usa dataset golden y umbral de autocalificación):
```bash
npm -C apps/backend run omr:tv3:validate:real -- --dataset ../../omr_samples_tv3_real
```
- Gate real manual mínimo TV3 (captura tipo móvil, bloqueante en PR):
```bash
npm -C apps/backend run omr:tv3:generate:real:manual-min
npm -C apps/backend run omr:tv3:validate:real:manual-min
```
Nota: `omr_samples_tv3_real_manual_min` se genera como base móvil simulada reproducible; puede sustituirse `images/*` por fotos reales manteniendo `maps/*` y `ground_truth.jsonl`.
- Baseline/calibración/evidencia:
```bash
npm -C apps/backend run omr:tv3:generate:real
npm -C apps/backend run omr:tv3:baseline:snapshot
npm -C apps/backend run omr:tv3:calibrate:real
```
## Flujo E2E OMR TV3 (automatización docente)
1. `npm -C apps/backend run omr:cv:smoke`
2. `npm -C apps/backend run omr:tv3:generate:real`
3. `npm -C apps/backend run omr:tv3:eval:synthetic`
4. `npm -C apps/backend run omr:tv3:validate:real`
5. `npm -C apps/backend run omr:tv3:generate:real:manual-min`
6. `npm -C apps/backend run omr:tv3:validate:real:manual-min`
7. `npm -C apps/backend run omr:tv3:baseline:snapshot -- --dataset-real-manual ../../omr_samples_tv3_real_manual_min`

Criterios bloqueantes:
- `autoCoverageRate == 1.0` en dataset real simulado y manual mínimo.
- `precision`, `falsePositiveRate`, `invalidDetectionRate`, `pagePassRate`, `autoGradeTrustRate` dentro de `manifest.json`.

### Instalación local mínima (Linux)
- Windows:
  - Instalar toolchain nativo (Visual Studio Build Tools, CMake, Python 3) para compilación de módulos nativos de Node.
- Linux (Debian/Ubuntu):
```bash
sudo apt-get update
sudo apt-get install -y --no-install-recommends python3 make g++ cmake pkg-config
```

## Arranque rapido
1. Instalar dependencias:
```bash
npm install
```
2. Levantar backend local:
```bash
npm run dev:backend
```
3. Levantar frontend:
```bash
npm run dev:frontend
```
4. Levantar portal (opcional):
```bash
npm run dev:portal
```

## Scripts clave
- Desarrollo:
  - `npm run dev`
  - `npm run dev:backend`
  - `npm run dev:frontend`
  - `npm run dev:frontend:alumno`
  - `npm run dev:frontend:docente`
  - `npm run dev:portal`
  - `npm run build:frontend:alumno`
  - `npm run build:frontend:docente`
- Calidad:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test:frontend:ci`
  - `npm run test:coverage:ci`
  - `npm run perf:check`
  - `npm run pipeline:contract:check`
  - `npm run qa:clean-architecture:strict`
- Empaquetado:
  - `npm run msi:build`

## Documentacion principal
- `docs/README.md`
- `docs/INVENTARIO_PROYECTO.md`
- `docs/ENGINEERING_BASELINE.md`
- `docs/IA_TRAZABILIDAD_AGENTES.md`
- `docs/SINCRONIZACION_ENTRE_COMPUTADORAS.md`
- `docs/RELEASE_GATE_STABLE.md`

