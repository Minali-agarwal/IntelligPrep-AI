import { ArrowRight, BarChart3, CheckCircle2, FileText, GitCompare, MessageSquareCode } from "lucide-react";
import type { WorkspaceSection, WorkspaceSnapshot } from "../types/intelliprep";
import { ScoreRing } from "./ScoreRing";

interface OverviewViewProps {
  snapshot: WorkspaceSnapshot;
  onNavigate: (section: WorkspaceSection) => void;
  onLoadSample: () => void;
  loadingSample: boolean;
}

function getScoreTier(score: number | null): { label: string; colorClass: string; barClass: string } {
  if (score === null) return { label: "No baseline", colorClass: "text-slate-500", barClass: "bg-slate-200" };
  if (score >= 80) return { label: "Strong", colorClass: "text-emerald-700", barClass: "bg-emerald-600" };
  if (score >= 60) return { label: "Developing", colorClass: "text-blue-700", barClass: "bg-blue-600" };
  return { label: "Needs focus", colorClass: "text-amber-700", barClass: "bg-amber-600" };
}

export function OverviewView({
  snapshot,
  onNavigate,
  onLoadSample,
  loadingSample,
}: OverviewViewProps) {
  const { profile, resumes, skillGaps, interviews, analytics } = snapshot;
  const hasAnyData = resumes.length > 0 || skillGaps.length > 0 || interviews.length > 0;

  const resumeTier = getScoreTier(analytics.avgResumeScore);
  const matchTier = getScoreTier(analytics.avgMatchScore);
  const interviewTier = getScoreTier(analytics.avgInterviewScore);
  const confidenceTier = getScoreTier(hasAnyData ? analytics.confidenceIndex : null);

  return (
    <div className="space-y-8">
      {/* Executive Hero Banner with Integrated Readiness Gauge */}
      <section className="relative overflow-hidden bg-slate-950 text-white rounded-2xl p-6 sm:p-8 border border-slate-800 shadow-sm">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.28),transparent_55%)]"
          aria-hidden="true"
        />
        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
          <div className="max-w-2xl">
            <div className="text-xs font-medium text-blue-300">
              Preparation Command Center · {profile.targetRole} · {profile.experienceLevel}
            </div>
            <h1 className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-white [text-wrap:balance]">
              Turn resume insights and mock drills into interview offers
            </h1>
            <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed">
              Audit your resume for ATS clarity, benchmark against target job descriptions to close skill gaps, and practice technical and behavioral interviews with structured rubric feedback.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate(resumes.length === 0 ? "resume" : "interview")}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap shadow-sm"
              >
                <span>{resumes.length === 0 ? "Audit Your Resume" : "Launch Mock Interview"}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              {!hasAnyData && (
                <button
                  type="button"
                  onClick={onLoadSample}
                  disabled={loadingSample}
                  className="px-4 py-2.5 text-sm font-medium text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors whitespace-nowrap disabled:opacity-60"
                >
                  {loadingSample ? "Loading Sample..." : "Load Sample Profile"}
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-6 bg-slate-900/80 border border-slate-800 rounded-xl p-5 shrink-0">
            <ScoreRing
              score={hasAnyData ? analytics.readinessIndex : null}
              size={116}
              strokeWidth={9}
              label="Readiness"
              dark
            />
            <div className="space-y-2.5 text-xs">
              <div>
                <div className="text-slate-400">Confidence Index</div>
                <div className="font-mono tabular-nums text-base font-semibold text-white">
                  {hasAnyData ? `${analytics.confidenceIndex}/100` : "—"}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Questions Practiced</div>
                <div className="font-mono tabular-nums text-base font-semibold text-white">
                  {analytics.totalQuestionsAnswered}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Upskilling Tasks</div>
                <div className="font-mono tabular-nums text-base font-semibold text-white">
                  {analytics.completedChecklistTasks}/{analytics.totalChecklistTasks}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4-Column KPI Strip */}
      <section aria-label="Readiness Metrics" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Resume ATS Score</span>
            <FileText className="h-4 w-4 text-slate-400" aria-hidden="true" />
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="font-mono tabular-nums text-3xl font-bold text-slate-900">
              {analytics.avgResumeScore !== null ? `${analytics.avgResumeScore}` : "—"}
            </span>
            <span className={`text-xs font-semibold ${resumeTier.colorClass}`}>{resumeTier.label}</span>
          </div>
          <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${resumeTier.barClass}`}
              style={{ width: `${analytics.avgResumeScore ?? 0}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-slate-500 tabular-nums">
            {resumes.length} resume{resumes.length === 1 ? "" : "s"} audited
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Job Description Fit</span>
            <GitCompare className="h-4 w-4 text-slate-400" aria-hidden="true" />
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="font-mono tabular-nums text-3xl font-bold text-slate-900">
              {analytics.avgMatchScore !== null ? `${analytics.avgMatchScore}%` : "—"}
            </span>
            <span className={`text-xs font-semibold ${matchTier.colorClass}`}>{matchTier.label}</span>
          </div>
          <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${matchTier.barClass}`}
              style={{ width: `${analytics.avgMatchScore ?? 0}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-slate-500 tabular-nums">
            {skillGaps.length} role comparison{skillGaps.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Mock Interview Avg</span>
            <MessageSquareCode className="h-4 w-4 text-slate-400" aria-hidden="true" />
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="font-mono tabular-nums text-3xl font-bold text-slate-900">
              {analytics.avgInterviewScore !== null ? `${analytics.avgInterviewScore}` : "—"}
            </span>
            <span className={`text-xs font-semibold ${interviewTier.colorClass}`}>{interviewTier.label}</span>
          </div>
          <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${interviewTier.barClass}`}
              style={{ width: `${analytics.avgInterviewScore ?? 0}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-slate-500 tabular-nums">
            {analytics.completedInterviews} completed drill{analytics.completedInterviews === 1 ? "" : "s"}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Confidence & Poise</span>
            <BarChart3 className="h-4 w-4 text-slate-400" aria-hidden="true" />
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="font-mono tabular-nums text-3xl font-bold text-slate-900">
              {hasAnyData ? `${analytics.confidenceIndex}` : "—"}
            </span>
            <span className={`text-xs font-semibold ${confidenceTier.colorClass}`}>{confidenceTier.label}</span>
          </div>
          <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${confidenceTier.barClass}`}
              style={{ width: `${hasAnyData ? analytics.confidenceIndex : 0}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-slate-500 tabular-nums">
            Derived from ownership & practice volume
          </div>
        </div>
      </section>

      {/* Two-Column Action Plan & Quick Launch */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Recommended Preparation Path
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Prioritized actions derived from your current resume, gaps, and interview performance
            </p>
          </div>

          <div className="divide-y divide-slate-200">
            {analytics.recommendedActions.map((action, idx) => (
              <div key={idx} className="px-6 py-4 flex items-start justify-between gap-4 hover:bg-slate-50/70 transition-colors">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono tabular-nums font-semibold text-slate-700">0{idx + 1}</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        action.priority === "high"
                          ? "font-semibold text-red-700"
                          : action.priority === "medium"
                          ? "font-semibold text-amber-700"
                          : "font-medium text-slate-600"
                      }
                    >
                      {action.priority === "high"
                        ? "High priority"
                        : action.priority === "medium"
                        ? "Recommended"
                        : "Review"}
                    </span>
                  </div>
                  <h3 className="mt-1 text-sm font-semibold text-slate-900">{action.title}</h3>
                  <p className="mt-1 text-sm text-slate-600 leading-relaxed">{action.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate(action.targetSection)}
                  className="shrink-0 px-3.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors whitespace-nowrap"
                >
                  Open
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="font-display text-base font-semibold text-slate-900">Preparation Studios</h2>
            <p className="text-xs text-slate-500 mt-0.5">Interactive AI workflows</p>
          </div>
          <div className="divide-y divide-slate-200">
            <button
              type="button"
              onClick={() => onNavigate("resume")}
              className="w-full px-6 py-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors text-left group"
            >
              <div className="flex items-start gap-3.5">
                <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                    Resume Studio
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    PDF/text audit, ATS scoring, and quantified bullet rewrites
                  </div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-700 transition-colors shrink-0" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate("skill-gap")}
              className="w-full px-6 py-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors text-left group"
            >
              <div className="flex items-start gap-3.5">
                <div className="h-9 w-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                  <GitCompare className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                    Skill Gap Matcher
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Compare resume vs. job description with an interactive study plan
                  </div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-700 transition-colors shrink-0" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate("interview")}
              className="w-full px-6 py-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors text-left group"
            >
              <div className="flex items-start gap-3.5">
                <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                  <MessageSquareCode className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                    Mock Interview Lab
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Technical, STAR behavioral, and system design drills with rubric feedback
                  </div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-700 transition-colors shrink-0" aria-hidden="true" />
            </button>
          </div>
        </section>
      </div>

      {/* Recent Sessions Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">Recent Preparation Activity</h2>
            <p className="text-xs text-slate-500 mt-0.5">Latest completed analyses and interview sessions</p>
          </div>
          {analytics.timeline.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigate("analytics")}
              className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap"
            >
              View full analytics
            </button>
          )}
        </div>

        {analytics.timeline.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <CheckCircle2 className="h-8 w-8 text-slate-300 mx-auto" aria-hidden="true" />
            <h3 className="mt-3 text-sm font-semibold text-slate-900">No activity recorded yet</h3>
            <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
              Start by auditing your resume or running a mock interview drill. Your scores and analytical insights will track here automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-3 px-6">Session</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-6 text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {[...analytics.timeline]
                  .reverse()
                  .slice(0, 6)
                  .map((item) => {
                    const tier = getScoreTier(item.score);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-6 font-medium text-slate-900">{item.label}</td>
                        <td className="py-3 px-4 text-slate-600">
                          {item.kind === "resume"
                            ? "Resume Audit"
                            : item.kind === "skill-gap"
                            ? "Skill Gap Match"
                            : "Mock Interview"}
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-500">
                          {new Date(item.date).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-6 text-right font-mono tabular-nums">
                          <span className={`font-semibold ${tier.colorClass}`}>{item.score}%</span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
