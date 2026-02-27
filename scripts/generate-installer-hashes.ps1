param(
  [string]$InstallerDir = '',
  [string]$Version = '',
  [string]$Channel = 'stable',
  [string]$MsiUrl = '',
  [string]$MsiSha256Url = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not $InstallerDir) {
  $InstallerDir = Join-Path $root 'dist\\installer'
}

$msiPath = Join-Path $InstallerDir 'EvaluaPro.msi'
if (-not (Test-Path $msiPath)) {
  throw "No existe MSI para generar hash: $msiPath"
}

$hash = (Get-FileHash -Path $msiPath -Algorithm SHA256).Hash.ToLowerInvariant()
$hashLine = "$hash  EvaluaPro.msi"
$hashPath = Join-Path $InstallerDir 'EvaluaPro.msi.sha256'
$hashLine | Set-Content -Path $hashPath -Encoding ascii
Write-Host "[installer-hash] Generado: $hashPath"

$hubPath = Join-Path $InstallerDir 'EvaluaPro-InstallerHub.exe'
if (Test-Path $hubPath) {
  $hubHash = (Get-FileHash -Path $hubPath -Algorithm SHA256).Hash.ToLowerInvariant()
  $hubLine = "$hubHash  EvaluaPro-InstallerHub.exe"
  $hubHashPath = Join-Path $InstallerDir 'EvaluaPro-InstallerHub.exe.sha256'
  $hubLine | Set-Content -Path $hubHashPath -Encoding ascii
  Write-Host "[installer-hash] Generado: $hubHashPath"
}

$manifestScript = Join-Path $PSScriptRoot 'generate-installer-release-manifest.ps1'
$manifestPath = Join-Path $InstallerDir 'EvaluaPro-release-manifest.json'

$manifestParams = @{
  Channel = $Channel
  OutputPath = $manifestPath
}
if ($Version) { $manifestParams.Version = $Version }
if ($MsiUrl) { $manifestParams.MsiUrl = $MsiUrl }
if ($MsiSha256Url) { $manifestParams.MsiSha256Url = $MsiSha256Url }

& $manifestScript @manifestParams
