// NL9018: a function a loop runs on every pass keeps an allocation each call,
// and the loop's passes release nothing (each grows `names`, an array older
// than the pass), so what the calls keep grows with the loop. Three shapes keep
// their allocation: a string `let` assigned again, a `Result` `let` assigned
// from a conditional that may hand back the old value, and an array of the
// function's own. `fixed`, each value its own `const`, keeps nothing, and
// `outer` returns a number, so its own scope releases what `relabel` keeps
// when it runs it.
const relabel = (n: i32): i32 => {
  let s = "none";
  if (n > 2) {
    s = `b${n}`;
  }
  return s.length;
};

const choose = (n: i32): i32 => {
  let r: Result<i32, string> = Ok(n);
  r = n > 5 ? r : Ok(0);
  return r.unwrapOr(-1);
};

const parts = (n: i32): i32 => {
  const xs: string[] = [];
  xs.push(`${n}`);
  return xs.length;
};

const fixed = (n: i32): i32 => {
  const s = n > 2 ? `b${n}` : "none";
  return s.length;
};

const outer = (n: i32): i32 => relabel(n) + 1;

export const main = (): void => {
  const names: string[] = [];
  for (let i = 0; i < 1000; i++) {
    names.push(`${relabel(i) + outer(i) + choose(i) + parts(i) + fixed(i)}`);
  }
  console.log(`${names.length} ${names[0]} ${names[999]}`);
};
