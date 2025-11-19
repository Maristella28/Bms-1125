<?php

namespace App\Http\Controllers;

// Configuration updated to use log mailer instead of SMTP

use App\Models\AssetRequest;
use App\Models\Asset;
use App\Models\FinancialRecord;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Notifications\AssetRequestNotification;
use App\Notifications\AssetPaymentNotification;
use App\Models\User;
use App\Traits\ChecksStaffPermissions;

class AssetRequestController extends Controller
{
    use ChecksStaffPermissions;
    /**
     * Generate custom request ID format: RAST12323250610138
     * R-Request, AST-AsSeT, 123-random 3digit, 23-minutes, 25-year, 06-day, 10-month, 138-last 3 digit of resident id
     */
    private function generateRequestId($residentId, $createdAt = null)
    {
        $date = $createdAt ? new \DateTime($createdAt) : new \DateTime();
        
        // Extract components
        $year = $date->format('y'); // Last 2 digits of year
        $month = $date->format('m'); // Month (01-12)
        $day = $date->format('d'); // Day (01-31)
        $minutes = $date->format('i'); // Minutes (00-59)
        
        // Generate random 3-digit number
        $randomNum = str_pad(rand(100, 999), 3, '0', STR_PAD_LEFT);
        
        // Get last 3 digits of resident ID
        $residentIdSuffix = str_pad(substr($residentId, -3), 3, '0', STR_PAD_LEFT);
        
        // Format: RAST + random + minutes + year + day + month + residentId
        return "RAST{$randomNum}{$minutes}{$year}{$day}{$month}{$residentIdSuffix}";
    }

    // List requests (admin: all, staff with inventory permissions: all, others: own)
    public function index(Request $request)
    {
        $user = Auth::user();
        $perPage = $request->get('per_page', 10);
        $page = $request->get('page', 1);
        
        // Check if user is admin or staff with inventory permissions
        $hasFullAccess = false;
        if ($user->role === 'admin') {
            $hasFullAccess = true;
        } elseif ($user->role === 'staff') {
            // Check if staff has inventory module permissions
            $staff = \App\Models\Staff::where('user_id', $user->id)->first();
            if ($staff && isset($staff->module_permissions['inventoryAssets']) && $staff->module_permissions['inventoryAssets']) {
                $hasFullAccess = true;
            }
        }
        
        if ($hasFullAccess) {
            $query = AssetRequest::with(['items.asset', 'user', 'resident']);
        } else {
            $query = AssetRequest::with(['items.asset', 'resident'])->where('user_id', $user->id);
        }
        
        // Apply pagination
        $paginatedRequests = $query->orderBy('created_at', 'desc')->paginate($perPage, ['*'], 'page', $page);
        
        // Transform the data for the frontend
        $requests = collect($paginatedRequests->items())->map(function ($req) {
            // Get all items for this request
            $items = $req->items->map(function ($item) {
                $remainingTime = $item->getRemainingRentalTime();
                return [
                    'id' => $item->id,
                    'asset' => $item->asset ? [
                        'id' => $item->asset->id,
                        'name' => $item->asset->name ?? '',
                        'price' => $item->asset->price ?? 0,
                        'category' => $item->asset->category ?? '',
                        'condition' => $item->asset->condition ?? '',
                    ] : null,
                    'request_date' => $item->request_date ?? '',
                    'quantity' => $item->quantity ?? 1,
                    'start_time' => $item->start_time ?? null,
                    'end_time' => $item->end_time ?? null,
                    'notes' => $item->notes ?? null,
                    'rental_duration_days' => $item->rental_duration_days ?? 1,
                    'return_date' => $item->return_date ?? null,
                    'is_returned' => $item->is_returned ?? false,
                    'returned_at' => $item->returned_at ?? null,
                    'remaining_rental_time' => $remainingTime,
                    'needs_return' => $item->needsReturn(),
                    // Add tracking information
                    'tracking_number' => $item->tracking_number ?? null,
                    'tracking_generated_at' => $item->tracking_generated_at ?? null,
                    'tracking_generated_by' => $item->tracking_generated_by ?? null,
                    'tracking_info' => $item->getTrackingInfo(),
                    // Add rating information
                    'rating' => $item->rating ?? null,
                ];
            });
            
            // Get the first item for backward compatibility
            $firstItem = $req->items->first();
            
            return [
                'id' => $req->id,
                'custom_request_id' => $req->custom_request_id,
                'resident' => $req->resident ? [
                    'id' => $req->resident->id,
                    'resident_id' => $req->resident->resident_id ?? '',
                    'profile' => $req->resident->profile ? [
                        'first_name' => $req->resident->profile->first_name ?? '',
                        'last_name' => $req->resident->profile->last_name ?? '',
                    ] : null,
                ] : null,
                'user' => $req->user ? [
                    'name' => $req->user->name ?? '',
                ] : null,
                // Keep the first asset for backward compatibility
                'asset' => $firstItem && $firstItem->asset ? [
                    'name' => $firstItem->asset->name ?? '',
                    'price' => $firstItem->asset->price ?? 0,
                ] : null,
                'request_date' => $firstItem ? $firstItem->request_date ?? '' : '',
                'status' => $req->status ?? '',
                'payment_status' => $req->payment_status ?? 'unpaid',
                'receipt_number' => $req->receipt_number ?? null,
                'amount_paid' => $req->amount_paid ?? null,
                'paid_at' => $req->paid_at ?? null,
                'total_amount' => $req->calculateTotalAmount(),
                // Add all items
                'items' => $items,
                'items_count' => $items->count(),
            ];
        });
        
        // Return paginated response
        return response()->json([
            'data' => $requests,
            'current_page' => $paginatedRequests->currentPage(),
            'last_page' => $paginatedRequests->lastPage(),
            'per_page' => $paginatedRequests->perPage(),
            'total' => $paginatedRequests->total(),
            'from' => $paginatedRequests->firstItem(),
            'to' => $paginatedRequests->lastItem(),
        ]);
    }

