import type { ICitation, IMessage } from "@/interfaces";

export const makeCitation = (overrides: Partial<ICitation> = {}): ICitation => ({
  index: 1,
  chunkId: "chunk-1",
  sourceId: "source-1",
  sourceName: "handbook.pdf",
  sourceType: "file",
  page: 4,
  section: "Refunds",
  url: null,
  snippet: "Refunds are issued within 14 days.",
  score: 0.82,
  ...overrides,
});

export const makeMessage = (overrides: Partial<IMessage> = {}): IMessage => ({
  id: "message-1",
  role: "assistant",
  content: "Answer",
  citations: [],
  createdAt: "2026-10-02T10:00:00.000Z",
  ...overrides,
});
