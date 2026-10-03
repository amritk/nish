You are implementing one stage of an accepted follow-up to a finished run. Work only on this stage.

Repo: amritk/nish          Base: main at c6657468
Branch: feature/issue-sweep-3/fuzz-declarations   (already assigned: commit and push here, nowhere else)
Tracking issue: #394. This stage closes #438.

## Your stage
test(self): let the stage-1 fuzz differential declare an intended IR change, and run it in CI

Goal: `npm test` with `NISH_BOOTSTRAP` set is green on main again, and the check stays strict for every other difference. Read #438 and its comment first. The run that caused it chose this approach: declarations keyed by attribute-group text, rather than normalising the attribute group away.

**Owns:**
- `tests/differential/fuzz.js`, and any new declaration file beside it under `tests/differential/`
- `.claude/testing.md`
- `.github/workflows/ci.yml`, in the `nish-cmp` job's section only. Another stage edits the `test` job and the top-level `concurrency` block in parallel; do not touch those.
- `tests/run.js`, only the lines that run `fuzz.js --stage1` and its own new self-check

## Todos
1. **The declaration mechanism.** Give `fuzz.js --stage1` declarations that mirror `tests/nish-cmp.js`'s `DECLARED`:
   - each entry names the exact difference: the function or declaration and its attribute-group text, seed side against HEAD side;
   - each entry carries a `changelog` naming the commit subject that made the change, and a `why`;
   - a declared difference is reported, not failed;
   - an undeclared one still fails;
   - a declaration that matches nothing fails as stale, so it cannot outlive the next release's reseed.

   Look at how `tests/nish-cmp.js` checks its declarations and reuse its approach, or its code if it is factored for it.
2. **Declare #427's CG-8 change:** `nish_str_concat` lost `willreturn`, with its changelog text matching #427's subject, "fix(codegen): close CG-2, CG-3, CG-4, CG-8 and CG-10". Check whether CG-8 changed other declarations: #427's body names `nish_read_file`, `nish_write_file`, `nish_append_file`, `nish_alloc_array`, `nish_read_file_or_null` and `nish_read_file_bytes`. Declare each one the fuzzer can actually reach. Do not declare blanket matches.
3. **Self-checks** in `tests/run.js` next to the fuzz invocation, that:
   - an undeclared attribute difference fails;
   - a declared one passes;
   - a stale declaration fails.

   Show red-then-green: on the base, `node tests/differential/fuzz.js --stage1 --seed 20261001 --count 16` exits 1 with 15 disagreements; on your branch it exits 0.
4. **CI.** Run `fuzz.js --stage1` against the seed in the `nish-cmp` job, which already fetches the seed. Without this, CI stays blind to the check that every cloud contributor's `npm test` runs, which is how #438 slipped through. Keep it bounded in time, and say how long it adds.
5. **`.claude/testing.md`:** state the rule. An intended change to emitted IR must be declared wherever HEAD is compared with the released seed: `tests/nish-cmp.js` `DECLARED`, and now the fuzz declarations, with #427 and #438 as the example.

Verification:
- `npm run check`;
- `NISH_BOOTSTRAP=build/seed/bin/nish npm test`, undegraded: 0 failed, and no skips beyond the WASI ones;
- `NISH_BOOTSTRAP=build/seed/bin/nish node tests/nish-cmp.js`;
- the fuzz command above.

Write `Closes #438` and `Part of #394`.

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

## Lead notes
- **Main moves fast:** several other runs merge to main every 20-40 minutes.
  - Merge `origin/main` in right before you open the PR, and again whenever the lead tells you it is dirty.
  - Regenerate goldens; never hand-merge them.
  - When a `tests/run.js` mutation check `replace()`s a line of `src/` you edit, keep that line byte-identical.
- **When your PR opens:** delete the session-link footer appended to its body at once, because it fails the `no attribution` check. Then message the lead's session with the PR number and head SHA.
