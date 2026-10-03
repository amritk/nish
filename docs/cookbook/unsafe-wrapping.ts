import { wrappingAdd, wrappingMul } from "nish:unsafe"

const hashStep = (h: i32, c: i32): i32 => wrappingAdd(wrappingMul(h, 31), c)

const plainStep = (h: i32, c: i32): i32 => h * 31 + c

export const both = (h: i32, c: i32): i32 => hashStep(h, c) ^ plainStep(h, c)
