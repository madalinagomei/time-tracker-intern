import type { AssignmentRow, Project, ProjectDepartment } from "./api";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const DAY_WIDTH = 38;
export const LEFT_COLUMN_WIDTH = 168;
export const TIMELINE_WINDOW_DAYS = 420;
export const TIMELINE_SHIFT_DAYS = 126;
export const TIMELINE_EDGE_BUFFER_DAYS = 70;
export const ROW_OVERSCAN = 8;
export const LANE_HEIGHT = 36;
export const ROW_PADDING_Y = 10;
export const MIN_ROW_HEIGHT = 64;

export type HolidayRegion = "DE" | "DE-SH";
export type TimelineZoomMode = "5w" | "3m" | "6m";
export type TimelineDensityMode = "comfortable" | "compact";

export const TIMELINE_ZOOM_OPTIONS: Record<
  TimelineZoomMode,
  {
    label: string;
    targetVisibleDays: number;
    minDayWidth: number;
    maxDayWidth: number;
    fallbackDayWidth: number;
  }
> = {
  "5w": {
    label: "5 weeks",
    targetVisibleDays: 35,
    minDayWidth: DAY_WIDTH,
    maxDayWidth: 56,
    fallbackDayWidth: DAY_WIDTH,
  },
  "3m": {
    label: "3 months",
    targetVisibleDays: 91,
    minDayWidth: 12,
    maxDayWidth: 18,
    fallbackDayWidth: 15,
  },
  "6m": {
    label: "6 months",
    targetVisibleDays: 182,
    minDayWidth: 8,
    maxDayWidth: 12,
    fallbackDayWidth: 8,
  },
};

export const TIMELINE_DENSITY_OPTIONS: Record<
  TimelineDensityMode,
  {
    label: string;
    laneHeight: number;
    rowPaddingY: number;
    barHeight: number;
    minRowHeight: number;
  }
> = {
  comfortable: {
    label: "Comfortable",
    laneHeight: LANE_HEIGHT,
    rowPaddingY: ROW_PADDING_Y,
    barHeight: 32,
    minRowHeight: MIN_ROW_HEIGHT,
  },
  compact: {
    label: "Compact",
    laneHeight: 30,
    rowPaddingY: 8,
    barHeight: 26,
    minRowHeight: 54,
  },
};

export function getTimelineDayWidth(
  zoomMode: TimelineZoomMode,
  viewportWidth: number,
  leftWidth = LEFT_COLUMN_WIDTH,
) {
  const option = TIMELINE_ZOOM_OPTIONS[zoomMode];
  const usableWidth = viewportWidth - leftWidth - 24;

  if (usableWidth <= 0) {
    return option.fallbackDayWidth;
  }

  const idealDayWidth = Math.round(usableWidth / option.targetVisibleDays);

  return Math.max(
    option.minDayWidth,
    Math.min(option.maxDayWidth, idealDayWidth),
  );
}

export type PlanningColorOption = {
  key: string;
  label: string;
  group: "department" | "leave";
  department?: ProjectDepartment;
  icon: string;
  swatchClassName: string;
  softClassName: string;
  pillClassName: string;
  barClassName: string;
};

export type TimelineEntryType = "PROJECT" | "LEAVE";

export type LeaveType =
  | "HOLIDAY"
  | "SICK"
  | "TRAINING"
  | "OUT_OF_OFFICE";

export type TimelineAssignmentLike = Pick<
  AssignmentRow,
  "id" | "userId" | "projectId" | "startDate" | "endDate" | "laneIndex"
> & {
  isDraft?: boolean;
};

export type PositionedAssignment<T extends TimelineAssignmentLike> = {
  assignment: T;
  project: Project;
  leave: boolean;
  startIndex: number;
  endIndex: number;
  clampedStart: number;
  clampedEnd: number;
  clampedLength: number;
};

export type UserRowLayout<T extends TimelineAssignmentLike> = {
  lanes: PositionedAssignment<T>[][];
  laneCount: number;
  rowHeight: number;
};

