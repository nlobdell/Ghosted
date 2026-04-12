import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadLocalEnvIntoProcess } from '../../scripts/load-local-env.mjs';

describe('loadLocalEnvIntoProcess', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('loads the same env files as the dev helper without overwriting existing values', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghosted-local-env-'));
    tempDirs.push(tempDir);

    fs.writeFileSync(
      path.join(tempDir, '.env'),
      [
        'DISCORD_GUILD_ID=from-dot-env',
        'DATABASE_PATH="C:\\\\db\\\\ghosted.db"',
      ].join('\n'),
    );
    fs.writeFileSync(
      path.join(tempDir, '.env.local'),
      [
        'DISCORD_BOT_TOKEN=bot-token',
        'DISCORD_GUILD_ID=from-dot-env-local',
        "COMPANION_ASSET_DIR='C:\\\\assets\\\\companions' # trailing comment",
      ].join('\n'),
    );

    const env: Record<string, string> = {
      DISCORD_BOT_TOKEN: 'already-set-token',
    };

    const result = loadLocalEnvIntoProcess({
      cwd: tempDir,
      env,
    });

    expect(result.loadedFiles.map((filePath) => path.basename(filePath))).toEqual([
      '.env',
      '.env.local',
    ]);
    expect(env.DISCORD_GUILD_ID).toBe('from-dot-env');
    expect(env.DISCORD_BOT_TOKEN).toBe('already-set-token');
    expect(env.DATABASE_PATH).toBe('C:\\\\db\\\\ghosted.db');
    expect(env.COMPANION_ASSET_DIR).toBe("'C:\\\\assets\\\\companions'");
  });
});
