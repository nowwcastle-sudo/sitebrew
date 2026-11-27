// 로그 원문은 인증 쿼리·쿠키를 포함할 수 있다. 고정된 오류 분류만 출력한다.
export function serverFailureClasses(logs) {
  const checks = [
    [/Cannot apply unknown utility class/i, "tailwind_unknown_utility"],
    [/Cannot find (?:module|package)/i, "module_not_found"],
    [/ENOENT/i, "file_not_found"],
    [/EADDRINUSE/i, "port_in_use"],
    [/Failed query/i, "database_query_failed"],
    [/migration file/i, "migration_file_error"],
    [/SyntaxError/i, "syntax_error"],
    [/TypeError/i, "type_error"],
    [/ECONNREFUSED/i, "connection_refused"],
  ]
  return checks.filter(([pattern]) => pattern.test(logs)).map(([, label]) => label)
}

export function httpFailure(stage, actual, expected) {
  if (!/^[a-z0-9_-]+$/.test(stage) || !Number.isInteger(actual) || !Number.isInteger(expected)) throw new Error("Invalid diagnostic input")
  const error = new Error(`HTTP ${stage}: expected ${expected}, got ${actual}`)
  error.name = "TossHttpDiagnostic"
  return error
}

// Playwright 오류 원문에는 쿠키가 들어갈 수 있다.
export function clientFailureClass(error) {
  const message = error instanceof Error ? error.message : ""
  if (/timeout|timed out/i.test(message)) return "request_timeout"
  if (/ECONNREFUSED/i.test(message)) return "connection_refused"
  if (/ECONNRESET|socket hang up/i.test(message)) return "connection_reset"
  return "unclassified"
}
