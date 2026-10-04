// NL7002: `charCodeAt` checks its index, and `nish:unsafe` has no unchecked
// form of it, so the site is reported without a fix.
export const code = (s: string, k: i32): i32 => s.charCodeAt(k);
