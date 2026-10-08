// readSecret: the Windows user-environment fallback is opt-in (FACTORY_USER_ENV=1). Default: process environment only.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readSecret } from '../lib/secret-env.mjs'

const calls = []
const fakeUser = (name) => { calls.push(name); return 'from-user-env' }

test('process environment wins and the user-environment reader is not called', () => {
  calls.length = 0
  assert.equal(readSecret('FACTORY_TEST_KEY', { FACTORY_TEST_KEY: ' abc ', FACTORY_USER_ENV: '1' }, fakeUser), 'abc')
  assert.equal(calls.length, 0)
})

test('default (flag unset): a missing key stays missing, the user-environment reader is never called', () => {
  calls.length = 0
  assert.equal(readSecret('FACTORY_TEST_KEY', {}, fakeUser), null)
  assert.equal(readSecret('FACTORY_TEST_KEY', { FACTORY_USER_ENV: '0' }, fakeUser), null)
  assert.equal(calls.length, 0)
})

test('opt-in (FACTORY_USER_ENV=1): the user-environment reader is used for a missing key', () => {
  calls.length = 0
  assert.equal(readSecret('FACTORY_TEST_KEY', { FACTORY_USER_ENV: '1' }, fakeUser), 'from-user-env')
  assert.deepEqual(calls, ['FACTORY_TEST_KEY'])
})

test('invalid names are rejected before anything is read', () => {
  assert.throws(() => readSecret("bad'name", { FACTORY_USER_ENV: '1' }, fakeUser), /대문자·숫자·밑줄/)
})
