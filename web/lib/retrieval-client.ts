import { appConfig } from "@/lib/config";

export type RetrievalCitation = {
  projectId: string;
  projectName: string;
  documentId: string;
  documentName: string;
  pages: string;
  focusPage?: number;
  excerpt?: string;
};

export type RetrievalEvidence = {
  projectId?: string;
  projectName: string;
  documentId?: string;
  documentName: string;
  sourceRelativePath?: string | null;
  projectRelativePath?: string | null;
  pages: string;
  evidenceKind: string;
  excerpt?: string | null;
  content: string;
  visualAssets?: Array<Record<string, unknown>>;
};

export type RetrievalMode = "answer" | "evidence";

export type RetrievalResult = {
  answer: string;
  citations: RetrievalCitation[];
  selectedDocuments: Array<{ documentId: string; sourceRelativePath?: string | null }>;
  evidence: RetrievalEvidence[];
};

export async function sendRetrievalQuery(input: {
  query: string;
  projectIds?: string[];
  mode?: RetrievalMode;
}) {
  const response = await fetch(`${appConfig.retrievalBaseUrl}/internal/retrieve/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`retrieval failed with status ${response.status}`);
  }
  return (await response.json()) as RetrievalResult;
}
