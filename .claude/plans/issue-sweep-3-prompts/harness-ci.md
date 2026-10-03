You are implementing one stage of an accepted follow-up to a finished run. Work only on this stage.

Repo: amritk/nish          Base: main at c6657468
Branch: feature/issue-sweep-3/harness-ci   (already assigned: commit and push here, nowhere else)
Tracking issue: #394 (its closing comment lists these follow-ups)

## Your stage
test: run the wasi checks in CI, pin the shim's symlink refusal, and bound every native run

Goal: the gaps the issue-sweep-3 acceptance found in the test harness and CI are closed, each with evidence that the new check goes red when it should.

**Owns:**
- `.github/workflows/ci.yml`: the `test` job and the top-level `concurrency` block. The `nish-cmp` job belongs to another stage running in parallel; do not touch it.
- `tests/run.js`, except the lines that run `tests/differential/fuzz.js --stage1`, which the other stage owns
- `tests/link/reject_typed_push_alias/**`
- the link-golden update path: the tool that writes `tests/link/*/*.ll`, wherever it lives, or a new `--update` mode for it
- `docs/wp10-ci.md`, and `AGENTS.md`'s list of allowed environmental skips, in that list only and only if the WASI skip stops being expected in CI

## Todos
1. **WASI in CI.** On the Ubuntu `test` row:
   - install `wasi-libc` and `libclang-rt-18-dev-wasm32`;
   - set `WASI_SYSROOT=/usr` for the test step, so the wasi-profile and `web:` checks run instead of being skipped "no WASI sysroot".

   The issue-sweep-3 acceptance session ran the unfiltered suite this way and every wasi check passed. Nothing in CI guards #396 (the `realpath`-less wasi-libc build) today. Show the job log lines where the wasi checks PASS and the two "no WASI sysroot" SKIPs are gone.
2. **`node tests/run.js wasi` is vacuous.** No case name contains "wasi", and the wasi checks sit inside the `if (!only)` block (~6049; wasi checks at ~6333-6400), so that filter reports 0 failed without testing anything. Make a `wasi` filter select and run them, the way other named sections are selected. Prove it: on the base the filter runs 0 wasi checks; on your branch it runs them.
3. **The shim's symlink refusal (#405, RT-4 parity).** `runtime/shim.mjs` adds `O_NOFOLLOW` to `writeFileSync`, `appendFileSync` and the spawn helper, but no test covers it. Add a `tests/run.js` check that:
   - plants a symlink to a target file in a scratch dir;
   - runs a small program under `runtime/nish.mjs` (Node) that writes, appends and spawns through the link;
   - expects each to be refused the way native refuses (compare against the native build of the same program);
   - checks the target is left unchanged.

   Red-then-green: revert the `O_NOFOLLOW` lines locally and show the check fails.
4. **No timeout on `.out` native runs.** A program that hangs hangs the harness and CI: a deliberate mutation on #402 did. Give every native run of a case a timeout, and make a timeout a named FAIL that says which case and how long. Pick the bound from measured runtimes, not a guess. Prove it with a scratch case that loops forever: the run fails with the timeout message rather than hanging. Do not add that case to the repo unless it can run fast.
5. **`tests/link/reject_typed_push_alias/expected.err`** pins only one diagnostic (`main.ts:7:11`, `make(2).pop()`), though the program has field, method-return and alias-array forms (#409). Make each form's NL2415 diagnostic pinned, either by tightening `expected.err` if the harness compares the whole stderr, or by splitting the program.
6. **41 `tests/link/*/*.ll` goldens have no regeneration path**, as noted by the codegen-cg worker. Find how they are written and checked. If there is no `--update` that rewrites them with the repo's tooling, add one, consistent with how `tests/self/goldens.js --update` and `docs/cookbook/regen.sh` work, and document it in `docs/wp10-ci.md` or in the tool's own header comment. `.claude/testing.md` belongs to another stage, so do not edit it; mention the new command in the PR body instead.
7. **CI cancels main runs.** `concurrency: cancel-in-progress: true` with a `github.ref` group cancels a running `push` to main when the next merge lands. That left #396's and #397's main runs cancelled, never green or red. Keep cancelling superseded pull-request runs, but let every push to main finish: for example `cancel-in-progress: ${{ github.event_name == 'pull_request' }}`. Explain it in the workflow's own comment style.

Each item gets red-then-green evidence in the PR body. Where an item is CI-only, as items 1 and 7 are, the evidence is the job log or run list on your PR and on main after merge.

Verification:
- `npm run check`;
- `npm test`, undegraded;
- `WASI_SYSROOT=/usr node tests/run.js` locally if you can install the packages; say if you cannot;
- `npm run lint`;
- `npm run lint:dead`;
- `node docs/check-links.mjs`.

Write `Part of #394`.

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
