import { useState, useEffect, useRef } from 'react';
import {
  AgoraRTCProvider,
  LocalUser,
  RemoteUser,
  useJoin,
  useLocalCameraTrack,
  useLocalMicrophoneTrack,
  usePublish,
  useRemoteUsers,
  useRemoteVideoTracks,
  useRemoteAudioTracks,
  useRTCClient,
} from 'agora-rtc-react';
import AgoraRTC, { ICameraVideoTrack, ILocalVideoTrack } from 'agora-rtc-react';
import { useToast } from '../contexts/ToastContext';
import { Monitor, MonitorOff, Captions, CaptionsOff } from 'lucide-react';
import { doc, setDoc, onSnapshot, Timestamp, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface TranscriptMessage {
  uid: number;
  userName: string;
  text: string;
  timestamp: Timestamp;
  isFinal: boolean;
}

interface VideoCallUIKitProps {
  roomCode: string;
  userName: string;
  isHost?: boolean;
  onLeave?: () => void;
  onCameraTrackReady?: (track: ICameraVideoTrack) => void;
}

/**
 * Inner component that uses Agora hooks (must be inside AgoraRTCProvider)
 */
function VideoCallContent({
  channelName,
  token,
  appId,
  uid,
  userName,
  onLeave,
  onCameraTrackReady,
}: {
  channelName: string;
  token: string;
  appId: string;
  uid: number;
  userName: string;
  onLeave?: () => void;
  onCameraTrackReady?: (track: ICameraVideoTrack) => void;
}) {
  const client = useRTCClient();
  const { showToast } = useToast();
  const { localMicrophoneTrack } = useLocalMicrophoneTrack();
  const { localCameraTrack } = useLocalCameraTrack();
  const remoteUsers = useRemoteUsers();
  const { videoTracks } = useRemoteVideoTracks(remoteUsers);
  const { audioTracks } = useRemoteAudioTracks(remoteUsers);
  const [hasJoined, setHasJoined] = useState(false);
  const [screenTrack, setScreenTrack] = useState<ILocalVideoTrack | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  // Transcript state
  const [transcriptEnabled, setTranscriptEnabled] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const recognitionRef = useRef<unknown | null>(null);

  // Initialize speech recognition
  useEffect(() => {
    if (!transcriptEnabled) return;

    try {
      const SpeechRecognition = (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition || 
                               (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        showToast('Speech recognition not supported in this browser', 'error');
        setTranscriptEnabled(false);
        return;
      }

      const recognition = new (SpeechRecognition as unknown as new () => {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        onresult: (event: { resultIndex: number; results: { length: number; isFinal: boolean; 0: { transcript: string } }[] }) => void;
        onerror: (event: { error: string }) => void;
        onend: () => void;
        start: () => void;
        stop: () => void;
      })();
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = async (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          // Save final transcript to Firestore as array
          try {
            const transcriptDoc = doc(db, 'channels', channelName);
            await setDoc(transcriptDoc, {
              transcripts: arrayUnion({
                uid,
                userName,
                text: finalTranscript.trim(),
                timestamp: Timestamp.now(),
                isFinal: true,
              })
            }, { merge: true });
            setCurrentTranscript('');
          } catch (error) {
            console.error('Error saving transcript:', error);
          }
        } else if (interimTranscript) {
          setCurrentTranscript(interimTranscript);
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'no-speech') {
          recognition.start();
        }
      };

      recognition.onend = () => {
        if (transcriptEnabled && recognitionRef.current) {
          recognition.start();
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
      console.log('✅ Speech recognition started');

    } catch (error) {
      console.error('Error initializing speech recognition:', error);
      showToast('Failed to start speech recognition', 'error');
      setTranscriptEnabled(false);
    }

    return () => {
      if (recognitionRef.current) {
        (recognitionRef.current as { stop: () => void }).stop();
        recognitionRef.current = null;
      }
    };
  }, [transcriptEnabled, channelName, uid, userName, showToast]);

  // Listen to Firestore for transcripts from all users
  useEffect(() => {
    if (!transcriptEnabled) return;

    const transcriptDoc = doc(db, 'channels', channelName);

    const unsubscribe = onSnapshot(transcriptDoc, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const transcriptsArray = data?.transcripts || [];
        // Sort by timestamp and take last 50
        const sortedTranscripts = [...transcriptsArray]
          .sort((a: TranscriptMessage, b: TranscriptMessage) => {
            const aTime = a.timestamp?.toMillis?.() || 0;
            const bTime = b.timestamp?.toMillis?.() || 0;
            return aTime - bTime;
          })
          .slice(-50);
        setTranscripts(sortedTranscripts);
      } else {
        setTranscripts([]);
      }
    });

    return () => unsubscribe();
  }, [transcriptEnabled, channelName]);

  // Debug logging for connection status
  useEffect(() => {
    if (!hasJoined) {
      console.log('📺 VideoCallContent mounted');
      console.log('Channel:', channelName);
      console.log('AppId:', appId);
      console.log('Token:', token ? '✅ Present' : '❌ Missing');
      console.log('UID:', uid);
      setHasJoined(true);
    }
  }, [hasJoined, channelName, appId, token, uid]);

  // Debug logging for tracks
  useEffect(() => {
    console.log('🎥 Local camera track:', localCameraTrack ? '✅ Ready' : '⏳ Waiting');
    console.log('🎤 Local microphone track:', localMicrophoneTrack ? '✅ Ready' : '⏳ Waiting');
  }, [localCameraTrack, localMicrophoneTrack]);

  // Remote users with detailed logging
  useEffect(() => {
    console.log('👥 Remote users count:', remoteUsers.length);
    console.log('📹 Remote video tracks:', videoTracks.length);
    console.log('🎵 Remote audio tracks:', audioTracks.length);
    remoteUsers.forEach((user, index) => {
      console.log(`  User ${index + 1}:`, {
        uid: user.uid,
        hasVideo: user.hasVideo,
        hasAudio: user.hasAudio,
        videoTrack: user.videoTrack ? '✅' : '❌',
        audioTrack: user.audioTrack ? '✅' : '❌'
      });
    });
  }, [remoteUsers, videoTracks, audioTracks]);

  // Notify parent when camera track is ready (for cheating detection)
  useEffect(() => {
    if (localCameraTrack && onCameraTrackReady) {
      onCameraTrackReady(localCameraTrack);
    }
  }, [localCameraTrack, onCameraTrackReady]);

  // Join the channel
  const joinState = useJoin({
    appid: appId,
    channel: channelName,
    token: token,
    uid: uid,
  });

  // Log join state
  useEffect(() => {
    console.log('🔗 Join state:', {
      joined: joinState,
      channel: channelName,
      uid: uid
    });
  }, [joinState, channelName, uid]);

  // Publish local tracks
  usePublish([localMicrophoneTrack, localCameraTrack]);

  // Listen to client events for debugging
  useEffect(() => {
    const handleUserJoined = (user: { uid: number | string }) => {
      console.log('🎉 User joined:', user.uid);
    };
    
    const handleUserLeft = (user: { uid: number | string }) => {
      console.log('👋 User left:', user.uid);
    };
    
    const handleUserPublished = (user: { uid: number | string }, mediaType: 'audio' | 'video') => {
      console.log('📢 User published:', user.uid, mediaType);
    };
    
    const handleUserUnpublished = (user: { uid: number | string }, mediaType: 'audio' | 'video') => {
      console.log('🔇 User unpublished:', user.uid, mediaType);
    };

    client.on('user-joined', handleUserJoined);
    client.on('user-left', handleUserLeft);
    client.on('user-published', handleUserPublished);
    client.on('user-unpublished', handleUserUnpublished);

    return () => {
      client.off('user-joined', handleUserJoined);
      client.off('user-left', handleUserLeft);
      client.off('user-published', handleUserPublished);
      client.off('user-unpublished', handleUserUnpublished);
    };
  }, [client]);

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const handleMute = () => {
    if (localMicrophoneTrack) {
      localMicrophoneTrack.setEnabled(!isMuted);
      setIsMuted(!isMuted);
    }
  };

  const handleCamera = () => {
    if (localCameraTrack) {
      localCameraTrack.setEnabled(!isCameraOff);
      setIsCameraOff(!isCameraOff);
    }
  };

  const handleScreenShare = async () => {
    try {
      if (isScreenSharing && screenTrack) {
        // Stop screen sharing
        await client.unpublish(screenTrack);
        screenTrack.close();
        setScreenTrack(null);
        setIsScreenSharing(false);
        
        // Re-publish camera track
        if (localCameraTrack) {
          await client.publish(localCameraTrack);
        }
        
        showToast('Screen sharing stopped', 'success');
      } else {
        // Start screen sharing
        const screenVideoTrack = await AgoraRTC.createScreenVideoTrack({
          encoderConfig: '1080p_1',
        }, 'auto');

        // Handle array return (video + audio) or single track
        const videoTrack = Array.isArray(screenVideoTrack) ? screenVideoTrack[0] : screenVideoTrack;
        
        // Unpublish camera and publish screen
        if (localCameraTrack) {
          await client.unpublish(localCameraTrack);
        }
        
        await client.publish(videoTrack);
        setScreenTrack(videoTrack);
        setIsScreenSharing(true);
        
        showToast('Screen sharing started', 'success');

        // Listen for screen share stop (user clicks browser's "Stop Sharing" button)
        videoTrack.on('track-ended', () => {
          handleScreenShare(); // Stop sharing
        });
      }
    } catch (error) {
      console.error('Screen share error:', error);
      showToast('Failed to share screen. Please try again.', 'error');
    }
  };

  const handleLeave = async () => {
    if (screenTrack) {
      screenTrack.close();
    }
    if (localMicrophoneTrack) localMicrophoneTrack.close();
    if (localCameraTrack) localCameraTrack.close();
    await client.leave();
    onLeave?.();
  };

  return (
    <div className="relative w-full h-full bg-slate-900">
      {/* Main video area - Remote user or waiting message */}
      <div className="absolute inset-0 flex items-center justify-center">
        {remoteUsers.length > 0 ? (
          // Show remote user video in full screen
          <div className="w-full h-full relative">
            {remoteUsers.map((user) => (
              <div key={user.uid} className="w-full h-full relative bg-black">
                <RemoteUser 
                  user={user} 
                  playVideo={true}
                  playAudio={true}
                  cover="contain"
                />
                <div className="absolute bottom-4 left-4 text-sm text-white bg-black/70 px-3 py-1.5 rounded-lg">
                  <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                  Connected
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Waiting state with better visuals
          <div className="flex flex-col items-center justify-center text-center px-4">
            <div className="relative mb-6">
              <div className="w-20 h-20 border-4 border-blue-500/30 rounded-full"></div>
              <div className="absolute inset-0 w-20 h-20 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-xl text-white font-medium mb-2">Waiting for other participant...</p>
            <p className="text-sm text-white/60">
              {localCameraTrack && localMicrophoneTrack 
                ? "You're ready! They'll appear here when they join."
                : "Setting up your camera and microphone..."}
            </p>
            {localCameraTrack && localMicrophoneTrack && (
              <div className="mt-4 text-xs text-green-400 flex items-center gap-2">
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Your camera and mic are active
              </div>
            )}
          </div>
        )}
      </div>

      {/* Live Captions Overlay */}
      {transcriptEnabled && (
        <div className="absolute bottom-32 left-0 right-0 mx-auto max-w-4xl px-4 z-10">
          <div className="bg-black/80 backdrop-blur-md rounded-2xl p-4 max-h-48 overflow-y-auto">
            {/* Recent transcripts */}
            <div className="space-y-2 mb-2">
              {transcripts.slice(-3).map((transcript, index) => (
                <div 
                  key={`${transcript.uid}-${transcript.timestamp?.toMillis?.()}-${index}`}
                  className={`text-sm ${transcript.uid === uid ? 'text-blue-300' : 'text-green-300'}`}
                >
                  <span className="font-semibold">{transcript.userName}: </span>
                  <span className="text-white">{transcript.text}</span>
                </div>
              ))}
            </div>            {/* Current interim transcript */}
            {currentTranscript && (
              <div className="text-sm text-blue-300 italic opacity-70">
                <span className="font-semibold">{userName}: </span>
                <span className="text-white">{currentTranscript}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Local user preview (picture-in-picture) */}
      <div className="absolute top-4 right-4 z-20 w-48 h-36 bg-black rounded-xl overflow-hidden border-2 border-white/30 shadow-2xl">
        <LocalUser
          audioTrack={localMicrophoneTrack}
          videoTrack={localCameraTrack}
          cameraOn={!isCameraOff}
          micOn={!isMuted}
          playAudio={false}
          cover="cover"
        />
        <div className="absolute bottom-2 left-2 text-xs text-white bg-black/70 px-2 py-1 rounded">
          You
        </div>
        {isCameraOff && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
            <div className="text-center text-white/70">
              <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p className="text-xs">Camera Off</p>
            </div>
          </div>
        )}
      </div>

      {/* Control buttons */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20 flex gap-3 bg-slate-800/90 backdrop-blur-sm px-6 py-4 rounded-2xl shadow-2xl">
        <button
          onClick={handleMute}
          className={`p-4 rounded-xl transition-all transform hover:scale-105 ${
            isMuted 
              ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/50' 
              : 'bg-slate-700 hover:bg-slate-600'
          }`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isMuted ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 016 0v6a3 3 0 01-3 3z" />
            )}
          </svg>
        </button>

        <button
          onClick={handleCamera}
          className={`p-4 rounded-xl transition-all transform hover:scale-105 ${
            isCameraOff 
              ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/50' 
              : 'bg-slate-700 hover:bg-slate-600'
          }`}
          title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isCameraOff ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            )}
          </svg>
        </button>

        <button
          onClick={handleScreenShare}
          className={`p-4 rounded-xl transition-all transform hover:scale-105 ${
            isScreenSharing 
              ? 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/50' 
              : 'bg-slate-700 hover:bg-slate-600'
          }`}
          title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
        >
          {isScreenSharing ? (
            <MonitorOff className="w-6 h-6 text-white" />
          ) : (
            <Monitor className="w-6 h-6 text-white" />
          )}
        </button>

        <button
          onClick={() => setTranscriptEnabled(!transcriptEnabled)}
          className={`p-4 rounded-xl transition-all transform hover:scale-105 ${
            transcriptEnabled 
              ? 'bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-500/50' 
              : 'bg-slate-700 hover:bg-slate-600'
          }`}
          title={transcriptEnabled ? 'Hide captions' : 'Show captions'}
        >
          {transcriptEnabled ? (
            <Captions className="w-6 h-6 text-white" />
          ) : (
            <CaptionsOff className="w-6 h-6 text-white" />
          )}
        </button>

        <button
          onClick={handleLeave}
          className="p-4 rounded-xl bg-red-600 hover:bg-red-700 transition-all transform hover:scale-105 shadow-lg shadow-red-500/50"
          title="Leave call"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 17l-4 4m0 0l-4-4m4 4V3" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/**
 * VideoCall Component using Agora React Hooks
 * This uses Agora's pre-built React hooks with custom UI
 */
export default function VideoCallUIKit({
  roomCode,
  userName,
  isHost = false,
  onLeave,
  onCameraTrackReady,
}: VideoCallUIKitProps) {
  const { showToast } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [uid, setUid] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [client] = useState(() => AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' }));

  const channelName = roomCode.substring(0, 64);
  const appId = import.meta.env.VITE_AGORA_APP_ID as string | undefined;

  // Fetch token on mount
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const { httpsCallable } = await import('firebase/functions');
        const { functions } = await import('../lib/firebase');
        const createAgoraToken = httpsCallable(functions, 'createAgoraToken');
        
        type TokenResponse = { token?: string; uid?: number };
        const resp = await createAgoraToken({ channelName, isHost, userName });
        const data = resp.data as TokenResponse | undefined;
        const fetchedToken = data?.token || null;
        const fetchedUid = data?.uid || null;

        if (!fetchedToken || fetchedUid === null) {
          throw new Error('Token or UID generation failed');
        }
        
        setToken(fetchedToken);
        setUid(fetchedUid);
        setIsLoading(false);
        console.log('✅ Agora token received, UID:', fetchedUid);
      } catch (e) {
        console.error('❌ Token service error:', e);
        showToast('Failed to get video token. Check Firebase Functions configuration.', 'error');
        setIsLoading(false);
      }
    };

    fetchToken();
  }, [channelName, isHost, userName, showToast]);

  if (!appId) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-900 text-white">
        <div className="text-center">
          <p className="text-xl font-semibold mb-2">⚠️ Configuration Error</p>
          <p>VITE_AGORA_APP_ID is missing in .env</p>
        </div>
      </div>
    );
  }

  if (isLoading || !token || uid === null) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-lg font-medium">Connecting to video call...</p>
        </div>
      </div>
    );
  }

  return (
    <AgoraRTCProvider client={client}>
      <VideoCallContent
        channelName={channelName}
        token={token}
        appId={appId}
        uid={uid}
        userName={userName}
        onLeave={onLeave}
        onCameraTrackReady={onCameraTrackReady}
      />
    </AgoraRTCProvider>
  );
}
