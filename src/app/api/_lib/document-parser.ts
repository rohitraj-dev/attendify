import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const EXTENSION_TO_MIME_TYPE: Record<string, string> = {
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".webp": "image/webp",
};

export class RouteError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "RouteError";
  }
}

export function extractJsonObject(text: string) {
  const trimmed = text.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new RouteError("Model response was not valid JSON object text", 502);
  }

  return trimmed.slice(start, end + 1);
}

export function getValidatedFile(
  formData: FormData,
  fieldNames: string[],
  allowedMimeTypes: string[],
  expectedDescription: string
) {
  for (const fieldName of fieldNames) {
    const candidate = formData.get(fieldName);

    if (!(candidate instanceof File)) {
      continue;
    }

    const detectedMimeType = detectMimeType(candidate);

    if (!detectedMimeType || !allowedMimeTypes.includes(detectedMimeType)) {
      throw new RouteError(
        `Unsupported file type for "${fieldName}". Upload ${expectedDescription}.`,
        400
      );
    }

    return {
      file: candidate,
      mimeType: detectedMimeType,
    };
  }

  const fieldList = fieldNames.map((fieldName) => `"${fieldName}"`).join(" or ");
  throw new RouteError(`Missing file upload in field ${fieldList}.`, 400);
}

export async function toGeminiInlineData(file: File, mimeType: string) {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (mimeType === "application/pdf") {
    const pngBuffer = await convertPdfFirstPageToPng(buffer);

    return {
      mimeType: "image/png",
      data: pngBuffer.toString("base64"),
    };
  }

  return {
    mimeType,
    data: buffer.toString("base64"),
  };
}

function detectMimeType(file: File) {
  if (file.type && Object.values(EXTENSION_TO_MIME_TYPE).includes(file.type)) {
    return file.type;
  }

  const lowercaseName = file.name.toLowerCase();
  const extension = Object.keys(EXTENSION_TO_MIME_TYPE).find((candidate) =>
    lowercaseName.endsWith(candidate)
  );

  return extension ? EXTENSION_TO_MIME_TYPE[extension] : null;
}

async function convertPdfFirstPageToPng(pdfBuffer: Buffer) {
  const sharpBuffer = await tryConvertPdfWithSharp(pdfBuffer);

  if (sharpBuffer) {
    return sharpBuffer;
  }

  return convertPdfWithPdftoppm(pdfBuffer);
}

async function tryConvertPdfWithSharp(pdfBuffer: Buffer) {
  try {
    const sharpModule = await import("sharp");
    return await sharpModule
      .default(pdfBuffer, { density: 200, page: 0 })
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}

async function convertPdfWithPdftoppm(pdfBuffer: Buffer) {
  const tempDirectory = await mkdtemp(join(tmpdir(), "attendify-pdf-"));
  const inputPath = join(tempDirectory, "input.pdf");
  const outputBasePath = join(tempDirectory, "output");
  const outputPath = `${outputBasePath}.png`;

  try {
    await writeFile(inputPath, pdfBuffer);
    await execFileAsync("pdftoppm", [
      "-f",
      "1",
      "-l",
      "1",
      "-singlefile",
      "-png",
      inputPath,
      outputBasePath,
    ]);

    return await readFile(outputPath);
  } catch (error) {
    throw new RouteError(
      error instanceof Error
        ? `Failed to convert uploaded PDF: ${error.message}`
        : "Failed to convert uploaded PDF",
      500
    );
  } finally {
    await rm(tempDirectory, { force: true, recursive: true });
  }
}
