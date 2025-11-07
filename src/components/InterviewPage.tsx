import { useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { interviewService } from '../services/interviewService';
import VideoInterview from './VideoInterview';
import { Clock, Calendar, Loader2 } from 'lucide-react';
import logoImage from '../assets/logo.png';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface Interview {
  id: string;
  scheduledAt: Date;
  status: string;
  duration?: number;
  instructions?: string;
  hrJoined?: boolean;
  transcript?: string | null;
  completedAt?: Date | null;
}

export default function InterviewPage() {
  const { interviewId } = useParams<{ interviewId: string }>();
  const [interview, setInterview] = useState<Interview | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const [interviewCompleted, setInterviewCompleted] = useState(false);
  const { showToast } = useToast();
  const { currentUser } = useAuth();
  const isHR = !!currentUser; // HR is authenticated, candidate is not

  const fetchInterview = async () => {
    if (!interviewId) return;

    try {
      const interviewData = await interviewService.getInterviewById(interviewId);

      if (interviewData) {
        setInterview(interviewData);
      } else {
        showToast('Interview not found or the link has expired.', 'error');
        // Don't navigate to login - this is a public page
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching interview:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (interviewId) {
      fetchInterview();
      
      // Subscribe to real-time updates for hrJoined status
      const interviewRef = doc(db, 'interviews', interviewId);
      const unsubscribe = onSnapshot(interviewRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setInterview((prev) => ({
            ...prev!,
            hrJoined: data.hrJoined || false,
            status: data.status || 'scheduled',
            transcript: data.transcript || null,
            completedAt: data.completedAt?.toDate() || null,
          }));
        }
      });
      
      return () => unsubscribe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewId]);

  // Fetch latest interview data when completed
  useEffect(() => {
    if (interviewCompleted && interviewId) {
      fetchInterview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewCompleted, interviewId]);

  const startInterview = async () => {
    if (!interviewId) return;

    try {
      await interviewService.startInterview(interviewId);
      setHasStarted(true);
    } catch (error) {
      console.error('Error starting interview:', error);
      showToast('Failed to start interview', 'error');
    }
  };

  const endInterview = async () => {
    if (!interviewId) return;

    try {
      await interviewService.completeInterview(interviewId);
      setInterviewCompleted(true);
      setHasStarted(false);
    } catch (error) {
      console.error('Error ending interview:', error);
      showToast('Error completing interview. Please try again.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!interview && !loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Interview Not Found</h2>
          <p className="text-slate-600 mb-6">The interview link may be invalid or expired.</p>
          <p className="text-sm text-slate-500">
            Please check the link in your email or contact the recruiter for assistance.
          </p>
        </div>
      </div>
    );
  }

  // Show completion message only if user just completed the interview
  if (interviewCompleted) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-green-600 p-8 text-white text-center">
            <div className="flex items-center justify-center mb-4">
              <img 
                src={logoImage} 
                alt="HR-tech Logo" 
                className="h-16 w-auto"
              />
            </div>
            <h1 className="text-3xl font-bold mb-2">Interview Completed</h1>
            <p className="text-green-100">Thank you for your time!</p>
          </div>
          <div className="p-8 text-center">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
              <p className="text-green-800 font-medium">
                Your interview has been successfully submitted.
              </p>
            </div>
            <p className="text-slate-600 text-sm mb-4">
              The hiring team will review your interview and get back to you soon.
            </p>
            <p className="text-slate-500 text-xs">
              You can safely close this window. The interview data has been saved.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Allow joining/rejoining regardless of status (for reconnection scenarios)
  if (hasStarted || (interview && (interview.status === 'in_progress' || interview.status === 'completed'))) {
    return <VideoInterview interviewId={interviewId!} onEnd={endInterview} />;
  }

  if (!interview) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-blue-600 p-8 text-white">
          <div className="flex items-center justify-center mb-4">
            <img 
              src={logoImage} 
              alt="HR-tech Logo" 
              className="h-16 w-auto"
            />
          </div>
          <h1 className="text-3xl font-bold text-center mb-2">Video Interview</h1>
          <p className="text-center text-blue-100">HR-tech - AI-Powered Recruitment Platform</p>
        </div>

        <div className="p-8">
          <div className="space-y-6">
            <div className="bg-slate-50 rounded-lg p-6">
              <h3 className="font-bold text-slate-900 mb-4">Interview Details</h3>
              <div className="space-y-3">
                <div className="flex items-center text-slate-700">
                  <Calendar className="w-5 h-5 mr-3 text-blue-600" />
                  <span>Scheduled: {interview.scheduledAt.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}</span>
                </div>
                <div className="flex items-center text-slate-700">
                  <Clock className="w-5 h-5 mr-3 text-blue-600" />
                  <span>Time: {interview.scheduledAt.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}</span>
                </div>
                {interview.duration && (
                  <div className="flex items-center text-slate-700">
                    <Clock className="w-5 h-5 mr-3 text-blue-600" />
                    <span>Duration: {interview.duration} minutes</span>
                  </div>
                )}
              </div>
            </div>

            {interview.instructions && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="font-bold text-blue-900 mb-2">Instructions</h3>
                <p className="text-blue-800">{interview.instructions}</p>
              </div>
            )}

            {/* Show transcript if available (for completed interviews) */}
            {interview.transcript && interview.status === 'completed' && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-blue-600" />
                  Interview Transcript
                </h3>
                <div className="bg-white border border-slate-200 rounded-lg p-4 max-h-64 overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm text-slate-700 font-mono leading-relaxed">
                    {interview.transcript}
                  </pre>
                </div>
              </div>
            )}

            <div className="bg-blue-50 rounded-lg p-6">
              <h3 className="font-bold text-slate-900 mb-3">AI Analysis Features</h3>
              <ul className="space-y-2 text-slate-700">
                <li className="flex items-start">
                  <span className="text-cyan-600 mr-2">✓</span>
                  <span>Real-time emotion and facial expression detection</span>
                </li>
                <li className="flex items-start">
                  <span className="text-cyan-600 mr-2">✓</span>
                  <span>Speech pattern and sentiment analysis</span>
                </li>
                <li className="flex items-start">
                  <span className="text-cyan-600 mr-2">✓</span>
                  <span>Behavioral monitoring and integrity checks</span>
                </li>
                <li className="flex items-start">
                  <span className="text-cyan-600 mr-2">✓</span>
                  <span>Automatic transcription</span>
                </li>
              </ul>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h3 className="font-bold text-yellow-900 mb-3">Before You Start</h3>
              <ul className="space-y-2 text-yellow-800 text-sm">
                <li>• Ensure your camera and microphone are working</li>
                <li>• Find a quiet, well-lit location</li>
                <li>• Check your internet connection is stable</li>
                <li>• Close unnecessary applications</li>
                <li>• Have your resume and relevant documents ready</li>
              </ul>
            </div>

            {/* HR Control: Show waiting message if candidate and HR hasn't joined */}
            {!isHR && !interview.hrJoined && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
                <h3 className="font-bold text-blue-900 mb-2">Waiting for HR to Join</h3>
                <p className="text-blue-800 text-sm">
                  Please wait for the HR representative to join the interview. You will be able to join once they are ready.
                </p>
              </div>
            )}

            {/* Show start button only if HR or if HR has joined */}
            {(isHR || interview.hrJoined) && (
              <>
                <button
                  onClick={startInterview}
                  className="w-full py-4 bg-blue-600 text-white text-lg font-bold rounded-lg hover:bg-blue-700 transition-all"
                >
                  {isHR ? 'Start Interview (HR)' : 'Join Interview'}
                </button>

                <p className="text-center text-sm text-slate-500">
                  By starting the interview, you consent to being analyzed
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
