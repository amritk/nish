// WP15 §4's fast slice: `slice` copies the bytes of `[start, end)` with no
// clamp, so the lowering is two unsigned compares against a cold panic block
// instead of `substring`'s six `llvm.smin` / `llvm.smax` calls. `end` defaults
// to `s.length`, and an empty range is an empty string rather than a panic.
const cut = (s: string, from: number, to: number): string => s.slice(from, to);

const rest = (s: string, from: number): string => s.slice(from);

export const test = (): number => {
  const s = "hello,world";
  const head = cut(s, 0, 5);
  const tail = rest(s, 6);
  const empty = cut(s, 3, 3);
  const whole = cut(s, 0, s.length);
  let flags = 0;
  if (head === "hello") flags += 1;
  if (tail === "world") flags += 2;
  if (empty === "") flags += 4;
  if (whole === s) flags += 8;
  if (rest(s, s.length) === "") flags += 16;
  return head.length * 1000 + tail.length * 100 + flags;
};
