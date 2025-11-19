<?php

namespace App\Http\Controllers;

use App\Models\HouseholdSurvey;
use App\Models\Household;
use App\Models\HouseholdChangeLog;
use App\Notifications\HouseholdSurveyNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;

class HouseholdSurveyController extends Controller
{
    /**
     * Get all surveys with filters
     */
    public function index(Request $request)
    {
        try {
            $query = HouseholdSurvey::with(['household', 'sentBy']);

            // Apply status filter
            if ($request->has('status') && $request->status !== 'all') {
                if ($request->status === 'expired') {
                    $query->where('status', 'pending')
                          ->where('expires_at', '<=', now());
                } else {
                    $query->where('status', $request->status);
                }
            }

            // Apply time period filter
            if ($request->has('time_period') && $request->time_period !== 'all') {
                $period = $request->time_period;
                switch ($period) {
                    case 'today':
                        $query->whereDate('sent_at', today());
                        break;
                    case 'week':
                        $query->whereBetween('sent_at', [now()->startOfWeek(), now()->endOfWeek()]);
                        break;
                    case 'month':
                        $query->whereMonth('sent_at', now()->month)
                              ->whereYear('sent_at', now()->year);
                        break;
                    case 'quarter':
                        $query->whereBetween('sent_at', [now()->startOfQuarter(), now()->endOfQuarter()]);
                        break;
                }
            }

            $surveys = $query->orderBy('created_at', 'desc')->get();

            // Map surveys with household info
            $mappedSurveys = $surveys->map(function ($survey) {
                return [
                    'id' => $survey->id,
                    'household_id' => $survey->household_id,
                    'household_no' => $survey->household->household_no ?? 'N/A',
                    'head_name' => $survey->household->head_full_name ?? 'N/A',
                    'survey_type' => $survey->survey_type,
                    'survey_type_label' => $survey->survey_type_label,
                    'notification_method' => $survey->notification_method,
                    'status' => $survey->isExpired() ? 'expired' : $survey->status,
                    'sent_at' => $survey->sent_at,
                    'opened_at' => $survey->opened_at,
                    'completed_at' => $survey->completed_at,
                    'expires_at' => $survey->expires_at,
                    'sent_by' => $survey->sentBy->name ?? 'System',
                ];
            });

            return response()->json([
                'success' => true,
                'data' => $mappedSurveys,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to fetch surveys: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch surveys',
            ], 500);
        }
    }

    /**
     * Get surveys for a specific household
     */
    public function getHouseholdSurveys($householdId)
    {
        try {
            $surveys = HouseholdSurvey::where('household_id', $householdId)
                ->orderBy('created_at', 'desc')
                ->get();

            $mappedSurveys = $surveys->map(function ($survey) {
                return [
                    'id' => $survey->id,
                    'survey_type' => $survey->survey_type,
                    'survey_type_label' => $survey->survey_type_label,
                    'notification_method' => $survey->notification_method,
                    'status' => $survey->isExpired() ? 'expired' : $survey->status,
                    'sent_at' => $survey->sent_at,
                    'completed_at' => $survey->completed_at,
                    'expires_at' => $survey->expires_at,
                ];
            });

            return response()->json([
                'success' => true,
                'data' => $mappedSurveys,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to fetch household surveys: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch household surveys',
            ], 500);
        }
    }

