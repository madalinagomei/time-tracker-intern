export type TeamMember = {
  id: string;
  name: string;
  role?: string;
};

export type TeamGroup = {
  id: string;
  name: string;
  members: TeamMember[];
};

export function TeamsPanel({
  teams,
  selectedTeamId,
  onSelectTeam,
}: {
  teams: TeamGroup[];
  selectedTeamId: string | null;
  onSelectTeam: (teamId: string | null) => void;
}) {
  return (
    <div className="space-y-2">
      {teams.map((team) => {
        const selected = selectedTeamId === team.id;

        return (
          <button
            key={team.id}
            type="button"
            onClick={() => onSelectTeam(selected ? null : team.id)}
            className={[
              "flex w-full items-center justify-between rounded-3xl border px-3 py-3 text-left transition",
              selected
                ? "border-sky-200 bg-sky-50/80 shadow-sm dark:border-sky-900/50 dark:bg-sky-950/20"
                : "border-slate-200/80 bg-white/90 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900",
            ].join(" ")}
          >
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                {team.name}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-400">
                Shared timeline
              </div>
            </div>

            <div
              className={[
                "rounded-full px-2.5 py-1 text-[10px] font-medium ring-1",
                selected
                  ? "bg-sky-100 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900/50"
                  : "bg-slate-100 text-slate-500 ring-slate-200 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800",
              ].join(" ")}
            >
              {selected ? "Active" : "Show"}
            </div>
          </button>
        );
      })}
    </div>
  );
}
