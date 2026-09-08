// --number-mode f64: `number` is a double, so every Math.* function applies to it directly.
// Every Math.* call lowers to an LLVM intrinsic (readnone), so `hypot` and `trig` stay pure.
function hypot(a: number, b: number): number {
  return Math.sqrt(a * a + b * b);
}

function trig(x: number): number {
  return Math.sin(x) + Math.cos(x);
}

export function test(): i32 {
  console.log(hypot(3, 4));
  console.log(Math.floor(2.7));
  console.log(Math.ceil(2.1));
  console.log(Math.trunc(-2.7));
  console.log(Math.round(2.5));
  console.log(Math.round(-2.5));
  console.log(Math.round(0.49999999999999994));
  console.log(Math.abs(-1.5));
  console.log(Math.min(1.5, -2));
  console.log(Math.max(1.5, -2));
  console.log(Math.pow(2, 10));
  console.log(Math.exp(0));
  console.log(Math.log(Math.E));
  console.log(trig(0));
  console.log(Math.PI);
  return 0;
}
