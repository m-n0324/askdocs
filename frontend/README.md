# AskDocs: Frontend

The web app for **AskDocs**, an AI knowledge base. You create a workspace, upload Markdown, TXT, PDF or DOCX
files or add websites as sources, and chat with an assistant that answers **only** from those sources. Answers stream in live
and every claim carries a clickable citation (file + page/section).

Stack: Next.js 16 (Pages Router) · React 19 · TypeScript · Tailwind CSS v4 · TanStack Query v5 ·
zustand v5 · wretch v3 · Vitest.

> **Next 16 differs from most tutorials.** Read the docs bundled at `node_modules/next/dist/docs/02-pages/`
> before using a Next API (see `AGENTS.md`).

## Getting started

Requirements: Node ≥ 20.9 (we use 24) and pnpm 10 (`corepack enable` gives you the pinned version).

```bash
pnpm install
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8080/api
pnpm dev                     # http://localhost:3000
```

The backend (`../backend`) must be running on the URL in `NEXT_PUBLIC_API_URL`. `NEXT_PUBLIC_*` values are
**baked into the browser bundle at build time**, so never put secrets in them.

| Script           | What it does                          |
| ---------------- | ------------------------------------- |
| `pnpm dev`       | Dev server with hot reload            |
| `pnpm build`     | Production build (`output: "standalone"`) |
| `pnpm start`     | Serve a production build              |
| `pnpm lint`      | ESLint (Next + TanStack Query rules)  |
| `pnpm typecheck` | `tsc --noEmit`                        |
| `pnpm test`      | Vitest unit + component tests (once)  |

`lint`, `typecheck`, `test`, and `build` must all pass before merging.

### Docker

```bash
docker build -t askdocs-web --build-arg NEXT_PUBLIC_API_URL=/api .
docker run -p 3000:3000 askdocs-web
```

The image runs `.next/standalone/server.js` as a non-root user on port 3000. In `docker compose`, nginx
serves the app and forwards `/api` to the backend, so the build uses `NEXT_PUBLIC_API_URL=/api`.

## Folder structure

```text
src/
├── pages/        Routes only: set <Head>, read URL params, render a container
├── containers/   Smart components: call hooks, read the store, handle loading/error/empty
├── components/   Presentational UI, props in → JSX out (grouped by feature: auth, chat, sources, …)
├── hooks/        React Query hooks (useXxxQuery / useXxxMutation) + useChatStream, useSessionReady…
├── services/     One file per backend resource. Plain async functions, no React
├── lib/          Configured clients: api.ts (wretch), queryClient.ts, apiError.ts, session.ts
├── stores/       zustand: the session (token + user), persisted to localStorage
├── interfaces/   Shared types (I-prefixed): IUser, ISource, ICitation, ChatStreamEvent…
├── constants/    ROUTES, QUERY_KEYS, limits (10 MB uploads, 2000-char questions…)
├── utils/        Pure helpers with unit tests: SSE parser, citation splitter, formatting, validation
└── styles/       globals.css: Tailwind import + design tokens in @theme
```

Imports only point **downward**: `pages → containers → components`, `containers → hooks → services → lib`,
`containers → stores`. Everything may import `interfaces`, `constants`, and `utils`. Components never import
hooks, services, or stores. Always import with the `@/` alias.

Routes:

| URL                                      | Page                                                   |
| ---------------------------------------- | ------------------------------------------------------ |
| `/`                                      | Redirects to `/workspaces` or `/login`                 |
| `/login`, `/signup`                      | Auth forms (logged-in users are sent to `/workspaces`) |
| `/workspaces`                            | List, create, and delete workspaces                    |
| `/workspaces/[id]`                       | Redirects to the chat                                  |
| `/workspaces/[id]/chat/[[...conversationId]]` | New chat (`/chat`) or an existing one (`/chat/abc`) |
| `/workspaces/[id]/sources`               | Upload files, add websites, watch ingestion status     |
| `/workspaces/[id]/usage`                 | Token usage and monthly quota                          |

## How auth works

- After login/signup the token and user are saved in `stores/useSessionStore.ts` (zustand `persist` →
  localStorage).
