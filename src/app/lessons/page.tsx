import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export default async function LessonsIndexPage() {
  const lessons = await prisma.lesson.findMany({ orderBy: { order: 'asc' } });
  const user = await getSessionUser();

  const progressList = user
    ? await prisma.lessonProgress.findMany({ where: { userId: user.id } })
    : [];
  const completedSlugs = new Set(
    progressList.filter((p) => p.completed).map((p) => p.lessonId),
  );

  const lessonsWithStatus = await Promise.all(
    lessons.map(async (l) => ({
      ...l,
      completed: completedSlugs.has(l.id),
    })),
  );

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Lessons</h1>
      <p className="text-slate-400 mb-8">
        Work through the chapters in order. Each lesson ends with a small challenge.
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
