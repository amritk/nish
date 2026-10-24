// Math.imul multiplies 32-bit integers: an f64 is refused rather than run through
// ToInt32, the conversion Nish never does silently.
const f = (a: f64, b: i32): i32 => Math.imul(a, b);
