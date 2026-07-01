# Learninx

An interactive Linux learning platform that teaches the command line through short lessons, hands-on challenges, and a safe in-browser terminal.

No login. No accounts. No database. Open the page, type commands, learn.

## Highlights

- Bite-sized Markdown lessons covering the core of the Linux command line.
- In-browser terminal sandbox (xterm.js) with a small POSIX-style shell and an in-memory virtual filesystem — nothing touches the user's real machine.
- Auto-graded challenges and end-of-lesson quizzes with score-based completion.
- Anonymous progress tracking via a signed per-browser cookie. No signup, no DB.
- Dark, terminal-inspired UI.
- Ships with Docker support for production-style deployments.

## Stack

| Layer    | Technology                                     |
| -------- | ---------------------------------------------- |
| Runtime  | Node.js 20 LTS                                 |
| Framework| Next.js 14 (App Router) + TypeScript           |
| Styling  | Tailwind CSS                                   |
| Storage  | None — lessons are code, progress is a cookie  |
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

# 2. Start the dev server
npm run dev
```

Then open <http://localhost:3000>. No database to create, no seed script to run — the lesson catalogue is in code and progress is a cookie on the browser.

## Docker

A multi-stage Dockerfile is included. Production builds use Next.js's `output: 'standalone'` mode, so the runtime image carries only the traced `node_modules` plus a single `server.js`.

```bash
# Build and run with Docker directly
docker build -t learninx:latest .
docker run --rm -p 3000:3000 learninx:latest
```

Or with the supplied compose file:

```bash
docker compose up --build
```

The image is self-contained: no volumes, no database, no migrations.

### Build stages

| Stage      | Purpose                                                                    |
| ---------- | -------------------------------------------------------------------------- |
| `deps`     | Install all npm dependencies (build + runtime).                            |
| `builder`  | Run `next build` with `output: 'standalone'`.                              |
| `runner`   | Minimal `node:20-alpine` image that runs the standalone `server.js`.       |

On every container start, the runner copies the static assets into the standalone output (idempotent), then launches the Next.js server on port 3000.

## Project structure

```
learninx/
├── scripts/
│   └── copy-standalone-assets.mjs   # Idempotent post-build step
└── src/
    ├── app/
    │   ├── layout.tsx     # Root layout: nav, footer
    │   ├── page.tsx       # Landing page (reads progress cookie)
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
        ├── lessons.ts     # Lesson + quiz catalogue (plain TypeScript)
        ├── progress.ts    # Signed-cookie progress store (HMAC-SHA256)
        ├── types.ts       # Shared types
        └── shell/
            ├── fs.ts          # In-memory virtual filesystem
            └── evaluator.ts   # POSIX-style shell interpreter
