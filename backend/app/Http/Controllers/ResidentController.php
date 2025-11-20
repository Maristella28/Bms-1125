<?php

namespace App\Http\Controllers;

use App\Models\Resident;
use App\Models\Profile;
use App\Services\ActivityLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use App\Traits\ChecksStaffPermissions;

class ResidentController extends Controller
{
    use ChecksStaffPermissions;
    // 🧾 Store a new profile and resident
    public function store(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            // Profile fields
            'residents_id'       => 'required|string|unique:profiles,residents_id',
            'first_name'         => 'required|string',
            'middle_name'        => 'nullable|string',
            'last_name'          => 'required|string',
            'name_suffix'        => 'nullable|string',
            'birth_date'         => 'required|date',
            'birth_place'        => 'required|string',
            'age'                => 'required|integer',
            'nationality'        => 'nullable|string',
            'email'              => 'required|email',
            'mobile_number'     => 'required|string',
            'sex'                => 'required|string',
            'civil_status'       => 'required|string',
            'religion'           => 'required|string',
            'current_address'       => 'required|string',
            'years_in_barangay'  => 'required|integer',
            'voter_status'       => 'required|string',
            'avatar'             => 'nullable|image|mimes:jpg,jpeg,png|max:2048',

            // Resident fields
            'household_no'       => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $data = $validator->validated();

        if (Profile::where('user_id', $user->id)->exists()) {
            return response()->json(['message' => 'Profile already exists.'], 409);
        }

        // ✅ Correct avatar upload logic
        if ($request->hasFile('avatar')) {
            $data['avatar'] = $request->file('avatar')->store('avatars', 'public');
        }

        $profile = Profile::create([
            ...$data,
            'user_id' => $user->id,
            'avatar'  => $data['avatar'] ?? null,
        ]);

        $resident = Resident::create([
            ...$data,
            'user_id'    => $user->id,
            'profile_id' => $profile->id,
            'residents_id' => $profile->residents_id,
            'avatar'     => $data['avatar'] ?? null,
        ]);

        // Log resident creation
        ActivityLogService::logCreated($resident, $request);
        ActivityLogService::logCreated($profile, $request);

        return response()->json([
            'message'  => '✅ Profile and Resident successfully saved.',
            'profile'  => $profile,
            'resident' => $resident,
        ], 201);
    }

