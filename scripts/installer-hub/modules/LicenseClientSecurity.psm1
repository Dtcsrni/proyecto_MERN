Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'Common.psm1') -DisableNameChecking

function Get-EvaluaProMachineFingerprintHash {
  $machineGuid = ''
  try {
    $machineGuid = [string](Get-ItemPropertyValue -Path 'HKLM:\SOFTWARE\Microsoft\Cryptography' -Name 'MachineGuid')
  } catch {
    $machineGuid = [Environment]::MachineName
  }
  $base = "{0}|{1}|{2}" -f [Environment]::MachineName, [Environment]::OSVersion.VersionString, $machineGuid
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($base)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $hash = $sha.ComputeHash($bytes)
    return ([BitConverter]::ToString($hash)).Replace('-', '').ToLowerInvariant()
  } finally {
    $sha.Dispose()
  }
}

function Get-EvaluaProLicenseSecurityRoot {
  param([string]$RootDir = '')
  if (-not $RootDir) {
    $RootDir = Join-Path $env:ProgramData 'EvaluaPro\security'
  }
  if (-not (Test-Path $RootDir)) {
    New-Item -ItemType Directory -Path $RootDir -Force | Out-Null
  }
  return $RootDir
}

function New-RandomBytes {
  param([int]$Length = 32)
  $bytes = New-Object byte[] $Length
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return $bytes
}

function Protect-DpapiBytes {
  param(
    [byte[]]$Bytes,
    [byte[]]$Entropy
  )
  return [System.Security.Cryptography.ProtectedData]::Protect(
    $Bytes,
    $Entropy,
    [System.Security.Cryptography.DataProtectionScope]::LocalMachine
  )
}

function Unprotect-DpapiBytes {
  param(
    [byte[]]$Bytes,
    [byte[]]$Entropy
  )
  return [System.Security.Cryptography.ProtectedData]::Unprotect(
    $Bytes,
    $Entropy,
    [System.Security.Cryptography.DataProtectionScope]::LocalMachine
  )
}

function Get-OrCreate-EvaluaProSealKey {
  param([string]$RootDir = '')
  $root = Get-EvaluaProLicenseSecurityRoot -RootDir $RootDir
  $sealPath = Join-Path $root 'license.seal.key'
  $fingerprint = Get-EvaluaProMachineFingerprintHash
  $entropy = [System.Text.Encoding]::UTF8.GetBytes($fingerprint)
  if (Test-Path $sealPath) {
    $raw = Get-Content -Path $sealPath -Raw -Encoding utf8
    $cipher = [Convert]::FromBase64String($raw.Trim())
    return Unprotect-DpapiBytes -Bytes $cipher -Entropy $entropy
  }
  $sealKey = New-RandomBytes -Length 32
  $cipherOut = Protect-DpapiBytes -Bytes $sealKey -Entropy $entropy
  [IO.File]::WriteAllText($sealPath, [Convert]::ToBase64String($cipherOut), [System.Text.Encoding]::UTF8)
  return $sealKey
}

function Get-HmacSha256Hex {
  param(
    [byte[]]$Key,
    [string]$Data
  )
  $hmac = New-Object System.Security.Cryptography.HMACSHA256($Key)
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Data)
    $hash = $hmac.ComputeHash($bytes)
    return ([BitConverter]::ToString($hash)).Replace('-', '').ToLowerInvariant()
  } finally {
    $hmac.Dispose()
  }
}

function Save-EvaluaProSecureLicenseToken {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Token,
    [Parameter(Mandatory = $true)]
    [string]$TenantId,
    [string]$RootDir = '',
    [hashtable]$Meta
  )
  $root = Get-EvaluaProLicenseSecurityRoot -RootDir $RootDir
  $fingerprint = Get-EvaluaProMachineFingerprintHash
  $entropy = [System.Text.Encoding]::UTF8.GetBytes($fingerprint)
  $tokenBytes = [System.Text.Encoding]::UTF8.GetBytes($Token)
  $tokenCipher = Protect-DpapiBytes -Bytes $tokenBytes -Entropy $entropy
  $tokenHash = Get-HmacSha256Hex -Key ([System.Text.Encoding]::UTF8.GetBytes($fingerprint)) -Data $Token

  $payload = [ordered]@{
    version = 1
    tenantId = [string]$TenantId
    fingerprintHash = $fingerprint
    tokenCiphertext = [Convert]::ToBase64String($tokenCipher)
    tokenHash = $tokenHash
    createdAt = (Get-Date).ToString('o')
    meta = if ($Meta) { $Meta } else { @{} }
  }
  $payloadJson = $payload | ConvertTo-Json -Depth 8 -Compress
  $sealKey = Get-OrCreate-EvaluaProSealKey -RootDir $root
  $mac = Get-HmacSha256Hex -Key $sealKey -Data $payloadJson

  $envelope = [ordered]@{
    payload = $payload
    mac = $mac
  }
  $outPath = Join-Path $root 'license.secure.json'
  [IO.File]::WriteAllText($outPath, ($envelope | ConvertTo-Json -Depth 10), [System.Text.Encoding]::UTF8)
  return $outPath
}

