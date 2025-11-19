<?php

namespace App\Console\Commands;

use App\Models\Staff;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class UpdateStaffPermissions extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'staff:update-permissions 
                            {--staff-id= : The ID of the specific staff member to update}
                            {--all : Update all staff members}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Update staff module_permissions in the database';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        // The permissions value to set
        $permissions = [
            "dashboard" => true,
            "residentsRecords" => true,
            "documentsRecords" => true,
            "householdRecords" => false,
            "blotterRecords" => false,
            "financialTracking" => false,
            "barangayOfficials" => false,
            "staffManagement" => false,
            "communicationAnnouncement" => false,
            "socialServices" => true,
            "disasterEmergency" => false,
            "projectManagement" => false,
            "inventoryAssets" => false,
            "activityLogs" => true,
            "residentsRecords_main_records" => true,
            "residentsRecords_main_records_edit" => true,
            "residentsRecords_main_records_disable" => true,
            "residentsRecords_main_records_view" => true,
            "residentsRecords_verification" => true,
            "residentsRecords_disabled_residents" => false,
            "documentsRecords_document_requests" => false,
            "documentsRecords_document_records" => false,
            "socialServices_programs" => true,
            "socialServices_beneficiaries" => true,
            "inventoryAssets_asset_management" => false,
            "inventoryAssets_asset_posts_management" => false,
            "inventoryAssets_asset_tracking" => false
        ];

        $staffId = $this->option('staff-id');
        $updateAll = $this->option('all');

        if ($staffId) {
            // Update specific staff member
            $staff = Staff::find($staffId);
            if (!$staff) {
                $this->error("Staff member with ID {$staffId} not found.");
                return 1;
            }

            $this->info("Updating permissions for staff: {$staff->name} (ID: {$staff->id})");
            
            DB::table('staff')
                ->where('id', $staffId)
                ->update([
                    'module_permissions' => json_encode($permissions, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    'updated_at' => now()
                ]);

            $this->info("✓ Successfully updated permissions for staff ID: {$staffId}");
            
        } elseif ($updateAll) {
            // Update all staff members
            $count = Staff::count();
            $this->info("Updating permissions for all {$count} staff members...");
            
            $updated = DB::table('staff')
                ->update([
                    'module_permissions' => json_encode($permissions, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    'updated_at' => now()
                ]);

            $this->info("✓ Successfully updated permissions for {$updated} staff member(s)");
            
        } else {
            $this->error("Please specify either --staff-id=<id> or --all");
            $this->info("Examples:");
            $this->info("  php artisan staff:update-permissions --staff-id=1");
            $this->info("  php artisan staff:update-permissions --all");
            return 1;
        }

        return 0;
    }
}

