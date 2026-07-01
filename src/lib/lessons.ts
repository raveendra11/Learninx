/**
 * Lesson catalogue and quiz questions — single source of truth, in code.
 *
 * The previous version of this project stored lessons and quiz questions in a
 * SQLite database via Prisma. That layer has been removed. Lessons and quizzes
 * now ship directly in the JavaScript bundle so the app needs no DB to run.
 *
 * Per-visitor progress (which lessons are completed, quiz scores) is stored
 * in a signed cookie — see `./progress.ts`. This keeps the app stateless
 * server-side while still giving each browser a persistent "profile" without
 * a signup flow.
 */

import type { Lesson, QuizQuestion } from './types';

export const LESSONS: Lesson[] = [
  {
    id: 'getting-started',
    slug: 'getting-started',
    title: 'Getting Started with Linux',
    description: 'What Linux is, the shell, and your first commands.',
    difficulty: 'beginner',
    order: 1,
    trackCommand: 'whoami',
    challenge: 'Use a single command to print the word `linux` to the screen.',
    solution: 'echo linux',
    content: `# Getting Started with Linux

**Linux** is a free, open-source operating system kernel that powers everything from phones to supercomputers. Most servers on the internet run Linux, and it is the single most important skill for anyone in DevOps, cloud, or backend development.

## What is the shell?

The **shell** is a program that takes commands from your keyboard and gives them to the operating system. The most common shell on Linux is called **bash**.

When you open a terminal, you see a *prompt* that ends with a dollar sign \`$\`. Everything you type after that prompt is a command.

## Your first commands

Try these in the terminal on the right:

\`\`\`bash
whoami          # show your current user
date            # show the current date and time
echo hello      # print "hello"
clear           # clear the screen
\`\`\`

> Lines that start with \`#\` are **comments**; the shell ignores them. They are just for you.

## Why learn the command line?

- Far faster than clicking through menus.
- Automatable; write a **script** once, run it forever.
- Works the same on a tiny VM or a giant cluster.

When you're ready, hit **Mark complete** and move to the next lesson.
`,
  },
  {
    id: 'filesystem-navigation',
    slug: 'filesystem-navigation',
    title: 'Filesystem Navigation',
    description: 'Move around the filesystem with `pwd`, `ls`, and `cd`.',
    difficulty: 'beginner',
    order: 2,
    trackCommand: 'ls',
    challenge: 'From `/home/learner`, change into the `projects` directory.',
    solution: 'cd projects',
    content: `# Filesystem Navigation

Linux organises everything under a single root directory \`/\`. Unlike Windows, there are no drive letters; everything branches off \`/\`.

## Three commands you will use constantly

| Command | What it does                  | Example         |
| ------- | ----------------------------- | --------------- |
| \`pwd\`   | Print current directory       | \`pwd\`          |
| \`ls\`    | List files in current dir     | \`ls -la\`       |
| \`cd\`    | Change directory              | \`cd /tmp\`      |

## Paths

- **Absolute paths** start at \`/\`, e.g. \`/home/learner\`.
- **Relative paths** start from where you are, e.g. \`../projects\`.

Special directory shortcuts:

- \`.\` - the current directory
- \`..\` - the parent directory
- \`~\` - your home directory

## Try it

\`\`\`bash
pwd                # shows something like /home/learner
ls                 # list contents
ls -la             # long format, including hidden files
cd /tmp            # jump to /tmp
pwd                # confirm you're now in /tmp
cd ~               # back home
\`\`\`
`,
  },
  {
    id: 'files-and-dirs',
    slug: 'files-and-dirs',
    title: 'Creating and Manipulating Files',
    description: 'touch, mkdir, cp, mv, rm - the core file operations.',
    difficulty: 'beginner',
    order: 3,
    trackCommand: 'mkdir',
    challenge:
      'Create a new directory called `lab` and then create an empty file `lab/notes.txt` inside it. Do it in two commands.',
    solution: 'mkdir lab && touch lab/notes.txt',
    content: `# Creating and Manipulating Files

In this lesson you'll learn the everyday verbs for working with files and directories.

## Make

\`\`\`bash
mkdir projects          # create a directory
mkdir -p a/b/c          # create nested directories (-p = parents)
touch notes.txt         # create an empty file (or update timestamp)
\`\`\`

## Inspect

\`\`\`bash
cat notes.txt           # print file contents
less notes.txt          # page through a file (q to quit)
head -n 5 notes.txt     # first 5 lines
wc -l notes.txt         # count lines
\`\`\`

## Move / copy / delete

\`\`\`bash
cp notes.txt copy.txt        # copy
mv notes.txt renamed.txt     # rename / move
rm renamed.txt               # delete a file
rm -r projects               # delete a directory recursively
\`\`\`

> Warning: \`rm\` is **permanent**. There is no recycle bin. Triple-check before running \`rm -rf /\`.

## Edit

You'll often edit files straight from the terminal:

- \`nano notes.txt\` - beginner-friendly editor
- \`vim notes.txt\` - powerful but steep learning curve
`,
  },
  {
    id: 'users-and-permissions',
    slug: 'users-and-permissions',
    title: 'Users and Permissions',
    description: 'Understand users, groups, and the chmod / chown commands.',
    difficulty: 'intermediate',
    order: 4,
    trackCommand: 'chmod',
    challenge:
      'Make `script.sh` executable for the owner only (no permissions for group or others).',
    solution: 'chmod 700 script.sh',
    content: `# Users and Permissions

Linux is a **multi-user** system. Every file belongs to a user and a group, and has three permission sets: **owner**, **group**, and **everyone else**.

## Reading permissions

Run \`ls -l\` and you will see something like:

\`\`\`
-rwxr-x---  1  alice  devs  1024  Jun 28  script.sh
\`\`\`

Breakdown:

- \`-\` - regular file (\`d\` for directory)
- \`rwx\` - owner can read, write, execute
- \`r-x\` - group can read and execute
- \`---\` - others have no access

## Changing permissions

\`\`\`bash
chmod 755 script.sh      # owner: rwx, group+other: rx
chmod +x script.sh       # add execute for everyone
chmod 600 secret.txt     # owner only
\`\`\`

The numbers are octal:

| Digit | r | w | x |
| ----- | - | - | - |
| 7     | yes | yes | yes |
| 6     | yes | yes |     |
| 5     | yes |     | yes |
| 4     | yes |     |     |

## Why this matters

Servers get hacked because files are too permissive. When in doubt, *least privilege* - grant only what is needed.
`,
  },
  {
    id: 'processes-and-system',
    slug: 'processes-and-system',
    title: 'Processes and the System',
    description: 'ps, top, kill, and how to find what is running.',
    difficulty: 'intermediate',
    order: 5,
    trackCommand: 'ps',
    challenge:
      'Show the top of the `ps aux` output filtered to lines containing the word `root`.',
    solution: 'ps aux | grep root',
    content: `# Processes and the System

A **process** is a running program. Linux gives every process a numeric ID called a **PID**.

## Inspecting processes

\`\`\`bash
ps aux                 # snapshot of all processes
top                    # live, updating view (q to quit)
pgrep -a node          # find processes by name
\`\`\`

## Killing processes

\`\`\`bash
kill 1234              # polite shutdown (SIGTERM)
kill -9 1234           # force kill (SIGKILL) - last resort
pkill -f "python app"  # kill by pattern
\`\`\`

## System info

\`\`\`bash
uname -a               # kernel info
uptime                 # how long the system has been up
free -h                # memory usage
df -h                  # disk space
\`\`\`

## Foreground vs background

- Run normally: \`python app.py\` (foreground)
- Run in background: \`python app.py &\`
- Bring back to foreground: \`fg\`

These tools are your first stop when something is wrong on a server.
`,
  },
];

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'q-gs-1',
    lessonId: 'getting-started',
    order: 0,
    prompt: 'Which command prints text to the screen?',
    answer: 'echo',
  },
  {
    id: 'q-gs-2',
    lessonId: 'getting-started',
    order: 1,
    prompt: 'What does `whoami` tell you?',
    answer: 'user',
  },
  {
    id: 'q-fs-1',
    lessonId: 'filesystem-navigation',
    order: 0,
    prompt: 'Which command prints the current working directory?',
    answer: 'pwd',
  },
  {
    id: 'q-fs-2',
    lessonId: 'filesystem-navigation',
    order: 1,
    prompt: 'Which symbol means "your home directory"?',
    answer: '~',
  },
  {
    id: 'q-fd-1',
    lessonId: 'files-and-dirs',
    order: 0,
    prompt: 'What flag on `mkdir` creates nested directories?',
    answer: '-p',
  },
  {
    id: 'q-fd-2',
    lessonId: 'files-and-dirs',
    order: 1,
    prompt: 'Which command deletes an empty file?',
    answer: 'rm',
  },
  {
    id: 'q-up-1',
    lessonId: 'users-and-permissions',
    order: 0,
    prompt: 'In `chmod 755`, what does the first digit control?',
    answer: 'owner',
  },
  {
    id: 'q-up-2',
    lessonId: 'users-and-permissions',
    order: 1,
    prompt:
      'True or false: `chmod +x` adds execute permission. (answer: true or false)',
    answer: 'true',
  },
  {
    id: 'q-ps-1',
    lessonId: 'processes-and-system',
    order: 0,
    prompt: 'Which command shows a live, updating process list?',
    answer: 'top',
  },
  {
    id: 'q-ps-2',
    lessonId: 'processes-and-system',
    order: 1,
    prompt: 'Which signal number forces a kill?',
    answer: '9',
  },
];

/** Lessons sorted by `order` — what every page renders. */
export function getAllLessons(): Lesson[] {
  return [...LESSONS].sort((a, b) => a.order - b.order);
}

/** Look up a lesson by slug. Returns `null` if it doesn't exist. */
export function getLessonBySlug(slug: string): Lesson | null {
  return LESSONS.find((l) => l.slug === slug) ?? null;
}

/** Quiz questions for a given lesson, ordered. */
export function getQuestionsForLesson(lessonId: string): QuizQuestion[] {
  return QUIZ_QUESTIONS.filter((q) => q.lessonId === lessonId).sort(
    (a, b) => a.order - b.order,
  );
}
