import { db } from '../lib/firebase';
import { doc, updateDoc, getDoc, Timestamp, onSnapshot, Unsubscribe } from 'firebase/firestore';

export interface TranscriptEntry {
  speaker: 'HR' | 'Candidate' | 'system';
  text: string;
  timestamp: Date;
  isFinal: boolean;
  confidence?: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

class TranscriptService {
  private recognition: SpeechRecognition | null = null;
  private isRecording = false;
  private transcriptEntries: TranscriptEntry[] = []; // Array of all transcript entries
  private interimTranscript = '';
  private lastSaveTime = Date.now();
  private saveInterval = 5000; // Save every 5 seconds
  private interviewId: string | null = null;
  private speaker: 'HR' | 'Candidate' = 'HR';
  private isRestarting = false; // Prevent multiple simultaneous restarts
  private healthCheckInterval: number | null = null; // Monitor service health
  private lastResultTime = Date.now(); // Track last successful result
  private transcriptListener: Unsubscribe | null = null; // Firestore real-time listener
  private transcriptUpdateCallbacks: ((entries: TranscriptEntry[]) => void)[] = []; // Callbacks for transcript updates

  /**
   * Initialize speech recognition using Web Speech API (free, browser native)
   */
  initialize(): boolean {
    if (typeof window === 'undefined') {
      console.warn('Speech recognition not available in this environment');
      return false;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported in this browser');
      return false;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event: SpeechRecognitionEvent) => {
        // Update last result time to track service health
        this.lastResultTime = Date.now();
        
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
          const entry: TranscriptEntry = {
            speaker: this.speaker,
            text: finalTranscript.trim(),
            timestamp: new Date(),
            isFinal: true,
          };
          this.addTranscriptEntry(entry);
          // Immediately save to Firestore for real-time sync
          this.saveTranscript();
        }

        this.interimTranscript = interimTranscript;
      };

      this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        // Ignore expected errors that don't need logging
        const ignorableErrors = ['no-speech', 'aborted'];
        
        if (ignorableErrors.includes(event.error)) {
          // These are expected errors - no need to log
          return;
        }
        
        // Only log unexpected errors
        console.error('Speech recognition error:', event.error, event.message);
        
        // For critical errors, try to restart after a delay
        if (event.error === 'network' || event.error === 'service-not-allowed') {
          // These errors might need a restart
          if (this.isRecording && !this.isRestarting) {
            this.isRestarting = true;
            setTimeout(() => {
              if (this.isRecording && this.recognition) {
                try {
                  this.recognition.stop();
                  setTimeout(() => {
                    if (this.isRecording && this.recognition) {
                      try {
                        this.recognition.start();
                      } catch (e) {
                        console.error('Error restarting after error:', e);
                      }
                    }
                    this.isRestarting = false;
                  }, 500);
                } catch (e) {
                  console.error('Error stopping recognition after error:', e);
                  this.isRestarting = false;
                }
              }
            }, 2000);
          }
        }
      };

      this.recognition.onend = () => {
        // Only restart if we're still recording and not already restarting
        if (this.isRecording && this.recognition && !this.isRestarting) {
          this.isRestarting = true;
          
          // Add a small delay before restarting to prevent rapid restart loops
          setTimeout(() => {
            if (this.isRecording && this.recognition) {
              try {
                this.recognition.start();
                // Reset flag after successful start
                setTimeout(() => {
                  this.isRestarting = false;
                }, 200);
              } catch (error) {
                // Ignore "already started" errors
                const err = error as Error;
                if (err.name !== 'InvalidStateError' && !err.message?.includes('already started')) {
                  console.error('Error restarting speech recognition:', error);
                }
                
                // Retry after a longer delay if it failed
                setTimeout(() => {
                  if (this.isRecording && this.recognition) {
                    try {
                      this.recognition.start();
                    } catch (e) {
                      // Ignore "already started" errors
                      const retryErr = e as Error;
                      if (retryErr.name !== 'InvalidStateError' && !retryErr.message?.includes('already started')) {
                        console.error('Error restarting speech recognition (retry):', e);
                      }
                    }
                  }
                  this.isRestarting = false;
                }, 1000);
              }
            } else {
              this.isRestarting = false;
            }
          }, 100); // Small delay to prevent rapid restarts
        }
      };

