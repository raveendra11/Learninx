'use client';

import { useState } from 'react';
import { submitChallengeAction } from '@/app/lessons/[slug]/actions';

export function ChallengeRunner({
  lessonId,
  lessonSlug,
  initiallyCompleted,
}: {
  lessonId: string;
  lessonSlug: string;
  initiallyCompleted: boolean;
}) {
  const [command, setCommand] = useState('');
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(
    null,
  );
  const [completed, setCompleted] = useState(initiallyCompleted);
  const [submitting, setSubmitting] = useState(false);

  async function submit(): Promise<void> {
    if (!command.trim()) return;
    setSubmitting(true);
    try {
      const result = await submitChallengeAction(lessonId, lessonSlug, command);
      setStatus(result);
      if (result.ok) setCompleted(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <span className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-terminal-accent font-mono">
          $
        </span>
        <input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          placeholder="type the solution command…"
          className="flex-1 bg-slate-950 border border-slate-700 rounded-md px-3 py-2 font-mono text-slate-100 focus:border-terminal-accent focus:outline-none"
        />
        <button
          onClick={submit}
          disabled={submitting || completed}
          className="bg-terminal-accent text-slate-900 px-4 py-2 rounded-md font-semibold disabled:opacity-50 hover:bg-emerald-300"
        >
          {submitting ? 'Checking…' : 'Check'}
        </button>
      </div>
      {status && (
        <p
          className={`text-sm ${
            status.ok ? 'text-emerald-300' : 'text-amber-300'
          }`}
        >
          {status.message}
        </p>
      )}
      {completed && (
        <p className="text-xs text-emerald-400">
          ✓ Lesson marked complete — points awarded.
        </p>
      )}
    </div>
  );
}
