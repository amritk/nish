// WP32: a `??` whose value is a class, where an interface it implements is
// wanted, joins the two class pointers and converts the result once.
interface Shape {
  side: number;
}

class Square implements Shape {
  side: number;
  constructor(side: number) {
    this.side = side;
  }
}

const area = (s: Shape): number => s.side * s.side;

export const main = (): i32 => {
  const m = new Map<string, Square>();
  const unit = new Square(1);
  m.set("a", new Square(4));
  const x: Shape = m.get("b") ?? unit;
  const found = m.get("a");
  const y: Shape = found ?? unit;
  console.log(`${x.side} ${y.side} ${area(m.get("a") ?? unit)}`);
  return 0;
};
