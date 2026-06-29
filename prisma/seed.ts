import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { LESSONS, QUIZ_QUESTIONS } from '../src/lib/lessons';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding lessons...');

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

    // Replace quiz questions for this lesson.
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

  // Optional demo learner account.
  const email = 'demo@learninx.dev';
  const passwordHash = await bcrypt.hash('demo1234', 10);

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: 'Demo Learner', passwordHash, points: 50 },
  });

  console.log('✅ Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
