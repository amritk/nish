// NL1068: the compatibility dialect accepts `?.` before a member, an element
// and a method call, but not before a call itself.
const twice = (x: i32): i32 => x * 2;

const pick = (f: ((x: i32) => i32) | null): i32 => f?.(21) ?? 0;

export const main = (): i32 => pick(twice) - 42;
