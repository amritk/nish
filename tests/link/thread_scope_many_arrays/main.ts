// WP29 P2: N tasks, each over an array of its own, answering into one
// destination — the scope's basic use, in the four shapes review round 3 of
// #262 asked for. Every argument is an `i32[]` like the destination, which is
// fine because the destination is a fresh `const` array nothing else names:
// arguments built before the scope (`pre_two`), taken out of an array of them
// (`pre_rows`), built by a call in the spawning loop that fills only the array
// it allocates (`loop_rows`), and a literal written after the first spawn
// (`loop_lit`).
import { scope } from "nish/threads";

const total = (xs: i32[]): i32 => {
  let t: i32 = 0;
  for (const x of xs) {
    t = t + x;
  }
  return t;
};

const row = (k: i32): i32[] => {
  const r: i32[] = [];
  for (let i: i32 = 0; i < 100; i++) {
    r.push(k * i);
  }
  return r;
};

const preTwo = (): void => {
  const out: i32[] = [0, 0];
  const a: i32[] = [1, 2, 3];
  const b: i32[] = [4, 5, 6];
  {
    using s = scope();
    s.spawn(total, a, out, 0);
    s.spawn(total, b, out, 1);
  }
  console.log(`pre_two ${out[0]} ${out[1]}`);
};

const preRows = (): void => {
  const out: i32[] = [0, 0, 0, 0];
  const rows: i32[][] = [row(1), row(2), row(3), row(4)];
  {
    using s = scope();
    for (let k: i32 = 0; k < 4; k++) {
      s.spawn(total, rows[k], out, k);
    }
  }
  console.log(`pre_rows ${out[0]} ${out[1]} ${out[2]} ${out[3]}`);
};

const loopRows = (): void => {
  const out: i32[] = [0, 0, 0, 0];
  {
    using s = scope();
    for (let k: i32 = 0; k < 4; k++) {
      s.spawn(total, row(k + 1), out, k);
    }
  }
  console.log(`loop_rows ${out[0]} ${out[1]} ${out[2]} ${out[3]}`);
};

const loopLit = (): void => {
  const out: i32[] = [0, 0];
  {
    using s = scope();
    const a: i32[] = [1, 2, 3];
    s.spawn(total, a, out, 0);
    const b: i32[] = [4, 5, 6];
    s.spawn(total, b, out, 1);
  }
  console.log(`loop_lit ${out[0]} ${out[1]}`);
};

export const main = (): i32 => {
  preTwo();
  preRows();
  loopRows();
  loopLit();
  return 0;
};
