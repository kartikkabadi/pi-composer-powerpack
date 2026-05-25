#!/usr/bin/env bash
# Sequential Phase B releases v0.2.3–v0.2.14 (run from repo root after changes are ready).
# SAFETY: this is a historical batch script — do NOT re-run. Each release() call
# pushes a tag and creates a GH release. Kept for reference only.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="${HOME}/.sfw-agent-bin:${PATH}"

release() {
	local ver="$1"
	local subject="$2"
	shift 2

	sfw pnpm run check:secrets
	sfw pnpm run lint
	sfw pnpm run typecheck
	sfw pnpm test

	node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
pkg.version = '${ver}';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

	local notes_file
	notes_file="$(mktemp)"
	node -e "
const fs = require('fs');
const v = '${ver}';
const subject = '${subject}';
const entry = '## [' + v + '] - ' + new Date().toISOString().slice(0,10) + '\n\n### Changed\n\n- ' + subject + '\n';
let cl = fs.readFileSync('CHANGELOG.md','utf8');
cl = cl.replace('## [Unreleased]\n\n', '## [Unreleased]\n\n' + entry);
fs.writeFileSync('CHANGELOG.md', cl);
const m = cl.match(new RegExp('## \\\\[' + v.replace(/\\./g,'\\\\.') + '\\\\][\\\\s\\\\S]*?(?=\\\\n## \\\\[|$)'));
if (!m) { console.error('changelog section missing'); process.exit(1); }
fs.writeFileSync(process.argv[1], m[0].trim());
" "$notes_file"

	git add package.json CHANGELOG.md "$@"
	git add -u
	git commit -m "release: v${ver} ${subject}"
	git tag -a "v${ver}" -m "v${ver}"
	git push origin main
	git push origin "v${ver}"
	gh release create "v${ver}" --title "v${ver}" --notes-file "$notes_file"
	rm -f "$notes_file"
	echo "Released v${ver}"
}

release "0.2.3" "shared frontmatter parser" \
	extensions/lib/frontmatter.ts extensions/coms/protocol.ts test/agent-scan.test.mjs

release "0.2.4" "specialistSpawn wrapper" extensions/lib/specialistSpawn.ts

release "0.2.5" "subagent-widget via runSpecialistSpawn" extensions/subagent-widget.ts

release "0.2.6" "pi-pi queryExpert via runSpecialistSpawn" extensions/pi-pi.ts

release "0.2.7" "agent-team dispatch via runSpecialistSpawn" extensions/agent-team.ts

release "0.2.8" "agent-chain runAgent via runSpecialistSpawn" extensions/agent-chain.ts

release "0.2.9" "coms transport dedup" \
	extensions/coms/transport.ts extensions/coms/protocol.ts test/coms-transport.test.mjs

release "0.2.10" "ComsRuntime module" extensions/coms/runtime.ts extensions/coms/index.ts

release "0.2.11" "workflowGrid for pi-pi" extensions/lib/workflowGrid.ts extensions/pi-pi.ts

release "0.2.12" "workflowGrid for agent-team" extensions/agent-team.ts

release "0.2.13" "CI socketdev action and sfw install" .github/workflows/ci.yml

release "0.2.14" "damageControlRules.evaluateToolCall" \
	extensions/lib/damageControlRules.ts extensions/damage-control-continue.ts test/damage-control-rules.test.mjs
