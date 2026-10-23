// f32ToBits reinterprets the 32 bits of an f32 as an i32: one `bitcast`, never a
// conversion. The answer is signed, so a negative f32 has a negative pattern.
export const bits = (x: f32): i32 => f32ToBits(x);

export const main = (): i32 => {
  const zero = toF32(0);
  console.log(`${bits(toF32(1))} ${bits(toF32(-2))} ${bits(zero)} ${bits(-zero)}`);
  console.log(`${bits(toF32(1) / zero)} ${bits(toF32(0.1))} ${bits(toF32(16777217))}`);
  return 0;
};
