import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
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
  Brain,
  Award,
  PhoneCall,
  X,
} from 'lucide-react';
import { Application, Candidate, Job, AICall } from '../lib/firebase';
import { applicationService } from '../services/applicationService';
import { candidateService } from '../services/candidateService';
import { jobService } from '../services/jobService';
import { aiCallService } from '../services/aiCallService';
import { useToast } from '../contexts/ToastContext';

export default function ApplicationDetailsView() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const navigate = useNavigate();
  const [application, setApplication] = useState<Application | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [aiCall, setAiCall] = useState<AICall | null>(null);
  const [loadingCall, setLoadingCall] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [activeTab, setActiveTab] = useState<'questions' | 'transcript'>('questions');
  const [showJobModal, setShowJobModal] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (applicationId) {
      fetchApplicationDetails();
      fetchAICall();
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

  const fetchAICall = async () => {
    if (!applicationId) return;

    try {
      setLoadingCall(true);
      const callData = await aiCallService.getAICallByApplicationId(applicationId);
      setAiCall(callData);
    } catch (error) {
      console.error('Error fetching AI call data:', error);
      // Don't show error toast - AI call might not exist yet
    } finally {
      setLoadingCall(false);
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
      {/* Header with Status Update */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Applications</span>
        </button>
        
        {/* Status Update Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-600 mr-2">Status:</span>
          {[
            { value: 'pending', color: 'bg-slate-600', hoverColor: 'hover:bg-slate-700' },
            { value: 'screening', color: 'bg-yellow-600', hoverColor: 'hover:bg-yellow-700' },
            { value: 'interview', color: 'bg-blue-600', hoverColor: 'hover:bg-blue-700' },
            { value: 'rejected', color: 'bg-red-600', hoverColor: 'hover:bg-red-700' },
            { value: 'hired', color: 'bg-green-600', hoverColor: 'hover:bg-green-700' }
          ].map((status) => (
            <button
              key={status.value}
              onClick={() => handleStatusUpdate(status.value as Application['status'])}
              disabled={updatingStatus || application.status === status.value}
              className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all ${
                application.status === status.value
                  ? `${status.color} text-white cursor-default`
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              {status.value.charAt(0).toUpperCase() + status.value.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Candidate Information Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        {/* Candidate Section - Single Line */}
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
              {candidate.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{candidate.name}</h2>
              <button
                onClick={() => setShowJobModal(true)}
                className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                <Briefcase className="w-3 h-3" />
                <span>{job.title}</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="h-10 w-px bg-slate-200"></div>
          
          <div className="flex items-center space-x-2">
            <Mail className="w-4 h-4 text-slate-500" />
            <a
              href={`mailto:${candidate.email}`}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              {candidate.email}
            </a>
          </div>

          {candidate.phone && (
            <>
              <div className="h-10 w-px bg-slate-200"></div>
              <div className="flex items-center space-x-2">
                <Phone className="w-4 h-4 text-slate-500" />
                <a
                  href={`tel:${candidate.phone}`}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  {candidate.phone}
                </a>
              </div>
            </>
          )}

          <div className="h-10 w-px bg-slate-200"></div>

          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="text-sm text-slate-700 font-medium">
              {application.appliedAt.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>

          {candidate.resumeUrl && (
            <>
              <div className="h-10 w-px bg-slate-200"></div>
              <a
                href={candidate.resumeUrl}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="flex items-center space-x-2 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                <span>View Resume</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">

        {/* AI Match Score */}
        {application.matchScore !== undefined && (
          <div className="bg-blue-50 rounded-xl border-2 border-blue-200 p-6 shadow-sm">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">AI Resume Match</h2>
                <p className="text-xs text-slate-600">Automated analysis</p>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-end space-x-4 mb-3">
                <div>
                  <div className="text-4xl font-bold text-slate-900">{application.matchScore}%</div>
                  <div className="text-xs text-slate-600 mt-1">Match Score</div>
                </div>
                <div className="flex-1">
                  <div className="h-6 bg-slate-200 rounded-full overflow-hidden">
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

              {application.aiSummary && (
                <div className="bg-white rounded-lg p-3 border border-blue-100">
                  <p className="text-slate-700 text-xs line-clamp-3">
                    {application.aiSummary}
                  </p>
                </div>
              )}
            </div>

            {application.skillsMatch && application.skillsMatch.totalCount > 0 && (
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <Award className="w-4 h-4 text-blue-600" />
                  <h3 className="font-semibold text-slate-900 text-sm">
                    Skills: {application.skillsMatch.matchCount}/{application.skillsMatch.totalCount}
                  </h3>
                </div>
                <div className="space-y-2">
                  {application.skillsMatch.found.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {application.skillsMatch.found.slice(0, 5).map((skill, index) => (
                        <span
                          key={index}
                          className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs"
                        >
                          ✓ {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Call Transcript with Tabs */}
      {loadingCall ? (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-slate-600">Loading AI call data...</span>
          </div>
        </div>
      ) : aiCall ? (
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border-2 border-purple-200 shadow-sm">
          <div className="p-6 pb-0">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
                <PhoneCall className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">AI Phone Interview</h2>
                <p className="text-sm text-slate-600">Automated phone screening</p>
              </div>
            </div>

            {/* Call Status */}
            <div className="bg-white rounded-lg p-4 mb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-slate-600 font-medium text-xs">Status</p>
                  <p className="text-slate-900 font-semibold capitalize">{aiCall.callStatus}</p>
                </div>
                <div>
                  <p className="text-slate-600 font-medium text-xs">Phone</p>
                  <p className="text-slate-900 font-semibold">{aiCall.phone}</p>
                </div>
                <div>
                  <p className="text-slate-600 font-medium text-xs">Duration</p>
                  <p className="text-slate-900 font-semibold">
                    {aiCall.completedAt && aiCall.createdAt
                      ? `${Math.round((new Date(aiCall.completedAt).getTime() - aiCall.createdAt.getTime()) / 1000 / 60)} min`
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-600 font-medium text-xs">Questions</p>
                  <p className="text-slate-900 font-semibold">{aiCall.questionsAnswers?.length || 0}</p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 border-b border-purple-200">
              <button
                onClick={() => setActiveTab('questions')}
                className={`px-4 py-2 font-medium text-sm transition-colors ${
                  activeTab === 'questions'
                    ? 'text-purple-700 border-b-2 border-purple-700'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Questions & Answers
              </button>
              <button
                onClick={() => setActiveTab('transcript')}
                className={`px-4 py-2 font-medium text-sm transition-colors ${
                  activeTab === 'transcript'
                    ? 'text-purple-700 border-b-2 border-purple-700'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Full Transcript
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'questions' && aiCall.questionsAnswers && aiCall.questionsAnswers.length > 0 && (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {aiCall.questionsAnswers.map((qa, index) => (
                  <div key={index} className="bg-white rounded-lg p-4 shadow-sm">
                    <div className="flex items-start space-x-2 mb-2">
                      <span className="inline-block px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded">
                        {qa.category}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(qa.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="mb-2">
                      <p className="text-sm font-medium text-slate-900">Q: {qa.questionText}</p>
                    </div>
                    <div className="bg-slate-50 rounded p-3">
                      <p className="text-sm text-slate-700">A: {qa.answer}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'transcript' && aiCall.transcript && aiCall.transcript.length > 0 && (
              <div className="bg-white rounded-lg p-4 max-h-[500px] overflow-y-auto space-y-2">
                {aiCall.transcript.map((entry, index) => (
                  <div
                    key={index}
                    className={`flex ${entry.role === 'agent' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 shadow-sm ${
                        entry.role === 'agent'
                          ? 'bg-purple-100 text-purple-900'
                          : 'bg-blue-100 text-blue-900'
                      }`}
                    >
                      <p className="text-xs font-semibold mb-1 capitalize">
                        {entry.role === 'agent' ? 'AI Agent' : 'Candidate'}
                      </p>
                      <p className="text-sm">{entry.text}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {new Date(entry.t).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

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

      {/* Job Details Modal */}
      {showJobModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div className="flex items-center space-x-3">
                <Briefcase className="w-6 h-6 text-blue-600" />
                <h2 className="text-2xl font-bold text-slate-900">Job Details</h2>
              </div>
              <button
                onClick={() => setShowJobModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-88px)]">
              {/* Job Title */}
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-slate-900 mb-4">{job.title}</h3>
                
                {/* Job Requirements Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  {job.requirements?.location && (
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="flex items-center space-x-2 text-slate-600 mb-1">
                        <MapPin className="w-4 h-4" />
                        <span className="text-xs font-medium">Location</span>
                      </div>
                      <p className="text-slate-900 text-sm font-medium">{job.requirements.location}</p>
                    </div>
                  )}

                  {job.requirements?.salary && (
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="flex items-center space-x-2 text-slate-600 mb-1">
                        <DollarSign className="w-4 h-4" />
                        <span className="text-xs font-medium">Salary</span>
                      </div>
                      <p className="text-slate-900 text-sm font-medium">{job.requirements.salary}</p>
                    </div>
                  )}

                  {job.requirements?.experience && (
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="flex items-center space-x-2 text-slate-600 mb-1">
                        <Clock className="w-4 h-4" />
                        <span className="text-xs font-medium">Experience</span>
                      </div>
                      <p className="text-slate-900 text-sm font-medium">{job.requirements.experience}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Required Skills */}
              {job.requirements?.skills && job.requirements.skills.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-semibold text-slate-900 mb-3">Required Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {job.requirements.skills.map((skill, index) => (
                      <span
                        key={index}
                        className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Job Description */}
              {job.description && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">Job Description</h4>
                  <div className="prose prose-sm max-w-none">
                    <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{job.description}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
