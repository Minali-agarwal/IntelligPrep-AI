import { useState } from "react";
import {
  BarChart3,
  Compass,
  FileText,
  GitCompare,
  LayoutDashboard,
  MessageSquareCode,
  UserCheck,
  X,
} from "lucide-react";
import type { UserProfile, WorkspaceSection } from "../types/intelliprep";

interface SidebarProps {
  activeSection: WorkspaceSection;
  onNavigate: (section: WorkspaceSection) => void;
  profile: UserProfile;
  readinessIndex: number;
  onOpenAccount: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: { id: WorkspaceSection; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "resume", label: "Resume Studio", icon: FileText },
  { id: "skill-gap", label: "Skill Gap Matcher", icon: GitCompare },
  { id: "interview", label: "Mock Interview Lab", icon: MessageSquareCode },
  { id: "analytics", label: "Analytics & History", icon: BarChart3 },
];

export function Sidebar({
  activeSection,
  onNavigate,
  profile,
  readinessIndex,
  onOpenAccount,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const initials = profile.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-slate-950 text-slate-100 border-r border-slate-800 w-64">
      <div>
        <div className="flex items-center justify-between px-5 h-16 border-b border-slate-800/80">
          <button
            type="button"
            onClick={() => {
              onNavigate("overview");
              onCloseMobile();
            }}
            className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-md"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shrink-0 shadow-sm">
              <Compass className="h-4 w-4" aria-hidden="true" />
            </div>
            <span className="font-display text-base font-bold tracking-tight text-white whitespace-nowrap">
              IntelliPrep AI
            </span>
          </button>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation menu"
            className="lg:hidden p-2 text-slate-400 hover:text-white rounded-md"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav aria-label="Primary Navigation" className="px-3 py-5 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onNavigate(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-300 hover:bg-slate-900 hover:text-white"
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : "text-slate-400"}`}
                  aria-hidden="true"
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mx-3 mt-2 rounded-xl bg-slate-900/90 border border-slate-800 p-4">
          <div className="text-xs font-medium text-slate-400">Active Target Track</div>
          <div className="mt-1 text-sm font-semibold text-white truncate" title={profile.targetRole}>
            {profile.targetRole}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>{profile.experienceLevel}</span>
            <span className="font-mono tabular-nums font-semibold text-blue-400">{readinessIndex}% ready</span>
          </div>
          <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.max(4, readinessIndex)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="p-3 border-t border-slate-800/80">
        <button
          type="button"
          onClick={onOpenAccount}
          className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-900 transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {!imgFailed ? (
            <img
              src="/src/assets/images/avatar_candidate_1794707335135.jpg"
              alt={profile.name}
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="h-9 w-9 rounded-lg object-cover border border-slate-700 shrink-0"
            />
          ) : (
            <div className="h-9 w-9 rounded-lg bg-slate-800 text-slate-200 flex items-center justify-center text-xs font-semibold shrink-0">
              {initials || <UserCheck className="h-4 w-4" />}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-white truncate">{profile.name}</div>
            <div className="text-xs text-slate-400 truncate">
              {profile.isGuest ? "Guest session · Sign in" : profile.email}
            </div>
          </div>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block shrink-0 h-screen sticky top-0">{sidebarContent}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
