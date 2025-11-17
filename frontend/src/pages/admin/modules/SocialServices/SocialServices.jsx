import React, { useState, useEffect } from 'react';
import { HeartIcon, ChartBarIcon, UserIcon, CalendarIcon, DocumentTextIcon, ArrowPathIcon, MagnifyingGlassIcon, FunnelIcon, EyeIcon, PencilIcon, TrashIcon, PlusIcon, XMarkIcon, CheckCircleIcon, ClockIcon, ExclamationTriangleIcon, QuestionMarkCircleIcon, StarIcon, SparklesIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon, ArrowRightIcon, LightBulbIcon, EnvelopeIcon, BookOpenIcon, UserGroupIcon, CreditCardIcon, CalculatorIcon, PaintBrushIcon } from '@heroicons/react/24/solid';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import axios from '../../../../utils/axiosConfig';
import { useAdminResponsiveLayout } from '../../../../hooks/useAdminResponsiveLayout';
import Navbar from '../../../../components/Navbar';
import Sidebar from '../../../../components/Sidebar';

// Import components
import SocialInsights from './components/SocialInsights';
import SocialStats from './components/SocialStats';
import SocialCharts from './components/SocialCharts';
import SocialTable from './components/SocialTable';
import SocialCards from './components/SocialCards';
import SocialModals from './components/SocialModals';

// Use axios for consistent API handling
const fetchPrograms = async () => {
  try {
    const res = await axios.get('/admin/programs');
    console.log('API Response:', res.data); // Debug log
    return res.data || [];
  } catch (error) {
    console.error('Error fetching programs:', error);
    return [];
  }
};

const fetchBeneficiaries = async () => {
  try {
    const res = await axios.get('/admin/beneficiaries');
    return res.data || [];
  } catch (error) {
    console.error('Error fetching beneficiaries:', error);
    return [];
  }
};

