import type { Response } from "express"

/**
 * Server-Sent Events: a long-lived HTTP response where the server keeps writing small
 * text frames. Each frame looks like:
 *
 *   event: token
 *   data: {"delta":"Hel"}
 *   <blank line>
 *
 * Simpler than WebSockets because traffic is one-way (server -> browser) and it is plain HTTP.
 */
export function startSse(res: Response): void {
    res.status(200).set({
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // tell nginx not to buffer, or tokens arrive all at once
    })
    res.flushHeaders()
}

export function sendSseEvent(res: Response, event: string, data: unknown): void {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}
