// A stack array's slot is typed `[n x T]`, and `n` has to come from the length
// the source wrote. Under `--number-mode f64` the literal reaches the emitter
// as a register rather than as digits, because it has been converted on the way
// to an index: stage0 wrote `alloca [NaN x float]` -- IR `llvm-as` refuses, from
// a compile that exited 0 -- and stage1 wrote `alloca [0 x float]`, which
// assembles and then stores two floats past a zero-element slot (WP19 §A2).
function scale(k: f32): f32 {
  const xs = new Float32Array(2);
  xs[0] = 0.5;
  xs[1] = 1.25;
  return (xs[0] + xs[1]) * k;
}

export function main(): void {
  console.log(scale(4.0));
}
