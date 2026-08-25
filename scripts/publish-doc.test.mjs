import assert from 'node:assert';
import fs from 'node:fs';
import test from 'node:test';

import { TITLE_SCAN_BYTES, mermaidNotes, toArtifactBody } from './publish-doc.mjs';

const page = (body) =>
  ['<!doctype html>', '<html><head><meta charset=utf8></head><body>', body, '</body></html>'].join(
    '\n',
  );

test('the exact defect this script exists for: the runtime block goes whole', () => {
  // docs/how-shalomut-works.html:1121-1125 as it stands. The 2026-08-20 pass
  // removed the two script tags between these markers and kept the style.
  const { body } = toArtifactBody(
    page(
      [
        '<title>Как устроена Шаломут</title>',
        '<p>текст</p>',
        '<!--claude-mermaid-runtime-begin:3316302-->',
        '<style>.mermaid-diagram{margin-block:4px}</style>',
        '<script src="vendor/mermaid.min.js"></script>',
        '<script src="vendor/mermaid-init.js"></script>',
        '<!--claude-mermaid-runtime-end-->',
      ].join('\n'),
    ),
    'page.html',
  );

  assert.ok(!body.includes('mermaid-diagram{'), 'the runtime style must not survive');
  assert.ok(!body.includes('claude-mermaid-runtime'), 'nor its markers');
  assert.ok(body.includes('<p>текст</p>'));
});

test('the page skeleton drops and the body keeps what the document put in it', () => {
  const { body, title } = toArtifactBody(
    page(['<title>Механика одного прогона</title>', '<style>b{color:red}</style>'].join('\n')),
    'page.html',
  );

  assert.strictEqual(title, 'Механика одного прогона');
  assert.ok(body.startsWith('<title>'));
  assert.ok(body.includes('<style>b{color:red}</style>'));
  assert.ok(!/<head|<html|doctype/i.test(body));
});

test('a vendor path left in the body is refused, not stripped', () => {
  assert.throws(
    () =>
      toArtifactBody(
        page(['<title>t</title>', '<script src="vendor/extra.js"></script>'].join('\n')),
        'page.html',
      ),
    /still points at vendor\/extra\.js/,
  );
});

test('a second page skeleton inside the body is refused', () => {
  assert.throws(
    () => toArtifactBody(page(['<title>t</title>', '<body>again</body>'].join('\n')), 'page.html'),
    /survived into the body/,
  );
});

test('a document with no body has nothing to publish', () => {
  assert.throws(() => toArtifactBody('<p>loose</p>', 'page.html'), /no <body>/);
});

test('a missing title is refused, because nothing else supplies one', () => {
  assert.throws(() => toArtifactBody(page('<p>текст</p>'), 'page.html'), /no <title>/);
});

test('a title past the platform’s scan window is refused', () => {
  const filler = `<p>${'т'.repeat(TITLE_SCAN_BYTES)}</p>`;
  assert.throws(
    () => toArtifactBody(page([filler, '<title>late</title>'].join('\n')), 'page.html'),
    /past the 8192/,
  );
});

test('a ";" in a label is reported, because it takes the whole diagram down', () => {
  const notes = mermaidNotes('<pre class="mermaid">\nflowchart LR\n  A["раз; два"] --> B\n</pre>');

  assert.strictEqual(notes.length, 1);
  assert.match(notes[0], /diagram 1/);
  assert.match(notes[0], /takes the whole diagram down/);
});

test('a real <br/> is reported and an escaped one is not', () => {
  const real = mermaidNotes('<pre class="mermaid">\nA["раз<br/>два"]\n</pre>');
  const escaped = mermaidNotes('<pre class="mermaid">\nA["раз&lt;br/&gt;два"]\n</pre>');

  assert.strictEqual(real.length, 1);
  assert.match(real[0], /markup/);
  assert.deepStrictEqual(escaped, []);
});

test('the three documents in this repository publish, and say what they are', () => {
  const documents = [
    ['docs/how-shalomut-works.html', 'Как устроена Шаломут'],
    ['docs/ai-analysis-jobs.html', 'Джобы AI-анализа Шаломут'],
    ['docs/ai-analysis-run-mechanics.html', 'Механика одного прогона'],
  ];

  for (const [file, expected] of documents) {
    const { body, title, notes } = toArtifactBody(fs.readFileSync(file, 'utf8'), file);
    assert.strictEqual(title, expected, file);
    assert.ok(body.length > 1000, `${file}: suspiciously little body`);

    // The first version of the semicolon check read the raw label, so every
    // `&lt;br/&gt;` in these pages — which is how all of them spell a line
    // break — reported the defect it exists to catch. A note on a page that is
    // fine is worse than no note at all: it teaches the reader to skip them.
    assert.deepStrictEqual(notes, [], `${file}: reported a hazard it does not have`);
  }
});
