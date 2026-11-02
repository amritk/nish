// NL2613: a handle in a field of a task's argument: a region is entered
// only on the thread that made it.
import { Region, enter, enterWith, free, region, regionWith } from "nish:region";
import { scope } from "nish/threads";

class Box {
  n: i32 = 0;
  items: i32[];
  constructor() {
    this.items = [];
  }
}

class Job {
  r: Region<Box>;
  constructor(r: Region<Box>) {
    this.r = r;
  }
}

const run = (j: Job): i32 => 1;

export const main = (): i32 => {
  const r = region((): Box => new Box());
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(run, new Job(r), out, 0);
  }
  free(r);
  return out[0];
};
