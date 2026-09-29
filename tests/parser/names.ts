// `with`, `try` and `var` are identifiers to the lexer, and a program may use
// them as names. WP33 R1 parses the statements they open, and does it only
// where the words cannot mean anything else, so each of these compiles as it
// did before: a call of a function named `with`, a variable `try` followed by
// a block on the next line that no `catch` or `finally` follows (an Allman
// `try` that has one is the statement, `reject_try_allman_catch`), and a
// variable `var` followed by an assignment on the next line (two statements
// under semicolon insertion). A call of a function named `finally` or `catch`
// right after such a block is a call too, not a handler: a handler is the
// word followed by a block, or `catch (e)` followed by a block.
//
// It is not TypeScript — `tsc` reserves all three words — so it lives here
// rather than in `tests/cases/`, whose programs `tsc` must accept, and
// `tests/run.js` compiles it and reads the call to `with` out of the IR.
function with(x: i32): i32 {
  return x + 1;
}

function finally(): i32 {
  return 10;
}

function catch(x: i32): i32 {
  return x * 100;
}

export const test = (): i32 => {
  let try: i32 = with(1);
  let var: i32 = 3;
  let n: i32 = 0;
  with(n);
  try
  {
    n = n + try;
  }
  var
  n = n + var;
  try
  {
    n = n + 1;
  }
  finally();
  try
  {
    n = n + 1;
  }
  catch(1);
  return n;
};
