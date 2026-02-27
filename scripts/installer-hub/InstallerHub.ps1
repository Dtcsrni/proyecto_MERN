param(
  [ValidateSet('auto', 'install', 'repair', 'uninstall')]
  [string]$Mode = 'auto',
  [string]$InstallDir = '',
  [string]$RepoOwner = 'Dtcsrni',
  [string]$RepoName = 'EvaluaPro_Sistema_Universitario',
  [string]$ApiComercialBaseUrl = 'http://127.0.0.1:4000',
  [string]$TenantId = '',
  [string]$CodigoActivacion = '',
  [string]$MongoUri = '',
  [string]$JwtSecreto = '',
  [string]$CorsOrigenes = '',
  [string]$PortalAlumnoUrl = '',
  [string]$PortalAlumnoApiKey = '',
  [string]$PortalApiKey = '',
  [string]$PasswordResetEnabled = '1',
  [string]$PasswordResetTokenMinutes = '30',
  [string]$PasswordResetUrlBase = '',
  [string]$GoogleOauthClientId = '',
  [string]$GoogleClassroomClientId = '',
  [string]$GoogleClassroomClientSecret = '',
  [string]$GoogleClassroomRedirectUri = '',
  [string]$RequireGoogleOAuth = '0',
  [string]$CorreoModuloActivo = '0',
  [string]$NotificacionesWebhookUrl = '',
  [string]$NotificacionesWebhookToken = '',
  [string]$RequireLicenseActivation = '0',
  [switch]$Headless,
  [switch]$NoElevation
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$moduleCandidates = @(
  (Join-Path $scriptRoot 'modules'),
  $scriptRoot
)
$modulesPath = $moduleCandidates | Where-Object {
  Test-Path (Join-Path $_ 'Common.psm1')
} | Select-Object -First 1

if (-not $modulesPath) {
  throw 'No se encontro carpeta de modulos del Installer Hub.'
}

Import-Module (Join-Path $modulesPath 'Common.psm1') -Force -Global -DisableNameChecking
Import-Module (Join-Path $modulesPath 'PrereqDetector.psm1') -Force -Global -DisableNameChecking
Import-Module (Join-Path $modulesPath 'PrereqInstaller.psm1') -Force -Global -DisableNameChecking
Import-Module (Join-Path $modulesPath 'ReleaseResolver.psm1') -Force -Global -DisableNameChecking
Import-Module (Join-Path $modulesPath 'ProductInstaller.psm1') -Force -Global -DisableNameChecking
Import-Module (Join-Path $modulesPath 'PostInstallVerifier.psm1') -Force -Global -DisableNameChecking
Import-Module (Join-Path $modulesPath 'LicenseClientSecurity.psm1') -Force -Global -DisableNameChecking
Import-Module (Join-Path $modulesPath 'OperationalConfig.psm1') -Force -Global -DisableNameChecking

if (-not $NoElevation) {
  $shouldContinue = Ensure-ElevatedSession -ScriptPath $MyInvocation.MyCommand.Path -PassthroughArgs $args
  if (-not $shouldContinue) {
    exit 0
  }
}

if (-not $InstallDir) {
  $InstallDir = Join-Path ${env:ProgramFiles} 'EvaluaPro'
}

$manifestCandidates = @(
  (Join-Path $scriptRoot 'installer-prereqs.manifest.json'),
  (Join-Path $scriptRoot 'config\installer-prereqs.manifest.json'),
  (Join-Path (Split-Path -Parent $scriptRoot) 'config\installer-prereqs.manifest.json'),
  (Join-Path (Split-Path -Parent (Split-Path -Parent $scriptRoot)) 'config\installer-prereqs.manifest.json')
)
$prereqManifestPath = $manifestCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $prereqManifestPath) {
  throw 'No se encontro config/installer-prereqs.manifest.json.'
}

$logContext = New-InstallerHubLogContext
$tempRoot = Join-Path $env:TEMP ('EvaluaProInstallerHub-' + $logContext.SessionId)
New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null

function Read-EnvValueMap {
  param([string]$Path)
  $map = @{}
  if (-not (Test-Path $Path)) { return $map }
  foreach ($line in (Get-Content -Path $Path -Encoding utf8)) {
    $raw = [string]$line
    if ([string]::IsNullOrWhiteSpace($raw)) { continue }
    if ($raw.TrimStart().StartsWith('#')) { continue }
    $idx = $raw.IndexOf('=')
    if ($idx -lt 1) { continue }
    $key = $raw.Substring(0, $idx).Trim()
    $val = $raw.Substring($idx + 1)
    $map[$key] = $val
  }
  return $map
}

function Resolve-DetectedOperationalConfig {
  param(
    [string]$InstallDir,
    [pscustomobject]$Installation
  )
  $candidates = @()
  if ($InstallDir) { $candidates += (Join-Path $InstallDir '.env') }
  if ($Installation -and $Installation.InstallLocation) { $candidates += (Join-Path ([string]$Installation.InstallLocation) '.env') }
  $repoEnv = Join-Path (Split-Path -Parent (Split-Path -Parent $scriptRoot)) '.env'
  $candidates += $repoEnv
  $envPath = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $envPath) { return @{} }
  return Read-EnvValueMap -Path $envPath
}

function New-FlowState {
  $installation = Get-EvaluaProInstallationInfo
  $resolvedMode = Resolve-InstallerMode -RequestedMode $Mode -Installation $installation
  $detected = Resolve-DetectedOperationalConfig -InstallDir $InstallDir -Installation $installation

  return [pscustomobject]@{
    requestedMode = $Mode
    resolvedMode = $resolvedMode
    installation = $installation
    installDir = $InstallDir
    repoOwner = $RepoOwner
    repoName = $RepoName
    apiComercialBaseUrl = $ApiComercialBaseUrl
    tenantId = $TenantId
    codigoActivacion = $CodigoActivacion
    mongoUri = if ($MongoUri) { $MongoUri } else { [string]($detected.MONGODB_URI ?? '') }
    jwtSecreto = if ($JwtSecreto) { $JwtSecreto } else { [string]($detected.JWT_SECRETO ?? '') }
    corsOrigenes = if ($CorsOrigenes) { $CorsOrigenes } else { [string]($detected.CORS_ORIGENES ?? '') }
    portalAlumnoUrl = if ($PortalAlumnoUrl) { $PortalAlumnoUrl } else { [string]($detected.PORTAL_ALUMNO_URL ?? '') }
    portalAlumnoApiKey = if ($PortalAlumnoApiKey) { $PortalAlumnoApiKey } else { [string]($detected.PORTAL_ALUMNO_API_KEY ?? '') }
    portalApiKey = if ($PortalApiKey) { $PortalApiKey } else { [string]($detected.PORTAL_API_KEY ?? '') }
    passwordResetEnabled = if ($PasswordResetEnabled) { $PasswordResetEnabled } else { [string]($detected.PASSWORD_RESET_ENABLED ?? '1') }
    passwordResetTokenMinutes = if ($PasswordResetTokenMinutes) { $PasswordResetTokenMinutes } else { [string]($detected.PASSWORD_RESET_TOKEN_MINUTES ?? '30') }
    passwordResetUrlBase = if ($PasswordResetUrlBase) { $PasswordResetUrlBase } else { [string]($detected.PASSWORD_RESET_URL_BASE ?? '') }
    googleOauthClientId = if ($GoogleOauthClientId) { $GoogleOauthClientId } else { [string]($detected.GOOGLE_OAUTH_CLIENT_ID ?? '') }
    googleClassroomClientId = if ($GoogleClassroomClientId) { $GoogleClassroomClientId } else { [string]($detected.GOOGLE_CLASSROOM_CLIENT_ID ?? '') }
    googleClassroomClientSecret = if ($GoogleClassroomClientSecret) { $GoogleClassroomClientSecret } else { [string]($detected.GOOGLE_CLASSROOM_CLIENT_SECRET ?? '') }
    googleClassroomRedirectUri = if ($GoogleClassroomRedirectUri) { $GoogleClassroomRedirectUri } else { [string]($detected.GOOGLE_CLASSROOM_REDIRECT_URI ?? '') }
    requireGoogleOAuth = if ($RequireGoogleOAuth) { $RequireGoogleOAuth } else { [string]($detected.REQUIRE_GOOGLE_OAUTH ?? '0') }
    correoModuloActivo = if ($CorreoModuloActivo) { $CorreoModuloActivo } else { [string]($detected.CORREO_MODULO_ACTIVO ?? '0') }
    notificacionesWebhookUrl = if ($NotificacionesWebhookUrl) { $NotificacionesWebhookUrl } else { [string]($detected.NOTIFICACIONES_WEBHOOK_URL ?? '') }
    notificacionesWebhookToken = if ($NotificacionesWebhookToken) { $NotificacionesWebhookToken } else { [string]($detected.NOTIFICACIONES_WEBHOOK_TOKEN ?? '') }
    requireLicenseActivation = $RequireLicenseActivation
    internetOk = $false
    requirementReport = $null
    prereqManifest = $null
    prereqResult = $null
    release = $null
    msiPackage = $null
    productAction = $null
    postVerify = $null
    operationalSetup = $null
    licenciaSegura = $null
    integridadBaseline = $null
    exitCode = 0
    lastPhase = ''
    failureMessage = ''
    rebootRequired = $false
    logPath = $logContext.FilePath
    tempRoot = $tempRoot
  }
}

