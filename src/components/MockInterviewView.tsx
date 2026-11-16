import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Clock,
  Code2,
  HelpCircle,
  Layers,
  Loader2,
  Mic,
  MicOff,
  Plus,
  RotateCcw,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import { api } from "../lib/api";
import type {
  DifficultyLevel,
  InterviewType,
  MockInterviewSession,
  WorkspaceSnapshot,
} from "../types/intelliprep";
import { ScoreRing } from "./ScoreRing";

interface MockInterviewViewProps {
  snapshot: WorkspaceSnapshot;
  prefillContext: {
    targetRole?: string;
    jobDescription?: string;
    focusTopics?: string;
  } | null;
  openSetupSignal: number;
  onClearPrefill: () => void;
  onSnapshotUpdate: (snapshot: WorkspaceSnapshot) => void;
}

const INTERVIEW_MODE_CARDS: {
  id: InterviewType;
  title: string;
  desc: string;
  icon: typeof Layers;
}[] = [
  {
    id: "Mixed",
    title: "Mixed Loop",
    desc: "Balanced blend of technical depth, debugging, and STAR behavioral prompts.",
    icon: Layers,
  },
  {
    id: "Technical",
    title: "Technical Deep Dive",
    desc: "Core concepts, debugging scenarios, performance tuning, and API trade-offs.",
    icon: Code2,
  },
  {
    id: "Behavioral",
    title: "Behavioral (STAR)",
    desc: "Leadership, conflict resolution, ownership, and cross-functional impact.",
    icon: Users,
  },
  {
    id: "System Design",
    title: "System Design",
    desc: "Scalable architectures, data modeling, caching, and reliability decisions.",
    icon: Layers,
  },
];

const DIFFICULTIES: DifficultyLevel[] = ["Junior", "Mid-Level", "Senior"];

