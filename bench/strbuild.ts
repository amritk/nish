// String building (i32 mode): N pieces of the form `${i},` (a template literal
// with a number hole) are joined into one string of about 1 MB. Joining is a
// 32-way tree of immutable concatenations, `s = s + chunk`, so the quadratic
// copying that a flat `s = s + piece` loop would do (and the memory it would
// pin, since arena strings are never freed) is bounded: each of the four tree
// levels copies the data about sixteen times. Every intermediate string is a
// fresh arena allocation; strbuild.c does the same with a bump arena,
// strbuild_naive.c with malloc/free per string, strbuild.rs with a fresh
// String per concatenation. Prints the final length; a wrong join would change it.
// (The fanout 32 is spelled inline: Nish has no top-level constants.)
function piece(i: number): string {
  return `${i},`;
}

function join(lo: number, hi: number): string {
  const count = hi - lo;
  if (count <= 32) {
    let s = "";
    for (let i = lo; i < hi; i++) {
      s = s + piece(i);
    }
    return s;
  }
  const step = (count + 31) / 32; // ceil(count / 32)
  let s = "";
  for (let start = lo; start < hi; start += step) {
    const end = start + step < hi ? start + step : hi;
    s = s + join(start, end);
  }
  return s;
}

export function main(): number {
  const N = 131072; // bench:n
  const s = join(0, N);
  console.log(s.length);
  return 0;
}
