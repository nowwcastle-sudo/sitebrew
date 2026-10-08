// windowsUserEnv: the Windows user-environment fallback is opt-in (FACTORY_USER_ENV=1). Default: nothing is read from it.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readSecret, readSecrets, windowsUserEnv } from "../src/index.ts"

function withEnv(patch, fn) {
  const saved = {}
  for (const k of Object.keys(patch)) {
    saved[k] = process.env[k]
    if (patch[k] === undefined) delete process.env[k]
    else process.env[k] = patch[k]
  }
  try {
    return fn()
  } finally {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  }
}

test("default: windowsUserEnv reads nothing, even for a name that exists in the Windows user environment (PATH)", () => {
  withEnv({ FACTORY_USER_ENV: undefined, LF_NO_USER_ENV: undefined }, () => {
    assert.deepEqual(windowsUserEnv(["PATH"]), { PATH: null })
  })
})

test("default: FACTORY_USER_ENV=0 is also off", () => {
  withEnv({ FACTORY_USER_ENV: "0", LF_NO_USER_ENV: undefined }, () => {
    assert.deepEqual(windowsUserEnv(["PATH"]), { PATH: null })
  })
})

test("LF_NO_USER_ENV=1 wins over the opt-in", () => {
  withEnv({ FACTORY_USER_ENV: "1", LF_NO_USER_ENV: "1" }, () => {
    assert.deepEqual(windowsUserEnv(["PATH"]), { PATH: null })
  })
})

test("the injected reader is still used by readSecret / readSecrets (callers decide)", () => {
  assert.equal(readSecret("FACTORY_TEST_KEY", {}, () => "injected"), "injected")
  assert.deepEqual(readSecrets(["FACTORY_TEST_KEY"], {}, () => ({ FACTORY_TEST_KEY: "injected" })), { FACTORY_TEST_KEY: "injected" })
})
