# WP33: The round trip to TypeScript

**State:** In progress · **Done:** 7 of 9 · **Design note:** [`docs/wp33-round-trip.md`](https://github.com/amritk/nish/blob/main/docs/wp33-round-trip.md)

## Stages

- [x] R0: the note, the `RUN_UNDER_NODE.md` ledger and the TypeScript-reading checklist
- [x] R1: the `portability` class behind `--warn-portability`
- [x] R2: the typed-array names lose `push` and `pop` ([#335](https://github.com/amritk/nish/pull/335))
- [x] R3: the runtime split by host, `runtime/core/` with Node and browser adapters
- [x] R4: `--emit-ts <dir>` with its live differential, `tsc --strict` and a fuzz mode ([#853](https://github.com/amritk/nish/pull/853))
- [x] R5's `exact` tier: `fix` in `--json` and `nish --fix` ([#421](https://github.com/amritk/nish/pull/421))
- [x] R5's `review` tier: `review` in `--json`, NL8006's rewrite to the same IR
- [ ] R6: compatibility mode (WP28)
- [ ] A Bun runtime adapter *(deferred)*

## Next

R6, compatibility mode, which is [WP28](wp28-compatibility-mode.md) on its own staging: its spikes are measured and its next stage is C0. R6 is done when WP28 is. Spec: [§9](https://github.com/amritk/nish/blob/main/docs/wp33-round-trip.md#9-staging).

## Not planned

An idiomatic `--emit-ts` that drops the helpers, a transpiler for arbitrary TypeScript, emitting JavaScript.

[All work packages](index.md)
