param(
    [switch]$Clean,
    [switch]$Debug,
    [switch]$Zip
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

function Info($msg) {
    Write-Host ""
    Write-Host "==> $msg" -ForegroundColor Cyan
}

function Copy-Dir($src, $dst) {
    if (Test-Path $dst) {
        Remove-Item $dst -Recurse -Force
    }
    Copy-Item $src $dst -Recurse -Force
}

$VenvPython = Join-Path $Root ".venv\Scripts\python.exe"
if (Test-Path $VenvPython) {
    $Python = $VenvPython
} else {
    $Python = "python"
}

Info "Using Python: $Python"

if ($Clean) {
    Info "Cleaning build artifacts"
    Remove-Item "$Root\build" -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item "$Root\dist" -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item "$Root\release" -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item "$Root\*.spec" -Force -ErrorAction SilentlyContinue
}

Info "Installing dependencies"
& $Python -m pip install -r requirements.txt

if (Test-Path "$Root\requirements-dev.txt") {
    & $Python -m pip install -r requirements-dev.txt
} else {
    & $Python -m pip install pyinstaller
}

Info "Building GUI executable"

$GuiArgs = @(
    "-m", "PyInstaller",
    "--noconfirm",
    "--clean",
    "--onedir",
    "--name", "YukkuriCN"
)

if ($Debug) {
    $GuiArgs += "--console"
} else {
    $GuiArgs += "--noconsole"
}

$GuiArgs += "ykcn_gui.py"

& $Python @GuiArgs

Info "Building CLI executable"

& $Python -m PyInstaller `
    --noconfirm `
    --clean `
    --onedir `
    --console `
    --name ykcn `
    ykcn_cli.py

Info "Building player installer executable"

& $Python -m PyInstaller `
    --noconfirm `
    --clean `
    --onefile `
    --console `
    --name install_player `
    install_player.py

$GuiDir = Join-Path $Root "dist\YukkuriCN"
$CliDir = Join-Path $Root "dist\ykcn"

if (!(Test-Path $GuiDir)) {
    throw "GUI build output not found: $GuiDir"
}

if (!(Test-Path $CliDir)) {
    throw "CLI build output not found: $CliDir"
}

Info "Copying external resources to GUI distribution"

Copy-Dir "$Root\dictionaries" "$GuiDir\dictionaries"

if (Test-Path "$Root\config.example.json") {
    Copy-Item "$Root\config.example.json" "$GuiDir\config.example.json" -Force
}

if (Test-Path "$Root\docs\README.txt") {
    Copy-Item "$Root\docs\README.txt" "$GuiDir\README.txt" -Force
}

$InstallerExe = Join-Path $Root "dist\install_player.exe"
if (Test-Path $InstallerExe) {
    Copy-Item $InstallerExe "$GuiDir\install_player.exe" -Force
} else {
    throw "install_player.exe not found: $InstallerExe"
}

# Put console CLI next to GUI exe for advanced users.
$CliExe = Join-Path $CliDir "ykcn.exe"
if (Test-Path $CliExe) {
    Copy-Item $CliExe "$GuiDir\ykcn.exe" -Force
} else {
    throw "ykcn.exe not found: $CliExe"
}

# If PyInstaller created an _internal dir for CLI with needed runtime files,
# copying only ykcn.exe may not be enough for one-folder builds.
# For safety, also copy CLI _internal if it exists and differs.
$CliInternal = Join-Path $CliDir "_internal"
$GuiInternal = Join-Path $GuiDir "_internal"

if (Test-Path $CliInternal) {
    Info "Merging CLI _internal runtime files"
    Copy-Item "$CliInternal\*" "$GuiInternal" -Recurse -Force
}

New-Item "$GuiDir\output" -ItemType Directory -Force | Out-Null
New-Item "$GuiDir\third_party" -ItemType Directory -Force | Out-Null

Info "Removing user-local files from release folder"
Remove-Item "$GuiDir\config.json" -Force -ErrorAction SilentlyContinue
Remove-Item "$GuiDir\history.jsonl" -Force -ErrorAction SilentlyContinue

if ($Zip) {
    Info "Creating release zip"

    $ReleaseDir = Join-Path $Root "release"
    New-Item $ReleaseDir -ItemType Directory -Force | Out-Null

    $ZipPath = Join-Path $ReleaseDir "YukkuriCN.zip"
    Remove-Item $ZipPath -Force -ErrorAction SilentlyContinue

    Compress-Archive -Path "$GuiDir\*" -DestinationPath $ZipPath

    Write-Host ""
    Write-Host "Release zip created:" -ForegroundColor Green
    Write-Host $ZipPath
}

Write-Host ""
Write-Host "Build finished." -ForegroundColor Green
Write-Host "Output folder:"
Write-Host $GuiDir
Write-Host ""
Write-Host "Test GUI:"
Write-Host "  dist\YukkuriCN\YukkuriCN.exe"
Write-Host ""
Write-Host "Test CLI:"
Write-Host "  dist\YukkuriCN\ykcn.exe batch input.txt --dry-run"
