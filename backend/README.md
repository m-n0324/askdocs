# AskDocs backend

Express 5 + TypeScript API and BullMQ ingestion worker. Project overview, setup and design: see the [root README](../README.md) and [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md).

## Scripts

| Command                                             | What it does                                                         |
| --------------------------------------------------- | -------------------------------------------------------------------- |
| `pnpm dev` / `pnpm dev:worker`                      | API (:8080) / ingestion worker, with reload                          |
| `pnpm build` → `pnpm start` / `pnpm start:worker`   | Production build and run                                             |
| `pnpm test`, `pnpm test:unit`, `pnpm test:coverage` | Vitest. Integration tests need `docker compose up -d postgres redis` |
| `pnpm lint`, `pnpm typecheck`, `pnpm format`        | ESLint, TypeScript (src + tests), Prettier                           |
| `pnpm db:migrate`                                   | Create + apply a migration in development (`prisma migrate dev`)     |
| `pnpm db:deploy`                                    | Apply pending migrations (CI, production)                            |
| `pnpm db:studio`                                    | Browse the database in Prisma Studio                                 |
| `pnpm eval`                                         | Retrieval evaluation on `eval/dataset.json`                          |
| `pnpm ollama:setup`                                 | Start Ollama if needed, pull the configured models, load them        |

## Layout

```text
src/
├── server.ts, app.ts     HTTP server, Express app (middleware order lives here)
├── worker.ts             ingestion worker process
├── config/env.ts         every setting, validated with Zod at startup
├── routes/ → controllers/ → services/ → repositories/
├── loaders/              PDF / DOCX / HTML → documents with page/section metadata
├── llm/                  LlmProvider interface, OpenAI + fake implementations
├── prompts/              versioned prompt templates
├── queues/               BullMQ queue
├── middlewares/          auth, tenant gate, rate limits, upload, errors
├── schemas/              Zod request schemas
├── utils/                SSE, citations, SSRF guard, text cleaning
├── scripts/eval.ts       retrieval evaluation
└── generated/prisma/     Prisma Client (generated: `pnpm db:generate`, not committed)
prisma/                   schema.prisma + migrations
tests/unit, tests/integration
```

## Notes

- **Migrations with pgvector.** Prisma can't express the `vector` extension or the HNSW index. For schema changes, run `pnpm exec prisma migrate dev --create-only --name <change>`, review and edit the generated SQL if vectors are involved, then `pnpm db:migrate`.
- **TypeScript 6.0, not 7.** TypeScript 7 (the native compiler) doesn't ship the JS API that `typescript-eslint` needs, so the backend stays on 6.0 until it's supported.
- **Tests** use the `askdocs_test` database, Redis DB 1, and `LLM_PROVIDER=fake` (see `tests/helpers/test-env.ts`). Override with `TEST_DATABASE_URL` / `TEST_REDIS_URL`.
