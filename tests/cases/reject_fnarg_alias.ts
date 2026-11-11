// WP51: an alias may name a function type anywhere a type goes, and what is
// stored through it is still a top-level function: a method needs its
// receiver, so `c.step` is no reference.
type Step = (x: i32) => i32;

class Counter {
  step(x: i32): i32 {
    return x + 1;
  }
}

export const main = (): i32 => {
  const c = new Counter();
  const s: Step = c.step;
  return s(1);
};
