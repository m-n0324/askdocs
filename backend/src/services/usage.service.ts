import { env } from "../config/env"
import { AppError } from "../lib/errors"
import { logger } from "../lib/logger"
import type { TokenUsage } from "../llm/provider"
import { recordUsageEvent, sumTotalTokens, sumUsageByKind } from "../repositories/usage.repository"
import type { UsageKind } from "../types/domain"

/** Usage is counted per calendar month (UTC). */
export function startOfMonth(now = new Date()): Date {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

export async function trackUsage(input: {
    workspaceId: string
    userId: string | null
    kind: UsageKind
    model: string
    usage: TokenUsage
}): Promise<void> {
    if (input.usage.totalTokens === 0) return
    try {
        await recordUsageEvent({
            workspaceId: input.workspaceId,
            userId: input.userId,
            kind: input.kind,
            model: input.model,
            ...input.usage,
        })
    } catch (err) {
        // Losing one usage row must not fail an answer the user already received, but we want to know
        logger.error(
            { err, workspaceId: input.workspaceId, kind: input.kind },
            "Failed to record usage",
        )
    }
}

/** Cost control: refuse new LLM work once a workspace has used its monthly token budget. */
export async function assertWithinQuota(workspaceId: string): Promise<void> {
    if (env.MONTHLY_TOKEN_QUOTA === 0) return
    const used = await sumTotalTokens(workspaceId, startOfMonth())
    if (used >= env.MONTHLY_TOKEN_QUOTA) {
        throw new AppError(
            429,
            "QUOTA_EXCEEDED",
            "This workspace has used its monthly token quota. It resets at the start of next month.",
        )
    }
}

export async function getUsageSummary(workspaceId: string) {
    const periodStart = startOfMonth()
    const byKind = await sumUsageByKind(workspaceId, periodStart)
    const totals = byKind.reduce(
        (sum, row) => ({
            promptTokens: sum.promptTokens + row.promptTokens,
            completionTokens: sum.completionTokens + row.completionTokens,
            totalTokens: sum.totalTokens + row.totalTokens,
        }),
        { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    )
    return {
        periodStart: periodStart.toISOString(),
        totals,
        byKind: byKind.map(({ kind, totalTokens }) => ({ kind, totalTokens })),
        monthlyQuota: env.MONTHLY_TOKEN_QUOTA || null,
    }
}
