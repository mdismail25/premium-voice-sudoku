#!/bin/bash
# patch_bg.sh - run from project's public directory
set -e
here="$(pwd)"
echo "Patching $here"
mkdir -p assets/bg
cp butterfly.css assets/bg/butterfly.css
cp butterfly.js assets/bg/butterfly.js
[ -f index.html ] && cp index.html index.html.bak || true
[ -f style.css ] && cp style.css style.css.bak || true
# add link tags if missing
if ! grep -q 'assets/bg/butterfly.css' index.html; then
  sed -i "/<\/head>/i \  <link rel=\"stylesheet\" href=\"assets/bg/butterfly.css\"> " index.html
fi
if ! grep -q 'assets/bg/butterfly.js' index.html; then
  sed -i "/<\/body>/i \  <script src=\"assets/bg/butterfly.js\" defer></script> " index.html
fi
# prepend safety css
if [ -f style.css ]; then
  if ! grep -q 'Background integration safety' style.css; then
    cat > /tmp/_safety.css <<'EOF'
/* Background integration safety (added by butterfly patch) */
@media (prefers-reduced-motion: reduce) {
  .butterfly-bg, .butterfly-bg * { animation: none !important; transition: none !important; }
}
.butterfly-bg { position: fixed; inset: 0; z-index: -4; pointer-events: none; overflow: hidden; }
.app { position: relative; z-index: 1; backdrop-filter: blur(6px); }
EOF
    cat /tmp/_safety.css style.css > /tmp/_style.tmp && mv /tmp/_style.tmp style.css
  fi
else
  cat > style.css <<'EOF'
/* Background integration safety (added by butterfly patch) */
@media (prefers-reduced-motion: reduce) {
  .butterfly-bg, .butterfly-bg * { animation: none !important; transition: none !important; }
}
.butterfly-bg { position: fixed; inset: 0; z-index: -4; pointer-events: none; overflow: hidden; }
.app { position: relative; z-index: 1; backdrop-filter: blur(6px); }
EOF
fi
echo "Patch applied."
