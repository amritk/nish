// NL2727: an exported function returns a reference. Code outside the program
// could keep the tag and hand back one no dispatcher's set holds.
const double = (x: i32): i32 => x * 2;

export const pick = (): ((x: i32) => i32) => double;

export const main = (): i32 => pick()(2);
