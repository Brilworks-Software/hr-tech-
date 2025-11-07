import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { userService } from '../services/userService';
import logoImage from '../assets/logo.png';
import { 
  Users, 
  Video, 
  Brain, 
  BarChart3, 
  Shield, 
  Zap,
  ArrowRight,
  TrendingUp,
  FileSearch
} from 'lucide-react';

export default function HomePage() {
  const { currentUser, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      if (loading) return;
      
      if (currentUser) {
        // User is logged in, check if they have profile setup
        const hasProfile = await userService.hasProfileSetup(currentUser.uid);
        if (hasProfile) {
          navigate('/dashboard');
        } else {
          navigate('/setup-profile');
        }
      }
    };

    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, loading]);
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Navigation */}
      <nav className="container mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <img 
            src={logoImage} 
            alt="HR-tech Logo" 
            className="h-10 w-auto"
          />
          <span className="text-xl font-bold text-white">HR-tech</span>
        </div>
        <div className="flex items-center space-x-4">
          <Link
            to="/login"
            className="px-4 py-2 text-blue-100 hover:text-white transition-colors"
          >
            Sign In
          </Link>
          <Link
            to="/signup"
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="container mx-auto px-6 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Text Content */}
          <div className="text-white">
            <div className="inline-flex items-center space-x-2 bg-blue-500/20 px-4 py-2 rounded-full mb-6">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-medium">AI-Powered Recruitment Platform</span>
            </div>
            <h1 className="text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Find the Perfect
              <span className="text-blue-400"> Candidate</span>
              <br />
              Faster Than Ever
            </h1>
            <p className="text-xl text-blue-100 mb-8 leading-relaxed">
              Streamline your hiring process with intelligent resume screening, video interviews, 
              and AI-powered candidate analysis. Make data-driven hiring decisions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <Link
                to="/signup"
                className="inline-flex items-center justify-center space-x-2 px-8 py-4 bg-blue-600 text-white rounded-lg font-semibold text-lg hover:bg-blue-700 transition-all"
              >
                <span>Start Free Trial</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center px-8 py-4 bg-white/10 backdrop-blur-sm text-white rounded-lg font-semibold text-lg hover:bg-white/20 transition-all border border-white/20"
              >
                Sign In
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6">
              <div>
                <div className="text-3xl font-bold text-blue-400">10K+</div>
                <div className="text-sm text-blue-200">Candidates</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-cyan-400">5K+</div>
                <div className="text-sm text-blue-200">Interviews</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-green-400">98%</div>
                <div className="text-sm text-blue-200">Accuracy</div>
              </div>
            </div>
          </div>

          {/* Right Column - Image/Illustration */}
          <div className="relative">
            <div className="relative z-10 bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 shadow-2xl">
              <div className="bg-blue-500/20 rounded-xl p-12">
                {/* Placeholder for dashboard image - You can replace this with an actual image */}
                <div className="space-y-4">
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6">
                    <div className="flex items-center space-x-3 mb-4">
                      <BarChart3 className="w-6 h-6 text-blue-400" />
                      <div className="h-4 bg-blue-400/30 rounded w-32"></div>
                    </div>
                    <div className="h-32 bg-blue-400/20 rounded-lg"></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4">
                      <Users className="w-5 h-5 text-cyan-400 mb-2" />
                      <div className="h-2 bg-cyan-400/30 rounded w-full mb-2"></div>
                      <div className="h-2 bg-cyan-400/30 rounded w-3/4"></div>
                    </div>
                    <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4">
                      <Video className="w-5 h-5 text-green-400 mb-2" />
                      <div className="h-2 bg-green-400/30 rounded w-full mb-2"></div>
                      <div className="h-2 bg-green-400/30 rounded w-3/4"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Decorative elements */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-blue-500/30 rounded-full blur-2xl"></div>
            <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-cyan-500/30 rounded-full blur-2xl"></div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">
            Everything You Need to Hire Smart
          </h2>
          <p className="text-xl text-blue-200 max-w-2xl mx-auto">
            Powerful tools designed to make your recruitment process faster, smarter, and more efficient
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all">
            <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
              <FileSearch className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">AI Resume Screening</h3>
            <p className="text-blue-200">
              Automatically analyze resumes, match skills, and rank candidates based on job requirements.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all">
            <div className="w-12 h-12 bg-cyan-500/20 rounded-lg flex items-center justify-center mb-4">
              <Video className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Video Interviews</h3>
            <p className="text-blue-200">
              Conduct live video interviews with real-time AI analysis of candidate behavior and responses.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all">
            <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mb-4">
              <Brain className="w-6 h-6 text-green-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Behavioral Analysis</h3>
            <p className="text-blue-200">
              Get insights into candidate confidence, communication skills, and cultural fit.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all">
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Analytics Dashboard</h3>
            <p className="text-blue-200">
              Track hiring metrics, interview performance, and candidate pipeline in real-time.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all">
            <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-yellow-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Fraud Detection</h3>
            <p className="text-blue-200">
              Advanced AI detects cheating attempts and ensures interview integrity.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all">
            <div className="w-12 h-12 bg-pink-500/20 rounded-lg flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-pink-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Candidate Management</h3>
            <p className="text-blue-200">
              Organize candidates, manage applications, and streamline your hiring workflow.
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-6 py-20">
        <div className="bg-blue-600 rounded-2xl p-12 text-center shadow-2xl">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to Transform Your Hiring Process?
          </h2>
          <p className="text-xl text-blue-50 mb-8 max-w-2xl mx-auto">
            Join thousands of companies using AI to find the best talent faster
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center space-x-2 px-8 py-4 bg-white text-blue-600 rounded-lg font-semibold text-lg hover:shadow-2xl transition-all"
          >
            <span>Get Started for Free</span>
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <img 
                src={logoImage} 
                alt="HR-tech Logo" 
                className="h-8 w-auto"
              />
              <span className="text-lg font-bold text-white">HR-tech</span>
            </div>
            <div className="text-blue-200 text-sm">
              © 2024 HR-tech. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

