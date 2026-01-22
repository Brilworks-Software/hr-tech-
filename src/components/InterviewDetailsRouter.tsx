import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import AIInterviewDetailsView from './AIInterviewDetailsView';
import HRInterviewDetailsView from './HRInterviewDetailsView';
import { useToast } from '../contexts/ToastContext';

export default function InterviewDetailsRouter() {
  const { interviewId } = useParams<{ interviewId: string }>();
  const { showToast } = useToast();
  const [interviewType, setInterviewType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!interviewId) return;

    const fetchInterviewType = async () => {
      try {
        const interviewDoc = await getDoc(doc(db, 'interviews', interviewId));
        if (interviewDoc.exists()) {
          const data = interviewDoc.data();
          const type = data.interviewType || 'ai-video'; // Default to ai-video for backward compatibility
          console.log('Interview data:', { id: interviewId, interviewType: type, hasType: !!data.interviewType });
          setInterviewType(type);
        } else {
          showToast('Interview not found.', 'error');
        }
      } catch (error) {
        console.error('Error fetching interview type:', error);
        showToast('Failed to load interview.', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchInterviewType();
  }, [interviewId, showToast]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!interviewType) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Interview Not Found</h2>
          <p className="text-slate-600 mb-6">The interview you're looking for doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  // Route to the appropriate component based on interview type
  // Default to hr-video if not specified (backward compatibility)
  if (interviewType === 'ai-video') {
    return <AIInterviewDetailsView />;
  } else if (interviewType === 'hr-video') {
    return <HRInterviewDetailsView />;
  } else {
    // Fallback: try to determine from interview data
    return <AIInterviewDetailsView />;
  }
}
