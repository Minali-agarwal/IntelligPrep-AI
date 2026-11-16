import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type {
  MockInterviewSession,
  ResumeAnalysisRecord,
  SkillGapRecord,
  WorkspaceSnapshot,
} from "../types/intelliprep";

interface AnalyticsViewProps {
  snapshot: WorkspaceSnapshot;
}

type HistoryFilter = "all" | "interview" | "resume" | "skill-gap";

export function AnalyticsView({ snapshot }: AnalyticsViewProps) {
  const { analytics, interviews, resumes, skillGaps } = snapshot;
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [inspectItem, setInspectItem] = useState<
    | { kind: "interview"; data: MockInterviewSession }
    | { kind: "resume"; data: ResumeAnalysisRecord }
    | { kind: "skill-gap"; data: SkillGapRecord }
    | null
  >(null);

  const filteredTimeline = useMemo(() => {
    return [...analytics.timeline]
      .reverse()
      .filter((item) => (filter === "all" ? true : item.kind === filter))
      .filter((item) =>
        searchQuery.trim()
          ? item.label.toLowerCase().includes(searchQuery.trim().toLowerCase())
          : true
      );
  }, [analytics.timeline, filter, searchQuery]);

  function openDetail(kind: "interview" | "resume" | "skill-gap", id: string) {
    if (kind === "interview") {
      const found = interviews.find((i) => i.id === id);
      if (found) setInspectItem({ kind: "interview", data: found });
    } else if (kind === "resume") {
      const found = resumes.find((r) => r.id === id);
      if (found) setInspectItem({ kind: "resume", data: found });
    } else {
      const found = skillGaps.find((g) => g.id === id);
      if (found) setInspectItem({ kind: "skill-gap", data: found });
    }
  }

  // SVG Chart Geometry
  const chartPoints = analytics.timeline;
  const svgW = 720;
  const svgH = 220;
  const padX = 36;
  const padY = 24;
  const plotW = svgW - padX * 2;
  const plotH = svgH - padY * 2;
  const baseLineY = padY + plotH;

  const coords = chartPoints.map((pt, i) => {
    const x =
      chartPoints.length === 1
        ? padX + plotW / 2
        : padX + (i / (chartPoints.length - 1)) * plotW;
    const y = padY + plotH - (pt.score / 100) * plotH;
    return { x, y, ...pt };
  });

  const linePath =
    coords.length > 0
      ? coords.map((c, idx) => `${idx === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ")
      : "";

  const areaPath =
    coords.length > 1
      ? `${linePath} L ${coords[coords.length - 1].x} ${baseLineY} L ${coords[0].x} ${baseLineY} Z`
      : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
          Performance Analytics & History
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Track longitudinal readiness trends, competency strengths, and inspect saved session transcripts.
        </p>
      </div>

      {/* Top Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Trajectory Line + Area Chart */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Score Trajectory
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Chronological scores across resume audits, skill matches, and mock interviews
              </p>
            </div>
            {hoveredIdx !== null && coords[hoveredIdx] && (
              <div className="text-right text-xs">
                <div className="font-medium text-slate-900">{coords[hoveredIdx].label}</div>
                <div className="font-mono tabular-nums text-blue-700 font-semibold">
                  {coords[hoveredIdx].score}% · {new Date(coords[hoveredIdx].date).toLocaleDateString()}
                </div>
              </div>
            )}
          </div>

          {coords.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl">
              Complete a resume audit, skill gap comparison, or mock interview to plot your trajectory.
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <svg
                viewBox={`0 0 ${svgW} ${svgH}`}
                className="w-full h-56 overflow-visible"
                role="img"
                aria-label="Performance score trajectory chart"
              >
                <defs>
                  <linearGradient id="scoreAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1D4ED8" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.01" />
                  </linearGradient>
                </defs>

                {[0, 25, 50, 75, 100].map((val) => {
                  const y = padY + plotH - (val / 100) * plotH;
                  return (
                    <g key={val}>
                      <line x1={padX} y1={y} x2={svgW - padX} y2={y} stroke="#E2E8F0" strokeWidth="1" />
                      <text
                        x={padX - 8}
                        y={y + 4}
                        textAnchor="end"
                        className="fill-slate-400 text-[10px] font-mono"
                      >
                        {val}
                      </text>
                    </g>
                  );
                })}

                {areaPath && <path d={areaPath} fill="url(#scoreAreaGrad)" />}

                {coords.length > 1 && (
                  <path
                    d={linePath}
                    fill="none"
                    stroke="#1D4ED8"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {coords.map((pt, idx) => (
                  <g
                    key={pt.id}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    className="cursor-pointer"
                  >
                    {hoveredIdx === idx && (
                      <line
                        x1={pt.x}
                        y1={padY}
                        x2={pt.x}
                        y2={baseLineY}
                        stroke="#94A3B8"
                        strokeDasharray="3 3"
                        strokeWidth="1"
                      />
                    )}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={hoveredIdx === idx ? 6.5 : 4.5}
                      fill={
                        pt.kind === "interview"
                          ? "#1D4ED8"
                          : pt.kind === "resume"
                          ? "#16A34A"
                          : "#D97706"
                      }
                      stroke="#FFFFFF"
                      strokeWidth="2"
                    />
                  </g>
                ))}
              </svg>
              <div className="mt-2 flex items-center gap-5 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-700" aria-hidden="true" />
                  Mock Interview
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" aria-hidden="true" />
                  Resume Audit
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-600" aria-hidden="true" />
                  Skill Gap Match
                </span>
              </div>
            </div>
          )}
        </section>

        {/* Competency Breakdown */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6">
          <h2 className="font-display text-base font-semibold text-slate-900">Competency Profile</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Aggregated across evaluated answers, resumes, and job matches
          </p>

          <div className="mt-5 space-y-4">
            {analytics.competencies.map((comp) => (
              <div key={comp.label}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-medium text-slate-700">{comp.label}</span>
                  <span className="font-mono tabular-nums text-slate-900 font-semibold">
                    {comp.sampleCount > 0 ? `${comp.score}%` : "—"}
                    <span className="text-slate-400 font-normal ml-1.5">
                      ({comp.sampleCount})
                    </span>
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      comp.score >= 80
                        ? "bg-emerald-600"
                        : comp.score >= 60
                        ? "bg-blue-700"
                        : comp.score > 0
                        ? "bg-amber-600"
                        : "bg-slate-200"
                    }`}
                    style={{ width: `${comp.sampleCount > 0 ? comp.score : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Session History Table */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
            {(
              [
                { id: "all", label: "All Activity" },
                { id: "interview", label: "Interviews" },
                { id: "resume", label: "Resumes" },
                { id: "skill-gap", label: "Skill Gaps" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  filter === tab.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sessions..."
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        {filteredTimeline.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500">
            No matching preparation records found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-3 px-6">Session</th>
                  <th className="py-3 px-4">Module</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Score</th>
                  <th className="py-3 px-6 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredTimeline.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-6 font-medium text-slate-900">{item.label}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {item.kind === "interview"
                        ? "Mock Interview"
                        : item.kind === "resume"
                        ? "Resume Studio"
                        : "Skill Gap Matcher"}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-500">
                      {new Date(item.date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {item.score}%
                    </td>
                    <td className="py-3 px-6 text-right">
                      <button
                        type="button"
                        onClick={() => openDetail(item.kind, item.id)}
                        className="text-xs font-medium text-blue-700 hover:underline"
                      >
                        View Transcript
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Detail Inspection Modal */}
      {inspectItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-2xl max-h-[85vh] bg-white border border-slate-200 rounded-2xl shadow-xl flex flex-col overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500">
                  {inspectItem.kind === "interview"
                    ? "Interview Transcript"
                    : inspectItem.kind === "resume"
                    ? "Resume Audit Summary"
                    : "Skill Gap Summary"}
                </div>
                <h3 className="font-display text-base font-bold text-slate-900 mt-0.5">
                  {inspectItem.kind === "skill-gap" ? inspectItem.data.jobTitle : inspectItem.data.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectItem(null)}
                aria-label="Close transcript"
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-sm">
              {inspectItem.kind === "interview" && (
                <>
                  {inspectItem.data.questions.map((q) => (
                    <div key={q.id} className="pb-5 border-b border-slate-200 last:border-b-0 last:pb-0 space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>
                          Q{q.index} · {q.category}
                        </span>
                        <span className="font-mono tabular-nums font-semibold text-slate-900">
                          {q.evaluation ? `${q.evaluation.overallScore}/100` : "Unanswered"}
                        </span>
                      </div>
                      <div className="font-semibold text-slate-900">{q.question}</div>
                      {q.userAnswer && (
                        <div className="text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3">
                          <div className="text-xs font-medium text-slate-500 mb-1">Your Answer</div>
                          {q.userAnswer}
                        </div>
                      )}
                      {q.evaluation && (
                        <div className="text-xs text-slate-600">
                          <span className="font-semibold text-slate-800">Coach Takeaway: </span>
                          {q.evaluation.coachingTip}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}

              {inspectItem.kind === "resume" && (
                <>
                  <p className="text-slate-700">{inspectItem.data.executiveSummary}</p>
                  <div>
                    <div className="text-xs font-semibold text-slate-900 mb-1.5">Critical Improvements</div>
                    <ul className="space-y-1 text-slate-700">
                      {inspectItem.data.criticalImprovements.map((c, i) => (
                        <li key={i}>• {c}</li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

              {inspectItem.kind === "skill-gap" && (
                <>
                  <p className="text-slate-700">{inspectItem.data.readinessVerdict}</p>
                  <div>
                    <div className="text-xs font-semibold text-slate-900 mb-1.5">Missing Skills</div>
                    <ul className="space-y-1.5 text-slate-700">
                      {inspectItem.data.missingSkills.map((m, i) => (
                        <li key={i}>
                          <span className="font-semibold">{m.skill}</span> ({m.priority}) — {m.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
