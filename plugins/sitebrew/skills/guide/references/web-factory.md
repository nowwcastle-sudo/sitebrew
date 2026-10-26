# web-factory at `v0.2.4`

## Get the repository

```bash
git clone --branch v0.2.4 --depth 1 https://github.com/nowwcastle-sudo/sitebrew.git
cd sitebrew
npm run setup
npm run check:regen
npm run registry:pincheck -- v0.2.4
npm run typecheck
npm run dev
```

- `npm run setup` checks the environment and runs `npm ci` when `node_modules` is missing or out of date. A missing required item gives exit code 1 and a last line `setup: FAIL`.
- `npm run check:regen` regenerates every generated file and fails if `git diff` shows a change or a new file appears.
- `npm run dev` starts the inspection bench. Open http://localhost:3000/qa/base.
- Chrome is optional. Render gates such as `qa:a11y`, `qa:page-visual` and `blocks:gates` need it. Put the executable path in `CHROME_PATH` if it is not in the default place.
- The heavy gates (build, block matrix, visual regression) need about 3 GB of free memory.

## Use Sitebrew as a registry

Run the commands in the project you are installing into.

```bash
npx shadcn@4.22.1 init -t next -b base -p nova -n <project-name> -y --no-monorepo
npx shadcn@4.22.1 add nowwcastle-sudo/sitebrew/factory-default#v0.2.4 -y -o
npx shadcn@4.22.1 add nowwcastle-sudo/sitebrew/factory-base#v0.2.4 -y -o
npx shadcn@4.22.1 add nowwcastle-sudo/sitebrew/alert-dialog#v0.2.4 -y -o
```

- Skip `init` when the project already has `components.json`: it is already configured. Run only the `add` lines.
- Pass every option to `init` so it does not stop at a prompt.
- Add the theme (`factory-default`) and the baseline rules (`factory-base`) first, then the parts.
- Add `-y -o` to every `add`. `init` creates the official `button.tsx` first, and `-o` lets this registry overwrite it.
- Replace `<project-name>` with the folder name of the new project. For another item, take its name from the folder `registry/factory/ui/` of the repository at tag `v0.2.4` on GitHub: the names match its file names (`alert-dialog`, `button`, `dialog`, and so on). Other items are `utils` (lib) and `use-mobile` (hooks).
- This registry is public, so `add` needs no sign-in. A private copy of it needs read access set up in your CI provider's secret settings.
- A recipe installs its typefaces as `font-<name>` items. Typeface files are not stored in the repository; the licenses and primary sources are in `docs/qa/font-licenses.md`.

## Stamp a site

`stamp` turns a one-line brief into three direction candidates, completes the one you pick, and builds a preview.

Prerequisites:

1. Node `>=24.13.0`, npm `>=11.6.2`, `npm run setup` finished.
2. Nothing else is required. `LAW_API_OC` (open.law.go.kr Open API ID), `PEXELS_API_KEY` and `HIGGSFIELD_DIR` (an existing directory) are optional. When one is missing, `node factory/doctor.mjs --stage stamp` prints a note with a Korean line and an English line (what turns off) and exits 0, and `stamp` builds a preview-only site: photo slots stay placeholders, legal pages stay "unverified", the site is not publishable.
3. A key that is set but wrong, or a `HIGGSFIELD_DIR` that points to nothing, still fails. An operator who wants missing keys to fail too sets `WF_REQUIRE_KEYS=1` or passes `--strict`.
4. Run `node factory/doctor.mjs --stage stamp`. If it exits 1, `stamp` does not start.

Replace `--brief factory/stamp/briefs/saas-ko.json` with the user's brief file and `--run out/my-run` with a new folder for each brief (a finished step is skipped when its input is unchanged, so a new folder rebuilds everything). `--pick` takes the letter `a`, `b` or `c` of the candidate the user chose.

```bash
node factory/doctor.mjs --stage stamp
npm run stamp -- --brief factory/stamp/briefs/saas-ko.json --run out/my-run --until 04
```

- Briefs are JSON files. Read an example in `factory/stamp/briefs/` and copy its shape.
- Flags: `--brief <file>` or `--golden <id>` / `--all-golden`, `--run <dir>`, `--until <01..08>`, `--pick a|b|c`, `--deploy-preview` (only together with `--pick`).
- Steps: 01 direction, 02 sitemap, 03 variants, 04 copy, 05 media, 06 pages, legal review (only for the picked candidate), 07 gates, 08 board.
- Without `--pick` all three candidates run to step 08 and a board file is written. With `--pick` only that candidate is completed.
- A finished step is skipped on re-run when its input hash is unchanged. If the command stops, run the same command again.
- The script never calls a language model. For copy (step 04) and legal pages it writes a request file, prints the path and exits with code 3. Write the answer by following `factory/stamp/COPY.md` or `factory/legal/AGENT.md`, then run the same command again.
- Exit codes: 0 done up to the requested step, 1 a gate or tool failed (`<run>/stamp-summary.json` has the `status`), 2 argument error, 3 waiting for agent or human input.
- Step 05 (media) uses the Pexels key and `HIGGSFIELD_DIR` when they exist; otherwise stock photo slots stay "image in progress" placeholders and generated-image slots become `higgsfield.request.json` requests. Check its output before you publish anything.
