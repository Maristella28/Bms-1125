<?php

namespace App\Http\Controllers;

use App\Models\Staff;
use App\Models\StaffProfile;
use App\Models\User;
use App\Mail\VerificationCodeMail;
use App\Services\ActivityLogService;
use App\Traits\ChecksStaffPermissions;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rules\Password;
use Illuminate\Database\QueryException;

class StaffController extends Controller
{
    use ChecksStaffPermissions;
    /**
     * Display a listing of staff members.
     */
    public function index(Request $request)
    {
        // Check if user has staff management permission
        $permissionCheck = $this->checkModulePermission($request, 'staffManagement', 'staff management');
        if ($permissionCheck) {
            return $permissionCheck;
        }

        try {
            $staff = Staff::where('active', true)->get();
            return response()->json(['staff' => $staff]);
        } catch (QueryException $e) {
            Log::error('Database error in StaffController@index: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to fetch staff list'], 500);
        } catch (\Exception $e) {
            Log::error('Error in StaffController@index: ' . $e->getMessage());
            return response()->json(['message' => 'An unexpected error occurred'], 500);
        }
    }

    /**
     * Store a newly created staff member.
     */
    public function store(Request $request)
    {
        // Check if user has staff management permission
        $permissionCheck = $this->checkModulePermission($request, 'staffManagement', 'staff management');
        if ($permissionCheck) {
            return $permissionCheck;
        }

        try {
            DB::beginTransaction();
            
            $validated = $request->validate([
                'name' => ['required', 'string', 'max:255'],
                'email' => [
                    'required', 
                    'string', 
                    'email', 
                    'max:255',
                    'unique:users,email',
                    'unique:staff,email'
                ],
                'password' => ['required', Password::defaults()],
                'modulePermissions' => ['required', 'array'],
                'modulePermissions.*' => ['required', 'boolean'],
                'department' => ['required', 'string', 'max:255'],
                'contactNumber' => ['required', 'string', 'max:255'],
                'position' => ['required', 'string', 'max:255'],
                'birthdate' => ['required', 'date'],
                'gender' => ['required', 'string'],
                'civilStatus' => ['required', 'string'],
                'address' => ['nullable', 'string'],
                'selectedResident' => ['nullable']
            ]);


            // Generate 6-digit verification code
            $verificationCode = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
            
            // Create user account first with verification code
            $user = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => Hash::make($validated['password']),
                'role' => 'staff',
                'residency_status' => 'active',
                'verification_code' => $verificationCode,
                'verification_code_expires_at' => now()->addMinutes(5),
                'privacy_policy_accepted' => true,
                'privacy_policy_accepted_at' => now(),
            ]);

            // Send verification code email (same as registration flow)
            try {
                // Create the mail instance - VerificationCodeMail handles from address internally
                $mail = new VerificationCodeMail($user, $verificationCode);
                
                // Send the email
                Mail::to($user->email)->send($mail);
                
                Log::info('Staff verification email sent successfully', [
                    'user_id' => $user->id,
                    'email' => $user->email,
                    'verification_code' => $verificationCode,
                    'expires_at' => $user->verification_code_expires_at
                ]);
            } catch (\Exception $mailError) {
                Log::error('Failed to send staff verification email:', [
                    'error' => $mailError->getMessage(),
                    'user_id' => $user->id,
                    'email' => $user->email,
                    'verification_code' => $verificationCode
                ]);
                
                // Log the code for testing purposes
                Log::info('Staff verification code for testing: ' . $verificationCode);
                
                // Don't fail staff creation if email fails, just log it
                // The user can still verify using the code from logs
            }

            // Then create staff record
            // Transform the validated data to match database column names
            $staffData = [
                'user_id' => $user->id,
                'name' => $validated['name'],
                'email' => $validated['email'],
                'department' => $validated['department'],
                'position' => $validated['position'],
                'contact_number' => $validated['contactNumber'],
                'birthdate' => $validated['birthdate'],
                'gender' => $validated['gender'],
                'civil_status' => $validated['civilStatus'],
                'address' => $validated['address'],
                'resident_id' => $validated['selectedResident'] ?: null, // Handle empty string
                'active' => true,
                'module_permissions' => $request->modulePermissions
            ];

            // Create staff record with properly formatted data
            $staff = Staff::create($staffData);
            
            // Log staff creation
            $user = Auth::user();
            if ($user) {
                ActivityLogService::logCreated($staff, $request);
            }

            DB::commit();

        return response()->json([
            'message' => 'Staff account created successfully. Please check your email for the verification code.',
            'staff' => $staff,
            'user_id' => $user->id,
            'email' => $user->email,
            'requires_verification' => true,
        ], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            Log::error('Validation error creating staff account: ' . $e->getMessage());
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->validator->errors()->all()
            ], 422);
        } catch (QueryException $e) {
            DB::rollBack();
            Log::error('Database error creating staff account: ' . $e->getMessage());
            
            // Check for duplicate email
            if ($e->getCode() === '23000') { // Integrity constraint violation
                return response()->json([
                    'message' => 'Email address is already in use',
                    'error' => 'duplicate_email'
                ], 422);
            }
            
            return response()->json([
                'message' => 'Database error while creating staff account',
                'error' => 'database_error'
            ], 500);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error creating staff account: ' . $e->getMessage());
            return response()->json([
                'message' => 'Failed to create staff account',
                'error' => 'server_error'
            ], 500);
        }
    }

    /**
     * Display the specified staff member.
     */
    public function show(Request $request, Staff $staff)
    {
        // Check if user has staff management permission
        $permissionCheck = $this->checkModulePermission($request, 'staffManagement', 'staff management');
        if ($permissionCheck) {
            return $permissionCheck;
        }

        return response()->json($staff);
    }

    /**
     * Update the specified staff member.
     */
    public function update(Request $request, Staff $staff)
    {
        // Check if user has staff management permission
        $permissionCheck = $this->checkModulePermission($request, 'staffManagement', 'staff management');
        if ($permissionCheck) {
            return $permissionCheck;
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'string', 'email', 'max:255', 'unique:staff,email,' . $staff->id],
            'department' => ['sometimes', 'string', 'max:255'],
            'contact_number' => ['sometimes', 'string', 'max:255'],
            'role' => ['sometimes', 'string', 'in:staff,admin']
        ]);

        $oldValues = $staff->getOriginal();
        $staff->update($validated);
        
        // Log staff update
        $user = Auth::user();
        if ($user) {
            ActivityLogService::logUpdated($staff, $oldValues, $request);
        }

        return response()->json([
            'message' => 'Staff account updated successfully',
            'staff' => $staff
        ]);
    }

    /**
     * Deactivate the specified staff member.
     */
    public function deactivate(Request $request, Staff $staff)
    {
        // Check if user has staff management permission
        $permissionCheck = $this->checkModulePermission($request, 'staffManagement', 'staff management');
        if ($permissionCheck) {
            return $permissionCheck;
        }

        $staff->update(['active' => false]);

        return response()->json([
            'message' => 'Staff account deactivated successfully',
            'staff' => $staff
        ]);
    }

    /**
     * Reactivate the specified staff member.
     */
    public function reactivate(Staff $staff)
    {
        $staff->update(['active' => true]);

        return response()->json([
            'message' => 'Staff account reactivated successfully',
            'staff' => $staff
        ]);
    }

    /**
     * Update module permissions for a staff member.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  int  $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function updateModulePermissions(Request $request, $id)
    {
        Log::info('=== updateModulePermissions CALLED ===', [
            'staff_id' => $id,
            'request_data' => $request->all(),
            'module_permissions_received' => $request->module_permissions,
            'user_id' => $request->user()?->id,
            'user_role' => $request->user()?->role
        ]);
        
        // Check if user has staff management permission
        $permissionCheck = $this->checkModulePermission($request, 'staffManagement', 'staff management');
        if ($permissionCheck) {
            Log::warning('Permission check failed', ['response' => $permissionCheck]);
            return $permissionCheck;
        }

        try {
            // Find the staff member BEFORE starting transaction
            $staff = Staff::findOrFail($id);
            
            DB::beginTransaction();
            
            // Validate the request data
            // Note: module_permissions.* can be nested (e.g., residentsRecords_main_records_edit)
            // So we validate that all values are booleans, regardless of nesting level
            $validated = $request->validate([
                'module_permissions' => ['required', 'array'],
                'module_permissions.*' => ['nullable'], // Allow nested arrays, we'll validate booleans manually
                'staff_id' => ['required', 'integer', 'exists:staff,id']
            ]);

            // Recursively validate that all permission values are booleans
            $validatePermissionsAreBoolean = function($permissions) use (&$validatePermissionsAreBoolean) {
                foreach ($permissions as $key => $value) {
                    if (is_array($value)) {
                        $validatePermissionsAreBoolean($value);
                    } else {
                        if (!is_bool($value) && $value !== 0 && $value !== 1 && $value !== '0' && $value !== '1' && $value !== 'true' && $value !== 'false') {
                            throw \Illuminate\Validation\ValidationException::withMessages([
                                'module_permissions' => ["Permission '{$key}' must be a boolean value"]
                            ]);
                        }
                    }
                }
            };
            
            // Flatten nested permissions and ensure all are booleans
            // IMPORTANT: This should NOT be called if permissions are already flat!
            // The frontend sends flat permissions like: residentsRecords_main_records_view: true
            // So we should NOT flatten them again
            $flattenPermissions = function($permissions, $prefix = '') use (&$flattenPermissions) {
                $result = [];
                foreach ($permissions as $key => $value) {
                    $fullKey = $prefix ? "{$prefix}_{$key}" : $key;
                    if (is_array($value)) {
                        // Only recurse if it's a nested array structure
                        // If it's already a flat key-value structure, don't flatten
                        $result = array_merge($result, $flattenPermissions($value, $fullKey));
                    } else {
                        // Convert to boolean
                        $result[$fullKey] = filter_var($value, FILTER_VALIDATE_BOOLEAN);
                    }
                }
                return $result;
            };
            
            // Process incoming permissions
            // The frontend sends FLAT permissions like: residentsRecords_main_records_view: true
            // So we should NOT flatten them - they're already in the correct format
            $incomingPermissions = $request->module_permissions;
            if (!empty($incomingPermissions) && is_array($incomingPermissions)) {
                // Check if permissions are nested (have array values that are NOT booleans)
                // If keys contain underscores like "residentsRecords_main_records_view", they're already flat
                $hasNested = false;
                $hasFlatKeys = false;
                foreach ($incomingPermissions as $key => $value) {
                    // Check if key contains underscores (indicating flat format)
                    if (strpos($key, '_') !== false) {
                        $hasFlatKeys = true;
                    }
                    // If value is an array AND the key doesn't contain underscores, it's nested
                    if (is_array($value) && strpos($key, '_') === false) {
                        $hasNested = true;
                    }
                }
                
                // If we have flat keys (with underscores), don't flatten - they're already flat
                if ($hasFlatKeys && !$hasNested) {
                    // Permissions are already flat (e.g., ['residentsRecords_main_records_view' => true])
                    // Just ensure they're booleans
                    Log::info('Permissions are already flat, normalizing booleans...', [
                        'sample_keys' => array_slice(array_keys($incomingPermissions), 0, 5)
                    ]);
                    foreach ($incomingPermissions as $key => $value) {
                        $incomingPermissions[$key] = filter_var($value, FILTER_VALIDATE_BOOLEAN);
                    }
                } elseif ($hasNested) {
                    // Permissions are nested (e.g., ['residentsRecords' => ['main_records' => ['view' => true]]])
                    // Flatten them
                    Log::info('Permissions are nested, flattening...');
                    $incomingPermissions = $flattenPermissions($incomingPermissions);
                } else {
                    // Default: just normalize booleans
                    foreach ($incomingPermissions as $key => $value) {
                        $incomingPermissions[$key] = filter_var($value, FILTER_VALIDATE_BOOLEAN);
                    }
                }
                
                Log::info('Processed incoming permissions', [
                    'count' => count($incomingPermissions),
                    'sample_keys' => array_slice(array_keys($incomingPermissions), 0, 10),
                    'residents_keys' => array_filter(array_keys($incomingPermissions), function($k) {
                        return strpos($k, 'residents') !== false;
                    })
                ]);
            }
            
            // Get current permissions from database to preserve existing nested permissions
            $currentPermissions = $staff->module_permissions ?? [];
            
            // Define all expected permission keys with default false values
            // Note: We only set defaults for main module keys, not nested sub-permissions
            // Nested permissions (e.g., residentsRecords_main_records_view) should come from incomingPermissions
            $defaultPermissions = [
                'dashboard' => false,
                'residentsRecords' => false,
                'documentsRecords' => false,
                'householdRecords' => false,
                'blotterRecords' => false,
                'financialTracking' => false,
                'barangayOfficials' => false,
                'staffManagement' => false,
                'communicationAnnouncement' => false,
                'socialServices' => false,
                'disasterEmergency' => false,
                'projectManagement' => false,
                'inventoryAssets' => false,
                'activityLogs' => false
            ];
            
            // IMPORTANT: Merge strategy to preserve ALL existing nested permissions:
            // 1. Start with current permissions (preserves ALL existing nested permissions from DB)
            // 2. Apply incoming permissions (updates only the ones being changed)
            // 3. Apply defaults for main module keys that don't exist
            // This ensures:
            // - All existing nested permissions are preserved
            // - Only permissions in incomingPermissions are updated
            // - Main module keys always have a value
            $finalPermissions = $currentPermissions; // Start with existing permissions
            
            // Update with incoming permissions (only the ones being changed)
            foreach ($incomingPermissions as $key => $value) {
                $finalPermissions[$key] = filter_var($value, FILTER_VALIDATE_BOOLEAN);
            }
            
            // CRITICAL: Ensure all nested permissions for residentsRecords_main_records are present
            // Even if they weren't in incomingPermissions, we need to preserve them from currentPermissions
            // or set them to false if they don't exist
            $residentsNestedKeys = [
                'residentsRecords_main_records',
                'residentsRecords_main_records_view',
                'residentsRecords_main_records_edit',
                'residentsRecords_main_records_disable',
                'residentsRecords_disabled_residents'
            ];
            
            // Log what we have before ensuring nested keys
            Log::info('Before ensuring nested keys', [
                'incoming_has_main_records' => isset($incomingPermissions['residentsRecords_main_records']),
                'incoming_has_view' => isset($incomingPermissions['residentsRecords_main_records_view']),
                'incoming_has_edit' => isset($incomingPermissions['residentsRecords_main_records_edit']),
                'incoming_has_disable' => isset($incomingPermissions['residentsRecords_main_records_disable']),
                'current_has_main_records' => isset($currentPermissions['residentsRecords_main_records']),
                'current_has_view' => isset($currentPermissions['residentsRecords_main_records_view']),
            ]);
            
            // Always ensure nested permissions are present, regardless of main module state
            // This ensures they're always saved, even if the frontend didn't send them
            foreach ($residentsNestedKeys as $nestedKey) {
                if (!isset($finalPermissions[$nestedKey])) {
                    // Prefer incoming (if sent), then current (if exists), then false
                    $finalPermissions[$nestedKey] = $incomingPermissions[$nestedKey] ?? $currentPermissions[$nestedKey] ?? false;
                    Log::info("Added missing nested key: {$nestedKey} = " . ($finalPermissions[$nestedKey] ? 'true' : 'false'), [
                        'source' => isset($incomingPermissions[$nestedKey]) ? 'incoming' : (isset($currentPermissions[$nestedKey]) ? 'current' : 'default')
                    ]);
                }
            }
            
            // Ensure main module keys exist (merge defaults for missing main keys only)
            foreach ($defaultPermissions as $key => $defaultValue) {
                if (!isset($finalPermissions[$key])) {
                    $finalPermissions[$key] = $defaultValue;
                }
            }
            
            // Debug: Check if nested permissions are present
            $nestedKeys = array_filter(array_keys($finalPermissions), function($key) {
                return strpos($key, '_') !== false && strpos($key, '_', strpos($key, '_') + 1) !== false;
            });
            
            Log::info('Nested permission keys found', [
                'nested_keys' => $nestedKeys,
                'count' => count($nestedKeys)
            ]);
            
            // Log what we're about to save
            Log::info('StaffController@updateModulePermissions - Final permissions to save', [
                'staff_id' => $staff->id,
                'incoming_keys' => array_keys($incomingPermissions),
                'final_keys' => array_keys($finalPermissions),
                'residents_related_keys' => array_filter(array_keys($finalPermissions), function($key) {
                    return strpos($key, 'residents') !== false;
                }),
                'sample_permissions' => array_intersect_key($finalPermissions, array_flip([
                    'residentsRecords',
                    'residentsRecords_main_records',
                    'residentsRecords_main_records_view',
                    'residentsRecords_main_records_edit',
                    'residentsRecords_main_records_disable'
                ]))
            ]);
            
            // Log the permissions being saved BEFORE save
            Log::info('Saving staff permissions - BEFORE save', [
                'staff_id' => $staff->id,
                'final_permissions_to_save' => $finalPermissions,
                'residentsRecords_main_records_view' => $finalPermissions['residentsRecords_main_records_view'] ?? 'NOT_SET',
                'residentsRecords_main_records_edit' => $finalPermissions['residentsRecords_main_records_edit'] ?? 'NOT_SET',
                'residentsRecords_main_records_disable' => $finalPermissions['residentsRecords_main_records_disable'] ?? 'NOT_SET',
                'residentsRecords_main_records' => $finalPermissions['residentsRecords_main_records'] ?? 'NOT_SET',
                'current_db_value' => $staff->module_permissions,
            ]);
            
            // Use direct DB update to ensure it always works
            // Laravel's array comparison might not detect changes correctly
            $jsonEncoded = json_encode($finalPermissions, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            
            // Get current value for comparison
            $currentDbValue = \DB::table('staff')->where('id', $staff->id)->value('module_permissions');
            $currentDecoded = json_decode($currentDbValue, true);
            $currentJson = json_encode($currentDecoded ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $isDifferent = $currentJson !== $jsonEncoded;
            
            Log::info('About to save permissions using direct DB update', [
                'staff_id' => $staff->id,
                'final_permissions_count' => count($finalPermissions),
                'json_length' => strlen($jsonEncoded),
                'is_different' => $isDifferent,
                'current_json_length' => strlen($currentJson),
                'residentsRecords_main_records_view' => $finalPermissions['residentsRecords_main_records_view'] ?? 'NOT_SET',
                'residentsRecords_main_records_edit' => $finalPermissions['residentsRecords_main_records_edit'] ?? 'NOT_SET',
                'residentsRecords_main_records_disable' => $finalPermissions['residentsRecords_main_records_disable'] ?? 'NOT_SET',
                'current_has_view' => isset($currentDecoded['residentsRecords_main_records_view']) ? $currentDecoded['residentsRecords_main_records_view'] : 'NOT_SET',
            ]);
            
            // CRITICAL FIX: Update the database using parameterized query to ensure JSON is saved correctly
            // Pass the array directly - Laravel will handle JSON encoding for JSON columns
            $dbUpdateResult = \DB::table('staff')
                ->where('id', $staff->id)
                ->update([
                    'module_permissions' => $finalPermissions, // Pass array, Laravel handles JSON encoding
                    'updated_at' => now()
                ]);
            
            // Verify the update worked
            if ($dbUpdateResult === 0) {
                Log::error('DB update returned 0 rows affected', [
                    'staff_id' => $staff->id,
                    'update_result' => $dbUpdateResult,
                    'final_permissions_count' => count($finalPermissions),
                    'residents_keys' => array_filter(array_keys($finalPermissions), function($k) {
                        return strpos($k, 'residents') !== false;
                    })
                ]);
            }
            
            Log::info('Direct DB update result', [
                'staff_id' => $staff->id,
                'update_result' => $dbUpdateResult,
                'json_length' => strlen($jsonEncoded),
                'residentsRecords_main_records_view_in_json' => strpos($jsonEncoded, '"residentsRecords_main_records_view":true') !== false ? 'PRESENT' : 'NOT_PRESENT',
                'residentsRecords_main_records_edit_in_json' => strpos($jsonEncoded, '"residentsRecords_main_records_edit":true') !== false ? 'PRESENT' : 'NOT_PRESENT',
                'residentsRecords_main_records_disable_in_json' => strpos($jsonEncoded, '"residentsRecords_main_records_disable":true') !== false ? 'PRESENT' : 'NOT_PRESENT',
            ]);
            
            // Update the model instance to keep it in sync
            // Use setRawAttributes to bypass Laravel's casting and change detection
            $staff->setRawAttributes(array_merge($staff->getAttributes(), [
                'module_permissions' => $jsonEncoded
            ]), true);
            
            // Force the model to recognize this as changed
            $staff->syncOriginal();
            
            // Commit the transaction FIRST before verifying
            DB::commit();
            
            // Clear any model cache
            $staff->refresh();
            
            // Verify what was actually saved by querying database directly AFTER commit
            $dbPermissions = \DB::table('staff')->where('id', $staff->id)->value('module_permissions');
            $decodedDbPermissions = json_decode($dbPermissions, true);
            
            Log::info('Staff permissions after save and commit', [
                'staff_id' => $staff->id,
                'model_module_permissions' => $staff->module_permissions,
                'raw_db_value' => $dbPermissions,
                'decoded_db_value' => $decodedDbPermissions,
                'residents_related_keys' => array_filter(array_keys($decodedDbPermissions ?? []), function($key) {
                    return strpos($key, 'residents') !== false;
                }),
                'residentsRecords_main_records_view' => $decodedDbPermissions['residentsRecords_main_records_view'] ?? 'NOT_SET',
                'residentsRecords_main_records_edit' => $decodedDbPermissions['residentsRecords_main_records_edit'] ?? 'NOT_SET',
                'residentsRecords_main_records_disable' => $decodedDbPermissions['residentsRecords_main_records_disable'] ?? 'NOT_SET',
                'residentsRecords_main_records' => $decodedDbPermissions['residentsRecords_main_records'] ?? 'NOT_SET',
            ]);
            
            // Update model with what's actually in the database
            $staff->module_permissions = $decodedDbPermissions;
            
            // Final verification - query one more time to be absolutely sure
            $finalDbCheck = \DB::table('staff')->where('id', $staff->id)->value('module_permissions');
            $finalDecoded = json_decode($finalDbCheck, true);
            
            Log::info('Final verification after commit', [
                'staff_id' => $staff->id,
                'raw_db_value' => $finalDbCheck,
                'decoded_db_value' => $finalDecoded,
                'residentsRecords_main_records_view' => $finalDecoded['residentsRecords_main_records_view'] ?? 'NOT_SET',
                'residentsRecords_main_records_edit' => $finalDecoded['residentsRecords_main_records_edit'] ?? 'NOT_SET',
                'residentsRecords_main_records_disable' => $finalDecoded['residentsRecords_main_records_disable'] ?? 'NOT_SET',
                'residentsRecords_main_records' => $finalDecoded['residentsRecords_main_records'] ?? 'NOT_SET',
            ]);

            // Return success response with saved permissions for verification
            return response()->json([
                'message' => 'Permissions updated successfully',
                'staff' => $staff,
                'saved_permissions' => $staff->module_permissions,
                'residents_related_keys' => array_filter(array_keys($staff->module_permissions ?? []), function($key) {
                    return strpos($key, 'residents') !== false;
                }),
                'residentsRecords_main_records_view' => $staff->module_permissions['residentsRecords_main_records_view'] ?? 'NOT_SET',
                'residentsRecords_main_records_edit' => $staff->module_permissions['residentsRecords_main_records_edit'] ?? 'NOT_SET',
                'residentsRecords_main_records_disable' => $staff->module_permissions['residentsRecords_main_records_disable'] ?? 'NOT_SET',
                'debug_db_check' => [
                    'raw' => $finalDbCheck,
                    'decoded' => $finalDecoded,
                    'residentsRecords_main_records_view' => $finalDecoded['residentsRecords_main_records_view'] ?? 'NOT_SET',
                    'residentsRecords_main_records_edit' => $finalDecoded['residentsRecords_main_records_edit'] ?? 'NOT_SET',
                    'residentsRecords_main_records_disable' => $finalDecoded['residentsRecords_main_records_disable'] ?? 'NOT_SET',
                ]
            ]);

        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            Log::error('Validation error updating permissions', [
                'message' => $e->getMessage(),
                'errors' => $e->validator->errors()->all(),
                'request_data' => $request->all()
            ]);
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->validator->errors()->all()
            ], 422);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            DB::rollBack();
            Log::error('Staff not found: ' . $e->getMessage());
            return response()->json([
                'message' => 'Staff member not found'
            ], 404);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error updating permissions', [
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
                'staff_id' => $id,
                'request_data' => $request->all()
            ]);
            return response()->json([
                'message' => 'An error occurred while updating permissions',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Get current staff member's profile
     */
    public function myProfile(Request $request)
    {
        try {
            $user = $request->user();
            
            $staff = Staff::where('user_id', $user->id)->first();
            
            if (!$staff) {
                return response()->json([
                    'message' => 'Staff profile not found. Please complete your profile first.'
                ], 404);
            }
            
            $profile = $staff->profile;
            
            return response()->json([
                'staff' => $staff,
                'profile' => $profile,
                'profile_completed' => $profile ? $profile->profile_completed : false
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching staff profile: ' . $e->getMessage());
            return response()->json([
                'message' => 'Failed to fetch staff profile'
            ], 500);
        }
    }

    /**
     * Create or update staff profile
     */
    public function updateProfile(Request $request)
    {
        try {
            $user = $request->user();
            
            $staff = Staff::where('user_id', $user->id)->first();
            
            if (!$staff) {
                return response()->json([
                    'message' => 'Staff record not found'
                ], 404);
            }

            $validator = Validator::make($request->all(), [
                'first_name' => 'nullable|string|max:255',
                'middle_name' => 'nullable|string|max:255',
                'last_name' => 'nullable|string|max:255',
                'name_suffix' => 'nullable|string|max:255',
                'birth_date' => 'nullable|date',
                'birth_place' => 'nullable|string|max:255',
                'age' => 'nullable|integer|min:1|max:120',
                'nationality' => 'nullable|string|max:255',
                'sex' => 'nullable|string|in:Male,Female',
                'civil_status' => 'nullable|string|in:Single,Married,Widowed,Divorced,Separated',
                'religion' => 'nullable|string|max:255',
                'email' => 'required|email|max:255',
                'mobile_number' => 'nullable|string|max:20',
                'landline_number' => 'nullable|string|max:20',
                'current_address' => 'nullable|string',
                'current_photo' => 'nullable|image|mimes:jpg,jpeg,png|max:2048',
                'department' => 'nullable|string|max:255',
                'position' => 'nullable|string|max:255',
                'employee_id' => 'nullable|string|max:255',
                'hire_date' => 'nullable|date',
                'employment_status' => 'nullable|string|in:active,inactive,terminated,on_leave',
                'educational_attainment' => 'nullable|string|max:255',
                'work_experience' => 'nullable|string',
                'emergency_contact_name' => 'nullable|string|max:255',
                'emergency_contact_number' => 'nullable|string|max:20',
                'emergency_contact_relationship' => 'nullable|string|max:255',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $data = $validator->validated();

            // Handle photo upload
            if ($request->hasFile('current_photo')) {
                $photo = $request->file('current_photo');
                $photoName = time() . '_' . $photo->getClientOriginalName();
                $photoPath = $photo->storeAs('staff-photos', $photoName, 'public');
                $data['current_photo'] = $photoPath;
            }

            // Check if profile exists
            $profile = $staff->profile;
            
            if ($profile) {
                // Update existing profile
                $profile->update($data);
                $profile->profile_completed = true;
                $profile->save();
            } else {
                // Create new profile
                $data['user_id'] = $user->id;
                $data['staff_id'] = $staff->id;
                $data['profile_completed'] = true;
                
                $profile = StaffProfile::create($data);
            }

            // Update staff record with basic info (only update fields that are provided)
            $staffUpdateData = [];
            
            // Build full name if name parts are provided
            if (!empty($data['first_name']) || !empty($data['last_name'])) {
                $nameParts = array_filter([
                    $data['first_name'] ?? '',
                    $data['middle_name'] ?? '',
                    $data['last_name'] ?? ''
                ]);
                $staffUpdateData['name'] = implode(' ', $nameParts);
            }
            
            if (isset($data['email'])) $staffUpdateData['email'] = $data['email'];
            if (isset($data['department'])) $staffUpdateData['department'] = $data['department'];
            if (isset($data['position'])) $staffUpdateData['position'] = $data['position'];
            if (isset($data['mobile_number'])) $staffUpdateData['contact_number'] = $data['mobile_number'];
            if (isset($data['birth_date'])) $staffUpdateData['birthdate'] = $data['birth_date'];
            if (isset($data['sex'])) $staffUpdateData['gender'] = $data['sex'];
            if (isset($data['civil_status'])) $staffUpdateData['civil_status'] = $data['civil_status'];
            if (isset($data['current_address'])) $staffUpdateData['address'] = $data['current_address'];
            
            if (!empty($staffUpdateData)) {
                $staff->update($staffUpdateData);
            }

            return response()->json([
                'message' => 'Staff profile updated successfully',
                'staff' => $staff->fresh(),
                'profile' => $profile->fresh()
            ]);

        } catch (\Exception $e) {
            Log::error('Error updating staff profile: ' . $e->getMessage());
            return response()->json([
                'message' => 'Failed to update staff profile'
            ], 500);
        }
    }

    /**
     * Get staff profile completion status
     */
    public function profileStatus(Request $request)
    {
        try {
            $user = $request->user();
            
            $staff = Staff::where('user_id', $user->id)->first();
            
            if (!$staff) {
                return response()->json([
                    'isComplete' => false,
                    'message' => 'Staff record not found'
                ]);
            }
            
            $profile = $staff->profile;
            
            return response()->json([
                'isComplete' => $profile ? $profile->profile_completed : false,
                'has_profile' => $profile ? true : false,
                'message' => $profile ? 'Profile found' : 'No profile found'
            ]);
        } catch (\Exception $e) {
            Log::error('Error checking staff profile status: ' . $e->getMessage());
            return response()->json([
                'isComplete' => false,
                'message' => 'Failed to check profile status'
            ], 500);
        }
    }

    /**
     * Get dashboard statistics for staff
     */
    public function dashboard(Request $request)
    {
        try {
            $user = $request->user();
            
            // Get staff record
            $staff = Staff::where('user_id', $user->id)->first();
            
            if (!$staff) {
                return response()->json([
                    'message' => 'Staff record not found'
                ], 404);
            }

            // Get statistics based on staff permissions
            $permissions = $staff->module_permissions ?? [];
            $statistics = [
                'total_residents' => 0,
                'certificates_issued' => 0,
                'pending_requests' => 0,
                'household_records' => 0,
                'blotter_reports' => 0,
                'barangay_officials' => 0,
                'barangay_staff' => 0,
            ];

            // Check if staff has residents permission
            if (isset($permissions['residentsRecords']) && $permissions['residentsRecords']) {
                $statistics['total_residents'] = \App\Models\Resident::count();
                $statistics['household_records'] = \App\Models\Household::count();
            }

            // Check if staff has documents permission
            if (isset($permissions['documentsRecords']) && $permissions['documentsRecords']) {
                $statistics['certificates_issued'] = \App\Models\DocumentRequest::where('status', 'completed')->count();
                $statistics['pending_requests'] = \App\Models\DocumentRequest::where('status', 'pending')->count();
            }

            // Check if staff has blotter permission
            if (isset($permissions['blotterRecords']) && $permissions['blotterRecords']) {
                $statistics['blotter_reports'] = \App\Models\BlotterRecord::count();
            }

            // Check if staff has officials permission
            if (isset($permissions['barangayOfficials']) && $permissions['barangayOfficials']) {
                $statistics['barangay_officials'] = \App\Models\BarangayMember::count();
            }

            // Check if staff has staff management permission
            if (isset($permissions['staffManagement']) && $permissions['staffManagement']) {
                $statistics['barangay_staff'] = Staff::where('active', true)->count();
            }

            return response()->json([
                'statistics' => $statistics,
                'staff_info' => [
                    'name' => $staff->name,
                    'department' => $staff->department,
                    'position' => $staff->position,
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error fetching staff dashboard statistics: ' . $e->getMessage());
            return response()->json([
                'message' => 'Failed to fetch dashboard statistics'
            ], 500);
        }
    }

    /**
     * Get residents list for staff
     */
    public function residentsList(Request $request)
    {
        try {
            $user = $request->user();
            
            // Debug logging
            Log::info('StaffController@residentsList - User ID: ' . $user->id);
            
            // Get staff record
            $staff = Staff::where('user_id', $user->id)->first();
            
            if (!$staff) {
                Log::warning('StaffController@residentsList - Staff record not found for user ID: ' . $user->id);
                return response()->json([
                    'message' => 'Staff record not found'
                ], 404);
            }

            // Debug logging
            Log::info('StaffController@residentsList - Staff found: ' . $staff->id);
            Log::info('StaffController@residentsList - Staff module_permissions: ' . json_encode($staff->module_permissions));

            // Check if staff has residents permission
            $permissions = $staff->module_permissions ?? [];
            if (!isset($permissions['residentsRecords']) || !$permissions['residentsRecords']) {
                Log::warning('StaffController@residentsList - No residents permission. Permissions: ' . json_encode($permissions));
                return response()->json([
                    'message' => 'You do not have permission to access residents data',
                    'debug' => [
                        'permissions' => $permissions,
                        'has_residentsRecords_key' => isset($permissions['residentsRecords']),
                        'residentsRecords_value' => $permissions['residentsRecords'] ?? 'not_set'
                    ]
                ], 403);
            }

            // Get residents data (same as admin endpoint but with staff permission check)
            $residents = \App\Models\Resident::with(['profile', 'user'])
                ->orderBy('created_at', 'desc')
                ->get();

            Log::info('StaffController@residentsList - Residents query successful', [
                'count' => $residents->count()
            ]);

            $response = [
                'residents' => $residents,
                'message' => 'Residents data retrieved successfully'
            ];

            Log::info('StaffController@residentsList - Response prepared', [
                'response_keys' => array_keys($response),
                'residents_count' => count($response['residents']),
                'first_resident_keys' => $residents->first() ? array_keys($residents->first()->toArray()) : 'no_residents'
            ]);

            return response()->json($response);

        } catch (\Exception $e) {
            Log::error('Error fetching residents list for staff: ' . $e->getMessage());
            return response()->json([
                'message' => 'Failed to fetch residents data'
            ], 500);
        }
    }

    /**
     * Get document requests for staff
     */
    public function documentRequests(Request $request)
    {
        try {
            $user = $request->user();
            
            // Debug logging
            Log::info('StaffController@documentRequests - User ID: ' . $user->id);
            
            // Get staff record
            $staff = Staff::where('user_id', $user->id)->first();
            
            if (!$staff) {
                Log::warning('StaffController@documentRequests - Staff record not found for user ID: ' . $user->id);
                return response()->json([
                    'message' => 'Staff record not found'
                ], 404);
            }

            // Debug logging
            Log::info('StaffController@documentRequests - Staff found: ' . $staff->id);
            Log::info('StaffController@documentRequests - Staff module_permissions: ' . json_encode($staff->module_permissions));

            // Check if staff has documents permission - but allow access if no permissions are set (fallback for existing staff)
            $permissions = $staff->module_permissions ?? [];
            $hasDocumentsPermission = isset($permissions['documentsRecords']) && $permissions['documentsRecords'];
            $hasNoPermissionsSet = empty($permissions) || count(array_filter($permissions)) === 0;
            
            if (!$hasDocumentsPermission && !$hasNoPermissionsSet) {
                Log::warning('StaffController@documentRequests - No documents permission. Permissions: ' . json_encode($permissions));
                return response()->json([
                    'message' => 'You do not have permission to access document requests data',
                    'debug' => [
                        'permissions' => $permissions,
                        'has_documentsRecords_key' => isset($permissions['documentsRecords']),
                        'documentsRecords_value' => $permissions['documentsRecords'] ?? 'not_set'
                    ]
                ], 403);
            }

            // Get document requests data (same as admin endpoint but with staff permission check)
            $requests = \App\Models\DocumentRequest::with(['user:id,email'])
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
            
            Log::info('StaffController@documentRequests - Successfully fetched ' . $requests->count() . ' document requests');
            
            return response()->json($requests);
            
        } catch (\Exception $e) {
            Log::error('Error fetching document requests for staff: ' . $e->getMessage());
            return response()->json([
                'message' => 'Failed to fetch document requests data'
            ], 500);
        }
    }
}