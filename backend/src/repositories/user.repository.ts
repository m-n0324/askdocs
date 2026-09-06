import { prisma } from "../lib/prisma"
import type { User } from "../types/domain"

const toUser = (row: { id: string; name: string; email: string; createdAt: Date }): User => ({
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: row.createdAt.toISOString(),
})

export async function createUser(input: {
    name: string
    email: string
    passwordHash: string
}): Promise<User> {
    return toUser(await prisma.user.create({ data: input }))
}

export async function findUserById(id: string): Promise<User | null> {
    const row = await prisma.user.findUnique({ where: { id } })
    return row ? toUser(row) : null
}

/** Returns the password hash too: only the auth service should call this. */
export async function findUserWithPasswordByEmail(
    email: string,
): Promise<(User & { passwordHash: string }) | null> {
    const row = await prisma.user.findUnique({ where: { email } })
    return row ? { ...toUser(row), passwordHash: row.passwordHash } : null
}
