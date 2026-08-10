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
