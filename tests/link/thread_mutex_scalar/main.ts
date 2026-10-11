// WP29 P3: a `Mutex` of a scalar, read and stored directly through
// `g.value`, and a `Mutex` made from an object holding a string literal,
// which is fresh because a string is immutable. Four tasks add to both under
// their locks; the store to `g.value` itself reaches the `Mutex` under Node as
// natively, because the guard is the `Mutex`'s own storage, not a copy.
import { Mutex, scope } from "nish/threads";

class Label {
  name: string;
  hits: i32;

  constructor(name: string, hits: i32) {
    this.name = name;
    this.hits = hits;
  }
}

class Job {
  times: i32;
  count: Mutex<i32>;
  label: Mutex<Label>;

  constructor(times: i32, count: Mutex<i32>, label: Mutex<Label>) {
    this.times = times;
    this.count = count;
    this.label = label;
  }
}

const work = (job: Job): i32 => {
  for (let k: i32 = 0; k < job.times; k++) {
    {
      using g = job.count.lock();
      g.value = g.value + 2;
    }
    using h = job.label.lock();
    h.value.hits = h.value.hits + toI32(h.value.name.length);
  }
  return 0;
};

export const main = (): i32 => {
  const count = new Mutex<i32>(0);
  const label = new Mutex<Label>(new Label("total", 0));
  const done: i32[] = [0, 0, 0, 0];
  {
    using s = scope();
    for (let t: i32 = 0; t < 4; t++) {
      s.spawn(work, new Job(50000, count, label), done, t);
    }
  }
  {
    using g = count.lock();
    g.value = g.value + 1;
  }
  let total: i32 = 0;
  {
    using g = count.lock();
    total = g.value;
  }
  using h = label.lock();
  console.log(`${total} ${h.value.hits}`);
  return 0;
};
