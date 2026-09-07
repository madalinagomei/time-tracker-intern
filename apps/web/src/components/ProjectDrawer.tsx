import { useEffect, useMemo, useState } from "react";
import {
  createProjectComment,
  deleteProjectComment,
  getProjectComments,
  updateProjectComment,
} from "../api";
import type {
  AssignmentRow,
  Project,
  ProjectComment,
  ProjectDepartment,
  ProjectStatus,
  UserRow,
} from "../api";
import { getColorOption, getLeaveTypeFromColorKey } from "../planning";

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function toDateInputValue(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function inclusiveEndInput(endDate: string) {
  const date = new Date(endDate);
  date.setDate(date.getDate() - 1);
  return toDateInputValue(date.toISOString());
}

function exclusiveIsoFromInput(value: string) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString();
}

export function ProjectDrawer({
  open,
  project,
  assignments,
  users,
  me,
  activityRefreshKey,
  selectedAssignmentId,
  onClose,
  onSaveMetadata,
  onUpdateAssignment,
}: {
  open: boolean;
  project: Project | null;
  assignments: AssignmentRow[];
  users: UserRow[];
  me: { id: string };
  activityRefreshKey: number;
  selectedAssignmentId?: string | null;
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
  onUpdateAssignment: (
    assignmentId: string,
    patch: {
      focusStart?: string | null;
      focusEnd?: string | null;
    },
  ) => Promise<void>;
}) {
  const [description, setDescription] = useState("");
  const [savingDescription, setSavingDescription] = useState(false);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [comments, setComments] = useState<ProjectComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [newCommentBody, setNewCommentBody] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState("");
  const [focusAssignmentId, setFocusAssignmentId] = useState("");
  const [focusStartInput, setFocusStartInput] = useState("");
  const [focusEndInput, setFocusEndInput] = useState("");
  const [savingFocus, setSavingFocus] = useState(false);
  const [focusError, setFocusError] = useState<string | null>(null);

  const sortedAssignments = useMemo(
    () =>
      [...assignments].sort(
        (left, right) =>
          new Date(left.startDate).getTime() - new Date(right.startDate).getTime(),
      ),
    [assignments],
  );
  const assignedUsers = useMemo(
    () => users.filter((user) => assignments.some((item) => item.userId === user.id)),
    [assignments, users],
  );
  const focusAssignment =
    sortedAssignments.find((item) => item.id === focusAssignmentId) ??
    sortedAssignments.find((item) => item.id === selectedAssignmentId) ??
    sortedAssignments[0] ??
    null;
  const focusStartMin = focusAssignment
    ? toDateInputValue(focusAssignment.startDate)
    : "";
  const focusEndMax = focusAssignment
    ? inclusiveEndInput(focusAssignment.endDate)
    : "";
  const visibleComments = comments.filter((comment) => comment.kind !== "SYSTEM");

  useEffect(() => {
    if (!project) return;

    setDescription(project.description ?? "");
    setDescriptionError(null);
    setFocusAssignmentId(selectedAssignmentId ?? "");
  }, [project, selectedAssignmentId]);

  useEffect(() => {
    if (!focusAssignment) {
      setFocusStartInput("");
      setFocusEndInput("");
      return;
    }

    setFocusStartInput(
      focusAssignment.focusStart
        ? toDateInputValue(focusAssignment.focusStart)
        : toDateInputValue(focusAssignment.startDate),
    );
    setFocusEndInput(
      focusAssignment.focusEnd
        ? inclusiveEndInput(focusAssignment.focusEnd)
        : inclusiveEndInput(focusAssignment.endDate),
    );
    setFocusError(null);
  }, [focusAssignment?.id, focusAssignment?.focusStart, focusAssignment?.focusEnd]);

  useEffect(() => {
    if (!open || !project) return;

    let active = true;
    setLoadingComments(true);
    setCommentsError(null);
    void getProjectComments(project.id)
      .then((items) => {
        if (active) setComments(items);
      })
      .catch((error: unknown) => {
        if (active) {
          setCommentsError(
            error instanceof Error ? error.message : "Failed to load comments",
          );
        }
      })
      .finally(() => {
        if (active) setLoadingComments(false);
      });

    return () => {
      active = false;
    };
  }, [open, project, activityRefreshKey]);

  useEffect(() => {
    if (!open) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose, open]);

  if (!open || !project) return null;

  const color = getColorOption(project.colorKey);
  const isLeave = Boolean(getLeaveTypeFromColorKey(project.colorKey));
  const selectedFocusUser = focusAssignment
    ? users.find((user) => user.id === focusAssignment.userId)
    : null;

  async function postUpdate() {
    const body = newCommentBody.trim();
    if (!body) return;

    try {
      setPostingComment(true);
      const created = await createProjectComment(project!.id, {
        body,
      });
      setComments((previous) => [...previous, created]);
      setNewCommentBody("");
    } catch (error) {
      setCommentsError(
        error instanceof Error ? error.message : "Failed to post update",
      );
    } finally {
      setPostingComment(false);
    }
  }

  async function saveFocus() {
    if (!focusAssignment || !focusStartInput || !focusEndInput) return;
    if (focusStartInput > focusEndInput) {
      setFocusError("Focus end must be on or after the focus start.");
      return;
    }

    try {
      setSavingFocus(true);
      setFocusError(null);
      await onUpdateAssignment(focusAssignment.id, {
        focusStart: `${focusStartInput}T00:00:00.000Z`,
        focusEnd: exclusiveIsoFromInput(focusEndInput),
      });
    } catch (error) {
      setFocusError(
        error instanceof Error ? error.message : "Failed to save focus period",
      );
    } finally {
      setSavingFocus(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close project drawer"
        className="absolute inset-0 bg-black/25"
        onClick={onClose}
      />

      <aside className="relative flex h-full w-full max-w-[480px] flex-col border-l border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        <header className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              {isLeave ? "Leave" : "Project"}
            </div>
            <h2 className="mt-1 truncate text-lg font-semibold text-zinc-950 dark:text-zinc-100">
              {project.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-2 py-1 text-lg leading-none text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
            aria-label="Close project drawer"
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <section className="grid gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="grid gap-1 text-sm">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Department
              </span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {color.label}
              </span>
            </div>
            <div className="grid gap-1 text-sm">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Assigned to
              </span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {assignedUsers.length
                  ? assignedUsers.map((user) => user.displayName).join(", ")
                  : "Not assigned"}
              </span>
            </div>
          </section>

          {!isLeave ? (
            <section className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Description
              </div>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                placeholder="Add a short project description..."
                className="w-full rounded-xl bg-zinc-50 px-3 py-2 text-sm text-zinc-900 ring-1 ring-zinc-200 outline-none transition focus:ring-2 focus:ring-sky-300 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-800 dark:focus:ring-sky-800"
              />
              {descriptionError ? (
                <div className="mt-2 text-sm text-red-600 dark:text-red-300">
                  {descriptionError}
                </div>
              ) : null}
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  disabled={savingDescription}
                  onClick={async () => {
                    try {
                      setSavingDescription(true);
                      setDescriptionError(null);
                      await onSaveMetadata(project.id, {
                        description: description.trim() || null,
                      });
                    } catch (error) {
                      setDescriptionError(
                        error instanceof Error
                          ? error.message
                          : "Failed to save description",
                      );
                    } finally {
                      setSavingDescription(false);
                    }
                  }}
                  className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {savingDescription ? "Saving..." : "Save description"}
                </button>
              </div>
            </section>
          ) : null}

          {focusAssignment ? (
            <section className="rounded-2xl border border-sky-200/80 bg-sky-50/45 p-4 dark:border-sky-900/45 dark:bg-sky-950/16">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Focus period
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {selectedFocusUser?.displayName ?? "Assignment"}
                </div>
              </div>
              {sortedAssignments.length > 1 ? (
                <select
                  value={focusAssignment.id}
                  onChange={(event) => setFocusAssignmentId(event.target.value)}
                  className="mt-3 w-full rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-sky-200 outline-none dark:bg-zinc-950 dark:ring-sky-900/60"
                >
                  {sortedAssignments.map((assignment) => {
                    const user = users.find((item) => item.id === assignment.userId);
                    return (
                      <option key={assignment.id} value={assignment.id}>
                        {user?.displayName ?? "Unknown"} · {toDateInputValue(assignment.startDate)}
                      </option>
                    );
                  })}
                </select>
              ) : null}
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  Focus start
                  <input
                    type="date"
                    min={focusStartMin}
                    max={focusEndMax}
                    value={focusStartInput}
                    onChange={(event) => setFocusStartInput(event.target.value)}
                    className="rounded-xl bg-white px-2.5 py-2 text-sm ring-1 ring-sky-200 outline-none dark:bg-zinc-950 dark:ring-sky-900/60"
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  Focus end
                  <input
                    type="date"
                    min={focusStartMin}
                    max={focusEndMax}
                    value={focusEndInput}
                    onChange={(event) => setFocusEndInput(event.target.value)}
                    className="rounded-xl bg-white px-2.5 py-2 text-sm ring-1 ring-sky-200 outline-none dark:bg-zinc-950 dark:ring-sky-900/60"
                  />
                </label>
              </div>
              {focusError ? (
                <div className="mt-2 text-sm text-red-600 dark:text-red-300">{focusError}</div>
              ) : null}
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={savingFocus || !focusAssignment.focusStart}
                  onClick={async () => {
                    try {
                      setSavingFocus(true);
                      setFocusError(null);
                      await onUpdateAssignment(focusAssignment.id, {
                        focusStart: null,
                        focusEnd: null,
                      });
                    } catch (error) {
                      setFocusError(
                        error instanceof Error ? error.message : "Failed to clear focus period",
                      );
                    } finally {
                      setSavingFocus(false);
                    }
                  }}
                  className="rounded-xl px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-white/70 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  Clear focus
                </button>
                <button
                  type="button"
                  disabled={savingFocus || !focusStartInput || !focusEndInput}
                  onClick={() => void saveFocus()}
                  className="rounded-xl bg-sky-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
                >
                  {savingFocus ? "Saving..." : "Set focus"}
                </button>
              </div>
            </section>
          ) : null}

          <section className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Comments
            </div>
            <label className="mt-3 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              New Update
            </label>
            <textarea
              value={newCommentBody}
              onChange={(event) => setNewCommentBody(event.target.value)}
              rows={3}
              placeholder="Write an update..."
              className="mt-1 w-full rounded-xl bg-zinc-50 px-3 py-2 text-sm text-zinc-900 ring-1 ring-zinc-200 outline-none transition focus:ring-2 focus:ring-sky-300 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-800 dark:focus:ring-sky-800"
            />
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={postingComment || !newCommentBody.trim()}
                onClick={() => void postUpdate()}
                className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {postingComment ? "Posting..." : "Post update"}
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {loadingComments ? <div className="text-sm text-zinc-500">Loading comments...</div> : null}
              {commentsError ? <div className="text-sm text-red-600 dark:text-red-300">{commentsError}</div> : null}
              {!loadingComments && !commentsError && visibleComments.length === 0 ? (
                <div className="text-sm text-zinc-500 dark:text-zinc-400">No updates yet.</div>
              ) : null}
              {visibleComments.map((comment) => (
                <article key={comment.id} className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-900/70">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {comment.author.displayName}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {formatDateTime(comment.createdAt)}
                      </div>
                    </div>
                    {comment.authorId === me.id ? (
                      <div className="flex gap-1 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCommentId(comment.id);
                            setEditingCommentBody(comment.body);
                          }}
                          className="rounded-lg px-2 py-1 text-zinc-500 hover:bg-white dark:text-zinc-400 dark:hover:bg-zinc-950"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!window.confirm("Delete this update?")) return;
                            try {
                              await deleteProjectComment(comment.id);
                              setComments((previous) => previous.filter((item) => item.id !== comment.id));
                            } catch (error) {
                              setCommentsError(error instanceof Error ? error.message : "Failed to delete update");
                            }
                          }}
                          className="rounded-lg px-2 py-1 text-red-600 hover:bg-white dark:text-red-300 dark:hover:bg-zinc-950"
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {editingCommentId === comment.id ? (
                    <div className="mt-3">
                      <textarea
                        value={editingCommentBody}
                        onChange={(event) => setEditingCommentBody(event.target.value)}
                        rows={3}
                        className="w-full rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-zinc-200 outline-none dark:bg-zinc-950 dark:ring-zinc-800"
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <button type="button" onClick={() => setEditingCommentId(null)} className="px-2 py-1 text-xs text-zinc-500">Cancel</button>
                        <button
                          type="button"
                          onClick={async () => {
                            const body = editingCommentBody.trim();
                            if (!body) return;
                            try {
                              const updated = await updateProjectComment(comment.id, { body });
                              setComments((previous) => previous.map((item) => item.id === updated.id ? updated : item));
                              setEditingCommentId(null);
                            } catch (error) {
                              setCommentsError(error instanceof Error ? error.message : "Failed to update comment");
                            }
                          }}
                          className="rounded-lg bg-zinc-900 px-2 py-1 text-xs font-medium text-white dark:bg-white dark:text-zinc-900"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{comment.body}</p>
                  )}
                </article>
              ))}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
