'use client';

import { useState } from 'react';
import { loginAction } from '@/app/auth-actions';

const ERROR_MESSAGES: Record<string, string> = {
  invalid: 'Email or password is incorrect.',
};

export function LoginForm({
  error,
  next: nextPath,
}: {
  error?: string;
  next?: string;
}) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      action={async (fd) => {
        setSubmitting(true);
        try {
          await loginAction(fd);
        } finally {
          setSubmitting(false);
        }
      }}
      className="space-y-4 bg-slate-900/50 p-6 rounded-xl border border-slate-800"
    >
      {error && (
        <p className="text-sm text-red-400 bg-red-950/30 px-3 py-2 rounded">
          {ERROR_MESSAGES[error] ?? 'Something went wrong.'}
        </p>
      )}
      <Field id="email" label="Email" type="email" autoComplete="email" required />
      <Field
        id="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        required
      />
      {nextPath && <input type="hidden" name="next" value={nextPath} />}
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-terminal-accent text-slate-900 py-2 rounded-md font-semibold hover:bg-emerald-300 disabled:opacity-60"
      >
        {submitting ? 'Logging in…' : 'Log in'}
      </button>
    </form>
  );
}

function Field({
  id,
  label,
  type,
  required,
  autoComplete,
}: {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm mb-1 text-slate-300">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        autoComplete={autoComplete}
        className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-slate-100 focus:border-terminal-accent focus:outline-none"
      />
    </div>
  );
}
