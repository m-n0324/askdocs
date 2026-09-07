import { Router } from "express"
import {
    addUrlSourceHandler,
    deleteSourceHandler,
    getSourceFileHandler,
    getSourceHandler,
    listSourcesHandler,
    uploadSourceHandler,
} from "../controllers/source.controller"
import {
    createWorkspaceHandler,
    deleteWorkspaceHandler,
    listWorkspacesHandler,
} from "../controllers/workspace.controller"
import { requireAuth } from "../middlewares/auth"
import { apiLimiter, uploadLimiter } from "../middlewares/rateLimit"
import { uploadSingleFile } from "../middlewares/upload"
import { requireWorkspace } from "../middlewares/workspace"

/**
 * /workspaces/:workspaceId/... routes. `mergeParams` lets them see :workspaceId,
 * and the parent router has already run `requireWorkspace` (the tenant check).
 */
const scoped = Router({ mergeParams: true })

scoped.get("/sources", listSourcesHandler)
scoped.post("/sources/upload", uploadLimiter, uploadSingleFile, uploadSourceHandler)
scoped.post("/sources/url", uploadLimiter, addUrlSourceHandler)
scoped.get("/sources/:sourceId", getSourceHandler)
scoped.get("/sources/:sourceId/file", getSourceFileHandler)
scoped.delete("/sources/:sourceId", deleteSourceHandler)

const workspaceRouter = Router()

workspaceRouter.use(requireAuth, apiLimiter)
workspaceRouter.get("/", listWorkspacesHandler)
workspaceRouter.post("/", createWorkspaceHandler)
workspaceRouter.delete("/:workspaceId", deleteWorkspaceHandler)
workspaceRouter.use("/:workspaceId", requireWorkspace, scoped)

export { workspaceRouter }
