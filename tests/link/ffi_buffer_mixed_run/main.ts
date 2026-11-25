// WP89 S2: every buffer of a run has the element type of the one that opened
// it, because the one count after the run is in elements. `blend` mixes an
// `f32[]` and a `u8[]` before its count; `pack` puts a `u16[]` after an
// `i32[]`. Both are refused with NL2824. `split` closes each run with its own
// count and is accepted.
declare function blend(dst: f32[], mask: readonly u8[], n: u64): void
declare function pack(dst: i32[], src: readonly u16[], n: u64): void
declare function split(dst: f32[], n: u64, mask: readonly u8[], m: u64): void

export const main = (): i32 => 0
