export type SourceStatus = "pending" | "processing" | "ready" | "failed";
export type SourceType = "file" | "url";

export interface ISource {
  id: string;
  workspaceId: string;
  type: SourceType;
  name: string;
  url: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  status: SourceStatus;
  error: string | null;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface IAddUrlSourceInput {
  url: string;
  maxDepth?: number;
  maxPages?: number;
}
