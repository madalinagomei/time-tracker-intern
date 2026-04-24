const API_BASE = "http://localhost:4000";
const DEMO_AUTH_STORAGE_KEY = "timeline-demo-session";

export const DEMO_LOGIN_PASSWORD = "demo123";

export type Me = {
  id: string;
  username: string;
  displayName: string;
  role: "USER" | "ADMIN";
  mustChangePassword: boolean;
};

const DEMO_USERS: Record<string, Me> = {
  emilian: {
    id: "emilian",
    username: "emilian",
    displayName: "Emilian",
    role: "ADMIN",
    mustChangePassword: false,
  },
  pm1: {
    id: "pm1",
    username: "pm1",
    displayName: "PM 1",
    role: "ADMIN",
    mustChangePassword: false,
  },
  user1: {
    id: "user1",
    username: "user1",
    displayName: "User 1",
    role: "USER",
    mustChangePassword: false,
  },
};

function storeDemoSession(me: Me | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!me) {
    window.localStorage.removeItem(DEMO_AUTH_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(DEMO_AUTH_STORAGE_KEY, JSON.stringify(me));
}

export function getStoredDemoSession(): Me | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(DEMO_AUTH_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<Me>;
    const demoUser = parsed.username ? DEMO_USERS[parsed.username] : null;
    return demoUser ? { ...demoUser } : null;
  } catch {
    window.localStorage.removeItem(DEMO_AUTH_STORAGE_KEY);
    return null;
  }
}

export function clearStoredDemoSession() {
  storeDemoSession(null);
}

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
  // Temporary frontend-only demo auth. Replace this with the real backend
  // login request later when the deployed demo should use live auth again.
  const normalizedUsername = username.trim().toLowerCase();
  const demoUser = DEMO_USERS[normalizedUsername];

  if (!demoUser || password !== DEMO_LOGIN_PASSWORD) {
    throw new Error("Invalid username or password");
  }

  const session = { ...demoUser };
  storeDemoSession(session);
  return session;
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

const DEMO_DATA_STORAGE_KEY = "timeline-demo-data-v1";

