#!/bin/sh
# Bundles index.html + js/*.js into a single self-contained page: dist/open-skylines.html
cd "$(dirname "$0")"
mkdir -p dist
python3 - <<'PY'
import re
html = open('index.html', encoding='utf-8').read()
out = re.sub(r'<script src="(js/[^"]+)"></script>', lambda m: '<script>\n' + open(m.group(1), encoding='utf-8').read() + '\n</script>', html)
open('dist/open-skylines.html', 'w', encoding='utf-8').write(out)
print('Wrote dist/open-skylines.html (%d KB)' % (len(out) // 1024))
PY