    /**
     * Send a new survey
     */
    public function sendSurvey(Request $request)
    {
        $request->validate([
            'household_id' => 'required|exists:households,id',
            'survey_type' => 'required|in:comprehensive,relocation,deceased,contact,quick',
            'notification_method' => 'required|in:email,sms,print',
            'questions' => 'required|array',
            'custom_message' => 'nullable|string',
            'expires_at' => 'nullable|date',
        ]);

        try {
            $household = Household::with('head')->findOrFail($request->household_id);

            // Create survey
            $survey = HouseholdSurvey::create([
                'household_id' => $household->id,
                'survey_type' => $request->survey_type,
                'notification_method' => $request->notification_method,
                'questions' => $request->questions,
                'custom_message' => $request->custom_message,
                'expires_at' => $request->expires_at ?? now()->addDays(30),
                'sent_by_user_id' => auth()->id(),
                'status' => 'sent',
            ]);

            // Send notification based on method
            $this->sendNotification($survey, $household);

            return response()->json([
                'success' => true,
                'message' => 'Survey sent successfully',
                'data' => [
                    'id' => $survey->id,
                    'survey_token' => $survey->survey_token,
                    'public_url' => $survey->getPublicUrl(),
                    'status' => $survey->status,
                ],
            ], 201);
        } catch (\Exception $e) {
            Log::error('Failed to send survey: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to send survey: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Send notification to household
     */
    private function sendNotification(HouseholdSurvey $survey, Household $household)
    {
        try {
            $surveyUrl = $survey->getPublicUrl();

            switch ($survey->notification_method) {
                case 'email':
                    $email = $household->head_email;
                    if ($email) {
                        Log::info("Sending survey email to: " . $email);
                        Mail::to($email)->send(
                            new \App\Mail\HouseholdSurveyMail($survey, $household, $surveyUrl)
                        );
                        Log::info("Survey email sent successfully to: " . $email);
                    } else {
                        Log::warning("No email found for household ID: " . $household->id . " (Head ID: " . $household->head_resident_id . ")");
                    }
                    break;

                case 'sms':
                    $mobile = $household->head_mobile;
                    if ($mobile) {
                        // Integrate with SMS service (e.g., Twilio, Semaphore)
                        // $this->sendSMS($mobile, $surveyUrl);
                        Log::info("SMS notification would be sent to: " . $mobile);
                    } else {
                        Log::warning("No mobile number found for household ID: " . $household->id);
                    }
                    break;

                case 'print':
                    // Generate printable survey form
                    // This can be handled on the frontend
                    Log::info("Print form generated for household: " . $household->id);
                    break;
            }
        } catch (\Exception $e) {
            Log::error('Failed to send notification: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());
        }
    }

    /**
     * Get survey statistics
     */
    public function getStatistics(Request $request)
    {
        try {
            $filters = $request->only(['household_id', 'survey_type', 'time_period']);
            $stats = HouseholdSurvey::getStatistics($filters);

            return response()->json([
                'success' => true,
                'data' => $stats,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to get survey statistics: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to get survey statistics',
            ], 500);
        }
    }

    /**
     * Get survey by token (public endpoint)
     */
    public function getSurveyByToken($token)
    {
        try {
            $survey = HouseholdSurvey::where('survey_token', $token)->firstOrFail();

            // Check if expired
            if ($survey->isExpired()) {
                return response()->json([
                    'success' => false,
                    'message' => 'This survey has expired.',
                ], 410);
            }

            // Check if already completed
            if ($survey->status === 'completed') {
                return response()->json([
                    'success' => false,
                    'message' => 'This survey has already been completed.',
                ], 410);
            }

            // Mark as opened
            $survey->markAsOpened();

            $household = $survey->household;

            return response()->json([
                'success' => true,
                'data' => [
                    'id' => $survey->id,
                    'household_no' => $household->household_no,
                    'head_name' => $household->head_full_name,
                    'address' => $household->address,
                    'survey_type' => $survey->survey_type,
                    'survey_type_label' => $survey->survey_type_label,
                    'questions' => $survey->questions,
                    'custom_message' => $survey->custom_message,
                    'expires_at' => $survey->expires_at,
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to fetch survey: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Survey not found or has expired.',
            ], 404);
        }
    }

    /**
     * Submit survey response (public endpoint)
     */
    public function submitSurvey(Request $request)
    {
        $request->validate([
            'survey_token' => 'required|string',
            'responses' => 'required|array',
            'additional_info' => 'nullable|array',
        ]);

        try {
            $survey = HouseholdSurvey::where('survey_token', $request->survey_token)->firstOrFail();

            // Check if expired
            if ($survey->isExpired()) {
                return response()->json([
                    'success' => false,
                    'message' => 'This survey has expired.',
                ], 410);
            }

            // Check if already completed
            if ($survey->status === 'completed') {
                return response()->json([
                    'success' => false,
                    'message' => 'This survey has already been completed.',
                ], 410);
            }

            // Mark survey as completed
            $survey->markAsCompleted($request->responses, $request->additional_info ?? []);

            // Process survey responses and create change logs
            $this->processSurveyResponses($survey, $request->additional_info ?? []);

            return response()->json([
                'success' => true,
                'message' => 'Survey submitted successfully. Thank you for your response!',
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to submit survey: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to submit survey. Please try again.',
            ], 500);
        }
    }

    /**
     * Process survey responses and create change logs
     */
    private function processSurveyResponses(HouseholdSurvey $survey, array $additionalInfo)
    {
        try {
            $household = $survey->household;
            $changes = [];

            // Process relocations
            if (!empty($additionalInfo['relocations'])) {
                foreach ($additionalInfo['relocations'] as $relocation) {
                    $changes[] = [
                        'household_id' => $household->id,
                        'change_type' => 'relocation',
                        'description' => "Member {$relocation['memberName']} relocated to {$relocation['newAddress']}",
                        'old_value' => $household->address,
                        'new_value' => $relocation['newAddress'],
                        'change_date' => $relocation['moveDate'] ?? now(),
                        'reported_by' => 'Household Survey',
                        'status' => 'pending_review',
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                }
            }

            // Process deceased members
            if (!empty($additionalInfo['deceased'])) {
                foreach ($additionalInfo['deceased'] as $deceased) {
                    $changes[] = [
                        'household_id' => $household->id,
                        'change_type' => 'deceased',
                        'description' => "Member {$deceased['memberName']} passed away on " . ($deceased['dateOfDeath'] ?? 'unknown date'),
                        'old_value' => json_encode(['member_name' => $deceased['memberName'], 'status' => 'alive']),
                        'new_value' => json_encode(['member_name' => $deceased['memberName'], 'status' => 'deceased']),
                        'change_date' => $deceased['dateOfDeath'] ?? now(),
                        'reported_by' => 'Household Survey',
                        'status' => 'pending_review',
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                }
            }

            // Process new members
            if (!empty($additionalInfo['newMembers'])) {
                foreach ($additionalInfo['newMembers'] as $member) {
                    $changes[] = [
                        'household_id' => $household->id,
                        'change_type' => 'new_member',
                        'description' => "New member {$member['name']} ({$member['relationship']}) added to household",
                        'old_value' => null,
                        'new_value' => json_encode($member),
                        'change_date' => $member['birthDate'] ?? now(),
                        'reported_by' => 'Household Survey',
                        'status' => 'pending_review',
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                }
            }

            // Insert change logs if any
            if (!empty($changes)) {
                \DB::table('household_change_logs')->insert($changes);
            }
        } catch (\Exception $e) {
            Log::error('Failed to process survey responses: ' . $e->getMessage());
        }
    }

    /**
     * View survey details
     */
    public function show($id)
    {
        try {
            $survey = HouseholdSurvey::with(['household', 'sentBy'])->findOrFail($id);

            return response()->json([
                'success' => true,
                'data' => [
                    'id' => $survey->id,
                    'household' => [
                        'id' => $survey->household->id,
                        'household_no' => $survey->household->household_no,
                        'head_name' => $survey->household->head_full_name,
                        'address' => $survey->household->address,
                        'contact' => $survey->household->mobilenumber,
                        'email' => $survey->household->email,
                    ],
                    'survey_type' => $survey->survey_type,
                    'survey_type_label' => $survey->survey_type_label,
                    'notification_method' => $survey->notification_method,
                    'questions' => $survey->questions,
                    'responses' => $survey->responses,
                    'additional_info' => $survey->additional_info,
                    'custom_message' => $survey->custom_message,
                    'status' => $survey->isExpired() ? 'expired' : $survey->status,
                    'sent_at' => $survey->sent_at,
                    'opened_at' => $survey->opened_at,
                    'completed_at' => $survey->completed_at,
                    'expires_at' => $survey->expires_at,
                    'sent_by' => $survey->sentBy->name ?? 'System',
                    'public_url' => $survey->getPublicUrl(),
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to fetch survey details: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Survey not found',
            ], 404);
        }
    }

    /**
     * Generate and download PDF survey form
     */
    public function downloadSurveyPdf($id)
    {
        try {
            $survey = HouseholdSurvey::with(['household', 'sentBy'])->findOrFail($id);
            $household = $survey->household;

            if (!$household) {
                Log::error('Household not found for survey', ['survey_id' => $id]);
                return response()->json([
                    'success' => false,
                    'message' => 'Household not found for this survey.',
                ], 404);
            }

            // Check if template exists
            $templatePath = 'surveys.household-survey-form';
            $viewPath = resource_path('views/surveys/household-survey-form.blade.php');
            
            if (!view()->exists($templatePath)) {
                Log::error('Survey PDF template not found', [
                    'template' => $templatePath,
                    'view_path' => $viewPath,
                    'file_exists' => file_exists($viewPath),
                    'views_directory' => resource_path('views'),
                ]);
                return response()->json([
                    'success' => false,
                    'message' => 'PDF template not found. Please contact support.',
                    'error_details' => config('app.debug') ? "Template path: {$templatePath}, File path: {$viewPath}" : null,
                ], 500);
            }

            // Check if DomPDF is available
            if (!class_exists('\Barryvdh\DomPDF\Facade\Pdf')) {
                Log::error('DomPDF not available');
                return response()->json([
                    'success' => false,
                    'message' => 'PDF generation service is not available.',
                ], 500);
            }

            // Prepare data for PDF template
            $data = [
                'survey' => $survey,
                'household' => $household,
                'survey_type_label' => $survey->survey_type_label ?? 'Unknown Survey Type',
                'questions' => $survey->questions ?? [],
                'custom_message' => $survey->custom_message ?? null,
                'expires_at' => $survey->expires_at ? $survey->expires_at->format('F j, Y') : null,
                'sent_at' => $survey->sent_at ? $survey->sent_at->format('F j, Y') : null,
            ];

            Log::info('Generating survey PDF', [
                'survey_id' => $id,
                'household_id' => $household->id,
                'survey_type' => $survey->survey_type,
                'questions_count' => count($data['questions']),
                'template_path' => $templatePath,
                'view_exists' => view()->exists($templatePath),
            ]);

            // Try to render the view first to catch any errors
            try {
                $html = view($templatePath, $data)->render();
                if (empty($html)) {
                    throw new \Exception('View rendered empty content');
                }
            } catch (\Exception $viewErr) {
                Log::error('Failed to render survey view', [
                    'survey_id' => $id,
                    'error' => $viewErr->getMessage(),
                    'trace' => $viewErr->getTraceAsString(),
                ]);
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to render PDF template: ' . $viewErr->getMessage(),
                ], 500);
            }

            // Generate PDF using DomPDF
            $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView($templatePath, $data);
            $pdf->setPaper('A4', 'portrait');

            // Generate PDF content
            $pdfContent = $pdf->output();

            if (empty($pdfContent)) {
                Log::error('PDF content is empty after generation', ['survey_id' => $id]);
                return response()->json([
                    'success' => false,
                    'message' => 'PDF generation failed. Template may have rendering errors.',
                ], 500);
            }

            // Generate filename
            $filename = sprintf(
                'household-survey-%s-%s-%d.pdf',
                str_replace(' ', '-', strtolower($survey->survey_type_label ?? 'survey')),
                $household->household_no ?? 'unknown',
                $survey->id
            );

            Log::info('Survey PDF generated successfully', [
                'survey_id' => $id,
                'filename' => $filename,
                'pdf_size' => strlen($pdfContent),
            ]);

            // Return PDF as download
            return response($pdfContent)
                ->header('Content-Type', 'application/pdf')
                ->header('Content-Disposition', 'attachment; filename="' . $filename . '"')
                ->header('Content-Length', strlen($pdfContent));
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            Log::error('Survey not found for PDF generation', ['survey_id' => $id]);
            return response()->json([
                'success' => false,
                'message' => 'Survey not found.',
            ], 404);
        } catch (\Exception $e) {
            Log::error('Failed to generate survey PDF', [
                'survey_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to generate survey PDF: ' . ($e->getMessage() ?: 'Unknown error occurred'),
                'error_details' => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }
}