      return true;
    } catch (error) {
      console.error('Error initializing speech recognition:', error);
      return false;
    }
  }

  /**
   * Load existing transcript entries from Firestore
   */
  private async loadExistingTranscript(): Promise<void> {
    if (!this.interviewId) {
      return;
    }

    try {
      const interviewRef = doc(db, 'interviews', this.interviewId);
      const interviewDoc = await getDoc(interviewRef);
      
      if (interviewDoc.exists()) {
        const data = interviewDoc.data();
        // Load transcript entries array if it exists
        if (data.transcriptEntries && Array.isArray(data.transcriptEntries)) {
          // Convert Firestore timestamps to Date objects
          this.transcriptEntries = data.transcriptEntries.map((entry: TranscriptEntry & { timestamp?: Timestamp | Date }) => ({
            speaker: entry.speaker,
            text: entry.text,
            timestamp: entry.timestamp && 'toDate' in entry.timestamp ? entry.timestamp.toDate() : new Date(entry.timestamp as Date),
            isFinal: entry.isFinal,
            confidence: entry.confidence,
          }));
          // Sort by timestamp to ensure chronological order
          this.transcriptEntries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
          console.log(`Loaded ${this.transcriptEntries.length} existing transcript entries from Firestore`);
          this.notifyTranscriptUpdate();
        } else if (data.transcript && typeof data.transcript === 'string') {
          // Legacy: If old string format exists, try to parse it (optional - for backward compatibility)
          console.log('Found legacy transcript format, keeping existing entries array');
        }
      }
    } catch (error) {
      console.error('Error loading existing transcript:', error);
      // Don't fail if we can't load existing transcript
    }
  }

  /**
   * Start real-time listener for transcript updates from Firestore
   * This allows both HR and Candidate to see each other's transcripts
   */
  private startTranscriptListener(): void {
    if (!this.interviewId) {
      return;
    }

    // Remove existing listener if any
    this.stopTranscriptListener();

    try {
      const interviewRef = doc(db, 'interviews', this.interviewId);
      
      // Listen for real-time updates
      this.transcriptListener = onSnapshot(interviewRef, (snapshot) => {
        if (!snapshot.exists()) {
          return;
        }

        const data = snapshot.data();
        if (data.transcriptEntries && Array.isArray(data.transcriptEntries)) {
          // Convert Firestore timestamps to Date objects
          const firestoreEntries = data.transcriptEntries.map((entry: TranscriptEntry & { timestamp?: Timestamp | Date }) => ({
            speaker: entry.speaker,
            text: entry.text,
            timestamp: entry.timestamp && 'toDate' in entry.timestamp ? entry.timestamp.toDate() : new Date(entry.timestamp as Date),
            isFinal: entry.isFinal,
            confidence: entry.confidence,
          }));

          // Sort by timestamp
          firestoreEntries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

          // Merge with local entries (avoid duplicates based on timestamp and text)
          const mergedEntries: TranscriptEntry[] = [];
          const seenEntries = new Set<string>();

          // Add all entries, avoiding duplicates
          [...this.transcriptEntries, ...firestoreEntries].forEach(entry => {
            const key = `${entry.timestamp.getTime()}-${entry.speaker}-${entry.text.substring(0, 50)}`;
            if (!seenEntries.has(key)) {
              seenEntries.add(key);
              mergedEntries.push(entry);
            }
          });

          // Sort merged entries by timestamp
          mergedEntries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

          // Always update local entries to match Firestore (for real-time sync)
          // This ensures both HR and Candidate see all transcripts
          const entriesChanged = mergedEntries.length !== this.transcriptEntries.length ||
            mergedEntries.some((entry, index) => {
              const existing = this.transcriptEntries[index];
              return !existing || 
                     existing.speaker !== entry.speaker ||
                     existing.text !== entry.text ||
                     existing.timestamp.getTime() !== entry.timestamp.getTime();
            });

          if (entriesChanged || mergedEntries.length > 0) {
            this.transcriptEntries = mergedEntries;
            console.log(`Transcript updated from Firestore: ${this.transcriptEntries.length} entries (HR: ${mergedEntries.filter(e => e.speaker === 'HR').length}, Candidate: ${mergedEntries.filter(e => e.speaker === 'Candidate').length})`);
            this.notifyTranscriptUpdate();
          }
        }
      }, (error) => {
        console.error('Error in transcript listener:', error);
      });

      console.log('Started real-time transcript listener');
    } catch (error) {
      console.error('Error starting transcript listener:', error);
    }
  }

  /**
   * Stop real-time transcript listener
   */
  private stopTranscriptListener(): void {
    if (this.transcriptListener) {
      this.transcriptListener();
      this.transcriptListener = null;
      console.log('Stopped real-time transcript listener');
    }
  }

  /**
   * Notify all callbacks about transcript updates
   */
  private notifyTranscriptUpdate(): void {
    this.transcriptUpdateCallbacks.forEach(callback => {
      try {
        callback([...this.transcriptEntries]);
      } catch (error) {
        console.error('Error in transcript update callback:', error);
      }
    });
  }

  /**
   * Subscribe to transcript updates
   * Useful for UI components that need real-time updates
   */
  onTranscriptUpdate(callback: (entries: TranscriptEntry[]) => void): () => void {
    this.transcriptUpdateCallbacks.push(callback);
    
    // Immediately call with current entries
    callback([...this.transcriptEntries]);
    
    // Return unsubscribe function
    return () => {
      const index = this.transcriptUpdateCallbacks.indexOf(callback);
      if (index > -1) {
        this.transcriptUpdateCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Start transcription
   * @param interviewId - Interview ID
   * @param speaker - Speaker identifier ('HR' or 'Candidate')
   * @param audioStream - Audio stream (for logging microphone info, optional)
   */
  async start(interviewId: string, speaker: 'HR' | 'Candidate' = 'HR', audioStream?: MediaStream): Promise<boolean> {
    // Log which microphone is being used for debugging
    if (audioStream) {
      const audioTrack = audioStream.getAudioTracks()[0];
      if (audioTrack) {
        console.log('Transcript service using microphone:', audioTrack.label || 'Unknown');
        console.log('Microphone device ID:', audioTrack.getSettings().deviceId || 'default');
      }
    }
    
    // If interview ID changed, load existing transcript entries
    if (this.interviewId !== interviewId) {
      this.interviewId = interviewId;
      await this.loadExistingTranscript(); // Load existing entries from Firestore
      // Don't clear transcriptEntries - we want to keep and append to existing entries
    } else {
      this.interviewId = interviewId;
      // Keep existing entries for same interview (allows rejoining without losing data)
    }
    
    this.speaker = speaker;
    this.isRecording = true;
    this.interimTranscript = '';
    this.lastSaveTime = Date.now();

    // Start real-time listener to sync transcripts from other participants
    this.startTranscriptListener();

    // Initialize Web Speech API
    if (!this.recognition) {
      const initialized = this.initialize();
      if (!initialized) {
        return false;
      }
    }

    if (!this.recognition) {
      return false;
    }

    try {
      this.recognition.start();
      this.lastResultTime = Date.now(); // Reset health check timer
      console.log(`Web Speech API transcription started for interview: ${interviewId} as ${speaker}`);
      this.startPeriodicSave();
      this.startHealthCheck(); // Start monitoring service health
      return true;
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      this.isRecording = false;
      return false;
    }
  }

  /**
   * Stop transcription
   */
  async stop(): Promise<void> {
    this.isRecording = false;
    this.isRestarting = false; // Reset restart flag
    this.stopHealthCheck(); // Stop health monitoring
    this.stopTranscriptListener(); // Stop real-time listener

    if (this.recognition) {
      try {
        // Abort instead of stop to prevent onend from firing
        this.recognition.abort();
      } catch {
        // If abort fails, try stop
        try {
          this.recognition.stop();
        } catch (e) {
          // Ignore errors if recognition is already stopped
          const err = e as Error;
          if (err.name !== 'InvalidStateError') {
            console.error('Error stopping speech recognition:', e);
          }
        }
      }
    }

    // Save final transcript
    await this.saveTranscript();
    
    // Clear callbacks
    this.transcriptUpdateCallbacks = [];
  }

  /**
   * Add a transcript entry
   */
  private addTranscriptEntry(entry: TranscriptEntry): void {
    // Check for duplicates before adding
    const isDuplicate = this.transcriptEntries.some(existing => 
      existing.speaker === entry.speaker &&
      existing.text === entry.text &&
      Math.abs(existing.timestamp.getTime() - entry.timestamp.getTime()) < 1000 // Within 1 second
    );

    if (!isDuplicate) {
      this.transcriptEntries.push(entry);
      // Sort by timestamp to maintain chronological order
      this.transcriptEntries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      // Notify listeners immediately so UI updates (HR can see their own transcript)
      this.notifyTranscriptUpdate();
      
      // Auto-save if enough time has passed
      const now = Date.now();
      if (now - this.lastSaveTime >= this.saveInterval) {
        this.saveTranscript();
        this.lastSaveTime = now;
      }
    }
  }

  /**
   * Add a manual transcript entry (for remote speaker or system messages)
   */
  addManualEntry(text: string, speaker: 'HR' | 'Candidate' | 'system' = 'system'): void {
    this.addTranscriptEntry({
      speaker,
      text,
      timestamp: new Date(),
      isFinal: true,
    });
  }

  /**
   * Get current transcript as formatted text
   * Simply formats all entries in the array
   */
  getTranscriptText(): string {
    // Format all entries in chronological order
    return this.transcriptEntries
      .map((entry) => {
        const time = entry.timestamp.toLocaleTimeString();
        const speakerLabel = entry.speaker === 'HR' ? 'HR' : entry.speaker === 'Candidate' ? 'Candidate' : 'System';
        return `[${time}] ${speakerLabel}: ${entry.text}`;
      })
      .join('\n');
  }

  /**
   * Get all transcript entries
   */
  getTranscriptEntries(): TranscriptEntry[] {
    return [...this.transcriptEntries];
  }

  /**
   * Get interim (non-final) transcript
   */
  getInterimTranscript(): string {
    return this.interimTranscript;
  }

  /**
   * Save transcript entries array to Firestore
   * Uses merge to avoid overwriting entries from other participants
   */
  private async saveTranscript(): Promise<void> {
    if (!this.interviewId || this.transcriptEntries.length === 0) {
      return;
    }

    try {
      const interviewRef = doc(db, 'interviews', this.interviewId);
      
      // Get current entries from Firestore to merge
      const interviewDoc = await getDoc(interviewRef);
      let existingEntries: TranscriptEntry[] = [];
      
      if (interviewDoc.exists()) {
        const data = interviewDoc.data();
        if (data.transcriptEntries && Array.isArray(data.transcriptEntries)) {
          existingEntries = data.transcriptEntries.map((entry: TranscriptEntry & { timestamp?: Timestamp | Date }) => ({
            speaker: entry.speaker,
            text: entry.text,
            timestamp: entry.timestamp && 'toDate' in entry.timestamp ? entry.timestamp.toDate() : new Date(entry.timestamp as Date),
            isFinal: entry.isFinal,
            confidence: entry.confidence,
          }));
        }
      }

      // Merge local entries with existing entries (avoid duplicates)
      const mergedEntries: TranscriptEntry[] = [];
      const seenEntries = new Set<string>();

      // Add existing entries first
      existingEntries.forEach(entry => {
        const key = `${entry.timestamp.getTime()}-${entry.speaker}-${entry.text.substring(0, 50)}`;
        if (!seenEntries.has(key)) {
          seenEntries.add(key);
          mergedEntries.push(entry);
        }
      });

      // Add local entries (new ones)
      this.transcriptEntries.forEach(entry => {
        const key = `${entry.timestamp.getTime()}-${entry.speaker}-${entry.text.substring(0, 50)}`;
        if (!seenEntries.has(key)) {
          seenEntries.add(key);
          mergedEntries.push(entry);
        }
      });

      // Sort by timestamp
      mergedEntries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      // Convert Date objects to Firestore Timestamps for storage
      // Remove undefined values (Firestore doesn't allow undefined)
      const entriesToSave = mergedEntries.map(entry => {
        const entryToSave: {
          speaker: 'HR' | 'Candidate' | 'system';
          text: string;
          timestamp: Timestamp;
          isFinal: boolean;
          confidence?: number;
        } = {
          speaker: entry.speaker,
          text: entry.text,
          timestamp: Timestamp.fromDate(entry.timestamp),
          isFinal: entry.isFinal,
        };
        // Only include confidence if it's defined
        if (entry.confidence !== undefined && entry.confidence !== null) {
          entryToSave.confidence = entry.confidence;
        }
        return entryToSave;
      });
      
      // Save both the array (for easy appending) and formatted text (for display)
      const transcriptText = mergedEntries
        .map((entry) => {
          const time = entry.timestamp.toLocaleTimeString();
          const speakerLabel = entry.speaker === 'HR' ? 'HR' : entry.speaker === 'Candidate' ? 'Candidate' : 'System';
          return `[${time}] ${speakerLabel}: ${entry.text}`;
        })
        .join('\n');
      
      await updateDoc(interviewRef, {
        transcriptEntries: entriesToSave, // Array of entries (merged)
        transcript: transcriptText, // Formatted text for backward compatibility
        transcriptUpdatedAt: Timestamp.now(),
      });
      
      // Update local entries to match saved entries
      this.transcriptEntries = mergedEntries;
      
      console.log(`Saved ${mergedEntries.length} transcript entries to Firestore (${this.speaker})`);
    } catch (error) {
      console.error('Error saving transcript:', error);
    }
  }

  /**
   * Start periodic saving
   */
  private startPeriodicSave(): void {
    const saveInterval = setInterval(() => {
      if (this.isRecording) {
        this.saveTranscript();
        this.lastSaveTime = Date.now();
      } else {
        clearInterval(saveInterval);
      }
    }, this.saveInterval);
  }

  /**
   * Start health check to monitor if transcription is still working
   */
  private startHealthCheck(): void {
    // Clear any existing health check
    this.stopHealthCheck();
    
    // Check every 30 seconds if we're still receiving results
    this.healthCheckInterval = window.setInterval(() => {
      if (!this.isRecording) {
        this.stopHealthCheck();
        return;
      }

      const timeSinceLastResult = Date.now() - this.lastResultTime;
      const MAX_IDLE_TIME = 60000; // 60 seconds without any result

      // If we haven't received results in a while and recognition seems stopped, restart
      if (timeSinceLastResult > MAX_IDLE_TIME && !this.isRestarting) {
        console.warn('Transcript service appears to have stopped. Attempting restart...');
        this.restartRecognition();
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Stop health check monitoring
   */
  private stopHealthCheck(): void {
    if (this.healthCheckInterval !== null) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Restart recognition if it appears to have stopped
   */
  private restartRecognition(): void {
    if (!this.isRecording || this.isRestarting || !this.recognition) {
      return;
    }

    this.isRestarting = true;
    console.log('Restarting transcript service...');

    try {
      // Try to stop first
      try {
        this.recognition.stop();
      } catch {
        // Ignore errors
      }

      // Wait a bit then restart
      setTimeout(() => {
        if (this.isRecording && this.recognition && !this.isRestarting) {
          return; // Already restarted by onend handler
        }

        if (this.isRecording && this.recognition) {
          try {
            this.recognition.start();
            this.lastResultTime = Date.now(); // Reset timer
            console.log('Transcript service restarted successfully');
            this.isRestarting = false;
          } catch (error) {
            console.error('Error restarting transcript service:', error);
            // Try again after a longer delay
            setTimeout(() => {
              if (this.isRecording && this.recognition) {
                try {
                  this.recognition.start();
                  this.lastResultTime = Date.now();
                  console.log('Transcript service restarted on retry');
                } catch (e) {
                  console.error('Failed to restart transcript service after retry:', e);
                }
              }
              this.isRestarting = false;
            }, 5000);
          }
        } else {
          this.isRestarting = false;
        }
      }, 1000);
    } catch (error) {
      console.error('Error in restartRecognition:', error);
      this.isRestarting = false;
    }
  }

  /**
   * Check if speech recognition is supported
   */
  static isSupported(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }
}

export const transcriptService = new TranscriptService();
export { TranscriptService };
