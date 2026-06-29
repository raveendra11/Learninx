# Learninx

An interactive Linux learning platform that teaches the command line through short lessons, hands-on challenges, and a safe in-browser terminal.

No login. No accounts. Open the page, type commands, learn.

## Highlights

- Bite-sized Markdown lessons covering the core of the Linux command line.
- In-browser terminal sandbox (xterm.js) with a small POSIX-style shell and an in-memory virtual filesystem — nothing touches the user's real machine.
- Auto-graded challenges and end-of-lesson quizzes with score-based completion.
- Anonymous progress tracking via a per-browser cookie. No signup.
- Dark, terminal-inspired UI.
- Ships with Docker support for production-style deployments.

## Stack

| Layer    | Technology                                     |
| -------- | ---------------------------------------------- |
| Runtime  | Node.js 20 LTS                                 |
| Framework| Next.js 14 (App Router) + TypeScript           |
| Styling  | Tailwind CSS                                   |
| ORM      | Prisma                                         |
| Database | SQLite (file-based, zero-config)               |
| Terminal | xterm.js + xterm-addon-fit                     |
| Markdown | react-markdown + remark-gfm                    |

## Quick start (local development)

### Prerequisites

- Node.js 18.18 or newer (20.x recommended)
- npm

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Create the SQLite database and apply the schema
npx prisma db push

# 3. Seed the lesson catalogue (5 lessons + quizzes)
npm run db:seed

# 4. Start the dev server
npm run dev
```

Then open <http://localhost:3000>.

## Docker

A multi-stage Dockerfile is included. Production builds use Next.js's `output: 'standalone'` mode, so the runtime image carries only the traced `node_modules` plus a single `server.js`.

```bash
# Build and run with Docker directly
docker build -t learninx:latest .
docker run --rm -p 3000:3000 -v learninx-data:/data learninx:latest
```

Or with the supplied compose file:

```bash
docker compose up --build
```

The SQLite database (lesson catalogue + per-visitor progress) is stored on a named volume at `/data`. Removing the volume resets all state.

### Build stages

| Stage      | Purpose                                                                    |
| ---------- | -------------------------------------------------------------------------- |
| `deps`     | Install all npm dependencies (build + runtime).                            |
| `builder`  | Run `prisma generate` and `next build` with `output: 'standalone'`.        |
| `runner`   | Minimal `node:20-alpine` image that runs the standalone `server.js`.        |

On every container start, the runner applies the Prisma schema (`prisma db push`), seeds the lesson catalogue (`tsx prisma/seed.ts`), then launches the Next.js server on port 3000. The steps are idempotent — re-running them on an existing database is safe.

## Project structure

```
learninx/
├── prisma/
│   ├── schema.prisma      # Database models (Lesson, QuizQuestion,
│   │                      # LessonProgress, QuizAttempt — no User table)
│   ├── seed.ts            # Lesson catalogue + quiz questions
│   └── dev.db             # SQLite database (gitignored)
└── src/
    ├── middleware.ts      # Edge middleware that mints the visitor cookie
    ├── app/
    │   ├── layout.tsx     # Root layout: nav, footer
    │   ├── page.tsx       # Landing page
    │   ├── loading.tsx    # Global loading state
    │   ├── not-found.tsx  # 404 page
    │   └── lessons/
    │       ├── page.tsx              # Lesson index
    │       ├── [slug]/page.tsx       # Lesson detail (markdown + terminal + challenge + quiz)
    │       └── [slug]/actions.ts     # Server actions (mark complete, submit challenge, submit quiz)
    ├── components/
    │   ├── Terminal.tsx        # xterm.js sandbox (client-only)
    │   ├── ChallengeRunner.tsx # Auto-graded practice form
    │   ├── LessonQuiz.tsx      # Multi-question grader
    │   ├── CompleteButton.tsx  # Manual "Mark complete" button
    │   └── Markdown.tsx        # react-markdown wrapper
    └── lib/
        ├── visitor.ts     # Reads the per-browser visitor id (httpOnly cookie)
        ├── db.ts          # Prisma client singleton
        ├── lessons.ts     # Lesson + quiz seed data (loaded by prisma/seed.ts)
        ├── types.ts       # Shared types
        └── shell/
            ├── fs.ts          # In-memory virtual filesystem
            └── evaluator.ts   # POSIX-style shell interpreter
