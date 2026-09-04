import { Router } from "express"
import { healthRouter } from "./health.routes"

/**
 * API Router for the application.
 *
 * Combines all the routes in one application router.
 */
const apiRouter = Router()

apiRouter.use(healthRouter)

export { apiRouter }
