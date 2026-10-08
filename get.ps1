# Sitebrew one-line installer for Windows PowerShell 5.1 and PowerShell 7.
#   irm https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/v0.1.0/get.ps1 | iex
# This file is plain ASCII with NO byte order mark, on purpose. install.ps1 starts with a BOM so that Windows PowerShell 5.1 reads its Korean
# text when you run it as a file. A string downloaded with irm keeps that BOM as its first character (U+FEFF); then `param(...)` is no longer
# the first statement and `irm install.ps1 | iex` stops with a parse error. So this bootstrap downloads install.ps1 of the same tag, removes
# the BOM and runs it in this same window (no new process, no execution-policy change, the window stays open).
# Preview only (nothing is installed): set $env:SITEBREW_WHATIF = '1' first. With options, use this form instead:
#   & ([scriptblock]::Create((irm https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/v0.1.0/install.ps1).TrimStart([char]0xFEFF))) -Tool codex -WhatIf
# The result is in $LASTEXITCODE: 0 ok, 1 a download or clone failed, 2 a wrong option or folder, 3 something is missing or needs your answer, 4 refused to start.
# The Korean lines are spelled as hexadecimal code points so this file stays ASCII (T converts them).
# SITEBREW_RAW_BASE (tests only): replaces https://raw.githubusercontent.com, and is accepted only when it points to http://127.0.0.1 or http://localhost.
& {
  $ErrorActionPreference = 'Stop'
  function T([string]$hex) { return (-join ($hex -split ' ' | ForEach-Object { [char][Convert]::ToInt32($_, 16) })) }
  $owner = 'nowwcastle-sudo'
  $tag = 'v0.1.0'
  if ($owner -eq ('__' + 'OWNER__')) {
    Write-Host (T 'C774 20 C124 CE58 20 C548 B0B4 B294 20 C544 C9C1 20 AC8C C2DC 20 C804 20 D310 C785 B2C8 B2E4 20 2D 20 AC8C C2DC B41C 20 C800 C7A5 C18C C758 20 C548 B0B4 B97C 20 C4F0 C138 C694 2E')
    Write-Host '  This install line is a version from before publication - use the instructions in the published repository.' -ForegroundColor DarkGray
    $global:LASTEXITCODE = 4
    return
  }
  $base = 'https://raw.githubusercontent.com'
  if ($env:SITEBREW_RAW_BASE -match '^http://(127\.0\.0\.1|localhost):[0-9]+/?$') { $base = $env:SITEBREW_RAW_BASE.TrimEnd('/') }
  $url = "$base/$owner/sitebrew/$tag/install.ps1"
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
  & ([scriptblock]::Create($text)) @opts
}
