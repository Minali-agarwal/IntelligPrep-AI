import type {
  AnswerEvaluation,
  DifficultyLevel,
  ExperienceLevel,
  InterviewType,
  MockInterviewSession,
  ResumeAnalysisRecord,
  SkillGapRecord,
  WorkspaceSnapshot,
} from "../types/intelliprep";

const TOKEN_STORAGE_KEY = "intelliprep_workspace_token";

function getStoredToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveStoredToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // ignore storage errors in restricted contexts
  }
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const res = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-Workspace-Token": token } : {}),
      ...(options?.headers || {}),
    },
    ...options,
  });

  const nextToken = res.headers.get("X-Workspace-Token");
  if (nextToken) {
    saveStoredToken(nextToken);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  getWorkspace: () => requestJson<WorkspaceSnapshot>("/api/workspace"),

  register: (payload: {
    name: string;
    email: string;
    password: string;
    targetRole?: string;
    experienceLevel?: ExperienceLevel;
  }) =>
    requestJson<WorkspaceSnapshot>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  login: (payload: { email: string; password: string }) =>
    requestJson<WorkspaceSnapshot>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  logout: () =>
    requestJson<WorkspaceSnapshot>("/api/auth/logout", {
      method: "POST",
    }),

  updateProfile: (payload: {
    name?: string;
    targetRole?: string;
    experienceLevel?: ExperienceLevel;
  }) =>
    requestJson<WorkspaceSnapshot>("/api/profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  analyzeResume: (payload: {
    title?: string;
    fileName?: string | null;
    targetRole?: string;
    resumeText?: string;
    fileBase64?: string;
    fileMimeType?: string;
  }) =>
    requestJson<{ record: ResumeAnalysisRecord; snapshot: WorkspaceSnapshot }>("/api/resumes/analyze", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  deleteResume: (id: string) =>
    requestJson<WorkspaceSnapshot>(`/api/resumes/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  analyzeSkillGap: (payload: {
    resumeId?: string | null;
    resumeText?: string;
    jobTitle: string;
    company?: string;
    jobDescription: string;
  }) =>
    requestJson<{ record: SkillGapRecord; snapshot: WorkspaceSnapshot }>("/api/skill-gaps/analyze", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  toggleChecklistTask: (skillGapId: string, taskId: string, completed: boolean) =>
    requestJson<{ record: SkillGapRecord; snapshot: WorkspaceSnapshot }>(
      `/api/skill-gaps/${encodeURIComponent(skillGapId)}/checklist`,
      {
        method: "PATCH",
        body: JSON.stringify({ taskId, completed }),
      }
    ),

  deleteSkillGap: (id: string) =>
    requestJson<WorkspaceSnapshot>(`/api/skill-gaps/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  generateInterview: (payload: {
    interviewType: InterviewType;
    targetRole: string;
    difficulty: DifficultyLevel;
    questionCount: number;
    focusTopics?: string;
    resumeId?: string | null;
    jobDescription?: string;
  }) =>
    requestJson<{ session: MockInterviewSession; snapshot: WorkspaceSnapshot }>("/api/interviews/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  submitInterviewAnswer: (
    interviewId: string,
    payload: { questionId: string; userAnswer: string; durationSeconds?: number }
  ) =>
    requestJson<{
      session: MockInterviewSession;
      evaluation: AnswerEvaluation;
      snapshot: WorkspaceSnapshot;
    }>(`/api/interviews/${encodeURIComponent(interviewId)}/answer`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  completeInterview: (interviewId: string) =>
    requestJson<{ session: MockInterviewSession; snapshot: WorkspaceSnapshot }>(
      `/api/interviews/${encodeURIComponent(interviewId)}/complete`,
      {
        method: "POST",
      }
    ),

  deleteInterview: (id: string) =>
    requestJson<WorkspaceSnapshot>(`/api/interviews/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  loadSampleWorkspace: () =>
    requestJson<WorkspaceSnapshot>("/api/workspace/load-sample", {
      method: "POST",
    }),
};
