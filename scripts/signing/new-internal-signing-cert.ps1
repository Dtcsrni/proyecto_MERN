param(
  [string]$Subject = 'CN=EvaluaPro Internal Code Signing',
  [string]$OutputDir = '',
  [string]$PfxPassword = '',
  [int]$YearsValid = 2
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (-not $OutputDir) {
  $OutputDir = Join-Path $root 'dist\signing-internal'
}

if (-not (Test-Path $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

if ([string]::IsNullOrWhiteSpace($PfxPassword)) {
  $chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%*+-_'
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $bytes = New-Object byte[] 24
  $rng.GetBytes($bytes)
  $sb = New-Object System.Text.StringBuilder
  foreach ($b in $bytes) {
    [void]$sb.Append($chars[$b % $chars.Length])
  }
  $PfxPassword = $sb.ToString()
}

$securePassword = ConvertTo-SecureString -String $PfxPassword -AsPlainText -Force
$notAfter = (Get-Date).AddYears($YearsValid)

$cert = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject $Subject `
  -KeyAlgorithm RSA `
  -KeyLength 3072 `
  -HashAlgorithm SHA256 `
  -CertStoreLocation 'Cert:\CurrentUser\My' `
  -NotAfter $notAfter `
  -FriendlyName 'EvaluaPro Internal Signing'

if (-not $cert) {
  throw 'No se pudo generar certificado interno de firma.'
}

$thumbprint = [string]$cert.Thumbprint
$pfxPath = Join-Path $OutputDir 'evaluapro-internal-signing.pfx'
$cerPath = Join-Path $OutputDir 'evaluapro-internal-signing.cer'
$metaPath = Join-Path $OutputDir 'evaluapro-internal-signing.meta.json'
$secretsPath = Join-Path $OutputDir 'github-secrets.internal-signing.env'

Export-PfxCertificate -Cert ("Cert:\CurrentUser\My\" + $thumbprint) -FilePath $pfxPath -Password $securePassword | Out-Null
Export-Certificate -Cert ("Cert:\CurrentUser\My\" + $thumbprint) -FilePath $cerPath | Out-Null

$pfxBase64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($pfxPath))

@(
  ('EVALUAPRO_SIGN_CERT_BASE64=' + $pfxBase64)
  ('EVALUAPRO_SIGN_CERT_PASSWORD=' + $PfxPassword)
  'EVALUAPRO_SIGN_TIMESTAMP_URL=http://timestamp.digicert.com'
) | Set-Content -Path $secretsPath -Encoding ascii

$meta = [ordered]@{
  subject = $Subject
  thumbprint = $thumbprint
  notAfter = $cert.NotAfter.ToString('yyyy-MM-ddTHH:mm:ssK')
  output = [ordered]@{
    pfx = $pfxPath
    cer = $cerPath
    githubSecretsEnv = $secretsPath
  }
}

$meta | ConvertTo-Json -Depth 6 | Set-Content -Path $metaPath -Encoding utf8

Write-Host ('[internal-signing] Certificado generado: ' + $thumbprint)
Write-Host ('[internal-signing] PFX: ' + $pfxPath)
Write-Host ('[internal-signing] CER: ' + $cerPath)
Write-Host ('[internal-signing] Secrets env: ' + $secretsPath)
Write-Host '[internal-signing] Importa el CER en equipos del piloto para confianza local.'
