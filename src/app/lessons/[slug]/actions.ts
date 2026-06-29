'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getVisitorId } from '@/lib/visitor';
import { prisma } from '@/lib/db';
import type { QuizAnswerResult } from '@/lib/types';

export async function markLessonCompleteAction(lessonId: string): Promise<void> {
  const visitorId = getVisitorId();
  await prisma.lessonProgress.upsert({
    where: { visitorId_lessonId: { visitorId, lessonId } },
    update: { completed: true },
    create: { visitorId, lessonId, completed: true },
  });
  revalidatePath('/lessons');
  revalidatePath('/');
}

export async function submitChallengeAction(
  lessonId: string,
  lessonSlug: string,
  command: string,
): Promise<{ ok: boolean; message: string }> {
  const visitorId = getVisitorId();

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
      where: { visitorId_lessonId: { visitorId, lessonId } },
      update: { completed: true },
      create: { visitorId, lessonId, completed: true },
    });
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
}> {
  const visitorId = getVisitorId();
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

  await prisma.quizAttempt.create({
    data: {
      visitorId,
      lessonId: parsed.lessonId,
      score,
      correct,
      total,
    },
  });

  if (score >= 80) {
    await prisma.lessonProgress.upsert({
      where: { visitorId_lessonId: { visitorId, lessonId: parsed.lessonId } },
      update: { completed: true },
      create: {
        visitorId,
        lessonId: parsed.lessonId,
        completed: true,
      },
    });
  }

  revalidatePath('/lessons');
  revalidatePath('/');

  return { results, correct, total, score };
}
