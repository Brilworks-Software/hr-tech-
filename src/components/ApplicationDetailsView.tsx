import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  FileText,
  Briefcase,
  Calendar,
  MapPin,
  DollarSign,
  Clock,
  Download,
  ExternalLink,
  CheckCircle,
  XCircle,
  TrendingUp,
  Brain,
  Award,
} from 'lucide-react';
import { Application, Candidate, Job } from '../lib/firebase';
import { applicationService } from '../services/applicationService';
import { candidateService } from '../services/candidateService';
import { jobService } from '../services/jobService';
import { useToast } from '../contexts/ToastContext';

export default function ApplicationDetailsView() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const navigate = useNavigate();
  const [application, setApplication] = useState<Application | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (applicationId) {
      fetchApplicationDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  const fetchApplicationDetails = async () => {
    if (!applicationId) return;

    try {
      setLoading(true);
      const appData = await applicationService.getApplicationById(applicationId);

      if (!appData) {
        showToast('Application not found', 'error');
        navigate('/dashboard?view=applications');
        return;
      }

      setApplication(appData);

      // Fetch candidate and job details in parallel
      const [candidateData, jobData] = await Promise.all([
        candidateService.getCandidateById(appData.candidateId),
        jobService.getJobById(appData.jobId),
      ]);

      setCandidate(candidateData);
      setJob(jobData);
    } catch (error) {
      console.error('Error fetching application details:', error);
      showToast('Error loading application details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: 'pending' | 'screening' | 'interview' | 'rejected' | 'hired') => {
    if (!applicationId) return;

    try {
      setUpdatingStatus(true);
      await applicationService.updateApplicationStatus(applicationId, newStatus);
      // Refresh application data
      const updatedApp = await applicationService.getApplicationById(applicationId);
      if (updatedApp) {
        setApplication(updatedApp);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      showToast('Error updating application status', 'error');
    } finally {
      setUpdatingStatus(false);
    }
  };

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
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'interview':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'screening':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!application || !candidate || !job) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-600">Application not found or data is missing.</p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Applications</span>
        </button>
        <div className={`px-4 py-2 rounded-lg border-2 flex items-center space-x-2 ${getStatusColor(application.status)}`}>
          {getStatusIcon(application.status)}
          <span className="font-semibold capitalize">{application.status}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Candidate Information */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                {candidate.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Candidate Details</h2>
                <p className="text-sm text-slate-500">Application #{application.id.substring(0, 8)}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center space-x-2 text-slate-600 mb-1">
                  <User className="w-4 h-4" />
                  <span className="text-sm font-medium">Name</span>
                </div>
                <p className="text-slate-900 font-medium">{candidate.name}</p>
              </div>

              <div>
                <div className="flex items-center space-x-2 text-slate-600 mb-1">
                  <Mail className="w-4 h-4" />
                  <span className="text-sm font-medium">Email</span>
                </div>
                <a
                  href={`mailto:${candidate.email}`}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  {candidate.email}
                </a>
              </div>

              {candidate.phone && (
                <div>
                  <div className="flex items-center space-x-2 text-slate-600 mb-1">
                    <Phone className="w-4 h-4" />
                    <span className="text-sm font-medium">Phone</span>
                  </div>
                  <a
                    href={`tel:${candidate.phone}`}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {candidate.phone}
                  </a>
                </div>
              )}

              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center space-x-2 text-slate-600 mb-2">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm font-medium">Applied On</span>
                </div>
                <p className="text-slate-900">
                  {application.appliedAt.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>

              {candidate.resumeUrl && (
                <div className="pt-4 border-t border-slate-200">
                  <a
                    href={candidate.resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span className="font-medium">View Resume</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Job Information and Application Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Job Information */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center space-x-3 mb-6">
              <Briefcase className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold text-slate-900">Job Information</h2>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{job.title}</h3>
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 mb-4">
                  {job.requirements?.location && (
                    <div className="flex items-center space-x-1">
                      <MapPin className="w-4 h-4" />
                      <span>{job.requirements.location}</span>
                    </div>
                  )}
                  {job.requirements?.salary && (
                    <div className="flex items-center space-x-1">
                      <DollarSign className="w-4 h-4" />
                      <span>{job.requirements.salary}</span>
                    </div>
                  )}
                  {job.requirements?.experience && (
                    <div className="flex items-center space-x-1">
                      <Clock className="w-4 h-4" />
                      <span>{job.requirements.experience}</span>
                    </div>
                  )}
                </div>
              </div>

              {job.description && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">Description</h4>
                  <p className="text-slate-600 whitespace-pre-wrap">{job.description}</p>
                </div>
              )}

              {job.requirements?.skills && job.requirements.skills.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">Required Skills</h4>
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
            </div>
          </div>

          {/* AI Match Score */}
          {application.matchScore !== undefined && (
            <div className="bg-blue-50 rounded-xl border-2 border-blue-200 p-6 shadow-sm">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">AI Resume Match</h2>
                  <p className="text-sm text-slate-600">Automated analysis against job requirements</p>
                </div>
              </div>

              {/* Match Score Display */}
              <div className="mb-6">
                <div className="flex items-end space-x-4 mb-4">
                  <div>
                    <div className="text-5xl font-bold text-slate-900">{application.matchScore}%</div>
                    <div className="text-sm text-slate-600 mt-1">Match Score</div>
                  </div>
                  <div className="flex-1">
                    <div className="h-8 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          application.matchScore >= 80
                            ? 'bg-green-500'
                            : application.matchScore >= 60
                            ? 'bg-blue-500'
                            : application.matchScore >= 40
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${application.matchScore}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Match Summary */}
                {application.aiSummary && (
                  <div className="bg-white rounded-lg p-4 border border-blue-100">
                    <p className="text-slate-700 whitespace-pre-wrap text-sm font-medium">
                      {application.aiSummary}
                    </p>
                  </div>
                )}
              </div>

              {/* Skills Match Breakdown */}
              {application.skillsMatch && application.skillsMatch.totalCount > 0 && (
                <div className="mb-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <Award className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-slate-900">
                      Skills Match: {application.skillsMatch.matchCount}/{application.skillsMatch.totalCount}
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {application.skillsMatch.found.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-green-700 mb-1">✓ Found Skills:</p>
                        <div className="flex flex-wrap gap-2">
                          {application.skillsMatch.found.map((skill, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {application.skillsMatch.missing.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-red-700 mb-1">✗ Missing Skills:</p>
                        <div className="flex flex-wrap gap-2">
                          {application.skillsMatch.missing.map((skill, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Keywords Found */}
              {application.keywordsFound && application.keywordsFound.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-700 mb-2">Relevant Keywords Found:</p>
                  <div className="flex flex-wrap gap-2">
                    {application.keywordsFound.slice(0, 10).map((keyword, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Resume Text (if available) */}
          {candidate.resumeText && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center space-x-3 mb-4">
                <FileText className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-bold text-slate-900">Resume Content</h2>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                <p className="text-slate-700 whitespace-pre-wrap text-sm">{candidate.resumeText}</p>
              </div>
            </div>
          )}

          {/* Status Update Actions */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Update Application Status</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {['pending', 'screening', 'interview', 'rejected', 'hired'].map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusUpdate(status as Application['status'])}
                  disabled={updatingStatus || application.status === status}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    application.status === status
                      ? 'bg-blue-600 text-white cursor-default'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed'
                  }`}
                >
                  {updatingStatus && application.status !== status ? 'Updating...' : status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
