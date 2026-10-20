// A guard stores `null` into a `string | null` slot of the `Mutex`'s data — a
// nullable field, an element of a `(string | null)[]`, and the value of a
// `Mutex<string | null>` — as well as strings a task built. A string's store
// copies it into memory the `Mutex` owns; a `null`'s store frees the copy the
// slot held and keeps nothing. Tasks alternate the two, so every copy but the
// last is freed by the store after it. A task's arena is rewound once it is
// joined, and `churn()` reuses the memory a missed copy would leave a slot
// pointing at.
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
    this.last = "start";
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

// Every task's last store into the shared field is `null`, and into the
// `Mutex<string | null>` the same string, so what each holds at the join is
// the same whichever task stored last. Each task's element ends `null` when
// its id is even and its last string when odd.
const work = (job: Job): i32 => {
  for (let i = 0; i < 100; i++) {
    const piece = `${job.id}:${i}`;
    {
      using g = job.m.lock();
      if (i % 2 === 0) {
        g.value.last = piece;
      } else {
        g.value.last = null;
      }
      if ((i + job.id) % 2 === 0) {
        g.value.names[job.id] = null;
      } else {
        g.value.names[job.id] = `n${piece}`;
      }
    }
    {
      using w = job.word.lock();
      if (i % 3 === 0) {
        w.value = null;
      } else {
        w.value = `w:${i}`;
      }
    }
  }
  return job.id;
};

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
  // What a slot holds, read under the lock through `?.`, the one read of a
  // `string | null` a guard's chain allows: its length and a checksum of its
  // bytes, which a slot left pointing into a rewound arena would not keep, or
  // -1 for a slot that holds `null`.
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
    using w = word.lock();
    let k = 0;
    for (let j = 0; j < 4; j++) {
      k = k + (w.value?.charCodeAt(j) ?? -1);
    }
    out.push(`${w.value?.length ?? -1}:${k}`);
  }
  // The main thread's own stores: a string after the churn, then `null` over
  // it, then a string again, each read back.
  {
    using g = m.lock();
    g.value.last = `main${c % 10}`;
    out.push(`${g.value.last?.length ?? -1}`);
    g.value.last = null;
    out.push(`${g.value.last?.length ?? -1}`);
    g.value.names[1] = null;
    g.value.names[0] = `back${c % 7}`;
    out.push(`${g.value.names[0]?.length ?? -1}:${g.value.names[1]?.length ?? -1}`);
  }
  {
    using w = word.lock();
    w.value = null;
    out.push(`${w.value?.length ?? -1}`);
    w.value = "end";
    out.push(`${w.value?.length ?? -1}`);
  }
  out.push(`${c}`);
  console.log(out.join(" "));
  return 0;
};
