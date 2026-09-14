// WP15 §8: `--no-strict-exports` keeps a function this module does not export
// an external symbol, so the whole-program passes must assume callers they
// cannot see. Reported at the call, and only inside a loop, which is where it
// costs something: measured 240 bytes on `bench/sieve`, and no time at all.
// The flag is in `.args`, so the default build of this file says nothing.
const step = (n: i32): i32 => n * 2 + 1;

export const helper = (n: i32): i32 => n + 1;

export const test = (): number => {
  let total = 0;
  let i = 0;
  while (i < 4) {
    // Not exported, so `--strict-exports` would have made it `internal`.
    total = total + step(i);
    // Exported: the ABI is the point, and the flag changes nothing for it.
    total = total + helper(i);
    i = i + 1;
  }
  // Outside the loop one call is not a cost anybody is paying.
  return total + step(0);
};
