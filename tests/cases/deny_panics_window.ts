// --deny-panics proves a [start, end) window a guard pins,
// `0 <= start <= end <= buf.length`, passed to a buffer call as
// `start, end - start`. The guard proves the window in range and the
// difference exact, since it lies in [0, end]. Bounds held in fields are
// copied into locals before the guard tests them. Each proof drops its check
// from the IR, and the program builds with no panic site left.
const window = (buf: u8[], start: i32, end: i32): void => {
  if (start >= 0 && start <= end && end <= buf.length) {
    writeBytes(buf, start, end - start);
  }
};

class Queue {
  out: u8[];
  start: i32 = 0;
  end: i32 = 0;

  constructor(out: u8[]) {
    this.out = out;
  }

  flush(): void {
    const out = this.out;
    const start = this.start;
    const end = this.end;
    if (start < 0 || start > end || end > out.length) {
      return;
    }
    writeBytes(out, start, end - start);
    this.start = end;
  }
}

export const main = (): number => {
  const b: u8[] = [104, 105, 32, 116, 104, 101, 114, 101, 10];
  window(b, 3, 9);
  const q = new Queue(b);
  q.end = 3;
  q.flush();
  window(b, 8, 9);
  return 0;
};
