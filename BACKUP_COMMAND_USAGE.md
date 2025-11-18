# Backup Command Usage Guide
## Quick Reference for Demonstrating Backups

---

## 🚀 Quick Start

### Run Full Backup
```bash
php artisan backup:run
```

### Run Specific Backup Type
```bash
# Database only
php artisan backup:run --type=database

# Storage only
php artisan backup:run --type=storage

# Configuration only
php artisan backup:run --type=config
```

### Preview (Show What Would Be Backed Up)
```bash
php artisan backup:run --show-only
```

---

## 📋 Command Options

| Option | Description | Example |
|--------|-------------|---------|
| `--type` | Type of backup (all, database, storage, config) | `--type=database` |
| `--show-only` | Preview without actually backing up | `--show-only` |

---

## 🎬 Demonstration Examples

### Example 1: Show Backup Preview
```bash
php artisan backup:run --show-only
```

**Output:**
```
═══════════════════════════════════════════════════════
          Barangay Management System Backup           
═══════════════════════════════════════════════════════

📦 Backing up database...
   Would backup: 15 tables
   Backup file: /path/to/storage/backups/db_backup_20250115_143022.sql.gz

📁 Backing up storage files...
   Would backup: 234 files
   Backup file: /path/to/storage/backups/storage_backup_20250115_143022.tar.gz

⚙️  Backing up configuration files...
   Would backup: 3 files
   Backup file: /path/to/storage/backups/config_backup_20250115_143022.tar.gz
```

### Example 2: Run Actual Backup
```bash
php artisan backup:run
```

**Output:**
```
═══════════════════════════════════════════════════════
          Barangay Management System Backup           
═══════════════════════════════════════════════════════

📦 Backing up database...
   Database: bms
   Tables: 15
   ✓ Database backup created: 5.2 MB

📁 Backing up storage files...
   Files to backup: 234
   ✓ Storage backup created: 12.4 MB

⚙️  Backing up configuration files...
   Files to backup: 3
   ✓ Configuration backup created: 0.1 MB

═══════════════════════════════════════════════════════
                    Backup Summary                     
═══════════════════════════════════════════════════════
✓ database: Backup created (5.2 MB)
✓ storage: Backup created (12.4 MB)
✓ config: Backup created (0.1 MB)

Backup completed successfully!
```

### Example 3: Database Backup Only
```bash
php artisan backup:run --type=database
```

---

## 📁 Backup File Location

Backups are stored in:
```
storage/backups/
├── db_backup_YYYYMMDD_HHMMSS.sql.gz
├── storage_backup_YYYYMMDD_HHMMSS.tar.gz
└── config_backup_YYYYMMDD_HHMMSS.tar.gz
```

---

## ⏰ Automated Scheduling

The backup is automatically scheduled in `app/Console/Kernel.php`:

```php
$schedule->command('backup:run')
    ->dailyAt('02:00')
    ->withoutOverlapping()
    ->emailOutputOnFailure(env('BACKUP_EMAIL', 'admin@barangay.gov.ph'));
```

**What This Means:**
- Runs automatically every day at 2:00 AM
- `withoutOverlapping()`: Prevents multiple backups from running simultaneously
- `emailOutputOnFailure()`: Sends email notification if backup fails

---

## 🔍 View Backup Files

### List All Backups
```bash
# Windows PowerShell
Get-ChildItem storage\backups | Format-Table Name, Length, LastWriteTime

# Linux/Mac
ls -lh storage/backups/
```

### View Backup Details
```bash
# Check backup file size
# Windows
Get-Item storage\backups\db_backup_*.sql.gz | Select-Object Name, Length, LastWriteTime

# Linux/Mac
ls -lh storage/backups/db_backup_*.sql.gz
```

---

## 🎯 For Your Defense Presentation

### What to Show:

1. **Command Execution**
   ```bash
   php artisan backup:run
   ```
   - Show the command running
   - Show the output with success messages
   - Show file sizes

2. **Backup Files**
   ```bash
   ls -lh storage/backups/
   ```
   - Show the created backup files
   - Show timestamps
   - Show file sizes

3. **Scheduled Tasks**
   - Show `app/Console/Kernel.php`
   - Highlight the scheduled backup command
   - Explain automatic execution

4. **Backup Verification**
   - Show backup files exist
   - Show file sizes are reasonable
   - Show timestamps are recent

---

## 💡 Key Talking Points

1. **Automation**
   > "The backup runs automatically every day at 2:00 AM without any manual intervention."

2. **Comprehensive**
   > "We back up all critical components: database, file storage, and configuration files."

3. **Reliable**
   > "The command includes error handling and verification to ensure backups are successful."

4. **Flexible**
   > "You can run full backups or backup specific components as needed."

5. **Safe**
   > "The `withoutOverlapping()` option prevents multiple backups from running simultaneously, which could cause conflicts."

---

## 🔧 Troubleshooting

### Backup Fails
- Check database credentials in `.env`
- Ensure `mysqldump` is installed and in PATH
- Check disk space availability
- Verify write permissions on `storage/backups/` directory

### Command Not Found
- Run `php artisan list` to see all available commands
- Ensure you're in the project root directory
- Check that the command file exists: `app/Console/Commands/RunBackup.php`

### Permission Errors
```bash
# Fix permissions (Linux/Mac)
chmod -R 755 storage/backups/
chown -R www-data:www-data storage/backups/
```

---

## 📊 Expected Output Format

```
═══════════════════════════════════════════════════════
          Barangay Management System Backup           
═══════════════════════════════════════════════════════

📦 Backing up database...
   Database: bms
   Tables: 15
   ✓ Database backup created: 5.2 MB

📁 Backing up storage files...
   Files to backup: 234
   ✓ Storage backup created: 12.4 MB

⚙️  Backing up configuration files...
   Files to backup: 3
   ✓ Configuration backup created: 0.1 MB

═══════════════════════════════════════════════════════
                    Backup Summary                     
═══════════════════════════════════════════════════════
✓ database: Backup created (5.2 MB)
✓ storage: Backup created (12.4 MB)
✓ config: Backup created (0.1 MB)

Backup completed successfully!
```

---

**Ready to demonstrate! 🚀**

