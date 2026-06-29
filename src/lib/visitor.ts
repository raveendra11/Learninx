import 'server-only';
import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';

/**
 * Returns the current browser's anonymous visitor id.
 *
 * The cookie is set by `src/middleware.ts` on every request that reaches the
 * app, so by the time any Server Component or Server Action runs, this id is
 * already present. We never *write* the cookie from here because the cookies()
 * store is read-only in static-rendering contexts.
 *
 * If the cookie is somehow missing (e.g. middleware didn't run for an
 * internal Next request), we synthesise an ephemeral id for that render —
 * the next real request will receive a real one and the data layer will
 * associate that visit's writes with it.
 */
export function getVisitorId(): string {
  const existing = cookies().get('learninx_visitor')?.value;
  if (existing && existing.startsWith('v_')) {
    return existing;
  }
  return 'v_' + randomBytes(12).toString('hex');
}