type DemoState = {
  users: UserRow[];
  projects: Project[];
  assignments: AssignmentRow[];
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function startOfDayLocal(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDaysLocal(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return startOfDayLocal(next);
}

function isWeekendLocal(date: Date) {
  return date.getDay() === 0 || date.getDay() === 6;
}

function addWorkingDaysInclusiveLocal(start: Date, workingDays: number) {
  const cursor = startOfDayLocal(start);
  let counted = isWeekendLocal(cursor) ? 0 : 1;

  while (counted < workingDays) {
    cursor.setDate(cursor.getDate() + 1);
    if (!isWeekendLocal(cursor)) {
      counted += 1;
    }
  }

  cursor.setDate(cursor.getDate() + 1);
  return startOfDayLocal(cursor);
}

function countWorkingDaysLocal(start: Date, endExclusive: Date) {
  const cursor = startOfDayLocal(start);
  const end = startOfDayLocal(endExclusive);
  let count = 0;

  while (cursor < end) {
    if (!isWeekendLocal(cursor)) {
      count += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

function createDemoId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getDemoProjectPerson(
  userId: string | null | undefined,
  state: DemoState,
): ProjectPerson | null {
  if (!userId) {
    return null;
  }

  const user = state.users.find((item) => item.id === userId);

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
  };
}

function getDemoAssignmentUser(
  userId: string,
  state: DemoState,
): ProjectAssignmentUser {
  const user = state.users.find((item) => item.id === userId);

  return {
    id: user?.id ?? userId,
    username: user?.username ?? userId,
    displayName: user?.displayName ?? userId,
  };
}

function enrichProject(project: Project, state: DemoState): Project {
  return {
    ...project,
    owner: getDemoProjectPerson(project.ownerId, state),
    projectManager: getDemoProjectPerson(project.projectManagerId, state),
    assignments: state.assignments
      .filter((assignment) => assignment.projectId === project.id)
      .sort(
        (left, right) =>
          new Date(left.startDate).getTime() - new Date(right.startDate).getTime(),
      )
      .map((assignment) => ({
        ...assignment,
        user: getDemoAssignmentUser(assignment.userId, state),
      })),
  };
}

function buildInitialDemoState(): DemoState {
  const users: UserRow[] = Object.values(DEMO_USERS).map((user) => ({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  }));

  const today = startOfDayLocal(new Date());
  const nowIso = today.toISOString();

  const projects: Project[] = [
    {
      id: "project-hemostasis-rollout",
      name: "Hemostasis rollout",
      colorKey: "hemostasis",
      ownerId: "pm1",
      status: "ACTIVE",
      department: "HEMOSTASIS",
      description: "Q2 product launch planning and training rollout.",
      notes: "Align launch, training, and support materials.",
      projectManagerId: "pm1",
      requesterName: "Clinical Product Team",
      contactPersonName: "Andrea Schaal",
      startDate: addDaysLocal(today, -12).toISOString(),
      dueDate: addDaysLocal(today, 28).toISOString(),
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: "project-urinalysis-campaign",
      name: "MC-761 launch",
      colorKey: "urinalysis",
      ownerId: "emilian",
      status: "ACTIVE",
      department: "URINALYSIS",
      description: "Launch assets and visual pack for MC-761.",
      notes: "Keep campaign materials aligned with booth graphics.",
      projectManagerId: "pm1",
      requesterName: "Marketing",
      contactPersonName: "Emilian",
      startDate: addDaysLocal(today, -5).toISOString(),
      dueDate: addDaysLocal(today, 24).toISOString(),
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: "project-flow-cytometry-summit",
      name: "Flow Cytometry summit",
      colorKey: "flow-cytometry",
      ownerId: "user1",
      status: "PLANNED",
      department: "FLOW_CYTOMETRY",
      description: "Summit support materials and event follow-ups.",
      notes: "Prep deck, promo visuals, and post-event mailer.",
      projectManagerId: "pm1",
      requesterName: "Events Team",
      contactPersonName: "User 1",
      startDate: addDaysLocal(today, 2).toISOString(),
      dueDate: addDaysLocal(today, 40).toISOString(),
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: "project-software-refresh",
      name: "Software refresh",
      colorKey: "software",
      ownerId: "emilian",
      status: "ACTIVE",
      department: "SOFTWARE",
      description: "Refresh timeline demo assets and product visuals.",
      notes: "Coordinate with PM before publishing new media.",
      projectManagerId: "emilian",
      requesterName: "Product",
      contactPersonName: "Emilian",
      startDate: addDaysLocal(today, -8).toISOString(),
      dueDate: addDaysLocal(today, 21).toISOString(),
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: "project-clinical-chemistry-kit",
      name: "Clinical chemistry kit",
      colorKey: "clinical-chemistry",
      ownerId: "pm1",
      status: "ON_HOLD",
      department: "CLINICAL_CHEMISTRY",
      description: "Packaging refresh and sample kit follow-up.",
      notes: "Waiting on revised product naming.",
      projectManagerId: "pm1",
      requesterName: "Sales",
      contactPersonName: "PM 1",
      startDate: addDaysLocal(today, 7).toISOString(),
      dueDate: addDaysLocal(today, 48).toISOString(),
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: "project-holiday",
      name: "Holiday",
      colorKey: "leave-vacation",
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
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: "project-sick",
      name: "Sick",
      colorKey: "leave-sick",
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
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: "project-training",
      name: "Training",
      colorKey: "leave-training",
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
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: "project-ooo",
      name: "Out of Office",
      colorKey: "leave-ooo",
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
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const assignmentSeeds = [
    { id: "assignment-1", userId: "emilian", projectId: "project-hemostasis-rollout", offset: -6, lengthDays: 7 },
    { id: "assignment-2", userId: "emilian", projectId: "project-software-refresh", offset: 5, lengthDays: 6 },
    { id: "assignment-3", userId: "emilian", projectId: "project-holiday", offset: 18, lengthDays: 5 },
    { id: "assignment-4", userId: "pm1", projectId: "project-urinalysis-campaign", offset: -3, lengthDays: 8 },
    { id: "assignment-5", userId: "pm1", projectId: "project-flow-cytometry-summit", offset: 12, lengthDays: 6 },
    { id: "assignment-6", userId: "pm1", projectId: "project-training", offset: 3, lengthDays: 2 },
    { id: "assignment-7", userId: "user1", projectId: "project-software-refresh", offset: -9, lengthDays: 5 },
    { id: "assignment-8", userId: "user1", projectId: "project-clinical-chemistry-kit", offset: 9, lengthDays: 9 },
    { id: "assignment-9", userId: "user1", projectId: "project-sick", offset: 1, lengthDays: 2 },
    { id: "assignment-10", userId: "pm1", projectId: "project-hemostasis-rollout", offset: 22, lengthDays: 4 },
    { id: "assignment-11", userId: "emilian", projectId: "project-ooo", offset: 29, lengthDays: 3 },
    { id: "assignment-12", userId: "user1", projectId: "project-urinalysis-campaign", offset: 20, lengthDays: 5 },
  ];

  const assignments: AssignmentRow[] = assignmentSeeds.map((seed) => {
    const startDate = addDaysLocal(today, seed.offset);
    const endDate = addWorkingDaysInclusiveLocal(startDate, seed.lengthDays);

    return {
      id: seed.id,
      userId: seed.userId,
      projectId: seed.projectId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  });

  return {
    users,
    projects,
    assignments,
  };
}

function readDemoState(): DemoState {
  const fallback = buildInitialDemoState();

  if (typeof window === "undefined") {
    return fallback;
  }

  const raw = window.localStorage.getItem(DEMO_DATA_STORAGE_KEY);

  if (!raw) {
    window.localStorage.setItem(
      DEMO_DATA_STORAGE_KEY,
      JSON.stringify(fallback),
    );
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DemoState>;

    if (
      !Array.isArray(parsed.users) ||
      !Array.isArray(parsed.projects) ||
      !Array.isArray(parsed.assignments)
    ) {
      throw new Error("Invalid demo data");
    }

    return {
      users: parsed.users as UserRow[],
      projects: parsed.projects as Project[],
      assignments: parsed.assignments as AssignmentRow[],
    };
  } catch {
    window.localStorage.setItem(
      DEMO_DATA_STORAGE_KEY,
      JSON.stringify(fallback),
    );
    return fallback;
  }
}

function writeDemoState(state: DemoState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(DEMO_DATA_STORAGE_KEY, JSON.stringify(state));
}

function getDemoProjects(state: DemoState) {
  return state.projects.map((project) => enrichProject(project, state));
}

export async function getProjects(): Promise<Project[]> {
  const state = readDemoState();
  return clone(getDemoProjects(state));
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
  const state = readDemoState();
  const nowIso = new Date().toISOString();
  const project: Project = {
    id: createDemoId("project"),
    name,
    colorKey: colorKey ?? "software",
    ownerId: ownerId ?? null,
    status: metadata?.status ?? "PLANNED",
    department: metadata?.department ?? "OTHER",
    description: metadata?.description ?? null,
    notes: metadata?.notes ?? null,
    projectManagerId: metadata?.projectManagerId ?? null,
    requesterName: metadata?.requesterName ?? null,
    contactPersonName: metadata?.contactPersonName ?? null,
    startDate: metadata?.startDate ?? null,
    dueDate: metadata?.dueDate ?? null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  state.projects.unshift(project);
  writeDemoState(state);

  return clone(enrichProject(project, state));
}

export async function getUsers(): Promise<UserRow[]> {
  return clone(readDemoState().users);
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
  laneIndex?: number;
  createdAt?: string;
  updatedAt?: string;
};

export async function getAssignments(
  from?: string,
  to?: string,
): Promise<AssignmentRow[]> {
  const state = readDemoState();
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;

  const assignments = state.assignments
    .filter((assignment) => {
      const startDate = new Date(assignment.startDate);
      const endDate = new Date(assignment.endDate);

      if (fromDate && endDate <= fromDate) {
        return false;
      }

      if (toDate && startDate >= toDate) {
        return false;
      }

      return true;
    })
    .sort(
      (left, right) =>
        new Date(left.startDate).getTime() - new Date(right.startDate).getTime(),
    );

  return clone(assignments);
}

export async function createAssignment(
  userId: string,
  projectId: string,
  startDate: string,
  lengthDays = 1,
  options?: {
    laneIndex?: number;
  },
): Promise<AssignmentRow> {
  const state = readDemoState();
  const createdAt = new Date().toISOString();
  const start = startOfDayLocal(new Date(startDate));
  const assignment: AssignmentRow = {
    id: createDemoId("assignment"),
    userId,
    projectId,
    startDate: start.toISOString(),
    endDate: addWorkingDaysInclusiveLocal(
      start,
      Math.max(1, lengthDays),
    ).toISOString(),
    laneIndex: options?.laneIndex,
    createdAt,
    updatedAt: createdAt,
  };

  state.assignments.unshift(assignment);
  writeDemoState(state);

  return clone(assignment);
}

export async function updateAssignment(
  id: string,
  patch: {
    startDate?: string;
    lengthDays?: number;
    userId?: string;
    laneIndex?: number;
  },
): Promise<AssignmentRow> {
  const state = readDemoState();
  const existing = state.assignments.find((assignment) => assignment.id === id);

  if (!existing) {
    throw new Error("Assignment not found");
  }

  const nextStart = patch.startDate
    ? startOfDayLocal(new Date(patch.startDate))
    : startOfDayLocal(new Date(existing.startDate));
  const nextLength =
    patch.lengthDays ??
    Math.max(
      1,
      countWorkingDaysLocal(
        new Date(existing.startDate),
        new Date(existing.endDate),
      ),
    );
  const nextUserId = patch.userId ?? existing.userId;
  const nextLaneIndex = Object.prototype.hasOwnProperty.call(patch, "laneIndex")
    ? patch.laneIndex
    : existing.laneIndex;

  const updated: AssignmentRow = {
    ...existing,
    userId: nextUserId,
    startDate: nextStart.toISOString(),
    endDate: addWorkingDaysInclusiveLocal(nextStart, nextLength).toISOString(),
    laneIndex: nextLaneIndex,
    updatedAt: new Date().toISOString(),
  };

  state.assignments = state.assignments.map((assignment) =>
    assignment.id === id ? updated : assignment,
  );
  writeDemoState(state);

  return clone(updated);
}

export async function deleteAssignment(id: string): Promise<void> {
  const state = readDemoState();
  state.assignments = state.assignments.filter((assignment) => assignment.id !== id);
  writeDemoState(state);
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
  const state = readDemoState();
  const existing = state.projects.find((project) => project.id === id);

  if (!existing) {
    throw new Error("Project not found");
  }

  const updated: Project = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  state.projects = state.projects.map((project) =>
    project.id === id ? updated : project,
  );
  writeDemoState(state);

  return clone(enrichProject(updated, state));
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
  const state = readDemoState();
  state.projects = state.projects.filter((project) => project.id !== id);
  state.assignments = state.assignments.filter(
    (assignment) => assignment.projectId !== id,
  );
  writeDemoState(state);
}
