// NL2263: `!s` on a `string | null` has no fix: `""` and `null` are both
// falsy, and the reader has to say which one was meant.
export const test = (s: string | null): number => (!s ? 1 : 0)
