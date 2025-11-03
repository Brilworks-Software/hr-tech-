import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export interface AnalyticsStats {
  totalJobs: number;
  activeJobs: number;
  totalApplications: number;
  totalCandidates: number;
  totalInterviews: number;
}

export const analyticsService = {
  /**
   * Fetch analytics statistics
   */
  async getAnalyticsStats(): Promise<AnalyticsStats> {
    const [jobsSnapshot, applicationsSnapshot, candidatesSnapshot, interviewsSnapshot] = await Promise.all([
      getDocs(collection(db, 'jobs')),
      getDocs(collection(db, 'applications')),
      getDocs(collection(db, 'candidates')),
      getDocs(collection(db, 'interviews')),
    ]);

    const totalJobs = jobsSnapshot.size;
    const activeJobs = jobsSnapshot.docs.filter((doc) => doc.data().status === 'active').length;
    const totalApplications = applicationsSnapshot.size;
    const totalCandidates = candidatesSnapshot.size;
    const totalInterviews = interviewsSnapshot.size;

    return {
      totalJobs,
      activeJobs,
      totalApplications,
      totalCandidates,
      totalInterviews,
    };
  },
};

