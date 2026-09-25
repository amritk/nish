// Data parallelism (wp29 P1), the allocating kernel: every element formats a
// string and sums its bytes, so the body allocates on every call and the
// compiler warns (NL9012). The string is garbage the moment the body answers,
// and the body gets an arena scope of its own, so each element gives its
// bytes back before the next one starts, on whichever thread ran it. `seq`
// runs the loop, `par` runs `parallelMapInto`, and both print the same
// checksum.
import { parallelMapInto } from "nish/threads";

const label = (x: i32): i32 => {
  let s = "";
  if (x % 3 === 0) {
    s = `fizz${x}`;
  } else {
    s = `${x}`;
  }
  let h: i32 = 0;
  for (let k: i32 = 0; k < s.length; k++) {
    h = h + s.charCodeAt(k);
  }
  return h;
};

export const main = (): i32 => {
  const n: i32 = 4194304; // bench:n
  const par = process.argv.length > 1 && process.argv[1] === "par";
  const src = new Array<i32>(n);
  const dst = new Array<i32>(n);
  for (let i: i32 = 0; i < toI32(src.length); i++) {
    src[i] = i;
  }
  if (par) {
    parallelMapInto(src, dst, label);
  } else {
    for (let i: i32 = 0; i < toI32(src.length); i++) {
      const y = label(src[i]);
      if (i < toI32(dst.length)) {
        dst[i] = y;
      }
    }
  }
  let sum: i64 = 0;
  for (let i: i32 = 0; i < toI32(dst.length); i++) {
    sum = sum + toI64(dst[i]);
  }
  console.log(`${sum}`);
  return 0;
};
