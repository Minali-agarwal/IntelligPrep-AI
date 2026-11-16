import { Menu, Play } from "lucide-react";
import type { WorkspaceSection } from "../types/intelliprep";

interface TopBarProps {
  activeSection: WorkspaceSection;
  onStartInterview: () => void;
  onOpenMobileMenu: () => void;
}

const SECTION_LABELS: Record<WorkspaceSection, string> = {
  overview: "Overview",
  resume: "Resume Studio",
  "skill-gap": "Skill Gap Matcher",
  interview: "Mock Interview Lab",
  analytics: "Analytics & History",
};

export function TopBar({ activeSection, onStartInterview, onOpenMobileMenu }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-8">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <Menu className="h-5 w-5" />
        </button>

        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm min-w-0">
          <span className="font-medium text-slate-500 whitespace-nowrap shrink-0">IntelliPrep AI</span>
          <span className="text-slate-300 shrink-0" aria-hidden="true">/</span>
          <span className="font-semibold text-slate-900 truncate">{SECTION_LABELS[activeSection]}</span>
        </nav>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onStartInterview}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          <Play className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Start Mock Interview</span>
        </button>
      </div>
    </header>
  );
}
