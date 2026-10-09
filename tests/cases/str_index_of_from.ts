// `s.indexOf(sub, from)`: the search starts at `from`, which is clamped into
// `[0, s.length]` first, as JavaScript clamps it: a negative start is 0, a
// start past the end finds nothing but the empty needle, which answers the
// clamped start. A float start converts as `ToIntegerOrInfinity` does (a
// fraction truncates, NaN is 0). One `nish_str_index_of_from` call, no
// allocation.
const find = (s: string, sub: string, from: number): number => s.indexOf(sub, from);

const findF = (s: string, sub: string, from: f64): number => s.indexOf(sub, from);

// An unsigned start is clamped from above only: a `u64` past 2^63 is past the
// end, not negative.
const findU = (s: string, sub: string, from: u64): number => s.indexOf(sub, from);

/** Every offset `sub` occurs at, each search starting past the last match. */
const count = (s: string, sub: string): number => {
  let n = 0;
  let at = s.indexOf(sub, 0);
  while (at >= 0) {
    n = n + 1;
    at = s.indexOf(sub, at + sub.length);
  }
  return n;
};

export const main = (): number => {
  const s = "abcabc";
  console.log(find(s, "b", 0)); // from 0
  console.log(find(s, "b", 2)); // mid-string, past the first match
  console.log(find(s, "b", 4)); // a match exactly at the start
  console.log(find(s, "b", 99)); // past the end
  console.log(find(s, "a", -5)); // negative: from 0
  console.log(find(s, "", 3)); // empty needle: the start itself
  console.log(find(s, "", 99)); // empty needle past the end: the length
  console.log(find(s, "", -1)); // empty needle before the start: 0
  console.log(find(s, "bc", 4)); // a match at the very end
  console.log(find(s, "c", 6)); // from the length itself
  console.log(find(s, "abc", 4)); // longer than what is left
  console.log(find("", "a", 0)); // empty haystack
  console.log(findF(s, "b", 1.5)); // a fraction truncates
  const zero: f64 = 0;
  console.log(findF(s, "a", zero / zero)); // NaN is 0
  const step: u64 = 1024;
  const huge: u64 = 9007199254740992 * step; // 2^63
  console.log(findU(s, "b", 2)); // an unsigned start
  console.log(findU(s, "", huge)); // 2^63 is past the end, not negative
  console.log(s.indexOf("c", 3)); // a literal start
  console.log(count("a,b,,c,", ","));
  console.log(count("aaaa", "aa"));
  return 0;
};
