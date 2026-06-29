import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { Markdown } from '@/components/Markdown';
import { Terminal } from '@/components/Terminal';
import { ChallengeRunner } from '@/components/ChallengeRunner';
import { LessonQuiz } from '@/components/LessonQuiz';
import { CompleteButton } from '@/components/CompleteButton';

interface PageProps {
  params: { slug: string };
}

export default async function LessonPage({ params }: PageProps) {
  const lessons = await prisma.lesson.findMany({ orderBy: { order: 'asc' } });
  const idx = lessons.findIndex((l) => l.slug === params.slug);
  if (idx === -1) notFound();
  const lesson = lessons[idx];

  const previous = idx > 0 ? lessons[idx - 1] : null;
  const next = idx < lessons.length - 1 ? lessons[idx + 1] : null;

  const questions = await prisma.quizQuestion.findMany({
    where: { lessonId: lesson.id },
    orderBy: { order: 'asc' },
  });

  const user = await getSessionUser();
  const progress = user
    ? await prisma.lessonProgress.findUnique({
        where: { userId_lessonId: { userId: user.id, lessonId: lesson.id } },
      })
    : null;

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      <article className="lg:col-span-3 space-y-6">
        <div>
          <Link
            href="/lessons"
            className="text-sm text-slate-400 hover:text-terminal-accent"
          >
            ← Back to lessons
          </Link>
          <h1 className="text-3xl font-bold mt-2">{lesson.title}</h1>
          <div className="flex gap-2 mt-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 uppercase tracking-wide">
              {lesson.difficulty}
            </span>
            {progress?.completed && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-300">
                ✓ Completed
              </span>
            )}
          </div>
        </div>

        <Markdown content={lesson.content} />

        {lesson.challenge && (
          <section className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-terminal-accent mb-2">
              ⚡ Challenge
            </h2>
            <p className="text-slate-300 mb-4">{lesson.challenge}</p>
            <ChallengeRunner
              lessonId={lesson.id}
              lessonSlug={lesson.slug}
              initiallyCompleted={!!progress?.completed}
            />
          </section>
        )}

        {questions.length > 0 && (
          <section className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-terminal-accent mb-2">
              🧠 Quiz
            </h2>
            <p className="text-slate-400 text-sm mb-4">
              Answer these to lock in the concepts. Get at least 80% to mark the
              lesson complete.
            </p>
            <LessonQuiz
              lessonId={lesson.id}
              questions={questions.map((q) => ({ id: q.id, prompt: q.prompt }))}
            />
          </section>
        )}

        {progress?.completed === false && (
          <CompleteButton lessonId={lesson.id} />
        )}

        <nav className="flex justify-between pt-6 border-t border-slate-800">
          {previous ? (
            <Link
              href={`/lessons/${previous.slug}`}
              className="text-sm text-slate-400 hover:text-terminal-accent"
            >
              ← {previous.title}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={`/lessons/${next.slug}`}
              className="text-sm text-terminal-accent hover:underline"
            >
              {next.title} →
            </Link>
          ) : (
            <span className="text-sm text-slate-500">🎉 You finished the track!</span>
          )}
        </nav>
      </article>

      <aside className="lg:col-span-2 lg:sticky lg:top-20 self-start space-y-3">
        <div className="text-sm text-slate-400">Sandbox</div>
        <Terminal
          suggestion={
            lesson.trackCommand
              ? { command: lesson.trackCommand, expected: lesson.trackCommand }
              : undefined
          }
        />
        <p className="text-xs text-slate-500">
          This is a safe in-browser shell. Nothing here touches your real
          machine. Type <code>help</code> to see what you can run.
        </p>
      </aside>
    </div>
  );
}
