param(
  [string]$Configuration = "Release",
  [string]$Version = "",
  [switch]$SkipStabilityChecks
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

if (-not (Get-Command wix -ErrorAction SilentlyContinue)) {
  throw "No se encontró CLI de WiX (wix.exe). Instala WiX Toolset v4 y agrega 'wix' al PATH."
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

$totalSteps = $checks.Count + 2
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
& wix @productArgs
if ($LASTEXITCODE -ne 0) { throw "Falló build de Product.wxs" }
$idx += 1

Write-Progress -Activity "EvaluaPro MSI (estable)" -Status "Compilar EXE Bundle.wxs" -PercentComplete ([Math]::Floor((($idx - 1) * 100) / [Math]::Max(1, $totalSteps)))
Write-Host "[msi][step $idx/$totalSteps] Compilar EXE Bundle.wxs"
$bundleArgs = @("build", $bundle, "-arch", "x64", "-ext", "WixToolset.BootstrapperApplications.wixext", "-d", "SourceRoot=$root", "-o", (Join-Path $out "EvaluaPro-Setup.exe"))
if ($Version) { $bundleArgs += @("-d", "Version=$Version") }
& wix @bundleArgs
if ($LASTEXITCODE -ne 0) { throw "Falló build de Bundle.wxs" }

Write-Progress -Activity "EvaluaPro MSI (estable)" -Status "Completado" -PercentComplete 100
Write-Host "[msi] Artefactos generados en $out"
