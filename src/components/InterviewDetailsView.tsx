import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, Calendar, Clock, ArrowLeft, Video } from 'lucide-react';
import { interviewService } from '../services/interviewService';
import { useToast } from '../contexts/ToastContext';
import { Interview } from '../lib/firebase';

export default function InterviewDetailsView() {
  const { interviewId } = useParams<{ interviewId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [interview, setInterview] = useState<Interview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!interviewId) return;

    const fetchInterview = async () => {
      try {
        const interviewData = await interviewService.getInterviewById(interviewId);
        if (interviewData) {
          setInterview(interviewData);
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

  const handleJoinInterview = () => {
    if (interviewId) {
      navigate(`/interview/${interviewId}`);
    }
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

          {/* Join Interview Button */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <button
              onClick={handleJoinInterview}
              className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Video className="w-5 h-5" />
              <span>Join/Rejoin Interview</span>
            </button>
          </div>
        </div>

        {/* Transcript Section */}
        {interview.transcript ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center mb-6">
              <FileText className="w-6 h-6 mr-3 text-blue-600" />
              <h2 className="text-2xl font-bold text-slate-900">Interview Transcript</h2>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 max-h-[600px] overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm text-slate-700 font-mono leading-relaxed">
                {interview.transcript}
              </pre>
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
      </div>
    </div>
  );
}

