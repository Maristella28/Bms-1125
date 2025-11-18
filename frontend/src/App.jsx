// App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy, useEffect, useState } from "react";
import LoadingSkeleton from './components/LoadingSkeleton';

// Eagerly load critical components
import ProtectedRoute from './components/ProtectedRoute';
import RoleBasedRoute from './components/RoleBasedRoute';
import DynamicLayout from "./layout/DynamicLayout";
import { AdminSidebarProvider } from './contexts/AdminSidebarContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';

// Lazy load pages for better performance
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Welcome = lazy(() => import("./pages/Welcome"));
const EmailVerification = lazy(() => import("./pages/EmailVerification"));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const Profile = lazy(() => import("./pages/forms/Profile"));
const ResidencyDenied = lazy(() => import("./pages/residents/ResidencyDenied"));
const Congratulations = lazy(() => import('./pages/Congratulations'));

// Lazy load individual admin pages
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const DocumentsRecords = lazy(() => import('./pages/admin/DocumentsRecords'));
const ResidentsRecords = lazy(() => import('./pages/admin/ResidentsRecords'));
const HouseholdRecords = lazy(() => import('./pages/admin/HouseholdRecords'));
const BlotterRecords = lazy(() => import('./pages/admin/BlotterRecords'));
const FinancialTracking = lazy(() => import('./pages/admin/FinancialTracking'));
const BarangayOfficials = lazy(() => import('./pages/admin/BarangayOfficials'));
const CommunicationAnnouncement = lazy(() => import('./pages/admin/CommunicationAnnouncement'));
const ProjectManagement = lazy(() => import('./pages/admin/ProjectManagement'));
const SocialServices = lazy(() => import('./pages/admin/modules/SocialServices/SocialServices'));
const DisasterEmergency = lazy(() => import('./pages/admin/DisasterEmergency'));
const InventoryAssets = lazy(() => import('./pages/admin/InventoryAssets'));
const ActivityLogs = lazy(() => import('./pages/admin/ActivityLogs'));
const BackupManagement = lazy(() => import('./pages/admin/modules/backup/BackupManagement'));

// Lazy load individual resident pages
const ResidentDashboard = lazy(() => import('./pages/residents/Dashboard'));
const Projects = lazy(() => import('./pages/residents/Projects'));
const RequestDocuments = lazy(() => import('./pages/residents/RequestDocuments'));
const GenerateBlotter = lazy(() => import('./pages/residents/GenerateBlotter'));
const StatusBlotterRequests = lazy(() => import('./pages/residents/modules/Blotter/StatusBlotterRequests'));
const BlotterAppointment = lazy(() => import('./pages/residents/BlotterAppointment'));
const OrganizationalChart = lazy(() => import('./pages/residents/OrganizationalChart'));
const Officials = lazy(() => import('./pages/residents/modules/OrganizationalChart/Officials'));
const Staff = lazy(() => import('./pages/residents/modules/OrganizationalChart/Staff'));
const CharterList = lazy(() => import('./pages/residents/CharterList'));
const MyBenefits = lazy(() => import('./pages/residents/modules/Programs/MyBenefits'));
const EnrolledPrograms = lazy(() => import('./pages/residents/modules/Programs/EnrolledPrograms'));
const AddFeedback = lazy(() => import('./pages/residents/AddFeedback'));
const ProgramAnnouncements = lazy(() => import('./pages/residents/modules/Programs/ProgramAnnouncements'));
const Notifications = lazy(() => import('./pages/residents/Notifications'));

