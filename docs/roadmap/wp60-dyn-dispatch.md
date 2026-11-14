# WP60: Dynamic dispatch over interfaces

**State:** Proposed · **Done:** 1 of 5 · **Design note:** [`docs/wp60-dyn-dispatch.md`](https://github.com/amritk/nish/blob/main/docs/wp60-dyn-dispatch.md)

## Stages

- [x] Designed and measured: `Dyn<I>`, a tag and a pointer, a call lowered to a per-place `switch` of direct calls, against the hand-written dispatch; recommends shipping stage 1 now, with stages 2 and 3 each gated on its own build's timing (neither passes on the note's figures yet)
- [ ] Stage 1: interface method signatures and `<T extends I>`, with no IR moved
- [ ] Stage 2, gated on the stage 2 gate: `Dyn<I>` in locals, parameters, returns and calls; per-place sets; the escape-join refusal; the debug tag check; a stored `Dyn<I>` refused (NL2779) until stage 3
- [ ] Stage 3, gated on the stage 3 gate, after stage 2: `Dyn<I>` fields, arrays, `Map` values, `| null`, `Result` arms and threads, as one tagged word
- [ ] Stage 4: the agents' idiom and the NL2079 decision (`std/` adoption is later work)

## Next

Stage 1: [§9](https://github.com/amritk/nish/blob/main/docs/wp60-dyn-dispatch.md#9-stages). `src/` itself can use `Dyn` one release after it ships ([§5.4](https://github.com/amritk/nish/blob/main/docs/wp60-dyn-dispatch.md#54-the-rolling-freeze)).

## Not planned

Class inheritance, `abstract`, interface `extends`, default methods, a vtable, a tag header in every object, a `Dyn` across the C ABI.

[All work packages](index.md)
