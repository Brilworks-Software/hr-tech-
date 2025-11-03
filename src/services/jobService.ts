import { db, Job } from '../lib/firebase';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  doc,
  updateDoc,
  getDoc,
  where,
} from 'firebase/firestore';
import { companyService } from './companyService';

export interface CreateJobData {
  title: string;
  description: string;
  requirements: {
    location?: string;
    experience?: string;
    salary?: string;
    skills?: string[];
  };
  status: 'draft' | 'active' | 'closed';
  createdBy?: string | null;
}

export interface JobSnapshotCallback {
  (jobs: Job[]): void;
}

export const jobService = {
  /**
   * Create a new job posting
   */
  async createJob(data: CreateJobData): Promise<string> {
    const companyId = await companyService.getOrCreateDefaultCompany();

    const jobRef = await addDoc(collection(db, 'jobs'), {
      title: data.title,
      description: data.description,
      requirements: data.requirements,
      status: data.status,
      companyId,
      createdBy: data.createdBy || null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    return jobRef.id;
  },

  /**
   * Subscribe to jobs list with real-time updates (filtered by creator)
   */
  subscribeToJobs(callback: JobSnapshotCallback, createdBy: string | null): () => void {
    if (!createdBy) {
      callback([]);
      return () => {};
    }

    const q = query(
      collection(db, 'jobs'),
      where('createdBy', '==', createdBy),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const jobsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        })) as Job[];

        callback(jobsData);
      },
      (error) => {
        console.error('Error in jobs subscription:', error);
        // If index is missing, show user-friendly error
        if (error.code === 'failed-precondition') {
          console.error(
            'Firestore index required. Please create the composite index for jobs collection:',
            'createdBy (ASC) + createdAt (DESC)'
          );
          console.error('Deploy indexes: firebase deploy --only firestore:indexes');
          // Still call callback with empty array to prevent UI blocking
          callback([]);
        }
      }
    );

    return unsubscribe;
  },

  /**
   * Get a public job (for application form - no auth required)
   */
  async getPublicJobById(jobId: string): Promise<Job | null> {
    const jobDoc = await getDoc(doc(db, 'jobs', jobId));

    if (!jobDoc.exists()) {
      return null;
    }

    const data = jobDoc.data();
    // Only return active jobs for public view
    if (data.status !== 'active') {
      return null;
    }

    return {
      id: jobDoc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Job;
  },

  /**
   * Get a single job by ID
   */
  async getJobById(jobId: string): Promise<Job | null> {
    const jobDoc = await getDoc(doc(db, 'jobs', jobId));

    if (!jobDoc.exists()) {
      return null;
    }

    const data = jobDoc.data();
    return {
      id: jobDoc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Job;
  },

  /**
   * Update a job
   */
  async updateJob(jobId: string, data: Partial<CreateJobData>): Promise<void> {
    await updateDoc(doc(db, 'jobs', jobId), {
      ...data,
      updatedAt: Timestamp.now(),
    });
  },

  /**
   * Update job status
   */
  async updateJobStatus(jobId: string, status: 'draft' | 'active' | 'closed'): Promise<void> {
    await updateDoc(doc(db, 'jobs', jobId), {
      status,
      updatedAt: Timestamp.now(),
    });
  },
};

