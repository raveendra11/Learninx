'use client';

import { useState } from 'react';
import { submitQuizAction } from '@/app/lessons/[slug]/actions';
import type { QuizAnswerResult } from '@/lib/types';

interface Question {
  id: string;
  prompt: string;
}

export function LessonQuiz({
  lessonId,
  questions,
}: {
  lessonId: string;
  questions: Question[];
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    correct: number;
    total: number;
    score: number;
    results: QuizAnswerResult[];
  } | null>(null);

  async function submit(): Promise<void> {
    setSubmitting(true);
    try {
      const payload = {
        lessonId,
        answers: questions.map((q) => ({
          questionId: q.id,
          answer: answers[q.id] ?? '',
        })),
      };
      const r = await submitQuizAction(payload);
      setResult(r);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <ol className="space-y-4 list-decimal pl-5">
        {questions.map((q) => {
          const r = result?.results.find((rr) => rr.questionId === q.id);
          return (
            <li key={q.id}>
              <p className="text-slate-200 mb-1">{q.prompt}</p>
              <input
                value={answers[q.id] ?? ''}
                onChange={(e) =>
                  setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 font-mono focus:border-terminal-accent focus:outline-none"
                placeholder="your answer…"
              />
              {r && (
                <p
                  className={`text-xs mt-1 ${
                    r.correct ? 'text-emerald-300' : 'text-red-300'
                  }`}
                >
                  {r.correct
                    ? '✓ Correct'
                    : `✗ Correct answer: ${r.expected}`}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <button
        onClick={submit}
        disabled={submitting}
        className="bg-terminal-accent text-slate-900 px-4 py-2 rounded-md font-semibold disabled:opacity-50 hover:bg-emerald-300"
      >
        {submitting ? 'Grading…' : 'Submit quiz'}
      </button>

      {result && (
        <div className="p-3 rounded-md bg-slate-950 border border-slate-700 text-sm">
          Score: <strong>{result.score}%</strong> ({result.correct}/
          {result.total}){result.score >= 80 && ' — lesson complete 🎉'}
        </div>
      )}
    </div>
  );
}
