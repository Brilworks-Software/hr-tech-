import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Briefcase, MapPin, Clock, DollarSign, Share2, Check, Eye, ChevronDown, Filter, Users } from 'lucide-react';
import { Job } from '../lib/firebase';
import { jobService } from '../services/jobService';
import { useAuth } from '../contexts/AuthContext';
import CreateJobModal from './CreateJobModal';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { usePostHog } from 'posthog-js/react';

export default function JobsView() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [copiedJobId, setCopiedJobId] = useState<string | null>(null);
  const [applicationCounts, setApplicationCounts] = useState<{ [jobId: string]: number }>({});
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const { currentUser } = useAuth();
  const posthog = usePostHog();

  useEffect(() => {
    posthog?.capture('jobs_view_opened', { jobsCount: jobs.length });
    
    if (!currentUser) return;

    // Only show loading if we don't have any data yet
    if (jobs.length === 0) {
      setLoading(true);
    }

    const unsubscribe = jobService.subscribeToJobs((jobsData) => {
      setJobs(jobsData);
      setLoading(false);
      // Fetch application counts for all jobs
      if (jobsData.length > 0) {
        fetchApplicationCounts(jobsData.map(job => job.id));
      }
    }, currentUser.uid);

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, posthog]); // jobs.length intentionally excluded to prevent unnecessary re-subscriptions

  const fetchApplicationCounts = async (jobIds: string[]) => {
    try {
      const counts: { [jobId: string]: number } = {};
      
      // Fetch all applications for these jobs
      const applicationsSnapshot = await getDocs(collection(db, 'applications'));
      
      // Count applications per job
      applicationsSnapshot.docs.forEach((doc) => {
        const appData = doc.data();
        const jobId = appData.jobId;
        if (jobId && jobIds.includes(jobId)) {
          counts[jobId] = (counts[jobId] || 0) + 1;
        }
      });
      
      // Set count to 0 for jobs with no applications
      jobIds.forEach((jobId) => {
        if (!counts[jobId]) {
          counts[jobId] = 0;
        }
      });
      
      setApplicationCounts(counts);
    } catch (error) {
      console.error('Error fetching application counts:', error);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setShowStatusDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch = job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || job.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'draft', label: 'Draft' },
    { value: 'closed', label: 'Closed' },
  ];

  const getStatusLabel = (value: string) => {
    return statusOptions.find(opt => opt.value === value)?.label || 'All Status';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'closed':
        return 'bg-slate-100 text-slate-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const handleShareJob = async (jobId: string) => {
    const shareLink = `${window.location.origin}/apply/${jobId}`;
    posthog?.capture('job_shared', { jobId, shareLink });
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopiedJobId(jobId);
      setTimeout(() => setCopiedJobId(null), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedJobId(jobId);
      setTimeout(() => setCopiedJobId(null), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search jobs..."
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
              <span className="text-slate-700 font-medium">{getStatusLabel(selectedStatus)}</span>
              <ChevronDown className={`w-4 h-4 text-slate-600 transition-transform ${showStatusDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showStatusDropdown && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden">
                {statusOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setSelectedStatus(option.value);
                      setShowStatusDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors ${
                      selectedStatus === option.value
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
        <button
          onClick={() => {
            posthog?.capture('create_job_clicked', { from: 'jobs_view_header' });
            setShowCreateModal(true);
          }}
          className="flex items-center space-x-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Post New Job</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-300">
          <Briefcase className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-900 mb-2">No jobs found</h3>
          <p className="text-slate-600 mb-6">
            {searchTerm ? 'Try adjusting your search criteria' : 'Get started by posting your first job'}
          </p>
          {!searchTerm && (
            <button
              onClick={() => {
                posthog?.capture('create_job_clicked', { from: 'empty_state' });
                setShowCreateModal(true);
              }}
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
            >
              <Plus className="w-5 h-5" />
              <span>Post Your First Job</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredJobs.map((job) => (
            <div
              key={job.id}
              className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-xl hover:border-blue-300 transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                  <Briefcase className="w-6 h-6 text-white" />
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                  {job.status}
                </span>
              </div>

              <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">
                {job.title}
              </h3>

              <p className="text-slate-600 text-sm mb-4 line-clamp-2">
                {job.description}
              </p>

              <div className="space-y-2 mb-4">
                {job.requirements?.location && (
                  <div className="flex items-center text-sm text-slate-600">
                    <MapPin className="w-4 h-4 mr-2 text-slate-400" />
                    {job.requirements.location}
                  </div>
                )}
                {job.requirements?.experience && (
                  <div className="flex items-center text-sm text-slate-600">
                    <Clock className="w-4 h-4 mr-2 text-slate-400" />
                    {job.requirements.experience}
                  </div>
                )}
                {job.requirements?.salary && (
                  <div className="flex items-center text-sm text-slate-600">
                    <DollarSign className="w-4 h-4 mr-2 text-slate-400" />
                    {job.requirements.salary}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <div className="flex items-center space-x-3">
                  <span className="text-xs text-slate-500">
                    Posted {job.createdAt.toLocaleDateString()}
                  </span>
                  <div className="flex items-center space-x-1 text-xs text-slate-600">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-medium">
                      {applicationCounts[job.id] ?? 0}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      posthog?.capture('job_viewed', { jobId: job.id, jobTitle: job.title });
                      navigate(`/jobs/${job.id}`);
                    }}
                    className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                    title="View job details"
                  >
                    <Eye className="w-4 h-4" />
                    <span>View</span>
                  </button>
                  {job.status === 'active' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShareJob(job.id);
                      }}
                      className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Share job link"
                    >
                      {copiedJobId === job.id ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="w-4 h-4" />
                          <span>Share</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateJobModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
          }}
        />
      )}
    </div>
  );
}
