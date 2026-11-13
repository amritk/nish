// NL9018 is silent on each function below: either the function keeps nothing
// past its call, or every loop that runs it releases what it keeps.

// A string `let` reassigned in its own function: the function keeps that
// allocation, but only the scoped passes and the single calls below run it.
const relabel = (n: i32): i32 => {
  let s = "none";
  if (n > 2) {
    s = `b${n}`;
  }
  return s.length;
};

// Each value its own `const`: the function's scope releases it on return.
const fixed = (n: i32): i32 => {
  const s = n > 2 ? `b${n}` : "none";
  return s.length;
};

// The same reassignment bracketed by an arena block.
const scoped = (n: i32): i32 => {
  using a = arena();
  let s = "none";
  if (n > 2) {
    s = `b${n}`;
  }
  return s.length;
};

// A `Result` reassigned after it is inspected stays in the function's scope.
const pick = (n: i32): i32 => {
  let r: Result<i32, string> = Ok(n);
  if (n % 3 === 0 && r.isOk()) {
    r = Err("three");
  }
  return r.unwrapOr(-1);
};

export const main = (): void => {
  const names: string[] = [];
  // Passes that grow an older array: only functions that keep nothing run here.
  for (let i = 0; i < 1000; i++) {
    names.push(`${fixed(i) + scoped(i) + pick(i)}`);
  }
  // Passes with nothing older than the pass: each pass releases what `relabel`
  // kept.
  let total = 0;
  for (let i = 0; i < 1000; i++) {
    total = total + relabel(i);
  }
  // Passes that grow an older array, around a block that releases its work.
  for (let i = 0; i < 1000; i++) {
    let n = 0;
    {
      using a = arena();
      n = relabel(i);
    }
    names.push(`${n}`);
  }
  console.log(`${names.length} ${names[999]} ${names[1999]} ${total} ${relabel(7)}`);
};
