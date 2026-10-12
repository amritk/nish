// `s?.length` with no `??` would answer `undefined` where `s` is `null`, and
// `undefined` is not a value, so a chain must end in a default.
export const f = (s: string | null): i32 => s?.length;
