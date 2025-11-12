import { useState, useEffect, useRef } from 'react';
import { Video, Calendar, Clock, TrendingUp, Brain, Plus, ExternalLink, X, FileText, User, Search, ChevronDown, Filter, Briefcase, Eye } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Interview, Application } from '../lib/firebase';
import { interviewService } from '../services/interviewService';
import { applicationService } from '../services/applicationService';
import { candidateService } from '../services/candidateService';
import { jobService } from '../services/jobService';
import { useToast } from '../contexts/ToastContext';
import { useNavigate } from 'react-router-dom';
import ScheduleInterviewModal from './ScheduleInterviewModal';

interface InterviewWithCandidate extends Interview {
  candidateName?: string;
  jobTitle?: string;
}

interface ApplicationWithCandidate extends Application {
  candidateName?: string;
}

export default function InterviewsView() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState<InterviewWithCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [candidateFilter, setCandidateFilter] = useState('all');
  const [jobFilter, setJobFilter] = useState('all');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showCandidateDropdown, setShowCandidateDropdown] = useState(false);
  const [showJobDropdown, setShowJobDropdown] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showApplicationSelector, setShowApplicationSelector] = useState(false);
  const [applications, setApplications] = useState<ApplicationWithCandidate[]>([]);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [scheduleData, setScheduleData] = useState<{
    candidateEmail: string;
    candidateName: string;
    jobTitle: string;
  } | null>(null);
  const [loadingApplications, setLoadingApplications] = useState(false);
  const { showToast } = useToast();
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const candidateDropdownRef = useRef<HTMLDivElement>(null);
  const jobDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentUser) return;

    // Only show loading if we don't have any data yet
    if (interviews.length === 0) {
      setLoading(true);
    }

    const unsubscribe = interviewService.subscribeToInterviews(async (interviewsData) => {
      // Fetch candidate and job information for each interview
      const interviewsWithDetails = await Promise.all(
        interviewsData.map(async (interview) => {
          try {
            // Get application to find candidate
            const application = await applicationService.getApplicationById(interview.applicationId);
            if (!application) {
              return { ...interview, candidateName: 'Unknown Candidate', jobTitle: 'Unknown Job' };
            }

            // Get candidate and job details
            const [candidate, job] = await Promise.all([
              candidateService.getCandidateById(application.candidateId),
              jobService.getJobById(application.jobId),
            ]);

            return {
              ...interview,
              candidateName: candidate?.name || 'Unknown Candidate',
              jobTitle: job?.title || 'Unknown Job',
            };
          } catch (error) {
            console.error(`Error fetching details for interview ${interview.id}:`, error);
            return { ...interview, candidateName: 'Unknown Candidate', jobTitle: 'Unknown Job' };
          }
        })
      );

      setInterviews(interviewsWithDetails);
      setLoading(false);
    }, currentUser.uid);

    fetchApplications();

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setShowStatusDropdown(false);
      }
      if (candidateDropdownRef.current && !candidateDropdownRef.current.contains(event.target as Node)) {
        setShowCandidateDropdown(false);
      }
      if (jobDropdownRef.current && !jobDropdownRef.current.contains(event.target as Node)) {
        setShowJobDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchApplications = async () => {
    if (!currentUser) return;

    try {
      // Get all applications first
      const appsData = await applicationService.getAllApplications();
      
      // Get user's jobs to filter applications
      const { getDocs, query, collection, where } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      const jobsSnapshot = await getDocs(
        query(collection(db, 'jobs'), where('createdBy', '==', currentUser.uid))
      );
      const userJobIds = new Set(jobsSnapshot.docs.map((doc) => doc.id));

      // Filter applications to only those for user's jobs and exclude rejected/hired
      const availableApps = appsData.filter(
        (app) => userJobIds.has(app.jobId) && app.status !== 'rejected' && app.status !== 'hired'
      );
      
      // Fetch candidate names for all applications
      const applicationsWithCandidates = await Promise.all(
        availableApps.map(async (app) => {
          try {
            const candidate = await candidateService.getCandidateById(app.candidateId);
            return {
              ...app,
              candidateName: candidate?.name || 'Unknown Candidate',
            };
          } catch (error) {
            console.error(`Error fetching candidate for application ${app.id}:`, error);
            return {
              ...app,
              candidateName: 'Unknown Candidate',
            };
          }
        })
      );
      
      setApplications(applicationsWithCandidates);
    } catch (error) {
      console.error('Error fetching applications:', error);
    }
  };

  const handleSelectApplication = async (app: ApplicationWithCandidate) => {
    try {
      setLoadingApplications(true);
      
      // Fetch candidate and job details
      const [candidate, job] = await Promise.all([
        candidateService.getCandidateById(app.candidateId),
        jobService.getJobById(app.jobId),
      ]);

      if (!candidate || !job) {
        showToast('Unable to load candidate or job details. Please try again.', 'error');
        setLoadingApplications(false);
        return;
      }

      setSelectedApplication(app);
      setScheduleData({
        candidateEmail: candidate.email,
        candidateName: candidate.name,
        jobTitle: job.title,
      });
      setShowApplicationSelector(false);
      setShowScheduleModal(true);
    } catch (error) {
      console.error('Error loading application details:', error);
      showToast('Error loading application details', 'error');
    } finally {
      setLoadingApplications(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'scheduled':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const handleJoinInterview = (interviewId: string) => {
    // Navigate to HR dashboard for video interview
    navigate(`/interview/${interviewId}/hr`);
  };

  const handleCopyLink = (interviewId: string) => {
    const interviewLink = `${window.location.origin}/interview/${interviewId}`;
    navigator.clipboard.writeText(interviewLink);
    showToast('Interview link copied to clipboard!', 'success');
  };

  // Filter interviews
  const filteredInterviews = interviews.filter((interview) => {
    const matchesStatus = statusFilter === 'all' || interview.status === statusFilter;
    const matchesCandidate = candidateFilter === 'all' || interview.candidateName === candidateFilter;
    const matchesJob = jobFilter === 'all' || interview.jobTitle === jobFilter;
    
    // Search by candidate name or job title
    const matchesSearch = searchTerm === '' || 
      (interview.candidateName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
       interview.jobTitle?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesStatus && matchesCandidate && matchesJob && matchesSearch;
  });

  // Get unique candidates and jobs
  const uniqueCandidates = Array.from(
    new Set(interviews.map(i => i.candidateName).filter(Boolean))
  ).sort();

  const uniqueJobs = Array.from(
    new Set(interviews.map(i => i.jobTitle).filter(Boolean))
  ).sort();

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  const candidateOptions = [
    { value: 'all', label: 'All Candidates' },
    ...uniqueCandidates.map(name => ({ value: name, label: name })),
  ];

  const jobOptions = [
    { value: 'all', label: 'All Jobs' },
    ...uniqueJobs.map(title => ({ value: title, label: title })),
  ];

  const getStatusLabel = (value: string) => {
    return statusOptions.find(opt => opt.value === value)?.label || 'All Status';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Interview Management</h3>
          <p className="text-sm text-slate-600">Schedule and manage candidate interviews</p>
        </div>
        <button
          type="button"
          onClick={() => {
            fetchApplications();
            setShowApplicationSelector(true);
          }}
          className="flex items-center space-x-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Schedule Interview</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by candidate or job..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="relative" ref={statusDropdownRef}>
          <button
            type="button"
            onClick={() => setShowStatusDropdown(!showStatusDropdown)}
            className="flex items-center space-x-2 px-4 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors bg-white"
          >
            <Filter className="w-4 h-4 text-slate-600" />
            <span className="text-slate-700 font-medium">{getStatusLabel(statusFilter)}</span>
            <ChevronDown className={`w-4 h-4 text-slate-600 transition-transform ${showStatusDropdown ? 'rotate-180' : ''}`} />
          </button>
          {showStatusDropdown && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden">
              {statusOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setStatusFilter(option.value);
                    setShowStatusDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors ${
                    statusFilter === option.value
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-slate-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="relative" ref={candidateDropdownRef}>
          <button
            type="button"
            onClick={() => setShowCandidateDropdown(!showCandidateDropdown)}
            className="flex items-center space-x-2 px-4 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors bg-white"
          >
            <User className="w-4 h-4 text-slate-600" />
            <span className="text-slate-700 font-medium">{candidateFilter === 'all' ? 'All Candidates' : candidateFilter}</span>
            <ChevronDown className={`w-4 h-4 text-slate-600 transition-transform ${showCandidateDropdown ? 'rotate-180' : ''}`} />
          </button>
          {showCandidateDropdown && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden max-h-64 overflow-y-auto">
              {candidateOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setCandidateFilter(option.value || 'all');
                    setShowCandidateDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors ${
                    candidateFilter === option.value
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-slate-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="relative" ref={jobDropdownRef}>
          <button
            type="button"
            onClick={() => setShowJobDropdown(!showJobDropdown)}
            className="flex items-center space-x-2 px-4 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors bg-white"
          >
            <Briefcase className="w-4 h-4 text-slate-600" />
            <span className="text-slate-700 font-medium">{jobFilter === 'all' ? 'All Jobs' : jobFilter}</span>
            <ChevronDown className={`w-4 h-4 text-slate-600 transition-transform ${showJobDropdown ? 'rotate-180' : ''}`} />
          </button>
          {showJobDropdown && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden max-h-64 overflow-y-auto">
              {jobOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setJobFilter(option.value || 'all');
                    setShowJobDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors ${
                    jobFilter === option.value
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-slate-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Scheduled</span>
            <Calendar className="w-5 h-5 text-yellow-600" />
          </div>
          <p className="text-3xl font-bold text-slate-900">
            {filteredInterviews.filter((i) => i.status === 'scheduled').length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">In Progress</span>
            <Video className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-slate-900">
            {filteredInterviews.filter((i) => i.status === 'in_progress').length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Completed</span>
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-slate-900">
            {filteredInterviews.filter((i) => i.status === 'completed').length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Total</span>
            <Brain className="w-5 h-5 text-cyan-600" />
          </div>
          <p className="text-3xl font-bold text-slate-900">{filteredInterviews.length}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredInterviews.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-300">
          <Video className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-900 mb-2">
            {interviews.length === 0 ? 'No interviews scheduled' : 'No interviews match your filters'}
          </h3>
          <p className="text-slate-600">
            {interviews.length === 0 
              ? 'Schedule interviews with candidates to get started'
              : 'Try adjusting your search or filter criteria'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredInterviews.map((interview) => (
            <div
              key={interview.id}
              className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-xl hover:border-blue-300 transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                    <Video className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{interview.candidateName || 'Unknown Candidate'}</h3>
                    <p className="text-sm text-slate-600">{interview.jobTitle || 'Interview'}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(interview.status)}`}>
                  {interview.status.replace('_', ' ')}
                </span>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-center text-sm text-slate-600">
                  <Calendar className="w-4 h-4 mr-2 text-slate-400" />
                  Scheduled: {interview.scheduledAt.toLocaleString()}
                </div>
                {interview.completedAt && (
                  <div className="flex items-center text-sm text-slate-600">
                    <Clock className="w-4 h-4 mr-2 text-slate-400" />
                    Completed: {interview.completedAt.toLocaleString()}
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2 mt-4">
                <button
                  onClick={() => handleJoinInterview(interview.id)}
                  className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all flex items-center justify-center space-x-2"
                >
                  <Video className="w-4 h-4" />
                  <span>Join Interview</span>
                </button>
                <button
                  onClick={() => navigate(`/interviews/${interview.id}`)}
                  className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title="View interview details"
                >
                  <Eye className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleCopyLink(interview.id)}
                  className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Copy interview link"
                >
                  <ExternalLink className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Application Selector Modal */}
      {showApplicationSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-slate-900">Select Application</h3>
                <p className="text-sm text-slate-600 mt-1">Choose an application to schedule an interview</p>
              </div>
              <button
                onClick={() => setShowApplicationSelector(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {loadingApplications ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : applications.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                  <h4 className="text-lg font-semibold text-slate-900 mb-2">No Applications Available</h4>
                  <p className="text-slate-600 mb-4">
                    There are no applications available for scheduling interviews. Applications that are rejected or hired cannot be scheduled.
                  </p>
                  <p className="text-sm text-slate-500">
                    Go to the <strong>Applications</strong> page to view all applications.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {applications.map((app) => (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => handleSelectApplication(app)}
                      className="w-full text-left p-4 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                            <User className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900">{app.candidateName || `Application #${app.id.substring(0, 8)}`}</p>
                            <p className="text-sm text-slate-600">Status: {app.status}</p>
                            <p className="text-xs text-slate-500 mt-1">
                              Applied: {app.appliedAt.toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                            Click to schedule
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Schedule Interview Modal */}
      {showScheduleModal && selectedApplication && scheduleData && (
        <ScheduleInterviewModal
          applicationId={selectedApplication.id}
          candidateEmail={scheduleData.candidateEmail}
          candidateName={scheduleData.candidateName}
          jobTitle={scheduleData.jobTitle}
          onClose={() => {
            setShowScheduleModal(false);
            setSelectedApplication(null);
            setScheduleData(null);
          }}
          onSuccess={() => {
            setShowScheduleModal(false);
            setSelectedApplication(null);
            setScheduleData(null);
            // Update application status to 'interview'
            if (selectedApplication) {
              applicationService.updateApplicationStatus(selectedApplication.id, 'interview').catch(console.error);
            }
          }}
        />
      )}
    </div>
  );
}
