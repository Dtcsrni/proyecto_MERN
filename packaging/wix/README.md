# WiX Packaging (MSI)

Empaquetado Windows para primera version estable distribuible.
Responsable: `I.S.C. Erick Renato Vega Ceron`.

## Estructura
- `Product.wxs`: MSI principal (`EvaluaPro.msi`).
- `Bundle.wxs`: bootstrapper (`EvaluaPro-Setup.exe`) que encadena el MSI.
- `Fragments/AppFiles.wxs`: archivos instalados.
- `Fragments/Shortcuts.wxs`: accesos directos Dev/Prod.
- `Fragments/Cleanup.wxs`: limpieza de logs/menu en uninstall.

## Requisitos
- WiX Toolset v4 (`wix` en PATH).
- Node.js 24+.
- Docker Desktop.

## Build
Desde la raiz:

```powershell
npm run msi:build
```

El build MSI ejecuta checks de estabilidad antes de empaquetar.

Artefactos esperados:
- `dist/installer/EvaluaPro.msi`
- `dist/installer/EvaluaPro-Setup.exe`

## Notas
- El acceso directo **Prod** ejecuta:
  - `launcher-tray-hidden.vbs prod 4519`
- El acceso directo **Dev** ejecuta:
  - `launcher-tray-hidden.vbs dev 4519`
- El instalador aplica upgrade in-place si detecta una version previa.
- El instalador valida prerequisitos no autoconfigurables:
  - Node.js 24+
  - Docker Desktop
