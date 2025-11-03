import { db, Candidate } from '../lib/firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  Timestamp,
  doc,
  getDoc,
  updateDoc,
  where,
  getDocs,
  limit,
} from 'firebase/firestore';

export interface CreateCandidateData {
  email: string;
  name: string;
  phone?: string | null;
  resumeUrl?: string | null;
  resumeText?: string | null;
}

export interface CandidateSnapshotCallback {
  (candidates: Candidate[]): void;
}

export const candidateService = {
  /**
   * Create a new candidate
   */
  async createCandidate(data: CreateCandidateData): Promise<string> {
    const candidateRef = await addDoc(collection(db, 'candidates'), {
      email: data.email,
      name: data.name,
      phone: data.phone || null,
      resumeUrl: data.resumeUrl || null,
      resumeText: data.resumeText || null,
      createdAt: Timestamp.now(),
    });

    return candidateRef.id;
  },

  /**
   * Subscribe to candidates list with real-time updates
   */
  subscribeToCandidates(callback: CandidateSnapshotCallback): () => void {
    const q = query(collection(db, 'candidates'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const candidatesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as Candidate[];

      callback(candidatesData);
    });

    return unsubscribe;
  },

  /**
   * Get a single candidate by ID
   */
  async getCandidateById(candidateId: string): Promise<Candidate | null> {
    const candidateDoc = await getDoc(doc(db, 'candidates', candidateId));

    if (!candidateDoc.exists()) {
      return null;
    }

    const data = candidateDoc.data();
    return {
      id: candidateDoc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
    } as Candidate;
  },

  /**
   * Get candidate by email
   * Note: Requires Firestore index on email field for efficient queries
   */
  async getCandidateByEmail(email: string): Promise<Candidate | null> {
    try {
      const candidatesQuery = query(collection(db, 'candidates'), where('email', '==', email), limit(1));
      const snapshot = await getDocs(candidatesQuery);
      
      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
      } as Candidate;
    } catch (error) {
      console.error('Error fetching candidate by email:', error);
      return null;
    }
  },

  /**
   * Update a candidate
   */
  async updateCandidate(candidateId: string, data: Partial<CreateCandidateData>): Promise<void> {
    await updateDoc(doc(db, 'candidates', candidateId), data);
  },
};

