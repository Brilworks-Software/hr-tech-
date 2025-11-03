import { db, Application } from '../lib/firebase';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  doc,
  getDoc,
  updateDoc,
  getDocs,
} from 'firebase/firestore';

export interface CreateApplicationData {
  jobId: string;
  candidateId: string;
  status?: 'pending' | 'screening' | 'interview' | 'rejected' | 'hired';
}

export interface ApplicationSnapshotCallback {
  (applications: Application[]): void;
}

export const applicationService = {
  /**
   * Create a new application
   */
  async createApplication(data: CreateApplicationData): Promise<string> {
    const applicationRef = await addDoc(collection(db, 'applications'), {
      jobId: data.jobId,
      candidateId: data.candidateId,
      status: data.status || 'pending',
      appliedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    return applicationRef.id;
  },

  /**
   * Subscribe to applications list with real-time updates
   */
  subscribeToApplications(callback: ApplicationSnapshotCallback): () => void {
    const q = query(collection(db, 'applications'), orderBy('appliedAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const applicationsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        appliedAt: doc.data().appliedAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Application[];

      callback(applicationsData);
    });

    return unsubscribe;
  },

  /**
   * Get all applications (one-time fetch)
   */
  async getAllApplications(): Promise<Application[]> {
    const snapshot = await getDocs(collection(db, 'applications'));
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      appliedAt: doc.data().appliedAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    })) as Application[];
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

