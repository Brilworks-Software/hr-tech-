import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useCheatingDetection } from '../hooks/useCheatingDetection';
import { interviewService } from '../services/interviewService';
import VideoCallUIKit from '../components/VideoCallUIKit';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AlertCircle, X } from 'lucide-react';
import type { ICameraVideoTrack } from 'agora-rtc-react';

/**
 * CandidateInterview Page
 * Allows candidates to join video interviews using Agora with channel code
 */
export default function CandidateInterview() {
  const { interviewId } = useParams<{ interviewId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const { startDetection, stopDetection, alerts } = useCheatingDetection();
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  const [cameraTrack, setCameraTrack] = useState<ICameraVideoTrack | null>(null);

  // Handler to receive camera track from VideoCallUIKit
  const handleCameraTrackReady = useCallback((track: ICameraVideoTrack) => {
    console.log('📹 Camera track ready for MediaPipe detection:', track);
    setCameraTrack(track);
  }, []);

  useEffect(() => {
    if (!interviewId) {
      showToast('Interview ID is required', 'error');
      navigate('/');
      return;
    }

    const setupInterview = async () => {
      try {
        setLoading(true);

        // Get interview details
        const interview = await interviewService.getInterviewById(interviewId);
        if (!interview) {
          showToast('Interview not found', 'error');
          navigate('/');
          return;
        }

        // Get candidate name
        const candidateName = currentUser?.email?.split('@')[0] || 'Candidate';
        setUserName(candidateName);

        // Get room code (Agora channel) from URL params or interview document
        const codeFromUrl = searchParams.get('code');
        const codeFromInterview = interview.agoraChannel;

        const code = codeFromUrl || codeFromInterview;

        if (!code) {
          showToast('Channel not found. Please check your interview invitation email.', 'error');
          navigate('/');
          return;
        }

        setRoomCode(code);
      } catch (error) {
        console.error('Error setting up interview:', error);
        showToast('Failed to setup interview', 'error');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    setupInterview();

    return () => {
      stopDetection();
    };
  }, [interviewId, currentUser, navigate, showToast, stopDetection, searchParams]);

  // End interview automatically when HR completes it
  useEffect(() => {
    if (!interviewId) return;

    // Quick initial check
    interviewService.getInterviewById(interviewId).then(initial => {
      if (initial && initial.status === 'completed') {
        stopDetection();
        showToast('Interview completed by HR', 'info');
        navigate('/');
      }
    }).catch(() => {});

    const interviewRef = doc(db, 'interviews', interviewId);
    const unsubscribe = onSnapshot(interviewRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as { status?: string };
      if (data?.status === 'completed') {
        stopDetection();
        showToast('Interview completed by HR', 'info');
        navigate('/');
      }
    });
    return () => unsubscribe();
  }, [interviewId, navigate, showToast, stopDetection]);

  // When camera track is ready, play it in a video element for MediaPipe detection
  useEffect(() => {
    if (!cameraTrack || !videoElementRef.current || !interviewId) {
      console.log('⏸️ Waiting for:', {
        hasCameraTrack: !!cameraTrack,
        hasVideoElement: !!videoElementRef.current,
        hasInterviewId: !!interviewId
      });
      return;
    }

    console.log('🎥 Setting up TensorFlow detection with Agora camera track');
    console.log('📹 Camera track details:', {
      trackId: cameraTrack.getTrackId(),
      enabled: cameraTrack.enabled,
      muted: cameraTrack.muted
    });

    const videoElement = videoElementRef.current;

    // Get the MediaStreamTrack from Agora and create a MediaStream
    try {
      const mediaStreamTrack = cameraTrack.getMediaStreamTrack();
      console.log('📹 Got MediaStreamTrack:', mediaStreamTrack);
      
      const mediaStream = new MediaStream([mediaStreamTrack]);
      videoElement.srcObject = mediaStream;
      videoElement.play();
      
      console.log('✅ Camera track playing in video element via MediaStream');
    } catch (error) {
      console.error('❌ Error playing camera track:', error);
      return;
    }

    // Wait for video to be ready, then start detection
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max
    
    const startWhenReady = () => {
      attempts++;
      
      if (videoElement && videoElement.readyState >= 2) {
        console.log('✅ Video ready, starting cheating detection for interview:', interviewId);
        console.log('📺 Video element state:', {
          readyState: videoElement.readyState,
          videoWidth: videoElement.videoWidth,
          videoHeight: videoElement.videoHeight,
          paused: videoElement.paused,
          currentTime: videoElement.currentTime
        });
        startDetection(videoElement, interviewId);
      } else if (attempts < maxAttempts) {
        console.log(`⏳ Video not ready yet, attempt ${attempts}/${maxAttempts} (readyState: ${videoElement?.readyState})`);
        setTimeout(startWhenReady, 100);
      } else {
        console.error('❌ Video failed to load after', maxAttempts, 'attempts');
      }
    };

    startWhenReady();

    // Cleanup when component unmounts or dependencies change
    return () => {
      console.log('🧹 Cleaning up TensorFlow detection setup');
      if (videoElement) {
        videoElement.srcObject = null;
        videoElement.pause();
      }
    };
  }, [cameraTrack, interviewId, startDetection]);

  // Detect tab/window changes
  useEffect(() => {
    if (!interviewId) return;

    const handleVisibilityChange = async () => {
      if (document.hidden) {
        console.log('⚠️ Tab switched away - logging cheating alert');
        
        // Log to Firestore
        try {
          const { addDoc, collection, Timestamp } = await import('firebase/firestore');
          await addDoc(collection(db, 'interviews', interviewId, 'alerts'), {
            type: 'tab_switched',
            severity: 'high',
            message: 'Candidate switched to another tab or window',
            timestamp: Timestamp.now(),
            details: 'User navigated away from the interview tab'
          });
        } catch (error) {
          console.error('Error logging tab switch:', error);
        }

        showToast('Warning: Switching tabs is not allowed during the interview', 'error');
      }
    };

    const handleBlur = async () => {
      // Only log if the entire document loses focus (user switched apps/windows)
      setTimeout(async () => {
        if (!document.hasFocus()) {
          console.log('⚠️ Window/App switched - logging cheating alert');
          
          // Log to Firestore
          try {
            const { addDoc, collection, Timestamp } = await import('firebase/firestore');
            await addDoc(collection(db, 'interviews', interviewId, 'alerts'), {
              type: 'window_blur',
              severity: 'high',
              message: 'Candidate switched to another application or window',
              timestamp: Timestamp.now(),
              details: 'User navigated to a different application'
            });
          } catch (error) {
            console.error('Error logging window blur:', error);
          }

          showToast('Warning: Switching applications is not allowed during the interview', 'error');
        }
      }, 100);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [interviewId, showToast]);

  const handleLeave = () => {
    stopDetection();
    
    // The Agora track will be cleaned up by VideoCallUIKit
    // Just clear the video element
    if (videoElementRef.current) {
      videoElementRef.current.srcObject = null;
    }
    
    showToast('You left the interview', 'info');
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading interview...</p>
        </div>
      </div>
    );
  }

  if (!roomCode) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <p className="text-lg mb-4">Channel not found</p>
          <p className="text-slate-400 mb-4">Please check your interview invitation email for the channel code.</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900">
      {/* Video Call - Full screen */}
      <div className="relative w-full h-full">
        <VideoCallUIKit
          roomCode={roomCode}
          userName={userName}
          isHost={false}
          onLeave={handleLeave}
          onCameraTrackReady={handleCameraTrackReady}
        />
        
        {/* Channel Code Display (top-center) */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-30 bg-slate-800/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg">
          <div className="text-center">
            <p className="text-xs text-slate-400 mb-1">Channel Code</p>
            <p className="text-lg font-mono font-bold text-white tracking-wider">{roomCode}</p>
          </div>
        </div>
        
        {/* Close button overlay (top-left) */}
        <button
          onClick={handleLeave}
          className="absolute top-4 left-4 z-30 p-3 bg-slate-800/90 hover:bg-slate-700 rounded-full text-white transition-all shadow-lg backdrop-blur-sm"
          aria-label="Close"
          title="Leave Interview"
        >
          <X className="w-5 h-5" />
        </button>

      </div>

      {/* Hidden video element for cheating detection (plays Agora camera track) */}
      <video
        ref={videoElementRef}
        autoPlay
        playsInline
        muted
        style={{ 
            display: 'none'
        }}
        id="detection-video"
      />

      {/* Alerts (for candidate awareness) */}
      {alerts.length > 0 && (
        <div className="fixed bottom-4 right-4 max-w-md z-50">
          {alerts.slice(-3).map((alert, index) => (
            <div
              key={index}
              className={`mb-2 p-3 rounded-lg flex items-start gap-2 ${
                alert.severity === 'high'
                  ? 'bg-red-900/90 text-red-100'
                  : alert.severity === 'medium'
                  ? 'bg-yellow-900/90 text-yellow-100'
                  : 'bg-blue-900/90 text-blue-100'
              }`}
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">{alert.message}</p>
                <p className="text-xs opacity-75 mt-1">
                  {alert.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

