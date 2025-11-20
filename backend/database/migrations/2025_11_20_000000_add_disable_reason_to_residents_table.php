<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Adds a `disable_reason` column to store the reason why a resident was disabled.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('residents', function (Blueprint $table) {
            if (!Schema::hasColumn('residents', 'disable_reason')) {
                $table->string('disable_reason')->nullable()->after('for_review');
            }
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('residents', function (Blueprint $table) {
            if (Schema::hasColumn('residents', 'disable_reason')) {
                $table->dropColumn('disable_reason');
            }
        });
    }
};

