// f32ToBits reads the 32 bits of an f32: an f64 is refused rather than narrowed.
const f = (x: f64): i32 => f32ToBits(x);
