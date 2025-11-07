import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, Calendar, TrendingUp, CheckCircle, XCircle, Clock, Video, Brain, ChevronDown, Filter, Briefcase, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Application, Job, Candidate } from '../lib/firebase';
import { applicationService } from '../services/applicationService';
import { candidateService } from '../services/candidateService';
import { jobService } from '../services/jobService';
import ScheduleInterviewModal from './ScheduleInterviewModal';
import { useToast } from '../contexts/ToastContext';

interface ApplicationWithCandidate extends Application {
  candidate?: Candidate | null;
}

function ApplicationsView() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [applications, setApplications] = useState<ApplicationWithCandidate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false); // Start as false to prevent blink on navigation
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [jobFilter, setJobFilter] = useState('all');
  const [candidateFilter, setCandidateFilter] = useState('all');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showJobDropdown, setShowJobDropdown] = useState(false);
  const [showCandidateDropdown, setShowCandidateDropdown] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const jobDropdownRef = useRef<HTMLDivElement>(null);
  const candidateDropdownRef = useRef<HTMLDivElement>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [scheduleData, setScheduleData] = useState<{
    candidateEmail: string;
    candidateName: string;
    jobTitle: string;
  } | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (!currentUser) return;

    // Only show loading if we don't have any data yet
    if (applications.length === 0) {
      setLoading(true);
    }

    const unsubscribeApps = applicationService.subscribeToApplications(async (appsData) => {
      // Fetch candidate data for each application
      const appsWithCandidates = await Promise.all(
        appsData.map(async (app) => {
          try {
            const candidate = await candidateService.getCandidateById(app.candidateId);
            return { ...app, candidate } as ApplicationWithCandidate;
          } catch (error) {
            console.error(`Error fetching candidate for application ${app.id}:`, error);
            return { ...app, candidate: null } as ApplicationWithCandidate;
          }
        })
      );
      setApplications(appsWithCandidates);
      setLoading(false);
    }, currentUser.uid);

    const unsubscribeJobs = jobService.subscribeToJobs((jobsData) => {
      setJobs(jobsData);
    }, currentUser.uid);

    return () => {
      unsubscribeApps();
      unsubscribeJobs();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]); // applications.length intentionally excluded to prevent unnecessary re-subscriptions

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setShowStatusDropdown(false);
      }
      if (jobDropdownRef.current && !jobDropdownRef.current.contains(event.target as Node)) {
        setShowJobDropdown(false);
      }
      if (candidateDropdownRef.current && !candidateDropdownRef.current.contains(event.target as Node)) {
        setShowCandidateDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'hired':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'interview':
        return <Calendar className="w-5 h-5 text-blue-600" />;
      case 'screening':
        return <TrendingUp className="w-5 h-5 text-yellow-600" />;
      default:
        return <Clock className="w-5 h-5 text-slate-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'hired':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'interview':
        return 'bg-blue-100 text-blue-800';
      case 'screening':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const filteredApplications = applications.filter((app) => {
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    const matchesJob = jobFilter === 'all' || app.jobId === jobFilter;
    const matchesCandidate = candidateFilter === 'all' || app.candidateId === candidateFilter;
    
    // Search by candidate name (and optionally job title)
    const matchesSearch = searchTerm === '' || 
      (app.candidate?.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
       jobs.find(j => j.id === app.jobId)?.title.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesStatus && matchesJob && matchesCandidate && matchesSearch;
  });

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'pending', label: 'Pending' },
    { value: 'screening', label: 'Screening' },
    { value: 'interview', label: 'Interview' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'hired', label: 'Hired' },
  ];

  const getStatusLabel = (value: string) => {
    return statusOptions.find(opt => opt.value === value)?.label || 'All Status';
  };

  const capitalizeStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const getJobLabel = (jobId: string) => {
    if (jobId === 'all') return 'All Jobs';
    const job = jobs.find(j => j.id === jobId);
    return job ? `${job.title} (${capitalizeStatus(job.status)})` : 'All Jobs';
  };

  const jobOptions = [
    { value: 'all', label: 'All Jobs' },
    ...jobs
      .sort((a, b) => a.title.localeCompare(b.title)) // Sort alphabetically
      .map(job => ({ 
        value: job.id, 
        label: `${job.title} (${capitalizeStatus(job.status)})` 
      })),
  ];

  // Get unique candidates from applications
  const uniqueCandidates = Array.from(
    new Map(
      applications
        .filter(app => app.candidate)
        .map(app => [app.candidateId, app.candidate])
    ).values()
  ).sort((a, b) => {
    if (!a || !b) return 0;
    return a.name.localeCompare(b.name);
  });

  const candidateOptions = [
    { value: 'all', label: 'All Candidates' },
    ...uniqueCandidates.map(candidate => ({
      value: candidate?.id || '',
      label: candidate?.name || 'Unknown Candidate',
    })),
  ];

  const getCandidateLabel = (candidateId: string) => {
    if (candidateId === 'all') return 'All Candidates';
    const candidate = uniqueCandidates.find(c => c?.id === candidateId);
    return candidate ? candidate.name : 'All Candidates';
  };

  const getCandidateInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search applications..."
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
          <div className="relative" ref={jobDropdownRef}>
            <button
              type="button"
              onClick={() => setShowJobDropdown(!showJobDropdown)}
              className="flex items-center space-x-2 px-4 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors bg-white"
            >
              <Briefcase className="w-4 h-4 text-slate-600" />
              <span className="text-slate-700 font-medium">{getJobLabel(jobFilter)}</span>
              <ChevronDown className={`w-4 h-4 text-slate-600 transition-transform ${showJobDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showJobDropdown && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden max-h-64 overflow-y-auto">
                {jobOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setJobFilter(option.value);
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
          <div className="relative" ref={candidateDropdownRef}>
            <button
              type="button"
              onClick={() => setShowCandidateDropdown(!showCandidateDropdown)}
              className="flex items-center space-x-2 px-4 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors bg-white"
            >
              <User className="w-4 h-4 text-slate-600" />
              <span className="text-slate-700 font-medium">{getCandidateLabel(candidateFilter)}</span>
              <ChevronDown className={`w-4 h-4 text-slate-600 transition-transform ${showCandidateDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showCandidateDropdown && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden max-h-64 overflow-y-auto">
                {candidateOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setCandidateFilter(option.value);
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
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {['pending', 'screening', 'interview', 'hired'].map((status) => {
          const count = applications.filter((app) => app.status === status).length;
          return (
            <div key={status} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-600 capitalize">{status}</span>
                {getStatusIcon(status)}
              </div>
              <p className="text-3xl font-bold text-slate-900">{count}</p>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredApplications.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-300">
          <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-900 mb-2">No applications found</h3>
          <p className="text-slate-600">
            {searchTerm ? 'Try adjusting your search criteria' : 'Applications will appear here once candidates apply'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredApplications.map((app) => (
            <div
              key={app.id}
              className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg hover:border-blue-300 transition-all relative"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4 flex-1">
                  <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    {app.candidate ? getCandidateInitials(app.candidate.name) : '?'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-bold text-slate-900">
                        {app.candidate ? app.candidate.name : 'Unknown Candidate'}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(app.status)}`}>
                        {app.status}
                      </span>
                      {app.matchScore !== undefined && (
                        <div className="flex items-center space-x-1 px-3 py-1 bg-blue-50 rounded-full">
                          <Brain className="w-4 h-4 text-blue-600" />
                          <span className="text-xs font-semibold text-blue-600">{app.matchScore}%</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-slate-600 mb-3">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1.5" />
                        {app.appliedAt.toLocaleDateString()}
                      </div>
                      {jobs.find(j => j.id === app.jobId) && (
                        <div className="flex items-center">
                          <Briefcase className="w-4 h-4 mr-1.5" />
                          {jobs.find(j => j.id === app.jobId)?.title}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  {app.status !== 'rejected' && app.status !== 'hired' && (
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        if (loadingSchedule) return;
                        
                        try {
                          setLoadingSchedule(true);
                          setSelectedApplication(app);
                          
                          // Fetch candidate and job details
                          const [candidate, job] = await Promise.all([
                            candidateService.getCandidateById(app.candidateId),
                            jobService.getJobById(app.jobId),
                          ]);
                          
                          if (!candidate) {
                            showToast('Candidate not found. The candidate may have been deleted.', 'error');
                            setLoadingSchedule(false);
                            return;
                          }
                          
                          if (!job) {
                            showToast('Job not found. The job may have been deleted.', 'error');
                            setLoadingSchedule(false);
                            return;
                          }
                          
                          setScheduleData({
                            candidateEmail: candidate.email,
                            candidateName: candidate.name,
                            jobTitle: job.title,
                          });
                          setShowScheduleModal(true);
                        } catch (error) {
                          console.error('Error loading application details:', error);
                          const err = error as Error;
                          showToast(`Error loading application details: ${err.message || 'Please try again.'}`, 'error');
                        } finally {
                          setLoadingSchedule(false);
                        }
                      }}
                      disabled={loadingSchedule}
                      className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer z-10 relative"
                    >
                      <Video className="w-4 h-4" />
                      <span>{loadingSchedule ? 'Loading...' : 'Schedule Interview'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      navigate(`/applications/${app.id}`);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-medium cursor-pointer z-10 relative"
                  >
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

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

export default ApplicationsView;
