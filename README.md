````markdown
# Learninx

> An interactive **Linux learning platform** that teaches the command line through short lessons, hands-on challenges, and a safe in-browser terminal.

Built with **Next.js 14 (App Router)**, **TypeScript**, **Prisma + SQLite**, **Tailwind CSS**, and **xterm.js**.

---

## ✨ Features

- 📘 **Bite-sized Markdown lessons** covering the core of Linux.
- 🖥️ **In-browser terminal sandbox** — try real shell commands (pwd, ls, cd, mkdir, cat, chmod, ps aux, …) with no risk.
- ⚡ **Challenges** with automatic grading.
- 🧠 **Quizzes** at the end of every lesson with score-based completion.
- 🏆 **Progress tracking** — per-browser cookie; no signup, no accounts, no friction.
- 🌙 Dark, terminal-inspired UI.

---

## 🚀 Quick start

### Prerequisites
- **Node.js 18.18+** (20.x recommended)
- npm

### 1. Install dependencies

```bash
npm install
```

### 2. Initialize the database

```bash
npx prisma db push
npm run db:seed
```

This creates a `dev.db` SQLite file with 5 lessons and matching quizzes.

### 3. Run the dev server

```bash
npm run dev
```

Open **http://localhost:3000** 🚀

That's it — there's no signup. Your progress is saved in a per-browser cookie.

---

## 🐳 Run with Docker

A production-ready, multi-stage Dockerfile is included.

```bash
docker build -t learninx:latest .
docker run --rm -p 3000:3000 -v learninx-data:/data learninx:latest
```

Or use the supplied compose file:

```bash
docker compose up --build
```

The SQLite database (with the lesson catalogue and your per-visitor progress)
is persisted on a named volume (`learninx-data`). Removing it resets all state.

### Build details

| Stage         | Purpose                                                            |
| ------------- | ------------------------------------------------------------------ |
| `deps`        | Install all (dev + runtime) npm dependencies.                      |
| `builder`     | Generate the Prisma client + run `next build` with `output: standalone`. |
| `runner`      | Tiny `node:20-alpine` runtime that runs the standalone `server.js`. |

On every container start the runner auto-applies the Prisma schema and seeds
the lesson catalogue into `/data/dev.db` if it's empty, then launches the
Next.js server on **port 3000**.

---

## 🧱 Project structure

```
learninx/
├── prisma/
│   ├── schema.prisma       # Database models (no User table — anonymous)
│   └── seed.ts             # Loads the lesson catalogue + quiz questions
└── src/
    ├── app/
    │   ├── lessons/        # Lesson index + [slug] detail + server actions
    │   ├── layout.tsx      # Root layout with nav + footer
    │   └── page.tsx        # Landing page
    ├── components/
    │   ├── Terminal.tsx        # xterm.js sandbox
    │   ├── ChallengeRunner.tsx # Auto-graded practice
    │   ├── LessonQuiz.tsx      # Multi-question grader
    │   └── …
    └── lib/
        ├── visitor.ts      # Per-browser visitor id (no auth)
        ├── db.ts           # Prisma singleton
        ├── lessons.ts      # Lesson catalogue + quiz seeds
        └── shell/
            ├── fs.ts       # In-memory virtual filesystem
            └── evaluator.ts # Tiny POSIX-like shell interpreter
```

---

## ➕ Adding a new lesson

Open [`src/lib/lessons.ts`](src/lib/lessons.ts) and add an entry to `LESSONS`, plus a matching block in `QUIZ_QUESTIONS`.

```ts
{
  slug: 'my-new-lesson',
  title: 'Title',
  description: 'Short blurb.',
  difficulty: 'beginner',   // beginner | intermediate | advanced
  order: 6,                 // next available number
  trackCommand: 'grep',     // command that should be tried in the sandbox
  challenge: 'Find the word "hello" in notes.txt',
  solution: 'grep hello notes.txt',
  content: `# My new lesson...`,
}
```

Then re-seed:

```bash
npm run db:seed
```

The lesson will then appear at `/lessons/my-new-lesson`.

---

## 🔌 Configuration

Environment variables (copy `.env.example` to `.env`):

| Var            | Example         | Purpose                          |
| -------------- | --------------- | -------------------------------- |
| `DATABASE_URL` | `file:./dev.db` | Prisma connection string.        |

Anonymous mode means no other secrets are needed.

---

## 🧪 How the sandbox works

Real Linux requires kernel-level isolation that a browser cannot provide. To keep **Learninx zero-install and 100% safe**, the terminal implements a small **POSIX-flavoured shell in TypeScript**:

- A virtual in-memory filesystem ([`src/lib/shell/fs.ts`](src/lib/shell/fs.ts))
- A growing library of common commands ([`src/lib/shell/evaluator.ts`](src/lib/shell/evaluator.ts))
- Sessions start at `~` and survive inside the tab — nothing touches your real machine.

This is the same approach used by many coding-interview sandbox platforms. When you're ready to work on a real Linux server, the same skills transfer 1:1.

---

## 📜 License

MIT — go teach someone Linux.
````
