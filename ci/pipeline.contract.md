# Pipeline Contract (Platform Agnostic)

## Purpose
Define a CI/CD contract that any runner can implement 1:1 (GitHub Actions, GitLab CI, Jenkins, Azure, local orchestrator).

## Execution profiles (recommended)
The pipeline is intentionally split into two mandatory profiles to optimize feedback speed without lowering release quality.

### Profile `core` (blocking for every PR/push)
1. `setup`
2. `lint`
3. `typecheck`
4. `test`
5. `ux-quality-check`
6. `coverage-check`
7. `build`
8. `docs-check`
9. `security-scan`

### Profile `extended` (blocking for `main`, `release/*`, `schedule`, or manual dispatch)
1. `setup`
2. `flujo-docente-check`
3. `dataset-prodlike-check`
4. `docente-alumno-e2e-check`
5. `global-grade-check`
6. `pdf-print-check`
7. `ux-visual-check`
8. `perf-check`
9. `bigbang-olas-strict-check`
10. `qa-manifest`

### Profile `package`
1. `package`

## Stage contract
### setup
- Input: repository source
- Actions:
  - install Node (>=24)
  - install dependencies (`npm ci`)
- Output: dependency cache + lockfile validation

### lint
- Command: `npm run lint`
- Fail if any warning/error (`--max-warnings=0` already enforced)

### typecheck
- Command: `npm run typecheck`
- Fail on any TS diagnostic

### test
- Commands:
  - `npm run test:backend:ci`
  - `npm run test:portal:ci`
  - `npm run test:frontend:ci`
- Flaky policy: retries only for explicitly retriable jobs/scripts

### ux-quality-check
- Command: `npm run test:ux-quality:ci`
- Policy: blocking gate
- Scope: baseline UX contract (ayudas contextuales, iconografia minima, labels/landmarks y navegacion clara en pantallas criticas)
- Output: frontend test report (runner-native)

### flujo-docente-check
- Command: `npm run test:flujo-docente:ci`
- Policy: blocking gate
- Scope: end-to-end critical flow (`parcial` + `global`) including export of signed outputs

### dataset-prodlike-check
- Command: `npm run test:dataset-prodlike:ci`
- Policy: blocking gate
- Output: `reports/qa/latest/dataset-prodlike.json`
- Failure criteria:
  - PII detected in anonymized fixture
  - token/secret-like strings found

### docente-alumno-e2e-check
- Command: `npm run test:e2e:docente-alumno:ci`
- Policy: blocking gate
- Scope: chained flow backend docente -> publish -> portal alumno
- Output: `reports/qa/latest/e2e-docente-alumno.json`

### global-grade-check
- Command: `npm run test:global-grade:ci`
- Policy: blocking gate
- Scope: business rules + integration contract for `global`
- Output: `reports/qa/latest/global-grade.json`

### pdf-print-check
- Commands:
  - `npm run test:pdf-print:ci`
  - `npm run test:pdf-visual:ci`
- Policy: blocking gate
- Scope: printable PDF contract (Carta, naming traceability, byte budgets)
- Output: `reports/qa/latest/pdf-print.json`

### ux-visual-check
- Commands:
  - `npm run test:ux-quality:ci`
  - `npm run test:ux-visual:ci`
  - `npm run test:e2e:journeys:ci`
- Policy: blocking gate
- Scope: visual regression on critical docente/alumno screens
- Output: `reports/qa/latest/ux-visual.json`

### coverage-check
- Command: `npm run test:coverage:ci`
- Policy: blocking gate with progressive thresholds per app:
  - Week 1 (recalibrado 2026-02-13 para baseline real):
    - backend: 55 (lines/functions/branches/statements)
    - frontend: lines 39, functions 40, branches 31, statements 37
    - portal: 50 (lines/functions/branches/statements)
  - Week 2: backend 62, frontend 52, portal 58
  - Week 3: backend 70, frontend 60, portal 65
- Output: coverage report per workspace (`coverage/**`)

### perf-check
- Command: `npm run perf:check`
- Policy: blocking gate
- Inputs:
  - `docs/perf/baseline.json`
- Outputs:
  - `reports/perf/latest.json`
- Failure criteria:
  - any route with `p95` over budget
  - any measured route with failures above budget

### bigbang-olas-strict-check
- Command: `npm run bigbang:olas:strict`
- Policy: blocking gate
- Scope:
  - verifies completion invariants for implemented Big-Bang waves
  - executes strict local quality gates used as release precondition
- Output:
  - `reports/qa/latest/olas-bigbang.json`

### build
- Command: `npm run build`
- Output: compiled artifacts per workspace

### docs-check
- Commands:
  - `npm run docs:check`
  - `npm run diagramas:check`
  - `npm run diagramas:render:check`
  - `npm run diagramas:consistencia:check`
  - `npm run routes:check`

### security-scan
- Commands:
  - `NODE_ENV=production STRICT_ENV_CHECK=1 npm run security:env:check`
  - `npm audit --audit-level=high --json > npm-audit-report.json`
  - `npm run security:audit`
- Output: vulnerability report artifact (`npm-audit-report.json`) + env policy validation

### qa-manifest
- Command: `npm run test:qa:manifest`
- Policy: non-optional evidence aggregation stage
- Output: `reports/qa/latest/manifest.json`

### package
- Build container images or archive artifacts for:
  - `apps/backend`
  - `apps/frontend`
  - `apps/portal_alumno_cloud`

## Caches
- `~/.npm`
- optional build caches (`*.tsbuildinfo`, test cache) without mutating source

## Artifacts
- backend build output
- frontend static build
- portal build output
- test reports (if runner supports)
- docs/diagram checks report (text)
- performance report (`reports/perf/latest.json`)
- QA evidence report (`reports/qa/latest/**`)

## Quality gates policy (strict progressive)
- Every PR must pass full `core`.
- `main`/`release/*` must pass `core` + `extended`.
- `package` stays isolated in its own workflow for artifact/image generation.

## Exit criteria
- PR pipeline is green only when all `core` stages pass.
- Mainline/release pipeline is green only when all `core` + `extended` stages pass.
- Release candidates require 10 consecutive green runs without flaky infra failures >10%.

## Stable release gate (post-CI, manual + automated evidence)
This gate is outside CI stages and applies only when promoting `beta` to `stable`.

Required:
1. 10 consecutive green CI runs.
2. Human production teacher flow completed (full docente flow).
3. Automated evidence package generated with:
   - `npm run release:gate:prod-flow -- --version=<version> --periodo-id=<periodoId> --manual=docs/release/manual/prod-flow.json`
4. Evidence committed under:
   - `docs/release/evidencias/<version>/`
