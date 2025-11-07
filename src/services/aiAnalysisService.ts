import { Job, Candidate } from '../lib/firebase';
import { analyzeWithGemini } from './geminiService';

export interface ResumeMatchResult {
  matchScore: number; // 0-100 percentage
  skillsMatch: {
    required: string[];
    found: string[];
    missing: string[];
    matchCount: number;
    totalCount: number;
  };
  keywordsFound: string[];
  keywordsMissing: string[];
  summary: string;
  skillsScore?: number;
  experienceScore?: number;
  qualificationsScore?: number;
}

/**
 * AI Analysis Service for Resume Matching using Google Gemini
 */
export const aiAnalysisService = {
  /**
   * Analyze resume against job requirements and calculate match score using Gemini AI
   */
  async analyzeResumeMatch(candidate: Candidate, job: Job): Promise<ResumeMatchResult> {
    if (!candidate.resumeText || !job) {
      return {
        matchScore: 0,
        skillsMatch: {
          required: [],
          found: [],
          missing: [],
          matchCount: 0,
          totalCount: 0,
        },
        keywordsFound: [],
        keywordsMissing: [],
        summary: 'Resume text not available for analysis.',
      };
    }

    try {
      // Use Gemini AI for analysis
      const jobDescription = `${job.title}\n\n${job.description}`;
      const geminiResult = await analyzeWithGemini(candidate.resumeText, jobDescription);

      // Extract required skills from job for compatibility
      const requiredSkills = job.requirements?.skills || [];
      const resumeText = candidate.resumeText.toLowerCase();
      
      // Find matching skills for detailed breakdown
      const foundSkills: string[] = [];
      const missingSkills: string[] = [];
      
      requiredSkills.forEach((skill) => {
        const skillLower = skill.toLowerCase();
        if (
          resumeText.includes(skillLower) ||
          this.findSkillVariations(skillLower, resumeText)
        ) {
          foundSkills.push(skill);
        } else {
          missingSkills.push(skill);
        }
      });

      // Extract keywords for compatibility
      const jobKeywords = this.extractKeywords(job.title + ' ' + job.description);
      const foundKeywords = jobKeywords.filter(keyword => 
        resumeText.includes(keyword.toLowerCase())
      );
      const missingKeywords = jobKeywords.filter(keyword => 
        !resumeText.includes(keyword.toLowerCase())
      );

      return {
        matchScore: geminiResult.overallScore,
        skillsScore: geminiResult.skillsScore,
        experienceScore: geminiResult.experienceScore,
        qualificationsScore: geminiResult.qualificationsScore,
        skillsMatch: {
          required: requiredSkills,
          found: foundSkills,
          missing: missingSkills,
          matchCount: foundSkills.length,
          totalCount: requiredSkills.length,
        },
        keywordsFound: foundKeywords,
        keywordsMissing: missingKeywords,
        summary: geminiResult.analysis,
      };
    } catch (error) {
      console.error('Error analyzing resume with Gemini:', error);
      // Fallback to basic analysis if Gemini fails
      return {
        matchScore: 0,
        skillsMatch: {
          required: job.requirements?.skills || [],
          found: [],
          missing: job.requirements?.skills || [],
          matchCount: 0,
          totalCount: job.requirements?.skills?.length || 0,
        },
        keywordsFound: [],
        keywordsMissing: [],
        summary: `Error analyzing resume: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },

  /**
   * Extract important keywords from text
   */
  extractKeywords(text: string): string[] {
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 3); // Filter out short words

    // Common stop words to exclude
    const stopWords = new Set([
      'this', 'that', 'with', 'from', 'have', 'will', 'been', 'said',
      'would', 'could', 'should', 'about', 'their', 'there', 'these',
      'which', 'when', 'where', 'what', 'them', 'they', 'than', 'then',
      'more', 'most', 'much', 'many', 'may', 'must', 'such', 'some',
      'your', 'you', 'year', 'years', 'work', 'will', 'work', 'would',
    ]);

    // Filter out stop words and get unique keywords
    const keywords = Array.from(
      new Set(words.filter((word) => !stopWords.has(word)))
    );

    // Return top 10 most relevant keywords (prioritize longer words)
    return keywords
      .sort((a, b) => b.length - a.length)
      .slice(0, 10);
  },

  /**
   * Find skill variations (e.g., "React" might be found as "React.js" or "reactjs")
   */
  findSkillVariations(skill: string, resumeText: string): boolean {
    // Normalize skill name (remove spaces, dots, dashes)
    const normalizedSkill = skill.replace(/[\s.-]/g, '').toLowerCase();
    
    // Check for variations
    const variations = [
      normalizedSkill,
      normalizedSkill + 'js',
      normalizedSkill + '.js',
      normalizedSkill + '.net',
      normalizedSkill.replace('js', '.js'),
    ];

    return variations.some((variation) => resumeText.includes(variation));
  },

  /**
   * Generate human-readable summary of match analysis
   */
  generateSummary(
    matchScore: number,
    skillsFound: number,
    skillsTotal: number,
    keywordsFound: number,
    keywordsTotal: number
  ): string {
    let summary = `Match Score: ${matchScore}%`;

    if (skillsTotal > 0) {
      summary += `\n• Skills: ${skillsFound}/${skillsTotal} required skills found`;
    }

    if (keywordsTotal > 0) {
      summary += `\n• Keywords: ${keywordsFound}/${keywordsTotal} relevant keywords matched`;
    }

    if (matchScore >= 80) {
      summary += '\n\n✅ Excellent match! Candidate appears highly qualified.';
    } else if (matchScore >= 60) {
      summary += '\n\n✅ Good match. Candidate meets most requirements.';
    } else if (matchScore >= 40) {
      summary += '\n\n⚠️ Moderate match. Candidate may need additional training.';
    } else {
      summary += '\n\n❌ Low match. Candidate may not meet key requirements.';
    }

    return summary;
  },
};

