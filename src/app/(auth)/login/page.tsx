import { LoginForm } from '@/components/LoginForm';

type SearchParams = { error?: string; next?: string };

export default function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <div className="max-w-md mx-auto mt-10">
      <h1 className="text-3xl font-bold mb-2">Welcome back</h1>
      <p className="text-slate-400 mb-6">Log in to keep earning points.</p>
      <LoginForm error={searchParams.error} next={searchParams.next} />
      <p className="text-sm text-slate-500 mt-4">
        New here?{' '}
        <a href="/signup" className="text-terminal-accent hover:underline">
          Create an account
        </a>
        .
      </p>
      <p className="text-xs text-slate-600 mt-6">
        Try the demo account: <code>demo@learninx.dev</code> / <code>demo1234</code>
      </p>
    </div>
  );
}
