import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createAssignment,
  createProject,
  deleteAssignment,
  deleteProject,
  getAssignments,
  getProjects,
  getUsers,
  updateAssignment,
  updateProject,
} from "../api";
import type {
  AssignmentRow,
  Me,
  Project,
  ProjectDepartment,
  ProjectStatus,
  UserRow,
} from "../api";
import {
  COLOR_OPTIONS,
  DEPARTMENT_COLOR_OPTIONS,
  LEFT_COLUMN_WIDTH,
  LEAVE_COLOR_OPTIONS,
  ROW_OVERSCAN,
  TIMELINE_DENSITY_OPTIONS,
  TIMELINE_EDGE_BUFFER_DAYS,
  TIMELINE_SHIFT_DAYS,
  TIMELINE_WINDOW_DAYS,
  TIMELINE_ZOOM_OPTIONS,
  addDays,
  addWorkingDaysInclusive,
  buildStableLaneMap,
  buildHolidayMapForYears,
  buildUserRowLayout,
  countWorkingDays,
  getColorKeyForLeaveType,
  getColorOption,
  getDefaultLabelForLeaveType,
  getLeaveTypeFromColorKey,
  getProjectDepartmentFromColorKey,
  getTimelineDayWidth,
  getWorkingRangeFromDrag,
  isHoliday,
  isLeaveColorKey,
  isoDateOnlyLocal,
  makeDays,
  moveByWorkingDays,
  normalizeColorKey,
  snapToWorkingDay,
  startOfMonday,
  type TimelineDensityMode,
  type LeaveType,
  type TimelineEntryType,
  type TimelineAssignmentLike,
  type TimelineZoomMode,
} from "../planning";
import { applyTheme, getInitialTheme, type Theme } from "../theme";

import { AssignPanel } from "../components/AssignPanel";
import { ProjectDrawer } from "../components/ProjectDrawer";
import { ProjectSettingsPanel } from "../components/ProjectSettigsPanel";
import { SidebarProjects } from "../components/SidebarProjects";
import { TeamsPanel } from "../components/TeamsPanel";
import type { TeamGroup } from "../components/TeamsPanel";
import { TimelineHeader } from "../components/TimelineHeader";
import { TopBar } from "../components/TopBar";
import { UserRowLine } from "../components/UserRowLine";

const DRAFT_PROJECT_ID = "__draft__project";
const DRAFT_ASSIGNMENT_ID = "__draft__assignment";
const MAX_MANUAL_ROW_HEIGHT = 500;
const DUPLICATE_PREVIEW_ASSIGNMENT_ID = "__duplicate__assignment";
const DEFAULT_NEW_PROJECT_COLOR_KEY = "haematology";

const DEMO_TEAMS: TeamGroup[] = [
  {
    id: "team-project-management",
    name: "Project Management",
    members: [
      { id: "tm1", name: "Viviane Malkowski", role: "Project & Brand Manager" },
      { id: "tm2", name: "Andrea Schaal", role: "Project Manager" },
      { id: "tm3", name: "Mary Volz", role: "Project Manager" },
      {
        id: "tm4",
        name: "Melissa Buer",
        role: "Working Student Project Management",
      },
    ],
  },
  {
    id: "team-copywriting",
    name: "Copywriting & Editing",
    members: [
      { id: "tm5", name: "Jack Flanagan", role: "Copywriter & Editor" },
      { id: "tm6", name: "Silke Over", role: "Copywriter & Editor" },
      {
        id: "tm7",
        name: "Marque Pham",
        role: "Working Student Proofreader & Editor",
      },
    ],
  },
  {
    id: "team-creative",
    name: "Creative",
    members: [
      { id: "tm8", name: "Emilian Ciobanu", role: "3D Artist" },
      { id: "tm9", name: "Jorg Kappus", role: "Graphic Designer" },
      { id: "tm10", name: "Soner Kaya", role: "Graphic Designer" },
      { id: "tm11", name: "Hieu Nguyen", role: "Graphic Designer" },
      { id: "tm12", name: "Iva Ristic", role: "Graphic Designer" },
      {
        id: "tm13",
        name: "Philipp Schindhelm",
        role: "Video & Multimedia Producer",
      },
    ],
  },
];

const USER_TEAM_MAP: Record<string, string> = {
  emilian: "team-creative",
  pm1: "team-project-management",
  user1: "team-copywriting",
};

type AssignmentPreview = {
  assignmentId: string;
  startDate: string;
  endDate: string;
  userId?: string;
  laneIndex?: number;
};

type DraftAssignment = TimelineAssignmentLike & {
  isDraft: true;
};

type PendingComposer = {
  userId: string;
  startDate: string;
  endDate: string;
  lengthDays: number;
  anchorRect: DOMRect;
};

type ToastState = {
  id: number;
  message: string;
};

type ProjectComposerOption =
  | {
      kind: "project";
      project: Project;
    }
  | {
      kind: "create";
      name: string;
    };

type InteractionState =
  | {
      mode: "create";
      userId: string;
      anchorIndex: number;
      originClientX: number;
      anchorRect: DOMRect;
      projectId: string;
    }
  | {
      mode: "move";
      assignmentId: string;
      duplicate: boolean;
      horizontalLock: boolean;
      originClientX: number;
      originClientY: number;
      originalStartDate: string;
      originalEndDate: string;
      originalUserId: string;
      originalLaneIndex: number;
      projectId: string;
    }
  | {
      mode: "resize";
      assignmentId: string;
      side: "left" | "right";
      originClientX: number;
      originalStartDate: string;
      originalEndDate: string;
      projectId: string;
    };

type RowResizeState = {
  userId: string;
  originClientY: number;
  minHeight: number;
  startHeight: number;
  previousCustomHeight: number | null;
};

