// Every conversion direction across `f32`: `fptrunc` down from f64, `fpext`
// up, `sitofp`/`uitofp` in from an integer by the *source's* signedness, and
// the saturating `llvm.fpto{s,u}i.sat.<T>.f32` out to one.
export const narrow = (x: f64): f32 => {
  return toF32(x);
};

export const widen = (x: f32): f64 => {
  return toF64(x);
};

export const fromSigned = (i: i32): f32 => {
  return toF32(i);
};

export const fromUnsigned = (u: u32): f32 => {
  return toF32(u);
};

export const toSigned = (x: f32): i32 => {
  return toI32(x);
};

export const toUnsigned = (x: f32): u32 => {
  return toU32(x);
};
