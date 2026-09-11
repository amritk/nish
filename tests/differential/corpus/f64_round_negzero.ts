// --number-mode f64: Math.round(-0.3) is -0 in JavaScript and +0 in Nish (documented in
// docs/wp7-runtime.md). Both print "0"; dividing by the result exposes the sign.
export function main(): void {
  const x = -0.3;
  console.log(Math.round(x));
  console.log(1 / Math.round(x));
  console.log(1 / Math.round(-0.5));
  console.log(1 / Math.round(-0));
  console.log(1 / Math.ceil(-0.5));
  console.log(1 / Math.trunc(-0.5));
}
