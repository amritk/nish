// WP22 §4: a concise arrow body is the one `return` it means, so every
// contextual type a `return` hands its expression it hands this one too — the
// struct an object literal takes, the interface a class value converts to, the
// width of a numeric literal, the element type of `[]` — and a value the body
// allocates is *returned* rather than local, so the caller brackets the call
// with WP9's arena reclaim (`nish_arena_mark` / `nish_arena_keep`).
interface Pair {
  first: i32;
  second: i32;
}

class Ordered implements Pair {
  first: i32;
  second: i32;
  constructor(a: i32, b: i32) {
    this.first = a;
    this.second = b;
  }
}

const asPair = (o: Ordered): Pair => o;

const swap = (p: Pair): Pair => ({ first: p.second, second: p.first });

const full = (): u8 => 255;

const empty = (): i32[] => [];

const label = (n: i32): string => `<${n}>`;

const shout = (n: i32): string => label(n) + "!";

export const main = (): number => {
  const p = swap(asPair(new Ordered(1, 2)));
  console.log(`${p.first} ${p.second}`);
  console.log(`${full()}`);
  console.log(`${empty().length}`);
  console.log(shout(3));
  return 0;
};
