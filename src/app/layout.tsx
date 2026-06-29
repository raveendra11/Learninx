import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Learninx — Learn Linux the Easy Way',
  description:
    'An interactive Linux learning platform with in-browser terminal, lessons, and quizzes. No signup required.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
              <a
                href="https://github.com/raveendra11/Learninx"
                target="_blank"
                rel="noreferrer"
                className="text-slate-400 hover:text-terminal-accent hidden sm:inline"
              >
                GitHub
              </a>
            </div>
          </nav>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>

        <footer className="max-w-6xl mx-auto px-4 py-8 text-center text-sm text-slate-500">
          Built for learning Linux — open source • no signup, no tracking
        </footer>
      </body>
    </html>
  );
}
