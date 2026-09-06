import type { Workspace } from "./domain"

declare global {
    namespace Express {
        interface Request {
            /** Set by the `requireAuth` middleware. */
            userId?: string
            /** Set by the `requireWorkspace` middleware, already checked to belong to `userId`. */
            workspace?: Workspace
        }
    }
}

export {}
