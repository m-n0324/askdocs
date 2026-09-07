import { prisma } from "../lib/prisma"
import type { Workspace } from "../types/domain"

const toWorkspace = (row: { id: string; name: string; createdAt: Date }): Workspace => ({
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
})

export async function createWorkspace(ownerId: string, name: string): Promise<Workspace> {
    return toWorkspace(await prisma.workspace.create({ data: { ownerId, name } }))
}

export async function listWorkspacesForOwner(ownerId: string): Promise<Workspace[]> {
    const rows = await prisma.workspace.findMany({
        where: { ownerId },
        orderBy: { createdAt: "desc" },
    })
    return rows.map(toWorkspace)
}

export async function countWorkspacesForOwner(ownerId: string): Promise<number> {
    return prisma.workspace.count({ where: { ownerId } })
}

/** The tenant check: a workspace is only visible to its owner. */
export async function findWorkspaceForOwner(
    workspaceId: string,
    ownerId: string,
): Promise<Workspace | null> {
    const row = await prisma.workspace.findFirst({ where: { id: workspaceId, ownerId } })
    return row ? toWorkspace(row) : null
}

/** Sources, chunks, conversations, and usage are removed by ON DELETE CASCADE. */
export async function deleteWorkspace(workspaceId: string, ownerId: string): Promise<boolean> {
    const { count } = await prisma.workspace.deleteMany({ where: { id: workspaceId, ownerId } })
    return count > 0
}
