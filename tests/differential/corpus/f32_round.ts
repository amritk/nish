// f32 against Node, which has only doubles. Every value here is chosen to be
// NOT exactly representable in a float, so a missing `Math.fround` in the
// rewrite shows up immediately: 0.1 prints 0.1 as an f64 and
// 0.10000000149011612 as an f32.
function scale(x: f32, k: f32): f32 {
  return x * k;
}

export function main(): number {
  const tenth: f32 = 0.1;
  const third: f32 = 0.3333333333333333;
  const e: f32 = 2.718281828459045;
  console.log(`${tenth} ${third} ${e}`);
  console.log(`${tenth + tenth} ${tenth * tenth} ${tenth - third} ${third / tenth}`);
  console.log(`${scale(tenth, 3.0)} ${scale(third, third)}`);
  console.log(`${-tenth} ${tenth % third}`);

  // The same arithmetic in f64, for contrast: the digits differ.
  const dTenth: f64 = 0.1;
  console.log(`${dTenth} ${dTenth + dTenth} ${dTenth * dTenth}`);

  // Accumulating in f32 diverges from f64 after a few steps.
  let acc: f32 = 0.0;
  for (let i = 0; i < 20; i++) {
    acc = acc + tenth;
  }
  console.log(`${acc}`);

  let counter: f32 = 0.5;
  counter += tenth;
  counter *= third;
  console.log(`${counter}`);

  // Conversions in both directions, including the saturating ones.
  console.log(`${toF64(tenth)} ${toF32(dTenth)} ${toF32(third)}`);
  console.log(`${toI32(tenth)} ${toI32(e)} ${toU32(tenth)}`);
  const negative: f32 = -2.75;
  console.log(`${toI32(negative)} ${toU32(negative)}`);
  const huge: f32 = 1e30;
  console.log(`${huge * huge} ${toI32(huge)} ${toU32(huge)}`);
  console.log(`${toF32(7)} ${toF32(16777217)}`); // 2^24 + 1 has no float

  // Comparisons and Math on floats.
  console.log(`${tenth < third} ${tenth > third} ${tenth === tenth}`);
  console.log(`${Math.abs(negative)} ${Math.min(tenth, third)} ${Math.max(tenth, third)}`);

  // Float32Array is f32[]: stores round on the way in.
  const xs: Float32Array = new Float32Array(3);
  xs[0] = 0.1;
  xs[1] = xs[0] * 3.0;
  xs[2] += tenth;
  console.log(`${xs[0]} ${xs[1]} ${xs[2]} ${xs.length}`);
  return 0;
}
