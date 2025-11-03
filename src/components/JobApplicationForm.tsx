import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Briefcase,
  User,
  Mail,
  Phone,
  FileText,
  Upload,
  CheckCircle,
  AlertCircle,
  MapPin,
  Clock,
  DollarSign,
  ArrowLeft,
} from 'lucide-react';
import { jobService } from '../services/jobService';
import { candidateService } from '../services/candidateService';
import { applicationService } from '../services/applicationService';
import { storageService } from '../services/storageService';
import { Job } from '../lib/firebase';

export default function JobApplicationForm() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    resumeText: '',
  });

  const fetchJob = useCallback(async () => {
    if (!jobId) return;

    try {
      setLoading(true);
      const jobData = await jobService.getPublicJobById(jobId);
      
      if (jobData) {
        setJob(jobData);
      } else {
        setError('Job not found or is no longer accepting applications.');
      }
    } catch {
      setError('Error loading job details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    if (jobId) {
      fetchJob();
    }
  }, [jobId, fetchJob]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        setError('Resume file size must be less than 5MB');
        return;
      }
      if (!file.type.includes('pdf') && !file.type.includes('doc') && !file.type.includes('docx')) {
        setError('Please upload a PDF or Word document');
        return;
      }
      setResumeFile(file);
      setError('');
    }
  };

  const extractResumeText = async (): Promise<string> => {
    // For now, return empty string - in production, you'd parse PDF/DOC files
    // You could use libraries like pdf-parse or mammoth for text extraction
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    if (!jobId) {
      setError('Invalid job ID');
      setSubmitting(false);
      return;
    }

    try {
      // Validate form
      if (!formData.name || !formData.email) {
        setError('Please fill in all required fields');
        setSubmitting(false);
        return;
      }

      // Upload resume if provided
      let resumeUrl: string | null = null;
      let resumeText = formData.resumeText;

      if (resumeFile) {
        // Create a temporary candidate ID for storage path
        const tempCandidateId = `temp_${Date.now()}`;
        resumeUrl = await storageService.uploadResume(resumeFile, tempCandidateId);
        
        // Extract text from resume if possible
        resumeText = await extractResumeText();
      }

      // Create or get candidate
      let candidateId: string;
      try {
        // Try to get existing candidate by email
        const existingCandidate = await candidateService.getCandidateByEmail(formData.email);
        if (existingCandidate) {
          candidateId = existingCandidate.id;
          // Update candidate with new resume if provided
          if (resumeUrl) {
            await candidateService.updateCandidate(candidateId, {
              name: formData.name,
              phone: formData.phone,
              resumeUrl,
              resumeText: resumeText || formData.resumeText,
            });
          }
        } else {
          // Create new candidate
          candidateId = await candidateService.createCandidate({
            email: formData.email,
            name: formData.name,
            phone: formData.phone,
            resumeUrl,
            resumeText: resumeText || formData.resumeText,
          });
        }
      } catch {
        // If candidate creation fails, try to create anyway
        candidateId = await candidateService.createCandidate({
          email: formData.email,
          name: formData.name,
          phone: formData.phone,
          resumeUrl,
          resumeText: resumeText || formData.resumeText,
        });
      }

      // Create application
      await applicationService.createApplication({
        jobId,
        candidateId,
        status: 'pending',
      });

      setSuccess(true);
      setTimeout(() => {
        navigate('/');
      }, 3000);
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Job Not Found</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-lg hover:shadow-lg transition-all"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Application Submitted!</h2>
          <p className="text-slate-600 mb-6">
            Thank you for applying. We'll review your application and get back to you soon.
          </p>
          <p className="text-sm text-slate-500">Redirecting to home page...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/')}
          className="mb-6 flex items-center space-x-2 text-white hover:text-blue-300 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Home</span>
        </button>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Job Details Header */}
          {job && (
            <div className="bg-gradient-to-r from-blue-600 to-cyan-500 p-8 text-white">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                  <Briefcase className="w-8 h-8" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">{job.title}</h1>
                  <p className="text-blue-100 mt-1">Apply Now</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                {job.requirements?.location && (
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-5 h-5" />
                    <span>{job.requirements.location}</span>
                  </div>
                )}
                {job.requirements?.experience && (
                  <div className="flex items-center space-x-2">
                    <Clock className="w-5 h-5" />
                    <span>{job.requirements.experience}</span>
                  </div>
                )}
                {job.requirements?.salary && (
                  <div className="flex items-center space-x-2">
                    <DollarSign className="w-5 h-5" />
                    <span>{job.requirements.salary}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Application Form */}
          <div className="p-8">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-2">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                      id="name"
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      placeholder="John Doe"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                      id="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      placeholder="john@example.com"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-2">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="resume" className="block text-sm font-medium text-slate-700 mb-2">
                  Resume/CV (PDF or Word Document)
                </label>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 hover:border-blue-400 transition-colors">
                  <input
                    id="resume"
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="resume"
                    className="cursor-pointer flex flex-col items-center space-y-2"
                  >
                    <Upload className="w-8 h-8 text-slate-400" />
                    <span className="text-sm text-slate-600">
                      {resumeFile ? resumeFile.name : 'Click to upload or drag and drop'}
                    </span>
                    <span className="text-xs text-slate-500">PDF, DOC, DOCX (Max 5MB)</span>
                  </label>
                </div>
                {resumeFile && (
                  <div className="mt-2 flex items-center space-x-2 text-sm text-green-600">
                    <FileText className="w-4 h-4" />
                    <span>{resumeFile.name}</span>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="resumeText" className="block text-sm font-medium text-slate-700 mb-2">
                  Additional Information / Resume Text
                </label>
                <textarea
                  id="resumeText"
                  rows={6}
                  value={formData.resumeText}
                  onChange={(e) => setFormData({ ...formData, resumeText: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Paste your resume text or add any additional information here..."
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Your application will be reviewed by our HR team. We'll contact you via email
                  if you're selected for the next round.
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-lg font-bold rounded-lg hover:shadow-xl hover:shadow-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting Application...' : 'Submit Application'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

