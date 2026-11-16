import { useState, type FormEvent } from "react";
import { LogOut, X } from "lucide-react";
import { api } from "../lib/api";
import type { ExperienceLevel, UserProfile, WorkspaceSnapshot } from "../types/intelliprep";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  profile: UserProfile;
  onSnapshotUpdate: (snapshot: WorkspaceSnapshot) => void;
}

const EXPERIENCE_LEVELS: ExperienceLevel[] = [
  "Student / Intern",
  "Entry-Level",
  "Mid-Level",
  "Senior",
];

export function AuthModal({ open, onClose, profile, onSnapshotUpdate }: AuthModalProps) {
  const [tab, setTab] = useState<"profile" | "login" | "register">("profile");
  const [name, setName] = useState(profile.name);
  const [targetRole, setTargetRole] = useState(profile.targetRole);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(profile.experienceLevel);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!open) return null;

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const snapshot = await api.updateProfile({ name, targetRole, experienceLevel });
      onSnapshotUpdate(snapshot);
      setMessage("Profile preferences saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const snapshot = await api.register({ name, email, password, targetRole, experienceLevel });
      onSnapshotUpdate(snapshot);
      setPassword("");
      setTab("profile");
      setMessage("Account created and workspace synced.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const snapshot = await api.login({ email, password });
      onSnapshotUpdate(snapshot);
      setPassword("");
      setName(snapshot.profile.name);
      setTargetRole(snapshot.profile.targetRole);
      setExperienceLevel(snapshot.profile.experienceLevel);
      setTab("profile");
      setMessage("Signed in successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoading(true);
    setError(null);
    try {
      const snapshot = await api.logout();
      onSnapshotUpdate(snapshot);
      setName(snapshot.profile.name);
      setTargetRole(snapshot.profile.targetRole);
      setExperienceLevel(snapshot.profile.experienceLevel);
      setTab("profile");
      setMessage("Signed out. Switched to fresh guest workspace.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-out failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-modal-title"
        className="w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 id="account-modal-title" className="font-display text-lg font-semibold text-slate-900">
              Candidate Profile & Account
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {profile.isGuest ? "Guest Workspace" : `Signed in as ${profile.email}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 pt-4">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setTab("profile");
                setError(null);
                setMessage(null);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                tab === "profile" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Role Preferences
            </button>
            {profile.isGuest && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setTab("register");
                    setError(null);
                    setMessage(null);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    tab === "register" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Save Account
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab("login");
                    setError(null);
                    setMessage(null);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    tab === "login" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Sign In
                </button>
              </>
            )}
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 px-3.5 py-2.5 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}
          {message && (
            <div className="mb-4 px-3.5 py-2.5 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg">
              {message}
            </div>
          )}

          {tab === "profile" && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label htmlFor="prof-name" className="block text-sm font-medium text-slate-700 mb-1">
                  Display Name
                </label>
                <input
                  id="prof-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label htmlFor="prof-role" className="block text-sm font-medium text-slate-700 mb-1">
                  Target Role
                </label>
                <input
                  id="prof-role"
                  type="text"
                  required
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="e.g., Full-Stack Software Engineer"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label htmlFor="prof-exp" className="block text-sm font-medium text-slate-700 mb-1">
                  Experience Level
                </label>
                <select
                  id="prof-exp"
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value as ExperienceLevel)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {EXPERIENCE_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between pt-2">
                {!profile.isGuest ? (
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </button>
                ) : (
                  <span className="text-xs text-slate-500">
                    Register in "Save Account" to protect your history with a password.
                  </span>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors disabled:opacity-60"
                >
                  {loading ? "Saving..." : "Save Preferences"}
                </button>
              </div>
            </form>
          )}

          {tab === "register" && (
            <form onSubmit={handleRegister} className="space-y-4">
              <p className="text-xs text-slate-600">
                Creating an account preserves all resumes, skill gap plans, and mock interviews in your current session.
              </p>
              <div>
                <label htmlFor="reg-name" className="block text-sm font-medium text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  id="reg-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label htmlFor="reg-email" className="block text-sm font-medium text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label htmlFor="reg-pass" className="block text-sm font-medium text-slate-700 mb-1">
                  Password (min. 6 characters)
                </label>
                <input
                  id="reg-pass"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors disabled:opacity-60"
                >
                  {loading ? "Creating Account..." : "Create Account"}
                </button>
              </div>
            </form>
          )}

          {tab === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label htmlFor="login-pass" className="block text-sm font-medium text-slate-700 mb-1">
                  Password
                </label>
                <input
                  id="login-pass"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors disabled:opacity-60"
                >
                  {loading ? "Signing In..." : "Sign In"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
