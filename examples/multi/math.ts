// Opt-out from `--deny-panics`: `n * n` on an i32 may overflow, and the emitted
// header pins `int32_t square(int32_t n)`, so no type change can prove it.
// Follow-up: none planned; build `examples/multi` without `--deny-panics`.
export const square = (n: number): number => n * n