$flow = New-FlowState

function Invoke-FlowLog {
  param(
    [string]$Level,
    [string]$Message,
    [hashtable]$Meta
  )

  Write-InstallerHubLog -Context $logContext -Level $Level -Message $Message -Meta $Meta
}

function Invoke-FlowPhase {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [int]$FailCode,
    [Parameter(Mandatory = $true)]
    [scriptblock]$Action
  )

  $flow.lastPhase = $Name
  Invoke-FlowLog -Level 'info' -Message ("Fase iniciada: $Name")

  try {
    & $Action
    Invoke-FlowLog -Level 'ok' -Message ("Fase completada: $Name")
  } catch {
    $flow.exitCode = $FailCode
    $flow.failureMessage = $_.Exception.Message
    Invoke-FlowLog -Level 'error' -Message ("Fase fallida: $Name") -Meta @{ error = $_.Exception.Message; failCode = $FailCode }
    throw
  }
}

function Invoke-InstallerFlowCore {
  param(
    [scriptblock]$OnUiLog,
    [scriptblock]$OnStepUpdate
  )

  $flow.prereqManifest = Read-PrereqManifest -ManifestPath $prereqManifestPath

  Invoke-FlowPhase -Name 'analisis_requisitos' -FailCode 10 -Action {
    if ($OnStepUpdate) { & $OnStepUpdate 2 'running' 'Analizando requisitos del equipo...' }
    $flow.internetOk = Test-InstallerHubInternet
    $flow.requirementReport = Get-SystemRequirementReport -InstallPath $flow.installDir -MinDiskGb 6 -InternetOk $flow.internetOk

    if (-not $flow.requirementReport.IsReadyForFlow) {
      $joined = ($flow.requirementReport.Issues -join ' | ')
      throw "Requisitos no cumplidos: $joined"
    }

    if ($OnUiLog) {
      & $OnUiLog 'ok' ("Requisitos OK. Node detectado: $($flow.requirementReport.NodeMajor). Docker detectado: $($flow.requirementReport.DockerOk)")
    }
    if ($OnStepUpdate) { & $OnStepUpdate 2 'done' 'Requisitos verificados.' }
  }

  Invoke-FlowPhase -Name 'carpeta_recursos' -FailCode 10 -Action {
    if ($OnStepUpdate) { & $OnStepUpdate 3 'running' 'Validando carpeta de instalacion...' }

    if ([string]::IsNullOrWhiteSpace($flow.installDir)) {
      throw 'La carpeta de instalacion esta vacia.'
    }

    if ($flow.resolvedMode -ne 'uninstall') {
      if (-not (Test-Path $flow.installDir)) {
        New-Item -ItemType Directory -Path $flow.installDir -Force | Out-Null
      }
    }

    if ($OnUiLog) {
      & $OnUiLog 'info' ("Carpeta objetivo: $($flow.installDir)")
    }

    if ($OnStepUpdate) { & $OnStepUpdate 3 'done' 'Carpeta validada.' }
  }

  if ($flow.resolvedMode -ne 'uninstall') {
    Invoke-FlowPhase -Name 'prerequisitos' -FailCode 10 -Action {
      if ($OnStepUpdate) { & $OnStepUpdate 4 'running' 'Instalando prerequisitos faltantes...' }

      $downloadRoot = Join-Path $flow.tempRoot 'prereqs'
      $flow.prereqResult = Invoke-PrerequisiteInstallationFlow -Manifest $flow.prereqManifest -DownloadRoot $downloadRoot -OnLog {
        param($lvl, $msg)
        if ($OnUiLog) { & $OnUiLog $lvl $msg }
      }

      $remaining = @($flow.prereqResult.missing)
      if ($remaining.Count -gt 0) {
        $names = ($remaining | ForEach-Object { $_.name }) -join ', '
        throw "Persisten prerequisitos faltantes: $names"
      }

      if ($OnStepUpdate) { & $OnStepUpdate 4 'done' 'Prerequisitos completos.' }
    }

    Invoke-FlowPhase -Name 'release_estable' -FailCode 20 -Action {
      if ($OnStepUpdate) { & $OnStepUpdate 5 'running' 'Resolviendo release estable y MSI...' }

      $flow.release = Get-LatestStableReleaseAssets -Owner $flow.repoOwner -Repo $flow.repoName -OnLog {
        param($lvl, $msg)
        if ($OnUiLog) { & $OnUiLog $lvl $msg }
      }

      $downloadRoot = Join-Path $flow.tempRoot 'release'
      $flow.msiPackage = Download-VerifiedMsiPackage -Release $flow.release -DestinationDir $downloadRoot -OnLog {
        param($lvl, $msg)
        if ($OnUiLog) { & $OnUiLog $lvl $msg }
      }

      if ($OnUiLog) {
        & $OnUiLog 'ok' ("MSI listo: $($flow.msiPackage.msiPath)")
      }

      if ($OnStepUpdate) { & $OnStepUpdate 5 'done' 'Release estable verificada.' }
    }
  } else {
    if ($OnStepUpdate) {
      & $OnStepUpdate 4 'done' 'Prerequisitos omitidos en desinstalacion.'
      & $OnStepUpdate 5 'done' 'Descarga MSI omitida en desinstalacion.'
    }
  }

  Invoke-FlowPhase -Name 'accion_producto' -FailCode 30 -Action {
    if ($OnStepUpdate) { & $OnStepUpdate 6 'running' 'Ejecutando instalacion/reparacion/desinstalacion...' }

    $cleanup = $false
    if (Get-Variable -Name uiCleanupCheckbox -Scope Script -ErrorAction SilentlyContinue) {
      $cleanup = [bool]$script:uiCleanupCheckbox.Checked
    }

    $msiPath = ''
    if ($flow.msiPackage) { $msiPath = [string]$flow.msiPackage.msiPath }

    $flow.productAction = Invoke-EvaluaProProductAction `
      -Mode $flow.resolvedMode `
      -MsiPath $msiPath `
      -ProductCode ([string]$flow.installation.ProductCode) `
      -InstallDir $flow.installDir `
      -CleanupData $cleanup `
      -OnLog {
        param($lvl, $msg)
        if ($OnUiLog) { & $OnUiLog $lvl $msg }
      }

    $flow.rebootRequired = [bool]$flow.productAction.rebootRequired
    if ($OnStepUpdate) { & $OnStepUpdate 6 'done' 'Accion de producto finalizada.' }
  }

  Invoke-FlowPhase -Name 'configuracion_operativa' -FailCode 35 -Action {
    if ($OnStepUpdate) { & $OnStepUpdate 7 'running' 'Aplicando configuracion operativa obligatoria...' }

    $flow.operationalSetup = Invoke-EvaluaProOperationalConfiguration `
      -Mode $flow.resolvedMode `
      -InstallDir $flow.installDir `
      -Config @{
        mongoUri = $flow.mongoUri
        jwtSecreto = $flow.jwtSecreto
        corsOrigenes = $flow.corsOrigenes
        portalAlumnoUrl = $flow.portalAlumnoUrl
        portalAlumnoApiKey = $flow.portalAlumnoApiKey
        portalApiKey = $flow.portalApiKey
        passwordResetEnabled = $flow.passwordResetEnabled
        passwordResetTokenMinutes = $flow.passwordResetTokenMinutes
        passwordResetUrlBase = $flow.passwordResetUrlBase
        googleOauthClientId = $flow.googleOauthClientId
        googleClassroomClientId = $flow.googleClassroomClientId
        googleClassroomClientSecret = $flow.googleClassroomClientSecret
        googleClassroomRedirectUri = $flow.googleClassroomRedirectUri
        requireGoogleOAuth = $flow.requireGoogleOAuth
        correoModuloActivo = $flow.correoModuloActivo
        notificacionesWebhookUrl = $flow.notificacionesWebhookUrl
        notificacionesWebhookToken = $flow.notificacionesWebhookToken
        requireLicenseActivation = $flow.requireLicenseActivation
        apiComercialBaseUrl = $flow.apiComercialBaseUrl
        tenantId = $flow.tenantId
        codigoActivacion = $flow.codigoActivacion
      } `
      -OnLog {
        param($lvl, $msg)
        if ($OnUiLog) { & $OnUiLog $lvl $msg }
      }

    if ($OnStepUpdate) { & $OnStepUpdate 7 'done' 'Configuracion operativa aplicada.' }
  }

  Invoke-FlowPhase -Name 'verificacion_final' -FailCode 40 -Action {
    if ($OnStepUpdate) { & $OnStepUpdate 8 'running' 'Validando estado final del sistema...' }

    $flow.postVerify = Invoke-PostInstallVerification -Mode $flow.resolvedMode -InstallDir $flow.installDir -OnLog {
      param($lvl, $msg)
      if ($OnUiLog) { & $OnUiLog $lvl $msg }
    }

    if (-not $flow.postVerify.ok) {
      $joined = ($flow.postVerify.issues -join ' | ')
      throw "Verificacion final fallo: $joined"
    }

    if ($OnStepUpdate) { & $OnStepUpdate 8 'done' 'Verificacion completada.' }
  }

  Invoke-FlowPhase -Name 'blindaje_licencia_local' -FailCode 50 -Action {
    if ($OnStepUpdate) { & $OnStepUpdate 9 'running' 'Aplicando blindaje local de licencia...' }

    if ($flow.resolvedMode -eq 'uninstall') {
      if ($OnUiLog) { & $OnUiLog 'info' 'Blindaje local omitido en desinstalacion.' }
      if ($OnStepUpdate) { & $OnStepUpdate 9 'done' 'Blindaje omitido (desinstalacion).' }
      return
    }

    $integrityTargets = @(
      (Join-Path $flow.installDir 'scripts\launcher-dashboard.mjs'),
      (Join-Path $flow.installDir 'scripts\launcher-tray-hidden.vbs'),
      (Join-Path $flow.installDir 'scripts\update-manager.mjs')
    ) | Where-Object { Test-Path $_ }

    if ($integrityTargets.Count -gt 0) {
      $flow.integridadBaseline = Register-EvaluaProIntegrityBaseline -Paths $integrityTargets
      if ($OnUiLog) { & $OnUiLog 'ok' "Baseline de integridad generado: $($flow.integridadBaseline)" }
    } else {
      if ($OnUiLog) { & $OnUiLog 'info' 'No se detectaron archivos para baseline de integridad.' }
    }

    $tenant = [string]$flow.tenantId
    $codigo = [string]$flow.codigoActivacion
    $activarLicenciaRequerida = @('1', 'true', 'yes', 'on') -contains ([string]$flow.requireLicenseActivation).Trim().ToLowerInvariant()
    if ($tenant -and $codigo) {
      $version = if ($flow.release) { [string]$flow.release.tag } else { 'desconocida' }
      $flow.licenciaSegura = Invoke-EvaluaProLicenseActivationSecure `
        -ApiBaseUrl $flow.apiComercialBaseUrl `
        -TenantId $tenant `
        -CodigoActivacion $codigo `
        -VersionInstalada $version
      if ($OnUiLog) {
        & $OnUiLog 'ok' ("Licencia activada y almacenada con DPAPI: $($flow.licenciaSegura.securePath)")
      }
    } else {
      if ($activarLicenciaRequerida) {
        throw 'La activacion de licencia es obligatoria para esta instalacion y faltan TenantId/CodigoActivacion.'
      }
      if ($OnUiLog) { & $OnUiLog 'info' 'Activacion de licencia omitida (faltan TenantId/CodigoActivacion).' }
    }

    if ($OnStepUpdate) { & $OnStepUpdate 9 'done' 'Blindaje local completado.' }
  }

  $flow.exitCode = 0
  if ($OnStepUpdate) { & $OnStepUpdate 10 'done' 'Proceso completado.' }
}

