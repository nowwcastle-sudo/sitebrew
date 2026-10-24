# web-factory at `v0.2.0`

## Get the repository

```bash
git clone --branch v0.2.0 --depth 1 https://github.com/nowwcastle-sudo/sitebrew.git
cd sitebrew
npm run setup
npm run check:regen
npm run registry:pincheck -- v0.2.0
npm run typecheck
npm run dev
```

- `npm run setup` checks the environment and runs `npm ci` when `node_modules` is missing or out of date. A missing required item gives exit code 1 and a last line `setup: FAIL`.
- `npm run check:regen` regenerates every generated file and fails if `git diff` shows a change or a new file appears. Run it on a committed tree.
- `npm run dev` starts the inspection bench. Open http://localhost:3000/qa/base.
- Chrome is optional. Render gates such as `qa:a11y`, `qa:page-visual` and `blocks:gates` need it. Put the executable path in `CHROME_PATH` if it is not in the default place.
- The heavy gates (build, block matrix, visual regression) need about 3 GB of free memory.

## Use Sitebrew as a registry

Run the commands in the project you are installing into.

```bash
npx shadcn@4.21.0 init -t next -b base -p nova -n <project-name> -y --no-monorepo
npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/factory-default#v0.2.0 -y -o
npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/factory-base#v0.2.0 -y -o
npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/alert-dialog#v0.2.0 -y -o
```

- Pass every option to `init` so it does not stop at a prompt.
- Add the theme (`factory-default`) and the baseline rules (`factory-base`) first, then the parts.
- Always add `-y -o` to `add`. `init` creates the official `button.tsx` first, and `-o` lets this registry overwrite it. Without `-o` the command stops at the overwrite prompt, writes nothing in a non-interactive shell and still exits 0.
- Item names match the file names in `registry/factory/ui/` (`alert-dialog`, `button`, `dialog`, and so on). Other items are `utils` (lib) and `use-mobile` (hooks).
- This registry is public, so `add` needs no sign-in. A private copy of it needs read access set up in your CI provider's secret settings.
- A recipe installs its typefaces as `font-<name>` items. Typeface files are not stored in the repository; the licenses and primary sources are in `docs/qa/font-licenses.md`.

## Stamp a site

`stamp` turns a one-line brief into three direction candidates, completes the one you pick, and builds a preview.

Prerequisites:

1. Node `>=24.13.0`, npm `>=11.6.2`, `npm run setup` finished.
2. Nothing else is required. `LAW_API_OC` (open.law.go.kr Open API ID), `PEXELS_API_KEY` and `HIGGSFIELD_DIR` (an existing directory) are optional. When one is missing, `node factory/doctor.mjs --stage stamp` prints a note with a Korean line and an English line (what turns off) and exits 0, and `stamp` builds in preview mode: stock photo slots stay "image in progress" placeholders, generated-image slots become `higgsfield.request.json` requests, legal pages stay "unverified" and the site is marked not publishable. The maintainers' generated-video folder is not part of the repository.
3. A key that is set but wrong, or a `HIGGSFIELD_DIR` that points to nothing, still fails. An operator who wants missing keys to fail too sets `WF_REQUIRE_KEYS=1` or passes `--strict`.
4. Run `node factory/doctor.mjs --stage stamp`. If it exits 1, `stamp` does not start. The doctor never prints a key value.

```bash
node factory/doctor.mjs --stage stamp
npm run stamp -- --brief factory/stamp/briefs/saas-ko.json --run out/my-run --until 04
```

- Briefs are JSON files. Read an example in `factory/stamp/briefs/` and copy its shape. Do not invent fields.
- Flags: `--brief <file>` or `--golden <id>` / `--all-golden`, `--run <dir>`, `--until <01..08>`, `--pick a|b|c`, `--deploy-preview` (only together with `--pick`).
- Steps: 01 direction, 02 sitemap, 03 variants, 04 copy, 05 media, 06 pages, legal review (only for the picked candidate), 07 gates, 08 board.
- Without `--pick` all three candidates run to step 08 and a board file is written. With `--pick` only that candidate is completed.
- A finished step is skipped on re-run when its input hash is unchanged. If the command stops, run the same command again.
- The script never calls a language model. For copy (step 04) and legal pages it writes a request file, prints the path and exits with code 3. Write the answer by following `factory/stamp/COPY.md` or `factory/legal/AGENT.md`, then run the same command again.
- Exit codes: 0 done up to the requested step, 1 a gate or tool failed (`<run>/stamp-summary.json` has the `status`), 2 argument error, 3 waiting for agent or human input.
- Step 05 (media) uses the Pexels key and `HIGGSFIELD_DIR` when they exist, and otherwise leaves placeholders and requests. The public repository does not ship media files. Check its output before you publish anything.
