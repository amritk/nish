---
name: std instruction gate — the json-value regrowth fix and the gate that would have caught it
overview: PR #2103 swapped jsonValueRoom's and jsonValueRoomI32's bulk new Array + set for a push-per-element loop, which costs a fresh JsonDocument parse about 34% on a lint kernel (143.4M to 192.0M a call). No counted program imported nish/json-value when it landed, and #2103 rewrote the baselines in bulk. This package restores the bulk grow and audits std/ for the same shape. It adds counted rows that grow a document from empty, a check that every std module reaches a counted program, and a guard that fails any baseline raise not recorded with a reason. It also adds the rule that panic work may not raise a count.
priority: 240
labels: [ready]
stages:
  - id: s1-room-fix
    title: json-value bulk regrowth, and the std/ audit for push-loop copies
    goal: jsonValueRoom and jsonValueRoomI32 grow with new Array + set again. The user's repro costs no more than the 0.44.0 seed built in the same container, and every std helper found with the same push-loop shape is either fixed or reported with its delta.
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js json && node tests/run.js yaml && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/self/goldens.js && NISH=build/nish bash docs/cookbook/regen.sh --check && node tests/nish-cmp.js
    todos:
      - id: s1-fix
        content: Rewrite jsonValueRoom (std/json-value.ts:2338) and jsonValueRoomI32 (:2355) to new Array<T>(target) + a guarded grown.set(a, 0), the form the requirements quote. It must compile with no flag (strict), and the std-panics count for json-value must stay 0.
        status: pending
      - id: s1-measure
        content: Build the requirements' repro program (bench/std-json-value-parse.ts in S2; keep it in the scratchpad here) with build/seed/bin/nish (0.44.0), main and main+fix. Report the gen-subtracted cachegrind counts for text and ranged. Fix is done when both are at or below the seed's.
        status: pending
      - id: s1-tokenizer
        content: Profile JsonTokenizer.string under callgrind on the repro (1.01M to 2.16M a call between 0.44 and main). Fix its doubling if it has the same shape, or explain the delta in the PR body.
        status: pending
      - id: s1-audit
        content: Audit std/ for push loops that copy or zero-fill (grown.push(a[i]), out.push(xs[i]), while (x.length < n) x.push(0)) and for helpers named *Room, *Grow or *Grown. Cover std/array.ts slice and sliceAll, quicFrameGrow, websocketMessageRoom, quicListenerRoom, pgAsyncRoom, serveGrown, handlerGrown and termFlushRoom. Rewrite each one that new Array + set (std/yaml.ts yamlRoomU8 and yamlRoomI32 are the model) can make provably panic-free with no new site. Put a table in the PR body with one row per helper (changed or not, why, instruction delta on an existing counted row or a scratch program).
        status: pending
      - id: s1-pins
        content: Regenerate the pinned std line numbers (tests/link/*/expected.caps.json, tests/wordings/*.err, docs/reference/diagnostics/), the checked goldens, docs/reference and the cookbook. Add the nish-cmp DECLARED entries the IR moves need. Leave bench/instructions.json alone; lower counts pass --check and S2 locks them in.
        status: pending
  - id: s3-raise-guard
    title: explicit baseline raises in bench/instructions.json
    goal: No instruction baseline can rise without a recorded {row, from, to, why, pr} entry. The update command refuses an unnamed raise, and a base-vs-head comparison fails an unrecorded one.
    verification: node tests/run.js instructions && node tests/run.js bench && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    todos:
      - id: s3-schema
        content: Add a "raises" array to bench/instructions.json (each entry {row, from, to, why, pr}) and validate its shape where the file is read.
        status: pending
      - id: s3-update
        content: Make node bench/run.mjs --instructions --update refuse to write a count above the stored one, beyond tolerance, unless that row is named with --raise <row> --why "...". A named raise appends its raises entry (pr filled in or left for the PR to fill).
        status: pending
      - id: s3-compare
        content: Add scripts/instruction-raises.mjs. It takes a base instructions.json and a head one, prints a per-row base/head/delta% table (stdout, and GITHUB_STEP_SUMMARY when set), and exits non-zero on any row that rose above tolerance with no raises entry matching row, from and to. New and removed rows are listed, not failed.
        status: pending
      - id: s3-tests
        content: Add tests/run.js checks that run the comparison on fixture pairs (a deliberately raised row with no entry fails, the same with an entry passes, a fall passes) and that --update refuses an unnamed raise (a dry run on a temp copy, never the real file). In the PR, show the failing output once, then the passing one. Document in bench/README.md.
        status: pending
  - id: s2-counted-rows
    title: counted rows that grow from empty, and a check that every std module has one
    goal: Six new counted programs exercise json-value growth, reuse and reads, a YAML-to-JSON load, regex and text. A tests/run.js check fails when a std module is not reached, directly or transitively, by any counted program and is not on a reasoned exemption list.
    depends: [s1-room-fix, s3-raise-guard]
    verification: node tests/run.js instructions && node tests/run.js bench && node tests/run.js std-panics && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node tests/self/goldens.js && node tests/nish-cmp.js
    todos:
      - id: s2-rows
        content: Add STD_COUNTED rows, each a bench/<name>.ts plus .args, about 300M instructions, each growing from an empty document. std-json-value-parse (about 2 MiB, parseText and parseTextRanged, fresh JsonDocument each time, from the requirements' repro). std-json-value-reuse (one document, n parses). std-json-value-read (get/at/keyAt/string/keyStart/start over every node). std-yaml-json-load (about 1 MiB of YAML with anchors and merge keys through parseYaml + YamlJsonLoader.load, fresh each time; named so, because std-yaml-json already exists). std-regex (regexCompile, test and findAll; one pattern with a literal prefix, one without). std-text (indexOfAny, splitLines, trim over about 1 MiB).
        status: pending
      - id: s2-baselines
        content: Record the new rows' baselines, and lower every row S1 made cheaper, from CI's table on this PR's head, never a local run. The counts are with S1's fix in place. Use the S3 --update path; no raise is expected. If one appears, stop and report it.
        status: pending
      - id: s2-coverage
        content: Add a tests/run.js check that walks each counted program's import graph (bench/instructions.json programs, transitive through std/). It fails naming every git-tracked std module the std-panics section scans that no counted program reaches and that no line of the new exemption file (one module and reason a line; it only shrinks) lists. nish/regex and nish/collections must also be reached. Show it failing once in the PR (before the rows or the exemptions), then passing.
        status: pending
      - id: s2-pins
        content: Regenerate tests/self/goldens/checked/ (it pins bench/**/*.ts) and add any nish-cmp entries the new bench programs need.
        status: pending
  - id: s4-rule-ci
    title: the no-raise rule for panic work, and the raise comparison in CI
    goal: CI compares every row against the merge-base's bench/instructions.json on each PR and writes the table to the step summary. CLAUDE.md and the open std-panics plans state that a change removing a panic site may not raise a count.
    depends: [s3-raise-guard]
    verification: npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node tests/run.js ci-scope
    todos:
      - id: s4-ci
        content: Add a step to .github/workflows/ci.yml that fetches the merge-base (checkout is shallow), extracts its bench/instructions.json and runs scripts/instruction-raises.mjs against the head's, failing the job and writing the table to the step summary. Put it in a job that ci-gate requires; on a push to main, compare against the parent. Keep scripts/ci-scope.mjs in step if the job's read set changes.
        status: pending
      - id: s4-rule
        content: Add the rule to CLAUDE.md's definition of done and to the "Rules every stage of this package follows" section of each open .claude/plans/wp8x-std-panics-*.plan.md. A change that removes a panic site may not raise any instruction count. If a proof needs a slower form, teach the prover (as #2303 did) or record the raise under bench/instructions.json raises with a measured reason.
        status: pending
  - id: s5-prover-length
    title: the prover carries new Array<T>(n).length === n
    goal: After const grown = new Array<T>(n), bounds.ts knows grown.length is n until grown is changed. The grown.length guards S1 added can go, with no new NL9007 and no std-panics rise.
    depends: [s2-counted-rows]
    verification: node tests/run.js link && node tests/run.js std-panics && node tests/run.js instructions && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node tests/self/goldens.js && NISH=build/nish bash docs/cookbook/regen.sh --check && node tests/nish-cmp.js
    todos:
      - id: s5-prover
        content: Teach src/bounds.ts the fact, killed by any write to the binding or a length-changing call on it. Add a tests/link positive that proves grown.set(a, 0) under a.length <= n, and a negative where a push in between makes it unproven again.
        status: pending
      - id: s5-unguard
        content: Remove the grown.length guards in jsonValueRoom, jsonValueRoomI32 and every S1 helper that has one, and confirm strict compile and std-panics stay as they were. Regenerate the pins, goldens, cookbook and nish-cmp entries.
        status: pending
  - id: s6-emit-ts-encodes
    title: an encode count for the --emit-ts reading of the JSON and YAML rows
    goal: A tests/run.js check counts runtime/core/strings.mjs encodes in the --emit-ts reading of std-json-value-parse and std-yaml-json-load and fails above a pinned ceiling, so a re-encoding regression like the one #2108 fixed fails a test.
    depends: [s2-counted-rows]
    verification: node tests/run.js emit-ts && npm run check && npm run lint && npm run lint:dead
    todos:
      - id: s6-count
        content: Count encodes with an instrumented strings.mjs or a counter hook under a test-only flag, never a timing. Pin each program's ceiling at its measured count, and show the check failing on a reintroduced re-encode.
        status: pending
