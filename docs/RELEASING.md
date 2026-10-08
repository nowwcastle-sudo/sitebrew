# Releasing

This is the only release guide of the repository. One tag `vX.Y.Z` releases everything in it: web-factory (the repository root), `launch-factory/`, `plugins/sitebrew`, `packages/create-sitebrew`, `install.ps1` and both marketplace files. There is one version number; `ci/check-single-version.mjs` fails when any place names another one.

Cut a version `X.Y.Z` from `main`, top to bottom. If one step fails, do not tag.

The shadcn CLI reads dependency addresses without a tag from the default branch, so regenerate everything for the new tag before you tag.

1. **Bump the version everywhere.** `node ci/bump-version.mjs X.Y.Z`. It writes the root and `launch-factory/` package files and lock files, both plugin manifests, both marketplace files, `packages/create-sitebrew/package.json` and a new `guides` entry in `plugins/sitebrew/compat.json`, then runs the check. Do not edit those numbers by hand.
2. **Regenerate with the tag pinned.** Run `npm run gen:all`, then `npm run registry:pincheck -- vX.Y.Z`. If you changed files under `registry/factory/`, commit that change first, then update the launch kit's locks from the commit: in `launch-factory/`, `node packages/contract/sync-contract.mjs --from .. --ref <commit hash>` and `node scripts/template-sync.mjs blocks --from .. --ref <commit hash>`. The launch kit's checks compare file hashes with the files in this repository, not commit names. Commit the regenerated files together with the bump.
3. **Update the README in all five languages, in both places.** The root `README*.md` and `launch-factory/README*.md` each exist in five languages: `README.md` (English, default), `.ko`, `.zh-CN`, `.es` and `.ja`. Add the new release row at the top of each release history table. Code blocks must stay byte-identical across the five files. Then run `npm run readme:check -- --tag vX.Y.Z` in the root and in `launch-factory/`.
4. **Check the single version.** `node ci/check-single-version.mjs --tag vX.Y.Z` must print `ok`.
5. **Run the gates.** In the root, `npm run ci:verify` must exit 0. In `launch-factory/`, `npm run ci:verify`, `npm run conformance` and `npm run template:verify` must all exit 0. For the plugin, `node --test "plugins/sitebrew/test/*.test.mjs"` must exit 0 (Node 24 does not take a folder after `--test`: pass the glob).
6. **Commit and tag.** `git commit -m "chore(release): vX.Y.Z"`, then `git tag -a vX.Y.Z -m "<summary>"`. Write the tag summary in the same words as the release history row.
7. **Push.** `git push origin main`, then `git push origin vX.Y.Z`.
8. **Publish the packages.** Publish the `@launch-factory/*` packages and `create-sitebrew` only after the tag is pushed and you have checked the result.
9. **Test data cleanup (once per release gate).** In `launch-factory/`, `node scripts/test-data/list.mjs` writes a candidate list for your own preview project. Review the list before you pass it to `node scripts/test-data/clean.mjs`.
