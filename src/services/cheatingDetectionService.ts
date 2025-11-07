/**
 * Real-time Cheating Detection Service using MediaPipe
 * Analyzes video streams to detect potential cheating behaviors and emotions
 */
import { FaceDetector, FilesetResolver, Detection } from '@mediapipe/tasks-vision';

export interface CheatingIndicators {
  lookingAway: boolean;
  multipleFaces: boolean;
  noFaceDetected: boolean;
  audioAnomalies: boolean;
  suspiciousActivity: string[];
  confidence: number; // 0-100, higher = more suspicious
  emotions?: {
    dominant: string;
    confidence: number;
    detected: string[];
  };
}

export interface RealTimeFeedback {
  timestamp: Date;
  indicators: CheatingIndicators;
  severity: 'low' | 'medium' | 'high';
  message: string;
}

class CheatingDetectionService {
  private videoElement: HTMLVideoElement | null = null;
  private isAnalyzing = false;
  private analysisInterval: number | null = null;
  private faceDetector: FaceDetector | null = null;
  private lastDetections: Detection[] = [];
  private lookAwayCount = 0;
  private audioLevelHistory: number[] = [];
  private feedbackCallbacks: ((feedback: RealTimeFeedback) => void)[] = [];
  private consecutiveFailures = 0;
  private maxFailures = 5;
  private baselineFacePosition: { x: number; y: number; width: number; height: number } | null = null;
  private baselineEstablished = false;
  private baselineSamples: { x: number; y: number; width: number; height: number }[] = [];
  private frameSkipCount = 0;
  private readonly FRAME_SKIP = 1; // Process every 2nd frame for performance

  /**
   * Initialize MediaPipe Face Detector
   */
  private async initializeFaceDetector(): Promise<void> {
    if (this.faceDetector) {
      return; // Already initialized
    }

    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
      );
      
