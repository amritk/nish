// The join's two paths at their edges. Below 64 KB in all, the join copies
// into the caller's arena only the elements that point into a chunk's transfer
// block, and repoints them; at 64 KB or more it links the blocks whole
// (`nish_cross_adopt`). The first map answers a mix the copy must tell apart:
// a literal and a string the caller made, which no block holds, beside fresh
// strings that a block does; then two answers that fill 65,528 and exactly
// 65,536 bytes of blocks, one on each side of the line; then empty strings and
// empty arrays, which still take a block's header each. Every answer is read
// after `churn()`, which reuses whatever a freed block left behind. The bodies'
// loops are written to 40,000 and leave at 400, so the grain is 1 and each
// element is a chunk of its own as far as the machine has threads.
import { parallelFrom, parallelMap } from "nish/threads";

const churn = (): i32 => {
  const kept: string[] = [];
  let t = 0;
  for (let i = 0; i < 6000; i++) {
    const s = `kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk${i}`;
    kept.push(s);
    t = t + s.length;
  }
  return t + kept.length - 6000;
};

// Fresh strings of exactly `n` bytes, so each copy takes 8 + n + 1 rounded to
// 8: 32,751 and 32,759 bytes fill 32,760 and 32,768.
const under = (i: i32): string => {
  let h = i;
  for (let k = 0; k < 40000; k++) {
    if (k >= 400) {
      break;
    }
    h = (h * 31 + k) % 1000003;
  }
  const c = String.fromCharCode(97 + (h % 26));
  const parts: string[] = [];
  for (let j = 0; j < (i === 0 ? 32751 : 32759); j++) {
    parts.push(c);
  }
  return parts.join("");
};

const exact = (i: i32): string => {
  let h = i + 5;
  for (let k = 0; k < 40000; k++) {
    if (k >= 400) {
      break;
    }
    h = (h * 31 + k) % 1000003;
  }
  const c = String.fromCharCode(97 + (h % 26));
  const parts: string[] = [];
  for (let j = 0; j < 32759; j++) {
    parts.push(c);
  }
  return parts.join("");
};

const blank = (x: i32): string => {
  let h = x;
  for (let k = 0; k < 40000; k++) {
    if (k >= 400) {
      break;
    }
    h = (h * 31 + k) % 1000003;
  }
  const s = `${String.fromCharCode(97 + (h % 26))}`;
  return s.slice(0, 0);
};

const nothing = (i: i32): i32[] => {
  const a: i32[] = [];
  let h = i;
  for (let k = 0; k < 40000; k++) {
    if (k >= 400) {
      break;
    }
    h = (h * 17 + k) % 1000003;
  }
  if (h < 0) {
    a.push(i);
  }
  return a;
};

const sumOf = (ws: string[]): i32 => {
  let t = 0;
  for (const w of ws) {
    t = t + w.length;
    if (w.length > 0) {
      t = t + w.charCodeAt(0) + w.charCodeAt(w.length - 1);
    }
  }
  return t;
};

export const main = (): i32 => {
  const xs: i32[] = [];
  for (let i = 0; i < 16; i++) {
    xs.push(i);
  }
  const mine = `caller${xs.length}`;
  // A literal, the caller's string, or a fresh one, by `x % 3`.
  const mix = parallelMap(xs, (x): string => {
    let h = x;
    for (let k = 0; k < 40000; k++) {
      if (k >= 400) {
        break;
      }
      h = (h * 31 + k) % 1000003;
    }
    if (x % 3 === 0) {
      return "literal";
    }
    if (x % 3 === 1) {
      return mine;
    }
    return `fresh${h % 1000}`;
  });
  churn();
  console.log(`${mix[0]} ${mix[1]} ${mix[2]} ${mix[15]} ${sumOf(mix)}`);

  // Two chunks' blocks hold 65,528 bytes, copied in, then 65,536, linked.
  const low = parallelFrom(2, under);
  const at = parallelFrom(2, exact);
  churn();
  console.log(`${low[0].length} ${low[1].length} ${sumOf(low)} ${at[0].length} ${sumOf(at)}`);

  const empty = parallelMap(xs, blank);
  const none = parallelFrom(16, nothing);
  churn();
  let lens = 0;
  for (const a of none) {
    lens = lens + a.length;
  }
  console.log(`${empty.length} ${sumOf(empty)} ${none.length} ${lens}`);
  return 0;
};
