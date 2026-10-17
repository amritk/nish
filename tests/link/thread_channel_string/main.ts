// A `Channel<string>` copies each string out of the sender's arena on `send`
// and into the receiver's on receive, so a string outlives the task that
// built it. Two producers feed a stage that rewrites each string onto a
// second channel; a consumer keeps what it receives, and the parent drains a
// third channel into an array it reads after the scope. `churn()` reuses the
// memory a missed copy would leave a kept string pointing at.
import { Channel, scope } from "nish/threads";

// Each string is kept, so the loop writes over the whole of what was freed
// rather than over the one string a rewound iteration reuses.
const churn = (): i32 => {
  const kept: string[] = [];
  let t = 0;
  for (let i = 0; i < 4000; i++) {
    const s = `jjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjj${i}`;
    kept.push(s);
    t = t + s.length;
  }
  return t + kept.length - 4000;
};

class Source {
  out: Channel<string>;
  tag: string;
  n: i32;

  constructor(out: Channel<string>, tag: string, n: i32) {
    this.out = out;
    this.tag = tag;
    this.n = n;
  }
}

class Stage {
  inp: Channel<string>;
  out: Channel<string>;

  constructor(inp: Channel<string>, out: Channel<string>) {
    this.inp = inp;
    this.out = out;
  }
}

class Sink {
  inp: Channel<string>;

  constructor(inp: Channel<string>) {
    this.inp = inp;
  }
}

// Concatenation in the sender: the string is in its arena until `send`
// copies it out. The literal is sent as it is.
const produce = (src: Source): i32 => {
  for (let i = 0; i < src.n; i++) {
    src.out.send(src.tag + `-${i}`);
  }
  src.out.send("end");
  return src.n;
};

// A received string, cut and rebuilt, sent on.
const rewrite = (st: Stage): i32 => {
  let n = 0;
  for (const s of st.inp) {
    st.out.send(`<${s.substring(0, 3)}${s.slice(3, s.length)}>`);
    n++;
  }
  return n;
};

// Received strings kept in an array that outlives the loop, read after
// `churn()`, and answered whole.
const consume = (sk: Sink): string => {
  const kept: string[] = [];
  let total = 0;
  for (const s of sk.inp) {
    kept.push(s);
    total = total + s.length;
  }
  churn();
  let ends = 0;
  let alpha = 0;
  let sum = 0;
  for (const s of kept) {
    if (s === "<end>") {
      ends++;
    }
    if (s.startsWith("<alp") && s.endsWith(">")) {
      alpha++;
    }
    sum = sum + s.charCodeAt(s.length - 2);
  }
  return `${kept.length} ${total} ${ends} ${alpha} ${sum}`;
};

export const main = (): i32 => {
  const counts: i32[] = [0, 0, 0, 0];
  const summary: string[] = [""];
  const raw = new Channel<string>();
  const cooked = new Channel<string>();
  const back = new Channel<string>();
  {
    using s = scope();
    s.spawn(produce, new Source(raw, "alpha", 3000), counts, 0);
    s.spawn(produce, new Source(raw, "beta", 2000), counts, 1);
    s.spawn(produce, new Source(back, "gamma", 500), counts, 3);
    s.spawn(rewrite, new Stage(raw, cooked), counts, 2);
    s.spawn(consume, new Sink(cooked), summary, 0);
  }
  // The parent receives too, after the scope: a closed channel drains.
  const mine: string[] = [];
  for (const s of back) {
    mine.push(s);
  }
  const c = churn();
  let gl = 0;
  for (const s of mine) {
    gl = gl + s.length;
  }
  console.log(`${counts[0]} ${counts[1]} ${counts[2]} ${counts[3]}`);
  console.log(summary[0]);
  console.log(`${mine.length} ${gl} ${c}`);
  return 0;
};
