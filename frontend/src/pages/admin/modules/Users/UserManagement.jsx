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

  useEffect(() => {
    fetchAllUsers();
  }, []);

  const fetchAllUsers = async () => {
    setLoading(true);
    try {
      // Fetch all user types in parallel
      const [adminsRes, staffRes, residentsRes] = await Promise.all([
        axiosInstance.get('/api/admin/admins').catch(() => ({ data: { users: [] } })),
        axiosInstance.get('/api/admin/staff').catch(() => ({ data: [] })),
        axiosInstance.get('/api/admin/residents-users').catch(() => ({ data: { users: [] } }))
      ]);

      // Get admin data
      const adminsData = Array.isArray(adminsRes.data?.users) 
        ? adminsRes.data.users 
        : adminsRes.data?.users || [];

      // Get staff data
      const staffData = Array.isArray(staffRes.data) ? staffRes.data : staffRes.data?.staff || [];
      
      // Get residents data
      const residentsData = Array.isArray(residentsRes.data?.users) 
        ? residentsRes.data.users 
        : residentsRes.data?.users || [];

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
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

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

              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                      <UserGroupIcon className="w-5 h-5" />
                      {selectedRole === 'admin' ? 'Administrators' : selectedRole === 'staff' ? 'Staff Members' : 'Residents'} ({currentCounts.total})
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
                        Create {selectedRole === 'admin' ? 'Admin' : selectedRole === 'staff' ? 'Staff' : 'Resident'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Users Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-4 text-left font-bold text-gray-700 text-sm uppercase tracking-wider">Name</th>
                        <th className="px-6 py-4 text-left font-bold text-gray-700 text-sm uppercase tracking-wider">Email</th>
                        {selectedRole === 'staff' && (
                          <th className="px-6 py-4 text-left font-bold text-gray-700 text-sm uppercase tracking-wider">Department</th>
                        )}
                        <th className="px-6 py-4 text-left font-bold text-gray-700 text-sm uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-left font-bold text-gray-700 text-sm uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {loading ? (
                        <tr>
                          <td colSpan={selectedRole === 'staff' ? 5 : 4} className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center gap-4">
                              <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                              <p className="text-gray-600">Loading users...</p>
                            </div>
                          </td>
                        </tr>
                      ) : currentUsers.length === 0 ? (
                        <tr>
                          <td colSpan={selectedRole === 'staff' ? 5 : 4} className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center gap-4">
                              <UserGroupIcon className="w-16 h-16 text-gray-300" />
                              <p className="text-gray-600 font-semibold">No {selectedRole === 'admin' ? 'administrators' : selectedRole === 'staff' ? 'staff members' : 'residents'} found</p>
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
                            {selectedRole === 'staff' && (
                              <td className="px-6 py-4">
                                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                                  {user.department || 'N/A'}
                                </span>
                              </td>
                            )}
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
            </>
          )}
        </div>
      </main>
    </>
  );
};

export default UserManagement;

