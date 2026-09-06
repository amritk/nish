// Automatic arena scope (WP6): `new Array<number>(n)` has a dynamic size, so it
// cannot go on the stack, but it never escapes `histogram`, so the function
// marks the arena on entry and releases it before returning. Called 100000
// times, `Arena.used()` does not grow (tests/run.js compares the two lines).
function histogram(n: number, seed: number): number {
  const counts = new Array<number>(n);
  let x = seed;
  for (let i = 0; i < 1000; i++) {
    x = (x * 31 + 7) % 1000003; // stays non-negative and far from i32 overflow
    counts[x % n] += 1;
  }
  let best = 0;
  for (let i = 0; i < n; i++) {
    if (counts[i] > counts[best]) {
      best = i;
    }
  }
  return best;
}

export function main(): number {
  console.log(histogram(16, 1));
  const before = Arena.used();
  let acc = 0;
  for (let i = 0; i < 100000; i++) {
    acc += histogram(16 + (i % 5), i);
  }
  const after = Arena.used();
  console.log(before);
  console.log(acc);
  console.log(after);
  return 0;
}
