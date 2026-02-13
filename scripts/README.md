# scripts/

Herramientas de operación local (principalmente Windows) para **Sistema EvaluaPro (EP)**.

## Dashboard
- UI: `dashboard.html`
- SW: `dashboard-sw.js`
- Launcher: `launcher-dashboard.mjs`

## Accesos directos / bandeja
- Generación de accesos: `create-shortcuts.ps1`
- Launcher oculto: `launcher-dashboard-hidden.vbs`
- Tray (NotifyIcon): `launcher-tray.ps1`

## Ejecutables rápidos
- `launch-dev.cmd`
- `launch-prod.cmd`

## Handoff IA (continuidad de sesiones)
- Script: `ia-handoff.mjs`
- Comandos:
  - `npm run ia:handoff:quick`
  - `npm run ia:handoff:full`
- Salida:
  - `docs/handoff/sesiones/<YYYY-MM-DD>/<sesion>.md`

Notas:
- Varios scripts asumen Docker Desktop iniciado.
- Ver README principal para el flujo completo: `../README.md`.
