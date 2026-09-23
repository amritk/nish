// WP18 G6: a constrained parameter has exactly its constraint's members.
// `Circle` and `Ring` have a `radius` and `Shape` does not, so `shape.radius`
// is refused against `Shape` — once per template, though each template is
// instantiated twice: two templates, `2 errors`, where a refusal per
// instantiation would have been four.
interface Shape {
  area: i32;
}

class Circle implements Shape {
  area: i32 = 12;
  radius: i32 = 2;
}

class Ring implements Shape {
  area: i32 = 9;
  radius: i32 = 3;
}

const radiusOf = <T extends Shape>(shape: T): i32 => shape.radius;

const diameterOf = <T extends Shape>(shape: T): i32 => 2 * shape.radius;

export const test = (): number =>
  radiusOf(new Circle()) + radiusOf(new Ring()) + diameterOf(new Circle()) + diameterOf(new Ring());
