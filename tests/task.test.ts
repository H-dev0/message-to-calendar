import test from "node:test";
import assert from "node:assert/strict";
import { getDateContext, isValidDate, isValidTime, isValidTimeZone, taskProblems, taskStartUtc, validateTask } from "../src/lib/task";
import { extractionInstructions } from "../src/lib/extraction";

const task = { title: "Submit assignment", date: "2026-10-03", time: "23:59", description: "Coursework" };

test("real Gregorian dates and 24-hour times only", () => {
  for (const value of ["2026-02-29", "2026-04-31", "03/04/2026", "2026-13-01", "0000-01-01"]) assert.equal(isValidDate(value), false);
  assert.equal(isValidDate("2028-02-29"), true);
  for (const value of ["24:00", "3 PM", "12:60", "3:00", ""]) assert.equal(isValidTime(value), false);
  for (const value of ["00:00", "12:00", "15:00", "23:59"]) assert.equal(isValidTime(value), true);
  assert.equal(isValidTimeZone("Asia/Riyadh"), true);
  assert.equal(isValidTimeZone("made-up-zone"), false);
});

test("current local date correctly crosses UTC midnight", () => {
  const now = new Date("2026-10-02T22:30:00Z");
  assert.equal(getDateContext("Asia/Riyadh", now).date, "2026-10-03");
  assert.equal(getDateContext("America/Los_Angeles", now).date, "2026-10-02");
  assert.equal(getDateContext("Asia/Riyadh", now).tomorrow, "2026-10-04");
});

test("tomorrow and next-weekday context handles week and year boundaries", () => {
  const friday = getDateContext("Asia/Riyadh", new Date("2026-10-02T12:00:00Z"));
  assert.equal(friday.tomorrow, "2026-10-03");
  assert.deepEqual(friday.weekdays.find((day) => day.name === "Monday"), { name: "Monday", upcoming: "2026-10-05", next: "2026-10-05" });
  const monday = getDateContext("UTC", new Date("2026-10-05T12:00:00Z"));
  assert.equal(monday.weekdays.find((day) => day.name === "Monday")?.next, "2026-10-12");
  assert.equal(monday.weekdays.find((day) => day.name === "Monday")?.upcoming, "2026-10-05");
  assert.equal(getDateContext("UTC", new Date("2026-12-31T12:00:00Z")).tomorrow, "2027-01-01");
});

test("extraction instructions bind dates to the current local date and preserve uncertainty", () => {
  const prompt = extractionInstructions("Asia/Riyadh", new Date("2026-10-02T12:00:00Z"));
  assert.match(prompt, /2026-10-02 \(Friday\)/);
  assert.match(prompt, /tomorrow.*2026-10-03/);
  assert.match(prompt, /Monday: bare=2026-10-05, next=2026-10-05/);
  assert.match(prompt, /time is null unless an exact hour/);
  assert.match(prompt, /23:59/);
  assert.match(prompt, /Time alone|time alone/);
});

test("strict task response rejects incorrect or extra fields", () => {
  assert.deepEqual(validateTask(task), task);
  assert.deepEqual(validateTask({ ...task, date: null, time: null }), { ...task, date: null, time: null });
  for (const value of [{ ...task, date: "2026-02-30" }, { ...task, time: "25:00" }, { ...task, title: 7 }, { ...task, secret: "extra" }, { title: "test" }, []]) {
    assert.throws(() => validateTask(value));
  }
});

test("missing fields are flagged without filling anything", () => {
  const incomplete = { ...task, date: null, time: null };
  assert.equal(taskProblems(incomplete, "Asia/Riyadh").length, 2);
  assert.equal(incomplete.date, null);
  assert.equal(incomplete.time, null);
  assert.deepEqual(taskProblems(task, "Asia/Riyadh"), []);
});

test("selected date/time converts to the correct UTC instant", () => {
  assert.equal(taskStartUtc("2026-10-03", "23:59", "Asia/Riyadh").toISOString(), "2026-10-03T20:59:00.000Z");
  assert.equal(taskStartUtc("2026-10-05", "00:00", "Asia/Riyadh").toISOString(), "2026-10-04T21:00:00.000Z");
  assert.equal(taskStartUtc("2026-07-01", "15:00", "America/New_York").toISOString(), "2026-07-01T19:00:00.000Z");
  assert.equal(taskStartUtc("2026-12-01", "15:00", "America/New_York").toISOString(), "2026-12-01T20:00:00.000Z");
});

test("daylight-saving missing and repeated times require correction", () => {
  assert.throws(() => taskStartUtc("2026-03-08", "02:30", "America/New_York"), /daylight-saving/);
  assert.throws(() => taskStartUtc("2026-11-01", "01:30", "America/New_York"), /daylight-saving/);
});
