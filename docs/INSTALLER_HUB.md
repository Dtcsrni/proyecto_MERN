# Installer Hub (Windows)

Bootstrapper online para instalacion desde cero de EvaluaPro en Windows.

## Objetivo
- Ejecutar instalacion/reparacion/desinstalacion con UI guiada.
- Verificar y autoinstalar prerequisitos (Node.js 24+ y Docker Desktop).
- Descargar siempre la release estable mas reciente (`EvaluaPro.msi`) y validar SHA256.
- Ejecutar MSI en modo silencioso y verificar estado final.

## Componentes
- Entry UI: `scripts/installer-hub/InstallerHub.ps1`
- Modulos:
  - `scripts/installer-hub/modules/ReleaseResolver.psm1`
  - `scripts/installer-hub/modules/PrereqDetector.psm1`
  - `scripts/installer-hub/modules/PrereqInstaller.psm1`
  - `scripts/installer-hub/modules/ProductInstaller.psm1`
  - `scripts/installer-hub/modules/PostInstallVerifier.psm1`

## Manifiestos
- Prerequisitos: `config/installer-prereqs.manifest.json`
- Release manifest generado: `dist/installer/EvaluaPro-release-manifest.json`

## Build
```powershell
npm run installer:hub:build
npm run installer:hashes
npm run installer:sign
```

## Artefactos release
- `EvaluaPro.msi`
- `EvaluaPro.msi.sha256`
- `EvaluaPro-InstallerHub.exe`
- `EvaluaPro-InstallerHub.exe.sha256`
- `EvaluaPro-release-manifest.json`

## Exit codes Installer Hub
- `0`: Exito.
- `10`: Falla en requisitos o prerequisitos.
- `20`: Falla en descarga/verificacion de release.
- `30`: Falla en ejecucion MSI.
- `40`: Falla en verificacion final post-instalacion.
