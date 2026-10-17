// WP27 S3.3: `readCString` copies the `NUL`-terminated bytes behind a `CPtr`
// into a string the program owns, so C's buffer is freed by its own `free`
// and the copy outlives it: `strdup` and `realpath(".", null)` hand out a
// malloc'd buffer, and the literal `null` is the `CPtr | null` parameter's own
// "no buffer, allocate one". Each pointer is narrowed with `!== null` before
// it is read or freed, which is how a `NULL` is kept from `readCString`. No shim: each function is libc's. The copy is a
// fresh allocation of the call, so a loop pass that makes one may not release
// it when the copy outlives the pass: returned from inside the loop (`find`)
// and stored in a local of the function (`last`, and the `while`, `do`,
// `for...of` and nested shapes). Every copy is read after its buffer is freed and after
// `churn` has reused whatever a wrong release would have freed.
import { readCString } from "nish:unsafe";

declare function strdup(s: string): CPtr | null;
declare function realpath(path: string, resolved: CPtr | null): CPtr | null;
declare function free(p: CPtr): void;

function churn(): i32 {
  const t: string[] = [];
  for (let i = 0; i < 4000; i++) {
    t.push(`${i}`);
  }
  return t.join("").length;
}

function find(n: i32): string {
  const p = strdup("owned by C");
  if (p === null) {
    return "";
  }
  for (let i = 0; i < n; i++) {
    if (i === 2) {
      const s = readCString(p);
      free(p);
      return s;
    }
  }
  free(p);
  return "none";
}

function last(n: i32): string {
  const p = strdup("owned by C");
  if (p === null) {
    return "";
  }
  let s = "";
  for (let i = 0; i < n; i++) {
    s = readCString(p);
  }
  free(p);
  return s;
}

function whiles(n: i32): string {
  const p = strdup("owned by C");
  if (p === null) {
    return "";
  }
  let s = "";
  let i = 0;
  while (i < n) {
    s = readCString(p);
    i = i + 1;
  }
  free(p);
  return s;
}

function does(n: i32): string {
  const p = strdup("owned by C");
  if (p === null) {
    return "";
  }
  let s = "";
  let i = 0;
  do {
    s = readCString(p);
    i = i + 1;
  } while (i < n);
  free(p);
  return s;
}

function ofs(xs: i32[]): string {
  const p = strdup("owned by C");
  if (p === null) {
    return "";
  }
  let s = "";
  for (const x of xs) {
    if (x > 0) {
      s = readCString(p);
    }
  }
  free(p);
  return s;
}

function nested(n: i32): string {
  const p = strdup("owned by C");
  if (p === null) {
    return "";
  }
  let s = "";
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      s = readCString(p);
    }
  }
  free(p);
  return s;
}

function owned(s: string): string {
  const p = strdup(s);
  if (p === null) {
    return "";
  }
  const copy = readCString(p);
  free(p);
  return copy;
}

function here(): string {
  const p = realpath(".", null);
  if (p === null) {
    return "";
  }
  const path = readCString(p);
  free(p);
  return path;
}

export function main(): i32 {
  const a = find(9);
  const b = last(3);
  const e = whiles(5);
  const f = does(6);
  const g = ofs([7, 8]);
  const h = nested(4);
  const k = owned("hello");
  const d = here();
  console.log(`${churn() > 0}`);
  console.log(a);
  console.log(b);
  console.log(e);
  console.log(f);
  console.log(g);
  console.log(h);
  console.log(`${k} ${k.length}`);
  console.log(`${d.startsWith("/")} ${d.length > 1}`);
  return 0;
}
