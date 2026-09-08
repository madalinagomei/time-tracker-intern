import { getAvatarTone } from "../planning";

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
}: {
  teams: TeamGroup[];
}) {
  return (
    <div className="space-y-1.5">
      {teams.flatMap((team) =>
        team.members.map((member) => (
          <div
            key={`${team.id}-${member.id}`}
            className="flex items-center gap-2.5 rounded-2xl px-2.5 py-2"
          >
            <div
              className={[
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-[9px] font-semibold ring-1 shadow-sm dark:ring-white/10",
                getAvatarTone(member.id),
              ].join(" ")}
            >
              {member.name
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase() ?? "")
                .join("")}
            </div>
            <div className="min-w-0 truncate text-sm font-medium text-slate-700 dark:text-zinc-200">
              {member.name}
            </div>
          </div>
        )),
      )}
    </div>
  );
}
