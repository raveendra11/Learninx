/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Plain-CommonJS seed script.
 *
 * Runs in two places:
 *   - local dev: `npm run db:seed`
 *   - Docker container start: `node prisma/seed.cjs`
 *
 * No tsx, esbuild, or other dev-only tooling required at runtime.
 */

const { PrismaClient } = require('@prisma/client');
const { LESSONS, QUIZ_QUESTIONS } = require('./lessons.data.cjs');

const prisma = new PrismaClient();

(async () => {
  console.log('[seed] applying lesson catalogue...');

  for (const lesson of LESSONS) {
    const stored = await prisma.lesson.upsert({
      where: { slug: lesson.slug },
      update: {
        title: lesson.title,
        description: lesson.description,
        difficulty: lesson.difficulty,
        order: lesson.order,
        content: lesson.content,
        trackCommand: lesson.trackCommand,
        challenge: lesson.challenge,
        solution: lesson.solution,
      },
      create: {
        slug: lesson.slug,
        title: lesson.title,
        description: lesson.description,
        difficulty: lesson.difficulty,
        order: lesson.order,
        content: lesson.content,
        trackCommand: lesson.trackCommand,
        challenge: lesson.challenge,
        solution: lesson.solution,
      },
    });

    await prisma.quizQuestion.deleteMany({ where: { lessonId: stored.id } });

    const qb = QUIZ_QUESTIONS.find((q) => q.lessonSlug === lesson.slug);
    if (qb) {
      for (let i = 0; i < qb.questions.length; i += 1) {
        const q = qb.questions[i];
        await prisma.quizQuestion.create({
          data: {
            lessonId: stored.id,
            prompt: q.prompt,
            answer: q.answer.toLowerCase().trim(),
            order: i,
          },
        });
      }
    }
  }

  console.log('[seed] done.');
  await prisma.$disconnect();
})().catch(async (err) => {
  console.error('[seed] failed:', err);
  try {
    await new PrismaClient().$disconnect();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
