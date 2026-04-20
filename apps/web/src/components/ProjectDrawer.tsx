import { useEffect, useMemo, useState } from "react";
import {
  createProjectComment,
  deleteProjectComment,
  getCommentReactions,
  getProjectComments,
  toggleCommentReaction,
  updateProjectComment,
} from "../api";
import type {
  AssignmentRow,
  CommentReaction,
  Project,
  ProjectComment,
  ProjectDepartment,
  ProjectStatus,
  ReactionType,
  UserRow,
} from "../api";
import {
  LEAVE_COLOR_OPTIONS,
  getColorOption,
  getLeaveTypeFromColorKey,
  getTimelineEntryType,
  type LeaveType,
  type PlanningColorOption,
} from "../planning";

function formatDate(d: Date) {
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";

  const d = new Date(value);

  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDateInputValue(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function labelForColor(
  colorKey: string,
  colorOptions: readonly PlanningColorOption[],
) {
  return (
    colorOptions.find((c) => c.key === colorKey)?.label ??
    getColorOption(colorKey).label
  );
}

function labelForStatus(status: Project["status"] | undefined) {
  switch (status) {
    case "PLANNED":
      return "Planned";
    case "ACTIVE":
      return "Active";
    case "ON_HOLD":
      return "On hold";
    case "DONE":
      return "Done";
    case "ARCHIVED":
      return "Archived";
    default:
      return "—";
  }
}

function statusBadgeClass(status: Project["status"] | undefined) {
  switch (status) {
    case "PLANNED":
      return "bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800";
    case "ACTIVE":
      return "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/50";
    case "ON_HOLD":
      return "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/50";
    case "DONE":
      return "bg-green-50 text-green-700 ring-green-200 dark:bg-green-950/40 dark:text-green-300 dark:ring-green-900/50";
    case "ARCHIVED":
      return "bg-zinc-100 text-zinc-500 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800";
    default:
      return "bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800";
  }
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <div className="text-xs text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">
        {value?.trim() ? value : "—"}
      </div>
    </div>
  );
}

function QuickChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800 dark:hover:bg-zinc-800"
    >
      {label}
    </button>
  );
}

function emojiForReaction(type: ReactionType) {
  switch (type) {
    case "LIKE":
      return "👍";
    case "HEART":
      return "❤️";
    case "CLAP":
      return "👏";
    case "WOW":
      return "😮";
    case "CHECK":
      return "✅";
    default:
      return "•";
  }
}
function getSystemEventType(comment: ProjectComment) {
  if (comment.kind !== "SYSTEM") return "COMMENT";

  const event = comment.meta?.event;

  switch (event) {
    case "status_changed":
      return "STATUS";
    case "due_date_changed":
      return "DUE_DATE";
    case "project_manager_changed":
      return "PROJECT_MANAGER";
    case "assignment_added":
    case "assignment_updated":
    case "assignment_removed":
      return "ASSIGNMENT";
    default:
      return "SYSTEM";
  }
}

function getEventIcon(comment: ProjectComment) {
  const type = getSystemEventType(comment);

  switch (type) {
    case "COMMENT":
      return "💬";
    case "STATUS":
      return "🔄";
    case "DUE_DATE":
      return "📅";
    case "PROJECT_MANAGER":
      return "👤";
    case "ASSIGNMENT":
      return "🗓️";
    case "SYSTEM":
    default:
      return "⚙️";
  }
}

function getEventCardClass(comment: ProjectComment) {
  const type = getSystemEventType(comment);

  switch (type) {
    case "STATUS":
      return "bg-blue-50 ring-blue-200 dark:bg-blue-950/20 dark:ring-blue-900/40";
    case "DUE_DATE":
      return "bg-violet-50 ring-violet-200 dark:bg-violet-950/20 dark:ring-violet-900/40";
    case "PROJECT_MANAGER":
      return "bg-cyan-50 ring-cyan-200 dark:bg-cyan-950/20 dark:ring-cyan-900/40";
    case "ASSIGNMENT":
      return "bg-emerald-50 ring-emerald-200 dark:bg-emerald-950/20 dark:ring-emerald-900/40";
    case "SYSTEM":
      return "bg-amber-50 ring-amber-200 dark:bg-amber-950/20 dark:ring-amber-900/40";
    case "COMMENT":
    default:
      return "bg-zinc-50 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800";
  }
}

