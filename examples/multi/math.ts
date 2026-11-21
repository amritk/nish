// Opt-out (`--allow-panics`): `n * n` on an i32 may overflow, and the emitted
// header pins `int32_t square(int32_t n)`, so no type change can prove it.
// Follow-up: none planned; `examples/multi` keeps `--allow-panics`.
export const square = (n: number): number => n * n

// smoke: args --allow-panics
