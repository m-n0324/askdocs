import type { Request, Response } from "express"
import { getUserId } from "../middlewares/auth"
import { sendData } from "../lib/response"
import { loginSchema, signupSchema } from "../schemas"
import { getCurrentUser, login, signup } from "../services/auth.service"

export async function signupHandler(req: Request, res: Response): Promise<void> {
    sendData(res, await signup(signupSchema.parse(req.body)), 201)
}

export async function loginHandler(req: Request, res: Response): Promise<void> {
    sendData(res, await login(loginSchema.parse(req.body)))
}

export async function meHandler(req: Request, res: Response): Promise<void> {
    sendData(res, { user: await getCurrentUser(getUserId(req)) })
}
