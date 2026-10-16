// #618: LLVM narrows a `double` libm call whose result is truncated to the
// `float` one, and `%` on two `f32` is `fmodf`, so the `float` names of the
// libm functions are reserved too.
export const sinf = (x: f32): f32 => x;

export const main = (): i32 => toI32(sinf(toF32(1)));
