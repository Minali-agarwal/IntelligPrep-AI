import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { AnalyticsView } from "./components/AnalyticsView";
import { AuthModal } from "./components/AuthModal";
import { MockInterviewView } from "./components/MockInterviewView";
import { OverviewView } from "./components/OverviewView";
import { ResumeStudioView } from "./components/ResumeStudioView";
import { Sidebar } from "./components/Sidebar";
import { SkillGapView } from "./components/SkillGapView";
import { TopBar } from "./components/TopBar";
import { api } from "./lib/api";
import type { SkillGapRecord, WorkspaceSection, WorkspaceSnapshot } from "./types/intelliprep";

export default function App() {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [activeSection, setActiveSection] = useState<WorkspaceSection>("overview");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingSample, setLoadingSample] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [openInterviewSetupSignal, setOpenInterviewSetupSignal] = useState(0);

  const [preselectedResumeId, setPreselectedResumeId] = useState<string | null>(null);
  const [interviewPrefill, setInterviewPrefill] = useState<{
    targetRole?: string;
    jobDescription?: string;
    focusTopics?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      try {
        const data = await api.getWorkspace();
        if (!cancelled) setSnapshot(data);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load IntelliPrep AI workspace.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLoadSample() {
    setLoadingSample(true);
    try {
      const next = await api.loadSampleWorkspace();
      setSnapshot(next);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load sample profile.");
    } finally {
      setLoadingSample(false);
    }
  }

  function handleCompareInSkillGap(resumeId: string) {
    setPreselectedResumeId(resumeId);
    setActiveSection("skill-gap");
  }

  function handlePracticeForGap(gap: SkillGapRecord) {
    setInterviewPrefill({
      targetRole: gap.jobTitle,
      jobDescription: gap.jobDescription,
      focusTopics: gap.missingSkills
        .slice(0, 3)
        .map((m) => m.skill)
        .join(", "),
    });
    setActiveSection("interview");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
          <div className="h-4 w-3/4 bg-slate-100 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (loadError || !snapshot) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <h1 className="font-display text-lg font-bold text-slate-900">Unable to load workspace</h1>
          <p className="text-sm text-slate-600">{loadError || "Unknown connection error."}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar
        activeSection={activeSection}
        onNavigate={setActiveSection}
        profile={snapshot.profile}
        readinessIndex={snapshot.analytics.readinessIndex}
        onOpenAccount={() => setAccountModalOpen(true)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          activeSection={activeSection}
          onStartInterview={() => {
            setActiveSection("interview");
            setOpenInterviewSetupSignal((n) => n + 1);
          }}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        <main className="flex-1 px-4 sm:px-8 py-6 sm:py-8 max-w-[1280px] w-full mx-auto">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          >
            {activeSection === "overview" && (
              <OverviewView
                snapshot={snapshot}
                onNavigate={setActiveSection}
                onLoadSample={handleLoadSample}
                loadingSample={loadingSample}
              />
            )}

            {activeSection === "resume" && (
              <ResumeStudioView
                snapshot={snapshot}
                onSnapshotUpdate={setSnapshot}
                onCompareInSkillGap={handleCompareInSkillGap}
              />
            )}

            {activeSection === "skill-gap" && (
              <SkillGapView
                snapshot={snapshot}
                preselectedResumeId={preselectedResumeId}
                onSnapshotUpdate={setSnapshot}
                onPracticeForGap={handlePracticeForGap}
              />
            )}

            {activeSection === "interview" && (
              <MockInterviewView
                snapshot={snapshot}
                prefillContext={interviewPrefill}
                openSetupSignal={openInterviewSetupSignal}
                onClearPrefill={() => setInterviewPrefill(null)}
                onSnapshotUpdate={setSnapshot}
              />
            )}

            {activeSection === "analytics" && <AnalyticsView snapshot={snapshot} />}
          </motion.div>
        </main>
      </div>

      <AuthModal
        open={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
        profile={snapshot.profile}
        onSnapshotUpdate={setSnapshot}
      />
    </div>
  );
}
