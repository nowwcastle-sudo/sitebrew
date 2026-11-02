# Sitebrew installer for Windows (PowerShell 5.1 and PowerShell 7).
#   irm https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/v0.2.5/get.ps1 | iex
#   & ([scriptblock]::Create((irm https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/v0.2.5/install.ps1).TrimStart([char]0xFEFF))) -Tool codex -WhatIf
#   .\install.ps1 [-Tool claude|codex|both] [-Folder <path>] [-Yes] [-WhatIf]
# (This file starts with a BOM so Windows PowerShell 5.1 reads the Korean text when it runs as a file. A downloaded string keeps that BOM, so the
#  one-line form goes through get.ps1 - plain ASCII - which removes it. The scriptblock form removes it itself with TrimStart.)
# What it does, in this order: (1) check Git and Node.js (and npm) - if one is missing it says why, asks "[Y/n]" and installs it with winget only after you agree;
# (2) pick the agent you will use (Claude Code, Codex or both) and check that the CLI exists - same ask-first rule;
# (3) get the Sitebrew repository at the release tag (skipped when this file already sits inside a clone), then ask whether to remember its folder in SITEBREW_DIR;
# (4) install the plugin into the chosen agent; (5) run the doctor; (6) print the one thing to do next - only when everything above worked.
# -Yes answers every question with yes (the only way to skip a question). -WhatIf changes nothing: it prints what it would ask and run.
# It refuses to start in an administrator window (the install would go into the administrator profile) and with a target folder under Windows or Program Files.
# Exit codes (the window itself is never closed when the file is run through irm | iex; there the code is in $LASTEXITCODE):
#   0 done / preview   1 a download, clone or plugin command failed   2 a wrong option or folder   3 something is missing or needs your answer   4 refused to start
# Sources (checked 2026-10-12): winget IDs with `winget show --id <id> -e --source winget`; winget flags with `winget install --help`;
# Claude Code plugin commands https://code.claude.com/docs/en/plugins/cli-reference ; Codex `codex plugin marketplace add` / `codex plugin add` from `codex plugin --help`
# (docs: https://developers.openai.com/plugins/build/plugins). No syntax newer than Windows PowerShell 5.1 is used (no &&, ??, ternary).
# Test hooks (tests only): SITEBREW_REGISTRY_PATH replaces the PATH read from the registry after an install; SITEBREW_TEST_USERENV names a file that
# receives NAME=value lines instead of the user's environment variables; SITEBREW_TEST_ADMIN=1 pretends the window is an administrator window (it can only add the stop).
param(
  [string]$Tool = 'ask',
  [string]$Folder = '',
  [string]$Owner = 'nowwcastle-sudo',
  [string]$Tag = 'v0.2.5',
  [switch]$Yes,
  [switch]$WhatIf
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

# The requirement table (also packages/create-sitebrew/lib/requirements.json) - one source, written into this file by the export.
$RequirementsJson = @'
{"tools":[{"id":"git","required":true,"cmd":["git","--version"],"min":null,"winget":"Git.Git","download":"https://git-scm.com/download/win","why":{"ko":"Git for Windows - Sitebrew 를 고정 태그로 내려받는 데 필요해요.","en":"Git for Windows - needed to download Sitebrew at its release tag."}},{"id":"node","required":true,"cmd":["node","--version"],"min":"24.13.0","winget":"OpenJS.NodeJS.LTS","download":"https://nodejs.org/en/download","why":{"ko":"Node.js 24.13.0 이상 - 사이트를 만드는 도구가 Node 로 돌아요.","en":"Node.js 24.13.0 or newer - the site tools run on Node."}},{"id":"npm","required":true,"cmd":["npm","--version"],"min":"11.6.2","winget":null,"download":"https://nodejs.org/en/download","why":{"ko":"npm 11.6.2 이상 - Node 와 함께 와요. 낮으면 npm install -g npm@latest 를 직접 실행해요.","en":"npm 11.6.2 or newer - ships with Node. If it is older, run npm install -g npm@latest yourself."}},{"id":"claude","required":false,"cmd":["claude","--version"],"min":null,"winget":"Anthropic.ClaudeCode","download":"https://code.claude.com/docs/en/setup","why":{"ko":"Claude Code (선택) - 사이트 문구를 쓰고 대화로 만드는 에이전트예요. Claude Code 나 Codex 중 하나는 있어야 사이트를 만들 수 있어요.","en":"Claude Code (optional) - the agent that writes the site copy and runs the conversation. You need Claude Code or Codex to make a site."}},{"id":"codex","required":false,"cmd":["codex","--version"],"min":null,"winget":"OpenAI.Codex","download":"https://github.com/openai/codex","why":{"ko":"Codex CLI (선택) - Claude Code 대신 쓸 수 있는 에이전트예요. Claude Code 나 Codex 중 하나는 있어야 사이트를 만들 수 있어요.","en":"Codex CLI (optional) - an agent you can use instead of Claude Code. You need Claude Code or Codex to make a site."}}],"wingetInstall":["install","--id","<id>","-e","--source","winget","--accept-package-agreements","--accept-source-agreements","--scope","user"],"wingetInstallFallback":"retry the same command without `--scope user` when the user-scope install fails (some installers support machine scope only; Windows may then show an administrator prompt)"}
'@
$Req = $RequirementsJson | ConvertFrom-Json

function Say([string]$ko, [string]$en) {
  Write-Host $ko
  Write-Host "  $en" -ForegroundColor DarkGray
}

function Test-Windows {
  return ($env:OS -eq 'Windows_NT')
}

# True in a window that was started "as administrator". SITEBREW_TEST_ADMIN=1 only ever turns this on (a test hook, never an escape).
function Test-IsAdmin {
  if ($env:SITEBREW_TEST_ADMIN -eq '1') { return $true }
  try {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    return ([Security.Principal.WindowsPrincipal]$id).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  } catch { return $false }
}

# A folder typed as "...\My Site\" (in quotes, ending in a backslash) reaches a -File script as ...\My Site" (the backslash escapes the closing quote): drop quotes and a trailing slash, keep a drive root.
function Format-FolderArg([string]$f) {
  $f = $f.Replace('"', '').Trim()
  if ($f -match '^[A-Za-z]:[\\/]*$') { return ($f.Substring(0, 2) + '\') }
  return $f.TrimEnd('\', '/')
}

# A command shown for pasting: an argument with a space (or a quote) goes in double quotes, so a folder such as <home> Gildong\sitebrew survives the paste
# (the npx installer prints its commands the same way).
function Format-CommandText($c) {
  $parts = @()
  foreach ($a in @($c)) {
    $s = [string]$a
    if ($s -match '[\s"]') { $parts += ('"' + $s + '"') } else { $parts += $s }
  }
  return ($parts -join ' ')
}

# Windows itself and Program Files are not a place for a project folder.
function Test-ProtectedFolder([string]$p) {
  foreach ($r in @($env:windir, $env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:ProgramW6432)) {
    if (-not $r) { continue }
    $root = $r.TrimEnd('\')
    if ($p.Equals($root, [StringComparison]::OrdinalIgnoreCase) -or $p.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase)) { return $true }
  }
  return $false
}

# A folder that OneDrive syncs: thousands of small files (node_modules) make it slow, and a sync lock can break the build.
function Test-OneDrivePath([string]$p) {
  if ($p -match '(?i)\\OneDrive') { return $true }
  foreach ($r in @($env:OneDrive, $env:OneDriveConsumer, $env:OneDriveCommercial)) {
    if (-not $r) { continue }
    $root = $r.TrimEnd('\')
    if ($p.Equals($root, [StringComparison]::OrdinalIgnoreCase) -or $p.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase)) { return $true }
  }
  return $false
}

# The answer to a "[Y/n]" question: Enter, y, yes, 예, 네, ㅇ mean yes; anything else means no.
function Test-YesAnswer([string]$a) {
  $t = $a.Trim()
  return ($t -eq '' -or $t -match '^(y|yes|예|네|ㅇ)$')
}

# A new PATH for this window: what the installers wrote to the registry. SITEBREW_REGISTRY_PATH replaces it in tests.
function Update-SessionPath {
  if ($env:SITEBREW_REGISTRY_PATH) { $env:Path = $env:SITEBREW_REGISTRY_PATH; return }
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}

# The installed version ([version]) or $null when the command is missing.
function Get-ToolVersion($t) {
  $cmd = Get-Command $t.cmd[0] -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $cmd) { return $null }
  # A warning on stderr (npm update notice, node deprecation) must not make an installed tool look missing: with 'Stop', Windows PowerShell
  # turns the first stderr line of `2>&1` into a terminating error. Inside this function only, errors are just output.
  $ErrorActionPreference = 'Continue'
  try {
    $rest = @()
    if ($t.cmd.Count -gt 1) { $rest = @($t.cmd[1..($t.cmd.Count - 1)]) }
    $out = (& $cmd.Source @rest 2>&1 | Out-String)
  } catch { return $null }
  if ($out -match '(\d+)\.(\d+)\.(\d+)') { return [version]('{0}.{1}.{2}' -f $Matches[1], $Matches[2], $Matches[3]) }
  return [version]'0.0.0'
}

# Every question goes through here: -WhatIf asks nothing, -Yes says yes, a redirected or closed stdin says no.
function Confirm-Action([string]$ko, [string]$en) {
  if ($WhatIf) {
    Write-Host "[WhatIf] would ask: $en"
    return $false
  }
  if ($Yes) {
    Write-Host "$ko -> yes (-Yes)"
    return $true
  }
  Write-Host $ko
  try {
    if ([Console]::IsInputRedirected) {
      Write-Host '  (no terminal to answer - treated as "no")'
      return $false
    }
    $a = Read-Host "  $en [Y/n]"
  } catch {
    Write-Host '  (no terminal to answer - treated as "no")'
    return $false
  }
  return (Test-YesAnswer $a)
}

# A question whose default is to go on (a warning, not a need): -WhatIf and -Yes go on, so does a closed stdin; only an explicit "n" stops.
function Confirm-Continue([string]$ko, [string]$en) {
  if ($WhatIf) {
    Write-Host "[WhatIf] would ask: $en"
    return $true
  }
  if ($Yes) { return $true }
  Write-Host $ko
  try {
    if ([Console]::IsInputRedirected) {
      Write-Host '  (no terminal to answer - going on)'
      return $true
    }
    $a = Read-Host "  $en [Y/n]"
  } catch { return $true }
  return (-not ($a.Trim() -match '^(n|no|아니오|아니요|ㄴ)$'))
}

function Get-Winget {
  return (Get-Command winget -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1)
}

# True when the tool is installed and not older than the minimum of the requirement table.
function Test-ToolOk($t) {
  $v = Get-ToolVersion $t
  if ($null -eq $v) { return $false }
  if ($t.min -and $v -lt [version]$t.min) { return $false }
  return $true
}

# winget: user scope first, then the machine default when the installer has no user scope. Returns $true when the tool is on PATH afterwards.
function Install-Tool($t) {
  $winget = Get-Winget
  $base = @('install', '--id', $t.winget, '-e', '--source', 'winget', '--accept-package-agreements', '--accept-source-agreements')
  if ($WhatIf) {
    Write-Host ('[WhatIf] would run: winget ' + ($base -join ' ') + ' --scope user')
    return $false
  }
  if (-not $winget) {
    Say "winget 이 없어서 자동 설치를 할 수 없어요. 이 주소에서 직접 설치한 뒤 새 PowerShell 창에서 다시 실행해요: $($t.download)" "winget was not found, so nothing is installed automatically. Install it from this page, then run this again in a new PowerShell window: $($t.download)"
    return $false
  }
  & $winget.Source @($base + @('--scope', 'user')) | Out-Host
  if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne -1978335189) {
    Say '사용자 범위 설치가 안 돼서 기본 범위로 한 번 더 시도해요(Windows 가 관리자 확인 창을 띄울 수 있어요).' 'The user-scope install failed; trying once more with the default scope (Windows may show an administrator prompt).'
    & $winget.Source @base | Out-Host
  }
  $code = $LASTEXITCODE
  Update-SessionPath
  return ((Test-ToolOk $t) -and ($code -eq 0 -or $code -eq -1978335189))
}

# Check one tool; ask and install when it is missing (or too old). Returns $true when it is usable afterwards.
function Confirm-Tool($t) {
  $v = Get-ToolVersion $t
  $min = $null
  if ($t.min) { $min = [version]$t.min }
  $ok = ($null -ne $v) -and ((-not $min) -or ($v -ge $min))
  if ($ok) {
    Write-Host ("ok   {0} {1}" -f $t.id, $v)
    return $true
  }
  $state = 'missing'
  if ($null -ne $v) { $state = "too old ($v)" }
  Write-Host ("{0} {1} {2}" -f $(if ($t.required) { 'NEED' } else { 'want' }), $t.id, $state)
  Say $t.why.ko $t.why.en
  if (-not $t.winget) {
    Say "자동 설치 대상이 아니에요. $($t.why.ko)" 'This one is not installed by this script - see the line above.'
    return $false
  }
  if (-not (Get-Winget)) {
    Say "winget 이 이 PC 에서 보이지 않아 자동 설치를 하지 않아요. 이 주소에서 직접 설치한 뒤 새 PowerShell 창에서 같은 명령을 다시 실행해요: $($t.download)" "winget was not found on this PC, so nothing is installed automatically. Install it from this page, then run the same command in a new PowerShell window: $($t.download)"
    return $false
  }
  $verb = 'install'
  if ($null -ne $v) { $verb = 'upgrade' }
  $q = if ($verb -eq 'install') { "설치할까요? ($($t.id): winget $($t.winget))" } else { "올릴까요? ($($t.id): winget $($t.winget))" }
  $qe = "$($verb.Substring(0,1).ToUpper())$($verb.Substring(1)) $($t.id) now with winget ($($t.winget))?"
  if ($WhatIf) {
    [void](Confirm-Action $q $qe)
    [void](Install-Tool $t)
    return $false
  }
  if (-not (Confirm-Action $q $qe)) {
    Say "$($t.id) 설치를 건너뛰어요." "Skipping $($t.id)."
    return $false
  }
  if (Install-Tool $t) { Write-Host ("ok   {0} {1}" -f $t.id, (Get-ToolVersion $t)); return $true }
  Say "$($t.id) 가 이 창에서는 아직 쓸 수 있는 판으로 보이지 않아요 (없거나 옛 판). 새 PowerShell 창을 열고 이 명령을 다시 실행해요." "$($t.id) is not available in this window yet (missing, or still the old version). Open a new PowerShell window and run this command again."
  return $false
}

function Get-Req([string]$id) { return ($Req.tools | Where-Object { $_.id -eq $id } | Select-Object -First 1) }

# One user environment variable. SITEBREW_TEST_USERENV (tests only) names a file that receives NAME=value lines instead.
function Save-UserEnv([string]$name, [string]$value) {
  if ($env:SITEBREW_TEST_USERENV) {
    [System.IO.File]::AppendAllText($env:SITEBREW_TEST_USERENV, "$name=$value`n", (New-Object System.Text.UTF8Encoding($false)))
    return
  }
  [Environment]::SetEnvironmentVariable($name, $value, 'User')
}

# After the clone: with a yes, keep the folder in SITEBREW_DIR so the doctor and the intake find it from any folder; with a no, say what to pass instead.
function Remember-KitFolder([string]$repo) {
  if ($env:SITEBREW_DIR -and $env:SITEBREW_DIR.TrimEnd('\') -eq $repo.TrimEnd('\')) { return }
  $ko = "이 Sitebrew 폴더($repo)를 사용자 환경 변수 SITEBREW_DIR 에 저장할까요? 저장하면 다른 폴더에서 Claude Code 나 Codex 를 열어도 도구가 이 폴더를 찾아요."
  $en = "Save this Sitebrew folder ($repo) in the user environment variable SITEBREW_DIR? Then the tools find it even when you open Claude Code or Codex in another folder."
  if ($WhatIf) { [void](Confirm-Action $ko $en); return }
  if (Confirm-Action $ko $en) {
    Save-UserEnv 'SITEBREW_DIR' $repo
    $env:SITEBREW_DIR = $repo
    Say 'SITEBREW_DIR 를 저장했어요. 새로 여는 창부터 적용돼요.' 'SITEBREW_DIR is saved. It applies to windows you open from now on.'
  } else {
    Say "저장하지 않았어요. 다른 폴더에서 열 때는 doctor 와 intake 에 --kit `"$repo`" 를 붙여요." "Not saved. When you open the agent in another folder, add --kit `"$repo`" to the doctor and intake commands."
  }
}

# ─────────────────────────────────────────────────────────────
function Invoke-Main {
  if (-not (Test-Windows)) {
    Say '이 설치 파일은 Windows 용이에요. 다른 운영체제는 README 의 설명을 따라요.' 'This installer is for Windows. On other systems follow the README.'
    return 1
  }
  if ($Owner -eq ('__' + 'OWNER__')) {
    Say '이 설치 안내는 아직 게시 전 판이에요. 아무것도 내려받지 않고 멈춰요. 게시된 저장소의 안내를 써요.' 'This installer is a version from before publication. Nothing was downloaded. Use the instructions in the published repository.'
    return 4
  }
  if (Test-IsAdmin) {
    Say '관리자 권한으로 연 PowerShell 창이에요. 설치가 관리자 계정의 폴더와 설정으로 들어가 버려서 멈춰요. 일반 PowerShell 창을 새로 열어 같은 명령을 다시 실행해요.' 'This PowerShell window runs as administrator. The install would go into the administrator profile, so it stops. Open a normal PowerShell window and run the same command again.'
    return 4
  }
  $chosen = $Tool.ToLower()
  if ($chosen -notin @('ask', 'claude', 'codex', 'both')) {
    Say "-Tool 은 claude, codex, both 중 하나예요 (받은 값: $Tool)." "-Tool must be claude, codex or both (got: $Tool)."
    return 2
  }

  # the target folder, checked before anything is installed
  $repo = ''
  $cloneNeeded = $true
  if ($PSScriptRoot -and (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'plugins\sitebrew\.claude-plugin\plugin.json'))) {
    $repo = $PSScriptRoot
    $cloneNeeded = $false
  } else {
    $f = ''
    if ($Folder) { $f = Format-FolderArg $Folder }
    if (-not $f) { $f = Join-Path (Get-Location).Path 'sitebrew' }
    try { $repo = [System.IO.Path]::GetFullPath($f) } catch {
      Say "폴더 이름을 읽을 수 없어요: $Folder" "The folder name cannot be used: $Folder"
      return 2
    }
    if (Test-ProtectedFolder $repo) {
      Say "이 폴더에는 설치하지 않아요 (Windows 나 Program Files 아래): $repo  -Folder 로 다른 폴더를 줘요." "Not installing into this folder (under Windows or Program Files): $repo - pass another one with -Folder."
      return 2
    }
  }
  Write-Host "Sitebrew $Tag installer"
  if ($WhatIf) { Write-Host '[WhatIf] nothing will be changed.' }

  # 1. environment
  $envOk = $true
  $missing = @()
  foreach ($id in @('git', 'node', 'npm')) {
    if (-not (Confirm-Tool (Get-Req $id))) { $envOk = $false; $missing += $id }
  }

  # 2. which agent
  if ($chosen -eq 'ask') {
    if ($Yes -or $WhatIf) { $chosen = 'claude' }
    else {
      Write-Host '사이트 문구를 쓰고 대화로 만드는 에이전트가 필요해요 (04 단계). 어느 것을 쓸까요?'
      Write-Host '  An agent is needed to write the site copy (step 04). Which one do you use?  1) Claude Code  2) Codex  3) both'
      $a = ''
      try { if (-not [Console]::IsInputRedirected) { $a = Read-Host '  [1/2/3]' } } catch { }
      $chosen = switch ($a.Trim()) { '2' { 'codex' } '3' { 'both' } default { 'claude' } }
    }
  }
  $agents = @()
  if ($chosen -eq 'claude' -or $chosen -eq 'both') { $agents += 'claude' }
  if ($chosen -eq 'codex' -or $chosen -eq 'both') { $agents += 'codex' }
  $agentOk = @{}
  foreach ($id in $agents) {
    $agentOk[$id] = (Confirm-Tool (Get-Req $id))
    if (-not $agentOk[$id]) { $missing += $id }
  }

  # 3. the repository
  if (-not $cloneNeeded) {
    Say "이 파일은 Sitebrew 폴더 안에 있어요: $repo" "This file already sits inside a Sitebrew folder: $repo"
  } else {
    $url = "https://github.com/$Owner/sitebrew.git"
    if (Test-Path -LiteralPath (Join-Path $repo 'plugins\sitebrew\.claude-plugin\plugin.json')) {
      Say "이미 내려받은 폴더를 써요: $repo" "Using the existing clone: $repo"
    } else {
      if (Test-OneDrivePath $repo) {
        Say "이 폴더는 OneDrive 가 동기화하는 위치예요: $repo  파일이 수천 개 생겨 느려지고, 동기화 잠금이 설치를 깨뜨릴 수 있어요. C:\sitebrew 처럼 동기화되지 않는 곳을 권해요 (-Folder C:\sitebrew)." "This folder is synced by OneDrive: $repo - thousands of small files make it slow and a sync lock can break the install. A place that is not synced, such as C:\sitebrew, is better (-Folder C:\sitebrew)."
        if (-not (Confirm-Continue '그래도 이 폴더에 계속할까요?' 'Go on with this folder anyway?')) {
          Say '여기서 멈춰요. 다른 폴더로 같은 명령을 다시 실행해요.' 'Stopping here. Run the same command again with another folder.'
          return 3
        }
      }
      # --quiet: no progress lines; advice.detachedHead=false: no "You are in 'detached HEAD' state" essay (a tag is detached on purpose). An error still prints.
      if ($WhatIf) {
        Write-Host "[WhatIf] would run: git -c advice.detachedHead=false clone --quiet --branch $Tag --depth 1 $url `"$repo`""
      } elseif ($missing -contains 'git') {
        Say 'Git 이 없어서 내려받기를 건너뛰어요. Git 을 설치한 뒤 이 명령을 다시 실행해요.' 'Git is missing, so the download is skipped. Install Git and run this command again.'
      } else {
        if ((Test-Path -LiteralPath $repo) -and (@(Get-ChildItem -LiteralPath $repo -Force).Count -gt 0)) {
          Say "폴더가 비어 있지 않아요: $repo -Folder 로 다른 폴더를 줘요." "The folder is not empty: $repo - pass another one with -Folder."
          return 2
        }
        & git -c advice.detachedHead=false clone --quiet --branch $Tag --depth 1 $url $repo | Out-Host
        if ($LASTEXITCODE -ne 0) {
          Say "내려받기에 실패했어요 (git 종료 코드 $LASTEXITCODE). 주소와 태그($Tag)를 확인해요." "The download failed (git exit code $LASTEXITCODE). Check the address and the tag ($Tag)."
          return 1
        }
      }
    }
  }
  $repoReady = Test-Path -LiteralPath (Join-Path $repo 'plugins\sitebrew\.claude-plugin\plugin.json')
  if ($repoReady -or $WhatIf) { Remember-KitFolder $repo }

  # 4. the plugin
  $pluginFailed = @()
  foreach ($id in $agents) {
    $cmds = @()
    if ($id -eq 'claude') {
      $cmds += , @('claude', 'plugin', 'marketplace', 'add', $repo)
      $cmds += , @('claude', 'plugin', 'install', 'sitebrew@sitebrew')
    } else {
      $cmds += , @('codex', 'plugin', 'marketplace', 'add', $repo)
      $cmds += , @('codex', 'plugin', 'add', 'sitebrew@sitebrew')
    }
    if ($WhatIf) {
      foreach ($c in $cmds) { Write-Host ('[WhatIf] would run: ' + (Format-CommandText $c)) }
      continue
    }
    if (-not $agentOk[$id] -or -not (Test-Path -LiteralPath (Join-Path $repo 'plugins\sitebrew'))) {
      Say "$id 플러그인 설치를 건너뛰어요 ($id 또는 Sitebrew 폴더가 없어요). 준비되면 아래 두 명령을 직접 실행해요." "Skipping the $id plugin install ($id or the Sitebrew folder is missing). When ready, run these two commands yourself."
      foreach ($c in $cmds) { Write-Host ('  ' + (Format-CommandText $c)) }
      continue
    }
    $failed = $false
    foreach ($c in $cmds) {
      $rest = @($c[1..($c.Count - 1)])
      & $c[0] @rest | Out-Host
      if ($LASTEXITCODE -ne 0) { $failed = $true; break }
    }
    if ($failed) {
      $pluginFailed += $id
      Say "$id 플러그인 설치 명령이 실패했어요. 아래 두 명령을 직접 실행해 봐요." "The $id plugin install failed. Run these two commands yourself."
      foreach ($c in $cmds) { Write-Host ('  ' + (Format-CommandText $c)) }
    }
  }

  # 5. doctor
  $doctor = Join-Path $repo 'plugins\sitebrew\scripts\doctor.mjs'
  if ($WhatIf) {
    Write-Host "[WhatIf] would run: node `"$doctor`" --kit `"$repo`""
  } elseif ((Test-Path -LiteralPath $doctor) -and ($null -ne (Get-ToolVersion (Get-Req 'node')))) {
    & node $doctor --kit $repo | Out-Host
  }

  # 6. next - only when nothing is missing
  Write-Host ''
  if (-not $WhatIf) {
    if ($pluginFailed.Count -gt 0) {
      Say "아직 끝나지 않았어요: $($pluginFailed -join ', ') 플러그인이 설치되지 않았어요. 위에 적힌 두 명령을 직접 실행한 뒤 다시 확인해요." "Not finished: the plugin for $($pluginFailed -join ', ') is not installed. Run the two commands listed above, then check again."
      return 1
    }
    $lack = @($missing)
    if (-not $repoReady) { $lack += 'Sitebrew folder' }
    if ($lack.Count -gt 0) {
      Say "아직 끝나지 않았어요. 빠진 것: $($lack -join ', '). 위에 적힌 대로 채운 뒤 같은 명령을 다시 실행해요." "Not finished. Missing: $($lack -join ', '). Fill them in as described above, then run the same command again."
      return 3
    }
  }
  # a preview that still has something to install must not end with a "Next" that cannot work yet
  if ($WhatIf -and $missing.Count -gt 0) {
    Say "먼저 설치할 것: $($missing -join ', '). 위에 적힌 대로 설치한 뒤 같은 명령을 -WhatIf 없이 실행해요." "Install first: $($missing -join ', '). Install as shown above, then run the same command without -WhatIf."
    return 0
  }
  $folderText = $repo
  if ($chosen -eq 'codex') {
    Say "다음: Codex 를 $folderText 폴더에서 열고 「sitebrew 의 new 스킬로 사이트를 만들어 줘」라고 말해요." "Next: open Codex in $folderText and say: use the sitebrew new skill to make me a site."
  } elseif ($chosen -eq 'both') {
    Say "다음: Claude Code 를 $folderText 폴더에서 열고 /sitebrew:new 를 입력해요 (Codex 는 「sitebrew 의 new 스킬로 사이트를 만들어 줘」)." "Next: open Claude Code in $folderText and type /sitebrew:new (in Codex say: use the sitebrew new skill to make me a site)."
  } else {
    Say "다음: Claude Code 를 $folderText 폴더에서 열고 /sitebrew:new 를 입력해요." "Next: open Claude Code in $folderText and type /sitebrew:new."
  }
  return 0
}

# `exit` would close the window of someone who ran this through irm | iex, so only a real file run exits with a code.
# A native command inside Invoke-Main must never add output to its return value (that turned the result into an array and exit 0): they end in Out-Host.
$rc = [int](@(Invoke-Main) | Select-Object -Last 1)
if ($PSScriptRoot) { exit $rc }
$global:LASTEXITCODE = $rc
