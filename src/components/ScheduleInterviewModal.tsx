import { useState } from 'react';
import { X, Calendar, Mail, Clock, Link as LinkIcon, Bot, Users } from 'lucide-react';
import { interviewService } from '../services/interviewService';
import { useToast } from '../contexts/ToastContext';

interface ScheduleInterviewModalProps {
  applicationId: string;
  candidateEmail: string;
  candidateName: string;
  jobTitle: string;
  onClose: () => void;
  onSuccess: () => void;
}

type InterviewType = 'ai-video' | 'hr-video';

export default function ScheduleInterviewModal({
  applicationId,
  candidateEmail,
  candidateName,
  jobTitle,
  onClose,
  onSuccess,
}: ScheduleInterviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [interviewType, setInterviewType] = useState<InterviewType>('ai-video');
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    duration: '30',
    instructions: '',
  });
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!applicationId || !candidateEmail || !candidateName || !jobTitle) {
      showToast('Missing required information. Please schedule from the Applications page.', 'warning');
      return;
    }

    if (!formData.date || !formData.time) {
      showToast('Please select both date and time for the interview.', 'warning');
      return;
    }

    setLoading(true);

    try {
      const scheduledDateTime = new Date(`${formData.date}T${formData.time}`);
      
      // Validate date is in the future
      if (scheduledDateTime <= new Date()) {
        showToast('Please select a future date and time for the interview.', 'warning');
        setLoading(false);
        return;
      }

      const interviewId = await interviewService.scheduleInterviewWithEmail({
        applicationId,
        scheduledAt: scheduledDateTime,
        duration: parseInt(formData.duration),
        instructions: formData.instructions,
        candidateEmail,
        candidateName,
        jobTitle,
        interviewType, // Include interview type
      });

      const interviewLink = interviewType === 'ai-video'
        ? `${window.location.origin}/ai-video-interview/${interviewId}`
        : `${window.location.origin}/video-call/${interviewId}`;
      
      // Show simplified success message
      showToast(`${interviewType === 'ai-video' ? 'AI' : 'HR'} interview is scheduled`, 'success');
      
      // Copy link to clipboard silently
      navigator.clipboard.writeText(interviewLink).catch(() => {
        // Ignore clipboard errors
      });
      
      setLoading(false);
      onSuccess();
    } catch (error) {
      setLoading(false);
      const err = error as Error;
      showToast('Error scheduling interview: ' + err.message, 'error');
    }
  };

  const minDate = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Schedule Interview</h2>
            <p className="text-sm text-slate-600 mt-1">
              {candidateName} - {jobTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Interview Type Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-3">
              Interview Type *
            </label>
            <div className="grid grid-cols-2 gap-4">
              {/* AI Interview Option */}
              <button
                type="button"
                onClick={() => setInterviewType('ai-video')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  interviewType === 'ai-video'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-slate-200 hover:border-blue-300'
                }`}
              >
                <div className="flex flex-col items-center space-y-2">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    interviewType === 'ai-video'
                      ? 'bg-blue-600'
                      : 'bg-slate-200'
                  }`}>
                    <Bot className={`w-6 h-6 ${
                      interviewType === 'ai-video' ? 'text-white' : 'text-slate-600'
                    }`} />
                  </div>
                  <div className="text-center">
                    <p className={`font-semibold ${
                      interviewType === 'ai-video' ? 'text-blue-900' : 'text-slate-700'
                    }`}>
                      AI Interview
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      AI conducts the interview
                    </p>
                  </div>
                </div>
              </button>

              {/* HR Interview Option */}
              <button
                type="button"
                onClick={() => setInterviewType('hr-video')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  interviewType === 'hr-video'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-slate-200 hover:border-blue-300'
                }`}
              >
                <div className="flex flex-col items-center space-y-2">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    interviewType === 'hr-video'
                      ? 'bg-blue-600'
                      : 'bg-slate-200'
                  }`}>
                    <Users className={`w-6 h-6 ${
                      interviewType === 'hr-video' ? 'text-white' : 'text-slate-600'
                    }`} />
                  </div>
                  <div className="text-center">
                    <p className={`font-semibold ${
                      interviewType === 'hr-video' ? 'text-blue-900' : 'text-slate-700'
                    }`}>
                      HR Interview
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      You conduct the interview
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Mail className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-900">Email will be sent automatically</p>
                <p className="text-sm text-blue-700 mt-1">
                  An email with the interview link will be sent to <span className="font-medium">{candidateEmail}</span> via Firebase Cloud Functions.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Interview Date *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="date"
                  required
                  min={minDate}
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Interview Time *
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="time"
                  required
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Duration (minutes) *
            </label>
            <select
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">1 hour</option>
              <option value="90">1.5 hours</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Instructions for Candidate
            </label>
            <textarea
              value={formData.instructions}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              rows={4}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Add any special instructions or requirements for the interview..."
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <LinkIcon className="w-5 h-5 text-cyan-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-cyan-900">Interview Link</p>
                <p className="text-sm text-cyan-700 mt-1">
                  A unique video interview link will be generated and sent to the candidate
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-sm font-semibold text-slate-900 mb-2">
              {interviewType === 'ai-video' ? 'AI Features Included:' : 'HR Interview Features:'}
            </p>
            {interviewType === 'ai-video' ? (
              <ul className="text-sm text-slate-600 space-y-1">
                <li>• AI-powered automated interview</li>
                <li>• Real-time speech recognition and analysis</li>
                <li>• Automatic interview transcription</li>
                <li>• AI-generated evaluation and scoring</li>
              </ul>
            ) : (
              <ul className="text-sm text-slate-600 space-y-1">
                <li>• Live video call with HR interviewer</li>
                <li>• Real-time conversation</li>
                <li>• Screen sharing capabilities</li>
                <li>• Recording and playback options</li>
              </ul>
            )}
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              {loading ? 'Scheduling...' : 'Schedule & Send Email'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
