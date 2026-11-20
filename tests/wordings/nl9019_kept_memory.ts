// NL9019: a function a loop runs on every pass keeps an allocation each call
// (a `let` given a second string), and the loop's passes release nothing.
const relabel = (n: i32): i32 => {
  let s = "none";
  if (n > 2) {
    s = `b${n}`;
  }
  return s.length;
};

export const labels = (rows: i32): i32 => {
  const out: string[] = [];
  for (let i = 0; i < rows; i++) {
    out.push(`${relabel(i)}`);
  }
  return out.length;
};

// What NL9019 judges: only a function a loop pass that releases nothing calls
// directly, each on what it allocates itself; a call inside an arrow function
// in the loop is not the pass's own and is not judged. Memory kept deeper in the call
// chain, behind a direct callee that returns memory, is not reported here:
// `nish --explain-memory` names the loop that keeps it. A direct callee that
// does its work only once, behind a guard, still warns when it keeps an array
// of its own. A constructor reached by `new` is never reported, and a loop
// inside a `using a = arena()` block, or inside an outer pass with a scope of
// its own, counts as released.
