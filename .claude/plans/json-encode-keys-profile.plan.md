---
name: json-encode-keys follow-up — main's serialize profile and an independent re-measure (docs only)
overview: Close #1603. PR #1592 (squash e966fbe5) wrote a typed object's keys as one pre-escaped copy, but recorded only the after-profile; the claim that key escaping and the per-key state checks were main's largest per-field cost has no per-function figures behind it, and no one but the worker measured the merged build. Build e966fbe5^ and e966fbe5, take callgrind by-function profiles of typed serialize on citm_catalog.json and on bench/json-api's page at e966fbe5^, record them beside the json-encode-keys note in docs/BENCHMARKS.md, re-measure Ir per document at both commits, and confirm the citm serialize checksum from both builds.
stages:
  - id: s1-profile
    title: S1 — main's serialize profile and the re-measure (docs only)
    goal: docs/BENCHMARKS.md's json-encode-keys note carries a by-function callgrind profile of typed serialize at e966fbe5^ on citm and on bench/json-api's page, states whether key escaping plus the per-key state checks were the top per-field cost, gives Ir per document at e966fbe5^ and e966fbe5 measured in this run, and records the citm serialize checksum line from both builds.
    verification: npm run lint && node docs/check-links.mjs && node scripts/gen-reference.mjs --check
    todos:
      - id: build-both
        content: Build e966fbe5^ and e966fbe5 (scripts/bootstrap.sh in a worktree of each, in the foreground) — see S1
        status: pending
      - id: profile-base
        content: callgrind --tool=callgrind by function on citm typed serialize and on bench/json-api's page, built by e966fbe5^'s compiler; inclusive and self Ir per function, grouped into key handling / value writing / numbers / other — see S1
        status: pending
      - id: remeasure
        content: Ir per document at e966fbe5^ and e966fbe5 on both workloads (N and 10N runs differenced, as heldout.mjs does) and the citm serialize checksum line from both builds — see S1
        status: pending
      - id: record
        content: Write the before-profile, the verdict on the claim, the re-measured Ir and the checksums into the json-encode-keys note; Refs Fixes #1603 — see S1
        status: pending
---

# json-encode-keys follow-up — main's profile and a re-measure

## S1 — main's serialize profile and the re-measure

Owns: `docs/BENCHMARKS.md`, `docs/wp38-simd.md`,
`.claude/plans/json-encode-keys-profile.plan.md`.

One PR, docs only. No file under `src/`, `std/`, `runtime/`, `bench/` or
`tests/` changes. If the profile contradicts the recorded claim (key handling
was *not* the top per-field cost at e966fbe5^), the note says so plainly with
the figures, the commit message's claim is corrected in the release-note
words, and the PR stops there for a human to decide whether a code change
follows; no code change lands in this stage.

Method:

- Build each commit's compiler with `scripts/bootstrap.sh` in its own git
  worktree (the json-compare heldout note does the same for its base). Every
  build and every callgrind run runs **in the foreground** — a cloud
  container's background jobs die when it is reclaimed while idle.
- citm: `bench/json-compare/main.ts serialize <citm_catalog.json> N` built
  with `--profile speed` by each compiler (fetch the corpus with
  `bench/json-compare/fetch.mjs`). json-api: `bench/json-api/main.ts` built by
  each compiler. Use the same input and the same flags at both commits.
- Profile: `valgrind --tool=callgrind` then `callgrind_annotate --inclusive`
  and self, at e966fbe5^; group functions into key writing (`key`, the key
  escape scan, the comma/state checks it performs), string values
  (`jsonWriterPutString`), numbers (`i32`/`i64`/`f64`), and the rest. The
  after-profile at e966fbe5 is taken the same way, so the two tables compare.
- Ir per document: difference two run lengths so start-up cancels, as
  `bench/json-compare/heldout.mjs` does. Compare with #1592's recorded
  14.13M → 10.74M and 188,879 → 162,647; say whether they match and by how
  much.
- Checksum: the citm serialize line must read
  `serialize 18100868296888812225 452530` from both builds.

The record goes inside `<!-- json-encode-keys:begin -->` … `:end -->`, in the
section's style (a table of function → share of Ir per document, the
commands, the commits, the toolchain). Commit as
`docs(codegen): record main's typed-serialize profile and re-measure #1592`
with `Fixes #1603`.
