'use client';

import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { createInitialFs, type FsDir } from '@/lib/shell/fs';
import { runCommand, type ShellContext } from '@/lib/shell/evaluator';

const HOST = 'learninx';
const USER = 'learner';
const HOME = '/home/learner';

interface Suggestion {
  command: string;
  expected: string;
}

export function Terminal({
  suggestion,
  className = '',
  onRunExpected,
}: {
  /** A command the user should be encouraged to try (shown as a hint). */
  suggestion?: Suggestion;
  className?: string;
  onRunExpected?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const bufferRef = useRef('');
  const historyRef = useRef<string[]>([]);
  const histIndexRef = useRef<number>(0);
  const ctxRef = useRef<ShellContext | null>(null);

  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const fs: FsDir = createInitialFs();
    const ctx: ShellContext = {
      cwd: HOME,
      fs,
      user: USER,
      host: HOST,
      history: [],
      env: { PATH: '/usr/bin:/bin', HOME, USER, SHELL: '/bin/bash' },
    };
    ctxRef.current = ctx;

    const term = new XTerm({
      fontFamily: '"JetBrains Mono", Menlo, monospace',
      fontSize: 14,
      theme: {
        background: '#0b0f12',
        foreground: '#d6deeb',
        cursor: '#7fdbca',
      },
      cursorBlink: true,
      convertEol: true,
      allowProposedApi: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    setTimeout(() => fit.fit(), 0);

    xtermRef.current = term;
    fitRef.current = fit;

    const handleResize = () => {
      try {
        fit.fit();
      } catch {
        // ignore
      }
    };
    window.addEventListener('resize', handleResize);
    const ro = new ResizeObserver(handleResize);
    ro.observe(containerRef.current);

    const greet = [
      `\x1b[36mLearninx Sandbox v0.1\x1b[0m`,
      `Try commands like \x1b[33mpwd\x1b[0m, \x1b[33mls\x1b[0m, \x1b[33mcd\x1b[0m, \x1b[33mmkdir\x1b[0m, \x1b[33mcat\x1b[0m.`,
      `Type \x1b[33mhelp\x1b[0m for the full list.`,
      ``,
    ].join('\r\n');
    term.write(greet);

    writePrompt();

    function writePrompt(): void {
      const c = ctxRef.current!;
      const path = c.cwd === '/home/learner' ? '~' : c.cwd;
      term.write(`\r\n\x1b[32m${USER}@${HOST}\x1b[0m:\x1b[34m${path}\x1b[0m$ `);
    }

    function clearLine(): void {
      const len = bufferRef.current.length;
      // Move cursor to end, clear the whole line
      term.write('\r\x1b[2K');
      // Re-write prompt + buffer
      const c = ctxRef.current!;
      const path = c.cwd === '/home/learner' ? '~' : c.cwd;
      term.write(`\x1b[32m${USER}@${HOST}\x1b[0m:\x1b[34m${path}\x1b[0m$ ${bufferRef.current}`);
      void len;
    }

    function submit(line: string): void {
      term.write('\r\n');
      const out = runCommand(line, ctxRef.current!);
      bufferRef.current = '';
      histIndexRef.current = historyRef.current.length;

      if (Array.isArray(out)) {
        for (const part of out) {
          term.write(part.replace(/\n/g, '\r\n') + '\r\n');
        }
      } else if (out === '__CLEAR__') {
        term.clear();
      } else if (out) {
        term.write(out.replace(/\n/g, '\r\n') + '\r\n');
      }

      // Notify parent if the user ran the expected suggestion
      if (suggestion && onRunExpected) {
        const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase().replace(/;$/, '');
        const expected = suggestion.expected;
        const accepted = expected.split('||').map((p) => norm(p.trim()));
        const ran = norm(line);
        if (accepted.includes(ran) && !completed) {
          setCompleted(true);
          onRunExpected();
        }
      }

      writePrompt();
    }

    term.onKey(({ key, domEvent }) => {
      const ev = domEvent;
      const code = ev.keyCode;

      if (code === 13) {
        // Enter
        const line = bufferRef.current;
        if (line.trim()) {
          historyRef.current.push(line);
          histIndexRef.current = historyRef.current.length;
        }
        submit(line);
        return;
      }

      if (code === 8) {
        // Backspace
        if (bufferRef.current.length > 0) {
          bufferRef.current = bufferRef.current.slice(0, -1);
          term.write('\b \b');
        }
        return;
      }

      if (code === 38) {
        // ArrowUp — history back
        if (historyRef.current.length === 0) return;
        histIndexRef.current = Math.max(0, histIndexRef.current - 1);
        bufferRef.current = historyRef.current[histIndexRef.current] ?? '';
        clearLine();
        return;
      }

      if (code === 40) {
        // ArrowDown
        if (historyRef.current.length === 0) return;
        histIndexRef.current = Math.min(
          historyRef.current.length,
          histIndexRef.current + 1,
        );
        bufferRef.current = historyRef.current[histIndexRef.current] ?? '';
        clearLine();
        return;
      }

      if (code === 9) {
        // Tab — simple autocomplete (first match against command names)
        ev.preventDefault?.();
        return;
      }

      if (code === 67 && ev.ctrlKey) {
        // Ctrl+C — abandon current line
        term.write('^C');
        bufferRef.current = '';
        writePrompt();
        return;
      }

      if (code === 76 && ev.ctrlKey) {
        // Ctrl+L — clear
        term.clear();
        writePrompt();
        return;
      }

      if (key.length === 1 && !ev.ctrlKey && !ev.altKey && !ev.metaKey) {
        bufferRef.current += key;
        term.write(key);
      }
    });

    term.onSelectionChange(() => {
      // no-op
    });

    // Expose a tiny programmatic API for the "Run" button.
    (term as unknown as { __run?: (line: string) => void }).__run = (line: string) => {
      term.write(line);
      submit(line);
    };

    return () => {
      window.removeEventListener('resize', handleResize);
      ro.disconnect();
      term.dispose();
      xtermRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function runSuggestion(): void {
    const term = xtermRef.current as unknown as { __run?: (line: string) => void } | null;
    if (term?.__run && suggestion) {
      term.__run(suggestion.command);
    }
  }

  return (
    <div className={`rounded-xl overflow-hidden border border-slate-800 bg-terminal-bg ${className}`}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900/70 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500/80" />
          <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <span className="w-3 h-3 rounded-full bg-green-500/80" />
          <span className="ml-3 text-slate-400 font-mono">learner@learninx:~</span>
        </div>
        {suggestion && (
          <button
            onClick={runSuggestion}
            className="px-3 py-1 rounded bg-emerald-900/40 text-emerald-300 hover:bg-emerald-900/70 border border-emerald-800"
          >
            Run hint: <code className="font-mono">{suggestion.command}</code>
          </button>
        )}
      </div>
      <div ref={containerRef} style={{ minHeight: 320, padding: 8 }} />
    </div>
  );
}
