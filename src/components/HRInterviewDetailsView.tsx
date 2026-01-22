import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, Clock, ArrowLeft, MessageSquare, Users, Video, FileText, Sparkles, ThumbsUp, ThumbsDown, AlertCircle, TrendingUp, CheckCircle, XCircle, AlertTriangle, Eye, UserX, Monitor } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { Interview, db } from '../lib/firebase';
import { doc, getDoc, updateDoc, collection, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { evaluateInterviewPerformance } from '../services/geminiService';
import { jobService } from '../services/jobService';
import { applicationService } from '../services/applicationService';

interface CheatingAlert {
  id: string;
  timestamp: Timestamp;
  type: 'face_not_detected' | 'looking_away' | 'multiple_faces' | 'attentive' | 'tab_switched' | 'window_blur';
  severity: 'low' | 'medium' | 'high';
  message: string;
  confidence?: number;
}

interface TranscriptMessage {
  uid: number;
  userName: string;
  text: string;
  timestamp: { toMillis: () => number };
  isFinal: boolean;
}

interface Evaluation {
  recommendation: string;
  overallScore: number;
  technicalSkillsScore: number;
  communicationScore: number;
  cultureFitScore: number;
  strengths: string[];
  concerns: string[];
  summary: string;
  keyInsights: string;
}

export default function HRInterviewDetailsView() {
  const { interviewId } = useParams<{ interviewId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [interview, setInterview] = useState<Interview | null>(null);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [alerts, setAlerts] = useState<CheatingAlert[]>([]);

  useEffect(() => {
    if (!interviewId) return;

    const fetchTranscript = async (channelName: string) => {
      setLoadingTranscript(true);
      try {
        console.log('Fetching transcript for channel:', channelName);
        
        // Get the transcript document using the channel name as document ID
        const transcriptDoc = await getDoc(doc(db, 'channels', channelName));
        
        if (transcriptDoc.exists()) {
          const data = transcriptDoc.data();
          const transcriptsArray = data?.transcripts || [];
          console.log('Found transcripts:', transcriptsArray.length);
          
          // Sort by timestamp
          const sortedTranscripts = [...transcriptsArray].sort(
            (a: TranscriptMessage, b: TranscriptMessage) => {
              const aTime = a.timestamp?.toMillis?.() || 0;
              const bTime = b.timestamp?.toMillis?.() || 0;
              return aTime - bTime;
            }
          );
          
          setTranscript(sortedTranscripts);
        } else {
          console.log('No transcript document found for channel:', channelName);
          setTranscript([]);
        }
      } catch (error) {
        console.error('Error fetching transcript:', error);
        showToast('Failed to load interview transcript.', 'error');
      } finally {
        setLoadingTranscript(false);
      }
    };

    const fetchInterview = async () => {
      try {
        const interviewDoc = await getDoc(doc(db, 'interviews', interviewId));
        if (!interviewDoc.exists()) {
          showToast('Interview not found.', 'error');
          setLoading(false);
          return;
        }

        const interviewData = {
          id: interviewDoc.id,
          ...interviewDoc.data(),
          scheduledAt: interviewDoc.data().scheduledAt?.toDate() || new Date(),
          startedAt: interviewDoc.data().startedAt?.toDate() || null,
          completedAt: interviewDoc.data().completedAt?.toDate() || null,
        } as Interview;

        console.log('Interview data:', interviewData);
        setInterview(interviewData);
        
        // Load evaluation if exists
        const evaluationData = (interviewDoc.data() as { evaluation?: Evaluation }).evaluation;
        if (evaluationData) {
          setEvaluation(evaluationData);
        }
        
        setLoading(false);

        // Fetch transcript if interview has a channel and has started
        const agoraChannel = (interviewDoc.data() as { agoraChannel?: string }).agoraChannel;
        if (agoraChannel && (interviewData.status === 'in_progress' || interviewData.status === 'completed')) {
          console.log('Fetching transcript for agora channel:', agoraChannel);
          await fetchTranscript(agoraChannel);
        } else {
          console.log('No agora channel found or interview not started');
        }
      } catch (error) {
        console.error('Error fetching interview:', error);
        showToast('Failed to load interview details.', 'error');
        setLoading(false);
      }
    };

    fetchInterview();
  }, [interviewId, showToast]);

  // Fetch cheating detection alerts
  useEffect(() => {
    if (!interviewId) return;

    console.log('🔍 Setting up alerts listener for HR interview:', interviewId);

    const alertsQuery = query(
      collection(db, 'interviews', interviewId, 'alerts'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(
      alertsQuery,
      (snapshot) => {
        console.log('📢 HR Interview alerts snapshot received, size:', snapshot.size);
        
        const alertsData: CheatingAlert[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          alertsData.push({
            id: doc.id,
            timestamp: data.timestamp,
            type: data.type,
            severity: data.severity,
            message: data.message,
            confidence: data.confidence,
          });
        });

        console.log('✅ Processed HR interview alerts:', alertsData.length);
        setAlerts(alertsData);
      },
      (error) => {
        console.error('❌ Error listening to HR interview alerts:', error);
      }
    );

    return () => {
      console.log('🔇 Unsubscribing from HR interview alerts listener');
      unsubscribe();
    };
  }, [interviewId]);

  const handleGenerateEvaluation = async () => {
    if (!interviewId || !interview) return;

    setEvaluating(true);
    try {
      // Get application and job details
      const application = await applicationService.getApplicationById(interview.applicationId);
      if (!application) {
        showToast('Application not found', 'error');
        setEvaluating(false);
        return;
      }

      const job = await jobService.getJobById(application.jobId);
      if (!job) {
        showToast('Job not found', 'error');
        setEvaluating(false);
        return;
      }

      // Format transcript for evaluation
      const transcriptText = transcript.map(msg => 
        `${msg.userName}: ${msg.text}`
      ).join('\\n\\n');

      if (!transcriptText || transcriptText.trim().length === 0) {
        showToast('No transcript available to evaluate', 'error');
        setEvaluating(false);
        return;
      }

      // Generate evaluation using Gemini
      const evaluationData = await evaluateInterviewPerformance(
        transcriptText,
        job.description,
        job.title
      );
      
      // Save evaluation to Firestore
      await updateDoc(doc(db, 'interviews', interviewId), {
        evaluation: evaluationData,
      });

      setEvaluation(evaluationData);
      showToast('Evaluation generated successfully!', 'success');
    } catch (error) {
      console.error('Error generating evaluation:', error);
      showToast('Failed to generate evaluation', 'error');
    } finally {
      setEvaluating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!interview) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-200">
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
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/dashboard?view=interviews')}
            className="flex items-center text-slate-600 hover:text-slate-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            <span>Back to Interviews</span>
          </button>
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-blue-500 rounded-lg flex items-center justify-center">
              <Users className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">HR Interview Details</h1>
              <p className="text-slate-600">Live interview session</p>
            </div>
          </div>
        </div>

        {/* Interview Info Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center space-x-3">
              <Calendar className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-sm text-slate-600">Scheduled Date</p>
                <p className="font-medium text-slate-900">
                  {interview.scheduledAt.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Clock className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-sm text-slate-600">Scheduled Time</p>
                <p className="font-medium text-slate-900">
                  {interview.scheduledAt.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                interview.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                interview.status === 'in_progress' ? 'bg-blue-500/20 text-blue-600' :
                interview.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {interview.status.replace('_', ' ').toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        {/* Interview Type Info */}
        <div className="bg-gradient-to-r from-blue-50 to-blue-100/50 border border-blue-200 rounded-xl p-6 mb-6">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Video className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Live HR Interview</h3>
              <p className="text-slate-700 text-sm mb-3">
                This is a live video interview conducted by an HR representative. The conversation is recorded and can be reviewed below.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                  Live Conversation
                </span>
                <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                  Real-time Feedback
                </span>
                <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                  Personal Touch
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Cheating Detection Alerts */}
        {alerts.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900 flex items-center">
                <AlertTriangle className="w-6 h-6 mr-3 text-blue-600" />
                Monitoring Alerts
              </h2>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-sm text-slate-600">
                    High: {alerts.filter(a => a.severity === 'high').length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span className="text-sm text-slate-600">
                    Medium: {alerts.filter(a => a.severity === 'medium').length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-sm text-slate-600">
                    Low: {alerts.filter(a => a.severity === 'low').length}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {alerts.map((alert) => {
                const getAlertIcon = () => {
                  switch (alert.type) {
                    case 'face_not_detected':
                      return <UserX className="w-5 h-5" />;
                    case 'looking_away':
                      return <Eye className="w-5 h-5" />;
                    case 'multiple_faces':
                      return <Users className="w-5 h-5" />;
                    case 'tab_switched':
                    case 'window_blur':
                      return <Monitor className="w-5 h-5" />;
                    case 'attentive':
                      return <CheckCircle className="w-5 h-5" />;
                    default:
                      return <AlertCircle className="w-5 h-5" />;
                  }
                };

                const getAlertColor = () => {
                  switch (alert.severity) {
                    case 'high':
                      return 'bg-red-50 border-red-200 text-red-700';
                    case 'medium':
                      return 'bg-yellow-50 border-yellow-200 text-yellow-700';
                    case 'low':
                      return 'bg-blue-50 border-blue-200 text-blue-700';
                    default:
                      return 'bg-slate-50 border-slate-200 text-slate-700';
                  }
                };

                const getIconColor = () => {
                  switch (alert.severity) {
                    case 'high':
                      return 'text-red-600';
                    case 'medium':
                      return 'text-yellow-600';
                    case 'low':
                      return 'text-blue-600';
                    default:
                      return 'text-slate-600';
                  }
                };

                return (
                  <div
                    key={alert.id}
                    className={`flex items-start gap-3 p-4 rounded-lg border ${getAlertColor()}`}
                  >
                    <div className={getIconColor()}>
                      {getAlertIcon()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium capitalize">
                          {alert.type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs">
                          {alert.timestamp?.toDate?.()?.toLocaleTimeString() || 'N/A'}
                        </span>
                      </div>
                      <p className="text-sm">{alert.message}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* AI Evaluation Section */}
        {interview.status === 'completed' && evaluation && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 mt-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900 flex items-center">
                <Sparkles className="w-6 h-6 mr-3 text-purple-500" />
                AI Evaluation
              </h2>
              <button
                onClick={handleGenerateEvaluation}
                disabled={evaluating}
                className="text-sm text-slate-600 hover:text-slate-900 underline disabled:opacity-50"
              >
                {evaluating ? 'Regenerating...' : 'Regenerate'}
              </button>
            </div>

            {/* Recommendation */}
            <div className={`p-6 rounded-lg mb-6 ${
              evaluation.recommendation === 'strong-hire' || evaluation.recommendation === 'hire' 
                ? 'bg-blue-50 border-2 border-blue-500' :
              evaluation.recommendation === 'maybe' 
                ? 'bg-yellow-50 border-2 border-yellow-500' :
                'bg-red-50 border-2 border-red-500'
            }`}>
              <div className="flex items-center gap-3 mb-3">
                {(evaluation.recommendation === 'strong-hire' || evaluation.recommendation === 'hire') ? (
                  <>
                    <CheckCircle className="w-8 h-8 text-blue-600" />
                    <div>
                      <h3 className="text-xl font-bold text-blue-700">Recommend to Hire</h3>
                      <p className="text-sm text-blue-600">Strong candidate for this position</p>
                    </div>
                  </>
                ) : evaluation.recommendation === 'maybe' ? (
                  <>
                    <AlertCircle className="w-8 h-8 text-yellow-600" />
                    <div>
                      <h3 className="text-xl font-bold text-yellow-700">Maybe - Further Review</h3>
                      <p className="text-sm text-yellow-600">Shows potential, needs evaluation</p>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="w-8 h-8 text-red-600" />
                    <div>
                      <h3 className="text-xl font-bold text-red-700">Not Recommended</h3>
                      <p className="text-sm text-red-600">May not be suitable for this role</p>
                    </div>
                  </>
                )}
              </div>
              <p className="text-slate-700 mt-3">{evaluation.summary}</p>
            </div>

            {/* Scores */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-slate-600">Overall</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">{evaluation.overallScore}%</div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-slate-600">Technical Skills</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">{evaluation.technicalSkillsScore}%</div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-slate-600">Communication</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">{evaluation.communicationScore}%</div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-slate-600">Culture Fit</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">{evaluation.cultureFitScore}%</div>
              </div>
            </div>

            {/* Strengths & Concerns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <ThumbsUp className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-slate-900">Strengths</h3>
                </div>
                <ul className="space-y-2">
                  {evaluation.strengths.map((strength, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-600 mt-1 flex-shrink-0" />
                      <span className="text-slate-700 text-sm">{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <ThumbsDown className="w-5 h-5 text-red-600" />
                  <h3 className="font-bold text-slate-900">Concerns</h3>
                </div>
                <ul className="space-y-2">
                  {evaluation.concerns.map((concern, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600 mt-1 flex-shrink-0" />
                      <span className="text-slate-700 text-sm">{concern}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Key Insights */}
            {evaluation.keyInsights && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-slate-900">Key Insights</h3>
                </div>
                <p className="text-slate-700 text-sm leading-relaxed">{evaluation.keyInsights}</p>
              </div>
            )}
          </div>
        )}

        {/* Interview Transcript */}
        {interview.status === 'scheduled' ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 mt-6 shadow-sm">
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Interview Not Started</h3>
              <p className="text-slate-600">Transcript will be available once the interview begins</p>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl p-6 mt-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900 flex items-center">
                <MessageSquare className="w-6 h-6 mr-3 text-blue-600" />
                Interview Transcript
              </h2>
              <div className="flex items-center gap-3">
                {loadingTranscript && (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                    <span className="text-sm text-slate-600">Loading...</span>
                  </div>
                )}
                {interview.status === 'completed' && transcript.length > 0 && (
                  <button
                    onClick={handleGenerateEvaluation}
                    disabled={evaluating}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 inline-flex items-center space-x-2 text-sm"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{evaluating ? 'Generating...' : evaluation ? 'Regenerate Evaluation' : 'Generate Evaluation'}</span>
                  </button>
                )}
              </div>
            </div>

            {transcript.length > 0 ? (
              <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                {transcript.map((msg, index) => (
                  <div key={index} className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-blue-600">{msg.userName}</span>
                      <span className="text-xs text-slate-500">
                        {new Date(msg.timestamp.toMillis()).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-slate-700">{msg.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <MessageSquare className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No Messages Yet</h3>
                <p className="text-slate-600">
                  {interview.status === 'in_progress' 
                    ? 'Messages will appear here as the interview progresses'
                    : 'No transcript was recorded for this interview'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
