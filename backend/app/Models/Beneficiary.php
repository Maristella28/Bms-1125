<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Beneficiary extends Model
{
    use HasFactory;

    protected $fillable = [
        'program_id',
        'name',
        'beneficiary_type',
        'status',
        'my_benefits_enabled',
        'visible_to_resident',
        'assistance_type',
        'amount',
        'contact_number',
        'email',
        'full_address',
        'application_date',
        'approved_date',
        'remarks',
        'attachment',
        'proof_of_payout',
        'is_paid',
        'paid_at',
        'proof_comment',
        'receipt_path',
        'receipt_number',
        'receipt_number_validated',
    ];

    protected $casts = [
        'is_paid' => 'boolean',
        'paid_at' => 'datetime',
        'receipt_number_validated' => 'boolean',
    ];

    public function disbursements()
    {
        return $this->hasMany(Disbursement::class);
    }

    public function program()
    {
        return $this->belongsTo(Program::class);
    }

    // Add resident relationship
    public function resident()
    {
        return $this->belongsTo(\App\Models\Resident::class, 'resident_id', 'id');
    }
}
