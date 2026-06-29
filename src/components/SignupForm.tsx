'use client';

import { useState } from 'react';
import { signupAction } from '@/app/auth-actions';

export function SignupForm({ errorMessage }: { errorMessage?: string | null }) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      action={async (fd) => {
        setSubmitting(true);
        try {
          await signupAction(fd);
        } finally {
          setSubmitting(false);
        }
      }}
      className="space-y-4 bg-slate-900/50 p-6 rounded-xl border border-slate-800"
    >
      {errorMessage && (
        <p className="text-sm text-red-400 bg-red-950/30 px-3 py-2 rounded">
          {errorMessage}
        </p>
      )}
      <Field id="name" label="Name (optional)" type="text" autoComplete="name" />
      <Field id="email" label="Email" type="email" autoComplete="email" required />
      <Field
        id="password"
        label="Password (min 8 chars)"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
      />
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-terminal-accent text-slate-900 py-2 rounded-md font-semibold hover:bg-emerald-300 disabled:opacity-60"
      >
        {submitting ? 'Creating account…' : 'Create account'}
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
  minLength,
}: {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  autoComplete?: string;
  minLength?: number;
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
        minLength={minLength}
        className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-slate-100 focus:border-terminal-accent focus:outline-none"
      />
    </div>
  );
}
