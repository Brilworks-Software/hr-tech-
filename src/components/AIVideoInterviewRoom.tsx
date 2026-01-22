import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';
import { 
  Mic,
  Loader2,
  AlertCircle,
  Volume2,
  Bot,
  User,
  Play,
  Square,
  Settings
} from 'lucide-react';
import { aiVideoInterviewService, AIVideoInterviewData } from '../services/aiVideoInterviewService';
import { useToast } from '../contexts/ToastContext';
import { useCheatingDetection } from '../hooks/useCheatingDetection';

export default function AIVideoInterviewRoom() {
  const { interviewId } = useParams<{ interviewId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { startDetection, stopDetection } = useCheatingDetection();

  const [interviewData, setInterviewData] = useState<AIVideoInterviewData | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<string>('');
  
  // Video/Audio states
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  
  // Device selection states
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [selectedMicrophone, setSelectedMicrophone] = useState<string>('');
  const [showDeviceSettings, setShowDeviceSettings] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localVideoRef = useRef<HTMLDivElement>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const micTestIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const savedTranscriptRef = useRef<string>(''); // Store accumulated transcript for current question
  const localVideoTrackRef = useRef<ICameraVideoTrack | null>(null);
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);

  // Initialize camera preview and enumerate devices on component mount
  useEffect(() => {
    const initializePreview = async () => {
      try {
        // Enumerate devices
        await loadDevices();
        
        const videoTrack = await AgoraRTC.createCameraVideoTrack();
        setLocalVideoTrack(videoTrack);
        localVideoTrackRef.current = videoTrack;
        setSelectedCamera(videoTrack.getTrackId());
        
        if (localVideoRef.current) {
          videoTrack.play(localVideoRef.current);
        }
      } catch (error) {
        console.error('Error initializing camera preview:', error);
        showToast('Unable to access camera', 'error');
      }
    };

    initializePreview();

    return () => {
      // Cleanup on component unmount
      stopDetection();
      
      // Stop speech synthesis if speaking
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
      
      // Stop speech recognition
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          console.error('Error stopping recognition:', error);
        }
      }
      
      if (localVideoTrackRef.current) {
        localVideoTrackRef.current.close();
        localVideoTrackRef.current = null;
      }
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.close();
        localAudioTrackRef.current = null;
      }
      if (micTestIntervalRef.current) {
        clearInterval(micTestIntervalRef.current);
      }
      if (clientRef.current) {
        clientRef.current.leave();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start cheating detection when video track is ready and interview has joined
  useEffect(() => {
    if (!localVideoTrack || !hasJoined || !interviewId || !videoElementRef.current) {
      return;
    }

    const videoElement = videoElementRef.current;

    try {
      const mediaStreamTrack = localVideoTrack.getMediaStreamTrack();
      const mediaStream = new MediaStream([mediaStreamTrack]);
      videoElement.srcObject = mediaStream;
      videoElement.play();

      // Wait for video to be ready
      const startWhenReady = () => {
        if (videoElement.readyState >= 2) {
          console.log('✅ Starting cheating detection for AI interview');
          startDetection(videoElement, interviewId);
        } else {
          setTimeout(startWhenReady, 100);
        }
      };
      startWhenReady();
    } catch (error) {
      console.error('❌ Error setting up cheating detection:', error);
    }

    return () => {
      if (videoElement) {
        videoElement.srcObject = null;
      }
    };
  }, [localVideoTrack, hasJoined, interviewId, startDetection]);

  // Detect tab/window changes during AI interview
  useEffect(() => {
    if (!interviewId || !hasJoined) return;

    const handleVisibilityChange = async () => {
      if (document.hidden) {
        console.log('⚠️ Tab switched away - logging cheating alert');
        
        // Log to Firestore
        try {
          const { addDoc, collection, Timestamp } = await import('firebase/firestore');
          const { db } = await import('../lib/firebase');
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
            const { db } = await import('../lib/firebase');
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
  }, [interviewId, hasJoined, showToast]);

  useEffect(() => {
    if (!interviewId) return;

    // Subscribe to interview updates
    const unsubscribe = aiVideoInterviewService.subscribeToAIInterview(
      interviewId,
      (data) => {
        setInterviewData(data);
        if (data) {
          setCurrentQuestionIndex(data.currentQuestionIndex || 0);
        }
      }
    );

    return () => unsubscribe();
  }, [interviewId]);

  // Auto-speak question when question index changes (after answer is recorded)
  useEffect(() => {
    // Reset transcript and saved transcript when moving to a new question
    setTranscript('');
    savedTranscriptRef.current = '';
    
    if (hasJoined && interviewData && interviewData.status === 'in_progress' && !isSpeaking) {
      const currentQ = interviewData.questions[currentQuestionIndex];
      if (currentQ && currentQ.text && currentQuestionIndex > 0) {
        // Only auto-speak for questions after the first one (first is spoken manually on join)
        console.log(`Auto-speaking question ${currentQuestionIndex + 1} of ${interviewData.questions.length}`);
        setTimeout(() => {
          speakQuestion(currentQ.text);
        }, 1000);
      } else if (currentQuestionIndex >= interviewData.questions.length) {
        // All questions completed
        console.log('All questions completed, finishing interview');
        completeInterview();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestionIndex]);

  // Load available cameras and microphones
  const loadDevices = async () => {
    try {
      const devices = await AgoraRTC.getDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      const audioDevices = devices.filter(d => d.kind === 'audioinput');
      
      setCameras(videoDevices);
      setMicrophones(audioDevices);
      
      if (videoDevices.length > 0 && !selectedCamera) {
        setSelectedCamera(videoDevices[0].deviceId);
      }
      if (audioDevices.length > 0 && !selectedMicrophone) {
        setSelectedMicrophone(audioDevices[0].deviceId);
      }
    } catch (error) {
      console.error('Error loading devices:', error);
    }
  };

  // Change camera
  const changeCamera = async (deviceId: string) => {
    try {
      if (localVideoTrack) {
        await localVideoTrack.setDevice(deviceId);
        setSelectedCamera(deviceId);
        showToast('Camera changed successfully', 'success');
      }
    } catch (error) {
      console.error('Error changing camera:', error);
      showToast('Failed to change camera', 'error');
    }
  };

  // Change microphone
  const changeMicrophone = async (deviceId: string) => {
    try {
      setSelectedMicrophone(deviceId);
      
      // If audio track exists, recreate it with new device
      if (localAudioTrack) {
        await localAudioTrack.close();
        const newAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({ microphoneId: deviceId });
        setLocalAudioTrack(newAudioTrack);
        localAudioTrackRef.current = newAudioTrack;
        
        // If already in call, publish the new track
        if (hasJoined && clientRef.current) {
          await clientRef.current.publish([newAudioTrack]);
        }
      }
      
      showToast('Microphone changed successfully', 'success');
    } catch (error) {
      console.error('Error changing microphone:', error);
      showToast('Failed to change microphone', 'error');
    }
  };

  // Test microphone
  const testMicrophone = async () => {
    if (isTesting) {
      // Stop testing
      setIsTesting(false);
      if (micTestIntervalRef.current) {
        clearInterval(micTestIntervalRef.current);
        micTestIntervalRef.current = null;
      }
      setMicLevel(0);
      return;
    }

    try {
      setIsTesting(true);
      
      // Create audio track for testing if not exists
      let audioTrack = localAudioTrack;
      if (!audioTrack) {
        audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
          microphoneId: selectedMicrophone || undefined
        });
        setLocalAudioTrack(audioTrack);
        localAudioTrackRef.current = audioTrack;
      }

      // Monitor audio level
      micTestIntervalRef.current = setInterval(() => {
        const level = audioTrack!.getVolumeLevel();
        setMicLevel(Math.min(level * 100, 100));
      }, 100);

      showToast('Speak to test your microphone', 'info');
    } catch (error) {
      console.error('Error testing microphone:', error);
      showToast('Failed to test microphone', 'error');
      setIsTesting(false);
    }
  };

  const initializeAgora = async () => {
    try {
      setIsJoining(true);

      // Stop microphone test if running
      if (isTesting && micTestIntervalRef.current) {
        clearInterval(micTestIntervalRef.current);
        micTestIntervalRef.current = null;
        setIsTesting(false);
        setMicLevel(0);
      }

      // Initialize interview session
      const sessionData = await aiVideoInterviewService.initializeInterview(interviewId!);
      
      // Create Agora client
      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      clientRef.current = client;

      // Join channel
      await client.join(
        sessionData.agoraAppId,
        sessionData.channelName,
        sessionData.candidateToken,
        sessionData.candidateUid
      );

      // Create audio track with selected microphone and reuse video track if already created for preview
      let audioTrack = localAudioTrack;
      if (!audioTrack) {
        audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
          microphoneId: selectedMicrophone || undefined
        });
        setLocalAudioTrack(audioTrack);
        localAudioTrackRef.current = audioTrack;
      }
      
      let videoTrack = localVideoTrack;
      if (!videoTrack) {
        videoTrack = await AgoraRTC.createCameraVideoTrack({
          cameraId: selectedCamera || undefined
        });
        setLocalVideoTrack(videoTrack);
        localVideoTrackRef.current = videoTrack;
        
        if (localVideoRef.current) {
          videoTrack.play(localVideoRef.current);
        }
      }

      // Publish tracks
      await client.publish([audioTrack, videoTrack]);

      setHasJoined(true);
      
      // Start interview
      await aiVideoInterviewService.startInterview(interviewId!);
      
      // Initialize speech recognition
      initializeSpeechRecognition();

      // Check if questions are available from sessionData
      if (sessionData.questions && sessionData.questions.length > 0 && sessionData.questions[0].text) {
        // Start first question
        speakQuestion(sessionData.questions[0].text);
      } else {
        console.warn('No questions available in session data');
        showToast('Interview started, waiting for questions...', 'info');
      }
      
      showToast('Joined AI interview successfully', 'success');
    } catch (error) {
      console.error('Error joining interview:', error);
      showToast('Failed to join interview', 'error');
    } finally {
      setIsJoining(false);
    }
  };

  const initializeSpeechRecognition = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
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

        // Append new speech to saved transcript, don't replace it
        if (finalTranscript) {
          savedTranscriptRef.current += finalTranscript;
        }
        const displayTranscript = savedTranscriptRef.current + interimTranscript;
        setTranscript(displayTranscript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        
        // Reset recording state on error
        if (event.error === 'no-speech' || event.error === 'aborted') {
          setIsRecording(false);
        }
        
        // Auto-restart on certain errors
        if (event.error === 'network') {
          showToast('Network error in speech recognition', 'error');
          setIsRecording(false);
        }
      };

      recognition.onend = () => {
        // Recognition stopped automatically (e.g., after silence timeout)
        console.log('Speech recognition ended');
        
        // If recording is still active, restart recognition to continue listening
        if (isRecording && recognitionRef.current) {
          console.log('Auto-restarting speech recognition...');
          try {
            recognitionRef.current.start();
          } catch (error) {
            console.error('Error restarting recognition:', error);
          }
        }
      };

      recognitionRef.current = recognition;
    }
  };

  const speakQuestion = (text: string) => {
    if ('speechSynthesis' in window) {
      setIsSpeaking(true);
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;
      
      utterance.onend = () => {
        setIsSpeaking(false);
        // Start recording after AI finishes speaking (only if not already recording)
        if (!isRecording) {
          startRecording();
        }
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
      };

      window.speechSynthesis.speak(utterance);
    }
  };

  const startRecording = () => {
    if (isRecording) {
      console.warn('Recording already in progress');
      return;
    }
    
    setIsRecording(true);
    // Don't clear transcript - we want to append to existing answer
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        setIsRecording(false);
      }
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
      }
    }

    if (transcript.trim()) {
      try {
        // Save answer - this will update currentQuestionIndex in Firestore
        await aiVideoInterviewService.recordAnswer(
          interviewId!,
          currentQuestionIndex,
          transcript
        );

        // Check if interview is complete
        const nextIndex = currentQuestionIndex + 1;
        if (interviewData && nextIndex >= interviewData.questions.length) {
          await completeInterview();
        }
        // Note: Next question will be spoken automatically by useEffect when currentQuestionIndex updates
      } catch (error) {
        console.error('Error saving answer:', error);
        showToast('Failed to save answer', 'error');
      }
    } else {
      showToast('Please provide an answer', 'warning');
    }
  };

  const completeInterview = async () => {
    try {
      // Stop everything immediately
      stopDetection();
      setIsRecording(false);
      
      // Stop speech synthesis if speaking
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
      
      // Stop speech recognition
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          console.error('Error stopping recognition:', error);
        }
      }
      
      // Stop local tracks immediately
      if (localVideoTrackRef.current) {
        localVideoTrackRef.current.close();
        localVideoTrackRef.current = null;
      }
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.close();
        localAudioTrackRef.current = null;
      }
      
      // Leave channel
      if (clientRef.current) {
        await clientRef.current.leave();
      }
      
      await aiVideoInterviewService.completeInterview(interviewId!);
      showToast('Interview completed! Generating evaluation...', 'success');
      
      // Generate evaluation
      setTimeout(async () => {
        await aiVideoInterviewService.generateEvaluation(interviewId!);
        showToast('Evaluation generated successfully', 'success');
      }, 2000);

      // Navigate away
      setTimeout(() => {
        navigate('/');
      }, 3000);
    } catch (error) {
      console.error('Error completing interview:', error);
      showToast('Failed to complete interview', 'error');
    }
  };

  const handleLeave = async () => {
    try {
      stopDetection();
      setIsRecording(false);
      
      // Stop speech synthesis if speaking
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
      
      // Stop speech recognition
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          console.error('Error stopping recognition:', error);
        }
      }
      
      await aiVideoInterviewService.cancelInterview(interviewId!);
      
      if (clientRef.current) {
        await clientRef.current.leave();
      }
      
      if (localVideoTrackRef.current) {
        localVideoTrackRef.current.close();
        localVideoTrackRef.current = null;
      }
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.close();
        localAudioTrackRef.current = null;
      }

      navigate('/');
    } catch (error) {
      console.error('Error leaving interview:', error);
    }
  };

  const getCurrentQuestion = () => {
    if (!interviewData || !interviewData.questions[currentQuestionIndex]) {
      return null;
    }
    return interviewData.questions[currentQuestionIndex];
  };

  const currentQuestion = getCurrentQuestion();

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-blue-500 rounded-lg flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-white font-semibold text-lg">AI Video Interview</h1>
              <p className="text-sm text-slate-400">{interviewData?.jobTitle || 'Loading...'}</p>
            </div>
          </div>
          {hasJoined && (
            <div className="flex items-center space-x-2 px-4 py-2 bg-slate-700 rounded-lg">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-white text-sm font-medium">Live Interview</span>
            </div>
          )}
        </div>
      </div>

      {!hasJoined ? (
        /* Pre-join Screen */
        <div className="flex-1 flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 to-slate-800">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl max-w-2xl w-full p-8">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bot className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">AI Video Interview</h2>
              <p className="text-slate-300">
                You'll be interviewed by our AI assistant via video call
              </p>
            </div>

            {/* Local video preview */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden mb-6 aspect-video">
              <div ref={localVideoRef} className="w-full h-full" />
            </div>

            <div className="space-y-4 mb-6">
              {/* Device Settings */}
              <div className="border border-slate-600 rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowDeviceSettings(!showDeviceSettings)}
                  className="w-full px-4 py-3 bg-slate-700 hover:bg-slate-600 flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <Settings className="w-5 h-5 text-slate-300" />
                    <span className="font-semibold text-white">Device Settings</span>
                  </div>
                  <span className="text-slate-400 text-sm">
                    {showDeviceSettings ? '▼' : '▶'}
                  </span>
                </button>
                
                {showDeviceSettings && (
                  <div className="p-4 space-y-4 bg-slate-750">
                    {/* Camera Selection */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-2">
                        Camera
                      </label>
                      <select
                        value={selectedCamera}
                        onChange={(e) => changeCamera(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {cameras.map((camera) => (
                          <option key={camera.deviceId} value={camera.deviceId}>
                            {camera.label || `Camera ${camera.deviceId.slice(0, 8)}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Microphone Selection */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-2">
                        Microphone
                      </label>
                      <select
                        value={selectedMicrophone}
                        onChange={(e) => changeMicrophone(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {microphones.map((mic) => (
                          <option key={mic.deviceId} value={mic.deviceId}>
                            {mic.label || `Microphone ${mic.deviceId.slice(0, 8)}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Microphone Test */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-semibold text-slate-300">
                          Microphone Test
                        </label>
                        <button
                          onClick={testMicrophone}
                          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            isTesting
                              ? 'bg-red-600 text-white hover:bg-red-700'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          {isTesting ? 'Stop Test' : 'Test Mic'}
                        </button>
                      </div>
                      
                      {isTesting && (
                        <div className="space-y-2">
                          <div className="w-full bg-slate-600 rounded-full h-4 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-blue-500 to-blue-400 h-full transition-all duration-100"
                              style={{ width: `${micLevel}%` }}
                            />
                          </div>
                          <p className="text-xs text-slate-400 text-center">
                            Speak to see the microphone level
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-start space-x-3 p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
                <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-slate-200">
                  <p className="font-semibold mb-2 text-white">Interview Guidelines:</p>
                  <ul className="space-y-1.5">
                    <li>• Ensure your camera and microphone are working</li>
                    <li>• Be in a well-lit, quiet environment</li>
                    <li>• Listen to each question carefully before answering</li>
                    <li>• Speak clearly when recording your answer</li>
                    <li className="text-blue-300 font-semibold">• Click "Stop Recording" button when you finish answering</li>
                  </ul>
                </div>
              </div>
            </div>

            <button
              onClick={initializeAgora}
              disabled={isJoining}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-semibold text-lg hover:from-blue-700 hover:to-blue-600 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed transition-all shadow-lg flex items-center justify-center space-x-3"
            >
              {isJoining ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Joining Interview...</span>
                </>
              ) : (
                <>
                  <Play className="w-6 h-6" />
                  <span>Start Interview</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* Interview Screen */
        <div className="flex-1 flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full">
          {/* Videos Section - Horizontal Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* AI Avatar / Visual */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-500 rounded-xl overflow-hidden aspect-video flex items-center justify-center relative border border-blue-400/30">
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>
              <div className="relative z-10 text-center">
                <Bot className="w-20 h-20 text-white/90 mx-auto mb-3 animate-pulse" />
                <p className="text-white text-lg font-semibold">AI Interviewer</p>
                {isSpeaking && (
                  <div className="mt-3 px-4">
                    <div className="inline-flex items-center space-x-2 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5">
                      <Volume2 className="w-4 h-4 text-white animate-pulse" />
                      <span className="text-white text-xs font-medium">Speaking...</span>
                    </div>
                  </div>
                )}
                {isRecording && (
                  <div className="mt-3 px-4">
                    <div className="inline-flex items-center space-x-2 bg-green-500/30 backdrop-blur-sm rounded-full px-3 py-1.5">
                      <Mic className="w-4 h-4 text-white animate-pulse" />
                      <span className="text-white text-xs font-medium">Listening...</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Candidate Video */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden aspect-video relative">
              <div ref={localVideoRef} className="w-full h-full" />
              {/* Hidden video element for cheating detection */}
              <video 
                ref={videoElementRef} 
                style={{ display: 'none' }} 
                autoPlay 
                playsInline 
                muted
              />
              <div className="absolute top-4 left-4 flex items-center space-x-2 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2">
                <User className="w-4 h-4 text-white" />
                <span className="text-white text-sm font-medium">You</span>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Question & Transcript */}
            <div className="lg:col-span-2 space-y-4">
              {/* Current Question */}
              {currentQuestion && (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-blue-400 uppercase tracking-wide">
                      {currentQuestion.category}
                    </span>
                    <div className="flex items-center space-x-2 text-xs text-slate-400">
                      <span>Question {currentQuestionIndex + 1} of {interviewData?.questions.length}</span>
                    </div>
                  </div>
                  <p className="text-white text-lg font-medium leading-relaxed mb-4">
                    {currentQuestion.text}
                  </p>
                  <div className="flex items-start space-x-2 p-3 bg-blue-900/30 border border-blue-700/50 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-blue-300">
                      <span className="font-semibold">Remember:</span> Click the "Stop Recording" button below when you finish answering this question.
                    </p>
                  </div>
                </div>
              )}

              {/* Live Transcript */}
              {isRecording && transcript && (
                <div className="bg-slate-800 border border-green-500/50 rounded-xl p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-white text-sm font-semibold">Recording Your Answer...</span>
                  </div>
                  <p className="text-slate-200 text-sm leading-relaxed">
                    {transcript}
                  </p>
                </div>
              )}

              {/* Controls */}
              <div className="flex flex-col items-center space-y-4">
                {/* Main Recording Button */}
                <div className="w-full">
                  {isRecording ? (
                    <div className="space-y-3">
                      <button
                        onClick={stopRecording}
                        className="w-full px-8 py-5 bg-red-600 hover:bg-red-700 rounded-xl text-white font-bold text-lg flex items-center justify-center space-x-3 transition-all shadow-lg hover:shadow-xl"
                      >
                        <Square className="w-6 h-6" />
                        <span>Stop Recording</span>
                      </button>
                      <p className="text-center text-sm text-slate-300">
                        Click "Stop Recording" when you finish answering
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={startRecording}
                      disabled={isSpeaking}
                      className={`w-full px-8 py-5 rounded-xl text-white font-bold text-lg flex items-center justify-center space-x-3 transition-all shadow-lg ${
                        isSpeaking 
                          ? 'bg-slate-600 cursor-not-allowed' 
                          : 'bg-green-600 hover:bg-green-700 hover:shadow-xl'
                      }`}
                    >
                      <Mic className="w-6 h-6" />
                      <span>{isSpeaking ? 'AI Speaking...' : 'Start Recording Answer'}</span>
                    </button>
                  )}
                </div>
                
                {/* Secondary Controls */}
                <div className="flex items-center justify-center space-x-3">
                  <button
                    onClick={handleLeave}
                    className="px-5 py-3 bg-red-600 hover:bg-red-700 rounded-lg text-white font-semibold transition-colors text-sm"
                  >
                    End Interview
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column - Progress Only */}
            <div className="space-y-4">
              {/* Progress */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-white mb-3">Interview Progress</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Questions Answered</span>
                    <span className="font-bold text-blue-400">
                      {currentQuestionIndex} / {interviewData?.questions.length || 0}
                    </span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-blue-600 to-blue-400 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${(currentQuestionIndex / (interviewData?.questions.length || 1)) * 100}%` }}
                    />
                  </div>
                  <div className="text-center">
                    <span className="text-2xl font-bold text-white">
                      {Math.round((currentQuestionIndex / (interviewData?.questions.length || 1)) * 100)}%
                    </span>
                    <p className="text-xs text-slate-400 mt-1">Complete</p>
                  </div>
                </div>
              </div>

              {/* Interview Tips */}
              <div className="bg-gradient-to-br from-blue-900/40 to-blue-800/40 border border-blue-700/50 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-blue-400" />
                  <span>Interview Tips</span>
                </h3>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li className="flex items-start space-x-2">
                    <span className="text-blue-400 mt-0.5">•</span>
                    <span>Listen carefully to each question</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-blue-400 mt-0.5">•</span>
                    <span>Speak clearly and confidently</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-blue-400 mt-0.5">•</span>
                    <span className="font-semibold text-blue-300">Click "Stop Recording" when done</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-blue-400 mt-0.5">•</span>
                    <span>Take your time to think before answering</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
