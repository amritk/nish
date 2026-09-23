// `Circle` implements *this* module's `Shape`, whose one field is `area`.
interface Shape {
  area: f64;
}

export class Circle implements Shape {
  area: f64 = 3.5;
}
