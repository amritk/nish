// Opt-out (`--allow-panics`): the checked `a + b` is this example's point (the
// README shows its overflow check), and the C, N-API and wasm hosts pin the
// `int32_t add(int32_t a, int32_t b)` signature, so no type change can prove it.
// Follow-up: none planned; it keeps `--allow-panics`.
export const add = (a: number, b: number): number => a + b
