You are implementing one stage of an accepted plan. Work only on this stage.

Repo: amritk/nish          Base: main at f120de1d
Branch: feature/issue-sweep-3/obj-lit-nullable   (already assigned: commit and push here, nowhere else)
Tracking issue: #394

## Your stage
fix(checker): type an object literal in an `I | null` context as the struct, not the union
Goal: #324 and #330 — an object literal returned, bound, or used as a ternary arm where `I | null` is expected compiles and runs instead of crashing the emitter with `unknown struct`
Verification: npm run check && UPDATE_GOLDENS=1 node tests/run.js obj_lit_nullable && node tests/self/goldens.js --update && npm test

Stage notes from the plan, including your Owns globs (do not create or edit files outside them):
**Owns:**
- `src/members.ts`, `src/expressions.ts`
- `tests/cases/obj_lit_nullable_*`, `tests/cases/reject_obj_lit_nullable_*`
- `docs/LANGUAGE.md` § object literals
- regenerated goldens

The checker validates the literal against `stripNull(want)` but returns `want` (`src/members.ts` ~540/545), so the emitter looks up a struct for the union. The fix returns the struct type, after checking that assignment into `E | null` stays representation-compatible.

Cover all four forms:
- the ternary arm (#324);
- `return`, an arrow body, and a declared nullable local (#330).

Each form gets a golden `.ll` and a `.stdout`. The PR body shows the exact IR.

Todos:
- [oln-fix] Return the stripped struct type from checkObjectLiteral in src/members.ts (and checkConditional in src/expressions.ts if needed) — see obj-lit-nullable
- [oln-cases] Add positive cases tests/cases/obj_lit_nullable_{ternary,return,arrow,local}.ts with .ll and .stdout, plus one reject_obj_lit_nullable_* negative — see obj-lit-nullable
- [oln-docs] Add the rule to docs/LANGUAGE.md's object-literal section and regenerate checked goldens — see obj-lit-nullable

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
