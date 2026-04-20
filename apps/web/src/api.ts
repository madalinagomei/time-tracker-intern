const API_BASE = "http://localhost:4000";

export type Me = {
  id: string;
  username: string;
  displayName: string;
  role: "USER" | "ADMIN";
  mustChangePassword: boolean;
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

export type ProjectComment = {
  id: string;
  projectId: string;
  authorId: string;
  body: string;
  kind: CommentKind;
  meta?: any;
  progressPercent?: number | null;
  createdAt: string;
  updatedAt?: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    role: "USER" | "ADMIN";
  };
  attachments?: CommentAttachment[];
};

export type ReactionType = "LIKE" | "HEART" | "CLAP" | "WOW" | "CHECK";

export type CommentReaction = {
  id: string;
  commentId: string;
  userId: string;
  type: ReactionType;
  createdAt: string;
};

export async function getCommentReactions(
  commentId: string,
): Promise<CommentReaction[]> {
  const res = await fetch(`${API_BASE}/comments/${commentId}/reactions`, {
    credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  return res.json();
}

export type ToggleReactionResult = { removed: true } | CommentReaction;

export async function toggleCommentReaction(
  commentId: string,
  payload: {
    userId: string;
    type: ReactionType;
  },
): Promise<ToggleReactionResult> {
  const res = await fetch(`${API_BASE}/comments/${commentId}/reactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function login(username: string, password: string): Promise<Me> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  return res.json();
}

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

export type ProjectAssignmentUser = {
  id: string;
  username: string;
  displayName: string;
};

export type ProjectAssignment = {
  id: string;
  userId: string;
  projectId: string;
  startDate: string;
  endDate: string;
  createdAt?: string;
  updatedAt?: string;
  user: ProjectAssignmentUser;
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

export async function getProjects(): Promise<Project[]> {
  const res = await fetch(`${API_BASE}/projects`, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
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
  const body: any = {
    name,
    colorKey,
    ...metadata,
  };

  if (ownerId) body.ownerId = ownerId;

  const res = await fetch(`${API_BASE}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function getUsers(): Promise<UserRow[]> {
  const res = await fetch(`${API_BASE}/users`, {
    credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function updateProjectComment(
  commentId: string,
  payload: {
    body: string;
  },
): Promise<ProjectComment> {
  const res = await fetch(`${API_BASE}/comments/${commentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function deleteProjectComment(commentId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/comments/${commentId}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
}

export type AssignmentRow = {
  id: string;
  userId: string;
  projectId: string;
  startDate: string;
  endDate: string;
  createdAt?: string;
  updatedAt?: string;
};

export async function getAssignments(
  from?: string,
  to?: string,
): Promise<AssignmentRow[]> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  const url = `${API_BASE}/assignments${params.toString() ? `?${params}` : ""}`;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function createAssignment(
  userId: string,
  projectId: string,
  startDate: string,
  lengthDays = 1,
): Promise<AssignmentRow> {
  const res = await fetch(`${API_BASE}/assignments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ userId, projectId, startDate, lengthDays }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function updateAssignment(
  id: string,
  patch: {
    startDate?: string;
    lengthDays?: number;
  },
): Promise<AssignmentRow> {
  const res = await fetch(`${API_BASE}/assignments/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(patch),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function deleteAssignment(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/assignments/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
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
  const res = await fetch(`${API_BASE}/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(patch),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function getProjectComments(
  projectId: string,
): Promise<ProjectComment[]> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/comments`, {
    credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function createProjectComment(
  projectId: string,
  payload: {
    authorId: string;
    body: string;
    attachments?: Array<{
      type: string;
      url: string;
      label?: string | null;
    }>;
  },
): Promise<ProjectComment> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/projects/${id}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
}
