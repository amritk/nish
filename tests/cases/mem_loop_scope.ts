// A loop's temporaries are reclaimed pass by pass (#216). `summarise` returns
// a pointer, so the function scope never applied to it, and every list
// `build` made lived until `summarise`'s caller released its own mark. Each
// list is garbage once its length is read, nothing the pass allocates reaches
// a local declared outside the loop or older memory, so each pass is
// bracketed with `nish_arena_mark` / `nish_arena_release` and the arena is
// the same height after 4000 rounds as after one.
class Box {
  length: i32;

  constructor(length: i32) {
    this.length = length;
  }
}

const build = (n: i32): i32[] => {
  const xs: i32[] = [];
  for (let i = 0; i < 64 + (n % 7); i++) {
    xs.push(i);
  }
  return xs;
};

const summarise = (rounds: i32): Box => {
  let total = 0;
  for (let i = 0; i < rounds; i++) {
    const xs = build(i);
    total = total + xs.length;
  }
  return new Box(total);
};

/** How far a call to `summarise(rounds)` moves the arena, and what it answered. */
const grows = (rounds: i32): string => {
  const m = Arena.mark();
  const before = Arena.used();
  const box = summarise(rounds);
  const grown = Arena.used() - before;
  const total = box.length;
  Arena.release(m);
  return `${total} ${grown}`;
};

export const main = (): void => {
  const one = grows(1);
  const many = grows(4000);
  console.log(one);
  console.log(many);
  const g1 = one.substring(one.indexOf(" ") + 1, one.length);
  const g2 = many.substring(many.indexOf(" ") + 1, many.length);
  console.log(g1 === g2 ? "flat" : "grows");
};
