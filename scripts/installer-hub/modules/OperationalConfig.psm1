Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function ConvertTo-InstallerHubBool {
  param([string]$Value)
  $raw = [string]$Value
  if ([string]::IsNullOrWhiteSpace($raw)) { return $false }
  return @('1', 'true', 'yes', 'on') -contains $raw.Trim().ToLowerInvariant()
}

function New-GeneratedSecret {
  param([int]$Length = 48)
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $bytes = New-Object byte[] $Length
    $rng.GetBytes($bytes)
    return [Convert]::ToBase64String($bytes).TrimEnd('=')
  } finally {
    $rng.Dispose()
  }
}

function Normalize-OperationalConfig {
  param(
    [hashtable]$InputConfig
  )
  $cfg = [ordered]@{
    mongoUri = [string]($InputConfig.mongoUri ?? '')
    jwtSecreto = [string]($InputConfig.jwtSecreto ?? '')
    corsOrigenes = [string]($InputConfig.corsOrigenes ?? '')
    portalAlumnoUrl = [string]($InputConfig.portalAlumnoUrl ?? '')
    portalAlumnoApiKey = [string]($InputConfig.portalAlumnoApiKey ?? '')
    portalApiKey = [string]($InputConfig.portalApiKey ?? '')
    passwordResetEnabled = ConvertTo-InstallerHubBool -Value ([string]($InputConfig.passwordResetEnabled ?? '1'))
    passwordResetTokenMinutes = [string]($InputConfig.passwordResetTokenMinutes ?? '30')
    passwordResetUrlBase = [string]($InputConfig.passwordResetUrlBase ?? '')
    googleOauthClientId = [string]($InputConfig.googleOauthClientId ?? '')
    googleClassroomClientId = [string]($InputConfig.googleClassroomClientId ?? '')
    googleClassroomClientSecret = [string]($InputConfig.googleClassroomClientSecret ?? '')
    googleClassroomRedirectUri = [string]($InputConfig.googleClassroomRedirectUri ?? '')
    requireGoogleOAuth = ConvertTo-InstallerHubBool -Value ([string]($InputConfig.requireGoogleOAuth ?? '0'))
    correoModuloActivo = ConvertTo-InstallerHubBool -Value ([string]($InputConfig.correoModuloActivo ?? '0'))
    notificacionesWebhookUrl = [string]($InputConfig.notificacionesWebhookUrl ?? '')
    notificacionesWebhookToken = [string]($InputConfig.notificacionesWebhookToken ?? '')
    requireLicenseActivation = ConvertTo-InstallerHubBool -Value ([string]($InputConfig.requireLicenseActivation ?? '0'))
    apiComercialBaseUrl = [string]($InputConfig.apiComercialBaseUrl ?? '')
    tenantId = [string]($InputConfig.tenantId ?? '')
    codigoActivacion = [string]($InputConfig.codigoActivacion ?? '')
  }
  if ([string]::IsNullOrWhiteSpace($cfg.jwtSecreto)) {
    $cfg.jwtSecreto = New-GeneratedSecret
  }
  return $cfg
}

function Test-OperationalConfig {
  param(
    [ValidateSet('install', 'repair', 'uninstall')]
    [string]$Mode,
    [hashtable]$Config
  )
  if ($Mode -eq 'uninstall') {
    return [pscustomobject]@{ ok = $true; errors = @() }
  }

  $errors = @()
  foreach ($key in @('mongoUri', 'jwtSecreto', 'corsOrigenes', 'portalAlumnoUrl', 'portalAlumnoApiKey', 'portalApiKey')) {
    if ([string]::IsNullOrWhiteSpace([string]$Config[$key])) {
      $errors += "Falta configuracion operativa obligatoria: $key"
    }
  }

  if ([string]$Config.corsOrigenes -match '^\s*\*\s*$') {
    $errors += 'CORS no puede ser "*" para operacion productiva.'
  }

  if ($Config.correoModuloActivo) {
    if ([string]::IsNullOrWhiteSpace([string]$Config.notificacionesWebhookUrl)) {
      $errors += 'Correo activo requiere notificacionesWebhookUrl.'
    }
    if ([string]::IsNullOrWhiteSpace([string]$Config.notificacionesWebhookToken)) {
      $errors += 'Correo activo requiere notificacionesWebhookToken.'
    }
  }

  if ($Config.requireGoogleOAuth) {
    if ([string]::IsNullOrWhiteSpace([string]$Config.googleOauthClientId)) {
      $errors += 'Google OAuth requerido: falta googleOauthClientId.'
    }
    if ([string]::IsNullOrWhiteSpace([string]$Config.googleClassroomClientId)) {
      $errors += 'Google OAuth requerido: falta googleClassroomClientId.'
    }
    if ([string]::IsNullOrWhiteSpace([string]$Config.googleClassroomClientSecret)) {
      $errors += 'Google OAuth requerido: falta googleClassroomClientSecret.'
    }
    if ([string]::IsNullOrWhiteSpace([string]$Config.googleClassroomRedirectUri)) {
      $errors += 'Google OAuth requerido: falta googleClassroomRedirectUri.'
    }
  }

  if ($Config.passwordResetEnabled) {
    if ([string]::IsNullOrWhiteSpace([string]$Config.passwordResetUrlBase)) {
      $errors += 'Recuperacion de contrasena activa: falta passwordResetUrlBase.'
    }
  }

  if ($Config.requireLicenseActivation) {
    if ([string]::IsNullOrWhiteSpace([string]$Config.apiComercialBaseUrl)) {
      $errors += 'Activacion de licencia requerida: falta apiComercialBaseUrl.'
    }
    if ([string]::IsNullOrWhiteSpace([string]$Config.tenantId)) {
      $errors += 'Activacion de licencia requerida: falta tenantId.'
    }
    if ([string]::IsNullOrWhiteSpace([string]$Config.codigoActivacion)) {
      $errors += 'Activacion de licencia requerida: falta codigoActivacion.'
    }
  }

  return [pscustomobject]@{
    ok = ($errors.Count -eq 0)
    errors = $errors
  }
}

