import { env } from "../config/env"
import { AppError, notFound } from "../lib/errors"
import { logger } from "../lib/logger"
import {
    countWorkspacesForOwner,
    createWorkspace,
    deleteWorkspace,
    listWorkspacesForOwner,
} from "../repositories/workspace.repository"
import { listSources } from "../repositories/source.repository"
import type { Workspace } from "../types/domain"
import { deleteStoredFile } from "./storage.service"

export const listWorkspaces = (userId: string): Promise<Workspace[]> =>
    listWorkspacesForOwner(userId)

/** Capped per user: each workspace has its own token quota, so unlimited workspaces = unlimited spend. */
export async function addWorkspace(userId: string, name: string): Promise<Workspace> {
    if ((await countWorkspacesForOwner(userId)) >= env.MAX_WORKSPACES_PER_USER) {
        throw new AppError(
            409,
            "LIMIT_REACHED",
            `You can have at most ${env.MAX_WORKSPACES_PER_USER} workspaces. Delete one to create another.`,
        )
    }
    return createWorkspace(userId, name)
}

/** Deleting a workspace cascades to all its data in Postgres; uploaded files are removed here. */
export async function removeWorkspace(userId: string, workspaceId: string): Promise<void> {
    const sources = await listSources(workspaceId)
    if (!(await deleteWorkspace(workspaceId, userId))) throw notFound("Workspace")

    const fileKeys = sources.flatMap((source) => (source.storageKey ? [source.storageKey] : []))
    const results = await Promise.allSettled(fileKeys.map(deleteStoredFile))
    const failures = results.filter((result) => result.status === "rejected")
    if (failures.length > 0) {
        logger.error(
            { workspaceId, failures: failures.length },
            "Some uploaded files could not be deleted",
        )
    }
}