export const DEPARTMENT_COLOR_OPTIONS: PlanningColorOption[] = [
  {
    key: "haematology",
    label: "Haematology",
    group: "department",
    department: "HAEMATOLOGY",
    icon: "H",
    swatchClassName:
      "bg-gradient-to-br from-rose-200 via-fuchsia-100 to-rose-50 ring-rose-200/90",
    softClassName:
      "bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950/30 dark:text-rose-200 dark:ring-rose-900/50",
    pillClassName:
      "bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-900/50",
    barClassName:
      "border-rose-300/70 bg-rose-300 text-rose-950 shadow-[0_8px_20px_rgba(251,113,133,0.26)] dark:border-rose-700/60 dark:bg-rose-400/90 dark:text-rose-950",
  },
  {
    key: "hemostasis",
    label: "Hemostasis",
    group: "department",
    department: "HEMOSTASIS",
    icon: "He",
    swatchClassName:
      "bg-gradient-to-br from-sky-100 via-blue-50 to-indigo-50 ring-sky-200/90",
    softClassName:
      "bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950/30 dark:text-sky-200 dark:ring-sky-900/50",
    pillClassName:
      "bg-sky-100 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900/50",
    barClassName:
      "border-sky-300/70 bg-sky-300 text-sky-950 shadow-[0_8px_20px_rgba(56,189,248,0.25)] dark:border-sky-700/60 dark:bg-sky-400/90 dark:text-sky-950",
  },
  {
    key: "urinalysis",
    label: "Urinalysis",
    group: "department",
    department: "URINALYSIS",
    icon: "U",
    swatchClassName:
      "bg-gradient-to-br from-amber-100 via-yellow-50 to-amber-50 ring-amber-200/90",
    softClassName:
      "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:ring-amber-900/50",
    pillClassName:
      "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900/50",
    barClassName:
      "border-amber-300/70 bg-amber-300 text-amber-950 shadow-[0_8px_20px_rgba(245,158,11,0.26)] dark:border-amber-700/60 dark:bg-amber-400/90 dark:text-amber-950",
  },
  {
    key: "flow-cytometry",
    label: "Flow Cytometry",
    group: "department",
    department: "FLOW_CYTOMETRY",
    icon: "F",
    swatchClassName:
      "bg-gradient-to-br from-lime-100 via-emerald-50 to-lime-50 ring-lime-200/90",
    softClassName:
      "bg-lime-50 text-lime-800 ring-lime-200 dark:bg-lime-950/30 dark:text-lime-200 dark:ring-lime-900/50",
    pillClassName:
      "bg-lime-100 text-lime-700 ring-lime-200 dark:bg-lime-950/40 dark:text-lime-200 dark:ring-lime-900/50",
    barClassName:
      "border-lime-300/70 bg-lime-300 text-lime-950 shadow-[0_8px_20px_rgba(132,204,22,0.24)] dark:border-lime-700/60 dark:bg-lime-400/90 dark:text-lime-950",
  },
  {
    key: "life-science",
    label: "Life Science",
    group: "department",
    department: "LIFE_SCIENCE",
    icon: "L",
    swatchClassName:
      "bg-gradient-to-br from-violet-100 via-indigo-50 to-sky-50 ring-violet-200/90",
    softClassName:
      "bg-violet-50 text-violet-800 ring-violet-200 dark:bg-violet-950/30 dark:text-violet-200 dark:ring-violet-900/50",
    pillClassName:
      "bg-violet-100 text-violet-700 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-200 dark:ring-violet-900/50",
    barClassName:
      "border-violet-300/70 bg-violet-300 text-violet-950 shadow-[0_8px_20px_rgba(167,139,250,0.26)] dark:border-violet-700/60 dark:bg-violet-400/90 dark:text-violet-950",
  },
  {
    key: "point-of-care",
    label: "Point of Care",
    group: "department",
    department: "POINT_OF_CARE",
    icon: "P",
    swatchClassName:
      "bg-gradient-to-br from-stone-200 via-zinc-50 to-white ring-stone-200/90",
    softClassName:
      "bg-stone-50 text-stone-800 ring-stone-200 dark:bg-stone-950/30 dark:text-stone-200 dark:ring-stone-900/50",
    pillClassName:
      "bg-stone-100 text-stone-700 ring-stone-200 dark:bg-stone-950/40 dark:text-stone-200 dark:ring-stone-900/50",
    barClassName:
      "border-stone-300/70 bg-stone-300 text-stone-950 shadow-[0_8px_20px_rgba(168,162,158,0.22)] dark:border-stone-700/60 dark:bg-stone-400/90 dark:text-stone-950",
  },
  {
    key: "caresphere-academy",
    label: "Caresphere Academy",
    group: "department",
    department: "CARESPHERE_ACADEMY",
    icon: "C",
    swatchClassName:
      "bg-gradient-to-br from-yellow-100 via-lime-50 to-stone-50 ring-yellow-200/90",
    softClassName:
      "bg-yellow-50 text-yellow-800 ring-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-200 dark:ring-yellow-900/50",
    pillClassName:
      "bg-yellow-100 text-yellow-700 ring-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-200 dark:ring-yellow-900/50",
    barClassName:
      "border-yellow-300/70 bg-yellow-300 text-yellow-950 shadow-[0_8px_20px_rgba(250,204,21,0.24)] dark:border-yellow-700/60 dark:bg-yellow-400/90 dark:text-yellow-950",
  },
  {
    key: "software",
    label: "Software",
    group: "department",
    department: "SOFTWARE",
    icon: "S",
    swatchClassName:
      "bg-gradient-to-br from-cyan-100 via-sky-50 to-blue-50 ring-cyan-200/90",
    softClassName:
      "bg-cyan-50 text-cyan-800 ring-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-200 dark:ring-cyan-900/50",
    pillClassName:
      "bg-cyan-100 text-cyan-700 ring-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-200 dark:ring-cyan-900/50",
    barClassName:
      "border-cyan-300/70 bg-cyan-300 text-cyan-950 shadow-[0_8px_20px_rgba(34,211,238,0.24)] dark:border-cyan-700/60 dark:bg-cyan-400/90 dark:text-cyan-950",
  },
  {
    key: "immunology",
    label: "Immunology",
    group: "department",
    department: "IMMUNOLOGY",
    icon: "I",
    swatchClassName:
      "bg-gradient-to-br from-orange-100 via-amber-50 to-yellow-50 ring-orange-200/90",
    softClassName:
      "bg-orange-50 text-orange-800 ring-orange-200 dark:bg-orange-950/30 dark:text-orange-200 dark:ring-orange-900/50",
    pillClassName:
      "bg-orange-100 text-orange-700 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-200 dark:ring-orange-900/50",
    barClassName:
      "border-orange-300/70 bg-orange-300 text-orange-950 shadow-[0_8px_20px_rgba(251,146,60,0.24)] dark:border-orange-700/60 dark:bg-orange-400/90 dark:text-orange-950",
  },
  {
    key: "clinical-chemistry",
    label: "Clinical Chemistry",
    group: "department",
    department: "CLINICAL_CHEMISTRY",
    icon: "CC",
    swatchClassName:
      "bg-gradient-to-br from-orange-100 via-rose-50 to-red-50 ring-rose-200/90",
    softClassName:
      "bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950/30 dark:text-rose-200 dark:ring-rose-900/50",
    pillClassName:
      "bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-900/50",
    barClassName:
      "border-red-300/70 bg-red-300 text-red-950 shadow-[0_8px_20px_rgba(248,113,113,0.24)] dark:border-red-700/60 dark:bg-red-400/90 dark:text-red-950",
  },
];

