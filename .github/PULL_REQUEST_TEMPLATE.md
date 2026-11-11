## Summary

<!-- What does this PR change and why? Which work package (docs/MASTER_PLAN.md §5) does it belong to? If it lands a stage, tick its box on docs/roadmap/<the package's note name> and move that page's "Next" on. -->

## Changes

<!-- Bullet list of the notable changes. For a new construct, the lowering: the TypeScript snippet and the exact IR it compiles to. -->

## Testing

<!-- How did you verify this works? -->

- [ ] `npm run check` passes (the ambient type-check of `src/`, `std/` and `tests/nish/`)
- [ ] Every CI `test (…, shard N/8)` row green and undegraded on the current head (no `DEGRADED:` line); skip counts read from the shard summaries: <!-- n -->
- [ ] `node tests/run.js <filter>` passes for each section or program the change touches
- [ ] `npm run lint` passes
- [ ] Markdown changed: `node docs/check-links.mjs` passes
- [ ] New construct: implemented in `src/`, golden `.ll`, native round trip (`.out`), at least one `reject_*` case
- [ ] New construct: not *used* in `src/`'s own source until the next release (the rolling freeze CI's `bootstrap` job checks)
- [ ] `docs/LANGUAGE.md` and the IR cookbook updated; the title is a conventional commit subject, because the squash commit is the changelog entry (`CHANGELOG.md` is generated from it)
- [ ] Runtime size reported for any `runtime/*.c` unit that changed (`node tests/run.js budget`)

## Related issues

<!-- Closes #123 -->
