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
  QuestionMarkCircleIcon,
  ShieldCheckIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import Navbar from '../../../../components/Navbar';
import Sidebar from '../../../../components/Sidebar';
import { useAdminResponsiveLayout } from '../../../../hooks/useAdminResponsiveLayout';
import EmailVerification from '../../../../components/EmailVerification';
import { usePermissions } from '../../../../hooks/usePermissions';

const RoleCard = ({ role, count, activeCount, icon, color, gradient, onClick, loading }) => (
  <div 
    onClick={onClick}
    className={`relative overflow-hidden rounded-2xl p-6 shadow-xl border border-gray-100 hover:shadow-2xl transition-all duration-500 cursor-pointer transform hover:scale-105 bg-white group`}
  >
    {/* Animated background gradient */}
    <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500`}></div>
    
    {/* Content */}
    <div className="relative z-10">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${color} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
          {icon}
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-bold ${color.replace('bg-', 'bg-').replace('-600', '-100')} ${color.replace('bg-', 'text-').replace('-100', '-700')}`}>
          {loading ? '...' : count} Total
        </div>
      </div>
      
      <h3 className="text-2xl font-bold text-gray-900 mb-2">{role}</h3>
      <div className="flex items-center gap-2 mb-4">
        <CheckIcon className="w-5 h-5 text-green-600" />
        <span className="text-sm text-gray-600">
          <span className="font-semibold text-gray-900">{loading ? '...' : activeCount}</span> Active
        </span>
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Click to manage</span>
          <ArrowPathIcon className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
        </div>
      </div>
    </div>
    
    {/* Decorative elements */}
    <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${gradient} rounded-full transform translate-x-8 -translate-y-8 opacity-5 group-hover:opacity-10 transition-opacity duration-500`}></div>
  </div>
);

const UserManagement = () => {
  const { mainClasses } = useAdminResponsiveLayout();
  const { canPerformAction, hasModuleAccess, isAdmin } = usePermissions();
  const [selectedRole, setSelectedRole] = useState(null);
  const [users, setUsers] = useState({
    admin: [],
    staff: [],
    resident: []
  });
  const [counts, setCounts] = useState({
    admin: { total: 0, active: 0 },
    staff: { total: 0, active: 0 },
    resident: { total: 0, active: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState({
    admin: false,
    staff: false,
    resident: false
  });

  // Staff Management State
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successStaffName, setSuccessStaffName] = useState('');
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationData, setVerificationData] = useState(null);
  const [editingStaff, setEditingStaff] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeout = React.useRef(null);
  const [formErrors, setFormErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [toastMessage, setToastMessage] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Check permissions for staff management actions
  const canEditStaff = isAdmin() || canPerformAction('edit', 'staff') || hasModuleAccess('staff');
  const canViewStaff = isAdmin() || canPerformAction('view', 'staff') || hasModuleAccess('staff');
  const canDisableStaff = isAdmin() || canPerformAction('disable', 'staff') || hasModuleAccess('staff');

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
    permissions: { ...defaultPermissions }
  });

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
    const base = JSON.parse(JSON.stringify(defaultPermissions));
    const source = typeof apiPerms === 'string' ? (()=>{try{return JSON.parse(apiPerms);}catch{return {};}})() : (apiPerms || {});
    
    const mainModuleKeys = [];
    const twoPartKeys = [];
    const threePartKeys = [];
    const fourPlusPartKeys = [];
    
    Object.entries(source).forEach(([apiKey, value]) => {
      if (apiKey === 'dashboard' || !apiKey.includes('_')) {
        mainModuleKeys.push([apiKey, value]);
      } else {
        const parts = apiKey.split('_');
        if (parts.length === 2) {
          twoPartKeys.push([apiKey, value]);
        } else if (parts.length === 3) {
          threePartKeys.push([apiKey, value]);
        } else if (parts.length >= 4) {
          fourPlusPartKeys.push([apiKey, value]);
        }
      }
    });
    
    const orderedKeys = [...mainModuleKeys, ...fourPlusPartKeys, ...threePartKeys, ...twoPartKeys];
    
    orderedKeys.forEach(([apiKey, value]) => {
      const normalizedValue = value === true || value === 1 || value === '1' || value === 'true';
      
      if (apiKey === 'dashboard') {
        base.dashboard.access = normalizedValue;
        return;
      }
      
      if (!apiKey.includes('_')) {
        const uiKey = apiToUiMap[apiKey];
        if (uiKey && base[uiKey]) {
          base[uiKey].access = normalizedValue;
        }
        return;
      }
      
      const parts = apiKey.split('_');
      const mainApiKey = parts[0];
      const uiKey = apiToUiMap[mainApiKey];
      
      if (!uiKey || !base[uiKey] || !base[uiKey].sub_permissions) {
        return;
      }
      
      if (parts.length === 2) {
        const [_, subKey] = parts;
        const subPermission = base[uiKey].sub_permissions[subKey];
        
        if (typeof subPermission === 'object' && subPermission !== null && subPermission.sub_permissions) {
          subPermission.access = normalizedValue;
          if (normalizedValue) {
            base[uiKey].access = true;
          }
        } else {
          base[uiKey].sub_permissions[subKey] = normalizedValue;
          if (normalizedValue) {
            base[uiKey].access = true;
          }
        }
      } else if (parts.length >= 3) {
        const availableSubKeys = Object.keys(base[uiKey].sub_permissions || {});
        let found = false;
        
        if (parts.length === 3) {
          const possibleSubKey = parts.slice(1).join('_');
          if (availableSubKeys.includes(possibleSubKey)) {
            const subPerm = base[uiKey].sub_permissions[possibleSubKey];
            if (typeof subPerm === 'object' && subPerm !== null && subPerm.sub_permissions) {
              subPerm.access = normalizedValue;
              if (normalizedValue) {
                base[uiKey].access = true;
              }
              found = true;
            }
          }
        }
        
        if (!found && parts.length >= 4) {
          for (let i = parts.length - 2; i >= 1; i--) {
            const possibleSubKey = parts.slice(1, i + 1).join('_');
            const possibleNestedKey = parts.slice(i + 1).join('_');
            
            if (availableSubKeys.includes(possibleSubKey)) {
              const subPerm = base[uiKey].sub_permissions[possibleSubKey];
              
              if (typeof subPerm === 'object' && subPerm !== null && subPerm.sub_permissions) {
                const defaultNestedKeys = Object.keys(subPerm.sub_permissions);
                if (defaultNestedKeys.includes(possibleNestedKey)) {
                  subPerm.sub_permissions[possibleNestedKey] = normalizedValue;
                  
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
        }
        
        if (!found) {
          const possibleSimpleSubKey = parts.slice(1).join('_');
          if (availableSubKeys.includes(possibleSimpleSubKey)) {
            const subPerm = base[uiKey].sub_permissions[possibleSimpleSubKey];
            if (typeof subPerm !== 'object' || subPerm === null || !subPerm.sub_permissions) {
              base[uiKey].sub_permissions[possibleSimpleSubKey] = normalizedValue;
              if (normalizedValue) {
                base[uiKey].access = true;
              }
              found = true;
            }
          }
        }
      }
    });
    
    return base;
  };

  // Convert UI permission keys back to backend keys
  const mapUiToApiPermissions = (uiPerms) => {
    const out = {};
    
    Object.entries(uiPerms || {}).forEach(([uiKey, val]) => {
      if (typeof val === 'object' && val !== null) {
        const apiKey = uiToApiMap[uiKey] || uiKey;
        
        if (val.sub_permissions) {
          out[apiKey] = Boolean(val.access);
          
          Object.entries(val.sub_permissions).forEach(([subKey, subVal]) => {
            const defaultSubPerm = defaultPermissions[uiKey]?.sub_permissions?.[subKey];
            const hasNestedInDefault = typeof defaultSubPerm === 'object' && defaultSubPerm !== null && defaultSubPerm.sub_permissions;
            
            if (hasNestedInDefault || (typeof subVal === 'object' && subVal !== null && subVal.sub_permissions)) {
              const subModuleKey = `${apiKey}_${subKey}`;
              const subAccess = typeof subVal === 'object' && subVal !== null ? Boolean(subVal.access) : Boolean(subVal);
              out[subModuleKey] = subAccess;
              
              const allNestedKeys = defaultSubPerm?.sub_permissions 
                ? Object.keys(defaultSubPerm.sub_permissions)
                : (subVal && typeof subVal === 'object' && subVal.sub_permissions ? Object.keys(subVal.sub_permissions) : []);
              
              allNestedKeys.forEach((nestedKey) => {
                const nestedKeyFull = `${apiKey}_${subKey}_${nestedKey}`;
                const nestedVal = subVal && typeof subVal === 'object' && subVal.sub_permissions 
                  ? subVal.sub_permissions[nestedKey] 
                  : undefined;
                const nestedValue = nestedVal !== undefined ? Boolean(nestedVal) : false;
                out[nestedKeyFull] = nestedValue;
                
                if (nestedValue) {
                  out[subModuleKey] = true;
                  out[apiKey] = true;
                }
              });
            } else {
              const subModuleKey = `${apiKey}_${subKey}`;
              out[subModuleKey] = Boolean(subVal);
            }
          });
        } else {
          out[apiKey] = Boolean(val.access);
        }
      } else {
        const normalizedValue = !!val;
        if (uiKey === 'dashboard') {
          out.dashboard = normalizedValue;
        } else {
          const apiKey = uiToApiMap[uiKey];
          if (apiKey) {
            out[apiKey] = normalizedValue;
          }
        }
      }
    });
    
    Object.keys(out).forEach(key => {
      if (typeof out[key] !== 'boolean') {
        out[key] = Boolean(out[key]);
      }
    });
    
    return out;
  };

  useEffect(() => {
    fetchAllUsers();
  }, []);

  const fetchAllUsers = async () => {
    setLoading(true);
    try {
      // Fetch all user types in parallel
      const [adminsRes, staffRes, residentsRes] = await Promise.all([
        axiosInstance.get('/api/admin/admins').catch((err) => {
          console.error('Error fetching admins:', err);
          console.error('Admin API Error Details:', {
            status: err.response?.status,
            data: err.response?.data,
            message: err.message
          });
          
          // If 403, user might not have permission, but they should be admin to see this page
          if (err.response?.status === 403) {
            console.warn('403 Forbidden when fetching admins - user may not have admin role');
            toast.warning('Unable to fetch admin users. You may need admin privileges.');
          } else if (err.response?.status === 401) {
            console.warn('401 Unauthorized when fetching admins - user not authenticated');
            toast.error('Authentication required. Please log in again.');
          } else {
            toast.error('Failed to fetch admin users. Please try again.');
          }
          
          return { data: { users: [] } };
        }),
        axiosInstance.get('/api/admin/staff').catch((err) => {
          console.error('Error fetching staff:', err);
          return { data: [] };
        }),
        axiosInstance.get('/api/admin/residents-users').catch((err) => {
          console.error('Error fetching residents:', err);
          return { data: { users: [] } };
        })
      ]);

      // Debug: Log admin response
      console.log('Admin API Response:', {
        status: adminsRes.status,
        statusText: adminsRes.statusText,
        data: adminsRes.data,
        dataKeys: adminsRes.data ? Object.keys(adminsRes.data) : [],
        hasUsers: !!adminsRes.data?.users,
        usersType: Array.isArray(adminsRes.data?.users) ? 'array' : typeof adminsRes.data?.users,
        usersLength: Array.isArray(adminsRes.data?.users) ? adminsRes.data.users.length : 'not array',
        isArray: Array.isArray(adminsRes.data),
        fullResponse: adminsRes
      });

      // Get admin data - handle multiple possible response formats
      let adminsData = [];
      
      // Check if this is a successful response (has status property) or error fallback
      if (adminsRes.status && adminsRes.status >= 200 && adminsRes.status < 300) {
        // Successful response
        if (adminsRes.data) {
          if (Array.isArray(adminsRes.data)) {
            // Direct array response
            adminsData = adminsRes.data;
          } else if (Array.isArray(adminsRes.data.users)) {
            // Wrapped in users property (expected format from backend)
            adminsData = adminsRes.data.users;
          } else if (Array.isArray(adminsRes.data.data)) {
            // Wrapped in data property
            adminsData = adminsRes.data.data;
          } else if (adminsRes.data.users && !Array.isArray(adminsRes.data.users)) {
            // Single user object
            adminsData = [adminsRes.data.users];
          }
        }
      } else {
        // This is likely an error fallback - log warning
        console.warn('Admin API call failed or returned error status. Using empty array.');
        if (adminsRes.data && Array.isArray(adminsRes.data.users)) {
          // Still try to extract data even if status is not 2xx
          adminsData = adminsRes.data.users;
        }
      }

      console.log('Processed Admin Data:', {
        count: adminsData.length,
        admins: adminsData.map(a => ({ id: a.id, name: a.name, email: a.email }))
      });

      // Get staff data and map permissions
      let staffData = [];
      if (staffRes.data) {
        if (Array.isArray(staffRes.data)) {
          staffData = staffRes.data;
        } else if (Array.isArray(staffRes.data.staff)) {
          staffData = staffRes.data.staff;
        } else if (Array.isArray(staffRes.data.data)) {
          staffData = staffRes.data.data;
        }
      }
      staffData = staffData.map(s => ({
        ...s,
        module_permissions: mapApiToUiPermissions(s.module_permissions)
      }));
      
      // Get residents data
      let residentsData = [];
      if (residentsRes.data) {
        if (Array.isArray(residentsRes.data)) {
          residentsData = residentsRes.data;
        } else if (Array.isArray(residentsRes.data.users)) {
          residentsData = residentsRes.data.users;
        } else if (Array.isArray(residentsRes.data.data)) {
          residentsData = residentsRes.data.data;
        }
      }

      console.log('Final User Counts:', {
        admins: adminsData.length,
        staff: staffData.length,
        residents: residentsData.length
      });

      setUsers({
        admin: adminsData,
        staff: staffData,
        resident: residentsData
      });

      setCounts({
        admin: {
          total: adminsData.length,
          active: adminsData.filter(u => u.active !== false && u.status !== 'disabled').length
        },
        staff: {
          total: staffData.length,
          active: staffData.filter(u => u.active !== false && u.status !== 'disabled').length
        },
        resident: {
          total: residentsData.length,
          active: residentsData.filter(u => u.active !== false && u.status !== 'disabled').length
        }
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  // Staff Management Functions
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

  const calculatePasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[a-z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    return strength;
  };

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
      const onlyNums = value.replace(/\D/g, '');
      if (onlyNums.length <= 10) {
        setFormData(prev => ({
          ...prev,
          [name]: onlyNums
        }));
      }
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (formErrors[name]) {
      setFormErrors(prevErrors => ({
        ...prevErrors,
        [name]: ''
      }));
    }
  };

  const handleDeactivate = async (staffId) => {
    try {
      await axiosInstance.put(`/api/admin/staff/${staffId}/deactivate`);
      toast.success('Staff member deactivated successfully');
      fetchAllUsers();
    } catch (error) {
      console.error('Error deactivating staff:', error);
      toast.error(error.response?.data?.message || 'Failed to deactivate staff member');
    }
  };

  const handleUpdatePermissions = async () => {
    if (!editingStaff) return;

    try {
      const currentPermissions = editingStaff.module_permissions || {};
      const formattedPermissions = mapUiToApiPermissions(currentPermissions);

      const response = await axiosInstance.put(`/api/admin/staff/${editingStaff.id}/permissions`, {
        module_permissions: formattedPermissions,
        staff_id: editingStaff.id
      });

      const staffName = editingStaff?.name || 'the staff member';
      setShowPermissionsModal(false);
      setEditingStaff(null);
      setSuccessStaffName(staffName);
      setShowSuccessModal(true);
      await fetchAllUsers();
    } catch (error) {
      console.error('Error updating permissions:', error);
      let errorMessage = 'An error occurred while updating permissions';
      
      if (error.response) {
        if (error.response.status === 422) {
          const errors = error.response.data.errors || error.response.data.error || [];
          errorMessage = Array.isArray(errors) && errors.length > 0 ? errors[0] : 
                        typeof errors === 'string' ? errors : 
                        error.response.data.message || errorMessage;
        } else if (error.response.status === 403) {
          errorMessage = error.response.data.error === 'INSUFFICIENT_PERMISSIONS'
            ? `Access denied: You need admin privileges to update staff permissions. Your role: ${error.response.data.user_role || 'unknown'}`
            : 'Access denied: You do not have permission to perform this action';
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
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
    
    if (!formData.name.trim()) errors.name = 'Name is required';
    if (!formData.email.trim()) errors.email = 'Email is required';
    else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(formData.email)) {
      errors.email = 'Invalid email format';
    }
    
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      errors.password = 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
    }
    
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
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
      
      const modulePermissions = mapUiToApiPermissions(formData.permissions);

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

      if (result.data?.requires_verification) {
        setShowVerificationModal(true);
        setVerificationData({
          userId: result.data.user_id,
          email: result.data.email,
          staffName: formData.name
        });
      } else {
        toast.success(result.data?.message || 'Staff account created successfully', {
          position: "top-right",
          autoClose: 3000,
        });
      }

      setShowStaffModal(false);
      setShowConfirmModal(false);
      await fetchAllUsers();

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

  const handleVerificationSuccess = (data) => {
    setShowVerificationModal(false);
    setVerificationData(null);
    toast.success(`Staff account for ${verificationData?.staffName} has been verified successfully!`, {
      position: "top-right",
      autoClose: 5000,
    });
  };

  const handleVerificationClose = () => {
    setShowVerificationModal(false);
    setVerificationData(null);
  };

  React.useEffect(() => {
    if (toastMessage && toastMessage.duration > 0) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, toastMessage.duration);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleRoleClick = (role) => {
    setSelectedRole(role);
  };

  const handleBackToOverview = () => {
    setSelectedRole(null);
  };

  const currentUsers = selectedRole ? users[selectedRole] : [];
  const currentCounts = selectedRole ? counts[selectedRole] : { total: 0, active: 0 };

  return (
    <>
      <Navbar />
      <Sidebar />
      <main className="bg-gradient-to-br from-green-50 to-emerald-50 min-h-screen ml-0 lg:ml-64 pt-20 lg:pt-36 px-4 pb-16 font-sans">
        <div className="w-full max-w-[98%] mx-auto space-y-8 px-2 lg:px-4">
          {!selectedRole ? (
            <>
              {/* Enhanced Header */}
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full shadow-xl mb-4">
                  <UserGroupIcon className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-5xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent tracking-tight">
                  User Management System
                </h1>
                <p className="text-gray-600 text-lg max-w-2xl mx-auto leading-relaxed">
                  Comprehensive management system for all user accounts, roles, permissions, and access control with real-time monitoring.
                </p>
                
                {/* Help System Buttons */}
                <div className="flex flex-wrap justify-center gap-4 mt-8">
                  <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-600 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 hover:text-green-700 transition-colors duration-200 shadow-md hover:shadow-lg transform hover:scale-105">
                    <BookOpenIcon className="w-4 h-4" />
                    Help Guide
                  </button>
                  <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 hover:text-blue-700 transition-colors duration-200 shadow-md hover:shadow-lg transform hover:scale-105">
                    <PlayIcon className="w-4 h-4" />
                    Quick Start
                  </button>
                  <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-600 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 hover:text-purple-700 transition-colors duration-200 shadow-md hover:shadow-lg transform hover:scale-105">
                    <QuestionMarkCircleIcon className="w-4 h-4" />
                    FAQ
                  </button>
                </div>
              </div>

              {/* Role Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <RoleCard
                  role="Administrators"
                  count={counts.admin.total}
                  activeCount={counts.admin.active}
                  icon={<ShieldCheckIcon className="w-8 h-8 text-red-600" />}
                  color="bg-red-100"
                  gradient="from-red-500 to-pink-600"
                  onClick={() => handleRoleClick('admin')}
                  loading={loading || roleLoading.admin}
                />
                <RoleCard
                  role="Staff Members"
                  count={counts.staff.total}
                  activeCount={counts.staff.active}
                  icon={<UserGroupIcon className="w-8 h-8 text-blue-600" />}
                  color="bg-blue-100"
                  gradient="from-blue-500 to-cyan-600"
                  onClick={() => handleRoleClick('staff')}
                  loading={loading || roleLoading.staff}
                />
                <RoleCard
                  role="Residents"
                  count={counts.resident.total}
                  activeCount={counts.resident.active}
                  icon={<UserIcon className="w-8 h-8 text-green-600" />}
                  color="bg-green-100"
                  gradient="from-green-500 to-emerald-600"
                  onClick={() => handleRoleClick('resident')}
                  loading={loading || roleLoading.resident}
                />
              </div>

              {/* Summary Statistics */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <UserGroupIcon className="w-6 h-6 text-green-600" />
                  System Overview
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl p-4 border border-red-200">
                    <p className="text-sm text-red-600 font-medium mb-1">Total Administrators</p>
                    <p className="text-3xl font-bold text-red-700">{counts.admin.total}</p>
                    <p className="text-xs text-red-500 mt-1">{counts.admin.active} active</p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-200">
                    <p className="text-sm text-blue-600 font-medium mb-1">Total Staff</p>
                    <p className="text-3xl font-bold text-blue-700">{counts.staff.total}</p>
                    <p className="text-xs text-blue-500 mt-1">{counts.staff.active} active</p>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                    <p className="text-sm text-green-600 font-medium mb-1">Total Residents</p>
                    <p className="text-3xl font-bold text-green-700">{counts.resident.total}</p>
                    <p className="text-xs text-green-500 mt-1">{counts.resident.active} active</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Role Detail View */}
              <div className="mb-6">
                <button
                  onClick={handleBackToOverview}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200 shadow-sm hover:shadow-md"
                >
                  <ArrowPathIcon className="w-4 h-4 rotate-180" />
                  Back to Overview
                </button>
              </div>

              {selectedRole === 'staff' ? (
                // Full Staff Management View
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden w-full">
                  <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                        <UserGroupIcon className="w-5 h-5" />
                        Staff Members ({currentCounts.total})
                      </h3>
                      <div className="flex gap-2">
                        <button
                          onClick={fetchAllUsers}
                          className="bg-blue-500/20 hover:bg-blue-500/30 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-300 transform hover:scale-105 flex items-center gap-2 backdrop-blur-sm border border-blue-500/30"
                        >
                          <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                          Refresh
                        </button>
                        <button
                          onClick={() => setShowStaffModal(true)}
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
                        ) : currentUsers.length === 0 ? (
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
                          currentUsers.map((member) => (
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
                                  {canEditStaff && (
                                    <button
                                      onClick={() => {
                                        const initialPermissions = member.module_permissions || {};
                                        const hasApiFormatKeys = Object.keys(initialPermissions).some(key => 
                                          key.includes('_') && (key.includes('Records') || key.includes('Management') || key === 'dashboard')
                                        );
                                        
                                        let uiPermissions;
                                        if (hasApiFormatKeys) {
                                          uiPermissions = mapApiToUiPermissions(initialPermissions);
                                        } else {
                                          uiPermissions = initialPermissions;
                                        }
                                        
                                        const normalizedPermissions = JSON.parse(JSON.stringify(defaultPermissions));
                                        
                                        Object.keys(defaultPermissions).forEach(uiKey => {
                                          const defaultPerm = defaultPermissions[uiKey];
                                          const existingPerm = uiPermissions[uiKey];
                                          
                                          if (defaultPerm.sub_permissions) {
                                            normalizedPermissions[uiKey] = {
                                              access: existingPerm?.access ?? false,
                                              sub_permissions: {}
                                            };
                                            
                                            Object.keys(defaultPerm.sub_permissions).forEach(subKey => {
                                              const defaultSubPerm = defaultPerm.sub_permissions[subKey];
                                              const existingSubPerm = existingPerm?.sub_permissions?.[subKey];
                                              
                                              if (typeof defaultSubPerm === 'object' && defaultSubPerm.sub_permissions) {
                                                normalizedPermissions[uiKey].sub_permissions[subKey] = {
                                                  access: existingSubPerm?.access ?? false,
                                                  sub_permissions: {}
                                                };
                                                
                                                Object.keys(defaultSubPerm.sub_permissions).forEach(nestedKey => {
                                                  const existingNestedValue = existingSubPerm?.sub_permissions?.[nestedKey];
                                                  const finalValue = existingNestedValue !== undefined ? Boolean(existingNestedValue) : false;
                                                  normalizedPermissions[uiKey].sub_permissions[subKey].sub_permissions[nestedKey] = finalValue;
                                                });
                                              } else {
                                                const finalSubValue = existingSubPerm !== undefined 
                                                  ? Boolean(existingSubPerm) 
                                                  : false;
                                                normalizedPermissions[uiKey].sub_permissions[subKey] = finalSubValue;
                                              }
                                            });
                                          } else {
                                            normalizedPermissions[uiKey] = {
                                              access: existingPerm?.access ?? false
                                            };
                                          }
                                        });
                                        
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
                                  )}
                                  
                                  {canViewStaff && (
                                    <button
                                      onClick={() => {
                                        toast.info(`View details for ${member.name}`, {
                                          position: "top-right",
                                          autoClose: 3000
                                        });
                                      }}
                                      className="text-blue-600 hover:text-blue-800 cursor-pointer p-2 rounded-lg hover:bg-blue-50 transition-all duration-300 transform hover:scale-110"
                                      title="View Details"
                                    >
                                      <EyeIcon className="w-5 h-5" />
                                    </button>
                                  )}
                                  
                                  {canDisableStaff && (
                                    <button
                                      onClick={() => handleDeactivate(member.id)}
                                      className="text-red-600 hover:text-red-800 cursor-pointer p-2 rounded-lg hover:bg-red-50 transition-all duration-300 transform hover:scale-110"
                                      title="Deactivate Staff"
                                    >
                                      <XMarkIcon className="w-5 h-5" />
                                    </button>
                                  )}
                                  
                                  {!canEditStaff && !canViewStaff && !canDisableStaff && (
                                    <span className="text-xs text-gray-400 italic">No actions available</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                // Simple table for Admin and Resident roles
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                        <UserGroupIcon className="w-5 h-5" />
                        {selectedRole === 'admin' ? 'Administrators' : 'Residents'} ({currentCounts.total})
                      </h3>
                      <div className="flex gap-2">
                        <button
                          onClick={fetchAllUsers}
                          className="bg-blue-500/20 hover:bg-blue-500/30 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-300 transform hover:scale-105 flex items-center gap-2 backdrop-blur-sm border border-blue-500/30"
                        >
                          <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                          Refresh
                        </button>
                        <button
                          className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 transform hover:scale-105 flex items-center gap-2 backdrop-blur-sm border border-white/30"
                        >
                          <PlusIcon className="w-4 h-4" />
                          Create {selectedRole === 'admin' ? 'Admin' : 'Resident'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-4 text-left font-bold text-gray-700 text-sm uppercase tracking-wider">Name</th>
                          <th className="px-6 py-4 text-left font-bold text-gray-700 text-sm uppercase tracking-wider">Email</th>
                          <th className="px-6 py-4 text-left font-bold text-gray-700 text-sm uppercase tracking-wider">Status</th>
                          <th className="px-6 py-4 text-left font-bold text-gray-700 text-sm uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {loading ? (
                          <tr>
                            <td colSpan="4" className="px-6 py-12 text-center">
                              <div className="flex flex-col items-center gap-4">
                                <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                                <p className="text-gray-600">Loading users...</p>
                              </div>
                            </td>
                          </tr>
                        ) : currentUsers.length === 0 ? (
                          <tr>
                            <td colSpan="4" className="px-6 py-12 text-center">
                              <div className="flex flex-col items-center gap-4">
                                <UserGroupIcon className="w-16 h-16 text-gray-300" />
                                <p className="text-gray-600 font-semibold">No {selectedRole === 'admin' ? 'administrators' : 'residents'} found</p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          currentUsers.map((user) => (
                            <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white font-bold">
                                    {user.name?.charAt(0).toUpperCase() || 'U'}
                                  </div>
                                  <span className="font-medium text-gray-900">{user.name || user.full_name || 'N/A'}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-gray-700">{user.email || 'N/A'}</td>
                              <td className="px-6 py-4">
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                  user.active !== false && user.status !== 'disabled'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {user.active !== false && user.status !== 'disabled' ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex gap-2">
                                  <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View">
                                    <EyeIcon className="w-5 h-5" />
                                  </button>
                                  <button className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors" title="Edit">
                                    <PencilIcon className="w-5 h-5" />
                                  </button>
                                  <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
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
              )}
            </>
          )}
        </div>
      </main>

      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-24 right-6 z-50 max-w-md rounded-xl shadow-2xl border-2 p-4 transition-all duration-500 transform ${
          toastMessage ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
        } ${
          toastMessage.type === 'success'
            ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 text-green-800'
            : toastMessage.type === 'loading'
            ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 text-blue-800'
            : 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {toastMessage.type === 'success' && <CheckIcon className="w-5 h-5 text-green-600" />}
              {toastMessage.type === 'loading' && <ArrowPathIcon className="w-5 h-5 text-blue-600 animate-spin" />}
              {toastMessage.type === 'error' && <ExclamationCircleIcon className="w-5 h-5 text-red-600" />}
            </div>
            <div className="flex-1">
              <div className="font-semibold text-sm">{toastMessage.message}</div>
            </div>
            {toastMessage.type !== 'loading' && (
              <button
                onClick={() => setToastMessage(null)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

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
                                    sub_permissions: hasSubPermissions ? 
                                      Object.keys(moduleConfig.sub_permissions).reduce((acc, subKey) => {
                                        const subDefault = moduleConfig.sub_permissions[subKey];
                                        if (typeof subDefault === 'object' && subDefault !== null && subDefault.sub_permissions) {
                                          acc[subKey] = {
                                            access: newAccess,
                                            sub_permissions: Object.keys(subDefault.sub_permissions).reduce((nestedAcc, nestedKey) => {
                                              nestedAcc[nestedKey] = newAccess;
                                              return nestedAcc;
                                            }, {})
                                          };
                                        } else {
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

                      {hasSubPermissions && currentPermission.access && (
                        <div className="space-y-3 mt-4 pt-4 border-t border-gray-100">
                          <h4 className="text-sm font-medium text-gray-700 mb-3">Sub-sections:</h4>
                          {Object.entries(moduleConfig.sub_permissions).map(([subKey, subDefault]) => {
                            const currentModulePerm = editingStaff.module_permissions?.[moduleKey];
                            const subPermission = currentModulePerm?.sub_permissions?.[subKey];
                            const subLabel = subKey.replace(/_/g, ' ');
                            const hasNestedSubPermissions = typeof subDefault === 'object' && subDefault !== null && subDefault.sub_permissions;
                            const checkedValue = hasNestedSubPermissions 
                              ? Boolean(currentModulePerm?.sub_permissions?.[subKey]?.access) 
                              : Boolean(currentModulePerm?.sub_permissions?.[subKey]);
                            
                            return (
                              <div key={subKey} className="bg-gray-50 rounded-lg p-3">
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
                                        setEditingStaff(prev => {
                                          const prevModulePerm = prev.module_permissions?.[moduleKey] || { access: false, sub_permissions: {} };
                                          
                                          if (hasNestedSubPermissions) {
                                            const updatedNested = Object.keys(subDefault.sub_permissions).reduce((acc, nestedKey) => {
                                              acc[nestedKey] = newValue;
                                              return acc;
                                            }, {});
                                            
                                            return {
                                              ...prev,
                                              module_permissions: {
                                                ...(prev.module_permissions || {}),
                                                [moduleKey]: {
                                                  ...prevModulePerm,
                                                  access: newValue ? true : prevModulePerm.access,
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
                                
                                {hasNestedSubPermissions && (
                                  <div className="ml-6 mt-3 space-y-2 pt-3 border-t border-gray-200">
                                    {Object.entries(subDefault.sub_permissions).map(([nestedKey, nestedDefault]) => {
                                      const currentModulePerm = editingStaff.module_permissions?.[moduleKey];
                                      const currentSubPerm = currentModulePerm?.sub_permissions?.[subKey];
                                      const nestedPermission = currentSubPerm?.sub_permissions?.[nestedKey] ?? false;
                                      const nestedLabel = nestedKey.replace(/_/g, ' ');
                                      
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
                                                setEditingStaff(prev => {
                                                  const prevModulePerm = prev.module_permissions?.[moduleKey] || { access: false, sub_permissions: {} };
                                                  const prevSubPerm = prevModulePerm.sub_permissions?.[subKey] || {};
                                                  const prevNested = (typeof prevSubPerm === 'object' && prevSubPerm !== null && prevSubPerm.sub_permissions) 
                                                    ? prevSubPerm.sub_permissions 
                                                    : {};
                                                  
                                                  const updatedNested = {};
                                                  Object.keys(subDefault.sub_permissions).forEach(key => {
                                                    if (key === nestedKey) {
                                                      updatedNested[key] = newValue;
                                                    } else {
                                                      updatedNested[key] = prevNested[key] !== undefined ? prevNested[key] : false;
                                                    }
                                                  });
                                                  
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
                                                  
                                                  if (newValue) {
                                                    updatedPermission.access = true;
                                                  }
                                                  
                                                  return {
                                                    ...prev,
                                                    module_permissions: {
                                                      ...(prev.module_permissions || {}),
                                                      [moduleKey]: updatedPermission
                                                    }
                                                  };
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

      {/* Create Staff Modal - This is a large modal, I'll add a simplified version */}
      {showStaffModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl transform transition-all overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-green-600 to-green-700 px-8 py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-white">Create Staff Account</h2>
                  <p className="mt-2 text-green-100">Add a new staff member to the system</p>
                </div>
                <button
                  onClick={() => setShowStaffModal(false)}
                  className="text-green-200 hover:text-white focus:outline-none focus:ring-2 focus:ring-green-300 focus:ring-offset-2 rounded-full p-2 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="px-8 py-6">
              <form onSubmit={(e) => { e.preventDefault(); setShowConfirmModal(true); }} className="space-y-6">
                {/* Search Resident Section */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-200 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <MagnifyingGlassIcon className="w-5 h-5 text-blue-600" />
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
                        <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
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

                  <div>
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

                  <div className="md:col-span-2">
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

                <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowStaffModal(false)}
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

export default UserManagement;

