// WP89 S2: the one count after a run of buffers is in elements, so a run that
// mixes element types would hand C one number meaning two sizes. `blend`
// opens its run with an `f32[]` and puts a `u8[]` in it before the count, so
// the declaration is refused; a count after each buffer, or `CountedBy`,
// declares it.
declare function blend(dst: f32[], mask: readonly u8[], n: u64): void

export const main = (): i32 => 0
