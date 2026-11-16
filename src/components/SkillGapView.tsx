import { useEffect, useState, type FormEvent } from "react";
import { CheckSquare, Loader2, MessageSquareCode, Plus, Square, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import type { SkillGapRecord, SkillPriority, WorkspaceSnapshot } from "../types/intelliprep";
import { ScoreRing } from "./ScoreRing";

interface SkillGapViewProps {
  snapshot: WorkspaceSnapshot;
  preselectedResumeId: string | null;
  onSnapshotUpdate: (snapshot: WorkspaceSnapshot) => void;
  onPracticeForGap: (gap: SkillGapRecord) => void;
}

function getPriorityLabel(priority: SkillPriority): { label: string; cls: string } {
  if (priority === "critical") return { label: "Critical Gap", cls: "text-red-700" };
  if (priority === "recommended") return { label: "Recommended", cls: "text-amber-700" };
  return { label: "Bonus", cls: "text-slate-600" };
}

const SAMPLE_JD_TEXT = `We are hiring a Full-Stack Software Engineer to build high-throughput web applications.
Required skills: TypeScript, React, Node.js, REST/GraphQL APIs, PostgreSQL, Redis caching, automated testing (Playwright/Jest), Docker, and AWS (ECS or Lambda) deployment pipelines.
Preferred: CI/CD observability, OAuth 2.0 security, and system design experience.`;

export function SkillGapView({
  snapshot,
  preselectedResumeId,
  onSnapshotUpdate,
  onPracticeForGap,
}: SkillGapViewProps) {
  const { resumes, skillGaps, profile } = snapshot;
  const [selectedGapId, setSelectedGapId] = useState<string | null>(skillGaps[0]?.id ?? null);
  const [showNewForm, setShowNewForm] = useState<boolean>(skillGaps.length === 0);

  const [resumeId, setResumeId] = useState<string>(preselectedResumeId || resumes[0]?.id || "");
  const [customResumeText, setCustomResumeText] = useState("");
  const [jobTitle, setJobTitle] = useState(profile.targetRole);
  const [company, setCompany] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (preselectedResumeId) {
      setResumeId(preselectedResumeId);
      setShowNewForm(true);
    } else if (!resumeId && resumes.length > 0 && !customResumeText.trim()) {
      setResumeId(resumes[0].id);
    }
  }, [preselectedResumeId, resumes]);

  const activeGap: SkillGapRecord | null =
    skillGaps.find((g) => g.id === selectedGapId) || skillGaps[0] || null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!jobTitle.trim()) {
      setError("Please enter a Target Job Title before analyzing skill gaps.");
      return;
    }
    if (!resumeId && customResumeText.trim().length < 10) {
      setError("Please paste your resume text (or select a saved resume) to compare against the job description.");
      return;
    }
    if (jobDescription.trim().length < 10) {
      setError("Please paste the Target Job Description (at least 10 characters) before analyzing skill gaps.");
      return;
    }

    setAnalyzing(true);
    try {
      const result = await api.analyzeSkillGap({
        resumeId: resumeId || null,
        resumeText: resumeId ? undefined : customResumeText,
        jobTitle: jobTitle.trim(),
        company: company.trim(),
        jobDescription: jobDescription.trim(),
      });
      onSnapshotUpdate(result.snapshot);
      setSelectedGapId(result.record.id);
      setShowNewForm(false);
      setJobDescription("");
      setCompany("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to compare resume with job description.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleToggleTask(gapId: string, taskId: string, currentCompleted: boolean) {
    try {
      const result = await api.toggleChecklistTask(gapId, taskId, !currentCompleted);
      onSnapshotUpdate(result.snapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update checklist.");
    }
  }

  async function handleDelete(id: string) {
    try {
      const next = await api.deleteSkillGap(id);
      onSnapshotUpdate(next);
      if (selectedGapId === id) {
        setSelectedGapId(next.skillGaps[0]?.id ?? null);
        if (next.skillGaps.length === 0) setShowNewForm(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete comparison.");
    }
  }

  const completedTasksCount = activeGap ? activeGap.upskillingPlan.filter((t) => t.completed).length : 0;
  const totalTasksCount = activeGap ? activeGap.upskillingPlan.length : 0;
  const checklistPct = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Skill Gap Matcher
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Compare your resume against a target job description to pinpoint missing requirements and generate an upskilling roadmap.
          </p>
        </div>
        {skillGaps.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setShowNewForm((prev) => !prev);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>{showNewForm ? "Back to Analysis" : "New JD Comparison"}</span>
          </button>
        )}
      </div>

      {skillGaps.length > 0 && !showNewForm && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="text-xs font-medium text-slate-500 mr-1 whitespace-nowrap">Comparisons:</span>
            {skillGaps.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setSelectedGapId(g.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  activeGap?.id === g.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {g.jobTitle}
                {g.company ? ` @ ${g.company}` : ""} · <span className="font-mono tabular-nums">{g.matchScore}%</span>
              </button>
            ))}
          </div>
          {activeGap && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onPracticeForGap(activeGap)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors whitespace-nowrap"
              >
                <MessageSquareCode className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Practice for this Role</span>
              </button>
              <button
                type="button"
                onClick={() => handleDelete(activeGap.id)}
                aria-label="Delete comparison"
                className="p-1.5 text-slate-400 hover:text-red-700 rounded-md transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div role="alert" className="px-4 py-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl">
          {error}
        </div>
      )}

      {showNewForm && (
        <form noValidate onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="gap-job-title" className="block text-sm font-medium text-slate-700 mb-1">
                Target Job Title
              </label>
              <input
                id="gap-job-title"
                type="text"
                value={jobTitle}
                onChange={(e) => {
                  setJobTitle(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g., Backend Software Engineer"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label htmlFor="gap-company" className="block text-sm font-medium text-slate-700 mb-1">
                Company (optional)
              </label>
              <input
                id="gap-company"
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g., Stripe, Acme Cloud"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div>
            <label htmlFor="gap-resume-select" className="block text-sm font-medium text-slate-700 mb-1">
              Resume Source
            </label>
            <select
              id="gap-resume-select"
              value={resumeId}
              onChange={(e) => {
                setResumeId(e.target.value);
                if (error) setError(null);
              }}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>
                  Saved Resume: {r.title} ({r.overallScore}/100)
                </option>
              ))}
              <option value="">Paste custom resume text instead</option>
            </select>
          </div>

          {!resumeId && (
            <div>
              <label htmlFor="gap-resume-text" className="block text-sm font-medium text-slate-700 mb-1">
                Paste Resume Text
              </label>
              <textarea
                id="gap-resume-text"
                rows={6}
                value={customResumeText}
                onChange={(e) => {
                  setCustomResumeText(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Paste your resume content (skills, experience, projects)..."
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="gap-jd" className="block text-sm font-medium text-slate-700">
                Target Job Description
              </label>
              <button
                type="button"
                onClick={() => {
                  setJobDescription(SAMPLE_JD_TEXT);
                  if (!jobTitle.trim()) setJobTitle("Full-Stack Software Engineer");
                  if (error) setError(null);
                }}
                className="text-xs font-medium text-blue-700 hover:underline"
              >
                Use Sample JD
              </button>
            </div>
            <textarea
              id="gap-jd"
              rows={7}
              value={jobDescription}
              onChange={(e) => {
                setJobDescription(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Paste the job requirements, responsibilities, and preferred qualifications..."
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            {skillGaps.length > 0 && (
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={analyzing}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors disabled:opacity-60 shadow-sm"
            >
              {analyzing && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              <span>{analyzing ? "Comparing Resume & JD..." : "Analyze Skill Gaps"}</span>
            </button>
          </div>
        </form>
      )}

      {!showNewForm && activeGap && (
        <div className="space-y-6">
          {/* Match Score Overview */}
          <section className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="max-w-2xl">
                <div className="text-xs text-slate-500">
                  {activeGap.company || "Target Role"} · Compared{" "}
                  <span className="font-mono tabular-nums">
                    {new Date(activeGap.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <h2 className="mt-1 font-display text-xl font-bold text-slate-900">{activeGap.jobTitle}</h2>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{activeGap.readinessVerdict}</p>
              </div>
              <div className="shrink-0">
                <ScoreRing score={activeGap.matchScore} size={104} strokeWidth={8} label="Role Fit" />
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-200 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-emerald-50/50 border border-emerald-200/70 rounded-xl p-4">
                <div className="text-xs font-semibold text-emerald-800">Verified Matched Skills</div>
                <p className="mt-1.5 text-sm font-mono text-slate-800 leading-relaxed">
                  {activeGap.matchedSkills.length > 0
                    ? activeGap.matchedSkills.join(" · ")
                    : "None detected yet"}
                </p>
              </div>
              <div className="bg-blue-50/50 border border-blue-200/70 rounded-xl p-4">
                <div className="text-xs font-semibold text-blue-800">Transferable Strengths</div>
                <ul className="mt-1.5 space-y-1 text-sm text-slate-700">
                  {activeGap.transferableStrengths.map((t, i) => (
                    <li key={i}>• {t}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* Missing Skills Table */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="font-display text-base font-semibold text-slate-900">
                Identified Skill Gaps ({activeGap.missingSkills.length})
              </h3>
            </div>
            <div className="divide-y divide-slate-200">
              {activeGap.missingSkills.map((gap, idx) => {
                const pri = getPriorityLabel(gap.priority);
                return (
                  <div key={idx} className="px-6 py-4 grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
                    <div className="lg:col-span-3">
                      <div className="text-sm font-semibold text-slate-900">{gap.skill}</div>
                      <div className={`text-xs font-semibold mt-0.5 ${pri.cls}`}>{pri.label}</div>
                    </div>
                    <div className="lg:col-span-5 text-sm text-slate-600">{gap.reason}</div>
                    <div className="lg:col-span-4 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <span className="font-semibold text-slate-900 block mb-0.5">Recommended Action</span>
                      {gap.suggestedResource}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Two-column: Upskilling Checklist + Tailoring Tips */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-base font-semibold text-slate-900">
                      Interactive Upskilling Plan
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Check off tasks as you complete them to update your readiness index
                    </p>
                  </div>
                  <span className="font-mono tabular-nums text-xs font-semibold text-slate-700">
                    {completedTasksCount}/{totalTasksCount} ({checklistPct}%)
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                    style={{ width: `${checklistPct}%` }}
                  />
                </div>
              </div>
              <div className="divide-y divide-slate-200">
                {activeGap.upskillingPlan.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => handleToggleTask(activeGap.id, task.id, task.completed)}
                    className="w-full px-6 py-4 flex items-start gap-3 text-left hover:bg-slate-50 transition-colors"
                  >
                    {task.completed ? (
                      <CheckSquare className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
                    ) : (
                      <Square className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
                    )}
                    <div className="min-w-0">
                      <div className="text-xs text-slate-500">
                        {task.week} · {task.focus}
                      </div>
                      <div
                        className={`mt-1 text-sm ${
                          task.completed ? "line-through text-slate-400" : "font-medium text-slate-900"
                        }`}
                      >
                        {task.task}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
              <h3 className="font-display text-base font-semibold text-slate-900">
                Resume Tailoring Tips
              </h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-700">
                {activeGap.resumeTailoringTips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="font-mono text-xs text-blue-700 font-semibold mt-0.5">
                      0{i + 1}
                    </span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
