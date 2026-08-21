import { NextRequest } from "next/server";
import path from "path";
import fs from "fs";

export const runtime = "nodejs";

const PRESET_MAP: Record<string, string> = {
  "bit-mesra-deoghar-campus|bca|3rd": "bit-mesra-deoghar-bca-3rd",
  "bit-mesra-deoghar-campus|bsc|3rd": "bit-mesra-deoghar-bsc-3rd",
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const college = (searchParams.get("college") ?? "").toLowerCase().trim();
  const branch = (searchParams.get("branch") ?? "").toLowerCase().trim();
  const semesterNumber = (searchParams.get("semesterNumber") ?? "").toLowerCase().trim();

  if (!college || !branch || !semesterNumber) {
    return Response.json(
      { success: false, error: "Missing college, branch, or semesterNumber" },
      { status: 400 }
    );
  }

  const collegeSlug = college.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const key = `${collegeSlug}|${branch}|${semesterNumber}`;
  const fileName = PRESET_MAP[key];

  if (!fileName) {
    return Response.json(
      { success: false, error: `No preset found for: ${key}` },
      { status: 404 }
    );
  }

  const filePath = path.join(process.cwd(), "src", "presets", `${fileName}.json`);

  if (!fs.existsSync(filePath)) {
    return Response.json(
      { success: false, error: "Preset file missing on server" },
      { status: 404 }
    );
  }

  const preset = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return Response.json({ success: true, slots: preset.slots, holidays: preset.holidays ?? [] });
}
