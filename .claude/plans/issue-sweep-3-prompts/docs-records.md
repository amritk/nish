You are implementing one stage of an accepted follow-up to a finished run. Work only on this stage.

Repo: amritk/nish          Base: main at c6657468
Branch: feature/issue-sweep-3/docs-records   (already assigned: commit and push here, nowhere else)
Tracking issue: #394 (its closing comment lists these follow-ups)

## Your stage
docs: write down the builtin and mutation-test conventions, and bring the security records up to date

Goal: two conventions that several workers in this run had to discover on their own are written into the repo's agent guidelines, and the security records stop listing fixed findings as open.

**Owns:**
- `CLAUDE.md`
- `.claude/selfhost.md`
- `docs/security/**`
- `std/README.md`, only if the `docs/security/README.md` "Corrections still to make" table names a correction there that is still undone

**Not yours:** `.claude/testing.md` belongs to another stage running in parallel, which documents the IR-difference declarations it ships. Do not edit it.

## Todos
1. **The builtin checklist**, in `.claude/selfhost.md`, where adding a builtin is described; add a one-line pointer in `CLAUDE.md` only if it has a natural place.
   - Adding a builtin touches `src/builtins.ts`, `src/runtime.ts`, `src/emit-builtins.ts` and `src/emit-util.ts`.
   - It also touches `runtime/nish.mjs`, `runtime/shim.mjs` and `runtime/nish.d.ts`.
   - It needs exactly one capability label in `src/capabilities.ts`; `tests/capabilities.js` audits that.
   - It needs narrow per-program `DECLARED` entries in `tests/nish-cmp.js` for the test cases the released compiler refuses.
   - Verify every claim against the code on main, and cite #417 (`secureZero`) and #425 (owner builtins) as worked examples.
2. **The mutation-test rule**, in `.claude/selfhost.md`.
   - Some checks in `tests/run.js` mutate `src/` by exact text with `String.replace`; find them and name the mechanism.
   - When an edit touches a line one of them targets, keep that line byte-identical and add the change beside it, or the gate goes inert. #425 hit this against #423's capabilities audit.
3. **The security records**, `docs/security/README.md`:
   - The "Open findings" table and the per-area counts still list RT-10, RT-11, RT-12, RT-13 (fixed by #405; see `runtime.md`) and CLI-8 (fixed by #425; see `cli.md`) as open. Move them to fixed, and recompute the Total and area rows from the area records themselves, not by hand-adjusting.
   - The "Corrections still to make" table still has rows that are done: the shim `O_NOFOLLOW` row (done by #405) and the `scripts/bootstrap.sh` row (done by #425). Check every remaining row, including the `std/README.md` `join` row, against main. Remove what is done; make any small doc correction still pending.
4. **K1-6:** `docs/security/crypto-k1.md` around line 90 says K1-6 is fixed "except for `join` … tracked in #382". #427 closed `join` (CG-3); see `docs/security/codegen.md`. Make every record consistent with the area records, and grep `docs/security/` for any other stale "tracked in"/"open" reference to RT-10..13, CLI-8, CG-2/3/4/8/10, K1-6.

This stage is documentation only. No code and no test changes. "A regression test failing on the base" does not apply; instead, the PR body lists each record row changed with the evidence (file:line on main, or PR) that it is fixed. `npm run check`, `npm test`, `npm run lint` and `node docs/check-links.mjs` must still pass.

Commit type: `docs`. Close nothing; write `Part of #394`.

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
