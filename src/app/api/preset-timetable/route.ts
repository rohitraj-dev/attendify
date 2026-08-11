import { NextRequest } from "next/server";
import path from "path";
import fs from "fs";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const college = searchParams.get("college");
  const branch = searchParams.get("branch");
  const semesterNumber = searchParams.get("semesterNumber");

  if (!college || !branch || !semesterNumber) {
    return Response.json(
      { success: false, error: "Missing college, branch, or semesterNumber" },
      { status: 400 }
    );
  }

  // Build filename from params
  const slug = `${college}-${branch}-${semesterNumber}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const filePath = path.join(process.cwd(), "src", "presets", `${slug}.json`);

  if (!fs.existsSync(filePath)) {
    return Response.json(
      { success: false, error: "No preset found for this combination" },
      { status: 404 }
    );
  }

  const preset = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return Response.json({ success: true, slots: preset.slots });
}