function Set-OrReplaceEnvLine {
  param(
    [hashtable]$Map,
    [string]$Key,
    [string]$Value
  )
  $Map[$Key] = [string]$Value
}

function Read-EnvMap {
  param([string]$Path)
  $map = @{}
  if (-not (Test-Path $Path)) { return $map }
  $lines = Get-Content -Path $Path -Encoding utf8
  foreach ($line in $lines) {
    $trim = [string]$line
    if ([string]::IsNullOrWhiteSpace($trim)) { continue }
    if ($trim.TrimStart().StartsWith('#')) { continue }
    $idx = $trim.IndexOf('=')
    if ($idx -lt 1) { continue }
    $key = $trim.Substring(0, $idx).Trim()
    $value = $trim.Substring($idx + 1)
    $map[$key] = $value
  }
  return $map
}

function Write-EnvMap {
  param(
    [string]$Path,
    [hashtable]$Map
  )
  $keys = @($Map.Keys) | Sort-Object
  $content = @()
  foreach ($k in $keys) {
    $content += ('{0}={1}' -f $k, [string]$Map[$k])
  }
  [IO.File]::WriteAllText($Path, ($content -join [Environment]::NewLine) + [Environment]::NewLine, [System.Text.Encoding]::UTF8)
}

function Invoke-EvaluaProOperationalConfiguration {
  param(
    [ValidateSet('install', 'repair', 'uninstall')]
    [string]$Mode,
    [Parameter(Mandatory = $true)]
    [string]$InstallDir,
    [Parameter(Mandatory = $true)]
    [hashtable]$Config,
    [scriptblock]$OnLog
  )
  $normalized = Normalize-OperationalConfig -InputConfig $Config
  $validation = Test-OperationalConfig -Mode $Mode -Config $normalized
  if (-not $validation.ok) {
    $joined = ($validation.errors -join ' | ')
    throw "Configuracion operativa invalida: $joined"
  }
  if ($Mode -eq 'uninstall') {
    if ($OnLog) { & $OnLog 'info' 'Configuracion operativa omitida en desinstalacion.' }
    return [pscustomobject]@{ ok = $true; envPath = ''; profilePath = '' }
  }

  if (-not (Test-Path $InstallDir)) {
    throw "No existe carpeta de instalacion para escribir .env: $InstallDir"
  }

  $envPath = Join-Path $InstallDir '.env'
  $envMap = Read-EnvMap -Path $envPath
  Set-OrReplaceEnvLine -Map $envMap -Key 'MONGODB_URI' -Value $normalized.mongoUri
  Set-OrReplaceEnvLine -Map $envMap -Key 'JWT_SECRETO' -Value $normalized.jwtSecreto
  Set-OrReplaceEnvLine -Map $envMap -Key 'CORS_ORIGENES' -Value $normalized.corsOrigenes
  Set-OrReplaceEnvLine -Map $envMap -Key 'PORTAL_ALUMNO_URL' -Value $normalized.portalAlumnoUrl
  Set-OrReplaceEnvLine -Map $envMap -Key 'PORTAL_ALUMNO_API_KEY' -Value $normalized.portalAlumnoApiKey
  Set-OrReplaceEnvLine -Map $envMap -Key 'PORTAL_API_KEY' -Value $normalized.portalApiKey
  Set-OrReplaceEnvLine -Map $envMap -Key 'PASSWORD_RESET_ENABLED' -Value ($(if ($normalized.passwordResetEnabled) { '1' } else { '0' }))
  Set-OrReplaceEnvLine -Map $envMap -Key 'PASSWORD_RESET_TOKEN_MINUTES' -Value $normalized.passwordResetTokenMinutes
  Set-OrReplaceEnvLine -Map $envMap -Key 'PASSWORD_RESET_URL_BASE' -Value $normalized.passwordResetUrlBase
  Set-OrReplaceEnvLine -Map $envMap -Key 'GOOGLE_OAUTH_CLIENT_ID' -Value $normalized.googleOauthClientId
  Set-OrReplaceEnvLine -Map $envMap -Key 'GOOGLE_CLASSROOM_CLIENT_ID' -Value $normalized.googleClassroomClientId
  Set-OrReplaceEnvLine -Map $envMap -Key 'GOOGLE_CLASSROOM_CLIENT_SECRET' -Value $normalized.googleClassroomClientSecret
  Set-OrReplaceEnvLine -Map $envMap -Key 'GOOGLE_CLASSROOM_REDIRECT_URI' -Value $normalized.googleClassroomRedirectUri
  Set-OrReplaceEnvLine -Map $envMap -Key 'REQUIRE_GOOGLE_OAUTH' -Value ($(if ($normalized.requireGoogleOAuth) { '1' } else { '0' }))
  Set-OrReplaceEnvLine -Map $envMap -Key 'CORREO_MODULO_ACTIVO' -Value ($(if ($normalized.correoModuloActivo) { '1' } else { '0' }))

  if ($normalized.correoModuloActivo) {
    Set-OrReplaceEnvLine -Map $envMap -Key 'NOTIFICACIONES_WEBHOOK_URL' -Value $normalized.notificacionesWebhookUrl
    Set-OrReplaceEnvLine -Map $envMap -Key 'NOTIFICACIONES_WEBHOOK_TOKEN' -Value $normalized.notificacionesWebhookToken
  } else {
    Set-OrReplaceEnvLine -Map $envMap -Key 'NOTIFICACIONES_WEBHOOK_URL' -Value ''
    Set-OrReplaceEnvLine -Map $envMap -Key 'NOTIFICACIONES_WEBHOOK_TOKEN' -Value ''
  }

  Write-EnvMap -Path $envPath -Map $envMap

  $programDataRoot = Join-Path $env:ProgramData 'EvaluaPro\installer-hub'
  if (-not (Test-Path $programDataRoot)) {
    New-Item -ItemType Directory -Path $programDataRoot -Force | Out-Null
  }
  $profilePath = Join-Path $programDataRoot 'operational-config.last.json'
  $profile = [ordered]@{
    generatedAt = (Get-Date).ToString('o')
    mode = $Mode
    installDir = $InstallDir
    config = [ordered]@{
      mongoUri = $normalized.mongoUri
      jwtSecretoSet = -not [string]::IsNullOrWhiteSpace($normalized.jwtSecreto)
      corsOrigenes = $normalized.corsOrigenes
      portalAlumnoUrl = $normalized.portalAlumnoUrl
      portalAlumnoApiKeySet = -not [string]::IsNullOrWhiteSpace($normalized.portalAlumnoApiKey)
      portalApiKeySet = -not [string]::IsNullOrWhiteSpace($normalized.portalApiKey)
      passwordResetEnabled = [bool]$normalized.passwordResetEnabled
      passwordResetTokenMinutes = $normalized.passwordResetTokenMinutes
      passwordResetUrlBase = $normalized.passwordResetUrlBase
      googleOauthClientIdSet = -not [string]::IsNullOrWhiteSpace($normalized.googleOauthClientId)
      googleClassroomClientIdSet = -not [string]::IsNullOrWhiteSpace($normalized.googleClassroomClientId)
      googleClassroomClientSecretSet = -not [string]::IsNullOrWhiteSpace($normalized.googleClassroomClientSecret)
      googleClassroomRedirectUriSet = -not [string]::IsNullOrWhiteSpace($normalized.googleClassroomRedirectUri)
      requireGoogleOAuth = [bool]$normalized.requireGoogleOAuth
      correoModuloActivo = [bool]$normalized.correoModuloActivo
      notificacionesWebhookUrl = $normalized.notificacionesWebhookUrl
      notificacionesWebhookTokenSet = -not [string]::IsNullOrWhiteSpace($normalized.notificacionesWebhookToken)
      requireLicenseActivation = [bool]$normalized.requireLicenseActivation
      apiComercialBaseUrl = $normalized.apiComercialBaseUrl
      tenantId = $normalized.tenantId
      codigoActivacionSet = -not [string]::IsNullOrWhiteSpace($normalized.codigoActivacion)
    }
  }
  [IO.File]::WriteAllText($profilePath, ($profile | ConvertTo-Json -Depth 8), [System.Text.Encoding]::UTF8)

  if ($OnLog) {
    & $OnLog 'ok' "Configuracion operativa aplicada en .env: $envPath"
    & $OnLog 'info' "Perfil operativo persistido: $profilePath"
  }

  return [pscustomobject]@{
    ok = $true
    envPath = $envPath
    profilePath = $profilePath
  }
}

Export-ModuleMember -Function @(
  'Invoke-EvaluaProOperationalConfiguration',
  'Normalize-OperationalConfig',
  'Test-OperationalConfig'
)
