// Learninx shell evaluator — a small in-browser teaching sandbox.
//
// Adds many common Linux commands and supports `;`, `&&`, `||` chains
// as well as `|` pipes between commands. Commands accept piped stdin
// via a `__STDIN__:<text>` placeholder arg that the runStatement layer
// injects when the previous command produced output.

import type { FsDir, FsNode } from './fs';

export interface ShellContext {
  cwd: string;
  fs: FsNode;
  user: string;
  host: string;
  history: string[];
  env: Record<string, string>;
  /** Latest piped stdin from the previous stage of a pipeline. */
  __lastStdin?: string;
}

export interface CommandSpec {
  name: string;
  summary: string;
  run: (args: string[], ctx: ShellContext) => string | string[] | null;
}

// ───────────────────────────────────────────────────────── helpers ──

function joinPath(cwd: string, target: string): string {
  if (!target) return cwd;
  if (target.startsWith('/')) return normalize(target);
  if (target.startsWith('~')) {
    return normalize(target.replace(/^~/, '/home/learner'));
  }
  return normalize(`${cwd}/${target}`);
}

function normalize(p: string): string {
  const parts = p.split('/').filter(Boolean);
  const stack: string[] = [];
  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') {
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  return '/' + stack.join('/');
}

function resolveNode(ctx: ShellContext, path: string): FsNode | null {
  const abs = joinPath(ctx.cwd, path);
  const parts = abs.split('/').filter(Boolean);
  let node: FsNode | undefined = ctx.fs;
  for (const part of parts) {
    if (!node || node.type !== 'dir') return null;
    node = node.children[part];
  }
  return node ?? null;
}

function resolveParent(
  ctx: ShellContext,
  path: string,
): { parent: FsDir; name: string } | null {
  const abs = joinPath(ctx.cwd, path);
  const parts = abs.split('/').filter(Boolean);
  const name = parts.pop();
  if (!name) return null;
  let node: FsNode | undefined = ctx.fs;
  for (const part of parts) {
    if (!node || node.type !== 'dir') return null;
    node = node.children[part];
  }
  return node && node.type === 'dir' ? { parent: node, name } : null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function globToRegex(glob: string): RegExp {
  let re = '^';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') re += '.*';
    else if (c === '?') re += '.';
    else if (c === '.') re += '\\.';
    else re += escapeRegex(c);
  }
  return new RegExp(re + '$');
}

function globMatch(glob: string, name: string): boolean {
  return globToRegex(glob).test(name);
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}

// Shared body for the simulated `nano` / `vi` / `vim` / `pico` / `emacs`
// (and pager `less` / `more`) commands. These are *not* real TUIs — the
// in-browser xterm is line-buffered and cannot host one — so instead we
// print a TUI-styled view of the file plus a footer that tells the learner
// which sandbox commands to use to actually edit the file.
function editorStub(
  editor: 'nano' | 'vi' | 'vim' | 'pico' | 'emacs' | 'less' | 'more',
  args: string[],
  ctx: ShellContext,
): string {
  const targets = args.filter((a) => !a.startsWith('-'));
  if (targets.length === 0) return `${editor}: missing file operand`;
  const out: string[] = [];
  for (const target of targets) {
    const node = resolveNode(ctx, target);
    if (!node) {
      out.push(`${editor}: ${target}: No such file or directory`);
      continue;
    }
    if (node.type === 'dir') {
      out.push(`${editor}: ${target}: Is a directory`);
      continue;
    }
    const abs = joinPath(ctx.cwd, target);
    const content = node.content;
    const lines = content === '' ? [''] : content.split('\n');
    const width = 40;
    const title = `  GNU Learninx ${editor}  `;
    const titleBar = `┌${'─'.repeat(width - 2)}┐`;
    const headerLine = `│${title.padEnd(width - 2, ' ')}│`;
    const footer = `└${'─'.repeat(width - 2)}┘`;

    out.push('');
    out.push(titleBar);
    out.push(headerLine);
    out.push(`│  File: ${truncate(abs, width - 11).padEnd(width - 11, ' ')}  │`);
    out.push(footer);
    out.push('');
    lines.forEach((line, i) => {
      out.push(`  ${String(i + 1).padStart(3, ' ')}  ${line}`);
    });
    out.push('');
    out.push('─'.repeat(width));
    out.push(
      `${editor}: this is a safe in-browser sandbox — real ${editor} needs a TTY.`,
    );
    out.push(
      'To edit this file here, use one of:',
    );
    out.push(`  echo "your text" > ${abs}        # overwrite`);
    out.push(`  echo "more" >> ${abs}            # append`);
    out.push(`  cat > ${abs} <<'EOF'             # multi-line (Ctrl+D to end)`);
    out.push(`  sed -i 's/old/new/' ${abs}       # in-place replace`);
    out.push(`  printf '%s\n' 'line1' 'line2' > ${abs}  # precise writes`);
    out.push('');
  }
  return out.join('\n');
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : '…' + s.slice(s.length - (max - 1));
}

function writeFile(ctx: ShellContext, path: string, content: string): boolean {
  const loc = resolveParent(ctx, path);
  if (!loc) return false;
  loc.parent.children[loc.name] = { type: 'file', content };
  return true;
}

function nodeSize(node: FsNode): number {
  if (node.type === 'file') return node.content.length;
  let total = 4096;
  for (const child of Object.values(node.children)) total += nodeSize(child);
  return total;
}

// djb2 — small non-cryptographic hash, deterministic, fast in-browser.
function djb2(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  // Return a 32-bit unsigned hex string.
  return (h >>> 0).toString(16).padStart(8, '0');
}

// FNV-1a 32-bit — used to expand the hash space for sha256sum.
function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// 64-hex-char "sha256-like" digest derived from the input.
function pseudoSha256(input: string): string {
  let s1 = djb2(input);
  let s2 = fnv1a(input);
  let s3 = djb2(input.split('').reverse().join('') + s1);
  let s4 = fnv1a(s2 + input);
  let s5 = djb2(s3 + s4);
  let s6 = fnv1a(s4 + s5);
  let s7 = djb2(s5 + s6);
  let s8 = fnv1a(s6 + s7);
  return (s1 + s2 + s3 + s4 + s5 + s6 + s7 + s8).padEnd(64, '0').slice(0, 64);
}

function pseudoMd5(input: string): string {
  // 32-hex output built from two 16-hex halves.
  return (djb2(input) + fnv1a(input) + djb2(input + 'x') + fnv1a('y' + input))
    .padEnd(32, '0')
    .slice(0, 32);
}

function readInput(arg: string, ctx: ShellContext): string | null {
  if (arg.startsWith('__STDIN__:')) return arg.slice('__STDIN__:'.length);
  const node = resolveNode(ctx, arg);
  if (!node) return null;
  if (node.type !== 'file') return null;
  return node.content;
}

function tryReadInput(
  arg: string,
  ctx: ShellContext,
): { ok: boolean; content: string } {
  if (arg.startsWith('__STDIN__:')) return { ok: true, content: arg.slice('__STDIN__:'.length) };
  const node = resolveNode(ctx, arg);
  if (!node) return { ok: false, content: '' };
  if (node.type === 'dir') return { ok: false, content: `${arg}: Is a directory` };
  return { ok: true, content: node.content };
}

// ───────────────────────────────────────────────────── command set ──

