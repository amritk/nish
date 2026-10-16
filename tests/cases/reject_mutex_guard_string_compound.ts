// A guarded `string` slot takes a new string only by `=`, which copies it into
// memory the `Mutex` owns (`nish_guard_keep`). `+=` on a string is refused
// everywhere, so the compound store, which copies nothing, never sees one.
import { Mutex, scope } from "nish/threads";

class Log {
  text: string;
  names: string[];

  constructor() {
    this.text = "";
    this.names = ["", ""];
  }
}

class Job {
  m: Mutex<Log>;
  id: i32;

  constructor(m: Mutex<Log>, id: i32) {
    this.m = m;
    this.id = id;
  }
}

const work = (job: Job): i32 => {
  using g = job.m.lock();
  g.value.text += `${job.id};`;
  g.value.names[job.id] += `n${job.id}`;
  return job.id;
};

export const main = (): i32 => {
  const m = new Mutex<Log>(new Log());
  const seen: i32[] = [0, 0];
  {
    using s = scope();
    s.spawn(work, new Job(m, 0), seen, 0);
    s.spawn(work, new Job(m, 1), seen, 1);
  }
  return seen[1];
};
