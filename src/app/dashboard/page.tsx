import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/dashboard');

  const lessons = await prisma.lesson.findMany({ orderBy: { order: 'asc' } });
  const progress = await prisma.lessonProgress.findMany({
    where: { userId: user.id, completed: true },
  });
  const attempts = await prisma.quizAttempt.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { lesson: true },
  });

  const completedSet = new Set(progress.map((p) => p.lessonId));
  const completed = lessons.filter((l) => completedSet.has(l.id));
  const remaining = lessons.filter((l) => !completedSet.has(l.id));
  const completionPct = lessons.length
    ? Math.round((completed.length / lessons.length) * 100)
    : 0;

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between bg-slate-900/40 border border-slate-800 rounded-xl p-6">
        <div>
          <h1 className="text-2xl font-bold">
            Welcome, {user.name || user.email.split('@')[0]}
          </h1>
          <p className="text-slate-400 mt-1">
            Progress: <strong>{completed.length}</strong>/{lessons.length} lessons (
            {completionPct}%)
          </p>
          <div className="mt-3 h-2 w-72 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-terminal-accent transition-all"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>
        <div className="text-right">
          <div className="text-4xl font-bold text-terminal-accent">
            {user.points}
          </div>
          <div className="text-sm text-slate-400">points</div>
        </div>
      </header>

      <section className="grid md:grid-cols-2 gap-6">
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
          <h2 className="font-semibold mb-3">Keep going</h2>
          {remaining.length === 0 ? (
            <p className="text-slate-400 text-sm">
              🎉 You finished every lesson. Teach a friend!
            </p>
          ) : (
            <ul className="space-y-2">
              {remaining.slice(0, 5).map((l) => (
                <li key={l.id}>
                  <Link
                    href={`/lessons/${l.slug}`}
                    className="block px-3 py-2 rounded-md hover:bg-slate-800 flex items-center justify-between"
                  >
                    <span>{l.title}</span>
                    <span className="text-xs text-slate-500">{l.difficulty}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
          <h2 className="font-semibold mb-3">Recent quizzes</h2>
          {attempts.length === 0 ? (
            <p className="text-slate-400 text-sm">
              No quiz attempts yet — finish a lesson to see them here.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {attempts.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between border-b border-slate-800 pb-2 last:border-0"
                >
                  <span>{a.lesson.title}</span>
                  <span
                    className={`font-mono ${
                      a.score >= 80 ? 'text-emerald-300' : 'text-amber-300'
                    }`}
                  >
                    {a.score}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
