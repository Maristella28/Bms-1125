import React, { useState, useEffect, startTransition } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from "../contexts/AuthContext";
import { usePermissions } from "../hooks/usePermissions";
import { useAdminSidebar } from '../contexts/AdminSidebarContext';
import axiosInstance from '../utils/axiosConfig';

/**
 * Real-time Notification Badge Update System
 * 
 * To trigger immediate badge updates from other components, dispatch a custom event:
 * 
 * Example usage:
 * ```javascript
 * // After approving a document
 * window.dispatchEvent(new CustomEvent('document:approved'));
 * 
 * // After rejecting a document
 * window.dispatchEvent(new CustomEvent('document:rejected'));
 * 
 * // After a new document request
 * window.dispatchEvent(new CustomEvent('document:requested'));
 * 
 * // After verification status change
 * window.dispatchEvent(new CustomEvent('verification:updated'));
 * 
 * // After blotter update
 * window.dispatchEvent(new CustomEvent('blotter:updated'));
 * 
 * // After asset update
 * window.dispatchEvent(new CustomEvent('asset:updated'));
 * 
 * // Generic notification update
 * window.dispatchEvent(new CustomEvent('notification:update'));
 * ```
 * 
 * All badges update simultaneously when any of these events are triggered.
 */
import {
  LayoutDashboard, Users, FileText, Home, Book,
  DollarSign, UserCog, Megaphone, Handshake, AlertTriangle,
  Boxes, Projector, Activity, ChevronDown, ChevronRight, Server
} from 'lucide-react';