function Invoke-HeadlessFlow {
  Invoke-FlowLog -Level 'system' -Message 'Ejecucion en modo headless iniciada.'
  try {
    Invoke-InstallerFlowCore
    $result = [pscustomobject]@{
      ok = $true
      exitCode = 0
      mode = $flow.resolvedMode
      rebootRequired = $flow.rebootRequired
      logPath = $flow.logPath
      message = 'Installer Hub completado.'
    }
    $result | ConvertTo-Json -Depth 6
    exit 0
  } catch {
    $code = if ($flow.exitCode -gt 0) { $flow.exitCode } else { 1 }
    $result = [pscustomobject]@{
      ok = $false
      exitCode = $code
      mode = $flow.resolvedMode
      logPath = $flow.logPath
      phase = $flow.lastPhase
      message = $_.Exception.Message
    }
    $result | ConvertTo-Json -Depth 6
    exit $code
  }
}

if ($Headless) {
  Invoke-HeadlessFlow
  return
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$form = New-Object System.Windows.Forms.Form
$form.Text = 'EvaluaPro Installer Hub'
$form.StartPosition = 'CenterScreen'
$form.Width = 1120
$form.Height = 760
$form.MinimumSize = New-Object System.Drawing.Size(1020, 700)
$form.BackColor = [System.Drawing.Color]::FromArgb(18, 26, 46)
$form.ForeColor = [System.Drawing.Color]::White
$form.Font = New-Object System.Drawing.Font('Segoe UI', 10)

$headerPanel = New-Object System.Windows.Forms.Panel
$headerPanel.Dock = 'Top'
$headerPanel.Height = 88
$headerPanel.BackColor = [System.Drawing.Color]::FromArgb(7, 18, 40)
$form.Controls.Add($headerPanel)

$titleLabel = New-Object System.Windows.Forms.Label
$titleLabel.Text = 'EvaluaPro Installer Hub'
$titleLabel.AutoSize = $true
$titleLabel.Font = New-Object System.Drawing.Font('Segoe UI', 20, [System.Drawing.FontStyle]::Bold)
$titleLabel.ForeColor = [System.Drawing.Color]::FromArgb(214, 241, 255)
$titleLabel.Location = New-Object System.Drawing.Point(24, 18)
$headerPanel.Controls.Add($titleLabel)

$subtitleLabel = New-Object System.Windows.Forms.Label
$subtitleLabel.Text = 'Instalacion desde cero, reparacion y desinstalacion con validaciones automaticas.'
$subtitleLabel.AutoSize = $true
$subtitleLabel.Font = New-Object System.Drawing.Font('Segoe UI', 10)
$subtitleLabel.ForeColor = [System.Drawing.Color]::FromArgb(148, 183, 216)
$subtitleLabel.Location = New-Object System.Drawing.Point(28, 56)
$headerPanel.Controls.Add($subtitleLabel)

$mainPanel = New-Object System.Windows.Forms.Panel
$mainPanel.Dock = 'Fill'
$mainPanel.Padding = New-Object System.Windows.Forms.Padding(14)
$form.Controls.Add($mainPanel)

$leftPanel = New-Object System.Windows.Forms.Panel
$leftPanel.Width = 280
$leftPanel.Dock = 'Left'
$leftPanel.Padding = New-Object System.Windows.Forms.Padding(0, 0, 12, 0)
$mainPanel.Controls.Add($leftPanel)

$stepsTitle = New-Object System.Windows.Forms.Label
$stepsTitle.Text = 'Fases del proceso'
$stepsTitle.AutoSize = $true
$stepsTitle.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 11)
$stepsTitle.ForeColor = [System.Drawing.Color]::FromArgb(201, 230, 255)
$stepsTitle.Location = New-Object System.Drawing.Point(2, 2)
$leftPanel.Controls.Add($stepsTitle)

