#!/usr/bin/env bash
# Usage: ./scripts/phase-b-release.sh VERSION "subject line"
# SAFETY: pushes to origin and creates a GitHub release. Do NOT run blindly —
# review the version, subject, and staged paths before executing.
set -euo pipefail
VERSION="${1:?version required}"
SUBJECT="${2:?subject required}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PATH="${HOME}/.sfw-agent-bin:${PATH}"

sfw pnpm run check:secrets
sfw pnpm run lint
sfw pnpm run typecheck
sfw pnpm test

node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
pkg.version = '${VERSION}';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

NOTES_FILE="$(mktemp)"
node -e "
const fs = require('fs');
const v = '${VERSION}';
const subject = '${SUBJECT}';
const entry = '## [' + v + '] - ' + new Date().toISOString().slice(0,10) + '\n\n### Changed\n\n- ' + subject + '\n';
let cl = fs.readFileSync('CHANGELOG.md','utf8');
cl = cl.replace('## [Unreleased]\n\n', '## [Unreleased]\n\n' + entry);
fs.writeFileSync('CHANGELOG.md', cl);
const m = cl.match(new RegExp('## \\\\[' + v.replace(/\\./g,'\\\\.') + '\\\\][\\\\s\\\\S]*?(?=\\\\n## \\\\[|$)'));
if (!m) { console.error('changelog section missing'); process.exit(1); }
fs.writeFileSync(process.argv[1], m[0].trim());
" "$NOTES_FILE"

git add package.json CHANGELOG.md docs/architecture-review-notes.md extensions/ test/
git add -u
git commit -m "release: v${VERSION} ${SUBJECT}"
git tag -a "v${VERSION}" -m "v${VERSION}"
git push origin main
git push origin "v${VERSION}"
gh release create "v${VERSION}" --title "v${VERSION}" --notes-file "$NOTES_FILE"
rm -f "$NOTES_FILE"
echo "Released v${VERSION}"
