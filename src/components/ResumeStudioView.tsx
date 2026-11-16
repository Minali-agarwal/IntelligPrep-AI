import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { Check, Copy, FileText, GitCompare, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { api } from "../lib/api";
import type { ResumeAnalysisRecord, WorkspaceSnapshot } from "../types/intelliprep";
import { ScoreRing } from "./ScoreRing";

interface ResumeStudioViewProps {
  snapshot: WorkspaceSnapshot;
  onSnapshotUpdate: (snapshot: WorkspaceSnapshot) => void;
  onCompareInSkillGap: (resumeId: string) => void;
}

function getStatusText(status: "strong" | "needs-work" | "missing") {
  if (status === "strong") return { label: "Strong", cls: "text-emerald-700" };
  if (status === "needs-work") return { label: "Needs work", cls: "text-amber-700" };
  return { label: "Missing", cls: "text-red-700" };
}

export function ResumeStudioView({
  snapshot,
  onSnapshotUpdate,
  onCompareInSkillGap,
}: ResumeStudioViewProps) {
  const { resumes, profile } = snapshot;
  const [selectedId, setSelectedId] = useState<string | null>(resumes[0]?.id ?? null);
  const [showNewForm, setShowNewForm] = useState<boolean>(resumes.length === 0);

  const [title, setTitle] = useState("");
  const [targetRole, setTargetRole] = useState(profile.targetRole);
  const [resumeText, setResumeText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileBase64, setFileBase64] = useState<string | undefined>(undefined);
  const [fileMimeType, setFileMimeType] = useState<string | undefined>(undefined);
  const [isDragging, setIsDragging] = useState(false);

  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeResume: ResumeAnalysisRecord | null =
    resumes.find((r) => r.id === selectedId) || resumes[0] || null;

  async function processFile(file: File) {
    setError(null);
    setFileName(file.name);
    if (!title.trim()) {
      setTitle(file.name.replace(/\.[^/.]+$/, ""));
    }

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        const base64 = result.includes(",") ? result.split(",")[1] : result;
        setFileBase64(base64);
        setFileMimeType("application/pdf");
      };
      reader.readAsDataURL(file);
    } else {
      const text = await file.text();
      setResumeText(text);
      setFileBase64(undefined);
      setFileMimeType(undefined);
    }
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
  }

  async function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await processFile(file);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!targetRole.trim()) {
      setError("Please enter a Target Role before auditing your resume.");
      return;
    }
    if (!fileBase64 && resumeText.trim().length < 10) {
      setError("Please upload a PDF/TXT resume or paste at least 10 characters of resume text.");
      return;
    }
    setAnalyzing(true);
    try {
      const result = await api.analyzeResume({
        title: title.trim() || undefined,
        fileName,
        targetRole: targetRole.trim() || profile.targetRole,
        resumeText: resumeText.trim() || undefined,
        fileBase64,
        fileMimeType,
      });
      onSnapshotUpdate(result.snapshot);
      setSelectedId(result.record.id);
      setShowNewForm(false);
      setTitle("");
      setResumeText("");
      setFileName(null);
      setFileBase64(undefined);
      setFileMimeType(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze resume.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const next = await api.deleteResume(id);
      onSnapshotUpdate(next);
      if (selectedId === id) {
        setSelectedId(next.resumes[0]?.id ?? null);
        if (next.resumes.length === 0) setShowNewForm(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete resume.");
    }
  }

  async function copyRewrite(text: string, idx: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1800);
    } catch {
      // Clipboard blocked
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">Resume Studio</h1>
          <p className="text-sm text-slate-600 mt-1">
            Audit ATS structure, uncover missing role keywords, and generate quantified bullet rewrites.
          </p>
        </div>
        {resumes.length > 0 && (
          <button
            type="button"
            onClick={() => setShowNewForm((prev) => !prev)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>{showNewForm ? "Back to Report" : "Audit New Resume"}</span>
          </button>
        )}
      </div>

      {/* Saved Resumes Strip */}
      {resumes.length > 0 && !showNewForm && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="text-xs font-medium text-slate-500 mr-1 whitespace-nowrap">Saved audits:</span>
            {resumes.map((res) => (
              <button
                key={res.id}
                type="button"
                onClick={() => setSelectedId(res.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  activeResume?.id === res.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {res.title} · <span className="font-mono tabular-nums">{res.overallScore}%</span>
              </button>
            ))}
          </div>
          {activeResume && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onCompareInSkillGap(activeResume.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors whitespace-nowrap"
              >
                <GitCompare className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Compare with JD</span>
              </button>
              <button
                type="button"
                onClick={() => handleDelete(activeResume.id)}
                aria-label="Delete selected resume audit"
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

      {/* Upload / Paste Form */}
      {showNewForm && (
        <form noValidate onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="res-title" className="block text-sm font-medium text-slate-700 mb-1">
                Resume Label
              </label>
              <input
                id="res-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Backend Engineer V2"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label htmlFor="res-role" className="block text-sm font-medium text-slate-700 mb-1">
                Target Role
              </label>
              <input
                id="res-role"
                type="text"
                value={targetRole}
                onChange={(e) => {
                  setTargetRole(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g., Full-Stack Software Engineer"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`rounded-xl border-2 border-dashed p-5 transition-colors ${
              isDragging ? "border-blue-600 bg-blue-50/60" : "border-slate-200 bg-slate-50/70"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-blue-700 shrink-0">
                  <Upload className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {fileName ? fileName : "Drop your PDF, TXT, or Markdown resume here"}
                  </div>
                  <div className="text-xs text-slate-500">
                    {fileBase64
                      ? "PDF attached for multimodal extraction and ATS audit"
                      : "Or paste your resume text in the editor below"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {fileBase64 && (
                  <button
                    type="button"
                    onClick={() => {
                      setFileName(null);
                      setFileBase64(undefined);
                      setFileMimeType(undefined);
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 rounded-lg"
                  >
                    Remove
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Choose File
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.md,application/pdf,text/plain"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          {!fileBase64 && (
            <div>
              <label htmlFor="res-text" className="block text-sm font-medium text-slate-700 mb-1.5">
                Resume Text
              </label>
              <textarea
                id="res-text"
                rows={9}
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="Paste your complete resume text here (experience, projects, skills, education)..."
                className="w-full px-3.5 py-2.5 text-sm font-sans border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            {resumes.length > 0 && (
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
              <span>{analyzing ? "Analyzing Resume..." : "Run Resume Audit"}</span>
            </button>
          </div>
        </form>
      )}

      {/* Active Analysis Report */}
      {!showNewForm && activeResume && (
        <div className="space-y-6">
          {/* Score Header + Ring + 4 Breakdown Metrics */}
          <section className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 pb-6 border-b border-slate-200">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <FileText className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                  <span>Target Role: {activeResume.targetRole}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {new Date(activeResume.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <h2 className="mt-1.5 font-display text-xl font-bold text-slate-900">{activeResume.title}</h2>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{activeResume.executiveSummary}</p>
              </div>
              <div className="shrink-0 flex items-center gap-4">
                <ScoreRing score={activeResume.overallScore} size={104} strokeWidth={8} label="Overall" />
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-6">
              {[
                { label: "ATS Compatibility", val: activeResume.atsCompatibility },
                { label: "Quantified Impact", val: activeResume.impactMetrics },
                { label: "Clarity & Structure", val: activeResume.clarityFormatting },
                { label: "Keyword Strength", val: activeResume.keywordStrength },
              ].map((metric) => (
                <div key={metric.label}>
                  <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
                    <span>{metric.label}</span>
                    <span className="font-mono tabular-nums font-semibold text-slate-900">{metric.val}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        metric.val >= 80
                          ? "bg-emerald-600"
                          : metric.val >= 60
                          ? "bg-blue-700"
                          : "bg-amber-600"
                      }`}
                      style={{ width: `${metric.val}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Strengths & Critical Improvements */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="bg-white border border-slate-200 rounded-xl p-6">
              <h3 className="font-display text-base font-semibold text-slate-900">Verified Strengths</h3>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-700">
                {activeResume.strengths.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="font-mono text-xs font-bold text-emerald-700 mt-0.5">+</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="bg-white border border-slate-200 rounded-xl p-6">
              <h3 className="font-display text-base font-semibold text-slate-900">High-Leverage Improvements</h3>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-700">
                {activeResume.criticalImprovements.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="font-mono text-xs font-bold text-amber-700 mt-0.5">!</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              {activeResume.missingKeywords.length > 0 && (
                <div className="mt-5 pt-4 border-t border-slate-200">
                  <div className="text-xs font-medium text-slate-500">Recommended Role Keywords to Surface</div>
                  <div className="mt-1.5 text-sm font-mono text-slate-800 leading-relaxed">
                    {activeResume.missingKeywords.join(" · ")}
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Quantified Bullet Rewrites */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="font-display text-base font-semibold text-slate-900">
                Suggested Bullet Rewrites
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Action-oriented, quantified upgrades ready to paste back into your resume
              </p>
            </div>
            <div className="divide-y divide-slate-200">
              {activeResume.bulletRewrites.map((rw, idx) => (
                <div key={idx} className="p-6 space-y-3">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200/80">
                      <div className="text-xs font-medium text-slate-500 mb-1.5">Original Bullet</div>
                      <p className="text-sm text-slate-600 leading-relaxed">{rw.original}</p>
                    </div>
                    <div className="bg-emerald-50/50 rounded-lg p-4 border border-emerald-200/80">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-emerald-800">Suggested Rewrite</span>
                        <button
                          type="button"
                          onClick={() => copyRewrite(rw.improved, idx)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900"
                        >
                          {copiedIdx === idx ? (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-sm font-medium text-slate-900 leading-relaxed">{rw.improved}</p>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">Rationale: {rw.rationale}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Section Breakdown Table */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="font-display text-base font-semibold text-slate-900">Section-by-Section Audit</h3>
            </div>
            <div className="divide-y divide-slate-200">
              {activeResume.sectionFeedback.map((sec, idx) => {
                const st = getStatusText(sec.status);
                return (
                  <div key={idx} className="px-6 py-4 flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="sm:w-44 shrink-0">
                      <div className="text-sm font-semibold text-slate-900">{sec.section}</div>
                      <div className={`text-xs font-medium mt-0.5 ${st.cls}`}>{st.label}</div>
                    </div>
                    <div className="flex-1 text-sm text-slate-700 space-y-1.5">
                      <p>{sec.summary}</p>
                      {sec.actionItems.length > 0 && (
                        <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
                          {sec.actionItems.map((act, k) => (
                            <li key={k}>{act}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
