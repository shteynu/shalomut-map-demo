import assert from 'node:assert';
import test from 'node:test';
import { check, readClaim, readDefault, toNumber } from './check-doc-numbers.mjs';

/**
 * A repository small enough to reason about: one setting, one document, one
 * claim. The real registry is checked by running the script against the real
 * tree; what these tests pin down is the behaviour around the edges, where a
 * gate quietly stops guarding.
 */
const CONFIG = 'ai-analytics-service/src/config.py';
const DOCUMENT = 'docs/ai-analysis-run-mechanics.html';

const tree = ({ ceiling = '30.0', label = 'раз в 2–30 с' } = {}) => ({
  [CONFIG]:
    `        self.ai_job_poll_interval_seconds: float = max(\n` +
    `            min(60.0, float(os.getenv("AI_JOB_POLL_INTERVAL_SECONDS", "2.0"))),\n` +
    `        )\n` +
    `                float(os.getenv("AI_JOB_POLL_MAX_INTERVAL_SECONDS", "${ceiling}")),\n` +
    `                float(os.getenv("AI_JOB_HEARTBEAT_INTERVAL_SECONDS", "30.0")),\n`,
  'src/lib/server/ai-analysis-worker.ts':
    'export const AI_ANALYSIS_JOB_MAX_ATTEMPTS = 3;\n' +
    'export const AI_ANALYSIS_JOB_LEASE_MS = 90_000;\n' +
    'export const AI_ANALYSIS_QUEUE_STALL_AFTER_MS = 600_000;\n',
  'src/lib/dashboard/ai-insights-watch.ts':
    'export const WATCH_FIRST_DELAY_MS = 5_000;\n' +
    'export const WATCH_MAX_DELAY_MS = 30_000;\n' +
    'export const WATCH_CEILING_MS = 20 * 60_000;\n',
  'src/lib/repositories/interfaces.ts':
    'export const OPERATIONAL_EVENT_RETENTION_DAYS = 30;\n',
  'src/lib/server/observability-alerts.ts':
    'export const OBSERVABILITY_COUNT_WINDOW_MINUTES = 360;\n' +
    'export const OBSERVABILITY_RATIO_WINDOW_MINUTES = 1440;\n',
  // The observability document states each window twice — once in the
  // thresholds table and once in the retention table — which is exactly the
  // shape a number drifts in, so both are claimed.
  'docs/observability.md':
    '| `submission_lost` | `survey_submission_lost_after_retries` | count | 360 min | 1 |\n' +
    '| `analysis_written_without_the_model` | `ai_deterministic_summary_ratio_sample` | mean over 2 samples | 1440 min | 0.5 |\n' +
    '| Retention | 30 days | `OPERATIONAL_EVENT_RETENTION_DAYS` |\n' +
    '| Count window | 360 min | `OBSERVABILITY_COUNT_WINDOW_MINUTES` |\n' +
    '| Ratio window | 1440 min | `OBSERVABILITY_RATIO_WINDOW_MINUTES` |\n',
  'docs/ai-analysis-run-lifecycle.md':
    '| Poll interval | 2 s | `AI_JOB_POLL_INTERVAL_SECONDS` | x |\n' +
    '| Idle poll ceiling | 30 s | `AI_JOB_POLL_MAX_INTERVAL_SECONDS` | x |\n' +
    '| Heartbeat interval | 30 s | `AI_JOB_HEARTBEAT_INTERVAL_SECONDS` | x |\n' +
    '| Lease length | 90 s | `AI_ANALYSIS_JOB_LEASE_MS` | x |\n' +
    '| Queue stall threshold | 600 s | `AI_ANALYSIS_QUEUE_STALL_AFTER_MS` | x |\n' +
    '| First re-check | 5 s | `WATCH_FIRST_DELAY_MS` |\n' +
    '| Where the interval settles | 30 s | `WATCH_MAX_DELAY_MS` |\n' +
    '| Visible time before it gives up | 20 min | `WATCH_CEILING_MS` |\n',
  'docs/ai-analysis-jobs.html':
    '<td class="num">2 с</td><td class="src">AI_JOB_POLL_INTERVAL_SECONDS</td>' +
    '<td class="num">30 с</td><td class="src">AI_JOB_POLL_MAX_INTERVAL_SECONDS</td>' +
    '<td class="num">30 с</td><td class="src">AI_JOB_HEARTBEAT_INTERVAL_SECONDS</td>' +
    '<td class="num">90 с</td><td class="src">AI_ANALYSIS_JOB_LEASE_MS</td>' +
    '<td class="num">3</td><td class="src">AI_ANALYSIS_JOB_MAX_ATTEMPTS</td>' +
    '\n    loop поллинг: 2 с, до 30 с на простое\n',
  [DOCUMENT]:
    '<td>Интервал опроса</td><td class="num">2 с</td>' +
    '<td>Потолок опроса на простое</td><td class="num">30 с</td>' +
    '<td>Интервал стука</td><td class="num">30 с</td>' +
    '<td>Срок аренды</td><td class="num">90 с</td>' +
    `<text>${label}</text>`,
});