export const LEAVE_COLOR_OPTIONS: PlanningColorOption[] = [
  {
    key: "leave-vacation",
    label: "Holiday",
    group: "leave",
    icon: "H",
    swatchClassName:
      "bg-gradient-to-br from-emerald-100 via-teal-50 to-cyan-50 ring-emerald-200/90",
    softClassName:
      "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-200 dark:ring-emerald-900/50",
    pillClassName:
      "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900/50",
    barClassName:
      "border-emerald-400/80 bg-emerald-200/90 text-emerald-950 shadow-[0_8px_18px_rgba(16,185,129,0.18)] dark:border-emerald-700/60 dark:bg-emerald-400/70 dark:text-emerald-950",
  },
  {
    key: "leave-sick",
    label: "Sick Leave",
    group: "leave",
    icon: "S",
    swatchClassName:
      "bg-gradient-to-br from-red-100 via-rose-50 to-orange-50 ring-red-200/90",
    softClassName:
      "bg-red-50 text-red-800 ring-red-200 dark:bg-red-950/30 dark:text-red-200 dark:ring-red-900/50",
    pillClassName:
      "bg-red-100 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-900/50",
    barClassName:
      "border-red-400/80 bg-red-200/90 text-red-950 shadow-[0_8px_18px_rgba(239,68,68,0.18)] dark:border-red-700/60 dark:bg-red-400/70 dark:text-red-950",
  },
  {
    key: "leave-training",
    label: "Training",
    group: "leave",
    icon: "T",
    swatchClassName:
      "bg-gradient-to-br from-indigo-100 via-violet-50 to-sky-50 ring-indigo-200/90",
    softClassName:
      "bg-indigo-50 text-indigo-800 ring-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-200 dark:ring-indigo-900/50",
    pillClassName:
      "bg-indigo-100 text-indigo-700 ring-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-200 dark:ring-indigo-900/50",
    barClassName:
      "border-indigo-400/80 bg-indigo-200/90 text-indigo-950 shadow-[0_8px_18px_rgba(99,102,241,0.18)] dark:border-indigo-700/60 dark:bg-indigo-400/70 dark:text-indigo-950",
  },
  {
    key: "leave-ooo",
    label: "Out of Office",
    group: "leave",
    icon: "O",
    swatchClassName:
      "bg-gradient-to-br from-slate-200 via-zinc-100 to-slate-50 ring-slate-200/90",
    softClassName:
      "bg-slate-50 text-slate-800 ring-slate-200 dark:bg-slate-950/30 dark:text-slate-200 dark:ring-slate-900/50",
    pillClassName:
      "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-950/40 dark:text-slate-200 dark:ring-slate-900/50",
    barClassName:
      "border-slate-400/80 bg-slate-200/90 text-slate-950 shadow-[0_8px_18px_rgba(148,163,184,0.18)] dark:border-slate-700/60 dark:bg-slate-400/70 dark:text-slate-950",
  },
];

