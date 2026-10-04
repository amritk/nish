// `charCodeAt` checks its index as an element access does, and `nish:unsafe`
// has no unchecked form of it.
export const code = (s: string, k: i32): i32 => s.charCodeAt(k)
