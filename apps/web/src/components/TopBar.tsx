import type { Me } from "../api";
import type { Theme } from "../theme";
import { getAvatarTone } from "../planning";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function TopBar({
  me,
  theme,
  onToggleTheme,
  onNewProject,
  onToggleProjects,
  projectsOpen,
  onLogout,
}: {
  me: Me;
  theme: Theme;
  onToggleTheme: () => void;
  onNewProject: () => void;
  onToggleProjects: () => void;
  projectsOpen: boolean;
  onLogout: () => void;
}) {
  const avatarTone = getAvatarTone(me.id);

  return (
    <div className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="flex h-16 w-full items-center justify-between px-4 lg:px-5">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-3xl bg-[linear-gradient(135deg,#0f172a,#1d4ed8)] text-sm font-semibold text-white shadow-lg shadow-sky-500/10">
            T
          </div>

          <div>
            <div className="text-lg font-semibold text-slate-900 dark:text-zinc-100">
              Timeline
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleProjects}
            className={[
              "rounded-2xl px-3 py-2 text-sm font-medium ring-1 transition",
              projectsOpen
                ? "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/20 dark:text-sky-200 dark:ring-sky-900/50"
                : "bg-slate-100 text-slate-700 ring-slate-200 hover:bg-slate-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800 dark:hover:bg-zinc-800",
            ].join(" ")}
          >
            Projects
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800 dark:hover:bg-zinc-800"
            title="Toggle theme"
          >
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>

          <button
            type="button"
            onClick={onNewProject}
            className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-sky-500/20 transition hover:bg-sky-700"
          >
            New project
          </button>

          <div className="flex items-center gap-3 rounded-3xl border border-slate-200/80 bg-white px-3 py-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div
              className={[
                "flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br text-[11px] font-semibold ring-1 shadow-sm",
                avatarTone,
                "dark:ring-white/10",
              ].join(" ")}
            >
              {initials(me.displayName)}
            </div>

            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900 dark:text-zinc-100">
                {me.displayName}
              </div>
              <div className="truncate text-xs text-slate-500 dark:text-zinc-400">
                {me.role}
              </div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="rounded-xl bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800 dark:hover:bg-zinc-800"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
