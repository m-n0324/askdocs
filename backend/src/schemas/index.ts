import { z } from "zod"
import { notFound } from "../lib/errors"

/**
 * Request validation. Controllers call `schema.parse(req.body)`: invalid input throws a ZodError,
 * which the central error handler turns into a 400 with field-level details.
 */

export const signupSchema = z.object({
    name: z.string().trim().min(1, "Name is required").max(80),
    email: z.email().trim().toLowerCase().max(254),
    // bcrypt ignores everything after 72 bytes, so longer passwords would give a false sense of security
    password: z.string().min(8, "Password must be at least 8 characters").max(72),
})

export const loginSchema = z.object({
    email: z.email().trim().toLowerCase(),
    password: z.string().min(1, "Password is required").max(72),
})

export const workspaceSchema = z.object({
    name: z.string().trim().min(1, "Name is required").max(80),
})

export const urlSourceSchema = z.object({
    url: z.url({ protocol: /^https?$/, error: "Must be an http(s) URL" }).max(2048),
    maxDepth: z.number().int().min(0).max(2).optional(),
    maxPages: z.number().int().min(1).max(20).optional(),
})

export const chatSchema = z.object({
    message: z.string().trim().min(1, "Message is required").max(2000),
    conversationId: z.uuid().optional(),
})

/** Route ids must be UUIDs. Anything else cannot exist, so it is a 404 (not a database error). */
export function parseId(value: string | string[] | undefined, what: string): string {
    const result = z.uuid().safeParse(value)
    if (!result.success) throw notFound(what)
    return result.data
}
