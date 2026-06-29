# Learninx repo facts

## Project shape
- Next.js 14 App Router + TypeScript + Prisma SQLite + Tailwind + xterm.js
- Lives at `d:\OSPs\Learninx\` (project root is the outer folder, NOT a `Learninx/` subdirectory — keep it that way, user pushed back when we nested it)
- Run with `npm run dev` (cwd must be the project root)
- Build with `npm run build`
- DB commands: `npx prisma db push`, `npm run db:seed`
- The DB seed is destructive for quiz questions — it deletes & re-creates them per lesson

## Authentication
- **No login / signup / dashboard**. The app is fully anonymous.
- Per-browser tracking uses a random visitor id stored in the `learninx_visitor` httpOnly cookie.
- Visitor id is generated lazily in `src/lib/visitor.ts` on first read.
- `src/lib/auth.ts` does NOT exist. There is no User table. Server actions use `getVisitorId()` from `src/lib/visitor.ts`.

## Routing after the no-auth refactor
- `/`               — landing page
- `/lessons`         — list of seeded lessons, shows completed state per visitor
- `/lessons/[slug]`  — markdown lesson + Terminal + Challenge + Quiz
- `/login`, `/signup`, `/dashboard` — **404** (intentionally removed)

## How the visitor cookie gets set
- The cookie is set in `src/middleware.ts` (edge middleware) so it works for static and dynamic routes alike.
- `src/lib/visitor.ts` is **read-only** — it just calls `cookies().get('learninx_visitor')?.value`. Server components and server actions CANNOT write cookies (Next throws `Cookies can only be modified in a Server Action or Route Handler`).

## Docker
- `next.config.js` uses `output: 'standalone'` so `.next/standalone/server.js` is a runnable Node entrypoint.
- `Dockerfile` is multi-stage (deps → builder → runner). The runner image is `node:20-alpine`, runs as non-root `nextjs`, persists the SQLite DB on a volume mounted at `/data`, and on every start runs `prisma db push` + `tsx prisma/seed.ts` before launching `node server.js`.
- `docker-compose.yml` exposes the app on `localhost:3000` and mounts a named volume `learninx-data:/data`.
- To rebuild from scratch: `docker build -t learninx:latest .` then `docker run --rm -p 3000:3000 -v learninx-data:/data learninx:latest`.

## Known issues
- The lesson page emits a non-fatal `ReferenceError: self is not defined` on the server during SSR because xterm-addon-fit touches browser globals when React renders the `'use client'` component on the server. The page still returns 200 and the terminal works fine in the browser. Fix if user asks: replace top-level `import 'xterm/css/xterm.css'` and the xterm/xterm-addon-fit imports with `await import(...)` inside a `useEffect`.

## Dependencies that can be removed for cleanup (untouched for now)
`bcryptjs`, `@types/bcryptjs`, `jose` — only auth-era, safe to delete with `npm uninstall`.
