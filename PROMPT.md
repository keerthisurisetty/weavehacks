You are building the **Tell** project. Read `CLAUDE.md`, `docs/IMPLEMENTATION_PLAN.md`,
`docs/TESTING.md`, `docs/AUTOMATION.md`, and `docs/PR_STATUS.md`. Implement the **next
unchecked PR only**.

- Read the relevant skill in `.claude/skills/` before using a technology.
- Implement only this PR's scope — do not gold-plate or change scope.
- Write the tests this PR requires (`docs/TESTING.md` → per-PR).
- Run `make check` and fix until green; if stuck after 6 tries, write `BLOCKED.md`
  (what failed, what you tried) and STOP.
- Commit in small steps, open a PR with the template (`docs/AUTOMATION.md` §5),
  tick the box in `docs/PR_STATUS.md`, then **STOP — do not start the next PR.**

Hard rules:
- **Never commit if `make check` is red.**
- **Never put the speaker's secret or mode into a detector/adjudicator prompt.**
- Async everywhere in the backend.
