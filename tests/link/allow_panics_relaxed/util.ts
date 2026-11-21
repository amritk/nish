// Listed nowhere, and out of the scope under `--allow-panics`: its unproven
// index keeps its bounds check.
export const pick = (xs: i32[], at: i32): i32 => xs[at];
