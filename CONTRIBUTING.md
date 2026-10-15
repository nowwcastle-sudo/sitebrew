# Contributing to Sitebrew

Thanks for taking the time to help. Sitebrew is a small project, and every bug report, idea and pull request is welcome.

## Ways to help

- **Report a bug.** Open an issue with what you did, what you expected and what happened. The output of `/sitebrew:doctor` helps a lot. Remove any key values first.
- **Suggest an idea.** Open an issue and describe the site or the problem you have in mind.
- **Add a recipe or a block.** The steps are in [docs/guides/add-recipe.md](docs/guides/add-recipe.md).
- **Translate.** The READMEs come in five languages. Fixes to any of them are welcome.

For a large change, please open an issue first so we can agree on the direction before you spend time on it.

## The repository

| Path | What it is |
|---|---|
| `registry/`, `factory/` | The site factory (web-factory): parts, style axes, recipes, blocks and the stamping tools |
| `launch-factory/` | The back-end kit: sign-up, payments, email and analytics |
| `plugins/sitebrew/` | The Claude Code and Codex plugin |
| `packages/create-sitebrew/` | The `npx create-sitebrew` installer |

The full guide for agents and contributors is [docs/agents/agent-guide.md](docs/agents/agent-guide.md).

## Set up

You need Node 24.13.0 or newer, npm and Git. Sitebrew is built and tested on Windows 10 and 11.

```bash
git clone https://github.com/nowwcastle-sudo/sitebrew.git
cd sitebrew
npm run setup
npm run dev
```

`npm run setup` checks your environment and installs the dependencies. `npm run dev` opens the inspection bench, where you can see the parts and blocks one by one.

For the back-end kit, work inside its folder:

```bash
cd launch-factory
npm ci
npm test
```

## Make a change

- **Edit sources, not generated files.** After you change a source, run `npm run gen:all`. `npm run check:regen` tells you if a generated file is out of date.
- **No fixed shape values in parts or blocks.** Radius, spacing and color come from the style-axis hooks.
- **No real brand or company names** in recipes, archetypes or sample copy. Use an invented name marked as an example.
- **Never commit a key.** Keys live in environment variables. Code and docs only check whether a key is set.
- **Plugin changes need a new version.** If you change a file in `plugins/sitebrew/`, raise the version with `node ci/bump-version.mjs X.Y.Z`. Claude Code updates an installed plugin only when the number goes up, and the `version-bump` check reminds you.

## Before you open a pull request

Run the same check the CI runs:

```bash
npm run ci:verify
```

If you changed `launch-factory/`, also run `npm run ci:verify` inside that folder.

Then open the pull request with a short description of what changed and why. For a visual change, a screenshot helps. Keep each pull request to one topic. The CI must be green before a merge.

## Security

Please do not put the details of a security problem in a public issue. Open an issue that only says you found one, and a maintainer will contact you.

## License

By contributing, you agree that your contribution is licensed under the [MIT License](LICENSE).
