<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Resident Model
 *
 * @property int $id
 * @property int $user_id
 * @property int $profile_id
 * @property string $resident_id
 * @property string $first_name
 * @property string $middle_name
 * @property string $last_name
 * @property string $name_suffix
 * @property \Carbon\Carbon $birth_date
 * @property string $birth_place
 * @property int $age
 * @property string $nationality
 * @property string $sex
 * @property string $civil_status
 * @property string $religion
 * @property string $relation_to_head
 * @property string $email
 * @property string $contact_number
 * @property string $landline_number
 * @property string $current_photo
 * @property string $current_address
 * @property string $full_address
 * @property int $years_in_barangay
 * @property string $voter_status
 * @property string $voters_id_number
 * @property string $voting_location
 * @property string $household_no
 * @property string $household_role
 * @property string $housing_type
 * @property bool $head_of_family
 * @property string $classified_sector
 * @property string $educational_attainment
 * @property string $occupation_type
 * @property string $salary_income
 * @property string $business_info
 * @property string $business_type
 * @property string $business_location
 * @property bool $business_outside_barangay
 * @property array $special_categories
 * @property string $covid_vaccine_status
 * @property array $vaccine_received
 * @property string $other_vaccine
 * @property int $year_vaccinated
 * @property string $verification_status
 * @property string $denial_reason
 * @property string $residency_verification_image
 * @property string|null $avatar
 * @property string $update_status
 * @property bool $for_review
 * @property \Carbon\Carbon $last_modified
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 * @property-read \App\Models\User $user
 * @property-read \App\Models\Profile $profile
 */
class Resident extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'residents';

    // Public properties to satisfy linter warnings for magic method access
    // Note: for_review and last_modified are database columns, not public properties
    // public $for_review;  // REMOVED - was preventing boolean cast from working
    // public $last_modified;  // Using database column instead

    protected $fillable = [
        'user_id',
        'profile_id',
        'resident_id',
        'first_name',
        'middle_name',
        'last_name',
        'name_suffix',
        'birth_date',
        'birth_place',
        'age',
        'nationality',
        'sex',
        'civil_status',
        'religion',
        'relation_to_head',
        'email',
        'contact_number',
        'mobile_number',
        'landline_number',
        'current_photo',
        'current_address',
        'full_address', // Add missing field that exists in database
        'years_in_barangay',
        'voter_status',
        'voters_id_number',
        'voting_location',
        'household_no',
    'household_role',
        'housing_type',
        'head_of_family',
        'classified_sector',
        'educational_attainment',
        'occupation_type',
        'salary_income',
        'business_info',
        'business_type',
        'business_location',
        'business_outside_barangay',
        'special_categories',
        'covid_vaccine_status',
        'vaccine_received',
        'other_vaccine',
        'year_vaccinated',
        'verification_status',
        'denial_reason',
        'residency_verification_image',
        'last_modified',
        'for_review',
        'disable_reason',
        // Account status and penalty tracking
        'account_status',
        'no_show_count',
        'last_no_show_at',
        'penalty_started_at',
        'penalty_ends_at',
        'penalty_reason',
        'can_submit_complaints',
        'can_submit_applications',
    ];

    protected $casts = [
        'birth_date' => 'date',
        'age' => 'integer',
        'years_in_barangay' => 'integer',
        'year_vaccinated' => 'integer',
        'head_of_family' => 'boolean',
    'household_role' => 'string',
        'business_outside_barangay' => 'boolean',
        'special_categories' => 'array',
        'vaccine_received' => 'array',
        'verification_status' => 'string',
        'denial_reason' => 'string',
        'last_modified' => 'datetime',
        'for_review' => 'boolean',
    ];

    /**
     * Relationship: Resident belongs to a user.
     */
    public function user()
    {
        return $this->belongsTo(\App\Models\User::class, 'user_id');
    }

    /**
     * Relationship: Resident belongs to a profile.
     */
    public function profile()
    {
        return $this->belongsTo(\App\Models\Profile::class, 'profile_id');
    }

    /**
     * Relationship: Resident has many application submissions.
     */
    public function applicationSubmissions()
    {
        return $this->hasMany(\App\Models\ApplicationSubmission::class, 'resident_id');
    }
}