// Lazy load module pages
const ProgramDetails = lazy(() => import('./pages/admin/modules/SocialServices/ProgramDetails'));
const CreateHousehold = lazy(() => import('./pages/admin/modules/household-record/CreateHousehold'));
const AdminEditProfile = lazy(() => import('./pages/admin/AdminEditProfile'));
const RequestAssets = lazy(() => import('./pages/residents/modules/Assets/RequestAssets'));
const StatusAssetRequests = lazy(() => import('./pages/residents/modules/Assets/StatusAssetRequests'));
// Admin Staff Management (for permissions)
const StaffManagement = lazy(() => import('./pages/admin/modules/Staff/StaffManagement'));
// Organizational Chart Staff Management (different component)
const OrgChartStaffManagement = lazy(() => import('./pages/admin/modules/Barangay Officials/StaffManagements'));
// Staff Profile component
const StaffProfile = lazy(() => import('./pages/staff/StaffProfile'));
const StaffDashboard = lazy(() => import('./pages/staff/StaffDashboard'));
const AssetsManagement = lazy(() => import('./pages/admin/modules/Assets/AssetsManagement'));
const AssetsPostManagement = lazy(() => import('./pages/admin/modules/Assets/AssetsPostManagement'));
const BlotterRequest = lazy(() => import('./pages/admin/modules/Blotter/BlotterRequest'));
const NewComplaint = lazy(() => import('./pages/admin/modules/Blotter/NewComplaint'));
const OngoingCases = lazy(() => import('./pages/admin/modules/Blotter/OngoingCases'));
const OfficialsManagement = lazy(() => import('./pages/admin/modules/Barangay Officials/OfficialsManagement'));

// Additional admin module components
const AddDisasterEmergencyRecord = lazy(() => import('./pages/admin/modules/Disaster&Emergency/AddDisasterEmergencyRecord'));
const EmergencyHotlinesTable = lazy(() => import('./pages/admin/modules/Disaster&Emergency/EmergencyHotlinesTable'));
const AddResidents = lazy(() => import('./pages/admin/modules/residents-record/AddResidents'));
const DisabledResidentsPage = lazy(() => import('./pages/admin/modules/residents-record/DisabledResidentsPage'));
const ResidentsVerificationPage = lazy(() => import('./pages/admin/modules/residents-record/ResidentsVerificationPage'));

// Route configuration
import { routeConfig } from './config/routes';
import { useAuth } from './contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import modulePreloader from './utils/modulePreloader';

// Mobile detection hook
const useMobileDetection = () => {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  return isMobile;
};

// Dashboard redirect component
const DashboardRedirect = () => {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  // Redirect based on user role
  if (user.role === 'residents' || user.role === 'resident') {
    return <Navigate to="/residents/dashboard" replace />;
  } else if (user.role === 'staff') {
    return <Navigate to="/staff/dashboard" replace />;
  } else {
    return <Navigate to="/admin/dashboard" replace />;
  }
};

// Helper function to wrap components with Suspense
const withSuspense = (Component) => (
  <Suspense fallback={<LoadingSkeleton />}>
    {Component}
  </Suspense>
);

// Initialize route configurations before the App component
// Map resident routes to their components with Suspense
const residentRoutesWithComponents = routeConfig.residents.map(route => ({
  ...route,
  element: {
    "dashboard": withSuspense(<ResidentDashboard />),
    "profile": withSuspense(<Profile />),
    "projects": withSuspense(<Projects />),
    "requestDocuments": withSuspense(<RequestDocuments />),
    "requestAssets": withSuspense(<RequestAssets />),
    "statusassetrequests": withSuspense(<StatusAssetRequests />),
    "generateBlotter": withSuspense(<GenerateBlotter />),
    "statusBlotterRequests": withSuspense(<StatusBlotterRequests />),
    "blotterAppointment": withSuspense(<BlotterAppointment />),
    "organizationalChart": withSuspense(<OrganizationalChart />),
    "officials": withSuspense(<Officials />),
    "staff": withSuspense(<Staff />),
    "charterList": withSuspense(<CharterList />),
    "myBenefits": withSuspense(<MyBenefits />),
    "enrolledPrograms": withSuspense(<EnrolledPrograms />),
    "addFeedback": withSuspense(<AddFeedback />),
    "modules/Programs/ProgramAnnouncements": withSuspense(<ProgramAnnouncements />),
    "notifications": withSuspense(<Notifications />)
  }[route.path] || withSuspense(<div>Page under construction</div>) // Fallback for missing components
}));

// Update the resident routes with components
routeConfig.residents = residentRoutesWithComponents;

