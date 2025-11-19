<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Carbon\Carbon;

class RunBackup extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'backup:run 
                            {--type=all : Type of backup (all, database, storage, config)}
                            {--show-only : Show what would be backed up without actually backing up}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Run automated backup of database, storage, and configuration files';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $type = $this->option('type');
        $showOnly = $this->option('show-only');

        $this->info('═══════════════════════════════════════════════════════');
        $this->info('          Barangay Management System Backup           ');
        $this->info('═══════════════════════════════════════════════════════');
        $this->newLine();

        $timestamp = Carbon::now()->format('Ymd_His');
        $backupDir = storage_path('backups');
        
        // Create backup directory if it doesn't exist
        if (!file_exists($backupDir)) {
            mkdir($backupDir, 0755, true);
            $this->info("Created backup directory: {$backupDir}");
        }

        $results = [];

        // Database Backup
        if ($type === 'all' || $type === 'database') {
            $results['database'] = $this->backupDatabase($timestamp, $backupDir, $showOnly);
        }

        // Storage Backup
        if ($type === 'all' || $type === 'storage') {
            $results['storage'] = $this->backupStorage($timestamp, $backupDir, $showOnly);
        }

        // Configuration Backup
        if ($type === 'all' || $type === 'config') {
            $results['config'] = $this->backupConfig($timestamp, $backupDir, $showOnly);
        }

        // Summary
        $this->newLine();
        $this->info('═══════════════════════════════════════════════════════');
        $this->info('                    Backup Summary                     ');
        $this->info('═══════════════════════════════════════════════════════');
        
        $successCount = 0;
        $failCount = 0;

        foreach ($results as $type => $result) {
            if ($result['success']) {
                $this->line("<fg=green>✓</> {$type}: {$result['message']}");
                $successCount++;
            } else {
                $this->line("<fg=red>✗</> {$type}: {$result['message']}");
                $failCount++;
            }
        }

        $this->newLine();
        if ($failCount === 0) {
            $this->info("<fg=green>Backup completed successfully!</>");
        } else {
            $this->error("Backup completed with {$failCount} error(s).");
        }

        return $failCount === 0 ? 0 : 1;
    }

    /**
     * Backup database
     */
    private function backupDatabase($timestamp, $backupDir, $showOnly)
    {
        $this->info('📦 Backing up database...');

        try {
            $dbName = config('database.connections.mysql.database');
            $dbUser = config('database.connections.mysql.username');
            $dbPass = config('database.connections.mysql.password');
            $dbHost = config('database.connections.mysql.host');

            $backupFile = "{$backupDir}/db_backup_{$timestamp}.sql.gz";

            if ($showOnly) {
                $tableCount = DB::select("SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ?", [$dbName]);
                $this->line("   Would backup: {$tableCount[0]->count} tables");
                $this->line("   Backup file: {$backupFile}");
                return ['success' => true, 'message' => "Would create backup file"];
            }

            // Get table count for display
            $tableCount = DB::select("SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ?", [$dbName]);
            $this->line("   Database: {$dbName}");
            $this->line("   Tables: {$tableCount[0]->count}");

            // Create database backup using mysqldump
            // Use PHP-based backup for Windows compatibility
            $backupFileUncompressed = "{$backupDir}/db_backup_{$timestamp}.sql";
            
            if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
                // Windows: Use PHP to export database
                $this->line("   Using PHP-based backup for Windows...");
                $result = $this->backupDatabasePHP($dbHost, $dbUser, $dbPass, $dbName, $backupFileUncompressed);
                
                if ($result['success']) {
                    // Compress using PHP gzip
                    $this->compressFile($backupFileUncompressed, $backupFile);
                    if (file_exists($backupFile)) {
                        @unlink($backupFileUncompressed); // Remove uncompressed file
                        $size = $this->formatBytes(filesize($backupFile));
                        $this->line("   <fg=green>✓</> Database backup created: {$size}");
                        return ['success' => true, 'message' => "Backup created ({$size})"];
                    }
                }
                return ['success' => false, 'message' => $result['message'] ?? 'Backup failed'];
            } else {
                // Linux/Unix: Use mysqldump
                $command = sprintf(
                    'mysqldump --single-transaction --routines --triggers -h %s -u %s -p%s %s 2>/dev/null | gzip > %s',
                    escapeshellarg($dbHost),
                    escapeshellarg($dbUser),
                    escapeshellarg($dbPass),
                    escapeshellarg($dbName),
                    escapeshellarg($backupFile)
                );

                exec($command, $output, $returnCode);

                if ($returnCode === 0 && file_exists($backupFile)) {
                    $size = $this->formatBytes(filesize($backupFile));
                    $this->line("   <fg=green>✓</> Database backup created: {$size}");
                    return ['success' => true, 'message' => "Backup created ({$size})"];
                } else {
                    $this->error("   ✗ Database backup failed! Return code: {$returnCode}");
                    return ['success' => false, 'message' => 'Backup failed'];
                }
            }
        } catch (\Exception $e) {
            $this->error("   ✗ Error: " . $e->getMessage());
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    /**
     * Backup storage files
     */
    private function backupStorage($timestamp, $backupDir, $showOnly)
    {
        $this->info('📁 Backing up storage files...');

        try {
            $storagePath = storage_path('app');
            $backupFile = "{$backupDir}/storage_backup_{$timestamp}.tar.gz";

            if ($showOnly) {
                $fileCount = $this->countFiles($storagePath);
                $this->line("   Would backup: {$fileCount} files");
                $this->line("   Backup file: {$backupFile}");
                return ['success' => true, 'message' => "Would create backup file"];
            }

            $fileCount = $this->countFiles($storagePath);
            $this->line("   Files to backup: {$fileCount}");

            // Create archive - use PHP ZipArchive for Windows compatibility
            // Change extension to .zip for Windows
            $backupFileZip = str_replace('.tar.gz', '.zip', $backupFile);
            
            if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN' || !function_exists('exec')) {
                // Windows or exec disabled: Use PHP ZipArchive
                $this->line("   Using PHP ZipArchive for backup...");
                $result = $this->backupStoragePHP($storagePath, $backupFileZip);
                
                if ($result['success'] && file_exists($backupFileZip)) {
                    $size = $this->formatBytes(filesize($backupFileZip));
                    $this->line("   <fg=green>✓</> Storage backup created: {$size}");
                    return ['success' => true, 'message' => "Backup created ({$size})"];
                }
                return ['success' => false, 'message' => $result['message'] ?? 'Backup failed'];
            } else {
                // Linux/Unix: Use tar
                $command = sprintf(
                    'cd %s && tar -czf %s . 2>/dev/null',
                    escapeshellarg($storagePath),
                    escapeshellarg($backupFile)
                );

                exec($command, $output, $returnCode);

                if ($returnCode === 0 && file_exists($backupFile)) {
                    $size = $this->formatBytes(filesize($backupFile));
                    $this->line("   <fg=green>✓</> Storage backup created: {$size}");
                    return ['success' => true, 'message' => "Backup created ({$size})"];
                } else {
                    $this->error("   ✗ Storage backup failed! Return code: {$returnCode}");
                    return ['success' => false, 'message' => 'Backup failed'];
                }
            }
        } catch (\Exception $e) {
            $this->error("   ✗ Error: " . $e->getMessage());
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    /**
     * Backup configuration files
     */
    private function backupConfig($timestamp, $backupDir, $showOnly)
    {
        $this->info('⚙️  Backing up configuration files...');

        try {
            $configFiles = [
                base_path('.env'),
                base_path('composer.json'),
                base_path('composer.lock'),
            ];

            $backupFile = "{$backupDir}/config_backup_{$timestamp}.tar.gz";

            if ($showOnly) {
                $existingFiles = array_filter($configFiles, 'file_exists');
                $this->line("   Would backup: " . count($existingFiles) . " files");
                $this->line("   Backup file: {$backupFile}");
                return ['success' => true, 'message' => "Would create backup file"];
            }

            $existingFiles = array_filter($configFiles, 'file_exists');
            $this->line("   Files to backup: " . count($existingFiles));

            // Use PHP-based backup for Windows compatibility
            if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN' || !function_exists('exec')) {
                // Windows or exec disabled: Use PHP ZipArchive
                $this->line("   Using PHP ZipArchive for backup...");
                $backupFileZip = str_replace('.tar.gz', '.zip', $backupFile);
                $result = $this->backupConfigPHP($existingFiles, $backupFileZip);
                
                if ($result['success'] && file_exists($backupFileZip)) {
                    $size = $this->formatBytes(filesize($backupFileZip));
                    $this->line("   <fg=green>✓</> Configuration backup created: {$size}");
                    return ['success' => true, 'message' => "Backup created ({$size})"];
                }
                return ['success' => false, 'message' => $result['message'] ?? 'Backup failed'];
            } else {
                // Linux/Unix: Use tar
                $fileList = implode(' ', array_map('escapeshellarg', $existingFiles));
                $command = sprintf(
                    'tar -czf %s -C %s %s 2>/dev/null',
                    escapeshellarg($backupFile),
                    escapeshellarg(base_path()),
                    $fileList
                );

                exec($command, $output, $returnCode);

                if ($returnCode === 0 && file_exists($backupFile)) {
                    $size = $this->formatBytes(filesize($backupFile));
                    $this->line("   <fg=green>✓</> Configuration backup created: {$size}");
                    return ['success' => true, 'message' => "Backup created ({$size})"];
                } else {
                    $this->error("   ✗ Configuration backup failed!");
                    return ['success' => false, 'message' => 'Backup failed'];
                }
            }
        } catch (\Exception $e) {
            $this->error("   ✗ Error: " . $e->getMessage());
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    /**
     * Count files in directory recursively
     */
    private function countFiles($directory)
    {
        $count = 0;
        if (is_dir($directory)) {
            $iterator = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($directory, \RecursiveDirectoryIterator::SKIP_DOTS)
            );
            foreach ($iterator as $file) {
                if ($file->isFile()) {
                    $count++;
                }
            }
        }
        return $count;
    }

    /**
     * Backup database using PHP (Windows compatible)
     */
    private function backupDatabasePHP($dbHost, $dbUser, $dbPass, $dbName, $backupFile)
    {
        try {
            $handle = fopen($backupFile, 'w');
            if (!$handle) {
                return ['success' => false, 'message' => 'Cannot create backup file'];
            }

            // Write header
            fwrite($handle, "-- Database Backup\n");
            fwrite($handle, "-- Generated: " . date('Y-m-d H:i:s') . "\n");
            fwrite($handle, "-- Database: {$dbName}\n\n");
            fwrite($handle, "SET SQL_MODE = \"NO_AUTO_VALUE_ON_ZERO\";\n");
            fwrite($handle, "SET time_zone = \"+00:00\";\n\n");

            // Get all tables
            $tables = DB::select("SHOW TABLES");
            $tableKey = "Tables_in_{$dbName}";

            foreach ($tables as $table) {
                $tableName = $table->$tableKey;
                $this->line("   Exporting table: {$tableName}");

                // Get table structure
                $createTable = DB::select("SHOW CREATE TABLE `{$tableName}`");
                fwrite($handle, "\n-- Table structure for `{$tableName}`\n");
                fwrite($handle, "DROP TABLE IF EXISTS `{$tableName}`;\n");
                fwrite($handle, $createTable[0]->{'Create Table'} . ";\n\n");

                // Get table data
                $rows = DB::table($tableName)->get();
                if ($rows->count() > 0) {
                    fwrite($handle, "-- Data for table `{$tableName}`\n");
                    fwrite($handle, "LOCK TABLES `{$tableName}` WRITE;\n");
                    
                    foreach ($rows as $row) {
                        $values = [];
                        foreach ((array)$row as $value) {
                            if ($value === null) {
                                $values[] = 'NULL';
                            } else {
                                $values[] = "'" . addslashes($value) . "'";
                            }
                        }
                        $columns = implode('`, `', array_keys((array)$row));
                        $valuesStr = implode(', ', $values);
                        fwrite($handle, "INSERT INTO `{$tableName}` (`{$columns}`) VALUES ({$valuesStr});\n");
                    }
                    
                    fwrite($handle, "UNLOCK TABLES;\n\n");
                }
            }

            fclose($handle);
            return ['success' => true, 'message' => 'Database exported successfully'];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    /**
     * Backup storage using PHP ZipArchive (Windows compatible)
     */
    private function backupStoragePHP($storagePath, $backupFile)
    {
        try {
            if (!class_exists('ZipArchive')) {
                return ['success' => false, 'message' => 'ZipArchive class not available'];
            }

            $zip = new \ZipArchive();
            if ($zip->open($backupFile, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== TRUE) {
                return ['success' => false, 'message' => 'Cannot create zip file'];
            }

            $iterator = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($storagePath, \RecursiveDirectoryIterator::SKIP_DOTS),
                \RecursiveIteratorIterator::SELF_FIRST
            );

            $fileCount = 0;
            foreach ($iterator as $file) {
                if ($file->isFile()) {
                    $filePath = $file->getRealPath();
                    $relativePath = substr($filePath, strlen($storagePath) + 1);
                    $zip->addFile($filePath, $relativePath);
                    $fileCount++;
                    
                    if ($fileCount % 100 === 0) {
                        $this->line("   Processed {$fileCount} files...");
                    }
                }
            }

            $zip->close();
            return ['success' => true, 'message' => "Backed up {$fileCount} files"];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    /**
     * Compress file using PHP gzip
     */
    private function compressFile($sourceFile, $destinationFile)
    {
        try {
            $sourceHandle = fopen($sourceFile, 'rb');
            $destHandle = gzopen($destinationFile, 'wb9');

            if (!$sourceHandle || !$destHandle) {
                return false;
            }

            while (!feof($sourceHandle)) {
                gzwrite($destHandle, fread($sourceHandle, 8192));
            }

            fclose($sourceHandle);
            gzclose($destHandle);
            return true;
        } catch (\Exception $e) {
            $this->error("   Compression error: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Backup configuration files using PHP ZipArchive (Windows compatible)
     */
    private function backupConfigPHP($configFiles, $backupFile)
    {
        try {
            if (!class_exists('ZipArchive')) {
                return ['success' => false, 'message' => 'ZipArchive class not available'];
            }

            $zip = new \ZipArchive();
            if ($zip->open($backupFile, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== TRUE) {
                return ['success' => false, 'message' => 'Cannot create zip file'];
            }

            $basePath = base_path();
            foreach ($configFiles as $file) {
                if (file_exists($file)) {
                    $relativePath = str_replace($basePath . DIRECTORY_SEPARATOR, '', $file);
                    $zip->addFile($file, $relativePath);
                }
            }

            $zip->close();
            return ['success' => true, 'message' => 'Configuration files backed up'];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    /**
     * Format bytes to human readable format
     */
    private function formatBytes($bytes, $precision = 2)
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        
        $bytes = max($bytes, 0);
        $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min($pow, count($units) - 1);
        
        $bytes /= pow(1024, $pow);
        
        return round($bytes, $precision) . ' ' . $units[$pow];
    }
}

