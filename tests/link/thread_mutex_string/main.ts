// A guard stores a `string` into the `Mutex`'s data and reads one back. The
// store copies the string into memory the `Mutex` owns and frees the copy it
// replaces; a read that keeps the string past the lock's block copies it
// into the reader's arena. A task's arena is rewound once it is joined, and
// `churn()` reuses the memory a missed copy would leave a reader pointing at.
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

class Log {
  text: string;
  names: string[];
  count: i32;

  constructor() {
    this.text = "";
    this.names = ["", "", "", ""];
    this.count = 0;
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

// Each store replaces a string a task built in its arena: a field, and an
// element of an array the data already holds. A string method runs on a
// field through the guard; the read copies what it keeps.
const work = (job: Job): i32 => {
  let seen = 0;
  for (let i = 0; i < 200; i++) {
    const piece = `${job.id}:${i};`;
    using g = job.m.lock();
    g.value.text = g.value.text + piece;
    g.value.names[job.id] = `n${job.id}-${i}`;
    seen = seen + g.value.text.indexOf(";");
    g.value.count = g.value.count + 1;
  }
  return seen;
};

// A `Mutex<string>`: the guard's value is the string itself.
class Box {
  m: Mutex<string>;
  id: i32;

  constructor(m: Mutex<string>, id: i32) {
    this.m = m;
    this.id = id;
  }
}

const bump = (b: Box): i32 => {
  for (let i = 0; i < 100; i++) {
    using g = b.m.lock();
    g.value = `${b.id}-${i}`;
  }
  return b.id;
};

export const main = (): i32 => {
  const m = new Mutex<Log>(new Log());
  const word = new Mutex<string>("start");
  const seen: i32[] = [0, 0, 0, 0, 0, 0];
  {
    using s = scope();
    for (let i = 0; i < 4; i++) {
      s.spawn(work, new Job(m, i), seen, i);
    }
    s.spawn(bump, new Box(word, 7), seen, 4);
    s.spawn(bump, new Box(word, 7), seen, 5);
  }
  // Read after the scope, kept past the lock's block, and read after churn.
  let text = "";
  let names = "";
  let count = 0;
  {
    using g = m.lock();
    text = g.value.text;
    names = g.value.names[0] + g.value.names[1] + g.value.names[2] + g.value.names[3];
    count = g.value.count;
    g.value.text = "reset";
  }
  let last = "";
  {
    using g = word.lock();
    last = g.value;
  }
  const c = churn();
  let semis = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 59) {
      semis++;
    }
  }
  let after = "";
  {
    using g = m.lock();
    after = g.value.text;
  }
  console.log(`${text.length} ${semis} ${count} ${names}`);
  console.log(`${last} ${after} ${seen[0] + seen[1] + seen[2] + seen[3]} ${seen[4]} ${c}`);
  return 0;
};
