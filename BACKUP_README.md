# Backup Script Usage Guide

## Quick Start

### Option 1: Double-click (Windows)
Simply double-click `backup.bat` to create a backup.

### Option 2: PowerShell
Run the following command in PowerShell:
```powershell
.\backup.ps1
```

## Advanced Usage

### Custom Backup Location
```powershell
.\backup.ps1 -BackupPath "D:\MyBackups"
```

### Create Uncompressed Backup
```powershell
.\backup.ps1 -Compress:$false
```

### Combine Options
```powershell
.\backup.ps1 -BackupPath "D:\MyBackups" -Compress:$false
```

## What Gets Backed Up

✅ **Included:**
- Backend source code (PHP files, configs)
- Frontend source code (React/JSX files, configs)
- Configuration files (composer.json, package.json, etc.)
- Documentation files (*.md)
- Root-level scripts and files

❌ **Excluded:**
- `node_modules` (can be reinstalled)
- `vendor` (can be reinstalled)
- `dist`/`build` folders (can be regenerated)
- `.git` directory
- Log files
- Cache files
- Environment files (`.env`)
- IDE configuration files

## Backup Output

The script creates a timestamped backup folder:
- Format: `bms_backup_YYYY-MM-DD_HH-mm-ss`
- Default location: `%USERPROFILE%\Desktop`
- Includes a `BACKUP_INFO.txt` file with backup details

If compression is enabled (default), it also creates a `.zip` file.

## Restoring from Backup

1. Extract the backup to your desired location
2. Navigate to the backend directory and run:
   ```bash
   composer install
   ```
3. Navigate to the frontend directory and run:
   ```bash
   npm install
   ```
4. Copy `.env.example` to `.env` and configure your environment variables
5. Run database migrations if needed

## Notes

- The script preserves directory structure
- Large dependencies are excluded to keep backup size manageable
- Backups are timestamped to prevent overwriting previous backups
- The script works on Windows PowerShell 5.1 and later

