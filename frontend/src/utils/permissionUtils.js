/**
 * Permission utility functions for staff access control
 */

/**
 * Check if a staff member has access to a specific module
 * @param {Object} staffPermissions - Staff member's permissions object
 * @param {string} moduleKey - Module key to check (e.g., 'documents', 'residents')
 * @returns {boolean} - Whether the staff member has access to the module
 */
export const hasModuleAccess = (staffPermissions, moduleKey) => {
  if (!staffPermissions || !moduleKey) return false;
  
  // Map frontend module keys to backend keys
  const backendKeyMap = {
    'dashboard': 'dashboard',
    'residents': 'residentsRecords',
    'documents': 'documentsRecords',
    'household': 'householdRecords',
    'blotter': 'blotterRecords',
    'treasurer': 'financialTracking',
    'officials': 'barangayOfficials',
    'staff': 'staffManagement',
    'communication': 'communicationAnnouncement',
    'projects': 'projectManagement',
    'social_services': 'socialServices',
    'command_center': 'disasterEmergency',
    'inventory': 'inventoryAssets',
    'logs': 'activityLogs'
  };
  
  // Try frontend key first
  let modulePermission = staffPermissions[moduleKey];
  const backendKey = backendKeyMap[moduleKey];
  
  // If not found, try backend key
  if (modulePermission === undefined && backendKey) {
    modulePermission = staffPermissions[backendKey];
  }
  
  // Handle new permission structure with access property
  if (typeof modulePermission === 'object' && modulePermission !== null) {
    return Boolean(modulePermission.access);
  }
  
  // Handle legacy boolean format
  return Boolean(modulePermission);
};

/**
 * Check if a staff member has access to a specific sub-module/section
 * @param {Object} staffPermissions - Staff member's permissions object
 * @param {string} moduleKey - Module key (e.g., 'documents', 'residents')
 * @param {string} subModuleKey - Sub-module key (e.g., 'document_requests', 'verification')
 * @returns {boolean} - Whether the staff member has access to the sub-module
 */
export const hasSubModuleAccess = (staffPermissions, moduleKey, subModuleKey) => {
  if (!staffPermissions || !moduleKey || !subModuleKey) return false;
  
  const modulePermission = staffPermissions[moduleKey];
  
  // Handle new permission structure with sub_permissions
  if (typeof modulePermission === 'object' && modulePermission !== null && modulePermission.sub_permissions) {
    return Boolean(modulePermission.sub_permissions[subModuleKey]);
  }
  
  // If no sub-permissions structure, check if module access is granted
  return hasModuleAccess(staffPermissions, moduleKey);
};

/**
 * Get filtered navigation items based on staff permissions
 * @param {Array} navigationItems - Array of navigation items with permissions
 * @param {Object} staffPermissions - Staff member's permissions object
 * @returns {Array} - Filtered navigation items that the staff member can access
 */
export const getFilteredNavigationItems = (navigationItems, staffPermissions) => {
  if (!navigationItems || !staffPermissions) return [];
  
  return navigationItems.filter(item => {
    // Check if staff has access to the main module
    if (item.moduleKey && !hasModuleAccess(staffPermissions, item.moduleKey)) {
      return false;
    }
    
    // Check if staff has access to specific sub-modules
    if (item.subItems && item.subItems.length > 0) {
      item.subItems = item.subItems.filter(subItem => {
        if (subItem.moduleKey && subItem.subModuleKey) {
          return hasSubModuleAccess(staffPermissions, subItem.moduleKey, subItem.subModuleKey);
        }
        return true;
      });
      
      // Only show parent item if it has accessible sub-items or if it's accessible itself
      return item.subItems.length > 0 || hasModuleAccess(staffPermissions, item.moduleKey);
    }
    
    return true;
  });
};

