// A labelled `break` or `continue` that leaves a `using` block runs its
// disposals on the way out, as a `return` does: an `arena()`'s region is
// released (the next pass opens a fresh one), a `Mutex`'s guard (the next
// pass locks again, so a guard left held would deadlock) and a `scope()`, whose spawned task has
// joined by the time the jump lands.
import { Mutex, scope } from "nish/threads";

class Tally {
  n: i32 = 0;
}

const sumOf = (xs: i32[]): i32 => {
  let t: i32 = 0;
  for (const x of xs) {
    t = t + x;
  }
  return t;
};

const arenas = (): i32 => {
  let out: i32 = 0;
  outer: for (let i: i32 = 0; i < 3; i++) {
    for (let j: i32 = 0; j < 3; j++) {
      using a = arena();
      const tag = `${i}${j}`;
      if (j === 1) continue outer;
      if (i === 2) break outer;
      out = out * 100 + tag.length * 10 + i;
    }
  }
  return out;
};

const guards = (m: Mutex<Tally>): i32 => {
  rounds: for (let i: i32 = 0; i < 4; i++) {
    for (let j: i32 = 0; j < 4; j++) {
      using g = m.lock();
      g.value.n = g.value.n + 1;
      if (j === 1) continue rounds;
      if (i === 3) break rounds;
    }
  }
  using g = m.lock();
  return g.value.n;
};

const scopes = (): i32 => {
  const out: i32[] = [0, 0, 0];
  const xs: i32[] = [1, 2, 3];
  let seen: i32 = 0;
  passes: for (let i: i32 = 0; i < 3; i++) {
    block: {
      using s = scope();
      s.spawn(sumOf, xs, out, i);
      if (i === 0) break block;
      if (i === 1) continue passes;
      break passes;
    }
    seen = seen + out[i];
  }
  return seen + out[1] * 10 + out[2] * 100;
};

export const main = (): void => {
  console.log(arenas());
  const m = new Mutex<Tally>(new Tally());
  console.log(guards(m));
  console.log(scopes());
};
