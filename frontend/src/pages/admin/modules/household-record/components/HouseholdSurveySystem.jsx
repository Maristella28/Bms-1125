import React, { useState, useEffect } from 'react';
import {
  PaperAirplaneIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  CalendarIcon,
  UserGroupIcon,
  EnvelopeIcon,
  PhoneIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  ChartBarIcon,
  BellAlertIcon,
} from '@heroicons/react/24/solid';
import api from '../../../../../utils/axiosConfig';

const HouseholdSurveySystem = ({ household, onClose, onSurveySent }) => {
  const [surveyType, setSurveyType] = useState('comprehensive');
  const [notificationMethod, setNotificationMethod] = useState('email');
  const [customMessage, setCustomMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [surveyHistory, setSurveyHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Survey templates
  const surveyTemplates = {
    comprehensive: {
      name: 'Comprehensive Household Verification',
      description: 'Full household status verification including members, address, and contact information',
      questions: [
        'Are all listed household members still residing at this address?',
        'Have any family members relocated or moved away?',
        'Has any family member passed away?',
        'Are there any new household members (newborns, new residents)?',
        'Has your household address changed?',
        'Is your contact information (phone/email) still correct?',
        'Have there been changes in household income or employment?',
        'Do you need to update benefit eligibility information?',
      ],
      icon: <DocumentTextIcon className="w-5 h-5" />,
      color: 'blue',
    },
    relocation: {
      name: 'Relocation & Address Verification',
      description: 'Verify household address and member relocation status',
      questions: [
        'Are all household members still at the registered address?',
        'Have any members relocated to a different address?',
        'Please provide new addresses for relocated members',
        'Is your household planning to relocate soon?',
      ],
      icon: <UserGroupIcon className="w-5 h-5" />,
      color: 'green',
    },
    deceased: {
      name: 'Vital Status Update',
      description: 'Report deceased family members and update records',
      questions: [
        'Has any household member passed away?',
        'Please provide the name and date of passing',
        'Do you need assistance with death certificate processing?',
        'Should we update benefit allocations?',
      ],
      icon: <ExclamationTriangleIcon className="w-5 h-5" />,
      color: 'red',
    },
    contact: {
      name: 'Contact Information Update',
      description: 'Update phone numbers and email addresses',
      questions: [
        'Is your current contact number still active?',
        'Is your email address correct?',
        'Do you have an alternative contact person?',
        'Preferred method of communication?',
      ],
      icon: <PhoneIcon className="w-5 h-5" />,
      color: 'purple',
    },
    quick: {
      name: 'Quick Status Check',
      description: 'Fast verification of basic household information',
      questions: [
        'Is your household information still accurate?',
        'Any major changes to report?',
        'Need to schedule an in-person verification?',
      ],
      icon: <CheckCircleIcon className="w-5 h-5" />,
      color: 'yellow',
    },
  };

  useEffect(() => {
    fetchSurveyHistory();
  }, [household?.id]);

  const fetchSurveyHistory = async () => {
    if (!household?.id) return;
    setLoading(true);
    try {
      const response = await api.get(`/admin/households/${household.id}/surveys`);
      setSurveyHistory(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch survey history:', err);
      setSurveyHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendSurvey = async () => {
    setError(null);
    setSuccess(null);
    setIsSending(true);

    try {
      const payload = {
        household_id: household.id,
        survey_type: surveyType,
        notification_method: notificationMethod,
        custom_message: customMessage || null,
        questions: surveyTemplates[surveyType].questions,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      };

      const response = await api.post('/admin/household-surveys/send', payload);
      
      setSuccess(`Survey sent successfully via ${notificationMethod}!`);
      fetchSurveyHistory();
      
      if (onSurveySent) {
        onSurveySent(response.data.data);
      }

      // Reset form after 2 seconds
      setTimeout(() => {
        setCustomMessage('');
        setSuccess(null);
      }, 2000);

    } catch (err) {
      console.error('Failed to send survey:', err);
      setError(err.response?.data?.message || 'Failed to send survey. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const getSurveyStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-medium">
            <CheckCircleIcon className="w-3 h-3" />
            Completed
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 text-xs font-medium">
            <ClockIcon className="w-3 h-3" />
            Pending
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-800 text-xs font-medium">
            <XCircleIcon className="w-3 h-3" />
            Expired
          </span>
        );
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-medium">
            <PaperAirplaneIcon className="w-3 h-3" />
            Sent
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-800 text-xs font-medium">
            Draft
          </span>
        );
    }
  };

  const template = surveyTemplates[surveyType];
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    green: 'bg-green-50 border-green-200 text-green-800',
    red: 'bg-red-50 border-red-200 text-red-800',
    purple: 'bg-purple-50 border-purple-200 text-purple-800',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white bg-opacity-20 p-3 rounded-xl">
              <DocumentTextIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Household Survey System</h2>
              <p className="text-blue-100 text-sm">Send verification surveys to household heads</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition"
          >
            <XCircleIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Household Info */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <UserGroupIcon className="w-5 h-5 text-blue-600" />
              Household Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-600">Household No:</span>
                <span className="ml-2 font-medium">{household?.household_no || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-600">Head:</span>
                <span className="ml-2 font-medium">{household?.head_full_name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-600">Contact:</span>
                <span className="ml-2 font-medium">{household?.mobilenumber || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-600">Email:</span>
                <span className="ml-2 font-medium">{household?.email || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Survey Type Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Select Survey Type
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(surveyTemplates).map(([key, tmpl]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSurveyType(key)}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    surveyType === key
                      ? `${colorClasses[tmpl.color]} border-opacity-100 shadow-md`
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${surveyType === key ? 'bg-white bg-opacity-50' : 'bg-gray-100'}`}>
                      {tmpl.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm mb-1">{tmpl.name}</div>
                      <div className="text-xs text-gray-600 line-clamp-2">{tmpl.description}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Survey Preview */}
          <div className={`rounded-xl border-2 p-4 ${colorClasses[template.color]}`}>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              {template.icon}
              {template.name}
            </h3>
            <p className="text-sm mb-3">{template.description}</p>
            <div className="bg-white bg-opacity-50 rounded-lg p-3">
              <div className="text-xs font-semibold text-gray-700 mb-2">Survey Questions:</div>
              <ol className="text-sm space-y-1 list-decimal list-inside">
                {template.questions.map((q, idx) => (
                  <li key={idx} className="text-gray-700">{q}</li>
                ))}
              </ol>
            </div>
          </div>

          {/* Notification Method */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Notification Method
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setNotificationMethod('email')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  notificationMethod === 'email'
                    ? 'bg-blue-50 border-blue-500 shadow-md'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <EnvelopeIcon className={`w-6 h-6 mx-auto mb-2 ${notificationMethod === 'email' ? 'text-blue-600' : 'text-gray-400'}`} />
                <div className="text-sm font-semibold text-center">Email</div>
                <div className="text-xs text-gray-600 text-center mt-1">Send via email</div>
              </button>

              <button
                type="button"
                onClick={() => setNotificationMethod('print')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  notificationMethod === 'print'
                    ? 'bg-purple-50 border-purple-500 shadow-md'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <DocumentTextIcon className={`w-6 h-6 mx-auto mb-2 ${notificationMethod === 'print' ? 'text-purple-600' : 'text-gray-400'}`} />
                <div className="text-sm font-semibold text-center">Print</div>
                <div className="text-xs text-gray-600 text-center mt-1">Generate form</div>
              </button>
            </div>
          </div>

          {/* Custom Message */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Custom Message (Optional)
            </label>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Add a personalized message to the household head..."
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
            />
          </div>

          {/* Survey History */}
          {surveyHistory.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <ClockIcon className="w-5 h-5 text-gray-600" />
                Survey History
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {surveyHistory.map((survey, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-sm">{survey.survey_type_label}</div>
                      {getSurveyStatusBadge(survey.status)}
                    </div>
                    <div className="text-xs text-gray-600 space-y-1">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-3 h-3" />
                        Sent: {new Date(survey.sent_at).toLocaleDateString()}
                      </div>
                      {survey.completed_at && (
                        <div className="flex items-center gap-2">
                          <CheckCircleIcon className="w-3 h-3 text-green-600" />
                          Completed: {new Date(survey.completed_at).toLocaleDateString()}
                        </div>
                      )}
                      <div>Method: {survey.notification_method}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error/Success Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <XCircleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
              <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-green-800">{success}</div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSendSurvey}
              disabled={isSending || !household?.id}
              className={`flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium transition flex items-center justify-center gap-2 ${
                isSending || !household?.id
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:from-blue-700 hover:to-indigo-700'
              }`}
            >
              {notificationMethod === 'print' ? (
                <DocumentTextIcon className="w-5 h-5" />
              ) : (
                <PaperAirplaneIcon className="w-5 h-5" />
              )}
              {isSending 
                ? (notificationMethod === 'print' ? 'Generating...' : 'Sending...') 
                : (notificationMethod === 'print' ? 'Print Survey' : 'Send Survey')
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HouseholdSurveySystem;

