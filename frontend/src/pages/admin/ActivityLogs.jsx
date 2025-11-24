import React, { useState, useEffect } from 'react';
import axios from '../../utils/axiosConfig';
import { format, subDays, subMonths, subYears, startOfDay, endOfDay } from 'date-fns';
import Navbar from "../../components/Navbar";
import Sidebar from "../../components/Sidebar";
import { useAdminResponsiveLayout } from "../../hooks/useAdminResponsiveLayout";
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  EyeIcon,
  ArrowPathIcon,
  ChartBarIcon,
  UserIcon,
  ClockIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
  XCircleIcon,
  DocumentTextIcon,
  CalendarIcon,
  ServerIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/solid';

const ActivityLogs = () => {
  const { mainClasses } = useAdminResponsiveLayout();
  const [logs, setLogs] = useState([]);
  
  // Helper function to get action badge styling and display text
  const getActionBadge = (action) => {
    const actionLower = action.toLowerCase();
    let className = 'px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap inline-flex items-center ';
    
    // Format display text: handle dots, underscores, and capitalization
    let displayText = action
      .replace(/\./g, ' ') // Replace dots with spaces
      .replace(/_/g, ' ') // Replace underscores with spaces
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    // Determine badge color based on action type
    if (actionLower.includes('login')) {
      className += 'bg-green-100 text-green-800 border border-green-200';
    } else if (actionLower.includes('logout')) {
      className += 'bg-yellow-100 text-yellow-800 border border-yellow-200';
    } else if (actionLower.includes('delete') || actionLower.includes('deleted')) {
      className += 'bg-red-100 text-red-800 border border-red-200';
    } else if (actionLower.includes('restore') || actionLower.includes('restored')) {
      className += 'bg-orange-100 text-orange-800 border border-orange-200';
    } else if (actionLower.includes('backup')) {
      if (actionLower.includes('create') || actionLower.includes('created')) {
        className += 'bg-blue-100 text-blue-800 border border-blue-200';
      } else if (actionLower.includes('restore') || actionLower.includes('restored')) {
        className += 'bg-orange-100 text-orange-800 border border-orange-200';
      } else {
        className += 'bg-indigo-100 text-indigo-800 border border-indigo-200';
      }
    } else if (actionLower.includes('generate_pdf') || actionLower.includes('download_pdf') || actionLower.includes('download')) {
      className += 'bg-indigo-100 text-indigo-800 border border-indigo-200';
    } else if (actionLower.includes('program_created') || actionLower.includes('program_updated')) {
      className += 'bg-emerald-100 text-emerald-800 border border-emerald-200';
    } else if (actionLower.includes('beneficiary_added_paid')) {
      className += 'bg-green-100 text-green-800 border-2 border-green-300';
    } else if (actionLower.includes('beneficiary_added')) {
      className += 'bg-cyan-100 text-cyan-800 border border-cyan-200';
    } else if (actionLower.includes('create') || actionLower.includes('created')) {
      className += 'bg-blue-100 text-blue-800 border border-blue-200';
    } else if (actionLower.includes('update') || actionLower.includes('updated')) {
      className += 'bg-purple-100 text-purple-800 border border-purple-200';
    } else {
      className += 'bg-gray-100 text-gray-800 border border-gray-200';
    }
    
    return { className, displayText };
  };
  const normalizeRole = (role) => {
    if (typeof role !== 'string') {
      return '';
    }

    const value = role.trim().toLowerCase();

    if (!value) {
      return '';
    }

    if (['resident', 'residents'].includes(value)) {
      return 'resident';
    }

    if (['admin', 'administrator', 'administrators'].includes(value)) {
      return 'admin';
    }

    if (['staff', 'staffs'].includes(value)) {
      return 'staff';
    }

    if (value === 'system') {
      return 'system';
    }

    return value;
  };
  const getLogUserRole = (log) => {
    if (!log) {
      return 'system';
    }

    const roleCandidates = [
      log.user?.role,
      log.user?.user_type,
      log.user_type,
      log.role,
    ];

    for (const candidate of roleCandidates) {
      const normalized = normalizeRole(candidate);
      if (normalized) {
        return normalized;
      }
    }

    return 'system';
  };

  const getRoleLabel = (role) => {
    const displayMap = {
      system: 'System',
      admin: 'Admin',
      resident: 'Resident',
      staff: 'Staff',
    };

    if (!role) {
      return 'System';
    }

    return displayMap[role] || role.charAt(0).toUpperCase() + role.slice(1);
  };

  const filterLogsByRole = (logItems, role) => logItems.filter((log) => getLogUserRole(log) === role);

  const initialCounts = {
    total: 0,
    admin: 0,
    resident: 0,
    staff: 0,
    system: 0,
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    action: '',
    model_type: '',
    search: '',
    date_from: '',
    date_to: '',
    time_from: '',
    time_to: '',
    user_type: 'all',
    ip_address: '',
    model_id: '',
    description_search: '',
    status: '',
    sort_by: 'created_at',
    sort_order: 'desc',
    page: 1,
    per_page: 20,
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedActions, setSelectedActions] = useState([]);
  const [selectedModelTypes, setSelectedModelTypes] = useState([]);
  const [filterOptions, setFilterOptions] = useState({
    actions: [],
    model_types: [],
    users: [],
  });
  const [statistics, setStatistics] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [securityAlerts, setSecurityAlerts] = useState([]);
  const [auditSummary, setAuditSummary] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); // New state for tab navigation
  const [counts, setCounts] = useState(initialCounts);
  const [currentLogTotal, setCurrentLogTotal] = useState(0);
  const [quickDateFilter, setQuickDateFilter] = useState(''); // Quick date filter selection
  const [inactiveResidents, setInactiveResidents] = useState([]);
  const [inactiveResidentsLoading, setInactiveResidentsLoading] = useState(false);
  const [inactiveResidentsPage, setInactiveResidentsPage] = useState(1);
  const [inactiveResidentsTotal, setInactiveResidentsTotal] = useState(0);
  const [flaggedResidentsCount, setFlaggedResidentsCount] = useState(0);
  const [showInactiveResidents, setShowInactiveResidents] = useState(false);

  const adminLogs = filterLogsByRole(logs, 'admin');
  const residentLogs = filterLogsByRole(logs, 'resident');
  const staffLogs = filterLogsByRole(logs, 'staff');

  useEffect(() => {
    fetchLogs();
    fetchFilterOptions();
    fetchStatistics();
    fetchSecurityAlerts();
    fetchAuditSummary();
    fetchFlaggedResidentsCount();
    fetchInactiveResidents(); // Always fetch inactive residents
  }, [filters.page, filters.per_page, filters.user_type, filters.action, filters.model_type, filters.search, filters.date_from, filters.date_to, filters.time_from, filters.time_to, filters.ip_address, filters.model_id, filters.description_search, filters.status, filters.sort_by, filters.sort_order]);

  useEffect(() => {
    fetchInactiveResidents();
  }, [inactiveResidentsPage]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== '' && value !== 'all' && key !== 'page') {
          params.append(key, value);
        }
      });

      // Add page separately
      if (filters.page > 1) {
        params.append('page', filters.page);
      }

      const response = await axios.get(`/admin/activity-logs?${params}`);
      const logsResponse = response.data.logs ?? {};
      const countsResponse = response.data.counts ?? null;
      const logData = logsResponse.data ?? [];

      setLogs(logData);
      setTotalPages(logsResponse.last_page ?? 1);
      setCurrentLogTotal(logsResponse.total ?? logData.length ?? 0);
      setCounts((prev) => ({
        total: countsResponse?.total ?? logsResponse.total ?? prev.total ?? 0,
        admin: countsResponse?.admin ?? prev.admin ?? 0,
        resident: countsResponse?.resident ?? prev.resident ?? 0,
        staff: countsResponse?.staff ?? prev.staff ?? 0,
        system: countsResponse?.system ?? prev.system ?? 0,
      }));
      setError(null);
    } catch (err) {
      setError('Failed to fetch activity logs');
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const response = await axios.get('/admin/activity-logs/filters/options');
      setFilterOptions(response.data.filters);
    } catch (err) {
      console.error('Error fetching filter options:', err);
    }
  };

  const fetchStatistics = async () => {
    try {
      const response = await axios.get('/admin/activity-logs/statistics/summary');
      setStatistics(response.data.statistics);
    } catch (err) {
      console.error('Error fetching statistics:', err);
    }
  };

  const fetchSecurityAlerts = async () => {
    try {
      const response = await axios.get('/admin/activity-logs/security/alerts');
      setSecurityAlerts(response.data.alerts || []);
    } catch (err) {
      console.error('Error fetching security alerts:', err);
    }
  };

  const fetchAuditSummary = async () => {
    try {
      const response = await axios.get('/admin/activity-logs/audit/summary');
      setAuditSummary(response.data.audit_summary);
    } catch (err) {
      console.error('Error fetching audit summary:', err);
    }
  };

  const fetchInactiveResidents = async () => {
    try {
      setInactiveResidentsLoading(true);
      const response = await axios.get(`/admin/activity-logs/inactive-residents?page=${inactiveResidentsPage}&per_page=20`);
      // Updated to match new response format: { data: [...], meta: {...} }
      setInactiveResidents(response.data.data || []);
      setInactiveResidentsTotal(response.data.meta?.total || 0);
    } catch (err) {
      console.error('Error fetching inactive residents:', err);
      setError('Failed to fetch inactive residents');
    } finally {
      setInactiveResidentsLoading(false);
    }
  };

  const fetchFlaggedResidentsCount = async () => {
    try {
      const response = await axios.get('/admin/activity-logs/flagged-residents-count');
      setFlaggedResidentsCount(response.data.flagged_count || 0);
    } catch (err) {
      console.error('Error fetching flagged residents count:', err);
    }
  };

  const handleFlagInactiveResidents = async () => {
    if (!window.confirm('This will flag all residents with no activity for 1 year as "For Review". Continue?')) {
      return;
    }

    try {
      const response = await axios.post('/admin/activity-logs/flag-inactive-residents');
      alert(response.data.message || 'Residents flagged successfully');
      fetchFlaggedResidentsCount();
      if (showInactiveResidents) {
        fetchInactiveResidents();
      }
    } catch (err) {
      console.error('Error flagging inactive residents:', err);
      alert('Failed to flag inactive residents');
    }
  };


  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value,
      page: field === 'page' ? value : 1, // Only reset to page 1 if not changing page
    }));
  };

  const handleSearch = () => {
    setFilters(prev => ({ ...prev, page: 1 }));
    fetchLogs();
  };

  const clearAllFilters = () => {
    setFilters({
      action: '',
      model_type: '',
      search: '',
      date_from: '',
      date_to: '',
      time_from: '',
      time_to: '',
      user_type: 'all',
      ip_address: '',
      model_id: '',
      description_search: '',
      status: '',
      sort_by: 'created_at',
      sort_order: 'desc',
      page: 1,
      per_page: 20,
    });
    setSelectedActions([]);
    setSelectedModelTypes([]);
    setQuickDateFilter('');
    fetchLogs();
  };

  const hasActiveFilters = () => {
    return filters.action !== '' ||
           filters.model_type !== '' ||
           filters.search !== '' ||
           filters.date_from !== '' ||
           filters.date_to !== '' ||
           filters.time_from !== '' ||
           filters.time_to !== '' ||
           filters.user_type !== 'all' ||
           filters.ip_address !== '' ||
           filters.model_id !== '' ||
           filters.description_search !== '' ||
           filters.status !== '' ||
           selectedActions.length > 0 ||
           selectedModelTypes.length > 0;
  };

  const handleActionToggle = (action) => {
    setSelectedActions(prev => {
      const newActions = prev.includes(action)
        ? prev.filter(a => a !== action)
        : [...prev, action];
      setFilters(prevFilters => ({
        ...prevFilters,
        action: newActions.join(','),
        page: 1
      }));
      return newActions;
    });
  };

  const handleModelTypeToggle = (modelType) => {
    setSelectedModelTypes(prev => {
      const newTypes = prev.includes(modelType)
        ? prev.filter(t => t !== modelType)
        : [...prev, modelType];
      setFilters(prevFilters => ({
        ...prevFilters,
        model_type: newTypes.join(','),
        page: 1
      }));
      return newTypes;
    });
  };


  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setFilters(prev => ({ ...prev, user_type: tab, page: 1 }));
    fetchLogs();
  };

  const handleQuickDateFilter = (period) => {
    const today = new Date();
    let dateFrom = '';
    let dateTo = format(endOfDay(today), 'yyyy-MM-dd');
    let timeFrom = '';
    let timeTo = '23:59';

    switch (period) {
      case 'today':
        dateFrom = format(startOfDay(today), 'yyyy-MM-dd');
        timeFrom = '00:00';
        break;
      case 'yesterday':
        const yesterday = subDays(today, 1);
        dateFrom = format(startOfDay(yesterday), 'yyyy-MM-dd');
        dateTo = format(endOfDay(yesterday), 'yyyy-MM-dd');
        timeFrom = '00:00';
        break;
      case 'last_24_hours':
        dateFrom = format(startOfDay(subDays(today, 1)), 'yyyy-MM-dd');
        timeFrom = format(new Date(Date.now() - 24 * 60 * 60 * 1000), 'HH:mm');
        break;
      case 'last_7_days':
        dateFrom = format(startOfDay(subDays(today, 7)), 'yyyy-MM-dd');
        timeFrom = '00:00';
        break;
      case 'last_week':
        dateFrom = format(startOfDay(subDays(today, 7)), 'yyyy-MM-dd');
        break;
      case 'last_30_days':
        dateFrom = format(startOfDay(subDays(today, 30)), 'yyyy-MM-dd');
        timeFrom = '00:00';
        break;
      case 'last_month':
        dateFrom = format(startOfDay(subMonths(today, 1)), 'yyyy-MM-dd');
        break;
      case 'last_3_months':
        dateFrom = format(startOfDay(subMonths(today, 3)), 'yyyy-MM-dd');
        timeFrom = '00:00';
        break;
      case 'last_6_months':
        dateFrom = format(startOfDay(subMonths(today, 6)), 'yyyy-MM-dd');
        timeFrom = '00:00';
        break;
      case 'last_year':
        dateFrom = format(startOfDay(subYears(today, 1)), 'yyyy-MM-dd');
        break;
      case 'clear':
        dateFrom = '';
        dateTo = '';
        timeFrom = '';
        timeTo = '';
        setQuickDateFilter('');
        setFilters(prev => ({ ...prev, date_from: '', date_to: '', time_from: '', time_to: '', page: 1 }));
        fetchLogs();
        return;
      default:
        return;
    }

    setQuickDateFilter(period);
    setFilters(prev => ({ 
      ...prev, 
      date_from: dateFrom, 
      date_to: dateTo,
      time_from: timeFrom,
      time_to: timeTo,
      page: 1 
    }));
    fetchLogs();
  };

  const handleExport = async () => {
    try {
      const response = await axios.post('/admin/activity-logs/export', filters);
      // Create and download CSV
      const csvContent = generateCSV(response.data.logs.data);
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting logs:', err);
    }
  };

  const handleCleanup = async () => {
    if (window.confirm('Are you sure you want to delete activity logs older than 90 days?')) {
      try {
        await axios.delete('/admin/activity-logs/cleanup');
        fetchLogs();
        fetchStatistics();
      } catch (err) {
        console.error('Error cleaning up logs:', err);
      }
    }
  };

  const generateCSV = (data) => {
    const headers = ['Date', 'User', 'Action', 'Model', 'Description', 'IP Address'];
    const rows = data.map(log => [
      format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
      log.user?.name || 'System',
      log.action,
      log.model_type ? `${log.model_type}#${log.model_id}` : 'N/A',
      log.description,
      log.ip_address || 'N/A',
    ]);

    return [headers, ...rows].map(row => row.map(field => `"${field}"`).join(',')).join('\n');
  };


  const formatDate = (dateString) => {
    return format(new Date(dateString), 'MMM dd, yyyy HH:mm:ss');
  };

  if (loading && logs.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-green-50 to-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600 font-medium">Loading activity logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
      <Navbar />
      <Sidebar />
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 min-h-screen ml-0 lg:ml-64 pt-20 lg:pt-36 px-4 pb-16 font-sans">
      <div className="w-full max-w-[98%] mx-auto space-y-8 px-2 lg:px-4">
        {/* Enhanced Header */}
        <div className="text-center space-y-6 py-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full shadow-xl mb-4">
            <ChartBarIcon className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl lg:text-6xl font-bold text-green-600 tracking-tight leading-tight">
            Activity Logs
          </h1>
          <div className="w-32 h-1 bg-green-600 rounded-full mx-auto"></div>
          <p className="text-slate-600 text-lg lg:text-xl max-w-3xl mx-auto leading-relaxed font-medium">
            Comprehensive monitoring system for tracking all system activities and user interactions
          </p>
          <p className="text-slate-500 text-base lg:text-lg leading-relaxed max-w-3xl mx-auto">
            Monitor admin actions, resident activities, and staff operations with detailed audit trails and real-time analytics
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 animate-fade-in">
            <div className="flex items-center gap-3">
              <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
              <div>
                <h4 className="text-red-800 font-semibold">Error Loading Data</h4>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Flagged Residents Notification */}
        {flaggedResidentsCount > 0 && (
          <div className="bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-300 rounded-xl p-6 mb-6 animate-fade-in shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center shadow-lg">
                  <ExclamationTriangleIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-orange-900 flex items-center gap-2">
                    Residents Flagged for Review
                    <span className="px-3 py-1 bg-red-600 text-white text-sm rounded-full font-bold">
                      {flaggedResidentsCount}
                    </span>
                  </h3>
                  <p className="text-orange-800 text-sm mt-1">
                    {flaggedResidentsCount} resident{flaggedResidentsCount !== 1 ? 's' : ''} {flaggedResidentsCount !== 1 ? 'have' : 'has'} been flagged for review due to inactivity (no login/activity for 1 year)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowInactiveResidents(!showInactiveResidents)}
                className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-semibold transition-all duration-300 transform hover:scale-105"
              >
                <EyeIcon className="w-5 h-5" />
                {showInactiveResidents ? 'Hide' : 'View'} Inactive Residents
              </button>
            </div>
          </div>
        )}

        {/* Enhanced Statistics Cards */}
        {statistics && (
          <div className="mb-12">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 hover:shadow-md transition-all duration-300">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-bold uppercase text-gray-500 mb-2">TOTAL LOGS</p>
                    <p className="text-3xl font-black text-gray-900">{statistics.total_logs.toLocaleString()}</p>
                  </div>
                  <div className="bg-blue-100 rounded-full p-2 flex-shrink-0">
                    <DocumentTextIcon className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 hover:shadow-md transition-all duration-300">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-bold uppercase text-gray-500 mb-2">LOGIN EVENTS</p>
                    <p className="text-3xl font-black text-gray-900">{statistics.login_count.toLocaleString()}</p>
                  </div>
                  <div className="bg-green-100 rounded-full p-2 flex-shrink-0">
                    <ShieldCheckIcon className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 hover:shadow-md transition-all duration-300">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-bold uppercase text-gray-500 mb-2">NEW REGISTRATIONS</p>
                    <p className="text-3xl font-black text-gray-900">{statistics.user_registrations.toLocaleString()}</p>
                  </div>
                  <div className="bg-purple-100 rounded-full p-2 flex-shrink-0">
                    <UserIcon className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 hover:shadow-md transition-all duration-300">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-bold uppercase text-gray-500 mb-2">PROFILE UPDATES</p>
                    <p className="text-3xl font-black text-gray-900">{statistics.resident_updates.toLocaleString()}</p>
                  </div>
                  <div className="bg-orange-100 rounded-full p-2 flex-shrink-0">
                    <ArrowPathIcon className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Inactive Residents Section */}
        {showInactiveResidents && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 mb-8 transition-all duration-300 hover:shadow-2xl w-full">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <ExclamationTriangleIcon className="w-6 h-6 text-orange-600" />
                  Inactive Residents (No Activity for 1 Year)
                </h3>
                <p className="text-gray-600 text-sm">Residents with no login or profile update activity in the past year</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleFlagInactiveResidents}
                  className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-semibold transition-all duration-300 transform hover:scale-105"
                >
                  <ExclamationTriangleIcon className="w-5 h-5" />
                  Flag All for Review
                </button>
                <button
                  onClick={() => setShowInactiveResidents(false)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-semibold transition-all duration-300"
                >
                  <XMarkIcon className="w-5 h-5" />
                  Close
                </button>
              </div>
            </div>

            {inactiveResidentsLoading ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Loading inactive residents...</p>
              </div>
            ) : inactiveResidents.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircleIcon className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-gray-600 font-semibold text-lg">No inactive residents found</p>
                <p className="text-gray-400 text-sm">All residents have been active in the past year</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gradient-to-r from-orange-50 to-red-50 border-b-2 border-orange-200">
                      <tr>
                        <th className="px-6 py-4 text-left font-bold text-slate-700 text-sm uppercase tracking-wider">Resident ID</th>
                        <th className="px-6 py-4 text-left font-bold text-slate-700 text-sm uppercase tracking-wider">Name</th>
                        <th className="px-6 py-4 text-left font-bold text-slate-700 text-sm uppercase tracking-wider">Email</th>
                        <th className="px-6 py-4 text-left font-bold text-slate-700 text-sm uppercase tracking-wider">Last Activity</th>
                        <th className="px-6 py-4 text-left font-bold text-slate-700 text-sm uppercase tracking-wider">Days Inactive</th>
                        <th className="px-6 py-4 text-left font-bold text-slate-700 text-sm uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {inactiveResidents.map((resident) => (
                        <tr key={resident.id} className="hover:bg-orange-50 transition-colors">
                          <td className="px-6 py-4 font-mono text-sm text-gray-700">{resident.resident_id}</td>
                          <td className="px-6 py-4 font-medium text-gray-900">{resident.full_name}</td>
                          <td className="px-6 py-4 text-gray-700">{resident.email || 'N/A'}</td>
                          <td className="px-6 py-4 text-gray-700">
                            {format(new Date(resident.last_activity_date), 'MMM dd, yyyy')}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              resident.days_inactive >= 365
                                ? 'bg-red-100 text-red-800'
                                : resident.days_inactive >= 180
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {resident.days_inactive} days
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {resident.for_review ? (
                              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-300">
                                For Review
                              </span>
                            ) : (
                              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
                                Not Flagged
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {inactiveResidentsTotal > 20 && (
                  <div className="flex justify-center mt-6">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setInactiveResidentsPage(prev => Math.max(1, prev - 1))}
                        disabled={inactiveResidentsPage === 1}
                        className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-gray-600">
                        Page {inactiveResidentsPage} of {Math.ceil(inactiveResidentsTotal / 20)}
                      </span>
                      <button
                        onClick={() => setInactiveResidentsPage(prev => prev + 1)}
                        disabled={inactiveResidentsPage >= Math.ceil(inactiveResidentsTotal / 20)}
                        className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Security Alerts Section */}
        {securityAlerts && securityAlerts.length > 0 && (
          <div className="mb-8 w-full">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <ExclamationTriangleIcon className="w-7 h-7 text-red-600" />
              Security Alerts
            </h2>
            <div className="space-y-4">
              {securityAlerts.map((alert, index) => (
                <div
                  key={index}
                  className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                      <ExclamationTriangleIcon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-bold text-red-900">{alert.title}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          alert.severity === 'high' ? 'bg-red-100 text-red-800' :
                          alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {alert.severity.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-red-800 mb-3">{alert.description}</p>
                      <div className="flex items-center gap-4 text-sm text-red-700">
                        <span className="flex items-center gap-1">
                          <UserIcon className="w-4 h-4" />
                          {alert.user}
                        </span>
                        <span className="flex items-center gap-1">
                          <ClockIcon className="w-4 h-4" />
                          {formatDate(alert.timestamp)}
                        </span>
                        <span className="flex items-center gap-1">
                          <GlobeAltIcon className="w-4 h-4" />
                          {alert.ip_address}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Enhanced Filters Section */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 mb-8 transition-all duration-300 hover:shadow-2xl w-full">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <FunnelIcon className="w-6 h-6 text-blue-600" />
                Activity Filters
              </h3>
              <p className="text-gray-600 text-sm">Filter and search through activity logs</p>
            </div>

            <div className="flex gap-3 items-center">
              {hasActiveFilters() && (() => {
                const activeCount = [
                  filters.user_type !== 'all' && 'User Role',
                  filters.action && 'Action',
                  filters.model_type && 'Model',
                  filters.search && 'Search',
                  filters.date_from && 'Date',
                  filters.time_from && 'Time',
                  filters.ip_address && 'IP',
                  filters.model_id && 'Model ID',
                  filters.description_search && 'Description',
                  filters.status && 'Status',
                  selectedActions.length > 0 && `${selectedActions.length} Actions`,
                  selectedModelTypes.length > 0 && `${selectedModelTypes.length} Models`,
                ].filter(Boolean).length;
                return (
                  <div className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-semibold flex items-center gap-2">
                    <FunnelIcon className="w-4 h-4" />
                    {activeCount} Active Filter{activeCount !== 1 ? 's' : ''}
                  </div>
                );
              })()}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-6 py-3 rounded-xl text-sm font-semibold shadow-lg transition-all duration-300 transform hover:scale-105 flex items-center gap-2"
              >
                <FunnelIcon className="w-4 h-4" />
                {showFilters ? 'Hide Filters' : 'Show Filters'}
              </button>
              <button
                onClick={fetchLogs}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 text-sm font-semibold transition-all duration-300 transform hover:scale-105"
              >
                <ArrowPathIcon className="w-5 h-5" />
                Refresh
              </button>
            </div>
          </div>

          {/* Quick Search */}
          <div className="flex gap-3 items-center mb-6">
            <div className="relative flex-grow max-w-md">
              <input
                type="text"
                className="w-full pl-12 pr-4 py-3 border border-gray-200 focus:ring-2 focus:ring-green-500 focus:border-transparent rounded-xl text-sm shadow-sm transition-all duration-300 focus:shadow-md"
                placeholder="Search activities..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-4 top-3.5 text-gray-400" />
            </div>
            <button
              onClick={handleSearch}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-semibold transition-all duration-300 transform hover:scale-105"
            >
              <MagnifyingGlassIcon className="w-4 h-4" />
              Search
            </button>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <FunnelIcon className="w-5 h-5 text-blue-600" />
                  Advanced Filters
                </h4>
                <div className="flex gap-2">
                  {hasActiveFilters() && (
                    <button
                      onClick={clearAllFilters}
                      className="px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-2"
                    >
                      <XMarkIcon className="w-4 h-4" />
                      Clear All
                    </button>
                  )}
                  <button
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    className="px-4 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-2"
                  >
                    {showAdvancedFilters ? 'Hide' : 'Show'} Detailed Filters
                  </button>
                </div>
              </div>

              {/* Basic Filters Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">User Role</label>
                  <select
                    value={filters.user_type}
                    onChange={(e) => handleFilterChange('user_type', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Roles</option>
                    <option value="admin">Admin</option>
                    <option value="staff">Staff</option>
                    <option value="resident">Residents</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Action Type</label>
                  <select
                    value={filters.action}
                    onChange={(e) => handleFilterChange('action', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Actions</option>
                    {filterOptions.actions?.map((action) => (
                      <option key={action} value={action}>{action}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Model Type</label>
                  <select
                    value={filters.model_type}
                    onChange={(e) => handleFilterChange('model_type', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Models</option>
                    {filterOptions.model_types?.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Status</option>
                    <option value="success">Success</option>
                    <option value="failed">Failed</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>

              {/* Date and Time Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date From</label>
                  <input
                    type="date"
                    value={filters.date_from}
                    onChange={(e) => {
                      handleFilterChange('date_from', e.target.value);
                      setQuickDateFilter('');
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date To</label>
                  <input
                    type="date"
                    value={filters.date_to}
                    onChange={(e) => {
                      handleFilterChange('date_to', e.target.value);
                      setQuickDateFilter('');
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Time From</label>
                  <input
                    type="time"
                    value={filters.time_from}
                    onChange={(e) => handleFilterChange('time_from', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Time To</label>
                  <input
                    type="time"
                    value={filters.time_to}
                    onChange={(e) => handleFilterChange('time_to', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Detailed Advanced Filters */}
              {showAdvancedFilters && (
                <div className="mt-6 pt-6 border-t border-gray-300 bg-white rounded-lg p-6">
                  <h5 className="text-md font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <FunnelIcon className="w-4 h-4 text-purple-600" />
                    Detailed Filters
                  </h5>

                  {/* IP Address and Model ID */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">IP Address</label>
                      <input
                        type="text"
                        value={filters.ip_address}
                        onChange={(e) => handleFilterChange('ip_address', e.target.value)}
                        placeholder="e.g., 192.168.1.1"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Model ID</label>
                      <input
                        type="text"
                        value={filters.model_id}
                        onChange={(e) => handleFilterChange('model_id', e.target.value)}
                        placeholder="Enter model ID"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Description Search</label>
                      <input
                        type="text"
                        value={filters.description_search}
                        onChange={(e) => handleFilterChange('description_search', e.target.value)}
                        placeholder="Search in descriptions"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Items Per Page</label>
                      <select
                        value={filters.per_page}
                        onChange={(e) => handleFilterChange('per_page', parseInt(e.target.value))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="10">10</option>
                        <option value="20">20</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                      </select>
                    </div>
                  </div>

                  {/* Multiple Action Selection */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">Select Multiple Actions</label>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-3 bg-gray-50 rounded-lg border border-gray-200">
                      {filterOptions.actions?.map((action) => (
                        <button
                          key={action}
                          onClick={() => handleActionToggle(action)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 ${
                            selectedActions.includes(action)
                              ? 'bg-blue-600 text-white shadow-md'
                              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                          }`}
                        >
                          {action}
                          {selectedActions.includes(action) && (
                            <XMarkIcon className="w-3 h-3 inline-block ml-1" />
                          )}
                        </button>
                      ))}
                    </div>
                    {selectedActions.length > 0 && (
                      <p className="text-xs text-gray-500 mt-2">
                        {selectedActions.length} action{selectedActions.length !== 1 ? 's' : ''} selected
                      </p>
                    )}
                  </div>

                  {/* Multiple Model Type Selection */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">Select Multiple Model Types</label>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-3 bg-gray-50 rounded-lg border border-gray-200">
                      {filterOptions.model_types?.map((type) => (
                        <button
                          key={type}
                          onClick={() => handleModelTypeToggle(type)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 ${
                            selectedModelTypes.includes(type)
                              ? 'bg-purple-600 text-white shadow-md'
                              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                          }`}
                        >
                          {type}
                          {selectedModelTypes.includes(type) && (
                            <XMarkIcon className="w-3 h-3 inline-block ml-1" />
                          )}
                        </button>
                      ))}
                    </div>
                    {selectedModelTypes.length > 0 && (
                      <p className="text-xs text-gray-500 mt-2">
                        {selectedModelTypes.length} model type{selectedModelTypes.length !== 1 ? 's' : ''} selected
                      </p>
                    )}
                  </div>

                  {/* Sort Options */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                      <select
                        value={filters.sort_by}
                        onChange={(e) => handleFilterChange('sort_by', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="created_at">Date & Time</option>
                        <option value="action">Action</option>
                        <option value="user_id">User</option>
                        <option value="model_type">Model Type</option>
                        <option value="ip_address">IP Address</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Sort Order</label>
                      <select
                        value={filters.sort_order}
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

              {/* Quick Date Filters */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-blue-600" />
                  Quick Date & Time Filters
                </label>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs font-semibold text-gray-500 self-center mr-2">Today/Yesterday:</span>
                    <button
                      onClick={() => handleQuickDateFilter('today')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 transform hover:scale-105 flex items-center gap-1 ${
                        quickDateFilter === 'today'
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-blue-300'
                      }`}
                    >
                      <CalendarIcon className="w-3 h-3" />
                      Today
                    </button>
                    <button
                      onClick={() => handleQuickDateFilter('yesterday')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 transform hover:scale-105 flex items-center gap-1 ${
                        quickDateFilter === 'yesterday'
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-blue-300'
                      }`}
                    >
                      <CalendarIcon className="w-3 h-3" />
                      Yesterday
                    </button>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs font-semibold text-gray-500 self-center mr-2">Recent:</span>
                    <button
                      onClick={() => handleQuickDateFilter('last_24_hours')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 transform hover:scale-105 flex items-center gap-1 ${
                        quickDateFilter === 'last_24_hours'
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-blue-300'
                      }`}
                    >
                      <ClockIcon className="w-3 h-3" />
                      Last 24 Hours
                    </button>
                    <button
                      onClick={() => handleQuickDateFilter('last_7_days')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 transform hover:scale-105 flex items-center gap-1 ${
                        quickDateFilter === 'last_7_days'
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-blue-300'
                      }`}
                    >
                      <CalendarIcon className="w-3 h-3" />
                      Last 7 Days
                    </button>
                    <button
                      onClick={() => handleQuickDateFilter('last_week')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 transform hover:scale-105 flex items-center gap-1 ${
                        quickDateFilter === 'last_week'
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-blue-300'
                      }`}
                    >
                      <CalendarIcon className="w-3 h-3" />
                      Last Week
                    </button>
                    <button
                      onClick={() => handleQuickDateFilter('last_30_days')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 transform hover:scale-105 flex items-center gap-1 ${
                        quickDateFilter === 'last_30_days'
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-blue-300'
                      }`}
                    >
                      <CalendarIcon className="w-3 h-3" />
                      Last 30 Days
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs font-semibold text-gray-500 self-center mr-2">Longer Periods:</span>
                    <button
                      onClick={() => handleQuickDateFilter('last_month')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 transform hover:scale-105 flex items-center gap-1 ${
                        quickDateFilter === 'last_month'
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-blue-300'
                      }`}
                    >
                      <CalendarIcon className="w-3 h-3" />
                      Last Month
                    </button>
                    <button
                      onClick={() => handleQuickDateFilter('last_3_months')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 transform hover:scale-105 flex items-center gap-1 ${
                        quickDateFilter === 'last_3_months'
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-blue-300'
                      }`}
                    >
                      <CalendarIcon className="w-3 h-3" />
                      Last 3 Months
                    </button>
                    <button
                      onClick={() => handleQuickDateFilter('last_6_months')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 transform hover:scale-105 flex items-center gap-1 ${
                        quickDateFilter === 'last_6_months'
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-blue-300'
                      }`}
                    >
                      <CalendarIcon className="w-3 h-3" />
                      Last 6 Months
                    </button>
                    <button
                      onClick={() => handleQuickDateFilter('last_year')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 transform hover:scale-105 flex items-center gap-1 ${
                        quickDateFilter === 'last_year'
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-blue-300'
                      }`}
                    >
                      <CalendarIcon className="w-3 h-3" />
                      Last Year
                    </button>
                  </div>

                  {(filters.date_from || filters.date_to) && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200">
                      <button
                        onClick={() => handleQuickDateFilter('clear')}
                        className="px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 transform hover:scale-105 flex items-center gap-2 bg-white text-red-700 border border-red-300 hover:bg-red-50 hover:border-red-400"
                      >
                        <XMarkIcon className="w-4 h-4" />
                        Clear All Dates
                      </button>
                    </div>
                  )}
                </div>
                {(filters.date_from || filters.date_to) && (
                  <div className="mt-3 text-xs text-gray-600 flex items-center gap-2">
                    <ClockIcon className="w-4 h-4" />
                    <span>
                      Showing logs from{' '}
                      <span className="font-semibold">
                        {filters.date_from ? format(new Date(filters.date_from), 'MMM dd, yyyy') : 'beginning'} to{' '}
                        {filters.date_to ? format(new Date(filters.date_to), 'MMM dd, yyyy') : 'today'}
                      </span>
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={handleExport}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-semibold transition-all duration-300 transform hover:scale-105"
                >
                  <ArrowDownTrayIcon className="w-4 h-4" />
                  Export CSV
                </button>
                <button
                  onClick={handleCleanup}
                  className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-semibold transition-all duration-300 transform hover:scale-105"
                >
                  <TrashIcon className="w-4 h-4" />
                  Cleanup Old Logs
                </button>
              </div>
            </div>
          )}
        </div>
        {/* Audit Trail Summary */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 mb-8 transition-all duration-300 hover:shadow-2xl w-full">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <DocumentTextIcon className="w-6 h-6 text-purple-600" />
                Audit Trail Summary
              </h3>
              <p className="text-gray-600 text-sm">System activity overview and compliance metrics</p>
            </div>
            <button
              onClick={fetchAuditSummary}
              className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-md transition-all duration-300 transform hover:scale-105"
            >
              <ArrowPathIcon className="w-4 h-4 mr-2" />
              Refresh Summary
            </button>
          </div>

          {auditSummary && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                    <CheckCircleIcon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-green-800 text-sm font-medium">Successful Operations</p>
                    <p className="text-2xl font-bold text-green-900">{auditSummary.successful_operations || 0}</p>
                    <p className="text-green-600 text-xs mt-1">Last 30 days</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-xl p-6 border border-red-200">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                    <XCircleIcon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-red-800 text-sm font-medium">Failed Operations</p>
                    <p className="text-2xl font-bold text-red-900">{auditSummary.failed_operations || 0}</p>
                    <p className="text-red-600 text-xs mt-1">Requires attention</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                    <ClockIcon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-blue-800 text-sm font-medium">Avg Response Time</p>
                    <p className="text-2xl font-bold text-blue-900">{auditSummary.avg_response_time || 0}ms</p>
                    <p className="text-blue-600 text-xs mt-1">System performance</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Enhanced Activity Logs Table with Tab Separators */}
        <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-slate-200/60 overflow-hidden transition-all duration-700 hover:shadow-3xl relative w-full">
          <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-green-700 px-8 py-6">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-2xl flex items-center gap-3">
                <DocumentTextIcon className="w-7 h-7" />
                Activity Logs
              </h3>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-300 rounded-full animate-pulse"></div>
                <span className="text-green-100 text-sm font-medium">Live</span>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="bg-gradient-to-r from-slate-50 via-gray-50 to-slate-50 border-b-2 border-slate-200 px-6 py-4">
            <div className="flex space-x-1 bg-slate-100 rounded-xl p-1">
              <button
                onClick={() => handleTabChange('all')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold text-sm transition-all duration-300 transform hover:scale-105 ${
                  activeTab === 'all'
                    ? 'bg-white text-slate-800 shadow-lg border border-slate-200'
                    : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
                }`}
              >
                <ChartBarIcon className="w-4 h-4" />
                All Activities
                <span className="px-2 py-1 bg-slate-200 text-slate-700 text-xs rounded-full">
                  {counts.total ?? logs.length}
                </span>
              </button>
              
              <button
                onClick={() => handleTabChange('admin')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold text-sm transition-all duration-300 transform hover:scale-105 ${
                  activeTab === 'admin'
                    ? 'bg-white text-red-800 shadow-lg border border-red-200'
                    : 'text-slate-600 hover:text-red-800 hover:bg-red-50'
                }`}
              >
                <ShieldCheckIcon className="w-4 h-4" />
                Admin
                <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                  {counts.admin ?? adminLogs.length}
                </span>
              </button>
              
              <button
                onClick={() => handleTabChange('resident')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold text-sm transition-all duration-300 transform hover:scale-105 ${
                  activeTab === 'resident'
                    ? 'bg-white text-blue-800 shadow-lg border border-blue-200'
                    : 'text-slate-600 hover:text-blue-800 hover:bg-blue-50'
                }`}
              >
                <UserIcon className="w-4 h-4" />
                Resident
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                  {counts.resident ?? residentLogs.length}
                </span>
              </button>
              
              <button
                onClick={() => handleTabChange('staff')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold text-sm transition-all duration-300 transform hover:scale-105 ${
                  activeTab === 'staff'
                    ? 'bg-white text-purple-800 shadow-lg border border-purple-200'
                    : 'text-slate-600 hover:text-purple-800 hover:bg-purple-50'
                }`}
              >
                <DocumentTextIcon className="w-4 h-4" />
                Staff
                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                  {counts.staff ?? staffLogs.length}
                </span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto shadow-2xl rounded-2xl w-full">
            {loading ? (
              <div className="px-6 py-16 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin shadow-lg"></div>
                  <p className="text-slate-600 font-semibold text-lg">Loading activity logs...</p>
                  <p className="text-slate-400 text-sm">Please wait while we fetch the data</p>
                </div>
              </div>
            ) : logs.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center shadow-lg">
                    <DocumentTextIcon className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-slate-600 font-semibold text-lg">No activity logs found</p>
                  <p className="text-slate-400 text-sm">Try adjusting your filters or select a different tab</p>
                </div>
              </div>
            ) : (
              <div className="min-h-[400px]">
                {/* Tab Content */}
                {activeTab === 'all' && (
                  <div className="p-6">
                    <div className="overflow-x-auto w-full">
            <table className="w-full text-sm min-w-full">
              <thead className="bg-gradient-to-r from-slate-50 via-gray-50 to-slate-50 border-b-2 border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left font-bold text-slate-700 border-r border-slate-200 text-sm uppercase tracking-wider min-w-[180px]">Date & Time</th>
                  <th className="px-6 py-4 text-left font-bold text-slate-700 border-r border-slate-200 text-sm uppercase tracking-wider min-w-[150px]">User</th>
                  <th className="px-6 py-4 text-left font-bold text-slate-700 border-r border-slate-200 text-sm uppercase tracking-wider hidden sm:table-cell min-w-[120px]">User Type</th>
                  <th className="px-6 py-4 text-left font-bold text-slate-700 border-r border-slate-200 text-sm uppercase tracking-wider min-w-[180px]">Action</th>
                  <th className="px-6 py-4 text-left font-bold text-slate-700 border-r border-slate-200 text-sm uppercase tracking-wider hidden md:table-cell min-w-[150px]">Model</th>
                  <th className="px-6 py-4 text-left font-bold text-slate-700 border-r border-slate-200 text-sm uppercase tracking-wider hidden lg:table-cell min-w-[250px]">Description</th>
                  <th className="px-6 py-4 text-left font-bold text-slate-700 border-r border-slate-200 text-sm uppercase tracking-wider hidden lg:table-cell min-w-[150px]">IP Address</th>
                  <th className="px-6 py-4 text-left font-bold text-slate-700 text-sm uppercase tracking-wider min-w-[120px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/50">
                          {logs.length === 0 ? (
                            <tr>
                              <td colSpan="8" className="px-6 py-16 text-center">
                                <div className="flex flex-col items-center gap-4">
                                  <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center shadow-lg">
                                    <DocumentTextIcon className="w-8 h-8 text-slate-400" />
                                  </div>
                                  <p className="text-slate-600 font-semibold text-lg">No activity logs found</p>
                                  <p className="text-slate-400 text-sm">Try adjusting your filters or check back later</p>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            logs.map((log) => {
                              const userRole = getLogUserRole(log);
                              const isAdmin = userRole === 'admin';
                              const isResident = userRole === 'resident';
                              const isStaff = userRole === 'staff';
                              const userTypeLabel = getRoleLabel(userRole);
                              
                              return (
                                <tr key={log.id} className={`hover:bg-gradient-to-r transition-all duration-300 border-b border-slate-200/50 hover:shadow-sm group ${
                                  isAdmin ? 'hover:from-red-50/80 hover:to-pink-50/80 hover:border-red-300/50' :
                                  isResident ? 'hover:from-blue-50/80 hover:to-cyan-50/80 hover:border-blue-300/50' :
                                  isStaff ? 'hover:from-purple-50/80 hover:to-indigo-50/80 hover:border-purple-300/50' :
                                  'hover:from-slate-50/80 hover:to-gray-50/80 hover:border-slate-300/50'
                                }`}>
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                      <ClockIcon className="w-4 h-4 text-gray-400" />
                                      <span className="font-medium text-gray-900">{formatDate(log.created_at)}</span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                      <UserIcon className="w-4 h-4 text-gray-400" />
                                      <span className="font-medium text-gray-900">{log.user?.name || 'System'}</span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 hidden sm:table-cell">
                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                      isAdmin ? 'bg-red-100 text-red-800' :
                                      isResident ? 'bg-blue-100 text-blue-800' :
                                      isStaff ? 'bg-purple-100 text-purple-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                      {userTypeLabel}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex items-center">
                                      {(() => {
                                        const { className, displayText } = getActionBadge(log.action);
                                        return <span className={className}>{displayText}</span>;
                                      })()}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 hidden md:table-cell">
                                    <div className="flex items-center gap-2">
                                      <ServerIcon className="w-4 h-4 text-gray-400" />
                                      <span className="font-mono text-sm text-gray-700">
                                        {log.model_type ? `${log.model_type.split('\\').pop()}#${log.model_id}` : 'N/A'}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 max-w-md hidden lg:table-cell">
                                    <div className="truncate" title={log.description}>
                                      {log.description}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 hidden lg:table-cell">
                                    <div className="flex items-center gap-2">
                                      <GlobeAltIcon className="w-4 h-4 text-gray-400" />
                                      <span className="font-mono text-sm text-gray-700">{log.ip_address || 'N/A'}</span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex gap-2 flex-wrap">
                                      <button
                                        onClick={() => {
                                          setSelectedLog(log);
                                          setShowDetails(true);
                                        }}
                                        className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-md flex items-center gap-2 transition-all duration-300 transform hover:scale-105"
                                      >
                                        <EyeIcon className="w-4 h-4" />
                                        <span className="hidden sm:inline">View</span>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Individual Tab Content */}
                {activeTab === 'admin' && (
                  <div className="p-6">
                    <div className="bg-gradient-to-r from-red-50 to-pink-50 px-6 py-4 rounded-t-xl border-b-2 border-red-200 mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-pink-600 rounded-lg flex items-center justify-center shadow-lg">
                          <ShieldCheckIcon className="w-4 h-4 text-white" />
                        </div>
                        <h4 className="text-lg font-bold text-red-800">Administrative Activities</h4>
                        <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full">
                          {currentLogTotal} logs
                        </span>
                      </div>
                    </div>
                    <div className="overflow-x-auto w-full">
                      <table className="w-full text-sm min-w-full">
                        <thead className="bg-gradient-to-r from-slate-50 via-gray-50 to-slate-50 border-b-2 border-slate-200">
                          <tr>
                            <th className="px-6 py-4 text-left font-bold text-slate-700 border-r border-slate-200 text-sm uppercase tracking-wider min-w-[180px]">Date & Time</th>
                            <th className="px-6 py-4 text-left font-bold text-slate-700 border-r border-slate-200 text-sm uppercase tracking-wider min-w-[150px]">User</th>
                            <th className="px-6 py-4 text-left font-bold text-slate-700 border-r border-slate-200 text-sm uppercase tracking-wider min-w-[180px]">Action</th>
                            <th className="px-6 py-4 text-left font-bold text-slate-700 border-r border-slate-200 text-sm uppercase tracking-wider min-w-[150px]">Model</th>
                            <th className="px-6 py-4 text-left font-bold text-slate-700 border-r border-slate-200 text-sm uppercase tracking-wider min-w-[250px]">Description</th>
                            <th className="px-6 py-4 text-left font-bold text-slate-700 border-r border-slate-200 text-sm uppercase tracking-wider min-w-[150px]">IP Address</th>
                            <th className="px-6 py-4 text-left font-bold text-slate-700 text-sm uppercase tracking-wider min-w-[120px]">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/50">
                          {adminLogs.length === 0 ? (
                            <tr>
                    <td colSpan="7" className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-4">
                                  <div className="w-16 h-16 bg-gradient-to-br from-red-100 to-pink-100 rounded-full flex items-center justify-center shadow-lg">
                                    <ShieldCheckIcon className="w-8 h-8 text-red-400" />
                                  </div>
                                  <p className="text-slate-600 font-semibold text-lg">No admin activities found</p>
                                  <p className="text-slate-400 text-sm">Try adjusting your filters or check back later</p>
                      </div>
                    </td>
                  </tr>
                          ) : (
                            adminLogs.map((log) => (
                              <tr key={log.id} className="hover:bg-gradient-to-r hover:from-red-50/80 hover:to-pink-50/80 transition-all duration-300 border-b border-slate-200/50 hover:border-red-300/50 hover:shadow-sm group">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    <ClockIcon className="w-4 h-4 text-gray-400" />
                                    <span className="font-medium text-gray-900">{formatDate(log.created_at)}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    <UserIcon className="w-4 h-4 text-gray-400" />
                                    <span className="font-medium text-gray-900">{log.user?.name || 'System'}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center">
                                    {(() => {
                                      const { className, displayText } = getActionBadge(log.action);
                                      return <span className={className}>{displayText}</span>;
                                    })()}
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    <ServerIcon className="w-4 h-4 text-gray-400" />
                                    <span className="font-mono text-sm text-gray-700">
                                      {log.model_type ? `${log.model_type.split('\\').pop()}#${log.model_id}` : 'N/A'}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 max-w-md">
                                  <div className="truncate" title={log.description}>
                                    {log.description}
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    <GlobeAltIcon className="w-4 h-4 text-gray-400" />
                                    <span className="font-mono text-sm text-gray-700">{log.ip_address || 'N/A'}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex gap-2 flex-wrap">
                                    <button
                                      onClick={() => {
                                        setSelectedLog(log);
                                        setShowDetails(true);
                                      }}
                                      className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-md flex items-center gap-2 transition-all duration-300 transform hover:scale-105"
                                    >
                                      <EyeIcon className="w-4 h-4" />
                                      View
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

                {activeTab === 'resident' && (
                  <div className="p-6">
                    <div className="bg-gradient-to-r from-blue-50 to-cyan-50 px-6 py-4 rounded-t-xl border-b-2 border-blue-200 mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg flex items-center justify-center shadow-lg">
                          <UserIcon className="w-4 h-4 text-white" />
                        </div>
                        <h4 className="text-lg font-bold text-blue-800">Resident Activities</h4>
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                          {currentLogTotal} logs
                        </span>
                      </div>
                    </div>
                    <div className="overflow-x-auto w-full">
                      <table className="w-full text-sm min-w-full">
                        <thead className="bg-gradient-to-r from-slate-50 via-gray-50 to-slate-50 border-b-2 border-slate-200">
                          <tr>
                            <th className="px-6 py-4 text-left font-bold text-slate-700 border-r border-slate-200 text-sm uppercase tracking-wider min-w-[180px]">Date & Time</th>
                            <th className="px-6 py-4 text-left font-bold text-slate-700 border-r border-slate-200 text-sm uppercase tracking-wider min-w-[150px]">User</th>
                            <th className="px-6 py-4 text-left font-bold text-slate-700 border-r border-slate-200 text-sm uppercase tracking-wider min-w-[180px]">Action</th>
                            <th className="px-6 py-4 text-left font-bold text-slate-700 border-r border-slate-200 text-sm uppercase tracking-wider min-w-[150px]">Model</th>
                            <th className="px-6 py-4 text-left font-bold text-slate-700 border-r border-slate-200 text-sm uppercase tracking-wider min-w-[250px]">Description</th>
                            <th className="px-6 py-4 text-left font-bold text-slate-700 border-r border-slate-200 text-sm uppercase tracking-wider min-w-[150px]">IP Address</th>
                            <th className="px-6 py-4 text-left font-bold text-slate-700 text-sm uppercase tracking-wider min-w-[120px]">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/50">
                          {residentLogs.length === 0 ? (
                            <tr>
                    <td colSpan="7" className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-4">
                                  <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-full flex items-center justify-center shadow-lg">
                                    <UserIcon className="w-8 h-8 text-blue-400" />
                        </div>
                                  <p className="text-slate-600 font-semibold text-lg">No resident activities found</p>
                                  <p className="text-slate-400 text-sm">Try adjusting your filters or check back later</p>
                      </div>
                    </td>
                  </tr>
                          ) : (
                            residentLogs.map((log) => (
                              <tr key={log.id} className="hover:bg-gradient-to-r hover:from-blue-50/80 hover:to-cyan-50/80 transition-all duration-300 border-b border-slate-200/50 hover:border-blue-300/50 hover:shadow-sm group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <ClockIcon className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900">{formatDate(log.created_at)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <UserIcon className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900">{log.user?.name || 'System'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {(() => {
                          const { className, displayText } = getActionBadge(log.action);
                          return <span className={className}>{displayText}</span>;
                        })()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <ServerIcon className="w-4 h-4 text-gray-400" />
                          <span className="font-mono text-sm text-gray-700">
                            {log.model_type ? `${log.model_type.split('\\').pop()}#${log.model_id}` : 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-md">
                        <div className="truncate" title={log.description}>
                          {log.description}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <GlobeAltIcon className="w-4 h-4 text-gray-400" />
                          <span className="font-mono text-sm text-gray-700">{log.ip_address || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => {
                              setSelectedLog(log);
                              setShowDetails(true);
                            }}
                            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-md flex items-center gap-2 transition-all duration-300 transform hover:scale-105"
                          >
                            <EyeIcon className="w-4 h-4" />
                            View
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

                {activeTab === 'staff' && (
                  <div className="p-6">
                    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 px-6 py-4 rounded-t-xl border-b-2 border-purple-200 mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
                          <DocumentTextIcon className="w-4 h-4 text-white" />
                        </div>
                        <h4 className="text-lg font-bold text-purple-800">Staff Activities</h4>
                        <span className="px-3 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full">
                          {currentLogTotal} logs
                        </span>
                      </div>
                    </div>
                    <div className="overflow-x-auto w-full">
                      <table className="w-full text-sm min-w-full">
                        <thead className="bg-gradient-to-r from-slate-50 via-gray-50 to-slate-50 border-b-2 border-slate-200">
                          <tr>
                            <th className="px-6 py-4 text-left font-bold text-slate-700 border-r border-slate-200 text-sm uppercase tracking-wider min-w-[180px]">Date & Time</th>
                            <th className="px-6 py-4 text-left font-bold text-slate-700 border-r border-slate-200 text-sm uppercase tracking-wider min-w-[150px]">User</th>
                            <th className="px-6 py-4 text-left font-bold text-slate-700 border-r border-slate-200 text-sm uppercase tracking-wider min-w-[180px]">Action</th>
                            <th className="px-6 py-4 text-left font-bold text-slate-700 border-r border-slate-200 text-sm uppercase tracking-wider min-w-[150px]">Model</th>
                            <th className="px-6 py-4 text-left font-bold text-slate-700 border-r border-slate-200 text-sm uppercase tracking-wider min-w-[250px]">Description</th>
                            <th className="px-6 py-4 text-left font-bold text-slate-700 border-r border-slate-200 text-sm uppercase tracking-wider min-w-[150px]">IP Address</th>
                            <th className="px-6 py-4 text-left font-bold text-slate-700 text-sm uppercase tracking-wider min-w-[120px]">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/50">
                          {staffLogs.length === 0 ? (
                            <tr>
                              <td colSpan="7" className="px-6 py-16 text-center">
                                <div className="flex flex-col items-center gap-4">
                                  <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center shadow-lg">
                                    <DocumentTextIcon className="w-8 h-8 text-purple-400" />
                                  </div>
                                  <p className="text-slate-600 font-semibold text-lg">No staff activities found</p>
                                  <p className="text-slate-400 text-sm">Try adjusting your filters or check back later</p>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            staffLogs.map((log) => (
                              <tr key={log.id} className="hover:bg-gradient-to-r hover:from-purple-50/80 hover:to-indigo-50/80 transition-all duration-300 border-b border-slate-200/50 hover:border-purple-300/50 hover:shadow-sm group">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    <ClockIcon className="w-4 h-4 text-gray-400" />
                                    <span className="font-medium text-gray-900">{formatDate(log.created_at)}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    <UserIcon className="w-4 h-4 text-gray-400" />
                                    <span className="font-medium text-gray-900">{log.user?.name || 'System'}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center">
                                    {(() => {
                                      const { className, displayText } = getActionBadge(log.action);
                                      return <span className={className}>{displayText}</span>;
                                    })()}
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    <ServerIcon className="w-4 h-4 text-gray-400" />
                                    <span className="font-mono text-sm text-gray-700">
                                      {log.model_type ? `${log.model_type.split('\\').pop()}#${log.model_id}` : 'N/A'}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 max-w-md">
                                  <div className="truncate" title={log.description}>
                                    {log.description}
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    <GlobeAltIcon className="w-4 h-4 text-gray-400" />
                                    <span className="font-mono text-sm text-gray-700">{log.ip_address || 'N/A'}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex gap-2 flex-wrap">
                                    <button
                                      onClick={() => {
                                        setSelectedLog(log);
                                        setShowDetails(true);
                                      }}
                                      className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-md flex items-center gap-2 transition-all duration-300 transform hover:scale-105"
                                    >
                                      <EyeIcon className="w-4 h-4" />
                                      View
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
              </div>
            )}
          </div>
        </div>
        {/* Enhanced Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-8">
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <div className="flex items-center justify-between gap-4">
                {/* Page Info */}
                <div className="text-sm text-gray-600">
                  Page {filters.page} of {totalPages}
                </div>
                
                {/* Pagination Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleFilterChange('page', Math.max(1, filters.page - 1))}
                  disabled={filters.page <= 1}
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
                  const pageNum = Math.max(1, Math.min(totalPages - 4, filters.page - 2)) + i;
                  if (pageNum > totalPages) return null;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handleFilterChange('page', pageNum)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                        filters.page === pageNum
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
                  onClick={() => handleFilterChange('page', Math.min(totalPages, filters.page + 1))}
                  disabled={filters.page >= totalPages}
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
        {/* Compliance Report */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 mb-8 transition-all duration-300 hover:shadow-2xl w-full">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <ShieldCheckIcon className="w-6 h-6 text-indigo-600" />
                Compliance Report
              </h3>
              <p className="text-gray-600 text-sm">GDPR and data protection compliance metrics</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-6 border border-indigo-200">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                  <UserIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-indigo-800 text-sm font-medium">Privacy Accepted</p>
                  <p className="text-xl font-bold text-indigo-900">98.5%</p>
                  <p className="text-indigo-600 text-xs mt-1">User compliance</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-lg">
                  <CheckCircleIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-green-800 text-sm font-medium">Data Integrity</p>
                  <p className="text-xl font-bold text-green-900">99.2%</p>
                  <p className="text-green-600 text-xs mt-1">Audit success rate</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl p-6 border border-orange-200">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-yellow-600 rounded-lg flex items-center justify-center shadow-lg">
                  <ClockIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-orange-800 text-sm font-medium">Avg Retention</p>
                  <p className="text-xl font-bold text-orange-900">7 years</p>
                  <p className="text-orange-600 text-xs mt-1">Per RA 11038</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center shadow-lg">
                  <DocumentTextIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-purple-800 text-sm font-medium">Audit Logs</p>
                  <p className="text-xl font-bold text-purple-900">15,420</p>
                  <p className="text-purple-600 text-xs mt-1">Total records</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl border border-gray-200">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-gray-500 to-slate-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <ShieldCheckIcon className="w-4 h-4 text-white" />
              </div>
              <div>
                <h4 className="text-gray-900 font-semibold mb-2">Compliance Status</h4>
                <p className="text-gray-700 text-sm">
                  All systems are compliant with RA 11038 (Data Privacy Act) and GDPR requirements.
                  Regular audits are performed to ensure data protection and user privacy.
                  Last compliance audit: <span className="font-medium">{new Date().toLocaleDateString()}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Details Modal */}
        {showDetails && selectedLog && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto transform transition-all animate-fade-in-up">
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-t-2xl p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <EyeIcon className="w-6 h-6" />
                    Activity Log Details
                  </h2>
                  <button
                    onClick={() => setShowDetails(false)}
                    className="text-white hover:text-red-200 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-300 rounded-full p-1"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>
                <p className="text-green-100 mt-2">Detailed information about this activity</p>
              </div>

              <div className="p-8">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 mb-6 border border-green-200">
                  <h3 className="text-lg font-bold text-green-900 mb-2 flex items-center gap-2">
                    <DocumentTextIcon className="w-5 h-5" />
                    Activity Description
                  </h3>
                  <p className="text-gray-700 text-base">{selectedLog.description}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <UserIcon className="w-5 h-5 text-blue-600" />
                      User Information
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">User:</span>
                        <span className="font-medium text-gray-900">{selectedLog.user?.name || 'System'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Action:</span>
                        {(() => {
                          const { className, displayText } = getActionBadge(selectedLog.action);
                          return <span className={className}>{displayText}</span>;
                        })()}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <ClockIcon className="w-5 h-5 text-green-600" />
                      Timing & Location
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Date & Time:</span>
                        <span className="font-medium text-gray-900">{formatDate(selectedLog.created_at)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">IP Address:</span>
                        <span className="font-mono text-sm text-gray-900">{selectedLog.ip_address || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {selectedLog.model_type && (
                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm mb-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <ServerIcon className="w-5 h-5 text-purple-600" />
                      Model Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Model Type:</span>
                        <span className="font-medium text-gray-900">{selectedLog.model_type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Model ID:</span>
                        <span className="font-mono text-sm text-gray-900">{selectedLog.model_id}</span>
                      </div>
                    </div>
                  </div>
                )}

                {selectedLog.old_values && (
                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm mb-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <ArrowPathIcon className="w-5 h-5 text-orange-600" />
                      Previous Values
                    </h4>
                    <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-x-auto border border-gray-200">
                      {JSON.stringify(selectedLog.old_values, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.new_values && (
                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm mb-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <CheckCircleIcon className="w-5 h-5 text-green-600" />
                      New Values
                    </h4>
                    <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-x-auto border border-gray-200">
                      {JSON.stringify(selectedLog.new_values, null, 2)}
                    </pre>
                  </div>
                )}

                <div className="flex justify-end pt-6 border-t border-gray-200">
                  <button
                    onClick={() => setShowDetails(false)}
                    className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-6 py-3 rounded-xl font-medium transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default ActivityLogs;