$stepsList = New-Object System.Windows.Forms.ListBox
$stepsList.Location = New-Object System.Drawing.Point(0, 30)
$stepsList.Size = New-Object System.Drawing.Size(260, 540)
$stepsList.BackColor = [System.Drawing.Color]::FromArgb(13, 33, 56)
$stepsList.ForeColor = [System.Drawing.Color]::FromArgb(225, 238, 252)
$stepsList.BorderStyle = 'FixedSingle'
$leftPanel.Controls.Add($stepsList)

$stepItems = @(
  '[ ] 1. Splash introductorio',
  '[ ] 2. Modo instalacion/reparacion/desinstalacion',
  '[ ] 3. Analisis de requisitos de equipo',
  '[ ] 4. Carpeta y recursos requeridos',
  '[ ] 5. Prerequisitos Node y Docker',
  '[ ] 6. Descarga release estable + hash MSI',
  '[ ] 7. Ejecucion de accion MSI',
  '[ ] 8. Configuracion operativa (.env + perfil)',
  '[ ] 9. Verificacion final',
  '[ ] 10. Blindaje local de licencia'
)
$stepItems | ForEach-Object { [void]$stepsList.Items.Add($_) }
$stepsList.SelectedIndex = 0

$rightPanel = New-Object System.Windows.Forms.Panel
$rightPanel.Dock = 'Fill'
$mainPanel.Controls.Add($rightPanel)

$configGroup = New-Object System.Windows.Forms.GroupBox
$configGroup.Text = 'Configuracion de ejecucion'
$configGroup.Dock = 'Top'
$configGroup.Height = 620
$configGroup.ForeColor = [System.Drawing.Color]::FromArgb(208, 230, 255)
$configGroup.BackColor = [System.Drawing.Color]::FromArgb(10, 25, 45)
$rightPanel.Controls.Add($configGroup)

$lblMode = New-Object System.Windows.Forms.Label
$lblMode.Text = 'Modo:'
$lblMode.AutoSize = $true
$lblMode.Location = New-Object System.Drawing.Point(18, 34)
$configGroup.Controls.Add($lblMode)

$comboMode = New-Object System.Windows.Forms.ComboBox
$comboMode.DropDownStyle = 'DropDownList'
$comboMode.Location = New-Object System.Drawing.Point(130, 30)
$comboMode.Width = 230
[void]$comboMode.Items.Add('auto')
[void]$comboMode.Items.Add('install')
[void]$comboMode.Items.Add('repair')
[void]$comboMode.Items.Add('uninstall')
$comboMode.SelectedItem = $flow.resolvedMode
$configGroup.Controls.Add($comboMode)

$lblInstallPath = New-Object System.Windows.Forms.Label
$lblInstallPath.Text = 'Carpeta destino:'
$lblInstallPath.AutoSize = $true
$lblInstallPath.Location = New-Object System.Drawing.Point(18, 75)
$configGroup.Controls.Add($lblInstallPath)

$textInstallPath = New-Object System.Windows.Forms.TextBox
$textInstallPath.Location = New-Object System.Drawing.Point(130, 70)
$textInstallPath.Width = 600
$textInstallPath.Text = $flow.installDir
$configGroup.Controls.Add($textInstallPath)

$btnBrowse = New-Object System.Windows.Forms.Button
$btnBrowse.Text = 'Explorar'
$btnBrowse.Location = New-Object System.Drawing.Point(742, 67)
$btnBrowse.Width = 95
$configGroup.Controls.Add($btnBrowse)

$script:uiCleanupCheckbox = New-Object System.Windows.Forms.CheckBox
$script:uiCleanupCheckbox.Text = 'Desinstalacion con limpieza total de datos residuales'
$script:uiCleanupCheckbox.AutoSize = $true
$script:uiCleanupCheckbox.Location = New-Object System.Drawing.Point(130, 110)
$script:uiCleanupCheckbox.Checked = $false
$configGroup.Controls.Add($script:uiCleanupCheckbox)

$lblRepo = New-Object System.Windows.Forms.Label
$lblRepo.Text = "Repositorio release: $($flow.repoOwner)/$($flow.repoName)"
$lblRepo.AutoSize = $true
$lblRepo.Location = New-Object System.Drawing.Point(18, 145)
$lblRepo.ForeColor = [System.Drawing.Color]::FromArgb(136, 184, 226)
$configGroup.Controls.Add($lblRepo)

