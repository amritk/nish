declare function c_abs(x: i32): i32
export function f(): i32 {
  return c_abs(-1)
}
