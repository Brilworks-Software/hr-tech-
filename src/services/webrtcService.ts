import { db } from '../lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  deleteDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';

interface SignalingData {
  type: 'offer' | 'answer' | 'ice-candidate';
  data: RTCSessionDescriptionInit | RTCIceCandidateInit | Record<string, unknown>;
  userId: string;
  timestamp: unknown;
}

/**
 * WebRTC Service using Firestore for signaling
 * This allows HR and candidate to see each other in video interviews
 */
// Cache for ICE server configuration
let cachedIceConfiguration: RTCConfiguration | null = null;
let iceConfigPromise: Promise<RTCConfiguration> | null = null;

/**
 * Get ICE server configuration from Cloud Function or use defaults
 */
async function getIceConfiguration(): Promise<RTCConfiguration> {
  // Return cached config if available
  if (cachedIceConfiguration) {
    return cachedIceConfiguration;
  }

  // Return existing promise if already fetching
  if (iceConfigPromise) {
    return iceConfigPromise;
  }

  // Fetch from Cloud Function
  iceConfigPromise = (async () => {
    try {
      const functions = getFunctions();
      const getWebRTCConfig = httpsCallable(functions, 'getWebRTCConfig');
      const result = await getWebRTCConfig();
      const config = result.data as RTCConfiguration;
      cachedIceConfiguration = config;
      console.log('Fetched ICE configuration from Cloud Function');
      return config;
    } catch (error) {
      console.warn('Failed to fetch ICE config from Cloud Function, using defaults:', error);
      // Fallback to default STUN servers
      const defaultConfig: RTCConfiguration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
        ],
        iceCandidatePoolSize: 10,
      };
      cachedIceConfiguration = defaultConfig;
      return defaultConfig;
    }
  })();

  return iceConfigPromise;
}

