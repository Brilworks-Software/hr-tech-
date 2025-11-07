import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Mail,
  Phone,
  FileText,
  Calendar,
  Briefcase,
  Download,
  ExternalLink,
  CheckCircle,
  XCircle,
  TrendingUp,
  Clock,
  Video,
  MapPin,
  DollarSign,
} from 'lucide-react';
import { Candidate, Application, Interview, Job } from '../lib/firebase';
import { candidateService } from '../services/candidateService';
import { applicationService } from '../services/applicationService';
import { interviewService } from '../services/interviewService';
import { jobService } from '../services/jobService';
import { useToast } from '../contexts/ToastContext';

interface ApplicationWithJob extends Application {
  job?: Job | null;
}

interface InterviewWithApplication extends Interview {
  application?: ApplicationWithJob | null;
}

export default function CandidateProfileView() {
  const { candidateId } = useParams<{ candidateId: string }>();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [applications, setApplications] = useState<ApplicationWithJob[]>([]);
  const [interviews, setInterviews] = useState<InterviewWithApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    if (candidateId) {
      fetchCandidateProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateId]);

  const fetchCandidateProfile = async () => {
    if (!candidateId) return;

    try {
      setLoading(true);
      
      // Fetch candidate
      const candidateData = await candidateService.getCandidateById(candidateId);
      if (!candidateData) {
        showToast('Candidate not found', 'error');
        navigate('/dashboard?view=candidates');
        return;
      }
      setCandidate(candidateData);

      // Fetch all applications for this candidate
      const allApplications = await applicationService.getAllApplications();
      const candidateApplications = allApplications.filter(
        (app) => app.candidateId === candidateId
      );

      // Fetch job details for each application
      const applicationsWithJobs = await Promise.all(
        candidateApplications.map(async (app) => {
          const job = await jobService.getJobById(app.jobId);
          return { ...app, job };
        })
      );

      setApplications(applicationsWithJobs);

      // Fetch all interviews
      const allInterviews = await interviewService.getAllInterviews();
      const candidateInterviews = allInterviews.filter((interview) =>
        candidateApplications.some((app) => app.id === interview.applicationId)
      );

      // Fetch application details for each interview
      const interviewsWithApps = await Promise.all(
        candidateInterviews.map(async (interview) => {
          const app = applicationsWithJobs.find((a) => a.id === interview.applicationId);
          return { ...interview, application: app || null };
        })
      );

      setInterviews(interviewsWithApps);
    } catch (error) {
      console.error('Error fetching candidate profile:', error);
      showToast('Error loading candidate profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'hired':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'interview':
        return <Calendar className="w-4 h-4 text-blue-600" />;
      case 'screening':
        return <TrendingUp className="w-4 h-4 text-yellow-600" />;
      default:
        return <Clock className="w-4 h-4 text-slate-600" />;
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

  const getInterviewStatusColor = (status: string) => {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-600">Candidate not found.</p>
        <button
          onClick={() => navigate('/dashboard')}
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
          <span>Back to Candidates</span>
        </button>
        <div className="text-sm text-slate-600">
          Member since {candidate.createdAt.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Candidate Information */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm sticky top-6">
            <div className="flex flex-col items-center mb-6">
              <div className="w-24 h-24 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-3xl mb-4">
                {candidate.name.charAt(0).toUpperCase()}
              </div>
              <h2 className="text-2xl font-bold text-slate-900 text-center">{candidate.name}</h2>
              <p className="text-sm text-slate-500 mt-1">Candidate Profile</p>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center space-x-2 text-slate-600 mb-1">
                  <Mail className="w-4 h-4" />
                  <span className="text-sm font-medium">Email</span>
                </div>
                <a
                  href={`mailto:${candidate.email}`}
                  className="text-blue-600 hover:text-blue-700 font-medium text-sm break-all"
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
                    className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                  >
                    {candidate.phone}
                  </a>
                </div>
              )}

              {candidate.resumeUrl && (
                <div className="pt-4 border-t border-slate-200">
                  <a
                    href={candidate.resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span className="font-medium">Download Resume</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}

              <div className="pt-4 border-t border-slate-200">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{applications.length}</p>
                    <p className="text-xs text-slate-600">Applications</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{interviews.length}</p>
                    <p className="text-xs text-slate-600">Interviews</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Applications and Interviews */}
        <div className="lg:col-span-2 space-y-6">
          {/* Resume Content */}
          {candidate.resumeText && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center space-x-3 mb-4">
                <FileText className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-bold text-slate-900">Resume Content</h2>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                <p className="text-slate-700 whitespace-pre-wrap text-sm">{candidate.resumeText}</p>
              </div>
            </div>
          )}

          {/* Applications */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <Briefcase className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-bold text-slate-900">Applications</h2>
              </div>
              <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm font-medium">
                {applications.length}
              </span>
            </div>

            {applications.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Briefcase className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>No applications yet</p>
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
                        <h3 className="font-semibold text-slate-900 mb-1">
                          {app.job?.title || 'Job Title Not Available'}
                        </h3>
                        {app.job && (
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mb-2">
                            {app.job.requirements?.location && (
                              <div className="flex items-center space-x-1">
                                <MapPin className="w-3 h-3" />
                                <span>{app.job.requirements.location}</span>
                              </div>
                            )}
                            {app.job.requirements?.salary && (
                              <div className="flex items-center space-x-1">
                                <DollarSign className="w-3 h-3" />
                                <span>{app.job.requirements.salary}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className={`px-3 py-1 rounded-full border text-xs font-medium flex items-center space-x-1 ${getStatusColor(app.status)}`}>
                        {getStatusIcon(app.status)}
                        <span className="capitalize">{app.status}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-xs text-slate-500">
                        <Calendar className="w-3 h-3" />
                        <span>Applied: {app.appliedAt.toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}</span>
                      </div>
                      <button
                        onClick={() => navigate(`/applications/${app.id}`)}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        View Application →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Interviews */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <Video className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-bold text-slate-900">Interviews</h2>
              </div>
              <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm font-medium">
                {interviews.length}
              </span>
            </div>

            {interviews.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Video className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>No interviews scheduled</p>
              </div>
            ) : (
              <div className="space-y-4">
                {interviews.map((interview) => (
                  <div
                    key={interview.id}
                    className="border border-slate-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900 mb-1">
                          {interview.application?.job?.title || 'Interview'}
                        </h3>
                        <div className="flex items-center space-x-2 text-xs text-slate-500 mb-2">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {interview.scheduledAt.toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })} at {interview.scheduledAt.toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getInterviewStatusColor(interview.status)}`}>
                        {interview.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      {interview.status === 'scheduled' && (
                        <a
                          href={`/interview/${interview.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Join Interview →
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}