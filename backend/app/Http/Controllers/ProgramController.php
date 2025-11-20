<?php

namespace App\Http\Controllers;

use App\Models\Program;
use App\Models\Beneficiary;
use App\Models\Resident;
use App\Models\ResidentNotification;
use App\Models\User;
use App\Notifications\ProgramCreatedNotification;
use App\Services\ActivityLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;

class ProgramController extends Controller
{
    public function index()
    {
        return response()->json(Program::all());
    }

    public function store(Request $request)
    {
        // Convert empty string to null for payout_date before validation
        if ($request->has('payout_date') && $request->input('payout_date') === '') {
            $request->merge(['payout_date' => null]);
        }
        
        $data = $request->validate([
            'name' => 'required|string',
            'description' => 'nullable|string',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'beneficiary_type' => 'nullable|string',
            'assistance_type' => 'nullable|string',
            'amount' => 'nullable|numeric',
            'max_beneficiaries' => 'nullable|integer|min:1',
            'status' => 'required|string',
            'payout_date' => 'nullable|date|after:now',
        ]);
        
        // Ensure payout_date is null if empty (double check)
        if (isset($data['payout_date']) && ($data['payout_date'] === '' || $data['payout_date'] === null)) {
            $data['payout_date'] = null;
        }
        
        $program = Program::create($data);
        
        // Log program creation activity
        $user = Auth::user();
        if ($user) {
            $userRole = $user->role;
            $amountInfo = $data['amount'] ? " (Amount: ₱" . number_format($data['amount'], 2) . ")" : "";
            $description = $userRole === 'admin'
                ? "Admin {$user->name} created program: {$program->name}{$amountInfo}"
                : ($userRole === 'staff'
                    ? "Staff {$user->name} created program: {$program->name}{$amountInfo}"
                    : "Program created: {$program->name}{$amountInfo}");
            
            ActivityLogService::log(
                'program_created',
                $program,
                null,
                $program->toArray(),
                $description,
                $request
            );
        }

        // Send notifications to all residents about new program
        $this->notifyAllResidents($program);
        
        return response()->json($program, 201);
    }

    /**
     * Send notification to all residents about new program
     */
    private function notifyAllResidents(Program $program)
    {
        try {
            // Get all resident users (role = 'resident' or 'residents')
            $residentUsers = User::whereIn('role', ['resident', 'residents'])
                ->whereNotNull('email')
                ->get();

            $notification = new ProgramCreatedNotification($program);
            
            foreach ($residentUsers as $user) {
                try {
                    $user->notify($notification);
                } catch (\Exception $e) {
                    Log::warning('Failed to send program notification to user', [
                        'user_id' => $user->id,
                        'email' => $user->email,
                        'error' => $e->getMessage()
                    ]);
                }
            }

            Log::info('Program notifications sent to all residents', [
                'program_id' => $program->id,
                'recipients_count' => $residentUsers->count()
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to send program notifications to residents', [
                'program_id' => $program->id,
                'error' => $e->getMessage()
            ]);
        }
    }

    public function show($id)
    {
        return response()->json(Program::findOrFail($id));
    }

    public function update(Request $request, $id)
    {
        $program = Program::findOrFail($id);
        
        // Convert empty string to null for payout_date before validation
        if ($request->has('payout_date') && $request->input('payout_date') === '') {
            $request->merge(['payout_date' => null]);
        }
        
        $data = $request->validate([
            'name' => 'sometimes|required|string',
            'description' => 'nullable|string',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'beneficiary_type' => 'nullable|string',
            'assistance_type' => 'nullable|string',
            'amount' => 'nullable|numeric',
            'max_beneficiaries' => 'nullable|integer|min:1',
            'status' => 'required|string',
            'payout_date' => 'nullable|date|after:now',
        ]);
        
        // Ensure payout_date is null if empty (double check)
        if (isset($data['payout_date']) && ($data['payout_date'] === '' || $data['payout_date'] === null)) {
            $data['payout_date'] = null;
        }
        
        \Log::info('Program update data:', $data);
        $oldValues = $program->getOriginal();
        $program->update($data);
        \Log::info('Program updated:', $program->toArray());
        
        // Log program update activity
        $user = Auth::user();
        if ($user) {
            $userRole = $user->role;
            $description = $userRole === 'admin'
                ? "Admin {$user->name} updated program: {$program->name}"
                : ($userRole === 'staff'
                    ? "Staff {$user->name} updated program: {$program->name}"
                    : "Program updated: {$program->name}");
            
            ActivityLogService::log(
                'program_updated',
                $program,
                $oldValues,
                $program->toArray(),
                $description,
                $request
            );
        }
        
        return response()->json($program);
    }

    public function destroy($id)
    {
        try {
            $program = Program::findOrFail($id);
            
            // Get count of beneficiaries before deletion for logging
            $beneficiaryCount = $program->beneficiaries()->count();
            
            // Delete all beneficiaries associated with this program
            $program->beneficiaries()->delete();
            
            // Delete the program itself
            $program->delete();
            
            // Log the deletion for audit purposes
            Log::info("Program deleted with cascade deletion", [
                'program_id' => $id,
                'program_name' => $program->name,
                'beneficiaries_deleted' => $beneficiaryCount
            ]);
            
            return response()->json([
                'message' => 'Program and associated beneficiaries deleted successfully',
                'beneficiaries_deleted' => $beneficiaryCount
            ], 200);
            
        } catch (\Exception $e) {
            Log::error("Error deleting program with cascade deletion", [
                'program_id' => $id,
                'error' => $e->getMessage()
            ]);
            
            return response()->json([
                'error' => 'Failed to delete program: ' . $e->getMessage()
            ], 500);
        }
    }

