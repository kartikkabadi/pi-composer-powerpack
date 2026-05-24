# Pi Composer Powerpack — AGENTS.md

Guide + curated assets repo for a polished Pi + Cursor Composer 2.5 + multi-agent experience (extensions, agent prompts, mono-black theme, etc.).

**Install path is Pi's GitHub installer only.** Do not reintroduce `install.sh`, shell launchers, or a separate npm package setup flow unless explicitly requested by the maintainer.

User install = [README Quick start (install)](README.md#install); no other install path.

## Working agreements (guide-first + assets)

- Keep README and key assets (extensions/, agents/, themes/, config/) copy-paste friendly and high-signal for agents and humans.
- No secrets, Pi session JSONL, auth files, memory DBs, sockets, or private machine-wide configs in the repo (enforce via existing `npm run check:secrets` + manual).
- Keep `package.json`'s `pi` field self-contained for GitHub installs.
- Use `sfw` (Socket Firewall) for any pnpm/npm/bun operations (per global machine rules).
- Delete before adding. Smallest change that gives real feedback. Prefer `rg` + project package manager.
- Guide purity: edits must serve the GitHub-installed Pi powerpack flow.

## Review guidelines

- Flag any addition of secrets, private data, or large binary assets as P0.
- Verify package install and startup experience after README, manifest, or extension changes.
- Extensions/agents/: ensure prompts and hooks remain focused on intent/product-boundary (not low-level impl unless repo convention answers it).
- Before GH release or publish: run secret check, dry pack, and an isolated Pi install smoke.
- Keep package.json "pi" field and "files" accurate for the GitHub installer model.

## Integration with Cascade / Superpowers Skills

When working on this project, invoke these skills (read their SKILL.md first):

- **obsidian-recall-router** (qmd_recall.py in vault) — before any strategy, prior-decision, or Pi/Hermes context work.
- **git-branch-worktree-discipline** — before any git clone, branch, worktree, push, or destructive op. Always preflight (status/branch/diff/log).
- **brainstorming** — before creative changes to guide/assets or README.
- **vibe-security** — for any code review of extensions/ or new logic.
- **supply-chain-install-protection** + global Socket rules (sfw) — for installs.
- **repo-inspection** — for deep dives on this or related Pi projects.
- **verification-before-completion** + **agent-verification-discipline** — before claiming any polish, release, or milestone done.
- **using-superpowers** — always at start of relevant work.

## Global + Nearest AGENTS

Inherits all global durable rules (scope exact, protect secrets, nearest AGENTS/docs/lockfiles, opensrc for deps, direct/concise, verify before claim, etc.).

Also reference nearest in sibling projects (e.g. foundry/AGENTS.md once added, or clawhip-port/AGENTS.md for patterns).

**Runtimes**: This is Pi Extension Pack territory. Keep separate from Foundry (the TS/Node CLI runtime), Codex, Hermes, etc.

End every session with: what changed, what was verified, what remains (per global).

---

*This AGENTS.md added as part of 2026-05 alignment + hygiene baseline milestone (plan execution).*