    // User requests an asset
    public function store(Request $request)
    {
        try {
            $validated = $request->validate([
                'items' => 'required|array|min:1',
                'items.*.asset_id' => 'required|exists:requestable_assets,id',
                'items.*.request_date' => 'required|date',
                'items.*.quantity' => 'required|integer|min:1',
            ]);
            $user = Auth::user();
            if (!$user) {
                return response()->json(['error' => 'Unauthorized'], 401);
            }
            $resident = \App\Models\Resident::where('user_id', $user->id)->first();
            if (!$resident) {
                return response()->json(['error' => 'Resident profile not found. Please complete your profile.'], 400);
            }
            $residentId = $resident->id;

            // Check stock for each item
            foreach ($validated['items'] as $item) {
                $asset = \App\Models\RequestableAsset::findOrFail($item['asset_id']);
                if ($asset->stock < $item['quantity']) {
                    return response()->json(['error' => "Asset '{$asset->name}' does not have enough stock."], 400);
                }
            }

            // Generate custom request ID
            $customRequestId = $this->generateRequestId($residentId);
            
            $assetRequest = AssetRequest::create([
                'user_id' => $user->id,
                'resident_id' => $residentId,
                'status' => 'pending',
                'payment_status' => 'unpaid',
                'custom_request_id' => $customRequestId,
            ]);

            foreach ($validated['items'] as $item) {
                $assetItem = \App\Models\AssetRequestItem::create([
                    'asset_request_id' => $assetRequest->id,
                    'asset_id' => $item['asset_id'],
                    'request_date' => $item['request_date'],
                    'quantity' => $item['quantity'],
                    'rental_duration_days' => $item['rental_duration_days'] ?? 1, // Default 1 day rental
                ]);
                
                // Calculate return date
                $assetItem->calculateReturnDate();
            }
            
            // Send single notification for the entire request
            $user->notify(new AssetRequestNotification($assetRequest, 'pending'));

            // Notify all admins
            $admins = \App\Models\User::where('role', 'admin')->get();
            foreach ($admins as $admin) {
                $admin->notify(new \App\Notifications\AdminAssetRequestNotification($user, $assetRequest));
            }

            return response()->json($assetRequest->load('items'), 201);
        } catch (\Exception $e) {
            \Log::error('Asset request error: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'Server error: ' . $e->getMessage()], 500);
        }
    }

    // Admin approves/denies a request
    public function update(Request $request, $id)
    {
        $validated = $request->validate([
            'status' => 'required|in:approved,denied',
            'admin_message' => 'nullable|string',
        ]);
        $assetRequest = AssetRequest::with('items.asset')->findOrFail($id);
        $assetRequest->status = $validated['status'];
        $assetRequest->admin_message = $validated['admin_message'] ?? null;
        $assetRequest->save();

        // If approved, decrement asset stock
        if ($validated['status'] === 'approved') {
            foreach ($assetRequest->items as $item) {
                $asset = \App\Models\RequestableAsset::find($item->asset_id);
                if ($asset && $asset->stock > 0) {
                    $asset->decrement('stock', $item->quantity);
                }
            }
        }

        // Notify the user about the status change
        $user = $assetRequest->user;
        if ($user) {
            // Send single notification for the entire request
            $user->notify(new \App\Notifications\AssetRequestNotification(
                $assetRequest,
                $assetRequest->status // 'approved' or 'denied'
            ));
        }

        return response()->json($assetRequest->load('items.asset'));
    }

    // Process payment for an asset request
    public function processPayment(Request $request, $id)
    {
        try {
            \Log::info('Processing payment for asset request', ['id' => $id]);
            
            $assetRequest = AssetRequest::with(['items.asset', 'user'])->findOrFail($id);
            
            // Check if request is approved
            if ($assetRequest->status !== 'approved') {
                \Log::warning('Payment attempted on non-approved request', ['id' => $id, 'status' => $assetRequest->status]);
                return response()->json(['error' => 'Only approved requests can be paid'], 400);
            }
            
            // Check if already paid
            if ($assetRequest->payment_status === 'paid') {
                \Log::warning('Payment attempted on already paid request', ['id' => $id]);
                return response()->json(['error' => 'This request has already been paid'], 400);
            }
            
            // Calculate total amount
            $totalAmount = $assetRequest->calculateTotalAmount();
            \Log::info('Calculated total amount', ['id' => $id, 'amount' => $totalAmount]);
            
            // Generate receipt number
            $receiptNumber = $assetRequest->generateReceiptNumber();
            \Log::info('Generated receipt number', ['id' => $id, 'receipt' => $receiptNumber]);
            
            // Update payment status
            $assetRequest->update([
                'payment_status' => 'paid',
                'receipt_number' => $receiptNumber,
                'amount_paid' => $totalAmount,
                'paid_at' => now(),
            ]);
            
            \Log::info('Payment status updated', ['id' => $id, 'payment_status' => 'paid']);
            
            // Reduce stock for each asset in the request
            foreach ($assetRequest->items as $item) {
                $asset = \App\Models\RequestableAsset::find($item->asset_id);
                if ($asset && $asset->stock >= $item->quantity) {
                    $asset->decrement('stock', $item->quantity);
                    \Log::info('Stock reduced for asset', [
                        'asset_id' => $asset->id,
                        'asset_name' => $asset->name,
                        'quantity_requested' => $item->quantity,
                        'remaining_stock' => $asset->fresh()->stock
                    ]);
                } else {
                    \Log::warning('Insufficient stock for asset', [
                        'asset_id' => $asset->id ?? 'unknown',
                        'asset_name' => $asset->name ?? 'unknown',
                        'quantity_requested' => $item->quantity,
                        'available_stock' => $asset->stock ?? 0
                    ]);
                }
            }
            
            // Send notification to user
            if ($assetRequest->user) {
                try {
                    $assetRequest->user->notify(new AssetPaymentNotification($assetRequest, $receiptNumber, $totalAmount));
                    \Log::info('Payment notification sent', ['id' => $id, 'user_id' => $assetRequest->user->id]);
                } catch (\Exception $e) {
                    \Log::error('Failed to send payment notification', ['id' => $id, 'error' => $e->getMessage()]);
                    // Don't fail the payment if notification fails
                }
            }
            
            // Create financial record for this payment
            try {
                $residentName = $assetRequest->resident && $assetRequest->resident->profile 
                    ? ($assetRequest->resident->profile->first_name . ' ' . $assetRequest->resident->profile->last_name)
                    : ($assetRequest->user ? $assetRequest->user->name : 'Unknown');
                
                FinancialRecord::create([
                    'date' => now()->toDateString(),
                    'type' => 'Income',
                    'category' => 'Asset Rental',
                    'amount' => $totalAmount,
                    'description' => "Asset rental payment - Receipt: {$receiptNumber} - Resident: {$residentName}",
                    'reference' => $receiptNumber,
                    'approved_by' => Auth::user()->name ?? 'Admin',
                    'status' => 'Completed',
                ]);
                \Log::info('Financial record created for asset payment', ['receipt' => $receiptNumber, 'amount' => $totalAmount]);
            } catch (\Exception $e) {
                \Log::error('Failed to create financial record for asset payment', [
                    'id' => $id,
                    'error' => $e->getMessage()
                ]);
                // Don't fail the payment if financial record creation fails
            }
            
            return response()->json([
                'message' => 'Payment processed successfully',
                'receipt_number' => $receiptNumber,
                'amount_paid' => $totalAmount,
                'asset_request' => $assetRequest->load('items.asset')
            ]);
            
        } catch (\Exception $e) {
            \Log::error('Payment processing error: ' . $e->getMessage(), [
                'id' => $id,
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json(['error' => 'Server error: ' . $e->getMessage()], 500);
        }
    }

    public function show($id)
    {
        $user = auth()->user();
        $assetRequest = AssetRequest::with(['asset', 'resident', 'user'])->find($id);

        if (!$assetRequest) {
            return response()->json(['error' => 'Asset request not found'], 404);
        }

        // Optionally, restrict access to only admins or the owner
        if ($user->role !== 'admin' && $assetRequest->user_id !== $user->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        return response()->json($assetRequest);
    }

    public function destroy($id)
    {
        $request = AssetRequest::findOrFail($id);
        $request->delete();
        return response()->json(['message' => 'Request deleted']);
    }

    // Generate PDF receipt for an asset request
    public function generateReceipt(Request $request)
    {
        try {
            $validated = $request->validate([
                'asset_request_id' => 'required|exists:asset_requests,id',
                'receipt_number' => 'required|string',
                'amount_paid' => 'required|numeric|min:0',
            ]);

            // Load the asset request with related data
            $assetRequest = AssetRequest::with(['items.asset', 'resident', 'user'])->findOrFail($validated['asset_request_id']);

            // Check if request is paid
            if ($assetRequest->payment_status !== 'paid') {
                return response()->json(['error' => 'Only paid requests can generate receipts'], 400);
            }

            // Generate PDF using the blade template
            $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('receipts.asset-rental-receipt', [
                'assetRequest' => $assetRequest,
                'receiptNumber' => $validated['receipt_number'],
                'amountPaid' => $validated['amount_paid'],
            ]);

            // Generate PDF content and convert to base64
            $pdfContent = $pdf->output();
            $base64Content = base64_encode($pdfContent);
            $filename = 'receipt-' . $validated['receipt_number'] . '.pdf';

            // Return PDF data as JSON with base64 content
            return response()->json([
                'success' => true,
                'filename' => $filename,
                'pdf_data' => $base64Content,
                'message' => 'Receipt generated successfully'
            ]);
        } catch (\Exception $e) {
            \Log::error('Receipt generation error: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json(['error' => 'Failed to generate receipt: ' . $e->getMessage()], 500);
        }
    }

    // Cancel asset request (within 24 hours)
    public function cancelRequest(Request $request, $id)
    {
        try {
            $user = Auth::user();
            $assetRequest = AssetRequest::findOrFail($id);

            // Check if request belongs to the authenticated user
            if ($assetRequest->user_id !== $user->id) {
                return response()->json(['error' => 'Unauthorized to cancel this request'], 403);
            }

            // Check if request can be cancelled (pending or approved)
            if (!in_array($assetRequest->status, ['pending', 'approved'])) {
                return response()->json(['error' => 'Only pending or approved requests can be cancelled'], 400);
            }

            // Check if request is within 24 hours
            $createdAt = $assetRequest->created_at;
            $twentyFourHoursAgo = now()->subHours(24);
            
            if ($createdAt->lt($twentyFourHoursAgo)) {
                return response()->json(['error' => 'Request can only be cancelled within 24 hours of submission'], 400);
            }

            // If request was approved, restore stock
            if ($assetRequest->status === 'approved') {
                foreach ($assetRequest->items as $item) {
                    $asset = \App\Models\RequestableAsset::find($item->asset_id);
                    if ($asset) {
                        $asset->increment('stock', $item->quantity);
                        \Log::info('Restored stock for cancelled approved request', [
                            'asset_id' => $asset->id,
                            'asset_name' => $asset->name,
                            'restored_quantity' => $item->quantity,
                            'new_stock' => $asset->stock
                        ]);
                    }
                }
            }

            // Update request status to cancelled
            $assetRequest->update([
                'status' => 'cancelled',
                'admin_message' => 'Cancelled by user within 24 hours'
            ]);

            // Send notification to user
            $user->notify(new \App\Notifications\AssetRequestNotification(
                $assetRequest,
                'cancelled'
            ));

            \Log::info('Asset request cancelled by user', [
                'request_id' => $id,
                'user_id' => $user->id,
                'cancelled_at' => now()
            ]);

            return response()->json([
                'message' => 'Request cancelled successfully',
                'asset_request' => $assetRequest->load('items.asset')
            ]);

        } catch (\Exception $e) {
            \Log::error('Error cancelling asset request: ' . $e->getMessage(), [
                'request_id' => $id,
                'user_id' => $user->id ?? 'unknown',
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json(['error' => 'Failed to cancel request: ' . $e->getMessage()], 500);
        }
    }
    
    // Mark asset as returned
    public function markAsReturned(Request $request, $id)
    {
        try {
            $user = Auth::user();
            $assetRequest = AssetRequest::with(['items.asset'])->findOrFail($id);

            // Check if request belongs to the authenticated user
            if ($assetRequest->user_id !== $user->id) {
                return response()->json(['error' => 'Unauthorized to return this asset'], 403);
            }

            // Check if request is paid
            if ($assetRequest->payment_status !== 'paid') {
                return response()->json(['error' => 'Only paid requests can be returned'], 400);
            }

            // Mark all items as returned
            foreach ($assetRequest->items as $item) {
                $item->markAsReturned();
            }

            // Restore stock for each asset
            foreach ($assetRequest->items as $item) {
                $asset = \App\Models\RequestableAsset::find($item->asset_id);
                if ($asset) {
                    $asset->increment('stock', $item->quantity);
                    \Log::info('Stock restored for returned asset', [
                        'asset_id' => $asset->id,
                        'asset_name' => $asset->name,
                        'restored_quantity' => $item->quantity,
                        'new_stock' => $asset->stock
                    ]);
                }
            }

            \Log::info('Asset request marked as returned', [
                'request_id' => $id,
                'user_id' => $user->id,
                'returned_at' => now()
            ]);

            return response()->json([
                'message' => 'Asset returned successfully',
                'asset_request' => $assetRequest->load('items.asset')
            ]);

        } catch (\Exception $e) {
            \Log::error('Error marking asset as returned: ' . $e->getMessage(), [
                'request_id' => $id,
                'user_id' => $user->id ?? 'unknown',
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json(['error' => 'Failed to mark asset as returned: ' . $e->getMessage()], 500);
        }
    }

    // Get status counts for dashboard
    public function getStatusCounts()
    {
        $user = Auth::user();
        \Log::info('getStatusCounts called', ['user' => $user]);

        // Check if user is admin or staff with inventory permissions
        $hasFullAccess = false;
        if ($user->role === 'admin') {
            $hasFullAccess = true;
        } elseif ($user->role === 'staff') {
            // Check if staff has inventory module permissions
            $staff = \App\Models\Staff::where('user_id', $user->id)->first();
            if ($staff && isset($staff->module_permissions['inventoryAssets']) && $staff->module_permissions['inventoryAssets']) {
                $hasFullAccess = true;
            }
        }

        if ($hasFullAccess) {
            $query = AssetRequest::query();
        } else {
            $query = AssetRequest::where('user_id', $user->id);
        }

        $counts = [
            'approved' => (clone $query)->where('status', 'approved')->count(),
            'pending' => (clone $query)->where('status', 'pending')->count(),
            'denied' => (clone $query)->where('status', 'denied')->count(),
            'paid' => (clone $query)->where('payment_status', 'paid')->count(),
            'total' => $query->count(),
        ];

        \Log::info('Status counts:', $counts);
        return response()->json($counts);
    }

    /**
     * Generate tracking number for asset request item
     */
    public function generateTrackingNumber(Request $request, $id)
    {
        try {
            $user = Auth::user();
            
            // Find the asset request item
            $assetRequestItem = \App\Models\AssetRequestItem::with(['request', 'asset'])
                ->where('id', $id)
                ->first();

            if (!$assetRequestItem) {
                return response()->json(['error' => 'Asset request item not found'], 404);
            }

            // Check if user has permission (admin or owner of the request)
            if ($user->role !== 'admin' && $assetRequestItem->request->user_id !== $user->id) {
                return response()->json(['error' => 'Unauthorized'], 403);
            }

            // Check if request is paid
            if ($assetRequestItem->request->payment_status !== 'paid') {
                return response()->json(['error' => 'Tracking number can only be generated for paid requests'], 400);
            }

            // Update return date if provided (allow editing even if tracking number exists)
            if ($request->has('return_date') && $request->return_date) {
                // Parse the ISO datetime string and convert to Asia/Manila timezone
                $returnDate = \Carbon\Carbon::parse($request->return_date)
                    ->setTimezone('Asia/Manila');
                
                // Calculate rental duration days based on request_date and return_date
                $requestDate = \Carbon\Carbon::parse($assetRequestItem->request_date);
                $rentalDurationDays = $requestDate->diffInDays($returnDate);
                
                // Ensure minimum of 1 day
                if ($rentalDurationDays < 1) {
                    $rentalDurationDays = 1;
                }
                
                $assetRequestItem->update([
                    'return_date' => $returnDate,
                    'rental_duration_days' => $rentalDurationDays
                ]);
                
                \Log::info('Return date and rental duration updated', [
                    'asset_request_item_id' => $id,
                    'original_return_date' => $request->return_date,
                    'parsed_return_date' => $returnDate->toDateTimeString(),
                    'request_date' => $assetRequestItem->request_date,
                    'calculated_rental_duration_days' => $rentalDurationDays,
                    'timezone' => $returnDate->timezoneName,
                    'user_id' => $user->id,
                    'tracking_exists' => $assetRequestItem->hasTrackingNumber()
                ]);
            }

            // Check if tracking number already exists
            if ($assetRequestItem->hasTrackingNumber()) {
                // Return existing tracking number with updated info
                return response()->json([
                    'message' => 'Tracking number updated successfully',
                    'tracking_number' => $assetRequestItem->tracking_number,
                    'tracking_info' => $assetRequestItem->getTrackingInfo(),
                    'asset_request_item' => $assetRequestItem->fresh(['request', 'asset'])
                ], 200);
            }

            // Generate tracking number (only if it doesn't exist)
            $trackingNumber = $assetRequestItem->generateTrackingNumber($user->name);

            return response()->json([
                'message' => 'Tracking number generated successfully',
                'tracking_number' => $trackingNumber,
                'tracking_info' => $assetRequestItem->getTrackingInfo(),
                'asset_request_item' => $assetRequestItem->fresh(['request', 'asset'])
            ], 200);

        } catch (\Exception $e) {
            \Log::error('Error generating tracking number: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to generate tracking number'], 500);
        }
    }

    /**
     * Get tracking information for asset request item
     */
    public function getTrackingInfo($id)
    {
        try {
            $user = Auth::user();
            
            // Find the asset request item
            $assetRequestItem = \App\Models\AssetRequestItem::with(['request', 'asset'])
                ->where('id', $id)
                ->first();

            if (!$assetRequestItem) {
                return response()->json(['error' => 'Asset request item not found'], 404);
            }

            // Check if user has permission (admin or owner of the request)
            if ($user->role !== 'admin' && $assetRequestItem->request->user_id !== $user->id) {
                return response()->json(['error' => 'Unauthorized'], 403);
            }

            return response()->json([
                'tracking_info' => $assetRequestItem->getTrackingInfo(),
                'asset_request_item' => $assetRequestItem
            ], 200);

        } catch (\Exception $e) {
            \Log::error('Error getting tracking info: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to get tracking information'], 500);
        }
    }

    /**
     * Rate an asset request item
     */
    public function rateAsset(Request $request, $id)
    {
        try {
            $user = Auth::user();
            
            // Find the asset request item
            $assetRequestItem = \App\Models\AssetRequestItem::with(['request', 'asset'])
                ->where('id', $id)
                ->first();

            if (!$assetRequestItem) {
                return response()->json(['error' => 'Asset request item not found'], 404);
            }

            // Check if user has permission (admin or owner of the request)
            if ($user->role !== 'admin' && $assetRequestItem->request->user_id !== $user->id) {
                return response()->json(['error' => 'Unauthorized'], 403);
            }

            // Validate rating
            $validated = $request->validate([
                'rating' => 'required|integer|min:1|max:5'
            ]);

            // Update the rating
            $assetRequestItem->update([
                'rating' => $validated['rating']
            ]);

            \Log::info('Asset rated', [
                'asset_request_item_id' => $id,
                'rating' => $validated['rating'],
                'user_id' => $user->id
            ]);

            return response()->json([
                'message' => 'Rating submitted successfully',
                'rating' => $validated['rating'],
                'asset_request_item' => $assetRequestItem->fresh(['request', 'asset'])
            ], 200);

        } catch (\Exception $e) {
            \Log::error('Error rating asset: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to submit rating'], 500);
        }
    }
}