// Map the common routes to their components with Suspense
const commonRoutesWithComponents = routeConfig.common.map(route => ({
  ...route,
  element: {
    "dashboard": withSuspense(<AdminDashboard />),
    "documentsRecords": withSuspense(<DocumentsRecords />),
    "residentsRecords": withSuspense(<ResidentsRecords />),
    "resident-records/disabled-residents": withSuspense(<DisabledResidentsPage />),
    "resident-records/verification": withSuspense(<ResidentsVerificationPage />),
    "householdRecords": withSuspense(<HouseholdRecords />),
    "blotterRecords": withSuspense(<BlotterRecords />),
    "financialTracking": withSuspense(<FinancialTracking />),
    "barangayOfficials": withSuspense(<BarangayOfficials />),
    "staff": withSuspense(<StaffManagement />),
    "communicationAnnouncement": withSuspense(<CommunicationAnnouncement />),
    "projectManagement": withSuspense(<ProjectManagement />),
    "socialServices": withSuspense(<SocialServices />),
    "disasterEmergency": withSuspense(<DisasterEmergency />),
    "inventoryAssets": withSuspense(<InventoryAssets />),
    "activityLogs": withSuspense(<ActivityLogs />),
    "backup": withSuspense(<BackupManagement />),
    
    // Additional admin-specific route mappings
    "social-services": withSuspense(<SocialServices />),
    "assets-management": withSuspense(<AssetsManagement />),
    "assets-post-management": withSuspense(<AssetsPostManagement />),
    "officials-management": withSuspense(<OfficialsManagement />),
    "staff-managements": withSuspense(<OrgChartStaffManagement />),
    "create-household": withSuspense(<CreateHousehold />),
    "modules/Blotter/NewComplaint": withSuspense(<NewComplaint />),
    "modules/Blotter/BlotterRequest": withSuspense(<BlotterRequest />),
    "modules/Blotter/OngoingCases": withSuspense(<OngoingCases />)
  }[route.path]
}));

// Update the common routes with components
routeConfig.common = commonRoutesWithComponents;

// Wrapper component for admin routes that need AdminSidebarProvider
const AdminRouteWrapper = ({ children }) => (
  <AdminSidebarProvider>
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6 bg-white">
          {children}
        </main>
      </div>
    </div>
  </AdminSidebarProvider>
);

