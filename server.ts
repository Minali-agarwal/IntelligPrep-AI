import "dotenv/config";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import path from "node:path";
import {
  analyzeResumeWithAI,
  compareResumeToJobWithAI,
  evaluateInterviewAnswerWithAI,
  generateInterviewQuestionsWithAI,
} from "./server/gemini.ts";
import {
  deleteInterviewSession,
  deleteResumeAnalysis,
  deleteSkillGapAnalysis,
  generateId,
  getInterviewSessionById,
  getOrCreateSessionUser,
  getUserResumeById,
  getWorkspaceSnapshot,
  loginUserAccount,
  logoutSession,
  registerUserAccount,
  saveInterviewSession,
  saveResumeAnalysis,
  saveSkillGapAnalysis,
  toggleSkillGapChecklistItem,
  updateUserProfile,
} from "./server/store.ts";
import type {
  DifficultyLevel,
  ExperienceLevel,
  InterviewType,
  MockInterviewSession,
  ResumeAnalysisRecord,
  SkillGapRecord,
  UserProfile,
} from "./src/types/intelliprep.ts";

const COOKIE_NAME = "intelliprep_sid";
const PORT = 3000;

interface AuthedRequest extends Request {
  user?: UserProfile;
  sessionToken?: string;
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    if (key) result[key] = val;
  }
  return result;
}

function setSessionCookie(req: Request, res: Response, token: string): void {
  const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
  res.setHeader("X-Workspace-Token", token);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: isHttps ? "none" : "lax",
    secure: isHttps,
    maxAge: 1000 * 60 * 60 * 24 * 30,
    path: "/",
  });
}

function formatApiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes("GEMINI_API_KEY")) {
    return { status: 500, message: "Server AI key is not configured. Please check Settings > Secrets." };
  }
  if (raw.includes("PERMISSION_DENIED") || raw.includes("API_KEY_INVALID")) {
    return { status: 403, message: "Gemini API key was rejected. Please verify your key in Settings > Secrets." };
  }
  if (raw.includes("RESOURCE_EXHAUSTED") || raw.includes("429")) {
    return { status: 429, message: "AI rate limit reached. Please wait a moment and try again." };
  }
  return { status: 400, message: raw || "Unexpected server error." };
}

