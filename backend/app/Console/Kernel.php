<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    /**
     * Define the application's command schedule.
     *
     * @param  \Illuminate\Console\Scheduling\Schedule  $schedule
     * @return void
     */
    protected function schedule(Schedule $schedule)
    {
    // Daily check to mark residents for review based on activity.
    // Runs at 01:00 every day.
    $schedule->command('residents:check-review')->dailyAt('01:00')->withoutOverlapping();

    // Daily check for inactive users and flag them for review.
    // Runs at 02:00 every day.
    $schedule->command('users:check-inactive')->dailyAt('02:00')->withoutOverlapping();

    // Clean up expired verification codes every minute
    // This ensures expired codes are cleared automatically
    $schedule->command('verification:cleanup')->everyMinute()->withoutOverlapping();

    // Run scheduled household surveys every 15 minutes
    // This checks for any due survey schedules and executes them
    $schedule->command('surveys:run-scheduled')->everyFifteenMinutes()->withoutOverlapping();

    // Automated backup - runs daily at 2:00 AM
    // Backs up database, storage files, and configuration
    $schedule->command('backup:run')
        ->dailyAt('02:00')
        ->withoutOverlapping()
        ->emailOutputOnFailure(env('BACKUP_EMAIL', 'admin@barangay.gov.ph'));
    }

    /**
     * Register the commands for the application.
     *
     * @return void
     */
    protected function commands()
    {
        $this->load(__DIR__.'/Commands');

        require base_path('routes/console.php');
    }
}
