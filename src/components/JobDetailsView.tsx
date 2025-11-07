import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Briefcase,
  MapPin,
  Clock,
  DollarSign,
  Calendar,
  Share2,
  Check,
  FileText,
  TrendingUp,
  CheckCircle,
  XCircle,
  ExternalLink,
  Brain,
  Edit,
} from 'lucide-react';
import { Job, Application, Candidate } from '../lib/firebase';
import { jobService } from '../services/jobService';
import { candidateService } from '../services/candidateService';
import { getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useToast } from '../contexts/ToastContext';
import EditJobModal from './EditJobModal';

interface ApplicationWithCandidate extends Application {
  candidate?: Candidate;
}

export default function JobDetailsView() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [applications, setApplications] = useState<ApplicationWithCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (jobId) {
      fetchJobDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const fetchJobDetails = async () => {
    if (!jobId) return;

    try {
      setLoading(true);
      const jobData = await jobService.getJobById(jobId);

      if (!jobData) {
        showToast('Job not found', 'error');
        navigate('/dashboard?view=jobs');
        return;
      }

      setJob(jobData);

      // Fetch applications for this job
      const applicationsSnapshot = await getDocs(
        query(collection(db, 'applications'), where('jobId', '==', jobId))
      );

      const appsData = await Promise.all(
        applicationsSnapshot.docs.map(async (doc) => {
          const appData = doc.data();
          const application = {
            id: doc.id,
            ...appData,
            appliedAt: appData.appliedAt?.toDate() || new Date(),
            updatedAt: appData.updatedAt?.toDate() || new Date(),
            matchScore: appData.matchScore,
            skillsMatch: appData.skillsMatch,
            keywordsFound: appData.keywordsFound,
            aiSummary: appData.aiSummary,
            analyzedAt: appData.analyzedAt?.toDate() || undefined,
          } as Application;

          // Fetch candidate details
          let candidate: Candidate | null = null;
          try {
            candidate = await candidateService.getCandidateById(application.candidateId);
          } catch (error) {
            console.error('Error fetching candidate:', error);
          }

          return { ...application, candidate } as ApplicationWithCandidate;
        })
      );

      // Sort by match score (highest first), then by applied date
      appsData.sort((a, b) => {
        if (a.matchScore !== undefined && b.matchScore !== undefined) {
          return b.matchScore - a.matchScore;
        }
        if (a.matchScore !== undefined) return -1;
        if (b.matchScore !== undefined) return 1;
        return b.appliedAt.getTime() - a.appliedAt.getTime();
      });

      setApplications(appsData);
    } catch (error) {
      console.error('Error fetching job details:', error);
      showToast('Error loading job details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleShareJob = async () => {
    if (!jobId) return;
    const shareLink = `${window.location.origin}/apply/${jobId}`;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = shareLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStatusUpdate = async (newStatus: 'draft' | 'active' | 'closed') => {
    if (!jobId) return;

    try {
      setStatusUpdating(true);
      await jobService.updateJobStatus(jobId, newStatus);
      await fetchJobDetails(); // Refresh job data
    } catch (error) {
      console.error('Error updating job status:', error);
      showToast('Error updating job status', 'error');
    } finally {
      setStatusUpdating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'closed':
        return 'bg-slate-100 text-slate-800 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getApplicationStatusColor = (status: string) => {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-600">Job not found.</p>
        <button
          onClick={() => navigate('/dashboard?view=jobs')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Back to Jobs
        </button>
      </div>
    );
  }

  const shareLink = `${window.location.origin}/apply/${job.id}`;
  const stats = {
    totalApplications: applications.length,
    pending: applications.filter((app) => app.status === 'pending').length,
    screening: applications.filter((app) => app.status === 'screening').length,
    interview: applications.filter((app) => app.status === 'interview').length,
    hired: applications.filter((app) => app.status === 'hired').length,
    rejected: applications.filter((app) => app.status === 'rejected').length,
    avgMatchScore:
      applications.filter((app) => app.matchScore !== undefined).length > 0
        ? Math.round(
            applications
              .filter((app) => app.matchScore !== undefined)
              .reduce((sum, app) => sum + (app.matchScore || 0), 0) /
              applications.filter((app) => app.matchScore !== undefined).length
          )
        : null,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Jobs</span>
        </button>
        <div className="flex items-center space-x-3">
          <div className={`px-4 py-2 rounded-lg border-2 flex items-center space-x-2 ${getStatusColor(job.status)}`}>
            <span className="font-semibold capitalize">{job.status}</span>
          </div>
          {job.status === 'active' && (
            <button
              onClick={handleShareJob}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-5 h-5" />
                  <span>Share Job</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Job Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Job Details Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                  <Briefcase className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">{job.title}</h1>
                  <p className="text-sm text-slate-600 mt-1">
                    Posted {job.createdAt.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEditModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors"
                title="Edit job"
              >
                <Edit className="w-5 h-5" />
                <span>Edit</span>
              </button>
            </div>

            <div className="space-y-4">
              {/* Requirements */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {job.requirements?.location && (
                  <div className="flex items-center space-x-2 text-slate-700">
                    <MapPin className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-xs text-slate-500">Location</p>
                      <p className="font-medium">{job.requirements.location}</p>
                    </div>
                  </div>
                )}
                {job.requirements?.experience && (
                  <div className="flex items-center space-x-2 text-slate-700">
                    <Clock className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-xs text-slate-500">Experience</p>
                      <p className="font-medium">{job.requirements.experience}</p>
                    </div>
                  </div>
                )}
                {job.requirements?.salary && (
                  <div className="flex items-center space-x-2 text-slate-700">
                    <DollarSign className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-xs text-slate-500">Salary</p>
                      <p className="font-medium">{job.requirements.salary}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Description */}
              {job.description && (
                <div className="pt-4 border-t border-slate-200">
                  <h3 className="font-semibold text-slate-900 mb-2">Job Description</h3>
                  <p className="text-slate-600 whitespace-pre-wrap">{job.description}</p>
                </div>
              )}

              {/* Required Skills */}
              {job.requirements?.skills && job.requirements.skills.length > 0 && (
                <div className="pt-4 border-t border-slate-200">
                  <h3 className="font-semibold text-slate-900 mb-3">Required Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {job.requirements.skills.map((skill, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Application Link */}
              {job.status === 'active' && (
                <div className="pt-4 border-t border-slate-200">
                  <h3 className="font-semibold text-slate-900 mb-2">Application Link</h3>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={shareLink}
                      readOnly
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-sm"
                    />
                    <button
                      onClick={handleShareJob}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}

              {/* Status Update */}
              <div className="pt-4 border-t border-slate-200">
                <h3 className="font-semibold text-slate-900 mb-3">Update Job Status</h3>
                <div className="flex flex-wrap gap-3">
                  {(['draft', 'active', 'closed'] as const).map((statusOption) => (
                    <button
                      key={statusOption}
                      onClick={() => handleStatusUpdate(statusOption)}
                      disabled={statusUpdating || job.status === statusOption}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        getStatusColor(statusOption)
                      } ${
                        job.status === statusOption
                          ? 'opacity-70 cursor-not-allowed'
                          : 'hover:shadow-md cursor-pointer'
                      } ${statusUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {statusUpdating && job.status !== statusOption ? 'Updating...' : statusOption.charAt(0).toUpperCase() + statusOption.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Applications List */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <FileText className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-bold text-slate-900">Applications</h2>
              </div>
              <span className="text-sm text-slate-600">
                {applications.length} {applications.length === 1 ? 'application' : 'applications'}
              </span>
            </div>

            {applications.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No Applications Yet</h3>
                <p className="text-slate-600 mb-4">Applications for this job will appear here once candidates apply.</p>
                {job.status === 'active' && (
                  <button
                    onClick={handleShareJob}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Share Job Link
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {applications.map((app) => (
                  <div
                    key={app.id}
                    className="border border-slate-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-semibold text-slate-900">
                            {app.candidate?.name || 'Unknown Candidate'}
                          </h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getApplicationStatusColor(app.status)}`}>
                            {app.status}
                          </span>
                          {app.matchScore !== undefined && (
                            <div className="flex items-center space-x-1 px-2 py-1 bg-blue-50 rounded-full">
                              <Brain className="w-3 h-3 text-blue-600" />
                              <span className="text-xs font-semibold text-blue-600">{app.matchScore}%</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-slate-600 mb-2">
                          {app.candidate?.email && (
                            <div className="flex items-center space-x-1">
                              <span>{app.candidate.email}</span>
                            </div>
                          )}
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-4 h-4" />
                            <span>Applied {app.appliedAt.toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => navigate(`/applications/${app.id}`)}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-medium transition-colors flex items-center space-x-1"
                      >
                        <span>View</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                    {app.candidate?.resumeUrl && (
                      <div className="mt-2">
                        <a
                          href={app.candidate.resumeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                        >
                          <FileText className="w-3 h-3" />
                          <span>View Resume</span>
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stats Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm sticky top-0">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Job Statistics</h2>

            <div className="space-y-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-3xl font-bold text-slate-900 mb-1">{stats.totalApplications}</div>
                <div className="text-sm text-slate-600">Total Applications</div>
              </div>

              {stats.avgMatchScore !== null && (
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-1">
                    <Brain className="w-5 h-5 text-purple-600" />
                    <div className="text-3xl font-bold text-slate-900">{stats.avgMatchScore}%</div>
                  </div>
                  <div className="text-sm text-slate-600">Average AI Match Score</div>
                </div>
              )}

              <div className="space-y-2 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm text-slate-600">Pending</span>
                  </div>
                  <span className="font-semibold text-slate-900">{stats.pending}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm text-slate-600">Screening</span>
                  </div>
                  <span className="font-semibold text-slate-900">{stats.screening}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-slate-600">Interview</span>
                  </div>
                  <span className="font-semibold text-slate-900">{stats.interview}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-slate-600">Hired</span>
                  </div>
                  <span className="font-semibold text-slate-900">{stats.hired}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span className="text-sm text-slate-600">Rejected</span>
                  </div>
                  <span className="font-semibold text-slate-900">{stats.rejected}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Job Modal */}
      {showEditModal && job && (
        <EditJobModal
          job={job}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            fetchJobDetails(); // Refresh job data
          }}
        />
      )}
    </div>
  );
}

