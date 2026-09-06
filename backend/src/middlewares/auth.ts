import type { NextFunction, Request, Response } from "express"
import { unauthorized } from "../lib/errors"
import { verifyToken } from "../services/auth.service"

/** Requires `Authorization: Bearer <jwt>` and puts the user id on `req.userId`. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
    const header = req.headers.authorization
    if (!header?.startsWith("Bearer ")) throw unauthorized()
    req.userId = verifyToken(header.slice("Bearer ".length).trim())
    next()
}

/** For handlers mounted after `requireAuth`. Throws if the middleware is missing. */
export function getUserId(req: Request): string {
    if (!req.userId) throw unauthorized()
    return req.userId
}
