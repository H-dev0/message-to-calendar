export type Task = {
  title: string;
  date: string | null;
  time: string | null;
  description: string;
};

export const MAX_MESSAGE_LENGTH = 10_000;

export function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1000 || year > 9999) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isValidTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 100 || !value) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function validateTask(value: unknown): Task {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid task response.");
  const task = value as Record<string, unknown>;
  const keys = Object.keys(task).sort().join(",");
  if (keys !== "date,description,time,title" ||
      typeof task.title !== "string" || task.title.length > 400 ||
      typeof task.description !== "string" || task.description.length > MAX_MESSAGE_LENGTH ||
      (task.date !== null && !isValidDate(task.date)) ||
      (task.time !== null && !isValidTime(task.time))) {
    throw new Error("Gemini returned invalid task fields. Try a clearer message.");
  }
  return { title: task.title.trim(), date: task.date, time: task.time, description: task.description };
}

export function localDateTimeParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, calendar: "gregory", numberingSystem: "latn", hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(instant);
  const part = (type: string) => parts.find((item) => item.type === type)!.value;
  return {
    date: `${part("year").padStart(4, "0")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
    seconds: Number(part("second")),
  };
}

export function getDateContext(timeZone: string, now = new Date()) {
  if (!isValidTimeZone(timeZone)) throw new Error("Invalid time zone.");
  const { date, time } = localDateTimeParts(now, timeZone);
  const base = new Date(`${date}T00:00:00Z`);
  const addDays = (days: number) => new Date(base.getTime() + days * 86_400_000).toISOString().slice(0, 10);
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const weekdays = names.map((name, index) => {
    const days = (index - base.getUTCDay() + 7) % 7;
    return { name, upcoming: addDays(days), next: addDays(days || 7) };
  });
  return { date, time, weekday: names[base.getUTCDay()], tomorrow: addDays(1), timeZone, weekdays };
}

// Match the selected wall-clock time to real instants in the device's zone.
// Both daylight-saving gaps and repeated times require manual correction.
export function taskStartUtc(date: string, time: string, timeZone: string): Date {
  if (!isValidDate(date) || !isValidTime(time) || !isValidTimeZone(timeZone)) {
    throw new Error("Enter a valid date and time before downloading.");
  }
  const wallTime = Date.parse(`${date}T${time}:00Z`);
  const offsets = new Set<number>();
  for (const hours of [-36, -24, -12, 0, 12, 24, 36]) {
    const sample = new Date(wallTime + hours * 3_600_000);
    const parts = localDateTimeParts(sample, timeZone);
    const zoned = Date.parse(`${parts.date}T${parts.time}:${String(parts.seconds).padStart(2, "0")}Z`);
    offsets.add(zoned - sample.getTime());
  }
  const matches = [...offsets].map((offset) => new Date(wallTime - offset)).filter((candidate) => {
    const parts = localDateTimeParts(candidate, timeZone);
    return parts.date === date && parts.time === time && parts.seconds === 0;
  });
  if (matches.length !== 1) {
    throw new Error("This time is missing or repeated during a daylight-saving change. Choose an unambiguous time.");
  }
  return matches[0];
}

export function taskProblems(task: Task, timeZone: string): string[] {
  const problems: string[] = [];
  if (!task.title.trim()) problems.push("Please enter a task title. / أدخل عنوان المهمة.");
  if (!isValidDate(task.date)) problems.push("Date is missing or unclear. Please fill or correct it. / أدخل التاريخ أو صححه.");
  if (!isValidTime(task.time)) problems.push("Time is missing or unclear. Please fill or correct it. / أدخل الوقت أو صححه.");
  if (isValidDate(task.date) && isValidTime(task.time)) {
    try { taskStartUtc(task.date, task.time, timeZone); }
    catch (error) { problems.push(error instanceof Error ? error.message : "Check the selected date and time."); }
  }
  return problems;
}
