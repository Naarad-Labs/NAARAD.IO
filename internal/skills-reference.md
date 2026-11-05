# Skills Playbook

Reference for using installed Claude skills in this repository.

## Installed Skills

| Skill | Path | Use |
|-------|------|-----|
| graphify | `~/.claude/skills/graphify/` | Knowledge graph queries via `/graphify` |
| a11y-audit | `~/.claude/skills/a11y-audit/` | WCAG 2.2 accessibility audits |
| caveman | `~/.claude/skills/caveman/` | Terse code responses |
| ponytail | `~/.claude/skills/ponytail/` | Senior developer lazy mode |
| replicate | `~/.claude/skills/replica-*` | Brand/design tooling |

## Skill Invocation

Skills are invoked via `/skill-name` or the Skill tool:
```
/skill-a11y-audit
/skill-caveman
```

## Context 7

Use Context7 for library documentation:
```
context7: <library-name>
```

## Progress Tracking

- PROGRESS.md: 1000-point roadmap status
- Progress script: `node ops/product/progress.mjs summary`
- Weekly review: Scheduled via cron

## Common Patterns

- Map tile issues: Check tile provider URLs in `app/map.js`
- CSS tokens: `app/tokens.css` imported by `app/base.css`
- Verify script: `bash scripts/verify.sh`
- Tests: `node --test tests/*.test.mjs`