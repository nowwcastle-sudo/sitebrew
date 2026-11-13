# Sitebrew one-line installer for Windows PowerShell 5.1 and PowerShell 7.
#   irm https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/v0.2.7/get.ps1 | iex
# This file is plain ASCII with NO byte order mark, on purpose. install.ps1 starts with a BOM so that Windows PowerShell 5.1 reads its Korean
# text when you run it as a file. A string downloaded with irm keeps that BOM as its first character (U+FEFF); then `param(...)` is no longer
# the first statement and `irm install.ps1 | iex` stops with a parse error. So this bootstrap downloads install.ps1 of the same tag, removes
# the BOM and runs it in this same window (no new process, no execution-policy change, the window stays open).
# Preview only (nothing is installed): set $env:SITEBREW_WHATIF = '1' first. With options, use this form instead:
#   & ([scriptblock]::Create((irm https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/v0.2.7/install.ps1).TrimStart([char]0xFEFF))) -Tool codex -WhatIf
# Commit-pinned form (checks that the tag still points to the published commit):
#   $env:SITEBREW_COMMIT = '<40-hex SHA>'; irm https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/<40-hex SHA>/get.ps1 | iex
# With SITEBREW_COMMIT set, install.ps1 is read from that commit (a commit address never changes, a tag can be moved) and gets -Commit, which
# compares the cloned folder with it and refuses to go on when they differ.
# The result is in $LASTEXITCODE: 0 ok, 1 a download or clone failed, 2 a wrong option or folder, 3 something is missing or needs your answer, 4 refused to start.
# The Korean lines are spelled as hexadecimal code points so this file stays ASCII (T converts them).
# SITEBREW_RAW_BASE (tests only): replaces https://raw.githubusercontent.com, and is accepted only when it points to http://127.0.0.1 or http://localhost.
& {
  $ErrorActionPreference = 'Stop'
  function T([string]$hex) { return (-join ($hex -split ' ' | ForEach-Object { [char][Convert]::ToInt32($_, 16) })) }
  $owner = 'nowwcastle-sudo'
  $tag = 'v0.2.7'
  if ($owner -eq ('__' + 'OWNER__')) {
    Write-Host (T 'C774 20 C124 CE58 20 C548 B0B4 B294 20 C544 C9C1 20 AC8C C2DC 20 C804 20 D310 C785 B2C8 B2E4 20 2D 20 AC8C C2DC B41C 20 C800 C7A5 C18C C758 20 C548 B0B4 B97C 20 C4F0 C138 C694 2E')
    Write-Host '  This install line is a version from before publication - use the instructions in the published repository.' -ForegroundColor DarkGray
    $global:LASTEXITCODE = 4
    return
  }
  $ref = $tag
  $commit = ''
  if ($env:SITEBREW_COMMIT) {
    $commit = $env:SITEBREW_COMMIT.Trim().ToLower()
    if ($commit -notmatch '^[0-9a-f]{40}$') {
      Write-Host ((T '53 49 54 45 42 52 45 57 5F 43 4F 4D 4D 49 54 20 C740 20 34 30 C790 B9AC 20 31 36 C9C4 C218 20 CEE4 BC0B 20 53 48 41 20 C608 C694 2E 20 BC1B C740 20 AC12 3A') + " $commit")
      Write-Host "  SITEBREW_COMMIT must be a full 40-character hexadecimal commit SHA (got: $commit)." -ForegroundColor DarkGray
      $global:LASTEXITCODE = 2
      return
    }
    $ref = $commit
  }
  $base = 'https://raw.githubusercontent.com'
  if ($env:SITEBREW_RAW_BASE -match '^http://(127\.0\.0\.1|localhost):[0-9]+/?$') { $base = $env:SITEBREW_RAW_BASE.TrimEnd('/') }
  $url = "$base/$owner/sitebrew/$ref/install.ps1"
  try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }
  try {
    $text = Invoke-RestMethod -Uri $url
  } catch {
    Write-Host ((T 'C124 CE58 20 D30C C77C C744 20 BC1B C9C0 20 BABB D588 C2B5 B2C8 B2E4 2E 20 C778 D130 B137 20 C5F0 ACB0 ACFC 20 C8FC C18C B97C 20 D655 C778 D558 C138 C694 3A') + " $url")
    Write-Host "  Could not download the installer. Check your internet connection and the address: $url" -ForegroundColor DarkGray
    $global:LASTEXITCODE = 1
    return
  }
  $text = ([string]::Join("`n", @($text))).TrimStart([char]0xFEFF)
  $opts = @{}
  if ($env:SITEBREW_WHATIF -eq '1') { $opts['WhatIf'] = $true }
  if ($commit) { $opts['Commit'] = $commit }
  & ([scriptblock]::Create($text)) @opts
}
