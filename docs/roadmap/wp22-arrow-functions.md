# WP22: Arrow functions as the declaration form

**State:** Landed · **Done:** 4 of 5 · **Design note:** [`docs/wp22-arrow-functions.md`](https://github.com/amritk/nish/blob/main/docs/wp22-arrow-functions.md)

## Stages

- [x] A: both compilers accept `const f = (...) => ...`
- [x] B: both spellings emit byte-identical IR
- [x] C: docs, examples, `src/`, `std/` and tooling rewritten; a Biome rule blocks new `function` declarations
- [x] C: rewrite the test corpus, which Biome does not read
- [ ] D: reject a `function` definition, a breaking change *(open question)*

## Next

Waiting on the decision about stage D. Every stage before it is done: the test corpus is arrows, and the `arrow-corpus` check in `tests/run.js` keeps it so, but for the files `tests/function-spelling-allowlist.txt` lists with a reason.

## Open questions

Whether stage D happens at all: rejecting `function` withdraws an accepted construct, a breaking minor while the project is on 0.x. Spec: [§10 Open](https://github.com/amritk/nish/blob/main/docs/wp22-arrow-functions.md#10-open).

[All work packages](index.md)