    // Search residents
    public function search(Request $request)
    {
        try {
            $searchTerm = $request->get('search');
            
            if (empty($searchTerm)) {
                return response()->json([]);
            }

            $residents = Profile::join('residents', 'profiles.id', '=', 'residents.profile_id')
            ->select(
                'profiles.id',
                'residents.resident_id',
                'profiles.first_name',
                'profiles.last_name',
                'profiles.email',
                'profiles.mobile_number as contact_number',
                'profiles.birth_date as birthdate',
                'profiles.sex as gender',
                'profiles.civil_status',
                'profiles.current_address as address'
            )
            ->where(function ($query) use ($searchTerm) {
                $query->where('profiles.first_name', 'like', '%' . $searchTerm . '%')
                      ->orWhere('profiles.last_name', 'like', '%' . $searchTerm . '%')
                      ->orWhere('residents.resident_id', 'like', '%' . $searchTerm . '%')
                      ->orWhere('profiles.email', 'like', '%' . $searchTerm . '%')
                      ->orWhere('profiles.mobile_number', 'like', '%' . $searchTerm . '%');
            })
            ->take(10)
            ->get()
            ->map(function ($resident) {
                return [
                    'id' => $resident->id,  // Keep the profile id as the unique identifier
                    'resident_id' => $resident->resident_id,  // The resident ID from residents table
                    'first_name' => $resident->first_name,
                    'last_name' => $resident->last_name,
                    'name' => trim($resident->first_name . ' ' . $resident->last_name),
                    'email' => $resident->email,
                    'contact_number' => $resident->contact_number,
                    'address' => $resident->address,
                    'birthdate' => $resident->birthdate,
                    'gender' => strtolower($resident->gender),
                    'civil_status' => strtolower($resident->civil_status)
                ];
            });

            return response()->json($residents);
            
        } catch (\Exception $e) {
            \Log::error('Resident search error: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to search residents'], 500);
        }
    }

    // �📄 Get all residents with profiles
    public function index()
    {
        \Log::info('Admin is fetching residents list');
        
        try {
            $residents = Resident::with(['profile', 'user'])->get();
            $now = \Carbon\Carbon::now();

            $processedResidents = $residents->map(function ($resident) use ($now) {
                $lastUpdated = $resident->getAttribute('updated_at');
                $months = $lastUpdated ? $now->diffInMonths($lastUpdated) : null;

                // Compute update status
                if ($months === null) {
                    $updateStatus = 'Needs Verification';
                } elseif ($months < 6) {
                    $updateStatus = 'Active';
                } elseif ($months < 12) {
                    $updateStatus = 'Outdated';
                } else {
                    $updateStatus = 'Needs Verification';
                }

                // Merge profile data into resident
                $profileData = $resident->profile ? $resident->profile->toArray() : [];
                $residentData = $resident->toArray();

                // Ensure resident ID is preserved (profile might have its own id)
                $mergedData = array_merge($residentData, $profileData, [
                    'update_status' => $updateStatus,
                    'for_review' => (bool) $resident->for_review, // Use actual database value
                    'last_modified' => $resident->last_modified ?? $resident->updated_at,
                ]);
                
                // Always preserve the resident's primary key id
                $mergedData['id'] = $resident->id;
                
                return $mergedData;
            });

            \Log::info('Found residents', ['count' => $processedResidents->count()]);
            
            return response()->json([
                'success' => true,
                'count' => $processedResidents->count(),
                'residents' => $processedResidents
            ]);
        } catch (\Exception $e) {
            \Log::error('Error fetching residents: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error fetching residents',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // 👤 Get current user's resident profile
    public function myProfile(Request $request)
    {
        $user = $request->user();
        
        $resident = Resident::where('user_id', $user->id)->first();
        
        if (!$resident) {
            return response()->json([
                'message' => 'Resident profile not found. Please complete your profile first.'
            ], 404);
        }
        
        return response()->json($resident);
    }

    // ✏️ Update existing resident and profile
    public function update(Request $request, $id)
    {
        $resident = Resident::findOrFail($id);
        $profile = $resident->profile;

        $validator = Validator::make($request->all(), [
            'first_name'         => 'required|string',
            'middle_name'        => 'nullable|string',
            'last_name'          => 'required|string',
            'name_suffix'        => 'nullable|string',
            'birth_date'         => 'required|date',
            'birth_place'        => 'required|string',
            'age'                => 'required|integer',
            'nationality'        => 'nullable|string',
            'email'              => 'required|email',
            'mobile_number'     => 'required|string',
            'sex'                => 'required|string',
            'civil_status'       => 'required|string',
            'religion'           => 'required|string',
            'current_address'       => 'required|string',
            'years_in_barangay'  => 'required|integer',
            'voter_status'       => 'required|string',
            'household_no'       => 'required|string',
            'avatar'             => 'nullable|image|mimes:jpg,jpeg,png|max:2048',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $data = $validator->validated();

        // ✅ Correct avatar upload logic
        if ($request->hasFile('avatar')) {
            // Optionally delete the old avatar file
            if ($profile->avatar) {
                Storage::disk('public')->delete($profile->avatar);
            }
            $data['avatar'] = $request->file('avatar')->store('avatars', 'public');
            $profile->avatar = $data['avatar'];
            // @phpcs:ignore
            $resident->avatar = $data['avatar'];
        }

        // Fill and save other data
        $profile->fill($data)->save();
        $resident->fill($data);
        $resident->last_modified = now(); // Set last modified timestamp
        $resident->save();

        // Log resident update
        ActivityLogService::logUpdated($resident, $resident->getOriginal(), $request);
        ActivityLogService::logUpdated($profile, $profile->getOriginal(), $request);

        // Check if resident should be flagged for review
        $this->checkAndFlagForReview($resident);

        return response()->json([
            'message'  => '✅ Resident and profile updated successfully.',
            'resident' => $resident,
            'profile'  => $profile,
        ]);
    }

    // 📊 Get residents with filtering and sorting for reporting
    public function report(Request $request)
    {
        \Log::info('Report endpoint called', ['request' => $request->all()]);
        \Log::info('Authenticated user:', ['user' => $request->user() ? $request->user()->id : null]);
        
        // Log all residents in database for debugging
        $allResidents = Resident::all();
        \Log::info('All residents in database', [
            'count' => $allResidents->count(),
            'residents' => $allResidents->pluck('id', 'last_modified')
        ]);
        
        $query = Resident::with('profile', 'user');

        // Filter by update status
        if ($request->has('update_status')) {
            $status = $request->input('update_status');
            $now = now();
            
            switch ($status) {
                case 'active':
                    $query->where('last_modified', '>=', $now->copy()->subMonths(6));
                    break;
                case 'outdated':
                    $query->whereBetween('last_modified', [
                        $now->copy()->subMonths(12),
                        $now->copy()->subMonths(6)
                    ]);
                    break;
                case 'needs_verification':
                    $query->where(function($q) use ($now) {
                        $q->whereNull('last_modified')
                         ->orWhere('last_modified', '<', $now->copy()->subMonths(12));
                    });
                    break;
                case 'for_review':
                    $query->where('for_review', true);
                    break;
            }
        }

        // Filter by verification status
        if ($request->has('verification_status')) {
            $query->where('verification_status', $request->input('verification_status'));
        }

        // Sort options
        $sortBy = $request->input('sort_by', 'last_modified');
        $sortOrder = $request->input('sort_order', 'desc');
        
        $validSortFields = ['last_modified', 'created_at', 'first_name', 'last_name', 'verification_status'];
        if (in_array($sortBy, $validSortFields)) {
            $query->orderBy($sortBy, $sortOrder);
        }

        $residents = $query->get();
        
        // Calculate update status for each resident (same logic as index method)
        $now = now();
        $residents = $residents->map(function ($resident) use ($now) {
            $lastUpdated = $resident->last_modified;
            $months = $lastUpdated ? $now->diffInMonths($lastUpdated) : null;
            if ($months === null) {
                $updateStatus = 'Needs Verification';
            } elseif ($months < 6) {
                $updateStatus = 'Active';
            } elseif ($months < 12) {
                $updateStatus = 'Outdated';
            } else {
                $updateStatus = 'Needs Verification';
            }
            $resident->update_status = $updateStatus;
            $resident->for_review = $months !== null && $months >= 12;
            return $resident;
        });
        
        \Log::info('Filtered residents', [
            'count' => $residents->count(),
            'residents' => $residents->pluck('id')
        ]);

        // Check if any residents were found
        if ($residents->isEmpty()) {
            \Log::warning('No residents found in report query');
            return response()->json([
                'message' => 'No residents found matching the criteria',
                'residents' => [],
                'filters' => $request->all(),
                'total_count' => Resident::count()
            ], 200);
        }

        return response()->json([
            'residents' => $residents,
            'filters' => $request->all(),
            'total_count' => Resident::count()
        ]);
    }

    /**
     * Analytics: return pre-aggregated buckets for residents
     */
    public function analytics(Request $request)
    {
        // Optional params: year, month for scoping registrations
        $year = $request->input('year');
        $month = $request->input('month'); // 1-12

        // Base query
        $query = Resident::query();
        if ($year && is_numeric($year)) {
            $query->whereYear('created_at', (int)$year);
            if ($month && is_numeric($month) && (int)$month >= 1 && (int)$month <= 12) {
                $query->whereMonth('created_at', (int)$month);
            }
        }

        $residents = $query->with('profile')->get();

        $normalize = function ($val) {
            if ($val === null) return 'Unknown';
            $s = is_string($val) ? trim($val) : (string)$val;
            if ($s === '') return 'Unknown';
            return ucfirst(strtolower($s));
        };

        $getAgeGroup = function ($age) {
            if ($age === null || !is_numeric($age)) return 'Unknown';
            $a = (int)$age;
            if ($a < 5) return 'Under 5 years old';
            if ($a < 10) return '5-9 years old';
            if ($a < 15) return '10-14 years old';
            if ($a < 20) return '15-19 years old';
            if ($a < 25) return '20-24 years old';
            if ($a < 30) return '25-29 years old';
            if ($a < 35) return '30-34 years old';
            if ($a < 40) return '35-39 years old';
            if ($a < 45) return '40-44 years old';
            if ($a < 50) return '45-49 years old';
            if ($a < 55) return '50-54 years old';
            if ($a < 60) return '55-59 years old';
            if ($a < 65) return '60-64 years old';
            if ($a < 70) return '65-69 years old';
            if ($a < 75) return '70-74 years old';
            if ($a < 80) return '75-79 years old';
            return '80 years old and over';
        };

        $getSector = function ($resident) {
            $age = (int)($resident->age ?? 0);
            $occupation = strtolower((string)($resident->occupation_type ?? ''));
            $educational = strtolower((string)($resident->educational_attainment ?? ''));

            if ($age >= 18 && $age <= 65 && $occupation && !in_array($occupation, ['none','unemployed'])) {
                return 'Labor Force';
            }
            if ($age >= 18 && $age <= 65 && (!$occupation || in_array($occupation, ['none','unemployed']))) {
                return 'Unemployed';
            }
            if ($age >= 15 && $age <= 24 && (!$educational || in_array($educational, ['none','elementary']))) {
                return 'Out-of-School Youth (OSY)';
            }
            if ($age >= 6 && $age <= 14) {
                return 'Out-of-School Children (OSC)';
            }
            $cats = $resident->special_categories ?? [];
            if (is_array($cats)) {
                foreach ($cats as $c) {
                    $lc = strtolower((string)$c);
                    if (str_contains($lc, 'pwd') || str_contains($lc, 'disability')) return 'Persons with Disabilities (PDWs)';
                    if (str_contains($lc, 'ofw') || str_contains($lc, 'overseas')) return 'Overseas Filipino Workers (OFWs)';
                }
            }
            return 'Other';
        };

        $summary = [
            'total' => $residents->count(),
            'verification' => [
                'approved' => 0,
                'pending' => 0,
                'denied' => 0,
            ],
            'updateStatus' => [
                'Active' => 0,
                'Outdated' => 0,
                'Needs Verification' => 0,
            ],
            'gender' => [],
            'civilStatus' => [],
            'ageGroups' => [],
            'sectors' => [],
            'missingCritical' => 0,
            'duplicates' => [
                'emails' => [],
                'resident_ids' => []
            ],
            'monthlyRegistrations' => []
        ];

        // Monthly registrations for last 12 months (or scoped by year)
        $monthlyQuery = Resident::query();
        if ($year && is_numeric($year)) {
            $monthlyQuery->whereYear('created_at', (int)$year);
        } else {
            $from = now()->copy()->subMonths(11)->startOfMonth();
            $monthlyQuery->where('created_at', '>=', $from);
        }
        $monthly = $monthlyQuery
            ->select(DB::raw('DATE_FORMAT(created_at, "%Y-%m") as ym'), DB::raw('COUNT(*) as cnt'))
            ->groupBy('ym')
            ->orderBy('ym')
            ->get();
        $summary['monthlyRegistrations'] = $monthly->map(fn($r) => ['month' => $r->ym, 'count' => (int)$r->cnt])->values();

        // Duplicate detection: emails and resident_id across profiles/residents
        $dupEmails = Profile::select('email', DB::raw('COUNT(*) as cnt'))
            ->whereNotNull('email')
            ->groupBy('email')
            ->havingRaw('COUNT(*) > 1')
            ->pluck('email');
        $dupResidentIds = Resident::select('resident_id', DB::raw('COUNT(*) as cnt'))
            ->whereNotNull('resident_id')
            ->groupBy('resident_id')
            ->havingRaw('COUNT(*) > 1')
            ->pluck('resident_id');
        $summary['duplicates']['emails'] = $dupEmails;
        $summary['duplicates']['resident_ids'] = $dupResidentIds;

        // Aggregations over collection
        foreach ($residents as $resident) {
            $gender = $normalize($resident->sex ?? ($resident->profile->sex ?? null));
            $summary['gender'][$gender] = ($summary['gender'][$gender] ?? 0) + 1;

            $civil = $normalize($resident->civil_status ?? ($resident->profile->civil_status ?? null));
            $summary['civilStatus'][$civil] = ($summary['civilStatus'][$civil] ?? 0) + 1;

            $ageGroup = $getAgeGroup($resident->age ?? ($resident->profile->age ?? null));
            $summary['ageGroups'][$ageGroup] = ($summary['ageGroups'][$ageGroup] ?? 0) + 1;

            $sector = $getSector($resident);
            $summary['sectors'][$sector] = ($summary['sectors'][$sector] ?? 0) + 1;

            $ver = $normalize($resident->verification_status ?? 'pending');
            if (!in_array($ver, ['Approved', 'Denied', 'Pending'])) { $ver = 'Pending'; }
            $summary['verification'][strtolower($ver)] = ($summary['verification'][strtolower($ver)] ?? 0) + 1;

            // Update status
            $last = $resident->last_modified ?? $resident->updated_at;
            $months = $last ? now()->diffInMonths($last) : null;
            $status = 'Needs Verification';
            if ($months !== null) {
                if ($months < 6) $status = 'Active';
                elseif ($months < 12) $status = 'Outdated';
            }
            $summary['updateStatus'][$status] = ($summary['updateStatus'][$status] ?? 0) + 1;

            // Missing critical fields (first_name, last_name, birth_date, sex, current_address)
            $first = $resident->first_name ?? $resident->profile->first_name ?? null;
            $lastn = $resident->last_name ?? $resident->profile->last_name ?? null;
            $bdate = $resident->birth_date ?? $resident->profile->birth_date ?? null;
            $sex = $resident->sex ?? $resident->profile->sex ?? null;
            $addr = $resident->current_address ?? $resident->profile->current_address ?? null;
            if (!$first || !$lastn || !$bdate || !$sex || !$addr) {
                $summary['missingCritical']++;
            }
        }

        // Add cross-tab analysis
        $summary['crossTab'] = $this->getCrossTabAnalysis($residents);
        
        // Add trend analysis
        $summary['trends'] = $this->getTrendAnalysis($residents);

        return response()->json([
            'success' => true,
            'summary' => $summary,
        ]);
    }

    // Cross-tab analysis for demographics
    private function getCrossTabAnalysis($residents)
    {
        $genderCivilData = [];
        $ageSectorData = [];
        
        foreach ($residents as $resident) {
            $gender = $resident->sex ?? ($resident->profile->sex ?? 'Unknown');
            $civilStatus = $resident->civil_status ?? ($resident->profile->civil_status ?? 'Unknown');
            $age = (int)($resident->age ?? ($resident->profile->age ?? 0));
            $sector = $this->getSector($resident);
            
            // Gender × Civil Status
            if (!isset($genderCivilData[$gender])) {
                $genderCivilData[$gender] = [];
            }
            $genderCivilData[$gender][$civilStatus] = ($genderCivilData[$gender][$civilStatus] ?? 0) + 1;
            
            // Age × Sector
            $ageGroup = $this->getAgeGroup($age);
            if (!isset($ageSectorData[$ageGroup])) {
                $ageSectorData[$ageGroup] = [];
            }
            $ageSectorData[$ageGroup][$sector] = ($ageSectorData[$ageGroup][$sector] ?? 0) + 1;
        }
        
        return [
            'genderCivil' => $genderCivilData,
            'ageSector' => $ageSectorData
        ];
    }

    // Trend analysis for KPIs
    private function getTrendAnalysis($residents)
    {
        $now = now();
        $lastMonth = $now->copy()->subMonth();
        $lastYear = $now->copy()->subYear();
        
        // Current counts
        $currentTotal = $residents->count();
        $currentActive = $residents->filter(function($resident) {
            $lastUpdate = $resident->last_modified ?? $resident->updated_at;
            return $lastUpdate && $lastUpdate->diffInMonths(now()) <= 6;
        })->count();
        
        // Previous month counts
        $lastMonthResidents = Resident::where('created_at', '<=', $lastMonth)->get();
        $lastMonthTotal = $lastMonthResidents->count();
        $lastMonthActive = $lastMonthResidents->filter(function($resident) use ($lastMonth) {
            $lastUpdate = $resident->last_modified ?? $resident->updated_at;
            return $lastUpdate && $lastUpdate->diffInMonths($lastMonth) <= 6;
        })->count();
        
        // Previous year counts
        $lastYearResidents = Resident::where('created_at', '<=', $lastYear)->get();
        $lastYearTotal = $lastYearResidents->count();
        $lastYearActive = $lastYearResidents->filter(function($resident) use ($lastYear) {
            $lastUpdate = $resident->last_modified ?? $resident->updated_at;
            return $lastUpdate && $lastUpdate->diffInMonths($lastYear) <= 6;
        })->count();
        
        return [
            'total' => [
                'current' => $currentTotal,
                'monthlyChange' => $this->calculatePercentageChange($currentTotal, $lastMonthTotal),
                'yearlyChange' => $this->calculatePercentageChange($currentTotal, $lastYearTotal)
            ],
            'active' => [
                'current' => $currentActive,
                'monthlyChange' => $this->calculatePercentageChange($currentActive, $lastMonthActive),
                'yearlyChange' => $this->calculatePercentageChange($currentActive, $lastYearActive)
            ]
        ];
    }

    // Helper method to calculate percentage change
    private function calculatePercentageChange($current, $previous)
    {
        if ($previous == 0) return $current > 0 ? 100 : 0;
        return round((($current - $previous) / $previous) * 100, 1);
    }

    // Helper method to get age group
    private function getAgeGroup($age)
    {
        if ($age === null || !is_numeric($age)) return 'Unknown';
        $a = (int)$age;
        if ($a < 5) return 'Under 5 years old';
        if ($a < 10) return '5-9 years old';
        if ($a < 15) return '10-14 years old';
        if ($a < 20) return '15-19 years old';
        if ($a < 25) return '20-24 years old';
        if ($a < 30) return '25-29 years old';
        if ($a < 35) return '30-34 years old';
        if ($a < 40) return '35-39 years old';
        if ($a < 45) return '40-44 years old';
        if ($a < 50) return '45-49 years old';
        if ($a < 55) return '50-54 years old';
        if ($a < 60) return '55-59 years old';
        if ($a < 65) return '60-64 years old';
        if ($a < 70) return '65-69 years old';
        if ($a < 75) return '70-74 years old';
        if ($a < 80) return '75-79 years old';
        return '80 years old and over';
    }

    // Helper method to get sector
    private function getSector($resident)
    {
        $age = (int)($resident->age ?? 0);
        $occupation = strtolower((string)($resident->occupation_type ?? ''));
        $educational = strtolower((string)($resident->educational_attainment ?? ''));

        if ($age >= 18 && $age <= 65 && $occupation && !in_array($occupation, ['none','unemployed'])) {
            return 'Labor Force';
        }
        if ($age >= 18 && $age <= 65 && (!$occupation || in_array($occupation, ['none','unemployed']))) {
            return 'Unemployed';
        }
        if ($age >= 15 && $age <= 24 && (!$educational || in_array($educational, ['none','elementary']))) {
            return 'Out-of-School Youth (OSY)';
        }
        if ($age >= 6 && $age <= 14) {
            return 'Out-of-School Children (OSC)';
        }
        $cats = $resident->special_categories ?? [];
        if (is_array($cats)) {
            foreach ($cats as $c) {
                $lc = strtolower((string)$c);
                if (str_contains($lc, 'pwd') || str_contains($lc, 'disability')) return 'Persons with Disabilities (PDWs)';
                if (str_contains($lc, 'ofw') || str_contains($lc, 'overseas')) return 'Overseas Filipino Workers (OFWs)';
            }
        }
        return 'Other';
    }

    // 🔄 Check and flag resident for review based on activity
    private function checkAndFlagForReview(Resident $resident)
    {
        $now = now();
        $lastModified = $resident->getAttribute('last_modified');
        $lastLogin = ($resident->user && $resident->user->getAttribute('has_logged_in'))
            ? $resident->user->getAttribute('updated_at')
            : null;

        // If no activity in the last year, flag for review
        $lastActivity = $lastModified && $lastLogin ? max($lastModified, $lastLogin) : ($lastModified ?? $lastLogin);
        
        if (!$lastActivity || $lastActivity->diffInMonths($now) >= 12) {
            $resident->setAttribute('for_review', true);
        } else {
            $resident->setAttribute('for_review', false);
        }
        
        $resident->save();
    }

    // 🔄 Batch update to check all residents for review status
    public function batchCheckReviewStatus()
    {
        $residents = Resident::with('user')->get();
        $updatedCount = 0;

        // Debug: Check if for_review column exists
        // @phpcs:ignore
        $hasForReviewColumn = \Illuminate\Support\Facades\Schema::hasColumn('residents', 'for_review');
        $hasLastModifiedColumn = \Illuminate\Support\Facades\Schema::hasColumn('residents', 'last_modified');
        \Log::info('Column existence check', [
            'for_review_exists' => $hasForReviewColumn,
            'last_modified_exists' => $hasLastModifiedColumn
        ]);

        foreach ($residents as $resident) {
            // Preserve original value using accessor
            $originalStatus = $resident->getAttribute('for_review');
            $this->checkAndFlagForReview($resident);

            // Compare using accessor to avoid magic property access
            if ($resident->getAttribute('for_review') !== $originalStatus) {
                $updatedCount++;
            }
        }

        return response()->json([
            'message' => "Review status checked for {$residents->count()} residents. {$updatedCount} records updated."
        ]);
    }

    /**
     * Soft delete a resident
     * Accessible by: Admin users and Staff with residents permission
     *
     * @param \Illuminate\Http\Request $request
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroy(Request $request, $id)
    {
        try {
            // Check permission using trait
            $permissionCheck = $this->checkModulePermission($request, 'residentsRecords', 'residents');
            if ($permissionCheck !== null) {
                return $permissionCheck; // Return error response
            }

            // Cast ID to integer to ensure proper type
            $residentId = (int) $id;
            
            // Log the ID being received
            \Log::info('Attempting to delete resident', [
                'original_id' => $id,
                'original_id_type' => gettype($id),
                'casted_id' => $residentId,
                'user_id' => $request->user()?->id
            ]);

            // Try to find the resident (including soft deleted ones to check)
            $resident = Resident::withTrashed()->find($residentId);
            
            // If not found by primary key, try by resident_id string field
            if (!$resident) {
                \Log::warning('Resident not found by primary key, trying by resident_id field', [
                    'searched_id' => $residentId,
                    'string_id' => (string) $id
                ]);
                $resident = Resident::withTrashed()->where('resident_id', (string) $id)->first();
            }
            
            if (!$resident) {
                \Log::error('Resident not found for deletion', [
                    'original_id' => $id,
                    'casted_id' => $residentId,
                ]);
                
                return response()->json([
                    'message' => 'Resident not found.',
                    'error' => 'Resident with ID ' . $id . ' does not exist.'
                ], 404);
            }
            
            // Check if resident is already deleted
            if ($resident->trashed()) {
                return response()->json([
                    'message' => 'Resident is already disabled.',
                ], 400);
            }
            
            // Get disable reason from request
            $disableReason = $request->input('reason', null);
            
            // Validate disable reason if provided
            if ($disableReason && !in_array($disableReason, ['relocated', 'deceased', 'pending_issue'])) {
                return response()->json([
                    'message' => 'Invalid disable reason. Must be one of: relocated, deceased, pending_issue',
                ], 422);
            }
            
            // Store disable reason before soft delete
            if ($disableReason) {
                $resident->disable_reason = $disableReason;
                $resident->save();
            }
            
            // Perform soft delete first (faster operation)
            $resident->delete();
            
            // If resident has an associated profile, soft delete that too
            if ($resident->profile && !$resident->profile->trashed()) {
                $resident->profile->delete();
            }
            
            // Log the deletion asynchronously (don't block the response)
            try {
                ActivityLogService::logDeleted($resident, $request);
            } catch (\Exception $logError) {
                // Don't fail the deletion if logging fails
                \Log::warning('Failed to log resident deletion', [
                    'resident_id' => $resident->id,
                    'error' => $logError->getMessage()
                ]);
            }

            return response()->json([
                'success' => true,
                'message' => 'Resident has been moved to Recently Deleted.',
                'resident_id' => $resident->id
            ], 200);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            \Log::error('Resident not found for deletion', [
                'id' => $id,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'message' => 'Resident not found.',
                'error' => 'Resident with ID ' . $id . ' does not exist.'
            ], 404);
        } catch (\Exception $e) {
            \Log::error('Failed to delete resident', [
                'id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'message' => 'Failed to delete resident.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get all soft deleted residents
     * Accessible by: Admin users and Staff with residents permission
     *
     * @param \Illuminate\Http\Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function trashed(Request $request)
    {
        try {
            // Check permission using trait
            $permissionCheck = $this->checkModulePermission($request, 'residentsRecords', 'residents');
            if ($permissionCheck !== null) {
                return $permissionCheck; // Return error response
            }
            
            // Fetch soft deleted residents with all necessary relationships
            $deletedResidents = Resident::onlyTrashed()
                ->with(['profile' => function($query) {
                    $query->withTrashed();
                }, 'user'])
                ->get()
                ->map(function ($resident) {
                    // Map the data to match frontend expectations
                    return [
                        'id' => $resident->id,
                        'user_id' => $resident->user_id,
                        'profile_id' => $resident->profile_id,
                        'residents_id' => $resident->profile->residents_id ?? $resident->resident_id ?? null,
                        'first_name' => $resident->first_name,
                        'middle_name' => $resident->middle_name,
                        'last_name' => $resident->last_name,
                        'name_suffix' => $resident->name_suffix ?? $resident->suffix ?? null,
                        'suffix' => $resident->name_suffix ?? $resident->suffix ?? null,
                        'age' => $resident->age,
                        'nationality' => $resident->nationality,
                        'sex' => $resident->sex,
                        'civil_status' => $resident->civil_status,
                        'voter_status' => $resident->voter_status,
                        'voters_id_number' => $resident->voters_id_number ?? $resident->voters_id ?? null,
                        'avatar' => $resident->profile->avatar ?? $resident->current_photo ?? null,
                        'current_photo' => $resident->current_photo,
                        'disable_reason' => $resident->disable_reason,
                        'deleted_at' => $resident->deleted_at,
                        'created_at' => $resident->created_at,
                        'updated_at' => $resident->updated_at,
                    ];
                });

            return response()->json([
                'success' => true,
                'residents' => $deletedResidents,
                'message' => 'Successfully retrieved deleted residents'
            ]);

        } catch (\Exception $e) {
            \Log::error('Failed to fetch deleted residents', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'message' => 'Failed to fetch deleted residents.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get all residents flagged for review
     * 
     * Returns residents that have been automatically or manually flagged
     * for review due to inactivity (no update/login for 1 year)
     */
    public function flaggedForReview(Request $request)
    {
        try {
            // Check permission using trait
            $permissionCheck = $this->checkModulePermission($request, 'residentsRecords', 'residents');
            if ($permissionCheck !== null) {
                return $permissionCheck;
            }

            $residents = Resident::with(['user', 'profile'])
                ->where('for_review', true)
                ->get();

            $now = now();
            $processedResidents = $residents->map(function ($resident) use ($now) {
                // Calculate inactivity period
                $lastActivity = $resident->last_modified ?? $resident->user->last_activity_at ?? null;
                $inactiveDays = $lastActivity ? $now->diffInDays($lastActivity) : null;
                $inactiveMonths = $lastActivity ? $now->diffInMonths($lastActivity) : null;

                return [
                    'id' => $resident->id,
                    'user_id' => $resident->user_id,
                    'resident_id' => $resident->resident_id,
                    'first_name' => $resident->first_name,
                    'middle_name' => $resident->middle_name,
                    'last_name' => $resident->last_name,
                    'full_name' => trim("{$resident->first_name} {$resident->middle_name} {$resident->last_name}"),
                    'email' => $resident->email,
                    'contact_number' => $resident->contact_number,
                    'current_address' => $resident->current_address,
                    'for_review' => $resident->for_review,
                    'last_modified' => $resident->last_modified,
                    'last_activity_at' => $resident->user->last_activity_at ?? null,
                    'inactive_days' => $inactiveDays,
                    'inactive_months' => $inactiveMonths,
                    'residency_status' => $resident->user->residency_status ?? 'unknown',
                    'status_notes' => $resident->user->status_notes ?? null,
                    'verification_status' => $resident->verification_status,
                    'created_at' => $resident->created_at,
                    'updated_at' => $resident->updated_at,
                ];
            });

            return response()->json([
                'success' => true,
                'count' => $processedResidents->count(),
                'residents' => $processedResidents,
            ]);

        } catch (\Exception $e) {
            \Log::error('Error fetching flagged residents: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error fetching flagged residents',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get statistics for review flagging system
     */
    public function reviewStatistics(Request $request)
    {
        try {
            // Check permission
            $permissionCheck = $this->checkModulePermission($request, 'residentsRecords', 'residents');
            if ($permissionCheck !== null) {
                return $permissionCheck;
            }

            $totalResidents = Resident::count();
            $flaggedCount = Resident::where('for_review', true)->count();
            $activeCount = Resident::where('for_review', false)->count();

            // Count by inactivity period
            $now = now();
            $oneYearAgo = $now->copy()->subYear();
            $twoYearsAgo = $now->copy()->subYears(2);

            $inactiveOneYear = Resident::with('user')
                ->get()
                ->filter(function ($resident) use ($oneYearAgo, $twoYearsAgo) {
                    $lastActivity = $resident->last_modified ?? $resident->user->last_activity_at ?? null;
                    return $lastActivity && $lastActivity->between($twoYearsAgo, $oneYearAgo);
                })
                ->count();

            $inactiveTwoYears = Resident::with('user')
                ->get()
                ->filter(function ($resident) use ($twoYearsAgo) {
                    $lastActivity = $resident->last_modified ?? $resident->user->last_activity_at ?? null;
                    return $lastActivity && $lastActivity->lessThan($twoYearsAgo);
                })
                ->count();

            $neverActive = Resident::with('user')
                ->get()
                ->filter(function ($resident) {
                    $lastActivity = $resident->last_modified ?? $resident->user->last_activity_at ?? null;
                    return !$lastActivity;
                })
                ->count();

            return response()->json([
                'success' => true,
                'statistics' => [
                    'total_residents' => $totalResidents,
                    'flagged_for_review' => $flaggedCount,
                    'active_residents' => $activeCount,
                    'inactive_1_to_2_years' => $inactiveOneYear,
                    'inactive_over_2_years' => $inactiveTwoYears,
                    'never_active' => $neverActive,
                    'flagged_percentage' => $totalResidents > 0 
                        ? round(($flaggedCount / $totalResidents) * 100, 2) 
                        : 0,
                ],
            ]);

        } catch (\Exception $e) {
            \Log::error('Error fetching review statistics: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error fetching review statistics',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Manually flag or unflag a resident for review
     */
    public function toggleReviewFlag(Request $request, $id)
    {
        try {
            // Check permission
            $permissionCheck = $this->checkModulePermission($request, 'residentsRecords', 'residents');
            if ($permissionCheck !== null) {
                return $permissionCheck;
            }

            $request->validate([
                'for_review' => 'required|boolean',
                'notes' => 'nullable|string|max:500',
            ]);

            $resident = Resident::with('user')->findOrFail($id);
            $oldStatus = $resident->for_review;
            $resident->for_review = $request->for_review;
            $resident->save();

            // Update user residency status if needed
            if ($resident->user) {
                $newResidencyStatus = $request->for_review ? 'for_review' : 'active';
                $resident->user->updateResidencyStatus(
                    $newResidencyStatus,
                    $request->notes ?? 'Manually updated by admin',
                    $request->user()->id
                );
            }

            // Log the activity
            \App\Services\ActivityLogService::log(
                'resident_review_flag_toggle',
                $resident,
                ['for_review' => $oldStatus],
                ['for_review' => $request->for_review],
                "Resident {$resident->first_name} {$resident->last_name} " . 
                ($request->for_review ? 'flagged for review' : 'unflagged from review')
            );

            return response()->json([
                'success' => true,
                'message' => $request->for_review 
                    ? 'Resident flagged for review successfully' 
                    : 'Resident unflagged from review successfully',
                'resident' => $resident->fresh(['user', 'profile']),
            ]);

        } catch (\Exception $e) {
            \Log::error('Error toggling review flag: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error updating review flag',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Bulk flag residents for review
     */
    public function bulkFlagForReview(Request $request)
    {
        try {
            // Check permission
            $permissionCheck = $this->checkModulePermission($request, 'residentsRecords', 'residents');
            if ($permissionCheck !== null) {
                return $permissionCheck;
            }

            $request->validate([
                'resident_ids' => 'required|array',
                'resident_ids.*' => 'exists:residents,id',
                'for_review' => 'required|boolean',
                'notes' => 'nullable|string|max:500',
            ]);

            $residents = Resident::with('user')->whereIn('id', $request->resident_ids)->get();
            $updatedCount = 0;

            foreach ($residents as $resident) {
                $resident->for_review = $request->for_review;
                $resident->save();

                // Update user residency status
                if ($resident->user) {
                    $newResidencyStatus = $request->for_review ? 'for_review' : 'active';
                    $resident->user->updateResidencyStatus(
                        $newResidencyStatus,
                        $request->notes ?? 'Bulk updated by admin',
                        $request->user()->id
                    );
                }

                $updatedCount++;
            }

            return response()->json([
                'success' => true,
                'message' => "Successfully updated {$updatedCount} residents",
                'updated_count' => $updatedCount,
            ]);

        } catch (\Exception $e) {
            \Log::error('Error bulk flagging residents: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error bulk updating residents',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
