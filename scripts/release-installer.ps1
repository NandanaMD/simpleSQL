param(
  [ValidateSet('patch', 'minor', 'major')]
  [string]$Bump = 'patch',
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Write-Step {
  param([string]$Message)
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Run-Cmd {
  param([string]$Command)

  if ($DryRun) {
    Write-Host "[dry-run] $Command" -ForegroundColor Yellow
    return
  }

  cmd /c $Command
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $Command"
  }
}

function Get-RootVersion {
  $version = node -p "require('./package.json').version"
  if ($LASTEXITCODE -ne 0) {
    throw 'Failed to read version from package.json'
  }
  return $version.Trim()
}

function Get-NextVersion {
  param(
    [string]$Current,
    [string]$Part
  )

  $parts = $Current.Split('.')
  if ($parts.Length -ne 3) {
    throw "Unsupported semver format: $Current"
  }

  $major = [int]$parts[0]
  $minor = [int]$parts[1]
  $patch = [int]$parts[2]

  switch ($Part) {
    'major' { return "$($major + 1).0.0" }
    'minor' { return "$major.$($minor + 1).0" }
    default { return "$major.$minor.$($patch + 1)" }
  }
}

function Get-GitHubRepo {
  $originUrl = git remote get-url origin
  if ($LASTEXITCODE -ne 0) {
    throw 'Failed to read git origin remote URL'
  }

  $originUrl = $originUrl.Trim()
  $match = [regex]::Match($originUrl, 'github\.com[:/](?<owner>[^/]+)/(?<repo>[^/.]+)(\.git)?$')
  if (-not $match.Success) {
    throw "Could not parse GitHub owner/repo from origin URL: $originUrl"
  }

  return @{
    Owner = $match.Groups['owner'].Value
    Repo = $match.Groups['repo'].Value
  }
}

function New-GitHubRelease {
  param(
    [string]$Owner,
    [string]$Repo,
    [string]$Tag,
    [string]$Name,
    [string]$Body,
    [string]$Token
  )

  $headers = @{
    Authorization = "Bearer $Token"
    Accept = 'application/vnd.github+json'
    'X-GitHub-Api-Version' = '2022-11-28'
  }

  $payload = @{
    tag_name = $Tag
    name = $Name
    body = $Body
    draft = $false
    prerelease = $false
  } | ConvertTo-Json

  $url = "https://api.github.com/repos/$Owner/$Repo/releases"
  return Invoke-RestMethod -Method Post -Uri $url -Headers $headers -ContentType 'application/json' -Body $payload
}

function Upload-GitHubReleaseAsset {
  param(
    [string]$UploadUrl,
    [string]$AssetPath,
    [string]$Token
  )

  $assetName = [System.IO.Path]::GetFileName($AssetPath)
  $cleanUploadUrl = $UploadUrl -replace '\{\?name,label\}$', ''
  $uri = "${cleanUploadUrl}?name=$([uri]::EscapeDataString($assetName))"

  $headers = @{
    Authorization = "Bearer $Token"
    Accept = 'application/vnd.github+json'
    'X-GitHub-Api-Version' = '2022-11-28'
  }

  $bytes = [System.IO.File]::ReadAllBytes($AssetPath)
  Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -ContentType 'application/octet-stream' -Body $bytes | Out-Null
}

Write-Step 'Checking git working tree'
$gitStatus = git status --porcelain
if ($LASTEXITCODE -ne 0) {
  throw 'Failed to read git status'
}
if ((-not [string]::IsNullOrWhiteSpace($gitStatus)) -and (-not $DryRun)) {
  throw 'Working tree is not clean. Commit or stash changes first.'
}

Write-Step 'Checking GitHub release credentials'
if ((-not $DryRun) -and [string]::IsNullOrWhiteSpace($env:GH_TOKEN)) {
  throw 'GH_TOKEN is missing. Set it in this terminal session before running release.'
}

$currentVersion = Get-RootVersion
$nextVersion = Get-NextVersion -Current $currentVersion -Part $Bump
$tag = "v$nextVersion"
$repoInfo = Get-GitHubRepo

Write-Host "Current version: v$currentVersion"
Write-Host "Next version:    $tag"

Write-Step 'Bumping version'
Run-Cmd "npm version $Bump --no-git-tag-version"

Write-Step 'Building Windows installer'
Run-Cmd "npm run package:win"

Write-Step 'Locating installer artifact'
$installerGlob = "SimpleSQL Setup $nextVersion*.exe"
$installer = Get-ChildItem -Path "dist-installer" -Filter $installerGlob -File -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $installer -and -not $DryRun) {
  throw "Installer not found. Expected dist-installer/$installerGlob"
}

$latestYmlPath = Resolve-Path "dist-installer/latest.yml" -ErrorAction SilentlyContinue

Write-Step 'Committing release version files'
Run-Cmd "git add package.json package-lock.json"
Run-Cmd "git commit -m \"release: $tag\""

Write-Step 'Pushing commit and tag'
Run-Cmd "git push origin HEAD"
Run-Cmd "git tag $tag"
Run-Cmd "git push origin $tag"

Write-Step 'Creating GitHub release and uploading assets'
if ($DryRun) {
  $assetInfo = @("dist-installer/$installerGlob", "dist-installer/latest.yml") -join ', '
  Write-Host "[dry-run] POST /repos/$($repoInfo.Owner)/$($repoInfo.Repo)/releases (tag: $tag)"
  Write-Host "[dry-run] upload assets: $assetInfo"
} else {
  $assets = @($installer.FullName)
  if ($latestYmlPath) {
    $assets += $latestYmlPath.Path
  }

  $release = New-GitHubRelease -Owner $repoInfo.Owner -Repo $repoInfo.Repo -Tag $tag -Name "SimpleSQL $tag" -Body "Automated release for $tag" -Token $env:GH_TOKEN
  foreach ($asset in $assets) {
    Upload-GitHubReleaseAsset -UploadUrl $release.upload_url -AssetPath $asset -Token $env:GH_TOKEN
  }
}

Write-Host "`nRelease completed successfully: $tag" -ForegroundColor Green
