// Type arguments are never written at a call site: one token of lookahead
// cannot tell `identity<i32>(7)` from `(identity < i32) > (7)`. WP18 §2a.
const identity = <T>(x: T): T => x;

export const test = (): number => identity<i32>(7);
