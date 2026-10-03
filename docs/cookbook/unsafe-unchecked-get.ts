import { uncheckedGet } from "nish:unsafe"

const checked = (a: i32[], i: i32): i32 => a[i]

const unchecked = (a: i32[], i: i32): i32 => uncheckedGet(a, i)

export const both = (a: i32[], i: i32): i32 => checked(a, i) + unchecked(a, i)
