import type { Request, Response } from "express"
import { getUserId } from "../middlewares/auth"
import { sendData } from "../lib/response"
import { parseId, workspaceSchema } from "../schemas"
import { addWorkspace, listWorkspaces, removeWorkspace } from "../services/workspace.service"

export async function listWorkspacesHandler(req: Request, res: Response): Promise<void> {
    sendData(res, await listWorkspaces(getUserId(req)))
}

export async function createWorkspaceHandler(req: Request, res: Response): Promise<void> {
    const { name } = workspaceSchema.parse(req.body)
    sendData(res, await addWorkspace(getUserId(req), name), 201)
}

export async function deleteWorkspaceHandler(req: Request, res: Response): Promise<void> {
    await removeWorkspace(getUserId(req), parseId(req.params.workspaceId, "Workspace"))
    sendData(res, { deleted: true })
}
