# Optional extensions

These TypeScript modules ship in `extensions/` but are **not** listed in `package.json` → `pi.extensions`. Load them manually when needed:

```bash
pi --model cursor/composer-2.5 --cursor-fast \
  -e ./extensions/tilldone.ts
```

| Extension | Purpose |
|-----------|---------|
| `tilldone.ts` | Task completion gate / overlay |
| `auto-caveman.ts` | Terse “caveman” system prompt (`/caveman` toggle). Skill path: `PI_CAVEMAN_SKILL_PATH` or `~/.pi/agent/vendor-skills/.../caveman/SKILL.md` |
| `superset-hooks.ts` | Superset terminal lifecycle hooks (activates only inside Superset) |

They are maintained for personal/advanced use; behavior may change without a semver guarantee in `0.x`.
