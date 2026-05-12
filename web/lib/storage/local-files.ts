import fs from "node:fs/promises";
import path from "node:path";
import { appConfig } from "@/lib/config";

const PROJECT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export class UploadValidationError extends Error {}

export async function saveUploadedDocument(projectId: string, file: File) {
  if (!PROJECT_ID_PATTERN.test(projectId)) {
    throw new UploadValidationError("Invalid project id.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || defaultUploadName(file.type);
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

export const saveUploadedPdf = saveUploadedDocument;

function defaultUploadName(mimeType: string) {
  if (mimeType === "application/pdf") return "upload.pdf";
  if (mimeType === "application/msword") return "upload.doc";
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return "upload.docx";
  }
  if (mimeType === "application/vnd.ms-excel") return "upload.xls";
  if (mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    return "upload.xlsx";
  }
  if (mimeType === "application/vnd.ms-powerpoint") return "upload.ppt";
  if (mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
    return "upload.pptx";
  }
  return "upload";
}
