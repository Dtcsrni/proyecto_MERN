param(
  [string]$OutputDir = '',
  [string]$TargetName = 'EvaluaPro-InstallerHub.exe'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not $OutputDir) {
  $OutputDir = Join-Path $root 'dist\\installer'
}

if (-not (Test-Path $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$payloadRoot = Join-Path $OutputDir 'installer-hub-payload'
if (Test-Path $payloadRoot) {
  Remove-Item -LiteralPath $payloadRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $payloadRoot -Force | Out-Null

$sourceScript = Join-Path $root 'scripts\\installer-hub\\InstallerHub.ps1'
if (-not (Test-Path $sourceScript)) {
  throw "No existe script fuente: $sourceScript"
}

Copy-Item -Path $sourceScript -Destination (Join-Path $payloadRoot 'installer-hub.ps1') -Force

$moduleFiles = Get-ChildItem -Path (Join-Path $root 'scripts\\installer-hub\\modules') -Filter '*.psm1' -File
foreach ($module in $moduleFiles) {
  Copy-Item -Path $module.FullName -Destination (Join-Path $payloadRoot $module.Name) -Force
}

$prereqManifest = Join-Path $root 'config\\installer-prereqs.manifest.json'
if (-not (Test-Path $prereqManifest)) {
  throw "No existe manifiesto prerequisitos: $prereqManifest"
}
Copy-Item -Path $prereqManifest -Destination (Join-Path $payloadRoot 'installer-prereqs.manifest.json') -Force

$payloadFiles = Get-ChildItem -Path $payloadRoot -File | Sort-Object Name
if ($payloadFiles.Count -eq 0) {
  throw 'No hay archivos para empaquetar en Installer Hub.'
}

$strings = @()
$sourceEntries = @()
$idx = 0
foreach ($file in $payloadFiles) {
  $key = "FILE$idx"
  $strings += "$key=$($file.Name)"
  $sourceEntries += "%$key%="
  $idx += 1
}

$targetPath = Join-Path $OutputDir $TargetName
$sedPath = Join-Path $OutputDir 'installer-hub.sed'

$sedContent = @"
[Version]
Class=IEXPRESS
SEDVersion=3
[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=0
HideExtractAnimation=1
UseLongFileName=1
InsideCompressed=1
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=N
InstallPrompt=
DisplayLicense=
FinishMessage=
TargetName=$targetPath
FriendlyName=EvaluaPro Installer Hub
AppLaunched=powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File installer-hub.ps1
PostInstallCmd=<None>
AdminQuietInstCmd=
UserQuietInstCmd=
SourceFiles=SourceFiles
[SourceFiles]
SourceFiles0=$payloadRoot\\
[SourceFiles0]
$($sourceEntries -join "`r`n")
[Strings]
$($strings -join "`r`n")
"@

$sedContent | Set-Content -Path $sedPath -Encoding ascii

$iexpress = Get-Command iexpress.exe -ErrorAction SilentlyContinue
if (-not $iexpress) {
  throw 'No se encontro iexpress.exe en el sistema.'
}

Write-Host "[installer-hub] Compilando EXE con IExpress..."
$proc = Start-Process -FilePath $iexpress.Source -ArgumentList @('/N', '/Q', $sedPath) -PassThru -Wait
if ([int]$proc.ExitCode -ne 0) {
  throw "IExpress fallo con codigo $($proc.ExitCode)"
}

if (-not (Test-Path $targetPath)) {
  throw "No se genero artefacto esperado: $targetPath"
}

Write-Host "[installer-hub] Artefacto generado: $targetPath"
