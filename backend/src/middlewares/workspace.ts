import type { NextFunction, Request, Response } from "express"
import { notFound } from "../lib/errors"
import { findWorkspaceForOwner } from "../repositories/workspace.repository"
import { parseId } from "../schemas"
import type { Workspace } from "../types/domain"
import { getUserId } from "./auth"

/**
 * THE TENANT GATE. Every /workspaces/:workspaceId/* route passes through here.
 * It loads the workspace only if it belongs to the logged-in user. Otherwise 404,
 * not 403, so we don't even reveal that the workspace exists.
 * After this, handlers use `req.workspace.id` to scope every query.
 */
export async function requireWorkspace(
    req: Request,
    _res: Response,
    next: NextFunction,
): Promise<void> {
    const workspaceId = parseId(req.params.workspaceId, "Workspace")
    const workspace = await findWorkspaceForOwner(workspaceId, getUserId(req))
    if (!workspace) throw notFound("Workspace")
    req.workspace = workspace
    next()
}

export function getWorkspace(req: Request): Workspace {
    if (!req.workspace) throw notFound("Workspace")
    return req.workspace
}