const readFrom = (files) => (file) => {
  if (!(file in files)) throw new Error(`ENOENT ${file}`);
  return files[file];
};

test('a tree where prose and configuration agree raises nothing', () => {
  assert.deepStrictEqual(check({ readFile: readFrom(tree()) }), []);
});

test('the exact regression this gate exists for', () => {
  // 2026-08-20: the ceiling arrived in config.py and three documents went on
  // saying the worker asks every two seconds.
  const files = tree();
  files[DOCUMENT] = files[DOCUMENT]
    .replace('<td>Потолок опроса на простое</td><td class="num">30 с</td>', '')
    .replace('раз в 2–30 с', 'каждые 2 с');

  const errors = check({ readFile: readFrom(files) });

  assert.ok(errors.some((error) => /Потолок опроса на простое/.test(error)));
  assert.ok(errors.some((error) => /раз в N–N с/.test(error)));
  assert.ok(errors.every((error) => error.startsWith(DOCUMENT)));
});

test('a number that moved in the code fails every document quoting it', () => {
  const errors = check({ readFile: readFrom(tree({ ceiling: '45.0' })) });
  const documents = new Set(errors.map((error) => error.split(':')[0]));

  assert.strictEqual(documents.size, 3);
  assert.ok(errors.every((error) => /configured as 45/.test(error)));
});

test('a claim whose passage was rewritten fails instead of passing forever', () => {
  const errors = check({
    readFile: readFrom(tree({ label: 'время от времени' })),
  });

  assert.ok(errors.length > 0);
  assert.ok(errors.every((error) => /nothing matches the check/.test(error)));
  assert.ok(errors.every((error) => /check-doc-numbers\.mjs/.test(error)));
});

test('a setting renamed in the code is reported once, not per document', () => {
  const files = tree();
  files[CONFIG] = files[CONFIG].replace(
    'AI_JOB_POLL_MAX_INTERVAL_SECONDS',
    'AI_JOB_IDLE_CEILING_SECONDS',
  );

  const errors = check({ readFile: readFrom(files) });

  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /no longer declares a default/);
});

test('milliseconds in the code are seconds in the documents', () => {
  const { value } = readDefault(
    'AI_ANALYSIS_JOB_LEASE_MS',
    readFrom(tree()),
  );

  assert.strictEqual(value, 90);
});

test('a decimal comma and a decimal point are the same number', () => {
  assert.strictEqual(toNumber('2,5'), 2.5);
  assert.strictEqual(toNumber('2.5'), 2.5);
  assert.strictEqual(toNumber('90_000'), 90000);
});

test('a claim reads every occurrence, not just the first', () => {
  const { values } = readClaim(
    { pattern: /раз в ([\d.,]+)–[\d.,]+ с/g, setting: 'x', where: 'y', document: 'z' },
    'раз в 2–30 с … раз в 5–30 с',
  );

  assert.deepStrictEqual(values, ['2', '5']);
});

test('a document the registry expects but cannot read is an error, not a pass', () => {
  const files = tree();
  delete files[DOCUMENT];

  const errors = check({ readFile: readFrom(files) });

  assert.ok(errors.some((error) => /cannot be read, but CLAIMS expects it/.test(error)));
});