const SocialServices = () => {
  const { mainClasses } = useAdminResponsiveLayout();
  const [programs, setPrograms] = useState([]);
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editProgram, setEditProgram] = useState({});
  const [editData, setEditData] = useState({});
  const [addProgramMode, setAddProgramMode] = useState(false);
  const [addBeneficiaryMode, setAddBeneficiaryMode] = useState(false);
  const [currentProgramForBeneficiary, setCurrentProgramForBeneficiary] = useState(null);
  const [programCategoryFilter, setProgramCategoryFilter] = useState('all');

  // Add Program form state
    const [programForm, setProgramForm] = useState({
      name: '',
      description: '',
      startDate: '',
      endDate: '',
      status: '',
      beneficiaryType: '',
      assistanceType: '',
      amount: '',
      maxBeneficiaries: '',
      payoutDate: '',
    });
  const [programFormError, setProgramFormError] = useState('');
  const [programFormLoading, setProgramFormLoading] = useState(false);
  const [programFormSuccess, setProgramFormSuccess] = useState('');
  const [showNotificationSuccessModal, setShowNotificationSuccessModal] = useState(false);
  const [notificationDetails, setNotificationDetails] = useState(null);
  
  // User-friendly UI states
  const [showGlossary, setShowGlossary] = useState(false);
  const [showExecutiveSummary, setShowExecutiveSummary] = useState(true);

  // Analytics state
  const [chartData, setChartData] = useState([]);
  const [pieChartData, setPieChartData] = useState([]);
  const [barChartData, setBarChartData] = useState([]);
  const [selectedChartType, setSelectedChartType] = useState('programs');

  // Analytics period selection
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(0); // 0 means no month selected
  const currentYear = new Date().getFullYear();

  // Program comparison state
  const [selectedProgram1, setSelectedProgram1] = useState('');
  const [selectedProgram2, setSelectedProgram2] = useState('');
  const [showComparison, setShowComparison] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const programsData = await fetchPrograms();
        const beneficiariesData = await fetchBeneficiaries();
        console.log('Fetched programs data:', programsData); // Debug log
        console.log('Sample program:', programsData[0]); // Debug log
        setPrograms(programsData);
        setBeneficiaries(beneficiariesData);
        setChartData(generateChartData(programsData, selectedPeriod, selectedYear, selectedMonth));
        setPieChartData(generatePieChartData(programsData, selectedPeriod, selectedYear, selectedMonth));
        setBarChartData(generateBarChartData(programsData, beneficiariesData, selectedPeriod, selectedYear, selectedMonth));
        setIsDataLoaded(true);
      } catch (error) {
        console.error('Error loading data:', error);
        setIsDataLoaded(true); // Set to true even on error to prevent infinite loading
      }
    };
    loadData();
  }, []);

  const getBeneficiariesByProgram = (programId) => beneficiaries.filter(b => b.program_id === programId);
  
  // Check if all beneficiaries for a program are paid/disbursed
  const areAllBeneficiariesPaid = (programId) => {
    const programBeneficiaries = getBeneficiariesByProgram(programId);
    return programBeneficiaries.length > 0 && programBeneficiaries.every(b => 
      b.is_paid || b.status === 'Disbursed' || b.status === 'Completed'
    );
  };
  
  // Get the effective program status (Complete if all beneficiaries are paid, otherwise use original status)
  const getEffectiveProgramStatus = (program) => {
    if (!program || !program.id) {
      return 'draft';
    }
    // Check if all beneficiaries are paid - if so, status should be complete
    if (areAllBeneficiariesPaid(program.id)) {
      return 'complete';
    }
    // Normalize status to lowercase for consistent comparison
    const normalizedStatus = (program.status || 'draft').toLowerCase();
    return normalizedStatus;
  };

  const handleAddProgramClick = () => {
    setEditProgram({});
    setEditingProgram(null); // Reset editing program when adding new
    setProgramForm({
      name: '',
      description: '',
      startDate: '',
      endDate: '',
      status: '',
      beneficiaryType: '',
      assistanceType: '',
      amount: '',
      maxBeneficiaries: '',
      payoutDate: '',
    });
    setProgramFormError('');
    setProgramFormSuccess('');
    setAddProgramMode(true);
    setShowProgramModal(true);
  };

  const handleDeleteProgram = async (programId) => {
    // Get program details for confirmation message
    const program = programs.find(p => p.id === programId);
    const programBeneficiaries = getBeneficiariesByProgram(programId);
    const beneficiaryCount = programBeneficiaries.length;
    
    // Enhanced confirmation message
    const confirmMessage = beneficiaryCount > 0 
      ? `Are you sure you want to delete "${program?.name || 'this program'}"?\n\nThis will also delete ${beneficiaryCount} beneficiary record${beneficiaryCount > 1 ? 's' : ''} associated with this program.\n\nThis action cannot be undone.`
      : `Are you sure you want to delete "${program?.name || 'this program'}"?\n\nThis action cannot be undone.`;
    
    if (!window.confirm(confirmMessage)) return;
    
    try {
      // Delete the program (this should cascade delete beneficiaries on the backend)
      await axios.delete(`/admin/programs/${programId}`);
      
      // Refresh both programs and beneficiaries data
      const [updatedPrograms, updatedBeneficiaries] = await Promise.all([
        fetchPrograms(),
        fetchBeneficiaries()
      ]);
      
      setPrograms(updatedPrograms);
      setBeneficiaries(updatedBeneficiaries);
      
      // Show success message
      const successMessage = beneficiaryCount > 0
        ? `Program "${program?.name || 'Program'}" and ${beneficiaryCount} associated beneficiary record${beneficiaryCount > 1 ? 's' : ''} deleted successfully.`
        : `Program "${program?.name || 'Program'}" deleted successfully.`;
      
      alert(successMessage);
    } catch (err) {
      console.error('Error deleting program:', err);
      alert('Failed to delete program. ' + (err?.response?.data?.message || err?.message || ''));
    }
  };
  const handleProgramModalClose = () => {
    setShowProgramModal(false);
    setAddProgramMode(false);
    setEditingProgram(null); // Reset editing program when closing modal
    setProgramFormError('');
    setProgramFormSuccess('');
  };

  const formatDate = (dateString) => {
    if (!dateString || dateString === 'null' || dateString === 'undefined') return 'Not Set';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const formatDateRange = (startDate, endDate) => {
    if (!startDate || !endDate) return 'Not Set';
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return 'Invalid Date';
      
      // Check if same year
      if (start.getFullYear() === end.getFullYear()) {
        const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
        return `${startStr} - ${endStr}`;
      } else {
        const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
        const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
        return `${startStr} - ${endStr}`;
      }
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const formatCurrency = (amount) => {
    if (!amount || amount === 'null' || amount === 'undefined' || amount === 0) return '₱0';
    try {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount)) return '₱0';
      return `₱${numAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    } catch (error) {
      return '₱0';
    }
  };

  // Chart colors constant
  const COLORS = ['#10b981', '#f59e0b', '#6b7280', '#ef4444'];

  // Table sorting state and functions
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Missing state variables for modals and forms
  const [beneficiaryFormData, setBeneficiaryFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    program_id: '',
    status: 'pending',
    amount: '',
    payment_date: '',
    notes: ''
  });

  const [programFormData, setProgramFormData] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    status: 'active',
    beneficiary_type: '',
    assistance_type: '',
    amount: '',
    max_beneficiaries: '',
    payout_date: ''
  });

  const [editingProgram, setEditingProgram] = useState(null);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Program analysis functions
  const getProgramHealthScore = (programId) => {
    const program = programs.find(p => p.id === programId);
    if (!program) return 0;
    
    const beneficiaries = getBeneficiariesByProgram(programId);
    const paidBeneficiaries = beneficiaries.filter(b => b.status === 'paid').length;
    const completionRate = beneficiaries.length > 0 ? (paidBeneficiaries / beneficiaries.length) * 100 : 0;
    
    // Calculate health score based on completion rate and other factors
    let score = completionRate;
    
    // Add bonus for programs with many beneficiaries
    if (beneficiaries.length > 10) score += 10;
    if (beneficiaries.length > 50) score += 10;
    
    return Math.min(100, Math.max(0, Math.round(score)));
  };

  const getProgramPaymentRate = (programId) => {
    const beneficiaries = getBeneficiariesByProgram(programId);
    if (beneficiaries.length === 0) return 0;
    
    const paidBeneficiaries = beneficiaries.filter(b => b.status === 'paid').length;
    return Math.round((paidBeneficiaries / beneficiaries.length) * 100);
  };

  const getProgramCompletionRate = (programId) => {
    const beneficiaries = getBeneficiariesByProgram(programId);
    if (beneficiaries.length === 0) return 0;
    
    const completedBeneficiaries = beneficiaries.filter(b => b.status === 'completed' || b.status === 'paid').length;
    return Math.round((completedBeneficiaries / beneficiaries.length) * 100);
  };

  const getProgramEfficiencyScore = (programId) => {
    const program = programs.find(p => p.id === programId);
    if (!program) return 0;
    
    const beneficiaries = getBeneficiariesByProgram(programId);
    const paymentRate = getProgramPaymentRate(programId);
    const completionRate = getProgramCompletionRate(programId);
    
    // Calculate efficiency as average of payment and completion rates
    return Math.round((paymentRate + completionRate) / 2);
  };

  // Missing handler functions for modals and forms
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setBeneficiaryFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleProgramInputChange = (e) => {
    const { name, value } = e.target;
    setProgramFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleModalClose = () => {
    setShowModal(false);
    setShowProgramModal(false);
    setBeneficiaryFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
      program_id: '',
      status: 'pending',
      amount: '',
      payment_date: '',
      notes: ''
    });
    setProgramFormData({
      name: '',
      description: '',
      start_date: '',
      end_date: '',
      status: 'active',
      beneficiary_type: '',
      assistance_type: '',
      amount: '',
      max_beneficiaries: '',
      payout_date: ''
    });
    setEditingProgram(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Add beneficiary submission logic here
    console.log('Submitting beneficiary:', beneficiaryFormData);
  };

  const handleProgramSubmit = async (e) => {
    e.preventDefault();
    // Add program submission logic here
    console.log('Submitting program:', programFormData);
  };

  const handleEditProgramClick = (program) => {
    console.log('Editing program:', program); // Debug log
    setEditingProgram(program);
    setAddProgramMode(false); // Set to false when editing
    setEditProgram(program); // Also set editProgram for backward compatibility
    
    // Helper function to format dates for form inputs
    const formatDateForInput = (dateString) => {
      if (!dateString) return '';
      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        return date.toISOString().split('T')[0];
      } catch (error) {
        return '';
      }
    };
    
    const formatDateTimeForInput = (dateString) => {
      if (!dateString) return '';
      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        return date.toISOString().slice(0, 16);
      } catch (error) {
        return '';
      }
    };
    
    // Use programForm state instead of programFormData
    setProgramForm({
      name: program.name || '',
      description: program.description || '',
      startDate: formatDateForInput(program.start_date),
      endDate: formatDateForInput(program.end_date),
      status: program.status || 'active',
      beneficiaryType: program.beneficiary_type || '',
      assistanceType: program.assistance_type || '',
      amount: program.amount || '',
      maxBeneficiaries: program.max_beneficiaries || '',
      payoutDate: formatDateTimeForInput(program.payout_date)
    });
    setProgramFormError('');
    setProgramFormSuccess('');
    setShowProgramModal(true);
  };

  const toInputDate = (dateString) => {
    if (!dateString) return '';
    // Handles ISO format like "2024-01-01T00:00:00.000000Z"
    return dateString.split('T')[0];
  };

  const toInputDateTime = (dateString) => {
    if (!dateString) return '';
    // Handles ISO format like "2024-01-01T00:00:00.000000Z"
    const date = new Date(dateString);
    // Format for datetime-local input (YYYY-MM-DDTHH:MM)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // --- Enhanced Analytics calculations ---
  const totalPrograms = programs.length;
  const totalBeneficiaries = beneficiaries.length;
  let earliestStart = null, latestEnd = null;
  let activePrograms = 0;
  let completedPrograms = 0;
  let draftPrograms = 0;
  const today = new Date();
  const beneficiariesPerProgram = programs.map(p => ({
    id: p.id,
    name: p.name,
    count: beneficiaries.filter(b => b.program_id === p.id).length
  }));
  programs.forEach(p => {
    if (p.start_date && (!earliestStart || new Date(p.start_date) < new Date(earliestStart))) {
      earliestStart = p.start_date;
    }
    if (p.end_date && (!latestEnd || new Date(p.end_date) > new Date(latestEnd))) {
      latestEnd = p.end_date;
    }
    
    // Use effective program status (considers if all beneficiaries are paid)
    const effectiveStatus = getEffectiveProgramStatus(p);
    
    if (effectiveStatus === 'ongoing') {
      activePrograms++;
    } else if (effectiveStatus === 'complete') {
      completedPrograms++;
    } else if (effectiveStatus === 'draft') {
      draftPrograms++;
    }
  });

  // Enhanced Top Performing Programs with Weighted Scoring System
  const calculateAdvancedProgramScores = (categoryFilter = 'all') => {
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    // Filter programs by category if specified
    let filteredPrograms = programs;
    if (categoryFilter !== 'all') {
      filteredPrograms = programs.filter(program => {
        const category = program.assistance_type || program.beneficiary_type || 'General';
        return category.toLowerCase().includes(categoryFilter.toLowerCase());
      });
    }
    
    return filteredPrograms.map(program => {
      const programBeneficiaries = beneficiaries.filter(b => b.program_id === program.id);
      const totalBeneficiaries = programBeneficiaries.length;
      const paidBeneficiaries = programBeneficiaries.filter(b => b.is_paid || b.status === 'Disbursed' || b.status === 'Completed').length;
      
      // 1. Beneficiary Count Score (35% weight) - Normalized by max beneficiaries
      const maxBeneficiaries = Math.max(...programs.map(p => beneficiaries.filter(b => b.program_id === p.id).length), 1);
      const beneficiaryScore = (totalBeneficiaries / maxBeneficiaries) * 100;
      
      // 2. Completion Rate Score (25% weight)
      const completionRate = program.max_beneficiaries ? (totalBeneficiaries / program.max_beneficiaries) * 100 : 0;
      const completionScore = Math.min(completionRate, 100);
      
      // 3. Payment Success Rate Score (15% weight)
      const paymentRate = totalBeneficiaries > 0 ? (paidBeneficiaries / totalBeneficiaries) * 100 : 0;
      const paymentScore = paymentRate;
      
      // 4. Impact Score (15% weight) - Based on total amount disbursed and program effectiveness
      const totalAmount = programBeneficiaries.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
      const avgAmount = totalBeneficiaries > 0 ? totalAmount / totalBeneficiaries : 0;
      const maxAvgAmount = Math.max(...programs.map(p => {
        const pBeneficiaries = beneficiaries.filter(b => b.program_id === p.id);
        const pTotalAmount = pBeneficiaries.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
        return pBeneficiaries.length > 0 ? pTotalAmount / pBeneficiaries.length : 0;
      }), 1);
      const impactScore = (avgAmount / maxAvgAmount) * 100;
      
      // 5. Growth Rate Score (10% weight) - Month-over-month beneficiary growth
      const recentBeneficiaries = programBeneficiaries.filter(b => {
        const createdDate = new Date(b.created_at);
        return createdDate >= oneMonthAgo;
      }).length;
      const previousBeneficiaries = totalBeneficiaries - recentBeneficiaries;
      const growthRate = previousBeneficiaries > 0 ? ((recentBeneficiaries - previousBeneficiaries) / previousBeneficiaries) * 100 : 0;
      const growthScore = Math.max(0, Math.min(growthRate + 50, 100)); // Normalize growth rate
      
      // Calculate weighted overall score
      const overallScore = (
        (beneficiaryScore * 0.35) +
        (completionScore * 0.25) +
        (paymentScore * 0.15) +
        (impactScore * 0.15) +
        (growthScore * 0.10)
      );
      
      // Determine badges
      const badges = [];
      if (growthRate > 20) badges.push({ type: 'trending', label: 'Trending', icon: 'trending', color: 'orange' });
      if (paymentRate >= 90) badges.push({ type: 'top-rated', label: 'Top Rated', icon: 'star', color: 'yellow' });
      if (completionRate >= 95) badges.push({ type: 'excellent', label: 'Excellent', icon: 'sparkles', color: 'blue' });
      if (overallScore >= 85) badges.push({ type: 'high-performer', label: 'High Performer', icon: 'sparkles', color: 'purple' });
      
      return {
        id: program.id,
        name: program.name,
        count: totalBeneficiaries,
        overallScore: Math.round(overallScore * 100) / 100,
        metrics: {
          beneficiaryScore: Math.round(beneficiaryScore * 100) / 100,
          completionScore: Math.round(completionScore * 100) / 100,
          paymentScore: Math.round(paymentScore * 100) / 100,
          impactScore: Math.round(impactScore * 100) / 100,
          growthScore: Math.round(growthScore * 100) / 100,
          completionRate,
          paymentRate,
          totalAmount,
          avgAmount: Math.round(avgAmount),
          growthRate: Math.round(growthRate * 100) / 100
        },
        badges,
        program: program
      };
    }).sort((a, b) => b.overallScore - a.overallScore);
  };

  const topPrograms = calculateAdvancedProgramScores(programCategoryFilter).slice(0, 3);

  // Enhanced Analytics Calculations
  const totalAmount = beneficiaries.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  const averageAmount = totalBeneficiaries > 0 ? Math.round(totalAmount / totalBeneficiaries) : 0;
  const paidBeneficiariesCount = beneficiaries.filter(b => b.is_paid || b.status === 'Disbursed' || b.status === 'Completed').length;
  // Pending payments: beneficiaries who are not paid and not disbursed/completed
  const pendingPaymentCount = beneficiaries.filter(b => 
    !b.is_paid && 
    b.status !== 'Disbursed' && 
    b.status !== 'Completed' &&
    b.status !== 'Rejected'
  ).length;
  const paymentRate = totalBeneficiaries > 0 ? Math.round((paidBeneficiariesCount / totalBeneficiaries) * 100) : 0;
  
  // Program health calculations
  const programHealthScores = programs.map(program => {
    const programBeneficiaries = beneficiaries.filter(b => b.program_id === program.id);
    const programPaidCount = programBeneficiaries.filter(b => b.is_paid).length;
    const programPaymentRate = programBeneficiaries.length > 0 ? (programPaidCount / programBeneficiaries.length) * 100 : 0;
    const completionRate = program.max_beneficiaries ? (programBeneficiaries.length / program.max_beneficiaries) * 100 : 0;
    
    // Calculate health score (0-100)
    let healthScore = 0;
    if (completionRate >= 90) healthScore += 40;
    else if (completionRate >= 70) healthScore += 30;
    else if (completionRate >= 50) healthScore += 20;
    else healthScore += 10;
    
    if (programPaymentRate >= 80) healthScore += 30;
    else if (programPaymentRate >= 60) healthScore += 20;
    else if (programPaymentRate >= 40) healthScore += 10;
    
    const effectiveStatus = getEffectiveProgramStatus(program);
    if (effectiveStatus === 'ongoing') healthScore += 20;
    else if (effectiveStatus === 'complete') healthScore += 15;
    else healthScore += 5;
    
    return {
      programId: program.id,
      programName: program.name,
      healthScore: Math.min(100, healthScore),
      completionRate,
      paymentRate: programPaymentRate,
      beneficiaryCount: programBeneficiaries.length,
      maxBeneficiaries: program.max_beneficiaries || 0
    };
  });

  const averageHealthScore = programHealthScores.length > 0 
    ? Math.round(programHealthScores.reduce((sum, p) => sum + p.healthScore, 0) / programHealthScores.length)
    : 0;

  // Generate actionable suggestions
  const generateSuggestions = () => {
    const suggestions = [];
    
    // Low health score programs
    const lowHealthPrograms = programHealthScores.filter(p => p.healthScore < 50);
    if (lowHealthPrograms.length > 0) {
      suggestions.push({
        type: 'warning',
        icon: 'warning',
        title: 'Programs Need Attention',
        message: `${lowHealthPrograms.length} program${lowHealthPrograms.length > 1 ? 's' : ''} have health scores below 50%.`,
        action: 'Review program performance and implement improvements',
        programs: lowHealthPrograms.map(p => p.programName)
      });
    }

    // Low completion rates
    const lowCompletionPrograms = programHealthScores.filter(p => p.completionRate < 30);
    if (lowCompletionPrograms.length > 0) {
      suggestions.push({
        type: 'info',
        icon: 'chart',
        title: 'Low Enrollment Programs',
        message: `${lowCompletionPrograms.length} program${lowCompletionPrograms.length > 1 ? 's' : ''} have less than 30% enrollment.`,
        action: 'Increase outreach efforts and marketing',
        programs: lowCompletionPrograms.map(p => p.programName)
      });
    }

    // Low payment rates
    const lowPaymentPrograms = programHealthScores.filter(p => p.paymentRate < 50 && p.beneficiaryCount > 0);
    if (lowPaymentPrograms.length > 0) {
      suggestions.push({
        type: 'urgent',
        icon: 'credit-card',
        title: 'Payment Processing Issues',
        message: `${lowPaymentPrograms.length} program${lowPaymentPrograms.length > 1 ? 's' : ''} have low payment rates.`,
        action: 'Accelerate payment processing and follow up on pending payments',
        programs: lowPaymentPrograms.map(p => p.programName)
      });
    }

    // Draft programs
    if (draftPrograms > 0) {
      suggestions.push({
        type: 'info',
        icon: 'document',
        title: 'Draft Programs',
        message: `${draftPrograms} program${draftPrograms > 1 ? 's' : ''} are still in draft status.`,
        action: 'Review and publish ready programs to increase activity',
        programs: programs.filter(p => getEffectiveProgramStatus(p) === 'draft').map(p => p.name)
      });
    }

    // High performing programs
    const highPerformingPrograms = programHealthScores.filter(p => p.healthScore >= 80);
    if (highPerformingPrograms.length > 0) {
      suggestions.push({
        type: 'success',
        icon: 'sparkles',
        title: 'High Performing Programs',
        message: `${highPerformingPrograms.length} program${highPerformingPrograms.length > 1 ? 's' : ''} are performing excellently.`,
        action: 'Use these programs as templates for new initiatives',
        programs: highPerformingPrograms.map(p => p.programName)
      });
    }

    // No recent activity
    const recentPrograms = programs.filter(p => {
      const createdDate = new Date(p.created_at);
      const weekAgo = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
      return createdDate >= weekAgo;
    });
    
    if (recentPrograms.length === 0 && programs.length > 0) {
      suggestions.push({
        type: 'info',
        icon: 'chart',
        title: 'No Recent Activity',
        message: 'No new programs created in the last 7 days.',
        action: 'Consider creating new programs or updating existing ones',
        programs: []
      });
    }

    // Default suggestion if no specific issues
    if (suggestions.length === 0) {
      suggestions.push({
        type: 'success',
        icon: 'check',
        title: 'All Systems Running Smoothly',
        message: 'All programs are performing well within normal parameters.',
        action: 'Continue current operations and monitor for improvements',
        programs: []
      });
    }

    return suggestions;
  };

  const suggestions = generateSuggestions();
  
  // User-friendly helper functions
  const getHealthScoreExplanation = (score) => {
    if (score >= 80) {
      return {
        status: "Excellent Performance! 🎉",
        message: "Your programs are running smoothly. Keep up the great work!",
        detail: "Most beneficiaries are enrolled and payments are on track.",
        color: "green",
        bgColor: "bg-green-50",
        textColor: "text-green-700",
        borderColor: "border-green-500"
      };
    } else if (score >= 60) {
      return {
        status: "Good Performance 👍",
        message: "Programs are doing well with minor room for improvement.",
        detail: "Enrollment is steady and most payments are being processed.",
        color: "blue",
        bgColor: "bg-blue-50",
        textColor: "text-blue-700",
        borderColor: "border-blue-500"
      };
    } else if (score >= 40) {
      return {
        status: "Needs Attention ⚠️",
        message: "Some programs need your attention to improve.",
        detail: "Check enrollment rates and payment processing delays.",
        color: "yellow",
        bgColor: "bg-yellow-50",
        textColor: "text-yellow-700",
        borderColor: "border-yellow-500"
      };
    } else {
      return {
        status: "Critical - Action Required 🚨",
        message: "Multiple programs require immediate attention.",
        detail: "Review low-performing programs and take corrective action.",
        color: "red",
        bgColor: "bg-red-50",
        textColor: "text-red-700",
        borderColor: "border-red-500"
      };
    }
  };
  
  const healthExplanation = getHealthScoreExplanation(averageHealthScore);

  // State for toggling analytics visibility
  const [showTopPrograms, setShowTopPrograms] = useState(true);
  const [showBeneficiariesBar, setShowBeneficiariesBar] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showHealthScoreBreakdown, setShowHealthScoreBreakdown] = useState(false);
  const [showPerformanceCalculation, setShowPerformanceCalculation] = useState(true);
  
  // Tab state - initialize from URL query parameter
  const [activeTab, setActiveTab] = useState(() => {
    const section = searchParams.get('section');
    if (section === 'programs') return 'programs';
    if (section === 'beneficiaries') return 'beneficiaries';
    return 'overview';
  });

  // Update tab when URL query parameter changes
  useEffect(() => {
    const section = searchParams.get('section');
    if (section === 'programs') {
      setActiveTab('programs');
    } else if (section === 'beneficiaries') {
      setActiveTab('beneficiaries');
    } else if (!section) {
      setActiveTab('overview');
    }
  }, [searchParams]);

  // Beneficiaries view state
  const [beneficiariesSearchTerm, setBeneficiariesSearchTerm] = useState('');
  const [beneficiariesStatusFilter, setBeneficiariesStatusFilter] = useState('all');
  const [beneficiariesProgramFilter, setBeneficiariesProgramFilter] = useState('all');
  const [beneficiariesSortConfig, setBeneficiariesSortConfig] = useState({ key: null, direction: 'asc' });
  
  // Program Status Distribution enhanced states
  const [trendComparison, setTrendComparison] = useState('none'); // 'none', 'month', 'quarter', 'year'
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [showStatusDrillDown, setShowStatusDrillDown] = useState(false);
  const [showTransitionFlow, setShowTransitionFlow] = useState(false);

  // Update charts when filters change
  useEffect(() => {
    setChartData(generateChartData(programs, selectedPeriod, selectedYear, selectedMonth));
    setPieChartData(generatePieChartData(programs, selectedPeriod, selectedYear, selectedMonth));
    setBarChartData(generateBarChartData(programs, beneficiaries, selectedPeriod, selectedYear, selectedMonth));
  }, [programs, beneficiaries, selectedPeriod, selectedYear, selectedMonth]);

  // Update screen width for debug info
  useEffect(() => {
    const updateScreenWidth = () => {
      const widthElement = document.getElementById('screen-width');
      if (widthElement) {
        widthElement.textContent = window.innerWidth;
      }
    };
    
    updateScreenWidth();
    window.addEventListener('resize', updateScreenWidth);
    return () => window.removeEventListener('resize', updateScreenWidth);
  }, []);

  // Generate chart data for program creation based on period, year, and month
  const generateChartData = (programs, period = 'all', year = currentYear, month = 0) => {
    const now = new Date();
    let data = [];

    if (period === 'month') {
      if (!year || month === 0) {
        // If no specific year/month, use current month
        const today = new Date();
        year = today.getFullYear();
        month = today.getMonth() + 1;
      }
      // Daily data for selected month and year
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0);
      const dailyData = {};
      programs.forEach(program => {
        if (program.created_at) {
          const date = new Date(program.created_at);
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
          name: date.getDate().toString(),
          programs: dailyData[key] || 0
        });
      }
    } else if (period === 'year') {
      if (!year) {
        year = currentYear;
      }
      if (month > 0) {
        // Daily data for selected month in the year
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0);
        const dailyData = {};
        programs.forEach(program => {
          if (program.created_at) {
            const date = new Date(program.created_at);
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
            name: date.getDate().toString(),
            programs: dailyData[key] || 0
          });
        }
      } else {
        // Monthly data for selected year
        const yearlyData = {};
        programs.forEach(program => {
          if (program.created_at) {
            const date = new Date(program.created_at);
            if (date.getFullYear() === year) {
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
            name: date.toLocaleDateString('en-US', { month: 'short' }),
            programs: yearlyData[key] || 0
          });
        }
      }
    } else {
      // Last 12 months
      const monthlyData = {};
      programs.forEach(program => {
        if (program.created_at) {
          const date = new Date(program.created_at);
          const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          monthlyData[monthYear] = (monthlyData[monthYear] || 0) + 1;
        }
      });

      // Get last 12 months
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        data.push({
          name: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          programs: monthlyData[key] || 0
        });
      }
    }
    return data;
  };

  // Generate pie chart data for program status based on period, year, and month
  const generatePieChartData = (programs, period = 'all', year = currentYear, month = 0) => {
    const now = new Date();
    let filteredPrograms = programs;
    if (period === 'month' && month > 0) {
      filteredPrograms = programs.filter(program => {
        if (!program.created_at) return false;
        const date = new Date(program.created_at);
        return date.getMonth() + 1 === month && date.getFullYear() === year;
      });
    } else if (period === 'year') {
      if (month > 0) {
        filteredPrograms = programs.filter(program => {
          if (!program.created_at) return false;
          const date = new Date(program.created_at);
          return date.getMonth() + 1 === month && date.getFullYear() === year;
        });
      } else {
        filteredPrograms = programs.filter(program => {
          if (!program.created_at) return false;
          const date = new Date(program.created_at);
          return date.getFullYear() === year;
        });
      }
    }
    // else all

    const statusCounts = {};
    filteredPrograms.forEach(program => {
      const effectiveStatus = getEffectiveProgramStatus(program);
      statusCounts[effectiveStatus] = (statusCounts[effectiveStatus] || 0) + 1;
    });

    const colors = ['#10b981', '#f59e0b', '#6b7280', '#ef4444'];
    return Object.entries(statusCounts).map(([status, count], index) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      value: count,
      color: colors[index % colors.length],
      status: status
    }));
  };

  // Generate trend comparison data
  const generateTrendComparisonData = () => {
    const now = new Date();
    let comparisonDate;
    
    switch (trendComparison) {
      case 'month':
        comparisonDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      case 'quarter':
        comparisonDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        break;
      case 'year':
        comparisonDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      default:
        return null;
    }

    // Get current data
    const currentData = generatePieChartData(programs, selectedPeriod, selectedYear, selectedMonth);
    
    // Get comparison data (programs created before comparison date)
    const comparisonPrograms = programs.filter(program => {
      if (!program.created_at) return false;
      const programDate = new Date(program.created_at);
      return programDate <= comparisonDate;
    });
    
    const comparisonData = generatePieChartData(comparisonPrograms, 'all');
    
    // Calculate trends
    return currentData.map(current => {
      const comparison = comparisonData.find(comp => comp.status === current.status);
      const previousCount = comparison ? comparison.value : 0;
      const change = current.value - previousCount;
      const changePercent = previousCount > 0 ? ((change / previousCount) * 100) : (current.value > 0 ? 100 : 0);
      
      return {
        ...current,
        previousCount,
        change,
        changePercent: Math.round(changePercent * 100) / 100,
        trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
      };
    });
  };

  // Get programs by status for drill-down
  const getProgramsByStatus = (status) => {
    return programs.filter(program => {
      const effectiveStatus = getEffectiveProgramStatus(program);
      return effectiveStatus === status;
    }).map(program => {
      const programBeneficiaries = getBeneficiariesByProgram(program.id);
      const paidCount = programBeneficiaries.filter(b => b.is_paid || b.status === 'Disbursed' || b.status === 'Completed').length;
      const paymentRate = programBeneficiaries.length > 0 ? (paidCount / programBeneficiaries.length) * 100 : 0;
      
      // Calculate duration in current status
      const statusDuration = program.updated_at ? 
        Math.floor((new Date() - new Date(program.updated_at)) / (1000 * 60 * 60 * 24)) : 0;
      
      return {
        ...program,
        beneficiaryCount: programBeneficiaries.length,
        paidCount,
        paymentRate: Math.round(paymentRate * 100) / 100,
        statusDuration
      };
    });
  };

  // Generate bar chart data for beneficiaries per program based on period, year, and month
  const generateBarChartData = (programs, beneficiaries, period = 'all', year = currentYear, month = 0) => {
    const now = new Date();
    let filteredPrograms = programs;
    let filteredBeneficiaries = beneficiaries;
    if (period === 'month' && month > 0) {
      filteredPrograms = programs.filter(program => {
        if (!program.created_at) return false;
        const date = new Date(program.created_at);
        return date.getMonth() + 1 === month && date.getFullYear() === year;
      });
      filteredBeneficiaries = beneficiaries.filter(beneficiary => {
        if (!beneficiary.created_at) return false;
        const date = new Date(beneficiary.created_at);
        return date.getMonth() + 1 === month && date.getFullYear() === year;
      });
    } else if (period === 'year') {
      if (month > 0) {
        filteredPrograms = programs.filter(program => {
          if (!program.created_at) return false;
          const date = new Date(program.created_at);
          return date.getMonth() + 1 === month && date.getFullYear() === year;
        });
        filteredBeneficiaries = beneficiaries.filter(beneficiary => {
          if (!beneficiary.created_at) return false;
          const date = new Date(beneficiary.created_at);
          return date.getMonth() + 1 === month && date.getFullYear() === year;
        });
      } else {
        filteredPrograms = programs.filter(program => {
          if (!program.created_at) return false;
          const date = new Date(program.created_at);
          return date.getFullYear() === year;
        });
        filteredBeneficiaries = beneficiaries.filter(beneficiary => {
          if (!beneficiary.created_at) return false;
          const date = new Date(beneficiary.created_at);
          return date.getFullYear() === year;
        });
      }
    }
    // else all

    return filteredPrograms.map(program => {
      const programBeneficiaries = filteredBeneficiaries.filter(b => b.program_id === program.id);
      const totalBeneficiaries = programBeneficiaries.length;
      const paidBeneficiaries = programBeneficiaries.filter(b => b.is_paid || b.status === 'Disbursed' || b.status === 'Completed').length;
      const pendingBeneficiaries = programBeneficiaries.filter(b => 
        !b.is_paid && 
        b.status !== 'Disbursed' && 
        b.status !== 'Completed' &&
        b.status !== 'Rejected'
      ).length;
      
      return {
        id: program.id,
      name: program.name.length > 15 ? program.name.substring(0, 15) + '...' : program.name,
        fullName: program.name,
        beneficiaries: totalBeneficiaries,
        paidBeneficiaries: paidBeneficiaries,
        pendingBeneficiaries: pendingBeneficiaries
      };
    }).sort((a, b) => b.beneficiaries - a.beneficiaries).slice(0, 8);
  };

  // Generate comparison-specific bar chart data for selected programs only
  const getComparisonBarChartData = () => {
    if (!selectedProgram1 || !selectedProgram2) return barChartData;
    
    const program1Id = parseInt(selectedProgram1);
    const program2Id = parseInt(selectedProgram2);
    
    const program1 = programs.find(p => p.id === program1Id || p.id === selectedProgram1);
    const program2 = programs.find(p => p.id === program2Id || p.id === selectedProgram2);
    
    if (!program1 || !program2) return barChartData;
    
    return [program1, program2].map(program => {
      const programBeneficiaries = beneficiaries.filter(b => b.program_id === program.id);
      const totalBeneficiaries = programBeneficiaries.length;
      const paidBeneficiaries = programBeneficiaries.filter(b => b.is_paid || b.status === 'Disbursed' || b.status === 'Completed').length;
      const pendingBeneficiaries = programBeneficiaries.filter(b => 
        !b.is_paid && 
        b.status !== 'Disbursed' && 
        b.status !== 'Completed' &&
        b.status !== 'Rejected'
      ).length;
      
      return {
        id: program.id,
        name: program.name.length > 15 ? program.name.substring(0, 15) + '...' : program.name,
        fullName: program.name,
        beneficiaries: totalBeneficiaries,
        paidBeneficiaries: paidBeneficiaries,
        pendingBeneficiaries: pendingBeneficiaries
      };
    });
  };

  // Get most active program by beneficiaries based on period, year, and month
  const getMostActiveProgram = (programs, beneficiaries, period = 'all', year = currentYear, month = 0) => {
    const now = new Date();
    let filteredPrograms = programs;
    let filteredBeneficiaries = beneficiaries;
    if (period === 'month' && month > 0) {
      filteredPrograms = programs.filter(program => {
        if (!program.created_at) return false;
        const date = new Date(program.created_at);
        return date.getMonth() + 1 === month && date.getFullYear() === year;
      });
      filteredBeneficiaries = beneficiaries.filter(beneficiary => {
        if (!beneficiary.created_at) return false;
        const date = new Date(beneficiary.created_at);
        return date.getMonth() + 1 === month && date.getFullYear() === year;
      });
    } else if (period === 'year') {
      if (month > 0) {
        filteredPrograms = programs.filter(program => {
          if (!program.created_at) return false;
          const date = new Date(program.created_at);
          return date.getMonth() + 1 === month && date.getFullYear() === year;
        });
        filteredBeneficiaries = beneficiaries.filter(beneficiary => {
          if (!beneficiary.created_at) return false;
          const date = new Date(beneficiary.created_at);
          return date.getMonth() + 1 === month && date.getFullYear() === year;
        });
      } else {
        filteredPrograms = programs.filter(program => {
          if (!program.created_at) return false;
          const date = new Date(program.created_at);
          return date.getFullYear() === year;
        });
        filteredBeneficiaries = beneficiaries.filter(beneficiary => {
          if (!beneficiary.created_at) return false;
          const date = new Date(beneficiary.created_at);
          return date.getFullYear() === year;
        });
      }
    }
    // else all

    let max = 0;
    let mostActive = '';
    filteredPrograms.forEach(program => {
      const count = filteredBeneficiaries.filter(b => b.program_id === program.id).length;
      if (count > max) {
        max = count;
        mostActive = program.name;
      }
    });
    return { name: mostActive, count: max };
  };

  return (
    <>
      <Navbar />
      <Sidebar />
      <div className="fixed inset-0 bg-green-50 -z-10"></div>
      <main className="bg-green-50 min-h-screen ml-0 lg:ml-64 px-4 pb-16 font-sans">
        <div className="w-full max-w-[98%] mx-auto space-y-8 px-2 lg:px-4 pt-20 lg:pt-36">
          {/* Enhanced Header */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full shadow-xl mb-4">
              <HeartIcon className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent tracking-tight">
              Social Services
            </h1>
            <p className="text-gray-600 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed px-4">
              Comprehensive management system for social assistance programs and beneficiaries with real-time analytics and performance tracking.
            </p>
            <div className="flex flex-wrap justify-center gap-2 sm:gap-4 px-4">
              <button
                onClick={() => setShowGlossary(true)}
                className="bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 px-4 sm:px-6 py-2 rounded-full text-xs sm:text-sm font-medium border border-green-200 hover:shadow-md transition-all duration-300 flex items-center gap-1 sm:gap-2"
              >
                <QuestionMarkCircleIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Help Guide</span>
                <span className="sm:hidden">Help</span>
              </button>
              <button className="bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 px-4 sm:px-6 py-2 rounded-full text-xs sm:text-sm font-medium border border-blue-200 hover:shadow-md transition-all duration-300 flex items-center gap-1 sm:gap-2">
                <ChartBarIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Quick Start</span>
                <span className="sm:hidden">Start</span>
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden mb-8">
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => {
                  setActiveTab('overview');
                  setSearchParams({}); // Clear section parameter for overview
                }}
                className={`flex-1 px-6 py-4 font-semibold text-base transition-all duration-300 flex items-center justify-center gap-2 ${
                  activeTab === 'overview'
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white border-b-4 border-green-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-green-600'
                }`}
              >
                <ChartBarIcon className="w-5 h-5" />
                Overview
              </button>
              <button
                onClick={() => {
                  setActiveTab('analytics');
                  setSearchParams({}); // Clear section parameter for analytics
                }}
                className={`flex-1 px-6 py-4 font-semibold text-base transition-all duration-300 flex items-center justify-center gap-2 ${
                  activeTab === 'analytics'
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white border-b-4 border-green-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-green-600'
                }`}
              >
                <ChartBarIcon className="w-5 h-5" />
                Analytics
              </button>
              <button
                onClick={() => {
                  setActiveTab('programs');
                  setSearchParams({ section: 'programs' }); // Set section parameter for programs
                }}
                className={`flex-1 px-6 py-4 font-semibold text-base transition-all duration-300 flex items-center justify-center gap-2 ${
                  activeTab === 'programs'
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white border-b-4 border-green-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-green-600'
                }`}
              >
                <DocumentTextIcon className="w-5 h-5" />
                Programs
              </button>
              <button
                onClick={() => {
                  setActiveTab('beneficiaries');
                  setSearchParams({ section: 'beneficiaries' }); // Set section parameter for beneficiaries
                }}
                className={`flex-1 px-6 py-4 font-semibold text-base transition-all duration-300 flex items-center justify-center gap-2 ${
                  activeTab === 'beneficiaries'
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white border-b-4 border-green-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-green-600'
                }`}
              >
                <UserGroupIcon className="w-5 h-5" />
                Beneficiaries
              </button>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              {/* Quick Insights Summary - At-a-Glance */}
              <SocialInsights 
          showExecutiveSummary={showExecutiveSummary}
          setShowExecutiveSummary={setShowExecutiveSummary}
          activePrograms={activePrograms}
          totalBeneficiaries={totalBeneficiaries}
          pendingPaymentCount={pendingPaymentCount}
          draftPrograms={draftPrograms}
          averageHealthScore={averageHealthScore}
        />

        {/* Color Legend */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
          <h4 className="font-semibold text-gray-800 mb-6 flex items-center justify-center gap-2 text-lg">
            <PaintBrushIcon className="w-5 h-5 text-gray-600" /> Understanding Colors & Indicators
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-4 text-xs sm:text-sm">
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500 flex-shrink-0"></div>
              <span className="truncate text-center">Excellent/Good</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-500 flex-shrink-0"></div>
              <span className="truncate text-center">Active/On Track</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 rounded-full bg-yellow-500 flex-shrink-0"></div>
              <span className="truncate text-center">Needs Attention</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 rounded-full bg-red-500 flex-shrink-0"></div>
              <span className="truncate text-center">Urgent/Critical</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 rounded-full bg-gray-400 flex-shrink-0"></div>
              <span className="truncate text-center">Draft/Inactive</span>
            </div>
          </div>
        </div>

              {/* Enhanced Statistics Cards */}
              <SocialStats 
            totalPrograms={totalPrograms}
            totalBeneficiaries={totalBeneficiaries}
            totalBudget={totalAmount}
            activePrograms={activePrograms}
            completedPrograms={completedPrograms}
            pendingPayments={pendingPaymentCount}
            averageHealthScore={averageHealthScore}
            earliestStart={earliestStart}
            latestEnd={latestEnd}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
              />

              {/* Program Health Score Overview - Enhanced with Explanation */}
          <div className={`bg-white rounded-2xl shadow-xl border border-gray-100 p-6 ${healthExplanation.borderColor}`}>
            {/* Plain Language Summary */}
            <div className="mb-4">
              <div className={`text-xl font-bold ${healthExplanation.textColor} mb-2 flex items-center gap-2`}>
                {healthExplanation.status}
                <div className="relative group">
                  <QuestionMarkCircleIcon className="w-5 h-5 cursor-help" />
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-40 sm:w-48 lg:w-64 bg-gray-900 text-white text-xs rounded-lg p-2 sm:p-3 z-50">
                    <div className="font-semibold mb-1">What is Health Score?</div>
                    <div>A 0-100 score measuring program performance based on enrollment, payment success, and timeline adherence.</div>
                    <div className="mt-2 text-blue-300">
                      • 80-100: Excellent ✨<br/>
                      • 60-79: Good 👍<br/>
                      • 40-59: Needs Attention ⚠️<br/>
                      • 0-39: Critical 🚨
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-gray-700 mb-1">{healthExplanation.message}</p>
              <p className="text-sm text-gray-600">{healthExplanation.detail}</p>
            </div>

            {/* Score Bar */}
            <div 
              className="cursor-pointer hover:shadow-lg transition-all duration-200 bg-white rounded-lg p-4"
              onClick={() => setShowHealthScoreBreakdown(true)}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-indigo-800 flex items-center gap-2">
                  Overall Program Health Score
                  <span className="text-sm text-indigo-600 font-normal">(Click for detailed breakdown)</span>
                </h3>
                <div className="text-2xl font-bold text-indigo-700">{averageHealthScore}/100</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full transition-all duration-1000 ${
                        averageHealthScore >= 80 ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                        averageHealthScore >= 60 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                        averageHealthScore >= 40 ? 'bg-gradient-to-r from-orange-500 to-red-500' :
                        'bg-gradient-to-r from-red-500 to-red-600'
                      }`}
                      style={{ width: `${averageHealthScore}%` }}
                    ></div>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                  averageHealthScore >= 80 ? 'bg-green-100 text-green-800' :
                  averageHealthScore >= 60 ? 'bg-yellow-100 text-yellow-800' :
                  averageHealthScore >= 40 ? 'bg-orange-100 text-orange-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {averageHealthScore >= 80 ? 'Excellent' :
                   averageHealthScore >= 60 ? 'Good' :
                   averageHealthScore >= 40 ? 'Fair' : 'Poor'}
                </div>
              </div>
            </div>
          </div>

              {/* Actionable Suggestions Section */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <LightBulbIcon className="w-6 h-6 text-yellow-500" />
                    Actionable Suggestions
                  </h3>
                  <button
                    className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg font-semibold text-sm shadow transition-all duration-200"
                    onClick={() => setShowSuggestions(v => !v)}
                  >
                    {showSuggestions ? 'Hide' : 'Show'}
                  </button>
                </div>
                
                {showSuggestions && (
                  <div className="space-y-3">
                    {suggestions.map((suggestion, index) => {
                      const IconComponent = suggestion.icon === 'warning' ? ExclamationTriangleIcon :
                                           suggestion.icon === 'chart' ? ChartBarIcon :
                                           suggestion.icon === 'credit-card' ? CreditCardIcon :
                                           suggestion.icon === 'document' ? DocumentTextIcon :
                                           suggestion.icon === 'sparkles' ? SparklesIcon :
                                           suggestion.icon === 'check' ? CheckCircleIcon :
                                           LightBulbIcon;
                      
                      return (
                        <div 
                          key={index}
                          className={`p-4 rounded-lg border-l-4 ${
                            suggestion.type === 'urgent' ? 'bg-red-50 border-red-400' :
                            suggestion.type === 'warning' ? 'bg-yellow-50 border-yellow-400' :
                            suggestion.type === 'success' ? 'bg-green-50 border-green-400' :
                            'bg-blue-50 border-blue-400'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <IconComponent className={`w-6 h-6 flex-shrink-0 ${
                              suggestion.type === 'urgent' ? 'text-red-600' :
                              suggestion.type === 'warning' ? 'text-yellow-600' :
                              suggestion.type === 'success' ? 'text-green-600' :
                              'text-blue-600'
                            }`} />
                            <div className="flex-1">
                              <h4 className={`font-semibold ${
                                suggestion.type === 'urgent' ? 'text-red-800' :
                                suggestion.type === 'warning' ? 'text-yellow-800' :
                                suggestion.type === 'success' ? 'text-green-800' :
                                'text-blue-800'
                              }`}>
                                {suggestion.title}
                              </h4>
                              <p className={`text-sm mt-1 ${
                                suggestion.type === 'urgent' ? 'text-red-700' :
                                suggestion.type === 'warning' ? 'text-yellow-700' :
                                suggestion.type === 'success' ? 'text-green-700' :
                                'text-blue-700'
                              }`}>
                                {suggestion.message}
                              </p>
                              <div className={`mt-2 px-3 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 ${
                                suggestion.type === 'urgent' ? 'bg-red-100 text-red-800' :
                                suggestion.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                                suggestion.type === 'success' ? 'bg-green-100 text-green-800' :
                                'bg-blue-100 text-blue-800'
                              }`}>
                                <LightBulbIcon className="w-3 h-3" /> {suggestion.action}
                              </div>
                              {suggestion.programs && suggestion.programs.length > 0 && (
                                <div className="mt-2">
                                  <p className="text-xs text-gray-600 mb-1">Affected Programs:</p>
                                  <div className="flex flex-wrap gap-1">
                                    {suggestion.programs.map((programName, idx) => (
                                      <span 
                                        key={idx}
                                        className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                                      >
                                        {programName}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="w-full space-y-8">
              {/* Enhanced Statistics Cards */}
              <SocialStats
                totalPrograms={totalPrograms}
                totalBeneficiaries={totalBeneficiaries}
                totalBudget={totalAmount}
                activePrograms={activePrograms}
                completedPrograms={completedPrograms}
                pendingPayments={pendingPaymentCount}
                averageHealthScore={averageHealthScore}
                earliestStart={earliestStart}
                latestEnd={latestEnd}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
              />

              {/* Enhanced Program Analytics Dashboard */}
              <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-8">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                    <ChartBarIcon className="w-6 h-6 text-white" />
                  </div>
                  Program Analytics Dashboard
                </h3>
                <p className="text-gray-600 text-sm">
                  Comprehensive insights into program performance and trends
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <select
                  value={selectedPeriod}
                  onChange={(e) => {
                    setSelectedPeriod(e.target.value);
                    if (e.target.value !== 'month') setSelectedMonth(0);
                    setSelectedYear('');
                  }}
                  className="px-4 py-3 border-2 border-blue-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 rounded-xl text-sm font-semibold bg-white shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <option value="month">This Month</option>
                  <option value="year">This Year</option>
                  <option value="all">All Time</option>
                </select>
                {(selectedPeriod === 'month' || selectedPeriod === 'year') && (
                  <select
                    value={selectedYear}
                    onChange={(e) => {
                      setSelectedYear(e.target.value);
                      setSelectedMonth(0);
                    }}
                    className="px-4 py-3 border-2 border-blue-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 rounded-xl text-sm font-semibold bg-white shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    <option value="">Select Year</option>
                    {Array.from({ length: 16 }, (_, i) => currentYear - 10 + i).map(year => (
                      <option key={year} value={year.toString()}>{year}</option>
                    ))}
                  </select>
                )}
                {(selectedPeriod === 'month' || selectedPeriod === 'year') && selectedYear && (
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    className="px-3 sm:px-4 py-2 sm:py-3 border-2 border-blue-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 rounded-xl text-xs sm:text-sm font-semibold bg-white shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    <option value={0}>All Months</option>
                    {[
                      { value: 1, name: 'January' },
                      { value: 2, name: 'February' },
                      { value: 3, name: 'March' },
                      { value: 4, name: 'April' },
                      { value: 5, name: 'May' },
                      { value: 6, name: 'June' },
                      { value: 7, name: 'July' },
                      { value: 8, name: 'August' },
                      { value: 9, name: 'September' },
                      { value: 10, name: 'October' },
                      { value: 11, name: 'November' },
                      { value: 12, name: 'December' }
                    ].map(m => (
                      <option key={m.value} value={m.value}>{m.name}</option>
                    ))}
                  </select>
                )}
                {(selectedPeriod === 'month' || selectedPeriod === 'year') && !selectedYear && (
                  <select
                    disabled
                    className="px-3 sm:px-4 py-2 sm:py-3 border-2 border-gray-300 bg-gray-100 text-gray-500 rounded-xl text-xs sm:text-sm font-semibold cursor-not-allowed"
                  >
                    <option>Select a year first</option>
                  </select>
                )}
              </div>
            </div>

            {/* Charts Section */}
            <SocialCharts 
              chartData={chartData}
              selectedPeriod={selectedPeriod}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              currentYear={currentYear}
              pieChartData={pieChartData}
              barChartData={barChartData}
              COLORS={COLORS}
            />

            {/* Program Performance Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {/* Most Active Program */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                    <DocumentTextIcon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-green-800">Most Active Program</h4>
                    <p className="text-sm text-green-600">
                      {selectedPeriod === 'month' ? `Month ${selectedMonth} ${selectedYear}` : 
                       selectedPeriod === 'year' ? `Year ${selectedYear}` : 'All Time'}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xl font-bold text-green-900 truncate">
                    {getMostActiveProgram(programs, beneficiaries, selectedPeriod, selectedYear, selectedMonth).name || 'No Programs'}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-bold text-green-700">
                      {getMostActiveProgram(programs, beneficiaries, selectedPeriod, selectedYear, selectedMonth).count}
                    </span>
                    <span className="text-sm text-green-600 font-medium">beneficiaries</span>
                  </div>
                </div>
              </div>

              {/* Average Performance */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                    <UserIcon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-blue-800">Average Performance</h4>
                    <p className="text-sm text-blue-600">Per Program</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-blue-900">
                      {totalPrograms > 0 ? (totalBeneficiaries / totalPrograms).toFixed(1) : '0.0'}
                    </span>
                    <span className="text-sm text-blue-600 font-medium">beneficiaries</span>
                  </div>
                  <div className="text-xs sm:text-sm text-blue-700">
                    Across {totalPrograms} programs
                  </div>
                </div>
              </div>

              {/* Program Status Overview */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-200 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                    <CheckCircleIcon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-purple-800">Status Distribution</h4>
                    <p className="text-sm text-purple-600">Program Status</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-purple-700">Ongoing</span>
                    <span className="text-lg font-bold text-purple-900">{activePrograms}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-purple-700">Draft</span>
                    <span className="text-lg font-bold text-purple-900">{draftPrograms}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-purple-700">Completed</span>
                    <span className="text-lg font-bold text-purple-900">{completedPrograms}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Program Status Distribution */}
          <div className="bg-gradient-to-br from-white to-purple-50 rounded-3xl shadow-2xl border border-purple-100 p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                    <ChartBarIcon className="w-6 h-6 text-white" />
                  </div>
                  Program Status Distribution
                </h3>
                <p className="text-gray-600 text-sm">
                  Visual breakdown of program statuses with trend analysis and drill-down insights
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm text-purple-600 bg-purple-100 px-4 py-2 rounded-full font-medium">
                  {selectedPeriod === 'month' ? `Month ${selectedMonth} ${selectedYear}` : 
                   selectedPeriod === 'year' ? `Year ${selectedYear}` : 'All Time'}
                </div>
                <button
                  onClick={() => setShowTransitionFlow(!showTransitionFlow)}
                  className="px-3 sm:px-4 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-semibold rounded-xl transition-all duration-300 shadow-sm hover:shadow-md text-xs sm:text-sm"
                >
                  {showTransitionFlow ? 'Hide Flow' : 'Show Flow'}
                </button>
              </div>
            </div>

            {/* Time-Series Trend Comparison Controls */}
            <div className="mb-8 bg-white rounded-2xl shadow-xl border border-purple-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-purple-800 flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-purple-500" />
                  Time-Series Trend Comparison
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Compare to:</span>
                  <select
                    value={trendComparison}
                    onChange={(e) => setTrendComparison(e.target.value)}
                    className="px-3 py-2 border border-purple-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
                  >
                    <option value="none">No Comparison</option>
                    <option value="month">Last Month</option>
                    <option value="quarter">Last Quarter</option>
                    <option value="year">Last Year</option>
                  </select>
                </div>
              </div>
              
              {trendComparison !== 'none' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {(() => {
                    const trendData = generateTrendComparisonData();
                    return trendData ? trendData.map((item, index) => (
                      <div key={item.status} className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: item.color }}
                            ></div>
                            <span className="text-sm font-medium text-purple-800">{item.name}</span>
                          </div>
                          <div className={`flex items-center gap-1 text-sm font-bold ${
                            item.trend === 'up' ? 'text-green-600' :
                            item.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            {item.trend === 'up' ? <ArrowTrendingUpIcon className="w-4 h-4" /> : 
                             item.trend === 'down' ? <ArrowTrendingDownIcon className="w-4 h-4" /> : 
                             <ArrowRightIcon className="w-4 h-4" />}
                            <span>{item.changePercent > 0 ? '+' : ''}{item.changePercent}%</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-2xl font-bold text-purple-900">{item.value}</div>
                          <div className="text-xs text-gray-500">
                            vs {item.previousCount} before
                          </div>
                        </div>
                        <div className="mt-2 w-full bg-gray-200 rounded-full h-1">
                          <div 
                            className={`h-1 rounded-full transition-all duration-500 ${
                              item.trend === 'up' ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                              item.trend === 'down' ? 'bg-gradient-to-r from-red-500 to-pink-500' :
                              'bg-gradient-to-r from-gray-400 to-gray-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.abs(item.changePercent) + 10)}%` }}
                          ></div>
                        </div>
                      </div>
                    )) : null;
                  })()}
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
              {/* Enhanced Pie Chart with Click Functionality */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
                <h4 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-800 mb-3 sm:mb-4 lg:mb-6 text-center">Status Breakdown</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      onClick={(data) => {
                        setSelectedStatus(data.status);
                        setShowStatusDrillDown(true);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.color}
                          style={{ 
                            filter: selectedStatus === entry.status ? 'brightness(1.2)' : 'brightness(1)',
                            transition: 'all 0.3s ease'
                          }}
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <p className="text-xs text-gray-500 text-center mt-2">Click on any segment to drill down</p>
              </div>

              {/* Enhanced Status Legend with Drill-Down */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Status Details</h4>
                {pieChartData.map((entry, index) => (
                  <div 
                    key={entry.name} 
                    className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 cursor-pointer"
                    onClick={() => {
                      setSelectedStatus(entry.status);
                      setShowStatusDrillDown(true);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full shadow-sm"
                        style={{ backgroundColor: entry.color }}
                      ></div>
                      <span className="font-medium text-gray-700">{entry.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">{entry.value}</div>
                      <div className="text-sm text-gray-500">programs</div>
                    </div>
                    <div className="text-gray-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Status Transition Flow Visualization */}
            {showTransitionFlow && (
              <div className="mt-8 bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
                <h4 className="text-base sm:text-lg font-semibold text-gray-800 mb-4 sm:mb-6 text-center">Program Lifecycle Flow</h4>
                <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 lg:space-x-8">
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mb-2">
                      <span className="text-gray-600 text-xs sm:text-sm font-bold">Draft</span>
                    </div>
                    <div className="text-xs text-gray-500 text-center">Planning Phase</div>
                  </div>
                  <div className="flex-1 flex items-center justify-center w-full sm:w-auto">
                    <div className="w-full sm:w-16 lg:w-24 h-1 bg-gradient-to-r from-gray-300 to-yellow-300 rounded-full relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-gray-300 to-yellow-300 rounded-full animate-pulse"></div>
                    </div>
                    <div className="absolute text-xs text-gray-500 bg-white px-2">→</div>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-2">
                      <span className="text-yellow-600 text-xs sm:text-sm font-bold">Ongoing</span>
                    </div>
                    <div className="text-xs text-gray-500 text-center">Active Phase</div>
                  </div>
                  <div className="flex-1 flex items-center justify-center w-full sm:w-auto">
                    <div className="w-full sm:w-16 lg:w-24 h-1 bg-gradient-to-r from-yellow-300 to-green-300 rounded-full relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-yellow-300 to-green-300 rounded-full animate-pulse"></div>
                    </div>
                    <div className="absolute text-xs text-gray-500 bg-white px-2">→</div>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mb-2">
                      <span className="text-green-600 text-xs sm:text-sm font-bold">Complete</span>
                    </div>
                    <div className="text-xs text-gray-500 text-center">Finished</div>
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-lg font-bold text-gray-700">{draftPrograms}</div>
                    <div className="text-xs text-gray-500">Draft Programs</div>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-3">
                    <div className="text-lg font-bold text-yellow-700">{activePrograms}</div>
                    <div className="text-xs text-gray-500">Active Programs</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="text-lg font-bold text-green-700">{completedPrograms}</div>
                    <div className="text-xs text-gray-500">Completed Programs</div>
                  </div>
                </div>
              </div>
            )}
          </div>


          {/* Enhanced Program Performance Comparison */}
          <div className="bg-gradient-to-br from-white to-indigo-50 rounded-3xl shadow-2xl border border-indigo-100 p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                    <ChartBarIcon className="w-6 h-6 text-white" />
                  </div>
                  Detailed Program Performance Comparison
                </h3>
                <p className="text-gray-600 text-sm">
                  Comprehensive analysis of program performance across multiple metrics
                </p>
              </div>
              <div className="text-sm text-indigo-600 bg-indigo-100 px-4 py-2 rounded-full font-medium">
                All Programs Analysis
              </div>
            </div>

            {/* Performance Metrics Calculation Breakdown */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-bold text-blue-800 flex items-center gap-2">
                  <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
                    <ChartBarIcon className="w-4 h-4 text-blue-600" />
                  </div>
                  Performance Metrics Calculation
                </h4>
                <button
                  className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold rounded-xl transition-all duration-300 shadow-sm hover:shadow-md"
                  onClick={() => setShowPerformanceCalculation(v => !v)}
                >
                  {showPerformanceCalculation ? 'Hide Details' : 'Show Details'}
                </button>
              </div>
              
              {showPerformanceCalculation && (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Performance Metrics Comparison Logic */}
                    <div className="bg-white rounded-xl p-4 border border-blue-100">
                      <h5 className="font-semibold text-blue-700 mb-3 flex items-center gap-2">
                        <ArrowTrendingUpIcon className="w-5 h-5 text-blue-500" />
                        Performance Metrics Comparison
                      </h5>
                      <div className="space-y-3 text-sm text-gray-700">
                        <div className="flex items-start gap-2">
                          <span className="text-blue-500 font-bold">•</span>
                          <div>
                            <span className="font-medium text-blue-600">Total Beneficiaries:</span>
                            <br />
                            <span className="text-gray-600">Count of all beneficiaries enrolled in each program</span>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-green-500 font-bold">•</span>
                          <div>
                            <span className="font-medium text-green-600">Paid Beneficiaries:</span>
                            <br />
                            <span className="text-gray-600">Beneficiaries with status = 'Disbursed', 'Completed', or is_paid = true</span>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-yellow-500 font-bold">•</span>
                          <div>
                            <span className="font-medium text-yellow-600">Pending Beneficiaries:</span>
                            <br />
                            <span className="text-gray-600">Beneficiaries not paid and status ≠ 'Disbursed', 'Completed', 'Rejected'</span>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-purple-500 font-bold">•</span>
                          <div>
                            <span className="font-medium text-purple-600">Payment Rate:</span>
                            <br />
                            <span className="text-gray-600">(Paid Beneficiaries ÷ Total Beneficiaries) × 100</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Detailed Performance Breakdown Logic */}
                    <div className="bg-white rounded-xl p-4 border border-blue-100">
                      <h5 className="font-semibold text-blue-700 mb-3 flex items-center gap-2">
                        <span className="text-blue-500">🔍</span>
                        Detailed Performance Breakdown
                      </h5>
                      <div className="space-y-3 text-sm text-gray-700">
                        <div className="flex items-start gap-2">
                          <span className="text-indigo-500 font-bold">•</span>
                          <div>
                            <span className="font-medium text-indigo-600">Program Status:</span>
                            <br />
                            <span className="text-gray-600">Effective status considering if all beneficiaries are paid</span>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-emerald-500 font-bold">•</span>
                          <div>
                            <span className="font-medium text-emerald-600">Health Score:</span>
                            <br />
                            <span className="text-gray-600">Composite score based on completion rate, payment rate, and status</span>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-orange-500 font-bold">•</span>
                          <div>
                            <span className="font-medium text-orange-600">Completion Rate:</span>
                            <br />
                            <span className="text-gray-600">(Current Beneficiaries ÷ Max Beneficiaries) × 100</span>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-red-500 font-bold">•</span>
                          <div>
                            <span className="font-medium text-red-600">Progress Bar:</span>
                            <br />
                            <span className="text-gray-600">Visual representation of payment completion percentage</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Health Score Calculation Details */}
                  <div className="mt-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-200">
                    <h5 className="font-semibold text-indigo-700 mb-3 flex items-center gap-2">
                      <span className="text-indigo-500">🏥</span>
                      Health Score Calculation (0-100 points)
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      <div className="bg-white rounded-lg p-3 border border-indigo-100">
                        <div className="font-medium text-indigo-600 mb-1">Completion Rate (40 pts max)</div>
                        <div className="text-gray-600 text-xs">
                          ≥90%: 40pts | ≥70%: 30pts | ≥50%: 20pts | &lt;50%: 10pts
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-indigo-100">
                        <div className="font-medium text-indigo-600 mb-1">Payment Rate (30 pts max)</div>
                        <div className="text-gray-600 text-xs">
                          ≥80%: 30pts | ≥60%: 20pts | ≥40%: 10pts | &lt;40%: 0pts
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-indigo-100">
                        <div className="font-medium text-indigo-600 mb-1">Program Status (20 pts max)</div>
                        <div className="text-gray-600 text-xs">
                          Ongoing: 20pts | Complete: 15pts | Draft: 5pts
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

            </div>
            
            {/* Enhanced Performance Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 mb-8">
              {/* Multi-Metric Bar Chart */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
                <h4 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-800 mb-3 sm:mb-4 lg:mb-6 flex items-center gap-2">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                    <ChartBarIcon className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  </div>
                  Performance Metrics Comparison
                  {selectedProgram1 && selectedProgram2 && (
                    <span className="ml-2 text-xs sm:text-sm text-gray-500 font-normal">
                      (Selected Programs Only)
                    </span>
                  )}
                </h4>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={selectedProgram1 && selectedProgram2 ? getComparisonBarChartData() : barChartData} margin={{ top: 20, right: 20, left: 10, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#666"
                      fontSize={9}
                    tickLine={false}
                    axisLine={false}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    stroke="#666"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                    }}
                    labelStyle={{ color: '#374151', fontWeight: 'bold' }}
                      formatter={(value, name) => {
                        if (name === 'beneficiaries') return [value, 'Total Beneficiaries'];
                        if (name === 'paidBeneficiaries') return [value, 'Paid Beneficiaries'];
                        if (name === 'pendingBeneficiaries') return [value, 'Pending Beneficiaries'];
                        return [value, name];
                      }}
                    labelFormatter={(label) => {
                      const item = barChartData.find(d => d.name === label);
                      return item ? item.fullName : label;
                    }}
                  />
                  <Legend />
                  <Bar 
                    dataKey="beneficiaries" 
                      fill="url(#beneficiariesGradient)"
                    radius={[4, 4, 0, 0]}
                      name="Total Beneficiaries"
                    />
                    <Bar 
                      dataKey="paidBeneficiaries" 
                      fill="url(#paidGradient)"
                      radius={[4, 4, 0, 0]}
                      name="Paid Beneficiaries"
                    />
                    <Bar 
                      dataKey="pendingBeneficiaries" 
                      fill="url(#pendingGradient)"
                      radius={[4, 4, 0, 0]}
                      name="Pending Beneficiaries"
                  />
                  <defs>
                      <linearGradient id="beneficiariesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#1d4ed8" />
                    </linearGradient>
                      <linearGradient id="paidGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#059669" />
                      </linearGradient>
                      <linearGradient id="pendingGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#d97706" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>

              {/* Detailed Performance Table */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <div className="w-6 h-6 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg flex items-center justify-center">
                    <DocumentTextIcon className="w-4 h-4 text-white" />
                  </div>
                  Detailed Performance Breakdown
                  {selectedProgram1 && selectedProgram2 && (
                    <span className="ml-2 text-sm text-gray-500 font-normal">
                      (Selected Programs Only)
                    </span>
                  )}
                </h4>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {!isDataLoaded ? (
                    <div className="text-center py-8 text-gray-500">Loading program data...</div>
                  ) : (
                    (selectedProgram1 && selectedProgram2 ? getComparisonBarChartData() : barChartData).filter(program => {
                      // Only show programs that exist in the programs array
                      return programs.some(p => p.id === program.id);
                    }).map((program, index) => {
                    const programData = programs.find(p => p.id === program.id);
                    if (!programData) return null; // Skip if program data not found
                    
                    const programBeneficiaries = getBeneficiariesByProgram(program.id);
                    const paidCount = programBeneficiaries.filter(b => b.is_paid || b.status === 'Disbursed' || b.status === 'Completed').length;
                    const pendingCount = programBeneficiaries.filter(b => 
                      !b.is_paid && 
                      b.status !== 'Disbursed' && 
                      b.status !== 'Completed' &&
                      b.status !== 'Rejected'
                    ).length;
                    const paymentRate = program.beneficiaries > 0 ? Math.round((paidCount / program.beneficiaries) * 100) : 0;
                    const effectiveStatus = getEffectiveProgramStatus(programData);
                    
                    return (
                      <div key={program.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all duration-300">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                              index === 0 ? 'bg-gradient-to-br from-yellow-400 to-orange-500' :
                              index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400' :
                              index === 2 ? 'bg-gradient-to-br from-amber-600 to-yellow-700' :
                              'bg-gradient-to-br from-indigo-500 to-blue-600'
                            }`}>
                              {index + 1}
                            </div>
                            <div>
                              <h5 className="font-semibold text-gray-900 text-sm">{program.fullName}</h5>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  effectiveStatus === 'ongoing' ? 'bg-green-100 text-green-800' :
                                  effectiveStatus === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                                  effectiveStatus === 'complete' ? 'bg-emerald-100 text-emerald-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {effectiveStatus === 'complete' && areAllBeneficiariesPaid(program.id) ? 'Complete' : 
                                   effectiveStatus ? effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1) : 'Draft'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-indigo-700">{program.beneficiaries}</div>
                            <div className="text-xs text-gray-500">total</div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          <div className="bg-green-50 rounded-lg p-2 text-center">
                            <div className="text-green-700 font-bold">{paidCount}</div>
                            <div className="text-green-600">Paid</div>
                          </div>
                          <div className="bg-yellow-50 rounded-lg p-2 text-center">
                            <div className="text-yellow-700 font-bold">{pendingCount}</div>
                            <div className="text-yellow-600">Pending</div>
                          </div>
                          <div className="bg-blue-50 rounded-lg p-2 text-center">
                            <div className="text-blue-700 font-bold">{paymentRate}%</div>
                            <div className="text-blue-600">Rate</div>
                          </div>
                        </div>
                        
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                            <span>Payment Progress</span>
                            <span>{paymentRate}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all duration-500 ${
                                paymentRate >= 80 ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                                paymentRate >= 60 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                                paymentRate >= 40 ? 'bg-gradient-to-r from-orange-500 to-red-500' :
                                'bg-gradient-to-r from-red-500 to-red-600'
                              }`}
                              style={{ width: `${paymentRate}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                  )}
                </div>
              </div>
            </div>

            {/* Performance Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              {(() => {
                // Calculate stats for selected programs or all programs
                const comparisonData = selectedProgram1 && selectedProgram2 ? getComparisonBarChartData() : null;
                const statsData = comparisonData || barChartData;
                
                const comparisonTotalBeneficiaries = statsData.reduce((sum, p) => sum + p.beneficiaries, 0);
                const comparisonPaidBeneficiaries = statsData.reduce((sum, p) => sum + p.paidBeneficiaries, 0);
                const comparisonPendingBeneficiaries = statsData.reduce((sum, p) => sum + p.pendingBeneficiaries, 0);
                const comparisonPaymentRate = comparisonTotalBeneficiaries > 0 ? Math.round((comparisonPaidBeneficiaries / comparisonTotalBeneficiaries) * 100) : 0;
                const comparisonAvgPerProgram = statsData.length > 0 ? Math.round(comparisonTotalBeneficiaries / statsData.length) : 0;
                
                return (
                  <>
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <UserIcon className="w-4 h-4 text-blue-600" />
                        </div>
                        <span className="text-sm font-medium text-blue-800">Total Beneficiaries</span>
                      </div>
                      <div className="text-2xl font-bold text-blue-900">{comparisonTotalBeneficiaries}</div>
                      <div className="text-xs text-blue-600">
                        {selectedProgram1 && selectedProgram2 ? 'Selected programs only' : 'Across all programs'}
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                          <CheckCircleIcon className="w-4 h-4 text-green-600" />
                        </div>
                        <span className="text-sm font-medium text-green-800">Paid Beneficiaries</span>
                      </div>
                      <div className="text-2xl font-bold text-green-900">{comparisonPaidBeneficiaries}</div>
                      <div className="text-xs text-green-600">{comparisonPaymentRate}% payment rate</div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-4 border border-yellow-200">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                          <ClockIcon className="w-4 h-4 text-yellow-600" />
                        </div>
                        <span className="text-sm font-medium text-yellow-800">Pending Payments</span>
                      </div>
                      <div className="text-2xl font-bold text-yellow-900">{comparisonPendingBeneficiaries}</div>
                      <div className="text-xs text-yellow-600">Awaiting processing</div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                          <ChartBarIcon className="w-4 h-4 text-purple-600" />
                        </div>
                        <span className="text-sm font-medium text-purple-800">Avg per Program</span>
                      </div>
                      <div className="text-2xl font-bold text-purple-900">{comparisonAvgPerProgram}</div>
                      <div className="text-xs text-purple-600">Beneficiaries per program</div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Program Comparison Tool */}
          <div className="bg-gradient-to-br from-white to-purple-50 rounded-3xl shadow-2xl border border-purple-100 p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                    <ChartBarIcon className="w-6 h-6 text-white" />
                  </div>
                  Program Comparison Tool
                </h3>
                <p className="text-gray-600 text-sm">
                  Compare two specific programs side by side for detailed analysis
                </p>
              </div>
              <div className="text-sm text-purple-600 bg-purple-100 px-4 py-2 rounded-full font-medium">
                Select & Compare
              </div>
            </div>

            {/* Program Selection */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 mb-8">
              <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                  <DocumentTextIcon className="w-4 h-4 text-white" />
                </div>
                Select Programs to Compare
              </h4>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Program 1 Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">First Program</label>
                  <select
                    value={selectedProgram1}
                    onChange={(e) => setSelectedProgram1(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md focus:shadow-lg"
                  >
                    <option value="">Select first program...</option>
                    {programs.map(program => (
                      <option key={program.id} value={program.id}>
                        {program.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Program 2 Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Second Program</label>
                  <select
                    value={selectedProgram2}
                    onChange={(e) => setSelectedProgram2(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md focus:shadow-lg"
                  >
                    <option value="">Select second program...</option>
                    {programs.filter(p => p.id !== selectedProgram1).map(program => (
                      <option key={program.id} value={program.id}>
                        {program.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-center mt-6">
                <button
                  onClick={() => setShowComparison(selectedProgram1 && selectedProgram2)}
                  disabled={!selectedProgram1 || !selectedProgram2}
                  className="px-6 sm:px-8 py-2 sm:py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl font-semibold shadow-lg transition-all duration-300 transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  <ChartBarIcon className="w-5 h-5" />
                  Compare Programs
                </button>
              </div>
            </div>

            {/* Comparison Results */}
            {showComparison && selectedProgram1 && selectedProgram2 && (
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
                  <div className="w-6 h-6 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                    <CheckCircleIcon className="w-4 h-4 text-white" />
                  </div>
                  Program Comparison Results
                </h4>

                {(() => {
                  // Convert string IDs to numbers for comparison
                  const program1Id = parseInt(selectedProgram1);
                  const program2Id = parseInt(selectedProgram2);
                  
                  const program1 = programs.find(p => p.id === program1Id || p.id === selectedProgram1);
                  const program2 = programs.find(p => p.id === program2Id || p.id === selectedProgram2);
                  
                  if (!program1 || !program2) return null;

                  const program1Beneficiaries = getBeneficiariesByProgram(program1.id);
                  const program2Beneficiaries = getBeneficiariesByProgram(program2.id);
                  
                  const program1Paid = program1Beneficiaries.filter(b => b.is_paid || b.status === 'Disbursed' || b.status === 'Completed').length;
                  const program2Paid = program2Beneficiaries.filter(b => b.is_paid || b.status === 'Disbursed' || b.status === 'Completed').length;
                  
                  const program1Pending = program1Beneficiaries.filter(b => 
                    !b.is_paid && 
                    b.status !== 'Disbursed' && 
                    b.status !== 'Completed' &&
                    b.status !== 'Rejected'
                  ).length;
                  const program2Pending = program2Beneficiaries.filter(b => 
                    !b.is_paid && 
                    b.status !== 'Disbursed' && 
                    b.status !== 'Completed' &&
                    b.status !== 'Rejected'
                  ).length;
                  
                  const program1PaymentRate = program1Beneficiaries.length > 0 ? Math.round((program1Paid / program1Beneficiaries.length) * 100) : 0;
                  const program2PaymentRate = program2Beneficiaries.length > 0 ? Math.round((program2Paid / program2Beneficiaries.length) * 100) : 0;
                  
                  const program1TotalAmount = program1Beneficiaries.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
                  const program2TotalAmount = program2Beneficiaries.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
                  
                  const program1Status = getEffectiveProgramStatus(program1);
                  const program2Status = getEffectiveProgramStatus(program2);

                  return (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                      {/* Program 1 Details */}
                      <div className="border border-gray-200 rounded-xl p-6 bg-gradient-to-br from-blue-50 to-indigo-50">
                        <div className="flex items-center justify-between mb-4">
                          <h5 className="text-xl font-bold text-blue-900">{program1.name}</h5>
                          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                            program1Status === 'ongoing' ? 'bg-green-100 text-green-800' :
                            program1Status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                            program1Status === 'complete' ? 'bg-emerald-100 text-emerald-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {program1Status === 'complete' && areAllBeneficiariesPaid(program1.id) ? 'Complete' : 
                             program1Status ? program1Status.charAt(0).toUpperCase() + program1Status.slice(1) : 'Draft'}
                          </span>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white rounded-lg p-3 text-center">
                              <div className="text-2xl font-bold text-blue-700">{program1Beneficiaries.length}</div>
                              <div className="text-sm text-blue-600">Total Beneficiaries</div>
                            </div>
                            <div className="bg-white rounded-lg p-3 text-center">
                              <div className="text-2xl font-bold text-green-700">{program1Paid}</div>
                              <div className="text-sm text-green-600">Paid</div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white rounded-lg p-3 text-center">
                              <div className="text-2xl font-bold text-yellow-700">{program1Pending}</div>
                              <div className="text-sm text-yellow-600">Pending</div>
                            </div>
                            <div className="bg-white rounded-lg p-3 text-center">
                              <div className="text-2xl font-bold text-purple-700">{program1PaymentRate}%</div>
                              <div className="text-sm text-purple-600">Payment Rate</div>
                            </div>
                          </div>
                          
                          <div className="bg-white rounded-lg p-3">
                            <div className="text-sm text-gray-600 mb-1">Payment Progress</div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                              <div 
                                className={`h-3 rounded-full transition-all duration-500 ${
                                  program1PaymentRate >= 80 ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                                  program1PaymentRate >= 60 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                                  program1PaymentRate >= 40 ? 'bg-gradient-to-r from-orange-500 to-red-500' :
                                  'bg-gradient-to-r from-red-500 to-red-600'
                                }`}
                                style={{ width: `${program1PaymentRate}%` }}
                              ></div>
                            </div>
                          </div>
                          
                          <div className="bg-white rounded-lg p-3">
                            <div className="text-sm text-gray-600 mb-1">Total Budget</div>
                            <div className="text-lg font-bold text-indigo-700">₱{program1TotalAmount.toLocaleString()}</div>
                          </div>
                          
                          {program1.description && (
                            <div className="bg-white rounded-lg p-3">
                              <div className="text-sm text-gray-600 mb-1">Description</div>
                              <div className="text-sm text-gray-800">{program1.description}</div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Program 2 Details */}
                      <div className="border border-gray-200 rounded-xl p-6 bg-gradient-to-br from-emerald-50 to-green-50">
                        <div className="flex items-center justify-between mb-4">
                          <h5 className="text-xl font-bold text-emerald-900">{program2.name}</h5>
                          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                            program2Status === 'ongoing' ? 'bg-green-100 text-green-800' :
                            program2Status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                            program2Status === 'complete' ? 'bg-emerald-100 text-emerald-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {program2Status === 'complete' && areAllBeneficiariesPaid(program2.id) ? 'Complete' : 
                             program2Status ? program2Status.charAt(0).toUpperCase() + program2Status.slice(1) : 'Draft'}
                          </span>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white rounded-lg p-3 text-center">
                              <div className="text-2xl font-bold text-emerald-700">{program2Beneficiaries.length}</div>
                              <div className="text-sm text-emerald-600">Total Beneficiaries</div>
                            </div>
                            <div className="bg-white rounded-lg p-3 text-center">
                              <div className="text-2xl font-bold text-green-700">{program2Paid}</div>
                              <div className="text-sm text-green-600">Paid</div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white rounded-lg p-3 text-center">
                              <div className="text-2xl font-bold text-yellow-700">{program2Pending}</div>
                              <div className="text-sm text-yellow-600">Pending</div>
                            </div>
                            <div className="bg-white rounded-lg p-3 text-center">
                              <div className="text-2xl font-bold text-purple-700">{program2PaymentRate}%</div>
                              <div className="text-sm text-purple-600">Payment Rate</div>
                            </div>
                          </div>
                          
                          <div className="bg-white rounded-lg p-3">
                            <div className="text-sm text-gray-600 mb-1">Payment Progress</div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                              <div 
                                className={`h-3 rounded-full transition-all duration-500 ${
                                  program2PaymentRate >= 80 ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                                  program2PaymentRate >= 60 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                                  program2PaymentRate >= 40 ? 'bg-gradient-to-r from-orange-500 to-red-500' :
                                  'bg-gradient-to-r from-red-500 to-red-600'
                                }`}
                                style={{ width: `${program2PaymentRate}%` }}
                              ></div>
                            </div>
                          </div>
                          
                          <div className="bg-white rounded-lg p-3">
                            <div className="text-sm text-gray-600 mb-1">Total Budget</div>
                            <div className="text-lg font-bold text-indigo-700">₱{program2TotalAmount.toLocaleString()}</div>
                          </div>
                          
                          {program2.description && (
                            <div className="bg-white rounded-lg p-3">
                              <div className="text-sm text-gray-600 mb-1">Description</div>
                              <div className="text-sm text-gray-800">{program2.description}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Comparison Summary */}
                <div className="mt-8 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-6 border border-gray-200">
                  <h5 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <div className="w-6 h-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                      <ChartBarIcon className="w-4 h-4 text-white" />
                    </div>
                    Comparison Summary
                  </h5>
                  
                  {(() => {
                    // Convert string IDs to numbers for comparison
                    const program1Id = parseInt(selectedProgram1);
                    const program2Id = parseInt(selectedProgram2);
                    
                    const program1 = programs.find(p => p.id === program1Id || p.id === selectedProgram1);
                    const program2 = programs.find(p => p.id === program2Id || p.id === selectedProgram2);
                    
                    // Debug logging
                    console.log('Comparison Debug:', {
                      selectedProgram1,
                      selectedProgram2,
                      program1Id,
                      program2Id,
                      program1: program1?.name,
                      program2: program2?.name,
                      programsCount: programs.length,
                      allProgramIds: programs.map(p => ({ id: p.id, name: p.name, idType: typeof p.id }))
                    });
                    
                    if (!program1 || !program2) {
                      return (
                        <div className="text-center py-8">
                          <div className="text-gray-500 mb-2">⚠️</div>
                          <div className="text-gray-600">
                            {!program1 && !program2 ? 'Both programs not found' :
                             !program1 ? 'First program not found' :
                             'Second program not found'}
                          </div>
                          <div className="text-sm text-gray-500 mt-2">
                            Selected IDs: {selectedProgram1} & {selectedProgram2}
                          </div>
                        </div>
                      );
                    }

                    const program1Beneficiaries = getBeneficiariesByProgram(program1.id);
                    const program2Beneficiaries = getBeneficiariesByProgram(program2.id);
                    
                    const program1Paid = program1Beneficiaries.filter(b => b.is_paid || b.status === 'Disbursed' || b.status === 'Completed').length;
                    const program2Paid = program2Beneficiaries.filter(b => b.is_paid || b.status === 'Disbursed' || b.status === 'Completed').length;
                    
                    const program1PaymentRate = program1Beneficiaries.length > 0 ? Math.round((program1Paid / program1Beneficiaries.length) * 100) : 0;
                    const program2PaymentRate = program2Beneficiaries.length > 0 ? Math.round((program2Paid / program2Beneficiaries.length) * 100) : 0;
                    
                    const program1TotalAmount = program1Beneficiaries.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
                    const program2TotalAmount = program2Beneficiaries.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

                    // Debug logging for calculations
                    console.log('Comparison Calculations:', {
                      program1: {
                        name: program1.name,
                        beneficiaries: program1Beneficiaries.length,
                        paid: program1Paid,
                        paymentRate: program1PaymentRate,
                        totalAmount: program1TotalAmount
                      },
                      program2: {
                        name: program2.name,
                        beneficiaries: program2Beneficiaries.length,
                        paid: program2Paid,
                        paymentRate: program2PaymentRate,
                        totalAmount: program2TotalAmount
                      }
                    });

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                        <div className="text-center">
                          <div className="text-sm text-gray-600 mb-2">Beneficiary Count</div>
                          <div className={`text-2xl font-bold ${
                            program1Beneficiaries.length > program2Beneficiaries.length ? 'text-blue-600' :
                            program1Beneficiaries.length < program2Beneficiaries.length ? 'text-emerald-600' :
                            'text-gray-600'
                          }`}>
                            {program1Beneficiaries.length > program2Beneficiaries.length ? 
                              `${program1.name} leads by ${program1Beneficiaries.length - program2Beneficiaries.length}` :
                              program1Beneficiaries.length < program2Beneficiaries.length ?
                              `${program2.name} leads by ${program2Beneficiaries.length - program1Beneficiaries.length}` :
                              'Tie'
                            }
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {program1.name}: {program1Beneficiaries.length} | {program2.name}: {program2Beneficiaries.length}
                          </div>
                        </div>
                        
                        <div className="text-center">
                          <div className="text-sm text-gray-600 mb-2">Payment Rate</div>
                          <div className={`text-2xl font-bold ${
                            program1PaymentRate > program2PaymentRate ? 'text-blue-600' :
                            program1PaymentRate < program2PaymentRate ? 'text-emerald-600' :
                            'text-gray-600'
                          }`}>
                            {program1PaymentRate > program2PaymentRate ? 
                              `${program1.name} leads by ${program1PaymentRate - program2PaymentRate}%` :
                              program1PaymentRate < program2PaymentRate ?
                              `${program2.name} leads by ${program2PaymentRate - program1PaymentRate}%` :
                              'Tie'
                            }
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {program1.name}: {program1PaymentRate}% | {program2.name}: {program2PaymentRate}%
                          </div>
                        </div>
                        
                        <div className="text-center">
                          <div className="text-sm text-gray-600 mb-2">Total Budget</div>
                          <div className={`text-2xl font-bold ${
                            program1TotalAmount > program2TotalAmount ? 'text-blue-600' :
                            program1TotalAmount < program2TotalAmount ? 'text-emerald-600' :
                            'text-gray-600'
                          }`}>
                            {program1TotalAmount > program2TotalAmount ? 
                              `${program1.name} leads by ₱${(program1TotalAmount - program2TotalAmount).toLocaleString()}` :
                              program1TotalAmount < program2TotalAmount ?
                              `${program2.name} leads by ₱${(program2TotalAmount - program1TotalAmount).toLocaleString()}` :
                              'Tie'
                            }
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {program1.name}: ₱{program1TotalAmount.toLocaleString()} | {program2.name}: ₱{program2TotalAmount.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="flex justify-center mt-6">
                  <button
                    onClick={() => {
                      setShowComparison(false);
                      setSelectedProgram1('');
                      setSelectedProgram2('');
                    }}
                    className="px-4 sm:px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors text-sm sm:text-base"
                  >
                    Clear Comparison
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Enhanced Top Programs Performance Table */}
          <div className="bg-gradient-to-br from-white to-emerald-50 rounded-3xl shadow-2xl border border-emerald-100 p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                    <DocumentTextIcon className="w-6 h-6 text-white" />
                  </div>
                  Top Performing Programs
                </h3>
                <p className="text-gray-600 text-sm">
                  Programs ranked by advanced weighted scoring system considering multiple performance metrics
                </p>
              </div>
              <div className="flex items-center gap-4">
                <select
                  value={programCategoryFilter}
                  onChange={(e) => setProgramCategoryFilter(e.target.value)}
                  className="px-4 py-2 bg-white border border-emerald-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300"
                >
                  <option value="all">All Categories</option>
                  <option value="health">Health</option>
                  <option value="education">Education</option>
                  <option value="livelihood">Livelihood</option>
                  <option value="social">Social</option>
                  <option value="emergency">Emergency</option>
                </select>
                <button
                  className="px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-semibold rounded-xl transition-all duration-300 shadow-sm hover:shadow-md"
                  onClick={() => setShowTopPrograms(v => !v)}
                >
                  {showTopPrograms ? 'Hide Details' : 'Show Details'}
                </button>
              </div>
            </div>
            
            {showTopPrograms && (
              <SocialTable 
                topPrograms={topPrograms}
                sortConfig={sortConfig}
                handleSort={handleSort}
                getBeneficiariesByProgram={getBeneficiariesByProgram}
                getProgramHealthScore={getProgramHealthScore}
                getProgramPaymentRate={getProgramPaymentRate}
                getProgramCompletionRate={getProgramCompletionRate}
                getProgramEfficiencyScore={getProgramEfficiencyScore}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
              />
            )}

            {/* Advanced Scoring System Breakdown */}
            <div className="mt-8 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl p-6">
              <h4 className="text-lg font-bold text-indigo-800 mb-4 flex items-center gap-2">
                <div className="w-6 h-6 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <CalculatorIcon className="w-4 h-4 text-indigo-600" />
                </div>
                Advanced Scoring System Breakdown
              </h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white rounded-xl p-4 border border-indigo-100">
                  <h5 className="font-semibold text-indigo-700 mb-3 flex items-center gap-2">
                    <UserGroupIcon className="w-5 h-5 text-blue-500" />
                    Beneficiary Count (35%)
                  </h5>
                  <div className="text-sm text-gray-700 space-y-2">
                    <div>• Normalized by maximum beneficiaries across all programs</div>
                    <div>• Rewards programs with high enrollment</div>
                    <div>• Formula: (Program Beneficiaries ÷ Max Beneficiaries) × 100</div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-4 border border-indigo-100">
                  <h5 className="font-semibold text-indigo-700 mb-3 flex items-center gap-2">
                    <CheckCircleIcon className="w-5 h-5 text-green-500" />
                    Completion Rate (25%)
                  </h5>
                  <div className="text-sm text-gray-700 space-y-2">
                    <div>• Based on enrollment vs. maximum capacity</div>
                    <div>• Measures program efficiency and reach</div>
                    <div>• Formula: (Current Beneficiaries ÷ Max Beneficiaries) × 100</div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-4 border border-indigo-100">
                  <h5 className="font-semibold text-indigo-700 mb-3 flex items-center gap-2">
                    <CreditCardIcon className="w-5 h-5 text-emerald-500" />
                    Payment Success (15%)
                  </h5>
                  <div className="text-sm text-gray-700 space-y-2">
                    <div>• Percentage of beneficiaries who received payments</div>
                    <div>• Indicates program delivery effectiveness</div>
                    <div>• Formula: (Paid Beneficiaries ÷ Total Beneficiaries) × 100</div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-4 border border-indigo-100">
                  <h5 className="font-semibold text-indigo-700 mb-3 flex items-center gap-2">
                    <SparklesIcon className="w-5 h-5 text-purple-500" />
                    Impact Score (15%)
                  </h5>
                  <div className="text-sm text-gray-700 space-y-2">
                    <div>• Based on average amount per beneficiary</div>
                    <div>• Measures financial impact and value</div>
                    <div>• Formula: (Program Avg Amount ÷ Max Avg Amount) × 100</div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-4 border border-indigo-100">
                  <h5 className="font-semibold text-indigo-700 mb-3 flex items-center gap-2">
                    <ArrowTrendingUpIcon className="w-5 h-5 text-orange-500" />
                    Growth Rate (10%)
                  </h5>
                  <div className="text-sm text-gray-700 space-y-2">
                    <div>• Month-over-month beneficiary growth</div>
                    <div>• Indicates program momentum and popularity</div>
                    <div>• Formula: ((Recent - Previous) ÷ Previous) × 100</div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-4 border border-indigo-100">
                  <h5 className="font-semibold text-indigo-700 mb-3 flex items-center gap-2">
                    <StarIcon className="w-5 h-5 text-yellow-500" />
                    Badge System
                  </h5>
                  <div className="text-sm text-gray-700 space-y-2">
                    <div>• <span className="font-medium inline-flex items-center gap-1"><ArrowTrendingUpIcon className="w-4 h-4" /> Trending:</span> Growth {'>'} 20%</div>
                    <div>• <span className="font-medium inline-flex items-center gap-1"><StarIcon className="w-4 h-4" /> Top Rated:</span> Payment Rate ≥ 90%</div>
                    <div>• <span className="font-medium inline-flex items-center gap-1"><CheckCircleIcon className="w-4 h-4" /> Excellent:</span> Completion ≥ 95%</div>
                    <div>• <span className="font-medium inline-flex items-center gap-1"><SparklesIcon className="w-4 h-4" /> High Performer:</span> Overall Score ≥ 85</div>
                  </div>
                </div>
              </div>

              <div className="mt-6 bg-white rounded-xl p-4 border border-indigo-100">
                <h6 className="font-semibold text-indigo-700 mb-2">Overall Score Calculation</h6>
                <div className="text-sm text-gray-700">
                  <strong>Formula:</strong> (Beneficiary Score × 0.35) + (Completion Score × 0.25) + (Payment Score × 0.15) + (Impact Score × 0.15) + (Growth Score × 0.10)
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  All scores are normalized to 0-100 scale for fair comparison across programs of different sizes and types.
                </div>
              </div>
            </div>
          </div>
          {/* Program Performance Overview */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2 sm:gap-3 mb-2">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                    <UserIcon className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <span className="truncate">Program Performance Overview</span>
                </h3>
                <p className="text-sm sm:text-base text-gray-600">
                  Visual comparison of beneficiary distribution across all programs
                </p>
              </div>
              <button
                className="px-3 py-2 sm:px-4 sm:py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-semibold rounded-xl transition-all duration-300 shadow-sm hover:shadow-md text-sm sm:text-base flex-shrink-0"
                onClick={() => setShowBeneficiariesBar(v => !v)}
              >
                {showBeneficiariesBar ? 'Hide Overview' : 'Show Overview'}
              </button>
            </div>
            
            {showBeneficiariesBar && (
              <div className="bg-gray-50 rounded-xl p-4 sm:p-6 w-full overflow-hidden">
                <div className="space-y-3 sm:space-y-4">
                  {beneficiariesPerProgram.map((p, index) => {
                    const maxCount = Math.max(...beneficiariesPerProgram.map(x => x.count), 1);
                    const percentage = totalBeneficiaries ? (p.count / maxCount) * 100 : 0;
                    const program = programs.find(pr => pr.id === p.id) || {};
                    
                    return (
                      <div key={p.id} className="group hover:bg-white rounded-xl p-3 sm:p-4 transition-all duration-300 border border-gray-200 w-full overflow-hidden">
                        <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between mb-3 gap-2 sm:gap-3">
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xs sm:text-sm flex-shrink-0">
                              {index + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors duration-300 text-sm sm:text-base truncate">
                                {p.name}
                              </h4>
                              <p className="text-xs sm:text-sm text-gray-500 truncate">
                                {(() => {
                                  const effectiveStatus = getEffectiveProgramStatus(program);
                                  return effectiveStatus === 'complete' && areAllBeneficiariesPaid(program.id) ? 'Complete' : 
                                          effectiveStatus ? effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1) : 'Unknown Status';
                                })()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-xl sm:text-2xl font-bold text-indigo-700">{p.count}</div>
                            <div className="text-xs sm:text-sm text-gray-500">beneficiaries</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-4">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 sm:h-3 relative overflow-hidden min-w-0">
                            <div
                              className="bg-gradient-to-r from-indigo-500 to-blue-600 h-2 sm:h-3 rounded-full transition-all duration-1000 ease-out"
                              style={{ 
                                width: `${percentage}%`, 
                                minWidth: p.count > 0 ? '4px' : '0' 
                              }}
                            ></div>
                          </div>
                          <div className="text-xs sm:text-sm font-semibold text-indigo-700 text-right min-w-[2rem] sm:min-w-[2.5rem] flex-shrink-0">
                            {percentage.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Actionable Suggestions Section */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <LightBulbIcon className="w-6 h-6 text-yellow-500" />
                Actionable Suggestions
              </h3>
              <button
                className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg font-semibold text-sm shadow transition-all duration-200"
                onClick={() => setShowSuggestions(v => !v)}
              >
                {showSuggestions ? 'Hide' : 'Show'}
              </button>
            </div>
            
            {showSuggestions && (
              <div className="space-y-3">
                {suggestions.map((suggestion, index) => {
                  const IconComponent = suggestion.icon === 'warning' ? ExclamationTriangleIcon :
                                       suggestion.icon === 'chart' ? ChartBarIcon :
                                       suggestion.icon === 'credit-card' ? CreditCardIcon :
                                       suggestion.icon === 'document' ? DocumentTextIcon :
                                       suggestion.icon === 'sparkles' ? SparklesIcon :
                                       suggestion.icon === 'check' ? CheckCircleIcon :
                                       LightBulbIcon;
                  
                  return (
                    <div 
                      key={index}
                      className={`p-4 rounded-lg border-l-4 ${
                        suggestion.type === 'urgent' ? 'bg-red-50 border-red-400' :
                        suggestion.type === 'warning' ? 'bg-yellow-50 border-yellow-400' :
                        suggestion.type === 'success' ? 'bg-green-50 border-green-400' :
                        'bg-blue-50 border-blue-400'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <IconComponent className={`w-6 h-6 flex-shrink-0 ${
                          suggestion.type === 'urgent' ? 'text-red-600' :
                          suggestion.type === 'warning' ? 'text-yellow-600' :
                          suggestion.type === 'success' ? 'text-green-600' :
                          'text-blue-600'
                        }`} />
                        <div className="flex-1">
                          <h4 className={`font-semibold ${
                            suggestion.type === 'urgent' ? 'text-red-800' :
                            suggestion.type === 'warning' ? 'text-yellow-800' :
                            suggestion.type === 'success' ? 'text-green-800' :
                            'text-blue-800'
                          }`}>
                            {suggestion.title}
                          </h4>
                          <p className={`text-sm mt-1 ${
                            suggestion.type === 'urgent' ? 'text-red-700' :
                            suggestion.type === 'warning' ? 'text-yellow-700' :
                            suggestion.type === 'success' ? 'text-green-700' :
                            'text-blue-700'
                          }`}>
                            {suggestion.message}
                          </p>
                          <div className={`mt-2 px-3 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 ${
                            suggestion.type === 'urgent' ? 'bg-red-100 text-red-800' :
                            suggestion.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                            suggestion.type === 'success' ? 'bg-green-100 text-green-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            <LightBulbIcon className="w-3 h-3" /> {suggestion.action}
                          </div>
                          {suggestion.programs && suggestion.programs.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs text-gray-600 mb-1">Affected Programs:</p>
                              <div className="flex flex-wrap gap-1">
                                {suggestion.programs.map((programName, idx) => (
                                  <span 
                                    key={idx}
                                    className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                                  >
                                    {programName}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

            </div>
          )}

          {activeTab === 'programs' && (
            <div className="space-y-8">
              {/* Add New Program Button */}
              <div className="flex justify-center sm:justify-end">
                <button
                  className="bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl shadow-lg flex items-center gap-2 sm:gap-3 text-sm sm:text-base font-semibold transition-all duration-300 transform hover:scale-105 w-full sm:w-auto justify-center"
                  onClick={handleAddProgramClick}
                >
                  <PlusIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Add New Program</span>
                  <span className="sm:hidden">Add Program</span>
                </button>
              </div>

              {/* Group Programs by Status */}
              {(() => {
                // Group programs by their effective status
                const programsByStatus = {
                  ongoing: [],
                  complete: [],
                  draft: [],
                  active: []
                };

                programs.forEach(program => {
                  const effectiveStatus = getEffectiveProgramStatus(program);
                  if (effectiveStatus === 'ongoing' || effectiveStatus === 'active') {
                    programsByStatus.ongoing.push(program);
                  } else if (effectiveStatus === 'complete') {
                    programsByStatus.complete.push(program);
                  } else {
                    programsByStatus.draft.push(program);
                  }
                });

                return (
                  <div className="space-y-12">
                    {/* Ongoing Programs Section */}
                    {programsByStatus.ongoing.length > 0 && (
                      <div className="space-y-6">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-1 h-12 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full"></div>
                            <div>
                              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                                  <ClockIcon className="w-6 h-6 text-white" />
                                </div>
                                Ongoing Programs
                              </h2>
                              <p className="text-gray-600 text-sm sm:text-base mt-1">
                                {programsByStatus.ongoing.length} active program{programsByStatus.ongoing.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                        </div>
                        <SocialCards 
                          programs={programsByStatus.ongoing}
                          getBeneficiariesByProgram={getBeneficiariesByProgram}
                          formatCurrency={formatCurrency}
                          formatDate={formatDate}
                          formatDateRange={formatDateRange}
                          handleDeleteProgram={handleDeleteProgram}
                          handleEditProgramClick={handleEditProgramClick}
                          getEffectiveProgramStatus={getEffectiveProgramStatus}
                          areAllBeneficiariesPaid={areAllBeneficiariesPaid}
                        />
                      </div>
                    )}

                    {/* Completed Programs Section */}
                    {programsByStatus.complete.length > 0 && (
                      <div className="space-y-6">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-1 h-12 bg-gradient-to-b from-emerald-500 to-green-600 rounded-full"></div>
                            <div>
                              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg">
                                  <CheckCircleIcon className="w-6 h-6 text-white" />
                                </div>
                                Completed Programs
                              </h2>
                              <p className="text-gray-600 text-sm sm:text-base mt-1">
                                {programsByStatus.complete.length} completed program{programsByStatus.complete.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                        </div>
                        <SocialCards 
                          programs={programsByStatus.complete}
                          getBeneficiariesByProgram={getBeneficiariesByProgram}
                          formatCurrency={formatCurrency}
                          formatDate={formatDate}
                          formatDateRange={formatDateRange}
                          handleDeleteProgram={handleDeleteProgram}
                          handleEditProgramClick={handleEditProgramClick}
                          getEffectiveProgramStatus={getEffectiveProgramStatus}
                          areAllBeneficiariesPaid={areAllBeneficiariesPaid}
                          compactMode={true}
                        />
                      </div>
                    )}

                    {/* Draft Programs Section */}
                    {programsByStatus.draft.length > 0 && (
                      <div className="space-y-6">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-1 h-12 bg-gradient-to-b from-gray-400 to-gray-500 rounded-full"></div>
                            <div>
                              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center shadow-lg">
                                  <DocumentTextIcon className="w-6 h-6 text-white" />
                                </div>
                                Draft Programs
                              </h2>
                              <p className="text-gray-600 text-sm sm:text-base mt-1">
                                {programsByStatus.draft.length} draft program{programsByStatus.draft.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                        </div>
                        <SocialCards 
                          programs={programsByStatus.draft}
                          getBeneficiariesByProgram={getBeneficiariesByProgram}
                          formatCurrency={formatCurrency}
                          formatDate={formatDate}
                          formatDateRange={formatDateRange}
                          handleDeleteProgram={handleDeleteProgram}
                          handleEditProgramClick={handleEditProgramClick}
                          getEffectiveProgramStatus={getEffectiveProgramStatus}
                          areAllBeneficiariesPaid={areAllBeneficiariesPaid}
                        />
                      </div>
                    )}

                    {/* Empty State */}
                    {programsByStatus.ongoing.length === 0 && 
                     programsByStatus.complete.length === 0 && 
                     programsByStatus.draft.length === 0 && (
                      <div className="text-center py-16 bg-white rounded-2xl shadow-lg border border-gray-100">
                        <DocumentTextIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-700 mb-2">No Programs Found</h3>
                        <p className="text-gray-500 mb-6">Get started by creating your first program.</p>
                        <button
                          className="bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-semibold transition-all duration-300 transform hover:scale-105 mx-auto"
                          onClick={handleAddProgramClick}
                        >
                          <PlusIcon className="w-5 h-5" />
                          Add New Program
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {activeTab === 'beneficiaries' && (
            <div className="space-y-8">
              {/* Beneficiaries Header */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                      <UserGroupIcon className="w-8 h-8 text-green-600" />
                      All Beneficiaries
                    </h2>
                    <p className="text-gray-600 mt-2">
                      Manage and view all beneficiaries across all programs
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">
                      Total: <span className="font-bold text-green-600">{beneficiaries.length}</span>
                    </span>
                  </div>
                </div>

                {/* Filters and Search */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {/* Search */}
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search beneficiaries..."
                      value={beneficiariesSearchTerm}
                      onChange={(e) => setBeneficiariesSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>

                  {/* Status Filter */}
                  <select
                    value={beneficiariesStatusFilter}
                    onChange={(e) => setBeneficiariesStatusFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="all">All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Processing">Processing</option>
                    <option value="Disbursed">Disbursed</option>
                    <option value="Completed">Completed</option>
                    <option value="Rejected">Rejected</option>
                  </select>

                  {/* Program Filter */}
                  <select
                    value={beneficiariesProgramFilter}
                    onChange={(e) => setBeneficiariesProgramFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="all">All Programs</option>
                    {programs.map(program => (
                      <option key={program.id} value={program.id}>
                        {program.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Beneficiaries Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-green-600 to-emerald-600 text-white">
                      <tr>
                        <th className="px-6 py-4 text-left font-semibold cursor-pointer" onClick={() => {
                          const direction = beneficiariesSortConfig.key === 'id' && beneficiariesSortConfig.direction === 'asc' ? 'desc' : 'asc';
                          setBeneficiariesSortConfig({ key: 'id', direction });
                        }}>
                          <div className="flex items-center gap-2">
                            ID
                            {beneficiariesSortConfig.key === 'id' && (
                              beneficiariesSortConfig.direction === 'asc' ? '↑' : '↓'
                            )}
                          </div>
                        </th>
                        <th className="px-6 py-4 text-left font-semibold cursor-pointer" onClick={() => {
                          const direction = beneficiariesSortConfig.key === 'name' && beneficiariesSortConfig.direction === 'asc' ? 'desc' : 'asc';
                          setBeneficiariesSortConfig({ key: 'name', direction });
                        }}>
                          <div className="flex items-center gap-2">
                            Name
                            {beneficiariesSortConfig.key === 'name' && (
                              beneficiariesSortConfig.direction === 'asc' ? '↑' : '↓'
                            )}
                          </div>
                        </th>
                        <th className="px-6 py-4 text-left font-semibold">Program</th>
                        <th className="px-6 py-4 text-left font-semibold">Type</th>
                        <th className="px-6 py-4 text-left font-semibold">Status</th>
                        <th className="px-6 py-4 text-left font-semibold cursor-pointer" onClick={() => {
                          const direction = beneficiariesSortConfig.key === 'amount' && beneficiariesSortConfig.direction === 'asc' ? 'desc' : 'asc';
                          setBeneficiariesSortConfig({ key: 'amount', direction });
                        }}>
                          <div className="flex items-center gap-2">
                            Amount
                            {beneficiariesSortConfig.key === 'amount' && (
                              beneficiariesSortConfig.direction === 'asc' ? '↑' : '↓'
                            )}
                          </div>
                        </th>
                        <th className="px-6 py-4 text-left font-semibold">Payment</th>
                        <th className="px-6 py-4 text-left font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {(() => {
                        // Filter beneficiaries
                        let filtered = beneficiaries.filter(b => {
                          const matchesSearch = !beneficiariesSearchTerm || 
                            b.name?.toLowerCase().includes(beneficiariesSearchTerm.toLowerCase()) ||
                            b.email?.toLowerCase().includes(beneficiariesSearchTerm.toLowerCase());
                          const matchesStatus = beneficiariesStatusFilter === 'all' || b.status === beneficiariesStatusFilter;
                          const matchesProgram = beneficiariesProgramFilter === 'all' || b.program_id === parseInt(beneficiariesProgramFilter);
                          return matchesSearch && matchesStatus && matchesProgram;
                        });

                        // Sort beneficiaries
                        if (beneficiariesSortConfig.key) {
                          filtered = [...filtered].sort((a, b) => {
                            let aVal, bVal;
                            if (beneficiariesSortConfig.key === 'id') {
                              aVal = a.id;
                              bVal = b.id;
                            } else if (beneficiariesSortConfig.key === 'name') {
                              aVal = a.name?.toLowerCase() || '';
                              bVal = b.name?.toLowerCase() || '';
                            } else if (beneficiariesSortConfig.key === 'amount') {
                              aVal = Number(a.amount) || 0;
                              bVal = Number(b.amount) || 0;
                            }
                            
                            if (aVal < bVal) return beneficiariesSortConfig.direction === 'asc' ? -1 : 1;
                            if (aVal > bVal) return beneficiariesSortConfig.direction === 'asc' ? 1 : -1;
                            return 0;
                          });
                        }

                        if (filtered.length === 0) {
                          return (
                            <tr>
                              <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                                <UserGroupIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                                <p className="text-lg font-medium">No beneficiaries found</p>
                                <p className="text-sm">Try adjusting your filters or search terms</p>
                              </td>
                            </tr>
                          );
                        }

                        return filtered.map((beneficiary) => {
                          const program = programs.find(p => p.id === beneficiary.program_id);
                          const isPaid = beneficiary.is_paid || beneficiary.status === 'Disbursed' || beneficiary.status === 'Completed';
                          
                          return (
                            <tr key={beneficiary.id} className="hover:bg-green-50 transition-colors">
                              <td className="px-6 py-4 font-medium text-gray-900">#{beneficiary.id}</td>
                              <td className="px-6 py-4">
                                <div>
                                  <div className="font-semibold text-gray-900">{beneficiary.name || 'N/A'}</div>
                                  {beneficiary.email && (
                                    <div className="text-sm text-gray-500">{beneficiary.email}</div>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-gray-700">{program?.name || 'Unknown Program'}</span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-gray-600">{beneficiary.beneficiary_type || beneficiary.beneficiaryType || 'N/A'}</span>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  beneficiary.status === 'Approved' || beneficiary.status === 'Completed' ? 'bg-green-100 text-green-800' :
                                  beneficiary.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                                  beneficiary.status === 'Processing' ? 'bg-blue-100 text-blue-800' :
                                  beneficiary.status === 'Disbursed' ? 'bg-emerald-100 text-emerald-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {beneficiary.status || 'Pending'}
                                </span>
                              </td>
                              <td className="px-6 py-4 font-semibold text-green-700">
                                {formatCurrency(beneficiary.amount)}
                              </td>
                              <td className="px-6 py-4">
                                {isPaid ? (
                                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 flex items-center gap-1 w-fit">
                                    <CheckCircleIcon className="w-4 h-4" />
                                    Paid
                                  </span>
                                ) : (
                                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                    Pending
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <button
                                  onClick={() => {
                                    if (program) {
                                      const userRole = localStorage.getItem('role') || 'admin';
                                      navigate(`/${userRole}/social-services/program/${program.id}`);
                                    }
                                  }}
                                  className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm font-medium transition-colors"
                                  title="View Program Details"
                                >
                                  View Program
                                </button>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>

                {/* Summary Stats */}
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="text-sm text-green-600 font-medium">Total Beneficiaries</div>
                    <div className="text-2xl font-bold text-green-700">{beneficiaries.length}</div>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-4">
                    <div className="text-sm text-emerald-600 font-medium">Paid</div>
                    <div className="text-2xl font-bold text-emerald-700">
                      {beneficiaries.filter(b => b.is_paid || b.status === 'Disbursed' || b.status === 'Completed').length}
                    </div>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-4">
                    <div className="text-sm text-yellow-600 font-medium">Pending</div>
                    <div className="text-2xl font-bold text-yellow-700">
                      {beneficiaries.filter(b => !b.is_paid && b.status !== 'Disbursed' && b.status !== 'Completed' && b.status !== 'Rejected').length}
                    </div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="text-sm text-blue-600 font-medium">Total Amount</div>
                    <div className="text-2xl font-bold text-blue-700">
                      {formatCurrency(beneficiaries.reduce((sum, b) => sum + (Number(b.amount) || 0), 0))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modals */}
        <SocialModals 
          showModal={showModal}
          addBeneficiaryMode={addBeneficiaryMode}
          handleModalClose={handleModalClose}
          beneficiaryFormData={beneficiaryFormData}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          programs={programs}
          showGlossary={showGlossary}
          setShowGlossary={setShowGlossary}
        />

        {/* Enhanced Add/Edit Program Modal */}
        {showProgramModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-1 sm:p-2 md:p-4 bg-black/50 backdrop-blur-md animate-fade-in">
            <div className="bg-gradient-to-br from-white via-blue-50 to-indigo-50 rounded-xl sm:rounded-2xl lg:rounded-3xl shadow-2xl border border-blue-200 w-full max-w-xs sm:max-w-sm md:max-w-2xl lg:max-w-4xl max-h-[98vh] overflow-y-auto relative animate-scale-in">
              {/* Sticky Modal Header with Stepper */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-xl sm:rounded-t-2xl lg:rounded-t-3xl p-3 sm:p-4 lg:p-8 sticky top-0 z-10 flex flex-col gap-2 shadow-md">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg sm:text-2xl font-extrabold text-white flex items-center gap-2 sm:gap-3 tracking-tight drop-shadow-lg">
                    {addProgramMode ? <PlusIcon className="w-5 h-5 sm:w-7 sm:h-7" /> : <PencilIcon className="w-5 h-5 sm:w-7 sm:h-7" />}
                    <span className="hidden sm:inline">{addProgramMode ? 'Add New Program' : 'Edit Program'}</span>
                    <span className="sm:hidden">{addProgramMode ? 'Add Program' : 'Edit'}</span>
                  </h2>
                  <button
                    onClick={handleProgramModalClose}
                    className="text-white hover:text-red-200 transition-colors duration-200 text-xl sm:text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-red-300 rounded-full p-1"
                  >
                    <XMarkIcon className="w-5 h-5 sm:w-7 sm:h-7" />
                  </button>
                </div>
                {/* Stepper - Enhanced Blue Theme */}
                <div className="flex items-center justify-center gap-1 sm:gap-2 mt-2 sm:mt-4">
                  <div className="flex flex-col items-center">
                    <DocumentTextIcon className="w-4 h-4 sm:w-6 sm:h-6 text-white bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full p-1 shadow-lg ring-2 ring-blue-400 transition-all duration-300 hover:scale-110" />
                    <span className="text-xs font-semibold text-blue-100 mt-1">Details</span>
                  </div>
                  <div className="w-6 h-1 sm:w-8 sm:h-1 bg-gradient-to-r from-blue-200 to-indigo-300 rounded-full shadow-sm transition-all duration-300" />
                  <div className="flex flex-col items-center">
                    <CalendarIcon className="w-4 h-4 sm:w-6 sm:h-6 text-white bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full p-1 shadow-lg transition-all duration-300 hover:scale-110" />
                    <span className="text-xs font-semibold text-blue-100 mt-1">Schedule</span>
                  </div>
                  <div className="w-6 h-1 sm:w-8 sm:h-1 bg-gradient-to-r from-blue-200 to-indigo-300 rounded-full shadow-sm transition-all duration-300" />
                  <div className="flex flex-col items-center">
                    <CheckCircleIcon className="w-4 h-4 sm:w-6 sm:h-6 text-white bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full p-1 shadow-lg transition-all duration-300 hover:scale-110" />
                    <span className="text-xs font-semibold text-blue-100 mt-1">Confirm</span>
                  </div>
                </div>
              </div>
              <div className="p-4 sm:p-6 lg:p-10 space-y-6 sm:space-y-10 bg-gradient-to-br from-white/80 to-blue-50/80 rounded-b-2xl sm:rounded-b-3xl animate-fadeIn">
                {/* Section Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                  {/* Program Information Section */}
                  <div className="bg-white/90 rounded-2xl shadow-lg border border-blue-100 p-4 sm:p-6 space-y-3 sm:space-y-4 animate-fadeIn transition-all duration-300 hover:shadow-xl">
                    <h3 className="text-lg font-bold text-blue-700 flex items-center gap-2 mb-2">
                      <DocumentTextIcon className="w-5 h-5" /> Program Information
                    </h3>
                    <div>
                      <label className="block text-sm font-medium text-blue-700 mb-1">Program Name</label>
                      <input
                        type="text"
                        value={programForm.name}
                        onChange={e => setProgramForm(f => ({ ...f, name: e.target.value }))}
                        className="w-full border border-blue-200 rounded-lg px-3 py-2 sm:py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm placeholder-blue-300 text-blue-900 hover:shadow-md focus:shadow-lg text-sm sm:text-base"
                        placeholder="Enter program name"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-blue-700 mb-1">Description</label>
                      <textarea
                        value={programForm.description}
                        onChange={e => setProgramForm(f => ({ ...f, description: e.target.value }))}
                        className="w-full border border-blue-200 rounded-lg px-3 py-2 sm:py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm placeholder-blue-300 text-blue-900 hover:shadow-md focus:shadow-lg text-sm sm:text-base"
                        placeholder="Enter description"
                        rows="3"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-blue-700 mb-1">Status</label>
                      <select
                        value={programForm.status}
                        onChange={e => setProgramForm(f => ({ ...f, status: e.target.value }))}
                        className="w-full border border-blue-200 rounded-lg px-3 py-2 sm:py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm text-blue-900 hover:shadow-md focus:shadow-lg text-sm sm:text-base"
                        required
                      >
                        <option value="">Select Status</option>
                        <option value="draft">Draft</option>
                        <option value="ongoing">Ongoing</option>
                        <option value="complete">Complete</option>
                      </select>
                    </div>
                  </div>

                  {/* Schedule & Capacity Section */}
                  <div className="bg-white/90 rounded-2xl shadow-lg border border-blue-100 p-4 sm:p-6 space-y-3 sm:space-y-4 animate-fadeIn transition-all duration-300 hover:shadow-xl">
                    <h3 className="text-base sm:text-lg font-bold text-blue-700 flex items-center gap-2 mb-2">
                      <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5" /> Schedule & Capacity
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-blue-700 mb-1">Start Date</label>
                        <input
                          type="date"
                          value={toInputDate(programForm.startDate)}
                          onChange={e => setProgramForm(f => ({ ...f, startDate: e.target.value }))}
                          className="w-full border border-blue-200 rounded-lg px-3 py-2 sm:py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm text-blue-900 hover:shadow-md focus:shadow-lg text-sm sm:text-base"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-blue-700 mb-1">End Date</label>
                        <input
                          type="date"
                          value={toInputDate(programForm.endDate)}
                          onChange={e => setProgramForm(f => ({ ...f, endDate: e.target.value }))}
                          className="w-full border border-blue-200 rounded-lg px-3 py-2 sm:py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm text-blue-900 hover:shadow-md focus:shadow-lg text-sm sm:text-base"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-blue-700 mb-1">Maximum Beneficiaries</label>
                      <input
                        type="number"
                        min="1"
                        value={programForm.maxBeneficiaries}
                        onChange={e => setProgramForm(f => ({ ...f, maxBeneficiaries: e.target.value }))}
                        className="w-full border border-blue-200 rounded-lg px-3 py-2 sm:py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm placeholder-blue-300 text-blue-900 hover:shadow-md focus:shadow-lg text-sm sm:text-base"
                        placeholder="Enter maximum number"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-blue-700 mb-1">Payout Date & Time (Optional)</label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="datetime-local"
                          value={toInputDateTime(programForm.payoutDate)}
                          onChange={e => {
                            const value = e.target.value;
                            if (value) {
                              // Convert to ISO format for backend
                              const date = new Date(value);
                              setProgramForm(f => ({ ...f, payoutDate: date.toISOString() }));
                            } else {
                              setProgramForm(f => ({ ...f, payoutDate: '' }));
                            }
                          }}
                          min={new Date().toISOString().slice(0, 16)} // Prevent past dates
                          className="flex-1 border border-blue-200 rounded-lg px-3 py-2 sm:py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm text-blue-900 hover:shadow-md focus:shadow-lg text-sm sm:text-base"
                        />
                        {programForm.payoutDate && (
                          <button
                            type="button"
                            onClick={() => setProgramForm(f => ({ ...f, payoutDate: '' }))}
                            className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium transition-all duration-300 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-red-300"
                            title="Remove payout date"
                          >
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-blue-600 mt-1">
                        Set a specific date and time for benefit payouts. Cannot be set to a past date/time.
                      </p>
                      {programForm.payoutDate && new Date(programForm.payoutDate) < new Date() && (
                        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          Payout date cannot be in the past
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Assistance Details Section */}
                <div className="bg-white/90 rounded-2xl shadow-lg border border-blue-100 p-6 animate-fadeIn transition-all duration-300 hover:shadow-xl">
                  <h3 className="text-lg font-bold text-blue-700 flex items-center gap-2 mb-4">
                    <HeartIcon className="w-5 h-5" /> Assistance Details
                  </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-blue-700 mb-1">Beneficiary Type</label>
                      <input
                        type="text"
                        value={programForm.beneficiaryType}
                        onChange={e => setProgramForm(f => ({ ...f, beneficiaryType: e.target.value }))}
                        className="w-full border border-blue-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm placeholder-blue-300 text-blue-900 hover:shadow-md focus:shadow-lg"
                        placeholder="Enter beneficiary type"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-blue-700 mb-1">Assistance Type</label>
                      <input
                        type="text"
                        value={programForm.assistanceType}
                        onChange={e => setProgramForm(f => ({ ...f, assistanceType: e.target.value }))}
                        className="w-full border border-blue-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm placeholder-blue-300 text-blue-900 hover:shadow-md focus:shadow-lg"
                        placeholder="Enter assistance type"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-blue-700 mb-1">Amount (₱)</label>
                      <input
                        type="number"
                        value={programForm.amount}
                        onChange={e => setProgramForm(f => ({ ...f, amount: e.target.value }))}
                        className="w-full border border-blue-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm placeholder-blue-300 text-blue-900 hover:shadow-md focus:shadow-lg"
                        placeholder="Enter amount"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Form Messages */}
                {programFormError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 animate-fade-in">
                    <div className="flex items-center gap-3">
                      <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
                      <div>
                        <h4 className="text-red-800 font-semibold">Error</h4>
                        <p className="text-red-700 text-sm">{programFormError}</p>
                      </div>
                    </div>
                  </div>
                )}

                {programFormSuccess && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 animate-fade-in">
                    <div className="flex items-center gap-3">
                      <CheckCircleIcon className="w-6 h-6 text-green-600" />
                      <div>
                        <h4 className="text-green-800 font-semibold">Success</h4>
                        <p className="text-green-700 text-sm">{programFormSuccess}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 pt-4 sm:pt-6 border-t border-blue-100 sticky bottom-0 bg-gradient-to-r from-blue-50 to-indigo-50 z-10 rounded-b-2xl sm:rounded-b-3xl animate-fadeIn">
                  <button
                    type="button"
                    onClick={handleProgramModalClose}
                    className="px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-blue-100 to-indigo-100 hover:from-blue-200 hover:to-indigo-200 text-blue-700 rounded-xl font-medium transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-opacity-50 text-sm sm:text-base"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={programFormLoading}
                    className="px-6 sm:px-8 py-2 sm:py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-lg transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 text-sm sm:text-base"
                    onClick={async e => {
                      e.preventDefault();
                      setProgramFormError('');
                      setProgramFormSuccess('');
                      
                      // Validate payout date is not in the past
                      if (programForm.payoutDate && new Date(programForm.payoutDate) < new Date()) {
                        setProgramFormError('Payout date cannot be set to a past date/time.');
                        return;
                      }
                      
                      setProgramFormLoading(true);
                      try {
                        const data = {
                          name: programForm.name,
                          description: programForm.description,
                          start_date: programForm.startDate,
                          end_date: programForm.endDate,
                          status: programForm.status,
                          beneficiary_type: programForm.beneficiaryType,
                          assistance_type: programForm.assistanceType,
                          amount: programForm.amount,
                          max_beneficiaries: programForm.maxBeneficiaries,
                          payout_date: programForm.payoutDate || null,
                        };

                        // Check if payout date has changed for email notification
                        let payoutDateChanged = false;
                        let newPayoutDate = null;
                        
                        if (editingProgram && editingProgram.id) {
                          const originalPayoutDate = editingProgram.payout_date || editingProgram.payoutDate;
                          newPayoutDate = programForm.payoutDate;
                          payoutDateChanged = originalPayoutDate !== newPayoutDate;
                          
                          console.log('Payout Date Change Debug:', {
                            originalPayoutDate,
                            newPayoutDate,
                            payoutDateChanged,
                            hasNewPayoutDate: !!newPayoutDate
                          });
                          
                          await axios.put(`/admin/programs/${editingProgram.id}`, data);
                          
                          // Send email notification if payout date changed
                          if (payoutDateChanged && newPayoutDate) {
                            console.log('Sending payout change notification...');
                            try {
                              const notificationResponse = await axios.post(`/api/admin/programs/${editingProgram.id}/notify-payout-change`, {
                                new_payout_date: newPayoutDate,
                                program_name: programForm.name
                              });
                              console.log('Notification sent successfully:', notificationResponse.data);
                              
                              // Show success modal with notification details
                              setNotificationDetails({
                                emailsSent: notificationResponse.data.data.emails_sent,
                                notificationsCreated: notificationResponse.data.data.notifications_created,
                                totalBeneficiaries: notificationResponse.data.data.total_beneficiaries,
                                programName: programForm.name,
                                newPayoutDate: newPayoutDate
                              });
                              setShowNotificationSuccessModal(true);
                            } catch (emailError) {
                              console.error('Error sending payout change notification:', emailError);
                              // Don't fail the entire operation if email fails
                            }
                          } else {
                            console.log('No payout date change detected or no new payout date');
                          }
                        } else {
                          await axios.post('/admin/programs', data);
                        }
                        
                        const successMessage = editingProgram && editingProgram.id ? 'Program updated successfully!' : 'Program added successfully!';
                        if (payoutDateChanged && newPayoutDate) {
                          setProgramFormSuccess(successMessage + ' Email notifications sent to all beneficiaries.');
                        } else {
                          setProgramFormSuccess(successMessage);
                        }
                        setShowProgramModal(false);
                        setEditingProgram(null); // Reset editing program after successful save
                        setProgramForm({ name: '', description: '', startDate: '', endDate: '', status: '', beneficiaryType: '', assistanceType: '', amount: '', maxBeneficiaries: '', payoutDate: '' });
                        
                        // Refresh programs list
                        const updatedPrograms = await fetchPrograms();
                        setPrograms(updatedPrograms);
                      } catch (err) {
                        console.error('Error saving program:', err);
                        setProgramFormError((editingProgram && editingProgram.id ? 'Failed to update program. ' : 'Failed to add program. ') + (err?.response?.data?.message || err?.message || ''));
                      } finally {
                        setProgramFormLoading(false);
                      }
                    }}
                  >
                    {programFormLoading ? (
                      <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Saving...</span>
                    ) : (
                      <><CheckCircleIcon className="w-5 h-5" /> Save Program</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Health Score Breakdown Modal */}
        {showHealthScoreBreakdown && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white rounded-xl sm:rounded-2xl max-w-xs sm:max-w-sm md:max-w-2xl lg:max-w-4xl w-full max-h-[95vh] overflow-y-auto">
              <div className="p-3 sm:p-4 lg:p-6">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800">Program Health Score Breakdown</h2>
                  <button
                    onClick={() => setShowHealthScoreBreakdown(false)}
                    className="text-gray-500 hover:text-gray-700 text-2xl"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Overall Health Score */}
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-indigo-800">Overall Health Score</h3>
                      <div className="text-3xl font-bold text-indigo-700">
                        {averageHealthScore}/100
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4">
                      <div 
                        className={`h-4 rounded-full transition-all duration-1000 ${
                          averageHealthScore >= 80 ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                          averageHealthScore >= 60 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                          averageHealthScore >= 40 ? 'bg-gradient-to-r from-orange-500 to-red-500' :
                          'bg-gradient-to-r from-red-500 to-red-600'
                        }`}
                        style={{ width: `${averageHealthScore}%` }}
                      ></div>
                    </div>
                    <div className="mt-2 text-sm text-indigo-600">
                      Average health score across {totalPrograms} programs
                    </div>
                  </div>

                  {/* Individual Program Scores */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800">Individual Program Health Scores</h3>
                    {programHealthScores.map((program, index) => (
                      <div key={program.programId} className="border border-gray-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-gray-800">{program.programName}</h4>
                          <span className="text-lg font-bold text-gray-700">{program.healthScore}/100</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-500 ${
                              program.healthScore >= 80 ? 'bg-green-500' :
                              program.healthScore >= 60 ? 'bg-yellow-500' :
                              program.healthScore >= 40 ? 'bg-orange-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${program.healthScore}%` }}
                          ></div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Completion:</span> {program.completionRate.toFixed(1)}%
                          </div>
                          <div>
                            <span className="font-medium">Payment Rate:</span> {program.paymentRate.toFixed(1)}%
                          </div>
                          <div>
                            <span className="font-medium">Beneficiaries:</span> {program.beneficiaryCount}/{program.maxBeneficiaries}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Health Score Explanation */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                    <h3 className="text-lg font-semibold text-yellow-800 mb-2">💡 How Health Scores Are Calculated</h3>
                    <div className="text-sm text-yellow-700 space-y-2">
                      <div><strong>Completion Rate (40 points max):</strong> Based on how many beneficiaries are enrolled vs. maximum capacity</div>
                      <div><strong>Payment Rate (30 points max):</strong> Percentage of approved beneficiaries who have been paid</div>
                      <div><strong>Program Status (20 points max):</strong> Ongoing programs get full points, completed get partial, draft gets minimal</div>
                      <div><strong>Additional Factors:</strong> Recent activity, beneficiary satisfaction, and program efficiency</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Notification Success Modal */}
      {showNotificationSuccessModal && notificationDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-xs sm:max-w-sm md:max-w-md w-full transform transition-all duration-300 scale-100 opacity-100">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-4 sm:px-6 lg:px-8 py-4 sm:py-6 rounded-t-2xl sm:rounded-t-3xl">
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <EnvelopeIcon className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white">Notifications Sent!</h2>
                  <p className="text-xs sm:text-sm text-green-100">Payout schedule updated successfully</p>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-8">
              <div className="space-y-6">
                {/* Program Info */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-800 mb-2">Program Details</h3>
                  <p className="text-gray-600"><strong>Program:</strong> {notificationDetails.programName}</p>
                  <p className="text-gray-600"><strong>New Payout Date:</strong> {new Date(notificationDetails.newPayoutDate).toLocaleString()}</p>
                </div>

                {/* Notification Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-blue-50 rounded-xl p-4 text-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <EnvelopeIcon className="w-6 h-6 text-blue-600" />
                    </div>
                    <p className="text-2xl font-bold text-blue-800">{notificationDetails.emailsSent}</p>
                    <p className="text-sm text-blue-600">Emails Sent</p>
                  </div>
                  
                  <div className="bg-purple-50 rounded-xl p-4 text-center">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <BellIcon className="w-6 h-6 text-purple-600" />
                    </div>
                    <p className="text-2xl font-bold text-purple-800">{notificationDetails.notificationsCreated}</p>
                    <p className="text-sm text-purple-600">In-App Notifications</p>
                  </div>
                </div>

                {/* Total Beneficiaries */}
                <div className="bg-green-50 rounded-xl p-4 text-center">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <UserGroupIcon className="w-6 h-6 text-green-600" />
                  </div>
                  <p className="text-2xl font-bold text-green-800">{notificationDetails.totalBeneficiaries}</p>
                  <p className="text-sm text-green-600">Total Beneficiaries Notified</p>
                </div>

                {/* Success Message */}
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircleIcon className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h4 className="text-green-800 font-semibold">All Notifications Delivered!</h4>
                      <p className="text-green-700 text-sm">
                        Beneficiaries have been notified via email and in-app notifications about the payout schedule change.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-3 mt-8">
                <button
                  onClick={() => setShowNotificationSuccessModal(false)}
                  className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowNotificationSuccessModal(false);
                    // Optionally refresh the page or data
                    window.location.reload();
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-medium transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  View Program Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Glossary Modal */}
      {showGlossary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl sm:rounded-2xl max-w-xs sm:max-w-sm md:max-w-2xl lg:max-w-3xl w-full max-h-[95vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-indigo-600 px-3 sm:px-4 lg:px-6 py-3 sm:py-4 rounded-t-xl sm:rounded-t-2xl z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-base sm:text-lg lg:text-xl font-bold text-white flex items-center gap-1.5 sm:gap-2">
                  <BookOpenIcon className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7" />
                  Understanding Your Analytics
                </h2>
                <button 
                  onClick={() => setShowGlossary(false)}
                  className="text-white hover:text-gray-200"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Introduction */}
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                <p className="text-sm text-blue-800">
                  <strong>Welcome!</strong> This guide explains the analytics terms and metrics you see in the dashboard. 
                  Everything is designed to help you understand program performance at a glance.
                </p>
              </div>

              {/* Glossary Terms */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <HeartIcon className="w-7 h-7 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Health Score</h3>
                    <p className="text-gray-700 mb-2">
                      A score from 0-100 that shows how well a program is performing overall. It combines multiple factors like enrollment, payments, and timeline.
                    </p>
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
                      <p className="text-sm text-blue-800">
                        <strong>Example:</strong> A score of 85 means the program is doing excellent! Most beneficiaries are enrolled, payments are on track, and everything is running smoothly.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <UserGroupIcon className="w-7 h-7 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Beneficiaries</h3>
                    <p className="text-gray-700 mb-2">
                      People who are enrolled in and receiving help from the program. Each beneficiary represents a family or individual getting assistance.
                    </p>
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
                      <p className="text-sm text-blue-800">
                        <strong>Example:</strong> If 100 beneficiaries are enrolled, it means 100 people/families are getting assistance from this program.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <CreditCardIcon className="w-7 h-7 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Payment Rate</h3>
                    <p className="text-gray-700 mb-2">
                      Percentage of enrolled people who have successfully received their money or benefits.
                    </p>
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
                      <p className="text-sm text-blue-800">
                        <strong>Example:</strong> 80% payment rate means 8 out of every 10 enrolled beneficiaries have been paid.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <ArrowTrendingUpIcon className="w-7 h-7 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Completion Rate</h3>
                    <p className="text-gray-700 mb-2">
                      How full the program is compared to its maximum capacity. Shows if you're reaching your enrollment goals.
                    </p>
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
                      <p className="text-sm text-blue-800">
                        <strong>Example:</strong> 90% completion means the program is almost at full capacity (e.g., 90 out of 100 slots filled).
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <ClockIcon className="w-7 h-7 text-yellow-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Pending</h3>
                    <p className="text-gray-700 mb-2">
                      Applications or payments that are waiting to be processed or approved. These need your attention or action.
                    </p>
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
                      <p className="text-sm text-blue-800">
                        <strong>Example:</strong> "15 pending payments" means 15 beneficiaries are waiting to receive their money and need to be processed.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <ArrowTrendingUpIcon className="w-7 h-7 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Growth Rate</h3>
                    <p className="text-gray-700 mb-2">
                      How fast the program is growing month-over-month. Shows if enrollment is increasing, decreasing, or stable.
                    </p>
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
                      <p className="text-sm text-blue-800">
                        <strong>Example:</strong> +20% growth rate means 20% more beneficiaries enrolled this month compared to last month.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <StarIcon className="w-7 h-7 text-yellow-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Performance Badges</h3>
                    <p className="text-gray-700 mb-2">
                      Special awards shown on programs that excel in specific areas.
                    </p>
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
                      <ul className="text-sm text-blue-800 space-y-1">
                        <li className="flex items-center gap-2"><ArrowTrendingUpIcon className="w-4 h-4" /> <strong>Trending:</strong> Growing fast (more than 20% growth)</li>
                        <li className="flex items-center gap-2"><StarIcon className="w-4 h-4" /> <strong>Top Rated:</strong> Excellent payment rate (90% or higher)</li>
                        <li className="flex items-center gap-2"><CheckCircleIcon className="w-4 h-4" /> <strong>Excellent:</strong> Nearly full enrollment (95% or higher)</li>
                        <li className="flex items-center gap-2"><SparklesIcon className="w-4 h-4" /> <strong>High Performer:</strong> Overall excellence (score 85+)</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Tips */}
              <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                <h3 className="text-lg font-semibold text-green-800 mb-2 flex items-center gap-2">
                  <LightBulbIcon className="w-6 h-6" /> Quick Tips
                </h3>
                <ul className="space-y-2 text-sm text-green-700">
                  <li>• <strong>Green colors</strong> = Good performance, everything on track</li>
                  <li>• <strong>Yellow colors</strong> = Needs some attention or improvement</li>
                  <li>• <strong>Red colors</strong> = Urgent issues that need immediate action</li>
                  <li>• Click on charts and metrics to see more detailed information</li>
                  <li>• Use filters (month/year) to view historical trends</li>
                  <li>• Check "Actionable Suggestions" for specific recommendations</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Drill-Down Modal */}
      {showStatusDrillDown && selectedStatus && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl sm:rounded-2xl lg:rounded-3xl shadow-2xl max-w-xs sm:max-w-sm md:max-w-2xl lg:max-w-4xl w-full max-h-[95vh] overflow-y-auto">
            <div className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800">
                  {selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1)} Programs Details
                </h2>
                <button
                  onClick={() => {
                    setShowStatusDrillDown(false);
                    setSelectedStatus(null);
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              {(() => {
                const statusPrograms = getProgramsByStatus(selectedStatus);
                const totalBeneficiaries = statusPrograms.reduce((sum, p) => sum + p.beneficiaryCount, 0);
                const totalPaid = statusPrograms.reduce((sum, p) => sum + p.paidCount, 0);
                const avgDuration = statusPrograms.length > 0 ? 
                  Math.round(statusPrograms.reduce((sum, p) => sum + p.statusDuration, 0) / statusPrograms.length) : 0;

                return (
                  <div className="space-y-6">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-blue-50 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-blue-700">{statusPrograms.length}</div>
                        <div className="text-sm text-blue-600">Total Programs</div>
                      </div>
                      <div className="bg-green-50 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-green-700">{totalBeneficiaries}</div>
                        <div className="text-sm text-green-600">Total Beneficiaries</div>
                      </div>
                      <div className="bg-purple-50 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-purple-700">{totalPaid}</div>
                        <div className="text-sm text-purple-600">Paid Beneficiaries</div>
                      </div>
                      <div className="bg-orange-50 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-orange-700">{avgDuration}</div>
                        <div className="text-sm text-orange-600">Avg Days in Status</div>
                      </div>
                    </div>

                    {/* Program List */}
                    <div className="bg-gray-50 rounded-xl p-4">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">Program Details</h3>
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {statusPrograms.map((program) => (
                          <div key={program.id} className="bg-white rounded-lg p-4 border border-gray-200">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-semibold text-gray-900">{program.name}</h4>
                              <span className="text-sm text-gray-500">{program.statusDuration} days</span>
                            </div>
                            <p className="text-sm text-gray-600 mb-3">{program.description}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                              <div className="text-center">
                                <div className="font-bold text-blue-700">{program.beneficiaryCount}</div>
                                <div className="text-gray-500">Beneficiaries</div>
                              </div>
                              <div className="text-center">
                                <div className="font-bold text-green-700">{program.paidCount}</div>
                                <div className="text-gray-500">Paid</div>
                              </div>
                              <div className="text-center">
                                <div className="font-bold text-purple-700">{program.paymentRate.toFixed(1)}%</div>
                                <div className="text-gray-500">Payment Rate</div>
                              </div>
                            </div>
                            <div className="mt-2">
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-500"
                                  style={{ width: `${Math.min(100, program.paymentRate)}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
      </main>
    </>
  );
};

export default SocialServices;