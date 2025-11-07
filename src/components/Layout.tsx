import { ReactNode, useState, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Users, Video, BarChart3, FileText, Menu, X, LogOut, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import logoImage from '../assets/logo.png';

interface LayoutProps {
  children: ReactNode;
  currentView: string;
  onNavigate: (view: string) => void;
}

const Layout = memo(function Layout({ children, currentView, onNavigate }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  const navigation = [
    { name: 'Jobs', icon: Briefcase, id: 'jobs' },
    { name: 'Applications', icon: FileText, id: 'applications' },
    { name: 'Candidates', icon: Users, id: 'candidates' },
    { name: 'Interviews', icon: Video, id: 'interviews' },
    { name: 'Analytics', icon: BarChart3, id: 'analytics' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex h-screen">
        <aside
          className={`${
            sidebarOpen ? 'w-64' : 'w-20'
          } bg-slate-900 text-white transition-all duration-300 flex flex-col`}
        >
          <div className="p-6 flex items-center justify-between border-b border-slate-800">
            {sidebarOpen && (
              <div className="flex items-center space-x-3">
                <img 
                  src={logoImage} 
                  alt="HR-tech Logo" 
                  className="h-10 w-auto"
                />
                <div>
                  <h1 className="text-lg font-bold">HR-tech</h1>
                  <p className="text-xs text-slate-400">Smart Recruiting</p>
                </div>
              </div>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                    isActive
                      ? 'bg-blue-600 shadow-lg'
                      : 'hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {sidebarOpen && <span className="font-medium">{item.name}</span>}
                </button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-slate-800 space-y-2">
            <button
              onClick={() => navigate('/profile')}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors text-left"
              title="Profile"
            >
              <User className="w-5 h-5" />
              {sidebarOpen && <span className="font-medium">Profile</span>}
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors text-left"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
              {sidebarOpen && <span className="font-medium">Logout</span>}
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-auto">
          <div className="bg-white border-b border-slate-200 px-8 py-5">
            <h2 className="text-2xl font-bold text-slate-900">
              {currentView === 'profile' 
                ? 'Profile Settings' 
                : navigation.find((n) => n.id === currentView)?.name || 'Dashboard'}
            </h2>
            <p className="text-slate-600 mt-1">
              {currentView === 'profile' 
                ? 'Manage your company profile information'
                : 'Manage your recruitment process with AI-powered insights'}
            </p>
          </div>
          <div className="p-8 page-transition" style={{ minHeight: '100%' }}>{children}</div>
        </main>
      </div>
    </div>
  );
});

export default Layout;
