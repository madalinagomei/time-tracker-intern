import type { Project, UserRow } from "../api";
import {
  LANE_HEIGHT,
  ROW_PADDING_Y,
  getAvatarTone,
  getColorOption,
  type TimelineAssignmentLike,
  type UserRowLayout,
} from "../planning";

type Props = {
  u: UserRow;
  days: Date[];
  dayWidth: number;
  leftWidth: number;
  layout: UserRowLayout<TimelineAssignmentLike>;
  projectsById: Record<string, Project>;
  draftAssignmentId?: string | null;
  todayIndex: number | null;
  onCellPointerDown: (
    userId: string,
    dayIndex: number,
    anchorEl: HTMLElement,
  ) => void;
  onResizeStart: (
    assignmentId: string,
    side: "left" | "right",
    originClientX: number,
  ) => void;
  onMoveStart: (assignmentId: string, originClientX: number) => void;
  onDelete: (assignmentId: string) => void;
  onOpenProject: (projectId: string) => void;
  isHoliday: (d: Date) => boolean;
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function UserRowLine({
  u,
  days,
  dayWidth,
  leftWidth,
  layout,
  projectsById,
  draftAssignmentId,
  todayIndex,
  onCellPointerDown,
  onResizeStart,
  onMoveStart,
  onDelete,
  onOpenProject,
  isHoliday,
}: Props) {
  const avatarTone = getAvatarTone(u.id);

  return (
    <div
      className="grid border-b border-slate-200/80 dark:border-zinc-900"
      style={{ gridTemplateColumns: `${leftWidth}px 1fr` }}
    >
      <div className="sticky left-0 z-10 border-r border-slate-200/70 bg-white/95 px-3 py-2.5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="flex items-center gap-2.5">
          <div
            className={[
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-[10px] font-semibold ring-1 shadow-sm",
              avatarTone,
              "dark:ring-white/10",
            ].join(" ")}
          >
            {initials(u.displayName)}
          </div>

          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-slate-900 dark:text-zinc-100">
              {u.displayName}
            </div>
          </div>
        </div>
      </div>

      <div
        className="relative grid overflow-hidden"
        style={{
          gridTemplateColumns: `repeat(${days.length}, ${dayWidth}px)`,
          height: layout.rowHeight,
        }}
      >
        {days.map((day, index) => {
          const weekend = day.getDay() === 0 || day.getDay() === 6;
          const holiday = isHoliday(day);

          return (
            <button
              type="button"
              key={index}
              onMouseDown={(event) => {
                if (event.button !== 0) {
                  return;
                }

                event.preventDefault();
                onCellPointerDown(u.id, index, event.currentTarget);
              }}
              className={[
                "relative border-l border-slate-200/70 transition-colors dark:border-zinc-900",
                holiday
                  ? "bg-amber-50/80 hover:bg-amber-100/90 dark:bg-amber-950/20 dark:hover:bg-amber-950/35"
                  : weekend
                    ? "bg-slate-50/80 hover:bg-slate-100/90 dark:bg-zinc-900/60 dark:hover:bg-zinc-900"
                    : "bg-white/80 hover:bg-sky-50/80 dark:bg-zinc-950 dark:hover:bg-zinc-900/70",
              ].join(" ")}
            >
              <div className="h-full bg-[linear-gradient(to_bottom,rgba(148,163,184,0.06),transparent_40%,rgba(148,163,184,0.04))] dark:bg-[linear-gradient(to_bottom,rgba(255,255,255,0.02),transparent_40%,rgba(255,255,255,0.015))]" />
            </button>
          );
        })}

        {todayIndex !== null ? (
          <div
            className="pointer-events-none absolute inset-y-0 z-[1]"
            style={{ left: todayIndex * dayWidth + Math.floor(dayWidth / 2) }}
          >
            <div className="h-full w-px bg-sky-400/45" />
          </div>
        ) : null}

        <div className="pointer-events-none absolute inset-0 z-[2]">
          {layout.lanes.map((lane, laneIndex) =>
            lane.map((item) => {
              const project = projectsById[item.assignment.projectId] ?? item.project;
              const visual = getColorOption(project.colorKey);
              const isDraft = item.assignment.id === draftAssignmentId;
              const left = item.clampedStart * dayWidth + 2;
              const width = Math.max(16, item.clampedLength * dayWidth - 4);
              const top = ROW_PADDING_Y + laneIndex * LANE_HEIGHT;
              const isNarrow = width < 92;
              const isTiny = width < 64;
              const showDeleteAction = width >= 136;

              return (
                <div
                  key={item.assignment.id}
                  className={[
                    "group pointer-events-auto absolute flex h-7 items-center overflow-hidden rounded-xl border px-2.5 text-left text-[11px] font-semibold tracking-[0.01em] shadow-sm transition-[box-shadow,transform]",
                    visual.barClassName,
                    item.leave || isDraft ? "border-dashed" : "",
                    isDraft ? "ring-2 ring-sky-300/80 ring-offset-1 ring-offset-white dark:ring-sky-600/80 dark:ring-offset-zinc-950" : "hover:-translate-y-px hover:shadow-md",
                  ].join(" ")}
                  style={{ left, top, width }}
                  title={project.name}
                >
                  <div
                    onMouseDown={(event) => {
                      if (event.button !== 0) {
                        return;
                      }

                      event.preventDefault();
                      event.stopPropagation();
                      if (!isDraft) {
                        onResizeStart(item.assignment.id, "left", event.clientX);
                      }
                    }}
                    className="absolute left-0 top-0 h-full w-2 cursor-ew-resize"
                  />

                  <div
                    onMouseDown={(event) => {
                      if (event.button !== 0) {
                        return;
                      }

                      event.preventDefault();
                      event.stopPropagation();
                      if (!isDraft) {
                        onResizeStart(item.assignment.id, "right", event.clientX);
                      }
                    }}
                    className="absolute right-0 top-0 h-full w-2 cursor-ew-resize"
                  />

                  <button
                    type="button"
                    onMouseDown={(event) => {
                      if (event.button !== 0) {
                        return;
                      }

                      event.preventDefault();
                      event.stopPropagation();
                      if (!isDraft && !isNarrow) {
                        onMoveStart(item.assignment.id, event.clientX);
                      }
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!isDraft && isNarrow) {
                        onOpenProject(item.assignment.projectId);
                      }
                    }}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    {!isTiny ? (
                      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-black/10 text-[9px] font-bold uppercase">
                        {visual.icon}
                      </span>
                    ) : null}
                    {!isTiny ? (
                      <span className="min-w-0 truncate">
                        {isDraft ? "Draft assignment" : project.name}
                      </span>
                    ) : null}
                  </button>

                  {!isDraft && showDeleteAction ? (
                    <div className="pointer-events-auto flex items-center gap-1 pl-1">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenProject(item.assignment.projectId);
                        }}
                        className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-current/80 opacity-0 transition group-hover:opacity-100 hover:bg-black/10"
                      >
                        Details
                      </button>

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDelete(item.assignment.id);
                        }}
                        className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-current/80 opacity-0 transition group-hover:opacity-100 hover:bg-black/10"
                      >
                        ×
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}
