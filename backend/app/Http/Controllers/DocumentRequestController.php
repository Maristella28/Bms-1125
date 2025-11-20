<?php

namespace App\Http\Controllers;

use App\Models\DocumentRequest;
use App\Models\Resident;
use App\Models\PaidDocument;
use App\Models\User;
use App\Models\FinancialRecord;
use App\Services\PdfService;
use App\Services\ActivityLogService;
use App\Exports\DocumentRecordsExport;
use App\Notifications\DocumentRequestStatusNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Facades\Excel;

class DocumentRequestController extends Controller
{
    // Admin: Fetch all document requests with resident data
    public function index(Request $request)
    {
        // Optimized query - load user first, then manually join residents
        try {
            $requests = DocumentRequest::with(['user:id,email', 'paidDocument'])
                ->select([
                    'id', 'user_id', 'document_type', 'certification_type', 'fields', 
                    'certification_data', 'status', 'processing_notes', 'priority',
                    'estimated_completion', 'completed_at', 'attachment', 'pdf_path',
                    'payment_amount', 'payment_status', 'payment_notes', 'created_at', 'updated_at'
                ])
                ->orderBy('created_at', 'desc')
                ->get();
            
            // Manually load residents to avoid complex joins
            $userIds = $requests->pluck('user_id')->unique();
            $residents = \App\Models\Resident::whereIn('user_id', $userIds)
                ->select(['id', 'user_id', 'first_name', 'last_name', 'email'])
                ->get()
                ->keyBy('user_id');
            
            // Attach residents to requests
            $requests->each(function ($request) use ($residents) {
                $request->resident = $residents->get($request->user_id);
            });
            
            return response()->json($requests);
        } catch (\Exception $e) {
            \Log::error('DocumentRequest index error: ' . $e->getMessage());
            \Log::error('Stack trace: ' . $e->getTraceAsString());
            return response()->json([
                'error' => 'Database error',
                'message' => config('app.debug') ? $e->getMessage() : 'An error occurred while fetching document requests'
            ], 500);
        }
    }

