import React, { useEffect, useState, useMemo, useCallback, useRef, Suspense, lazy, Fragment } from "react";
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Menu, Transition } from '@headlessui/react';
import { createPortal } from 'react-dom';
import Navbar from "../../components/Navbar";
import Sidebar from "../../components/Sidebar";
import HeaderControls from "./components/HeaderControls";
import ResidentsTable from "./components/ResidentsTable";
import axiosInstance from "../../utils/axiosConfig";
import { toast } from 'react-toastify';
import { useAuth } from "../../contexts/AuthContext";
import { useAdminResponsiveLayout } from "../../hooks/useAdminResponsiveLayout";
import { usePermissions } from "../../hooks/usePermissions";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import AnalyticsDashboard from "./components/analytics/AnalyticsDashboard";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  UserIcon,
  XMarkIcon,
  EyeIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FunnelIcon,
  DocumentTextIcon,
  CalendarIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  AcademicCapIcon,
  BriefcaseIcon,
  BuildingOfficeIcon,
  HeartIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  HeartIcon as HeartSolidIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  GlobeAltIcon,
  SparklesIcon,
  IdentificationIcon,
  ArrowPathIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  ChartBarIcon,
  ExclamationCircleIcon,
  QuestionMarkCircleIcon,
  PlayIcon,
  BookOpenIcon,
  LightBulbIcon
} from "@heroicons/react/24/solid";

// Import help components
import HelpGuide from "./modules/residents-record/components/HelpGuide";
import QuickStartGuide from "./modules/residents-record/components/QuickStartGuide";
import FAQ from "./modules/residents-record/components/FAQ";
import HelpTooltip, { QuickHelpButton, HelpIcon, FeatureExplanation } from "./modules/residents-record/components/HelpTooltip";

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    console.error('ResidentsRecords Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <div className="flex items-center mb-4">
              <ExclamationCircleIcon className="h-8 w-8 text-red-500 mr-3" />
              <h2 className="text-lg font-semibold text-gray-900">Something went wrong</h2>
            </div>
            <p className="text-gray-600 mb-4">
              An error occurred while loading the residents records. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Custom hooks for better state management
const useApiCall = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  const execute = useCallback(async (apiCall, options = {}) => {
    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setLoading(true);
    setError(null);

    try {
      const result = await apiCall(abortControllerRef.current.signal);
      return result;
    } catch (err) {
      // Handle different types of errors
      if (err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
        // Request was cancelled, don't treat as error
        console.log('Request was cancelled');
        return null;
      }
      
      // For other errors, set error state and re-throw
      setError(err.message || 'An error occurred');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return { execute, loading, error };
};

// Input validation utilities
const validateInput = {
  email: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },
  phone: (phone) => {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  },
  required: (value) => {
    return value && value.toString().trim().length > 0;
  },
  minLength: (value, min) => {
    return value && value.toString().length >= min;
  },
  maxLength: (value, max) => {
    return !value || value.toString().length <= max;
  }
};

// Data sanitization utilities
const sanitizeData = {
  string: (value) => {
    if (typeof value !== 'string') return '';
    return value.trim().replace(/[<>]/g, '');
  },
  number: (value) => {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  },
  date: (value) => {
    if (!value) return null;
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
};

// Enhanced Utility Components with better accessibility
const Badge = React.memo(({ text, color, icon = null, ariaLabel }) => (
  <span 
    className={`px-3 py-1.5 text-xs font-semibold rounded-full ${color} inline-flex items-center gap-1 shadow-sm transition-all duration-200 hover:shadow-md`}
    role="status"
    aria-label={ariaLabel || text}
  >
    {icon && <span aria-hidden="true">{icon}</span>}
    <span>{text}</span>
  </span>
));

// Loading Spinner Component
const LoadingSpinner = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  };

  return (
    <div className={`animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 ${sizeClasses[size]} ${className}`}>
      <span className="sr-only">Loading...</span>
    </div>
  );
};

// Error Display Component
const ErrorDisplay = ({ error, onRetry, className = '' }) => (
  <div className={`bg-red-50 border border-red-200 rounded-md p-4 ${className}`}>
    <div className="flex items-center">
      <ExclamationCircleIcon className="h-5 w-5 text-red-400 mr-2" />
      <div className="flex-1">
        <h3 className="text-sm font-medium text-red-800">Error</h3>
        <p className="text-sm text-red-700 mt-1">{error}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="ml-4 text-sm text-red-600 hover:text-red-800 underline"
        >
          Retry
        </button>
      )}
    </div>
  </div>
);

// Empty State Component
const EmptyState = ({ title, description, action, icon: Icon }) => (
  <div className="text-center py-12">
    {Icon && <Icon className="mx-auto h-12 w-12 text-gray-400 mb-4" />}
    <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
    <p className="text-gray-500 mb-4">{description}</p>
    {action && action}
  </div>
);

