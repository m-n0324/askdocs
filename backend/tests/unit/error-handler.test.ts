import type { Request, Response } from "express"
import { MulterError } from "multer"
import { describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { AppError } from "../../src/lib/errors"
import { errorHandler } from "../../src/middlewares/errorHandler"

function run(err: unknown, headersSent = false) {
    const res = { headersSent, status: vi.fn(), json: vi.fn(), end: vi.fn() }
    res.status.mockReturnValue(res)
    errorHandler(
        err,
        { method: "GET", originalUrl: "/x" } as Request,
        res as unknown as Response,
        vi.fn(),
    )
    return { status: res.status.mock.calls[0]?.[0], body: res.json.mock.calls[0]?.[0], res }
}

describe("errorHandler", () => {
    it("uses the status and code of an AppError", () => {
        const { status, body } = run(new AppError(409, "CONFLICT", "Already exists"))
        expect(status).toBe(409)
        expect(body).toMatchObject({ success: false, code: "CONFLICT", message: "Already exists" })
    })

    it("turns Zod errors into 400 with per-field details", () => {
        const result = z.object({ email: z.email() }).safeParse({ email: "nope" })
        const { status, body } = run(result.error)
        expect(status).toBe(400)
        expect(body.details[0].path).toBe("email")
    })

    it("maps oversized uploads to 413", () => {
        expect(run(new MulterError("LIMIT_FILE_SIZE")).status).toBe(413)
        expect(run(new MulterError("LIMIT_UNEXPECTED_FILE")).status).toBe(400)
    })

    it("maps body-parser errors", () => {
        expect(run(Object.assign(new Error("x"), { type: "entity.parse.failed" })).status).toBe(400)
        expect(run(Object.assign(new Error("x"), { type: "entity.too.large" })).status).toBe(413)
    })

    it("hides the details of unexpected errors", () => {
        const { status, body } = run(new Error('relation "users" does not exist'))
        expect(status).toBe(500)
        expect(JSON.stringify(body)).not.toContain("users")
    })

    it("just ends the response if headers were already sent (e.g. during SSE)", () => {
        const { res } = run(new Error("late"), true)
        expect(res.end).toHaveBeenCalled()
        expect(res.json).not.toHaveBeenCalled()
    })
})
