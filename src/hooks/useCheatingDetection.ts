import { useEffect, useRef, useState, useCallback } from 'react';
import * as faceDetection from '@tensorflow-models/face-detection';
import '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

type FaceKeypoint = { x: number; y: number; name?: string };
type DetectedFace = faceDetection.Face & { keypoints?: FaceKeypoint[] };

export interface CheatingAlert {
  timestamp: Date;
  type: 'face_not_detected' | 'looking_away' | 'multiple_faces' | 'attentive';
  severity: 'low' | 'medium' | 'high';
  message: string;
  confidence?: number;
}

export interface UseCheatingDetectionReturn {
  isDetecting: boolean;
  alerts: CheatingAlert[];
  startDetection: (videoElement: HTMLVideoElement, interviewId: string) => void;
  stopDetection: () => void;
  clearAlerts: () => void;
}

/**
 * Custom hook for cheating detection using MediaPipe FaceMesh
 * Detects:
 * - Face not detected (candidate might be away)
 * - Looking away from screen (eye gaze direction)
 * - Multiple faces detected
 */
export function useCheatingDetection(): UseCheatingDetectionReturn {
  const [isDetecting, setIsDetecting] = useState(false);
  const [alerts, setAlerts] = useState<CheatingAlert[]>([]);
  const detectorRef = useRef<faceDetection.FaceDetector | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const interviewIdRef = useRef<string | null>(null);
  const lastAlertTimeRef = useRef<Map<string, number>>(new Map());
  const faceNotDetectedCountRef = useRef(0);
  const lookingAwayCountRef = useRef(0);
  const frameCountRef = useRef(0);
  const isDetectingRef = useRef(false); // Use ref instead of state for detection loop
  const okStableCountRef = useRef(0);
  const lastOkSentAtRef = useRef(0);

  const addAlert = useCallback(
    async (alert: CheatingAlert) => {
      console.log('🚨 Adding alert:', alert.type, alert.severity, alert.message);
      
      setAlerts((prev) => [...prev, alert]);

      // Save to Firestore if we have an interview ID
      if (interviewIdRef.current) {
        try {
          console.log('💾 Saving alert to Firestore:', interviewIdRef.current);
          const docRef = await addDoc(
            collection(db, 'interviews', interviewIdRef.current, 'alerts'),
            {
              ...alert,
              timestamp: Timestamp.fromDate(alert.timestamp),
            }
          );
          console.log('✅ Alert saved successfully with ID:', docRef.id);
        } catch (error) {
          console.error('❌ Error saving alert to Firestore:', error);
        }
      } else {
        console.warn('⚠️ No interview ID, alert not saved to Firestore');
      }
    },
    []
  );

  const canAddAlert = useCallback((type: string): boolean => {
    const lastTime = lastAlertTimeRef.current.get(type) || 0;
    const now = Date.now();
    const cooldownPeriod = 5000; // 5 seconds

    if (now - lastTime >= cooldownPeriod) {
      lastAlertTimeRef.current.set(type, now);
      return true;
    }
    return false;
  }, []);

  const startDetection = useCallback(
    async (videoElement: HTMLVideoElement, interviewId: string) => {
      console.log('🎬 Starting cheating detection for interview:', interviewId);
      
      if (isDetectingRef.current) {
        console.log('⚠️ Detection already active, skipping');
        return;
      }

      videoElementRef.current = videoElement;
      interviewIdRef.current = interviewId;
      setIsDetecting(true);
      isDetectingRef.current = true;
      faceNotDetectedCountRef.current = 0;
      lookingAwayCountRef.current = 0;
      frameCountRef.current = 0;

      try {
        console.log('🔧 Initializing TensorFlow.js Face Detection...');
        
        // Create detector using MediaPipeFaceDetector (more accurate than BlazeFace)
        const model = faceDetection.SupportedModels.MediaPipeFaceDetector;
        const detectorConfig: faceDetection.MediaPipeFaceDetectorTfjsModelConfig = {
          runtime: 'tfjs',
          maxFaces: 2
        };

        const detector = await faceDetection.createDetector(model, detectorConfig);
        detectorRef.current = detector;
        console.log('✅ Face detector initialized successfully');

        // Start detection loop
        const detectFaces = async () => {
          console.log('🔄 detectFaces() called - Frame:', frameCountRef.current + 1);
          
          if (!isDetectingRef.current || !videoElementRef.current || !detectorRef.current) {
            console.log('🛑 Detection loop stopped:', {
              isDetecting: isDetectingRef.current,
              hasVideo: !!videoElementRef.current,
              hasDetector: !!detectorRef.current
            });
            return;
          }

          try {
            frameCountRef.current++;
            
            console.log('👁️ About to call estimateFaces...');
            // Detect faces
            const faces = await detectorRef.current.estimateFaces(videoElementRef.current, {
              flipHorizontal: false,
            });
            console.log('✅ estimateFaces completed, faces found:', faces?.length || 0);

            // Log progress every 30 frames
            if (frameCountRef.current % 30 === 0) {
              console.log(`📊 Processed ${frameCountRef.current} frames, faces detected: ${faces.length}`);
            }

            // Check for no face detected
            if (!faces || faces.length === 0) {
              faceNotDetectedCountRef.current++;
              okStableCountRef.current = 0;

              if (faceNotDetectedCountRef.current > 10 && canAddAlert('face_not_detected')) {
                console.log('🚫 No face detected threshold exceeded (high)!');
                await addAlert({
                  type: 'face_not_detected',
                  severity: 'high',
                  timestamp: new Date(),
                  message: 'No face detected in frame',
                });
              } else if (faceNotDetectedCountRef.current > 5 && canAddAlert('face_not_detected')) {
                console.log('⚠️ No face detected threshold exceeded (medium)');
                await addAlert({
                  type: 'face_not_detected',
                  severity: 'medium',
                  timestamp: new Date(),
                  message: 'Face temporarily not visible',
                });
              }
            } else {
              // Reset face not detected counter
              faceNotDetectedCountRef.current = 0;

              // Check for multiple faces
              if (faces.length > 1 && canAddAlert('multiple_faces')) {
                console.log('👥 Multiple faces detected!');
                await addAlert({
                  type: 'multiple_faces',
                  severity: 'high',
                  timestamp: new Date(),
                  message: `${faces.length} faces detected in frame`,
                });
              }

              // Improved gaze direction detection using keypoints (eyes and nose)
              const face = faces[0];
              const box = face.box;

              const videoWidth = videoElementRef.current.videoWidth;
              const videoHeight = videoElementRef.current.videoHeight;

              // Basic stability checks: face size and valid dimensions
              const faceWidthRatio = box.width / Math.max(1, videoWidth);
              const hasStableFace = faceWidthRatio > 0.12; // at least ~12% of width to be confident

              // Fallback to simple center check if keypoints not available
              let isLookingAway = false;
              const faceExt = face as DetectedFace;
              if (faceExt.keypoints && faceExt.keypoints.length >= 3) {
                // Expecting keypoints: rightEye, leftEye, noseTip at least
                const keypoints = faceExt.keypoints as FaceKeypoint[];

                // Try to locate eyes and nose by name if available, else assume indices
                const leftEye = keypoints.find(k => k.name === 'leftEye') || keypoints[1];
                const rightEye = keypoints.find(k => k.name === 'rightEye') || keypoints[0];
                const noseTip = keypoints.find(k => k.name === 'noseTip') || keypoints[2];

                if (leftEye && rightEye && noseTip) {
                  const eyeCenterX = (leftEye.x + rightEye.x) / 2;
                  const eyeCenterY = (leftEye.y + rightEye.y) / 2;
                  const eyeDistance = Math.hypot(leftEye.x - rightEye.x, leftEye.y - rightEye.y);

                  // Horizontal deviation of nose from eyes center normalized by eye distance
                  const yawRatio = Math.abs(noseTip.x - eyeCenterX) / Math.max(1, eyeDistance);
                  // Vertical deviation (pitch) normalized similarly
                  const pitchRatio = Math.abs(noseTip.y - eyeCenterY) / Math.max(1, eyeDistance);

                  // Thresholds after testing: yaw > 0.35 or pitch > 0.45 indicates looking away
                  isLookingAway = hasStableFace && (yawRatio > 0.35 || pitchRatio > 0.45);

                  if (frameCountRef.current % 30 === 0) {
                    console.log('🔎 Gaze ratios:', { yawRatio: yawRatio.toFixed(2), pitchRatio: pitchRatio.toFixed(2), faceWidthRatio: faceWidthRatio.toFixed(2) });
                  }
                }
              }

              if (!faceExt.keypoints || faceExt.keypoints.length < 3) {
                // Fallback center-based method with a safer threshold and vertical consideration
                const centerX = box.xMin + box.width / 2;
                const centerY = box.yMin + box.height / 2;
                const normalizedX = centerX / Math.max(1, videoWidth);
                const normalizedY = centerY / Math.max(1, videoHeight);
                const horizAway = Math.abs(normalizedX - 0.5) > 0.35; // more forgiving
                const vertAway = Math.abs(normalizedY - 0.5) > 0.40;
                isLookingAway = hasStableFace && (horizAway || vertAway);
              }

              // Require sustained deviation for alerting (debounce + hysteresis)
              if (isLookingAway) {
                lookingAwayCountRef.current++;
                okStableCountRef.current = 0; // break OK streak when looking away

                // Medium after ~0.8s, High after ~1.5s @ ~30fps
                if (lookingAwayCountRef.current > 45 && canAddAlert('looking_away')) {
                  console.log('👀 Looking away threshold exceeded (high)!');
                  await addAlert({
                    type: 'looking_away',
                    severity: 'high',
                    timestamp: new Date(),
                    message: 'Candidate appears to be looking away from the screen',
                  });
                } else if (lookingAwayCountRef.current > 25 && canAddAlert('looking_away')) {
                  console.log('👁️ Looking away threshold exceeded (medium)');
                  await addAlert({
                    type: 'looking_away',
                    severity: 'medium',
                    timestamp: new Date(),
                    message: 'Candidate attention may be diverted',
                  });
                }
              } else {
                // decay rather than hard reset to add hysteresis
                lookingAwayCountRef.current = Math.max(0, lookingAwayCountRef.current - 3);
                // Count sustained OK frames and occasionally emit a low-severity status for HR feedback
                okStableCountRef.current++;
                const now = Date.now();
                const minOkFrames = 120; // ~4s of sustained OK
                const okCooldownMs = 60_000; // at most once per minute
                if (
                  okStableCountRef.current > minOkFrames &&
                  now - lastOkSentAtRef.current > okCooldownMs &&
                  interviewIdRef.current
                ) {
                  lastOkSentAtRef.current = now;
                  okStableCountRef.current = 0;
                  try {
                    await addAlert({
                      type: 'attentive',
                      severity: 'low',
                      timestamp: new Date(),
                      message: 'Candidate attentive and facing the screen',
                    });
                  } catch {
                    // already logged inside addAlert on failure
                  }
                }
              }
            }
          } catch (error) {
            console.error('❌ Error during face detection:', error);
          }

          // Continue detection loop
          console.log('🔁 Checking if should continue loop - isDetectingRef.current:', isDetectingRef.current);
          if (isDetectingRef.current) {
            const frameId = requestAnimationFrame(detectFaces);
            console.log('✅ Scheduled next frame with ID:', frameId);
            animationFrameRef.current = frameId;
          } else {
            console.log('🛑 Detection loop ended, isDetecting is false');
          }
        };

        // Start detection
        console.log('📹 Starting detection loop...');
        detectFaces();

      } catch (error) {
        console.error('❌ Error initializing face detection:', error);
        setIsDetecting(false);
        isDetectingRef.current = false;
      }
    },
    [addAlert, canAddAlert]
  );

  const stopDetection = useCallback(() => {
    console.log('🛑 Stopping cheating detection');
    
    setIsDetecting(false);
    isDetectingRef.current = false;

    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Dispose detector
    if (detectorRef.current) {
      detectorRef.current.dispose();
      detectorRef.current = null;
    }

    videoElementRef.current = null;
    interviewIdRef.current = null;
    faceNotDetectedCountRef.current = 0;
    lookingAwayCountRef.current = 0;
    frameCountRef.current = 0;
    lastAlertTimeRef.current.clear();
    okStableCountRef.current = 0;
    lastOkSentAtRef.current = 0;
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopDetection();
    };
  }, [stopDetection]);

  return {
    isDetecting,
    alerts,
    startDetection,
    stopDetection,
    clearAlerts,
  };
}

