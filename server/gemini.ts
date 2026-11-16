import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import type {
  AnswerEvaluation,
  BulletRewrite,
  DifficultyLevel,
  InterviewQuestionItem,
  InterviewType,
  MissingSkillItem,
  ResumeSectionFeedback,
  UpskillingTask,
} from "../src/types/intelliprep.ts";

const MODEL_NAME = "gemini-4-hydrogen";

function getAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("API_KEY_INVALID") || msg.includes("PERMISSION_DENIED") || msg.includes("403")) {
        throw err;
      }
      if (attempt < retries) {
        await new Promise((res) => setTimeout(res, 600 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

function clampScore(n: unknown): number {
  const num = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

export async function analyzeResumeWithAI(params: {
  resumeText?: string;
  fileBase64?: string;
  fileMimeType?: string;
  targetRole: string;
}): Promise<{
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
}> {
  const ai = getAIClient();
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  if (params.fileBase64 && params.fileMimeType) {
    parts.push({
      inlineData: {
        mimeType: params.fileMimeType,
        data: params.fileBase64,
      },
    });
  }

  parts.push({
    text: `Target Role: ${params.targetRole}
${params.resumeText ? `\nResume Text:\n${params.resumeText}` : "\nPlease read the attached resume document thoroughly."}

Analyze this resume rigorously as a senior technical recruiter and hiring manager for the target role "${params.targetRole}".
Provide:
1. extractedText: Clean plain-text transcription/summary of the resume content (if text was provided, preserve/normalize it cleanly).
2. Honest, calibrated scores (0-100) for overallScore, atsCompatibility, impactMetrics, clarityFormatting, and keywordStrength.
3. executiveSummary: 2-3 concise sentences summarizing readiness.
4. strengths: 3-5 concrete strengths found in the resume.
5. criticalImprovements: 3-5 high-leverage improvements needed.
6. missingKeywords: 6-10 role-relevant technical or domain keywords missing or underemphasized.
7. sectionFeedback: Evaluation for key sections (e.g. Summary/Header, Experience, Projects, Skills, Education).
8. bulletRewrites: 3-5 concrete bullet point upgrades with original text from the resume, a quantified STAR/XYZ improved rewrite, and a brief rationale.`,
  });

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts },
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction:
          "You are an expert career coach and technical recruiter. Be objective, actionable, and grounded strictly in the provided resume content.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            extractedText: { type: Type.STRING },
            overallScore: { type: Type.INTEGER },
            atsCompatibility: { type: Type.INTEGER },
            impactMetrics: { type: Type.INTEGER },
            clarityFormatting: { type: Type.INTEGER },
            keywordStrength: { type: Type.INTEGER },
            executiveSummary: { type: Type.STRING },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            criticalImprovements: { type: Type.ARRAY, items: { type: Type.STRING } },
            missingKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
            sectionFeedback: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  section: { type: Type.STRING },
                  status: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  actionItems: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ["section", "status", "summary", "actionItems"],
              },
            },
            bulletRewrites: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  original: { type: Type.STRING },
                  improved: { type: Type.STRING },
                  rationale: { type: Type.STRING },
                },
                required: ["original", "improved", "rationale"],
              },
            },
          },
          required: [
            "extractedText",
            "overallScore",
            "atsCompatibility",
            "impactMetrics",
            "clarityFormatting",
            "keywordStrength",
            "executiveSummary",
            "strengths",
            "criticalImprovements",
            "missingKeywords",
            "sectionFeedback",
            "bulletRewrites",
          ],
        },
      },
    })
  );

  const parsed = JSON.parse((response.text ?? "{}").trim());
  return {
    extractedText: parsed.extractedText || params.resumeText || "",
    overallScore: clampScore(parsed.overallScore),
    atsCompatibility: clampScore(parsed.atsCompatibility),
    impactMetrics: clampScore(parsed.impactMetrics),
    clarityFormatting: clampScore(parsed.clarityFormatting),
    keywordStrength: clampScore(parsed.keywordStrength),
    executiveSummary: parsed.executiveSummary || "Analysis complete.",
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    criticalImprovements: Array.isArray(parsed.criticalImprovements) ? parsed.criticalImprovements : [],
    missingKeywords: Array.isArray(parsed.missingKeywords) ? parsed.missingKeywords : [],
    sectionFeedback: Array.isArray(parsed.sectionFeedback)
      ? parsed.sectionFeedback.map((s: ResumeSectionFeedback) => ({
          section: s.section,
          status:
            s.status === "strong" || s.status === "needs-work" || s.status === "missing"
              ? s.status
              : "needs-work",
          summary: s.summary,
          actionItems: Array.isArray(s.actionItems) ? s.actionItems : [],
        }))
      : [],
    bulletRewrites: Array.isArray(parsed.bulletRewrites) ? parsed.bulletRewrites : [],
  };
}

