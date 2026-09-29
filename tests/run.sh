#!/usr/bin/env bash
# tests/run.sh - extract <script> from index.html and run the jsc test bundle
set -euo pipefail
cd "$(dirname "$0")/.."
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc
awk '/^<script>$/{p=1;next} /^<\/script>/{p=0} p' index.html > tests/.app.js
cat tests/harness.js tests/.app.js tests/tests.js > tests/.bundle.js
"$JSC" tests/.bundle.js
