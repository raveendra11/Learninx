'use client';

import { logoutAction } from '@/app/auth-actions';

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="text-sm text-slate-400 hover:text-terminal-accent"
      >
        Log out
      </button>
    </form>
  );
}
