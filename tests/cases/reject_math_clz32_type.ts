// Math.clz32 counts the leading zeros of a 32-bit integer: an f64 is refused rather
// than converted, because ToUint32 on a double is the conversion Nish never does silently.
const f = (x: f64): i32 => Math.clz32(x);
