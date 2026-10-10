// NL2099: `ok || s.length` passed as an argument has no fix. Under `tsc` the
// callee receives the length itself when `ok` is false, not a boolean.
const isTrue = (b: boolean): i32 => (b ? 1 : 0)
export const test = (s: string, ok: boolean): number => isTrue(ok || s.length)