/**
 * Check if a staff member can perform a specific action
 * @param {Object} staffPermissions - Staff member's permissions object
 * @param {string} action - Action to check (e.g., 'view', 'edit', 'delete', 'disable')
 * @param {string} moduleKey - Module key
 * @param {string} subModuleKey - Optional sub-module key
 * @returns {boolean} - Whether the staff member can perform the action
 */
export const canPerformAction = (staffPermissions, action, moduleKey, subModuleKey = null) => {
  if (!staffPermissions || !action || !moduleKey) return false;
  
  // Map frontend module keys to backend keys
  const backendKeyMap = {
    'dashboard': 'dashboard',
    'residents': 'residentsRecords',
    'documents': 'documentsRecords',
    'household': 'householdRecords',
    'blotter': 'blotterRecords',
    'treasurer': 'financialTracking',
    'officials': 'barangayOfficials',
    'staff': 'staffManagement',
    'communication': 'communicationAnnouncement',
    'projects': 'projectManagement',
    'social_services': 'socialServices',
    'command_center': 'disasterEmergency',
    'inventory': 'inventoryAssets',
    'logs': 'activityLogs'
  };
  
  const backendKey = backendKeyMap[moduleKey] || moduleKey;
  
  // First, check if permissions are in flat backend format (e.g., residentsRecords_main_records_edit)
  // This is the format returned directly from the backend
  if (subModuleKey && action) {
    // Check flat format: backendKey_subModuleKey_action (e.g., residentsRecords_main_records_edit)
    const flatKey = `${backendKey}_${subModuleKey}_${action}`;
    
    // Normalize permission value - handle true, 1, '1', 'true', etc.
    const normalizePermissionValue = (value) => {
      if (value === undefined || value === null) return false;
      if (value === true || value === 1 || value === '1' || value === 'true') return true;
      if (value === false || value === 0 || value === '0' || value === 'false') return false;
      return Boolean(value);
    };
    
    // Check directly in staffPermissions (which should be module_permissions from backend)
    if (staffPermissions[flatKey] !== undefined) {
      const result = normalizePermissionValue(staffPermissions[flatKey]);
      // Only log for debugging when checking residents permissions
      if (backendKey === 'residentsRecords') {
        console.log(`✅ canPerformAction: Found flat key "${flatKey}" = ${result}`, {
          rawValue: staffPermissions[flatKey],
          normalizedValue: result,
          type: typeof staffPermissions[flatKey],
          staffPermissionsKeys: Object.keys(staffPermissions).filter(k => k.includes('residents'))
        });
      }
      return result;
    }
    
    // If flat key doesn't exist, the action is NOT permitted
    // Don't fall through to module permission check - specific actions require explicit permission
    // Only log for debugging when checking residents permissions
    if (backendKey === 'residentsRecords') {
      const availableKeys = Object.keys(staffPermissions).filter(k => k.includes(backendKey));
      const allKeys = Object.keys(staffPermissions);
      
      console.log(`❌ canPerformAction: Flat key "${flatKey}" not found - action NOT permitted`, {
        lookingFor: flatKey,
        availableKeys: availableKeys,
        allKeys: allKeys,
        allKeysWithValues: allKeys.map(k => ({ key: k, value: staffPermissions[k], type: typeof staffPermissions[k] })),
        staffPermissions: staffPermissions,
        // Try to find similar keys
        similarKeys: Object.keys(staffPermissions).filter(k => 
          k.includes(backendKey) && k.includes(subModuleKey) && k.includes(action)
        ),
        // Check if main_records exists
        hasMainRecords: staffPermissions[`${backendKey}_${subModuleKey}`],
        // Check all residents-related keys
        allResidentsKeys: allKeys.filter(k => k.toLowerCase().includes('residents'))
      });
    }
    
    // Return false - specific action permission is required
    return false;
  }
  
  // Try frontend key first
  let modulePermission = staffPermissions[moduleKey];
  
  // If not found, try backend key
  if (modulePermission === undefined && backendKey) {
    modulePermission = staffPermissions[backendKey];
  }
  
  // Handle new permission structure with nested sub-permissions
  if (typeof modulePermission === 'object' && modulePermission !== null) {
    // Check if module has access
    if (!modulePermission.access) return false;
    
    // If checking for a sub-module with nested permissions (e.g., main_records with edit, disable, view)
    if (subModuleKey && modulePermission.sub_permissions) {
      const subPermission = modulePermission.sub_permissions[subModuleKey];
      
      // Check if sub-permission has nested sub-permissions (e.g., main_records with edit, disable, view)
      if (typeof subPermission === 'object' && subPermission !== null && subPermission.sub_permissions) {
        // Check if the action is in the nested sub-permissions
        if (subPermission.sub_permissions[action] !== undefined) {
          return Boolean(subPermission.sub_permissions[action]);
        }
        // If action not found in nested, return false - specific action permission required
        return false;
      }
      
      // Simple sub-permission (boolean)
      return Boolean(subPermission);
    }
    
    // If no sub-module specified, check module access
    return Boolean(modulePermission.access);
  }
  
  // Handle legacy boolean format
  return Boolean(modulePermission);
};

