// Every way a `u8[]` reaches `String.fromBytes`, and every index type its ends
// take: a class field, a `readonly` field, a field that would otherwise be
// stored inline (passing it to the call keeps it a pointer), a call's result,
// a ternary, an array literal; and `u32`, `i64`, `f64` and a ranged integer as
// the ends. Each prints the bytes it copied.
class Packet {
  body: u8[];
  readonly tag: readonly u8[];

  constructor() {
    this.body = [104, 105];
    this.tag = [116, 103];
  }
}

class Slots {
  cells: u8[];

  constructor() {
    this.cells = [115, 108, 111, 116];
  }

  first(): u8 {
    return this.cells[0];
  }

  text(): string {
    return String.fromBytes(this.cells, 0, 4);
  }
}

const made = (): u8[] => [109, 97, 100, 101];

const pick = (which: boolean, a: u8[], b: u8[]): string => String.fromBytes(which ? a : b, 0, 1);

const ranged = (bytes: u8[], end: integer<0, 4>): string => String.fromBytes(bytes, 0, end);

export const main = (): number => {
  const p = new Packet();
  console.log(String.fromBytes(p.body, 0, 2));
  console.log(String.fromBytes(p.tag, 1, 2));
  const s = new Slots();
  console.log(`${s.text()} ${s.first()}`);
  console.log(String.fromBytes(made(), 1, 4));
  const a: u8[] = [97];
  const b: u8[] = [98];
  console.log(`${pick(true, a, b)}${pick(false, a, b)}`);
  console.log(String.fromBytes([108, 105, 116], 0, 3));
  const wide: u32 = 3;
  const big: i64 = toI64(4);
  console.log(`${String.fromBytes(made(), 0, wide)} ${String.fromBytes(made(), toI64(1), big)}`);
  const f: f64 = 2.9;
  console.log(String.fromBytes(made(), 0, f));
  console.log(ranged(made(), 2));
  return 0;
};
