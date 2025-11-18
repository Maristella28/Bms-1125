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
                $this->error("   ✗ Database backup failed!");
                return ['success' => false, 'message' => 'Backup failed'];
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

            // Create tar.gz archive
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
                $this->error("   ✗ Storage backup failed!");
                return ['success' => false, 'message' => 'Backup failed'];
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

            // Create tar.gz archive
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

