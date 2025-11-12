import { useState, useEffect, useRef } from 'react';
import { BarChart3, TrendingUp, Users, Briefcase, Award, Brain, Eye, AlertTriangle, ChevronDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { analyticsService } from '../services/analyticsService';
import { jobService } from '../services/jobService';
import { applicationService } from '../services/applicationService';
import { interviewService } from '../services/interviewService';
import { Job, Application, Interview } from '../lib/firebase';

export default function AnalyticsView() {
  const { currentUser } = useAuth();
  const [, setStats] = useState({
    totalJobs: 0,
    activeJobs: 0,
    totalApplications: 0,
    totalCandidates: 0,
    totalInterviews: 0,
  });
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [jobFilter, setJobFilter] = useState('all');
  const [showJobDropdown, setShowJobDropdown] = useState(false);
  const jobDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentUser) {
      fetchAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    // Fetch jobs
    const unsubscribeJobs = jobService.subscribeToJobs((jobsData) => {
      setJobs(jobsData);
    }, currentUser.uid);

    // Fetch applications
    const unsubscribeApps = applicationService.subscribeToApplications((appsData) => {
      setApplications(appsData);
    }, currentUser.uid);

    // Fetch interviews
    const unsubscribeInterviews = interviewService.subscribeToInterviews((interviewsData) => {
      setInterviews(interviewsData);
    }, currentUser.uid);

    return () => {
      unsubscribeJobs();
      unsubscribeApps();
      unsubscribeInterviews();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (jobDropdownRef.current && !jobDropdownRef.current.contains(event.target as Node)) {
        setShowJobDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchAnalytics = async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      const analyticsData = await analyticsService.getAnalyticsStats(currentUser.uid);
      setStats(analyticsData);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };


  // Calculate filtered stats
  const getFilteredStats = () => {
    let filteredApplications = applications;
    let filteredInterviews = interviews;

    // Filter by job if selected
    if (jobFilter !== 'all') {
      filteredApplications = applications.filter(app => app.jobId === jobFilter);
      // Get application IDs for the filtered applications
      const filteredAppIds = new Set(filteredApplications.map(app => app.id));
      filteredInterviews = interviews.filter(interview => filteredAppIds.has(interview.applicationId));
    }

    // Get unique candidate IDs from filtered applications
    const candidateIds = new Set<string>();
    filteredApplications.forEach((app) => {
      if (app.candidateId) {
        candidateIds.add(app.candidateId);
      }
    });

    const filteredJobs = jobFilter === 'all' ? jobs : jobs.filter(job => job.id === jobFilter);
    const activeFilteredJobs = filteredJobs.filter(job => job.status === 'active');

    return {
      totalJobs: filteredJobs.length,
      activeJobs: activeFilteredJobs.length,
      totalApplications: filteredApplications.length,
      totalCandidates: candidateIds.size,
      totalInterviews: filteredInterviews.length,
    };
  };

  const filteredStats = getFilteredStats();

  const jobOptions = [
    { value: 'all', label: 'All Jobs' },
    ...jobs.map(job => ({ 
      value: job.id, 
      label: `${job.title} (${job.status})` 
    })),
  ];

  const getJobLabel = (jobId: string) => {
    if (jobId === 'all') return 'All Jobs';
    const job = jobs.find(j => j.id === jobId);
    return job ? `${job.title} (${job.status})` : 'All Jobs';
  };

  const statCards = [
    {
      title: 'Total Jobs',
      value: filteredStats.totalJobs,
      subtitle: `${filteredStats.activeJobs} active`,
      icon: Briefcase,
      color: 'bg-blue-500',
    },
    {
      title: 'Applications',
      value: filteredStats.totalApplications,
      subtitle: 'Total received',
      icon: BarChart3,
      color: 'bg-purple-500',
    },
    {
      title: 'Candidates',
      value: filteredStats.totalCandidates,
      subtitle: 'In database',
      icon: Users,
      color: 'bg-green-500',
    },
    {
      title: 'Interviews',
      value: filteredStats.totalInterviews,
      subtitle: 'Conducted',
      icon: Eye,
      color: 'bg-orange-500',
    },
  ];

  const aiMetrics = [
    {
      title: 'Resume Screening',
      subtitle: 'AI-powered analysis',
      icon: Award,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Interview Analysis',
      subtitle: 'Emotion detection',
      icon: Brain,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-50',
    },
    {
      title: 'Integrity Monitoring',
      subtitle: 'Cheating detection',
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    {
      title: 'Success Rate',
      subtitle: 'Overall performance',
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-blue-600 rounded-2xl p-8 text-white">
        <h2 className="text-3xl font-bold mb-2">Recruitment Analytics Dashboard</h2>
        <p className="text-blue-100 text-lg">
          AI-powered insights to optimize your hiring process and make data-driven decisions
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <div className="relative" ref={jobDropdownRef}>
          <button
            type="button"
            onClick={() => setShowJobDropdown(!showJobDropdown)}
            className="flex items-center space-x-2 px-4 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors bg-white"
          >
            <Briefcase className="w-4 h-4 text-slate-600" />
            <span className="text-slate-700 font-medium">{getJobLabel(jobFilter)}</span>
            <ChevronDown className={`w-4 h-4 text-slate-600 transition-transform ${showJobDropdown ? 'rotate-180' : ''}`} />
          </button>
          {showJobDropdown && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden max-h-64 overflow-y-auto">
              {jobOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setJobFilter(option.value);
                    setShowJobDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors ${
                    jobFilter === option.value
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-slate-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-4">Overview Metrics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {statCards.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={index}
                    className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div
                        className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center`}
                      >
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <p className="text-4xl font-bold text-slate-900 mb-1">{stat.value}</p>
                    <p className="text-sm font-medium text-slate-900">{stat.title}</p>
                    <p className="text-sm text-slate-600">{stat.subtitle}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-4">AI Capabilities</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {aiMetrics.map((metric, index) => {
                const Icon = metric.icon;
                return (
                  <div
                    key={index}
                    className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-shadow"
                  >
                    <div className={`w-12 h-12 ${metric.bgColor} rounded-lg flex items-center justify-center mb-4`}>
                      <Icon className={`w-6 h-6 ${metric.color}`} />
                    </div>
                    <p className="text-sm font-medium text-slate-900">{metric.title}</p>
                    <p className="text-sm text-slate-600">{metric.subtitle}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">AI Features</h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Resume Screening</p>
                    <p className="text-sm text-slate-600">
                      Automated analysis matches candidate skills with job requirements using NLP
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-cyan-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Brain className="w-5 h-5 text-cyan-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Sentiment Analysis</p>
                    <p className="text-sm text-slate-600">
                      Analyzes interview responses to assess candidate confidence and communication
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Eye className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Emotion Detection</p>
                    <p className="text-sm text-slate-600">
                      Real-time facial expression analysis to gauge emotional responses
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Integrity Monitoring</p>
                    <p className="text-sm text-slate-600">
                      Detects behavioral patterns that may indicate dishonesty or cheating
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Key Insights</h3>
              <div className="space-y-4">
                {filteredStats.totalApplications > 0 && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-slate-900 mb-1">Application Pipeline</p>
                    <p className="text-sm text-slate-600">
                      {filteredStats.totalApplications} applications being processed through the system
                    </p>
                  </div>
                )}
                {filteredStats.totalInterviews > 0 && (
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-slate-900 mb-1">Interview Performance</p>
                    <p className="text-sm text-slate-600">{filteredStats.totalInterviews} interviews conducted</p>
                  </div>
                )}
                {filteredStats.activeJobs > 0 && (
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-slate-900 mb-1">Active Recruiting</p>
                    <p className="text-sm text-slate-600">
                      {filteredStats.activeJobs} job{filteredStats.activeJobs !== 1 ? 's' : ''} currently accepting applications
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
