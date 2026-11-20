# WP22: Arrow functions as the declaration form

**State:** Landed · **Open work:** [#1866](https://github.com/amritk/nish/issues/1866) · **Design note:** [`docs/wp22-arrow-functions.md`](https://github.com/amritk/nish/blob/main/docs/wp22-arrow-functions.md)

## Stages

- [x] A: both compilers accept `const f = (...) => ...`
- [x] B: both spellings emit byte-identical IR
- [x] C: docs, examples, `src/`, `std/` and tooling rewritten; a Biome rule blocks new `function` declarations
- [x] C: rewrite the test corpus, which Biome does not read
