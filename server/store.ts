import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type {
  AnalyticsSummary,
  ExperienceLevel,
  MockInterviewSession,
  ResumeAnalysisRecord,
  SkillGapRecord,
  UserProfile,
  WorkspaceSnapshot,
} from "../src/types/intelliprep.ts";

interface StoredUser extends UserProfile {
  passwordHash: string | null;
  passwordSalt: string | null;
}

interface StoredSession {
  token: string;
  userId: string;
  createdAt: string;
}

interface StoreData {
  users: StoredUser[];
  sessions: StoredSession[];
  resumes: ResumeAnalysisRecord[];
  skillGaps: SkillGapRecord[];
  interviews: MockInterviewSession[];
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "intelliprep-store.json");

let cache: StoreData | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function createEmptyStore(): StoreData {
  return {
    users: [],
    sessions: [],
    resumes: [],
    skillGaps: [],
    interviews: [],
  };
}

async function ensureLoaded(): Promise<StoreData> {
  if (cache) return cache;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<StoreData>;
    cache = {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      resumes: Array.isArray(parsed.resumes) ? parsed.resumes : [],
      skillGaps: Array.isArray(parsed.skillGaps) ? parsed.skillGaps : [],
      interviews: Array.isArray(parsed.interviews) ? parsed.interviews : [],
    };
  } catch {
    cache = createEmptyStore();
    await persistStore(cache);
  }
  return cache;
}

