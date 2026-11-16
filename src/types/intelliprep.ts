export type WorkspaceSection =
  | "overview"
  | "resume"
  | "skill-gap"
  | "interview"
  | "analytics";

export type ExperienceLevel = "Student / Intern" | "Entry-Level" | "Mid-Level" | "Senior";

export type InterviewType = "Technical" | "Behavioral" | "System Design" | "Mixed";

export type DifficultyLevel = "Junior" | "Mid-Level" | "Senior";

export type SkillPriority = "critical" | "recommended" | "bonus";

export interface UserProfile {
  id: string;
  name: string;
  email: string | null;
  isGuest: boolean;
  targetRole: string;
  experienceLevel: ExperienceLevel;
  createdAt: string;
}

export interface BulletRewrite {
  original: string;
  improved: string;
  rationale: string;
}

export interface ResumeSectionFeedback {
  section: string;
  status: "strong" | "needs-work" | "missing";
  summary: string;
  actionItems: string[];
}

export interface ResumeAnalysisRecord {
  id: string;
  userId: string;
  title: string;
  fileName: string | null;
  targetRole: string;
  extractedText: string;
  overallScore: number;
  atsCompatibility: number;
  impactMetrics: number;
  clarityFormatting: number;
  keywordStrength: number;
  executiveSummary: string;
  strengths: string[];
  criticalImprovements: string[];
  missingKeywords: string[];
  sectionFeedback: ResumeSectionFeedback[];
  bulletRewrites: BulletRewrite[];
  createdAt: string;
}

export interface MissingSkillItem {
  skill: string;
  priority: SkillPriority;
  reason: string;
  suggestedResource: string;
}

export interface UpskillingTask {
  id: string;
  week: string;
  focus: string;
  task: string;
  completed: boolean;
}

export interface SkillGapRecord {
  id: string;
  userId: string;
  resumeId: string | null;
  jobTitle: string;
  company: string;
  jobDescription: string;
  matchScore: number;
  readinessVerdict: string;
  matchedSkills: string[];
  transferableStrengths: string[];
  missingSkills: MissingSkillItem[];
  resumeTailoringTips: string[];
  upskillingPlan: UpskillingTask[];
  createdAt: string;
}

export interface AnswerEvaluation {
  overallScore: number;
  technicalAccuracy: number;
  structureClarity: number;
  depthRelevance: number;
  confidenceOwnership: number;
  strengths: string[];
  improvements: string[];
  missedPoints: string[];
  modelAnswer: string;
  coachingTip: string;
  evaluatedAt: string;
}

export interface InterviewQuestionItem {
  id: string;
  index: number;
  category: string;
  difficulty: DifficultyLevel;
  question: string;
  idealFramework: string;
  expectedPoints: string[];
  hint: string;
  userAnswer: string | null;
  durationSeconds: number | null;
  evaluation: AnswerEvaluation | null;
}

export interface MockInterviewSession {
  id: string;
  userId: string;
  title: string;
  interviewType: InterviewType;
  targetRole: string;
  difficulty: DifficultyLevel;
  focusTopics: string;
  status: "in-progress" | "completed";
  overallScore: number | null;
  sessionSummary: string | null;
  questions: InterviewQuestionItem[];
  createdAt: string;
  completedAt: string | null;
}

export interface AnalyticsSummary {
  readinessIndex: number;
  confidenceIndex: number;
  avgResumeScore: number | null;
  avgMatchScore: number | null;
  avgInterviewScore: number | null;
  totalQuestionsAnswered: number;
  completedInterviews: number;
  completedChecklistTasks: number;
  totalChecklistTasks: number;
  competencies: {
    label: string;
    score: number;
    sampleCount: number;
  }[];
  timeline: {
    id: string;
    date: string;
    label: string;
    kind: "interview" | "resume" | "skill-gap";
    score: number;
  }[];
  recommendedActions: {
    title: string;
    description: string;
    targetSection: WorkspaceSection;
    priority: "high" | "medium" | "low";
  }[];
}

export interface WorkspaceSnapshot {
  profile: UserProfile;
  resumes: ResumeAnalysisRecord[];
  skillGaps: SkillGapRecord[];
  interviews: MockInterviewSession[];
  analytics: AnalyticsSummary;
}
