// The constraint lives here, with the template. `main.ts` declares a `Shape`
// of its own, which is a different declaration that happens to share the name.
export interface Shape {
  area: i32;
}

export const areaOf = <T extends Shape>(shape: T): i32 => shape.area;