/**
 * Get permission summary for display purposes
 * @param {Object} staffPermissions - Staff member's permissions object
 * @returns {Object} - Summary of granted permissions
 */
export const getPermissionSummary = (staffPermissions) => {
  if (!staffPermissions) return { modules: 0, subModules: 0, total: 0 };
  
  let modules = 0;
  let subModules = 0;
  
  Object.entries(staffPermissions).forEach(([moduleKey, modulePermission]) => {
    if (typeof modulePermission === 'object' && modulePermission !== null) {
      if (modulePermission.access) {
        modules++;
        
        if (modulePermission.sub_permissions) {
          Object.values(modulePermission.sub_permissions).forEach(subPermission => {
            if (subPermission) subModules++;
          });
        }
      }
    } else if (modulePermission) {
      modules++;
    }
  });
  
  return {
    modules,
    subModules,
    total: modules + subModules
  };
};

/**
 * Permission constants for consistent usage across the application
 */
export const PERMISSION_MODULES = {
  DASHBOARD: 'dashboard',
  RESIDENTS: 'residents',
  DOCUMENTS: 'documents',
  HOUSEHOLD: 'household',
  BLOTTER: 'blotter',
  TREASURER: 'treasurer',
  OFFICIALS: 'officials',
  STAFF: 'staff',
  COMMUNICATION: 'communication',
  SOCIAL_SERVICES: 'social_services',
  COMMAND_CENTER: 'command_center',
  PROJECTS: 'projects',
  INVENTORY: 'inventory',
  LOGS: 'logs'
};

export const PERMISSION_SUB_MODULES = {
  // Residents sub-modules
  RESIDENTS_MAIN_RECORDS: 'main_records',
  RESIDENTS_VERIFICATION: 'verification',
  RESIDENTS_DISABLED: 'disabled_residents',
  
  // Documents sub-modules
  DOCUMENTS_REQUESTS: 'document_requests',
  DOCUMENTS_RECORDS: 'document_records',
  
  // Social Services sub-modules
  SOCIAL_SERVICES_PROGRAMS: 'programs',
  SOCIAL_SERVICES_BENEFICIARIES: 'beneficiaries',
  
  // Command Center sub-modules
  COMMAND_CENTER_DISASTER_RECORDS: 'disaster_records',
  COMMAND_CENTER_EMERGENCY_HOTLINES: 'emergency_hotlines',
  
  // Inventory sub-modules
  INVENTORY_ASSET_MANAGEMENT: 'asset_management',
  INVENTORY_ASSET_REQUESTS: 'asset_requests'
};

export const PERMISSION_ACTIONS = {
  VIEW: 'view',
  CREATE: 'create',
  EDIT: 'edit',
  DELETE: 'delete',
  APPROVE: 'approve',
  REJECT: 'reject'
};
