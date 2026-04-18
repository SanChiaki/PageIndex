import fs from "node:fs/promises";
import path from "node:path";
import { appConfig } from "@/lib/config";

export async function saveUploadedPdf(projectId: string, file: File) {
  const bytes = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const relativePath = path.join(projectId, `${Date.now()}-${safeName}`);
  const absolutePath = path.join(appConfig.uploadRoot, relativePath);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, bytes);

  return {
    storagePath: absolutePath,
    fileSize: bytes.byteLength,
  };
}
