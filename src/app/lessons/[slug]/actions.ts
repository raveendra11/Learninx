'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  getLessonBySlug,
  getQuestionsForLesson,
} from '@/lib/lessons';
import {
  markLessonComplete,
  recordQuizScore,
  type ProgressState,
  type QuizScore,
} from '@/lib/progress';
import type { QuizAnswerResult } from '@/lib/types';

const PASS_THRESHOLD = 80;

function normalizeAnswer(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase().replace(/[.;!?]$/g, '');
}

function normalizeCommand(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase().replace(/;$/, '');
}

export async function markLessonCompleteAction(lessonId: string): Promise<void> {
  markLessonComplete(lessonId);
  revalidatePath('/lessons');
  revalidatePath('/');
}

export async function submitChallengeAction(
  lessonId: string,
  lessonSlug: string,
  command: string,
): Promise<{ ok: boolean; message: string }> {
  const lesson = getLessonBySlug(lessonSlug);
  if (!lesson) {
    return { ok: false, message: 'This lesson does not exist.' };
  }
  if (!lesson.solution) {
    return { ok: false, message: 'This lesson has no challenge.' };
  }

  const expected = normalizeCommand(lesson.solution);
  const accepted = expected.split('||').map((p) => p.trim());

  if (accepted.includes(normalizeCommand(command))) {
    markLessonComplete(lesson.id);
    revalidatePath(`/lessons/${lessonSlug}`);
    revalidatePath('/lessons');
    revalidatePath('/');
    return { ok: true, message: '🎉 Correct!' };
  }

  return { ok: false, message: 'Not quite — try again.' };
}

const submitQuizSchema = z.object({
  lessonId: z.string().min(1),
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      answer: z.string().max(500),
    }),
  ),
});

export async function submitQuizAction(input: {
  lessonId: string;
  answers: { questionId: string; answer: string }[];
}): Promise<{
  results: QuizAnswerResult[];
  correct: number;
  total: number;
  score: number;
  progress: ProgressState;
}> {
  const parsed = submitQuizSchema.parse(input);

  const questions = getQuestionsForLesson(parsed.lessonId);
  if (questions.length === 0) {
    return {
      results: [],
      correct: 0,
      total: 0,
      score: 0,
      progress: markLessonComplete(parsed.lessonId), // no quiz = auto-pass
    };
  }

  let correct = 0;
  const results: QuizAnswerResult[] = questions.map((q) => {
    const given =
      parsed.answers.find((a) => a.questionId === q.id)?.answer ?? '';
    const isCorrect = normalizeAnswer(given) === normalizeAnswer(q.answer);
    if (isCorrect) correct += 1;
    return {
      questionId: q.id,
      prompt: q.prompt,
      given,
      expected: q.answer,
      correct: isCorrect,
    };
  });

  const total = questions.length;
  const score = Math.round((correct / total) * 100);
  const quizScore: QuizScore = { score, correct, total, at: Date.now() };

  // Persist the latest score, then conditionally mark the lesson complete.
  let progress = recordQuizScore(parsed.lessonId, quizScore);
  if (score >= PASS_THRESHOLD) {
    progress = markLessonComplete(parsed.lessonId);
  }

  revalidatePath('/lessons');
  revalidatePath('/');
  revalidatePath(`/lessons/${parsed.lessonId}`);

  return { results, correct, total, score, progress };
}
