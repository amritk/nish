// A labelled `break` or `continue` that leaves a `using arena()` block
// releases its region on the way out, as a `return` does, so the next pass
// opens a fresh one. The `Mutex` guard and `scope()` exits are
// tests/link/cf_label_dispose_threads, since a case cannot import
// `nish/threads`.
const arenas = (): i32 => {
  let out: i32 = 0;
  outer: for (let i: i32 = 0; i < 3; i++) {
    for (let j: i32 = 0; j < 3; j++) {
      using a = arena();
      const tag = `${i}${j}`;
      if (j === 1) continue outer;
      if (i === 2) break outer;
      out = out * 100 + tag.length * 10 + i;
    }
  }
  return out;
};

export const main = (): void => {
  console.log(arenas());
};