function Get-EvaluaProSecureLicenseToken {
  param([string]$RootDir = '')
  $root = Get-EvaluaProLicenseSecurityRoot -RootDir $RootDir
  $path = Join-Path $root 'license.secure.json'
  if (-not (Test-Path $path)) {
    throw "No existe licencia segura: $path"
  }
  $json = Get-Content -Path $path -Raw -Encoding utf8 | ConvertFrom-Json
  $payload = $json.payload
  $payloadJson = $payload | ConvertTo-Json -Depth 8 -Compress
  $sealKey = Get-OrCreate-EvaluaProSealKey -RootDir $root
  $calc = Get-HmacSha256Hex -Key $sealKey -Data $payloadJson
  if ($calc -ne [string]$json.mac) {
    throw 'Envelope de licencia alterado (MAC invalido).'
  }

  $fingerprintNow = Get-EvaluaProMachineFingerprintHash
  if ([string]$payload.fingerprintHash -ne $fingerprintNow) {
    throw 'La licencia segura no pertenece a este equipo.'
  }

  $entropy = [System.Text.Encoding]::UTF8.GetBytes($fingerprintNow)
  $cipher = [Convert]::FromBase64String([string]$payload.tokenCiphertext)
  $plain = Unprotect-DpapiBytes -Bytes $cipher -Entropy $entropy
  return [System.Text.Encoding]::UTF8.GetString($plain)
}

function Register-EvaluaProIntegrityBaseline {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Paths,
    [string]$RootDir = ''
  )
  $root = Get-EvaluaProLicenseSecurityRoot -RootDir $RootDir
  $items = @()
  foreach ($p in $Paths) {
    if (-not (Test-Path $p)) { continue }
    $items += [ordered]@{
      path = [string]$p
      sha256 = Get-InstallerHubFileSha256 -Path $p
      size = [int64](Get-Item -LiteralPath $p).Length
    }
  }
  $payload = [ordered]@{
    version = 1
    createdAt = (Get-Date).ToString('o')
    items = $items
  }
  $payloadJson = $payload | ConvertTo-Json -Depth 8 -Compress
  $sealKey = Get-OrCreate-EvaluaProSealKey -RootDir $root
  $mac = Get-HmacSha256Hex -Key $sealKey -Data $payloadJson
  $baseline = [ordered]@{
    payload = $payload
    mac = $mac
  }
  $baselinePath = Join-Path $root 'integridad.baseline.json'
  [IO.File]::WriteAllText($baselinePath, ($baseline | ConvertTo-Json -Depth 10), [System.Text.Encoding]::UTF8)
  return $baselinePath
}

function Test-EvaluaProIntegrityBaseline {
  param([string]$RootDir = '')
  $root = Get-EvaluaProLicenseSecurityRoot -RootDir $RootDir
  $baselinePath = Join-Path $root 'integridad.baseline.json'
  if (-not (Test-Path $baselinePath)) {
    return [pscustomobject]@{ ok = $false; error = 'No existe baseline de integridad.'; cambios = @() }
  }
  $raw = Get-Content -Path $baselinePath -Raw -Encoding utf8 | ConvertFrom-Json
  $payloadJson = $raw.payload | ConvertTo-Json -Depth 8 -Compress
  $sealKey = Get-OrCreate-EvaluaProSealKey -RootDir $root
  $calc = Get-HmacSha256Hex -Key $sealKey -Data $payloadJson
  if ($calc -ne [string]$raw.mac) {
    return [pscustomobject]@{ ok = $false; error = 'Baseline alterado (MAC invalido).'; cambios = @() }
  }

  $changes = @()
  foreach ($item in @($raw.payload.items)) {
    $p = [string]$item.path
    if (-not (Test-Path $p)) {
      $changes += "Falta archivo: $p"
      continue
    }
    $shaNow = Get-InstallerHubFileSha256 -Path $p
    if ($shaNow -ne [string]$item.sha256) {
      $changes += "SHA distinto: $p"
    }
  }
  return [pscustomobject]@{
    ok = ($changes.Count -eq 0)
    error = if ($changes.Count -gt 0) { 'Se detectaron cambios de integridad.' } else { '' }
    cambios = $changes
  }
}

function Invoke-EvaluaProLicenseActivationSecure {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ApiBaseUrl,
    [Parameter(Mandatory = $true)]
    [string]$TenantId,
    [Parameter(Mandatory = $true)]
    [string]$CodigoActivacion,
    [Parameter(Mandatory = $true)]
    [string]$VersionInstalada,
    [string]$RootDir = ''
  )
  $uri = ('{0}/api/comercial-publico/licencias/activar' -f $ApiBaseUrl.TrimEnd('/'))
  $payload = @{
    tenantId = $TenantId
    codigoActivacion = $CodigoActivacion
    huella = Get-EvaluaProMachineFingerprintHash
    host = [Environment]::MachineName
    versionInstalada = $VersionInstalada
  }
  $resp = Invoke-RestMethod -Uri $uri -Method POST -Body ($payload | ConvertTo-Json -Depth 6) -ContentType 'application/json'
  $token = [string]$resp.licencia.tokenLicencia
  if (-not $token -or $token.Split('.').Count -ne 3) {
    throw 'Respuesta de activacion invalida: token de licencia ausente.'
  }
  $savePath = Save-EvaluaProSecureLicenseToken -Token $token -TenantId $TenantId -RootDir $RootDir -Meta @{
    canalRelease = [string]$resp.licencia.canalRelease
    expiraEn = [string]$resp.licencia.expiraEn
    graciaOfflineDias = [int]$resp.licencia.graciaOfflineDias
  }
  return [pscustomobject]@{
    ok = $true
    securePath = $savePath
    expiraEn = [string]$resp.licencia.expiraEn
    canalRelease = [string]$resp.licencia.canalRelease
  }
}

Export-ModuleMember -Function @(
  'Get-EvaluaProMachineFingerprintHash',
  'Get-EvaluaProLicenseSecurityRoot',
  'Save-EvaluaProSecureLicenseToken',
  'Get-EvaluaProSecureLicenseToken',
  'Register-EvaluaProIntegrityBaseline',
  'Test-EvaluaProIntegrityBaseline',
  'Invoke-EvaluaProLicenseActivationSecure'
)