const Sidebar = ({ permissions: propPermissions = {} }) => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { hasModuleAccess, hasSubModuleAccess } = usePermissions();
  const { isCollapsed, isMobileOpen, closeMobileSidebar } = useAdminSidebar();
  
  // Combine prop permissions with user permissions, preferring user permissions
  const permissions = React.useMemo(() => {
    const combined = {
      ...propPermissions,
      ...user?.module_permissions,
      ...user?.permissions
    };
    // Reduced logging to prevent console spam
    // console.log('Sidebar permissions:', {
    //   propPermissions,
    //   module_permissions: user?.module_permissions,
    //   user_permissions: user?.permissions,
    //   combined,
    //   user_role: user?.role
    // });
    return combined;
  }, [propPermissions, user?.module_permissions, user?.permissions]);

  const iconSize = 18;

  const userRole = user?.role || localStorage.getItem('role');

  // Single source of truth for all menu items
  // Resident-specific menu items
  const residentMenuItems = [
    { 
      title: "Request Documents",
      icon: <FileText size={iconSize} />,
      path: `/${userRole}/requestDocuments`,
      module: "resident_docs"
    },
    {
      title: "Request Assets",
      icon: <Boxes size={iconSize} />,
      path: `/${userRole}/requestAssets`,
      module: "resident_assets"
    },
    {
      title: "Report Incident",
      icon: <Book size={iconSize} />,
      path: `/${userRole}/generateBlotter`,
      module: "resident_blotter"
    },
    {
      title: "Document Status",
      icon: <Activity size={iconSize} />,
      path: `/${userRole}/statusDocumentRequests`,
      module: "resident_status"
    }
  ];

  const allMenuItems = [
    { 
      title: "Dashboard", 
      icon: <LayoutDashboard size={iconSize} />, 
      path: `/${userRole}/dashboard`,
      module: "dashboard"
    },
    { 
      title: "Residents Records", 
      icon: <Users size={iconSize} />, 
      path: `/${userRole}/residentsRecords`,
      module: "residents",
      subItems: [
        { 
          title: "Resident Records", 
          path: `/${userRole}/residentsRecords?showRecords=true`,
          module: "residents",
          subModule: "main_records"
        },
        { 
          title: "Verification", 
          path: `/${userRole}/residentsRecords?section=verification`,
          module: "residents",
          subModule: "verification"
        },
        { 
          title: "Disabled Residents", 
          path: `/${userRole}/residentsRecords?section=disabled`,
          module: "residents",
          subModule: "disabled_residents"
        }
      ]
    },
    { 
      title: "Document Records", 
      icon: <FileText size={iconSize} />, 
      path: `/${userRole}/documentsRecords`,
      module: "documents",
      subItems: [
        { 
          title: "Document Requests", 
          path: `/${userRole}/documentsRecords?tab=requests`,
          module: "documents",
          subModule: "document_requests"
        },
        { 
          title: "Document Records", 
          path: `/${userRole}/documentsRecords?tab=records`,
          module: "documents",
          subModule: "document_records"
        }
      ]
    },
    { 
      title: "Household Records", 
      icon: <Home size={iconSize} />, 
      path: `/${userRole}/householdRecords`,
      module: "household"
    },
    { 
      title: "Blotter Records", 
      icon: <Book size={iconSize} />, 
      path: `/${userRole}/blotterRecords`,
      module: "blotter"
    },
    { 
      title: "Financial Management", 
      icon: <DollarSign size={iconSize} />, 
      path: `/${userRole}/financialTracking`,
      module: "treasurer"
    },
    { 
      title: "Barangay Officials", 
      icon: <UserCog size={iconSize} />, 
      path: `/${userRole}/barangayOfficials`,
      module: "officials"
    },
    { 
      title: "Staff Management", 
      icon: <Users size={iconSize} />, 
      path: `/${userRole}/staff`,
      module: "staff"
    },
    { 
      title: "Communication", 
      icon: <Megaphone size={iconSize} />, 
      path: `/${userRole}/communicationAnnouncement`,
      module: "communication"
    },
    { 
      title: "Social Services", 
      icon: <Handshake size={iconSize} />, 
      path: `/${userRole}/socialServices`,
      module: "social_services",
      subItems: [
        { 
          title: "Programs", 
          path: `/${userRole}/socialServices?section=programs`,
          module: "social_services",
          subModule: "programs"
        },
        { 
          title: "Beneficiaries", 
          path: `/${userRole}/socialServices?section=beneficiaries`,
          module: "social_services",
          subModule: "beneficiaries"
        }
      ]
    },
    { 
      title: "Disaster Response", 
      icon: <AlertTriangle size={iconSize} />, 
      path: `/${userRole}/disasterEmergency`,
      module: "command_center"
    },
    { 
      title: "Projects", 
      icon: <Projector size={iconSize} />, 
      path: `/${userRole}/projectManagement`,
      module: "projects"
    },
    { 
      title: "Inventory", 
      icon: <Boxes size={iconSize} />, 
      path: `/${userRole}/inventoryAssets`,
      module: "inventory",
      subItems: [
        { 
          title: "Asset Management", 
          path: `/${userRole}/assets-management`,
          module: "inventory",
          subModule: "asset_management"
        },
        { 
          title: "Asset Posts Management", 
          path: `/${userRole}/assets-post-management`,
          module: "inventory",
          subModule: "asset_posts_management"
        },
        { 
          title: "Asset Tracking", 
          path: `/${userRole}/inventoryAssets?tab=tracking`,
          module: "inventory",
          subModule: "asset_tracking"
        }
      ]
    },
    { 
      title: "Activity Logs", 
      icon: <Activity size={iconSize} />, 
      path: `/${userRole}/activityLogs`,
      module: "logs"
    },
    { 
      title: "Backup Management", 
      icon: <Server size={iconSize} />, 
      path: `/${userRole}/backup`,
      module: "backup"
    }
  ];

  // Function to get the base path based on user role
  const getBasePath = (role) => {
    switch (role) {
      case 'admin': return '/admin';
      case 'staff': return '/staff';
      case 'treasurer': return '/treasurer';
      case 'resident': return '/resident';
      default: return '';
    }
  };

  // State for expanded menu items
  const [expandedItems, setExpandedItems] = React.useState(new Set());
  
  // State for notification counts
  const [notificationCounts, setNotificationCounts] = useState({});
  
  // Helper function to extract array from various response structures
  const extractArrayFromResponse = (data, possibleKeys = []) => {
    if (Array.isArray(data)) {
      return data;
    }
    if (data?.data && Array.isArray(data.data)) {
      return data.data;
    }
    // Try common keys
    for (const key of possibleKeys) {
      if (data?.[key] && Array.isArray(data[key])) {
        return data[key];
      }
    }
    return [];
  };
  
  // Helper function to count pending items
  const countPendingItems = (items) => {
    if (!Array.isArray(items)) return 0;
    return items.filter(item => {
      if (typeof item !== 'object' || item === null) return false;
      const status = item.status;
      return status === 'pending';
    }).length;
  };
  
  // Helper function to count pending document requests (new requests needing approval)
  // This is better for notification badges - shows actionable items that need immediate attention
  const countPendingDocumentRequests = (items) => {
    if (!Array.isArray(items)) return 0;
    return items.filter(item => {
      if (typeof item !== 'object' || item === null) return false;
      // Count only pending requests - these are new requests that need immediate attention
      // This is better for notification badges than showing all non-paid requests
      const status = (item.status?.toLowerCase() || '').trim();
      return status === 'pending';
    }).length;
  };
  
  // Helper function to count non-paid document requests (all requests in workflow)
  // Used for reference/debugging - shows all requests that haven't been paid yet
  const countNonPaidDocumentRequests = (items) => {
    if (!Array.isArray(items)) return 0;
    return items.filter(item => {
      if (typeof item !== 'object' || item === null) return false;
      const paymentStatus = item.payment_status || item.paymentStatus;
      return paymentStatus !== 'paid';
    }).length;
  };
  
  // Fetch notification counts for menu items - Optimized for fast loading
  useEffect(() => {
    const fetchNotificationCounts = async () => {
      if (!user || user?.role === 'resident') return;
      
      // Initialize counts object
      const counts = {
        'residents': {
          'verification': 0,
          'main': 0
        },
        'documents': 0,
        'documents_requests': 0,
        'blotter': 0,
        'inventory': 0,
      };
      
      // Step 1: Try to load cached counts from localStorage for INSTANT display
      try {
        const cachedCounts = localStorage.getItem('notification_counts');
        const cacheTime = localStorage.getItem('notification_counts_time');
        if (cachedCounts && cacheTime) {
          const age = Date.now() - parseInt(cacheTime);
          // Use cached data if less than 60 seconds old for instant display
          if (age < 60000) {
            const parsed = JSON.parse(cachedCounts);
            // Use startTransition for smooth instant display
            startTransition(() => {
              setNotificationCounts(parsed);
            });
            // Continue to fetch fresh data in background (don't return)
          }
        }
      } catch (err) {
        // Ignore cache errors, continue with fresh fetch
      }
      
      // Step 2: Fetch dashboard stats with reasonable timeout
      // Only fetch if user has dashboard access (admin always has access)
      // For staff, check actual permissions from backend (not fallback)
      // Don't await - start all fetches in parallel immediately
      // NOTE: We don't update state here to prevent partial updates - wait for all data
      const hasDashboardAccess = user?.role === 'admin' || 
        (user?.role === 'staff' && 
         user?.module_permissions && 
         Object.keys(user.module_permissions).length > 1 && // More than just fallback dashboard
         (user.module_permissions.dashboard === true || user.permissions?.dashboard === true));
      
      // Use role-appropriate endpoint: admin uses /admin/dashboard, staff uses /staff/dashboard
      const dashboardEndpoint = user?.role === 'admin' ? '/admin/dashboard' : '/staff/dashboard';
      
      const dashboardPromise = hasDashboardAccess
        ? axiosInstance.get(dashboardEndpoint, {
        timeout: 20000 // 20 second timeout - increased to handle slow database queries
      }).then(response => {
        const stats = response.data?.statistics || response.data || {};
        
        // Use dashboard stats for estimated counts (but don't update state yet)
        if (stats.pending_requests) {
          const estimatedDocRequests = Math.max(0, Math.floor(stats.pending_requests * 0.6));
          counts.documents = estimatedDocRequests;
          counts.documents_requests = estimatedDocRequests;
        }
        
        return stats;
      }).catch(err => {
        // Silently fail timeout errors - don't spam console
        if (err.code !== 'ECONNABORTED') {
          console.error('Error fetching dashboard stats:', err);
        }
        // Silently fail - we'll use detailed counts instead
        return null;
      }).catch(() => null) : Promise.resolve(null);
      
      // Step 3: Fetch all detailed counts in parallel for accuracy (with timeouts)
      // Only fetch counts for modules the user has access to
      const fetchPromises = [
        // Fetch pending document requests count (ONLY new requests needing approval)
        // Only fetch if user has documents module access
        // Use role-appropriate endpoint: admin uses /admin/document-requests, staff uses /staff/document-requests
        (user?.role === 'admin' || hasModuleAccess('documents'))
        ? (() => {
            const documentEndpoint = user?.role === 'admin' ? '/admin/document-requests' : '/staff/document-requests';
            return axiosInstance.get(documentEndpoint, {
              timeout: 15000 // 15 second timeout - increased for slow backend
            }).then(response => {
              const requests = extractArrayFromResponse(response.data, ['document_requests']);
              // Count ONLY pending requests - these are new requests needing approval
              // This matches the requirement: "Only new requests needing approval in notification badges"
              const pendingDocRequests = countPendingDocumentRequests(requests);
              
              // Debug log in development
              if (process.env.NODE_ENV === 'development') {
                const statusCounts = requests.reduce((acc, r) => {
                  const status = (r.status?.toLowerCase() || 'unknown').trim();
                  acc[status] = (acc[status] || 0) + 1;
                  return acc;
                }, {});
                const nonPaidCount = countNonPaidDocumentRequests(requests);
                console.log('📄 Document Requests Count:', {
                  total: requests.length,
                  pending: pendingDocRequests, // What badge shows (actionable items)
                  nonPaid: nonPaidCount, // What tab shows (all in workflow)
                  paid: requests.filter(r => (r.payment_status || r.paymentStatus) === 'paid').length,
                  statusBreakdown: statusCounts
                });
              }
              
              return { type: 'documents', count: pendingDocRequests };
            }).catch(err => {
              // Silently fail - don't spam console with timeout errors
              if (err.code !== 'ECONNABORTED') {
                console.error('Error fetching document requests count:', err);
              }
              return null;
            }).catch(() => null);
          })() : Promise.resolve(null),
        
        // Fetch pending verification count (matches ResidentsVerificationTable.jsx logic)
        // Only fetch if user has residents module access
        // IMPORTANT: This counts ONLY pending verifications that need admin action
        // Uses the same getVerificationStatus logic as ResidentsVerificationTable
        (user?.role === 'admin' || hasModuleAccess('residents'))
        ? axiosInstance.get('/admin/residents-users', {
          timeout: 20000, // 20 second timeout - increased for slow backend
          params: {
            per_page: 100, // Request more records for accurate count
            page: 1
          }
        }).then(response => {
          // Handle both old and new API response formats (matches ResidentsVerificationTable)
          const users = response.data?.users || response.data || [];
          
          // Use the same verification status logic as ResidentsVerificationTable
          // Priority: profile.verification_status > resident.verification_status > 'pending'
          const pendingVerifications = users.filter(user => {
            if (!user) return false;
            // Match the exact logic from ResidentsVerificationTable.getVerificationStatus()
            const status = user.profile?.verification_status || 
                          user.resident?.verification_status || 
                          'pending';
            // Only count pending verifications (those needing admin action)
            return status === 'pending';
          }).length;
          
          // Debug log in development
          if (process.env.NODE_ENV === 'development') {
            const statusCounts = users.reduce((acc, user) => {
              const status = user.profile?.verification_status || 
                           user.resident?.verification_status || 
                           'pending';
              acc[status] = (acc[status] || 0) + 1;
              return acc;
            }, {});
            console.log('👥 Residents Verification Count:', {
              total: users.length,
              pending: pendingVerifications, // What badge shows (actionable items)
              statusBreakdown: statusCounts
            });
          }
          
          return { type: 'verification', count: pendingVerifications };
        }).catch(err => {
          // Silently fail timeout errors - don't spam console
          if (err.code !== 'ECONNABORTED') {
            console.error('Error fetching verification count:', err);
          }
          // Don't fail silently - return 0 count on error
          return { type: 'verification', count: 0 };
        }).catch(() => null) : Promise.resolve(null),
        
        // Fetch pending blotter requests count
        // Only fetch if user has blotter module access
        // For staff, try to access /admin/blotter-requests (may fail if route is admin-only)
        // For admin, use /admin/blotter-requests
        (user?.role === 'admin' || (user?.role === 'staff' && hasModuleAccess('blotter')))
        ? axiosInstance.get('/admin/blotter-requests', {
          timeout: 15000 // 15 second timeout - increased for slow backend
        }).then(response => {
          const blotterRequests = extractArrayFromResponse(response.data, ['blotter_requests']);
          const pendingBlotter = countPendingItems(blotterRequests);
          return { type: 'blotter', count: pendingBlotter };
        }).catch(err => {
          // Silently fail timeout errors and 403 errors for staff (route may be admin-only)
          if (err.code !== 'ECONNABORTED' && err.response?.status !== 403) {
            console.error('Error fetching blotter requests count:', err);
          }
          return null;
        }).catch(() => null) : Promise.resolve(null),
        
        // Fetch pending asset requests count (use efficient endpoint)
        // Only fetch if user has inventory module access
        // For staff with inventory permissions, use /asset-requests to get all requests
        // For admin, try status-counts first, then fallback to full list
        (user?.role === 'admin' || hasModuleAccess('inventory'))
        ? (() => {
            // For staff, directly use /asset-requests to get all requests (status-counts only returns own requests)
            if (user?.role === 'staff') {
              return axiosInstance.get('/asset-requests', {
                timeout: 15000,
                params: { per_page: 1000, page: 1 }
              }).then(response => {
                const assetRequests = extractArrayFromResponse(response.data, ['asset_requests']);
                const pendingAssets = countPendingItems(assetRequests);
                return { type: 'inventory', count: pendingAssets };
              }).catch(err => {
                if (err.code !== 'ECONNABORTED') {
                  console.error('Error fetching asset requests count:', err);
                }
                return null;
              });
            }
            // For admin, try status-counts first (more efficient)
            return axiosInstance.get('/asset-requests/status-counts', {
              timeout: 15000 // 15 second timeout - increased for slow backend
            }).then(response => {
              const statusCounts = response.data || {};
              const pendingAssets = typeof statusCounts.pending === 'number' ? statusCounts.pending : 0;
              return { type: 'inventory', count: pendingAssets };
            }).catch(err => {
              // Silently fail timeout errors - don't spam console
              if (err.code !== 'ECONNABORTED') {
                console.error('Error fetching asset status counts:', err);
              }
              // Fallback: try full list
              return axiosInstance.get('/asset-requests', {
                timeout: 15000, // Increased timeout for fallback
                params: { per_page: 1000, page: 1 }
              }).then(response => {
                const assetRequests = extractArrayFromResponse(response.data, ['asset_requests']);
                const pendingAssets = countPendingItems(assetRequests);
                return { type: 'inventory', count: pendingAssets };
              }).catch(altErr => {
                // Silently fail timeout errors
                if (altErr.code !== 'ECONNABORTED') {
                  console.error('Error fetching asset requests count:', altErr);
                }
                return null;
              });
            });
          })() : Promise.resolve(null)
      ];
      
      // Execute all fetches in parallel (use allSettled so one failure doesn't block others)
      const results = await Promise.allSettled(fetchPromises);
      
      // Update counts with accurate data (handle both fulfilled and rejected promises)
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          const data = result.value;
          if (data.type === 'documents') {
            counts.documents = data.count;
            counts.documents_requests = data.count;
          } else if (data.type === 'verification') {
            counts.residents.verification = data.count;
          } else if (data.type === 'blotter') {
            counts.blotter = data.count;
          } else if (data.type === 'inventory') {
            counts.inventory = data.count;
          }
        } else if (result.status === 'rejected') {
          // Silently handle individual failures - other counts will still update
          console.warn(`Failed to fetch notification count for promise ${index}:`, result.reason);
        }
      });
      
      // CRITICAL: Update ALL badges simultaneously in a single state update
      // This ensures all badges appear/update at the same time without staggered loading
      // Using React's startTransition ensures smooth, non-blocking updates
      // React 18+ automatic batching ensures this is atomic
      startTransition(() => {
        setNotificationCounts({ ...counts });
      });
      
      // Cache counts to localStorage for instant display on next load
      try {
        localStorage.setItem('notification_counts', JSON.stringify(counts));
        localStorage.setItem('notification_counts_time', Date.now().toString());
      } catch (err) {
        // Ignore localStorage errors (e.g., quota exceeded)
      }
      
      // Debug log in development only
      if (process.env.NODE_ENV === 'development') {
        console.log('📊 Notification counts updated (all badges synchronized):', counts);
      }
    };
    
    // Fetch immediately on mount
    fetchNotificationCounts();
    
    // Refresh every 15 seconds (optimized for faster updates)
    const interval = setInterval(fetchNotificationCounts, 15000);
    
    // Real-time update mechanism: Listen for custom events to trigger immediate refresh
    // This allows other components to trigger badge updates when actions occur
    const handleNotificationUpdate = () => {
      // Trigger immediate refresh when notification events occur
      fetchNotificationCounts();
    };
    
    // Listen for custom events from other components
    window.addEventListener('notification:update', handleNotificationUpdate);
    window.addEventListener('document:approved', handleNotificationUpdate);
    window.addEventListener('document:rejected', handleNotificationUpdate);
    window.addEventListener('document:requested', handleNotificationUpdate);
    window.addEventListener('verification:updated', handleNotificationUpdate);
    window.addEventListener('blotter:updated', handleNotificationUpdate);
    window.addEventListener('asset:updated', handleNotificationUpdate);
    
    // Cleanup
    return () => {
      clearInterval(interval);
      window.removeEventListener('notification:update', handleNotificationUpdate);
      window.removeEventListener('document:approved', handleNotificationUpdate);
      window.removeEventListener('document:rejected', handleNotificationUpdate);
      window.removeEventListener('document:requested', handleNotificationUpdate);
      window.removeEventListener('verification:updated', handleNotificationUpdate);
      window.removeEventListener('blotter:updated', handleNotificationUpdate);
      window.removeEventListener('asset:updated', handleNotificationUpdate);
    };
  }, [user]);
  
  // Helper function to get notification count for a menu item
  const getNotificationCount = (item) => {
    if (!item.module) return 0;
    
    // Handle sub-items
    if (item.subModule) {
      if (item.module === 'residents' && item.subModule === 'verification') {
        return notificationCounts.residents?.verification || 0;
      }
      if (item.module === 'documents' && item.subModule === 'document_requests') {
        return notificationCounts.documents_requests || 0;
      }
      return 0;
    }
    
    // Handle main items
    switch (item.module) {
      case 'documents':
        return notificationCounts.documents || 0;
      case 'residents':
        // Return verification count for main residents item
        return notificationCounts.residents?.verification || 0;
      case 'blotter':
        return notificationCounts.blotter || 0;
      case 'inventory':
        return notificationCounts.inventory || 0;
      default:
        return 0;
    }
  };
  
  // Notification Badge Component - Flat red (not too bright), no gradients or shadows
  const NotificationBadge = ({ count, className = '', showDot = false, variant = 'circular' }) => {
    if (!count || count === 0) return null;
    
    // Flat red - not too bright, no gradients, shadows, or effects
    const badgeColor = '#EF4444'; // Red-500 - less bright than pure red
    const textColor = '#FFFFFF'; // White text for contrast
    
    // For collapsed sidebar or when showDot is true, show a small flat dot
    if (showDot || isCollapsed) {
      return (
        <span 
          className={`inline-block rounded-full ${className}`}
          style={{ 
            width: '9px',
            height: '9px',
            borderRadius: '50%',
            backgroundColor: badgeColor,
            position: 'absolute',
            top: '-3px',
            right: '-3px',
            zIndex: 10
          }}
        />
      );
    }
    
    const displayCount = count > 99 ? '99+' : count;
    const isDoubleDigit = count > 9;
    
    // Circular badge (default) - Bright flat red, no effects
    if (variant === 'circular') {
      return (
        <span 
          className={`inline-flex items-center justify-center text-xs font-bold ${className}`}
          style={{
            minWidth: isDoubleDigit ? '28px' : '24px',
            height: '24px',
            padding: isDoubleDigit ? '0 9px' : '0 7px',
            borderRadius: '12px',
            backgroundColor: badgeColor,
            color: textColor,
            fontWeight: '700',
            letterSpacing: '0.025em',
            lineHeight: '1'
          }}
        >
          {displayCount}
        </span>
      );
    }
    
    // Rectangular badge (alternative style) - Bright flat red, no effects
    return (
      <span 
        className={`inline-flex items-center justify-center text-xs font-bold ${className}`}
        style={{
          minWidth: isDoubleDigit ? '34px' : '30px',
          height: '24px',
          padding: isDoubleDigit ? '0 11px' : '0 9px',
          borderRadius: '8px',
          backgroundColor: badgeColor,
          color: textColor,
          fontWeight: '700',
          letterSpacing: '0.025em',
          lineHeight: '1'
        }}
      >
        {displayCount}
      </span>
    );
  };

  // Filter menu items based on permissions
  const filteredMenuItems = React.useMemo(() => {
    // If user is a resident, show resident-specific menu
    if (user?.role === 'resident') {
      return residentMenuItems;
    }

    // For other roles, filter based on permissions
    return allMenuItems.filter(item => {
      // Admin sees everything
      if (user?.role === 'admin') return true;

      // For staff, check module permissions using the new permission system
      if (user?.role === 'staff') {
        // Check if user has access to the main module
        const hasAccess = hasModuleAccess(item.module);
        
        // If no access to main module, don't show the item
        if (!hasAccess) {
          return false;
        }
        
        if (item.subItems) {
          // For items with sub-items, filter sub-items based on sub-module permissions
          item.subItems = item.subItems.filter(subItem => 
            hasSubModuleAccess(subItem.module, subItem.subModule)
          );
          
          // Show parent item only if it has accessible sub-items
          return item.subItems.length > 0;
        }
        
        return hasAccess;
      }

      return false;
    });
  }, [user?.role, permissions, hasModuleAccess, hasSubModuleAccess]);

  // Toggle expanded state for menu items
  const toggleExpanded = (itemTitle) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemTitle)) {
        newSet.delete(itemTitle);
      } else {
        newSet.add(itemTitle);
      }
      return newSet;
    });
  };

  return (
    <>
      {/* Pulse Animation for Notification Badges */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.1);
          }
        }
      `}</style>
      
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={closeMobileSidebar}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-40 h-screen bg-gradient-to-b from-green-900 to-green-800 shadow-2xl border-r border-green-700
        transition-all duration-300 ease-in-out
        ${isCollapsed ? 'w-16' : 'w-72'}
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <div className="flex flex-col h-full px-4 py-6 overflow-y-auto text-white space-y-6 scrollbar-thin scrollbar-thumb-green-600 scrollbar-track-green-800">

        {/* Header */}
        <div className="flex items-center justify-center gap-3">
          <Megaphone className="text-lime-300 w-7 h-7 flex-shrink-0" />
          {!isCollapsed && (
            <h2 className="text-2xl font-extrabold tracking-wide text-lime-100 whitespace-nowrap">
              {user?.role?.toUpperCase() || "PANEL"}
            </h2>
          )}
        </div>

        <hr className="border-green-700" />

        {/* Navigation */}
        <nav className="flex-1">
          <ul className="space-y-1">
            {filteredMenuItems.map((item, idx) => {
              // Check if current path matches item path or any sub-item path
              const isActive = location.pathname === item.path || 
                (item.subItems && item.subItems.some(subItem => {
                  // For sub-items with query parameters, check both pathname and query params
                  if (subItem.path.includes('?')) {
                    const [subPath, subQuery] = subItem.path.split('?');
                    const subQueryParams = new URLSearchParams(subQuery);
                    const section = subQueryParams.get('section');
                    
                    // Check if pathname matches and query params match
                    let matches = location.pathname === subPath && 
                      Array.from(subQueryParams.keys()).every(key => 
                        searchParams.get(key) === subQueryParams.get(key)
                      );
                    
                    // Also check if we're on the corresponding separate route
                    if (!matches && section) {
                      if (section === 'verification' && location.pathname.includes('/resident-records/verification')) {
                        matches = true;
                      } else if (section === 'disabled' && location.pathname.includes('/resident-records/disabled-residents')) {
                        matches = true;
                      }
                    }
                    return matches;
                  }
                  return location.pathname === subItem.path;
                }));
              const isExpanded = expandedItems.has(item.title);
              const hasSubItems = item.subItems && item.subItems.length > 0;
              
              return (
                <li key={idx}>
                  <div className="flex items-center">
                    <Link
                      to={item.path}
                      onClick={() => {
                        if (window.innerWidth < 1024) {
                          closeMobileSidebar();
                        }
                      }}
                      className={`relative flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200 group flex-1
                        ${isCollapsed ? 'justify-center' : ''}
                        ${isActive
                          ? "bg-green-700 text-white font-semibold border-l-4 border-lime-300"
                          : "hover:bg-green-700 hover:text-white text-green-100"
                        }`}
                      title={isCollapsed ? item.title : ''}
                    >
                      <span className="relative group-hover:scale-110 transition-transform flex-shrink-0">
                        {item.icon}
                        {isCollapsed && <NotificationBadge count={getNotificationCount(item)} showDot />}
                      </span>
                      {!isCollapsed && (
                        <span className="truncate text-sm tracking-wide flex-1 relative flex items-center justify-between gap-3 min-w-0">
                          <span className="truncate flex-1">{item.title}</span>
                          <NotificationBadge 
                            count={getNotificationCount(item)} 
                            variant="circular"
                            className="flex-shrink-0 ml-auto" 
                          />
                        </span>
                      )}
                    </Link>
                    
                    {hasSubItems && !isCollapsed && (
                      <button
                        onClick={() => toggleExpanded(item.title)}
                        className="px-2 py-3 text-green-100 hover:text-white transition-colors"
                      >
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    )}
                  </div>
                  
                  {/* Sub-items */}
                  {hasSubItems && isExpanded && !isCollapsed && (
                    <ul className="ml-6 space-y-1 mt-1">
                      {item.subItems.map((subItem, subIdx) => {
                        // Check active state for sub-items with query parameters
                        let isSubActive = false;
                        if (subItem.path.includes('?')) {
                          const [subPath, subQuery] = subItem.path.split('?');
                          const subQueryParams = new URLSearchParams(subQuery);
                          const section = subQueryParams.get('section');
                          
                          // Check if pathname and query params match
                          isSubActive = location.pathname === subPath && 
                            Array.from(subQueryParams.keys()).every(key => 
                              searchParams.get(key) === subQueryParams.get(key)
                            );
                          
                          // Also check if we're on the corresponding separate route
                          if (!isSubActive && section) {
                            if (section === 'verification' && location.pathname.includes('/resident-records/verification')) {
                              isSubActive = true;
                            } else if (section === 'disabled' && location.pathname.includes('/resident-records/disabled-residents')) {
                              isSubActive = true;
                            }
                          }
                        } else {
                          isSubActive = location.pathname === subItem.path;
                        }
                        return (
                          <li key={subIdx}>
                            <Link
                              to={subItem.path}
                              onClick={() => {
                                if (window.innerWidth < 1024) {
                                  closeMobileSidebar();
                                }
                              }}
                              className={`relative flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-200 group text-sm
                                ${isSubActive
                                  ? "bg-green-600 text-white font-medium"
                                  : "hover:bg-green-700/50 hover:text-white text-green-200"
                                }`}
                            >
                              <div className="w-1 h-1 bg-green-300 rounded-full flex-shrink-0"></div>
                              <span className="truncate flex-1 min-w-0 flex items-center justify-between gap-2">
                                <span className="truncate">{subItem.title}</span>
                                <NotificationBadge 
                                  count={getNotificationCount(subItem)} 
                                  variant="circular"
                                  className="flex-shrink-0" 
                                />
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className={`text-sm text-green-300 text-center pt-6 border-t border-green-700 ${isCollapsed ? 'hidden' : ''}`}>
          <p>&copy; 2025 Barangay System</p>
        </div>
      </div>
    </aside>
    </>
  );
};

export default Sidebar;
