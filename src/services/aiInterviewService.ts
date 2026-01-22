import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, onSnapshot, collection, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

const functions = getFunctions();

export interface AIInterviewMessage {
  role: 'ai' | 'candidate';
  content: string;
  timestamp: Date;
  questionNumber?: number;
}

export interface AIInterviewSession {
  systemPrompt: string;
  messageCount: number;
  questionCount: number;
  currentPhase: 'introduction' | 'technical' | 'behavioral' | 'completed' | 'timeout';
}

export interface AIEvaluation {
  overallScore: number;
  technicalScore: number;
  communicationScore: number;
  cultureFitScore: number;
  recommendation: 'hire' | 'maybe' | 'reject';
  strengths: string[];
  concerns: string[];
  keyInsights: string;
  technicalFeedback: string;
  communicationFeedback: string;
  improvementAreas: string[];
  generatedAt: Date;
}

export const aiInterviewService = {
  /**
   * Start AI interview session
   */
  async startAIInterview(
    interviewId: string,
    applicationId: string,
    jobId: string
  ): Promise<{ message: string; sessionId: string }> {
    try {
      const startInterview = httpsCallable(functions, 'startAIInterview');
      const result = await startInterview({
        interviewId,
        applicationId,
        jobId,
      });

      const data = result.data as { success: boolean; message: string; sessionId: string };
      
      if (!data.success) {
        throw new Error('Failed to start AI interview');
      }

      return {
        message: data.message,
        sessionId: data.sessionId,
      };
    } catch (error) {
      console.error('Error starting AI interview:', error);
      throw error;
    }
  },

  /**
   * Send candidate message and get AI response
   */
  async sendMessage(
    interviewId: string,
    message: string
  ): Promise<{ message: string; questionNumber: number; isComplete: boolean }> {
    try {
      const sendMessage = httpsCallable(functions, 'sendInterviewMessage');
      const result = await sendMessage({
        interviewId,
        message,
      });

      const data = result.data as {
        success: boolean;
        message: string;
        questionNumber: number;
        isComplete: boolean;
      };

      if (!data.success) {
        throw new Error('Failed to send message');
      }

      return {
        message: data.message,
        questionNumber: data.questionNumber,
        isComplete: data.isComplete,
      };
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  },

  /**
   * Generate final evaluation after interview completion
   */
  async generateEvaluation(interviewId: string): Promise<AIEvaluation> {
    try {
      const generateEval = httpsCallable(functions, 'generateInterviewEvaluation');
      const result = await generateEval({ interviewId });

      const data = result.data as { success: boolean; evaluation: AIEvaluation };

      if (!data.success) {
        throw new Error('Failed to generate evaluation');
      }

      return data.evaluation;
    } catch (error) {
      console.error('Error generating evaluation:', error);
      throw error;
    }
  },

  /**
   * Subscribe to interview messages in real-time
   */
  subscribeToInterviewMessages(
    interviewId: string,
    callback: (messages: AIInterviewMessage[]) => void
  ): () => void {
    const interviewRef = doc(db, 'interviews', interviewId);

    return onSnapshot(interviewRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const messages = (data.messages || []).map((msg: any) => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp instanceof Timestamp 
            ? msg.timestamp.toDate() 
            : new Date(msg.timestamp),
          questionNumber: msg.questionNumber,
        }));
        callback(messages);
      }
    });
  },

  /**
   * Handle interview timeout/disconnect
   */
  async handleTimeout(interviewId: string): Promise<void> {
    try {
      const handleTimeout = httpsCallable(functions, 'handleInterviewTimeout');
      await handleTimeout({ interviewId });
    } catch (error) {
      console.error('Error handling timeout:', error);
      throw error;
    }
  },

  /**
   * Get interview status
   */
  subscribeToInterviewStatus(
    interviewId: string,
    callback: (status: string, session?: AIInterviewSession) => void
  ): () => void {
    const interviewRef = doc(db, 'interviews', interviewId);

    return onSnapshot(interviewRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        callback(data.status, data.aiInterviewSession);
      }
    });
  },
};
