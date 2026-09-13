// NL2104: A constructor that returns early leaves a field unassigned, and the message names the field.
class Point {
  x: i32;
  constructor() {
    return;
  }
}
