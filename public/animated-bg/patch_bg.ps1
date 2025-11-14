# PowerShell patch script - run from your project's public/ directory
Param()
$here = Get-Location
Write-Host "Patching folder: $here"

# create assets/bg if missing
$bg = Join-Path $here "assets\bg"
if (-not (Test-Path $bg)) { New-Item -ItemType Directory -Path $bg | Out-Null }

# copy butterfly files from script dir (assumes they are in the same folder as this script)
Copy-Item -Path ".\butterfly.css" -Destination $bg -Force
Copy-Item -Path ".\butterfly.js" -Destination $bg -Force

# backup index.html and style.css
if (Test-Path ".\index.html") { Copy-Item ".\index.html" ".\index.html.bak" -Force }
if (Test-Path ".\style.css") { Copy-Item ".\style.css" ".\style.css.bak" -Force }

# insert link/script includes into index.html if not present
$html = Get-Content -Raw -Path ".\index.html"
$cssLine = '<link rel="stylesheet" href="assets/bg/butterfly.css">'
$jsLine = '<script src="assets/bg/butterfly.js" defer></script>'
if ($html -notmatch [regex]::Escape($cssLine)) {
  $html = $html -replace '(?i)</head>', "  $cssLine`n</head>"
}
if ($html -notmatch [regex]::Escape($jsLine)) {
  $html = $html -replace '(?i)</body>', "  $jsLine`n</body>"
}
Set-Content -Path ".\index.html" -Value $html -Force

# insert safety CSS at top of style.css
$safety = @"
/* Background integration safety (added by butterfly patch) */
@media (prefers-reduced-motion: reduce) {
  .butterfly-bg, .butterfly-bg * { animation: none !important; transition: none !important; }
}
.butterfly-bg { position: fixed; inset: 0; z-index: -4; pointer-events: none; overflow: hidden; }
.app { position: relative; z-index: 1; backdrop-filter: blur(6px); }
"@
if (Test-Path ".\style.css") {
  $style = Get-Content -Raw -Path ".\style.css"
  if ($style -notmatch "Background integration safety") {
    Set-Content -Path ".\style.css" -Value ($safety + "`n" + $style) -Force
  }
} else {
  Set-Content -Path ".\style.css" -Value $safety -Force
}

Write-Host "Patch applied. Backups: index.html.bak , style.css.bak (if existed)."
Write-Host "Files copied to: $bg"
