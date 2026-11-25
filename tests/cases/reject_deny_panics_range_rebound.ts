// --deny-panics keeps the check of a range whose end is an assignment:
// `start` is read before `(start = 9)` runs, and an assignment is not a
// bound the proof reads, so the guard on the old `start` proves nothing.
export const pick = (buf: u8[], k: i32): string => {
  let start = k;
  if (start >= 0 && start <= buf.length) {
    return String.fromBytes(buf, start, (start = 9));
  }
  return "";
};
