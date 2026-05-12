# Manual Kind Installation Script
# This script downloads and installs Kind manually

Write-Host "Downloading Kind for Windows..." -ForegroundColor Cyan

# Create temp directory
$tempDir = "$env:TEMP\kind-install"
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

# Kind download URL (latest version)
$kindVersion = "v0.20.0"
$kindUrl = "https://kind.sigs.k8s.io/dl/$kindVersion/kind-windows-amd64"
$kindExePath = "$tempDir\kind.exe"

try {
    Write-Host "Downloading from: $kindUrl" -ForegroundColor Yellow
    
    # Download Kind
    Invoke-WebRequest -Uri $kindUrl -OutFile $kindExePath -UseBasicParsing
    
    Write-Host "Downloaded successfully!" -ForegroundColor Green
    
    # Check if Kind was downloaded
    if (Test-Path $kindExePath) {
        # Determine installation location
        $installPath = "$env:LOCALAPPDATA\kind"
        New-Item -ItemType Directory -Force -Path $installPath | Out-Null
        
        # Copy to installation directory
        Copy-Item -Path $kindExePath -Destination "$installPath\kind.exe" -Force
        
        # Add to PATH for current session
        $env:Path += ";$installPath"
        
        Write-Host "`nKind installed to: $installPath" -ForegroundColor Green
        
        # Verify installation
        Write-Host "`nVerifying installation..." -ForegroundColor Cyan
        & "$installPath\kind.exe" version
        
        Write-Host "`nNote: To make Kind available permanently, add this to your PATH:" -ForegroundColor Yellow
        Write-Host "  $installPath" -ForegroundColor White
        Write-Host "`nOr run this command (requires admin):" -ForegroundColor Yellow
        Write-Host "  [Environment]::SetEnvironmentVariable('Path', `$env:Path + ';$installPath', [EnvironmentVariableTarget]::User)" -ForegroundColor White
        
        Write-Host "`nInstallation complete!" -ForegroundColor Green
        
    } else {
        Write-Host "Download failed!" -ForegroundColor Red
        exit 1
    }
    
} catch {
    Write-Host "Error installing Kind: $_" -ForegroundColor Red
    Write-Host "`nPlease download manually from: https://github.com/kubernetes-sigs/kind/releases" -ForegroundColor Yellow
    exit 1
} finally {
    # Cleanup temp directory
    if (Test-Path $tempDir) {
        Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
    }
}

