import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, Briefcase, Award, Brain, Eye, AlertTriangle } from 'lucide-react';
import { analyticsService } from '../services/analyticsService';

export default function AnalyticsView() {
  const [stats, setStats] = useState({
    totalJobs: 0,
    activeJobs: 0,
    totalApplications: 0,
    totalCandidates: 0,
    totalInterviews: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const analyticsData = await analyticsService.getAnalyticsStats();
      setStats(analyticsData);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Jobs',
      value: stats.totalJobs,
      subtitle: `${stats.activeJobs} active`,
      icon: Briefcase,
      color: 'from-blue-500 to-cyan-400',
    },
    {
      title: 'Applications',
      value: stats.totalApplications,
      subtitle: 'Total received',
      icon: BarChart3,
      color: 'from-purple-500 to-pink-400',
    },
    {
      title: 'Candidates',
      value: stats.totalCandidates,
      subtitle: 'In database',
      icon: Users,
      color: 'from-green-500 to-emerald-400',
    },
    {
      title: 'Interviews',
      value: stats.totalInterviews,
      subtitle: 'Conducted',
      icon: Eye,
      color: 'from-orange-500 to-yellow-400',
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
      <div className="bg-gradient-to-br from-blue-600 via-cyan-500 to-teal-400 rounded-2xl p-8 text-white">
        <h2 className="text-3xl font-bold mb-2">Recruitment Analytics Dashboard</h2>
        <p className="text-blue-100 text-lg">
          AI-powered insights to optimize your hiring process and make data-driven decisions
        </p>
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
                        className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-lg flex items-center justify-center`}
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
                {stats.totalApplications > 0 && (
                  <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-slate-900 mb-1">Application Pipeline</p>
                    <p className="text-sm text-slate-600">
                      {stats.totalApplications} applications being processed through the system
                    </p>
                  </div>
                )}
                {stats.totalInterviews > 0 && (
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-slate-900 mb-1">Interview Performance</p>
                    <p className="text-sm text-slate-600">{stats.totalInterviews} interviews conducted</p>
                  </div>
                )}
                {stats.activeJobs > 0 && (
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-slate-900 mb-1">Active Recruiting</p>
                    <p className="text-sm text-slate-600">
                      {stats.activeJobs} job{stats.activeJobs !== 1 ? 's' : ''} currently accepting applications
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
