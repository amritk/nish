// A guard stores a `string` a task built into a `string | null` slot of the
// `Mutex`'s data: a nullable field, an element of a `(string | null)[]`, and
// the value of a `Mutex<string | null>`. Each store copies the string into
// memory the `Mutex` owns, as a store into a `string` slot does. A task's arena
// is rewound once it is joined, and `churn()` reuses the memory a missed copy
// would leave the slot pointing at.
import { Mutex, scope } from "nish/threads";

// Each string is kept, so the loop writes over the whole of what was freed
// rather than over the one string a rewound iteration reuses.
const churn = (): i32 => {
  const kept: string[] = [];
  let t = 0;
  for (let i = 0; i < 4000; i++) {
    const s = `kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk${i}`;
    kept.push(s);
    t = t + s.length;
  }
  return t + kept.length - 4000;
};

const churnTask = (n: i32): i32 => churn() + n;

class Slots {
  last: string | null;
  names: (string | null)[];

  constructor() {
    this.last = null;
    this.names = [null, null, null, null];
  }
}

class Job {
  m: Mutex<Slots>;
  word: Mutex<string | null>;
  id: i32;

  constructor(m: Mutex<Slots>, word: Mutex<string | null>, id: i32) {
    this.m = m;
    this.word = word;
    this.id = id;
  }
}

const work = (job: Job): i32 => {
  for (let i = 0; i < 100; i++) {
    const piece = `${job.id}:${i}`;
    {
      using g = job.m.lock();
      g.value.last = piece;
      g.value.names[job.id] = `n${piece}`;
    }
    {
      using w = job.word.lock();
      w.value = `w:${i}`;
    }
  }
  return job.id;
};

// What the slot holds, read under the lock through `?.`, the one read of a
// `string | null` a guard's chain allows: its length and a checksum of its
// bytes, which a slot left pointing into a rewound arena would not keep.

export const main = (): i32 => {
  const m = new Mutex<Slots>(new Slots());
  const word = new Mutex<string | null>("start");
  const done: i32[] = [0, 0, 0, 0];
  {
    using s = scope();
    for (let i = 0; i < 4; i++) {
      s.spawn(work, new Job(m, word, i), done, i);
    }
  }
  const again: i32[] = [0, 0, 0, 0];
  {
    using s = scope();
    for (let i = 0; i < 4; i++) {
      s.spawn(churnTask, i, again, i);
    }
  }
  const c = churn() + again[3] - again[0];
  const out: string[] = [];
  {
    using g = m.lock();
    out.push(`${g.value.last?.length ?? -1}`);
    for (let i = 0; i < 4; i++) {
      let k = 0;
      for (let j = 0; j < 5; j++) {
        k = k + (g.value.names[i]?.charCodeAt(j) ?? -1);
      }
      out.push(`${g.value.names[i]?.length ?? -1}:${k}`);
    }
  }
  {
    using g = word.lock();
    let k = 0;
    for (let j = 0; j < 4; j++) {
      k = k + (g.value?.charCodeAt(j) ?? -1);
    }
    out.push(`${g.value?.length ?? -1}:${k}`);
  }
  out.push(`${c}`);
  console.log(out.join(" "));
  return 0;
};
