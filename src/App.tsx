import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import JobsView from './components/JobsView';
import ApplicationsView from './components/ApplicationsView';
import CandidatesView from './components/CandidatesView';
import InterviewsView from './components/InterviewsView';
import AnalyticsView from './components/AnalyticsView';
import InterviewPage from './components/InterviewPage';
import JobApplicationForm from './components/JobApplicationForm';
import Login from './components/Login';
import SignUp from './components/SignUp';
import ProtectedRoute from './components/ProtectedRoute';

function Dashboard() {
  const [currentView, setCurrentView] = useState('analytics');

  const renderView = () => {
    switch (currentView) {
      case 'jobs':
        return <JobsView />;
      case 'applications':
        return <ApplicationsView />;
      case 'candidates':
        return <CandidatesView />;
      case 'interviews':
        return <InterviewsView />;
      case 'analytics':
        return <AnalyticsView />;
      default:
        return <AnalyticsView />;
    }
  };

  return <Layout currentView={currentView} onNavigate={setCurrentView}>{renderView()}</Layout>;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/apply/:jobId" element={<JobApplicationForm />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/interview/:interviewId"
            element={
              <ProtectedRoute>
                <InterviewPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
