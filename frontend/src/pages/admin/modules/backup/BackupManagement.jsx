import React, { useState, useEffect } from 'react';
import axiosInstance from '../../../../utils/axiosConfig';
import { toast } from 'react-toastify';
import {
  ArrowDownTrayIcon,
  TrashIcon,
  ArrowPathIcon,
  ServerIcon,
  FolderIcon,
  Cog6ToothIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
  ChartBarIcon,
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
    }
  };

  // Get backup type icon
  const getBackupTypeIcon = (type) => {
    switch (type) {
      case 'database':
        return <ServerIcon className="w-5 h-5 text-blue-500" />;
      case 'storage':
        return <FolderIcon className="w-5 h-5 text-green-500" />;
      case 'config':
        return <Cog6ToothIcon className="w-5 h-5 text-purple-500" />;
      default:
        return <InformationCircleIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  // Get backup type badge color
  const getBackupTypeBadge = (type) => {
    const badges = {
      database: 'bg-blue-100 text-blue-800 border-blue-200',
      storage: 'bg-green-100 text-green-800 border-green-200',
      config: 'bg-purple-100 text-purple-800 border-purple-200',
    };
    return badges[type] || 'bg-gray-100 text-gray-800 border-gray-200';
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <ServerIconSolid className="w-8 h-8 text-blue-600" />
                Backup Management
              </h1>
              <p className="text-gray-600 mt-2">
                Manage system backups and ensure data protection
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* Backup Type Selector */}
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
              >
                {backingUp ? (
                  <>
                    <ArrowPathIcon className="w-5 h-5 animate-spin" />
                    Creating Backup...
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Total Backups</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {statistics.total_backups}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <ServerIcon className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Total Size</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {statistics.total_size_formatted}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <ChartBarIcon className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Database Backups</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {statistics.database_backups}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <ServerIcon className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Latest Backup</p>
                    <p className="text-sm font-semibold text-gray-900 mt-2">
                      {statistics.latest_backup 
                        ? formatDate(statistics.latest_backup)
                        : 'No backups yet'}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <ClockIcon className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Backups Table */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <ArrowDownTrayIcon className="w-6 h-6" />
                Backup History
              </h2>
              <button
                onClick={fetchBackups}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowPathIcon className="w-5 h-5" />
                Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <ArrowPathIcon className="w-12 h-12 text-gray-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Loading backups...</p>
            </div>
          ) : backups.length === 0 ? (
            <div className="p-12 text-center">
              <ServerIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg mb-2">No backups found</p>
              <p className="text-gray-500 text-sm">
                Click "Create Backup" to create your first backup
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Filename
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Size
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created At
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Modified At
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {backups.map((backup) => (
                    <tr key={backup.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getBackupTypeIcon(backup.type)}
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getBackupTypeBadge(backup.type)}`}>
                            {backup.type.charAt(0).toUpperCase() + backup.type.slice(1)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {backup.filename}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">
                          {backup.size_formatted}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">
                          {formatDate(backup.created_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">
                          {formatDate(backup.modified_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleDeleteBackup(backup.id, backup.filename)}
                          className="inline-flex items-center gap-2 px-3 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete backup"
                        >
                          <TrashIcon className="w-5 h-5" />
                          Delete
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
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <InformationCircleIcon className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-blue-900 mb-1">
                Backup Information
              </h3>
              <p className="text-sm text-blue-800">
                Backups are automatically created daily at 2:00 AM. You can also create manual backups at any time.
                Backups older than 30 days are automatically cleaned up. All backups are stored securely in the system.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BackupManagement;