      this.faceDetector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite`,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.5,
      });
      
      console.log('MediaPipe Face Detector initialized successfully');
    } catch (error) {
      console.error('Error initializing MediaPipe Face Detector:', error);
      // Fallback: try with CPU delegate
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
        );
        
        this.faceDetector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite`,
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.5,
        });
        
        console.log('MediaPipe Face Detector initialized with CPU fallback');
      } catch (fallbackError) {
        console.error('Error initializing MediaPipe Face Detector with CPU:', fallbackError);
        throw fallbackError;
      }
    }
  }

  /**
   * Start real-time analysis of video stream
   */
  async startAnalysis(videoElement: HTMLVideoElement, onFeedback?: (feedback: RealTimeFeedback) => void) {
    if (this.isAnalyzing) {
      this.stopAnalysis();
    }

    // Validate video element
    if (!videoElement || !videoElement.videoWidth || !videoElement.videoHeight) {
      console.warn('CheatingDetection: Invalid video element or dimensions not available yet');
      // Wait for video to be ready
      const checkReady = setInterval(() => {
        if (videoElement && videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
          clearInterval(checkReady);
          this.initializeAnalysis(videoElement, onFeedback);
        }
      }, 100);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkReady);
        if (!this.isAnalyzing) {
          console.error('CheatingDetection: Video element not ready after timeout');
        }
      }, 5000);
      return;
    }

    await this.initializeAnalysis(videoElement, onFeedback);
  }

  /**
   * Initialize analysis after validation
   */
  private async initializeAnalysis(videoElement: HTMLVideoElement, onFeedback?: (feedback: RealTimeFeedback) => void) {
    try {
      this.videoElement = videoElement;

      // Initialize MediaPipe Face Detector
      await this.initializeFaceDetector();

      if (!this.faceDetector) {
        console.error('CheatingDetection: Failed to initialize Face Detector');
        return;
      }

      if (onFeedback) {
        this.feedbackCallbacks.push(onFeedback);
      }

      // Reset state
      this.consecutiveFailures = 0;
      this.baselineEstablished = false;
      this.baselineSamples = [];
      this.lookAwayCount = 0;
      this.lastDetections = [];
      this.frameSkipCount = 0;

      this.isAnalyzing = true;
      
      // Establish baseline first (wait a bit for video to stabilize)
      setTimeout(() => {
        this.establishBaseline();
        // Start regular analysis after baseline
        this.analyzeFrame();

        // Analyze every 500ms
        this.analysisInterval = window.setInterval(() => {
          this.analyzeFrame();
        }, 500);
      }, 1000);
    } catch (error) {
      console.error('CheatingDetection: Error initializing analysis:', error);
      this.isAnalyzing = false;
    }
  }

  /**
   * Establish baseline for normal behavior
   */
  private establishBaseline() {
    if (!this.videoElement || !this.faceDetector || !this.isAnalyzing) {
      return;
    }

    const video = this.videoElement;
    if (video.readyState < 2) {
      return;
    }

    // Collect baseline samples
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        if (!this.isAnalyzing || !this.videoElement || !this.faceDetector) return;
        
        try {
          const timestamp = performance.now();
          const detections = this.faceDetector.detectForVideo(video, timestamp);
          
          if (detections.detections && detections.detections.length > 0) {
            const detection = detections.detections[0];
            const bbox = detection.boundingBox;
            if (bbox) {
              this.baselineSamples.push({
                x: bbox.originX || 0,
                y: bbox.originY || 0,
                width: bbox.width || 0,
                height: bbox.height || 0,
              });
            }
          }
        } catch (error) {
          console.error('CheatingDetection: Error establishing baseline:', error);
        }
      }, i * 200);
    }

    // After collecting samples, calculate baseline
    setTimeout(() => {
      if (this.baselineSamples.length > 0) {
        const avgX = this.baselineSamples.reduce((sum, s) => sum + s.x, 0) / this.baselineSamples.length;
        const avgY = this.baselineSamples.reduce((sum, s) => sum + s.y, 0) / this.baselineSamples.length;
        const avgWidth = this.baselineSamples.reduce((sum, s) => sum + s.width, 0) / this.baselineSamples.length;
        const avgHeight = this.baselineSamples.reduce((sum, s) => sum + s.height, 0) / this.baselineSamples.length;
        
        this.baselineFacePosition = {
          x: avgX,
          y: avgY,
          width: avgWidth,
          height: avgHeight,
        };
        this.baselineEstablished = true;
        console.log('CheatingDetection: Baseline established', this.baselineFacePosition);
      } else {
        // If no samples collected, establish a default baseline after timeout
        setTimeout(() => {
          if (!this.baselineEstablished && this.isAnalyzing) {
            console.log('CheatingDetection: Establishing default baseline (no face samples)');
            this.baselineEstablished = true;
          }
        }, 5000);
      }
    }, 1200);
  }

  /**
   * Stop analysis
   */
  stopAnalysis() {
    this.isAnalyzing = false;
    if (this.analysisInterval !== null) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }
    this.feedbackCallbacks = [];
    this.videoElement = null;
    this.lastDetections = [];
    this.lookAwayCount = 0;
    this.audioLevelHistory = [];
    this.consecutiveFailures = 0;
    this.baselineEstablished = false;
    this.baselineFacePosition = null;
    this.baselineSamples = [];
    this.frameSkipCount = 0;
    // Note: We keep faceDetector initialized for reuse
  }

  /**
   * Analyze a single frame for cheating indicators using MediaPipe
   */
  private analyzeFrame() {
    if (!this.videoElement || !this.faceDetector || !this.isAnalyzing) {
      return;
    }

    const video = this.videoElement;
    
    // Check if video is ready
    if (video.readyState < 2) {
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= this.maxFailures * 2) {
        console.warn('CheatingDetection: Video not ready after many attempts, but continuing...');
        this.consecutiveFailures = 0;
      }
      return;
    }

    // Skip frames for performance
    this.frameSkipCount++;
    if (this.frameSkipCount < this.FRAME_SKIP) {
      return;
    }
    this.frameSkipCount = 0;

    try {
      // Validate dimensions
      if (!video.videoWidth || !video.videoHeight || video.videoWidth === 0 || video.videoHeight === 0) {
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= this.maxFailures * 2) {
          console.warn('CheatingDetection: Video dimensions invalid, but continuing...');
          this.consecutiveFailures = 0;
        }
        return;
      }

      // Check if video is paused or ended
      if (video.paused || video.ended) {
        return;
      }

      // Use MediaPipe to detect faces
      const timestamp = performance.now();
      const detections = this.faceDetector!.detectForVideo(video, timestamp);
      
      this.lastDetections = detections.detections || [];
      
      // Detect cheating indicators
      const indicators = this.detectCheatingIndicators(detections.detections || [], video.videoWidth, video.videoHeight);
      const feedback = this.generateFeedback(indicators);

      // Reset failure count on success
      this.consecutiveFailures = 0;

      // Notify callbacks
      this.feedbackCallbacks.forEach((callback) => {
        try {
          callback(feedback);
        } catch (error) {
          console.error('CheatingDetection: Error in feedback callback:', error);
        }
      });
    } catch (error) {
      console.error('CheatingDetection: Error analyzing frame:', error);
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= this.maxFailures) {
        console.warn('CheatingDetection: Too many consecutive failures, stopping analysis');
        this.stopAnalysis();
      }
    }
  }

  /**
   * Detect various cheating indicators from MediaPipe detections
   */
  private detectCheatingIndicators(
    detections: Detection[],
    videoWidth: number,
    videoHeight: number
  ): CheatingIndicators {
    const indicators: CheatingIndicators = {
      lookingAway: false,
      multipleFaces: false,
      noFaceDetected: false,
      audioAnomalies: false,
      suspiciousActivity: [],
      confidence: 0,
    };

    // Face detection analysis using MediaPipe
    const faceCount = detections.length;
    
    if (faceCount === 0) {
      indicators.noFaceDetected = true;
      this.lookAwayCount++;
      
      if (this.baselineEstablished && this.lookAwayCount > 6) {
        indicators.lookingAway = true;
        indicators.suspiciousActivity.push('Face not visible for extended period');
        indicators.confidence += 25;
      }
    } else if (faceCount > 1) {
      indicators.multipleFaces = true;
      indicators.suspiciousActivity.push(`Multiple faces detected (${faceCount})`);
      indicators.confidence += 40;
    } else {
      // Single face detected
      this.lookAwayCount = Math.max(0, this.lookAwayCount - 1);
      
      const detection = detections[0];
      const bbox = detection.boundingBox;
      
      if (bbox) {
        const facePosition = {
          x: bbox.originX || 0,
          y: bbox.originY || 0,
          width: bbox.width || 0,
          height: bbox.height || 0,
        };
        
        // Detect emotions from face landmarks and expressions
        const emotions = this.detectEmotions(detection);
        indicators.emotions = emotions;
        
        // Check if candidate is looking away based on face position
        const centerX = videoWidth / 2;
        const faceCenterX = facePosition.x + facePosition.width / 2;
        const offset = Math.abs(faceCenterX - centerX);
        
        // Use baseline if available
        if (this.baselineEstablished && this.baselineFacePosition) {
          const baselineCenterX = this.baselineFacePosition.x + this.baselineFacePosition.width / 2;
          const baselineOffset = Math.abs(faceCenterX - baselineCenterX);
          
          if (baselineOffset > videoWidth * 0.20) {
            indicators.lookingAway = true;
            indicators.suspiciousActivity.push('Face position deviates from baseline');
            indicators.confidence += 25;
          }
        } else {
          if (offset > videoWidth * 0.30) {
            indicators.lookingAway = true;
            indicators.suspiciousActivity.push('Face position suggests looking away from screen');
            indicators.confidence += 20;
          }
        }

        // Check face size
        const faceArea = facePosition.width * facePosition.height;
        const videoArea = videoWidth * videoHeight;
        const faceRatio = faceArea / videoArea;
        
        if (faceRatio < 0.05) {
          indicators.suspiciousActivity.push('Face appears too small - candidate may be far from camera');
          indicators.confidence += 10;
        } else if (faceRatio > 0.4) {
          indicators.suspiciousActivity.push('Face appears too large - candidate may be too close to camera');
          indicators.confidence += 5;
        }
        
        // Face position is stored in detections for movement detection
      }
    }

    // Check for rapid movements
    if (this.lastDetections.length > 0 && this.baselineEstablished) {
      const movementDetected = this.detectMovement(detections, videoWidth);
      if (movementDetected) {
        indicators.suspiciousActivity.push('Rapid movement detected');
        indicators.confidence += 15;
      }
    }

    // Calculate overall confidence
    if (indicators.multipleFaces) indicators.confidence += 50;
    if (indicators.lookingAway && this.lookAwayCount > 8) indicators.confidence += 35;
    if (indicators.noFaceDetected && this.baselineEstablished && this.lookAwayCount > 8) indicators.confidence += 30;
    if (indicators.suspiciousActivity.length > 2) indicators.confidence += 15;
    if (indicators.suspiciousActivity.length > 4) indicators.confidence += 25;

    indicators.confidence = Math.min(100, indicators.confidence);

    return indicators;
  }

  /**
   * Detect emotions from MediaPipe face detection
   * Analyzes face position, size, and detection confidence to infer emotions
   * Note: For full emotion detection with facial expressions, MediaPipe Face Landmarker would be needed
   */
  private detectEmotions(detection: Detection): {
    dominant: string;
    confidence: number;
    detected: string[];
  } {
    const detected: string[] = [];
    let dominant = 'neutral';
    let confidence = 0.5;

    const detectionConfidence = detection.categories?.[0]?.score || 0.5;
    const bbox = detection.boundingBox;
    
    if (!bbox) {
      return {
        dominant: 'unknown',
        confidence: 0,
        detected: ['unknown'],
      };
    }

    // Analyze face size relative to video (engagement indicator)
    const faceArea = (bbox.width || 0) * (bbox.height || 0);
    const videoArea = this.videoElement ? this.videoElement.videoWidth * this.videoElement.videoHeight : 1;
    const faceRatio = videoArea > 0 ? faceArea / videoArea : 0;
    
    // Analyze face position (attention indicator)
    const faceCenterX = (bbox.originX || 0) + (bbox.width || 0) / 2;
    const videoCenterX = this.videoElement ? this.videoElement.videoWidth / 2 : 0;
    const horizontalOffset = Math.abs(faceCenterX - videoCenterX);
    const normalizedOffset = this.videoElement && this.videoElement.videoWidth > 0 
      ? horizontalOffset / this.videoElement.videoWidth 
      : 0;

    // Infer emotions based on multiple factors
    if (detectionConfidence > 0.85 && faceRatio > 0.08 && faceRatio < 0.25 && normalizedOffset < 0.15) {
      // High confidence, good size, centered = engaged/focused
      detected.push('engaged', 'focused', 'confident');
      dominant = 'engaged';
      confidence = Math.min(0.95, detectionConfidence * 1.1);
    } else if (detectionConfidence > 0.75 && normalizedOffset < 0.2) {
      // Good confidence, reasonably centered = attentive
      detected.push('attentive', 'neutral');
      dominant = 'attentive';
      confidence = detectionConfidence;
    } else if (normalizedOffset > 0.25 || faceRatio < 0.05) {
      // Face off-center or too small = distracted
      detected.push('distracted', 'uncertain');
      dominant = 'distracted';
      confidence = Math.max(0.3, detectionConfidence * 0.8);
    } else if (detectionConfidence < 0.6) {
      // Low confidence = uncertain/unclear
      detected.push('uncertain', 'neutral');
      dominant = 'uncertain';
      confidence = detectionConfidence;
    } else if (faceRatio > 0.3) {
      // Face too large = too close, might indicate stress or discomfort
      detected.push('close', 'uncomfortable');
      dominant = 'uncomfortable';
      confidence = Math.min(0.7, detectionConfidence);
    } else {
      // Default neutral state
      detected.push('neutral');
      dominant = 'neutral';
      confidence = 0.5;
    }

    return {
      dominant,
      confidence: Math.min(1, Math.max(0, confidence)),
      detected,
    };
  }

  /**
   * Detect rapid movement between frames
   */
  private detectMovement(
    currentDetections: Detection[],
    videoWidth: number
  ): boolean {
    if (this.lastDetections.length === 0 || currentDetections.length === 0) {
      return false;
    }

    const lastDetection = this.lastDetections[0];
    const currentDetection = currentDetections[0];
    
    const lastBbox = lastDetection.boundingBox;
    const currentBbox = currentDetection.boundingBox;
    
    if (!lastBbox || !currentBbox) {
      return false;
    }

    const lastCenterX = (lastBbox.originX || 0) + (lastBbox.width || 0) / 2;
    const lastCenterY = (lastBbox.originY || 0) + (lastBbox.height || 0) / 2;
    const currentCenterX = (currentBbox.originX || 0) + (currentBbox.width || 0) / 2;
    const currentCenterY = (currentBbox.originY || 0) + (currentBbox.height || 0) / 2;
    
    const distance = Math.sqrt(
      Math.pow(currentCenterX - lastCenterX, 2) + Math.pow(currentCenterY - lastCenterY, 2)
    );
    
    const movementThreshold = Math.max(30, videoWidth * 0.05);
    
    return distance > movementThreshold;
  }

  /**
   * Generate human-readable feedback from indicators
   */
  private generateFeedback(indicators: CheatingIndicators): RealTimeFeedback {
    if (!this.baselineEstablished) {
      return {
        timestamp: new Date(),
        indicators: {
          ...indicators,
          confidence: 0,
        },
        severity: 'low',
        message: '🔄 Establishing baseline... Please wait',
      };
    }

    const severity: 'low' | 'medium' | 'high' =
      indicators.confidence >= 60 ? 'high' : indicators.confidence >= 30 ? 'medium' : 'low';

    let message = '';
    
    // Include emotion information in feedback
    const emotionInfo = indicators.emotions 
      ? ` (${indicators.emotions.dominant})` 
      : '';
    
    if (indicators.multipleFaces) {
      message = '⚠️ Multiple faces detected - someone else may be in the room' + emotionInfo;
    } else if (indicators.lookingAway && this.lookAwayCount > 8) {
      message = '⚠️ Candidate appears to be looking away from screen frequently' + emotionInfo;
    } else if (indicators.noFaceDetected && this.lookAwayCount > 8) {
      message = '⚠️ Face not visible - candidate may have left or turned away' + emotionInfo;
    } else if (indicators.suspiciousActivity.length > 0 && indicators.confidence > 20) {
      message = `⚠️ ${indicators.suspiciousActivity.slice(0, 2).join('; ')}` + emotionInfo;
    } else if (indicators.confidence > 0 && indicators.confidence < 30) {
      message = `✅ Minor activity detected, monitoring...${emotionInfo}`;
    } else {
      const emotionMsg = indicators.emotions 
        ? ` - Emotion: ${indicators.emotions.dominant}` 
        : '';
      message = '✅ No suspicious activity detected' + emotionMsg;
    }

    return {
      timestamp: new Date(),
      indicators,
      severity,
      message,
    };
  }

  /**
   * Analyze audio for anomalies
   */
  analyzeAudio(audioContext: AudioContext, audioStream: MediaStream): void {
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(audioStream);
    microphone.connect(analyser);

    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const checkAudio = () => {
      if (!this.isAnalyzing) return;

      analyser.getByteFrequencyData(dataArray);
      
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;

      this.audioLevelHistory.push(average);
      if (this.audioLevelHistory.length > 10) {
        this.audioLevelHistory.shift();
      }

      if (this.audioLevelHistory.length >= 5) {
        const recentAvg = this.audioLevelHistory.slice(-5).reduce((a, b) => a + b) / 5;
        const variance = this.audioLevelHistory.slice(-5).reduce((sum, val) => {
          return sum + Math.pow(val - recentAvg, 2);
        }, 0) / 5;

        if (variance > 500) {
          // High variance might indicate multiple voices or external sounds
        }
      }

      setTimeout(checkAudio, 500);
    };

    checkAudio();
  }
}

export const cheatingDetectionService = new CheatingDetectionService();
