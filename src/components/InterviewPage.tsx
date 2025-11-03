import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { interviewService } from '../services/interviewService';
import VideoInterview from './VideoInterview';
import { Video, Clock, Calendar } from 'lucide-react';

export default function InterviewPage() {
  const { interviewId } = useParams<{ interviewId: string }>();
  const navigate = useNavigate();
  const [interview, setInterview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    if (interviewId) {
      fetchInterview();
    }
  }, [interviewId]);

  const fetchInterview = async () => {
    if (!interviewId) return;

    try {
      const interviewData = await interviewService.getInterviewById(interviewId);

      if (interviewData) {
        setInterview(interviewData);
      } else {
        alert('Interview not found');
        navigate('/');
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching interview:', error);
      setLoading(false);
    }
  };

  const startInterview = async () => {
    if (!interviewId) return;

    try {
      await interviewService.startInterview(interviewId);
      setHasStarted(true);
    } catch (error) {
      console.error('Error starting interview:', error);
      alert('Failed to start interview');
    }
  };

  const endInterview = async () => {
    if (!interviewId) return;

    try {
      await interviewService.completeInterview(interviewId);
      alert('Interview completed successfully!');
      navigate('/');
    } catch (error) {
      console.error('Error ending interview:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!interview) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h2 className="text-2xl font-bold mb-2">Interview Not Found</h2>
          <p className="text-slate-400">The interview link may be invalid or expired</p>
        </div>
      </div>
    );
  }

  if (hasStarted || interview.status === 'in_progress') {
    return <VideoInterview interviewId={interviewId!} onEnd={endInterview} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-cyan-500 p-8 text-white">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
              <Video className="w-8 h-8" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-center mb-2">Video Interview</h1>
          <p className="text-center text-blue-100">AI-Powered Recruitment Platform</p>
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

            <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg p-6">
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
                  <span>Automatic recording and transcription</span>
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

            <button
              onClick={startInterview}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-lg font-bold rounded-lg hover:shadow-xl hover:shadow-blue-500/30 transition-all"
            >
              Start Interview
            </button>

            <p className="text-center text-sm text-slate-500">
              By starting the interview, you consent to being recorded and analyzed
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
