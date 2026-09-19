---
name: M6 — close the WP19 gates that still hold stage0 in place
overview: Close every WP19 gate item that can be closed without a human decision, so that R6 — deleting `src/` — becomes a decision rather than a project. This plan deliberately stops short of R6, which is one irreversible commit that does nothing else.
stages:
  - id: parity-json
    title: test(parity) — the machine-readable surface enters the cross product
    goal: Add the `--json` variation to the parity cross product and close or declare every difference it exposes.
    verification: node tests/run.js --parity reports zero undeclared differences with the json variation present, and npm test is green and undegraded
    status: pending
    todos:
      - id: pj-variation
        content: Add a json entry to VARIATIONS in tests/self/parity.js — see The json surface
        status: pending
      - id: pj-measure
        content: Run the corpus half and record the undeclared count before any fix — see The json surface
        status: pending
      - id: pj-close
        content: Fix whichever compiler is in the wrong for each class the run exposes, with a tests/cases case per class — see The json surface
        status: pending
      - id: pj-declare
        content: Write a narrow declaration for any difference that is decided rather than broken — see The json surface
        status: pending
  - id: reject-ceiling
    title: test(oracle) — the parser-refusal bucket gets a register it cannot grow past in silence
    goal: Make a case migrating into reject_oracle's parser bucket a failure until somebody registers it, closing the caveat WP19 §5 R3 states against itself.
    verification: node tests/run.js reject is green, and deleting one line of the new register makes it exit 1 naming the case
    status: pending
    todos:
      - id: rc-register
        content: Add tests/self/parser_refusals.txt listing every case stage1's parser refuses today, one per line with its reason — see The parser bucket
        status: pending
      - id: rc-enforce
        content: Make tests/self/reject_oracle.js compare the bucket against the register and fail on either direction — see The parser bucket
        status: pending
      - id: rc-fail
        content: Demonstrate the gate failing by dropping a line, and record the output in the PR body — see The parser bucket
        status: pending
  - id: ddc-tag
    title: ci(release) — the provenance tag is cut by the release rather than remembered
    goal: Make release.yml cut the `ddc-<version>` tag WP19 G6 asks for, on the release whose bootstrap proved the property, so the tag cannot be forgotten at the one moment it is unrecoverable.
    verification: node tests/run.js wp19 drives .github/ddc-tag.sh through each of its states against a stand-in and is green
    status: pending
    todos:
      - id: dt-script
        content: Add .github/ddc-tag.sh deciding whether this release may carry a ddc tag and what it is named — see The provenance tag
        status: pending
      - id: dt-release
        content: Call it from a release.yml job that runs after the bootstrap proof and before the release is published — see The provenance tag
        status: pending
      - id: dt-drive
        content: Drive every arm of the script from the WP19 block of tests/run.js against a stand-in for git — see The provenance tag
        status: pending
      - id: dt-doc
        content: Point docs/wp12-release.md's procedure at the automated tag instead of a step a human remembers — see The provenance tag
        status: pending
  - id: seed-exercise
    title: ci(seed) — exercise the three unexercised seed rows and measure what ld64 varies
    goal: Run the release binaries job on aarch64-linux and both darwin rows before 0.4.0 attaches them, and settle the Mach-O stage3 comparison that scripts/verify-binaries.sh narrows but cannot explain.
    verification: a throwaway workflow_dispatch run is green on ubuntu-24.04-arm and on macos-latest, and scripts/verify-binaries.sh attributes every differing byte rather than reporting unattributed
    status: pending
    todos:
      - id: se-workflow
        content: Add the disposable exercise-target workflow that seed-targets.json's own note prescribes — see Exercising the seed rows
        status: pending
      - id: se-arm
        content: Dispatch it on ubuntu-24.04-arm and record the result — see Exercising the seed rows
        status: pending
      - id: se-darwin
        content: Dispatch it on macos-latest, capture which bytes differ between stage2 and stage3, and name them — see Exercising the seed rows
        status: pending
      - id: se-remedy
        content: Apply the remedy the measurement implies so verify-binaries.sh attributes rather than fails — see Exercising the seed rows
        status: pending
      - id: se-attach
        content: Move attachedSince for each row the run proved, and delete the throwaway workflow — see Exercising the seed rows
        status: pending
  - id: m6-ledger
    title: docs(wp19) — the gate states, re-measured, with the dates on them
    goal: Replace every gate state paragraph that was true on the day it was written with one measured on merged main, so M6's remaining distance is a list rather than a recollection.
    verification: every number in wp19 §3 and §5 and in MASTER_PLAN's M6 row carries the date and the command that produced it, and node docs/check-links.mjs is green
    status: pending
    todos:
      - id: ml-measure
        content: Run the full gate battery on merged main and capture each summary line verbatim — see The M6 ledger
        status: pending
      - id: ml-rows
        content: Rewrite wp19 §5's R1 through R5 rows and §3's state paragraphs against those measurements — see The M6 ledger
        status: pending
      - id: ml-master
        content: Rewrite MASTER_PLAN's M6 row and its What remains paragraph — see The M6 ledger
        status: pending
      - id: ml-r6
        content: Write the R6 readiness section — what is closed, what is not, and what R6 would delete — see The M6 ledger
        status: pending
      - id: ml-issues
        content: Close or re-state issues 93, 94 and 109 against the measured result — see The M6 ledger
        status: pending
