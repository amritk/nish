---
name: Documentation follow-ups
overview: Open documentation gaps from closed feature runs are the Scalar sidebar and unrouted reference links, overlong pages and paragraphs, a LANGUAGE.md Builtins trim, and four stale lines in security and design notes.
priority: 70
stages:
  - id: s1-scalar-nav
    title: DOCS S1 — give the guide a site-wide sidebar and render reference links
    goal: The Scalar preview shows a sidebar with Introduction, Getting started, Language and Using Nish on every page, and a guide link to LANGUAGE.md or another reference document renders rather than downloads.
    verification: node docs/check-links.mjs && npm run lint
    status: pending
    issue: 591
    labels: [needs-decision]
    todos:
      - id: s1-decide-nav
        content: Choose between one top-level group, a header link per section, or a newer Scalar build, after a preview run of each, in scalar.config.json — see DOCS S1 — give the guide a site-wide sidebar
        status: pending
      - id: s1-decide-links
        content: Choose between GitHub URLs and new routes for links to unrouted Markdown, and change docs/check-links.mjs in the same PR if it enforces the rule — see DOCS S1 — give the guide a site-wide sidebar
        status: pending
  - id: s2-long-pages
    title: DOCS S2 — settle the 120-word paragraph rule and split the long reference pages
    goal: The paragraph limit is a stated rule with a check or an explicit non-rule, and the named long pages and over-long reference paragraphs are split or exempted.
    verification: node scripts/gen-reference.mjs --check && node docs/check-links.mjs && npm run lint
    status: pending
    issue: 1296
    labels: [needs-decision]
    todos:
      - id: s2-decide-rule
        content: Decide whether the 120-word limit binds hand-written reference pages and list items, and whether a check goes in CI, recording it in docs/README.md — see DOCS S2 — settle the 120-word paragraph rule
        status: pending
      - id: s2-split-reference
        content: Break the over-long paragraphs in std/README.md, docs/INSTALL.md, docs/RUN_UNDER_NODE.md and the generated sections of bench/run.mjs, and add the missing x:begin and x:end markers for "Scheduling a divided region" — see DOCS S2 — settle the 120-word paragraph rule
        status: pending
      - id: s2-split-pages
        content: Split the long single pages (generated builtins reference, std/README.md, the standard-library guide page, docs/security/tls.md) in scripts/gen-reference.mjs and scalar.config.json if the decision says so — see DOCS S2 — settle the 120-word paragraph rule
        status: pending
      - id: s2-list-items
        content: Split the http-client.md list items over 120 words (124, 185 and 122) if the rule covers list items — see DOCS S2 — settle the 120-word paragraph rule
        status: pending
      - id: s2-wrong-facts
        content: Fix the stale line citations in docs/security/crypto-x509.md, json.md and yaml.md and the empty Unreleased section of CHANGELOG.md noted on the issue — see DOCS S2 — settle the 120-word paragraph rule
        status: pending
  - id: s3-trim-builtins
    title: DOCS S3 — trim LANGUAGE.md Builtins to its rules and settle the spec inconsistencies
    goal: The 12 named LANGUAGE.md Builtins subsections keep every rule and drop the reference text the JSDoc now carries, with links to the generated reference, and the seven spec inconsistencies are resolved.
    verification: node scripts/gen-reference.mjs --check && node docs/check-links.mjs && node tests/run.js docs && npm run lint
    status: pending
    issue: 1252
    todos:
      - id: s3-grep-pointers
        content: Grep src/, tests/, docs/, std/, .claude/ and CLAUDE.md for quotes and anchors of the text to be cut, including checks in tests/run.js that read LANGUAGE.md literally — see DOCS S3 — trim LANGUAGE.md Builtins to its rules
        status: pending
      - id: s3-trim
        content: Trim the 12 subsections of docs/LANGUAGE.md under Builtins to rules only, keep headings, and point links at the generated reference pages — see DOCS S3 — trim LANGUAGE.md Builtins to its rules
        status: pending
      - id: s3-inconsistencies
        content: Resolve the seven spec inconsistencies listed on the issue (Math.random effect, never returns, spawnWithFds row, setCpuAffinity, toI32 row, the older using passage, the NET_ constants row) in docs/LANGUAGE.md — see DOCS S3 — trim LANGUAGE.md Builtins to its rules
        status: pending
      - id: s3-regen
        content: Regenerate docs/reference with node scripts/gen-reference.mjs and check anchors still resolve — see DOCS S3 — trim LANGUAGE.md Builtins to its rules
        status: pending
  - id: s4-stale-lines
    title: DOCS S4 — fix the stale lines the issue sweep missed
    goal: Each stale line named on the acceptance issue is corrected against what main now holds.
    verification: node docs/check-links.mjs && node scripts/gen-reference.mjs --check && npm run lint
    status: pending
    issue: 1837
    todos:
      - id: s4-wp39
        content: Replace the claim that no figures are in BENCHMARKS.md in the G8 row of docs/wp39-http-server.md, which BENCHMARKS.md now answers — see DOCS S4 — fix the stale lines the issue sweep missed
        status: pending
      - id: s4-p384-list
        content: Check the nish/crypto module list in docs/LANGUAGE.md names p384 (it appears to now, near line 2998) and close that item if so — see DOCS S4 — fix the stale lines the issue sweep missed
        status: pending
      - id: s4-x509
        content: Update the "planned as nish/crypto/pki" lines in docs/security/crypto-x509.md (X509-5 row and near line 243) to say the module exists — see DOCS S4 — fix the stale lines the issue sweep missed
        status: pending
      - id: s4-regex-fuzz
        content: Fix docs/security/regex.md line 105 to say the regex fuzz target exists and add a Fuzzed line, reading the regex job of each fuzz.yml run first because it failed in all four runs since 2026-10-30 — see DOCS S4 — fix the stale lines the issue sweep missed
        status: pending
