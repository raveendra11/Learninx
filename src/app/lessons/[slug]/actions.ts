'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import type { QuizAnswerResult } from '@/lib/types';

export async function markLessonCompleteAction(lessonId: string): Promise<void> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error('UNAUTHENTICATED');
  }

  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId: user.id, lessonId } },
    update: { completed: true },
    create: { userId: user.id, lessonId, completed: true },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { points: { increment: 10 } },
  });

  revalidatePath('/lessons');
  revalidatePath('/dashboard');
}

export async function submitChallengeAction(
  lessonId: string,
  lessonSlug: string,
  command: string,
): Promise<{ ok: boolean; message: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: 'Please log in to submit.' };

  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson?.solution) {
    return { ok: false, message: 'This lesson has no challenge.' };
  }

  const normalize = (s: string) =>
    s.replace(/\s+/g, ' ').trim().toLowerCase().replace(/;$/, '');

  const expected = normalize(lesson.solution);
  const accepted = expected.split('||').map((p) => p.trim());

  if (accepted.includes(normalize(command))) {
    await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId: user.id, lessonId } },
      update: { completed: true },
      create: { userId: user.id, lessonId, completed: true },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { points: { increment: 25 } },
    });

    revalidatePath(`/lessons/${lessonSlug}`);
    revalidatePath('/dashboard');
    return { ok: true, message: '🎉 Correct! +25 points' };
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
}> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error('UNAUTHENTICATED');
  }
  const parsed = submitQuizSchema.parse(input);

  const questions = await prisma.quizQuestion.findMany({
    where: { lessonId: parsed.lessonId },
    orderBy: { order: 'asc' },
  });

  const normalize = (s: string) =>
    s.replace(/\s+/g, ' ').trim().toLowerCase().replace(/[.;!?]$/g, '');

  let correct = 0;
  const results: QuizAnswerResult[] = questions.map((q) => {
    const given = parsed.answers.find((a) => a.questionId === q.id)?.answer ?? '';
    const isCorrect = normalize(given) === normalize(q.answer);
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
  const score = total === 0 ? 0 : Math.round((correct / total) * 100);
  const pointsEarned = correct * 5;

  await prisma.quizAttempt.create({
    data: {
      userId: user.id,
      lessonId: parsed.lessonId,
      score,
      correct,
      total,
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { points: { increment: pointsEarned } },
  });

  if (score >= 80) {
    await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId: user.id, lessonId: parsed.lessonId } },
      update: { completed: true },
      create: { userId: user.id, lessonId: parsed.lessonId, completed: true },
    });
  }

  revalidatePath('/dashboard');

  return { results, correct, total, score };
}
