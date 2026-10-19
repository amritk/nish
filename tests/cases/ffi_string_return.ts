// WP27 S3.2: a `declare function` that returns `string` or `string | null`
// answers a `const char *`, and the program copies its bytes into the arena
// at once: C keeps the buffer (`strerror`'s table, `getenv`'s environment,
// `setlocale`'s static), and the copy is the program's own string from then
// on. `string | null` reads `NULL` as `null`; `string` panics on `NULL`
// (`ffi-null`, `panics_ffi_null`). The copy follows the call, so a pointer C
// answers from inside an argument (`strchr`) is read before that argument's
// scope is released, and the copy lives where any other allocation in its
// function would: across `churn`, in an array and out of a function.
declare function strerror(errnum: i32): string;
declare function getenv(name: string): string | null;
declare function setenv(name: string, value: string, overwrite: i32): i32;
declare function setlocale(category: i32, locale: string | null): string | null;
declare function strchr(s: string, c: i32): string | null;

function digits(n: i32): string {
  return `${n * 7}`;
}

function noise(n: i32): i32 {
  let t = "";
  let i = 0;
  while (i < n) {
    t = t + `${i}`;
    i = i + 1;
  }
  return t.length;
}

function churn(): i32 {
  let t = 0;
  let i = 0;
  while (i < 64) {
    t = t + noise(40);
    i = i + 1;
  }
  return t;
}

function describe(e: i32): string {
  const k = noise(e + 3);
  const s = strerror(e);
  return k < 0 ? "never" : s;
}

function after(n: i32): string | null {
  const s = "xxab" + digits(n);
  return strchr(s, 98);
}

export function main(): i32 {
  console.log(strerror(2));
  const name: string = "NISH_FFI_STRING_RETURN";
  console.log(getenv(name) === null ? "unset" : "set");
  if (setenv(name, `v=${digits(3)}`, 1) !== 0) {
    return 1;
  }
  const back = getenv(name);
  console.log(back === null ? "unset" : back);
  // Category 0 is `LC_CTYPE` on glibc and `LC_ALL` on macOS, and either is
  // "C" before the program sets a locale; `null` makes the call a query.
  const locale = setlocale(0, null);
  console.log(locale === null ? "none" : locale);
  const kept = describe(13);
  const both = [strerror(1), strerror(2)];
  const tail = after(12345);
  console.log(`${churn() > 0}`);
  console.log(kept);
  console.log(`${both[0]}|${both[1]}`);
  console.log(tail === null ? "none" : tail);
  console.log(strchr("abc", 122) === null ? "none" : "found");
  return 0;
}