async function persistStore(data: StoreData): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tempPath = `${STORE_PATH}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), "utf-8");
    await fs.rename(tempPath, STORE_PATH);
  });
  await writeQueue;
}

export function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

export function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password: string, storedHash: string, storedSalt: string): boolean {
  const { hash } = hashPassword(password, storedSalt);
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function sanitizeUser(user: StoredUser): UserProfile {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isGuest: user.isGuest,
    targetRole: user.targetRole,
    experienceLevel: user.experienceLevel,
    createdAt: user.createdAt,
  };
}

export async function getOrCreateSessionUser(token: string | undefined): Promise<{
  user: UserProfile;
  token: string;
  isNewSession: boolean;
}> {
  const store = await ensureLoaded();
  if (token) {
    const existingSession = store.sessions.find((s) => s.token === token);
    if (existingSession) {
      const foundUser = store.users.find((u) => u.id === existingSession.userId);
      if (foundUser) {
        return { user: sanitizeUser(foundUser), token, isNewSession: false };
      }
    }
  }

  const userId = generateId("usr");
  const newUser: StoredUser = {
    id: userId,
    name: "Candidate Workspace",
    email: null,
    isGuest: true,
    targetRole: "Full-Stack Software Engineer",
    experienceLevel: "Entry-Level",
    passwordHash: null,
    passwordSalt: null,
    createdAt: new Date().toISOString(),
  };
  const newToken = crypto.randomBytes(24).toString("hex");
  store.users.push(newUser);
  store.sessions.push({
    token: newToken,
    userId,
    createdAt: new Date().toISOString(),
  });
  await persistStore(store);

  return { user: sanitizeUser(newUser), token: newToken, isNewSession: true };
}

export async function registerUserAccount(params: {
  currentGuestUserId: string;
  name: string;
  email: string;
  password: string;
  targetRole?: string;
  experienceLevel?: ExperienceLevel;
}): Promise<{ user: UserProfile; token: string }> {
  const store = await ensureLoaded();
  const normalizedEmail = params.email.trim().toLowerCase();
  const existing = store.users.find((u) => u.email?.toLowerCase() === normalizedEmail);
  if (existing) {
    throw new Error("An account with this email already exists.");
  }

  const { hash, salt } = hashPassword(params.password);
  const currentUser = store.users.find((u) => u.id === params.currentGuestUserId);

  let targetUser: StoredUser;
  if (currentUser && currentUser.isGuest) {
    // Upgrade current guest workspace so user keeps their analyzed resumes & interviews
    currentUser.name = params.name.trim();
    currentUser.email = normalizedEmail;
    currentUser.isGuest = false;
    currentUser.passwordHash = hash;
    currentUser.passwordSalt = salt;
    if (params.targetRole) currentUser.targetRole = params.targetRole.trim();
    if (params.experienceLevel) currentUser.experienceLevel = params.experienceLevel;
    targetUser = currentUser;
  } else {
    targetUser = {
      id: generateId("usr"),
      name: params.name.trim(),
      email: normalizedEmail,
      isGuest: false,
      targetRole: params.targetRole?.trim() || "Software Engineer",
      experienceLevel: params.experienceLevel || "Entry-Level",
      passwordHash: hash,
      passwordSalt: salt,
      createdAt: new Date().toISOString(),
    };
    store.users.push(targetUser);
  }

  const newToken = crypto.randomBytes(24).toString("hex");
  store.sessions.push({
    token: newToken,
    userId: targetUser.id,
    createdAt: new Date().toISOString(),
  });
  await persistStore(store);
  return { user: sanitizeUser(targetUser), token: newToken };
}

export async function loginUserAccount(params: {
  email: string;
  password: string;
}): Promise<{ user: UserProfile; token: string }> {
  const store = await ensureLoaded();
  const normalizedEmail = params.email.trim().toLowerCase();
  const found = store.users.find((u) => u.email?.toLowerCase() === normalizedEmail);
  if (!found || !found.passwordHash || !found.passwordSalt) {
    throw new Error("Invalid email or password.");
  }
  if (!verifyPassword(params.password, found.passwordHash, found.passwordSalt)) {
    throw new Error("Invalid email or password.");
  }
  const newToken = crypto.randomBytes(24).toString("hex");
  store.sessions.push({
    token: newToken,
    userId: found.id,
    createdAt: new Date().toISOString(),
  });
  await persistStore(store);
  return { user: sanitizeUser(found), token: newToken };
}

export async function logoutSession(token: string | undefined): Promise<{ user: UserProfile; token: string }> {
  const store = await ensureLoaded();
  if (token) {
    store.sessions = store.sessions.filter((s) => s.token !== token);
    await persistStore(store);
  }
  return getOrCreateSessionUser(undefined);
}

export async function updateUserProfile(
  userId: string,
  patch: { name?: string; targetRole?: string; experienceLevel?: ExperienceLevel }
): Promise<UserProfile> {
  const store = await ensureLoaded();
  const user = store.users.find((u) => u.id === userId);
  if (!user) throw new Error("User not found.");
  if (typeof patch.name === "string" && patch.name.trim()) {
    user.name = patch.name.trim();
  }
  if (typeof patch.targetRole === "string" && patch.targetRole.trim()) {
    user.targetRole = patch.targetRole.trim();
  }
  if (patch.experienceLevel) {
    user.experienceLevel = patch.experienceLevel;
  }
  await persistStore(store);
  return sanitizeUser(user);
}

export async function saveResumeAnalysis(record: ResumeAnalysisRecord): Promise<ResumeAnalysisRecord> {
  const store = await ensureLoaded();
  store.resumes.unshift(record);
  await persistStore(store);
  return record;
}

export async function deleteResumeAnalysis(userId: string, resumeId: string): Promise<void> {
  const store = await ensureLoaded();
  store.resumes = store.resumes.filter((r) => !(r.id === resumeId && r.userId === userId));
  await persistStore(store);
}

export async function getUserResumeById(userId: string, resumeId: string): Promise<ResumeAnalysisRecord | null> {
  const store = await ensureLoaded();
  return store.resumes.find((r) => r.id === resumeId && r.userId === userId) || null;
}

export async function saveSkillGapAnalysis(record: SkillGapRecord): Promise<SkillGapRecord> {
  const store = await ensureLoaded();
  store.skillGaps.unshift(record);
  await persistStore(store);
  return record;
}

export async function toggleSkillGapChecklistItem(
  userId: string,
  skillGapId: string,
  taskId: string,
  completed: boolean
): Promise<SkillGapRecord> {
  const store = await ensureLoaded();
  const record = store.skillGaps.find((g) => g.id === skillGapId && g.userId === userId);
  if (!record) throw new Error("Skill gap record not found.");
  const task = record.upskillingPlan.find((t) => t.id === taskId);
  if (!task) throw new Error("Task not found.");
  task.completed = completed;
  await persistStore(store);
  return record;
}

export async function deleteSkillGapAnalysis(userId: string, skillGapId: string): Promise<void> {
  const store = await ensureLoaded();
  store.skillGaps = store.skillGaps.filter((g) => !(g.id === skillGapId && g.userId === userId));
  await persistStore(store);
}

export async function saveInterviewSession(session: MockInterviewSession): Promise<MockInterviewSession> {
  const store = await ensureLoaded();
  const idx = store.interviews.findIndex((i) => i.id === session.id && i.userId === session.userId);
  if (idx >= 0) {
    store.interviews[idx] = session;
  } else {
    store.interviews.unshift(session);
  }
  await persistStore(store);
  return session;
}

export async function getInterviewSessionById(
  userId: string,
  interviewId: string
): Promise<MockInterviewSession | null> {
  const store = await ensureLoaded();
  return store.interviews.find((i) => i.id === interviewId && i.userId === userId) || null;
}

export async function deleteInterviewSession(userId: string, interviewId: string): Promise<void> {
  const store = await ensureLoaded();
  store.interviews = store.interviews.filter((i) => !(i.id === interviewId && i.userId === userId));
  await persistStore(store);
}

export function computeAnalytics(
  resumes: ResumeAnalysisRecord[],
  skillGaps: SkillGapRecord[],
  interviews: MockInterviewSession[]
): AnalyticsSummary {
  const avgResumeScore =
    resumes.length > 0
      ? Math.round(resumes.reduce((acc, r) => acc + r.overallScore, 0) / resumes.length)
      : null;

  const avgMatchScore =
    skillGaps.length > 0
      ? Math.round(skillGaps.reduce((acc, g) => acc + g.matchScore, 0) / skillGaps.length)
      : null;

  const answeredQuestions = interviews.flatMap((s) => s.questions).filter((q) => q.evaluation !== null);
  const completedInterviewsList = interviews.filter((i) => i.status === "completed" && i.overallScore !== null);

  const avgInterviewScore =
    answeredQuestions.length > 0
      ? Math.round(
          answeredQuestions.reduce((acc, q) => acc + (q.evaluation?.overallScore ?? 0), 0) /
            answeredQuestions.length
        )
      : null;

  const completedChecklistTasks = skillGaps.reduce(
    (acc, g) => acc + g.upskillingPlan.filter((t) => t.completed).length,
    0
  );
  const totalChecklistTasks = skillGaps.reduce((acc, g) => acc + g.upskillingPlan.length, 0);

  // Compute weighted readiness index from available real components
  const components: { val: number; weight: number }[] = [];
  if (avgResumeScore !== null) components.push({ val: avgResumeScore, weight: 0.3 });
  if (avgMatchScore !== null) components.push({ val: avgMatchScore, weight: 0.3 });
  if (avgInterviewScore !== null) components.push({ val: avgInterviewScore, weight: 0.4 });

  const readinessIndex =
    components.length > 0
      ? Math.round(
          components.reduce((acc, c) => acc + c.val * c.weight, 0) /
            components.reduce((acc, c) => acc + c.weight, 0)
        )
      : 0;

  // Confidence index blends interview confidenceOwnership + practice volume + checklist momentum
  const avgOwnership =
    answeredQuestions.length > 0
      ? answeredQuestions.reduce((acc, q) => acc + (q.evaluation?.confidenceOwnership ?? 0), 0) /
        answeredQuestions.length
      : 0;
  const volumeBonus = Math.min(15, answeredQuestions.length * 2 + resumes.length * 3 + skillGaps.length * 3);
  const checklistBonus =
    totalChecklistTasks > 0 ? Math.round((completedChecklistTasks / totalChecklistTasks) * 10) : 0;
  const confidenceIndex =
    answeredQuestions.length > 0 || resumes.length > 0 || skillGaps.length > 0
      ? Math.min(100, Math.round((avgOwnership > 0 ? avgOwnership * 0.75 : readinessIndex * 0.65) + volumeBonus + checklistBonus))
      : 0;

  // Competency breakdown
  const techQuestions = answeredQuestions.filter(
    (q) => q.category.toLowerCase().includes("technical") || q.category.toLowerCase().includes("system") || q.category.toLowerCase().includes("coding")
  );
  const behavioralQuestions = answeredQuestions.filter((q) =>
    q.category.toLowerCase().includes("behavioral")
  );

  const avgOf = (items: typeof answeredQuestions, pick: (q: (typeof answeredQuestions)[number]) => number) =>
    items.length > 0 ? Math.round(items.reduce((a, b) => a + pick(b), 0) / items.length) : 0;

  const competencies = [
    {
      label: "Technical Accuracy",
      score: avgOf(techQuestions.length > 0 ? techQuestions : answeredQuestions, (q) => q.evaluation!.technicalAccuracy),
      sampleCount: techQuestions.length > 0 ? techQuestions.length : answeredQuestions.length,
    },
    {
      label: "Behavioral Structure (STAR)",
      score: avgOf(behavioralQuestions.length > 0 ? behavioralQuestions : answeredQuestions, (q) => q.evaluation!.structureClarity),
      sampleCount: behavioralQuestions.length > 0 ? behavioralQuestions.length : answeredQuestions.length,
    },
    {
      label: "Clarity & Conciseness",
      score: avgOf(answeredQuestions, (q) => q.evaluation!.depthRelevance),
      sampleCount: answeredQuestions.length,
    },
    {
      label: "Resume Readiness",
      score: avgResumeScore ?? 0,
      sampleCount: resumes.length,
    },
    {
      label: "Job Description Fit",
      score: avgMatchScore ?? 0,
      sampleCount: skillGaps.length,
    },
  ];

  // Chronological timeline
  const timeline = [
    ...resumes.map((r) => ({
      id: r.id,
      date: r.createdAt,
      label: r.title,
      kind: "resume" as const,
      score: r.overallScore,
    })),
    ...skillGaps.map((g) => ({
      id: g.id,
      date: g.createdAt,
      label: `${g.jobTitle}${g.company ? ` @ ${g.company}` : ""}`,
      kind: "skill-gap" as const,
      score: g.matchScore,
    })),
    ...interviews
      .filter((i) => i.overallScore !== null || i.questions.some((q) => q.evaluation !== null))
      .map((i) => {
        const evals = i.questions.filter((q) => q.evaluation !== null);
        const computedScore =
          i.overallScore ??
          Math.round(evals.reduce((a, q) => a + (q.evaluation?.overallScore ?? 0), 0) / Math.max(1, evals.length));
        return {
          id: i.id,
          date: i.completedAt || i.createdAt,
          label: i.title,
          kind: "interview" as const,
          score: computedScore,
        };
      }),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Dynamic personalized recommendations
  const recommendedActions: AnalyticsSummary["recommendedActions"] = [];
  if (resumes.length === 0) {
    recommendedActions.push({
      title: "Analyze your primary resume",
      description: "Upload a PDF or paste your resume to establish your ATS baseline and uncover quantified bullet rewrites.",
      targetSection: "resume",
      priority: "high",
    });
  } else if (resumes[0].overallScore < 78) {
    recommendedActions.push({
      title: `Strengthen "${resumes[0].title}" (${resumes[0].overallScore}/100)`,
      description: resumes[0].criticalImprovements[0] || "Apply the AI bullet rewrites to add measurable impact metrics.",
      targetSection: "resume",
      priority: "high",
    });
  }

  if (skillGaps.length === 0) {
    recommendedActions.push({
      title: "Benchmark against a target job description",
      description: "Compare your resume against a real job posting to isolate critical missing skills and generate a study plan.",
      targetSection: "skill-gap",
      priority: "high",
    });
  } else {
    const latestGap = skillGaps[0];
    const openCritical = latestGap.missingSkills.filter((m) => m.priority === "critical");
    if (openCritical.length > 0) {
      recommendedActions.push({
        title: `Close ${openCritical.length} critical gap${openCritical.length > 1 ? "s" : ""} for ${latestGap.jobTitle}`,
        description: `Focus next on ${openCritical.slice(0, 2).map((c) => c.skill).join(" and ")} from your upskilling checklist.`,
        targetSection: "skill-gap",
        priority: "medium",
      });
    }
  }

  if (answeredQuestions.length < 3) {
    recommendedActions.push({
      title: "Complete a 3-question mock interview drill",
      description: "Practice technical or STAR behavioral responses with real-time AI rubric scoring and model answers.",
      targetSection: "interview",
      priority: "high",
    });
  } else if (avgInterviewScore !== null && avgInterviewScore < 80) {
    const weakest = [...competencies].sort((a, b) => a.score - b.score)[0];
    recommendedActions.push({
      title: `Targeted drill to lift ${weakest.label}`,
      description: `Your ${weakest.label.toLowerCase()} currently averages ${weakest.score}%. Run a focused mock interview to sharpen delivery.`,
      targetSection: "interview",
      priority: "medium",
    });
  } else {
    recommendedActions.push({
      title: "Review longitudinal analytics & session transcripts",
      description: "Compare your model answers and track score progression across completed interview sessions.",
      targetSection: "analytics",
      priority: "low",
    });
  }

  return {
    readinessIndex,
    confidenceIndex,
    avgResumeScore,
    avgMatchScore,
    avgInterviewScore,
    totalQuestionsAnswered: answeredQuestions.length,
    completedInterviews: completedInterviewsList.length,
    completedChecklistTasks,
    totalChecklistTasks,
    competencies,
    timeline,
    recommendedActions,
  };
}

export async function getWorkspaceSnapshot(userId: string): Promise<WorkspaceSnapshot> {
  const store = await ensureLoaded();
  const user = store.users.find((u) => u.id === userId);
  if (!user) throw new Error("Workspace user not found.");

  const resumes = store.resumes.filter((r) => r.userId === userId);
  const skillGaps = store.skillGaps.filter((g) => g.userId === userId);
  const interviews = store.interviews.filter((i) => i.userId === userId);
  const analytics = computeAnalytics(resumes, skillGaps, interviews);

  return {
    profile: sanitizeUser(user),
    resumes,
    skillGaps,
    interviews,
    analytics,
  };
}