```

## How progress tracking works

The app does not have user accounts and does not use a database. Instead:

1. When the learner marks a lesson complete or submits a quiz, the server action reads/writes a **signed cookie** named `learninx_progress`. The cookie is `base64url(json).base64url(hmac-sha256)` and contains the visitor's completed-lesson ids plus their last quiz score per lesson.
2. The cookie is `httpOnly`, `sameSite=lax`, expires in 1 year, and is verified on every read.
3. Clearing cookies (or browsing in a private window) starts a fresh profile.

The signing key comes from `LEARNINX_SECRET` if set, otherwise a per-process random key (fine for dev, resets on every container restart). See [Configuration](#configuration).

This gives each learner a persistent "account" without ever asking them to register and without a database.

## Available shell commands

The sandbox in `src/lib/shell/evaluator.ts` implements the most common teaching commands:

- Navigation and inspection: `pwd`, `cd`, `ls` (incl. `-l`, `-a`, `-la`), `cat`, `head`, `wc`.
- File operations: `mkdir` (incl. `-p`), `touch`, `rm` (incl. `-r`, `-f`), `mv`, `cp`.
- Permissions and process info: `chmod`, `ps`, `top` (read-only informational output).
- System info: `uname`, `uptime`, `free`, `df`, `whoami`, `hostname`, `date`, `echo`, `clear`, `help`.
- Simulated editors: `nano`, `vi`, `vim`, `pico`, `emacs` — print a TUI-style view of the file and point the learner to the editing commands that actually mutate the file (`echo >`, `>>`, heredocs, `sed`, `printf`).
- Shell built-ins: command history (Up/Down arrows), `Ctrl+C` to abort a line, `Ctrl+L` to clear.

Type `help` inside the terminal for the full list.

The shell evaluates each command against the in-memory virtual filesystem in `src/lib/shell/fs.ts`. Running `rm -rf /` is harmless — the root node is just a JavaScript object.

## Adding a new lesson

All lessons live in code. Edit `src/lib/lessons.ts` and append a new entry to `LESSONS`, plus a matching block in `QUIZ_QUESTIONS`:

```ts
// src/lib/lessons.ts
export const LESSONS: Lesson[] = [
  // …existing entries…
  {
    id: 'my-new-lesson',            // stable id; also used as the quiz join key
    slug: 'my-new-lesson',          // URL: /lessons/my-new-lesson
    title: 'Title',
    description: 'Short blurb shown on the lessons index.',
    difficulty: 'beginner',         // beginner | intermediate | advanced
    order: 6,                       // next available order number
    trackCommand: 'grep',           // command to surface in the sandbox hint
    challenge: 'Find lines containing "hello" in notes.txt',
    solution: 'grep hello notes.txt', // pipe-separated alternatives: 'a || b'
    content: `# My new lesson

Markdown content goes here.`,
  },
];

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  // …existing entries…
  {
    id: 'q-mnl-1',
    lessonId: 'my-new-lesson',
    order: 0,
    prompt: 'Which command prints text to the screen?',
    answer: 'echo',
  },
];
```

Save the file — Next.js dev server hot-reloads. The new lesson will be live at `/lessons/my-new-lesson`.

## NPM scripts

| Script                | Description                                                          |
| --------------------- | -------------------------------------------------------------------- |
| `npm run dev`         | Start the dev server on http://localhost:3000.                       |
| `npm run build`       | Produce a production build in `.next/`.                              |
| `npm run start`       | Copy static assets into the standalone output and serve the build.   |
| `npm run start:dev`   | Serve a previously-built bundle via `next start` (no asset copy).    |
| `npm run lint`        | Lint the codebase with `next lint`.                                  |

## Configuration

The app reads one optional environment variable:

| Variable          | Example                                | Purpose                                                  |
| ----------------- | -------------------------------------- | -------------------------------------------------------- |
| `LEARNINX_SECRET` | `a long random string`                 | HMAC key for the progress cookie. Set this in production so progress survives deploys and restarts. |

No other secrets are required — the app is anonymous and has no third-party integrations.

## Architecture decisions

A few choices are deliberate and worth knowing if you plan to extend the project:

- **No database is a feature.** The whole point of a learning app is that a visitor can try it instantly. Spinning up Postgres or running migrations would be friction with no payoff for this app's scale. A signed cookie is the simplest store that still gives every browser a persistent profile.
- **Lessons in code, not data.** `src/lib/lessons.ts` is the single source of truth. Edits are typed, reviewed via git, hot-reloaded by `next dev`, and ship in the JS bundle — no seed step, no migrations.
- **No xterm.js on the server.** The terminal is loaded client-side via dynamic imports inside a `useEffect` so xterm's browser-only globals never reach the server bundle. This is why the lesson page is small on the client initial payload.
- **`output: 'standalone'`.** The Next.js config emits a runnable `server.js` plus a traced `node_modules/` directory. The Dockerfile's runtime stage copies just that.
- **Server actions, not API routes.** All writes (lesson completion, challenge submission, quiz grading) are Next.js Server Actions colocated with the lesson route under `src/app/lessons/[slug]/actions.ts`. This keeps the data flow explicit and visible.

## License

MIT — see [`LICENSE`](LICENSE) if present, otherwise standard MIT terms apply.