- The server has no localStorage. So the store is created with `skipHydration: true`, and `useSessionReady()`
  loads it **after** the first render. Server HTML and the first client render therefore match, with no
  hydration warnings.
- `AuthGuard` waits for `useSessionReady()` and then redirects to `/login` if there is no token.
- `lib/api.ts` → `authApi()` adds `Authorization: Bearer <token>` (read with `useSessionStore.getState()`).
  Any **401** clears the session and goes to `/login` (`lib/session.ts`).
- Every failed response becomes an `ApiError` holding the backend's `message`, which we show to the user.
  Services unwrap the `{ success, data }` envelope and return only `data`.

## How streaming + citations work in the UI

1. **Sending.** `useChatStream().send(question)` calls `services/chat.ts → streamChat()`. It POSTs to
   `/workspaces/:id/chat/stream`. We can't use `EventSource` because it can't POST or send headers, so we read
   `response.body` with a reader and a `TextDecoder`.
2. **Parsing.** Network chunks don't line up with SSE frames. `utils/sse.ts` buffers text until it sees a
   blank line (the end of a frame), then emits `{ event, data }`. `utils/chatEvents.ts` turns frames into typed
   events and ignores anything malformed.
3. **Events.** The `turn` state in `useChatStream` is the question currently being answered:
   - `meta`: we learn the `conversationId`. In a new chat we `router.replace` the URL to
     `/chat/<id>` with `shallow: true`. `/chat` and `/chat/<id>` are the **same page file** (optional
     catch-all), so the page stays mounted and the answer keeps streaming. `useChatSessionKey` tells "I just
     created this conversation" apart from "the user opened another conversation" (which resets the view).
   - `citations`: candidate passages. Markers in the text can point at them while tokens arrive.
   - `token`: appended to `turn.answer` and rendered with a blinking caret.
   - `done`: the final message is written into the React Query cache (`utils/conversationCache.ts`), the turn
     is cleared, and the conversation + list queries are invalidated so the server copy replaces ours.
   - `error`, or a non-2xx response before streaming (401/429…): shown inline with a "Try again" button.
4. **Stop.** The Stop button aborts an `AbortController`. Any partial answer stays in the conversation.
5. **Citations.** `utils/citations.ts → splitCitationMarkers()` turns `"foo [1] bar"` into text and chip
   segments. Markers with no matching citation stay as plain text. `AnswerText` renders segments as React
   text plus `CitationChip` buttons. Answers come from untrusted documents, so we **never** use
   `dangerouslySetInnerHTML`. Clicking a chip opens `CitationPanel` (Esc closes it, and focus returns to the
   chip).
6. **Open source.** `useOpenSource` handles each kind: websites open in a new tab (`noopener,noreferrer`);
   files are fetched as a Blob with the auth header. PDFs open at `#page=N` and DOCX files are downloaded.

## Sources and polling

`useSourcesQuery` polls every 2 s (`refetchInterval`) **only while** a source is `pending`/`processing`, and
stops when everything is `ready` or `failed`. Uploads are validated in the browser first (Markdown, TXT, PDF or DOCX, ≤ 10 MB);
the backend validates again.

## Design tokens

`src/styles/globals.css` defines the palette (warm paper, ink, one vermilion accent used for citations,
primary actions and focus rings, plus muted status colors), radii, and animations in `@theme`. Fonts are loaded in
`_app.tsx` with `next/font/google`: Instrument Serif (`font-display`), Geist (`font-sans`), Geist Mono
(`font-mono`). Animations use only `transform`/`opacity` and turn off under `prefers-reduced-motion`.

## Troubleshooting

- **`pnpm typecheck` reports `Duplicate identifier 'PagesPageConfig'` in `.next/…/validator.ts`.** Next
  generates type files in both `.next/types` (build) and `.next/dev/types` (dev). If you ran both, delete the
  stale one: `rm -rf .next/dev` (or all of `.next`).
- **Every request fails with "NEXT_PUBLIC_API_URL is not set".** Create `.env.local` from `.env.example` and
  restart `pnpm dev`.
