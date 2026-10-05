// `nish:unsafe` reads only arrays of numbers, and this one holds strings: the
// site is reported without a fix, and dropping the flag puts its check back.
export const name = (names: string[], k: i32): string => names[k]