---

## Context

WP19 is M6. Its six gates decide when `src/` — the TypeScript compiler that is simultaneously the shipped compiler, the bootstrap seed and the differential oracle — can be deleted rather than frozen. [`docs/wp19-stage0-retirement.md`](../../docs/wp19-stage0-retirement.md) §3 states them and §5 orders them R1 through R6.

Where they actually stand, read off the tree today rather than off the document:

| Gate | State | What this plan does |
| --- | --- | --- |
| G1 parity | green 2026-09-18, watched nightly and per pull request | closes the `--json` hole (#109) |
| G2 oracle succession | mostly done | pins the parser bucket, which §5 R3 flags against itself |
| G3 seed protocol | Linux done, darwin blocked | exercises the three unexercised rows and measures ld64 |
| G4 seed policy | done | nothing |
| G5 distribution | workflow done, installer blocked on an npm name | nothing — deferred by decision |
| G6 provenance | procedure written, nothing cuts the tag | makes the release cut it |
| R6 deletion | blocked | out of scope by decision |

Two of those are not merely open, they are *unmeasured*, and WP19's own §A5 is a long argument about what an unmeasured gate costs: a claim about the corpus read as a claim about the language, recorded green while it was red.

## Approach

**The document's own failure mode is the thing to design against.** §A5, §A6 and §A7 each record the same shape — a gate whose record outlived its measurement. So every stage here either adds a check that *runs*, or replaces a sentence with a measurement that carries its date. No stage closes a gate by asserting it closed.

**Stage 5 owns the narrative.** Stages 1 through 4 do not edit [`docs/wp19-stage0-retirement.md`](../../docs/wp19-stage0-retirement.md) or [`docs/MASTER_PLAN.md`](../../docs/MASTER_PLAN.md) at all; they put their findings in the commit body and the pull request body, and stage 5 reconciles all four into one coherent rewrite. wp19's rows are narrative and argue with each other; four parallel workers editing them produces four conflicts and a document that reads like four people.

**Stage 4 is on the release path and is the urgent one.** [`.github/seed-targets.json`](../../.github/seed-targets.json) carries `attachedSince: 0.4.0` for `aarch64-linux`, `aarch64-darwin` and `x86_64-darwin`, and the 0.4.0 release pull request is open. That file's own rule — BEFORE ADDING A PLATFORM, EXERCISE ITS ROWS ONCE — has not been obeyed for any of the three, and it explains why that is not recoverable by rolling the version back: `ci.yml`'s `bootstrap` matrix keys on the seeds a release *attaches*, so the first release carrying one gives that platform a row on every push, and a red row makes `ci` red repo-wide with `release` behind it.

## The json surface

`--json` is one of the two machine-readable contracts [`.claude/orientation.md`](../../.claude/orientation.md) names — one flat object per diagnostic whose `code` is a stable rule identifier, with every failure including toolchain and internal errors expressed as one of those objects.

`VARIATIONS` in [`tests/self/parity.js`](../../tests/self/parity.js) has fourteen entries and none of them is `--json`. The word does not appear in the file. So the cross product that compares the two compilers on every surface a command line produces has never once asked them the question a CI consumer asks.

This is exactly the shape §A5 names. The gate is green over a set of variations somebody thought to write down, and `--json` changes what *every* diagnostic looks like on *every* program — a per-diagnostic `code`, a severity, a position, and the band-0 objects `NL0002` and `NL0003` that exit 3 and exit 70 carry, which have no source position at all ([`docs/wp12-release.md`](../../docs/wp12-release.md), "Exit codes and failure modes").

Expect it to find things. Three places are worth looking first, because each is a channel where the two compilers are already known to answer from different machinery:

- the **band-0 objects**, which are produced by the driver rather than the checker on both sides, and which no oracle reads because they appear on a run that failed before compiling;
- **warning objects**, since the performance warnings were stage0's alone until recently and go to a stream no oracle reads on a successful compile (§2A);
- the **order** of a multi-diagnostic run, which [`docs/wp15-performance.md`](../../docs/wp15-performance.md) §8 made a contract and which stage1's error recovery reaches differently from stage0's throw (§A3).

Work it the way §A2 and §A3 were worked. Measure first and write the count down before fixing anything, then fix whichever compiler is in the wrong — **not** automatically stage1. Twice in §A3 the frozen compiler was the one that moved, because it was the one in the wrong, and "stage0 is the oracle" decides who settles a disagreement rather than who is right.

A difference that is genuinely decided gets a declaration, and a declaration has to earn itself: it normalises away exactly the bytes allowed to differ and reports anything still differing. A whole-surface declaration on `--json` would be the wrong answer — that surface is a contract, and swallowing it hides the next real divergence on it.

Every class closed gets a `tests/cases` case so the corpus poses the question from then on, which is the half of §A5 that `dbg_arrow` closed for `-g`.

**Owns:** `tests/self/parity.js`, `src/**`, `self/**`, `tests/cases/**`, `tests/wordings/**`, `docs/LANGUAGE.md`

## The parser bucket

[`tests/self/reject_oracle.js`](../../tests/self/reject_oracle.js) sorts a refused program into buckets, and one of them is "refused by the S2 parser instead" — stage1's grammar turning down syntax the language forbids before Phase 0 can name the rule. That bucket is a count in a summary line, printed and never compared to anything.

WP19 §5's R3 row states the consequence against itself:

> the reject oracle's parser bucket is a count in a summary line and nothing compares it to a ceiling, so the next rule that leaves the parser's reach migrates a case into the bucket silently. Read the bucket's number across such a change.

"Read the number across such a change" is an instruction to a person, which is the same class of gate as a number in a document — it holds until somebody forgets. The member-header work already moved four families *out* of the bucket, so the traffic is real and in both directions.

A register fixes it the way [`tests/self/stage1_only.txt`](../../tests/self/stage1_only.txt) fixes its own problem, and that file is the model to copy down to the header: one entry per line, the case and a sentence, with the header explaining what an entry means in each tool that reads it.

Make it fail in **both** directions:

- a case in the bucket and not in the register — a rule left the checker's reach, which is the migration the caveat is about;
- a case in the register and not in the bucket — a rule came back, and the entry is now a claim about nothing.

The second matters as much as the first here, because the register's purpose is to shrink. §5 R3 records 45 wordings becoming 41, and a register that only ever grows would record the improvement as an unchanged number.

Demonstrate the failure rather than asserting it, the way §2B demonstrates the wordings gate by dropping a line of `tests/wordings/unreachable.txt`. Put the output in the pull request body.

**Owns:** `tests/self/reject_oracle.js`, `tests/self/parser_refusals.txt`

## The provenance tag

G6 is the cheapest gate in the document and the only one that is unrecoverable if missed:

> The last commit at which both `IR(stage0, self/) == IR(stage1, self/)` and the fixed point hold is **tagged** (`ddc-<version>`) … Zero maintenance cost — it is a tag and a paragraph. It is the difference between "we gave up diverse double-compiling" and "we can no longer say anything about it".

The paragraph is written. The tag is not, and nothing in the repository would ever cut one — `grep -rn 'ddc-'` over the workflows and scripts returns nothing. So G6 today is a procedure for re-verifying a property from a tag that does not exist, and it stays that way until the release where somebody happens to remember, which is the release after the one where they did not.

Make the release cut it. The property the tag marks is exactly what `tests/self/bootstrap.js` asserts on every run and what `scripts/bootstrap.sh --verify` asserts when the seed is stage0 — so the release already proves it, and all that is missing is the tag.

Follow [`.github/seed-matrix.sh`](../../.github/seed-matrix.sh)'s pattern exactly, because the repository has already twice got this class of logic wrong inline in a workflow where nothing could run it: a script of its own, driven from the WP19 block of [`tests/run.js`](../../tests/run.js) against a stand-in, through every arm. The arms worth driving are the tag being due, the tag already existing for this version, and the proof not having run.

The tag is cut **after** the proof and **before** the release is published, and it points at the commit the release is built from. A tag cut on a release whose bootstrap did not prove the property is worse than no tag, because it is a claim nobody can falsify later.

Then rewrite the procedure in [`docs/wp12-release.md`](../../docs/wp12-release.md) so it describes what happens rather than what a person should remember to do.

**Owns:** `.github/workflows/release.yml`, `.github/ddc-tag.sh`, `tests/run.js`, `docs/wp12-release.md`

## Exercising the seed rows

Three rows of [`.github/seed-targets.json`](../../.github/seed-targets.json) are due at 0.4.0 and none has ever run. The file's note says what that costs and closes the two obvious ways of fixing it — `release.yml` cannot be dispatched at a branch, and a temporary matrix entry in it cannot be reached — and prescribes the third:

> a throwaway workflow on a branch — `on: workflow_dispatch`, one job `runs-on:` the label in question, and the steps of release.yml's `binaries` job down to the smoke test, with no upload. It is deleted once it has been green.

Build exactly that. Copy the steps rather than rewriting them, so the run exercises the thing the release will do rather than a paraphrase of it.

`ubuntu-24.04-arm` is the easy row — ELF, so the Mach-O comparison does not apply, and one green run is all it needs.

`macos-latest` is the one with work in it. [`scripts/verify-binaries.sh`](../../scripts/verify-binaries.sh) asserts `stage3 == stage2`, which does not hold on Mach-O: measured 2026-09-13 at identical size, 597,048 bytes both, with every IR equality green. The script narrows the comparison rather than lifting it — size asserted, debug information stripped where a tool can strip it, anything left over failed as *unattributed* — and its header is explicit that the cause is a candidate and not a finding:

> The leading candidate for what does differ is **LC_UUID** … That is a candidate and not a finding. Nobody has run this on a mac.

So the deliverable of the darwin dispatch is a **measurement**, and the fix is downstream of it. Capture the differing bytes and their offsets before reaching for a remedy; the header names `-Wl,-no_uuid` and masking the load command as the two one-liners if LC_UUID is the answer, and says they belong in the commit that measures it. If it is *not* LC_UUID, say what it is — that answer is worth more than the fix.

A darwin row that cannot be made to attribute its differences is a legitimate outcome and it is reported, not worked around. The one thing that must not happen is an arm that accepts any difference, because it would accept a stage3 that is a different compiler, which is the only thing the comparison is for.

Move `attachedSince` only for a row a green run proves. `aarch64-linux` is the natural first and may well be the only one. Delete the throwaway workflow in the same pull request that reports its result — it leaves nothing permanent in a workflow whose failures are expensive.

**Owns:** `.github/workflows/exercise-target.yml`, `.github/seed-targets.json`, `scripts/verify-binaries.sh`, `scripts/build.sh`, `scripts/bootstrap.sh`, `docs/wp10-ci.md`

## The M6 ledger

Every other stage produces a fact. This one writes them down in the two places a reader looks, and re-derives the ones that are already written down, because WP19 has been wrong about its own state four times and each time the mechanism was a number that outlived its measurement.

Run the battery on merged `main` and quote each summary line verbatim with its date and the box it ran on:

| Gate | Command |
| --- | --- |
| G1 | `node tests/run.js --parity` |
| G2 | `node tests/diagnostic_coverage.js --report` |
| G3, G6 | `node tests/self/bootstrap.js` |
| all | `npm test`, with the skip count read and not just the exit code |

Then rewrite §5's R1 through R5 rows and §3's state paragraphs against what came back. Where a paragraph is still true, re-date it; where it is not, replace it and say what moved. §5 R1's own wording is the standard to hold the rest to — a row that does not carry a date is not a measurement.

`MASTER_PLAN.md`'s M6 row and its "What remains" paragraph get the same treatment. That row says "open — after M4", and whether that ordering still holds after this run is a question for the row rather than an assumption underneath it.

Finally, the section this plan exists to make writable: **what R6 would delete, and what is still in front of it.** Name the human decisions by name — the npm registry name G5 waits on, and §7's honest trigger, which is a judgement about whether stage0 has stopped earning its keep and not a checkbox. R6 stays unwritten; this section is what makes writing it a decision.

Issues #93, #94 and #109 get closed or re-stated against the measured result rather than left to drift.

**Owns:** `docs/wp19-stage0-retirement.md`, `docs/MASTER_PLAN.md`, `.claude/selfhost.md`

## Out of scope

- **R6 itself.** `src/`, the `typescript` dependency, the six dead oracles and the rules naming stage0 all stay. R6 is one irreversible commit that does nothing else, and §7 argues the trigger for it has not been shown.
- **G5's installer**, and with it the npm registry name. `nish` on the public registry has belonged to somebody else since 2014 and the choice is not one this plan makes.
- **M4.** The frozen language reference and the 0.4.0 release are their own work, and the release pull request is a human's to merge.
- **The 41 parser-refused wordings and the 2 divergent programs** WP19 §5 R3 records as going with stage0. They are decided, not open.
- **Porting the harness off Node.** §1 says the harness stays, and rustc's build is Python to this day.

## Tests

Every stage ships its check, because a gate nobody can fail is a wish:

| Stage | The check that did not exist before |
| --- | --- |
| parity-json | the `--json` variation in the cross product, plus a `tests/cases` case per class closed |
| reject-ceiling | `tests/self/parser_refusals.txt` compared against the bucket, failing in both directions |
| ddc-tag | `.github/ddc-tag.sh` driven through each arm from the WP19 block of `tests/run.js` |
| seed-exercise | a real run on each platform, and `verify-binaries.sh` attributing rather than narrowing |

## Verification

Per stage, on its own branch, before the pull request opens — the five conditions of [`AGENTS.md`](../../AGENTS.md#shipping-a-change-what-a-pull-request-must-be-and-who-merges-it):

```bash
npm run check                                   # tsc --noEmit over src/
npm test                                        # read the skip count, not the exit code
npm run lint                                    # no worse than main
node docs/check-links.mjs                       # when the change touches Markdown
node scripts/changelog-gen.mjs --check-subject "<pr title>"
```

A `DEGRADED:` banner, or a skip that is not one of the three environmental ones — no WASI sysroot, `NISH_BOOTSTRAP` unset, no `jq` for the WP19 seed-matrix states — means the run did not prove what its summary suggests, and the change is untested whatever the exit code said.