export const COLOR_OPTIONS = [
  ...DEPARTMENT_COLOR_OPTIONS,
  ...LEAVE_COLOR_OPTIONS,
] as const;

const LEAVE_TYPE_TO_COLOR_KEY: Record<LeaveType, string> = {
  HOLIDAY: "leave-vacation",
  SICK: "leave-sick",
  TRAINING: "leave-training",
  OUT_OF_OFFICE: "leave-ooo",
};

const COLOR_KEY_ALIASES: Record<string, string> = {
  urinology: "urinalysis",
  poc: "point-of-care",
  bloodscience: "life-science",
  "flow cytometry": "flow-cytometry",
  "life science": "life-science",
  "point of care": "point-of-care",
  "caresphere academy": "caresphere-academy",
  "clinical chemistry": "clinical-chemistry",
};

export function normalizeColorKey(colorKey: string) {
  return COLOR_KEY_ALIASES[colorKey] ?? colorKey;
}

export function getColorOption(colorKey: string) {
  const normalized = normalizeColorKey(colorKey);
  return (
    COLOR_OPTIONS.find((option) => option.key === normalized) ??
    COLOR_OPTIONS.find((option) => option.key === "point-of-care")!
  );
}

export function getProjectDepartmentFromColorKey(
  colorKey: string,
): ProjectDepartment | undefined {
  return getColorOption(colorKey).department;
}

export function isLeaveColorKey(colorKey: string) {
  return normalizeColorKey(colorKey).startsWith("leave-");
}

export function getTimelineEntryType(colorKey: string): TimelineEntryType {
  return isLeaveColorKey(colorKey) ? "LEAVE" : "PROJECT";
}

export function getLeaveTypeFromColorKey(colorKey: string): LeaveType | null {
  const normalized = normalizeColorKey(colorKey);

  switch (normalized) {
    case "leave-vacation":
      return "HOLIDAY";
    case "leave-sick":
      return "SICK";
    case "leave-training":
      return "TRAINING";
    case "leave-ooo":
      return "OUT_OF_OFFICE";
    default:
      return null;
  }
}

export function getColorKeyForLeaveType(leaveType: LeaveType) {
  return LEAVE_TYPE_TO_COLOR_KEY[leaveType];
}

export function getDefaultLabelForLeaveType(leaveType: LeaveType) {
  switch (leaveType) {
    case "HOLIDAY":
      return "Holiday";
    case "SICK":
      return "Sick";
    case "TRAINING":
      return "Training";
    case "OUT_OF_OFFICE":
      return "Out of Office";
    default:
      return "Leave";
  }
}