function getEventTitle(comment: ProjectComment) {
  const type = getSystemEventType(comment);

  switch (type) {
    case "COMMENT":
      return comment.author.displayName;
    case "STATUS":
      return "Status changed";
    case "DUE_DATE":
      return "Due date updated";
    case "PROJECT_MANAGER":
      return "Project manager changed";
    case "ASSIGNMENT":
      return "Assignment updated";
    case "SYSTEM":
    default:
      return "System event";
  }
}

function getEventTitleClass(comment: ProjectComment) {
  const type = getSystemEventType(comment);

  switch (type) {
    case "STATUS":
      return "text-blue-800 dark:text-blue-300";
    case "DUE_DATE":
      return "text-violet-800 dark:text-violet-300";
    case "PROJECT_MANAGER":
      return "text-cyan-800 dark:text-cyan-300";
    case "ASSIGNMENT":
      return "text-emerald-800 dark:text-emerald-300";
    case "SYSTEM":
      return "text-amber-800 dark:text-amber-300";
    case "COMMENT":
    default:
      return "text-zinc-900 dark:text-zinc-100";
  }
}

function getEventBodyClass(comment: ProjectComment) {
  const type = getSystemEventType(comment);

  switch (type) {
    case "STATUS":
      return "text-blue-900 dark:text-blue-200";
    case "DUE_DATE":
      return "text-violet-900 dark:text-violet-200";
    case "PROJECT_MANAGER":
      return "text-cyan-900 dark:text-cyan-200";
    case "ASSIGNMENT":
      return "text-emerald-900 dark:text-emerald-200";
    case "SYSTEM":
      return "text-amber-900 dark:text-amber-200";
    case "COMMENT":
    default:
      return "text-zinc-700 dark:text-zinc-300";
  }
}

function formatDayHeader(date: string | Date) {
  const d = new Date(date);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const check = new Date(d);
  check.setHours(0, 0, 0, 0);

  if (check.getTime() === today.getTime()) return "Today";
  if (check.getTime() === yesterday.getTime()) return "Yesterday";

  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function groupCommentsByDay(comments: ProjectComment[]) {
  const groups: Record<string, ProjectComment[]> = {};

  for (const comment of comments) {
    const key = new Date(comment.createdAt).toDateString();

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(comment);
  }

  return Object.entries(groups).map(([key, items]) => ({
    dayLabel: formatDayHeader(new Date(key)),
    items,
  }));
}

function looksLikeImage(url: string) {
  return /\.(png|jpe?g|webp|gif|svg)$/i.test(url);
}

type ActivityFilter = "ALL" | "COMMENTS" | "SYSTEM" | "ASSIGNMENTS";

function filterComments(comments: ProjectComment[], filter: ActivityFilter) {
  if (filter === "ALL") return comments;

  if (filter === "COMMENTS") {
    return comments.filter((c) => c.kind !== "SYSTEM");
  }

  if (filter === "SYSTEM") {
    return comments.filter((c) => c.kind === "SYSTEM");
  }

  if (filter === "ASSIGNMENTS") {
    return comments.filter(
      (c) =>
        c.kind === "SYSTEM" &&
        c.meta?.event &&
        String(c.meta.event).startsWith("assignment"),
    );
  }

  return comments;
}

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "PLANNED", label: "Planned" },
  { value: "ACTIVE", label: "Active" },
  { value: "ON_HOLD", label: "On hold" },
  { value: "DONE", label: "Done" },
  { value: "ARCHIVED", label: "Archived" },
];

const DEPARTMENT_OPTIONS: { value: ProjectDepartment; label: string }[] = [
  { value: "HAEMATOLOGY", label: "Haematology" },
  { value: "HEMOSTASIS", label: "Hemostasis" },
  { value: "URINALYSIS", label: "Urinalysis" },
  { value: "FLOW_CYTOMETRY", label: "Flow Cytometry" },
  { value: "LIFE_SCIENCE", label: "Life Science" },
  { value: "POINT_OF_CARE", label: "Point of Care" },
  { value: "CARESPHERE_ACADEMY", label: "Caresphere Academy" },
  { value: "SOFTWARE", label: "Software" },
  { value: "IMMUNOLOGY", label: "Immunology" },
  { value: "CLINICAL_CHEMISTRY", label: "Clinical Chemistry" },
  { value: "OTHER", label: "Other" },
];