```

## How progress tracking works

The app does not have user accounts. Instead:

1. An edge middleware (`src/middleware.ts`) runs on every request. The first time a browser hits the app, it sets an httpOnly cookie `learninx_visitor=v_<24 hex chars>` that expires in one year.
2. All progress records (lesson completions, challenge attempts, quiz attempts) are tagged with that visitor id.
3. On subsequent visits, the same id ties new activity back to the original browser.

This gives each learner a persistent "account" without ever asking them to register. Clearing cookies (or browsing in a private window) starts a fresh profile.

## Available shell commands

The sandbox in `src/lib/shell/evaluator.ts` implements the most common teaching commands:

- Navigation and inspection: `pwd`, `cd`, `ls` (incl. `-l`, `-a`, `-la`), `cat`, `head`, `wc`.
- File operations: `mkdir` (incl. `-p`), `touch`, `rm` (incl. `-r`, `-f`), `mv`, `cp`.
- Permissions and process info: `chmod`, `ps`, `top` (read-only informational output).
- System info: `uname`, `uptime`, `free`, `df`, `whoami`, `hostname`, `date`, `echo`, `clear`, `help`.
- Shell built-ins: command history (Up/Down arrows), `Ctrl+C` to abort a line, `Ctrl+L` to clear.

Type `help` inside the terminal for the full list.

The shell evaluates each command against the in-memory virtual filesystem in `src/lib/shell/fs.ts`. Running `rm -rf /` is harmless — the root node is just a JavaScript object.

## Adding a new lesson

All lessons live in code. Edit `src/lib/lessons.ts` and append a new entry to `LESSONS`, plus a matching block in `QUIZ_QUESTIONS`:

```ts
// src/lib/lessons.ts
export const LESSONS: LessonSeed[] = [
  // …existing entries…
  {
    slug: 'my-new-lesson',
    title: 'Title',
    description: 'Short blurb shown on the lessons index.',
    difficulty: 'beginner',           // beginner | intermediate | advanced
    order: 6,                         // next available order number
    trackCommand: 'grep',             // command to surface in the sandbox hint
    challenge: 'Find lines containing "hello" in notes.txt',
    solution: 'grep hello notes.txt', // pipe-separated alternatives: 'a || b'
    content: `# My new lesson

Markdown content goes here.
`,
  },
];

export const QUIZ_QUESTIONS: QuizQuestionSeed[] = [
  // …existing entries…
  {
    lessonSlug: 'my-new-lesson',
    questions: [
      { prompt: 'Which command prints text to the screen?', answer: 'echo' },
    ],
  },
];
```

Then re-seed:

```bash
npm run db:seed
```

The new lesson will be live at `/lessons/my-new-lesson`.

## NPM scripts

| Script             | Description                                                          |
| ------------------ | -------------------------------------------------------------------- |
| `npm run dev`      | Start the dev server on http://localhost:3000.                       |
| `npm run build`    | Run `prisma generate` and produce a production build in `.next/`.    |
| `npm run start`    | Serve the production build.                                          |
| `npm run lint`     | Lint the codebase with `next lint`.                                  |
| `npm run db:push`  | Apply the Prisma schema to `dev.db`.                                 |
| `npm run db:seed`  | Re-seed lessons and quiz questions (idempotent).                     |
| `npm run db:reset` | Drop and re-create the database, then re-seed.                       |

## Configuration

The app reads a single optional environment variable:

| Variable        | Example           | Purpose                          |
| --------------- | ----------------- | -------------------------------- |
| `DATABASE_URL`  | `file:./dev.db`   | Prisma connection string.        |

In production, the Dockerfile defaults `DATABASE_URL` to `file:/data/dev.db`, where `/data` is the persisted volume.

No other secrets are required — the app is anonymous, has no JWT signing keys, and no third-party integrations.

## Architecture decisions

A few choices are deliberate and worth knowing if you plan to extend the project:

- **SQLite is a feature, not a placeholder.** The app is meant to be deployable as a single self-contained container. SQLite keeps that promise. To scale to many concurrent writers, swap `provider = "sqlite"` to `provider = "postgresql"` in `prisma/schema.prisma` and update `DATABASE_URL`.
- **No xterm.js on the server.** The terminal is loaded client-side via dynamic imports inside a `useEffect` so xterm's browser-only globals never reach the server bundle. This is why the lesson page is small on the client initial payload.
- **`output: 'standalone'`.** The Next.js config emits a runnable `server.js` plus a traced `node_modules/` directory. The Dockerfile's runtime stage copies just that.
- **Server actions, not API routes.** All writes (lesson completion, challenge submission, quiz grading) are Next.js Server Actions colocated with the lesson route under `src/app/lessons/[slug]/actions.ts`. This keeps the data flow explicit and visible.

## License

MIT — see [`LICENSE`](LICENSE) if present, otherwise standard MIT terms apply.
