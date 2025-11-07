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
  
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

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

export async function generateJobDescription(jobTitle: string): Promise<string> {
  if (!genAI || !apiKey) {
    throw new Error('Gemini API key is not configured. Please add VITE_GEMINI_API_KEY to your .env file.');
  }
  
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

  const prompt = `You are an expert HR professional and job description writer. Generate a comprehensive, professional job description for the following position: "${jobTitle}"

The job description should include:

1. Job Summary/Overview (2-3 sentences)

2. Key Responsibilities (5-8 bullet points)

3. Required Qualifications and Skills

4. Preferred Qualifications

5. Experience Level Requirements

6. Company Benefits (standard benefits)

Format the response as clean, readable text without any markdown formatting, asterisks, or special characters. Use clear sections with proper line breaks and bullet points using hyphens (-). Keep it between 1500 - 1900 characters.

Do not include company name placeholders - write it generically. Focus on making it comprehensive and professional.

IMPORTANT: Do not use any markdown formatting like **bold**, *italic*, or any asterisks. Use plain text only with proper line breaks and simple bullet points with hyphens.`;

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
  
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

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

