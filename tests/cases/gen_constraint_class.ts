// WP18 G6: a generic class may constrain its parameter, and its own methods
// read the constraint's members through a field of that type. `this.item.area`
// in `Holder$$Circle.area` is two loads: `item` out of `%struct.Holder$$Circle`,
// then `area` out of `%struct.Circle` (WP18 §6.5).
interface Shape {
  area: i32;
}

class Circle implements Shape {
  area: i32;
  radius: i32;

  constructor(radius: i32) {
    this.area = 3 * radius * radius;
    this.radius = radius;
  }
}

class Holder<T extends Shape> {
  item: T;

  constructor(item: T) {
    this.item = item;
  }

  area(): i32 {
    return this.item.area;
  }
}

export const test = (): number => {
  const held = new Holder<Circle>(new Circle(2));
  return held.area();
};