$lblApiComercial = New-Object System.Windows.Forms.Label
$lblApiComercial.Text = 'API comercial:'
$lblApiComercial.AutoSize = $true
$lblApiComercial.Location = New-Object System.Drawing.Point(18, 175)
$configGroup.Controls.Add($lblApiComercial)

$textApiComercial = New-Object System.Windows.Forms.TextBox
$textApiComercial.Location = New-Object System.Drawing.Point(130, 170)
$textApiComercial.Width = 320
$textApiComercial.Text = $flow.apiComercialBaseUrl
$configGroup.Controls.Add($textApiComercial)

$lblTenantId = New-Object System.Windows.Forms.Label
$lblTenantId.Text = 'TenantId (opt):'
$lblTenantId.AutoSize = $true
$lblTenantId.Location = New-Object System.Drawing.Point(470, 175)
$configGroup.Controls.Add($lblTenantId)

$textTenantId = New-Object System.Windows.Forms.TextBox
$textTenantId.Location = New-Object System.Drawing.Point(570, 170)
$textTenantId.Width = 160
$textTenantId.Text = $flow.tenantId
$configGroup.Controls.Add($textTenantId)

$lblCodigoActivacion = New-Object System.Windows.Forms.Label
$lblCodigoActivacion.Text = 'Codigo activacion (opt):'
$lblCodigoActivacion.AutoSize = $true
$lblCodigoActivacion.Location = New-Object System.Drawing.Point(18, 206)
$configGroup.Controls.Add($lblCodigoActivacion)

$textCodigoActivacion = New-Object System.Windows.Forms.TextBox
$textCodigoActivacion.Location = New-Object System.Drawing.Point(180, 201)
$textCodigoActivacion.Width = 280
$textCodigoActivacion.Text = $flow.codigoActivacion
$configGroup.Controls.Add($textCodigoActivacion)

$lblMongoUri = New-Object System.Windows.Forms.Label
$lblMongoUri.Text = 'MONGODB_URI:'
$lblMongoUri.AutoSize = $true
$lblMongoUri.Location = New-Object System.Drawing.Point(18, 240)
$configGroup.Controls.Add($lblMongoUri)

$textMongoUri = New-Object System.Windows.Forms.TextBox
$textMongoUri.Location = New-Object System.Drawing.Point(130, 235)
$textMongoUri.Width = 320
$textMongoUri.Text = $flow.mongoUri
$configGroup.Controls.Add($textMongoUri)

$lblJwtSecreto = New-Object System.Windows.Forms.Label
$lblJwtSecreto.Text = 'JWT_SECRETO:'
$lblJwtSecreto.AutoSize = $true
$lblJwtSecreto.Location = New-Object System.Drawing.Point(470, 240)
$configGroup.Controls.Add($lblJwtSecreto)

$textJwtSecreto = New-Object System.Windows.Forms.TextBox
$textJwtSecreto.Location = New-Object System.Drawing.Point(570, 235)
$textJwtSecreto.Width = 267
$textJwtSecreto.Text = $flow.jwtSecreto
$textJwtSecreto.UseSystemPasswordChar = $true
$configGroup.Controls.Add($textJwtSecreto)

$lblCors = New-Object System.Windows.Forms.Label
$lblCors.Text = 'CORS_ORIGENES:'
$lblCors.AutoSize = $true
$lblCors.Location = New-Object System.Drawing.Point(18, 271)
$configGroup.Controls.Add($lblCors)

$textCors = New-Object System.Windows.Forms.TextBox
$textCors.Location = New-Object System.Drawing.Point(130, 266)
$textCors.Width = 707
$textCors.Text = $flow.corsOrigenes
$configGroup.Controls.Add($textCors)

$lblPortalUrl = New-Object System.Windows.Forms.Label
$lblPortalUrl.Text = 'PORTAL_ALUMNO_URL:'
$lblPortalUrl.AutoSize = $true
$lblPortalUrl.Location = New-Object System.Drawing.Point(18, 302)
$configGroup.Controls.Add($lblPortalUrl)

$textPortalUrl = New-Object System.Windows.Forms.TextBox
$textPortalUrl.Location = New-Object System.Drawing.Point(180, 297)
$textPortalUrl.Width = 270
$textPortalUrl.Text = $flow.portalAlumnoUrl
$configGroup.Controls.Add($textPortalUrl)

$lblPortalAlumnoKey = New-Object System.Windows.Forms.Label
$lblPortalAlumnoKey.Text = 'PORTAL_ALUMNO_API_KEY:'
$lblPortalAlumnoKey.AutoSize = $true
$lblPortalAlumnoKey.Location = New-Object System.Drawing.Point(470, 302)
$configGroup.Controls.Add($lblPortalAlumnoKey)

$textPortalAlumnoKey = New-Object System.Windows.Forms.TextBox
$textPortalAlumnoKey.Location = New-Object System.Drawing.Point(640, 297)
$textPortalAlumnoKey.Width = 197
$textPortalAlumnoKey.Text = $flow.portalAlumnoApiKey
$textPortalAlumnoKey.UseSystemPasswordChar = $true
$configGroup.Controls.Add($textPortalAlumnoKey)

$lblPortalApiKey = New-Object System.Windows.Forms.Label
$lblPortalApiKey.Text = 'PORTAL_API_KEY (portal cloud):'
$lblPortalApiKey.AutoSize = $true
$lblPortalApiKey.Location = New-Object System.Drawing.Point(18, 333)
$configGroup.Controls.Add($lblPortalApiKey)

$textPortalApiKey = New-Object System.Windows.Forms.TextBox
$textPortalApiKey.Location = New-Object System.Drawing.Point(220, 328)
$textPortalApiKey.Width = 230
$textPortalApiKey.Text = $flow.portalApiKey
$textPortalApiKey.UseSystemPasswordChar = $true
$configGroup.Controls.Add($textPortalApiKey)

$checkCorreoModulo = New-Object System.Windows.Forms.CheckBox
$checkCorreoModulo.Text = 'Activar modulo de correo (requiere webhook)'
$checkCorreoModulo.AutoSize = $true
$checkCorreoModulo.Location = New-Object System.Drawing.Point(470, 331)
$checkCorreoModulo.Checked = (@('1', 'true', 'yes', 'on') -contains ([string]$flow.correoModuloActivo).Trim().ToLowerInvariant())
$configGroup.Controls.Add($checkCorreoModulo)

$lblWebhookUrl = New-Object System.Windows.Forms.Label
$lblWebhookUrl.Text = 'NOTIFICACIONES_WEBHOOK_URL:'
$lblWebhookUrl.AutoSize = $true
$lblWebhookUrl.Location = New-Object System.Drawing.Point(18, 364)
$configGroup.Controls.Add($lblWebhookUrl)

$textWebhookUrl = New-Object System.Windows.Forms.TextBox
$textWebhookUrl.Location = New-Object System.Drawing.Point(220, 359)
$textWebhookUrl.Width = 350
$textWebhookUrl.Text = $flow.notificacionesWebhookUrl
$configGroup.Controls.Add($textWebhookUrl)

