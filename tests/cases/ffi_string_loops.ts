// WP27 S3.2: the copy of a `declare function`'s `string` result is a fresh
// allocation of the call, so a loop pass that makes one may not release it
// when the copy outlives the pass: returned from inside the loop (`find`),
// stored in a local of the function (`last`, and the `while`, `do`,
// `for...of` and nested shapes), as `string | null` (`nullable`), through a
// specialised function parameter (`err(strerror, ...)`), or pushed into an
// array the function returns (`into`). Each copy is read after `churn` has
// reused whatever a wrong release would have freed. `reject_ffi_string_arena`
// is the `using a = arena()` block, which refuses the same store.
declare function strerror(errnum: i32): string;
declare function getenv(name: string): string | null;

function churn(): i32 {
  const t: string[] = [];
  for (let i = 0; i < 4000; i++) {
    t.push(`${i}`);
  }
  return t.join("").length;
}

function find(n: i32): string {
  for (let i = 0; i < n; i++) {
    if (i === 2) {
      return strerror(i);
    }
  }
  return "none";
}

function last(n: i32): string {
  let s = "";
  for (let i = 0; i < n; i++) {
    s = strerror(i);
  }
  return s;
}

function whiles(n: i32): string {
  let s = "";
  let i = 0;
  while (i < n) {
    s = strerror(i);
    i = i + 1;
  }
  return s;
}

function does(n: i32): string {
  let s = "";
  let i = 0;
  do {
    s = strerror(i);
    i = i + 1;
  } while (i < n);
  return s;
}

function ofs(xs: i32[]): string {
  let s = "";
  for (const x of xs) {
    s = strerror(x);
  }
  return s;
}

function nested(n: i32): string {
  let s = "";
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      s = strerror(i + j);
    }
  }
  return s;
}

function nullable(n: i32): string | null {
  let s: string | null = null;
  for (let i = 0; i < n; i++) {
    s = getenv("HOME");
  }
  return s;
}

function err(f: (n: i32) => string, n: i32): string {
  let s = "";
  for (let i = 0; i < n; i++) {
    s = f(i);
  }
  return s;
}

function into(n: i32): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(strerror(i));
  }
  return out;
}

export function main(): i32 {
  const a = find(9);
  const b = last(3);
  const e = whiles(5);
  const f = does(6);
  const g = ofs([7, 8]);
  const h = nested(6);
  const k = nullable(2);
  const m = err(strerror, 12);
  const o = into(3);
  console.log(`${churn() > 0}`);
  console.log(a);
  console.log(b);
  console.log(e);
  console.log(f);
  console.log(g);
  console.log(h);
  console.log(k === null ? "unset" : "set");
  console.log(m);
  console.log(o.join("|"));
  return 0;
}
