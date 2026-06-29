# Learninx

> An interactive **Linux learning platform** that teaches the command line through short lessons, hands-on challenges, and a safe in-browser terminal.

Built with **Next.js 14 (App Router)**, **TypeScript**, **Prisma + SQLite**, **Tailwind CSS**, and **xterm.js**.

---

## ✨ Features

- 📘 **Bite-sized Markdown lessons** covering the core of Linux.
- 🖥️ **In-browser terminal sandbox** — try real shell commands (pwd, ls, cd, mkdir, cat, chmod, …) with no risk.
- ⚡ **Challenges** with automatic grading — earn points for each one you solve.
- 🧠 **Quizzes** at the end of every lesson with score-based completion.
- 👤 **Accounts & dashboard** — track your progress, points, and quiz history.
- 🌙 Dark, terminal-inspired UI.

---

## 🚀 Quick start

### Prerequisites
- **Node.js 18.18+** (20.x recommended)
- npm / pnpm / yarn

### 1. Install dependencies

```bash
npm install
```

### 2. Initialize the database

```bash
npx prisma db push
npm run db:seed
```

This creates a `dev.db` SQLite file with 5 lessons, quizzes for each, and a demo account.

### 3. Run the dev server

```bash
npm run dev
```

Open **http://localhost:3000** 🚀

### 4. Try the demo account

```
Email:    demo@learninx.dev
Password: demo1234
```

Or click **Sign up** and create your own.

---

## 🧱 Project structure

```
learninx/
├── prisma/
│   ├── schema.prisma       # Database models
│   └── seed.ts             # Loads the lesson catalogue + demo user
└── src/
    ├── app/
    │   ├── (auth)/         # /login and /signup route group
    │   ├── lessons/        # Lesson index + [slug] detail
    │   ├── dashboard/      # Progress dashboard
    │   ├── api/            # (intentionally empty — server actions used instead)
    │   ├── auth-actions.ts # Sign up / log in / log out
    │   ├── layout.tsx      # Root layout with nav + footer
    │   └── page.tsx        # Landing page
    ├── components/
    │   ├── Terminal.tsx        # xterm.js sandbox
    │   ├── ChallengeRunner.tsx # Auto-graded practice
    │   ├── LessonQuiz.tsx      # Multi-question grader
    │   └── ...
    └── lib/
        ├── auth.ts          # JWT cookie sessions (jose + bcryptjs)
        ├── db.ts            # Prisma singleton
        ├── lessons.ts       # Lesson catalogue + quiz seeds
        └── shell/
            ├── fs.ts        # In-memory virtual filesystem
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

That's it — the lesson will appear at `/lessons/my-new-lesson`.

---

## 🔌 Configuration

Environment variables (copy `.env.example` to `.env`):

| Var            | Example                            | Purpose                              |
| -------------- | ---------------------------------- | ------------------------------------ |
| `DATABASE_URL` | `file:./dev.db`                    | Prisma connection string.            |
| `AUTH_SECRET`  | any long random string             | Signs the session JWT cookie.        |

---

## 🧪 How the sandbox works

Real Linux requires kernel-level isolation that a browser cannot provide. To keep **Learninx zero-install and 100% safe**, the terminal implements a small **POSIX-flavoured shell in TypeScript**:

- A virtual in-memory filesystem ([`fs.ts`](src/lib/shell/fs.ts))
- A growing library of common commands ([`evaluator.ts`](src/lib/shell/evaluator.ts))
- Sessions start at `~` and survive inside the tab — nothing touches your real machine.

This is the same approach used by many coding-interview sandbox platforms. When you're ready to work on a real Linux server, the same skills transfer 1:1.

---

## 📜 License

MIT — go teach someone Linux.
