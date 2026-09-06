import { Router } from "express"
import { loginHandler, meHandler, signupHandler } from "../controllers/auth.controller"
import { requireAuth } from "../middlewares/auth"
import { apiLimiter, authLimiter, loginEmailLimiter } from "../middlewares/rateLimit"

const authRouter = Router()

authRouter.post("/signup", authLimiter, signupHandler)
authRouter.post("/login", authLimiter, loginEmailLimiter, loginHandler)
authRouter.get("/me", requireAuth, apiLimiter, meHandler)

export { authRouter }
