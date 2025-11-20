import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate, useLocation } from 'react-router-dom';
import Navbares from '../../components/Navbares';
import Sidebares from '../../components/Sidebares';
import { useAuth } from '../../contexts/AuthContext';
import { SidebarProvider } from '../../contexts/SidebarContext';
import axiosInstance from '../../utils/axiosConfig';
import { isProfileComplete, getMissingFields, getProfileCompletionPercentage, fieldLabels } from '../../utils/profileValidation';
import SecureImage from '../../components/security/SecureImage';
import ProfileCompletionIndicator from '../../components/ProfileCompletionIndicator';
import ResidencyVerification from "./ResidencyVerification";
import {
  User, Mail, Phone, Calendar, Home, MapPin, BadgeCheck,
  Landmark, Cake, Image as ImageIcon, Edit2, Save, X, ArrowLeft, AlertCircle, CheckCircle, Info
} from 'lucide-react';

// Lightweight inline progress component
const ProgressSteps = ({ currentStep = 1, labels = [] }) => {
  const steps = labels.length ? labels : ['Residency Verification', 'Edit Profile', 'Profile Complete'];
  return (
    <div className="flex items-center justify-between select-none" aria-label="Profile progress">
      {steps.map((label, idx) => {
        const stepNum = idx + 1;
        const isActive = currentStep === stepNum;
        const isDone = currentStep > stepNum;
        return (
          <div key={label} className="flex-1 flex items-center">
            <div className="flex items-center gap-3">
              <div className={
                `w-8 h-8 rounded-full flex items-center justify-center border text-xs font-bold ` +
                (isDone
                  ? 'bg-green-600 border-green-600 text-white'
                  : isActive
                  ? 'bg-emerald-100 border-emerald-500 text-emerald-700'
                  : 'bg-gray-100 border-gray-300 text-gray-500')
              }>
                {isDone ? '✓' : stepNum}
              </div>
              <span className={
                'text-sm font-medium ' +
                (isDone ? 'text-green-700' : isActive ? 'text-emerald-700' : 'text-gray-500')
              }>
                {label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={'flex-1 h-0.5 mx-3 ' + (currentStep > stepNum ? 'bg-green-500' : 'bg-gray-200')} />
            )}
          </div>
        );
      })}
    </div>
  );
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
};

