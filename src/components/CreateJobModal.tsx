import { useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { jobService } from '../services/jobService';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { generateJobDescription } from '../services/geminiService';

interface CreateJobModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateJobModal({ onClose, onSuccess }: CreateJobModalProps) {
  const [loading, setLoading] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    experience: '',
    salary: '',
    salaryCurrency: 'USD',
    skills: '',
    status: 'draft' as 'draft' | 'active' | 'closed',
  });

  const handleGenerateDescription = async () => {
    if (!formData.title.trim()) {
      showToast('Please enter a job title first', 'error');
      return;
    }

    // Validate that at least location, experience, or salary is provided
    if (!formData.location.trim() && !formData.experience.trim() && !formData.salary.trim()) {
      showToast('Please provide at least Location, Experience, or Salary Range to generate a better description', 'error');
      return;
    }

    setGeneratingDescription(true);
    try {
      // Prepare job details for generation
      const jobDetails = {
        title: formData.title,
        location: formData.location || undefined,
        experience: formData.experience || undefined,
        salary: formData.salary ? `${formData.salaryCurrency} ${formData.salary}` : undefined,
      };

      const generatedDescription = await generateJobDescription(jobDetails);
      setFormData({ ...formData, description: generatedDescription });
      showToast('Job description generated successfully!', 'success');
    } catch (error) {
      console.error('Error generating job description:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Provide helpful error messages
      if (errorMessage.includes('API key') || errorMessage.includes('not configured')) {
        showToast('Gemini API key is missing or invalid. Please check your .env file and restart the server.', 'error');
      } else if (errorMessage.includes('API_KEY_INVALID')) {
        showToast('Invalid Gemini API key. Please verify your API key is correct.', 'error');
      } else {
        showToast(`Failed to generate job description: ${errorMessage}`, 'error');
      }
    } finally {
      setGeneratingDescription(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Format experience with "years" if not already present
      let experienceValue = formData.experience.trim();
      if (experienceValue && !experienceValue.toLowerCase().includes('year')) {
        experienceValue = `${experienceValue} years`;
      }

      // Format salary with currency
      let salaryValue = formData.salary.trim();
      if (salaryValue) {
        const currencySymbols: { [key: string]: string } = {
          USD: '$',
          EUR: '€',
          GBP: '£',
          INR: '₹',
          CAD: 'C$',
          AUD: 'A$',
          JPY: '¥',
        };
        const symbol = currencySymbols[formData.salaryCurrency] || formData.salaryCurrency;
        // Only add currency if not already present
        if (!salaryValue.startsWith('$') && !salaryValue.startsWith('€') && 
            !salaryValue.startsWith('£') && !salaryValue.startsWith('₹') &&
            !salaryValue.startsWith('C$') && !salaryValue.startsWith('A$') &&
            !salaryValue.startsWith('¥')) {
          salaryValue = `${symbol}${salaryValue}`;
        }
      }

      const requirements = {
        location: formData.location,
        experience: experienceValue,
        salary: salaryValue,
        skills: formData.skills.split(',').map((s) => s.trim()).filter(Boolean),
      };

      await jobService.createJob({
        title: formData.title,
        description: formData.description,
        requirements,
        status: formData.status,
        createdBy: currentUser?.uid || null,
      });

      setLoading(false);
      onSuccess();
    } catch (error) {
      setLoading(false);
      const err = error as Error;
      showToast('Error creating job: ' + err.message, 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">Post New Job</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Job Title *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Senior Software Engineer"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Location
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., San Francisco, CA"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Experience
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.experience}
                  onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                  className="w-full px-4 py-2.5 pr-16 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 3-5"
                />
                <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-500 text-sm pointer-events-none">
                  years
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Salary Range
            </label>
            <div className="flex gap-2">
              <select
                value={formData.salaryCurrency}
                onChange={(e) => setFormData({ ...formData, salaryCurrency: e.target.value })}
                className="px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="INR">INR (₹)</option>
                <option value="CAD">CAD (C$)</option>
                <option value="AUD">AUD (A$)</option>
                <option value="JPY">JPY (¥)</option>
              </select>
              <input
                type="text"
                value={formData.salary}
                onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 120k - 160k"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-slate-900">
                Job Description *
              </label>
              <button
                type="button"
                onClick={handleGenerateDescription}
                disabled={generatingDescription || !formData.title.trim()}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Fill in Job Title, Location, Experience, and Salary Range for better results"
              >
                <Sparkles className="w-4 h-4" />
                {generatingDescription ? 'Generating...' : 'Generate with AI'}
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-2">
              Tip: Fill in Location, Experience, and Salary Range above before generating for more accurate results
            </p>
            <textarea
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={8}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Provide a detailed description of the role, responsibilities, and requirements... Or click 'Generate with AI' to auto-generate based on job details."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Required Skills
            </label>
            <input
              type="text"
              value={formData.skills}
              onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., React, TypeScript, Node.js (comma-separated)"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'draft' | 'active' | 'closed' })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Post Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
