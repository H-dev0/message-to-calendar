import test from "node:test";
import assert from "node:assert/strict";
import ICAL from "ical.js";
import { createCalendarEvent } from "../src/lib/calendar";

const task = { title: 'تسليم "التقرير", للمحاسبة', date: "2026-10-03", time: "23:59", description: 'راجع الملف, "النهائي"; ثم أرسله.\nالمسار: C:\\notes\\report' };
const options = { now: new Date("2026-10-02T12:00:00Z"), uid: "fixture@message-to-calendar" };

function parse(text: string) {
  const calendar = new ICAL.Component(ICAL.parse(text));
  const component = calendar.getFirstSubcomponent("vevent")!;
  return { calendar, component, event: new ICAL.Event(component) };
}

test("independent iCalendar parser reads one valid event at the exact due time", () => {
  const output = createCalendarEvent(task, "Asia/Riyadh", options);
  const { calendar, component, event } = parse(output);
  assert.equal(calendar.getFirstPropertyValue("version"), "2.0");
  assert.equal(calendar.getAllSubcomponents("vevent").length, 1);
  assert.equal(event.uid, options.uid);
  assert.equal(event.startDate.toJSDate().toISOString(), "2026-10-03T20:59:00.000Z");
  assert.equal(event.endDate.toJSDate().toISOString(), event.startDate.toJSDate().toISOString());
  assert.equal(component.getFirstPropertyValue("dtstamp")?.toString(), "2026-10-02T12:00:00Z");
  assert.equal(component.hasProperty("dtend"), false);
  assert.equal(component.getAllSubcomponents("valarm").length, 0);
  assert.equal(output.endsWith("\r\n"), true);
  assert.equal(output.replaceAll("\r\n", "").includes("\n"), false);
});

test("Arabic, quotes, commas, semicolons, backslashes and newlines survive UTF-8 export", () => {
  const output = createCalendarEvent(task, "Asia/Riyadh", options);
  const utf8 = new TextDecoder("utf-8", { fatal: true }).decode(new TextEncoder().encode(output));
  const { event } = parse(utf8);
  assert.equal(event.summary, task.title);
  assert.equal(event.description, task.description);
});

test("long Arabic and emoji lines fold within 75 bytes without splitting characters", () => {
  const longTask = { ...task, title: "موعد 📚 ".repeat(40), description: "المراجعة, ثم التسليم; ✅\n".repeat(70) };
  const output = createCalendarEvent(longTask, "Asia/Riyadh", options);
  for (const line of output.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75);
  const { event } = parse(output);
  assert.equal(event.summary, longTask.title.trim());
  assert.equal(event.description, longTask.description);
});

test("text cannot inject another event or calendar property", () => {
  const injection = { ...task, description: "test\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nSUMMARY:injected" };
  const { calendar, event } = parse(createCalendarEvent(injection, "Asia/Riyadh", options));
  assert.equal(calendar.getAllSubcomponents("vevent").length, 1);
  assert.equal(event.description, injection.description.replaceAll("\r\n", "\n"));
  assert.throws(() => createCalendarEvent(task, "UTC", { uid: "bad\r\nUID:injected" }));
});

test("missing date/time prevent export and manually supplied values enable it", () => {
  assert.throws(() => createCalendarEvent({ ...task, date: null }, "Asia/Riyadh", options), /Date is missing/);
  assert.throws(() => createCalendarEvent({ ...task, time: null }, "Asia/Riyadh", options), /Time is missing/);
  const original = { ...task };
  const edited = { ...task, title: "Edited title", date: "2026-10-05", time: "15:00" };
  const { event } = parse(createCalendarEvent(edited, "Asia/Riyadh", options));
  assert.equal(event.summary, "Edited title");
  assert.equal(event.startDate.toJSDate().toISOString(), "2026-10-05T12:00:00.000Z");
  assert.deepEqual(task, original);
});
