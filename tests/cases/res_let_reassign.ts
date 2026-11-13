// A `let` holding a `Result` that is assigned again keeps the function's arena
// scope: the value assigned goes where the `let` goes rather than counting as
// a leak. Outside a loop each `Ok`/`Err` is its own alloca; inside one it is
// arena memory the function's scope gives back. Each shape below that keeps
// the value past the call (a closure kept, a store, `return`) still does.

// The reported shape: called in a loop, it must leave `Arena.used()` flat.
const pick = (n: i32): i32 => {
  let r: Result<i32, string> = Ok(n);
  if (n % 3 === 0 && r.isOk()) {
    r = Err("three");
  }
  return r.unwrapOr(-1);
};

// A pointer `Result` from a call, assigned again from a second call.
const parse = (s: string): Result<i32, string> => {
  if (s.length === 0) {
    return Err(`empty: ${s}`);
  }
  return Ok(s.length);
};

const parseOrZero = (s: string): i32 => {
  let r = parse(s);
  if (r.isErr()) {
    r = parse("0");
  }
  return r.unwrapOr(-1);
};

// The old value, named by a `const` before the `let` moves on, is still read.
const keepsOld = (n: i32): i32 => {
  let r: Result<i32, string> = Ok(n);
  const old = r;
  r = Ok(n + 1);
  return old.unwrapOr(0) * 10 + r.unwrapOr(0);
};

// A closure in the same function: an arrow captures neither a `let` nor
// anything holding a `Result` (the checker refuses both), so it is handed the
// unwrapped value and the function's `Result`s keep their placement.
const apply = (f: () => i32): i32 => f();

const viaClosure = (n: i32): i32 => {
  let r: Result<i32, string> = Ok(n);
  if (n > 2 && r.isOk()) {
    r = Ok(n * 2);
  }
  const v = r.unwrapOr(0);
  return apply(() => v + 1);
};

// `return r`: a pointer `Result` goes to the caller, a by-value one is copied.
const returned = (n: i32): Result<i32, string> => {
  let r: Result<i32, string> = Ok(n);
  if (n < 0 && r.isOk()) {
    r = Err(`negative ${n}`);
  }
  return r;
};

const returnedByValue = (n: i32): Result<i32, i32> => {
  let r: Result<i32, i32> = Ok(n);
  if (n < 0 && r.isOk()) {
    r = Err(n);
  }
  return r;
};

// Pushed into an array the caller owns: the `Result` outlives the call.
const pushInto = (out: Result<i32, string>[], n: i32): void => {
  let r: Result<i32, string> = Ok(n);
  if (n % 2 === 1 && r.isOk()) {
    r = Err(`odd ${n}`);
  }
  out.push(r);
};

// Assigned in a loop and read after it: the last pass's value is what is read,
// and the one before it is still intact.
const lastOfLoop = (n: i32): i32 => {
  let r: Result<i32, string> = Ok(-1);
  let prev = r;
  for (let i = 0; i < n; i++) {
    if (prev.isOk()) {
      prev = r;
    }
    if (r.isOk() || r.isErr()) {
      r = Ok(i);
    }
  }
  return prev.unwrapOr(-9) * 100 + r.unwrapOr(-9);
};

// A self-assignment through a conditional keeps the conservative answer.
const selfAssign = (n: i32): i32 => {
  let r: Result<i32, string> = Ok(n);
  r = n > 5 ? r : Ok(0);
  return r.unwrapOr(-1);
};

const flat = (): boolean => {
  let warm = 0;
  for (let i = 0; i < 1000; i++) {
    warm = warm + pick(i) + parseOrZero("ab") + lastOfLoop(3);
  }
  const before = Arena.used();
  let total = 0;
  for (let i = 0; i < 100000; i++) {
    total = total + pick(i) + parseOrZero(i % 2 === 0 ? "" : "abc") + keepsOld(i) + viaClosure(i);
    total = total + lastOfLoop(i % 4) + selfAssign(i);
  }
  return Arena.used() === before && total !== warm;
};

export const main = (): void => {
  console.log(`${pick(4)} ${pick(6)}`);
  console.log(`${parseOrZero("abc")} ${parseOrZero("")}`);
  console.log(keepsOld(4));
  console.log(`${viaClosure(1)} ${viaClosure(5)}`);
  const a = returned(7);
  const b = returned(-2);
  console.log(`${a.unwrapOr(0)} ${b.isErr()}`);
  const c = returnedByValue(8);
  const d = returnedByValue(-3);
  console.log(`${c.unwrapOr(0)} ${d.isErr()}`);
  const out: Result<i32, string>[] = [];
  for (let i = 0; i < 5; i++) {
    pushInto(out, i);
  }
  let oks = 0;
  for (const x of out) {
    if (x.isOk()) {
      oks = oks + x.unwrapOr(0);
    }
  }
  console.log(`${oks} ${out.length}`);
  console.log(`${lastOfLoop(0)} ${lastOfLoop(1)} ${lastOfLoop(5)}`);
  console.log(`${selfAssign(9)} ${selfAssign(2)}`);
  console.log(flat());
};
