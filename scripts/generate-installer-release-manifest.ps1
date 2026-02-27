param(
  [string]$Version = '',
  [string]$Channel = 'stable',
  [string]$MsiUrl = '',
  [string]$MsiSha256Url = '',
  [string]$OutputPath = '',
  [string]$DeploymentTarget = 'local-prod'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not $Version) {
  $pkgPath = Join-Path $root 'package.json'
  $pkg = Get-Content -Path $pkgPath -Raw | ConvertFrom-Json
  $Version = [string]$pkg.version
}

if (-not $OutputPath) {
  $OutputPath = Join-Path $root 'dist\\installer\\EvaluaPro-release-manifest.json'
}

$commit = [string]$env:GITHUB_SHA
if (-not $commit) {
  try {
    $commit = (& git rev-parse HEAD 2>$null | Select-Object -First 1)
  } catch {
    $commit = ''
  }
}
if (-not $commit) {
  $commit = 'local'
}

$installerDir = Split-Path -Parent $OutputPath
$unsignedMarker = Join-Path $installerDir 'SIGNING-NOT-PRODUCTION.txt'
$isSigned = -not (Test-Path $unsignedMarker)

$artifacts = @()
foreach ($name in @('EvaluaPro.msi', 'EvaluaPro-Setup.exe', 'EvaluaPro-InstallerHub.exe')) {
  $artifactPath = Join-Path $installerDir $name
  if (-not (Test-Path $artifactPath)) { continue }
  $sha256 = (Get-FileHash -Path $artifactPath -Algorithm SHA256).Hash.ToLowerInvariant()
  $artifacts += [ordered]@{
    name = $name
    sha256 = $sha256
    signed = $isSigned
  }
}

$payload = [ordered]@{
  version = $Version
  channel = $Channel
  msiUrl = $MsiUrl
  msiSha256Url = $MsiSha256Url
  publishedAt = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ssZ')
  build = [ordered]@{
    version = $Version
    commit = $commit
  }
  artifacts = $artifacts
  deployment = [ordered]@{
    target = $DeploymentTarget
  }
}

$dir = Split-Path -Parent $OutputPath
if (-not (Test-Path $dir)) {
  New-Item -ItemType Directory -Path $dir -Force | Out-Null
}

($payload | ConvertTo-Json -Depth 5) | Set-Content -Path $OutputPath -Encoding utf8
Write-Host "[installer-manifest] Generado en $OutputPath"
