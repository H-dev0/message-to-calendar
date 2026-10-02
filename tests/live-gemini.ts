import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getDateContext, validateTask } from "../src/lib/task";
import { createCalendarEvent } from "../src/lib/calendar";
import ICAL from "ical.js";

const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const timeZone = "Asia/Riyadh";
const fixtures = JSON.parse(readFileSync(new URL("./fixtures/messages.json", import.meta.url), "utf8")) as {
  name: string; message: string; dateRule?: string; date?: string | null; time: string | null;
}[];

async function main() {
  for (const fixture of fixtures) {
    const response = await fetch(new URL("/api/extract-task", baseUrl), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: fixture.message, timeZone }),
    });
    const data = await response.json();
    assert.equal(response.ok, true, `${fixture.name}: ${data.error ?? "Extraction failed"}`);
    const task = validateTask(data.task);
    const context = getDateContext(timeZone, new Date(`${data.referenceDate}T09:00:00Z`));
    let expectedDate = fixture.date;
    if (fixture.dateRule === "today") expectedDate = context.date;
    if (fixture.dateRule === "tomorrow") expectedDate = context.tomorrow;
    if (fixture.dateRule === "nextMonday") expectedDate = context.weekdays.find((day) => day.name === "Monday")!.next;
    if (fixture.dateRule === "Sunday") expectedDate = context.weekdays.find((day) => day.name === "Sunday")!.upcoming;
    assert.equal(task.date, expectedDate, `${fixture.name}: date must match the explicit/relative deadline or stay null`);
    assert.equal(task.time, fixture.time, `${fixture.name}: time must match the deadline or stay null`);
    assert.ok(task.title.trim(), `${fixture.name}: task needs a title`);
    assert.equal(data.timeZone, timeZone);
    if (task.date && task.time) {
      const calendar = new ICAL.Component(ICAL.parse(createCalendarEvent(task, timeZone)));
      const event = new ICAL.Event(calendar.getFirstSubcomponent("vevent")!);
      assert.equal(event.summary, task.title);
      assert.equal(event.description, task.description);
    }
    console.log(`PASS real Gemini: ${fixture.name} (${task.date ?? "missing date"}, ${task.time ?? "missing time"})`);
  }
  console.log(`Real Gemini extraction passed for all ${fixtures.length} messages. No mocked provider responses.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Real Gemini verification failed.");
  process.exitCode = 1;
});
