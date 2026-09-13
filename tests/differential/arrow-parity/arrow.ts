// The other half of the arrow-parity guard: `declared.ts` with every
// declaration written the WP22 way, as an arrow bound to a top-level `const`.
// Keep the two bodies character for character identical -- the guard's whole
// claim is that the same program in the two spellings rewrites to the same
// JavaScript, so a difference in a body would be a difference it cannot tell
// from the bug it is watching for.
const label = (n: i32): string => {
  const doubled = n * 2 + 1;
  return `n=${doubled}`;
};

const firstByte = (s: string): i32 => {
  if (s.length === 0) {
    return -1;
  }
  return s.charCodeAt(0);
};

export const main = (): number => {
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
};
