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
  return `You are parsing a college timetable PDF with multiple semester tables and multiple branch columns.

IMPORTANT:
- Extract ONLY from the "${semesterNumber} Semester" table
- Extract ONLY the "${branch}" column
- Days are columns: Monday=1, Tuesday=2, Wednesday=3, Thursday=4, Friday=5
- Detect time slots from the table rows automatically
- LAB sessions spanning 2 rows = one slot (start of first row to end of second row)
- Each cell has subject code + teacher initials

Return ONLY JSON, no explanation:
{
  "slots": [
    {
      "day": 1,
      "start_time": "09:00",
      "end_time": "09:50", 
      "subject_code": "CA",
      "teacher": "teacher initials"
    }
  ]
}

Skip empty cells, LUNCH BREAK, and LIB slots.
Time format: HH:MM 24-hour.`;
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
