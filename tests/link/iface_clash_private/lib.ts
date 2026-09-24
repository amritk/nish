// A private interface `Shape`, reachable only through `nameOf`'s parameter.
interface Shape {
  radius: f64;
  name: string;
}

export const nameOf = (s: Shape): string => s.name;
