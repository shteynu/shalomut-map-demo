import assert from 'node:assert';
import fs from 'node:fs';
import test from 'node:test';

import {
  TITLE_SCAN_BYTES,
  mermaidNotes,
  repositoryPath,
  sourceComment,
  toArtifactBody,
} from './publish-doc.mjs';

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
  assert.ok(body.startsWith(`${sourceComment('page.html')}\n<title>`));
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

test('the published body opens by naming the file it was generated from', () => {
  // The 2026-08-20 hand version wrote this comment and the script, written five
  // days later, did not, so the 2026-09-17 republish dropped it from all three
  // pages. It is the one thing this script adds rather than removes.
  const { body } = toArtifactBody(
    page(['<title>Как устроена Шаломут</title>', '<p>текст</p>'].join('\n')),
    'docs/how-shalomut-works.html',
  );

  assert.ok(
    body.startsWith(
      '<!-- Источник этой страницы — файл docs/how-shalomut-works.html ' +
        'в репозитории shalomut-map-demo. Правки вносятся там и переиздаются сюда; ' +
        'правка здесь будет потеряна. -->\n',
    ),
    body.slice(0, 200),
  );
  assert.ok(body.includes('<p>текст</p>'));
});

test('the comment counts toward the window the platform scans for <title>', () => {
  // The comment sits above <title>, so it spends part of the 8 KB. A page that
  // fitted before this script wrote it can stop fitting, and the refusal has to
  // measure the body that is actually published, not the one on disk.
  const comment = Buffer.byteLength(sourceComment('page.html'), 'utf8');
  const filler = `<p>${'x'.repeat(TITLE_SCAN_BYTES - comment)}</p>`;
  const document = page([filler, '<title>late</title>'].join('\n'));

  assert.ok(
    Buffer.byteLength(`${filler}\n`, 'utf8') < TITLE_SCAN_BYTES,
    'precondition: without the comment this <title> is inside the window',
  );
  assert.throws(() => toArtifactBody(document, 'page.html'), /past the 8192/);
});

test('the path in the comment is the repository’s, however the file was named', () => {
  const root = '/repo';

  assert.strictEqual(repositoryPath('docs/page.html', root), 'docs/page.html');
  assert.strictEqual(repositoryPath('./docs/page.html', root), 'docs/page.html');
  assert.strictEqual(repositoryPath('/repo/docs/page.html', root), 'docs/page.html');
});

test('a file outside the repository is refused rather than named in public', () => {
  // The comment is published. A path that leaves the root would put someone's
  // home directory on a public page, and nothing downstream would catch it.
  assert.throws(() => repositoryPath('/Users/someone/page.html', '/repo'), /is not inside/);
  assert.throws(() => repositoryPath('../page.html', '/repo'), /is not inside/);
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
    assert.ok(body.startsWith(sourceComment(file)), `${file}: does not name itself`);

    // The first version of the semicolon check read the raw label, so every
    // `&lt;br/&gt;` in these pages — which is how all of them spell a line
    // break — reported the defect it exists to catch. A note on a page that is
    // fine is worse than no note at all: it teaches the reader to skip them.
    assert.deepStrictEqual(notes, [], `${file}: reported a hazard it does not have`);
  }
});