export function ProjectDrawer({
  open,
  project,
  assignments,
  users,
  me,
  activityRefreshKey,
  onClose,
  onSaveMetadata,
  colorOptions,
}: {
  open: boolean;
  project: Project | null;
  assignments: AssignmentRow[];
  users: UserRow[];
  me: { id: string };
  activityRefreshKey: number;
  onClose: () => void;
  onSaveMetadata: (
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
  ) => Promise<void>;
  colorOptions: readonly PlanningColorOption[];
}) {
  const [status, setStatus] = useState<ProjectStatus>("PLANNED");
  const [department, setDepartment] = useState<ProjectDepartment>("OTHER");
  const [leaveType, setLeaveType] = useState<LeaveType>("HOLIDAY");
  const [projectManagerId, setProjectManagerId] = useState("");
  const [requesterName, setRequesterName] = useState("");
  const [contactPersonName, setContactPersonName] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [comments, setComments] = useState<ProjectComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [newCommentBody, setNewCommentBody] = useState("");

  const [postingComment, setPostingComment] = useState(false);
  const [postCommentError, setPostCommentError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [reactionsByComment, setReactionsByComment] = useState<
    Record<string, CommentReaction[]>
  >({});
  const [attachmentType, setAttachmentType] = useState("LINK");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentLabel, setAttachmentLabel] = useState("");

  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("ALL");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState("");
  const [editingCommentSaving, setEditingCommentSaving] = useState(false);

  useEffect(() => {
    if (!project) return;

    setStatus(project.status ?? "PLANNED");
    setDepartment(project.department ?? "OTHER");
    setLeaveType(getLeaveTypeFromColorKey(project.colorKey) ?? "HOLIDAY");
    setProjectManagerId(project.projectManagerId ?? "");
    setRequesterName(project.requesterName ?? "");
    setContactPersonName(project.contactPersonName ?? "");
    setDescription(project.description ?? "");
    setNotes(project.notes ?? "");
    setStartDate(toDateInputValue(project.startDate));
    setDueDate(toDateInputValue(project.dueDate));
    setSaveError(null);
    setSaving(false);
  }, [project]);

  useEffect(() => {
    if (!open || !project) return;

    let alive = true;

    (async () => {
      try {
        setLoadingComments(true);
        setCommentsError(null);
        const data = await getProjectComments(project.id);
        if (alive) setComments(data);
      } catch (e: any) {
        if (alive) setCommentsError(e?.message ?? "Failed to load comments");
      } finally {
        if (alive) setLoadingComments(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [open, project, activityRefreshKey]);

  useEffect(() => {
    if (!open || comments.length === 0) {
      setReactionsByComment({});
      return;
    }

    let alive = true;

    (async () => {
      try {
        const entries = await Promise.all(
          comments.map(async (comment) => {
            const reactions = await getCommentReactions(comment.id);
            return [comment.id, reactions] as const;
          }),
        );

        if (!alive) return;

        const next: Record<string, CommentReaction[]> = {};
        for (const [commentId, reactions] of entries) {
          next[commentId] = reactions;
        }

        setReactionsByComment(next);
      } catch (e) {
        console.error("Failed to load comment reactions", e);
      }
    })();

    return () => {
      alive = false;
    };
  }, [open, comments]);

  const assignedUsers = useMemo(
    () => users.filter((u) => assignments.some((a) => a.userId === u.id)),
    [users, assignments],
  );

  const sortedAssignments = useMemo(
    () =>
      [...assignments].sort(
        (a, b) =>
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
      ),
    [assignments],
  );

  if (!open || !project) return null;

  const entryType = getTimelineEntryType(project.colorKey);
  const isLeaveEntry = entryType === "LEAVE";

  const firstStart =
    sortedAssignments.length > 0
      ? new Date(sortedAssignments[0].startDate)
      : null;

  const lastEnd =
    sortedAssignments.length > 0
      ? new Date(sortedAssignments[sortedAssignments.length - 1].endDate)
      : null;

  const displayPeriod =
    project.startDate && project.dueDate
      ? `${formatDate(new Date(project.startDate))} → ${formatDate(new Date(project.dueDate))}`
      : firstStart && lastEnd
        ? `${formatDate(firstStart)} → ${formatDate(lastEnd)}`
        : "No assignments yet";

  function getReactionCount(commentId: string, type: ReactionType) {
    return (reactionsByComment[commentId] ?? []).filter((r) => r.type === type)
      .length;
  }

  function hasReacted(commentId: string, type: ReactionType) {
    return (reactionsByComment[commentId] ?? []).some(
      (r) => r.type === type && r.userId === me.id,
    );
  }
  const filteredComments = filterComments(comments, activityFilter);
  const groupedComments = groupCommentsByDay(filteredComments);
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      <div className="relative h-full w-full max-w-[560px] bg-white shadow-2xl ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-zinc-800">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-sm font-semibold">
            {isLeaveEntry ? "Leave details" : "Project details"}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            ✕
          </button>
        </div>

        <div className="h-[calc(100vh-73px)] space-y-6 overflow-y-auto px-5 py-5">
          <div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {isLeaveEntry ? "Leave label" : "Project name"}
            </div>
            <div className="mt-1 text-base font-semibold">{project.name}</div>
          </div>

          <div className="flex flex-wrap gap-2">
            {isLeaveEntry ? (
              <div className="inline-flex rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-200 dark:ring-emerald-900/50">
                Leave
              </div>
            ) : null}

            <div
              className={[
                "inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1",
                statusBadgeClass(project.status),
              ].join(" ")}
            >
              {labelForStatus(project.status)}
            </div>

            <div className="inline-flex rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800">
              {labelForColor(project.colorKey, colorOptions)}
            </div>
          </div>

          {/* ACTIVITY FIRST */}
          <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="mb-4 ">
              <div className="mb-4 flex flex-wrap gap-2">
                {[
                  { key: "ALL", label: "All" },
                  { key: "COMMENTS", label: "Comments" },
                  { key: "SYSTEM", label: "System" },
                  { key: "ASSIGNMENTS", label: "Assignments" },
                ].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setActivityFilter(f.key as ActivityFilter)}
                    className={[
                      "rounded-full px-3 py-1 text-xs ring-1 transition",
                      activityFilter === f.key
                        ? "bg-zinc-900 text-white ring-zinc-900 dark:bg-white dark:text-zinc-900"
                        : "bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-400 dark:ring-zinc-800 dark:hover:bg-zinc-900",
                    ].join(" ")}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="text-sm font-semibold">Activity</div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Latest project updates
              </div>
            </div>

            <div className="space-y-3 rounded-2xl bg-zinc-50 p-3 ring-1 ring-zinc-200 dark:bg-zinc-900/60 dark:ring-zinc-800">
              <div>
                <div className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Quick update
                </div>

                <div className="mb-3 flex flex-wrap gap-2">
                  <QuickChip
                    label="Started"
                    onClick={() =>
                      setNewCommentBody((prev) =>
                        prev.trim()
                          ? `${prev}\nStarted work on this project.`
                          : "Started work on this project.",
                      )
                    }
                  />
                  <QuickChip
                    label="In review"
                    onClick={() =>
                      setNewCommentBody((prev) =>
                        prev.trim()
                          ? `${prev}\nWork is ready for review.`
                          : "Work is ready for review.",
                      )
                    }
                  />
                  <QuickChip
                    label="Waiting for feedback"
                    onClick={() =>
                      setNewCommentBody((prev) =>
                        prev.trim()
                          ? `${prev}\nWaiting for feedback from stakeholders.`
                          : "Waiting for feedback from stakeholders.",
                      )
                    }
                  />
                  <QuickChip
                    label="Blocked"
                    onClick={() =>
                      setNewCommentBody((prev) =>
                        prev.trim()
                          ? `${prev}\nCurrently blocked and waiting for input.`
                          : "Currently blocked and waiting for input.",
                      )
                    }
                  />
                  <QuickChip
                    label="Done"
                    onClick={() =>
                      setNewCommentBody((prev) =>
                        prev.trim()
                          ? `${prev}\nWork on this task is done.`
                          : "Work on this task is done.",
                      )
                    }
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-500 dark:text-zinc-400">
                  New update
                </label>
                <textarea
                  value={newCommentBody}
                  onChange={(e) => setNewCommentBody(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:bg-zinc-950 dark:ring-zinc-800 dark:focus:ring-zinc-600"
                  placeholder="Write a project update..."
                />
              </div>

              <div className="rounded-xl border border-dashed border-zinc-200 p-3 dark:border-zinc-800">
                <div className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Optional attachment
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <select
                    value={attachmentType}
                    onChange={(e) => setAttachmentType(e.target.value)}
                    className="rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:bg-zinc-950 dark:ring-zinc-800 dark:focus:ring-zinc-600"
                  >
                    <option value="LINK">Link</option>
                    <option value="IMAGE">Image</option>
                    <option value="FILE">File</option>
                  </select>

                  <input
                    value={attachmentUrl}
                    onChange={(e) => setAttachmentUrl(e.target.value)}
                    placeholder="https://..."
                    className="rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:bg-zinc-950 dark:ring-zinc-800 dark:focus:ring-zinc-600"
                  />

                  <input
                    value={attachmentLabel}
                    onChange={(e) => setAttachmentLabel(e.target.value)}
                    placeholder="Optional label"
                    className="rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:bg-zinc-950 dark:ring-zinc-800 dark:focus:ring-zinc-600"
                  />
                </div>
              </div>

              {postCommentError && (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-100 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-900/40">
                  {postCommentError}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={postingComment || newCommentBody.trim().length < 1}
                  onClick={async () => {
                    try {
                      setPostingComment(true);
                      setPostCommentError(null);

                      const attachments =
                        attachmentUrl.trim().length > 0
                          ? [
                              {
                                type:
                                  attachmentType === "IMAGE" ||
                                  (attachmentType === "LINK" &&
                                    looksLikeImage(attachmentUrl.trim()))
                                    ? "IMAGE"
                                    : attachmentType,
                                url: attachmentUrl.trim(),
                                label: attachmentLabel.trim() || null,
                              },
                            ]
                          : undefined;

                      const created = await createProjectComment(project.id, {
                        authorId: me.id,
                        body: newCommentBody.trim(),
                        attachments,
                      });

                      setComments((prev) => [...prev, created]);
                      setNewCommentBody("");
                      setAttachmentType("LINK");
                      setAttachmentUrl("");
                      setAttachmentLabel("");
                    } catch (e: any) {
                      setPostCommentError(
                        e?.message ?? "Failed to create comment",
                      );
                    } finally {
                      setPostingComment(false);
                    }
                  }}
                  className="rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {postingComment ? "Posting..." : "Post update"}
                </button>
              </div>
            </div>

            <div className="mt-5">
              {loadingComments && (
                <div className="text-sm text-zinc-500 dark:text-zinc-400">
                  Loading comments...
                </div>
              )}

              {commentsError && (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-100 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-900/40">
                  {commentsError}
                </div>
              )}

              {!loadingComments && !commentsError && comments.length === 0 && (
                <div className="text-sm text-zinc-500 dark:text-zinc-400">
                  No updates yet.
                </div>
              )}

              <div className="space-y-6">
                {groupedComments.map((group) => (
                  <div key={group.dayLabel}>
                    <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      {group.dayLabel}
                    </div>

                    <div className="space-y-0">
                      {group.items.map((comment, index) => (
                        <div
                          key={comment.id}
                          className="grid grid-cols-[24px_1fr] gap-3"
                        >
                          <div className="relative flex justify-center">
                            <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-xs ring-4 ring-white dark:bg-zinc-900 dark:ring-zinc-950">
                              {getEventIcon(comment)}
                            </div>

                            {index < group.items.length - 1 && (
                              <div className="absolute top-5 bottom-0 w-px bg-zinc-200 dark:bg-zinc-800" />
                            )}
                          </div>

                          <div className="pb-5">
                            <div
                              className={[
                                "rounded-2xl p-3 ring-1",
                                getEventCardClass(comment),
                              ].join(" ")}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <div
                                    className={[
                                      "text-sm font-medium",
                                      getEventTitleClass(comment),
                                    ].join(" ")}
                                  >
                                    {getEventTitle(comment)}
                                  </div>

                                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                    {formatDateTime(comment.createdAt)}
                                  </div>
                                </div>

                                {comment.kind !== "SYSTEM" &&
                                  comment.authorId === me.id && (
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingCommentId(comment.id);
                                          setEditingCommentBody(comment.body);
                                        }}
                                        className="rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-white hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-950 dark:hover:text-zinc-100"
                                        title="Edit comment"
                                      >
                                        ✏️
                                      </button>

                                      <button
                                        type="button"
                                        onClick={async () => {
                                          const ok = window.confirm(
                                            "Delete this comment?",
                                          );
                                          if (!ok) return;

                                          try {
                                            await deleteProjectComment(
                                              comment.id,
                                            );

                                            setComments((prev) =>
                                              prev.filter(
                                                (c) => c.id !== comment.id,
                                              ),
                                            );

                                            setReactionsByComment((prev) => {
                                              const next = { ...prev };
                                              delete next[comment.id];
                                              return next;
                                            });
                                          } catch (e) {
                                            console.error(
                                              "Failed to delete comment",
                                              e,
                                            );
                                            alert("Failed to delete comment");
                                          }
                                        }}
                                        className="rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-white hover:text-red-600 dark:text-zinc-400 dark:hover:bg-zinc-950 dark:hover:text-red-400"
                                        title="Delete comment"
                                      >
                                        🗑
                                      </button>
                                    </div>
                                  )}
                              </div>

                              {editingCommentId === comment.id ? (
                                <div className="mt-3 space-y-3">
                                  <textarea
                                    value={editingCommentBody}
                                    onChange={(e) =>
                                      setEditingCommentBody(e.target.value)
                                    }
                                    rows={4}
                                    className="w-full rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:bg-zinc-950 dark:ring-zinc-800 dark:focus:ring-zinc-600"
                                  />

                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingCommentId(null);
                                        setEditingCommentBody("");
                                      }}
                                      className="rounded-xl px-3 py-2 text-sm ring-1 ring-zinc-200 hover:bg-zinc-50 dark:ring-zinc-800 dark:hover:bg-zinc-900"
                                    >
                                      Cancel
                                    </button>

                                    <button
                                      type="button"
                                      disabled={
                                        editingCommentSaving ||
                                        editingCommentBody.trim().length < 1
                                      }
                                      onClick={async () => {
                                        try {
                                          setEditingCommentSaving(true);

                                          const updated =
                                            await updateProjectComment(
                                              comment.id,
                                              {
                                                body: editingCommentBody.trim(),
                                              },
                                            );

                                          setComments((prev) =>
                                            prev.map((c) =>
                                              c.id === comment.id ? updated : c,
                                            ),
                                          );

                                          setEditingCommentId(null);
                                          setEditingCommentBody("");
                                        } catch (e) {
                                          console.error(
                                            "Failed to update comment",
                                            e,
                                          );
                                          alert("Failed to update comment");
                                        } finally {
                                          setEditingCommentSaving(false);
                                        }
                                      }}
                                      className="rounded-xl bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                                    >
                                      {editingCommentSaving
                                        ? "Saving..."
                                        : "Save"}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  className={[
                                    "mt-2 whitespace-pre-wrap text-sm",
                                    getEventBodyClass(comment),
                                  ].join(" ")}
                                >
                                  {comment.body}
                                </div>
                              )}

                              {comment.kind !== "SYSTEM" &&
                                editingCommentId !== comment.id &&
                                comment.attachments &&
                                comment.attachments.length > 0 && (
                                  <div className="mt-3 space-y-3">
                                    {comment.attachments.map((attachment) => {
                                      const isImage =
                                        attachment.type === "IMAGE" ||
                                        looksLikeImage(attachment.url);

                                      if (isImage) {
                                        return (
                                          <div
                                            key={attachment.id}
                                            className="space-y-2"
                                          >
                                            {attachment.label ? (
                                              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                                {attachment.label}
                                              </div>
                                            ) : null}

                                            <a
                                              href={attachment.url}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="block"
                                            >
                                              <img
                                                src={attachment.url}
                                                alt={
                                                  attachment.label ??
                                                  "Comment attachment"
                                                }
                                                className="max-h-64 w-full rounded-xl border border-zinc-200 object-cover dark:border-zinc-800"
                                              />
                                            </a>
                                          </div>
                                        );
                                      }

                                      return (
                                        <a
                                          key={attachment.id}
                                          href={attachment.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-300 dark:ring-zinc-800 dark:hover:bg-zinc-900"
                                        >
                                          <span>
                                            {attachment.type === "FILE"
                                              ? "📎"
                                              : "🔗"}
                                          </span>
                                          <span className="truncate">
                                            {attachment.label?.trim() ||
                                              attachment.url}
                                          </span>
                                        </a>
                                      );
                                    })}
                                  </div>
                                )}

                              {comment.kind !== "SYSTEM" &&
                                editingCommentId !== comment.id && (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {(
                                      [
                                        "LIKE",
                                        "HEART",
                                        "CLAP",
                                        "CHECK",
                                        "WOW",
                                      ] as ReactionType[]
                                    ).map((type) => {
                                      const active = hasReacted(
                                        comment.id,
                                        type,
                                      );
                                      const count = getReactionCount(
                                        comment.id,
                                        type,
                                      );

                                      return (
                                        <button
                                          key={type}
                                          type="button"
                                          onClick={async () => {
                                            try {
                                              const result =
                                                await toggleCommentReaction(
                                                  comment.id,
                                                  {
                                                    userId: me.id,
                                                    type,
                                                  },
                                                );

                                              setReactionsByComment((prev) => {
                                                const existing =
                                                  prev[comment.id] ?? [];

                                                if (
                                                  "removed" in result &&
                                                  result.removed
                                                ) {
                                                  return {
                                                    ...prev,
                                                    [comment.id]:
                                                      existing.filter(
                                                        (r) =>
                                                          !(
                                                            r.userId ===
                                                              me.id &&
                                                            r.type === type
                                                          ),
                                                      ),
                                                  };
                                                }

                                                const createdReaction =
                                                  result as CommentReaction;

                                                return {
                                                  ...prev,
                                                  [comment.id]: [
                                                    ...existing,
                                                    createdReaction,
                                                  ],
                                                };
                                              });
                                            } catch (e) {
                                              console.error(
                                                "Failed to toggle reaction",
                                                e,
                                              );
                                            }
                                          }}
                                          className={[
                                            "rounded-full px-2.5 py-1 text-xs ring-1 transition",
                                            active
                                              ? "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/50"
                                              : "bg-white text-zinc-500 ring-zinc-200 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-400 dark:ring-zinc-800 dark:hover:bg-zinc-900",
                                          ].join(" ")}
                                        >
                                          <span className="mr-1">
                                            {emojiForReaction(type)}
                                          </span>
                                          <span>{count}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* PROJECT DETAILS */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setDetailsOpen((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <span>{isLeaveEntry ? "Leave details" : "Project details"}</span>
              <span className="text-xs text-zinc-500">
                {detailsOpen ? "Collapse ▲" : "Expand ▼"}
              </span>
            </button>

            {detailsOpen && (
              <div className="space-y-4 border-t border-zinc-200 p-4 dark:border-zinc-800">
                <Field
                  label="Created by"
                  value={project.owner?.displayName ?? project.ownerId ?? "—"}
                />
                <Field label="Period" value={displayPeriod} />
                <Field
                  label="Created at"
                  value={formatDateTime(project.createdAt)}
                />
                <Field
                  label="Last update"
                  value={formatDateTime(project.updatedAt)}
                />

                <div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    Assigned people
                  </div>

                  <div className="mt-2 space-y-2">
                    {assignedUsers.length > 0 ? (
                      assignedUsers.map((u) => (
                        <div
                          key={u.id}
                          className="rounded-xl bg-zinc-50 px-3 py-2 text-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800"
                        >
                          <div className="font-medium">{u.displayName}</div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">
                            {u.role}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-zinc-500 dark:text-zinc-400">
                        No assigned people.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* EDIT METADATA */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setMetadataOpen((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <span>Edit metadata</span>
              <span className="text-xs text-zinc-500">
                {metadataOpen ? "Collapse ▲" : "Expand ▼"}
              </span>
            </button>

            {metadataOpen && (
              <div className="space-y-4 border-t border-zinc-200 p-4 dark:border-zinc-800">
                <div>
                  <label className="text-xs text-zinc-500 dark:text-zinc-400">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                    className="mt-1 w-full rounded-xl bg-zinc-50 px-3 py-2 text-sm ring-1 ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:bg-zinc-900 dark:ring-zinc-800 dark:focus:ring-zinc-600"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {isLeaveEntry ? (
                  <div>
                    <label className="text-xs text-zinc-500 dark:text-zinc-400">
                      Leave type
                    </label>
                    <select
                      value={leaveType}
                      onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                      className="mt-1 w-full rounded-xl bg-zinc-50 px-3 py-2 text-sm ring-1 ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:bg-zinc-900 dark:ring-zinc-800 dark:focus:ring-zinc-600"
                    >
                      {LEAVE_COLOR_OPTIONS.map((option) => {
                        const optionLeaveType = getLeaveTypeFromColorKey(
                          option.key,
                        );

                        if (!optionLeaveType) {
                          return null;
                        }

                        return (
                          <option key={option.key} value={optionLeaveType}>
                            {option.label}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs text-zinc-500 dark:text-zinc-400">
                      Department
                    </label>
                    <select
                      value={department}
                      onChange={(e) =>
                        setDepartment(e.target.value as ProjectDepartment)
                      }
                      className="mt-1 w-full rounded-xl bg-zinc-50 px-3 py-2 text-sm ring-1 ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:bg-zinc-900 dark:ring-zinc-800 dark:focus:ring-zinc-600"
                    >
                      {DEPARTMENT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {!isLeaveEntry ? (
                  <>
                <div>
                  <label className="text-xs text-zinc-500 dark:text-zinc-400">
                    Project manager
                  </label>
                  <select
                    value={projectManagerId}
                    onChange={(e) => setProjectManagerId(e.target.value)}
                    className="mt-1 w-full rounded-xl bg-zinc-50 px-3 py-2 text-sm ring-1 ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:bg-zinc-900 dark:ring-zinc-800 dark:focus:ring-zinc-600"
                  >
                    <option value="">— None —</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-zinc-500 dark:text-zinc-400">
                    Requester
                  </label>
                  <input
                    value={requesterName}
                    onChange={(e) => setRequesterName(e.target.value)}
                    className="mt-1 w-full rounded-xl bg-zinc-50 px-3 py-2 text-sm ring-1 ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:bg-zinc-900 dark:ring-zinc-800 dark:focus:ring-zinc-600"
                    placeholder="Who requested the project?"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-500 dark:text-zinc-400">
                    Contact person
                  </label>
                  <input
                    value={contactPersonName}
                    onChange={(e) => setContactPersonName(e.target.value)}
                    className="mt-1 w-full rounded-xl bg-zinc-50 px-3 py-2 text-sm ring-1 ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:bg-zinc-900 dark:ring-zinc-800 dark:focus:ring-zinc-600"
                    placeholder="Main contact person"
                  />
                </div>
                  </>
                ) : null}

                <div>
                  <label className="text-xs text-zinc-500 dark:text-zinc-400">
                    Start date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 w-full rounded-xl bg-zinc-50 px-3 py-2 text-sm ring-1 ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:bg-zinc-900 dark:ring-zinc-800 dark:focus:ring-zinc-600"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-500 dark:text-zinc-400">
                    Due date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="mt-1 w-full rounded-xl bg-zinc-50 px-3 py-2 text-sm ring-1 ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:bg-zinc-900 dark:ring-zinc-800 dark:focus:ring-zinc-600"
                  />
                </div>

                {!isLeaveEntry ? (
                  <div>
                    <label className="text-xs text-zinc-500 dark:text-zinc-400">
                      Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      className="mt-1 w-full rounded-xl bg-zinc-50 px-3 py-2 text-sm ring-1 ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:bg-zinc-900 dark:ring-zinc-800 dark:focus:ring-zinc-600"
                      placeholder="Short project description"
                    />
                  </div>
                ) : null}

                <div>
                  <label className="text-xs text-zinc-500 dark:text-zinc-400">
                    Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={5}
                    className="mt-1 w-full rounded-xl bg-zinc-50 px-3 py-2 text-sm ring-1 ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:bg-zinc-900 dark:ring-zinc-800 dark:focus:ring-zinc-600"
                    placeholder="Internal notes"
                  />
                </div>

                {saveError && (
                  <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-100 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-900/40">
                    {saveError}
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={async () => {
                      try {
                        setSaving(true);
                        setSaveError(null);

                        await onSaveMetadata(project.id, {
                          status,
                          colorKey: isLeaveEntry
                            ? LEAVE_COLOR_OPTIONS.find(
                                (option) =>
                                  getLeaveTypeFromColorKey(option.key) ===
                                  leaveType,
                              )?.key
                            : undefined,
                          department: isLeaveEntry ? "OTHER" : department,
                          projectManagerId: isLeaveEntry
                            ? null
                            : projectManagerId || null,
                          requesterName: isLeaveEntry
                            ? null
                            : requesterName.trim() || null,
                          contactPersonName: isLeaveEntry
                            ? null
                            : contactPersonName.trim() || null,
                          description: isLeaveEntry
                            ? null
                            : description.trim() || null,
                          notes: notes.trim() || null,
                          startDate: startDate
                            ? `${startDate}T00:00:00.000Z`
                            : null,
                          dueDate: dueDate ? `${dueDate}T00:00:00.000Z` : null,
                        });
                      } catch (e: any) {
                        setSaveError(
                          e?.message ?? "Failed to save project metadata",
                        );
                      } finally {
                        setSaving(false);
                      }
                    }}
                    className="rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    {saving ? "Saving..." : "Save metadata"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