$lblWebhookToken = New-Object System.Windows.Forms.Label
$lblWebhookToken.Text = 'NOTIFICACIONES_WEBHOOK_TOKEN:'
$lblWebhookToken.AutoSize = $true
$lblWebhookToken.Location = New-Object System.Drawing.Point(18, 392)
$configGroup.Controls.Add($lblWebhookToken)

$textWebhookToken = New-Object System.Windows.Forms.TextBox
$textWebhookToken.Location = New-Object System.Drawing.Point(250, 387)
$textWebhookToken.Width = 320
$textWebhookToken.Text = $flow.notificacionesWebhookToken
$textWebhookToken.UseSystemPasswordChar = $true
$configGroup.Controls.Add($textWebhookToken)

$checkRequireLicense = New-Object System.Windows.Forms.CheckBox
$checkRequireLicense.Text = 'Requerir activacion de licencia en esta instalacion'
$checkRequireLicense.AutoSize = $true
$checkRequireLicense.Location = New-Object System.Drawing.Point(580, 390)
$checkRequireLicense.Checked = (@('1', 'true', 'yes', 'on') -contains ([string]$flow.requireLicenseActivation).Trim().ToLowerInvariant())
$configGroup.Controls.Add($checkRequireLicense)

$checkPasswordResetEnabled = New-Object System.Windows.Forms.CheckBox
$checkPasswordResetEnabled.Text = 'Activar recuperacion de contrasena segura'
$checkPasswordResetEnabled.AutoSize = $true
$checkPasswordResetEnabled.Location = New-Object System.Drawing.Point(18, 424)
$checkPasswordResetEnabled.Checked = (@('1', 'true', 'yes', 'on') -contains ([string]$flow.passwordResetEnabled).Trim().ToLowerInvariant())
$configGroup.Controls.Add($checkPasswordResetEnabled)

$lblPasswordResetMinutes = New-Object System.Windows.Forms.Label
$lblPasswordResetMinutes.Text = 'PASSWORD_RESET_TOKEN_MINUTES:'
$lblPasswordResetMinutes.AutoSize = $true
$lblPasswordResetMinutes.Location = New-Object System.Drawing.Point(320, 425)
$configGroup.Controls.Add($lblPasswordResetMinutes)

$textPasswordResetMinutes = New-Object System.Windows.Forms.TextBox
$textPasswordResetMinutes.Location = New-Object System.Drawing.Point(550, 420)
$textPasswordResetMinutes.Width = 60
$textPasswordResetMinutes.Text = [string]$flow.passwordResetTokenMinutes
$configGroup.Controls.Add($textPasswordResetMinutes)

$lblPasswordResetUrl = New-Object System.Windows.Forms.Label
$lblPasswordResetUrl.Text = 'PASSWORD_RESET_URL_BASE:'
$lblPasswordResetUrl.AutoSize = $true
$lblPasswordResetUrl.Location = New-Object System.Drawing.Point(620, 425)
$configGroup.Controls.Add($lblPasswordResetUrl)

$textPasswordResetUrl = New-Object System.Windows.Forms.TextBox
$textPasswordResetUrl.Location = New-Object System.Drawing.Point(18, 452)
$textPasswordResetUrl.Width = 819
$textPasswordResetUrl.Text = $flow.passwordResetUrlBase
$configGroup.Controls.Add($textPasswordResetUrl)

$checkRequireGoogleOauth = New-Object System.Windows.Forms.CheckBox
$checkRequireGoogleOauth.Text = 'Requerir OAuth Google/Classroom en esta instalacion'
$checkRequireGoogleOauth.AutoSize = $true
$checkRequireGoogleOauth.Location = New-Object System.Drawing.Point(18, 482)
$checkRequireGoogleOauth.Checked = (@('1', 'true', 'yes', 'on') -contains ([string]$flow.requireGoogleOAuth).Trim().ToLowerInvariant())
$configGroup.Controls.Add($checkRequireGoogleOauth)

$lblGoogleOauthClientId = New-Object System.Windows.Forms.Label
$lblGoogleOauthClientId.Text = 'GOOGLE_OAUTH_CLIENT_ID:'
$lblGoogleOauthClientId.AutoSize = $true
$lblGoogleOauthClientId.Location = New-Object System.Drawing.Point(18, 512)
$configGroup.Controls.Add($lblGoogleOauthClientId)

$textGoogleOauthClientId = New-Object System.Windows.Forms.TextBox
$textGoogleOauthClientId.Location = New-Object System.Drawing.Point(220, 507)
$textGoogleOauthClientId.Width = 617
$textGoogleOauthClientId.Text = $flow.googleOauthClientId
$configGroup.Controls.Add($textGoogleOauthClientId)

$lblClassroomClientId = New-Object System.Windows.Forms.Label
$lblClassroomClientId.Text = 'GOOGLE_CLASSROOM_CLIENT_ID:'
$lblClassroomClientId.AutoSize = $true
$lblClassroomClientId.Location = New-Object System.Drawing.Point(18, 543)
$configGroup.Controls.Add($lblClassroomClientId)

$textClassroomClientId = New-Object System.Windows.Forms.TextBox
$textClassroomClientId.Location = New-Object System.Drawing.Point(250, 538)
$textClassroomClientId.Width = 220
$textClassroomClientId.Text = $flow.googleClassroomClientId
$configGroup.Controls.Add($textClassroomClientId)

$lblClassroomSecret = New-Object System.Windows.Forms.Label
$lblClassroomSecret.Text = 'GOOGLE_CLASSROOM_CLIENT_SECRET:'
$lblClassroomSecret.AutoSize = $true
$lblClassroomSecret.Location = New-Object System.Drawing.Point(480, 543)
$configGroup.Controls.Add($lblClassroomSecret)

$textClassroomSecret = New-Object System.Windows.Forms.TextBox
$textClassroomSecret.Location = New-Object System.Drawing.Point(710, 538)
$textClassroomSecret.Width = 127
$textClassroomSecret.Text = $flow.googleClassroomClientSecret
$textClassroomSecret.UseSystemPasswordChar = $true
$configGroup.Controls.Add($textClassroomSecret)

$lblClassroomRedirect = New-Object System.Windows.Forms.Label
$lblClassroomRedirect.Text = 'GOOGLE_CLASSROOM_REDIRECT_URI:'
$lblClassroomRedirect.AutoSize = $true
$lblClassroomRedirect.Location = New-Object System.Drawing.Point(18, 574)
$configGroup.Controls.Add($lblClassroomRedirect)

$textClassroomRedirect = New-Object System.Windows.Forms.TextBox
$textClassroomRedirect.Location = New-Object System.Drawing.Point(260, 569)
$textClassroomRedirect.Width = 577
$textClassroomRedirect.Text = $flow.googleClassroomRedirectUri
$configGroup.Controls.Add($textClassroomRedirect)

$statusPanel = New-Object System.Windows.Forms.Panel
$statusPanel.Dock = 'Top'
$statusPanel.Height = 98
$statusPanel.Padding = New-Object System.Windows.Forms.Padding(0, 12, 0, 0)
$rightPanel.Controls.Add($statusPanel)

$progressBar = New-Object System.Windows.Forms.ProgressBar
$progressBar.Width = 820
$progressBar.Height = 24
$progressBar.Location = New-Object System.Drawing.Point(0, 14)
$progressBar.Minimum = 0
$progressBar.Maximum = 100
$progressBar.Value = 0
$statusPanel.Controls.Add($progressBar)

