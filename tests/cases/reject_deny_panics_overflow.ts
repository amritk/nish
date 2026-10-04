// --deny-panics refuses a signed addition not proven to fit, names the
// `overflow` kind and where it is, and points at the ways to make it fit or
// say it wraps.
export const sum = (a: i32, b: i32): i32 => a + b;
