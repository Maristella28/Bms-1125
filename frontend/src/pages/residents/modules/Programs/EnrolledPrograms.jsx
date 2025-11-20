import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axiosInstance from '../../../../utils/axiosConfig';
import Navbares from '../../../../components/Navbares';
import Sidebares from '../../../../components/Sidebares';

const EnrolledPrograms = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [error, setError] = useState(null);
  const [trackingModal, setTrackingModal] = useState({ isOpen: false, data: null });
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [proofComment, setProofComment] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [receiptValidationError, setReceiptValidationError] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeTab, setActiveTab] = useState('active'); // 'active' or 'completed'

  useEffect(() => {
    const fetchEnrolledPrograms = async () => {
      try {
        setLoading(true);
        const response = await axiosInstance.get('/my-benefits');
        setBeneficiaries(response.data?.beneficiaries || []);
      } catch (err) {
        console.error('Error fetching enrolled programs:', err);
        setError(err.response?.data?.message || 'Failed to load enrolled programs');
      } finally {
        setLoading(false);
      }
    };

    const fetchNotifications = async () => {
      try {
        const response = await axiosInstance.get('/notifications');
        if (response.data?.success) {
          setNotifications(response.data.data.notifications || []);
          setUnreadCount(response.data.data.unread_count || 0);
        }
      } catch (err) {
        console.error('Error fetching notifications:', err);
      }
    };

    fetchEnrolledPrograms();
    fetchNotifications();

    // Set up polling for notifications every 30 seconds
    const notificationInterval = setInterval(fetchNotifications, 30000);

    return () => {
      clearInterval(notificationInterval);
    };
  }, []);

  // Auto-open tracking modal when program and beneficiary params are present
  useEffect(() => {
    const programId = searchParams.get('program');
    const beneficiaryId = searchParams.get('beneficiary');
    
    if (beneficiaryId && beneficiaries.length > 0 && !trackingModal.isOpen) {
      // Find the beneficiary - prioritize exact ID match, then program match
      let beneficiary = beneficiaries.find(b => String(b.id) === String(beneficiaryId));
      
      if (!beneficiary && programId) {
        beneficiary = beneficiaries.find(b => String(b.program_id) === String(programId));
      }
      
      if (beneficiary) {
        // Auto-open tracking modal
        const openTracking = async () => {
          try {
            setTrackingLoading(true);
            const response = await axiosInstance.get(`/my-benefits/${beneficiary.id}/track`);
            setTrackingModal({
              isOpen: true,
              data: response.data.data
            });
            
            // Clean up URL params after opening (with delay to ensure modal opens)
            setTimeout(() => {
              const newParams = new URLSearchParams(searchParams);
              newParams.delete('program');
              newParams.delete('beneficiary');
              if (newParams.toString() !== searchParams.toString()) {
                setSearchParams(newParams, { replace: true });
              }
            }, 500);
          } catch (err) {
            console.error('Error fetching tracking data:', err);
            setError(err.response?.data?.message || 'Failed to load tracking information');
          } finally {
            setTrackingLoading(false);
          }
        };
        
        openTracking();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, beneficiaries.length, trackingModal.isOpen]);

  // Auto-refresh tracking data when payout date is reached
  useEffect(() => {
    if (!trackingModal.isOpen || !trackingModal.data) return;

    const payoutDate = trackingModal.data.tracking?.payout_date;
    if (!payoutDate) return;

    const beneficiaryId = trackingModal.data.beneficiary?.id;
    if (!beneficiaryId) return;

    // Check if payout date has been reached
    const checkPayoutDate = () => {
      try {
        const payout = new Date(payoutDate);
        const now = new Date();
        
        // If payout date has been reached and we're still on stage 2, refresh tracking data
        if (now >= payout) {
          const currentStage = trackingModal.data.tracking?.current_stage;
          if (currentStage === 2) {
            axiosInstance.get(`/my-benefits/${beneficiaryId}/track`)
              .then(response => {
                setTrackingModal(prev => ({
                  ...prev,
                  data: response.data.data
                }));
              })
              .catch(err => {
                console.error('Error refreshing tracking data:', err);
              });
          }
        }
      } catch (e) {
        console.error('Error checking payout date:', e);
      }
    };

    // Check immediately
    checkPayoutDate();

    // Set up interval to check every minute if payout date hasn't been reached yet
    try {
      const payout = new Date(payoutDate);
      const now = new Date();
      
      if (now < payout) {
        // Calculate time until payout date
        const timeUntilPayout = payout.getTime() - now.getTime();
        
        // Set up interval to check every minute
        const interval = setInterval(checkPayoutDate, 60000); // Check every minute
        
        // Also set a timeout to check exactly when payout date is reached
        const timeout = setTimeout(() => {
          checkPayoutDate();
          clearInterval(interval);
        }, timeUntilPayout);

        return () => {
          clearInterval(interval);
          clearTimeout(timeout);
        };
      }
    } catch (e) {
      console.error('Error setting up payout date check:', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackingModal.isOpen, trackingModal.data?.tracking?.payout_date, trackingModal.data?.tracking?.current_stage]);

  const handleBackToBenefits = () => {
    navigate('/residents/myBenefits');
  };

  const handleBackToDashboard = () => {
    navigate('/residents/dashboard?tab=programs');
  };

  const handleTrackProgram = async (beneficiaryId) => {
    try {
      setTrackingLoading(true);
      const response = await axiosInstance.get(`/my-benefits/${beneficiaryId}/track`);
      setTrackingModal({
        isOpen: true,
        data: response.data.data
      });
    } catch (err) {
      console.error('Error fetching tracking data:', err);
      setError(err.response?.data?.message || 'Failed to load tracking information');
    } finally {
      setTrackingLoading(false);
    }
  };

  const handleCloseTrackingModal = () => {
    setTrackingModal({ isOpen: false, data: null });
    setSelectedFile(null);
    setProofComment('');
    setReceiptNumber('');
    setReceiptValidationError('');
  };

  // Helper function to check if program is non-monetary
  const isNonMonetaryProgram = () => {
    if (!trackingModal.data) return false;
    const assistanceType = trackingModal.data.program?.assistance_type || 
                          trackingModal.data.beneficiary?.assistance_type;
    return assistanceType === 'Non-monetary Assistance' || 
           assistanceType === 'Non-monetary' ||
           assistanceType === 'non-monetary' ||
           assistanceType === 'Non-Monetary Assistance';
  };

  const handleNotificationClick = async (notification) => {
    try {
      // Mark as read if not already read
      if (!notification.is_read) {
        await axiosInstance.post(`/notifications/${notification.id}/read`);
        setNotifications(prev => 
          prev.map(notif => 
            notif.id === notification.id 
              ? { ...notif, is_read: true, read_at: new Date().toISOString() }
              : notif
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }

      // Get redirect path from notification data
      const redirectPath = notification.redirect_path || notification.data?.redirect_path;
      
      if (redirectPath) {
        // If redirect path includes query params, navigate to it
        if (redirectPath.includes('?')) {
          navigate(redirectPath);
        } else {
          // Otherwise, check if we have program_id and beneficiary_id in data
          const programId = notification.data?.program_id || notification.program_id;
          const beneficiaryId = notification.data?.beneficiary_id;
          
          if (beneficiaryId) {
            // Navigate to enrolled programs with params
            navigate(`/residents/enrolledPrograms?program=${programId}&beneficiary=${beneficiaryId}`);
          } else if (programId) {
            // Just program ID, find beneficiary
            const beneficiary = beneficiaries.find(b => String(b.program_id) === String(programId));
            if (beneficiary) {
              navigate(`/residents/enrolledPrograms?program=${programId}&beneficiary=${beneficiary.id}`);
            } else {
              navigate(redirectPath);
            }
          } else {
            navigate(redirectPath);
          }
        }
      } else {
        // Fallback: check if notification has program_id and beneficiary_id
        const programId = notification.data?.program_id || notification.program_id;
        const beneficiaryId = notification.data?.beneficiary_id;
        
        if (beneficiaryId) {
          navigate(`/residents/enrolledPrograms?program=${programId}&beneficiary=${beneficiaryId}`);
        } else if (programId) {
          const beneficiary = beneficiaries.find(b => String(b.program_id) === String(programId));
          if (beneficiary) {
            navigate(`/residents/enrolledPrograms?program=${programId}&beneficiary=${beneficiary.id}`);
          }
        }
      }
    } catch (err) {
      console.error('Error handling notification click:', err);
    }
  };

  const handleMarkNotificationAsRead = async (notificationId) => {
    try {
      await axiosInstance.post(`/notifications/${notificationId}/read`);
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId 
            ? { ...notif, is_read: true, read_at: new Date().toISOString() }
            : notif
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await axiosInstance.post('/notifications/read-all');
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        setError('Please select a valid file (JPEG, PNG, or PDF)');
        return;
      }
      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleUploadProof = async () => {
    if (!trackingModal.data) return;

    const isNonMonetary = isNonMonetaryProgram();

    // For non-monetary programs, receipt number is not required
    // For monetary programs, validate receipt number is provided
    if (!isNonMonetary && !receiptNumber.trim()) {
      setReceiptValidationError('Please enter your receipt number');
      return;
    }

    try {
      setUploadLoading(true);
      setReceiptValidationError('');
      
      const formData = new FormData();
      
      // Only append receipt_number for monetary programs
      if (!isNonMonetary && receiptNumber.trim()) {
        formData.append('receipt_number', receiptNumber.trim());
      }
      
      if (selectedFile) {
        formData.append('proof_file', selectedFile);
      }
      if (proofComment.trim()) {
        formData.append('comment', proofComment);
      }

      const response = await axiosInstance.post(
        `/my-benefits/${trackingModal.data.beneficiary.id}/validate-receipt`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      // Refresh the tracking data to get updated stage information
      const trackingResponse = await axiosInstance.get(`/my-benefits/${trackingModal.data.beneficiary.id}/track`);
      setTrackingModal({
        isOpen: true,
        data: trackingResponse.data.data
      });

      setSelectedFile(null);
      setProofComment('');
      setReceiptNumber('');
      setError(null);
    } catch (err) {
      console.error('Error validating receipt:', err);
      if (err.response?.data?.message?.includes('Invalid receipt number')) {
        setReceiptValidationError('Invalid Receipt Number. Please check the receipt sent to your email.');
      } else {
        setError(err.response?.data?.message || 'Failed to validate receipt number');
      }
    } finally {
      setUploadLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <Navbares />
      <Sidebares />
      <main className="ml-64 pt-36 px-6 pb-16 font-sans relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-200 to-purple-200 rounded-full opacity-20 animate-pulse"></div>
          <div className="absolute top-1/2 -left-40 w-96 h-96 bg-gradient-to-br from-green-200 to-teal-200 rounded-full opacity-15 animate-pulse" style={{animationDelay: '2s'}}></div>
          <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-gradient-to-br from-pink-200 to-rose-200 rounded-full opacity-10 animate-pulse" style={{animationDelay: '4s'}}></div>
        </div>
        
        <div className="w-full max-w-[98%] mx-auto space-y-10 relative z-10">
          {/* Enhanced Header */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-3 mb-6">
              <button
                onClick={handleBackToBenefits}
                className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-lg transition-colors duration-200 shadow-sm border border-gray-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to My Benefits
              </button>
              <button
                onClick={handleBackToDashboard}
                className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-lg transition-colors duration-200 shadow-sm border border-gray-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0H9" />
                </svg>
                Dashboard
              </button>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-lg transition-colors duration-200 shadow-sm border border-gray-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4.828 7l2.586 2.586a2 2 0 002.828 0L12 7H4.828zM4 12h16M4 16h16" />
                </svg>
                Notifications
                {unreadCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full shadow-xl mb-4">
              <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <div className="flex items-center justify-center gap-4">
              <h1 className="text-5xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent tracking-tight">
                Enrolled Programs
              </h1>
              <button
                onClick={() => window.location.reload()}
                className="p-2 bg-green-100 hover:bg-green-200 rounded-full transition-colors duration-200"
                title="Refresh Programs"
              >
                <svg 
                  className="w-5 h-5 text-green-600" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto leading-relaxed">
              View all your enrolled programs and track their status
            </p>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-gray-600 text-lg font-medium">Loading Enrolled Programs</p>
              <p className="text-gray-400 mt-1">Please wait while we fetch your enrolled programs...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-red-800 mb-2">Unable to Load Programs</h3>
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && beneficiaries.length === 0 && (
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">No Enrolled Programs</h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto leading-relaxed">
                You haven't enrolled in any programs yet. Browse available programs and apply to start your journey.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={handleBackToDashboard}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200"
                >
                  Browse Available Programs
                </button>
                <button
                  onClick={handleBackToBenefits}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200"
                >
                  Back to My Benefits
                </button>
              </div>
            </div>
          )}

          {/* Programs List */}
          {!loading && !error && beneficiaries.length > 0 && (() => {
            // Separate active and completed programs
            const activePrograms = beneficiaries.filter(b => 
              b.status !== 'Completed' && b.status !== 'completed'
            );
            const completedPrograms = beneficiaries.filter(b => 
              b.status === 'Completed' || b.status === 'completed'
            );

            return (
            <div className="space-y-8">
              {/* Summary Stats */}
              <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/60 p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-800">Program Overview</h2>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600">{activePrograms.length}</div>
                      <div className="text-sm text-gray-600">Active Programs</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-600">{completedPrograms.length}</div>
                      <div className="text-sm text-gray-600">Completed Programs</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-purple-600">
                        ₱{beneficiaries.reduce((sum, b) => sum + (Number(b.amount) || 0), 0).toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600">Total Benefits</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/60 p-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveTab('active')}
                    className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
                      activeTab === 'active'
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Active Programs ({activePrograms.length})
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('completed')}
                    className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
                      activeTab === 'completed'
                        ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      Completed Programs ({completedPrograms.length})
                    </div>
                  </button>
                </div>
              </div>

              {/* Active Programs Grid */}
              {activeTab === 'active' && (
                <>
                  {activePrograms.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {activePrograms.map((beneficiary, index) => (
                  <div 
                    key={beneficiary.id} 
                    className="group bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/60 p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 hover:border-green-300"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    {/* Program Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-md">
                          <span className="text-white text-lg">🎯</span>
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-800 group-hover:text-green-700 transition-colors">
                            {beneficiary.name}
                          </h3>
                          <div className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
                            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                            <span>Enrolled Program</span>
                          </div>
                        </div>
                      </div>
                      <div className={`text-xs font-bold px-3 py-1 rounded-full ${
                        beneficiary.status === 'Approved' ? 'bg-green-100 text-green-800' :
                        beneficiary.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                        beneficiary.status === 'Processing' ? 'bg-blue-100 text-blue-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {beneficiary.status}
                      </div>
                    </div>

                    {/* Program Details */}
                    <div className="space-y-3 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 font-medium">Beneficiary Type:</span>
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                          {beneficiary.beneficiary_type || beneficiary.beneficiaryType}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 font-medium">Assistance Type:</span>
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                          {beneficiary.assistance_type || beneficiary.assistanceType}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 font-medium">Amount:</span>
                        <span className="text-green-600 font-bold text-lg">
                          ₱{(beneficiary.amount || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Program Description/Notes */}
                    {beneficiary.remarks && (
                      <div className="bg-gray-50 p-3 rounded-xl mb-4">
                        <p className="text-sm text-gray-700">
                          <span className="font-medium text-gray-800">Notes:</span> {beneficiary.remarks}
                        </p>
                      </div>
                    )}

                    {/* Program Footer */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-full flex items-center justify-center">
                          <span className="text-emerald-600 text-sm">🏛️</span>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-600 block">Barangay Program</span>
                          <span className="text-xs text-gray-500">Government Initiative</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full animate-pulse ${
                          beneficiary.status === 'Approved' ? 'bg-green-400' :
                          beneficiary.status === 'Pending' ? 'bg-yellow-400' :
                          beneficiary.status === 'Processing' ? 'bg-blue-400' :
                          'bg-red-400'
                        }`}></div>
                        <span className="text-xs text-gray-500">
                          {beneficiary.status === 'Approved' ? 'Active' : 
                           beneficiary.status === 'Pending' ? 'Pending' :
                           beneficiary.status === 'Processing' ? 'Processing' : 'Inactive'}
                        </span>
                      </div>
                    </div>

                    {/* Track Program Button */}
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <button
                        onClick={() => handleTrackProgram(beneficiary.id)}
                        disabled={trackingLoading}
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white px-4 py-2 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 disabled:transform-none disabled:shadow-none"
                      >
                        {trackingLoading ? (
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Loading...
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            Track Program Status
                          </div>
                        )}
                      </button>
                    </div>
                  </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/60 p-12 text-center">
                      <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-bold text-gray-800 mb-2">No Active Programs</h3>
                      <p className="text-gray-600">You don't have any active programs at the moment.</p>
                    </div>
                  )}
                </>
              )}

              {/* Completed Programs Table */}
              {activeTab === 'completed' && (
                <>
                  {completedPrograms.length > 0 ? (
                    <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/60 overflow-hidden">
                      <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          Completed Programs History
                        </h2>
                        <p className="text-gray-600 mt-1">View all your successfully completed programs</p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Program Name</th>
                              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Beneficiary Type</th>
                              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Assistance Type</th>
                              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Amount</th>
                              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Application Date</th>
                              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Status</th>
                              <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {completedPrograms.map((beneficiary) => (
                              <tr key={beneficiary.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                                      <span className="text-white text-sm">✓</span>
                                    </div>
                                    <div>
                                      <div className="font-semibold text-gray-800">{beneficiary.name}</div>
                                      {beneficiary.remarks && (
                                        <div className="text-xs text-gray-500 mt-1">{beneficiary.remarks.substring(0, 50)}...</div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-medium">
                                    {beneficiary.beneficiary_type || beneficiary.beneficiaryType}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium">
                                    {beneficiary.assistance_type || beneficiary.assistanceType}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <span className="text-green-600 font-bold text-lg">
                                    ₱{(beneficiary.amount || 0).toLocaleString()}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-gray-600">
                                  {beneficiary.application_date 
                                    ? new Date(beneficiary.application_date).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric'
                                      })
                                    : 'N/A'}
                                </td>
                                <td className="px-6 py-4">
                                  <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-bold">
                                    ✓ Completed
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <button
                                    onClick={() => handleTrackProgram(beneficiary.id)}
                                    disabled={trackingLoading}
                                    className="mx-auto flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-lg font-medium transition-all duration-300 shadow-sm hover:shadow-md disabled:shadow-none"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                    View Details
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/60 p-12 text-center">
                      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-bold text-gray-800 mb-2">No Completed Programs</h3>
                      <p className="text-gray-600">You haven't completed any programs yet. Complete your active programs to see them here.</p>
                    </div>
                  )}
                </>
              )}

              {/* Quick Actions */}
              <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/60 p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={handleBackToDashboard}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-4 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                  >
                    Browse More Programs
                  </button>
                  <button
                    onClick={handleBackToBenefits}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-4 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                  >
                    Back to My Benefits
                  </button>
                  <button
                    onClick={() => navigate('/residents/projects')}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 py-4 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                  >
                    View All Projects
                  </button>
                </div>
              </div>
            </div>
            );
          })()}
        </div>
      </main>

      {/* Notifications Panel */}
      {showNotifications && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            {/* Notifications Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-white text-xl">🔔</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">Notifications</h2>
                    <p className="text-gray-600">{unreadCount} unread notifications</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg font-medium transition-colors"
                    >
                      Mark All Read
                    </button>
                  )}
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Notifications Content */}
            <div className="p-6">
              {notifications.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-gray-400 text-3xl">🔔</span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">No Notifications</h3>
                  <p className="text-gray-600">You don't have any notifications yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 rounded-xl border-2 transition-all duration-300 cursor-pointer hover:shadow-md ${
                        notification.is_read 
                          ? 'bg-gray-50 border-gray-200' 
                          : 'bg-blue-50 border-blue-200'
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-3 h-3 rounded-full mt-2 ${
                          notification.is_read ? 'bg-gray-300' : 'bg-blue-500'
                        }`}></div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className={`font-semibold ${
                              notification.is_read ? 'text-gray-700' : 'text-blue-800'
                            }`}>
                              {notification.title}
                            </h4>
                            <span className="text-xs text-gray-500">
                              {new Date(notification.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className={`text-sm ${
                            notification.is_read ? 'text-gray-600' : 'text-blue-700'
                          }`}>
                            {notification.message}
                          </p>
                          {notification.data?.formatted_date && (
                            <div className="mt-2 p-2 bg-white rounded border">
                              <p className="text-sm text-gray-600">
                                <strong>New Payout Date:</strong> {notification.data.formatted_date}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Program Tracking Modal */}
      {trackingModal.isOpen && trackingModal.data && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-white text-xl">📊</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">Program Tracking</h2>
                    <p className="text-gray-600">{trackingModal.data.beneficiary.name}</p>
                  </div>
                </div>
                <button
                  onClick={handleCloseTrackingModal}
                  className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-8 space-y-8">
              {/* Program Info */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Program Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium text-gray-600">Program Name:</span>
                    <p className="text-gray-800 font-semibold">{trackingModal.data.program?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Benefit Amount:</span>
                    <p className="text-green-600 font-bold text-lg">₱{(trackingModal.data.beneficiary.amount || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Status:</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      trackingModal.data.beneficiary.status === 'Approved' ? 'bg-green-100 text-green-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {trackingModal.data.beneficiary.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Application Date:</span>
                    <p className="text-gray-800">{trackingModal.data.beneficiary.application_date || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Progress Tracking */}
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-gray-800">Progress Tracking</h3>
                <div className="space-y-4">
                  {trackingModal.data.tracking.stages.map((stage, index) => (
                    <div key={stage.stage} className="flex items-start gap-4">
                      {/* Stage Number */}
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shadow-lg ${
                        stage.completed 
                          ? 'bg-green-500 text-white' 
                          : stage.active 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-gray-200 text-gray-500'
                      }`}>
                        {stage.completed ? '✓' : stage.stage}
                      </div>
                      
                      {/* Stage Content */}
                      <div className="flex-1">
                        <div className={`p-4 rounded-xl border-2 transition-all duration-300 ${
                          stage.completed 
                            ? 'bg-green-50 border-green-200' 
                            : stage.active 
                              ? 'bg-blue-50 border-blue-200' 
                              : 'bg-gray-50 border-gray-200'
                        }`}>
                          <h4 className={`font-bold text-lg ${
                            stage.completed ? 'text-green-800' : stage.active ? 'text-blue-800' : 'text-gray-600'
                          }`}>
                            {stage.title}
                          </h4>
                          <p className={`text-sm ${
                            stage.completed ? 'text-green-600' : stage.active ? 'text-blue-600' : 'text-gray-500'
                          }`}>
                            {stage.description}
                          </p>
                          
                          {/* Show payout date if available */}
                          {stage.stage === 2 && trackingModal.data.tracking.payout_date && (
                            <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                              <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className="text-blue-800 font-medium">
                                  Scheduled for: {new Date(trackingModal.data.tracking.payout_date).toLocaleString('en-US', { 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true
                                  })}
                                </span>
                              </div>
                            </div>
                          )}
                          
                          {/* Stage 1: Show Application Data */}
                          {stage.stage === 1 && stage.completed && trackingModal.data.submission && (
                            <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
                              <h5 className="font-semibold text-gray-800 mb-3">Application Details</h5>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {Object.entries(trackingModal.data.submission.submission_data).map(([key, field]) => (
                                  <div key={key}>
                                    <span className="text-sm font-medium text-gray-600">{field.label}:</span>
                                    <div className="text-gray-800">
                                      {field.is_file ? (
                                        <a 
                                          href={field.file_url} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-blue-600 hover:text-blue-800 underline"
                                        >
                                          {field.file_original_name || 'View File'}
                                        </a>
                                      ) : (
                                        field.value || 'N/A'
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Stage 3: Upload Proof of Payout / Mark as Received */}
                          {stage.stage === 3 && stage.active && !trackingModal.data.beneficiary.receipt_number_validated && (
                            <div className={`mt-4 p-4 rounded-lg border-2 ${
                              trackingModal.data.beneficiary.is_paid 
                                ? 'bg-green-50 border-green-300' 
                                : 'bg-white border-gray-200'
                            }`}>
                              {isNonMonetaryProgram() ? (
                                // Non-Monetary: "Received" Button
                                <>
                                  <h5 className={`font-semibold mb-3 ${
                                    trackingModal.data.beneficiary.is_paid 
                                      ? 'text-green-800' 
                                      : 'text-gray-800'
                                  }`}>
                                    Complete Program - Mark as Received
                                    {trackingModal.data.beneficiary.is_paid && (
                                      <span className="ml-2 text-green-600">✓ Ready to complete</span>
                                    )}
                                  </h5>
                                  <div className="space-y-4">
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                      <div className="flex items-start gap-3">
                                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                          <span className="text-blue-600 text-sm">ℹ</span>
                                        </div>
                                        <div>
                                          <h6 className="font-semibold text-blue-800 mb-1">How to complete this step:</h6>
                                          <p className="text-sm text-blue-700 mb-2">
                                            1. Confirm that you have received the non-monetary assistance
                                          </p>
                                          <p className="text-sm text-blue-700">
                                            2. Optionally add a comment or upload proof, then click "Mark as Received"
                                          </p>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="border-t border-gray-200 pt-4">
                                      <h6 className="text-sm font-medium text-gray-700 mb-3">Optional: Additional Information</h6>
                                      <div className="space-y-3">
                                        <div>
                                          <label className="block text-sm font-medium text-gray-600 mb-2">
                                            Comment (optional)
                                          </label>
                                          <textarea
                                            value={proofComment}
                                            onChange={(e) => setProofComment(e.target.value)}
                                            placeholder="Any additional comments about receiving the assistance..."
                                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                            rows="2"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-sm font-medium text-gray-600 mb-2">
                                            Upload Proof File (optional)
                                          </label>
                                          <input
                                            type="file"
                                            accept=".jpg,.jpeg,.png,.pdf"
                                            onChange={handleFileSelect}
                                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                          />
                                          <div className="text-xs text-gray-500 mt-1">
                                            Accepted formats: JPEG, PNG, PDF (Max 10MB)
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-end p-3 bg-blue-50 rounded-lg">
                                      <button
                                        onClick={handleUploadProof}
                                        disabled={uploadLoading}
                                        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                                      >
                                        {uploadLoading ? (
                                          <>
                                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Processing...
                                          </>
                                        ) : (
                                          <>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            Mark as Received
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                // Monetary: Receipt Number Input
                                <>
                                  <h5 className={`font-semibold mb-3 ${
                                    trackingModal.data.beneficiary.is_paid 
                                      ? 'text-green-800' 
                                      : 'text-gray-800'
                                  }`}>
                                    Complete Program - Enter Receipt Number
                                    {trackingModal.data.beneficiary.is_paid && (
                                      <span className="ml-2 text-green-600">✓ Ready to complete</span>
                                    )}
                                  </h5>
                                  <div className="space-y-4">
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                      <div className="flex items-start gap-3">
                                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                          <span className="text-blue-600 text-sm">ℹ</span>
                                        </div>
                                        <div>
                                          <h6 className="font-semibold text-blue-800 mb-1">How to complete this step:</h6>
                                          <p className="text-sm text-blue-700 mb-2">
                                            1. Check your email for the receipt sent after your benefit was marked as paid
                                          </p>
                                          <p className="text-sm text-blue-700 mb-2">
                                            2. Find the receipt number (e.g., RCP-20250930-0008-535) in the email
                                          </p>
                                          <p className="text-sm text-blue-700">
                                            3. Enter the receipt number below to complete the program
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Receipt Number *
                                      </label>
                                      <input
                                        type="text"
                                        value={receiptNumber}
                                        onChange={(e) => {
                                          setReceiptNumber(e.target.value);
                                          setReceiptValidationError('');
                                        }}
                                        placeholder="Enter your receipt number (e.g., RCP-20250930-0008-535)"
                                        className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                          receiptValidationError ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                        }`}
                                        required
                                      />
                                      {receiptValidationError && (
                                        <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                          </svg>
                                          {receiptValidationError}
                                        </p>
                                      )}
                                    </div>

                                    <div className="border-t border-gray-200 pt-4">
                                      <h6 className="text-sm font-medium text-gray-700 mb-3">Optional: Additional Proof</h6>
                                      <div className="space-y-3">
                                        <div>
                                          <label className="block text-sm font-medium text-gray-600 mb-2">
                                            Comment (optional)
                                          </label>
                                          <textarea
                                            value={proofComment}
                                            onChange={(e) => setProofComment(e.target.value)}
                                            placeholder="Any additional comments about the payout..."
                                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                            rows="2"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-sm font-medium text-gray-600 mb-2">
                                            Upload Proof File (optional)
                                          </label>
                                          <input
                                            type="file"
                                            accept=".jpg,.jpeg,.png,.pdf"
                                            onChange={handleFileSelect}
                                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                          />
                                          <div className="text-xs text-gray-500 mt-1">
                                            Accepted formats: JPEG, PNG, PDF (Max 10MB)
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {receiptNumber.trim() && (
                                      <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                                        <div className="flex items-center gap-2">
                                          <span className="text-blue-800 font-medium">Ready to complete</span>
                                          {selectedFile && (
                                            <span className="text-blue-600 text-sm">+ {selectedFile.name}</span>
                                          )}
                                        </div>
                                        <button
                                          onClick={handleUploadProof}
                                          disabled={uploadLoading}
                                          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                                        >
                                          {uploadLoading ? 'Validating...' : 'Complete Program'}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          )}

                          {/* Receipt Validation / Received Success Message */}
                          {stage.stage === 3 && trackingModal.data.beneficiary.receipt_number_validated && (
                            <div className={`mt-4 p-4 rounded-lg border-2 ${
                              trackingModal.data.beneficiary.status === 'Completed' 
                                ? 'bg-green-50 border-green-200'
                                : 'bg-blue-50 border-blue-200'
                            }`}>
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                  trackingModal.data.beneficiary.status === 'Completed'
                                    ? 'bg-green-100'
                                    : 'bg-blue-100'
                                }`}>
                                  <span className={`text-lg ${
                                    trackingModal.data.beneficiary.status === 'Completed'
                                      ? 'text-green-600'
                                      : 'text-blue-600'
                                  }`}>
                                    {trackingModal.data.beneficiary.status === 'Completed' ? '✓' : '⏳'}
                                  </span>
                                </div>
                                <div>
                                  {isNonMonetaryProgram() ? (
                                    <>
                                      {trackingModal.data.beneficiary.status === 'Completed' ? (
                                        <>
                                          <h5 className="text-green-800 font-semibold">Program Completed Successfully!</h5>
                                          <p className="text-green-700 text-sm">
                                            Your receipt of the non-monetary assistance has been verified by the admin. The program is now completed.
                                          </p>
                                        </>
                                      ) : (
                                        <>
                                          <h5 className="text-blue-800 font-semibold">Program Marked as Received!</h5>
                                          <p className="text-blue-700 text-sm">
                                            You have confirmed receipt of the non-monetary assistance. Waiting for admin verification to complete the program.
                                          </p>
                                        </>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      <h5 className="text-green-800 font-semibold">Receipt Number Validated Successfully!</h5>
                                      <p className="text-green-700 text-sm">
                                        Your receipt number <strong>{trackingModal.data.beneficiary.receipt_number}</strong> has been validated. 
                                        The program is now completed.
                                      </p>
                                    </>
                                  )}
                                  {trackingModal.data.beneficiary.proof_comment && (
                                    <div className="mt-2 p-2 bg-white rounded border">
                                      <p className="text-sm text-gray-600">
                                        <strong>Your Comment:</strong> {trackingModal.data.beneficiary.proof_comment}
                                      </p>
                                    </div>
                                  )}
                                  {trackingModal.data.beneficiary.proof_of_payout_url && (
                                    <div className="mt-2">
                                      <a 
                                        href={trackingModal.data.beneficiary.proof_of_payout_url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 underline text-sm"
                                      >
                                        View uploaded proof
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Stage 4: Completed */}
                          {stage.stage === 4 && stage.completed && (
                            <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                              <div className="flex items-center gap-2">
                                <span className="text-green-600 text-xl">🎉</span>
                                <p className="text-green-800 font-medium">Program completed successfully!</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Admin Notes */}
              {trackingModal.data.submission?.admin_notes && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
                  <h4 className="font-bold text-yellow-800 mb-2">Admin Notes</h4>
                  <p className="text-yellow-700">{trackingModal.data.submission.admin_notes}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-8 py-4 rounded-b-3xl">
              <div className="flex justify-end">
                <button
                  onClick={handleCloseTrackingModal}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-xl font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnrolledPrograms;
