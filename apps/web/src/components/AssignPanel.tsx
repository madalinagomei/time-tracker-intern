import { useEffect, useState } from "react";
import type { Project, UserRow } from "../api";
import { getColorOption } from "../planning";

function isoDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function AssignPanel({
  selectedProject,
  users,
  onAssign,
}: {
  selectedProject: Project | null;
  users: UserRow[];
  onAssign: (
    userId: string,
    startDate: string,
    lengthDays: number,
  ) => Promise<void>;
}) {
  const [userId, setUserId] = useState("");
  const [startDate, setStartDate] = useState(isoDateOnly(new Date()));
  const [lengthDays, setLengthDays] = useState(3);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (users.length > 0 && !userId) {
      setUserId(users[0].id);
    }
  }, [userId, users]);

  useEffect(() => {
    setErr(null);
  }, [selectedProject]);

  if (!selectedProject) {
    return (
      <div className="mt-4 rounded-3xl border border-dashed border-slate-200 bg-white/80 p-4 text-sm text-slate-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
        Select a project to use the sidebar assign form. The timeline itself now stays the main place to create assignments quickly.
      </div>
    );
  }

  const visual = getColorOption(selectedProject.colorKey);

  return (
    <div className="mt-4 rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-zinc-500">
            Quick Assign
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            Useful for precise date entry.
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200/70 dark:bg-zinc-900/60 dark:ring-zinc-800">
        <div
          className={[
            "flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br text-[11px] font-bold ring-1",
            visual.swatchClassName,
          ].join(" ")}
        >
          {visual.icon}
        </div>

        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900 dark:text-zinc-100">
            {selectedProject.name}
          </div>
          <div className="mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1">
            <span className={visual.pillClassName}>{visual.label}</span>
          </div>
        </div>
      </div>

      <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">
        Person
      </label>
      <select
        value={userId}
        onChange={(event) => setUserId(event.target.value)}
        className="mb-3 w-full rounded-2xl bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:bg-zinc-900 dark:ring-zinc-800 dark:focus:ring-sky-800"
      >
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.displayName}
          </option>
        ))}
      </select>

      <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">
        Start date
      </label>
      <input
        type="date"
        value={startDate}
        onChange={(event) => setStartDate(event.target.value)}
        className="mb-3 w-full rounded-2xl bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:bg-zinc-900 dark:ring-zinc-800 dark:focus:ring-sky-800"
      />

      <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">
        Working days
      </label>
      <input
        type="number"
        min={1}
        value={lengthDays}
        onChange={(event) =>
          setLengthDays(Math.max(1, Number(event.target.value) || 1))
        }
        className="mb-3 w-full rounded-2xl bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:bg-zinc-900 dark:ring-zinc-800 dark:focus:ring-sky-800"
      />

      {err ? (
        <div className="mb-3 rounded-2xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-100 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-900/40">
          {err}
        </div>
      ) : null}

      <button
        type="button"
        disabled={busy || !userId || !startDate}
        onClick={async () => {
          try {
            setBusy(true);
            setErr(null);
            await onAssign(userId, startDate, lengthDays);
          } catch (error: any) {
            setErr(error?.message ?? "Failed to assign project");
          } finally {
            setBusy(false);
          }
        }}
        className="w-full rounded-2xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {busy ? "Saving..." : "Create assignment"}
      </button>
    </div>
  );
}
