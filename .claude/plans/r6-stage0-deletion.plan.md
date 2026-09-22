---
name: R6 — delete stage0
overview: Delete src/, the typescript runtime dependency, the six dead oracles and every rule that names stage0 (wp19 §5 R6), as five PRs — four developed in parallel that repoint every consumer onto stage1, then the deletion itself. Everything that stops comparing the two compilers merges only after v0.6.0 ships and nish-cmp is green on main.
stages:
  - id: seed-plumbing
    title: R6.2 — seed plumbing, backward-compatible
    goal: Every non-harness consumer of dist/index.js can be pointed at a stage1 binary, and a fresh clone or agent session can fetch a released seed; defaults unchanged
    verification: bash scripts/fetch-seed.sh && NISH=build/nish bash docs/cookbook/regen.sh --check && NISH=build/nish bash scripts/smoke.sh && npm run check && npm test (undegraded, skip count reported)
    todos:
      - id: fetch-seed
        content: Add scripts/fetch-seed.sh downloading the last release tarball into build/seed, reusing install.sh's download logic — see Seed plumbing
        status: pending
      - id: seed-slot
        content: Teach tests/self/seed.js the build/seed slot ahead of the stage0 fallback, keeping the fallback — see Seed plumbing
        status: pending
      - id: session-hook
        content: Make .claude/hooks/session-start.sh fetch the seed and allow build/nish in .claude/settings.json — see Seed plumbing
        status: pending
      - id: consumers-compiler-flag
        content: Give scripts/smoke.sh, docs/cookbook/regen.sh, bench/*.mjs, tests/nish/run.ts and tests/nish/cli.ts a compiler override (NISH env or argv), default unchanged — see Seed plumbing
        status: pending
  - id: harness
    title: R6.1 — the golden harness and CI on stage1
    goal: tests/run.js and ci.yml run with no dist/ at all — every case compiled by one seed-built stage1, stage0-comparison checks removed, stage0-internal guards ported
    verification: rm -rf dist build/test && NISH_BOOTSTRAP=<released nish> node tests/run.js exits 0, prints no DEGRADED, skip count no higher than main; git grep -nE 'dist/|src/' tests/run.js shows only intentional prose
    todos:
      - id: harness-stage1
        content: Repoint tests/run.js section A and every cli spawn to one stage1 linked at build/nish-test, delete batch gate and tests/batch_*.js — see Harness
        status: pending
      - id: harness-goldens
        content: Regenerate the 89 reject .err files from tests/self/parser_refusals.txt, dump_ast.stdout and dump_checked root normalisation; empty the register — see Harness
        status: pending
      - id: harness-oracles-off
        content: Stop invoking the six oracles, --parity, flags-only parity, stage0 coverage pass, arrow-parity, fuzz-vs-Node, registry equality, ddc-tag checks — see Harness
        status: pending
      - id: harness-guards
        content: Port RUNTIME_FUNCTIONS vs nish.h, allocating-builtins and seed-target guards onto stage1 and self/ sources; delete WP0 validator timing — see Harness
        status: pending
      - id: ice-hook
        content: Add the NISH_SIMULATE_ICE hook to self/compile.ts and self/ice.ts and repoint the four exit-70 checks — see Harness
        status: pending
      - id: harness-bootstrap
        content: Rewrite tests/self/bootstrap.js onto the seed (IR(stage1)==IR(stage2), stage3==stage2) — see Harness
        status: pending
      - id: harness-ci
        content: ci.yml test/runner jobs fetch the seed; size report, smoke, cookbook use build/nish; delete batch-parity, parity-select, parity-changed and parity.yml — see Harness
        status: pending
  - id: tools
    title: R6.3 — surviving tools off stage0
    goal: Every test tool that outlives stage0 runs on the seed or a named compiler, and stage0's last unrecorded answers are frozen as goldens
    verification: node scripts/gen-diagnostic-codes.mjs --check && node tests/diagnostic_coverage.js --compiler build/nish --require-coverage --strict-refusals && node tests/self/support_oracle.js with dist removed drops zero lines && node tests/differential/goldens.js --fresh
    todos:
      - id: support-golden
        content: Record support_oracle's stage0-only lines as tests/self/goldens/support.txt while dist exists — see Tools
        status: pending
      - id: codes-freeze
        content: Freeze scripts/gen-diagnostic-codes.mjs — self/codes.ts is the hand-kept registry, --check validates format and uniqueness — see Tools
        status: pending
      - id: wordings-fold
        content: Fold tests/wordings/stage0_only.txt into unreachable.txt and remove the mechanism from tests/diagnostic_coverage.js — see Tools
        status: pending
      - id: differential-frozen
        content: Make tests/differential/{lib,run,goldens,fuzz,unmodified}.js frozen/seed-only with a no-frozen-rewrite register — see Tools
        status: pending
      - id: tools-seed
        content: Drop dist fallbacks from tests/nish-cmp.js, lexer/parser oracles, scripts/arrow-verify.mjs — see Tools
        status: pending
  - id: rules
    title: R6.4 — rules and documents
    goal: No rule, guide or live document instructs anyone to implement in src/ or treats stage0 as a live compiler
    verification: node docs/check-links.mjs && node tests/run.js seed && node tests/run.js AI && git grep -nE 'src/|stage0' CLAUDE.md AGENTS.md .claude/*.md shows only historical references
    todos:
      - id: rules-agent
        content: Rewrite CLAUDE.md, AGENTS.md and .claude/*.md for one compiler — see Rules
        status: pending
      - id: rules-docs
        content: Rewrite README.md, docs/{ARCHITECTURE,MASTER_PLAN,INSTALL,LANGUAGE,IR_COOKBOOK,wp10-ci,wp12-release}.md, PR template; repoint the two src/ links — see Rules
        status: pending
      - id: rules-wp19
        content: Mark the wp19 R6 row and M6 done with dated measurements — see Rules
        status: pending
  - id: deletion
    title: R6.5 — the deletion
    goal: src/, tsconfig's src project, the typescript runtime dependency, the six oracles and every remaining stage0 path are gone, and main is green
    verification: npm ci && npm run check && npm test (undegraded) && npm pack --dry-run shows no src/ dist/ or typescript dependency && CI green including bootstrap and nish-cmp rows
    todos:
      - id: delete-src
        content: Delete src/**, the six oracles, tests/self/{parity,stage1_only}.js, stage1_only.txt, tests/differential/{rewrite,arrow-parity}.js — see Deletion
        status: pending
      - id: package-json
        content: Rewrite package.json scripts, move typescript to devDependencies, exclude scripts/arrowify.mjs, tsconfig.json as the ambient noEmit project — see Deletion
        status: pending
      - id: release-bootstrap
        content: Seed release.yml binaries and scripts/bootstrap.sh from the previous release; delete the ddc job, .github/ddc-tag.sh and seed.js's stage0 fallback — see Deletion
        status: pending
---

## Context

stage0 (`src/`, TypeScript on Node, built by `tsc` into `dist/`) is today the golden harness's compiler, a bootstrap seed and the oracle for stage1 (`self/`). wp19 §5 R6 is its deletion. The gates are closed except one ordering fact: `nish-cmp`, the successor to `ir_oracle`/`interop_oracle`, has `cmpSince: 0.6.0` ([.github/seed-targets.json](../../.github/seed-targets.json)), so it has no CI row until the v0.6.0 Release PR (#130, human-merged) ships. The human decision §5a reserves was taken at plan sign-off: go, gated.

## Approach

- **Repoint first, delete last.** Four stages move every consumer onto stage1 while `src/` still exists, so R6.5 is close to pure removal.
- **Merge gate on top of the normal one** for harness, tools, rules, deletion: v0.6.0 released, tag `ddc-0.6.0` exists, `nish-cmp` green on `main`. No release is cut between the harness merge and the deletion merge (the ddc tag would be false). seed-plumbing is backward-compatible and merges as soon as it is green.
- **Decisions taken at sign-off:** `npm run check` becomes an ambient `tsc --noEmit` over `self/`, `std/`, `tests/nish` against `runtime/nish.d.ts`; the diagnostic-code generator is frozen; the ICE hook is ported to `self/`. Defaults the lead chose: `npm test` builds its own stage1 from the seed; seed from `scripts/fetch-seed.sh` (upstream releases); the 41 stage0-worded `tests/wordings` cases stay as declared stage1 parser refusals with stage1's sentence; WP0 validator timing is deleted (it timed stage0's validator); new corpus programs with no frozen rewrite are named in a register rather than silently skipped.
- **Coverage gate:** this repo has no coverage command; its equivalent is an undegraded `npm test` whose skip count is read and reported, plus the per-stage verification line.
- **Rolling freeze:** `self/` edits (the ICE hook) use only constructs the 0.5.0 seed compiles (`getenv` is in it).

## Seed plumbing

Owns: `scripts/fetch-seed.sh` (new), `tests/self/seed.js`, `.claude/hooks/session-start.sh`, `.claude/settings.json`, `scripts/smoke.sh`, `docs/cookbook/regen.sh`, `bench/*.mjs`, `tests/nish/run.ts`, `tests/nish/cli.ts`, `web/compile.mjs`.

`fetch-seed.sh` downloads `nish-<last-release>-<asset>.tar.gz` into `build/seed/` (idempotent, no-op if present). `seed.js` looks at `NISH_BOOTSTRAP`, then `build/seed`, then (still) stage0. Each consumer takes `NISH=<compiler>` (scripts) or a `--compiler`/argv (bench, nish harnesses); defaults stay `dist/index.js` so `tests/run.js` is unaffected. `cli.ts`'s ICE check probes for the hook instead of keying on "is a Node entry point". The session hook fetches the seed after `npm install`.

## Harness

Owns: `tests/run.js`, `tests/batch_compile.js`, `tests/batch_worker.js`, `tests/cases/**`, `tests/self/parser_refusals.txt`, `tests/self/reject_oracle.js`, `tests/self/bootstrap.js`, `self/compile.ts`, `self/ice.ts`, `.github/workflows/ci.yml`, `.github/workflows/parity.yml`, `scripts/ci-profile.mjs`.

- One stage1 built by `seedForOracle` and linked at `build/nish-test` (its parent must be the repo root: `packageRoot()` climbs from argv[0], `self/compile.ts:602-621`), spawned per case through `tests/pool.js`. No `dist` literal remains in `run.js`.
- Section-by-section dispositions are in [r6-stage0-deletion.inventory.md](r6-stage0-deletion.inventory.md): repoint every `cli` spawn; delete `--parity`, the batch gate, the register handling, the fixture's second compile, the six oracle invocations, flags-only parity, stage0-seed `bootstrap.sh` checks (the capability itself stays until R6.5), every "theirs" comparison, `src/codes.ts` equality (reader self-tests run on `self/codes.ts`), the stage0 coverage pass (cap becomes 5 on the stage1 run), arrow-parity, fuzz-vs-Node, the ddc-tag checks, the parity selector.
- Guards are ported, never deleted: `RUNTIME_FUNCTIONS` vs `nish.h` and the allocating-builtin noalias set from stage1 `--runtime-decls` / `self/escape.ts`; seed targets from `self/target.ts`.
- Goldens that change: the 89 `reject_*.err` in `parser_refusals.txt` take stage1's sentence and the register empties; `dump_ast.stdout` takes stage1's format; `dump_checked*` normalise `${root}/`. Any other golden that changes is a finding, not an update.
- CI: `test` and `runner` fetch the seed; size report, smoke and cookbook use `build/nish`; delete `batch-parity`, `parity-select`, `parity-changed` and `parity.yml`. Quote before/after wall-clock of `npm test` in the PR.

## Tools

Owns: `tests/diagnostic_coverage.js`, `tests/wordings/**`, `tests/differential/{lib,run,goldens,fuzz,unmodified}.js`, `tests/nish-cmp.js`, `tests/lexer_oracle.js`, `tests/parser_oracle.js`, `tests/self/{support_oracle,goldens,corpus}.js`, `tests/self/goldens/support.txt` (new), `scripts/{gen-diagnostic-codes,codes-registry,arrow-verify}.mjs`/`.js`.

Keep every CLI flag `tests/run.js` passes to these tools stable. `stage0_only.txt` folds into `unreachable.txt` as retired codes; that part merges after harness (stage0 coverage pass gone). Differential fuzz default mode (vs Node) and the live rewriter are removed; a register names corpus programs with no frozen rewrite.

## Rules

Owns: `CLAUDE.md`, `AGENTS.md`, `.claude/{orientation,selfhost,node,testing,typescript,architecture,comments}.md`, `README.md`, `docs/{ARCHITECTURE,MASTER_PLAN,INSTALL,LANGUAGE,IR_COOKBOOK,wp10-ci,wp12-release,wp19-stage0-retirement}.md`, `.github/PULL_REQUEST_TEMPLATE.md`, comment-only edits in `bin/*.js`, `scripts/{build.sh,postinstall.mjs,platform-package.mjs}`, `install.sh`, `runtime/nish.h`, `runtime/runtime_os.c`, `std/README.md`, `examples/*`.

Definition of done becomes: `npm run check` (ambient tsc) and undegraded `npm test`; a construct is implemented in `self/` only, with the rolling freeze. Keep the prose phrasings `tests/run.js` reads (around `:8500`) and wp14/wp19 heading anchors. Historical `docs/wp*.md`, `CHANGELOG.md`, `changelog/*.json` are untouched.

## Deletion

Spawned only after harness, tools and rules have merged, so it may edit any file. Owns: `src/**`, `tsconfig.json`, `package.json`, `package-lock.json`, `biome.json`, `.gitignore`, the six oracles (`tests/self/{types,diagnostics,symbols,checked,ir,interop}_oracle.js`), `tests/self/{parity,stage1_only}.js`, `tests/self/stage1_only.txt`, `tests/differential/{rewrite,arrow-parity}.js`, `.github/workflows/release.yml`, `.github/ddc-tag.sh`, `.github/seed-matrix.sh`, `.github/seed-targets.json` (notes), `scripts/bootstrap.sh`, `tests/self/seed.js` (fallback), plus residual lines anywhere.

`package.json`: `build` = seeded `bootstrap.sh` to `build/nish`; `check` = `tsc -p tsconfig.json` (ambient, noEmit, `types: []`, `@ts-expect-error` on the known `pop` line); `test` = `node tests/run.js`; `typescript` in devDependencies; `files` adds `!scripts/arrowify.mjs`. `release.yml` binaries seed from the previous release; ddc job removed.

## Out of scope

- The `self/**` comment sweep (448 references) and the stale `self/parser.ts:787` caveat — a follow-up.
- Historical work-package documents other than wp10, wp12, wp19.
- #94 (resolved by deletion, no work).

## Acceptance criteria

1. `src/` does not exist on `main`, and no tracked file reads `dist/index.js`, `../dist/`, or imports `src/`.
2. `typescript` is not a runtime dependency: `npm pack --dry-run` lists no `src/`, no `dist/`, and no shipped file importing `typescript`.
3. The six oracles, `parity.js`, `stage1_only.{js,txt}`, `parity.yml` and the parity/batch CI jobs are gone.
4. From a fresh clone with no `dist/`, `npm ci && npm run check && npm test` exits 0 with no DEGRADED line and a skip count no higher than before R6.
5. `npm run build` from a fresh clone produces a `build/nish` that compiles, links and runs a hello program and a program importing `nish/text`.
6. CI on `main` after the last merge is green, including `bootstrap` and `nish-cmp` rows.
7. The ported guards still run against stage1: runtime decls vs `nish.h`, allocating builtins, seed targets, and the exit-70 ICE path.
8. `CLAUDE.md`, `AGENTS.md` and `.claude/*.md` describe one compiler; `node docs/check-links.mjs` passes.
9. The wp19 R6 row records the deletion with a dated measurement, and the merged commits carry conventional subjects that become CHANGELOG entries.

## Verification

Per stage, the `verification` line above. Every stage additionally runs `npm run check`, `npm run lint`, and an undegraded `npm test`, reporting the skip count.
