import { Router } from "express"
import { authRouter } from "./auth.routes"
import { healthRouter } from "./health.routes"

/**
 * API Router for the application.
 *
 * Combines all the routes in one application router.
 */
const apiRouter = Router()

apiRouter.use(healthRouter)
apiRouter.use("/auth", authRouter)

export { apiRouter }
