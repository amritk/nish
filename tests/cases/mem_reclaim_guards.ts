// WP9 guard cases: three string-returning callees that must NOT be bracketed
// by the call-site reclaim, and one that must. The golden is read for absence,
// which is the whole point — a wrong reclaim is a use-after-free that no `.out`
// would catch, so the four calls in `main` are kept side by side.
//
//   fill    stores the string it built into an object its caller still holds,
//           so `allocEscapes` is true: those bytes are not garbage.
//   sweep   calls `Arena.reset()`, which moves the arena under any mark taken
//           around it (`usesArenaControl`).
//   label   returns a `Result<string, number>`, a pointer to a two-word object
//           whose payload was bumped *before* it. Only a plain `string` may be
//           kept, because only a string is one flat block with no interior
//           pointers; relocating the `Result` would free the payload it names.
//   plain   is the one that qualifies, and gets the mark/keep pair.
class Box {
  text: string;
  constructor(text: string) {
    this.text = text;
  }
}

function fill(b: Box, i: number): string {
  const s = `v${i}`;
  b.text = s;
  return s;
}

function sweep(i: number): string {
  Arena.reset();
  return `r${i}`;
}

function label(i: number): Result<string, number> {
  return Ok(`L${i}`);
}

function plain(i: number): string {
  return `p${i}`;
}

export function main(): number {
  const b = new Box("");
  console.log(fill(b, 1));
  console.log(b.text);
  console.log(sweep(2));
  console.log(label(3).unwrapOr("none"));
  console.log(plain(4));
  return 0;
}
