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
  X,
} from 'lucide-react';
import { jobService } from '../services/jobService';
import { candidateService } from '../services/candidateService';
import { applicationService } from '../services/applicationService';
import { storageService } from '../services/storageService';
import { aiAnalysisService } from '../services/aiAnalysisService';
import { Job } from '../lib/firebase';
import * as pdfjsLib from 'pdfjs-dist';

export default function JobApplicationForm() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumePreviewUrl, setResumePreviewUrl] = useState<string | null>(null);
  const [extractingText, setExtractingText] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
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

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (resumePreviewUrl) {
        URL.revokeObjectURL(resumePreviewUrl);
      }
    };
  }, [resumePreviewUrl]);

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
      
      // Revoke old preview URL if exists
      if (resumePreviewUrl) {
        URL.revokeObjectURL(resumePreviewUrl);
      }
      
      setResumeFile(file);
      setError('');
      
      // Create preview URL for PDF files
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const url = URL.createObjectURL(file);
        setResumePreviewUrl(url);
      } else {
        setResumePreviewUrl(null);
      }
    }
  };

  const handleRemoveFile = () => {
    if (resumePreviewUrl) {
      URL.revokeObjectURL(resumePreviewUrl);
    }
    setResumeFile(null);
    setResumePreviewUrl(null);
    // Reset the file input
    const fileInput = document.getElementById('resume') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const extractResumeText = async (): Promise<string> => {
    if (!resumeFile) {
      return '';
    }

    try {
      // Only extract text from PDF files
      if (resumeFile.type === 'application/pdf' || resumeFile.name.toLowerCase().endsWith('.pdf')) {
        // Configure PDF.js worker - use worker from public folder
        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
          // Use the worker file from public folder (copied to public/pdf.worker.mjs)
          pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
        }
        
        // Read file as array buffer
        const arrayBuffer = await resumeFile.arrayBuffer();
        
        // Load PDF document
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        // Extract text from all pages
        let fullText = '';
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          // Combine all text items from the page
          const pageText = textContent.items
            .map((item) => {
              if ('str' in item && typeof item === 'object') {
                return (item as { str: string }).str;
              }
              return '';
            })
            .join(' ');
          
          fullText += pageText + '\n';
        }
        
        return fullText.trim();
      }
      
      // For Word documents, we can't extract text client-side easily
      return '';
    } catch (error) {
      console.error('Error extracting text from resume:', error);
      return '';
    }
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
      let resumeText = '';

      if (resumeFile) {
        // Extract text from resume first (before upload)
        setExtractingText(true);
        try {
          console.log('Extracting text from resume...');
          resumeText = await extractResumeText();
          console.log('Resume text extracted:', resumeText ? `${resumeText.substring(0, 100)}...` : 'No text extracted');
          
          if (!resumeText || resumeText.trim().length === 0) {
            console.warn('No text extracted from resume. AI analysis may be limited.');
          }
        } catch (extractError) {
          console.error('Error extracting resume text:', extractError);
        } finally {
          setExtractingText(false);
        }
        
        // Create a temporary candidate ID for storage path
        const tempCandidateId = `temp_${Date.now()}`;
        resumeUrl = await storageService.uploadResume(resumeFile, tempCandidateId);
      }

      // Create or get candidate
      let candidateId: string;
      try {
        // Try to get existing candidate by email
        const existingCandidate = await candidateService.getCandidateByEmail(formData.email);
        if (existingCandidate) {
          candidateId = existingCandidate.id;
          // Update candidate with new resume and extracted text if provided
          if (resumeUrl || resumeText) {
            await candidateService.updateCandidate(candidateId, {
              name: formData.name,
              phone: formData.phone,
              resumeUrl: resumeUrl || existingCandidate.resumeUrl,
              resumeText: resumeText || existingCandidate.resumeText,
            });
          }
        } else {
          // Create new candidate
          candidateId = await candidateService.createCandidate({
            email: formData.email,
            name: formData.name,
            phone: formData.phone,
            resumeUrl,
            resumeText: resumeText,
          });
        }
      } catch {
        // If candidate creation fails, try to create anyway
        candidateId = await candidateService.createCandidate({
          email: formData.email,
          name: formData.name,
          phone: formData.phone,
          resumeUrl,
          resumeText: resumeText,
        });
      }

      // Get candidate for AI analysis
      const candidate = await candidateService.getCandidateById(candidateId);
      
      // Perform AI analysis if resume text is available
      const applicationData: {
        jobId: string;
        candidateId: string;
        status: 'pending';
        matchScore?: number;
        skillsMatch?: {
          required: string[];
          found: string[];
          missing: string[];
          matchCount: number;
          totalCount: number;
        };
        keywordsFound?: string[];
        aiSummary?: string;
      } = {
        jobId,
        candidateId,
        status: 'pending',
      };

      // Perform AI analysis if candidate and resume text are available
      let finalApplicationData = { ...applicationData };
      if (candidate && candidate.resumeText && job) {
        try {
          const analysisResult = await aiAnalysisService.analyzeResumeMatch(candidate, job);
          finalApplicationData = {
            ...applicationData,
            matchScore: analysisResult.matchScore,
            skillsMatch: analysisResult.skillsMatch,
            keywordsFound: analysisResult.keywordsFound,
            aiSummary: analysisResult.summary,
          };
        } catch (analysisError) {
          console.error('Error performing AI analysis:', analysisError);
          // Continue without analysis if it fails
        }
      }

      // Create application with AI analysis
      await applicationService.createApplication(finalApplicationData);


      setSuccess(true);
      // Don't navigate away - candidates may not be logged in
      // They can close the window after seeing the success message
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Job Not Found</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Application Submitted!</h2>
          <p className="text-slate-600 mb-6">
            Thank you for applying. We'll review your application and get back to you soon.
          </p>
          <p className="text-sm text-slate-500">
            You can safely close this window. Your application has been saved.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 py-12 px-4">
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
            <div className="bg-blue-600 p-8 text-white">
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
                {!resumeFile ? (
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
                        Click to upload or drag and drop
                      </span>
                      <span className="text-xs text-slate-500">PDF, DOC, DOCX (Max 5MB)</span>
                    </label>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* File info and replace button */}
                    <div className="border border-slate-300 rounded-lg p-4 bg-slate-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <FileText className="w-5 h-5 text-blue-600" />
                          <div>
                            <p className="text-sm font-medium text-slate-700">{resumeFile.name}</p>
                            <p className="text-xs text-slate-500">
                              {(resumeFile.size / 1024).toFixed(2)} KB
                              {resumeFile.type === 'application/pdf' || resumeFile.name.toLowerCase().endsWith('.pdf') ? (
                                <span className="ml-2 text-blue-600">• Text will be extracted automatically</span>
                              ) : null}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <label
                            htmlFor="resume-replace"
                            className="cursor-pointer px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                          >
                            Replace
                          </label>
                          <input
                            id="resume-replace"
                            type="file"
                            accept=".pdf,.doc,.docx"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={handleRemoveFile}
                            className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                            title="Remove file"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* PDF Preview */}
                    {resumePreviewUrl && (
                      <div className="border border-slate-300 rounded-lg overflow-hidden">
                        <div className="bg-slate-100 px-4 py-2 border-b border-slate-300">
                          <p className="text-sm font-medium text-slate-700">Preview</p>
                        </div>
                        <div className="bg-slate-200" style={{ height: '600px' }}>
                          <iframe
                            src={resumePreviewUrl}
                            className="w-full h-full"
                            title="Resume Preview"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Your application will be reviewed by our HR team. We'll contact you via email
                  if you're selected for the next round.
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting || extractingText}
                className="w-full py-4 bg-blue-600 text-white text-lg font-bold rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {extractingText 
                  ? 'Extracting text from resume...' 
                  : submitting 
                  ? 'Submitting Application...' 
                  : 'Submit Application'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

