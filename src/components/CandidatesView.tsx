import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, Mail, Phone, FileText, ChevronDown, Briefcase } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Candidate, Job, Application } from '../lib/firebase';
import { candidateService } from '../services/candidateService';
import { jobService } from '../services/jobService';
import { applicationService } from '../services/applicationService';

export default function CandidatesView() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [jobFilter, setJobFilter] = useState('all');
  const [showJobDropdown, setShowJobDropdown] = useState(false);
  const jobDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentUser) return;

    // Only show loading if we don't have any data yet
    if (candidates.length === 0) {
      setLoading(true);
    }

    const unsubscribeCandidates = candidateService.subscribeToCandidates((candidatesData) => {
      setCandidates(candidatesData);
      setLoading(false);
    }, currentUser.uid);

    const unsubscribeJobs = jobService.subscribeToJobs((jobsData) => {
      setJobs(jobsData);
    }, currentUser.uid);

    const unsubscribeApps = applicationService.subscribeToApplications((appsData) => {
      setApplications(appsData);
    }, currentUser.uid);

    return () => {
      unsubscribeCandidates();
      unsubscribeJobs();
      unsubscribeApps();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]); // candidates.length intentionally excluded to prevent unnecessary re-subscriptions

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (jobDropdownRef.current && !jobDropdownRef.current.contains(event.target as Node)) {
        setShowJobDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Get candidate IDs that have applications for the selected job
  const getCandidateIdsForJob = (jobId: string) => {
    if (jobId === 'all') return new Set<string>();
    const jobApplications = applications.filter(app => app.jobId === jobId);
    return new Set(jobApplications.map(app => app.candidateId));
  };

  const filteredCandidates = candidates.filter((candidate) => {
    // Search filter
    const matchesSearch = searchTerm === '' ||
      candidate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      candidate.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Job filter
    if (jobFilter === 'all') {
      return matchesSearch;
    }
    
    const candidateIdsForJob = getCandidateIdsForJob(jobFilter);
    const matchesJob = candidateIdsForJob.has(candidate.id);
    
    return matchesSearch && matchesJob;
  });

  const capitalizeStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
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

  const getJobLabel = (jobId: string) => {
    if (jobId === 'all') return 'All Jobs';
    const job = jobs.find(j => j.id === jobId);
    return job ? `${job.title} (${capitalizeStatus(job.status)})` : 'All Jobs';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search candidates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
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
        </div>
        <div className="bg-white rounded-lg border border-slate-200 px-4 py-2.5">
          <span className="text-sm text-slate-600">Total Candidates: </span>
          <span className="text-lg font-bold text-slate-900">{filteredCandidates.length}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredCandidates.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-300">
          <Users className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-900 mb-2">No candidates found</h3>
          <p className="text-slate-600">
            {searchTerm ? 'Try adjusting your search criteria' : 'Candidates will appear here once they apply'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCandidates.map((candidate) => (
            <div
              key={candidate.id}
              className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-xl hover:border-blue-300 transition-all"
            >
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-2xl">
                  {candidate.name[0]}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-900">{candidate.name}</h3>
                  <p className="text-sm text-slate-600">Candidate</p>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm text-slate-600">
                  <Mail className="w-4 h-4 mr-2 text-slate-400" />
                  {candidate.email}
                </div>
                {candidate.phone && (
                  <div className="flex items-center text-sm text-slate-600">
                    <Phone className="w-4 h-4 mr-2 text-slate-400" />
                    {candidate.phone}
                  </div>
                )}
                {candidate.resumeUrl && (
                  <div className="flex items-center text-sm text-blue-600 hover:text-blue-700 cursor-pointer">
                    <FileText className="w-4 h-4 mr-2" />
                    View Resume
                  </div>
                )}
              </div>

              <button
                onClick={() => navigate(`/candidates/${candidate.id}`)}
                className="w-full mt-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
              >
                View Full Profile →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
