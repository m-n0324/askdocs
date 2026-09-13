import { Router } from "express"
import { chatHandler, streamChatHandler } from "../controllers/chat.controller"
import {
    deleteConversationHandler,
    getConversationHandler,
    listConversationsHandler,
} from "../controllers/conversation.controller"
import {
    addUrlSourceHandler,
    deleteSourceHandler,
    getSourceFileHandler,
    getSourceHandler,
    listSourcesHandler,
    uploadSourceHandler,
} from "../controllers/source.controller"
import { getUsageHandler } from "../controllers/usage.controller"
import {
    createWorkspaceHandler,
    deleteWorkspaceHandler,
    listWorkspacesHandler,
} from "../controllers/workspace.controller"
import { requireAuth } from "../middlewares/auth"
import { apiLimiter, chatLimiter, uploadLimiter } from "../middlewares/rateLimit"
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

scoped.get("/conversations", listConversationsHandler)
scoped.get("/conversations/:conversationId", getConversationHandler)
scoped.delete("/conversations/:conversationId", deleteConversationHandler)

scoped.post("/chat", chatLimiter, chatHandler)
scoped.post("/chat/stream", chatLimiter, streamChatHandler)

scoped.get("/usage", getUsageHandler)

const workspaceRouter = Router()

workspaceRouter.use(requireAuth, apiLimiter)
workspaceRouter.get("/", listWorkspacesHandler)
workspaceRouter.post("/", createWorkspaceHandler)
workspaceRouter.delete("/:workspaceId", deleteWorkspaceHandler)
workspaceRouter.use("/:workspaceId", requireWorkspace, scoped)

export { workspaceRouter }
