---
name: deliver
description: Copies the chosen site candidate from a Sitebrew run into the user's own folder, writes a README (Korean then English) with the run commands and the list of things to fix before publishing, and can make an online preview link when a Vercel login or token exists. Safe for folder paths with spaces and Korean characters. Use when the user is happy with a candidate and wants the files. Trigger phrases - "deliver the site", "give me the files", "export the site", "copy it to my folder", "사이트 넘겨줘", "파일로 받고 싶어", "내 폴더에 저장", "미리보기 링크".
---

# Deliver the chosen site

Reply in the user's language. Run from the `sitebrew` folder. The run must have the chosen candidate built to step 06 (the `new` skill, step 5).

## 1. Ask for the target folder

- It must **not exist or must be empty**. The tool never overwrites the user's files and refuses a target inside the run folder.
- Spaces and non-ASCII characters are fine (for example `C:\Users\홍 길동\내 사이트`). Keep the quotes around the path.

## 2. Copy

```bash
node factory/stamp/deliver.mjs --run out/my-site --pick a --to "<target folder>"
```

The tool prints the target, the number of files copied, the run command, and `공개하기 전에 해결할 것 N건` when blockers exist. It leaves out `node_modules`, `.next`, `.vercel`, `.turbo`, `.env*` and `*.tsbuildinfo`. The README it writes lists the same blockers.

The blockers come from the last quality check (step 07) of that candidate. After a `revise`, step 07 runs again only when the stamp command gets past the legal-review wait; while it still waits there (exit code 3), the list can describe the site before the change. Say this to the user when a revise was applied after the last full run.

Report to the user: the folder, the run command from the output (`cd` into the folder, `npm install`, `npm run dev`; Node 20.9 or newer for the delivered site), and the **blockers in plain words**. In preview mode these always include placeholder images and unverified legal pages. Do not hide them and do not call the site publishable while the list is not empty.

## 3. Online preview link (optional)

```bash
node factory/stamp/deliver.mjs --run out/my-site --pick a --to "<target folder>" --deploy-preview
```

- Only a **preview** deployment is ever made. A production deployment is refused before anything runs.
- It needs a Vercel login (`vercel login`) or the `VERCEL_TOKEN` environment variable. Without either, the tool prints `미리보기 배포 건너뜀` and still finishes the copy. That is not a failure.
- Never ask for the token in the chat. Tell the user which variable name to set.
- If the deployment fails, the copy is still done. The tool exits with code 1 and prints the reason with the token masked. Report that line.

## Product sites (saas, pwa)

The README adds a short launch-factory hookup note for these. Starting that back end is a separate job: follow `references/launch-factory.md` of the `guide` skill and begin in mock mode.
