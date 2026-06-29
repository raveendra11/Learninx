import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionUser } from '@/lib/auth';
import { LogoutButton } from '@/components/LogoutButton';
import './globals.css';

export const metadata: Metadata = {
  title: 'Learninx — Learn Linux the Easy Way',
  description:
    'An interactive Linux learning platform with in-browser terminal, lessons, and quizzes.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  return (
    <html lang="en">
      <body>
        <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-30">
          <nav className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
              <span className="text-terminal-accent">~$</span>
              <span>
                learn<span className="text-terminal-accent">inx</span>
              </span>
            </Link>

            <div className="flex items-center gap-4 text-sm">
              <Link href="/lessons" className="hover:text-terminal-accent">
                Lessons
              </Link>
              {user ? (
                <>
                  <Link href="/dashboard" className="hover:text-terminal-accent">
                    Dashboard ({user.points} pts)
                  </Link>
                  <span className="text-slate-400 hidden sm:inline">{user.email}</span>
                  <LogoutButton />
                </>
              ) : (
                <>
                  <Link href="/login" className="hover:text-terminal-accent">
                    Log in
                  </Link>
                  <Link
                    href="/signup"
                    className="bg-terminal-accent text-slate-900 px-3 py-1.5 rounded-md font-medium hover:bg-emerald-300"
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </nav>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>

        <footer className="max-w-6xl mx-auto px-4 py-8 text-center text-sm text-slate-500">
          Built for learning Linux — open source • MIT
        </footer>
      </body>
    </html>
  );
}
