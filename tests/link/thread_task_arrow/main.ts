// WP29: an arrow given to `spawn` reads the `const` locals and the parameters
// of the function it is written in, and each one it reads is handed to the
// task as its argument is, copied into the task's payload at the spawn and
// read on the task's thread when the scope joins. Every form takes one here:
// `s.spawn(() => ...)` with no argument and no destination, a concise and a
// block body, an arrow with a parameter and a destination, a captured scalar,
// array, object, string, parameter and `Mutex`, a narrowed nullable, and a
// `const` bound to `this` in a method. Under Node each task runs at its spawn,
// and the guarded sums commute, so both print the same.
import { Mutex, scope } from "nish/threads";

class Tally {
  total: i32 = 0;
  calls: i32 = 0;
}

class Weights {
  scale: i32 = 3;

  /** `this` is not captured, but a `const` bound to it is a reference like any other. */
  scaledSum(xs: i32[]): i32 {
    const self = this;
    const out: i32[] = [0];
    {
      using s = scope();
      s.spawn((k: i32): i32 => sumOf(xs) * self.scale + k, 1, out, 0);
    }
    return out[0];
  }
}

const sumOf = (xs: i32[]): i32 => {
  let t: i32 = 0;
  for (const x of xs) {
    t = t + x;
  }
  return t;
};

/** Adds `n` to the tally under its lock: the one shared write a task may make. */
const addTo = (tally: Mutex<Tally>, n: i32): void => {
  using g = tally.lock();
  g.value.total = g.value.total + n;
  g.value.calls = g.value.calls + 1;
};

/** `scale` is a parameter, captured as a `const` local is. */
const scaledParts = (xs: i32[], ys: i32[], scale: i32): i32 => {
  const out: i32[] = [0, 0];
  {
    using s = scope();
    s.spawn((n: i32): i32 => sumOf(xs) * scale + n, 0, out, 0);
    s.spawn((n: i32): i32 => sumOf(ys) * scale + n, 1, out, 1);
  }
  return out[0] + out[1];
};

/** The capture's narrowing at the spawn holds in the task, because a `const` cannot change. */
const weighted = (w: Weights | null, xs: i32[]): i32 => {
  if (w !== null) {
    const out: i32[] = [0];
    {
      using s = scope();
      s.spawn((n: i32): i32 => sumOf(xs) * w.scale + n, 0, out, 0);
    }
    return out[0];
  }
  return -1;
};

export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3, 4];
  const ys: i32[] = [10, 20];
  const word = "nish";
  const k: i32 = 7;
  const tally = new Mutex<Tally>(new Tally());
  {
    using s = scope();
    s.spawn(() => addTo(tally, sumOf(xs)));
    s.spawn(() => addTo(tally, sumOf(ys) + k));
    s.spawn(() => {
      const n: i32 = toI32(word.length);
      addTo(tally, n * k);
    });
  }
  const w = new Weights();
  console.log(`${scaledParts(xs, ys, 2)} ${weighted(w, xs)} ${w.scaledSum(ys)}`);
  using g = tally.lock();
  console.log(`${g.value.total} ${g.value.calls}`);
  return 0;
};
