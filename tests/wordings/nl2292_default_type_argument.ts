// NL2292: a type argument is inferred from the call's arguments and is never
// written, so a default has no position to fill.
const dflt = <T = i32>(x: T): T => x;

export const main = (): i32 => dflt(1);
