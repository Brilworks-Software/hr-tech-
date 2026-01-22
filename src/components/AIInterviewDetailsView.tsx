import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, Calendar, Clock, ArrowLeft, Sparkles, ThumbsUp, ThumbsDown, AlertCircle, TrendingUp, MessageSquare, Users, CheckCircle, XCircle, Bot, Play, AlertTriangle, Eye, UserX, Monitor } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { Interview, db } from '../lib/firebase';
import { doc, getDoc, collection, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface CheatingAlert {
  id: string;
  timestamp: Timestamp;
  type: 'face_not_detected' | 'looking_away' | 'multiple_faces' | 'attentive' | 'tab_switched' | 'window_blur';
  severity: 'low' | 'medium' | 'high';
  message: string;
  confidence?: number;
}

interface AIVideoInterview {
  interviewId: string;
  status: string;
  questions: Array<{ id: string; text: string; category: string }>;
  questionsAnswers: Array<{
    questionId: string;
    questionText: string;
    category: string;
    answer: string;
    timestamp: string;
  }>;
  evaluation?: {
    overallScore: number;
    technicalScore: number;
    communicationScore: number;
    cultureFitScore: number;
    problemSolvingScore: number;
    motivationScore: number;
    recommendation: string;
    strengths: string[];
    concerns: string[];
    keyInsights: string[];
    detailedFeedback: string;
  };
}

export default function AIInterviewDetailsView() {
  const { interviewId } = useParams<{ interviewId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [interview, setInterview] = useState<Interview | null>(null);
  const [aiInterview, setAIInterview] = useState<AIVideoInterview | null>(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [alerts, setAlerts] = useState<CheatingAlert[]>([]);

  useEffect(() => {
    if (!interviewId) return;

    const fetchInterview = async () => {
      try {
        // Fetch main interview
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

        setInterview(interviewData);

        // Fetch AI interview details
        const aiInterviewDoc = await getDoc(doc(db, 'aiVideoInterviews', interviewId));
        if (aiInterviewDoc.exists()) {
          setAIInterview(aiInterviewDoc.data() as AIVideoInterview);
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

  // Fetch cheating detection alerts
  useEffect(() => {
    if (!interviewId) return;

    console.log('🔍 Setting up alerts listener for AI interview:', interviewId);

    const alertsQuery = query(
      collection(db, 'interviews', interviewId, 'alerts'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(
      alertsQuery,
      (snapshot) => {
        console.log('📢 AI Interview alerts snapshot received, size:', snapshot.size);
        
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

        console.log('✅ Processed AI interview alerts:', alertsData.length);
        setAlerts(alertsData);
      },
      (error) => {
        console.error('❌ Error listening to AI interview alerts:', error);
      }
    );

    return () => {
      console.log('🔇 Unsubscribing from AI interview alerts listener');
      unsubscribe();
    };
  }, [interviewId]);

  const handleGenerateEvaluation = async () => {
    if (!interviewId) return;

    setEvaluating(true);
    try {
      const functions = getFunctions();
      const evaluateInterview = httpsCallable(functions, 'evaluateAIVideoInterview');
      
      const result = await evaluateInterview({ interviewId });
      
      if (result.data && (result.data as { success: boolean }).success) {
        showToast('Evaluation generated successfully!', 'success');
        
        // Refresh AI interview data
        const aiInterviewDoc = await getDoc(doc(db, 'aiVideoInterviews', interviewId));
        if (aiInterviewDoc.exists()) {
          setAIInterview(aiInterviewDoc.data() as AIVideoInterview);
        }
      }
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

  const evaluation = aiInterview?.evaluation;

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
              <Bot className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">AI Interview Details</h1>
              <p className="text-slate-600">Automated interview analysis</p>
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
                <p className="text-sm text-slate-600">Status</p>
                <p className="font-medium text-slate-900 capitalize">{interview.status.replace('_', ' ')}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                interview.status === 'completed' ? 'bg-blue-500/20 text-blue-600' :
                interview.status === 'in_progress' ? 'bg-yellow-500/20 text-yellow-600' :
                interview.status === 'scheduled' ? 'bg-slate-500/20 text-slate-600' :
                'bg-red-500/20 text-red-600'
              }`}>
                {interview.status.replace('_', ' ').toUpperCase()}
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

        {/* Questions & Answers */}
        {/* AI Evaluation */}
        {evaluation ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900 flex items-center">
                <Sparkles className="w-6 h-6 mr-3 text-blue-600" />
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
              <p className="text-slate-700 mt-3">{evaluation.detailedFeedback}</p>
            </div>

            {/* Scores */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
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
                  <span className="text-sm text-slate-600">Technical</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">{evaluation.technicalScore}%</div>
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
                  <Users className="w-4 h-4 text-orange-400" />
                  <span className="text-sm text-slate-600">Culture Fit</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">{evaluation.cultureFitScore}%</div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Play className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm text-slate-600">Problem Solving</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">{evaluation.problemSolvingScore}%</div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-pink-400" />
                  <span className="text-sm text-slate-600">Motivation</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">{evaluation.motivationScore}%</div>
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
                  <ThumbsDown className="w-5 h-5 text-red-500" />
                  <h3 className="font-bold text-slate-900">Concerns</h3>
                </div>
                <ul className="space-y-2">
                  {evaluation.concerns.map((concern, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500 mt-1 flex-shrink-0" />
                      <span className="text-slate-700 text-sm">{concern}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Key Insights */}
            {evaluation.keyInsights && evaluation.keyInsights.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-slate-900">Key Insights</h3>
                </div>
                <ul className="space-y-2">
                  {evaluation.keyInsights.map((insight, index) => (
                    <li key={index} className="text-slate-700 text-sm">• {insight}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}

        {/* Interview Q&A */}
        {aiInterview && aiInterview.questionsAnswers && aiInterview.questionsAnswers.length > 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900 flex items-center">
                <MessageSquare className="w-6 h-6 mr-3 text-blue-600" />
                Interview Q&A
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-600">
                  {aiInterview.questionsAnswers.length} questions answered
                </span>
                {interview.status === 'completed' && aiInterview.questionsAnswers.length > 0 && (
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

            <div className="space-y-4">
              {aiInterview.questionsAnswers.map((qa, index) => (
                <div key={index} className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-bold text-blue-600 uppercase">{qa.category}</span>
                    <span className="text-xs text-slate-500">Q{index + 1}</span>
                  </div>
                  <p className="text-slate-900 font-medium mb-3">{qa.questionText}</p>
                  <div className="pl-4 border-l-2 border-blue-500">
                    <p className="text-slate-700 text-sm">{qa.answer}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : interview.status === 'completed' ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No Interview Data</h3>
              <p className="text-slate-600">Interview data is not available</p>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Interview In Progress</h3>
              <p className="text-slate-600">Q&A will be available after the interview is completed</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
