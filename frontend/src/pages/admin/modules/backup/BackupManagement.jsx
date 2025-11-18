import React, { useState, useEffect } from 'react';
import axiosInstance from '../../../../utils/axiosConfig';
import { toast } from 'react-toastify';
import Navbar from '../../../../components/Navbar';
import Sidebar from '../../../../components/Sidebar';
import {
  ArrowDownTrayIcon,
  TrashIcon,
  ArrowPathIcon,
  ServerIcon,
  FolderIcon,
  Cog6ToothIcon,
  ClockIcon,
  InformationCircleIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import {
  ArrowDownTrayIcon as ArrowDownTrayIconSolid,
  ServerIcon as ServerIconSolid,
} from '@heroicons/react/24/solid';

const BackupManagement = () => {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [backingUp, setBackingUp] = useState(false);
  const [statistics, setStatistics] = useState(null);
  const [selectedType, setSelectedType] = useState('all');
  const [deletingId, setDeletingId] = useState(null);

  // Fetch backups list
  const fetchBackups = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/admin/backups');
      if (response.data.success) {
        setBackups(response.data.backups || []);
      }
    } catch (error) {
      console.error('Error fetching backups:', error);
      toast.error('Failed to load backups');
    } finally {
      setLoading(false);
    }
  };

  // Fetch statistics
  const fetchStatistics = async () => {
    try {
      const response = await axiosInstance.get('/admin/backups/statistics');
      if (response.data.success) {
        setStatistics(response.data.statistics);
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  };

  useEffect(() => {
    fetchBackups();
    fetchStatistics();
  }, []);

  // Run backup
  const handleRunBackup = async () => {
    try {
      setBackingUp(true);
      const response = await axiosInstance.post('/admin/backup/run', {
        type: selectedType
      });

      if (response.data.success) {
        toast.success('Backup created successfully!');
        // Refresh backups list and statistics
        await fetchBackups();
        await fetchStatistics();
      } else {
        toast.error(response.data.message || 'Backup failed');
      }
    } catch (error) {
      console.error('Error running backup:', error);
      toast.error(error.response?.data?.message || 'Failed to create backup');
    } finally {
      setBackingUp(false);
    }
  };

  // Delete backup
  const handleDeleteBackup = async (backupId, filename) => {
    if (!window.confirm(`Are you sure you want to delete backup: ${filename}?`)) {
      return;
    }

    try {
      setDeletingId(backupId);
      const response = await axiosInstance.delete(`/admin/backup/${backupId}`);
      if (response.data.success) {
        toast.success('Backup deleted successfully');
        await fetchBackups();
        await fetchStatistics();
      } else {
        toast.error(response.data.message || 'Failed to delete backup');
      }
    } catch (error) {
      console.error('Error deleting backup:', error);
      toast.error(error.response?.data?.message || 'Failed to delete backup');
    } finally {
      setDeletingId(null);
    }
  };

  // Get backup type icon
  const getBackupTypeIcon = (type) => {
    switch (type) {
      case 'database':
        return <ServerIcon className="w-5 h-5 text-green-600" />;
      case 'storage':
        return <FolderIcon className="w-5 h-5 text-emerald-600" />;
      case 'config':
        return <Cog6ToothIcon className="w-5 h-5 text-teal-600" />;
      default:
        return <InformationCircleIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  // Get backup type badge color
  const getBackupTypeBadge = (type) => {
    const badges = {
      database: 'bg-green-50 text-green-700 border-green-200',
      storage: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      config: 'bg-teal-50 text-teal-700 border-teal-200',
    };
    return badges[type] || 'bg-gray-50 text-gray-700 border-gray-200';
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Format relative time
  const formatRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return formatDate(dateString);
  };

  return (
    <>
      <Navbar />
      <Sidebar />
      <main className="bg-gradient-to-br from-green-50 to-emerald-50 min-h-screen ml-0 lg:ml-64 pt-20 lg:pt-36 px-4 pb-16 font-sans">
        <div className="w-full max-w-7xl mx-auto space-y-8">
          {/* Header Section */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                    <ServerIconSolid className="w-7 h-7 text-white" />
                  </div>
                  Backup Management
                </h1>
                <p className="text-gray-600 mt-2 text-lg">
                  Manage system backups and ensure data protection
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* Backup Type Selector */}
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white shadow-sm text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={backingUp}
                >
                  <option value="all">All Components</option>
                  <option value="database">Database Only</option>
                  <option value="storage">Storage Only</option>
                  <option value="config">Config Only</option>
                </select>
                
                {/* Run Backup Button */}
                <button
                  onClick={handleRunBackup}
                  disabled={backingUp}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-green-600 to-emerald-700 text-white rounded-xl hover:from-green-700 hover:to-emerald-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-105 disabled:hover:scale-100 font-semibold text-sm"
                >
                  {backingUp ? (
                    <>
                      <ArrowPathIcon className="w-5 h-5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <ArrowDownTrayIconSolid className="w-5 h-5" />
                      Create Backup
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Statistics Cards */}
            {statistics && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Total Backups</p>
                      <p className="text-4xl font-black text-gray-900">
                        {statistics.total_backups}
                      </p>
                    </div>
                    <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                      <ServerIcon className="w-7 h-7 text-white" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Total Size</p>
                      <p className="text-4xl font-black text-gray-900">
                        {statistics.total_size_formatted}
                      </p>
                    </div>
                    <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                      <ChartBarIcon className="w-7 h-7 text-white" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Database Backups</p>
                      <p className="text-4xl font-black text-gray-900">
                        {statistics.database_backups}
                      </p>
                    </div>
                    <div className="w-14 h-14 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg">
                      <ServerIcon className="w-7 h-7 text-white" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Latest Backup</p>
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {statistics.latest_backup 
                          ? formatRelativeTime(statistics.latest_backup)
                          : 'No backups yet'}
                      </p>
                      {statistics.latest_backup && (
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDate(statistics.latest_backup)}
                        </p>
                      )}
                    </div>
                    <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg ml-2">
                      <ClockIcon className="w-7 h-7 text-white" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Backups Table Card */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <ArrowDownTrayIcon className="w-6 h-6 text-green-600" />
                  </div>
                  Backup History
                </h2>
                <button
                  onClick={fetchBackups}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors font-medium text-sm disabled:opacity-50"
                >
                  <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>

            {loading ? (
              <div className="p-16 text-center">
                <ArrowPathIcon className="w-16 h-16 text-green-500 animate-spin mx-auto mb-4" />
                <p className="text-gray-600 font-medium">Loading backups...</p>
              </div>
            ) : backups.length === 0 ? (
              <div className="p-16 text-center">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <ServerIcon className="w-12 h-12 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No backups found</h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  Get started by creating your first backup. Click the "Create Backup" button above to begin.
                </p>
                <button
                  onClick={handleRunBackup}
                  disabled={backingUp}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-700 text-white rounded-xl hover:from-green-700 hover:to-emerald-800 transition-colors font-semibold shadow-lg"
                >
                  <ArrowDownTrayIconSolid className="w-5 h-5" />
                  Create Your First Backup
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Filename
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Size
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Modified
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {backups.map((backup, index) => (
                      <tr 
                        key={backup.id} 
                        className="hover:bg-green-50/50 transition-colors duration-150"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0">
                              {getBackupTypeIcon(backup.type)}
                            </div>
                            <span className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${getBackupTypeBadge(backup.type)}`}>
                              {backup.type.charAt(0).toUpperCase() + backup.type.slice(1)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-semibold text-gray-900 max-w-md truncate" title={backup.filename}>
                            {backup.filename}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-700">
                            {backup.size_formatted}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600">
                            <div className="font-medium">{formatRelativeTime(backup.created_at)}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{formatDate(backup.created_at)}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600">
                            <div className="font-medium">{formatRelativeTime(backup.modified_at)}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{formatDate(backup.modified_at)}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => handleDeleteBackup(backup.id, backup.filename)}
                            disabled={deletingId === backup.id}
                            className="inline-flex items-center gap-2 px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-150 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete backup"
                          >
                            {deletingId === backup.id ? (
                              <>
                                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                Deleting...
                              </>
                            ) : (
                              <>
                                <TrashIcon className="w-4 h-4" />
                                Delete
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="mt-8 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6 shadow-lg">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <InformationCircleIcon className="w-7 h-7 text-green-600" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-green-900 mb-2 flex items-center gap-2">
                  <ShieldCheckIcon className="w-5 h-5" />
                  Backup Information
                </h3>
                <div className="space-y-2 text-sm text-green-800">
                  <p className="flex items-start gap-2">
                    <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span><strong>Automatic Backups:</strong> Backups are automatically created daily at 2:00 AM without any manual intervention.</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span><strong>Manual Backups:</strong> You can create backups at any time using the "Create Backup" button above.</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span><strong>Retention Policy:</strong> Backups older than 30 days are automatically cleaned up to manage storage space.</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span><strong>Security:</strong> All backups are stored securely in the system and are only accessible to administrators.</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
};

export default BackupManagement;