export async function compareResumeToJobWithAI(params: {
  resumeText: string;
  jobTitle: string;
  company: string;
  jobDescription: string;
}): Promise<{
  matchScore: number;
  readinessVerdict: string;
  matchedSkills: string[];
  transferableStrengths: string[];
  missingSkills: MissingSkillItem[];
  resumeTailoringTips: string[];
  upskillingPlan: Omit<UpskillingTask, "id" | "completed">[];
}> {
  const ai = getAIClient();

  const prompt = `Compare the candidate resume against the target Job Description and identify exact skill gaps.

Target Role: ${params.jobTitle}
Company: ${params.company || "Not specified"}

Job Description:
${params.jobDescription}

Candidate Resume:
${params.resumeText}

Return:
- matchScore (0-100 realistic fit score)
- readinessVerdict (1 concise sentence assessing overall fit)
- matchedSkills (concrete skills/technologies verified in both resume and JD)
- transferableStrengths (adjacent experience that helps bridge gaps)
- missingSkills (each with skill, priority: "critical" | "recommended" | "bonus", reason why it matters for this JD, and suggestedResource/practice task)
- resumeTailoringTips (4-5 specific ways to tailor the resume for this JD)
- upskillingPlan (5-7 actionable study/build tasks across Week 1, Week 2, Week 3)`;

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction:
          "You are a technical talent evaluator performing a structured resume-to-job-description gap analysis.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matchScore: { type: Type.INTEGER },
            readinessVerdict: { type: Type.STRING },
            matchedSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
            transferableStrengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            missingSkills: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  skill: { type: Type.STRING },
                  priority: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  suggestedResource: { type: Type.STRING },
                },
                required: ["skill", "priority", "reason", "suggestedResource"],
              },
            },
            resumeTailoringTips: { type: Type.ARRAY, items: { type: Type.STRING } },
            upskillingPlan: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  week: { type: Type.STRING },
                  focus: { type: Type.STRING },
                  task: { type: Type.STRING },
                },
                required: ["week", "focus", "task"],
              },
            },
          },
          required: [
            "matchScore",
            "readinessVerdict",
            "matchedSkills",
            "transferableStrengths",
            "missingSkills",
            "resumeTailoringTips",
            "upskillingPlan",
          ],
        },
      },
    })
  );

  const parsed = JSON.parse((response.text ?? "{}").trim());
  return {
    matchScore: clampScore(parsed.matchScore),
    readinessVerdict: parsed.readinessVerdict || "Comparison complete.",
    matchedSkills: Array.isArray(parsed.matchedSkills) ? parsed.matchedSkills : [],
    transferableStrengths: Array.isArray(parsed.transferableStrengths) ? parsed.transferableStrengths : [],
    missingSkills: Array.isArray(parsed.missingSkills)
      ? parsed.missingSkills.map((m: MissingSkillItem) => ({
          skill: m.skill,
          priority:
            m.priority === "critical" || m.priority === "recommended" || m.priority === "bonus"
              ? m.priority
              : "recommended",
          reason: m.reason,
          suggestedResource: m.suggestedResource,
        }))
      : [],
    resumeTailoringTips: Array.isArray(parsed.resumeTailoringTips) ? parsed.resumeTailoringTips : [],
    upskillingPlan: Array.isArray(parsed.upskillingPlan) ? parsed.upskillingPlan : [],
  };
}

