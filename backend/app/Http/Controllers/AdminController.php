<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\User;
use App\Models\Resident;
use App\Models\DocumentRequest;
use App\Models\Household;
use App\Models\BlotterRecord;
use App\Models\BlotterRequest;
use App\Models\AssetRequest;
use App\Models\BarangayMember;
use App\Traits\ChecksStaffPermissions;

class AdminController extends Controller
{
    use ChecksStaffPermissions;
    /**
     * Admin Dashboard Overview with Real Statistics
     */
    public function index(Request $request)
    {
        $user = Auth::user();

        if (!$user) {
            return response()->json(['message' => 'Not authenticated'], 401);
        }

        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized, your role is ' . $user->role], 403);
        }

        try {
            // Get real statistics from the database
            $statistics = [
                'total_residents' => Resident::count(),
                // Completed documents are those that are approved AND paid (matching DocumentsRecords.jsx logic)
                'certificates_issued' => DocumentRequest::where('status', 'approved')
                    ->where('payment_status', 'paid')
                    ->count(),
                'pending_requests' => DocumentRequest::where('status', 'pending')->count() + 
                                   BlotterRequest::where('status', 'pending')->count() + 
                                   AssetRequest::where('status', 'pending')->count(),
                'household_records' => Household::count(),
                'blotter_reports' => BlotterRecord::count(),
                'barangay_officials' => BarangayMember::where('role', 'official')->count(),
                'barangay_staff' => BarangayMember::where('role', 'staff')->count(),
            ];

            return response()->json([
                'message' => 'Welcome, Admin!',
                'statistics' => $statistics,
                'current_user' => $user,
            ]);
        } catch (\Exception $e) {
            \Log::error('Error fetching dashboard statistics', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'message' => 'Error fetching dashboard data',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * 🧍‍♂️ Get all users (with 'residents' role) who have incomplete profiles
     */
    public function usersWithoutProfiles()
    {
        $users = User::where('role', 'residents')
            ->whereHas('profile', function($query) {
                $query->where('profile_completed', false)
                      ->orWhereNull('profile_completed');
            })
            ->select('id', 'name', 'email') // Only return minimal data needed for display
            ->orderBy('name') // Optional: Sort alphabetically
            ->get();

        \Log::info('Users with incomplete profiles found', [
            'count' => $users->count(),
            'users' => $users->pluck('email')->toArray()
        ]);

        return response()->json([
            'users' => $users,
        ]);
    }

    /**
     * 🧑‍🤝‍🧑 Get all users with 'residents' role
     * Accessible by: Admin users and Staff with residents permission
     */
    public function residents(Request $request)
    {
        \Log::info('AdminController::residents method called');
        
        try {
            // Check permission using trait
            $permissionCheck = $this->checkModulePermission($request, 'residentsRecords', 'residents');
            if ($permissionCheck !== null) {
                return $permissionCheck; // Return error response
            }
            
            // Get pagination parameters
            $perPage = $request->get('per_page', 50); // Default to 50 records per page
            $page = $request->get('page', 1);
            
            // Fetch residents users with optimized query and pagination
            $users = User::where('role', 'residents')
                ->with([
                    'profile:id,user_id,verification_status,residency_verification_image,current_photo', // Only load needed profile fields
                    'resident:id,user_id,first_name,last_name,middle_name,name_suffix,current_photo' // Only load needed resident fields
                ])
                ->select('id', 'name', 'email', 'created_at') // Only return needed data
                ->orderBy('name') // Sort alphabetically
                ->paginate($perPage, ['*'], 'page', $page);

            \Log::info('Found users with residents role', [
                'count' => $users->count(),
                'total' => $users->total(),
                'per_page' => $perPage,
                'current_page' => $page
            ]);

            return response()->json([
                'users' => $users->items(), // Return only the items, not the full pagination object
                'pagination' => [
                    'current_page' => $users->currentPage(),
                    'last_page' => $users->lastPage(),
                    'per_page' => $users->perPage(),
                    'total' => $users->total(),
                    'from' => $users->firstItem(),
                    'to' => $users->lastItem()
                ]
            ]);
        } catch (\Exception $e) {
            \Log::error('Error in AdminController::residents', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'error' => 'Failed to fetch residents users',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * 👨‍💼 Get all users with 'admin' role
     * Accessible by: Admin users only
     */
    public function admins(Request $request)
    {
        \Log::info('AdminController::admins method called');
        
        try {
            $user = Auth::user();
            
            if (!$user || $user->role !== 'admin') {
                return response()->json([
                    'message' => 'Unauthorized. Only admins can view admin users.'
                ], 403);
            }
            
            // Get pagination parameters
            $perPage = $request->get('per_page', 50);
            $page = $request->get('page', 1);
            
            // Fetch admin users
            $users = User::where('role', 'admin')
                ->select('id', 'name', 'email', 'created_at', 'active', 'status')
                ->orderBy('name')
                ->paginate($perPage, ['*'], 'page', $page);

            \Log::info('Found users with admin role', [
                'count' => $users->count(),
                'total' => $users->total(),
                'per_page' => $perPage,
                'current_page' => $page
            ]);

            return response()->json([
                'users' => $users->items(),
                'pagination' => [
                    'current_page' => $users->currentPage(),
                    'last_page' => $users->lastPage(),
                    'per_page' => $users->perPage(),
                    'total' => $users->total(),
                    'from' => $users->firstItem(),
                    'to' => $users->lastItem()
                ]
            ]);
        } catch (\Exception $e) {
            \Log::error('Error in AdminController::admins', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'error' => 'Failed to fetch admin users',
                'message' => $e->getMessage()
            ], 500);
        }
    }
}
