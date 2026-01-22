import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import Layout from './components/Layout';
import JobsView from './components/JobsView';
import ApplicationsView from './components/ApplicationsView';
import CandidatesView from './components/CandidatesView';
import InterviewsView from './components/InterviewsView';
import AnalyticsView from './components/AnalyticsView';
import InterviewDetailsRouter from './components/InterviewDetailsRouter';
import JobApplicationForm from './components/JobApplicationForm';
import CandidateInterview from './pages/CandidateInterview';
import AIVideoInterviewRoom from './components/AIVideoInterviewRoom';
import HRDashboard from './pages/HRDashboard';
import ApplicationDetailsView from './components/ApplicationDetailsView';
import CandidateProfileView from './components/CandidateProfileView';
import JobDetailsView from './components/JobDetailsView';
import HomePage from './components/HomePage';
import Login from './components/Login';
import SignUp from './components/SignUp';
import ProfileSetup from './components/ProfileSetup';
import Profile from './components/Profile';
import ProtectedRoute from './components/ProtectedRoute';

function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get('view') || 'analytics';
  const [currentView, setCurrentView] = useState(viewParam);

  useEffect(() => {
    // Update view when URL param changes (e.g., browser back/forward)
    const newViewParam = searchParams.get('view') || 'analytics';
    if (newViewParam !== currentView) {
      setCurrentView(newViewParam);
    }
  }, [searchParams, currentView]);

  const handleNavigate = (view: string) => {
    if (view !== currentView) {
      setCurrentView(view);
      setSearchParams({ view }, { replace: true });
    }
  };

  // Memoize view components to prevent unnecessary remounts
  const viewComponent = useMemo(() => {
    switch (currentView) {
      case 'jobs':
        return <JobsView key="jobs" />;
      case 'applications':
        return <ApplicationsView key="applications" />;
      case 'candidates':
        return <CandidatesView key="candidates" />;
      case 'interviews':
        return <InterviewsView key="interviews" />;
      case 'analytics':
        return <AnalyticsView key="analytics" />;
      default:
        return <AnalyticsView key="analytics" />;
    }
  }, [currentView]);

  return <Layout currentView={currentView} onNavigate={handleNavigate}>{viewComponent}</Layout>;
}


// Wrapper component for detail pages that need Layout with navigation
function DetailLayoutWrapper({ currentView, children }: { currentView: string; children: React.ReactNode }) {
  const navigate = useNavigate();

  const handleNavigate = (view: string) => {
    if (view !== currentView) {
      // Navigate to dashboard with the selected view
      navigate(`/dashboard?view=${view}`);
    }
  };

  return (
    <Layout currentView={currentView} onNavigate={handleNavigate}>
      {children}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route
            path="/setup-profile"
            element={
              <ProtectedRoute>
                <ProfileSetup />
              </ProtectedRoute>
            }
          />
          <Route path="/apply/:jobId" element={<JobApplicationForm />} />
          <Route path="/interview/:interviewId" element={<CandidateInterview />} />
          <Route path="/ai-video-interview/:interviewId" element={<AIVideoInterviewRoom />} />
            <Route path="/video-call/:interviewId" element={<CandidateInterview />} />
          <Route
            path="/interview/:interviewId/hr"
            element={
              <ProtectedRoute>
                <HRDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/interviews/:interviewId"
            element={
              <ProtectedRoute>
                <DetailLayoutWrapper currentView="interviews">
                  <InterviewDetailsRouter />
                </DetailLayoutWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            path="/applications/:applicationId"
            element={
              <ProtectedRoute>
                <DetailLayoutWrapper currentView="applications">
                  <ApplicationDetailsView />
                </DetailLayoutWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            path="/candidates/:candidateId"
            element={
              <ProtectedRoute>
                <DetailLayoutWrapper currentView="candidates">
                  <CandidateProfileView />
                </DetailLayoutWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            path="/jobs/:jobId"
            element={
              <ProtectedRoute>
                <DetailLayoutWrapper currentView="jobs">
                  <JobDetailsView />
                </DetailLayoutWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute requireProfile={true}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute requireProfile={true}>
                <DetailLayoutWrapper currentView="profile">
                  <Profile />
                </DetailLayoutWrapper>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
      </ToastProvider>
    </AuthProvider>
  );
}
