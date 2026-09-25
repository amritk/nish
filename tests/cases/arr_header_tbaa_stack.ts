// Stack arrays: the escape analysis proves neither `xs` leaves its function,
// so each header is an entry-block `alloca` and its stores carry the header
// tag like an arena header's. `sum` reads the header across class-field
// stores. `widen` pushes past the capacity, so `nish_array_grow` rewrites the
// alloca header's `cap` and `data` from C: the length and the element read
// after the push have to see the grown header, not the one read before it.
class Counter {
  n: i32 = 0;
  last: i32 = 0;
}

const sum = (c: Counter): i32 => {
  const xs = [3, 4, 5, 6];
  c.n = c.n + 1;
  let total = 0;
  for (let i = 0; i < xs.length; i += 1) {
    total = total + xs[i];
    c.last = xs[i];
  }
  return total * 10 + xs.length;
};

const widen = (c: Counter): i32 => {
  const xs = [1, 2];
  const n0 = xs.length;
  c.n = 5;
  xs.push(3);
  c.last = 9;
  return n0 * 100 + xs.length * 10 + xs[2];
};

export const test = (): i32 => {
  const c = new Counter();
  const a = sum(c);
  const b = sum(c);
  const w = widen(c);
  return a * 1000 + (b - a) + w + c.n * 10000000 + c.last;
};
