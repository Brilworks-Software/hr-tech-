import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { functions, db } from '../lib/firebase';

export interface AIVideoQuestion {
  id: string;
  text: string;
  category: string;
  followUp?: string;
}

export interface AIVideoQuestionAnswer {
  questionId: string;
  questionText: string;
  category: string;
  answer: string;
  timestamp: string;
}

export interface AIVideoTranscript {
  role: 'ai' | 'candidate';
  text: string;
  timestamp: string;
}

export interface AIVideoInterviewData {
  interviewId: string;
  applicationId: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  jobDescription: string;
  requiredSkills: string[];
  resumeSummary: string;
  
  // Agora details
  channelName: string;
  agoraAppId: string;
  candidateUid: number;
  aiUid: number;
  candidateToken: string;
  
  // Interview state
  status: 'waiting' | 'in_progress' | 'completed' | 'cancelled';
  currentQuestionIndex: number;
  questions: AIVideoQuestion[];
  questionsAnswers: AIVideoQuestionAnswer[];
  transcript: AIVideoTranscript[];
  
  // Timestamps
  createdAt: any;
  startedAt?: any;
  completedAt?: any;
  updatedAt: any;
}

/**
 * Initialize AI video interview session
 */
export const initializeInterview = async (interviewId: string) => {
  const startAIVideoInterview = httpsCallable(functions, 'startAIVideoInterview');
  const result = await startAIVideoInterview({ interviewId });
  return result.data as any;
};

/**
 * Start the interview (candidate joined)
 */
export const startInterview = async (interviewId: string) => {
  const startInterviewFn = httpsCallable(functions, 'startInterview');
  await startInterviewFn({ interviewId });
};

/**
 * Record candidate's answer
 */
export const recordAnswer = async (
  interviewId: string,
  questionIndex: number,
  answer: string
) => {
  const recordAnswerFn = httpsCallable(functions, 'recordAnswer');
  const result = await recordAnswerFn({ interviewId, questionIndex, answer });
  return result.data as any;
};

/**
 * Complete the interview
 */
export const completeInterview = async (interviewId: string) => {
  const completeAIInterviewFn = httpsCallable(functions, 'completeAIInterview');
  await completeAIInterviewFn({ interviewId });
};

/**
 * Generate AI evaluation from interview transcript
 */
export const generateEvaluation = async (interviewId: string) => {
  const evaluateAIVideoInterviewFn = httpsCallable(functions, 'evaluateAIVideoInterview');
  const result = await evaluateAIVideoInterviewFn({ interviewId });
  return result.data as any;
};

/**
 * Cancel ongoing interview
 */
export const cancelInterview = async (interviewId: string) => {
  const cancelAIInterviewFn = httpsCallable(functions, 'cancelAIInterview');
  await cancelAIInterviewFn({ interviewId });
};

/**
 * Subscribe to real-time AI video interview updates
 */
export const subscribeToAIInterview = (
  interviewId: string,
  callback: (data: AIVideoInterviewData | null) => void
): (() => void) => {
  const docRef = doc(db, 'aiVideoInterviews', interviewId);
  
  const unsubscribe = onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data() as AIVideoInterviewData);
    } else {
      callback(null);
    }
  });

  return unsubscribe;
};

/**
 * Get AI video interview data by ID (one-time fetch)
 */
export const getAIVideoInterviewById = async (interviewId: string): Promise<AIVideoInterviewData | null> => {
  const docRef = doc(db, 'aiVideoInterviews', interviewId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return docSnap.data() as AIVideoInterviewData;
  }
  
  return null;
};

/**
 * Generate Agora token for additional participants (e.g., HR monitoring)
 */
export const generateAgoraToken = async (channelName: string, uid: number) => {
  const generateAgoraTokenFn = httpsCallable(functions, 'generateAgoraToken');
  const result = await generateAgoraTokenFn({ channelName, uid });
  return result.data as any;
};

export const aiVideoInterviewService = {
  initializeInterview,
  startInterview,
  recordAnswer,
  completeInterview,
  generateEvaluation,
  cancelInterview,
  subscribeToAIInterview,
  getAIVideoInterviewById,
  generateAgoraToken,
};
