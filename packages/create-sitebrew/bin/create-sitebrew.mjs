#!/usr/bin/env node
// npm needs the node shebang above; on Windows npm writes a .cmd shim that runs this file.
// Source: https://docs.npmjs.com/cli/v11/configuring-npm/package-json#bin
// `npm init sitebrew` / `npm create sitebrew` run the package named create-sitebrew (npm exec).
// Source: https://docs.npmjs.com/cli/v11/commands/npm-init
import { main } from '../lib/cli.mjs'

process.exitCode = await main(process.argv.slice(2))
