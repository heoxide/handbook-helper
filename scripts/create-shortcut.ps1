$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$package = Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json
$version = $package.version
$productName = 'Handbook Helper'

$releaseDir = Join-Path $root 'release'
$portableExe = Join-Path $releaseDir "$productName $version.exe"
$unpackedExe = Join-Path (Join-Path $releaseDir 'win-unpacked') "$productName.exe"
$installedExe = Join-Path (Join-Path $env:LOCALAPPDATA "Programs\$productName") "$productName.exe"

if (Test-Path $portableExe) {
  $target = $portableExe
} elseif (Test-Path $unpackedExe) {
  $target = $unpackedExe
} elseif (Test-Path $installedExe) {
  $target = $installedExe
} else {
  Write-Error "Could not find Handbook Helper executable. Run 'npm run dist' first."
}

$wsh = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$startMenu = Join-Path ([Environment]::GetFolderPath('StartMenu')) "Programs\$productName"

New-Item -ItemType Directory -Force -Path $startMenu | Out-Null

function New-AppShortcut($path) {
  $shortcut = $wsh.CreateShortcut($path)
  $shortcut.TargetPath = $target
  $shortcut.WorkingDirectory = Split-Path $target -Parent
  $shortcut.IconLocation = "$target,0"
  $shortcut.Description = 'Handbook Helper — D&D 5e companion'
  $shortcut.Save()
}

New-AppShortcut (Join-Path $desktop "$productName.lnk")
New-AppShortcut (Join-Path $startMenu "$productName.lnk")

Write-Host "Shortcuts created:"
Write-Host "  Desktop: $desktop\$productName.lnk"
Write-Host "  Start Menu: $startMenu\$productName.lnk"
Write-Host "Target: $target"
