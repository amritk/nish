## Summary

<!-- What does this PR change and why? Which work package (docs/MASTER_PLAN.md §5) does it belong to? -->

## Changes

<!-- Bullet list of the notable changes. For a new construct, the lowering: the TypeScript snippet and the exact IR it compiles to. -->

## Testing

<!-- How did you verify this works? -->

- [ ] `npm run check` passes (the ambient type-check of `src/`, `std/` and `tests/nish/`)
- [ ] `npm test` passes with LLVM 18 on `PATH`, undegraded (no `DEGRADED:` line); skip count: <!-- n -->
- [ ] `npm run lint` passes
- [ ] Markdown changed: `node docs/check-links.mjs` passes
- [ ] New construct: implemented in `src/`, golden `.ll`, native round trip (`.out`), at least one `reject_*` case
- [ ] New construct: not *used* in `src/`'s own source until the next release (the rolling freeze CI's `bootstrap` job checks)
- [ ] `docs/LANGUAGE.md` and the IR cookbook updated; the title is a conventional commit subject, because the squash commit is the changelog entry (`CHANGELOG.md` is generated from it)
- [ ] Runtime size reported for any `runtime/*.c` unit that changed (`node tests/run.js budget`)

## Related issues

<!-- Closes #123 -->
