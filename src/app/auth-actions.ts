'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  createSessionCookie,
  destroySession,
  hashPassword,
  verifyPassword,
} from '@/lib/auth';
import { prisma } from '@/lib/db';

const credentialsSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(80).optional(),
});

export async function signupAction(formData: FormData): Promise<void> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    name: formData.get('name') || undefined,
  });

  if (!parsed.success) {
    redirect('/signup?error=invalid');
  }

  const { email, password, name } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    redirect('/signup?error=taken');
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, name, passwordHash },
  });

  await createSessionCookie(user.id);
  redirect('/dashboard');
}

export async function loginAction(formData: FormData): Promise<void> {
  const parsed = credentialsSchema
    .pick({ email: true, password: true })
    .safeParse({
      email: formData.get('email'),
      password: formData.get('password'),
    });

  if (!parsed.success) {
    redirect('/login?error=invalid');
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    redirect('/login?error=invalid');
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    redirect('/login?error=invalid');
  }

  await createSessionCookie(user.id);
  redirect('/dashboard');
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect('/');
}
