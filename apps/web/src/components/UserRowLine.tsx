import { useEffect, useRef, useState } from "react";
import type { Project, UserRow } from "../api";
import {
  getAvatarTone,
  getColorOption,
  getDefaultLabelForLeaveType,
  getLeaveTypeFromColorKey,
  isoDateOnlyLocal,
  type TimelineDensityMode,
  type TimelineAssignmentLike,
  type UserRowLayout,
} from "../planning";

type Props = {
  u: UserRow;
  rowIndex: number;
  days: Date[];
  dayWidth: number;
  leftWidth: number;
  laneHeight: number;
  rowPaddingY: number;
  barHeight: number;
  densityMode: TimelineDensityMode;
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
  onMoveStart: (payload: {
    assignmentId: string;
    originClientX: number;
    originClientY: number;
    userId: string;
    laneIndex: number;
    duplicate: boolean;
    horizontalLock: boolean;
  }) => void;
  onSelectAssignment: (assignmentId: string) => void;
  onDelete: (assignmentId: string) => void;
  onDuplicate: (assignmentId: string) => void;
  onOpenProject: (projectId: string) => void;
  isHoliday: (d: Date) => boolean;
  activeMoveAssignmentId?: string | null;
  isMoveTarget?: boolean;
  targetLaneIndex?: number | null;
  duplicatePreviewAssignmentId?: string | null;
  selectedAssignmentId?: string | null;
  ghostAssignment?: {
    assignmentId: string;
    projectId: string;
    startDate: string;
    endDate: string;
    laneIndex: number;
  } | null;
};

const BAR_DRAG_THRESHOLD = 6;
const ACTION_MENU_WIDTH = 156;
const ACTION_MENU_HEIGHT = 126;
const TOOLTIP_WIDTH = 248;

const TOOLTIP_DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getCompactProjectLabel(name: string) {
  const words = name.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return "PRJ";
  }

  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase();
  }

  return words
    .slice(0, 3)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function getCompactBarLabel(projectName: string, colorKey: string) {
  const leaveType = getLeaveTypeFromColorKey(colorKey);

  switch (leaveType) {
    case "HOLIDAY":
      return "HOL";
    case "SICK":
      return "SICK";
    case "TRAINING":
      return "TRN";
    case "OUT_OF_OFFICE":
      return "OOO";
    default:
      return getCompactProjectLabel(projectName);
  }
}

function getBarTooltip(projectName: string, colorKey: string, isDraft: boolean) {
  if (isDraft) {
    return "Draft assignment";
  }

  const leaveType = getLeaveTypeFromColorKey(colorKey);

  if (!leaveType) {
    return projectName;
  }

  return `${projectName} - ${getDefaultLabelForLeaveType(leaveType)}`;
}

function formatAssignmentDateRange(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const inclusiveEnd = new Date(endDate);
  inclusiveEnd.setDate(inclusiveEnd.getDate() - 1);

  const startLabel = TOOLTIP_DATE_FORMAT.format(start);
  const endLabel = TOOLTIP_DATE_FORMAT.format(inclusiveEnd);

  return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
}

function getActionMenuPosition(triggerRect: DOMRect) {
  const preferredTop = triggerRect.bottom + 8;
  const top =
    preferredTop + ACTION_MENU_HEIGHT > window.innerHeight - 12
      ? Math.max(12, triggerRect.top - ACTION_MENU_HEIGHT - 8)
      : preferredTop;

  return {
    top,
    left: Math.min(
      Math.max(12, triggerRect.right - ACTION_MENU_WIDTH),
      window.innerWidth - ACTION_MENU_WIDTH - 12,
    ),
  };
}

function getTooltipPosition(triggerRect: DOMRect) {
  const preferredTop = triggerRect.top - 10;
  const tooltipHeight = 92;
  const top =
    preferredTop - tooltipHeight < 12
      ? Math.min(window.innerHeight - tooltipHeight - 12, triggerRect.bottom + 10)
      : preferredTop - tooltipHeight;

  const centeredLeft = triggerRect.left + triggerRect.width / 2 - TOOLTIP_WIDTH / 2;

  return {
    top,
    left: Math.min(
      Math.max(12, centeredLeft),
      window.innerWidth - TOOLTIP_WIDTH - 12,
    ),
  };
}

