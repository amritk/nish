// NL2824: one count closes a run of buffers in elements, so a `readonly u8[]` cannot join a run an `f32[]` opened.
declare function blend(dst: f32[], mask: readonly u8[], n: u64): void

export const main = (): i32 => 0
