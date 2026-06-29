import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getVisitorId } from '@/lib/visitor';

export default async function Home() {
  const lessonCount = await prisma.lesson.count();
  const visitorId = getVisitorId();

  const completedCount = await prisma.lessonProgress.count({
    where: { visitorId, completed: true },
  });
  const quizAttempts = await prisma.quizAttempt.count({ where: { visitorId } });

  return (
    <div className="space-y-12">
      <section className="text-center pt-10 pb-6">
        <p className="text-terminal-accent font-mono text-sm mb-4">
          ~/welcome $ cat about.txt
        </p>
        <h1 className="text-5xl font-bold mb-4">
          Learn <span className="text-terminal-accent">Linux</span> the easy way.
        </h1>
        <p className="text-slate-400 max-w-2xl mx-auto text-lg">
          Bite-sized lessons, hands-on challenges, and a safe in-browser terminal.
          No signup. No install. Just open the site and start typing commands.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href="/lessons"
            className="bg-terminal-accent text-slate-900 px-6 py-3 rounded-md font-semibold hover:bg-emerald-300"
          >
            Start learning →
          </Link>
          <a
            href="#how-it-works"
            className="border border-slate-700 px-6 py-3 rounded-md hover:border-terminal-accent"
          >
            How it works
          </a>
        </div>
        <p className="text-xs text-slate-500 mt-4">
          {lessonCount} lessons available — free forever.
        </p>
        {(completedCount > 0 || quizAttempts > 0) && (
          <p className="text-xs text-slate-400 mt-1">
            Your progress: {completedCount}/{lessonCount} lessons •{' '}
            {quizAttempts} quiz attempts
          </p>
        )}
      </section>

      <section id="how-it-works" className="grid md:grid-cols-3 gap-6">
        <FeatureCard
          icon="📘"
          title="Step-by-step lessons"
          body="From your first `ls` to systemd and shell scripting — short chapters with real examples."
        />
        <FeatureCard
          icon="🖥️"
          title="Live terminal sandbox"
          body="Practice in a safe, simulated shell right in your browser. No risk, no setup."
        />
        <FeatureCard
          icon="🏆"
          title="Quizzes & points"
          body="Earn points for each challenge you complete. Your progress is saved on this browser."
        />
      </section>

      <section className="bg-slate-900/60 rounded-xl p-6 border border-slate-800">
        <h2 className="text-2xl font-semibold mb-3 text-terminal-accent">
          Who is this for?
        </h2>
        <ul className="space-y-2 text-slate-300">
          <li>• Beginners who have never touched a terminal.</li>
          <li>• Developers who want to feel comfortable on a Linux server.</li>
          <li>• Students preparing for DevOps, cloud, or sysadmin interviews.</li>
        </ul>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 hover:border-terminal-accent transition">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-slate-400 text-sm">{body}</p>
    </div>
  );
}
