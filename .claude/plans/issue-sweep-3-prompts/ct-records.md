You are implementing one stage of an accepted plan. Work only on this stage.

Repo: amritk/nish          Base: main at f120de1d
Branch: feature/issue-sweep-3/ct-records   (already assigned: commit and push here, nowhere else)
Tracking issue: #394

## Your stage
test: constant-time check plumbing (CT-14, CT-15), a narrower nish-cmp declaration, and record corrections
Goal: #388 and the record half of #389 — ct_asm names its real expect kind and fails rather than skips without an aarch64 target; nish-cmp's blanket declarations are narrowed against 0.16.0; every security record correction #388 lists is made and SC-16 records immutable releases as on
Verification: node tests/run.js ct_asm && NISH_BOOTSTRAP=build/seed/bin/nish node tests/nish-cmp.js && node docs/check-links.mjs && npm test

Stage notes from the plan, including your Owns globs (do not create or edit files outside them):
**Owns:**
- `tests/run.js` § `ct_asm`
- `tests/ct-asm.js`, `tests/nish-cmp.js`
- `docs/security/{ct-verification,crypto-k1,codegen,cli,supply-chain,README}.md`

The record corrections #388 lists, in its body and its comment:
- the K1-6 disposition;
- the "held by discipline only" list;
- links from CG-3 and K1-6 to #382, and from CT-13 to #378;
- CLI-6 marked Fixed.

Also mark SC-16 as on, citing v0.16.0's `immutable: true`, and leave attestations open. `codegen-cg` and `owner-builtins` depend on this stage for `codegen.md` and `cli.md`.

Todos:
- [ct-14-15] Fix CT-14 check names and CT-15 fail-not-skip in tests/run.js's ct_asm section — see ct-records
- [ct-nishcmp] Run nish-cmp against 0.16.0 and prune or narrow the stale DECLARED entries in tests/nish-cmp.js — see ct-records
- [ct-records-docs] Correct docs/security/{ct-verification,crypto-k1,codegen,cli,supply-chain,README}.md per #388's list and SC-16 — see ct-records

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
