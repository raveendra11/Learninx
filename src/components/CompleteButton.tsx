'use client';

import { useState } from 'react';
import { markLessonCompleteAction } from '@/app/lessons/[slug]/actions';

export function CompleteButton({ lessonId }: { lessonId: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  return (
    <button
      onClick={async () => {
        setSubmitting(true);
        try {
          await markLessonCompleteAction(lessonId);
          setDone(true);
        } finally {
          setSubmitting(false);
        }
      }}
      disabled={submitting || done}
      className="bg-slate-800 hover:bg-slate-700 text-slate-100 px-4 py-2 rounded-md disabled:opacity-50"
    >
      {done ? '✓ Marked complete' : submitting ? 'Saving…' : 'Mark complete (+10 pts)'}
    </button>
  );
}
