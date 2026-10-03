// NL1047: `==` is refused and its fix is `===`, the operator token alone. The
// left operand is parenthesised, a comment holding `==` sits before the token,
// and a non-ASCII string precedes it on the line, so the fix has to find the
// operator rather than the first `==` and count its column in code units.
export const same = (a: i32, b: i32): boolean => (a + 1) /* not this == */ == b
export const named = (s: string): boolean => "é😀" == s