function getGhostPosition(days: Date[], startDate: string, endDate: string) {
  if (days.length === 0) {
    return null;
  }

  const dayKeys = days.map((day) => isoDateOnlyLocal(day));
  const startKey = isoDateOnlyLocal(new Date(startDate));
  const endKeyExclusive = isoDateOnlyLocal(new Date(endDate));
  const firstKey = dayKeys[0];
  const lastExclusive = new Date(days[days.length - 1]);
  lastExclusive.setDate(lastExclusive.getDate() + 1);
  const lastExclusiveKey = isoDateOnlyLocal(lastExclusive);

  const clampedStart =
    startKey <= firstKey ? 0 : dayKeys.findIndex((key) => key === startKey);
  const clampedEnd =
    endKeyExclusive >= lastExclusiveKey
      ? days.length
      : dayKeys.findIndex((key) => key === endKeyExclusive);

  if (clampedStart === -1 || clampedEnd === -1) {
    return null;
  }

  const clampedLength = Math.max(1, clampedEnd - clampedStart);

  return {
    left: clampedStart,
    width: clampedLength,
  };
}

export function UserRowLine({
  u,
  rowIndex,
  days,
  dayWidth,
  leftWidth,
  laneHeight,
  rowPaddingY,
  barHeight,
  densityMode,
  layout,
  projectsById,
  draftAssignmentId,
  todayIndex,
  onCellPointerDown,
  onResizeStart,
  onMoveStart,
  onSelectAssignment,
  onDelete,
  onDuplicate,
  onOpenProject,
  isHoliday,
  activeMoveAssignmentId = null,
  isMoveTarget = false,
  targetLaneIndex = null,
  duplicatePreviewAssignmentId = null,
  selectedAssignmentId = null,
  ghostAssignment = null,
}: Props) {
  const avatarTone = getAvatarTone(u.id);
  const isCompact = densityMode === "compact";
  const isOddRow = rowIndex % 2 === 1;
  const [actionMenu, setActionMenu] = useState<{
    assignmentId: string;
    projectId: string;
    left: number;
    top: number;
  } | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const actionMenuTriggerRef = useRef<HTMLElement | null>(null);
  const [hoveredTooltip, setHoveredTooltip] = useState<{
    assignmentId: string;
    projectName: string;
    personName: string;
    dateRange: string;
    leaveLabel: string | null;
    top: number;
    left: number;
  } | null>(null);
  const laneIndicatorTop =
    targetLaneIndex === null
      ? null
      : Math.min(
          Math.max(rowPaddingY - 2, rowPaddingY + targetLaneIndex * laneHeight - 2),
          Math.max(rowPaddingY - 2, layout.rowHeight - 6),
        );

  useEffect(() => {
    if (!actionMenu) {
      return;
    }

    function closeIfOutside(event: MouseEvent) {
      const target = event.target as Node | null;

      if (
        target &&
        (actionMenuRef.current?.contains(target) ||
          actionMenuTriggerRef.current?.contains(target))
      ) {
        return;
      }

      setActionMenu(null);
      actionMenuTriggerRef.current = null;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActionMenu(null);
        actionMenuTriggerRef.current = null;
      }
    }

    function closeMenu() {
      setActionMenu(null);
      actionMenuTriggerRef.current = null;
    }

    window.addEventListener("mousedown", closeIfOutside);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", closeMenu, true);

    return () => {
      window.removeEventListener("mousedown", closeIfOutside);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [actionMenu]);

  return (
    <div
      className={[
        "grid border-b border-slate-200/75 transition-colors duration-150 hover:bg-slate-100/70 dark:border-zinc-800/40 dark:hover:bg-zinc-900/70",
        isOddRow
          ? "bg-slate-50 dark:bg-zinc-900/55"
          : "bg-white dark:bg-zinc-950",
        isMoveTarget ? "bg-sky-50/90 dark:bg-sky-950/20" : "",
      ].join(" ")}
      style={{ gridTemplateColumns: `${leftWidth}px 1fr` }}
    >
      <div
        className={[
          "sticky left-0 z-10 border-r border-slate-200/90 backdrop-blur-xl shadow-[14px_0_24px_-22px_rgba(15,23,42,0.24)] dark:border-zinc-800/40 dark:shadow-[14px_0_24px_-22px_rgba(0,0,0,0.72)]",
          isOddRow
            ? "bg-slate-50/96 dark:bg-zinc-900/86"
            : "bg-white/96 dark:bg-zinc-950/98",
          isCompact ? "px-2 py-2.5" : "px-2.5 py-3",
          isMoveTarget
            ? "ring-1 ring-inset ring-sky-400/70 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.15)] dark:ring-sky-700/50"
            : "",
        ].join(" ")}
      >
        <div
          className={[
            "absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full bg-gradient-to-b opacity-75",
            avatarTone,
          ].join(" ")}
          aria-hidden="true"
        />
        <div className="flex items-center gap-2">
          <div
            className={[
              "flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br font-semibold ring-1 shadow-sm",
              isCompact ? "h-6 w-6 text-[8px]" : "h-7 w-7 text-[9px]",
              avatarTone,
              "dark:ring-white/10",
            ].join(" ")}
          >
            {initials(u.displayName)}
          </div>

          <div className="min-w-0">
            <div
              className={[
                "truncate font-semibold text-slate-900 dark:text-zinc-100",
                isCompact ? "text-[11px]" : "text-[12px]",
              ].join(" ")}
            >
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
                "relative border-l border-slate-200/70 transition-colors duration-150 dark:border-zinc-800/40",
                holiday
                  ? "bg-amber-50/45 hover:bg-amber-50/70 dark:bg-amber-950/20 dark:hover:bg-amber-950/24"
                  : weekend
                    ? "bg-slate-50 hover:bg-slate-100/80 dark:bg-zinc-900/45 dark:hover:bg-zinc-900/65"
                    : "bg-white hover:bg-slate-50 dark:bg-zinc-950 dark:hover:bg-zinc-900/72",
              ].join(" ")}
            >
              <div className="h-full bg-[linear-gradient(to_bottom,rgba(15,23,42,0.012),transparent_38%,rgba(15,23,42,0.01))] dark:bg-[linear-gradient(to_bottom,rgba(255,255,255,0.012),transparent_40%,rgba(255,255,255,0.008))]" />
            </button>
          );
        })}

        {todayIndex !== null ? (
          <div
            className="pointer-events-none absolute inset-y-0 z-[1]"
            style={{
              left: todayIndex * dayWidth,
              width: dayWidth,
            }}
          >
            <div className="h-full w-full bg-slate-900/[0.045] dark:bg-sky-950/25" />
          </div>
        ) : null}

        {todayIndex !== null ? (
          <div
            className="pointer-events-none absolute inset-y-0 z-[2]"
            style={{ left: todayIndex * dayWidth + Math.floor(dayWidth / 2) }}
          >
            <div className="absolute inset-y-0 -left-px w-[3px] bg-sky-400/12 blur-[2px]" />
            <div className="h-full w-px bg-sky-500/70 dark:bg-sky-400/75" />
          </div>
        ) : null}

        {isMoveTarget ? (
          <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-r from-sky-100/42 via-sky-50/14 to-transparent ring-1 ring-inset ring-sky-300/40 dark:from-sky-950/18 dark:via-sky-950/08 dark:ring-sky-700/40" />
        ) : null}

        {isMoveTarget && laneIndicatorTop !== null ? (
          <div
            className="pointer-events-none absolute left-1 right-1 z-[3] rounded-full border border-dashed border-sky-400/70 bg-sky-200/25 shadow-[0_0_0_1px_rgba(125,211,252,0.2)] dark:border-sky-600/70 dark:bg-sky-900/20"
            style={{ top: laneIndicatorTop, height: 4 }}
          />
        ) : null}

        {ghostAssignment ? (() => {
          const ghostProject = projectsById[ghostAssignment.projectId];

          if (!ghostProject) {
            return null;
          }

          const ghostPosition = getGhostPosition(
            days,
            ghostAssignment.startDate,
            ghostAssignment.endDate,
          );

          if (!ghostPosition) {
            return null;
          }

          const ghostVisual = getColorOption(ghostProject.colorKey);

          return (
            <div
              className="pointer-events-none absolute z-[2] rounded-[14px] border border-dashed border-slate-300/45 bg-white/18 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)] dark:border-zinc-500/35 dark:bg-zinc-200/[0.04]"
              style={{
                left: ghostPosition.left * dayWidth + 1,
                top: rowPaddingY + ghostAssignment.laneIndex * laneHeight,
                width: Math.max(28, ghostPosition.width * dayWidth - 2),
                height: barHeight,
                boxShadow: `0 8px 18px -18px rgba(15,23,42,0.35), inset 0 0 0 1px rgba(255,255,255,0.06)`,
              }}
              aria-hidden="true"
            >
              <div
                className={[
                  "h-full w-full rounded-[13px] opacity-28",
                  ghostVisual.barClassName,
                ].join(" ")}
              />
            </div>
          );
        })() : null}

        <div className="pointer-events-none absolute inset-0 z-[2]">
          {layout.lanes.map((lane, laneIndex) =>
            lane.map((item) => {
              const project = projectsById[item.assignment.projectId] ?? item.project;
              const visual = getColorOption(project.colorKey);
              const isDraft = item.assignment.id === draftAssignmentId;
              const isDuplicatePreview =
                item.assignment.id === duplicatePreviewAssignmentId;
              const isTransientPreview = isDraft || isDuplicatePreview;
              const left = item.clampedStart * dayWidth + 1;
              const width = Math.max(28, item.clampedLength * dayWidth - 2);
              const top = rowPaddingY + laneIndex * laneHeight;
              const isSingleDay = item.clampedLength <= 1;
              const compactLabel = getCompactBarLabel(project.name, project.colorKey);
              const compactLabelMinWidth = compactLabel.length >= 4 ? 30 : 26;
              const preferCompactLabel = item.leave || isSingleDay;
              const showFullLabel = !preferCompactLabel && width >= 112;
              const showCompactLabel = width >= compactLabelMinWidth;
              const showBadge = !preferCompactLabel && width >= 72;
              const showInlineActions = width >= 248;
              const showOverflowActions = !showInlineActions && width >= 28;
              const tooltipLabel = getBarTooltip(
                project.name,
                project.colorKey,
                isDraft,
              );
              const contentPaddingClass =
                width >= 112
                  ? "px-2.5"
                  : width >= 68
                    ? "px-1.5"
                    : width >= 36
                      ? "px-1"
                      : "px-0.5";
              const compactLabelClass =
                width >= 48
                  ? "text-[10px] tracking-[0.08em]"
                  : "text-[9px] tracking-[0.04em]";
              const isActiveMovePreview =
                !isTransientPreview && activeMoveAssignmentId === item.assignment.id;
              const isSelected =
                !isTransientPreview && selectedAssignmentId === item.assignment.id;
              const leaveType = getLeaveTypeFromColorKey(project.colorKey);

              return (
                <div
                  key={item.assignment.id}
                  onMouseEnter={(event) => {
                    if (isTransientPreview) {
                      return;
                    }

                    const position = getTooltipPosition(
                      event.currentTarget.getBoundingClientRect(),
                    );

                    setHoveredTooltip({
                      assignmentId: item.assignment.id,
                      projectName: project.name,
                      personName: u.displayName,
                      dateRange: formatAssignmentDateRange(
                        item.assignment.startDate,
                        item.assignment.endDate,
                      ),
                      leaveLabel: leaveType
                        ? getDefaultLabelForLeaveType(leaveType)
                        : null,
                      ...position,
                    });
                  }}
                  onMouseLeave={() =>
                    setHoveredTooltip((current) =>
                      current?.assignmentId === item.assignment.id ? null : current,
                    )
                  }
                  className={[
                    "group pointer-events-auto absolute flex items-center overflow-hidden rounded-[14px] border text-left font-semibold tracking-[0.01em] backdrop-blur-[1px] transition-[box-shadow,transform,filter,opacity] duration-150",
                    isCompact ? "text-[11px]" : "text-[12px]",
                    visual.barClassName,
                    item.leave || isTransientPreview ? "border-dashed" : "",
                    isDraft
                      ? "ring-2 ring-sky-300/75 ring-offset-1 ring-offset-white shadow-[0_10px_24px_-18px_rgba(14,165,233,0.28)] dark:ring-sky-600/70 dark:ring-offset-zinc-950"
                      : isDuplicatePreview
                        ? "opacity-95 ring-2 ring-sky-200/70 ring-offset-1 ring-offset-white shadow-[0_14px_30px_-20px_rgba(14,165,233,0.3)] dark:ring-sky-700/55 dark:ring-offset-zinc-950"
                      : "shadow-[0_1px_2px_rgba(15,23,42,0.08),0_10px_18px_-18px_rgba(15,23,42,0.28)] hover:-translate-y-px hover:brightness-[1.015] hover:shadow-[0_10px_22px_-18px_rgba(15,23,42,0.34)]",
                    isActiveMovePreview
                      ? "z-10 -translate-y-0.5 opacity-95 ring-2 ring-sky-300/75 ring-offset-1 ring-offset-white shadow-[0_16px_32px_-18px_rgba(14,165,233,0.34)] dark:ring-sky-700/60 dark:ring-offset-zinc-950"
                      : "",
                    isSelected && !isActiveMovePreview
                      ? "ring-2 ring-slate-300/75 ring-offset-1 ring-offset-white shadow-[0_10px_22px_-20px_rgba(15,23,42,0.22)] dark:ring-zinc-700/75 dark:ring-offset-zinc-950"
                      : "",
                    contentPaddingClass,
                  ].join(" ")}
                  style={{ left, top, width, height: barHeight }}
                  aria-label={tooltipLabel}
                >
                  <div className="pointer-events-none absolute inset-[1px] rounded-[13px] bg-[linear-gradient(180deg,rgba(255,255,255,0.26),rgba(255,255,255,0.08)_42%,rgba(15,23,42,0.05))] opacity-85 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04)_42%,rgba(0,0,0,0.08))]" />
                  <div className="pointer-events-none absolute inset-0 rounded-[14px] ring-1 ring-inset ring-white/18 dark:ring-white/10" />
                  <div
                    onMouseDown={(event) => {
                      if (event.button !== 0) {
                        return;
                      }

                      event.preventDefault();
                      event.stopPropagation();
                      setHoveredTooltip(null);

                      if (!isTransientPreview) {
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
                      setHoveredTooltip(null);

                      if (!isTransientPreview) {
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
                      setHoveredTooltip(null);

                      if (isTransientPreview) {
                        return;
                      }

                      const originClientX = event.clientX;
                      const originClientY = event.clientY;
                      const duplicate = event.altKey || event.ctrlKey;
                      const horizontalLock = event.shiftKey;
                      let dragStarted = false;

                      const handleWindowMove = (moveEvent: MouseEvent) => {
                        if (dragStarted) {
                          return;
                        }

                        const deltaX = moveEvent.clientX - originClientX;
                        const deltaY = moveEvent.clientY - originClientY;

                        if (Math.hypot(deltaX, deltaY) < BAR_DRAG_THRESHOLD) {
                          return;
                        }

                        dragStarted = true;
                        onMoveStart({
                          assignmentId: item.assignment.id,
                          originClientX,
                          originClientY,
                          userId: u.id,
                          laneIndex,
                          duplicate,
                          horizontalLock,
                        });
                      };

                      const cleanup = () => {
                        window.removeEventListener("mousemove", handleWindowMove);
                        window.removeEventListener("mouseup", handleWindowUp);
                      };

                      const handleWindowUp = () => {
                        cleanup();

                        if (!dragStarted) {
                          onSelectAssignment(item.assignment.id);
                          onOpenProject(item.assignment.projectId);
                        }
                      };

                      window.addEventListener("mousemove", handleWindowMove);
                      window.addEventListener("mouseup", handleWindowUp);
                    }}
                    className={[
                      "flex min-w-0 flex-1 items-center text-left",
                      showFullLabel
                        ? "gap-2.5"
                        : showBadge
                          ? "gap-1.5"
                          : "justify-center",
                      isTransientPreview
                        ? "cursor-default"
                        : "cursor-grab active:cursor-grabbing",
                    ].join(" ")}
                  >
                    {showBadge ? (
                      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/26 text-[9px] font-bold uppercase shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)] dark:bg-black/18">
                        {visual.icon}
                      </span>
                    ) : null}

                    {showFullLabel ? (
                      <span className="min-w-0 truncate leading-none">
                        {isDraft ? "Draft assignment" : project.name}
                      </span>
                    ) : showCompactLabel ? (
                      <span
                        className={[
                          "min-w-0 truncate font-bold uppercase leading-none",
                          compactLabelClass,
                        ].join(" ")}
                      >
                        {isDraft ? "NEW" : compactLabel}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase leading-none">
                        {visual.icon}
                      </span>
                    )}
                  </button>

                  {!isTransientPreview && showInlineActions ? (
                    <div className="pointer-events-auto flex items-center gap-1 pl-1.5">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenProject(item.assignment.projectId);
                        }}
                        className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-current/80 opacity-0 transition group-hover:opacity-100 hover:bg-white/24 dark:hover:bg-black/18"
                      >
                        Open
                      </button>

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDelete(item.assignment.id);
                        }}
                        className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-current/80 opacity-0 transition group-hover:opacity-100 hover:bg-white/24 dark:hover:bg-black/18"
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}

                  {!isTransientPreview && showOverflowActions ? (
                    <button
                      type="button"
                      aria-label="More actions"
                      aria-haspopup="menu"
                      aria-expanded={actionMenu?.assignmentId === item.assignment.id}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setHoveredTooltip(null);

                        if (actionMenu?.assignmentId === item.assignment.id) {
                          setActionMenu(null);
                          actionMenuTriggerRef.current = null;
                          return;
                        }

                        actionMenuTriggerRef.current = event.currentTarget;
                        setActionMenu({
                          assignmentId: item.assignment.id,
                          projectId: item.assignment.projectId,
                          ...getActionMenuPosition(
                            event.currentTarget.getBoundingClientRect(),
                          ),
                        });
                      }}
                      className={[
                        "absolute right-1 top-1/2 z-[4] flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-white/24 text-[11px] font-bold text-current/80 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] transition hover:bg-white/36 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 dark:bg-black/20 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] dark:hover:bg-black/32",
                        actionMenu?.assignmentId === item.assignment.id
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100",
                      ].join(" ")}
                    >
                      ...
                    </button>
                  ) : null}
                </div>
              );
            }),
          )}
        </div>

        {hoveredTooltip ? (
          <div
            className="pointer-events-none fixed z-[90] w-[248px] rounded-[18px] border border-slate-200/75 bg-white/96 px-3 py-2.5 shadow-[0_20px_42px_-26px_rgba(15,23,42,0.4)] backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-950/94 dark:shadow-[0_20px_42px_-28px_rgba(0,0,0,0.7)]"
            style={{
              left: hoveredTooltip.left,
              top: hoveredTooltip.top,
            }}
          >
            <div className="truncate text-sm font-semibold text-slate-900 dark:text-zinc-100">
              {hoveredTooltip.projectName}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
              {hoveredTooltip.personName}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
              {hoveredTooltip.dateRange}
            </div>
            {hoveredTooltip.leaveLabel ? (
              <div className="mt-1 text-xs font-medium text-sky-700 dark:text-sky-300">
                Leave: {hoveredTooltip.leaveLabel}
              </div>
            ) : null}
          </div>
        ) : null}

        {actionMenu ? (
          <div
            ref={actionMenuRef}
            className="fixed z-[80] w-[156px] rounded-[20px] border border-slate-200/80 bg-white/96 p-1.5 shadow-[0_20px_42px_-28px_rgba(15,23,42,0.42)] backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-950/94 dark:shadow-[0_20px_42px_-28px_rgba(0,0,0,0.72)]"
            style={{
              left: actionMenu.left,
              top: actionMenu.top,
            }}
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
          >
            <button
              type="button"
              onClick={() => {
                onOpenProject(actionMenu.projectId);
                setActionMenu(null);
                actionMenuTriggerRef.current = null;
              }}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100/90 dark:text-zinc-200 dark:hover:bg-zinc-900/80"
            >
              <span>Open</span>
              <span className="text-xs text-slate-400 dark:text-zinc-500">↗</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onDuplicate(actionMenu.assignmentId);
                setActionMenu(null);
                actionMenuTriggerRef.current = null;
              }}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100/90 dark:text-zinc-200 dark:hover:bg-zinc-900/80"
            >
              <span>Duplicate</span>
              <span className="text-xs text-slate-400 dark:text-zinc-500">Alt/Ctrl</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onDelete(actionMenu.assignmentId);
                setActionMenu(null);
                actionMenuTriggerRef.current = null;
              }}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50/90 dark:text-rose-300 dark:hover:bg-rose-950/26"
            >
              <span>Delete</span>
              <span className="text-xs text-rose-300 dark:text-rose-500">Del</span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
