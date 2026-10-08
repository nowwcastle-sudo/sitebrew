// POSIX 셸 찾기 — .githooks/* 는 `#!/bin/sh` 스크립트라 시험이 셸을 직접 돌린다(scripts/test/githooks.test.mjs).
// Windows 의 PowerShell 에는 PATH 에 sh 가 없다(Git for Windows 는 cmd\ 만 PATH 에 올린다). 그래서 ① PATH 의 sh ② `git --exec-path`
// 로 찾은 Git for Windows 설치 폴더의 bin\sh.exe · usr\bin\sh.exe ③ PATH 의 git.exe 옆 설치 폴더 ④ ProgramFiles\Git 순으로 찾는다.
// 못 찾으면 null — 부르는 쪽이 이유를 적어 건너뛴다(Linux·macOS CI 에는 항상 PATH 에 sh 가 있다).
import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { delimiter, join, resolve } from "node:path"

const works = (sh) => spawnSync(sh, ["-c", "exit 0"], { stdio: "ignore" }).status === 0
const underGitRoot = (root) => [join(root, "bin", "sh.exe"), join(root, "usr", "bin", "sh.exe")]

/** 실제로 `sh -c "exit 0"` 이 되는 셸 실행 파일(이름 또는 경로). 없으면 null */
export function findSh() {
  if (works("sh")) return "sh"
  if (process.platform !== "win32") return null
  const roots = []
  // Git for Windows: <설치 폴더>\mingw64\libexec\git-core → 세 단계 위가 설치 폴더
  const ep = spawnSync("git", ["--exec-path"], { encoding: "utf8" })
  if (ep.status === 0 && ep.stdout.trim()) roots.push(resolve(ep.stdout.trim(), "..", "..", ".."))
  // PATH 의 git.exe 위치: …\Git\cmd · …\Git\bin · …\Git\mingw64\bin
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (!dir || !existsSync(join(dir, "git.exe"))) continue
    roots.push(resolve(dir, ".."), resolve(dir, "..", ".."))
  }
  for (const base of [process.env.ProgramFiles, process.env["ProgramFiles(x86)"], process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "Programs")]) {
    if (base) roots.push(join(base, "Git"))
  }
  for (const root of roots) for (const sh of underGitRoot(root)) if (existsSync(sh) && works(sh)) return sh
  return null
}
