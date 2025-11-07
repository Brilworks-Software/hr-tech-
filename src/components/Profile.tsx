import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, FileText, Users, AlertCircle, CheckCircle, Save, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { userService, UserProfile } from '../services/userService';

const COMPANY_SIZE_OPTIONS = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-500', label: '201-500 employees' },
  { value: '501-1000', label: '501-1000 employees' },
  { value: '1000+', label: '1000+ employees' },
];

export default function Profile() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState({
    companyWebsite: '',
    companyBio: '',
    companySize: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const fetchProfile = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      const userProfile = await userService.getUserProfile(currentUser.uid);

      if (userProfile) {
        setProfile(userProfile);
        setFormData({
          companyWebsite: userProfile.companyWebsite,
          companyBio: userProfile.companyBio,
          companySize: userProfile.companySize,
        });
      } else {
        setError('Profile not found. Please complete your profile setup first.');
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      const error = err as Error;
      setError(error.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (!formData.companyWebsite.trim()) {
      setError('Company website is required');
      return;
    }

    // Basic URL validation
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

    if (!currentUser || !profile) {
      setError('You must be logged in to update your profile');
      return;
    }

    try {
      setSaving(true);

      // Update profile with existing company name (not editable)
      await userService.createOrUpdateUserProfile(currentUser.uid, {
        email: currentUser.email || '',
        companyName: profile.companyName, // Keep existing name
        companyWebsite: websiteUrl,
        companyBio: formData.companyBio.trim(),
        companySize: formData.companySize,
      });

      setSuccess('Profile updated successfully!');
      
      // Refresh profile data
      await fetchProfile();

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err) {
      console.error('Error updating profile:', err);
      const error = err as Error;
      setError(error.message || 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-slate-900 mb-2">Profile Not Found</h3>
        <p className="text-slate-600 mb-6">{error || 'Please complete your profile setup first.'}</p>
        <button
          onClick={() => navigate('/dashboard?view=analytics')}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Profile Settings</h2>
          <p className="text-slate-600 mt-1">Manage your company profile information</p>
        </div>
        <button
          onClick={() => navigate('/dashboard?view=analytics')}
          className="flex items-center space-x-2 px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Dashboard</span>
        </button>
      </div>

      {/* Success Message */}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start space-x-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Profile Form */}
      <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Company Name (Read-only) */}
          <div>
            <label htmlFor="companyName" className="block text-sm font-medium text-slate-700 mb-2">
              Company Name
            </label>
            <div className="relative">
              <input
                id="companyName"
                type="text"
                value={profile.companyName}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
                readOnly
                disabled
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">Company name cannot be changed</p>
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
                rows={5}
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

          {/* Email (Read-only) */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <input
                id="email"
                type="email"
                value={profile.email}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
                readOnly
                disabled
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">Email cannot be changed</p>
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-end space-x-4 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => navigate('/dashboard?view=analytics')}
              className="px-6 py-2.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

