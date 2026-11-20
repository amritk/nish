// `?.` before a call stays refused, in the compatibility dialect too (NL1068).
export const run = (s: string): i32 => s.charCodeAt?.(0)
