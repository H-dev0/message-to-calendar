# Message to Calendar

A small web app that turns one university or work message into a calendar event. Paste Arabic or English text, extract the task with Gemini, review/edit the fields, then download an `.ics` file.

## Features

- One text message → one task: title, date, time, description.
- Server-side Gemini extraction with strict JSON and validated fields.
- Relative dates resolved against the current date in your device's time zone.
- Missing or ambiguous dates/times stay blank; download requires you to complete them.
- Editable results, loading/error states, and Start Over.
- UTF-8 iCalendar download with Arabic support, escaped text, CRLF lines, Unicode-safe line folding, and the correct UTC event time.
- No database, account, saved history, calendar API integrations, or reminders.

## Stack

Next.js App Router, React, TypeScript, and the Gemini REST API (`gemini-3.8-flash`). Tests use Node's test runner, tsx, and the independent ical.js parser.

## Run locally

Use Node.js 20.9 or later and npm.

```sh
npm install
cp .env.example .env.local
npm run dev
```

On Windows PowerShell, replace `cp` with `Copy-Item .env.example .env.local`. Open http://localhost:3000.

Edit `.env.local` in the **project root**:

```dotenv
GEMINI_API_KEY=your_actual_gemini_api_key
```

Get a key from [Google AI Studio](https://aistudio.google.com/apikey). Enable Gemini API access for the key. Restart the local server after changing the key if it has not reloaded it. Never paste a key into source code or use a `NEXT_PUBLIC_` key variable. `.env.local` is ignored by Git and the key is used only by `/api/extract-task` on the server. The checked-in `.env.example` contains a placeholder only.

No extraction is mocked when a key is missing or invalid; the app displays an error. Messages are sent to Google's Gemini API for processing; the app does not persist them.

## Date interpretation

- `today` and `tomorrow` use the server's current instant in the browser's automatically detected IANA time zone.
- A bare weekday means the upcoming occurrence, including today. `next Monday` means the next strictly future Monday (seven days later when today is Monday).
- `tonight` resolves the date but leaves the time blank unless an exact time is present.
- `end of day` means 23:59 on the specified day, or today if no other day is given.
- `11:59 PM` means 23:59. A time without a date does not imply today.
- Unclear AM/PM, ambiguous numeric dates, missing years in explicit month/day dates, and unspecified deadlines require manual correction.

The UI shows the reference date and time zone. Always review the extracted values, especially for messages written on an earlier day.

## Calendar files

The reviewed local date/time is converted to a UTC `DTSTART`, so imports preserve the instant. A deadline is represented as a single `VEVENT` at its due time. No event duration or alarm is invented. [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545) allows a date-time event without `DTEND` to end at its start time. Open/import the downloaded file in a calendar app; import dialogs and displayed default durations differ between apps.

## Checks

```sh
npm test
npm run lint
npm run typecheck
npm run build
```

`npm test` covers Gregorian validation, relative-date reference context, time-zone conversion, daylight-saving ambiguity, strict task validation, API request validation and missing-key errors, and independently parsed calendar output (Arabic, punctuation, line folding, injection prevention, manual corrections).

Real extraction examples are in `tests/fixtures/messages.json`: tomorrow at 11:59 PM, next Monday at 3 PM, an Arabic dated task, no clear date, commas/quotes/Arabic, Sunday, tonight, end of day, and ambiguous input. Real API verification requires a valid local key and available Gemini quota. With the web server running, use `npm run test:live` (or set `TEST_BASE_URL` for another local port). This calls the real server and Gemini; it does not use mocks.

## Known limitations

- AI can misinterpret natural language. Review/edit every result before downloading.
- One task per message; multiple tasks, OCR/images, Hijri conversion, and recurrence are outside this project.
- Messages specifying a different time zone require manual correction into your device's zone.
- Missing or repeated local times during a daylight-saving transition must be corrected rather than guessed.
- Gemini availability, model access, internet connectivity, and account quotas affect extraction.
- Refreshing the page clears the current message/results. Calendar imports are manual.

## Project status

Complete implementation. Real Gemini extraction and the full extract/edit/download browser flow are pending verification with a valid project-local `GEMINI_API_KEY`. The unit tests, build, lint, typecheck, and mobile page/error/reset checks pass; no real extraction pass is claimed without credentials.
