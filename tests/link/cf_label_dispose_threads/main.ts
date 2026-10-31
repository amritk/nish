// A labelled `break` or `continue` that leaves a `using` block runs its
// disposals on the way out, as a `return` does: a `Mutex`'s guard is given
// back (the next pass locks again, so a guard left held would deadlock), and
// a `scope()` joins its spawned task before the jump lands. Its partner case
// without `nish/threads` is tests/cases/cf_label_dispose.
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
    seen = seen + 1;
  }
  return seen + out[0] + out[1] * 10 + out[2] * 100;
};

export const main = (): i32 => {
  const m = new Mutex<Tally>(new Tally());
  console.log(guards(m));
  console.log(scopes());
  return 0;
};
