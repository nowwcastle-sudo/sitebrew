// Preloaded by `npm test` (node --test --import): tests never read this machine's Windows user environment.
// Real keys stored there (PADDLE_API_KEY etc.) would otherwise hide every "missing key" test (REGFIX 10-04 — readSecrets falls
// back to the user environment). A test that needs the fallback sets LF_NO_USER_ENV itself.
process.env.LF_NO_USER_ENV ??= "1"