function getFloatingPanelLayout(anchorRect: DOMRect, preferredWidth = 420) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const panelWidth = Math.min(preferredWidth, viewportWidth - 24);
  const maxHeight = Math.max(320, viewportHeight - 24);
  const availableBelow = viewportHeight - anchorRect.bottom - 12;
  const availableAbove = anchorRect.top - 12;
  const shouldCenter =
    viewportWidth < 1280 ||
    viewportHeight < 840 ||
    (availableBelow < 440 && availableAbove < 440);

  if (shouldCenter) {
    return {
      width: panelWidth,
      maxHeight,
      top: Math.max(12, Math.floor((viewportHeight - maxHeight) / 2)),
      left: Math.max(12, Math.floor((viewportWidth - panelWidth) / 2)),
    };
  }

  const openAbove = availableBelow < 440 && availableAbove > availableBelow;
  const top = openAbove
    ? Math.max(12, anchorRect.top - Math.min(640, maxHeight))
    : Math.min(viewportHeight - maxHeight - 12, anchorRect.bottom + 10);
  const left = Math.min(
    Math.max(12, anchorRect.left - 4),
    viewportWidth - panelWidth - 12,
  );

  return {
    width: panelWidth,
    maxHeight,
    top,
    left,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function endExclusiveToWorkingLength(
  startDate: string,
  endDate: string,
  holidayMap: Map<string, string>,
) {
  return Math.max(
    1,
    countWorkingDays(new Date(startDate), new Date(endDate), holidayMap),
  );
}

function createDraftProject(selectedProject: Project | null): Project {
  return {
    id: DRAFT_PROJECT_ID,
    name: selectedProject?.name ?? "Choose project",
    colorKey: selectedProject?.colorKey ?? "software",
    ownerId: null,
    status: "PLANNED",
    department: "OTHER",
    description: null,
    notes: null,
    projectManagerId: null,
    requesterName: null,
    contactPersonName: null,
    startDate: null,
    dueDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function findFirstVisibleRow(
  rows: Array<{ top: number; height: number }>,
  scrollTop: number,
) {
  let low = 0;
  let high = rows.length - 1;
  let answer = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const row = rows[mid];

    if (row.top + row.height >= scrollTop) {
      answer = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return answer;
}

function findLastVisibleRow(
  rows: Array<{ top: number; height: number }>,
  viewportBottom: number,
) {
  let low = 0;
  let high = rows.length - 1;
  let answer = rows.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const row = rows[mid];

    if (row.top <= viewportBottom) {
      answer = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return answer;
}

function findRowAtOffset<T extends { top: number; height: number }>(
  rows: T[],
  offsetY: number,
) {
  let low = 0;
  let high = rows.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const row = rows[mid];

    if (offsetY < row.top) {
      high = mid - 1;
      continue;
    }

    if (offsetY >= row.top + row.height) {
      low = mid + 1;
      continue;
    }

    return row;
  }

  return null;
}

function NewProjectModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, colorKey: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [colorKey, setColorKey] = useState("haematology");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setName("");
    setColorKey("haematology");
    setBusy(false);
    setErr(null);
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/35" onClick={onClose} />

      <div className="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200/70 px-5 py-4 dark:border-zinc-800">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-300">
              New Project
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-zinc-100">
              Create a project without leaving the timeline
            </div>
            <div className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              Pick the matching department styling now. Metadata can still be edited in the drawer later.
            </div>
          </div>

          <button
            type="button"
            onClick={() => !busy && onClose()}
            className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-200 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800 dark:hover:bg-zinc-800"
          >
            Close
          </button>
        </div>

        <div
          className="min-h-0 overflow-y-auto overscroll-contain px-5 py-4"
          style={{ maxHeight: "calc(100dvh - 132px)" }}
        >
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">
            Project name
          </label>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Flow Cytometry launch assets"
            className="w-full rounded-2xl bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:bg-zinc-900 dark:ring-zinc-800 dark:focus:ring-sky-800"
          />

          <div className="mt-5">
            <div className="mb-2 text-xs font-medium text-slate-500 dark:text-zinc-400">
              Department
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {DEPARTMENT_COLOR_OPTIONS.map((option) => {
                const selected = normalizeColorKey(colorKey) === option.key;

                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setColorKey(option.key)}
                    className={[
                      "flex items-center gap-3 rounded-3xl border p-3 text-left transition",
                      selected
                        ? "border-sky-200 bg-sky-50 shadow-sm dark:border-sky-900/50 dark:bg-sky-950/20"
                        : "border-slate-200/80 bg-white hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900",
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-xs font-bold ring-1",
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
                        Department
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {err ? (
            <div className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-100 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-900/40">
              {err}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200/70 px-5 py-4 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => !busy && onClose()}
            className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || name.trim().length < 2}
            onClick={async () => {
              try {
                setBusy(true);
                setErr(null);
                await onCreate(name.trim(), colorKey);
                onClose();
              } catch (error: any) {
                setErr(error?.message ?? "Failed to create project");
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
          >
            {busy ? "Creating..." : "Create project"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AssignmentComposerPopover({
  pending,
  projects,
  recentProjects,
  onChooseProject,
  onCreateProject,
  onClose,
}: {
  pending: PendingComposer;
  projects: Project[];
  recentProjects: Project[];
  onChooseProject: (projectId: string) => Promise<void>;
  onCreateProject: (name: string, colorKey: string) => Promise<void>;
  onClose: () => void;
}) {
  const [entryType, setEntryType] = useState<TimelineEntryType>("PROJECT");
  const [search, setSearch] = useState("");
  const [leaveName, setLeaveName] = useState("");
  const [leaveType, setLeaveType] = useState<LeaveType>("HOLIDAY");
  const [projectColorKey, setProjectColorKey] = useState(
    DEFAULT_NEW_PROJECT_COLOR_KEY,
  );
  const [showProjectColorPicker, setShowProjectColorPicker] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const panelLayout = getFloatingPanelLayout(
    pending.anchorRect,
    entryType === "PROJECT" ? 380 : 440,
  );
  const leaveColorKey = getColorKeyForLeaveType(leaveType);
  const leaveLabel = getDefaultLabelForLeaveType(leaveType);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const normalizedSearch = search.trim().toLowerCase();
  const projectColorOption = getColorOption(projectColorKey);

  const availableProjects = useMemo(
    () =>
      projects
        .filter((project) => !isLeaveColorKey(project.colorKey))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [projects],
  );

  const exactProjectMatch = useMemo(
    () =>
      normalizedSearch
        ? availableProjects.find(
            (project) =>
              project.name.trim().toLowerCase() === normalizedSearch,
          ) ?? null
        : null,
    [availableProjects, normalizedSearch],
  );

  const filteredComposerProjects = useMemo(
    () =>
      normalizedSearch
        ? availableProjects
            .filter((project) =>
              project.name.toLowerCase().includes(normalizedSearch),
            )
            .slice(0, 7)
        : [],
    [availableProjects, normalizedSearch],
  );

  const projectOptions = useMemo<ProjectComposerOption[]>(() => {
    const options: ProjectComposerOption[] = filteredComposerProjects.map((project) => ({
      kind: "project" as const,
      project,
    }));

    if (search.trim().length >= 2 && !exactProjectMatch) {
      options.push({
        kind: "create",
        name: search.trim(),
      });
    }

    return options;
  }, [exactProjectMatch, filteredComposerProjects, search]);

  const visibleProjectOptions = useMemo<ProjectComposerOption[]>(
    () =>
      normalizedSearch
        ? projectOptions
        : recentProjects.map((project) => ({
            kind: "project" as const,
            project,
          })),
    [normalizedSearch, projectOptions, recentProjects],
  );

  useEffect(() => {
    setEntryType("PROJECT");
    setSearch("");
    setLeaveName("");
    setLeaveType("HOLIDAY");
    setProjectColorKey(DEFAULT_NEW_PROJECT_COLOR_KEY);
    setShowProjectColorPicker(false);
    setActiveSuggestionIndex(-1);
    setBusy(false);
    setErr(null);
  }, [pending]);

  useEffect(() => {
    if (entryType !== "PROJECT") {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [entryType, pending]);

  useEffect(() => {
    if (visibleProjectOptions.length === 0) {
      setActiveSuggestionIndex(-1);
      return;
    }

    setActiveSuggestionIndex((current) =>
      current >= visibleProjectOptions.length ? visibleProjectOptions.length - 1 : current,
    );
  }, [visibleProjectOptions]);

  function handleEntryTypeChange(nextType: TimelineEntryType) {
    setEntryType(nextType);
    setErr(null);

    if (nextType === "PROJECT") {
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }

    if (nextType === "LEAVE" && !leaveName.trim()) {
      setLeaveName(leaveLabel);
    }
  }

  function handleLeaveTypeChange(nextLeaveType: LeaveType) {
    const currentDefault = getDefaultLabelForLeaveType(leaveType);
    const nextDefault = getDefaultLabelForLeaveType(nextLeaveType);

    if (!leaveName.trim() || leaveName.trim() === currentDefault) {
      setLeaveName(nextDefault);
    }

    setLeaveType(nextLeaveType);
    setErr(null);
  }

  async function submitProjectChoice(option?: ProjectComposerOption) {
    const trimmed = search.trim();

    if (!trimmed && !option) {
      return;
    }

    const resolvedOption =
      option ??
      (activeSuggestionIndex >= 0
        ? visibleProjectOptions[activeSuggestionIndex]
        : null) ??
      (exactProjectMatch
        ? {
            kind: "project" as const,
            project: exactProjectMatch,
          }
        : trimmed.length >= 2
          ? {
              kind: "create" as const,
              name: trimmed,
            }
          : null);

    if (!resolvedOption) {
      return;
    }

    try {
      setBusy(true);
      setErr(null);

      if (resolvedOption.kind === "project") {
        await onChooseProject(resolvedOption.project.id);
      } else {
        await onCreateProject(resolvedOption.name, projectColorKey);
      }
    } catch (error: any) {
      setErr(error?.message ?? "Failed to create assignment");
      setBusy(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-950/10" onClick={onClose} />

      <div
        className="fixed z-50 flex flex-col overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
        style={panelLayout}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200/70 px-4 py-4 dark:border-zinc-800">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-300">
              Finish Assignment
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-zinc-100">
              {pending.lengthDays} working day{pending.lengthDays === 1 ? "" : "s"}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
              {entryType === "PROJECT"
                ? "Pick an existing project or create one inline."
                : "Choose a leave type and assign it directly."}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-200 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800 dark:hover:bg-zinc-800"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-4">
          <div className="mb-4 inline-flex rounded-2xl bg-slate-100 p-1 ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800">
            {([
              ["PROJECT", "Project"],
              ["LEAVE", "Leave"],
            ] as const).map(([value, label]) => {
              const selected = entryType === value;

              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleEntryTypeChange(value)}
                  className={[
                    "rounded-2xl px-4 py-2 text-sm font-medium transition",
                    selected
                      ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100"
                      : "text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100",
                  ].join(" ")}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {entryType === "PROJECT" ? (
            <>
              <input
                ref={searchInputRef}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setActiveSuggestionIndex(-1);
                  setErr(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    if (visibleProjectOptions.length === 0) {
                      return;
                    }

                    event.preventDefault();
                    setActiveSuggestionIndex((current) =>
                      current < visibleProjectOptions.length - 1 ? current + 1 : 0,
                    );
                    return;
                  }

                  if (event.key === "ArrowUp") {
                    if (visibleProjectOptions.length === 0) {
                      return;
                    }

                    event.preventDefault();
                    setActiveSuggestionIndex((current) =>
                      current <= 0 ? visibleProjectOptions.length - 1 : current - 1,
                    );
                    return;
                  }

                  if (event.key === "Enter") {
                    event.preventDefault();
                    void submitProjectChoice();
                    return;
                  }

                  if (event.key === "Escape") {
                    event.preventDefault();
                    onClose();
                  }
                }}
                placeholder="Type project name..."
                className="mb-3 w-full rounded-2xl bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:bg-zinc-900 dark:ring-zinc-800 dark:focus:ring-sky-800"
              />

              <div className="rounded-3xl bg-slate-50 p-3 ring-1 ring-slate-200/80 dark:bg-zinc-900/60 dark:ring-zinc-800">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
                    {normalizedSearch ? "Suggestions" : "Recent projects"}
                  </div>
                  {search.trim() ? (
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                      Enter to assign
                    </div>
                  ) : null}
                </div>

                {search.trim() ? (
                  <div className="max-h-56 space-y-2 overflow-y-auto overscroll-contain pr-1">
                    {visibleProjectOptions.map((option, index) => {
                      const selected = activeSuggestionIndex === index;

                      if (option.kind === "project") {
                        const visual = getColorOption(option.project.colorKey);

                        return (
                          <button
                            key={option.project.id}
                            type="button"
                            disabled={busy}
                            onMouseEnter={() => setActiveSuggestionIndex(index)}
                            onClick={() => {
                              void submitProjectChoice(option);
                            }}
                            className={[
                              "flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition",
                              selected
                                ? "border-sky-200 bg-sky-50 dark:border-sky-900/50 dark:bg-sky-950/20"
                                : "border-slate-200/80 bg-white hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900",
                            ].join(" ")}
                          >
                            <div
                              className={[
                                "flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br text-[11px] font-bold ring-1",
                                visual.swatchClassName,
                              ].join(" ")}
                            >
                              {visual.icon}
                            </div>

                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-slate-900 dark:text-zinc-100">
                                {option.project.name}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-zinc-400">
                                {visual.label}
                              </div>
                            </div>
                          </button>
                        );
                      }

                      return (
                        <button
                          key={`create-${option.name.toLowerCase()}`}
                          type="button"
                          disabled={busy}
                          onMouseEnter={() => setActiveSuggestionIndex(index)}
                          onClick={() => {
                            void submitProjectChoice(option);
                          }}
                          className={[
                            "flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition",
                            selected
                              ? "border-sky-200 bg-sky-50 dark:border-sky-900/50 dark:bg-sky-950/20"
                              : "border-dashed border-slate-200/80 bg-white hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900",
                          ].join(" ")}
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-[11px] font-bold text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900/50">
                            +
                          </div>

                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900 dark:text-zinc-100">
                              Create new project: {option.name}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-zinc-400">
                              New projects use {projectColorOption.label} by default.
                            </div>
                          </div>
                        </button>
                      );
                    })}

                    {visibleProjectOptions.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 p-3 text-sm text-slate-500 dark:border-zinc-800 dark:text-zinc-400">
                        Type at least two characters to search or create a project.
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <>
                    {visibleProjectOptions.length > 0 ? (
                      <div className="max-h-56 space-y-2 overflow-y-auto overscroll-contain pr-1">
                        {visibleProjectOptions.map((option, index) => {
                          if (option.kind !== "project") {
                            return null;
                          }

                          const selected = activeSuggestionIndex === index;
                          const visual = getColorOption(option.project.colorKey);

                          return (
                            <button
                              key={option.project.id}
                              type="button"
                              disabled={busy}
                              onMouseEnter={() => setActiveSuggestionIndex(index)}
                              onClick={() => {
                                void submitProjectChoice(option);
                              }}
                              className={[
                                "flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition",
                                selected
                                  ? "border-sky-200 bg-sky-50 dark:border-sky-900/50 dark:bg-sky-950/20"
                                  : "border-slate-200/80 bg-white hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900",
                              ].join(" ")}
                            >
                              <div
                                className={[
                                  "flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br text-[11px] font-bold ring-1",
                                  visual.swatchClassName,
                                ].join(" ")}
                              >
                                {visual.icon}
                              </div>

                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-slate-900 dark:text-zinc-100">
                                  {option.project.name}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-zinc-400">
                                  {visual.label}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 p-3 text-sm text-slate-500 dark:border-zinc-800 dark:text-zinc-400">
                        Type a project name, then press Enter to reuse it or create it instantly.
                      </div>
                    )}
                  </>
                )}

                {search.trim().length >= 2 && !exactProjectMatch ? (
                  <div className="mt-3 rounded-2xl border border-dashed border-slate-200/80 bg-white/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/70">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={[
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-[10px] font-bold ring-1",
                            projectColorOption.swatchClassName,
                          ].join(" ")}
                        >
                          {projectColorOption.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900 dark:text-zinc-100">
                            {projectColorOption.label}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-zinc-400">
                            New projects use {projectColorOption.label} by default.
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setShowProjectColorPicker((current) => !current)
                        }
                        className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800 dark:hover:bg-zinc-800"
                      >
                        {showProjectColorPicker ? "Hide" : "Choose color"}
                      </button>
                    </div>

                    {showProjectColorPicker ? (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {DEPARTMENT_COLOR_OPTIONS.map((option) => (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => {
                              setProjectColorKey(option.key);
                            }}
                            className={[
                              "flex items-center gap-2 rounded-2xl border px-3 py-2 text-left transition",
                              projectColorKey === option.key
                                ? "border-sky-200 bg-sky-50 dark:border-sky-900/50 dark:bg-sky-950/20"
                                : "border-slate-200/70 bg-white hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900",
                            ].join(" ")}
                          >
                            <div
                              className={[
                                "flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br text-[10px] font-bold ring-1",
                                option.swatchClassName,
                              ].join(" ")}
                            >
                              {option.icon}
                            </div>
                            <span className="truncate text-xs font-medium text-slate-700 dark:text-zinc-300">
                              {option.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="rounded-3xl bg-slate-50 p-3 ring-1 ring-slate-200/80 dark:bg-zinc-900/60 dark:ring-zinc-800">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
                Leave type
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {LEAVE_COLOR_OPTIONS.map((option) => {
                  const optionLeaveType = getLeaveTypeFromColorKey(option.key);
                  const selected = optionLeaveType === leaveType;

                  if (!optionLeaveType) {
                    return null;
                  }

                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => handleLeaveTypeChange(optionLeaveType)}
                      className={[
                        "flex items-center gap-2 rounded-2xl border px-3 py-2 text-left transition",
                        selected
                          ? "border-sky-200 bg-sky-50 dark:border-sky-900/50 dark:bg-sky-950/20"
                          : "border-slate-200/70 bg-white hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900",
                      ].join(" ")}
                    >
                      <div
                        className={[
                          "flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br text-[10px] font-bold ring-1",
                          option.swatchClassName,
                        ].join(" ")}
                      >
                        {option.icon}
                      </div>
                      <span className="truncate text-xs font-medium text-slate-700 dark:text-zinc-300">
                        {option.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <label className="mt-4 block text-xs font-medium text-slate-500 dark:text-zinc-400">
                Leave label
              </label>
              <input
                value={leaveName}
                onChange={(event) => setLeaveName(event.target.value)}
                placeholder={leaveLabel}
                className="mt-2 w-full rounded-2xl bg-white px-3 py-2.5 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:bg-zinc-950 dark:ring-zinc-800 dark:focus:ring-sky-800"
              />

              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  try {
                    setBusy(true);
                    setErr(null);

                    const label = leaveName.trim() || leaveLabel;
                    const existingProject =
                      projects.find(
                        (project) =>
                          normalizeColorKey(project.colorKey) === leaveColorKey &&
                          project.name.trim().toLowerCase() ===
                            label.toLowerCase(),
                      ) ??
                      (label === leaveLabel
                        ? projects.find(
                            (project) =>
                              normalizeColorKey(project.colorKey) ===
                              leaveColorKey,
                          )
                        : null);

                    if (existingProject) {
                      await onChooseProject(existingProject.id);
                      return;
                    }

                    await onCreateProject(label, leaveColorKey);
                  } catch (error: any) {
                    setErr(error?.message ?? "Failed to assign leave");
                    setBusy(false);
                  }
                }}
                className="mt-4 w-full rounded-2xl bg-sky-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
              >
                {busy ? "Saving..." : "Create leave + assign"}
              </button>
            </div>
          )}

          {err ? (
            <div className="mt-3 rounded-2xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-100 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-900/40">
              {err}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

export function DashboardPage({
  me,
  onLogout,
}: {
  me: Me;
  onLogout: () => void;
}) {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());
  const [showNewProject, setShowNewProject] = useState(false);
  const [projectRailOpen, setProjectRailOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [zoomMode, setZoomMode] = useState<TimelineZoomMode>("5w");
  const [densityMode, setDensityMode] =
    useState<TimelineDensityMode>("comfortable");

  const [users, setUsers] = useState<UserRow[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);

  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(true);

  const [usersError, setUsersError] = useState<string | null>(null);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [placementProjectId, setPlacementProjectId] = useState<string | null>(
    null,
  );
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(
    null,
  );
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [drawerProjectId, setDrawerProjectId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const deferredProjectSearch = useDeferredValue(projectSearch);

  const [activityRefreshKey, setActivityRefreshKey] = useState(0);
  const [assignmentPreview, setAssignmentPreview] =
    useState<AssignmentPreview | null>(null);
  const [draftAssignment, setDraftAssignment] = useState<DraftAssignment | null>(
    null,
  );
  const [pendingComposer, setPendingComposer] = useState<PendingComposer | null>(
    null,
  );
  const [interaction, setInteraction] = useState<InteractionState | null>(null);
  const [rowResize, setRowResize] = useState<RowResizeState | null>(null);
  const [customRowHeightsByUserId, setCustomRowHeightsByUserId] = useState<
    Record<string, number>
  >({});
  const [toast, setToast] = useState<ToastState | null>(null);

  const [timelineStart, setTimelineStart] = useState(() =>
    addDays(startOfMonday(new Date()), -TIMELINE_SHIFT_DAYS),
  );

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rowsContainerRef = useRef<HTMLDivElement | null>(null);
  const initialScrollAppliedRef = useRef(false);
  const pendingScrollAdjustRef = useRef<number | null>(null);
  const rangeShiftLockRef = useRef(false);
  const ignoreProgrammaticScrollRef = useRef(false);
  const stableLaneMapCacheRef = useRef<
    Record<string, Record<string, number>>
  >({});
  const draftAssignmentRef = useRef<DraftAssignment | null>(null);
  const assignmentPreviewRef = useRef<AssignmentPreview | null>(null);

  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(720);
  const [timelineViewportWidth, setTimelineViewportWidth] = useState(() =>
    typeof window === "undefined" ? 1280 : window.innerWidth,
  );
  const densityConfig = TIMELINE_DENSITY_OPTIONS[densityMode];
  const leftWidth = LEFT_COLUMN_WIDTH;
  const dayWidth = getTimelineDayWidth(zoomMode, timelineViewportWidth, leftWidth);
  const dayWidthRef = useRef(dayWidth);

  function setDraftAssignmentState(nextDraft: DraftAssignment | null) {
    draftAssignmentRef.current = nextDraft;
    setDraftAssignment(nextDraft);
  }

  function setAssignmentPreviewState(nextPreview: AssignmentPreview | null) {
    assignmentPreviewRef.current = nextPreview;
    setAssignmentPreview(nextPreview);
  }

  function clearInlinePlacementState() {
    setPlacementProjectId(null);
    setPendingComposer(null);
    setDraftAssignmentState(null);
    setAssignmentPreviewState(null);
    setInteraction(null);
  }

  function cancelRowResize(activeResize: RowResizeState) {
    setCustomRowHeightsByUserId((previous) => {
      if (activeResize.previousCustomHeight === null) {
        if (!(activeResize.userId in previous)) {
          return previous;
        }

        const next = { ...previous };
        delete next[activeResize.userId];
        return next;
      }

      return {
        ...previous,
        [activeResize.userId]: activeResize.previousCustomHeight,
      };
    });
    setRowResize(null);
  }

  useEffect(() => {
    function handleWindowKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isEditableTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        Boolean(target?.isContentEditable);
      const hasTransientUi =
        Boolean(rowResize) ||
        Boolean(interaction) ||
        Boolean(draftAssignmentRef.current) ||
        Boolean(assignmentPreviewRef.current) ||
        Boolean(pendingComposer) ||
        Boolean(placementProjectId) ||
        showNewProject;

      if (event.key === "Escape") {
        if (rowResize) {
          event.preventDefault();
          cancelRowResize(rowResize);
          return;
        }

        if (!hasTransientUi || (isEditableTarget && !pendingComposer && !showNewProject)) {
          if (!isEditableTarget && selectedAssignmentId) {
            event.preventDefault();
            setSelectedAssignmentId(null);
          }
          return;
        }

        event.preventDefault();
        clearInlinePlacementState();
        setShowNewProject(false);
        setSelectedAssignmentId(null);
        return;
      }

      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        selectedAssignmentId &&
        !isEditableTarget &&
        !hasTransientUi
      ) {
        event.preventDefault();
        void handleDelete(selectedAssignmentId);
      }
    }

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => window.removeEventListener("keydown", handleWindowKeyDown);
  }, [
    interaction,
    pendingComposer,
    placementProjectId,
    rowResize,
    selectedAssignmentId,
    showNewProject,
  ]);

  useEffect(() => {
    if (!interaction && !rowResize) {
      return;
    }

    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;

    document.body.style.userSelect = "none";
    document.body.style.cursor =
      rowResize
        ? "ns-resize"
        : interaction?.mode === "resize"
        ? "ew-resize"
        : interaction?.mode === "move"
          ? interaction.duplicate
            ? "copy"
            : "grabbing"
          : "crosshair";

    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
    };
  }, [interaction, rowResize]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
    }, 2200);

    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  useEffect(() => {
    if (!rowResize) {
      return;
    }

    function handleMouseMove(event: MouseEvent) {
      const deltaY = event.clientY - rowResize.originClientY;
      const nextHeight = clamp(
        rowResize.startHeight + deltaY,
        rowResize.minHeight,
        MAX_MANUAL_ROW_HEIGHT,
      );

      setCustomRowHeightsByUserId((previous) => {
        if (previous[rowResize.userId] === nextHeight) {
          return previous;
        }

        return {
          ...previous,
          [rowResize.userId]: nextHeight,
        };
      });
    }

    function handleMouseUp() {
      if (rowResize.previousCustomHeight === null) {
        setCustomRowHeightsByUserId((previous) => {
          const nextHeight = previous[rowResize.userId];

          if (
            typeof nextHeight !== "number" ||
            nextHeight > rowResize.minHeight
          ) {
            return previous;
          }

          const next = { ...previous };
          delete next[rowResize.userId];
          return next;
        });
      }

      setRowResize(null);
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [rowResize]);

  function toggleTheme() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoadingUsers(true);
        setUsersError(null);
        const data = await getUsers();
        if (alive) {
          setUsers(data);
        }
      } catch (error: any) {
        if (alive) {
          setUsersError(error?.message ?? "Failed to load users");
        }
      } finally {
        if (alive) {
          setLoadingUsers(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoadingProjects(true);
        setProjectsError(null);
        const data = await getProjects();
        if (alive) {
          setProjects(
            data.map((project) => ({
              ...project,
              colorKey: normalizeColorKey(project.colorKey),
            })),
          );
        }
      } catch (error: any) {
        if (alive) {
          setProjectsError(error?.message ?? "Failed to load projects");
        }
      } finally {
        if (alive) {
          setLoadingProjects(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const days = useMemo(
    () => makeDays(timelineStart, TIMELINE_WINDOW_DAYS),
    [timelineStart],
  );

  const holidayMap = useMemo(
    () => buildHolidayMapForYears(days, "DE-SH"),
    [days],
  );

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoadingAssignments(true);
        setAssignmentsError(null);
        const from = isoDateOnlyLocal(days[0]);
        const to = isoDateOnlyLocal(addDays(days[days.length - 1], 1));
        const data = await getAssignments(from, to);

        if (alive) {
          setAssignments(data);
        }
      } catch (error: any) {
        if (alive) {
          setAssignmentsError(error?.message ?? "Failed to load assignments");
        }
      } finally {
        if (alive) {
          setLoadingAssignments(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [days]);

  useEffect(() => {
    if (!scrollRef.current || initialScrollAppliedRef.current) {
      return;
    }

    ignoreProgrammaticScrollRef.current = true;
    scrollRef.current.scrollLeft = TIMELINE_SHIFT_DAYS * dayWidth;
    setViewportHeight(scrollRef.current.clientHeight);
    initialScrollAppliedRef.current = true;
    dayWidthRef.current = dayWidth;
  }, [dayWidth]);

  useEffect(() => {
    if (!scrollRef.current) {
      dayWidthRef.current = dayWidth;
      return;
    }

    const previousDayWidth = dayWidthRef.current;

    if (previousDayWidth === dayWidth) {
      return;
    }

    const visibleDayOffset = scrollRef.current.scrollLeft / previousDayWidth;
    ignoreProgrammaticScrollRef.current = true;
    scrollRef.current.scrollLeft = visibleDayOffset * dayWidth;
    dayWidthRef.current = dayWidth;
  }, [dayWidth]);

  useEffect(() => {
    if (!scrollRef.current || pendingScrollAdjustRef.current === null) {
      return;
    }

    ignoreProgrammaticScrollRef.current = true;
    scrollRef.current.scrollLeft += pendingScrollAdjustRef.current;
    pendingScrollAdjustRef.current = null;
    rangeShiftLockRef.current = false;
  }, [days]);

  useEffect(() => {
    const element = scrollRef.current;

    if (!element) {
      return;
    }

    const syncViewportMetrics = () => {
      setViewportHeight(element.clientHeight);
      setTimelineViewportWidth(element.clientWidth);
    };

    syncViewportMetrics();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => {
        syncViewportMetrics();
      });

      observer.observe(element);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", syncViewportMetrics);
    return () => window.removeEventListener("resize", syncViewportMetrics);
  }, [projectRailOpen]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );
  const placementProject = useMemo(
    () => projects.find((project) => project.id === placementProjectId) ?? null,
    [placementProjectId, projects],
  );

  const drawerProject = useMemo(
    () => projects.find((project) => project.id === drawerProjectId) ?? null,
    [projects, drawerProjectId],
  );

  const filteredTeams = useMemo(() => {
    const trimmed = deferredQuery.trim().toLowerCase();

    return DEMO_TEAMS.filter((team) => {
      if (!trimmed) {
        return true;
      }

      return (
        team.name.toLowerCase().includes(trimmed) ||
        team.members.some((member) =>
          member.name.toLowerCase().includes(trimmed),
        )
      );
    });
  }, [deferredQuery]);

  const filteredProjects = useMemo(() => {
    const trimmed = deferredProjectSearch.trim().toLowerCase();

    return projects.filter((project) =>
      !trimmed ? true : project.name.toLowerCase().includes(trimmed),
    );
  }, [deferredProjectSearch, projects]);

  const recentComposerProjects = useMemo(() => {
    const projectMap = new Map(
      projects.map((project) => [project.id, project] as const),
    );
    const recentById = new Map<string, Project>();

    const sortedAssignments = [...assignments].sort((left, right) => {
      const rightTime = new Date(
        right.updatedAt ?? right.createdAt ?? right.startDate,
      ).getTime();
      const leftTime = new Date(
        left.updatedAt ?? left.createdAt ?? left.startDate,
      ).getTime();

      return rightTime - leftTime;
    });

    for (const assignment of sortedAssignments) {
      const project = projectMap.get(assignment.projectId);

      if (!project || isLeaveColorKey(project.colorKey)) {
        continue;
      }

      if (!recentById.has(project.id)) {
        recentById.set(project.id, project);
      }

      if (recentById.size >= 6) {
        break;
      }
    }

    if (recentById.size < 6) {
      const fallbackProjects = [...projects]
        .filter((project) => !isLeaveColorKey(project.colorKey))
        .sort(
          (left, right) =>
            new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
        );

      for (const project of fallbackProjects) {
        if (!recentById.has(project.id)) {
          recentById.set(project.id, project);
        }

        if (recentById.size >= 6) {
          break;
        }
      }
    }

    return Array.from(recentById.values());
  }, [assignments, projects]);

  const selectedTeam = useMemo(
    () => DEMO_TEAMS.find((team) => team.id === selectedTeamId) ?? null,
    [selectedTeamId],
  );

  const filteredUsers = useMemo(() => {
    const trimmed = deferredQuery.trim().toLowerCase();

    return users.filter((user) => {
      const teamMatches = selectedTeamId
        ? USER_TEAM_MAP[user.username] === selectedTeamId
        : true;
      const queryMatches = !trimmed
        ? true
        : user.displayName.toLowerCase().includes(trimmed);

      return teamMatches && queryMatches;
    });
  }, [deferredQuery, selectedTeamId, users]);

  const todayIndex = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const index = days.findIndex(
      (day) => day.toDateString() === today.toDateString(),
    );
    return index === -1 ? null : index;
  }, [days]);

  useEffect(() => {
    if (!showNewProject && !pendingComposer) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [pendingComposer, showNewProject]);

  const duplicatePreviewAssignment = useMemo(() => {
    if (interaction?.mode !== "move" || !interaction.duplicate) {
      return null;
    }

    const sourceAssignment = assignments.find(
      (assignment) => assignment.id === interaction.assignmentId,
    );

    if (!sourceAssignment) {
      return null;
    }

    const preview = assignmentPreview ?? {
      assignmentId: interaction.assignmentId,
      startDate: interaction.originalStartDate,
      endDate: interaction.originalEndDate,
      userId: interaction.originalUserId,
      laneIndex: interaction.originalLaneIndex,
    };

    return {
      ...sourceAssignment,
      id: DUPLICATE_PREVIEW_ASSIGNMENT_ID,
      startDate: preview.startDate,
      endDate: preview.endDate,
      userId: preview.userId ?? interaction.originalUserId,
      laneIndex: preview.laneIndex ?? interaction.originalLaneIndex,
    } satisfies TimelineAssignmentLike;
  }, [assignmentPreview, assignments, interaction]);

  const moveGhostAssignment = useMemo(() => {
    if (interaction?.mode !== "move") {
      return null;
    }

    const sourceAssignment = assignments.find(
      (assignment) => assignment.id === interaction.assignmentId,
    );

    if (!sourceAssignment) {
      return null;
    }

    return {
      assignmentId: interaction.assignmentId,
      projectId: sourceAssignment.projectId,
      userId: interaction.originalUserId,
      laneIndex: interaction.originalLaneIndex,
      startDate: interaction.originalStartDate,
      endDate: interaction.originalEndDate,
    };
  }, [assignments, interaction]);

  const previewedAssignments = useMemo(() => {
    const nextAssignments =
      interaction?.mode === "move" && interaction.duplicate
        ? [...assignments]
        : assignments.map((assignment) =>
            assignmentPreview && assignment.id === assignmentPreview.assignmentId
              ? {
                  ...assignment,
                  startDate: assignmentPreview.startDate,
                  endDate: assignmentPreview.endDate,
                  userId: assignmentPreview.userId ?? assignment.userId,
                  laneIndex: assignmentPreview.laneIndex ?? assignment.laneIndex,
                }
              : assignment,
          );

    if (draftAssignment) {
      nextAssignments.unshift(draftAssignment);
    }

    if (duplicatePreviewAssignment) {
      nextAssignments.unshift(duplicatePreviewAssignment);
    }

    return nextAssignments;
  }, [
    assignmentPreview,
    assignments,
    draftAssignment,
    duplicatePreviewAssignment,
    interaction,
  ]);

  const draftProject = useMemo(() => {
    if (!draftAssignment || draftAssignment.projectId !== DRAFT_PROJECT_ID) {
      return null;
    }

    return createDraftProject(placementProject);
  }, [draftAssignment, placementProject]);

  const projectsById = useMemo(() => {
    const map: Record<string, Project> = {};

    for (const project of projects) {
      map[project.id] = {
        ...project,
        colorKey: normalizeColorKey(project.colorKey),
      };
    }

    if (draftProject) {
      map[draftProject.id] = draftProject;
    }

    return map;
  }, [draftProject, projects]);

  const assignmentsByUser = useMemo(() => {
    const map: Record<string, TimelineAssignmentLike[]> = {};

    for (const assignment of previewedAssignments) {
      if (!map[assignment.userId]) {
        map[assignment.userId] = [];
      }

      map[assignment.userId].push(assignment);
    }

    return map;
  }, [previewedAssignments]);

  const committedStableLaneMapByUser = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};

    for (const [userId, userAssignments] of Object.entries(
      assignments.reduce<Record<string, AssignmentRow[]>>((grouped, assignment) => {
        if (!grouped[assignment.userId]) {
          grouped[assignment.userId] = [];
        }

        grouped[assignment.userId].push(assignment);
        return grouped;
      }, {}),
    )) {
      map[userId] = buildStableLaneMap(
        userAssignments,
        stableLaneMapCacheRef.current[userId],
      );
    }

    return map;
  }, [assignments]);

  useEffect(() => {
    stableLaneMapCacheRef.current = committedStableLaneMapByUser;
  }, [committedStableLaneMapByUser]);

  const preferredLaneByUser = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};

    for (const [userId, userAssignments] of Object.entries(assignmentsByUser)) {
      const lanePreferences = {
        ...(committedStableLaneMapByUser[userId] ?? {}),
      };

      for (const assignment of userAssignments) {
        if (typeof assignment.laneIndex === "number") {
          lanePreferences[assignment.id] = Math.max(0, assignment.laneIndex);
        }
      }

      map[userId] = lanePreferences;
    }

    return map;
  }, [assignmentsByUser, committedStableLaneMapByUser]);

  const lockedAssignmentId =
    interaction?.mode === "create"
      ? DRAFT_ASSIGNMENT_ID
      : assignmentPreview?.assignmentId ?? null;
  const freezePreferredLanes =
    interaction?.mode === "move" || interaction?.mode === "resize";

  const rowMetrics = useMemo(() => {
    let top = 0;

    return filteredUsers.map((user) => {
      const layout = buildUserRowLayout(
        assignmentsByUser[user.id] ?? [],
        projectsById,
        days,
        {
          preferredLaneByAssignmentId: preferredLaneByUser[user.id],
          lockedAssignmentId,
          freezePreferredLanes,
          laneHeight: densityConfig.laneHeight,
          rowPaddingY: densityConfig.rowPaddingY,
          minRowHeight: densityConfig.minRowHeight,
        },
      );
      const autoHeight = layout.rowHeight;
      const height = Math.max(
        autoHeight,
        customRowHeightsByUserId[user.id] ?? 0,
      );
      const row = {
        user,
        layout,
        top,
        autoHeight,
        height,
      };
      top += height;
      return row;
    });
  }, [
    assignmentsByUser,
    customRowHeightsByUserId,
    days,
    filteredUsers,
    freezePreferredLanes,
    lockedAssignmentId,
    densityConfig.laneHeight,
    densityConfig.minRowHeight,
    densityConfig.rowPaddingY,
    projectsById,
    preferredLaneByUser,
  ]);

  const totalRowsHeight =
    rowMetrics.length > 0
      ? rowMetrics[rowMetrics.length - 1].top +
        rowMetrics[rowMetrics.length - 1].height
      : 0;
  const lastRowUserId =
    rowMetrics.length > 0 ? rowMetrics[rowMetrics.length - 1].user.id : null;
  const bottomResizePadding =
    rowResize && rowResize.userId === lastRowUserId ? 320 : 120;
  const rowMetricsRef = useRef(rowMetrics);
  const totalRowsHeightRef = useRef(totalRowsHeight);

  useEffect(() => {
    rowMetricsRef.current = rowMetrics;
    totalRowsHeightRef.current = totalRowsHeight;
  }, [rowMetrics, totalRowsHeight]);

  const visibleRowRange = useMemo(() => {
    if (rowMetrics.length === 0) {
      return { start: 0, end: 0 };
    }

    const start = Math.max(
      0,
      findFirstVisibleRow(rowMetrics, scrollTop) - ROW_OVERSCAN,
    );
    const end = Math.min(
      rowMetrics.length,
      findLastVisibleRow(rowMetrics, scrollTop + viewportHeight) + ROW_OVERSCAN,
    );

    return { start, end };
  }, [rowMetrics, scrollTop, viewportHeight]);

  const visibleRows = useMemo(
    () => rowMetrics.slice(visibleRowRange.start, visibleRowRange.end),
    [rowMetrics, visibleRowRange.end, visibleRowRange.start],
  );
  const activeMoveAssignmentId =
    interaction?.mode === "move" && !interaction.duplicate
      ? interaction.assignmentId
      : null;
  const activeMoveTargetUserId =
    interaction?.mode === "move"
      ? assignmentPreview?.userId ?? interaction.originalUserId
      : null;
  const activeMoveTargetLaneIndex =
    interaction?.mode === "move"
      ? assignmentPreview?.laneIndex ?? interaction.originalLaneIndex
      : null;
  const activeMoveTargetUser =
    activeMoveTargetUserId !== null
      ? rowMetrics.find((row) => row.user.id === activeMoveTargetUserId)?.user ??
        users.find((user) => user.id === activeMoveTargetUserId) ??
        null
      : null;
  const activeMoveStatusLabel =
    interaction?.mode === "move" && activeMoveTargetUser
      ? interaction.horizontalLock
        ? interaction.duplicate
          ? `Duplicate in ${activeMoveTargetUser.displayName}`
          : `Move in ${activeMoveTargetUser.displayName}`
        : interaction.duplicate
          ? activeMoveTargetUser.id === interaction.originalUserId
            ? `Duplicate in ${activeMoveTargetUser.displayName}`
            : `Duplicate to ${activeMoveTargetUser.displayName}`
          : activeMoveTargetUser.id === interaction.originalUserId
            ? `Reorder in ${activeMoveTargetUser.displayName}`
            : `Move to ${activeMoveTargetUser.displayName}`
      : null;
  const activeMoveStatusText =
    interaction?.mode === "move" && interaction.horizontalLock
      ? activeMoveStatusLabel
        ? `${activeMoveStatusLabel} · Horizontal lock`
        : "Horizontal lock"
      : activeMoveStatusLabel;

  function resolveMoveTarget(clientY: number, fallbackUserId: string, fallbackLaneIndex: number) {
    const rowsElement = rowsContainerRef.current;
    const currentRowMetrics = rowMetricsRef.current;
    const currentTotalRowsHeight = totalRowsHeightRef.current;

    if (!rowsElement || currentRowMetrics.length === 0) {
      return {
        userId: fallbackUserId,
        laneIndex: fallbackLaneIndex,
      };
    }

    const rowsRect = rowsElement.getBoundingClientRect();
    const clampedOffsetY = Math.max(
      0,
      Math.min(clientY - rowsRect.top, Math.max(0, currentTotalRowsHeight - 1)),
    );
    const targetRow = findRowAtOffset(currentRowMetrics, clampedOffsetY);

    if (!targetRow) {
      return {
        userId: fallbackUserId,
        laneIndex: fallbackLaneIndex,
      };
    }

    const offsetWithinRow = clampedOffsetY - targetRow.top;
    const rawLaneIndex = Math.floor(
      (offsetWithinRow - densityConfig.rowPaddingY + densityConfig.laneHeight / 2) /
        densityConfig.laneHeight,
    );

    return {
      userId: targetRow.user.id,
      laneIndex: Math.max(
        0,
        Math.min(targetRow.layout.laneCount, rawLaneIndex),
      ),
    };
  }

  const drawerAssignments = useMemo(() => {
    if (!drawerProjectId) {
      return [];
    }

    return assignments.filter(
      (assignment) => assignment.projectId === drawerProjectId,
    );
  }, [assignments, drawerProjectId]);

  async function persistAssignmentDraft(projectId: string) {
    const activeDraft = draftAssignmentRef.current;

    if (!activeDraft) {
      return;
    }

    const lengthDays = endExclusiveToWorkingLength(
      activeDraft.startDate,
      activeDraft.endDate,
      holidayMap,
    );
    const created = await createAssignment(
      activeDraft.userId,
      projectId,
      activeDraft.startDate,
      lengthDays,
    );

    setAssignments((previous) => [created, ...previous]);
    setActivityRefreshKey((value) => value + 1);
    clearInlinePlacementState();
  }

  function beginDraftAssignment(
    userId: string,
    projectId: string,
    anchorIndex: number,
  ) {
    const anchorDate = days[anchorIndex];
    const range = getWorkingRangeFromDrag(anchorDate, anchorDate, holidayMap);

    setDraftAssignmentState({
      id: DRAFT_ASSIGNMENT_ID,
      userId,
      projectId,
      startDate: range.snappedStart.toISOString(),
      endDate: range.endExclusive.toISOString(),
      isDraft: true,
    });
  }

  function updateDraftAssignment(
    userId: string,
    projectId: string,
    anchorIndex: number,
    targetIndex: number,
  ) {
    const safeIndex = clamp(targetIndex, 0, days.length - 1);
    const range = getWorkingRangeFromDrag(
      days[anchorIndex],
      days[safeIndex],
      holidayMap,
    );

    setDraftAssignmentState({
      id: DRAFT_ASSIGNMENT_ID,
      userId,
      projectId,
      startDate: range.snappedStart.toISOString(),
      endDate: range.endExclusive.toISOString(),
      isDraft: true,
    });
  }

  function handleCellPointerDown(
    userId: string,
    dayIndex: number,
    anchorEl: HTMLElement,
  ) {
    const projectId = placementProjectId ?? DRAFT_PROJECT_ID;
    const anchorRect = anchorEl.getBoundingClientRect();

    beginDraftAssignment(userId, projectId, dayIndex);
    setSelectedAssignmentId(null);
    setPendingComposer(null);
    setAssignmentPreviewState(null);
    setInteraction({
      mode: "create",
      userId,
      anchorIndex: dayIndex,
      originClientX: anchorRect.left + dayWidth / 2,
      anchorRect,
      projectId,
    });
  }

  function handleResizeStart(
    assignmentId: string,
    side: "left" | "right",
    originClientX: number,
  ) {
    const assignment = assignments.find((item) => item.id === assignmentId);

    if (!assignment) {
      return;
    }

    setAssignmentPreviewState(null);
    setInteraction({
      mode: "resize",
      assignmentId,
      side,
      originClientX,
      originalStartDate: assignment.startDate,
      originalEndDate: assignment.endDate,
      projectId: assignment.projectId,
    });
  }

  function handleMoveStart({
    assignmentId,
    originClientX,
    originClientY,
    userId,
    laneIndex,
    duplicate,
    horizontalLock,
  }: {
    assignmentId: string;
    originClientX: number;
    originClientY: number;
    userId: string;
    laneIndex: number;
    duplicate: boolean;
    horizontalLock: boolean;
  }) {
    const assignment = assignments.find((item) => item.id === assignmentId);

    if (!assignment) {
      return;
    }

    setAssignmentPreviewState({
      assignmentId,
      startDate: assignment.startDate,
      endDate: assignment.endDate,
      userId,
      laneIndex,
    });
    setInteraction({
      mode: "move",
      assignmentId,
      duplicate,
      horizontalLock,
      originClientX,
      originClientY,
      originalStartDate: assignment.startDate,
      originalEndDate: assignment.endDate,
      originalUserId: userId,
      originalLaneIndex: laneIndex,
      projectId: assignment.projectId,
    });
  }

  function handleRowResizeStart(
    userId: string,
    minHeight: number,
    startHeight: number,
    originClientY: number,
  ) {
    if (interaction) {
      return;
    }

    const previousCustomHeight = customRowHeightsByUserId[userId];

    setPendingComposer(null);
    setSelectedAssignmentId(null);
    setRowResize({
      userId,
      originClientY,
      minHeight,
      startHeight,
      previousCustomHeight:
        typeof previousCustomHeight === "number" ? previousCustomHeight : null,
    });
  }

  async function handleDelete(assignmentId: string) {
    if (!window.confirm("Delete this assignment?")) {
      return;
    }

    try {
      await deleteAssignment(assignmentId);
      setAssignments((previous) =>
        previous.filter((assignment) => assignment.id !== assignmentId),
      );
      setSelectedAssignmentId((current) =>
        current === assignmentId ? null : current,
      );
      setActivityRefreshKey((value) => value + 1);
    } catch (error: any) {
      window.alert(error?.message ?? "Failed to delete assignment");
    }
  }

  async function handleDuplicate(assignmentId: string) {
    const sourceAssignment = assignments.find(
      (assignment) => assignment.id === assignmentId,
    );

    if (!sourceAssignment) {
      return;
    }

    try {
      const created = await createAssignment(
        sourceAssignment.userId,
        sourceAssignment.projectId,
        sourceAssignment.startDate,
        endExclusiveToWorkingLength(
          sourceAssignment.startDate,
          sourceAssignment.endDate,
          holidayMap,
        ),
        {
          laneIndex:
            typeof sourceAssignment.laneIndex === "number"
              ? sourceAssignment.laneIndex + 1
              : undefined,
        },
      );

      setAssignments((previous) => [created, ...previous]);
      setActivityRefreshKey((value) => value + 1);
      setToast({
        id: Date.now(),
        message: "Duplicated assignment",
      });
    } catch (error: any) {
      window.alert(error?.message ?? "Failed to duplicate assignment");
    }
  }

  async function handleAssignFromPanel(
    userId: string,
    startDate: string,
    lengthDays: number,
  ) {
    if (!selectedProjectId) {
      return;
    }

    const created = await createAssignment(
      userId,
      selectedProjectId,
      `${startDate}T00:00:00.000Z`,
      lengthDays,
    );

    setAssignments((previous) => [created, ...previous]);
    setActivityRefreshKey((value) => value + 1);
  }

  async function handleSaveProject(
    projectId: string,
    name: string,
    colorKey: string,
  ) {
    const updated = await updateProject(projectId, {
      name,
      colorKey,
      department: getProjectDepartmentFromColorKey(colorKey) ?? "OTHER",
    });

    setProjects((previous) =>
      previous.map((project) => (project.id === projectId ? updated : project)),
    );
  }

  async function handleDeleteProject(projectId: string) {
    await deleteProject(projectId);
    setProjects((previous) =>
      previous.filter((project) => project.id !== projectId),
    );
    setAssignments((previous) =>
      previous.filter((assignment) => assignment.projectId !== projectId),
    );

    if (selectedProjectId === projectId) {
      setSelectedProjectId(null);
    }

    if (placementProjectId === projectId) {
      setPlacementProjectId(null);
    }

    if (drawerProjectId === projectId) {
      setDrawerProjectId(null);
    }
  }

  async function handleSaveProjectMetadata(
    projectId: string,
    patch: {
      status?: ProjectStatus;
      department?: ProjectDepartment;
      colorKey?: string;
      projectManagerId?: string | null;
      requesterName?: string | null;
      contactPersonName?: string | null;
      description?: string | null;
      notes?: string | null;
      startDate?: string | null;
      dueDate?: string | null;
    },
  ) {
    const updated = await updateProject(projectId, patch);
    setProjects((previous) =>
      previous.map((project) => (project.id === projectId ? updated : project)),
    );
    setActivityRefreshKey((value) => value + 1);
  }

  useEffect(() => {
    if (!interaction) {
      return;
    }

    const activeInteraction = interaction;

    function buildMovePreview(
      assignmentId: string,
      originalStartDate: string,
      originalEndDate: string,
      calendarDelta: number,
    ) {
      const originalStart = new Date(originalStartDate);
      const candidateStart = addDays(originalStart, calendarDelta);
      const snappedStart = snapToWorkingDay(
        candidateStart,
        calendarDelta >= 0 ? 1 : -1,
        holidayMap,
      );
      const workingLength = endExclusiveToWorkingLength(
        originalStartDate,
        originalEndDate,
        holidayMap,
      );
      const nextEnd = addWorkingDaysInclusive(
        snappedStart,
        workingLength,
        holidayMap,
      );

      return {
        assignmentId,
        startDate: snappedStart.toISOString(),
        endDate: nextEnd.toISOString(),
      };
    }

    function buildResizePreview(
      assignmentId: string,
      side: "left" | "right",
      originalStartDate: string,
      originalEndDate: string,
      calendarDelta: number,
    ) {
      const originalStart = new Date(originalStartDate);
      const originalEnd = new Date(originalEndDate);

      if (side === "right") {
        const lastOccupiedDay = addDays(originalEnd, -1);
        const nextInclusiveEnd = addDays(lastOccupiedDay, calendarDelta);
        const candidateLength = countWorkingDays(
          originalStart,
          addDays(nextInclusiveEnd, 1),
          holidayMap,
        );
        const nextLength = Math.max(1, candidateLength);
        const nextEnd = addWorkingDaysInclusive(
          originalStart,
          nextLength,
          holidayMap,
        );

        return {
          assignmentId,
          startDate: originalStart.toISOString(),
          endDate: nextEnd.toISOString(),
        };
      }

      let nextStart = snapToWorkingDay(
        addDays(originalStart, calendarDelta),
        1,
        holidayMap,
      );
      let nextLength = countWorkingDays(nextStart, originalEnd, holidayMap);

      if (nextLength < 1) {
        nextStart = moveByWorkingDays(originalEnd, -1, holidayMap);
        nextLength = 1;
      }

      const nextEnd = addWorkingDaysInclusive(nextStart, nextLength, holidayMap);

      return {
        assignmentId,
        startDate: nextStart.toISOString(),
        endDate: nextEnd.toISOString(),
      };
    }

    function handleMouseMove(event: MouseEvent) {
      const calendarDelta = Math.round(
        (event.clientX - activeInteraction.originClientX) / dayWidth,
      );

      if (activeInteraction.mode === "create") {
        updateDraftAssignment(
          activeInteraction.userId,
          activeInteraction.projectId,
          activeInteraction.anchorIndex,
          activeInteraction.anchorIndex + calendarDelta,
        );
        return;
      }

      if (activeInteraction.mode === "move") {
        const moveTarget = activeInteraction.horizontalLock
          ? {
              userId: activeInteraction.originalUserId,
              laneIndex: activeInteraction.originalLaneIndex,
            }
          : resolveMoveTarget(
              event.clientY,
              activeInteraction.originalUserId,
              activeInteraction.originalLaneIndex,
            );

        setAssignmentPreviewState(
          {
            ...buildMovePreview(
              activeInteraction.assignmentId,
              activeInteraction.originalStartDate,
              activeInteraction.originalEndDate,
              calendarDelta,
            ),
            userId: moveTarget.userId,
            laneIndex: moveTarget.laneIndex,
          },
        );
        return;
      }

      setAssignmentPreviewState(
        buildResizePreview(
          activeInteraction.assignmentId,
          activeInteraction.side,
          activeInteraction.originalStartDate,
          activeInteraction.originalEndDate,
          calendarDelta,
        ),
      );
    }

    async function handleMouseUp() {
      try {
        if (activeInteraction.mode === "create") {
          const activeDraft = draftAssignmentRef.current;

          if (!activeDraft) {
            return;
          }

          const lengthDays = endExclusiveToWorkingLength(
            activeDraft.startDate,
            activeDraft.endDate,
            holidayMap,
          );

          if (activeInteraction.projectId === DRAFT_PROJECT_ID) {
            setPendingComposer({
              userId: activeDraft.userId,
              startDate: activeDraft.startDate,
              endDate: activeDraft.endDate,
              lengthDays,
              anchorRect: activeInteraction.anchorRect,
            });
          } else {
            const created = await createAssignment(
              activeDraft.userId,
              activeInteraction.projectId,
              activeDraft.startDate,
              lengthDays,
            );

            setAssignments((previous) => [created, ...previous]);
            setActivityRefreshKey((value) => value + 1);
            clearInlinePlacementState();
          }

          return;
        }

        const activePreview = assignmentPreviewRef.current;

        if (!activePreview) {
          return;
        }

        const previewUserId =
          activeInteraction.mode === "move"
            ? activePreview.userId ?? activeInteraction.originalUserId
            : undefined;
        const previewLaneIndex =
          activeInteraction.mode === "move"
            ? activePreview.laneIndex ?? activeInteraction.originalLaneIndex
            : undefined;
        const sameMoveTarget =
          activeInteraction.mode !== "move" ||
          (previewUserId === activeInteraction.originalUserId &&
            previewLaneIndex === activeInteraction.originalLaneIndex);

        if (activeInteraction.mode === "move" && activeInteraction.duplicate) {
          const created = await createAssignment(
            previewUserId ?? activeInteraction.originalUserId,
            activeInteraction.projectId,
            activePreview.startDate,
            endExclusiveToWorkingLength(
              activePreview.startDate,
              activePreview.endDate,
              holidayMap,
            ),
            {
              laneIndex: previewLaneIndex,
            },
          );

          setAssignments((previous) => [created, ...previous]);
          setActivityRefreshKey((value) => value + 1);
          setToast({
            id: Date.now(),
            message:
              previewUserId &&
              previewUserId !== activeInteraction.originalUserId
                ? `Duplicated to ${
                    users.find((user) => user.id === previewUserId)?.displayName ??
                    "new person"
                  }`
                : "Duplicated assignment",
          });
          return;
        }

        if (
          activePreview.startDate === activeInteraction.originalStartDate &&
          activePreview.endDate === activeInteraction.originalEndDate &&
          sameMoveTarget
        ) {
          return;
        }

        const updated = await updateAssignment(activeInteraction.assignmentId, {
          startDate: activePreview.startDate,
          lengthDays: endExclusiveToWorkingLength(
            activePreview.startDate,
            activePreview.endDate,
            holidayMap,
          ),
          ...(activeInteraction.mode === "move"
            ? {
                userId: previewUserId,
                laneIndex: previewLaneIndex,
              }
            : {}),
        });

        setAssignments((previous) =>
          previous.map((assignment) =>
            assignment.id === activeInteraction.assignmentId ? updated : assignment,
          ),
        );
        setActivityRefreshKey((value) => value + 1);
        const toastMessage =
          activeInteraction.mode === "move" &&
          previewUserId &&
          previewUserId !== activeInteraction.originalUserId
            ? `Moved to ${
                users.find((user) => user.id === previewUserId)?.displayName ??
                "new person"
              }`
            : "Updated assignment";
        setToast({
          id: Date.now(),
          message: toastMessage,
        });
      } catch (error: any) {
        window.alert(error?.message ?? "Failed to update assignment");
      } finally {
        setInteraction(null);
        setAssignmentPreviewState(null);
      }
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dayWidth, holidayMap, interaction, users]);

  function handleTimelineScroll(event: React.UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    setScrollTop(element.scrollTop);
    setViewportHeight(element.clientHeight);
    setTimelineViewportWidth(element.clientWidth);

    if (ignoreProgrammaticScrollRef.current) {
      ignoreProgrammaticScrollRef.current = false;
      return;
    }

    if (rangeShiftLockRef.current) {
      return;
    }

    const threshold = TIMELINE_EDGE_BUFFER_DAYS * dayWidth;
    const maxScrollLeft = element.scrollWidth - element.clientWidth;

    if (element.scrollLeft < threshold) {
      rangeShiftLockRef.current = true;
      pendingScrollAdjustRef.current = TIMELINE_SHIFT_DAYS * dayWidth;
      setTimelineStart((previous) => addDays(previous, -TIMELINE_SHIFT_DAYS));
      return;
    }

    if (maxScrollLeft - element.scrollLeft < threshold) {
      rangeShiftLockRef.current = true;
      pendingScrollAdjustRef.current = -TIMELINE_SHIFT_DAYS * dayWidth;
      setTimelineStart((previous) => addDays(previous, TIMELINE_SHIFT_DAYS));
    }
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.08),transparent_28%),linear-gradient(to_bottom,#f8fafc,#eef2ff_35%,#f8fafc)] text-slate-900 dark:bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.08),transparent_28%),linear-gradient(to_bottom,#09090b,#111827_38%,#09090b)] dark:text-zinc-100">
      <TopBar
        me={me}
        theme={theme}
        onToggleTheme={toggleTheme}
        onNewProject={() => setShowNewProject(true)}
        onToggleProjects={() => setProjectRailOpen((previous) => !previous)}
        projectsOpen={projectRailOpen}
        onLogout={onLogout}
      />

      <div className="flex-1 overflow-hidden px-4 py-4 lg:px-5">
        <div className="flex h-full flex-col gap-4">
          {(projectsError || usersError || assignmentsError) && (
            <div className="shrink-0 rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
              {projectsError ? <div>Projects: {projectsError}</div> : null}
              {usersError ? <div>Users: {usersError}</div> : null}
              {assignmentsError ? <div>Assignments: {assignmentsError}</div> : null}
            </div>
          )}

          <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[248px_minmax(0,1fr)]">
            <aside className="flex min-h-0 flex-col gap-3">
              <div className="rounded-[28px] border border-slate-200/80 bg-white/90 p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/95">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search people or teams..."
                  className="w-full rounded-2xl bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:bg-zinc-900 dark:ring-zinc-800 dark:focus:ring-sky-800"
                />
              </div>

              <div className="flex min-h-0 flex-1 flex-col rounded-[28px] border border-slate-200/80 bg-white/90 p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/95">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-zinc-500">
                    Teams
                  </div>
                  <div className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800">
                    {selectedTeam?.name ?? "All teams"}
                  </div>
                </div>

                <div className="min-h-0 overflow-y-auto pr-1">
                  {filteredTeams.length > 0 ? (
                    <TeamsPanel
                      teams={filteredTeams}
                      selectedTeamId={selectedTeamId}
                      onSelectTeam={setSelectedTeamId}
                    />
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500 dark:border-zinc-800 dark:text-zinc-400">
                      No matching teams.
                    </div>
                  )}
                </div>
              </div>
            </aside>

            <section className="min-w-0 flex min-h-0 flex-col overflow-hidden rounded-[30px] border border-slate-200/80 bg-white shadow-[0_24px_56px_-34px_rgba(15,23,42,0.24)] dark:border-zinc-800/55 dark:bg-zinc-950 dark:shadow-[0_24px_56px_-34px_rgba(0,0,0,0.62)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 bg-white/92 px-4 py-3 backdrop-blur-md dark:border-zinc-800/60 dark:bg-zinc-950">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-full bg-slate-100/90 px-3 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200/80 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-800">
                    {selectedTeam?.name ?? "All teams"}
                  </div>
                  <div className="rounded-full bg-slate-100/90 px-3 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200/80 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-800">
                    {filteredUsers.length} people
                  </div>
                  <div className="rounded-full bg-slate-100/90 px-3 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200/80 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-800">
                    {projects.length} projects
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  {activeMoveStatusText ? (
                    <div className="rounded-2xl bg-sky-50/88 px-3 py-2 text-[11px] font-semibold text-sky-700 ring-1 ring-sky-200/80 shadow-[0_10px_24px_-22px_rgba(14,165,233,0.36)] dark:bg-sky-950/36 dark:text-sky-200 dark:ring-sky-800/70">
                      {activeMoveStatusText}
                    </div>
                  ) : null}

                  <div className="inline-flex rounded-2xl bg-slate-100/90 p-1 ring-1 ring-slate-200/80 backdrop-blur-sm dark:bg-zinc-900 dark:ring-zinc-800">
                    {(Object.entries(TIMELINE_ZOOM_OPTIONS) as Array<
                      [TimelineZoomMode, (typeof TIMELINE_ZOOM_OPTIONS)[TimelineZoomMode]]
                    >).map(([mode, option]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setZoomMode(mode)}
                        className={[
                          "rounded-xl px-2.5 py-1.5 text-[11px] font-medium transition",
                          zoomMode === mode
                            ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100 dark:shadow-none"
                            : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200",
                        ].join(" ")}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <div className="inline-flex rounded-2xl bg-slate-100/90 p-1 ring-1 ring-slate-200/80 backdrop-blur-sm dark:bg-zinc-900 dark:ring-zinc-800">
                    {(Object.entries(TIMELINE_DENSITY_OPTIONS) as Array<
                      [
                        TimelineDensityMode,
                        (typeof TIMELINE_DENSITY_OPTIONS)[TimelineDensityMode],
                      ]
                    >).map(([mode, option]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setDensityMode(mode)}
                        className={[
                          "rounded-xl px-2.5 py-1.5 text-[11px] font-medium transition",
                          densityMode === mode
                            ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100 dark:shadow-none"
                            : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200",
                        ].join(" ")}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!scrollRef.current) {
                        return;
                      }

                      setTimelineStart(
                        addDays(startOfMonday(new Date()), -TIMELINE_SHIFT_DAYS),
                      );

                      requestAnimationFrame(() => {
                        if (scrollRef.current) {
                          ignoreProgrammaticScrollRef.current = true;
                          scrollRef.current.scrollLeft =
                            TIMELINE_SHIFT_DAYS * dayWidth;
                        }
                      });
                    }}
                    className="rounded-2xl bg-white/90 px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200/80 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.18)] backdrop-blur-sm transition hover:bg-white dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-800 dark:hover:bg-zinc-800"
                  >
                    Jump to today
                  </button>
                </div>
              </div>

              <div
                ref={scrollRef}
                onScroll={handleTimelineScroll}
                className="flex-1 overflow-auto overscroll-contain rounded-b-[30px] bg-white dark:bg-zinc-950"
              >
                <div
                  style={{
                    minWidth: leftWidth + days.length * dayWidth,
                  }}
                >
                  <TimelineHeader
                    days={days}
                    dayWidth={dayWidth}
                    leftWidth={leftWidth}
                    isHoliday={(date) => isHoliday(date, holidayMap)}
                    todayIndex={todayIndex}
                  />

                  {loadingUsers || loadingProjects || loadingAssignments ? (
                    <div className="px-4 py-6 text-sm text-slate-500 dark:text-zinc-400">
                      Loading planning data...
                    </div>
                  ) : null}

                  {!loadingUsers && filteredUsers.length === 0 ? (
                    <div className="px-4 py-8 text-sm text-slate-500 dark:text-zinc-400">
                      No matching people for the current filters.
                    </div>
                  ) : null}

                  <div
                    ref={rowsContainerRef}
                    className="relative"
                    style={{ height: totalRowsHeight + bottomResizePadding }}
                  >
                    {visibleRows.map((row, index) => (
                      <div
                        key={row.user.id}
                        className="absolute left-0 right-0"
                        style={{ top: row.top }}
                      >
                        <UserRowLine
                          u={row.user}
                          rowIndex={visibleRowRange.start + index}
                          rowHeight={row.height}
                          days={days}
                          dayWidth={dayWidth}
                          leftWidth={leftWidth}
                          laneHeight={densityConfig.laneHeight}
                          rowPaddingY={densityConfig.rowPaddingY}
                          barHeight={densityConfig.barHeight}
                          densityMode={densityMode}
                          targetLaneIndex={
                            activeMoveTargetUserId === row.user.id
                              ? activeMoveTargetLaneIndex
                              : null
                          }
                          layout={row.layout}
                          projectsById={projectsById}
                          draftAssignmentId={draftAssignment?.id ?? null}
                          todayIndex={todayIndex}
                          onCellPointerDown={handleCellPointerDown}
                          onResizeStart={handleResizeStart}
                          onMoveStart={handleMoveStart}
                          onSelectAssignment={setSelectedAssignmentId}
                          onDelete={handleDelete}
                          onDuplicate={handleDuplicate}
                          onOpenProject={setDrawerProjectId}
                          isHoliday={(date) => isHoliday(date, holidayMap)}
                          activeMoveAssignmentId={activeMoveAssignmentId}
                          duplicatePreviewAssignmentId={
                            duplicatePreviewAssignment?.id ?? null
                          }
                          selectedAssignmentId={selectedAssignmentId}
                          ghostAssignment={
                            moveGhostAssignment?.userId === row.user.id
                              ? {
                                  assignmentId: moveGhostAssignment.assignmentId,
                                  projectId: moveGhostAssignment.projectId,
                                  startDate: moveGhostAssignment.startDate,
                                  endDate: moveGhostAssignment.endDate,
                                  laneIndex: moveGhostAssignment.laneIndex,
                                }
                              : null
                          }
                          isMoveTarget={activeMoveTargetUserId === row.user.id}
                        />
                      </div>
                    ))}

                    {visibleRows.map((row, index) => {
                      const isActive = rowResize?.userId === row.user.id;

                      return (
                        <button
                          key={`${row.user.id}-resize-handle`}
                          type="button"
                          onMouseDown={(event) => {
                            if (event.button !== 0) {
                              return;
                            }

                            event.preventDefault();
                            event.stopPropagation();
                            handleRowResizeStart(
                              row.user.id,
                              row.autoHeight,
                              row.height,
                              event.clientY,
                            );
                          }}
                          className="group absolute left-0 right-0 z-20 cursor-ns-resize"
                          style={{
                            top: row.top + row.height - 4,
                            height: 8,
                          }}
                          aria-label={`Resize ${row.user.displayName} row height`}
                        >
                          <div
                            className={[
                              "pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 transition-all duration-150",
                              isActive
                                ? "bg-sky-400/70 shadow-[0_0_0_1px_rgba(56,189,248,0.12)] dark:bg-sky-400/75"
                                : "bg-slate-300/0 group-hover:bg-slate-300/85 dark:bg-zinc-700/0 dark:group-hover:bg-zinc-700/90",
                            ].join(" ")}
                          />
                          <div
                            className={[
                              "pointer-events-none absolute left-1/2 top-1/2 h-3 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border transition-all duration-150",
                              isActive
                                ? "border-sky-300/75 bg-sky-100/80 shadow-sm dark:border-sky-700/70 dark:bg-sky-950/75"
                                : "border-slate-200/0 bg-white/0 group-hover:border-slate-200/90 group-hover:bg-white/92 dark:border-zinc-700/0 dark:bg-zinc-950/0 dark:group-hover:border-zinc-700/85 dark:group-hover:bg-zinc-950/92",
                            ].join(" ")}
                            aria-hidden="true"
                          >
                            <div className="absolute inset-x-3 top-1/2 h-px -translate-y-[3px] bg-current opacity-35" />
                            <div className="absolute inset-x-3 top-1/2 h-px translate-y-[3px] bg-current opacity-35" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        {projectRailOpen ? (
          <>
            <button
              type="button"
              aria-label="Close project rail"
              onClick={() => setProjectRailOpen(false)}
              className="fixed inset-0 z-30 bg-slate-950/25 backdrop-blur-[1px]"
            />

            <aside className="fixed bottom-4 left-4 top-20 z-40 flex w-[min(360px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[30px] border border-slate-200/80 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200/70 px-4 py-4 dark:border-zinc-800">
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                    Projects
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                    {filteredProjects.length} items available
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setProjectRailOpen(false)}
                  className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-200 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800 dark:hover:bg-zinc-800"
                >
                  Close
                </button>
              </div>

              <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-4">
                <input
                  value={projectSearch}
                  onChange={(event) => setProjectSearch(event.target.value)}
                  placeholder="Search projects..."
                  className="w-full rounded-2xl bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:bg-zinc-900 dark:ring-zinc-800 dark:focus:ring-sky-800"
                />

                <div className="mt-4">
                  <SidebarProjects
                    projects={filteredProjects}
                    selectedProjectId={selectedProjectId}
                    onSelect={(projectId) => {
                      setSelectedProjectId(projectId);
                      setPlacementProjectId(projectId);
                      setDrawerProjectId(projectId);
                      setProjectRailOpen(false);
                    }}
                  />
                </div>

                <AssignPanel
                  selectedProject={selectedProject}
                  users={filteredUsers.length > 0 ? filteredUsers : users}
                  onAssign={handleAssignFromPanel}
                />
                <ProjectSettingsPanel
                  selectedProject={selectedProject}
                  onSave={handleSaveProject}
                  onDelete={handleDeleteProject}
                />
              </div>
            </aside>
          </>
        ) : null}

        {pendingComposer ? (
          <AssignmentComposerPopover
            pending={pendingComposer}
            projects={projects}
            recentProjects={recentComposerProjects}
            onClose={clearInlinePlacementState}
            onChooseProject={async (projectId) => {
              await persistAssignmentDraft(projectId);
            }}
            onCreateProject={async (name, colorKey) => {
              const createdProject = await createProject(name, colorKey, me.id, {
                department: getProjectDepartmentFromColorKey(colorKey) ?? "OTHER",
              });
              setProjects((previous) => [createdProject, ...previous]);
              await persistAssignmentDraft(createdProject.id);
            }}
          />
        ) : null}

        <ProjectDrawer
          open={!!drawerProject}
          project={drawerProject}
          assignments={drawerAssignments}
          users={users}
          me={me}
          activityRefreshKey={activityRefreshKey}
          onClose={() => setDrawerProjectId(null)}
          onSaveMetadata={handleSaveProjectMetadata}
          colorOptions={COLOR_OPTIONS}
        />

        {toast ? (
          <div className="pointer-events-none fixed bottom-5 right-5 z-50">
            <div className="rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-3 text-sm font-medium text-slate-700 shadow-xl backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 dark:text-zinc-200">
              {toast.message}
            </div>
          </div>
        ) : null}

        <NewProjectModal
          open={showNewProject}
          onClose={() => setShowNewProject(false)}
          onCreate={async (name, colorKey) => {
            const project = await createProject(name, colorKey, me.id, {
              department: getProjectDepartmentFromColorKey(colorKey) ?? "OTHER",
            });
            setProjects((previous) => [project, ...previous]);
            setSelectedProjectId(project.id);
            setPlacementProjectId(project.id);
            setDrawerProjectId(project.id);
          }}
        />
      </div>
    </div>
  );
}
