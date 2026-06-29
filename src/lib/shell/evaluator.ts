import type { FsDir, FsNode } from './fs';

export interface ShellContext {
  cwd: string;
  fs: FsNode;
  user: string;
  host: string;
  history: string[];
  env: Record<string, string>;
}

export interface CommandSpec {
  name: string;
  summary: string;
  run: (args: string[], ctx: ShellContext) => string | string[] | null;
}

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

const COMMANDS: Record<string, CommandSpec> = {
  pwd: {
    name: 'pwd',
    summary: 'print working directory',
    run: (_args, ctx) => ctx.cwd,
  },
  whoami: {
    name: 'whoami',
    summary: 'show current user',
    run: (_args, ctx) => ctx.user,
  },
  hostname: {
    name: 'hostname',
    summary: 'show host name',
    run: (_args, ctx) => ctx.host,
  },
  date: {
    name: 'date',
    summary: 'show current date',
    run: () => new Date().toString(),
  },
  echo: {
    name: 'echo',
    summary: 'print arguments',
    run: (args) => args.join(' '),
  },
  clear: {
    name: 'clear',
    summary: 'clear screen',
    run: () => '__CLEAR__',
  },
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
        // ls on a single file prints its basename.
        const base = target.split('/').pop() ?? target;
        return base;
      }
      const dir = node;
      const names = Object.keys(dir.children);
      const visible = showAll ? ['.', '..', ...names] : names;
      if (!long) return visible.join('  ');
      return visible
        .map((n) => {
          if (n === '.' || n === '..') return `drwxr-xr-x  2 ${ctx.user} ${ctx.user}  4096  ${n}/`;
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
      // Normalize special case
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
        let pathSoFar: string | null = null;
        for (const part of parts) {
          if (!cursor) break;
          if (cursor.type !== 'dir') return `mkdir: ${arg}: not a directory`;
          const child: FsNode | undefined = cursor.children[part];
          if (!child) {
            if (!makeParents) return `mkdir: ${arg}: No such file or directory`;
            const newDir: FsNode = { type: 'dir', children: {} };
            cursor.children[part] = newDir;
            cursor = newDir;
          } else {
            cursor = child;
          }
          pathSoFar = (pathSoFar ? pathSoFar + '/' : '') + part;
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
        const node = resolveNode(ctx, arg);
        if (!node) out.push(`cat: ${arg}: No such file or directory`);
        else if (node.type === 'dir') out.push(`cat: ${arg}: Is a directory`);
        else out.push(node.content);
      }
      return out.join('\n');
    },
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
      // rename vs move-into-dir
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
  chmod: {
    name: 'chmod',
    summary: 'change permissions (simulated)',
    run: (args) => {
      if (args.length < 2) return 'chmod: missing operand';
      // Simulated — we just acknowledge it.
      return `chmod: set ${args[0]} on ${args.slice(1).join(' ')} ✓`;
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
  help: {
    name: 'help',
    summary: 'list available commands',
    run: () =>
      Object.values(COMMANDS)
        .map((c) => `  ${c.name.padEnd(8)} ${c.summary}`)
        .join('\n') + '\n\nTip: this is a teaching sandbox — not a full Linux kernel.',
  },
  history: {
    name: 'history',
    summary: 'show recent commands',
    run: (_args, ctx) =>
      ctx.history.map((c, i) => `  ${String(i + 1).padStart(3)}  ${c}`).join('\n'),
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
};

export const COMMAND_NAMES = Object.keys(COMMANDS).sort();

export function runCommand(input: string, ctx: ShellContext): string | string[] | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  ctx.history.push(trimmed);

  const tokens = tokenize(trimmed);
  const cmd = tokens[0];
  const args = tokens.slice(1);

  if (cmd.includes('/')) {
    return `bash: ${cmd.split('/')[0]}: command not found`;
  }

  const impl = COMMANDS[cmd];
  if (!impl) {
    return `${cmd}: command not found`;
  }
  return impl.run(args, ctx);
}

// Very small sh-like tokenizer — supports quoted strings only enough for `echo "hi there"`.
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
