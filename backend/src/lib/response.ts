import type { Response } from "express"

/** Every successful JSON response has the same envelope: `{ success: true, data }`. */
export function sendData<T>(res: Response, data: T, status = 200): void {
    res.status(status).json({ success: true, data })
}
