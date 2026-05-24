# Pi Composer Powerpack — AGENTS.md

Guide + curated assets repo for a polished Pi + Cursor Composer 2.5 + multi-agent experience (launchers, extensions, agent prompts, mono-black theme, etc.).

**This is not a script you run.** It is a guide and whole Git repo of things you (or an agent) can use. See updated README for the exact agent-feedable instructions ("feed this repo... ask the 10 coverage questions first... walk through copy-paste setup").

## Working agreements (guide-first + assets)

- Keep README and key assets (bin/, extensions/, agents/, themes/, config/, install.sh) copy-paste friendly and high-signal for agents and humans.
- No secrets, Pi session JSONL, auth files, memory DBs, sockets, or private machine-wide configs in the repo (enforce via existing `npm run check:secrets` + manual).
- Respect Pi version policy (>=0.75.3) and pi-cursor-sdk reqs documented in README.
- Use `sfw` (Socket Firewall) for any pnpm/npm/bun operations (per global machine rules).
- Delete before adding. Smallest change that gives real feedback. Prefer `rg` + project package manager.
- Guide purity: edits must serve the "agent walks user through intent questions then setup using these assets" flow (per user clarification 2026-05).
- Cross-link accuracy: keep references to sibling Foundry repo (the rock-solid runtime) up to date.

## Review guidelines

- Flag any addition of secrets, private data, or large binary assets as P0.
- Verify agent-feed experience after README or asset changes (manually or via test agent prompt).
- Extensions/agents/: ensure prompts and hooks remain focused on intent/product-boundary (not low-level impl unless repo convention answers it).
- Before GH release or publish: run secret check + full local smoke (per README).
- Keep package.json "pi" field and "files" accurate for the guide/assets model (no heavy dep evolution without explicit revival decision).
- Test changes against the Local Smoke Test in README.

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

Inherits all durable rules from `/Users/user/Agents.md` (scope exact, protect secrets, nearest AGENTS/docs/lockfiles, opensrc for deps, main gh=kartikkabadi, direct/concise, verify before claim, etc.).

Also reference nearest in sibling projects (e.g. foundry/AGENTS.md once added, or clawhip-port/AGENTS.md for patterns).

**Runtimes**: This is Pi Extension Pack territory. Keep separate from Foundry (the TS/Node CLI runtime), Codex, Hermes, etc.

End every session with: what changed, what was verified, what remains (per global).

---

*This AGENTS.md added as part of 2026-05 alignment + hygiene baseline milestone (plan execution).*
