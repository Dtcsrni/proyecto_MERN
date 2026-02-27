Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'PrereqDetector.psm1') -DisableNameChecking

function Invoke-PostInstallVerification {
  param(
    [ValidateSet('install', 'repair', 'uninstall')]
    [string]$Mode,
    [string]$InstallDir,
    [scriptblock]$OnLog
  )

  $issues = @()

  if ($Mode -eq 'install' -or $Mode -eq 'repair') {
    $installation = Get-EvaluaProInstallationInfo
    if (-not $installation.Installed) {
      $issues += 'No se detecta EvaluaPro en registro tras instalacion/reparacion.'
    }

    $effectiveDir = $InstallDir
    if (-not $effectiveDir -and $installation.InstallLocation) {
      $effectiveDir = $installation.InstallLocation
    }
    if (-not $effectiveDir) {
      $effectiveDir = Join-Path ${env:ProgramFiles} 'EvaluaPro'
    }

    $requiredFiles = @(
      (Join-Path $effectiveDir 'package.json'),
      (Join-Path $effectiveDir 'scripts\\launcher-tray-hidden.vbs'),
      (Join-Path $effectiveDir 'scripts\\launcher-dashboard-hidden.vbs')
    )

    foreach ($file in $requiredFiles) {
      if (-not (Test-Path $file)) {
        $issues += "No se encontro archivo requerido: $file"
      }
    }

    $envPath = Join-Path $effectiveDir '.env'
    if (-not (Test-Path $envPath)) {
      $issues += "No se encontro archivo de configuracion operativa: $envPath"
    } else {
      $envRaw = Get-Content -Path $envPath -Raw -Encoding utf8
      foreach ($requiredKey in @('MONGODB_URI', 'JWT_SECRETO', 'CORS_ORIGENES', 'PORTAL_ALUMNO_URL', 'PORTAL_ALUMNO_API_KEY', 'PORTAL_API_KEY')) {
        if ($envRaw -notmatch ("(?m)^\s*{0}\s*=" -f [Regex]::Escape($requiredKey))) {
          $issues += "Falta variable operativa en .env: $requiredKey"
        }
      }

      if ($envRaw -match '(?m)^\s*REQUIRE_GOOGLE_OAUTH\s*=\s*1\s*$') {
        foreach ($oauthKey in @('GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_CLASSROOM_CLIENT_ID', 'GOOGLE_CLASSROOM_CLIENT_SECRET', 'GOOGLE_CLASSROOM_REDIRECT_URI')) {
          if ($envRaw -notmatch ("(?m)^\s*{0}\s*=" -f [Regex]::Escape($oauthKey))) {
            $issues += "OAuth requerido y falta variable en .env: $oauthKey"
          }
        }
      }
    }

    $nodeMajor = Get-NodeMajorVersion
    if ($nodeMajor -lt 24) {
      $issues += 'Node.js 24+ no disponible tras instalacion.'
    }

    if (-not (Test-DockerDesktopInstalled)) {
      $issues += 'Docker Desktop no disponible tras instalacion.'
    }
  }

  if ($Mode -eq 'uninstall') {
    $installation = Get-EvaluaProInstallationInfo
    if ($installation.Installed) {
      $issues += 'EvaluaPro sigue detectado tras desinstalacion.'
    }
  }

  if ($issues.Count -eq 0) {
    if ($OnLog) { & $OnLog 'ok' 'Verificacion final completada sin hallazgos.' }
    return [pscustomobject]@{ ok = $true; issues = @() }
  }

  if ($OnLog) {
    foreach ($issue in $issues) {
      & $OnLog 'warn' $issue
    }
  }

  return [pscustomobject]@{ ok = $false; issues = $issues }
}

Export-ModuleMember -Function @(
  'Invoke-PostInstallVerification'
)
