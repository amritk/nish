You are implementing one stage of an accepted plan. Work only on this stage.

Repo: amritk/nish          Base: main at f120de1d
Branch: feature/issue-sweep-3/typed-push-pop   (already assigned: commit and push here, nowhere else)
Tracking issue: #394

## Your stage
fix(checker): refuse push and pop on typed arrays reached through Map/Set reads, generics and imported aliases
Goal: #347 — each of the three residual shapes is refused with NL2415
Verification: npm run check && node tests/run.js reject_typed && node tests/self/goldens.js --update && npm test

Stage notes from the plan, including your Owns globs (do not create or edit files outside them):
**Owns:**
- `src/symbols.ts`, `src/generics.ts`, `src/declarations.ts`, `src/members.ts`
- `tests/cases/reject_typed_push_*`
- `docs/LANGUAGE.md` § typed-array names, `docs/wp33-round-trip.md`
- regenerated goldens

**Depends on:** `obj-lit-nullable`, for `src/members.ts`. This stage starts after that one merges.

The change is compile-time only, so no `.ll` golden may move.

Todos:
- [tpp-checker] Carry the typed-array spelling through Map/Set reads, generic instantiation and cross-module aliases in src/symbols.ts, src/generics.ts, src/declarations.ts, src/members.ts — see typed-push-pop
- [tpp-cases] Add one reject_typed_push_* negative per shape and update the LANGUAGE.md rule and docs/wp33-round-trip.md §3.3 — see typed-push-pop

The full plan shows how your stage fits with the others:
  git fetch origin ccr-c46ad830-h7uxbn
  git show origin/ccr-c46ad830-h7uxbn:.claude/plans/issue-sweep-3.plan.md
Read it, then read the GitHub issue(s) your stage closes in full, including the comments. Do not implement anything from another stage: another session owns it and may be working on it in parallel right now.

## Definition of done
1. Your stage's todos are implemented, and nothing outside your Owns globs changed. Files marked "§ section" may only be edited in that section. Regenerated goldens (`tests/self/goldens/checked*.txt`, `tests/cases/*.ll`, `docs/cookbook/**`) are regenerated with the repo's tooling, never hand-edited or hand-merged.
2. Read `CLAUDE.md`, `AGENTS.md` and every file in `.claude/` first. Their rules are authoritative, and that includes the rolling freeze: `src/` may not *use* a construct the 0.16.0 seed lacks.
3. `npm run check` passes, and `npm test` passes **undegraded**. Read the skip count: no DEGRADED banner, and no skips beyond the environmental ones AGENTS.md allows.
4. Coverage: the repo has no coverage command. The agreed substitute is that every fix carries a regression test, and you show it **failing on the base** (stash the fix, run it, restore). Put that red-then-green evidence in the PR body. Never skip, disable or loosen a test, a lint rule or a gate.
5. `npm run lint` and `npm run lint:dead` pass, and `node docs/check-links.mjs` passes if you touched Markdown.
6. Before you open the PR, run /check-iterate and fix what it confirms. If that command is not available in your session, review your own diff against main adversarially yourself and fix what you find. Do not skip it.
7. Then run /simplify over the same diff and apply what it returns. If that command is not available, re-read your diff for reuse, leftover scaffolding and altitude yourself. Re-run `npm run check` and `npm test` afterwards. This pass never changes behaviour and never widens your Owns.
8. Commit messages follow CLAUDE.md, because they are the changelog: a conventional subject, then a prose body for release-note readers, then `Refs:` and `Tests:` trailers, and `Measured:` where performance moves. Do **not** add Co-Authored-By, session links, model names or any platform attribution to commits or PR text. The repo forbids it, and a hook enforces it.
9. Merge `origin/main` in (never rebase) right before opening the PR, and regenerate the goldens if they conflict.
10. Open a PR from your branch to `main`, using the stage title above as the PR title. The body has three parts:
    - what changed and why;
    - the exact LLVM IR for any TypeScript snippet you added to the tests, as CLAUDE.md requires;
    - the verification commands you ran, with their results (including the skip count), followed by `Part of #394` and the issue numbers you close, as `Closes #N`.

    After it opens, read the body back and delete any session-link footer that was appended. `pr-body.yml` fails the PR until you do.

## Rules
- Push only to your own branch. Never push to main, never touch another feature/issue-sweep-3/* branch, never force-push.
- **Do NOT merge your PR**, even though AGENTS.md says agents merge their own. In this run the lead session reviews and merges. Never touch the Release PR (#393).
- If CI goes red or a test fails, run /debug and reproduce the failure before you change anything. If that command is not available, follow the same order yourself: reproduce, localise, one hypothesis at a time, then pin the fix with a test.
- If your stage turns out to be impossible as written, push what you have, open the PR as a draft, and say exactly what blocked you in the PR body. Do not substitute different work and do not widen your scope.
- Review comments will arrive as a single batch. Address every one in one push, then stop. If a finding is wrong, say so in one line on that thread and move on.
- Keep watching your PR's CI until it is green on your latest head. Fix any red check that your change caused.
