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
- WiX Toolset v6+ estable (`wix` en PATH).
- Node.js 24+.
- Docker Desktop.
- Para compilar bundle, el script resuelve automaticamente la extension BA de WiX 6 (`WixToolset.Bal.wixext` / `WixToolset.BootstrapperApplications.wixext.dll`).

## Build
Desde la raiz:

```powershell
npm run msi:build
```

El build MSI ejecuta checks de estabilidad antes de empaquetar.

`npm run msi:build`:
- siempre compila `EvaluaPro.msi`.
- compila `EvaluaPro-Setup.exe` solo si se habilita bundle:
  - `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-msi.ps1 -IncludeBundle`
  - o `EVALUAPRO_BUILD_BUNDLE=1`.

Artefactos esperados:
- `dist/installer/EvaluaPro.msi`
- `dist/installer/EvaluaPro-Setup.exe` (solo con bundle habilitado)

## CI Windows
- Workflow: `.github/workflows/ci-installer-windows.yml`.
- Se ejecuta en `main`, `tags v*` y manual.
- Compila MSI + bundle (`-SkipStabilityChecks -IncludeBundle`) y publica artefactos.

## Notas
- El acceso directo **Prod** ejecuta:
  - `launcher-tray-hidden.vbs prod 4519`
- El acceso directo **Dev** ejecuta:
  - `launcher-tray-hidden.vbs dev 4519`
- Instalacion/actualizacion:
  - genera automaticamente accesos directos de menu inicio.
  - por defecto tambien genera accesos directos en escritorio (`InstallDesktopShortcuts=1`).
  - por defecto tambien mantiene accesos en menu inicio (`InstallStartMenuShortcuts=1`).
  - se puede desactivar por linea de comandos:
    - `EvaluaPro-Setup.exe InstallDesktopShortcuts=0`
    - `EvaluaPro-Setup.exe InstallStartMenuShortcuts=0`
- El instalador aplica upgrade in-place si detecta una version previa.
- La instalacion es per-machine y solicita elevacion (UAC) al inicio.
- El instalador valida prerequisitos no autoconfigurables:
  - Node.js 24+
  - Docker Desktop