export const webrtcService = {
  /**
   * Create or get a peer connection for an interview
   */
  async createPeerConnection(
    interviewId: string,
    userId: string,
    onRemoteStream: (stream: MediaStream) => void,
    onConnectionStateChange?: (state: RTCPeerConnectionState) => void
  ): Promise<RTCPeerConnection> {
    // Get ICE configuration (with TURN servers if available)
    const configuration = await getIceConfiguration();

    const peerConnection = new RTCPeerConnection(configuration);
    
    // Keep track of all remote tracks in a single stream
    // Use a persistent stream that won't be recreated
    const remoteStream = new MediaStream();
    
    // Track which tracks we've already added to avoid duplicates
    const addedTrackIds = new Set<string>();

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      console.log('ontrack event fired:', event);
      console.log('Track kind:', event.track.kind);
      console.log('Track id:', event.track.id);
      console.log('Track enabled:', event.track.enabled);
      console.log('Track readyState:', event.track.readyState);
      console.log('Streams:', event.streams);
      
      // Ensure track is enabled
      event.track.enabled = true;
      
      // Add track to our combined remote stream (avoid duplicates)
      if (event.track && !addedTrackIds.has(event.track.id)) {
        console.log('Adding NEW track to remote stream:', event.track.kind, event.track.id);
        remoteStream.addTrack(event.track);
        addedTrackIds.add(event.track.id);
        
        // Notify about the updated stream (with all tracks)
        console.log('Remote stream now has', remoteStream.getTracks().length, 'tracks');
        console.log('Video tracks:', remoteStream.getVideoTracks().length);
        console.log('Audio tracks:', remoteStream.getAudioTracks().length);
        
        // Always pass the same stream reference to ensure React detects updates
        onRemoteStream(remoteStream);
      } else if (event.track && addedTrackIds.has(event.track.id)) {
        console.log('Track already added, skipping:', event.track.id);
        // Still notify to ensure stream is updated
        onRemoteStream(remoteStream);
      }
      
      // Handle track events
      event.track.onended = () => {
        console.log('Remote track ended:', event.track.kind, event.track.id);
        addedTrackIds.delete(event.track.id);
        remoteStream.removeTrack(event.track);
        onRemoteStream(remoteStream);
      };
      
      event.track.onmute = () => {
        console.log('Remote track muted:', event.track.kind, event.track.id);
        // Re-enable track if it gets muted
        event.track.enabled = true;
      };
      
      event.track.onunmute = () => {
        console.log('Remote track unmuted:', event.track.kind, event.track.id);
        event.track.enabled = true;
      };
    };

    // Handle connection state changes
    if (onConnectionStateChange) {
      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState as RTCPeerConnectionState;
        onConnectionStateChange(state);
        
        // If connection fails, try to recover by restarting ICE
        if (state === 'failed' || state === 'disconnected') {
          console.log('Connection state:', state, '- attempting ICE restart...');
          try {
            peerConnection.restartIce();
            console.log('ICE restart initiated from connection state change');
          } catch (error) {
            console.error('Error restarting ICE from connection state change:', error);
          }
        }
      };
    }

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('ICE candidate generated:', event.candidate.candidate.substring(0, 50) + '...');
        const signalingDoc = doc(
          collection(db, 'interviews', interviewId, 'signaling'),
          `${userId}_ice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        );
        // Convert RTCIceCandidate to plain object for Firestore
        const candidateData = {
          candidate: event.candidate.candidate,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          sdpMid: event.candidate.sdpMid,
        };
        setDoc(
          signalingDoc,
          {
            type: 'ice-candidate',
            data: candidateData,
            userId,
            timestamp: serverTimestamp(),
          },
          { merge: true }
        ).catch((error) => {
          console.error('Error sending ICE candidate:', error);
        });
      } else {
        console.log('ICE candidate gathering completed');
      }
    };

    // Handle ICE connection state changes
    let iceRestartAttempts = 0;
    const MAX_ICE_RESTART_ATTEMPTS = 3;
    
    peerConnection.oniceconnectionstatechange = () => {
      const iceState = peerConnection.iceConnectionState;
      console.log('ICE connection state:', iceState);
      
      if (iceState === 'failed' && iceRestartAttempts < MAX_ICE_RESTART_ATTEMPTS) {
        console.log('ICE connection failed, attempting restart (attempt', iceRestartAttempts + 1, ')...');
        iceRestartAttempts++;
        try {
          peerConnection.restartIce();
          console.log('ICE restart initiated');
        } catch (error) {
          console.error('Error restarting ICE:', error);
        }
      } else if (iceState === 'disconnected') {
        // Wait a bit before restarting on disconnected state
        // Sometimes it's just a temporary network issue
        setTimeout(() => {
          if (peerConnection.iceConnectionState === 'disconnected' && 
              iceRestartAttempts < MAX_ICE_RESTART_ATTEMPTS) {
            console.log('ICE still disconnected after delay, attempting restart...');
            iceRestartAttempts++;
            try {
              peerConnection.restartIce();
              console.log('ICE restart initiated for disconnected state');
            } catch (error) {
              console.error('Error restarting ICE:', error);
            }
          }
        }, 2000); // Wait 2 seconds before restarting
      } else if (iceState === 'connected' || iceState === 'completed') {
        // Reset restart attempts on successful connection
        iceRestartAttempts = 0;
        console.log('ICE connection established:', iceState);
      }
    };

    // Handle ICE gathering state changes
    peerConnection.onicegatheringstatechange = () => {
      console.log('ICE gathering state:', peerConnection.iceGatheringState);
    };

    return peerConnection;
  },

  /**
   * Listen for signaling messages (offers, answers, ICE candidates)
   */
  listenForSignaling(
    interviewId: string,
    userId: string,
    peerConnection: RTCPeerConnection,
    localStream: MediaStream,
    onError?: (error: Error) => void
  ): () => void {
    const signalingRef = collection(db, 'interviews', interviewId, 'signaling');

    const unsubscribe = onSnapshot(
      signalingRef,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            const data = change.doc.data() as SignalingData;

            // Don't process our own messages
            if (data.userId === userId) return;

            try {
              switch (data.type) {
                case 'offer':
                  // Only process offer if we don't have a remote description yet
                  // Allow processing even if signaling state is not 'stable' (might be 'have-local-offer')
                  if (!peerConnection.remoteDescription) {
                    console.log('Received offer from', data.userId, 'Current signaling state:', peerConnection.signalingState);
                    
                    // First, make sure our local tracks are added to the peer connection
                    const existingSenders = peerConnection.getSenders();
                    if (existingSenders.length === 0) {
                      console.log('Adding local tracks to peer connection');
                      localStream.getTracks().forEach((track) => {
                        peerConnection.addTrack(track, localStream);
                        console.log('Added track:', track.kind, track.id);
                      });
                    }

                    // Convert plain object back to RTCSessionDescriptionInit
                    const offerDataRaw = data.data as Record<string, unknown>;
                    if (!offerDataRaw.sdp || typeof offerDataRaw.sdp !== 'string') {
                      console.error('Invalid offer data:', offerDataRaw);
                      break;
                    }
                    
                    const sessionDescription: RTCSessionDescriptionInit = {
                      type: offerDataRaw.type as RTCSdpType,
                      sdp: offerDataRaw.sdp as string,
                    };
                    
                    console.log('Setting remote description (offer)');
                    peerConnection.setRemoteDescription(new RTCSessionDescription(sessionDescription))
                      .then(async () => {
                        console.log('Remote description (offer) set successfully');
                        console.log('Remote description set, verifying local tracks...');
                      
                      // Double-check that local tracks are added
                      const senders = peerConnection.getSenders();
                      console.log('Current senders count:', senders.length);
                      if (senders.length === 0) {
                        console.log('No senders found, adding local tracks again');
                        localStream.getTracks().forEach((track) => {
                          peerConnection.addTrack(track, localStream);
                          console.log('Added track:', track.kind, track.id);
                        });
                        // Wait a moment for tracks to be added
                        await new Promise(resolve => setTimeout(resolve, 100));
                      }
                      
                      console.log('Creating answer');
                      return peerConnection.createAnswer();
                    }).then((answer) => {
                      console.log('Answer created, SDP length:', answer.sdp?.length || 0);
                      console.log('Setting local description (answer)');
                      return peerConnection.setLocalDescription(answer);
                    }).then(() => {
                      // Send answer
                      const answerDoc = doc(signalingRef, `${userId}_answer`);
                      // Convert RTCSessionDescription to plain object for Firestore
                      const answerData = peerConnection.localDescription ? {
                        type: peerConnection.localDescription.type,
                        sdp: peerConnection.localDescription.sdp,
                      } : null;
                      if (answerData) {
                        console.log('Sending answer to', userId);
                        setDoc(
                          answerDoc,
                          {
                            type: 'answer',
                            data: answerData,
                            userId,
                            timestamp: serverTimestamp(),
                          },
                          { merge: true }
                        );
                      } else {
                        console.error('No local description available to send as answer');
                      }
                    }).catch((error) => {
                      console.error('Error handling offer:', error);
                      if (onError) onError(error);
                    });
                  } else {
                    console.log('Already have remote description, ignoring offer from', data.userId);
                  }
                  break;

                case 'answer': {
                  // Only process answer if we're in the correct state (have-local-offer)
                  // and don't already have a remote description
                  const currentSignalingState = peerConnection.signalingState;
                  const hasRemoteDesc = !!peerConnection.remoteDescription;
                  
                  if (!hasRemoteDesc && currentSignalingState === 'have-local-offer') {
                    console.log('Received answer from', data.userId, 'Current signaling state:', currentSignalingState);
                    // Convert plain object back to RTCSessionDescriptionInit
                    const answerDataRaw = data.data as Record<string, unknown>;
                    if (!answerDataRaw.sdp || typeof answerDataRaw.sdp !== 'string') {
                      console.error('Invalid answer data:', answerDataRaw);
                      break;
                    }
                    const sessionDescription: RTCSessionDescriptionInit = {
                      type: answerDataRaw.type as RTCSdpType,
                      sdp: answerDataRaw.sdp as string,
                    };
                    console.log('Setting remote description (answer)');
                    peerConnection.setRemoteDescription(new RTCSessionDescription(sessionDescription))
                      .then(() => {
                        console.log('Remote description (answer) set successfully');
                        // After setting remote description, process any queued ICE candidates
                        console.log('Remote description set, ready to process ICE candidates');
                      })
                      .catch((error) => {
                        console.error('Error handling answer:', error);
                        // Log the current state for debugging
                        console.error('Current signaling state when error occurred:', peerConnection.signalingState);
                        console.error('Has remote description:', !!peerConnection.remoteDescription);
                        console.error('Has local description:', !!peerConnection.localDescription);
                        if (onError) onError(error);
                      });
                  } else {
                    if (hasRemoteDesc) {
                      console.log('Already have remote description, ignoring answer from', data.userId);
                    } else {
                      console.log('Received answer but not in correct state. Current state:', currentSignalingState, 'Expected: have-local-offer');
                      console.log('Has local description:', !!peerConnection.localDescription);
                      console.log('Has remote description:', hasRemoteDesc);
                    }
                  }
                  break;
                }

                case 'ice-candidate':
                  // Only add ICE candidate if connection is not closed
                  // Allow adding candidates even in 'disconnected' or 'failed' states as they might help recover
                  if (peerConnection.connectionState !== 'closed' && 
                      peerConnection.iceConnectionState !== 'closed' &&
                      data.data) {
                    // Convert plain object back to RTCIceCandidateInit
                    const iceDataRaw = data.data as Record<string, unknown>;
                    const iceCandidate: RTCIceCandidateInit = {
                      candidate: iceDataRaw.candidate as string,
                      sdpMLineIndex: iceDataRaw.sdpMLineIndex as number | null,
                      sdpMid: iceDataRaw.sdpMid as string | null,
                    };
                    console.log('Adding ICE candidate from', data.userId);
                    
                    // Add ICE candidate - WebRTC will queue them if remote description isn't set yet
                    peerConnection.addIceCandidate(new RTCIceCandidate(iceCandidate))
                      .then(() => {
                        console.log('ICE candidate added successfully');
                      })
                      .catch((error) => {
                        // Some errors are expected (duplicates, invalid state, etc.)
                        if (error.name === 'OperationError' || error.name === 'InvalidStateError') {
                          console.log('ICE candidate error (expected):', error.name);
                        } else {
                          console.error('Error adding ICE candidate:', error);
                        }
                      });
                  }
                  break;
              }
            } catch (error) {
              console.error('Error processing signaling message:', error);
              if (onError) onError(error as Error);
            }
          }
        });
      },
      (error) => {
        console.error('Error listening for signaling:', error);
        if (onError) onError(error as Error);
      }
    );

    return unsubscribe;
  },

  /**
   * Create and send an offer
   */
  async createOffer(
    interviewId: string,
    userId: string,
    peerConnection: RTCPeerConnection,
    localStream: MediaStream
  ): Promise<void> {
    // Check if we already have a remote description (someone else created an offer)
    if (peerConnection.remoteDescription) {
      console.log('Already have remote description, skipping offer creation');
      return;
    }

    // Check if tracks are already added
    const existingSenders = peerConnection.getSenders();
    const hasVideoTrack = existingSenders.some(sender => sender.track?.kind === 'video');
    const hasAudioTrack = existingSenders.some(sender => sender.track?.kind === 'audio');
    
    // Add local stream tracks to peer connection if not already added
    console.log('Checking local tracks before creating offer');
    console.log('Existing senders:', existingSenders.length);
    console.log('Has video:', hasVideoTrack, 'Has audio:', hasAudioTrack);
    
    if (!hasVideoTrack || !hasAudioTrack) {
      console.log('Adding local tracks to peer connection');
      localStream.getTracks().forEach((track) => {
        // Check if track is already added
        const trackExists = existingSenders.some(sender => sender.track?.id === track.id);
        if (!trackExists) {
          peerConnection.addTrack(track, localStream);
          console.log('Added track:', track.kind, track.id, 'enabled:', track.enabled, 'readyState:', track.readyState);
        } else {
          console.log('Track already added:', track.kind, track.id);
        }
      });
    }

    // Wait a moment for tracks to be added
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify tracks are added
    const sendersAfter = peerConnection.getSenders();
    console.log('Senders after adding tracks:', sendersAfter.length);
    sendersAfter.forEach(sender => {
      console.log('Sender track:', sender.track?.kind, sender.track?.id, 'enabled:', sender.track?.enabled);
    });

    // Create offer
    console.log('Creating offer');
    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });

    console.log('Offer created, SDP length:', offer.sdp?.length || 0);
    console.log('Setting local description (offer)');
    await peerConnection.setLocalDescription(offer);

    // Send offer to Firestore
    const offerDoc = doc(
      collection(db, 'interviews', interviewId, 'signaling'),
      `${userId}_offer`
    );
    // Convert RTCSessionDescription to plain object for Firestore
    const offerData = {
      type: offer.type,
      sdp: offer.sdp || '',
    };
    console.log('Sending offer to Firestore, userId:', userId);
    await setDoc(
      offerDoc,
      {
        type: 'offer',
        data: offerData,
        userId,
        timestamp: serverTimestamp(),
      },
      { merge: true }
    );
    console.log('Offer sent successfully');
  },

  /**
   * Clean up signaling data when leaving
   */
  async cleanupSignaling(interviewId: string, userId: string): Promise<void> {
    const signalingRef = collection(db, 'interviews', interviewId, 'signaling');
    
    try {
      // Get all signaling documents for this user
      const q = query(signalingRef, where('userId', '==', userId));
      const snapshot = await getDocs(q);
      
      // Delete all documents for this user
      const deletePromises = snapshot.docs.map((doc) =>
        deleteDoc(doc.ref).catch(() => {
          // Ignore errors if document doesn't exist
        })
      );
      
      await Promise.all(deletePromises);
      console.log(`Cleaned up ${snapshot.docs.length} signaling documents for user ${userId}`);
    } catch (error) {
      console.error('Error cleaning up signaling:', error);
    }
  },

  /**
   * Clear all signaling data for an interview (used when both parties need to reconnect)
   */
  async clearAllSignaling(interviewId: string): Promise<void> {
    const signalingRef = collection(db, 'interviews', interviewId, 'signaling');
    
    try {
      // Get all signaling documents
      const snapshot = await getDocs(signalingRef);
      
      // Delete all documents
      const deletePromises = snapshot.docs.map((doc) =>
        deleteDoc(doc.ref).catch(() => {
          // Ignore errors if document doesn't exist
        })
      );
      
      await Promise.all(deletePromises);
      console.log(`Cleared all ${snapshot.docs.length} signaling documents for interview ${interviewId}`);
    } catch (error) {
      console.error('Error clearing all signaling:', error);
    }
  },
};

