param(
  [string]$Version = '',
  [string]$Channel = 'stable',
  [string]$MsiUrl = '',
  [string]$MsiSha256Url = '',
  [string]$OutputPath = ''
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

$payload = [ordered]@{
  version = $Version
  channel = $Channel
  msiUrl = $MsiUrl
  msiSha256Url = $MsiSha256Url
  publishedAt = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ssZ')
}

$dir = Split-Path -Parent $OutputPath
if (-not (Test-Path $dir)) {
  New-Item -ItemType Directory -Path $dir -Force | Out-Null
}

($payload | ConvertTo-Json -Depth 5) | Set-Content -Path $OutputPath -Encoding utf8
Write-Host "[installer-manifest] Generado en $OutputPath"
