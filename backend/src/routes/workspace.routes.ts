import { Router } from "express"
import {
    createWorkspaceHandler,
    deleteWorkspaceHandler,
    listWorkspacesHandler,
} from "../controllers/workspace.controller"
import { requireAuth } from "../middlewares/auth"
import { apiLimiter } from "../middlewares/rateLimit"
import { requireWorkspace } from "../middlewares/workspace"

/**
 * /workspaces/:workspaceId/... routes. `mergeParams` lets them see :workspaceId,
 * and the parent router has already run `requireWorkspace` (the tenant check).
 */
const scoped = Router({ mergeParams: true })

const workspaceRouter = Router()

workspaceRouter.use(requireAuth, apiLimiter)
workspaceRouter.get("/", listWorkspacesHandler)
workspaceRouter.post("/", createWorkspaceHandler)
workspaceRouter.delete("/:workspaceId", deleteWorkspaceHandler)
workspaceRouter.use("/:workspaceId", requireWorkspace, scoped)

export { workspaceRouter }
