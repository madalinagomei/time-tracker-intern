import type { Project } from "../api";
import { getColorOption, isLeaveColorKey } from "../planning";

export function SidebarProjects({
  projects,
  selectedProjectId,
  onSelect,
}: {
  projects: Project[];
  selectedProjectId: string | null;
  onSelect: (id: string) => void;
}) {
  const activeProjects = projects.filter(
    (project) => !isLeaveColorKey(project.colorKey),
  );
  const leaveProjects = projects.filter((project) =>
    isLeaveColorKey(project.colorKey),
  );

  function renderProjectList(items: Project[], title: string) {
    return (
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-zinc-500">
            {title}
          </div>
          <div className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800">
            {items.length}
          </div>
        </div>

        <div className="space-y-2">
          {items.map((project) => {
            const visual = getColorOption(project.colorKey);
            const selected = project.id === selectedProjectId;
            const assignmentCount = project.assignments?.length ?? 0;

            return (
              <button
                key={project.id}
                type="button"
                onClick={() => onSelect(project.id)}
                className={[
                  "w-full rounded-2xl border px-3 py-3 text-left transition",
                  selected
                    ? "border-sky-200 bg-sky-50 shadow-sm dark:border-sky-900/60 dark:bg-sky-950/20"
                    : "border-slate-200/80 bg-white/90 hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900",
                ].join(" ")}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={[
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-[11px] font-bold ring-1",
                      visual.swatchClassName,
                    ].join(" ")}
                  >
                    {visual.icon}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-sm font-semibold text-slate-900 dark:text-zinc-100">
                        {project.name}
                      </div>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span
                        className={[
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                          visual.pillClassName,
                        ].join(" ")}
                      >
                        {visual.label}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                        {assignmentCount} assignment
                        {assignmentCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}

          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-3 text-sm text-slate-500 dark:border-zinc-800 dark:text-zinc-400">
              No items here yet.
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {renderProjectList(activeProjects, "Projects")}
      {renderProjectList(leaveProjects, "Leave")}
    </div>
  );
}
