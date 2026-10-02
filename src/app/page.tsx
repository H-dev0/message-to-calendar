"use client";

import { useState, type FormEvent } from "react";
import { createCalendarEvent } from "@/lib/calendar";
import { MAX_MESSAGE_LENGTH, taskProblems, validateTask, type Task } from "@/lib/task";

export default function Home() {
  const [message, setMessage] = useState("");
  const [task, setTask] = useState<Task | null>(null);
  const [timeZone, setTimeZone] = useState("");
  const [referenceDate, setReferenceDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const problems = task ? taskProblems(task, timeZone) : [];

  async function extract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    setTask(null);
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const response = await fetch("/api/extract-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), timeZone: zone }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Extraction failed. Please try again.");
      const extracted = validateTask(data.task);
      setTimeZone(data.timeZone);
      setReferenceDate(data.referenceDate);
      setTask(extracted);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Extraction failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function update(field: keyof Task, value: string) {
    setTask((current) => current ? { ...current, [field]: value } : current);
    setNotice("");
    setError("");
  }

  function download() {
    if (!task) return;
    try {
      const calendar = createCalendarEvent(task, timeZone);
      const url = URL.createObjectURL(new Blob([calendar], { type: "text/calendar;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "calendar-event.ics";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setNotice("Calendar file downloaded. Open it in your calendar app. / افتح الملف في تطبيق التقويم.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the calendar file.");
    }
  }

  function reset() {
    setMessage(""); setTask(null); setTimeZone(""); setReferenceDate(""); setError(""); setNotice("");
  }

  return (
    <main className="shell">
      <header className="intro">
        <span className="brand-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 11h18m-13 5 3 3 5-5" />
          </svg>
        </span>
        <div>
          <p className="eyebrow">ONE MESSAGE. ONE EVENT.</p>
          <h1>Message to Calendar</h1>
          <p className="subtitle">Paste a message. Review the details. Take it to your calendar.</p>
          <p className="arabic-intro" lang="ar" dir="rtl">حوّل رسالة الدراسة أو العمل إلى موعد في تقويمك.</p>
        </div>
      </header>

      <div className="workspace">
        <section className="card" aria-labelledby="message-heading">
          <div className="section-heading"><span className="step">1</span><h2 id="message-heading">Paste your message</h2></div>
          <p className="hint">One task, in Arabic or English. Include the date and time if you know them.</p>
          <form onSubmit={extract}>
            <label htmlFor="message">Message <span lang="ar">/ الرسالة</span></label>
            <textarea id="message" className="message-input" dir="auto" value={message}
              onChange={(event) => setMessage(event.target.value)} maxLength={MAX_MESSAGE_LENGTH}
              disabled={busy} required placeholder="Submit the assignment tomorrow at 11:59 PM." />
            <div className="input-caption"><span>Text only · One task</span><span>{message.length.toLocaleString()} / 10,000</span></div>
            <button className="primary full" type="submit" disabled={busy || !message.trim()}>
              {busy ? <><span className="spinner" aria-hidden="true" /> Extracting task…</> : "Extract Task"}
            </button>
          </form>
          <p className="privacy-note">Your message is sent to Gemini for extraction. No account or saved history.</p>
        </section>

        <section className="card result-card" aria-labelledby="result-heading" aria-busy={busy}>
          <div className="section-heading"><span className="step">2</span><h2 id="result-heading">Review & download</h2></div>
          <p className="hint">Check every value before adding it to your calendar.</p>
          {!task ? (
            <div className="empty-state" role="status">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M8 3h8l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h3Z" /><path d="M15 3v5h5M8 12h8m-8 4h5" /></svg>
              <p>{busy ? "Reading your message…" : "Your task details will appear here."}</p>
              <span>{busy ? "Resolving dates using today in your device's time zone." : "Missing or unclear dates stay blank for you to fill."}</span>
            </div>
          ) : (
            <div className="result-form">
              <p className="reference">Dates resolved against <strong>{referenceDate}</strong> · <bdi>{timeZone}</bdi></p>
              {problems.length > 0 && (
                <div className="feedback warning" role="status">
                  <strong>Details needed / أكمل البيانات</strong>
                  <ul>{problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>
                </div>
              )}
              <label htmlFor="title">Title <span lang="ar">/ العنوان</span></label>
              <input id="title" dir="auto" value={task.title} maxLength={400} onChange={(event) => update("title", event.target.value)} aria-invalid={!task.title.trim()} />
              <div className="date-time-fields">
                <div><label htmlFor="date">Date <span lang="ar">/ التاريخ</span></label>
                  <input id="date" type="date" value={task.date ?? ""} min="1000-01-01" max="9999-12-31" onChange={(event) => update("date", event.target.value)} aria-invalid={!task.date} />
                </div>
                <div><label htmlFor="time">Time <span lang="ar">/ الوقت</span></label>
                  <input id="time" type="time" value={task.time ?? ""} onChange={(event) => update("time", event.target.value)} aria-invalid={!task.time} />
                </div>
              </div>
              <label htmlFor="description">Description <span lang="ar">/ الوصف</span></label>
              <textarea id="description" dir="auto" value={task.description} maxLength={MAX_MESSAGE_LENGTH} onChange={(event) => update("description", event.target.value)} />
              <p className="hint time-note">Time uses <bdi>{timeZone}</bdi>. A deadline becomes an event at that exact time; no duration is added.</p>
              <button className="primary full" type="button" onClick={download} disabled={problems.length > 0}>Download Calendar Event (.ics)</button>
            </div>
          )}
        </section>
      </div>

      {error && <div className="feedback error" role="alert">{error}</div>}
      {notice && <div className="feedback success" role="status">{notice}</div>}
      <footer><p>AI may misread a message. Your review is the final step.</p><button className="secondary" type="button" onClick={reset} disabled={busy || (!message && !task && !error)}>Start Over</button></footer>
    </main>
  );
}
