// --number-mode f64: transcendental functions on non-trivial arguments. llvm.sin/cos/exp/log/pow
// become glibc libm calls; V8 uses its own fdlibm port, so a few results differ by one ulp.
// Listed in known-failures.txt; see docs/wp13-differential.md.
export function main(): void {
  const xs = [0.5, 1, 1.5, 2, 2.5, 3, 10, 100, 0.1, 0.001, -1, -2.5, 1e-10, 1e10];
  for (const x of xs) {
    console.log(`sin(${x}) = ${Math.sin(x)}`);
    console.log(`cos(${x}) = ${Math.cos(x)}`);
    console.log(`exp(${x}) = ${Math.exp(x)}`);
    console.log(`sqrt(${x}) = ${Math.sqrt(x)}`);
    console.log(`log(${x}) = ${Math.log(x)}`);
    console.log(`pow(${x}, 3) = ${Math.pow(x, 3)}`);
    console.log(`pow(${x}, 0.5) = ${Math.pow(x, 0.5)}`);
    console.log(`pow(1.1, ${x}) = ${Math.pow(1.1, x)}`);
  }
  console.log(Math.pow(2, 1024));
  console.log(Math.pow(2, -1075));
  console.log(Math.pow(-8, 1 / 3));
  console.log(Math.exp(1000));
  console.log(Math.exp(-1000));
  console.log(Math.log(0));
  console.log(Math.log(-1));
  console.log(Math.sqrt(-1));
  console.log(Math.sin(Math.PI));
  console.log(Math.cos(Math.PI));
  console.log(Math.exp(1));
  console.log(Math.log(Math.E * Math.E));
  console.log(Math.pow(10, 308));
  console.log(Math.pow(10, -308));
  console.log(Math.pow(0, 0));
}
