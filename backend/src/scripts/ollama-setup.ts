import { spawn, spawnSync } from "node:child_process"
import { setTimeout as sleep } from "node:timers/promises"
import { Ollama } from "ollama"
import { env } from "../config/env"
import { OllamaProvider } from "../llm/ollama.provider"

/**
 * Gets the local Ollama provider ready, so `LLM_PROVIDER=ollama` works on the first try:
 *
 *   1. Ollama reachable at OLLAMA_BASE_URL? If not, and it should run on this machine, start it.
 *   2. Pull OLLAMA_CHAT_MODEL and OLLAMA_EMBEDDING_MODEL if they aren't installed yet.
 *   3. Load both models into memory, so the first question doesn't wait ~30s.
 *   4. Check that backend/.env actually uses Ollama.
 *
 * Safe to run any number of times: it skips whatever is already done.
 *   pnpm ollama:setup
 */

const STARTUP_TIMEOUT_MS = 20_000

/** Ollama treats "nomic-embed-text" and "nomic-embed-text:latest" as the same model. */
export function withDefaultTag(model: string): string {
    return model.includes(":") ? model : `${model}:latest`
}

export function findMissingModels(installed: string[], required: string[]): string[] {
    const installedNames = new Set(installed.map(withDefaultTag))
    const missing = required.filter((model) => !installedNames.has(withDefaultTag(model)))
    // De-duplicate by normalised name, keeping the name as configured
    return missing.filter(
        (model, i) => missing.findIndex((m) => withDefaultTag(m) === withDefaultTag(model)) === i,
    )
}

/** We can only start Ollama ourselves if it is meant to run on this machine. */
export function isLocalUrl(url: string): boolean {
    const { hostname } = new URL(url)
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
}

const log = (message: string) => process.stdout.write(`${message}\n`)

async function isReachable(client: Ollama): Promise<string | null> {
    try {
        const { version } = await Promise.race([
            client.version(),
            sleep(2_000).then(() => Promise.reject(new Error("timeout"))),
        ])
        return version
    } catch {
        return null
    }
}

function isOllamaInstalled(): boolean {
    return spawnSync("ollama", ["--version"], { stdio: "ignore" }).status === 0
}

/**
 * Runs `ollama serve` in the foreground for a few seconds, only to capture WHY it fails.
 * (The background server's output can't be kept: some installs, like the snap package, can't
 * write to files we hand them, and a pipe would break once this script exits.)
 */
function diagnoseServeFailure(serveEnv: NodeJS.ProcessEnv): string {
    const result = spawnSync("ollama", ["serve"], {
        env: serveEnv,
        encoding: "utf8",
        timeout: 5_000,
    })
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim()
    return output.split("\n").at(-1) || `exit code ${result.status}`
}

/** Starts `ollama serve` in the background (it keeps running after this script exits). */
async function startOllama(client: Ollama): Promise<string> {
    // Serve on the address the app is configured for
    const serveEnv = { ...process.env, OLLAMA_HOST: new URL(env.OLLAMA_BASE_URL).host }
    const server = spawn("ollama", ["serve"], { detached: true, stdio: "ignore", env: serveEnv })
    let hasExited = false
    server.on("exit", () => (hasExited = true))
    server.unref()

    const deadline = Date.now() + STARTUP_TIMEOUT_MS
    while (Date.now() < deadline) {
        const version = await isReachable(client)
        if (version) return version
        // It crashed (e.g. the port is taken): say why right away instead of waiting
        if (hasExited) throw new Error(`"ollama serve" stopped: ${diagnoseServeFailure(serveEnv)}`)
        await sleep(500)
    }
    throw new Error(
        `Started "ollama serve" but it did not answer at ${env.OLLAMA_BASE_URL} within 20s`,
    )
}

async function ensureRunning(client: Ollama): Promise<void> {
    const version = await isReachable(client)
    if (version) {
        log(`✓ Ollama ${version} is running at ${env.OLLAMA_BASE_URL}`)
        return
    }
    if (!isLocalUrl(env.OLLAMA_BASE_URL)) {
        throw new Error(
            `Ollama is not reachable at ${env.OLLAMA_BASE_URL}. Start it on that machine, or fix OLLAMA_BASE_URL in backend/.env.`,
        )
    }
    if (!isOllamaInstalled()) {
        throw new Error(
            "Ollama is not installed. Install it from https://ollama.com/download, then run this again.",
        )
    }
    log(`… Ollama is not running. Starting "ollama serve" in the background`)
    log(`✓ Ollama ${await startOllama(client)} is running at ${env.OLLAMA_BASE_URL}`)
}

async function pullWithProgress(client: Ollama, model: string): Promise<void> {
    log(`… Pulling ${model} (only needed once)`)
    let lastPercent = -1
    for await (const progress of await client.pull({ model, stream: true })) {
        if (!progress.total) continue
        const percent = Math.floor((progress.completed / progress.total) * 100)
        if (percent !== lastPercent && percent % 10 === 0) {
            process.stdout.write(`  ${model}: ${percent}%\r`)
            lastPercent = percent
        }
    }
    log(`✓ Pulled ${model}                    `)
}

async function ensureModels(client: Ollama): Promise<void> {
    const required = [env.OLLAMA_CHAT_MODEL, env.OLLAMA_EMBEDDING_MODEL]
    const { models } = await client.list()
    const missing = findMissingModels(
        models.map((model) => model.name),
        required,
    )
    for (const model of missing) await pullWithProgress(client, model)
    if (missing.length === 0) log(`✓ Models installed: ${required.join(", ")}`)
}

/** Loading a model into (GPU) memory takes ~30s the first time; do it now instead of on the first question. */
async function warmUp(): Promise<void> {
    log("… Loading the models into memory")
    const provider = new OllamaProvider({
        baseUrl: env.OLLAMA_BASE_URL,
        chatModel: env.OLLAMA_CHAT_MODEL,
        embeddingModel: env.OLLAMA_EMBEDDING_MODEL,
        contextWindow: env.OLLAMA_CONTEXT_WINDOW,
        timeoutMs: 120_000, // a cold load is slower than a normal request
    })
    const startedAt = Date.now()
    await provider.embed(["warm up"], "query")
    await provider.chat([{ role: "user", content: "Reply with: ready" }])
    log(
        `✓ Models loaded in ${((Date.now() - startedAt) / 1000).toFixed(1)}s (they stay loaded for 30 minutes after use)`,
    )
}

function checkProviderSetting(): void {
    if (env.LLM_PROVIDER === "ollama") {
        log("✓ backend/.env uses LLM_PROVIDER=ollama")
        return
    }
    log(`\n! backend/.env uses LLM_PROVIDER=${env.LLM_PROVIDER}. To answer with Ollama, set:`)
    log("    LLM_PROVIDER=ollama")
    log("    MIN_RELEVANCE_SCORE=0.6")
    log("  then restart the API and worker, and re-upload your sources")
    log("  (vectors from different embedding models can't be compared).")
}

async function main(): Promise<void> {
    const client = new Ollama({ host: env.OLLAMA_BASE_URL })
    await ensureRunning(client)
    await ensureModels(client)
    await warmUp()
    checkProviderSetting()
    log("\nOllama is ready.")
}

// Run only when executed directly (`pnpm ollama:setup`), not when imported by tests
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((err: Error) => {
            process.stderr.write(`\n✗ ${err.message}\n`)
            process.exit(1)
        })
}
