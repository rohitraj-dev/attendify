import { GoogleGenerativeAI } from "@google/generative-ai";

function buildPrompt(branch: string) {
  return `This timetable has multiple branches. Extract ONLY the classes for branch: ${branch}. Each cell contains subject code, teacher initials (underlined), and sometimes an explicit room number. Return JSON array with fields: day (0=Mon to 4=Fri), start_time, end_time, subject_code, teacher_initials, room. Return only the JSON array, nothing else.`;
}

function extractJsonArray(text: string) {
  const trimmed = text.trim();

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed;
  }

  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model response was not valid JSON array text");
  }

  return trimmed.slice(start, end + 1);
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
    const image = formData.get("image");
    const branch = formData.get("branch");

    if (!(image instanceof File)) {
      return Response.json(
        { success: false, error: 'Missing image file in field "image"' },
        { status: 400 }
      );
    }

    if (typeof branch !== "string" || !branch.trim()) {
      return Response.json(
        { success: false, error: 'Missing branch in field "branch"' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const imageBase64 = buffer.toString("base64");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

    const result = await model.generateContent([
      buildPrompt(branch),
      {
        inlineData: {
          mimeType: image.type || "image/png",
          data: imageBase64,
        },
      },
    ]);

    const responseText = result.response.text();
    const jsonText = extractJsonArray(responseText);
    const slots = JSON.parse(jsonText);

    if (!Array.isArray(slots)) {
      throw new Error("Parsed response was not an array");
    }

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
      { status: 500 }
    );
  }
}
