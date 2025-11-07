import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Globe, FileText, Users, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { userService } from '../services/userService';
import logoImage from '../assets/logo.png';

const COMPANY_SIZE_OPTIONS = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-500', label: '201-500 employees' },
  { value: '501-1000', label: '501-1000 employees' },
  { value: '1000+', label: '1000+ employees' },
];

export default function ProfileSetup() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    companyName: '',
    companyWebsite: '',
    companyBio: '',
    companySize: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);

  useEffect(() => {
    const checkProfile = async () => {
      if (!currentUser) {
        navigate('/login');
        return;
      }

      // Check if profile already exists
      const hasProfile = await userService.hasProfileSetup(currentUser.uid);
      if (hasProfile) {
        // Profile already set up, redirect to dashboard
        navigate('/dashboard');
        return;
      }

      setCheckingProfile(false);
    };

    checkProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.companyName.trim()) {
      setError('Company name is required');
      return;
    }

    if (!formData.companyWebsite.trim()) {
      setError('Company website is required');
      return;
    }

    // Basic URL validation - more lenient
    const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;
    let websiteUrl = formData.companyWebsite.trim();
    // Auto-add https:// if no protocol provided
    if (!websiteUrl.startsWith('http://') && !websiteUrl.startsWith('https://')) {
      websiteUrl = 'https://' + websiteUrl;
    }
    if (!urlPattern.test(websiteUrl)) {
      setError('Please enter a valid website URL');
      return;
    }

    if (!formData.companyBio.trim()) {
      setError('Company bio is required');
      return;
    }

    if (!formData.companySize) {
      setError('Company size is required');
      return;
    }

    if (!currentUser) {
      setError('You must be logged in to complete profile setup');
      return;
    }

    try {
      setLoading(true);

      // Normalize website URL
      let websiteUrl = formData.companyWebsite.trim();
      if (!websiteUrl.startsWith('http://') && !websiteUrl.startsWith('https://')) {
        websiteUrl = 'https://' + websiteUrl;
      }

      // Save profile to users collection
      await userService.createOrUpdateUserProfile(currentUser.uid, {
        email: currentUser.email || '',
        companyName: formData.companyName.trim(),
        companyWebsite: websiteUrl,
        companyBio: formData.companyBio.trim(),
        companySize: formData.companySize,
      });

      // Redirect to dashboard after successful setup
      navigate('/dashboard');
    } catch (err) {
      console.error('Error setting up profile:', err);
      const error = err as Error;
      setError(error.message || 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingProfile) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-blue-600 p-8 text-white">
          <div className="flex items-center justify-center mb-4">
            <img 
              src={logoImage} 
              alt="HR-tech Logo" 
              className="h-16 w-auto"
            />
          </div>
          <h1 className="text-3xl font-bold text-center mb-2">Complete Your Profile</h1>
          <p className="text-center text-blue-100">Set up your company information to get started</p>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Company Name */}
            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-slate-700 mb-2">
                Company Name *
              </label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  id="companyName"
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Enter your company name"
                  required
                />
              </div>
            </div>

            {/* Company Website */}
            <div>
              <label htmlFor="companyWebsite" className="block text-sm font-medium text-slate-700 mb-2">
                Company Website *
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  id="companyWebsite"
                  type="text"
                  value={formData.companyWebsite}
                  onChange={(e) => setFormData({ ...formData, companyWebsite: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="https://yourcompany.com"
                  required
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">Include https:// or http://</p>
            </div>

            {/* Company Bio */}
            <div>
              <label htmlFor="companyBio" className="block text-sm font-medium text-slate-700 mb-2">
                Company Bio *
              </label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
                <textarea
                  id="companyBio"
                  value={formData.companyBio}
                  onChange={(e) => setFormData({ ...formData, companyBio: e.target.value })}
                  rows={4}
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                  placeholder="Tell us about your company..."
                  required
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">{formData.companyBio.length} characters</p>
            </div>

            {/* Company Size */}
            <div>
              <label htmlFor="companySize" className="block text-sm font-medium text-slate-700 mb-2">
                Company Size *
              </label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5 z-10" />
                <select
                  id="companySize"
                  value={formData.companySize}
                  onChange={(e) => setFormData({ ...formData, companySize: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none bg-white"
                  required
                >
                  <option value="">Select company size</option>
                  {COMPANY_SIZE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 text-white text-lg font-bold rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Saving Profile...</span>
                </>
              ) : (
                <>
                  <span>Complete Setup</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

