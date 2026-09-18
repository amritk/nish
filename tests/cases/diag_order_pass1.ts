// The report order of the `performance` stream, with a **pass-1** warning in
// it. `diag_order` pins the two keys a file of pass-2 warnings can reach; this
// one is the case that sort was really written for, and could not exist until
// the struct-padding rule did (WP15 §8, NL9010).
//
// A struct's layout is known in pass 1, when its members are collected, so the
// two padding warnings below are found *before* the checker has looked at one
// function body — and the two accumulator warnings are found in pass 2, in
// source order, after both of them. The analysis therefore hands the sink
//
//     Slot (line 26), Frame (line 42), banner (line 20), tag (line 36)
//
// and the report is the file read top to bottom instead. Without the sort the
// padding warnings would print ahead of every warning in their file; with it,
// a pass is not a key at all.
export const banner = (n: i32): string => {
  let out = "";
  let i = 0;
  while (i < n) {
    out = out + "=";
    i = i + 1;
  }
  return out;
};

export class Slot {
  used: boolean = false;
  weight: f64 = 0;
  id: i32 = 0;
}

export const tag = (n: i32): string => {
  let s = "";
  let i = 0;
  while (i < n) {
    s = s + "#";
    i = i + 1;
  }
  return s;
};

export class Frame {
  open: boolean = false;
  span: f64 = 0;
  depth: i32 = 0;
}

export const test = (): number => {
  const slot = new Slot();
  slot.id = 1;
  const frame = new Frame();
  frame.depth = 2;
  return banner(2).length + tag(3).length + slot.id + frame.depth;
};
