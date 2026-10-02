import { extractionInstructions, taskResponseSchema } from "@/lib/extraction";
import { getDateContext, isValidTimeZone, MAX_MESSAGE_LENGTH, validateTask } from "@/lib/task";

export const runtime = "nodejs";

function failure(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let input: unknown;
  try {
    const body = await request.text();
    if (body.length > 65_000) return failure("Message is too long. Use at most 10,000 characters.", 413);
    input = JSON.parse(body);
  } catch {
    return failure("Send a valid message.", 400);
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) return failure("Send a valid message.", 400);
  const { message, timeZone } = input as Record<string, unknown>;
  if (typeof message !== "string" || !message.trim() || message.length > MAX_MESSAGE_LENGTH) {
    return failure("Paste one message between 1 and 10,000 characters.", 400);
  }
  if (!isValidTimeZone(timeZone)) return failure("Your device time zone could not be read. Check your device settings.", 400);

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    return failure("Gemini is not configured. Add GEMINI_API_KEY to the server's .env.local file.", 503);
  }

  const now = new Date();
  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: extractionInstructions(timeZone, now) }] },
        contents: [{ role: "user", parts: [{ text: message }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: taskResponseSchema, maxOutputTokens: 4096 },
      }),
    });
    if (!response.ok) {
      if (response.status === 429) return failure("Gemini's usage limit was reached. Please try again later.", 429);
      if (response.status === 400 || response.status === 401 || response.status === 403) {
        return failure("Gemini rejected the request. Check the server API key and its API access, then try again.", 502);
      }
      return failure("Gemini is temporarily unavailable. Please try again.", 502);
    }
    const result = await response.json();
    const candidate = result.candidates?.[0];
    if (candidate?.finishReason !== "STOP") return failure("Gemini could not extract this message. Try clearer wording.", 422);
    const text = candidate.content?.parts?.filter((part: { thought?: boolean; text?: string }) => !part.thought && typeof part.text === "string")
      .map((part: { text: string }) => part.text).join("");
    if (!text) return failure("Gemini returned no task. Try a clearer message.", 422);
    const task = validateTask(JSON.parse(text));
    const context = getDateContext(timeZone, now);
    return Response.json({ task, referenceDate: context.date, timeZone }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      return failure("Extraction timed out. Please try again.", 504);
    }
    // Provider responses and secrets are never forwarded to the browser or logs.
    return failure("Extraction failed. Check your connection and try a clearer message.", 502);
  }
}
