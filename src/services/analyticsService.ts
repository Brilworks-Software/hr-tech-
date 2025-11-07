import { db } from '../lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

export interface AnalyticsStats {
  totalJobs: number;
  activeJobs: number;
  totalApplications: number;
  totalCandidates: number;
  totalInterviews: number;
}

export const analyticsService = {
  /**
   * Fetch analytics statistics for a specific user
   */
  async getAnalyticsStats(userId: string): Promise<AnalyticsStats> {
    if (!userId) {
      return {
        totalJobs: 0,
        activeJobs: 0,
        totalApplications: 0,
        totalCandidates: 0,
        totalInterviews: 0,
      };
    }

    // Get all jobs created by this user
    const jobsQuery = query(collection(db, 'jobs'), where('createdBy', '==', userId));
    const jobsSnapshot = await getDocs(jobsQuery);
    const userJobIds = jobsSnapshot.docs.map((doc) => doc.id);

    const totalJobs = jobsSnapshot.size;
    const activeJobs = jobsSnapshot.docs.filter((doc) => doc.data().status === 'active').length;

    // If user has no jobs, return early with zero stats
    if (userJobIds.length === 0) {
      return {
        totalJobs: 0,
        activeJobs: 0,
        totalApplications: 0,
        totalCandidates: 0,
        totalInterviews: 0,
      };
    }

    // Get all applications for user's jobs
    const applicationsSnapshot = await getDocs(collection(db, 'applications'));
    const userApplications = applicationsSnapshot.docs.filter((doc) =>
      userJobIds.includes(doc.data().jobId)
    );
    const totalApplications = userApplications.length;

    // Get unique candidate IDs from user's applications
    const candidateIds = new Set<string>();
    userApplications.forEach((appDoc) => {
      const candidateId = appDoc.data().candidateId;
      if (candidateId) {
        candidateIds.add(candidateId);
      }
    });
    const totalCandidates = candidateIds.size;

    // Get all interviews for user's applications
    const applicationIds = userApplications.map((doc) => doc.id);
    const interviewsSnapshot = await getDocs(collection(db, 'interviews'));
    const userInterviews = interviewsSnapshot.docs.filter((doc) =>
      applicationIds.includes(doc.data().applicationId)
    );
    const totalInterviews = userInterviews.length;

    return {
      totalJobs,
      activeJobs,
      totalApplications,
      totalCandidates,
      totalInterviews,
    };
  },
};

