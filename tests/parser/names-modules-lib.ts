// The module `names-modules.ts` imports from: one function for each word the
// import and export grammar reads as a modifier or a keyword somewhere, so
// that importing it by that name is a program that compiles.
export const type = (): i32 => 1
export const as = (): i32 => 2
export const from = (): i32 => 3
export const require = (): i32 => 4
export const namespace = (): i32 => 5
export const assert = (): i32 => 6
export const defer = (): i32 => 7
export type Word = i32
