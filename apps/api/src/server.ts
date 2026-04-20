import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import bcrypt from "bcrypt";
import { z } from "zod";
import http from "http";
import { Server as IOServer } from "socket.io";
import {
  PrismaClient,
  ProjectDepartment,
  ProjectStatus,
  CommentKind,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);

const server = http.createServer(app);
const io = new IOServer(server, {
  cors: { origin: "http://localhost:5173", credentials: true },
});

function isWeekend(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6; // Sun / Sat
}

function addWorkingDaysInclusive(
  start: Date,
  workingDays: number,
  region: HolidayRegion = "DE-SH",
) {
  const d = new Date(start);
  d.setHours(0, 0, 0, 0);

  let counted = isNonWorkingDay(d, region) ? 0 : 1;

  while (counted < workingDays) {
    d.setDate(d.getDate() + 1);
    if (!isNonWorkingDay(d, region)) counted++;
  }

  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}
function moveByWorkingDays(date: Date, delta: number) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  if (delta === 0) return d;

  const step = delta > 0 ? 1 : -1;
  let remaining = Math.abs(delta);

  while (remaining > 0) {
    d.setDate(d.getDate() + step);
    if (!isWeekend(d)) {
      remaining--;
    }
  }

  return d;
}

function countWorkingDaysInclusiveFromDates(
  start: Date,
  endExclusive: Date,
  region: HolidayRegion = "DE-SH",
) {
  const d = new Date(start);
  d.setHours(0, 0, 0, 0);

  const end = new Date(endExclusive);
  end.setHours(0, 0, 0, 0);

  let count = 0;
  while (d < end) {
    if (!isNonWorkingDay(d, region)) count++;
    d.setDate(d.getDate() + 1);
  }

  return Math.max(1, count);
}

function formatProjectStatusLabel(status: string | null | undefined) {
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
      return status ?? "—";
  }
}

function formatDateOnly(value: Date | string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
function formatShortDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type HolidayRegion = "DE" | "DE-SH";

function isoDateOnlyLocal(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysLocal(base: Date, days: number) {
  const x = new Date(base);
  x.setDate(x.getDate() + days);
  x.setHours(0, 0, 0, 0);
  return x;
}

function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(year, month - 1, day);
}

function getGermanHolidayMap(year: number, region: HolidayRegion = "DE-SH") {
  const easter = easterSunday(year);

  const entries: Array<[string, string]> = [
    [`${year}-01-01`, "New Year's Day"],
    [`${year}-05-01`, "Labour Day"],
    [`${year}-10-03`, "German Unity Day"],
    [`${year}-12-25`, "Christmas Day"],
    [`${year}-12-26`, "2nd Day of Christmas"],
    [isoDateOnlyLocal(addDaysLocal(easter, -2)), "Good Friday"],
    [isoDateOnlyLocal(addDaysLocal(easter, 1)), "Easter Monday"],
    [isoDateOnlyLocal(addDaysLocal(easter, 39)), "Ascension Day"],
    [isoDateOnlyLocal(addDaysLocal(easter, 50)), "Whit Monday"],
  ];

  if (region === "DE-SH") {
    entries.push([`${year}-10-31`, "Reformation Day"]);
  }

  return new Map(entries);
}

function isHoliday(date: Date, region: HolidayRegion = "DE-SH") {
  const map = getGermanHolidayMap(date.getFullYear(), region);
  return map.has(isoDateOnlyLocal(date));
}

function isNonWorkingDay(date: Date, region: HolidayRegion = "DE-SH") {
  const day = date.getDay();
  return day === 0 || day === 6 || isHoliday(date, region);
}
async function getSystemAuthorIdForProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  });

  if (project?.ownerId) return project.ownerId;

  const fallbackUser = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  return fallbackUser?.id ?? null;
}
/** AUTH **/
app.post("/auth/login", async (req, res) => {
  const schema = z.object({
    username: z.string(),
    password: z.string(),
  });
  const { username, password } = schema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  res.json({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

/** PROJECTS **/
app.get("/projects", async (_req, res) => {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      owner: {
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      },
      projectManager: {
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      },
      assignments: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
            },
          },
        },
        orderBy: { startDate: "asc" },
      },
    },
  });

  res.json(projects);
});

