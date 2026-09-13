// WP15 §4's `slice` against Node: the shim cuts the UTF-8 bytes, so a
// multi-byte character is several indices on both sides and every cut here
// stays on a character boundary. Only in-range, non-negative pairs appear,
// because that is the whole of what `slice` accepts — out of range panics
// rather than clamping, and there is nothing to compare a panic against.
function show(s: string, cut: number): void {
  console.log(`[${s.slice(0, cut)}] [${s.slice(cut)}] [${s.slice(cut, cut)}] [${s.slice(0, s.length)}]`);
}

export function main(): number {
  show("hello", 2);
  show("héllo", 3);
  show("", 0);
  const text = "one,two,three";
  let start = 0;
  for (;;) {
    const at = text.slice(start).indexOf(",");
    if (at < 0) {
      console.log(text.slice(start));
      break;
    }
    console.log(text.slice(start, start + at));
    start = start + at + 1;
  }
  return 0;
}
