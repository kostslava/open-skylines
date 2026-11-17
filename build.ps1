# Bundles index.html + js/*.js into a single self-contained page: dist/open-skylines.html
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$html = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'index.html')
$pattern = '<script src="(js/[^"]+)"></script>'
$out = [regex]::Replace($html, $pattern, {
    param($m)
    $js = Get-Content -Raw -Encoding UTF8 (Join-Path $root $m.Groups[1].Value)
    "<script>`n" + $js + "`n</script>"
})
$dist = Join-Path $root 'dist'
New-Item -ItemType Directory -Force $dist | Out-Null
$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $dist 'open-skylines.html'), $out, $utf8)
Write-Output ("Wrote dist/open-skylines.html (" + [math]::Round($out.Length / 1024) + " KB)")
