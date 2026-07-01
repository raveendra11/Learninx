import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAllLessons, getQuestionsForLesson } from '@/lib/lessons';
import { isLessonCompleted } from '@/lib/progress';
import { Markdown } from '@/components/Markdown';
import { TerminalClient as Terminal } from '@/components/TerminalClient';
import { ChallengeRunner } from '@/components/ChallengeRunner';
import { LessonQuiz } from '@/components/LessonQuiz';
import { CompleteButton } from '@/components/CompleteButton';

interface PageProps {
  params: { slug: string };
}

// Read per-visitor progress on every render.
export const dynamic = 'force-dynamic';

export default function LessonPage({ params }: PageProps) {
  const lessons = getAllLessons();
  const idx = lessons.findIndex((l) => l.slug === params.slug);
  if (idx === -1) notFound();
  const lesson = lessons[idx];

  const previous = idx > 0 ? lessons[idx - 1] : null;
  const next = idx < lessons.length - 1 ? lessons[idx + 1] : null;

  const questions = getQuestionsForLesson(lesson.id);
  const completed = isLessonCompleted(lesson.id);

  return (
    <div className="lg:flex lg:items-start lg:gap-8">
      <article className="lg:flex-1 lg:min-w-0 lg:max-w-2xl xl:max-w-3xl lg:ml-[max(1rem,calc((100vw-80rem)/2))] space-y-6">
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
            {completed && (
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
              initiallyCompleted={completed}
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

        {!completed && (
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
            <span className="text-sm text-slate-500">
              🎉 You finished the track!
            </span>
          )}
        </nav>
      </article>

      <aside className="lg:flex-[1.4] lg:min-w-0 lg:sticky lg:top-20 self-start h-[calc(100vh-6rem)] flex flex-col lg:mr-4">
        <div className="text-sm text-slate-400 mb-2 shrink-0">Sandbox</div>
        <div className="flex-1 min-h-0">
          <Terminal
            className="h-full flex flex-col"
            suggestion={
              lesson.trackCommand
                ? { command: lesson.trackCommand, expected: lesson.trackCommand }
                : undefined
            }
          />
        </div>
        <p className="text-xs text-slate-500 mt-2 shrink-0">
          This is a safe in-browser shell. Nothing here touches your real
          machine. Type <code>help</code> to see what you can run.
        </p>
      </aside>
    </div>
  );
}
