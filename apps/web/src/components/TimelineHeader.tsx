type Props = {
  days: Date[];
  dayWidth: number;
  leftWidth: number;
  isHoliday: (d: Date) => boolean;
  todayIndex: number | null;
};

function isWeekend(date: Date) {
  return date.getDay() === 0 || date.getDay() === 6;
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const weekday = next.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

function isSameDay(left: Date, right: Date) {
  return left.toDateString() === right.toDateString();
}

function isSameMonth(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth()
  );
}

function getIsoWeekNumber(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() + 3 - ((next.getDay() + 6) % 7));
  const weekOne = new Date(next.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((next.getTime() - weekOne.getTime()) / 86400000 -
        3 +
        ((weekOne.getDay() + 6) % 7)) /
        7,
    )
  );
}

function getMonthGroups(days: Date[]) {
  const groups: { label: string; start: number; span: number }[] = [];

  if (days.length === 0) {
    return groups;
  }

  let start = 0;

  for (let index = 1; index <= days.length; index += 1) {
    const previous = days[index - 1];
    const next = days[index];

    if (!next || !isSameMonth(previous, next)) {
      groups.push({
        label: previous.toLocaleDateString("en-GB", {
          month: "long",
        }),
        start,
        span: index - start,
      });
      start = index;
    }
  }

  return groups;
}

function getWeekGroups(days: Date[]) {
  const groups: {
    label: string;
    start: number;
    span: number;
    weekNumber: number;
  }[] = [];

  if (days.length === 0) {
    return groups;
  }

  let start = 0;
  let currentWeek = startOfWeek(days[0]);

  for (let index = 1; index <= days.length; index += 1) {
    const next = days[index];
    const nextWeek = next ? startOfWeek(next) : null;

    if (!next || !isSameDay(currentWeek, nextWeek!)) {
      const weekStart = days[start];
      const weekEnd = days[index - 1];

      groups.push({
        label: `${weekStart.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
        })} - ${weekEnd.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
        })}`,
        start,
        span: index - start,
        weekNumber: getIsoWeekNumber(currentWeek),
      });

      start = index;
      if (next) {
        currentWeek = startOfWeek(next);
      }
    }
  }

  return groups;
}

export function TimelineHeader({
  days,
  dayWidth,
  leftWidth,
  isHoliday,
  todayIndex,
}: Props) {
  const monthGroups = getMonthGroups(days);
  const weekGroups = getWeekGroups(days);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yearLabel =
    days.length === 0
      ? ""
      : days[0].getFullYear() === days[days.length - 1].getFullYear()
        ? String(days[0].getFullYear())
        : `${days[0].getFullYear()} / ${days[days.length - 1].getFullYear()}`;

  return (
    <div className="relative sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
      {todayIndex !== null ? (
        <div
          className="pointer-events-none absolute bottom-0 top-0 z-40"
          style={{
            left: leftWidth + todayIndex * dayWidth + Math.floor(dayWidth / 2),
          }}
        >
          <div className="absolute -top-1.5 -left-1.5 h-3 w-3 rounded-full border border-white bg-sky-500 shadow-sm shadow-sky-500/30 dark:border-zinc-950" />
          <div className="h-full w-px bg-sky-400/70" />
        </div>
      ) : null}

      <div
        className="grid border-b border-slate-200/70 dark:border-zinc-800"
        style={{ gridTemplateColumns: `${leftWidth}px 1fr` }}
      >
        <div className="sticky left-0 z-30 border-r border-slate-200/70 bg-white/95 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/95">
          <div className="text-sm font-semibold tracking-[0.18em] text-slate-800 dark:text-zinc-200">
            {yearLabel}
          </div>
        </div>

        <div className="flex">
          {monthGroups.map((group) => (
            <div
              key={`${group.label}-${group.start}`}
              className="border-l border-slate-200/70 px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:border-zinc-800 dark:text-zinc-400"
              style={{ width: group.span * dayWidth }}
            >
              {group.label}
            </div>
          ))}
        </div>
      </div>

      <div
        className="grid border-b border-slate-200/70 dark:border-zinc-800"
        style={{ gridTemplateColumns: `${leftWidth}px 1fr` }}
      >
        <div className="sticky left-0 z-30 border-r border-slate-200/70 bg-white/95 px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-950/95" />

        <div className="flex bg-slate-50/75 dark:bg-zinc-950">
          {weekGroups.map((group) => (
            <div
              key={`${group.label}-${group.start}`}
              className="border-l border-slate-200/70 px-2 py-1.5 text-[10px] dark:border-zinc-800"
              style={{ width: group.span * dayWidth }}
            >
              <div className="font-semibold uppercase tracking-[0.14em] text-slate-600 dark:text-zinc-300">
                W{String(group.weekNumber).padStart(2, "0")}
              </div>
              <div className="mt-0.5 whitespace-nowrap text-[10px] text-slate-500 dark:text-zinc-500">
                {group.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: `${leftWidth}px 1fr` }}>
        <div className="sticky left-0 z-30 border-r border-slate-200/70 bg-white/95 px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-950/95" />

        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${days.length}, ${dayWidth}px)`,
          }}
        >
          {days.map((day, index) => {
            const weekend = isWeekend(day);
            const holiday = isHoliday(day);
            const isToday = isSameDay(day, today);

            return (
              <div
                key={index}
                className={[
                  "border-l px-1 py-1.5 text-center text-[10px] dark:border-zinc-800",
                  holiday
                    ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-200"
                    : weekend
                      ? "bg-slate-100/80 text-slate-400 dark:bg-zinc-900 dark:text-zinc-500"
                      : "bg-white text-slate-500 dark:bg-zinc-950 dark:text-zinc-400",
                  isToday ? "bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-200" : "",
                ].join(" ")}
              >
                <div className="font-semibold uppercase tracking-[0.08em]">
                  {day.toLocaleDateString("en-GB", { weekday: "narrow" })}
                </div>
                <div className="mt-0.5 text-[11px] font-semibold">
                  {day.toLocaleDateString("en-GB", { day: "2-digit" })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
