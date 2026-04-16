import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const standaloneRoot = path.join(repoRoot, '.next', 'standalone');
const standaloneFontPath = path.join(
  standaloneRoot,
  'node_modules',
  'next',
  'dist',
  'compiled',
  '@vercel',
  'og',
  'Geist-Regular.ttf',
);

function resetCopy(sourcePath, targetPath) {
  if (!fs.existsSync(sourcePath)) return;
  fs.rmSync(targetPath, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.cpSync(sourcePath, targetPath, { recursive: true, force: true });
}

if (!fs.existsSync(path.join(standaloneRoot, 'server.js'))) {
  throw new Error('Standalone bundle is missing server.js. Run `next build` before preparing the runtime bundle.');
}

resetCopy(path.join(repoRoot, '.next', 'static'), path.join(standaloneRoot, '.next', 'static'));
resetCopy(path.join(repoRoot, 'public'), path.join(standaloneRoot, 'public'));
resetCopy(path.join(repoRoot, 'assets', 'companion'), path.join(standaloneRoot, 'assets', 'companion'));
resetCopy(
  path.join(repoRoot, 'node_modules', 'next', 'dist', 'compiled', '@vercel', 'og', 'Geist-Regular.ttf'),
  standaloneFontPath,
);
