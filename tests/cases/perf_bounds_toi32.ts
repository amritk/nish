// WP15 §2: `toI32(w.length)` is the length itself. It is the hoist a program
// has to write to compile in both number modes (`std/text` writes it in every
// function), so it proves what `const n = w.length` proves: no check on any
// access and no clamp on the guarded `substring` bound, and nothing reported.
// The second function hoists two array lengths in a row, and the second
// `toI32` must not take away the fact the first one recorded — the builtin
// is an inline conversion, not a callee that could `push`.
// `perf_bounds_toi32_f64` is this program under `--number-mode f64`.
const countCode = (s: string, code: i32): i32 => {
  const n: i32 = toI32(s.length);
  let count: i32 = 0;
  let i: i32 = 0;
  while (i < n) {
    if (toI32(s.charCodeAt(i)) === code) {
      count += 1;
    }
    i += 1;
  }
  return count;
};

const dot = (xs: i32[], ys: i32[]): i32 => {
  const xn: i32 = toI32(xs.length);
  const yn: i32 = toI32(ys.length);
  let total: i32 = 0;
  let i: i32 = 0;
  while (i < xn && i < yn) {
    total += xs[i] * ys[i];
    i += 1;
  }
  return total;
};

const tails = (s: string, from: i32[]): string[] => {
  const out: string[] = [];
  for (const k of from) {
    if (k >= 0 && k <= toI32(s.length)) {
      out.push(s.substring(k));
    }
  }
  return out;
};

export const main = (): i32 => {
  console.log(countCode("banana", 97));
  console.log(dot([1, 2, 3], [4, 5]));
  console.log(tails("abc", [0, 2, 3, 4, -1]).join(","));
  return 0;
};
