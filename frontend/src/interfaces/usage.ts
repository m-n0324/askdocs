export type UsageKind = "chat" | "embedding" | "rewrite";

export interface IUsage {
  periodStart: string;
  totals: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  byKind: { kind: UsageKind; totalTokens: number }[];
  monthlyQuota: number | null;
}
