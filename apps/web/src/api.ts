import {
  DEFAULT_PROJECT_COLOR_KEY,
  getColorKeyForDepartment,
  getProjectDepartmentFromColorKey,
  safeColorKey,
} from "./planning";

const API_BASE = (import.meta.env.VITE_API_BASE ?? "http://localhost:4000").replace(
  /\/$/,
  "",
);
const SESSION_STORAGE_KEY = "timeline-session";

export type Me = {
  id: string;
  username: string;
  displayName: string;
  role: "USER" | "ADMIN";
  mustChangePassword: boolean;
  accessToken?: string;
};

export type UserRow = {
  id: string;
  username: string;
  displayName: string;
  role: "USER" | "ADMIN";
};

export type CommentAttachment = {
  id: string;
  commentId: string;
  type: string;
  url: string;
  label?: string | null;
  createdAt: string;
};

export type CommentKind = "COMMENT" | "SYSTEM";
export type ReactionType = "LIKE" | "HEART" | "CLAP" | "WOW" | "CHECK";

export type ProjectComment = {
  id: string;
  projectId: string;
  authorId: string;
  body: string;
  kind: CommentKind;
  meta?: unknown;
  progressPercent?: number | null;
  createdAt: string;
  updatedAt?: string;
  author: UserRow;
  attachments?: CommentAttachment[];
};

export type CommentReaction = {
  id: string;
  commentId: string;
  userId: string;
  type: ReactionType;
  createdAt: string;
};

export type ProjectStatus =
  | "PLANNED"
  | "ACTIVE"
  | "ON_HOLD"
  | "DONE"
  | "ARCHIVED";

export type ProjectDepartment =
  | "HAEMATOLOGY"
  | "HEMOSTASIS"
  | "URINALYSIS"
  | "FLOW_CYTOMETRY"
  | "LIFE_SCIENCE"
  | "POINT_OF_CARE"
  | "CARESPHERE_ACADEMY"
  | "SOFTWARE"
  | "IMMUNOLOGY"
  | "CLINICAL_CHEMISTRY"
  | "OTHER";

export type ProjectPerson = {
  id: string;
  username: string;
  displayName: string;
};

export type AssignmentFocusPeriod = {
  id: string;
  assignmentId: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt?: string;
};

export type AssignmentRow = {
  id: string;
  userId: string;
  projectId: string;
  startDate: string;
  endDate: string;
  laneIndex?: number | null;
  focusStart?: string | null;
  focusEnd?: string | null;
  focusPeriods?: AssignmentFocusPeriod[];
  createdAt?: string;
  updatedAt?: string;
};

export type ProjectAssignment = AssignmentRow & {
  user: ProjectPerson;
};

export type Project = {
  id: string;
  name: string;
  colorKey: string;
  ownerId: string | null;
  status: ProjectStatus;
  department: ProjectDepartment;
  description: string | null;
  notes: string | null;
  projectManagerId: string | null;
  requesterName: string | null;
  contactPersonName: string | null;
  startDate: string | null;
  dueDate: string | null;
  owner?: ProjectPerson | null;
  projectManager?: ProjectPerson | null;
  assignments?: ProjectAssignment[];
  createdAt: string;
  updatedAt: string;
};

function storeSession(me: Me | null) {
  if (typeof window === "undefined") return;

  if (me) {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(me));
  } else {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  }
}

export function getStoredSession(): Me | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;

  try {
    const value = JSON.parse(raw) as Partial<Me>;
    if (
      !value.id ||
      !value.username ||
      !value.displayName ||
      !value.role ||
      !value.accessToken
    ) {
      throw new Error("Invalid session");
    }

    return {
      id: value.id,
      username: value.username,
      displayName: value.displayName,
      role: value.role,
      mustChangePassword: Boolean(value.mustChangePassword),
      accessToken: value.accessToken,
    };
  } catch {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export function clearStoredSession() {
  storeSession(null);
}

export async function logout() {
  try {
    await apiRequest<void>("/auth/logout", { method: "POST" });
  } finally {
    clearStoredSession();
  }
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const accessToken = getStoredSession()?.accessToken;

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  if (init.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init,
    headers,
  });

  if (!response.ok) {
    const body = await response.text();
    try {
      const parsed = JSON.parse(body) as { error?: string };
      throw new Error(parsed.error || body || `HTTP ${response.status}`);
    } catch (error) {
      if (error instanceof Error && error.message !== body) throw error;
      throw new Error(body || `HTTP ${response.status}`);
    }
  }

  return response.status === 204 ? (undefined as T) : response.json();
}

function sanitizeProject(project: Project): Project {
  const colorKey = safeColorKey(project.colorKey);
  return {
    ...project,
    colorKey,
    department:
      project.department ?? getProjectDepartmentFromColorKey(colorKey) ?? "OTHER",
  };
}

export async function login(username: string, password: string): Promise<Me> {
  const me = await apiRequest<Me>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: username.trim(), password }),
  });
  storeSession(me);
  return me;
}

export async function getProjects(): Promise<Project[]> {
  const projects = await apiRequest<Project[]>("/projects");
  return projects.map(sanitizeProject);
}

