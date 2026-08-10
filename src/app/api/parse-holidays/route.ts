import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  extractJsonObject,
  getValidatedFile,
  RouteError,
  toGeminiInlineData,
} from "@/app/api/_lib/document-parser";

export const runtime = "nodejs";

const ALLOWED_HOLIDAY_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

function buildPrompt() {
  return `
You are reading a holiday notice image or PDF.

Extract every holiday entry that has both a clear date and a clear reason.

Rules:
- Accept PDF or image content.
- Extract all holiday dates and reasons.
- Normalize each date to YYYY-MM-DD.
- If the document shows dates without a year, use the year printed elsewhere on the same document.
- If a date is incomplete, ambiguous, or the reason is missing, skip that entry.
- Return JSON only with this exact shape:
{
  "holidays": [
    {
      "date": "2026-08-15",
      "reason": "Independence Day"
    }
  ]
}
`;
}

function normalizeHoliday(holiday: unknown) {
  if (!holiday || typeof holiday !== "object") {
    throw new RouteError("Gemini returned an invalid holiday entry", 502);
  }

  const rawHoliday = holiday as Record<string, unknown>;

  if (
    typeof rawHoliday.date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(rawHoliday.date)
  ) {
    throw new RouteError(
      "Gemini returned a holiday with an invalid date format",
      502
    );
  }

  if (typeof rawHoliday.reason !== "string" || !rawHoliday.reason.trim()) {
    throw new RouteError(
      "Gemini returned a holiday without a reason",
      502
    );
  }

  return {
    date: rawHoliday.date,
    reason: rawHoliday.reason.trim(),
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
      ["file", "image"],
      ALLOWED_HOLIDAY_MIME_TYPES,
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
    const parsed = JSON.parse(jsonText) as { holidays?: unknown };

    if (!parsed || !Array.isArray(parsed.holidays)) {
      throw new RouteError(
        "Gemini response did not include a holidays array",
        502
      );
    }

    const holidays = parsed.holidays.map((holiday) => normalizeHoliday(holiday));

    return Response.json({ success: true, holidays });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to parse holidays",
      },
      { status: error instanceof RouteError ? error.status : 500 }
    );
  }
}
