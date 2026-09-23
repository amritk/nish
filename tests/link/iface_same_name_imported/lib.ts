// The same pair as `iface_same_name_class`, with `Shape` exported, so an
// importer can name the very declaration `Circle` implements.
export interface Shape {
  area: f64;
}

export class Circle implements Shape {
  area: f64 = 3.5;
  radius: f64 = 1.0;
}

export const unit = (): Circle => new Circle();
