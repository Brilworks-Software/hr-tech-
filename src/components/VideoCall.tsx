import { useEffect, useRef, useState } from 'react';
import AgoraRTC, {
  IAgoraRTCClient,
  ILocalAudioTrack,
  ILocalVideoTrack,
  IAgoraRTCRemoteUser,
} from 'agora-rtc-sdk-ng';
import { useToast } from '../contexts/ToastContext';

interface VideoCallProps {
  roomCode: string;
  userName: string;
  isHost?: boolean;
  onLeave?: () => void;
  showControls?: boolean;
}

export default function VideoCall({
  roomCode,
  userName,
  isHost = false,
  onLeave,
  showControls = true,
}: VideoCallProps) {
  const { showToast } = useToast();

  const [isJoined, setIsJoined] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionTimeout, setConnectionTimeout] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localVideoTrackRef = useRef<ILocalVideoTrack | null>(null);
  const localAudioTrackRef = useRef<ILocalAudioTrack | null>(null);

  const channelName = roomCode.substring(0, 64);
  const appId = import.meta.env.VITE_AGORA_APP_ID as string | undefined;

  useEffect(() => {
    // Prevent re-initialization if already joined
    if (clientRef.current) {
      console.log('⚠️ Already initialized, skipping');
      return;
    }

    if (!appId) {
      console.error('Missing VITE_AGORA_APP_ID in .env');
      showToast('Video service not configured', 'error');
      setIsLoading(false);
      return;
    }

    let mounted = true;
    let client: IAgoraRTCClient | null = null;

    const init = async () => {
      try {
        client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        clientRef.current = client;

        client.on('user-published', async (user, mediaType) => {
          console.log(`👤 User ${user.uid} published ${mediaType}`);
          await client!.subscribe(user, mediaType);
          console.log(`✅ Subscribed to user ${user.uid} ${mediaType}`);

          if (mounted) {
            setRemoteUsers([...client!.remoteUsers]);
          }

          if (mediaType === 'video' && user.videoTrack) {
            setTimeout(() => {
              const container = document.getElementById(`remote-player-${user.uid}`);
              if (container && user.videoTrack) {
                user.videoTrack.play(`remote-player-${user.uid}`);
                console.log(`✅ Playing video for user ${user.uid}`);
              }
            }, 200);
          }
          if (mediaType === 'audio' && user.audioTrack) {
            user.audioTrack.play();
            console.log(`✅ Playing audio for user ${user.uid}`);
          }
        });

        client.on('user-unpublished', (user, mediaType) => {
          console.log(`👤 User ${user.uid} unpublished ${mediaType}`);
          if (mounted && client) {
            setRemoteUsers([...client.remoteUsers]);
          }
        });

        client.on('user-left', (user) => {
          console.log(`👋 User ${user.uid} left`);
          if (mounted && client) {
            setRemoteUsers([...client.remoteUsers]);
          }
        });

        const { httpsCallable } = await import('firebase/functions');
        const { functions } = await import('../lib/firebase');
        const createAgoraToken = httpsCallable(functions, 'createAgoraToken');
        
        type TokenResponse = { token?: string };
        const resp = await createAgoraToken({ channelName, isHost, userName });
        const data = resp.data as TokenResponse | undefined;
        const token = data?.token || null;

        if (!token) {
          throw new Error('Token generation failed');
        }
        console.log('✅ Agora token received');

        const uid = await client.join(appId, channelName, token, null);
        console.log(`✅ Joined Agora channel with uid: ${uid}`);

        console.log('📹 Creating local tracks...');
        const [micTrack, camTrack] = await Promise.all([
          AgoraRTC.createMicrophoneAudioTrack(),
          AgoraRTC.createCameraVideoTrack(),
        ]);
        console.log('✅ Local tracks created');

        localAudioTrackRef.current = micTrack;
        localVideoTrackRef.current = camTrack;

        console.log('📤 Publishing local tracks...');
        await client.publish([micTrack, camTrack]);
        console.log('✅ Local tracks published');

        setTimeout(() => {
          const container = document.getElementById('local-player');
          if (container && camTrack) {
            camTrack.play('local-player');
            console.log('✅ Local video playing');
          }
        }, 200);

        if (mounted) {
          setIsJoined(true);
          setIsLoading(false);
          showToast('Joined video interview', 'success');
        }
      } catch (err) {
        console.error('Agora join error:', err);
        if (mounted) {
          showToast('Failed to join video interview', 'error');
          setIsLoading(false);
        }
      }
    };

    init();

    return () => {
      mounted = false;

      const cleanup = async () => {
        try {
          if (localAudioTrackRef.current) {
            localAudioTrackRef.current.stop();
            localAudioTrackRef.current.close();
            localAudioTrackRef.current = null;
          }
          if (localVideoTrackRef.current) {
            localVideoTrackRef.current.stop();
            localVideoTrackRef.current.close();
            localVideoTrackRef.current = null;
          }
          if (client) {
            await client.leave();
            client.removeAllListeners();
            clientRef.current = null;
          }
          console.log('🧹 Cleaned up Agora client');
        } catch (e) {
          console.error('Cleanup error:', e);
        }
      };

      cleanup();
    };
  }, [appId, channelName, isHost, userName, showToast]);

  useEffect(() => {
    const t1 = setTimeout(() => {
      if (isLoading && !isJoined) {
        setConnectionTimeout(true);
        showToast('Connection is taking longer than usual...', 'warning');
      }
    }, 15000);

    const t2 = setTimeout(() => {
      if (isLoading && !isJoined) {
        console.error('❌ Failed to connect after 60s');
        showToast('Failed to connect to video call', 'error');
        setIsLoading(false);
      }
    }, 60000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isLoading, isJoined, showToast]);

  const handleLeave = async () => {
    try {
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.stop();
        localAudioTrackRef.current.close();
        localAudioTrackRef.current = null;
      }
      if (localVideoTrackRef.current) {
        localVideoTrackRef.current.stop();
        localVideoTrackRef.current.close();
        localVideoTrackRef.current = null;
      }
      if (clientRef.current) {
        await clientRef.current.leave();
      }
      setIsJoined(false);
      onLeave?.();
    } catch (e) {
      console.error('Leave error:', e);
    }
  };

  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="relative w-full h-full bg-slate-900 rounded-lg overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10">
          <div className="text-center text-white px-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-lg font-medium mb-2">Connecting to video call...</p>
            {connectionTimeout && (
              <div className="mt-4 text-sm text-yellow-400 max-w-md mx-auto bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4">
                <p className="font-semibold mb-2">⚠️ Connection is taking longer than usual.</p>
                <p className="mt-1 text-slate-300">Please wait or try retrying the connection.</p>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="absolute top-4 left-4 z-20 w-40 h-28 bg-black/50 rounded overflow-hidden">
        <div id="local-player" className="w-full h-full" />
      </div>
      <div className="absolute inset-0 grid grid-cols-1 md:grid-cols-2 gap-2 p-2">
        {remoteUsers.map((user) => (
          <div key={user.uid} className="relative bg-black rounded overflow-hidden">
            <div id={`remote-player-${user.uid}`} className="w-full h-full" />
            <div className="absolute bottom-1 left-1 text-xs text-white bg-black/40 px-2 py-1 rounded">
              User {user.uid}
            </div>
          </div>
        ))}
      </div>
      {showControls && isJoined && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20">
          <button
            onClick={handleLeave}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg transition-colors font-medium"
          >
            Leave Call
          </button>
        </div>
      )}
      {showControls && !isJoined && connectionTimeout && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20">
          <button
            onClick={handleRetry}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 rounded-lg transition-colors font-medium"
          >
            Retry Connection
          </button>
        </div>
      )}
    </div>
  );
}
