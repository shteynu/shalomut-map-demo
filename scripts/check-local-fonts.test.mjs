import assert from 'node:assert';
import test from 'node:test';
import { findInStylesheet, findRemoteFonts } from './check-local-fonts.mjs';

const exists = () => true;
const missing = () => false;

test('the exact regression this gate exists for', () => {
  // src/app/layout.tsx:3 as it stood until 2026-08-12.
  const errors = findRemoteFonts(
    'import { Noto_Sans_Hebrew } from "next/font/google";',
    'src/app/layout.tsx',
    exists,
  );

  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /layout\.tsx:1:/);
  assert.match(errors[0], /downloads at build time/);
  assert.match(errors[0], /src\/app\/fonts\/README\.md/);
});

test('a Google font host in code is the same dependency by another route', () => {
  const errors = findRemoteFonts(
    'const href = "https://fonts.googleapis.com/css2?family=Noto+Sans+Hebrew";',
    'src/app/head.tsx',
    exists,
  );

  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /named in code/);
});

test('a stylesheet import reaches the network before any component runs', () => {
  const errors = findInStylesheet(
    ['@import "tailwindcss";', '@import url(https://fonts.gstatic.com/x.css);'].join(
      '\n',
    ),
    'src/app/globals.css',
  );

  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /globals\.css:2:/);
});

test('a local font whose file is gone fails, because half a move is not a move', () => {
  const errors = findRemoteFonts(
    'const font = localFont({ src: "./fonts/noto-sans-hebrew-variable.woff2" });',
    'src/app/layout.tsx',
    missing,
  );

  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /does not exist/);
});

test('the array form of `src` is checked entry by entry', () => {
  const source = [
    'const font = localFont({',
    '  src: [',
    '    { path: "./fonts/regular.woff2", weight: "400" },',
    '    { path: "./fonts/bold.woff2", weight: "700" },',
    '  ],',
    '});',
  ].join('\n');

  assert.strictEqual(findRemoteFonts(source, 'src/app/layout.tsx', missing).length, 2);
  assert.strictEqual(findRemoteFonts(source, 'src/app/layout.tsx', exists).length, 0);
});

test('a package-relative source is left to the bundler, not guessed at', () => {
  const errors = findRemoteFonts(
    'const font = localFont({ src: "@acme/fonts/regular.woff2" });',
    'src/app/layout.tsx',
    missing,
  );

  assert.deepStrictEqual(errors, []);
});

test('prose about the rule is prose, not a violation', () => {
  const source = [
    '/**',
    ' * `next/font/google` fetches from fonts.gstatic.com during the build.',
    ' */',
    '// Replaced 2026-08-12; see next/font/google in the history.',
    'import localFont from "next/font/local";',
  ].join('\n');

  assert.deepStrictEqual(findRemoteFonts(source, 'src/app/layout.tsx', exists), []);
});

test('a CSS comment naming the host does not fail the stylesheet', () => {
  assert.deepStrictEqual(
    findInStylesheet('/* no fonts.googleapis.com here */', 'src/app/globals.css'),
    [],
  );
});

test('the gate does not scan its own source or fixtures', () => {
  assert.deepStrictEqual(
    findRemoteFonts(
      'import { Noto_Sans_Hebrew } from "next/font/google";',
      'scripts/check-local-fonts.test.mjs',
      exists,
    ),
    [],
  );
});

test('the line number points at the offending line, not the first one', () => {
  const source = [
    'import type { Metadata } from "next";',
    'import type { ReactNode } from "react";',
    'import { Noto_Sans_Hebrew } from "next/font/google";',
  ].join('\n');

  assert.match(
    findRemoteFonts(source, 'src/app/layout.tsx', exists)[0],
    /layout\.tsx:3:/,
  );
});
