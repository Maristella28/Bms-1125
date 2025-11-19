<?php

namespace App\Http\Controllers;

use App\Models\ProgramApplicationForms;
use App\Models\ApplicationFormField;
use App\Models\ApplicationSubmission;
use App\Models\ApplicationSubmissionData;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;
use App\Mail\ApplicationStatusNotificationMail;
use App\Notifications\ApplicationStatusUpdated;

class ProgramApplicationFormController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request): JsonResponse
    {
        $query = ProgramApplicationForms::with(['program', 'fields', 'submissions']);

        // Filter by program if provided
        if ($request->has('program_id')) {
            $query->where('program_id', $request->program_id);
        }

        // For residents (non-admin users), only show published forms
        $user = auth()->user();
        if ($user && $user->role !== 'admin' && $user->role !== 'staff') {
            // Residents should only see published forms
            $query->where('status', 'published');
        } else {
            // Admins and staff can see all forms, but can filter by status if provided
        if ($request->has('status')) {
            $query->where('status', $request->status);
            }
        }

        $forms = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'success' => true,
            'data' => $forms
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): JsonResponse
    {
        // Prepare validation data - ensure published_at is set if deadline is set
        $validationData = $request->all();
        if (isset($validationData['deadline']) && !empty($validationData['deadline']) && 
            (!isset($validationData['published_at']) || empty($validationData['published_at']))) {
            // If deadline is set but published_at is not, set published_at to now for validation
            $validationData['published_at'] = now()->toISOString();
        }
        
        $validator = Validator::make($validationData, [
            'program_id' => 'required|exists:programs,id',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'status' => 'in:draft,published,closed',
            'published_at' => 'nullable|date',
            'deadline' => 'nullable|date|after:published_at',
            'allow_multiple_submissions' => 'boolean',
            'form_settings' => 'nullable|array',
            'fields' => 'required|array|min:1',
            'fields.*.field_name' => 'required|string|max:255',
            'fields.*.field_label' => 'required|string|max:255',
            'fields.*.field_type' => 'required|in:text,textarea,select,checkbox,file,email,number,date',
            'fields.*.field_description' => 'nullable|string',
            'fields.*.is_required' => 'boolean',
            'fields.*.field_options' => 'nullable|array',
            'fields.*.validation_rules' => 'nullable|array',
            'fields.*.sort_order' => 'integer|min:0',
            'fields.*.is_active' => 'boolean'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        DB::beginTransaction();
        try {
            // Prepare form data, handling null values properly
            $formData = [
                'program_id' => $request->program_id,
                'title' => $request->title,
                'description' => $request->description ?: null,
                'status' => $request->status ?? 'draft',
                'published_at' => $request->published_at ?: null,
                'deadline' => $request->deadline ?: null,
                'allow_multiple_submissions' => $request->boolean('allow_multiple_submissions'),
                'form_settings' => $request->form_settings ?: null
            ];
            
            // Create the form
            $form = ProgramApplicationForms::create($formData);

            // Create form fields
            foreach ($request->fields as $fieldData) {
                // Handle field_options - convert empty array to null, ensure it's an array or null
                $fieldOptions = null;
                if (isset($fieldData['field_options']) && !empty($fieldData['field_options'])) {
                    if (is_array($fieldData['field_options']) && count($fieldData['field_options']) > 0) {
                        $fieldOptions = $fieldData['field_options'];
                    }
                }
                
                // Handle validation_rules - convert empty object/array to null
                $validationRules = null;
                if (isset($fieldData['validation_rules']) && !empty($fieldData['validation_rules'])) {
                    if (is_array($fieldData['validation_rules']) && count($fieldData['validation_rules']) > 0) {
                        $validationRules = $fieldData['validation_rules'];
                    }
                }
                
                try {
                ApplicationFormField::create([
                    'form_id' => $form->id,
                    'field_name' => $fieldData['field_name'],
                    'field_label' => $fieldData['field_label'],
                    'field_type' => $fieldData['field_type'],
                        'field_description' => !empty($fieldData['field_description']) ? $fieldData['field_description'] : null,
                        'is_required' => isset($fieldData['is_required']) ? (bool)$fieldData['is_required'] : false,
                        'field_options' => $fieldOptions,
                        'validation_rules' => $validationRules,
                        'sort_order' => isset($fieldData['sort_order']) ? (int)$fieldData['sort_order'] : 0,
                        'is_active' => isset($fieldData['is_active']) ? (bool)$fieldData['is_active'] : true
                    ]);
                } catch (\Exception $fieldException) {
                    \Log::error('Error creating field: ' . $fieldException->getMessage(), [
                        'field_data' => $fieldData,
                        'trace' => $fieldException->getTraceAsString()
                    ]);
                    throw $fieldException;
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Application form created successfully',
                'data' => $form->load(['program', 'fields'])
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            
            // Log the full error for debugging
            \Log::error('Error creating application form: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'request_data' => $request->all()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to create application form',
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ], 500);
        }
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id): JsonResponse
    {
        $form = ProgramApplicationForms::with(['program', 'fields' => function($query) {
            $query->active()->ordered();
        }, 'submissions'])->find($id);

        if (!$form) {
            return response()->json([
                'success' => false,
                'message' => 'Application form not found'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $form
        ]);
    }

    /**
     * Get residents who have approved submissions for all published forms of a program
     */
    public function getQualifiedResidents(Request $request, string $programId): JsonResponse
    {
        try {
            // Get all published forms for this program
            $publishedForms = ProgramApplicationForms::where('program_id', $programId)
                ->where('status', 'published')
                ->get();

            \Log::info('Qualified Residents Debug', [
                'program_id' => $programId,
                'published_forms_count' => $publishedForms->count(),
                'published_forms' => $publishedForms->map(function($form) {
                    return [
                        'id' => $form->id,
                        'title' => $form->title,
                        'status' => $form->status,
                        'published_at' => $form->published_at
                    ];
                })
            ]);

            if ($publishedForms->isEmpty()) {
                return response()->json([
                    'success' => true,
                    'data' => [],
                    'message' => 'No published forms found for this program'
                ]);
            }

            $formIds = $publishedForms->pluck('id');

            // Get all residents who have any approved submissions for this program's forms
            $residentsWithApprovals = \App\Models\Resident::whereHas('applicationSubmissions', function ($query) use ($formIds) {
                $query->whereIn('form_id', $formIds)
                      ->where('status', 'approved');
            })
            ->with(['user', 'profile', 'applicationSubmissions' => function($query) use ($formIds) {
                $query->whereIn('form_id', $formIds);
            }])
            ->get();

            \Log::info('Residents with approvals debug', [
                'residents_count' => $residentsWithApprovals->count(),
                'residents' => $residentsWithApprovals->map(function($resident) use ($formIds) {
                    $submissions = $resident->applicationSubmissions->whereIn('form_id', $formIds);
                    return [
                        'resident_id' => $resident->id,
                        'name' => $resident->first_name . ' ' . $resident->last_name,
                        'submissions_count' => $submissions->count(),
                        'approved_count' => $submissions->where('status', 'approved')->count(),
                        'submissions' => $submissions->map(function($sub) {
                            return [
                                'form_id' => $sub->form_id,
                                'status' => $sub->status
                            ];
                        })
                    ];
                })
            ]);

            // Filter residents who have approved submissions for ALL published forms
            $qualifiedResidents = $residentsWithApprovals->filter(function ($resident) use ($formIds) {
                // Check if resident has approved submissions for ALL forms
                $approvedFormIds = $resident->applicationSubmissions()
                    ->whereIn('form_id', $formIds)
                    ->where('status', 'approved')
                    ->pluck('form_id')
                    ->unique();
                
                $hasAllApprovals = $approvedFormIds->count() === $formIds->count();
                
                \Log::info('Resident qualification check', [
                    'resident_id' => $resident->id,
                    'resident_name' => $resident->first_name . ' ' . $resident->last_name,
                    'required_forms' => $formIds->toArray(),
                    'approved_forms' => $approvedFormIds->toArray(),
                    'has_all_approvals' => $hasAllApprovals
                ]);
                
                return $hasAllApprovals;
            })
            ->map(function ($resident) {
                return [
                    'id' => $resident->id,
                    'first_name' => $resident->first_name,
                    'last_name' => $resident->last_name,
                    'email' => $resident->user->email ?? $resident->email,
                    'mobile_number' => $resident->mobile_number,
                    'current_address' => $resident->current_address,
                    'resident_id' => $resident->resident_id,
                    'user_id' => $resident->user_id
                ];
            });

            return response()->json([
                'success' => true,
                'data' => $qualifiedResidents->values(),
                'message' => 'Qualified residents loaded successfully',
                'meta' => [
                    'total_forms' => $formIds->count(),
                    'qualified_residents' => $qualifiedResidents->count(),
                    'debug_info' => [
                        'published_forms' => $publishedForms->map(function($form) {
                            return ['id' => $form->id, 'title' => $form->title];
                        }),
                        'form_ids' => $formIds->toArray()
                    ]
                ]
            ]);

        } catch (\Exception $e) {
            \Log::error('Error fetching qualified residents', [
                'program_id' => $programId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch qualified residents',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $form = ProgramApplicationForms::find($id);

        if (!$form) {
            return response()->json([
                'success' => false,
                'message' => 'Application form not found'
            ], 404);
        }

        // Prepare validation data - ensure published_at is set if deadline is set
        $validationData = $request->all();
        if (isset($validationData['deadline']) && !empty($validationData['deadline']) && 
            (!isset($validationData['published_at']) || empty($validationData['published_at']))) {
            // If deadline is set but published_at is not, set published_at to now for validation
            $validationData['published_at'] = now()->toISOString();
        }

        $validator = Validator::make($validationData, [
            'title' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'status' => 'sometimes|in:draft,published,closed',
            'published_at' => 'nullable|date',
            'deadline' => 'nullable|date|after:published_at',
            'allow_multiple_submissions' => 'sometimes|boolean',
            'form_settings' => 'nullable|array',
            'fields' => 'sometimes|array|min:1',
            'fields.*.field_name' => 'required|string|max:255',
            'fields.*.field_label' => 'required|string|max:255',
            'fields.*.field_type' => 'required|in:text,textarea,select,checkbox,file,email,number,date',
            'fields.*.field_description' => 'nullable|string',
            'fields.*.is_required' => 'boolean',
            'fields.*.field_options' => 'nullable|array',
            'fields.*.validation_rules' => 'nullable|array',
            'fields.*.sort_order' => 'integer|min:0',
            'fields.*.is_active' => 'boolean'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        DB::beginTransaction();
        try {
            // Prepare form data, handling null values properly
            $formData = [
                'title' => $request->has('title') ? $request->title : $form->title,
                'description' => $request->has('description') ? ($request->description ?: null) : $form->description,
                'status' => $request->has('status') ? $request->status : $form->status,
                'published_at' => $request->has('published_at') ? ($request->published_at ?: null) : $form->published_at,
                'deadline' => $request->has('deadline') ? ($request->deadline ?: null) : $form->deadline,
                'allow_multiple_submissions' => $request->has('allow_multiple_submissions') ? $request->boolean('allow_multiple_submissions') : $form->allow_multiple_submissions,
                'form_settings' => $request->has('form_settings') ? ($request->form_settings ?: null) : $form->form_settings
            ];

            // Update the form
            $form->update($formData);

            // Update form fields if provided
            if ($request->has('fields')) {
                // Delete existing fields
                $form->fields()->delete();

                // Create new fields
                foreach ($request->fields as $fieldData) {
                    // Handle field_options - convert empty array to null, ensure it's an array or null
                    $fieldOptions = null;
                    if (isset($fieldData['field_options']) && !empty($fieldData['field_options'])) {
                        if (is_array($fieldData['field_options']) && count($fieldData['field_options']) > 0) {
                            $fieldOptions = $fieldData['field_options'];
                        }
                    }
                    
                    // Handle validation_rules - convert empty object/array to null
                    $validationRules = null;
                    if (isset($fieldData['validation_rules']) && !empty($fieldData['validation_rules'])) {
                        if (is_array($fieldData['validation_rules']) && count($fieldData['validation_rules']) > 0) {
                            $validationRules = $fieldData['validation_rules'];
                        }
                    }
                    
                    try {
                    ApplicationFormField::create([
                        'form_id' => $form->id,
                        'field_name' => $fieldData['field_name'],
                        'field_label' => $fieldData['field_label'],
                        'field_type' => $fieldData['field_type'],
                            'field_description' => !empty($fieldData['field_description']) ? $fieldData['field_description'] : null,
                            'is_required' => isset($fieldData['is_required']) ? (bool)$fieldData['is_required'] : false,
                            'field_options' => $fieldOptions,
                            'validation_rules' => $validationRules,
                            'sort_order' => isset($fieldData['sort_order']) ? (int)$fieldData['sort_order'] : 0,
                            'is_active' => isset($fieldData['is_active']) ? (bool)$fieldData['is_active'] : true
                        ]);
                    } catch (\Exception $fieldException) {
                        \Log::error('Error updating field: ' . $fieldException->getMessage(), [
                            'field_data' => $fieldData,
                            'trace' => $fieldException->getTraceAsString()
                        ]);
                        throw $fieldException;
                    }
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Application form updated successfully',
                'data' => $form->load(['program', 'fields'])
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            
            // Log the full error for debugging
            \Log::error('Error updating application form: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'request_data' => $request->all(),
                'form_id' => $id
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to update application form',
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ], 500);
        }
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id): JsonResponse
    {
        $form = ProgramApplicationForms::find($id);

        if (!$form) {
            return response()->json([
                'success' => false,
                'message' => 'Application form not found'
            ], 404);
        }

        // Delete associated files
        $submissions = $form->submissions()->with('submissionData')->get();
        foreach ($submissions as $submission) {
            foreach ($submission->submissionData as $data) {
                if ($data->isFile() && Storage::exists($data->file_path)) {
                    Storage::delete($data->file_path);
                }
            }
        }

        $form->delete();

        return response()->json([
            'success' => true,
            'message' => 'Application form deleted successfully'
        ]);
    }

    /**
     * Publish a form
     */
    public function publish(string $id): JsonResponse
    {
        $form = ProgramApplicationForms::find($id);

        if (!$form) {
            return response()->json([
                'success' => false,
                'message' => 'Application form not found'
            ], 404);
        }

        $form->update([
            'status' => 'published',
            'published_at' => now()
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Application form published successfully',
            'data' => $form->load(['program', 'fields'])
        ]);
    }

    /**
     * Get published forms for residents
     */
    public function getPublishedForms(Request $request): JsonResponse
    {
        $forms = ProgramApplicationForms::published()
            ->with(['program', 'fields' => function($query) {
                $query->active()->ordered();
            }])
            ->orderBy('published_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $forms
        ]);
    }

    /**
     * Get form submissions for admin review
     */
    public function getFormSubmissions(Request $request, string $id): JsonResponse
    {
        $form = ProgramApplicationForms::with(['fields', 'submissions.resident', 'submissions.submissionData.field'])
            ->find($id);

        if (!$form) {
            return response()->json([
                'success' => false,
                'message' => 'Application form not found'
            ], 404);
        }

        // Get submissions with resident and submission data
        $submissions = ApplicationSubmission::with([
            'resident',
            'submissionData.field',
            'reviewer'
        ])
        ->where('form_id', $id)
        ->orderBy('submitted_at', 'desc')
        ->get();

        // Format submissions data for frontend
        $formattedSubmissions = $submissions->map(function ($submission) use ($form) {
            $submissionData = [];
            
            // Group submission data by field
            foreach ($submission->submissionData as $data) {
                $field = $data->field;
                if ($field) {
                    $submissionData[$field->field_name] = [
                        'label' => $field->field_label,
                        'type' => $field->field_type,
                        'value' => $data->field_value,
                        'file_path' => $data->file_path,
                        'file_original_name' => $data->file_original_name,
                        'file_mime_type' => $data->file_mime_type,
                        'file_size' => $data->file_size,
                        'is_file' => $data->isFile(),
                        'file_url' => $data->getFileUrl()
                    ];
                }
            }

            return [
                'id' => $submission->id,
                'resident' => [
                    'id' => $submission->resident->id,
                    'name' => trim(($submission->resident->first_name ?? '') . ' ' . 
                                 ($submission->resident->middle_name ?? '') . ' ' . 
                                 ($submission->resident->last_name ?? '')),
                    'email' => $submission->resident->email,
                    'contact_number' => $submission->resident->contact_number,
                    'resident_id' => $submission->resident->resident_id
                ],
                'status' => $submission->status,
                'admin_notes' => $submission->admin_notes,
                'submitted_at' => $submission->submitted_at,
                'reviewed_at' => $submission->reviewed_at,
                'reviewer' => $submission->reviewer ? [
                    'id' => $submission->reviewer->id,
                    'name' => $submission->reviewer->name,
                    'email' => $submission->reviewer->email
                ] : null,
                'submission_data' => $submissionData
            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'form' => [
                    'id' => $form->id,
                    'title' => $form->title,
                    'description' => $form->description,
                    'fields' => $form->fields->map(function ($field) {
                        return [
                            'id' => $field->id,
                            'field_name' => $field->field_name,
                            'field_label' => $field->field_label,
                            'field_type' => $field->field_type,
                            'is_required' => $field->is_required,
                            'field_options' => $field->field_options
                        ];
                    })
                ],
                'submissions' => $formattedSubmissions,
                'total_submissions' => $submissions->count(),
                'status_counts' => [
                    'pending' => $submissions->where('status', 'pending')->count(),
                    'under_review' => $submissions->where('status', 'under_review')->count(),
                    'approved' => $submissions->where('status', 'approved')->count(),
                    'rejected' => $submissions->where('status', 'rejected')->count()
                ]
            ]
        ]);
    }

    /**
     * Get user's form submissions
     */
    public function getMySubmissions(Request $request): JsonResponse
    {
        // Get resident ID from authenticated user
        $user = auth()->user();
        $resident = \App\Models\Resident::where('user_id', $user->id)->first();
        
        if (!$resident) {
            return response()->json([
                'success' => false,
                'message' => 'Resident profile not found. Please complete your profile first.'
            ], 400);
        }

        // Get submissions for this resident
        $submissions = ApplicationSubmission::with([
            'form.program',
            'submissionData.field'
        ])
        ->where('resident_id', $resident->id)
        ->orderBy('submitted_at', 'desc')
        ->get();

        // Format submissions data for frontend
        $formattedSubmissions = $submissions->map(function ($submission) {
            $submissionData = [];
            
            foreach ($submission->submissionData as $data) {
                $field = $data->field;
                if ($field) {
                    $submissionData[$field->field_name] = [
                        'label' => $field->field_label,
                        'value' => $data->field_value,
                        'type' => $field->field_type,
                        'is_file' => $field->field_type === 'file',
                        'file_url' => $data->file_url,
                        'file_original_name' => $data->file_original_name,
                        'file_size' => $data->file_size
                    ];
                }
            }

            return [
                'id' => $submission->id,
                'form' => $submission->form ? [
                    'id' => $submission->form->id,
                    'title' => $submission->form->title,
                    'description' => $submission->form->description,
                    'program' => $submission->form->program ? [
                        'id' => $submission->form->program->id,
                        'name' => $submission->form->program->name
                    ] : null
                ] : [
                    'id' => null,
                    'title' => 'Form Not Available',
                    'description' => 'The original form has been removed or is no longer available.',
                    'program' => null
                ],
                'status' => $submission->status,
                'submitted_at' => $submission->submitted_at,
                'reviewed_at' => $submission->reviewed_at,
                'admin_notes' => $submission->admin_notes,
                'submission_data' => $submissionData
            ];
        });

        return response()->json([
            'submissions' => $formattedSubmissions,
            'total' => $submissions->count(),
            'message' => $submissions->count() > 0 
                ? 'Submissions loaded successfully' 
                : 'No applications submitted yet. Apply for programs to see them here.'
        ]);
    }

    /**
     * Submit application form
     */
    public function submitApplication(Request $request, string $id): JsonResponse
    {
        $form = ProgramApplicationForms::with('fields')->find($id);

        if (!$form) {
            return response()->json([
                'success' => false,
                'message' => 'Application form not found'
            ], 404);
        }

        if ($form->status !== 'published') {
            return response()->json([
                'success' => false,
                'message' => 'Application form is not available for submissions'
            ], 400);
        }

        // Check if form is still active
        if ($form->deadline && now() > $form->deadline) {
            return response()->json([
                'success' => false,
                'message' => 'Application deadline has passed'
            ], 400);
        }

        // Get resident ID from authenticated user
        $user = auth()->user();
        $resident = \App\Models\Resident::where('user_id', $user->id)->first();
        
        if (!$resident) {
            return response()->json([
                'success' => false,
                'message' => 'Resident profile not found. Please complete your profile first.'
            ], 400);
        }
        
        $residentId = $resident->id;

        // Check if multiple submissions are allowed
        if (!$form->allow_multiple_submissions) {
            $existingSubmission = ApplicationSubmission::where('form_id', $form->id)
                ->where('resident_id', $residentId)
                ->first();

            if ($existingSubmission) {
                return response()->json([
                    'success' => false,
                    'message' => 'You have already submitted an application for this form'
                ], 400);
            }
        }

        DB::beginTransaction();
        try {
            // Create submission
            $submission = ApplicationSubmission::create([
                'form_id' => $form->id,
                'resident_id' => $residentId,
                'submitted_at' => now()
            ]);

            // Process form data
            foreach ($form->fields as $field) {
                $fieldValue = $request->input($field->field_name);
                $filePath = null;
                $fileOriginalName = null;
                $fileMimeType = null;
                $fileSize = null;

                // Handle file uploads
                if ($field->field_type === 'file' && $request->hasFile($field->field_name)) {
                    $file = $request->file($field->field_name);
                    $fileOriginalName = $file->getClientOriginalName();
                    $fileMimeType = $file->getMimeType();
                    $fileSize = $file->getSize();
                    
                    // Validate file
                    $maxSize = 5 * 1024 * 1024; // 5MB
                    if ($fileSize > $maxSize) {
                        throw new \Exception("File size exceeds 5MB limit");
                    }

                    $allowedTypes = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'];
                    $extension = $file->getClientOriginalExtension();
                    if (!in_array(strtolower($extension), $allowedTypes)) {
                        throw new \Exception("File type not allowed");
                    }

                    $filePath = $file->store('application-files', 'public');
                }

                // Store submission data
                ApplicationSubmissionData::create([
                    'submission_id' => $submission->id,
                    'field_id' => $field->id,
                    'field_value' => $fieldValue,
                    'file_path' => $filePath,
                    'file_original_name' => $fileOriginalName,
                    'file_mime_type' => $fileMimeType,
                    'file_size' => $fileSize
                ]);
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Application submitted successfully',
                'data' => $submission
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to submit application',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update submission status
     */
    public function updateSubmissionStatus(Request $request, string $submissionId): JsonResponse
    {
        $request->validate([
            'status' => 'required|in:pending,under_review,approved,rejected',
            'admin_notes' => 'nullable|string|max:1000'
        ]);

        $submission = ApplicationSubmission::find($submissionId);
        
        if (!$submission) {
            return response()->json([
                'success' => false,
                'message' => 'Submission not found'
            ], 404);
        }

        try {
            $submission->update([
                'status' => $request->status,
                'admin_notes' => $request->admin_notes,
                'reviewed_at' => now(),
                'reviewed_by' => auth()->id()
            ]);

            // Send email notification to resident
            try {
                $resident = $submission->resident;
                $user = $resident->user;
                
                if ($user && $user->email) {
                    // Load the form and program relationships for the email
                    $submission->load(['form.program', 'resident.user']);
                    
                    Mail::to($user->email)->send(new ApplicationStatusNotificationMail(
                        $user,
                        $submission,
                        $request->status,
                        $request->admin_notes
                    ));
                    
                    // Send in-app notification
                    $user->notify(new ApplicationStatusUpdated($submission, $request->status, $request->admin_notes));
                    
                    \Log::info('Application status notification email sent', [
                        'submission_id' => $submission->id,
                        'resident_id' => $resident->id,
                        'user_email' => $user->email,
                        'status' => $request->status
                    ]);
                } else {
                    \Log::warning('Cannot send email notification - user email not found', [
                        'submission_id' => $submission->id,
                        'resident_id' => $resident->id,
                        'user_id' => $user ? $user->id : 'N/A'
                    ]);
                }
            } catch (\Exception $mailError) {
                \Log::error('Failed to send application status notification email', [
                    'submission_id' => $submission->id,
                    'error' => $mailError->getMessage(),
                    'trace' => $mailError->getTraceAsString()
                ]);
                // Don't fail the status update if email fails
            }

            return response()->json([
                'success' => true,
                'message' => 'Submission status updated successfully',
                'data' => $submission->fresh(['resident', 'reviewer'])
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update submission status',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