export function buildStableLaneMap<T extends TimelineAssignmentLike>(
  assignments: T[],
  previousLaneByAssignmentId?: Record<string, number>,
) {
  const lanes: Array<{ endTime: number }> = [];
  const map: Record<string, number> = {};

  const sortedAssignments = [...assignments].sort((left, right) => {
    const startDiff =
      new Date(left.startDate).getTime() - new Date(right.startDate).getTime();

    if (startDiff !== 0) {
      return startDiff;
    }

    const endDiff =
      new Date(right.endDate).getTime() - new Date(left.endDate).getTime();

    if (endDiff !== 0) {
      return endDiff;
    }

    return left.id.localeCompare(right.id);
  });

  for (const assignment of sortedAssignments) {
    const startTime = new Date(assignment.startDate).getTime();
    const endTime = new Date(assignment.endDate).getTime();
    const preferredLane = previousLaneByAssignmentId?.[assignment.id];
    const laneOrder: number[] = [];

    if (preferredLane !== undefined && preferredLane <= lanes.length) {
      laneOrder.push(preferredLane);
    }

    for (let laneIndex = 0; laneIndex < lanes.length; laneIndex += 1) {
      if (laneIndex !== preferredLane) {
        laneOrder.push(laneIndex);
      }
    }

    let laneIndex = laneOrder.find(
      (candidateLane) => startTime >= (lanes[candidateLane]?.endTime ?? 0),
    );

    if (laneIndex === undefined) {
      laneIndex = lanes.length;
      lanes.push({ endTime });
    } else {
      lanes[laneIndex] = { endTime };
    }

    map[assignment.id] = laneIndex;
  }

  return map;
}

export function buildProjectVisual(project: Project) {
  const option = getColorOption(project.colorKey);
  return {
    ...option,
    key: option.key,
    label: option.label,
  };
}

export function startOfDayLocal(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function startOfMonday(date: Date) {
  const next = startOfDayLocal(date);
  const weekday = (next.getDay() + 6) % 7;
  next.setDate(next.getDate() - weekday);
  return next;
}

export function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return startOfDayLocal(next);
}

export function diffCalendarDays(from: Date, to: Date) {
  return Math.round(
    (startOfDayLocal(to).getTime() - startOfDayLocal(from).getTime()) / MS_PER_DAY,
  );
}

export function makeDays(start: Date, count: number) {
  return Array.from({ length: count }, (_, index) => addDays(start, index));
}

export function isoDateOnlyLocal(date: Date) {
  const day = startOfDayLocal(date);
  const year = day.getFullYear();
  const month = String(day.getMonth() + 1).padStart(2, "0");
  const dayPart = String(day.getDate()).padStart(2, "0");
  return `${year}-${month}-${dayPart}`;
}

export function isWeekend(date: Date) {
  return date.getDay() === 0 || date.getDay() === 6;
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
    [isoDateOnlyLocal(addDays(easter, -2)), "Good Friday"],
    [isoDateOnlyLocal(addDays(easter, 1)), "Easter Monday"],
    [isoDateOnlyLocal(addDays(easter, 39)), "Ascension Day"],
    [isoDateOnlyLocal(addDays(easter, 50)), "Whit Monday"],
  ];

  if (region === "DE-SH") {
    entries.push([`${year}-10-31`, "Reformation Day"]);
  }

  return new Map(entries);
}

export function buildHolidayMapForYears(
  days: Date[],
  region: HolidayRegion = "DE-SH",
) {
  const years = Array.from(new Set(days.map((day) => day.getFullYear())));
  const holidayMap = new Map<string, string>();

  for (const year of years) {
    const yearMap = getGermanHolidayMap(year, region);
    for (const [key, label] of yearMap.entries()) {
      holidayMap.set(key, label);
    }
  }

  return holidayMap;
}

export function isHoliday(date: Date, holidayMap: Map<string, string>) {
  return holidayMap.has(isoDateOnlyLocal(date));
}

export function isNonWorkingDay(
  date: Date,
  holidayMap: Map<string, string>,
) {
  return isWeekend(date) || isHoliday(date, holidayMap);
}

