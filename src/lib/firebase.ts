import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

export interface Job {
  id: string;
  companyId: string;
  title: string;
  description: string;
  requirements: {
    location?: string;
    experience?: string;
    salary?: string;
    skills?: string[];
  };
  status: 'draft' | 'active' | 'closed';
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Candidate {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  resumeUrl: string | null;
  resumeText: string | null;
  createdAt: Date;
}

export interface Application {
  id: string;
  jobId: string;
  candidateId: string;
  status: 'pending' | 'screening' | 'interview' | 'rejected' | 'hired';
  appliedAt: Date;
  updatedAt: Date;
  matchScore?: number; // AI match percentage (0-100)
  skillsMatch?: {
    required: string[];
    found: string[];
    missing: string[];
    matchCount: number;
    totalCount: number;
  };
  keywordsFound?: string[];
  aiSummary?: string;
  analyzedAt?: Date;
}

export interface ResumeAnalysis {
  id: string;
  applicationId: string;
  matchScore: number;
  skillsMatch: Record<string, unknown>;
  experienceMatch: Record<string, unknown>;
  keywordsFound: string[];
  aiSummary: string | null;
  analyzedAt: Date;
}

export interface Interview {
  id: string;
  applicationId: string;
  scheduledAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  videoUrl: string | null;
  transcript: string | null;
  questions: Array<Record<string, unknown>>;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  hrJoined: boolean; // Track if HR has joined the interview
  createdAt: Date;
}

export interface InterviewAnalysis {
  id: string;
  interviewId: string;
  sentimentScores: Record<string, unknown>;
  emotionTimeline: Array<Record<string, unknown>>;
  confidenceScore: number;
  speechPatterns: Record<string, unknown>;
  behavioralFlags: Array<Record<string, unknown>>;
  cheatingIndicators: Record<string, unknown>;
  aiInsights: string | null;
  analyzedAt: Date;
}

export interface Company {
  id: string;
  name: string;
  logoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}
