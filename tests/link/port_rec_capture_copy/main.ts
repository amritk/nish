// WP33 NL8003 through a capture (WP29): an arrow handed to a data-parallel
// form reads the enclosing function's `const` locals where the call runs it,
// so a record copied into an array, written through one copy and then read
// through the other inside the arrow, is the divergence the direct read is
// (tests/cases/port_rec_push_then_write), and is reported the same way: the
// original read after a write through the array, the array read after a
// write to the original, a copy into a literal, and the array read under a
// second name the arrow gives it. Native prints `1 1 15 1`; TypeScript, where
// the array holds the same object, `5 5 55 5`.
import { parallelFrom } from "nish/threads";

interface P {
  v: i32;
}

const throughArray = (): i32 => {
  const ps: P[] = [];
  const p: P = { v: 1 };
  ps.push(p);
  ps[0].v = 5;
  const ys = parallelFrom(1, (i) => p.v + i);
  return ys[0];
};

const throughOriginal = (): i32 => {
  const ps: P[] = [];
  const p: P = { v: 1 };
  ps.push(p);
  p.v = 5;
  const ys = parallelFrom(1, (i) => ps[0].v + i);
  return ys[0];
};

const intoLiteral = (): i32 => {
  const p: P = { v: 1 };
  const ps: P[] = [p];
  ps[0].v = 5;
  const ys = parallelFrom(2, (i) => p.v * 10 + ps[0].v + i);
  return ys[0];
};

const underSecondName = (): i32 => {
  const ps: P[] = [];
  const p: P = { v: 1 };
  ps.push(p);
  p.v = 5;
  const ys = parallelFrom(1, (i): i32 => {
    const qs = ps;
    return qs[0].v + i;
  });
  return ys[0];
};

export const main = (): i32 => {
  console.log(`${throughArray()} ${throughOriginal()} ${intoLiteral()} ${underSecondName()}`);
  return 0;
};
