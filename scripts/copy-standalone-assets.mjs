// Copies static assets and the public/ folder into the standalone build output.
// Standalone builds only include the server runtime; static files must be added back.
import { cp, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const standalone = join(root, '.next', 'standalone');

if (!existsSync(standalone)) {
  console.error(`Standalone build not found at ${standalone}. Run \`npm run build\` first.`);
  process.exit(1);
}

const copies = [
  { from: join(root, '.next', 'static'), to: join(standalone, '.next', 'static') },
  { from: join(root, 'public'), to: join(standalone, 'public') },
  // Mirror any optional .env files into the standalone output. They are not
  // required — the app runs without a database — but we copy them if they
  // exist so deploys can pass secrets (e.g. LEARNINX_SECRET) via .env.
  { from: join(root, '.env'), to: join(standalone, '.env') },
  { from: join(root, '.env.production'), to: join(standalone, '.env.production') },
  { from: join(root, '.env.local'), to: join(standalone, '.env.local') },
];

for (const { from, to } of copies) {
  if (!existsSync(from)) continue;
  await mkdir(dirname(to), { recursive: true });
  await cp(from, to, { recursive: true });
  console.log(`Copied ${from} -> ${to}`);
}

console.log('Standalone assets ready. Starting server...');
