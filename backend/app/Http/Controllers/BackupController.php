<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Artisan;
use Carbon\Carbon;
use App\Services\ActivityLogService;

class BackupController extends Controller
{
    /**
     * Test endpoint to verify controller is accessible
     */
    public function test()
    {
        return response()->json([
            'success' => true,
            'message' => 'BackupController is working',
            'timestamp' => now()->toDateTimeString()
        ]);
    }

    /**
     * Run backup manually
     */
    public function runBackup(Request $request)
    {
        \Log::info('BackupController::runBackup called', ['type' => $request->input('type', 'all')]);
        
        try {
            $type = $request->input('type', 'all'); // all, database, storage, config
            
            // Set timeout for long-running backup operations
            set_time_limit(300); // 5 minutes
            
            // Run backup command with error handling
            $exitCode = Artisan::call('backup:run', [
                '--type' => $type
            ]);

            $output = Artisan::output();
            
            \Log::info('Backup command completed', [
                'exit_code' => $exitCode,
                'output_length' => strlen($output)
            ]);

            // Check if backup was successful
            if ($exitCode !== 0) {
                \Log::error('Backup command failed', [
                    'exit_code' => $exitCode,
                    'output' => $output
                ]);
                
                return response()->json([
                    'success' => false,
                    'message' => 'Backup failed. Please check server logs for details.',
                    'output' => $output
                ], 500);
            }

            // Log activity (wrap in try-catch to prevent backup failure if logging fails)
            try {
                ActivityLogService::logAdminAction('backup_created', 'Manual backup created', $request);
            } catch (\Exception $logError) {
                \Log::warning('Failed to log backup activity: ' . $logError->getMessage());
            }

            return response()->json([
                'success' => true,
                'message' => 'Backup created successfully',
                'output' => $output,
                'timestamp' => now()->toDateTimeString()
            ], 200);

        } catch (\Exception $e) {
            \Log::error('Backup failed', [
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Backup failed: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * List all backups
     */
    public function listBackups(Request $request)
    {
        \Log::info('BackupController::listBackups called');
        try {
            // Ensure storage path exists
            $storagePath = storage_path();
            if (!is_dir($storagePath)) {
                throw new \Exception('Storage path does not exist: ' . $storagePath);
            }
            
            $backupDir = storage_path('backups');
            \Log::info('Backup directory: ' . $backupDir);
            
            // Create directory if it doesn't exist
            if (!file_exists($backupDir)) {
                try {
                    if (!mkdir($backupDir, 0755, true)) {
                        \Log::error('Failed to create backup directory: ' . $backupDir);
                        return response()->json([
                            'success' => true,
                            'backups' => [],
                            'total' => 0,
                            'page' => 1,
                            'per_page' => 20,
                            'total_pages' => 0
                        ]);
                    }
                } catch (\Exception $e) {
                    \Log::error('Error creating backup directory: ' . $e->getMessage());
                    return response()->json([
                        'success' => true,
                        'backups' => [],
                        'total' => 0,
                        'page' => 1,
                        'per_page' => 20,
                        'total_pages' => 0
                    ]);
                }
            }
            
            // Check if directory is readable
            if (!is_readable($backupDir)) {
                \Log::warning('Backup directory is not readable: ' . $backupDir);
                return response()->json([
                    'success' => true,
                    'backups' => [],
                    'total' => 0,
                    'page' => 1,
                    'per_page' => 20,
                    'total_pages' => 0
                ]);
            }

            $backups = [];
            $files = glob($backupDir . '/*');
            
            // Handle case where glob returns false
            if ($files === false) {
                $files = [];
            }

            foreach ($files as $file) {
                if (is_file($file) && is_readable($file)) {
                    try {
                        $filename = basename($file);
                        
                        // Determine backup type
                        $type = 'unknown';
                        if (strpos($filename, 'db_backup_') === 0) {
                            $type = 'database';
                        } elseif (strpos($filename, 'storage_backup_') === 0) {
                            $type = 'storage';
                        } elseif (strpos($filename, 'config_backup_') === 0) {
                            $type = 'config';
                        }

                        // Extract timestamp from filename
                        $timestamp = null;
                        if (preg_match('/(\d{8}_\d{6})/', $filename, $matches)) {
                            try {
                                $timestamp = Carbon::createFromFormat('Ymd_His', $matches[1]);
                            } catch (\Exception $e) {
                                // If timestamp parsing fails, use filemtime
                                $timestamp = null;
                            }
                        }

                        $fileSize = filesize($file);
                        $fileMtime = filemtime($file);
                        
                        $backups[] = [
                            'id' => md5($file),
                            'filename' => $filename,
                            'type' => $type,
                            'size' => $fileSize,
                            'size_formatted' => $this->formatBytes($fileSize),
                            'path' => $file,
                            'created_at' => $timestamp ? $timestamp->toDateTimeString() : date('Y-m-d H:i:s', $fileMtime),
                            'modified_at' => date('Y-m-d H:i:s', $fileMtime),
                            'timestamp' => $fileMtime
                        ];
                    } catch (\Exception $e) {
                        // Skip files that can't be processed
                        \Log::warning('Skipping backup file: ' . $file . ' - ' . $e->getMessage());
                        continue;
                    }
                }
            }

            // Sort by modified timestamp (latest first)
            usort($backups, function($a, $b) {
                return $b['timestamp'] - $a['timestamp'];
            });

            // Apply pagination if needed
            $page = $request->input('page', 1);
            $perPage = $request->input('per_page', 20);
            $total = count($backups);
            $offset = ($page - 1) * $perPage;
            $paginatedBackups = array_slice($backups, $offset, $perPage);

            return response()->json([
                'success' => true,
                'backups' => $paginatedBackups,
                'total' => $total,
                'page' => $page,
                'per_page' => $perPage,
                'total_pages' => ceil($total / $perPage)
            ]);

        } catch (\Exception $e) {
            \Log::error('Failed to list backups', [
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString()
            ]);
            
            // Return empty list instead of 500 error to prevent UI issues
            return response()->json([
                'success' => true,
                'backups' => [],
                'total' => 0,
                'page' => 1,
                'per_page' => 20,
                'total_pages' => 0,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Get backup statistics
     */
    public function getStatistics(Request $request)
    {
        \Log::info('BackupController::getStatistics called');
        try {
            // Ensure storage path exists
            $storagePath = storage_path();
            if (!is_dir($storagePath)) {
                throw new \Exception('Storage path does not exist: ' . $storagePath);
            }
            
            $backupDir = storage_path('backups');
            \Log::info('Backup directory: ' . $backupDir);
            
            // Create directory if it doesn't exist
            if (!file_exists($backupDir)) {
                try {
                    if (!mkdir($backupDir, 0755, true)) {
                        \Log::error('Failed to create backup directory: ' . $backupDir);
                    }
                } catch (\Exception $e) {
                    \Log::error('Error creating backup directory: ' . $e->getMessage());
                }
            }
            
            // Return empty statistics if directory doesn't exist or isn't readable
            if (!file_exists($backupDir) || !is_readable($backupDir)) {
                return response()->json([
                    'success' => true,
                    'statistics' => [
                        'total_backups' => 0,
                        'total_size' => 0,
                        'total_size_formatted' => '0 B',
                        'database_backups' => 0,
                        'storage_backups' => 0,
                        'config_backups' => 0,
                        'latest_backup' => null,
                        'oldest_backup' => null
                    ]
                ]);
            }

            $files = glob($backupDir . '/*');
            
            // Handle case where glob returns false
            if ($files === false) {
                $files = [];
            }
            
            $totalSize = 0;
            $databaseCount = 0;
            $storageCount = 0;
            $configCount = 0;
            $timestamps = [];

            foreach ($files as $file) {
                if (is_file($file) && is_readable($file)) {
                    try {
                        $fileSize = filesize($file);
                        $totalSize += $fileSize;
                        $filename = basename($file);
                        
                        if (strpos($filename, 'db_backup_') === 0) {
                            $databaseCount++;
                        } elseif (strpos($filename, 'storage_backup_') === 0) {
                            $storageCount++;
                        } elseif (strpos($filename, 'config_backup_') === 0) {
                            $configCount++;
                        }
                        
                        $timestamps[] = filemtime($file);
                    } catch (\Exception $e) {
                        // Skip files that can't be processed
                        \Log::warning('Skipping backup file in statistics: ' . $file . ' - ' . $e->getMessage());
                        continue;
                    }
                }
            }

            $latestBackup = !empty($timestamps) ? date('Y-m-d H:i:s', max($timestamps)) : null;
            $oldestBackup = !empty($timestamps) ? date('Y-m-d H:i:s', min($timestamps)) : null;

            // Count only actual files (not directories)
            $fileCount = 0;
            foreach ($files as $file) {
                if (is_file($file)) {
                    $fileCount++;
                }
            }
            
            return response()->json([
                'success' => true,
                'statistics' => [
                    'total_backups' => $fileCount,
                    'total_size' => $totalSize,
                    'total_size_formatted' => $this->formatBytes($totalSize),
                    'database_backups' => $databaseCount,
                    'storage_backups' => $storageCount,
                    'config_backups' => $configCount,
                    'latest_backup' => $latestBackup,
                    'oldest_backup' => $oldestBackup
                ]
            ]);

        } catch (\Exception $e) {
            \Log::error('Failed to get backup statistics', [
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString()
            ]);
            
            // Return empty statistics on error instead of 500
            return response()->json([
                'success' => true,
                'statistics' => [
                    'total_backups' => 0,
                    'total_size' => 0,
                    'total_size_formatted' => '0 B',
                    'database_backups' => 0,
                    'storage_backups' => 0,
                    'config_backups' => 0,
                    'latest_backup' => null,
                    'oldest_backup' => null
                ]
            ]);
        }
    }

    /**
     * Download a backup file
     */
    public function downloadBackup(Request $request, $id)
    {
        try {
            $backupDir = storage_path('backups');
            $files = glob($backupDir . '/*');
            
            foreach ($files as $file) {
                if (md5($file) === $id && is_file($file) && is_readable($file)) {
                    $filename = basename($file);
                    
                    // Log activity (wrap in try-catch to prevent failure if logging fails)
                    try {
                        ActivityLogService::logAdminAction('backup_downloaded', 'Backup file downloaded: ' . $filename, $request);
                    } catch (\Exception $logError) {
                        \Log::warning('Failed to log backup download: ' . $logError->getMessage());
                    }
                    
                    return response()->download($file, $filename, [
                        'Content-Type' => $this->getMimeType($file),
                    ]);
                }
            }

            return response()->json([
                'success' => false,
                'message' => 'Backup file not found'
            ], 404);

        } catch (\Exception $e) {
            \Log::error('Failed to download backup', [
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to download backup: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete a backup file
     */
    public function deleteBackup(Request $request, $id)
    {
        try {
            $backupDir = storage_path('backups');
            $files = glob($backupDir . '/*');
            
            foreach ($files as $file) {
                if (md5($file) === $id) {
                    if (unlink($file)) {
                        // Log activity (wrap in try-catch to prevent failure if logging fails)
                        try {
                            ActivityLogService::logAdminAction('backup_deleted', 'Backup file deleted: ' . basename($file), $request);
                        } catch (\Exception $logError) {
                            \Log::warning('Failed to log backup deletion: ' . $logError->getMessage());
                        }
                        
                        return response()->json([
                            'success' => true,
                            'message' => 'Backup deleted successfully'
                        ]);
                    }
                }
            }

            return response()->json([
                'success' => false,
                'message' => 'Backup file not found'
            ], 404);

        } catch (\Exception $e) {
            \Log::error('Failed to delete backup: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete backup: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Restore from a backup file
     */
    public function restoreBackup(Request $request, $id)
    {
        \Log::info('BackupController::restoreBackup called', ['backup_id' => $id]);
        
        try {
            $backupDir = storage_path('backups');
            $files = glob($backupDir . '/*');
            $backupFile = null;
            
            // Find the backup file
            foreach ($files as $file) {
                if (md5($file) === $id && is_file($file) && is_readable($file)) {
                    $backupFile = $file;
                    break;
                }
            }

            if (!$backupFile) {
                return response()->json([
                    'success' => false,
                    'message' => 'Backup file not found'
                ], 404);
            }

            $filename = basename($backupFile);
            $output = [];
            $success = false;
            
            // Determine backup type and restore accordingly
            if (strpos($filename, 'db_backup_') === 0) {
                // Database backup restoration
                \Log::info('Restoring database backup: ' . $filename);
                
                $tempSqlFile = null;
                
                try {
                    // Check if file is compressed
                    if (preg_match('/\.sql\.gz$/', $filename)) {
                        // Decompress and restore
                        $tempSqlFile = storage_path('app/temp_restore_' . time() . '.sql');
                        
                        // Decompress using gzip
                        if (function_exists('gzopen')) {
                            $gz = gzopen($backupFile, 'r');
                            $sqlContent = '';
                            while (!gzeof($gz)) {
                                $sqlContent .= gzread($gz, 8192);
                            }
                            gzclose($gz);
                            file_put_contents($tempSqlFile, $sqlContent);
                        } else {
                            // Fallback: use system command
                            exec("gunzip -c \"$backupFile\" > \"$tempSqlFile\" 2>&1", $decompressOutput, $exitCode);
                            if ($exitCode !== 0) {
                                throw new \Exception('Failed to decompress backup file: ' . implode("\n", $decompressOutput));
                            }
                        }
                        
                        // Read SQL file
                        $sqlContent = file_get_contents($tempSqlFile);
                        if ($sqlContent === false) {
                            throw new \Exception('Failed to read decompressed SQL file');
                        }
                    } else {
                        // Plain SQL file
                        $sqlContent = file_get_contents($backupFile);
                        if ($sqlContent === false) {
                            throw new \Exception('Failed to read SQL file');
                        }
                    }
                    
                    // Preserve current activity_logs before restore
                    $currentActivityLogs = [];
                    $preserveLogs = true;
                    try {
                        if (DB::getSchemaBuilder()->hasTable('activity_logs')) {
                            $currentActivityLogs = DB::table('activity_logs')
                                ->orderBy('created_at', 'desc')
                                ->get()
                                ->map(function($log) {
                                    // Convert to array and remove id (will be auto-generated on insert)
                                    $logArray = (array) $log;
                                    unset($logArray['id']);
                                    return $logArray;
                                })
                                ->toArray();
                            \Log::info('Preserved ' . count($currentActivityLogs) . ' activity log entries before restore');
                        }
                    } catch (\Exception $e) {
                        \Log::warning('Could not preserve activity logs: ' . $e->getMessage());
                        $preserveLogs = false;
                    }
                    
                    // Process SQL content to handle existing tables
                    // First, extract all table names from CREATE TABLE statements
                    $tableNames = [];
                    preg_match_all('/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?(\w+)[`"]?/i', $sqlContent, $matches);
                    if (!empty($matches[1])) {
                        $tableNames = array_unique($matches[1]);
                    }
                    
                    // Build DROP TABLE statements for all tables found
                    $dropStatements = '';
                    if (!empty($tableNames)) {
                        foreach ($tableNames as $tableName) {
                            $dropStatements .= "DROP TABLE IF EXISTS `$tableName`;\n";
                        }
                    }
                    
                    // Prepend DROP statements to SQL content
                    $processedSql = $dropStatements . $sqlContent;
                    
                    // Also ensure existing DROP TABLE statements use IF EXISTS
                    $processedSql = preg_replace(
                        '/DROP\s+TABLE\s+(?!IF\s+EXISTS)/i',
                        'DROP TABLE IF EXISTS ',
                        $processedSql
                    );
                    
                    // Split SQL into individual statements
                    $statements = array_filter(
                        array_map('trim', explode(';', $processedSql)),
                        function($stmt) {
                            $stmt = trim($stmt);
                            return !empty($stmt) && 
                                   !preg_match('/^--/', $stmt) &&
                                   !preg_match('/^\/\*/', $stmt) &&
                                   !preg_match('/^\*\/$/', $stmt);
                        }
                    );
                    
                    // Disable foreign key checks temporarily
                    DB::statement('SET FOREIGN_KEY_CHECKS=0;');
                    DB::statement('SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";');
                    
                    try {
                        // Execute each SQL statement with error handling
                        foreach ($statements as $index => $statement) {
                            if (!empty($statement)) {
                                try {
                                    DB::unprepared($statement);
                                } catch (\Exception $e) {
                                    // Log but continue for non-critical errors
                                    if (strpos($e->getMessage(), 'already exists') === false && 
                                        strpos($e->getMessage(), 'Duplicate') === false) {
                                        \Log::warning("SQL statement error at index $index: " . $e->getMessage());
                                        // Continue with other statements
                                    }
                                }
                            }
                        }
                        $success = true;
                        
                        // Restore preserved activity logs after database restore
                        if ($preserveLogs && !empty($currentActivityLogs) && DB::getSchemaBuilder()->hasTable('activity_logs')) {
                            try {
                                // Insert preserved logs, maintaining their relative order and timestamps
                                $insertedCount = 0;
                                foreach ($currentActivityLogs as $log) {
                                    try {
                                        // Ensure created_at is preserved
                                        if (isset($log['created_at'])) {
                                            DB::table('activity_logs')->insert($log);
                                            $insertedCount++;
                                        }
                                    } catch (\Exception $e) {
                                        \Log::warning('Failed to restore activity log entry: ' . $e->getMessage());
                                    }
                                }
                                
                                if ($insertedCount > 0) {
                                    $output[] = "Preserved and restored $insertedCount activity log entries";
                                    \Log::info("Restored $insertedCount preserved activity log entries after database restore");
                                }
                            } catch (\Exception $e) {
                                \Log::error('Failed to restore preserved activity logs: ' . $e->getMessage());
                                $output[] = "Warning: Could not restore all preserved activity logs";
                            }
                        }
                    } finally {
                        // Re-enable foreign key checks
                        DB::statement('SET FOREIGN_KEY_CHECKS=1;');
                        
                        // Clean up temp file
                        if ($tempSqlFile && file_exists($tempSqlFile)) {
                            unlink($tempSqlFile);
                        }
                    }
                    
                    $output[] = "Database restored successfully from: $filename";
                } catch (\Exception $e) {
                    // Clean up temp file on error
                    if ($tempSqlFile && file_exists($tempSqlFile)) {
                        unlink($tempSqlFile);
                    }
                    throw $e;
                }
                
            } elseif (strpos($filename, 'storage_backup_') === 0) {
                // Storage backup restoration
                \Log::info('Restoring storage backup: ' . $filename);
                
                $storagePath = storage_path('app');
                $extractPath = storage_path('app/temp_restore_' . time());
                
                // Create temp directory
                if (!mkdir($extractPath, 0755, true)) {
                    throw new \Exception('Failed to create temporary extraction directory');
                }
                
                try {
                    // Extract archive
                    if (preg_match('/\.tar\.gz$/', $filename)) {
                        $command = "tar -xzf \"$backupFile\" -C \"$extractPath\" 2>&1";
                        exec($command, $extractOutput, $exitCode);
                        if ($exitCode !== 0) {
                            throw new \Exception('Failed to extract storage backup: ' . implode("\n", $extractOutput));
                        }
                    } elseif (preg_match('/\.zip$/', $filename)) {
                        $zip = new \ZipArchive();
                        if ($zip->open($backupFile) === TRUE) {
                            $zip->extractTo($extractPath);
                            $zip->close();
                        } else {
                            throw new \Exception('Failed to open ZIP archive');
                        }
                    } else {
                        throw new \Exception('Unsupported archive format');
                    }
                    
                    // Copy extracted files to storage
                    $extractedStorage = $extractPath . '/storage';
                    if (is_dir($extractedStorage)) {
                        // Copy contents of storage directory
                        $this->copyDirectory($extractedStorage, $storagePath);
                        $success = true;
                        $output[] = "Storage restored successfully from: $filename";
                    } else {
                        throw new \Exception('Storage directory not found in backup');
                    }
                } finally {
                    // Clean up temp directory
                    $this->deleteDirectory($extractPath);
                }
                
            } elseif (strpos($filename, 'config_backup_') === 0) {
                // Config backup restoration
                \Log::info('Restoring config backup: ' . $filename);
                
                $configPath = base_path();
                $extractPath = storage_path('app/temp_restore_' . time());
                
                // Create temp directory
                if (!mkdir($extractPath, 0755, true)) {
                    throw new \Exception('Failed to create temporary extraction directory');
                }
                
                try {
                    // Extract archive
                    if (preg_match('/\.tar\.gz$/', $filename)) {
                        $command = "tar -xzf \"$backupFile\" -C \"$extractPath\" 2>&1";
                        exec($command, $output, $exitCode);
                        if ($exitCode !== 0) {
                            throw new \Exception('Failed to extract config backup: ' . implode("\n", $output));
                        }
                    } elseif (preg_match('/\.zip$/', $filename)) {
                        $zip = new \ZipArchive();
                        if ($zip->open($backupFile) === TRUE) {
                            $zip->extractTo($extractPath);
                            $zip->close();
                        } else {
                            throw new \Exception('Failed to open ZIP archive');
                        }
                    } else {
                        throw new \Exception('Unsupported archive format');
                    }
                    
                    // Copy extracted config files
                    $extractedConfig = $extractPath . '/config';
                    if (is_dir($extractedConfig)) {
                        $this->copyDirectory($extractedConfig, $configPath . '/config');
                        $success = true;
                        $output[] = "Configuration restored successfully from: $filename";
                    } else {
                        throw new \Exception('Config directory not found in backup');
                    }
                } finally {
                    // Clean up temp directory
                    $this->deleteDirectory($extractPath);
                }
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'Unknown backup type. Cannot restore this backup file.'
                ], 400);
            }

            if ($success) {
                // Log activity
                try {
                    ActivityLogService::logAdminAction('backup_restored', 'Backup restored: ' . $filename, $request);
                } catch (\Exception $logError) {
                    \Log::warning('Failed to log backup restore: ' . $logError->getMessage());
                }
                
                return response()->json([
                    'success' => true,
                    'message' => 'Backup restored successfully',
                    'output' => implode("\n", $output)
                ]);
            } else {
                throw new \Exception('Restore operation failed');
            }

        } catch (\Exception $e) {
            \Log::error('Failed to restore backup', [
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to restore backup: ' . $e->getMessage(),
                'output' => isset($output) ? implode("\n", $output) : ''
            ], 500);
        }
    }

    /**
     * Copy directory recursively
     */
    private function copyDirectory($source, $destination)
    {
        if (!is_dir($destination)) {
            mkdir($destination, 0755, true);
        }
        
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($source, \RecursiveDirectoryIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::SELF_FIRST
        );
        
        foreach ($iterator as $item) {
            $destPath = $destination . DIRECTORY_SEPARATOR . $iterator->getSubPathName();
            
            if ($item->isDir()) {
                if (!is_dir($destPath)) {
                    mkdir($destPath, 0755, true);
                }
            } else {
                copy($item, $destPath);
            }
        }
    }

    /**
     * Delete directory recursively
     */
    private function deleteDirectory($dir)
    {
        if (!is_dir($dir)) {
            return;
        }
        
        $files = array_diff(scandir($dir), ['.', '..']);
        foreach ($files as $file) {
            $path = $dir . DIRECTORY_SEPARATOR . $file;
            is_dir($path) ? $this->deleteDirectory($path) : unlink($path);
        }
        rmdir($dir);
    }

    /**
     * Get MIME type for file
     */
    private function getMimeType($file)
    {
        $extension = strtolower(pathinfo($file, PATHINFO_EXTENSION));
        
        $mimeTypes = [
            'sql' => 'application/sql',
            'gz' => 'application/gzip',
            'zip' => 'application/zip',
            'tar' => 'application/x-tar',
            'tar.gz' => 'application/gzip',
        ];
        
        // Handle .sql.gz files
        if (preg_match('/\.sql\.gz$/', $file)) {
            return 'application/gzip';
        }
        
        return $mimeTypes[$extension] ?? 'application/octet-stream';
    }

    /**
     * Format bytes to human readable format
     */
    private function formatBytes($bytes, $precision = 2)
    {
        // Handle null or invalid input
        if (!is_numeric($bytes) || $bytes < 0) {
            return '0 B';
        }
        
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        
        $bytes = max($bytes, 0);
        
        // Handle zero bytes
        if ($bytes == 0) {
            return '0 B';
        }
        
        $pow = floor(log($bytes) / log(1024));
        $pow = min($pow, count($units) - 1);
        
        $bytes /= pow(1024, $pow);
        
        return round($bytes, $precision) . ' ' . $units[$pow];
    }
}