    // Resident: Create a new document request
    public function store(Request $request)
    {
        try {
            $user = Auth::user();
            
            \Log::info('Document request attempt', [
                'user_id' => $user->id,
                'user_email' => $user->email,
                'request_data' => $request->all(),
                'fields_raw' => $request->input('fields'),
                'document_type' => $request->input('document_type')
            ]);
            
            // Check if user has a resident profile
            $resident = Resident::where('user_id', $user->id)->first();
            
            if (!$resident) {
                \Log::warning('Document request failed - no resident profile', [
                    'user_id' => $user->id,
                    'user_email' => $user->email
                ]);
                return response()->json([
                    'message' => 'Resident profile not found. Please complete your profile first.',
                    'error_code' => 'NO_RESIDENT_PROFILE',
                    'redirect_url' => '/profile'
                ], 422);
            }
            
            // Also check if resident has required profile data
            if (!$resident->first_name || !$resident->last_name) {
                \Log::warning('Document request failed - incomplete resident profile', [
                    'user_id' => $user->id,
                    'resident_id' => $resident->id,
                    'missing_fields' => [
                        'first_name' => !$resident->first_name,
                        'last_name' => !$resident->last_name
                    ]
                ]);
                return response()->json([
                    'message' => 'Your resident profile is incomplete. Please complete your profile with required information.',
                    'error_code' => 'INCOMPLETE_PROFILE',
                    'redirect_url' => '/profile'
                ], 422);
            }

            try {
                $validated = $request->validate([
                    'document_type' => 'required|string',
                    'fields' => 'nullable', // Accept JSON string or array from FormData
                    'attachment' => 'nullable|string',
                    'photo' => 'nullable|file|image|mimes:jpeg,png,jpg|max:5120', // 5MB max
                ]);
                
                // Handle fields parameter - could be string (JSON) or array
                if (isset($validated['fields'])) {
                    if (is_string($validated['fields'])) {
                        // Decode HTML entities first (handle &quot; etc.)
                        $decodedFields = html_entity_decode($validated['fields'], ENT_QUOTES, 'UTF-8');
                        
                        // Try to parse as JSON
                        $parsedFields = json_decode($decodedFields, true);
                        
                        if (json_last_error() !== JSON_ERROR_NONE) {
                            \Log::error('Invalid JSON in fields parameter', [
                                'original_fields' => $validated['fields'],
                                'decoded_fields' => $decodedFields,
                                'json_error' => json_last_error_msg()
                            ]);
                            throw new \InvalidArgumentException('Invalid JSON in fields parameter: ' . json_last_error_msg());
                        }
                        
                        $validated['fields'] = $parsedFields;
                        \Log::info('Fields parsed from JSON', ['parsed_fields' => $parsedFields]);
                    } elseif (is_array($validated['fields'])) {
                        // Already an array, no processing needed
                        \Log::info('Fields received as array', ['fields' => $validated['fields']]);
                    } else {
                        // Invalid type
                        throw new \InvalidArgumentException('Fields parameter must be a JSON string or array');
                    }
                } else {
                    // No fields provided, set empty array
                    $validated['fields'] = [];
                }
                
                \Log::info('Document request validation passed', [
                    'user_id' => $user->id,
                    'validated_data' => $validated,
                    'request_keys' => array_keys($request->all())
                ]);
                
            } catch (\Illuminate\Validation\ValidationException $e) {
                \Log::error('Document request validation failed', [
                    'user_id' => $user->id,
                    'errors' => $e->errors(),
                    'request_data' => $request->all(),
                    'request_headers' => $request->headers->all(),
                    'content_type' => $request->header('Content-Type')
                ]);
                return response()->json([
                    'message' => 'Validation failed',
                    'errors' => $e->errors(),
                    'debug_info' => [
                        'received_fields' => array_keys($request->all()),
                        'content_type' => $request->header('Content-Type')
                    ]
                ], 422);
            }
        
        // Extract certification type and data for Brgy Certification documents
        $certificationData = [];
        $certificationType = null;
        
        if ($validated['document_type'] === 'Brgy Certification' && isset($validated['fields']['purpose'])) {
            $certificationType = $validated['fields']['purpose'];
            
            // Extract certification-specific data
            if ($certificationType === 'Solo Parent Certification') {
                $certificationData = [
                    'child_name' => $validated['fields']['childName'] ?? null,
                    'child_birth_date' => $validated['fields']['childBirthDate'] ?? null,
                ];
            } elseif ($certificationType === 'Delayed Registration of Birth Certificate') {
                $certificationData = [
                    'mother_name' => $validated['fields']['motherName'] ?? null,
                    'father_name' => $validated['fields']['fatherName'] ?? null,
                    'requestor_name' => $validated['fields']['requestorName'] ?? null,
                ];
            }
        }
        
        // Handle photo - auto-fill from resident profile for Barangay Clearance or allow manual upload
        $photoPath = null;
        $photoMetadata = null;
        
        if ($validated['document_type'] === 'Brgy Clearance') {
            // Auto-fill photo from resident profile
            if ($resident->avatar) {
                $photoPath = $resident->avatar;
                $photoMetadata = [
                    'source' => 'profile',
                    'auto_filled' => true,
                    'original_name' => 'profile_photo.jpg',
                    'uploaded_at' => now()->toISOString(),
                ];
            }
            
            // Allow manual photo upload to override profile photo
            if ($request->hasFile('photo')) {
                $photo = $request->file('photo');
                $photoPath = $photo->store('document_photos', 'public');
                
                // Store photo metadata
                $photoMetadata = [
                    'source' => 'manual_upload',
                    'auto_filled' => false,
                    'original_name' => $photo->getClientOriginalName(),
                    'size' => $photo->getSize(),
                    'mime_type' => $photo->getMimeType(),
                    'uploaded_at' => now()->toISOString(),
                ];
            }
        } else {
            // For other document types, only allow manual upload
            if ($request->hasFile('photo')) {
                $photo = $request->file('photo');
                $photoPath = $photo->store('document_photos', 'public');
                
                // Store photo metadata
                $photoMetadata = [
                    'source' => 'manual_upload',
                    'auto_filled' => false,
                    'original_name' => $photo->getClientOriginalName(),
                    'size' => $photo->getSize(),
                    'mime_type' => $photo->getMimeType(),
                    'uploaded_at' => now()->toISOString(),
                ];
             }
        }
        
        // Debug: Log the fields being saved
        \Log::info('Creating DocumentRequest with fields:', [
            'document_type' => $validated['document_type'],
            'fields' => $validated['fields'] ?? [],
            'certification_type' => $certificationType,
            'user_id' => $user->id
        ]);
        
        $docRequest = DocumentRequest::create([
            'user_id' => $user->id,
            'document_type' => $validated['document_type'],
            'certification_type' => $certificationType,
            'fields' => $validated['fields'] ?? [],
            'certification_data' => !empty($certificationData) ? $certificationData : null,
            'status' => 'pending',
            'priority' => 'normal',
            'attachment' => $validated['attachment'] ?? null,
            'photo_path' => $photoPath,
            'photo_type' => $validated['document_type'] === 'Brgy Clearance' ? 'id_photo' : null,
            'photo_metadata' => $photoMetadata,
        ]);
        
        // Debug: Log the created document request
        \Log::info('DocumentRequest created successfully:', [
            'id' => $docRequest->id,
            'fields' => $docRequest->fields,
            'document_type' => $docRequest->document_type
        ]);
        
            return response()->json([
                'message' => 'Document request created successfully.',
                'document_request' => $docRequest->load(['user', 'resident'])
            ], 201);
            
        } catch (\Exception $e) {
            \Log::error('Document request creation failed', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request_data' => $request->all(),
                'exception_class' => get_class($e)
            ]);
            
            return response()->json([
                'message' => 'Failed to create document request',
                'error' => $e->getMessage(),
                'debug_info' => [
                    'exception_class' => get_class($e),
                    'file' => $e->getFile(),
                    'line' => $e->getLine()
                ]
            ], 500);
        }
    }

    // Admin: Update status or details of a document request
    public function update(Request $request, $id)
    {
        // Custom validation for estimated_completion to handle empty strings
        $requestData = $request->all();
        if (isset($requestData['estimated_completion']) && empty(trim($requestData['estimated_completion']))) {
            $requestData['estimated_completion'] = null;
            $request->merge($requestData);
        }
        
        $validated = $request->validate([
            'status' => 'required|string',
            'fields' => 'nullable|array',
            'attachment' => 'nullable|string',
            'processing_notes' => 'nullable|string',
            'priority' => 'nullable|in:low,normal,high,urgent',
            'estimated_completion' => 'nullable|date',
            'payment_amount' => 'nullable|numeric|min:0',
            'payment_status' => 'nullable|in:unpaid,paid',
            'payment_notes' => 'nullable|string',
        ]);
        
        $docRequest = DocumentRequest::findOrFail($id);
        $oldStatus = $docRequest->status;
        $docRequest->status = $validated['status'];
        
        if (isset($validated['fields'])) {
            \Log::info('Updating DocumentRequest fields:', [
                'document_request_id' => $docRequest->id,
                'old_fields' => $docRequest->fields,
                'new_fields' => $validated['fields'],
                'fields_count_old' => count($docRequest->fields ?? []),
                'fields_count_new' => count($validated['fields'] ?? [])
            ]);
            $docRequest->fields = $validated['fields'];
        }
        
        if (isset($validated['attachment'])) {
            $docRequest->attachment = $validated['attachment'];
        }
        
        if (isset($validated['processing_notes'])) {
            $docRequest->processing_notes = $validated['processing_notes'];
        }
        
        if (isset($validated['priority'])) {
            $docRequest->priority = $validated['priority'];
        }
        
        if (isset($validated['estimated_completion'])) {
            // Handle empty string values - convert to null for nullable date column
            $estimatedCompletion = $validated['estimated_completion'];
            if (empty($estimatedCompletion) || $estimatedCompletion === '') {
                $docRequest->estimated_completion = null;
            } else {
                $docRequest->estimated_completion = $estimatedCompletion;
            }
        }
        
        // Handle payment status update if provided
        if (isset($validated['payment_status'])) {
            $docRequest->payment_status = $validated['payment_status'];
            if ($validated['payment_status'] === 'paid') {
                $docRequest->payment_date = now();
                $docRequest->payment_completed = 1;
            } else {
                $docRequest->payment_completed = 0;
            }
        }
        
        // Handle payment amount update if provided
        if (isset($validated['payment_amount'])) {
            $docRequest->payment_amount = $validated['payment_amount'];
        }
        
        // Handle payment notes update if provided
        if (isset($validated['payment_notes'])) {
            $docRequest->payment_notes = $validated['payment_notes'];
        }
        
        // Handle payment approval when status changes to approved
        if (strtolower($validated['status']) === 'approved' && strtolower($oldStatus) !== 'approved') {
            // Only set payment_status to unpaid if it wasn't explicitly set to paid
            if (!isset($validated['payment_status']) && isset($validated['payment_amount']) && $validated['payment_amount'] > 0) {
                $docRequest->payment_amount = $validated['payment_amount'];
                $docRequest->payment_status = 'unpaid';
                $docRequest->payment_completed = 0;
            }
        }
        
        // Set completed_at timestamp when status changes to completed/approved
        if (in_array(strtolower($validated['status']), ['completed', 'approved']) && !$docRequest->completed_at) {
            $docRequest->completed_at = now();
        }
        
        $docRequest->save();
        
        // Send notification to resident if approved with payment
        if (strtolower($validated['status']) === 'approved' && strtolower($oldStatus) !== 'approved' && $docRequest->payment_amount > 0) {
            $this->sendPaymentApprovalNotification($docRequest);
        }
        
        return response()->json($docRequest->load(['user', 'resident']));
    }

    // Get document requests for authenticated user (resident)
    public function myRequests()
    {
        $user = Auth::user();
        $requests = DocumentRequest::where('user_id', $user->id)
            ->with(['user', 'resident'])
            ->orderBy('created_at', 'desc')
            ->get();
        
        return response()->json($requests);
    }

    // Generate PDF certificate
    public function generatePdf(Request $request, $id)
    {
        try {
            /** @var \App\Models\DocumentRequest $documentRequest */
            $documentRequest = DocumentRequest::with(['user', 'resident'])->findOrFail($id);
            
            \Log::info('PDF Generation Request', [
                'document_request_id' => $id,
                'user_id' => $documentRequest->user_id,
                'status' => $documentRequest->status,
                'has_resident' => $documentRequest->resident !== null,
                'resident_id' => $documentRequest->resident?->id,
            ]);
            
            // Try to load resident if not already loaded
            if (!$documentRequest->resident) {
                // Try to find resident by user_id
                $resident = Resident::where('user_id', $documentRequest->user_id)->first();
                
                if ($resident) {
                    $documentRequest->setRelation('resident', $resident);
                    \Log::info('Resident loaded manually', ['resident_id' => $resident->id]);
                } else {
                    \Log::error('Resident not found for document request', [
                        'document_request_id' => $id,
                        'user_id' => $documentRequest->user_id,
                        'available_residents' => Resident::where('user_id', $documentRequest->user_id)->count()
                    ]);
                    return response()->json([
                        'message' => 'Resident profile not found for this document request. Please ensure the user has a complete resident profile.',
                        'error_code' => 'RESIDENT_NOT_FOUND',
                        'user_id' => $documentRequest->user_id
                    ], 404);
                }
            }
            
            // Check if document is approved or processing
            // Processing status is allowed because documents in Document Records tab may need PDF regeneration
            $status = strtolower($documentRequest->status);
            if ($status !== 'approved' && $status !== 'processing') {
                return response()->json([
                    'message' => 'Only approved or processing document requests can generate PDF certificates.'
                ], 400);
            }
            
            $pdfService = new PdfService();
            $pdfPath = $pdfService->generateCertificate($documentRequest, $documentRequest->resident);
            
            // Verify PDF was actually created
            if (!Storage::disk('public')->exists($pdfPath)) {
                \Log::error('PDF file was not created after generation', [
                    'pdf_path' => $pdfPath,
                    'document_request_id' => $id,
                    'storage_path' => storage_path('app/public'),
                    'full_path' => storage_path('app/public/' . $pdfPath)
                ]);
                throw new \Exception('PDF file was not created successfully. Path: ' . $pdfPath);
            }
            
            // Update document request with PDF path
            $updateResult = $documentRequest->update([
                'pdf_path' => $pdfPath
            ]);
            
            if (!$updateResult) {
                \Log::error('Failed to update document request with PDF path', [
                    'document_request_id' => $id,
                    'pdf_path' => $pdfPath
                ]);
                throw new \Exception('Failed to save PDF path to database');
            }
            
            // Reload the document request from database to ensure we have the latest data
            $documentRequest = DocumentRequest::with(['user', 'resident'])->findOrFail($id);
            
            // Verify the update was successful
            if ($documentRequest->pdf_path !== $pdfPath) {
                \Log::error('PDF path was not saved correctly', [
                    'expected' => $pdfPath,
                    'actual' => $documentRequest->pdf_path,
                    'document_request_id' => $id
                ]);
                // Try to update again
                $documentRequest->pdf_path = $pdfPath;
                $documentRequest->save();
                $documentRequest->refresh();
            }
            
            // Log PDF generation activity
            $user = Auth::user();
            $userRole = $user ? $user->role : 'system';
            $description = $userRole === 'admin' 
                ? "Admin {$user->name} generated PDF for {$documentRequest->document_type} (ID: {$documentRequest->id})"
                : ($userRole === 'staff'
                    ? "Staff {$user->name} generated PDF for {$documentRequest->document_type} (ID: {$documentRequest->id})"
                    : "PDF generated for {$documentRequest->document_type} (ID: {$documentRequest->id})");
            
            ActivityLogService::log(
                'generate_pdf',
                $documentRequest,
                null,
                ['pdf_path' => $pdfPath, 'document_type' => $documentRequest->document_type],
                $description,
                $request
            );
            
            \Log::info('PDF generated successfully', [
                'document_request_id' => $id,
                'pdf_path' => $pdfPath,
                'pdf_path_in_db' => $documentRequest->pdf_path,
                'file_exists' => Storage::disk('public')->exists($pdfPath),
                'file_size' => Storage::disk('public')->exists($pdfPath) ? Storage::disk('public')->size($pdfPath) : 0
            ]);
            
            return response()->json([
                'message' => 'PDF certificate generated successfully.',
                'pdf_path' => $documentRequest->pdf_path, // Return from refreshed model
                'download_url' => url("storage/{$documentRequest->pdf_path}")
            ]);
            
        } catch (\Exception $e) {
            \Log::error('PDF Generation Error', [
                'document_request_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'message' => 'Failed to generate PDF certificate.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // Download PDF certificate
    public function downloadPdf($id)
    {
        try {
            \Log::info('Starting PDF download request', [ 
                'id' => $id,
                'storage_path' => storage_path('app/public'),
                'public_path' => public_path('storage')
            ]);

            $documentRequest = DocumentRequest::with('resident')->findOrFail($id);

            \Log::info('Found document request', [
                'document_request' => $documentRequest->toArray(),
                'storage_exists' => Storage::disk('public')->exists(''),
                'storage_files' => Storage::disk('public')->files()
            ]);

            if (!$documentRequest->pdf_path) {
                \Log::warning('No PDF path in document request', [
                    'id' => $id,
                    'document_request' => $documentRequest->toArray()
                ]);
                return response()->json([
                    'message' => 'PDF certificate not found. Please generate it first.',
                    'error_code' => 'PDF_PATH_MISSING'
                ], 404);
            }

            \Log::info('Checking PDF file', [
                'pdf_path' => $documentRequest->pdf_path,
                'full_path' => storage_path('app/public/' . $documentRequest->pdf_path),
                'exists' => Storage::disk('public')->exists($documentRequest->pdf_path)
            ]);

            if (!Storage::disk('public')->exists($documentRequest->pdf_path)) {
                \Log::warning('PDF file not found in storage', [
                    'pdf_path' => $documentRequest->pdf_path,
                    'storage_path' => storage_path('app/public'),
                    'storage_files' => Storage::disk('public')->files()
                ]);
                return response()->json([
                    'message' => 'PDF file not found on server. Please generate it first or contact admin.',
                    'error_code' => 'PDF_FILE_MISSING'
                ], 404);
            }

            $filePath = storage_path('app/public/' . $documentRequest->pdf_path);
            
            // Double-check file exists using both Storage and file_exists
            if (!file_exists($filePath)) {
                \Log::error('PDF file not found at expected path', [
                    'pdf_path' => $documentRequest->pdf_path,
                    'file_path' => $filePath,
                    'storage_exists' => Storage::disk('public')->exists($documentRequest->pdf_path),
                    'file_exists' => file_exists($filePath),
                    'storage_files' => Storage::disk('public')->files('certificates')
                ]);
                return response()->json([
                    'message' => 'PDF file not found on server. Please regenerate the PDF.',
                    'error_code' => 'PDF_FILE_MISSING'
                ], 404);
            }
            
            $fileName = sprintf(
                '%s-%s-%s.pdf',
                str_replace(' ', '_', $documentRequest->document_type),
                $documentRequest->resident ? str_replace(' ', '_', $documentRequest->resident->last_name) : 'Unknown',
                date('Y-m-d')
            );

            \Log::info('Preparing PDF download', [
                'file_path' => $filePath,
                'file_name' => $fileName,
                'file_exists' => file_exists($filePath),
                'file_size' => file_exists($filePath) ? filesize($filePath) : 0,
                'is_readable' => is_readable($filePath)
            ]);

            // Log PDF download activity
            $user = Auth::user();
            if ($user) {
                $userRole = $user->role;
                $description = $userRole === 'admin' 
                    ? "Admin {$user->name} downloaded PDF for {$documentRequest->document_type} (ID: {$documentRequest->id})"
                    : ($userRole === 'staff'
                        ? "Staff {$user->name} downloaded PDF for {$documentRequest->document_type} (ID: {$documentRequest->id})"
                        : "User downloaded PDF for {$documentRequest->document_type} (ID: {$documentRequest->id})");
                
                ActivityLogService::log(
                    'download_pdf',
                    $documentRequest,
                    null,
                    ['pdf_path' => $documentRequest->pdf_path, 'document_type' => $documentRequest->document_type],
                    $description,
                    request()
                );
            }

            // Check if this is a view request (inline) or download request
            // For viewing, use inline; for downloading, use attachment
            $disposition = request()->query('view') === 'true' ? 'inline' : 'attachment';

            return response()->file($filePath, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => $disposition . '; filename="' . $fileName . '"',
                'Cache-Control' => 'public, max-age=3600'
            ]);

        } catch (\Exception $e) {
            \Log::error('PDF Download Error', [
                'document_request_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'storage_path' => storage_path('app/public'),
                'storage_exists' => Storage::disk('public')->exists(''),
                'storage_files' => Storage::disk('public')->files()
            ]);

            return response()->json([
                'message' => 'Failed to download PDF certificate.',
                'error' => $e->getMessage(),
                'error_code' => 'PDF_DOWNLOAD_FAILED'
            ], 500);
        }
    }

    // Test PDF generation (for debugging)
    public function testPdf()
    {
        try {
            // Check if DomPDF is available
            if (!class_exists('\Barryvdh\DomPDF\Facade\Pdf')) {
                return response()->json([
                    'error' => 'DomPDF package is not installed or not properly configured.',
                    'status' => 'DomPDF not found'
                ], 500);
            }

            // Check if templates exist
            $templates = [
                'brgy-clearance',
                'brgy-business-permit',
                'brgy-indigency',
                'brgy-residency',
                'brgy-certification',
                'brgy-certification-solo-parent',
                'brgy-certification-delayed-registration',
                'brgy-certification-first-time-jobseeker'
            ];
            $missingTemplates = [];
            
            foreach ($templates as $template) {
                if (!view()->exists("certificates.{$template}")) {
                    $missingTemplates[] = $template;
                }
            }

            if (!empty($missingTemplates)) {
                return response()->json([
                    'error' => 'Missing certificate templates',
                    'missing_templates' => $missingTemplates,
                    'status' => 'Templates missing'
                ], 500);
            }

            // Check storage
            $storageStatus = [
                'public_disk_exists' => Storage::disk('public')->exists(''),
                'certificates_dir_exists' => Storage::disk('public')->exists('certificates'),
                'storage_link_exists' => file_exists(public_path('storage'))
            ];

            return response()->json([
                'message' => 'PDF system is properly configured',
                'status' => 'OK',
                'storage_status' => $storageStatus,
                'dompdf_available' => true,
                'templates_available' => true
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Test failed',
                'message' => $e->getMessage(),
                'status' => 'Error'
            ], 500);
        }
    }

    // View uploaded photo
    public function viewPhoto($id)
    {
        try {
            $documentRequest = DocumentRequest::findOrFail($id);
            
            if (!$documentRequest->photo_path) {
                return response()->json([
                    'message' => 'No photo found for this document request.'
                ], 404);
            }
            
            if (!Storage::disk('public')->exists($documentRequest->photo_path)) {
                return response()->json([
                    'message' => 'Photo file not found on server.'
                ], 404);
            }
            
            $photoUrl = url('storage/' . $documentRequest->photo_path);
            
            return response()->json([
                'photo_url' => $photoUrl,
                'photo_metadata' => $documentRequest->photo_metadata,
                'photo_type' => $documentRequest->photo_type
            ]);
            
        } catch (\Exception $e) {
            \Log::error('Photo View Error', [
                'document_request_id' => $id,
                'error' => $e->getMessage()
            ]);
            
            return response()->json([
                'message' => 'Failed to retrieve photo.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // Download photo
    public function downloadPhoto($id)
    {
        try {
            $documentRequest = DocumentRequest::findOrFail($id);
            
            if (!$documentRequest->photo_path) {
                return response()->json([
                    'message' => 'No photo found for this document request.'
                ], 404);
            }
            
            if (!Storage::disk('public')->exists($documentRequest->photo_path)) {
                return response()->json([
                    'message' => 'Photo file not found on server.'
                ], 404);
            }
            
            $photoPath = storage_path('app/public/' . $documentRequest->photo_path);
            $originalName = $documentRequest->photo_metadata['original_name'] ?? 'photo.jpg';
            
            return response()->download($photoPath, $originalName);
            
        } catch (\Exception $e) {
            \Log::error('Photo Download Error', [
                'document_request_id' => $id,
                'error' => $e->getMessage()
            ]);
            
            return response()->json([
                'message' => 'Failed to download photo.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // Delete photo (admin only)
    public function deletePhoto($id)
    {
        try {
            $documentRequest = DocumentRequest::findOrFail($id);
            
            if (!$documentRequest->photo_path) {
                return response()->json([
                    'message' => 'No photo found for this document request.'
                ], 404);
            }
            
            // Delete file from storage
            if (Storage::disk('public')->exists($documentRequest->photo_path)) {
                Storage::disk('public')->delete($documentRequest->photo_path);
            }
            
            // Clear photo fields in database
            $documentRequest->update([
                'photo_path' => null,
                'photo_type' => null,
                'photo_metadata' => null
            ]);
            
            return response()->json([
                'message' => 'Photo deleted successfully.'
            ]);
            
        } catch (\Exception $e) {
            \Log::error('Photo Delete Error', [
                'document_request_id' => $id,
                'error' => $e->getMessage()
            ]);
            
            return response()->json([
                'message' => 'Failed to delete photo.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // Resident: Confirm payment for approved document request
    public function confirmPayment(Request $request, $id)
    {
        try {
            $user = Auth::user();
            $docRequest = DocumentRequest::where('id', $id)
                ->where('user_id', $user->id)
                ->with(['user', 'resident'])
                ->firstOrFail();

            // Check if document is approved and has payment amount
            if (strtolower($docRequest->status) !== 'approved') {
                return response()->json([
                    'message' => 'Only approved document requests can be paid.',
                    'error_code' => 'NOT_APPROVED'
                ], 400);
            }

            if (!$docRequest->payment_amount || $docRequest->payment_amount <= 0) {
                return response()->json([
                    'message' => 'No payment amount set for this document request.',
                    'error_code' => 'NO_PAYMENT_AMOUNT'
                ], 400);
            }

            if ($docRequest->payment_status === 'paid') {
                return response()->json([
                    'message' => 'Payment has already been confirmed for this document request.',
                    'error_code' => 'ALREADY_PAID'
                ], 400);
            }

            // Update payment status
            $docRequest->update([
                'payment_status' => 'paid',
                'payment_date' => now(),
                'payment_completed' => 1
            ]);

            // Send notification to admin about payment confirmation
            $this->sendPaymentConfirmationNotification($docRequest);

            return response()->json([
                'message' => 'Payment confirmed successfully. Your document will be processed.',
                'document_request' => $docRequest->load(['user', 'resident'])
            ]);

        } catch (\Exception $e) {
            \Log::error('Payment Confirmation Error', [
                'document_request_id' => $id,
                'user_id' => Auth::id(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'message' => 'Failed to confirm payment.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // Admin: Confirm payment for a document request
    public function adminConfirmPayment(Request $request, $id)
    {
        try {
            $docRequest = DocumentRequest::findOrFail($id);

            // Check if document is approved or processing and has payment amount
            // Payment can be confirmed after PDF is generated (status becomes Processing)
            if (strtolower($docRequest->status) !== 'approved' && strtolower($docRequest->status) !== 'processing') {
                return response()->json([
                    'message' => 'Only approved or processing document requests can be paid.',
                    'error_code' => 'NOT_APPROVED'
                ], 400);
            }

            if (!$docRequest->payment_amount || $docRequest->payment_amount <= 0) {
                return response()->json([
                    'message' => 'No payment amount set for this document request.',
                    'error_code' => 'NO_PAYMENT_AMOUNT'
                ], 400);
            }

            if ($docRequest->payment_status === 'paid') {
                return response()->json([
                    'message' => 'Payment has already been confirmed for this document request.',
                    'error_code' => 'ALREADY_PAID'
                ], 400);
            }

            // Update payment status
            $docRequest->update([
                'payment_status' => 'paid',
                'payment_date' => now(),
                'payment_completed' => 1
            ]);

            // Refresh the model to ensure it has the latest data
            $docRequest->refresh();

            // Create paid document record with receipt
            $paidDocument = PaidDocument::create([
                'document_request_id' => $docRequest->id,
                'receipt_number' => PaidDocument::generateReceiptNumber(),
                'amount_paid' => $docRequest->payment_amount,
                'payment_method' => $request->input('payment_method', 'cash'),
                'payment_reference' => $request->input('payment_reference'),
                'payment_date' => now(),
                'received_by' => Auth::user()->name ?? 'Admin',
                'notes' => $request->input('notes'),
            ]);

            // Create financial record for this payment
            try {
                $residentName = $docRequest->resident && $docRequest->resident->profile 
                    ? ($docRequest->resident->profile->first_name . ' ' . $docRequest->resident->profile->last_name)
                    : ($docRequest->user ? $docRequest->user->name : 'Unknown');
                
                $documentType = $docRequest->document_type ?? 'Document';
                
                FinancialRecord::create([
                    'date' => now()->toDateString(),
                    'type' => 'Income',
                    'category' => 'Document Fees',
                    'amount' => $docRequest->payment_amount,
                    'description' => "Document request payment - {$documentType} - Receipt: {$paidDocument->receipt_number} - Resident: {$residentName}",
                    'reference' => $paidDocument->receipt_number,
                    'approved_by' => Auth::user()->name ?? 'Admin',
                    'status' => 'Completed',
                ]);
                \Log::info('Financial record created for document payment', [
                    'receipt' => $paidDocument->receipt_number, 
                    'amount' => $docRequest->payment_amount
                ]);
            } catch (\Exception $e) {
                \Log::error('Failed to create financial record for document payment', [
                    'document_request_id' => $id,
                    'error' => $e->getMessage()
                ]);
                // Don't fail the payment if financial record creation fails
            }

            // Send notification to admin about payment confirmation
            $this->sendPaymentConfirmationNotification($docRequest);

            return response()->json([
                'message' => 'Payment confirmed successfully. Document has been moved to records.',
                'receipt_number' => $paidDocument->receipt_number,
                'amount_paid' => $docRequest->payment_amount,
                'document_request' => $docRequest->load(['user', 'resident', 'paidDocument'])
            ]);

        } catch (\Exception $e) {
            \Log::error('Admin Payment Confirmation Error', [
                'document_request_id' => $id,
                'admin_id' => Auth::id(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'message' => 'Failed to confirm payment.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // Generate PDF receipt for a document request
    public function generateReceipt(Request $request)
    {
        try {
            $validated = $request->validate([
                'document_request_id' => 'required|exists:document_requests,id',
                'receipt_number' => 'required|string',
                'amount_paid' => 'required|numeric|min:0',
            ]);

            // Load the document request with related data
            // Use fresh() to ensure we get the latest data from database
            $documentRequest = DocumentRequest::with(['user', 'resident', 'resident.profile', 'paidDocument'])->findOrFail($validated['document_request_id']);
            
            // Reload from database to ensure we have the latest payment_status
            $documentRequest->refresh();
            
            // Reload relationships to ensure we have latest data
            $documentRequest->load(['user', 'resident', 'resident.profile', 'paidDocument']);
            
            // Verify required relationships exist
            if (!$documentRequest->user && !$documentRequest->resident) {
                \Log::error('Receipt generation failed: No user or resident found', [
                    'document_request_id' => $validated['document_request_id'],
                    'has_user' => $documentRequest->user ? 'yes' : 'no',
                    'has_resident' => $documentRequest->resident ? 'yes' : 'no'
                ]);
                return response()->json([
                    'error' => 'User or resident information not found',
                    'message' => 'Cannot generate receipt: User or resident profile is missing.'
                ], 404);
            }
            
            // Also check paidDocument exists
            if (!$documentRequest->paidDocument) {
                // Try to reload paidDocument relationship
                $documentRequest->load('paidDocument');
                
                if (!$documentRequest->paidDocument) {
                    \Log::warning('Receipt generation attempted but paidDocument not found', [
                        'document_request_id' => $validated['document_request_id'],
                        'payment_status' => $documentRequest->payment_status
                    ]);
                    return response()->json([
                        'error' => 'Payment record not found',
                        'message' => 'Payment has been confirmed but receipt record is missing. Please contact support.'
                    ], 404);
                }
            }

            // Check if request is paid (check both lowercase and original case)
            $paymentStatus = strtolower($documentRequest->payment_status ?? '');
            if ($paymentStatus !== 'paid') {
                \Log::warning('Receipt generation attempted for unpaid request', [
                    'document_request_id' => $validated['document_request_id'],
                    'payment_status' => $documentRequest->payment_status,
                    'expected' => 'paid',
                    'paid_document_exists' => $documentRequest->paidDocument ? 'yes' : 'no'
                ]);
                return response()->json([
                    'error' => 'Only paid requests can generate receipts',
                    'message' => "Payment status is '{$documentRequest->payment_status}' but expected 'paid'. Please wait a moment and try again."
                ], 400);
            }
            
            // Verify paidDocument exists
            if (!$documentRequest->paidDocument) {
                \Log::warning('Receipt generation attempted but paidDocument not found', [
                    'document_request_id' => $validated['document_request_id'],
                    'payment_status' => $documentRequest->payment_status
                ]);
                return response()->json([
                    'error' => 'Payment record not found',
                    'message' => 'Payment has been confirmed but receipt record is missing. Please contact support.'
                ], 404);
            }

            // Verify receipt template exists
            if (!view()->exists('receipts.document-receipt')) {
                \Log::error('Receipt template not found', [
                    'template' => 'receipts.document-receipt',
                    'document_request_id' => $validated['document_request_id']
                ]);
                return response()->json([
                    'error' => 'Receipt template not found',
                    'message' => 'The receipt template is missing. Please contact support.'
                ], 500);
            }

            // Generate PDF using the blade template
            try {
                // Prepare data for template with null safety
                $templateData = [
                    'documentRequest' => $documentRequest,
                    'receiptNumber' => $validated['receipt_number'],
                    'amountPaid' => $validated['amount_paid'],
                ];
                
                \Log::info('Attempting to generate receipt PDF', [
                    'document_request_id' => $validated['document_request_id'],
                    'receipt_number' => $validated['receipt_number'],
                    'has_user' => $documentRequest->user ? 'yes' : 'no',
                    'has_resident' => $documentRequest->resident ? 'yes' : 'no',
                    'has_paid_document' => $documentRequest->paidDocument ? 'yes' : 'no'
                ]);
                
                $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('receipts.document-receipt', $templateData);

                // Generate PDF content
                $pdfContent = $pdf->output();
                
                if (empty($pdfContent)) {
                    \Log::error('PDF content is empty after generation', [
                        'document_request_id' => $validated['document_request_id']
                    ]);
                    throw new \Exception('PDF content is empty. Template may have rendering errors.');
                }
                
                $filename = 'receipt-' . $validated['receipt_number'] . '.pdf';

                \Log::info('Receipt PDF generated successfully', [
                    'document_request_id' => $validated['document_request_id'],
                    'receipt_number' => $validated['receipt_number'],
                    'file_size' => strlen($pdfContent),
                    'filename' => $filename
                ]);

                // Return PDF as blob
                return response($pdfContent)
                    ->header('Content-Type', 'application/pdf')
                    ->header('Content-Disposition', 'attachment; filename="' . $filename . '"')
                    ->header('Content-Length', strlen($pdfContent));
            } catch (\Exception $pdfErr) {
                \Log::error('PDF generation failed', [
                    'document_request_id' => $validated['document_request_id'],
                    'error' => $pdfErr->getMessage(),
                    'error_class' => get_class($pdfErr),
                    'trace' => $pdfErr->getTraceAsString(),
                    'has_user' => $documentRequest->user ? 'yes' : 'no',
                    'has_resident' => $documentRequest->resident ? 'yes' : 'no'
                ]);
                
                // Return more specific error message
                return response()->json([
                    'error' => 'Failed to generate receipt PDF',
                    'message' => $pdfErr->getMessage() ?: 'An error occurred while generating the receipt. Please check the logs for details.',
                    'error_details' => config('app.debug') ? $pdfErr->getMessage() : null
                ], 500);
            }

        } catch (\Exception $e) {
            \Log::error('Receipt Generation Error', [
                'document_request_id' => $request->input('document_request_id'),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'error' => 'Failed to generate receipt',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    // Download existing receipt PDF
    public function downloadReceipt(Request $request)
    {
        try {
            $validated = $request->validate([
                'document_request_id' => 'required|exists:document_requests,id',
                'receipt_number' => 'required|string',
            ]);

            // Load the document request with related data
            $documentRequest = DocumentRequest::with(['user', 'resident', 'paidDocument'])->findOrFail($validated['document_request_id']);

            // Check if request is paid and has receipt
            if ($documentRequest->payment_status !== 'paid' || !$documentRequest->paidDocument) {
                return response()->json(['error' => 'No receipt found for this document request'], 404);
            }

            // Generate PDF using the blade template
            $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('receipts.document-receipt', [
                'documentRequest' => $documentRequest,
                'receiptNumber' => $validated['receipt_number'],
                'amountPaid' => $documentRequest->paidDocument->amount_paid,
            ]);

            // Generate PDF content
            $pdfContent = $pdf->output();
            $filename = 'receipt-' . $validated['receipt_number'] . '.pdf';

            // Return PDF as blob
            return response($pdfContent)
                ->header('Content-Type', 'application/pdf')
                ->header('Content-Disposition', 'attachment; filename="' . $filename . '"')
                ->header('Content-Length', strlen($pdfContent));

        } catch (\Exception $e) {
            \Log::error('Receipt Download Error', [
                'document_request_id' => $request->input('document_request_id'),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'error' => 'Failed to download receipt',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    // Test receipt template
    public function testReceiptTemplate()
    {
        try {
            return response()->json([
                'message' => 'Test route working',
                'timestamp' => now(),
                'dompdf_available' => class_exists('Dompdf\Dompdf')
            ]);
        } catch (\Exception $e) {
            \Log::error('Test Receipt Template Error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ], 500);
        }
    }

    // Admin: Get paid document records (for Document Records section)
    public function getPaidRecords(Request $request)
    {
        try {
            $query = DocumentRequest::where('payment_status', 'paid')
                ->where('status', 'approved')
                ->with(['user', 'resident', 'paymentApprovedBy', 'paymentConfirmedBy']);

            // Filter by document type if provided
            if ($request->has('document_type') && $request->document_type !== 'all') {
                $query->where('document_type', $request->document_type);
            }

            // Filter by date range if provided
            if ($request->has('date_from')) {
                $query->whereDate('payment_confirmed_at', '>=', $request->date_from);
            }
            if ($request->has('date_to')) {
                $query->whereDate('payment_confirmed_at', '<=', $request->date_to);
            }

            $records = $query->orderBy('payment_confirmed_at', 'desc')->get();

            return response()->json($records);

        } catch (\Exception $e) {
            \Log::error('Get Paid Records Error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'message' => 'Failed to fetch paid records.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // Get document type statistics
    public function getDocumentTypeStats()
    {
        try {
            $stats = DocumentRequest::selectRaw('document_type, COUNT(*) as total_count')
                ->where('payment_status', 'paid')
                ->where('status', 'approved')
                ->groupBy('document_type')
                ->get();

            return response()->json($stats);

        } catch (\Exception $e) {
            \Log::error('Get Document Type Stats Error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'message' => 'Failed to fetch document type statistics.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // Send payment approval notification to resident
    private function sendPaymentApprovalNotification($documentRequest)
    {
        try {
            // This would integrate with your notification system
            // For now, we'll just log it
            \Log::info('Payment Approval Notification', [
                'document_request_id' => $documentRequest->id,
                'user_id' => $documentRequest->user_id,
                'document_type' => $documentRequest->document_type,
                'payment_amount' => $documentRequest->payment_amount,
                'resident_name' => $documentRequest->user->name ?? 'Unknown'
            ]);

            // TODO: Implement actual notification sending
            // This could be email, SMS, or in-app notification

        } catch (\Exception $e) {
            \Log::error('Send Payment Approval Notification Error', [
                'document_request_id' => $documentRequest->id,
                'error' => $e->getMessage()
            ]);
        }
    }

    // Send payment confirmation notification to admin
    private function sendPaymentConfirmationNotification($documentRequest)
    {
        try {
            // This would integrate with your notification system
            // For now, we'll just log it
            \Log::info('Payment Confirmation Notification', [
                'document_request_id' => $documentRequest->id,
                'user_id' => $documentRequest->user_id,
                'document_type' => $documentRequest->document_type,
                'payment_amount' => $documentRequest->payment_amount,
                'resident_name' => $documentRequest->user->name ?? 'Unknown'
            ]);

            // TODO: Implement actual notification sending
            // This could be email, SMS, or in-app notification

        } catch (\Exception $e) {
            \Log::error('Send Payment Confirmation Notification Error', [
                'document_request_id' => $documentRequest->id,
                'error' => $e->getMessage()
            ]);
        }
    }

    // Export paid document records to Excel
    public function exportExcel()
    {
        try {
            \Log::info('Starting Excel export for paid document records');
            
            // Get only paid and approved document requests with related data
            $records = DocumentRequest::with(['user', 'resident'])
                ->where('payment_status', 'paid')
                ->where('status', 'approved')
                ->orderBy('created_at', 'desc')
                ->get();
            
            \Log::info('Retrieved paid records for export', [
                'count' => $records->count()
            ]);
            
            if ($records->isEmpty()) {
                return response()->json([
                    'message' => 'No paid document records found to export.'
                ], 404);
            }
            
            // Generate filename with current date
            $filename = 'Paid_Document_Records_' . now()->format('Y-m-d_H-i-s') . '.xlsx';
            
            \Log::info('Generating Excel file for paid records', [
                'filename' => $filename,
                'record_count' => $records->count()
            ]);
            
            // Return Excel download
            return Excel::download(new DocumentRecordsExport($records), $filename);
            
        } catch (\Exception $e) {
            \Log::error('Excel Export Error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'message' => 'Failed to export paid document records to Excel.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // Test Excel export (returns JSON for debugging)
    public function testExcelExport()
    {
        try {
            \Log::info('Testing Excel export functionality for paid records');
            
            // Get paid and approved document requests with related data
            $records = DocumentRequest::with(['user', 'resident'])
                ->where('payment_status', 'paid')
                ->where('status', 'approved')
                ->orderBy('created_at', 'desc')
                ->take(5)
                ->get();
            
            \Log::info('Retrieved test paid records', [
                'count' => $records->count()
            ]);
            
            return response()->json([
                'message' => 'Excel export test successful for paid records',
                'record_count' => $records->count(),
                'sample_record' => $records->first(),
                'excel_available' => class_exists('Maatwebsite\Excel\Facades\Excel'),
                'export_class_available' => class_exists('App\Exports\DocumentRecordsExport'),
                'filter_applied' => 'payment_status=paid AND status=approved'
            ]);
            
        } catch (\Exception $e) {
            \Log::error('Excel Export Test Error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'message' => 'Excel export test failed',
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ], 500);
        }
    }

    /**
     * Send approval notification to resident (email + in-app)
     */
    public function sendApprovalNotification(Request $request, $id)
    {
        try {
            $documentRequest = DocumentRequest::findOrFail($id);
            $user = User::find($documentRequest->user_id);

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not found'
                ], 404);
            }

            // Send notification (email + in-app)
            $user->notify(new DocumentRequestStatusNotification(
                $documentRequest,
                ['from' => 'Pending', 'to' => 'Approved']
            ));

            \Log::info('Document approval notification sent', [
                'document_request_id' => $id,
                'user_id' => $user->id,
                'email' => $user->email
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Approval notification sent successfully'
            ]);

        } catch (\Exception $e) {
            \Log::error('Send approval notification error: ' . $e->getMessage());
            \Log::error('Stack trace: ' . $e->getTraceAsString());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to send notification',
                'error' => config('app.debug') ? $e->getMessage() : null
            ], 500);
        }
    }

    /**
     * Send denial notification to resident (email + in-app)
     */
    public function sendDenialNotification(Request $request, $id)
    {
        try {
            $validated = $request->validate([
                'reason' => 'required|string'
            ]);

            $documentRequest = DocumentRequest::findOrFail($id);
            $user = User::find($documentRequest->user_id);

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not found'
                ], 404);
            }

            // Update processing notes with the reason
            $documentRequest->processing_notes = $validated['reason'];
            $documentRequest->save();

            // Send notification (email + in-app)
            $user->notify(new DocumentRequestStatusNotification(
                $documentRequest,
                ['from' => $documentRequest->status, 'to' => 'Denied']
            ));

            \Log::info('Document denial notification sent', [
                'document_request_id' => $id,
                'user_id' => $user->id,
                'email' => $user->email,
                'reason' => $validated['reason']
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Denial notification sent successfully'
            ]);

        } catch (\Exception $e) {
            \Log::error('Send denial notification error: ' . $e->getMessage());
            \Log::error('Stack trace: ' . $e->getTraceAsString());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to send notification',
                'error' => config('app.debug') ? $e->getMessage() : null
            ], 500);
        }
    }

    /**
     * Send processing notification to resident (email + in-app)
     */
    public function sendProcessingNotification(Request $request, $id)
    {
        try {
            $documentRequest = DocumentRequest::findOrFail($id);
            $user = User::find($documentRequest->user_id);

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not found'
                ], 404);
            }

            // Send notification (email + in-app)
            $user->notify(new DocumentRequestStatusNotification(
                $documentRequest,
                ['from' => 'Approved', 'to' => 'Processing']
            ));

            \Log::info('Document processing notification sent', [
                'document_request_id' => $id,
                'user_id' => $user->id,
                'email' => $user->email
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Processing notification sent successfully'
            ]);

        } catch (\Exception $e) {
            \Log::error('Send processing notification error: ' . $e->getMessage());
            \Log::error('Stack trace: ' . $e->getTraceAsString());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to send notification',
                'error' => config('app.debug') ? $e->getMessage() : null
            ], 500);
        }
    }

    /**
     * Send in-app notification to resident
     */
    public function sendInAppNotification(Request $request, $id)
    {
        try {
            $validated = $request->validate([
                'title' => 'required|string',
                'message' => 'required|string',
                'type' => 'nullable|string'
            ]);

            $documentRequest = DocumentRequest::findOrFail($id);
            $user = User::find($documentRequest->user_id);

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not found'
                ], 404);
            }

            // Create in-app notification
            $user->notifications()->create([
                'id' => \Illuminate\Support\Str::uuid(),
                'type' => 'App\\Notifications\\DocumentRequestStatusNotification',
                'data' => [
                    'type' => $validated['type'] ?? 'document_request_status',
                    'document_request_id' => $documentRequest->id,
                    'document_type' => $documentRequest->document_type,
                    'certification_type' => $documentRequest->certification_type,
                    'status' => $documentRequest->status,
                    'message' => $validated['message'],
                    'title' => $validated['title'],
                    'icon' => 'document-text',
                    'color' => 'blue',
                    'action_url' => '/residents/documents/status',
                    'created_at' => now()->toISOString(),
                ]
            ]);

            \Log::info('In-app notification sent', [
                'document_request_id' => $id,
                'user_id' => $user->id,
                'title' => $validated['title']
            ]);

            return response()->json([
                'success' => true,
                'message' => 'In-app notification sent successfully'
            ]);

        } catch (\Exception $e) {
            \Log::error('Send in-app notification error: ' . $e->getMessage());
            \Log::error('Stack trace: ' . $e->getTraceAsString());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to send notification',
                'error' => config('app.debug') ? $e->getMessage() : null
            ], 500);
        }
    }
}