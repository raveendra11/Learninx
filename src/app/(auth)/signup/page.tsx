import { SignupForm } from '@/components/SignupForm';

type SearchParams = { error?: string };

const ERROR_MESSAGES: Record<string, string> = {
  invalid: 'Please check your input — passwords must be at least 8 characters.',
  taken: 'An account with that email already exists.',
};

export default function SignupPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const message = searchParams.error ? ERROR_MESSAGES[searchParams.error] : null;

  return (
    <div className="max-w-md mx-auto mt-10">
      <h1 className="text-3xl font-bold mb-2">Create your account</h1>
      <p className="text-slate-400 mb-6">
        Free forever. Just your email and a password.
      </p>
      <SignupForm errorMessage={message} />
      <p className="text-sm text-slate-500 mt-4">
        Already have an account?{' '}
        <a href="/login" className="text-terminal-accent hover:underline">
          Log in
        </a>
        .
      </p>
    </div>
  );
}
