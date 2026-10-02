import { taskProblems, taskStartUtc, type Task } from "./task";

export function escapeCalendarText(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

export function foldCalendarLine(line: string): string {
  const encoder = new TextEncoder();
  let result = "";
  let bytes = 0;
  for (const character of line) {
    const length = encoder.encode(character).length;
    if (bytes + length > 75) {
      result += "\r\n ";
      bytes = 1;
    }
    result += character;
    bytes += length;
  }
  return result;
}

const timestamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

export function createCalendarEvent(
  task: Task,
  timeZone: string,
  options: { now?: Date; uid?: string } = {},
): string {
  const problems = taskProblems(task, timeZone);
  if (problems.length) throw new Error(problems[0]);
  const uid = options.uid ?? `${crypto.randomUUID()}@message-to-calendar`;
  if (!/^[a-zA-Z0-9._@-]+$/.test(uid)) throw new Error("Invalid event identifier.");
  const start = taskStartUtc(task.date!, task.time!, timeZone);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Message to Calendar//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${timestamp(options.now ?? new Date())}`,
    `DTSTART:${timestamp(start)}`,
    `SUMMARY:${escapeCalendarText(task.title.trim())}`,
    `DESCRIPTION:${escapeCalendarText(task.description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  // No guessed duration: RFC 5545 permits a point-in-time VEVENT without DTEND.
  return lines.map(foldCalendarLine).join("\r\n") + "\r\n";
}