---

# Documentation follow-ups

## Context
No roadmap page. These are the open documentation issues left by closed feature runs. The `<<` negative test that #1837 lists is done by CI plan stage "CI S6 — pin the refusal of shift and bitwise operators in a constant table" (issue 1640), not here.

## DOCS S1 — give the guide a site-wide sidebar and render reference links
#591 items 1 and 2 (item 3 is met on main per the issue's comment). Under `@scalar/cli` 2.10.0 each top-level group shows only its own children, `/` has no sidebar, and a link to unrouted Markdown (`LANGUAGE.md`, `INSTALL.md`, `CHANGELOG.md`, `nish.d.ts`, about 8 targets) becomes an `application/octet-stream` download. Each option needs a preview run.
Likely files: `scalar.config.json`, `docs/README.md` "Writing a guide page", `docs/check-links.mjs`.

### Decision needed
Navigation: one top-level group, a header link per section, or a newer Scalar build. Links: GitHub URLs or routes for the targets. The issue recommends neither.

## DOCS S2 — settle the 120-word paragraph rule and split the long reference pages
#1296 after #1434 (which split the p256 and p384 docs and compiled the modules examples). Also #1463's criterion 2 (three http-client list items at 124, 185 and 122 words, a count the lead disputed); that issue is owned by the SWEEP plan, whose stage leaves the list-item split to this one. Still open per the comment: whether the 120-word limit becomes a CI rule, the long reference and guide pages (`/reference/library/builtins` about 95,000px, `std/README.md` 68k, `standard-library.md` 64k, `docs/security/tls.md` 60k) and the wrong-fact items. `docs/guide/getting-started/installation.md` no longer shows 0.20.0 on main. Check each wrong-fact line against main before editing it.
Likely files: `docs/README.md`, `bench/run.mjs`, `scripts/gen-reference.mjs`, `scalar.config.json`.

### Decision needed
Does the 120-word rule bind hand-written Reference pages and list items, and is it a CI check? The issue asks and recommends nothing.

## DOCS S3 — trim LANGUAGE.md Builtins to its rules and settle the spec inconsistencies
#1252: the reference material moved into JSDoc in #1245 and `scripts/gen-reference.mjs` now exists (the generator the issue waited for). Trim 12 subsections: console, Math, Numeric conversions, process, Arrays and strings as receivers, Bulk writes, Readonly arrays, Typed-array names have no `push` or `pop`, Arena, `Map` and `Set`, Typed JSON, Capabilities. Keep every rule, diagnostic, panic and the Capabilities table. Grep before cutting. The seven inconsistencies are listed in #1245's "Disagreements resolved".
Likely files: `docs/LANGUAGE.md`, `docs/reference/`, `tests/run.js`.

## DOCS S4 — fix the stale lines the issue sweep missed
#1837 criterion 6 and 9. On main now: `docs/wp39-http-server.md` still says "no figures are in BENCHMARKS.md yet"; `docs/security/crypto-x509.md` still says "planned as `nish/crypto/pki`" at two places; `docs/security/regex.md:105` still says "No fuzz target is in tree" although `tests/fuzz/targets/regex.ts` exists; `docs/LANGUAGE.md` now names `p384` in its module list, so that item may already be done. The criterion 3 item (the `<<` test) is the CI plan's S6.
Likely files: `docs/wp39-http-server.md`, `docs/security/crypto-x509.md`, `docs/security/regex.md`.
