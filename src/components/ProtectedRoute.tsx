import { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { userService } from '../services/userService';

interface ProtectedRouteProps {
  children: ReactNode;
  requireProfile?: boolean;
}

export default function ProtectedRoute({ children, requireProfile = false }: ProtectedRouteProps) {
  const { currentUser, loading } = useAuth();
  const [checkingProfile, setCheckingProfile] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    const checkProfile = async () => {
      if (currentUser && requireProfile) {
        setCheckingProfile(true);
        const profileExists = await userService.hasProfileSetup(currentUser.uid);
        setHasProfile(profileExists);
        setCheckingProfile(false);
      }
    };

    checkProfile();
  }, [currentUser, requireProfile]);

  if (loading || checkingProfile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // If profile is required but doesn't exist, redirect to setup
  if (requireProfile && !hasProfile) {
    return <Navigate to="/setup-profile" replace />;
  }

  return <>{children}</>;
}