app.post("/projects", async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    colorKey: z.string().min(1).optional(),
    ownerId: z.string().min(1).optional(),

    status: z.nativeEnum(ProjectStatus).optional(),
    department: z.nativeEnum(ProjectDepartment).optional(),
    description: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    projectManagerId: z.string().optional().nullable(),
    requesterName: z.string().optional().nullable(),
    contactPersonName: z.string().optional().nullable(),
    startDate: z.string().optional().nullable(),
    dueDate: z.string().optional().nullable(),
  });

  const parsed = schema.parse(req.body);

  const project = await prisma.project.create({
    data: {
      name: parsed.name,
      colorKey: parsed.colorKey ?? "poc",
      ownerId: parsed.ownerId ?? null,

      status: parsed.status ?? ProjectStatus.PLANNED,
      department: parsed.department ?? ProjectDepartment.OTHER,
      description: parsed.description ?? null,
      notes: parsed.notes ?? null,
      projectManagerId: parsed.projectManagerId ?? null,
      requesterName: parsed.requesterName ?? null,
      contactPersonName: parsed.contactPersonName ?? null,
      startDate: parsed.startDate ? new Date(parsed.startDate) : null,
      dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null,
    },
    include: {
      owner: {
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      },
      projectManager: {
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      },
      assignments: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
            },
          },
        },
        orderBy: { startDate: "asc" },
      },
    },
  });

  res.status(201).json(project);
});

app.patch("/projects/:id", async (req, res) => {
  const schema = z.object({
    name: z.string().min(1).optional(),
    colorKey: z.string().min(1).optional(),

    status: z.nativeEnum(ProjectStatus).optional(),
    department: z.nativeEnum(ProjectDepartment).optional(),
    description: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    ownerId: z.string().optional().nullable(),
    projectManagerId: z.string().optional().nullable(),
    requesterName: z.string().optional().nullable(),
    contactPersonName: z.string().optional().nullable(),
    startDate: z.string().optional().nullable(),
    dueDate: z.string().optional().nullable(),
  });

  const parsed = schema.parse(req.body);

  const existing = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      projectManager: {
        select: {
          id: true,
          displayName: true,
        },
      },
      owner: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
  });

  if (!existing) {
    return res.status(404).json({ error: "Project not found" });
  }

  const data: any = {};

  if (parsed.name !== undefined) data.name = parsed.name;
  if (parsed.colorKey !== undefined) data.colorKey = parsed.colorKey;
  if (parsed.status !== undefined) data.status = parsed.status;
  if (parsed.department !== undefined) data.department = parsed.department;
  if (parsed.description !== undefined) data.description = parsed.description;
  if (parsed.notes !== undefined) data.notes = parsed.notes;
  if (parsed.ownerId !== undefined) data.ownerId = parsed.ownerId;
  if (parsed.projectManagerId !== undefined) {
    data.projectManagerId = parsed.projectManagerId;
  }
  if (parsed.requesterName !== undefined) {
    data.requesterName = parsed.requesterName;
  }
  if (parsed.contactPersonName !== undefined) {
    data.contactPersonName = parsed.contactPersonName;
  }
  if (parsed.startDate !== undefined) {
    data.startDate = parsed.startDate ? new Date(parsed.startDate) : null;
  }
  if (parsed.dueDate !== undefined) {
    data.dueDate = parsed.dueDate ? new Date(parsed.dueDate) : null;
  }

  const project = await prisma.project.update({
    where: { id: req.params.id },
    data,
    include: {
      owner: {
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      },
      projectManager: {
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      },
      assignments: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
            },
          },
        },
        orderBy: { startDate: "asc" },
      },
    },
  });
  // console.log("PATCH project saved:", {
  //   id: project.id,
  //   startDate: project.startDate,
  //   dueDate: project.dueDate,
  //   status: project.status,
  // });
  const systemEvents: Array<{
    body: string;
    meta: any;
  }> = [];

  if (parsed.status !== undefined && parsed.status !== existing.status) {
    systemEvents.push({
      body: `Status changed from ${formatProjectStatusLabel(existing.status)} to ${formatProjectStatusLabel(parsed.status)}`,
      meta: {
        event: "status_changed",
        from: existing.status,
        to: parsed.status,
      },
    });
  }

  const existingDueDateIso = existing.dueDate
    ? existing.dueDate.toISOString()
    : null;
  const parsedDueDateIso =
    parsed.dueDate === undefined
      ? undefined
      : parsed.dueDate
        ? new Date(parsed.dueDate).toISOString()
        : null;

  if (parsed.dueDate !== undefined && parsedDueDateIso !== existingDueDateIso) {
    systemEvents.push({
      body: `Due date changed from ${formatDateOnly(existing.dueDate)} to ${formatDateOnly(parsed.dueDate)}`,
      meta: {
        event: "due_date_changed",
        from: existingDueDateIso,
        to: parsedDueDateIso,
      },
    });
  }

  if (parsed.projectManagerId !== undefined) {
    const oldPm = existing.projectManager?.displayName ?? "—";
    const newPm =
      project.projectManager?.displayName ??
      (parsed.projectManagerId ? "Unknown" : "—");

    if (
      (existing.projectManagerId ?? null) !== (parsed.projectManagerId ?? null)
    ) {
      systemEvents.push({
        body: `Project manager changed from ${oldPm} to ${newPm}`,
        meta: {
          event: "project_manager_changed",
          from: existing.projectManagerId ?? null,
          to: parsed.projectManagerId ?? null,
        },
      });
    }
  }

  if (systemEvents.length > 0) {
    const fallbackAuthor = await prisma.user.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    const authorId = existing.ownerId ?? project.ownerId ?? fallbackAuthor?.id;

    if (authorId) {
      await prisma.comment.createMany({
        data: systemEvents.map((event) => ({
          projectId: req.params.id,
          authorId,
          body: event.body,
          kind: CommentKind.SYSTEM,
          meta: event.meta,
        })),
      });
    }
  }

  res.json(project);
});

