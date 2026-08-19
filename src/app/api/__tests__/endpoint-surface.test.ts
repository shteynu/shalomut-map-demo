import { describe, it } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

/**
 * The endpoint surface table in `docs/ai-analysis-run-lifecycle.md` is generated
 * from the routes that define it, and this is what makes that binding.
 *
 * It runs the generator's own check rather than re-implementing the parse: the
 * script is the definition of what the table should say, and a test with a
 * second opinion about that would eventually disagree with it.
 *
 * The failure this exists for happened on 2026-08-18. `main` gained
 * `GET /api/v1/fallback-status`, the hand-written table went on claiming to
 * enumerate the boundary without it, and nothing in the repository noticed —
 * the drift was caught by a rebase, which is luck rather than a process.
 */
describe('Endpoint surface documentation', () => {
  it('matches the endpoints the code actually defines', () => {
    const check = spawnSync(
      process.execPath,
      [path.join('scripts', 'generate-endpoint-surface.mjs'), '--check'],
      { cwd: process.cwd(), encoding: 'utf8' },
    );

    assert.strictEqual(
      check.status,
      0,
      `${check.stdout ?? ''}${check.stderr ?? ''}`,
    );
  });
});
