import { prisma } from "../lib/prisma"
import type { UsageKind } from "../types/domain"

export interface UsageEventInput {
    workspaceId: string
    userId: string | null
    kind: UsageKind
    model: string
    promptTokens: number
    completionTokens: number
    totalTokens: number
}

export async function recordUsageEvent(event: UsageEventInput): Promise<void> {
    await prisma.usageEvent.create({ data: event })
}

export async function sumUsageByKind(workspaceId: string, since: Date) {
    const groups = await prisma.usageEvent.groupBy({
        by: ["kind"],
        where: { workspaceId, createdAt: { gte: since } },
        _sum: { promptTokens: true, completionTokens: true, totalTokens: true },
    })
    return groups.map((group) => ({
        kind: group.kind,
        promptTokens: group._sum.promptTokens ?? 0,
        completionTokens: group._sum.completionTokens ?? 0,
        totalTokens: group._sum.totalTokens ?? 0,
    }))
}

export async function sumTotalTokens(workspaceId: string, since: Date): Promise<number> {
    const result = await prisma.usageEvent.aggregate({
        where: { workspaceId, createdAt: { gte: since } },
        _sum: { totalTokens: true },
    })
    return result._sum.totalTokens ?? 0
}
