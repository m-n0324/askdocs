import { Router } from "express"

const healthRouter = Router()

/** Liveness: the process is up. Polled by Docker every few seconds, so it logs nothing. */
healthRouter.get("/health", (_req, res) => {
    res.status(200).json({
        success: true,
        message: "Health Check: Health Router up and running",
    })
})

export { healthRouter }
