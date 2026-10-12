# Scope-region probe programs

Programs used by the review rounds of #590 and #602 (nish/threads scope-region
checks). Each `.ts` is a complete program: compile it with
`build/nish P.ts --json --link out/P -o out/P.d/`, run `out/P` natively, and
run it under Node with
`node --experimental-strip-types --js-explicit-resource-management --no-warnings --import runtime/nish.mjs -e 'const m = await import("<abs P.ts>"); process.exit(m.main());'`.
A program the checker accepts that prints differently natively and under Node
is a hole.

- `p0*`, `pA*`, `pB*`, `pC*`: round 4.
- `r5_*`: round 5. `r6_*`: round 6. `r7_*`: round 7. `m6/`: the Map over-refusal check.
- `results-*.txt`: each round's verdicts. `probe7.sh` / `probe7base.sh`: the runners
  (edit their paths).
- Over-refusal programs for #602: `r7_c*`, `r7_d*`, `r7_e*` and `r7_O7*`.
