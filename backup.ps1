# BMS Backup Script
# Creates a timestamped backup of the project excluding dependencies

param(
    [string]$BackupPath = "",
    [switch]$IncludeDatabase = $false,
    [switch]$Compress = $true
)

# Get the script directory (project root)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# Create backup directory name with timestamp
$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$BackupName = "bms_backup_$Timestamp"

# Set backup destination
if ([string]::IsNullOrEmpty($BackupPath)) {
    $BackupPath = Join-Path $env:USERPROFILE "Desktop"
}

$BackupDir = Join-Path $BackupPath $BackupName

# Create backup directory
Write-Host "Creating backup directory: $BackupDir" -ForegroundColor Green
New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null

# Function to copy files excluding patterns
function Copy-Excluding {
    param(
        [string]$Source,
        [string]$Destination,
        [string[]]$ExcludePatterns
    )
    
    if (-not (Test-Path $Source)) {
        Write-Host "Warning: Source path not found: $Source" -ForegroundColor Yellow
        return
    }
    
    $SourceItem = Get-Item $Source
    $DestPath = Join-Path $Destination $SourceItem.Name
    
    if ($SourceItem.PSIsContainer) {
        # It's a directory
        New-Item -ItemType Directory -Path $DestPath -Force | Out-Null
        
        Get-ChildItem -Path $Source -Recurse -File | ForEach-Object {
            $RelativePath = $_.FullName.Substring($Source.Length + 1)
            $ShouldExclude = $false
            
            foreach ($Pattern in $ExcludePatterns) {
                if ($RelativePath -like $Pattern -or $_.FullName -like $Pattern) {
                    $ShouldExclude = $true
                    break
                }
            }
            
            if (-not $ShouldExclude) {
                $DestFile = Join-Path $DestPath $RelativePath
                $DestFileDir = Split-Path -Parent $DestFile
                if (-not (Test-Path $DestFileDir)) {
                    New-Item -ItemType Directory -Path $DestFileDir -Force | Out-Null
                }
                Copy-Item $_.FullName -Destination $DestFile -Force
            }
        }
        
        # Copy directory structure (empty directories)
        Get-ChildItem -Path $Source -Recurse -Directory | ForEach-Object {
            $RelativePath = $_.FullName.Substring($Source.Length + 1)
            $DestDir = Join-Path $DestPath $RelativePath
            if (-not (Test-Path $DestDir)) {
                New-Item -ItemType Directory -Path $DestDir -Force | Out-Null
            }
        }
    } else {
        # It's a file
        Copy-Item $Source -Destination $DestPath -Force
    }
}

# Define exclude patterns
$ExcludePatterns = @(
    "*\node_modules\*",
    "*\vendor\*",
    "*\dist\*",
    "*\dist-ssr\*",
    "*\build\*",
    "*\.git\*",
    "*\*.log",
    "*\*.cache",
    "*\.env",
    "*\.env.*",
    "*\storage\logs\*",
    "*\storage\framework\cache\*",
    "*\storage\framework\sessions\*",
    "*\storage\framework\views\*",
    "*\storage\framework\testing\*",
    "*\bootstrap\cache\*",
    "*\.phpunit.result.cache",
    "*\.DS_Store",
    "*\*.suo",
    "*\*.ntvs*",
    "*\*.njsproj",
    "*\*.sln",
    "*\.idea\*",
    "*\.vscode\*",
    "*\*.local"
)

Write-Host "`nStarting backup process..." -ForegroundColor Cyan
Write-Host "Excluding: node_modules, vendor, dist, .git, logs, cache files" -ForegroundColor Gray

# Backup backend
Write-Host "`nBacking up backend..." -ForegroundColor Yellow
Copy-Excluding -Source "backend" -Destination $BackupDir -ExcludePatterns $ExcludePatterns

# Backup frontend
Write-Host "Backing up frontend..." -ForegroundColor Yellow
Copy-Excluding -Source "frontend" -Destination $BackupDir -ExcludePatterns $ExcludePatterns

# Backup root files
Write-Host "Backing up root files..." -ForegroundColor Yellow
$RootFiles = @(
    "composer.json",
    "composer.lock",
    "create_admin_user.php",
    "test_sanitization.sh",
    "TODO.md"
)

foreach ($File in $RootFiles) {
    if (Test-Path $File) {
        Copy-Item $File -Destination $BackupDir -Force
        Write-Host "  Copied: $File" -ForegroundColor Gray
    }
}

# Backup documentation files
Write-Host "Backing up documentation..." -ForegroundColor Yellow
Get-ChildItem -Path "." -Filter "*.md" -File | ForEach-Object {
    Copy-Item $_.FullName -Destination $BackupDir -Force
    Write-Host "  Copied: $($_.Name)" -ForegroundColor Gray
}

# Create backup info file
$BackupInfo = @"
BMS Backup Information
======================
Backup Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Backup Location: $BackupDir
Project Root: $ScriptDir

Included:
- Backend source code (excluding vendor, node_modules, cache)
- Frontend source code (excluding node_modules, dist)
- Configuration files (composer.json, package.json, etc.)
- Documentation files (*.md)

Excluded:
- node_modules (can be reinstalled with npm install)
- vendor (can be reinstalled with composer install)
- dist/build folders (can be regenerated)
- .git directory
- Log files
- Cache files
- Environment files (.env)
- IDE configuration files

To restore:
1. Extract backup to desired location
2. Run 'composer install' in backend directory
3. Run 'npm install' in frontend directory
4. Copy .env.example to .env and configure
5. Run database migrations if needed
"@

$BackupInfo | Out-File -FilePath (Join-Path $BackupDir "BACKUP_INFO.txt") -Encoding UTF8

# Compress backup if requested
if ($Compress) {
    Write-Host "`nCompressing backup..." -ForegroundColor Yellow
    $ZipFile = "$BackupDir.zip"
    
    # Remove existing zip if it exists
    if (Test-Path $ZipFile) {
        Remove-Item $ZipFile -Force
    }
    
    # Compress the backup directory
    Compress-Archive -Path $BackupDir -DestinationPath $ZipFile -CompressionLevel Optimal
    
    # Get zip file size
    $ZipSize = (Get-Item $ZipFile).Length / 1MB
    Write-Host "Backup compressed: $ZipFile ($([math]::Round($ZipSize, 2)) MB)" -ForegroundColor Green
    
    # Ask if user wants to remove uncompressed backup
    Write-Host "`nBackup completed successfully!" -ForegroundColor Green
    Write-Host "Compressed backup: $ZipFile" -ForegroundColor Cyan
    Write-Host "Uncompressed backup: $BackupDir" -ForegroundColor Cyan
} else {
    # Get backup size
    $BackupSize = (Get-ChildItem -Path $BackupDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
    Write-Host "`nBackup completed successfully!" -ForegroundColor Green
    Write-Host "Backup location: $BackupDir" -ForegroundColor Cyan
    Write-Host "Backup size: $([math]::Round($BackupSize, 2)) MB" -ForegroundColor Cyan
}

Write-Host "`nDone!" -ForegroundColor Green

