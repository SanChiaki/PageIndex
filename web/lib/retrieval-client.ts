import { appConfig } from "@/lib/config";

export type RetrievalCitation = {
  projectId: string;
  projectName: string;
  documentId: string;
  documentName: string;
  pages: string;
};

export type RetrievalResult = {
  answer: string;
  citations: RetrievalCitation[];
  selectedDocuments: Array<{ documentId: string }>;
};

export async function sendRetrievalQuery(input: {
  query: string;
  projectIds: string[];
}) {
  if (input.projectIds.length === 0) {
    throw new Error("projectIds must not be empty");
  }

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
