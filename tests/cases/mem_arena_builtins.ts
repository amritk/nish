// Explicit arena control (WP6): Arena.mark / release / used / reset. A function
// that calls `Arena.release` or `Arena.reset` never gets an automatic scope.
class Blob {
  a: number;
  b: number;

  constructor(a: number) {
    this.a = a;
    this.b = a * 2;
  }
}

function fill(n: number): Blob[] {
  const xs: Blob[] = [];
  for (let i = 0; i < n; i++) {
    xs.push(new Blob(i));
  }
  return xs;
}

export function main(): number {
  const base = Arena.used();
  const m = Arena.mark();
  const xs = fill(1000);
  console.log(xs[999].b);
  console.log(Arena.used() > base);
  Arena.release(m);
  console.log(Arena.used() === base);
  const ys = fill(10);
  console.log(ys.length);
  Arena.reset();
  console.log(Arena.used());
  return 0;
}
