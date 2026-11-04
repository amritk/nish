// Negative: the length is known only at run time, but `push` takes the field
// as a value and can move its header, so the field is neither inline nor
// boxed and keeps the pointer layout.
class Log {
  lines: i32[];

  constructor(n: i32) {
    this.lines = new Array<i32>(n);
  }

  add(v: i32): void {
    this.lines.push(v);
  }
}

export const main = (): number => {
  const l = new Log(2);
  l.add(7);
  console.log(`${l.lines.length} ${l.lines[2]}`);
  return 0;
};
