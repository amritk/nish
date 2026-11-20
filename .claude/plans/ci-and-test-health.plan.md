---
name: CI and test-suite health — flakes, gaps and the critical path
overview: CI still has a roughly 12 minute critical path set by shard 1, a shard 8 log that loses its summary, intermittent link test failures, and several test and measurement gaps left by closed feature runs. Each is a small stage here so the suite is trustworthy and fast again.
priority: 70
issue: 1851
stages:
  - id: s1-shard8-log
    title: CI S1 — keep shard 8's test summary when the job log is truncated
    goal: Each test shard's skip count and any FAIL line survive a truncated job log, through the step summary or an uploaded artifact, and the cause of the truncation is identified or ruled out.
    verification: node scripts/ci-scope.mjs --help >/dev/null 2>&1; node tests/run.js ci-scope && npm run lint
    status: pending
    issue: 1836
    todos:
      - id: s1-find-cause
        content: Look for control sequences, invalid UTF-8 or NUL in the output of the link/std_* programs run near the end of shard 8 and fix the program that writes them — see CI S1 — keep shard 8's test summary
        status: pending
      - id: s1-summary
        content: Write the runner's summary line to GITHUB_STEP_SUMMARY and upload RUNNER_TEMP/test.log as an artifact in the test job of .github/workflows/ci.yml — see CI S1 — keep shard 8's test summary
        status: pending
      - id: s1-scope
        content: Update scripts/ci-scope.mjs and its tests/run.js ci-scope check for any new file the job now reads — see CI S1 — keep shard 8's test summary
        status: pending
  - id: s2-critical-path
    title: CI S2 — bring the critical path under 11 minutes by rebalancing shard 1 and the golden cases
    goal: Three green main runs show the longest test job at 11 minutes or less, test spread at 3.5 or less, and runner shards at 10.5 or less.
    verification: node tests/run.js ci-scope && node tests/run.js shard-costs && npm run lint
    status: pending
    issue: 1466
    todos:
      - id: s2-shardone-cost
        content: Measure shardOne in tests/shard-costs.json including the shard-1-only tail steps of .github/workflows/ci.yml, or move some of those steps to other shards — see CI S2 — bring the critical path under 11 minutes
        status: pending
      - id: s2-golden-deal
        content: Deal the golden cases by cost instead of round-robin in casesHere in tests/nish/run.ts — see CI S2 — bring the critical path under 11 minutes
        status: pending
      - id: s2-main-concurrency
        content: Check whether the concurrency group of ci.yml still cancels push-to-main runs under load and record the answer on the issue — see CI S2 — bring the critical path under 11 minutes
        status: pending
      - id: s2-flake-reruns
        content: Run node tests/run.js file-server and crypto-bench ten times each under load in the foreground and record the counts, settling criteria 1 to 3 of the earlier run — see CI S2 — bring the critical path under 11 minutes
        status: pending
  - id: s3-net-relay-flake
    title: CI S3 — find why net_relay and net_relay_f64 identity checks fail intermittently on CI
    goal: The failing runner state is identified from captured id.error text and file bytes, the race is fixed in the test or in examples/relay/identity.ts, and net_relay_f64 stops failing shard 3.
    verification: node tests/run.js net_relay && node tests/run.js net_relay_f64
    status: pending
    issue: 1689
    todos:
      - id: s3-capture
        content: Make identityChecks in tests/link/net_relay/setup.ts print the failing id.error text and the identity files' bytes instead of only expected true — see CI S3 — find why net_relay identity checks fail
        status: pending
      - id: s3-compare
        content: Compare the net_relay and net_relay_f64 identity directories on a failing runner, using the captured output, and name the shared state — see CI S3 — find why net_relay identity checks fail
        status: pending
      - id: s3-fix
        content: Fix the race in relayLoadPem or RelayWatch in examples/relay/identity.ts, or in the test, with no retry added — see CI S3 — find why net_relay identity checks fail
        status: pending
  - id: s4-spawn-grandchild
    title: CI S4 — decide whether spawnPipedWithin kills a timed-out child's descendants
    goal: The behaviour is either documented as intended, with a guide line and RT-49 unchanged, or an opt-in way to reach the whole tree exists with its security record.
    verification: node tests/run.js std_process && node scripts/security-scope.mjs && npm run lint
    status: pending
    issue: 1401
    labels: [needs-decision]
    todos:
      - id: s4-decide
        content: Record the owner's decision on the issue and act on it — see CI S4 — decide whether spawnPipedWithin kills descendants
        status: pending
      - id: s4-docs
        content: If the behaviour stays, add a line to the guide page and keep the RT-49 wording in docs/security/runtime.md and the runtime/nish.d.ts doc comment — see CI S4 — decide whether spawnPipedWithin kills descendants
        status: pending
  - id: s5-prefork-reaped
    title: CI S5 — make net_prefork step 7's reaped check able to fail
    goal: The reaped assertion in tests/link/net_prefork/main.ts holds on every path, or the gap is accepted and recorded.
    verification: node tests/run.js net_prefork
    status: pending
    issue: 1333
    labels: [needs-decision]
    todos:
      - id: s5-decide
        content: Record the decision between a child-subreaper builtin for the driver and accepting the gap noted at tests/link/net_prefork/main.ts lines 500 to 503 — see CI S5 — make net_prefork step 7's reaped check able to fail
        status: pending
      - id: s5-implement
        content: If a subreaper is chosen, add it for step 7 of tests/link/net_prefork/main.ts and cover it with the security record for the new builtin — see CI S5 — make net_prefork step 7's reaped check able to fail
        status: pending
  - id: s6-const-shift-negative
    title: CI S6 — pin the refusal of shift and bitwise operators in a constant table
    goal: A tests/link negative provokes the refusal of a shift in a constant and in a constant table element, closing the last bullet of the constant-table pinning issue.
    verification: node tests/run.js link && node tests/run.js diagnostic-coverage
    status: pending
    issue: 1640
    todos:
      - id: s6-negative
        content: Add a tests/link negative with expected.err for a left shift in a constant and in a table element — see CI S6 — pin the refusal of shift operators in a constant table
        status: pending
  - id: s7-node-wasi-flag
    title: CI S7 — drop the no-turbo-fast-api-calls flag once Node fixes WASI fast calls
    goal: examples/wasi-host.mjs runs with no setFlagsFromString line and the repro table shows 0 crashes on CI's Node.
    verification: WASI_SYSROOT=/usr node tests/run.js wasi
    status: pending
    issue: 732
    labels: [deferred]
    todos:
      - id: s7-recheck
        content: Re-run the repro on the Node that ci.yml pins when a release carries the node_wasi.cc fix, with and without the flag — see CI S7 — drop the no-turbo-fast-api-calls flag
        status: pending
      - id: s7-remove
        content: Remove the setFlagsFromString call in examples/wasi-host.mjs and update the note beside it — see CI S7 — drop the no-turbo-fast-api-calls flag
        status: pending
  - id: s8-sqlite-link-cost
    title: CI S8 — re-measure the nish/sqlite link cost after the adapter change
    goal: docs/sqlite-cursor.md has a row measured at a commit containing 9996c9b1, with its machine, for both profiles, cold and cached.
    verification: node scripts/gen-reference.mjs --check && node docs/check-links.mjs
    status: pending
    issue: 1822
    todos:
      - id: s8-measure
        content: Repeat the design note's link-cost measurement of the same program on current main for debug and speed, cold and cached — see CI S8 — re-measure the nish/sqlite link cost
        status: pending
      - id: s8-row
        content: Add the row naming the commit and machine to "The build decision" in docs/sqlite-cursor.md and say if the cold link left the recorded spread — see CI S8 — re-measure the nish/sqlite link cost
        status: pending
  - id: s9-link-lto-record
    title: CI S9 — decide what the speed-link-lto record still owes
    goal: The three partial acceptance criteria are settled, either by the missing figures or by a recorded decision.
    verification: node docs/check-links.mjs && npm run lint
    status: pending
    issue: 915
    labels: [needs-decision]
    todos:
      - id: s9-native-objects
        content: Decide whether to measure the native-runtime-objects option on performance and the size report, or accept the record, in the options table of the link-time design note — see CI S9 — decide what the speed-link-lto record still owes
        status: pending
      - id: s9-readme-lines
        content: Decide whether README.md line 412 and std/README.md line 316 should name the lld partition flag, and edit them if so — see CI S9 — decide what the speed-link-lto record still owes
        status: pending
  - id: s10-bench-reporting
    title: CI S10 — close the stdlib-microbench reporting gaps
    goal: sha256-block has an instruction-count mode like the other benches, and the jwt-verify and sha256-block READMEs each keep a ranked list of next candidates.
    verification: node bench/sha256-block/run.mjs --help && npm run lint
    status: pending
    issue: 1195
    todos:
      - id: s10-sha-instructions
        content: Add a callgrind or cachegrind instruction mode to bench/sha256-block/run.mjs matching http1-request and pg-decode — see CI S10 — close the stdlib-microbench reporting gaps
        status: pending
      - id: s10-ranked-lists
        content: Add a ranked next-candidates section to bench/jwt-verify/README.md and bench/sha256-block/README.md — see CI S10 — close the stdlib-microbench reporting gaps
        status: pending
  - id: s11-console-log-write
    title: CI S11 — stop console.log interleaving between prefork workers
    goal: Two workers printing one line each on a shared pipe never interleave, by one write per console.log or by a waitFor that accepts the token without a whole line.
    verification: node tests/run.js postgres-live && node tests/run.js c-symbols && node tests/run.js performance
    status: pending
    labels: [needs-decision]
    issue: 1904
    todos:
      - id: s11-decide
        content: Record the choice between one write per console.log in runtime/runtime.c and a tolerant waitFor in tests/postgres/live/run.mjs — see CI S11 — stop console.log interleaving between prefork workers
        status: pending
      - id: s11-implement
        content: Implement the chosen option with a regression test that fails on the split write — see CI S11 — stop console.log interleaving between prefork workers
        status: pending
  - id: s12-chacha20-link
    title: CI S12 — find why bench/chacha20.ts stops at the link in the ECC-9 sweep
    goal: bench/chacha20.ts builds and links in the sweep that ECC-9 runs, or the reason it cannot is recorded with an issue.
    verification: node tests/run.js bench && npm run lint
    status: pending
    issue: 2002
    todos:
      - id: s12-reproduce
        content: Reproduce the link failure of bench/chacha20.ts from the WP48 S3 run's ECC-9 sweep (1097 of 1098 programs built) and find its cause — see CI S12 — find why bench/chacha20.ts stops at the link in the ECC-9 sweep
        status: pending
