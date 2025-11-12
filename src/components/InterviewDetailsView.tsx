import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, Calendar, Clock, ArrowLeft, Video, Sparkles, ThumbsUp, ThumbsDown, AlertCircle, TrendingUp, MessageSquare, Users, CheckCircle, XCircle } from 'lucide-react';
import { interviewService } from '../services/interviewService';
import { useToast } from '../contexts/ToastContext';
import { Interview, db } from '../lib/firebase';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { evaluateInterviewPerformance, InterviewEvaluationResult } from '../services/geminiService';
import { jobService } from '../services/jobService';
import { applicationService } from '../services/applicationService';

interface TranscriptMessage {
  uid: string;
  userName: string;
  text: string;
  timestamp: Timestamp;
  isFinal: boolean;
}

export default function InterviewDetailsView() {
  const { interviewId } = useParams<{ interviewId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [interview, setInterview] = useState<Interview | null>(null);
  const [loading, setLoading] = useState(true);
  const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([]);
  const [loadingTranscripts, setLoadingTranscripts] = useState(false);
  const [evaluation, setEvaluation] = useState<InterviewEvaluationResult | null>(null);
  const [loadingEvaluation, setLoadingEvaluation] = useState(false);

  useEffect(() => {
    if (!interviewId) return;

    const fetchInterview = async () => {
      try {
        const interviewData = await interviewService.getInterviewById(interviewId);
        if (interviewData) {
          setInterview(interviewData);
          
          // Fetch transcripts from channels collection if agoraChannel exists
          if (interviewData.agoraChannel) {
            setLoadingTranscripts(true);
            try {
              const channelDoc = await getDoc(doc(db, 'channels', interviewData.agoraChannel));
              
              if (channelDoc.exists()) {
                const channelData = channelDoc.data();
                const transcriptData = channelData.transcripts || [];
                setTranscripts(transcriptData);
              }
            } catch (error) {
              console.error('Error fetching transcripts from channel:', error);
            } finally {
              setLoadingTranscripts(false);
            }
          }
        } else {
          showToast('Interview not found.', 'error');
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching interview:', error);
        showToast('Failed to load interview details.', 'error');
        setLoading(false);
      }
    };

    fetchInterview();
  }, [interviewId, showToast]);

  const handleGenerateEvaluation = async () => {
    if (!interview || transcripts.length === 0) {
      showToast('No transcript available to evaluate', 'error');
      return;
    }

    setLoadingEvaluation(true);
    try {
      // Get the application to find the job ID
      const application = await applicationService.getApplicationById(interview.applicationId);
      
      if (!application) {
        showToast('Could not find application details', 'error');
        setLoadingEvaluation(false);
        return;
      }

      // Fetch job details
      const jobData = await jobService.getJobById(application.jobId);
      
      if (!jobData) {
        showToast('Could not find job details for evaluation', 'error');
        setLoadingEvaluation(false);
        return;
      }

      // Format transcript for evaluation
      const formattedTranscript = transcripts
        .map(t => `${t.userName}: ${t.text}`)
        .join('\n\n');

      const evaluationResult = await evaluateInterviewPerformance(
        formattedTranscript,
        jobData.description,
        jobData.title
      );

      setEvaluation(evaluationResult);
      showToast('Interview evaluation completed!', 'success');
    } catch (error) {
      console.error('Error generating evaluation:', error);
      showToast('Failed to generate evaluation. Please try again.', 'error');
    } finally {
      setLoadingEvaluation(false);
    }
  };

  const handleJoinInterview = () => {
    if (!interviewId) {
      showToast('Interview ID is missing.', 'error');
      return;
    }
    
    // Navigate to HR dashboard for video interview
    navigate(`/interview/${interviewId}/hr`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!interview) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Interview Not Found</h2>
          <p className="text-slate-600 mb-6">The interview you're looking for doesn't exist or has been removed.</p>
          <button
            onClick={() => navigate('/dashboard?view=interviews')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Interviews
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/dashboard?view=interviews')}
            className="flex items-center text-slate-600 hover:text-slate-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            <span>Back to Interviews</span>
          </button>
          <h1 className="text-3xl font-bold text-slate-900">Interview Details</h1>
        </div>

        {/* Interview Info Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center text-slate-700">
                <Calendar className="w-5 h-5 mr-3 text-blue-600" />
                <div>
                  <p className="text-sm text-slate-500">Scheduled Date</p>
                  <p className="font-medium">
                    {interview.scheduledAt.toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center text-slate-700">
                <Clock className="w-5 h-5 mr-3 text-blue-600" />
                <div>
                  <p className="text-sm text-slate-500">Scheduled Time</p>
                  <p className="font-medium">
                    {interview.scheduledAt.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              {interview.startedAt && (
                <div className="flex items-center text-slate-700">
                  <Clock className="w-5 h-5 mr-3 text-green-600" />
                  <div>
                    <p className="text-sm text-slate-500">Started At</p>
                    <p className="font-medium">
                      {interview.startedAt.toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
              {interview.completedAt && (
                <div className="flex items-center text-slate-700">
                  <Clock className="w-5 h-5 mr-3 text-purple-600" />
                  <div>
                    <p className="text-sm text-slate-500">Completed At</p>
                    <p className="font-medium">
                      {interview.completedAt.toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-center">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  interview.status === 'completed' ? 'bg-green-100 text-green-800' :
                  interview.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                  interview.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {interview.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Join/Review Interview Button */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <button
              onClick={handleJoinInterview}
              className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Video className="w-5 h-5" />
              <span>
                {interview.status === 'completed' ? 'Review Interview' : 'Join/Rejoin Interview'}
              </span>
            </button>
          </div>
        </div>

        {/* Transcript Section */}
        {transcripts.length > 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <FileText className="w-6 h-6 mr-3 text-blue-600" />
                <h2 className="text-2xl font-bold text-slate-900">Interview Transcript</h2>
              </div>
              {interview.status === 'completed' && !evaluation && (
                <button
                  onClick={handleGenerateEvaluation}
                  disabled={loadingEvaluation}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-5 h-5" />
                  {loadingEvaluation ? 'Analyzing...' : 'AI Evaluation'}
                </button>
              )}
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 max-h-[600px] overflow-y-auto">
              <div className="space-y-4">
                {transcripts.map((transcript, index) => (
                  <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-900">
                        {transcript.userName || 'Unknown'}
                      </span>
                      <span className="text-xs text-slate-500">
                        {transcript.timestamp?.toDate?.()?.toLocaleTimeString() || ''}
                      </span>
                    </div>
                    <p className="text-slate-700 leading-relaxed">
                      {transcript.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : loadingTranscripts ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-600">Loading transcript...</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No Transcript Available</h3>
              <p className="text-slate-600">
                The transcript will appear here once the interview is completed and transcription is available.
              </p>
            </div>
          </div>
        )}

        {/* AI Evaluation Section */}
        {evaluation && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <Sparkles className="w-6 h-6 mr-3 text-purple-600" />
                <h2 className="text-2xl font-bold text-slate-900">AI Interview Evaluation</h2>
              </div>
              <button
                onClick={handleGenerateEvaluation}
                disabled={loadingEvaluation}
                className="text-sm text-slate-600 hover:text-slate-900 underline"
              >
                Regenerate
              </button>
            </div>

            {/* Hiring Recommendation */}
            <div className={`p-6 rounded-lg mb-6 ${
              evaluation.recommendation === 'hire' ? 'bg-green-50 border-2 border-green-200' :
              evaluation.recommendation === 'maybe' ? 'bg-yellow-50 border-2 border-yellow-200' :
              'bg-red-50 border-2 border-red-200'
            }`}>
              <div className="flex items-center gap-3 mb-3">
                {evaluation.recommendation === 'hire' ? (
                  <>
                    <CheckCircle className="w-8 h-8 text-green-600" />
                    <div>
                      <h3 className="text-xl font-bold text-green-900">Recommend to Hire</h3>
                      <p className="text-sm text-green-700">Strong candidate for this position</p>
                    </div>
                  </>
                ) : evaluation.recommendation === 'maybe' ? (
                  <>
                    <AlertCircle className="w-8 h-8 text-yellow-600" />
                    <div>
                      <h3 className="text-xl font-bold text-yellow-900">Maybe - Further Review Needed</h3>
                      <p className="text-sm text-yellow-700">Candidate shows potential but needs additional evaluation</p>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="w-8 h-8 text-red-600" />
                    <div>
                      <h3 className="text-xl font-bold text-red-900">Not Recommended</h3>
                      <p className="text-sm text-red-700">Candidate may not be suitable for this role</p>
                    </div>
                  </>
                )}
              </div>
              <p className="text-slate-700 mt-3">{evaluation.summary}</p>
            </div>

            {/* Score Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                  <span className="text-sm font-medium text-purple-900">Overall Score</span>
                </div>
                <div className="text-3xl font-bold text-purple-900">{evaluation.overallScore}%</div>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">Technical Skills</span>
                </div>
                <div className="text-3xl font-bold text-blue-900">{evaluation.technicalSkillsScore}%</div>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-900">Communication</span>
                </div>
                <div className="text-3xl font-bold text-green-900">{evaluation.communicationScore}%</div>
              </div>

              <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-orange-600" />
                  <span className="text-sm font-medium text-orange-900">Culture Fit</span>
                </div>
                <div className="text-3xl font-bold text-orange-900">{evaluation.cultureFitScore}%</div>
              </div>
            </div>

            {/* Strengths and Concerns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ThumbsUp className="w-5 h-5 text-green-600" />
                  <h3 className="font-bold text-slate-900">Key Strengths</h3>
                </div>
                <ul className="space-y-2">
                  {evaluation.strengths.map((strength, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                      <span className="text-slate-700">{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ThumbsDown className="w-5 h-5 text-red-600" />
                  <h3 className="font-bold text-slate-900">Areas of Concern</h3>
                </div>
                <ul className="space-y-2">
                  {evaluation.concerns.map((concern, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600 mt-1 flex-shrink-0" />
                      <span className="text-slate-700">{concern}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Key Insights */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
              <h3 className="font-bold text-slate-900 mb-3">Detailed Insights</h3>
              <p className="text-slate-700 leading-relaxed">{evaluation.keyInsights}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

