// `String.fromBytes` copies bytes, so it reads a `u8[]`: an `i32[]` would make
// the byte order of a wider element a fact about the machine, and a string is
// already a string.
const f = (xs: i32[]): string => String.fromBytes(xs, 0, 1);