async function attachWorkspaceUser(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const headerToken =
      typeof req.headers["x-workspace-token"] === "string"
        ? req.headers["x-workspace-token"].trim()
        : undefined;
    const cookies = parseCookies(req.headers.cookie);
    const token = headerToken || cookies[COOKIE_NAME];
    const resolved = await getOrCreateSessionUser(token);
    req.user = resolved.user;
    req.sessionToken = resolved.token;
    res.setHeader("X-Workspace-Token", resolved.token);
    if (resolved.isNewSession || headerToken !== resolved.token) {
      setSessionCookie(req, res, resolved.token);
    }
    next();
  } catch (err) {
    next(err);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "12mb" }));

  // Auth & Profile routes
  app.get("/api/workspace", attachWorkspaceUser, async (req: AuthedRequest, res: Response) => {
    try {
      const snapshot = await getWorkspaceSnapshot(req.user!.id);
      res.json(snapshot);
    } catch (err) {
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
    }
  });

  app.post("/api/auth/register", attachWorkspaceUser, async (req: AuthedRequest, res: Response) => {
    try {
      const { name, email, password, targetRole, experienceLevel } = req.body as {
        name?: string;
        email?: string;
        password?: string;
        targetRole?: string;
        experienceLevel?: ExperienceLevel;
      };
      if (!name || !email || !password || password.length < 6) {
        res.status(400).json({ error: "Provide name, valid email, and a password of at least 6 characters." });
        return;
      }
      const result = await registerUserAccount({
        currentGuestUserId: req.user!.id,
        name,
        email,
        password,
        targetRole,
        experienceLevel,
      });
      setSessionCookie(req, res, result.token);
      const snapshot = await getWorkspaceSnapshot(result.user.id);
      res.json(snapshot);
    } catch (err) {
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body as { email?: string; password?: string };
      if (!email || !password) {
        res.status(400).json({ error: "Email and password are required." });
        return;
      }
      const result = await loginUserAccount({ email, password });
      setSessionCookie(req, res, result.token);
      const snapshot = await getWorkspaceSnapshot(result.user.id);
      res.json(snapshot);
    } catch (err) {
      res.status(401).json({ error: err instanceof Error ? err.message : "Invalid credentials." });
    }
  });

  app.post("/api/auth/logout", attachWorkspaceUser, async (req: AuthedRequest, res: Response) => {
    try {
      const result = await logoutSession(req.sessionToken);
      setSessionCookie(req, res, result.token);
      const snapshot = await getWorkspaceSnapshot(result.user.id);
      res.json(snapshot);
    } catch (err) {
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
    }
  });

  app.patch("/api/profile", attachWorkspaceUser, async (req: AuthedRequest, res: Response) => {
    try {
      const { name, targetRole, experienceLevel } = req.body as {
        name?: string;
        targetRole?: string;
        experienceLevel?: ExperienceLevel;
      };
      await updateUserProfile(req.user!.id, { name, targetRole, experienceLevel });
      const snapshot = await getWorkspaceSnapshot(req.user!.id);
      res.json(snapshot);
    } catch (err) {
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
    }
  });

  // Resume Studio routes
  app.post("/api/resumes/analyze", attachWorkspaceUser, async (req: AuthedRequest, res: Response) => {
    try {
      const { title, fileName, targetRole, resumeText, fileBase64, fileMimeType } = req.body as {
        title?: string;
        fileName?: string | null;
        targetRole?: string;
        resumeText?: string;
        fileBase64?: string;
        fileMimeType?: string;
      };

      if ((!resumeText || resumeText.trim().length < 10) && !fileBase64) {
        res.status(400).json({ error: "Please upload a PDF/TXT resume or paste at least 10 characters of resume text." });
        return;
      }

      const resolvedRole = (targetRole || req.user!.targetRole || "Software Engineer").trim();
      const aiResult = await analyzeResumeWithAI({
        resumeText: resumeText?.trim(),
        fileBase64,
        fileMimeType,
        targetRole: resolvedRole,
      });

      const record: ResumeAnalysisRecord = {
        id: generateId("res"),
        userId: req.user!.id,
        title: (title || fileName || `${resolvedRole} Resume`).trim(),
        fileName: fileName || null,
        targetRole: resolvedRole,
        extractedText: aiResult.extractedText,
        overallScore: aiResult.overallScore,
        atsCompatibility: aiResult.atsCompatibility,
        impactMetrics: aiResult.impactMetrics,
        clarityFormatting: aiResult.clarityFormatting,
        keywordStrength: aiResult.keywordStrength,
        executiveSummary: aiResult.executiveSummary,
        strengths: aiResult.strengths,
        criticalImprovements: aiResult.criticalImprovements,
        missingKeywords: aiResult.missingKeywords,
        sectionFeedback: aiResult.sectionFeedback,
        bulletRewrites: aiResult.bulletRewrites,
        createdAt: new Date().toISOString(),
      };

      await saveResumeAnalysis(record);
      const snapshot = await getWorkspaceSnapshot(req.user!.id);
      res.json({ record, snapshot });
    } catch (err) {
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
    }
  });

  app.delete("/api/resumes/:id", attachWorkspaceUser, async (req: AuthedRequest, res: Response) => {
    try {
      await deleteResumeAnalysis(req.user!.id, String(req.params.id));
      const snapshot = await getWorkspaceSnapshot(req.user!.id);
      res.json(snapshot);
    } catch (err) {
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
    }
  });

  // Skill Gap Matcher routes
  app.post("/api/skill-gaps/analyze", attachWorkspaceUser, async (req: AuthedRequest, res: Response) => {
    try {
      const { resumeId, resumeText, jobTitle, company, jobDescription } = req.body as {
        resumeId?: string | null;
        resumeText?: string;
        jobTitle?: string;
        company?: string;
        jobDescription?: string;
      };

      if (!jobTitle?.trim() || !jobDescription || jobDescription.trim().length < 10) {
        res.status(400).json({ error: "Provide a target job title and a job description (at least 10 characters)." });
        return;
      }

      let resolvedResumeText = resumeText?.trim() || "";
      let resolvedResumeId: string | null = null;
      if (resumeId) {
        const storedResume = await getUserResumeById(req.user!.id, resumeId);
        if (storedResume) {
          resolvedResumeText =
            storedResume.extractedText?.trim() ||
            `${storedResume.title} (${storedResume.targetRole})\n${storedResume.executiveSummary}\nStrengths: ${storedResume.strengths.join("; ")}`;
          resolvedResumeId = storedResume.id;
        }
      }

      if (resolvedResumeText.length < 10) {
        res.status(400).json({ error: "Select a saved resume or paste your resume text (at least 10 characters) to compare." });
        return;
      }

      const aiResult = await compareResumeToJobWithAI({
        resumeText: resolvedResumeText,
        jobTitle: jobTitle.trim(),
        company: (company || "").trim(),
        jobDescription: jobDescription.trim(),
      });

      const record: SkillGapRecord = {
        id: generateId("gap"),
        userId: req.user!.id,
        resumeId: resolvedResumeId,
        jobTitle: jobTitle.trim(),
        company: (company || "").trim(),
        jobDescription: jobDescription.trim(),
        matchScore: aiResult.matchScore,
        readinessVerdict: aiResult.readinessVerdict,
        matchedSkills: aiResult.matchedSkills,
        transferableStrengths: aiResult.transferableStrengths,
        missingSkills: aiResult.missingSkills,
        resumeTailoringTips: aiResult.resumeTailoringTips,
        upskillingPlan: aiResult.upskillingPlan.map((task) => ({
          id: generateId("tsk"),
          week: task.week,
          focus: task.focus,
          task: task.task,
          completed: false,
        })),
        createdAt: new Date().toISOString(),
      };

      await saveSkillGapAnalysis(record);
      const snapshot = await getWorkspaceSnapshot(req.user!.id);
      res.json({ record, snapshot });
    } catch (err) {
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
    }
  });

  app.patch("/api/skill-gaps/:id/checklist", attachWorkspaceUser, async (req: AuthedRequest, res: Response) => {
    try {
      const { taskId, completed } = req.body as { taskId?: string; completed?: boolean };
      if (!taskId || typeof completed !== "boolean") {
        res.status(400).json({ error: "Invalid checklist update payload." });
        return;
      }
      const record = await toggleSkillGapChecklistItem(req.user!.id, String(req.params.id), taskId, completed);
      const snapshot = await getWorkspaceSnapshot(req.user!.id);
      res.json({ record, snapshot });
    } catch (err) {
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
    }
  });

  app.delete("/api/skill-gaps/:id", attachWorkspaceUser, async (req: AuthedRequest, res: Response) => {
    try {
      await deleteSkillGapAnalysis(req.user!.id, String(req.params.id));
      const snapshot = await getWorkspaceSnapshot(req.user!.id);
      res.json(snapshot);
    } catch (err) {
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
    }
  });

  // Mock Interview routes
  app.post("/api/interviews/generate", attachWorkspaceUser, async (req: AuthedRequest, res: Response) => {
    try {
      const {
        interviewType,
        targetRole,
        difficulty,
        questionCount,
        focusTopics,
        resumeId,
        jobDescription,
      } = req.body as {
        interviewType?: InterviewType;
        targetRole?: string;
        difficulty?: DifficultyLevel;
        questionCount?: number;
        focusTopics?: string;
        resumeId?: string | null;
        jobDescription?: string;
      };

      const resolvedType: InterviewType = interviewType || "Mixed";
      const resolvedRole = (targetRole || req.user!.targetRole || "Software Engineer").trim();
      const resolvedDifficulty: DifficultyLevel = difficulty || "Mid-Level";
      const count = Math.max(2, Math.min(8, Number(questionCount) || 4));

      let resumeContext: string | undefined;
      if (resumeId) {
        const storedResume = await getUserResumeById(req.user!.id, resumeId);
        if (storedResume) resumeContext = storedResume.extractedText;
      }

      const generated = await generateInterviewQuestionsWithAI({
        interviewType: resolvedType,
        targetRole: resolvedRole,
        difficulty: resolvedDifficulty,
        questionCount: count,
        focusTopics: focusTopics?.trim(),
        resumeContext,
        jobDescription: jobDescription?.trim(),
      });

      const session: MockInterviewSession = {
        id: generateId("int"),
        userId: req.user!.id,
        title: `${resolvedRole} · ${resolvedType} Drill`,
        interviewType: resolvedType,
        targetRole: resolvedRole,
        difficulty: resolvedDifficulty,
        focusTopics: focusTopics?.trim() || "Core Role Competencies",
        status: "in-progress",
        overallScore: null,
        sessionSummary: null,
        questions: generated.map((q, idx) => ({
          id: generateId("q"),
          index: idx + 1,
          category: q.category,
          difficulty: q.difficulty,
          question: q.question,
          idealFramework: q.idealFramework,
          expectedPoints: q.expectedPoints,
          hint: q.hint,
          userAnswer: null,
          durationSeconds: null,
          evaluation: null,
        })),
        createdAt: new Date().toISOString(),
        completedAt: null,
      };

      await saveInterviewSession(session);
      const snapshot = await getWorkspaceSnapshot(req.user!.id);
      res.json({ session, snapshot });
    } catch (err) {
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
    }
  });

  app.post("/api/interviews/:id/answer", attachWorkspaceUser, async (req: AuthedRequest, res: Response) => {
    try {
      const { questionId, userAnswer, durationSeconds } = req.body as {
        questionId?: string;
        userAnswer?: string;
        durationSeconds?: number;
      };

      if (!questionId || !userAnswer || userAnswer.trim().length < 2) {
        res.status(400).json({ error: "Please type an answer before submitting for evaluation." });
        return;
      }

      const session = await getInterviewSessionById(req.user!.id, String(req.params.id));
      if (!session) {
        res.status(404).json({ error: "Interview session not found." });
        return;
      }

      const question = session.questions.find((q) => q.id === questionId);
      if (!question) {
        res.status(404).json({ error: "Question not found in session." });
        return;
      }

      const evaluation = await evaluateInterviewAnswerWithAI({
        question: question.question,
        category: question.category,
        targetRole: session.targetRole,
        difficulty: session.difficulty,
        expectedPoints: question.expectedPoints,
        userAnswer: userAnswer.trim(),
      });

      question.userAnswer = userAnswer.trim();
      question.durationSeconds = typeof durationSeconds === "number" ? durationSeconds : null;
      question.evaluation = evaluation;

      // Update session aggregate if all questions are answered
      const evaluated = session.questions.filter((q) => q.evaluation !== null);
      if (evaluated.length === session.questions.length) {
        session.status = "completed";
        session.completedAt = new Date().toISOString();
        session.overallScore = Math.round(
          evaluated.reduce((acc, q) => acc + (q.evaluation?.overallScore ?? 0), 0) / evaluated.length
        );
        session.sessionSummary = `Completed ${evaluated.length}/${session.questions.length} questions with an average score of ${session.overallScore}/100.`;
      }

      await saveInterviewSession(session);
      const snapshot = await getWorkspaceSnapshot(req.user!.id);
      res.json({ session, evaluation, snapshot });
    } catch (err) {
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
    }
  });

  app.post("/api/interviews/:id/complete", attachWorkspaceUser, async (req: AuthedRequest, res: Response) => {
    try {
      const session = await getInterviewSessionById(req.user!.id, String(req.params.id));
      if (!session) {
        res.status(404).json({ error: "Interview session not found." });
        return;
      }
      const evaluated = session.questions.filter((q) => q.evaluation !== null);
      if (evaluated.length === 0) {
        res.status(400).json({ error: "Answer at least one question before completing the session." });
        return;
      }
      session.status = "completed";
      session.completedAt = new Date().toISOString();
      session.overallScore = Math.round(
        evaluated.reduce((acc, q) => acc + (q.evaluation?.overallScore ?? 0), 0) / evaluated.length
      );
      session.sessionSummary = `Completed ${evaluated.length} of ${session.questions.length} questions with an average score of ${session.overallScore}/100.`;
      await saveInterviewSession(session);
      const snapshot = await getWorkspaceSnapshot(req.user!.id);
      res.json({ session, snapshot });
    } catch (err) {
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
    }
  });

  app.delete("/api/interviews/:id", attachWorkspaceUser, async (req: AuthedRequest, res: Response) => {
    try {
      await deleteInterviewSession(req.user!.id, String(req.params.id));
      const snapshot = await getWorkspaceSnapshot(req.user!.id);
      res.json(snapshot);
    } catch (err) {
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
    }
  });

  // Explicit user-triggered sample data loader for testing without mock defaults
  app.post("/api/workspace/load-sample", attachWorkspaceUser, async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const sampleResumeText = `Jordan Patel
Full-Stack Software Engineer · Seattle, WA · jordan.patel@example.com · github.com/jordanpatel

SUMMARY
Full-Stack Software Engineer with 2.5 years of experience building TypeScript, React, Node.js, and PostgreSQL web applications. Focused on low-latency APIs, accessible UI engineering, and automated CI/CD pipelines.

EXPERIENCE
Software Engineer, Northstar Cloud Systems (2024 – Present)
- Built customer-facing analytics views in React 18 and TypeScript used by 14,000+ monthly active users.
- Designed REST API endpoints in Express and PostgreSQL, reducing p95 query latency by 38% via composite indexing.
- Implemented GitHub Actions CI workflows with Playwright integration tests, cutting release regressions.

Junior Developer, Harborline Digital (2023 – 2024)
- Developed reusable form components and state management hooks for internal logistics tools.
- Worked with backend engineers to migrate legacy endpoints to structured JSON schemas.

PROJECTS
PulseBoard Incident Tracker — Built real-time WebSocket dashboard with Node.js, Redis pub/sub, and React.

SKILLS
Languages: TypeScript, JavaScript, SQL, Python
Frontend: React, Next.js, Tailwind CSS, HTML/CSS
Backend & Data: Node.js, Express, PostgreSQL, Redis, Docker, Git`;

      const sampleResume: ResumeAnalysisRecord = {
        id: generateId("res"),
        userId,
        title: "Sample Full-Stack Engineer Resume",
        fileName: "Jordan_Patel_Resume.txt",
        targetRole: "Full-Stack Software Engineer",
        extractedText: sampleResumeText,
        overallScore: 79,
        atsCompatibility: 86,
        impactMetrics: 71,
        clarityFormatting: 84,
        keywordStrength: 75,
        executiveSummary:
          "Strong technical foundation in React, TypeScript, and Node.js with clear latency impact metrics. Adding scale numbers and cloud deployment specifics will elevate senior-tier readiness.",
        strengths: [
          "Quantified p95 API latency reduction (38%) with technical cause (composite indexing).",
          "Clean separation of Experience, Projects, and Skills for ATS parsing.",
          "Demonstrates end-to-end ownership across frontend UI and CI integration testing.",
        ],
        criticalImprovements: [
          "Quantify outcomes on Junior Developer bullets (e.g., engineering hours saved or error reduction).",
          "Highlight observability, caching invalidation, or security practices in API design.",
          "Surface cloud infrastructure experience (AWS/GCP, Kubernetes, Terraform) if applicable.",
        ],
        missingKeywords: ["System Design", "GraphQL", "AWS / GCP", "Unit Testing (Vitest/Jest)", "OAuth 2.0", "Rate Limiting"],
        sectionFeedback: [
          {
            section: "Experience",
            status: "strong",
            summary: "Strong ownership verbs and measurable latency metric in recent role.",
            actionItems: ["Add quantitative scale to Harborline Digital bullets."],
          },
          {
            section: "Skills",
            status: "needs-work",
            summary: "Core stack is clear, but testing and cloud tooling keywords are light.",
            actionItems: ["Group testing frameworks and cloud services explicitly."],
          },
        ],
        bulletRewrites: [
          {
            original: "Implemented GitHub Actions CI workflows with Playwright integration tests, cutting release regressions.",
            improved:
              "Engineered automated GitHub Actions CI pipelines with 45+ Playwright end-to-end checks, reducing post-release UI regressions by 60% across bi-weekly deployments.",
            rationale: "Adds concrete test coverage scope and measurable regression reduction.",
          },
          {
            original: "Developed reusable form components and state management hooks for internal logistics tools.",
            improved:
              "Architected a shared accessible form library in React and TypeScript adopted across 6 internal logistics modules, accelerating feature delivery by 30%.",
            rationale: "Demonstrates architectural leverage and quantifiable team impact.",
          },
        ],
        createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      };

      const sampleGap: SkillGapRecord = {
        id: generateId("gap"),
        userId,
        resumeId: sampleResume.id,
        jobTitle: "Senior Full-Stack Engineer",
        company: "Veridian Platform",
        jobDescription:
          "Seeking a Full-Stack Engineer proficient in TypeScript, React, Node.js, PostgreSQL, Redis, GraphQL, AWS (ECS/Lambda), distributed caching, and automated testing (Jest/Playwright).",
        matchScore: 76,
        readinessVerdict:
          "Strong core React/Node.js/PostgreSQL alignment; closing GraphQL and AWS deployment gaps will make you a competitive finalist.",
        matchedSkills: ["TypeScript", "React", "Node.js", "PostgreSQL", "Redis", "Playwright", "CI/CD"],
        transferableStrengths: [
          "REST API optimization experience translates directly to GraphQL resolver batching.",
          "Docker and GitHub Actions background eases transition to AWS ECS deployments.",
        ],
        missingSkills: [
          {
            skill: "AWS (ECS / Lambda)",
            priority: "critical",
            reason: "Production deployment and serverless worker orchestration are core job responsibilities.",
            suggestedResource: "Deploy a containerized Node API to AWS ECS Fargate with CloudWatch alarms.",
          },
          {
            skill: "GraphQL & DataLoader",
            priority: "recommended",
            reason: "Team uses a federated GraphQL gateway to serve product dashboards.",
            suggestedResource: "Build a typed GraphQL schema with DataLoader N+1 batching.",
          },
        ],
        resumeTailoringTips: [
          "Move Redis pub/sub project details into a highlighted architecture bullet.",
          "Specify Playwright test coverage and CI runtime improvements.",
        ],
        upskillingPlan: [
          {
            id: generateId("tsk"),
            week: "Week 1",
            focus: "Cloud Deployment",
            task: "Containerize an Express + PostgreSQL service and deploy to AWS ECS or Cloud Run with health checks.",
            completed: true,
          },
          {
            id: generateId("tsk"),
            week: "Week 2",
            focus: "GraphQL Architecture",
            task: "Implement a GraphQL endpoint with DataLoader to solve N+1 database queries.",
            completed: false,
          },
          {
            id: generateId("tsk"),
            week: "Week 3",
            focus: "System Design Drills",
            task: "Practice 2 distributed caching & rate-limiting design prompts in Mock Interview Lab.",
            completed: false,
          },
        ],
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      };

      const sampleInterview: MockInterviewSession = {
        id: generateId("int"),
        userId,
        title: "Full-Stack Software Engineer · Mixed Drill",
        interviewType: "Mixed",
        targetRole: "Full-Stack Software Engineer",
        difficulty: "Mid-Level",
        focusTopics: "API Latency, React State, STAR Conflict Resolution",
        status: "completed",
        overallScore: 82,
        sessionSummary: "Completed 2/2 questions with an average score of 82/100.",
        questions: [
          {
            id: generateId("q"),
            index: 1,
            category: "Technical",
            difficulty: "Mid-Level",
            question:
              "When diagnosing a slow PostgreSQL-backed REST endpoint, how do you identify bottlenecks and decide between indexing, query restructuring, or caching?",
            idealFramework: "Systematic Profiling & Trade-off Analysis",
            expectedPoints: ["EXPLAIN ANALYZE", "Index selectivity & write overhead", "N+1 query detection", "Cache invalidation trade-offs"],
            hint: "Start with measurement before proposing optimizations.",
            userAnswer:
              "I start by inspecting slow query logs and running EXPLAIN ANALYZE to see whether the database is doing sequential scans or expensive joins. If a filter/sort pattern is hot, I add a composite index while checking write amplification. For repeated read-heavy payloads, I add Redis caching with explicit TTL and invalidation on writes.",
            durationSeconds: 112,
            evaluation: {
              overallScore: 84,
              technicalAccuracy: 88,
              structureClarity: 82,
              depthRelevance: 81,
              confidenceOwnership: 85,
              strengths: [
                "Properly begins with EXPLAIN ANALYZE before changing schema.",
                "Explicitly considers write overhead alongside composite indexing.",
              ],
              improvements: [
                "Mention N+1 query batching at the application/ORM layer.",
                "Describe how you handle cache stampedes on hot keys.",
              ],
              missedPoints: ["N+1 query detection"],
              modelAnswer:
                "First, I isolate whether latency comes from network, app serialization, or DB execution using distributed traces. On PostgreSQL, I run EXPLAIN (ANALYZE, BUFFERS) to inspect sequential scans and buffer reads, eliminate N+1 queries via JOINs or batching, apply targeted composite or partial indexes, and introduce Redis caching only for read-heavy endpoints where eventual consistency or explicit invalidation is acceptable.",
              coachingTip: "Always distinguish app-layer N+1 queries from single-query index scans.",
              evaluatedAt: new Date(Date.now() - 86400000).toISOString(),
            },
          },
          {
            id: generateId("q"),
            index: 2,
            category: "Behavioral",
            difficulty: "Mid-Level",
            question:
              "Tell me about a time you disagreed with a teammate or product stakeholder on a technical trade-off. How did you resolve it?",
            idealFramework: "STAR Method (Situation, Task, Action, Result)",
            expectedPoints: ["Clear context & stakes", "Objective data gathering", "Collaborative resolution", "Measurable outcome"],
            hint: "Focus on shared goals and evidence rather than winning an argument.",
            userAnswer:
              "During a tight sprint, a PM wanted to skip automated tests for a billing form to ship two days earlier. I understood the launch deadline, so I proposed writing focused smoke tests covering just the payment flow in 3 hours. It caught an edge-case validation bug before launch and we still hit the release window.",
            durationSeconds: 95,
            evaluation: {
              overallScore: 80,
              technicalAccuracy: 80,
              structureClarity: 83,
              depthRelevance: 78,
              confidenceOwnership: 79,
              strengths: [
                "Demonstrates empathy for product deadlines alongside engineering quality.",
                "Clear concrete outcome (caught edge-case validation bug before launch).",
              ],
              improvements: [
                "Elaborate slightly on the follow-up retro so full test coverage was added afterward.",
              ],
              missedPoints: [],
              modelAnswer:
                "In a Q3 release, our PM requested skipping E2E tests to meet a partner demo deadline. Recognizing the schedule pressure, I audited the risk and proposed a 3-hour targeted smoke suite covering checkout and auth only, deferring secondary admin tests to a fast-follow PR. The smoke suite caught a currency rounding bug prior to demo, protecting launch credibility while meeting the deadline.",
              coachingTip: "Include a brief closing sentence on long-term process follow-through.",
              evaluatedAt: new Date(Date.now() - 86400000).toISOString(),
            },
          },
        ],
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        completedAt: new Date(Date.now() - 86400000).toISOString(),
      };

      await saveResumeAnalysis(sampleResume);
      await saveSkillGapAnalysis(sampleGap);
      await saveInterviewSession(sampleInterview);
      const snapshot = await getWorkspaceSnapshot(userId);
      res.json(snapshot);
    } catch (err) {
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
    }
  });

  // Vite / Static serving
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`IntelliPrep AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start IntelliPrep AI server:", err);
  process.exit(1);
});
