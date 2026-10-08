# Third-party notices

This file lists third-party material that web-factory derives from or depends on. Every entry was checked on 2026-10-08 against
the license field in `package-lock.json`, the license file shipped inside the installed npm package, or
`gh api repos/<owner>/<repo> --jq .license.spdx_id`. Nothing here is legal advice; read each license yourself before you redistribute.

web-factory itself is MIT-licensed (see `LICENSE`).

## Derived from shadcn/ui (MIT)

The parts in `registry/factory/ui-src/` start from the shadcn/ui component set (rebuilt on Base UI with this repository's baseline rules).
Verified: GitHub reports `shadcn-ui/ui` as MIT, and the `shadcn` npm package used by this repository ships the same license:

```text
MIT License

Copyright (c) 2023 shadcn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Dependencies with a license other than MIT, ISC, BSD or Apache-2.0

From `package-lock.json` (863 packages). Only these differ:

| Package | Version | License (as declared) | Role |
|---|---|---|---|
| `gsap` | 3.15.0 | "Standard 'no charge' license" (https://gsap.com/standard-license) | Production dependency of the motion kit. Not MIT. Read the GSAP license before you ship a site that uses it. |
| `pretendard`, `pretendard-gov` | 1.3.9 | OFL-1.1 | Typeface npm packages that the `font-pretendard*` items install into a consumer project. No font file is stored in this repository. |
| `@img/sharp-libvips-*` (10 platform packages) and `@img/sharp-*` (wasm32, win32-*) | 1.3.4 / 0.35.5 | LGPL-3.0-or-later (some combined with Apache-2.0 and MIT) | Optional, dev-only platform binaries that npm pulls in for `sharp`. They are not part of this repository's source. |
| `axe-core` | 4.13.0 | MPL-2.0 | Dev-only accessibility test engine. |
| `lightningcss` and its platform packages | 1.32.0 | MPL-2.0 | Dev-only CSS tool. |
| `caniuse-lite` | 1.0.30001812 | CC-BY-4.0 | Browser-support data used by build tooling. |

## Typefaces

Font files are not stored in this repository. The `font-*` registry items point to npm packages or Google Fonts sources.
Their licenses and primary sources are listed in `docs/qa/font-licenses.md` (the project's own table; re-check a typeface at its primary source before you rely on it commercially).

## Media and textures

The public export leaves out all stock-photo, generated-video and photo-texture assets that were part of the private repository, because their redistribution terms are not confirmed.
`public/media/manifest.json` and `public/media/credits.json` are empty in this export. `npm run media:fetch` (needs your own `PEXELS_API_KEY`, see `README.md`) downloads photos under Pexels' own terms. The two self-made grain masks in `references/textures/` and `public/textures/` are the only texture files that remain.
