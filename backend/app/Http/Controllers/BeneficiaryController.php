<?php

namespace App\Http\Controllers;

use App\Models\Beneficiary;
use App\Models\Resident;
use App\Models\ResidentNotification;
use App\Services\ActivityLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;

class BeneficiaryController extends Controller
{
    /**
     * Get enabled beneficiaries for the My Benefits section
     */
    public function getMyBenefits(Request $request)
    {
        $user = $request->user();
        
        // Find the resident record for the current user
        $resident = \App\Models\Resident::where('user_id', $user->id)->first();
        
        if (!$resident) {
            return response()->json([
                'message' => 'No resident profile found for this user',
                'benefits' => []
            ]);
        }

        // Get benefits for this resident that are visible and approved
        $benefits = Beneficiary::with(['program'])
            ->where('visible_to_resident', true)
            ->where('status', 'Approved')
            ->where(function($query) use ($resident) {
                // More flexible name matching
                $firstName = trim($resident->first_name);
                $lastName = trim($resident->last_name);
                
                $query->where(function($q) use ($firstName, $lastName) {
                    // Match first name AND last name in any order
                    $q->where('name', 'LIKE', '%' . $firstName . '%')
                      ->where('name', 'LIKE', '%' . $lastName . '%');
                });
            })
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'beneficiaries' => $benefits,
            'total' => $benefits->count(),
            'message' => $benefits->count() > 0 
                ? 'Benefits loaded successfully' 
                : 'No benefits available yet. Apply for programs to see them here.'
        ]);
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
    $query = Beneficiary::with(['program', 'resident']);
        if ($request->has('beneficiary_type')) {
            $query->where('beneficiary_type', $request->beneficiary_type);
        }
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }
        if ($request->has('assistance_type')) {
            $query->where('assistance_type', $request->assistance_type);
        }
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('name', 'like', "%$search%")
                  ->orWhere('email', 'like', "%$search%")
                  ->orWhere('contact_number', 'like', "%$search%")
                  ->orWhere('full_address', 'like', "%$search%")
                  ->orWhere('remarks', 'like', "%$search%")
                  ->orWhere('beneficiary_type', 'like', "%$search%")
                  ->orWhere('assistance_type', 'like', "%$search%")
                  ->orWhere('status', 'like', "%$search%")
                  ;
            });
        }
        return response()->json($query->orderByDesc('id')->get());
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'program_id' => 'nullable|exists:programs,id',
            'name' => 'required|string',
            'beneficiary_type' => 'required|string',
            'status' => 'string',
            'assistance_type' => 'required|string',
            'amount' => 'nullable|numeric',
            'contact_number' => 'nullable|string',
            'email' => 'nullable|email',
            'full_address' => 'nullable|string',
            'application_date' => 'nullable|date',
            'approved_date' => 'nullable|date',
            'remarks' => 'nullable|string',
            'attachment' => 'nullable|file',
        ]);

        // Enforce max_beneficiaries limit
        if (!empty($data['program_id'])) {
            $program = \App\Models\Program::find($data['program_id']);
            if ($program && $program->max_beneficiaries) {
                $currentCount = \App\Models\Beneficiary::where('program_id', $program->id)->count();
                if ($currentCount >= $program->max_beneficiaries) {
                    return response()->json(['message' => 'Maximum number of beneficiaries reached for this program.'], 422);
                }
            }
        }
        if ($request->hasFile('attachment')) {
            $data['attachment'] = $request->file('attachment')->store('attachments');
        }
        $beneficiary = Beneficiary::create($data);
        $beneficiary->load('program');
        
        // Log beneficiary creation activity
        $user = Auth::user();
        if ($user) {
            $userRole = $user->role;
            $programName = $beneficiary->program ? $beneficiary->program->name : 'N/A';
            $amountInfo = $data['amount'] ? " (Amount: ₱" . number_format($data['amount'], 2) . ")" : "";
            $paidStatus = isset($data['status']) && strtolower($data['status']) === 'paid' ? " - PAID" : "";
            
            $description = $userRole === 'admin'
                ? "Admin {$user->name} added beneficiary {$beneficiary->name} to program: {$programName}{$amountInfo}{$paidStatus}"
                : ($userRole === 'staff'
                    ? "Staff {$user->name} added beneficiary {$beneficiary->name} to program: {$programName}{$amountInfo}{$paidStatus}"
                    : "Beneficiary {$beneficiary->name} added to program: {$programName}{$amountInfo}{$paidStatus}");
            
            ActivityLogService::log(
                $paidStatus ? 'beneficiary_added_paid' : 'beneficiary_added',
                $beneficiary,
                null,
                $beneficiary->toArray(),
                $description,
                $request
            );
        }
        
        return response()->json($beneficiary, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show($id)
    {
        $beneficiary = Beneficiary::with(['disbursements', 'program'])->findOrFail($id);
        return response()->json($beneficiary);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Beneficiary $beneficiary)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, $id)
    {
        $beneficiary = Beneficiary::findOrFail($id);
        $data = $request->validate([
            'program_id' => 'nullable|exists:programs,id',
            'name' => 'sometimes|required|string',
            'beneficiary_type' => 'sometimes|required|string',
            'status' => 'string',
            'assistance_type' => 'sometimes|required|string',
            'amount' => 'nullable|numeric',
            'contact_number' => 'nullable|string',
            'email' => 'nullable|email',
            'full_address' => 'nullable|string',
            'application_date' => 'nullable|date',
            'approved_date' => 'nullable|date',
            'remarks' => 'nullable|string',
            'attachment' => 'nullable|file',
            'my_benefits_enabled' => 'boolean',
        ]);
        if ($request->hasFile('attachment')) {
            if ($beneficiary->attachment) {
                Storage::delete($beneficiary->attachment);
            }
            $data['attachment'] = $request->file('attachment')->store('attachments');
        }
        $beneficiary->update($data);
        $beneficiary->load('program');
        return response()->json($beneficiary);
    }

    /**
     * Remove the specified resource from storage.
     */
    /**
     * Toggle visibility to resident for a beneficiary
     */
    public function toggleVisibility(Request $request, $id)
    {
        \Log::info('toggleVisibility called', [
            'beneficiary_id' => $id,
            'request_data' => $request->all(),
            'user_id' => $request->user()->id ?? 'none'
        ]);

        $beneficiary = Beneficiary::findOrFail($id);
        
        \Log::info('Found beneficiary', [
            'beneficiary_id' => $beneficiary->id,
            'beneficiary_name' => $beneficiary->name,
            'current_visible_to_resident' => $beneficiary->visible_to_resident,
            'status' => $beneficiary->status
        ]);
        
        // Validate the request
        $data = $request->validate([
            'visible' => 'required|boolean',
        ]);

        \Log::info('Request validated', ['visible' => $data['visible']]);

        // Update the beneficiary
        $beneficiary->visible_to_resident = $data['visible'];
        $beneficiary->save();

        \Log::info('Beneficiary visibility updated', [
            'beneficiary_id' => $beneficiary->id,
            'new_visible_to_resident' => $beneficiary->visible_to_resident
        ]);

        // Return the updated status
        return response()->json([
            'message' => 'Visibility status updated successfully',
            'visible' => $beneficiary->visible_to_resident
        ]);
    }


    public function destroy($id)
    {
        $beneficiary = Beneficiary::findOrFail($id);
        if ($beneficiary->attachment) {
            Storage::delete($beneficiary->attachment);
        }
        $beneficiary->delete();
        return response()->json(['message' => 'Deleted']);
    }

    /**
     * Get program tracking information for a beneficiary
     */
    public function getProgramTracking(Request $request, $id)
    {
        $user = $request->user();
        
        // Find the resident record for the current user
        $resident = \App\Models\Resident::where('user_id', $user->id)->first();
        
        if (!$resident) {
            return response()->json([
                'success' => false,
                'message' => 'Resident profile not found'
            ], 400);
        }

        // Get the beneficiary record
        $beneficiary = Beneficiary::with(['program', 'resident'])
            ->where('id', $id)
            ->where('visible_to_resident', true)
            ->where(function($query) use ($resident) {
                $firstName = trim($resident->first_name);
                $lastName = trim($resident->last_name);
                
                $query->where(function($q) use ($firstName, $lastName) {
                    $q->where('name', 'LIKE', '%' . $firstName . '%')
                      ->where('name', 'LIKE', '%' . $lastName . '%');
                });
            })
            ->first();

        if (!$beneficiary) {
            return response()->json([
                'success' => false,
                'message' => 'Program not found or access denied'
            ], 404);
        }

        // Get the application submission data
        $submission = \App\Models\ApplicationSubmission::with([
            'form.program',
            'submissionData.field',
            'reviewer'
        ])
        ->where('resident_id', $resident->id)
        ->whereHas('form', function($query) use ($beneficiary) {
            $query->where('program_id', $beneficiary->program_id);
        })
        ->first();

        // Determine tracking stage based on status and payout date
        $trackingStage = $this->determineTrackingStage($beneficiary, $submission, $beneficiary->program);
        
        // Format submission data
        $submissionData = [];
        if ($submission) {
            foreach ($submission->submissionData as $data) {
                $field = $data->field;
                if ($field) {
                    $submissionData[$field->field_name] = [
                        'label' => $field->field_label,
                        'value' => $data->field_value,
                        'type' => $field->field_type,
                        'is_file' => $field->field_type === 'file',
                        'file_url' => $data->getFileUrl(),
                        'file_original_name' => $data->file_original_name,
                        'file_size' => $data->file_size
                    ];
                }
            }
        }

        return response()->json([
            'success' => true,
            'data' => [
                'beneficiary' => [
                    'id' => $beneficiary->id,
                    'name' => $beneficiary->name,
                    'beneficiary_type' => $beneficiary->beneficiary_type,
                    'assistance_type' => $beneficiary->assistance_type,
                    'amount' => $beneficiary->amount,
                    'status' => $beneficiary->status,
                    'application_date' => $beneficiary->application_date,
                    'approved_date' => $beneficiary->approved_date,
                    'remarks' => $beneficiary->remarks,
                    'proof_of_payout' => $beneficiary->proof_of_payout,
                    'proof_of_payout_url' => $beneficiary->proof_of_payout ? asset('storage/' . $beneficiary->proof_of_payout) : null,
                    'receipt_number' => $beneficiary->receipt_number,
                    'receipt_number_validated' => $beneficiary->receipt_number_validated,
                    'is_paid' => $beneficiary->is_paid,
                    'proof_comment' => $beneficiary->proof_comment
                ],
                'program' => $beneficiary->program ? [
                    'id' => $beneficiary->program->id,
                    'name' => $beneficiary->program->name,
                    'description' => $beneficiary->program->description,
                    'assistance_type' => $beneficiary->program->assistance_type
                ] : null,
                'submission' => $submission ? [
                    'id' => $submission->id,
                    'status' => $submission->status,
                    'submitted_at' => $submission->submitted_at,
                    'reviewed_at' => $submission->reviewed_at,
                    'admin_notes' => $submission->admin_notes,
                    'reviewer' => $submission->reviewer ? [
                        'name' => $submission->reviewer->name,
                        'email' => $submission->reviewer->email
                    ] : null,
                    'submission_data' => $submissionData
                ] : null,
                'tracking' => [
                    'current_stage' => $trackingStage,
                    'payout_date' => $beneficiary->program ? $beneficiary->program->payout_date : null,
                    'is_paid' => $beneficiary->is_paid,
                    'stages' => [
                        [
                            'stage' => 1,
                            'title' => 'Application Approved',
                            'description' => 'Your application has been approved',
                            'completed' => $trackingStage >= 1,
                            'active' => $trackingStage === 1
                        ],
                        [
                            'stage' => 2,
                            'title' => 'Waiting for Payout',
                            'description' => $beneficiary->program && $beneficiary->program->payout_date 
                                ? 'Your benefit payout is on ' . $beneficiary->program->payout_date->format('F j, Y \a\t g:i A')
                                : 'Processing your benefit payout',
                            'completed' => $trackingStage >= 2,
                            'active' => $trackingStage === 2
                        ],
                        [
                            'stage' => 3,
                            'title' => ($beneficiary->program && (
                                $beneficiary->program->assistance_type === 'Non-monetary Assistance' ||
                                $beneficiary->program->assistance_type === 'Non-monetary' ||
                                $beneficiary->assistance_type === 'Non-monetary Assistance' ||
                                $beneficiary->assistance_type === 'Non-monetary'
                            )) 
                                ? 'Complete Program - Mark as Received'
                                : 'Complete Program - Enter Receipt Number',
                            'description' => ($beneficiary->program && (
                                $beneficiary->program->assistance_type === 'Non-monetary Assistance' ||
                                $beneficiary->program->assistance_type === 'Non-monetary' ||
                                $beneficiary->assistance_type === 'Non-monetary Assistance' ||
                                $beneficiary->assistance_type === 'Non-monetary'
                            ))
                                ? ($beneficiary->is_paid 
                                    ? 'Confirm receipt of the non-monetary assistance to complete the program (You have been marked as paid)'
                                    : 'Confirm receipt of the non-monetary assistance to complete the program')
                                : ($beneficiary->is_paid 
                                    ? 'Enter your receipt number to complete the program (You have been marked as paid)'
                                    : 'Enter your receipt number to complete the program'),
                            'completed' => $trackingStage > 3, // Only completed when stage 4 (receipt validated)
                            'active' => $trackingStage === 3
                        ],
                        [
                            'stage' => 4,
                            'title' => 'Completed',
                            'description' => 'Program completed successfully',
                            'completed' => $trackingStage >= 4,
                            'active' => $trackingStage === 4
                        ]
                    ]
                ]
            ]
        ]);
    }

    /**
     * Upload proof of payout
     */
    public function uploadProofOfPayout(Request $request, $id)
    {
        $user = $request->user();
        
        // Find the resident record for the current user
        $resident = \App\Models\Resident::where('user_id', $user->id)->first();
        
        if (!$resident) {
            return response()->json([
                'success' => false,
                'message' => 'Resident profile not found'
            ], 400);
        }

        // Get the beneficiary record
        $beneficiary = Beneficiary::with(['program'])
            ->where('id', $id)
            ->where('visible_to_resident', true)
            ->where(function($query) use ($resident) {
                $firstName = trim($resident->first_name);
                $lastName = trim($resident->last_name);
                
                $query->where(function($q) use ($firstName, $lastName) {
                    $q->where('name', 'LIKE', '%' . $firstName . '%')
                      ->where('name', 'LIKE', '%' . $lastName . '%');
                });
            })
            ->first();

        if (!$beneficiary) {
            return response()->json([
                'success' => false,
                'message' => 'Program not found or access denied'
            ], 404);
        }
        
        // Validate the request
        $request->validate([
            'proof_file' => 'required|file|mimes:jpeg,png,jpg,pdf|max:10240', // 10MB max
            'comment' => 'required|string|max:1000'
        ]);

        // Delete old proof if exists
        if ($beneficiary->proof_of_payout) {
            Storage::delete($beneficiary->proof_of_payout);
        }

        // Store the new proof file
        $file = $request->file('proof_file');
        $path = $file->store('proof-of-payouts');

        // Update the beneficiary record
        $beneficiary->proof_of_payout = $path;
        $beneficiary->proof_comment = $request->comment;
        $beneficiary->save();

        return response()->json([
            'success' => true,
            'message' => 'Proof of payout uploaded successfully',
            'data' => [
                'proof_url' => asset('storage/' . $path),
                'file_name' => $file->getClientOriginalName(),
                'file_size' => $file->getSize()
            ]
        ]);
    }

    /**
     * Validate receipt number and complete the program
     */
    public function validateReceipt(Request $request, $id)
    {
        $user = $request->user();
        
        // Find the resident record for the current user
        $resident = \App\Models\Resident::where('user_id', $user->id)->first();
        
        if (!$resident) {
            return response()->json([
                'success' => false,
                'message' => 'Resident profile not found'
            ], 400);
        }

        // Get the beneficiary record
        $beneficiary = Beneficiary::with(['program'])
            ->where('id', $id)
            ->where('visible_to_resident', true)
            ->where(function($query) use ($resident) {
                $firstName = trim($resident->first_name);
                $lastName = trim($resident->last_name);
                
                $query->where(function($q) use ($firstName, $lastName) {
                    $q->where('name', 'LIKE', '%' . $firstName . '%')
                      ->where('name', 'LIKE', '%' . $lastName . '%');
                });
            })
            ->first();

        if (!$beneficiary) {
            return response()->json([
                'success' => false,
                'message' => 'Program not found or access denied'
            ], 404);
        }

        // Check if this is a non-monetary program
        $isNonMonetary = $beneficiary->program && (
            $beneficiary->program->assistance_type === 'Non-monetary Assistance' ||
            $beneficiary->program->assistance_type === 'Non-monetary' ||
            $beneficiary->assistance_type === 'Non-monetary Assistance' ||
            $beneficiary->assistance_type === 'Non-monetary'
        );

        // Validate the request based on program type
        if ($isNonMonetary) {
            // For non-monetary programs, receipt_number is not required
            $request->validate([
                'proof_file' => 'nullable|file|mimes:jpeg,png,jpg,pdf|max:10240', // 10MB max
                'comment' => 'nullable|string|max:1000'
            ]);
        } else {
            // For monetary programs, receipt_number is required
            $request->validate([
                'receipt_number' => 'required|string|max:255',
                'proof_file' => 'nullable|file|mimes:jpeg,png,jpg,pdf|max:10240', // 10MB max
                'comment' => 'nullable|string|max:1000'
            ]);

            // Check if the receipt number matches the beneficiary's receipt number
            if ($beneficiary->receipt_number !== $request->receipt_number) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid receipt number. Please check the receipt sent to your email.'
                ], 400);
            }

            // Check if the beneficiary is marked as paid
            if (!$beneficiary->is_paid) {
                return response()->json([
                    'success' => false,
                    'message' => 'Benefit has not been marked as paid yet. Please wait for the admin to process your payment.'
                ], 400);
            }
        }

        // Handle optional file upload
        $proofUrl = null;
        if ($request->hasFile('proof_file')) {
            // Delete old proof if exists
            if ($beneficiary->proof_of_payout) {
                Storage::delete($beneficiary->proof_of_payout);
            }

            // Store the new proof file
            $file = $request->file('proof_file');
            $path = $file->store('proof-of-payouts');
            $proofUrl = asset('storage/' . $path);
            
            // Update the beneficiary record with file info
            $beneficiary->proof_of_payout = $path;
        }

        // Update comment if provided
        if ($request->has('comment')) {
            $beneficiary->proof_comment = $request->comment;
        }

        // For non-monetary programs, mark as received/completed without receipt validation
        // For monetary programs, mark receipt as validated
        if ($isNonMonetary) {
            $beneficiary->receipt_number_validated = true;
            $beneficiary->status = 'Completed';
            $message = 'Program marked as received successfully!';
        } else {
            $beneficiary->receipt_number_validated = true;
            $beneficiary->status = 'Completed';
            $message = 'Receipt number validated successfully! Program completed.';
        }
        
        $beneficiary->save();

        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => [
                'receipt_number' => $isNonMonetary ? null : $beneficiary->receipt_number,
                'proof_url' => $proofUrl,
                'status' => 'Completed',
                'is_non_monetary' => $isNonMonetary
            ]
        ]);
    }

    /**
     * Determine the current tracking stage based on beneficiary and submission status
     */
    private function determineTrackingStage($beneficiary, $submission, $program)
    {
        // If receipt is validated or status is Completed, all stages are completed (Stage 4)
        if ($beneficiary->receipt_number_validated || $beneficiary->status === 'Completed') {
            return 4;
        }
        
        // Stage 1: Application approved
        if ($beneficiary->status === 'Approved' && $submission && $submission->status === 'approved') {
            // Check if payout date has been reached
            $payoutDateReached = false;
            if ($program && $program->payout_date) {
                try {
                    $payoutDate = \Carbon\Carbon::parse($program->payout_date);
                    $now = \Carbon\Carbon::now();
                    // Check if current time is greater than or equal to payout date/time
                    $payoutDateReached = $now->greaterThanOrEqualTo($payoutDate);
                } catch (\Exception $e) {
                    \Log::warning('Error parsing payout date', [
                        'payout_date' => $program->payout_date,
                        'error' => $e->getMessage()
                    ]);
                }
            }
            
            // Stage 3: If payout date has been reached OR beneficiary is marked as paid
            // This allows residents to complete the program once payout date arrives
            if ($payoutDateReached || ($beneficiary->is_paid && !$beneficiary->receipt_number_validated)) {
                return 3;
            }
            
            // Stage 2: Waiting for payout (if not marked as paid yet and payout date not reached)
            if (!$beneficiary->is_paid) {
                return 2;
            }
        }
        
        // If not approved yet, return stage 1
        return 1;
    }

    /**
     * Mark a beneficiary as paid
     */
    public function markPaid(Request $request, $id)
    {
        try {
            $beneficiary = Beneficiary::with('program')->findOrFail($id);
            
            \Log::info('Starting receipt generation for beneficiary', [
                'beneficiary_id' => $beneficiary->id,
                'beneficiary_name' => $beneficiary->name,
                'program_id' => $beneficiary->program_id
            ]);
            
            // Generate receipt
            $receiptService = new \App\Services\ReceiptService();
            $receiptData = $receiptService->generateReceipt($beneficiary);
            
            \Log::info('Receipt generated successfully', [
                'beneficiary_id' => $beneficiary->id,
                'receipt_path' => $receiptData['path'],
                'receipt_number' => $receiptData['receipt_number']
            ]);
            
            // Update the beneficiary to mark as paid and store receipt info
            $beneficiary->update([
                'is_paid' => true,
                'paid_at' => now(),
                'receipt_path' => $receiptData['path'],
                'receipt_number' => $receiptData['receipt_number']
            ]);
            
            return response()->json([
                'success' => true,
                'message' => 'Beneficiary marked as paid successfully',
                'beneficiary' => $beneficiary,
                'receipt' => [
                    'url' => $receiptData['url'],
                    'filename' => $receiptData['filename'],
                    'receipt_number' => $receiptData['receipt_number']
                ]
            ]);
            
        } catch (\Exception $e) {
            \Log::error('Failed to mark beneficiary as paid', [
                'beneficiary_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to mark beneficiary as paid: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Download receipt for a beneficiary
     */
    public function downloadReceipt($id)
    {
        try {
            $beneficiary = Beneficiary::findOrFail($id);
            
            \Log::info('Receipt download attempt', [
                'beneficiary_id' => $beneficiary->id,
                'receipt_path' => $beneficiary->receipt_path,
                'receipt_number' => $beneficiary->receipt_number
            ]);
            
            if (!$beneficiary->receipt_path) {
                \Log::warning('No receipt path found', ['beneficiary_id' => $beneficiary->id]);
                return response()->json([
                    'success' => false,
                    'message' => 'No receipt found for this beneficiary'
                ], 404);
            }
            
            $filePath = storage_path('app/public/' . $beneficiary->receipt_path);
            
            \Log::info('Checking file path', [
                'file_path' => $filePath,
                'exists' => file_exists($filePath)
            ]);
            
            if (!file_exists($filePath)) {
                \Log::warning('Receipt file not found', [
                    'file_path' => $filePath,
                    'beneficiary_id' => $beneficiary->id
                ]);
        return response()->json([
                    'success' => false,
                    'message' => 'Receipt file not found'
                ], 404);
            }
            
            return response()->download($filePath, $beneficiary->receipt_number . '.pdf');
            
        } catch (\Exception $e) {
            \Log::error('Receipt download error', [
                'beneficiary_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to download receipt: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Send notice to beneficiary (for non-monetary assistance)
     */
    public function sendNotice(Request $request, $id)
    {
        try {
            $beneficiary = Beneficiary::with('program')->findOrFail($id);
            
            // Validate request
            $validated = $request->validate([
                'message' => 'required|string',
                'program_id' => 'required|exists:programs,id',
            ]);

            // Find resident associated with beneficiary
            // Try to match by name and email
            $resident = null;
            
            // Strategy 1: Match by email if available
            if ($beneficiary->email) {
                $resident = Resident::with('user')->whereHas('user', function($query) use ($beneficiary) {
                    $query->where('email', $beneficiary->email);
                })->first();
            }
            
            // Strategy 2: Match by name if email match fails
            if (!$resident && $beneficiary->name) {
                $nameParts = explode(' ', trim($beneficiary->name));
                if (count($nameParts) >= 2) {
                    $firstName = $nameParts[0];
                    $lastName = implode(' ', array_slice($nameParts, 1));
                    $resident = Resident::with('user')->where('first_name', 'LIKE', '%' . $firstName . '%')
                        ->where('last_name', 'LIKE', '%' . $lastName . '%')
                        ->first();
                }
            }
            
            Log::info('Resident matching result', [
                'beneficiary_id' => $beneficiary->id,
                'beneficiary_email' => $beneficiary->email,
                'beneficiary_name' => $beneficiary->name,
                'resident_found' => $resident ? true : false,
                'resident_id' => $resident ? $resident->id : null
            ]);

            $emailsSent = 0;
            $notificationsCreated = 0;
            $emailRecipients = [];

            // Determine email addresses to send to
            $emailsToSend = [];
            
            // Priority 1: Always try beneficiary's email first (most direct)
            if ($beneficiary->email && filter_var($beneficiary->email, FILTER_VALIDATE_EMAIL)) {
                $emailsToSend[] = $beneficiary->email;
                Log::info('Added beneficiary email to send list', [
                    'beneficiary_id' => $beneficiary->id,
                    'email' => $beneficiary->email
                ]);
            }
            
            if ($resident) {
                // Create in-app notification
                try {
                    $notification = ResidentNotification::create([
                        'resident_id' => $resident->id,
                        'program_id' => $validated['program_id'],
                        'type' => 'program_notice',
                        'title' => 'Notice: ' . ($beneficiary->program->name ?? 'Program Notice'),
                        'message' => $validated['message'],
                        'data' => [
                            'beneficiary_id' => $beneficiary->id,
                            'beneficiary_name' => $beneficiary->name,
                            'program_id' => $validated['program_id'],
                            'program_name' => $beneficiary->program->name ?? 'Program',
                            'sent_at' => now()->toISOString(),
                            'redirect_path' => '/residents/enrolledPrograms?program=' . $validated['program_id'] . '&beneficiary=' . $beneficiary->id
                        ],
                        'is_read' => false
                    ]);
                    $notificationsCreated++;
                    Log::info('Resident notification created', [
                        'notification_id' => $notification->id,
                        'resident_id' => $resident->id,
                        'beneficiary_id' => $beneficiary->id
                    ]);
                } catch (\Exception $e) {
                    Log::error('Failed to create resident notification', [
                        'resident_id' => $resident->id,
                        'beneficiary_id' => $beneficiary->id,
                        'error' => $e->getMessage()
                    ]);
                }

                // Get email from resident or user (add if not already in list)
                $residentEmail = null;
                if ($resident->email && filter_var($resident->email, FILTER_VALIDATE_EMAIL)) {
                    $residentEmail = $resident->email;
                } elseif ($resident->user && $resident->user->email && filter_var($resident->user->email, FILTER_VALIDATE_EMAIL)) {
                    $residentEmail = $resident->user->email;
                }
                
                if ($residentEmail && !in_array($residentEmail, $emailsToSend)) {
                    $emailsToSend[] = $residentEmail;
                    Log::info('Added resident email to send list', [
                        'resident_id' => $resident->id,
                        'email' => $residentEmail
                    ]);
                }
            }

            // Send emails to all collected addresses
            if (empty($emailsToSend)) {
                Log::warning('No email addresses found for notice', [
                    'beneficiary_id' => $beneficiary->id,
                    'beneficiary_email' => $beneficiary->email,
                    'resident_found' => $resident ? true : false,
                    'resident_email' => $resident ? ($resident->email ?? ($resident->user->email ?? 'N/A')) : 'N/A'
                ]);
            } else {
                Log::info('Preparing to send notice emails', [
                    'beneficiary_id' => $beneficiary->id,
                    'email_count' => count($emailsToSend),
                    'emails' => $emailsToSend
                ]);
            }

            foreach ($emailsToSend as $email) {
                if ($email && filter_var($email, FILTER_VALIDATE_EMAIL)) {
                    try {
                        Log::info('Attempting to send notice email', [
                            'beneficiary_id' => $beneficiary->id,
                            'email' => $email,
                            'program_id' => $validated['program_id'],
                            'program_name' => $beneficiary->program->name ?? 'Program'
                        ]);

                        // Use the same pattern as ProgramController for consistency
                        // Note: Using 'noticeMessage' instead of 'message' to avoid conflict with Laravel's $message variable
                        Mail::send('emails.beneficiary-notice', [
                            'beneficiaryName' => $beneficiary->name,
                            'programName' => $beneficiary->program->name ?? 'Program',
                            'noticeMessage' => $validated['message'],
                            'programId' => $validated['program_id']
                        ], function ($message) use ($email, $beneficiary) {
                            $programName = $beneficiary->program->name ?? 'Program Notice';
                            $message->to($email)
                                    ->subject("Notice: {$programName}");
                        });

                        $emailsSent++;
                        $emailRecipients[] = $email;
                        Log::info('Notice email sent successfully', [
                            'beneficiary_id' => $beneficiary->id,
                            'email' => $email
                        ]);
                    } catch (\Swift_TransportException $e) {
                        Log::error('Mail transport exception when sending notice email', [
                            'beneficiary_id' => $beneficiary->id,
                            'email' => $email,
                            'error' => $e->getMessage(),
                            'trace' => $e->getTraceAsString()
                        ]);
                    } catch (\Exception $e) {
                        Log::error('Failed to send notice email', [
                            'beneficiary_id' => $beneficiary->id,
                            'email' => $email,
                            'error' => $e->getMessage(),
                            'error_class' => get_class($e),
                            'trace' => $e->getTraceAsString()
                        ]);
                    }
                } else {
                    Log::warning('Invalid or missing email address for notice', [
                        'beneficiary_id' => $beneficiary->id,
                        'email' => $email ?: 'NULL'
                    ]);
                }
            }

            // Log activity
            $user = Auth::user();
            if ($user) {
                ActivityLogService::log(
                    'beneficiary_notice_sent',
                    $beneficiary,
                    null,
                    [
                        'message' => $validated['message'],
                        'emails_sent' => $emailsSent,
                        'notifications_created' => $notificationsCreated
                    ],
                    "Admin {$user->name} sent notice to beneficiary {$beneficiary->name}",
                    $request
                );
            }

            return response()->json([
                'success' => true,
                'message' => 'Notice sent successfully',
                'emails_sent' => $emailsSent,
                'notifications_created' => $notificationsCreated,
                'email_recipients' => $emailRecipients,
                'debug' => [
                    'beneficiary_email' => $beneficiary->email,
                    'resident_found' => $resident ? true : false,
                    'emails_attempted' => $emailsToSend
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to send notice to beneficiary', [
                'beneficiary_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to send notice: ' . $e->getMessage()
            ], 500);
        }
    }
}
