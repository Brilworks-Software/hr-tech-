import { useState, useEffect } from 'react';
import { Video, Calendar, Clock, TrendingUp, Brain, Plus, ExternalLink, X, FileText, User } from 'lucide-react';
import { Interview, Application } from '../lib/firebase';
import { interviewService } from '../services/interviewService';
import { applicationService } from '../services/applicationService';
import { candidateService } from '../services/candidateService';
import { jobService } from '../services/jobService';
import ScheduleInterviewModal from './ScheduleInterviewModal';

export default function InterviewsView() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showApplicationSelector, setShowApplicationSelector] = useState(false);
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [scheduleData, setScheduleData] = useState<{
    candidateEmail: string;
    candidateName: string;
    jobTitle: string;
  } | null>(null);
  const [loadingApplications, setLoadingApplications] = useState(false);

  useEffect(() => {
    const unsubscribe = interviewService.subscribeToInterviews((interviewsData) => {
      setInterviews(interviewsData);
      setLoading(false);
    });

    fetchApplications();

    return () => unsubscribe();
  }, []);

  const fetchApplications = async () => {
    try {
      const appsData = await applicationService.getAllApplications();
      // Filter out rejected and hired applications
      const availableApps = appsData.filter(
        (app) => app.status !== 'rejected' && app.status !== 'hired'
      );
      setApplications(availableApps);
    } catch (error) {
      console.error('Error fetching applications:', error);
    }
  };

  const handleSelectApplication = async (app: Application) => {
    try {
      setLoadingApplications(true);
      
      // Fetch candidate and job details
      const [candidate, job] = await Promise.all([
        candidateService.getCandidateById(app.candidateId),
        jobService.getJobById(app.jobId),
      ]);

      if (!candidate || !job) {
        alert('Unable to load candidate or job details. Please try again.');
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
      alert('Error loading application details');
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
    const interviewLink = `${window.location.origin}/interview/${interviewId}`;
    window.open(interviewLink, '_blank');
  };

  const handleCopyLink = (interviewId: string) => {
    const interviewLink = `${window.location.origin}/interview/${interviewId}`;
    navigator.clipboard.writeText(interviewLink);
    alert('Interview link copied to clipboard!');
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
          className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-lg hover:shadow-lg hover:shadow-blue-500/30 transition-all"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Schedule Interview</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Scheduled</span>
            <Calendar className="w-5 h-5 text-yellow-600" />
          </div>
          <p className="text-3xl font-bold text-slate-900">
            {interviews.filter((i) => i.status === 'scheduled').length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">In Progress</span>
            <Video className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-slate-900">
            {interviews.filter((i) => i.status === 'in_progress').length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Completed</span>
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-slate-900">
            {interviews.filter((i) => i.status === 'completed').length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Total</span>
            <Brain className="w-5 h-5 text-cyan-600" />
          </div>
          <p className="text-3xl font-bold text-slate-900">{interviews.length}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : interviews.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-300">
          <Video className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-900 mb-2">No interviews scheduled</h3>
          <p className="text-slate-600">Schedule interviews with candidates to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {interviews.map((interview) => (
            <div
              key={interview.id}
              className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-xl hover:border-blue-300 transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-full flex items-center justify-center">
                    <Video className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Interview #{interview.id.substring(0, 8)}</h3>
                    <p className="text-sm text-slate-600">Candidate Interview</p>
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
                  className="flex-1 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 rounded-lg hover:shadow-lg transition-all flex items-center justify-center space-x-2"
                >
                  <Video className="w-4 h-4" />
                  <span>Join Interview</span>
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
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-full flex items-center justify-center text-white font-bold">
                            <User className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900">Application #{app.id.substring(0, 8)}</p>
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
