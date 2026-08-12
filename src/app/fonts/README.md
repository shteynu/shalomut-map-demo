# Fonts

## `noto-sans-hebrew-variable.woff2`

`Noto Sans Hebrew`, variable, `wght` 100–900 and `wdth` 62.5–100, version
3.001. 58 744 bytes, SHA-256
`ad6faab91ef16d6eb82a30a4849b824e23226b8f5bc61445cb3b054cfe966af8`.

It is the build Google Fonts itself publishes, taken from the upstream project
rather than from the CDN:

```
https://raw.githubusercontent.com/notofonts/notofonts.github.io/main/fonts/NotoSansHebrew/googlefonts/variable-ttf/NotoSansHebrew%5Bwdth,wght%5D.ttf
```

and compressed to WOFF2 with nothing else done to it — no subsetting, no axis
pinning, no re-hinting:

```python
from fontTools.ttLib import TTFont

font = TTFont("NotoSansHebrew[wdth,wght].ttf")
font.flavor = "woff2"
font.save("noto-sans-hebrew-variable.woff2")
```

`fontTools[woff]` is not a dependency of this project and must not become one.
The conversion is a one-off; the result is the artefact under version control.

## Why the file is here rather than fetched

`src/app/layout.tsx` used to call `next/font/google`, which downloads the
stylesheet and five `.woff2` subsets during `next build`. That put
`fonts.gstatic.com` on the critical path of every build — local, CI and the
Vercel deployment — and on 2026-08-12 a runner was served a stale stylesheet
whose five files had all been replaced. Every one returned 404 and the build
failed on `Module not found: Can't resolve
'@vercel/turbopack-next/internal/font/google/font'`, which says nothing about
fonts or networks. `npm run lint:fonts` now fails if `next/font/google` comes
back.

The five subsets were split by `unicode-range` so a page loads only the ranges
it uses. This one file is their union: every codepoint the three non-empty
subsets carried (Hebrew 148, Latin 208, Latin Extended 114) is present, and the
two remaining subsets — Cyrillic and Greek — were 1 196-byte stubs, because
Noto Sans Hebrew has no glyphs for either. `next/font/local` cannot express
`unicode-range` per source file, and a product that renders Hebrew and digits
side by side was fetching the Hebrew and Latin subsets on every page anyway.

## Replacing it

Re-run the two steps above against a newer upstream tag, then update the
version, byte count and hash in this file. Check the result before committing:

```bash
npm run lint:fonts && npm run build
```
