// Every conversion direction across `f32`: `fptrunc` down from f64, `fpext`
// up, `sitofp`/`uitofp` in from an integer by the *source's* signedness, and
// the saturating `llvm.fpto{s,u}i.sat.<T>.f32` out to one.
export function narrow(x: f64): f32 {
  return toF32(x);
}

export function widen(x: f32): f64 {
  return toF64(x);
}

export function fromSigned(i: i32): f32 {
  return toF32(i);
}

export function fromUnsigned(u: u32): f32 {
  return toF32(u);
}

export function toSigned(x: f32): i32 {
  return toI32(x);
}

export function toUnsigned(x: f32): u32 {
  return toU32(x);
}
