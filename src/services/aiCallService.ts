import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db, AICall } from '../lib/firebase';

const AI_CALLS_COLLECTION = 'aiCalls';

export const aiCallService = {
  /**
   * Get AI call by application ID
   */
  async getAICallByApplicationId(applicationId: string): Promise<AICall | null> {
    try {
      const q = query(
        collection(db, AI_CALLS_COLLECTION),
        where('applicationId', '==', applicationId)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }

      // Get the first matching document (there should only be one per application)
      const doc = querySnapshot.docs[0];
      const data = doc.data();

      return {
        id: doc.id,
        applicationId: data.applicationId,
        candidateId: data.candidateId,
        candidateName: data.candidateName,
        phone: data.phone,
        status: data.status,
        callStatus: data.callStatus || data.lastStatus,
        lastStatus: data.lastStatus,
        provider: data.provider,
        twilioCallSid: data.twilioCallSid,
        wsBase: data.wsBase,
        currentQuestionIndex: data.currentQuestionIndex,
        completedAt: data.completedAt,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt),
        logs: data.logs || [],
        questionsAnswers: data.questionsAnswers || [],
        transcript: data.transcript || [],
      };
    } catch (error) {
      console.error('Error fetching AI call:', error);
      throw error;
    }
  },

  /**
   * Get all AI calls for a candidate
   */
  async getAICallsByCandidateId(candidateId: string): Promise<AICall[]> {
    try {
      const q = query(
        collection(db, AI_CALLS_COLLECTION),
        where('candidateId', '==', candidateId)
      );
      
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          applicationId: data.applicationId,
          candidateId: data.candidateId,
          candidateName: data.candidateName,
          phone: data.phone,
          status: data.status,
          callStatus: data.callStatus || data.lastStatus,
          lastStatus: data.lastStatus,
          provider: data.provider,
          twilioCallSid: data.twilioCallSid,
          wsBase: data.wsBase,
          currentQuestionIndex: data.currentQuestionIndex,
          completedAt: data.completedAt,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt),
          logs: data.logs || [],
          questionsAnswers: data.questionsAnswers || [],
          transcript: data.transcript || [],
        };
      });
    } catch (error) {
      console.error('Error fetching AI calls:', error);
      throw error;
    }
  },
};
