import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  console.error('VITE_GEMINI_API_KEY is not set in .env file');
} else {
  // Log first 10 characters to verify key is loaded (for debugging)
  console.log('Gemini API key loaded:', apiKey.substring(0, 10) + '...');
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export interface GeminiAnalysisResult {
    overallScore: number;
    skillsScore: number;
    experienceScore: number;
    qualificationsScore: number;
    analysis: string;
}

export async function analyzeWithGemini(cvText: string, jobDescription: string): Promise<GeminiAnalysisResult> {
  if (!genAI || !apiKey) {
    throw new Error('Gemini API key is not configured. Please add VITE_GEMINI_API_KEY to your .env file.');
  }
  
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `You are an expert HR recruiter and CV analyzer. Analyze the following CV against the job description and provide a detailed matching assessment.

JOB DESCRIPTION:

${jobDescription}

CV CONTENT:

${cvText}

Please analyze the CV and provide:

1. A skills match score (0-100) - How well the candidate's technical and soft skills match the job requirements

2. An experience match score (0-100) - How well the candidate's work experience aligns with the job requirements

3. A qualifications match score (0-100) - How well the candidate's education and certifications match the job requirements

4. An overall match score (0-100) - The weighted average considering all factors

5. A brief analysis (2-3 sentences) explaining the key strengths and gaps

Respond ONLY with a valid JSON object in this exact format:

{
  "overallScore": <number>,
  "skillsScore": <number>,
  "experienceScore": <number>,
  "qualificationsScore": <number>,
  "analysis": "<string>"
}`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error('Failed to parse AI response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    overallScore: Math.min(100, Math.max(0, parsed.overallScore)),
    skillsScore: Math.min(100, Math.max(0, parsed.skillsScore)),
    experienceScore: Math.min(100, Math.max(0, parsed.experienceScore)),
    qualificationsScore: Math.min(100, Math.max(0, parsed.qualificationsScore)),
    analysis: parsed.analysis || 'Analysis completed successfully.',
  };
}

export interface JobDetails {
  title: string;
  location?: string;
  experience?: string;
  salary?: string;
}

export async function generateJobDescription(jobDetails: JobDetails | string): Promise<string> {
  if (!genAI || !apiKey) {
    throw new Error('Gemini API key is not configured. Please add VITE_GEMINI_API_KEY to your .env file.');
  }
  
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  // Support both old (string) and new (object) formats for backward compatibility
  let jobTitle: string;
  let location: string | undefined;
  let experience: string | undefined;
  let salary: string | undefined;

  if (typeof jobDetails === 'string') {
    jobTitle = jobDetails;
  } else {
    jobTitle = jobDetails.title;
    location = jobDetails.location;
    experience = jobDetails.experience;
    salary = jobDetails.salary;
  }

  // Build the job details section
  const detailsText = `
Job Title: ${jobTitle}
${location ? `Location: ${location}` : ''}
${experience ? `Experience Required: ${experience} years` : ''}
${salary ? `Salary Range: ${salary}` : ''}
`.trim();

  const prompt = `You are an expert HR professional and job description writer. Generate a comprehensive, professional job description based on the following details:

${detailsText}

The job description should include:

1. Job Summary/Overview (2-3 sentences) - Write an engaging overview that describes the role and its importance

2. Key Responsibilities (6-8 bullet points) - List the main duties and responsibilities for this position

3. Required Qualifications and Skills (5-7 bullet points) - Include both technical and soft skills appropriate for this role

4. Preferred Qualifications (3-4 bullet points) - Additional nice-to-have skills or experience

5. What We Offer (3-5 bullet points) - Standard benefits and perks

Format the response as clean, readable text without any markdown formatting, asterisks, or special characters. Use clear section headings with line breaks and bullet points using hyphens (-). Keep it between 1500 - 1900 characters.

IMPORTANT GUIDELINES:
- Tailor the description specifically to the ${jobTitle} position
${location ? `- Make it relevant for the ${location} location` : ''}
${experience ? `- Match the responsibilities and requirements to ${experience} years of experience level` : ''}
${salary ? `- Consider the salary range of ${salary} when describing the seniority level` : ''}
- Do not use any markdown formatting like **bold**, *italic*, or any asterisks
- Use plain text only with proper line breaks and simple bullet points with hyphens (-)
- Do not include company name placeholders - write it generically
- Make it professional, comprehensive, and realistic`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  let text = response.text();

  // Clean up any markdown formatting
  text = text.replace(/\*\*(.*?)\*\*/g, '$1'); // Remove **bold**
  text = text.replace(/\*(.*?)\*/g, '$1'); // Remove *italic*
  text = text.replace(/#{1,6}\s/g, ''); // Remove markdown headers
  text = text.replace(/`(.*?)`/g, '$1'); // Remove code formatting

  return text;
}

export async function extractJobFromPDF(pdfText: string): Promise<{
  title: string;
  description: string;
}> {
  if (!genAI || !apiKey) {
    throw new Error('Gemini API key is not configured. Please add VITE_GEMINI_API_KEY to your .env file.');
  }
  
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `You are an expert at extracting and structuring job information from PDF documents. Analyze the following PDF content and extract job posting information:

PDF CONTENT:

${pdfText}

Extract and structure the information into:

1. Job Title - The main position title

2. Job Description - A comprehensive description including responsibilities, requirements, qualifications, and any other relevant details

If multiple jobs are present, focus on the primary/main job posting. If the content is not a job posting, indicate that clearly.

Respond ONLY with a valid JSON object in this exact format:

{
  "title": "<job title>",
  "description": "<comprehensive job description>"
}

If this is not a job posting, respond with:

{
  "title": "",
  "description": "This document does not appear to contain a job posting."
}`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error('Failed to parse PDF job extraction response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    title: parsed.title || '',
    description: parsed.description || 'Could not extract job information from this document.',
  };
}

export interface InterviewEvaluationResult {
  recommendation: 'hire' | 'maybe' | 'no_hire';
  overallScore: number;
  technicalSkillsScore: number;
  communicationScore: number;
  cultureFitScore: number;
  strengths: string[];
  concerns: string[];
  summary: string;
  keyInsights: string;
}

export async function evaluateInterviewPerformance(
  transcript: string,
  jobDescription: string,
  jobTitle: string
): Promise<InterviewEvaluationResult> {
  if (!genAI || !apiKey) {
    throw new Error('Gemini API key is not configured. Please add VITE_GEMINI_API_KEY to your .env file.');
  }
  
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `You are an expert HR interviewer and talent evaluator. Analyze the following interview transcript against the job description and provide a comprehensive hiring recommendation.

JOB TITLE: ${jobTitle}

JOB DESCRIPTION:
${jobDescription}

INTERVIEW TRANSCRIPT:
${transcript}

Based on the interview conversation, evaluate the candidate across multiple dimensions and provide a hiring recommendation.

Analyze:
1. Technical Skills & Knowledge (0-100) - How well did the candidate demonstrate required technical competencies and job-specific knowledge?

2. Communication Skills (0-100) - How effectively did the candidate articulate their thoughts, listen, and engage in the conversation?

3. Culture Fit & Attitude (0-100) - How well does the candidate's values, work style, and personality align with typical organizational culture?

4. Overall Hiring Score (0-100) - Weighted average of all factors

5. Recommendation - Based on scores:
   - "hire" (75-100): Strong candidate, recommend hiring
   - "maybe" (50-74): Potential candidate, needs further evaluation
   - "no_hire" (0-49): Not suitable for this role

6. Key Strengths (3-5 points) - What stood out positively about this candidate?

7. Areas of Concern (2-4 points) - What weaknesses or red flags were identified?

8. Summary (2-3 sentences) - Brief overview of the evaluation

9. Key Insights (1 paragraph) - Deeper analysis of the candidate's suitability for the role

Respond ONLY with a valid JSON object in this exact format:

{
  "recommendation": "hire" | "maybe" | "no_hire",
  "overallScore": <number 0-100>,
  "technicalSkillsScore": <number 0-100>,
  "communicationScore": <number 0-100>,
  "cultureFitScore": <number 0-100>,
  "strengths": ["<strength 1>", "<strength 2>", ...],
  "concerns": ["<concern 1>", "<concern 2>", ...],
  "summary": "<brief summary>",
  "keyInsights": "<detailed insights paragraph>"
}`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error('Failed to parse interview evaluation response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    recommendation: parsed.recommendation || 'maybe',
    overallScore: Math.min(100, Math.max(0, parsed.overallScore || 0)),
    technicalSkillsScore: Math.min(100, Math.max(0, parsed.technicalSkillsScore || 0)),
    communicationScore: Math.min(100, Math.max(0, parsed.communicationScore || 0)),
    cultureFitScore: Math.min(100, Math.max(0, parsed.cultureFitScore || 0)),
    strengths: parsed.strengths || [],
    concerns: parsed.concerns || [],
    summary: parsed.summary || 'Evaluation completed.',
    keyInsights: parsed.keyInsights || 'Further evaluation may be needed.',
  };
}
