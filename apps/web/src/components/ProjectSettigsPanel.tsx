import { useEffect, useState } from "react";
import type { Project } from "../api";
import {
  DEPARTMENT_COLOR_OPTIONS,
  LEAVE_COLOR_OPTIONS,
  getTimelineEntryType,
  normalizeColorKey,
} from "../planning";

export function ProjectSettingsPanel({
  selectedProject,
  onSave,
  onDelete,
}: {
  selectedProject: Project | null;
  onSave: (projectId: string, name: string, colorKey: string) => Promise<void>;
  onDelete: (projectId: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [colorKey, setColorKey] = useState("haematology");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedProject) {
      return;
    }

    setName(selectedProject.name);
    setColorKey(normalizeColorKey(selectedProject.colorKey));
    setErr(null);
    setBusy(false);
  }, [selectedProject]);

  if (!selectedProject) {
    return null;
  }

  const entryType = getTimelineEntryType(selectedProject.colorKey);
  const visibleOptions =
    entryType === "LEAVE" ? LEAVE_COLOR_OPTIONS : DEPARTMENT_COLOR_OPTIONS;

  return (
    <div className="mt-4 rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-zinc-500">
          Item Settings
        </div>
        <div className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
          Rename this item or change its visual type.
        </div>
      </div>

      <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">
        {entryType === "LEAVE" ? "Leave label" : "Project name"}
      </label>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="mb-3 w-full rounded-2xl bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:bg-zinc-900 dark:ring-zinc-800 dark:focus:ring-sky-800"
      />

      <label className="mb-2 block text-xs font-medium text-slate-500 dark:text-zinc-400">
        {entryType === "LEAVE" ? "Leave type" : "Department"}
      </label>
      <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
        {visibleOptions.map((option) => {
          const selected = option.key === colorKey;

          return (
            <button
              key={option.key}
              type="button"
              onClick={() => setColorKey(option.key)}
              className={[
                "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition",
                selected
                  ? "border-sky-200 bg-sky-50 dark:border-sky-900/50 dark:bg-sky-950/20"
                  : "border-slate-200/70 bg-white hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900",
              ].join(" ")}
            >
              <div
                className={[
                  "flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br text-[11px] font-bold ring-1",
                  option.swatchClassName,
                ].join(" ")}
              >
                {option.icon}
              </div>

              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                  {option.label}
                </div>
                <div className="text-xs text-slate-500 dark:text-zinc-400">
                  {option.group === "leave" ? "Leave type" : "Department"}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {err ? (
        <div className="mt-3 rounded-2xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-100 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-900/40">
          {err}
        </div>
      ) : null}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={busy || name.trim().length < 1}
          onClick={async () => {
            try {
              setBusy(true);
              setErr(null);
              await onSave(selectedProject.id, name.trim(), colorKey);
            } catch (error: any) {
              setErr(error?.message ?? "Failed to save project");
            } finally {
              setBusy(false);
            }
          }}
          className="flex-1 rounded-2xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {busy ? "Saving..." : "Save"}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            const confirmed = window.confirm(
              `Delete project "${selectedProject.name}" and all its assignments?`,
            );

            if (!confirmed) {
              return;
            }

            try {
              setBusy(true);
              setErr(null);
              await onDelete(selectedProject.id);
            } catch (error: any) {
              setErr(error?.message ?? "Failed to delete project");
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-2xl bg-red-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
