// WP15 §2: a scanner's cursor, which `for (const c of s)` cannot express — the
// body advances `i` by a variable amount. A string's length cannot change once
// the variable holding it is bound, so the guard in each loop condition proves
// every `charCodeAt` in the region it reaches, including the one behind the
// `&&` and the one after a user call. The golden is the assertion: no
// `bounds.fail`, no `nish_panic_index`.
const isAlpha = (c: i32): boolean => c >= 97 && c <= 122;

export const test = (): number => {
  const s = "ab cd ef";
  let words = 0;
  let i = 0;
  while (i < s.length) {
    if (isAlpha(s.charCodeAt(i))) {
      words = words + 1;
      while (i < s.length && isAlpha(s.charCodeAt(i))) {
        i = i + 1;
      }
    } else {
      i = i + 1;
    }
  }
  return words;
};
