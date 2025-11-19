<?php

namespace App\Console\Commands;

use App\Models\Staff;
use Illuminate\Console\Command;

class ListStaff extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'staff:list';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'List all staff members with their IDs';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $staff = Staff::select('id', 'name', 'email', 'department', 'position', 'active')
            ->orderBy('id')
            ->get();

        if ($staff->isEmpty()) {
            $this->info('No staff members found.');
            return 0;
        }

        $this->info('Staff Members:');
        $this->info(str_repeat('-', 100));
        
        $headers = ['ID', 'Name', 'Email', 'Department', 'Position', 'Status'];
        $rows = [];

        foreach ($staff as $member) {
            $rows[] = [
                $member->id,
                $member->name,
                $member->email,
                $member->department ?? 'N/A',
                $member->position ?? 'N/A',
                $member->active ? 'Active' : 'Inactive'
            ];
        }

        $this->table($headers, $rows);
        $this->info("\nTo update permissions, use:");
        $this->info("  php artisan staff:update-permissions --staff-id=<ID>");
        $this->info("  php artisan staff:update-permissions --all");

        return 0;
    }
}