// Component to render routes based on user role
const RoleBasedRoutes = () => {
  try {
    const { user } = useAuth();
    const location = useLocation();
    
    if (!user) return <div>Loading...</div>;
    
    // Get the current path - handle both single segments and nested paths
    const pathSegments = location.pathname.split('/').filter(segment => segment !== '');
    
    // For residents, render resident routes
    if (user.role === 'residents' || user.role === 'resident') {
      // Remove the role from the path segments for matching
      const pathWithoutRole = pathSegments.slice(1).join('/');
      
      // First try to find exact match with role removed
      let residentRoute = routeConfig.residents?.find(route => route.path === pathWithoutRole);
      
      if (residentRoute) {
        return residentRoute.element;
      }
      
      // If no exact match, try to find by last segment (for backward compatibility)
      const lastSegment = pathSegments[pathSegments.length - 1];
      residentRoute = routeConfig.residents?.find(route => route.path === lastSegment);
      
      if (residentRoute) {
        return residentRoute.element;
      }
    } else if (user.role === 'staff') {
      // For staff, render staff-specific routes
      const pathWithoutRole = pathSegments.slice(1).join('/');
      
      // Handle staff dashboard specifically
      if (pathWithoutRole === 'dashboard') {
        return withSuspense(<StaffDashboard />);
      }
      
      // For other staff routes, use common routes but with staff-specific components
      let commonRoute = routeConfig.common.find(route => route.path === pathWithoutRole);
      
      // If no exact match, try to find by last segment
      if (!commonRoute) {
        const lastSegment = pathSegments[pathSegments.length - 1];
        commonRoute = routeConfig.common.find(route => route.path === lastSegment);
      }
      
      if (commonRoute) {
        return commonRoute.element;
      }
    } else {
      // For admin, render common routes
      const pathWithoutRole = pathSegments.slice(1).join('/');
      
      let commonRoute = routeConfig.common.find(route => route.path === pathWithoutRole);
      
      // If no exact match, try to find by last segment
      if (!commonRoute) {
        const lastSegment = pathSegments[pathSegments.length - 1];
        commonRoute = routeConfig.common.find(route => route.path === lastSegment);
      }
      
      if (commonRoute) {
        return commonRoute.element;
      }
    }
    
    // Special routes
    const pathWithoutRole = pathSegments.slice(1).join('/');
    if (pathWithoutRole === 'edit-profile') {
      // Use AdminEditProfile for both admin and staff (it now works with staff profiles)
      return withSuspense(<AdminEditProfile />);
    }
    
    // Staff profile route
    if (pathWithoutRole === 'staff-profile') {
      return withSuspense(<StaffProfile />);
    }
    
    // 404 fallback
    return withSuspense(<div>Page not found</div>);
  } catch (error) {
    console.error('RoleBasedRoutes: Auth context error:', error);
    return <div>Authentication error. Please refresh the page.</div>;
  }
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={withSuspense(<Welcome />)} />
        <Route path="/login" element={withSuspense(<Login />)} />
          <Route path="/register" element={withSuspense(<Register />)} />
          <Route path="/privacy-policy" element={withSuspense(<PrivacyPolicyPage />)} />
          <Route path="/email/verify" element={withSuspense(<EmailVerification />)} />
          <Route path="/congratulations" element={<ProtectedRoute>{withSuspense(<Congratulations />)}</ProtectedRoute>} />
          <Route path="/residents/profile" element={<ProtectedRoute>{withSuspense(<Profile />)}</ProtectedRoute>} />
          <Route path="/residency-denied" element={withSuspense(<ResidencyDenied />)} />

          {/* Redirect route to Dashboard */}
          <Route path="/dashboard" element={<ProtectedRoute><DashboardRedirect /></ProtectedRoute>} />

          {/* Admin-specific standalone routes */}
          <Route path="/admin/assets-management" element={<RoleBasedRoute allowedRoles={['admin']}><AdminRouteWrapper>{withSuspense(<AssetsManagement />)}</AdminRouteWrapper></RoleBasedRoute>} />
          <Route path="/admin/assets-post-management" element={<RoleBasedRoute allowedRoles={['admin']}><AdminRouteWrapper>{withSuspense(<AssetsPostManagement />)}</AdminRouteWrapper></RoleBasedRoute>} />
          <Route path="/admin/social-services" element={<RoleBasedRoute allowedRoles={['admin', 'staff']}><AdminRouteWrapper>{withSuspense(<SocialServices />)}</AdminRouteWrapper></RoleBasedRoute>} />
          <Route path="/admin/social-services/program/:id" element={<RoleBasedRoute allowedRoles={['admin', 'staff']}><AdminRouteWrapper>{withSuspense(<ProgramDetails />)}</AdminRouteWrapper></RoleBasedRoute>} />
          
          {/* Blotter Module Routes */}
          <Route path="/admin/modules/Blotter/BlotterRequest" element={<RoleBasedRoute allowedRoles={['admin', 'staff']}><AdminRouteWrapper>{withSuspense(<BlotterRequest />)}</AdminRouteWrapper></RoleBasedRoute>} />
          <Route path="/admin/modules/Blotter/NewComplaint" element={<RoleBasedRoute allowedRoles={['admin', 'staff']}><AdminRouteWrapper>{withSuspense(<NewComplaint />)}</AdminRouteWrapper></RoleBasedRoute>} />
          <Route path="/admin/modules/Blotter/OngoingCases" element={<RoleBasedRoute allowedRoles={['admin', 'staff']}><AdminRouteWrapper>{withSuspense(<OngoingCases />)}</AdminRouteWrapper></RoleBasedRoute>} />
          
          {/* Staff and Officials Management Routes */}
          <Route path="/admin/staff-management" element={<RoleBasedRoute allowedRoles={['admin']}><AdminRouteWrapper>{withSuspense(<StaffManagement />)}</AdminRouteWrapper></RoleBasedRoute>} />
          <Route path="/admin/officials-management" element={<RoleBasedRoute allowedRoles={['admin']}><AdminRouteWrapper>{withSuspense(<OfficialsManagement />)}</AdminRouteWrapper></RoleBasedRoute>} />
          <Route path="/admin/org-staff-management" element={<RoleBasedRoute allowedRoles={['admin']}><AdminRouteWrapper>{withSuspense(<OrgChartStaffManagement />)}</AdminRouteWrapper></RoleBasedRoute>} />
          
          {/* Disaster & Emergency Routes */}
          <Route path="/admin/modules/Disaster&Emergency/AddDisasterEmergencyRecord" element={<RoleBasedRoute allowedRoles={['admin', 'staff']}><AdminRouteWrapper>{withSuspense(<AddDisasterEmergencyRecord />)}</AdminRouteWrapper></RoleBasedRoute>} />
          <Route path="/admin/modules/Disaster&Emergency/EmergencyHotlinesTable" element={<RoleBasedRoute allowedRoles={['admin', 'staff']}><AdminRouteWrapper>{withSuspense(<EmergencyHotlinesTable />)}</AdminRouteWrapper></RoleBasedRoute>} />
          
          {/* Residents Management Routes */}
          <Route path="/admin/modules/residents-record/AddResidents" element={<RoleBasedRoute allowedRoles={['admin', 'staff']}><AdminRouteWrapper>{withSuspense(<AddResidents />)}</AdminRouteWrapper></RoleBasedRoute>} />
          <Route path="/admin/resident-records/disabled-residents" element={<RoleBasedRoute allowedRoles={['admin', 'staff']}><AdminRouteWrapper>{withSuspense(<DisabledResidentsPage />)}</AdminRouteWrapper></RoleBasedRoute>} />
          <Route path="/admin/resident-records/verification" element={<RoleBasedRoute allowedRoles={['admin', 'staff']}><AdminRouteWrapper>{withSuspense(<ResidentsVerificationPage />)}</AdminRouteWrapper></RoleBasedRoute>} />
          
          {/* Household Management Routes */}
          <Route path="/admin/modules/Household/CreateHousehold" element={<RoleBasedRoute allowedRoles={['admin', 'staff']}><AdminRouteWrapper>{withSuspense(<CreateHousehold />)}</AdminRouteWrapper></RoleBasedRoute>} />
          
          {/* Backup Management Routes */}
          <Route path="/admin/backup" element={<RoleBasedRoute allowedRoles={['admin']}><AdminRouteWrapper>{withSuspense(<BackupManagement />)}</AdminRouteWrapper></RoleBasedRoute>} />
          <Route path="/admin/modules/backup" element={<RoleBasedRoute allowedRoles={['admin']}><AdminRouteWrapper>{withSuspense(<BackupManagement />)}</AdminRouteWrapper></RoleBasedRoute>} />
          
          {/* Dynamic Layout Routes */}
          <Route 
            path="/:role/*" 
            element={
              <ProtectedRoute>
                <DynamicLayout />
              </ProtectedRoute>
            }
          >
            {/* Role-based route rendering component */}
            <Route path="*" element={<RoleBasedRoutes />} />
          </Route>

          {/* Staff-specific routes */}
          <Route path="/staff/*" element={<RoleBasedRoute allowedRoles={['staff', 'admin']}><DynamicLayout /></RoleBasedRoute>}>
            <Route path="*" element={<RoleBasedRoutes />} />
          </Route>
          
          {/* Resident-specific routes */}
          <Route path="/resident/*" element={<RoleBasedRoute allowedRoles={['resident', 'residents']}><DynamicLayout /></RoleBasedRoute>}>
            <Route path="*" element={<RoleBasedRoutes />} />
          </Route>

          {/* 404 Fallback */}
          <Route path="*" element={<h1>404 - Page Not Found</h1>} />
        </Routes>
    </Router>
  );
}

export default App;