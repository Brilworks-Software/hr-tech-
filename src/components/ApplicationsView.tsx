import { useState, useEffect } from 'react';
import { Search, FileText, Calendar, TrendingUp, CheckCircle, XCircle, Clock, Video } from 'lucide-react';
import { Application } from '../lib/firebase';
import { applicationService } from '../services/applicationService';
import { candidateService } from '../services/candidateService';
import { jobService } from '../services/jobService';
import ScheduleInterviewModal from './ScheduleInterviewModal';

export default function ApplicationsView() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [scheduleData, setScheduleData] = useState<{
    candidateEmail: string;
    candidateName: string;
    jobTitle: string;
  } | null>(null);

  useEffect(() => {
    const unsubscribe = applicationService.subscribeToApplications((appsData) => {
      setApplications(appsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'hired':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'interview':
        return <Calendar className="w-5 h-5 text-blue-600" />;
      case 'screening':
        return <TrendingUp className="w-5 h-5 text-yellow-600" />;
      default:
        return <Clock className="w-5 h-5 text-slate-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'hired':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'interview':
        return 'bg-blue-100 text-blue-800';
      case 'screening':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const filteredApplications = applications.filter((app) => {
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    return matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search applications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="screening">Screening</option>
            <option value="interview">Interview</option>
            <option value="rejected">Rejected</option>
            <option value="hired">Hired</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {['pending', 'screening', 'interview', 'hired'].map((status) => {
          const count = applications.filter((app) => app.status === status).length;
          return (
            <div key={status} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-600 capitalize">{status}</span>
                {getStatusIcon(status)}
              </div>
              <p className="text-3xl font-bold text-slate-900">{count}</p>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredApplications.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-300">
          <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-900 mb-2">No applications found</h3>
          <p className="text-slate-600">
            {searchTerm ? 'Try adjusting your search criteria' : 'Applications will appear here once candidates apply'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredApplications.map((app) => (
            <div
              key={app.id}
              className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg hover:border-blue-300 transition-all relative"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4 flex-1">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    A
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-bold text-slate-900">Application #{app.id.substring(0, 8)}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(app.status)}`}>
                        {app.status}
                      </span>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-slate-600 mb-3">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1.5" />
                        {app.appliedAt.toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  {app.status !== 'rejected' && app.status !== 'hired' && (
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        if (loadingSchedule) return;
                        
                        try {
                          setLoadingSchedule(true);
                          setSelectedApplication(app);
                          
                          // Fetch candidate and job details
                          const [candidate, job] = await Promise.all([
                            candidateService.getCandidateById(app.candidateId),
                            jobService.getJobById(app.jobId),
                          ]);
                          
                          if (!candidate) {
                            alert('Candidate not found. The candidate may have been deleted.');
                            setLoadingSchedule(false);
                            return;
                          }
                          
                          if (!job) {
                            alert('Job not found. The job may have been deleted.');
                            setLoadingSchedule(false);
                            return;
                          }
                          
                          setScheduleData({
                            candidateEmail: candidate.email,
                            candidateName: candidate.name,
                            jobTitle: job.title,
                          });
                          setShowScheduleModal(true);
                        } catch (error) {
                          console.error('Error loading application details:', error);
                          const err = error as Error;
                          alert(`Error loading application details: ${err.message || 'Please try again.'}`);
                        } finally {
                          setLoadingSchedule(false);
                        }
                      }}
                      disabled={loadingSchedule}
                      className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-lg hover:shadow-lg transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer z-10 relative"
                    >
                      <Video className="w-4 h-4" />
                      <span>{loadingSchedule ? 'Loading...' : 'Schedule Interview'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-lg hover:shadow-lg transition-all text-sm font-medium cursor-pointer z-10 relative"
                  >
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showScheduleModal && selectedApplication && scheduleData && (
        <ScheduleInterviewModal
          applicationId={selectedApplication.id}
          candidateEmail={scheduleData.candidateEmail}
          candidateName={scheduleData.candidateName}
          jobTitle={scheduleData.jobTitle}
          onClose={() => {
            setShowScheduleModal(false);
            setSelectedApplication(null);
            setScheduleData(null);
          }}
          onSuccess={() => {
            setShowScheduleModal(false);
            setSelectedApplication(null);
            setScheduleData(null);
            // Update application status to 'interview'
            if (selectedApplication) {
              applicationService.updateApplicationStatus(selectedApplication.id, 'interview').catch(console.error);
            }
          }}
        />
      )}
    </div>
  );
}