---

# std instruction gate

## Context

On 09a6f22a the user measured a 3 MB OpenAPI lint kernel at 143.4M
instructions a call on 0.44.0, 192.0M on main and 137.9M on main with the
step 1 fix. Callgrind shows `nish.jsonValueRoom` going from 1.26M to 60.25M,
and the memset going from 7.54M to 0, because #2103 moved the zero-fill into
the push loop. The user's repro, parse cost with `gen` subtracted:

| | 0.44.0 | main | main+fix |
| --- | --- | --- | --- |
| parseText | 178.69M | 199.71M | 157.30M |
| parseTextRanged | 196.34M | 215.52M | 172.04M |

Since that measurement, main (ad29ae37) has gained `std-yaml-json`,
`std-yaml-parse` and `std-json-equal` counted rows (#2388). Their baselines
were recorded with the regression in place, so S1 makes them fall and S2
locks the fall in.

## Rules every stage of this package follows

- No stage raises an instruction count. A count that falls is locked in
  from CI's table, never from a local run.
- `tests/std-panics.json` never goes up, and json-value stays at zero sites.
- Generated files are regenerated, never hand-edited: goldens, docs/reference,
  the cookbook, the pinned std line numbers.
- Commit subjects are conventional (`perf(runtime)`, `test(self)`,
  `ci(self)`). They carry every nish-cmp `changelog:` string the PR adds,
  verbatim.
- No session links, model names or attribution trailers in commits or PR
  text (the repo's no-attribution hook enforces this).

## Owns

| Stage | Owns |
| --- | --- |
| s1-room-fix | `std/**`, `tests/std-panics.json`, `tests/link/**/expected.caps.json`, `tests/wordings/**`, `docs/reference/**`, `docs/IR_COOKBOOK.md`, `tests/self/goldens/checked/**`, `tests/nish-cmp.js` |
| s3-raise-guard | `bench/run.mjs`, `bench/instructions.json`, `bench/README.md`, `scripts/instruction-raises.mjs`, `tests/run.js`, `tests/fixtures/instruction-raises/**` |
| s2-counted-rows | `bench/*.ts`, `bench/*.args`, `bench/run.mjs`, `bench/instructions.json`, `bench/README.md`, `bench/instructions-exempt.txt`, `tests/run.js`, `tests/self/goldens/checked/**`, `tests/nish-cmp.js` |
| s4-rule-ci | `.github/workflows/ci.yml`, `scripts/ci-scope.mjs`, `CLAUDE.md`, `.claude/plans/wp8*-std-panics-*.plan.md` (sensitive: awaits human merge) |
| s5-prover-length | `src/bounds.ts` (and the `src/` files it needs), `std/**` guards only, `tests/link/**`, `tests/cases/**`, `tests/wordings/**`, `docs/reference/**`, `docs/IR_COOKBOOK.md`, `tests/self/goldens/checked/**`, `tests/differential/**`, `tests/nish-cmp.js` |
| s6-emit-ts-encodes | `tests/run.js`, `runtime/core/strings.mjs` (a test-only counter, if needed) |

Merge order: s1 and s3 run concurrently. s2 follows both, and s4 follows s3.
s5 and s6 follow s2. Shared files (`tests/run.js`, the goldens,
`tests/nish-cmp.js`) are only ever held by stages that are ordered, never by
two concurrent ones.

## Acceptance criteria

1. On main, the requirements' repro built with `build/nish` costs no more,
   with `gen` subtracted, than the same program built with the 0.44.0 seed,
   for both `text` and `ranged`, measured in one container under cachegrind.
2. `bench/instructions.json` has the rows std-json-value-parse,
   std-json-value-reuse, std-json-value-read, std-yaml-json-load, std-regex
   and std-text. Each has a `bench/<name>.ts` and `.args`, and
   `node tests/run.js instructions` passes and counts them.
3. Removing every counted program that imports nish/json-value, or adding a
   std module no counted program reaches, makes a `tests/run.js` check fail
   and name the module. On main the check passes, and its exemption file
   gives a reason on every line.
4. `node bench/run.mjs --instructions --update` refuses to raise a row that
   is not named with `--raise <row> --why`. `scripts/instruction-raises.mjs`
   fails on a raised row with no raises entry and passes once the entry
   exists. The S3 PR shows both outputs.
5. On a pull request, CI runs the merge-base comparison as a required check
   and writes the base/head/delta% table to the step summary.
6. CLAUDE.md and every open wp8x std-panics plan state that a change
   removing a panic site may not raise an instruction count.
7. On main after the run, `tests/std-panics.json` totals no more than 940,
   and json-value has no sites.
8. Every merged PR's head was green on all nine test shards and ci-gate.
   The S1 PR body has a before/after count for each audited helper, and the
   S2 PR body has one for each new row.
