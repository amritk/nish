// Math.atan2 is libm's double `atan2`: an f32 operand is refused rather than widened.
const f = (y: f32, x: f32): f64 => Math.atan2(y, x);