export async function createProject(
  name: string,
  colorKey?: string,
  ownerId?: string,
  metadata?: {
    status?: ProjectStatus;
    department?: ProjectDepartment;
    description?: string | null;
    notes?: string | null;
    projectManagerId?: string | null;
    requesterName?: string | null;
    contactPersonName?: string | null;
    startDate?: string | null;
    dueDate?: string | null;
  },
): Promise<Project> {
  const normalizedColorKey = safeColorKey(
    colorKey ??
      getColorKeyForDepartment(metadata?.department) ??
      DEFAULT_PROJECT_COLOR_KEY,
  );
  const project = await apiRequest<Project>("/projects", {
    method: "POST",
    body: JSON.stringify({
      name,
      colorKey: normalizedColorKey,
      ownerId,
      ...metadata,
      department:
        metadata?.department ??
        getProjectDepartmentFromColorKey(normalizedColorKey) ??
        "OTHER",
    }),
  });
  return sanitizeProject(project);
}

export async function updateProject(
  id: string,
  patch: {
    name?: string;
    colorKey?: string;
    ownerId?: string | null;
    status?: ProjectStatus;
    department?: ProjectDepartment;
    description?: string | null;
    notes?: string | null;
    projectManagerId?: string | null;
    requesterName?: string | null;
    contactPersonName?: string | null;
    startDate?: string | null;
    dueDate?: string | null;
  },
): Promise<Project> {
  const payload = {
    ...patch,
    ...(patch.colorKey !== undefined || patch.department !== undefined
      ? {
          colorKey: safeColorKey(
            patch.colorKey ?? getColorKeyForDepartment(patch.department),
          ),
        }
      : {}),
  };
  const project = await apiRequest<Project>(`/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return sanitizeProject(project);
}

export async function deleteProject(id: string): Promise<void> {
  await apiRequest<void>(`/projects/${id}`, { method: "DELETE" });
}

export async function getUsers(): Promise<UserRow[]> {
  return apiRequest<UserRow[]>("/users");
}

export async function getAssignments(
  from?: string,
  to?: string,
): Promise<AssignmentRow[]> {
  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  return apiRequest<AssignmentRow[]>(
    `/assignments${query.size ? `?${query.toString()}` : ""}`,
  );
}

export async function createAssignment(
  userId: string,
  projectId: string,
  startDate: string,
  lengthDays = 1,
  options?: { laneIndex?: number },
): Promise<AssignmentRow> {
  return apiRequest<AssignmentRow>("/assignments", {
    method: "POST",
    body: JSON.stringify({ userId, projectId, startDate, lengthDays, ...options }),
  });
}

export async function updateAssignment(
  id: string,
  patch: {
    startDate?: string;
    lengthDays?: number;
    userId?: string;
    laneIndex?: number | null;
  },
): Promise<AssignmentRow> {
  return apiRequest<AssignmentRow>(`/assignments/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteAssignment(id: string): Promise<void> {
  await apiRequest<void>(`/assignments/${id}`, { method: "DELETE" });
}

export async function createAssignmentFocusPeriod(
  assignmentId: string,
  payload: { startDate: string; endDate: string },
): Promise<AssignmentRow> {
  return apiRequest<AssignmentRow>(`/assignments/${assignmentId}/focus-periods`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAssignmentFocusPeriod(
  assignmentId: string,
  focusPeriodId: string,
  payload: { startDate?: string; endDate?: string },
): Promise<AssignmentRow> {
  return apiRequest<AssignmentRow>(
    `/assignments/${assignmentId}/focus-periods/${focusPeriodId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export async function deleteAssignmentFocusPeriod(
  assignmentId: string,
  focusPeriodId: string,
): Promise<AssignmentRow> {
  return apiRequest<AssignmentRow>(
    `/assignments/${assignmentId}/focus-periods/${focusPeriodId}`,
    { method: "DELETE" },
  );
}

export async function getProjectComments(
  projectId: string,
): Promise<ProjectComment[]> {
  return apiRequest<ProjectComment[]>(`/projects/${projectId}/comments`);
}

export async function createProjectComment(
  projectId: string,
  payload: {
    body: string;
    attachments?: Array<{
      type: string;
      url: string;
      label?: string | null;
    }>;
  },
): Promise<ProjectComment> {
  return apiRequest<ProjectComment>(`/projects/${projectId}/comments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateProjectComment(
  commentId: string,
  payload: { body: string },
): Promise<ProjectComment> {
  return apiRequest<ProjectComment>(`/comments/${commentId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteProjectComment(commentId: string): Promise<void> {
  await apiRequest<void>(`/comments/${commentId}`, { method: "DELETE" });
}

export async function getCommentReactions(
  commentId: string,
): Promise<CommentReaction[]> {
  return apiRequest<CommentReaction[]>(`/comments/${commentId}/reactions`);
}

export type ToggleReactionResult = { removed: true } | CommentReaction;

export async function toggleCommentReaction(
  commentId: string,
  payload: { userId: string; type: ReactionType },
): Promise<ToggleReactionResult> {
  return apiRequest<ToggleReactionResult>(`/comments/${commentId}/reactions`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
