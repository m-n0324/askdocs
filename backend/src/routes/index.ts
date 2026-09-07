import { Router } from "express"
import { authRouter } from "./auth.routes"
import { healthRouter } from "./health.routes"
import { workspaceRouter } from "./workspace.routes"

/**
 * API Router for the application.
 *
 * Combines all the routes in one application router.
 */
const apiRouter = Router()

apiRouter.use(healthRouter)
apiRouter.use("/auth", authRouter)
apiRouter.use("/workspaces", workspaceRouter)

export { apiRouter }
