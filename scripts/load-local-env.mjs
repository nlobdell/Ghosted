import fs from 'node:fs';
import path from 'node:path';

export const LOCAL_ENV_FILE_NAMES = [
  '.env',
  '.env.development',
  '.env.local',
  '.env.development.local',
];

export function normalizeLocalEnvValue(value) {
  const trimmed = String(value ?? '').trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === '\'' && last === '\'')) {
      return trimmed.slice(1, -1);
    }
  }

  const commentIndex = trimmed.indexOf(' #');
  if (commentIndex >= 0) {
    return trimmed.slice(0, commentIndex).trimEnd();
  }

  return trimmed;
}

export function loadLocalEnvIntoProcess(options = {}) {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const env = options.env ?? process.env;
  const fileNames = options.fileNames ?? LOCAL_ENV_FILE_NAMES;
  const loadedFiles = [];
  const values = {};

  for (const fileName of fileNames) {
    const filePath = path.join(cwd, fileName);
    if (!fs.existsSync(filePath)) continue;

    loadedFiles.push(filePath);
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

    for (const line of lines) {
      if (!line) continue;
      const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (!match) continue;

      const key = match[1];
      const normalizedValue = normalizeLocalEnvValue(match[2]);
      values[key] = normalizedValue;

      if (!String(env[key] ?? '').trim()) {
        env[key] = normalizedValue;
      }
    }
  }

  return {
    cwd,
    loadedFiles,
    values,
  };
}