export async function generateInterviewQuestionsWithAI(params: {
  interviewType: InterviewType;
  targetRole: string;
  difficulty: DifficultyLevel;
  questionCount: number;
  focusTopics?: string;
  resumeContext?: string;
  jobDescription?: string;
}): Promise<Omit<InterviewQuestionItem, "id" | "index" | "userAnswer" | "durationSeconds" | "evaluation">[]> {
  const ai = getAIClient();

  const prompt = `Generate ${params.questionCount} realistic interview questions tailored for:
- Target Role: ${params.targetRole}
- Interview Mode: ${params.interviewType}
- Difficulty Level: ${params.difficulty}
- Focus Topics: ${params.focusTopics || "Core role competencies"}
${params.resumeContext ? `\nCandidate Resume Context (tailor follow-up depth to their background):\n${params.resumeContext.slice(0, 2500)}` : ""}
${params.jobDescription ? `\nTarget Job Description Context:\n${params.jobDescription.slice(0, 2000)}` : ""}

Guidelines:
- If Mixed mode, balance Technical, Behavioral (STAR), and Applied Architecture/Problem-Solving questions.
- If Behavioral mode, craft high-signal situational prompts suited to the STAR method.
- If Technical mode, include deep conceptual, debugging, and practical engineering scenarios.
- If System Design mode, focus on architecture, data modeling, scalability, trade-offs, and reliability.
- For each question provide: category, difficulty, question, idealFramework (e.g. "STAR Method", "Trade-off Analysis", "First-Principles Breakdown"), expectedPoints (3-5 key concepts an interviewer listens for), and hint (a subtle nudge without giving away the answer).`;

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction:
          "You are a principal interviewer designing high-signal, realistic interview questions.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              difficulty: { type: Type.STRING },
              question: { type: Type.STRING },
              idealFramework: { type: Type.STRING },
              expectedPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
              hint: { type: Type.STRING },
            },
            required: ["category", "difficulty", "question", "idealFramework", "expectedPoints", "hint"],
          },
        },
      },
    })
  );

  const parsed = JSON.parse((response.text ?? "[]").trim());
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Failed to generate interview questions.");
  }

  return parsed.slice(0, params.questionCount).map((q) => ({
    category: q.category || params.interviewType,
    difficulty: params.difficulty,
    question: q.question,
    idealFramework: q.idealFramework || "Structured Response",
    expectedPoints: Array.isArray(q.expectedPoints) ? q.expectedPoints : [],
    hint: q.hint || "Structure your response clearly with concrete examples.",
  }));
}

export async function evaluateInterviewAnswerWithAI(params: {
  question: string;
  category: string;
  targetRole: string;
  difficulty: DifficultyLevel;
  expectedPoints: string[];
  userAnswer: string;
}): Promise<AnswerEvaluation> {
  const ai = getAIClient();

  const prompt = `Evaluate the candidate's interview answer objectively and constructively.

Target Role: ${params.targetRole}
Difficulty: ${params.difficulty}
Category: ${params.category}
Question: ${params.question}
Expected Key Points:
${params.expectedPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}

Candidate's Answer:
"${params.userAnswer}"

Score fairly (0-100) across:
- overallScore
- technicalAccuracy (domain/technical soundness, or situational depth for behavioral)
- structureClarity (logical flow, STAR alignment if behavioral, conciseness)
- depthRelevance (specificity, trade-offs, concrete examples)
- confidenceOwnership (decisive ownership, active voice, professional poise)
And provide:
- strengths (2-4 specific highlights from their answer)
- improvements (2-4 actionable ways to strengthen the answer)
- missedPoints (key points from expectedPoints they did not cover)
- modelAnswer (a crisp, realistic strong example answer for this role and level)
- coachingTip (1 focused takeaway to apply on the next question)`;

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction:
          "You are an encouraging yet rigorous interview coach providing calibrated scoring and actionable feedback.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallScore: { type: Type.INTEGER },
            technicalAccuracy: { type: Type.INTEGER },
            structureClarity: { type: Type.INTEGER },
            depthRelevance: { type: Type.INTEGER },
            confidenceOwnership: { type: Type.INTEGER },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
            missedPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            modelAnswer: { type: Type.STRING },
            coachingTip: { type: Type.STRING },
          },
          required: [
            "overallScore",
            "technicalAccuracy",
            "structureClarity",
            "depthRelevance",
            "confidenceOwnership",
            "strengths",
            "improvements",
            "missedPoints",
            "modelAnswer",
            "coachingTip",
          ],
        },
      },
    })
  );

  const parsed = JSON.parse((response.text ?? "{}").trim());
  return {
    overallScore: clampScore(parsed.overallScore),
    technicalAccuracy: clampScore(parsed.technicalAccuracy),
    structureClarity: clampScore(parsed.structureClarity),
    depthRelevance: clampScore(parsed.depthRelevance),
    confidenceOwnership: clampScore(parsed.confidenceOwnership),
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
    missedPoints: Array.isArray(parsed.missedPoints) ? parsed.missedPoints : [],
    modelAnswer: parsed.modelAnswer || "",
    coachingTip: parsed.coachingTip || "",
    evaluatedAt: new Date().toISOString(),
  };
}
