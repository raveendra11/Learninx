/**
 * Per-visitor progress store.
 *
 * The previous version of this project wrote lesson completions and quiz
 * scores to a SQLite database keyed off an anonymous `visitorId` cookie.
 * This module replaces the database with a **signed cookie** that holds the
 * same data inline. That keeps the app stateless server-side (no DB, no
 * volume mount, no migrations) while still giving each browser a persistent
 * "profile" that survives reloads.
 *
 * Cookie name: `learninx_progress`
 * Encoding:    base64url(JSON payload) + "." + base64url(HMAC-SHA256)
 *
 * The cookie is small (a few hundred bytes even for every lesson) because
 * it only stores:
 *   - completed lesson ids
 *   - last quiz score per lesson
 */

import 'server-only';
import { cookies } from 'next/headers';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'learninx_progress';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export interface QuizScore {
  score: number;
  correct: number;
  total: number;
  /** Epoch ms. */
  at: number;
}

export interface ProgressState {
  v: 1;
  /** Set of lesson ids the visitor has completed. */
  completed: string[];
  /** Latest quiz score per lesson id. */
  quiz: Record<string, QuizScore>;
}

const EMPTY: ProgressState = { v: 1, completed: [], quiz: {} };

// ─────────────────────────────────────────────── signing key ──

function getSecret(): string {
  // We need *some* stable per-process key. In production this should be
  // injected as `LEARNINX_SECRET` so cookies are still valid across deploys
  // / restarts. In dev we synthesise a per-process key (which means cookies
  // reset on every dev-server boot — that's fine for a learning app).
  const fromEnv = process.env.LEARNINX_SECRET;
  if (fromEnv && fromEnv.length >= 16) return fromEnv;
  // Fallback: derive a stable key from a runtime random if no env is set.
  // We attach it to globalThis so all calls in the same process agree.
  const g = globalThis as unknown as { __learninxSecret?: string };
  if (!g.__learninxSecret) {
    g.__learninxSecret = 'dev-' + randomBytes(24).toString('hex');
  }
  return g.__learninxSecret;
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

function safeEqualB64(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function encode(state: ProgressState): string {
  const json = JSON.stringify(state);
  const body = Buffer.from(json, 'utf8').toString('base64url');
  const sig = sign(body);
  return `${body}.${sig}`;
}

function decode(raw: string | undefined): ProgressState {
  if (!raw) return { ...EMPTY, completed: [], quiz: {} };
  const idx = raw.indexOf('.');
  if (idx <= 0) return { ...EMPTY, completed: [], quiz: {} };
  const body = raw.slice(0, idx);
  const sig = raw.slice(idx + 1);
  if (!safeEqualB64(sign(body), sig)) {
    // Tampered or signed with a different secret — start fresh.
    return { ...EMPTY, completed: [], quiz: {} };
  }
  try {
    const json = Buffer.from(body, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as Partial<ProgressState>;
    return {
      v: 1,
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
      quiz:
        parsed.quiz && typeof parsed.quiz === 'object' ? parsed.quiz : {},
    };
  } catch {
    return { ...EMPTY, completed: [], quiz: {} };
  }
}

// ─────────────────────────────────────────────── public API ──

/** Read the visitor's current progress. Always returns a valid state. */
export function getProgress(): ProgressState {
  return decode(cookies().get(COOKIE_NAME)?.value);
}

/** Persist the visitor's progress via a Set-Cookie header. */
function writeProgress(state: ProgressState): void {
  cookies().set(COOKIE_NAME, encode(state), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
}

/** Mark a lesson as completed (idempotent). */
export function markLessonComplete(lessonId: string): ProgressState {
  const state = getProgress();
  if (!state.completed.includes(lessonId)) {
    state.completed.push(lessonId);
  }
  writeProgress(state);
  return state;
}

/** Record the latest quiz score for a lesson. Does not change completion. */
export function recordQuizScore(lessonId: string, score: QuizScore): ProgressState {
  const state = getProgress();
  state.quiz[lessonId] = score;
  writeProgress(state);
  return state;
}

/** True if the visitor has marked this lesson complete. */
export function isLessonCompleted(lessonId: string): boolean {
  return getProgress().completed.includes(lessonId);
}

/** Set of completed lesson ids — convenient for the index page. */
export function getCompletedLessonIds(): Set<string> {
  return new Set(getProgress().completed);
}

/** Test helpers — currently unused at runtime, exported for completeness. */
export const __progressInternals = { encode, decode, getSecret };
