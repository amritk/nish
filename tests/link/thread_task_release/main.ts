// Each task bumps some 60 KB of temporaries, and each scope spawns 8,000 of
// them: one answers a short string, one an `i32`, one nothing. A task's
// temporaries are released where it ran once it has answered, whatever it
// answers: a worker's arena is also reset by the pool, but the caller's,
// which runs every task under `NISH_NUM_THREADS=1` and drains the rest
// otherwise, is not. Without that release the caller kept every task's
// temporaries, and one thread peaked at 3.5 GB rather than 3 MB. The `i32`
// and `void` bodies store through a guard, so they open no arena scope of
// their own (WP6) and the release around the task is the only one.
import { Mutex, scope } from "nish/threads";

const build = (n: i32): string[] => {
  const parts: string[] = [];
  for (let i = 0; i < 2000; i++) {
    parts.push(`${n}-${i}-padding`);
  }
  return parts;
};

class Box {
  m: Mutex<string>;
  id: i32;

  constructor(m: Mutex<string>, id: i32) {
    this.m = m;
    this.id = id;
  }
}

const work = (n: i32): string => {
  return `${n}:${build(n).length}`;
};

const count = (b: Box): i32 => {
  const parts = build(b.id);
  using g = b.m.lock();
  g.value = parts[1999];
  return parts[1999].length;
};

const discard = (b: Box): void => {
  const parts = build(b.id);
  using g = b.m.lock();
  g.value = parts[0];
};

export const main = (): i32 => {
  const word = new Mutex<string>("start");
  const out: string[] = [];
  const lengths: i32[] = [];
  for (let i = 0; i < 8000; i++) {
    out.push("");
    lengths.push(0);
  }
  {
    using s = scope();
    for (let i = 0; i < out.length; i++) {
      s.spawn(work, i, out, i);
    }
  }
  {
    using s = scope();
    for (let i = 0; i < lengths.length; i++) {
      s.spawn(count, new Box(word, i), lengths, i);
    }
  }
  {
    using s = scope();
    for (let i = 0; i < 8000; i++) {
      s.spawn(discard, new Box(word, 7));
    }
  }
  let t = 0;
  let u = 0;
  for (let i = 0; i < out.length; i++) {
    t = t + out[i].length;
    u = u + lengths[i];
  }
  let first = "";
  {
    using g = word.lock();
    first = g.value;
  }
  console.log(`${t} ${out[7999]} ${u} ${first}`);
  return 0;
};
