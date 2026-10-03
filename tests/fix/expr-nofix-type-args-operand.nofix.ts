// NL2303: inside `+` the parser reads `identity<i32>(7) + 1` as
// `identity < i32 > ((7) + 1)`, so there is no call for the fix to keep; none.
const identity = <T>(x: T): T => x
export const test = (): number => identity<i32>(7) + 1
