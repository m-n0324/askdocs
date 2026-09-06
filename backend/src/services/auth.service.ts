import bcrypt from "bcryptjs"
import jwt, { type SignOptions } from "jsonwebtoken"
import { env } from "../config/env"
import { conflict, notFound, unauthorized } from "../lib/errors"
import {
    createUser,
    findUserById,
    findUserWithPasswordByEmail,
} from "../repositories/user.repository"
import type { User } from "../types/domain"

/** bcrypt work factor: each +1 doubles the time to hash, for us AND for an attacker guessing passwords. */
const BCRYPT_ROUNDS = 12

// A real bcrypt hash of a random string, used to spend the same time on unknown emails
const DUMMY_HASH = bcrypt.hashSync("askdocs-timing-equaliser", BCRYPT_ROUNDS)

interface TokenPayload {
    sub: string // the user id
}

export interface AuthResult {
    token: string
    user: User
}

const signToken = (userId: string): string =>
    jwt.sign({ sub: userId } satisfies TokenPayload, env.JWT_SECRET, {
        algorithm: "HS256",
        expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
    })

/** Returns the user id inside a valid token, or throws 401. */
export function verifyToken(token: string): string {
    try {
        // Pin the algorithm so a forged token can't pick a weaker one (e.g. "none")
        const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] })
        if (typeof payload === "string" || typeof payload.sub !== "string") throw new Error()
        return payload.sub
    } catch {
        throw unauthorized("Invalid or expired token")
    }
}

export async function signup(input: {
    name: string
    email: string
    password: string
}): Promise<AuthResult> {
    if (await findUserWithPasswordByEmail(input.email)) {
        throw conflict("An account with this email already exists")
    }
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS)
    const user = await createUser({ name: input.name, email: input.email, passwordHash })
    return { token: signToken(user.id), user }
}

export async function login(input: { email: string; password: string }): Promise<AuthResult> {
    const found = await findUserWithPasswordByEmail(input.email)
    // Same message AND the same amount of work whether the email or the password is wrong:
    // comparing against a dummy hash for unknown emails means response time can't reveal
    // which emails have accounts.
    const isValid = await bcrypt.compare(input.password, found?.passwordHash ?? DUMMY_HASH)
    if (!found || !isValid) {
        throw unauthorized("Invalid email or password")
    }
    const { passwordHash: _passwordHash, ...user } = found
    return { token: signToken(user.id), user }
}

export async function getCurrentUser(userId: string): Promise<User> {
    const user = await findUserById(userId)
    if (!user) throw notFound("User")
    return user
}