// Enhanced export functions with better error handling and validation
function exportToCSV(data, filename = 'residents-export') {
  try {
    const items = Array.isArray(data) ? data : [];
    if (items.length === 0) {
      if (window.__showInfo) window.__showInfo('No data to export.', 'Export', 'info'); else alert('No data to export.');
      return;
    }

    // Validate data structure
    if (!items.every(item => item && typeof item === 'object')) {
      throw new Error('Invalid data format for export');
    }

    const toName = (r) => {
      const first = r.first_name || '';
      const middle = r.middle_name ? ` ${r.middle_name}` : '';
      const last = r.last_name ? ` ${r.last_name}` : '';
      const suffix = r.name_suffix && r.name_suffix.toLowerCase() !== 'none' ? ` ${r.name_suffix}` : '';
      return `${first}${middle}${last}${suffix}`.trim();
    };

    const computeStatus = (r) => {
      if (r.update_status) return r.update_status;
      const dateStr = r.last_modified || r.updated_at;
      if (!dateStr) return 'Needs Verification';
      const updatedDate = new Date(dateStr);
      if (isNaN(updatedDate)) return 'Needs Verification';
      const now = new Date();
      const monthsDiff = (now.getFullYear() - updatedDate.getFullYear()) * 12 + (now.getMonth() - updatedDate.getMonth());
      if (monthsDiff <= 6) return 'Active';
      if (monthsDiff <= 12) return 'Outdated';
      return 'Needs Verification';
    };

    const escapeCSV = (val) => {
      const s = val == null ? '' : String(val);
      if (/[",\n\r]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const headers = ['Resident ID', 'Name', 'Update Status', 'Verification', 'Last Modified', 'For Review'];
    const rows = items.map((r) => [
      r.resident_id ?? r.id ?? '',
      toName(r),
      computeStatus(r),
      r.verification_status || 'Pending',
      r.last_modified ? new Date(r.last_modified).toLocaleString() : (r.updated_at ? new Date(r.updated_at).toLocaleString() : ''),
      r.for_review ? 'Yes' : 'No',
    ]);

    const csv = [headers, ...rows].map((row) => row.map(escapeCSV).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'residents.csv';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('CSV export error:', e);
    if (window.__showInfo) window.__showInfo('Failed to export CSV.', 'Export Error', 'error'); else alert('Failed to export CSV.');
  }
}

function exportToPDF(data) {
  try {
    const items = Array.isArray(data) ? data : [];
    if (items.length === 0) {
      if (window.__showInfo) window.__showInfo('No data to export.', 'Export', 'info'); else alert('No data to export.');
      return;
    }

    const toName = (r) => {
      const first = r.first_name || '';
      const middle = r.middle_name ? ` ${r.middle_name}` : '';
      const last = r.last_name ? ` ${r.last_name}` : '';
      const suffix = r.name_suffix && r.name_suffix.toLowerCase() !== 'none' ? ` ${r.name_suffix}` : '';
      return `${first}${middle}${last}${suffix}`.trim();
    };

    const computeStatus = (r) => {
      if (r.update_status) return r.update_status;
      const dateStr = r.last_modified || r.updated_at;
      if (!dateStr) return 'Needs Verification';
      const updatedDate = new Date(dateStr);
      if (isNaN(updatedDate)) return 'Needs Verification';
      const now = new Date();
      const monthsDiff = (now.getFullYear() - updatedDate.getFullYear()) * 12 + (now.getMonth() - updatedDate.getMonth());
      if (monthsDiff <= 6) return 'Active';
      if (monthsDiff <= 12) return 'Outdated';
      return 'Needs Verification';
    };

    const rowsHtml = items.map((r) => `
      <tr>
        <td>${r.resident_id ?? r.id ?? ''}</td>
        <td>${toName(r)}</td>
        <td>${computeStatus(r)}</td>
        <td>${r.verification_status || 'Pending'}</td>
        <td>${r.last_modified ? new Date(r.last_modified).toLocaleString() : (r.updated_at ? new Date(r.updated_at).toLocaleString() : '')}</td>
        <td>${r.for_review ? 'Yes' : 'No'}</td>
      </tr>
    `).join('');

    const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Residents Report</title>
<style>
  body { font-family: Arial, sans-serif; padding: 24px; }
  h1 { font-size: 18px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
  th { background: #f5f5f5; }
  @media print {
    @page { size: A4 landscape; margin: 12mm; }
  }
</style>
</head>
<body>
  <h1>Residents Report</h1>
  <table>
    <thead>
      <tr>
        <th>Resident ID</th>
        <th>Name</th>
        <th>Update Status</th>
        <th>Verification</th>
        <th>Last Modified</th>
        <th>For Review</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
  <script>
    window.onload = function() {
      window.print();
      setTimeout(function() { window.close(); }, 300);
    };
  </script>
</body>
</html>
`;

    const win = window.open('', '_blank');
    if (!win) {
      if (window.__showInfo) window.__showInfo('Popup was blocked. Please allow popups to export to PDF.', 'Export PDF', 'error'); else alert('Popup was blocked. Please allow popups to export to PDF.');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  } catch (e) {
    console.error('PDF export error:', e);
    if (window.__showInfo) window.__showInfo('Failed to export PDF.', 'Export Error', 'error'); else alert('Failed to export PDF.');
  }
}

// Enhanced Excel export function with demographic-style filtered data
function exportToExcel(data, filename = 'residents-demographic-report') {
  try {
    const items = Array.isArray(data) ? data : [];
    if (items.length === 0) {
      if (window.__showInfo) window.__showInfo('No data to export.', 'Export', 'info'); else alert('No data to export.');
      return;
    }

    // Validate data structure
    if (!items.every(item => item && typeof item === 'object')) {
      throw new Error('Invalid data format for export');
    }

    const toName = (r) => {
      const first = r.first_name || '';
      const middle = r.middle_name ? ` ${r.middle_name}` : '';
      const last = r.last_name ? ` ${r.last_name}` : '';
      const suffix = r.name_suffix && r.name_suffix.toLowerCase() !== 'none' ? ` ${r.name_suffix}` : '';
      return `${first}${middle}${last}${suffix}`.trim();
    };

    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      try {
        return new Date(dateStr).toLocaleDateString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
      } catch (e) {
        return dateStr;
      }
    };

    const formatArray = (arr) => {
      if (!arr) return '';
      if (Array.isArray(arr)) return arr.join(', ');
      return String(arr);
    };

    const formatBoolean = (val) => {
      if (val === true || val === '1' || val === 1) return 'Yes';
      if (val === false || val === '0' || val === 0) return 'No';
      return val ? 'Yes' : 'No';
    };

    // Helper functions for demographic analysis
    const getAgeGroup = (age) => {
      if (!age) return 'Unknown';
      const numAge = parseInt(age);
      if (numAge < 5) return 'Under 5 years old';
      if (numAge < 10) return '5-9 years old';
      if (numAge < 15) return '10-14 years old';
      if (numAge < 20) return '15-19 years old';
      if (numAge < 25) return '20-24 years old';
      if (numAge < 30) return '25-29 years old';
      if (numAge < 35) return '30-34 years old';
      if (numAge < 40) return '35-39 years old';
      if (numAge < 45) return '40-44 years old';
      if (numAge < 50) return '45-49 years old';
      if (numAge < 55) return '50-54 years old';
      if (numAge < 60) return '55-59 years old';
      if (numAge < 65) return '60-64 years old';
      if (numAge < 70) return '65-69 years old';
      if (numAge < 75) return '70-74 years old';
      if (numAge < 80) return '75-79 years old';
      return '80 years old and over';
    };

    const getSector = (resident) => {
      const age = parseInt(resident.age) || 0;
      const occupation = resident.occupation_type || '';
      const educational = resident.educational_attainment || '';
      
      // Labor Force (18-65 with occupation)
      if (age >= 18 && age <= 65 && occupation && occupation.toLowerCase() !== 'none' && occupation.toLowerCase() !== 'unemployed') {
        return 'Labor Force';
      }
      
      // Unemployed (18-65 without occupation)
      if (age >= 18 && age <= 65 && (!occupation || occupation.toLowerCase() === 'none' || occupation.toLowerCase() === 'unemployed')) {
        return 'Unemployed';
      }
      
      // Out-of-School Youth (15-24 without education or occupation)
      if (age >= 15 && age <= 24 && (!educational || educational.toLowerCase() === 'none' || educational.toLowerCase() === 'elementary')) {
        return 'Out-of-School Youth (OSY)';
      }
      
      // Out-of-School Children (6-14)
      if (age >= 6 && age <= 14) {
        return 'Out-of-School Children (OSC)';
      }
      
      // Persons with Disabilities
      if (resident.special_categories && Array.isArray(resident.special_categories) && 
          resident.special_categories.some(cat => cat.toLowerCase().includes('disability') || cat.toLowerCase().includes('pwd'))) {
        return 'Persons with Disabilities (PDWs)';
      }
      
      // Overseas Filipino Workers
      if (resident.special_categories && Array.isArray(resident.special_categories) && 
          resident.special_categories.some(cat => cat.toLowerCase().includes('ofw') || cat.toLowerCase().includes('overseas'))) {
        return 'Overseas Filipino Workers (OFWs)';
      }
      
      return 'Other';
    };

    // Create demographic summary data
    const demographicData = {
      totalResidents: items.length,
      registeredVoters: items.filter(r => r.voter_status && r.voter_status.toLowerCase() !== 'none').length,
      totalPopulation: items.length,
      totalHouseholds: new Set(items.map(r => r.household_no).filter(h => h)).size,
      totalFamilies: items.filter(r => r.head_of_family).length,
      
      // Age groups
      ageGroups: {},
      // Gender distribution
      genderDistribution: { Male: 0, Female: 0, Other: 0 },
      // Civil status
      civilStatus: {},
      // Sectors
      sectors: {}
    };

    // Process demographic data
    items.forEach(resident => {
      // Age groups
      const ageGroup = getAgeGroup(resident.age);
      demographicData.ageGroups[ageGroup] = (demographicData.ageGroups[ageGroup] || 0) + 1;
      
      // Gender
      const gender = resident.sex || 'Other';
      if (demographicData.genderDistribution[gender] !== undefined) {
        demographicData.genderDistribution[gender]++;
      } else {
        demographicData.genderDistribution.Other++;
      }
      
      // Civil status
      const civilStatus = resident.civil_status || 'Unknown';
      demographicData.civilStatus[civilStatus] = (demographicData.civilStatus[civilStatus] || 0) + 1;
      
      // Sectors
      const sector = getSector(resident);
      demographicData.sectors[sector] = (demographicData.sectors[sector] || 0) + 1;
    });

    // Create structured CSV content
    const csvRows = [];
    
    // Header
    csvRows.push(['BARANGAY DEMOGRAPHIC INFORMATION REPORT']);
    csvRows.push(['Generated on:', new Date().toLocaleDateString()]);
    csvRows.push(['Total Records:', items.length]);
    csvRows.push([]);
    
    // Section A-E: General Demographic Information
    csvRows.push(['I. GENERAL DEMOGRAPHIC INFORMATION']);
    csvRows.push(['A. No. of Registered Voters:', demographicData.registeredVoters]);
    csvRows.push(['B. No. of Population:', demographicData.totalPopulation]);
    csvRows.push(['C. With RBIs?:', 'No']);
    csvRows.push(['D. No. of Households:', demographicData.totalHouseholds]);
    csvRows.push(['E. No. of Families:', demographicData.totalFamilies]);
    csvRows.push([]);
    
    // Section F: Population by Age Bracket
    csvRows.push(['F. POPULATION BY AGE BRACKET']);
    csvRows.push(['AGE', 'MALE', 'FEMALE', 'TOTAL']);
    
    const ageGroups = [
      'Under 5 years old', '5-9 years old', '10-14 years old', '15-19 years old',
      '20-24 years old', '25-29 years old', '30-34 years old', '35-39 years old',
      '40-44 years old', '45-49 years old', '50-54 years old', '55-59 years old',
      '60-64 years old', '65-69 years old', '70-74 years old', '75-79 years old',
      '80 years old and over'
    ];
    
    ageGroups.forEach(ageGroup => {
      const maleCount = items.filter(r => getAgeGroup(r.age) === ageGroup && (r.sex === 'Male' || r.sex === 'male')).length;
      const femaleCount = items.filter(r => getAgeGroup(r.age) === ageGroup && (r.sex === 'Female' || r.sex === 'female')).length;
      const total = maleCount + femaleCount;
      csvRows.push([ageGroup, maleCount, femaleCount, total]);
    });
    csvRows.push([]);
    
    // Section G: Population by Sector
    csvRows.push(['G. POPULATION BY SECTOR']);
    csvRows.push(['SECTOR', 'MALE', 'FEMALE', 'TOTAL']);
    
    const sectorOrder = [
      'Labor Force', 'Unemployed', 'Out-of-School Youth (OSY)', 
      'Out-of-School Children (OSC)', 'Persons with Disabilities (PDWs)', 
      'Overseas Filipino Workers (OFWs)', 'Other'
    ];
    
    sectorOrder.forEach(sector => {
      const maleCount = items.filter(r => getSector(r) === sector && (r.sex === 'Male' || r.sex === 'male')).length;
      const femaleCount = items.filter(r => getSector(r) === sector && (r.sex === 'Female' || r.sex === 'female')).length;
      const total = maleCount + femaleCount;
      if (total > 0) {
        csvRows.push([sector, maleCount, femaleCount, total]);
      }
    });
    csvRows.push([]);
    
    // Detailed Resident Records
    csvRows.push(['DETAILED RESIDENT RECORDS']);
    csvRows.push([
      'Resident ID', 'Full Name', 'Age', 'Sex', 'Civil Status',
      'Birth Date', 'Birth Place', 'Email', 'Contact Number', 'Current Address',
      'Household No', 'Relation to Head',
      'Educational Attainment', 'Occupation Type', 'Sector Classification',
      'Verification Status', 'Last Modified'
    ]);
    
    items.forEach(resident => {
      csvRows.push([
        resident.resident_id || resident.id || '',
        toName(resident),
        resident.age || '',
        resident.sex || '',
        resident.civil_status || '',
        formatDate(resident.birth_date),
        resident.birth_place || '',
        resident.email || '',
        resident.contact_number || resident.mobile_number || '',
        resident.current_address || '',
        resident.household_no || '',
        resident.relation_to_head || '',
        resident.educational_attainment || '',
        resident.occupation_type || '',
        getSector(resident),
        resident.verification_status || 'Pending',
        formatDate(resident.last_modified || resident.updated_at)
      ]);
    });

    // Convert to CSV format
    const csvContent = csvRows
      .map(row => row.map(cell => {
        const cellStr = String(cell || '');
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n') || cellStr.includes('\r')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(','))
      .join('\r\n');

    // Create and download the file
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.csv`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (window.__showInfo) {
      window.__showInfo(`Demographic Excel report completed successfully! ${items.length} records exported with demographic analysis.`, 'Export Success', 'success');
    }

  } catch (e) {
    console.error('Excel export error:', e);
    if (window.__showInfo) window.__showInfo('Failed to export demographic Excel file.', 'Export Error', 'error'); else alert('Failed to export demographic Excel file.');
  }
}


const AvatarImg = ({ avatarPath }) => {
  const getAvatarUrl = (path) =>
    path && typeof path === 'string' && path.trim() !== '' && path.trim().toLowerCase() !== 'avatar' && path.trim().toLowerCase() !== 'avatars/'
      ? `http://localhost:8000/storage/${path}`
      : null;

  const avatarUrl = getAvatarUrl(avatarPath);
  const [imgSrc, setImgSrc] = useState(avatarUrl || '/default-avatar.png');

  useEffect(() => {
    setImgSrc(avatarUrl || '/default-avatar.png');
  }, [avatarUrl]);

  return (
    <img
      src={imgSrc}
      alt="avatar"
      className="w-12 h-12 rounded-full object-cover shadow-lg border-2 border-white"
      onError={() => setImgSrc('/default-avatar.png')}
    />
  );
};

// Actions Dropdown Component for Residents
const ActionsDropdown = ({ resident, onEdit, onDisable, onView }) => {
  const { user } = useAuth();
  const { canPerformAction } = usePermissions();
  const buttonRef = useRef(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [shouldFlipUp, setShouldFlipUp] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  // Check permissions for edit, view, and disable actions
  // For staff users, check specific action permissions
  // For admin users, always allow
  const isAdmin = user?.role === 'admin';
  const canEdit = isAdmin || canPerformAction('edit', 'residents', 'main_records');
  const canDisable = isAdmin || canPerformAction('disable', 'residents', 'main_records');
  const canView = isAdmin || canPerformAction('view', 'residents', 'main_records');
  
  // Debug logging for staff users
  if (user?.role === 'staff') {
    const perms = user?.module_permissions || {};
    console.log('ActionsDropdown permissions check:', {
      userRole: user?.role,
      isAdmin,
      canEdit,
      canDisable,
      canView,
      module_permissions: perms,
      residentsRecords_main_records_edit: perms.residentsRecords_main_records_edit,
      residentsRecords_main_records_disable: perms.residentsRecords_main_records_disable,
      residentsRecords_main_records_view: perms.residentsRecords_main_records_view,
      allResidentsKeys: Object.keys(perms).filter(k => k.includes('residents')),
      // Test the permission check directly
      testEdit: canPerformAction('edit', 'residents', 'main_records'),
      testDisable: canPerformAction('disable', 'residents', 'main_records'),
      testView: canPerformAction('view', 'residents', 'main_records')
    });
  }

  // Calculate dropdown position when opened
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const updatePosition = () => {
        const buttonRect = buttonRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const dropdownHeight = 150; // Approximate dropdown height
        
        // Check if dropdown would overflow bottom of viewport
        const wouldOverflow = buttonRect.bottom + dropdownHeight > viewportHeight;
        setShouldFlipUp(wouldOverflow);

        // Calculate position
        setDropdownPosition({
          top: wouldOverflow ? buttonRect.top - dropdownHeight : buttonRect.bottom + 4,
          left: buttonRect.right - 224, // 224px = w-56 (14rem)
        });
      };

      updatePosition();

      // Update position on scroll or resize
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);

      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen]);

  const DropdownContent = ({ children }) => {
    if (!isOpen) return null;

    return createPortal(
      <div
        style={{
          position: 'fixed',
          top: `${dropdownPosition.top}px`,
          left: `${dropdownPosition.left}px`,
          zIndex: 9999,
        }}
      >
        {children}
      </div>,
      document.body
    );
  };

  // Build menu items based on permissions
  const menuItems = [];
  
  // Add View action if user has view permission
  if (canView) {
    menuItems.push({
      label: 'View',
      icon: EyeIcon,
      onClick: () => {
        const residentId = resident?.id || resident?.user_id;
        if (residentId && onView) {
          onView(residentId);
        }
      },
      className: 'text-gray-700 hover:bg-blue-50 hover:text-blue-700',
    });
  }
  
  // Add Edit action if user has edit permission
  if (canEdit) {
    menuItems.push({
      label: 'Edit',
      icon: PencilIcon,
      onClick: () => onEdit?.(resident),
      className: 'text-gray-700 hover:bg-yellow-50 hover:text-yellow-700',
    });
  }
  
  // Add Disable action if user has disable permission
  if (canDisable) {
    menuItems.push({
      label: 'Disable',
      icon: TrashIcon,
      onClick: () => {
        console.log('Disable clicked, resident object:', resident);
        console.log('Resident ID:', resident?.id, 'Type:', typeof resident?.id);
        const residentId = resident?.id || resident?.user_id;
        if (!residentId) {
          console.error('No resident ID found in resident object:', resident);
          return;
        }
        onDisable?.(residentId);
      },
      className: 'text-gray-700 hover:bg-red-50 hover:text-red-700',
    });
  }
  
  // Debug: Log menu items for staff users
  if (user?.role === 'staff') {
    console.log('ActionsDropdown menu items:', {
      menuItemsCount: menuItems.length,
      menuItems: menuItems.map(item => item.label),
      canView,
      canEdit,
      canDisable,
      hasModulePermissions: !!user?.module_permissions,
      modulePermissionsKeys: Object.keys(user?.module_permissions || {}),
      residentsKeys: Object.keys(user?.module_permissions || {}).filter(k => k.includes('residents'))
    });
  }
  
  // If no actions are available, don't show the dropdown
  if (menuItems.length === 0) {
    if (user?.role === 'staff') {
      console.warn('ActionsDropdown: No menu items available - all permissions are false', {
        canView,
        canEdit,
        canDisable,
        module_permissions: user?.module_permissions,
        userObject: user
      });
    }
    return null;
  }

  return (
    <Menu as="div" className="relative inline-block text-left">
      {({ open }) => {
        // Update isOpen state when menu opens/closes
        useEffect(() => {
          setIsOpen(open);
        }, [open]);

        return (
          <>
            <Menu.Button
              ref={buttonRef}
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gray-100 text-gray-600 hover:text-gray-800 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200 shadow-sm hover:shadow-md"
              aria-label="More actions"
            >
              <ChevronDownIcon className="w-5 h-5" />
            </Menu.Button>

            <DropdownContent>
              <Transition
                show={open}
                as={Fragment}
                enter="transition ease-out duration-200"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-150"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Menu.Items
                  className={`w-56 rounded-xl bg-white shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none overflow-hidden ${
                    shouldFlipUp ? 'origin-bottom-right' : 'origin-top-right'
                  }`}
                  static
                >
                  <div className="py-1">
                    {menuItems.map((item) => {
                      return (
                        <Menu.Item key={item.label}>
                          {({ active }) => (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                item.onClick();
                              }}
                              className={`${item.className} group flex items-center w-full px-4 py-2.5 text-sm font-medium transition-all duration-150 ${
                                active ? 'translate-x-1' : ''
                              }`}
                            >
                              <item.icon
                                className="mr-3 h-5 w-5 flex-shrink-0 text-gray-400 group-hover:text-current"
                                aria-hidden="true"
                              />
                              <span className="flex-1 text-left">{item.label}</span>
                            </button>
                          )}
                        </Menu.Item>
                      );
                    })}
                  </div>
                </Menu.Items>
              </Transition>
            </DropdownContent>
          </>
        );
      }}
    </Menu>
  );
};
// Main component wrapper
const ResidentsRecords = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, forceRefresh } = useAuth();
  const { canPerformAction } = usePermissions();
  const { mainClasses } = useAdminResponsiveLayout();
  
  // Ensure permissions are loaded for staff users
  useEffect(() => {
    if (user?.role === 'staff' && (!user?.module_permissions || Object.keys(user.module_permissions).length <= 1)) {
      console.log('ResidentsRecords: Staff user permissions not loaded, refreshing...');
      forceRefresh().catch(err => {
        console.error('Failed to refresh user permissions:', err);
      });
    }
  }, [user?.role, user?.module_permissions, forceRefresh]);
  
  // Handle section query parameter for navigation
  useEffect(() => {
    const section = searchParams.get('section');
    if (section === 'verification') {
      navigate('/admin/resident-records/verification');
    } else if (section === 'disabled') {
      navigate('/admin/resident-records/disabled-residents');
    }
    // If section is 'main' or no section, stay on this page (default behavior)
    
    // Handle showRecords query parameter to show/hide resident records table
    const showRecords = searchParams.get('showRecords');
    if (showRecords === 'true') {
      setShowResidentRecords(true);
      localStorage.setItem('showResidentRecords', JSON.stringify(true));
    } else if (showRecords === 'false') {
      setShowResidentRecords(false);
      localStorage.setItem('showResidentRecords', JSON.stringify(false));
    }
  }, [searchParams, navigate]);
  // Enhanced state management with better error handling
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Pagination state for Resident Records
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  
  // Pagination state for User Accounts
  const [usersCurrentPage, setUsersCurrentPage] = useState(1);
  const [usersItemsPerPage, setUsersItemsPerPage] = useState(10);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  
  // Help system state
  const [showHelpGuide, setShowHelpGuide] = useState(false);
  const [showQuickStart, setShowQuickStart] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);
  const [showFeatureExplanation, setShowFeatureExplanation] = useState(false);
  const [currentFeatureExplanation, setCurrentFeatureExplanation] = useState(null);
  
  
  // Use custom hook for API calls
  const { execute: executeApiCall, loading: apiLoading, error: apiError } = useApiCall();

  // Analytics and reporting state
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [reportFilters, setReportFilters] = useState({
    update_status: '',
    verification_status: '',
    year: '',
    month: '',
    sort_by: 'last_modified',
    sort_order: 'desc'
  });
  const [reportData, setReportData] = useState([]);
  const [fetchingReports, setFetchingReports] = useState(false);

  // User management state
  const [residentsUsers, setResidentsUsers] = useState([]);
  const [residentsUsersLoading, setResidentsUsersLoading] = useState(false);
  const [showResidentsUsers, setShowResidentsUsers] = useState(false);
  const [showResidentRecords, setShowResidentRecords] = useState(() => {
    // Try to get from localStorage, default to true
    const saved = localStorage.getItem('showResidentRecords');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Modal and form state
  const [selectedResident, setSelectedResident] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editData, setEditData] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [showSelectModal, setShowSelectModal] = useState(false);
  const [usersWithoutProfiles, setUsersWithoutProfiles] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');

  // Verification state
  const [comment, setComment] = useState('');
  const [currentResidentId, setCurrentResidentId] = useState(null);
  const [showCommentModal, setShowCommentModal] = useState(false);
  // Generic info modal state (replaces window.alert)
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoModal, setInfoModal] = useState({ title: '', message: '', type: 'info' });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  const showInfo = useCallback((message, title = 'Notice', type = 'info') => {
    setInfoModal({ title, message: typeof message === 'string' ? message : JSON.stringify(message), type });
    setShowInfoModal(true);
  }, []);

  const closeInfo = () => setShowInfoModal(false);

  const openConfirm = (residentId) => {
    setPendingDeleteId(residentId);
    setShowConfirmModal(true);
  };

  const closeConfirm = () => {
    setPendingDeleteId(null);
    setShowConfirmModal(false);
  };

  // Expose showInfo globally so module-level helpers (exportToCSV/PDF) can call it when component is mounted
  useEffect(() => {
    window.__showInfo = showInfo;
    return () => { delete window.__showInfo; };
  }, []);
  
  // Enhanced verification handling with better error handling and validation
  const handleVerification = async (residentId, status) => {
    try {
      // Validate inputs
      if (!residentId || !status) {
        throw new Error('Invalid resident ID or status');
      }
      
      if (!['approved', 'denied', 'pending'].includes(status)) {
        throw new Error('Invalid verification status');
      }

      // Validate comment for denied status
      if (status === 'denied' && (!comment || comment.trim().length < 5)) {
        toast.error('Please provide a reason for denial (minimum 5 characters)');
        return;
      }

      const response = await executeApiCall(async (signal) => {
        return await fetch(`http://localhost:8000/api/residents/${residentId}/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify({ 
            status,
            comment: comment ? sanitizeData.string(comment) : undefined
          }),
          signal
        });
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: Failed to update verification status`);
      }

      const result = await response.json();
      
      // Update the resident in the local state
      setResidents(prevResidents => 
        prevResidents.map(resident => 
          resident.id === residentId 
            ? { ...resident, verification_status: status }
            : resident
        )
      );

      // Show success message
      toast.success(result.message || 'Verification status updated successfully');
      
      // Close any open modals
      setShowCommentModal(false);
      setComment('');
      
      // Refresh the residents list to get updated data
      fetchResidents();
      
    } catch (error) {
      console.error('Error updating verification status:', error);
      const errorMessage = error.message || 'Failed to update verification status';
      toast.error(errorMessage);
      setError(errorMessage);
    }
  };

  // Image modal state
  const [selectedImage, setSelectedImage] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);

  // Enhanced filtering with memoization for better performance
  const filteredResidents = useMemo(() => {
    if (!Array.isArray(residents) || residents.length === 0) {
      return [];
    }

    let list = residents.slice();
    
    // Search filter with debouncing effect
    if (search && search.trim() !== '') {
      const searchTerm = sanitizeData.string(search).toLowerCase();
      list = list.filter((r) => {
        if (!r) return false;
        const fullName = formatResidentName(r).toLowerCase();
        const email = (r.email || '').toLowerCase();
        const residentId = (r.resident_id || r.id || '').toLowerCase();
        
        return fullName.includes(searchTerm) || 
               email.includes(searchTerm) || 
               residentId.includes(searchTerm);
      });
    }
    
    // Status filter with validation
    if (statusFilter && statusFilter !== '') {
      if (statusFilter === 'for_review') {
        list = list.filter((r) => Boolean(r.for_review));
      } else if (['active', 'outdated', 'needs_verification'].includes(statusFilter)) {
        list = list.filter((r) => {
          const status = (r.update_status || getResidentStatus(r)).toLowerCase().replace(/\s+/g, '_');
          return status === statusFilter;
        });
      }
    }
    
    return list;
  }, [residents, search, statusFilter]);



  const handleFilterChange = (key, value) => {
    setReportFilters((prev) => {
      const newFilters = { ...prev, [key]: value };
      if (key === 'year') {
        newFilters.month = '';
      }
      return newFilters;
    });
  };

  const fetchReports = async () => {
    setFetchingReports(true);
    try {
      const res = await axiosInstance.get('/admin/residents/report', { params: reportFilters });
      setReportData(Array.isArray(res.data.residents) ? res.data.residents : []);
    } catch (err) {
      console.error('Failed to fetch reports', err);
      setReportData([]);
    } finally {
      setFetchingReports(false);
    }
  };

  // Pagination functions for Resident Records
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (items) => {
    setItemsPerPage(items);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  // Pagination functions for User Accounts
  const handleUsersPageChange = (page) => {
    setUsersCurrentPage(page);
  };

  const handleUsersItemsPerPageChange = (items) => {
    setUsersItemsPerPage(items);
    setUsersCurrentPage(1);
  };

  // Pagination functions for Deleted Records

  // Get filtered and paginated residents
  const getFilteredResidents = () => {
    let filtered = residents;

    // Apply search filter
    if (search) {
      filtered = filtered.filter(resident => 
        resident.first_name?.toLowerCase().includes(search.toLowerCase()) ||
        resident.last_name?.toLowerCase().includes(search.toLowerCase()) ||
        resident.resident_id?.toLowerCase().includes(search.toLowerCase()) ||
        resident.email?.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter) {
      if (statusFilter === 'for_review') {
        filtered = filtered.filter(resident => Boolean(resident.for_review));
      } else {
        filtered = filtered.filter(resident => {
          const status = getResidentStatus(resident).toLowerCase().replace(/\s+/g, '_');
          return status === statusFilter;
        });
      }
    }

    return filtered;
  };

  const getPaginatedResidents = () => {
    const filtered = getFilteredResidents();
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filtered.slice(startIndex, endIndex);
  };

  // Get paginated users for User Accounts
  const getPaginatedUsers = () => {
    const startIndex = (usersCurrentPage - 1) * usersItemsPerPage;
    const endIndex = startIndex + usersItemsPerPage;
    return residentsUsers.slice(startIndex, endIndex);
  };


  // Update total pages when residents or filters change
  useEffect(() => {
    const filtered = getFilteredResidents();
    const total = Math.ceil(filtered.length / itemsPerPage);
    setTotalPages(total);
    
    // If current page is greater than total pages, reset to last page
    if (currentPage > total && total > 0) {
      setCurrentPage(total);
    }
  }, [residents, search, statusFilter, itemsPerPage, currentPage]);

  // Update total pages for User Accounts
  useEffect(() => {
    const total = Math.ceil(residentsUsers.length / usersItemsPerPage);
    setUsersTotalPages(total);
    
    if (usersCurrentPage > total && total > 0) {
      setUsersCurrentPage(total);
    }
  }, [residentsUsers, usersItemsPerPage, usersCurrentPage]);


  const [selectedImageTitle, setSelectedImageTitle] = useState('');
  const [imageLoading, setImageLoading] = useState(false);
  // Toggle for showing/hiding report filters UI
  const [showReportFilters, setShowReportFilters] = useState(false);

  // Analytics state
  const [chartData, setChartData] = useState([]);
  const [selectedChartType, setSelectedChartType] = useState('registrations');
  const [selectedCategory, setSelectedCategory] = useState('gender');
  // Analytics filters for Registration Analytics
  const [selectedAnalyticsYear, setSelectedAnalyticsYear] = useState('');
  const [selectedAnalyticsMonth, setSelectedAnalyticsMonth] = useState(0); // 0 means no month selected

  // Verify resident user's residency
  const handleVerifyUser = async (profileId, userId) => {
    try {
      // First, approve the profile verification
      const response = await fetch(`http://localhost:8000/api/residents/verify/${profileId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          status: 'approved',
          notify: true // Enable notification to the resident
        })
      });

      if (!response.ok) {
        throw new Error('Failed to verify residency');
      }

      const result = await response.json();
      
      // Update both the profile and resident verification status
      const profileResponse = await fetch(`http://localhost:8000/api/profiles/${profileId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          verification_status: 'approved',
          profileId: profileId,
          userId: userId
        })
      });

      if (!profileResponse.ok) {
        throw new Error('Failed to update profile status');
      }

      toast.success('Residency verification approved successfully. Resident can now complete their profile.');
      
      // Refresh both residents and users data
      await fetchResidentsUsers();
      await fetchResidents();

    } catch (error) {
      console.error('Error verifying residency:', error);
      toast.error('Failed to verify residency: ' + error.message);
    }
  };

  // Analytics computed data - memoized for performance
  const analyticsData = useMemo(() => ({
    gender: {
      male: residents.filter(r => r.sex?.toLowerCase() === 'male').length,
      female: residents.filter(r => r.sex?.toLowerCase() === 'female').length,
      other: residents.filter(r => r.sex && !['male','female'].includes(r.sex.toLowerCase())).length,
    },
    civil: {
      single: residents.filter(r => r.civil_status?.toLowerCase() === 'single').length,
      married: residents.filter(r => r.civil_status?.toLowerCase() === 'married').length,
      widowed: residents.filter(r => r.civil_status?.toLowerCase() === 'widowed').length,
      divorced: residents.filter(r => r.civil_status?.toLowerCase() === 'divorced').length,
      separated: residents.filter(r => r.civil_status?.toLowerCase() === 'separated').length,
    },
    age: {
      children: residents.filter(r => r.age < 13).length,
      teens: residents.filter(r => r.age >= 13 && r.age < 20).length,
      adults: residents.filter(r => r.age >= 20 && r.age < 60).length,
      seniors: residents.filter(r => r.age >= 60).length,
    },
    voter: {
      registered: residents.filter(r => r.voter_status?.toLowerCase() === 'registered').length,
      unregistered: residents.filter(r => r.voter_status?.toLowerCase() === 'unregistered').length,
      active: residents.filter(r => r.voter_status?.toLowerCase() === 'active').length,
      inactive: residents.filter(r => r.voter_status?.toLowerCase() === 'inactive').length,
    }
  }), [residents]);
  

  // Update chart data when residents, year, or month changes
  useEffect(() => {
    if (residents.length > 0) {
      setChartData(generateChartData(residents, selectedAnalyticsYear, selectedAnalyticsMonth));
    }
  }, [residents, selectedAnalyticsYear, selectedAnalyticsMonth]);

  // Analytics options object
  const analyticsOptions = {
    gender: {
      key: 'gender',
      label: 'Gender',
      value: analyticsData.gender.male + analyticsData.gender.female + analyticsData.gender.other,
      icon: <UserIcon className="w-6 h-6 text-green-600" />,
      iconBg: 'bg-green-50',
      details: (
        <div className="pl-4 pt-2 text-sm space-y-1">
          <div>Male: <span className="font-bold">{analyticsData.gender.male}</span></div>
          <div>Female: <span className="font-bold">{analyticsData.gender.female}</span></div>
          <div>Other Gender: <span className="font-bold">{analyticsData.gender.other}</span></div>
        </div>
      )
    },
    civil: {
      key: 'civil',
      label: 'Civil Status',
      value: analyticsData.civil.single + analyticsData.civil.married + analyticsData.civil.widowed + analyticsData.civil.divorced + analyticsData.civil.separated,
      icon: <HeartIcon className="w-6 h-6 text-pink-600" />,
      iconBg: 'bg-pink-50',
      details: (
        <div className="pl-4 pt-2 text-sm space-y-1">
          <div>Single: <span className="font-bold">{analyticsData.civil.single}</span></div>
          <div>Married: <span className="font-bold">{analyticsData.civil.married}</span></div>
          <div>Widowed: <span className="font-bold">{analyticsData.civil.widowed}</span></div>
          <div>Divorced: <span className="font-bold">{analyticsData.civil.divorced}</span></div>
          <div>Separated: <span className="font-bold">{analyticsData.civil.separated}</span></div>
        </div>
      )
    },
    age: {
      key: 'age',
      label: 'Age Group',
      value: analyticsData.age.children + analyticsData.age.teens + analyticsData.age.adults + analyticsData.age.seniors,
      icon: <UserIcon className="w-6 h-6 text-blue-600" />,
      iconBg: 'bg-blue-50',
     details: (
       <div className="pl-4 pt-2 text-sm space-y-1">
         <div>Children (under 13): <span className="font-bold">{analyticsData.age.children}</span></div>
         <div>Teens (13-19): <span className="font-bold">{analyticsData.age.teens}</span></div>
         <div>Adults (20-59): <span className="font-bold">{analyticsData.age.adults}</span></div>
         <div>Seniors (60+): <span className="font-bold">{analyticsData.age.seniors}</span></div>
       </div>
     )
    },
  };

  const fetchResidents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await executeApiCall(async (signal) => {
        // Use staff-specific endpoint for staff users, admin endpoint for admin users
        const endpoint = user?.role === 'staff' ? "/staff/residents-list" : "/admin/residents-list";
        return await axiosInstance.get(endpoint, { signal });
      });
      
      // If request was cancelled, don't update state
      if (!res) {
        return;
      }
      
      const fetched = Array.isArray(res.data.residents) ? res.data.residents : [];
      
      // Validate and sanitize data
      const validatedResidents = fetched
        .filter(resident => 
          resident && 
          typeof resident === 'object' && 
          (resident.id || resident.resident_id)
        )
        .map(resident => {
          // Ensure we have an id field (use primary key id, not profile id)
          if (!resident.id && resident.resident_id) {
            console.warn('Resident missing id field:', resident);
          }
          return {
            ...resident,
            id: resident.id || null // Explicitly set id field
          };
        });
      
      // Attach computed update_status to each resident for consistent UI
      const withStatus = validatedResidents.map((r) => ({ 
        ...r, 
        update_status: getResidentStatus(r),
        // Sanitize string fields
        first_name: sanitizeData.string(r.first_name),
        last_name: sanitizeData.string(r.last_name),
        middle_name: sanitizeData.string(r.middle_name),
        email: sanitizeData.string(r.email)
      }));
      
      setResidents(withStatus);
      setChartData(generateChartData(withStatus, selectedAnalyticsYear, selectedAnalyticsMonth));
      
    } catch (err) {
      console.error("Error loading residents:", err);
      setError(err.message || 'Failed to load residents data');
      toast.error('Failed to load residents data');
    } finally {
      setLoading(false);
    }
  }, [selectedAnalyticsYear, selectedAnalyticsMonth, user?.role]);

  // Initial data fetch
  useEffect(() => {
    fetchResidents();
  }, [fetchResidents]);
  
  

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && showImageModal) {
        setShowImageModal(false);
        setSelectedImage(null);
        setSelectedImageTitle('');
        setImageLoading(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showImageModal]);


  const fetchResidentsUsers = async () => {
    try {
      setResidentsUsersLoading(true);
      const res = await axiosInstance.get("/admin/residents-users");
      
      // Ensure we have valid data before updating state
      if (res.data && Array.isArray(res.data.users)) {
        console.log("Fetched residents users data:", res.data.users);
        
        // Map the data to ensure all required fields are present
        const processedUsers = res.data.users.map(user => ({
          ...user,
          profile: user.profile ? {
            ...user.profile,
            verification_status: user.profile.verification_status || 'pending'
          } : null
        }));
        
        setResidentsUsers(processedUsers);
      } else {
        console.error("Invalid data format received:", res.data);
        toast.error("Error loading residents data. Please try again.");
      }
    } catch (err) {
      console.error("Error loading residents users:", err);
      toast.error("Failed to load residents data. Please refresh the page.");
    } finally {
      setResidentsUsersLoading(false);
    }
  };


  const handleShowDetails = (residentId) => {
    console.log('handleShowDetails called with ID:', residentId);
    
    // Check if user has view permission (for staff users)
    if (user?.role === 'staff') {
      const canView = canPerformAction('view', 'residents', 'main_records');
      console.log('View permission check:', {
        canView,
        permissions: user?.module_permissions,
        residentsRecords_main_records_view: user?.module_permissions?.residentsRecords_main_records_view
      });
      if (!canView) {
        toast.error('You do not have permission to view resident details');
        return;
      }
    }
    
    // If clicking the same resident, toggle close
    if (selectedResident?.id === residentId) {
      console.log('Closing details for resident:', residentId);
      setSelectedResident(null);
      return;
    }

    // Find the resident in the already loaded residents array
    const resident = residents.find(r => r.id === residentId);
    
    if (!resident) {
      console.error('Resident not found in local state:', residentId);
      toast.error('Resident details not available');
      return;
    }
    
    // Check if residency verification is denied
    if (resident.verification_status === 'denied') {
      showInfo("This resident's residency verification has been denied. Details cannot be viewed.", 'Verification', 'info');
      return;
    }
    
    console.log('Setting selected resident:', resident);
    setSelectedResident(resident);
  };

  const handleUpdate = (resident) => {
    // Check if residency verification is denied
    if (resident.verification_status === 'denied') {
      showInfo("This resident's residency verification has been denied. Profile cannot be edited.", 'Verification', 'info');
      return;
    }
    
    setEditData({
      id: resident.id,
      user_id: resident.user_id,
      first_name: resident.first_name,
      middle_name: resident.middle_name || "",
      last_name: resident.last_name,
      name_suffix: resident.name_suffix || "",
      birth_date: resident.birth_date,
      birth_place: resident.birth_place,
      age: resident.age,
      nationality: resident.nationality || "",
      email: resident.email,
      mobile_number: resident.mobile_number,
      sex: resident.sex,
      civil_status: resident.civil_status,
      religion: resident.religion,
      current_address: resident.current_address,
      years_in_barangay: resident.years_in_barangay,
      voter_status: resident.voter_status,
      household_no: resident.household_no,
      avatar: null,

      housing_type: resident.housing_type || "",
      classified_sector: resident.classified_sector || "",
      educational_attainment: resident.educational_attainment || "",
      occupation_type: resident.occupation_type || "",
      business_name: resident.business_name || "",
      business_type: resident.business_type || "",
      business_address: resident.business_address || "",

      special_categories: resident.special_categories || [],
      head_of_family: resident.head_of_family === 1,
      business_outside_barangay: resident.business_outside_barangay === 1,

      vaccination_status: resident.vaccination_status || "",
      vaccine_received: resident.vaccine_received || [],
      year_vaccinated: resident.year_vaccinated || "",
      other_vaccine: resident.other_vaccine || "",
    });
    setShowModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (type === "checkbox" && name === "special_categories") {
      setEditData((prev) => {
        const prevCategories = prev.special_categories || [];
        return {
          ...prev,
          special_categories: checked
            ? [...prevCategories, value]
            : prevCategories.filter((item) => item !== value),
        };
      });
    } else if (type === "radio" && name === "vaccine_received") {
      setEditData((prev) => ({
        ...prev,
        vaccine_received: value === "None" ? ["None"] : [value],
      }));
    } else {
      setEditData((prev) => ({
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      }));
    }
  };

  // ✅ Check profile existence before creation
  const checkIfProfileExists = async (userId) => {
    try {
      const res = await axiosInstance.get(`/admin/users/${userId}/has-profile`);
      return res.data.exists;
    } catch {
      return false;
    }
  };

  const handleSave = async () => {
    try {
      console.log('ResidentsRecords: Starting save process with editData:', editData);
      const formData = new FormData();
      if (Array.isArray(editData.vaccine_received)) {
        let vaccines = [...editData.vaccine_received];
        if (vaccines.includes("None")) {
          vaccines = ["None"];
        } else {
          vaccines = vaccines.filter((v) => v !== "None");
        }
        vaccines.forEach((v) => formData.append("vaccine_received[]", v));
      }
      // Ensure household_no is always present and not null/undefined
      const safeEditData = { ...editData, household_no: editData.household_no ?? "" };
      Object.entries(safeEditData).forEach(([key, value]) => {
        if (key === "vaccine_received" || key === "avatar") return;
        
        // Use the key as-is since backend validation expects mobile_number
        let backendKey = key;
        
        if (Array.isArray(value)) {
          value.forEach((item) => {
            if (item !== null && item !== "") {
              formData.append(`${backendKey}[]`, item);
            }
          });
        } else if (typeof value === "boolean") {
          formData.append(backendKey, value ? "1" : "0");
        } else if (value !== null && value !== undefined) {
          formData.append(backendKey, value);
        }
      });
      
      // Handle avatar/photo upload - backend expects 'current_photo' field
      if (editData.avatar && editData.avatar instanceof File) {
        formData.append('current_photo', editData.avatar);
        console.log('ResidentsRecords: Added avatar as current_photo to FormData');
      } else if (editData.current_photo && editData.current_photo instanceof File) {
        formData.append('current_photo', editData.current_photo);
        console.log('ResidentsRecords: Added current_photo to FormData');
      }
      
      // Debug: Log all FormData entries
      console.log('ResidentsRecords: FormData contents:');
      for (let [key, value] of formData.entries()) {
        console.log(`${key}:`, value);
      }
      
      if (editData.id) {
        // Update existing resident profile
        await axiosInstance.put(
          `/admin/residents/${editData.id}`,
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
          }
        );
      } else if (editData.user_id && !editData.id) {
        // Create new resident profile for existing user
        const alreadyExists = await checkIfProfileExists(editData.user_id);
        if (alreadyExists) {
          showInfo("❌ This user already has a resident profile.", 'Create Profile', 'error');
          return;
        }
        console.log('ResidentsRecords: Sending POST request to /residents/complete-profile');
        const response = await axiosInstance.post(
          "/residents/complete-profile",
          formData,
          { headers: { "Content-Type": "multipart/form-data" } }
        );
        console.log('ResidentsRecords: API response:', response.data);
      } else {
        throw new Error("Invalid data: Missing resident ID or user ID");
      }
  showInfo("✅ Resident profile saved successfully.", 'Saved', 'success');
      setShowModal(false);
      fetchResidents();
    } catch (err) {
      // Enhanced error display for validation errors
      const errorMsg = err.response?.data?.message || err.message;
      let errorDetails = "No error details provided.";
      
      // Handle integrity constraint violation specifically
      if (err.response?.status === 409 || (err.response?.data?.error && err.response.data.error.includes('Integrity constraint violation'))) {
        if (err.response.data.error.includes('user_id') || err.response.data.message?.includes('already has a resident profile')) {
          showInfo("❌ This user already has a resident profile. Please select a different user or update the existing profile.", 'Profile Already Exists', 'error');
          return;
        }
      }
      
      if (err.response?.data?.errors) {
        errorDetails = Object.entries(err.response.data.errors)
          .map(([field, msgs]) => `${field}: ${msgs.join(', ')}`)
          .join('\n');
      } else if (err.response?.data?.error) {
        errorDetails = err.response.data.error;
      }
      console.error("❌ Save failed:", err.response?.data || err);
      showInfo(`❌ Failed to save resident.\n${errorMsg}\nDetails:\n${errorDetails}`, 'Save Error', 'error');
    }
  };

  const handleAddResidentClick = async () => {
    const users = await fetchUsersWithoutProfiles();
    if (users.length > 0) {
      setUsersWithoutProfiles(users);
      setSelectedUserId("");
      setShowSelectModal(true);
    } else {
      showInfo("✅ All users already have resident profiles.", 'Info', 'info');
    }
  };

  const fetchUsersWithoutProfiles = async () => {
    try {
      const res = await axiosInstance.get("/admin/users-without-profiles");
      return res.data.users;
    } catch (err) {
      console.error("Failed to fetch users without profiles:", err);
      return [];
    }
  };

  const handleApprove = async (residentId) => {
    if (!residentId) {
      toast.error('Invalid resident ID');
      return;
    }

    try {
      setResidentsUsersLoading(true);
      
      // Step 1: Call approval endpoint
      const response = await axiosInstance.post(`/admin/residents/${residentId}/approve-verification`);
      
      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Failed to approve verification');
      }

      console.log('Approval response:', response.data);

      // Step 2: Update local state immediately for both profile and resident
      setResidentsUsers(prevUsers => 
        prevUsers.map(user => {
          // Check if this user matches the approved resident/profile
          const isMatchingUser = 
            user.profile?.id === residentId || 
            user.resident?.id === residentId ||
            user.profile?.resident_id === residentId ||
            user.resident?.profile_id === residentId;
            
          if (isMatchingUser) {
            console.log('Updating user verification status:', {
              email: user.email,
              beforeProfileStatus: user.profile?.verification_status,
              beforeResidentStatus: user.resident?.verification_status,
              residentId: residentId
            });
            return {
              ...user,
              profile: {
                ...user.profile,
                verification_status: 'approved',
                denial_reason: null
              },
              resident: {
                ...user.resident,
                verification_status: 'approved',
                denial_reason: null
              }
            };
          }
          return user;
        })
      );
      
      // Step 3: Show success message
      toast.success('Verification approved successfully. Resident can now complete their profile.');
      
      // Step 4: Refresh all data to ensure consistency
      await Promise.all([
        fetchResidents(),
        fetchResidentsUsers()
      ]);
      
      // Step 5: Force a small delay and refresh again to ensure data consistency
      setTimeout(async () => {
        await fetchResidentsUsers();
      }, 1000);
      
    } catch (err) {
      console.error('Failed to approve:', err);
      toast.error(err.message || 'Failed to approve verification');
    } finally {
      setResidentsUsersLoading(false);
    }
  };

  const handleDeny = (residentId) => {
    setCurrentResidentId(residentId);
    setComment("");
    setShowCommentModal(true);
  };

  const handleDenySubmit = async () => {
    if (!comment.trim()) {
      showInfo("Please provide a reason for denial.", 'Validation', 'error');
      return;
    }

    console.log('Denying verification for ID:', currentResidentId, 'with comment:', comment);

    try {
      const response = await axiosInstance.post(`/admin/residents/${currentResidentId}/deny-verification`, {
        comment: comment
      });
      
      console.log('Denial response:', response.data);
      showInfo("Residency verification denied successfully.", 'Denied', 'success');
      setShowCommentModal(false);
      // Refresh both datasets so admin tables reflect changes
      fetchResidents();
      fetchResidentsUsers();
    } catch (err) {
      console.error("Failed to deny residency verification:", err);
      console.error("Error details:", {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message
      });
      showInfo("Failed to deny residency verification.", 'Error', 'error');
    }
  };

  // Triggers the confirm modal
  const handleDelete = (residentId) => {
    console.log('handleDelete called with residentId:', residentId, 'Type:', typeof residentId);
    if (!residentId) {
      console.error('No resident ID provided to handleDelete');
      showInfo('Error: No resident ID provided', 'Error', 'error');
      return;
    }
    openConfirm(residentId);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return closeConfirm();
    try {
      console.log('Attempting to disable resident with ID:', pendingDeleteId, 'Type:', typeof pendingDeleteId);
      const response = await axiosInstance.post(`/admin/residents/${pendingDeleteId}/delete`);
      console.log('Disable resident response:', response.data);
      showInfo('Resident disabled successfully.', 'Disabled', 'success');
      fetchResidents();
    } catch (err) {
      console.error('Failed to disable resident:', err);
      console.error('Error response:', err.response?.data);
      console.error('Error status:', err.response?.status);
      const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || 'Unknown error';
      showInfo(`Failed to disable resident: ${errorMessage}`, 'Disable Error', 'error');
    } finally {
      closeConfirm();
    }
  };

  const handleConfirmSelection = async () => {
    if (!selectedUserId) {
      showInfo("❌ Please select a user.", 'Validation', 'error');
      return;
    }

    try {
      const res = await axiosInstance.get(`/user/${selectedUserId}`);
      const user = res.data.user;

      setEditData({
        user_id: user.id,
        first_name: "",
        middle_name: "",
        last_name: "",
        name_suffix: "",
        birth_date: "",
        birth_place: "",
        age: "",
        nationality: "",
        email: user.email || "",
        mobile_number: "",
        sex: "",
        civil_status: "",
        religion: "",
        current_address: "",
        years_in_barangay: "",
        voter_status: "",
        household_no: "",
        avatar: null,

        housing_type: "",
        classified_sector: "",
        educational_attainment: "",
        occupation_type: "",
        business_name: "",
        business_type: "",
        business_address: "",

        special_categories: [],
        head_of_family: false,
        business_outside_barangay: false,

        vaccination_status: "",
        vaccine_received: [],
        year_vaccinated: "",
        other_vaccine: "",
      });

      setShowSelectModal(false);
      setShowModal(true);
    } catch (err) {
      console.error("❌ Failed to load selected user:", err);
      showInfo("❌ Could not load user information.", 'Error', 'error');
    }
  };

  // Utility to check if avatar path is valid (not empty, not null, not just 'avatar' or 'avatars/')
  const isValidAvatarPath = (path) => {
    if (!path) return false;
    if (typeof path !== 'string') return false;
    if (path.trim() === '' || path.trim().toLowerCase() === 'avatar' || path.trim().toLowerCase() === 'avatars/') return false;
    return true;
  };

  // Returns the full URL for the avatar if valid, otherwise null
  const getAvatarUrl = (path) =>
    isValidAvatarPath(path) ? `http://localhost:8000/storage/${path}` : null;



  // Enhanced color functions for badges
  const getCivilStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'single':
        return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'married':
        return 'bg-green-100 text-green-800 border border-green-200';
      case 'widowed':
        return 'bg-gray-100 text-gray-800 border border-gray-200';
      case 'divorced':
        return 'bg-red-100 text-red-800 border border-red-200';
      case 'separated':
        return 'bg-orange-100 text-orange-800 border border-orange-200';
      default:
        return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
    }
  };

  const getGenderColor = (gender) => {
    switch (gender?.toLowerCase()) {
      case 'male':
        return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'female':
        return 'bg-pink-100 text-pink-800 border border-pink-200';
      default:
        return 'bg-purple-100 text-purple-800 border border-purple-200';
    }
  };

  const getVoterStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'registered':
        return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
      case 'unregistered':
        return 'bg-red-100 text-red-800 border border-red-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
      case 'active':
        return 'bg-green-100 text-green-800 border border-green-200';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 border border-gray-200';
      default:
        return 'bg-indigo-100 text-indigo-800 border border-indigo-200';
    }
  };

  // Icon helper functions
  const getCivilStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'single':
        return <UserIcon className="w-3 h-3" />;
      case 'married':
        return <HeartSolidIcon className="w-3 h-3" />;
      case 'widowed':
        return <HeartIcon className="w-3 h-3" />;
      case 'divorced':
        return <XCircleIcon className="w-3 h-3" />;
      case 'separated':
        return <ExclamationTriangleIcon className="w-3 h-3" />;
      default:
        return <UserIcon className="w-3 h-3" />;
    }
  };

  const getGenderIcon = (gender) => {
    switch (gender?.toLowerCase()) {
      case 'male':
        return <UserIcon className="w-3 h-3" />;
      case 'female':
        return <HeartIcon className="w-3 h-3" />;
      default:
        return <UserGroupIcon className="w-3 h-3" />;
    }
  };

  const getVoterStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'registered':
        return <CheckCircleIcon className="w-3 h-3" />;
      case 'unregistered':
        return <XCircleIcon className="w-3 h-3" />;
      case 'pending':
        return <ClockIcon className="w-3 h-3" />;
      case 'active':
        return <CheckCircleIcon className="w-3 h-3" />;
      case 'inactive':
        return <XCircleIcon className="w-3 h-3" />;
      default:
        return <DocumentTextIcon className="w-3 h-3" />;
    }
  };

  // Utility function for formatting resident name
  function formatResidentName(resident) {
    if (!resident) return '';
    const { first_name, middle_name, last_name, name_suffix } = resident;
    return (
      first_name +
      (middle_name ? ` ${middle_name}` : '') +
      (last_name ? ` ${last_name}` : '') +
      (name_suffix && name_suffix.toLowerCase() !== 'none' ? ` ${name_suffix}` : '')
    );
  }

  function toDateInputValue(dateString) {
    if (!dateString) return "";
    // Handles both ISO and already-correct format
    const d = new Date(dateString);
    if (isNaN(d)) return "";
    return d.toISOString().slice(0, 10);
  }
  

  // Utility to determine resident update status
  // Uses `last_modified` when available, falls back to `updated_at`.
  // Status rules:
  // - Active: updated within 6 months
  // - Outdated: updated within 7-12 months
  // - Needs Verification: older than 12 months or no date
  function getResidentStatus(resident) {
    if (!resident) return 'Needs Verification';
    const dateStr = resident.last_modified || resident.updated_at;
    if (!dateStr) return 'Needs Verification';
    const updatedDate = new Date(dateStr);
    if (isNaN(updatedDate)) return 'Needs Verification';
    const now = new Date();
    const monthsDiff = (now.getFullYear() - updatedDate.getFullYear()) * 12 + (now.getMonth() - updatedDate.getMonth());
    if (monthsDiff <= 6) return 'Active';
    if (monthsDiff <= 12) return 'Outdated';
    return 'Needs Verification';
  }

  // Helper function to get the correct verification status from multiple sources
  const getVerificationStatus = (user) => {
    // Priority order: resident.verification_status > profile.verification_status > 'pending'
    return user?.resident?.verification_status || 
           user?.profile?.verification_status || 
           'pending';
  };

  // Generate chart data for monthly resident registrations
  const generateChartData = (residents, year = '', month = 0) => {
    const now = new Date();
    let data = [];

    if (year && month > 0) {
      // Daily data for selected month and year
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0);
      const dailyData = {};
      residents.forEach(resident => {
        if (resident.created_at) {
          const date = new Date(resident.created_at);
          if (date >= monthStart && date <= monthEnd) {
            const dayKey = date.toISOString().split('T')[0];
            dailyData[dayKey] = (dailyData[dayKey] || 0) + 1;
          }
        }
      });
      // Fill all days of the month
      for (let day = 1; day <= monthEnd.getDate(); day++) {
        const date = new Date(year, month - 1, day);
        const key = date.toISOString().split('T')[0];
        data.push({
          month: date.getDate().toString(),
          registrations: dailyData[key] || 0
        });
      }
    } else if (year) {
      // Monthly data for selected year
      const yearlyData = {};
      residents.forEach(resident => {
        if (resident.created_at) {
          const date = new Date(resident.created_at);
          if (date.getFullYear() == year) {
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            yearlyData[monthKey] = (yearlyData[monthKey] || 0) + 1;
          }
        }
      });
      // Fill all months of the year
      for (let m = 0; m < 12; m++) {
        const date = new Date(year, m, 1);
        const key = `${year}-${String(m + 1).padStart(2, '0')}`;
        data.push({
          month: date.toLocaleDateString('en-US', { month: 'short' }),
          registrations: yearlyData[key] || 0
        });
      }
    } else {
      // Last 12 months
      const monthlyData = {};
      residents.forEach(resident => {
        if (resident.created_at) {
          const date = new Date(resident.created_at);
          const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          monthlyData[monthYear] = (monthlyData[monthYear] || 0) + 1;
        }
      });

      // Get last 12 months
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        data.push({
          month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          registrations: monthlyData[key] || 0
        });
      }
    }
    return data;
  };

  // Get most common demographic insights
  const getMostCommonDemographic = (residents, field, filterByMonth = false) => {
    const now = new Date();
    const filtered = filterByMonth ? residents.filter(resident => {
      if (!resident.created_at) return false;
      const date = new Date(resident.created_at);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }) : residents;

    const counts = {};
    filtered.forEach(resident => {
      const value = resident[field];
      if (value) {
        counts[value] = (counts[value] || 0) + 1;
      }
    });

    let max = 0;
    let most = '';
    for (const [value, count] of Object.entries(counts)) {
      if (count > max) {
        max = count;
        most = value;
      }
    }
    return { value: most, count: max };
  };

  // (status is attached on fetch as `update_status`; we compute locally as fallback)

  // Enhanced error handling in render
  if (error && !loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex">
          <Sidebar />
          <div className="flex-1 p-6">
            <ErrorDisplay 
              error={error} 
              onRetry={fetchResidents}
              className="mt-8"
            />
          </div>
        </div>
      </div>
    );
  }

  // UI controls for filter and sort
  const renderUIControls = () => {
    return (
      <ErrorBoundary>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes float-delayed {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-float { animation: float 3s ease-in-out infinite; }
        .animate-float-delayed { animation: float-delayed 3s ease-in-out infinite 0.5s; }
        .animate-float-slow { animation: float-slow 4s ease-in-out infinite 1s; }
        .animate-shimmer { animation: shimmer 2s ease-in-out infinite; }
        .animate-fade-in { animation: fadeIn 0.8s ease-out; }
        .animate-fade-in-up { animation: fadeInUp 0.8s ease-out; }
        .animate-slide-in-up { animation: slideInUp 0.8s ease-out; }
        .animation-delay-300 { animation-delay: 0.3s; }
        .animation-delay-500 { animation-delay: 0.5s; }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(50px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <Navbar />
      <Sidebar />
      <main className="bg-gradient-to-br from-green-50 to-emerald-50 min-h-screen ml-0 lg:ml-64 pt-20 lg:pt-36 px-4 pb-16 font-sans">
        <div className="w-full max-w-[98%] mx-auto space-y-6 sm:space-y-8 lg:space-y-10 relative z-10 px-2 lg:px-4">
          {/* Enhanced Header */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full shadow-xl mb-4">
              <UserIcon className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent tracking-tight">
              Residents Records Management
            </h1>
            <p className="text-gray-600 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
              Comprehensive management system for resident records and community profiles with real-time updates.
            </p>
            
            {/* Help System Buttons */}
            <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mt-6 sm:mt-8">
              <button
                onClick={() => setShowHelpGuide(true)}
                className="inline-flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-green-600 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 hover:text-green-700 transition-colors duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
              >
                <BookOpenIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Help Guide</span>
                <span className="sm:hidden">Help</span>
              </button>
              <button
                onClick={() => setShowQuickStart(true)}
                className="inline-flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-green-600 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 hover:text-green-700 transition-colors duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
              >
                <PlayIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Quick Start</span>
                <span className="sm:hidden">Start</span>
              </button>
              <button
                onClick={() => setShowFAQ(true)}
                className="inline-flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-purple-600 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 hover:text-purple-700 transition-colors duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
              >
                <QuestionMarkCircleIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                FAQ
              </button>
            </div>
          </div>

          {/* Enhanced Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <div className="relative overflow-hidden rounded-xl sm:rounded-2xl lg:rounded-3xl p-4 sm:p-6 shadow-xl border border-gray-100 hover:shadow-2xl transition-all duration-500 flex justify-between items-center group transform hover:scale-105 bg-white">
              {/* Animated background gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-gray-50 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              {/* Content */}
              <div className="relative z-10 flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 truncate">Total Residents</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-green-600 group-hover:text-emerald-600 transition-all duration-300">
                    {residents.length}
                  </p>
                </div>
              </div>
              
              {/* Enhanced icon container */}
              <div className="relative w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center bg-green-100 group-hover:scale-110 transition-transform duration-300 shadow-lg flex-shrink-0">
                <div className="absolute inset-0 bg-white opacity-20 rounded-xl sm:rounded-2xl"></div>
                <div className="relative z-10">
                  <UserGroupIcon className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                </div>
              </div>
              
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-transparent to-gray-100 rounded-full transform translate-x-6 sm:translate-x-8 -translate-y-6 sm:-translate-y-8 opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
            </div>

            <div className="relative overflow-hidden rounded-xl sm:rounded-2xl lg:rounded-3xl p-4 sm:p-6 shadow-xl border border-gray-100 hover:shadow-2xl transition-all duration-500 flex justify-between items-center group transform hover:scale-105 bg-white">
              {/* Animated background gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-gray-50 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              {/* Content */}
              <div className="relative z-10 flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 truncate">Active Records</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-emerald-600 group-hover:text-green-600 transition-all duration-300">
                    {residents.filter(r => r.update_status === 'Active').length}
                  </p>
                </div>
              </div>
              
              {/* Enhanced icon container */}
              <div className="relative w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center bg-emerald-100 group-hover:scale-110 transition-transform duration-300 shadow-lg flex-shrink-0">
                <div className="absolute inset-0 bg-white opacity-20 rounded-xl sm:rounded-2xl"></div>
                <div className="relative z-10">
                  <CheckCircleIcon className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
                </div>
              </div>
              
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-transparent to-gray-100 rounded-full transform translate-x-6 sm:translate-x-8 -translate-y-6 sm:-translate-y-8 opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
            </div>

            <div className="relative overflow-hidden rounded-xl sm:rounded-2xl lg:rounded-3xl p-4 sm:p-6 shadow-xl border border-gray-100 hover:shadow-2xl transition-all duration-500 flex justify-between items-center group transform hover:scale-105 bg-white">
              {/* Animated background gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-gray-50 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              {/* Content */}
              <div className="relative z-10 flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 truncate">For Review</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-amber-600 group-hover:text-orange-600 transition-all duration-300">
                    {residents.filter(r => r.for_review).length}
                  </p>
                </div>
              </div>
              
              {/* Enhanced icon container */}
              <div className="relative w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center bg-amber-100 group-hover:scale-110 transition-transform duration-300 shadow-lg flex-shrink-0">
                <div className="absolute inset-0 bg-white opacity-20 rounded-xl sm:rounded-2xl"></div>
                <div className="relative z-10">
                  <ExclamationTriangleIcon className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
                </div>
              </div>
              
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-transparent to-gray-100 rounded-full transform translate-x-6 sm:translate-x-8 -translate-y-6 sm:-translate-y-8 opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
            </div>
          </div>

          {/* Enhanced Analytics Dashboard */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl border border-gray-100 p-4 sm:p-6 mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <UserIcon className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <span className="truncate">Residents Analytics Dashboard</span>
                </h3>
                <p className="text-gray-600 mt-2 text-sm sm:text-base">Comprehensive insights into resident demographics and community patterns</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs sm:text-sm text-gray-500">Total Records:</span>
                  <span className="text-xs sm:text-sm font-medium text-green-600 bg-green-100 px-2 py-1 rounded-full">
                    {residents.length} residents
                  </span>
                </div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={() => window.location.reload()}
                  className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium bg-green-100 text-green-700 hover:bg-green-200 transition-all duration-200 rounded-lg w-full sm:w-auto"
                >
                  <ArrowPathIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Refresh</span>
                  <span className="sm:hidden">Refresh</span>
                </button>
                <span className="text-xs text-gray-500 flex items-center">
                  Last updated: {new Date().toLocaleTimeString()}
                </span>
              </div>
            </div>

            {/* Key Performance Indicators */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-3 md:p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs md:text-sm text-green-600 font-medium">Total Residents</p>
                    <p className="text-lg md:text-xl lg:text-2xl font-bold text-green-700">{residents.length}</p>
                    <p className="text-xs text-green-500 mt-1 truncate">Registered members</p>
                  </div>
                  <div className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <UserGroupIcon className="w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 text-green-600" />
                  </div>
                </div>
                <div className="mt-2 w-full bg-green-200 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, (residents.length / 100) * 100)}%` }}
                  ></div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-3 md:p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs md:text-sm text-green-600 font-medium">Active Records</p>
                    <p className="text-lg md:text-xl lg:text-2xl font-bold text-green-700">{residents.filter(r => r.update_status === 'Active').length}</p>
                    <p className="text-xs text-green-500 mt-1 truncate">Verified profiles</p>
                  </div>
                  <div className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircleIcon className="w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 text-green-600" />
                  </div>
                </div>
                <div className="mt-2 w-full bg-green-200 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, residents.length > 0 ? (residents.filter(r => r.update_status === 'Active').length / residents.length) * 100 : 0)}%` }}
                  ></div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-3 md:p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs md:text-sm text-amber-600 font-medium">For Review</p>
                    <p className="text-lg md:text-xl lg:text-2xl font-bold text-amber-700">{residents.filter(r => r.for_review).length}</p>
                    <p className="text-xs text-amber-500 mt-1 truncate">Awaiting approval</p>
                  </div>
                  <div className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <ExclamationTriangleIcon className="w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 text-amber-600" />
                  </div>
                </div>
                <div className="mt-2 w-full bg-amber-200 rounded-full h-2">
                  <div 
                    className="bg-amber-500 h-2 rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, residents.length > 0 ? (residents.filter(r => r.for_review).length / residents.length) * 100 : 0)}%` }}
                  ></div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-3 md:p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs md:text-sm text-purple-600 font-medium">Coverage Rate</p>
                    <p className="text-lg md:text-xl lg:text-2xl font-bold text-purple-700">
                      {residents.length > 0 ? Math.round((residents.length / 200) * 100) : 0}%
                    </p>
                    <p className="text-xs text-purple-500 mt-1 truncate">Of target residents</p>
                  </div>
                  <div className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <ChartBarIcon className="w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 text-purple-600" />
                  </div>
                </div>
                <div className="mt-2 w-full bg-purple-200 rounded-full h-2">
                  <div 
                    className="bg-purple-500 h-2 rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, residents.length > 0 ? (residents.length / 200) * 100 : 0)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>


          
          {/* Enhanced Search and Add Section */}
          <div className="relative bg-gradient-to-br from-white/95 via-slate-50/90 to-indigo-50/80 rounded-3xl shadow-2xl border border-slate-200/60 p-8 mb-12 transition-all duration-700 hover:shadow-3xl backdrop-blur-lg overflow-hidden">
            {/* Enhanced Decorative Background Elements */}
            <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-indigo-200/30 to-purple-300/30 rounded-full -translate-y-36 translate-x-36 blur-3xl animate-pulse"></div>
            <div className="absolute bottom-0 left-0 w-56 h-56 bg-gradient-to-tr from-blue-200/30 to-cyan-300/30 rounded-full translate-y-28 -translate-x-28 blur-3xl animate-pulse delay-1000"></div>
            <div className="absolute top-1/2 left-1/2 w-40 h-40 bg-gradient-to-br from-purple-200/20 to-pink-300/20 rounded-full -translate-x-20 -translate-y-20 blur-2xl animate-pulse delay-500"></div>
            
            {/* Additional floating elements */}
            <div className="absolute top-1/4 left-1/4 w-16 h-16 bg-gradient-to-br from-cyan-300/20 to-blue-300/20 rounded-full blur-lg animate-float"></div>
            <div className="absolute bottom-1/3 right-1/3 w-12 h-12 bg-gradient-to-br from-pink-300/20 to-rose-300/20 rounded-full blur-md animate-float-delayed"></div>

            <div className="relative z-10">
              {/* Enhanced Section Header */}
              <div className="text-center mb-8 animate-fade-in-up">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 rounded-3xl shadow-2xl mb-6 transform transition-all duration-700 hover:scale-110 hover:rotate-6 hover:shadow-3xl relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent group-hover:animate-spin"></div>
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <SparklesIcon className="w-10 h-10 text-white relative z-10 drop-shadow-lg group-hover:scale-110 transition-transform duration-300" />
                </div>
                <h2 className="text-4xl font-black bg-gradient-to-r from-indigo-800 via-purple-800 to-indigo-900 bg-clip-text text-transparent mb-4 drop-shadow-sm">
                  Management Control Center
                </h2>
                <p className="text-slate-600 text-lg max-w-2xl mx-auto font-semibold leading-relaxed">
                  Advanced tools for comprehensive resident management, real-time analytics, and streamlined administrative operations
                </p>
                
                {/* Decorative line */}
                <div className="flex justify-center mt-6">
                  <div className="w-24 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 rounded-full shadow-lg relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer"></div>
                  </div>
                </div>
              </div>

              {/* Enhanced Action Buttons Layout - All Same Size */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 w-full max-w-7xl mx-auto">
                {/* Add Resident Button */}
                <button
                  onClick={handleAddResidentClick}
                  className="group relative bg-gradient-to-br from-emerald-500 via-green-600 to-teal-600 hover:from-emerald-600 hover:via-green-700 hover:to-teal-700 text-white px-8 py-6 rounded-2xl shadow-2xl flex items-center gap-4 font-bold transition-all duration-500 transform hover:scale-[1.02] hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-emerald-500/50 overflow-hidden border border-white/20 w-full h-[110px]"
                >
                    {/* Animated Background Effects */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <div className="absolute inset-0 bg-gradient-to-tl from-transparent via-white/10 to-white/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700"></div>
                    
                    {/* Icon Container */}
                    <div className="relative z-10 w-12 h-12 bg-white/25 backdrop-blur-md rounded-xl flex items-center justify-center group-hover:rotate-180 group-hover:scale-110 transition-all duration-500 shadow-lg border border-white/30 flex-shrink-0">
                      <PlusIcon className="w-6 h-6 drop-shadow-lg" />
                    </div>
                    
                    {/* Text Content */}
                    <div className="relative z-10 text-left flex-1 min-w-0">
                      <div className="font-bold text-base leading-tight mb-1">Add Resident</div>
                      <div className="text-xs text-emerald-50 font-medium opacity-90">Create new profile</div>
                    </div>
                  </button>

                {/* View Analytics Button */}
                <button
                  onClick={() => { if (!showAnalytics) fetchReports(); setShowAnalytics(!showAnalytics); }}
                  className="group relative bg-gradient-to-br from-indigo-500 via-blue-600 to-purple-600 hover:from-indigo-600 hover:via-blue-700 hover:to-purple-700 text-white px-8 py-6 rounded-2xl shadow-2xl flex items-center gap-4 font-bold transition-all duration-500 transform hover:scale-[1.02] hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-indigo-500/50 overflow-hidden border border-white/20 w-full h-[110px]"
                >
                    {/* Animated Background Effects */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <div className="absolute inset-0 bg-gradient-to-tl from-transparent via-white/10 to-white/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700"></div>
                    
                    {/* Icon Container */}
                    <div className="relative z-10 w-12 h-12 bg-white/25 backdrop-blur-md rounded-xl flex items-center justify-center group-hover:scale-125 group-hover:rotate-12 transition-all duration-500 shadow-lg border border-white/30 flex-shrink-0">
                      <ChartBarIcon className="w-6 h-6 drop-shadow-lg" />
                    </div>
                    
                    {/* Text Content */}
                    <div className="relative z-10 text-left flex-1 min-w-0">
                      <div className="font-bold text-base leading-tight mb-1">{showAnalytics ? "Hide" : "View"} Analytics</div>
                      <div className="text-xs text-indigo-50 font-medium opacity-90">Reports & insights</div>
                    </div>
                  </button>

                {/* View Residents Verifications Button */}
                <button
                  onClick={() => navigate('/admin/resident-records/verification')}
                  className="group relative bg-gradient-to-br from-violet-500 via-purple-600 to-fuchsia-600 hover:from-violet-600 hover:via-purple-700 hover:to-fuchsia-700 text-white px-8 py-6 rounded-2xl shadow-2xl flex items-center gap-4 font-bold transition-all duration-500 transform hover:scale-[1.02] hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-violet-500/50 overflow-hidden border border-white/20 w-full h-[110px]"
                >
                    {/* Animated Background Effects */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <div className="absolute inset-0 bg-gradient-to-tl from-transparent via-white/10 to-white/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700"></div>
                    
                    {/* Icon Container */}
                    <div className="relative z-10 w-12 h-12 bg-white/25 backdrop-blur-md rounded-xl flex items-center justify-center group-hover:rotate-45 group-hover:scale-110 transition-all duration-500 shadow-lg border border-white/30 flex-shrink-0">
                      <UserGroupIcon className="w-6 h-6 drop-shadow-lg" />
                    </div>
                    
                    {/* Text Content */}
                    <div className="relative z-10 text-left flex-1 min-w-0">
                      <div className="font-bold text-base leading-tight mb-1">View Residents Verifications</div>
                      <div className="text-xs text-violet-50 font-medium opacity-90">Manage users</div>
                    </div>
                  </button>

                {/* View Resident Records Button */}
                <button
                  onClick={() => {
                    const newState = !showResidentRecords;
                    setShowResidentRecords(newState);
                    localStorage.setItem('showResidentRecords', JSON.stringify(newState));
                  }}
                  className="group relative bg-gradient-to-br from-cyan-500 via-teal-600 to-emerald-600 hover:from-cyan-600 hover:via-teal-700 hover:to-emerald-700 text-white px-8 py-6 rounded-2xl shadow-2xl flex items-center gap-4 font-bold transition-all duration-500 transform hover:scale-[1.02] hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-cyan-500/50 overflow-hidden border border-white/20 w-full h-[110px]"
                >
                    {/* Animated Background Effects */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <div className="absolute inset-0 bg-gradient-to-tl from-transparent via-white/10 to-white/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700"></div>
                    
                    {/* Icon Container */}
                    <div className="relative z-10 w-12 h-12 bg-white/25 backdrop-blur-md rounded-xl flex items-center justify-center group-hover:rotate-12 group-hover:scale-110 transition-all duration-500 shadow-lg border border-white/30 flex-shrink-0">
                      <DocumentTextIcon className="w-6 h-6 drop-shadow-lg" />
                    </div>
                    
                    {/* Text Content */}
                    <div className="relative z-10 text-left flex-1 min-w-0">
                      <div className="font-bold text-base leading-tight mb-1">{showResidentRecords ? 'Hide' : 'View'} Resident Records</div>
                      <div className="text-xs text-cyan-50 font-medium opacity-90">Toggle table view</div>
                    </div>
                  </button>

                {/* Disable Resident Records Button */}
                <button
                  onClick={() => navigate('/admin/resident-records/disabled-residents')}
                  className="group relative bg-gradient-to-br from-rose-500 via-red-600 to-orange-600 hover:from-rose-600 hover:via-red-700 hover:to-orange-700 text-white px-8 py-6 rounded-2xl shadow-2xl flex items-center gap-4 font-bold transition-all duration-500 transform hover:scale-[1.02] hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-rose-500/50 overflow-hidden border border-white/20 w-full h-[110px]"
                >
                    {/* Animated Background Effects */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <div className="absolute inset-0 bg-gradient-to-tl from-transparent via-white/10 to-white/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700"></div>
                    
                    {/* Icon Container */}
                    <div className="relative z-10 w-12 h-12 bg-white/25 backdrop-blur-md rounded-xl flex items-center justify-center group-hover:-rotate-45 group-hover:scale-110 transition-all duration-500 shadow-lg border border-white/30 flex-shrink-0">
                      <TrashIcon className="w-6 h-6 drop-shadow-lg" />
                    </div>
                    
                    {/* Text Content */}
                    <div className="relative z-10 text-left flex-1 min-w-0">
                      <div className="font-bold text-base leading-tight mb-1">Disable Resident Records</div>
                      <div className="text-xs text-rose-50 font-medium opacity-90">Recovery center</div>
                    </div>
                  </button>
              </div>
            </div>
          </div>

            {/* Analytics Summary and Breakdown */}

          {/* Enhanced Reporting Section */}
          <div style={{display: showAnalytics ? 'block' : 'none'}}>
          {/* New pre-aggregated analytics dashboard */}
          <AnalyticsDashboard onDrilldown={(filters) => {
            // Sync drilldown into reportFilters and fetch reports
            const next = { ...reportFilters };
            if (filters.update_status) next.update_status = filters.update_status;
            if (filters.gender) next.gender = filters.gender;
            if (filters.civil_status) next.civil_status = filters.civil_status;
            if (filters.age_group) next.age_group = filters.age_group;
            if (filters.month) next.month = filters.month;
            if (filters.missing_fields) next.missing_fields = true;
            if (filters.duplicate_emails) next.duplicate_emails = true;
            if (filters.duplicate_ids) next.duplicate_ids = true;
            
            // Clear filters if showing all
            if (Object.keys(filters).length === 0) {
              Object.keys(next).forEach(key => delete next[key]);
            }
            
            setReportFilters(next);
            fetchReports();
            
            // Also apply to residents table filters
            if (filters.update_status) setSelectedStatus(filters.update_status);
            if (filters.gender) setSelectedGender(filters.gender);
            if (filters.civil_status) setSelectedCivilStatus(filters.civil_status);
            if (filters.age_group) setSelectedAgeGroup(filters.age_group);
            if (filters.month) setSelectedMonth(filters.month);
            if (filters.missing_fields) setSearchTerm('missing:critical');
            if (filters.duplicate_emails) setSearchTerm('duplicate:email');
            if (filters.duplicate_ids) setSearchTerm('duplicate:id');
            
            // Clear other filters if showing all
            if (Object.keys(filters).length === 0) {
              setSelectedStatus('');
              setSelectedGender('');
              setSelectedCivilStatus('');
              setSelectedAgeGroup('');
              setSelectedMonth('');
              setSearchTerm('');
            }
            
            // Scroll to residents table
            const tableElement = document.getElementById('residents-table');
            if (tableElement) {
              tableElement.scrollIntoView({ behavior: 'smooth' });
            }
          }} />
           
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 mb-8">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <DocumentTextIcon className="w-6 h-6 text-blue-600" />
                  Resident Reports & Analytics
                </h3>
                <p className="text-gray-600 text-sm">Advanced reporting with filtering and sorting capabilities</p>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowReportFilters(!showReportFilters)}
                  className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-6 py-3 rounded-xl text-sm font-semibold shadow-lg transition-all duration-300 transform hover:scale-105 flex items-center gap-2"
                >
                  <FunnelIcon className="w-4 h-4" />
                  {showReportFilters ? 'Hide Filters' : 'Show Filters'}
                </button>
              </div>
            </div>

            {/* Report Filters */}
            {showReportFilters && (
              <div className="bg-gray-50 rounded-xl p-6 mb-6 border border-gray-200">
                <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <FunnelIcon className="w-5 h-5 text-blue-600" />
                  Report Filters
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Update Status Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Update Status</label>
                    <select
                      value={reportFilters.update_status}
                      onChange={(e) => handleFilterChange('update_status', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">All Statuses</option>
                      <option value="active">Active (Updated within 6 months)</option>
                      <option value="outdated">Outdated (6-12 months)</option>
                      <option value="needs_verification">Needs Verification</option>
                      <option value="for_review">For Review</option>
                    </select>
                  </div>

                  {/* Verification Status Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Verification Status</label>
                    <select
                      value={reportFilters.verification_status}
                      onChange={(e) => handleFilterChange('verification_status', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">All Verifications</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="denied">Denied</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                    <select
                      value={reportFilters.year}
                      onChange={(e) => handleFilterChange('year', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">All Years</option>
                      {Array.from({length: 11}, (_, i) => new Date().getFullYear() - i).map(year => (
                        <option key={year} value={year.toString()}>{year}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
                    <select
                      value={reportFilters.month}
                      onChange={(e) => handleFilterChange('month', e.target.value)}
                      disabled={!reportFilters.year}
                      className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${!reportFilters.year ? 'border-gray-400 bg-gray-100 cursor-not-allowed' : 'border-gray-300'}`}
                    >
                      <option value="">All Months</option>
                      {reportFilters.year && Array.from({length: 12}, (_, i) => {
                        const monthNum = i + 1;
                        const monthName = new Date(parseInt(reportFilters.year), monthNum - 1, 1).toLocaleString('default', { month: 'long' });
                        return <option key={monthNum} value={monthNum.toString().padStart(2, '0')}>{monthName}</option>;
                      })}
                    </select>
                  </div>

                  {/* Sort By Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                    <select
                      value={reportFilters.sort_by}
                      onChange={(e) => handleFilterChange('sort_by', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="last_modified">Last Modified</option>
                      <option value="created_at">Created Date</option>
                      <option value="first_name">First Name</option>
                      <option value="last_name">Last Name</option>
                      <option value="verification_status">Verification Status</option>
                    </select>
                  </div>

                  {/* Sort Order Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Sort Order</label>
                    <select
                      value={reportFilters.sort_order}
                      onChange={(e) => handleFilterChange('sort_order', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="desc">Descending (Newest First)</option>
                      <option value="asc">Ascending (Oldest First)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Report Statistics */}
            {reportData.length > 0 && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 mb-6 border border-blue-200">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-lg font-semibold text-blue-800">Report Summary</h4>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        console.log('Calling exportToCSV with data:', reportData);
                        exportToCSV(reportData);
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md transition-all duration-300 transform hover:scale-105 flex items-center gap-2"
                    >
                      <ArrowDownTrayIcon className="w-4 h-4" />
                      Export CSV
                    </button>
                    <button
                      onClick={() => {
                        console.log('Calling exportToExcel with data:', reportData);
                        exportToExcel(reportData);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md transition-all duration-300 transform hover:scale-105 flex items-center gap-2"
                    >
                      <ArrowDownTrayIcon className="w-4 h-4" />
                      Export Excel
                    </button>
                    <button
                      onClick={() => {
                        console.log('Calling exportToPDF with data:', reportData);
                        exportToPDF(reportData);
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md transition-all duration-300 transform hover:scale-105 flex items-center gap-2"
                    >
                      <DocumentTextIcon className="w-4 h-4" />
                      Export PDF
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white rounded-lg p-4 text-center shadow-sm">
                    <div className="text-2xl font-bold text-blue-600">{reportData.length}</div>
                    <div className="text-sm text-gray-600">Total Residents</div>
                  </div>
                  <div className="bg-white rounded-lg p-4 text-center shadow-sm">
                    <div className="text-2xl font-bold text-green-600">
                      {reportData.filter(r => r.update_status === 'Active').length}
                    </div>
                    <div className="text-sm text-gray-600">Active Residents</div>
                  </div>
                  <div className="bg-white rounded-lg p-4 text-center shadow-sm">
                    <div className="text-2xl font-bold text-yellow-600">
                      {reportData.filter(r => r.update_status === 'Outdated').length}
                    </div>
                    <div className="text-sm text-gray-600">Outdated Records</div>
                  </div>
                  <div className="bg-white rounded-lg p-4 text-center shadow-sm">
                    <div className="text-2xl font-bold text-red-600">
                      {reportData.filter(r => r.for_review).length}
                    </div>
                    <div className="text-sm text-gray-600">Needs Review</div>
                  </div>
                </div>

                {/* Report Chart */}
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <h5 className="text-md font-semibold text-gray-800 mb-4">Status Distribution</h5>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Active', value: reportData.filter(r => r.update_status === 'Active').length, fill: '#10b981' },
                          { name: 'Outdated', value: reportData.filter(r => r.update_status === 'Outdated').length, fill: '#f59e0b' },
                          { name: 'Needs Verification', value: reportData.filter(r => r.update_status === 'Needs Verification').length, fill: '#ef4444' },
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={60}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        <Cell fill="#10b981" />
                        <Cell fill="#f59e0b" />
                        <Cell fill="#ef4444" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Render Report Data */}
            {reportData.length > 0 && (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-sm min-w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left font-semibold text-gray-700 min-w-[150px]">Resident ID</th>
                      <th className="px-6 py-4 text-left font-semibold text-gray-700 min-w-[200px]">Name</th>
                      <th className="px-6 py-4 text-left font-semibold text-gray-700 min-w-[150px]">Update Status</th>
                      <th className="px-6 py-4 text-left font-semibold text-gray-700 min-w-[140px]">Verification</th>
                      <th className="px-6 py-4 text-left font-semibold text-gray-700 min-w-[180px]">Last Modified</th>
                      <th className="px-6 py-4 text-left font-semibold text-gray-700 min-w-[130px]">Review Flag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {                    reportData.map((resident, index) => (
                      <tr key={`report-${resident.id}-${index}`} className="hover:bg-blue-50 transition-colors">
                        <td className="px-6 py-4 font-mono text-blue-600 hidden sm:table-cell">{resident.resident_id}</td>
                        <td className="px-6 py-4 font-medium text-gray-900">{formatResidentName(resident)}</td>
                        <td className="px-6 py-4">
                          {(() => {
                            const status = resident.update_status ?? getResidentStatus(resident) ?? 'Needs Verification';
                            if (status === 'Active') {
                              return (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full text-xs font-bold shadow-md">
                                  <CheckCircleIcon className="w-3.5 h-3.5" />
                                  Active
                                </span>
                              );
                            } else if (status === 'Outdated') {
                              return (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full text-xs font-bold shadow-md">
                                  <ClockIcon className="w-3.5 h-3.5" />
                                  Outdated
                                </span>
                              );
                            } else if (status === 'Needs Verification') {
                              return (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-full text-xs font-bold shadow-md">
                                  <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                                  Needs Verification
                                </span>
                              );
                            } else {
                              return (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-gray-500 to-slate-500 text-white rounded-full text-xs font-bold shadow-md">
                                  {status}
                                </span>
                              );
                            }
                          })()}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                            resident.verification_status === 'approved'
                              ? 'bg-green-100 text-green-800'
                              : resident.verification_status === 'denied'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {resident.verification_status === 'approved' ? (
                              <CheckIcon className="w-3.5 h-3.5" />
                            ) : resident.verification_status === 'denied' ? (
                              <XMarkIcon className="w-3.5 h-3.5" />
                            ) : (
                              <ClockIcon className="w-3.5 h-3.5" />
                            )}
                            {resident.verification_status || 'pending'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {resident.last_modified ? new Date(resident.last_modified).toLocaleString() : 'Never'}
                        </td>
                        <td className="px-6 py-4">
                          {resident.for_review ? (
                            <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-red-500 to-pink-500 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-md">
                              <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                              For Review
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs font-medium">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Empty State */}
            {!fetchingReports && reportData.length === 0 && (
              <div className="text-center py-12">
                <DocumentTextIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h4 className="text-lg font-semibold text-gray-600 mb-2">No Report Data</h4>
                <p className="text-gray-500 text-sm">
                  {showReportFilters ? 'Try adjusting your filters or' : ''} 
                  Click "Generate Report" to view resident data
                </p>
              </div>
            )}
          </div>
          
          </div>
            
            {/* Residents Users Table */}
            {showResidentsUsers && (
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden mt-8 transition-all duration-300 hover:shadow-2xl">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                  <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                    <UserIcon className="w-5 h-5" />
                    Residents Verification Status
                  </h3>
                </div>
                
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-sm min-w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-4 text-left font-semibold text-gray-700 border-r border-gray-200 min-w-[180px]">Name</th>
                        <th className="px-6 py-4 text-left font-semibold text-gray-700 border-r border-gray-200 min-w-[200px]">Email</th>
                        <th className="px-6 py-4 text-left font-semibold text-gray-700 border-r border-gray-200 min-w-[150px]">Registration Date</th>
                        <th className="px-6 py-4 text-left font-semibold text-gray-700 border-r border-gray-200 min-w-[150px]">Resident ID</th>
                        <th className="px-6 py-4 text-left font-semibold text-gray-700 border-r border-gray-200 min-w-[180px]">Residency Verification</th>
                        <th className="px-6 py-4 text-left font-semibold text-gray-700 border-r border-gray-200 min-w-[160px]">Uploaded Image</th>
                        <th className="px-6 py-4 text-left font-semibold text-gray-700 min-w-[200px]">Actions</th>
                      </tr>
                    </thead>
                    
                    <tbody className="divide-y divide-gray-100">
                      {residentsUsersLoading ? (
                        <tr>
                          <td colSpan="7" className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                              <p className="text-gray-500 font-medium">Loading residents users...</p>
                            </div>
                          </td>
                        </tr>
                      ) : residentsUsers.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <UserIcon className="w-12 h-12 text-gray-300" />
                              <p className="text-gray-500 font-medium">No residents users found</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        getPaginatedUsers().map((user, index) => (
                          <tr key={`user-${user.id}-${index}`} className="hover:bg-blue-50 transition-all duration-200 border-b border-gray-100 hover:border-blue-200">
                            <td className="px-6 py-4">
                              <div className="font-semibold text-gray-900">{user.name}</div>
                            </td>
                            <td className="px-6 py-4 text-gray-700">{user.email}</td>
                            <td className="px-6 py-4 text-gray-700">
                              {new Date(user.created_at).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })}
                            </td>
                            <td className="px-6 py-4">
                              <span className="font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded text-xs">
                                {user.profile?.residents_id || 'N/A'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              {getVerificationStatus(user) === 'approved' ? (
                                <div className="flex items-center gap-2 text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                                  <CheckIcon className="w-5 h-5" />
                                  <span className="font-medium">Verified</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 text-yellow-700 bg-yellow-50 px-3 py-2 rounded-lg">
                                  <ClockIcon className="w-5 h-5" />
                                  <span className="font-medium">Pending</span>
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col items-center gap-2">
                                {/* Verification Status */}
                                {getVerificationStatus(user) === 'approved' ? (
                                  <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                                    <CheckIcon className="w-4 h-4" />
                                    Verified
                                  </span>
                                ) : (
                                  <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-medium">
                                    Pending
                                  </span>
                                )}
                                
                                {/* Image Preview */}
                                {(user.resident?.residency_verification_image || user.profile?.residency_verification_image) && 
                                 (user.resident?.verification_status || user.profile?.verification_status) !== 'denied' ? (
                                  <div className="relative group">
                                    <img
                                      src={`http://localhost:8000/storage/${user.resident?.residency_verification_image || user.profile?.residency_verification_image}`}
                                      alt="Residency Verification"
                                      className="w-16 h-16 object-cover rounded-lg border-2 border-gray-200 cursor-pointer hover:scale-105 transition-transform duration-200 shadow-md"
                                      onClick={() => {
                                        setSelectedImage(`http://localhost:8000/storage/${user.resident?.residency_verification_image || user.profile?.residency_verification_image}`);
                                        setSelectedImageTitle(`${user.name} - Residency Verification`);
                                        setImageLoading(true);
                                        setShowImageModal(true);
                                      }}
                                      onError={(e) => {
                                        console.error("Image failed to load:", user.resident?.residency_verification_image || user.profile?.residency_verification_image);
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'flex';
                                      }}
                                      title={`Click to view ${user.name}'s residency verification image`}
                                    />
                                    <div className="hidden items-center justify-center w-16 h-16 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300">
                                      <DocumentTextIcon className="w-6 h-6 text-gray-400" />
                                    </div>
                                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                      <EyeIcon className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                                      View
                                    </div>
                                  </div>
                                ) : (
                                  <div className="w-16 h-16 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                                    <DocumentTextIcon className="w-6 h-6 text-gray-400" />
                                  </div>
                                )}
                                
                                {/* Status Badge */}
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  getVerificationStatus(user) === 'approved'
                                    ? 'bg-green-100 text-green-800'
                                    : getVerificationStatus(user) === 'denied'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {getVerificationStatus(user)}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 space-x-2">
                              {(user.resident?.residency_verification_image || user.profile?.residency_verification_image) && 
                               getVerificationStatus(user) !== 'denied' ? (
                                <button
                                  onClick={() => {
                                    setSelectedImage(`http://localhost:8000/storage/${user.resident?.residency_verification_image || user.profile?.residency_verification_image}`);
                                    setSelectedImageTitle(`${user.name} - Residency Verification`);
                                    setImageLoading(true);
                                    setShowImageModal(true);
                                  }}
                                  className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-3 py-1 rounded text-xs font-medium shadow-md flex items-center gap-1 transition-all duration-300 hover:shadow-lg"
                                >
                                  <EyeIcon className="w-4 h-4" />
                                  View Document
                                </button>
                              ) : (
                                <span className="text-gray-400 text-xs italic">No image uploaded</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2 flex-wrap">
                                {user.profile?.verification_status !== 'approved' && (
                                  <button
                                    onClick={() => handleApprove(user.profile?.id)}
                                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-3 py-1 rounded text-xs font-medium shadow-md flex items-center gap-1 transition-all duration-300 hover:shadow-lg"
                                  >
                                    <CheckIcon className="w-4 h-4" />
                                    Approve
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeny(user.resident?.id || user.profile?.id)}
                                  disabled={(user.resident?.verification_status || user.profile?.verification_status) === 'denied'}
                                  className={`px-3 py-1 rounded text-xs font-medium ${
                                    (user.resident?.verification_status || user.profile?.verification_status) === 'denied'
                                      ? 'bg-red-100 text-red-800 cursor-not-allowed'
                                      : 'bg-red-500 hover:bg-red-600 text-white'
                                  } transition-all duration-300 hover:shadow-md`}
                                >
                                  Deny
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination for User Accounts */}
                {usersTotalPages > 1 && (
                  <div className="flex justify-center mt-8 px-6 pb-6">
                    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                      <div className="flex items-center justify-between gap-4">
                        {/* Page Info */}
                        <div className="text-sm text-gray-600">
                          Page {usersCurrentPage} of {usersTotalPages}
                        </div>
                        
                        {/* Pagination Controls */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleUsersPageChange(Math.max(1, usersCurrentPage - 1))}
                            disabled={usersCurrentPage <= 1}
                            className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Previous
                          </button>

                          {/* Page Numbers */}
                          <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, usersTotalPages) }, (_, i) => {
                              const pageNum = Math.max(1, Math.min(usersTotalPages - 4, usersCurrentPage - 2)) + i;
                              if (pageNum > usersTotalPages) return null;
                              return (
                                <button
                                  key={pageNum}
                                  onClick={() => handleUsersPageChange(pageNum)}
                                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                                    usersCurrentPage === pageNum
                                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                                      : 'hover:bg-gray-100'
                                  }`}
                                >
                                  {pageNum}
                                </button>
                              );
                            })}
                          </div>

                          <button
                            onClick={() => handleUsersPageChange(Math.min(usersTotalPages, usersCurrentPage + 1))}
                            disabled={usersCurrentPage >= usersTotalPages}
                            className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 flex items-center gap-2"
                          >
                            Next
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            

          {/* Enhanced Table */}
          {showResidentRecords && (
          <div className="bg-white rounded-xl md:rounded-2xl shadow-xl border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-2xl">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-4 md:px-6 py-3 md:py-4">
              <h3 className="text-white font-semibold text-base md:text-lg flex items-center gap-2">
                <DocumentTextIcon className="w-4 h-4 md:w-5 md:h-5" />
                Resident Records
              </h3>
            </div>
            
            {/* Modern Search & Filter Section */}
            <div className="px-4 md:px-6 py-4 md:py-5 bg-gradient-to-br from-gray-50 via-white to-gray-50 border-b-2 border-gray-100">
              <div className="relative bg-white rounded-2xl p-5 md:p-7 shadow-2xl border border-gray-200/50 transition-all duration-500 hover:shadow-3xl overflow-hidden group">
                {/* Animated Background Patterns */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/30 via-purple-50/30 to-pink-50/30 opacity-50"></div>
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-400/10 to-purple-400/10 rounded-full blur-3xl transform translate-x-32 -translate-y-32 group-hover:scale-150 transition-transform duration-1000"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-purple-400/10 to-pink-400/10 rounded-full blur-3xl transform -translate-x-32 translate-y-32 group-hover:scale-150 transition-transform duration-1000"></div>
                
                <div className="relative z-10">
                  {/* Modern Header */}
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg transform transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
                          <MagnifyingGlassIcon className="w-6 h-6 text-white" />
                        </div>
                        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 rounded-xl opacity-0 group-hover:opacity-40 blur-md transition-all duration-300"></div>
                      </div>
                      <div>
                        <h3 className="font-extrabold text-lg md:text-xl text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600">
                          Search & Filter
                        </h3>
                        <p className="text-slate-500 text-sm font-medium flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                          Find and filter resident records instantly
                        </p>
                      </div>
                    </div>
                    
                    {/* Total Records Badge */}
                    <div className="hidden md:flex items-center gap-2 bg-gradient-to-r from-indigo-50 to-purple-50 px-4 py-2 rounded-lg border border-indigo-200/50">
                      <div className="flex items-center justify-center w-8 h-8 bg-white rounded-lg shadow-sm">
                        <span className="text-sm font-bold text-indigo-600">{residents.length}</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-600">Total Records</span>
                    </div>
                  </div>

                  <div className="space-y-3 md:space-y-4">
                    {/* Modern Enhanced Search Input */}
                    <div className="relative group">
                      {/* Animated Border Glow */}
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl opacity-0 group-focus-within:opacity-30 blur-sm transition-all duration-500"></div>
                      
                      {/* Main Search Container */}
                      <div className="relative bg-white rounded-xl md:rounded-2xl border border-slate-200 transition-all duration-300">
                        {/* Search Icon */}
                        <div className="absolute inset-y-0 left-0 pl-4 md:pl-5 flex items-center pointer-events-none z-10">
                          <div className="relative">
                            <MagnifyingGlassIcon className="w-5 h-5 md:w-6 md:h-6 text-slate-400 group-focus-within:text-indigo-600 transition-all duration-300 group-focus-within:scale-110" />
                            <div className="absolute -inset-1 bg-indigo-400 rounded-full opacity-0 group-focus-within:opacity-20 blur-md transition-all duration-300"></div>
                          </div>
                        </div>
                        
                        {/* Search Input */}
                        <input
                          type="text"
                          className="w-full pl-12 md:pl-14 pr-24 md:pr-28 py-3.5 md:py-4 border-2 border-transparent focus:border-indigo-500 rounded-xl md:rounded-2xl text-sm md:text-base font-medium transition-all duration-300 bg-gray-50/50 group-focus-within:bg-white placeholder-slate-400 group-focus-within:placeholder-indigo-400 outline-none"
                          placeholder="Search by name, ID, address, or any details..."
                          value={search}
                          onChange={(e) => {
                            setSearch(e.target.value);
                            setCurrentPage(1);
                          }}
                        />
                        
                        {/* Right Side Actions */}
                        <div className="absolute inset-y-0 right-0 pr-3 md:pr-4 flex items-center gap-2 z-10">
                          {/* Search Results Count Badge */}
                          {search && (
                            <div className="hidden md:flex items-center gap-1.5 bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-xs font-bold animate-fade-in">
                              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></span>
                              {getFilteredResidents().length} found
                            </div>
                          )}
                          
                          {/* Clear Button */}
                          {search && (
                            <button
                              onClick={() => setSearch('')}
                              className="group/clear flex items-center justify-center w-8 h-8 bg-gradient-to-br from-red-100 to-pink-100 hover:from-red-200 hover:to-pink-200 rounded-lg transition-all duration-300 transform hover:scale-110 hover:rotate-90"
                              title="Clear search"
                            >
                              <XMarkIcon className="w-4 h-4 text-red-600 group-hover/clear:text-red-700" />
                            </button>
                          )}
                          
                          {/* Keyboard Shortcut Hint */}
                          {!search && (
                            <div className="hidden lg:flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md text-xs text-slate-500 font-mono">
                              <span className="text-slate-400">⌘</span>
                              <span>K</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Animated Progress Bar */}
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 transform scale-x-0 group-focus-within:scale-x-100 transition-transform duration-500 origin-left rounded-full"></div>
                      </div>
                    </div>

                    {/* Modern Filter Section */}
                    <div className="flex flex-col md:flex-row gap-3">
                      {/* Status Filter with Modern Design */}
                      <div className="relative flex-1 group/filter">
                        {/* Animated Border Glow for Filter */}
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500 rounded-xl opacity-0 group-focus-within/filter:opacity-20 blur-sm transition-all duration-500"></div>
                        
                        <div className="relative bg-white rounded-xl border border-slate-200 transition-all duration-300">
                          {/* Modern Status Icon */}
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                            <div className="relative">
                              {statusFilter === '' && (
                                <div className="relative">
                                  <FunnelIcon className="w-6 h-6 text-slate-400 group-focus-within/filter:text-indigo-600 transition-all duration-300 group-focus-within/filter:scale-110" />
                                  <div className="absolute -inset-1 bg-indigo-400 rounded-full opacity-0 group-focus-within/filter:opacity-30 blur-md transition-all duration-300"></div>
                                </div>
                              )}
                              {statusFilter === 'active' && (
                                <div className="relative flex items-center justify-center">
                                  <div className="absolute inset-0 bg-green-400 rounded-full opacity-30 blur-md animate-pulse"></div>
                                  <CheckCircleIcon className="relative w-6 h-6 text-green-600 drop-shadow-lg" />
                                </div>
                              )}
                              {statusFilter === 'outdated' && (
                                <div className="relative flex items-center justify-center">
                                  <div className="absolute inset-0 bg-amber-400 rounded-full opacity-30 blur-md animate-pulse"></div>
                                  <ClockIcon className="relative w-6 h-6 text-amber-600 drop-shadow-lg" />
                                </div>
                              )}
                              {statusFilter === 'needs_verification' && (
                                <div className="relative flex items-center justify-center">
                                  <div className="absolute inset-0 bg-red-400 rounded-full opacity-30 blur-md animate-pulse"></div>
                                  <ExclamationTriangleIcon className="relative w-6 h-6 text-red-600 drop-shadow-lg" />
                                </div>
                              )}
                              {statusFilter === 'for_review' && (
                                <div className="relative flex items-center justify-center">
                                  <div className="absolute inset-0 bg-purple-400 rounded-full opacity-30 blur-md animate-pulse"></div>
                                  <EyeIcon className="relative w-6 h-6 text-purple-600 drop-shadow-lg" />
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Select Dropdown */}
                          <select
                            value={statusFilter}
                            onChange={(e) => {
                              setStatusFilter(e.target.value);
                              setCurrentPage(1);
                            }}
                            className="appearance-none w-full bg-gradient-to-r from-gray-50/80 to-white group-focus-within/filter:from-white group-focus-within/filter:to-indigo-50/30 border-2 border-slate-200 focus:border-indigo-500 rounded-xl pl-12 pr-10 py-3.5 text-sm font-bold transition-all duration-300 cursor-pointer outline-none hover:border-indigo-300"
                            style={{ appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none' }}
                          >
                            <option value="">All Status Types • {residents.length} Records</option>
                            <option value="active">Active Records • {residents.filter(r => r.update_status === 'Active').length}</option>
                            <option value="outdated">Outdated Records • {residents.filter(r => r.update_status === 'Outdated').length}</option>
                            <option value="needs_verification">Needs Verification • {residents.filter(r => r.update_status === 'Needs Verification').length}</option>
                            <option value="for_review">For Review • {residents.filter(r => r.for_review).length}</option>
                          </select>
                          
                          {/* Chevron Icon */}
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none z-10">
                            <ChevronDownIcon className="w-5 h-5 text-slate-400 group-focus-within/filter:text-indigo-600 transition-all duration-300 group-focus-within/filter:scale-110" />
                          </div>
                          
                          {/* Progress Bar */}
                          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500 transform scale-x-0 group-focus-within/filter:scale-x-100 transition-transform duration-500 origin-left rounded-full"></div>
                        </div>
                      </div>

                      {/* Modern Advanced Filter Button */}
                      <button className="group/advanced relative bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white px-6 py-3.5 rounded-xl text-sm font-bold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-purple-500/40 overflow-hidden w-full md:w-auto">
                        {/* Shine Effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover/advanced:translate-x-full transition-transform duration-1000"></div>
                        
                        <div className="relative flex items-center justify-center gap-2">
                          <FunnelIcon className="w-4 h-4 group-hover/advanced:rotate-180 transition-transform duration-500" />
                          <span className="hidden md:inline">Advanced Filters</span>
                          <span className="md:hidden">Filters</span>
                          {statusFilter && (
                            <span className="ml-1 w-2 h-2 bg-white rounded-full animate-pulse"></span>
                          )}
                        </div>
                      </button>
                    </div>

                    {/* Enhanced Export Buttons Section */}
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Export Options:</span>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => exportToCSV(getFilteredResidents())}
                            className="group/export relative overflow-hidden bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110 flex items-center gap-2 border border-green-400"
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/export:translate-x-full transition-transform duration-700"></div>
                            <ArrowDownTrayIcon className="relative w-4 h-4 group-hover/export:animate-bounce" />
                            <span className="relative">CSV</span>
                          </button>
                          <button
                            onClick={() => exportToExcel(getFilteredResidents())}
                            className="group/export relative overflow-hidden bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110 flex items-center gap-2 border border-blue-400"
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/export:translate-x-full transition-transform duration-700"></div>
                            <ArrowDownTrayIcon className="relative w-4 h-4 group-hover/export:animate-bounce" />
                            <span className="relative">Excel</span>
                          </button>
                          <button
                            onClick={() => exportToPDF(getFilteredResidents())}
                            className="group/export relative overflow-hidden bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110 flex items-center gap-2 border border-red-400"
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/export:translate-x-full transition-transform duration-700"></div>
                            <DocumentTextIcon className="relative w-4 h-4 group-hover/export:animate-bounce" />
                            <span className="relative">PDF</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Enhanced Search Results Counter */}
                    {(search || statusFilter) && (
                      <div className="relative overflow-hidden rounded-2xl animate-fade-in">
                        {/* Animated Background Pattern */}
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 opacity-10"></div>
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-400 rounded-full opacity-5 blur-3xl"></div>
                        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-purple-400 rounded-full opacity-5 blur-3xl"></div>
                        
                        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between bg-white/90 backdrop-blur-md border-2 border-indigo-300/50 rounded-2xl px-5 py-4 gap-4 shadow-xl">
                          {/* Results Info */}
                          <div className="flex items-center gap-4">
                            {/* Animated Icon */}
                            <div className="relative flex items-center justify-center">
                              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl opacity-20 blur-md animate-pulse"></div>
                              <div className="relative flex items-center justify-center w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
                                <CheckCircleIcon className="w-6 h-6 text-white" />
                              </div>
                            </div>
                            
                            <div>
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span className="text-base font-black text-slate-900">
                                  {getFilteredResidents().length} Result{getFilteredResidents().length !== 1 ? 's' : ''}
                                </span>
                                {search && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700 border border-indigo-200 shadow-sm">
                                    <MagnifyingGlassIcon className="w-3.5 h-3.5" />
                                    Search Active
                                  </span>
                                )}
                                {statusFilter && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 border border-blue-200 shadow-sm">
                                    <FunnelIcon className="w-3.5 h-3.5" />
                                    Filter Active
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                                {search && (
                                  <span className="flex items-center gap-1">
                                    Query: <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">"{search}"</span>
                                  </span>
                                )}
                                {statusFilter && (
                                  <span className="flex items-center gap-1">
                                    Status: <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded capitalize">{statusFilter.replace('_', ' ')}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Enhanced Clear Button */}
                          <button
                            onClick={() => {
                              setSearch('');
                              setStatusFilter('');
                              setCurrentPage(1);
                            }}
                            className="group/clear relative overflow-hidden flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-500 via-pink-500 to-red-500 hover:from-red-600 hover:via-pink-600 hover:to-red-600 text-white rounded-xl text-sm font-black shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-110 border-2 border-red-400/50"
                          >
                            {/* Shine Effect */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/clear:translate-x-full transition-transform duration-700"></div>
                            
                            {/* Content */}
                            <XMarkIcon className="relative w-5 h-5 group-hover/clear:rotate-180 transition-transform duration-500" />
                            <span className="relative">Clear All Filters</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto shadow-2xl rounded-2xl w-full">
              <table className="w-full text-sm min-w-full">
                <thead className="bg-gradient-to-r from-slate-50 via-gray-50 to-slate-50 border-b-2 border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left font-bold text-slate-700 border-r border-slate-200 text-sm uppercase tracking-wider min-w-[120px]">Profile</th>
                    <th className="px-6 py-4 text-left font-bold text-slate-700 border-r border-slate-200 text-sm uppercase tracking-wider hidden sm:table-cell min-w-[150px]">Resident ID</th>
                    <th className="px-6 py-4 text-left font-bold text-slate-700 border-r border-slate-200 text-sm uppercase tracking-wider min-w-[200px]">Name</th>
                    <th className="px-6 py-4 text-left font-bold text-slate-700 border-r border-slate-200 text-sm uppercase tracking-wider hidden md:table-cell min-w-[100px]">Age</th>
                    <th className="px-6 py-4 text-left font-bold text-slate-700 border-r border-slate-200 text-sm uppercase tracking-wider hidden lg:table-cell min-w-[140px]">Civil Status</th>
                    <th className="px-6 py-4 text-left font-bold text-slate-700 border-r border-slate-200 text-sm uppercase tracking-wider hidden md:table-cell min-w-[120px]">Gender</th>
                    <th className="px-6 py-4 text-left font-bold text-slate-700 border-r border-slate-200 text-sm uppercase tracking-wider hidden lg:table-cell min-w-[180px]">Last Modified</th>
                    <th className="px-6 py-4 text-left font-bold text-slate-700 text-sm uppercase tracking-wider min-w-[200px]">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200/50">
                  {loading ? (
                    <tr className="hover:bg-slate-50/50 transition-colors duration-200">
                      <td colSpan="8" className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin shadow-lg"></div>
                          <p className="text-slate-600 font-semibold text-lg">Loading residents...</p>
                          <p className="text-slate-400 text-sm">Please wait while we fetch the data</p>
                        </div>
                      </td>
                    </tr>
                  ) : getFilteredResidents().length === 0 ? (
                    <tr className="hover:bg-slate-50/50 transition-colors duration-200">
                      <td colSpan="8" className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center shadow-lg">
                            <UserIcon className="w-8 h-8 text-slate-400" />
                          </div>
                          <p className="text-slate-600 font-semibold text-lg">No residents found</p>
                          <p className="text-slate-400 text-sm">Try adjusting your search criteria</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    getPaginatedResidents().map((r, index) => {
                      // Debug: Log the resident object to ensure it has an id
                      if (index === 0 && !r.id) {
                        console.error('First resident missing id field:', r);
                      }
                      
                      // Get the primary key ID - prioritize id over user_id
                      const residentPrimaryKey = r.id || r.user_id;
                      
                      return (
                      <React.Fragment key={`resident-${residentPrimaryKey || r.resident_id || index}-${index}`}>
                        <tr className="hover:bg-gradient-to-r hover:from-green-50/80 hover:to-emerald-50/80 transition-all duration-300 group border-b border-slate-200/50 hover:border-green-300/50 hover:shadow-sm">
                          <td className="px-6 py-4"><AvatarImg avatarPath={r.avatar} /></td>
                          <td className="px-6 py-4 hidden sm:table-cell">
                            <span className="font-mono text-green-600 bg-green-50 px-2 py-1 rounded text-xs">
                              {r.resident_id}
                            </span>
                          </td>
                          <td onClick={() => handleShowDetails(residentPrimaryKey)} className="px-6 py-4 cursor-pointer group-hover:text-green-600 transition-colors duration-200">
                            <div className="font-semibold text-gray-900">{formatResidentName(r)}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                              <EyeIcon className="w-3 h-3" /> Click to view details
                            </div>
                          </td>
                          <td className="px-6 py-4 hidden md:table-cell"><span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs font-medium">{r.age} years</span></td>
                          <td className="px-6 py-4 hidden lg:table-cell">
                            <Badge
                              text={r.civil_status}
                              color={getCivilStatusColor(r.civil_status)}
                              icon={getCivilStatusIcon(r.civil_status)}
                            />
                          </td>
                          <td className="px-6 py-4 hidden md:table-cell">
                            <Badge
                              text={r.sex}
                              color={getGenderColor(r.sex)}
                              icon={getGenderIcon(r.sex)}
                            />
                          </td>
                          <td className="px-6 py-4 hidden lg:table-cell">
                            <div className="flex items-center gap-1 text-xs text-gray-600">
                              <ClockIcon className="w-3 h-3" />
                              <span>{r.last_modified ? new Date(r.last_modified).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end">
                              <ActionsDropdown
                                resident={{...r, id: residentPrimaryKey}}
                                onEdit={handleUpdate}
                                onDisable={handleDelete}
                                onView={handleShowDetails}
                              />
                            </div>
                          </td>
                        </tr>

                        {selectedResident?.id === (r.id || r.user_id) && (user?.role === 'admin' || canPerformAction('view', 'residents', 'main_records')) && (
                          <tr className="bg-gradient-to-r from-green-50 to-emerald-50">
                            <td colSpan="8" className="px-8 py-8">
                              {detailLoading ? (
                                <div className="flex justify-center py-8">
                                  <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                              ) : (
                                <div className="bg-white rounded-2xl shadow-lg p-8 border border-green-200 transition-all duration-300 hover:shadow-xl">
                                  <div className="flex flex-col lg:flex-row gap-8 items-start">
                                    {/* Enhanced Avatar Section */}
                                    <div className="flex-shrink-0">
                                      <div className="relative">
                                        <img
                                          src={getAvatarUrl(selectedResident.avatar)}
                                          alt="avatar"
                                          className="w-40 h-40 rounded-2xl object-cover shadow-xl border-4 border-white transition-transform duration-300 hover:scale-105"
                                        />
                                        <div className="absolute -bottom-2 -right-2 bg-green-500 text-white rounded-full p-3 cursor-pointer shadow-lg hover:scale-110 hover:bg-green-700 transition-all duration-200 flex items-center justify-center border-2 border-white">
                                          <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => setEditData((prev) => ({ ...prev, avatar: e.target.files[0] }))}
                                            className="hidden"
                                          />
                                          <PencilIcon className="w-5 h-5" />
                                        </div>
                                      </div>
                                      <div className="mt-4 text-center">
                                        <h3 className="text-xl font-bold text-gray-900">
                                          {formatResidentName(selectedResident)}
                                        </h3>
                                        <p className="text-gray-600 text-sm mb-3">Resident ID: {selectedResident.resident_id}</p>
                                        
                                        {/* Status Badges */}
                                        <div className="flex flex-wrap justify-center gap-2">
                                          {/* Modern Update Status Badge */}
                                          {selectedResident.update_status === 'Active' && (
                                            <span className="relative inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg">
                                              <div className="absolute inset-0 bg-green-400 rounded-xl opacity-30 blur-sm"></div>
                                              <CheckCircleIcon className="relative w-4 h-4" />
                                              <span className="relative">Active</span>
                                            </span>
                                          )}
                                          {selectedResident.update_status === 'Outdated' && (
                                            <span className="relative inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-xs font-bold shadow-lg">
                                              <div className="absolute inset-0 bg-amber-400 rounded-xl opacity-30 blur-sm"></div>
                                              <ClockIcon className="relative w-4 h-4" />
                                              <span className="relative">Outdated</span>
                                            </span>
                                          )}
                                          {selectedResident.update_status === 'Needs Verification' && (
                                            <span className="relative inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl text-xs font-bold shadow-lg">
                                              <div className="absolute inset-0 bg-red-400 rounded-xl opacity-30 blur-sm"></div>
                                              <ExclamationTriangleIcon className="relative w-4 h-4" />
                                              <span className="relative">Needs Verification</span>
                                            </span>
                                          )}
                                          
                                          {/* Modern For Review Badge */}
                                          {selectedResident.for_review && (
                                            <span className="relative inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg">
                                              <div className="absolute inset-0 bg-purple-400 rounded-xl opacity-30 blur-sm animate-pulse"></div>
                                              <EyeIcon className="relative w-4 h-4" />
                                              <span className="relative">For Review</span>
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Enhanced Info Grid - All Details */}
                                    <div className="flex-1 space-y-6">
                                      {/* Personal Information Card */}
                                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200 shadow-sm transition-all duration-300 hover:shadow-md">
                                        <h4 className="text-lg font-semibold text-green-900 mb-4 flex items-center gap-2">
                                          <UserIcon className="w-5 h-5" /> Personal Information
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                          <div><span className="font-medium text-gray-700">First Name:</span> <span className="text-gray-900">{selectedResident.first_name}</span></div>
                                          <div><span className="font-medium text-gray-700">Middle Name:</span> <span className="text-gray-900">{selectedResident.middle_name || 'N/A'}</span></div>
                                          <div><span className="font-medium text-gray-700">Last Name:</span> <span className="text-gray-900">{selectedResident.last_name}</span></div>
                                          <div><span className="font-medium text-gray-700">Suffix:</span> <span className="text-gray-900">{selectedResident.name_suffix || 'N/A'}</span></div>
                                          <div><span className="font-medium text-gray-700">Birth Date:</span> <span className="text-gray-900">{toDateInputValue(selectedResident.birth_date)}</span></div>
                                          <div><span className="font-medium text-gray-700">Birth Place:</span> <span className="text-gray-900">{selectedResident.birth_place}</span></div>
                                          <div><span className="font-medium text-gray-700">Age:</span> <span className="text-gray-900">{selectedResident.age}</span></div>
                                          <div><span className="font-medium text-gray-700">Religion:</span> <span className="text-gray-900">{selectedResident.religion || 'N/A'}</span></div>
                                          <div><span className="font-medium text-gray-700">Email:</span> <span className="text-gray-900">{selectedResident.email || 'N/A'}</span></div>
                                          <div><span className="font-medium text-gray-700">Mobile Number:</span> <span className="text-gray-900">{selectedResident.mobile_number || 'N/A'}</span></div>
                                          <div><span className="font-medium text-gray-700">Current Address:</span> <span className="text-gray-900">{selectedResident.current_address || 'N/A'}</span></div>
                                          <div><span className="font-medium text-gray-700">Years in Barangay:</span> <span className="text-gray-900">{selectedResident.years_in_barangay || 'N/A'}</span></div>
                                          <div><span className="font-medium text-gray-700">Household No:</span> <span className="text-gray-900">{selectedResident.household_no || 'N/A'}</span></div>
                                          <div><span className="font-medium text-gray-700">Relation to Head:</span> <span className="text-gray-900">{selectedResident.relation_to_head || 'N/A'}</span></div>
                                          <div><span className="font-medium text-gray-700">Housing Type:</span> <span className="text-gray-900">{selectedResident.housing_type || 'N/A'}</span></div>
                                        </div>
                                      </div>

                                      {/* Additional Information Card */}
                                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200 shadow-sm transition-all duration-300 hover:shadow-md">
                                        <h4 className="text-lg font-semibold text-green-900 mb-4 flex items-center gap-2">
                                          <AcademicCapIcon className="w-5 h-5" /> Additional Information
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                          <div><span className="font-medium text-gray-700">Sex:</span> <span className="text-gray-900">{selectedResident.sex}</span></div>
                                          <div><span className="font-medium text-gray-700">Civil Status:</span> <span className="text-gray-900">{selectedResident.civil_status}</span></div>
                                          <div><span className="font-medium text-gray-700">Educational Attainment:</span> <span className="text-gray-900">{selectedResident.educational_attainment || 'N/A'}</span></div>
                                          <div><span className="font-medium text-gray-700">Classified Sector:</span> <span className="text-gray-900">{selectedResident.classified_sector || 'N/A'}</span></div>
                                          <div><span className="font-medium text-gray-700">Occupation Type:</span> <span className="text-gray-900">{selectedResident.occupation_type || 'N/A'}</span></div>
                                          <div><span className="font-medium text-gray-700">Salary/Income:</span> <span className="text-gray-900">{selectedResident.salary_income || 'N/A'}</span></div>
                                          <div><span className="font-medium text-gray-700">Business Info:</span> <span className="text-gray-900">{selectedResident.business_info || 'N/A'}</span></div>
                                          <div><span className="font-medium text-gray-700">Head of Family:</span> <span className="text-gray-900">{selectedResident.head_of_family ? 'Yes' : 'No'}</span></div>
                                          <div><span className="font-medium text-gray-700">Business Outside Barangay:</span> <span className="text-gray-900">{selectedResident.business_outside_barangay ? 'Yes' : 'No'}</span></div>
                                          <div><span className="font-medium text-gray-700">Last Modified:</span> <span className="text-gray-900">{selectedResident.last_modified ? new Date(selectedResident.last_modified).toLocaleString() : 'N/A'}</span></div>
                                        </div>
                                      </div>

                                      {/* Business Information Card */}
                                      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200 shadow-sm transition-all duration-300 hover:shadow-md">
                                        <h4 className="text-lg font-semibold text-purple-900 mb-4 flex items-center gap-2">
                                          <BuildingOfficeIcon className="w-5 h-5" /> Business Information
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                          <div><span className="font-medium text-gray-700">Business Name:</span> <span className="text-gray-900">{selectedResident.business_name || 'N/A'}</span></div>
                                          <div><span className="font-medium text-gray-700">Business Type:</span> <span className="text-gray-900">{selectedResident.business_type || 'N/A'}</span></div>
                                          <div><span className="font-medium text-gray-700">Business Address:</span> <span className="text-gray-900">{selectedResident.business_address || 'N/A'}</span></div>
                                          <div><span className="font-medium text-gray-700">Business Location:</span> <span className="text-gray-900">{selectedResident.business_location || 'N/A'}</span></div>
                                        </div>
                                      </div>

                                      {/* Vaccination Information Card */}
                                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200 shadow-sm transition-all duration-300 hover:shadow-md">
                                        <h4 className="text-lg font-semibold text-green-900 mb-4 flex items-center gap-2">
                                          <HeartIcon className="w-5 h-5" /> Vaccination Information
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                          <div><span className="font-medium text-gray-700">Vaccination Status:</span> <span className="text-gray-900">{selectedResident.vaccination_status || 'N/A'}</span></div>
                                          <div><span className="font-medium text-gray-700">Year Vaccinated:</span> <span className="text-gray-900">{selectedResident.year_vaccinated || 'N/A'}</span></div>
                                          <div><span className="font-medium text-gray-700">Other Vaccine:</span> <span className="text-gray-900">{selectedResident.other_vaccine || 'N/A'}</span></div>
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium text-gray-700">Vaccines Received:</span>
                                            <span className="text-gray-900">
                                              {selectedResident.vaccine_received && selectedResident.vaccine_received.length > 0
                                                ? selectedResident.vaccine_received.join(', ')
                                                : 'N/A'}
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Special Categories */}
                                      {selectedResident.special_categories?.length > 0 && (
                                        <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-6 border border-orange-200 shadow-sm transition-all duration-300 hover:shadow-md">
                                          <h4 className="text-lg font-semibold text-orange-900 mb-4 flex items-center gap-2">
                                            <ShieldCheckIcon className="w-5 h-5" /> Special Categories
                                          </h4>
                                          <div className="flex flex-wrap gap-2">
                                            {selectedResident.special_categories.map((cat, index) => (
                                              <span key={index} className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 hover:scale-105">
                                                {cat}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Enhanced Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center mt-8 px-6 pb-6">
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                  <div className="flex items-center justify-between gap-4">
                    {/* Page Info */}
                    <div className="text-sm text-gray-600">
                      Page {currentPage} of {totalPages}
                    </div>
                    
                    {/* Pagination Controls */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                        disabled={currentPage <= 1}
                        className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Previous
                      </button>

                      {/* Page Numbers */}
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                          if (pageNum > totalPages) return null;
                          return (
                            <button
                              key={pageNum}
                              onClick={() => handlePageChange(pageNum)}
                              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                                currentPage === pageNum
                                  ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg'
                                  : 'hover:bg-gray-100'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage >= totalPages}
                        className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 flex items-center gap-2"
                      >
                        Next
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          )}
        </div>

        {/* Enhanced Select User Modal */}
        {showSelectModal && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg transform transition-all animate-fade-in-up">
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-t-2xl p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <UserIcon className="w-6 h-6" />
                    Select User
                  </h2>
                  <button
                    onClick={() => setShowSelectModal(false)}
                    className="text-white hover:text-red-200 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-300 rounded-full p-1"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>
                <p className="text-blue-100 mt-2">Choose a user without a resident profile</p>
              </div>

              <div className="p-6">
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Available Users:
                  </label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-300 shadow-sm hover:shadow-md"
                  >
                    <option value="">-- Select a user --</option>
                    {usersWithoutProfiles.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowSelectModal(false)}
                    className="px-6 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-opacity-50 hover:shadow-md"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmSelection}
                    disabled={!selectedUserId}
                    className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-opacity-50 hover:shadow-md transform hover:scale-105 ${
                      selectedUserId
                        ? "bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 focus:ring-green-300"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    Proceed
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Generic Info Modal (replaces alert) */}
        {showInfoModal && (
          <div className="fixed inset-0 z-[9998] bg-black bg-opacity-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg transform transition-all animate-fade-in-up">
              <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900">{infoModal.title}</h3>
                    <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{infoModal.message}</p>
                  </div>
                  <div className="flex items-start">
                    <button onClick={closeInfo} className="text-gray-500 hover:text-gray-700 focus:outline-none">
                      <XMarkIcon className="w-6 h-6" />
                    </button>
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <button onClick={closeInfo} className="px-5 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl">OK</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Modal for deletion */}
        {showConfirmModal && (
          <div 
            className="fixed inset-0 z-[9999] bg-black bg-opacity-50 flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={closeConfirm}
          >
            <div 
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md transform transition-all animate-fade-in-up"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900">Confirm Disable</h3>
                    <p className="mt-2 text-sm text-gray-700">Are you sure you want to disable this resident? This action cannot be undone.</p>
                  </div>
                  <div className="flex items-start">
                    <button 
                      onClick={closeConfirm} 
                      className="text-gray-500 hover:text-gray-700 focus:outline-none transition-colors"
                      aria-label="Close modal"
                    >
                      <XMarkIcon className="w-6 h-6" />
                    </button>
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button 
                    onClick={closeConfirm} 
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmDelete} 
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors font-medium"
                  >
                    Disable
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Comment Modal for Denying Verification */}
        {showCommentModal && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md transform transition-all animate-fade-in-up">
              <div className="bg-gradient-to-r from-red-500 to-orange-600 rounded-t-2xl p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <ExclamationTriangleIcon className="w-6 h-6" />
                    Deny Residency Verification
                  </h2>
                  <button
                    onClick={() => setShowCommentModal(false)}
                    className="text-white hover:text-red-200 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-300 rounded-full p-1"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>
                <p className="text-red-100 mt-2">Please provide a reason for denying this verification</p>
              </div>

              <div className="p-6">
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Reason for Denial:
                  </label>
                  <textarea
                    key={`comment-${currentResidentId}`}
                    value={comment}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setComment(newValue);
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-300 shadow-sm hover:shadow-md"
                    rows="4"
                    placeholder="Enter reason for denial..."
                    required
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowCommentModal(false)}
                    className="px-6 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-opacity-50 hover:shadow-md"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDenySubmit}
                    className="px-6 py-3 rounded-xl font-medium transition-all duration-300 bg-gradient-to-r from-red-600 to-orange-600 text-white hover:from-red-700 hover:to-orange-700 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-opacity-50 hover:shadow-md"
                  >
                    Deny Verification
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-gradient-to-br from-green-50 via-white to-emerald-50 rounded-3xl shadow-2xl border border-green-100 w-full max-w-4xl max-h-[90vh] overflow-y-auto relative">
              {/* Sticky Modal Header with Stepper */}
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-t-3xl p-8 sticky top-0 z-10 flex flex-col gap-2 shadow-md">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-extrabold text-white flex items-center gap-3 tracking-tight drop-shadow-lg">
                    <PencilIcon className="w-7 h-7" />
                    {editData.user_id ? "Create Resident Profile" : "Edit Resident"}
                  </h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-white hover:text-red-200 transition-colors duration-200 text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-red-300 rounded-full p-1"
                  >
                    <XMarkIcon className="w-7 h-7" />
                  </button>
                </div>
                {/* Stepper - Enhanced Green Theme */}
                <div className="flex items-center justify-center gap-2 mt-4">
                  <div className="flex flex-col items-center">
                    <UserIcon className="w-6 h-6 text-white bg-gradient-to-br from-green-500 to-emerald-600 rounded-full p-1 shadow-lg ring-2 ring-green-400 transition-all duration-300 hover:scale-110" />
                    <span className="text-xs font-semibold text-green-100 mt-1">Personal</span>
                  </div>
                  <div className="w-8 h-1 bg-gradient-to-r from-green-200 to-emerald-300 rounded-full shadow-sm transition-all duration-300" />
                  <div className="flex flex-col items-center">
                    <AcademicCapIcon className="w-6 h-6 text-white bg-gradient-to-br from-green-500 to-emerald-600 rounded-full p-1 shadow-lg transition-all duration-300 hover:scale-110" />
                    <span className="text-xs font-semibold text-green-100 mt-1">Additional</span>
                  </div>
                  <div className="w-8 h-1 bg-gradient-to-r from-green-200 to-emerald-300 rounded-full shadow-sm transition-all duration-300" />
                  <div className="flex flex-col items-center">
                    <ShieldCheckIcon className="w-6 h-6 text-white bg-gradient-to-br from-green-500 to-emerald-600 rounded-full p-1 shadow-lg transition-all duration-300 hover:scale-110" />
                    <span className="text-xs font-semibold text-green-100 mt-1">Special</span>
                  </div>
                  <div className="w-8 h-1 bg-gradient-to-r from-green-200 to-emerald-300 rounded-full shadow-sm transition-all duration-300" />
                  <div className="flex flex-col items-center">
                    <HeartIcon className="w-6 h-6 text-white bg-gradient-to-br from-green-500 to-emerald-600 rounded-full p-1 shadow-lg transition-all duration-300 hover:scale-110" />
                    <span className="text-xs font-semibold text-green-100 mt-1">Vaccine</span>
                  </div>
                  <div className="w-8 h-1 bg-gradient-to-r from-green-200 to-emerald-300 rounded-full shadow-sm transition-all duration-300" />
                  <div className="flex flex-col items-center">
                    <UserIcon className="w-6 h-6 text-white bg-gradient-to-br from-green-500 to-emerald-600 rounded-full p-1 shadow-lg transition-all duration-300 hover:scale-110" />
                    <span className="text-xs font-semibold text-green-100 mt-1">Photo</span>
                  </div>
                </div>
              </div>

              <div className="p-10 space-y-10 bg-gradient-to-br from-white/80 to-green-50/80 rounded-b-3xl animate-fadeIn">
                {/* Avatar Preview */}
                <div className="flex justify-center mb-8 animate-fadeIn">
                  <div className="relative w-36 h-36 flex items-center justify-center">
                    <img
                      src={editData.avatar ? URL.createObjectURL(editData.avatar) : (editData.avatar_url || "https://ui-avatars.com/api/?name=" + (editData.first_name || "R") + "+" + (editData.last_name || "P"))}
                      alt="avatar preview"
                      className="w-36 h-36 rounded-full object-cover border-4 border-emerald-400 shadow-xl bg-green-50 transition-all duration-300 hover:scale-105"
                    />
                    <label className="absolute bottom-2 right-2 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-full p-3 cursor-pointer shadow-lg hover:scale-110 hover:bg-green-700 transition-all duration-200 flex items-center justify-center border-2 border-white">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setEditData((prev) => ({ ...prev, avatar: e.target.files[0] }))}
                        className="hidden"
                      />
                      <PencilIcon className="w-5 h-5" />
                    </label>
                  </div>
                </div>

                {/* Section Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Personal Information Section */}
                  <div className="bg-white/90 rounded-2xl shadow-lg border border-green-100 p-6 space-y-4 animate-fadeIn transition-all duration-300 hover:shadow-xl">
                    <h3 className="text-lg font-bold text-green-700 flex items-center gap-2 mb-2">
                      <UserIcon className="w-5 h-5" /> Personal Information
                    </h3>
                    {["first_name", "middle_name", "last_name", "name_suffix", "birth_date", "birth_place", "age", "nationality", "religion", "email", "mobile_number", "current_address", "years_in_barangay", "household_no", "relation_to_head", "housing_type"].map((field) => (
                      <div key={field}>
                        <label className="block text-sm font-medium text-green-700 mb-1 capitalize">
                          {field.replaceAll("_", " ")}
                        </label>
                        <input
                          type={field === "birth_date" ? "date" : "text"}
                          name={field}
                          value={field === "birth_date" ? toDateInputValue(editData[field]) : (editData[field] || "")}
                          onChange={handleInputChange}
                          className="w-full border border-green-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm placeholder-green-300 text-green-900 hover:shadow-md focus:shadow-lg"
                          placeholder={field.replaceAll("_", " ")}
                          required={field === "household_no"}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Additional Information Section */}
                  <div className="bg-white/90 rounded-2xl shadow-lg border border-green-100 p-6 space-y-4 animate-fadeIn transition-all duration-300 hover:shadow-xl">
                    <h3 className="text-lg font-bold text-green-700 flex items-center gap-2 mb-2">
                      <AcademicCapIcon className="w-5 h-5" /> Additional Information
                    </h3>
                    {/* Sex */}
                    <div>
                      <label className="block text-sm font-medium text-green-700 mb-1">Sex</label>
                      <select
                        name="sex"
                        value={editData.sex || ""}
                        onChange={handleInputChange}
                        className="w-full border border-green-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm text-green-900 hover:shadow-md focus:shadow-lg"
                      >
                        <option value="">Select</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                    {/* Civil Status */}
                    <div>
                      <label className="block text-sm font-medium text-green-700 mb-1">Civil Status</label>
                      <select
                        name="civil_status"
                        value={editData.civil_status || ""}
                        onChange={handleInputChange}
                        className="w-full border border-green-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm text-green-900 hover:shadow-md focus:shadow-lg"
                      >
                        <option value="">Select</option>
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Widowed">Widowed</option>
                        <option value="Divorced">Divorced</option>
                      </select>
                    </div>
                    {/* Voter Status */}
                    <div>
                      <label className="block text-sm font-medium text-green-700 mb-1">Voter Status</label>
                      <input
                        type="text"
                        name="voter_status"
                        value={editData.voter_status || ""}
                        onChange={handleInputChange}
                        className="w-full border border-green-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm text-green-900 hover:shadow-md focus:shadow-lg"
                        placeholder="Voter Status"
                      />
                    </div>
                    {/* Work & Education */}
                    {["educational_attainment", "classified_sector", "occupation_type", "salary_income", "business_info", "business_type", "business_location", "voting_location", "voters_id_number", "year_vaccinated", "other_vaccine"].map((field) => (
                      <div key={field}>
                        <label className="block text-sm font-medium text-green-700 mb-1 capitalize">
                          {field.replaceAll("_", " ")}
                        </label>
                        <input
                          type="text"
                          name={field}
                          value={editData[field] || ""}
                          onChange={handleInputChange}
                          className="w-full border border-green-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm text-green-900 hover:shadow-md focus:shadow-lg"
                          placeholder={field.replaceAll("_", " ")}
                        />
                      </div>
                    ))}
                    {/* Boolean Fields */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-green-700 mb-1">Head of Family</label>
                        <select
                          name="head_of_family"
                          value={editData.head_of_family ? "1" : "0"}
                          onChange={handleInputChange}
                          className="w-full border border-green-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm text-green-900 hover:shadow-md focus:shadow-lg"
                        >
                          <option value="0">No</option>
                          <option value="1">Yes</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-green-700 mb-1">Business Outside Barangay</label>
                        <select
                          name="business_outside_barangay"
                          value={editData.business_outside_barangay ? "1" : "0"}
                          onChange={handleInputChange}
                          className="w-full border border-green-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm text-green-900 hover:shadow-md focus:shadow-lg"
                        >
                          <option value="0">No</option>
                          <option value="1">Yes</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Vaccination Information */}
                <div className="bg-white/90 rounded-2xl shadow-lg border border-green-100 p-6 animate-fadeIn transition-all duration-300 hover:shadow-xl">
                  <h3 className="text-lg font-bold text-green-700 flex items-center gap-2 mb-2">
                    <HeartIcon className="w-5 h-5" /> Vaccination Information
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {["Pfizer-BioNTech", "Oxford-AstraZeneca", "Sputnik V", "Janssen", "Sinovac", "None"].map((vaccine) => (
                      <label key={vaccine} className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200 hover:bg-green-100 transition-colors duration-200 shadow-sm cursor-pointer transition-all duration-300 hover:shadow-md">
                        <input
                          type="checkbox"
                          name="vaccine_received"
                          value={vaccine}
                          checked={editData.vaccine_received?.includes(vaccine)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setEditData((prev) => {
                              const current = prev.vaccine_received || [];
                              const updated = checked
                                ? [...current, vaccine]
                                : current.filter((v) => v !== vaccine);
                              return { ...prev, vaccine_received: updated };
                            });
                          }}
                          className="w-4 h-4 text-green-600 focus:ring-green-500 focus:ring-2 focus:ring-offset-1"
                        />
                        <span className="text-sm font-medium text-green-700">{vaccine}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Special Categories */}
                <div className="bg-white/90 rounded-2xl shadow-lg border border-green-100 p-6 animate-fadeIn transition-all duration-300 hover:shadow-xl">
                  <h3 className="text-lg font-bold text-green-700 flex items-center gap-2 mb-2">
                    <ShieldCheckIcon className="w-5 h-5" /> Special Categories
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {["Solo Parent", "Solo Parent w/ ID", "Senior Citizen", "Senior Citizen w/ ID", "Senior Citizen w/ Pension", "Indigenous people", "4P's Member", "PWD", "PWD w/ ID"].map((cat) => (
                      <label key={cat} className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-emerald-200 hover:bg-emerald-50 transition-colors duration-200 shadow-sm cursor-pointer transition-all duration-300 hover:shadow-md">
                        <input
                          type="checkbox"
                          name="special_categories"
                          value={cat}
                          checked={editData.special_categories?.includes(cat) || false}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setEditData((prev) => {
                              const prevCats = prev.special_categories || [];
                              const updated = checked
                                ? [...prevCats, cat]
                                : prevCats.filter((c) => c !== cat);
                              return { ...prev, special_categories: updated };
                            });
                          }}
                          className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 focus:ring-2 focus:ring-offset-1"
                        />
                        <span className="text-sm font-medium text-green-700">{cat}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-8 flex justify-end gap-4 pt-6 border-t border-green-100 sticky bottom-0 bg-gradient-to-r from-green-50 to-emerald-50 z-10 rounded-b-3xl animate-fadeIn">
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-6 py-3 bg-gradient-to-r from-green-100 to-emerald-100 hover:from-green-200 hover:to-emerald-200 text-green-700 rounded-xl font-medium transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-300 focus:ring-opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-semibold shadow-lg transition-all duration-300 transform hover:scale-105 flex items-center gap-2 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Saving...</span>
                    ) : (
                      <><CheckCircleIcon className="w-5 h-5" /> Save Changes</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

                 {/* Image Modal */}
                 {showImageModal && selectedImage && (
           <div
             className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4 backdrop-blur-sm"
             onClick={() => {
               setShowImageModal(false);
               setSelectedImage(null);
               setSelectedImageTitle('');
               setImageLoading(false);
             }}
           >
             <div
               className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto relative animate-fade-in-up"
               onClick={(e) => e.stopPropagation()}
             >
               <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50 rounded-t-2xl">
                 <h3 className="text-xl font-bold text-gray-900">{selectedImageTitle}</h3>
                 <div className="flex items-center gap-3">
                   <button
                     onClick={() => window.open(selectedImage, '_blank')}
                     className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-opacity-50"
                   >
                     <EyeIcon className="w-4 h-4" />
                     Open in New Tab
                   </button>
                   <button
                     onClick={() => {
                       setShowImageModal(false);
                       setSelectedImage(null);
                       setSelectedImageTitle('');
                       setImageLoading(false);
                     }}
                     className="text-gray-600 hover:text-gray-800 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-opacity-50 rounded-full p-1"
                   >
                     <XMarkIcon className="w-6 h-6" />
                   </button>
                 </div>
               </div>
               <div className="p-6">
                 <div className="relative">
                   {imageLoading && (
                     <div className="flex items-center justify-center w-full h-64">
                       <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                     </div>
                   )}
                   <img
                     src={selectedImage}
                     alt={selectedImageTitle}
                     className={`w-full h-auto max-h-[70vh] object-contain mx-auto rounded-lg shadow-lg transition-all duration-300 ${imageLoading ? 'hidden' : ''}`}
                     onLoad={() => setImageLoading(false)}
                     onError={(e) => {
                       console.error("Image failed to load:", selectedImage);
                       setImageLoading(false);
                       e.target.style.display = 'none';
                       e.target.nextSibling.style.display = 'flex';
                     }}
                   />
                   <div className="hidden items-center justify-center w-full h-64 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 transition-all duration-300">
                     <div className="text-center">
                       <DocumentTextIcon className="w-16 h-16 text-gray-400 mx-auto mb-2" />
                       <p className="text-gray-500 font-medium">Image failed to load</p>
                       <p className="text-gray-400 text-sm">The image may have been deleted or moved</p>
                     </div>
                   </div>
                 </div>
               </div>
             </div>
           </div>
         )}

         {/* Help System Modals */}
         <HelpGuide 
           isOpen={showHelpGuide} 
           onClose={() => setShowHelpGuide(false)} 
         />
         
         <QuickStartGuide 
           isOpen={showQuickStart} 
           onClose={() => setShowQuickStart(false)}
           onComplete={() => {
             toast.success("Quick Start Guide completed! You're ready to use the system.");
           }}
         />
         
         <FAQ 
           isOpen={showFAQ} 
           onClose={() => setShowFAQ(false)} 
         />
         
         {showFeatureExplanation && currentFeatureExplanation && (
           <FeatureExplanation
             title={currentFeatureExplanation.title}
             description={currentFeatureExplanation.description}
             steps={currentFeatureExplanation.steps}
             tips={currentFeatureExplanation.tips}
             onClose={() => {
               setShowFeatureExplanation(false);
               setCurrentFeatureExplanation(null);
             }}
           />
         )}
      </main>
    </ErrorBoundary>
    );
  };

  return renderUIControls();
};

export default ResidentsRecords;



