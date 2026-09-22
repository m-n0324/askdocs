# Getting started

Step-by-step instructions to run AskDocs on your machine: first the Docker containers (database and Redis), then the backend, then the frontend. Every command was tested on a fresh copy of the repository.

You will end up with:

| What | Where | Runs in |
| --- | --- | --- |
| PostgreSQL + pgvector | `localhost:5433` | Docker |
| Redis | `localhost:6379` | Docker |
| Backend API | http://localhost:8080/api | Terminal 1 |
| Ingestion worker | (no port) | Terminal 2 |
| Frontend | http://localhost:3000 | Terminal 3 |

---

## 0. Prerequisites (one time)

Install these first and check the versions:

```bash
docker --version            # Docker 24+ 
docker compose version      # Compose v2 ("docker compose", not "docker-compose")
node --version              # v22 or newer
corepack enable             # makes the right pnpm version available
pnpm --version              # 10.x
```

- **Docker**: [Docker Desktop](https://docs.docker.com/get-docker/) on macOS/Windows, or Docker Engine on Linux. Make sure it's running.
- **Node.js 22+**: from [nodejs.org](https://nodejs.org) or via `nvm install 22`.
- **pnpm**: `corepack enable` (ships with Node) is enough. Otherwise `npm install -g pnpm@10`.
- **An AI model**, one of:
  - **Ollama**, local and free, no key: install it from [ollama.com](https://ollama.com). The models are downloaded for you in step 2.3 (`qwen2.5:3b`, a 1.9 GB chat model, and `nomic-embed-text`, a 274 MB embedding model). A GPU with 4 GB of memory runs both comfortably.
  - **Gemini**, cloud with a free tier: a key from [aistudio.google.com](https://aistudio.google.com) → **Get API key** → **Create API key**.
  - **Nothing yet**: the offline `fake` provider (canned answers, keyword-only search) is enough to click through the app.

All commands below start from the **repository root** (the folder that contains `docker-compose.yml`) unless they say `cd`.

---

## 1. Start the Docker containers (Postgres + Redis)

```bash
docker compose up -d postgres redis
```

Wait until both show `healthy` (10–20 seconds on the first run, which also downloads the images):

```bash
docker compose ps
```

```text
NAME                 SERVICE    STATUS
askdocs-postgres-1   postgres   Up 15 seconds (healthy)
askdocs-redis-1      redis      Up 15 seconds (healthy)
```

What you just started:
- **Postgres 17 with pgvector** on port **5433** (not 5432, so it doesn't clash with a Postgres you may already have). User `askdocs`, password `askdocs`, database `askdocs`. On its very first start it also creates `askdocs_test`, used by the automated tests.
- **Redis 8** on port **6379**, password `askdocs`. It holds the background job queue and rate-limit counters.

Data lives in Docker volumes, so it survives restarts.

---

## 2. Start the backend

### 2.1 Install dependencies

```bash
cd backend
pnpm install
```

This also generates the Prisma database client (`src/generated/prisma`).

### 2.2 Create `backend/.env`

```bash
cp .env.example .env
```

Open `backend/.env` and set:

1. **`JWT_SECRET`**: paste the output of:
   ```bash
   openssl rand -hex 32
   ```
2. **The AI provider**: pick one.
   - Local Ollama (free, private, no key). The defaults already match the models from step 0:
     ```env
     LLM_PROVIDER=ollama
     MIN_RELEVANCE_SCORE=0.6
     ```
     `MIN_RELEVANCE_SCORE=0.6` suits `nomic-embed-text`: in `pnpm eval`, answerable questions scored at least 0.62 and unanswerable ones at most 0.57, so off-topic questions get "I don't know" without a model call.
   - Free Gemini key:
     ```env
     LLM_PROVIDER=gemini
     GEMINI_API_KEY=your-key-here
     ```
   - No key yet (offline, canned answers):
     ```env
     LLM_PROVIDER=fake
     ```

   The example file defaults to `gemini`. If you leave it on `gemini` without a key, the backend refuses to start and tells you so.

Leave everything else as it is. `DATABASE_URL` and `REDIS_URL` already point to the containers from step 1.

> `backend/.env` contains secrets. It is git-ignored: never commit it. (If it ever shows up in `git status` as staged, run `git rm --cached backend/.env`.)

### 2.3 (Ollama only) Prepare the local models

```bash
pnpm ollama:setup
```

It starts Ollama if it isn't running, downloads the two models the first time (about 2 GB, a few minutes), and loads them into memory so your first question is fast. It's safe to run again any time:

```text
✓ Ollama 0.34.0 is running at http://localhost:11434
✓ Models installed: qwen2.5:3b, nomic-embed-text
… Loading the models into memory
✓ Models loaded in 2.3s (they stay loaded for 30 minutes after use)
✓ backend/.env uses LLM_PROVIDER=ollama

Ollama is ready.
```

If it ends with `✗`, the line says what to do (install Ollama, start it, or fix `OLLAMA_BASE_URL`). If Ollama is installed as a system service (the Linux installer and the snap package both do this), it normally starts on boot, and the script just confirms it's running.

### 2.4 Create the database tables

```bash
pnpm db:deploy
```

Expected output ends with `All migrations have been successfully applied.` (or `No pending migrations to apply.` if they already were). This creates the tables, the `vector` extension, and the HNSW index.

### 2.5 Terminal 1: run the API

```bash
pnpm dev
```

Wait for:

```text
INFO: Server is running on http://localhost:8080
```

Check it from another terminal:

```bash
curl http://localhost:8080/api/health/ready
# {"success":true,"data":{"database":true,"redis":true}}
```

### 2.6 Terminal 2: run the ingestion worker

Open a **second terminal**:

```bash
cd backend
pnpm dev:worker
```

Wait for:

```text
INFO: Ingestion worker started
```

The worker processes uploaded files and websites in the background: parse → chunk → embed → store. **Without it, sources stay "pending" forever.**

Both `pnpm dev` and `pnpm dev:worker` reload automatically when you change code. After changing `backend/.env`, stop them with `Ctrl+C` and start them again.

---

## 3. Start the frontend

Open a **third terminal**:

```bash
cd frontend
pnpm install
cp .env.example .env.local
pnpm dev
```

`.env.local` contains one line, `NEXT_PUBLIC_API_URL=http://localhost:8080/api`, which tells the browser where the API is.

Wait for:

```text
▲ Next.js 16
- Local:   http://localhost:3000
✓ Ready
```

Open **http://localhost:3000**.

---

## 4. Try it

1. **Sign up** with any name, email, and a password of 8+ characters.
2. **Create a workspace**, e.g. "HR Handbook".
3. Go to **Sources** and drop in a Markdown (`.md`), text (`.txt`), PDF or DOCX file (up to 10 MB), or add a website URL. Markdown and text are preferred: the smallest files, and the fastest to index. The status goes `Pending → Processing → Ready` within a few seconds. Terminal 2 logs `Source ingested`.
4. Go to **Chat** and ask something your document answers. The answer streams in; click a numbered marker like **[1]** to see the exact passage and page, and **Open PDF** to jump to it.
5. Ask something your documents don't cover: you should get *"I don't know based on the provided sources."*

With `LLM_PROVIDER=fake`, answers are canned and search only matches shared keywords, so use words that appear in your document. Switch to Gemini for real answers.

---

## 5. Every day after the first setup

```bash
docker compose up -d postgres redis      # repository root
cd backend && pnpm ollama:setup          # only with LLM_PROVIDER=ollama: makes sure Ollama is up and warm
cd backend && pnpm dev                   # Terminal 1
cd backend && pnpm dev:worker            # Terminal 2
cd frontend && pnpm dev                  # Terminal 3
```

Also run `pnpm db:deploy` in `backend/` after pulling changes that add new migrations, and `pnpm install` after dependency changes.

---

## 6. Stopping

| To… | Do this |
| --- | --- |
| Stop the API, worker, frontend | `Ctrl+C` in each terminal |
| Stop the containers, keep the data | `docker compose stop` |
| Remove the containers, keep the data | `docker compose down` |
| **Delete everything** (users, documents, chats) | `docker compose down -v` ⚠️ irreversible |

---

## 7. Alternative: run everything in Docker

Instead of steps 2–3, you can run the whole stack (API, worker, frontend and Nginx) in containers:

```bash
cp backend/.env.example backend/.env     # set JWT_SECRET and the AI provider, as in step 2.2
docker compose up --build
```

Open **http://localhost**. If port 80 is taken: `HTTP_PORT=8088 docker compose up --build`, then open http://localhost:8088.

**Ollama with Docker:** the containers reach Ollama on your machine as `host.docker.internal`. Ollama listens only on `127.0.0.1` by default, so make it listen on all interfaces: set `OLLAMA_HOST=0.0.0.0` for the Ollama service (for the official Linux install: `sudo systemctl edit ollama`, add `Environment="OLLAMA_HOST=0.0.0.0"` under `[Service]`, then `sudo systemctl restart ollama`). Ollama has no password, so keep port 11434 closed in your firewall. The terminal setup (steps 2–3) doesn't need any of this.

**Don't run both setups at once.** The Docker worker and your `pnpm dev:worker` would take each other's jobs, and neither can read files uploaded through the other. Before switching to the terminal setup, run `docker compose stop api worker web nginx`.

---

## 8. Running the tests (optional)

The containers from step 1 must be running.

```bash
cd backend
pnpm test             # unit + integration tests (uses the askdocs_test database)
pnpm lint && pnpm typecheck

cd ../frontend
pnpm lint && pnpm typecheck && pnpm test
```

---

## 9. Troubleshooting

| Problem | Fix |
| --- | --- |
| Backend prints `Invalid environment configuration` and exits | The message names the setting. Usually `JWT_SECRET` is empty (step 2.2), or `LLM_PROVIDER=gemini` without `GEMINI_API_KEY`. |
| `pnpm db:deploy` says `Connection url is empty` | `backend/.env` is missing: run `cp .env.example .env` in `backend/`. |
| `Can't reach database server at localhost:5433` | The Postgres container isn't running: `docker compose up -d postgres`, then `docker compose ps`. |
| `NOAUTH Authentication required` or `WRONGPASS` (Redis) | `REDIS_URL` must include the password: `redis://:askdocs@localhost:6379`. |
| `Bind for 0.0.0.0:6379 failed: port is already allocated` | Another Redis is using 6379. Stop it (`sudo systemctl stop redis-server`), or change the left side of `"127.0.0.1:6379:6379"` in `docker-compose.yml` and `REDIS_URL` to match. |
| Sources stay **Pending** | The worker (Terminal 2) isn't running, or a Docker worker is also running (see section 7). |
| Source shows **Failed** | The message says why (e.g. scanned PDF without text, website blocked by robots.txt). Details are in Terminal 2. |
| Frontend shows "Failed to fetch" or network errors | The API (Terminal 1) isn't running, or `frontend/.env.local` is missing. Restart `pnpm dev` in `frontend/` after creating it. |
| Every answer is "I don't know" | With `fake`, use keywords from your document. With a real provider, check that the source is **Ready**. After switching providers, delete and re-upload sources: vectors from different models don't mix. |
| Chat says `The AI model is not available right now` with `LLM_PROVIDER=ollama` | Terminal 1 logs the reason. Either `Cannot reach Ollama` (start it: `ollama serve`, or open the Ollama app), or `model ... is not installed` (run the `ollama pull` command it shows). |
| The first question after a break takes ~30 seconds (Ollama) | Ollama is loading the model into memory. Later questions take under a second. AskDocs keeps models loaded for 30 minutes after each use. |
| `The AI provider is limiting requests right now` | Gemini free-tier limit reached; wait a minute (or until tomorrow for the daily limit). |
| Chat says `The AI model is not available right now` | Google retired or restricted the model. Terminal 1 logs which one. Set `GEMINI_CHAT_MODEL` (or `GEMINI_EMBEDDING_MODEL`) in `backend/.env` to a current model, e.g. `gemini-flash-lite-latest`, and restart the API and worker. |
| Answers take 10–30 seconds and appear all at once | You set a "thinking" model (e.g. full Gemini Flash). Use `GEMINI_CHAT_MODEL=gemini-flash-lite-latest`: about 1 second, streams, more free quota. |
| Tests fail with `database "askdocs_test" does not exist` | The volume existed before the init script was added: `docker compose exec postgres psql -U askdocs -c "CREATE DATABASE askdocs_test"` |
| Frontend `pnpm typecheck` shows `Duplicate identifier 'PagesPageConfig'` | Generated types from both `next dev` and `next build` collide: `rm -rf frontend/.next/dev`. |
