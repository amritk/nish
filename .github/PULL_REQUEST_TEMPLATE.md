## Summary

<!-- What does this PR change and why? Which work package (docs/MASTER_PLAN.md §5) does it belong to? -->

## Changes

<!-- Bullet list of the notable changes. For a new construct, the lowering: the TypeScript snippet and the exact IR it compiles to. -->

## Testing

<!-- How did you verify this works? -->

- [ ] `npm run check` passes
- [ ] `npm test` passes with LLVM 18 on `PATH`
- [ ] `npm run lint` passes
- [ ] New construct: golden `.ll`, native round trip (`.out`), at least one `reject_*` case
- [ ] `docs/LANGUAGE.md` and the IR cookbook updated, `CHANGELOG.md` line added
- [ ] `runtime.c` / `runtime_os.c` size reported if either changed (`node tests/run.js budget`)

## Related issues

<!-- Closes #123 -->