---

# CI and test-suite health — flakes, gaps and the critical path

## Context
No roadmap page. These are the open issues from closed feature runs about CI, flaky tests and measurement gaps. Where an issue's own text is already partly done on main, the stage says what is left.

## CI S1 — keep shard 8's test summary when the job log is truncated
#1836: the stored log of `test (ubuntu-latest, shard 8/9)` sometimes stops partway through `tests/link`, losing the summary line and any FAIL line. Three earlier shard 8 jobs on `feature/wp66-c-headers/*` failed with no FAIL line. Candidate cause in the issue: a program writing bytes the log uploader drops. Fix the cause if found and print the summary into `GITHUB_STEP_SUMMARY` or upload `test.log` so the skip count survives. The workflow files fall under `scripts/ci-scope.mjs`; read the "Scoped lanes" rule in `docs/wp10-ci.md`.
Likely files: `.github/workflows/ci.yml`, `scripts/ci-scope.mjs`.

## CI S2 — bring the critical path under 11 minutes by rebalancing shard 1 and the golden cases
#1466: after #1456 shard 1 is the longest job (12.0 to 12.4 min against a target of 11). The golden cases are still dealt round-robin (`tests/nish/run.ts` `casesHere`). The issue's finding about cancelled main runs may be partly addressed: `ci.yml`'s concurrency group now pins a run id for some pushes; check it before changing it. Criteria 1 to 3 (file-server and crypto-bench ten runs under load) were never exercised on merged main.
The ci-under-10 run (tracker #1791) left its first criterion unmet: five or more green PR runs, each under 10 minutes. One run took 9.1 min, and the other took 10.7 min with shard 1 at 614 s. Its second criterion (slowest ÷ median at most 1.25) is met. This stage owns that goal too. Show five green PR runs under 10 minutes, refitting with `node scripts/shard-costs.mjs` if shard 1 keeps running over.

Likely files: `tests/shard-costs.json`, `tests/nish/run.ts`, `.github/workflows/ci.yml`.

## CI S3 — find why net_relay and net_relay_f64 identity checks fail intermittently on CI
#1689: `link/net_relay_f64` failed shard 3 on two spec-only PRs. The sweep's comment lists five failing runs, all in `identityChecks` (`tests/link/net_relay/setup.ts`) through `relayLoadPem` or `RelayWatch`. Ruled out: shared build paths, threads, short I/O, P-256 randomness, CPU dispatch. 200 serial runs under load gave 0 failures here. Next step in the comment: capture the real `id.error` text and file bytes in CI. Fix the race, no retry.
Likely files: `tests/link/net_relay/setup.ts`, `examples/relay/identity.ts`.

## CI S4 — decide whether spawnPipedWithin kills a timed-out child's descendants
#1401: `spawnPipedWithin(["sh","-c","sleep 1000"], ...)` answers -3 and kills `sh`, but dash's forked `sleep` survives. Design kills only the child's pid (RT-19, RT-49).
Likely files: `docs/guide/` page for the call, `docs/security/runtime.md`, `runtime/nish.d.ts`.

### Decision needed
Keep it as documented (callers `exec` or run the program directly) and add a guide line, or offer an opt-in process group or a group kill on the deadline path. The second costs the Ctrl-C trade-off and a new record against RT-19. The issue does not recommend one.

## CI S5 — make net_prefork step 7's reaped check able to fail
#1333: `reaped = !signal(foreign, 0)` cannot fail when the driver reaps the supervisor first, because orphans go to init (comment at `tests/link/net_prefork/main.ts:500-503`). Making the driver a child subreaper (`prctl(PR_SET_CHILD_SUBREAPER)`) would close it, but Nish may have no builtin for that.

### Decision needed
Add a subreaper capability for step 7, which needs a new builtin and its security record, or accept the recorded gap. The issue names the subreaper as the possible fix and the gap as the alternative.

## CI S6 — pin the refusal of shift and bitwise operators in a constant table
#1640: the sweep (#1826, #1829) pinned every bullet except one; what is left is a negative test that `<<` is refused in a constant and in a table element (`Unsupported operator`). `git grep` finds no such test under `tests/`. #1837 lists the same gap; this stage resolves it, and the docs plan's stage for #1837 leaves it here. A new diagnostic is not needed, but the case must be a `tests/link` negative with `expected.err`.
Likely files: `tests/link/<new>/`, `docs/LANGUAGE.md`.

## CI S7 — drop the no-turbo-fast-api-calls flag once Node fixes WASI fast calls
#732: `examples/wasi-host.mjs` sets `--no-turbo-fast-api-calls` because Node 22's WASI segfaults inside a fast API call (nodejs/node#46777, #53087, both closed stale, no fix). Node 24 only stops crashing. Every workflow pins Node 22. Deferred until a Node release stops reporting uvwasi allocations from inside a fast call; the issue recommends keeping the flag even on Node 24.
Likely files: `examples/wasi-host.mjs`.

## CI S8 — re-measure the nish/sqlite link cost after the adapter change
#1822: `docs/sqlite-cursor.md` "The build decision" has rows at `4d0faa4b` and `3765b270`; #1801 (`9996c9b1`) changed `runtime/sqlite/nish-sqlite.c` afterwards. Repeat the measurement with the same program, both profiles, cold and cached, and add a row.
Likely files: `docs/sqlite-cursor.md`, `bench/sqlite/run.mjs`.

## CI S9 — decide what the speed-link-lto record still owes
#915: criterion 1 (ThinLTO and native runtime objects lack performance and size-report figures; native objects linked 9.6 s cold, 7.2 s with partitions, against 8.2 s for the option taken), criterion 4 (README lines on lld partitions) and criterion 6 (the `Measured:` trailer's runtime and size wording) need owner calls. Also unexercised: macOS ld64, GNU ld fallback, core counts other than 4.

### Decision needed
Is the record enough or should the native-objects option be measured properly? Measuring is the only way to know whether the faster candidate holds the gate. Should the two README lines name the partition flag, and does the trailer meet `.claude/testing.md`?

## CI S10 — close the stdlib-microbench reporting gaps
#1195 items 1 and 3. `bench/jwt-verify/run.mjs` now prints max and spread, so that part is done. Still open: `bench/sha256-block/run.mjs` has no instruction-count mode, and the jwt-verify and sha256-block READMEs have no ranked candidates list. Item 2 (band figures in past `Measured:` trailers) cannot be edited in history and is dropped. Items 4 and 6 were done per the triage comment (std_cli_args timing, closed PR).
Likely files: `bench/sha256-block/run.mjs`, `bench/jwt-verify/README.md`, `bench/sha256-block/README.md`.

## CI S11 — stop console.log interleaving between prefork workers
#1195 item 5: `console.log` writes text and newline as two `write(2)` calls, so two prefork workers on one pipe printed `listening 40413listening 40413` and failed `postgres-live` `tfb` on #1192. Reproduces from the 0.33.0 seed. The triage comment marks it as needing a decision.

### Decision needed
One write per `console.log` (runtime change, so the `c-symbols` and `performance` runs and an IR move) or a `waitFor` in `tests/postgres/live/run.mjs` that accepts the token without a whole line (test only). The issue gives both without a pick.

## CI S12 — find why bench/chacha20.ts stops at the link in the ECC-9 sweep

Found by the WP48 S3 rule run (tracker #1776): its ECC-9 sweep built 1097 of 1098 programs, and `bench/chacha20.ts` stopped at the link. Nobody investigated it, and no issue tracks it. Reproduce it, find whether the cause is the compact rule, the bench or the toolchain, then fix it or file it.

Likely files: `bench/chacha20.ts`, `src/compact-rule.ts`.
