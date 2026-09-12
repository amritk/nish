// WP19 G1: a `!DILocation` column counts **bytes**, which is what `clang -g`
// writes and what a debugger reads the column back against. stage0 counted the
// UTF-16 code units the `typescript` API hands it, so the two compilers
// disagreed about every position that follows a non-ASCII character on its own
// line. No case in `tests/cases` had one; `self/checker.ts` has an em dash
// inside a warning string, which is where `--parity` found it.
//
// The em dash below is three bytes and one code unit, so each of `+`, `8` and
// the closing backtick on its line is two columns further along in bytes than
// in code units — the golden pins the byte count.

export const main = (): number => {
  const n = "—".length + 8;
  console.log(`${n}`);
  return n - 11;
};
