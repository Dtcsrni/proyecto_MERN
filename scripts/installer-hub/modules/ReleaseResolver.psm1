Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'Common.psm1') -DisableNameChecking

function ConvertTo-SemverKey {
  param([string]$Version)

  $clean = [string]$Version
  $clean = $clean.Trim().TrimStart('v', 'V')
  $match = [Regex]::Match($clean, '^(?<maj>\d+)\.(?<min>\d+)\.(?<pat>\d+)(?<rest>.*)$')
  if (-not $match.Success) {
    return [pscustomobject]@{ valid = $false; major = 0; minor = 0; patch = 0; prerelease = $true }
  }

  $rest = [string]$match.Groups['rest'].Value
  return [pscustomobject]@{
    valid = $true
    major = [int]$match.Groups['maj'].Value
    minor = [int]$match.Groups['min'].Value
    patch = [int]$match.Groups['pat'].Value
    prerelease = ($rest -match '-')
  }
}

function Compare-Semver {
  param([string]$Left, [string]$Right)

  $a = ConvertTo-SemverKey -Version $Left
  $b = ConvertTo-SemverKey -Version $Right
  if (-not $a.valid -and -not $b.valid) { return 0 }
  if (-not $a.valid) { return -1 }
  if (-not $b.valid) { return 1 }

  if ($a.major -ne $b.major) { return [Math]::Sign($a.major - $b.major) }
  if ($a.minor -ne $b.minor) { return [Math]::Sign($a.minor - $b.minor) }
  if ($a.patch -ne $b.patch) { return [Math]::Sign($a.patch - $b.patch) }

  if ($a.prerelease -eq $b.prerelease) { return 0 }
  if (-not $a.prerelease -and $b.prerelease) { return 1 }
  return -1
}

function Get-LatestStableReleaseAssets {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Owner,
    [Parameter(Mandatory = $true)]
    [string]$Repo,
    [string]$MsiAssetName = 'EvaluaPro.msi',
    [string]$MsiShaAssetName = 'EvaluaPro.msi.sha256',
    [scriptblock]$OnLog
  )

  if ($OnLog) { & $OnLog 'info' "Consultando releases de GitHub: $Owner/$Repo" }

  $url = "https://api.github.com/repos/$Owner/$Repo/releases"
  $headers = @{ 'User-Agent' = 'EvaluaPro-InstallerHub'; 'Accept' = 'application/vnd.github+json' }
  $response = Invoke-InstallerHubWebRequest -Url $url -Method GET -Headers $headers -TimeoutSec 25 -RetryCount 2
  $releases = $response.Content | ConvertFrom-Json

  $candidates = @()
  foreach ($release in $releases) {
    if ($release.draft -or $release.prerelease) { continue }

    $tag = [string]$release.tag_name
    $sem = ConvertTo-SemverKey -Version $tag
    if (-not $sem.valid) { continue }

    $assets = @($release.assets)
    $msi = $assets | Where-Object { [string]$_.name -eq $MsiAssetName } | Select-Object -First 1
    $sha = $assets | Where-Object { [string]$_.name -eq $MsiShaAssetName } | Select-Object -First 1

    if (-not $msi -or -not $sha) { continue }

    $candidates += [pscustomobject]@{
      tag = $tag.TrimStart('v', 'V')
      publishedAt = [string]$release.published_at
      msiUrl = [string]$msi.browser_download_url
      shaUrl = [string]$sha.browser_download_url
      releaseUrl = [string]$release.html_url
    }
  }

  if ($candidates.Count -eq 0) {
    throw 'No se encontro release estable con assets EvaluaPro.msi y EvaluaPro.msi.sha256.'
  }

  $latest = $candidates[0]
  foreach ($candidate in $candidates) {
    if ((Compare-Semver -Left $candidate.tag -Right $latest.tag) -gt 0) {
      $latest = $candidate
    }
  }

  if ($OnLog) { & $OnLog 'ok' "Release estable seleccionada: v$($latest.tag)" }
  return $latest
}

function Download-VerifiedMsiPackage {
  param(
    [Parameter(Mandatory = $true)]
    [pscustomobject]$Release,
    [Parameter(Mandatory = $true)]
    [string]$DestinationDir,
    [string]$MsiFileName = 'EvaluaPro.msi',
    [scriptblock]$OnLog
  )

  if (-not (Test-Path $DestinationDir)) {
    New-Item -ItemType Directory -Path $DestinationDir -Force | Out-Null
  }

  $msiPath = Join-Path $DestinationDir $MsiFileName
  $shaPath = Join-Path $DestinationDir ($MsiFileName + '.sha256')

  if ($OnLog) { & $OnLog 'info' 'Descargando MSI de release estable...' }
  Invoke-InstallerHubDownloadFile -Url $Release.msiUrl -Destination $msiPath -RetryCount 2

  if ($OnLog) { & $OnLog 'info' 'Descargando hash SHA256 de MSI...' }
  Invoke-InstallerHubDownloadFile -Url $Release.shaUrl -Destination $shaPath -RetryCount 2

  $expectedText = Get-Content -Path $shaPath -Raw -Encoding utf8
  $expected = Resolve-InstallerHubSha256FromText -Text $expectedText -Pattern $MsiFileName
  if (-not $expected) {
    throw 'No se pudo resolver SHA256 esperado para EvaluaPro.msi.'
  }

  $actual = Get-InstallerHubFileSha256 -Path $msiPath
  if ($actual -ne $expected) {
    Remove-Item -LiteralPath $msiPath -Force -ErrorAction SilentlyContinue
    throw 'SHA256 del MSI no coincide con release estable.'
  }

  if ($OnLog) { & $OnLog 'ok' 'MSI descargado y verificado con SHA256.' }

  return [pscustomobject]@{
    msiPath = $msiPath
    expectedSha256 = $expected
    actualSha256 = $actual
    release = $Release
  }
}

Export-ModuleMember -Function @(
  'Get-LatestStableReleaseAssets',
  'Download-VerifiedMsiPackage'
)
