<#
.SYNOPSIS
  Create a safe Kincstarto source snapshot for ZIP-based assistant development.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\create-main-zip.ps1
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\create-main-zip.ps1 -Mode Full
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\create-main-zip.ps1 -Mode Custom -Paths "src/features/meditations;src/app/meditations/page.tsx;public/audio/accent"
#>
[CmdletBinding()]
param(
  [ValidateSet("Base", "Full", "Custom")]
  [string]$Mode = "Base",
  [string]$Paths = "",
  [string]$Destination = ""
)

$ErrorActionPreference = "Stop"
$repoRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot)).TrimEnd([char[]]@('\', '/'))
$selected = @{}

# Treat ZIP contents as source files, not a dump of the local machine.
$excludedDirectories = @(
  ".git", "node_modules", ".next", ".vercel", ".turbo", ".cache",
  "coverage", "out", "build", "dist", "tmp", "temp", "__pycache__", "private", "secrets"
)
$excludedFiles = @(
  ".DS_Store", "Thumbs.db", "next-env.d.ts", ".npmrc", ".netrc", ".pypirc",
  "id_rsa", "id_ed25519", "secrets.json", "credentials.json", "tokens.json",
  "service-account.json", "data/body/activity-logs.json"
)
$excludedExtensions = @(".zip", ".7z", ".tar", ".gz", ".pem", ".key", ".p12", ".pfx", ".sqlite", ".sqlite3", ".db", ".log", ".tsbuildinfo")
$baseExcludedFolders = @("public/audio", "public/backgrounds", "public/yogi")

function Test-Excluded([string]$relativePath) {
  $relative = $relativePath.Replace('\', '/').TrimStart('/')
  $parts = @($relative.Split('/'))
  foreach ($part in $parts) {
    if ($excludedDirectories -contains $part) { return $true }
  }

  $filename = $parts[$parts.Count - 1]
  if ($filename -like ".env*" -or $filename -like "*.local" -or $filename -like "*.local.*") { return $true }
  if ($filename -like "*.bak" -or $filename -like "*.tmp" -or $filename -like "*~") { return $true }
  if ($filename -like "*.secret.*" -or $filename -like "*.credentials.*" -or $filename -like "*secret.json" -or $filename -like "*credentials.json") { return $true }
  if ($excludedExtensions -contains [System.IO.Path]::GetExtension($filename)) { return $true }
  if ($excludedFiles -contains $relative) { return $true }

  if ($Mode -eq "Base") {
    foreach ($folder in $baseExcludedFolders) {
      if ($relative.StartsWith("$folder/", [System.StringComparison]::OrdinalIgnoreCase)) { return $true }
    }
  }
  return $false
}

function Add-ItemRecursively([System.IO.FileSystemInfo]$item) {
  # Never follow junctions/symlinks out of the repository.
  if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { return }

  $relative = $item.FullName.Substring($repoRoot.Length).TrimStart([char[]]@('\', '/')).Replace('\', '/')
  if (Test-Excluded $relative) { return }

  if ($item -is [System.IO.DirectoryInfo]) {
    foreach ($child in (Get-ChildItem -LiteralPath $item.FullName -Force -ErrorAction Stop)) {
      Add-ItemRecursively $child
    }
  } elseif ($item -is [System.IO.FileInfo]) {
    $selected[$relative] = $item.FullName
  }
}

function Add-RelativePath([string]$path) {
  $path = $path.Trim().Replace('\', '/')
  if ([string]::IsNullOrWhiteSpace($path) -or $path -eq ".") {
    throw "Choose specific repository paths; the repository root is not a valid selection."
  }
  if ([System.IO.Path]::IsPathRooted($path) -or @($path.Split('/')) -contains "..") {
    throw "Only repository-relative paths without '..' are allowed: $path"
  }

  # Reject an explicit path reached through a symlink/junction ancestor.
  $walk = $repoRoot
  foreach ($segment in @($path.Split('/') | Where-Object { $_ -ne "" -and $_ -ne "." })) {
    $walk = Join-Path $walk $segment
    if (Test-Path -LiteralPath $walk) {
      $ancestor = Get-Item -LiteralPath $walk -Force
      if (($ancestor.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Symlink/junction paths are not permitted: $path"
      }
    }
  }
  $fullPath = [System.IO.Path]::GetFullPath((Join-Path $repoRoot $path))
  $rootPrefix = $repoRoot + [System.IO.Path]::DirectorySeparatorChar
  if (-not $fullPath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Path escapes repository: $path"
  }
  if (-not (Test-Path -LiteralPath $fullPath)) {
    throw "Selected path does not exist: $path"
  }
  $item = Get-Item -LiteralPath $fullPath -Force -ErrorAction Stop
  if (Test-Excluded $path) { throw "Selected path is excluded for safety or by the current mode: $path" }
  Add-ItemRecursively $item
}

try {
  $required = @(
    "src", "data", "public", "scripts", "docs", "AGENTS.md",
    "docs/HANDOFF.md", "docs/DEVELOPMENT_WORKFLOW.md",
    "package.json", "package-lock.json"
  )
  foreach ($requiredPath in $required) {
    if (-not (Test-Path -LiteralPath (Join-Path $repoRoot $requiredPath))) {
      throw "Missing required project path: $requiredPath. Apply the full workflow patch first."
    }
  }

  if ([string]::IsNullOrWhiteSpace($Destination)) {
    switch ($Mode) {
      "Base"   { $Destination = "kincstarto-main.zip" }
      "Full"   { $Destination = "kincstarto-full.zip" }
      "Custom" { $Destination = "kincstarto-custom.zip" }
    }
  }
  if ([System.IO.Path]::GetExtension($Destination) -ine ".zip") {
    throw "Destination must end in .zip"
  }
  if ([System.IO.Path]::IsPathRooted($Destination)) {
    $destinationPath = [System.IO.Path]::GetFullPath($Destination)
  } else {
    $destinationPath = [System.IO.Path]::GetFullPath((Join-Path $repoRoot $Destination))
  }
  $parent = [System.IO.Path]::GetDirectoryName($destinationPath)
  if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
    throw "Destination directory does not exist: $parent"
  }

  if ($Mode -eq "Custom") {
    if ([string]::IsNullOrWhiteSpace($Paths)) {
      throw "Custom mode requires -Paths with semicolon-separated repository-relative paths."
    }
    # Keep the assistant operating contract available even for small focused bundles.
    foreach ($path in @("AGENTS.md", "docs/HANDOFF.md", "docs/DEVELOPMENT_WORKFLOW.md")) {
      Add-RelativePath $path
    }
    foreach ($path in @($Paths.Split(';') | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" })) {
      Add-RelativePath $path
    }
  } else {
    if (-not [string]::IsNullOrWhiteSpace($Paths)) {
      throw "-Paths may only be specified together with -Mode Custom."
    }
    $roots = @(
      "src", "data", "public", "docs", "scripts", "AGENTS.md", "SPEC.md", "DECISIONS.md",
      "package.json", "package-lock.json", "tsconfig.json", "next.config.ts",
      ".gitattributes", ".gitignore", "README.md", "eslint.config.mjs",
      "postcss.config.mjs", "vitest.config.mts", "vercel.json"
    )
    if ($Mode -eq "Full") { $roots += "TICKETS" }
    foreach ($path in $roots) {
      if (Test-Path -LiteralPath (Join-Path $repoRoot $path)) {
        Add-RelativePath $path
      }
    }
  }

  $files = @($selected.Keys | Sort-Object)
  if ($files.Count -eq 0) { throw "No files selected for ZIP." }
  $temporaryPath = "$destinationPath.tmp"

  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  if (Test-Path -LiteralPath $temporaryPath) { Remove-Item -LiteralPath $temporaryPath -Force }

  try {
    $archive = [System.IO.Compression.ZipFile]::Open($temporaryPath, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
      foreach ($relative in $files) {
        [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
          $archive, $selected[$relative], $relative, [System.IO.Compression.CompressionLevel]::Optimal
        )
      }
    } finally {
      $archive.Dispose()
    }

    if (Test-Path -LiteralPath $destinationPath) {
      Remove-Item -LiteralPath $destinationPath -Force
    }
    Move-Item -LiteralPath $temporaryPath -Destination $destinationPath
  } finally {
    if (Test-Path -LiteralPath $temporaryPath) { Remove-Item -LiteralPath $temporaryPath -Force }
  }

  $sizeMb = [math]::Round((Get-Item -LiteralPath $destinationPath).Length / 1MB, 2)
  Write-Host "`nOK: Kincstarto assistant ZIP created ($Mode)." -ForegroundColor Green
  Write-Host "Path: $destinationPath"
  Write-Host "Files: $($files.Count) | Size: $sizeMb MB"
  Write-Host "Review the ZIP before sharing; automatic exclusions do not replace a privacy check."
} catch {
  Write-Host "`nSTOP: Could not create Kincstarto assistant ZIP." -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
}