const COMMANDS: Record<string, CommandSpec> = {
  // ── navigation / info ──
  pwd: { name: 'pwd', summary: 'print working directory', run: (_a, ctx) => ctx.cwd },
  whoami: { name: 'whoami', summary: 'show current user', run: (_a, ctx) => ctx.user },
  hostname: { name: 'hostname', summary: 'show host name', run: (_a, ctx) => ctx.host },
  date: { name: 'date', summary: 'show current date', run: () => new Date().toString() },
  echo: { name: 'echo', summary: 'print arguments', run: (args) => args.join(' ') },
  clear: { name: 'clear', summary: 'clear screen', run: () => '__CLEAR__' },
  true: { name: 'true', summary: 'do nothing, successfully', run: () => null },
  false: { name: 'false', summary: 'do nothing, unsuccessfully', run: () => '__NUL__' },
  sleep: { name: 'sleep', summary: 'pause for N seconds (simulated)', run: () => null },
  yes: {
    name: 'yes',
    summary: 'print a string repeatedly',
    run: (args) =>
      Array.from({ length: 5 }, () => args[0] ?? 'y').join('\n') + '\n... (truncated)',
  },
  printf: {
    name: 'printf',
    summary: 'format and print data',
    run: (args) => {
      if (args.length === 0) return 'printf: usage: printf format [arguments]';
      const fmt = args[0];
      const subs = args.slice(1);
      let i = 0;
      return fmt.replace(/%[sd]/g, (m) => {
        if (m === '%s') return String(subs[i++] ?? '');
        if (m === '%d') return String(parseInt(subs[i++] ?? '0', 10));
        return m;
      });
    },
  },
  exit: { name: 'exit', summary: 'exit the shell (simulated)', run: () => 'logout' },
  history: {
    name: 'history',
    summary: 'show recent commands',
    run: (_a, ctx) => ctx.history.map((c, i) => `  ${String(i + 1).padStart(3)}  ${c}`).join('\n'),
  },
  export: {
    name: 'export',
    summary: 'set env variable',
    run: (args, ctx) => {
      for (const arg of args) {
        const [k, ...rest] = arg.split('=');
        if (!k || rest.length === 0) continue;
        ctx.env[k] = rest.join('=');
      }
      return null;
    },
  },
  env: {
    name: 'env',
    summary: 'print environment variables',
    run: (_a, ctx) =>
      Object.entries(ctx.env).map(([k, v]) => `${k}=${v}`).join('\n') || '(no env vars set)',
  },

  // ── file system basics ──
  ls: {
    name: 'ls',
    summary: 'list directory',
    run: (args, ctx) => {
      const long = args.includes('-l') || args.includes('-la') || args.includes('-al');
      const showAll = args.includes('-a') || args.includes('-la') || args.includes('-al');
      const target = args.find((a) => !a.startsWith('-')) ?? '.';
      const node = resolveNode(ctx, target);
      if (!node) return `ls: cannot access '${target}': No such file or directory`;
      if (node.type !== 'dir') {
        const base = target.split('/').pop() ?? target;
        return base;
      }
      const dir = node;
      const names = Object.keys(dir.children);
      const visible = showAll ? ['.', '..', ...names] : names;
      if (!long) return visible.join('  ');
      return visible
        .map((n) => {
          if (n === '.' || n === '..')
            return `drwxr-xr-x  2 ${ctx.user} ${ctx.user}  4096  ${n}/`;
          const child = dir.children[n];
          const perms = child?.type === 'dir' ? 'drwxr-xr-x' : '-rw-r--r--';
          const size = child?.type === 'dir' ? 4096 : (child?.content?.length ?? 0) || 12;
          return `${perms}  1 ${ctx.user} ${ctx.user}  ${String(size).padStart(5)}  ${n}`;
        })
        .join('\n');
    },
  },
  cd: {
    name: 'cd',
    summary: 'change directory',
    run: (args, ctx) => {
      const target = args[0] ?? '~';
      const node = resolveNode(ctx, target);
      if (!node) return `cd: no such file or directory: ${target}`;
      if (node.type !== 'dir') return `cd: not a directory: ${target}`;
      ctx.cwd = node === ctx.fs ? '/' : joinPath(ctx.cwd, target);
      if (ctx.cwd === '') ctx.cwd = '/';
      return null;
    },
  },
  mkdir: {
    name: 'mkdir',
    summary: 'make directory',
    run: (args, ctx) => {
      const makeParents = args.includes('-p');
      for (const arg of args) {
        if (arg.startsWith('-')) continue;
        const target = joinPath(ctx.cwd, arg);
        const parts = target.split('/').filter(Boolean);
        const name = parts.pop();
        if (!name) continue;
        let cursor: FsNode | undefined = ctx.fs as FsNode;
        for (const part of parts) {
          if (!cursor) break;
          if (cursor.type !== 'dir') return `mkdir: ${arg}: not a directory`;
          const child: FsNode | undefined = cursor.children[part];
          if (!child) {
            if (!makeParents) return `mkdir: ${arg}: No such file or directory`;
            const newDir: FsDir = { type: 'dir', children: {} };
            cursor.children[part] = newDir;
            cursor = newDir;
          } else {
            cursor = child;
          }
        }
        if (!cursor) return `mkdir: cannot create '${arg}'`;
        if (cursor.type !== 'dir') return `mkdir: ${arg}: not a directory`;
        if (cursor.children[name]) return `mkdir: cannot create '${arg}': File exists`;
        cursor.children[name] = { type: 'dir', children: {} };
      }
      return null;
    },
  },
  touch: {
    name: 'touch',
    summary: 'create or update file',
    run: (args, ctx) => {
      for (const arg of args) {
        if (arg.startsWith('-')) continue;
        const target = joinPath(ctx.cwd, arg);
        const parts = target.split('/').filter(Boolean);
        const name = parts.pop();
        if (!name) continue;
        let cursor: FsNode | undefined = ctx.fs as FsNode;
        for (const part of parts) {
          if (!cursor || cursor.type !== 'dir') break;
          const next: FsNode | undefined = cursor.children[part];
          cursor = next;
        }
        if (!cursor || cursor.type !== 'dir') {
          return `touch: cannot touch '${arg}': No such file or directory`;
        }
        if (!cursor.children[name]) {
          cursor.children[name] = { type: 'file', content: '' };
        }
      }
      return null;
    },
  },
  cat: {
    name: 'cat',
    summary: 'print file contents',
    run: (args, ctx) => {
      if (args.length === 0) return 'cat: missing file operand';
      const out: string[] = [];
      for (const arg of args) {
        const text = readInput(arg, ctx);
        if (text !== null) out.push(text);
        else {
          const node = resolveNode(ctx, arg);
          if (node?.type === 'dir') out.push(`cat: ${arg}: Is a directory`);
          else out.push(`cat: ${arg}: No such file or directory`);
        }
      }
      return out.join('\n');
    },
  },
  // The Learninx sandbox is a line-buffered in-browser REPL, not a real TTY.
  // It cannot host full-screen editors like nano or vi. These commands
  // acknowledge that, dump the file with a friendly TUI-styled header, and
  // point the learner to the editing commands that actually work here.
  nano: {
    name: 'nano',
    summary: 'simulated editor — prints the file and suggests editing commands',
    run: (args, ctx) => editorStub('nano', args, ctx),
  },
  vi: {
    name: 'vi',
    summary: 'simulated editor — prints the file and suggests editing commands',
    run: (args, ctx) => editorStub('vi', args, ctx),
  },
  vim: {
    name: 'vim',
    summary: 'simulated editor — prints the file and suggests editing commands',
    run: (args, ctx) => editorStub('vim', args, ctx),
  },
  pico: {
    name: 'pico',
    summary: 'simulated editor — prints the file and suggests editing commands',
    run: (args, ctx) => editorStub('pico', args, ctx),
  },
  emacs: {
    name: 'emacs',
    summary: 'simulated editor — prints the file and suggests editing commands',
    run: (args, ctx) => editorStub('emacs', args, ctx),
  },
  less: {
    name: 'less',
    summary: 'simulated pager — prints the file (use ↑/↓ in xterm to scroll)',
    run: (args, ctx) => editorStub('less', args, ctx),
  },
  more: {
    name: 'more',
    summary: 'simulated pager — prints the file (use ↑/↓ in xterm to scroll)',
    run: (args, ctx) => editorStub('more', args, ctx),
  },
  rm: {
    name: 'rm',
    summary: 'remove file or directory',
    run: (args, ctx) => {
      const recursive = args.includes('-r') || args.includes('-rf') || args.includes('-fr');
      const force = args.includes('-f') || args.includes('-rf') || args.includes('-fr');
      for (const arg of args) {
        if (arg.startsWith('-')) continue;
        const loc = resolveParent(ctx, arg);
        if (!loc) {
          if (!force) return `rm: cannot remove '${arg}': No such file or directory`;
          continue;
        }
        if (!loc.parent.children[arg]) continue;
        const target = loc.parent.children[arg];
        if (target.type === 'dir' && !recursive) {
          return `rm: cannot remove '${arg}': Is a directory`;
        }
        delete loc.parent.children[arg];
      }
      return null;
    },
  },
  mv: {
    name: 'mv',
    summary: 'move / rename',
    run: (args, ctx) => {
      if (args.length < 2) return 'mv: missing destination';
      const [from, to] = args;
      const src = resolveParent(ctx, from);
      if (!src) return `mv: cannot stat '${from}': No such file or directory`;
      const dest = resolveParent(ctx, to);
      if (!dest) return `mv: cannot move to '${to}': No such directory`;
      const node = src.parent.children[src.name];
      if (!node) return `mv: cannot stat '${from}'`;
      const existing = resolveNode(ctx, to);
      if (existing && existing.type === 'dir') {
        existing.children[src.name] = node;
      } else {
        dest.parent.children[dest.name] = node;
      }
      delete src.parent.children[src.name];
      return null;
    },
  },
  cp: {
    name: 'cp',
    summary: 'copy file',
    run: (args, ctx) => {
      if (args.length < 2) return 'cp: missing destination';
      const [from, to] = args;
      const src = resolveNode(ctx, from);
      if (!src) return `cp: cannot stat '${from}': No such file or directory`;
      const dest = resolveParent(ctx, to);
      if (!dest) return `cp: cannot create '${to}'`;
      const clone: FsNode = JSON.parse(JSON.stringify(src));
      const existing = resolveNode(ctx, to);
      if (existing && existing.type === 'dir') {
        existing.children[from.split('/').pop()!] = clone;
      } else {
        dest.parent.children[dest.name] = clone;
      }
      return null;
    },
  },
  rmdir: {
    name: 'rmdir',
    summary: 'remove empty directories',
    run: (args, ctx) => {
      if (args.length === 0) return 'rmdir: missing operand';
      let lastErr: string | null = null;
      for (const arg of args) {
        if (arg.startsWith('-')) continue;
        const loc = resolveParent(ctx, arg);
        if (!loc) {
          lastErr = `rmdir: failed to remove '${arg}': No such file or directory`;
          continue;
        }
        const target = loc.parent.children[loc.name];
        if (!target) {
          lastErr = `rmdir: failed to remove '${arg}': No such file or directory`;
          continue;
        }
        if (target.type !== 'dir') {
          lastErr = `rmdir: failed to remove '${arg}': Not a directory`;
          continue;
        }
        if (Object.keys(target.children).length > 0) {
          lastErr = `rmdir: failed to remove '${arg}': Directory not empty`;
          continue;
        }
        delete loc.parent.children[loc.name];
      }
      return lastErr;
    },
  },
  install: {
    name: 'install',
    summary: 'copy file to a destination, creating intermediate dirs (-D)',
    run: (args, ctx) => {
      const makeDirs = args.includes('-D');
      const positional = args.filter((a) => !a.startsWith('-'));
      if (positional.length < 2) return 'install: missing destination file operand';
      const [from, to] = positional;
      const src = resolveNode(ctx, from);
      if (!src) return `install: cannot stat '${from}': No such file or directory`;
      if (makeDirs) {
        const parts = to.split('/').filter(Boolean);
        let cursor: FsNode = ctx.fs;
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          if (cursor.type !== 'dir') return `install: '${to}': not a directory`;
          const existing = cursor.children[part];
          if (!existing) {
            const newDir: FsDir = { type: 'dir', children: {} };
            cursor.children[part] = newDir;
            cursor = newDir;
          } else {
            cursor = existing;
          }
        }
      }
      const dest = resolveParent(ctx, to);
      if (!dest) return `install: cannot create '${to}'`;
      dest.parent.children[dest.name] = JSON.parse(JSON.stringify(src));
      return null;
    },
  },
  mktemp: {
    name: 'mktemp',
    summary: 'create a temporary file (in /tmp) with optional template',
    run: (args, ctx) => {
      const template = args[0] ?? 'tmp.XXXXXXXX';
      const name = template.replace(/X+/, () =>
        Math.random().toString(36).slice(2, 2 + 8).padEnd(8, '0'),
      );
      writeFile(ctx, `/tmp/${name}`, '');
      return `/tmp/${name}`;
    },
  },
  truncate: {
    name: 'truncate',
    summary: 'shrink or extend a file to a given size (-s N)',
    run: (args, ctx) => {
      const sizeIdx = args.findIndex((a) => a === '-s');
      if (sizeIdx < 0) return 'truncate: you must specify -s <size>';
      const size = Math.max(0, parseInt(args[sizeIdx + 1] ?? '0', 10) || 0);
      const target = args.find((a, i) => !a.startsWith('-') && i !== sizeIdx);
      if (!target) return 'truncate: missing file operand';
      const loc = resolveParent(ctx, target);
      if (!loc) {
        // Create if missing.
        writeFile(ctx, target, '');
        const created = resolveParent(ctx, target);
        if (!created) return `truncate: cannot create '${target}'`;
        created.parent.children[created.name] = { type: 'file', content: '' };
      }
      const node = resolveNode(ctx, target);
      if (!node) return `truncate: cannot open '${target}' for writing`;
      if (node.type === 'dir') return `truncate: '${target}' is a directory`;
      node.content = node.content.slice(0, size).padEnd(size, '\0');
      return null;
    },
  },
  readlink: {
    name: 'readlink',
    summary: 'print value of a symbolic link (simulated)',
    run: (args, ctx) => {
      if (args.length === 0) return 'readlink: missing operand';
      const node = resolveNode(ctx, args[0]);
      if (!node) return `readlink: ${args[0]}: No such file or directory`;
      return node.type === 'dir' ? `${args[0]}/` : args[0];
    },
  },
  du: {
    name: 'du',
    summary: 'estimate file / directory space usage (-h, -s)',
    run: (args, ctx) => {
      const human = args.includes('-h');
      const summary = args.includes('-s');
      const targets = args.filter((a) => !a.startsWith('-'));
      if (targets.length === 0) return 'du: missing operand';
      const fmt = (n: number) =>
        human ? `${(n / 1024).toFixed(1).padStart(6)}K` : String(n).padStart(6);
      const out: string[] = [];
      for (const t of targets) {
        const node = resolveNode(ctx, t);
        if (!node) return `du: cannot access '${t}': No such file or directory`;
        const total = nodeSize(node);
        out.push(`${fmt(total)}\t${t}`);
        if (!summary && node.type === 'dir') {
          for (const [name, child] of Object.entries(node.children)) {
            out.push(`${fmt(nodeSize(child))}\t${t === '/' ? '' : t}/${name}`);
          }
        }
      }
      return out.join('\n');
    },
  },
  fileinfo: {
    name: 'fileinfo',
    summary: 'show a compact summary of a file (size, lines, words, mtime)',
    run: (args, ctx) => {
      if (args.length === 0) return 'fileinfo: missing file operand';
      const node = resolveNode(ctx, args[0]);
      if (!node) return `fileinfo: ${args[0]}: No such file or directory`;
      if (node.type === 'dir') {
        const count = Object.keys(node.children).length;
        return `${args[0]}/  directory, ${count} entr${count === 1 ? 'y' : 'ies'}`;
      }
      const content = node.content;
      const lines = content ? content.split('\n').length : 0;
      const words = content.trim() ? content.trim().split(/\s+/).length : 0;
      return `${args[0]}  ${content.length} bytes, ${lines} lines, ${words} words, modified ${new Date().toUTCString()}`;
    },
  },
  chmod: {
    name: 'chmod',
    summary: 'change permissions (simulated)',
    run: (args) => {
      if (args.length < 2) return 'chmod: missing operand';
      return `chmod: set ${args[0]} on ${args.slice(1).join(' ')} ✓`;
    },
  },
  ln: {
    name: 'ln',
    summary: 'make a link (simulated)',
    run: (args) => {
      if (args.length < 2) return 'ln: missing file operand';
      return `ln: created link ${args[1]} -> ${args[0]} ✓`;
    },
  },
  find: {
    name: 'find',
    summary: 'find files by name (supports -name <glob>)',
    run: (args, ctx) => {
      const start = args[0] && !args[0].startsWith('-') ? args[0] : '.';
      const nameIdx = args.findIndex((a) => a === '-name');
      const target = nameIdx >= 0 ? args[nameIdx + 1] : null;
      const out: string[] = [];
      const visit = (node: FsNode, path: string) => {
        if (node.type === 'dir') {
          for (const [child, cnode] of Object.entries(node.children)) {
            const childPath = path === '/' ? `/${child}` : `${path}/${child}`;
            if (!target || globMatch(target, child)) out.push(childPath);
            visit(cnode, childPath);
          }
        }
      };
      const root = resolveNode(ctx, start) ?? ctx.fs;
      visit(root, start === '/' ? '' : start);
      return out.join('\n');
    },
  },
  tree: {
    name: 'tree',
    summary: 'display directory tree',
    run: (args, ctx) => {
      const start = args[0] && !args[0].startsWith('-') ? args[0] : '.';
      const root = resolveNode(ctx, start);
      if (!root) return `tree: ${start}: No such file or directory`;
      const lines: string[] = [`.`];
      const render = (node: FsNode, prefix: string) => {
        if (node.type !== 'dir') return;
        const entries = Object.entries(node.children);
        entries.forEach(([name, child], i) => {
          const last = i === entries.length - 1;
          lines.push(
            `${prefix}${last ? '└── ' : '├── '}${name}${child.type === 'dir' ? '/' : ''}`,
          );
          if (child.type === 'dir') render(child, `${prefix}${last ? '    ' : '│   '}`);
        });
      };
      render(root, '');
      return lines.join('\n');
    },
  },
  stat: {
    name: 'stat',
    summary: 'display file status',
    run: (args, ctx) => {
      if (args.length === 0) return 'stat: missing operand';
      const node = resolveNode(ctx, args[0]);
      if (!node) return `stat: cannot stat '${args[0]}': No such file or directory`;
      const size = node.type === 'file' ? node.content.length : 4096;
      return `  File: ${args[0]}
  Size: ${size}\tBlocks: ${Math.ceil(size / 512)}\tIO Block: 4096   ${node.type === 'dir' ? 'directory' : 'regular file'}
Device: 801h/2049d\tInode: ${Math.abs(hashCode(args[0])) % 99999}\tLinks: 1
Access: (0644/-rw-r--r--)  Uid: ( 1000/ learner)   Gid: ( 1000/ learner)
Modify: ${new Date().toUTCString()}`;
    },
  },
  basename: {
    name: 'basename',
    summary: 'strip directory and suffix',
    run: (args) => args[0]?.split('/').pop() ?? '',
  },
  dirname: {
    name: 'dirname',
    summary: 'strip last component from filename',
    run: (args) => {
      const p = args[0] ?? '.';
      const idx = p.lastIndexOf('/');
      if (idx <= 0) return idx === 0 ? '/' : '.';
      return p.slice(0, idx);
    },
  },
  realpath: {
    name: 'realpath',
    summary: 'print resolved absolute path',
    run: (args, ctx) => joinPath(ctx.cwd, args[0] ?? '.'),
  },
  file: {
    name: 'file',
    summary: 'determine file type',
    run: (args, ctx) => {
      if (args.length === 0) return 'file: missing file operand';
      return args
        .map((a) => {
          const n = resolveNode(ctx, a);
          if (!n) return `${a}: cannot open`;
          if (n.type === 'dir') return `${a}: directory`;
          const c = n.content;
          if (/^#!.*\b(bash|sh|node|python)\b/.test(c)) return `${a}: ${RegExp.$1} script, ASCII text`;
          if (c.startsWith('#')) return `${a}: ASCII text`;
          if (!c) return `${a}: empty`;
          return `${a}: ASCII text`;
        })
        .join('\n');
    },
  },
  diff: {
    name: 'diff',
    summary: 'compare two files line by line',
    run: (args, ctx) => {
      if (args.length < 2) return 'diff: missing operand';
      const a = readInput(args[0], ctx);
      const b = readInput(args[1], ctx);
      if (a === null) return `diff: ${args[0]}: No such file`;
      if (b === null) return `diff: ${args[1]}: No such file`;
      const aLines = a.split('\n');
      const bLines = b.split('\n');
      const out: string[] = [];
      const max = Math.max(aLines.length, bLines.length);
      for (let i = 0; i < max; i++) {
        if (aLines[i] !== bLines[i]) {
          if (aLines[i] !== undefined) out.push(`< ${aLines[i]}`);
          if (bLines[i] !== undefined) out.push(`> ${bLines[i]}`);
        }
      }
      return out.length ? out.join('\n') : '(files are identical)';
    },
  },

  // ── text utilities (all accept piped stdin) ──
  head: {
    name: 'head',
    summary: 'print first N lines of a file (default 10)',
    run: (args, ctx) => {
      const n = (() => {
        const f = args.find((a) => a.startsWith('-n'));
        if (f) return parseInt(f.slice(2), 10) || 10;
        return 10;
      })();
      const target = args.find((a) => !a.startsWith('-')) ?? args[0];
      if (!target) return 'head: missing file operand';
      const content = readInput(target, ctx);
      if (content === null) return `head: cannot open '${target}': No such file or directory`;
      return content.split('\n').slice(0, n).join('\n');
    },
  },
  tail: {
    name: 'tail',
    summary: 'print last N lines of a file (default 10)',
    run: (args, ctx) => {
      const n = (() => {
        const f = args.find((a) => a.startsWith('-n'));
        if (f) return parseInt(f.slice(2), 10) || 10;
        return 10;
      })();
      const target = args.find((a) => !a.startsWith('-')) ?? args[0];
      if (!target) return 'tail: missing file operand';
      const content = readInput(target, ctx);
      if (content === null) return `tail: cannot open '${target}': No such file or directory`;
      const lines = content.split('\n');
      return lines.slice(Math.max(0, lines.length - n)).join('\n');
    },
  },
  wc: {
    name: 'wc',
    summary: 'count lines, words, bytes',
    run: (args, ctx) => {
      const showLines = args.includes('-l');
      const showWords = args.includes('-w');
      const showBytes = args.includes('-c');
      const all = !showLines && !showWords && !showBytes;
      const targets = args.filter((a) => !a.startsWith('-'));
      if (targets.length === 0) return 'wc: missing file operand';
      const out: string[] = [];
      for (const t of targets) {
        const r = tryReadInput(t, ctx);
        if (!r.ok) {
          out.push(`wc: ${t}: No such file or directory`);
          continue;
        }
        const text = r.content;
        const lines = text ? text.split('\n').length - (text.endsWith('\n') ? 1 : 0) : 0;
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const bytes = new TextEncoder().encode(text).length;
        const parts: string[] = [];
        if (all || showLines) parts.push(String(lines).padStart(7));
        if (all || showWords) parts.push(String(words).padStart(7));
        if (all || showBytes) parts.push(String(bytes).padStart(7));
        const label = t.startsWith('__STDIN__') ? '' : t;
        parts.push(label);
        out.push(parts.join(' ').trimEnd());
      }
      return out.join('\n');
    },
  },
  grep: {
    name: 'grep',
    summary: 'search text for a pattern (supports -i -v -n)',
    run: (args, ctx) => {
      if (args.length === 0) return 'grep: missing pattern';
      let ignoreCase = false;
      let invert = false;
      let lineNumbers = false;
      const filtered: string[] = [];
      for (const a of args) {
        if (a === '-i') ignoreCase = true;
        else if (a === '-v') invert = true;
        else if (a === '-n' || a === '-nH') lineNumbers = true;
        else filtered.push(a);
      }
      const pattern = filtered[0];
      if (!pattern) return 'grep: missing pattern';
      const targets = filtered.slice(1);
      const re = new RegExp(escapeRegex(pattern), ignoreCase ? 'i' : '');
      const out: string[] = [];
      for (const t of targets) {
        const r = tryReadInput(t, ctx);
        if (!r.ok) {
          out.push(`grep: ${t}: No such file or directory`);
          continue;
        }
        r.content.split('\n').forEach((line, i) => {
          const hit = re.test(line);
          const matched = invert ? !hit : hit;
          if (matched) {
            const label = t.startsWith('__STDIN__') ? '' : t;
            out.push(lineNumbers ? `${label}${label ? ':' : ''}${i + 1}:${line}` : line);
          }
        });
      }
      return out.join('\n');
    },
  },
  sort: {
    name: 'sort',
    summary: 'sort lines of text (supports -r -n -u)',
    run: (args, ctx) => {
      const reverse = args.includes('-r');
      const numeric = args.includes('-n');
      const unique = args.includes('-u');
      const targets = args.filter((a) => !a.startsWith('-'));
      const lines: string[] = [];
      for (const t of targets) {
        const r = tryReadInput(t, ctx);
        if (!r.ok) return `sort: ${t}: No such file or directory`;
        lines.push(...r.content.split('\n'));
      }
      let sorted = [...lines];
      if (numeric) sorted.sort((a, b) => parseFloat(a) - parseFloat(b));
      else sorted.sort();
      if (reverse) sorted.reverse();
      if (unique) sorted = sorted.filter((v, i, a) => a.indexOf(v) === i);
      return sorted.join('\n');
    },
  },
  uniq: {
    name: 'uniq',
    summary: 'remove adjacent duplicate lines (supports -c -i)',
    run: (args, ctx) => {
      const count = args.includes('-c');
      const targets = args.filter((a) => !a.startsWith('-'));
      if (targets.length === 0) return 'uniq: missing file operand';
      const out: string[] = [];
      for (const t of targets) {
        const r = tryReadInput(t, ctx);
        if (!r.ok) return `uniq: ${t}: No such file or directory`;
        const lines = r.content.split('\n');
        let prev: string | null = null;
        let run = 0;
        for (const line of lines) {
          if (line === prev) {
            run++;
            continue;
          }
          if (prev !== null) {
            out.push(count ? `${String(run).padStart(4, ' ')} ${prev}` : prev);
          }
          prev = line;
          run = 1;
        }
        if (prev !== null) {
          out.push(count ? `${String(run).padStart(4, ' ')} ${prev}` : prev);
        }
      }
      return out.join('\n');
    },
  },
  cut: {
    name: 'cut',
    summary: 'cut fields/characters from input (-f, -c, -d)',
    run: (args, ctx) => {
      const delimIdx = args.findIndex((a) => a === '-d');
      const delim = delimIdx >= 0 ? (args[delimIdx + 1] ?? '\t') : '\t';
      const fieldIdx = args.findIndex((a) => a === '-f');
      const charIdx = args.findIndex((a) => a === '-c');
      if (fieldIdx < 0 && charIdx < 0) return 'cut: you must specify a list of fields or characters';
      const spec = fieldIdx >= 0 ? args[fieldIdx + 1] : args[charIdx + 1];
      if (!spec) return 'cut: missing field spec';
      const targets = args.filter((a) => !a.startsWith('-') && a !== delim && a !== spec);
      if (targets.length === 0) return 'cut: missing file operand';
      const ranges = spec
        .split(',')
        .flatMap((part) => {
          if (part.includes('-')) {
            const [a, b] = part.split('-').map((n) => parseInt(n, 10));
            if (Number.isNaN(a) || Number.isNaN(b)) return [];
            const lo = Math.min(a, b);
            const hi = Math.max(a, b);
            return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
          }
          const n = parseInt(part, 10);
          return Number.isNaN(n) ? [] : [n];
        });
      const out: string[] = [];
      for (const t of targets) {
        const r = tryReadInput(t, ctx);
        if (!r.ok) return `cut: ${t}: No such file or directory`;
        for (const line of r.content.split('\n')) {
          if (charIdx >= 0) {
            const chars = [...line];
            out.push(ranges.map((i) => chars[i - 1] ?? '').join(''));
          } else {
            const fields = line.split(delim);
            out.push(ranges.map((i) => fields[i - 1] ?? '').join(delim));
          }
        }
      }
      return out.join('\n');
    },
  },
  tr: {
    name: 'tr',
    summary: 'translate or delete characters (SET1 SET2, -d)',
    run: (args, ctx) => {
      if (args.length === 0) return 'tr: missing operand';
      const deleteMode = args.includes('-d');
      const filtered = args.filter((a) => !a.startsWith('-'));
      let set1: string;
      let set2: string | null = null;
      if (deleteMode) {
        if (filtered.length < 1) return 'tr: missing operand';
        set1 = filtered[0];
      } else {
        if (filtered.length < 2) return 'tr: missing operand';
        [set1, set2] = filtered;
      }
      const targets = filtered.slice(deleteMode ? 1 : 2);
      let src = '';
      if (targets.length > 0) {
        for (const t of targets) {
          const r = tryReadInput(t, ctx);
          if (!r.ok) return `tr: ${t}: No such file or directory`;
          src += r.content;
        }
      } else if (typeof ctx.__lastStdin === 'string') {
        src = ctx.__lastStdin;
      } else {
        return 'tr: missing file operand (stdin not yet wired in this sandbox)';
      }
      if (deleteMode) {
        const set = new Set([...set1]);
        return src.split('').filter((c) => !set.has(c)).join('');
      }
      const a = [...set1];
      const b = [...set2!];
      return src
        .split('')
        .map((c) => {
          const i = a.indexOf(c);
          return i >= 0 ? (b[i] ?? b[b.length - 1]) : c;
        })
        .join('');
    },
  },
  tac: {
    name: 'tac',
    summary: 'print lines in reverse order',
    run: (args, ctx) => {
      const targets = args.filter((a) => !a.startsWith('-'));
      if (targets.length === 0) return 'tac: missing file operand';
      const out: string[] = [];
      for (const t of targets) {
        const r = tryReadInput(t, ctx);
        if (!r.ok) return `tac: ${t}: No such file or directory`;
        const lines = r.content.split('\n');
        out.push(lines.reverse().join('\n'));
      }
      return out.join('\n');
    },
  },
  rev: {
    name: 'rev',
    summary: 'reverse each line of input',
    run: (args, ctx) => {
      const targets = args.filter((a) => !a.startsWith('-'));
      if (targets.length === 0) return 'rev: missing file operand';
      const out: string[] = [];
      for (const t of targets) {
        const r = tryReadInput(t, ctx);
        if (!r.ok) return `rev: ${t}: No such file or directory`;
        out.push(r.content.split('\n').map((l) => [...l].reverse().join('')).join('\n'));
      }
      return out.join('\n');
    },
  },
  nl: {
    name: 'nl',
    summary: 'number lines of input',
    run: (args, ctx) => {
      const targets = args.filter((a) => !a.startsWith('-'));
      if (targets.length === 0) return 'nl: missing file operand';
      const out: string[] = [];
      for (const t of targets) {
        const r = tryReadInput(t, ctx);
        if (!r.ok) return `nl: ${t}: No such file or directory`;
        r.content.split('\n').forEach((line, i) => {
          if (line.length > 0) out.push(`${String(i + 1).padStart(6, ' ')}\t${line}`);
        });
      }
      return out.join('\n');
    },
  },
  paste: {
    name: 'paste',
    summary: 'merge lines of files side by side (-d delim)',
    run: (args, ctx) => {
      const dIdx = args.findIndex((a) => a === '-d');
      const delim = dIdx >= 0 ? (args[dIdx + 1] ?? '\t') : '\t';
      const targets = args.filter((a) => !a.startsWith('-') && a !== delim);
      if (targets.length < 2) return 'paste: missing file operand';
      const blocks: string[][] = targets.map((t) => {
        const r = tryReadInput(t, ctx);
        if (!r.ok) return [`paste: ${t}: No such file or directory`];
        return r.content.split('\n');
      });
      const max = Math.max(...blocks.map((b) => b.length));
      const out: string[] = [];
      for (let i = 0; i < max; i++) {
        out.push(blocks.map((b) => b[i] ?? '').join(delim));
      }
      return out.join('\n');
    },
  },
  join: {
    name: 'join',
    summary: 'join two files on a common field',
    run: (args, ctx) => {
      const targets = args.filter((a) => !a.startsWith('-'));
      if (targets.length < 2) return 'join: missing file operand';
      const [a, b] = targets;
      const ra = tryReadInput(a, ctx);
      const rb = tryReadInput(b, ctx);
      if (!ra.ok) return `join: ${a}: No such file or directory`;
      if (!rb.ok) return `join: ${b}: No such file or directory`;
      const aMap = new Map<string, string[]>();
      for (const line of ra.content.split('\n')) {
        const [k, ...rest] = line.split(/\s+/);
        if (k) aMap.set(k, rest);
      }
      const out: string[] = [];
      for (const line of rb.content.split('\n')) {
        const [k, ...rest] = line.split(/\s+/);
        if (!k) continue;
        const left = aMap.get(k);
        if (left) out.push([k, ...left, ...rest].join(' '));
      }
      return out.join('\n');
    },
  },
  md5sum: {
    name: 'md5sum',
    summary: 'print MD5-style digests of files',
    run: (args, ctx) => {
      const targets = args.filter((a) => !a.startsWith('-'));
      if (targets.length === 0) return 'md5sum: missing file operand';
      const out: string[] = [];
      for (const t of targets) {
        const r = tryReadInput(t, ctx);
        if (!r.ok) return `md5sum: ${t}: No such file or directory`;
        out.push(`${pseudoMd5(r.content)}  ${t}`);
      }
      return out.join('\n');
    },
  },
  sha256sum: {
    name: 'sha256sum',
    summary: 'print SHA-256-style digests of files',
    run: (args, ctx) => {
      const targets = args.filter((a) => !a.startsWith('-'));
      if (targets.length === 0) return 'sha256sum: missing file operand';
      const out: string[] = [];
      for (const t of targets) {
        const r = tryReadInput(t, ctx);
        if (!r.ok) return `sha256sum: ${t}: No such file or directory`;
        out.push(`${pseudoSha256(r.content)}  ${t}`);
      }
      return out.join('\n');
    },
  },
  strings: {
    name: 'strings',
    summary: 'print printable strings ≥4 chars from a file',
    run: (args, ctx) => {
      if (args.length === 0) return 'strings: missing file operand';
      const content = readInput(args[0], ctx);
      if (content === null) return `strings: ${args[0]}: No such file`;
      return (
        content.match(/[\x20-\x7e]{4,}/g)?.join('\n') ?? '(no printable strings)'
      );
    },
  },
  od: {
    name: 'od',
    summary: 'dump file in octal / hex / chars (-x hex, -c chars, -o octal)',
    run: (args, ctx) => {
      const target = args.find((a) => !a.startsWith('-'));
      if (!target) return 'od: missing file operand';
      const content = readInput(target, ctx);
      if (content === null) return `od: ${target}: No such file`;
      const bytes = new TextEncoder().encode(content);
      const hexMode = args.includes('-x');
      const charMode = args.includes('-c');
      const lines: string[] = [];
      for (let i = 0; i < bytes.length; i += 16) {
        const chunk: number[] = Array.from(bytes.slice(i, i + 16));
        let body: string;
        if (charMode) {
          body = chunk
            .map((b) =>
              b >= 32 && b < 127
                ? String.fromCharCode(b)
                : b === 10
                ? '\\n'
                : b === 9
                ? '\\t'
                : b === 0
                ? '\\0'
                : `\\${b.toString(8)}`,
            )
            .join(' ');
        } else if (hexMode) {
          body = Array.from(chunk)
            .map((b) => b.toString(16).padStart(2, '0'))
            .join(' ');
        } else {
          body = Array.from(chunk)
            .map((b) => b.toString(8).padStart(3, '0'))
            .join(' ');
        }
        lines.push(`${i.toString(8).padStart(7, ' ')}  ${body}`);
      }
      return lines.join('\n');
    },
  },
  sed: {
    name: 'sed',
    summary: 'stream editor — supports s/find/replace/[g]',
    run: (args, ctx) => {
      if (args.length < 2) return 'sed: missing expression or file';
      const expr = args[0];
      const targets = args.slice(1).filter((a) => !a.startsWith('-'));
      if (targets.length === 0) return 'sed: missing file';
      const m = expr.match(/^s\/(.+?)\/(.*?)\/([g]*)$/);
      if (!m) {
        return `sed: unsupported expression '${expr}' (only s/find/replace/[g] supported)`;
      }
      const [, find, repl, flags] = m;
      const global = flags.includes('g');
      const re = new RegExp(escapeRegex(find), global ? 'g' : '');
      const out: string[] = [];
      for (const t of targets) {
        const r = tryReadInput(t, ctx);
        if (!r.ok) return `sed: ${t}: No such file or directory`;
        out.push(r.content.replace(re, repl));
      }
      return out.join('\n');
    },
  },
  awk: {
    name: 'awk',
    summary: 'simple awk — `awk "{print $N}"` prints field N (or all with $0)',
    run: (args, ctx) => {
      let program: string | null = null;
      const files: string[] = [];
      for (const a of args) {
        if (a.startsWith('-')) continue;
        if (program === null && a.includes('print')) program = a;
        else files.push(a);
      }
      if (!program) return 'awk: missing program (use awk "{print $N}" file)';
      const m = program.match(/print\s+\$(\d+)/);
      if (!m) return 'awk: only `print $N` is supported in this sandbox';
      const field = parseInt(m[1], 10);
      const targets = files.length > 0 ? files : [];
      if (targets.length === 0) return 'awk: missing file operand';
      const out: string[] = [];
      for (const t of targets) {
        const r = tryReadInput(t, ctx);
        if (!r.ok) return `awk: ${t}: No such file or directory`;
        for (const line of r.content.split('\n')) {
          if (line.length === 0) continue;
          if (field === 0) out.push(line);
          else out.push(line.split(/\s+/)[field - 1] ?? '');
        }
      }
      return out.join('\n');
    },
  },
  xxd: {
    name: 'xxd',
    summary: 'hex dump of a file',
    run: (args, ctx) => {
      if (args.length === 0) return 'xxd: missing file';
      const content = readInput(args[0], ctx);
      if (content === null) return `xxd: ${args[0]}: No such file`;
      const bytes = new TextEncoder().encode(content);
      const lines: string[] = [];
      for (let i = 0; i < bytes.length; i += 16) {
        const chunk: number[] = Array.from(bytes.slice(i, i + 16));
        const hex = chunk
          .map((b) => b.toString(16).padStart(2, '0'))
          .join(' ')
          .padEnd(48, ' ');
        const ascii = chunk
          .map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.'))
          .join('');
        lines.push(`${i.toString(16).padStart(8, '0')}: ${hex}  ${ascii}`);
      }
      return lines.join('\n');
    },
  },
  base64: {
    name: 'base64',
    summary: 'base64 encode/decode',
    run: (args, ctx) => {
      const decode = args.includes('-d');
      const target = args.find((a) => !a.startsWith('-'));
      if (!target) return 'base64: missing file';
      const content = readInput(target, ctx);
      if (content === null) return `base64: ${target}: No such file`;
      try {
        return decode ? atob(content) : btoa(content);
      } catch {
        return 'base64: invalid input';
      }
    },
  },
  tee: {
    name: 'tee',
    summary: 'read from stdin, write to file and stdout (-a appends)',
    run: (args, ctx) => {
      const append = args.includes('-a');
      const targets = args.filter((a) => !a.startsWith('-'));
      if (targets.length === 0) return 'tee: missing file operand';
      const src = ctx.__lastStdin ?? '';
      for (const t of targets) {
        if (append) {
          const existing = resolveNode(ctx, t);
          const prev = existing?.type === 'file' ? existing.content : '';
          writeFile(ctx, t, prev + src);
        } else {
          writeFile(ctx, t, src);
        }
      }
      return src;
    },
  },
  xargs: {
    name: 'xargs',
    summary: 'build and execute command lines (simulated)',
    run: (args, ctx) => {
      if (args.length === 0) return 'xargs: missing command';
      const cmd = args[0];
      const tail = args.slice(1);
      const impl = COMMANDS[cmd];
      if (!impl) return `xargs: ${cmd}: command not found`;
      const stdin = ctx.__lastStdin ?? '';
      const tokens = stdin.length > 0 ? stdin.split(/\s+/) : [];
      if (tokens.length === 0) return null;
      const out: string[] = [];
      for (const tok of tokens) {
        const r = impl.run([...tail, tok], ctx);
        if (r != null) out.push(Array.isArray(r) ? r.join('\n') : r);
      }
      return out.join('\n');
    },
  },

  // ── system / info ──
  arch: {
    name: 'arch',
    summary: 'print machine architecture',
    run: () => 'x86_64',
  },
  nproc: {
    name: 'nproc',
    summary: 'print number of processing units available',
    run: () => '4',
  },
  lsblk: {
    name: 'lsblk',
    summary: 'list block devices',
    run: () =>
      `NAME        MAJ:MIN RM   SIZE RO TYPE  MOUNTPOINTS
sda           8:0    0    50G  0 disk
├─sda1        8:1    0    50G  0 part  /
└─sda2        8:2    0   512M  0 part  [SWAP]
sdb           8:16   0   100G  0 disk
└─sdb1        8:17   0   100G  0 part  /home
sr0          11:0    1  1024M  0 rom`,
  },
  lscpu: {
    name: 'lscpu',
    summary: 'display CPU architecture information',
    run: () =>
      `Architecture:            x86_64
  CPU op-mode(s):        32-bit, 64-bit
  Byte Order:            Little Endian
CPU(s):                  4
  On-line CPU(s) list:   0-3
Vendor ID:               GenuineIntel
  Model name:            Intel(R) Core(TM) i7-8559U CPU @ 2.70GHz
    CPU family:          6
    Thread(s) per core:  2
    Core(s) per socket:  2
    Socket(s):           1
Caches (sum of all):
  L1d:                   128 KiB (4 instances)
  L1i:                   128 KiB (4 instances)
  L2:                    1 MiB (2 instances)
  L3:                    8 MiB (1 instance)`,
  },
  lsmem: {
    name: 'lsmem',
    summary: 'list the ranges of available memory',
    run: () =>
      `RANGE                                  SIZE  STATE REMOVABLE  BLOCK
0x0000000000000000-0x000000007fffffff     2GiB online       yes    0-7
0x0000000100000000-0x000000017fffffff     2GiB online       yes   8-15`,
  },
  lsof: {
    name: 'lsof',
    summary: 'list open files (simulated)',
    run: (args, ctx) => {
      const filter = args.find((a) => !a.startsWith('-'));
      const cwd = ctx.cwd;
      const targets = filter
        ? [`${cwd}/welcome.txt`, `${cwd}/README.md`, `/etc/hostname`, `/etc/passwd`]
            .filter((p) => p.startsWith(filter))
        : [`${cwd}/welcome.txt`, `${cwd}/README.md`, `/etc/hostname`, `/etc/passwd`];
      return [
        'COMMAND   PID   USER   FD   TYPE DEVICE SIZE/OFF    NODE NAME',
        ...targets.map(
          (p, i) => `bash    ${1000 + i}  ${ctx.user}  txt    REG  801,0   ${p.length}    ${100 + i} ${p}`,
        ),
      ].join('\n');
    },
  },
  dmesg: {
    name: 'dmesg',
    summary: 'print or control the kernel ring buffer (simulated)',
    run: () =>
      [
        '[    0.000000] Linux version 5.15.0-learninx (builder@learninx) (gcc 11.4.0)',
        '[    0.012345] Command line: BOOT_IMAGE=/boot/vmlinuz root=/dev/sda1 ro quiet',
        '[    0.023456] x86/fpu: Supporting XSAVE feature 0x002: SSE registers',
        '[    0.034567] ACPI: Core revision 20220331',
        '[    0.045678] SCSI subsystem initialized',
        '[    0.123456] usb 1-1: new high-speed USB device number 2 using ehci-pci',
        '[    0.234567] usb 1-2: new full-speed USB device number 3 using ehci-pci',
        '[    0.345678] scsi 2:0:0:0: Direct-Access     ATA      Virtual Disk   0001 PQ: 0 ANSI: 5',
        '[    0.456789] EXT4-fs (sda1): mounted filesystem with ordered data mode',
        '[    1.012345] systemd[1]: Starting Journal Service...',
        '[    1.234567] systemd[1]: Reached target Local File Systems.',
      ].join('\n'),
  },
  last: {
    name: 'last',
    summary: 'show last logged-in users (simulated)',
    run: (_a, ctx) =>
      `${ctx.user}  pts/0        192.168.1.42     Mon Jun 30 09:14   still logged in
${ctx.user}  pts/0        192.168.1.42     Sun Jun 29 18:02 - 22:18  (04:16)
${ctx.user}  pts/0        192.168.1.42     Sat Jun 28 10:33 - 19:01  (08:28)
reboot   system boot  5.15.0-learninx   Sat Jun 28 10:32

wtmp begins Sat Jun 28 10:32:12 2025`,
  },
  who: {
    name: 'who',
    summary: 'show who is logged on',
    run: (_a, ctx) =>
      `${ctx.user}  pts/0        ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()} (192.168.1.42)`,
  },
  groups: {
    name: 'groups',
    summary: 'print group memberships for a user',
    run: (args, ctx) => {
      const user = args[0] ?? ctx.user;
      return `${user} : ${user} sudo www-data docker`;
    },
  },
  logname: {
    name: 'logname',
    summary: 'return the user\'s login name',
    run: (_a, ctx) => ctx.user,
  },
  vmstat: {
    name: 'vmstat',
    summary: 'report virtual memory statistics',
    run: () =>
      `procs -----------memory---------- ---swap-- -----io---- -system-- ------cpu-----
 r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st
 0  0      0 5343008 1487624 6512928    0    0     0     0   45   82  2  1 96  0  0`,
  },
  iostat: {
    name: 'iostat',
    summary: 'report CPU and I/O statistics',
    run: () =>
      `Linux 5.15.0-learninx (learninx-sandbox)  06/30/26  _x86_64_  (4 CPU)

avg-cpu:  %user   %nice %system %iowait  %steal   %idle
           2.34    0.00    1.05    0.12    0.00   96.49

Device   tps    kB_read/s    kB_wrtn/s    kB_read    kB_wrtn
sda      1.42        12.05         3.18     192840      50912
sdb      0.05         0.42         0.01       6720        128`,
  },
  history_stats: {
    name: 'history_stats',
    summary: 'show most-used commands from this session',
    run: (_a, ctx) => {
      if (ctx.history.length === 0) return '(no history)';
      const counts = new Map<string, number>();
      for (const h of ctx.history) {
        const cmd = h.trim().split(/\s+/)[0] ?? '';
        counts.set(cmd, (counts.get(cmd) ?? 0) + 1);
      }
      const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
      return sorted
        .map(([c, n], i) => `${String(i + 1).padStart(2)}  ${String(n).padStart(4)}  ${c}`)
        .join('\n');
    },
  },
  uname: {
    name: 'uname',
    summary: 'kernel info',
    run: (args, ctx) =>
      args.includes('-a')
        ? `Linux ${ctx.host} 5.15.0-learninx #1 SMP x86_64 GNU/Linux`
        : 'Linux',
  },
  uptime: {
    name: 'uptime',
    summary: 'uptime',
    run: () => ` ${new Date().toLocaleTimeString()} up 0 days, load average: 0.04, 0.02, 0.01`,
  },
  free: {
    name: 'free',
    summary: 'memory info',
    run: (args) =>
      args.includes('-h')
        ? `              total        used        free      shared  buff/cache   available
Mem:          7.7Gi       1.2Gi       5.1Gi        12Mi       1.4Gi       6.3Gi
Swap:         2.0Gi          0B       2.0Gi`
        : `              total        used        free      shared  buff/cache   available
Mem:        8088064     1257432     5343008       12345     1487624     6512928
Swap:       2097148           0     2097148`,
  },
  df: {
    name: 'df',
    summary: 'disk usage',
    run: (args) =>
      args.includes('-h')
        ? `Filesystem      Size  Used Avail Use% Mounted on
/dev/sda1        50G   12G   35G  26% /`
        : `Filesystem     1K-blocks    Used Available Use% Mounted on
/dev/sda1       52428800 12582912 36700160  26% /`,
  },
  ps: {
    name: 'ps',
    summary: 'list processes',
    run: (args) => {
      if (args.includes('aux')) {
        return [
          'USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND',
          'root         1  0.0  0.1  168928 11844 ?        Ss   Jun28   0:02 /sbin/init',
          'learner   1284  0.0  0.2  220000 18432 ?        S    Jun28   0:00 -bash',
          'learner   1301  0.0  0.1  156432  9216 ?        R    Jun28   0:00 ps aux',
        ].join('\n');
      }
      return `   PID TTY          TIME CMD
  1284 pts/0    00:00:00 bash
  1299 pts/0    00:00:00 ps`;
    },
  },
  top: {
    name: 'top',
    summary: 'live process viewer (snapshot)',
    run: () =>
      `top - ${new Date().toLocaleTimeString()}  up 0 days,  load average: 0.04, 0.02, 0.01
Tasks:  42 total,   1 running
%Cpu(s):  2.3 us,  1.0 sy,  0.0 ni, 96.5 id
MiB Mem :   7898.4 total,   5343.0 free,   1257.4 used
MiB Swap:   2048.0 total,   2048.0 free

  PID USER      PR  NI    VIRT    RES  SHR S  %CPU  %MEM     TIME+ COMMAND
    1 root      20   0  168928  11844  8424 S   0.0   0.1   0:02.01 systemd
 1284 learner   20   0  220000  18432 13456 S   0.0   0.2   0:00.10 bash
 1299 learner   20   0  156432   9216  7040 R   0.0   0.1   0:00.02 top`,
  },
  kill: {
    name: 'kill',
    summary: 'simulated process kill',
    run: (args) => {
      if (args.length === 0) return 'kill: usage: kill <pid>';
      const pid = args.find((a) => !a.startsWith('-'));
      if (!pid) return 'kill: missing pid';
      if (!/^\d+$/.test(pid)) return `kill: ${pid}: arguments must be process IDs`;
      return `(simulated) sent signal to pid ${pid} ✓`;
    },
  },
  id: {
    name: 'id',
    summary: 'print user identity',
    run: (_a, ctx) =>
      `uid=1000(${ctx.user}) gid=1000(${ctx.user}) groups=1000(${ctx.user}),27(sudo)`,
  },
  which: {
    name: 'which',
    summary: 'locate a command',
    run: (args) => {
      if (args.length === 0) return 'which: missing argument';
      return args
        .map((a) => (a in COMMANDS ? `/usr/bin/${a}` : `${a} not found`))
        .join('\n');
    },
  },
  man: {
    name: 'man',
    summary: 'show short help for a command',
    run: (args) => {
      if (args.length === 0) return 'What manual page do you want?';
      const name = args[0];
      const c = COMMANDS[name];
      if (!c) return `No manual entry for ${name}`;
      return `NAME\n  ${c.name} - ${c.summary}\n\nSYNOPSIS\n  ${c.name} [options] [args...]\n\nDESCRIPTION\n  Simulated implementation in the Learninx in-browser sandbox.`;
    },
  },
  help: {
    name: 'help',
    summary: 'list available commands',
    run: () =>
      Object.values(COMMANDS)
        .map((c) => `  ${c.name.padEnd(8)} ${c.summary}`)
        .join('\n') +
      '\n\nTip: this is a teaching sandbox — not a full Linux kernel.\nUse `;`, `&&`, `||` to chain commands and `|` to pipe them.',
  },

  // ── networking (simulated) ──
  ping: {
    name: 'ping',
    summary: 'ping a host (simulated)',
    run: (args) => {
      if (args.length === 0) return 'ping: usage: ping <host>';
      const host = args[0];
      return [
        `PING ${host} (93.184.216.34) 56(84) bytes of data.`,
        `64 bytes from ${host}: icmp_seq=1 ttl=56 time=12.3 ms`,
        `64 bytes from ${host}: icmp_seq=2 ttl=56 time=11.9 ms`,
        `64 bytes from ${host}: icmp_seq=3 ttl=56 time=12.1 ms`,
        `--- ${host} ping statistics ---`,
        `3 packets transmitted, 3 received, 0% packet loss`,
      ].join('\n');
    },
  },
  curl: {
    name: 'curl',
    summary: 'fetch a URL (simulated)',
    run: (args) => {
      const url = args.find((a) => /^https?:\/\//.test(a)) ?? args[0];
      if (!url) return 'curl: try "curl <url>"';
      if (args.includes('-I') || args.includes('--head')) {
        return `HTTP/1.1 200 OK\nContent-Type: text/html\nServer: learninx-sandbox\n`;
      }
      return `<!doctype html><html><body><h1>${url}</h1><p>(simulated response from Learninx sandbox)</p></body></html>`;
    },
  },
  wget: {
    name: 'wget',
    summary: 'download a URL (simulated)',
    run: (args) => {
      const url = args.find((a) => /^https?:\/\//.test(a)) ?? args[0];
      if (!url) return 'wget: missing URL';
      return `--${new Date().toISOString()}--  ${url}\nResolving... connecting... connected.\nHTTP request sent, awaiting response... 200 OK\nLength: 1234 (1.2K) [text/html]\nSaving to: 'index.html'\n\n'index.html' saved [1234/1234]`;
    },
  },
  ssh: {
    name: 'ssh',
    summary: 'simulated ssh login',
    run: (args) => {
      if (args.length === 0) return 'ssh: usage: ssh user@host';
      return `(simulated) connected to ${args[0]}\nLast login: ${new Date().toUTCString()}\n${args[0].split('@').pop()}:~$ `;
    },
  },
  ifconfig: {
    name: 'ifconfig',
    summary: 'show network interfaces',
    run: () =>
      `eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet 192.168.1.42  netmask 255.255.255.0  broadcast 192.168.1.255
        inet6 fe80::a00:27ff:fe4e:1234  prefixlen 64  scopeid 0x20
        ether 08:00:27:4e:12:34  txqueuelen 1000  (Ethernet)
        RX packets 12345  bytes 8765432 (8.3 MiB)
        TX packets 9876   bytes 1234567 (1.1 MiB)

lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536
        inet 127.0.0.1  netmask 255.0.0.0
        inet6 ::1  prefixlen 128  scopeid 0x10
        loop  txqueuelen 1000  (Local Loopback)`,
  },
  ip: {
    name: 'ip',
    summary: 'show / manipulate routing (simulated, `ip addr`)',
    run: (args) => {
      if (args[0] === 'addr' || args[0] === 'a') {
        return `2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500
    inet 192.168.1.42/24 brd 192.168.1.255 scope global eth0
       valid_lft forever preferred_lft forever
3: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever`;
      }
      return 'ip: (only `ip addr` is simulated in this sandbox)';
    },
  },

  // ── privileged / job control (simulated) ──
  sudo: {
    name: 'sudo',
    summary: 'run a command as another user (simulated)',
    run: (args) => {
      if (args.length === 0) return 'sudo: usage: sudo command';
      return `(simulated) running with elevated privileges: ${args.join(' ')}`;
    },
  },
  nohup: {
    name: 'nohup',
    summary: 'run a command immune to hangups (simulated)',
    run: () => 'nohup: (backgrounding not supported in this sandbox)',
  },
};

export const COMMAND_NAMES = Object.keys(COMMANDS).sort();

// ────────────────────────────────────────────────── chain / pipe ──

// Split a command line into individual statements on ;, &&, || (preserving pipes).
function splitStatements(
  line: string,
): { line: string; op: ';' | '&&' | '||' | null }[] {
  const out: { line: string; op: ';' | '&&' | '||' | null }[] = [];
  let cur = '';
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
      cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === '&' && line[i + 1] === '&') {
      out.push({ line: cur.trim(), op: '&&' });
      cur = '';
      i++;
      continue;
    }
    if (ch === '|' && line[i + 1] === '|') {
      out.push({ line: cur.trim(), op: '||' });
      cur = '';
      i++;
      continue;
    }
    if (ch === ';') {
      out.push({ line: cur.trim(), op: ';' });
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push({ line: cur.trim(), op: null });
  return out;
}

const STDIN_CONSUMERS = new Set([
  'cat', 'head', 'tail', 'wc', 'grep', 'sort', 'diff', 'xxd', 'base64',
  'tac', 'rev', 'nl', 'uniq', 'cut', 'tr', 'sed', 'awk', 'od', 'strings', 'tee', 'md5sum', 'sha256sum',
]);

function injectStdin(cmd: string, args: string[], stdin: string): string[] {
  if (STDIN_CONSUMERS.has(cmd) && args.length === 0) {
    return [`__STDIN__:${stdin}`, ...args];
  }
  return args;
}

function runStatement(line: string, ctx: ShellContext): string | string[] | null {
  // Split on unquoted pipes.
  const stages: string[] = [];
  let cur = '';
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
      cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === '|') {
      stages.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  stages.push(cur.trim());

  let prevOut = '';
  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    const tokens = tokenize(stage);
    if (tokens.length === 0) continue;
    const cmd = tokens[0];
    const args = tokens.slice(1);
    const impl = COMMANDS[cmd];
    if (!impl) return `${cmd}: command not found`;
    const pipedArgs = i > 0 ? injectStdin(cmd, args, prevOut) : args;
    ctx.__lastStdin = i > 0 ? prevOut : '';
    const out = impl.run(pipedArgs, ctx);
    const text = out == null ? '' : Array.isArray(out) ? out.join('\n') : out;
    if (text === '__CLEAR__') return text;
    prevOut = text;
  }
  return prevOut;
}

export function runCommand(input: string, ctx: ShellContext): string | string[] | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  ctx.history.push(trimmed);

  const statements = splitStatements(trimmed);
  let lastExitOk = true;
  let lastOut: string | string[] | null = null;
  for (const { line, op } of statements) {
    if (!line) continue;
    if (op === '&&' && !lastExitOk) break;
    if (op === '||' && lastExitOk) continue;
    lastOut = runStatement(line, ctx);
    const text =
      lastOut == null ? '' : Array.isArray(lastOut) ? lastOut.join('\n') : lastOut;
    if (text === '__CLEAR__') return lastOut;
    lastExitOk = text !== '__NUL__' && !/^.+: (command )?not found/.test(text);
  }
  return lastOut;
}

// ────────────────────────────────────────────────── tokenizer ──

function tokenize(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quote: '"' | "'" | null = null;
  for (const ch of line) {
    if (quote) {
      if (ch === quote) {
        quote = null;
        continue;
      }
      cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (cur) {
        out.push(cur);
        cur = '';
      }
      continue;
    }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}
