// Route configuration with module permissions mapping
export const routeConfig = {
  // Admin/Staff routes (subject to permissions)
  common: [
    { path: "dashboard", element: null, module: "dashboard" },
    { path: "documentsRecords", element: null, module: "documents" },
    { path: "residentsRecords", element: null, module: "residents" },
    { path: "resident-records/disabled-residents", element: null, module: "residents" },
    { path: "resident-records/verification", element: null, module: "residents" },
    { path: "householdRecords", element: null, module: "household" },
    { path: "blotterRecords", element: null, module: "blotter" },
    { path: "financialTracking", element: null, module: "treasurer" },
    { path: "barangayOfficials", element: null, module: "officials" },
    { path: "staff", element: null, module: "staff" },
    { path: "communicationAnnouncement", element: null, module: "communication" },
    { path: "projectManagement", element: null, module: "projects" },
    { path: "socialServices", element: null, module: "social_services" },
    { path: "disasterEmergency", element: null, module: "command_center" },
    { path: "inventoryAssets", element: null, module: "inventory" },
    { path: "activityLogs", element: null, module: "logs" },
    { path: "backup", element: null, module: "backup" },
    
    // Additional admin-specific routes that were missing
    { path: "social-services", element: null, module: "social_services" },
    { path: "social-services/program/:id", element: null, module: "social_services" },
    { path: "assets-management", element: null, module: "inventory" },
    { path: "assets-post-management", element: null, module: "inventory" },
    { path: "officials-management", element: null, module: "officials" },
    { path: "staff-management", element: null, module: "staff" },
    { path: "staff-managements", element: null, module: "officials" },
    { path: "create-household", element: null, module: "household" },
    { path: "modules/Blotter/NewComplaint", element: null, module: "blotter" },
    { path: "modules/Blotter/BlotterRequest", element: null, module: "blotter" }
  ],
  
  // Resident-specific routes (always accessible to residents)
  residents: [
    { path: "dashboard", element: null, module: "dashboard" },
    { path: "profile", element: null, module: "profile" },
    { path: "projects", element: null, module: "projects" },
    { path: "requestDocuments", element: null, module: "requestDocuments" },
    { path: "requestAssets", element: null, module: "requestAssets" },
    { path: "statusassetrequests", element: null, module: "statusassetrequests" },
    { path: "generateBlotter", element: null, module: "generateBlotter" },
    { path: "statusDocumentRequests", element: null, module: "statusDocumentRequests" },
    { path: "statusBlotterRequests", element: null, module: "statusBlotterRequests" },
    { path: "blotterAppointment", element: null, module: "blotterAppointment" },
    { path: "organizationalChart", element: null, module: "organizationalChart" },
    { path: "officials", element: null, module: "organizationalChart" },
    { path: "staff", element: null, module: "organizationalChart" },
    { path: "charterList", element: null, module: "blotterAppointment" },
    { path: "myBenefits", element: null, module: "myBenefits" },
    { path: "enrolledPrograms", element: null, module: "enrolledPrograms" },
    { path: "addFeedback", element: null, module: "addFeedback" },
    { path: "modules/Programs/ProgramAnnouncements", element: null, module: "programAnnouncements" },
    { path: "notifications", element: null, module: "notifications" }
  ],
  
  // Special paths that don't require module permissions
  unrestricted: [
    "edit-profile",
    "modules/Programs/ProgramAnnouncements",
    "staff-profile"
  ]
};