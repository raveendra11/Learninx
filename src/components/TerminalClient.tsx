'use client';

import dynamic from 'next/dynamic';

// Lazy-load the xterm-based Terminal with SSR disabled.
// xterm touches `self` at module-load time, so it cannot be imported
// from a server component (the lesson page).
const Terminal = dynamic(() => import('./Terminal').then((m) => m.Terminal), {
  ssr: false,
  loading: () => (
    <div className="rounded-xl overflow-hidden border border-slate-800 bg-terminal-bg h-full flex items-center justify-center text-slate-500 text-sm">
      Loading sandbox…
    </div>
  ),
});

export function TerminalClient(
  props: React.ComponentProps<typeof Terminal>,
) {
  return <Terminal {...props} />;
}