    public function getForResidents()
    {
        // Only return programs that are not in draft status
        $programs = Program::where('status', '!=', 'draft')
            ->where(function($query) {
                $query->where('status', 'ongoing')
                      ->orWhere('status', 'complete')
                      ->orWhereNull('status'); // Include programs with no status set (legacy)
            })
            ->get()
            ->map(function($program) {
                // Add current beneficiary count to each program
                $currentBeneficiaries = $program->beneficiaries()->count();
                $program->current_beneficiaries = $currentBeneficiaries;
                $program->is_full = $program->max_beneficiaries && $currentBeneficiaries >= $program->max_beneficiaries;
                return $program;
            });
        
        return response()->json($programs);
    }

    /**
     * Send payout date change notification to all beneficiaries
     */
    public function notifyPayoutChange(Request $request, $id)
    {
        try {
            $program = Program::findOrFail($id);
            
            $request->validate([
                'new_payout_date' => 'required|date',
                'program_name' => 'required|string'
            ]);

            // Get all beneficiaries for this program
            $beneficiaries = Beneficiary::where('program_id', $id)
                ->where('visible_to_resident', true)
                ->get();

            if ($beneficiaries->isEmpty()) {
                return response()->json([
                    'success' => false,
                    'message' => 'No beneficiaries found for this program'
                ], 404);
            }

            $newPayoutDate = $request->new_payout_date;
            $programName = $request->program_name;
            $emailsSent = 0;
            $notificationsCreated = 0;
            $errors = [];

            // Format the payout date for display
            $formattedDate = \Carbon\Carbon::parse($newPayoutDate)
                ->format('F j, Y \a\t g:i A');

            foreach ($beneficiaries as $beneficiary) {
                try {
                    // Extract name from beneficiary name field
                    $beneficiaryName = $beneficiary->name;
                    
                    // Send email notification
                    if ($beneficiary->email && filter_var($beneficiary->email, FILTER_VALIDATE_EMAIL)) {
                        Mail::send('emails.payout-date-change', [
                            'beneficiaryName' => $beneficiaryName,
                            'programName' => $programName,
                            'newPayoutDate' => $formattedDate,
                            'newPayoutDateTime' => $newPayoutDate
                        ], function ($message) use ($beneficiary, $programName) {
                            $message->to($beneficiary->email)
                                    ->subject("Updated Payout Schedule for {$programName}");
                        });
                        $emailsSent++;
                    } else {
                        Log::warning("Invalid or missing email for beneficiary {$beneficiary->name}: {$beneficiary->email}");
                    }

                    // Create database notification for resident
                    // Try multiple matching strategies
                    $resident = null;
                    
                    // Strategy 1: Exact name match
                    $resident = Resident::whereRaw("CONCAT(first_name, ' ', last_name) = ?", [$beneficiaryName])->first();
                    
                    // Strategy 2: Email match if exact name fails
                    if (!$resident && $beneficiary->email) {
                        $resident = Resident::whereHas('user', function($query) use ($beneficiary) {
                            $query->where('email', $beneficiary->email);
                        })->first();
                    }
                    
                    // Strategy 3: Partial name match if others fail
                    if (!$resident) {
                        $nameParts = explode(' ', $beneficiaryName);
                        if (count($nameParts) >= 2) {
                            $firstName = $nameParts[0];
                            $lastName = $nameParts[1];
                            $resident = Resident::where('first_name', 'LIKE', '%' . $firstName . '%')
                                ->where('last_name', 'LIKE', '%' . $lastName . '%')
                                ->first();
                        }
                    }

                    if ($resident) {
                        ResidentNotification::create([
                            'resident_id' => $resident->id,
                            'program_id' => $id,
                            'type' => 'payout_change',
                            'title' => 'Payout Schedule Updated',
                            'message' => "The payout schedule for '{$programName}' has been updated to {$formattedDate}",
                            'data' => [
                                'program_name' => $programName,
                                'new_payout_date' => $newPayoutDate,
                                'formatted_date' => $formattedDate
                            ]
                        ]);
                        $notificationsCreated++;
                    }

                    Log::info("Payout change notification sent to {$beneficiary->name} ({$beneficiary->email})");

                } catch (\Exception $e) {
                    $errors[] = "Failed to send notification to {$beneficiary->name}: " . $e->getMessage();
                    Log::error("Failed to send payout change notification to {$beneficiary->name}: " . $e->getMessage());
                }
            }

            return response()->json([
                'success' => true,
                'message' => "Payout change notifications sent successfully",
                'data' => [
                    'emails_sent' => $emailsSent,
                    'notifications_created' => $notificationsCreated,
                    'total_beneficiaries' => $beneficiaries->count(),
                    'errors' => $errors
                ]
            ]);

        } catch (\Exception $e) {
            Log::error("Error sending payout change notifications: " . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to send notifications: ' . $e->getMessage()
            ], 500);
        }
    }
}