const Profile = () => {
  console.log('🔵 Profile: Component is rendering');
  const navigate = useNavigate();
  const location = useLocation();
  const { forceRefresh, user } = useAuth();
  console.log('🔵 Profile: user object:', user);
  console.log('🔵 Profile: user.profile:', user?.profile);
  const [completionPercentage, setCompletionPercentage] = useState(0);
  const [shouldRedirect, setShouldRedirect] = useState(false);

  const [form, setForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    name_suffix: 'none',
    birth_date: '',
    birth_place: '',
    age: '',
    email: '',
    mobile_number: '',
    sex: '',
    civil_status: '',
    religion: '',
    current_address: '',
    years_in_barangay: '',
    voter_status: '',
    current_photo: null,
    resident_id: null, // use resident_id instead of residents_id
    housing_type: '',
    head_of_family: false,
    classified_sector: '',
    educational_attainment: '',
    occupation_type: '',
    business_info: '',
    special_categories: [],
    covid_vaccine_status: '',
    relation_to_head: '',
    nationality: '',
    salary_income: '',
    business_outside_barangay: false,
    business_type: '',
    business_location: '',
    voters_id_number: '',
    voting_location: '',
    other_vaccine: '',
    year_vaccinated: '',
    residency_verification_image: null,
    verification_status: null,
    employment_status: 'manual', // 'manual' or 'na'
  });


  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showImageReminder, setShowImageReminder] = useState(false);
  const [showHousingTypeInfo, setShowHousingTypeInfo] = useState(false);

  // Show Congratulations when profile is completed - use localStorage to track if already shown
  const [showCongrats, setShowCongrats] = useState(() => {
    // Only show if profile is complete AND we haven't shown it before for this session
    const hasShownCongrats = sessionStorage.getItem('congratsShownForSession');
    return !hasShownCongrats;
  });

  // Derived states for progress tracking
  const isVerified = form.verification_status === 'approved' || user?.profile?.verification_status === 'approved';
  const hasProfile = !!form.resident_id;
  const isProfileCompleted = form.profile_completed === true || form.profile_completed === 1 || form.profile_completed === '1';
  const step2Label = hasProfile ? 'Edit Profile' : 'Complete Profile';
  
  // Enhanced profile completion check - consider both database flag and validation
  const isFullyCompleted = isProfileCompleted || (hasProfile && isProfileComplete(form));
  
  // Debug logging for profile completion status
  console.log('Profile completion debug:', {
    resident_id: form.resident_id,
    profile_completed: form.profile_completed,
    verification_status: form.verification_status,
    hasProfile,
    isProfileCompleted,
    isFullyCompleted,
    isProfileCompleteValidation: isProfileComplete(form),
    loading,
    showingCompletedMessage: isFullyCompleted && !loading,
    showingWelcomeMessage: !loading && form.verification_status === 'approved' && !isFullyCompleted
  });
  
  // Updated logic for current step:
  // Step 1: Not verified
  // Step 2: Verified but profile not completed or currently editing
  // Step 3: Verified and profile completed
  const currentStep = !isVerified ? 1 : 
    (!isFullyCompleted || isEditing) ? 2 : 3;

  // Hide progress bar if Congratulations has already been shown
  const hideProgressBar = currentStep === 3 && !showCongrats;
  
  // Show congratulations when profile becomes complete - but only once per session
  useEffect(() => {
    if (isFullyCompleted && !loading && !showCongrats) {
      const hasShownCongrats = sessionStorage.getItem('congratsShownForSession');
      if (!hasShownCongrats) {
        console.log('[DEBUG] Profile is fully completed, showing congratulations');
        setShowCongrats(true);
        sessionStorage.setItem('congratsShownForSession', 'true');
      }
    }
  }, [isFullyCompleted, loading, showCongrats]);

  // Check if user needs to upload profile image and show reminder
  // Only show on the profile page, not on verification/document upload pages
  useEffect(() => {
    // Only show modal if we're on the profile page
    const isOnProfilePage = location.pathname === '/residents/profile';
    
    if (isOnProfilePage && form.verification_status === 'approved' && !loading && !form.current_photo) {
      const hasShownImageReminder = sessionStorage.getItem('imageReminderShown');
      if (!hasShownImageReminder) {
        setShowImageReminder(true);
        sessionStorage.setItem('imageReminderShown', 'true');
      }
    }
  }, [form.verification_status, form.current_photo, loading, location.pathname]);

  const handleGoDashboard = () => {
    setShowCongrats(false);
    navigate('/residents/dashboard');
  };

  // Function to handle edit button click - clear congratulations state
  const handleEditProfile = () => {
    setShowCongrats(false);
    setIsEditing(true);
  };

  // Function to handle image upload reminder - scroll to photo section
  const handleImageUploadReminder = () => {
    setShowImageReminder(false);
    setIsEditing(true);
    // Scroll to photo upload section after a short delay
    setTimeout(() => {
      const photoSection = document.querySelector('[data-photo-section]');
      if (photoSection) {
        photoSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  // Step 3: Profile Completed Screen
  const ProfileCompleted = () => (
    <div className="flex flex-col items-center justify-center w-full py-16">
      <div className="bg-gradient-to-br from-green-100 via-emerald-50 to-blue-100 rounded-3xl shadow-2xl border border-green-200 p-10 max-w-xl w-full flex flex-col items-center animate-fade-in">
        <div className="relative mb-6">
          <SecureImage
            src={form.current_photo
              ? (typeof form.current_photo === 'string'
                  ? `http://localhost:8000/storage/${form.current_photo}`
                  : form.current_photo)
              : 'https://flowbite.com/docs/images/people/profile-picture-5.jpg'}
            alt="Profile Completed"
            className="w-32 h-32 object-cover rounded-full border-4 border-green-400 shadow-lg"
          />
          <div className="absolute -bottom-2 -right-2 bg-green-500 rounded-full p-2 shadow-lg">
            <BadgeCheck className="w-6 h-6 text-white" />
          </div>
        </div>
        <h2 className="text-3xl font-extrabold text-green-800 mb-2 text-center">Congratulations!</h2>
        <p className="text-lg text-green-700 font-semibold mb-4 text-center">
          {form.first_name} {form.middle_name} {form.last_name} {form.name_suffix !== 'none' ? form.name_suffix : ''}, your profile is now complete.
        </p>
        <p className="text-gray-700 text-center mb-6">
          You can now access all barangay services online. Thank you for keeping your information up to date!
        </p>
        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
          <button
            onClick={handleGoDashboard}
            className="bg-gradient-to-r from-green-500 via-green-600 to-emerald-600 hover:from-green-600 hover:via-green-700 hover:to-emerald-700 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg transition-all duration-200 flex items-center gap-3 w-full sm:w-auto justify-center"
          >
            Go to Dashboard
          </button>
          <button
            onClick={() => navigate('/services')}
            className="bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 hover:from-blue-600 hover:via-blue-700 hover:to-indigo-700 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg transition-all duration-200 flex items-center gap-3 w-full sm:w-auto justify-center"
          >
            Request Services
          </button>
        </div>
      </div>
      <style>{`.animate-fade-in{animation:fadeIn 1s ease;}@keyframes fadeIn{from{opacity:0;transform:translateY(40px);}to{opacity:1;transform:translateY(0);}}`}</style>
    </div>
  );

  useEffect(() => {
    setLoading(true);
    setError(null);
    axiosInstance.get('/profile')
      .then(res => {
        const profile = res.data?.user?.profile || res.data?.profile || res.data;
        
        // Handle case where profile doesn't exist yet
        if (!profile) {
          console.log('No profile found, user needs to create one');
          setForm(prev => ({
            ...prev,
            verification_status: null,
            resident_id: null
          }));
          setLoading(false);
          return;
        }
        
        
        
        // If profile is approved and new, set editing mode
        if (profile.verification_status === 'approved' && !profile.profile_completed) {
          setIsEditing(true);
        }
        
        // If profile is approved but profile_completed is null/undefined, also set editing mode
        if (profile.verification_status === 'approved' && (profile.profile_completed === null || profile.profile_completed === undefined)) {
          setIsEditing(true);
        }
        
        setForm(prev => {
          // If the backend returns 'avatar', treat it as 'current_photo' for backward compatibility
          let currentPhoto = profile.current_photo || profile.avatar || null;
          
          const newForm = {
            ...prev,
            ...profile,
            verification_status: profile.verification_status, // Ensure verification status is set
            birth_date: formatDate(profile.birth_date),
            special_categories: Array.isArray(profile.special_categories) ? profile.special_categories : [],
            covid_vaccine_status: profile.covid_vaccine_status || '',
            head_of_family: !!profile.head_of_family,
            business_outside_barangay: !!profile.business_outside_barangay,
            mobile_number: profile.mobile_number ?? profile.contact_number ?? '',
            current_address: profile.current_address ?? profile.full_address ?? '',
            current_photo: currentPhoto,
            // Set employment status based on existing data
            employment_status: (profile.occupation_type === 'Not Applicable' && profile.salary_income === 'N/A') ? 'na' : 'manual',
          };
          
          // Calculate age from birth date if not already set
          if (profile.birth_date && !newForm.age) {
            const birthYear = new Date(profile.birth_date).getFullYear();
            const currentYear = new Date().getFullYear();
            newForm.age = currentYear - birthYear;
          }
          
          
          return newForm;
        });
        // Set isEditing to false if profile is completed
        if (profile.profile_completed === true || profile.profile_completed === '1') {
          setIsEditing(false);
        }
        // Only redirect to /congratulations if not already there and only from the main profile page
        // (No longer needed if using step 3 in Profile.jsx)
      })
      .catch(err => {
        console.error('Profile loading error:', err);
        if (err.response?.status === 401) {
          setError('Session expired. Please login again.');
        } else if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
          setError('Server connection timeout. Please check if the backend server is running.');
        } else {
          setError('Failed to load profile. Please try refreshing the page.');
        }
      })
      .finally(() => setLoading(false));
  // Only run once on mount to prevent repeated API calls and redirect loops
  }, []);

  // Auto-refresh profile when verification is not yet approved
  useEffect(() => {
    // Don't poll if already approved
    if (form.verification_status === 'approved') return;
    
    let isSubscribed = true;
    const interval = setInterval(async () => {
      try {
        const res = await axiosInstance.get('/profile');
        const profile = res.data?.user?.profile || res.data?.profile || res.data;
        if (!profile || !isSubscribed) return;
        
        console.log('Polling profile update:', profile); // Debug log
        
        // If approved, show success and get complete profile data
        if (profile.verification_status === 'approved' && isSubscribed) {
          clearInterval(interval);
          setIsEditing(true); // Set to editing mode immediately
          setSuccess('Your residency has been verified! You can now complete your profile.');
          // Play a success sound
          const audio = new Audio('/sounds/success.mp3');
          
          // Get full profile data
          try {
            const fullProfileRes = await axiosInstance.get('/profile');
            if (fullProfileRes.data) {
              const fullProfile = fullProfileRes.data?.user?.profile || fullProfileRes.data?.profile || fullProfileRes.data;
              setForm(prev => ({
                ...prev,
                ...fullProfile,
                verification_status: 'approved',
                birth_date: formatDate(fullProfile.birth_date),
                special_categories: Array.isArray(fullProfile.special_categories) ? fullProfile.special_categories : [],
                head_of_family: !!fullProfile.head_of_family,
                business_outside_barangay: !!fullProfile.business_outside_barangay,
                mobile_number: fullProfile.mobile_number ?? fullProfile.contact_number ?? '',
                current_address: fullProfile.current_address ?? fullProfile.full_address ?? '',
                current_photo: fullProfile.current_photo || fullProfile.avatar || null,
                employment_status: (fullProfile.occupation_type === 'Not Applicable' && fullProfile.salary_income === 'N/A') ? 'na' : 'manual',
              }));
            }
          } catch (error) {
            console.error('Error fetching full profile:', error);
          }
        } else {
          // Update verification status even when not approved
          setForm(prev => ({
            ...prev,
            verification_status: profile.verification_status,
            residency_verification_image: profile.residency_verification_image
          }));
        }
      } catch (error) {
        console.error('Error polling verification status:', error);
        // Stop polling if there are repeated errors
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
          console.log('Stopping profile polling due to timeout errors');
          clearInterval(interval);
        }
      }
    }, 10000); // Poll every 10 seconds to reduce API calls
    
    return () => clearInterval(interval);
  }, [form.verification_status]);

  // Debug: Log when verification status changes
  useEffect(() => {
    console.log('Profile: form.verification_status changed to:', form.verification_status);
    console.log('Profile: user.profile.verification_status:', user?.profile?.verification_status);
    console.log('Profile: Should show profile form:', form.verification_status === 'approved' || user?.profile?.verification_status === 'approved');
    console.log('Profile: isEditing:', isEditing);
    console.log('Profile: loading:', loading);
  }, [form.verification_status, user?.profile?.verification_status, isEditing, loading]);

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    setForm(prev => {
      const updated = { ...prev };
      if (name === 'birth_date') {
        const birthYear = new Date(value).getFullYear();
        const currentYear = new Date().getFullYear();
        updated.birth_date = value;
        updated.age = currentYear - birthYear;
      } else if (name === 'years_in_barangay') {
        // Validate years in barangay: must be between 0 and person's age (max 100)
        const numValue = parseInt(value);
        const currentAge = updated.age || 0;
        const maxYears = Math.min(currentAge, 100);
        if (value === '' || (numValue >= 0 && numValue <= maxYears)) {
          updated[name] = value;
        }
        // If invalid, don't update the value
      } else if (name === 'special_categories') {
        const updatedSet = new Set(prev[name] || []);
        if (checked) {
          updatedSet.add(value);
        } else {
          updatedSet.delete(value);
        }
        updated[name] = [...updatedSet];
      } else if (type === 'checkbox') {
        updated[name] = checked;
        // Auto-fill "Self" when "Head of the Family" is checked
        if (name === 'head_of_family' && checked) {
          updated.relation_to_head = 'Self';
        }
      } else if (name === 'current_photo' && files?.length > 0) {
        updated.current_photo = files[0];
        // Reset image reminder when photo is uploaded
        setShowImageReminder(false);
      } else if (name === 'residency_verification_image' && files?.length > 0) {
        updated.residency_verification_image = files[0];
      } else {
        updated[name] = value;
      }
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (!form.resident_id && key === 'residents_id') return;
        if (Array.isArray(value)) {
          value.forEach(item => formData.append(`${key}[]`, item));
        } else if (typeof value === 'boolean') {
          formData.append(key, value ? '1' : '0');
        } else if (value instanceof File) {
          formData.append(key, value);
        } else if (value !== null && value !== undefined) {
          formData.append(key, value);
        }
      });
      const updateRes = await axiosInstance.post('/profile/update', formData);
      if (updateRes.data?.resident?.residents_id) {
        localStorage.setItem('residentId', updateRes.data.resident.residents_id);
      }
      setSuccess(updateRes.data?.message || 'Profile saved successfully');
      await forceRefresh();
        // Fetch the latest profile and update form state to ensure step 3 is shown
        try {
          const res = await axiosInstance.get('/profile');
          const profile = res.data?.user?.profile || res.data?.profile || res.data;
          console.log('[DEBUG] Backend profile response after save:', profile);
          if (profile) {
            setForm(prev => {
              let currentPhoto = profile.current_photo || profile.avatar || null;
              const newForm = {
                ...prev,
                ...profile,
                birth_date: formatDate(profile.birth_date),
                special_categories: Array.isArray(profile.special_categories) ? profile.special_categories : [],
                head_of_family: !!profile.head_of_family,
                business_outside_barangay: !!profile.business_outside_barangay,
                mobile_number: profile.mobile_number ?? profile.contact_number ?? '',
                current_address: profile.current_address ?? profile.full_address ?? '',
                current_photo: currentPhoto,
                profile_completed: profile.profile_completed, // Ensure profile_completed status is updated
                employment_status: (profile.occupation_type === 'Not Applicable' && profile.salary_income === 'N/A') ? 'na' : 'manual',
              };
              console.log('[DEBUG] Updated form state after save:', newForm);
              console.log('[DEBUG] Profile completed status:', profile.profile_completed);
              return newForm;
            });
            // Exit editing mode when profile is completed and show congratulations (only if not shown before)
            if (profile.profile_completed === true || profile.profile_completed === 1 || profile.profile_completed === '1') {
              console.log('[DEBUG] Profile is completed, exiting edit mode');
              setIsEditing(false);
              const hasShownCongrats = sessionStorage.getItem('congratsShownForSession');
              if (!hasShownCongrats) {
                console.log('[DEBUG] Showing congratulations for first time');
                setShowCongrats(true);
                sessionStorage.setItem('congratsShownForSession', 'true');
              }
            }
          }
        } catch (e) {
          console.error('[DEBUG] Error fetching updated profile:', e);
          // fallback: always exit editing after save
          setIsEditing(false);
        }
      setTimeout(() => setSuccess(null), 5000);
    } catch (error) {
      const errMsg = error.response?.data?.errors
        ? Object.values(error.response.data.errors)[0][0]
        : error.response?.data?.message || 'Error saving profile. Please try again.';
      setError(errMsg);
    } finally {
      setSubmitting(false);
    }
  };
  // Modern progress bar for loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex flex-col relative overflow-hidden">
        <Navbares />
        <Sidebares />
        
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-40 left-20 w-80 h-80 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-4">
          <div className="w-full max-w-md mx-auto">
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl p-10 border border-white/50">
              {/* Logo or Icon */}
              <div className="flex justify-center mb-8">
                <div className="relative">
                  <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform">
                    <User className="w-10 h-10 text-white" />
                  </div>
                  {/* Pulsing Ring */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-green-400 to-blue-500 animate-ping opacity-20"></div>
                </div>
              </div>

              {/* Animated Progress Bar */}
              <div className="relative h-2.5 w-full bg-gray-200 rounded-full overflow-hidden mb-8 shadow-inner">
                <div className="absolute inset-0 bg-gradient-to-r from-green-400 via-emerald-400 via-blue-400 to-indigo-400 animate-shimmer bg-[length:200%_100%]"></div>
              </div>

              {/* Loading Text */}
              <div className="text-center space-y-4">
                <h3 className="text-2xl font-bold bg-gradient-to-r from-green-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Loading Your Profile
                </h3>
                <div className="flex items-center justify-center gap-1.5">
                  <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-bounce shadow-lg"></div>
                  <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce animation-delay-200 shadow-lg"></div>
                  <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-bounce animation-delay-400 shadow-lg"></div>
                </div>
                <p className="text-gray-600 text-sm font-medium">Please wait while we fetch your information...</p>
              </div>

              {/* Additional Visual Element */}
              <div className="mt-8 flex justify-center gap-2">
                <div className="w-12 h-1 bg-gradient-to-r from-green-400 to-transparent rounded-full animate-pulse"></div>
                <div className="w-12 h-1 bg-gradient-to-r from-blue-400 to-transparent rounded-full animate-pulse animation-delay-200"></div>
                <div className="w-12 h-1 bg-gradient-to-r from-indigo-400 to-transparent rounded-full animate-pulse animation-delay-400"></div>
              </div>
            </div>

            {/* Loading Tips */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500 italic">✨ Setting up your personalized experience...</p>
            </div>
          </div>
        </div>

        {/* Custom CSS for animations */}
        <style>{`
          @keyframes blob {
            0%, 100% { transform: translate(0, 0) scale(1); }
            25% { transform: translate(20px, -50px) scale(1.1); }
            50% { transform: translate(-20px, 20px) scale(0.9); }
            75% { transform: translate(50px, 50px) scale(1.05); }
          }
          @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
          .animate-blob {
            animation: blob 7s infinite;
          }
          .animation-delay-2000 {
            animation-delay: 2s;
          }
          .animation-delay-4000 {
            animation-delay: 4s;
          }
          .animation-delay-200 {
            animation-delay: 0.2s;
          }
          .animation-delay-400 {
            animation-delay: 0.4s;
          }
          .animate-shimmer {
            animation: shimmer 2s linear infinite;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex flex-col font-sans">
      <Navbares />
      <Sidebares />
      
      {/* Image Upload Reminder Modal */}
      <ImageReminderModal 
        isOpen={showImageReminder}
        onClose={() => setShowImageReminder(false)}
        onUpload={handleImageUploadReminder}
      />

      {/* Housing Type Info Modal */}
      {console.log('🏠 Modal state - showHousingTypeInfo:', showHousingTypeInfo)}
      {showHousingTypeInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={(e) => {
          // Close modal when clicking on backdrop
          if (e.target === e.currentTarget) {
            setShowHousingTypeInfo(false);
          }
        }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg">
                  <Home className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold">Housing Type Guide</h3>
              </div>
              <button
                onClick={() => setShowHousingTypeInfo(false)}
                className="hover:bg-white/20 p-2 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              <p className="text-gray-600 mb-6">
                Select the option that best describes your housing situation:
              </p>

              {/* Owner */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-bold text-green-800 mb-2 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Owner
                </h4>
                <p className="text-gray-700 text-sm">
                  You or your family <strong>owns</strong> the house and the land where you live. You have full legal ownership of the property.
                </p>
              </div>

              {/* Private Property with Consent */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Private Property with Consent
                </h4>
                <p className="text-gray-700 text-sm">
                  You live on <strong>private property owned by someone else</strong> (e.g., a relative or friend) <strong>with their permission</strong>. You don't pay rent but have consent to stay there.
                </p>
              </div>

              {/* Owner with Rental */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h4 className="font-bold text-purple-800 mb-2 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Owner with Rental
                </h4>
                <p className="text-gray-700 text-sm">
                  You <strong>own the property</strong> but <strong>rent out a portion</strong> of it to tenants (e.g., you own a house and rent out rooms or a separate unit).
                </p>
              </div>

              {/* Rental House */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h4 className="font-bold text-orange-800 mb-2 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Rental House
                </h4>
                <p className="text-gray-700 text-sm">
                  You <strong>rent</strong> the house or apartment from a landlord. You <strong>pay monthly rent</strong> and have a rental agreement or contract.
                </p>
              </div>

              {/* Private Property without Consent */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-bold text-red-800 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Private Property without Consent
                </h4>
                <p className="text-gray-700 text-sm">
                  You live on <strong>private property owned by someone else without their official permission</strong> (informal settler). This may indicate an informal housing situation.
                </p>
              </div>

              {/* Public Property with Consent */}
              <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
                <h4 className="font-bold text-cyan-800 mb-2 flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  Public Property with Consent
                </h4>
                <p className="text-gray-700 text-sm">
                  You live on <strong>government-owned land</strong> (e.g., land under a socialized housing program) <strong>with official permission</strong> from the government or barangay.
                </p>
              </div>

              {/* Public Property without Consent */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-bold text-amber-800 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Public Property without Consent
                </h4>
                <p className="text-gray-700 text-sm">
                  You live on <strong>government-owned land without official permission</strong> (informal settler on public property). This indicates an informal housing situation on public land.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-2xl">
              <button
                onClick={() => setShowHousingTypeInfo(false)}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg"
              >
                Got it, thanks!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Header */}
      <div className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/residents/dashboard')} 
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold shadow-sm border border-gray-200 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Profile Management</h1>
          <span className="text-xs text-gray-400 font-medium px-4 py-2 rounded-lg bg-gray-50 border border-gray-200">
            {isEditing ? 'Edit Mode' : 'View Mode'}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center w-full py-8">
        <div className="w-full max-w-5xl mx-auto px-2 sm:px-8 lg:px-12 pb-16 flex flex-col items-center justify-center">
          {form.verification_status === 'approved' && (
            <ProfileCompletionIndicator
              percentage={getProfileCompletionPercentage(form)}
              missingFields={getMissingFields(form).map(field => fieldLabels[field])}
            />
          )}
          {/* Progress Steps */}
          {!hideProgressBar && (
            <div className="w-full max-w-2xl mb-6">
              <ProgressSteps currentStep={currentStep} labels={[ 
                'Residency Verification',
                step2Label,
                'Profile Complete'
              ]} />
            </div>
          )}
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3 w-full max-w-2xl mx-auto shadow">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-red-800 font-medium">{error}</p>
                {error.includes('login') && (
                  <button 
                    onClick={() => navigate('/login')}
                    className="text-red-600 underline hover:text-red-800 text-sm mt-1"
                  >
                    Go to Login
                  </button>
                )}
                {error.includes('timeout') && (
                  <button 
                    onClick={() => window.location.reload()}
                    className="text-red-600 underline hover:text-red-800 text-sm mt-1"
                  >
                    Retry Loading Profile
                  </button>
                )}
              </div>
              <button 
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-center gap-3 w-full max-w-2xl mx-auto shadow">
              <BadgeCheck className="w-5 h-5 text-green-500 flex-shrink-0" />
              <p className="text-green-800 font-medium">{success}</p>
              <button 
                onClick={() => setSuccess(null)}
                className="text-green-400 hover:text-green-600 ml-auto"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Welcome Message for New Users - Only show if verification is NOT approved */}
          {!form.resident_id && !loading && form.verification_status !== 'approved' && user?.profile?.verification_status !== 'approved' && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 mb-8 flex items-center gap-4 w-full max-w-2xl mx-auto shadow">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-orange-100">
                <AlertCircle className="w-7 h-7 text-orange-500" />
              </div>
              <div className="flex-1">
                <p className="text-orange-900 font-bold text-lg mb-1">Residency Verification Required</p>
                <p className="text-orange-700 text-sm">
                  To complete your profile and access barangay services, you must first submit a residency verification document. Please upload a clear image of your proof of residency below.
                </p>
              </div>
            </div>
          )}

          {/* Conditional Messages - Only show one at a time */}
          {!loading && isVerified && (
            isFullyCompleted ? (
              /* Profile Completed Message */
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8 flex items-center gap-4 w-full max-w-2xl mx-auto shadow">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100">
                  <CheckCircle className="w-7 h-7 text-green-500" />
                </div>
                <div className="flex-1">
                  <p className="text-green-900 font-bold text-lg mb-1">Profile Complete!</p>
                  <p className="text-green-700 text-sm">
                    Your resident profile has been completed successfully. You now have full access to all barangay services.
                  </p>
                </div>
              </div>
            ) : (
              /* Welcome Message for Approved Users */
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8 flex items-center gap-4 w-full max-w-2xl mx-auto shadow">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100">
                  <User className="w-7 h-7 text-blue-500" />
                </div>
                <div className="flex-1">
                  <p className="text-blue-900 font-bold text-lg mb-1">Welcome! Let's create your profile</p>
                  <p className="text-blue-700 text-sm">
                    Your residency has been verified! Please fill out the form below to complete your resident profile.
                  </p>
                </div>
              </div>
            )
          )}

          {/* Main Profile Content */}
          <div className="w-full max-w-5xl mx-auto">
            {/* Show only residency verification when not verified, full profile when verified */}
            {loading ? (
              // Enhanced loading state while profile data is being fetched
              <div className="bg-white/95 shadow-xl rounded-3xl border border-gray-100 overflow-hidden mt-4 mb-10 relative">
                {/* Animated gradient border */}
                <div className="absolute inset-0 bg-gradient-to-r from-green-400 via-blue-400 to-purple-400 opacity-20 animate-pulse"></div>
                
                <div className="relative p-6 md:p-14">
                  <div className="flex flex-col items-center text-center py-16">
                    {/* Enhanced Spinner */}
                    <div className="relative mb-8">
                      <div className="w-20 h-20 border-4 border-blue-200 rounded-full"></div>
                      <div className="absolute top-0 left-0 w-20 h-20 border-4 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                      <div className="absolute top-2 left-2 w-16 h-16 border-4 border-t-green-400 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin animation-delay-200" style={{ animationDirection: 'reverse' }}></div>
                    </div>

                    {/* Loading Text */}
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-3">
                      Loading Profile...
                    </h3>
                    
                    {/* Animated Dots */}
                    <div className="flex items-center justify-center gap-1.5 mb-4">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce animation-delay-200"></div>
                      <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce animation-delay-400"></div>
                    </div>
                    
                    <p className="text-gray-600 text-sm">Please wait while we load your profile information.</p>
                    
                    {/* Progress Bar */}
                    <div className="w-full max-w-xs mt-6 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 animate-shimmer bg-[length:200%_100%]"></div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (form.verification_status === 'approved' || user?.profile?.verification_status === 'approved') ? (
              // Show profile form when verified
              <>
                {currentStep === 3 && showCongrats ? (
                  <ProfileCompleted />
                ) : (
                  <div className="bg-white/95 shadow-xl rounded-3xl border border-gray-100 overflow-hidden mt-4 mb-10">
                    <div className="p-6 md:p-14">
                      {!isEditing ? (
                        <ReadOnlyView form={form} setIsEditing={setIsEditing} onEditClick={handleEditProfile} />
                      ) : (
                        <EditableForm 
                          form={form} 
                          handleChange={handleChange} 
                          handleSubmit={handleSubmit} 
                          setIsEditing={setIsEditing}
                          submitting={submitting}
                          setShowHousingTypeInfo={setShowHousingTypeInfo}
                        />
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              // Show verification form when not verified
              <div className="bg-white/95 shadow-xl rounded-3xl border border-gray-100 overflow-hidden mt-4 mb-10">
                <div className="p-6 md:p-14">
                  <ResidencyVerification 
                    form={form}
                    profileData={user?.profile || {}} 
                    onImageUpload={(data) => {
                      console.log('✅ Profile: Received verification update from button click:', data);
                      console.log('Profile: Current form.verification_status:', form.verification_status);
                      console.log('Profile: Current isEditing:', isEditing);
                      
                      // If verification is approved, immediately enter edit mode
                      if (data.verification_status === 'approved') {
                        console.log('Profile: ✅ APPROVED! Setting isEditing to TRUE');
                        
                        // Update both states in quick succession
                        setIsEditing(true);
                        
                        // Update form state with the data we received
                        setForm(prev => {
                          const updated = {
                            ...prev,
                            verification_status: 'approved',
                            residency_verification_image: data.residency_verification_image,
                            profile_completed: data.profile_completed
                          };
                          console.log('Profile: ✅ Updated form state to approved:', updated);
                          return updated;
                        });
                        
                        // Also force loading state to false to ensure rendering
                        setLoading(false);
                        
                        console.log('Profile: State updates complete. Should show profile form now.');
                      }
                      
                      // Fetch fresh data in the background
                      // Only fetch if status is approved, otherwise just update with the data we received
                      if (data.verification_status === 'approved') {
                        axiosInstance.get('/profile')
                          .then(res => {
                            const profile = res.data?.user?.profile || res.data?.profile || res.data;
                            if (profile) {
                              console.log('Profile: Fetched fresh data from API:', profile);
                              setForm(prev => ({
                                ...prev,
                                ...profile,
                                verification_status: profile.verification_status || 'approved' // Use actual status from API
                              }));
                            }
                          })
                          .catch(err => console.error('Error refreshing profile:', err));
                      } else {
                        // For pending status, just update the form with the received data
                        // IMPORTANT: Do NOT enable editing mode when status is pending
                        const pendingStatus = data.status || data.verification_status || 'pending';
                        setForm(prev => ({
                          ...prev,
                          verification_status: pendingStatus,
                          residency_verification_image: data.imagePath || data.residency_verification_image
                        }));
                        
                        // Explicitly ensure editing mode is disabled for pending status
                        if (pendingStatus !== 'approved') {
                          setIsEditing(false);
                        }
                      }
                    }}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="h-4"></div>
        </div>
      </main>
    </div>
  );
};

// Image Upload Reminder Modal
const ImageReminderModal = ({ isOpen, onClose, onUpload }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 transform transition-all duration-300 scale-100">
        <div className="p-8 text-center">
          {/* Icon */}
          <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <ImageIcon className="w-10 h-10 text-orange-600" />
          </div>
          
          {/* Title */}
          <h3 className="text-2xl font-bold text-gray-800 mb-4">
            Profile Photo Required
          </h3>
          
          {/* Message */}
          <p className="text-gray-600 mb-8 leading-relaxed">
            To complete your profile, please upload a clear profile photo. This helps us identify you and provides better service.
          </p>
          
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={onUpload}
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
            >
              <ImageIcon className="w-5 h-5" />
              Upload Photo
            </button>
            <button
              onClick={onClose}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-8 py-3 rounded-xl font-semibold transition-all duration-200"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ReadOnlyView = ({ form, setIsEditing, onEditClick }) => {
  // Create a dynamic timestamp for cache-busting that updates when form.current_photo changes
  const avatarTimestamp = React.useMemo(() => Date.now(), [form.current_photo]);

  // Safe setter that only allows editing when verification is approved
  const safeSetIsEditing = (value) => {
    if (value === true && form.verification_status !== 'approved') {
      return; // Prevent editing if not verified
    }
    if (value === true && onEditClick) {
      onEditClick(); // Use the custom edit handler
    } else {
      setIsEditing(value);
    }
  };

  return (
    <div className="flex flex-col items-center">
      {/* Profile Header Section */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-8 rounded-2xl border border-green-100 shadow-lg w-full mb-8">
        <div className="flex flex-col items-center space-y-6">
          {/* Avatar */}
          <div className="relative">
            <img
              src={
                form.current_photo
                  ? (typeof form.current_photo === 'string'
                      ? `http://localhost:8000/storage/${form.current_photo}?t=${avatarTimestamp}`
                      : URL.createObjectURL(form.current_photo))
                  : 'https://flowbite.com/docs/images/people/profile-picture-5.jpg'
              }
              alt="Avatar"
              className={`w-32 h-32 object-cover rounded-full border-4 shadow-xl ${
                form.current_photo ? 'border-green-300' : 'border-orange-300'
              }`}
              onError={(e) => {
                console.log('ReadOnlyView avatar load error:', e.target.src);
                e.target.onerror = null;
                e.target.src = 'https://flowbite.com/docs/images/people/profile-picture-5.jpg';
              }}
            />
            <div className={`absolute -bottom-2 -right-2 rounded-full p-2 shadow-lg ${
              form.current_photo ? 'bg-green-500' : 'bg-orange-500'
            }`}>
              {form.current_photo ? (
                <User className="w-4 h-4 text-white" />
              ) : (
                <ImageIcon className="w-4 h-4 text-white" />
              )}
            </div>
            {!form.current_photo && (
              <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs px-2 py-1 rounded-full font-bold animate-pulse">
                Upload Required
              </div>
            )}
          </div>

          {/* Name and ID */}
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-extrabold text-green-800">
              {form.first_name || 'First Name'} {form.middle_name || 'Middle Name'} {form.last_name || 'Last Name'} {form.name_suffix && form.name_suffix !== 'none' ? form.name_suffix : ''}
            </h2>

            {(form.resident_id || form.residents_id || form.id) && (
              <div className="flex items-center justify-center gap-2">
                <BadgeCheck className="w-5 h-5 text-green-600" />
                <span className="bg-green-100 text-green-700 px-4 py-2 text-sm rounded-full font-semibold shadow-sm">
                  Resident ID: {form.resident_id || form.residents_id || form.id}
                </span>
              </div>
            )}
            
            {/* Debug: Show all ID fields for troubleshooting */}
            {!form.resident_id && !form.residents_id && !form.id && (
              <div className="text-xs text-gray-400 mt-2">
                Debug: resident_id: {form.resident_id || 'null'}, residents_id: {form.residents_id || 'null'}, id: {form.id || 'null'}
              </div>
            )}

            <p className="text-sm text-gray-600 flex items-center justify-center gap-2">
              <Mail className="w-4 h-4" />
              {form.email || '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Information Sections */}
      <div className="w-full space-y-6">
      {/* Personal Information */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-green-800 flex items-center gap-2">
            <User className="w-5 h-5" />
            Personal Information
          </h3>
          {form.verification_status === 'approved' && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <p className="text-xs text-green-700 font-medium">
                ✏️ Click "Edit Profile" to correct any misspelled names
              </p>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <InfoCard icon={<User className="w-5 h-5" />} label="First Name" value={form.first_name || '—'} />
          <InfoCard icon={<User className="w-5 h-5" />} label="Middle Name" value={form.middle_name || '—'} />
          <InfoCard icon={<User className="w-5 h-5" />} label="Last Name" value={form.last_name || '—'} />
          <InfoCard icon={<User className="w-5 h-5" />} label="Name Suffix" value={form.name_suffix && form.name_suffix !== 'none' ? form.name_suffix : '—'} />
          <InfoCard
            icon={<Calendar className="w-5 h-5" />}
            label="Birthdate"
            value={form.birth_date ? new Date(form.birth_date).toLocaleDateString('en-PH', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }) : '—'}
          />
          <InfoCard icon={<Cake className="w-5 h-5" />} label="Age" value={form.age || '—'} />
          <InfoCard icon={<User className="w-5 h-5" />} label="Sex" value={form.sex || '—'} />
          <InfoCard icon={<MapPin className="w-5 h-5" />} label="Birth Place" value={form.birth_place || '—'} />
          <InfoCard icon={<User className="w-5 h-5" />} label="Nationality" value={form.nationality || '—'} />
          <InfoCard icon={<Phone className="w-5 h-5" />} label="Mobile Number" value={form.mobile_number || '—'} />
          <InfoCard icon={<Landmark className="w-5 h-5" />} label="Civil Status" value={form.civil_status || '—'} />
          <InfoCard icon={<MapPin className="w-5 h-5" />} label="Religion" value={form.religion || '—'} />
          <InfoCard icon={<User className="w-5 h-5" />} label="Relation to Head" value={form.relation_to_head || '—'} />
          <InfoCard icon={<Home className="w-5 h-5" />} label="Years in Barangay" value={form.years_in_barangay || '—'} />
        </div>
      </div>

      {/* Address Information */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="text-xl font-bold text-green-800 mb-6 flex items-center gap-2">
          <Home className="w-5 h-5" />
          Address Information
        </h3>
        <div className="space-y-4">
            <InfoCard
              icon={<Home className="w-5 h-5" />}
              label="Current Address"
              value={form.current_address || '—'}
              fullWidth
            />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoCard icon={<Home className="w-5 h-5" />} label="Housing Type" value={form.housing_type || '—'} />
            <InfoCard icon={<User className="w-5 h-5" />} label="Head of Family" value={form.head_of_family ? 'Yes' : 'No'} />
          </div>
        </div>
      </div>

      {/* Education */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="text-xl font-bold text-green-800 mb-6 flex items-center gap-2">
          <Landmark className="w-5 h-5" />
          Education
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoCard icon={<User className="w-5 h-5" />} label="Educational Attainment" value={form.educational_attainment || '—'} />
          <InfoCard icon={<User className="w-5 h-5" />} label="Classified Sector" value={form.classified_sector || '—'} />
        </div>
      </div>

      {/* Employment */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="text-xl font-bold text-green-800 mb-6 flex items-center gap-2">
          💼 Employment
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <InfoCard icon={<User className="w-5 h-5" />} label="Occupation Type" value={form.occupation_type || '—'} />
          <InfoCard icon={<User className="w-5 h-5" />} label="Salary/Income" value={form.salary_income || '—'} />
        </div>
      </div>

      {/* Business Information */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="text-xl font-bold text-green-800 mb-6 flex items-center gap-2">
          💼 Business Information
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <InfoCard icon={<User className="w-5 h-5" />} label="Business Info" value={form.business_info || '—'} />
          <InfoCard icon={<User className="w-5 h-5" />} label="Business Type" value={form.business_type || '—'} />
          <InfoCard icon={<MapPin className="w-5 h-5" />} label="Business Location" value={form.business_location || '—'} />
          <InfoCard icon={<User className="w-5 h-5" />} label="Outside Barangay?" value={form.business_outside_barangay ? 'Yes' : 'No'} />
        </div>
      </div>

      {/* Voter Information */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="text-xl font-bold text-green-800 mb-6 flex items-center gap-2">
          <BadgeCheck className="w-5 h-5" />
          Voter Information
        </h3>
        {form.age >= 1 && form.age <= 14 ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-blue-800 font-semibold mb-1">Voter Information Not Available</p>
                <p className="text-blue-700 text-sm">
                  Voter information is not available for residents aged 1-14 years old. 
                  Residents aged 15-17 are eligible for Sangguniang Kabataan (SK) elections, 
                  while those 18 years old and above are eligible to vote in both SK and regular elections 
                  (including national positions such as President).
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoCard icon={<BadgeCheck className="w-5 h-5" />} label="Voter Status" value={form.voter_status || '—'} />
            <InfoCard icon={<BadgeCheck className="w-5 h-5" />} label="Voter's ID" value={form.voters_id_number || '—'} />
            <InfoCard icon={<MapPin className="w-5 h-5" />} label="Precinct No." value={form.voting_location || '—'} />
          </div>
        )}
      </div>

      {/* Special Categories */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="text-xl font-bold text-green-800 mb-6 flex items-center gap-2">
          ⚠️ Special Categories
        </h3>
        {form.special_categories?.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {form.special_categories.map((cat, idx) => (
              <div key={idx} className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-green-800">{cat}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">No special categories</p>
          </div>
        )}
      </div>

      {/* COVID Vaccination */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="text-xl font-bold text-green-800 mb-6 flex items-center gap-2">
          💉 COVID Vaccination
        </h3>
        {form.covid_vaccine_status ? (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm font-medium text-blue-800">{form.covid_vaccine_status}</span>
            </div>
            {(form.other_vaccine || form.year_vaccinated) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                {form.other_vaccine && (
                  <InfoCard icon={<User className="w-4 h-4" />} label="Other Vaccine" value={form.other_vaccine} />
                )}
                {form.year_vaccinated && (
                  <InfoCard icon={<Calendar className="w-4 h-4" />} label="Year Vaccinated" value={form.year_vaccinated} />
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-red-400" />
            </div>
            <p className="text-gray-500 font-medium">Not Vaccinated</p>
          </div>
        )}
      </div>
    </div>

    {/* Edit Button - Only shown when verification is approved */}
    {form.verification_status === 'approved' && (
      <div className="mt-10 flex justify-center">
        {form.resident_id ? (
          <button
            onClick={() => safeSetIsEditing(true)}
            className="bg-gradient-to-r from-green-500 via-green-600 to-emerald-600 hover:from-green-600 hover:via-green-700 hover:to-emerald-700 text-white px-10 py-5 rounded-2xl font-bold text-lg shadow-2xl transition-all duration-300 transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-green-300 focus:ring-opacity-50 flex items-center gap-3 border-2 border-green-400 hover:border-green-300 relative overflow-hidden group"
            style={{
              boxShadow: '0 10px 40px rgba(34, 197, 94, 0.3), 0 0 0 1px rgba(34, 197, 94, 0.1)',
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <Edit2 className="w-6 h-6 relative z-10" />
            <span className="relative z-10">Edit Profile</span>
            <div className="absolute -right-2 -top-2 w-4 h-4 bg-yellow-400 rounded-full animate-pulse"></div>
          </button>
        ) : (
          <button
            onClick={() => safeSetIsEditing(true)}
            className="bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 hover:from-blue-600 hover:via-blue-700 hover:to-indigo-700 text-white px-10 py-5 rounded-2xl font-bold text-lg shadow-2xl transition-all duration-300 transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-blue-300 focus:ring-opacity-50 flex items-center gap-3 border-2 border-blue-400 hover:border-blue-300 relative overflow-hidden group"
            style={{
              boxShadow: '0 10px 40px rgba(59, 130, 246, 0.3), 0 0 0 1px rgba(59, 130, 246, 0.1)',
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <User className="w-6 h-6 relative z-10" />
            <span className="relative z-10">Complete Profile</span>
            <div className="absolute -right-2 -top-2 w-4 h-4 bg-blue-400 rounded-full animate-pulse"></div>
          </button>
        )}
      </div>
    )}
    
    {/* Verification Status Message */}
    {form.verification_status !== 'approved' && (
      <div className="mt-10 flex justify-center">
        <div className="bg-orange-50 border border-orange-200 text-orange-700 px-10 py-5 rounded-2xl font-bold text-lg flex items-center gap-3">
          <AlertCircle className="w-6 h-6" />
          Profile editing is disabled until residency verification is approved
        </div>
      </div>
    )}
    </div>
  );
};

// Enhanced InfoCard component for better visual presentation
const InfoCard = ({ icon, label, value, fullWidth = false }) => (
  <div className={`${fullWidth ? 'col-span-full' : ''} bg-gray-50 border border-gray-200 rounded-lg p-4 hover:bg-gray-100 transition-colors duration-200`}>
    <div className="flex items-start gap-3">
      <div className="text-green-600 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
        <p className="text-sm font-medium text-gray-900 break-words">{value}</p>
      </div>
    </div>
  </div>
);

const EditableForm = ({ form, handleChange, handleSubmit, setIsEditing, submitting, setShowHousingTypeInfo }) => {
  // Check if business information is marked as "Not Applicable"
  const isBusinessNA = form.business_info === 'N/A' && form.business_type === 'N/A' && form.business_location === 'N/A';
  // Business fields are disabled when Business Information itself is set to "Not Applicable"
  const areBusinessFieldsDisabled = isBusinessNA;

  // Updated required fields configuration based on requirements
  const requiredFields = {
    personal: [
      'first_name', 'last_name', 'birth_date', 'birth_place', 'sex', 'civil_status', 'religion', 
      'nationality', 'relation_to_head', 'email', 'mobile_number'
    ],
    address: [
      'current_address', 'years_in_barangay'
    ],
    education: [
      'educational_attainment', 'classified_sector'
    ],
    employment: [
      'occupation_type', 'salary_income'
    ],
    voter: [
      'voter_status', 'voters_id_number', 'voting_location'
    ],
    profile: [
      'current_photo'
    ]
  };

  // Check if age is between 1-14 (voter information should be disabled)
  const age = form.age || 0;
  const isVoterInfoDisabled = age >= 1 && age <= 14;

  // Flatten all required fields for validation
  // Exclude voter fields if age is 1-14
  const allRequiredFields = [
    ...requiredFields.personal,
    ...requiredFields.address,
    ...requiredFields.education,
    ...requiredFields.employment,
    // Only include voter fields if age is 15 or above
    ...(isVoterInfoDisabled ? [] : requiredFields.voter),
    ...requiredFields.profile
  ];

  // Find missing required fields
  const missingFields = allRequiredFields.filter(field => {
    if (field === 'current_photo') {
      return !form.current_photo;
    }
    return !form[field] || (typeof form[field] === 'string' && form[field].trim() === '');
  });

  // Map field names to readable labels
  const fieldLabels = {
    first_name: 'First Name',
    last_name: 'Last Name',
    birth_date: 'Birth Date',
    birth_place: 'Birth Place',
    sex: 'Sex',
    civil_status: 'Civil Status',
    religion: 'Religion',
    nationality: 'Nationality',
    relation_to_head: 'Relation to Head',
    email: 'Email',
    mobile_number: 'Mobile Number',
    current_address: 'Current Address',
    years_in_barangay: 'Years in Barangay',
    voter_status: 'Voter Status',
    voters_id_number: 'Voter\'s ID Number',
    voting_location: 'Precinct No.',
    classified_sector: 'Classified Sector',
    educational_attainment: 'Educational Attainment',
    occupation_type: 'Occupation Type',
    salary_income: 'Salary/Income',
    current_photo: 'Profile Photo',
  };

  // Validate mobile number format
  const isMobileNumberValid = !form.mobile_number || (form.mobile_number.length === 11 && form.mobile_number.startsWith('09') && /^09[0-9]{9}$/.test(form.mobile_number));
  
  // Validate birth date (must be in the past, not today or future)
  const isBirthDateValid = !form.birth_date || new Date(form.birth_date) < new Date(new Date().setHours(0,0,0,0));
  
  // Validate years in barangay (must be between 0 and person's age, and not exceed 100)
  const currentAge = form.age || 0;
  const maxYearsInBarangay = Math.min(currentAge, 100);
  const isYearsInBarangayValid = !form.years_in_barangay || (form.years_in_barangay >= 0 && form.years_in_barangay <= maxYearsInBarangay);
  
  // Prevent submit if missing required fields, mobile number is invalid, birth date is invalid, or years in barangay is invalid
  const canSubmit = missingFields.length === 0 && isMobileNumberValid && isBirthDateValid && isYearsInBarangayValid;

  // Helper function to check if a field is required
  const isFieldRequired = (fieldName) => allRequiredFields.includes(fieldName);

  // Helper function to get field validation class
  const getFieldValidationClass = (fieldName) => {
    const isRequired = isFieldRequired(fieldName);
    const isEmpty = !form[fieldName] || (typeof form[fieldName] === 'string' && form[fieldName].trim() === '');
    const hasError = isRequired && isEmpty;
    
    return hasError 
      ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
      : 'border-gray-300 focus:ring-green-500 focus:border-green-500';
  };
  // Safety check: if verification is not approved, don't render the form
  if (form.verification_status !== 'approved') {
    return (
      <div className="w-full text-center py-12">
        <div className="flex flex-col items-center gap-4">
          <AlertCircle className="w-16 h-16 text-orange-500" />
          <h3 className="text-xl font-bold text-orange-900">Profile Editing Restricted</h3>
          <p className="text-orange-700 max-w-md">
            You must complete residency verification before you can edit your profile.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
    {/* Reminder Notice */}
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6 w-full shadow">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <AlertCircle className="w-6 h-6 text-blue-500" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-blue-800 mb-2">Profile Completion Reminder</h3>
          <p className="text-blue-700 font-medium mb-3">
            Please complete all required fields in your profile. Personal Information must be fully filled out except Middle Name and Suffix.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-600">
            <div>
              <p className="font-semibold mb-1">Required Sections:</p>
              <ul className="list-disc ml-4 space-y-1">
                <li>Personal Information (except Middle Name & Suffix)</li>
                <li>Address Information (except Housing Type)</li>
                <li>Education & Employment (except Business fields)</li>
                <li>Voter Information (all fields)</li>
                <li>Profile Photo</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold mb-1">Optional Fields:</p>
              <ul className="list-disc ml-4 space-y-1">
                <li>Middle Name & Name Suffix</li>
                <li>Housing Type</li>
                <li>Business Information fields</li>
                <li>Special Categories</li>
                <li>COVID Vaccination</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Missing Fields Warning */}
    {missingFields.length > 0 && (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3 w-full shadow">
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-red-800 font-medium">Please complete all required fields to finish your profile:</p>
          <ul className="list-disc ml-6 text-red-700 text-sm mt-2">
            {missingFields.map(field => (
              <li key={field}>{fieldLabels[field] || field}</li>
            ))}
          </ul>
        </div>
      </div>
    )}

    {/* Mobile Number Validation Warning */}
    {!isMobileNumberValid && form.mobile_number && (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3 w-full shadow">
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-red-800 font-medium">Invalid mobile number format:</p>
          <p className="text-red-700 text-sm mt-1">
            Mobile number must be exactly 11 digits and start with "09" (e.g., 09123456789)
          </p>
        </div>
      </div>
    )}

    {/* Birth Date Validation Warning */}
    {!isBirthDateValid && form.birth_date && (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3 w-full shadow">
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-red-800 font-medium">Invalid birth date:</p>
          <p className="text-red-700 text-sm mt-1">
            Birth date must be in the past (not today or future)
          </p>
        </div>
      </div>
    )}

    {/* Years in Barangay Validation Warning */}
    {!isYearsInBarangayValid && form.years_in_barangay && (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3 w-full shadow">
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-red-800 font-medium">Invalid years in barangay:</p>
          <p className="text-red-700 text-sm mt-1">
            Years in barangay must be between 0 and {maxYearsInBarangay}
            {currentAge > 0 && ` (cannot exceed your current age of ${currentAge})`}
          </p>
        </div>
      </div>
    )}
    
    {/* Profile Picture Section */}
    <div className="flex flex-col items-center w-full" data-photo-section>
      <div className={`w-full rounded-xl flex flex-col items-center py-10 mb-8 shadow-sm ${
        isFieldRequired('current_photo') && !form.current_photo 
          ? 'bg-red-50 border-2 border-red-200' 
          : 'bg-green-50'
      }`}>
        <div className="relative mb-6">
          {form.current_photo ? (
            <img
              src={typeof form.current_photo === 'string'
                ? `http://localhost:8000/storage/${form.current_photo}?t=${Date.now()}`
                : URL.createObjectURL(form.current_photo)}
              alt="Profile Photo"
              className={`w-32 h-32 object-cover rounded-full border-4 shadow-lg ${
                isFieldRequired('current_photo') && !form.current_photo 
                  ? 'border-red-400' 
                  : 'border-green-400'
              }`}
            />
          ) : (
            <div className={`w-32 h-32 rounded-full border-4 flex items-center justify-center ${
              isFieldRequired('current_photo') && !form.current_photo 
                ? 'bg-red-100 border-red-300' 
                : 'bg-green-100 border-green-300'
            }`}>
              <ImageIcon className={`w-14 h-14 ${
                isFieldRequired('current_photo') && !form.current_photo 
                  ? 'text-red-400' 
                  : 'text-green-400'
              }`} />
            </div>
          )}
        </div>
        <div className="text-center mb-4">
          <label className="text-sm font-semibold text-gray-700">
            Profile Photo
            {isFieldRequired('current_photo') && <span className="text-red-500 ml-1">*</span>}
          </label>
          {isFieldRequired('current_photo') && !form.current_photo && (
            <div className="text-xs text-red-600 mt-1">
              This field is required
            </div>
          )}
        </div>
        <label className="cursor-pointer bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-xl text-base font-bold shadow-lg transition-all duration-200">
          <input
            type="file"
            name="current_photo"
            onChange={handleChange}
            accept="image/*"
            className="hidden"
            required={isFieldRequired('current_photo')}
          />
          <div className="flex items-center gap-3">
            <ImageIcon className="w-5 h-5" />
            Upload Profile Photo
          </div>
        </label>
      </div>
    </div>

    

    {/* Personal Information Section */}
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-green-800 flex items-center gap-2">
          <User className="w-5 h-5" />
          Personal Information
        </h3>
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <p className="text-xs text-blue-700 font-medium">
            💡 You can correct any misspelled names from registration
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {['first_name', 'middle_name', 'last_name', 'name_suffix'].map(name => {
          const isRequired = isFieldRequired(name);
          return (
            <div key={name} className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 tracking-wide">
                {name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                {isRequired ? (
                  <span className="text-red-500 ml-1">*</span>
                ) : (
                  <span className="text-gray-400 ml-1 text-xs">(Optional)</span>
                )}
              </label>
              {name === 'name_suffix' ? (
                <select
                  name={name}
                  value={form[name] ?? 'none'}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 transition-all duration-200 shadow-sm hover:shadow-md ${getFieldValidationClass(name)}`}
                >
                  <option value="none">None</option>
                  <option value="Jr.">Jr.</option>
                  <option value="Sr.">Sr.</option>
                  <option value="II">II</option>
                  <option value="III">III</option>
                  <option value="IV">IV</option>
                </select>
              ) : (
                <input
                  type="text"
                  name={name}
                  value={form[name] ?? ''}
                  onChange={handleChange}
                  placeholder={`Enter ${name.replace(/_/g, ' ')}`}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 transition-all duration-200 shadow-sm hover:shadow-md ${getFieldValidationClass(name)}`}
                  required={isRequired}
                />
              )}
              {name === 'name_suffix' && (
                <div className="text-xs text-gray-500 mt-1">
                  Select from: None, Jr., Sr., II, III, IV
                </div>
              )}
              {isRequired && !form[name] && (
                <div className="text-xs text-red-600 mt-1">
                  This field is required
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">
            Birth Date
            {isFieldRequired('birth_date') && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            type="date"
            name="birth_date"
            value={form.birth_date || ''}
            onChange={handleChange}
            max={new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 transition-all duration-200 shadow-sm hover:shadow-md ${getFieldValidationClass('birth_date')}`}
            title="Birth date must be in the past (not today or future)"
            required={isFieldRequired('birth_date')}
          />
          {form.birth_date && new Date(form.birth_date) >= new Date(new Date().setHours(0,0,0,0)) && (
            <div className="text-xs text-red-600">
              Birth date must be in the past (not today or future)
            </div>
          )}
          {isFieldRequired('birth_date') && !form.birth_date && (
            <div className="text-xs text-red-600">
              This field is required
            </div>
          )}
          {form.age && (
            <p className="text-xs text-green-600 font-medium">
              Age: <span className="font-bold">{form.age} years old</span>
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">
            Birth Place
            {isFieldRequired('birth_place') && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            type="text"
            name="birth_place"
            value={form.birth_place}
            onChange={handleChange}
            placeholder="Enter birth place"
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 transition-all duration-200 shadow-sm hover:shadow-md ${getFieldValidationClass('birth_place')}`}
            required={isFieldRequired('birth_place')}
          />
          {isFieldRequired('birth_place') && !form.birth_place && (
            <div className="text-xs text-red-600">
              This field is required
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">Age</label>
          <input
            type="text"
            name="age"
            value={form.age}
            readOnly
            className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">
            Email
            {isFieldRequired('email') && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="Enter email address"
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 transition-all duration-200 shadow-sm hover:shadow-md ${getFieldValidationClass('email')}`}
            required={isFieldRequired('email')}
          />
          {isFieldRequired('email') && !form.email && (
            <div className="text-xs text-red-600">
              This field is required
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">
            Mobile Number
            {isFieldRequired('mobile_number') && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            type="tel"
            name="mobile_number"
            value={form.mobile_number}
            onChange={handleChange}
            placeholder="e.g. 09123456789"
            maxLength="11"
            pattern="09[0-9]{9}"
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 transition-all duration-200 shadow-sm hover:shadow-md ${getFieldValidationClass('mobile_number')}`}
            title="Please enter a valid 11-digit mobile number starting with 09"
            required={isFieldRequired('mobile_number')}
          />
          {form.mobile_number && !(form.mobile_number.length === 11 && form.mobile_number.startsWith('09') && /^09[0-9]{9}$/.test(form.mobile_number)) && (
            <div className="text-xs">
              <span className="text-red-600">
                Mobile number must be 11 digits and start with 09
              </span>
            </div>
          )}
          {isFieldRequired('mobile_number') && !form.mobile_number && (
            <div className="text-xs text-red-600">
              This field is required
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">
            Sex
            {isFieldRequired('sex') && <span className="text-red-500 ml-1">*</span>}
          </label>
          <select
            name="sex"
            value={form.sex}
            onChange={handleChange}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 transition-all duration-200 shadow-sm hover:shadow-md ${getFieldValidationClass('sex')}`}
            required={isFieldRequired('sex')}
          >
            <option value="">Select Sex</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
          {isFieldRequired('sex') && !form.sex && (
            <div className="text-xs text-red-600">
              This field is required
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">
            Civil Status
            {isFieldRequired('civil_status') && <span className="text-red-500 ml-1">*</span>}
          </label>
          <select
            name="civil_status"
            value={form.civil_status}
            onChange={handleChange}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 transition-all duration-200 shadow-sm hover:shadow-md ${getFieldValidationClass('civil_status')}`}
            required={isFieldRequired('civil_status')}
          >
            <option value="">Select Civil Status</option>
            <option value="Single">Single</option>
            <option value="Married">Married</option>
            <option value="Widow">Widow</option>
            <option value="Separated">Separated</option>
          </select>
          {isFieldRequired('civil_status') && !form.civil_status && (
            <div className="text-xs text-red-600">
              This field is required
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">
            Nationality
            {isFieldRequired('nationality') && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            type="text"
            name="nationality"
            value={form.nationality}
            onChange={handleChange}
            placeholder="e.g. Filipino"
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 transition-all duration-200 shadow-sm hover:shadow-md ${getFieldValidationClass('nationality')}`}
            required={isFieldRequired('nationality')}
          />
          {isFieldRequired('nationality') && !form.nationality && (
            <div className="text-xs text-red-600">
              This field is required
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">
            Religion
            {isFieldRequired('religion') && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            type="text"
            name="religion"
            value={form.religion}
            onChange={handleChange}
            placeholder="e.g. Roman Catholic"
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 transition-all duration-200 shadow-sm hover:shadow-md ${getFieldValidationClass('religion')}`}
            required={isFieldRequired('religion')}
          />
          {isFieldRequired('religion') && !form.religion && (
            <div className="text-xs text-red-600">
              This field is required
            </div>
          )}
        </div>
      </div>

      {/* Relation to Head field */}
      <div className="mt-6">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">
            Relation to the Head of the Family
            {isFieldRequired('relation_to_head') && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            type="text"
            name="relation_to_head"
            value={form.relation_to_head || ''}
            onChange={handleChange}
            placeholder="e.g., Daughter, Son, Father, Self"
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 transition-all duration-200 shadow-sm hover:shadow-md ${getFieldValidationClass('relation_to_head')}`}
            required={isFieldRequired('relation_to_head')}
          />
          {isFieldRequired('relation_to_head') && !form.relation_to_head && (
            <div className="text-xs text-red-600">
              This field is required
            </div>
          )}
        </div>
      </div>

      {/* Head of Family checkbox */}
      <div className="mt-6">
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              name="head_of_family"
              checked={!!form.head_of_family}
              onChange={handleChange}
              className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
            />
            <span className="text-sm font-semibold text-gray-700">Head of the Family</span>
          </label>
        </div>
      </div>
    </div>

    {/* Address Section */}
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
      <h3 className="text-xl font-bold text-green-800 mb-6 flex items-center gap-2">
        <Home className="w-5 h-5" />
        Address Information
      </h3>
      
      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">
            Current Address
            {isFieldRequired('current_address') && <span className="text-red-500 ml-1">*</span>}
          </label>
          <textarea
            name="current_address"
            value={form.current_address}
            onChange={handleChange}
            rows={3}
            placeholder="e.g. Purok 2, Brgy. San Isidro, Sta. Maria, Bulacan"
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 transition-all duration-200 shadow-sm hover:shadow-md resize-none ${getFieldValidationClass('current_address')}`}
            required={isFieldRequired('current_address')}
          />
          {isFieldRequired('current_address') && !form.current_address && (
            <div className="text-xs text-red-600">
              This field is required
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">
              Years in Barangay
              {isFieldRequired('years_in_barangay') && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="number"
              name="years_in_barangay"
              value={form.years_in_barangay ?? ''}
              onChange={handleChange}
              placeholder="e.g. 5"
              min="0"
              max={maxYearsInBarangay}
              step="1"
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 transition-all duration-200 shadow-sm hover:shadow-md ${getFieldValidationClass('years_in_barangay')}`}
              required={isFieldRequired('years_in_barangay')}
            />
            <div className="text-xs text-gray-500">
              Enter number of years (0-{maxYearsInBarangay})
              {currentAge > 0 && (
                <span className="text-blue-600 font-medium"> • Cannot exceed your current age ({currentAge})</span>
              )}
            </div>
            {isFieldRequired('years_in_barangay') && !form.years_in_barangay && (
              <div className="text-xs text-red-600">
                This field is required
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              Housing Type
              <span className="text-gray-400 ml-1 text-xs">(Optional)</span>
              <button
                type="button"
                onClick={() => {
                  console.log('Info button clicked!');
                  setShowHousingTypeInfo(true);
                  console.log('showHousingTypeInfo set to true');
                }}
                className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 transition-colors duration-200"
                title="Click for more information"
              >
                <Info className="w-3 h-3" />
              </button>
            </label>
            <select
              name="housing_type"
              value={form.housing_type}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <option value="">Select Housing Type</option>
              <option>Owner</option>
              <option>Private Property with Consent</option>
              <option>Owner with Rental</option>
              <option>Rental House</option>
              <option>Private Property without Consent</option>
              <option>Public Property with Consent</option>
              <option>Public Property without Consent</option>
            </select>
          </div>

        </div>

      </div>
    </div>

    {/* Education Section */}
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
      <h3 className="text-xl font-bold text-green-800 mb-6 flex items-center gap-2">
        <Landmark className="w-5 h-5" />
        Education
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">
            Educational Attainment
            {isFieldRequired('educational_attainment') && <span className="text-red-500 ml-1">*</span>}
          </label>
          <select
            name="educational_attainment"
            value={form.educational_attainment}
            onChange={handleChange}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 transition-all duration-200 shadow-sm hover:shadow-md ${getFieldValidationClass('educational_attainment')}`}
            required={isFieldRequired('educational_attainment')}
          >
            <option value="">Select Education</option>
            <option>Primary</option>
            <option>Secondary</option>
            <option>Tertiary</option>
            <option>Post Graduate</option>
            <option>Not Applicable</option>
          </select>
          {isFieldRequired('educational_attainment') && !form.educational_attainment && (
            <div className="text-xs text-red-600">
              This field is required
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">
            Classified Sector
            {isFieldRequired('classified_sector') && <span className="text-red-500 ml-1">*</span>}
          </label>
          <select
            name="classified_sector"
            value={form.classified_sector}
            onChange={handleChange}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 transition-all duration-200 shadow-sm hover:shadow-md ${getFieldValidationClass('classified_sector')}`}
            required={isFieldRequired('classified_sector')}
          >
            <option value="">Select Sector</option>
            <option>Labor Force/Employed</option>
            <option>Self-Employed</option>
            <option>Unemployed</option>
            <option>Student</option>
            <option>Out-of-School Youth (OSY)</option>
            <option>Out-of-School Children (OSC)</option>
            <option>Not Applicable</option>
          </select>
          {isFieldRequired('classified_sector') && !form.classified_sector && (
            <div className="text-xs text-red-600">
              This field is required
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Employment Section */}
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
      <h3 className="text-xl font-bold text-green-800 mb-6 flex items-center gap-2">
        💼 Employment
      </h3>
      
      {/* N/A Option */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="employment_na"
            checked={form.employment_status === 'na'}
            onChange={(e) => {
              if (e.target.checked) {
                handleChange({
                  target: {
                    name: 'employment_status',
                    value: 'na'
                  }
                });
                // Auto-fill with N/A values
                setTimeout(() => {
                  handleChange({ target: { name: 'occupation_type', value: 'Not Applicable' } });
                  handleChange({ target: { name: 'salary_income', value: 'N/A' } });
                  handleChange({ target: { name: 'business_info', value: 'N/A' } });
                  handleChange({ target: { name: 'business_type', value: 'N/A' } });
                  handleChange({ target: { name: 'business_location', value: 'N/A' } });
                  handleChange({ target: { name: 'business_outside_barangay', value: false } });
                }, 0);
              } else {
                handleChange({
                  target: {
                    name: 'employment_status',
                    value: 'manual'
                  }
                });
                // Clear fields when unchecked
                setTimeout(() => {
                  handleChange({ target: { name: 'occupation_type', value: '' } });
                  handleChange({ target: { name: 'salary_income', value: '' } });
                  handleChange({ target: { name: 'business_info', value: '' } });
                  handleChange({ target: { name: 'business_type', value: '' } });
                  handleChange({ target: { name: 'business_location', value: '' } });
                  handleChange({ target: { name: 'business_outside_barangay', value: false } });
                }, 0);
              }
            }}
            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
          />
          <label htmlFor="employment_na" className="text-sm font-semibold text-gray-700 cursor-pointer">
            Not Applicable - Fill all fields with N/A
          </label>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">
            Occupation Type
            {isFieldRequired('occupation_type') && <span className="text-red-500 ml-1">*</span>}
          </label>
          <select
            name="occupation_type"
            value={form.occupation_type}
            onChange={handleChange}
            disabled={form.employment_status === 'na'}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 transition-all duration-200 shadow-sm hover:shadow-md ${form.employment_status === 'na' ? 'bg-gray-100 cursor-not-allowed' : ''} ${getFieldValidationClass('occupation_type')}`}
            required={isFieldRequired('occupation_type')}
          >
            <option value="">Select Occupation</option>
            <option>Managers</option>
            <option>Professionals</option>
            <option>Clerical Support Workers</option>
            <option>Elementary Occupation</option>
            <option>Service & Sales Workers</option>
            <option>Armed Forces Occupation</option>
            <option>Plant & Machine Operators & Assemblers</option>
            <option>Technician & Associate Professionals</option>
            <option>Skilled Cultural, Forestry, & Fishery Work</option>
            <option>Craft & Related Trades Workers</option>
            <option>Not Applicable</option>
          </select>
          {isFieldRequired('occupation_type') && !form.occupation_type && (
            <div className="text-xs text-red-600">
              This field is required
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">
            Salary/Income
            {isFieldRequired('salary_income') && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            name="salary_income"
            value={form.salary_income}
            onChange={handleChange}
            placeholder="e.g. ₱15,000/month"
            disabled={form.employment_status === 'na'}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 transition-all duration-200 shadow-sm hover:shadow-md ${form.employment_status === 'na' ? 'bg-gray-100 cursor-not-allowed' : ''} ${getFieldValidationClass('salary_income')}`}
            required={isFieldRequired('salary_income')}
          />
          {isFieldRequired('salary_income') && !form.salary_income && (
            <div className="text-xs text-red-600">
              This field is required
            </div>
          )}
        </div>
      </div>
        </div>

    {/* Business Information Section */}
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
      <h3 className="text-xl font-bold text-green-800 mb-6 flex items-center gap-2">
        💼 Business Information
      </h3>
      
      {/* N/A Option */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="business_na"
            checked={isBusinessNA}
            onChange={(e) => {
              if (e.target.checked) {
                // Auto-fill with N/A values
                setTimeout(() => {
                  handleChange({ target: { name: 'business_info', value: 'N/A' } });
                  handleChange({ target: { name: 'business_type', value: 'N/A' } });
                  handleChange({ target: { name: 'business_location', value: 'N/A' } });
                  handleChange({ target: { name: 'business_outside_barangay', value: false } });
                }, 0);
              } else {
                // Clear fields when unchecked
                setTimeout(() => {
                  handleChange({ target: { name: 'business_info', value: '' } });
                  handleChange({ target: { name: 'business_type', value: '' } });
                  handleChange({ target: { name: 'business_location', value: '' } });
                  handleChange({ target: { name: 'business_outside_barangay', value: false } });
                }, 0);
              }
            }}
            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
          />
          <label 
            htmlFor="business_na" 
            className="text-sm font-semibold text-gray-700 cursor-pointer"
          >
            Not Applicable - Fill all fields with N/A
          </label>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">
            Business Info
            <span className="text-gray-400 ml-1 text-xs">(Optional)</span>
          </label>
          <input
            name="business_info"
            value={form.business_info}
            onChange={handleChange}
            placeholder="e.g. ABC Marketing Services"
            disabled={areBusinessFieldsDisabled}
            className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 shadow-sm hover:shadow-md ${
              areBusinessFieldsDisabled ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''
            }`}
          />
      </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">
            Business Type
            <span className="text-gray-400 ml-1 text-xs">(Optional)</span>
          </label>
          <input
            name="business_type"
            value={form.business_type}
            onChange={handleChange}
            placeholder="e.g. Retail, Freelance"
            disabled={areBusinessFieldsDisabled}
            className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 shadow-sm hover:shadow-md ${
              areBusinessFieldsDisabled ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''
            }`}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">
            Business Location
            <span className="text-gray-400 ml-1 text-xs">(Optional)</span>
          </label>
          <input
            name="business_location"
            value={form.business_location}
            onChange={handleChange}
            placeholder="e.g. Zone 2, Brgy. Example"
            disabled={areBusinessFieldsDisabled}
            className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 shadow-sm hover:shadow-md ${
              areBusinessFieldsDisabled ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''
            }`}
          />
        </div>
        </div>

      <div className="mt-6">
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            name="business_outside_barangay"
            checked={form.business_outside_barangay}
            onChange={handleChange}
            disabled={areBusinessFieldsDisabled}
            className={`w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500 ${
              areBusinessFieldsDisabled ? 'cursor-not-allowed opacity-50' : ''
            }`}
          />
          <label className="text-sm font-semibold text-gray-700">
            Business Outside Barangay
            <span className="text-gray-400 ml-1 text-xs">(Optional)</span>
          </label>
        </div>
      </div>

      {/* Business Information Note for Business Permit */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-800 mb-1">
              📋 Make sure your Business Information is complete to request a Barangay Business Permit
            </p>
            <p className="text-xs text-blue-700">
              To request a Barangay Business Permit, please ensure that <strong>Business Name</strong>, <strong>Business Type</strong>, and <strong>Business Location</strong> are properly filled out (not empty or set to "N/A").
            </p>
          </div>
        </div>
      </div>
    </div>

    {/* Voter Information Section */}
    <div className={`bg-white p-6 rounded-xl border border-gray-200 shadow-sm ${isVoterInfoDisabled ? 'opacity-60' : ''}`}>
      <h3 className="text-xl font-bold text-green-800 mb-6 flex items-center gap-2">
        <BadgeCheck className="w-5 h-5" />
        Voter Information
        {isVoterInfoDisabled && (
          <span className="text-sm font-normal text-gray-500 ml-2">(Disabled for ages 1-14)</span>
        )}
      </h3>
      
      {isVoterInfoDisabled && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-blue-800 font-semibold mb-1">Voter Information Not Available</p>
              <p className="text-blue-700 text-sm">
                Voter information is disabled for residents aged 1-14 years old. 
                Residents aged 15-17 are eligible for Sangguniang Kabataan (SK) elections, 
                while those 18 years old and above are eligible to vote in both SK and regular elections 
                (including national positions such as President).
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="space-y-2">
          <label className={`text-sm font-semibold ${isVoterInfoDisabled ? 'text-gray-400' : 'text-gray-700'}`}>
            Voter Status
            {!isVoterInfoDisabled && isFieldRequired('voter_status') && <span className="text-red-500 ml-1">*</span>}
          </label>
          <select
            name="voter_status"
            value={form.voter_status}
            onChange={handleChange}
            disabled={isVoterInfoDisabled}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 transition-all duration-200 shadow-sm hover:shadow-md ${
              isVoterInfoDisabled 
                ? 'bg-gray-100 cursor-not-allowed text-gray-400 border-gray-200' 
                : getFieldValidationClass('voter_status')
            }`}
            required={!isVoterInfoDisabled && isFieldRequired('voter_status')}
          >
            <option value="">Select Voter Status</option>
            <option>Local (Barangay)</option>
            <option>Local (City/Municipality)</option>
            <option>Non-Local</option>
          </select>
          {!isVoterInfoDisabled && isFieldRequired('voter_status') && !form.voter_status && (
            <div className="text-xs text-red-600">
              This field is required
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className={`text-sm font-semibold ${isVoterInfoDisabled ? 'text-gray-400' : 'text-gray-700'}`}>
            Voter's ID Number
            {!isVoterInfoDisabled && isFieldRequired('voters_id_number') && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            name="voters_id_number"
            value={form.voters_id_number}
            onChange={handleChange}
            placeholder="e.g. 1234-5678-9012"
            disabled={isVoterInfoDisabled}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 transition-all duration-200 shadow-sm hover:shadow-md ${
              isVoterInfoDisabled 
                ? 'bg-gray-100 cursor-not-allowed text-gray-400 border-gray-200' 
                : getFieldValidationClass('voters_id_number')
            }`}
            required={!isVoterInfoDisabled && isFieldRequired('voters_id_number')}
          />
          {!isVoterInfoDisabled && isFieldRequired('voters_id_number') && !form.voters_id_number && (
            <div className="text-xs text-red-600">
              This field is required
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className={`text-sm font-semibold ${isVoterInfoDisabled ? 'text-gray-400' : 'text-gray-700'}`}>
            Precinct No.
            {!isVoterInfoDisabled && isFieldRequired('voting_location') && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            name="voting_location"
            value={form.voting_location}
            onChange={handleChange}
            placeholder="e.g. 001A, 002B"
            disabled={isVoterInfoDisabled}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 transition-all duration-200 shadow-sm hover:shadow-md ${
              isVoterInfoDisabled 
                ? 'bg-gray-100 cursor-not-allowed text-gray-400 border-gray-200' 
                : getFieldValidationClass('voting_location')
            }`}
            required={!isVoterInfoDisabled && isFieldRequired('voting_location')}
          />
          {!isVoterInfoDisabled && isFieldRequired('voting_location') && !form.voting_location && (
            <div className="text-xs text-red-600">
              This field is required
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Special Categories Section */}
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
      <h3 className="text-xl font-bold text-green-800 mb-6 flex items-center gap-2">
        ⚠️ Special Categories
        <span className="text-gray-400 ml-2 text-sm font-normal">(Optional)</span>
      </h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          'Solo Parent', 'Senior Citizen', 'Indigenous people', "4P's Member", 'PWD'
        ].map(cat => (
          <label key={cat} className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:bg-green-50 hover:border-green-300 transition-all duration-200 cursor-pointer">
            <input
              type="checkbox"
              name="special_categories"
              value={cat}
              checked={form.special_categories.includes(cat)}
              onChange={handleChange}
              className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
            />
            <span className="text-sm text-gray-700 font-medium">{cat}</span>
          </label>
        ))}
      </div>
    </div>

    {/* COVID Vaccination Section */}
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
      <h3 className="text-xl font-bold text-green-800 mb-6 flex items-center gap-2">
        💉 COVID Vaccination
        <span className="text-gray-400 ml-2 text-sm font-normal">(Optional)</span>
      </h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {[
          'Not Vaccinated', 'Pfizer-BioNTech', 'Oxford-AstraZeneca',
          'Sputnik V', 'Janssen', 'Sinovac'
        ].map(vac => (
          <label key={vac} className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:bg-green-50 hover:border-green-300 transition-all duration-200 cursor-pointer">
            <input
              type="radio"
              name="covid_vaccine_status"
              value={vac}
              checked={form.covid_vaccine_status === vac}
              onChange={handleChange}
              className="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-500"
            />
            <span className="text-sm text-gray-700 font-medium">{vac}</span>
          </label>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">Other Vaccine</label>
          <input
            name="other_vaccine"
            value={form.other_vaccine ?? ""}
            onChange={handleChange}
            placeholder="Specify if not listed above"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 shadow-sm hover:shadow-md"
          />
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">Year Vaccinated</label>
          <input
            name="year_vaccinated"
            value={form.year_vaccinated ?? ""}
            onChange={handleChange}
            placeholder="e.g., 2021"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 shadow-sm hover:shadow-md"
          />
        </div>
      </div>
    </div>

    {/* Action Buttons */}
    <div className="flex flex-col sm:flex-row gap-6 justify-center pt-8 pb-4">
      <button
  type="submit"
  disabled={submitting || !canSubmit}
        className={`bg-gradient-to-r from-green-500 via-green-600 to-emerald-600 hover:from-green-600 hover:via-green-700 hover:to-emerald-700 text-white px-12 py-5 rounded-2xl font-bold text-lg shadow-2xl transition-all duration-300 transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-green-300 focus:ring-opacity-50 flex items-center justify-center gap-3 border-2 border-green-400 hover:border-green-300 relative overflow-hidden group min-w-[200px] ${submitting ? 'opacity-75 cursor-not-allowed' : ''}`}
        style={{
          boxShadow: '0 10px 40px rgba(34, 197, 94, 0.3), 0 0 0 1px rgba(34, 197, 94, 0.1)',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        {submitting ? (
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white relative z-10"></div>
        ) : (
          <Save className="w-6 h-6 relative z-10" />
        )}
        <span className="relative z-10">
          {submitting ? 'Saving...' : 'Save Changes'}
        </span>
        {!submitting && (
          <div className="absolute -right-2 -top-2 w-4 h-4 bg-green-400 rounded-full animate-pulse"></div>
        )}
      </button>

      {form.verification_status === 'approved' ? (
        <button
          type="button"
          onClick={() => setIsEditing(false)}
          className="bg-gradient-to-r from-red-500 via-red-600 to-red-700 hover:from-red-600 hover:via-red-700 hover:to-red-800 text-white px-12 py-5 rounded-2xl font-bold text-lg shadow-2xl transition-all duration-300 transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-red-300 focus:ring-opacity-50 flex items-center justify-center gap-3 border-2 border-red-400 hover:border-red-300 relative overflow-hidden group min-w-[200px]"
          style={{
            boxShadow: '0 10px 40px rgba(239, 68, 68, 0.3), 0 0 0 1px rgba(239, 68, 68, 0.1)',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <X className="w-6 h-6 relative z-10" />
          <span className="relative z-10">Cancel</span>
          <div className="absolute -right-2 -top-2 w-4 h-4 bg-red-400 rounded-full animate-pulse"></div>
        </button>
      ) : (
        <button
          type="button"
          disabled
          className="bg-gray-300 text-gray-500 px-12 py-5 rounded-2xl font-bold text-lg cursor-not-allowed min-w-[200px]"
        >
          Cancel (Residency Verification Required)
        </button>
      )}
    </div>
  </form>
  );
};

// Wrapper component that provides SidebarProvider context
const ProfileWithSidebar = () => {
  return (
    <SidebarProvider>
      <Profile />
    </SidebarProvider>
  );
};

export default ProfileWithSidebar;
