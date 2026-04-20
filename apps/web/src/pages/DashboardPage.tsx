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
  DAY_WIDTH,
  DEPARTMENT_COLOR_OPTIONS,
  LEFT_COLUMN_WIDTH,
  LEAVE_COLOR_OPTIONS,
  ROW_OVERSCAN,
  TIMELINE_EDGE_BUFFER_DAYS,
  TIMELINE_SHIFT_DAYS,
  TIMELINE_WINDOW_DAYS,
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
  getWorkingRangeFromDrag,
  isHoliday,
  isLeaveColorKey,
  isoDateOnlyLocal,
  makeDays,
  moveByWorkingDays,
  normalizeColorKey,
  snapToWorkingDay,
  startOfMonday,
  type LeaveType,
  type TimelineEntryType,
  type TimelineAssignmentLike,
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
      originClientX: number;
      originalStartDate: string;
      originalEndDate: string;
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
  onChooseProject,
  onCreateProject,
  onClose,
}: {
  pending: PendingComposer;
  projects: Project[];
  onChooseProject: (projectId: string) => Promise<void>;
  onCreateProject: (name: string, colorKey: string) => Promise<void>;
  onClose: () => void;
}) {
  const [entryType, setEntryType] = useState<TimelineEntryType>("PROJECT");
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newColorKey, setNewColorKey] = useState("haematology");
  const [leaveType, setLeaveType] = useState<LeaveType>("HOLIDAY");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const panelLayout = getFloatingPanelLayout(pending.anchorRect, 440);
  const leaveColorKey = getColorKeyForLeaveType(leaveType);
  const leaveLabel = getDefaultLabelForLeaveType(leaveType);

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();

    return projects
      .filter((project) => !isLeaveColorKey(project.colorKey))
      .filter((project) =>
        !query ? true : project.name.toLowerCase().includes(query),
      )
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [projects, search]);

  function handleEntryTypeChange(nextType: TimelineEntryType) {
    setEntryType(nextType);
    setErr(null);

    if (nextType === "LEAVE" && !newName.trim()) {
      setNewName(leaveLabel);
    }
  }

  function handleLeaveTypeChange(nextLeaveType: LeaveType) {
    const currentDefault = getDefaultLabelForLeaveType(leaveType);
    const nextDefault = getDefaultLabelForLeaveType(nextLeaveType);

    if (!newName.trim() || newName.trim() === currentDefault) {
      setNewName(nextDefault);
    }

    setLeaveType(nextLeaveType);
    setErr(null);
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
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search existing projects..."
                className="mb-3 w-full rounded-2xl bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:bg-zinc-900 dark:ring-zinc-800 dark:focus:ring-sky-800"
              />

              <div className="max-h-60 space-y-2 overflow-y-auto overscroll-contain pr-1">
                {filteredProjects.map((project) => {
                  const visual = getColorOption(project.colorKey);

                  return (
                    <button
                      key={project.id}
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        try {
                          setBusy(true);
                          setErr(null);
                          await onChooseProject(project.id);
                        } catch (error: any) {
                          setErr(
                            error?.message ?? "Failed to create assignment",
                          );
                          setBusy(false);
                        }
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-3 py-3 text-left transition hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
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
                          {project.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-zinc-400">
                          {visual.label}
                        </div>
                      </div>
                    </button>
                  );
                })}

                {filteredProjects.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-3 text-sm text-slate-500 dark:border-zinc-800 dark:text-zinc-400">
                    No existing project matches this search.
                  </div>
                ) : null}
              </div>

              <div className="mt-4 rounded-3xl bg-slate-50 p-3 ring-1 ring-slate-200/80 dark:bg-zinc-900/60 dark:ring-zinc-800">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
                  Create a new project
                </div>

                <input
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="New project name"
                  className="mt-3 w-full rounded-2xl bg-white px-3 py-2.5 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:bg-zinc-950 dark:ring-zinc-800 dark:focus:ring-sky-800"
                />

                <div className="mt-3 grid grid-cols-2 gap-2">
                  {DEPARTMENT_COLOR_OPTIONS.slice(0, 6).map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setNewColorKey(option.key)}
                      className={[
                        "flex items-center gap-2 rounded-2xl border px-3 py-2 text-left transition",
                        newColorKey === option.key
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

                <button
                  type="button"
                  disabled={busy || newName.trim().length < 2}
                  onClick={async () => {
                    try {
                      setBusy(true);
                      setErr(null);
                      await onCreateProject(newName.trim(), newColorKey);
                    } catch (error: any) {
                      setErr(error?.message ?? "Failed to create project");
                      setBusy(false);
                    }
                  }}
                  className="mt-3 w-full rounded-2xl bg-sky-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
                >
                  {busy ? "Saving..." : "Create project + assign"}
                </button>
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
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
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

                    const label = newName.trim() || leaveLabel;
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

export function DashboardPage({ me }: { me: Me }) {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());
  const [showNewProject, setShowNewProject] = useState(false);
  const [projectRailOpen, setProjectRailOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");

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

  const [timelineStart, setTimelineStart] = useState(() =>
    addDays(startOfMonday(new Date()), -TIMELINE_SHIFT_DAYS),
  );

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const initialScrollAppliedRef = useRef(false);
  const pendingScrollAdjustRef = useRef<number | null>(null);
  const rangeShiftLockRef = useRef(false);
  const stableLaneMapCacheRef = useRef<
    Record<string, Record<string, number>>
  >({});
  const draftAssignmentRef = useRef<DraftAssignment | null>(null);
  const assignmentPreviewRef = useRef<AssignmentPreview | null>(null);

  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(720);

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

    scrollRef.current.scrollLeft = TIMELINE_SHIFT_DAYS * DAY_WIDTH;
    setViewportHeight(scrollRef.current.clientHeight);
    initialScrollAppliedRef.current = true;
  }, []);

  useEffect(() => {
    if (!scrollRef.current || pendingScrollAdjustRef.current === null) {
      return;
    }

    scrollRef.current.scrollLeft += pendingScrollAdjustRef.current;
    pendingScrollAdjustRef.current = null;
    rangeShiftLockRef.current = false;
  }, [days]);

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

  const previewedAssignments = useMemo(() => {
    const nextAssignments = assignments.map((assignment) =>
      assignmentPreview && assignment.id === assignmentPreview.assignmentId
        ? {
            ...assignment,
            startDate: assignmentPreview.startDate,
            endDate: assignmentPreview.endDate,
          }
        : assignment,
    ) as TimelineAssignmentLike[];

    if (draftAssignment) {
      nextAssignments.unshift(draftAssignment);
    }

    return nextAssignments;
  }, [assignmentPreview, assignments, draftAssignment]);

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

  const stableLaneMapByUser = useMemo(() => {
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
    stableLaneMapCacheRef.current = stableLaneMapByUser;
  }, [stableLaneMapByUser]);

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
          preferredLaneByAssignmentId: stableLaneMapByUser[user.id],
          lockedAssignmentId,
          freezePreferredLanes,
        },
      );
      const row = {
        user,
        layout,
        top,
        height: layout.rowHeight,
      };
      top += layout.rowHeight;
      return row;
    });
  }, [
    assignmentsByUser,
    days,
    filteredUsers,
    freezePreferredLanes,
    lockedAssignmentId,
    projectsById,
    stableLaneMapByUser,
  ]);

  const totalRowsHeight =
    rowMetrics.length > 0
      ? rowMetrics[rowMetrics.length - 1].top +
        rowMetrics[rowMetrics.length - 1].height
      : 0;

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
    setPendingComposer(null);
    setAssignmentPreviewState(null);
    setInteraction({
      mode: "create",
      userId,
      anchorIndex: dayIndex,
      originClientX: anchorRect.left + DAY_WIDTH / 2,
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

  function handleMoveStart(assignmentId: string, originClientX: number) {
    const assignment = assignments.find((item) => item.id === assignmentId);

    if (!assignment) {
      return;
    }

    setAssignmentPreviewState(null);
    setInteraction({
      mode: "move",
      assignmentId,
      originClientX,
      originalStartDate: assignment.startDate,
      originalEndDate: assignment.endDate,
      projectId: assignment.projectId,
    });
  }

  async function handleDelete(assignmentId: string) {
    try {
      await deleteAssignment(assignmentId);
      setAssignments((previous) =>
        previous.filter((assignment) => assignment.id !== assignmentId),
      );
      setActivityRefreshKey((value) => value + 1);
    } catch (error: any) {
      window.alert(error?.message ?? "Failed to delete assignment");
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
        (event.clientX - activeInteraction.originClientX) / DAY_WIDTH,
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
        setAssignmentPreviewState(
          buildMovePreview(
            activeInteraction.assignmentId,
            activeInteraction.originalStartDate,
            activeInteraction.originalEndDate,
            calendarDelta,
          ),
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
          setDrawerProjectId(activeInteraction.projectId);
          return;
        }

        if (
          activePreview.startDate === activeInteraction.originalStartDate &&
          activePreview.endDate === activeInteraction.originalEndDate
        ) {
          setDrawerProjectId(activeInteraction.projectId);
          return;
        }

        const updated = await updateAssignment(activeInteraction.assignmentId, {
          startDate: activePreview.startDate,
          lengthDays: endExclusiveToWorkingLength(
            activePreview.startDate,
            activePreview.endDate,
            holidayMap,
          ),
        });

        setAssignments((previous) =>
          previous.map((assignment) =>
            assignment.id === activeInteraction.assignmentId ? updated : assignment,
          ),
        );
        setActivityRefreshKey((value) => value + 1);
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
  }, [holidayMap, interaction, days]);

  function handleTimelineScroll(event: React.UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    setScrollTop(element.scrollTop);
    setViewportHeight(element.clientHeight);

    if (rangeShiftLockRef.current) {
      return;
    }

    const threshold = TIMELINE_EDGE_BUFFER_DAYS * DAY_WIDTH;
    const maxScrollLeft = element.scrollWidth - element.clientWidth;

    if (element.scrollLeft < threshold) {
      rangeShiftLockRef.current = true;
      pendingScrollAdjustRef.current = TIMELINE_SHIFT_DAYS * DAY_WIDTH;
      setTimelineStart((previous) => addDays(previous, -TIMELINE_SHIFT_DAYS));
      return;
    }

    if (maxScrollLeft - element.scrollLeft < threshold) {
      rangeShiftLockRef.current = true;
      pendingScrollAdjustRef.current = -TIMELINE_SHIFT_DAYS * DAY_WIDTH;
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

            <section className="min-w-0 flex min-h-0 flex-col overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/90 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/95">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 px-4 py-3 dark:border-zinc-800">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800">
                    {selectedTeam?.name ?? "All teams"}
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800">
                    {filteredUsers.length} people
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800">
                    {projects.length} projects
                  </div>
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
                        scrollRef.current.scrollLeft =
                          TIMELINE_SHIFT_DAYS * DAY_WIDTH;
                      }
                    });
                  }}
                  className="rounded-2xl bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 shadow-sm transition hover:bg-slate-50 dark:bg-zinc-950 dark:text-zinc-300 dark:ring-zinc-800 dark:hover:bg-zinc-900"
                >
                  Jump to today
                </button>
              </div>

              <div
                ref={scrollRef}
                onScroll={handleTimelineScroll}
                className="flex-1 overflow-auto overscroll-contain rounded-b-[30px]"
              >
                <div
                  style={{
                    minWidth: LEFT_COLUMN_WIDTH + days.length * DAY_WIDTH,
                  }}
                >
                  <TimelineHeader
                    days={days}
                    dayWidth={DAY_WIDTH}
                    leftWidth={LEFT_COLUMN_WIDTH}
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

                  <div className="relative" style={{ height: totalRowsHeight }}>
                    {visibleRows.map((row) => (
                      <div
                        key={row.user.id}
                        className="absolute left-0 right-0"
                        style={{ top: row.top }}
                      >
                        <UserRowLine
                          u={row.user}
                          days={days}
                          dayWidth={DAY_WIDTH}
                          leftWidth={LEFT_COLUMN_WIDTH}
                          layout={row.layout}
                          projectsById={projectsById}
                          draftAssignmentId={draftAssignment?.id ?? null}
                          todayIndex={todayIndex}
                          onCellPointerDown={handleCellPointerDown}
                          onResizeStart={handleResizeStart}
                          onMoveStart={handleMoveStart}
                          onDelete={handleDelete}
                          onOpenProject={setDrawerProjectId}
                          isHoliday={(date) => isHoliday(date, holidayMap)}
                        />
                      </div>
                    ))}
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
