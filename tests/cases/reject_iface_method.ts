// An interface is a layout: fields, and nothing that runs. A generic method
// with the optional marker is still a method.
export interface Shape {
  x: i32;
  area?<T>(of: T): i32;
}
