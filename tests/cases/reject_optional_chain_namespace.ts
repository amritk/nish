// A builtin namespace is not a value, let alone a `null` one.
export const main = (): i32 => toI32(Math?.floor(1.5) ?? 0);
