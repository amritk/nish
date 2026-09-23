// The constraint lives here, with the template.
export interface Shape {
  area: i32;
}

export const areaOf = <T extends Shape>(shape: T): i32 => shape.area;
