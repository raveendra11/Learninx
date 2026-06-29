# Learninx repo facts

## Project shape
- Next.js 14.2.33 App Router + TypeScript + Prisma 5.22 + SQLite + Tailwind + xterm.js
- Lives at `d:\OSPs\Learninx\` (project root is the outer folder, NOT a `Learninx/` subdirectory — keep it that way, user pushed back when we nested it)
- Run with `npm run dev` (cwd must be the project root)
- Build with `npm run build` (also runs `prisma generate`)
- DB commands: `npx prisma db push`, `npm run db:seed`
- The DB seed is destructive for quiz questions — it deletes & re-creates them per lesson
- `postinstall` hook is `prisma generate || echo 'prisma generate skipped (no schema)'` so it never breaks Docker builds where the schema isn't visible during the `deps` stage

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
- `Dockerfile` is multi-stage (deps → builder → runner). The runner image is `node:20-alpine`, runs as non-root `nextjs`, persists the SQLite DB on a volume mounted at `/data`, and on every start runs `node node_modules/prisma/build/index.js db push` + `node prisma/seed.cjs` + `node server.js`.
- `docker-compose.yml` exposes the app on the host via `localhost:3001 → container:3000` so it can coexist with a local `npm run dev` on port 3000. Override with `docker run -p 3000:3000 …` for a clean port allocation.
- To rebuild from scratch: `docker compose build --no-cache` then `docker compose up`.
- **Quirk**: Next 14.2's `output: 'standalone'` does **not** copy the `public/` directory into `.next/standalone/`. The Dockerfile therefore copies `public/` directly from the build context (`COPY public ./public`).
- Both `src/app/page.tsx` and `src/app/lessons/page.tsx` declare `export const dynamic = 'force-dynamic'` — otherwise Next tries to prerender them at build time and fails because no `dev.db` exists yet.

## Runtime seed
- The seed is **plain CommonJS** at `prisma/seed.cjs` and the data lives at `prisma/lessons.data.cjs`. There is no `seed.ts` and no `tsx`/`esbuild` shipped into the production image.
- `npm run db:seed` invokes `node prisma/seed.cjs` — no tsx anywhere.
- This was changed from a `seed.ts` running via tsx after the Docker build kept failing trying to bundle tsx + esbuild at runtime.

## Known issues
- The lesson page emits a non-fatal `ReferenceError: self is not defined` on the server during SSR because xterm-addon-fit touches browser globals when React renders the `'use client'` component on the server. The page still returns 200 and the terminal works fine in the browser. Fix if user asks: replace top-level `import 'xterm/css/xterm.css'` and the xterm/xterm-addon-fit imports with `await import(...)` inside a `useEffect`.

## Static vs dynamic rendering
- `src/app/page.tsx` and `src/app/lessons/page.tsx` **must** declare `export const dynamic = 'force-dynamic'`. Without it, Next tries to prerender them at build time and `next build` fails with `The table 'main.Lesson' does not exist in the current database` (Docker has no `dev.db` at build time).
- The lesson detail page (`/lessons/[slug]`) is dynamic by default because of `params`, so it doesn't need an explicit directive.
- `not-found.tsx` and `loading.tsx` are static and that's fine — they don't query the DB.

## Dependencies that can be removed for cleanup (untouched for now)
`bcryptjs`, `@types/bcryptjs`, `jose` — only auth-era, safe to delete with `npm uninstall`.
