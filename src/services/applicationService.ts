import { db, Application } from '../lib/firebase';
import {
  collection,
  addDoc,
  query,
  onSnapshot,
  Timestamp,
  doc,
  getDoc,
  updateDoc,
  getDocs,
  where,
} from 'firebase/firestore';

export interface CreateApplicationData {
  jobId: string;
  candidateId: string;
  status?: 'pending' | 'screening' | 'interview' | 'rejected' | 'hired';
  matchScore?: number;
  skillsMatch?: {
    required: string[];
    found: string[];
    missing: string[];
    matchCount: number;
    totalCount: number;
  };
  keywordsFound?: string[];
  aiSummary?: string;
}

export interface ApplicationSnapshotCallback {
  (applications: Application[]): void;
}

export const applicationService = {
  /**
   * Create a new application
   */
  async createApplication(data: CreateApplicationData): Promise<string> {
    const applicationData: {
      jobId: string;
      candidateId: string;
      status: string;
      appliedAt: Timestamp;
      updatedAt: Timestamp;
      matchScore?: number;
      skillsMatch?: {
        required: string[];
        found: string[];
        missing: string[];
        matchCount: number;
        totalCount: number;
      };
      keywordsFound?: string[];
      aiSummary?: string;
      analyzedAt?: Timestamp;
    } = {
      jobId: data.jobId,
      candidateId: data.candidateId,
      status: data.status || 'pending',
      appliedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    // Add AI analysis data if provided
    if (data.matchScore !== undefined) {
      applicationData.matchScore = data.matchScore;
      applicationData.analyzedAt = Timestamp.now();
    }
    if (data.skillsMatch) {
      applicationData.skillsMatch = data.skillsMatch;
    }
    if (data.keywordsFound) {
      applicationData.keywordsFound = data.keywordsFound;
    }
    if (data.aiSummary) {
      applicationData.aiSummary = data.aiSummary;
    }

    const applicationRef = await addDoc(collection(db, 'applications'), applicationData);

    return applicationRef.id;
  },

  /**
   * Subscribe to applications list with real-time updates (filtered by user's jobs)
   */
  subscribeToApplications(callback: ApplicationSnapshotCallback, userId: string | null): () => void {
    if (!userId) {
      callback([]);
      return () => {};
    }

    // First get user's jobs to filter applications
    const jobsQuery = query(collection(db, 'jobs'), where('createdBy', '==', userId));
    
    let unsubscribeJobs: (() => void) | null = null;
    let unsubscribeApplications: (() => void) | null = null;

    unsubscribeJobs = onSnapshot(
      jobsQuery,
      async (jobsSnapshot) => {
        const userJobIds = new Set(jobsSnapshot.docs.map((doc) => doc.id));

        // If user has no jobs, return empty array
        if (userJobIds.size === 0) {
          callback([]);
          // Clean up applications listener if it exists
          if (unsubscribeApplications) {
            unsubscribeApplications();
            unsubscribeApplications = null;
          }
          return;
        }

        // Now subscribe to applications and filter by user's job IDs
        // Use getDocs instead of onSnapshot for applications to avoid index issues
        const applicationsQuery = collection(db, 'applications');
        
        // Clean up previous applications listener
        if (unsubscribeApplications) {
          unsubscribeApplications();
        }

        unsubscribeApplications = onSnapshot(
          applicationsQuery,
          (snapshot) => {
            // Filter applications to only those for user's jobs
            const applicationsData = snapshot.docs
              .filter((doc) => {
                const jobId = doc.data().jobId;
                return jobId && userJobIds.has(jobId);
              })
              .map((doc) => {
                const data = doc.data();
                return {
                  id: doc.id,
                  ...data,
                  appliedAt: data.appliedAt?.toDate() || new Date(),
                  updatedAt: data.updatedAt?.toDate() || new Date(),
                  matchScore: data.matchScore,
                  skillsMatch: data.skillsMatch,
                  keywordsFound: data.keywordsFound,
                  aiSummary: data.aiSummary,
                  analyzedAt: data.analyzedAt?.toDate() || undefined,
                } as Application;
              })
              // Sort by appliedAt descending (client-side since we removed orderBy)
              .sort((a, b) => b.appliedAt.getTime() - a.appliedAt.getTime());

            callback(applicationsData);
          },
          (error) => {
            console.error('Error in applications subscription:', error);
            // If index is missing, show user-friendly error
            if (error.code === 'failed-precondition') {
              console.error(
                'Firestore index required. The applications query may need an index.',
                'You can create it in the Firebase Console or it will be auto-created if you click the error link.'
              );
            }
            callback([]);
          }
        );
      },
      (error) => {
        console.error('Error in jobs subscription:', error);
        callback([]);
      }
    );

    return () => {
      if (unsubscribeJobs) unsubscribeJobs();
      if (unsubscribeApplications) unsubscribeApplications();
    };
  },

  /**
   * Get all applications (one-time fetch)
   */
  async getAllApplications(): Promise<Application[]> {
    const snapshot = await getDocs(collection(db, 'applications'));
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        appliedAt: data.appliedAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        matchScore: data.matchScore,
        skillsMatch: data.skillsMatch,
        keywordsFound: data.keywordsFound,
        aiSummary: data.aiSummary,
        analyzedAt: data.analyzedAt?.toDate() || undefined,
      } as Application;
    });
  },

  /**
   * Get a single application by ID
   */
  async getApplicationById(applicationId: string): Promise<Application | null> {
    const applicationDoc = await getDoc(doc(db, 'applications', applicationId));

    if (!applicationDoc.exists()) {
      return null;
    }

    const data = applicationDoc.data();
    return {
      id: applicationDoc.id,
      ...data,
      appliedAt: data.appliedAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Application;
  },

  /**
   * Update application status
   */
  async updateApplicationStatus(
    applicationId: string,
    status: 'pending' | 'screening' | 'interview' | 'rejected' | 'hired'
  ): Promise<void> {
    await updateDoc(doc(db, 'applications', applicationId), {
      status,
      updatedAt: Timestamp.now(),
    });
  },

  /**
   * Update application
   */
  async updateApplication(applicationId: string, data: Partial<CreateApplicationData>): Promise<void> {
    await updateDoc(doc(db, 'applications', applicationId), {
      ...data,
      updatedAt: Timestamp.now(),
    });
  },
};

