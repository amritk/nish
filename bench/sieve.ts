// Sieve of Eratosthenes over a boolean array (i32 mode), PASSES times over
// the same 10 MB array (cleared between passes) so the run lasts long enough
// to time. The marking loop is the hot path: one bounds-checked byte store per
// composite. The outer loop stops at i*i <= n, so i*i never overflows an i32.
// Prints the summed prime count.
function sieve(composite: boolean[], n: number): number {
  for (let i = 0; i <= n; i++) {
    composite[i] = false;
  }
  for (let i = 2; i * i <= n; i++) {
    if (!composite[i]) {
      for (let j = i * i; j <= n; j += i) {
        composite[j] = true;
      }
    }
  }
  let count = 0;
  for (let i = 2; i <= n; i++) {
    if (!composite[i]) {
      count++;
    }
  }
  return count;
}

export function main(): number {
  const N = 10000000; // bench:n
  const PASSES = 20;
  const composite = new Array<boolean>(N + 1);
  let total = 0;
  for (let pass = 0; pass < PASSES; pass++) {
    total += sieve(composite, N);
  }
  console.log(total);
  return 0;
}
