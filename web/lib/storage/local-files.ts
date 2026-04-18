import fs from "node:fs/promises";
import path from "node:path";
import { appConfig } from "@/lib/config";

const PROJECT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export class UploadValidationError extends Error {}

export async function saveUploadedPdf(projectId: string, file: File) {
  if (!PROJECT_ID_PATTERN.test(projectId)) {
    throw new UploadValidationError("Invalid project id.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "upload.pdf";
  const uploadRoot = path.resolve(appConfig.uploadRoot);
  const relativePath = path.join(projectId, `${Date.now()}-${safeName}`);
  const absolutePath = path.resolve(uploadRoot, relativePath);
  if (!absolutePath.startsWith(`${uploadRoot}${path.sep}`)) {
    throw new UploadValidationError("Invalid upload path.");
  }

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, bytes);

  return {
    storagePath: absolutePath,
    fileSize: bytes.byteLength,
  };
}
