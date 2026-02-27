Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'Common.psm1') -DisableNameChecking

function Remove-EvaluaProDataResiduals {
  param(
    [string]$InstallDir,
    [scriptblock]$OnLog
  )

  $targets = @()
  if ($InstallDir) {
    $targets += $InstallDir
  }

  $programDataPath = Join-Path $env:ProgramData 'EvaluaPro'
  $localAppDataPath = Join-Path $env:LOCALAPPDATA 'EvaluaPro'
  $targets += @($programDataPath, $localAppDataPath)

  foreach ($target in $targets | Select-Object -Unique) {
    if (-not $target) { continue }
    if (-not (Test-Path $target)) { continue }
    try {
      Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction Stop
      if ($OnLog) { & $OnLog 'warn' "Limpieza completa aplicada en: $target" }
    } catch {
      if ($OnLog) { & $OnLog 'warn' "No se pudo limpiar ruta: $target" }
    }
  }
}

function Invoke-EvaluaProProductAction {
  param(
    [ValidateSet('install', 'repair', 'uninstall')]
    [string]$Mode,
    [string]$MsiPath,
    [string]$ProductCode,
    [string]$InstallDir,
    [bool]$CleanupData = $false,
    [scriptblock]$OnLog
  )

  if ($OnLog) { & $OnLog 'info' "Ejecutando accion de producto: $Mode" }

  $args = ''
  switch ($Mode) {
    'install' {
      if (-not $MsiPath -or -not (Test-Path $MsiPath)) {
        throw 'MSI requerido para modo install.'
      }
      $installProperty = ''
      if ($InstallDir) {
        $installProperty = (' INSTALLFOLDER="{0}"' -f $InstallDir)
      }
      $args = ('/i "{0}" /qn /norestart INSTALL_DESKTOP_SHORTCUTS=1 INSTALL_STARTMENU_SHORTCUTS=1{1}' -f $MsiPath, $installProperty)
    }
    'repair' {
      if ($ProductCode) {
        $args = ('/fa {0} /qn /norestart' -f $ProductCode)
      } else {
        if (-not $MsiPath -or -not (Test-Path $MsiPath)) {
          throw 'MSI requerido para modo repair cuando no existe ProductCode.'
        }
        $args = ('/i "{0}" REINSTALL=ALL REINSTALLMODE=vomus /qn /norestart' -f $MsiPath)
      }
    }
    'uninstall' {
      if ($ProductCode) {
        $args = ('/x {0} /qn /norestart' -f $ProductCode)
      } elseif ($MsiPath -and (Test-Path $MsiPath)) {
        $args = ('/x "{0}" /qn /norestart' -f $MsiPath)
      } else {
        if ($OnLog) { & $OnLog 'warn' 'No se detecto producto instalado para desinstalar. Se considera estado deseado.' }
        return [pscustomobject]@{
          ok = $true
          exitCode = 0
          rebootRequired = $false
          skipped = $true
        }
      }
    }
  }

  $exitCode = Invoke-InstallerHubProcess -FilePath 'msiexec.exe' -Arguments $args -TimeoutSec 2400
  $ok = ($exitCode -eq 0 -or $exitCode -eq 3010)

  if (-not $ok) {
    throw "msiexec devolvio codigo no exitoso: $exitCode"
  }

  if ($Mode -eq 'uninstall' -and $CleanupData) {
    Remove-EvaluaProDataResiduals -InstallDir $InstallDir -OnLog $OnLog
  }

  if ($OnLog) {
    $human = if ($exitCode -eq 3010) { 'ok_reboot_required' } else { 'ok' }
    & $OnLog 'ok' ("Accion $Mode finalizada ($human).")
  }

  return [pscustomobject]@{
    ok = $true
    exitCode = $exitCode
    rebootRequired = ($exitCode -eq 3010)
  }
}

Export-ModuleMember -Function @(
  'Invoke-EvaluaProProductAction'
)
