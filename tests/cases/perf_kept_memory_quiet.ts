import { getenv } from "nish:process";

// NL9019 is silent on each function below: either the function keeps nothing
// past its call, or every loop that runs it releases what it keeps, or it runs
// only behind a guard that does its work once.

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

// The only way the growing loop below reaches `relabel`: a number result, so
// `outer`'s own scope releases what `relabel` keeps on each call.
const outer = (n: i32): i32 => relabel(n) + 1;

// Keeps an array of its own on every call, but only latched callers run it.
const tally = (n: i32): i32 => {
  const xs: string[] = [];
  xs.push(`${n}`);
  return xs.length;
};

class Setup {
  prepared: boolean = false;
  label: string = "";
}

// Once-guarded: every call after the first returns at the guard, because the
// field it reads is set before the work.
const prepare = (s: Setup): void => {
  if (s.prepared) {
    return;
  }
  s.prepared = true;
  s.label = `${tally(3)}`;
};

class Style {
  value: string | null = null;

  // Cached: a call after the first answers the field the first one filled.
  get(n: i32): string {
    const known = this.value;
    if (known !== null) {
      return known;
    }
    const v = `${tally(n)}`;
    this.value = v;
    return v;
  }
}

const isNo = (value: string): boolean => value === "0" || value === "no";
const saysNo = (value: string | null): boolean => value !== null && isNo(value);

// The string `getenv` answers is handed to `saysNo`, which only reads it.
const envSaysNo = (name: string): boolean => saysNo(getenv(name));

// An array literal handed to a function, an element at a time, and the
// function only reads it.
const argc = (argv: string[]): i32 => argv.length;
const listed = (n: i32): i32 => argc(["x", `${n}`]);

// An object literal handed to a function the same way.
interface Pair {
  k: string;
}
const keyLength = (p: Pair): i32 => p.k.length;
const paired = (n: i32): i32 => keyLength({ k: `${n}` });

// A literal that is only read: `join` copies its elements into a new string.
const joined = (n: i32): i32 => ["a", `${n}`].join(",").length;

class Once {
  done: boolean = false;
}

// Latched, and reached only through a helper that hands on, unchanged, the
// object its loop passes on every pass. The helper answers a string, so it
// takes no scope that would release what `warmOnce` keeps.
const warmOnce = (o: Once): i32 => {
  if (o.done) {
    return 0;
  }
  o.done = true;
  const xs: string[] = [];
  xs.push(`${o.done}`);
  return xs.length;
};
const warmVia = (o: Once): string => `${warmOnce(o)}`;

export const main = (): void => {
  const setup = new Setup();
  const style = new Style();
  const once = new Once();
  const names: string[] = [];
  // Passes that grow an older array: only functions that keep nothing run here.
  for (let i = 0; i < 1000; i++) {
    names.push(`${fixed(i) + scoped(i) + pick(i) + outer(i) + listed(i) + paired(i) + joined(i)}${warmVia(once)}`);
    prepare(setup);
    names.push(`${style.get(i)}${envSaysNo("NISH_KEPT_MEMORY_UNSET") ? 1 : 0}`);
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
  console.log(`${names.length} ${names[1998]} ${names[2999]} ${total} ${relabel(7)} ${setup.label}`);
};
