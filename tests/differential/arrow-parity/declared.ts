// One half of the arrow-parity guard (tests/differential/arrow-parity.js): the
// `function` spelling of a program that leans on the shim. Its twin `arrow.ts` is
// the same program with every declaration written as an arrow bound to a `const`,
// and the guard rewrites both and compares the JavaScript.
//
// Every call here is one the rewrite has to redirect at `runtime/shim.mjs` --
// `console.log`, `write`, `getenv`, `isDirectorySync`, `parseInt`, `parseFloat`,
// `toI32`, `s.length`, `s.charCodeAt`, `s.substring`, `xs[i]` -- plus i32
// arithmetic, which has to wrap. A body that went through unrewritten would keep
// JavaScript's own meaning for every one of them, which is exactly what this pair
// exists to notice.
//
// The guard rewrites the program and never runs it, so the only reason the two
// builtins that reach outside are the read-only ones is that a fixture nobody runs
// should still be one anybody can run.
function label(n: i32): string {
  const doubled = n * 2 + 1;
  return `n=${doubled}`;
}

function firstByte(s: string): i32 {
  if (s.length === 0) {
    return -1;
  }
  return s.charCodeAt(0);
}

export function main(): number {
  const raw = getenv("NISH_ARROW_PARITY");
  if (raw === null) {
    console.log("unset");
    return 1;
  }
  console.log(label(firstByte(raw.substring(0, 2))));
  console.log(`${parseInt("41") + toI32(parseFloat("1.5"))}`);
  if (isDirectorySync(".")) {
    write("dir\n");
  }
  const xs = [1, 2, 3];
  console.log(`${xs[1] + xs.length}`);
  return 0;
}