$statusLabel = New-Object System.Windows.Forms.Label
$statusLabel.Text = 'Listo para iniciar el flujo de instalacion.'
$statusLabel.AutoSize = $true
$statusLabel.Location = New-Object System.Drawing.Point(0, 46)
$statusLabel.ForeColor = [System.Drawing.Color]::FromArgb(197, 223, 248)
$statusPanel.Controls.Add($statusLabel)

$logBox = New-Object System.Windows.Forms.TextBox
$logBox.Multiline = $true
$logBox.ScrollBars = 'Vertical'
$logBox.Dock = 'Fill'
$logBox.ReadOnly = $true
$logBox.BackColor = [System.Drawing.Color]::FromArgb(7, 16, 30)
$logBox.ForeColor = [System.Drawing.Color]::FromArgb(201, 241, 213)
$logBox.Font = New-Object System.Drawing.Font('Consolas', 9)
$rightPanel.Controls.Add($logBox)

$actionsPanel = New-Object System.Windows.Forms.Panel
$actionsPanel.Dock = 'Bottom'
$actionsPanel.Height = 62
$actionsPanel.Padding = New-Object System.Windows.Forms.Padding(0, 8, 0, 0)
$rightPanel.Controls.Add($actionsPanel)

$btnRun = New-Object System.Windows.Forms.Button
$btnRun.Text = 'Iniciar instalacion'
$btnRun.Width = 190
$btnRun.Height = 38
$btnRun.Location = New-Object System.Drawing.Point(0, 10)
$btnRun.BackColor = [System.Drawing.Color]::FromArgb(28, 114, 196)
$btnRun.ForeColor = [System.Drawing.Color]::White
$btnRun.FlatStyle = 'Popup'
$actionsPanel.Controls.Add($btnRun)

$btnRetry = New-Object System.Windows.Forms.Button
$btnRetry.Text = 'Reintentar'
$btnRetry.Width = 120
$btnRetry.Height = 38
$btnRetry.Location = New-Object System.Drawing.Point(204, 10)
$btnRetry.Enabled = $false
$actionsPanel.Controls.Add($btnRetry)

$btnOpenLogs = New-Object System.Windows.Forms.Button
$btnOpenLogs.Text = 'Abrir logs'
$btnOpenLogs.Width = 120
$btnOpenLogs.Height = 38
$btnOpenLogs.Location = New-Object System.Drawing.Point(336, 10)
$actionsPanel.Controls.Add($btnOpenLogs)

$btnOpenDashboard = New-Object System.Windows.Forms.Button
$btnOpenDashboard.Text = 'Abrir dashboard'
$btnOpenDashboard.Width = 150
$btnOpenDashboard.Height = 38
$btnOpenDashboard.Location = New-Object System.Drawing.Point(468, 10)
$btnOpenDashboard.Enabled = $false
$actionsPanel.Controls.Add($btnOpenDashboard)

$btnExit = New-Object System.Windows.Forms.Button
$btnExit.Text = 'Finalizar'
$btnExit.Width = 120
$btnExit.Height = 38
$btnExit.Location = New-Object System.Drawing.Point(632, 10)
$actionsPanel.Controls.Add($btnExit)

$splashPanel = New-Object System.Windows.Forms.Panel
$splashPanel.Dock = 'Fill'
$splashPanel.BackColor = [System.Drawing.Color]::FromArgb(11, 26, 52)
$rightPanel.Controls.Add($splashPanel)
$splashPanel.BringToFront()

$splashTitle = New-Object System.Windows.Forms.Label
$splashTitle.Text = 'Bienvenido a EvaluaPro Installer Hub'
$splashTitle.Font = New-Object System.Drawing.Font('Segoe UI', 24, [System.Drawing.FontStyle]::Bold)
$splashTitle.AutoSize = $true
$splashTitle.ForeColor = [System.Drawing.Color]::FromArgb(230, 245, 255)
$splashTitle.Location = New-Object System.Drawing.Point(64, 76)
$splashPanel.Controls.Add($splashTitle)

$splashText = New-Object System.Windows.Forms.Label
$splashText.Text = 'Instala, repara o desinstala EvaluaPro desde cero con verificacion de requisitos, descarga segura de la version estable y control completo del proceso para docentes.'
$splashText.Size = New-Object System.Drawing.Size(760, 90)
$splashText.Location = New-Object System.Drawing.Point(68, 144)
$splashText.ForeColor = [System.Drawing.Color]::FromArgb(173, 212, 238)
$splashText.Font = New-Object System.Drawing.Font('Segoe UI', 11)
$splashPanel.Controls.Add($splashText)

$splashBullets = New-Object System.Windows.Forms.Label
$splashBullets.Text = "- Analisis de requisitos del equipo`n- Autoinstalacion de prerequisitos (Node + Docker)`n- Descarga y verificacion SHA256 de release estable`n- Instalacion, reparacion y desinstalacion con seguimiento por fases"
$splashBullets.Size = New-Object System.Drawing.Size(760, 120)
$splashBullets.Location = New-Object System.Drawing.Point(72, 242)
$splashBullets.ForeColor = [System.Drawing.Color]::FromArgb(188, 226, 255)
$splashBullets.Font = New-Object System.Drawing.Font('Segoe UI', 10)
$splashPanel.Controls.Add($splashBullets)

$btnSplashStart = New-Object System.Windows.Forms.Button
$btnSplashStart.Text = 'Comenzar'
$btnSplashStart.Width = 160
$btnSplashStart.Height = 42
$btnSplashStart.Location = New-Object System.Drawing.Point(72, 392)
$btnSplashStart.BackColor = [System.Drawing.Color]::FromArgb(31, 148, 111)
$btnSplashStart.ForeColor = [System.Drawing.Color]::White
$btnSplashStart.FlatStyle = 'Popup'
$splashPanel.Controls.Add($btnSplashStart)

$labelLogPath = New-Object System.Windows.Forms.Label
$labelLogPath.Text = "Log de sesion: $($flow.logPath)"
$labelLogPath.AutoSize = $true
$labelLogPath.Location = New-Object System.Drawing.Point(72, 452)
$labelLogPath.ForeColor = [System.Drawing.Color]::FromArgb(132, 183, 221)
$labelLogPath.Font = New-Object System.Drawing.Font('Segoe UI', 9)
$splashPanel.Controls.Add($labelLogPath)

function Update-StepUi {
  param(
    [int]$Index,
    [ValidateSet('pending', 'running', 'done', 'error')]
    [string]$State,
    [string]$StatusText
  )

  $prefix = '[ ]'
  switch ($State) {
    'running' { $prefix = '[~]' }
    'done' { $prefix = '[OK]' }
    'error' { $prefix = '[X]' }
    default { $prefix = '[ ]' }
  }

  if ($Index -ge 0 -and $Index -lt $stepsList.Items.Count) {
    $original = [string]$stepItems[$Index]
    $clean = ($original -replace '^\[[^\]]+\]\s*', '')
    $stepsList.Items[$Index] = "$prefix $clean"
    $stepsList.SelectedIndex = $Index
  }

  if ($StatusText) {
    $statusLabel.Text = $StatusText
  }

  $doneCount = 0
  for ($i = 0; $i -lt $stepsList.Items.Count; $i++) {
    if ([string]$stepsList.Items[$i] -like '[OK]*') { $doneCount += 1 }
  }

  $progress = [math]::Round(($doneCount / [math]::Max(1, $stepsList.Items.Count)) * 100)
  $progressBar.Value = [math]::Min(100, [math]::Max(0, $progress))
  [System.Windows.Forms.Application]::DoEvents()
}

