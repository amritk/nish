// NL7002: an array of strings is not an array of numbers, which is all
// `uncheckedGet` reads.
export const name = (names: string[], k: i32): string => names[k];
