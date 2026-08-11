import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  extractJsonObject,
  getValidatedFile,
  RouteError,
  toGeminiInlineData,
} from "@/app/api/_lib/document-parser";

export const runtime = "nodejs";

const ALLOWED_TIMETABLE_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

function buildPrompt(branch: string, semesterNumber: string) {
  return `You are extracting a class schedule from a college timetable document.

The document contains MULTIPLE timetable tables — one for each semester (1st Semester, 3rd Semester, 5th Semester, etc.).

STEP 1 — Find the correct table:
- Scan all table headings/titles in the document.
- Find the table whose heading contains "${semesterNumber} Semester" (e.g. "3rd Semester").
- If you cannot find an exact match, look for the ordinal number (e.g. "3rd", "Third", "III").
- ONLY use that table. Completely ignore all other semester tables.

STEP 2 — Find the correct column:
- Inside the "${semesterNumber} Semester" table, find the column labeled "${branch}".
- Extract ONLY that column's data.

STEP 3 — Extract slots:
- Rows represent time slots (e.g. 09:00–09:50, 10:00–10:50, etc.)
- Columns represent days: Monday=1, Tuesday=2, Wednesday=3, Thursday=4, Friday=5
- Each cell has subject code + teacher initials
- LAB sessions spanning 2 consecutive rows = one slot (start of first row to end of second row)
- Skip empty cells, LUNCH BREAK, LIB, and any free slots

STEP 4 — Fix times:
- Times shown as 01:xx to 06:xx in the afternoon MUST be converted to 24-hour format
- 01:00=13:00, 01:30=13:30, 02:00=14:00, 02:30=14:30, 03:00=15:00, 03:30=15:30, 04:00=16:00, 04:30=16:30, 05:00=17:00
- Morning times (09:xx, 10:xx, 11:xx, 12:xx) stay as-is

Return ONLY this JSON, no explanation, no markdown:
{
  "slots": [
    {
      "day": 1,
      "start_time": "09:00",
      "end_time": "09:50",
      "subject_code": "CA",
      "teacher": "AB"
    }
  ]
}`;
}

function normalizeTime(t: string): string {
  let str = t.trim();
  if (/^\d:\d{2}$/.test(str)) {
    str = "0" + str;
  }
  const match = str.match(/^(\d{2}):(\d{2})$/);
  if (match) {
    let hour = parseInt(match[1], 10);
    const minute = match[2];
    if (hour >= 1 && hour <= 6) {
      hour += 12;
      str = `${hour.toString().padStart(2, "0")}:${minute}`;
    }
  }
  return str;
}

function normalizeSlot(slot: unknown) {
  if (!slot || typeof slot !== "object") {
    throw new RouteError("Gemini returned an invalid slot entry", 502);
  }

  const rawSlot = slot as Record<string, unknown>;
  const rawDay = Number(rawSlot.day);
  const normalizedDay =
    Number.isInteger(rawDay) && rawDay >= 0 && rawDay <= 4 ? rawDay + 1 : rawDay;
  const teacher =
    typeof rawSlot.teacher === "string"
      ? rawSlot.teacher.trim()
      : typeof rawSlot.teacher_initials === "string"
        ? rawSlot.teacher_initials.trim()
        : "";

  if (!Number.isInteger(normalizedDay) || normalizedDay < 1 || normalizedDay > 5) {
    throw new RouteError("Gemini returned a slot with an invalid day value", 502);
  }

  const startTime =
    typeof rawSlot.start_time === "string"
      ? normalizeTime(rawSlot.start_time)
      : "";
  const endTime =
    typeof rawSlot.end_time === "string"
      ? normalizeTime(rawSlot.end_time)
      : "";

  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
    throw new RouteError("Gemini returned a slot with an invalid time value", 502);
  }

  if (typeof rawSlot.subject_code !== "string" || !rawSlot.subject_code.trim()) {
    throw new RouteError(
      "Gemini returned a slot without a subject code",
      502
    );
  }

  return {
    day: normalizedDay,
    start_time: startTime,
    end_time: endTime,
    subject_code: rawSlot.subject_code.trim(),
    teacher,
    room: typeof rawSlot.room === "string" ? rawSlot.room.trim() : "",
  };
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return Response.json(
        { success: false, error: "Missing GEMINI_API_KEY" },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const branch = formData.get("branch")?.toString() || "BCA";
    const semesterNumber = formData.get("semesterNumber")?.toString() || "1st";

    const { file, mimeType } = getValidatedFile(
      formData,
      ["file", "image"],
      ALLOWED_TIMETABLE_MIME_TYPES,
      "a PDF or image file (JPG, PNG, or WEBP)"
    );
    const inlineData = await toGeminiInlineData(file, mimeType);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const result = await model.generateContent([
      buildPrompt(branch, semesterNumber),
      {
        inlineData,
      },
    ]);

    const responseText = result.response.text();
    console.log("GEMINI RAW RESPONSE:", responseText);

    const cleanedText = responseText
      .replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, "$1")
      .trim();

    let rawSlots: unknown[];

    const arrayMatch = cleanedText.match(/\[[\s\S]*\]/);
    const objectMatch = cleanedText.match(/\{[\s\S]*\}/);

    if (
      cleanedText.startsWith("[") ||
      (arrayMatch && (!objectMatch || cleanedText.indexOf("[") < cleanedText.indexOf("{")))
    ) {
      if (!arrayMatch) {
        throw new RouteError("Gemini response was not valid JSON array text", 502);
      }
      rawSlots = JSON.parse(arrayMatch[0]) as unknown[];
    } else {
      const jsonText = extractJsonObject(responseText);
      const parsed = JSON.parse(jsonText) as { slots?: unknown[] };
      if (!parsed || !Array.isArray(parsed.slots)) {
        throw new RouteError("Gemini response did not include a slots array", 502);
      }
      rawSlots = parsed.slots;
    }

    if (!Array.isArray(rawSlots)) {
      throw new RouteError("Gemini response did not contain a slots array", 502);
    }

    const slots = rawSlots.map((slot) => normalizeSlot(slot));

    return Response.json({ success: true, slots });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to parse timetable",
      },
      { status: error instanceof RouteError ? error.status : 500 }
    );
  }
}
