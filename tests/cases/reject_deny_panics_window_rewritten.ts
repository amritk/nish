// --deny-panics refuses a window whose field-held bound is copied into a
// local, checked, and then read from the field again before the call: the
// write drops what the guard proved about `end`.
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
    let end = this.end;
    if (start < 0 || start > end || end > out.length) {
      return;
    }
    end = this.end;
    writeBytes(out, start, end - start);
  }
}

export const main = (): number => {
  const q = new Queue([1, 2]);
  q.flush();
  return 0;
};
