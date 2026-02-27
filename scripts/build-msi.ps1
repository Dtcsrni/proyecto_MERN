param(
  [string]$Configuration = "Release",
  [string]$Version = "",
  [switch]$SkipStabilityChecks,
  [switch]$IncludeBundle
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$wix = Join-Path $root "packaging\wix"
$out = Join-Path $root "dist\installer"

function Invoke-CheckedStep {
  param(
    [int]$Index,
    [int]$Total,
    [string]$Title,
    [string]$Command
  )

  $pct = [Math]::Floor((($Index - 1) * 100) / [Math]::Max(1, $Total))
  Write-Progress -Activity "EvaluaPro MSI (estable)" -Status $Title -PercentComplete $pct
  Write-Host "[msi][step $Index/$Total] $Title"
  & cmd /c $Command
  if ($LASTEXITCODE -ne 0) {
    throw "Fallo en paso '$Title' (exit=$LASTEXITCODE): $Command"
  }
}

if (-not (Test-Path $wix)) {
  throw "No existe carpeta WiX en $wix"
}

$wixExe = $null
$wixCmd = Get-Command wix -ErrorAction SilentlyContinue
if ($wixCmd) {
  $wixExe = $wixCmd.Source
} else {
  $wixCandidates = @(
    "$env:ProgramFiles\WiX Toolset v6.0\bin\wix.exe",
    "${env:ProgramFiles(x86)}\WiX Toolset v6.0\bin\wix.exe",
    "$env:ProgramFiles\WiX Toolset v6.0\bin\wix.cmd",
    "${env:ProgramFiles(x86)}\WiX Toolset v6.0\bin\wix.cmd"
  ) | Where-Object { $_ -and (Test-Path $_) }

  $wixCandidateList = @($wixCandidates)
  if ($wixCandidateList.Count -gt 0) {
    $wixExe = $wixCandidateList[0]
  }
}

if (-not $wixExe) {
  throw "No se encontró CLI de WiX (wix.exe). Instala WiX Toolset v6+ estable y agrega 'wix' al PATH."
}

$wixVersionRaw = (& $wixExe --version 2>$null | Select-Object -First 1)
if (-not $wixVersionRaw) {
  throw "No se pudo leer la versión de WiX. Verifica instalación de WiX Toolset v6+ estable."
}

$wixVersionText = [string]$wixVersionRaw
$wixVersionMatch = [Regex]::Match($wixVersionText, '\d+(\.\d+){1,3}')
if (-not $wixVersionMatch.Success) {
  throw "No se pudo interpretar la versión de WiX desde: $wixVersionText"
}

$wixVersion = [Version]$wixVersionMatch.Value
if ($wixVersion.Major -lt 6) {
  throw "WiX detectado: $wixVersion. Se requiere WiX Toolset v6+ estable."
}

if (-not (Test-Path $out)) {
  New-Item -ItemType Directory -Path $out | Out-Null
}

$product = Join-Path $wix "Product.wxs"
$bundle = Join-Path $wix "Bundle.wxs"
$fragmentFiles = @(
  (Join-Path $wix "Fragments\AppFiles.wxs"),
  (Join-Path $wix "Fragments\Shortcuts.wxs"),
  (Join-Path $wix "Fragments\Cleanup.wxs")
)

$checks = @()
if (-not $SkipStabilityChecks) {
  $checks = @(
    @{ Title = "Lint"; Cmd = "npm run lint" },
    @{ Title = "Typecheck"; Cmd = "npm run typecheck" },
    @{ Title = "Tests backend CI"; Cmd = "npm run test:backend:ci" },
    @{ Title = "Tests portal CI"; Cmd = "npm run test:portal:ci" },
    @{ Title = "Tests frontend CI"; Cmd = "npm run test:frontend:ci" },
    @{ Title = "Clean architecture check"; Cmd = "npm run qa:clean-architecture:check" },
    @{ Title = "Pipeline contract check"; Cmd = "npm run pipeline:contract:check" }
  )
}

$buildBundle = $IncludeBundle -or ($env:EVALUAPRO_BUILD_BUNDLE -match '^(1|true|yes|si)$')
$buildSteps = 1
if ($buildBundle) { $buildSteps = 2 }
$totalSteps = $checks.Count + $buildSteps
$idx = 1

if ($checks.Count -gt 0) {
  foreach ($check in $checks) {
    Invoke-CheckedStep -Index $idx -Total $totalSteps -Title $check.Title -Command $check.Cmd
    $idx += 1
  }
}

Write-Progress -Activity "EvaluaPro MSI (estable)" -Status "Compilar MSI Product.wxs" -PercentComplete ([Math]::Floor((($idx - 1) * 100) / [Math]::Max(1, $totalSteps)))
Write-Host "[msi][step $idx/$totalSteps] Compilar MSI Product.wxs"
$productArgs = @("build", $product) + $fragmentFiles + @("-arch", "x64", "-d", "SourceRoot=$root", "-o", (Join-Path $out "EvaluaPro.msi"))
if ($Version) { $productArgs += @("-d", "Version=$Version") }
& $wixExe @productArgs
if ($LASTEXITCODE -ne 0) { throw "Falló build de Product.wxs" }
$idx += 1

if ($buildBundle) {
  Write-Progress -Activity "EvaluaPro MSI (estable)" -Status "Compilar EXE Bundle.wxs" -PercentComplete ([Math]::Floor((($idx - 1) * 100) / [Math]::Max(1, $totalSteps)))
  Write-Host "[msi][step $idx/$totalSteps] Compilar EXE Bundle.wxs"
  $bundleArgs = @("build", $bundle, "-arch", "x64", "-ext", "WixToolset.BootstrapperApplications.wixext", "-d", "SourceRoot=$root", "-o", (Join-Path $out "EvaluaPro-Setup.exe"))
  if ($Version) { $bundleArgs += @("-d", "Version=$Version") }
  & $wixExe @bundleArgs
  if ($LASTEXITCODE -ne 0) { throw "Falló build de Bundle.wxs" }
} else {
  Write-Host "[msi] Bundle EXE omitido por defecto (migración Burn WiX v6 en progreso). Usa -IncludeBundle o EVALUAPRO_BUILD_BUNDLE=1 para intentarlo."
}

Write-Progress -Activity "EvaluaPro MSI (estable)" -Status "Completado" -PercentComplete 100
Write-Host "[msi] Artefactos generados en $out"