function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function MockInterviewView({
  snapshot,
  prefillContext,
  openSetupSignal,
  onClearPrefill,
  onSnapshotUpdate,
}: MockInterviewViewProps) {
  const { interviews, resumes, profile } = snapshot;
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    interviews.find((i) => i.status === "in-progress")?.id || interviews[0]?.id || null
  );
  const [showSetup, setShowSetup] = useState<boolean>(interviews.length === 0 || Boolean(prefillContext));
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);

  // Setup state
  const [interviewType, setInterviewType] = useState<InterviewType>("Mixed");
  const [targetRole, setTargetRole] = useState(prefillContext?.targetRole || profile.targetRole);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("Mid-Level");
  const [questionCount, setQuestionCount] = useState<number>(4);
  const [focusTopics, setFocusTopics] = useState(prefillContext?.focusTopics || "");
  const [resumeId, setResumeId] = useState<string>(resumes[0]?.id || "");
  const [jobDescription, setJobDescription] = useState(prefillContext?.jobDescription || "");

  // Active answer state
  const [answerDraft, setAnswerDraft] = useState("");
  const [isEditingEvaluated, setIsEditingEvaluated] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [showModelAnswer, setShowModelAnswer] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [speechNotice, setSpeechNotice] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const evaluationCardRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (prefillContext) {
      if (prefillContext.targetRole) setTargetRole(prefillContext.targetRole);
      if (prefillContext.jobDescription) setJobDescription(prefillContext.jobDescription);
      if (prefillContext.focusTopics) setFocusTopics(prefillContext.focusTopics);
      setShowSetup(true);
      onClearPrefill();
    }
  }, [prefillContext, onClearPrefill]);

  useEffect(() => {
    if (openSetupSignal > 0) {
      const inProgress = interviews.find((i) => i.status === "in-progress");
      if (inProgress) {
        setActiveSessionId(inProgress.id);
        const nextIdx = inProgress.questions.findIndex((q) => !q.evaluation);
        setCurrentQuestionIdx(nextIdx >= 0 ? nextIdx : 0);
        setShowSetup(false);
      } else {
        setShowSetup(true);
      }
    }
  }, [openSetupSignal]);

  const activeSession: MockInterviewSession | null =
    interviews.find((i) => i.id === activeSessionId) || interviews[0] || null;

  const activeQuestion = activeSession?.questions[currentQuestionIdx] || null;

  // Timer for active question
  useEffect(() => {
    if (showSetup || !activeSession || !activeQuestion || (activeQuestion.evaluation && !isEditingEvaluated)) {
      return;
    }
    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [showSetup, activeSession, activeQuestion, isEditingEvaluated]);

  // Sync draft when switching question or session
  useEffect(() => {
    if (activeQuestion) {
      setAnswerDraft(activeQuestion.userAnswer || "");
      setElapsedSeconds(activeQuestion.durationSeconds || 0);
      setShowHint(false);
      setShowModelAnswer(false);
      setIsEditingEvaluated(false);
      setValidationError(null);
    }
  }, [activeSession?.id, currentQuestionIdx]);

  function stopVoiceRecognition() {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }

  function toggleVoiceDictation() {
    if (isRecording) {
      stopVoiceRecognition();
      return;
    }
    setSpeechNotice(null);
    const SpeechRecognitionCtor =
      (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setSpeechNotice("Voice dictation is not supported in this browser. Type your response below.");
      return;
    }

    interface SpeechRecInstance {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onresult: (e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void;
      onerror: () => void;
      onend: () => void;
      start: () => void;
      stop: () => void;
    }

    const recognition = new SpeechRecognitionCtor() as SpeechRecInstance;
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let appended = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          appended += event.results[i][0].transcript + " ";
        }
      }
      if (appended) {
        setAnswerDraft((prev) => (prev ? `${prev.trimEnd()} ${appended.trim()}` : appended.trim()));
      }
    };
    recognition.onerror = () => {
      setIsRecording(false);
      setSpeechNotice("Microphone access was blocked or unavailable.");
    };
    recognition.onend = () => {
      setIsRecording(false);
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsRecording(true);
    } catch {
      setSpeechNotice("Unable to start microphone dictation.");
    }
  }

  async function handleGenerateSession(e: FormEvent) {
    e.preventDefault();
    setGenerating(true);
    setError(null);
    stopVoiceRecognition();
    try {
      const result = await api.generateInterview({
        interviewType,
        targetRole: targetRole.trim() || profile.targetRole,
        difficulty,
        questionCount,
        focusTopics: focusTopics.trim() || undefined,
        resumeId: resumeId || null,
        jobDescription: jobDescription.trim() || undefined,
      });
      onSnapshotUpdate(result.snapshot);
      setActiveSessionId(result.session.id);
      setCurrentQuestionIdx(0);
      setAnswerDraft("");
      setElapsedSeconds(0);
      setIsEditingEvaluated(false);
      setShowSetup(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create mock interview.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmitAnswer(e: FormEvent) {
    e.preventDefault();
    if (!activeSession || !activeQuestion) return;

    const trimmed = answerDraft.trim();
    if (trimmed.length < 2) {
      setValidationError("Please type or dictate your response before clicking Submit & Evaluate.");
      return;
    }

    stopVoiceRecognition();
    setValidationError(null);
    setError(null);
    setEvaluating(true);

    try {
      const result = await api.submitInterviewAnswer(activeSession.id, {
        questionId: activeQuestion.id,
        userAnswer: trimmed,
        durationSeconds: elapsedSeconds,
      });
      onSnapshotUpdate(result.snapshot);
      setIsEditingEvaluated(false);
      window.setTimeout(() => {
        evaluationCardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to evaluate answer. Please try again.");
    } finally {
      setEvaluating(false);
    }
  }

  async function handleCompleteEarly() {
    if (!activeSession) return;
    setError(null);
    try {
      const result = await api.completeInterview(activeSession.id);
      onSnapshotUpdate(result.snapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete session.");
    }
  }

  async function handleDeleteSession(id: string) {
    try {
      const next = await api.deleteInterview(id);
      onSnapshotUpdate(next);
      if (activeSessionId === id) {
        setActiveSessionId(next.interviews[0]?.id ?? null);
        if (next.interviews.length === 0) setShowSetup(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete session.");
    }
  }

  const answeredCount = activeSession
    ? activeSession.questions.filter((q) => q.evaluation !== null).length
    : 0;
  const totalCount = activeSession ? activeSession.questions.length : 0;
  const progressPct = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;
  const canSubmitOrEdit = !activeQuestion?.evaluation || isEditingEvaluated;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Mock Interview Lab
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Practice technical, STAR behavioral, and system design questions with instant rubric scoring.
          </p>
        </div>
        {interviews.length > 0 && (
          <button
            type="button"
            onClick={() => {
              stopVoiceRecognition();
              setShowSetup((prev) => !prev);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>{showSetup ? "Back to Active Drill" : "New Interview Drill"}</span>
          </button>
        )}
      </div>

      {/* Session Selector */}
      {interviews.length > 0 && !showSetup && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="text-xs font-medium text-slate-500 mr-1 whitespace-nowrap">Sessions:</span>
            {interviews.map((sess) => (
              <button
                key={sess.id}
                type="button"
                onClick={() => {
                  setActiveSessionId(sess.id);
                  const firstUnanswered = sess.questions.findIndex((q) => !q.evaluation);
                  setCurrentQuestionIdx(firstUnanswered >= 0 ? firstUnanswered : 0);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  activeSession?.id === sess.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {sess.title} ·{" "}
                <span className="font-mono tabular-nums">
                  {sess.overallScore !== null ? `${sess.overallScore}%` : "In progress"}
                </span>
              </button>
            ))}
          </div>
          {activeSession && (
            <button
              type="button"
              onClick={() => handleDeleteSession(activeSession.id)}
              aria-label="Delete interview session"
              className="p-1.5 text-slate-400 hover:text-red-700 rounded-md transition-colors shrink-0"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="px-4 py-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl">
          {error}
        </div>
      )}

      {/* Drill Configuration Form */}
      {showSetup && (
        <form onSubmit={handleGenerateSession} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
          <div>
            <div className="text-sm font-semibold text-slate-900 mb-3">Choose Interview Format</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {INTERVIEW_MODE_CARDS.map((card) => {
                const Icon = card.icon;
                const selected = interviewType === card.id;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setInterviewType(card.id)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      selected
                        ? "border-blue-600 bg-blue-50/70 ring-1 ring-blue-600"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 mb-2 ${selected ? "text-blue-700" : "text-slate-500"}`}
                      aria-hidden="true"
                    />
                    <div className="text-sm font-semibold text-slate-900">{card.title}</div>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">{card.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="int-role" className="block text-sm font-medium text-slate-700 mb-1">
                Target Role
              </label>
              <input
                id="int-role"
                type="text"
                required
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label htmlFor="int-diff" className="block text-sm font-medium text-slate-700 mb-1">
                Difficulty Level
              </label>
              <select
                id="int-diff"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="int-count" className="block text-sm font-medium text-slate-700 mb-1">
                Questions
              </label>
              <select
                id="int-count"
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value={3}>3 Questions (Quick Drill)</option>
                <option value={4}>4 Questions (Standard)</option>
                <option value={6}>6 Questions (Full Loop)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="int-topics" className="block text-sm font-medium text-slate-700 mb-1">
                Focus Topics (optional)
              </label>
              <input
                id="int-topics"
                type="text"
                value={focusTopics}
                onChange={(e) => setFocusTopics(e.target.value)}
                placeholder="e.g., React state, SQL indexing, conflict resolution"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label htmlFor="int-resume" className="block text-sm font-medium text-slate-700 mb-1">
                Tailor to Saved Resume (optional)
              </label>
              <select
                id="int-resume"
                value={resumeId}
                onChange={(e) => setResumeId(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="">General questions (no resume attached)</option>
                {resumes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="int-jd" className="block text-sm font-medium text-slate-700 mb-1">
              Target Job Description Context (optional)
            </label>
            <textarea
              id="int-jd"
              rows={3}
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste a job description snippet to tailor technical & behavioral prompts..."
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            {interviews.length > 0 && (
              <button
                type="button"
                onClick={() => setShowSetup(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={generating}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors disabled:opacity-60"
            >
              {generating && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              <span>{generating ? "Generating Tailored Questions..." : "Start Mock Interview"}</span>
            </button>
          </div>
        </form>
      )}

      {/* Active Interview Workspace */}
      {!showSetup && activeSession && activeQuestion && (
        <div className="space-y-6">
          {/* Question Stepper + Overall Progress */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 overflow-x-auto">
                {activeSession.questions.map((q, idx) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentQuestionIdx(idx)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap font-mono tabular-nums ${
                      idx === currentQuestionIdx
                        ? "bg-blue-700 text-white shadow-sm"
                        : q.evaluation
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    Q{idx + 1}
                    {q.evaluation ? ` · ${q.evaluation.overallScore}%` : ""}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-500 shrink-0">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                  <span className="font-mono tabular-nums font-semibold text-slate-900">
                    {formatSeconds(elapsedSeconds)}
                  </span>
                </span>
                <span className="font-mono tabular-nums text-slate-500">
                  {answeredCount}/{totalCount} evaluated
                </span>
                {activeSession.status === "in-progress" && answeredCount > 0 && (
                  <button
                    type="button"
                    onClick={handleCompleteEarly}
                    className="font-medium text-blue-700 hover:underline"
                  >
                    Finish Session
                  </button>
                )}
              </div>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Question Stage + Answer Editor */}
          <section className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
            {/* Dark Slate Question Header */}
            <div className="bg-slate-950 text-white p-6 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-300">
                  Question <span className="font-mono tabular-nums text-white">{activeQuestion.index}</span> of{" "}
                  <span className="font-mono tabular-nums text-white">{activeSession.questions.length}</span> ·{" "}
                  <span className="text-blue-300 font-medium">{activeQuestion.category}</span> ·{" "}
                  {activeQuestion.difficulty} · {activeQuestion.idealFramework}
                </div>
                <button
                  type="button"
                  onClick={() => setShowHint((h) => !h)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white"
                >
                  <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{showHint ? "Hide Hint" : "Show Hint"}</span>
                </button>
              </div>

              <h2 className="font-display text-lg sm:text-xl font-semibold text-white leading-snug">
                {activeQuestion.question}
              </h2>

              {showHint && (
                <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200">
                  <span className="font-semibold text-blue-300">Coach Hint: </span>
                  {activeQuestion.hint}
                </div>
              )}
            </div>

            {/* White Answer Editor */}
            <form onSubmit={handleSubmitAnswer} className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="ans-input" className="text-sm font-semibold text-slate-900">
                  Your Response
                </label>
                <div className="flex items-center gap-2">
                  {activeQuestion.evaluation && !isEditingEvaluated && (
                    <button
                      type="button"
                      onClick={() => setIsEditingEvaluated(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Edit & Re-evaluate</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={toggleVoiceDictation}
                    disabled={!canSubmitOrEdit}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                      isRecording
                        ? "bg-red-50 text-red-700 border border-red-200"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {isRecording ? (
                      <>
                        <MicOff className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Stop Dictation</span>
                      </>
                    ) : (
                      <>
                        <Mic className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Voice Dictation</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {speechNotice && <div className="text-xs text-amber-700">{speechNotice}</div>}

              <textarea
                id="ans-input"
                rows={7}
                value={answerDraft}
                disabled={!canSubmitOrEdit || evaluating}
                onChange={(e) => {
                  setAnswerDraft(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                placeholder={
                  activeQuestion.category.toLowerCase().includes("behavioral")
                    ? "Structure your answer with Situation, Task, Action, and measurable Result..."
                    : "Explain your approach, trade-offs, edge cases, and concrete reasoning..."
                }
                className="w-full px-4 py-3 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-slate-50 disabled:text-slate-700"
              />

              {validationError && (
                <div className="text-xs font-medium text-red-700">{validationError}</div>
              )}

              {canSubmitOrEdit && (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <span className="text-xs text-slate-500 font-mono tabular-nums">
                    {answerDraft.trim().split(/\s+/).filter(Boolean).length} words
                  </span>
                  <div className="flex items-center gap-2">
                    {isEditingEvaluated && (
                      <button
                        type="button"
                        onClick={() => {
                          setAnswerDraft(activeQuestion.userAnswer || "");
                          setIsEditingEvaluated(false);
                          setValidationError(null);
                        }}
                        className="px-3.5 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={evaluating}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors disabled:opacity-60 shadow-sm"
                    >
                      {evaluating ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Send className="h-4 w-4" aria-hidden="true" />
                      )}
                      <span>{evaluating ? "Evaluating Answer..." : "Submit & Evaluate"}</span>
                    </button>
                  </div>
                </div>
              )}
            </form>
          </section>

          {/* AI Evaluation Result */}
          {activeQuestion.evaluation && (
            <section
              ref={evaluationCardRef}
              className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-200">
                <div className="max-w-2xl">
                  <div className="text-xs font-semibold text-blue-700">AI Rubric Evaluation</div>
                  <h3 className="font-display text-lg font-bold text-slate-900 mt-1">
                    {activeQuestion.evaluation.coachingTip}
                  </h3>
                </div>
                <div className="shrink-0">
                  <ScoreRing
                    score={activeQuestion.evaluation.overallScore}
                    size={96}
                    strokeWidth={8}
                    label="Score"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                {[
                  { label: "Domain / Technical", val: activeQuestion.evaluation.technicalAccuracy },
                  { label: "Structure & Flow", val: activeQuestion.evaluation.structureClarity },
                  { label: "Depth & Relevance", val: activeQuestion.evaluation.depthRelevance },
                  { label: "Ownership & Poise", val: activeQuestion.evaluation.confidenceOwnership },
                ].map((r) => (
                  <div key={r.label}>
                    <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
                      <span>{r.label}</span>
                      <span className="font-mono tabular-nums font-semibold text-slate-900">{r.val}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          r.val >= 80 ? "bg-emerald-600" : r.val >= 60 ? "bg-blue-700" : "bg-amber-600"
                        }`}
                        style={{ width: `${r.val}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                <div className="bg-emerald-50/50 border border-emerald-200/70 rounded-xl p-4">
                  <div className="text-xs font-semibold text-emerald-800">What Worked Well</div>
                  <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
                    {activeQuestion.evaluation.strengths.map((s, i) => (
                      <li key={i}>• {s}</li>
                    ))}
                  </ul>
                </div>
                <div className="bg-amber-50/50 border border-amber-200/70 rounded-xl p-4">
                  <div className="text-xs font-semibold text-amber-800">How to Level Up</div>
                  <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
                    {activeQuestion.evaluation.improvements.map((imp, i) => (
                      <li key={i}>• {imp}</li>
                    ))}
                  </ul>
                  {activeQuestion.evaluation.missedPoints.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-amber-200/70 text-xs text-slate-600">
                      Missed concepts: {activeQuestion.evaluation.missedPoints.join(" · ")}
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModelAnswer((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-900"
                >
                  {showModelAnswer ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  <span>{showModelAnswer ? "Hide Model Answer" : "Compare with Strong Model Answer"}</span>
                </button>
                {showModelAnswer && (
                  <p className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 leading-relaxed">
                    {activeQuestion.evaluation.modelAnswer}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                {currentQuestionIdx < activeSession.questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentQuestionIdx((idx) => idx + 1)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors"
                  >
                    <span>Next Question</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSetup(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <span>Start Another Drill</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
