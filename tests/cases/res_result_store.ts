// #233: a statement that stores a `Result` moves it rather than dropping it,
// and a generic body that drops a `T` drops what its template declared, even
// at `T = Result`. Each shape here was refused as a discard (NL2025).
const parse = (n: i32): Result<i32, string> => (n < 0 ? Err(`negative ${n}`) : Ok(n));

class Stack<T> {
  items: T[];
  constructor() {
    this.items = [];
  }
  push(item: T): void {
    this.items.push(item);
  }
  drop(): void {
    this.items.pop();
  }
}

const describe = (r: Result<i32, string>): string => (r.isOk() ? `ok ${r.value}` : `err ${r.error}`);

export const main = (): i32 => {
  const rs: Result<i32, string>[] = [parse(1), parse(-2)];
  rs[0] = rs[1];
  let r2 = parse(3);
  const r1 = parse(-4);
  console.log(describe(r2));
  r2 = r1;
  console.log(`${describe(rs[0])} ${describe(r2)}`);
  const s = new Stack<Result<i32, string>>();
  s.push(parse(5));
  s.push(parse(-6));
  s.drop();
  console.log(`${s.items.length} ${describe(s.items[0])}`);
  return 0;
};
