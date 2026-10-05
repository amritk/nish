// NL7002: `slice` checks its range, and `nish:unsafe` has no unchecked form
// of it.
export const tail = (s: string, k: i32): string => s.slice(k);
