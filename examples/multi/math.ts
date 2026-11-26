// `n * n` on an i32 may overflow for an `n` no caller bounds. Linked as one
// program (`--link`), `main.ts`'s `square(7)` is its only caller, so the
// product is proven and the build needs no `--allow-panics`. A build that
// exports `square` to other callers, such as one that emits its C header
// (`int32_t square(int32_t n)`), cannot bound `n` and still needs the flag.
export const square = (n: number): number => n * n
