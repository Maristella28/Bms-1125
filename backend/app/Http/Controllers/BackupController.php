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
     * Run backup manually
     */
    public function runBackup(Request $request)
    {
        try {
            $type = $request->input('type', 'all'); // all, database, storage, config
            
            // Run backup command
            Artisan::call('backup:run', [
                '--type' => $type
            ]);

            $output = Artisan::output();

            // Log activity
            ActivityLogService::logAdminAction('backup_created', 'Manual backup created', $request);

            return response()->json([
                'success' => true,
                'message' => 'Backup created successfully',
                'output' => $output,
                'timestamp' => now()->toDateTimeString()
            ], 200);

        } catch (\Exception $e) {
            \Log::error('Backup failed: ' . $e->getMessage());
            
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
        try {
            $backupDir = storage_path('backups');
            
            if (!file_exists($backupDir)) {
                return response()->json([
                    'success' => true,
                    'backups' => [],
                    'total' => 0
                ]);
            }

            $backups = [];
            $files = glob($backupDir . '/*');

            foreach ($files as $file) {
                if (is_file($file)) {
                    $filename = basename($file);
                    $fileInfo = pathinfo($filename);
                    
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
                        $timestamp = Carbon::createFromFormat('Ymd_His', $matches[1]);
                    }

                    $backups[] = [
                        'id' => md5($file),
                        'filename' => $filename,
                        'type' => $type,
                        'size' => filesize($file),
                        'size_formatted' => $this->formatBytes(filesize($file)),
                        'path' => $file,
                        'created_at' => $timestamp ? $timestamp->toDateTimeString() : date('Y-m-d H:i:s', filemtime($file)),
                        'modified_at' => date('Y-m-d H:i:s', filemtime($file)),
                        'timestamp' => filemtime($file)
                    ];
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
            \Log::error('Failed to list backups: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to list backups: ' . $e->getMessage(),
                'backups' => []
            ], 500);
        }
    }

    /**
     * Get backup statistics
     */
    public function getStatistics()
    {
        try {
            $backupDir = storage_path('backups');
            
            if (!file_exists($backupDir)) {
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
            $totalSize = 0;
            $databaseCount = 0;
            $storageCount = 0;
            $configCount = 0;
            $timestamps = [];

            foreach ($files as $file) {
                if (is_file($file)) {
                    $totalSize += filesize($file);
                    $filename = basename($file);
                    
                    if (strpos($filename, 'db_backup_') === 0) {
                        $databaseCount++;
                    } elseif (strpos($filename, 'storage_backup_') === 0) {
                        $storageCount++;
                    } elseif (strpos($filename, 'config_backup_') === 0) {
                        $configCount++;
                    }
                    
                    $timestamps[] = filemtime($file);
                }
            }

            $latestBackup = !empty($timestamps) ? date('Y-m-d H:i:s', max($timestamps)) : null;
            $oldestBackup = !empty($timestamps) ? date('Y-m-d H:i:s', min($timestamps)) : null;

            return response()->json([
                'success' => true,
                'statistics' => [
                    'total_backups' => count($files),
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
            \Log::error('Failed to get backup statistics: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to get statistics: ' . $e->getMessage()
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
                        ActivityLogService::logAdminAction('backup_deleted', 'Backup file deleted: ' . basename($file), $request);
                        
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

