import { db, Interview } from '../lib/firebase';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

export interface CreateInterviewData {
  applicationId: string;
  scheduledAt: Date;
  duration?: number;
  instructions?: string;
  interviewType?: 'ai-video' | 'hr-video';
}

export interface ScheduleInterviewWithEmailData extends CreateInterviewData {
  candidateEmail: string;
  candidateName: string;
  jobTitle: string;
  interviewType?: 'ai-video' | 'hr-video';
}

export interface InterviewSnapshotCallback {
  (interviews: Interview[]): void;
}

export const interviewService = {
  /**
   * Create a new interview
   */
  async createInterview(data: CreateInterviewData): Promise<string> {
    const interviewRef = await addDoc(collection(db, 'interviews'), {
      applicationId: data.applicationId,
      scheduledAt: Timestamp.fromDate(data.scheduledAt),
      startedAt: null,
      completedAt: null,
      videoUrl: null,
      transcript: null,
      questions: [],
      status: 'scheduled',
      interviewType: data.interviewType || 'ai-video', // Use provided type or default to AI
      hrJoined: false,
      duration: data.duration || 30,
      instructions: data.instructions || '',
      createdAt: Timestamp.now(),
    });

    return interviewRef.id;
  },

  /**
   * Generate a unique video room/channel code (now used as Agora channel)
   */
  generateRoomCode(): string {
    const randomPart1 = Math.random().toString(36).substring(2, 8).toLowerCase();
    const randomPart2 = Math.random().toString(36).substring(2, 8).toLowerCase();
    const randomPart3 = Math.random().toString(36).substring(2, 6).toLowerCase();
    return `${randomPart1}-${randomPart2}-${randomPart3}`;
  },

  /**
   * Schedule interview and send email notification
   */
  async scheduleInterviewWithEmail(data: ScheduleInterviewWithEmailData): Promise<string> {
    const interviewType = data.interviewType || 'ai-video';
    
    const interviewId = await this.createInterview({
      applicationId: data.applicationId,
      scheduledAt: data.scheduledAt,
      duration: data.duration,
      instructions: data.instructions,
      interviewType, // Pass interview type
    });

    // Generate room code (Agora channel name)
    const roomCode = this.generateRoomCode();

    // Save Agora channel to Firestore
    await updateDoc(doc(db, 'interviews', interviewId), {
      agoraChannel: roomCode,
    });

    const interviewLink = interviewType === 'ai-video'
      ? `${window.location.origin}/ai-video-interview/${interviewId}`
      : `${window.location.origin}/video-call/${interviewId}`;

    // Try to send email via Firebase Functions (optional - interview is created regardless)
    try {
      const functions = getFunctions();
      const sendInterviewEmail = httpsCallable(functions, 'sendInterviewEmail');

      await sendInterviewEmail({
        to: data.candidateEmail,
        candidateName: data.candidateName,
        jobTitle: data.jobTitle,
        interviewDate: data.scheduledAt.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        interviewTime: data.scheduledAt.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        interviewLink,
        duration: data.duration || 30,
        instructions: data.instructions || '',
        roomCode: roomCode, // Include room code in email
        interviewType, // Include interview type in email
      });
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      // Interview is still created even if email fails
      // This could be due to:
      // 1. Firebase Functions not deployed
      // 2. Email configuration not set up
      // 3. Network issues
      // The interview link is still available and can be shared manually
    }

    return interviewId;
  },

  /**
   * Subscribe to interviews list with real-time updates (filtered by user's applications)
   */
  subscribeToInterviews(callback: InterviewSnapshotCallback, userId: string | null): () => void {
    if (!userId) {
      callback([]);
      return () => {};
    }

    const q = query(collection(db, 'interviews'), orderBy('scheduledAt', 'desc'));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      // Get all jobs created by this user
      const jobsSnapshot = await getDocs(
        query(collection(db, 'jobs'), where('createdBy', '==', userId))
      );
      const userJobIds = new Set(jobsSnapshot.docs.map((doc) => doc.id));

      // If user has no jobs, return empty array
      if (userJobIds.size === 0) {
        callback([]);
        return;
      }

      // Get all applications for user's jobs
      const applicationsSnapshot = await getDocs(collection(db, 'applications'));
      const userApplicationIds = new Set<string>();
      
      applicationsSnapshot.docs.forEach((appDoc) => {
        const appData = appDoc.data();
        if (userJobIds.has(appData.jobId)) {
          userApplicationIds.add(appDoc.id);
        }
      });

      // Filter interviews to only those for user's applications
      const interviewsData = snapshot.docs
        .filter((doc) => {
          const applicationId = doc.data().applicationId;
          return applicationId && userApplicationIds.has(applicationId);
        })
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
          scheduledAt: doc.data().scheduledAt?.toDate() || new Date(),
          startedAt: doc.data().startedAt?.toDate() || null,
          completedAt: doc.data().completedAt?.toDate() || null,
          hrJoined: doc.data().hrJoined || false,
          createdAt: doc.data().createdAt?.toDate() || new Date(),
        })) as Interview[];

      callback(interviewsData);
    });

    return unsubscribe;
  },

  /**
   * Get all interviews (one-time fetch)
   */
  async getAllInterviews(): Promise<Interview[]> {
    const snapshot = await getDocs(collection(db, 'interviews'));
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      scheduledAt: doc.data().scheduledAt?.toDate() || new Date(),
      startedAt: doc.data().startedAt?.toDate() || null,
      completedAt: doc.data().completedAt?.toDate() || null,
      hrJoined: doc.data().hrJoined || false,
      createdAt: doc.data().createdAt?.toDate() || new Date(),
    })) as Interview[];
  },

  /**
   * Get a single interview by ID
   */
  async getInterviewById(interviewId: string): Promise<Interview | null> {
    const interviewDoc = await getDoc(doc(db, 'interviews', interviewId));

    if (!interviewDoc.exists()) {
      return null;
    }

    const data = interviewDoc.data();
    return {
      id: interviewDoc.id,
      ...data,
      scheduledAt: data.scheduledAt?.toDate() || new Date(),
      startedAt: data.startedAt?.toDate() || null,
      completedAt: data.completedAt?.toDate() || null,
      hrJoined: data.hrJoined || false,
      transcript: data.transcript || null,
      createdAt: data.createdAt?.toDate() || new Date(),
    } as Interview;
  },


  /**
   * Mark HR as joined
   */
  async markHRJoined(interviewId: string): Promise<void> {
    await updateDoc(doc(db, 'interviews', interviewId), {
      hrJoined: true,
    });
  },

  /**
   * Start an interview
   */
  async startInterview(interviewId: string): Promise<void> {
    await updateDoc(doc(db, 'interviews', interviewId), {
      status: 'in_progress',
      startedAt: Timestamp.now(),
    });
  },

  /**
   * Complete an interview
   */
  async completeInterview(interviewId: string): Promise<void> {
    await updateDoc(doc(db, 'interviews', interviewId), {
      status: 'completed',
      completedAt: Timestamp.now(),
    });
  },

  /**
   * Update interview
   */
  async updateInterview(interviewId: string, data: Partial<CreateInterviewData>): Promise<void> {
    const updateData: {
      scheduledAt?: Timestamp;
      duration?: number;
      instructions?: string;
    } = {};

    if (data.scheduledAt) {
      updateData.scheduledAt = Timestamp.fromDate(data.scheduledAt);
    }
    if (data.duration !== undefined) {
      updateData.duration = data.duration;
    }
    if (data.instructions !== undefined) {
      updateData.instructions = data.instructions;
    }

    await updateDoc(doc(db, 'interviews', interviewId), updateData);
  },

  /**
   * Cancel an interview
   */
  async cancelInterview(interviewId: string): Promise<void> {
    await updateDoc(doc(db, 'interviews', interviewId), {
      status: 'cancelled',
    });
  },

  /**
   * Save interview analysis data (placeholder - feature coming soon)
   */
  async saveInterviewAnalysis(interviewId: string): Promise<void> {
    console.log('Interview analysis feature coming soon:', interviewId);
    // Feature disabled
  },
};

