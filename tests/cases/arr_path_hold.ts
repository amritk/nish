// #106: where a property-path length fact holds, and the check comes off.
// Every access below reads through a field and is proven by a guard or a loop
// condition stated on the same path, with nothing in between that can resize
// the array or rebind the path. The golden shows each one with no
// `nish_panic_index` call; `h.idx[k]`-style reads the condition does not
// cover keep theirs.
class State {
  idx: i32[];
  holder: i32[];
  count: i32;
  constructor(idx: i32[], holder: i32[]) {
    this.idx = idx;
    this.holder = holder;
    this.count = 0;
  }
}

class Finder {
  state: State;
  src: string;
  constructor(state: State, src: string) {
    this.state = state;
    this.src = src;
  }

  // `knownAtMost` in `self/bounds.ts`, verbatim in shape: a two-link path from
  // `this`. `idx[k]` is proven by the condition; `holder[k]` is another path
  // and keeps its check.
  find(v: i32, w: i32): boolean {
    let k = 0;
    while (k < this.state.idx.length) {
      if (this.state.idx[k] === v && this.state.holder[k] === w) {
        return true;
      }
      k = k + 1;
    }
    return false;
  }

  // A string path: `charCodeAt` is a load and calls nothing, so the fact
  // survives it.
  sumCodes(): i32 {
    let s = 0;
    let i = 0;
    while (i < this.src.length) {
      s = s + this.src.charCodeAt(i);
      i = i + 1;
    }
    return s;
  }
}

// The hoisted length: `n <= h.idx.length`, then `i < n` proves `h.idx[i]`. The
// store to `count` in the loop names a field that is not on the path, so the
// fact survives it.
export const hoisted = (h: State): i32 => {
  const n = h.idx.length;
  let s = 0;
  let i = 0;
  while (i < n) {
    h.count = h.count + 1;
    s = s + h.idx[i];
    i = i + 1;
  }
  return s;
};

// A length guard proves a literal index.
export const third = (h: State): i32 => {
  if (h.idx.length > 2) {
    return h.idx[2];
  }
  return -1;
};

export const main = (): number => {
  const st = new State([4, 5, 6], [1, 2, 3]);
  const f = new Finder(st, "abc");
  console.log(`${f.find(5, 2)} ${f.find(5, 3)}`);
  console.log(`${f.sumCodes()}`);
  console.log(`${hoisted(st)} ${st.count}`);
  console.log(`${third(st)} ${third(new State([1], [1]))}`);
  return 0;
};
