import React, { useState, useEffect } from 'react';
import axiosInstance from '../../../../utils/axiosConfig';
import { toast } from 'react-toastify';
import { 
  EyeIcon, 
  EyeSlashIcon, 
  CheckIcon, 
  XMarkIcon,
  UserGroupIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  PencilIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
  BookOpenIcon,
  PlayIcon,
  QuestionMarkCircleIcon
} from '@heroicons/react/24/outline';
import EmailVerification from '../../../../components/EmailVerification';

const StatCard = ({ label, value, icon, iconBg }) => (
  <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 flex justify-between items-center group">
    <div>
      <p className="text-sm font-medium text-gray-600">{label}</p>
      <p className="text-3xl font-bold text-green-600 group-hover:text-emerald-600 transition">{value}</p>
    </div>
    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${iconBg}`}>
      {icon}
    </div>
  </div>
);

const StaffManagement = () => {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successStaffName, setSuccessStaffName] = useState('');
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationData, setVerificationData] = useState(null);
  const [editingStaff, setEditingStaff] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeout = React.useRef(null);

  // Enhanced permissions structure with sub-permissions
  const defaultPermissions = {
    dashboard: { access: false },
    residents: { 
      access: false, 
      sub_permissions: {
        main_records: {
          access: false,
          sub_permissions: {
            edit: false,
            disable: false,
            view: false
          }
        },
        verification: false,
        disabled_residents: false
      }
    },
    documents: { 
      access: false, 
      sub_permissions: {
        document_requests: false,
        document_records: false
      }
    },
    household: { access: false },
    blotter: { access: false },
    treasurer: { access: false },
    officials: { access: false },
    staff: { access: false },
    communication: { access: false },
    social_services: { 
      access: false, 
      sub_permissions: {
        programs: false,
        beneficiaries: false
      }
    },
    command_center: { access: false },
    projects: { access: false },
    inventory: { 
      access: false, 
      sub_permissions: {
        asset_management: false,
        asset_posts_management: false,
        asset_tracking: false
      }
    },
    logs: { access: false }
  };

  // Normalize permissions coming from backend (string/number/missing keys → booleans)
  const normalizePermissions = (raw) => {
    let parsed = raw;
    if (typeof raw === 'string') {
      try { parsed = JSON.parse(raw); } catch { parsed = {}; }
    }
    if (!parsed || typeof parsed !== 'object') parsed = {};
    
    return Object.keys(defaultPermissions).reduce((acc, key) => {
      const defaultPermission = defaultPermissions[key];
      const rawPermission = parsed[key];
      
      if (typeof defaultPermission === 'object' && defaultPermission.sub_permissions) {
        // Handle sub-permissions (can be nested)
        const normalizedSubPerms = {};
        Object.keys(defaultPermission.sub_permissions).forEach(subKey => {
          const subDefault = defaultPermission.sub_permissions[subKey];
          const subValue = rawPermission?.[subKey] || rawPermission?.sub_permissions?.[subKey];
          
          // Check if this sub-permission has nested sub-permissions
          if (typeof subDefault === 'object' && subDefault.sub_permissions) {
            // Handle nested sub-permissions (e.g., main_records with edit, disable, view)
            const nestedSubPerms = {};
            Object.keys(subDefault.sub_permissions).forEach(nestedKey => {
              const nestedValue = subValue?.[nestedKey] || subValue?.sub_permissions?.[nestedKey];
              nestedSubPerms[nestedKey] = nestedValue === true || nestedValue === 1 || nestedValue === '1' || nestedValue === 'true';
            });
            
            normalizedSubPerms[subKey] = {
              access: subValue?.access === true || subValue?.access === 1 || subValue?.access === '1' || subValue?.access === 'true' ||
                      subValue === true || subValue === 1 || subValue === '1' || subValue === 'true',
              sub_permissions: nestedSubPerms
            };
          } else {
            // Handle simple sub-permissions (boolean)
          normalizedSubPerms[subKey] = subValue === true || subValue === 1 || subValue === '1' || subValue === 'true';
          }
        });
        
        acc[key] = {
          access: rawPermission?.access === true || rawPermission?.access === 1 || rawPermission?.access === '1' || rawPermission?.access === 'true' || 
                  rawPermission === true || rawPermission === 1 || rawPermission === '1' || rawPermission === 'true',
          sub_permissions: normalizedSubPerms
        };
      } else {
        // Handle simple permissions (legacy format)
        acc[key] = {
          access: rawPermission?.access === true || rawPermission?.access === 1 || rawPermission?.access === '1' || rawPermission?.access === 'true' ||
                  rawPermission === true || rawPermission === 1 || rawPermission === '1' || rawPermission === 'true'
        };
      }
      return acc;
    }, {});
  };

  // Map between UI keys and backend keys
  const uiToApiMap = {
    dashboard: 'dashboard',
    documents: 'documentsRecords',
    residents: 'residentsRecords',
    household: 'householdRecords',
    blotter: 'blotterRecords',
    treasurer: 'financialTracking',
    officials: 'barangayOfficials',
    staff: 'staffManagement',
    communication: 'communicationAnnouncement',
    projects: 'projectManagement',
    social_services: 'socialServices',
    command_center: 'disasterEmergency',
    inventory: 'inventoryAssets',
    logs: 'activityLogs'
  };

  const apiToUiMap = Object.entries(uiToApiMap).reduce((acc, [ui, api]) => {
    acc[api] = ui; return acc;
  }, {});

  // Convert backend permissions object to UI permission keys
  const mapApiToUiPermissions = (apiPerms) => {
    // Start with default permissions (all false)
    const base = JSON.parse(JSON.stringify(defaultPermissions)); // Deep clone
    
    // Parse the source permissions if it's a string
    const source = typeof apiPerms === 'string' ? (()=>{try{return JSON.parse(apiPerms);}catch{return {};}})() : (apiPerms || {});
    
    console.log('Mapping API to UI permissions:', { source, defaultPermissions });
    
    // Process all keys in a single pass, handling them in order of complexity
    // 1. Main module keys (no underscores) - e.g., "dashboard", "residentsRecords"
    // 2. 2-part keys (one underscore) - e.g., "residentsRecords_main_records"
    // 3. 3-part keys (two underscores) - e.g., "residentsRecords_main_records_view"
    
    Object.entries(source).forEach(([apiKey, value]) => {
      const normalizedValue = value === true || value === 1 || value === '1' || value === 'true';
      
      // Handle dashboard specially (it maps to itself)
      if (apiKey === 'dashboard') {
        base.dashboard.access = normalizedValue;
        return;
      }
      
      // Handle main module keys (no underscores)
      if (!apiKey.includes('_')) {
        const uiKey = apiToUiMap[apiKey];
        if (uiKey && base[uiKey]) {
          base[uiKey].access = normalizedValue;
        }
        return;
      }
      
      // Handle keys with underscores
      const parts = apiKey.split('_');
      const mainApiKey = parts[0];
      const uiKey = apiToUiMap[mainApiKey];
      
      if (!uiKey || !base[uiKey] || !base[uiKey].sub_permissions) {
        return; // Skip if we can't map it
      }
      
      if (parts.length === 2) {
        // 2-part key: e.g., "residentsRecords_main_records"
        const [_, subKey] = parts;
        const subPermission = base[uiKey].sub_permissions[subKey];
        
        if (typeof subPermission === 'object' && subPermission !== null && subPermission.sub_permissions) {
          // It's a nested sub-permission object (like main_records with edit/disable/view)
          subPermission.access = normalizedValue;
          if (normalizedValue) {
            base[uiKey].access = true;
          }
        } else {
          // Simple boolean sub-permission (like document_requests, asset_management, disabled_residents)
          base[uiKey].sub_permissions[subKey] = normalizedValue;
          if (normalizedValue) {
            base[uiKey].access = true;
          }
          
          // Debug log for simple sub-permissions
          if ((uiKey === 'documents' && (subKey === 'document_requests' || subKey === 'document_records')) ||
              (uiKey === 'inventory' && (subKey === 'asset_management' || subKey === 'asset_posts_management' || subKey === 'asset_tracking')) ||
              (uiKey === 'residents' && subKey === 'disabled_residents')) {
            console.log(`✅ mapApiToUiPermissions: Setting simple sub-permission ${uiKey}.${subKey} = ${normalizedValue}`, {
              apiKey,
              uiKey,
              subKey,
              value,
              normalizedValue
            });
          }
        }
      } else if (parts.length >= 3) {
        // 3+ part key: e.g., "residentsRecords_main_records_view"
        // When split by "_", this becomes: ["residentsRecords", "main", "records", "view"] (4 parts)
        // We need: subKey = "main_records", nestedKey = "view"
        
        // Strategy: Try different combinations to find the correct subKey
        // Check available subKeys in the default structure
        const availableSubKeys = Object.keys(base[uiKey].sub_permissions || {});
        let found = false;
        
        // Try combinations: for "residentsRecords_main_records_view"
        // Try: "main" (parts[1]), "main_records" (parts[1]_parts[2]), etc.
        for (let i = 1; i < parts.length - 1; i++) {
          const possibleSubKey = parts.slice(1, i + 1).join('_'); // Combine parts[1] to parts[i]
          const possibleNestedKey = parts.slice(i + 1).join('_'); // Rest is nestedKey
          
          // Check if this subKey exists in the structure
          if (availableSubKeys.includes(possibleSubKey)) {
            const subPerm = base[uiKey].sub_permissions[possibleSubKey];
            
            // Check if it's an object with sub_permissions (nested structure)
            if (typeof subPerm === 'object' && subPerm !== null && subPerm.sub_permissions) {
              // Check if the nestedKey exists in the default structure
              const defaultNestedKeys = Object.keys(subPerm.sub_permissions);
              if (defaultNestedKeys.includes(possibleNestedKey)) {
                // Found the correct mapping!
                subPerm.sub_permissions[possibleNestedKey] = normalizedValue;
                
                // Debug log for residents
                if (uiKey === 'residents' && possibleSubKey === 'main_records') {
                  console.log(`✅ mapApiToUiPermissions: Setting ${possibleSubKey}.${possibleNestedKey} = ${normalizedValue}`, {
                    apiKey,
                    uiKey,
                    subKey: possibleSubKey,
                    nestedKey: possibleNestedKey,
                    value,
                    normalizedValue
                  });
                }
                
                // If nested permission is true, ensure all parent permissions are also true
                if (normalizedValue) {
                  subPerm.access = true;
                  base[uiKey].access = true;
                }
                
                found = true;
                break;
              }
            }
          }
        }
        
        if (!found) {
          console.warn(`⚠️ mapApiToUiPermissions: Could not map ${apiKey}`, {
            parts,
            availableSubKeys,
            uiKey,
            triedCombinations: parts.slice(1).map((_, i) => parts.slice(1, i + 2).join('_'))
          });
        }
      }
    });
    
    console.log('Mapped API to UI permissions result:', base);
    return base;
  };

  // Convert UI permission keys back to backend keys
  const mapUiToApiPermissions = (uiPerms) => {
    const out = {};
    
    console.log('mapUiToApiPermissions - Input UI permissions:', JSON.stringify(uiPerms, null, 2));
    
    Object.entries(uiPerms || {}).forEach(([uiKey, val]) => {
      if (typeof val === 'object' && val !== null) {
        // Handle new permission structure with sub-permissions
        const apiKey = uiToApiMap[uiKey] || uiKey;
        
        if (val.sub_permissions) {
          // Convert sub-permissions to flat structure for backend
          out[apiKey] = Boolean(val.access);
          console.log(`Setting ${apiKey} = ${out[apiKey]}`);
          
          Object.entries(val.sub_permissions).forEach(([subKey, subVal]) => {
            // Check if this sub-permission has nested sub-permissions in the default structure
            const defaultSubPerm = defaultPermissions[uiKey]?.sub_permissions?.[subKey];
            const hasNestedInDefault = typeof defaultSubPerm === 'object' && defaultSubPerm !== null && defaultSubPerm.sub_permissions;
            
            // Check if subVal has nested sub-permissions (e.g., main_records with edit, disable, view)
            if (hasNestedInDefault || (typeof subVal === 'object' && subVal !== null && subVal.sub_permissions)) {
              // Handle nested sub-permissions
              const subModuleKey = `${apiKey}_${subKey}`;
              // Get access value from subVal if it exists, otherwise default to false
              const subAccess = typeof subVal === 'object' && subVal !== null ? Boolean(subVal.access) : Boolean(subVal);
              out[subModuleKey] = subAccess;
              console.log(`Setting ${subModuleKey} = ${out[subModuleKey]}`);
              
              // CRITICAL: Always use default structure keys to ensure we send ALL possible nested permissions
              // This is important even if the parent is false - we need to send all nested permissions
              const allNestedKeys = defaultSubPerm?.sub_permissions 
                ? Object.keys(defaultSubPerm.sub_permissions)
                : (subVal && typeof subVal === 'object' && subVal.sub_permissions ? Object.keys(subVal.sub_permissions) : []);
              
              // Include ALL nested permission keys from default structure, even if they don't exist in current state
              // This ensures we always send complete permission data to the backend
              allNestedKeys.forEach((nestedKey) => {
                const nestedKeyFull = `${apiKey}_${subKey}_${nestedKey}`;
                // Use the value from state if it exists, otherwise default to false
                const nestedVal = subVal && typeof subVal === 'object' && subVal.sub_permissions 
                  ? subVal.sub_permissions[nestedKey] 
                  : undefined;
                const nestedValue = nestedVal !== undefined ? Boolean(nestedVal) : false;
                out[nestedKeyFull] = nestedValue;
                console.log(`Setting ${nestedKeyFull} = ${out[nestedKeyFull]}`);
                
                // IMPORTANT: If any nested permission is true, ensure parent permissions are also true
                if (nestedValue) {
                  // Ensure the sub-module access is true
                  const subModuleKey = `${apiKey}_${subKey}`;
                  out[subModuleKey] = true;
                  console.log(`Auto-enabling parent ${subModuleKey} because ${nestedKeyFull} is true`);
                  
                  // Ensure the main module access is true
                  out[apiKey] = true;
                  console.log(`Auto-enabling main module ${apiKey} because ${nestedKeyFull} is true`);
                }
              });
            } else {
              // Handle simple sub-permissions (boolean)
              const subModuleKey = `${apiKey}_${subKey}`;
              out[subModuleKey] = Boolean(subVal);
              console.log(`Setting ${subModuleKey} = ${out[subModuleKey]}`);
            }
          });
        } else {
          out[apiKey] = Boolean(val.access);
          console.log(`Setting ${apiKey} = ${out[apiKey]} (no sub-permissions)`);
        }
      } else {
        // Handle legacy boolean format
        const normalizedValue = !!val;
        
        if (uiKey === 'dashboard') {
          out.dashboard = normalizedValue;
          console.log(`Setting dashboard = ${out.dashboard}`);
        } else {
          const apiKey = uiToApiMap[uiKey];
          if (apiKey) {
            out[apiKey] = normalizedValue;
            console.log(`Setting ${apiKey} = ${out[apiKey]}`);
          }
        }
      }
    });
    
    // Ensure all values are booleans (not objects or other types)
    Object.keys(out).forEach(key => {
      if (typeof out[key] !== 'boolean') {
        console.warn(`Warning: ${key} is not a boolean, converting:`, out[key]);
        out[key] = Boolean(out[key]);
      }
    });
    
    console.log('Mapped UI to API permissions (flattened):', out);
    console.log('Keys being sent:', Object.keys(out));
    console.log('Residents-related keys:', Object.keys(out).filter(k => k.includes('residents')));
    return out;
  };

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'staff',
    selectedResident: '',
    searchQuery: '',
    department: '',
    contactNumber: '',
    address: '',
    birthdate: '',
    gender: '',
    civilStatus: '',
    position: '',
    permissions: {
      dashboard: { access: true },
      residents: { 
        access: false, 
        sub_permissions: {
          main_records: {
            access: false,
            sub_permissions: {
              edit: false,
              disable: false,
              view: false
            }
          },
          verification: false,
          disabled_residents: false
        }
      },
      documents: { 
        access: false, 
        sub_permissions: {
          document_requests: false,
          document_records: false
        }
      },
      household: { access: false },
      blotter: { access: false },
      treasurer: { access: false },
      officials: { access: false },
      staff: { access: false },
      communication: { access: false },
      social_services: { 
        access: false, 
        sub_permissions: {
          programs: false,
          beneficiaries: false
        }
      },
      command_center: { 
        access: false, 
        sub_permissions: {
          disaster_records: false,
          emergency_hotlines: false
        }
      },
      projects: { access: false },
      inventory: { 
        access: false, 
        sub_permissions: {
          asset_management: false,
          asset_posts_management: false,
          asset_tracking: false
        }
      },
      logs: { access: false }
    }
  });

  const [formErrors, setFormErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [toastMessage, setToastMessage] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const handleSearch = async (searchValue) => {
    if (!searchValue || searchValue.length < 1) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    try {
      setIsSearching(true);
      const response = await axiosInstance.get(`/api/admin/residents/search?search=${searchValue}`);
      setSearchResults(response.data);
    } catch (error) {
      console.error('Error searching residents:', error);
      toast.error(
        error.response?.data?.message ||
        'Failed to search residents. Please try again.'
      );
    } finally {
      setIsSearching(false);
    }
  };

  // Password strength calculation
  const calculatePasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[a-z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    return strength;
  };

  // Generate random password
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, password }));
    setPasswordStrength(calculatePasswordStrength(password));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'searchQuery') {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
      searchTimeout.current = setTimeout(() => {
        handleSearch(value);
      }, 300);
    }
    
    if (name === 'password') {
      setPasswordStrength(calculatePasswordStrength(value));
    }
    
    if (name === 'contactNumber') {
      // Only allow numbers, remove any non-digits
      const onlyNums = value.replace(/\D/g, '');
      
      // Only update if we don't exceed 10 digits
      if (onlyNums.length <= 10) {
        setFormData(prev => ({
          ...prev,
          [name]: onlyNums
        }));
      }
      return;
    }
    
    if (name === 'contactNumber') {
      // Remove any non-digit characters including +63 prefix
      let newValue = value.replace(/^\+63/, '').replace(/\D/g, '');
      
      // Limit to 10 digits
      if (newValue.length > 10) {
        newValue = newValue.slice(0, 10);
      }
      
      setFormData(prev => ({
        ...prev,
        [name]: newValue
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }

    if (formErrors[name]) {
      setFormErrors(prevErrors => ({
        ...prevErrors,
        [name]: ''
      }));
    }
  };

  const fetchStaff = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) {
      setIsRefreshing(true);
    }

    try {
      setLoading(true);
      console.log('🔍 Fetching staff data...');
      
      const response = await axiosInstance.get('/api/admin/staff');
      
      console.log('📡 Staff API Response:', {
        status: response.status,
        data: response.data,
        headers: response.headers
      });
      
      if (response.data && Array.isArray(response.data)) {
        console.log('📋 Processing staff data (direct array format)');
        const mappedStaff = response.data.map(s => {
          console.log(`🔍 Staff ${s.id} (${s.name}) - Raw module_permissions:`, s.module_permissions);
          const mapped = mapApiToUiPermissions(s.module_permissions);
          console.log(`✅ Staff ${s.id} - Mapped permissions:`, mapped);
          console.log(`   Residents main_records view:`, mapped.residents?.sub_permissions?.main_records?.sub_permissions?.view);
          return {
            ...s,
            module_permissions: mapped
          };
        });
        setStaff(mappedStaff);
        console.log('✅ Staff data set (direct array):', mappedStaff.length, 'records');
      } else if (response.data && Array.isArray(response.data.staff)) {
        console.log('📋 Processing staff data (staff property format)');
        const mappedStaff = response.data.staff.map(s => {
          console.log(`🔍 Staff ${s.id} (${s.name}) - Raw module_permissions:`, s.module_permissions);
          const mapped = mapApiToUiPermissions(s.module_permissions);
          console.log(`✅ Staff ${s.id} - Mapped permissions:`, mapped);
          console.log(`   Residents main_records view:`, mapped.residents?.sub_permissions?.main_records?.sub_permissions?.view);
          return {
            ...s,
            module_permissions: mapped
          };
        });
        setStaff(mappedStaff);
        console.log('✅ Staff data set (staff property):', mappedStaff.length, 'records');
      } else {
        console.warn('⚠️ Unexpected staff data format:', response.data);
        setStaff([]);
      }
      
      setLastRefresh(new Date());
      
      if (showRefreshIndicator) {
        setToastMessage({
          type: 'success',
          message: '🔄 Staff data refreshed successfully',
          duration: 2000
        });
      }
    } catch (error) {
      console.error('❌ Error fetching staff:', error);
      console.error('❌ Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers
      });
      
      toast.error(error.response?.data?.message || 'Failed to load staff list');
      setStaff([]);
      
      if (showRefreshIndicator) {
        setToastMessage({
          type: 'error',
          message: '❌ Failed to refresh staff data',
          duration: 4000
        });
      }
    } finally {
      setLoading(false);
      if (showRefreshIndicator) {
        setIsRefreshing(false);
      }
    }
  };

  // Manual refresh function
  const handleManualRefresh = () => {
    fetchStaff(true);
  };

  // Debug function to test API endpoint
  const handleDebugAPI = async () => {
    try {
      console.log('🔧 Debug: Testing staff API endpoint...');
      
      // Test the debug user role endpoint first
      const userResponse = await axiosInstance.get('/api/debug-user-role');
      console.log('👤 Current user info:', userResponse.data);
      
      // Test the staff API endpoint
      const staffResponse = await axiosInstance.get('/api/admin/staff');
      console.log('👥 Staff API response:', staffResponse.data);
      
      toast.success('Debug info logged to console', {
        position: "top-right",
        autoClose: 3000
      });
    } catch (error) {
      console.error('🔧 Debug error:', error);
      toast.error('Debug failed - check console for details');
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  // Debug: Log whenever editingStaff changes
  useEffect(() => {
    if (editingStaff && editingStaff.module_permissions) {
      const residentsMainRecords = editingStaff.module_permissions.residents?.sub_permissions?.main_records;
      if (residentsMainRecords) {
        console.log('🔄 editingStaff state changed - Residents main_records:', {
          access: residentsMainRecords.access,
          edit: residentsMainRecords.sub_permissions?.edit,
          disable: residentsMainRecords.sub_permissions?.disable,
          view: residentsMainRecords.sub_permissions?.view,
          fullStructure: residentsMainRecords
        });
      }
    }
  }, [editingStaff]);

  const handleDeactivate = async (staffId) => {
    try {
      await axiosInstance.put(`/api/admin/staff/${staffId}/deactivate`);
      toast.success('Staff member deactivated successfully');
      fetchStaff();
    } catch (error) {
      console.error('Error deactivating staff:', error);
      toast.error(error.response?.data?.message || 'Failed to deactivate staff member');
    }
  };

  const handleUpdatePermissions = async () => {
    if (!editingStaff) return;

    try {
      // Map UI keys to backend keys for saving
      const currentPermissions = editingStaff.module_permissions || {};
      
      console.log('=== PERMISSION UPDATE DEBUG ===');
      console.log('1. Current editingStaff.module_permissions:', JSON.stringify(currentPermissions, null, 2));
      console.log('2. Residents module permissions:', JSON.stringify(currentPermissions.residents, null, 2));
      console.log('3. Main records permissions:', JSON.stringify(currentPermissions.residents?.sub_permissions?.main_records, null, 2));
      
      const formattedPermissions = mapUiToApiPermissions(currentPermissions);

      console.log('4. Formatted permissions to send:', JSON.stringify(formattedPermissions, null, 2));
      console.log('5. Residents-related keys:', Object.keys(formattedPermissions).filter(k => k.includes('residents')));

      const response = await axiosInstance.put(`/api/admin/staff/${editingStaff.id}/permissions`, {
        module_permissions: formattedPermissions,
        staff_id: editingStaff.id
      });
      
      console.log('6. Backend response:', response.data);

      // Store staff name before clearing editingStaff
      const staffName = editingStaff?.name || 'the staff member';

      // Close the permissions modal
      setShowPermissionsModal(false);
      setEditingStaff(null);
      
      // Show success modal
      setSuccessStaffName(staffName);
      setShowSuccessModal(true);
      
      // Refresh from server to ensure persistence and verify what was saved
      await fetchStaff();
      
      // Verify the saved permissions
      const updatedStaff = staff.find(s => s.id === editingStaff.id);
      if (updatedStaff) {
        console.log('7. Permissions after refresh:', JSON.stringify(updatedStaff.module_permissions, null, 2));
        console.log('8. Residents permissions after refresh:', JSON.stringify(updatedStaff.module_permissions?.residents, null, 2));
      }
    } catch (error) {
      console.error('Error updating permissions:', error);
      console.error('Error response:', error.response?.data);
      
      let errorMessage = 'An error occurred while updating permissions';
      
      if (error.response) {
        console.error('Error response details:', {
          data: error.response.data,
          status: error.response.status,
          headers: error.response.headers
        });

        // Handle validation errors (422)
        if (error.response.status === 422) {
          const errors = error.response.data.errors || error.response.data.error || [];
          if (Array.isArray(errors) && errors.length > 0) {
            errorMessage = errors[0];
          } else if (typeof errors === 'string') {
            errorMessage = errors;
          } else if (error.response.data.message) {
            errorMessage = error.response.data.message;
          } else {
            errorMessage = 'Validation failed. Please check the permissions format.';
          }
        } else if (error.response.status === 403) {
          if (error.response.data.error === 'INSUFFICIENT_PERMISSIONS') {
            errorMessage = `Access denied: You need admin privileges to update staff permissions. Your role: ${error.response.data.user_role || 'unknown'}`;
          } else {
            errorMessage = 'Access denied: You do not have permission to perform this action';
          }
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        } else if (error.response.data.errors) {
          const errors = Object.values(error.response.data.errors).flat();
          errorMessage = errors[0] || errorMessage;
        }
      }
      
      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 5000,
      });
    }
  };

  const validateForm = () => {
    const errors = {};
    
    // Required fields validation
    if (!formData.name.trim()) errors.name = 'Name is required';
    if (!formData.email.trim()) errors.email = 'Email is required';
    else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(formData.email)) {
      errors.email = 'Invalid email format';
    }
    
    // Password validation
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      errors.password = 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
    }
    
    // Required fields with trimming
    if (!formData.department.trim()) errors.department = 'Department is required';
    if (!formData.position.trim()) errors.position = 'Position is required';
    if (!formData.contactNumber) {
      errors.contactNumber = 'Contact number is required';
    } else if (formData.contactNumber.length !== 10) {
      errors.contactNumber = 'Contact number must be exactly 10 digits';
    } else if (!/^\d+$/.test(formData.contactNumber)) {
      errors.contactNumber = 'Contact number must contain only digits';
    }
    if (!formData.birthdate) errors.birthdate = 'Birth date is required';
    if (!formData.gender) errors.gender = 'Gender is required';
    if (!formData.civilStatus) errors.civilStatus = 'Civil status is required';
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    if (e) {
      e.preventDefault();
    }
    
    if (!validateForm()) {
      return;
    }

    try {
      // Get CSRF cookie
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
      
      // Format the data for submission
      const modulePermissions = {};
      Object.entries(formData.permissions).forEach(([key, value]) => {
        if (typeof value === 'object' && value.hasOwnProperty('access')) {
          modulePermissions[key] = value.access;
          if (value.sub_permissions) {
            Object.entries(value.sub_permissions).forEach(([subKey, subValue]) => {
              modulePermissions[`${key}_${subKey}`] = subValue;
            });
          }
        } else {
          modulePermissions[key] = value;
        }
      });

      // Make the API call
      const result = await axiosInstance.post('/api/admin/staff', {
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role: 'staff',
        department: formData.department.trim(),
        position: formData.position,
        contactNumber: formData.contactNumber ? formData.contactNumber.replace(/\D/g, '') : '',
        birthdate: formData.birthdate,
        gender: formData.gender,
        civilStatus: formData.civilStatus,
        address: formData.address ? formData.address.trim() : '',
        selectedResident: formData.selectedResident || null,
        modulePermissions
      });

      // Check if verification is required
      if (result.data?.requires_verification) {
        // Show verification modal instead of success message
        setShowVerificationModal(true);
        setVerificationData({
          userId: result.data.user_id,
          email: result.data.email,
          staffName: formData.name
        });
      } else {
        // Show success message for immediate success
        toast.success(result.data?.message || 'Staff account created successfully', {
          position: "top-right",
          autoClose: 3000,
        });
      }

      // Reset UI state
      setShowModal(false);
      setShowConfirmModal(false);
      await fetchStaff();

      // Reset form data
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'staff',
        selectedResident: '',
        searchQuery: '',
        department: '',
        contactNumber: '',
        position: '',
        birthdate: '',
        gender: '',
        civilStatus: '',
        address: '',
        permissions: { ...defaultPermissions }
      });
      
      setPasswordStrength(0);
      setShowPassword(false);
    } catch (error) {
      // Log and show error message
      console.error('Error creating staff account:', error);
      const errorMessage = error.response?.data?.message || 'Failed to create staff account';
      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 5000
      });
    }
  };

  const handleConfirmSubmit = async () => {
    await handleSubmit();
    setShowConfirmModal(false);
  };

  // Handle verification success
  const handleVerificationSuccess = (data) => {
    setShowVerificationModal(false);
    setVerificationData(null);
    toast.success(`Staff account for ${verificationData?.staffName} has been verified successfully!`, {
      position: "top-right",
      autoClose: 5000,
    });
  };

  // Handle verification modal close
  const handleVerificationClose = () => {
    setShowVerificationModal(false);
    setVerificationData(null);
  };

  // Auto-hide toast messages
  React.useEffect(() => {
    if (toastMessage && toastMessage.duration > 0) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, toastMessage.duration);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Toast Notification Component
  const ToastNotification = ({ message, type, onClose }) => (
    <div className={`fixed top-24 right-6 z-50 max-w-md rounded-xl shadow-2xl border-2 p-4 transition-all duration-500 transform ${
      message ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
    } ${
      type === 'success'
        ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 text-green-800'
        : type === 'loading'
        ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 text-blue-800'
        : 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200 text-red-800'
    }`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {type === 'success' && <CheckIcon className="w-5 h-5 text-green-600" />}
          {type === 'loading' && <ArrowPathIcon className="w-5 h-5 text-blue-600 animate-spin" />}
          {type === 'error' && <ExclamationCircleIcon className="w-5 h-5 text-red-600" />}
        </div>
        <div className="flex-1">
          <div className="font-semibold text-sm">{message}</div>
        </div>
        {type !== 'loading' && (
          <button
            onClick={onClose}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Toast Notification */}
      {toastMessage && (
        <ToastNotification
          message={toastMessage.message}
          type={toastMessage.type}
          onClose={() => setToastMessage(null)}
        />
      )}
      
      <main className="bg-gradient-to-br from-green-50 to-emerald-50 min-h-screen ml-0 lg:ml-64 pt-20 lg:pt-36 px-4 pb-16 font-sans">
        <div className="w-full max-w-[98%] mx-auto space-y-8 px-2 lg:px-4">
          {/* Enhanced Header */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full shadow-xl mb-4">
              <UserGroupIcon className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent tracking-tight">
              Staff Management System
            </h1>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto leading-relaxed">
              Comprehensive management system for staff accounts, permissions, and access control with real-time monitoring.
            </p>
            
            {/* Help System Buttons */}
            <div className="flex flex-wrap justify-center gap-4 mt-8">
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-600 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 hover:text-green-700 transition-colors duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
              >
                <BookOpenIcon className="w-4 h-4" />
                Help Guide
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 hover:text-blue-700 transition-colors duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
              >
                <PlayIcon className="w-4 h-4" />
                Quick Start
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-600 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 hover:text-purple-700 transition-colors duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
              >
                <QuestionMarkCircleIcon className="w-4 h-4" />
                FAQ
              </button>
            </div>
          </div>

          {/* Enhanced Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <StatCard
              label="Total Staff"
              value={staff.length}
              icon={<UserGroupIcon className="w-6 h-6 text-green-600" />}
              iconBg="bg-green-100"
            />
            <StatCard
              label="Active Staff"
              value={staff.filter(s => s.active).length}
              icon={<CheckIcon className="w-6 h-6 text-emerald-600" />}
              iconBg="bg-emerald-100"
            />
            <StatCard
              label="Departments"
              value={new Set(staff.map(s => s.department)).size}
              icon={<PencilIcon className="w-6 h-6 text-blue-600" />}
              iconBg="bg-blue-100"
            />
          </div>


          {/* Enhanced Table */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden w-full">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4">
              <div className="flex justify-between items-center">
                <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                  <UserGroupIcon className="w-5 h-5" />
                  Staff Members ({staff.length})
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={handleDebugAPI}
                    className="bg-yellow-500/20 hover:bg-yellow-500/30 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-300 transform hover:scale-105 flex items-center gap-2 backdrop-blur-sm border border-yellow-500/30"
                    title="Debug API calls"
                  >
                    🔧 Debug
                  </button>
                  <button
                    onClick={handleManualRefresh}
                    className="bg-blue-500/20 hover:bg-blue-500/30 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-300 transform hover:scale-105 flex items-center gap-2 backdrop-blur-sm border border-blue-500/30"
                    title="Refresh staff data"
                  >
                    <ArrowPathIcon className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                  <button
                    onClick={() => setShowModal(true)}
                    className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 transform hover:scale-105 flex items-center gap-2 backdrop-blur-sm border border-white/30"
                  >
                    <PlusIcon className="w-4 h-4" />
                    Create Staff Account
                  </button>
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto w-full">
              <table className="w-full text-sm min-w-full">
                <thead className="bg-gradient-to-r from-slate-50 via-blue-50 to-indigo-50 border-b-2 border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left font-bold text-slate-700 text-sm uppercase tracking-wider min-w-[200px]">
                      <div className="flex items-center gap-2">
                        <UserGroupIcon className="w-4 h-4 text-slate-500" />
                        Name
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left font-bold text-slate-700 text-sm uppercase tracking-wider min-w-[220px]">
                      <div className="flex items-center gap-2">
                        <PencilIcon className="w-4 h-4 text-slate-500" />
                        Email
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left font-bold text-slate-700 text-sm uppercase tracking-wider min-w-[180px]">
                      <div className="flex items-center gap-2">
                        <UserGroupIcon className="w-4 h-4 text-slate-500" />
                        Department
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left font-bold text-slate-700 text-sm uppercase tracking-wider min-w-[150px]">
                      <div className="flex items-center gap-2">
                        <PencilIcon className="w-4 h-4 text-slate-500" />
                        Position
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left font-bold text-slate-700 text-sm uppercase tracking-wider min-w-[120px]">
                      <div className="flex items-center gap-2">
                        <CheckIcon className="w-4 h-4 text-slate-500" />
                        Status
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left font-bold text-slate-700 text-sm uppercase tracking-wider min-w-[180px]">
                      <div className="flex items-center gap-2">
                        <PencilIcon className="w-4 h-4 text-slate-500" />
                        Actions
                      </div>
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center">
                            <UserGroupIcon className="w-10 h-10 text-slate-400" />
                          </div>
                          <div className="text-center">
                            <h3 className="text-lg font-semibold text-slate-600 mb-2">Loading Staff Data</h3>
                            <p className="text-slate-500 text-sm">Please wait while we fetch the staff information...</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : staff.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center">
                            <UserGroupIcon className="w-10 h-10 text-slate-400" />
                          </div>
                          <div className="text-center">
                            <h3 className="text-lg font-semibold text-slate-600 mb-2">No Staff Members Found</h3>
                            <p className="text-slate-500 text-sm max-w-md">
                              No staff members have been added yet. Create the first staff account to get started.
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    staff.map((member, index) => (
                      <tr 
                        key={member.id} 
                        className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-300 group border-b border-slate-100"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center">
                              <span className="text-lg font-semibold text-green-800">
                                {member.name[0].toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 text-sm">{member.name}</div>
                              <div className="text-xs text-slate-500">{member.role}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-slate-700 text-sm font-medium">{member.email}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 px-3 py-1.5 rounded-full text-xs font-semibold border border-blue-200">
                            {member.department}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 px-3 py-1.5 rounded-full text-xs font-semibold border border-purple-200">
                            {member.position}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                            member.active 
                              ? 'bg-green-100 text-green-800 border-green-200' 
                              : 'bg-red-100 text-red-800 border-red-200'
                          }`}>
                            {member.active ? (
                              <>
                                <CheckIcon className="w-4 h-4" />
                                Active
                              </>
                            ) : (
                              <>
                                <XMarkIcon className="w-4 h-4" />
                                Inactive
                              </>
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => {
                                const initialPermissions = member.module_permissions || {};
                                console.log('Opening permissions modal for:', member.name);
                                console.log('Initial permissions:', JSON.stringify(initialPermissions, null, 2));
                                
                                // Check if permissions are in API format (flat keys) or UI format (nested structure)
                                // API format has keys like "residentsRecords_main_records_view"
                                // UI format has nested structure like { residents: { sub_permissions: { main_records: { sub_permissions: { view: true } } } } }
                                const hasApiFormatKeys = Object.keys(initialPermissions).some(key => 
                                  key.includes('_') && (key.includes('Records') || key.includes('Management') || key === 'dashboard')
                                );
                                
                                let uiPermissions;
                                if (hasApiFormatKeys) {
                                  // Data is in API format (flat keys), convert to UI format
                                  console.log('Detected API format, converting to UI format');
                                  uiPermissions = mapApiToUiPermissions(initialPermissions);
                                } else {
                                  // Data is already in UI format, use as-is
                                  console.log('Detected UI format, using as-is');
                                  uiPermissions = initialPermissions;
                                }
                                
                                console.log('UI format permissions:', JSON.stringify(uiPermissions, null, 2));
                                console.log('Residents permissions:', JSON.stringify(uiPermissions.residents, null, 2));
                                console.log('Main records nested:', JSON.stringify(uiPermissions.residents?.sub_permissions?.main_records, null, 2));
                                
                                // CRITICAL DEBUG: Check what we have before normalization
                                if (uiPermissions.residents?.sub_permissions?.main_records) {
                                  console.log('🔍 BEFORE normalization - Residents main_records:', {
                                    access: uiPermissions.residents.sub_permissions.main_records.access,
                                    hasSubPerms: !!uiPermissions.residents.sub_permissions.main_records.sub_permissions,
                                    edit: uiPermissions.residents.sub_permissions.main_records.sub_permissions?.edit,
                                    disable: uiPermissions.residents.sub_permissions.main_records.sub_permissions?.disable,
                                    view: uiPermissions.residents.sub_permissions.main_records.sub_permissions?.view,
                                    allNested: uiPermissions.residents.sub_permissions.main_records.sub_permissions
                                  });
                                }
                                
                                // Now ensure all nested permissions from default structure exist
                                // This merges the existing values with the default structure
                                const normalizedPermissions = JSON.parse(JSON.stringify(defaultPermissions)); // Start with defaults
                                
                                // Deep merge: preserve existing values, add missing keys from defaults
                                Object.keys(defaultPermissions).forEach(uiKey => {
                                  const defaultPerm = defaultPermissions[uiKey];
                                  const existingPerm = uiPermissions[uiKey];
                                  
                                  if (defaultPerm.sub_permissions) {
                                    // Has sub-permissions
                                    normalizedPermissions[uiKey] = {
                                      access: existingPerm?.access ?? false,
                                      sub_permissions: {}
                                    };
                                    
                                    Object.keys(defaultPerm.sub_permissions).forEach(subKey => {
                                      const defaultSubPerm = defaultPerm.sub_permissions[subKey];
                                      const existingSubPerm = existingPerm?.sub_permissions?.[subKey];
                                      
                                      if (typeof defaultSubPerm === 'object' && defaultSubPerm.sub_permissions) {
                                        // Nested sub-permissions (e.g., main_records with edit/disable/view)
                                        normalizedPermissions[uiKey].sub_permissions[subKey] = {
                                          access: existingSubPerm?.access ?? false,
                                          sub_permissions: {}
                                        };
                                        
                                        // Preserve all nested permission values
                                        Object.keys(defaultSubPerm.sub_permissions).forEach(nestedKey => {
                                          const existingNestedValue = existingSubPerm?.sub_permissions?.[nestedKey];
                                          const finalValue = existingNestedValue !== undefined ? Boolean(existingNestedValue) : false;
                                          normalizedPermissions[uiKey].sub_permissions[subKey].sub_permissions[nestedKey] = finalValue;
                                          
                                          // Debug log for residents main_records
                                          if (uiKey === 'residents' && subKey === 'main_records') {
                                            console.log(`Normalizing nested ${nestedKey}:`, {
                                              existingNestedValue,
                                              finalValue,
                                              existingSubPerm: existingSubPerm,
                                              hasSubPerms: !!existingSubPerm?.sub_permissions
                                            });
                                          }
                                        });
                                      } else {
                                        // Simple boolean sub-permission (like document_requests, asset_management, disabled_residents)
                                        // Ensure it's always a boolean value
                                        const finalSubValue = existingSubPerm !== undefined 
                                          ? Boolean(existingSubPerm) 
                                          : false;
                                        normalizedPermissions[uiKey].sub_permissions[subKey] = finalSubValue;
                                        
                                        // Debug log for simple sub-permissions
                                        if ((uiKey === 'documents' && (subKey === 'document_requests' || subKey === 'document_records')) ||
                                            (uiKey === 'inventory' && (subKey === 'asset_management' || subKey === 'asset_posts_management' || subKey === 'asset_tracking')) ||
                                            (uiKey === 'residents' && subKey === 'disabled_residents')) {
                                          console.log(`Normalizing simple sub-permission ${uiKey}.${subKey}:`, {
                                            existingSubPerm,
                                            finalSubValue,
                                            type: typeof existingSubPerm
                                          });
                                        }
                                      }
                                    });
                                  } else {
                                    // Simple permission (like dashboard)
                                    normalizedPermissions[uiKey] = {
                                      access: existingPerm?.access ?? false
                                    };
                                  }
                                });
                                
                                console.log('Final normalized permissions:', JSON.stringify(normalizedPermissions, null, 2));
                                console.log('Residents main_records after normalization:', JSON.stringify(normalizedPermissions.residents?.sub_permissions?.main_records, null, 2));
                                
                                // CRITICAL: Verify the nested permissions are preserved
                                const residentsMainRecords = normalizedPermissions.residents?.sub_permissions?.main_records;
                                if (residentsMainRecords) {
                                  console.log('✅ Residents main_records nested permissions:', {
                                    edit: residentsMainRecords.sub_permissions?.edit,
                                    disable: residentsMainRecords.sub_permissions?.disable,
                                    view: residentsMainRecords.sub_permissions?.view,
                                    access: residentsMainRecords.access
                                  });
                                }
                                
                                setEditingStaff({
                                  ...member,
                                  permissions: normalizedPermissions,
                                  module_permissions: normalizedPermissions
                                });
                                setShowPermissionsModal(true);
                              }}
                              className="text-green-600 hover:text-green-800 cursor-pointer p-2 rounded-lg hover:bg-green-50 transition-all duration-300 transform hover:scale-110"
                              title="Edit Permissions"
                            >
                              <PencilIcon className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDeactivate(member.id)}
                              className="text-red-600 hover:text-red-800 cursor-pointer p-2 rounded-lg hover:bg-red-50 transition-all duration-300 transform hover:scale-110"
                              title="Deactivate Staff"
                            >
                              <XMarkIcon className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Edit Permissions Modal */}
      {showPermissionsModal && editingStaff && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl transform transition-all max-h-[90vh] overflow-hidden">
            <div className="border-b border-gray-200">
              <div className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Edit Module Permissions</h2>
                    <p className="mt-1 text-sm text-gray-500">Editing permissions for {editingStaff.name}</p>
                  </div>
                  <button
                    onClick={() => setShowPermissionsModal(false)}
                    className="text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 rounded-full p-1"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 max-h-[calc(90vh-120px)] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.entries(defaultPermissions).map(([moduleKey, moduleConfig]) => {
                  const hasSubPermissions = moduleConfig.sub_permissions;
                  const currentPermission = editingStaff.module_permissions?.[moduleKey] || { access: false };
                  
                  return (
                    <div key={moduleKey} className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-green-300 transition-all duration-200 shadow-sm hover:shadow-md">
                      {/* Module Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-lg">
                              {moduleKey.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 capitalize">
                              {moduleKey.replace(/_/g, ' ')}
                            </h3>
                            <p className="text-xs text-gray-500">
                              {hasSubPermissions ? 'Multiple sections' : 'Single module'}
                            </p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(currentPermission.access)}
                            onChange={(e) => {
                              const newAccess = e.target.checked;
                              setEditingStaff(prev => ({
                                ...prev,
                                module_permissions: {
                                  ...(prev.module_permissions || {}),
                                  [moduleKey]: {
                                    ...currentPermission,
                                    access: newAccess,
                                    // If enabling module, enable all sub-permissions; if disabling, disable all
                                    sub_permissions: hasSubPermissions ? 
                                      Object.keys(moduleConfig.sub_permissions).reduce((acc, subKey) => {
                                        const subDefault = moduleConfig.sub_permissions[subKey];
                                        // Check if this sub-permission has nested sub-permissions
                                        if (typeof subDefault === 'object' && subDefault !== null && subDefault.sub_permissions) {
                                          // Handle nested sub-permissions
                                          acc[subKey] = {
                                            access: newAccess,
                                            sub_permissions: Object.keys(subDefault.sub_permissions).reduce((nestedAcc, nestedKey) => {
                                              nestedAcc[nestedKey] = newAccess;
                                              return nestedAcc;
                                            }, {})
                                          };
                                        } else {
                                          // Handle simple boolean sub-permission
                                        acc[subKey] = newAccess;
                                        }
                                        return acc;
                                      }, {}) : undefined
                                  }
                                }
                              }));
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                        </label>
                      </div>

                      {/* Sub-permissions */}
                      {hasSubPermissions && currentPermission.access && (
                        <div className="space-y-3 mt-4 pt-4 border-t border-gray-100">
                          <h4 className="text-sm font-medium text-gray-700 mb-3">Sub-sections:</h4>
                          {Object.entries(moduleConfig.sub_permissions).map(([subKey, subDefault]) => {
                            // CRITICAL: Read from editingStaff state directly to ensure we get latest values
                            const currentModulePerm = editingStaff.module_permissions?.[moduleKey];
                            const subPermission = currentModulePerm?.sub_permissions?.[subKey];
                            const subLabel = subKey.replace(/_/g, ' ');
                            
                            // Check if this sub-permission has nested sub-permissions
                            const hasNestedSubPermissions = typeof subDefault === 'object' && subDefault !== null && subDefault.sub_permissions;
                            
                            // Get the checked value - for simple sub-permissions, read the boolean value directly
                            // For nested sub-permissions, read the access property
                            const checkedValue = hasNestedSubPermissions 
                              ? Boolean(currentModulePerm?.sub_permissions?.[subKey]?.access) 
                              : Boolean(currentModulePerm?.sub_permissions?.[subKey]);
                            
                            // Debug log for simple sub-permissions that aren't working
                            if (!hasNestedSubPermissions && (subKey === 'document_requests' || subKey === 'document_records' || subKey === 'asset_management' || subKey === 'asset_posts_management' || subKey === 'asset_tracking' || subKey === 'disabled_residents')) {
                              console.log(`Reading simple sub-permission ${moduleKey}.${subKey}:`, {
                                checkedValue,
                                fromState: currentModulePerm?.sub_permissions?.[subKey],
                                fullPath: `editingStaff.module_permissions.${moduleKey}.sub_permissions.${subKey}`
                              });
                            }
                            
                            return (
                              <div key={subKey} className="bg-gray-50 rounded-lg p-3">
                                {/* Main sub-permission toggle */}
                                <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                    <span className="text-sm font-medium text-gray-700 capitalize">{subLabel}</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={checkedValue}
                                    onChange={(e) => {
                                        const newValue = e.target.checked;
                                        // Use the same simple pattern as social_services - read from prev state
                                        setEditingStaff(prev => {
                                          const prevModulePerm = prev.module_permissions?.[moduleKey] || { access: false, sub_permissions: {} };
                                          
                                          if (hasNestedSubPermissions) {
                                            // Handle nested sub-permissions (like main_records with edit/disable/view)
                                            // When toggling Main Records: if ON, enable all nested; if OFF, disable all
                                            const updatedNested = Object.keys(subDefault.sub_permissions).reduce((acc, nestedKey) => {
                                              acc[nestedKey] = newValue; // Set all nested permissions to the same value as Main Records toggle
                                              return acc;
                                            }, {});
                                            
                                            return {
                                              ...prev,
                                              module_permissions: {
                                                ...(prev.module_permissions || {}),
                                                [moduleKey]: {
                                                  ...prevModulePerm,
                                                  access: newValue ? true : prevModulePerm.access, // Keep module access if enabling
                                                  sub_permissions: {
                                                    ...(prevModulePerm.sub_permissions || {}),
                                                    [subKey]: {
                                                      access: newValue,
                                                      sub_permissions: updatedNested
                                                    }
                                                  }
                                                }
                                              }
                                            };
                                          } else {
                                            // Handle simple boolean sub-permission (like programs, beneficiaries, document_requests, asset_management)
                                            // If enabling a sub-permission, ensure the parent module is also enabled
                                            const updatedModuleAccess = newValue ? true : prevModulePerm.access;
                                            
                                            return {
                                              ...prev,
                                              module_permissions: {
                                                ...(prev.module_permissions || {}),
                                                [moduleKey]: {
                                                  ...prevModulePerm,
                                                  access: updatedModuleAccess,
                                                  sub_permissions: {
                                                    ...(prevModulePerm.sub_permissions || {}),
                                                    [subKey]: newValue
                                                  }
                                                }
                                              }
                                            };
                                          }
                                        });
                                    }}
                                    className="sr-only peer"
                                  />
                                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                                  </label>
                                </div>
                                
                                {/* Nested sub-permissions (e.g., main_records: edit, disable, view) */}
                                {/* Always show nested permissions if they exist in the structure, so users can toggle them individually */}
                                {hasNestedSubPermissions && (
                                  <div className="ml-6 mt-3 space-y-2 pt-3 border-t border-gray-200">
                                    {Object.entries(subDefault.sub_permissions).map(([nestedKey, nestedDefault]) => {
                                      // CRITICAL: Read from editingStaff state directly, not from the closure variable
                                      // This ensures we always get the latest state value
                                      const currentModulePerm = editingStaff.module_permissions?.[moduleKey];
                                      const currentSubPerm = currentModulePerm?.sub_permissions?.[subKey];
                                      const nestedPermission = currentSubPerm?.sub_permissions?.[nestedKey] ?? false;
                                      const nestedLabel = nestedKey.replace(/_/g, ' ');
                                      
                                      // Debug log to see what we're reading
                                      if (moduleKey === 'residents' && subKey === 'main_records') {
                                        console.log(`Reading nested permission ${nestedKey}:`, {
                                          nestedPermission,
                                          fromState: editingStaff.module_permissions?.residents?.sub_permissions?.main_records?.sub_permissions?.[nestedKey],
                                          fullPath: `editingStaff.module_permissions.${moduleKey}.sub_permissions.${subKey}.sub_permissions.${nestedKey}`
                                        });
                                      }
                                      
                                      return (
                                        <div key={nestedKey} className="flex items-center justify-between p-2 bg-white rounded-md">
                                          <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                                            <span className="text-xs text-gray-600 capitalize">{nestedLabel}</span>
                                          </div>
                                          <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={Boolean(nestedPermission)}
                                              onChange={(e) => {
                                                const newValue = e.target.checked;
                                                console.log(`Toggling ${moduleKey}.${subKey}.${nestedKey} to ${newValue}`);
                                                
                                                setEditingStaff(prev => {
                                                  // Get the default structure for this sub-permission
                                                  const defaultSubPerm = defaultPermissions[moduleKey]?.sub_permissions?.[subKey];
                                                  const defaultNested = defaultSubPerm?.sub_permissions || {};
                                                  
                                                  // CRITICAL: Read current state from prev, not from closure variables
                                                  const prevModulePerm = prev.module_permissions?.[moduleKey] || { access: false, sub_permissions: {} };
                                                  const prevSubPerm = prevModulePerm.sub_permissions?.[subKey] || {};
                                                  const prevNested = (typeof prevSubPerm === 'object' && prevSubPerm !== null && prevSubPerm.sub_permissions) 
                                                    ? prevSubPerm.sub_permissions 
                                                    : {};
                                                  
                                                  // Preserve all existing nested permissions and update only the one being toggled
                                                  const updatedNested = {};
                                                  
                                                  // First, include all keys from default structure
                                                  Object.keys(defaultNested).forEach(key => {
                                                    if (key === nestedKey) {
                                                      // Update the one being toggled
                                                      updatedNested[key] = newValue;
                                                    } else {
                                                      // Preserve existing value from state or default to false
                                                      updatedNested[key] = prevNested[key] !== undefined ? prevNested[key] : false;
                                                    }
                                                  });
                                                  
                                                  // Also include any keys that exist in current but not in default (for safety)
                                                  Object.keys(prevNested).forEach(key => {
                                                    if (!updatedNested.hasOwnProperty(key)) {
                                                      updatedNested[key] = prevNested[key];
                                                    }
                                                  });
                                                  
                                                  // Determine if sub-permission access should be true
                                                  const hasAnyNestedTrue = Object.values(updatedNested).some(v => v === true);
                                                  const subAccess = newValue ? true : (hasAnyNestedTrue ? (prevSubPerm.access ?? false) : false);
                                                  
                                                  const updatedPermission = {
                                                    ...prevModulePerm,
                                                    sub_permissions: {
                                                      ...(prevModulePerm.sub_permissions || {}),
                                                      [subKey]: {
                                                        ...(typeof prevSubPerm === 'object' && prevSubPerm !== null ? prevSubPerm : {}),
                                                        access: subAccess,
                                                        sub_permissions: updatedNested
                                                      }
                                                    }
                                                  };
                                                  
                                                  // If enabling a nested permission, ensure module access is true
                                                  if (newValue) {
                                                    updatedPermission.access = true;
                                                  }
                                                  
                                                  const updated = {
                                                    ...prev,
                                                    module_permissions: {
                                                      ...(prev.module_permissions || {}),
                                                      [moduleKey]: updatedPermission
                                                    }
                                                  };
                                                  
                                                  console.log('✅ Updated state after toggle:', JSON.stringify(updated.module_permissions[moduleKey], null, 2));
                                                  console.log('✅ Nested permissions preserved:', Object.keys(updatedNested));
                                                  console.log('✅ New value for', nestedKey, ':', newValue);
                                                  return updated;
                                                });
                                              }}
                                              className="sr-only peer"
                                            />
                                            <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-green-500"></div>
                                </label>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Module Description */}
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <p className="text-xs text-gray-500">
                          {hasSubPermissions 
                            ? `Control access to ${moduleKey.replace(/_/g, ' ')} module and its sub-sections`
                            : `Control access to ${moduleKey.replace(/_/g, ' ')} module`
                          }
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowPermissionsModal(false)}
                  className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdatePermissions}
                  className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Staff Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl transform transition-all overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-green-600 to-green-700 px-8 py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-white">Create Staff Account</h2>
                  <p className="mt-2 text-green-100">Add a new staff member to the system</p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-green-200 hover:text-white focus:outline-none focus:ring-2 focus:ring-green-300 focus:ring-offset-2 rounded-full p-2 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="px-8 py-6 max-h-[calc(100vh-200px)] overflow-y-auto">
              <form onSubmit={(e) => { e.preventDefault(); setShowConfirmModal(true); }} className="space-y-8">
                
                {/* Search Resident Section */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-200 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900">Search Resident</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">Search for an existing resident to auto-fill their information</p>
                  <div className="relative">
                    <input
                      type="text"
                      name="searchQuery"
                      value={formData.searchQuery}
                      onChange={handleInputChange}
                      placeholder="Search resident by name or ID..."
                      className="w-full rounded-xl border-gray-300 pl-4 pr-12 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500 shadow-sm"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                      {isSearching ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
                      ) : (
                        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <div className="mt-4">
                      <div className="bg-white shadow-lg rounded-xl divide-y divide-gray-100 max-h-48 overflow-y-auto">
                        {searchResults.map((resident) => (
                          <button
                            key={resident.id}
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({
                                ...prev,
                                selectedResident: resident.id,
                                name: resident.name,
                                address: resident.address || '',
                                contactNumber: resident.contact_number ? `+63${resident.contact_number}` : '',
                                gender: resident.gender || '',
                                birthdate: resident.birthdate || '',
                                civilStatus: resident.civil_status || ''
                              }));
                              setSearchResults([]);
                              toast.success('Resident information auto-filled!');
                            }}
                            className="w-full px-6 py-4 flex items-center hover:bg-green-50 transition-colors text-left group"
                          >
                            <div className="flex-shrink-0">
                              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center group-hover:from-green-200 group-hover:to-green-300 transition-colors">
                                <span className="text-lg font-semibold text-green-800">
                                  {resident.name[0].toUpperCase()}
                                </span>
                              </div>
                            </div>
                            <div className="ml-4 flex-1">
                              <p className="text-base font-medium text-gray-900">{resident.name}</p>
                              <p className="text-sm text-gray-500">ID: {resident.resident_id}</p>
                            </div>
                            <div className="flex-shrink-0">
                              <CheckIcon className="h-5 w-5 text-green-500" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Personal Information Section */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900">Personal Information</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className={`w-full rounded-xl border px-4 py-3 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 shadow-sm transition-colors
                          ${formErrors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
                        placeholder="Enter full name"
                      />
                      {formErrors.name && (
                        <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                          <XMarkIcon className="h-4 w-4" />
                          {formErrors.name}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Birth Date</label>
                      <input
                        type="date"
                        name="birthdate"
                        value={formData.birthdate}
                        onChange={handleInputChange}
                        className={`w-full rounded-xl border px-4 py-3 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 shadow-sm transition-colors
                          ${formErrors.birthdate ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
                      />
                      {formErrors.birthdate && (
                        <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                          <XMarkIcon className="h-4 w-4" />
                          {formErrors.birthdate}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Gender</label>
                      <select
                        name="gender"
                        value={formData.gender}
                        onChange={handleInputChange}
                        className={`w-full rounded-xl border px-4 py-3 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 shadow-sm transition-colors
                          ${formErrors.gender ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
                      >
                        <option value="">Select Gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                      {formErrors.gender && (
                        <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                          <XMarkIcon className="h-4 w-4" />
                          {formErrors.gender}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Civil Status</label>
                      <select
                        name="civilStatus"
                        value={formData.civilStatus}
                        onChange={handleInputChange}
                        className={`w-full rounded-xl border px-4 py-3 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 shadow-sm transition-colors
                          ${formErrors.civilStatus ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
                      >
                        <option value="">Select Civil Status</option>
                        <option value="single">Single</option>
                        <option value="married">Married</option>
                        <option value="divorced">Divorced</option>
                        <option value="widowed">Widowed</option>
                      </select>
                      {formErrors.civilStatus && (
                        <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                          <XMarkIcon className="h-4 w-4" />
                          {formErrors.civilStatus}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Address</label>
                    <textarea
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      rows="3"
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 shadow-sm transition-colors resize-none"
                      placeholder="Enter complete address"
                    />
                  </div>
                </div>

                {/* Account Information Section */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900">Account Information</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className={`w-full rounded-xl border px-4 py-3 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 shadow-sm transition-colors
                          ${formErrors.email ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
                        placeholder="Enter email address"
                      />
                      {formErrors.email && (
                        <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                          <XMarkIcon className="h-4 w-4" />
                          {formErrors.email}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          name="password"
                          value={formData.password}
                          onChange={handleInputChange}
                          className={`w-full rounded-xl border px-4 py-3 pr-12 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 shadow-sm transition-colors
                            ${formErrors.password ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
                          placeholder="Enter password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 flex items-center pr-4"
                        >
                          {showPassword ? (
                            <EyeSlashIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                          ) : (
                            <EyeIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                          )}
                        </button>
                      </div>
                      
                      {/* Password Strength Indicator */}
                      {formData.password && (
                        <div className="mt-2">
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((level) => (
                              <div
                                key={level}
                                className={`h-2 flex-1 rounded-full transition-colors ${
                                  level <= passwordStrength
                                    ? passwordStrength <= 2
                                      ? 'bg-red-400'
                                      : passwordStrength <= 3
                                      ? 'bg-yellow-400'
                                      : 'bg-green-400'
                                    : 'bg-gray-200'
                                }`}
                              />
                            ))}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {passwordStrength <= 2 ? 'Weak' : passwordStrength <= 3 ? 'Medium' : 'Strong'} password
                          </p>
                        </div>
                      )}
                      
                      <button
                        type="button"
                        onClick={generateRandomPassword}
                        className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Generate random password
                      </button>
                      
                      {formErrors.password && (
                        <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                          <XMarkIcon className="h-4 w-4" />
                          {formErrors.password}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Department</label>
                      <input
                        type="text"
                        name="department"
                        value={formData.department}
                        onChange={handleInputChange}
                        className={`w-full rounded-xl border px-4 py-3 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 shadow-sm transition-colors
                          ${formErrors.department ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
                        placeholder="Enter department"
                      />
                      {formErrors.department && (
                        <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                          <XMarkIcon className="h-4 w-4" />
                          {formErrors.department}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Position</label>
                      <select
                        name="position"
                        value={formData.position}
                        onChange={handleInputChange}
                        className={`w-full rounded-xl border px-4 py-3 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 shadow-sm transition-colors
                          ${formErrors.position ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
                      >
                        <option value="">Select Position</option>
                        <option value="treasurer">Treasurer</option>
                        <option value="command_center">Command Center</option>
                        <option value="social_service">Social Service</option>
                        <option value="staff">General Staff</option>
                      </select>
                      {formErrors.position && (
                        <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                          <XMarkIcon className="h-4 w-4" />
                          {formErrors.position}
                        </p>
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Number</label>
                      <input
                        type="text"
                        name="contactNumber"
                        value={formData.contactNumber}
                        onChange={handleInputChange}
                        placeholder="Enter your 10-digit number"
                        className={`w-full rounded-xl border px-4 py-3 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 shadow-sm transition-colors
                          ${formErrors.contactNumber ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
                      />
                      {formErrors.contactNumber && (
                        <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                          <XMarkIcon className="h-4 w-4" />
                          {formErrors.contactNumber}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-6 py-3 text-sm font-semibold text-gray-700 bg-white border-2 border-gray-300 rounded-xl hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-green-600 to-green-700 rounded-xl hover:from-green-700 hover:to-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all transform hover:scale-105 shadow-lg"
                  >
                    Create Staff Account
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md transform transition-all">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Confirm Staff Account Creation</h3>
              <p className="text-gray-600 mb-6">Are you sure you want to create this staff account for <strong>{formData.name}</strong>?</p>
              <div className="flex space-x-4">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSubmit}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  Create Account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md transform transition-all">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckIcon className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Permissions Updated Successfully!</h3>
              <p className="text-gray-600 mb-6">
                The permissions for <strong>{successStaffName}</strong> have been updated successfully.
              </p>
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  setSuccessStaffName('');
                }}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Verification Modal */}
      {showVerificationModal && verificationData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
                  <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Verify Staff Email
                </h3>
                <p className="text-sm text-gray-600">
                  A verification code has been sent to <strong>{verificationData.email}</strong>
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Please enter the 6-digit code to complete the staff account setup for <strong>{verificationData.staffName}</strong>
                </p>
              </div>
              
              <EmailVerification
                email={verificationData.email}
                userId={verificationData.userId}
                onVerify={handleVerificationSuccess}
                onBack={handleVerificationClose}
                title="Staff Email Verification"
                subtitle="Enter the verification code sent to the staff member's email"
                showBackButton={true}
                backButtonText="Close"
                verifyButtonText="Verify Staff Account"
                resendButtonText="Resend Code"
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default StaffManagement;