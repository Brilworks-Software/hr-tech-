import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { interviewService } from '../services/interviewService';
import VideoCallUIKit from '../components/VideoCallUIKit';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AlertCircle, X, Users, Clock } from 'lucide-react';

interface CheatingAlert {
  id: string;
  timestamp: Timestamp;
  type: 'face_not_detected' | 'looking_away' | 'multiple_faces' | 'attentive';
  severity: 'low' | 'medium' | 'high';
  message: string;
  confidence?: number;
}

/**
 * HRDashboard Page
 * Allows HR to monitor video interviews and see real-time cheating alerts
 */
export default function HRDashboard() {
  const { interviewId } = useParams<{ interviewId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<CheatingAlert[]>([]);
  const [suspiciousCount, setSuspiciousCount] = useState(0);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const hasShownHighAlertRef = useRef<Set<string>>(new Set());

  // Generate a unique channel code for Agora
  const generateRoomCode = (): string => {
    // Generate completely random channel name
    const randomPart1 = Math.random().toString(36).substring(2, 8).toLowerCase();
    const randomPart2 = Math.random().toString(36).substring(2, 8).toLowerCase();
    const randomPart3 = Math.random().toString(36).substring(2, 6).toLowerCase();
    return `${randomPart1}-${randomPart2}-${randomPart3}`;
  };

  useEffect(() => {
    if (!interviewId) {
      showToast('Interview ID is required', 'error');
      navigate('/dashboard?view=interviews');
      return;
    }

    if (!currentUser) {
      showToast('You must be logged in to access HR dashboard', 'error');
      navigate('/login');
      return;
    }

    const setupInterview = async () => {
      try {
        setLoading(true);

        // Get interview details
        const interview = await interviewService.getInterviewById(interviewId);
        if (!interview) {
          showToast('Interview not found', 'error');
          navigate('/dashboard?view=interviews');
          return;
        }

        // Set HR name
        setUserName(currentUser.email?.split('@')[0] || 'HR');

        // Get existing channel (Agora) if already set during scheduling
        let code = interview.agoraChannel;
        if (!code) {
          // Fallback: Generate new code if missing
          code = generateRoomCode();
          
          // Save channel to Firestore
          await updateDoc(doc(db, 'interviews', interviewId), {
            agoraChannel: code,
            hrJoined: true,
          });
          
          showToast('Channel generated. Share it with the candidate.', 'success');
        } else {
          // Mark HR as joined
          await updateDoc(doc(db, 'interviews', interviewId), {
            hrJoined: true,
          });
        }

        setRoomCode(code);
      } catch (error) {
        console.error('Error setting up interview:', error);
        showToast('Failed to setup interview', 'error');
        navigate('/dashboard?view=interviews');
      } finally {
        setLoading(false);
      }
    };

    setupInterview();
  }, [interviewId, currentUser, navigate, showToast]);

  // Listen for real-time cheating alerts
  useEffect(() => {
    if (!interviewId) return;

    console.log('🔍 Setting up alerts listener for interview:', interviewId);

    const alertsQuery = query(
      collection(db, 'interviews', interviewId, 'alerts'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(
      alertsQuery,
      (snapshot) => {
        console.log('📢 Alerts snapshot received, size:', snapshot.size);
        
        const alertsData: CheatingAlert[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          console.log('Alert data:', data);
          alertsData.push({
            id: doc.id,
            ...(data as Omit<CheatingAlert, 'id'>),
          });
        });

        console.log('✅ Processed alerts:', alertsData.length);
        setAlerts(alertsData);
        setSuspiciousCount(alertsData.length);

        // Show toast for NEW high severity alerts only (avoid re-showing on re-renders)
        const highSeverityAlerts = alertsData.filter(
          (a) => a.severity === 'high'
        );
        
        if (highSeverityAlerts.length > 0) {
          const latest = highSeverityAlerts[0];
          // Only show if we haven't shown this alert before
          if (!hasShownHighAlertRef.current.has(latest.id)) {
            hasShownHighAlertRef.current.add(latest.id);
            showToast(`⚠️ ${latest.message}`, 'error');
          }
        }
      },
      (error) => {
        console.error('❌ Error listening to alerts:', error);
      }
    );

    return () => {
      console.log('🔇 Unsubscribing from alerts listener');
      unsubscribe();
    };
  }, [interviewId, showToast]);

  const handleLeave = async () => {
    if (!interviewId) {
      navigate('/dashboard?view=interviews');
      return;
    }
    try {
      await interviewService.completeInterview(interviewId);
      showToast('Interview ended', 'success');
    } catch (e) {
      console.error('Error completing interview on leave:', e);
      showToast('Left the call. Interview marked complete may have failed.', 'warning');
    } finally {
      navigate('/dashboard?view=interviews');
    }
  };

  const handleEndInterview = async () => {
    if (!interviewId) return;

    try {
      // End interview via service
      await interviewService.completeInterview(interviewId);
      showToast('Interview ended successfully', 'success');
      navigate('/dashboard?view=interviews');
    } catch (error) {
      console.error('Error ending interview:', error);
      showToast('Error ending interview', 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading interview dashboard...</p>
        </div>
      </div>
    );
  }

  // Count alerts by severity
  const highSeverityCount = alerts.filter((a) => a.severity === 'high').length;
  const mediumSeverityCount = alerts.filter(
    (a) => a.severity === 'medium'
  ).length;
  const lowSeverityCount = alerts.filter((a) => a.severity === 'low').length;

  return (
    <div className="h-screen bg-slate-900 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-slate-800 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-white text-xl font-semibold">HR Interview Dashboard</h1>
          {suspiciousCount > 0 && (
            <div className="flex items-center gap-2 bg-red-600/20 text-red-400 px-3 py-1 rounded-full text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>{suspiciousCount} Suspicious Events</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleEndInterview}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
          >
            End Interview
          </button>
          <button
            onClick={handleLeave}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 p-4 min-h-0">
        {/* Video Call - Main View */}
        <div className="flex-1 flex flex-col gap-4 min-w-0 min-h-0">
          {/* Video Call */}
          <div className="flex-1 bg-slate-800 rounded-lg overflow-hidden min-h-0">
            {roomCode ? (
              <VideoCallUIKit
                roomCode={roomCode}
                userName={userName}
                isHost={true}
                onLeave={handleLeave}
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                  <p>Setting up video call...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Alerts Sidebar */}
        <div className="w-96 bg-slate-800 rounded-lg flex flex-col min-h-0">
          <div className="p-4 flex-shrink-0 border-b border-slate-700">
            <h2 className="text-white text-lg font-semibold mb-2 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Real-time Alerts
            </h2>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-red-600/20 text-red-400 px-3 py-2 rounded text-center">
                <div className="text-2xl font-bold">{highSeverityCount}</div>
                <div className="text-xs">High</div>
              </div>
              <div className="bg-yellow-600/20 text-yellow-400 px-3 py-2 rounded text-center">
                <div className="text-2xl font-bold">{mediumSeverityCount}</div>
                <div className="text-xs">Medium</div>
              </div>
              <div className="bg-blue-600/20 text-blue-400 px-3 py-2 rounded text-center">
                <div className="text-2xl font-bold">{lowSeverityCount}</div>
                <div className="text-xs">Low</div>
              </div>
            </div>
          </div>

          {/* Scrollable alerts list */}
          <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
            {alerts.length === 0 ? (
              <div className="text-center text-slate-400 py-8">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No alerts yet</p>
                <p className="text-sm mt-1">Alerts will appear here in real-time</p>
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-lg border-l-4 ${
                      alert.severity === 'high'
                        ? 'bg-red-900/30 border-red-500 text-red-100'
                        : alert.severity === 'medium'
                        ? 'bg-yellow-900/30 border-yellow-500 text-yellow-100'
                        : 'bg-blue-900/30 border-blue-500 text-blue-100'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{alert.message}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="w-3 h-3 opacity-75" />
                          <span className="text-xs opacity-75">
                            {alert.timestamp.toDate().toLocaleTimeString()}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              alert.severity === 'high'
                                ? 'bg-red-600/50'
                                : alert.severity === 'medium'
                                ? 'bg-yellow-600/50'
                                : 'bg-blue-600/50'
                            }`}
                          >
                            {alert.severity.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

