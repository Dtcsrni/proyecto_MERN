# Cumplimiento y Privacidad

## Endpoints
- `GET /api/compliance/status`
- `POST /api/compliance/dsr`
- `POST /api/compliance/purge`
- `GET /api/compliance/audit-log`

## Variables de entorno
- `COMPLIANCE_MODE=private|public-hidalgo`
- `DATA_RETENTION_DEFAULT_DAYS`
- `DATA_PURGE_CRON`
- `AUDIT_LOG_IMMUTABLE`
- `DPO_CONTACT_EMAIL`
- `LEGAL_NOTICE_VERSION`

## Gates de compliance
- `npm run test:compliance:legal-docs`
- `npm run test:compliance:pii`
- `npm run test:compliance:retention`
- `npm run test:compliance:dsr-flow`
- `npm run compliance:evidence:generate`

## Evidencia
- `reports/qa/latest/compliance-manifest.json`
- `reports/qa/latest/data-inventory.json`
- `reports/qa/latest/security-controls-evidence.json`
- `reports/qa/latest/legal-docs-version.json`
