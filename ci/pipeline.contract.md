# Pipeline Contract (Platform Agnostic)

## Purpose
Define a CI/CD contract that any runner can implement 1:1 (GitHub Actions, GitLab CI, Jenkins, Azure, local orchestrator).

## Required stages
1. `setup`
2. `lint`
3. `typecheck`
4. `test`
5. `flujo-docente-check`
6. `coverage-check`
7. `build`
8. `docs-check`
9. `security-scan`
10. `package`

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

### flujo-docente-check
- Command: `npm run test:flujo-docente:ci`
- Policy: blocking gate
- Scope: end-to-end critical flow (`parcial` + `global`) including export of signed outputs

### coverage-check
- Command: `npm run test:coverage:ci`
- Policy: blocking gate with progressive thresholds per app:
  - Week 1: backend 55, frontend 45, portal 50
  - Week 2: backend 62, frontend 52, portal 58
  - Week 3: backend 70, frontend 60, portal 65
- Output: coverage report per workspace (`coverage/**`)

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

## Quality gates policy (strict progressive)
- Week 1: setup + lint + typecheck + test + build
- Week 2: add docs-check + coverage-check
- Week 3: add security-scan + raise coverage thresholds to target

## Exit criteria
- Pipeline marked green only when all mandatory stages pass
- Release candidates require 10 consecutive green runs without flaky infra failures >10%