export function countWorkingDays(
  start: Date,
  endExclusive: Date,
  holidayMap: Map<string, string>,
) {
  let count = 0;
  const cursor = startOfDayLocal(start);
  const end = startOfDayLocal(endExclusive);

  while (cursor < end) {
    if (!isNonWorkingDay(cursor, holidayMap)) {
      count += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

export function addWorkingDaysInclusive(
  start: Date,
  workingDays: number,
  holidayMap: Map<string, string>,
) {
  const cursor = startOfDayLocal(start);
  let counted = isNonWorkingDay(cursor, holidayMap) ? 0 : 1;

  while (counted < workingDays) {
    cursor.setDate(cursor.getDate() + 1);
    if (!isNonWorkingDay(cursor, holidayMap)) {
      counted += 1;
    }
  }

  cursor.setDate(cursor.getDate() + 1);
  return startOfDayLocal(cursor);
}

export function moveByWorkingDays(
  date: Date,
  delta: number,
  holidayMap: Map<string, string>,
) {
  const cursor = startOfDayLocal(date);

  if (delta === 0) {
    return cursor;
  }

  const step = delta > 0 ? 1 : -1;
  let remaining = Math.abs(delta);

  while (remaining > 0) {
    cursor.setDate(cursor.getDate() + step);
    if (!isNonWorkingDay(cursor, holidayMap)) {
      remaining -= 1;
    }
  }

  return startOfDayLocal(cursor);
}

export function snapToWorkingDay(
  date: Date,
  direction: 1 | -1,
  holidayMap: Map<string, string>,
) {
  const cursor = startOfDayLocal(date);

  while (isNonWorkingDay(cursor, holidayMap)) {
    cursor.setDate(cursor.getDate() + direction);
  }

  return startOfDayLocal(cursor);
}

export function getWorkingRangeFromDrag(
  anchor: Date,
  target: Date,
  holidayMap: Map<string, string>,
) {
  const orderedStart = startOfDayLocal(anchor < target ? anchor : target);
  const orderedEnd = startOfDayLocal(anchor < target ? target : anchor);

  let start: Date | null = null;
  let end: Date | null = null;

  for (let cursor = startOfDayLocal(orderedStart); cursor <= orderedEnd; ) {
    if (!isNonWorkingDay(cursor, holidayMap)) {
      start = start ?? startOfDayLocal(cursor);
      end = startOfDayLocal(cursor);
    }

    cursor = addDays(cursor, 1);
  }

  if (!start || !end) {
    const direction: 1 | -1 = target >= anchor ? 1 : -1;
    const snapped = snapToWorkingDay(anchor, direction, holidayMap);
    return {
      start,
      end,
      workingDays: 1,
      endExclusive: addWorkingDaysInclusive(snapped, 1, holidayMap),
      snappedStart: snapped,
    };
  }

  const endExclusive = addDays(end, 1);
  const workingDays = Math.max(1, countWorkingDays(start, endExclusive, holidayMap));

  return {
    start,
    end,
    workingDays,
    endExclusive: addWorkingDaysInclusive(start, workingDays, holidayMap),
    snappedStart: start,
  };
}

export function buildUserRowLayout<T extends TimelineAssignmentLike>(
  assignments: T[],
  projectsById: Record<string, Project>,
  days: Date[],
  options?: {
    preferredLaneByAssignmentId?: Record<string, number>;
    lockedAssignmentId?: string | null;
    freezePreferredLanes?: boolean;
    laneHeight?: number;
    rowPaddingY?: number;
    minRowHeight?: number;
  },
) {
  const laneHeight = options?.laneHeight ?? LANE_HEIGHT;
  const rowPaddingY = options?.rowPaddingY ?? ROW_PADDING_Y;
  const minRowHeight = options?.minRowHeight ?? MIN_ROW_HEIGHT;
  const visibleAssignments = assignments
    .map((assignment) => {
      const project = projectsById[assignment.projectId];

      if (!project) {
        return null;
      }

      const start = startOfDayLocal(new Date(assignment.startDate));
      const endExclusive = startOfDayLocal(new Date(assignment.endDate));
      const startIndex = diffCalendarDays(days[0], start);
      const endIndex = diffCalendarDays(days[0], endExclusive);

      if (endIndex <= 0 || startIndex >= days.length) {
        return null;
      }

      const clampedStart = Math.max(0, startIndex);
      const clampedEnd = Math.min(days.length, endIndex);

      return {
        assignment,
        project,
        leave: isLeaveColorKey(project.colorKey),
        startIndex,
        endIndex,
        clampedStart,
        clampedEnd,
        clampedLength: Math.max(1, clampedEnd - clampedStart),
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const leftLocked = left!.assignment.id === options?.lockedAssignmentId;
      const rightLocked = right!.assignment.id === options?.lockedAssignmentId;

      if (leftLocked !== rightLocked) {
        return leftLocked ? -1 : 1;
      }

      const leftPreferred =
        options?.preferredLaneByAssignmentId?.[left!.assignment.id] ?? 0;
      const rightPreferred =
        options?.preferredLaneByAssignmentId?.[right!.assignment.id] ?? 0;

      if (leftPreferred !== rightPreferred) {
        return leftPreferred - rightPreferred;
      }

      const leftHasExplicitLane = typeof left!.assignment.laneIndex === "number";
      const rightHasExplicitLane =
        typeof right!.assignment.laneIndex === "number";

      if (leftHasExplicitLane !== rightHasExplicitLane) {
        return leftHasExplicitLane ? -1 : 1;
      }

      if (left!.clampedStart !== right!.clampedStart) {
        return left!.clampedStart - right!.clampedStart;
      }

      if (right!.clampedLength !== left!.clampedLength) {
        return right!.clampedLength - left!.clampedLength;
      }

      return left!.assignment.id.localeCompare(right!.assignment.id);
    }) as PositionedAssignment<T>[];

  const lanes: PositionedAssignment<T>[][] = [];

  for (const item of visibleAssignments) {
    const preferredLane =
      options?.preferredLaneByAssignmentId?.[item.assignment.id] ?? null;

    function canPlaceInLane(laneIndex: number) {
      const lane = lanes[laneIndex];

      if (!lane) {
        return true;
      }

      return lane.every(
        (existing) =>
          item.clampedEnd <= existing.clampedStart ||
          item.clampedStart >= existing.clampedEnd,
      );
    }

    const laneOrder: number[] = [];

    if (preferredLane !== null && preferredLane <= lanes.length) {
      laneOrder.push(preferredLane);
    }

    for (let laneIndex = 0; laneIndex < lanes.length; laneIndex += 1) {
      if (laneIndex !== preferredLane) {
        laneOrder.push(laneIndex);
      }
    }

    let targetLane =
      options?.freezePreferredLanes &&
        preferredLane !== null &&
        preferredLane <= lanes.length
        ? preferredLane
        : laneOrder.find((laneIndex) => canPlaceInLane(laneIndex));

    if (targetLane === undefined) {
      targetLane = lanes.length;
    }

    while (lanes.length <= targetLane) {
      lanes.push([]);
    }

    lanes[targetLane].push(item);
    lanes[targetLane].sort((left, right) => {
      if (left.clampedStart !== right.clampedStart) {
        return left.clampedStart - right.clampedStart;
      }

      if (left.clampedLength !== right.clampedLength) {
        return right.clampedLength - left.clampedLength;
      }

      return left.assignment.id.localeCompare(right.assignment.id);
    });
  }

  const laneCount = Math.max(1, lanes.length);

  return {
    lanes,
    laneCount,
    rowHeight: Math.max(minRowHeight, laneCount * laneHeight + rowPaddingY * 2),
  } satisfies UserRowLayout<T>;
}

const AVATAR_TONES = [
  "from-rose-200 to-fuchsia-100 text-rose-900 ring-rose-200",
  "from-sky-200 to-cyan-100 text-sky-900 ring-sky-200",
  "from-emerald-200 to-teal-100 text-emerald-900 ring-emerald-200",
  "from-violet-200 to-indigo-100 text-violet-900 ring-violet-200",
  "from-amber-200 to-yellow-100 text-amber-900 ring-amber-200",
  "from-orange-200 to-red-100 text-orange-900 ring-orange-200",
  "from-stone-200 to-zinc-100 text-stone-900 ring-stone-200",
] as const;

export function getAvatarTone(value: string) {
  const hash = Array.from(value).reduce(
    (total, char) => total + char.charCodeAt(0),
    0,
  );
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}
