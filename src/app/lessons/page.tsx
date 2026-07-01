import Link from 'next/link';
import { getAllLessons } from '@/lib/lessons';
import { getCompletedLessonIds } from '@/lib/progress';

// Read per-visitor progress on every render.
export const dynamic = 'force-dynamic';

export default function LessonsIndexPage() {
  const lessons = getAllLessons();
  const completedLessonIds = getCompletedLessonIds();

  const lessonsWithStatus = lessons.map((l) => ({
    ...l,
    completed: completedLessonIds.has(l.id),
  }));

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Lessons</h1>
      <p className="text-slate-400 mb-8">
        Work through the chapters in order. Each lesson ends with a small
        challenge. Your progress is saved on this browser.
      </p>

      <div className="space-y-4">
        {lessonsWithStatus.map((lesson) => (
          <Link
            key={lesson.id}
            href={`/lessons/${lesson.slug}`}
            className="flex items-center justify-between bg-slate-900/40 border border-slate-800 hover:border-terminal-accent rounded-xl p-5 transition"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 uppercase tracking-wide">
                  {lesson.difficulty}
                </span>
                {lesson.completed && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-300">
                    ✓ Completed
                  </span>
                )}
              </div>
              <h2 className="text-lg font-semibold">{lesson.title}</h2>
              <p className="text-sm text-slate-400">{lesson.description}</p>
            </div>
            <span className="text-terminal-accent font-mono">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
