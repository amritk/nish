// Data parallelism (wp29 P1), the short map: an eight-element map called a
// million times, each call fed by the one before it. Eight elements are
// nowhere near a thread's worth of work, so the map has to come out as the
// loop it replaces: `seq` is that loop, `par` is `parallelMapInto`, and the
// time of the second over the first is what calling the map costs. Each
// element is four rounds of a multiply and a remainder, a line of real
// arithmetic rather than an empty body, so the ratio says what the call costs
// against work a program would have.
import { parallelMapInto } from "nish/threads";

const bump = (x: i32): i32 => {
  let h: i32 = x;
  for (let k: i32 = 0; k < 4; k++) {
    h = (h * 31 + k) % 1000003;
  }
  return h;
};

export const main = (): i32 => {
  const rounds: i32 = 1048576; // bench:n
  const par = process.argv.length > 1 && process.argv[1] === "par";
  const src: i32[] = [1, 2, 3, 4, 5, 6, 7, 8];
  const dst: i32[] = [0, 0, 0, 0, 0, 0, 0, 0];
  for (let r: i32 = 0; r < rounds; r++) {
    if (par) {
      parallelMapInto(src, dst, bump);
    } else {
      for (let i: i32 = 0; i < toI32(src.length); i++) {
        const y = bump(src[i]);
        if (i < toI32(dst.length)) {
          dst[i] = y;
        }
      }
    }
    const from: i32 = (r + 3) % 8;
    const to: i32 = r % 8;
    if (from >= 0 && from < toI32(dst.length) && to >= 0 && to < toI32(src.length)) {
      src[to] = dst[from];
    }
  }
  let sum: i32 = 0;
  for (let i: i32 = 0; i < toI32(dst.length); i++) {
    sum = sum + dst[i];
  }
  console.log(`${sum}`);
  return 0;
};
