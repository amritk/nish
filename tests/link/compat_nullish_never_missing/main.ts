// `nullish` admits a `??` whose left operand is never missing (the build keeps
// the left operand alone and says so in an NL9021 warning, which a refused
// compile does not print). The default is never run, but it must still be the
// left operand's type, as TypeScript asks: NL2370 refuses the second `??`.
const keep = (k: i32): i32 => k ?? 9;

const label = (k: i32): i32 => k ?? "none";

export const main = (): i32 => keep(42) + label(0) - 42;