app.delete("/projects/:id", async (req, res) => {
  const projectId = req.params.id;

  await prisma.assignment.deleteMany({
    where: { projectId },
  });

  await prisma.commentReaction.deleteMany({
    where: {
      comment: {
        projectId,
      },
    },
  });

  await prisma.commentAttachment.deleteMany({
    where: {
      comment: {
        projectId,
      },
    },
  });

  await prisma.comment.deleteMany({
    where: { projectId },
  });

  await prisma.timeEntry.deleteMany({
    where: { projectId },
  });

  await prisma.project.delete({
    where: { id: projectId },
  });

  res.status(204).send();
});

/** USERS (lista pentru Plan) **/
app.get("/users", async (_req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
    },
    orderBy: { displayName: "asc" },
  });

  res.json(users);
});

/** PROJECT COMMENTS **/
/** PROJECT COMMENTS **/
app.get("/projects/:id/comments", async (req, res) => {
  try {
    const items = await prisma.comment.findMany({
      where: { projectId: req.params.id },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            role: true,
          },
        },
        attachments: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    res.json(items);
  } catch (err: any) {
    console.error("GET /projects/:id/comments failed:", err);
    res.status(500).json({ error: err?.message ?? "Failed to load comments" });
  }
});

app.post("/projects/:id/comments", async (req, res) => {
  try {
    const schema = z.object({
      authorId: z.string().min(1),
      body: z.string().min(1),
      attachments: z
        .array(
          z.object({
            type: z.string().min(1),
            url: z.string().url(),
            label: z.string().optional().nullable(),
          }),
        )
        .optional(),
    });

    const parsed = schema.parse(req.body);

    const item = await prisma.comment.create({
      data: {
        projectId: req.params.id,
        authorId: parsed.authorId,
        body: parsed.body,
        attachments: parsed.attachments?.length
          ? {
              create: parsed.attachments.map((a) => ({
                type: a.type,
                url: a.url,
                label: a.label ?? null,
              })),
            }
          : undefined,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            role: true,
          },
        },
        attachments: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    res.status(201).json(item);
  } catch (err: any) {
    console.error("POST /projects/:id/comments failed:", err);
    res.status(500).json({ error: err?.message ?? "Failed to create comment" });
  }
});

/** COMMENT REACTIONS **/
app.get("/comments/:id/reactions", async (req, res) => {
  try {
    const items = await prisma.commentReaction.findMany({
      where: { commentId: req.params.id },
      orderBy: { createdAt: "asc" },
    });

    res.json(items);
  } catch (err: any) {
    console.error("GET /comments/:id/reactions failed:", err);
    res.status(500).json({ error: err?.message ?? "Failed to load reactions" });
  }
});

app.post("/comments/:id/reactions", async (req, res) => {
  try {
    const schema = z.object({
      userId: z.string().min(1),
      type: z.enum(["LIKE", "HEART", "CLAP", "WOW", "CHECK"]),
    });

    const parsed = schema.parse(req.body);

    const existing = await prisma.commentReaction.findUnique({
      where: {
        commentId_userId_type: {
          commentId: req.params.id,
          userId: parsed.userId,
          type: parsed.type as any,
        },
      },
    });

    if (existing) {
      await prisma.commentReaction.delete({
        where: { id: existing.id },
      });

      return res.json({ removed: true });
    }

    const created = await prisma.commentReaction.create({
      data: {
        commentId: req.params.id,
        userId: parsed.userId,
        type: parsed.type as any,
      },
    });

    res.status(201).json(created);
  } catch (err: any) {
    console.error("POST /comments/:id/reactions failed:", err);
    res.status(500).json({ error: err?.message ?? "Failed to react" });
  }
});
app.patch("/comments/:id", async (req, res) => {
  try {
    const schema = z.object({
      body: z.string().min(1),
    });

    const parsed = schema.parse(req.body);

    const existing = await prisma.comment.findUnique({
      where: { id: req.params.id },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            role: true,
          },
        },
        attachments: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!existing) {
      return res.status(404).json({ error: "Comment not found" });
    }

    if (existing.kind === CommentKind.SYSTEM) {
      return res
        .status(400)
        .json({ error: "System comments cannot be edited" });
    }

    const updated = await prisma.comment.update({
      where: { id: req.params.id },
      data: {
        body: parsed.body,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            role: true,
          },
        },
        attachments: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    res.json(updated);
  } catch (err: any) {
    console.error("PATCH /comments/:id failed:", err);
    res.status(500).json({ error: err?.message ?? "Failed to update comment" });
  }
});
app.delete("/comments/:id", async (req, res) => {
  try {
    const existing = await prisma.comment.findUnique({
      where: { id: req.params.id },
      include: {
        reactions: true,
        attachments: true,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: "Comment not found" });
    }

    if (existing.kind === CommentKind.SYSTEM) {
      return res
        .status(400)
        .json({ error: "System comments cannot be deleted" });
    }

    await prisma.commentReaction.deleteMany({
      where: { commentId: req.params.id },
    });

    await prisma.commentAttachment.deleteMany({
      where: { commentId: req.params.id },
    });

    await prisma.comment.delete({
      where: { id: req.params.id },
    });

    res.status(204).end();
  } catch (err: any) {
    console.error("DELETE /comments/:id failed:", err);
    res.status(500).json({ error: err?.message ?? "Failed to delete comment" });
  }
});

/** ASSIGNMENTS **/
app.get("/assignments", async (req, res) => {
  try {
    const schema = z.object({
      from: z.string().optional(),
      to: z.string().optional(),
    });

    const parsed = schema.parse(req.query);

    const where: any = {};

    if (parsed.from || parsed.to) {
      const and: any[] = [];

      if (parsed.from) {
        and.push({
          endDate: {
            gt: new Date(parsed.from),
          },
        });
      }

      if (parsed.to) {
        and.push({
          startDate: {
            lt: new Date(parsed.to),
          },
        });
      }

      if (and.length > 0) {
        where.AND = and;
      }
    }

    const items = await prisma.assignment.findMany({
      where,
      orderBy: { startDate: "asc" },
    });

    res.json(items);
  } catch (err: any) {
    console.error("GET /assignments failed:", err);
    res
      .status(500)
      .json({ error: err?.message ?? "Failed to load assignments" });
  }
});

app.post("/assignments", async (req, res) => {
  try {
    const schema = z.object({
      userId: z.string().min(1),
      projectId: z.string().min(1),
      startDate: z.string().min(1),
      lengthDays: z.number().int().min(1).default(1),
    });

    const { userId, projectId, startDate, lengthDays } = schema.parse(req.body);

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = addWorkingDaysInclusive(start, lengthDays, "DE-SH");

    const item = await prisma.assignment.create({
      data: {
        userId,
        projectId,
        startDate: start,
        endDate: end,
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const authorId = await getSystemAuthorIdForProject(projectId);

    if (authorId) {
      await prisma.comment.create({
        data: {
          projectId,
          authorId,
          kind: CommentKind.SYSTEM,
          body: `${item.user.displayName} was assigned from ${formatShortDate(item.startDate)} to ${formatShortDate(item.endDate)}`,
          meta: {
            event: "assignment_added",
            assignmentId: item.id,
            userId: item.userId,
            startDate: item.startDate,
            endDate: item.endDate,
          },
        },
      });
    }

    res.status(201).json(item);
  } catch (err: any) {
    console.error("POST /assignments failed:", err);
    res
      .status(500)
      .json({ error: err?.message ?? "Failed to create assignment" });
  }
});

app.patch("/assignments/:id", async (req, res) => {
  try {
    const schema = z.object({
      startDate: z.string().optional(),
      lengthDays: z.number().int().min(1).optional(),
    });

    const { startDate, lengthDays } = schema.parse(req.body);

    const existing = await prisma.assignment.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });

    if (!existing) {
      return res.status(404).json({ error: "Not found" });
    }

    const start = startDate
      ? new Date(startDate)
      : new Date(existing.startDate);
    start.setHours(0, 0, 0, 0);

    const currentLength = countWorkingDaysInclusiveFromDates(
      new Date(existing.startDate),
      new Date(existing.endDate),
      "DE-SH",
    );

    const nextLength = lengthDays ?? currentLength;
    const end = addWorkingDaysInclusive(start, nextLength, "DE-SH");

    const item = await prisma.assignment.update({
      where: { id: req.params.id },
      data: {
        startDate: start,
        endDate: end,
      },
    });

    const authorId = await getSystemAuthorIdForProject(existing.projectId);

    if (authorId) {
      await prisma.comment.create({
        data: {
          projectId: existing.projectId,
          authorId,
          kind: CommentKind.SYSTEM,
          body: `${existing.user.displayName}'s assignment changed from ${formatShortDate(existing.startDate)} to ${formatShortDate(item.startDate)}`,
          meta: {
            event: "assignment_updated",
            assignmentId: existing.id,
            userId: existing.userId,
            fromStartDate: existing.startDate,
            fromEndDate: existing.endDate,
            toStartDate: item.startDate,
            toEndDate: item.endDate,
          },
        },
      });
    }

    res.json(item);
  } catch (err: any) {
    console.error("PATCH /assignments/:id failed:", err);
    res
      .status(500)
      .json({ error: err?.message ?? "Failed to update assignment" });
  }
});

app.delete("/assignments/:id", async (req, res) => {
  try {
    const existing = await prisma.assignment.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });

    if (!existing) {
      return res.status(404).json({ error: "Not found" });
    }

    await prisma.assignment.delete({
      where: { id: req.params.id },
    });

    const authorId = await getSystemAuthorIdForProject(existing.projectId);

    if (authorId) {
      await prisma.comment.create({
        data: {
          projectId: existing.projectId,
          authorId,
          kind: CommentKind.SYSTEM,
          body: `${existing.user.displayName}'s assignment was removed`,
          meta: {
            event: "assignment_removed",
            assignmentId: existing.id,
            userId: existing.userId,
            startDate: existing.startDate,
            endDate: existing.endDate,
          },
        },
      });
    }

    res.status(204).end();
  } catch (err: any) {
    console.error("DELETE /assignments/:id failed:", err);
    res
      .status(500)
      .json({ error: err?.message ?? "Failed to delete assignment" });
  }
});
server.listen(4000, () => {
  console.log("API running on http://localhost:4000");
});
