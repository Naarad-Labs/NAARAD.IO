import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
for (const stage of ['motion', 'accent', 'hero-zoom']) {
  test(`${stage} cancels stale async work and removes resources on teardown`, () => {
    const result = spawnSync(process.execPath, ['--experimental-vm-modules', `tests/helpers/${stage}-lifecycle.mjs`], {
      cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  });
}