function Add-UiLog {
  param([string]$Level, [string]$Message)

  $ts = (Get-Date).ToString('HH:mm:ss')
  $line = "[$ts] [$Level] $Message"
  $logBox.AppendText($line + [Environment]::NewLine)
  $logBox.SelectionStart = $logBox.TextLength
  $logBox.ScrollToCaret()
  Invoke-FlowLog -Level $Level -Message $Message
  [System.Windows.Forms.Application]::DoEvents()
}

$btnBrowse.Add_Click({
  $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
  $dialog.SelectedPath = $textInstallPath.Text
  $dialog.Description = 'Selecciona carpeta de instalacion de EvaluaPro'
  if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
    $textInstallPath.Text = $dialog.SelectedPath
  }
})

$btnSplashStart.Add_Click({
  Update-StepUi -Index 0 -State 'done' -StatusText 'Splash completado. Configura y ejecuta el flujo.'
  $splashPanel.Hide()
  Add-UiLog 'info' 'Splash completado. Inicio de wizard operativo.'
})

$comboMode.Add_SelectedIndexChanged({
  $selected = [string]$comboMode.SelectedItem
  $script:uiCleanupCheckbox.Enabled = ($selected -eq 'uninstall')
})

function Run-InstallerFlowUi {
  try {
    $btnRun.Enabled = $false
    $btnRetry.Enabled = $false
    $btnOpenDashboard.Enabled = $false

    for ($i = 1; $i -lt $stepsList.Items.Count; $i++) {
      Update-StepUi -Index $i -State 'pending' -StatusText 'Preparando ejecucion...'
    }

    $flow.installDir = [string]$textInstallPath.Text
    $flow.requestedMode = [string]$comboMode.SelectedItem
    $flow.apiComercialBaseUrl = [string]$textApiComercial.Text
    $flow.tenantId = [string]$textTenantId.Text
    $flow.codigoActivacion = [string]$textCodigoActivacion.Text
    $flow.mongoUri = [string]$textMongoUri.Text
    $flow.jwtSecreto = [string]$textJwtSecreto.Text
    $flow.corsOrigenes = [string]$textCors.Text
    $flow.portalAlumnoUrl = [string]$textPortalUrl.Text
    $flow.portalAlumnoApiKey = [string]$textPortalAlumnoKey.Text
    $flow.portalApiKey = [string]$textPortalApiKey.Text
    $flow.passwordResetEnabled = if ($checkPasswordResetEnabled.Checked) { '1' } else { '0' }
    $flow.passwordResetTokenMinutes = [string]$textPasswordResetMinutes.Text
    $flow.passwordResetUrlBase = [string]$textPasswordResetUrl.Text
    $flow.googleOauthClientId = [string]$textGoogleOauthClientId.Text
    $flow.googleClassroomClientId = [string]$textClassroomClientId.Text
    $flow.googleClassroomClientSecret = [string]$textClassroomSecret.Text
    $flow.googleClassroomRedirectUri = [string]$textClassroomRedirect.Text
    $flow.requireGoogleOAuth = if ($checkRequireGoogleOauth.Checked) { '1' } else { '0' }
    $flow.correoModuloActivo = if ($checkCorreoModulo.Checked) { '1' } else { '0' }
    $flow.notificacionesWebhookUrl = [string]$textWebhookUrl.Text
    $flow.notificacionesWebhookToken = [string]$textWebhookToken.Text
    $flow.requireLicenseActivation = if ($checkRequireLicense.Checked) { '1' } else { '0' }
    $flow.installation = Get-EvaluaProInstallationInfo
    $flow.resolvedMode = Resolve-InstallerMode -RequestedMode $flow.requestedMode -Installation $flow.installation

    Add-UiLog 'system' ("Modo solicitado: $($flow.requestedMode) | modo efectivo: $($flow.resolvedMode)")

    Update-StepUi -Index 1 -State 'running' -StatusText 'Determinando modo efectivo de operacion...'
    Start-Sleep -Milliseconds 250
    Update-StepUi -Index 1 -State 'done' -StatusText ("Modo seleccionado: $($flow.resolvedMode)")

    Invoke-InstallerFlowCore -OnUiLog {
      param($lvl, $msg)
      Add-UiLog $lvl $msg
    } -OnStepUpdate {
      param($idx, $state, $txt)
      Update-StepUi -Index $idx -State $state -StatusText $txt
    }

    $summary = "Proceso completado correctamente (exit=0)."
    if ($flow.rebootRequired) {
      $summary += ' Reinicio recomendado por msiexec (3010).'
    }
    $statusLabel.Text = $summary
    Add-UiLog 'ok' $summary

    $btnOpenDashboard.Enabled = ($flow.resolvedMode -ne 'uninstall')
    $btnRetry.Enabled = $true

    [System.Windows.Forms.MessageBox]::Show(
      $summary,
      'EvaluaPro Installer Hub',
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Information
    ) | Out-Null
  } catch {
    $code = if ($flow.exitCode -gt 0) { $flow.exitCode } else { 1 }
    Update-StepUi -Index 9 -State 'error' -StatusText "Proceso fallido (exit=$code)."

    $message = $_.Exception.Message
    Add-UiLog 'error' ("Fallo en fase '$($flow.lastPhase)': $message")

    $btnRetry.Enabled = $true
    [System.Windows.Forms.MessageBox]::Show(
      "Ocurrio un error (exit=$code):`n$message`n`nRevisa el log:`n$($flow.logPath)",
      'EvaluaPro Installer Hub',
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
  } finally {
    $btnRun.Enabled = $true
  }
}

$btnRun.Add_Click({ Run-InstallerFlowUi })
$btnRetry.Add_Click({ Run-InstallerFlowUi })
$btnExit.Add_Click({ $form.Close() })

$btnOpenLogs.Add_Click({
  $logDir = Split-Path -Parent $flow.logPath
  if (Test-Path $logDir) {
    Start-Process explorer.exe -ArgumentList ('"{0}"' -f $logDir) | Out-Null
  }
})

$btnOpenDashboard.Add_Click({
  try {
    $installation = Get-EvaluaProInstallationInfo
    $installLocation = [string]$installation.InstallLocation
    if (-not $installLocation) {
      $installLocation = $flow.installDir
    }

    $launcher = Join-Path $installLocation 'scripts\launcher-tray-hidden.vbs'
    if (Test-Path $launcher) {
      Start-Process -FilePath 'wscript.exe' -ArgumentList ('//nologo "{0}" prod 4519' -f $launcher) -WindowStyle Hidden | Out-Null
    } else {
      Start-Process 'http://127.0.0.1:4519/' | Out-Null
    }
  } catch {
    [System.Windows.Forms.MessageBox]::Show(
      'No se pudo abrir el dashboard automaticamente.',
      'EvaluaPro Installer Hub',
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Warning
    ) | Out-Null
  }
})

Add-UiLog 'system' ("Sesion iniciada. Log: $($flow.logPath)")
Add-UiLog 'info' ("Prereq manifest: $prereqManifestPath")

[void]$form.ShowDialog()

exit 0
