// --number-mode f64: Math.round, floor, ceil and trunc at their edges (#943).
// On x86-64 the four call the runtime's `nish_floor`, `nish_ceil` and
// `nish_trunc`, which run SSE4.1's `roundsd` when the CPU has it and libm's
// when it does not; tests/run.js runs this twice, once with `NISH_SIMD=base`
// pinning libm, and both print what Node prints. `x` is a parameter, so no
// call folds to a constant. A result is printed beside its reciprocal, which is
// how a -0 shows: `${-0}` is "0", and `1 / -0` is -Infinity.
function shown(r: number): string {
  return `${r} ${1 / r}`;
}

function round(x: number): void {
  console.log(shown(Math.round(x)));
}

function others(x: number): void {
  console.log(`${shown(Math.floor(x))} | ${shown(Math.ceil(x))} | ${shown(Math.trunc(x))}`);
}

export function test(): i32 {
  const inf = 1 / 0;
  round(0);
  round(-0);
  round(0.5);
  round(-0.5);
  round(1.5);
  round(-1.5);
  round(2.5);
  round(-2.5);
  round(0.49999999999999994);
  round(-0.49999999999999994);
  round(4503599627370495.5);
  round(4503599627370496);
  round(9007199254740993);
  round(inf);
  round(-inf);
  round(0 / 0);
  round(-1e-300);
  round(5e-324);
  round(-5e-324);
  round(2.225073858507201e-308);
  others(0);
  others(-0);
  others(-0.5);
  others(0.5);
  others(-1e-300);
  others(5e-324);
  others(-5e-324);
  others(2.225073858507201e-308);
  others(-2.7);
  others(2.7);
  others(4503599627370495.5);
  others(-4503599627370495.5);
  others(9007199254740993);
  others(inf);
  others(-inf);
  others(0 / 0);
  return 0;
}
