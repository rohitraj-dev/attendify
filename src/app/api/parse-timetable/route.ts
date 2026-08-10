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

function buildPrompt() {
  return `
You are reading a weekly class timetable image or PDF.

Extract ONLY the BCA column. Ignore every other branch or section.

Rules:
- Work only with Monday through Friday.
- For each non-empty BCA timetable cell, extract:
  - subject_code
  - teacher
  - room
- If a cell is empty or contains only a dash, skip it.
- Handle merged cells correctly:
  - if the same class spans multiple timetable rows, treat it as one slot
  - use the full merged time block as the slot's time range
- Return 24-hour times in HH:MM format.
- Return day as a number where 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday.
- Return JSON only, with this exact shape:
{
  "slots": [
    {
      "day": 1,
      "start_time": "09:00",
      "end_time": "10:00",
      "subject_code": "BCA101",
      "teacher": "AB",
      "room": "204"
    }
  ]
}
`;
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

  if (
    typeof rawSlot.start_time !== "string" ||
    !/^\d{2}:\d{2}$/.test(rawSlot.start_time) ||
    typeof rawSlot.end_time !== "string" ||
    !/^\d{2}:\d{2}$/.test(rawSlot.end_time)
  ) {
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
    start_time: rawSlot.start_time,
    end_time: rawSlot.end_time,
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
    const { file, mimeType } = getValidatedFile(
      formData,
      ["image"],
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
      buildPrompt(),
      {
        inlineData,
      },
    ]);

    const responseText = result.response.text();
    const jsonText = extractJsonObject(responseText);
    const parsed = JSON.parse(jsonText) as { slots?: unknown };

    if (!parsed || !Array.isArray(parsed.slots)) {
      throw new RouteError("Gemini response did not include a slots array", 502);
    }

    const slots = parsed.slots.map((slot) => normalizeSlot(slot));

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
